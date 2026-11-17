import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CAPTION_BASE, CAPTION_LOOK } from '@/lib/clipAss';
import { drawTitle, TITLE_TOP } from '@/lib/clipTitle';
import { cn } from '@/lib/cn';
import type { Caption, CaptionAnimId, CaptionStyleId, LayoutId, TitleStyleId } from '@/types/clips';

export interface PlayerClip {
  start_s: number;
  end_s: number;
  title: string;
  show_title: boolean;
  captions: Caption[];
  caption_style: CaptionStyleId;
  layout: LayoutId;
  caption_size: number;
  caption_pos: number;
  caption_anim: CaptionAnimId;
  title_style: TitleStyleId;
}

// Sizes are expressed in 720-px-wide frame units so the preview matches the export (src/lib/clipAss.ts).
const u = (px: number) => `calc(${px} / 720 * 100cqw)`;
/** caption look in the preview, mirroring buildClipAss (src/lib/clipAss.ts) */
function captionCss(style: CaptionStyleId, size: number): CSSProperties {
  const look = CAPTION_LOOK[style];
  const px = CAPTION_BASE * look.scale * (size / 100);
  return look.box
    ? { color: look.color, fontSize: u(px), background: 'rgba(0,0,0,.6)', padding: `${u(px * 0.12)} ${u(px * 0.26)}`, borderRadius: u(8), boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }
    : { color: look.color, fontSize: u(px), textTransform: look.upper ? 'uppercase' : undefined, WebkitTextStroke: `${u(look.outline * 2 * (size / 100))} #000`, paintOrder: 'stroke fill' };
}

/** the title image (same PNG as the export) as a data URL */
function useTitleImage(title: string, style: TitleStyleId, show: boolean) {
  const [img, setImg] = useState<{ url: string; h: number } | null>(null);
  useEffect(() => {
    let off = false;
    if (!show || !title.trim()) { setImg(null); return; }
    const t = setTimeout(() => { void drawTitle(title, style).then((c) => { if (!off) setImg(c ? { url: c.toDataURL('image/png'), h: c.height } : null); }); }, 120);
    return () => { off = true; clearTimeout(t); };
  }, [title, style, show]);
  return img;
}

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
  const titleImg = useTitleImage(clip.title, clip.title_style, clip.show_title);
  const look = CAPTION_LOOK[clip.caption_style];
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

      {titleImg && (
        <img src={titleImg.url} alt="" className="pointer-events-none absolute inset-x-0 w-full" style={{ top: u(TITLE_TOP) }} />
      )}
      {caption && (
        <div className="pointer-events-none absolute inset-x-0 flex justify-center px-[9.7%] text-center" style={{ bottom: u(clip.caption_pos) }}>
          <p key={clip.caption_anim === 'none' ? 'static' : caption.start} className={cn('font-extrabold leading-[1.15]', clip.caption_anim !== 'none' && 'motion-safe:animate-[clippop_0.11s_ease-out]')}
            style={{ ...captionCss(clip.caption_style, clip.caption_size), display: 'inline' }}>
            {clip.caption_anim === 'karaoke' && caption.words?.length
              ? caption.words.map((w, i) => <span key={i} style={{ color: t >= w.s && t < w.e ? look.hi : undefined }}>{i ? ' ' : ''}{w.w}</span>)
              : caption.text}
          </p>
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
