import { ArrowRight, Check, Coins, Gift, Lock } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { billingService, PAYMENTS_PAUSED } from '@/services/billing';
import { PaymentsPausedBanner } from './PaymentsPaused';
import { CREDIT_PACKS, PLANS, TRIAL, TRIAL_ENABLED, YEARLY_DISCOUNT, projectsFor, type ProductKey, formatCredits } from '@/services/credits';
import { store } from '@/services/store';
import { Button, useToast } from '../ui';

const RANKS: Record<string, number> = { free: 0, creator: 1, pro: 2, studio: 3 };
const rank = (plan?: string) => RANKS[plan ?? 'free'] ?? 0;

export function PlanPicker({ currentPlan, compact, trialUsed, initialInterval = 'year' }: { currentPlan?: string; compact?: boolean; trialUsed?: boolean; initialInterval?: 'year' | 'month' }) {
  const toast = useToast();
  const trialOpen = TRIAL_ENABLED && !trialUsed && (currentPlan ?? 'free') === 'free';
  // trial-eligible accounts open on the monthly tab, where every plan offers the $1 trial
  const [interval, setInterval] = useState<'year' | 'month'>(trialOpen ? 'month' : initialInterval);
  const [pending, setPending] = useState<string | null>(null);
  const currentPrice = PLANS.find((p) => p.id === currentPlan)?.price ?? 0;
  const canTrial = trialOpen;
  // the $1 trial is for the monthly plans only (a trial that turned into a yearly charge would surprise the customer)
  const trialHere = canTrial && interval === 'month';
  const [error, setError] = useState<string | null>(null);

  const buy = async (product: ProductKey, trial = false) => {
    setPending(trial ? `${product}:trial` : product);
    setError(null);
    try {
      const r = await billingService.checkout(product, { trial });
      if (r.paused) { setPending(null); return; }
      if (r.upgraded && r.paid) {
        toast(`Offre ${PLANS.find((p) => p.id === product.replace('_year', ''))?.name ?? ''}${product.endsWith('_year') ? ' annuelle' : ''} activée : vos crédits arrivent dans quelques secondes.`);
        setTimeout(() => store.notify(), 4000);
        setPending(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Le paiement n’a pas pu démarrer.');
      setPending(null);
    }
  };

  return (
    <div>
      {PAYMENTS_PAUSED && <PaymentsPausedBanner className="mb-5" />}
      {canTrial && (
        <div className="relative mb-5 overflow-hidden rounded-2xl border border-violet-500/40 bg-violet-600/[0.12] p-5">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-violet-500/25 blur-3xl" />
          <p className="relative inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Offre d’essai</p>
          <p className="relative mt-3 text-balance font-display text-3xl leading-tight text-zinc-50">Essayez tout Storyit 3 jours pour {TRIAL.price} $</p>
          <ul className="relative mt-3 space-y-1.5 text-sm text-zinc-300">
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden /><span><strong className="text-zinc-100">{formatCredits(TRIAL.credits)} crédits</strong> : une vidéo complète de 30 s avec le Creative Studio</span></li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden /><span>Tout Storyit : Creative Studio, clips IA (1 vidéo), traduction</span></li>
            <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden /><span>Résiliable en 1 clic avant la fin de l’essai</span></li>
          </ul>
          <Button size="lg" className="relative mt-4 w-full sm:w-auto" loading={pending === 'creator:trial'} disabled={pending !== null} onClick={() => buy('creator', true)}>
            Commencer l’essai à {TRIAL.price} $
          </Button>
          <p className="relative mt-2 text-[11px] leading-snug text-zinc-400">
            Puis Creator à {PLANS.find((x) => x.id === 'creator')?.price} $/mois, au bout de {TRIAL.days} jours ou dès qu’il vous reste {formatCredits(TRIAL.switchAt)} crédits d’essai ou moins. Vous préférez Pro ou Studio ? Choisissez l’essai sous l’offre voulue ci-dessous.
          </p>
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Facturation" className="inline-flex rounded-full border border-line/10 bg-ink-950 p-1">
          {(['year', 'month'] as const).map((iv) => (
            <button key={iv} type="button" role="radio" aria-checked={interval === iv} onClick={() => setInterval(iv)}
              className={cn('touch-hit flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                interval === iv ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-100')}>
              {iv === 'year' ? 'Annuel' : 'Mensuel'}
              {iv === 'year' && <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', interval === iv ? 'bg-white text-violet-700' : 'bg-emerald-500/15 text-emerald-300')}>−{YEARLY_DISCOUNT} %</span>}
              {iv === 'month' && canTrial && <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', interval === iv ? 'bg-white text-violet-700' : 'bg-emerald-500/15 text-emerald-300')}>essai {TRIAL.price} $</span>}
            </button>
          ))}
        </div>
        <p className="text-xs font-medium text-emerald-300">{interval === 'year' ? `🎁 −${YEARLY_DISCOUNT} % et tous les crédits de l’année d’un coup` : trialHere ? `🎁 Essai ${TRIAL.days} jours pour ${TRIAL.price} $ · ${formatCredits(TRIAL.credits)} crédits pour tester` : `Passez à l’annuel pour économiser ${YEARLY_DISCOUNT} %`}</p>
      </div>
      <div className={cn('grid gap-3', compact ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-4')}>
        {/* In the compact paywall, only show plans above the current one (Studio customers just see the top-up packs). */}
        {PLANS.filter((p) => !compact || (p.id !== 'free' && rank(p.id) > rank(currentPlan))).map((p) => {
          const current = p.id === currentPlan;
          // Never offer a lower plan as an "upgrade" (a Studio customer must not see "Upgrade to Creator").
          const included = !current && rank(p.id) < rank(currentPlan);
          const featured = 'featured' in p && p.featured;
          return (
            <div key={p.id} className={cn('flex min-w-0 flex-col rounded-xl border p-4', p.id === 'free' && current && 'hidden sm:block', featured ? 'border-violet-500/40 bg-violet-500/[0.06]' : 'border-line/[0.08] bg-ink-850')}>
              <div className="flex min-h-6 items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-100">{p.name}</p>
                {current ? <span className="rounded-full bg-line/10 px-2 py-0.5 text-[11px] text-zinc-300">Actuelle</span>
                  : 'badge' in p ? <span className="whitespace-nowrap rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">Le plus rentable</span>
                  : 'compareAt' in p && interval !== 'year' && <span className="whitespace-nowrap rounded-full bg-coral-500/15 px-2 py-0.5 text-[11px] font-medium text-coral-300">Offre de lancement</span>}
              </div>
              {(() => { const yearly = interval === 'year' && 'yearly' in p ? p.yearly : null; return (<>
              <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 font-display text-3xl text-zinc-50">
                {p.price > 0 && (yearly || 'compareAt' in p) && <s className="font-sans text-base text-zinc-500" aria-label={`au lieu de ${yearly ? p.price : 'compareAt' in p ? p.compareAt : p.price} $`}>{yearly ? p.price : 'compareAt' in p ? p.compareAt : p.price} $</s>}
                <span className="whitespace-nowrap">{yearly ? Math.round(yearly / 12) : p.price} $<span className="font-sans text-xs text-zinc-500">{p.period === 'month' ? '/mois' : ''}</span></span>
              </p>
              {yearly ? <p className="text-[11px] text-zinc-400">{yearly} $ réglés une fois pour l’année · <span className="font-semibold text-emerald-300">vous économisez {p.price * 12 - yearly} $</span></p>
                : p.price > 0 && <p className="text-[11px] text-zinc-500">Facturé chaque mois</p>}
              <p className="mt-2 text-sm font-semibold text-violet-300">{yearly ? `${formatCredits(p.credits * 12)} crédits d’un coup (12 mois)` : `${formatCredits(p.credits)} crédits ${p.period === 'month' ? '/ mois' : 'pour commencer'}`}</p>
              <p className="text-[11px] text-zinc-500">≈ {projectsFor(p.credits)} projets Creative Studio / mois</p>
              </>); })()}
              {!compact && (
                <ul className="mt-3 space-y-1.5">
                  {p.perksFr.map((k) => <li key={k} className="flex gap-1.5 text-xs text-zinc-400"><Check className="h-3.5 w-3.5 shrink-0 text-violet-400" />{k}</li>)}
                </ul>
              )}
              <div className="mt-auto" />
              {p.id !== 'free' && trialHere && !current && !included && (
                <>
                  <Button className="mt-4 h-11 w-full whitespace-nowrap bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 text-sm shadow-[0_10px_30px_-10px_rgba(139,92,246,0.9)] hover:brightness-110" loading={pending === `${p.id}:trial`}
                    disabled={pending !== null} onClick={() => buy(p.id as ProductKey, true)}>
                    <Gift className="h-4 w-4 shrink-0" aria-hidden /> Essayer pour {TRIAL.price} $ <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                  </Button>
                  <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">
                    {TRIAL.days} jours d’essai : {TRIAL.price} $ aujourd’hui et {formatCredits(TRIAL.credits)} crédits pour tester. Passage automatique à {p.name} ({p.price} $/mois) au bout de {TRIAL.days} jours, ou plus tôt dès qu’il vous reste {formatCredits(TRIAL.switchAt)} crédits d’essai ou moins. Résiliable à tout moment avant.
                  </p>
                  <button type="button" onClick={() => buy(p.id as ProductKey)} disabled={pending !== null}
                    className="touch-hit mt-2 block w-full text-center text-xs text-violet-300 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:opacity-50">
                    {pending === p.id ? '…' : `Ou s’abonner maintenant pour ${p.price} $/mois`}
                  </button>
                </>
              )}
              {p.id !== 'free' && !(trialHere && !current && !included) && (
                interval === 'year' && 'yearly' in p ? (
                  <Button size="sm" className="mt-4 h-auto min-h-9 w-full py-2 leading-tight" variant={featured && !included ? 'primary' : 'secondary'} disabled={included}
                    loading={pending === `${p.id}_year`} onClick={() => buy(`${p.id}_year` as ProductKey)}>
                    {included ? 'Inclus dans votre offre' : current ? 'Passer à l’annuel (−20 %)' : `Choisir ${p.name}`}
                  </Button>
                ) : (
                <Button size="sm" className="mt-4 h-auto min-h-9 w-full py-2 leading-tight" variant={featured && !included ? 'primary' : 'secondary'} disabled={current || included}
                  loading={pending === p.id} onClick={() => buy(p.id as ProductKey)}>
                  {current ? 'Votre offre' : included ? 'Inclus dans votre offre' : currentPrice > 0 ? `Passer à ${p.name} (+${p.price - currentPrice} $)` : `Passer à ${p.name}`}
                </Button>
                )
              )}
            </div>
          );
        })}
      </div>

      <p className="label mb-3 mt-6">Ou rechargez — vos crédits n’expirent jamais</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {CREDIT_PACKS.map((pack) => (
          <button key={pack.id} onClick={() => buy(pack.id)} disabled={pending !== null}
            className="flex items-center justify-between gap-3 rounded-xl border border-line/[0.08] bg-ink-850 px-4 py-3 text-left transition hover:border-violet-500/40 disabled:opacity-50">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-100">
              <span className="flex items-center gap-2 whitespace-nowrap"><Coins className="h-4 w-4 shrink-0 text-violet-300" />{formatCredits(pack.credits)} crédits</span>
              {'badge' in pack && <span className="whitespace-nowrap rounded-full bg-coral-500/15 px-2 py-0.5 text-[11px] text-coral-300">Meilleur prix</span>}
            </span>
            <span className="shrink-0 text-right"><span className="block whitespace-nowrap text-sm font-semibold text-zinc-100">{pending === pack.id ? '…' : `${pack.price} $`}</span><span className="block whitespace-nowrap text-[11px] text-zinc-500">≈ {projectsFor(pack.credits)} projets</span></span>
          </button>
        ))}
      </div>
      {currentPrice > 0 && rank(currentPlan) < rank('studio') && (
        <p className="mt-3 text-[11px] text-zinc-500">Votre date de facturation ne change pas : vous payez seulement la différence aujourd’hui, et vous recevez tout de suite les crédits en plus de la nouvelle offre.</p>
      )}
      {error && <p role="alert" className="mt-3 text-xs text-coral-300">{error}</p>}
      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" aria-hidden />Paiement sécurisé</span>
        <span>Carte, Apple Pay ou Google Pay</span>
        <span>Résiliable en 1 clic</span>
        <span>Crédits disponibles tout de suite</span>
      </p>
    </div>
  );
}
