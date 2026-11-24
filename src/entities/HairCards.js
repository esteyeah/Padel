// ============================================================================
//  Cheveux et barbes en « mèches » (hair cards), comme dans les jeux :
//  des centaines de petites bandes transparentes texturées de fines mèches,
//  plantées sur le crâne et orientées selon la coupe (raie, frange, gravité,
//  ondulations). Une coque sombre en dessous évite de voir le cuir chevelu.
// ============================================================================
import * as THREE from 'three';
import { CY } from './Face.js';

let _strand = null, _beard = null;

/** Texture de mèche : fins cheveux blancs (teintés par la matière), bouts effilés. */
export function strandTexture() {
  if (_strand) return _strand;
  const W = 128, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  let seed = 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 260; i++) {
    const x0 = rnd() * W, len = H * (0.55 + rnd() * 0.45), w = 0.6 + rnd() * 1.3;
    const drift = (rnd() - 0.5) * 10, shade = 170 + rnd() * 85;
    const grd = g.createLinearGradient(0, 0, 0, len);
    grd.addColorStop(0, `rgba(${shade},${shade},${shade},0.95)`);
    grd.addColorStop(0.75, `rgba(${shade},${shade},${shade},0.85)`);
    grd.addColorStop(1, `rgba(${shade},${shade},${shade},0)`);
    g.strokeStyle = grd; g.lineWidth = w;
    g.beginPath(); g.moveTo(x0, 0); g.bezierCurveTo(x0 + drift * 0.3, len * 0.33, x0 + drift * 0.7, len * 0.66, x0 + drift, len); g.stroke();
  }
  // bords de la bande plus clairsemés (pas de bord net)
  const img = g.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const e = Math.min(x, W - 1 - x) / (W * 0.18);
    if (e < 1) img.data[(y * W + x) * 4 + 3] *= e;
  }
  g.putImageData(img, 0, 0);
  _strand = new THREE.CanvasTexture(c);
  _strand.colorSpace = THREE.SRGBColorSpace;
  _strand.anisotropy = 4;
  return _strand;
}

/** Texture de barbe : poils courts, drus, légèrement bouclés. */
export function beardTexture() {
  if (_beard) return _beard;
  const W = 128, H = 128;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  let seed = 9;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 520; i++) {
    const x = rnd() * W, y = rnd() * H * 0.4, l = H * (0.35 + rnd() * 0.6), s = 150 + rnd() * 105;
    g.strokeStyle = `rgba(${s},${s},${s},${0.55 + rnd() * 0.45})`; g.lineWidth = 0.8 + rnd() * 1.2;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (rnd() - 0.5) * 14, y + l * 0.5, x + (rnd() - 0.5) * 10, Math.min(H, y + l)); g.stroke();
  }
  _beard = new THREE.CanvasTexture(c);
  _beard.colorSpace = THREE.SRGBColorSpace;
  return _beard;
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Génère les mèches d'une zone du crâne.
 * @param F     tête (makeFace) : F.at(x,y,z) donne le point de surface dans la direction
 * @param zone  prédicat sur la direction unitaire d
 * @param o     { count, len:[min,max], width, flow(d, root, n) -> Vector3, lift, curl, segs, stiff, cross, jitter }
 * @returns BufferGeometry (non indexée, position/normal/uv)
 */
