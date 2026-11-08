// The modern city decor (decor.city), on the ground plane y = D0. A main road along x (asphalt, z -7..7, two lanes
// each way with dashed markings) crossed by a road along z at x -7..7, zebra crossings at the junction, pavements
// to |z| = 12, then blocks of modern buildings (glass and concrete facades, ground-floor shops with awnings, never any
// text) from |z| = 12, with street lamps, traffic lights, trees in planters and parked cars along the kerbs.
// decor.city.lab adds a laboratory interior centred on (0, LAB_Z): a 18 x 12 m room with an open ceiling, benches
// with flasks, shelves, a blank chalkboard and a big coil machine. Static (one Batch); a moving car is a piece.
import * as THREE from "three";
import { Batch, boxGeo, V, lam, Kit, kitClone } from "./build";
import { ctex } from "./paint";
import { D0 } from "./story";
import type { Decor } from "../spec";

export const CITY = { road: 7, walk: 12, crossX: 7, extent: 150 };
export const LAB_Z = -220;
const PX = 16;

const asphaltTex = () => ctex("asphaltHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#4a4d57"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 14000; i++) { const c = 60 + r() * 40; g.fillStyle = `rgba(${c},${c},${c + 8},0.35)`; g.fillRect(r() * 1024, r() * 1024, 2 + r() * 3, 2 + r() * 3); }
});
const pavementTex = () => ctex("pavementHD", 512, 512, (g, r) => {
  g.fillStyle = "#c9c4bb"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "#a9a39a"; g.lineWidth = 3;
  for (let i = 0; i <= 512; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
  for (let i = 0; i < 3000; i++) { g.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)"; g.fillRect(r() * 512, r() * 512, 3, 3); }
});
/** road markings over the whole road area: dashed lane lines, a double centre line, zebra crossings at the junction */
const markingsTex = () => ctex("roadMarks", (CITY.extent * 2 * PX) / 4, (CITY.road * 2 * PX), (g) => {
  const W = g.canvas.width, H = g.canvas.height, s = W / (CITY.extent * 2); // px per metre along x
  g.clearRect(0, 0, W, H); g.fillStyle = "#f4f1e6";
  const zx = (z: number) => ((z + CITY.road) / (CITY.road * 2)) * H;
  for (let x = 0; x < W; x += 6 * s) { // lane dashes at z = +-3.5
    const xm = x / s - CITY.extent;
    if (Math.abs(xm) < CITY.crossX + 4) continue;
    for (const z of [-3.5, 3.5]) g.fillRect(x, zx(z) - 0.06 * PX, 3 * s, 0.12 * PX);
  }
  for (const z of [-0.15, 0.15]) g.fillRect(0, zx(z) - 0.05 * PX, W, 0.1 * PX); // centre line
  g.clearRect((CITY.extent - CITY.crossX - 4) * s, 0, (CITY.crossX + 4) * 2 * s, H);
  for (const sx of [-1, 1]) { // zebras across the main road, both sides of the junction
    const x0 = (CITY.extent + sx * (CITY.crossX + 1.5)) * s - 1.5 * s;
    for (let z = -CITY.road + 0.5; z < CITY.road; z += 1.0) g.fillRect(x0, zx(z), 3 * s, 0.5 * (H / (CITY.road * 2)));
  }
});

/** a facade: rows of windows (glass with a sky reflection) in a concrete or brick frame; tiles along u (one bay) */
const facadeTex = (k: number) => ctex(`facadeM${k}`, 256, 256, (g, r) => {
  const walls = ["#d9d4cb", "#c86f52", "#9fb3c8", "#e8dcc0", "#7f8a96", "#b8c4a8", "#f0e6d8", "#5e6a7a"];
  g.fillStyle = walls[k % 8]!; g.fillRect(0, 0, 256, 256);
  const glassy = k % 3 === 2;
  const [wx, wy, ww, wh] = glassy ? [8, 8, 240, 112] : [40, 40, 176, 150];
  for (const oy of glassy ? [0, 128] : [0]) {
    const grd = g.createLinearGradient(0, wy + oy, 0, wy + oy + wh);
    grd.addColorStop(0, "#a8d0ec"); grd.addColorStop(0.6, "#5f8fb8"); grd.addColorStop(1, "#3f6a92");
    g.fillStyle = grd; g.fillRect(wx, wy + oy, ww, wh);
    g.fillStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.moveTo(wx + ww * 0.15, wy + oy); g.lineTo(wx + ww * 0.35, wy + oy); g.lineTo(wx + ww * 0.1, wy + oy + wh); g.lineTo(wx, wy + oy + wh * 0.8); g.fill();
    g.strokeStyle = "#2d3240"; g.lineWidth = 6; g.strokeRect(wx, wy + oy, ww, wh);
    if (r() < 0.25) { g.fillStyle = "rgba(255,230,160,0.55)"; g.fillRect(wx + 3, wy + oy + 3, ww - 6, wh - 6); } // a lit window
  }
});
/** ground-floor shop fronts: big windows, a coloured awning band, a door; no text */
const shopTex = () => ctex("shopFronts", 1024, 256, (g, r) => {
  const aw = ["#e2453c", "#2f8a4f", "#f0b43c", "#3f6fb5", "#7b5ac9", "#e86e9a"];
  for (let i = 0; i < 4; i++) {
    const x = i * 256;
    g.fillStyle = "#3a3f4c"; g.fillRect(x, 0, 256, 256);
    g.fillStyle = aw[Math.floor(r() * 6)]!; g.fillRect(x + 6, 10, 244, 56);
    for (let s = 0; s < 8; s++) { g.fillStyle = s % 2 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0)"; g.fillRect(x + 6 + s * 30.5, 10, 30.5, 56); }
    const grd = g.createLinearGradient(0, 80, 0, 250); grd.addColorStop(0, "#9cc4e0"); grd.addColorStop(1, "#4a7aa0");
    g.fillStyle = grd; g.fillRect(x + 16, 80, 150, 170); g.fillStyle = "#2a2e38"; g.fillRect(x + 180, 90, 60, 166);
    g.fillStyle = "rgba(255,240,200,0.5)"; g.fillRect(x + 24, 160, 130, 80);
  }
});
const boardTex = () => ctex("chalkboard", 512, 256, (g, r) => {
  g.fillStyle = "#2f4a3c"; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 40; i++) { g.strokeStyle = "rgba(255,255,255,0.08)"; g.lineWidth = 6 + r() * 10; g.beginPath(); const x = r() * 512, y = r() * 256; g.moveTo(x, y); g.lineTo(x + 80, y + (r() - 0.5) * 30); g.stroke(); } // old chalk smears, no writing
  g.strokeStyle = "#8a6a44"; g.lineWidth = 16; g.strokeRect(0, 0, 512, 256);
});
const tilesTex = () => ctex("labTiles", 512, 512, (g) => {
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? "#e9ecef" : "#cfd8dc"; g.fillRect(i * 64, j * 64, 64, 64); }
});

