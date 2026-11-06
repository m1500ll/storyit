// Runtime of one VideoSpec: shots, cameras, lens, kicks, bridge motion and set-piece timing, resolved from the spec
// and the voice's word timings by loadSpec(). Exposes the same contract the bridge template's world.ts / cast.ts /
// Bridge.tsx read (SHOTS, camAt, dofAt, layersAt, bridgeState, deckY, ...), now as live bindings filled at load time.
// Camera grammar kept from the reference study (motion.md): every hold pushes in, glides are symmetric smootherstep
// 18-40 f, big reframes are cuts, impacts are 7-frame flip kicks, no hand-held float.
import type { CamKey, Framing, Light, Piece, Shot, V3, VideoSpec, Word } from "../spec";
import { FPS, timeline, type Timeline } from "../resolve";
import { centroid, homesOf, type GroupRt } from "./crowd";
import { clamp01, glide, smooth } from "./math";

export { FPS, clamp01, smooth, glide };
export type { V3 };
export const D0 = 6.0; // bank top + deck height (m)
export const HALF = 27; // towers at z = +-27
export const PARK: V3 = [70, D0, -75];

export type Era = "old" | "gone" | "new";
export type BridgeState = { bounce: number; drop: number; snap: number; collapsed: boolean; roll: number; shift: number; era: Era };
export const shapeZ = (z: number) => (Math.abs(z) < HALF ? Math.cos((Math.PI * z) / (2 * HALF)) : 0);
export const deckY = (z: number, b: BridgeState, x = 0) => D0 + b.bounce * shapeZ(z) - x * Math.tan(b.roll) * shapeZ(z);
export const deckX = (z: number, b: BridgeState) => b.shift * shapeZ(z);
export const dropW = (_z: number) => 0;

type Key = { f: number; dur: number; cut: boolean; push: number; punch: boolean; zoom: boolean; framing: Framing };
export type ShotDef = {
  id: number; a: number; b: number; light: Light; xfade: number; era: Era; groups: string[] | null; show: Piece["kind"][];
  keys: Key[]; spec: Shot; sunAz?: number; sunEl?: number;
  /** story time inside the shot (flash-forward shots run ahead) */
  tau: (t: number) => number;
};

// ---------------- live state ----------------
export let TL: Timeline;
export let SPEC: VideoSpec;
export let SHOTS: ShotDef[] = [];
export let TOTAL = 1;
export let FLASH_AT = -100;
export let GROUPS: GroupRt[] = [];
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export let FOREGROUND: Fg[] = [];
let KICKS: [number, number][] = [];

export const loadSpec = (spec: VideoSpec, words: Word[]) => {
  SPEC = spec;
  TL = timeline(spec, words);
  TOTAL = TL.frames;
  FLASH_AT = spec.flash ? TL.f(spec.flash) : -100;
  GROUPS = spec.groups.map((g, gi) => ({ g, gi, homes: homesOf(g), enterT: g.enter ? TL.t(g.enter) : null,
    acts: g.actions.map((a) => ({ ...a, t: TL.t(a.from) })).sort((p, q) => p.t - q.t) }));
  const starts = spec.shots.map((s, k) => (k === 0 ? 0 : TL.f(s.start)));
  SHOTS = spec.shots.map((s, k) => ({
    id: k + 1, a: starts[k]!, b: k + 1 < starts.length ? starts[k + 1]! : TOTAL, light: s.light, xfade: s.xfade ?? 0,
    era: s.bridgeEra ?? spec.decor.bridge?.era ?? "old", groups: s.groups ?? null, show: s.show ?? [], spec: s,
    tau: s.storyFrom ? ((sf: number, a0: number) => (t: number) => t - a0 + sf)(TL.t(s.storyFrom), starts[k]! / FPS) : (t: number) => t,
    keys: s.cams.map((c: CamKey, j) => ({ f: j === 0 ? starts[k]! - 6 : TL.f(c.at), dur: c.dur ?? 24, cut: (c.move ?? (j === 0 ? "cut" : "glide")) === "cut",
      push: c.push ?? 0.0022, punch: !!c.punch, zoom: !!c.zoom, framing: c.framing })),
  }));
  KICKS = spec.shots.flatMap((s) => (s.kicks ?? []).map((k) => [TL.t(k.at), k.amount] as [number, number]));
};

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1]!;
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = s.xfade;
    if (x && s.id > 1 && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};
export const groupVisible = (id: number, gid: string) => { const g = SHOTS[id - 1]!.groups; return !g || g.includes(gid); };

