import { Sparkles } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useProfile } from '@/hooks/useStore';
import { PROMPT_PROJECT_COST, projectsFor, formatCredits } from '@/services/credits';
import { PlanPicker } from './PlanPicker';
import { TrialUpgrade } from './TrialUpgrade';

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
        <div className="fixed inset-0 z-50 flex overscroll-contain items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Acheter des crédits ou changer d’offre">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setState(null)} />
          <div className="surface relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-b-none p-6 sm:rounded-2xl md:p-8">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-violet-600/25 blur-3xl" />
            <Sparkles className="relative h-5 w-5 text-coral-400" />
            <h2 className="relative mt-3 font-display text-3xl text-zinc-50">{HEADLINE[state.reason ?? 'credits']}</h2>
            <p className="relative mt-1 text-sm text-zinc-400">
              {state.required
                ? <>Cette étape demande <strong className="text-zinc-200">{formatCredits(state.required)} crédits</strong> ; vous en avez {formatCredits(profile?.credit_balance ?? 0)}. </>
                : <>Vous avez <strong className="text-zinc-200">{formatCredits(profile?.credit_balance ?? 0)} crédits</strong>. </>}
              {SUB[state.reason ?? 'credits']}
            </p>
            <ul className="relative mt-4 grid gap-1.5 text-xs text-zinc-300 sm:grid-cols-3">
              <li className="rounded-lg bg-line/[0.04] px-3 py-2">1 projet Prompt Studio = {formatCredits(PROMPT_PROJECT_COST)} crédits</li>
              <li className="rounded-lg bg-line/[0.04] px-3 py-2">10 000 crédits ≈ {projectsFor(10000)} projets complets</li>
              <li className="rounded-lg bg-line/[0.04] px-3 py-2">Les crédits rechargés n’expirent jamais</li>
            </ul>
            <div className="relative mt-6"><TrialUpgrade /><PlanPicker currentPlan={profile?.plan} trialUsed={profile?.trial_used} compact /></div>
            <button onClick={() => setState(null)} className="relative mt-4 w-full text-center text-xs text-zinc-500 hover:text-zinc-300">Plus tard</button>
          </div>
        </div>
      )}
    </PaywallContext.Provider>
  );
}

const HEADLINE: Record<PaywallReason, string> = {
  credits: 'Rechargez vos crédits et continuez à créer',
  accounts: 'Connectez plus de comptes',
  library: 'Stockez plus de vidéos',
  publications: 'Programmez plus de publications',
};
const SUB: Record<PaywallReason, string> = {
  credits: 'Les crédits servent au Prompt Studio, à l’Animated Studio, à la vidéo automatique et à la traduction.',
  accounts: 'Creator connecte jusqu’à 10 comptes TikTok et Instagram, Studio n’a pas de limite.',
  library: 'Creator stocke jusqu’à 500 vidéos, Studio n’a pas de limite.',
  publications: 'Creator programme jusqu’à 2 000 publications à l’avance, Studio n’a pas de limite.',
};

export const usePaywall = () => useContext(PaywallContext);
