// Supabase Edge Function `whop-webhook` (deploy with --no-verify-jwt): Whop's signed notifications (Standard Webhooks).
// - membership.activated with metadata trial=1: the free 3-day trial (card on file, $0 today): trial credits + plan
// - payment.succeeded: a plan payment (its credits, reset), a credit pack (added); a $0 trial start is not paid twice
// - membership.updated / deactivated: a cancelled or expired plan goes back to free; keeps the "manage" link
// The customer is recognised by the metadata put on the checkout (user_id, product), or by the membership id for
// renewals. Each delivery is processed once (whop_events). The signing secret is in integration_settings.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GRANTS, TRIAL, type ProductKey } from '../_shared/stripe.ts';
import { setting, verifyWhop } from '../_shared/whop.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const ok = (b: unknown = { ok: true }) => new Response(JSON.stringify(b), { headers: { 'Content-Type': 'application/json' } });
const isProduct = (p: unknown): p is ProductKey => typeof p === 'string' && p in GRANTS;

async function profileOf(meta: any, membershipId: string | null) {
  if (meta?.user_id) {
    const { data } = await admin.from('profiles').select('id, plan, whop_product, whop_membership_id, trial_used').eq('id', meta.user_id).maybeSingle();
    if (data) return data;
  }
  if (membershipId) {
    const { data } = await admin.from('profiles').select('id, plan, whop_product, whop_membership_id, trial_used').eq('whop_membership_id', membershipId).maybeSingle();
    if (data) return data;
  }
  return null;
}

/** the free trial starts: trial credits and the plan now, the plan's full credits with the first real payment */
async function startTrial(userId: string, product: ProductKey, membershipId: string | null) {
  const g = GRANTS[product];
  // claim the trial once (payment.succeeded and membership.activated can arrive together)
  const { data: claimed } = await admin.from('profiles').update({ trial_used: true }).eq('id', userId).eq('trial_used', false).select('id');
  if (!claimed?.length) return;
  await admin.from('profiles').update({ billing_provider: 'whop', whop_product: product, ...(membershipId ? { whop_membership_id: membershipId } : {}) }).eq('id', userId);
  const { error } = await admin.rpc('grant_credits', { p_user_id: userId, p_amount: TRIAL.credits, p_type: 'subscription_grant',
    p_description: `Essai gratuit ${TRIAL.days} jours — crédits`, p_plan: g.plan, p_reset: true });
  if (error) throw new Error(error.message);
  await admin.from('profiles').update({ trial_ends_at: new Date(Date.now() + TRIAL.days * 86_400_000).toISOString() }).eq('id', userId);
  await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/mailing`, { method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('PUBLISHER_CRON_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trial_welcome: userId }) }).catch((e) => console.error('trial welcome', e));
  console.log(JSON.stringify({ audit: 'whop_trial_start', user: userId, product }));
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const body = await req.text();
  const id = req.headers.get('webhook-id') ?? '';
  const secret = Deno.env.get('WHOP_WEBHOOK_SECRET') ?? (await setting(admin, 'whop_webhook_secret')) ?? '';
  if (!(await verifyWhop(secret, id, req.headers.get('webhook-timestamp') ?? '', body, req.headers.get('webhook-signature') ?? ''))) {
    return new Response('Invalid signature', { status: 401 });
  }
  const event = JSON.parse(body) as { type: string; data: any };
  // once per delivery
  const { error: dup } = await admin.from('whop_events').insert({ id, type: event.type });
  if (dup) return ok({ duplicate: true });

  try {
    const d = event.data ?? {};
    if (event.type === 'payment.succeeded') {
      const meta = d.metadata ?? {};
      const p = await profileOf(meta, d.membership_id ?? null);
      if (!p) { console.error('whop: payment for an unknown customer', d.id); return ok({ skipped: 'unknown customer' }); }
      const product: ProductKey | null = isProduct(meta.product) ? meta.product : isProduct(p.whop_product) ? p.whop_product : null;
      if (!product) { console.error('whop: payment without a product', d.id); return ok({ skipped: 'no product' }); }
      const g = GRANTS[product];
      const amount = Number(d.total?.amount ?? d.usd_total?.amount ?? 0);
      if (g.plan) {
        await admin.from('profiles').update({ billing_provider: 'whop', whop_product: product, ...(d.membership_id ? { whop_membership_id: d.membership_id } : {}) }).eq('id', p.id);
        const firstOfTrial = meta.trial === '1' && d.billing_reason === 'subscription_create';
        if (firstOfTrial) {
          // the trial start ($0): credits are given once, here or on membership.activated, whichever comes first
          if (!p.trial_used) await startTrial(p.id, product, d.membership_id ?? null);
          return ok({ trial: true });
        } else if (amount <= 0) {
          console.log(JSON.stringify({ audit: 'whop_zero_payment', user: p.id, product, reason: d.billing_reason }));
          return ok({ skipped: 'zero amount' });
        } else {
          const { error } = await admin.rpc('grant_credits', { p_user_id: p.id, p_amount: g.credits, p_type: 'subscription_grant', p_description: `${g.label} (Whop)`, p_plan: g.plan, p_reset: true });
          if (error) throw new Error(error.message);
          await admin.from('profiles').update({ trial_ends_at: null }).eq('id', p.id);
        }
        // partner commission, as with Stripe (the $1 only for a trial)
        const { error: affErr } = await admin.rpc('record_affiliate_payment', { p_user: p.id, p_invoice: d.id, p_amount: Math.round(amount * 100), p_currency: d.currency ?? 'usd', p_product: product, p_trial: false });
        if (affErr) console.error('affiliate', affErr.message);
      } else {
        const { error } = await admin.rpc('grant_credits', { p_user_id: p.id, p_amount: g.credits, p_type: 'purchase', p_description: `${g.label} (Whop)` });
        if (error) throw new Error(error.message);
      }
      console.log(JSON.stringify({ audit: 'whop_payment', user: p.id, product, amount, reason: d.billing_reason }));
    } else if (event.type.startsWith('membership.')) {
      const p = await profileOf(d.metadata ?? {}, d.id ?? null);
      if (!p) return ok({ skipped: 'unknown customer' });
      // only the membership the profile is billed through
      if (p.whop_membership_id && d.id && p.whop_membership_id !== d.id) return ok({ skipped: 'other membership' });
      // the free trial starts when the membership becomes active (no payment at $0)
      const meta = d.metadata ?? {};
      if (event.type === 'membership.activated' && meta.trial === '1' && !p.trial_used && isProduct(meta.product) && GRANTS[meta.product].plan) {
        await startTrial(p.id, meta.product, d.id ?? null);
      }
      const patch: Record<string, unknown> = { whop_membership_id: d.id ?? p.whop_membership_id, ...(d.manage_url ? { whop_manage_url: d.manage_url } : {}) };
      if (event.type === 'membership.deactivated' || ['canceled', 'expired', 'completed'].includes(d.status)) { patch.plan = 'free'; patch.trial_ends_at = null; }
      await admin.from('profiles').update(patch).eq('id', p.id);
      console.log(JSON.stringify({ audit: 'whop_membership', user: p.id, status: d.status, type: event.type }));
    }
    return ok();
  } catch (e) {
    console.error('whop-webhook', e instanceof Error ? e.message : e);
    // forget the delivery so Whop's retry is processed
    await admin.from('whop_events').delete().eq('id', id);
    return new Response('Handler error', { status: 500 });
  }
});