const quadUpUV = (x0: number, x1: number, z0: number, z1: number, y: number, u: number, v: number) => {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const uv = g.attributes.uv!; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
  return g;
};
const cyl = (x: number, z: number, r: number, y0: number, y1: number, n = 12) => { const c = new THREE.CylinderGeometry(r, r, y1 - y0, n); c.translate(x, (y0 + y1) / 2, z); return c; };

/** a cartoon car: body, cabin with dark windows, four wheels; along x (heading +x) centred on (x, z) */
export const carGeo = (b: Batch, color: string, x: number, z: number, yaw = 0) => {
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, D0, z);
  const body = lam("car" + color, () => ({ color })), glass = lam("carGlass", () => ({ color: "#2d3a4f" })), tyre = lam("tyre", () => ({ color: "#1d1d24" }));
  b.add(boxGeo(V(-2.1, 0.35, -0.9), V(2.1, 1.05, 0.9)), body, m);
  b.add(boxGeo(V(-1.1, 1.05, -0.8), V(1.0, 1.65, 0.8)), body, m);
  b.add(boxGeo(V(-1.05, 1.1, -0.82), V(0.95, 1.55, 0.82)), glass, m);
  for (const wx of [-1.35, 1.35]) for (const wz of [-0.85, 0.85]) { const w = new THREE.CylinderGeometry(0.36, 0.36, 0.25, 14); w.rotateX(Math.PI / 2); w.translate(wx, 0.36, wz); b.add(w, tyre, m); }
};

