// The stadium decor (decor.stadium): a football pitch centred on the origin (length along x, 105 x 68 m) on the
// ground plane y = D0, painted lines, advertising boards (colour blocks, never text), four stands whose sloped
// terraces carry a painted crowd in the two teams' colours, a canopy roof on columns, four floodlight towers, two
// goals with nets and a scoreboard (blank: no text on screen). Everything is static: one Batch, plus the nets.
import * as THREE from "three";
import { Batch, boxGeo, V, lam } from "./build";
import { ctex } from "./paint";
import { D0 } from "./story";
import type { Decor } from "../spec";

export const PITCH = { hx: 52.5, hz: 34 };
const STAND = { gap: 7, depth: 13, rise: 8.5, front: 1.1 }; // stand front edge `gap` m behind the touchline
const PX = 20; // pitch texture pixels per metre

/** striped grass with the full set of football markings, over the pitch plus a 4 m margin */
const pitchTex = () => ctex("pitchHD", Math.round((PITCH.hx + 4) * 2 * PX), Math.round((PITCH.hz + 4) * 2 * PX), (g, r) => {
  const W = g.canvas.width, H = g.canvas.height, ox = 4 * PX, oz = 4 * PX;
  const sx = (x: number) => ox + (x + PITCH.hx) * PX, sz = (z: number) => oz + (z + PITCH.hz) * PX;
  g.fillStyle = "#4f9e3f"; g.fillRect(0, 0, W, H);
  const n = 18, sw = (PITCH.hx * 2) / n;
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? "#5aab47" : "#4c9a3c"; g.fillRect(sx(-PITCH.hx + i * sw), 0, sw * PX + 1, H); }
  // painterly speckle so the stripes are not flat
  for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.5 ? "rgba(30,80,30,0.07)" : "rgba(170,220,120,0.06)"; g.fillRect(r() * W, r() * H, 2 + r() * 3, 2 + r() * 3); }
  g.strokeStyle = "#f6f4ec"; g.fillStyle = "#f6f4ec"; g.lineWidth = 0.14 * PX; g.lineCap = "round";
  const rect = (x0: number, z0: number, x1: number, z1: number) => g.strokeRect(sx(x0), sz(z0), (x1 - x0) * PX, (z1 - z0) * PX);
  rect(-PITCH.hx, -PITCH.hz, PITCH.hx, PITCH.hz);
  g.beginPath(); g.moveTo(sx(0), sz(-PITCH.hz)); g.lineTo(sx(0), sz(PITCH.hz)); g.stroke();
  g.beginPath(); g.arc(sx(0), sz(0), 9.15 * PX, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(sx(0), sz(0), 0.25 * PX, 0, Math.PI * 2); g.fill();
  for (const s of [-1, 1]) {
    const gx = s * PITCH.hx;
    rect(Math.min(gx, gx - s * 16.5), -20.16, Math.max(gx, gx - s * 16.5), 20.16);
    rect(Math.min(gx, gx - s * 5.5), -9.16, Math.max(gx, gx - s * 5.5), 9.16);
    g.beginPath(); g.arc(sx(gx - s * 11), sz(0), 0.25 * PX, 0, Math.PI * 2); g.fill();
    // the "D": the part of the 9.15 m circle around the spot that lies outside the box
    const a = Math.acos(5.5 / 9.15);
    g.beginPath(); s < 0 ? g.arc(sx(gx - s * 11), sz(0), 9.15 * PX, -a, a) : g.arc(sx(gx - s * 11), sz(0), 9.15 * PX, Math.PI - a, Math.PI + a); g.stroke();
    for (const t of [-1, 1]) { // corner arcs
      g.beginPath(); g.arc(sx(gx), sz(t * PITCH.hz), 1 * PX, 0, Math.PI * 2); g.stroke();
    }
  }
});

/** a painted crowd: rows of bean heads and shoulders in the two teams' colours with a few scarves up; tiles along u */
const crowdTex = (home: string, away: string) => ctex(`crowd${home}${away}`, 1024, 512, (g, r) => {
  g.fillStyle = "#5b5466"; g.fillRect(0, 0, 1024, 512);
  const rows = 8, rh = 512 / rows, skins = ["#ffe2c2", "#f5c9a0", "#ecd0b6", "#c99067"];
  for (let row = 0; row < rows; row++) {
    const y = row * rh;
    g.fillStyle = row % 2 ? "#6a6375" : "#635c6e"; g.fillRect(0, y + rh * 0.78, 1024, rh * 0.22); // the concrete step
    const team = (k: number) => (k / 1024 < 0.5 ? home : away);
    for (let x = (row % 2) * 14; x < 1024; x += 28) {
      if (r() < 0.06) continue; // empty seat
      const cx = x + (r() - 0.5) * 6, base = y + rh * 0.8;
      const shirt = r() < 0.78 ? team(cx) : ["#f4f1ea", "#3b3f52", "#e2453c", "#3f6fb5"][Math.floor(r() * 4)];
      g.fillStyle = shirt; g.beginPath(); g.ellipse(cx, base - rh * 0.1, 11, rh * 0.26, 0, Math.PI, 0); g.fill();
      g.fillStyle = skins[Math.floor(r() * 4)]; g.beginPath(); g.ellipse(cx, base - rh * 0.42, 7.5, 9.5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#241726"; g.lineWidth = 1.6; g.stroke();
      if (r() < 0.12) { // a scarf held up
        g.strokeStyle = team(cx); g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 12, base - rh * 0.72); g.lineTo(cx + 12, base - rh * 0.78); g.stroke();
      }
    }
  }
});

