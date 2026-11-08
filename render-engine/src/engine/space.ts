// The space decor (decor.space): the surface of the Moon at y = D0 (grey regolith, ground "moon"), craters with raised
// rims, scattered rocks, a black starry sky with the Earth hanging over the horizon (world.ts darkens the sky and
// drops the haze for this decor), a lunar module on four legs at (12, -8), a flag at (6, -2), a moon rover at
// (-8, 10) and a rocket on its launch pad at (-24, -34) (piece "rocket" makes it lift off with a flame).
import * as THREE from "three";
import { Batch, boxGeo, V, lam } from "./build";
import { ctex } from "./paint";
import { D0 } from "./story";
import type { Decor } from "../spec";

export const ROCKET: [number, number] = [-24, -34];
export const LANDER: [number, number] = [12, -8];
export const FLAG: [number, number] = [6, -2];
export const ROVER: [number, number] = [-8, 10];

/** grey regolith with small craters and dust speckle (world.ts tiles it like the grass) */
export const moonTex = () => ctex("moonHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#9c9ba3"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.5 ? "rgba(60,60,70,0.12)" : "rgba(230,230,235,0.12)"; g.fillRect(r() * 1024, r() * 1024, 2 + r() * 3, 2 + r() * 3); }
  for (let i = 0; i < 40; i++) {
    const x = r() * 1024, y = r() * 1024, rr = 6 + r() * 26;
    g.fillStyle = "rgba(70,70,80,0.25)"; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(235,235,240,0.35)"; g.lineWidth = 3; g.beginPath(); g.arc(x - 2, y - 2, rr, Math.PI * 0.9, Math.PI * 1.9); g.stroke();
  }
});
const earthTex = () => ctex("earthDisc", 512, 512, (g, r) => {
  g.clearRect(0, 0, 512, 512);
  g.fillStyle = "#2f6fc0"; g.beginPath(); g.arc(256, 256, 240, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.arc(256, 256, 240, 0, Math.PI * 2); g.clip();
  for (let i = 0; i < 9; i++) { g.fillStyle = "#4f9a4a"; g.beginPath(); g.ellipse(80 + r() * 350, 80 + r() * 350, 30 + r() * 70, 20 + r() * 50, r() * 3, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 14; i++) { g.fillStyle = "rgba(255,255,255,0.75)"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 40 + r() * 70, 8 + r() * 14, r() * 3, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "rgba(10,15,40,0.55)"; g.beginPath(); g.arc(330, 300, 250, 0, Math.PI * 2); g.fill(); // night side
  g.restore();
  g.strokeStyle = "#241726"; g.lineWidth = 8; g.beginPath(); g.arc(256, 256, 240, 0, Math.PI * 2); g.stroke();
});
const flagTex = (kind: string) => ctex("spaceFlag" + kind, 300, 200, (g) => {
  if (kind === "usa") {
    for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? "#f4f1ea" : "#c0353a"; g.fillRect(0, (i * 200) / 13, 300, 200 / 13 + 1); }
    g.fillStyle = "#2d3a7a"; g.fillRect(0, 0, 130, 108);
    g.fillStyle = "#f4f1ea"; for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) { g.beginPath(); g.arc(12 + x * 21, 12 + y * 21, 3.5, 0, Math.PI * 2); g.fill(); }
  } else { g.fillStyle = "#f4f1ea"; g.fillRect(0, 0, 300, 200); g.fillStyle = "#3f6fb5"; g.beginPath(); g.arc(150, 100, 50, 0, Math.PI * 2); g.fill(); }
});
const cyl = (x: number, z: number, r0: number, r1: number, y0: number, y1: number, n = 16) => { const c = new THREE.CylinderGeometry(r1, r0, y1 - y0, n); c.translate(x, (y0 + y1) / 2, z); return c; };

/** the rocket (white body, red nose and fins, round windows), base at the origin, ~30 m tall, plus its flame */
export const rocketGroup = () => {
  const g = new THREE.Group(), b = new Batch();
  const white = lam("rocketWhite", () => ({ color: "#f2f0ea" })), red = lam("rocketRed", () => ({ color: "#d6453a" })), dark = lam("rocketDark", () => ({ color: "#2d3240" }));
  b.add(cyl(0, 0, 2.2, 2.2, 3, 22, 24), white);
  b.add(cyl(0, 0, 2.6, 2.2, 0, 3, 24), dark); // engine skirt
  const nose = new THREE.ConeGeometry(2.2, 7, 24); nose.translate(0, 25.5, 0); b.add(nose, red);
  b.add(cyl(0, 0, 2.25, 2.25, 14, 15, 24), red);
  for (let k = 0; k < 4; k++) {
    const fin = new THREE.BufferGeometry();
    fin.setAttribute("position", new THREE.Float32BufferAttribute([2.1, 0, 0, 5.2, -0.5, 0, 2.1, 7, 0, 2.1, 0, 0, 2.1, 7, 0, 5.2, -0.5, 0], 3)); fin.computeVertexNormals();
    fin.rotateY((k * Math.PI) / 2 + Math.PI / 4); b.add(fin, lam("rocketFin", () => ({ color: "#d6453a", side: THREE.DoubleSide })));
  }
  for (const y of [17, 19.5]) { const w = new THREE.CircleGeometry(0.55, 16); w.translate(0, y, 2.21); b.add(w, lam("rocketWin", () => ({ color: "#5fa8e0" }))); }
  b.build(g);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(2.0, 9, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.0, 0.3), transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  flame.rotation.x = Math.PI; flame.position.y = -4.5; flame.visible = false; flame.name = "flame"; g.add(flame);
  return g;
};

export function buildSpace(root: THREE.Object3D, d: NonNullable<Decor["space"]>) {
  const b = new Batch(), st = new Batch();
  const M = {
    rim: lam("craterRim", () => ({ color: "#b4b3ba" })),
    hole: lam("craterHole", () => ({ color: "#7d7c85" })),
    rock: lam("moonRock", () => ({ color: "#8a8992" })),
    gold: lam("landerGold", () => ({ color: "#d9a640" })),
    grey: lam("landerGrey", () => ({ color: "#b8bcc6" })),
    dark: lam("landerDark", () => ({ color: "#3a3f4c" })),
    pad: lam("launchPad", () => ({ color: "#6a6e78" })),
    gantry: lam("gantry", () => ({ color: "#c0353a" })),
  };
  // craters: a darker floor and a raised rim (flattened torus)
  for (const [x, z, r] of [[22, 14, 7], [-30, -6, 10], [36, -40, 14], [-10, -60, 9], [-48, 28, 12], [50, 30, 8], [4, 34, 5], [-60, -40, 16], [70, -10, 11]] as const) {
    const floor = new THREE.CircleGeometry(r, 32); floor.rotateX(-Math.PI / 2); floor.translate(x, D0 + 0.02, z); b.add(floor, M.hole);
    const rim = new THREE.TorusGeometry(r, r * 0.12, 6, 32); rim.rotateX(Math.PI / 2); rim.scale(1, 0.45, 1); rim.translate(x, D0, z); b.add(rim, M.rim);
  }
  for (let i = 0; i < 40; i++) {
    const a = i * 2.39996, rr = 12 + (i * 7.3) % 90, s = 0.3 + ((i * 13) % 10) / 12;
    const rk = new THREE.IcosahedronGeometry(s, 0); rk.translate(Math.cos(a) * rr, D0 + s * 0.4, Math.sin(a) * rr); b.add(rk, M.rock);
  }
  // lunar module: gold descent stage on four legs, grey ascent stage, a ladder
  const [lx, lz] = LANDER;
  b.add(boxGeo(V(lx - 2, D0 + 1.4, lz - 2), V(lx + 2, D0 + 3.4, lz + 2)), M.gold);
  b.add(boxGeo(V(lx - 1.5, D0 + 3.4, lz - 1.5), V(lx + 1.5, D0 + 5.6, lz + 1.5)), M.grey);
  b.add(boxGeo(V(lx - 0.6, D0 + 4.2, lz + 1.5), V(lx + 0.6, D0 + 5.0, lz + 1.56)), M.dark); // window
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const leg = new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6); leg.rotateZ(sx * 0.45); leg.rotateX(-sz * 0.45); leg.translate(lx + sx * 2.4, D0 + 1.0, lz + sz * 2.4); b.add(leg, M.grey);
    b.add(cyl(lx + sx * 2.9, lz + sz * 2.9, 0.5, 0.5, D0, D0 + 0.1, 12), M.grey);
  }
  for (let y = 0.4; y < 1.6; y += 0.3) b.add(boxGeo(V(lx - 0.4, D0 + y, lz + 2.4), V(lx + 0.4, D0 + y + 0.05, lz + 2.45)), M.grey);
  // flag on a pole with a top bar holding it out
  const [fx, fz] = FLAG;
  b.add(cyl(fx, fz, 0.05, 0.05, D0, D0 + 3.2, 6), M.grey);
  b.add(boxGeo(V(fx, D0 + 3.1, fz - 0.03), V(fx + 1.8, D0 + 3.16, fz + 0.03)), M.grey);
  const fl = new THREE.PlaneGeometry(1.8, 1.2); fl.translate(fx + 0.9, D0 + 2.5, fz); b.add(fl, lam("flagM" + (d.flag ?? "usa"), () => ({ map: flagTex(d.flag ?? "usa"), side: THREE.DoubleSide })));
  // moon rover: an open frame, four wire wheels, two seats, a dish antenna
  const [rx, rz] = ROVER;
  b.add(boxGeo(V(rx - 1.5, D0 + 0.6, rz - 1.0), V(rx + 1.5, D0 + 0.8, rz + 1.0)), M.grey);
  for (const sx of [-1.2, 1.2]) for (const sz of [-1.05, 1.05]) { const w = new THREE.CylinderGeometry(0.42, 0.42, 0.25, 14); w.rotateX(Math.PI / 2); w.translate(rx + sx, D0 + 0.42, rz + sz); b.add(w, M.dark); }
  for (const sz of [-0.45, 0.45]) b.add(boxGeo(V(rx - 0.5, D0 + 0.8, rz + sz - 0.3), V(rx + 0.1, D0 + 1.3, rz + sz + 0.3)), M.gold);
  b.add(cyl(rx + 1.2, rz, 0.04, 0.04, D0 + 0.8, D0 + 2.0, 6), M.grey);
  const dish = new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, 0.9); dish.translate(rx + 1.2, D0 + 1.8, rz); b.add(dish, M.grey);
  // launch pad with a red service tower beside the rocket
  const [px, pz] = ROCKET;
  st.add(cyl(px, pz, 7, 7, D0, D0 + 0.6, 28), M.pad);
  for (let y = 0; y < 30; y += 3) st.add(boxGeo(V(px + 4.2, D0 + y, pz - 1.2), V(px + 6.6, D0 + y + 0.3, pz + 1.2)), M.gantry);
  for (const [ox, oz] of [[4.2, -1.2], [6.6, -1.2], [4.2, 1.2], [6.6, 1.2]] as const) st.add(boxGeo(V(px + ox - 0.15, D0, pz + oz - 0.15), V(px + ox + 0.15, D0 + 31, pz + oz + 0.15)), M.gantry);
  b.build(root);
  st.build(root, false);
  // the Earth over the horizon and a field of stars (unlit, no ink, beyond everything)
  const earth = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: earthTex(), transparent: true, depthWrite: false, fog: false }));
  earth.position.set(-260, 210, -820); earth.scale.setScalar(150); earth.lookAt(0, D0, 0); earth.renderOrder = -0.6; earth.name = "earth"; root.add(earth);
  const n = 1400, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = 1 - (2 * (i + 0.5)) / n, th = i * 2.39996, el = Math.max(0.04, Math.abs(u)); // Fibonacci sphere, folded to the upper half
    const rr = 1000, c = Math.sqrt(1 - el * el);
    pos[i * 3] = Math.cos(th) * c * rr; pos[i * 3 + 1] = el * rr; pos[i * 3 + 2] = Math.sin(th) * c * rr;
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: new THREE.Color(1.4, 1.4, 1.5), size: 2.2, sizeAttenuation: false, fog: false, depthWrite: false }));
  stars.name = "stars"; stars.frustumCulled = false; stars.renderOrder = -0.8; root.add(stars);
  return { earth, stars };
}
