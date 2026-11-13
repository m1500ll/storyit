// Admin dashboard data (owner only): every member with their plan, payment status (from Stripe), credits and activity,
// plus the headline numbers. Read-only. Called by src/services/adminStats.ts; is_admin is checked on every call.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

async function stripe(path: string) {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) return null;
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) { console.error('stripe', path, res.status); return null; }
  return await res.json();
}
/** every page of a Stripe list (capped, the account is small) */
async function stripeAll(path: string, cap = 1000) {
  const out: any[] = [];
  let after = '';
  while (out.length < cap) {
    const page = await stripe(`${path}${path.includes('?') ? '&' : '?'}limit=100${after ? `&starting_after=${after}` : ''}`);
    if (!page?.data?.length) break;
    out.push(...page.data);
    if (!page.has_more) break;
    after = page.data[page.data.length - 1].id;
  }
  return out;
}

const DAY = 86_400_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: auth } = await userClient.auth.getUser();
  if (!auth.user) return json({ error: 'Veuillez vous reconnecter.' }, 401);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: me } = await admin.from('profiles').select('is_admin').eq('id', auth.user.id).single();
  if (!me?.is_admin) return json({ error: 'Réservé à l’administrateur.' }, 403);

  const [usersRes, profilesRes, txRes, animRes, pvRes, dubRes, affRes, invoices, subs] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('profiles').select('id, plan, credit_balance, trial_used, trial_ends_at, affiliate_id, stripe_customer_id, marketing_opt_out, is_admin'),
    admin.from('credit_transactions').select('user_id, amount, type, description, created_at').order('created_at', { ascending: false }).limit(20000),
    admin.from('animated_projects').select('user_id, status'),
    admin.from('prompt_videos').select('user_id, status'),
    admin.from('dub_jobs').select('user_id, status'),
    admin.from('affiliates').select('id, code, name'),
    stripeAll('invoices?status=paid'),
    stripeAll('subscriptions?status=all'),
  ]);
  const users = usersRes.data?.users ?? [];
  const profiles = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
  const affiliates = new Map((affRes.data ?? []).map((a: any) => [a.id, a]));
  const emailOf = new Map(users.map((u) => [u.id, u.email ?? '']));
  const userOfCustomer = new Map([...profiles.values()].filter((p: any) => p.stripe_customer_id).map((p: any) => [p.stripe_customer_id, p.id]));

  // Stripe: money actually collected per member, and their current subscription
  const paid = new Map<string, { total: number; last: number; currency: string }>();
  const payments: any[] = [];
  for (const i of invoices) {
    const uid = userOfCustomer.get(i.customer);
    const at = (i.status_transitions?.paid_at ?? i.created) * 1000;
    if (uid && i.amount_paid > 0) {
      const cur = paid.get(uid) ?? { total: 0, last: 0, currency: i.currency };
      cur.total += i.amount_paid; cur.last = Math.max(cur.last, at); paid.set(uid, cur);
    }
    if (i.amount_paid > 0) payments.push({ at, amount: i.amount_paid, currency: i.currency, email: uid ? emailOf.get(uid) : null, reason: i.billing_reason, label: (i.lines?.data?.[0]?.description ?? '').slice(0, 70) });
  }
  const subOf = new Map<string, any>();
  for (const s of subs) {
    const uid = userOfCustomer.get(s.customer);
    if (!uid) continue;
    const prev = subOf.get(uid);
    const rank = (x: any) => (x.status === 'active' ? 3 : x.status === 'trialing' ? 2 : x.status === 'past_due' ? 1 : 0);
    if (!prev || rank(s) > rank(prev) || (rank(s) === rank(prev) && s.created > prev.created)) subOf.set(uid, s);
  }
  let mrr = 0;
  for (const s of subOf.values()) {
    if (s.status !== 'active') continue;
    const price = s.items?.data?.[0]?.price;
    if (!price?.unit_amount) continue;
    mrr += price.recurring?.interval === 'year' ? price.unit_amount / 12 : price.unit_amount;
  }

  // activity per member
  const spent = new Map<string, number>(); const lastAct = new Map<string, number>();
  for (const t of txRes.data ?? []) {
    const at = Date.parse(t.created_at);
    if (t.type === 'consumption') spent.set(t.user_id, (spent.get(t.user_id) ?? 0) - t.amount);
    if (t.type === 'consumption') lastAct.set(t.user_id, Math.max(lastAct.get(t.user_id) ?? 0, at));
  }
  const videos = new Map<string, number>();
  for (const r of [...(animRes.data ?? []), ...(pvRes.data ?? []), ...(dubRes.data ?? [])]) if (r.status === 'done') videos.set(r.user_id, (videos.get(r.user_id) ?? 0) + 1);

  const now = Date.now();
  const members = users.map((u) => {
    const p: any = profiles.get(u.id) ?? {};
    const s = subOf.get(u.id);
    const money = paid.get(u.id);
    const status = s?.status === 'active' ? 'paying' : s?.status === 'trialing' ? 'trial' : s?.status === 'past_due' ? 'past_due' : money ? 'churned' : 'free';
    const price = s?.items?.data?.[0]?.price;
    return {
      id: u.id, email: u.email ?? '', signedUpAt: u.created_at, lastSignInAt: u.last_sign_in_at ?? null, confirmed: !!u.email_confirmed_at,
      plan: p.plan ?? 'free', status, interval: price?.recurring?.interval ?? null,
      renewsAt: s && (s.status === 'active' || s.status === 'trialing') ? ((s.current_period_end ?? s.items?.data?.[0]?.current_period_end ?? 0) * 1000 || null) : null,
      cancelAtPeriodEnd: !!s?.cancel_at_period_end, trialEndsAt: s?.status === 'trialing' && s.trial_end ? s.trial_end * 1000 : null,
      paidCents: money?.total ?? 0, lastPaymentAt: money?.last ?? null,
      credits: p.credit_balance ?? 0, spent: spent.get(u.id) ?? 0, videos: videos.get(u.id) ?? 0, lastActivityAt: lastAct.get(u.id) ?? null,
      partner: p.affiliate_id ? (affiliates.get(p.affiliate_id)?.code ?? 'partenaire') : null, isAdmin: !!p.is_admin, unsubscribed: !!p.marketing_opt_out,
    };
  }).sort((a, b) => Date.parse(b.signedUpAt) - Date.parse(a.signedUpAt));

  const customers = members.filter((m) => !m.isAdmin);
  const since = (ms: number) => customers.filter((m) => now - Date.parse(m.signedUpAt) < ms).length;
  const activity = (txRes.data ?? []).slice(0, 30).map((t: any) => ({ at: Date.parse(t.created_at), email: emailOf.get(t.user_id) ?? '', amount: t.amount, type: t.type, description: t.description }));

  return json({
    generatedAt: now,
    stripeConnected: !!Deno.env.get('STRIPE_SECRET_KEY'),
    kpis: {
      members: customers.length,
      paying: customers.filter((m) => m.status === 'paying').length,
      trials: customers.filter((m) => m.status === 'trial').length,
      churned: customers.filter((m) => m.status === 'churned').length,
      free: customers.filter((m) => m.status === 'free').length,
      mrrCents: Math.round(mrr),
      revenueCents: customers.reduce((s, m) => s + m.paidCents, 0),
      revenue30Cents: payments.filter((x) => now - x.at < 30 * DAY).reduce((s, x) => s + x.amount, 0),
      signupsToday: customers.filter((m) => new Date(m.signedUpAt).toDateString() === new Date(now).toDateString()).length,
      signups7d: since(7 * DAY), signups30d: since(30 * DAY),
      activated: customers.filter((m) => m.videos > 0).length,
      creditsOutstanding: customers.reduce((s, m) => s + m.credits, 0),
      viaPartner: customers.filter((m) => m.partner).length,
    },
    members,
    payments: payments.sort((a, b) => b.at - a.at).slice(0, 20),
    activity,
  });
});
