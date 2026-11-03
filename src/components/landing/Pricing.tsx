import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { CREDIT_COSTS, PLANS } from '@/services/credits';
import { Button } from '../ui';

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <p className="label text-center">Pricing</p>
      <h2 className="mt-3 text-center font-display text-4xl text-zinc-50">Pay in Story Credits. Nothing hidden.</h2>
      <p className="mx-auto mt-3 max-w-lg text-center text-sm text-zinc-500">
        {CREDIT_COSTS.sceneRender} credits per rendered scene · {CREDIT_COSTS.sceneBreakdown} per storyboard · retries are free.
      </p>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const featured = 'featured' in p && p.featured;
          return (
            <div key={p.id} className={cn('surface flex flex-col p-6', featured && 'border-violet-500/40 shadow-glow')}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-100">{p.name}</h3>
                {featured && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] text-violet-300">Most popular</span>}
              </div>
              <p className="mt-4 font-display text-5xl text-zinc-50">${p.price}<span className="font-sans text-sm text-zinc-500">/mo</span></p>
              <p className="mt-1 text-sm text-violet-300">{p.credits} Story Credits</p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-sm text-zinc-400"><Check className="mt-0.5 h-4 w-4 text-violet-400" />{perk}</li>
                ))}
              </ul>
              <Link to="/login" className="mt-8"><Button variant={featured ? 'primary' : 'secondary'} className="w-full">Choose {p.name}</Button></Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
