// Supabase Edge Function: `stripe-webhook`
// Applies Stripe payments to Storyit accounts (plan + credits). Deploy with "Verify JWT" DISABLED
// (Stripe cannot send a Supabase JWT; authenticity is checked with the Stripe signature instead).
// Secrets: STRIPE_WEBHOOK_SECRET (whsec_...), plus the STRIPE_PRICE_* used by `billing`.
// Events: checkout.session.completed, invoice.paid, customer.subscription.updated, customer.subscription.deleted
// Referrals (migration 0021): a referred friend's first PAID subscription invoice qualifies the referral: the friend gets
// REFERRAL_FRIEND_BONUS credits (default 50), the referrer free months as Stripe customer balance (months x the price of
// their plan, Creator when they have none), which pays their next invoices. Secret: STRIPE_SECRET_KEY.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GRANTS, invoicePriceId, planForSubscription, productForPrice, verifySignature, type ProductKey } from '../_shared/stripe.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const env = (k: string) => Deno.env.get(k);

async function userIdForCustomer(customerId: string | null | undefined) {
  if (!customerId) return null;
  const { data } = await admin.from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function grant(userId: string, product: ProductKey, reset: boolean) {
  const g = GRANTS[product];
  const { error } = await admin.rpc('grant_credits', {
    p_user_id: userId, p_amount: g.credits, p_type: g.plan ? 'subscription_grant' : 'purchase',
    p_description: g.label, p_plan: g.plan ?? null, p_reset: reset,
  });
  if (error) throw new Error(error.message);
}

async function stripeApi(path: string, params?: Record<string, string>, idempotencyKey?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}` };
  if (params) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { method: params ? 'POST' : 'GET', headers, body: params ? new URLSearchParams(params) : undefined });
  const data = await res.json();
  if (!res.ok) throw new Error(`stripe ${path}: ${data?.error?.message ?? res.status}`);
  return data;
}

/** rewards the referral of `referredId` (their first paid subscription invoice). Retry-safe: flags in the database plus
 *  an idempotency key per referral on the Stripe balance transaction. */
async function rewardReferral(referredId: string) {
  const bonus = Number(env('REFERRAL_FRIEND_BONUS') ?? '50');
  const { data, error } = await admin.rpc('qualify_referral', { p_referred: referredId, p_friend_bonus: bonus });
  if (error) throw new Error('qualify_referral: ' + error.message);
  const r = (data as { referral_id: string; referrer_id: string; months: number; rank: number; reward_applied: boolean; bonus_applied: boolean; friend_bonus: number }[] | null)?.[0];
  if (!r) return; // not referred, or already rewarded
  if (!r.bonus_applied) {
    if (r.friend_bonus > 0) {
      const { error: e } = await admin.rpc('grant_credits', { p_user_id: referredId, p_amount: r.friend_bonus, p_type: 'bonus', p_description: 'Parrainage — crédits de bienvenue' });
      if (e) throw new Error(e.message);
    }
    await admin.from('referrals').update({ bonus_applied: true }).eq('id', r.referral_id);
  }
  if (!r.reward_applied) {
    const { data: ref } = await admin.from('profiles').select('plan, stripe_customer_id').eq('id', r.referrer_id).single();
    let customer = ref?.stripe_customer_id as string | null;
    if (!customer) {
      const { data: u } = await admin.auth.admin.getUserById(r.referrer_id);
      customer = (await stripeApi('customers', { email: u.user?.email ?? '', 'metadata[user_id]': r.referrer_id }, `referrer-customer-${r.referrer_id}`)).id as string;
      await admin.from('profiles').update({ stripe_customer_id: customer }).eq('id', r.referrer_id);
    }
    const priceId = env(ref?.plan === 'studio' ? 'STRIPE_PRICE_STUDIO' : 'STRIPE_PRICE_CREATOR');
    if (!priceId) throw new Error('referral reward: plan price not configured');
    const price = await stripeApi(`prices/${priceId}`);
    const amount = Number(price.unit_amount) * r.months;
    await stripeApi(`customers/${customer}/balance_transactions`, {
      amount: String(-amount), currency: String(price.currency),
      description: `Parrainage Storyit : ${r.months} mois offert${r.months > 1 ? 's' : ''} (ami n°${r.rank})`,
      'metadata[referral_id]': r.referral_id,
    }, `referral-reward-${r.referral_id}`);
    await admin.from('referrals').update({ reward_applied: true }).eq('id', r.referral_id);
    console.log(JSON.stringify({ audit: 'referral_reward', referrer: r.referrer_id, months: r.months, rank: r.rank, amount, currency: price.currency }));
  }
}

Deno.serve(async (req) => {
  const payload = await req.text();
  const secret = env('STRIPE_WEBHOOK_SECRET');
  if (!secret || !(await verifySignature(payload, req.headers.get('stripe-signature'), secret))) {
    return new Response('Invalid signature', { status: 400 });
  }
  const event = JSON.parse(payload);

  // Idempotency: Stripe retries; apply each event once.
  const { error: dup } = await admin.from('stripe_events').insert({ id: event.id, type: event.type });
  if (dup) return new Response('Already processed', { status: 200 });

  try {
    const obj = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed': {
        // One-off packs only; subscriptions are granted on invoice.paid (first month + renewals).
        if (obj.mode === 'payment' && obj.payment_status === 'paid') {
          const userId = obj.client_reference_id ?? obj.metadata?.user_id;
          const product = obj.metadata?.product as ProductKey | undefined;
          // Only packs can be bought in payment mode; never trust metadata to grant a plan.
          if (userId && (product === 'pack_100' || product === 'pack_500')) await grant(userId, product, false);
        }
        break;
      }
      case 'invoice.paid': {
        // The product comes from the price actually paid (covers plan changes made in the Customer Portal).
        const product = productForPrice(invoicePriceId(obj), env);
        const meta = obj.parent?.subscription_details?.metadata ?? obj.subscription_details?.metadata ?? {};
        const userId = (await userIdForCustomer(obj.customer)) ?? meta.user_id;
        if (userId && product && GRANTS[product].plan && obj.amount_paid >= 0) await grant(userId, product, true);
        // referral: the friend's first real payment for a subscription
        if (userId && product && GRANTS[product].plan && obj.amount_paid > 0) await rewardReferral(userId);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const userId = (await userIdForCustomer(obj.customer)) ?? obj.metadata?.user_id;
        const plan = event.type === 'customer.subscription.deleted' ? 'free' : planForSubscription(obj, env);
        if (userId && plan) await admin.from('profiles').update({ plan }).eq('id', userId);
        break;
      }
    }
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error(e);
    // Let Stripe retry: forget the event so the retry is processed.
    await admin.from('stripe_events').delete().eq('id', event.id);
    return new Response('Handler error', { status: 500 });
  }
});
