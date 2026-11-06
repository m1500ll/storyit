// Where every member of every spec group is at time t, what they do and which face they make. Shared by the camera
// (subjects, focus) and the cast (drawing). Deterministic: same spec + same t = same picture on every render tab.
import type { Action, Expr, Group, Outfit, V2 } from "../spec";
import { clamp01, smooth } from "./math";

export const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };

export type Member = {
  gi: number; i: number; key: number; outfit: Outfit; scale: number;
  x: number; z: number; moving: boolean; dirX: number; dirZ: number;
  mode: "stand" | "stroll" | "sit"; expr: Expr; wave?: number; onDeck: boolean;
};

type ActT = Action & { t: number };
export type GroupRt = { g: Group; gi: number; homes: V2[]; acts: ActT[]; enterT: number | null };

const outfitOf = (g: Group, i: number): Outfit => (Array.isArray(g.outfit) ? g.outfit[i % g.outfit.length]! : { ...g.outfit, variant: (g.outfit.variant ?? 0) + i });

export const homesOf = (g: Group): V2[] => {
  if (g.at && !g.count) return [g.at];
  const n = Math.max(1, g.count ?? 1);
  const [x0, z0, x1, z1] = g.area ?? [g.at?.[0] ?? 0, g.at?.[1] ?? 0, g.at?.[0] ?? 0, g.at?.[1] ?? 0];
  const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
  // grid with as many columns as the aspect allows, then jitter (no two people on the same spot)
  const cols = Math.max(1, Math.round(Math.sqrt((n * Math.max(w, 0.5)) / Math.max(d, 0.5))));
  const rows = Math.ceil(n / cols), out: V2[] = [];
  for (let k = 0; k < n; k++) {
    const c = k % cols, r = Math.floor(k / cols);
    const u = cols > 1 ? c / (cols - 1) : 0.5, v = rows > 1 ? r / (rows - 1) : 0.5;
    const jx = (hh(k, 1) - 0.5) * (w / Math.max(cols, 1)) * 0.6, jz = (hh(k, 2) - 0.5) * (d / Math.max(rows, 1)) * 0.6;
    out.push([Math.min(x0, x1) + u * w + jx, Math.min(z0, z1) + v * d + jz]);
  }
  return out;
};

const railX = (side: "rail_minus_x" | "rail_plus_x", i: number) => (side === "rail_minus_x" ? -1 : 1) * (2.05 - 1.9 * hh(i, 7) ** 1.6);
const defaultExpr: Record<Action["do"], Expr[]> = {
  stand: ["smile", "smile_closed", "neutral", "grin"], walk: ["smile", "grin"], stroll: ["smile", "smile_closed", "grin", "smile"],
  sit: ["smile", "relief"], cheer: ["laugh", "grin", "laugh", "smile"],
};

/** state of member i of group rt at time t (seconds) */
export const memberAt = (rt: GroupRt, i: number, t: number): Member | null => {
  const g = rt.g, home = rt.homes[i]!;
  let x = home[0], z = home[1], moving = false, dirX = 0, dirZ = 0, mode: Member["mode"] = "stand";
  let expr: Expr = defaultExpr.stand[i % 4]!, wave: number | undefined;
  // walking in from the nearest bridge end (deck groups) or from off-screen +-12 m along z
  if (rt.enterT !== null) {
    const arrive = rt.enterT + 1.6 * hh(i, 3), walk = 1.5;
    const from = g.onDeck ? Math.sign(home[1] || 1) * 31 : home[1] + (hh(i, 4) < 0.5 ? -12 : 12);
    const dur = Math.abs(from - home[1]) / walk, start = arrive - dur;
    if (t < start) return null;
    if (t < arrive) { z = from + (home[1] - from) * ((t - start) / dur); moving = true; dirZ = Math.sign(home[1] - from); mode = "stroll"; expr = "smile"; }
  }
  const mine = rt.acts.filter((a) => !a.who || a.who.includes(i));
  for (let k = 0; k < mine.length; k++) {
    const a = mine[k]!;
    if (t < a.t) break;
    const tEnd = Math.min(t, mine[k + 1]?.t ?? Infinity), dt = tEnd - a.t;
    const ex = a.expr ? (Array.isArray(a.expr) ? a.expr[i % a.expr.length]! : a.expr) : defaultExpr[a.do][i % defaultExpr[a.do].length]!;
    expr = ex; wave = undefined; moving = false; dirX = dirZ = 0; mode = "stand";
    if (a.do === "walk" && a.to) {
      const tx = typeof a.to === "string" ? railX(a.to, i) : a.to[0], tz = typeof a.to === "string" ? z : a.to[1];
      const dist = Math.hypot(tx - x, tz - z), sp = a.speed ?? 1.4, dur = Math.max(0.4, dist / sp) * (0.85 + 0.3 * hh(i, 5));
      const lag = 0.45 * hh(i, 6), u = smooth((dt - lag) / dur);
      if (u > 0 && u < 1) { moving = true; mode = "stroll"; dirX = Math.sign(tx - x); dirZ = Math.abs(tz - z) > Math.abs(tx - x) ? Math.sign(tz - z) : 0; }
      x += (tx - x) * u; z += (tz - z) * u;
    } else if (a.do === "stroll") {
      const sp = (a.speed ?? 0.8) * (0.7 + 0.6 * hh(i, 8)), dir = i % 2 ? 1 : -1;
      const [, z0, , z1] = g.area ?? [0, home[1] - 15, 0, home[1] + 15];
      const span = Math.max(4, Math.abs(z1 - z0)), lo = Math.min(z0, z1);
      z = lo + ((((z - lo + dir * sp * dt) % span) + span) % span);
      moving = true; mode = "stroll"; dirZ = dir;
    } else if (a.do === "sit") mode = "sit";
    else if (a.do === "cheer") wave = i % 3 === 2 ? undefined : Math.round(Math.sin(t * 9 + i * 1.3) * 30) / 30;
  }
  return { gi: rt.gi, i, key: rt.gi * 1000 + i, outfit: outfitOf(g, i), scale: g.scale ?? (outfitOf(g, i).name === "kid" ? 0.72 : 1),
    x, z, moving, dirX, dirZ, mode, expr, wave, onDeck: !!g.onDeck };
};

export const centroid = (rt: GroupRt, t: number): V2 => {
  let sx = 0, sz = 0, n = 0;
  for (let i = 0; i < rt.homes.length; i++) { const m = memberAt(rt, i, t); if (m) { sx += m.x; sz += m.z; n++; } }
  return n ? [sx / n, sz / n] : rt.homes[0]!;
};
export { clamp01 };
