// Timeline of "The Bridge Everyone Leaned On" (Hammersmith, 1870): shots timed to the voice words
// (hammersmith-short/voice/words.json, Kokoro bm_george x1.34), story physics (crowd filling the deck, the rush to one
// railing, deck roll + lateral sway, the racing eights, the rowing-boat analogy) and the reference camera grammar
// (motion.md): continuous slow push-ins, symmetric smootherstep glides 18-40 f, big reframes are cuts, impacts are
// 7-frame flip kicks, no hand-held float. Same file contract as the bridge template (world.ts / cast.ts read it).
export const FPS = 30;
export const TOTAL = 1800; // 60.0 s
export const D0 = 6.0; // bank top + deck height (m)
export const HALF = 27; // towers at z = +-27, span 54 m
export const FILES = [-1.65, -0.55, 0.55, 1.65];
export const ROW_GAP = 1.3;
export const COUNT = 0; // no marching column in this story
export const PARK: V3 = [70, D0, -75]; // the template's park (the swing frame stays in the town, unused)
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};

// ---------------- voice cues (s, from words.json) ----------------
export const W = {
  thrilled: 4.76, london: 5.83, hammersmith: 7.2, oxford: 11.38, so: 13.29, footpaths: 14.6, road: 15.93, gap: 16.76,
  boats: 18.13, rush: 20.8, creak: 22.53, sway: 23.53, luckily: 25.27, unluckily: 27.02, watching: 28.12, yousee: 29.28,
  stand: 31.78, crowd: 34.38, pushed: 36.06, lifts: 37.41, ever: 38.26, leans: 39.78, same: 41.31, tips: 43.11,
  twelve2: 43.98, oldbridge: 47.33, stronger: 49.27, eighty7: 51.35, today: 52.85, closed: 54.15, cracks: 56.51,
};

// ---------------- story physics (tau = story time in seconds, on the race day) ----------------
/** the two eights: bows travel +x at 4.6 m/s, Oxford (dark blue) a length ahead, both shoot the bridge at tau ~23.5 */
export const BOATS = [
  { z: -6.5, lead: 0, blade: "#1d2a5a", kit: "#22306a" }, // Oxford
  { z: 6.0, lead: -3.5, blade: "#86bde6", kit: "#7fb3dc" }, // Cambridge
];
export const BOAT_LEN = 17.5;
export const boatX = (tau: number, k: number) => 4.6 * (tau - 23.5) + BOATS[k].lead;
/** stroke phase (0..1, 0 = catch), 36 strokes / min */
export const strokeAt = (tau: number, k: number) => (((tau * 0.6 + k * 0.17) % 1) + 1) % 1;

/** rush to the upstream railing (-x side) when the boats appear */
export const RUSH0 = 20.5;
/** deck roll (rad; + lowers the -x side) and lateral sway (m) on the race day */
export const SWAY = (tau: number) => lin([[22.4, 0], [23.6, 0.25], [24.4, 1], [25.3, 0.7], [26.5, 0.15], [28, 0.05]], tau);
export const rollAt = (tau: number) => 0.03 * smooth((tau - RUSH0) / 1.4) + 0.045 * SWAY(tau) * Math.sin(2 * Math.PI * 0.95 * (tau - 22.4));
export const shiftAt = (tau: number) => 0.22 * SWAY(tau) * Math.sin(2 * Math.PI * 0.95 * (tau - 22.4) - 0.9);
export const shapeZ = (z: number) => (Math.abs(z) < HALF ? Math.cos((Math.PI * z) / (2 * HALF)) : 0);

