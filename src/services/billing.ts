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

/** New payments are paused (no payment provider can pay out right now): every payment button opens the maintenance
 *  notice instead of a checkout. The billing function also refuses checkouts while the secret BILLING_PAUSED=true. */
export const PAYMENTS_PAUSED = false;
export const PAYMENTS_PAUSED_EVENT = 'storyit:payments-paused';

export type CancelReason = 'too_expensive' | 'not_using' | 'no_views' | 'quality' | 'bug' | 'other';
export type TrialStatus = { trialing: boolean; trial_end: number | null; product: 'creator' | 'pro' | 'studio' | null };

/** Stripe-hosted pages: card data never touches our app. */
export const billingService = {
  /** trial: the $1 three-day trial of a plan (one per account), then the plan at full price */
  /** returnTo: an /app/… path Stripe sends the customer back to (with ?checkout=success|cancelled) */
  async checkout(product: ProductKey, opts: { trial?: boolean; returnTo?: string } = {}): Promise<{ upgraded: boolean; paid: boolean; paused?: boolean }> {
    if (PAYMENTS_PAUSED) { window.dispatchEvent(new Event(PAYMENTS_PAUSED_EVENT)); return { upgraded: false, paid: false, paused: true }; }
    const r = await callJson<{ url?: string; upgraded?: boolean; ok?: boolean; paid?: boolean; invoice_url?: string | null }>({ action: 'checkout', product, trial: opts.trial === true, ...(opts.returnTo ? { return_to: opts.returnTo } : {}) });
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
  async setAutoTopup(settings: { enabled: boolean; threshold: number; credits: number }) {
    return callJson<{ ok: boolean }>({ action: 'auto_topup', ...settings });
  },
  /** the public client-side token Paddle.js needs on /pay */
  async paddleToken(): Promise<string | null> {
    return (await callJson<{ token: string | null }>({ action: 'paddle_config' })).token;
  },
  /** the "before you cancel" answer (stored for the owner) */
  async cancelFeedback(reason: CancelReason, details: string, outcome: 'cancel' | 'downgrade' | 'stayed') {
    if (!isSupabaseConfigured) return { ok: true };
    return callJson<{ ok: boolean }>({ action: 'cancel_feedback', reason, details, outcome });
  },
  async openPortal() {
    window.location.assign(await call({ action: 'portal' }));
  },
};

/** The old Stripe account was abandoned (Nov 2026): a paid plan still recorded there does not renew, so the customer
 *  re-subscribes on the new account. For the plan picker that customer is on no plan (and the $1 trial is not offered). */
export function billingPlan(profile: { plan?: string; trial_used?: boolean; stripe_account?: string | null } | null | undefined) {
  const legacyPaid = !!profile?.plan && profile.plan !== 'free' && profile.stripe_account !== 'new';
  return { plan: legacyPaid ? 'free' : profile?.plan, trialUsed: legacyPaid || !!profile?.trial_used, legacyPaid };
}