/** advertising boards: alternating blocks of colour with a thin band (deliberately wordless) */
const boardsTex = (home: string, away: string) => ctex(`boards${home}${away}`, 1024, 64, (g) => {
  const cols = [home, "#f4f1ea", away, "#1f2a44", "#f0b43c", home, "#2f8a4f", away];
  for (let i = 0; i < 8; i++) {
    g.fillStyle = cols[i]!; g.fillRect(i * 128, 0, 128, 64);
    g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(i * 128 + 18, 26, 92, 12);
  }
});

const netTex = () => ctex("goalNet", 256, 256, (g) => {
  g.clearRect(0, 0, 256, 256); g.strokeStyle = "rgba(250,250,250,0.95)"; g.lineWidth = 3;
  for (let i = 0; i <= 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
});

/** a quad from four corners (counter-clockwise seen from the front), uv repeated u x v */
const quad4 = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u = 1, v = 1) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray()], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  g.computeVertexNormals();
  return g;
};

const cyl = (x: number, z: number, r: number, y0: number, y1: number) => {
  const c = new THREE.CylinderGeometry(r, r, y1 - y0, 12); c.translate(x, (y0 + y1) / 2, z); return c;
};

export function buildStadium(root: THREE.Object3D, d: NonNullable<Decor["stadium"]>) {
  const home = d.home ?? "#e2453c", away = d.away ?? "#3f6fb5";
  const b = new Batch(), st = new Batch(); // st: the stands and towers, which cast no shadow (a low sun would put the whole pitch in shade)
  const M = {
    pitch: lam("pitchM", () => ({ map: pitchTex() })),
    crowd: lam(`crowdM${home}${away}`, () => ({ map: crowdTex(home, away), side: THREE.DoubleSide })),
    boards: lam(`boardsM${home}${away}`, () => ({ map: boardsTex(home, away) })),
    concrete: lam("concreteM", () => ({ color: "#b9b1a6" })),
    roof: lam("roofM", () => ({ color: "#8f97a6", side: THREE.DoubleSide })),
    steel: lam("stadSteel", () => ({ color: "#5a6070" })),
    white: lam("postWhite", () => ({ color: "#f6f4ec" })),
    lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.55, 1.3) }),
    board: lam("scoreFace", () => ({ color: "#1f2433" })),
  };
  // pitch (1 cm above the ground so it wins the depth test)
  const mx = PITCH.hx + 4, mz = PITCH.hz + 4;
  b.add(quad4(V(-mx, D0 + 0.01, mz), V(mx, D0 + 0.01, mz), V(mx, D0 + 0.01, -mz), V(-mx, D0 + 0.01, -mz)), M.pitch);
  // advertising boards 3 m outside the lines (front face toward the pitch, uv repeats along the length)
  const bh = 0.9;
  for (const s of [-1, 1]) {
    const z = s * (PITCH.hz + 3), len = PITCH.hx * 2 + 6;
    b.add(boxGeo(V(-len / 2, D0, z - 0.06), V(len / 2, D0 + bh, z + 0.06)), M.concrete);
    const f = z - s * 0.07;
    b.add(s > 0 ? quad4(V(-len / 2, D0, f), V(len / 2, D0, f), V(len / 2, D0 + bh, f), V(-len / 2, D0 + bh, f), len / 18, 1)
      : quad4(V(len / 2, D0, f), V(-len / 2, D0, f), V(-len / 2, D0 + bh, f), V(len / 2, D0 + bh, f), len / 18, 1), M.boards);
  }
  // stands: a front wall, a sloped terrace with the painted crowd, a back wall, a roof on columns
  const S = STAND;
  const side = (axis: "x" | "z", s: number) => {
    const half = axis === "z" ? PITCH.hx + 10 : PITCH.hz + 10; // stand length / 2 along the touchline
    const e0 = (axis === "z" ? PITCH.hz : PITCH.hx) + S.gap, e1 = e0 + S.depth;
    const P = (t: number, along: number, y: number) => (axis === "z" ? V(along, y, s * t) : V(s * t, y, along));
    const y0 = D0 + S.front, y1 = D0 + S.front + S.rise;
    // front wall
    st.add(axis === "z" ? boxGeo(V(-half, D0, s * e0 - 0.2), V(half, y0, s * e0 + 0.2)) : boxGeo(V(s * e0 - 0.2, D0, -half), V(s * e0 + 0.2, y0, half)), M.concrete);
    // terrace (crowd): from the front top edge up to the back
    const reps = (half * 2) / 16;
    st.add(quad4(P(e0, -half, y0), P(e0, half, y0), P(e1, half, y1), P(e1, -half, y1), reps, S.depth / 6.5), M.crowd);
    // back wall and side walls
    st.add(axis === "z" ? boxGeo(V(-half, D0, s * e1 - 0.3), V(half, y1 + 2.2, s * e1 + 0.3)) : boxGeo(V(s * e1 - 0.3, D0, -half), V(s * e1 + 0.3, y1 + 2.2, half)), M.concrete);
    for (const a of [-1, 1]) {
      const at = a * half;
      st.add(quad4(P(e0, at, D0), P(e1, at, D0), P(e1, at, y1 + 2.2), P(e0, at, y0 + 0.3)), M.concrete);
    }
    // roof: canopy sloping toward the pitch, on columns at the back and the front third
    const ry1 = y1 + 6.5, ry0 = y1 + 5.2, rf = e0 + S.depth * 0.08;
    st.add(quad4(P(rf, -half, ry0), P(rf, half, ry0), P(e1 + 0.5, half, ry1), P(e1 + 0.5, -half, ry1)), M.roof);
    for (let k = -half; k <= half + 0.01; k += 16) {
      const c1 = P(e1 + 0.2, k, 0), c2 = P(e0 + S.depth * 0.42, k, 0);
      st.add(cyl(c1.x, c1.z, 0.28, D0, ry1), M.steel);
      st.add(cyl(c2.x, c2.z, 0.2, y0 + (S.rise * 0.42), ry0 + (ry1 - ry0) * 0.5), M.steel);
    }
  };
  side("z", 1); side("z", -1); side("x", 1); side("x", -1);
  // floodlights at the four corners: a lattice-like pole and a lamp head tilted toward the centre spot
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (PITCH.hx + S.gap + S.depth + 6), z = sz * (PITCH.hz + S.gap + S.depth + 6);
    st.add(cyl(x, z, 0.55, D0, D0 + 34), M.steel);
    const head = new THREE.Group(); head.position.set(x, D0 + 35, z); head.lookAt(0, D0, 0);
    head.updateMatrixWorld(true);
    st.add(boxGeo(V(-4, -2, -0.5), V(4, 2, 0.5)), M.steel, head.matrixWorld);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      const lamp = new THREE.PlaneGeometry(1.6, 1.4); lamp.translate(-3 + i * 2, -0.9 + j * 1.8, 0.52);
      st.add(lamp, M.lamp, head.matrixWorld);
    }
  }
  // scoreboard above the west stand's back wall: a blank dark face in a white frame (no text on screen)
  {
    const x = -(PITCH.hx + S.gap + S.depth) - 0.5, y = D0 + S.front + S.rise + 2.2;
    st.add(boxGeo(V(x - 0.6, y, -9), V(x + 0.2, y + 6.5, 9)), M.white);
    st.add(boxGeo(V(x + 0.2, y + 0.4, -8.5), V(x + 0.32, y + 6.1, 8.5)), M.board);
  }
  // goals: posts 7.32 m apart, bar at 2.44 m, net back 2 m
  const netM = new THREE.MeshLambertMaterial({ map: netTex(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, depthWrite: false });
  const net = new Batch();
  for (const s of [-1, 1]) {
    const gx = s * PITCH.hx, back = gx + s * 2, hw = 3.66, h = 2.44;
    for (const z of [-hw, hw]) b.add(cyl(gx, z, 0.06, D0, D0 + h), M.white);
    const bar = new THREE.CylinderGeometry(0.06, 0.06, hw * 2, 10); bar.rotateX(Math.PI / 2); bar.translate(gx, D0 + h, 0);
    b.add(bar, M.white);
    net.add(quad4(V(back, D0, -hw), V(back, D0, hw), V(back, D0 + h * 0.8, hw), V(back, D0 + h * 0.8, -hw), 7, 2), netM);
    net.add(quad4(V(gx, D0 + h, -hw), V(gx, D0 + h, hw), V(back, D0 + h * 0.8, hw), V(back, D0 + h * 0.8, -hw), 7, 2), netM);
    for (const z of [-hw, hw]) net.add(quad4(V(gx, D0, z), V(back, D0, z), V(back, D0 + h * 0.8, z), V(gx, D0 + h, z), 2, 2), netM);
  }
  b.build(root);
  st.build(root, false);
  net.build(root, false);
}
