// ============================================================================
//  Textures procédurales (canvas) : gazon synthétique sablé, grillage, filet,
//  ombre de balle, panneaux publicitaires, asphalte. Aucun fichier externe.
// ============================================================================
import * as THREE from 'three';
import PH from '../assets/tex/polyhaven.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

/** Dessine `fn(x,y)` aux positions répliquées pour une texture parfaitement répétable. */
function wrapped(S, x, y, margin, fn) {
  for (const ox of [0, -S, S]) {
    for (const oy of [0, -S, S]) {
      const X = x + ox, Y = y + oy;
      if (X > -margin && X < S + margin && Y > -margin && Y < S + margin) fn(X, Y);
    }
  }
}

function finish(c, renderer, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
  t.needsUpdate = true;
  return t;
}

/** Gazon synthétique bleu avec fibres et grains de sable. Renvoie {map, bump}. */
const turfCache = new Map();
/** @param {object} o { base: couleur de fond, hue: teinte des fibres, sat, light } */
export function makeTurfTextures(renderer, o = {}) {
  const key = JSON.stringify(o);
  if (turfCache.has(key)) return turfCache.get(key);
  const res = makeTurf(renderer, o);
  turfCache.set(key, res);
  return res;
}

function makeTurf(renderer, { base = '#1d5a9c', hue = 207, sat = 55, light = 28 } = {}) {
  const S = 512;
  const [c, g] = makeCanvas(S, S);
  const [cb, gb] = makeCanvas(S, S);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  gb.fillStyle = '#808080'; gb.fillRect(0, 0, S, S);

  // grandes variations douces (usure, brossage)
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 40 + Math.random() * 90;
    const light = Math.random() < 0.5;
    wrapped(S, x, y, r, (X, Y) => {
      const grd = g.createRadialGradient(X, Y, 0, X, Y, r);
      grd.addColorStop(0, light ? 'rgba(120,170,230,0.07)' : 'rgba(5,20,50,0.08)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(X - r, Y - r, r * 2, r * 2);
    });
  }
  // fibres
  g.lineWidth = 1; gb.lineWidth = 1.2;
  for (let i = 0; i < 30000; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const len = 2 + Math.random() * 4.5;
    const a = Math.PI / 2 + (Math.random() - 0.5) * 0.9;
    const L = light + Math.random() * 22;
    const col = `hsla(${hue + Math.random() * 10}, ${sat + Math.random() * 22}%, ${L}%, 0.55)`;
    const b = Math.random() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)';
    wrapped(S, x, y, 8, (X, Y) => {
      g.strokeStyle = col;
      g.beginPath(); g.moveTo(X, Y); g.lineTo(X + Math.cos(a) * len, Y + Math.sin(a) * len); g.stroke();
      gb.strokeStyle = b;
      gb.beginPath(); gb.moveTo(X, Y); gb.lineTo(X + Math.cos(a) * len, Y + Math.sin(a) * len); gb.stroke();
    });
  }
  // sable de silice
  for (let i = 0; i < 11000; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 0.4 + Math.random() * 1.3;
    const col = `rgba(${(205 + Math.random() * 40) | 0},${(185 + Math.random() * 30) | 0},${(135 + Math.random() * 35) | 0},${0.16 + Math.random() * 0.28})`;
    wrapped(S, x, y, 3, (X, Y) => {
      g.fillStyle = col; g.fillRect(X, Y, r, r);
      gb.fillStyle = 'rgba(0,0,0,0.3)'; gb.fillRect(X, Y, r, r);
    });
  }
  return { map: finish(c, renderer), bump: finish(cb, renderer, { srgb: false }) };
}

/** Maille carrée 50 mm (une cellule par tuile). */
export function makeWireTexture(renderer, { color = 'rgba(22,25,30,1)', thickness = 6, size = 64 } = {}) {
  const [c, g] = makeCanvas(size, size);
  g.clearRect(0, 0, size, size);
  g.fillStyle = color;
  g.fillRect(0, 0, size, thickness);
  g.fillRect(0, 0, thickness, size);
  // petits points de soudure
  g.fillStyle = 'rgba(60,64,70,1)';
  g.fillRect(0, 0, thickness + 2, thickness + 2);
  return finish(c, renderer);
}