/** era of the bridge: the 1827 chain bridge, the empty piers (1884) or Bazalgette's green-and-gold bridge (1887-today) */
export type Era = "old" | "gone" | "new";
export type BridgeState = { bounce: number; drop: number; snap: number; collapsed: boolean; roll: number; shift: number; era: Era };
/** deck height at (z, x): roll twists the span (0 at the towers), shift is the lateral sway */
export const deckY = (z: number, b: BridgeState, x = 0) => D0 + b.bounce * shapeZ(z) - x * Math.tan(b.roll) * shapeZ(z);
export const deckX = (z: number, b: BridgeState) => b.shift * shapeZ(z);
// template compatibility (the bridge collapse of the first short is never triggered here)
export const SNAP = 1e9, DROP0 = 1e9, DROP1 = 1e9, DROP_H = 0;
export const dropW = (_z: number) => 0;
export const dropU = (_t: number) => 0;
export const front = (_tau: number) => 0;
export const marchPhase = (tau: number) => ((tau % 1) + 1) % 1;
export const stomp = (_tau: number) => 1;

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Crowd = "deck" | "middle" | "edge" | "owners" | "rowboat" | "boats" | "tourists" | "today" | "none";
export type ShotDef = { id: number; a: number; b: number; light: Light; crowd: Crowd; tau: (t: number) => number; towns?: boolean; era?: Era; boats?: boolean; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 175, light: "day", crowd: "deck", tau: (t) => 21.6 + t, boats: true }, // hook: flash-forward to the sway
  { id: 2, a: 175, b: 399, light: "day", crowd: "deck", tau: (t) => t, towns: true, boats: true, sunAz: 120 }, // London 1870 + the boats
  { id: 3, a: 399, b: 544, light: "day", crowd: "deck", tau: (t) => t }, // the deck fills
  { id: 4, a: 544, b: 676, light: "day", crowd: "deck", tau: (t) => t, boats: true }, // boats appear, the rush
  { id: 5, a: 676, b: 758, light: "day", crowd: "deck", tau: (t) => t, boats: true }, // creak + sway
  { id: 6, a: 758, b: 811, light: "day", crowd: "deck", tau: (t) => t, boats: true, towns: true }, // luckily it held
  { id: 7, a: 811, b: 878, light: "day", crowd: "owners", tau: (t) => t }, // the owners
  { id: 8, a: 878, b: 1148, light: "golden", crowd: "middle", tau: (t) => t }, // even load vs one side
  { id: 9, a: 1148, b: 1319, light: "golden", crowd: "rowboat", tau: (t) => t, sunAz: -40, sunEl: 12 }, // rowing boat
  { id: 10, a: 1319, b: 1420, light: "golden", crowd: "edge", tau: (t) => t }, // one edge, callback
  { id: 11, a: 1420, b: 1478, light: "day", crowd: "none", tau: (t) => t, era: "gone" }, // the old bridge came down
  { id: 12, a: 1478, b: 1585, light: "day", crowd: "tourists", tau: (t) => t, era: "new", towns: true }, // 1887
  { id: 13, a: 1585, b: TOTAL, light: "day", crowd: "today", tau: (t) => t, era: "new" }, // today, closed to cars, cracks
];
/** crossfades (frames) at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 8: 8, 9: 8, 10: 8, 11: 8, 12: 14, 13: 8 };
export const FLASH_AT = 175;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** layers to draw at frame f: base shot, plus the next shot fading in during a crossfade */
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

/** explanation shots: the diagram roll (rad) on the even-vs-one-side beat */
export const EXPLAIN_ROLL = (t: number) => 0.17 * smooth((t - (W.pushed - 0.1)) / 1.3);
export const bridgeState = (id: number, t: number): BridgeState => {
  const s = SHOTS[id - 1], tau = s.tau(t), era = s.era ?? "old";
  const base: BridgeState = { bounce: 0, drop: 0, snap: 0, collapsed: false, roll: 0, shift: 0, era };
  if (id <= 6) return { ...base, roll: rollAt(tau), shift: shiftAt(tau) };
  if (id === 8) return { ...base, roll: EXPLAIN_ROLL(t) };
  if (id === 10) return { ...base, roll: 0.06 + 0.012 * Math.sin(2 * Math.PI * 0.95 * (t - 44)), shift: 0.05 * Math.sin(2 * Math.PI * 0.95 * (t - 44) - 0.9) };
  return base;
};

