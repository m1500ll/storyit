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
const landmarkers: Partial<Record<'GPU' | 'CPU', Promise<Landmarker>>> = {};
function loadLandmarker(delegate: 'GPU' | 'CPU' = 'GPU'): Promise<Landmarker> {
  landmarkers[delegate] ??= (async () => {
    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const files = await FilesetResolver.forVisionTasks(WASM);
    const make = (d: 'GPU' | 'CPU') => FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL, delegate: d }, runningMode: 'IMAGE', numFaces: 4, outputFaceBlendshapes: true,
      minFaceDetectionConfidence: 0.4, minFacePresenceConfidence: 0.4,
    });
    return (await (delegate === 'GPU' ? make('GPU').catch(() => make('CPU')) : make('CPU'))) as unknown as Landmarker;
  })().catch((e) => { delete landmarkers[delegate]; throw e; });
  return landmarkers[delegate]!;
}

/** Jumps to `t` and waits until that frame is really decoded (long stream recordings can take seconds to seek). */
const seek = (v: HTMLVideoElement, t: number) => new Promise<void>((resolve) => {
  let finished = false;
  const done = () => {
    if (finished) return; finished = true;
    v.removeEventListener('seeked', onSeeked);
    resolve();
  };
  const onSeeked = () => {
    const rvfc = (v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback;
    if (rvfc) { rvfc.call(v, () => done()); setTimeout(done, 400); } else done();
  };
  v.addEventListener('seeked', onSeeked);
  v.currentTime = t;
  setTimeout(done, 8000);
});

/** a small grey copy of a frame (for finding the facecam window's edges) */
export interface Grey { w: number; h: number; px: Float32Array }
const GREY_W = 480;

export async function sampleFaces(url: string, start: number, end: number, onProgress?: (p: number) => void): Promise<{ W: number; H: number; samples: Sample[]; greys: Grey[]; dark: number }> {
  let lm = await loadLandmarker('GPU');
  let onCpu = false;
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
  await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error('Vidéo illisible pour l’analyse du cadrage.')); });
  const W = v.videoWidth, H = v.videoHeight;
  // The detector sees a small version of each image, so a facecam face (a few % of a stream frame) is invisible on the
  // whole frame: the frame is also looked at in overlapping zoomed tiles (3×2 for a landscape video, 1×3 for a
  // vertical one), so a camera anywhere (a corner, the middle of a side) is found. Regions in source pixels.
  const regions: { x: number; y: number; w: number; h: number }[] = [{ x: 0, y: 0, w: W, h: H }];
  const [cols, rows] = W / H > 1.2 ? [3, 2] : W / H < 0.8 ? [1, 3] : [2, 2];
  const tw = Math.round(W / cols * (cols > 1 ? 1.35 : 1)), th = Math.round(H / rows * (rows > 1 ? 1.35 : 1));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    regions.push({ x: Math.round(cols > 1 ? c * (W - tw) / (cols - 1) : 0), y: Math.round(rows > 1 ? r * (H - th) / (rows - 1) : 0), w: tw, h: th });
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const samples: Sample[] = [];
  const greys: Grey[] = [];
  const gw = GREY_W, gh = Math.round(GREY_W * H / W);
  const gc = Object.assign(document.createElement('canvas'), { width: gw, height: gh });
  const gctx = gc.getContext('2d', { willReadFrequently: true })!;
  const step = end - start > 45 ? 0.6 : STEP;
  const n = Math.max(1, Math.floor((end - start) / step));
  const greyEvery = Math.max(1, Math.floor(n / 8));
  let dark = 0;
  const hitTiles = new Set<number>();
  for (let i = 0; i <= n; i++) {
    // some graphics cards return nothing without any error: after 6 frames without a single face, try the CPU once
    if (i === 6 && !onCpu && samples.every((x) => !x.faces.length)) {
      lm = await loadLandmarker('CPU'); onCpu = true; i = -1; samples.length = 0; greys.length = 0; dark = 0; hitTiles.clear();
      continue;
    }
    const t = Math.min(end - 0.05, start + i * step);
    await seek(v, t);
    const faces: Face[] = [];
    // all the tiles on the first frames (to find where the cameras are), then only the whole frame and the tiles
    // where a face was found: 3 to 4 times faster on long clips, same result
    const active = i < 8 ? regions : regions.filter((_, k) => k === 0 || hitTiles.has(k));
    for (const rg of active) {
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
        if (f.w > 8 && f.h > 8 && rg !== regions[0]) hitTiles.add(regions.indexOf(rg));
        if (f.w > 8 && f.h > 8 && !faces.some((g) => Math.hypot(g.cx - f.cx, g.cy - f.cy) < Math.max(g.w, f.w) * 0.6)) faces.push(f);
      });
    }
    samples.push({ t: t - start, faces });
    gctx.drawImage(v, 0, 0, gw, gh);
    const d = gctx.getImageData(0, 0, gw, gh).data;
    let lum = 0;
    for (let k = 0; k < d.length; k += 64) lum += d[k]! + d[k + 1]! + d[k + 2]!;
    if (lum / (d.length / 64) / 3 < 6) dark++;
    if (i % greyEvery === 0) {
      const px = new Float32Array(gw * gh);
      for (let k = 0; k < px.length; k++) px[k] = 0.299 * d[k * 4]! + 0.587 * d[k * 4 + 1]! + 0.114 * d[k * 4 + 2]!;
      greys.push({ w: gw, h: gh, px });
    }
    onProgress?.((i + 1) / (n + 1));
  }
  v.removeAttribute('src'); v.load();
  return { W, H, samples, greys, dark: dark / Math.max(1, samples.length) };
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
  const snap = 0.01; // only a box really against the side is glued to it (refineCam finds the border of the others)
  if (x < W * snap) x = 0; if (x + w > W * (1 - snap)) x = W - w;
  if (y < H * snap) y = 0; if (y + h > H * (1 - snap)) y = H - h;
  x = Math.min(Math.max(0, x), W - w); y = Math.min(Math.max(0, y), H - h);
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

