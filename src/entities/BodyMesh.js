// ============================================================================
//  Corps « skinné » : une peau continue qui se déforme aux articulations.
//  Chaque partie (torse, cou, bras, jambes, vêtements) est une surface balayée
//  le long d'un segment, avec des sections elliptiques et un profil musculaire,
//  pondérée sur deux os autour des articulations (genou, coude, épaule, hanche)
//  pour plier en douceur. Les morceaux sont fusionnés par matériau en quelques
//  SkinnedMesh qui partagent le squelette de l'avatar.
//  Mains (avec doigts) et chaussures sont des pièces rigides attachées aux os.
// ============================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const gs = (t, m, w) => Math.exp(-(((t - m) / w) ** 2));
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Interpolation douce d'une table [[t, ...valeurs]]. */
function profile(table, t) {
  if (t <= table[0][0]) return table[0].slice(1);
  for (let i = 1; i < table.length; i++) {
    if (t <= table[i][0]) {
      const [t0, ...a] = table[i - 1], [t1, ...b] = table[i];
      const k = smooth(0, 1, (t - t0) / (t1 - t0));
      return a.map((v, j) => v + (b[j] - v) * k);
    }
  }
  return table[table.length - 1].slice(1);
}

/**
 * Surface balayée de A à B (coordonnées « monde au repos »).
 *  u, v : axes de la section (u = largeur, v = profondeur, v vers l'avant)
 *  sec(t) -> [w, dFront, dBack, vOffset, uOffset]
 *  weights(t, ang) -> [[os, poids], ...]
 */
