#!/usr/bin/env node
/**
 * One-shot, idempotent Stripe setup for Storyit (safe to re-run).
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
 * Creates (or reuses, by lookup_key): 2 monthly plans + 2 credit packs, the Customer Portal configuration,
 * and the webhook endpoint. Prints the values to store as Supabase Edge Function secrets.
 * Prices mirror src/services/credits.ts — change both together.
 */
const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) { console.error('Set STRIPE_SECRET_KEY'); process.exit(1); }
const WEBHOOK_URL = process.env.WEBHOOK_URL ?? 'https://hubkgvfiiszthzqyfguf.supabase.co/functions/v1/stripe-webhook';
const APP_URL = process.env.APP_URL ?? 'https://storyit.fun';
const CURRENCY = process.env.CURRENCY ?? 'usd';

async function stripe(method, path, params) {
  const url = new URL(`https://api.stripe.com/v1/${path}`);
  const body = params ? new URLSearchParams(params) : undefined;
  if (method === 'GET' && body) body.forEach((v, k) => url.searchParams.append(k, v));
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: method === 'GET' ? undefined : body });
  const data = await res.json();
  if (!res.ok) throw new Error(`${path}: ${data?.error?.message ?? res.status}`);
  return data;
}

const CATALOG = [
  { env: 'STRIPE_PRICE_CREATOR', lookup: 'storyit_creator_monthly', name: 'Storyit Creator', amount: 2900, recurring: true },
  { env: 'STRIPE_PRICE_STUDIO', lookup: 'storyit_studio_monthly', name: 'Storyit Studio', amount: 9900, recurring: true },
  { env: 'STRIPE_PRICE_PACK_100', lookup: 'storyit_pack_100', name: 'Storyit — 100 credits', amount: 1200, recurring: false },
  { env: 'STRIPE_PRICE_PACK_500', lookup: 'storyit_pack_500', name: 'Storyit — 500 credits', amount: 4900, recurring: false },
];

const out = { mode: KEY.startsWith('sk_live') ? 'LIVE' : 'TEST' };
for (const item of CATALOG) {
  const found = await stripe('GET', 'prices', { 'lookup_keys[]': item.lookup, active: 'true' });
  let price = found.data[0];
  if (!price) {
    const product = await stripe('POST', 'products', { name: item.name, 'metadata[storyit]': item.lookup });
    price = await stripe('POST', 'prices', {
      product: product.id, currency: CURRENCY, unit_amount: String(item.amount), lookup_key: item.lookup,
      ...(item.recurring ? { 'recurring[interval]': 'month' } : {}),
    });
  }
  out[item.env] = price.id;
}

// Customer Portal: cancel, update payment method, switch between the two plans, see invoices.
const portals = await stripe('GET', 'billing_portal/configurations', { active: 'true', limit: '10' });
if (!portals.data.some((c) => c.metadata?.storyit === '1')) {
  const plans = await Promise.all(['STRIPE_PRICE_CREATOR', 'STRIPE_PRICE_STUDIO'].map((k) => stripe('GET', `prices/${out[k]}`)));
  const p = {
    'business_profile[headline]': 'Storyit — manage your subscription',
    'business_profile[privacy_policy_url]': `${APP_URL}/privacy`, 'business_profile[terms_of_service_url]': `${APP_URL}/terms`,
    'default_return_url': `${APP_URL}/app/billing`,
    'features[invoice_history][enabled]': 'true', 'features[payment_method_update][enabled]': 'true',
    'features[subscription_cancel][enabled]': 'true', 'features[subscription_cancel][mode]': 'at_period_end',
    'features[subscription_update][enabled]': 'true', 'features[subscription_update][default_allowed_updates][0]': 'price',
    'features[subscription_update][proration_behavior]': 'create_prorations', 'metadata[storyit]': '1',
  };
  plans.forEach((pr, i) => { p[`features[subscription_update][products][${i}][product]`] = pr.product; p[`features[subscription_update][products][${i}][prices][0]`] = pr.id; });
  await stripe('POST', 'billing_portal/configurations', p);
}

// Webhook endpoint (the signing secret is only returned at creation time).
const hooks = await stripe('GET', 'webhook_endpoints', { limit: '100' });
const existing = hooks.data.find((h) => h.url === WEBHOOK_URL);
if (existing) {
  out.STRIPE_WEBHOOK_SECRET = '(unchanged: already created earlier — keep the existing secret)';
} else {
  const events = ['checkout.session.completed', 'invoice.paid', 'customer.subscription.updated', 'customer.subscription.deleted'];
  const hook = await stripe('POST', 'webhook_endpoints', { url: WEBHOOK_URL, ...Object.fromEntries(events.map((e, i) => [`enabled_events[${i}]`, e])), description: 'Storyit' });
  out.STRIPE_WEBHOOK_SECRET = hook.secret;
}
console.log(JSON.stringify(out, null, 2));
