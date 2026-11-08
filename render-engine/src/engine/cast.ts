// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, swingKid, soldier, townsfolk, OFFICER, KID, PARENT, fxNote, fxBurst, fxSplash, fxStars, fxCreak, fxRing, fxBlob, fxShadow, fxContact, fxPlank, fxDrum,
  OWNER, ROWER, PLAYER, REFEREE, KNIGHT, KING, QUEEN, PEASANT, modern, fxCrack, fxTophat,
  Outfit, Expr, FrontOpts, SideOpts,
} from "./toon";
import {
  FPS, D0, SHOTS, TL, GROUPS, V3, deckY, deckX, smooth, clamp01, BridgeState, BOAT_LEN, boatX, strokeAt, rowboatRoll, piece, groupVisible,
} from "./story";
import { memberAt } from "./crowd";
import type { Outfit as SpecOutfit } from "../spec";
import { LIGHTS } from "./lights";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
export const SU_SWING = 2.3 / 1830; // swing canvas: rope of 1830 units = 2.3 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const SOLDIER = [0, 1, 2, 3].map((v) => soldier(v));
const BARE = [0, 1, 2, 3].map((v) => soldier(v, { hat: null }));
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));
const vOf = (i: number) => (i * 7 + (i >> 2)) % 4;
/** head-shape seed: 7 shapes, so marching soldiers in step still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- spec-driven staging ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };

const near = (cam: CamInfo, x: number, y: number, z: number, r: number) => cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) < r;
const OUT = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));
/** spec outfit -> toon outfit + a stable key for the canvas pool */
const outfitOf = (o: SpecOutfit): { o: Outfit; key: string } => {
  const v = o.variant ?? 0;
  switch (o.name) {
    case "kid": return { o: KID, key: "kid" };
    case "owner": return { o: OWNER(v % 2), key: `own${v % 2}` };
    case "modern": return { o: modern(v), key: `m${v % 7}` };
    case "soldier": return { o: SOLDIER[vOf(v)]!, key: `s${vOf(v)}` };
    case "officer": return { o: OFFICER, key: "off" };
    case "rower": return { o: ROWER(o.color ?? "#22306a", v), key: `r${o.color}${v % 4}` };
    case "player": return { o: PLAYER(o.color ?? "#e2453c", v), key: `p${o.color}${v % 10}` };
    case "referee": return { o: REFEREE, key: "ref" };
    case "knight": return { o: KNIGHT(o.color ?? "#3f6fb5", v), key: `kn${o.color}${v % 4}` };
    case "king": return { o: KING, key: "king" };
    case "queen": return { o: QUEEN, key: "queen" };
    case "peasant": return { o: PEASANT(v), key: `pe${v % 12}` };
    default: return { o: OUT[v % 6]!, key: `f${v % 6}` };
  }
};

/** every member of every group that is visible in shot id */
const groups = (id: number, t: number, b: BridgeState, cam: CamInfo, out: Stage) => {
  for (const rt of GROUPS) {
    if (!groupVisible(id, rt.g.id)) continue;
    for (let i = 0; i < rt.homes.length; i++) {
      const m = memberAt(rt, i, t);
      if (!m) continue;
      const x = m.x + (m.onDeck ? deckX(m.z, b) : 0), y = m.onDeck ? deckY(m.z, b, m.x) : D0, z = m.z;
      if (near(cam, x, y, z, 3.0 * m.scale + 0.4)) continue;
      const { o, key } = outfitOf(m.outfit);
      const who: Who = { i: m.key, o, okey: key };
      const far = cam.pos.distanceTo(tmp.set(x, y, z)) > 18;
      const blink = far ? 0 : lidAt(t, m.key);
      const phase = m.moving ? q((t * 1.6 + hh(m.key, 5)) % 1, 24) : 0;
      const view = m.moving ? viewOf(cam, x, z, m.dirX, m.dirZ) : { side: false, mirror: false, fs: 1 };
      const fo: FrontOpts = { mode: m.moving ? "stroll" : m.mode === "sit" ? "sit" : "stand", phase, expr: m.expr, blink, wave: m.moving ? undefined : m.wave, look: m.dirX < 0 ? -1 : m.dirX > 0 ? 1 : 0 };
      const so: SideOpts = { mode: "march", phase, expr: m.expr, blink, stomp: 0.5, stride: 0.8 * view.fs };
      out.places.push(person(cam, who, x, y, z, view, fo, so, m.scale));
      if (m.mode !== "sit" && cam.pos.distanceTo(tmp.set(x, y, z)) < 45) blob(out, x, y, z, m.scale);
    }
  }
};

