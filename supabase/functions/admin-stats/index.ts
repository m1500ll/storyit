// Admin dashboard data (owner only): every member with their plan, payment status (from Stripe), credits and activity,
// plus the headline numbers. Read-only. Called by src/services/adminStats.ts; is_admin is checked on every call.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Two Stripe accounts: the abandoned one (STRIPE_SECRET_KEY) still holds the November customers, the new one
 *  (STRIPE_SECRET_KEY_NEW) everything since Nov 17 2026. The dashboard reads and merges both. */
const KEYS = { legacy: 'STRIPE_SECRET_KEY', new: 'STRIPE_SECRET_KEY_NEW' } as const;
type Acct = keyof typeof KEYS;
async function stripe(path: string, acct: Acct) {
  const key = Deno.env.get(KEYS[acct]);
  if (!key) return null;
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) { console.error('stripe', path, res.status); return null; }
  return await res.json();
}
/** every page of a Stripe list (capped, the account is small) */
async function stripeAll(path: string, acct: Acct, cap = 1000) {
  const out: any[] = [];
  let after = '';
  while (out.length < cap) {
    const page = await stripe(`${path}${path.includes('?') ? '&' : '?'}limit=100${after ? `&starting_after=${after}` : ''}`, acct);
    if (!page?.data?.length) break;
    out.push(...page.data);
    if (!page.has_more) break;
    after = page.data[page.data.length - 1].id;
  }
  return out;
}

const DAY = 86_400_000;

