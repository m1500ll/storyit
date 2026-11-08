// The desert decor (decor.desert), on sand (ground "sand") at y = D0: the three pyramids of a Giza-like plateau far
// behind (the great one centred on (0, -170), 110 m wide and 75 m tall; two smaller ones), the Sphinx lying at
// (26, -62) facing +z, an obelisk at (-12, -20), an oasis pool with palm trees at (-30, 12), a market of tents at
// x 8..22, z 4..16, stacks of quarry blocks on sledges at (-26, -40), and soft dunes on the horizon. Camels and other
// animals are story drawings (spec.art). Static: one Batch.
import * as THREE from "three";
import { Batch, boxGeo, V, lam, Kit, kitClone } from "./build";
import { ctex } from "./paint";
import { D0 } from "./story";
import type { Decor } from "../spec";

export const PYRAMIDS: [number, number, number, number][] = [[0, -170, 110, 75], [-115, -215, 80, 55], [95, -240, 50, 34]]; // x, z, base, height
export const SPHINX: [number, number] = [26, -62];
export const OBELISK: [number, number] = [-12, -20];
export const OASIS: [number, number, number] = [-30, 12, 6];

const blocksTex = () => ctex("pyramidBlocks", 512, 512, (g, r) => {
  g.fillStyle = "#cf9a52"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(110,70,30,0.5)"; g.lineWidth = 3;
  for (let y = 0; y <= 512; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); const off = (y / 32) % 2 ? 24 : 0; for (let x = off; x <= 512; x += 48) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); } }
  for (let i = 0; i < 1500; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,240,200,0.12)" : "rgba(120,80,40,0.1)"; g.fillRect(r() * 512, r() * 512, 3, 3); }
});
const stoneTex = () => ctex("sphinxStone", 256, 256, (g, r) => {
  g.fillStyle = "#c9995a"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? "rgba(140,100,50,0.15)" : "rgba(255,240,210,0.15)"; g.fillRect(r() * 256, r() * 256, 2 + r() * 4, 2 + r() * 3); }
});
const nemesTex = () => ctex("nemesStripes", 64, 128, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#3a5fa8" : "#e8c45a"; g.fillRect(0, i * 16, 64, 16); } });
/** wind-rippled sand for the desert ground (world.ts tiles it like the grass: about 4 m per tile) */
export const sandTex = () => ctex("sandHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#e8cc92"; g.fillRect(0, 0, 1024, 1024);
  for (let y = 0; y < 1024; y += 18) { g.strokeStyle = "rgba(190,150,90,0.22)"; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= 1024; x += 16) g.lineTo(x, y + 6 * Math.sin(x / 70 + y)); g.stroke(); }
  for (let i = 0; i < 6000; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,245,215,0.18)" : "rgba(170,130,70,0.12)"; g.fillRect(r() * 1024, r() * 1024, 2, 2); }
});
const cyl = (x: number, z: number, r0: number, r1: number, y0: number, y1: number, n = 12) => { const c = new THREE.CylinderGeometry(r1, r0, y1 - y0, n); c.translate(x, (y0 + y1) / 2, z); return c; };

/** a palm: a gently leaning ringed trunk and a crown of drooping fronds */
const palm = (b: Batch, M: Record<string, THREE.Material>, x: number, z: number, h: number, lean: number) => {
  const segs = 6;
  let px = x, py = D0, pz = z;
  for (let i = 0; i < segs; i++) {
    const nx = x + lean * h * ((i + 1) / segs) ** 2, ny = D0 + (h * (i + 1)) / segs;
    const seg = cyl(0, 0, 0.32 - i * 0.03, 0.3 - i * 0.03, 0, ny - py, 8);
    const dir = new THREE.Vector3(nx - px, ny - py, 0).normalize();
    seg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)); seg.translate(px, py, pz);
    b.add(seg, M.trunk!); px = nx; py = ny;
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const f = new THREE.ConeGeometry(0.5, 4.2, 4); f.rotateX(Math.PI / 2); f.translate(0, 0, 2.1); f.rotateX(0.55); f.rotateY(a); f.translate(px, py, pz);
    b.add(f, M.frond!);
  }
};

