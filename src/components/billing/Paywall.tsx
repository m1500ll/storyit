import { ArrowRight, Check, Clapperboard, Sparkles } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { billingPlan, billingService } from '@/services/billing';
import { useProfile } from '@/hooks/useStore';
import { PLANS, PROMPT_PROJECT_COST, TRIAL, TRIAL_ENABLED, projectsFor, formatCredits } from '@/services/credits';
import { Button } from '../ui';
import { PlanPicker } from './PlanPicker';
import { TrialUpgrade } from './TrialUpgrade';

/** Why the sheet opened: lets the headline match what the user was trying to do. */
export type PaywallReason = 'credits' | 'accounts' | 'library' | 'publications' | 'clips' | 'clipsTrial' | 'video';
/** `returnTo`: where Stripe sends the customer back after paying (e.g. their video, ready to be generated) */
interface PaywallState { required?: number; reason?: PaywallReason; returnTo?: string }
const PaywallContext = createContext<(state?: PaywallState) => void>(() => {});

/** Global upgrade sheet, opened whenever an action needs more credits than the user has. */
export function PaywallProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PaywallState | null>(null);
  const [showAll, setShowAll] = useState(false);
  const open = useCallback((s: PaywallState = {}) => { setShowAll(false); setState(s); }, []);
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
      {state && state.reason === 'video' && billingPlan(profile).plan === 'free' && !showAll ? (
        <VideoTrialSheet trial={TRIAL_ENABLED && !billingPlan(profile).trialUsed} need={Math.max(0, (state.required ?? 0) - (profile?.credit_balance ?? 0))} returnTo={state.returnTo} onClose={() => setState(null)} onMore={() => setShowAll(true)} />
      ) : state && (
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
            {/* hidden on phones so the first offer and its button show without scrolling */}
            <ul className="relative mt-4 hidden gap-1.5 text-xs text-zinc-300 sm:grid sm:grid-cols-3">
              <li className="rounded-lg bg-line/[0.04] px-3 py-2">1 projet Creative Studio = {formatCredits(PROMPT_PROJECT_COST)} crédits</li>
              <li className="rounded-lg bg-line/[0.04] px-3 py-2">10 000 crédits ≈ {projectsFor(10000)} projets complets</li>
              <li className="rounded-lg bg-line/[0.04] px-3 py-2">Les crédits rechargés n’expirent jamais</li>
            </ul>
            <div className="relative mt-6"><TrialUpgrade /><PlanPicker currentPlan={billingPlan(profile).plan} trialUsed={billingPlan(profile).trialUsed} compact /></div>
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
  clips: 'Le clipping IA est réservé aux abonnés',
  clipsTrial: 'Ta vidéo d’essai est faite',
  video: 'Ta vidéo est prête à être créée',
};
const SUB: Record<PaywallReason, string> = {
  credits: 'Les crédits servent au Creative Studio, à la vidéo automatique, à la traduction et au découpage en clips.',
  accounts: 'Creator connecte jusqu’à 10 comptes TikTok et Instagram, Studio n’a pas de limite.',
  library: 'Creator stocke jusqu’à 500 vidéos, Studio n’a pas de limite.',
  publications: 'Creator programme jusqu’à 2 000 publications à l’avance, Studio n’a pas de limite.',
  clips: 'Prends une formule pour transformer tes longues vidéos en clips.',
  clipsTrial: 'Pendant l’essai, tu peux découper 1 vidéo. Passe à l’abonnement complet pour en faire autant que tu veux.',
  video: 'Ton histoire et tes réglages sont gardés : choisis une offre et ta vidéo se lance.',
};

export const usePaywall = () => useContext(PaywallContext);

/** The money moment: the customer built a video in the wizard but lacks credits. One offer, one button (the $1
 *  trial covers a 30 s video), and Stripe brings them back to their video. The full offers stay one click away. */
function VideoTrialSheet({ trial, need, returnTo, onClose, onMore }: { trial: boolean; need: number; returnTo?: string; onClose: () => void; onMore: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creator = PLANS.find((p) => p.id === 'creator');
  const start = async () => {
    setPending(true); setError(null);
    try { const r = await billingService.checkout('creator', { trial, returnTo }); if (r.paused) setPending(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'Le paiement n’a pas pu démarrer.'); setPending(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex overscroll-contain items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="vt-title">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="surface relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-b-none p-6 text-center sm:rounded-2xl md:p-8">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-fuchsia-600/30 blur-3xl" />
        <span className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-[0_0_30px_-6px_rgba(217,70,239,0.8)]"><Clapperboard className="h-7 w-7" aria-hidden /></span>
        <h2 id="vt-title" className="relative mt-4 text-balance font-display text-3xl leading-tight text-zinc-50">Ta vidéo est prête à être créée</h2>
        <p className="relative mt-2 text-sm text-zinc-300">
          {trial
            ? <>Il te manque {formatCredits(need)} crédits. Avec l’essai 3 jours à {TRIAL.price} $, tu reçois <strong className="text-zinc-50">{formatCredits(TRIAL.credits)} crédits</strong> : assez pour cette vidéo.</>
            : <>Il te manque {formatCredits(need)} crédits. Avec Creator, tu reçois <strong className="text-zinc-50">{formatCredits(creator?.credits ?? 43000)} crédits chaque mois</strong> : de quoi créer cette vidéo et plein d’autres.</>}
        </p>
        <ul className="relative mx-auto mt-5 max-w-xs space-y-2 text-left text-sm text-zinc-200">
          <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />Ton histoire est gardée : tu reviens direct sur ta vidéo</li>
          {trial ? <>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />Résiliable en 1 clic avant la fin des 3 jours</li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />Ensuite Creator à {creator?.price ?? 29} $/mois ({formatCredits(creator?.credits ?? 43000)} crédits), seulement si tu continues</li>
          </> : <>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />{creator?.price ?? 29} $/mois, sans engagement, résiliable en 1 clic</li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />Clipping IA, traduction et Creative Studio inclus</li>
          </>}
        </ul>
        <Button size="lg" className="relative mt-6 w-full" loading={pending} onClick={() => void start()}>
          {trial ? <>Créer ma vidéo pour {TRIAL.price} $</> : <>Créer ma vidéo · Creator {creator?.price ?? 29} $/mois</>} <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
        {error && <p className="relative mt-2 text-xs text-coral-300" aria-live="polite">{error}</p>}
        <p className="relative mt-2 text-[11px] text-zinc-500">Paiement sécurisé · carte, Apple Pay, Google Pay</p>
        <div className="relative mt-4 flex items-center justify-center gap-4 text-xs">
          <button type="button" onClick={onMore} className="touch-hit rounded text-violet-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">Voir toutes les offres</button>
          <button type="button" onClick={onClose} className="touch-hit rounded text-zinc-500 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50">Plus tard</button>
        </div>
      </div>
    </div>
  );
}
