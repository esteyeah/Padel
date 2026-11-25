// ============================================================================
//  Visage procédural : une seule surface lisse obtenue en déformant une sphère
//  (mâchoire, menton, pommettes, orbites, arcades, nez, lèvres, occiput).
//  Les couleurs (lèvres, joues, ombre de barbe, crâne rasé) sont peintes dans
//  les sommets. Cheveux, barbes et sourcils sont des « coques » taillées dans
//  la même surface, légèrement décollées : elles épousent parfaitement le crâne.
//
//  Repère local de la tête : centre du crâne en (0, CY, 0), visage vers +z.
// ============================================================================
import * as THREE from 'three';

export const CY = 0.112;
const R = 0.1;

const g2 = (d, c, s) => {
  const dx = d.x - c[0], dy = d.y - c[1], dz = d.z - c[2];
  return Math.exp(-(dx * dx + dy * dy + dz * dz) / (s * s));
};
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Forme du visage : renvoie la position déformée (en m) pour une direction unitaire d.
 * p : { jaw (largeur de mâchoire), chin, nose (taille du nez), cheek, brow }
 */
function shape(d, p) {
  let x = d.x * 0.9, y = d.y * 1.0, z = d.z * 0.98;
  // mâchoire plus étroite vers le bas, menton en avant
  if (d.y < 0) {
    const k = Math.pow(-d.y, 1.3);
    x *= 1 - 0.13 * k * (1.12 - p.jaw * 0.5);
    if (d.z < 0) z *= 1 - 0.25 * k;
  }
  // arrière du crâne plus rond, front légèrement plat
  z += 0.07 * g2(d, [0, 0.35, -0.9], 0.6);                                   // crâne plus développé à l'arrière
  y += 0.03 * g2(d, [0, 0.95, -0.2], 0.5);                                   // dessus du crâne
  if (d.z > 0.6 && d.y > 0.2) z -= 0.03 * smooth(0.2, 0.7, d.y) * (d.z - 0.6);
  // visage plus plat de face (moins « œuf »), joues plus marquées sur les côtés
  if (d.z > 0.72) z -= 0.07 * (d.z - 0.72);
  x *= 1 + 0.04 * g2(d, [0.75, -0.1, 0.55], 0.35) + 0.04 * g2(d, [-0.75, -0.1, 0.55], 0.35);
  let r = 1;
  r += 0.065 * p.chin * g2(d, [0, -0.8, 0.58], 0.3);                                      // menton plus dessiné
  r += 0.06 * p.jaw * (g2(d, [0.6, -0.58, 0.38], 0.24) + g2(d, [-0.6, -0.58, 0.38], 0.24));    // angles de mâchoire carrés
  r -= 0.028 * (g2(d, [0.5, -0.36, 0.76], 0.17) + g2(d, [-0.5, -0.36, 0.76], 0.17));          // joues creusées sous les pommettes
  r += 0.012 * Math.exp(-((d.x / 0.035) ** 2)) * g2(d, [0, -0.33, 0.95], 0.06);               // philtrum   // angles de la mâchoire                    // menton
  r += 0.06 * p.cheek * (g2(d, [0.58, -0.02, 0.79], 0.28) + g2(d, [-0.58, -0.02, 0.79], 0.28));   // pommettes
  r -= 0.1 * (g2(d, [0.33, 0.1, 0.92], 0.16) + g2(d, [-0.33, 0.1, 0.92], 0.16));                 // orbites
  r += 0.09 * p.brow * (g2(d, [0.31, 0.27, 0.9], 0.17) + g2(d, [-0.31, 0.27, 0.9], 0.17));         // arcades
  // nez : arête qui sort de plus en plus vers la pointe, puis ailes
  if (d.z > 0.5) {
    const ridge = Math.exp(-((d.x / 0.085) ** 2)) * smooth(0.28, -0.05, d.y) * smooth(-0.42, -0.2, d.y);
    r += 0.13 * p.nose * ridge * (0.45 + 0.55 * smooth(0.2, -0.2, d.y));
    r += 0.1 * p.nose * g2(d, [0, -0.2, 0.98], 0.1);                 // pointe
    r += 0.05 * p.nose * (g2(d, [0.1, -0.24, 0.96], 0.07) + g2(d, [-0.1, -0.24, 0.96], 0.07)); // ailes
  }
  // bouche : lèvres et commissures
  r += 0.045 * g2(d, [0, -0.37, 0.93], 0.1);
  r += 0.05 * g2(d, [0, -0.5, 0.86], 0.1);
  r -= 0.01 * Math.exp(-(((d.y + 0.435) / 0.03) ** 2)) * Math.exp(-((d.x / 0.2) ** 2)) * smooth(0.7, 0.9, d.z);
  r -= 0.03 * g2(d, [0, -0.62, 0.8], 0.09);                              // creux sous la lèvre
  // tempes
  r -= 0.03 * (g2(d, [0.82, 0.3, 0.45], 0.25) + g2(d, [-0.82, 0.3, 0.45], 0.25));
  return new THREE.Vector3(x * r * R, y * r * R + CY, z * r * R);
}

