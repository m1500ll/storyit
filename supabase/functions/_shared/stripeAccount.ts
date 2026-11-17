/** Two Stripe accounts while customers move to the company account: 'legacy' (STRIPE_SECRET_KEY, STRIPE_PRICE_*,
 *  STRIPE_WEBHOOK_SECRET) and 'new' (the same names + _NEW). Existing customers stay on the account that holds their
 *  card and subscription; customers created from now on go to 'new' once it is configured. */
export type StripeAccount = 'legacy' | 'new';

const NEW_SUFFIXED = /^STRIPE_(SECRET_KEY|WEBHOOK_SECRET|PRICE_[A-Z0-9_]+)$/;

/** env reader for one account: on 'new', STRIPE_* settings are read with the _NEW suffix */
export const accountEnv = (acct: StripeAccount) => (k: string) => Deno.env.get(acct === 'new' && NEW_SUFFIXED.test(k) ? `${k}_NEW` : k);

/** the account new customers are created on */
export const newCustomersAccount = (): StripeAccount =>
  Deno.env.get('STRIPE_SECRET_KEY_NEW') && Deno.env.get('STRIPE_PRICE_CREATOR_NEW') && Deno.env.get('STRIPE_NEW_ACCOUNT_LIVE') !== 'off' ? 'new' : 'legacy';

/** the account holding this profile's Stripe customer */
export const accountOf = (p: { stripe_customer_id?: string | null; stripe_account?: string | null } | null | undefined): StripeAccount =>
  p?.stripe_customer_id ? (p.stripe_account === 'new' ? 'new' : 'legacy') : newCustomersAccount();

/** Stripe REST call on one account */
export async function stripeOn(acct: StripeAccount, path: string, params?: Record<string, string>, idempotencyKey?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${accountEnv(acct)('STRIPE_SECRET_KEY')}` };
  if (params) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { method: params ? 'POST' : 'GET', headers, body: params ? new URLSearchParams(params) : undefined, signal: AbortSignal.timeout(15_000) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Stripe error ${res.status}`);
  return data;
}
