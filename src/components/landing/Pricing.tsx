import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CREDIT_PACKS, PLANS, TRIAL } from '@/services/credits';
import { Button } from '../ui';
import { StartLink } from './StartLink';

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <p className="label text-center">Pricing</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50 md:text-5xl">Simple plans. Nothing hidden.</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-500">
        Plans differ by the number of accounts and videos you manage. Publishing is included; credits are only used by the AI studio (beta).
      </p>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => {
          const featured = 'featured' in p && p.featured;
          return (
            <div key={p.id} className={cn('surface flex flex-col p-6', featured && 'border-violet-500/40 shadow-glow')}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-100">{p.name}</h3>
                {featured && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] text-violet-300">Recommended</span>}
                {'badge' in p && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">{p.badge}</span>}
              </div>
              <p className="mt-4 flex flex-wrap items-baseline gap-x-3 font-display text-5xl text-zinc-50">
                {'compareAt' in p && <s className="font-sans text-xl text-zinc-500" aria-label={`instead of $${p.compareAt}`}>${p.compareAt}</s>}
                <span>${p.price}<span className="font-sans text-sm text-zinc-500">{p.period === 'month' ? '/mo' : ''}</span></span>
              </p>
              {'compareAt' in p && <p className="mt-2 text-xs"><span className="rounded-full bg-coral-500/15 px-2 py-0.5 font-medium text-coral-300">Launch offer</span> <span className="text-zinc-400">Try {TRIAL.days} days for ${TRIAL.price}</span></p>}
              {p.price > 0 && !('compareAt' in p) && <p className="mt-2 text-xs text-zinc-400">Try {TRIAL.days} days for ${TRIAL.price}</p>}

              <ul className="mt-6 flex-1 space-y-2.5">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-sm text-zinc-400"><Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />{perk}</li>
                ))}
              </ul>
              <StartLink to={p.price === 0 ? '/app' : '/app/billing'} className="mt-8">
                <Button variant={featured ? 'primary' : 'secondary'} className="w-full">{p.price === 0 ? 'Start Free' : `Try ${p.name} for $${TRIAL.price}`}</Button>
              </StartLink>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs text-zinc-500">
        AI studio top-ups: {CREDIT_PACKS.map((k) => `${k.credits} credits for $${k.price}`).join(', ')}. They never expire.
      </p>
    </section>
  );
}
