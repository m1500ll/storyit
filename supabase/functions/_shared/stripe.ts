/** Stripe helpers shared by `stripe-webhook` and tests (pure, no Deno APIs). */

export type ProductKey = 'creator' | 'pro' | 'studio' | 'creator_year' | 'pro_year' | 'studio_year' | 'pack_100' | 'pack_500';
export const PRICE_ENV: Record<ProductKey, string> = {
  creator: 'STRIPE_PRICE_CREATOR', pro: 'STRIPE_PRICE_PRO', studio: 'STRIPE_PRICE_STUDIO',
  creator_year: 'STRIPE_PRICE_CREATOR_YEAR', pro_year: 'STRIPE_PRICE_PRO_YEAR', studio_year: 'STRIPE_PRICE_STUDIO_YEAR',
  pack_100: 'STRIPE_PRICE_PACK_100', pack_500: 'STRIPE_PRICE_PACK_500',
};

/** What each product grants. Keep in sync with src/services/credits.ts (PLANS / CREDIT_PACKS). */
export const GRANTS: Record<ProductKey, { credits: number; plan?: 'creator' | 'pro' | 'studio'; label: string }> = {
  creator: { credits: 43000, plan: 'creator', label: 'Creator plan — monthly credits' },
  pro: { credits: 105000, plan: 'pro', label: 'Pro plan — monthly credits' },
  studio: { credits: 160000, plan: 'studio', label: 'Studio plan — monthly credits' },
  // yearly plans (−20 %): the 12 months of credits at once, on each yearly invoice
  creator_year: { credits: 43000 * 12, plan: 'creator', label: 'Creator plan (yearly) — 12 months of credits' },
  pro_year: { credits: 105000 * 12, plan: 'pro', label: 'Pro plan (yearly) — 12 months of credits' },
  studio_year: { credits: 160000 * 12, plan: 'studio', label: 'Studio plan (yearly) — 12 months of credits' },
  pack_100: { credits: 10000, label: 'Top-up pack — 10,000 credits' },
  pack_500: { credits: 50000, label: 'Top-up pack — 50,000 credits' },
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

/** the line of an invoice that bills a plan (creator/pro/studio), with what that line charged (0 during a trial); null when
 *  the invoice bills no plan. A trial's first invoice holds the plan line at 0 plus the one-time trial fee. */
export function planLine(invoice: any, env: (k: string) => string | undefined): { product: ProductKey; amount: number } | null {
  // a plan change billed with proration (e.g. monthly → yearly) holds a negative line for the unused old plan and a
  // positive line for the new one: the plan bought is the line with the highest amount
  let best: { product: ProductKey; amount: number } | null = null;
  for (const line of invoice?.lines?.data ?? []) {
    const product = productForPrice(linePrice(line), env);
    if (!product || !GRANTS[product].plan) continue;
    const amount = Number(line.amount ?? 0);
    if (!best || amount > best.amount) best = { product, amount };
  }
  return best;
}

/** $1 three-day trial: price of the one-time fee (cents), length, credits given during the trial. Keep in sync with
 *  src/services/credits.ts (TRIAL). */
export const TRIAL = { feeCents: 100, days: 3, credits: 5000, switchAt: 1000 };

/** Plan a subscription should give right now. Unpaid/cancelled subscriptions fall back to free. */
export function planForSubscription(sub: any, env: (k: string) => string | undefined): 'free' | 'creator' | 'pro' | 'studio' | null {
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

/** automatic top-up: any amount from 5 000 to 200 000 credits (steps of 1 000), at the packs' rate:
 *  $1.20 per 1 000 credits, $0.98 per 1 000 from 50 000 credits. Mirrored in src/services/credits.ts. */
export const TOPUP = { min: 5000, max: 200000, step: 1000, thresholds: [1000, 3000, 5000, 10000] } as const;
export const topupPriceCents = (credits: number) => Math.round(credits / 1000 * (credits >= 50000 ? 98 : 120));
export const isTopupAmount = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= TOPUP.min && (n as number) <= TOPUP.max && (n as number) % TOPUP.step === 0;