export function makeNetTexture(renderer) {
  const S = 64;
  const [c, g] = makeCanvas(S, S);
  g.clearRect(0, 0, S, S);
  // fil tressé : un peu plus épais, avec un nœud aux croisements
  g.strokeStyle = 'rgba(20,20,24,1)';
  g.lineWidth = 7;
  g.beginPath(); g.moveTo(0, 3.5); g.lineTo(S, 3.5); g.moveTo(3.5, 0); g.lineTo(3.5, S); g.stroke();
  g.fillStyle = 'rgba(10,10,12,1)'; g.beginPath(); g.arc(3.5, 3.5, 5.5, 0, 7); g.fill();
  g.beginPath(); g.arc(S + 3.5, 3.5, 5.5, 0, 7); g.arc(3.5, S + 3.5, 5.5, 0, 7); g.fill();
  return finish(c, renderer);
}

export function makeBlobTexture() {
  const S = 128;
  const [c, g] = makeCanvas(S, S);
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(0,0,0,0.75)');
  grd.addColorStop(0.45, 'rgba(0,0,0,0.35)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return finish(c, null, { repeat: false });
}

export function makeRingTexture() {
  const S = 128;
  const [c, g] = makeCanvas(S, S);
  g.strokeStyle = 'white';
  g.lineWidth = 7;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 8, 0, Math.PI * 2); g.stroke();
  return finish(c, null, { repeat: false });
}

export function makeAsphaltTexture(renderer) {
  const S = 256;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = '#26292e'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) {
    const v = (30 + Math.random() * 40) | 0;
    g.fillStyle = `rgba(${v},${v},${v + 4},${Math.random() * 0.5})`;
    g.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5);
  }
  return finish(c, renderer);
}

/** Panneau publicitaire LED (marques fictives). */
export function makeAdTexture(renderer, text, bg, fg, accent) {
  const [c, g] = makeCanvas(1024, 128);
  const grd = g.createLinearGradient(0, 0, 1024, 0);
  grd.addColorStop(0, bg[0]); grd.addColorStop(1, bg[1]);
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 128);
  g.fillStyle = accent; g.fillRect(0, 112, 1024, 16);
  g.font = 'bold 76px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 512, 60);
  return finish(c, renderer, { repeat: false });
}

// ---------------------------------------------------------------- sols « PBR » procéduraux
const _pbr = {};
/**
 * Matière de sol : relief bruité -> couleur + carte de normales (la lumière accroche les grains).
 * kind : 'dirt' (terre battue + cailloux), 'paving' (dalles), 'concrete' (béton), 'sand' (plage).
 */
