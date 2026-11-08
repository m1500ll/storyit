// The castle decor (decor.castle): a medieval castle centred on the origin on the ground plane y = D0. A square
// curtain wall (outer faces at x, z = +-30, 9 m high, 2.4 m thick, crenellated) around a cobbled courtyard, a round
// tower at each corner (r 4.2 m, 15 m, cone roof), a square keep at the back (x -8..8, z -24..-8, 21 m, crenellated,
// cone-roofed turrets), a gatehouse in the front wall (z = +30) whose gate (x -2.6..2.6, 6 m high) has a raised
// portcullis and open doors, a well in the courtyard and banners on the towers. Static: one Batch.
import * as THREE from "three";
import { Batch, boxGeo, V, lam, Kit, kitClone } from "./build";
import { stoneHD, cobbleHD, roofHD, planksHD } from "./paint";
import { D0 } from "./story";
import type { Decor } from "../spec";

export const CASTLE = { half: 30, wallH: 9, thick: 2.4, towerR: 4.2, towerH: 15, keep: [-8, -24, 8, -8] as const, keepH: 21, gateW: 2.6, gateH: 6 };

/** merlons along a straight wall top from (x0, z0) to (x1, z1) */
const merlons = (b: Batch, m: THREE.Material, x0: number, z0: number, x1: number, z1: number, y: number, t: number) => {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / 2.2), dx = (x1 - x0) / len, dz = (z1 - z0) / len;
  for (let i = 0; i < n; i++) {
    const c = (i + 0.5) * (len / n), cx = x0 + dx * c, cz = z0 + dz * c, hw = 0.6;
    const ex = Math.abs(dx) * hw + Math.abs(dz) * t / 2, ez = Math.abs(dz) * hw + Math.abs(dx) * t / 2;
    b.add(boxGeo(V(cx - ex, y, cz - ez), V(cx + ex, y + 1.3, cz + ez), 1), m);
  }
};

const tower = (b: Batch, M: Record<string, THREE.Material>, x: number, z: number, r: number, h: number, roof: string) => {
  const c = new THREE.CylinderGeometry(r, r * 1.06, h, 28, 1, true); c.translate(x, D0 + h / 2, z);
  b.add(c, M.stone!);
  const top = new THREE.CylinderGeometry(r + 0.45, r + 0.45, 1.0, 28); top.translate(x, D0 + h + 0.5, z); // corbelled parapet ring
  b.add(top, M.cope!);
  for (let k = 0; k < 12; k++) { // merlons around the ring
    const a = (k / 12) * Math.PI * 2, mx = x + Math.cos(a) * (r + 0.2), mz = z + Math.sin(a) * (r + 0.2);
    const mg = new THREE.BoxGeometry(1.0, 1.3, 0.6); mg.rotateY(-a + Math.PI / 2); mg.translate(mx, D0 + h + 1.65, mz);
    b.add(mg, M.stone!);
  }
  const cone = new THREE.ConeGeometry(r + 0.7, r * 2.2, 28); cone.translate(x, D0 + h + 1.0 + r * 1.1, z);
  b.add(cone, lam("roof" + roof, () => ({ map: roofHD(roof, true) })));
  for (let k = 0; k < 3; k++) { // arrow slits
    const a = 0.6 + k * 2.1, sx = x + Math.cos(a) * (r + 0.02), sz = z + Math.sin(a) * (r + 0.02);
    const sg = new THREE.BoxGeometry(0.25, 1.5, 0.12); sg.rotateY(-a + Math.PI / 2); sg.translate(sx, D0 + h * 0.6, sz);
    b.add(sg, M.dark!);
  }
};

