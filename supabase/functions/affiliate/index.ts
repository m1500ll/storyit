// Supabase Edge Function: `affiliate` (influencer programme). Deploy with "Verify JWT" DISABLED: clicks and partner
// dashboards are public (the dashboard is protected by the partner's secret token); signed-in actions check the JWT here.
// - click { code, visitor }                 public: records a click on storyit.fun/?via=CODE (deduplicated 30 min per visitor)
// - claim { code, visitor }                 signed in: attaches the caller to the partner of their last click (7 days),
//                                           unless they already paid a plan
// - stats { secret }                        public: the partner's live dashboard (no customer identity)
// - admin_list / admin_create { name, code, rate? } / admin_payout { affiliate_id, amount_cents, note? }
//   / admin_toggle { affiliate_id, active }  signed in + profiles.is_admin
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const APP = (Deno.env.get('APP_URL') ?? 'https://storyit.fun').replace(/\/$/, '');
const WINDOW_DAYS = 7;
const VISITOR = /^[a-f0-9-]{16,64}$/i;
const CODE = /^[a-z0-9-]{2,24}$/;

async function signedInUser(req: Request) {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  const { data } = await admin.auth.getUser(auth.slice(7));
  return data.user ?? null;
}

/** dashboard figures of one partner (shared by the partner page and the admin list) */
async function statsFor(a: { id: string; name: string; code: string; commission_rate: number; active: boolean; secret?: string }) {
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const since7 = new Date(Date.now() - 7 * 864e5).toISOString();
  const [{ count: clicks }, { count: clicks7 }, { data: recent }, { data: conv }, { data: pays }] = await Promise.all([
    admin.from('affiliate_clicks').select('id', { count: 'exact', head: true }).eq('affiliate_id', a.id),
    admin.from('affiliate_clicks').select('id', { count: 'exact', head: true }).eq('affiliate_id', a.id).gte('created_at', since7),
    admin.from('affiliate_clicks').select('created_at, visitor').eq('affiliate_id', a.id).gte('created_at', since30).limit(20000),
    admin.from('affiliate_conversions').select('signed_up_at, status, product, amount_cents, commission_cents, currency, paid_at').eq('affiliate_id', a.id).order('signed_up_at', { ascending: false }).limit(500),
    admin.from('affiliate_payouts').select('amount_cents, paid_at, note').eq('affiliate_id', a.id).order('paid_at', { ascending: false }),
  ]);
  const byDay: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) byDay[new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)] = 0;
  for (const c of recent ?? []) { const d = (c.created_at as string).slice(0, 10); if (d in byDay) byDay[d]++; }
  const paid = (conv ?? []).filter((c) => c.status === 'paid');
  const byPlan: Record<string, number> = {};
  for (const c of paid) byPlan[c.product ?? 'autre'] = (byPlan[c.product ?? 'autre'] ?? 0) + 1;
  const earned = paid.reduce((s, c) => s + (c.commission_cents ?? 0), 0);
  const sales = paid.reduce((s, c) => s + (c.amount_cents ?? 0), 0);
  const paidOut = (pays ?? []).reduce((s, p) => s + p.amount_cents, 0);
  return {
    name: a.name, code: a.code, active: a.active, rate: Number(a.commission_rate), link: `${APP}/?via=${a.code}`,
    clicks: clicks ?? 0, clicks7: clicks7 ?? 0, visitors30: new Set((recent ?? []).map((c) => c.visitor)).size, clicksByDay: byDay,
    signups: (conv ?? []).length, customers: paid.length, byPlan, salesCents: sales, earnedCents: earned, paidOutCents: paidOut, dueCents: earned - paidOut,
    conversions: (conv ?? []).map((c) => ({ date: c.signed_up_at, status: c.status, product: c.product, amountCents: c.amount_cents, commissionCents: c.commission_cents, paidAt: c.paid_at })),
    payouts: pays ?? [],
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const action = String(body.action ?? '');

  if (action === 'click') {
    const code = String(body.code ?? '').toLowerCase(), visitor = String(body.visitor ?? '');
    if (!CODE.test(code) || !VISITOR.test(visitor)) return json({ ok: false }, 400);
    const { data: a } = await admin.from('affiliates').select('id').eq('code', code).eq('active', true).maybeSingle();
    if (!a) return json({ ok: false });
    const { count } = await admin.from('affiliate_clicks').select('id', { count: 'exact', head: true })
      .eq('affiliate_id', a.id).eq('visitor', visitor).gte('created_at', new Date(Date.now() - 30 * 6e4).toISOString());
    if (!count) await admin.from('affiliate_clicks').insert({ affiliate_id: a.id, visitor });
    return json({ ok: true });
  }

  if (action === 'stats') {
    const secret = String(body.secret ?? '');
    if (!/^[a-f0-9]{32,80}$/.test(secret)) return json({ error: 'Lien invalide.' }, 404);
    const { data: a } = await admin.from('affiliates').select('id,name,code,commission_rate,active').eq('secret', secret).maybeSingle();
    if (!a) return json({ error: 'Lien invalide.' }, 404);
    return json(await statsFor(a));
  }

  const user = await signedInUser(req);
  if (!user) return json({ error: 'Veuillez vous reconnecter.' }, 401);

  if (action === 'claim') {
    const code = String(body.code ?? '').toLowerCase(), visitor = String(body.visitor ?? '');
    if (!CODE.test(code) || !VISITOR.test(visitor)) return json({ result: 'invalid' }, 400);
    const { data: a } = await admin.from('affiliates').select('id').eq('code', code).eq('active', true).maybeSingle();
    if (!a) return json({ result: 'unknown_code' });
    const { data: click } = await admin.from('affiliate_clicks').select('created_at').eq('affiliate_id', a.id).eq('visitor', visitor)
      .gte('created_at', new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!click) return json({ result: 'expired' });
    const { data: paidConv } = await admin.from('affiliate_conversions').select('id').eq('user_id', user.id).eq('status', 'paid').maybeSingle();
    const { data: prof } = await admin.from('profiles').select('plan').eq('id', user.id).single();
    if (paidConv || (prof && prof.plan !== 'free')) return json({ result: 'already_customer' }); // only new paying customers count
    await admin.from('profiles').update({ affiliate_id: a.id, affiliate_clicked_at: click.created_at }).eq('id', user.id);
    await admin.from('affiliate_conversions').upsert({ affiliate_id: a.id, user_id: user.id, status: 'signed_up', signed_up_at: new Date().toISOString() }, { onConflict: 'user_id' });
    return json({ result: 'ok' });
  }

  // admin
  const { data: me } = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!me?.is_admin) return json({ error: 'Réservé à l’administrateur.' }, 403);

  if (action === 'admin_list') {
    const { data } = await admin.from('affiliates').select('id,name,code,secret,commission_rate,active,created_at').order('created_at', { ascending: false });
    const out = [];
    for (const a of data ?? []) out.push({ id: a.id, secret: a.secret, dashboard: `${APP}/partner/${a.secret}`, created_at: a.created_at, ...(await statsFor(a)) });
    return json({ partners: out });
  }
  if (action === 'admin_create') {
    const name = String(body.name ?? '').trim().slice(0, 80);
    const code = String(body.code ?? '').trim().toLowerCase();
    const rate = body.rate == null ? 0.2 : Number(body.rate);
    if (!name) return json({ error: 'Donnez un nom au partenaire.' }, 400);
    if (!CODE.test(code)) return json({ error: 'Code : 2 à 24 caractères, lettres minuscules, chiffres ou tirets.' }, 400);
    if (!(rate >= 0 && rate <= 1)) return json({ error: 'Commission invalide.' }, 400);
    const { data, error } = await admin.from('affiliates').insert({ name, code, commission_rate: rate }).select('id').single();
    if (error) return json({ error: /duplicate|unique/i.test(error.message) ? 'Ce code est déjà pris.' : error.message }, 409);
    return json({ id: data.id });
  }
  if (action === 'admin_payout') {
    const amount = Math.round(Number(body.amount_cents));
    if (!body.affiliate_id || !(amount > 0)) return json({ error: 'Montant invalide.' }, 400);
    const { error } = await admin.from('affiliate_payouts').insert({ affiliate_id: body.affiliate_id, amount_cents: amount, note: body.note ? String(body.note).slice(0, 200) : null });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }
  if (action === 'admin_toggle') {
    await admin.from('affiliates').update({ active: !!body.active }).eq('id', body.affiliate_id);
    return json({ ok: true });
  }
  return json({ error: 'Action inconnue' }, 400);
});
