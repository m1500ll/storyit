import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CREDIT_COSTS, CREDIT_PACKS, episodesFor, FULL_EPISODE_COST, PLANS } from '@/services/credits';
import { Button } from '../ui';
import { StartLink } from './StartLink';

const usd = (n: number) => `$${n.toFixed(n < 10 ? 2 : 0)}`;

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <p className="label text-center">Pricing</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50 md:text-5xl">Pay per episode. Nothing hidden.</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-500">
        A full 15-scene episode uses about {FULL_EPISODE_COST} Story Credits ({CREDIT_COSTS.conceptGeneration} for concepts · {CREDIT_COSTS.sceneBreakdown} for the storyboard · {CREDIT_COSTS.sceneRender} per rendered scene). Failed scenes are retried for free.
      </p>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const featured = 'featured' in p && p.featured;
          const episodes = episodesFor(p.credits);
          return (
            <div key={p.id} className={cn('surface flex flex-col p-6', featured && 'border-violet-500/40 shadow-glow')}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-100">{p.name}</h3>
                {featured && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] text-violet-300">Recommended</span>}
              </div>
              <p className="mt-4 font-display text-5xl text-zinc-50">${p.price}<span className="font-sans text-sm text-zinc-500">{p.period === 'month' ? '/mo' : ''}</span></p>
              <p className="mt-1 text-sm text-violet-300">{p.credits} credits{p.period === 'month' ? ' / month' : ' to start'}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {episodes > 0
                  ? <>≈ {episodes} full episodes · {usd(p.price / episodes)} per episode</>
                  : <>≈ {Math.floor(p.credits / (CREDIT_COSTS.conceptGeneration + CREDIT_COSTS.sceneBreakdown))} storyboards to try it out</>}
              </p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-sm text-zinc-400"><Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />{perk}</li>
                ))}
              </ul>
              <StartLink to={p.price === 0 ? '/app' : '/app/billing'} className="mt-8">
                <Button variant={featured ? 'primary' : 'secondary'} className="w-full">{p.price === 0 ? 'Start Free' : `Start with ${p.name}`}</Button>
              </StartLink>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs text-zinc-500">
        Need more? Top-up packs: {CREDIT_PACKS.map((k) => `${k.credits} credits for $${k.price}`).join(' · ')}. They never expire.
      </p>
    </section>
  );
}
