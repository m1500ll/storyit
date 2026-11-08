// The harbour decor (decor.harbour), on the ground plane y = D0. Land for z >= 0 (a cobbled quay to z = 14, then a
// row of painted waterfront houses facing the sea), the sea for z < 0 (water surface SEA_Y, drawn by world.ts with
// the river's water shader), a stone quay wall along z = 0, a wooden pier from (0, 0) out to z = -40 (deck at D0,
// x -3..3), two sailing ships moored along the quay (bows toward +x), a fishing boat by the pier, a stone breakwater
// with a striped lighthouse at its end (70, -62), bollards, crates, barrels, nets and a wooden cargo crane.
import * as THREE from "three";
import { Batch, boxGeo, V, lam, Kit, house, kitClone } from "./build";
import { ctex, planksHD, stoneHD, cobbleHD } from "./paint";
import { D0 } from "./story";
import type { Decor } from "../spec";

export const SEA_Y = D0 - 2.4;
export const PIER = { x: 3, z: -40 };
export const LIGHTHOUSE: [number, number] = [70, -62];

const cyl = (x: number, z: number, r: number, y0: number, y1: number, n = 14, r1 = r) => { const c = new THREE.CylinderGeometry(r1, r, y1 - y0, n); c.translate(x, (y0 + y1) / 2, z); return c; };
const quadUpUV = (x0: number, x1: number, z0: number, z1: number, y: number, u: number, v: number) => {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const uv = g.attributes.uv!; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
  return g;
};
const stripesTex = () => ctex("lighthouseStripes", 64, 256, (g) => { for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? "#f4f1ea" : "#d6453a"; g.fillRect(0, i * 64, 64, 64); } });
const sailTex = (col: string) => ctex("sail" + col, 128, 128, (g) => {
  g.fillStyle = col; g.fillRect(0, 0, 128, 128); g.strokeStyle = "rgba(0,0,0,0.12)"; g.lineWidth = 2;
  for (let y = 16; y < 128; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y + 4); g.stroke(); }
});

/** a cartoon sailing ship along x (bow toward +x when yaw = 0), keel on the water at (x, z), length 18 * s */
export const shipGeo = (b: Batch, x: number, z: number, s: number, hull: string, sail = "#f4f1ea", yaw = 0) => {
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, SEA_Y, z).multiply(new THREE.Matrix4().makeScale(s, s, s));
  const hullM = lam("hull" + hull, () => ({ color: hull })), deck = lam("shipDeck", () => ({ map: planksHD() })), wood = lam("mastWood", () => ({ color: "#7a5230" }));
  const trim = lam("hullTrim", () => ({ color: "#f0d9a0" })), sailM = lam("sailM" + sail, () => ({ map: sailTex(sail), side: THREE.DoubleSide }));
  // hull: top-view outline (pointed bow at +x, square stern) extruded 2.6 m, its bottom 0.8 m under the water line
  const sh = new THREE.Shape(); sh.moveTo(-9, -2.4); sh.lineTo(5, -2.4); sh.quadraticCurveTo(8.5, -2.2, 9.5, 0); sh.quadraticCurveTo(8.5, 2.2, 5, 2.4); sh.lineTo(-9, 2.4); sh.lineTo(-9, -2.4);
  const hg = new THREE.ExtrudeGeometry(sh, { depth: 2.6, bevelEnabled: false }); hg.rotateX(-Math.PI / 2); hg.translate(0, -0.8, 0);
  b.add(hg, hullM, m);
  const dk = new THREE.ShapeGeometry(sh); dk.rotateX(-Math.PI / 2); dk.translate(0, 1.82, 0); b.add(dk, deck, m);
  const tg = new THREE.ExtrudeGeometry(sh, { depth: 0.25, bevelEnabled: false }); tg.rotateX(-Math.PI / 2); tg.translate(0, 1.55, 0); tg.scale(1.01, 1, 1.03); b.add(tg, trim, m);
  b.add(boxGeo(V(-9, 1.8, -2.4), V(-6.5, 3.4, 2.4)), hullM, m); // stern castle
  for (const [mx, h] of [[-2, 13], [3.5, 11]] as const) {
    b.add(cyl(mx, 0, 0.18, 1.8, 1.8 + h, 10, 0.12), wood, m);
    for (const [y0, w, hh] of [[1.8 + h * 0.3, 3.4, h * 0.32], [1.8 + h * 0.66, 2.6, h * 0.26]] as const) {
      const sail2 = new THREE.BufferGeometry(); // a gently bellied square sail across the ship (in z), facing +x
      const pts: number[] = [], uvs: number[] = [];
      for (let i = 0; i <= 6; i++) for (let j = 0; j <= 1; j++) {
        const u = i / 6, zz = (u - 0.5) * w * 2, belly = 0.5 * Math.sin(u * Math.PI);
        pts.push(mx + 0.25 + belly, y0 + j * hh, zz); uvs.push(u, j);
      }
      const idx: number[] = []; for (let i = 0; i < 6; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      sail2.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); sail2.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); sail2.setIndex(idx); sail2.computeVertexNormals();
      b.add(sail2, sailM, m);
      b.add(cyl(mx + 0.2, 0, 0.07, -w, w, 6).rotateX(Math.PI / 2).translate(0, y0 + hh, 0), wood, m); // yard
    }
  }
  b.add(cyl(9.5, 0, 0.1, 2.2, 2.2 + 0.01, 6), wood, m);
  const bowsprit = new THREE.CylinderGeometry(0.1, 0.12, 5, 8); bowsprit.rotateZ(Math.PI / 2 - 0.35); bowsprit.translate(11, 2.9, 0); b.add(bowsprit, wood, m);
};

