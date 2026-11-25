/** Dodo Payments (https://docs.dodopayments.com, merchant of record) as a Storyit payment provider, used when the
 *  secret BILLING_PROVIDER is "dodo". Secret: DODO_API_KEY (live key). The products, the webhook and its signing secret
 *  are found or created once by `setupDodo` and kept in the server-only table integration_settings.
 *  Checkout: a hosted Dodo checkout session; its metadata (user_id, product) comes back on the payment. */
import type { ProductKey } from './stripe.ts';
import { setting, verifyWhop, WHOP_PRICES } from './whop.ts';

const API = 'https://live.dodopayments.com';
export { setting };

export const dodoEnabled = () => Deno.env.get('BILLING_PROVIDER') === 'dodo' && !!Deno.env.get('DODO_API_KEY');

export async function dodoApi(path: string, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: { Authorization: `Bearer ${Deno.env.get('DODO_API_KEY')}`, 'Content-Type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let data: any = null; try { data = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok) throw new Error(`Dodo ${res.status}: ${String(data?.message ?? data?.error ?? text).slice(0, 300)}`);
  return data;
}

type Admin = { from: (t: string) => any };
const save = (admin: Admin, key: string, value: string) => admin.from('integration_settings').upsert({ key, value, updated_at: new Date().toISOString() });

const DESCRIPTIONS: Partial<Record<ProductKey, string>> = {
  starter: 'AI short videos: 12,000 credits every month.',
  creator: 'AI short videos, AI clips and translation: 50,000 credits every month.',
  pro: 'Everything in Creator, 30 social accounts: 90,000 credits every month.',
  studio: 'Unlimited accounts and videos: 175,000 credits every month.',
  creator_year: 'Creator, billed yearly: 12 months of credits at once (600,000).',
  pro_year: 'Pro, billed yearly: 12 months of credits at once (1,080,000).',
  studio_year: 'Studio, billed yearly: 12 months of credits at once (2,100,000).',
  pack_100: 'One-time pack of 10,000 Storyit credits.',
  pack_500: 'One-time pack of 50,000 Storyit credits.',
};

/** finds or creates one Dodo product per Storyit product (prices from WHOP_PRICES, in sync with src/services/credits.ts)
 *  and the webhook; returns what it has */
export async function setupDodo(admin: Admin, webhookUrl: string) {
  const out: Record<string, string> = {};
  for (const k of Object.keys(WHOP_PRICES) as ProductKey[]) {
    let id = await setting(admin, `dodo_product_${k}`);
    if (!id) {
      const w = WHOP_PRICES[k];
      const cents = Math.round(w.price * 100);
      const price = w.days
        ? { type: 'recurring_price', currency: 'USD', price: cents, discount: 0, purchasing_power_parity: false,
            payment_frequency_count: 1, payment_frequency_interval: w.days === 365 ? 'Year' : 'Month',
            subscription_period_count: 20, subscription_period_interval: 'Year', tax_inclusive: false }
        : { type: 'one_time_price', currency: 'USD', price: cents, discount: 0, purchasing_power_parity: false, tax_inclusive: false };
      id = (await dodoApi('/products', { body: { name: w.title, description: DESCRIPTIONS[k], tax_category: 'saas', price, metadata: { product: k } } }))?.product_id as string;
      if (!id) throw new Error(`Dodo: product ${k} not created`);
      await save(admin, `dodo_product_${k}`, id);
    }
    out[k] = id;
  }
  if (!(await setting(admin, 'dodo_webhook_secret'))) {
    const hook = await dodoApi('/webhooks', { body: {
      url: webhookUrl, description: 'Storyit',
      filter_types: ['payment.succeeded', 'payment.failed', 'subscription.active', 'subscription.renewed', 'subscription.cancelled', 'subscription.expired',
        'subscription.failed', 'subscription.on_hold', 'subscription.plan_changed', 'refund.succeeded', 'dispute.opened'],
    } });
    if (!hook?.id) throw new Error('Dodo: webhook not created');
    const secret = (await dodoApi(`/webhooks/${hook.id}/secret`))?.secret;
    if (!secret) throw new Error('Dodo: webhook secret not found');
    await save(admin, 'dodo_webhook_id', hook.id);
    await save(admin, 'dodo_webhook_secret', secret);
  }
  out.webhook = (await setting(admin, 'dodo_webhook_id')) ?? '';
  return out;
}

/** a hosted Dodo checkout for `product`; the metadata comes back on the payment and the subscription */
export async function dodoCheckout(admin: Admin, o: { userId: string; email?: string | null; customerId?: string | null; product: ProductKey; returnUrl: string }) {
  const productId = await setting(admin, `dodo_product_${o.product}`);
  if (!productId) throw new Error('Le paiement Dodo n’est pas encore configuré.');
  const s = await dodoApi('/checkouts', { body: {
    product_cart: [{ product_id: productId, quantity: 1 }],
    ...(o.customerId ? { customer: { customer_id: o.customerId } } : o.email ? { customer: { email: o.email } } : {}),
    metadata: { user_id: o.userId, product: o.product }, return_url: o.returnUrl,
  } });
  if (!s?.checkout_url) throw new Error('Le paiement n’a pas pu démarrer. Réessayez.');
  return s.checkout_url as string;
}

/** Dodo's customer portal (cancel, card, invoices) */
export async function dodoPortal(customerId: string) {
  return (await dodoApi(`/customers/${customerId}/customer-portal/session`, { body: {} }))?.link as string;
}

/** Standard Webhooks (same scheme as Whop): HMAC-SHA256 of "{id}.{timestamp}.{body}", whsec_ secret base64-decoded */
export const verifyDodo = verifyWhop;