/** Zones (à partir de la direction d'origine) utilisées pour peindre et tailler les coques. */
export const ZONES = {
  // cuir chevelu : ligne frontale haute devant, descend sur les côtés et derrière
  scalp: (d) => d.y > 0.6 - 0.95 * smooth(0.75, -0.3, d.z) && !(Math.abs(d.x) > 0.55 && d.y < 0.25 && d.z > -0.2 && d.z < 0.4),
  top: (d) => d.y > 0.66 - 0.4 * smooth(0.6, -0.6, d.z),
  beard: (d) => d.y < -0.08 && d.z > -0.25 && !(d.y > -0.56 && d.y < -0.3 && Math.abs(d.x) < 0.24 && d.z > 0.8) && d.y > -0.97 + 0.4 * smooth(0.2, -0.3, d.z),
  goatee: (d) => d.z > 0.55 && Math.abs(d.x) < 0.3 && d.y < -0.52 && d.y > -0.95,
  moustache: (d) => d.z > 0.78 && Math.abs(d.x) < 0.3 - (d.y + 0.3) * 0.6 && d.y < -0.25 && d.y > -0.4,
  chinstrap: (d) => ZONES.beard(d) && (d.y < -0.62 || Math.abs(d.x) > 0.58) && !(d.z > 0.5 && d.y > -0.62 && Math.abs(d.x) < 0.58),
  mutton: (d) => d.y < 0.12 && d.y > -0.62 && Math.abs(d.x) > 0.6 && d.z > -0.22 && d.z < 0.62,
  horseshoe: (d) => d.z > 0.62 && ((d.y < -0.25 && d.y > -0.4 && Math.abs(d.x) < 0.3 - (d.y + 0.3) * 0.6) || (Math.abs(d.x) > 0.2 && Math.abs(d.x) < 0.32 && d.y < -0.3 && d.y > -0.78)),
  pencil: (d) => d.z > 0.8 && Math.abs(d.x) < 0.24 && d.y < -0.27 && d.y > -0.36,
  // coupe surfeur : couvre les oreilles et la nuque, frange légère sur le front
  surf: (d) => d.y > 0.5 - 1.15 * smooth(0.82, -0.1, d.z) && !(d.z > 0.5 && d.y < 0.42 && Math.abs(d.x) < 0.62),
  // coupe « deux mèches » : cheveux + rideau sur le front, ouvert par une raie au milieu
  curtain: (d) => ZONES.scalp(d) || (d.z > 0.4 && d.y > 0.36 + 0.35 * Math.max(0, 0.3 - Math.abs(d.x)) / 0.3 && Math.abs(d.x) < 0.75),
  cap: (d) => d.y > 0.24 + 0.28 * smooth(0.3, 0.9, d.z) - 0.25 * smooth(-0.2, -0.8, d.z),
  band: (d) => d.y > 0.42 + 0.1 * d.z && d.y < 0.58 + 0.1 * d.z,
  brows: (d) => d.z > 0.6 && Math.abs(Math.abs(d.x) - 0.33) < 0.17 && Math.abs(d.y - (0.31 - Math.abs(Math.abs(d.x) - 0.3) * 0.3)) < 0.055,
};

