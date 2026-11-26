// ============================================================================
//  Avatar procédural articulé (aucun modèle externe).
//
//  Squelette : bassin → hanches → genoux → chevilles ; colonne → buste → cou/tête ;
//  épaules → coudes → mains → raquette. Les pièces d'un même os qui partagent
//  un matériau sont fusionnées (peu d'appels de dessin).
//
//  Animations : position d'attente fléchie, course avant / pas chassés latéraux,
//  flexion des genoux pour les balles basses, préparation, frappes (coup droit,
//  revers, lob, coupé, smash/bandeja avec saut), bras libre d'équilibre, tête
//  qui suit la balle.
//
//  Repère local : l'avatar regarde vers +Z ; sa main droite est en -X.
//  Épaule droite (Euler XYZ, Z appliqué en premier) :
//   ry : balayage horizontal (négatif = raquette en arrière)
//   rz : inclinaison (positif = raquette vers le bas, -π/2 = raquette en l'air)
//   rx : balayage vertical (coups au-dessus de la tête)
// ============================================================================
import * as THREE from 'three';
import { makeFace, ZONES } from './Face.js';
import { buildSkinnedBody } from './BodyMesh.js';
import { solveArm, aimRacket, armPose } from './ArmIK.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { racketTexture } from './Racket.js';
import { hairCards, strandTexture, beardTexture, FLOWS } from './HairCards.js';

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const THIGH = 0.44, SHIN = 0.43;
export const SHOULDER_H = 1.46;   // hauteur d'épaule (taille 1.0)
export const ARM_REACH = 0.86;    // épaule -> centre du tamis

// ------------------------------------------------------------------ textures
function backPrintTexture(name, number, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const col = `#${color.toString(16).padStart(6, '0')}`;
  g.fillStyle = col;
  g.textAlign = 'center';
  g.font = 'bold 44px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
  g.fillText(name, 128, 58);
  g.font = 'bold 150px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
  g.fillText(String(number), 128, 200);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------ assemblage
class Parts {
  constructor() { this.map = new Map(); this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); }
  add(bone, geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
    this._e.set(r[0], r[1], r[2]);
    this._q.setFromEuler(this._e);
    this._m.compose(new THREE.Vector3(...p), this._q, new THREE.Vector3(...s));
    geo.applyMatrix4(this._m);
    if (!this.map.has(bone)) this.map.set(bone, new Map());
    const byMat = this.map.get(bone);
    if (!byMat.has(mat)) byMat.set(mat, []);
    byMat.get(mat).push(geo.index ? geo : geo);
  }
  finalize() {
    for (const [bone, byMat] of this.map) {
      for (const [mat, geos] of byMat) {
        const mixed = geos.some((g) => g.index) && !geos.every((g) => g.index);
        const common = Object.keys(geos[0].attributes).filter((k) => geos.every((g) => g.attributes[k]));
        const list = geos.map((g) => { if (mixed && g.index) g = g.toNonIndexed(); for (const k of Object.keys(g.attributes)) if (!common.includes(k)) g.deleteAttribute(k); return g; });
        const merged = list.length === 1 ? list[0] : mergeGeometries(list);
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        bone.add(mesh);
      }
    }
  }
}

const group = (parent, x = 0, y = 0, z = 0) => {
  const g = new THREE.Bone();          // os du squelette (le corps est « skinné » dessus)
  g.position.set(x, y, z);
  parent.add(g);
  return g;
};

function canvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const hexCss = (n) => `#${new THREE.Color(n).getHexString()}`;

/** Peau tatouée (bras) : motifs à l'encre noire sur la couleur de peau. */
function tattooTexture(skin) {
  return canvas(256, 256, (g, W, H) => {
    g.fillStyle = hexCss(skin); g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(20,20,30,0.95)'; g.fillStyle = 'rgba(20,20,30,0.95)'; g.lineWidth = 6;
    g.save(); g.scale(1, 1);
    // rose, lettrage, vagues, étoiles : sur la face externe du bras
    g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * 1.05; g.arc(70 + Math.cos(a) * 10, 80 + Math.sin(a) * 10, 9, a, a + 2.6); } g.stroke();
    g.beginPath(); g.moveTo(70, 100); g.quadraticCurveTo(60, 140, 75, 170); g.stroke();
    g.font = 'italic 700 26px serif'; g.fillText('Familia', 120, 60);
    for (let x = 110; x < 230; x += 24) { g.beginPath(); g.arc(x, 130, 12, Math.PI, 0); g.stroke(); }
    for (const [x, y] of [[150, 190], [190, 210], [120, 220]]) { g.beginPath(); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 2.513; g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); } g.closePath(); g.fill(); }
    g.lineWidth = 10; g.beginPath(); g.moveTo(10, 240); g.lineTo(120, 240); g.stroke();
    g.beginPath(); g.moveTo(0, 30); g.bezierCurveTo(60, 0, 120, 60, 250, 20); g.stroke();
    g.font = 'italic 700 40px serif'; g.fillText('♥ 13', 20, 200);
    g.restore();
  });
}