export function buildHarbour(root: THREE.Object3D, kit: Kit, d: NonNullable<Decor["harbour"]>) {
  const b = new Batch(), st = new Batch();
  const M = {
    cobble: lam("cobbleHD", () => ({ map: cobbleHD() })),
    wall: lam("quayWall", () => ({ map: stoneHD("quayWallHD", ["#a99d8b", "#9e927f", "#b2a794", "#968a77"], "#7d7262") })),
    cope: lam("quayCope", () => ({ map: stoneHD("quayCopeHD", ["#d6cdbd", "#cbc1b0", "#ded6c8", "#c4b9a7"], "#9e9483") })),
    plank: lam("pierPlanks", () => ({ map: planksHD() })),
    pile: lam("pierPile", () => ({ color: "#6a4a2e" })),
    rock: lam("breakRock", () => ({ color: "#8d8b86" })),
    iron: lam("bollard", () => ({ color: "#2d313a" })),
    crate: lam("crate", () => ({ color: "#b07a44" })),
    barrel: lam("barrel", () => ({ color: "#8a5a34" })),
    stripes: lam("lhStripes", () => ({ map: stripesTex() })),
    white: lam("lhWhite", () => ({ color: "#f4f1ea" })),
    lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.45, 1.0) }),
    net: lam("fishNet", () => ({ color: "#5f7a6a" })),
  };
  // quay paving from the edge to the houses, and the quay wall face down into the water
  b.add(quadUpUV(-400, 400, 0, 14, D0 + 0.01, 800 / 4, 14 / 4), M.cobble);
  const wall = new THREE.PlaneGeometry(800, D0 - SEA_Y + 1.5); wall.rotateY(Math.PI); wall.translate(0, (D0 + SEA_Y - 1.5) / 2, 0.0);
  const wuv = wall.attributes.uv!; for (let i = 0; i < wuv.count; i++) wuv.setXY(i, wuv.getX(i) * 200, wuv.getY(i));
  b.add(wall, M.wall);
  b.add(boxGeo(V(-400, D0 - 0.05, -0.35), V(400, D0 + 0.22, 0.25)), M.cope);
  // pier: deck on piles, a rail on both sides
  b.add(quadUpUV(-PIER.x, PIER.x, PIER.z, 0, D0 + 0.03, 6 / 3, 40 / 3), M.plank);
  b.add(boxGeo(V(-PIER.x, D0 - 0.45, PIER.z), V(PIER.x, D0, 0)), M.pile);
  for (let z = -2; z >= PIER.z; z -= 4) for (const x of [-PIER.x + 0.3, PIER.x - 0.3]) b.add(cyl(x, z, 0.28, SEA_Y - 3, D0, 10), M.pile);
  for (const x of [-PIER.x + 0.1, PIER.x - 0.1]) {
    b.add(boxGeo(V(x - 0.06, D0 + 0.95, PIER.z), V(x + 0.06, D0 + 1.07, 0)), M.pile);
    for (let z = -1; z >= PIER.z; z -= 3) b.add(boxGeo(V(x - 0.06, D0, z - 0.06), V(x + 0.06, D0 + 1.0, z + 0.06)), M.pile);
  }
  // bollards along the quay edge, crates, barrels and nets on the quay, a wooden cargo crane
  for (let x = -120; x <= 120; x += 12) if (Math.abs(x) > 5) { b.add(cyl(x, 1.0, 0.25, D0, D0 + 0.6, 12), M.iron); b.add(cyl(x, 1.0, 0.33, D0 + 0.6, D0 + 0.75, 12), M.iron); }
  const stacks: [number, number][] = [[-14, 6], [-17, 7.5], [12, 5.5], [16, 8], [26, 6.5], [-30, 7]];
  stacks.forEach(([x, z], i) => {
    b.add(boxGeo(V(x - 0.6, D0, z - 0.6), V(x + 0.6, D0 + 1.2, z + 0.6)), M.crate);
    if (i % 2) b.add(boxGeo(V(x - 0.5, D0 + 1.2, z - 0.45), V(x + 0.5, D0 + 2.1, z + 0.45)), M.crate);
    b.add(cyl(x + 1.6, z + 0.3, 0.45, D0, D0 + 1.1, 14), M.barrel);
  });
  b.add(boxGeo(V(-8, D0, 9), V(-5, D0 + 0.35, 11)), M.net);
  b.add(cyl(36, 4, 0.35, D0, D0 + 9, 10), M.pile);
  const jib = new THREE.CylinderGeometry(0.22, 0.22, 10, 8); jib.rotateZ(Math.PI / 2 - 0.5); jib.translate(36 + 4, D0 + 10.5, 4 - 2); b.add(jib, M.pile);
  b.add(boxGeo(V(43.5, D0 + 3, -0.6), V(44.5, D0 + 4, 0.4)), M.crate); // a crate hanging from the crane
  // waterfront houses facing the sea
  let k = 0;
  for (let x = -96; x <= 96; x += 12) { if (Math.abs(x) < 4) { x += 0; } house(st, x, 20, Math.PI, 10, 10, 7 + ((k * 37) % 6), (k * 3) % 6); k++; }
  // ships moored along the quay, a fishing boat by the pier
  shipGeo(b, -34, -7.5, 1, d.hull ?? "#a8643a", "#f4f1ea");
  shipGeo(b, 34, -7.5, 0.85, "#2f4f6f", "#efe3c8");
  shipGeo(b, -9, -24, 0.38, "#d6453a", "#f4f1ea", Math.PI / 2);
  // breakwater of rocks out to the lighthouse
  for (let i = 0; i < 26; i++) {
    const x = 20 + i * 2.0, z = LIGHTHOUSE[1] + Math.sin(i * 1.7) * 0.8, r = 1.6 + (i % 3) * 0.5;
    const rk = new THREE.IcosahedronGeometry(r, 0); rk.translate(x, SEA_Y + 0.2, z); b.add(rk, M.rock);
  }
  const [lx, lz] = LIGHTHOUSE;
  b.add(cyl(lx, lz, 3.4, SEA_Y - 1, SEA_Y + 2.5, 20), M.rock);
  const tower = new THREE.CylinderGeometry(1.5, 2.3, 14, 20, 1, true); tower.translate(lx, SEA_Y + 2.5 + 7, lz); b.add(tower, M.stripes);
  b.add(cyl(lx, lz, 2.1, SEA_Y + 16.5, SEA_Y + 17, 20), M.iron);
  b.add(cyl(lx, lz, 1.2, SEA_Y + 17, SEA_Y + 19, 16), M.lamp);
  const cap = new THREE.ConeGeometry(1.7, 1.6, 16); cap.translate(lx, SEA_Y + 19.8, lz); b.add(cap, M.iron);
  // a few trees and lanterns along the houses
  for (const x of [-60, -24, 24, 60]) { const t = kitClone(kit, "lantern", 2.4); if (t) { t.position.set(x, D0, 12.5); root.add(t); } }
  b.build(root);
  st.build(root, false);
}
