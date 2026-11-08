// The farm decor (decor.farm), on the ground plane y = D0: a dirt farmyard around the origin, a big red barn at the
// back left (x -22..-6, z -24..-12, doors facing +z), a farmhouse at the back right (centre (16, -18), facing +z),
// a fenced paddock on the right (x 6..26, z 2..18), a duck pond on the left (centre (-16, 12), radius 5), haystacks,
// striped crop fields all around beyond |z| or |x| = 34, a windmill on the hill at (-48, -46), trees and a cart.
// The animals themselves are story drawings (spec.art). Static: one Batch.
import * as THREE from "three";
import { Batch, boxGeo, V, lam, Kit, house, kitClone } from "./build";
import { ctex, planksHD } from "./paint";
import { D0 } from "./story";
import type { Decor } from "../spec";

export const BARN = [-22, -24, -6, -12] as const;
export const PADDOCK = [6, 2, 26, 18] as const;
export const POND: [number, number, number] = [-16, 12, 5];

const dirtTex = () => ctex("farmDirt", 512, 512, (g, r) => {
  g.fillStyle = "#b8925e"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5000; i++) { g.fillStyle = r() < 0.5 ? "rgba(120,85,45,0.25)" : "rgba(220,190,140,0.25)"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 2 + r() * 5, 1 + r() * 3, r() * 3, 0, Math.PI * 2); g.fill(); }
});
const cropTex = (k: number) => ctex(`crops${k}`, 256, 256, (g, r) => {
  const pal = [["#7fb04a", "#5f9a3a"], ["#e3c35a", "#cfa93e"], ["#6f9a3f", "#a8c860"], ["#c98a4a", "#8a6a3a"]][k % 4]!;
  for (let i = 0; i < 8; i++) { g.fillStyle = pal[i % 2]!; g.fillRect(0, i * 32, 256, 32); }
  for (let i = 0; i < 1500; i++) { g.fillStyle = "rgba(0,0,0,0.06)"; g.fillRect(r() * 256, r() * 256, 2, 4); }
});
const barnTex = () => ctex("barnBoards", 256, 256, (g) => {
  g.fillStyle = "#b8392e"; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(60,10,10,0.45)"; g.lineWidth = 3; for (let x = 0; x <= 256; x += 21) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
});
const quadUpUV = (x0: number, x1: number, z0: number, z1: number, y: number, u: number, v: number) => {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const uv = g.attributes.uv!; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
  return g;
};
const cyl = (x: number, z: number, r: number, y0: number, y1: number, n = 14) => { const c = new THREE.CylinderGeometry(r, r, y1 - y0, n); c.translate(x, (y0 + y1) / 2, z); return c; };

/** a fence of posts and two rails along a straight line */
const fence = (b: Batch, m: THREE.Material, x0: number, z0: number, x1: number, z1: number) => {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 2.5));
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n; b.add(boxGeo(V(x - 0.08, D0, z - 0.08), V(x + 0.08, D0 + 1.2, z + 0.08)), m); }
  const yaw = Math.atan2(z1 - z0, x1 - x0);
  for (const y of [0.55, 1.0]) {
    const r = new THREE.BoxGeometry(len, 0.1, 0.05); r.rotateY(-yaw); r.translate((x0 + x1) / 2, D0 + y, (z0 + z1) / 2); b.add(r, m);
  }
};

