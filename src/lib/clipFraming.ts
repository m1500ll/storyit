import type { Caption, ClipFraming } from '@/types/clips';

/** AI clipping: finds facecams and who is speaking, in the browser (the video never leaves the device).
 *  MediaPipe Face Landmarker (wasm from the CDN, pinned to the installed version; model in public/models) looks at
 *  frames sampled every 0.4 s; `classifyFraming` (pure, unit-tested) turns the faces into a ClipFraming. */

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm';
const MODEL = '/models/face_landmarker.task';
const STEP = 0.4;

/** one detected face, in source pixels; `jaw` = how open the mouth is (0..1) */
export interface Face { cx: number; cy: number; w: number; h: number; jaw: number }
export interface Sample { t: number; faces: Face[] }

type Result = { faceLandmarks: { x: number; y: number }[][]; faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[] };
type Landmarker = { detect: (img: HTMLCanvasElement) => Result };
let landmarker: Promise<Landmarker> | null = null;
function loadLandmarker(): Promise<Landmarker> {
  landmarker ??= (async () => {
    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const files = await FilesetResolver.forVisionTasks(WASM);
    const make = (delegate: 'GPU' | 'CPU') => FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'IMAGE', numFaces: 4, outputFaceBlendshapes: true,
      minFaceDetectionConfidence: 0.45, minFacePresenceConfidence: 0.45,
    });
    return (await make('GPU').catch(() => make('CPU'))) as unknown as Landmarker;
  })().catch((e) => { landmarker = null; throw e; });
  return landmarker;
}

const seek = (v: HTMLVideoElement, t: number) => new Promise<void>((resolve) => {
  const done = () => { v.removeEventListener('seeked', done); resolve(); };
  v.addEventListener('seeked', done);
  v.currentTime = t;
  setTimeout(done, 1500);
});

/** samples the faces of [start, end] of the video at `url` */
/** a small grey copy of a frame (for finding the facecam window's edges) */
export interface Grey { w: number; h: number; px: Float32Array }
const GREY_W = 480;

export async function sampleFaces(url: string, start: number, end: number, onProgress?: (p: number) => void): Promise<{ W: number; H: number; samples: Sample[]; greys: Grey[] }> {
  const lm = await loadLandmarker();
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
  await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error('Vidéo illisible pour l’analyse du cadrage.')); });
  const W = v.videoWidth, H = v.videoHeight;
  // The detector sees a small version of each image, so a facecam face (a few % of a stream frame) is invisible on the
  // whole frame: each corner of a landscape video is also looked at, zoomed in. Regions in source pixels.
  const regions: { x: number; y: number; w: number; h: number }[] = [{ x: 0, y: 0, w: W, h: H }];
  if (W / H > 1.2) {
    const cw = Math.round(W * 0.34), ch = Math.round(H * 0.5);
    for (const [x, y] of [[0, 0], [W - cw, 0], [0, H - ch], [W - cw, H - ch]] as const) regions.push({ x, y, w: cw, h: ch });
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const samples: Sample[] = [];
  const greys: Grey[] = [];
  const gw = GREY_W, gh = Math.round(GREY_W * H / W);
  const gc = Object.assign(document.createElement('canvas'), { width: gw, height: gh });
  const gctx = gc.getContext('2d', { willReadFrequently: true })!;
  const n = Math.max(1, Math.floor((end - start) / STEP));
  const greyEvery = Math.max(1, Math.floor(n / 8));
  for (let i = 0; i <= n; i++) {
    const t = Math.min(end - 0.05, start + i * STEP);
    await seek(v, t);
    const faces: Face[] = [];
    for (const rg of regions) {
      const scale = Math.min(1, 640 / rg.w);
      canvas.width = Math.round(rg.w * scale); canvas.height = Math.round(rg.h * scale);
      ctx.drawImage(v, rg.x, rg.y, rg.w, rg.h, 0, 0, canvas.width, canvas.height);
      const out = lm.detect(canvas);
      (out.faceLandmarks ?? []).forEach((pts, k) => {
        let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
        for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
        const jaw = out.faceBlendshapes?.[k]?.categories.find((c) => c.categoryName === 'jawOpen')?.score ?? 0;
        const f = { cx: rg.x + ((x0 + x1) / 2) * rg.w, cy: rg.y + ((y0 + y1) / 2) * rg.h, w: (x1 - x0) * rg.w, h: (y1 - y0) * rg.h, jaw };
        // the same face seen in the whole frame and in a corner: keep one
        if (f.w > 8 && f.h > 8 && !faces.some((g) => Math.hypot(g.cx - f.cx, g.cy - f.cy) < Math.max(g.w, f.w) * 0.6)) faces.push(f);
      });
    }
    samples.push({ t: t - start, faces });
    if (i % greyEvery === 0) {
      gctx.drawImage(v, 0, 0, gw, gh);
      const d = gctx.getImageData(0, 0, gw, gh).data, px = new Float32Array(gw * gh);
      for (let k = 0; k < px.length; k++) px[k] = 0.299 * d[k * 4]! + 0.587 * d[k * 4 + 1]! + 0.114 * d[k * 4 + 2]!;
      greys.push({ w: gw, h: gh, px });
    }
    onProgress?.((i + 1) / (n + 1));
  }
  v.removeAttribute('src'); v.load();
  return { W, H, samples, greys };
}