/** Whop: every page of a list (memberships, payments), read-only */
async function whopAll(path: string, cap = 2000) {
  const key = Deno.env.get('WHOP_API_KEY');
  if (!key) return [];
  const out: any[] = [];
  let after = '';
  while (out.length < cap) {
    const res = await fetch(`https://api.whop.com/api/v1${path}${path.includes('?') ? '&' : '?'}first=100${after ? `&after=${encodeURIComponent(after)}` : ''}`,
      { headers: { Authorization: `Bearer ${key}`, 'Api-Version-Date': '2026-11-17' } });
    if (!res.ok) { console.error('whop', path, res.status); break; }
    const page = await res.json();
    out.push(...(page.data ?? []));
    if (!page.page_info?.has_next_page || !page.page_info?.end_cursor) break;
    after = page.page_info.end_cursor;
  }
  return out;
}
const money = (m: any) => Math.round(Number(m?.amount ?? 0) * 100);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // the operator's checks (scripts/call-function.py) use the cron token; everyone else must be a signed-in admin
  const cron = Deno.env.get('PUBLISHER_CRON_TOKEN');
  const header = req.headers.get('Authorization') ?? '';
  const operator = !!cron && cron.length >= 32 && header.length === cron.length + 7 && [...header].every((c, i) => c === `Bearer ${cron}`[i]);
  if (!operator) {
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: header } } });
    const { data: auth } = await userClient.auth.getUser();
    if (!auth.user) return json({ error: 'Veuillez vous reconnecter.' }, 401);
    const { data: me } = await admin.from('profiles').select('is_admin').eq('id', auth.user.id).single();
    if (!me?.is_admin) return json({ error: 'Réservé à l’administrateur.' }, 403);
  }

  // one member's full credit history (the dashboard's member sheet)
  const body = await req.json().catch(() => ({}));
  if (typeof body?.history === 'string' && /^[0-9a-f-]{36}$/.test(body.history)) {
    const [{ data: rows, error }, { data: prof }] = await Promise.all([
      admin.from('credit_transactions').select('created_at, type, amount, balance_after, description').eq('user_id', body.history).order('created_at', { ascending: false }).limit(2000),
      admin.from('profiles').select('credit_balance').eq('id', body.history).maybeSingle(),
    ]);
    if (error) return json({ error: error.message }, 500);
    const tx = (rows ?? []).map((r: any) => ({ at: Date.parse(r.created_at), type: r.type, amount: r.amount, balanceAfter: r.balance_after ?? null, description: r.description ?? '' }));
    const sum = (f: (t: any) => boolean) => tx.filter(f).reduce((s: number, t: any) => s + t.amount, 0);
    const taken = -sum((t) => t.type === 'consumption');
    const refunded = sum((t) => t.type === 'refund');
    return json({
      balance: prof?.credit_balance ?? 0,
      received: sum((t) => t.amount > 0 && t.type !== 'refund'),
      taken, refunded, used: taken - refunded,
      transactions: tx,
    });
  }

  const [usersRes, profilesRes, txRes, animRes, pvRes, dubRes, affRes, invOld, invNew, subOld, subNew] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('profiles').select('id, plan, credit_balance, trial_used, trial_ends_at, billing_provider, plan_renews_at, affiliate_id, stripe_customer_id, marketing_opt_out, is_admin, onboarding'),
    admin.from('credit_transactions').select('user_id, amount, type, description, created_at').order('created_at', { ascending: false }).limit(20000),
    admin.from('animated_projects').select('user_id, status'),
    admin.from('prompt_videos').select('user_id, status'),
    admin.from('dub_jobs').select('user_id, status'),
    admin.from('affiliates').select('id, code, name'),
    stripeAll('invoices?status=paid', 'legacy'), stripeAll('invoices?status=paid', 'new'),
    stripeAll('subscriptions?status=all', 'legacy'), stripeAll('subscriptions?status=all', 'new'),
  ]);
  const { data: whopAcct } = await admin.from('integration_settings').select('value').eq('key', 'whop_account_id').maybeSingle();
  const [whopMembers, whopPays] = whopAcct?.value
    ? await Promise.all([whopAll(`/memberships?account_id=${whopAcct.value}`), whopAll(`/payments?account_id=${whopAcct.value}`)])
    : [[], []];
  const invoices = [...invOld, ...invNew];
  const subs = [...subOld, ...subNew];
  const users = usersRes.data?.users ?? [];
  const profiles = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
  const affiliates = new Map((affRes.data ?? []).map((a: any) => [a.id, a]));
  const emailOf = new Map(users.map((u) => [u.id, u.email ?? '']));
  const userOfCustomer = new Map([...profiles.values()].filter((p: any) => p.stripe_customer_id).map((p: any) => [p.stripe_customer_id, p.id]));
  // a member's old-account customer is no longer on their profile: match it by the invoice e-mail or the metadata
  const userOfEmail = new Map(users.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u.id]));
  const uidOf = (o: any): string | undefined => userOfCustomer.get(o.customer) ?? (o.customer_email ? userOfEmail.get(String(o.customer_email).toLowerCase()) : undefined)
    ?? (o.metadata?.user_id && profiles.has(o.metadata.user_id) ? o.metadata.user_id : undefined);
  /** a subscription the customer cancelled that still runs until a date (old style: cancel_at_period_end; new: cancel_at) */
  const cancelling = (x: any) => !!x && (x.status === 'active' || x.status === 'trialing') && !!(x.cancel_at_period_end || x.cancel_at);

  // Stripe: money actually collected per member, and their current subscription
  const paid = new Map<string, { total: number; last: number; currency: string }>();
  let mrr0 = 0;
  /** every real payment of a member (Stripe and Whop), to check that the current period was actually paid */
  const payList = new Map<string, { at: number; amount: number }[]>();
  const addPay = (uid: string, at: number, amount: number) => { const l = payList.get(uid) ?? []; l.push({ at, amount }); payList.set(uid, l); };
  const payments: any[] = [];
  for (const i of invoices) {
    const uid = uidOf(i);
    const at = (i.status_transitions?.paid_at ?? i.created) * 1000;
    if (uid && i.amount_paid > 0) {
      const cur = paid.get(uid) ?? { total: 0, last: 0, currency: i.currency };
      cur.total += i.amount_paid; cur.last = Math.max(cur.last, at); paid.set(uid, cur);
      addPay(uid, at, i.amount_paid);
    }
    if (i.amount_paid > 0) payments.push({ at, amount: i.amount_paid, currency: i.currency, email: uid ? emailOf.get(uid) : null, reason: i.billing_reason, label: (i.lines?.data?.[0]?.description ?? '').slice(0, 70) });
  }
  // Whop: real payments (succeeded, more than $0, minus refunds) and the real state of each membership
  const userOfMembership = new Map([...profiles.values()].filter((p: any) => p.whop_membership_id).map((p: any) => [p.whop_membership_id, p.id]));
  // a payment made by hand at Whop has no metadata: the e-mail typed at checkout links it to the account of that
  // customer's other (metadata) payments
  const uidOfWhopEmail = new Map<string, string>();
  for (const p of [...whopPays].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))) {
    if (p.customer_email && p.metadata?.user_id && profiles.has(p.metadata.user_id)) uidOfWhopEmail.set(String(p.customer_email).toLowerCase(), p.metadata.user_id);
  }
  const whopUid = (o: any): string | undefined => (o.metadata?.user_id && profiles.has(o.metadata.user_id) ? o.metadata.user_id : undefined)
    ?? userOfMembership.get(o.membership_id ?? o.id)
    ?? (o.customer_email ? uidOfWhopEmail.get(String(o.customer_email).toLowerCase()) ?? userOfEmail.get(String(o.customer_email).toLowerCase()) : undefined);
  for (const p of whopPays) {
    if (p.substatus !== 'succeeded' && p.status !== 'paid') continue;
    const amount = money(p.usd_total ?? p.total) - money(p.refunded_amount);
    if (amount <= 0) continue;
    const uid = whopUid(p);
    const at = Date.parse(p.paid_at ?? p.created_at);
    if (uid) { const cur = paid.get(uid) ?? { total: 0, last: 0, currency: 'usd' }; cur.total += amount; cur.last = Math.max(cur.last, at); paid.set(uid, cur); addPay(uid, at, amount); }
    payments.push({ at, amount, currency: 'usd', email: uid ? emailOf.get(uid) : (p.customer_email ?? null), reason: p.billing_reason, label: `Whop · ${p.billing_reason === 'subscription_cycle' ? 'renouvellement' : p.billing_reason === 'one_time' ? 'pack de crédits' : 'abonnement'}` });
  }
  const whopOf = new Map<string, any>();
  const wrank = (m: any) => (m.status === 'active' ? 3 : m.status === 'trialing' ? 2 : m.status === 'past_due' ? 1 : 0);
  for (const m of whopMembers) {
    const uid = whopUid(m);
    if (!uid) continue;
    const prev = whopOf.get(uid);
    if (!prev || wrank(m) > wrank(prev) || (wrank(m) === wrank(prev) && Date.parse(m.created_at) > Date.parse(prev.created_at))) whopOf.set(uid, m);
  }
  for (const m of whopOf.values()) {
    if (m.status !== 'active' || m.cancel_at_period_end) continue;
    const price = money(m.renewal_price);
    mrr0 += (m.billing_period_days ?? 30) >= 300 ? price / 12 : price;
  }

  const subOf = new Map<string, any>();
  for (const s of subs) {
    const uid = uidOf(s);
    if (!uid) continue;
    const prev = subOf.get(uid);
    const rank = (x: any) => (x.status === 'active' ? 3 : x.status === 'trialing' ? 2 : x.status === 'past_due' ? 1 : 0);
    if (!prev || rank(s) > rank(prev) || (rank(s) === rank(prev) && s.created > prev.created)) subOf.set(uid, s);
  }
  /** a Stripe subscription is really paid when a payment of $5 or more came in for its current period */
  const periodStart = (s: any) => (s.current_period_start ?? s.items?.data?.[0]?.current_period_start ?? 0) * 1000;
  const stripePaid = (uid: string, s: any) => (payList.get(uid) ?? []).some((x) => x.amount >= 500 && x.at >= periodStart(s) - DAY);
  let mrr = mrr0;
  for (const [uid, s] of subOf) {
    if (s.status !== 'active' || cancelling(s) || !stripePaid(uid, s)) continue; // a cancelled or unpaid plan will not renew
    const price = s.items?.data?.[0]?.price;
    if (!price?.unit_amount) continue;
    mrr += price.recurring?.interval === 'year' ? price.unit_amount / 12 : price.unit_amount;
  }

  // activity per member
  const spent = new Map<string, number>(); const lastAct = new Map<string, number>();
  for (const t of txRes.data ?? []) {
    const at = Date.parse(t.created_at);
    // credits really used: what was taken, minus what came back when a video failed (refund)
    if (t.type === 'consumption') spent.set(t.user_id, (spent.get(t.user_id) ?? 0) - t.amount);
    if (t.type === 'refund') spent.set(t.user_id, (spent.get(t.user_id) ?? 0) - t.amount);
    if (t.type === 'consumption') lastAct.set(t.user_id, Math.max(lastAct.get(t.user_id) ?? 0, at));
  }
  const videos = new Map<string, number>();
  for (const r of [...(animRes.data ?? []), ...(pvRes.data ?? []), ...(dubRes.data ?? [])]) if (r.status === 'done') videos.set(r.user_id, (videos.get(r.user_id) ?? 0) + 1);

  const now = Date.now();
  const members = users.map((u) => {
    const p: any = profiles.get(u.id) ?? {};
    const s = subOf.get(u.id);
    const money = paid.get(u.id);
    // Whop memberships are read from Whop itself (trialing / active / past_due / canceled), never guessed from the profile
    // a plan sold by hand (one-off payment, migration 0061) runs until plan_renews_at
    const manual = p.billing_provider === 'manual' && p.plan && p.plan !== 'free' && !!p.plan_renews_at && Date.parse(p.plan_renews_at) > Date.now();
    const w = manual ? undefined : whopOf.get(u.id);
    const useWhop = !!w && (!s || wrank(w) >= (s.status === 'active' ? 3 : s.status === 'trialing' ? 2 : s.status === 'past_due' ? 1 : 0));
    const extTrial = useWhop && w.status === 'trialing';
    const wLive = useWhop && (w.status === 'active' || w.status === 'trialing');
    const status = manual ? 'paying' : useWhop
      ? (w.status === 'active' ? 'paying' : w.status === 'trialing' ? 'trial' : w.status === 'past_due' ? 'past_due' : money ? 'churned' : 'free')
      : s?.status === 'active' ? (stripePaid(u.id, s) ? 'paying' : 'past_due') : s?.status === 'trialing' ? 'trial' : s?.status === 'past_due' ? 'past_due' : money ? 'churned' : 'free';
    const price = s?.items?.data?.[0]?.price;
    return {
      id: u.id, email: u.email ?? '', signedUpAt: u.created_at, lastSignInAt: u.last_sign_in_at ?? null, confirmed: !!u.email_confirmed_at,
      plan: p.plan ?? 'free', status, provider: useWhop ? 'whop' : s ? 'stripe' : null,
      interval: useWhop ? ((w.billing_period_days ?? 30) >= 300 ? 'year' : 'month') : price?.recurring?.interval ?? null,
      renewsAt: manual ? Date.parse(p.plan_renews_at) : useWhop ? (wLive ? Date.parse(w.current_period_end) || null : null)
        : s && (s.status === 'active' || s.status === 'trialing') ? ((s.current_period_end ?? s.items?.data?.[0]?.current_period_end ?? 0) * 1000 || null) : null,
      cancelAtPeriodEnd: manual ? true : useWhop ? wLive && !!w.cancel_at_period_end : cancelling(s),
      cancelAt: manual ? Date.parse(p.plan_renews_at) : useWhop ? (wLive && w.cancel_at_period_end ? Date.parse(w.current_period_end) || null : null)
        : cancelling(s) ? ((s.cancel_at ?? s.current_period_end ?? s.items?.data?.[0]?.current_period_end ?? 0) * 1000 || null) : null,
      canceledAt: useWhop ? (w.canceled_at ? Date.parse(w.canceled_at) : null) : s?.canceled_at ? s.canceled_at * 1000 : null,
      trialEndsAt: extTrial ? Date.parse(w.current_period_end) || null : !useWhop && s?.status === 'trialing' && s.trial_end ? s.trial_end * 1000 : null,
      paidCents: money?.total ?? 0, lastPaymentAt: money?.last ?? null,
      credits: p.credit_balance ?? 0, spent: spent.get(u.id) ?? 0, videos: videos.get(u.id) ?? 0, lastActivityAt: lastAct.get(u.id) ?? null,
      partner: p.affiliate_id ? (affiliates.get(p.affiliate_id)?.code ?? 'partenaire') : null, isAdmin: !!p.is_admin, unsubscribed: !!p.marketing_opt_out,
      onboarding: p.onboarding ? { goal: p.onboarding.goal ?? null, target: p.onboarding.target ?? null, time: p.onboarding.time ?? null, level: p.onboarding.level ?? null } : null,
    };
  }).sort((a, b) => Date.parse(b.signedUpAt) - Date.parse(a.signedUpAt));

  const customers = members.filter((m) => !m.isAdmin);
  const since = (ms: number) => customers.filter((m) => now - Date.parse(m.signedUpAt) < ms).length;
  const activity = (txRes.data ?? []).slice(0, 30).map((t: any) => ({ at: Date.parse(t.created_at), email: emailOf.get(t.user_id) ?? '', amount: t.amount, type: t.type, description: t.description }));

  return json({
    generatedAt: now,
    stripeConnected: !!(Deno.env.get('STRIPE_SECRET_KEY') || Deno.env.get('STRIPE_SECRET_KEY_NEW')),
    kpis: {
      members: customers.length,
      paying: customers.filter((m) => m.status === 'paying').length,
      trials: customers.filter((m) => m.status === 'trial').length,
      churned: customers.filter((m) => m.status === 'churned').length,
      cancelling: customers.filter((m) => m.cancelAtPeriodEnd).length,
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
