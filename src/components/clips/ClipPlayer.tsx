import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { wrapTitle } from '@/lib/clipAss';
import { cn } from '@/lib/cn';
import type { Caption, CaptionStyleId, LayoutId } from '@/types/clips';

export interface PlayerClip {
  start_s: number;
  end_s: number;
  title: string;
  show_title: boolean;
  captions: Caption[];
  caption_style: CaptionStyleId;
  layout: LayoutId;
}

// Sizes are expressed in 720-px-wide frame units so the preview matches the export (src/lib/clipAss.ts).
const u = (px: number) => `calc(${px} / 720 * 100cqw)`;
const CAPTION_CSS: Record<CaptionStyleId, CSSProperties> = {
  bold: { color: '#fff', fontSize: u(68), textTransform: 'uppercase', WebkitTextStroke: `${u(12)} #000`, paintOrder: 'stroke fill' },
  pop: { color: '#FFE14D', fontSize: u(68), textTransform: 'uppercase', WebkitTextStroke: `${u(12)} #000`, paintOrder: 'stroke fill' },
  clean: { color: '#fff', fontSize: u(52), background: 'rgba(0,0,0,.6)', padding: `${u(6)} ${u(14)}`, borderRadius: u(6), boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' },
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** AI clipping: 9:16 preview of a clip: plays [start, end] in a loop with the title and live captions on top. */
export function ClipPlayer({ src, clip, className, compact, onTime }: { src: string; clip: PlayerClip; className?: string; compact?: boolean; onTime?: (t: number) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const bg = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [t, setT] = useState(clip.start_s);
  const { start_s: start, end_s: end } = clip;

  // Jump to the clip start when it loads or the trim changes.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const seek = () => { if (v.currentTime < start || v.currentTime > end) { v.currentTime = start; setT(start); } };
    if (v.readyState >= 1) seek(); else v.addEventListener('loadedmetadata', seek, { once: true });
  }, [src, start, end]);

  // Frame-accurate caption timing while playing (timeupdate is too coarse for 1–4 word chunks).
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = video.current;
      if (v) {
        if (v.currentTime >= end || v.currentTime < start - 0.5) v.currentTime = start;
        setT(v.currentTime);
        onTime?.(v.currentTime);
        if (bg.current && Math.abs(bg.current.currentTime - v.currentTime) > 0.3) bg.current.currentTime = v.currentTime;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, start, end, onTime]);

  useEffect(() => {
    const b = bg.current;
    if (!b) return;
    if (playing) b.play().catch(() => {}); else b.pause();
  }, [playing, clip.layout]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) { if (v.currentTime >= end) v.currentTime = start; v.play().catch(() => setPlaying(false)); } else v.pause();
  };

  const caption = clip.captions.find((c) => t >= c.start && t < c.end);
  const progress = Math.min(1, Math.max(0, (t - start) / Math.max(0.1, end - start)));

  return (
    <div className={cn('group relative aspect-[9/16] w-full overflow-hidden rounded-2xl bg-black', className)} style={{ containerType: 'inline-size', fontFamily: "'Clip Caption', Inter, sans-serif" }}>
      {clip.layout === 'fit' && (
        <video ref={bg} src={src} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1}
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-80 blur-xl" />
      )}
      <video ref={video} src={src} muted={muted} playsInline preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        className={cn('absolute inset-0 h-full w-full', clip.layout === 'fill' ? 'object-cover' : 'object-contain')} />

      {clip.show_title && clip.title.trim() && (
        <div className="pointer-events-none absolute inset-x-0 flex justify-center px-[9.7%]" style={{ top: u(150) }}>
          <p className="whitespace-pre-line text-center font-extrabold leading-[1.15] text-zinc-900"
            style={{ fontSize: u(50), background: '#fff', padding: `${u(4)} ${u(16)}`, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', display: 'inline' }}>
            {wrapTitle(clip.title)}
          </p>
        </div>
      )}
      {caption && (
        <div className="pointer-events-none absolute inset-x-0 flex justify-center px-[8.3%] text-center" style={{ bottom: u(330) }}>
          <p className="font-extrabold leading-[1.15]" style={{ ...CAPTION_CSS[clip.caption_style], display: 'inline' }}>{caption.text}</p>
        </div>
      )}

      <button onClick={toggle} aria-label={playing ? 'Mettre l’aperçu en pause' : 'Lire l’aperçu'} style={{ touchAction: 'manipulation' }}
        className={cn('absolute inset-0 grid place-items-center transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400',
          playing ? 'opacity-0 hover:opacity-100 focus-visible:opacity-100' : 'opacity-100')}>
        <span className={cn('grid place-items-center rounded-full bg-black/55 text-white backdrop-blur', compact ? 'h-10 w-10' : 'h-14 w-14')}>
          {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </span>
      </button>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-6">
        <div className="h-1 overflow-hidden rounded-full bg-white/25"><div className="h-full origin-left bg-white" style={{ transform: `scaleX(${progress})` }} /></div>
        {!compact && <p className="mt-1 text-[10px] tabular-nums text-white/80">{fmt(t - start)} / {fmt(end - start)}</p>}
      </div>
      {!compact && (
        <button onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Remettre le son' : 'Couper le son'}
          className="absolute right-2 top-2 rounded-full bg-black/50 p-2 text-white backdrop-blur transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}
