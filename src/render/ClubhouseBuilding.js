// ============================================================================
//  Club-house du club du joueur (carrière) : un vrai bâtiment avec un intérieur.
//  Plan (repère local, porte d'entrée au centre de la façade, z = 0, on entre vers +z) :
//
//      x : -12 ........ -4 | -4 ........ 4 | 4 ........ 12
//   z 16 +----------------+---------------+---------------+
//        |  SALLE DES     |    BUREAU     |  SALLE DE     |
//        |  TROPHÉES      |  (staff, club,|  MUSCULATION  |
//      8 +------ porte ---+-- classement)-+---- porte ----+
//        |   BOUTIQUE     |  HALL-BUVETTE |  VESTIAIRES   |
//        |                |   (comptoir)  |  (casiers,    |
//      0 +----------------+---- PORTE ----+   douches)----+
//
//  Exporte buildClubhouse(opts) -> { group, rooms, spots } : réutilisable pour les cinématiques.
// ============================================================================
import * as THREE from 'three';
import { makeTrophy } from '../entities/Trophy.js';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });
const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();

function box(g, w, h, d, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = false; m.receiveShadow = true;
  g.add(m); return m;
}
function cyl(g, r1, r2, h, mat, x, y, z, seg = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
  m.position.set(x, y, z); m.receiveShadow = true; g.add(m); return m;
}
/** Panneau texte (canvas) posé à plat sur un mur. */
function panel(g, lines, { w = 2, h = 1, bg = '#123f86', fg = '#ffffff', size = 60, x = 0, y = 2, z = 0, ry = 0, font = 'bold' } = {}) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const L = Array.isArray(lines) ? lines : [lines];
  L.forEach((t, i) => { const s = typeof t === 'object' ? t.size : size; ctx.font = `${font} ${s}px sans-serif`; ctx.fillText(typeof t === 'object' ? t.text : t, c.width / 2, (c.height * (i + 1)) / (L.length + 1)); });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }));
  m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m;
}

/**
 * @param o { name, trophies:[{name,tier,venue,kind,metal,size,season}], player:{name,number}, next:{opp,round,tournament}, rank, money }
 */
