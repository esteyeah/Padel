// ============================================================================
//  Environnement du club autour du court central :
//   - sol pavé + pelouse, haies ;
//   - deux courts voisins (géométrie simplifiée et fusionnée) ;
//   - tribune derrière le fond + gradins latéraux, public instancié et animé ;
//   - club-house éclairé, palmiers procéduraux, silhouette de ville au loin.
//  Tout est procédural ; la plupart des éléments sont fusionnés ou instanciés
//  pour garder un nombre d'appels de dessin raisonnable.
// ============================================================================
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COURT, netHeightAt } from '../config.js';
import * as TX from './Textures.js';
import { hedge } from './Foliage.js';

const HW = COURT.halfW, HL = COURT.halfL;

// ------------------------------------------------------------------ textures
export function canvasTex(w, h, draw, { srgb = true, repeat = true, renderer } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (renderer) t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

export const pavingTex = (r) => canvasTex(256, 256, (g, S) => {
  g.fillStyle = '#b9a58c'; g.fillRect(0, 0, S, S);
  const n = 4, s = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = 175 + Math.random() * 30;
    g.fillStyle = `rgb(${v + 12},${v - 4},${v - 28})`;
    g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
  }
  for (let k = 0; k < 3000; k++) {
    g.fillStyle = `rgba(60,40,20,${Math.random() * 0.12})`;
    g.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
}, { renderer: r });

export const grassTex = (r) => canvasTex(256, 256, (g, S) => {
  g.fillStyle = '#3d6b2c'; g.fillRect(0, 0, S, S);
  for (let k = 0; k < 9000; k++) {
    const l = 22 + Math.random() * 22;
    g.fillStyle = `hsla(${95 + Math.random() * 25},45%,${l}%,0.5)`;
    g.fillRect(Math.random() * S, Math.random() * S, 1.5, 3);
  }
}, { renderer: r });

export const hedgeTex = () => canvasTex(128, 128, (g, S) => {
  g.fillStyle = '#1f4a1e'; g.fillRect(0, 0, S, S);
  for (let k = 0; k < 1400; k++) {
    g.fillStyle = `hsla(${100 + Math.random() * 30},50%,${16 + Math.random() * 22}%,0.9)`;
    g.beginPath(); g.ellipse(Math.random() * S, Math.random() * S, 3 + Math.random() * 3, 2, Math.random() * 3, 0, 7); g.fill();
  }
});

export const frondTex = () => canvasTex(64, 256, (g, W, H) => {
  g.clearRect(0, 0, W, H);
  g.strokeStyle = '#3b6a22'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(W / 2, H); g.lineTo(W / 2, 0); g.stroke();
  for (let y = 6; y < H; y += 5) {
    const len = (W / 2 - 2) * Math.sin((y / H) * Math.PI) ** 0.6;
    g.strokeStyle = `hsl(${95 + Math.random() * 20},${45 + Math.random() * 15}%,${22 + Math.random() * 14}%)`;
    g.lineWidth = 2.5;
    for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(W / 2, y); g.lineTo(W / 2 + sx * len, y + 9); g.stroke(); }
  }
}, { repeat: false });

export const trunkTex = () => canvasTex(64, 128, (g, W, H) => {
  g.fillStyle = '#6b543b'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 8) {
    g.fillStyle = 'rgba(40,28,16,0.6)'; g.fillRect(0, y, W, 2);
    g.fillStyle = 'rgba(150,120,85,0.25)'; g.fillRect(0, y + 3, W, 2);
  }
});

/** Façade : fenêtres (map) + fenêtres allumées (emissiveMap). */
export function facadeTextures() {
  const lit = [];
  const map = canvasTex(512, 256, (g, W, H) => {
    g.fillStyle = '#d9d4cb'; g.fillRect(0, 0, W, H);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 8; col++) {
        const x = 16 + col * 62, y = 30 + row * 110;
        g.fillStyle = '#28323d'; g.fillRect(x, y, 50, 80);
        g.fillStyle = '#4a5866'; g.fillRect(x + 4, y + 4, 42, 34);
        if (Math.random() < 0.7) lit.push([x, y]);
      }
    }
    g.fillStyle = '#a99f92'; g.fillRect(0, 120, W, 8);
  });
  const emissive = canvasTex(512, 256, (g, W, H) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    for (const [x, y] of lit) { g.fillStyle = `rgb(255,${200 + Math.random() * 40},${130 + Math.random() * 50})`; g.fillRect(x + 3, y + 3, 44, 74); }
  });
  return { map, emissive };
}