interface Track { faces: (Face & { t: number })[]; cx: number; cy: number }

/** groups the faces of all samples into tracks (the same person or the same facecam over time) */
function tracksOf(samples: Sample[], W: number): Track[] {
  const tracks: Track[] = [];
  for (const s of samples) for (const f of s.faces) {
    let best: Track | null = null, d = Infinity;
    for (const tr of tracks) { const dd = Math.hypot(tr.cx - f.cx, tr.cy - f.cy); if (dd < d) { d = dd; best = tr; } }
    if (best && d < Math.max(0.09 * W, f.w * 0.8)) {
      best.faces.push({ ...f, t: s.t });
      const k = Math.min(best.faces.length, 12);
      best.cx += (f.cx - best.cx) / k; best.cy += (f.cy - best.cy) / k;
    } else tracks.push({ faces: [{ ...f, t: s.t }], cx: f.cx, cy: f.cy });
  }
  return tracks;
}

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)]! : 0; };

/** the facecam overlay around a face: head and shoulders, 4:3, snapped to the frame edge it sits against */
function camAround(tr: Track, W: number, H: number) {
  const fw = median(tr.faces.map((f) => f.w)), fh = median(tr.faces.map((f) => f.h));
  const cx = median(tr.faces.map((f) => f.cx)), cy = median(tr.faces.map((f) => f.cy));
  let w = Math.min(W, fw * 3.4), h = Math.min(H, w * 0.75);
  if (h < fh * 2.2) { h = Math.min(H, fh * 2.2); w = Math.min(W, h / 0.75); }
  let x = cx - w / 2, y = cy + fh * 0.2 - h / 2;
  const snap = 0.06;
  if (x < W * snap) x = 0; if (x + w > W * (1 - snap)) x = W - w;
  if (y < H * snap) y = 0; if (y + h > H * (1 - snap)) y = H - h;
  x = Math.min(Math.max(0, x), W - w); y = Math.min(Math.max(0, y), H - h);
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

/** Facecams, people and who speaks when. `captions` (source time) tell when someone is talking. */
export function classifyFraming(samples: Sample[], W: number, H: number, start: number, end: number, captions: Caption[] = []): ClipFraming {
  const base = { v: 1 as const, w: W, h: H, start, end, cams: [] as ClipFraming['cams'], segments: [] as ClipFraming['segments'] };
  const n = samples.length || 1;
  const tracks = tracksOf(samples, W).filter((tr) => tr.faces.length >= Math.max(2, n * 0.15));
  if (!tracks.length) return { ...base, kind: 'none' };

  // a facecam: a small face that stays put, near a side of a landscape frame (a gameplay stream overlay)
  const landscape = W / H > 1.2;
  const cams = tracks.filter((tr) => {
    const present = tr.faces.length / n;
    const fh = median(tr.faces.map((f) => f.h));
    const spread = Math.max(...tr.faces.map((f) => Math.abs(f.cx - tr.cx)));
    const nearSide = tr.cx < W * 0.33 || tr.cx > W * 0.67 || tr.cy < H * 0.3 || tr.cy > H * 0.7;
    return landscape && present >= 0.5 && fh < H * 0.24 && spread < W * 0.06 && nearSide;
  }).sort((a, b) => b.faces.length - a.faces.length);
  if (cams.length >= 2) return { ...base, kind: 'two_cams', cams: cams.slice(0, 2).map((c) => camAround(c, W, H)) };
  if (cams.length === 1) return { ...base, kind: 'facecam', cams: [camAround(cams[0]!, W, H)] };

  // people on screen: follow whoever speaks (mouth moving while words are being said), with hard cuts held ≥ 1.2 s
  const speaking = (t: number) => captions.some((c) => c.start - start <= t && c.end - start >= t);
  const jawAt = (tr: Track, t: number) => {
    const near = tr.faces.filter((f) => Math.abs(f.t - t) <= 0.6);
    if (near.length < 2) return near.length ? 0.01 : -1;
    const j = near.map((f) => f.jaw);
    return Math.max(...j) - Math.min(...j) + median(j) * 0.3;
  };
  const people = tracks.sort((a, b) => b.faces.length - a.faces.length).slice(0, 4);
  let current = 0, candidate = -1, since = 0;
  const segments: ClipFraming['segments'] = [];
  const push = (t: number, i: number) => {
    const tr = people[i]!;
    // a steady position: the median over ~5 s around t (a hand in front of the face must not move the frame)
    const near = tr.faces.filter((f) => Math.abs(f.t - t) <= 2.5);
    const pool = near.length >= 3 ? near : tr.faces;
    const cx = Math.round(median(pool.map((f) => f.cx)));
    const cy = Math.round(median(pool.map((f) => f.cy)));
    const last = segments[segments.length - 1];
    if (!last || Math.abs(last.cx - cx) > W * 0.08) segments.push({ t: Math.max(0, +t.toFixed(2)), cx, cy });
  };
  // start on the person who speaks first (or the most visible one)
  const first = samples.find((s) => speaking(s.t));
  if (first && people.length > 1) {
    const scores = people.map((tr) => jawAt(tr, first.t));
    current = scores.indexOf(Math.max(...scores));
  }
  push(0, current);
  for (const s of samples) {
    if (people.length > 1 && speaking(s.t)) {
      const scores = people.map((tr) => jawAt(tr, s.t));
      const best = scores.indexOf(Math.max(...scores));
      if (best !== current && scores[best]! > scores[current]! * 1.4 + 0.02) {
        if (candidate !== best) { candidate = best; since = s.t; }
        else if (s.t - since >= 0.8) { current = best; candidate = -1; push(since, current); }
      } else candidate = -1;
    }
    // the same person walking around: re-centre when they drift
    if (people.length === 1 || !speaking(s.t)) push(s.t, current);
  }
  // drop cuts closer than 1.2 s to the previous one (no flickering)
  const clean = segments.filter((sg, i) => i === 0 || sg.t - segments[i - 1]!.t >= 1.2);
  return { ...base, kind: 'people', segments: clean };
}

/** The facecam window's real edges. The box guessed from the face is a first idea; a facecam overlay has a straight
 *  border that stays in the same place in every frame while the picture around it changes, so the column (and row)
 *  with the strongest steady contrast near the guess is its inner edge. Boxes in source pixels. */
export function refineCam(cam: ClipFraming['cams'][number], greys: Grey[], W: number, H: number): ClipFraming['cams'][number] {
  if (!greys.length) return cam;
  const g0 = greys[0]!, s = g0.w / W, gw = g0.w, gh = g0.h;
  const at = (g: Grey, x: number, y: number) => g.px[Math.min(gh - 1, Math.max(0, y)) * gw + Math.min(gw - 1, Math.max(0, x))]!;
  const right = cam.x + cam.w / 2 > W / 2, bottom = cam.y + cam.h / 2 > H / 2;
  // a steady edge: strong contrast in every frame (min over frames, not the mean: a moving object is not a border)
  const colScore = (x: number, y0: number, y1: number) => Math.min(...greys.map((g) => {
    let sum = 0; for (let y = y0; y < y1; y++) sum += Math.abs(at(g, x + 1, y) - at(g, x - 1, y)); return sum / Math.max(1, y1 - y0);
  }));
  const rowScore = (y: number, x0: number, x1: number) => Math.min(...greys.map((g) => {
    let sum = 0; for (let x = x0; x < x1; x++) sum += Math.abs(at(g, x, y + 1) - at(g, x, y - 1)); return sum / Math.max(1, x1 - x0);
  }));
  // the edge line: among the strong steady lines, the OUTERMOST one (`outward` = towards the middle of the frame),
  // since lines inside the cam picture (a chair, a shelf) are strong too
  const best = (from: number, to: number, score: (v: number) => number, outward: 1 | -1) => {
    const vals: { v: number; sc: number }[] = [];
    for (let v = Math.max(2, from); v <= Math.min(to, 10000); v++) vals.push({ v, sc: score(v) });
    if (!vals.length) return -1;
    const max = Math.max(...vals.map((x) => x.sc));
    const med = [...vals].sort((a, b) => a.sc - b.sc)[Math.floor(vals.length / 2)]!.sc;
    if (max <= Math.max(6, med * 2.5)) return -1;
    const strong = vals.filter((x) => x.sc >= max * 0.55).map((x) => x.v);
    return outward === 1 ? Math.max(...strong) : Math.min(...strong);
  };
  const cy0 = Math.round(cam.y * s), cy1 = Math.round((cam.y + cam.h) * s);
  // inner vertical edge: searched from half the guessed width to 2.6× it, on the side facing the middle of the frame
  const inner = right
    ? best(Math.round((cam.x + cam.w - cam.w * 2.6) * s), Math.round((cam.x + cam.w * 0.5) * s), (x) => colScore(x, cy0, cy1), -1)
    : best(Math.round((cam.x + cam.w * 0.5) * s), Math.round((cam.x + cam.w * 2.6) * s), (x) => colScore(x, cy0, cy1), 1);
  let { x, y, w, h } = cam;
  if (inner > 0) { const ex = inner / s; if (right) { w = x + w - ex; x = ex; } else { w = ex - x; } }
  const hx0 = Math.round(x * s), hx1 = Math.round((x + w) * s);
  const edgeY = bottom
    ? best(Math.round((cam.y + cam.h - cam.h * 2.6) * s), Math.round((cam.y + cam.h * 0.5) * s), (yy) => rowScore(yy, hx0 + 2, hx1 - 2), -1)
    : best(Math.round((cam.y + cam.h * 0.5) * s), Math.round((cam.y + cam.h * 2.6) * s), (yy) => rowScore(yy, hx0 + 2, hx1 - 2), 1);
  if (edgeY > 0) { const ey = edgeY / s; if (bottom) { h = y + h - ey; y = ey; } else { h = ey - y; } }
  // keep a little inside the border (no line of the game in the crop)
  const m = 4;
  const out = { x: Math.round(x + m), y: Math.round(y + m), w: Math.round(w - 2 * m), h: Math.round(h - 2 * m) };
  return out.w > cam.w * 0.4 && out.h > cam.h * 0.4 && out.x >= 0 && out.y >= 0 && out.x + out.w <= W && out.y + out.h <= H ? out : cam;
}

/** the whole step: samples the clip, then classifies */
export async function detectFraming(url: string, start: number, end: number, captions: Caption[], onProgress?: (p: number) => void): Promise<ClipFraming> {
  const { W, H, samples, greys } = await sampleFaces(url, start, Math.min(end, start + 120), onProgress);
  const f = classifyFraming(samples, W, H, start, end, captions);
  return f.cams.length ? { ...f, cams: f.cams.map((c) => refineCam(c, greys, W, H)) } : f;
}

/** framing still valid for this trim (detected on the same part of the video) */
export const framingFits = (f: ClipFraming | null, start: number, end: number) => !!f && f.start <= start + 0.5 && f.end >= end - 0.5;
