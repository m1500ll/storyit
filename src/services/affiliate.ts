// Influencer programme: calls to the `affiliate` Edge Function (clicks, claim, partner dashboard, admin).
import { supabase } from '@/lib/supabase';

export interface PartnerStats {
  name: string; code: string; active: boolean; rate: number; link: string;
  clicks: number; clicks7: number; visitors30: number; clicksByDay: Record<string, number>;
  signups: number; customers: number; byPlan: Record<string, number>;
  salesCents: number; earnedCents: number; paidOutCents: number; dueCents: number;
  conversions: { date: string; status: 'signed_up' | 'trial' | 'paid'; product: string | null; amountCents: number | null; commissionCents: number | null; paidAt: string | null }[];
  payouts: { amount_cents: number; paid_at: string; note: string | null }[];
}
export interface AdminPartner extends PartnerStats { id: string; secret: string; dashboard: string; created_at: string }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Le programme partenaires a besoin du serveur Storyit (mode démo).');
  const { data, error } = await supabase.functions.invoke<T>('affiliate', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const payload = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => ({}))) as { error?: string }) : {};
    throw new Error(payload.error ?? error.message);
  }
  return data as T;
}

export const affiliate = {
  click: (code: string, visitor: string) => call<{ ok: boolean }>({ action: 'click', code, visitor }),
  claim: (code: string, visitor: string) => call<{ result: string }>({ action: 'claim', code, visitor }),
  stats: (secret: string) => call<PartnerStats>({ action: 'stats', secret }),
  adminList: async () => (await call<{ partners: AdminPartner[] }>({ action: 'admin_list' })).partners,
  adminCreate: (name: string, code: string) => call<{ id: string }>({ action: 'admin_create', name, code }),
  adminPayout: (affiliateId: string, amountCents: number, note?: string) => call({ action: 'admin_payout', affiliate_id: affiliateId, amount_cents: amountCents, note }),
  adminToggle: (affiliateId: string, active: boolean) => call({ action: 'admin_toggle', affiliate_id: affiliateId, active }),
};
