/** Paddle Billing (https://developer.paddle.com) as Storyit's merchant of record, used when the secret BILLING_PROVIDER
 *  is "paddle". Secret: PADDLE_API_KEY. The products, prices, webhook (with its signing secret) and the public
 *  client-side token are found or created once by `setupPaddle` and kept in the server-only table integration_settings.
 *  Checkout: a transaction is created here, then /pay on storyit.fun opens Paddle's overlay checkout for it (Paddle.js). */
import type { ProductKey } from './stripe.ts';
import { setting, WHOP_PRICES } from './whop.ts';

const API = 'https://api.paddle.com';
export { setting };

export const paddleEnabled = () => Deno.env.get('BILLING_PROVIDER') === 'paddle' && !!Deno.env.get('PADDLE_API_KEY');

export async function paddleApi(path: string, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: { Authorization: `Bearer ${Deno.env.get('PADDLE_API_KEY')}`, 'Content-Type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let data: any = null; try { data = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok) throw new Error(`Paddle ${res.status}: ${String(data?.error?.detail ?? data?.error?.code ?? text).slice(0, 300)}`);
  return data?.data ?? data;
}

type Admin = { from: (t: string) => any };
const save = (admin: Admin, key: string, value: string) => admin.from('integration_settings').upsert({ key, value, updated_at: new Date().toISOString() });

/** one Paddle product per Storyit offer, with its prices (amounts from WHOP_PRICES, in sync with src/services/credits.ts) */
const CATALOG: { key: string; name: string; description: string; prices: ProductKey[] }[] = [
  { key: 'creator', name: 'Storyit Creator', description: 'AI short videos, AI clips and translation: 43,000 credits a month.', prices: ['creator', 'creator_year'] },
  { key: 'pro', name: 'Storyit Pro', description: 'Everything in Creator, 30 social accounts: 105,000 credits a month.', prices: ['pro', 'pro_year'] },
  { key: 'studio', name: 'Storyit Studio', description: 'Unlimited accounts and videos: 160,000 credits a month.', prices: ['studio', 'studio_year'] },
  { key: 'credits', name: 'Storyit credits', description: 'One-time credit packs for Storyit.', prices: ['pack_100', 'pack_500'] },
];

/** finds or creates the products, prices, webhook and client-side token; returns what it has */
export async function setupPaddle(admin: Admin, webhookUrl: string) {
  const out: Record<string, string> = {};
  for (const p of CATALOG) {
    let productId = await setting(admin, `paddle_product_${p.key}`);
    if (!productId) {
      productId = (await paddleApi('/products', { body: { name: p.name, description: p.description, tax_category: 'standard', custom_data: { storyit: p.key } } })).id as string;
      await save(admin, `paddle_product_${p.key}`, productId);
    }
    out[`product_${p.key}`] = productId;
    for (const k of p.prices) {
      let priceId = await setting(admin, `paddle_price_${k}`);
      if (!priceId) {
        const w = WHOP_PRICES[k];
        const cycle = w.days === 365 ? { interval: 'year', frequency: 1 } : w.days ? { interval: 'month', frequency: 1 } : null;
        priceId = (await paddleApi('/prices', { body: {
          product_id: productId, description: w.title, name: w.title.replace('Storyit ', '').replace('Storyit — ', ''),
          unit_price: { amount: String(Math.round(w.price * 100)), currency_code: 'USD' }, tax_mode: 'account_setting',
          ...(cycle ? { billing_cycle: cycle } : {}), quantity: { minimum: 1, maximum: 1 }, custom_data: { product: k },
        } })).id as string;
        await save(admin, `paddle_price_${k}`, priceId);
      }
      out[`price_${k}`] = priceId;
    }
  }

  if (!(await setting(admin, 'paddle_webhook_secret'))) {
    const hook = await paddleApi('/notification-settings', { body: {
      description: 'Storyit', destination: webhookUrl, type: 'url', api_version: 1, include_sensitive_fields: false,
      subscribed_events: ['transaction.completed', 'subscription.created', 'subscription.updated', 'subscription.canceled', 'adjustment.created', 'adjustment.updated'],
    } });
    if (!hook?.endpoint_secret_key) throw new Error('Paddle: webhook created without a signing secret');
    await save(admin, 'paddle_webhook_id', hook.id);
    await save(admin, 'paddle_webhook_secret', hook.endpoint_secret_key);
  }
  out.webhook = (await setting(admin, 'paddle_webhook_id')) ?? '';

  if (!(await setting(admin, 'paddle_client_token'))) {
    const t = await paddleApi('/client-tokens', { body: { name: 'Storyit web', description: 'Paddle.js on storyit.fun/pay' } });
    if (!t?.token) throw new Error('Paddle: client token not created');
    await save(admin, 'paddle_client_token', t.token);
  }
  out.client_token = 'saved';
  return out;
}

/** the Paddle customer for this e-mail (found, else created) */
export async function paddleCustomer(email: string): Promise<string> {
  const found = await paddleApi(`/customers?email=${encodeURIComponent(email)}`);
  if (Array.isArray(found) && found[0]?.id) return found[0].id;
  return (await paddleApi('/customers', { body: { email } })).id;
}

/** a transaction for `product`, opened by /pay; custom_data comes back on the transaction and the subscription */
export async function paddleCheckout(admin: Admin, o: { userId: string; email?: string | null; customerId?: string | null; product: ProductKey; appUrl: string; back: string }) {
  const priceId = await setting(admin, `paddle_price_${o.product}`);
  if (!priceId) throw new Error('Le paiement Paddle n’est pas encore configuré.');
  const customerId = o.customerId ?? (o.email ? await paddleCustomer(o.email) : null);
  const txn = await paddleApi('/transactions', { body: {
    items: [{ price_id: priceId, quantity: 1 }], ...(customerId ? { customer_id: customerId } : {}),
    custom_data: { user_id: o.userId, product: o.product }, checkout: { url: `${o.appUrl}/pay` },
  } });
  if (!txn?.id) throw new Error('Le paiement n’a pas pu démarrer. Réessayez.');
  return { url: `${o.appUrl}/pay?_ptxn=${txn.id}&back=${encodeURIComponent(o.back)}`, customerId };
}

/** Paddle's customer portal (cancel, card, invoices) for this customer */
export async function paddlePortal(customerId: string, subscriptionId?: string | null) {
  const s = await paddleApi(`/customers/${customerId}/portal-sessions`, { body: subscriptionId ? { subscription_ids: [subscriptionId] } : {} });
  return s?.urls?.general?.overview as string;
}

/** Paddle-Signature: "ts=<unix>;h1=<hex HMAC-SHA256 of "<ts>:<raw body>">" with the destination's secret key */
export async function verifyPaddle(secret: string, header: string, body: string, nowSeconds = Date.now() / 1000) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(';').map((kv) => kv.split('=') as [string, string]));
  const ts = Number(parts.ts);
  if (!ts || Math.abs(nowSeconds - ts) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${parts.ts}:${body}`)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const wanted = header.split(';').filter((kv) => kv.startsWith('h1=')).map((kv) => kv.slice(3));
  return wanted.some((w) => w.length === mac.length && [...w].every((c, i) => c === mac[i]));
}
