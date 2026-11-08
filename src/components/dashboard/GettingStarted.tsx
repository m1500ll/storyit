import { Check, PartyPopper, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import type { StoryWithScenes } from '@/types/domain';
import { ProgressBar } from '../ui';

const DISMISS_KEY = 'storyit:getting-started-dismissed';

interface Step { label: string; done: boolean; to?: string; hint: string }

/**
 * Activation checklist. Step 1 is already done on purpose (endowed progress: users finish
 * faster when they start ahead). Hidden once every step is complete or the user dismisses it.
 */
export function GettingStarted({ stories }: { stories: StoryWithScenes[] }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  const latest = stories[0];
  const rendered = stories.some((s) => s.scenes.length > 0 && s.scenes.every((sc) => sc.status === 'generated'));
  const approved = stories.some((s) => Boolean(s.approved_at) || s.status === 'published');
  const steps: Step[] = [
    { label: 'Create your studio', done: true, hint: 'Free plan active' },
    { label: 'Turn an idea into a storyboard', done: stories.length > 0, to: '/app/new', hint: '≈ 1 minute' },
    { label: 'Render your first episode', done: rendered, to: latest ? `/app/stories/${latest.id}` : '/app/new', hint: 'Clips + voice-over' },
    { label: 'Approve & download the MP4', done: approved, to: latest ? `/app/stories/${latest.id}` : '/app/new', hint: 'Ready to post' },
  ];
  const completed = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode: dismiss for this visit only */ }
  };

  if (!next) {
    return (
      <div className="surface flex items-center gap-4 border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <PartyPopper className="h-6 w-6 shrink-0 text-emerald-300" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-zinc-100">Your first episode is ready to post 🎉</p>
          <p className="text-xs text-zinc-400">Post daily to grow faster — your next idea is one sentence away.</p>
        </div>
        <button onClick={dismiss} aria-label="Hide checklist" className="touch-hit rounded-lg p-1.5 text-zinc-500 hover:bg-line/5 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"><X className="h-4 w-4" /></button>
      </div>
    );
  }

  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-zinc-100">Getting started</p>
          <p className="text-xs text-zinc-500">{completed} of {steps.length} done — you’re on your way.</p>
        </div>
        <button onClick={dismiss} aria-label="Hide checklist" className="touch-hit rounded-lg p-1.5 text-zinc-500 hover:bg-line/5 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-3"><ProgressBar value={completed} max={steps.length} /></div>
      <ol className="mt-4 space-y-1">
        {steps.map((s) => {
          const isNext = s === next;
          const body = (
            <>
              <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px]',
                s.done ? 'border-violet-500 bg-violet-500 text-white' : isNext ? 'border-violet-400' : 'border-line/15')}>
                {s.done && <Check className="h-3 w-3" />}
              </span>
              <span className={cn('flex-1 text-sm', s.done ? 'text-zinc-500 line-through' : isNext ? 'font-medium text-zinc-100' : 'text-zinc-400')}>{s.label}</span>
              <span className="text-[11px] text-zinc-500">{s.hint}</span>
            </>
          );
          return (
            <li key={s.label}>
              {isNext && s.to
                ? <Link to={s.to} className="flex items-center gap-3 rounded-lg bg-violet-500/[0.07] px-2 py-2 ring-1 ring-violet-500/20 transition hover:bg-violet-500/[0.12]">{body}</Link>
                : <div className="flex items-center gap-3 px-2 py-2">{body}</div>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
