// Supabase Edge Function `paddle-webhook` (deploy with --no-verify-jwt): Paddle's signed notifications.
// - transaction.completed: a plan payment (first or renewal: its credits, reset) or a credit pack (added)
// - subscription.updated / canceled: a cancelled or paused plan goes back to free
// - adjustment.*: refunds are logged for the operator (credits are taken back by hand)
// The customer is recognised by custom_data put on the transaction (user_id, product), or by the subscription id for
// renewals. Each notification is processed once (paddle_events). The signing secret is in integration_settings.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GRANTS, type ProductKey } from '../_shared/stripe.ts';
import { setting, verifyPaddle } from '../_shared/paddle.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const ok = (b: unknown = { ok: true }) => new Response(JSON.stringify(b), { headers: { 'Content-Type': 'application/json' } });
const isProduct = (p: unknown): p is ProductKey => typeof p === 'string' && p in GRANTS;
const COLS = 'id, plan, paddle_product, paddle_subscription_id';

async function profileOf(custom: any, subscriptionId: string | null) {
  if (custom?.user_id) {
    const { data } = await admin.from('profiles').select(COLS).eq('id', custom.user_id).maybeSingle();
    if (data) return data;
  }
  if (subscriptionId) {
    const { data } = await admin.from('profiles').select(COLS).eq('paddle_subscription_id', subscriptionId).maybeSingle();
    if (data) return data;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const body = await req.text();
  const secret = Deno.env.get('PADDLE_WEBHOOK_SECRET') ?? (await setting(admin, 'paddle_webhook_secret')) ?? '';
  if (!(await verifyPaddle(secret, req.headers.get('paddle-signature') ?? '', body))) return new Response('Invalid signature', { status: 401 });
  const event = JSON.parse(body) as { event_id: string; event_type: string; data: any };
  const { error: dup } = await admin.from('paddle_events').insert({ id: event.event_id, type: event.event_type });
  if (dup) return ok({ duplicate: true });

  try {
    const d = event.data ?? {};
    if (event.event_type === 'transaction.completed') {
      const custom = d.custom_data ?? {};
      const p = await profileOf(custom, d.subscription_id ?? null);
      if (!p) { console.error('paddle: payment for an unknown customer', d.id); return ok({ skipped: 'unknown customer' }); }
      const fromPrice = d.items?.[0]?.price?.custom_data?.product;
      const product: ProductKey | null = isProduct(custom.product) ? custom.product : isProduct(fromPrice) ? fromPrice : isProduct(p.paddle_product) ? p.paddle_product : null;
      if (!product) { console.error('paddle: payment without a product', d.id); return ok({ skipped: 'no product' }); }
      const g = GRANTS[product];
      const cents = Number(d.details?.totals?.grand_total ?? 0);
      await admin.from('profiles').update({ billing_provider: 'paddle', ...(d.customer_id ? { paddle_customer_id: d.customer_id } : {}) }).eq('id', p.id);
      if (g.plan) {
        await admin.from('profiles').update({ paddle_product: product, ...(d.subscription_id ? { paddle_subscription_id: d.subscription_id } : {}), trial_ends_at: null }).eq('id', p.id);
        const { error } = await admin.rpc('grant_credits', { p_user_id: p.id, p_amount: g.credits, p_type: 'subscription_grant', p_description: `${g.label} (Paddle)`, p_plan: g.plan, p_reset: true });
        if (error) throw new Error(error.message);
        const { error: affErr } = await admin.rpc('record_affiliate_payment', { p_user: p.id, p_invoice: d.id, p_amount: cents, p_currency: String(d.currency_code ?? 'usd').toLowerCase(), p_product: product, p_trial: false });
        if (affErr) console.error('affiliate', affErr.message);
      } else {
        const { error } = await admin.rpc('grant_credits', { p_user_id: p.id, p_amount: g.credits, p_type: 'purchase', p_description: `${g.label} (Paddle)` });
        if (error) throw new Error(error.message);
      }
      console.log(JSON.stringify({ audit: 'paddle_payment', user: p.id, product, cents, origin: d.origin }));
    } else if (event.event_type.startsWith('subscription.')) {
      const p = await profileOf(d.custom_data ?? {}, d.id ?? null);
      if (!p) return ok({ skipped: 'unknown customer' });
      if (p.paddle_subscription_id && d.id && p.paddle_subscription_id !== d.id) return ok({ skipped: 'other subscription' });
      const patch: Record<string, unknown> = { paddle_subscription_id: d.id ?? p.paddle_subscription_id };
      if (event.event_type === 'subscription.canceled' || ['canceled', 'paused'].includes(d.status)) patch.plan = 'free';
      await admin.from('profiles').update(patch).eq('id', p.id);
      console.log(JSON.stringify({ audit: 'paddle_subscription', user: p.id, status: d.status, type: event.event_type }));
    } else if (event.event_type.startsWith('adjustment.')) {
      console.log(JSON.stringify({ audit: 'paddle_adjustment', action: d.action, status: d.status, transaction: d.transaction_id, total: d.totals?.total }));
    }
    return ok();
  } catch (e) {
    console.error('paddle-webhook', e instanceof Error ? e.message : e);
    await admin.from('paddle_events').delete().eq('id', event.event_id);
    return new Response('Handler error', { status: 500 });
  }
});
