import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CREDIT_COSTS, estimateEpisodeCost } from '@/services/credits';
import { SCENES_PER_EPISODE } from '@/types/domain';
import { FruitArt } from '../ui';

const IDEAS = [
  'A jealous strawberry suspects her arrogant lemon boyfriend of cheating',
  'A shy watermelon falls for a pineapple TV star',
  'Two rival grapes compete on a fruit-bowl dating show',
];

/** Empty dashboard = onboarding: teach the loop and offer a one-click first action. */
export function FirstRun({ balance }: { balance: number }) {
  const steps = [
    `Write one sentence (${CREDIT_COSTS.conceptGeneration} credit)`,
    `Pick a concept & get ${SCENES_PER_EPISODE} scenes (${CREDIT_COSTS.sceneBreakdown} credits)`,
    `Render & approve (${estimateEpisodeCost(SCENES_PER_EPISODE)} credits)`,
  ];
  return (
    <div className="surface relative overflow-hidden p-6 md:p-8">
      <div className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 opacity-90 md:h-52 md:w-52"><FruitArt fruit="strawberry" mood="shock" /></div>
      <p className="label flex items-center gap-1.5"><Sparkles className="h-3 w-3 text-coral-400" /> Your first episode</p>
      <h2 className="mt-3 max-w-md font-display text-3xl text-zinc-50">Start with one sentence. We’ll do the rest.</h2>
      <ol className="mt-5 max-w-md space-y-2">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3 text-sm text-zinc-400">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line/10 text-xs text-zinc-300">{i + 1}</span>{s}
          </li>
        ))}
      </ol>
      <p className="label mb-3 mt-7">Try one of these</p>
      <div className="flex flex-col gap-2">
        {IDEAS.map((idea) => (
          <Link key={idea} to={`/app/new?idea=${encodeURIComponent(idea)}`}
            className="group flex items-center justify-between gap-3 rounded-xl border border-line/[0.08] bg-ink-850 px-4 py-3 text-sm text-zinc-300 transition hover:border-violet-500/40 hover:text-zinc-100">
            <span className="min-w-0">{idea}</span><ArrowRight className="h-4 w-4 shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-violet-300" />
          </Link>
        ))}
      </div>
      <p className="mt-5 text-xs text-zinc-500">You have <span className="text-violet-300">{balance} credits</span> — enough for {Math.floor(balance / (CREDIT_COSTS.conceptGeneration + CREDIT_COSTS.sceneBreakdown))} storyboards.</p>
    </div>
  );
}