export const skylineTex = () => canvasTex(64, 128, (g, W, H) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  for (let y = 4; y < H; y += 8) for (let x = 3; x < W; x += 8) {
    if (Math.random() < 0.45) { g.fillStyle = `rgba(255,${190 + Math.random() * 50},120,${0.5 + Math.random() * 0.5})`; g.fillRect(x, y, 4, 4); }
  }
});

// ------------------------------------------------------------------ helpers
export const at = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => {
  geo.rotateX(rx); geo.rotateY(ry); geo.rotateZ(rz);
  return geo.translate(x, y, z);
};
export const mesh = (geos, mat, { shadow = false, receive = true } = {}) => {
  const any = geos.some((g) => g.index), all = geos.every((g) => g.index);
  if (any && !all) geos = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const m = new THREE.Mesh(mergeGeometries(geos), mat);
  m.castShadow = shadow; m.receiveShadow = receive;
  return m;
};
export function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return geo;
}

// ------------------------------------------------------------------ court voisin
export function neighborCourt(x0, mats) {
  const g = new THREE.Group();
  g.position.x = x0;
  const turf = new THREE.Mesh(at(new THREE.PlaneGeometry(2 * HW, 2 * HL), 0, 0.006, 0, -Math.PI / 2), mats.turf);
  turf.receiveShadow = true;
  g.add(turf);
  g.add(mesh([
    at(new THREE.PlaneGeometry(2 * HW, 0.05), 0, 0.01, COURT.serviceLine, -Math.PI / 2),
    at(new THREE.PlaneGeometry(2 * HW, 0.05), 0, 0.01, -COURT.serviceLine, -Math.PI / 2),
    at(new THREE.PlaneGeometry(0.05, 14.3), 0, 0.01, 0, -Math.PI / 2),
  ], mats.line));
  // filet
  const net = new THREE.PlaneGeometry(2 * HW, 0.86);
  scaleUV(net, 2 * HW / 0.045, 0.86 / 0.045);
  g.add(new THREE.Mesh(at(net, 0, 0.44, 0), mats.net));
  g.add(new THREE.Mesh(at(new THREE.BoxGeometry(2 * HW, 0.05, 0.01), 0, netHeightAt(0), 0), mats.line));
  // vitres
  const glass = [];
  for (const sz of [-1, 1]) {
    glass.push(at(new THREE.PlaneGeometry(2 * HW, 3), 0, 1.5, sz * HL));
    for (const sx of [-1, 1]) {
      glass.push(at(new THREE.PlaneGeometry(2, 3), sx * HW, 1.5, sz * 9, 0, Math.PI / 2));
      glass.push(at(new THREE.PlaneGeometry(2, 2), sx * HW, 1, sz * 7, 0, Math.PI / 2));
    }
  }
  g.add(mesh(glass, mats.glass));
  // grillage
  const wire = [];
  const wp = (w, h, x, y, z, ry) => wire.push(at(scaleUV(new THREE.PlaneGeometry(w, h), w / 0.05, h / 0.05), x, y, z, 0, ry));
  for (const sz of [-1, 1]) wp(2 * HW, 1, 0, 3.5, sz * HL, 0);
  for (const sx of [-1, 1]) {
    wp(12, 3, sx * HW, 1.5, 0, Math.PI / 2);
    for (const sz of [-1, 1]) { wp(2, 1, sx * HW, 3.5, sz * 9, Math.PI / 2); wp(2, 1, sx * HW, 2.5, sz * 7, Math.PI / 2); }
  }
  g.add(mesh(wire, mats.wire));
  // structure + projecteurs
  const frame = [], lens = [];
  for (const sx of [-1, 1]) {
    for (let z = -HL; z <= HL; z += 2) { const h = Math.abs(z) >= 8 ? 4 : 3; frame.push(at(new THREE.BoxGeometry(0.07, h, 0.07), sx * (HW + 0.05), h / 2, z)); }
    frame.push(at(new THREE.BoxGeometry(0.05, 0.05, 2 * HL), sx * (HW + 0.05), 3, 0));
    for (const sz of [-1, 1]) {
      frame.push(at(new THREE.CylinderGeometry(0.07, 0.09, 6.4, 8), sx * (HW + 0.6), 3.2, sz * 4.2));
      frame.push(at(new THREE.BoxGeometry(0.7, 0.12, 0.5), sx * (HW + 0.35), 6.25, sz * 4.2, 0, 0, sx * 0.35));
      lens.push(at(new THREE.PlaneGeometry(0.62, 0.42), sx * (HW + 0.33), 6.17, sz * 4.2, Math.PI / 2, 0, sx * 0.35));
    }
  }
  for (const sz of [-1, 1]) frame.push(at(new THREE.BoxGeometry(2 * HW, 0.05, 0.05), 0, 4, sz * (HL + 0.05)));
  g.add(mesh(frame, mats.frame, { shadow: true }));
  g.add(mesh(lens, mats.lamp, { receive: false }));
  return g;
}

