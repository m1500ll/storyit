// Supabase Edge Function `dodo-webhook` (deploy with --no-verify-jwt): Dodo Payments' signed notifications (Standard Webhooks).
// - payment.succeeded: a plan payment (first or renewal: its credits, reset) or a credit pack (added)
// - subscription.cancelled / expired / failed: the plan goes back to free
// - refund / dispute: logged for the operator (credits are taken back by hand)
// The customer is recognised by the metadata put on the checkout (user_id, product), or by the subscription id for
// renewals. Each delivery is processed once (dodo_events). The signing secret is in integration_settings.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GRANTS, type ProductKey } from '../_shared/stripe.ts';
import { setting, verifyDodo } from '../_shared/dodo.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const ok = (b: unknown = { ok: true }) => new Response(JSON.stringify(b), { headers: { 'Content-Type': 'application/json' } });
const isProduct = (p: unknown): p is ProductKey => typeof p === 'string' && p in GRANTS;
const COLS = 'id, plan, dodo_product, dodo_subscription_id';

async function profileOf(meta: any, subscriptionId: string | null) {
  if (meta?.user_id) {
    const { data } = await admin.from('profiles').select(COLS).eq('id', meta.user_id).maybeSingle();
    if (data) return data;
  }
  if (subscriptionId) {
    const { data } = await admin.from('profiles').select(COLS).eq('dodo_subscription_id', subscriptionId).maybeSingle();
    if (data) return data;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const body = await req.text();
  const id = req.headers.get('webhook-id') ?? '';
  const secret = Deno.env.get('DODO_WEBHOOK_SECRET') ?? (await setting(admin, 'dodo_webhook_secret')) ?? '';
  if (!(await verifyDodo(secret, id, req.headers.get('webhook-timestamp') ?? '', body, req.headers.get('webhook-signature') ?? ''))) {
    return new Response('Invalid signature', { status: 401 });
  }
  const event = JSON.parse(body) as { type: string; data: any };
  const { error: dup } = await admin.from('dodo_events').insert({ id, type: event.type });
  if (dup) return ok({ duplicate: true });

  try {
    const d = event.data ?? {};
    if (event.type === 'payment.succeeded') {
      const meta = d.metadata ?? {};
      const p = await profileOf(meta, d.subscription_id ?? null);
      if (!p) { console.error('dodo: payment for an unknown customer', d.payment_id); return ok({ skipped: 'unknown customer' }); }
      const product: ProductKey | null = isProduct(meta.product) ? meta.product : isProduct(p.dodo_product) ? p.dodo_product : null;
      if (!product) { console.error('dodo: payment without a product', d.payment_id); return ok({ skipped: 'no product' }); }
      const g = GRANTS[product];
      const cents = Number(d.total_amount ?? 0);
      await admin.from('profiles').update({ billing_provider: 'dodo', ...(d.customer?.customer_id ? { dodo_customer_id: d.customer.customer_id } : {}) }).eq('id', p.id);
      if (g.plan) {
        await admin.from('profiles').update({ dodo_product: product, ...(d.subscription_id ? { dodo_subscription_id: d.subscription_id } : {}), trial_ends_at: null }).eq('id', p.id);
        const { error } = await admin.rpc('grant_credits', { p_user_id: p.id, p_amount: g.credits, p_type: 'subscription_grant', p_description: `${g.label} (Dodo)`, p_plan: g.plan, p_reset: true });
        if (error) throw new Error(error.message);
        const { error: affErr } = await admin.rpc('record_affiliate_payment', { p_user: p.id, p_invoice: d.payment_id, p_amount: cents, p_currency: String(d.currency ?? 'usd').toLowerCase(), p_product: product, p_trial: false });
        if (affErr) console.error('affiliate', affErr.message);
      } else {
        const { error } = await admin.rpc('grant_credits', { p_user_id: p.id, p_amount: g.credits, p_type: 'purchase', p_description: `${g.label} (Dodo)` });
        if (error) throw new Error(error.message);
      }
      console.log(JSON.stringify({ audit: 'dodo_payment', user: p.id, product, cents }));
    } else if (event.type.startsWith('subscription.')) {
      const p = await profileOf(d.metadata ?? {}, d.subscription_id ?? null);
      if (!p) return ok({ skipped: 'unknown customer' });
      if (p.dodo_subscription_id && d.subscription_id && p.dodo_subscription_id !== d.subscription_id) return ok({ skipped: 'other subscription' });
      const patch: Record<string, unknown> = { dodo_subscription_id: d.subscription_id ?? p.dodo_subscription_id, ...(d.customer?.customer_id ? { dodo_customer_id: d.customer.customer_id } : {}) };
      if (['subscription.cancelled', 'subscription.expired', 'subscription.failed'].includes(event.type) || ['cancelled', 'expired', 'failed'].includes(d.status)) patch.plan = 'free';
      await admin.from('profiles').update(patch).eq('id', p.id);
      console.log(JSON.stringify({ audit: 'dodo_subscription', user: p.id, status: d.status, type: event.type }));
    } else {
      console.log(JSON.stringify({ audit: 'dodo_other', type: event.type, payment: d.payment_id, amount: d.amount ?? d.total_amount }));
    }
    return ok();
  } catch (e) {
    console.error('dodo-webhook', e instanceof Error ? e.message : e);
    await admin.from('dodo_events').delete().eq('id', id);
    return new Response('Handler error', { status: 500 });
  }
});