export function buildCity(root: THREE.Object3D, kit: Kit, d: NonNullable<Decor["city"]>) {
  const C = CITY, E = C.extent;
  const b = new Batch(), st = new Batch(); // st: buildings (no cast shadows, so streets stay lit at golden hour)
  const M = {
    asphalt: lam("asphaltM", () => ({ map: asphaltTex() })),
    marks: new THREE.MeshLambertMaterial({ map: markingsTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    walk: lam("pavementM", () => ({ map: pavementTex() })),
    kerb: lam("kerbM", () => ({ color: "#b3ada3" })),
    shop: lam("shopM", () => ({ map: shopTex() })),
    roof: lam("cityRoof", () => ({ color: "#8a8f99" })),
    metal: lam("cityMetal", () => ({ color: "#4a505c" })),
    lampGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.4, 1.1) }),
    red: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.3, 0.25) }),
    green: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.3, 0.5) }),
    planter: lam("planter", () => ({ color: "#9a8f80" })),
  };
  // roads (1 cm up), markings (2 cm), pavements (3 cm) with kerbs
  b.add(quadUpUV(-E, E, -C.road, C.road, D0 + 0.01, (2 * E) / 8, (2 * C.road) / 8), M.asphalt);
  b.add(quadUpUV(-C.crossX, C.crossX, -E, E, D0 + 0.011, (2 * C.crossX) / 8, (2 * E) / 8), M.asphalt);
  const mk = quadUpUV(-E, E, -C.road, C.road, D0 + 0.02, 1, 1);
  const marks = new THREE.Mesh(mk, M.marks); marks.receiveShadow = true; root.add(marks);
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) { // four pavement corners around the junction
    const x0 = sx < 0 ? -E : C.crossX, x1 = sx < 0 ? -C.crossX : E, z0 = sz < 0 ? -E : C.road, z1 = sz < 0 ? -C.road : E;
    b.add(quadUpUV(x0, x1, z0, z1, D0 + 0.03, (x1 - x0) / 4, (z1 - z0) / 4), M.walk);
    b.add(boxGeo(V(x0, D0, sz < 0 ? -C.road - 0.25 : C.road), V(x1, D0 + 0.15, sz < 0 ? -C.road : C.road + 0.25)), M.kerb);
  }
  // building blocks along both sides of the main road, leaving the cross street open
  let k = 0;
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
    let x = C.crossX + 5;
    while (x < E - 10) {
      const w = 12 + ((k * 37) % 13), h = 14 + ((k * 53) % 34), dep = 14 + ((k * 29) % 10);
      const xa = sx * x, xb = sx * (x + w), x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
      const zf = sz * C.walk, zb = sz * (C.walk + dep), z0 = Math.min(zf, zb), z1 = Math.max(zf, zb);
      const fm = lam(`facadeMat${k % 8}`, () => ({ map: facadeTex(k % 8) }));
      const g = boxGeo(V(x0, D0, z0), V(x1, D0 + h, z1));
      // facade uv: one 4 x 4 m bay per tile
      const uv = g.attributes.uv!, pos = g.attributes.position!;
      for (let i = 0; i < uv.count; i++) {
        const px = pos.getX(i), py = pos.getY(i) - D0, pz = pos.getZ(i);
        uv.setXY(i, (Math.abs(px - x0) < 0.01 || Math.abs(px - x1) < 0.01 ? pz : px) / 4, (py - 4.5) / 4);
      }
      st.add(g, fm);
      st.add(boxGeo(V(x0 - 0.3, D0 + h, z0 - 0.3), V(x1 + 0.3, D0 + h + 0.6, z1 + 0.3)), M.roof);
      if ((k * 7) % 3 === 0) st.add(boxGeo(V(x0 + 2, D0 + h + 0.6, z0 + 2), V(x0 + 6, D0 + h + 3, z0 + 5)), M.metal); // rooftop plant
      // ground-floor shops: a band 4.5 m high on the street face
      const fz = zf + sz * -0.02;
      const shop = new THREE.PlaneGeometry(x1 - x0, 4.5); if (sz < 0) shop.rotateY(0); else shop.rotateY(Math.PI);
      shop.translate((x0 + x1) / 2, D0 + 2.25, fz);
      const suv = shop.attributes.uv!; for (let i = 0; i < suv.count; i++) suv.setX(i, suv.getX(i) * ((x1 - x0) / 16));
      st.add(shop, M.shop);
      x += w + 1.5; k++;
    }
  }
  // street furniture on the pavements: lamps every 20 m, trees in planters between them, traffic lights at the junction
  for (const sz of [-1, 1]) for (let x = -E + 10; x < E - 5; x += 20) {
    if (Math.abs(x) < C.crossX + 6) continue;
    const z = sz * (C.road + 1.2);
    b.add(cyl(x, z, 0.1, D0, D0 + 7), M.metal);
    b.add(boxGeo(V(x - 0.15, D0 + 6.9, z - sz * 1.4), V(x + 0.15, D0 + 7.05, z)), M.metal);
    b.add(boxGeo(V(x - 0.25, D0 + 6.75, z - sz * 1.5), V(x + 0.25, D0 + 6.9, z - sz * 0.9)), M.lampGlow);
    const tx = x + 10;
    if (Math.abs(tx) > C.crossX + 6 && tx < E - 5) {
      b.add(boxGeo(V(tx - 0.8, D0, z - 0.8), V(tx + 0.8, D0 + 0.6, z + 0.8)), M.planter);
      const t = kitClone(kit, (tx * 7) % 2 ? "tree_default" : "tree-high-round", 6);
      if (t) { t.position.set(tx, D0 + 0.6, z); root.add(t); }
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (C.crossX + 0.8), z = sz * (C.road + 0.8);
    b.add(cyl(x, z, 0.09, D0, D0 + 3.4), M.metal);
    b.add(boxGeo(V(x - 0.25, D0 + 3.4, z - 0.25), V(x + 0.25, D0 + 4.6, z + 0.25)), M.metal);
    b.add(boxGeo(V(x - 0.13, D0 + 4.1, z - 0.27), V(x + 0.13, D0 + 4.4, z + 0.27)), sx * sz > 0 ? M.red : M.green); // one lamp lit (red one way, green the other)
  }
  // parked cars along both kerbs
  const colors = ["#e2453c", "#3f6fb5", "#f0b43c", "#f4f1ea", "#2f8a4f", "#3b3f52", "#7b5ac9"];
  for (const sz of [-1, 1]) for (let x = -E + 15, i = 0; x < E - 10; x += 9 + ((i * 13) % 7), i++) {
    if (Math.abs(x) < C.crossX + 12 || i % 4 === 3) continue;
    carGeo(b, colors[(i + (sz > 0 ? 3 : 0)) % 7]!, x, sz * (C.road - 1.3), sz > 0 ? Math.PI : 0);
  }
  if (d.lab) buildLab(b, st);
  b.build(root);
  st.build(root, false);
}

