/** Stripe helpers shared by `stripe-webhook` and tests (pure, no Deno APIs). */

export type ProductKey = 'creator' | 'studio' | 'pack_100' | 'pack_500';
export const PRICE_ENV: Record<ProductKey, string> = {
  creator: 'STRIPE_PRICE_CREATOR', studio: 'STRIPE_PRICE_STUDIO', pack_100: 'STRIPE_PRICE_PACK_100', pack_500: 'STRIPE_PRICE_PACK_500',
};

/** What each product grants. Keep in sync with src/services/credits.ts (PLANS / CREDIT_PACKS). */
export const GRANTS: Record<ProductKey, { credits: number; plan?: 'creator' | 'studio'; label: string }> = {
  creator: { credits: 430, plan: 'creator', label: 'Creator plan — monthly credits' },
  studio: { credits: 1600, plan: 'studio', label: 'Studio plan — monthly credits' },
  pack_100: { credits: 100, label: 'Top-up pack — 100 credits' },
  pack_500: { credits: 500, label: 'Top-up pack — 500 credits' },
};

/** Product for a Stripe price id, using the configured price env vars (source of truth, not client metadata). */
export function productForPrice(priceId: string | null | undefined, env: (k: string) => string | undefined): ProductKey | null {
  if (!priceId) return null;
  for (const [product, key] of Object.entries(PRICE_ENV)) if (env(key) === priceId) return product as ProductKey;
  return null;
}

/** Price id of the first line of an invoice (handles older and newer Stripe API shapes). */
export function invoicePriceId(invoice: any): string | null {
  const line = invoice?.lines?.data?.[0];
  return line?.price?.id ?? line?.pricing?.price_details?.price ?? line?.plan?.id ?? null;
}

/** price id of an invoice line (older and newer Stripe API shapes) */
const linePrice = (line: any): string | null => line?.price?.id ?? line?.pricing?.price_details?.price ?? line?.plan?.id ?? null;

/** the line of an invoice that bills a plan (creator/studio), with what that line charged (0 during a trial); null when
 *  the invoice bills no plan. A trial's first invoice holds the plan line at 0 plus the one-time trial fee. */
export function planLine(invoice: any, env: (k: string) => string | undefined): { product: ProductKey; amount: number } | null {
  for (const line of invoice?.lines?.data ?? []) {
    const product = productForPrice(linePrice(line), env);
    if (product && GRANTS[product].plan) return { product, amount: Number(line.amount ?? 0) };
  }
  return null;
}

/** $1 three-day trial: price of the one-time fee (cents), length, credits given during the trial. Keep in sync with
 *  src/services/credits.ts (TRIAL). */
export const TRIAL = { feeCents: 100, days: 3, credits: 60 };

/** Plan a subscription should give right now. Unpaid/cancelled subscriptions fall back to free. */
export function planForSubscription(sub: any, env: (k: string) => string | undefined): 'free' | 'creator' | 'studio' | null {
  if (['canceled', 'unpaid', 'incomplete_expired'].includes(sub?.status)) return 'free';
  if (!['active', 'trialing', 'past_due'].includes(sub?.status)) return null; // incomplete: wait for payment
  const product = productForPrice(sub?.items?.data?.[0]?.price?.id, env);
  return product && GRANTS[product].plan ? GRANTS[product].plan! : null;
}

/** Verifies the `Stripe-Signature` header (HMAC-SHA256, 5-minute tolerance), constant-time compare. */
export async function verifySignature(payload: string, header: string | null, secret: string, nowSeconds = Date.now() / 1000): Promise<boolean> {
  if (!header) return false;
  const timestamp = header.split(',').find((p) => p.startsWith('t='))?.slice(2);
  const signatures = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return signatures.some((sig) => {
    if (sig.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}