function sweep({ A, B, u, v, sec, weights, cuts = 14, ring = 18, t0 = 0, t1 = 1, detail = null }) {
  const pos = [], idx = [], si = [], sw = [], uvs = [];
  const axis = new THREE.Vector3().subVectors(B, A);
  // sens des faces selon l'orientation du repère de section
  const flip = new THREE.Vector3().crossVectors(u, v).dot(axis) < 0;
  const p = new THREE.Vector3();
  for (let i = 0; i <= cuts; i++) {
    const t = t0 + ((t1 - t0) * i) / cuts;
    const [w, df, db, vo = 0, uo = 0] = sec(t);
    for (let j = 0; j < ring; j++) {
      const ang = (j / ring) * Math.PI * 2;
      const c = Math.cos(ang), s = Math.sin(ang);
      const d = s >= 0 ? df : db;
      // relief musculaire : décalage radial (c : côté u, s : côté v / avant)
      const dd = detail ? detail(t, c, s) : 0;
      p.copy(A).addScaledVector(axis, t).addScaledVector(u, (w + dd) * c + uo).addScaledVector(v, (d + dd) * s + vo);
      pos.push(p.x, p.y, p.z);
      uvs.push(j / ring, t * axis.length() * 3);
      const ws = weights(t, ang).filter((x) => x[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const tot = ws.reduce((q, x) => q + x[1], 0) || 1;
      for (let k = 0; k < 4; k++) { si.push(ws[k] ? ws[k][0] : 0); sw.push(ws[k] ? ws[k][1] / tot : 0); }
    }
  }
  for (let i = 0; i < cuts; i++) {
    for (let j = 0; j < ring; j++) {
      const a = i * ring + j, b = i * ring + ((j + 1) % ring), c = a + ring, d = b + ring;
      if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  }
  // bouchons aux extrémités (ramenés au centre)
  for (const end of [0, cuts]) {
    const t = t0 + ((t1 - t0) * end) / cuts;
    const [, , , vo = 0, uo = 0] = sec(t);
    p.copy(A).addScaledVector(axis, t).addScaledVector(u, uo).addScaledVector(v, vo);
    const ci = pos.length / 3;
    pos.push(p.x, p.y, p.z);
    uvs.push(0.5, t * axis.length() * 3);
    const base = end * ring;
    for (let k = 0; k < 4; k++) { si.push(si[base * 4 + k]); sw.push(sw[base * 4 + k]); }
    for (let j = 0; j < ring; j++) {
      const a = base + j, b = base + ((j + 1) % ring);
      if ((end === 0) !== flip) idx.push(ci, b, a); else idx.push(ci, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return g;
}

/** Transforme une géométrie rigide en morceau skinné attaché à un seul os. */
function rigid(geo, boneIdx, matrix) {
  const g = geo.index ? geo : geo;
  g.applyMatrix4(matrix);
  const n = g.attributes.position.count;
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 === 0 ? boneIdx : 0)), 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}

/**
 * Construit le corps skinné de l'avatar. av : Avatar (os déjà créés, au repos).
 * Renvoie la liste des SkinnedMesh créés (déjà attachés à av.body).
 */
export function buildSkinnedBody(av, mat, a) {
  const B = a.build, BL = a.belly, MU = a.muscle || 0, LB = 1 + BL * 0.16 + MU * 0.22;
  const fem = !!a.female, CV = fem ? (a.curvy || 0) : 0;   // CV : silhouette plus marquée (poitrine, hanches, fessier)
  // --- squelette (pose de repos : toutes les rotations à zéro)
  const bones = [av.body, av.pelvis, av.spine, av.chest, av.head, av.lShoulder, av.lElbow, av.rShoulder, av.rElbow];
  for (const L of av.legs) bones.push(L.hip, L.knee, L.ankle);
  const I = new Map(bones.map((b, i) => [b, i]));
  const mirror = av.body.scale.x;
  av.body.scale.x = 1;
  const rootScale = av.root.scale.x;
  av.root.scale.setScalar(1);
  av.root.updateMatrixWorld(true);
  const W = (bone, x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z).applyMatrix4(bone.matrixWorld);
  const pieces = new Map();       // matériau -> géométries
  const add = (m, g) => { if (!pieces.has(m)) pieces.set(m, []); pieces.get(m).push(g); };
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  const NX = new THREE.Vector3(-1, 0, 0), NY = new THREE.Vector3(0, -1, 0);

  // ------------------------------------------------------------- torse et cou
  // section du tronc selon la hauteur (repère du bassin) : [y, demi-largeur, profondeur avant, arrière, décalage avant]
  const belly = BL * 0.07;
  const torsoTable = [
    [-0.15, 0.06, 0.05, 0.05, 0],
    [-0.11, 0.14 * B, 0.085, 0.1, 0],
    [-0.03, 0.165 * B + CV * 0.03, 0.1 + belly * 0.5, 0.115 + CV * 0.035, 0],
    [0.06, 0.152 * B + BL * 0.03 + CV * 0.02, 0.098 + belly, 0.1 + CV * 0.02, 0.004],
    [0.17, 0.142 * B + BL * 0.035 - CV * 0.018, 0.1 + belly * 1.1 - CV * 0.012, 0.092, 0.008],
    [0.27, (fem ? 0.15 : 0.158) * B + BL * 0.025, 0.108 + belly * 0.6 + (fem ? 0.01 : 0), 0.098, 0.006],
    [0.37, (fem ? 0.165 : 0.185) * B + BL * 0.02 + MU * 0.02, 0.118 + belly * 0.3 + (fem ? 0.035 + CV * 0.035 : 0.008) + MU * 0.02, 0.105, 0.008],
    [0.45, (fem ? 0.17 : 0.198) * B + MU * 0.03, 0.105 + MU * 0.012, 0.1, 0.004],
    [0.51, (fem ? 0.155 : 0.175) * B, 0.085, 0.085, 0],
    [0.54, 0.105, 0.07, 0.075, -0.006],
    [0.6, 0.07 + BL * 0.012, 0.064, 0.066, -0.01],
  ];
  const P0 = W(av.pelvis);
  const torsoW = (y) => {
    // bassin -> colonne -> poitrine, puis tête en haut du cou
    const pel = 1 - smooth(0.0, 0.14, y), che = smooth(0.2, 0.33, y), hd = smooth(0.58, 0.68, y);
    const spi = Math.max(0, 1 - pel - che);
    return [[I.get(av.pelvis), pel], [I.get(av.spine), spi * (1 - hd)], [I.get(av.chest), che * (1 - hd)], [I.get(av.head), hd]];
  };
  const torsoSec = (inflate) => (t) => {
    const y = -0.15 + t * 0.74;
    const [w, df, db, vo] = profile(torsoTable, y);
    return [w + inflate, df + inflate, db + inflate, vo];
  };
  const tA = P0.clone().add(new THREE.Vector3(0, -0.15, 0)), tB = P0.clone().add(new THREE.Vector3(0, 0.59, 0));
  const torsoWeights = (t) => torsoW(-0.15 + t * 0.74);
  // peau (cou + haut des épaules), short, maillot
  add(mat.skin, sweep({ A: tA, B: tB, u: X, v: Z, sec: torsoSec(0), weights: torsoWeights, cuts: 30, ring: 28, t0: 0.62, t1: 1.08 }));
  if (!a.skirt) add(mat.shorts, sweep({ A: tA, B: tB, u: X, v: Z, sec: torsoSec(0.012), weights: torsoWeights, cuts: 10, ring: 28, t0: 0.0, t1: 0.3 }));
  add(mat.shirt, sweep({ A: tA, B: tB, u: X, v: Z, sec: (t) => { const q = torsoSec(0.009)(t); const y = -0.15 + t * 0.74, f = 0.012 * Math.exp(-(((y - 0.46) / 0.06) ** 2)); return [q[0] + f, q[1] + f * 0.4, q[2] + f * 0.4, q[3]]; }, weights: torsoWeights, cuts: 40, ring: 36, t0: 0.16, t1: 0.95, detail: (t, c, sn) => 0.0028 * Math.sin(t * 95 + c * 2.5 + sn) * gs(t, 0.42, 0.1) * (0.5 + 0.5 * Math.abs(c)) + 0.002 * Math.sin(Math.atan2(sn, c) * 9) * gs(t, 0.3, 0.06) }));
  // col du maillot
  const collar = new THREE.TorusGeometry(0.068 + BL * 0.012, 0.008, 8, 32).rotateX(Math.PI / 2 - 0.22).scale(1.12, 1, 0.98);
  const CW = W(av.chest, 0, 0.275, -0.004);
  add(mat.accent, rigid(collar, I.get(av.chest), new THREE.Matrix4().makeTranslation(CW.x, CW.y, CW.z)));

  // ------------------------------------------------------------- jambes
  for (const L of av.legs) {
    const H = W(L.hip), K = W(L.knee), A = W(L.ankle);
    const hip = I.get(L.hip), knee = I.get(L.knee), ankle = I.get(L.ankle), pel = I.get(av.pelvis);
    const thighSec = (inf) => (t) => {
      const [w, df, db] = profile([
        [-0.12, 0.07, 0.07, 0.07], [0.05, 0.096 * B * LB, 0.098 * LB, 0.092 * LB], [0.35, 0.086 * B * LB, 0.092 * LB, 0.08 * LB],
        [0.75, 0.066 * B * LB, 0.07 * LB, 0.06 * LB], [0.95, 0.055 * B, 0.058, 0.052], [1.08, 0.04, 0.04, 0.04],
      ], t);
      return [w + inf, df + inf, db + inf, t > 0.75 ? (t - 0.75) * 0.03 : 0, L.sx * (t < 0.1 ? 0.012 * (0.1 - t) : 0)];
    };
    const thighW = (t) => [[pel, 1 - smooth(-0.05, 0.16, t)], [hip, smooth(-0.05, 0.16, t) * (1 - smooth(0.86, 1.05, t))], [knee, smooth(0.86, 1.05, t)]];
    // cuisse : vaste interne (goutte au-dessus du genou), droit fémoral, rotule
    const MD = 0.7 + MU * 0.8 - BL * 0.3;
    const thighD = (t, c, sn) => MD * (0.011 * gs(t, 0.8, 0.1) * Math.max(0, sn) * Math.max(0, -c * L.sx) + 0.006 * gs(t, 0.45, 0.2) * Math.max(0, sn) ** 2
      + 0.005 * gs(t, 0.4, 0.25) * Math.max(0, c * L.sx)) + 0.007 * gs(t, 0.98, 0.05) * Math.max(0, sn) ** 4;
    add(mat.skin, sweep({ A: H, B: K, u: X, v: Z, sec: thighSec(0), weights: thighW, t0: 0.28, t1: 1.08, cuts: 22, ring: 22, detail: thighD }));
    if (!a.skirt) {
      // short ample, ourlet en léger évasement
      add(mat.shorts, sweep({ A: H, B: K, u: X, v: Z, sec: (t) => { const s = thighSec(0.016)(t); const f = smooth(0.25, 0.42, t) * 0.012; return [s[0] + f, s[1] + f, s[2] + f, 0, s[4]]; }, weights: thighW, t0: -0.12, t1: 0.44, cuts: 10 }));
    }
    const shinSec = (inf) => (t) => {
      const [w, df, db, vo] = profile([
        [-0.1, 0.05, 0.052, 0.05, 0], [0.05, 0.055 * B, 0.054, 0.056, 0.004], [0.3, 0.062 * B * LB, 0.052, 0.078 * LB, -0.006],
        [0.6, 0.048 * B, 0.042, 0.05, 0], [0.88, 0.034, 0.034, 0.036, 0], [1.04, 0.036, 0.036, 0.038, 0],
      ], t);
      return [w + inf, df + inf, db + inf, vo];
    };
    const shinW = (t) => [[hip, 1 - smooth(-0.06, 0.12, t)], [knee, smooth(-0.06, 0.12, t) * (1 - smooth(0.9, 1.04, t))], [ankle, smooth(0.9, 1.04, t)]];
    // mollet : deux chefs du gastrocnémien (l'interne plus bas et plus gros), tibia saillant devant, tendon d'Achille
    const shinD = (t, c, sn) => MD * (0.013 * gs(t, 0.3, 0.13) * Math.max(0, -sn) * (0.7 + 0.5 * Math.max(0, -c * L.sx)) + 0.006 * gs(t, 0.24, 0.1) * Math.max(0, -sn) * Math.max(0, c * L.sx))
      + 0.003 * gs(t, 0.4, 0.3) * Math.max(0, sn) ** 8 - 0.006 * gs(t, 0.82, 0.08) * Math.max(0, -sn) * Math.abs(c) + 0.004 * gs(t, 0.97, 0.04) * Math.abs(c) ** 6;
    add(mat.skin, sweep({ A: K, B: A, u: X, v: Z, sec: shinSec(0), weights: shinW, t0: -0.08, t1: 1.02, cuts: 24, ring: 22, detail: shinD }));
    add(mat.sock, sweep({ A: K, B: A, u: X, v: Z, sec: shinSec(0.004), weights: shinW, t0: 0.74, t1: 1.06, cuts: 6 }));
    // chaussure modelée
    buildShoe(add, mat, ankle, A);
  }

  // ------------------------------------------------------------- bras
  const arm = (sh, el, dir, sideAxis, frontAxis, isRight) => {
    const S = W(sh), E = W(el);
    const handEnd = W(el, ...dir.clone().multiplyScalar(0.25).toArray());
    const ch = I.get(av.chest), s = I.get(sh), e = I.get(el);
    const upperSec = (inf) => (t) => {
      const [w, df, db] = profile([
        [-0.15, 0.048 * B, 0.05, 0.05], [0.04, 0.058 * B * LB, 0.058, 0.056], [0.25, 0.054 * B * LB, 0.058 * LB, 0.05],
        [0.5, 0.05 * B * LB, 0.056 * LB, 0.046], [0.85, 0.042 * B, 0.044, 0.044], [1.05, 0.04, 0.04, 0.042],
      ], t);
      return [w + inf, df + inf, db + inf];
    };
    const upperW = (t) => [[ch, 1 - smooth(-0.15, 0.18, t)], [s, smooth(-0.15, 0.18, t) * (1 - smooth(0.88, 1.06, t))], [e, smooth(0.88, 1.06, t)]];
    // bras : deltoïde arrondi, biceps devant, triceps derrière
    const MA = 0.7 + MU * 0.9 - BL * 0.3;
    const upperD = (t, c, sn) => MA * (0.008 * gs(t, 0.12, 0.14) + 0.009 * gs(t, 0.55, 0.18) * Math.max(0, sn) ** 2 + 0.006 * gs(t, 0.38, 0.2) * Math.max(0, -sn) ** 2);
    add(mat.tattoo || mat.skin, sweep({ A: S, B: E, u: sideAxis, v: frontAxis, sec: upperSec(0), weights: upperW, t0: 0.18, t1: 1.06, cuts: 18, ring: 20, detail: upperD }));
    // manche courte
    // manche : démarre dans l'épaule (épaulement plus gros) pour couvrir la jonction avec le torse
    add(mat.shirt, sweep({ A: S, B: E, u: sideAxis, v: frontAxis, sec: (t) => { const q = upperSec(0.012)(t); const f = smooth(0.2, 0.42, t) * 0.006 + (1 - smooth(-0.12, 0.12, t)) * 0.007; return [q[0] + f, q[1] + f, q[2] + f]; }, weights: upperW, t0: -0.12, t1: 0.44, cuts: 10 }));
    const foreSec = (t) => {
      const [w, df, db] = profile([
        [-0.08, 0.042, 0.042, 0.044], [0.18, 0.046 * B * LB, 0.044 * LB, 0.042], [0.6, 0.036 * B, 0.032, 0.03], [0.92, 0.03, 0.022, 0.02], [1.02, 0.028, 0.02, 0.02],
      ], t);
      return [w, df, db];
    };
    const foreW = (t) => [[s, 1 - smooth(-0.08, 0.1, t)], [e, smooth(-0.08, 0.1, t)]];
    // avant-bras : masse musculaire près du coude, poignet plat, os du poignet
    const foreD = (t, c, sn) => MA * 0.007 * gs(t, 0.22, 0.15) * (0.6 + 0.4 * Math.abs(c)) + 0.002 * gs(t, 0.9, 0.05) * Math.abs(c) ** 6;
    add(mat.tattoo || mat.skin, sweep({ A: E, B: handEnd, u: sideAxis, v: frontAxis, sec: foreSec, weights: foreW, t0: -0.06, t1: 0.98, cuts: 18, ring: 20, detail: foreD }));
    buildHand(add, mat, e, el, dir, isRight, a);
  };
  arm(av.lShoulder, av.lElbow, NY, X, Z, false);
  arm(av.rShoulder, av.rElbow, NX, Y, Z, true);

  // ------------------------------------------------------------- fusion par matériau
  const skeleton = new THREE.Skeleton(bones);
  const meshes = [];
  for (const [m, geos] of pieces) {
    const merged = mergeGeometries(geos.map((g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k); return g.index ? g.toNonIndexed() : g; }));
    const sm = new THREE.SkinnedMesh(merged, m);
    sm.castShadow = sm.receiveShadow = true;
    sm.frustumCulled = false;
    av.body.add(sm);
    av.body.updateMatrixWorld(true);
    sm.bind(skeleton, sm.matrixWorld);
    meshes.push(sm);
  }
  av.root.scale.setScalar(rootScale);
  av.body.scale.x = mirror;
  return meshes;
}

/** Chaussure de padel : semelle arrondie extrudée, tige, bande colorée, lacets. */
function buildShoe(add, mat, boneIdx, A) {
  const M = new THREE.Matrix4().makeTranslation(A.x, A.y, A.z);
  const outline = new THREE.Shape();
  // contour de la semelle (vue de dessus, z vers l'avant)
  outline.moveTo(0, -0.07);
  outline.bezierCurveTo(0.05, -0.075, 0.056, -0.02, 0.054, 0.05);
  outline.bezierCurveTo(0.052, 0.13, 0.03, 0.2, 0.0, 0.205);
  outline.bezierCurveTo(-0.035, 0.2, -0.05, 0.13, -0.05, 0.05);
  outline.bezierCurveTo(-0.052, -0.02, -0.045, -0.075, 0, -0.07);
  const sole = new THREE.ExtrudeGeometry(outline, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 3, curveSegments: 18 });
  sole.rotateX(Math.PI / 2).translate(0, -0.06, 0.035);
  add(mat.sole, rigid(sole, boneIdx, M));
  // tige : volume arrondi qui suit la semelle
  const upper = new THREE.SphereGeometry(1, 24, 16);
  const p = upper.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < -0.2) y = -0.2;                                      // dessous plat
    const zz = z * 0.135 + 0.065, front = Math.max(0, z);
    p.setXYZ(i, x * (0.05 - front * 0.012), y * (0.055 - front * 0.025) - 0.024 - front * 0.008, zz);
  }
  upper.computeVertexNormals();
  add(mat.shoe, rigid(upper, boneIdx, M));
  // bande latérale colorée et lacets
  const band = new THREE.TorusGeometry(0.052, 0.008, 6, 30, Math.PI * 1.1).rotateX(Math.PI / 2).rotateY(Math.PI * 0.45).scale(1, 1, 1.9).translate(0, -0.038, 0.05);
  add(mat.shoeAccent, rigid(band, boneIdx, M));
  for (let k = 0; k < 4; k++) add(mat.sole, rigid(new THREE.BoxGeometry(0.034, 0.005, 0.008).translate(0, 0.008 - k * 0.006, 0.03 + k * 0.022).rotateX(-0.5), boneIdx, M));
}