// ------------------------------------------------------------------ palmier (gabarit fusionné)
export function palmTemplate() {
  const trunk = [];
  let x = 0, y = 0, lean = 0;
  const H = 6, N = 7;
  for (let i = 0; i < N; i++) {
    const h = H / N;
    const r0 = 0.2 - i * 0.012, r1 = 0.2 - (i + 1) * 0.012;
    const seg = new THREE.CylinderGeometry(r1, r0, h * 1.02, 9);
    seg.rotateZ(-lean);
    seg.translate(x + Math.sin(lean) * h / 2, y + Math.cos(lean) * h / 2, 0);
    scaleUV(seg, 1, 2);
    trunk.push(seg);
    x += Math.sin(lean) * h; y += Math.cos(lean) * h;
    lean += 0.035;
  }
  const crown = [];
  for (let k = 0; k < 9; k++) {
    const len = 2.4 + (k % 3) * 0.3;
    const f = new THREE.PlaneGeometry(0.62, len, 1, 8);
    const p = f.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = (p.getY(i) + len / 2) / len;              // 0 base -> 1 pointe
      p.setXYZ(i, p.getX(i), v * len, -(v * v) * 1.4 + v * 0.5);
    }
    f.rotateX(-Math.PI / 2 + 0.25 + (k % 2) * 0.25);
    f.rotateY((k / 9) * Math.PI * 2);
    f.translate(x, y, 0);
    f.computeVertexNormals();
    crown.push(f);
  }
  crown.push(new THREE.SphereGeometry(0.28, 8, 6).translate(x, y - 0.05, 0));
  return { trunk: mergeGeometries(trunk), crown: mergeGeometries(crown.map((g) => g.toNonIndexed())), top: new THREE.Vector3(x, y, 0) };
}

// ------------------------------------------------------------------ public
const SHIRTS = [0xe53935, 0x1e88e5, 0xfdd835, 0xffffff, 0x43a047, 0x212121, 0xfb8c00, 0x8e24aa, 0x00acc1, 0xf06292];
const SKINS = [0xf6d3b3, 0xeac09a, 0xd9a47c, 0xc0875e, 0x9a6440, 0x6e4529];

