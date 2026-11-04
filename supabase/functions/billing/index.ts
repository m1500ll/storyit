// Supabase Edge Function: `billing`
// Creates Stripe Checkout sessions (plans & credit packs) and Customer Portal sessions.
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_CREATOR, STRIPE_PRICE_STUDIO, STRIPE_PRICE_PACK_100, STRIPE_PRICE_PACK_500
// Optional: APP_URL (default http://localhost:5173)
import { createClient } from 'npm:@supabase/supabase-js@2';

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

async function stripe(path: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
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
    const { action, product } = (await req.json()) as { action: 'checkout' | 'portal'; product?: ProductKey };

    // Get or create the Stripe customer for this user.
    const { data: profile } = await admin.from('profiles').select('stripe_customer_id').eq('id', user.id).single();
    let customerId = profile?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe('customers', { email: user.email ?? '', 'metadata[user_id]': user.id });
      customerId = customer.id as string;
      await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
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
    const session = await stripe('checkout/sessions', params);
    return json({ url: session.url });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Billing error' }, 500);
  }
});