export function makeGroundPBR(renderer, kind) {
  if (_pbr[kind]) return _pbr[kind];
  const S = 512;
  const H = new Float32Array(S * S);
  const rnd = (() => { let a = 1234 + kind.length * 77; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
  // bruit de valeur multi-octaves (périodique)
  const grid = (n) => { const g = new Float32Array(n * n); for (let i = 0; i < g.length; i++) g[i] = rnd(); return g; };
  const octs = [[8, 0.5], [16, 0.25], [32, 0.14], [64, 0.08], [128, 0.04]].map(([n, a]) => ({ n, a, g: grid(n) }));
  const sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0;
    for (const o of octs) {
      const fx = (x / S) * o.n, fy = (y / S) * o.n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
      const g = o.g, n = o.n, i = (a, b) => g[((b % n) * n) + (a % n)];
      v += o.a * ((i(x0, y0) * (1 - tx) + i(x0 + 1, y0) * tx) * (1 - ty) + (i(x0, y0 + 1) * (1 - tx) + i(x0 + 1, y0 + 1) * tx) * ty);
    }
    H[y * S + x] = v;
  }
  const col = document.createElement('canvas'); col.width = col.height = S;
  const cg = col.getContext('2d');
  const img = cg.createImageData(S, S);
  const P = {
    dirt: [[150, 108, 66], [122, 86, 52], [176, 140, 98]],
    sand: [[224, 204, 160], [205, 184, 140], [238, 224, 190]],
    concrete: [[150, 150, 146], [128, 128, 125], [168, 167, 162]],
    paving: [[176, 168, 156], [150, 142, 132], [190, 184, 172]],
  }[kind];
  // éléments : cailloux (terre), joints (dalles), fissures/taches (béton)
  const extra = new Float32Array(S * S);
  if (kind === 'dirt' || kind === 'sand') {
    for (let k = 0; k < (kind === 'dirt' ? 900 : 300); k++) {
      const cx = rnd() * S, cy = rnd() * S, r = 1 + rnd() * (kind === 'dirt' ? 4 : 1.5);
      for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
        const d = Math.hypot(x, y) / r; if (d > 1) continue;
        const px = (Math.floor(cx) + x + S) % S, py = (Math.floor(cy) + y + S) % S;
        extra[py * S + px] = Math.max(extra[py * S + px], Math.sqrt(1 - d * d) * 0.6);
      }
    }
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    let h = H[i] + extra[i];
    if (kind === 'paving') { const tx = x % 64, ty = y % 128; const j = Math.min(tx, 64 - tx, ty, 128 - ty); h += j < 3 ? -0.5 + j * 0.12 : 0; }
    if (kind === 'concrete') { const c = Math.abs(Math.sin(x * 0.011 + H[i] * 3) * Math.cos(y * 0.007)); if (c < 0.01) h -= 0.3; }
    H[i] = h;
    const t = Math.min(1, Math.max(0, (H[i] - 0.3) * 1.4));
    let c = P[0].map((v, k) => v + (P[2][k] - P[1][k]) * (t - 0.5));
    if (extra[i] > 0.05) c = c.map((v) => v * (0.85 + extra[i] * 0.5));
    img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
  }
  cg.putImageData(img, 0, 0);
  // normales (dérivées du relief)
  const nc = document.createElement('canvas'); nc.width = nc.height = S;
  const ng = nc.getContext('2d'), nimg = ng.createImageData(S, S);
  const k = kind === 'sand' ? 2 : 4;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const hl = H[y * S + ((x - 1 + S) % S)], hr = H[y * S + ((x + 1) % S)], hu = H[((y - 1 + S) % S) * S + x], hd = H[((y + 1) % S) * S + x];
    let nx = (hl - hr) * k, ny = (hu - hd) * k, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * S + x) * 4;
    nimg.data[i] = (nx * 0.5 + 0.5) * 255; nimg.data[i + 1] = (ny * 0.5 + 0.5) * 255; nimg.data[i + 2] = (nz * 0.5 + 0.5) * 255; nimg.data[i + 3] = 255;
  }
  ng.putImageData(nimg, 0, 0);
  const map = new THREE.CanvasTexture(col), normalMap = new THREE.CanvasTexture(nc);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, normalMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer?.capabilities.getMaxAnisotropy?.() || 8; }
  _pbr[kind] = { map, normalMap };
  return _pbr[kind];
}

/** Copie d'une matière de sol avec sa répétition ; la carte de normales est dans map.userData.normal. */
const PHOTO_GROUND = { dirt: 'park_dirt', sand: 'coast_sand_01', paving: 'square_concrete_pavers', concrete: 'concrete_floor_02' };
export function groundTex(renderer, kind, rx, ry = rx) {
  if (PHOTO_GROUND[kind]) return photoTex(PHOTO_GROUND[kind], rx * 1.4, ry * 1.4);
  const { map, normalMap } = makeGroundPBR(renderer, kind);
  const m = map.clone(), n = normalMap.clone();
  m.needsUpdate = n.needsUpdate = true;
  m.repeat.set(rx, ry); n.repeat.set(rx, ry);
  m.userData.normal = n;
  return m;
}

// ---------------------------------------------------------------- textures photo (Poly Haven, CC0)
const _photo = {};
const _loader = new THREE.TextureLoader();
function photoBase(name) {
  if (_photo[name]) return _photo[name];
  const map = _loader.load(PH[name]), normalMap = _loader.load(PH[name + '_n']);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, normalMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  return (_photo[name] = { map, normalMap });
}
/** Texture photo répétée ; la carte de relief est dans map.userData.normal. */
export function photoTex(name, rx, ry = rx) {
  const b = photoBase(name);
  const m = b.map.clone(), n = b.normalMap.clone();
  m.repeat.set(rx, ry); n.repeat.set(rx, ry);
  m.userData.normal = n;
  return m;
}
