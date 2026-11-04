// Supabase Edge Function: `stripe-webhook`
// Applies Stripe payments to Storyit accounts (plan + credits). Deploy with "Verify JWT" DISABLED
// (Stripe cannot send a Supabase JWT; authenticity is checked with the Stripe signature instead).
// Secrets: STRIPE_WEBHOOK_SECRET (whsec_...), plus the STRIPE_PRICE_* used by `billing`.
// Events: checkout.session.completed, invoice.paid, customer.subscription.updated, customer.subscription.deleted
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