/** Main avec doigts. Main droite : refermée sur le manche ; gauche : détendue. */
function buildHand(add, mat, boneIdx, elbow, dir, isRight, a) {
  const skin = mat.skin;
  const parts = [];
  // paume
  const palm = new THREE.SphereGeometry(1, 14, 10).scale(0.03, 0.04, 0.014);
  parts.push(palm);
  // doigts (index -> auriculaire) puis pouce
  const fingers = [[-0.018, 0.04, 0.034], [-0.006, 0.045, 0.036], [0.006, 0.042, 0.034], [0.017, 0.036, 0.028]];
  for (const [x, len, base] of fingers) {
    if (isRight) {
      // doigts enroulés autour du manche
      const curl = new THREE.TorusGeometry(0.014, 0.0072, 6, 10, Math.PI * 1.25).rotateY(Math.PI / 2).rotateX(Math.PI * 0.1).translate(x, base, 0.006);
      parts.push(curl);
    } else {
      const f = new THREE.CapsuleGeometry(0.0072, len, 3, 8).translate(0, base + len / 2, 0).rotateX(0.35).translate(x, 0, 0.004);
      parts.push(f);
    }
  }
  const thumb = new THREE.CapsuleGeometry(0.0085, 0.028, 3, 8).rotateZ(-0.6).rotateX(isRight ? 0.9 : 0.4).translate(-0.028, 0.012, 0.016);
  parts.push(thumb);
  let g = mergeGeometries(parts.map((q) => { q.deleteAttribute('uv'); return q.toNonIndexed(); }));
  g.computeVertexNormals();
  // orientation : la main prolonge l'avant-bras (dir), paume tournée vers le corps
  const m = new THREE.Matrix4();
  if (isRight) m.makeRotationZ(Math.PI / 2);       // axe -X
  else m.makeRotationZ(Math.PI);                  // axe -Y
  g.applyMatrix4(m);
  const off = dir.clone().multiplyScalar(0.285);
  const W = new THREE.Vector3(off.x, off.y, off.z).applyMatrix4(elbow.matrixWorld);
  add(skin, rigid(g, boneIdx, new THREE.Matrix4().makeTranslation(W.x, W.y, W.z)));
}