/**
 * Construit la tête. Renvoie { head, shell(pred, offset, opts) }.
 * a : apparence (skin, hair, beard, hairStyle, belly, lipTone…)
 */
export function makeFace(a) {
  const p = { jaw: 1 + (a.belly || 0) * 0.35, chin: a.chin ?? 1, nose: a.nose ?? 1, cheek: 1 + (a.belly || 0) * 0.6, brow: 1 };
  const base = new THREE.SphereGeometry(1, 128, 96);
  const pos = base.attributes.position;
  const dirs = [];
  const n = pos.count;
  const colors = new Float32Array(n * 3);
  const skin = new THREE.Color(a.skin);
  const lip = skin.clone().multiplyScalar(0.78).lerp(new THREE.Color(0xb0524a), 0.32);
  const blush = skin.clone().lerp(new THREE.Color(0xd9786a), 0.16);
  const hair = new THREE.Color(a.hair);
  const stubble = skin.clone().lerp(hair, 0.35);
  const scalpShade = skin.clone().lerp(hair, a.hairStyle === 'shaved' ? 0.32 : 0.5);
  const lid = skin.clone().multiplyScalar(0.84).lerp(new THREE.Color(0x7a4a3a), 0.08);
  const shadow = skin.clone().multiplyScalar(0.62).lerp(new THREE.Color(0x3a1f18), 0.15);
  const lipLine = lip.clone().multiplyScalar(0.55);
  // bords doux des zones de cheveux / barbe (fraction de voisins dans la zone)
  const jit = [[0.07, 0, 0], [-0.07, 0, 0], [0, 0.07, 0], [0, -0.07, 0], [0, 0, 0.07], [0, 0, -0.07], [0.05, 0.05, 0], [-0.05, -0.05, 0]];
  const frac = (pred, d) => { let c = pred(d) ? 1 : 0; const q = new THREE.Vector3(); for (const [x, y, z] of jit) if (pred(q.set(d.x + x, d.y + y, d.z + z).normalize())) c++; return c / (jit.length + 1); };
  const scalpEdge = (d) => frac(ZONES.scalp, d);
  const beardEdge = (d) => frac(ZONES.beard, d);
  const tmp = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const d = new THREE.Vector3().fromBufferAttribute(pos, i).normalize();
    dirs.push(d);
    const v = shape(d, p);
    pos.setXYZ(i, v.x, v.y, v.z);
    // couleurs peintes
    tmp.copy(skin);
    const ax = Math.abs(d.x);
    // ombre des orbites et paupières, légers cernes
    tmp.lerp(lid, 0.55 * (g2(d, [0.34, 0.15, 0.9], 0.11) + g2(d, [-0.34, 0.15, 0.9], 0.11)));
    tmp.lerp(shadow, 0.25 * (g2(d, [0.3, 0.03, 0.93], 0.07) + g2(d, [-0.3, 0.03, 0.93], 0.07)));
    // joues rosées, nez un peu plus chaud
    tmp.lerp(blush, Math.min(1, 0.55 * (g2(d, [0.5, -0.15, 0.82], 0.22) + g2(d, [-0.5, -0.15, 0.82], 0.22)) + 0.35 * g2(d, [0, -0.15, 0.99], 0.1)));
    // narines
    tmp.lerp(shadow, 0.7 * (g2(d, [0.07, -0.27, 0.95], 0.03) + g2(d, [-0.07, -0.27, 0.95], 0.03)));
    // lèvres : arc de Cupidon, commissures, ligne de bouche
    const bow = 0.012 * Math.cos(d.x * 30) * Math.exp(-((d.x / 0.08) ** 2));
    const upper = Math.exp(-(((d.y + 0.41 - bow) / 0.028) ** 2)) * Math.exp(-((d.x / 0.2) ** 4));
    const lower = Math.exp(-(((d.y + 0.465) / 0.032) ** 2)) * Math.exp(-((d.x / 0.17) ** 4));
    const front = smooth(0.78, 0.92, d.z);
    tmp.lerp(lip, Math.min(0.9, (upper * 0.85 + lower) * front));
    tmp.lerp(lipLine, 0.75 * Math.exp(-(((d.y + 0.437) / 0.008) ** 2)) * Math.exp(-((d.x / 0.19) ** 4)) * front);
    // sourcils : effilés vers l'extérieur, légèrement arqués, poil par poil
    const bx = ax - 0.31;
    const browY = 0.305 + 0.05 * Math.cos(bx * 7) - 0.02;
    const thick = 0.034 * (1 - smooth(-0.05, 0.17, bx)) + 0.01;
    if (d.z > 0.55 && bx > -0.2 && bx < 0.17) {
      const w = Math.exp(-(((d.y - browY) / thick) ** 2)) * (0.7 + 0.3 * Math.sin(d.x * 900 + d.y * 400));
      tmp.lerp(hair, Math.min(0.92, w * (a.female ? 0.75 : 0.95)));
    }
    // ligne des cheveux et barbe naissante dégradées
    if (a.hairStyle !== 'bald') {
      const sc = scalpEdge(d);
      if (sc > 0) tmp.lerp(scalpShade, Math.min(0.9, sc * (['shaved', 'buzz'].includes(a.hairStyle) ? 0.7 : 1)));
    }
    if (a.beard && a.beard !== 'none') {
      const k = beardEdge(d) * (['stubble', 'short'].includes(a.beard) ? 0.6 : ['beard', 'full', 'chinstrap'].includes(a.beard) ? 0.7 : 0.3);
      if (k > 0) tmp.lerp(stubble, k);
    }
    if (['moustache', 'pencil', 'goatee', 'full', 'beard', 'horseshoe', 'vandyke', 'short'].includes(a.beard)) {
      const m = Math.exp(-(((d.y + 0.33) / 0.045) ** 2)) * Math.exp(-((d.x / 0.24) ** 4)) * smooth(0.8, 0.9, d.z);
      tmp.lerp(hair, Math.min(0.9, m * 0.9));
    }
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  base.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  base.computeVertexNormals();
  const normals = base.attributes.normal;

  /** Coque : triangles de la zone pred, décollés de offset (m) le long de la normale. */
  const shell = (pred, offset, { lift = 0, topBoost = 0, soft = true, offFn = null } = {}) => {
    const g = new THREE.BufferGeometry();
    const P2 = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const d = dirs[i];
      let off = offset + topBoost * Math.max(0, d.y) ** 2 + lift * Math.max(0, d.z) * Math.max(0, d.y);
      if (offFn) off += offFn(d);
      if (soft) { const f = frac(pred, d); off *= f * f; }
      P2[i * 3] = pos.getX(i) + normals.getX(i) * off;
      P2[i * 3 + 1] = pos.getY(i) + normals.getY(i) * off;
      P2[i * 3 + 2] = pos.getZ(i) + normals.getZ(i) * off;
    }
    const idx = base.index.array, keep = [];
    for (let t = 0; t < idx.length; t += 3) {
      if (pred(dirs[idx[t]]) && pred(dirs[idx[t + 1]]) && pred(dirs[idx[t + 2]])) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    g.setAttribute('position', new THREE.BufferAttribute(P2, 3));
    g.setAttribute('uv', base.attributes.uv.clone());
    g.setIndex(keep.length ? keep : [0, 0, 0]);
    g.computeVertexNormals();
    return g;
  };
  return { head: base, shell, eye: shape(new THREE.Vector3(0.34, 0.11, 0.93).normalize(), p), at: (x, y, z) => shape(new THREE.Vector3(x, y, z).normalize(), p) };
}