export function hairCards(F, zone, o = {}) {
  const N = o.count ?? 3200;
  const segs = o.segs ?? 4;
  const [lmin, lmax] = o.len ?? [0.03, 0.05];
  const width = o.width ?? 0.016;
  const pos = [], nor = [], uv = [];
  let seed = o.seed ?? 17;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const golden = Math.PI * (3 - Math.sqrt(5));
  const center = new THREE.Vector3(0, CY, 0);
  const d = new THREE.Vector3(), t = new THREE.Vector3(), side = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const y = 1 - (i + 0.5) * (2 / N), r = Math.sqrt(1 - y * y), th = i * golden;
    d.set(Math.cos(th) * r, y, Math.sin(th) * r);
    // petit désordre pour casser la grille
    d.x += (rnd() - 0.5) * 0.03; d.y += (rnd() - 0.5) * 0.03; d.z += (rnd() - 0.5) * 0.03; d.normalize();
    if (!zone(d)) continue;
    const root = F.at(d.x, d.y, d.z);
    const n = root.clone().sub(center).normalize();
    root.addScaledVector(n, o.rootOff ?? 0.004);
    const L = lmin + (lmax - lmin) * rnd();
    // direction de pousse : fournie par la coupe, ramenée dans le plan tangent puis légèrement relevée
    const f = (o.flow ? o.flow(d, root, n, rnd) : new THREE.Vector3(0, -1, 0)).clone();
    f.addScaledVector(n, -f.dot(n));
    if (f.lengthSq() < 1e-6) f.copy(UP).addScaledVector(n, -n.y);
    f.normalize();
    const crossCard = o.cross && rnd() < o.cross;
    side.crossVectors(n, f).normalize();
    if (crossCard) side.lerp(n, 0.7).normalize();          // une partie des mèches est « debout » pour le volume
    const w = width * (0.75 + rnd() * 0.5);
    const u0 = Math.floor(rnd() * 4) / 4;
    // suit la surface : la mèche s'écarte un peu du crâne (lift) puis retombe selon flow + gravité
    const pts = [];
    p.copy(root);
    const dir = f.clone();
    const lift = (o.lift ?? 0.25) * (0.7 + rnd() * 0.6);
    for (let k = 0; k <= segs; k++) {
      pts.push(p.clone());
      const s = L / segs;
      const g = o.gravity ?? 0;
      q.copy(dir).addScaledVector(n, lift * (1 - k / segs)).addScaledVector(UP, -g * (k / segs)).normalize();
      if (o.curl) { const a = (k + i) * o.curl; q.addScaledVector(side, Math.sin(a) * 0.5).normalize(); }
      // retient la mèche près du crâne (elle ne doit pas rentrer dedans)
      p.addScaledVector(q, s);
      const rr = p.clone().sub(center), minR = root.distanceTo(center) * (o.minScale ?? 1.0);
      // la mèche reste plaquée dans une couche d'épaisseur maxOut au-dessus du crâne (sauf cheveux longs qui tombent)
      const maxR = minR + (o.maxOut ?? 0.01) * (0.6 + 0.4 * (k + 1) / segs);
      const rl = rr.length();
      if (rl < minR) p.copy(center).addScaledVector(rr.normalize(), minR);
      else if (rl > maxR && !(o.free && p.y < CY - 0.02)) p.copy(center).addScaledVector(rr.normalize(), maxR);
    }
    const nn = crossCard ? f.clone().cross(side).normalize() : n;
    for (let k = 0; k < segs; k++) {
      const a = pts[k], b = pts[k + 1];
      const wa = w * (1 - 0.35 * (k / segs)), wb = w * (1 - 0.35 * ((k + 1) / segs));
      const a0 = a.clone().addScaledVector(side, -wa / 2), a1 = a.clone().addScaledVector(side, wa / 2);
      const b0 = b.clone().addScaledVector(side, -wb / 2), b1 = b.clone().addScaledVector(side, wb / 2);
      const va = k / segs, vb = (k + 1) / segs;
      for (const [P, U, V] of [[a0, 0, va], [b0, 0, vb], [b1, 1, vb], [a0, 0, va], [b1, 1, vb], [a1, 1, va]]) {
        pos.push(P.x, P.y, P.z); nor.push(nn.x, nn.y, nn.z); uv.push(u0 + U * 0.25, 1 - V);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos.length ? pos : [0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor.length ? nor : [0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv.length ? uv : [0, 0, 0, 0, 0, 0], 2));
  return geo;
}

// ------------------------------------------------------------------ directions de pousse par coupe
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const FLOWS = {
  // courte : vers l'arrière sur le dessus, vers le bas sur les côtés, petite frange balayée sur le côté
  short: (d) => (d.z > 0.45 && d.y > 0.4 ? V(0.8, -0.2, 0.6) : d.y > 0.5 ? V(0.15, -0.2, -1) : V(0, -1, -0.2)),
  // dégradé : dessus coiffé vers l'arrière et légèrement relevé
  fade: (d) => (d.z > 0.3 ? V(0.1, 0.4, -1) : V(0, -0.3, -1)),
  // banane : l'avant monte et part en arrière
  quiff: (d) => (d.z > 0.35 ? V(0, 1.2, -0.3) : V(0, -0.2, -1)),
  // mi-long / surfeur : tombe, s'écarte du visage
  surfer: (d) => V(d.x * 0.8, -1, d.z > 0.4 ? -0.4 : 0),
  long: (d) => V(d.x * 0.4, -1, d.z > 0.4 ? -0.6 : -0.1),
  // deux mèches : partent de la raie centrale vers les côtés puis tombent
  curtain: (d) => (d.z > 0.35 ? V(Math.sign(d.x || 1) * 1, -0.8, 0.3) : V(Math.sign(d.x || 1) * 0.4, -0.6, -0.6)),
  // crête : vers le haut
  mohawk: () => V(0, 1, -0.25),
  // queue de cheval / chignon : tiré vers l'arrière du crâne
  tied: (d) => V(-d.x * 0.6, 0.15 - d.y * 0.3, -1),
  // bouclé : directions désordonnées
  curly: (d, r, n, rnd) => V(rnd() - 0.5, rnd() - 0.6, rnd() - 0.5),
  // barbe : vers le bas, un peu vers l'avant sur le menton
  beard: (d) => V(d.x * 0.2, -1, d.y < -0.6 ? 0.35 : 0),
  moustache: (d) => V(Math.sign(d.x || 1) * 0.6, -1, 0.2),
};
