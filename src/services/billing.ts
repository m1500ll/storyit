import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { ProductKey } from './credits';

async function call(body: Record<string, unknown>): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Le paiement a besoin du serveur Storyit (mode démo).');
  const { data, error } = await supabase!.functions.invoke<{ url: string }>('billing', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => ({}))) as { error?: string }).error : undefined;
    throw new Error(msg ?? error.message);
  }
  if (!data?.url) throw new Error('Le paiement n’a pas pu démarrer. Réessayez.');
  return data.url;
}

async function callJson<T>(body: Record<string, unknown>): Promise<T> {
  if (!isSupabaseConfigured) throw new Error('Le paiement a besoin du serveur Storyit (mode démo).');
  const { data, error } = await supabase!.functions.invoke<T>('billing', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => ({}))) as { error?: string }).error : undefined;
    throw new Error(msg ?? error.message);
  }
  return data as T;
}

export type TrialStatus = { trialing: boolean; trial_end: number | null; product: 'creator' | 'pro' | 'studio' | null };

/** Stripe-hosted pages: card data never touches our app. */
export const billingService = {
  /** trial: the $1 three-day trial of a plan (one per account), then the plan at full price */
  async checkout(product: ProductKey, opts: { trial?: boolean } = {}): Promise<{ upgraded: boolean; paid: boolean }> {
    const r = await callJson<{ url?: string; upgraded?: boolean; ok?: boolean; paid?: boolean; invoice_url?: string | null }>({ action: 'checkout', product, trial: opts.trial === true });
    if (r.url) { window.location.assign(r.url); return { upgraded: false, paid: false }; }
    // already on a plan: upgraded in place (only the price difference is billed), or the running trial was ended
    if (r.upgraded || r.ok) {
      if (!r.paid && r.invoice_url) { window.location.assign(r.invoice_url); return { upgraded: true, paid: false }; }
      if (!r.paid) throw new Error('Le paiement est en attente. Vérifiez votre moyen de paiement dans « Gérer la facturation ».');
      return { upgraded: true, paid: true };
    }
    throw new Error('Le paiement n’a pas pu démarrer. Réessayez.');
  },
  /** the running $1 trial, if any */
  async trialStatus(): Promise<TrialStatus> {
    if (!isSupabaseConfigured) return { trialing: false, trial_end: null, product: null };
    return callJson<TrialStatus>({ action: 'status' });
  },
  /** ends the trial now on `product`: Stripe bills the full plan price and the plan's credits follow */
  async endTrial(product: 'creator' | 'pro' | 'studio') {
    return callJson<{ ok: boolean; paid: boolean; status: string; invoice_url: string | null }>({ action: 'end_trial', product });
  },
  /** automatic top-up (subscribers): buy `pack` with the saved card whenever the balance drops below `threshold` */
  async setAutoTopup(settings: { enabled: boolean; threshold: 1000 | 3000 | 5000; pack: 'pack_100' | 'pack_500' }) {
    return callJson<{ ok: boolean }>({ action: 'auto_topup', ...settings });
  },
  async openPortal() {
    window.location.assign(await call({ action: 'portal' }));
  },
};
