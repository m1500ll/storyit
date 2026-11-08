// Supabase Edge Function: `billing`
// Creates Stripe Checkout sessions (plans & credit packs) and Customer Portal sessions.
// trial: true on a plan = the $1 three-day trial (one per account): a one-time $1 fee + 3 trial days, then the plan.
// It never counts as a referral (stripe-webhook only qualifies a referral on a paid plan line).
// status: the caller's trial (if one is running). end_trial { product? }: ends the trial now (optionally on the other
// plan): Stripe bills the full plan price at once and the webhook grants the plan's credits.
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_CREATOR, STRIPE_PRICE_STUDIO, STRIPE_PRICE_PACK_100, STRIPE_PRICE_PACK_500
// Optional: APP_URL (default http://localhost:5173)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { TRIAL } from '../_shared/stripe.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Product catalogue. Keys are what the browser may request; price IDs stay server-side. */
const PRODUCTS = {
  creator: { env: 'STRIPE_PRICE_CREATOR', mode: 'subscription' },
  studio: { env: 'STRIPE_PRICE_STUDIO', mode: 'subscription' },
  pack_100: { env: 'STRIPE_PRICE_PACK_100', mode: 'payment' },
  pack_500: { env: 'STRIPE_PRICE_PACK_500', mode: 'payment' },
} as const;
type ProductKey = keyof typeof PRODUCTS;

async function stripe(path: string, params?: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`, ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: params ? new URLSearchParams(params) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Stripe error ${res.status}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!Deno.env.get('STRIPE_SECRET_KEY')) return json({ error: 'Payments are not configured yet.' }, 503);

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await userClient.auth.getUser();
  const user = auth.user;
  if (!user) return json({ error: 'Please sign in again.' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173';

  try {
    const { action, product, trial } = (await req.json()) as { action: 'checkout' | 'portal' | 'status' | 'end_trial'; product?: ProductKey; trial?: boolean };

    // Get or create the Stripe customer for this user.
    const { data: profile } = await admin.from('profiles').select('stripe_customer_id, plan, trial_used').eq('id', user.id).single();
    let customerId = profile?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe('customers', { email: user.email ?? '', 'metadata[user_id]': user.id });
      customerId = customer.id as string;
      await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    if (action === 'status' || action === 'end_trial') {
      const subs = await stripe(`subscriptions?customer=${customerId}&status=trialing&limit=1`);
      const sub = subs?.data?.[0];
      const priceId = sub?.items?.data?.[0]?.price?.id as string | undefined;
      const current = priceId === Deno.env.get('STRIPE_PRICE_STUDIO') ? 'studio' : priceId === Deno.env.get('STRIPE_PRICE_CREATOR') ? 'creator' : null;
      if (action === 'status') return json({ trialing: !!sub, trial_end: sub?.trial_end ?? null, product: current });
      if (!sub) return json({ error: 'Aucun essai en cours.' }, 409);
      // end the trial now; on the other plan if asked (Stripe bills the full price of the plan immediately)
      const target = product === 'studio' || product === 'creator' ? product : current ?? 'creator';
      const params: Record<string, string> = { trial_end: 'now', proration_behavior: 'none', 'expand[]': 'latest_invoice' };
      if (target !== current) {
        const price = Deno.env.get(PRODUCTS[target].env);
        if (!price) return json({ error: 'Price not configured.' }, 503);
        params['items[0][id]'] = sub.items.data[0].id;
        params['items[0][price]'] = price;
        params['metadata[product]'] = target;
      }
      const updated = await stripe(`subscriptions/${sub.id}`, params);
      const inv = updated?.latest_invoice;
      const paid = inv?.status === 'paid';
      return json({ ok: true, status: updated.status, paid, product: target, invoice_url: paid ? null : inv?.hosted_invoice_url ?? null });
    }

    if (action === 'portal') {
      const session = await stripe('billing_portal/sessions', { customer: customerId, return_url: `${appUrl}/app/billing` });
      return json({ url: session.url });
    }

    if (action !== 'checkout' || !product || !(product in PRODUCTS)) return json({ error: 'Unknown product' }, 400);
    const { env, mode } = PRODUCTS[product];
    const price = Deno.env.get(env);
    if (!price) return json({ error: `Price not configured (${env}).` }, 503);

    const params: Record<string, string> = {
      mode,
      customer: customerId,
      client_reference_id: user.id,
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      success_url: `${appUrl}/app/billing?checkout=success`,
      cancel_url: `${appUrl}/app/billing?checkout=cancelled`,
      allow_promotion_codes: 'true',
      'metadata[user_id]': user.id,
      'metadata[product]': product,
    };
    if (mode === 'subscription') {
      params['subscription_data[metadata][user_id]'] = user.id;
      params['subscription_data[metadata][product]'] = product;
    }
    if (trial) {
      // one trial per account: never used, no paid plan now, no subscription ever on this Stripe customer
      if (mode !== 'subscription') return json({ error: 'The trial is only for plans.' }, 400);
      if (profile?.trial_used || (profile?.plan && profile.plan !== 'free')) return json({ error: 'Votre essai a déjà été utilisé.', code: 'trial_used' }, 409);
      const past = await stripe(`subscriptions?customer=${customerId}&status=all&limit=1`);
      if (past?.data?.length) return json({ error: 'Votre essai a déjà été utilisé.', code: 'trial_used' }, 409);
      const plan = await stripe(`prices/${price}`);
      params['subscription_data[trial_period_days]'] = String(TRIAL.days);
      params['subscription_data[metadata][trial]'] = '1';
      params['metadata[trial]'] = '1';
      params['line_items[1][price_data][currency]'] = String(plan.currency);
      params['line_items[1][price_data][unit_amount]'] = String(TRIAL.feeCents);
      params['line_items[1][price_data][product_data][name]'] = `Storyit — essai ${TRIAL.days} jours`;
      params['line_items[1][quantity]'] = '1';
      params['payment_method_collection'] = 'always';
      params['subscription_data[trial_settings][end_behavior][missing_payment_method]'] = 'cancel';
    }
    const session = await stripe('checkout/sessions', params);
    return json({ url: session.url });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Billing error' }, 500);
  }
});