/** Écusson de club (Bastia : bleu, tête de Maure ; OM : bleu ciel). */
const CRESTS = { fcb: ['#a50044', '#f2c94c', 'FCB'], fra: ['#1d2f6f', '#ffffff', 'FFF'], psg: ['#0b1f4d', '#d7262e', 'PSG'], ol: ['#1d3f8f', '#e53935', 'OL'], ars: ['#db0007', '#f2c94c', 'AFC'], asse: ['#0a7a3e', '#ffffff', 'ASSE'], nufc: ['#111111', '#ffffff', 'NUFC'] };
function crestTexture(kind) {
  return canvas(64, 76, (g, W, H) => {
    g.beginPath(); g.moveTo(4, 4); g.lineTo(W - 4, 4); g.lineTo(W - 4, H * 0.55); g.quadraticCurveTo(W / 2, H, W / 2, H - 2); g.quadraticCurveTo(W / 2, H, 4, H * 0.55); g.closePath();
    if (kind === 'bastia') {
      g.fillStyle = '#1b2f8f'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.stroke();
      g.fillStyle = '#ffffff'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText('SC BASTIA', W / 2, 17);
      g.fillStyle = '#111'; g.beginPath(); g.arc(W / 2, 40, 10, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.fillRect(W / 2 - 10, 34, 20, 3);
    } else if (CRESTS[kind]) {
      const [bg, fg, txt] = CRESTS[kind];
      g.fillStyle = bg; g.fill(); g.lineWidth = 3; g.strokeStyle = fg; g.stroke();
      g.fillStyle = fg; g.textAlign = 'center'; g.font = `bold ${txt.length > 3 ? 13 : 18}px sans-serif`; g.fillText(txt, W / 2, 38);
    } else {
      g.fillStyle = 'rgba(0,0,0,0)'; g.fill();
      g.strokeStyle = '#1f4fbf'; g.lineWidth = 5; g.font = 'bold 40px serif'; g.fillStyle = '#1f4fbf'; g.textAlign = 'center';
      g.fillText('M', W / 2 + 4, 52); g.font = 'bold 30px serif'; g.fillText('O', W / 2 - 10, 46);
    }
  });
}

function sponsorTexture(kind) {
  return canvas(128, 44, (g, W, H) => {
    g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = kind === 'om' ? '#1f4fbf' : 'rgba(255,255,255,0.9)';
    g.fillText(kind === 'om' ? 'CMA' : kind === 'bastia' ? '|||' : '', W / 2, H / 2);
  });
}

/** Écusson de casquette (rouge et blanc, un « 7 »). */
function capPatchTexture() {
  return canvas(96, 64, (g, W, H) => {
    g.fillStyle = '#f2efe8'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#c62828'; g.fillRect(6, 6, W - 12, H - 12);
    g.fillStyle = '#ffffff'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('7', W / 2, H / 2 + 2);
    g.fillStyle = '#2e7d32'; g.fillRect(6, H - 14, W - 12, 6);
  });
}

// ---------------------------------------------------------------- micro-détails (partagés)
let _hairTex = null, _hairNrm = null, _skinNrm = null;
/** Mèches de cheveux : stries fines le long des méridiens (v). */
function hairTex() {
  if (_hairTex) return _hairTex;
  _hairTex = canvas(128, 256, (g, W, H) => {
    g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 900; k++) {
      const x = Math.random() * W, l = 30 + Math.random() * 120, y = Math.random() * H, v = 150 + Math.random() * 105;
      g.strokeStyle = `rgba(${v},${v},${v},0.55)`; g.lineWidth = 0.6 + Math.random() * 0.8;
      g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 3, y + l * 0.3, x - 3, y + l * 0.6, x + (Math.random() - 0.5) * 6, y + l); g.stroke();
    }
  });
  _hairTex.wrapS = _hairTex.wrapT = THREE.RepeatWrapping;
  _hairTex.repeat.set(6, 2);
  return _hairTex;
}
function noiseNormal(w, h, draw, strength) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const src = g.getImageData(0, 0, w, h).data, out = g.createImageData(w, h);
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let nx = (H(x - 1, y) - H(x + 1, y)) * strength, ny = (H(x, y - 1) - H(x, y + 1)) * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz), i = (y * w + x) * 4;
    out.data[i] = (nx / l * 0.5 + 0.5) * 255; out.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; out.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; out.data[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function hairNormal() {
  if (_hairNrm) return _hairNrm;
  _hairNrm = noiseNormal(128, 256, (g, W, H) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 700; k++) { const x = Math.random() * W, v = Math.random() * 255; g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 1 + Math.random(); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 8, H); g.stroke(); }
  }, 3);
  _hairNrm.repeat.set(6, 2);
  return _hairNrm;
}
/** Maillot technique : panneaux latéraux et coutures teintés par la couleur secondaire. */
const _jersey = new Map();
function jerseyTex(accent, style = 'tech', base = null) {
  const key = `${accent}|${style}|${base}`;
  if (_jersey.has(key)) return _jersey.get(key);
  const ac = new THREE.Color(accent);
  const A = `#${ac.getHexString()}`;
  const t = canvas(256, 128, (g, W, H) => {
    g.fillStyle = base != null ? `#${new THREE.Color(base).getHexString()}` : '#ffffff'; g.fillRect(0, 0, W, H);
    // motifs de maillot (u = tour du corps, v = hauteur) ; le blanc prend la couleur principale
    g.fillStyle = A;
    if (style === 'stripes') for (let x = 0; x < W; x += 32) g.fillRect(x, 0, 14, H);
    else if (style === 'hoops') for (let y = 8; y < H; y += 30) g.fillRect(0, y, W, 13);
    else if (style === 'half') { g.fillRect(W * 0.25, 0, W * 0.5, H); }
    else if (style === 'chevron') { g.beginPath(); for (const off of [0, W / 2]) { g.moveTo(off, 30); g.lineTo(off + W / 4, 60); g.lineTo(off + W / 2, 30); g.lineTo(off + W / 2, 52); g.lineTo(off + W / 4, 82); g.lineTo(off, 52); } g.fill(); }
    else if (style === 'fade') { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, A); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    else if (style === 'pixel') { for (let y = 64; y < H; y += 8) for (let x = 0; x < W; x += 8) if (((x * 7 + y * 13) % 29) < (y - 56) / 5) g.fillRect(x, y, 8, 8); }
    else if (style === 'diagonal') { g.save(); g.translate(W / 4, H / 2); g.rotate(-0.6); g.fillRect(-W, -14, W * 2, 28); g.restore(); g.save(); g.translate(W * 0.75, H / 2); g.rotate(-0.6); g.fillRect(-W, -14, W * 2, 28); g.restore(); }
    else if (style === 'shoulders') { g.fillRect(0, 0, W, 26); }
    else if (style === 'retro') { g.fillRect(0, 0, W, 10); for (let x = 6; x < W; x += 64) { g.fillRect(x, 0, 6, H); g.fillRect(x + 12, 0, 3, H); } }
    // u = tour du corps : 0 et 0,5 = flancs ; panneaux dégradés + liserés
    for (const c of [0, 0.5, 1]) {
      const x = c * W;
      const gr = g.createLinearGradient(x - 26, 0, x + 26, 0);
      const col = `rgba(${Math.round(ac.r * 255)},${Math.round(ac.g * 255)},${Math.round(ac.b * 255)},`;
      gr.addColorStop(0, col + '0)'); gr.addColorStop(0.35, col + '0.85)'); gr.addColorStop(0.65, col + '0.85)'); gr.addColorStop(1, col + '0)');
      g.fillStyle = gr; g.fillRect(x - 26, 0, 52, H);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x - 18, 0, 1.5, H); g.fillRect(x + 17, 0, 1.5, H);
    }
  });
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  _jersey.set(key, t);
  return t;
}

/** Maille de tissu technique (petits losanges). */
let _knit = null;
function knitNormal() {
  if (_knit) return _knit;
  _knit = noiseNormal(64, 64, (g, W, H) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) { g.fillStyle = (x + y) % 8 ? '#a0a0a0' : '#606060'; g.beginPath(); g.ellipse(x + 2, y + 2, 1.6, 1.2, 0, 0, 7); g.fill(); }
  }, 2.5);
  _knit.repeat.set(10, 10);
  return _knit;
}

