import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

const COPY = {
  concepts: ['Reading your idea…', 'Casting the fruit…', 'Pitching three different angles…', 'Polishing the hooks…'],
  scenes: ['Outlining the episode…', 'Writing the hook scene…', 'Escalating the drama…', 'Planting the twist…', 'Writing the cliffhanger…', 'Drafting image & motion prompts…'],
} as const;

/** AI wait state: tells the user what is happening and shows the shape of the result. */
export function GeneratingState({ kind }: { kind: keyof typeof COPY }) {
  const lines = COPY[kind];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, lines.length - 1)), 2600);
    return () => clearInterval(t);
  }, [lines.length]);

  return (
    <div role="status" aria-live="polite">
      <div className="mb-5 flex items-center gap-3">
        <span className="relative grid h-9 w-9 place-items-center rounded-full bg-violet-500/15">
          <span className="absolute inset-0 animate-ping rounded-full bg-violet-500/20" />
          <Sparkles className="h-4 w-4 text-violet-300" />
        </span>
        <div>
          <p className="text-sm font-medium text-zinc-100">{lines[i]}</p>
          <p className="text-xs text-zinc-500">Usually 10–30 seconds. Credits are only spent if it succeeds.</p>
        </div>
      </div>
      {kind === 'concepts' ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((n) => (
            <div key={n} className="surface space-y-3 p-5" style={{ animationDelay: `${n * 150}ms` }}>
              <div className="h-2.5 w-20 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-6 w-3/4 animate-pulse rounded bg-white/[0.08]" />
              <div className="h-3 w-full animate-pulse rounded bg-white/[0.05]" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-white/[0.05]" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-coral-500/10" />
            </div>
          ))}
        </div>
      ) : (
        <div className="surface divide-y divide-white/5 p-0">
          {Array.from({ length: 6 }, (_, n) => (
            <div key={n} className="flex gap-4 px-5 py-4">
              <div className="h-3 w-5 animate-pulse rounded bg-white/[0.06]" />
              <div className="flex-1 space-y-2">
                <div className={cn('h-3 animate-pulse rounded bg-white/[0.08]', n % 2 ? 'w-1/3' : 'w-1/2')} />
                <div className="h-2.5 w-4/5 animate-pulse rounded bg-white/[0.05]" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
