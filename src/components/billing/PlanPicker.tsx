import { Check, Coins } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { billingService } from '@/services/billing';
import { CREDIT_PACKS, episodesFor, PLANS, type ProductKey } from '@/services/credits';
import { Button } from '../ui';

export function PlanPicker({ currentPlan, compact }: { currentPlan?: string; compact?: boolean }) {
  const [pending, setPending] = useState<ProductKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buy = async (product: ProductKey) => {
    setPending(product);
    setError(null);
    try {
      await billingService.checkout(product);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
      setPending(null);
    }
  };

  return (
    <div>
      <div className={cn('grid gap-3', compact ? 'sm:grid-cols-2' : 'md:grid-cols-3')}>
        {PLANS.filter((p) => !compact || p.id !== 'free').map((p) => {
          const current = p.id === currentPlan;
          const featured = 'featured' in p && p.featured;
          return (
            <div key={p.id} className={cn('rounded-xl border p-4', featured ? 'border-violet-500/40 bg-violet-500/[0.06]' : 'border-white/[0.08] bg-ink-850')}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-100">{p.name}</p>
                {current && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-300">Current</span>}
              </div>
              <p className="mt-2 font-display text-3xl text-zinc-50">${p.price}<span className="font-sans text-xs text-zinc-500">{p.period === 'month' ? '/mo' : ''}</span></p>
              <p className="text-xs text-violet-300">{p.credits} credits {p.period === 'month' ? '/ month' : 'to start'} · ≈ {episodesFor(p.credits)} episodes</p>
              {!compact && (
                <ul className="mt-3 space-y-1.5">
                  {p.perks.map((k) => <li key={k} className="flex gap-1.5 text-xs text-zinc-400"><Check className="h-3.5 w-3.5 shrink-0 text-violet-400" />{k}</li>)}
                </ul>
              )}
              {p.id !== 'free' && (
                <Button size="sm" className="mt-4 w-full" variant={featured ? 'primary' : 'secondary'} disabled={current}
                  loading={pending === p.id} onClick={() => buy(p.id as ProductKey)}>
                  {current ? 'Your plan' : `Upgrade to ${p.name}`}
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
            className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-ink-850 px-4 py-3 text-left transition hover:border-violet-500/40 disabled:opacity-50">
            <span className="flex items-center gap-2 text-sm text-zinc-100">
              <Coins className="h-4 w-4 text-violet-300" />{pack.credits} credits
              {'badge' in pack && <span className="rounded-full bg-coral-500/15 px-2 py-0.5 text-[10px] text-coral-300">{pack.badge}</span>}
            </span>
            <span className="text-sm font-semibold text-zinc-300">{pending === pack.id ? '…' : `$${pack.price}`}</span>
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-xs text-coral-300">{error}</p>}
      <p className="mt-4 text-[11px] text-zinc-600">Secure payment by Stripe. Cancel anytime.</p>
    </div>
  );
}