/** the racing eights' crews (8 rowers + cox each), sitting in their shells, swinging with the stroke */
const crews = (cam: CamInfo, t: number, out: Stage) => {
  const p = piece("eights");
  if (!p) return;
  [0, 1].forEach((k) => {
    const x0 = boatX(t, k), ph = strokeAt(t, k), surge = 0.12 * Math.sin(2 * Math.PI * ph), z = p.lanes[k]!, kit = p.colors[k]!;
    if (Math.abs(cam.pos.x - x0) > 70) return;
    for (let i = 0; i < 9; i++) {
      const cox = i === 8, x = cox ? x0 + surge - BOAT_LEN * 0.5 + 1.6 : x0 + surge + BOAT_LEN * 0.5 - 4.2 - i * 1.42 - 0.35;
      if (near(cam, x, 0.1, z, 1.8)) continue;
      const who: Who = { i: 500 + k * 10 + i, o: cox ? { ...ROWER(kit, i), build: "kid" } : ROWER(kit, i), okey: `r${kit}${i % 4}${cox ? "c" : ""}` };
      const drive = ph < 0.42, lean = cox ? 0 : q(drive ? 16 - 32 * smooth(ph / 0.42) : -16 + 32 * smooth((ph - 0.42) / 0.58), 4);
      const fo: FrontOpts = { mode: "sit", expr: cox ? "laugh" : drive ? "stern" : "neutral", blink: lidAt(t, 500 + i), tilt: lean, look: 0 };
      out.places.push(person(cam, who, x, 0.16, z, { side: false, mirror: false }, fo, {}, cox ? 0.8 : 0.95));
    }
  });
};

/** the rowing boat and its four passengers: lean on `lean`, tip on `tip` (a top hat goes overboard) */
const rowboat = (cam: CamInfo, t: number, out: Stage) => {
  const p = piece("rowboat");
  if (!p) return;
  const RB: V3 = [p.at[0], 0, p.at[1]], tl = TL.t(p.lean), tt = TL.t(p.tip);
  const r = rowboatRoll(t), lean = smooth((t - tl + 0.1) / 0.6);
  const by = 0.02 + 0.03 * Math.sin(t * 2.1) - 0.25 * Math.abs(Math.sin(r));
  const SEATS: [number, number][] = [[-0.62, 0.34], [-0.62, -0.34], [0.62, 0.34], [0.62, -0.34]];
  SEATS.forEach(([bx, bz0], i) => {
    const bz = bz0 - 0.34 * lean - (bz0 > 0 ? 0.12 * lean : 0), yl = 0.36;
    const wy = by + yl * Math.cos(r) - bz * Math.sin(r), wz = RB[2] + yl * Math.sin(r) + bz * Math.cos(r);
    const expr: Expr = t < tl - LEAD ? (["smile", "grin", "smile_closed", "smile"] as Expr[])[i]! : t < tt - LEAD ? (["grin", "laugh", "grin", "laugh"] as Expr[])[i]! : "shock";
    const hatless = i === 1 && t >= tt;
    const o = hatless ? { ...OUT[2]!, hat: "hair", hair: "#5a3b2a" } : OUT[[0, 2, 1, 3][i]!]!;
    const who: Who = { i: i + 800, o, okey: hatless ? "bald2" : `f${[0, 2, 1, 3][i]}` };
    const tilt = q(-(r * 57.3) * 0.5 + 18 * lean, 4);
    const fo: FrontOpts = { mode: "sit", expr, blink: lidAt(t, i + 800), tilt, look: lean > 0.5 ? 1 : 0 };
    out.places.push(person(cam, who, RB[0] + bx, wy, wz, { side: false, mirror: false }, fo, {}, 0.95));
  });
  const u = (t - tt) / 0.75;
  if (u > 0) {
    const k = Math.min(1, u), hx = RB[0] - 0.62 + 0.3 * k, hz = RB[2] - 0.5 - 1.3 * k, hy = Math.max(0.05, 1.45 + 1.1 * k - 2.6 * k * k);
    out.fx.push({ key: "tophat", cw: 200, ch: 200, draw: fxTophat, x: hx, y: hy + 0.1 * Math.sin(t * 2), z: hz, w: 0.36, h: 0.36, rot: 2.4 * k });
    if (u > 0.9) {
      const v = q(((t - tt - 0.7) * 0.6) % 1, 240);
      out.fx.push({ key: `ring${v}`, cw: 600, ch: 600, draw: (pp) => fxRing(pp, v), x: hx, y: 0.03, z: hz, w: 1.4, h: 1.4, flat: true });
    }
    if (u > 0.85 && u < 1.85) {
      const v = q((u - 0.85) / 1.0, 30);
      out.fx.push({ key: `splash${v}`, cw: 800, ch: 800, draw: (pp) => fxSplash(pp, v), x: hx, y: 0.45, z: hz, w: 1.3, h: 1.3 });
    }
  }
  const v = (t - tt + 0.02) / 0.6;
  if (v > 0 && v < 1) out.fx.push({ key: `splash${q(v, 30)}`, cw: 800, ch: 800, draw: (pp) => fxSplash(pp, q(v, 30)), x: RB[0] + 0.3, y: 0.7, z: RB[2] - 1.0, w: 2.6, h: 2.6 });
  out.fx.push({ key: `ring${q(((t * 0.4) % 1), 240)}`, cw: 600, ch: 600, draw: (pp) => fxRing(pp, q(((t * 0.4) % 1), 240)), x: RB[0], y: 0.03, z: RB[2], w: 6, h: 6, flat: true });
};