export function buildCastle(root: THREE.Object3D, kit: Kit, d: NonNullable<Decor["castle"]>) {
  const C = CASTLE, H = C.half, T = C.thick, roof = d.roof ?? "#5a6a8c";
  const b = new Batch();
  const M: Record<string, THREE.Material> = {
    stone: lam("castleStone", () => ({ map: stoneHD("castleStoneHD", ["#c9bfae", "#bdb29f", "#d3c9b8", "#b4a893"], "#8f8573") })),
    cope: lam("castleCope", () => ({ map: stoneHD("castleCopeHD", ["#ddd4c4", "#d2c8b7", "#e4dccd", "#cbc0ae"], "#a49a89") })),
    cobble: lam("cobbleHD", () => ({ map: cobbleHD() })),
    wood: lam("gateWood", () => ({ map: planksHD() })),
    iron: lam("portcullis", () => ({ color: "#3d414c" })),
    dark: lam("slitDark", () => ({ color: "#241f2b" })),
    rope: lam("wellRoof", () => ({ map: roofHD("#8c4a3a") })),
  };
  // courtyard paving (1 cm up)
  const pave = new THREE.PlaneGeometry((H - T) * 2, (H - T) * 2).rotateX(-Math.PI / 2).translate(0, D0 + 0.01, 0);
  const uv = pave.attributes.uv!; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ((H - T) * 2) / 4, uv.getY(i) * ((H - T) * 2) / 4); // one cobble tile per 4 m, as on the quays
  b.add(pave, M.cobble!);
  // curtain walls; the front one (z = +H) leaves the gate open
  const y1 = D0 + C.wallH;
  b.add(boxGeo(V(-H, D0 - 0.5, -H), V(H, y1, -H + T), 2), M.stone!);
  b.add(boxGeo(V(-H, D0 - 0.5, -H), V(-H + T, y1, H), 2), M.stone!);
  b.add(boxGeo(V(H - T, D0 - 0.5, -H), V(H, y1, H), 2), M.stone!);
  b.add(boxGeo(V(-H, D0 - 0.5, H - T), V(-C.gateW - 3, y1, H), 2), M.stone!);
  b.add(boxGeo(V(C.gateW + 3, D0 - 0.5, H - T), V(H, y1, H), 2), M.stone!);
  // wall walk copings and merlons on both faces' outer edge
  for (const [x0, z0, x1, z1] of [[-H, -H + 0.3, H, -H + 0.3], [-H + 0.3, -H, -H + 0.3, H], [H - 0.3, -H, H - 0.3, H], [-H, H - 0.3, -C.gateW - 3, H - 0.3], [C.gateW + 3, H - 0.3, H, H - 0.3]] as const)
    merlons(b, M.stone!, x0, z0, x1, z1, y1, 0.6);
  // gatehouse: two square towers flanking the gate, a passage roof, a raised portcullis and two open doors
  const gw = C.gateW, gt = 3;
  for (const s of [-1, 1]) {
    const xa = s * gw, xb = s * (gw + gt);
    b.add(boxGeo(V(Math.min(xa, xb), D0 - 0.5, H - T - 1.5), V(Math.max(xa, xb), D0 + 12.5, H + 1.5), 2), M.stone!);
    merlons(b, M.stone!, Math.min(xa, xb), H + 1.2, Math.max(xa, xb), H + 1.2, D0 + 12.5, 0.6);
    const door = new THREE.BoxGeometry(gw, C.gateH, 0.2); door.translate(s * gw / 2, 0, 0); door.rotateY(s * 1.35); door.translate(s * gw, D0 + C.gateH / 2, H - T - 1.2);
    b.add(door, M.wood!);
  }
  b.add(boxGeo(V(-gw, D0 + C.gateH, H - T - 1.5), V(gw, D0 + 12.5, H + 1.5), 2), M.stone!); // above the passage
  merlons(b, M.stone!, -gw, H + 1.2, gw, H + 1.2, D0 + 12.5, 0.6);
  for (let i = 0; i <= 6; i++) b.add(boxGeo(V(-gw + i * (gw * 2 / 6) - 0.07, D0 + C.gateH - 1.4, H + 0.9), V(-gw + i * (gw * 2 / 6) + 0.07, D0 + C.gateH, H + 1.05)), M.iron!);
  b.add(boxGeo(V(-gw, D0 + C.gateH - 1.0, H + 0.88), V(gw, D0 + C.gateH - 0.85, H + 1.07)), M.iron!);
  b.add(boxGeo(V(-gw, D0 + C.gateH - 0.2, H + 0.88), V(gw, D0 + C.gateH, H + 1.07)), M.iron!);
  // corner towers
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) tower(b, M, sx * (H - 1), sz * (H - 1), C.towerR, C.towerH, roof);
  // keep: a tall square block with slits, a parapet, merlons and four turrets
  const [kx0, kz0, kx1, kz1] = C.keep, ky = D0 + C.keepH;
  b.add(boxGeo(V(kx0, D0 - 0.5, kz0), V(kx1, ky, kz1), 2), M.stone!);
  b.add(boxGeo(V(kx0 - 0.4, ky, kz0 - 0.4), V(kx1 + 0.4, ky + 0.9, kz1 + 0.4), 2), M.cope!);
  for (const [x0, z0, x1, z1] of [[kx0, kz1 + 0.1, kx1, kz1 + 0.1], [kx0, kz0 - 0.1, kx1, kz0 - 0.1], [kx0 - 0.1, kz0, kx0 - 0.1, kz1], [kx1 + 0.1, kz0, kx1 + 0.1, kz1]] as const)
    merlons(b, M.stone!, x0, z0, x1, z1, ky + 0.9, 0.6);
  for (const [x, z] of [[kx0, kz0], [kx1, kz0], [kx0, kz1], [kx1, kz1]] as const) tower(b, M, x, z, 1.8, C.keepH + 4, roof);
  for (let r = 0; r < 3; r++) for (const x of [-4, 0, 4]) b.add(boxGeo(V(x - 0.18, D0 + 5 + r * 5, kz1 + 0.01), V(x + 0.18, D0 + 6.6 + r * 5, kz1 + 0.06)), M.dark!);
  b.add(boxGeo(V(-1.6, D0, kz1 + 0.01), V(1.6, D0 + 3.6, kz1 + 0.12)), M.wood!); // keep door
  // well
  const well = new THREE.CylinderGeometry(1.2, 1.2, 1.0, 20); well.translate(10, D0 + 0.5, 6); b.add(well, M.stone!);
  for (const s of [-1, 1]) b.add(boxGeo(V(10 + s * 1.0 - 0.08, D0 + 1, 5.92), V(10 + s * 1.0 + 0.08, D0 + 2.8, 6.08)), M.wood!);
  const wr = new THREE.ConeGeometry(1.7, 1.0, 4); wr.rotateY(Math.PI / 4); wr.translate(10, D0 + 3.2, 6); b.add(wr, M.rope!);
  b.build(root, false); // no cast shadows: a low golden sun would put the whole courtyard in shade
  // banners on the corner towers and the gate (Kenney banners), in the castle's colour
  const banner = d.banner === "green" ? "banner-green" : "banner-red";
  for (const [x, z] of [[-H + 1, H - 1 + C.towerR], [H - 1, H - 1 + C.towerR], [-gw - gt / 2, H + 1.6], [gw + gt / 2, H + 1.6]] as const) {
    const o = kitClone(kit, banner, 3.2);
    if (!o) continue;
    o.position.set(x, D0 + (Math.abs(x) > 10 ? C.towerH - 5.5 : 8.2), z); root.add(o);
  }
}