/** Spectateur assis (un seul maillage) : torse modelé, cuisses en avant, jambes ; pantalon plus sombre (couleurs de sommets). */
function seatedBodyGeometry() {
  const parts = [];
  const torso = new THREE.LatheGeometry([
    new THREE.Vector2(0.0, 0.1), new THREE.Vector2(0.13, 0.11), new THREE.Vector2(0.16, 0.2), new THREE.Vector2(0.15, 0.34),
    new THREE.Vector2(0.17, 0.48), new THREE.Vector2(0.19, 0.6), new THREE.Vector2(0.16, 0.66), new THREE.Vector2(0.07, 0.7), new THREE.Vector2(0.05, 0.76), new THREE.Vector2(0.0, 0.77),
  ], 9).scale(1, 1, 0.68);
  parts.push([torso, 1]);
  for (const sx of [-1, 1]) {
    parts.push([new THREE.CapsuleGeometry(0.075, 0.3, 1, 6).rotateX(Math.PI / 2).translate(sx * 0.085, 0.13, 0.2), 0.3]);
    parts.push([new THREE.CapsuleGeometry(0.06, 0.32, 1, 6).translate(sx * 0.09, -0.12, 0.38), 0.3]);
    parts.push([new THREE.SphereGeometry(0.06, 6, 4).scale(1, 0.6, 1.8).translate(sx * 0.09, -0.32, 0.43), 0.12]);
  }
  const geos = parts.map(([g, k]) => {
    g = g.index ? g.toNonIndexed() : g;
    g.deleteAttribute('uv');
    const n = g.attributes.position.count, col = new Float32Array(n * 3).fill(k);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
  const merged = mergeGeometries(geos);
  merged.computeVertexNormals();
  return merged;
}

const HAIRS = [0x17100b, 0x2e1c10, 0x4a2e19, 0x7a5232, 0xb08a4f, 0x8f8f8f, 0xc9a35a, 0x5a2a12];

export class Crowd {
  constructor(root, seats) {
    const n = seats.length;
    this.bodies = new THREE.InstancedMesh(seatedBodyGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.85, vertexColors: true }), n);
    this.heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 10, 8).scale(0.88, 1.08, 0.95), new THREE.MeshStandardMaterial({ roughness: 0.6 }), n);
    this.hair = new THREE.InstancedMesh(new THREE.SphereGeometry(0.104, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(0.9, 1.1, 0.98).rotateX(-0.25), new THREE.MeshStandardMaterial({ roughness: 0.7 }), n);
    this.arms = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.042, 0.36, 1, 5).translate(0, 0.2, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 }), n * 2);
    const c = new THREE.Color();
    this.seats = seats.map((s, i) => {
      this.bodies.setColorAt(i, c.setHex(SHIRTS[(Math.random() * SHIRTS.length) | 0]));
      const skin = SKINS[(Math.random() * SKINS.length) | 0];
      this.heads.setColorAt(i, c.setHex(skin));
      this.hair.setColorAt(i, c.setHex(HAIRS[(Math.random() * HAIRS.length) | 0]));
      this.arms.setColorAt(i * 2, c.setHex(skin));
      this.arms.setColorAt(i * 2 + 1, c.setHex(skin));
      return { ...s, scale: 0.9 + Math.random() * 0.2, phase: Math.random() * 10, fan: Math.random(), bald: Math.random() < 0.12 };
    });
    for (const m of [this.bodies, this.heads, this.hair, this.arms]) { m.castShadow = false; m.receiveShadow = true; root.add(m); }
    this.excite = 0;
    this.time = 0;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.sc = new THREE.Vector3();
    this.update(0, true);
  }

  cheer(k) { this.excite = Math.max(this.excite, k); }

  update(dt, force = false) {
    this.time += dt;
    this.excite = Math.max(0, this.excite - dt * 0.35);
    if (!force && this.excite <= 0 && Math.floor(this.time * 10) === Math.floor((this.time - dt) * 10)) return; // ralenti au repos
    const { m, q, e, v, sc } = this;
    this.seats.forEach((s, i) => {
      const ex = this.excite * (0.4 + s.fan * 0.6);
      const stand = ex > 0.35 ? 1 : 0;
      const bounce = Math.max(0, Math.sin(this.time * 9 + s.phase)) * 0.12 * ex;
      const sway = Math.sin(this.time * 0.8 + s.phase) * 0.04;
      const y = s.y + stand * 0.28 + bounce;
      e.set(0, s.ry, sway);
      q.setFromEuler(e);
      m.compose(v.set(s.x, y, s.z), q, sc.setScalar(s.scale));
      this.bodies.setMatrixAt(i, m);
      m.compose(v.set(s.x, y + 0.86 * s.scale, s.z), q, sc.setScalar(s.scale));
      this.heads.setMatrixAt(i, m);
      if (s.bald) m.scale(sc.setScalar(0.001));
      this.hair.setMatrixAt(i, m);
      // bras : baissés au repos, levés quand le public s'enflamme
      for (const side of [-1, 1]) {
        const up = ex > 0.2 ? Math.PI - 0.4 + Math.sin(this.time * 12 + s.phase + side) * 0.3 : 0.15;
        e.set(0, s.ry, side * up);
        q.setFromEuler(e);
        const ox = Math.cos(s.ry) * side * 0.2, oz = -Math.sin(s.ry) * side * 0.2;
        m.compose(v.set(s.x + ox * s.scale, y + (up > 1 ? 0.62 : 0.24) * s.scale, s.z + oz * s.scale), q, sc.setScalar(s.scale));
        this.arms.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), m);
      }
    });
    this.bodies.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
    this.hair.instanceMatrix.needsUpdate = true;
    this.arms.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ construction