export function buildClubhouse(o = {}) {
  const g = new THREE.Group();
  const H = 3.4, T = 0.2;                                   // hauteur sous plafond, épaisseur des murs
  const wallMat = M(0xd9d0bf, { roughness: 0.9 }), wallOut = M(0xd9c7a3, { roughness: 0.95 });
  const wood = M(0x8a5a35, { roughness: 0.6 }), dark = M(0x2b2b30, { roughness: 0.5 }), metal = M(0xb8bfc6, { metalness: 0.8, roughness: 0.3 });
  // --- sols par pièce
  const floor = (w, d, x, z, mat) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); f.rotation.x = -Math.PI / 2; f.position.set(x, 0.015, z); f.receiveShadow = true; g.add(f); };
  floor(8, 8, 0, 4, M(0x9c6b43, { roughness: 0.55 }));       // hall : parquet
  floor(8, 8, -8, 4, M(0xd8d2c8, { roughness: 0.4 }));       // boutique : carrelage clair
  floor(8, 8, 8, 4, M(0x5f7d8c, { roughness: 0.6 }));        // vestiaires : carrelage bleu
  floor(8, 8, -8, 12, M(0x3b2a20, { roughness: 0.4 }));      // trophées : bois sombre
  floor(8, 8, 0, 12, M(0x8f8f8f, { roughness: 0.8 }));       // bureau : moquette grise
  floor(8, 8, 8, 12, M(0x222428, { roughness: 0.95 }));      // muscu : sol caoutchouc
  // plafond (ne projette pas d'ombre : l'intérieur est éclairé par ses lampes)
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(24.4, 16.4), M(0xfafafa, { side: THREE.DoubleSide }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, 8); g.add(ceil);
  // toit vu de l'extérieur
  const roof = box(g, 25, 0.3, 17, M(0xa0523b, { roughness: 0.8 }), 0, H + 0.15, 8); roof.castShadow = false;
  // --- murs : extérieurs (avec porte d'entrée et fenêtres) et cloisons avec passages
  const wall = (x0, z0, x1, z1, gaps = [], h = H, mat = wallMat) => {
    // segment le long de x ou de z, avec ouvertures [centre, largeur]
    const alongX = z0 === z1, L = alongX ? x1 - x0 : z1 - z0;
    const cuts = [...gaps].sort((a, b) => a[0] - b[0]);
    let s = 0;
    const seg = (a, b) => { if (b - a < 0.05) return; const c = (a + b) / 2; alongX ? box(g, b - a, h, T, mat, x0 + c, h / 2, z0) : box(g, T, h, b - a, mat, x0, h / 2, z0 + c); };
    for (const [c, w] of cuts) { seg(s, c - w / 2); const top = h - 2.3; if (top > 0) (alongX ? box(g, w, top, T, mat, x0 + c, 2.3 + top / 2, z0) : box(g, T, top, w, mat, x0, 2.3 + top / 2, z0 + c)); s = c + w / 2; }
    seg(s, L);
  };
  wall(-12, 0, 12, 0, [[12, 2.2], [4, 2.4], [20, 2.4]], H, wallOut);   // façade : porte + deux vitrines
  wall(-12, 16, 12, 16, [], H, wallOut);
  wall(-12, 0, -12, 16, [], H, wallOut);
  wall(12, 0, 12, 16, [], H, wallOut);
  wall(-4, 0, -4, 8, [[4, 2.2]]); wall(4, 0, 4, 8, [[4, 2.2]]);           // hall <-> boutique / vestiaires
  wall(-12, 8, -4, 8, [[4, 1.8]]); wall(4, 8, 12, 8, [[4, 1.8]]);          // boutique -> trophées ; vestiaires -> muscu
  wall(-4, 8, 4, 8, [[4, 2.0]]);                                           // hall -> bureau
  wall(-4, 8, -4, 16, []); wall(4, 8, 4, 16, []);
  // vitres des vitrines de façade
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfe6f0, transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.1 });
  for (const x of [-8, 8]) { const v = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.1), glass); v.position.set(x, 1.15, 0); g.add(v); }
  // enseigne au-dessus de l'entrée
  panel(g, [(o.name || 'MON CLUB').toUpperCase()], { w: 6, h: 0.8, bg: '#0b2a5b', fg: '#ffd400', size: 90, x: 0, y: H - 0.45, z: -0.12, ry: Math.PI });
  // lampes : quelques points lumineux chauds + dalles émissives
  for (const [x, z] of [[0, 4], [-8, 4], [8, 4], [-8, 12], [0, 12], [8, 12]]) {
    const l = new THREE.PointLight(0xffe2b8, 4.5, 10, 1.6); l.position.set(x, H - 0.3, z); g.add(l);
    box(g, 1.2, 0.04, 1.2, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d8, emissiveIntensity: 0.8 }), x, H - 0.03, z);
  }
  const rooms = {};

  // ======================= HALL - BUVETTE
  rooms.hall = { x: 0, z: 4 };
  box(g, 5.2, 1.08, 0.7, wood, 0, 0.54, 6.6);                               // comptoir
  box(g, 5.4, 0.06, 0.85, M(0x2a1a12, { roughness: 0.3 }), 0, 1.11, 6.6);
  box(g, 5.6, 2.2, 0.3, M(0x3a2a20), 0, 1.6, 7.75);                          // étagères du fond
  for (let i = 0; i < 18; i++) cyl(g, 0.04, 0.045, 0.3, M([0x2e7d32, 0x8d6e63, 0xc62828, 0xe0c36a][i % 4], { roughness: 0.15, transparent: true, opacity: 0.85 }), -2.5 + (i % 9) * 0.62, i < 9 ? 1.35 : 2.0, 7.55, 10);
  for (let i = 0; i < 3; i++) { cyl(g, 0.03, 0.03, 0.35, metal, -0.6 + i * 0.6, 1.3, 6.45); }     // tireuses à bière
  for (let i = 0; i < 6; i++) { cyl(g, 0.2, 0.2, 0.05, dark, -2.3 + i * 0.92, 0.75, 5.85); cyl(g, 0.03, 0.03, 0.72, metal, -2.3 + i * 0.92, 0.37, 5.85, 8); }   // tabourets
  for (const [x, z] of [[-2.4, 2.4], [2.4, 2.4], [-2.4, 4.2], [2.4, 4.2]]) {   // tables hautes
    cyl(g, 0.45, 0.45, 0.05, M(0xf5f0e6), x, 1.05, z); cyl(g, 0.05, 0.05, 1.05, dark, x, 0.52, z, 8);
    for (let k = 0; k < 2; k++) cyl(g, 0.035, 0.03, 0.15, M(0xd99a1c, { roughness: 0.15, transparent: true, opacity: 0.8 }), x - 0.15 + k * 0.3, 1.15, z);
  }
  box(g, 2.2, 1.25, 0.08, M(0x111111, { roughness: 0.2 }), -3.85, 2.15, 4, Math.PI / 2);   // télé
  panel(g, ['PADEL TV', { text: 'Tapia / Coello · finale', size: 60 }], { w: 2, h: 1.1, bg: '#0c3b74', size: 110, x: -3.8, y: 2.15, z: 4, ry: Math.PI / 2 });
  panel(g, ['LE BAR DE DÉDÉ', { text: 'Sirop menthe 2 €', size: 54 }, { text: 'Bière (après le match) 4 €', size: 54 }, { text: 'Crêpe 3 €', size: 54 }], { w: 1.6, h: 1.4, bg: '#1d1d1d', fg: '#f5f5f5', size: 70, x: 3.85, y: 2.0, z: 4, ry: -Math.PI / 2, font: 'bold' });
  // ======================= BOUTIQUE
  rooms.shop = { x: -8, z: 4 };
  box(g, 7.6, 2.4, 0.4, M(0xffffff), -8, 1.2, 0.35);                         // mur de raquettes (côté façade)
  const rackCol = [0xe53935, 0x1e88e5, 0xffc107, 0x43a047, 0x8e24aa, 0x111111, 0xff7043, 0x00acc1];
  for (let r = 0; r < 3; r++) for (let i = 0; i < 8; i++) {
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.025, 18), M(rackCol[(i + r * 3) % 8], { roughness: 0.35, metalness: 0.2 }));
    head.rotation.x = Math.PI / 2; head.scale.set(1, 1, 1.25); head.position.set(-11.2 + i * 0.9, 0.75 + r * 0.6, 0.6); g.add(head);
    cyl(g, 0.018, 0.02, 0.18, dark, -11.2 + i * 0.9, 0.52 + r * 0.6, 0.6, 8);
  }
  for (let r = 0; r < 4; r++) box(g, 0.45, 0.05, 2.6, wood, -11.6, 0.4 + r * 0.45, 4);   // étagère à chaussures (mur gauche)
  for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) box(g, 0.3, 0.12, 0.14, M(rackCol[(r + i) % 8]), -11.55, 0.49 + r * 0.45, 2.95 + i * 0.52);
  for (const z of [3.2, 5.4]) {                                             // portants de maillots
    box(g, 0.04, 1.6, 0.04, metal, -7.2, 0.8, z - 0.9); box(g, 0.04, 1.6, 0.04, metal, -7.2, 0.8, z + 0.9); box(g, 0.04, 0.04, 1.8, metal, -7.2, 1.6, z);
    for (let i = 0; i < 7; i++) box(g, 0.5, 0.65, 0.03, M(rackCol[(i * 3 + (z > 4 ? 1 : 0)) % 8], { roughness: 0.9 }), -7.2, 1.2, z - 0.75 + i * 0.25, Math.PI / 2);
  }
  box(g, 1.8, 1.0, 0.6, M(0xf2f2f2), -6.2, 0.5, 7.2);                        // caisse
  box(g, 0.4, 0.3, 0.3, dark, -6.6, 1.15, 7.2);
  panel(g, ['BOUTIQUE', { text: 'Raquettes · chaussures · tenues', size: 50 }], { w: 2.6, h: 0.8, bg: '#c62828', size: 100, x: -8, y: 2.85, z: 7.85, ry: Math.PI });
  // ======================= VESTIAIRES
  rooms.locker = { x: 8, z: 4 };
  for (let i = 0; i < 9; i++) {                                              // rangée de casiers (mur de façade)
    const mine = i === 4;
    box(g, 0.78, 2.0, 0.5, M(mine ? 0x1565c0 : 0x546e7a, { metalness: 0.4, roughness: 0.4 }), 4.6 + i * 0.82, 1.0, 0.4);
    for (let k = 0; k < 3; k++) box(g, 0.5, 0.02, 0.01, dark, 4.6 + i * 0.82, 1.6 + k * 0.06, 0.66);
    if (mine) panel(g, [`${(o.player?.name || 'MOI').toUpperCase()}`, `${o.player?.number ?? 10}`], { w: 0.6, h: 0.45, bg: '#ffd400', fg: '#0b2a5b', size: 150, x: 4.6 + i * 0.82, y: 1.25, z: 0.66, ry: 0 });
  }
  box(g, 5, 0.45, 0.45, wood, 8, 0.23, 2.2);                                 // bancs
  box(g, 5, 0.45, 0.45, wood, 8, 0.23, 4.6);
  for (let i = 0; i < 3; i++) { const t = box(g, 0.7, 0.05, 0.5, M([0xffffff, 0x1e88e5, 0xffd400][i]), 6.2 + i * 1.8, 0.48, 4.6); t.rotation.z = 0.1; }   // serviettes
  box(g, 2.6, 2.6, 0.06, M(0x9ec7d6, { roughness: 0.2 }), 11.85, 1.3, 6.4, Math.PI / 2);   // douches : carrelage
  for (const z of [5.6, 7.2]) { cyl(g, 0.02, 0.02, 0.5, metal, 11.55, 2.3, z, 6); cyl(g, 0.09, 0.05, 0.05, metal, 11.35, 2.1, z); }
  // tableau tactique : le prochain adversaire
  const nx = o.next;
  panel(g, nx ? ['PROCHAIN MATCH', { text: nx.round || '', size: 60 }, { text: `contre ${nx.opp}`, size: 64 }, { text: nx.tournament || '', size: 52 }] : ['TABLEAU', { text: 'Pas de match prévu', size: 64 }, { text: 'Inscris-toi à un tournoi', size: 56 }], { w: 2.4, h: 1.5, bg: '#f5f5f5', fg: '#1a1a1a', size: 80, x: 4.12, y: 1.8, z: 4.6, ry: Math.PI / 2 });
  box(g, 0.9, 1.8, 0.04, M(0xdfe9ef, { metalness: 1, roughness: 0.05 }), 11.88, 1.4, 2.8, -Math.PI / 2);   // miroir
  // ======================= SALLE DES TROPHÉES
  rooms.trophy = { x: -8, z: 12 };
  const tro = o.trophies || [];
  const slots = [];
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) slots.push([-11.2 + c * 0.0, 0.95 + r * 0.62, 9.6 + c * 2.2 + k * 0.6]);
  for (let c = 0; c < 3; c++) {                                              // trois vitrines contre le mur gauche
    const z = 10.2 + c * 2.2;
    box(g, 0.12, 2.2, 2.0, M(0x2a1a12), -11.84, 1.1, z);                     // fond de vitrine
    for (const dz of [-1, 1]) box(g, 0.6, 2.2, 0.06, M(0x2a1a12), -11.55, 1.1, z + dz);
    box(g, 0.6, 0.08, 2.0, M(0x2a1a12), -11.55, 2.2, z);
    for (let r = 0; r < 3; r++) box(g, 0.55, 0.03, 1.9, M(0xffffff, { roughness: 0.2, transparent: true, opacity: 0.6 }), -11.35, 0.92 + r * 0.62, z);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), glass); gl.position.set(-11.05, 1.2, z); gl.rotation.y = Math.PI / 2; g.add(gl);
    const spot = new THREE.PointLight(0xfff6e0, 2.5, 3, 2); spot.position.set(-11.0, 2.4, z); g.add(spot);
  }
  tro.slice(-27).forEach((t, i) => {
    const c = Math.floor(i / 9), r = Math.floor((i % 9) / 3), k = i % 3;
    const m = makeTrophy({ kind: t.kind || 'cup', metal: t.metal || 'silver', size: Math.min(1.1, (t.size || 0.5)) * 0.75 });
    m.position.set(-11.5, 0.95 + r * 0.62, 10.2 + c * 2.2 - 0.6 + k * 0.6); m.rotation.y = Math.PI / 2;
    g.add(m);
  });
  panel(g, ['SALLE DES TROPHÉES', { text: tro.length ? `${tro.length} titre${tro.length > 1 ? 's' : ''} remporté${tro.length > 1 ? 's' : ''}` : 'Les vitrines attendent ton premier titre', size: 50 }], { w: 3.2, h: 0.9, bg: '#3e2723', fg: '#ffd54f', size: 80, x: -8, y: 2.6, z: 15.85, ry: Math.PI });
  // derniers titres en cadres sur le mur de droite de la pièce
  tro.slice(-4).forEach((t, i) => panel(g, [t.name, { text: `Saison ${t.season ?? ''}`, size: 50 }], { w: 1.3, h: 0.9, bg: '#f4ead2', fg: '#3e2723', size: 64, x: -4.12, y: 1.7, z: 9.6 + i * 1.6, ry: -Math.PI / 2 }));
  // ======================= BUREAU
  rooms.office = { x: 0, z: 12 };
  box(g, 2.2, 0.76, 1.0, wood, 0, 0.38, 13.8);
  box(g, 0.55, 0.35, 0.03, dark, 0, 0.95, 14.0);
  box(g, 0.6, 1.0, 0.6, dark, 0, 0.5, 15.0);
  box(g, 1.2, 1.9, 0.4, M(0x6d4c41), -3.2, 0.95, 15.6);                       // armoire à dossiers
  panel(g, ['CLASSEMENT MONDIAL', { text: o.rank ? `Ton rang : n° ${o.rank}` : '', size: 70 }, { text: o.money != null ? `Budget : ${Math.round(o.money).toLocaleString('fr-FR')} €` : '', size: 56 }], { w: 2.6, h: 1.4, bg: '#0d47a1', size: 74, x: 0, y: 2.1, z: 15.85, ry: Math.PI });
  // ======================= MUSCULATION
  rooms.gym = { x: 8, z: 12 };
  box(g, 0.8, 1.2, 1.8, dark, 5.2, 0.6, 14.6);                                // tapis de course
  box(g, 0.7, 0.08, 1.6, M(0x333333), 5.2, 0.15, 13.4);
  box(g, 1.4, 0.45, 0.45, M(0x263238), 8, 0.3, 12);                          // banc de développé
  const bar = cyl(g, 0.02, 0.02, 1.7, metal, 8, 1.05, 11.7, 8); bar.rotation.z = Math.PI / 2;
  for (const x of [7.2, 8.8]) { const d = cyl(g, 0.22, 0.22, 0.08, dark, x, 1.05, 11.7); d.rotation.z = Math.PI / 2; }
  box(g, 2.4, 0.06, 0.5, metal, 10.6, 0.6, 14.8);                              // râtelier d'haltères
  for (let i = 0; i < 6; i++) { const h = cyl(g, 0.06, 0.06, 0.28, dark, 9.6 + i * 0.4, 0.7, 14.8, 10); h.rotation.z = Math.PI / 2; }
  for (const z of [10, 11.4]) box(g, 1.2, 0.03, 0.6, M(0x1e88e5), 10.8, 0.03, z);   // tapis de sol
  box(g, 3.2, 2.0, 0.04, M(0xdfe9ef, { metalness: 1, roughness: 0.05 }), 8, 1.3, 15.85);   // mur miroir
  return { group: g, rooms };
}
