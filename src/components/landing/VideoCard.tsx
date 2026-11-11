import { Play } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { posterSrc, previewSrc, type ShowcaseVideo } from '@/data/showcase';
import { useInView } from '@/hooks/useInView';
import { cn } from '@/lib/cn';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Phone-shaped card: silent 6s loop while visible, opens the full episode on click. */
export function VideoCard({ video, onOpen, className, compact }: { video: ShowcaseVideo; onOpen: () => void; className?: string; compact?: boolean }) {
  const { ref, inView } = useInView<HTMLButtonElement>(0.4);
  const vid = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = vid.current;
    if (!v || reducedMotion()) return;
    if (inView) v.play().catch(() => {});
    else v.pause();
  }, [inView]);

  return (
    <button ref={ref} onClick={onOpen}
      className={cn('group relative block aspect-[9/16] w-full overflow-hidden rounded-2xl border border-white/10 bg-ink-850 text-left shadow-2xl transition hover:border-violet-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60', className)}>
      <video ref={vid} src={previewSrc(video.slug)} poster={posterSrc(video.slug)} muted loop playsInline preload="none"
        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />
      <span className="absolute left-2.5 top-2.5 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">{video.format}</span>
      {!compact && <span className="absolute right-2.5 top-2.5 rounded-full bg-black/50 px-2 py-0.5 text-[11px] tabular-nums text-white backdrop-blur">{Math.floor(video.seconds / 60)}:{String(video.seconds % 60).padStart(2, '0')}</span>}
      <span className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink-950 opacity-0 shadow-xl transition group-hover:opacity-100 group-focus-visible:opacity-100">
        <Play className="ml-0.5 h-5 w-5" />
      </span>
      {/* Accessible name = visible text (format, duration, title) + the action. */}
      <span className="sr-only">Watch {compact ? video.title : ''}</span>
      {!compact && (
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">{video.title}</p>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-white/70">{video.hook}</p>
        </div>
      )}
    </button>
  );
}
