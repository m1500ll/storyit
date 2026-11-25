/** Whop (https://docs.whop.com, Current API v1) as Storyit's second payment provider, used when the secret
 *  BILLING_PROVIDER is "whop". Secrets: WHOP_API_KEY (account API key, from whop.com/dashboard/developer).
 *  The Whop account, the "Storyit" product and the webhook (with its signing secret) are found or created once by
 *  `setupWhop` and kept in the server-only table integration_settings. */
import type { ProductKey } from './stripe.ts';

const API = 'https://api.whop.com/api/v1';
const VERSION = '2026-11-17';

/** what each Storyit product costs on Whop (keep in sync with src/services/credits.ts: PLANS, CREDIT_PACKS) */
export const WHOP_PRICES: Record<ProductKey, { title: string; price: number; days?: number }> = {
  starter: { title: 'Storyit Starter', price: 9, days: 30 },
  creator: { title: 'Storyit Creator', price: 29, days: 30 },
  pro: { title: 'Storyit Pro', price: 59, days: 30 },
  studio: { title: 'Storyit Studio', price: 99, days: 30 },
  creator_year: { title: 'Storyit Creator (annuel)', price: 279, days: 365 },
  pro_year: { title: 'Storyit Pro (annuel)', price: 569, days: 365 },
  studio_year: { title: 'Storyit Studio (annuel)', price: 949, days: 365 },
  pack_100: { title: 'Storyit — 10 000 crédits', price: 12 },
  pack_500: { title: 'Storyit — 50 000 crédits', price: 49 },
};

export const whopEnabled = () => Deno.env.get('BILLING_PROVIDER') === 'whop' && !!Deno.env.get('WHOP_API_KEY');

export async function whopApi(path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}) {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: {
      Authorization: `Bearer ${Deno.env.get('WHOP_API_KEY')}`, 'Api-Version-Date': VERSION,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let data: any = null; try { data = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok) throw new Error(`Whop ${res.status}: ${String(data?.error?.message ?? data?.message ?? text).slice(0, 300)}`);
  return data;
}

type Admin = { from: (t: string) => any };
export async function setting(admin: Admin, key: string): Promise<string | null> {
  const { data } = await admin.from('integration_settings').select('value').eq('key', key).maybeSingle();
  return (data?.value as string | undefined) ?? null;
}
const save = (admin: Admin, key: string, value: string) => admin.from('integration_settings').upsert({ key, value, updated_at: new Date().toISOString() });

/** finds or creates the Whop account id, the "Storyit" product and the webhook; returns what it found */
export async function setupWhop(admin: Admin, webhookUrl: string) {
  const me = await whopApi('/accounts/me');
  const accountId: string = me?.id ?? me?.data?.id;
  if (!accountId) throw new Error('Whop: account not found for this API key');
  await save(admin, 'whop_account_id', accountId);

  let productId = await setting(admin, 'whop_product_id');
  if (!productId) {
    const list = await whopApi(`/products?account_id=${accountId}&query=Storyit&first=20`);
    productId = (list?.data ?? []).find((p: any) => /storyit/i.test(p.title ?? ''))?.id ?? null;
    if (!productId) productId = (await whopApi('/products', { body: { account_id: accountId, title: 'Storyit', headline: 'Vidéos IA et clips TikTok, créés pour toi', visibility: 'hidden', redirect_purchase_url: 'https://www.storyit.fun/app' }, idempotencyKey: `storyit-product-${accountId}` }))?.id;
    if (!productId) throw new Error('Whop: product not created');
    await save(admin, 'whop_product_id', productId);
  }

  let webhookId = await setting(admin, 'whop_webhook_id');
  if (!webhookId || !(await setting(admin, 'whop_webhook_secret'))) {
    const hook = await whopApi('/webhooks', { body: {
      url: webhookUrl, title: 'Storyit', resource_id: accountId, api_version_date: VERSION,
      events: ['payment.succeeded', 'payment.failed', 'membership.activated', 'membership.updated', 'membership.deactivated', 'membership.cancel_at_period_end_changed'],
    } });
    webhookId = hook?.id;
    if (!hook?.webhook_secret) throw new Error('Whop: webhook created without a signing secret');
    await save(admin, 'whop_webhook_id', webhookId!);
    await save(admin, 'whop_webhook_secret', hook.webhook_secret);
  }
  return { accountId, productId, webhookId };
}

/** a Whop checkout page for `product` (inline variant on the Storyit product); the metadata comes back on the payment
 *  and the membership, so the webhook knows who paid for what */
export async function whopCheckout(admin: Admin, o: { userId: string; email?: string | null; product: ProductKey; trial: boolean; redirect: string; trialDays: number; trialFee: number }) {
  const accountId = await setting(admin, 'whop_account_id');
  const productId = await setting(admin, 'whop_product_id');
  if (!accountId || !productId) throw new Error('Le paiement Whop n’est pas encore configuré.');
  const p = WHOP_PRICES[o.product];
  const recurring = !!p.days;
  const trial = o.trial && recurring && o.product === 'creator';
  const variant: Record<string, unknown> = {
    account_id: accountId, product_id: productId, currency: 'usd', title: (trial ? `${p.title.replace('Storyit ', '')} · essai ${o.trialDays} jours` : p.title).slice(0, 30),
    visibility: 'hidden', unlimited_stock: true,
    ...(recurring
      ? { billing_type: 'renewal', billing_period: p.days, renewal_price: p.price,
          // $1 trial: Whop charges `initial_price` at checkout, then the renewal price once the trial days are over
          initial_price: trial ? o.trialFee : 0, ...(trial ? { trial_period_days: o.trialDays } : {}),
          // free trial: the bank must confirm the card (3-D Secure), so made-up card numbers can't open trials
          ...(trial ? { three_ds_level: 'mandate_challenge' } : {}) }
      : { billing_type: 'one_time', initial_price: p.price }),
  };
  const cfg = await whopApi('/checkout_configurations', { body: {
    account_id: accountId, variant, redirect_url: o.redirect,
    metadata: { user_id: o.userId, product: o.product, trial: trial ? '1' : '0' },
  } });
  const url = cfg?.purchase_url;
  if (!url) throw new Error('Le paiement n’a pas pu démarrer. Réessayez.');
  return url as string;
}

/** Standard Webhooks signature check (Whop: HMAC-SHA256 of "{id}.{timestamp}.{body}", header "v1,<base64>").
 *  Whop's helpers "derive the key" from the ws_ secret; the raw secret, the part after ws_ and its hex bytes are tried. */
export async function verifyWhop(secret: string, id: string, timestamp: string, body: string, header: string) {
  if (!secret || !id || !timestamp || !header) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const signed = new TextEncoder().encode(`${id}.${timestamp}.${body}`);
  const bare = secret.replace(/^ws_/, '').replace(/^whsec_/, '');
  const keys: Uint8Array[] = [new TextEncoder().encode(secret), new TextEncoder().encode(bare)];
  if (/^[0-9a-f]+$/i.test(bare) && bare.length % 2 === 0) keys.push(Uint8Array.from(bare.match(/../g)!.map((h) => parseInt(h, 16))));
  try { keys.push(Uint8Array.from(atob(bare), (c) => c.charCodeAt(0))); } catch { /* not base64 */ }
  const wanted = header.split(' ').map((s) => s.split(',')[1]).filter(Boolean);
  for (const k of keys) {
    const key = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, signed))));
    for (const w of wanted) if (w.length === mac.length && [...w].every((c, i) => c === mac[i])) return true;
  }
  return false;
}