/** the laboratory interior around (0, LAB_Z): floor 18 x 12, walls 5 m on three sides and a low one in front (z+) */
function buildLab(b: Batch, st: Batch) {
  const z = LAB_Z, X = 9, Z = 6, H = 5;
  const M = {
    floor: lam("labFloor", () => ({ map: tilesTex() })),
    wall: lam("labWall", () => ({ color: "#eef1ea" })),
    stripe: lam("labStripe", () => ({ color: "#5fa89a" })),
    bench: lam("labBench", () => ({ color: "#3b3f52" })),
    top: lam("labTop", () => ({ color: "#d9dde0" })),
    board: lam("labBoard", () => ({ map: boardTex() })),
    glassA: new THREE.MeshLambertMaterial({ color: "#7fdc9a", transparent: true, opacity: 0.8 }),
    glassB: new THREE.MeshLambertMaterial({ color: "#f07fae", transparent: true, opacity: 0.8 }),
    glassC: new THREE.MeshLambertMaterial({ color: "#7fb8f0", transparent: true, opacity: 0.8 }),
    copper: lam("copper", () => ({ color: "#c8763a" })),
    metal: lam("labMetal", () => ({ color: "#7d8088" })),
    wood: lam("labShelf", () => ({ color: "#8a6a44" })),
  };
  b.add(quadUpUV(-X, X, z - Z, z + Z, D0 + 0.02, X / 1.5, Z / 1.5), M.floor);
  st.add(boxGeo(V(-X, D0, z - Z - 0.3), V(X, D0 + H, z - Z)), M.wall);
  st.add(boxGeo(V(-X - 0.3, D0, z - Z), V(-X, D0 + H, z + Z)), M.wall);
  st.add(boxGeo(V(X, D0, z - Z), V(X + 0.3, D0 + H, z + Z)), M.wall);
  st.add(boxGeo(V(-X, D0 + 1.0, z - Z + 0.01), V(X, D0 + 1.25, z - Z + 0.05)), M.stripe);
  st.add(boxGeo(V(-X - 0.31, D0, z + Z), V(X + 0.31, D0 + 0.9, z + Z + 0.3)), M.wall); // low front wall: lenses look over it
  // chalkboard on the back wall, shelves with jars on the left wall
  b.add(boxGeo(V(-3.5, D0 + 1.6, z - Z + 0.02), V(3.5, D0 + 3.8, z - Z + 0.12)), M.board);
  for (const y of [1.4, 2.4, 3.4]) {
    b.add(boxGeo(V(-X + 0.02, D0 + y, z - 4), V(-X + 0.6, D0 + y + 0.06, z + 2)), M.wood);
    for (let i = 0; i < 6; i++) b.add(cyl(-X + 0.3, z - 3.5 + i, 0.16, D0 + y + 0.06, D0 + y + 0.5), [M.glassA, M.glassB, M.glassC][(i + y * 2) % 3 | 0]!);
  }
  // two benches with flasks and a burner
  for (const bx of [-4, 3]) {
    b.add(boxGeo(V(bx - 2.5, D0, z - 0.8), V(bx + 2.5, D0 + 0.9, z + 0.8)), M.bench);
    b.add(boxGeo(V(bx - 2.6, D0 + 0.9, z - 0.9), V(bx + 2.6, D0 + 0.98, z + 0.9)), M.top);
    for (let i = 0; i < 4; i++) {
      const fx = bx - 1.8 + i * 1.2, mat = [M.glassA, M.glassB, M.glassC][i % 3]!;
      const flask = new THREE.ConeGeometry(0.22, 0.45, 16); flask.translate(fx, D0 + 0.98 + 0.225, z + (i % 2 ? 0.3 : -0.3)); b.add(flask, mat);
      b.add(cyl(fx, z + (i % 2 ? 0.3 : -0.3), 0.06, D0 + 1.4, D0 + 1.65), mat);
    }
  }
  // the coil machine in the right back corner
  b.add(cyl(6.5, z - 3.5, 0.9, D0, D0 + 0.6, 20), M.metal);
  b.add(cyl(6.5, z - 3.5, 0.35, D0 + 0.6, D0 + 3.2, 16), M.copper);
  for (let i = 0; i < 9; i++) { const t = new THREE.TorusGeometry(0.42, 0.05, 6, 20); t.rotateX(Math.PI / 2); t.translate(6.5, D0 + 0.8 + i * 0.27, z - 3.5); b.add(t, M.copper); }
  const ball = new THREE.SphereGeometry(0.55, 20, 14); ball.translate(6.5, D0 + 3.6, z - 3.5); b.add(ball, M.metal);
}
