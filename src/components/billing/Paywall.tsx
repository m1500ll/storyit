import { Sparkles } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useProfile } from '@/hooks/useStore';
import { PROMPT_PROJECT_COST, projectsFor } from '@/services/credits';
import { PlanPicker } from './PlanPicker';

/** Why the sheet opened: lets the headline match what the user was trying to do. */
export type PaywallReason = 'credits' | 'accounts' | 'library' | 'publications';
interface PaywallState { required?: number; reason?: PaywallReason }
const PaywallContext = createContext<(state?: PaywallState) => void>(() => {});

/** Global upgrade sheet, opened whenever an action needs more credits than the user has. */
export function PaywallProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PaywallState | null>(null);
  const open = useCallback((s: PaywallState = {}) => setState(s), []);
  const { data: profile } = useProfile();

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setState(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state]);

  return (
    <PaywallContext.Provider value={open}>
      {children}
      {state && (
        <div className="fixed inset-0 z-50 flex overscroll-contain items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Buy credits or upgrade">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setState(null)} />
          <div className="surface relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-b-none p-6 sm:rounded-2xl md:p-8">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-violet-600/25 blur-3xl" />
            <Sparkles className="relative h-5 w-5 text-coral-400" />
            <h2 className="relative mt-3 font-display text-3xl text-zinc-50">{HEADLINE[state.reason ?? 'credits']}</h2>
            <p className="relative mt-1 text-sm text-zinc-400">
              {state.required
                ? <>This step needs <strong className="text-zinc-200">{state.required} credit{state.required > 1 ? 's' : ''}</strong>; you have {profile?.credit_balance ?? 0}. </>
                : <>You have <strong className="text-zinc-200">{profile?.credit_balance ?? 0} credits</strong>. </>}
              {SUB[state.reason ?? 'credits']}
            </p>
            <ul className="relative mt-4 grid gap-1.5 text-xs text-zinc-300 sm:grid-cols-3">
              <li className="rounded-lg bg-line/[0.04] px-3 py-2">1 Prompt Studio project = {PROMPT_PROJECT_COST} credits</li>
              <li className="rounded-lg bg-line/[0.04] px-3 py-2">100 credits ≈ {projectsFor(100)} full projects</li>
              <li className="rounded-lg bg-line/[0.04] px-3 py-2">Top-up credits never expire</li>
            </ul>
            <div className="relative mt-6"><PlanPicker currentPlan={profile?.plan} trialUsed={profile?.trial_used} compact /></div>
            <button onClick={() => setState(null)} className="relative mt-4 w-full text-center text-xs text-zinc-500 hover:text-zinc-300">Not now</button>
          </div>
        </div>
      )}
    </PaywallContext.Provider>
  );
}

const HEADLINE: Record<PaywallReason, string> = {
  credits: 'Get more credits and keep creating',
  accounts: 'Connect more accounts',
  library: 'Store more videos',
  publications: 'Schedule more posts',
};
const SUB: Record<PaywallReason, string> = {
  credits: 'Credits power the Prompt Studio, AI captions and thumbnails. Publishing to your accounts is always included.',
  accounts: 'Creator connects up to 10 TikTok and Instagram accounts, Studio has no limit.',
  library: 'Creator stores up to 500 videos, Studio has no limit.',
  publications: 'Creator schedules up to 2,000 posts ahead, Studio has no limit.',
};

export const usePaywall = () => useContext(PaywallContext);
