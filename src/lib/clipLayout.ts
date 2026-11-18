import type { ClipFraming, LayoutId } from '@/types/clips';
import { CLIP_FRAME } from './clipAss';

/** AI clipping: where each piece of the source video goes in the 720×1280 vertical frame, for every layout.
 *  The preview (ClipPlayer, canvas) and the export (ffmpeg.ts, filter graph) both draw this plan, so they match. */

export interface Rect { x: number; y: number; w: number; h: number }
/** `follow`: for the speaker-tracking layout, the crop centre over time (clip seconds from the clip start) */
export interface Panel { src: Rect; dst: Rect; follow?: { t: number; x: number }[] }
export interface LayoutPlan {
  /** the layout actually drawn ("auto" resolved) */
  layout: Exclude<LayoutId, 'auto'>;
  bg: 'blur' | 'black';
  panels: Panel[];
  /** y of the neon lines between stacked panels */
  dividers: number[];
  /** vertical centre of the title in the frame: on the top edge of the video, or on the line between two panels */
  titleY: number;
}

const { w: FW, h: FH } = CLIP_FRAME;
const r = (n: number) => Math.round(n);
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** `rect` grown or shrunk around its centre to `aspect` (w/h), kept inside a W×H frame */
export function fitAspect(rect: Rect, aspect: number, W: number, H: number): Rect {
  let { w, h } = rect;
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  if (w > W) { w = W; h = w / aspect; }
  if (h > H) { h = H; w = h * aspect; }
  // even sizes (H.264 friendly), rounded down so the crop never pokes out of the frame
  const ew = Math.max(2, Math.floor(w / 2) * 2), eh = Math.max(2, Math.floor(h / 2) * 2);
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const x = Math.min(Math.max(0, Math.round(cx - ew / 2)), W - ew);
  const y = Math.min(Math.max(0, Math.round(cy - eh / 2)), H - eh);
  return { x, y, w: ew, h: eh };
}

/** the centred crop of a W×H source at `aspect` */
const centre = (W: number, H: number, aspect: number) => fitAspect({ x: 0, y: 0, w: W, h: H }, aspect, W, H);

/** the largest crop at `aspect` that stays INSIDE `rect` (a facecam: never show the game around it), kept on the
 *  upper part where the face is */
export function fitInside(rect: Rect, aspect: number): Rect {
  let w = rect.w, h = rect.h;
  if (w / h > aspect) w = h * aspect; else h = w / aspect;
  const ew = Math.max(2, Math.floor(w / 2) * 2), eh = Math.max(2, Math.floor(h / 2) * 2);
  return { x: Math.round(rect.x + (rect.w - ew) / 2), y: Math.round(rect.y + (rect.h - eh) * 0.35), w: ew, h: eh };
}

/** The gameplay crop: the biggest view at `aspect` that does not show the facecams a second time (their detected box
 *  is guessed from the face, so a margin is kept). Tries full-height crops slid sideways, then crops above or below
 *  the cams; falls back to the centre. */
export function gameplayCrop(W: number, H: number, aspect: number, found: Rect[]): Rect {
  const cams = found.map((c) => ({ x: c.x - c.w * 0.3, y: c.y - c.h * 0.15, w: c.w * 1.6, h: c.h * 1.3 }));
  const hits = (q: Rect) => cams.some((c) => q.x < c.x + c.w && q.x + q.w > c.x && q.y < c.y + c.h && q.y + q.h > c.y);
  const centred = centre(W, H, aspect);
  if (!hits(centred)) return centred;
  const candidates: Rect[] = [];
  const bands = [{ y0: 0, y1: H }, ...cams.flatMap((c) => [{ y0: c.y + c.h, y1: H }, { y0: 0, y1: c.y }])]
    .map((b) => ({ y0: Math.max(0, b.y0), y1: Math.min(H, b.y1) })).filter((b) => b.y1 - b.y0 >= H * 0.55);
  for (const b of bands) {
    const h = Math.min(b.y1 - b.y0, W / aspect), w = h * aspect;
    const xs = [W / 2 - w / 2, ...cams.flatMap((c) => [c.x - w, c.x + c.w])].filter((x) => x >= 0 && x + w <= W);
    for (const x of xs) {
      const q = { x: Math.round(x), y: Math.round(b.y0 + (b.y1 - b.y0 - h) / 2), w: Math.floor(w / 2) * 2, h: Math.floor(h / 2) * 2 };
      if (!hits(q)) candidates.push(q);
    }
  }
  if (!candidates.length) return centred;
  // biggest first, then closest to the middle of the frame
  return candidates.sort((a, b) => b.w * b.h - a.w * a.h || Math.abs(a.x + a.w / 2 - W / 2) - Math.abs(b.x + b.w / 2 - W / 2))[0]!;
}

