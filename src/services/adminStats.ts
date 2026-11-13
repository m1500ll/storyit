import { supabase } from '@/lib/supabase';

/** Owner dashboard data, built by the `admin-stats` Edge Function (admin accounts only). */
export type MemberStatus = 'paying' | 'trial' | 'past_due' | 'churned' | 'free';
export interface AdminMember {
  id: string; email: string; signedUpAt: string; lastSignInAt: string | null; confirmed: boolean;
  plan: string; status: MemberStatus; interval: 'month' | 'year' | null; renewsAt: number | null; cancelAtPeriodEnd: boolean; trialEndsAt: number | null;
  paidCents: number; lastPaymentAt: number | null; credits: number; spent: number; videos: number; lastActivityAt: number | null;
  partner: string | null; isAdmin: boolean; unsubscribed: boolean;
}
export interface AdminStats {
  generatedAt: number; stripeConnected: boolean;
  kpis: {
    members: number; paying: number; trials: number; churned: number; free: number; mrrCents: number; revenueCents: number; revenue30Cents: number;
    signupsToday: number; signups7d: number; signups30d: number; activated: number; creditsOutstanding: number; viaPartner: number;
  };
  members: AdminMember[];
  payments: { at: number; amount: number; currency: string; email: string | null; reason: string; label: string }[];
  activity: { at: number; email: string; amount: number; type: string; description: string }[];
}

export const adminStats = {
  async load(): Promise<AdminStats> {
    if (!supabase) throw new Error('Le tableau de bord a besoin du serveur Storyit.');
    const { data, error } = await supabase.functions.invoke<AdminStats>('admin-stats', { body: {} });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      const msg = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => ({}))) as { error?: string }).error : undefined;
      throw new Error(msg ?? error.message);
    }
    return data as AdminStats;
  },
};