/** Grain de peau (pores) très léger. */
function skinNormal() {
  if (_skinNrm) return _skinNrm;
  _skinNrm = noiseNormal(256, 256, (g, W, H) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 6000; k++) { const v = 90 + Math.random() * 80; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.arc(Math.random() * W, Math.random() * H, 0.6 + Math.random() * 1.2, 0, 7); g.fill(); }
  }, 2);
  _skinNrm.repeat.set(5, 5);
  return _skinNrm;
}

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Avatar {
  /**
   * @param {object} app  apparence résolue (voir resolveLook dans Appearance.js) :
   *   shirt, accent, shorts, shoes, shoeAccent, racket, racketFace, racketPattern, skin, hair,
   *   hairStyle, beard, headwear, build, belly, height, female, skirt, name, number, hand,
   *   metal: { shirt, accent, shorts } (couleurs métallisées : or, argent)
   */
  constructor(app) {
    const a = this.app = { height: 1, build: 1, belly: 0, ...app };
    const M = (c, r = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
    const fabric = (c, metal = false) => (metal
      ? new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.32, metalness: 0.75, clearcoat: 0.4 })
      : new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.82, sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff), normalMap: knitNormal(), normalScale: new THREE.Vector2(0.35, 0.35) }));
    const mt = a.metal || {};
    const mat = {
      shirt: (() => { const m = fabric(a.shirt, mt.shirt); if (!mt.shirt) { const club = a.jersey && a.jersey !== 'tee' && a.kitStyle && a.kitStyle !== 'tech'; m.map = jerseyTex(a.accent, a.kitStyle || 'tech', club ? a.shirt : null); if (club) m.color.set(0xffffff); } return m; })(),
      accent: fabric(a.accent, mt.accent),
      shorts: fabric(a.shorts, mt.shorts),
      // peau : léger voile chaud (imite la diffusion sous la peau) ; cheveux : reflets
      skin: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(a.skin).multiplyScalar(0.95), roughness: 0.58, normalMap: skinNormal(), normalScale: new THREE.Vector2(0.18, 0.18), emissive: new THREE.Color(a.skin).multiplyScalar(0.05).lerp(new THREE.Color(0x3a0c06), 0.5), emissiveIntensity: 0.5, sheen: 0.12, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xc0503a), specularIntensity: 0.6 }),
      hairCard: new THREE.MeshStandardMaterial({ color: new THREE.Color(a.hair).multiplyScalar(0.85), alphaMap: strandTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.0, envMapIntensity: 0.15 }),
      beardCard: new THREE.MeshStandardMaterial({ color: new THREE.Color(a.hair).lerp(new THREE.Color(a.skin), 0.22).multiplyScalar(1.15), alphaMap: beardTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, envMapIntensity: 0.15 }),
      hair: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(a.hair).multiplyScalar(0.72), map: hairTex(), normalMap: hairNormal(), normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.5, sheen: 0.8, sheenRoughness: 0.3, sheenColor: new THREE.Color(a.hair).lerp(new THREE.Color(0xffffff), 0.4) }),
      faceSkin: new THREE.MeshPhysicalMaterial({ color: 0xf2e4dc, vertexColors: true, roughness: 0.52, emissive: new THREE.Color(0x2a0905), emissiveIntensity: 0.35, normalMap: skinNormal(), normalScale: new THREE.Vector2(0.3, 0.3), sheen: 0.12, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xc0503a), specularIntensity: 0.6 }),
      white: M(0xd9d0c6, 0.3),
      iris: M(new THREE.Color(a.eye ?? 0x4a3020).multiplyScalar(0.8), 0.25),
      fade: new THREE.MeshStandardMaterial({ color: new THREE.Color(a.hair).lerp(new THREE.Color(a.skin), a.hairStyle === 'shaved' ? 0.72 : 0.45), roughness: 0.9 }),
      capMat: new THREE.MeshPhysicalMaterial({ color: a.capColor ?? a.shirt, roughness: 0.85, sheen: 0.4, sheenColor: new THREE.Color(0xffffff) }),
      tattoo: a.tattoo ? new THREE.MeshPhysicalMaterial({ map: tattooTexture(a.skin), roughness: 0.62, sheen: 0.22, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xd9785a) }) : null,
      lip: M(new THREE.Color(a.skin).multiplyScalar(0.72).lerp(new THREE.Color(0xa0453a), 0.25), 0.45),
      dark: M(0x0d0d0f, 0.4),
      sole: M(0xf2f2f2, 0.7),
      shoe: M(a.shoes, 0.5),
      shoeAccent: M(a.shoeAccent, 0.5),
      sock: M(0xf5f5f5, 0.9),
      grip: M(0xf0f0f0, 0.9),
      frame: new THREE.MeshPhysicalMaterial({ color: a.racket, roughness: 0.32, metalness: a.racketMetal ? 0.8 : 0.15, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
      face: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.25, map: racketTexture(a.racket, a.racketPattern, a.racketFace ?? a.racket, a.racketBase ?? null, a.racketAccent ?? null, a.racketLabel || '') }),
    };
    this.mat = mat;
    const P = new Parts();
    const B = a.build;
    const BL = a.belly;            // 0 = mince, 1 = surpoids
    const LB = 1 + BL * 0.16;      // membres plus épais

    this.root = new THREE.Group();
    this.root.scale.setScalar(a.height);
    this.body = group(this.root);
    if (a.hand < 0) this.body.scale.x = -1;   // gaucher : raquette dans la main gauche
    this.pelvis = group(this.body, 0, THIGH + SHIN + 0.085, 0);

    // ---------------- bassin / short
    if (a.skirt) {
      P.add(this.pelvis, new THREE.CylinderGeometry(0.155, 0.24, 0.27, 18, 1, true), mat.shorts, [0, -0.06, 0], [0, 0, 0], [1, 1, 0.82]);
      P.add(this.pelvis, new THREE.CylinderGeometry(0.15, 0.155, 0.06, 18), mat.accent, [0, 0.06, 0], [0, 0, 0], [1, 1, 0.8]);
    }

    // ---------------- jambes
    this.legs = [];
    for (const sx of [1, -1]) {
      const hip = group(this.pelvis, 0.095 * sx * B, -0.02, 0);
      const knee = group(hip, 0, -THIGH, 0);
      const ankle = group(knee, 0, -SHIN, 0);
      this.legs.push({ hip, knee, ankle, sx });
    }

    // ---------------- buste
    this.spine = group(this.pelvis, 0, 0.08, 0);
    this.chest = group(this.spine, 0, 0.2, 0);
    // détails de maillot (Bastia, OM, t-shirt) et médailles
    const chestFront = 0.118 + BL * 0.02 + (a.female ? 0.03 : 0.008) + 0.012;
    if (a.jersey && a.jersey !== 'tee') {
      const crest = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.07), new THREE.MeshStandardMaterial({ map: crestTexture(a.jersey), transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
      crest.position.set(0.07 * B, 0.13, chestFront - 0.004); crest.rotation.y = 0.28;
      this.chest.add(crest);
      const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.035), new THREE.MeshStandardMaterial({ map: sponsorTexture(a.jersey), transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
      logo.position.set(0, 0.04, chestFront + 0.002);
      this.chest.add(logo);
    }
    if (a.jersey === 'bastia') {
      // trois bandes blanches sur chaque épaule
      for (const sx of [1, -1]) for (let k = -1; k <= 1; k++) P.add(this.chest, new THREE.BoxGeometry(0.012, 0.006, 0.17), mat.white, [sx * (0.17 + k * 0.022) * B, 0.235 - Math.abs(k) * 0.006, 0], [0, 0, sx * -0.55]);
    }
    if (a.sash) {
      // écharpe tricolore de maire : de l'épaule droite à la hanche gauche, tout autour du buste
      const tex = canvas(8, 96, (g, W, H) => { ['#0a3d91', '#ffffff', '#d81e2c'].forEach((c, i) => { g.fillStyle = c; g.fillRect(0, (i * H) / 3, W, H / 3); }); });
      const sashMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, side: THREE.DoubleSide });
      const R0 = 0.168 * B * (1 + BL * 0.16);
      const sash = new THREE.Mesh(new THREE.CylinderGeometry(R0, R0, 0.075, 40, 1, true), sashMat);
      sash.scale.set(1.0, 1, 0.76 + BL * 0.14);
      sash.position.set(0, -0.04, 0.012);
      sash.rotation.z = -0.68;
      sash.castShadow = true;
      this.chest.add(sash);
      // nœud et franges dorées sur la hanche
      P.add(this.spine, new THREE.SphereGeometry(0.03, 12, 10), sashMat, [-0.14 * B, -0.02, 0.1 + BL * 0.04]);
      for (let k = -1; k <= 1; k++) P.add(this.spine, new THREE.CylinderGeometry(0.006, 0.01, 0.09, 6), M(0xd4a72c, 0.4, { metalness: 0.6 }), [-0.14 * B + k * 0.012, -0.08, 0.1 + BL * 0.04]);
    }
    if (a.medals) {
      const cols = [0xffc928, 0x1e5fd0, 0xd8263a, 0x2e9e4c, 0x7b3fb5];
      cols.forEach((c, i) => {
        const m = M(c, 0.6), off = (i - 2) * 0.012;
        for (const sx of [1, -1]) P.add(this.chest, new THREE.BoxGeometry(0.012, 0.17, 0.003), m, [sx * (0.05 + off * 0.5), 0.17, chestFront - 0.004 + i * 0.0015], [0.12, sx * 0.12, sx * -0.42]);
        P.add(this.chest, new THREE.CylinderGeometry(0.02, 0.02, 0.005, 14), M(i % 2 ? 0xc0c4c8 : 0xd4a72c, 0.3, { metalness: 0.8 }), [off * 1.5, 0.075 - i * 0.008, chestFront + 0.006 + i * 0.002], [Math.PI / 2, 0, 0]);
      });
    }
    // nom et numéro au dos (visibles depuis la caméra TV)
    const print = new THREE.Mesh(
      new THREE.PlaneGeometry(0.27, 0.27),
      new THREE.MeshStandardMaterial({ map: backPrintTexture(a.name || '', a.number ?? 7, a.accent), transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    print.position.set(0, 0.06, -0.122 * B);
    print.rotation.y = Math.PI;
    if (a.hand < 0) print.scale.x = -1;
    this.chest.add(print);
    // cou + tête
    this.head = group(this.chest, 0, 0.318, 0);
    this.head.scale.setScalar(1.07);
    this.buildHead(P, mat, a);

    // ---------------- bras gauche (bras libre)
    this.lShoulder = group(this.chest, 0.205 * B, 0.2, 0);
    this.lElbow = group(this.lShoulder, 0, -0.29, 0);
    if (a.watch) {
      P.add(this.lElbow, new THREE.CylinderGeometry(0.033, 0.033, 0.026, 16), mat.dark, [0, -0.235, 0], [0, 0, 0], [1, 1, 0.8]);
      P.add(this.lElbow, new THREE.BoxGeometry(0.03, 0.03, 0.01), mat.dark, [0, -0.235, 0.026]);
    }

    // ---------------- bras droit + raquette (le long de -X)
    this.rShoulder = group(this.chest, -0.205 * B, 0.2, 0);
    this.rElbow = group(this.rShoulder, -0.29, 0, 0);
    P.add(this.rElbow, new THREE.CylinderGeometry(0.036, 0.036, 0.055, 16), mat.accent, [-0.215, 0, 0], [0, 0, Math.PI / 2], [1, 1, 0.85]);   // poignet éponge
    this.racket = group(this.rElbow, -0.27, 0, 0);
    // raquette de padel : tamis en goutte d'eau, cadre biseauté, cœur ouvert, grip enroulé, dragonne
    const outline = (k) => {
      const sh = new THREE.Shape(), cx = -0.33, W = 0.132 * k, Ltop = 0.165 * k, Lbot = 0.13 * k;
      sh.moveTo(cx - Ltop, 0);
      sh.bezierCurveTo(cx - Ltop, W * 1.05, cx + Lbot * 0.2, W * 1.02, cx + Lbot, W * 0.42);
      sh.quadraticCurveTo(cx + Lbot * 1.08, 0, cx + Lbot, -W * 0.42);
      sh.bezierCurveTo(cx + Lbot * 0.2, -W * 1.02, cx - Ltop, -W * 1.05, cx - Ltop, 0);
      return sh;
    };
    const faceGeo = new THREE.ExtrudeGeometry(outline(0.93), { depth: 0.03, bevelEnabled: false, curveSegments: 28 }).translate(0, 0, -0.015);
    { const uv = faceGeo.attributes.uv, pp = faceGeo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (pp.getX(i) + 0.48) / 0.3, (pp.getY(i) + 0.14) / 0.28); }
    P.add(this.racket, faceGeo, mat.face);
    const ring = outline(1.0); ring.holes.push(outline(0.93));
    P.add(this.racket, new THREE.ExtrudeGeometry(ring, { depth: 0.032, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2, curveSegments: 28 }).translate(0, 0, -0.016), mat.frame);
    // gorge : deux bras et un pont, cœur ouvert
    for (const sy of [1, -1]) P.add(this.racket, new THREE.CapsuleGeometry(0.012, 0.085, 4, 8), mat.frame, [-0.155, sy * 0.032, 0], [0, 0, Math.PI / 2 + sy * 0.45], [1, 1, 1.35]);
    P.add(this.racket, new THREE.CapsuleGeometry(0.009, 0.05, 4, 8), mat.frame, [-0.205, 0, 0], [0, 0, 0], [1, 1, 1.3]);
    // manche : grip enroulé (bourrelets), capuchon, dragonne
    for (let k = 0; k < 7; k++) P.add(this.racket, new THREE.TorusGeometry(0.0175, 0.0028, 6, 16), mat.grip, [-0.005 - k * 0.019, 0, 0], [0, Math.PI / 2, 0.25]);
    P.add(this.racket, new THREE.CylinderGeometry(0.017, 0.016, 0.135, 12), mat.grip, [-0.06, 0, 0], [0, 0, Math.PI / 2]);
    P.add(this.racket, new THREE.CylinderGeometry(0.021, 0.019, 0.016, 14), mat.dark, [0.012, 0, 0], [0, 0, Math.PI / 2]);
    P.add(this.racket, new THREE.TorusGeometry(0.03, 0.004, 6, 18, Math.PI * 1.4), mat.dark, [0.04, 0, 0], [0, 0, Math.PI * 0.3]);

    P.finalize();
    // corps continu « skinné » sur les os
    // corps : mannequin réaliste s'il est chargé, sinon corps procédural
    this.skinned = buildSkinnedBody(this, mat, a);

    // style personnel (stable pour un même joueur) : posture, démarche, gestes
    {
      let h = 2166136261; for (const ch of String(a.name || '') + (a.skin || 0)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
      const R = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909); return ((h >>> 0) % 10000) / 10000; };
      this.sty = {
        crouch: 0.75 + R() * 0.55,      // attente plus ou moins fléchie
        lean: -0.04 + R() * 0.14,       // buste penché en avant ou droit
        stride: 0.8 + R() * 0.45,       // amplitude de la foulée
        bounce: 0.5 + R() * 1.0,        // rebond sur les appuis
        wide: R() * 0.06,               // appuis écartés
        racketH: -0.08 + R() * 0.2,     // hauteur de la raquette en attente
        racketOut: -0.06 + R() * 0.14,  // raquette plus ou moins devant
        back: 0.75 + R() * 0.6,         // amplitude de la préparation
        finish: 0.7 + R() * 0.6,        // hauteur / longueur de l'accompagnement
        twist: 0.75 + R() * 0.5,        // rotation des épaules
        tempo: 0.85 + R() * 0.3,        // rythme de la démarche
        sway: R() * 0.06,               // balancement latéral
      };
      Object.assign(this.sty, a.stance || {});
    }
    this.phase = 0;
    this.yaw = 0;
    this.arm = { rx: 0, ry: 1.0, rz: 0.75, elbow: 0.9 };
    this.crouch = 1;
    this.lookYaw = 0;
  }

  buildHead(P, mat, a) {
    const h = this.head;
    const F = makeFace(a);
    const Z = ZONES;
    // visage (couleurs peintes : lèvres, joues, ombre de barbe, cuir chevelu rasé)
    P.add(h, F.head, mat.faceSkin);
    const e = F.eye;
    for (const sx of [1, -1]) {
      // oreille : pavillon aplati, rebord et lobe
      P.add(h, new THREE.SphereGeometry(0.023, 16, 12), mat.skin, [sx * 0.08, 0.104, -0.008], [0, sx * 0.4, 0], [0.32, 1, 0.68]);
      P.add(h, new THREE.TorusGeometry(0.016, 0.004, 6, 16, Math.PI * 1.3), mat.skin, [sx * 0.083, 0.108, -0.006], [0, sx * (Math.PI / 2 - 0.4), Math.PI * 0.35], [1, 1.25, 1]);
      P.add(h, new THREE.SphereGeometry(0.0075, 8, 6), mat.skin, [sx * 0.081, 0.083, -0.002]);
      // œil dans l'orbite : globe, iris, pupille, reflet, paupière supérieure
      const ex = sx * e.x, ey = e.y + 0.002, ez = e.z - 0.006;
      P.add(h, new THREE.SphereGeometry(0.0118, 18, 14), mat.white, [ex, ey, ez], [0, 0, 0], [1.25, 0.72, 0.8]);
      P.add(h, new THREE.SphereGeometry(0.0062, 16, 12), mat.iris, [ex, ey - 0.0006, ez + 0.0082], [0, 0, 0], [1, 1, 0.5]);
      P.add(h, new THREE.SphereGeometry(0.003, 10, 8), mat.dark, [ex, ey - 0.0006, ez + 0.011], [0, 0, 0], [1, 1, 0.45]);
      P.add(h, new THREE.SphereGeometry(0.0012, 6, 4), mat.white, [ex - sx * 0.0018, ey + 0.0012, ez + 0.0122]);
      P.add(h, new THREE.SphereGeometry(0.0128, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), mat.skin, [ex, ey + 0.0008, ez + 0.0006], [0.75, 0, 0], [1.27, 0.85, 0.9]);
      P.add(h, new THREE.SphereGeometry(0.0124, 18, 8, 0, Math.PI * 2, Math.PI * 0.66, Math.PI * 0.34), mat.skin, [ex, ey - 0.0004, ez + 0.0004], [-0.3, 0, 0], [1.26, 0.8, 0.9]);
    }
    // cheveux : coques ajustées au crâne, plus du volume selon la coiffure
    const hw0 = a.headwear;
    const bandZone = (d) => d.y > 0.33 + 0.12 * d.z && d.y < 0.65 + 0.12 * d.z;
    const covered = hw0 === 'cap' ? Z.cap : hw0 === 'capback' ? (d) => Z.cap({ x: d.x, y: d.y, z: -d.z }) : hw0 === 'bandana' ? bandZone : null;
    const shellRaw = F.shell, addRaw = P.add.bind(P);
    if (covered) {
      const isBand = hw0 === 'bandana';
      F.shell = (pred, off, o = {}) => shellRaw((d) => pred(d) && !covered(d), isBand ? off : Math.min(off, 0.006), isBand ? o : { ...o, topBoost: 0, lift: 0 });
      // volumes ajoutés (mèches, chignon, boucles…) : supprimés s'ils dépassent sous la casquette
      P.add = (bone, geo, m, pp = [0, 0, 0], ...rest) => {
        if (hw0 !== 'bandana' && m === mat.hair && bone === h && geo.type !== 'BufferGeometry' && pp[1] > 0.12 && !(pp[1] < 0.16 && Math.abs(pp[0]) > 0.07)) return;
        return addRaw(bone, geo, m, pp, ...rest);
      };
    }
    const scalp = (off = 0.004, top = 0.012, lift = 0.006) => P.add(h, F.shell(Z.scalp, off, { topBoost: top, lift }), mat.hair);
    const curls = (n, r, rad, y0, spread) => {
      for (let i = 0; i < n; i++) {
        const t = i / n, a1 = t * Math.PI * 2 * 3.3, el = 0.15 + t * 1.25;
        P.add(h, new THREE.SphereGeometry(r, 8, 6), mat.hair,
          [Math.cos(a1) * Math.sin(el) * rad * 0.85, y0 + Math.cos(el) * rad * spread, Math.sin(a1) * Math.sin(el) * rad - 0.01]);
      }
    };
    switch (a.hairStyle) {
      case 'bald': case 'shaved': break;                       // peint sur le crâne
      case 'buzz': scalp(0.0022, 0.002, 0); break;
      case 'fade': P.add(h, F.shell(Z.top, 0.004, { topBoost: 0.012, lift: 0.006 }), mat.hair); break;
      case 'receding': P.add(h, F.shell((d) => Z.scalp(d) && !Z.top(d), 0.003), mat.hair); break;
      case 'ponytail':
        scalp(0.004, 0.006, 0);
        P.add(h, new THREE.CapsuleGeometry(0.026, 0.16, 4, 10), mat.hair, [0, 0.04, -0.12], [0.35, 0, 0]);
        P.add(h, new THREE.SphereGeometry(0.03, 12, 10), mat.hair, [0, 0.13, -0.095]);
        break;
      case 'bun':
        scalp(0.004, 0.006, 0);
        // chignon : haut du crâne, ou plus bas sur la nuque sous une casquette (man bun)
        if (hw0 === 'cap' || hw0 === 'capback') { P.add(h, new THREE.SphereGeometry(0.034, 14, 12), mat.hair, [0, 0.115, -0.112], [0, 0, 0], [1, 0.9, 0.85]); P.add(h, new THREE.TorusGeometry(0.02, 0.006, 6, 14), mat.dark, [0, 0.112, -0.095], [0.3, 0, 0]); }
        else P.add(h, new THREE.SphereGeometry(0.044, 14, 12), mat.hair, [0, 0.2, -0.07]);
        break;
      case 'long':
        scalp(0.005, 0.008, 0.004);
        P.add(h, new THREE.CapsuleGeometry(0.07, 0.1, 6, 16), mat.hair, [0, 0.04, -0.05], [0.1, 0, 0], [1.2, 1, 0.65]);
        break;
      case 'curtain': {
        // une seule masse de cheveux : le dessus retombe en deux mèches de chaque côté de la raie
        const strands = (d) => 0.003 * Math.sin(Math.atan2(d.x, d.y) * 26) + 0.006 * Math.max(0, d.z) * Math.max(0, 0.6 - d.y);
        P.add(h, F.shell(Z.curtain, 0.007, { topBoost: 0.011, offFn: strands }), mat.hair);
        break;
      }
      case 'surfer': {
        // mi-long ondulé : volume, ondulations, mèches qui tombent sur les oreilles et le front
        const wave = (d) => 0.005 * Math.sin(Math.atan2(d.x, d.z) * 11 + d.y * 9) + 0.004 * Math.sin(d.y * 23 + d.x * 7) + 0.01 * Math.max(0, -d.y + 0.3) * (1 - Math.max(0, d.z));
        P.add(h, F.shell(Z.surf, 0.009, { topBoost: 0.012, offFn: wave }), mat.hair);
        if (false) for (const sx of [1, -1]) {   // mèches remplacées par les hair cards
          for (let k = 0; k < 4; k++) {
            const q = F.at(sx * (0.9 - k * 0.06), 0.05 - k * 0.12, 0.15 - k * 0.12);
            P.add(h, new THREE.CapsuleGeometry(0.012, 0.05, 3, 8), mat.hair, [q.x + sx * 0.012, q.y - 0.02, q.z], [0.2 * k, 0, sx * (0.25 + k * 0.08)]);
          }
          const f = F.at(sx * 0.32, 0.62, 0.72);
          P.add(h, new THREE.CapsuleGeometry(0.011, 0.045, 3, 8), mat.hair, [f.x, f.y - 0.01, f.z + 0.012], [0.9, 0, sx * 0.5]);
        }
        break;
      }
      case 'curly': {
        // boucles serrées : une multitude de petites boucles plantées sur tout le cuir chevelu
        scalp(0.007, 0.012, 0);
        const curlM = new THREE.MeshStandardMaterial({ color: new THREE.Color(a.hair).multiplyScalar(0.8), roughness: 1, metalness: 0, normalMap: mat.hair.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), map: mat.hair.map });
        const N = a.lod === 'low' ? 1400 : 3600, golden = Math.PI * (3 - Math.sqrt(5));
        const cen = new THREE.Vector3(0, 0.112, 0);
        for (let i = 0; i < N; i++) {
          const y = 1 - (i + 0.5) * (2 / N), r = Math.sqrt(1 - y * y), th = i * golden;
          const d = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
          if (!Z.scalp(d) || (covered && covered(d))) continue;
          const q = F.at(d.x, d.y, d.z), n = q.clone().sub(cen).normalize();
          const k = ((i * 7919) % 100) / 100, rr = 0.0058 + k * 0.004;
          q.addScaledVector(n, 0.005 + Math.max(0, d.y) * 0.005 + k * 0.003);
          P.add(h, new THREE.TorusGeometry(rr, rr * 0.45, 4, 7), curlM, [q.x, q.y, q.z], [k * 6, k * 9, k * 4]);
        }
        break;
      }
      case 'longcurly': scalp(0.006, 0.01, 0); curls(34, 0.032, 0.115, 0.11, 1.2); P.add(h, new THREE.CapsuleGeometry(0.08, 0.12, 4, 12), mat.hair, [0, 0.02, -0.05], [0, 0, 0], [1.3, 1, 0.72]); break;
      case 'afro': P.add(h, new THREE.SphereGeometry(0.14, 22, 16), mat.hair, [0, 0.165, -0.025], [0, 0, 0], [0.95, 0.85, 0.95]); break;
      case 'mohawk': P.add(h, F.shell((d) => Z.top(d) && Math.abs(d.x) < 0.22, 0.004, { topBoost: 0.035 }), mat.hair); break;
      case 'dreads':
        scalp(0.005, 0.006, 0);
        for (let i = 0; i < 12; i++) {
          const a1 = Math.PI * (0.15 + (i / 11) * 0.7) + Math.PI / 2;
          P.add(h, new THREE.CapsuleGeometry(0.014, 0.14, 2, 6), mat.hair, [Math.cos(a1) * 0.088, 0.04, Math.sin(a1) * 0.075 - 0.03], [0.15, 0, 0]);
        }
        break;
      case 'quiff': scalp(0.004, 0.01, 0.016); P.add(h, new THREE.SphereGeometry(0.04, 14, 10), mat.hair, [0, 0.2, 0.05], [0.4, 0, 0], [1.3, 0.6, 1]); break;
      default: scalp(0.005, 0.011, 0.0);
    }
    F.shell = shellRaw; P.add = addRaw;
    // ---- mèches (hair cards) par-dessus la coque : fini les cheveux « lisses »
    {
      const zoneOf = (pred) => (covered ? (d) => pred(d) && !covered(d) : pred);
      const hc = mat.hairCard;
      const card = (pred, o) => P.add(h, hairCards(F, zoneOf(pred), { seed: 7 + (a.hair % 97), ...o }), hc);
      const lod = a.lod === 'low' ? 0.45 : 1;
      switch (a.hairStyle) {
        case 'short': card(Z.scalp, { count: 3600 * lod, len: [0.026, 0.042], width: 0.017, flow: FLOWS.short, lift: 0.12, cross: 0.1, maxOut: 0.008 }); break;
        case 'fade': card(Z.top, { count: 3600 * lod, len: [0.03, 0.05], width: 0.017, flow: FLOWS.fade, lift: 0.18, cross: 0.12, maxOut: 0.012 }); break;
        case 'receding': card((d) => Z.scalp(d) && !Z.top(d), { count: 3000 * lod, len: [0.02, 0.032], width: 0.014, flow: FLOWS.short, lift: 0.2 }); break;
        case 'quiff': card(Z.top, { count: 3600 * lod, len: [0.04, 0.075], width: 0.018, flow: FLOWS.quiff, lift: 0.35, cross: 0.2, maxOut: 0.03 }); card((d) => Z.scalp(d) && !Z.top(d), { count: 2400 * lod, len: [0.015, 0.025], width: 0.013, flow: FLOWS.fade, lift: 0.1 }); break;
        case 'surfer': card(Z.surf, { count: 4200 * lod, len: [0.06, 0.1], width: 0.02, flow: FLOWS.surfer, lift: 0.15, cross: 0.12, curl: 0.5, gravity: 0.6, maxOut: 0.018, free: true }); break;
        case 'curtain': card(Z.curtain, { count: 4000 * lod, len: [0.05, 0.085], width: 0.019, flow: FLOWS.curtain, lift: 0.15, cross: 0.1, gravity: 0.4, maxOut: 0.016, free: true }); break;
        case 'long': card(Z.scalp, { count: 4200 * lod, len: [0.1, 0.17], width: 0.02, flow: FLOWS.long, lift: 0.12, cross: 0.08, gravity: 1.2, segs: 6, maxOut: 0.02, free: true }); break;
        case 'ponytail': case 'bun': card(Z.scalp, { count: 3600 * lod, len: [0.04, 0.07], width: 0.016, flow: FLOWS.tied, lift: 0.1 }); break;
        case 'curly': case 'longcurly': card(Z.scalp, { count: 3200 * lod, len: [0.025, a.hairStyle === 'curly' ? 0.04 : 0.07], width: 0.018, flow: FLOWS.curly, lift: 0.4, cross: 0.3, curl: 2.2, maxOut: 0.02 }); break;
        case 'mohawk': card((d) => Z.top(d) && Math.abs(d.x) < 0.22, { count: 3000 * lod, len: [0.04, 0.07], width: 0.016, flow: FLOWS.mohawk, lift: 0.8, cross: 0.4, maxOut: 0.05 }); break;
        case 'buzz': card(Z.scalp, { count: 4200 * lod, len: [0.006, 0.01], width: 0.01, flow: FLOWS.short, lift: 0.3, segs: 2 }); break;
        default: break;
      }
    }
    // barbe
    const beardM = new THREE.MeshStandardMaterial({ color: new THREE.Color(a.hair).lerp(new THREE.Color(a.skin), 0.35).multiplyScalar(0.8), roughness: 0.95 });
    if (a.beard === 'full') P.add(h, F.shell(Z.beard, 0.0016, { topBoost: 0 }), beardM);
    if (a.beard === 'pencil') P.add(h, F.shell(Z.pencil, 0.0024), beardM);
    // poils de barbe (petites mèches drues) par-dessus les coques
    {
      const bc = mat.beardCard, lod = a.lod === 'low' ? 0.45 : 1;
      const bcard = (pred, o) => P.add(h, hairCards(F, pred, { seed: 31, segs: 2, rootOff: 0.001, minScale: 1.0, ...o }), bc);
      const B = a.beard;
      if (B === 'beard' || B === 'full' || B === 'short') bcard(Z.beard, { count: (B === 'full' ? 9000 : 6500) * lod, len: B === 'full' ? [0.014, 0.024] : B === 'short' ? [0.005, 0.009] : [0.009, 0.015], width: 0.012, flow: FLOWS.beard, lift: 0.3, cross: 0.15, maxOut: 0.008 });
      if (B === 'goatee' || B === 'vandyke') bcard(Z.goatee, { count: 15000 * lod, len: [0.008, 0.015], width: 0.009, flow: FLOWS.beard, lift: 0.3, maxOut: 0.007 });
      if (['moustache', 'goatee', 'full', 'beard', 'vandyke', 'horseshoe'].includes(B)) bcard(Z.moustache, { count: 18000 * lod, len: [0.005, 0.009], width: 0.006, flow: FLOWS.moustache, lift: 0.2, maxOut: 0.004 });
      if (B === 'chinstrap') bcard(Z.chinstrap, { count: 16000 * lod, len: [0.008, 0.012], width: 0.011, flow: FLOWS.beard, lift: 0.4 });
      if (B === 'mutton') bcard(Z.mutton, { count: 16000 * lod, len: [0.008, 0.013], width: 0.011, flow: FLOWS.beard, lift: 0.4 });
      if (B === 'horseshoe') bcard(Z.horseshoe, { count: 26000 * lod, len: [0.008, 0.014], width: 0.01, flow: FLOWS.beard, lift: 0.4 });
    }
    // accessoires : coques ajustées au crâne (au-dessus des cheveux), visière et écusson
    const hw = a.headwear;
    const capM = a.capColor != null ? mat.capMat : mat.shirt;
    const front = (y, z, out) => { const q = F.at(0, y, z); return q.multiplyScalar(1).add(new THREE.Vector3(0, -0.112, 0).multiplyScalar(0)).addScaledVector(new THREE.Vector3(0, q.y - 0.112, q.z).normalize(), out); };
    if (hw === 'band' || hw === 'visor') P.add(h, F.shell(Z.band, 0.012, { soft: false, topBoost: 0.004 }), mat.accent);
    if (hw === 'bandana') {
      // bandeau large noué derrière (style Nadal), par-dessus les cheveux
      P.add(h, F.shell((d) => d.y > 0.36 + 0.12 * d.z && d.y < 0.62 + 0.12 * d.z, 0.024, { soft: false, topBoost: 0.016 }), mat.accent);
      for (const sx of [1, -1]) P.add(h, new THREE.ConeGeometry(0.02, 0.09, 8), mat.accent, [sx * 0.02, 0.1, -0.11], [-2.6, 0, sx * 0.3]);
    }
    if (hw === 'cap' || hw === 'capback') {
      const back = hw === 'capback';
      const zone = back ? (d) => Z.cap({ x: d.x, y: d.y, z: -d.z }) : Z.cap;
      P.add(h, F.shell(zone, 0.02, { soft: false, topBoost: 0.014 }), capM);
      // bouton au sommet
      P.add(h, new THREE.SphereGeometry(0.008, 8, 6), capM, [0, F.at(0, 1, 0).y + 0.034, 0]);
      // visière arrondie, légèrement incurvée
      const vz = back ? -1 : 1;
      const base = front(0.52, 0.85 * vz, 0.02);
      const brim = new THREE.CylinderGeometry(0.082, 0.082, 0.008, 24, 1, false, -Math.PI / 2, Math.PI);
      const bp = brim.attributes.position;
      for (let i = 0; i < bp.count; i++) { const x = bp.getX(i); bp.setY(i, bp.getY(i) - x * x * 1.2); }
      brim.computeVertexNormals();
      if (back) brim.rotateY(Math.PI);
      P.add(h, brim, a.capColor != null ? mat.capMat : mat.accent, [base.x, base.y - 0.004, base.z + vz * 0.045], [vz * 0.22, 0, 0], [1, 1, 1.05]);
      if (a.capPatch && !back) {
        const pp = front(0.64, 0.76, 0.024);
        const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.034), new THREE.MeshStandardMaterial({ map: capPatchTexture(), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -4 }));
        patch.position.copy(pp); patch.rotation.x = -0.55;
        h.add(patch);
      }
    }
    if (hw === 'visor') {
      const base = front(0.47, 0.87, 0.016);
      P.add(h, new THREE.CylinderGeometry(0.08, 0.08, 0.008, 24, 1, false, -Math.PI / 2, Math.PI), mat.accent, [base.x, base.y, base.z + 0.04], [0.22, 0, 0], [1, 1, 1.05]);
    }
  }

  /** Sac de padel (thermobag) posé au bord du court ou à côté du joueur dans l'éditeur. */
  static makeBag({ main = 0x1565c0, accent = 0xffd400, metal = false } = {}) {
    const g = new THREE.Group();
    const body = new THREE.MeshPhysicalMaterial({ color: main, roughness: metal ? 0.3 : 0.6, metalness: metal ? 0.7 : 0.05, clearcoat: 0.5 });
    const trim = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 });
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.62, 6, 16), body);
    b.rotation.z = Math.PI / 2; b.scale.set(1, 1, 0.75); b.position.y = 0.17;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.172, 0.018, 8, 24), trim);
    band.rotation.y = Math.PI / 2; band.scale.set(1, 1, 0.75); band.position.y = 0.17;
    const band2 = band.clone(); band.position.x = 0.22; band2.position.x = -0.22;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.015, 6, 16, Math.PI), trim);
    handle.position.y = 0.33;
    g.add(b, band, band2, handle);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  /** Pose de l'épaule et du coude droits pendant une frappe. */
  static swingPose(sw) {
    const T = sw.dur, t = Math.min(sw.t, T);
    const c = 0.06; // instant de l'impact dans l'animation
    const pre = Math.min(1, t / c), post = t <= c ? 0 : ease((t - c) / (T - c));
    const cz = sw.contactRz;
    const elbow = t <= c ? lerp(0.7, 0.08, pre) : lerp(0.08, 1.0, post);
    if (sw.kind === 'over') {
      return { rx: t <= c ? lerp(-1.1, 0.3, pre) : lerp(0.3, 2.0, post), ry: 0, rz: -1.75, elbow: t <= c ? lerp(1.4, 0.05, pre) : lerp(0.05, 0.6, post) };
    }
    let zStart = cz, zEnd = -0.6;
    if (sw.style === 'lob') { zStart = Math.min(1.3, cz + 0.6); zEnd = -1.3; }
    if (sw.style === 'slice') { zStart = cz - 0.6; zEnd = cz + 0.5; }
    const ry = sw.kind === 'fore'
      ? (t <= c ? lerp(-1.5, 0, pre) : lerp(0, 1.9, post))
      : (t <= c ? lerp(-2.3, -Math.PI, pre) : lerp(-Math.PI, -4.4, post));
    const rz = t <= c ? lerp(zStart, cz, pre) : lerp(cz, zEnd, post);
    return { rx: 0, ry, rz, elbow: sw.kind === 'back' ? elbow * 0.6 : elbow };
  }

  /**
   * @param {object} s  { speed, fwd, side, yaw, look, armed:{kind,charge}|null, swing|null, ready }
   *   fwd/side : composantes de la vitesse dans le repère du joueur (m/s)
   *   look : angle (rad) de la balle par rapport au regard, pour la tête
   */
  /** Pas d'allègement : petit saut d'équilibre quand l'adversaire frappe. */
  splitStep() { this.split = 0.32; }

  /** Le visage rougit (colère) pendant `dur` secondes. */
  flush(dur = 2.5) { this._flushT = dur; this._flushDur = dur; }

  animate(dt, s) {
    // visage rouge de colère, qui revient progressivement
    if (this._flushT > 0 || this._flushOn) {
      this._flushT = Math.max(0, (this._flushT || 0) - dt);
      const k = this._flushT > 0 ? Math.min(1, this._flushT / Math.min(0.8, this._flushDur)) : 0;
      for (const m of [this.mat.faceSkin, this.mat.skin]) {
        if (!m) continue;
        m.userData.base ??= m.color.clone();
        m.color.copy(m.userData.base).lerp(new THREE.Color(0xff3a2a), 0.55 * k);
      }
      this._flushOn = k > 0;
    }
    const run = Math.min(1, s.speed / 4.5);
    this.phase += dt * (6 + s.speed * 2.1) * (this.sty?.tempo || 1);
    const ph = this.phase;
    const fwdK = s.speed > 0.1 ? s.fwd / s.speed : 0;
    const sideK = s.speed > 0.1 ? s.side / s.speed : 0;

    // orientation (lissée)
    let dy = s.yaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * (1 - Math.exp(-dt * 12));
    this.root.rotation.set(0, this.yaw, 0);

    // ---------------- bras (cinématique inverse) + flexion
    let snap = false, jump = 0;
    let crouchT = s.ready ? 1 : 0.4;
    const pelvisY = this.pelvis.position.y;
    const toChest = (h) => h / (this.root.scale.y || 1) - (pelvisY + 0.28);
    let st;
    let lunge = null;
    if (s.swing?.contactPos) {
      // position de l'impact dans le repère du joueur (calculée au début du geste)
      if (!s.swing._loc) {
        this.root.updateMatrixWorld(true);
        const loc = this.body.worldToLocal(s.swing.contactPos.clone());
        s.swing._loc = loc;
        if (s.swing.kind !== 'over') s.swing.kind = loc.x > 0.12 ? 'back' : 'fore';
      }
      // fente : le corps va vers la balle quand elle est loin du bras
      // distance horizontale épaule -> balle ; au-delà de ~0,8 m, le corps s'allonge vers elle
      const loc = s.swing._loc, sx = loc.x + 0.2, d = Math.hypot(sx, loc.z);
      const need = Math.min(0.75, Math.max(0, d - 0.72));
      if (need > 0) lunge = { x: (sx / d) * need, z: (loc.z / d) * need };
    }
    if (s.swing) {
      st = { mode: 'swing', kind: s.swing.kind === 'over' ? 'over' : s.swing.kind === 'back' ? 'back' : 'fore', t: s.swing.t, dur: s.swing.dur, style: s.swing.style, hc: toChest(s.swing.contactH ?? 1) };
      snap = true;
      const k = Math.sin(Math.PI * Math.min(1, s.swing.t / s.swing.dur));
      if (s.swing.jump) jump = k * s.swing.jump;
      if (s.swing.contactH < 0.8) crouchT = 1 + (0.8 - s.swing.contactH) * 4;
      else crouchT = 1.15;
    } else if (s.armed) {
      st = { mode: 'armed', kind: s.armed.kind === 'over' ? 'over' : s.armed.kind === 'back' ? 'back' : 'fore', charge: Math.min(1, s.armed.charge * 1.4 + 0.2), hc: 0 };
      crouchT = s.armed.kind === 'over' ? 1.0 : 1.35;
    } else if (s.speed > 0.35) st = { mode: 'run', run: Math.max(run, clamp((s.speed - 0.15) / 1.3, 0, 1) * 0.55), ph };
    else st = { mode: 'idle' };
    // fente vers la balle pendant la frappe, puis retour
    const lw = s.swing ? 1 - smoothstep(0.35, 1, s.swing.t / s.swing.dur) : 0;
    const tx = lunge ? lunge.x * lw : 0, tz = lunge ? lunge.z * lw : 0;
    const lk = lunge ? 1 : 1 - Math.exp(-dt * 8);
    this.body.position.x += (tx - this.body.position.x) * lk;
    this.body.position.z += (tz - this.body.position.z) * lk;
    const P = armPose(st);
    // personnalisation du geste
    const Y = this.sty;
    if (st.mode === 'idle') { P.H.y += Y.racketH; P.H.z += Y.racketOut; P.LH.y += Y.racketH * 0.8; P.LH.z += Y.racketOut; }
    // raquette tenue d'une seule main, bras libre relâché le long du corps (style décontracté)
    if (Y.oneHand && (st.mode === 'idle' || st.mode === 'run')) {
      P.LH.set(0.24, -0.5, 0.02);
      if (st.mode === 'idle') { P.H.set(-0.26, -0.42, 0.14); P.D.set(-0.15, -0.35, 0.92); P.F.set(1, 0, 0.1); }
    }
    if (st.mode === 'armed' || (st.mode === 'swing' && st.t / st.dur < 0.1)) {
      P.H.z = P.H.z * Y.back; P.H.x *= 0.9 + 0.1 * Y.back; P.twist *= Y.twist;
    } else if (st.mode === 'swing') {
      P.H.y += (P.H.y - 0.0) * (Y.finish - 1) * 0.6; P.H.x *= 0.85 + 0.15 * Y.finish; P.twist *= Y.twist;
    }
    P.lean += Y.lean;
    // frappe réelle : à l'impact, le centre du tamis est placé sur la balle
    if (s.swing?.contactPos && this.chest.parent) {
      const u = s.swing.t / s.swing.dur;
      const w = 1 - smoothstep(0.1, 0.32, u);
      if (w > 0) {
        this.root.updateMatrixWorld(true);
        const cl = this.chest.worldToLocal(s.swing.contactPos.clone());
        // la raquette prolonge la ligne épaule -> balle (un peu relevée), la main juste avant
        const D = cl.clone().sub(this.rShoulder.position).normalize();
        D.y += 0.25; D.normalize();
        P.D.lerp(D, w);
        const Hc = cl.clone().addScaledVector(D, -0.33);
        // portée du bras : on garde la main atteignable depuis l'épaule
        const sh = this.rShoulder.position, v = Hc.clone().sub(sh), L = v.length();
        if (L > 0.56) Hc.copy(sh).addScaledVector(v, 0.56 / L);
        P.H.lerp(Hc, w);
      }
    }
    const ik = this.ik || (this.ik = { H: P.H.clone(), D: P.D.clone(), F: P.F.clone(), LH: P.LH.clone(), twist: 0, hips: 0, lean: 0.1 });
    // lissage : rapide mais jamais instantané (sauf l'impact, la raquette doit être sur la balle)
    const kk = snap ? (s.swing.t < s.swing.dur * 0.12 ? 1 - Math.exp(-dt * 60) : 1 - Math.exp(-dt * 22)) : 1 - Math.exp(-dt * 9);
    ik.H.lerp(P.H, kk); ik.D.lerp(P.D, kk); ik.F.lerp(P.F, kk); ik.LH.lerp(P.LH, 1 - Math.exp(-dt * 10));
    ik.twist += (P.twist - ik.twist) * kk * 0.8; ik.hips += (P.hips - ik.hips) * kk * 0.7; ik.lean += (P.lean - ik.lean) * (1 - Math.exp(-dt * 10));
    const over = st.kind === 'over' && st.mode !== 'idle';
    solveArm(this.rShoulder, this.rElbow, this.rShoulder.position, ik.H, over ? new THREE.Vector3(-1, -0.2, -0.4) : new THREE.Vector3(-0.6, -1, -0.45), true);
    aimRacket(this.racket, this.rShoulder, this.rElbow, ik.D, ik.F);
    solveArm(this.lShoulder, this.lElbow, this.lShoulder.position, ik.LH, new THREE.Vector3(0.6, -1, -0.35), false);
    const twist = ik.twist, lean = ik.lean;
    this.pelvis.rotation.y = THREE.MathUtils.clamp(ik.hips, -0.3, 0.3);

    // ---------------- jambes : marche / course / pas chassés
    // g : intensité de la marche (s'engage dès 0,3 m/s), run : course
    const g = clamp((s.speed - 0.15) / 1.3, 0, 1);
    if (!s.swing && !s.armed) crouchT = s.ready ? 1.1 * this.sty.crouch - 0.6 * g - 0.2 * run : 0.35;
    this.crouch += (crouchT - this.crouch) * (1 - Math.exp(-dt * 8));
    const c = this.crouch * (1 - run * 0.4);
    const base = 0.27 * c; // angle de cuisse (et de tibia) par rapport à la verticale
    let drop = (THIGH + SHIN) * (1 - Math.cos(base));
    const A = (0.3 * g + 0.42 * run) * this.sty.stride;   // amplitude de la foulée
    const fwdA = Math.abs(fwdK), sideA = Math.abs(sideK);
    for (const L of this.legs) {
      const off = L.sx > 0 ? 0 : Math.PI;
      const sw = Math.sin(ph + off);
      const lift = Math.max(0, Math.cos(ph + off)) * (0.4 * g + 0.65 * run);
      L.hip.rotation.x = -base - sw * A * fwdK - lift * 0.22 * fwdA;
      L.knee.rotation.x = base * 2 + lift * (0.75 + 0.45 * run);
      L.ankle.rotation.x = -base + lift * 0.28 - Math.max(0, sw * fwdK) * 0.22 * g;
      // pas chassés : écartement / rapprochement alternés
      L.hip.rotation.z = L.sx * (0.035 + this.sty.wide + sideA * 0.05 * g) + sideK * sw * (0.13 * g + 0.1 * run);
      // pendant le split-step : genoux repliés en l'air, pieds écartés à la réception
      if (this._tuck > 0) { L.hip.rotation.x -= this._tuck * 0.35; L.knee.rotation.x += this._tuck * 0.7; L.ankle.rotation.x -= this._tuck * 0.25; L.hip.rotation.z += L.sx * this._tuck * 0.08; }
      else if (this.split > 0) L.hip.rotation.z += L.sx * 0.1;
    }
    drop += Math.abs(Math.cos(ph)) * (0.014 * g + 0.03 * run) * this.sty.bounce;
    this.pelvis.position.y = THIGH + SHIN + 0.085 - drop;
    this.pelvis.rotation.z = Math.sin(ph) * (0.03 + this.sty.sway) * g;
    const moving = !s.swing && !s.armed;
    if (moving) this.pelvis.rotation.y += Math.sin(ph) * 0.09 * g * fwdA;
    // pas d'allègement : envol bref puis réception jambes fléchies
    if (this.split > 0 && !s.swing && !s.armed) {
      this.split -= dt;
      const u = 1 - this.split / 0.32;
      const air = Math.max(0, Math.sin(Math.min(1, u / 0.5) * Math.PI));
      jump += air * 0.13;
      this._tuck = air;
      if (u > 0.5) this.crouch = Math.max(this.crouch, 1.45);
      else if (u < 0.12) this.crouch = Math.max(this.crouch, 1.2);   // appel
    } else { this.split = 0; this._tuck = 0; }
    this.body.position.y = jump;

    // buste, rotation des épaules, tête vers la balle
    this.spine.rotation.x += ((lean + run * 0.12 * Math.max(0, fwdK)) - this.spine.rotation.x) * (1 - Math.exp(-dt * 10));
    this.chest.rotation.y = twist - this.pelvis.rotation.y - (moving ? Math.sin(ph) * 0.12 * g * fwdA : 0);
    this.chest.rotation.z = sideK * run * 0.06 - this.pelvis.rotation.z * 0.8;
    const look = clamp((s.look || 0) - this.chest.rotation.y, -1.0, 1.0);
    this.lookYaw += (look - this.lookYaw) * (1 - Math.exp(-dt * 8));
    this.head.rotation.y = this.lookYaw;
    this.head.rotation.x = -this.spine.rotation.x * 0.6;
  }
}
