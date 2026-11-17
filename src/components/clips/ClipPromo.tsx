import { Flame, Mic, Play, Scissors } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/** Illustration of the AI clipping (one long video → vertical clips with a TikTok title and karaoke captions).
 *  Pure CSS, decorative: shared by the dashboard card and the landing section. */

const CLIPS = {
  fr: [
    { title: 'Personne ne te dit ça quand tu débutes', words: ['ET', 'LÀ', 'IL', 'ME', 'DIT'], score: 94, bg: 'from-violet-600/70 via-fuchsia-700/40 to-ink-950' },
    { title: 'J’ai tout perdu en 24 heures', words: ['C’ÉTAIT', 'DÉJÀ', 'TROP', 'TARD'], score: 88, bg: 'from-coral-500/60 via-violet-700/40 to-ink-950' },
    { title: 'La vraie raison de mon succès', words: ['LA', 'VRAIE', 'RAISON', 'C’EST'], score: 81, bg: 'from-amber-400/50 via-coral-500/30 to-ink-950' },
  ],
  en: [
    { title: 'Nobody tells you this when you start', words: ['AND', 'THEN', 'HE', 'SAID'], score: 94, bg: 'from-violet-600/70 via-fuchsia-700/40 to-ink-950' },
    { title: 'I lost everything in 24 hours', words: ['IT', 'WAS', 'TOO', 'LATE'], score: 88, bg: 'from-coral-500/60 via-violet-700/40 to-ink-950' },
    { title: 'The real reason I made it', words: ['THE', 'REAL', 'REASON', 'IS'], score: 81, bg: 'from-amber-400/50 via-coral-500/30 to-ink-950' },
  ],
};
/** where the 3 moments sit on the long video's timeline (% from the start, % width) */
const MOMENTS = [[12, 9], [44, 7], [73, 10]] as const;

function useTick(ms: number) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setT((n) => n + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return t;
}

/** a speaker silhouette, so the frames read as a talking-head video */
function Speaker({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <circle cx="50" cy="38" r="17" fill="currentColor" />
      <path d="M14 100 C 16 70, 34 60, 50 60 C 66 60, 84 70, 86 100 Z" fill="currentColor" />
    </svg>
  );
}

export function ClipPhone({ clip, tick, className }: { clip: (typeof CLIPS)['fr'][number]; tick: number; className?: string }) {
  const active = tick % clip.words.length;
  return (
    <div className={cn('relative aspect-[9/16] overflow-hidden rounded-2xl [container-type:inline-size] border border-white/15 bg-ink-950 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)]', className)}>
      <div className={cn('absolute inset-0 bg-gradient-to-b', clip.bg)} />
      <Speaker className="absolute bottom-0 left-1/2 w-[82%] -translate-x-1/2 text-black/45" />
      {/* TikTok "classic" title: black text on a white band */}
      <p className="absolute inset-x-[8%] top-[18%] text-center text-[8.5cqw] font-extrabold leading-[1.55]">
        <span className="box-decoration-clone rounded-[4px] bg-white px-1.5 py-0.5 text-zinc-950">{clip.title}</span>
      </p>
      {/* karaoke caption: the spoken word lights up */}
      <p className="absolute inset-x-[6%] bottom-[22%] text-center font-display text-[11cqw] font-extrabold uppercase leading-tight text-white [text-shadow:0_2px_0_#000,0_0_6px_#000]">
        {clip.words.slice(Math.max(0, active - 1), active + 2).map((w, i, arr) => {
          const isActive = arr.length === 3 ? i === 1 : (active === 0 ? i === 0 : i === arr.length - 1);
          return <span key={w + i} className={cn('mx-[2px] inline-block transition-transform duration-150', isActive && 'scale-110 text-amber-300')}>{w}</span>;
        })}
      </p>
      <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-white">
        <Flame className="h-2.5 w-2.5 text-coral-400" aria-hidden />{clip.score}
      </span>
    </div>
  );
}

/** long 16:9 video with its timeline → 3 vertical clips */
export function ClipVisual({ fr = true, compact = false, className }: { fr?: boolean; compact?: boolean; className?: string }) {
  const clips = CLIPS[fr ? 'fr' : 'en'];
  const tick = useTick(480);
  return (
    <div aria-hidden className={cn('relative grid items-center gap-4', compact ? 'sm:grid-cols-[1fr_auto]' : 'mx-auto w-full max-w-[480px]', className)}>
      <div className={cn('min-w-0', !compact && 'mx-auto w-full max-w-[380px]')}>
        <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-zinc-800 via-ink-900 to-ink-950">
          <Speaker className="absolute bottom-0 left-[18%] w-[34%] text-white/[0.07]" />
          <Speaker className="absolute bottom-0 right-[14%] w-[30%] text-white/[0.05]" />
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white"><Mic className="h-3 w-3 text-violet-300" />Podcast · 42:18</span>
          <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/15 backdrop-blur"><Play className="h-4 w-4 translate-x-px fill-white text-white" /></span>
        </div>
        {/* timeline: the AI marks the best moments */}
        <div className="relative mt-3 h-6 rounded-md bg-white/[0.06]">
          <div className="absolute inset-x-1 top-1/2 flex h-3 -translate-y-1/2 items-center gap-[2px] overflow-hidden">
            {Array.from({ length: 64 }, (_, i) => (
              <span key={i} className="w-full rounded-full bg-white/15" style={{ height: `${30 + Math.abs(Math.sin(i * 1.7) * 70)}%` }} />
            ))}
          </div>
          {MOMENTS.map(([left, width], i) => (
            <span key={i} className={cn('absolute inset-y-0 rounded-md border-2 border-fuchsia-400 bg-fuchsia-500/25 transition-shadow', tick % 3 === i && 'shadow-[0_0_16px_rgba(217,70,239,0.8)]')}
              style={{ left: `${left}%`, width: `${width}%` }} />
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-400"><Scissors className="h-3 w-3 text-fuchsia-300" />{fr ? '3 moments forts trouvés par l’IA' : '3 best moments found by the AI'}</p>
      </div>
      <div className={cn('flex justify-center gap-2', compact ? 'w-full sm:w-[300px]' : 'w-full')}>
        {clips.map((c, i) => (
          <ClipPhone key={c.title} clip={c} tick={tick + i} className={cn('w-1/3', i === 1 ? '-translate-y-2' : 'translate-y-2')} />
        ))}
      </div>
    </div>
  );
}
