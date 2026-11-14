// Supabase Edge Function: `billing`
// Creates Stripe Checkout sessions (plans & credit packs) and Customer Portal sessions.
// trial: true on a plan = the $1 three-day trial (one per account): a one-time $1 fee + 3 trial days, then the plan.
// It never counts as a referral (stripe-webhook only qualifies a referral on a paid plan line).
// status: the caller's trial (if one is running). end_trial { product? }: ends the trial now (optionally on the other
// plan): Stripe bills the full plan price at once and the webhook grants the plan's credits.
// checkout on a higher plan while a plan is already running = upgrade of that subscription: the customer pays only the
// price difference now (one invoice) and stripe-webhook switches the plan and grants only the credit difference.
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_CREATOR, STRIPE_PRICE_PRO, STRIPE_PRICE_STUDIO, STRIPE_PRICE_{CREATOR,PRO,STUDIO}_YEAR, STRIPE_PRICE_PACK_100, STRIPE_PRICE_PACK_500
// Optional: APP_URL (default http://localhost:5173)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GRANTS, isTopupAmount, TOPUP, TRIAL } from '../_shared/stripe.ts';

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
  pro: { env: 'STRIPE_PRICE_PRO', mode: 'subscription' },
  studio: { env: 'STRIPE_PRICE_STUDIO', mode: 'subscription' },
  creator_year: { env: 'STRIPE_PRICE_CREATOR_YEAR', mode: 'subscription' },
  pro_year: { env: 'STRIPE_PRICE_PRO_YEAR', mode: 'subscription' },
  studio_year: { env: 'STRIPE_PRICE_STUDIO_YEAR', mode: 'subscription' },
  pack_100: { env: 'STRIPE_PRICE_PACK_100', mode: 'payment' },
  pack_500: { env: 'STRIPE_PRICE_PACK_500', mode: 'payment' },
} as const;
type ProductKey = keyof typeof PRODUCTS;
const PLAN_KEYS = ['creator', 'pro', 'studio'] as const;
type PlanKey = (typeof PLAN_KEYS)[number];
const PLAN_NAMES: Record<PlanKey, string> = { creator: 'Creator', pro: 'Pro', studio: 'Studio' };
const planOfPrice = (priceId?: string | null) => PLAN_KEYS.find((p) => priceId && Deno.env.get(PRODUCTS[p].env) === priceId) ?? null;
/** yearly product → its plan (creator_year → creator) */
const yearlyPlanOfPrice = (priceId?: string | null) => PLAN_KEYS.find((p) => priceId && Deno.env.get(PRODUCTS[`${p}_year` as ProductKey].env) === priceId) ?? null;

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
    const body = (await req.json()) as { action: 'checkout' | 'portal' | 'status' | 'end_trial' | 'recent_checkouts' | 'customer_subscriptions' | 'recent_invoices' | 'auto_topup' | 'customer_payments' | 'recent_payments'; product?: ProductKey; trial?: boolean; user_id?: string; enabled?: boolean; threshold?: number; credits?: number };
    const { action, product, trial } = body;

    // Admin: the latest checkout pages (what was picked, at what price, did it end in a payment) to study drop-off.
    if (action === 'customer_subscriptions') { // admin: a customer's Stripe subscriptions (status, plan, cancellation)
      const { data: me } = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
      if (!me?.is_admin) return json({ error: 'Forbidden' }, 403);
      const { data: who } = await admin.from('profiles').select('stripe_customer_id, plan').eq('id', String(body.user_id ?? '')).single();
      if (!who?.stripe_customer_id) return json({ plan: who?.plan ?? null, subscriptions: [] });
      const subs = await stripe(`subscriptions?customer=${who.stripe_customer_id}&status=all&limit=10`);
      return json({ plan: who.plan, subscriptions: (subs?.data ?? []).map((s: any) => ({
        status: s.status, product: planOfPrice(s.items?.data?.[0]?.price?.id) ?? yearlyPlanOfPrice(s.items?.data?.[0]?.price?.id),
        created: s.created, canceled_at: s.canceled_at, cancel_at_period_end: s.cancel_at_period_end, ended_at: s.ended_at,
        reason: s.cancellation_details?.reason ?? null, current_period_end: s.current_period_end ?? s.items?.data?.[0]?.current_period_end ?? null,
      })) });
    }
    if (action === 'recent_payments') { // admin: the latest payment attempts of all customers, failed ones included
      const { data: me } = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
      if (!me?.is_admin) return json({ error: 'Forbidden' }, 403);
      const list = await stripe('payment_intents?limit=25');
      const custs = [...new Set((list?.data ?? []).map((x: any) => x.customer).filter(Boolean))];
      const { data: owners } = await admin.from('profiles').select('id, stripe_customer_id, plan').in('stripe_customer_id', custs as string[]);
      const who = new Map((owners ?? []).map((o: any) => [o.stripe_customer_id, o]));
      const emails = new Map<string, string>();
      for (const o of owners ?? []) { const { data } = await admin.auth.admin.getUserById(o.id); if (data?.user?.email) emails.set(o.id, data.user.email); }
      return json({ payments: (list?.data ?? []).map((x: any) => { const o: any = who.get(x.customer); return {
        created: x.created, amount: x.amount, currency: x.currency, status: x.status, description: x.description ?? null,
        error: x.last_payment_error?.message ?? null, code: x.last_payment_error?.decline_code ?? x.last_payment_error?.code ?? null,
        email: o ? emails.get(o.id) ?? null : null, user: o?.id ?? null, plan: o?.plan ?? null }; }) });
    }
    if (action === 'customer_payments') { // admin: a customer's payment attempts and why they failed (declined card, 3-D Secure…)
      const { data: me } = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
      if (!me?.is_admin) return json({ error: 'Forbidden' }, 403);
      const { data: who } = await admin.from('profiles').select('stripe_customer_id, plan').eq('id', String(body.user_id ?? '')).single();
      if (!who?.stripe_customer_id) return json({ plan: who?.plan ?? null, attempts: [] });
      const [pis, subs] = await Promise.all([stripe(`payment_intents?customer=${who.stripe_customer_id}&limit=10`), stripe(`subscriptions?customer=${who.stripe_customer_id}&status=all&limit=5`)]);
      return json({ plan: who.plan,
        attempts: (pis?.data ?? []).map((x: any) => ({ created: x.created, amount: x.amount, status: x.status, error: x.last_payment_error?.message ?? null,
          decline: x.last_payment_error?.decline_code ?? x.last_payment_error?.code ?? null, card: x.last_payment_error?.payment_method?.card?.brand ?? null })),
        subscriptions: (subs?.data ?? []).map((x: any) => ({ status: x.status, created: x.created, canceled_at: x.canceled_at, product: planOfPrice(x.items?.data?.[0]?.price?.id) ?? yearlyPlanOfPrice(x.items?.data?.[0]?.price?.id) })) });
    }
    if (action === 'recent_invoices') { // admin: every paid invoice (plans, upgrades, trials) with the Storyit account it belongs to
      const { data: me } = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
      if (!me?.is_admin) return json({ error: 'Forbidden' }, 403);
      const list = await stripe('invoices?status=paid&limit=100');
      const custs = [...new Set((list?.data ?? []).map((i: any) => i.customer))];
      const { data: owners } = await admin.from('profiles').select('id, stripe_customer_id').in('stripe_customer_id', custs as string[]);
      const who = new Map((owners ?? []).map((o: any) => [o.stripe_customer_id, o.id]));
      return json({ invoices: (list?.data ?? []).map((i: any) => ({
        id: i.id, created: i.created, paid_at: i.status_transitions?.paid_at ?? null, amount_paid: i.amount_paid, currency: i.currency,
        reason: i.billing_reason, user: who.get(i.customer) ?? null, kind: i.metadata?.kind ?? null,
        subtotal: i.subtotal, total: i.total, starting_balance: i.starting_balance, ending_balance: i.ending_balance,
        discounts: (i.total_discount_amounts ?? []).map((x: any) => x.amount), coupon: i.discount?.coupon?.id ?? i.discounts?.[0] ?? null,
        lines: (i.lines?.data ?? []).map((l: any) => ({ amount: l.amount, price: l.pricing?.price_details?.price ?? l.price?.id ?? null, desc: (l.description ?? '').slice(0, 60) })),
      })) });
    }
    if (action === 'recent_checkouts') {
      const { data: me } = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
      if (!me?.is_admin) return json({ error: 'Forbidden' }, 403);
      const list = await stripe('checkout/sessions?limit=50&expand[]=data.line_items');
      return json({ sessions: (list?.data ?? []).map((s: any) => ({
        created: s.created, status: s.status, paid: s.payment_status, mode: s.mode, product: s.metadata?.product ?? null,
        amount: s.amount_total, currency: s.currency, methods: s.payment_method_types, locale: s.locale,
        recovered: Boolean(s.recovered_from), user: s.client_reference_id ?? null,
      })) });
    }

    // Get or create the Stripe customer for this user.
    const { data: profile } = await admin.from('profiles').select('stripe_customer_id, plan, trial_used').eq('id', user.id).single();
    let customerId = profile?.stripe_customer_id as string | null;
    // just looking at the plans must not create a Stripe customer (it showed up as a "new customer" who never paid)
    if (!customerId && action === 'status') return json({ trialing: false, trial_end: null, product: null });
    if (action === 'auto_topup' && body.enabled && (!profile?.plan || profile.plan === 'free')) return json({ error: 'La recharge automatique est réservée aux abonnés.' }, 409);
    if (!customerId) {
      const customer = await stripe('customers', { email: user.email ?? '', 'metadata[user_id]': user.id });
      customerId = customer.id as string;
      await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    /** ends a running trial now, on `target` if given: Stripe bills the full plan price at once */
    const endTrial = async (sub: any, target: PlanKey) => {
      const current = planOfPrice(sub.items.data[0].price.id);
      if (target !== current) {
        // switch the plan first, while still in trial (no charge): ending the trial in the same call as a price change
        // left the subscription on the new plan with no invoice at all
        const price = Deno.env.get(PRODUCTS[target].env);
        if (!price) return json({ error: 'Price not configured.' }, 503);
        await stripe(`subscriptions/${sub.id}`, { 'items[0][id]': sub.items.data[0].id, 'items[0][price]': price, proration_behavior: 'none', 'metadata[product]': target });
      }
      // then end the trial: Stripe bills the new period at the plan's full price
      const updated = await stripe(`subscriptions/${sub.id}`, { trial_end: 'now', proration_behavior: 'none', 'expand[]': 'latest_invoice' });
      const inv = updated?.latest_invoice;
      const paid = inv?.status === 'paid';
      return json({ ok: true, status: updated.status, paid, product: target, invoice_url: paid ? null : inv?.hosted_invoice_url ?? null });
    };

    if (action === 'status' || action === 'end_trial') {
      const subs = await stripe(`subscriptions?customer=${customerId}&status=trialing&limit=1`);
      const sub = subs?.data?.[0];
      const current = planOfPrice(sub?.items?.data?.[0]?.price?.id);
      if (action === 'status') return json({ trialing: !!sub, trial_end: sub?.trial_end ?? null, product: current });
      if (!sub) return json({ error: 'Aucun essai en cours.' }, 409);
      return endTrial(sub, PLAN_KEYS.find((p) => p === product) ?? current ?? 'creator');
    }

    if (action === 'auto_topup') { // the customer's opt-in for automatic top-ups (settings only; auto-topup charges)
      const enabled = !!body.enabled;
      const threshold = Number(body.threshold);
      const credits = Number(body.credits);
      if (!(TOPUP.thresholds as readonly number[]).includes(threshold) || !isTopupAmount(credits)) return json({ error: `Choisissez entre ${TOPUP.min} et ${TOPUP.max} crédits (par 1 000).` }, 400);
      if (enabled) {
        if (!profile?.plan || profile.plan === 'free') return json({ error: 'La recharge automatique est réservée aux abonnés.' }, 409);
        const subs = await stripe(`subscriptions?customer=${customerId}&status=active&limit=1`);
        const sub = subs?.data?.[0];
        const customer = await stripe(`customers/${customerId}`);
        const pm = sub?.default_payment_method ?? customer?.invoice_settings?.default_payment_method
          ?? (await stripe(`payment_methods?customer=${customerId}&type=card&limit=1`))?.data?.[0]?.id;
        if (!sub) return json({ error: 'La recharge automatique démarre une fois votre abonnement payé (pas pendant l’essai).' }, 409);
        if (!pm) return json({ error: 'Aucune carte enregistrée : ajoutez-en une dans « Gérer la facturation ».' }, 409);
      }
      const { error } = await admin.from('profiles').update({ auto_topup_enabled: enabled, auto_topup_threshold: threshold, auto_topup_credits: credits,
        ...(enabled ? { auto_topup_failed_at: null, auto_topup_error: null } : {}) }).eq('id', user.id);
      if (error) return json({ error: 'Enregistrement impossible.' }, 500);
      return json({ ok: true, enabled, threshold, credits });
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
      // reassurance right under Stripe's pay button
      'custom_text[submit][message]': mode === 'subscription'
        ? 'Résiliable à tout moment en 1 clic depuis Storyit. Vos crédits arrivent dès le paiement.'
        : 'Paiement unique, sans abonnement. Vos crédits arrivent dès le paiement et n’expirent jamais.',
      'metadata[user_id]': user.id,
      'metadata[product]': product,
    };
    if (mode === 'subscription' && !trial) {
      // a plan is already running: upgrade it instead of opening a second subscription
      const subs = await stripe(`subscriptions?customer=${customerId}&status=all&limit=20`);
      const sub = (subs?.data ?? []).find((x: any) => ['active', 'trialing', 'past_due', 'incomplete'].includes(x.status));
      if (sub) {
        // monthly ↔ yearly, or any change involving a yearly plan: Stripe switches the price and bills the prorated
        // difference at once (the unused part of the current period is credited); stripe-webhook grants the new plan
        const targetYear = product.endsWith('_year');
        const curYear = yearlyPlanOfPrice(sub.items.data[0].price.id);
        if (targetYear || curYear) {
          const curPlan = curYear ?? planOfPrice(sub.items.data[0].price.id);
          const tgtPlan = product.replace('_year', '') as PlanKey;
          if (!curPlan) return json({ error: 'Votre abonnement actuel ne peut pas être modifié ici. Utilisez « Gérer la facturation ».' }, 409);
          if (sub.items.data[0].price.id === price) return json({ error: 'Vous avez déjà cette offre.' }, 409);
          if (curYear && !targetYear) return json({ error: 'Pour repasser au mensuel, utilisez « Gérer la facturation » : le changement se fera à la fin de votre année.', code: 'downgrade' }, 409);
          if (PLAN_KEYS.indexOf(tgtPlan) < PLAN_KEYS.indexOf(curPlan)) return json({ error: 'Pour passer à une offre inférieure, utilisez « Gérer la facturation ».', code: 'downgrade' }, 409);
          if (sub.status !== 'active' && sub.status !== 'trialing') return json({ error: 'Une facture est en attente : réglez-la dans « Gérer la facturation », puis réessayez.' }, 409);
          const updated = await stripe(`subscriptions/${sub.id}`, {
            'items[0][id]': sub.items.data[0].id, 'items[0][price]': price, proration_behavior: 'always_invoice',
            payment_behavior: 'pending_if_incomplete', 'metadata[product]': product, ...(sub.status === 'trialing' ? { trial_end: 'now' } : {}),
            'expand[]': 'latest_invoice',
          });
          const inv = updated?.latest_invoice;
          const paid = inv?.status === 'paid';
          return json({ upgraded: true, paid, product, invoice_url: paid ? null : inv?.hosted_invoice_url ?? null });
        }
        const target = product as PlanKey;
        const current = planOfPrice(sub.items.data[0].price.id);
        if (!current) return json({ error: 'Votre abonnement actuel ne peut pas être modifié ici. Utilisez « Manage billing ».' }, 409);
        if (current === target) return json({ error: 'Vous avez déjà cette offre.' }, 409);
        if (PLAN_KEYS.indexOf(target) < PLAN_KEYS.indexOf(current))
          return json({ error: 'Pour passer à une offre inférieure, utilisez « Manage billing & invoices ».', code: 'downgrade' }, 409);
        if (sub.status === 'trialing') return endTrial(sub, target);
        if (sub.status !== 'active') return json({ error: 'Une facture est en attente : réglez-la dans « Manage billing & invoices », puis réessayez.' }, 409);
        const [from, to] = await Promise.all([stripe(`prices/${sub.items.data[0].price.id}`), stripe(`prices/${price}`)]);
        const diff = Number(to.unit_amount) - Number(from.unit_amount);
        const credits = Math.max(0, GRANTS[target].credits - GRANTS[current].credits);
        // reuse an unpaid upgrade invoice for the same change (retry after a declined card) instead of billing twice
        const open = await stripe(`invoices?customer=${customerId}&status=open&limit=20`);
        let inv = (open?.data ?? []).find((x: any) => x.metadata?.kind === 'plan_upgrade' && x.metadata?.subscription === sub.id && x.metadata?.to === target);
        if (!inv) {
          const draft = await stripe('invoices', {
            customer: customerId, currency: String(to.currency), collection_method: 'charge_automatically', auto_advance: 'false',
            pending_invoice_items_behavior: 'exclude',
            ...(sub.default_payment_method ? { default_payment_method: String(sub.default_payment_method) } : {}),
            description: `Storyit : passage de ${PLAN_NAMES[current]} à ${PLAN_NAMES[target]}`,
            'metadata[kind]': 'plan_upgrade', 'metadata[user_id]': user.id, 'metadata[subscription]': sub.id,
            'metadata[from]': current, 'metadata[to]': target, 'metadata[credits]': String(credits),
          });
          await stripe('invoiceitems', {
            customer: customerId, invoice: draft.id, amount: String(diff), currency: String(to.currency),
            description: `Passage de l’offre ${PLAN_NAMES[current]} à ${PLAN_NAMES[target]} (différence de prix)`,
          });
          inv = await stripe(`invoices/${draft.id}/finalize`, { auto_advance: 'false' });
        }
        if (inv.status !== 'paid') {
          try { inv = await stripe(`invoices/${inv.id}/pay`, sub.default_payment_method ? { payment_method: String(sub.default_payment_method) } : {}); }
          catch { inv = await stripe(`invoices/${inv.id}`); } // declined or needs 3-D Secure: the customer pays on the invoice page
        }
        const paid = inv.status === 'paid';
        return json({ upgraded: true, paid, product: target, invoice_url: paid ? null : inv.hosted_invoice_url ?? null });
      }
    }
    if (mode === 'subscription') {
      params['subscription_data[metadata][user_id]'] = user.id;
      params['subscription_data[metadata][product]'] = product;
    }
    if (trial) {
      // one trial per account: never used, no paid plan now, no subscription ever on this Stripe customer
      if (mode !== 'subscription') return json({ error: 'The trial is only for plans.' }, 400);
      if (product.endsWith('_year')) return json({ error: 'L’essai à 1 $ concerne uniquement les offres mensuelles.' }, 400);
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
      // the early switch must be stated before paying (migration 0034 ends the trial once the trial credits are used)
      params['custom_text[submit][message]'] = `1 $ aujourd’hui pour ${TRIAL.credits.toLocaleString('fr-FR')} crédits d’essai. Passage automatique à l’offre ${PLAN_NAMES[product as PlanKey] ?? product} (${Math.round(Number(plan.unit_amount) / 100)} $/mois) au bout de ${TRIAL.days} jours, ou plus tôt dès qu’il vous reste ${TRIAL.switchAt.toLocaleString('fr-FR')} crédits d’essai ou moins. Résiliable à tout moment avant depuis Storyit.`;
      params['subscription_data[trial_settings][end_behavior][missing_payment_method]'] = 'cancel';
    }
    const session = await stripe('checkout/sessions', params);
    return json({ url: session.url });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Billing error' }, 500);
  }
});
