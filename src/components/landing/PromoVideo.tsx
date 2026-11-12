import { Play, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useInView } from '@/hooks/useInView';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The 18-second Storyit promo film: plays silently while visible; one tap restarts it with sound. */
export function PromoVideo({ className = 'relative mx-auto max-w-5xl px-4 pb-2 pt-8 md:px-6 md:pt-12' }: { className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.35);
  const vid = useRef<HTMLVideoElement>(null);
  const [sound, setSound] = useState(false);

  useEffect(() => {
    const v = vid.current;
    if (!v) return;
    if (inView && !reducedMotion()) v.play().catch(() => {});
    else if (!inView) v.pause();
  }, [inView]);

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
    <section id="film" aria-labelledby="film-title" className={className}>
      <h2 id="film-title" className="sr-only">Storyit in 18 seconds</h2>
      <div ref={ref} className="group relative overflow-hidden rounded-3xl border border-line/10 bg-black shadow-[0_40px_120px_-40px_rgba(124,58,237,0.55)]">
        <video ref={vid} src="/showcase/storyit-promo.mp4" poster="/showcase/storyit-promo.webp" muted loop playsInline preload="metadata"
          width={1920} height={1080} className="aspect-video w-full object-cover" aria-label="Storyit promo film" />
        {!sound ? (
          <button type="button" onClick={withSound}
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/50 via-transparent to-transparent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-violet-500/60">
            <span className="flex items-center gap-2.5 rounded-full bg-white/95 py-2.5 pl-3 pr-5 text-sm font-semibold text-zinc-900 shadow-2xl transition group-hover:scale-105">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-violet-600 text-white"><Play className="ml-0.5 h-4 w-4" aria-hidden /></span>
              Watch with sound · 18 s
            </span>
          </button>
        ) : (
          <button type="button" onClick={toggle} aria-label={vid.current?.muted ? 'Turn the sound on' : 'Mute'}
            className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
            {vid.current?.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        )}
      </div>
    </section>
  );
}