// ---------------- bridge motion ----------------
export const bridgeState = (id: number, t: number): BridgeState => {
  const s = SHOTS[id - 1]!;
  let roll = 0, shift = 0;
  for (const m of s.spec.bridge ?? []) {
    const t0 = TL.t(m.from), t1 = m.to ? TL.t(m.to) : Infinity;
    const up = smooth((t - t0) / 1.4), down = t1 === Infinity ? 1 : 1 - smooth((t - t1) / 1.6);
    roll += (m.roll ?? 0) * up * Math.max(0.25, down);
    const hz = m.swayHz ?? 0.95, A = (m.sway ?? 0) * smooth((t - t0) / 1.8) * down;
    roll += 0.045 * A * Math.sin(2 * Math.PI * hz * (t - t0));
    shift += 0.22 * A * Math.sin(2 * Math.PI * hz * (t - t0) - 0.9);
  }
  return { bounce: 0, drop: 0, snap: 0, collapsed: false, roll, shift, era: s.era };
};

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
const T = (f: number) => f / FPS;
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
/** world point of a subject: a group's centroid at eye height (deck-aware), or a point */
export const subjectPoint = (id: number, subj: string | V3, f: number, height = 1.55): V3 => {
  if (Array.isArray(subj)) return subj;
  const t = SHOTS[id - 1]!.tau(T(f));
  if (subj === "eights") { const e = piece("eights"); return [boatX(t, 0) + 2.5, 0.75 + height, e?.lanes[0] ?? 0]; }
  const rt = GROUPS.find((g) => g.g.id === subj);
  if (!rt) return [0, D0 + height, 0];
  const [x, z] = centroid(rt, t), b = bridgeState(id, t);
  const y = rt.g.onDeck ? deckY(z, b, x) : D0;
  return [x + (rt.g.onDeck ? deckX(z, b) : 0), y + height, z];
};
const frame = (id: number, k: Key, f: number): Cam => {
  const fr = k.framing, push = pushK(f, k.f, k.push, k.punch ? 0.006 : 0, 32);
  let pos: V3, look: V3;
  const fov0 = fr.fov ?? 40;
  if ("subject" in fr) {
    look = subjectPoint(id, fr.subject, f, fr.height ?? 1.55);
    const az = (fr.azimuth * Math.PI) / 180, el = (fr.elevation * Math.PI) / 180, fw: V3 = [-Math.sin(az), 0, Math.cos(az)];
    pos = [look[0] - fw[0] * fr.dist * Math.cos(el), look[1] + fr.dist * Math.sin(el), look[2] - fw[2] * fr.dist * Math.cos(el)];
  } else { pos = fr.pos; look = fr.look; }
  if (k.zoom) return { pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov0 * Math.PI) / 360) * push), roll: fr.roll ?? 0 };
  return { pos: [look[0] + (pos[0] - look[0]) * push, look[1] + (pos[1] - look[1]) * push, look[2] + (pos[2] - look[2]) * push], look, fov: fov0, roll: fr.roll ?? 0 };
};
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i]! - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i]! - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const keys = SHOTS[id - 1]!.keys;
  let c = frame(id, keys[0]!, f);
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i]!;
    if (f < k.f) break;
    c = k.cut ? frame(id, k, f) : mix(c, frame(id, k, f), glide((f - k.f) / k.dur));
  }
  const a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of SHOTS[id - 1]!.keys) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur);
  return Math.max(f, e);
};

// ---------------- lens ----------------
/** lens blur at frame f: the shot's dof entries (switch on their cue), else automatic from the framing distance */
export const dofAt = (f: number): { cInf: number; focus?: (f: number) => V3 } => {
  const s = shotAt(f), list = s.spec.dof;
  if (list && list.length) {
    let cur = list[0]!;
    for (const d of list) if (!d.at || TL.f(d.at) <= f) cur = d;
    const foc = cur.focus;
    return { cInf: cur.cInf, focus: foc === undefined ? undefined : (ff: number) => (Array.isArray(foc) ? foc : subjectPoint(s.id, foc, ff)) };
  }
  const c = camAt(s.id, f), d = Math.hypot(c.pos[0] - c.look[0], c.pos[1] - c.look[1], c.pos[2] - c.look[2]);
  return { cInf: d < 4 ? 14 : d < 8 ? 12 : d < 14 ? 9 : d < 22 ? 5 : 0 };
};
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};

// ---------------- set pieces ----------------
export const piece = <K extends Piece["kind"]>(kind: K) => SPEC.decor.pieces?.find((p) => p.kind === kind) as Extract<Piece, { kind: K }> | undefined;
export const BOAT_LEN = 17.5;
export const boatX = (t: number, k: number) => {
  const p = piece("eights");
  if (!p) return 1e4;
  return (p.speed ?? 4.6) * (t - TL.t(p.pass)) + (k ? -3.5 : 0);
};
export const strokeAt = (t: number, k: number) => (((t * 0.6 + k * 0.17) % 1) + 1) % 1;
export const rowboatRoll = (t: number) => {
  const p = piece("rowboat");
  if (!p) return 0;
  const tl = TL.t(p.lean), tt = TL.t(p.tip);
  return -(0.07 * smooth((t - tl + 0.15) / 0.7) + 0.05 * smooth((t - tl - 1.5) / 1.4) + 0.3 * smooth((t - tt + 0.06) / 0.28))
    + 0.035 * Math.sin(t * 2.1) * (1 - smooth((t - tt) / 0.3)) + 0.02 * Math.sin(t * 5.3) * smooth((t - tt) / 0.3);
};
