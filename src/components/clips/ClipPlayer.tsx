import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CAPTION_BASE, CAPTION_LOOK, CLIP_FRAME, wordTimeline } from '@/lib/clipAss';
import { drawPlan, planLayout } from '@/lib/clipLayout';
import { drawTitle } from '@/lib/clipTitle';
import { cn } from '@/lib/cn';
import type { Caption, CaptionAnimId, CaptionStyleId, ClipFraming, LayoutId, TitleStyleId } from '@/types/clips';

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
  framing?: ClipFraming | null;
  divider?: boolean;
}

// Sizes are expressed in 720-px-wide frame units so the preview matches the export (src/lib/clipAss.ts).
const u = (px: number) => `calc(${px} / 720 * 100cqw)`;
/** caption look in the preview, mirroring buildClipAss (src/lib/clipAss.ts) */
function captionCss(style: CaptionStyleId, size: number): CSSProperties {
  const look = CAPTION_LOOK[style];
  const px = CAPTION_BASE * look.scale * (size / 100);
  return look.box
    ? { color: look.color, fontSize: u(px), background: 'rgba(0,0,0,.6)', padding: `${u(px * 0.12)} ${u(px * 0.26)}`, borderRadius: u(8), boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }
    : { color: look.color, fontSize: u(px), textTransform: look.upper ? 'uppercase' : undefined, WebkitTextStroke: `${u(look.outline * 2 * (size / 100))} #000`, paintOrder: 'stroke fill',
        ...(look.font === 'word' ? { fontFamily: "'Clip Word', Impact, sans-serif", fontWeight: 400, letterSpacing: '0.01em' } : {}) };
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

/** AI clipping: 9:16 preview of a clip: plays [start, end] in a loop, drawn with the same layout plan as the export
 *  (src/lib/clipLayout.ts) on a canvas, with the title and live captions on top. */
export function ClipPlayer({ src, clip, className, compact, onTime }: { src: string; clip: PlayerClip; className?: string; compact?: boolean; onTime?: (t: number) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const blur = useRef<HTMLCanvasElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [t, setT] = useState(clip.start_s);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const { start_s: start, end_s: end } = clip;
  const framing = clip.framing ?? null;
  const divider = clip.divider ?? true;

  const plan = useMemo(() => (size ? planLayout(clip.layout, framing, size.w, size.h, start) : null), [clip.layout, framing, size, start]);

  // Jump to the clip start when it loads or the trim changes.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const ready = () => { setSize({ w: v.videoWidth, h: v.videoHeight }); if (v.currentTime < start || v.currentTime > end) { v.currentTime = start; setT(start); } };
    if (v.readyState >= 1) ready(); else v.addEventListener('loadedmetadata', ready, { once: true });
  }, [src, start, end]);

  // draws the current frame: while playing every animation frame, otherwise after each seek
  const paint = useRef<() => void>(() => {});
  paint.current = () => {
    const v = video.current, c = canvas.current;
    if (!v || !c || !plan) return;
    blur.current ??= Object.assign(document.createElement('canvas'), { width: 36, height: 64 });
    drawPlan(c.getContext('2d')!, v, plan, v.currentTime - start, divider, blur.current);
  };
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const draw = () => paint.current();
    v.addEventListener('seeked', draw); v.addEventListener('loadeddata', draw);
    draw();
    return () => { v.removeEventListener('seeked', draw); v.removeEventListener('loadeddata', draw); };
  }, [plan, divider]);

  // Frame-accurate caption timing while playing (timeupdate is too coarse for 1-word captions).
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = video.current;
      if (v) {
        if (v.currentTime >= end || v.currentTime < start - 0.5) v.currentTime = start;
        setT(v.currentTime);
        onTime?.(v.currentTime);
        paint.current();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, start, end, onTime]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) { if (v.currentTime >= end) v.currentTime = start; v.play().catch(() => setPlaying(false)); } else v.pause();
  };

  const words = useMemo(() => (clip.caption_anim === 'word' ? wordTimeline(clip.captions) : null), [clip.caption_anim, clip.captions]);
  const word = words?.find((w) => t >= w.s && t < w.e);
  const caption = words ? null : clip.captions.find((c) => t >= c.start && t < c.end);
  const titleImg = useTitleImage(clip.title, clip.title_style, clip.show_title);
  const look = CAPTION_LOOK[clip.caption_style];
  const progress = Math.min(1, Math.max(0, (t - start) / Math.max(0.1, end - start)));
  const titleTop = plan && titleImg ? Math.max(0, plan.titleY - titleImg.h / 2) : 0;

  return (
    <div className={cn('group relative aspect-[9/16] w-full overflow-hidden rounded-2xl bg-black', className)} style={{ containerType: 'inline-size', fontFamily: "'Clip Caption', Inter, sans-serif" }}>
      <video ref={video} src={src} muted={muted} playsInline preload="auto"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} className="pointer-events-none absolute h-px w-px opacity-0" aria-hidden="true" tabIndex={-1} />
      <canvas ref={canvas} width={CLIP_FRAME.w} height={CLIP_FRAME.h} className="absolute inset-0 h-full w-full" aria-label="Aperçu du clip" role="img" />

      {titleImg && plan && (
        <img src={titleImg.url} alt="" className="pointer-events-none absolute inset-x-0 w-full" style={{ top: u(titleTop) }} />
      )}
      {(word || caption) && (
        <div className="pointer-events-none absolute inset-x-0 flex justify-center px-[9.7%] text-center" style={{ bottom: u(clip.caption_pos) }}>
          {word ? (
            <p key={word.s} className="leading-[1.1] motion-safe:animate-[clippop_0.11s_ease-out]" style={{ ...captionCss(clip.caption_style, clip.caption_size), display: 'inline', ...(word.hi ? { color: look.hi } : {}) }}>{word.text}</p>
          ) : caption && (
            <p key={clip.caption_anim === 'none' ? 'static' : caption.start} className={cn('font-extrabold leading-[1.15]', clip.caption_anim !== 'none' && 'motion-safe:animate-[clippop_0.11s_ease-out]')}
              style={{ ...captionCss(clip.caption_style, clip.caption_size), display: 'inline' }}>
              {caption.words?.length && (clip.caption_anim === 'karaoke' || caption.words.some((w) => w.hi))
                ? caption.words.map((w, i) => <span key={i} style={{ color: (clip.caption_anim === 'karaoke' && t >= w.s && t < w.e) || w.hi ? look.hi : undefined }}>{i ? ' ' : ''}{w.w}</span>)
                : caption.text}
            </p>
          )}
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
