import { Play, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useInView } from '@/hooks/useInView';
import { useLang } from '@/lib/lang';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The 18-second Storyit promo film: plays silently while visible; one tap restarts it with sound. */
export function PromoVideo({ className = 'relative mx-auto max-w-5xl px-4 pb-2 pt-8 md:px-6 md:pt-12', poster = '/showcase/storyit-promo.webp', frameClassName = 'border border-line/10', autoPlay = true, videoClassName = 'aspect-video w-full object-cover', neon = false, style }: { className?: string; style?: React.CSSProperties; poster?: string; frameClassName?: string; autoPlay?: boolean; videoClassName?: string; neon?: boolean }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.35);
  const vid = useRef<HTMLVideoElement>(null);
  const fr = useLang() === 'fr';
  const [sound, setSound] = useState(false);

  useEffect(() => {
    const v = vid.current;
    if (!v) return;
    if (inView && autoPlay && !reducedMotion()) v.play().catch(() => {});
    else if (!inView) v.pause();
  }, [inView, autoPlay]);

  const withSound = () => {
    const v = vid.current;
    if (!v) return;
    v.muted = false; v.currentTime = 0; setSound(true);
    void v.play().catch(() => {});
  };
  const toggle = () => {
    const v = vid.current;
    if (!v) return;
    v.muted = !v.muted; setSound(!v.muted);
    if (v.paused) void v.play().catch(() => {});
  };

  return (
    <section id="film" aria-labelledby="film-title" className={className} style={style}>
      <h2 id="film-title" className="sr-only">{fr ? 'Storyit en 18 secondes' : 'Storyit in 18 seconds'}</h2>
      <div ref={ref} className={`group relative overflow-hidden rounded-3xl bg-black shadow-[0_40px_120px_-40px_rgba(124,58,237,0.55)] ${frameClassName}`}>
        <video ref={vid} src="/showcase/storyit-promo.mp4" poster={poster} muted loop playsInline preload="metadata"
          width={1920} height={1080} className={videoClassName} aria-label={fr ? 'Film de présentation Storyit' : 'Storyit promo film'} />
        {!sound ? (
          <button type="button" onClick={withSound}
            className={`absolute inset-0 flex items-center justify-center ${neon ? '' : 'bg-gradient-to-t from-black/50 via-transparent to-transparent'} focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-violet-500/60`}>
            <span className={neon
              ? 'absolute left-1/2 top-[54%] flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 whitespace-nowrap rounded-full border border-white/15 bg-[#1b0f33]/85 py-1.5 pl-1.5 pr-5 text-sm font-semibold text-white shadow-[0_0_30px_-6px_rgba(168,85,247,0.9)] backdrop-blur transition group-hover:scale-105'
              : 'flex items-center gap-2.5 rounded-full bg-white/95 py-2.5 pl-3 pr-5 text-sm font-semibold text-zinc-900 shadow-2xl transition group-hover:scale-105'}>
              <span className={neon ? 'grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white ring-2 ring-white/80' : 'grid h-9 w-9 place-items-center rounded-full bg-violet-600 text-white'}><Play className="ml-0.5 h-4 w-4" aria-hidden fill={neon ? 'currentColor' : 'none'} /></span>
              {fr ? 'Regarder avec le son · 18 s' : 'Watch with sound · 18 s'}
            </span>
          </button>
        ) : (
          <button type="button" onClick={toggle} aria-label={vid.current?.muted ? (fr ? 'Activer le son' : 'Turn the sound on') : (fr ? 'Couper le son' : 'Mute')}
            className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
            {vid.current?.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        )}
      </div>
    </section>
  );
}