/** what "auto" becomes for this video */
export function resolveLayout(layout: LayoutId, framing: ClipFraming | null, W: number, H: number): Exclude<LayoutId, 'auto'> {
  const portrait = W / H < 0.75;
  if (layout !== 'auto') {
    if (layout === 'split' && !framing?.cams.length) return portrait ? 'fill' : 'zoom';
    if (layout === 'stack' && (framing?.cams.length ?? 0) < 2) return framing?.cams.length ? 'split' : portrait ? 'fill' : 'zoom';
    return layout;
  }
  if (portrait) return framing?.kind === 'people' ? 'track' : 'fill';
  if (framing?.kind === 'two_cams' && framing.cams.length >= 2) return 'stack';
  if (framing?.kind === 'facecam' && framing.cams.length) return 'split';
  if (framing?.kind === 'people') return 'track';
  return 'zoom';
}

/** `clipStart`: the clip's start on the source timeline (the tracking cuts were found from `framing.start`) */
export function planLayout(layout: LayoutId, framing: ClipFraming | null, W: number, H: number, clipStart = framing?.start ?? 0): LayoutPlan {
  const kind = resolveLayout(layout, framing, W, H);
  const full: Rect = { x: 0, y: 0, w: FW, h: FH };
  switch (kind) {
    case 'fill':
      return { layout: kind, bg: 'black', panels: [{ src: centre(W, H, FW / FH), dst: full }], dividers: [], titleY: 300 };
    case 'fit': {
      const s = Math.min(FW / W, FH / H);
      const dst = { x: r((FW - W * s) / 2), y: r((FH - H * s) / 2), w: even(W * s), h: even(H * s) };
      return { layout: kind, bg: 'blur', panels: [{ src: { x: 0, y: 0, w: W, h: H }, dst }], dividers: [], titleY: Math.max(120, dst.y) };
    }
    case 'zoom': {
      // zoomed to 4:5 (bigger than a whole 16:9 image) in the middle, on a blurred copy
      const dst = { x: 0, y: 190, w: FW, h: 900 };
      return { layout: kind, bg: 'blur', panels: [{ src: centre(W, H, dst.w / dst.h), dst }], dividers: [], titleY: dst.y };
    }
    case 'track': {
      const src = centre(W, H, FW / FH);
      const shift = clipStart - (framing?.start ?? clipStart);
      const segs = (framing?.segments ?? []).map((s) => ({ t: s.t - shift, x: r(Math.min(Math.max(0, s.cx - src.w / 2), W - src.w)) }));
      // the cut in effect at the clip start becomes the first one
      const before = segs.filter((s) => s.t <= 0);
      const follow = [...(before.length ? [{ t: 0, x: before[before.length - 1]!.x }] : []), ...segs.filter((s) => s.t > 0)];
      return { layout: kind, bg: 'black', panels: [{ src: follow.length ? { ...src, x: follow[0]!.x } : src, dst: full, follow: follow.length > 1 ? follow : undefined }], dividers: [], titleY: 300 };
    }
    case 'split': {
      // the facecam on top (its own shape, 27 to 50 % of the height), the gameplay below
      const cam = framing!.cams[0]!;
      const top = even(Math.min(640, Math.max(340, FW / (cam.w / cam.h))));
      const camDst = { x: 0, y: 0, w: FW, h: top };
      const gameDst = { x: 0, y: top, w: FW, h: FH - top };
      return { layout: kind, bg: 'black', dividers: [top], titleY: top,
        panels: [{ src: fitInside(cam, camDst.w / camDst.h), dst: camDst }, { src: gameplayCrop(W, H, gameDst.w / gameDst.h, [cam]), dst: gameDst }] };
    }
    case 'stack': {
      // two facecams (left one first) then the gameplay on the bottom half
      const cams = [...framing!.cams].slice(0, 2).sort((a, b) => a.x - b.x);
      const dsts = [{ x: 0, y: 0, w: FW, h: 320 }, { x: 0, y: 320, w: FW, h: 320 }];
      const gameDst = { x: 0, y: 640, w: FW, h: 640 };
      return { layout: kind, bg: 'black', dividers: [320, 640], titleY: 640,
        panels: [...cams.map((c, i) => ({ src: fitInside(c, dsts[i]!.w / dsts[i]!.h), dst: dsts[i]! })), { src: gameplayCrop(W, H, 1, cams), dst: gameDst }] };
    }
  }
}