export function buildDesert(root: THREE.Object3D, kit: Kit, d: NonNullable<Decor["desert"]>) {
  const b = new Batch(), st = new Batch();
  const M: Record<string, THREE.Material> = {
    blocks: lam("pyramidM", () => ({ map: blocksTex() })),
    stone: lam("sphinxM", () => ({ map: stoneTex() })),
    nemes: lam("nemesM", () => ({ map: nemesTex() })),
    gold: lam("obeliskGold", () => ({ color: "#e8c45a" })),
    dune: lam("duneM", () => ({ color: "#e6c78c" })),
    water: new THREE.MeshLambertMaterial({ color: "#3fa0c8" }),
    reed: lam("oasisReed", () => ({ color: "#5f8a3a" })),
    trunk: lam("palmTrunk", () => ({ color: "#9a6a3a" })),
    frond: lam("palmFrond", () => ({ color: "#4f9a3c", side: THREE.DoubleSide })),
    sledge: lam("sledgeWood", () => ({ color: "#7a5230" })),
  };
  // pyramids (4-sided cones turned 45 degrees, the block texture tiled up their faces) and a gold cap on the great one
  for (const [x, z, base, h] of PYRAMIDS) {
    const p = new THREE.ConeGeometry(base / Math.SQRT2, h, 4, 1); p.rotateY(Math.PI / 4); p.translate(x, D0 + h / 2 - 0.2, z);
    const uv = p.attributes.uv!; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * base / 6, uv.getY(i) * h / 4);
    st.add(p, M.blocks!);
  }
  { const [x, z, base, h] = PYRAMIDS[0]!; const cap = new THREE.ConeGeometry((base / Math.SQRT2) * 0.06, h * 0.06, 4); cap.rotateY(Math.PI / 4); cap.translate(x, D0 + h * 0.97 - 0.2, z); st.add(cap, M.gold!); }
  // the Sphinx: a lying lion body, paws forward, a head with a striped nemes headdress, facing +z
  const [sx, sz] = SPHINX;
  st.add(boxGeo(V(sx - 4.5, D0, sz - 18), V(sx + 4.5, D0 + 7, sz + 2)), M.stone!);
  for (const px of [-2.6, 2.6]) st.add(boxGeo(V(sx + px - 1.4, D0, sz + 2), V(sx + px + 1.4, D0 + 1.8, sz + 10)), M.stone!);
  st.add(boxGeo(V(sx - 3.2, D0 + 7, sz - 2), V(sx + 3.2, D0 + 13, sz + 3.5)), M.nemes!); // headdress block
  st.add(boxGeo(V(sx - 2.4, D0 + 7.4, sz + 3.5), V(sx + 2.4, D0 + 12.2, sz + 4.6)), M.stone!); // face
  st.add(boxGeo(V(sx - 0.5, D0 + 6.2, sz + 4.6), V(sx + 0.5, D0 + 7.6, sz + 5.0)), M.stone!); // beard stub
  // obelisk with a gold pyramidion
  const [ox, oz] = OBELISK;
  const shaft = cyl(0, 0, 1.0, 0.65, D0, D0 + 15, 4); shaft.rotateY(Math.PI / 4); shaft.translate(ox, 0, oz); st.add(shaft, M.stone!);
  const pyr = new THREE.ConeGeometry(0.66, 1.4, 4); pyr.rotateY(Math.PI / 4); pyr.translate(ox, D0 + 15.7, oz); st.add(pyr, M.gold!);
  st.add(boxGeo(V(ox - 1.6, D0, oz - 1.6), V(ox + 1.6, D0 + 0.8, oz + 1.6)), M.stone!);
  // oasis: a pool ringed with reeds and palms
  const [qx, qz, qr] = OASIS;
  const pool = new THREE.CircleGeometry(qr, 32); pool.rotateX(-Math.PI / 2); pool.scale(1.4, 1, 1); pool.translate(qx, D0 + 0.03, qz); b.add(pool, M.water!);
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; b.add(cyl(qx + Math.cos(a) * qr * 1.42, qz + Math.sin(a) * qr * 1.03, 0.08, 0.06, D0, D0 + 1.3, 5), M.reed!); }
  for (const [x, z, h, l] of [[-40, 8, 9, 0.12], [-37, 18, 7.5, -0.1], [-22, 19, 8.5, 0.08], [-20, 5, 10, -0.12], [-44, 14, 6.5, 0.1], [34, 22, 9, 0.1], [-6, 30, 8, -0.08]] as const) palm(b, M, x, z, h, l);
  // quarry blocks on wooden sledges, ready to be hauled
  for (let i = 0; i < 5; i++) {
    const x = -26 + (i % 3) * 3.4, z = -40 + Math.floor(i / 3) * 4;
    b.add(boxGeo(V(x - 1.4, D0, z - 1.0), V(x + 1.4, D0 + 0.25, z + 1.0)), M.sledge!);
    b.add(boxGeo(V(x - 1.2, D0 + 0.25, z - 0.9), V(x + 1.2, D0 + 1.85, z + 0.9)), M.stone!);
  }
  // dunes on the horizon (flattened half-spheres)
  for (const [x, z, rx, rz, h] of [[-160, -60, 90, 50, 14], [170, -40, 100, 60, 16], [-200, 80, 110, 70, 18], [190, 110, 90, 60, 12], [60, -320, 160, 60, 20], [-140, -300, 150, 70, 22]] as const) {
    const dn = new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2); dn.scale(rx, h, rz); dn.translate(x, D0 - 0.5, z); st.add(dn, M.dune!);
  }
  b.build(root);
  st.build(root, false);
  // a market of tents (Kenney stalls) and a few jars
  const place = (name: string, x: number, z: number, h: number, yaw = 0) => { const o = kitClone(kit, name, h); if (o) { o.position.set(x, D0, z); o.rotation.y = yaw; root.add(o); } };
  place("stall-red", 10, 6, 2.6, 0.2); place("stall-green", 16, 9, 2.6, -0.3); place("stall-red", 21, 14, 2.6, 0.5); place("cart", 6, 14, 1.6, 1.2);
  void d;
}
