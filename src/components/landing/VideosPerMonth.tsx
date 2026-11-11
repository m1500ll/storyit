import { Clapperboard } from 'lucide-react';
import { ANIMATED_LENGTHS, PLANS, videosFor, formatCredits } from '@/services/credits';
import { StartLink } from './StartLink';

/** The headline number: how many 3D videos each plan makes every month (counted on 30-second videos). */
export function VideosPerMonth() {
  const plans = PLANS.filter((p) => p.price > 0);
  const short = ANIMATED_LENGTHS[0];
  return (
    <section aria-labelledby="vpm-title" className="mx-auto max-w-6xl px-4 py-16 md:px-6">
      <div className="surface relative overflow-hidden px-6 py-12 text-center md:px-12">
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[700px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[100px]" />
        <p className="label relative inline-flex items-center gap-2"><Clapperboard className="h-4 w-4 text-violet-300" aria-hidden /> Your monthly 3D videos</p>
        <h2 id="vpm-title" className="relative mt-3 font-display text-4xl text-zinc-50 md:text-5xl">Up to {videosFor(Math.max(...plans.map((p) => p.credits)))} 3D videos a month</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-sm text-zinc-400">
          Every plan comes with credits each month. A 30-second video costs {formatCredits(short.credits)} credits, a 1-minute one {ANIMATED_LENGTHS[1].credits}, a 2-minute one {ANIMATED_LENGTHS[2].credits}.
        </p>
        <ul className="relative mt-10 grid gap-4 sm:grid-cols-3">
          {plans.map((p) => (
            <li key={p.id} className={'rounded-2xl border px-4 py-6 ' + ('featured' in p && p.featured ? 'border-violet-500/50 bg-violet-500/10' : 'border-line/10 bg-line/[0.02]')}>
              <p className="text-sm font-semibold text-zinc-100">{p.name} · ${p.price}/mo</p>
              <p className="mt-2 font-display text-6xl tabular-nums text-zinc-50 md:text-7xl">{videosFor(p.credits)}</p>
              <p className="text-sm text-violet-300">3D videos a month</p>
              <p className="mt-1 text-[11px] text-zinc-500">{p.credits.toLocaleString('en-US')} credits · counted on 30-second videos</p>
            </li>
          ))}
        </ul>
        <StartLink to="/app/studio" className="relative mt-8 inline-block">
          <span className="inline-flex h-11 items-center rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">Create my first 3D video</span>
        </StartLink>
      </div>
    </section>
  );
}