/** crop x of a panel at clip time t (hard cuts between speakers, like a human editor) */
export function panelX(p: Panel, t: number) {
  if (!p.follow) return p.src.x;
  let x = p.follow[0]!.x;
  for (const f of p.follow) { if (f.t <= t) x = f.x; else break; }
  return x;
}

/** ffmpeg expression for the same cuts (t = seconds from the clip start, as the export seeks to the clip start) */
export function followExpr(p: Panel) {
  if (!p.follow) return String(p.src.x);
  const f = p.follow;
  let expr = String(f[f.length - 1]!.x);
  for (let i = f.length - 2; i >= 0; i--) expr = `if(lt(t,${f[i + 1]!.t.toFixed(2)}),${f[i]!.x},${expr})`;
  return expr;
}

/** the ffmpeg filter graph that draws the plan (without captions and title): input [0:v], output [base] */
export function layoutGraph(plan: LayoutPlan, divider: boolean): string {
  const n = plan.panels.length + (plan.bg === 'blur' ? 1 : 0);
  const parts: string[] = [`[0:v]split=${n}${Array.from({ length: n }, (_, i) => `[a${i}]`).join('')}`];
  let k = 0;
  if (plan.bg === 'blur') parts.push(`[a${k++}]scale=${FW}:${FH}:force_original_aspect_ratio=increase,crop=${FW}:${FH},boxblur=24:2,eq=brightness=-0.06,setsar=1[bg]`);
  else parts.push(`color=c=black:s=${FW}x${FH}:r=30[bg]`);
  plan.panels.forEach((p, i) => {
    parts.push(`[a${k++}]crop=${p.src.w}:${p.src.h}:'${followExpr(p)}':${p.src.y},scale=${p.dst.w}:${p.dst.h},setsar=1[p${i}]`);
  });
  let last = 'bg';
  plan.panels.forEach((p, i) => { parts.push(`[${last}][p${i}]overlay=${p.dst.x}:${p.dst.y}:shortest=1[o${i}]`); last = `o${i}`; });
  if (divider && plan.dividers.length) {
    const boxes = plan.dividers.map((y) => `drawbox=x=0:y=${y - 5}:w=${FW}:h=10:color=0xD946EF@0.35:t=fill,drawbox=x=0:y=${y - 2}:w=${FW}:h=4:color=0xF0ABFC@1:t=fill`).join(',');
    parts.push(`[${last}]${boxes}[dv]`); last = 'dv';
  }
  parts.push(`[${last}]null[base]`);
  return parts.join(';');
}

/** draws one frame of the plan on a 720×1280 canvas (the preview) */
export function drawPlan(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, plan: LayoutPlan, t: number, divider: boolean, blur: HTMLCanvasElement) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, FW, FH);
  const W = video.videoWidth, H = video.videoHeight;
  if (!W || !H) return;
  if (plan.bg === 'blur') {
    // cheap, browser-independent blur: draw tiny, then scale up smoothly
    const b = blur.getContext('2d')!;
    const s = Math.max(blur.width / W, blur.height / H);
    b.drawImage(video, (blur.width - W * s) / 2, (blur.height - H * s) / 2, W * s, H * s);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = 0.85; ctx.drawImage(blur, 0, 0, FW, FH); ctx.globalAlpha = 1;
  }
  for (const p of plan.panels) ctx.drawImage(video, panelX(p, t), p.src.y, p.src.w, p.src.h, p.dst.x, p.dst.y, p.dst.w, p.dst.h);
  if (divider) for (const y of plan.dividers) {
    ctx.fillStyle = 'rgba(217,70,239,0.35)'; ctx.fillRect(0, y - 5, FW, 10);
    ctx.fillStyle = '#F0ABFC'; ctx.fillRect(0, y - 2, FW, 4);
  }
}
