import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import type { Phase } from '@/lib/publishPack';

const ICON = {
  done: <Check className="h-3.5 w-3.5" aria-hidden />,
  active: <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />,
  error: <AlertTriangle className="h-3.5 w-3.5" aria-hidden />,
  todo: null,
};
const STATE_LABEL = { done: 'Done', active: 'In progress', error: 'Needs attention', todo: 'Not started' };

/** The five Storyit production phases, with their real status. Phase 5 links to the publish pack. */
export function ProductionPhases({ phases, publishHref }: { phases: Phase[]; publishHref?: string }) {
  return (
    <ol className="mb-6 grid gap-2 sm:grid-cols-5" aria-label="Production phases">
      {phases.map((p) => {
        const body = (
          <>
            <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
              p.state === 'done' && 'bg-emerald-500/15 text-emerald-300',
              p.state === 'active' && 'bg-violet-500/15 text-violet-300',
              p.state === 'error' && 'bg-coral-500/15 text-coral-300',
              p.state === 'todo' && 'bg-line/5 text-zinc-500')}>
              {ICON[p.state] ?? p.id}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-zinc-200">Phase {p.id} · {p.name}</span>
              <span className="block truncate text-[11px] text-zinc-500">{p.detail}</span>
              <span className="sr-only">{STATE_LABEL[p.state]}</span>
            </span>
          </>
        );
        const cls = 'surface flex items-center gap-2.5 px-3 py-2.5';
        return (
          <li key={p.id} className="min-w-0">
            {p.id === 5 && publishHref
              ? <Link to={publishHref} className={cn(cls, 'transition-colors hover:border-violet-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50')}>{body}</Link>
              : <div className={cls}>{body}</div>}
          </li>
        );
      })}
    </ol>
  );
}