export function buildFarm(root: THREE.Object3D, kit: Kit, d: NonNullable<Decor["farm"]>) {
  const b = new Batch(), st = new Batch();
  const M = {
    dirt: lam("farmDirtM", () => ({ map: dirtTex() })),
    barn: lam("barnM", () => ({ map: barnTex() })),
    trim: lam("barnTrim", () => ({ color: "#f4f1ea" })),
    roof: lam("barnRoof", () => ({ color: "#5a5f6a" })),
    wood: lam("fenceWood", () => ({ color: "#d8c6a0" })),
    hay: lam("hay", () => ({ color: "#e8c45a" })),
    plank: lam("barnDoor", () => ({ map: planksHD() })),
    water: new THREE.MeshLambertMaterial({ color: "#5aa8d8" }),
    reed: lam("reed", () => ({ color: "#5f8a3a" })),
  };
  // the yard (dirt) and crop fields in strips beyond it
  b.add(quadUpUV(-30, 30, -30, 26, D0 + 0.01, 60 / 6, 56 / 6), M.dirt);
  let k = 0;
  for (const [x0, z0, x1, z1] of [[-120, -110, -36, -34], [-34, -110, 40, -34], [40, -110, 130, -34], [34, -34, 130, 40], [-130, -30, -34, 40], [-130, 40, -40, 110], [40, 40, 130, 110]] as const) {
    const cm = lam(`cropM${k % 4}`, () => ({ map: cropTex(k % 4) }));
    b.add(quadUpUV(x0, x1, z0, z1, D0 + 0.012, (x1 - x0) / 16, (z1 - z0) / 16), cm); k++;
  }
  // the barn: red boards, white trim, a gambrel-ish roof, big doors facing +z
  const [bx0, bz0, bx1, bz1] = BARN, bh = 7, cx = (bx0 + bx1) / 2, w = bx1 - bx0, dz = bz1 - bz0;
  const walls = boxGeo(V(bx0, D0, bz0), V(bx1, D0 + bh, bz1));
  const uv = walls.attributes.uv!; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 2);
  st.add(walls, M.barn);
  for (const s of [-1, 1]) { // two roof slopes along x
    const slope = new THREE.PlaneGeometry(w + 1, dz / 2 / Math.cos(0.6) + 0.6); slope.rotateX(-Math.PI / 2); slope.rotateX(s * 0.6);
    slope.translate(cx, D0 + bh + Math.tan(0.6) * dz / 4, (bz0 + bz1) / 2 + s * dz / 4); st.add(slope, lam("barnRoofD", () => ({ color: "#5a5f6a", side: THREE.DoubleSide })));
  }
  // gable ends as boxes stepping up (cartoon read) + the big doors with white X bracing
  st.add(boxGeo(V(bx0 + 1, D0 + bh, bz1 - 0.1), V(bx1 - 1, D0 + bh + 2.2, bz1 + 0.01)), M.barn);
  st.add(boxGeo(V(bx0 + 3.5, D0 + bh + 2.2, bz1 - 0.1), V(bx1 - 3.5, D0 + bh + 3.6, bz1 + 0.01)), M.barn);
  st.add(boxGeo(V(cx - 2.6, D0, bz1), V(cx + 2.6, D0 + 4.6, bz1 + 0.12)), M.plank);
  for (const s of [-1, 1]) {
    const br = new THREE.BoxGeometry(0.22, 6.4, 0.06); br.rotateZ(s * 0.85); br.translate(cx, D0 + 2.3, bz1 + 0.16); st.add(br, M.trim);
  }
  st.add(boxGeo(V(cx - 2.8, D0 + 4.6, bz1), V(cx + 2.8, D0 + 4.85, bz1 + 0.16)), M.trim);
  for (const x of [bx0, bx1]) st.add(boxGeo(V(x - 0.15, D0, bz1 - 0.05), V(x + 0.15, D0 + bh, bz1 + 0.15)), M.trim);
  // the farmhouse
  house(st, 16, -18, 0, 11, 9, 6.5, 2);
  // paddock fence, pond, haystacks, cart, trees, windmill
  const [px0, pz0, px1, pz1] = PADDOCK;
  fence(b, M.wood, px0, pz0, px1, pz0); fence(b, M.wood, px1, pz0, px1, pz1); fence(b, M.wood, px1, pz1, px0, pz1); fence(b, M.wood, px0, pz1, px0, pz0 + 4);
  const [qx, qz, qr] = POND;
  const pond = new THREE.CircleGeometry(qr, 32); pond.rotateX(-Math.PI / 2); pond.scale(1.3, 1, 1); pond.translate(qx, D0 + 0.03, qz); b.add(pond, M.water);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; b.add(cyl(qx + Math.cos(a) * qr * 1.32, qz + Math.sin(a) * qr * 1.02, 0.08, D0, D0 + 1.2, 5), M.reed); }
  for (const [x, z] of [[-4, -16], [-1, -18], [28, -6], [-26, 0]] as const) {
    b.add(cyl(x, z, 1.4, D0, D0 + 1.6, 16), M.hay);
    const top = new THREE.ConeGeometry(1.45, 1.0, 16); top.translate(x, D0 + 2.1, z); b.add(top, M.hay);
  }
  b.build(root);
  st.build(root, false);
  const place = (name: string, x: number, z: number, h: number, yaw = 0) => { const o = kitClone(kit, name, h); if (o) { o.position.set(x, D0, z); o.rotation.y = yaw; root.add(o); } };
  place("windmill", -48, -46, 12, 0.5);
  place("cart", 4, -8, 1.6, 0.6);
  for (const [x, z, t] of [[-34, -30, "tree_oak"], [32, -30, "tree_fat"], [-36, 22, "tree_default"], [36, 24, "tree_oak"], [0, -34, "tree_detailed"], [-28, -36, "tree_cone"]] as const) place(t, x, z, 7);
  void d;
}