/** How much the picture changes OUTSIDE `rect` compared with inside it, over the grey frames. A streamer's camera
 *  barely changes (a person sitting in a room) while the shared screen next to it (a trailer, a game) changes a lot. */
export function motionContrast(rect: { x: number; y: number; w: number; h: number }, greys: Grey[], W: number): number {
  if (greys.length < 3) return 0;
  const g0 = greys[0]!, s = g0.w / W, gw = g0.w, gh = g0.h;
  const x0 = Math.round(rect.x * s), x1 = Math.round((rect.x + rect.w) * s), y0 = Math.round(rect.y * s), y1 = Math.round((rect.y + rect.h) * s);
  let inside = 0, ni = 0, outside = 0, no = 0;
  for (let k = 1; k < greys.length; k++) {
    const a = greys[k - 1]!.px, b = greys[k]!.px;
    for (let y = 0; y < gh; y += 3) for (let x = 0; x < gw; x += 3) {
      const d = Math.abs(a[y * gw + x]! - b[y * gw + x]!);
      if (x >= x0 && x < x1 && y >= y0 && y < y1) { inside += d; ni++; } else { outside += d; no++; }
    }
  }
  return ni && no ? (outside / no) / Math.max(1, inside / ni) : 0;
}

/** a reaction camera: a box around the streamer reaching the nearest side of the frame (refined later on its edges) */
function reactCam(tr: Track, W: number, H: number) {
  const fw = median(tr.faces.map((f) => f.w)), fh = median(tr.faces.map((f) => f.h));
  const cx = median(tr.faces.map((f) => f.cx)), cy = median(tr.faces.map((f) => f.cy));
  const w = Math.min(W * 0.5, fw * 3.6), h = Math.min(H, Math.max(fh * 2.6, w * 0.75));
  const x = cx < W / 2 ? Math.max(0, Math.min(cx - w / 2, 0)) : Math.min(W - w, Math.max(cx - w / 2, W - w));
  const y = Math.min(Math.max(0, cy + fh * 0.2 - h / 2), H - h);
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

/** Facecams, people and who speaks when. `captions` (source time) tell when someone is talking; `greys` (small grey
 *  frames) let a big streamer camera next to a shared screen (a reaction to a trailer) count as a facecam. */
export function classifyFraming(samples: Sample[], W: number, H: number, start: number, end: number, captions: Caption[] = [], greys: Grey[] = []): ClipFraming {
  const base = { v: 1 as const, w: W, h: H, start, end, cams: [] as ClipFraming['cams'], segments: [] as ClipFraming['segments'] };
  const n = samples.length || 1;
  const tracks = tracksOf(samples, W).filter((tr) => tr.faces.length >= Math.max(2, n * 0.15));
  if (!tracks.length) return { ...base, kind: 'none' };

  // A facecam: a face that stays put in a landscape frame, off the middle. Small and near a side: a gameplay overlay.
  // Bigger (up to half the height): a streamer's camera next to a screen share, kept only if the rest of the frame
  // moves much more than the camera (otherwise it is just a person filmed in a room).
  const landscape = W / H > 1.2;
  const found: ClipFraming['cams'] = [];
  // two people who both stay on screen, big: a conversation (follow who speaks), not a camera next to a shared screen
  const bigStable = tracks.filter((tr) => tr.faces.length / n >= 0.5 && median(tr.faces.map((f) => f.h)) >= H * 0.24).length;
  for (const tr of [...tracks].sort((a, b) => b.faces.length - a.faces.length)) {
    const present = tr.faces.length / n;
    const fh = median(tr.faces.map((f) => f.h));
    const spread = Math.max(...tr.faces.map((f) => Math.abs(f.cx - tr.cx)));
    if (!landscape || present < 0.5 || spread > W * 0.06 || fh > H * 0.5) continue;
    const nearSide = tr.cx < W * 0.33 || tr.cx > W * 0.67 || tr.cy < H * 0.3 || tr.cy > H * 0.7;
    const offCentre = Math.abs(tr.cx - W / 2) > W * 0.12;
    if (fh < H * 0.24 && nearSide) { found.push(greys.length ? refineCam(camAround(tr, W, H), greys, W, H) : camAround(tr, W, H)); continue; }
    if (offCentre && bigStable < 2 && greys.length >= 3) {
      const cam = refineCam(reactCam(tr, W, H), greys, W, H, true);
      if (motionContrast(cam, greys, W) >= 2.2) found.push(cam);
    }
  }
  if (found.length >= 2) return { ...base, kind: 'two_cams', cams: found.slice(0, 2) };
  if (found.length === 1) return { ...base, kind: 'facecam', cams: [found[0]!] };

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
 *  with the strongest steady contrast near the guess is its inner edge. `useMotion` (a camera next to a moving shared
 *  screen): the edge is where the picture goes from still to moving. Boxes in source pixels. */
export function refineCam(cam: ClipFraming['cams'][number], greys: Grey[], W: number, H: number, useMotion = false): ClipFraming['cams'][number] {
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
  const best = (from: number, to: number, score: (v: number) => number, outward: 1 | -1, keep = 0.55) => {
    const vals: { v: number; sc: number }[] = [];
    for (let v = Math.max(2, from); v <= Math.min(to, 10000); v++) vals.push({ v, sc: score(v) });
    if (!vals.length) return -1;
    const max = Math.max(...vals.map((x) => x.sc));
    const med = [...vals].sort((a, b) => a.sc - b.sc)[Math.floor(vals.length / 2)]!.sc;
    if (max <= Math.max(6, med * 2.5)) return -1;
    const strong = vals.filter((x) => x.sc >= max * keep).map((x) => x.v);
    return outward === 1 ? Math.max(...strong) : Math.min(...strong);
  };
  const cy0 = Math.round(cam.y * s), cy1 = Math.round((cam.y + cam.h) * s);
  // Next to a shared screen, the border is where the picture goes from still (the camera) to moving (the screen):
  // the biggest step in motion beats a contrast line (a trailer has strong lines of its own).
  const motionStep = (from: number, to: number, vertical: boolean, a0: number, a1: number, camLow: 1 | -1) => {
    const len = vertical ? gw : gh, prof = new Float32Array(len);
    for (let k = 1; k < greys.length; k++) {
      const A = greys[k - 1]!.px, B = greys[k]!.px;
      for (let v = 0; v < len; v++) for (let u = a0; u < a1; u += 2) {
        const i = vertical ? u * gw + v : v * gw + u; prof[v] = prof[v]! + Math.abs(A[i]! - B[i]!);
      }
    }
    const span = Math.max(1, ((a1 - a0) / 2) * (greys.length - 1));
    let bv = -1, bs = 0; const win = 12;
    for (let v = Math.max(win, from); v <= Math.min(len - win, to); v++) {
      let lo = 0, hi = 0;
      for (let d = 1; d <= win; d++) { lo += prof[v - d]!; hi += prof[v + d - 1]!; }
      const step = (camLow === 1 ? hi - lo : lo - hi) / (win * span);
      if (step > bs) { bs = step; bv = v; }
    }
    return bs > 6 ? bv : -1;
  };
  // inner vertical edge: searched from half the guessed width to 2.6× it, on the side facing the middle of the frame
  const moving = useMotion && greys.length >= 3;
  const stepX = moving ? (right
    ? motionStep(Math.round((cam.x + cam.w - cam.w * 2.6) * s), Math.round((cam.x + cam.w * 0.5) * s), true, cy0, cy1, -1)
    : motionStep(Math.round((cam.x + cam.w * 0.5) * s), Math.round((cam.x + cam.w * 2.6) * s), true, cy0, cy1, 1)) : -1;
  const inner = stepX > 0 ? stepX : right
    ? best(Math.round((cam.x + cam.w - cam.w * 2.6) * s), Math.round((cam.x + cam.w * 0.5) * s), (x) => colScore(x, cy0, cy1), -1)
    : best(Math.round((cam.x + cam.w * 0.5) * s), Math.round((cam.x + cam.w * 2.6) * s), (x) => colScore(x, cy0, cy1), 1);
  let { x, y, w, h } = cam;
  if (inner > 0) { const ex = inner / s; if (right) { w = x + w - ex; x = ex; } else { w = ex - x; } }
  const hx0 = Math.round(x * s), hx1 = Math.round((x + w) * s);
  const stepY = moving ? (bottom
    ? motionStep(Math.round((cam.y + cam.h - cam.h * 2.6) * s), Math.round((cam.y + cam.h * 0.5) * s), false, hx0 + 2, hx1 - 2, -1)
    : motionStep(Math.round((cam.y + cam.h * 0.5) * s), Math.round((cam.y + cam.h * 2.6) * s), false, hx0 + 2, hx1 - 2, 1)) : -1;
  const edgeY = stepY > 0 ? stepY : bottom
    ? best(Math.round((cam.y + cam.h - cam.h * 2.6) * s), Math.round((cam.y + cam.h * 0.5) * s), (yy) => rowScore(yy, hx0 + 2, hx1 - 2), -1)
    : best(Math.round((cam.y + cam.h * 0.5) * s), Math.round((cam.y + cam.h * 2.6) * s), (yy) => rowScore(yy, hx0 + 2, hx1 - 2), 1);
  if (edgeY > 0) { const ey = edgeY / s; if (bottom) { h = y + h - ey; y = ey; } else { h = ey - y; } }
  // outer edges, when the window does not touch the side of the frame (an overlay placed a little inside it)
  const ox0 = Math.round(x * s), ox1 = Math.round((x + w) * s), oy0 = Math.round(y * s), oy1 = Math.round((y + h) * s);
  if (!bottom && oy0 > 2) {
    const e = best(1, Math.round((y + h * 0.3) * s), (yy) => rowScore(yy, ox0 + 2, ox1 - 2), -1, 0.3);
    if (e > 0) { const ey = e / s; h = y + h - ey; y = ey; } else if (y < H * 0.08) { h += y; y = 0; }
  } else if (bottom && oy1 < gh - 2) {
    const e = best(Math.round((y + h * 0.7) * s), gh - 2, (yy) => rowScore(yy, ox0 + 2, ox1 - 2), 1, 0.3);
    if (e > 0) h = e / s - y; else if (H - (y + h) < H * 0.08) h = H - y;
  }
  const ny0 = Math.round(y * s), ny1 = Math.round((y + h) * s);
  if (!right && ox0 > 2) {
    const e = best(1, Math.round((x + w * 0.3) * s), (xx) => colScore(xx, ny0 + 2, ny1 - 2), -1, 0.3);
    if (e > 0) { const ex = e / s; w = x + w - ex; x = ex; } else if (x < W * 0.08) { w += x; x = 0; }
  } else if (right && ox1 < gw - 2) {
    const e = best(Math.round((x + w * 0.7) * s), gw - 2, (xx) => colScore(xx, ny0 + 2, ny1 - 2), 1, 0.3);
    if (e > 0) w = e / s - x; else if (W - (x + w) < W * 0.08) w = W - x;
  }
  // keep a little inside the border (no line of the game in the crop)
  const m = 4;
  const out = { x: Math.round(x + m), y: Math.round(y + m), w: Math.round(w - 2 * m), h: Math.round(h - 2 * m) };
  return out.w > cam.w * 0.4 && out.h > cam.h * 0.4 && out.x >= 0 && out.y >= 0 && out.x + out.w <= W && out.y + out.h <= H ? out : cam;
}

/** the whole step: samples the clip, then classifies */
export async function detectFraming(url: string, start: number, end: number, captions: Caption[], onProgress?: (p: number) => void): Promise<ClipFraming> {
  const { W, H, samples, greys, dark } = await sampleFaces(url, start, Math.min(end, start + 120), onProgress);
  // nearly every frame black: the browser could not decode the video for the analysis (not "no face")
  if (dark > 0.8) throw new Error('unreadable');
  return classifyFraming(samples, W, H, start, end, captions, greys);
}

/** framing still valid for this trim (detected on the same part of the video) */
export const framingFits = (f: ClipFraming | null, start: number, end: number) => !!f && f.start <= start + 0.5 && f.end >= end - 0.5;
