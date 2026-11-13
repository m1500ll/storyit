// Ends a customer's $1 trial early, when their trial credits are used up (database trigger on credit_transactions,
// migration 0034). Stripe then bills the plan the customer chose at its full monthly price, and stripe-webhook grants
// the plan's credits on `invoice.paid`. Called only by the database, with the cron token.
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function stripe(path: string, params?: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`, ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Stripe ${res.status}`);
  return data;
}

Deno.serve(async (req) => {
  const token = Deno.env.get('PUBLISHER_CRON_TOKEN');
  if (!token || token.length < 32 || !timingSafeEqual(req.headers.get('Authorization') ?? '', `Bearer ${token}`)) return json({ error: 'Forbidden' }, 403);
  const { user_id } = (await req.json().catch(() => ({}))) as { user_id?: string };
  if (!user_id) return json({ error: 'user_id required' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: profile } = await admin.from('profiles').select('stripe_customer_id').eq('id', user_id).single();
  if (!profile?.stripe_customer_id) return json({ ok: false, reason: 'no customer' });
  try {
    const subs = await stripe(`subscriptions?customer=${profile.stripe_customer_id}&status=trialing&limit=1`);
    const sub = subs?.data?.[0];
    if (!sub) return json({ ok: false, reason: 'no trial' });
    // the chosen plan stays the same: only the trial stops, and Stripe invoices the full price now
    const updated = await stripe(`subscriptions/${sub.id}`, { trial_end: 'now', proration_behavior: 'none', 'metadata[trial_ended]': 'credits_used' });
    console.log(JSON.stringify({ audit: 'trial_converted', user: user_id, subscription: sub.id, status: updated.status }));
    return json({ ok: true, status: updated.status });
  } catch (e) {
    // the trial simply runs to its end (day 3) if this fails
    console.error('trial-convert', user_id, e instanceof Error ? e.message : e);
    return json({ ok: false, error: e instanceof Error ? e.message : 'error' }, 502);
  }
});
