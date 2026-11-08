import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { ProductKey } from './credits';

async function call(body: Record<string, unknown>): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Payments need Supabase to be configured.');
  const { data, error } = await supabase!.functions.invoke<{ url: string }>('billing', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => ({}))) as { error?: string }).error : undefined;
    throw new Error(msg ?? error.message);
  }
  if (!data?.url) throw new Error('No checkout URL returned');
  return data.url;
}

/** Stripe-hosted pages: card data never touches our app. */
export const billingService = {
  /** trial: the $1 three-day trial of a plan (one per account), then the plan at full price */
  async checkout(product: ProductKey, opts: { trial?: boolean } = {}) {
    window.location.assign(await call({ action: 'checkout', product, trial: opts.trial === true }));
  },
  async openPortal() {
    window.location.assign(await call({ action: 'portal' }));
  },
};