// ---------------- crowd on the deck (race day) ----------------
/** every spectator: home slot (x, z), arrival story time, rush timing. Footpaths fill first, then the road, then the gaps. */
const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
export type Spectator = { i: number; x: number; z: number; arrive: number; from: number; rush: number; rx: number };
export const SPECTATORS: Spectator[] = (() => {
  const out: Spectator[] = [];
  const add = (x: number, z: number, arrive: number) => {
    const i = out.length;
    const rx = -2.05 + 1.9 * hh(i, 7) ** 1.6; // packed against the upstream railing after the rush
    out.push({ i, x, z, arrive, from: z < 0 ? -1 : 1, rush: RUSH0 + 0.5 * hh(i, 5), rx });
  };
  let k = 0;
  for (let z = -23.4; z <= 23.4; z += 1.45) for (const x of [-1.95, 1.95]) add(x + (hh(k, 1) - 0.5) * 0.25, z + (hh(k++, 2) - 0.5) * 0.4, 11.5 + 3.6 * hh(k, 3)); // footpaths
  for (let z = -22.8; z <= 22.8; z += 1.9) for (const x of [-0.65, 0.65]) add(x + (hh(k, 1) - 0.5) * 0.35, z + (hh(k++, 2) - 0.5) * 0.6, 15.6 + 1.0 * hh(k, 3)); // the road
  for (let z = -22.0; z <= 22.0; z += 3.1) add((hh(k, 1) - 0.5) * 2.2, z + (hh(k++, 2) - 0.5) * 0.8, 16.7 + 0.8 * hh(k, 3)); // the last gaps
  return out;
})();
/** where spectator s stands at story time tau: walks in from the nearest bridge end (1.5 m/s), then rushes to the rail */
export const spectatorAt = (s: Spectator, tau: number) => {
  const walk = 1.5, start = s.arrive - Math.min(9, Math.abs(Math.abs(s.z) - 31) / walk);
  if (tau < start) return null;
  let z = s.z, x = s.x, moving = false, dirX = 0, dirZ = 0;
  if (tau < s.arrive) { z = s.z + s.from * (s.arrive - tau) * walk; moving = true; dirZ = -s.from; }
  const r = smooth((tau - s.rush) / 0.9);
  if (r > 0) { x = s.x + (s.rx - s.x) * r; if (r < 1) { moving = true; dirX = -1; dirZ = 0; } }
  if (Math.abs(z) > 30.5) return null;
  return { x, z, moving, dirX, dirZ };
};

// ---------------- camera ----------------
// Grammar (motion.md): every move is a symmetric smootherstep glide of 18-40 f; reframes bigger than about half a frame
// are hard cuts; holds push in 0.15-0.35 %/f (0.6 %/f for ~35 f on punch words); rolls of 4-5 deg on emphasis beats.
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const T = (f: number) => f / FPS;
const F = (w: number) => Math.round(w * FPS);
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });
/** the deck point the camera rides with (sway): look at the swaying deck, not through it */
const swayX = (id: number, f: number, z: number) => deckX(z, bridgeState(id, T(f)));