export function buildSurroundings(root, renderer, { lampMat, wireMap, turfMap, skipApron = false, skipCourts = false, focus = [0, 0] }) {
  const out = { emissive: [], windows: [] };

  // ---- sols
  const grass = TX.photoTex('sparse_grass', 90, 90);
  const ground = new THREE.Mesh(at(new THREE.PlaneGeometry(280, 280), 0, 0, 0, -Math.PI / 2), new THREE.MeshStandardMaterial({ map: grass, normalMap: grass.userData.normal, color: new THREE.Color(0x8fcc52).multiplyScalar(1.2), roughness: 1 }));
  ground.receiveShadow = true;
  root.add(ground);
  const pave = TX.groundTex(renderer, 'paving', 15, 13);
  const plaza = new THREE.Mesh(at(new THREE.PlaneGeometry(60, 52), 0, 0.002, -2, -Math.PI / 2), new THREE.MeshStandardMaterial({ map: pave, normalMap: pave.userData.normal, roughness: 0.9 }));
  plaza.receiveShadow = true;
  root.add(plaza);
  const apron = new THREE.Mesh(at(new THREE.PlaneGeometry(2 * HW + 2.4, 2 * HL + 2.4), 0, 0.004, 0, -Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1d3b6b, roughness: 1 }));
  apron.receiveShadow = true;
  if (!skipApron) root.add(apron);

  // ---- courts voisins
  const nMats = {
    turf: new THREE.MeshStandardMaterial({ map: turfMap, roughness: 0.95 }),
    line: new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.8 }),
    net: new THREE.MeshStandardMaterial({ map: TX.makeNetTexture(renderer), transparent: true, side: THREE.DoubleSide, color: 0x666666, depthWrite: false }),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfe8ee, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false }),
    wire: new THREE.MeshStandardMaterial({ map: wireMap, color: 0x9aa0a8, transparent: true, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.5, depthWrite: false }),
    frame: new THREE.MeshStandardMaterial({ color: 0x1b1e23, metalness: 0.6, roughness: 0.45 }),
    lamp: lampMat,
  };
  for (const x of skipCourts ? [] : [-15.5, 17.5]) {
    const c = neighborCourt(x, nMats);
    root.add(c);
    const ap = new THREE.Mesh(at(new THREE.PlaneGeometry(2 * HW + 2, 2 * HL + 2), x, 0.003, 0, -Math.PI / 2), apron.material);
    ap.receiveShadow = true;
    root.add(ap);
  }

  // ---- tribune derrière le fond (z < 0) et gradins latéraux (x > 0)
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8d9097, roughness: 0.9 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.6 });
  const steps = [], seatsGeo = [], seats = [];
  const ROWS = 6, ROW_D = 0.85, ROW_H = 0.42, Z0 = -(HL + 2.6), W = 15;
  for (let r = 0; r < ROWS; r++) {
    const z = Z0 - r * ROW_D, top = (r + 1) * ROW_H;
    steps.push(at(new THREE.BoxGeometry(W, top, ROW_D), 0, top / 2, z - ROW_D / 2));
    for (let i = 0; i < 19; i++) {
      const x = -W / 2 + 0.5 + i * ((W - 1) / 18);
      seatsGeo.push(at(new RoundedBoxGeometry(0.46, 0.08, 0.4, 1, 0.025), x, top + 0.04, z - 0.35));
      seatsGeo.push(at(new RoundedBoxGeometry(0.46, 0.4, 0.06, 1, 0.025), x, top + 0.22, z - 0.58));
      if (Math.random() < 0.72) seats.push({ x: x + (Math.random() - 0.5) * 0.06, y: top + 0.02, z: z - 0.36, ry: 0 });
    }
  }
  // rampes et escaliers d'accès
  for (const sx of [-1, 1]) steps.push(at(new THREE.BoxGeometry(0.3, ROWS * ROW_H + 1, ROWS * ROW_D), sx * (W / 2 + 0.15), (ROWS * ROW_H + 1) / 2, Z0 - (ROWS * ROW_D) / 2));
  steps.push(at(new THREE.BoxGeometry(W + 0.6, 1.1, 0.25), 0, ROWS * ROW_H + 0.55, Z0 - ROWS * ROW_D - 0.1));
  // gradins latéraux (côté droit)
  const SX0 = HW + 2.3;
  for (let r = 0; r < 3; r++) {
    const x = SX0 + r * ROW_D, top = (r + 1) * ROW_H;
    steps.push(at(new THREE.BoxGeometry(ROW_D, top, 12), x + ROW_D / 2, top / 2, 0));
    for (let i = 0; i < 14; i++) {
      const z = -6 + 0.45 + i * (11.1 / 13);
      seatsGeo.push(at(new RoundedBoxGeometry(0.4, 0.08, 0.46, 1, 0.025), x + 0.35, top + 0.04, z));
      seatsGeo.push(at(new RoundedBoxGeometry(0.06, 0.4, 0.46, 1, 0.025), x + 0.58, top + 0.22, z));
      if (Math.random() < 0.6) seats.push({ x: x + 0.36, y: top + 0.02, z, ry: -Math.PI / 2 });
    }
  }
  root.add(mesh(steps, concrete, { shadow: true }));
  root.add(mesh(seatsGeo, seatMat));
  out.crowd = new Crowd(root, seats);

  // ---- bancs des joueurs (côté gauche) + glacière
  const benchWood = new THREE.MeshStandardMaterial({ color: 0x8a6542, roughness: 0.8 });
  const benchMetal = new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.6, roughness: 0.4 });
  const wood = [], metal = [];
  for (const z of [-1.6, 1.6]) {
    wood.push(at(new THREE.BoxGeometry(0.45, 0.06, 1.8), -(HW + 1.2), 0.46, z));
    wood.push(at(new THREE.BoxGeometry(0.06, 0.4, 1.8), -(HW + 1.42), 0.7, z));
    for (const dz of [-0.8, 0.8]) metal.push(at(new THREE.BoxGeometry(0.4, 0.44, 0.05), -(HW + 1.2), 0.22, z + dz));
  }
  metal.push(at(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 12), -(HW + 1.25), 0.25, 0));
  root.add(mesh(wood, benchWood, { shadow: true }), mesh(metal, benchMetal, { shadow: true }));

  // ---- haies
  for (const z of [HL + 6, -(HL + 10.6)]) root.add(hedge(46, 1.3, 1.1, 0, 0.65, z));
  for (const x of [-24, 25]) root.add(hedge(1.1, 1.3, 36, x, 0.65, -2));

  // ---- club-house
  const fac = facadeTextures();
  const facadeMat = new THREE.MeshStandardMaterial({ map: fac.map, emissiveMap: fac.emissive, emissive: 0xffffff, emissiveIntensity: 1.2, roughness: 0.7 });
  out.windows.push(facadeMat);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xd9d4cb, roughness: 0.85 });
  const club = new THREE.Mesh(new RoundedBoxGeometry(30, 7, 8, 2, 0.1), [wallMat, wallMat, wallMat, wallMat, facadeMat, wallMat]);
  club.position.set(0, 3.5, -(HL + 18));
  club.castShadow = true; club.receiveShadow = true;
  root.add(club);
  // toit débordant à arêtes arrondies, avec bandeau métallique
  const roof = new THREE.Mesh(new RoundedBoxGeometry(32, 0.4, 10, 2, 0.12), new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.6 }));
  roof.position.set(0, 7.2, -(HL + 17.6));
  roof.castShadow = true;
  root.add(roof);
  const zc = -(HL + 13.95);
  const det = [];
  // auvent vitré au-dessus de l'entrée, poteaux, soubassement, pilastres entre les baies
  det.push(at(new THREE.BoxGeometry(31, 0.12, 0.25), 0, 7.0, zc + 0.9));
  for (let x = -14; x <= 14; x += 4) det.push(at(new RoundedBoxGeometry(0.35, 7, 0.3, 2, 0.06), x, 3.5, zc + 0.12));
  det.push(at(new RoundedBoxGeometry(30.4, 0.5, 0.4, 2, 0.06), 0, 0.25, zc + 0.15));
  det.push(at(new RoundedBoxGeometry(30.4, 0.25, 0.35, 2, 0.05), 0, 3.6, zc + 0.15));   // dalle du 1er étage
  root.add(mesh(det, new THREE.MeshStandardMaterial({ color: 0xe9e5dc, roughness: 0.75 }), { shadow: true }));
  const canopy = [at(new THREE.BoxGeometry(8, 0.08, 2.4), 0, 3.4, zc + 1.3)];
  root.add(mesh(canopy, new THREE.MeshStandardMaterial({ color: 0xcfe8ee, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.45 })));
  const steel = [];
  for (const x of [-3.8, 3.8]) steel.push(at(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 10), x, 1.7, zc + 2.4));
  steel.push(at(new THREE.BoxGeometry(8.1, 0.1, 0.1), 0, 3.42, zc + 2.45));
  // jardinières et plantes au pied de la façade
  root.add(mesh(steel, new THREE.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0.7, roughness: 0.35 }), { shadow: true }));
  const pots = [];
  for (const x of [-12, -8, 8, 12]) pots.push(at(new RoundedBoxGeometry(1.6, 0.6, 0.7, 2, 0.08), x, 0.3, zc + 0.9));
  root.add(mesh(pots, new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.8 }), { shadow: true }));
  for (const x of [-12, -8, 8, 12]) root.add(hedge(1.3, 0.55, 0.5, x, 0.85, zc + 0.9, 0x4a7a32));
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 1.25),
    new THREE.MeshStandardMaterial({ map: TX.makeAdTexture(renderer, 'PADEL ARENA CLUB', ['#0b2a5b', '#123f86'], '#ffffff', '#ffd400'), emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.5 }),
  );
  sign.material.emissiveMap = sign.material.map;
  sign.position.set(0, 7.95, -(HL + 13.9));
  root.add(sign);
  out.emissive.push(sign.material);
  // parasols de la terrasse
  const paraTop = [], paraPole = [], tables = [];
  for (let i = 0; i < 5; i++) {
    const x = -10 + i * 5;
    paraTop.push(at(new THREE.ConeGeometry(1.4, 0.5, 10), x, 2.5, -(HL + 13)));
    paraPole.push(at(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), x, 1.2, -(HL + 13)));
    tables.push(at(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 14), x, 0.74, -(HL + 13)));
  }
  root.add(mesh(paraTop, new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.8 }), { shadow: true }));
  root.add(mesh([...paraPole, ...tables], benchMetal));

  // ---- palmiers
  const tpl = palmTemplate();
  const spots = [
    [-8.5, -15], [8.5, -15], [-21, -14], [22, -14], [-21, 8], [22, 6], [-9, 14], [9, 14],
    [-28, -24], [28, -24], [-14, 17], [15, 17], [-30, 4], [31, -6],
  ].filter(([x, z]) => !(Math.abs(x - focus[0]) < 9 && Math.abs(z - focus[1]) > 10 && Math.abs(z - focus[1]) < 24))
    // jamais sur un court (central ou voisins) ni juste contre ses vitres
    .filter(([x, z]) => ![[0, 0], [-15.5, 0], [17.5, 0]].some(([cx, cz]) => Math.abs(x - cx) < HW + 1.5 && Math.abs(z - cz) < HL + 1.5));
  const trunks = new THREE.InstancedMesh(tpl.trunk, new THREE.MeshStandardMaterial({ map: trunkTex(), roughness: 0.95 }), spots.length);
  const crowns = new THREE.InstancedMesh(tpl.crown, new THREE.MeshStandardMaterial({ map: frondTex(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 }), spots.length);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  spots.forEach(([x, z], i) => {
    q.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
    const s = 0.85 + Math.random() * 0.4;
    M.compose(v.set(x, 0, z), q, sc.set(s, s * (0.9 + Math.random() * 0.3), s));
    trunks.setMatrixAt(i, M);
    crowns.setMatrixAt(i, M);
  });
  trunks.castShadow = crowns.castShadow = true;
  root.add(trunks, crowns);

  // ---- silhouette de ville au loin
  const sk = skylineTex();
  const skyMat = new THREE.MeshStandardMaterial({ color: 0x2a3140, emissiveMap: sk, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 1 });
  out.windows.push(skyMat);
  const N = 40;
  const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), skyMat, N);
  for (let i = 0; i < N; i++) {
    const a = Math.PI * (0.62 + (i / N) * 1.76);
    const r = 170 + Math.random() * 50;
    q.setFromEuler(new THREE.Euler(0, -a, 0));
    M.compose(v.set(Math.cos(a) * r, 0, Math.sin(a) * r), q, sc.set(10 + Math.random() * 14, 10 + Math.random() * 26, 8 + Math.random() * 10));
    city.setMatrixAt(i, M);
  }
  root.add(city);
  return out;
}
