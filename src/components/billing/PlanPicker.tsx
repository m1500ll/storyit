import { Check, Coins } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { billingService } from '@/services/billing';
import { CREDIT_PACKS, PLANS, TRIAL, TRIAL_ENABLED, projectsFor, type ProductKey } from '@/services/credits';
import { store } from '@/services/store';
import { Button, useToast } from '../ui';

const RANKS: Record<string, number> = { free: 0, creator: 1, pro: 2, studio: 3 };
const rank = (plan?: string) => RANKS[plan ?? 'free'] ?? 0;

export function PlanPicker({ currentPlan, compact, trialUsed }: { currentPlan?: string; compact?: boolean; trialUsed?: boolean }) {
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const currentPrice = PLANS.find((p) => p.id === currentPlan)?.price ?? 0;
  const canTrial = TRIAL_ENABLED && !trialUsed && (currentPlan ?? 'free') === 'free';
  const [error, setError] = useState<string | null>(null);

  const buy = async (product: ProductKey, trial = false) => {
    setPending(trial ? `${product}:trial` : product);
    setError(null);
    try {
      const r = await billingService.checkout(product, { trial });
      if (r.upgraded && r.paid) {
        toast(`Offre ${PLANS.find((p) => p.id === product)?.name ?? ''} activée : vos crédits en plus arrivent dans quelques secondes.`);
        setTimeout(() => store.notify(), 4000);
        setPending(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
      setPending(null);
    }
  };

  return (
    <div>
      <div className={cn('grid gap-3', compact ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-4')}>
        {/* In the compact paywall, only show plans above the current one (Studio customers just see the top-up packs). */}
        {PLANS.filter((p) => !compact || (p.id !== 'free' && rank(p.id) > rank(currentPlan))).map((p) => {
          const current = p.id === currentPlan;
          // Never offer a lower plan as an "upgrade" (a Studio customer must not see "Upgrade to Creator").
          const included = !current && rank(p.id) < rank(currentPlan);
          const featured = 'featured' in p && p.featured;
          return (
            <div key={p.id} className={cn('rounded-xl border p-4', featured ? 'border-violet-500/40 bg-violet-500/[0.06]' : 'border-line/[0.08] bg-ink-850')}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-100">{p.name}</p>
                {current ? <span className="rounded-full bg-line/10 px-2 py-0.5 text-[11px] text-zinc-300">Current</span>
                  : 'badge' in p && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">{p.badge}</span>}
              </div>
              <p className="mt-2 flex items-baseline gap-2 font-display text-3xl text-zinc-50">
                {'compareAt' in p && <s className="font-sans text-base text-zinc-500" aria-label={`instead of $${p.compareAt}`}>${p.compareAt}</s>}
                <span>${p.price}<span className="font-sans text-xs text-zinc-500">{p.period === 'month' ? '/mo' : ''}</span></span>
                {'compareAt' in p && <span className="self-center rounded-full bg-coral-500/15 px-2 py-0.5 font-sans text-[11px] font-medium leading-4 text-coral-300">Launch offer</span>}
              </p>
              <p className="text-xs text-violet-300">{p.credits} credits {p.period === 'month' ? '/ month' : 'to start'} · ≈ {projectsFor(p.credits)} Prompt Studio projects</p>
              {!compact && (
                <ul className="mt-3 space-y-1.5">
                  {p.perks.map((k) => <li key={k} className="flex gap-1.5 text-xs text-zinc-400"><Check className="h-3.5 w-3.5 shrink-0 text-violet-400" />{k}</li>)}
                </ul>
              )}
              {p.id !== 'free' && canTrial && !current && !included && (
                <>
                  <Button size="sm" className="mt-4 w-full" variant={featured ? 'primary' : 'secondary'} loading={pending === `${p.id}:trial`}
                    disabled={pending !== null} onClick={() => buy(p.id as ProductKey, true)}>
                    Try {TRIAL.days} days for ${TRIAL.price}
                  </Button>
                  <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">
                    ${TRIAL.price} today, then ${p.price}/mo after {TRIAL.days} days. Cancel anytime before. {TRIAL.credits} credits during the trial.
                  </p>
                  <button type="button" onClick={() => buy(p.id as ProductKey)} disabled={pending !== null}
                    className="touch-hit mt-1 text-[11px] text-violet-300 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:opacity-50">
                    {pending === p.id ? '…' : `Or subscribe now for $${p.price}/mo`}
                  </button>
                </>
              )}
              {p.id !== 'free' && !(canTrial && !current && !included) && (
                <Button size="sm" className="mt-4 w-full" variant={featured && !included ? 'primary' : 'secondary'} disabled={current || included}
                  loading={pending === p.id} onClick={() => buy(p.id as ProductKey)}>
                  {current ? 'Your plan' : included ? 'Included in your plan' : currentPrice > 0 ? `Upgrade to ${p.name} · +$${p.price - currentPrice} today` : `Upgrade to ${p.name}`}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <p className="label mb-3 mt-6">Or top up — never expires</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {CREDIT_PACKS.map((pack) => (
          <button key={pack.id} onClick={() => buy(pack.id)} disabled={pending !== null}
            className="flex items-center justify-between rounded-xl border border-line/[0.08] bg-ink-850 px-4 py-3 text-left transition hover:border-violet-500/40 disabled:opacity-50">
            <span className="flex items-center gap-2 text-sm text-zinc-100">
              <Coins className="h-4 w-4 text-violet-300" />{pack.credits} credits
              {'badge' in pack && <span className="rounded-full bg-coral-500/15 px-2 py-0.5 text-[11px] text-coral-300">{pack.badge}</span>}
            </span>
            <span className="text-right"><span className="block text-sm font-semibold text-zinc-100">{pending === pack.id ? '…' : `$${pack.price}`}</span><span className="block text-[11px] text-zinc-500">≈ {projectsFor(pack.credits)} projects</span></span>
          </button>
        ))}
      </div>
      {currentPrice > 0 && rank(currentPlan) < rank('studio') && (
        <p className="mt-3 text-[11px] text-zinc-500">Upgrading keeps your billing date: you only pay the price difference today, and you get the extra credits of the new plan right away.</p>
      )}
      {error && <p role="alert" className="mt-3 text-xs text-coral-300">{error}</p>}
      <p className="mt-4 text-[11px] text-zinc-600">Secure payment by Stripe. Cancel anytime.</p>
    </div>
  );
}