// ---- framings ----
// 1 hook: river level upstream, the eights in front, the packed deck leaning over the rail above; then the chain CU
const S1a = (f: number) => dolly([-15.5, 2.4, -10.5], [0, D0 + 0.1, -4], pushK(f, 0, 0.0025), { fov: 42 });
const S1b = (f: number) => dolly([-6.2, D0 + 4.4, -15.5], [-2.7 + swayX(1, f, -10), D0 + 3.3, -10], pushK(f, F(W.thrilled) - 28, 0.003, 0.006, 30), { fov: 38, roll: 0.04 });
// 2 town aerial (the template's zoom pushes), then the two eights paddling up to the start
const S2a = (f: number) => zoom([17, 13, -52], [0, 9, 4], 44, pushK(f, 171, 0.002));
const S2b = (f: number) => zoom([10, 10.5, -42], [0, 8, 8], 42, pushK(f, F(W.hammersmith), 0.002, 0.005, 30));
const S2c = (f: number) => { const x = boatX(T(f), 0); return dolly([x + 11, 1.7, -15.5], [x + 2.5, 0.75, -3], pushK(f, F(W.oxford) - 6, 0.0022), { fov: 40, roll: -0.03 }); };
// 3 high over the deck as the crowd walks in; deck-level 3/4 on "the road"; punch on "every last gap"
const S3a = (f: number) => dolly([8.5, D0 + 8.5, -24], [0, D0 + 0.6, -6], pushK(f, 399, 0.002), { fov: 42 });
const S3b = (f: number) => dolly([2.0, D0 + 2.0, -19.5], [-0.2, D0 + 1.3, -9.5], pushK(f, F(W.road) - 4, 0.002, 0.006, 32), { fov: 40, roll: -0.03 });
// 4 boats shoot out from under the far side of the bridge; cut onto the deck for the rush (people cross the frame)
const S4a = (f: number) => dolly([17, 1.6, -13], [-14, 2.2, -1.5], pushK(f, 544, 0.0025), { fov: 40 });
const S4b = (f: number) => dolly([2.3, D0 + 1.8, -14.5], [-1.4 + swayX(4, f, -6), D0 + 1.35, -6.5], pushK(f, F(W.rush) - 6, 0.0025, 0.005, 30), { fov: 40 });
// 5 chain CU over the loaded side (creak fx), then the wide end-on view of the rolling deck
const S5a = (f: number) => dolly([-6.4, D0 + 3.8, 2.5], [-2.7 + swayX(5, f, 7), D0 + 3.0, 7.5], pushK(f, 676, 0.003), { fov: 38, roll: -0.03 });
const S5b = (f: number) => zoom([0, D0 + 4.5, -52], [0, D0 + 0.8, 0], 30, pushK(f, F(W.sway) - 4, 0.0025, 0.005, 30), { roll: 0.035 });
// 6 calm wide from the river downstream: the deck settles, the eights row away under the cheering banks
const S6a = (f: number) => dolly([30, 4.2, 14], [0, D0 + 0.4, -3], pushK(f, 758, 0.002), { fov: 42 });
// 7 the owners on the bank by the tower, low lens, punch on "watching"
const OWN: V3 = [5.6, D0, -33.6];
const S7a = (f: number) => dolly([OWN[0] - 0.5, D0 + 1.05, OWN[2] - 5.4], [OWN[0], D0 + 1.6, OWN[2]], pushK(f, 811, 0.0025, 0.006, 32), { fov: 40, roll: 0.035 });
const S7b = (f: number) => dolly([OWN[0] - 0.4, D0 + 1.15, OWN[2] - 4.3], [OWN[0], D0 + 1.65, OWN[2]], pushK(f, F(W.watching) - 4, 0.003), { fov: 38, roll: -0.03 });
// 8 golden, end-on along the deck axis: both chains frame the span; closer on "Stand in the middle"
const S8a = (f: number) => dolly([0, D0 + 4.6, -49], [0, D0 + 3.2, 0], pushK(f, 870, 0.0015), { fov: 36 });
const S8b = (f: number) => dolly([0, D0 + 2.7, -37.5], [0, D0 + 1.9, -11], pushK(f, F(W.stand) - 4, 0.0016), { fov: 38 });
// 9 golden rowing boat, from the bow; closer on "Same boat"; kick on "tips"
export const ROWBOAT: V3 = [26, 0, -16];
const S9a = (f: number) => dolly([ROWBOAT[0] + 5.6, 1.45, ROWBOAT[2] + 0.9], [ROWBOAT[0], 0.75, ROWBOAT[2]], pushK(f, 1142, 0.0022), { fov: 40 });
const S9b = (f: number) => dolly([ROWBOAT[0] + 5.0, 1.35, ROWBOAT[2] + 0.6], [ROWBOAT[0], 0.8, ROWBOAT[2]], pushK(f, F(W.same) - 4, 0.0025), { fov: 40, roll: 0.035 });
// 10 golden side view of the loaded edge (callback), push on "a bridge"
const S10a = (f: number) => dolly([-15, D0 + 0.9, -12], [0, D0 + 1.8, -5], pushK(f, 1313, 0.0022, 0.005, 30), { fov: 40, roll: -0.03 });
// 11-12 one framing across the dissolve: empty piers -> the new bridge on the same piers
const S11a = (f: number) => zoom([15, 10.5, -48], [-1, 9.0, -4], 40, pushK(f, 1414, 0.0018));
const S12a = (f: number) => zoom([15, 10.5, -48], [-1, 9.0, -4], 40, pushK(f, 1414, 0.0018));
const S12b = (f: number) => zoom([15, 10.5, -48], [-1, 9.2, 2], 38, pushK(f, F(W.eighty7) - 6, 0.002, 0.005, 30));
// 13 today: strollers on the green bridge; the closed road end; "Cracks." CU on the tower; crane out
const S13a = (f: number) => dolly([1.7, D0 + 1.75, -16], [0, D0 + 1.5, -9.5], pushK(f, 1579, 0.0025), { fov: 40 });
export const BARRIER_Z = -35.2;
const S13b = (f: number) => dolly([1.6, D0 + 1.55, BARRIER_Z - 9.5], [0.2, D0 + 1.05, BARRIER_Z + 1.5], pushK(f, F(W.closed) - 4, 0.0025, 0.005, 30), { fov: 40 });
export const CRACK: V3 = [-3.35, D0 + 1.85, -27.83];
const S13c = (f: number) => dolly([CRACK[0] + 1.1, CRACK[1] - 0.2, CRACK[2] - 2.9], [CRACK[0] + 0.05, CRACK[1], CRACK[2]], pushK(f, F(W.cracks) - 4, 0.003, 0.006, 24), { fov: 38, roll: 0.03 });
const CRANE: V3[] = [[0, 9, -40], [18, 16, -52], [-1, 7, -2]];
const S13d = (f: number): Shot => {
  const f0 = F(W.cracks) + 36, a = S13c(f0), s = glide((f - f0) / (TOTAL - f0)), r = 1 - s, [C, B, L] = CRANE;
  return { pos: [0, 1, 2].map((i) => r * r * a.pos[i] + 2 * s * r * C[i] + s * s * B[i]) as V3,
    look: [0, 1, 2].map((i) => a.look[i] + (L[i] - a.look[i]) * s) as V3, fov: (a.fov ?? 38) + (42 - (a.fov ?? 38)) * s, roll: (1 - s) * 0.03 };
};

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: F(W.thrilled) - 28, cut: true, s: S1b }],
  2: [{ f: 171, s: S2a }, { f: F(W.hammersmith), dur: 20, s: S2b }, { f: F(W.oxford) - 6, cut: true, s: S2c }],
  3: [{ f: 399, s: S3a }, { f: F(W.road) - 4, cut: true, s: S3b }],
  4: [{ f: 544, s: S4a }, { f: F(W.rush) - 6, cut: true, s: S4b }],
  5: [{ f: 676, s: S5a }, { f: F(W.sway) - 4, cut: true, s: S5b }, { f: F(W.sway) + 4, dur: 22, s: rolled(S5b, -0.04) }],
  6: [{ f: 758, s: S6a }],
  7: [{ f: 811, s: S7a }, { f: F(W.watching) - 4, cut: true, s: S7b }],
  8: [{ f: 870, s: S8a }, { f: F(W.stand) - 4, cut: true, s: S8b }],
  9: [{ f: 1142, s: S9a }, { f: F(W.same) - 4, cut: true, s: S9b }, { f: F(W.tips) - 2, dur: 18, s: rolled(S9b, -0.04) }],
  10: [{ f: 1313, s: S10a }],
  11: [{ f: 1414, s: S11a }],
  12: [{ f: 1414, s: S12a }, { f: F(W.eighty7) - 6, dur: 30, s: S12b }],
  13: [{ f: 1579, s: S13a }, { f: F(W.closed) - 4, cut: true, s: S13b }, { f: F(W.cracks) - 4, cut: true, s: S13c }, { f: F(W.cracks) + 36, cut: true, s: S13d }],
};

