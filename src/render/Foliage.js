// ============================================================================
//  Feuillage procédural : volumes bosselés couverts de cartes de feuilles
//  (ou d'aiguilles) à texture découpée. Utilisé pour les arbres, buissons, haies.
// ============================================================================
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTex } from './Surroundings.js';

// ------------------------------------------------------------------ végétation
const _leafTex = {};
/** Texture de feuillage découpée (feuilles ou aiguilles) sur fond transparent. */
export function leafTexture(kind = 'leaf') {
  if (_leafTex[kind]) return _leafTex[kind];
  const t = canvasTex(256, 256, (g, S) => {
    g.clearRect(0, 0, S, S);
    const greens = kind === 'needle' ? ['#2f4a22', '#3b5a29', '#253d1b', '#4a6a30'] : ['#3f6b2a', '#4f7d31', '#36602a', '#5f8a3a', '#2e5222'];
    if (kind === 'needle') {
      for (let k = 0; k < 220; k++) {
        const x = 20 + Math.random() * 216, y = 20 + Math.random() * 216, a = Math.random() * Math.PI * 2, l = 14 + Math.random() * 22;
        g.strokeStyle = greens[k % greens.length]; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
    } else {
      for (let k = 0; k < 70; k++) {
        const x = 24 + Math.random() * 208, y = 24 + Math.random() * 208, a = Math.random() * Math.PI * 2, l = 12 + Math.random() * 14;
        g.save(); g.translate(x, y); g.rotate(a);
        g.fillStyle = greens[k % greens.length];
        g.beginPath(); g.ellipse(0, 0, l, l * 0.45, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(20,40,10,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-l, 0); g.lineTo(l, 0); g.stroke();
        g.restore();
      }
    }
  });
  t.colorSpace = THREE.SRGBColorSpace;
  _leafTex[kind] = t;
  return t;
}

/**
 * Feuillage : volumes de base bosselés + cartes de feuilles posées à leur surface.
 * blobs : [[x, y, z, rayon, aplatissement]] ; renvoie { core, cards } (géométries).
 */
export function foliage(blobs, { density = 34, card = 0.9, shade = 0.55 } = {}) {
  const cores = [], cards = [];
  const nrm = new THREE.Vector3(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 0, 1);
  for (const [x, y, z, r, sy = 1] of blobs) {
    const g = mergeVertices(new THREE.IcosahedronGeometry(r, 3).deleteAttribute('normal').deleteAttribute('uv'));
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const n = 1 + 0.12 * Math.sin(vx * 3.1 / r + vz * 2.3 / r) + 0.08 * Math.cos(vy * 4.7 / r);
      p.setXYZ(i, x + vx * n * 0.92, y + vy * n * sy * 0.92, z + vz * n * 0.92);
    }
    g.computeVertexNormals();
    cores.push(g);
    const count = Math.round(density * r * r);
    for (let k = 0; k < count; k++) {
      // point aléatoire à la surface, carte orientée vers l'extérieur
      nrm.set(Math.random() * 2 - 1, (Math.random() * 2 - 1) * 0.9 + 0.1, Math.random() * 2 - 1).normalize();
      const c = new THREE.PlaneGeometry(card * (0.7 + Math.random() * 0.6), card * (0.7 + Math.random() * 0.6));
      q.setFromUnitVectors(up, nrm);
      c.applyQuaternion(q).rotateY(0);
      const d = r * (0.88 + Math.random() * 0.22);
      c.translate(x + nrm.x * d, y + nrm.y * d * sy, z + nrm.z * d);
      // ombrage : plus sombre vers le bas et l'intérieur
      const lum = 1 - shade * (0.5 - nrm.y * 0.5) * (0.7 + Math.random() * 0.3);
      const n = c.attributes.position.count, col = new Float32Array(n * 3).fill(lum);
      c.setAttribute('color', new THREE.BufferAttribute(col, 3));
      cards.push(c);
    }
  }
  const core = mergeGeometries(cores.map((g) => g.toNonIndexed()));
  const cardGeo = cards.length ? mergeGeometries(cards.map((g) => g.toNonIndexed())) : null;
  return { core, cards: cardGeo };
}
export const leafMat = (kind, tint) => new THREE.MeshStandardMaterial({ map: leafTexture(kind), color: tint, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, vertexColors: true });


/** Haie taillée : volume arrondi couvert de feuilles. Renvoie un Group. */
export function hedge(w, h, d, x, y, z, color = 0x3d6b2c) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(0.35, h / 3, Math.min(w, d) / 3)), new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), roughness: 1 }));
  g.add(core);
  const cards = [];
  const area = 2 * (w * h + d * h + w * d);
  const n = Math.min(4000, Math.round(area * 14));
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 0, 1), nrm = new THREE.Vector3();
  for (let k = 0; k < n; k++) {
    // face tirée au prorata de sa surface
    const r = Math.random() * area;
    let px, py, pz;
    if (r < 2 * w * h) { const sz = r < w * h ? 1 : -1; nrm.set(0, 0, sz); px = (Math.random() - 0.5) * w; py = (Math.random() - 0.5) * h; pz = sz * d / 2; }
    else if (r < 2 * (w * h + d * h)) { const sx = Math.random() < 0.5 ? 1 : -1; nrm.set(sx, 0, 0); px = sx * w / 2; py = (Math.random() - 0.5) * h; pz = (Math.random() - 0.5) * d; }
    else { nrm.set(0, 1, 0); px = (Math.random() - 0.5) * w; py = h / 2; pz = (Math.random() - 0.5) * d; }
    nrm.x += (Math.random() - 0.5) * 0.8; nrm.y += (Math.random() - 0.5) * 0.8; nrm.z += (Math.random() - 0.5) * 0.8; nrm.normalize();
    const c = new THREE.PlaneGeometry(0.45 + Math.random() * 0.25, 0.45 + Math.random() * 0.25);
    q.setFromUnitVectors(up, nrm); c.applyQuaternion(q);
    c.translate(px + nrm.x * 0.05, py + nrm.y * 0.05, pz + nrm.z * 0.05);
    const lum = 0.75 + Math.random() * 0.25 - (py < 0 ? 0.15 : 0);
    c.setAttribute('color', new THREE.BufferAttribute(new Float32Array(c.attributes.position.count * 3).fill(lum), 3));
    cards.push(c.toNonIndexed());
  }
  const m = new THREE.Mesh(mergeGeometries(cards), leafMat('leaf', new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.45)));
  g.add(m);
  g.position.set(x, y, z);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
