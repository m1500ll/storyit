// Automatic top-up (opt-in, subscribers only): when a customer's balance drops below their threshold, the database
// (migration 0036) asks this function for one top-up. It charges the saved card off-session for the chosen pack and
// grants the credits at once. Any failure (declined card, bank check needed) switches the option off and tells the
// customer on their billing page. At most 3 top-ups a day. Called only by the database, with the cron token.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isTopupAmount, topupPriceCents } from '../_shared/stripe.ts';

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
const DAILY_MAX = 3;

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function stripe(path: string, params?: Record<string, string>, idempotencyKey?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` };
  if (params) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { method: params ? 'POST' : 'GET', headers, body: params ? new URLSearchParams(params) : undefined });
  const data = await res.json();
  if (!res.ok) { const e = new Error(data?.error?.message ?? `Stripe ${res.status}`) as Error & { code?: string; pi?: any }; e.code = data?.error?.code; e.pi = data?.error?.payment_intent; throw e; }
  return data;
}

Deno.serve(async (req) => {
  const token = Deno.env.get('PUBLISHER_CRON_TOKEN');
  if (!token || token.length < 32 || !timingSafeEqual(req.headers.get('Authorization') ?? '', `Bearer ${token}`)) return json({ error: 'Forbidden' }, 403);
  const { topup_id } = (await req.json().catch(() => ({}))) as { topup_id?: string };
  if (!topup_id) return json({ error: 'topup_id required' }, 400);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: row } = await admin.from('auto_topups').select('*').eq('id', topup_id).single();
  if (!row || row.status !== 'pending') return json({ ok: false, reason: 'not pending' });
  const finish = (status: 'succeeded' | 'failed' | 'skipped', extra: Record<string, unknown> = {}) =>
    admin.from('auto_topups').update({ status, ...extra }).eq('id', topup_id);
  const { data: p } = await admin.from('profiles').select('plan, stripe_customer_id, auto_topup_enabled, auto_topup_pack').eq('id', row.user_id).single();
  const credits = Number(row.credits);
  if (!p?.auto_topup_enabled || !p.stripe_customer_id || p.plan === 'free' || !isTopupAmount(credits)) { await finish('skipped', { error: 'option off or no plan' }); return json({ ok: false, reason: 'skipped' }); }

  const { count } = await admin.from('auto_topups').select('id', { count: 'exact', head: true }).eq('user_id', row.user_id).eq('status', 'succeeded').gte('created_at', new Date(Date.now() - 86_400_000).toISOString());
  if ((count ?? 0) >= DAILY_MAX) { await finish('skipped', { error: 'daily limit' }); return json({ ok: false, reason: 'daily limit' }); }

  const disable = async (why: string) => {
    await admin.from('profiles').update({ auto_topup_enabled: false, auto_topup_failed_at: new Date().toISOString(), auto_topup_error: why }).eq('id', row.user_id);
  };
  try {
    // only subscribers with a live (paid, not trial) plan, and the card they pay it with
    const subs = await stripe(`subscriptions?customer=${p.stripe_customer_id}&status=active&limit=1`);
    const sub = subs?.data?.[0];
    const customer = await stripe(`customers/${p.stripe_customer_id}`);
    const pm = sub?.default_payment_method ?? customer?.invoice_settings?.default_payment_method
      ?? (await stripe(`payment_methods?customer=${p.stripe_customer_id}&type=card&limit=1`))?.data?.[0]?.id;
    if (!sub || !pm) { await finish('skipped', { error: 'no active plan or card' }); await disable('Aucun abonnement actif ou aucune carte enregistrée.'); return json({ ok: false, reason: 'no card' }); }
    const amount = topupPriceCents(credits);
    const pi = await stripe('payment_intents', {
      amount: String(amount), currency: 'usd', customer: p.stripe_customer_id, payment_method: String(pm),
      off_session: 'true', confirm: 'true', description: `Storyit — recharge automatique (${credits.toLocaleString('fr-FR')} crédits)`,
      'metadata[kind]': 'auto_topup', 'metadata[user_id]': row.user_id, 'metadata[topup_id]': topup_id, 'metadata[credits]': String(credits),
    }, `auto-topup-${topup_id}`);
    if (pi.status !== 'succeeded') throw Object.assign(new Error(`payment ${pi.status}`), { code: pi.status });
    const { error } = await admin.rpc('grant_credits', { p_user_id: row.user_id, p_amount: credits, p_type: 'purchase',
      p_description: `Recharge automatique — ${credits.toLocaleString('fr-FR')} crédits`, p_plan: null, p_reset: false });
    if (error) throw new Error(`grant: ${error.message}`); // paid but not granted: visible in the admin dashboard, fixed by hand
    await finish('succeeded', { credits, amount_cents: amount, currency: 'usd', payment_intent: pi.id });
    await admin.from('profiles').update({ auto_topup_failed_at: null, auto_topup_error: null }).eq('id', row.user_id);
    console.log(JSON.stringify({ audit: 'auto_topup', user: row.user_id, credits, amount, pi: pi.id }));
    return json({ ok: true, credits });
  } catch (e) {
    const err = e as Error & { code?: string };
    const why = err.code === 'authentication_required' || err.code === 'requires_action'
      ? 'Votre banque demande une validation : rechargez une fois à la main, puis réactivez la recharge automatique.'
      : 'Le paiement a été refusé : vérifiez votre carte, puis réactivez la recharge automatique.';
    console.error('auto-topup', row.user_id, err.code, err.message);
    await finish('failed', { error: `${err.code ?? ''} ${err.message}`.slice(0, 300) });
    if (!String(err.message).startsWith('grant:')) await disable(why);
    return json({ ok: false, error: err.message }, 502);
  }
});