// impact kicks: image offset flips sign every frame, decays to 0 in 7 f
const KICKS: [number, number][] = [[W.tips + 0.02, 0.8], [W.cracks, 0.9]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens: depth of field + foreground framing ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const boatFocus = (f: number): V3 => [boatX(T(f), 0) + 3, 0.9, BOATS[0].z];
export const DOF: Dof[] = [
  { f: 0, cInf: 10, focus: boatFocus }, // hook: the near eight sharp, the deck soft behind
  { f: F(W.thrilled) - 28, cInf: 13 }, // chain CU (focus = look)
  { f: 175, cInf: 0 }, // town aerial
  { f: F(W.oxford) - 6, cInf: 14, focus: boatFocus }, // the eights CU
  { f: 399, cInf: 0 }, // high over the deck
  { f: F(W.road) - 4, cInf: 11, focus: () => [-0.4, D0 + 1.6, -11.5] }, // deck-level crowd MS
  { f: 544, cInf: 0 }, // boats appear (wide)
  { f: F(W.rush) - 6, cInf: 10, focus: () => [-1.2, D0 + 1.6, -9] }, // the rush MS
  { f: 676, cInf: 13 }, // chain CU
  { f: F(W.sway) - 4, cInf: 0 }, // end-on wide of the rolling deck
  { f: 811, cInf: 13, focus: () => [OWN[0], D0 + 1.65, OWN[2]] }, // owners MS (their eyes)
  { f: 878, cInf: 0 }, // golden end-on
  { f: F(W.stand) - 4, cInf: 6 }, // closer end-on: mild, focus = look
  { f: 1148, cInf: 9, focus: () => [ROWBOAT[0] + 0.4, 1.1, ROWBOAT[2]] }, // rowing boat
  { f: 1319, cInf: 7 }, // loaded edge, focus = look
  { f: 1420, cInf: 0 }, // empty piers / new bridge
  { f: 1585, cInf: 0 }, // strollers (busy, kept sharp)
  { f: F(W.closed) - 4, cInf: 9 }, // barrier, focus = look
  { f: F(W.cracks) - 4, cInf: 14 }, // crack CU
  { f: F(W.cracks) + 36, dur: 40, cInf: 0 }, // crane out
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};

/** near framing objects (Kenney GLB names), visible a <= f < b inside their own shot */
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  // owners on the bank: a lantern post at the left edge
  // closed road end: a bush in the bottom-left corner
  { a: F(W.closed) - 4, b: F(W.cracks) - 4, kit: "plant_bushDetailed", pos: [-1.6, D0, BARRIER_Z - 6.0], s: 1.1, yaw: 0.5 },
];