/** the shot's effect cards: creaks, a growing crack, splashes, bursts, stars */
const fxCards = (id: number, t: number, out: Stage) => {
  for (const e of SHOTS[id - 1]!.spec.fx ?? []) {
    const t0 = TL.t(e.from), t1 = e.to ? TL.t(e.to) : t0 + (e.kind === "crack" ? 1e9 : e.kind === "creak" ? 1.6 : 0.6);
    if (t < t0 - 2 / FPS || t >= t1) continue;
    const [x, y, z] = e.at, sz = e.size ?? (e.kind === "crack" ? 0.95 : e.kind === "splash" ? 2.6 : 0.8);
    if (e.kind === "creak") creakFx(t, [e.at, [x + 0.05, y, z + 2.5], [x + 0.1, y, z - 2.5]], out, sz);
    else if (e.kind === "crack") {
      const u = q(Math.min(1, (t - t0 + 2 / FPS) / (6 / FPS)), 30);
      out.fx.push({ key: `crack${u}`, cw: 400, ch: 400, draw: (pp) => fxCrack(pp, u), x, y, z, w: sz, h: sz });
    } else {
      const u = q(clamp01((t - t0) / Math.max(0.1, t1 - t0)), 30);
      const draw = e.kind === "splash" ? (pp: Pen) => fxSplash(pp, u) : e.kind === "burst" ? (pp: Pen) => fxBurst(pp, u) : (pp: Pen) => fxStars(pp, u);
      const [cw, ch] = e.kind === "stars" ? [420, 210] : e.kind === "splash" ? [800, 800] : [500, 500];
      out.fx.push({ key: `${e.kind}${u}`, cw, ch, draw, x, y, z, w: sz, h: e.kind === "stars" ? sz / 2 : sz });
    }
  }
};

export const SIGN_AT = (): V3 => [0, D0, (piece("barrier")?.z ?? -35.2) - 0.1];

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, b: BridgeState, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1]!;
  LNAME = s.light;
  findSun(cam, SUN);
  groups(id, t, b, cam, out);
  if (s.show.includes("eights")) crews(cam, t, out);
  if (s.show.includes("rowboat")) rowboat(cam, t, out);
  fxCards(id, t, out);
  return out;
};

export const creakFx = (t: number, pts: V3[], out: Stage, size = 0.8) =>
  pts.forEach(([x, y, z], i) => {
    const u = q((t * 1.3 + i * 0.37) % 1, 30);
    out.fx.push({ key: `creak${u}`, cw: 300, ch: 300, draw: (p) => fxCreak(p, u), x, y, z, w: size, h: size, rot: i * 0.6 - 0.6 });
  });
export { FPS };
