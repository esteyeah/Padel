// ============================================================================
//  Terrains (lieux) : la coque du court et tout son environnement changent selon
//  le lieu. Chaque lieu définit : couleur du gazon, style des murs (classique
//  à poteaux / panoramique), portes (et jeu à l'extérieur), éclairage, décor.
//
//   municipal  court posé entre des courts de tennis municipaux (petits tournois)
//   ceyreste   club de tennis provençal (évocation : pins, collines calcaires)
//   club       Padel Arena Club (tribune, club-house, courts voisins)
//   national   centre national : tribunes sur trois côtés, écrans
//   pro        arena du circuit mondial : stade fermé, rampes de lumière
// ============================================================================
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { COURT, DOOR, netHeightAt } from '../config.js';
import * as TX from './Textures.js';
import { AmbientMatch } from './AmbientPlay.js';
import { foliage, leafMat } from './Foliage.js';
import { rocks } from './Rocks.js';
import { hedge } from './Foliage.js';
import { Avatar } from '../entities/Avatar.js';
import { makeAppearance, RACKETS } from '../entities/Appearance.js';
import { makeRacketMesh, designById } from '../entities/Racket.js';
import {
  buildSurroundings, canvasTex, grassTex, pavingTex, hedgeTex, at, mesh, scaleUV, Crowd, palmTemplate, neighborCourt as neighborCourtBase,
  frondTex, trunkTex, skylineTex,
} from './Surroundings.js';

const HW = COURT.halfW, HL = COURT.halfL;

export const VENUES = {
  municipal: {
    label: 'Tennis municipal', desc: 'Un court de padel posé entre les courts de tennis de la ville.',
    turf: { base: '#2c6a35', hue: 118, sat: 40, light: 26 }, apron: 0x3a3e44, frame: 0x2f5d3a,
    panoramic: false, doors: true, outside: true, lamps: 'municipal', crowd: 0.1, ambiance: 'day',
    ads: [['TENNIS MUNICIPAL', ['#24502e', '#2f6a3c'], '#ffffff', '#f2c94c'], ['MAIRIE · SPORTS', ['#1b2f5a', '#264a8a'], '#ffffff', '#ffffff']],
  },
  ceyreste: {
    label: 'Padel de Ceyreste', desc: 'AS Tennis Padel Ceyreste : trois courts panoramiques bleus, club-house en contrebas, collines boisées.',
    turf: { base: '#1f56b0', hue: 214, sat: 62, light: 32 }, apron: 0x8f8a80, frame: 0x1f5fbf, wire: 0x2c64c4,
    panoramic: true, blades: 0x2a6cd6, doors: true, outside: true, lamps: 'swan', crowd: 0.2, ambiance: 'day',
    ads: [],
  },
  prestige: {
    label: 'Riviera Padel Palace', desc: 'Un grand complexe de luxe pour les tournois prestigieux : court central entouré de tribunes, loge VIP vitrée, quatre courts annexes sous les palmiers.',
    turf: { base: '#14507f', hue: 206, sat: 66, light: 30 }, apron: 0xe9e4da, frame: 0xf2efe8, wire: 0xd8d2c4,
    panoramic: true, blades: 0xd4a72c, doors: true, outside: true, lamps: 'tower', crowd: 0.95, ambiance: 'night',
    ads: [['RIVIERA PADEL PALACE', ['#0d1b2a', '#1b263b'], '#ffffff', '#d4a72c'], ['GRAND PRIX', ['#1a1408', '#3a2c0c'], '#f5e6b0', '#d4a72c'], ['CHAMPAGNE · LOUNGE', ['#0d1b2a', '#14273d'], '#ffffff', '#d4a72c']],
  },
  laciotat: {
    label: 'Tennis de La Ciotat', desc: 'Quatre courts de padel couleur terre battue au cœur d\'un club de tennis : tonnelles, tribune en gradins jusqu\'au club-house, pins et parking.',
    turf: { base: '#c8643f', hue: 16, sat: 55, light: 48 }, apron: 0xb9a48a, frame: 0x1c1d20, wire: 0x2a2b2f,
    panoramic: false, doors: true, outside: true, lamps: 'municipal', crowd: 0.25, ambiance: 'day',
    ads: [],
  },
  club: {
    label: 'Padel Arena Club', desc: 'Le club du coin : tribune, club-house et courts voisins.',
    turf: {}, apron: 0x1d3b6b, frame: 0x1b1e23,
    panoramic: false, doors: false, outside: false, lamps: 'basic', crowd: 0.6, ambiance: 'night',
    ads: [['PADEL ARENA', ['#0b2a5b', '#123f86'], '#ffffff', '#ffd400'], ['SMASH CLUB', ['#3a0c0c', '#7a1616'], '#ffffff', '#ffffff'], ['GLASS & GRASS', ['#08332b', '#0f5c4c'], '#e9fff8', '#56e3b8'], ['BANDEJA TOUR', ['#1b1b1f', '#33333b'], '#ffd400', '#ffd400']],
  },
  national: {
    label: 'Centre national', desc: 'Court panoramique, tribunes sur trois côtés, jeu à l\'extérieur autorisé.',
    turf: { base: '#1b4f93', hue: 210, sat: 60, light: 30 }, apron: 0x15213a, frame: 0x9aa2ad,
    panoramic: true, doors: true, outside: true, lamps: 'tower', crowd: 0.85, ambiance: 'night',
    ads: [['CHAMPIONNAT NATIONAL', ['#0b2a5b', '#1565c0'], '#ffffff', '#ffd400'], ['PADEL FRANCE TOUR', ['#1a1a1d', '#33333b'], '#ffffff', '#e53935'], ['VIBORA', ['#3a0c3a', '#7b1fa2'], '#ffffff', '#ffd400']],
  },
  pro: {
    label: 'Arena mondiale', desc: 'Le centre court du circuit mondial : stade plein, rampes de lumière.',
    turf: { base: '#1a4fa0', hue: 212, sat: 70, light: 32 }, apron: 0x101a33, frame: 0xc9ced6,
    panoramic: true, doors: true, outside: true, lamps: 'stadium', crowd: 1, ambiance: 'night',
    ads: [['WORLD PADEL MAJOR', ['#0d0d14', '#1a1f3a'], '#ffffff', '#d4a72c'], ['PRO TOUR', ['#0b2a5b', '#1565c0'], '#ffffff', '#ffffff'], ['CHIQUITA', ['#06302a', '#0f7b5f'], '#ffffff', '#b9f6ca'], ['X3 · X4', ['#3a0c0c', '#c62828'], '#ffffff', '#ffd400']],
  },
};
VENUES.beach = {
  label: 'Padel Beach Arena', desc: 'Court central monté sur la plage, tribunes provisoires et vue sur la mer.',
  turf: { base: '#1f5aa8', hue: 210, sat: 64, light: 32 }, apron: 0xd9c39a, frame: 0xe8ecf1, wire: 0xc9d2dc,
  panoramic: true, doors: true, outside: true, lamps: 'tower', crowd: 0.8, ambiance: 'day',
  ads: [['PADEL BEACH ARENA', ['#0d3b5c', '#1580b8'], '#ffffff', '#ffd400'], ['SUMMER TOUR', ['#7a2a10', '#ef6c00'], '#ffffff', '#ffffff'], ['SEA · SUN · PADEL', ['#06302a', '#0f7b5f'], '#ffffff', '#b9f6ca']],
};

/** Courts jouables par lieu (le premier est le court central). Coordonnées dans le décor. */
export const VENUE_COURTS = {
  // [x, z, rotation, gazon] : trois courts bleus en diagonale, le gris en haut à gauche, le bordeaux en bas à droite
  national: [[0, 0], [28, 0]],
  prestige: [[0, 0], [-26, -12.5], [-26, 12.5], [26, -12.5], [26, 12.5]],
  laciotat: [[6.9, -12], [-6.9, -12], [-11.2, 13.2, Math.PI / 2], [11.2, 13.2, Math.PI / 2]],
  ceyreste: [[-13.6, -5.8], [0, 0], [14.1, 6.5], [31.5, 16, Math.PI / 2, { base: '#7a1c26', hue: 355, sat: 58, light: 28 }], [-36, -28, Math.PI / 2, { base: '#45484d', hue: 215, sat: 5, light: 27 }]],
  club: [[0, 0], [-15.5, 0], [17.5, 0]],
  hangar: [[-6.2, -12.5], [6.2, -12.5], [-6.2, 12.5, Math.PI], [6.2, 12.5, Math.PI]],
};
// Mon club (carrière) : emplacements des courts, dans l'ordre de construction
const MYCLUB_SLOTS = [[0, 0], [0, -30], [15.5, -30], [-15.5, -30], [31, -30], [-31, -30], [15.5, -54], [-15.5, -54]];
const courtsOf = (id, club) => (id === 'myclub' ? MYCLUB_SLOTS.slice(0, Math.max(1, club?.courts || 1)) : VENUE_COURTS[id] || [[0, 0]]);
export const courtCount = (id, club) => courtsOf(id, club).length;

VENUES.hangar = {
  label: 'Le Hangar Padel', desc: 'Petit club régional couvert : quatre courts sous un hangar en tôle, buvette au fond.',
  turf: { base: '#2a62b8', hue: 214, sat: 60, light: 33 }, apron: 0x3b3f46, frame: 0x22262c, wire: 0x2c3036,
  panoramic: true, doors: false, outside: false, lamps: 'none', crowd: 0.35, ambiance: 'day', indoor: true,
  ads: [],
};

VENUES.myclub = {
  label: 'Mon club', desc: 'Votre propre club : courts, tribunes et décos achetés en carrière.',
  turf: { base: '#1d5fb8', hue: 213, sat: 64, light: 33 }, apron: 0x22324f, frame: 0x1b1e23, wire: 0x3a3f47,
  panoramic: true, doors: true, outside: true, lamps: 'basic', crowd: 0.7, ambiance: 'night',
  ads: [['MON CLUB', ['#0b2a5b', '#123f86'], '#ffffff', '#ffd400'], ['PADEL CLUB', ['#3a0c0c', '#7a1616'], '#ffffff', '#ffffff'], ['BIENVENUE', ['#08332b', '#0f5c4c'], '#e9fff8', '#56e3b8']],
};

export const VENUE_IDS = Object.keys(VENUES);

// ------------------------------------------------------------------ coque du court
function buildCourtShell(ctx, def, out) {
  const { renderer, glassMat } = ctx;
  const root = out.group;
  const walls = {};
  for (const key of ['back+', 'back-', 'side+', 'side-']) {
    const group = new THREE.Group();
    root.add(group);
    walls[key] = {
      group, opacity: 1,
      wire: new THREE.MeshStandardMaterial({ map: ctx.wireMap, color: def.wire ?? 0x9aa0a8, transparent: true, side: THREE.DoubleSide, metalness: 0.55, roughness: 0.45, depthWrite: false }),
      frame: new THREE.MeshStandardMaterial({ color: def.frame, metalness: 0.65, roughness: 0.4, transparent: true }),
      seam: new THREE.MeshStandardMaterial({ color: 0x0d0f12, roughness: 0.5, transparent: true }),
    };
  }
  out.walls = walls;
  const backKey = (sz) => (sz > 0 ? 'back+' : 'back-');
  const sideKey = (sx) => (sx > 0 ? 'side+' : 'side-');

  // gazon + bordure
  const { map, bump } = TX.makeTurfTextures(renderer, def.turf);
  map.repeat.set(2 * HW / 1.25, 2 * HL / 1.25); bump.repeat.copy(map.repeat);
  out.turfMap = map;
  const turf = new THREE.Mesh(at(new THREE.PlaneGeometry(2 * HW, 2 * HL), 0, 0.006, 0, -Math.PI / 2), new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.2, roughness: 0.92 }));
  turf.receiveShadow = true;
  root.add(turf);
  // usure (seulement sur les terrains très utilisés) : redessinée à chaque partie, à des endroits différents
  if (['beach', 'municipal', 'club'].includes(def.id ?? '') || def.worn) {
    const wear = document.createElement('canvas'); wear.width = 256; wear.height = 512;
    const wearTex = new THREE.CanvasTexture(wear); wearTex.colorSpace = THREE.SRGBColorSpace;
    const draw = () => {
      const g = wear.getContext('2d'), R = Math.random;
      g.clearRect(0, 0, 256, 512);
      const spot = (x, y, rx, ry, a) => { g.save(); g.translate(x, y); g.rotate((R() - 0.5) * 0.6); g.scale(rx, ry); const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, `rgba(222,205,170,${a})`); gr.addColorStop(1, 'rgba(222,205,170,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, 7); g.fill(); g.restore(); };
      // quelques zones, tirées au hasard autour des endroits joués (fond, service, filet)
      const zones = [[40, 0.24], [472, 0.24], [175, 0.1], [337, 0.1], [228, 0.06], [284, 0.06]];
      for (const [y, a] of zones) {
        const n = 1 + Math.floor(R() * 3);
        for (let k = 0; k < n; k++) if (R() < 0.7) spot(40 + R() * 176, y + (R() - 0.5) * 40, 25 + R() * 45, 14 + R() * 22, a * (0.5 + R() * 0.6));
      }
      for (let k = 0; k < 600; k++) { g.fillStyle = `rgba(230,215,180,${R() * 0.08})`; g.fillRect(R() * 256, R() * 512, 2, 2); }
      wearTex.needsUpdate = true;
    };
    draw();
    // posé au même niveau que le gazon, décalé en profondeur (plus de disparition selon l'angle)
    const wearMesh = new THREE.Mesh(at(new THREE.PlaneGeometry(2 * HW, 2 * HL), 0, 0.006, 0, -Math.PI / 2), new THREE.MeshStandardMaterial({ map: wearTex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    wearMesh.receiveShadow = true; wearMesh.renderOrder = 2;
    root.add(wearMesh);
    out.redrawWear = draw;
  }
  const apron = new THREE.Mesh(at(new THREE.PlaneGeometry(2 * HW + 2.4, 2 * HL + 2.4), 0, 0.004, 0, -Math.PI / 2), new THREE.MeshStandardMaterial({ color: def.apron, roughness: 0.95 }));
  apron.receiveShadow = true;
  root.add(apron);

  // lignes
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 });
  root.add(mesh([
    at(new THREE.PlaneGeometry(2 * HW, COURT.lineW), 0, 0.008, COURT.serviceLine, -Math.PI / 2),
    at(new THREE.PlaneGeometry(2 * HW, COURT.lineW), 0, 0.008, -COURT.serviceLine, -Math.PI / 2),
    at(new THREE.PlaneGeometry(COURT.lineW, 2 * (COURT.serviceLine + 0.2)), 0, 0.008, 0, -Math.PI / 2),
  ], lineMat));

  // vitres (normales vers la caméra TV : fond +z, côtés vers l'intérieur)
  const addGlass = (w, h, x, y, z, rotY) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.02, h), glassMat);
    m.position.set(x, y, z); m.rotation.y = rotY; m.renderOrder = 1;
    root.add(m);
    out.glassMeshes.push(m);
  };
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 5; i++) addGlass(2, 3, -4 + i * 2, 1.5, sz * (HL + 0.012), 0);
    const seams = [];
    for (let i = 1; i < 5; i++) seams.push(at(new THREE.BoxGeometry(def.panoramic ? 0.008 : 0.018, 3, 0.02), -5 + i * 2, 1.5, sz * (HL + 0.012)));
    walls[backKey(sz)].group.add(mesh(seams, walls[backKey(sz)].seam));
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addGlass(2, 3, sx * (HW + 0.012), 1.5, sz * 9, -sx * Math.PI / 2);
      addGlass(2, 2, sx * (HW + 0.012), 1.0, sz * 7, -sx * Math.PI / 2);
    }
  }

  // grillage (avec ouvertures de porte)
  const cell = 0.05;
  const wire = { 'back+': [], 'back-': [], 'side+': [], 'side-': [] };
  const wp = (key, w, h, x, y, z, ry) => wire[key].push(at(scaleUV(new THREE.PlaneGeometry(w, h), w / cell, h / cell), x, y, z, 0, ry));
  for (const sz of [-1, 1]) wp(backKey(sz), 2 * HW, 1, 0, 3.5, sz * (HL + 0.03), 0);
  // segments du grillage central : de -6 à 6, en sautant les portes
  const doorSpans = def.doors ? [...new Map(DOOR.centers.flatMap((c) => [[-c - DOOR.width / 2, -c + DOOR.width / 2], [c - DOOR.width / 2, c + DOOR.width / 2]]).map((s) => [s.join(), s])).values()].sort((a, b) => a[0] - b[0]) : [];
  for (const sx of [-1, 1]) {
    const k = sideKey(sx), r = sx * Math.PI / 2, x = sx * (HW + 0.03);
    for (const sz of [-1, 1]) { wp(k, 2, 1, x, 3.5, sz * 9, r); wp(k, 2, 1, x, 2.5, sz * 7, r); }
    let z0 = -6;
    for (const [a, b] of [...doorSpans, [6, 6]]) {
      if (a > z0) wp(k, a - z0, 3, x, 1.5, (a + z0) / 2, r);
      if (b > a) wp(k, b - a, 3 - DOOR.height, x, DOOR.height + (3 - DOOR.height) / 2, (a + b) / 2, r); // linteau
      z0 = b;
    }
  }
  for (const key in wire) if (wire[key].length) {
    const m = mesh(wire[key], walls[key].wire, { receive: false });
    m.renderOrder = 2;
    walls[key].group.add(m);
  }

  // structure métallique (une géométrie par mur)
  const parts = { 'back+': [], 'back-': [], 'side+': [], 'side-': [] };
  // profilés aluminium aux arêtes arrondies
  const box = (key, w, h, d, x, y, z) => {
    const r = Math.min(w, h, d) * 0.35;
    parts[key].push(at(new RoundedBoxGeometry(w, h, d, 2, r).toNonIndexed(), x, y, z));
  };
  const T = def.panoramic ? 0.05 : 0.07;
  for (const sx of [-1, 1]) {
    const k = sideKey(sx), x = sx * (HW + 0.06);
    for (let z = -HL; z <= HL; z += 2) {
      if (def.panoramic && Math.abs(z) > 6 && Math.abs(z) < 10) continue;  // panoramique : pas de poteaux dans les vitres
      const h = Math.abs(z) >= 8 ? 4 : 3;
      box(k, T, h, T, x, h / 2, z);
    }
    for (const sz of [-1, 1]) {
      box(k, 0.05, 0.05, 2, x, 4, sz * 9); box(k, 0.05, 0.05, 2, x, 3, sz * 9);
      box(k, 0.05, 0.05, 2, x, 2, sz * 7); box(k, 0.05, 0.05, 2, x, 3, sz * 7);
    }
    box(k, 0.05, 0.05, 12, x, 3, 0);
    // cadres de porte
    for (const [a, b] of doorSpans) {
      box(k, 0.06, DOOR.height, 0.06, x, DOOR.height / 2, a);
      box(k, 0.06, DOOR.height, 0.06, x, DOOR.height / 2, b);
      box(k, 0.06, 0.06, b - a, x, DOOR.height, (a + b) / 2);
    }
  }
  for (const sz of [-1, 1]) {
    const k = backKey(sz), z = sz * (HL + 0.06);
    if (!def.panoramic) for (let x = -3; x <= 3; x += 2) box(k, T, 1, T, x, 3.5, z);
    box(k, 2 * HW + 0.1, 0.05, 0.05, 0, 4, z);
    box(k, 2 * HW + 0.1, 0.05, 0.05, 0, 3.02, z);
  }
  for (const key in parts) {
    const m = mesh(parts[key], walls[key].frame, { shadow: true });
    walls[key].group.add(m);
  }

  // filet
  const segX = 50;
  const geo = new THREE.PlaneGeometry(2 * HW, 1, segX, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setY(i, (pos.getY(i) + 0.5) * (netHeightAt(x) - 0.05)); }
  geo.computeVertexNormals();
  scaleUV(geo, (2 * HW) / 0.045, 0.87 / 0.045);
  const net = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: ctx.netMap, alphaTest: 0.35, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.9, color: 0x6a6a6a }));
  net.castShadow = true;
  root.add(net);
  const band = new THREE.PlaneGeometry(2 * HW, 0.06, segX, 1);
  const bp = band.attributes.position;
  for (let i = 0; i < bp.count; i++) bp.setY(i, netHeightAt(bp.getX(i)) - 0.03 + bp.getY(i));
  band.computeVertexNormals();
  const bandMesh = new THREE.Mesh(band, new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7, side: THREE.DoubleSide }));
  bandMesh.castShadow = true;
  root.add(bandMesh);
  const posts = [];
  for (const sx of [-1, 1]) posts.push(at(new THREE.CylinderGeometry(0.04, 0.04, 0.96, 12), sx * (HW - 0.02), 0.48, 0));
  root.add(mesh(posts, new THREE.MeshStandardMaterial({ color: 0x15171b, metalness: 0.6, roughness: 0.4 }), { shadow: true }));

  // panneaux publicitaires
  const boardBack = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.6 });
  const boardGeo = new THREE.BoxGeometry(4.6, 0.8, 0.08), faceGeo = new THREE.PlaneGeometry(4.56, 0.76);
  const ads = def.ads.map(([t, bg, fg, ac]) => {
    const m = new THREE.MeshStandardMaterial({ map: TX.makeAdTexture(renderer, t, bg, fg, ac), emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.5 });
    m.emissiveMap = m.map;
    out.adMats.push(m);
    return m;
  });
  let i = 0;
  const place = (x, z, rotY) => {
    if (!ads.length) return;
    const m = new THREE.Mesh(boardGeo, boardBack);
    const f = new THREE.Mesh(faceGeo, ads[i++ % ads.length]);
    f.position.z = 0.041;
    m.add(f);
    m.position.set(x, 0.45, z); m.rotation.y = rotY; m.castShadow = true;
    root.add(m);
  };
  for (const sz of [-1, 1]) for (const x of [-5, 0, 5]) place(x, sz * (HL + 1.9), sz > 0 ? Math.PI : 0);
  // sur les côtés, pas devant les portes (la sortie doit rester possible)
  for (const sx of [-1, 1]) for (const z of [-7.6, 7.6]) place(sx * (HW + (def.outside ? 4.6 : 1.7)), z, -sx * Math.PI / 2);

  if (def.blades) out.group.add(cornerBlades(0, 0, def.blades));
  buildLamps(def, out);
}

/** Lames courbes aux quatre angles d'un court panoramique (comme à Ceyreste). */
function cornerBlades(cx, cz, color) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(1.7, 2.3, 0.55, 4.7);
  shape.lineTo(0.28, 4.7);
  shape.quadraticCurveTo(1.15, 2.3, -0.4, 0);
  shape.closePath();
  const geos = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false, curveSegments: 16 });
    g.translate(0, 0, -0.06);
    g.rotateY(-sz * Math.PI / 2);                  // la lame part vers l'extérieur, derrière la vitre
    g.translate(cx + sx * (HW + 0.12), 0, cz + sz * (HL - 0.7));
    geos.push(g);
  }
  return mesh(geos, new THREE.MeshStandardMaterial({ color, metalness: 0.45, roughness: 0.35 }), { shadow: true });
}

// ------------------------------------------------------------------ éclairage
function buildLamps(def, out) {
  const root = out.group;
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x23262c, metalness: 0.6, roughness: 0.5 });
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x2b2e34, metalness: 0.5, roughness: 0.5 });
  const lampMat = out.lampMat;
  const poles = [], heads = [], lens = [];
  const spot = (x, y, z, tx, tz, intensity = 95, angle = 0.95) => {
    const s = new THREE.SpotLight(0xfff3e2, intensity, 0, angle, 0.75, 1.6);
    s.position.set(x, y, z);
    s.target.position.set(tx, 0, tz);
    root.add(s, s.target);
    out.spots.push(s);
  };
  const lampHead = (x, y, z, look, w = 0.75, d = 0.5) => {
    const g = new THREE.Object3D();
    g.position.set(x, y, z);
    g.lookAt(look);
    g.rotateX(-Math.PI / 2);
    g.updateMatrix();
    heads.push(new THREE.BoxGeometry(w, 0.12, d).applyMatrix4(g.matrix));
    lens.push(new THREE.PlaneGeometry(w - 0.09, d - 0.08).rotateX(Math.PI / 2).translate(0, -0.065, 0).applyMatrix4(g.matrix));
  };
  if (def.lamps === 'swan') {
    // lampadaires en col de cygne, peints en bleu
    const blue = new THREE.MeshStandardMaterial({ color: 0x2a6cd6, metalness: 0.4, roughness: 0.4 });
    const swan = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * (HW + 1.1), z = sz * (HL + 0.9);
      const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 5.5, z), new THREE.Vector3(x, 7.6, z), new THREE.Vector3(x - sx * 1.0, 7.3, z - sz * 0.9));
      swan.push(new THREE.TubeGeometry(curve, 20, 0.09, 8, false));
      const hx = x - sx * 1.0, hz = z - sz * 0.9;
      lampHead(hx, 7.15, hz, new THREE.Vector3(-sx * 1.5, 0, sz * 4), 0.6, 0.45);
      spot(hx, 7.0, hz, -sx * 1.5, sz * 4, 110, 0.9);
    }
    root.add(mesh(swan, blue, { shadow: true }));
  } else if (def.lamps === 'basic' || def.lamps === 'municipal') {
    const H = def.lamps === 'municipal' ? 7.5 : 6.4;
    const xs = def.lamps === 'municipal' ? 6.6 : 5.45;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * xs, z = sz * 4.2;
      poles.push(at(new THREE.CylinderGeometry(0.07, 0.1, H, 10), x + sx * 0.3, H / 2, z));
      poles.push(at(new THREE.BoxGeometry(0.6, 0.06, 0.06), x, H - 0.1, z));
      lampHead(x, H - 0.2, z, new THREE.Vector3(x - sx * 2, H - 4.2, z * 1.2));
      spot(x, H - 0.3, z, -sx * 1.8, z * 1.25);
    }
  } else if (def.lamps === 'none') {
    // éclairage intégré au décor (hangar)
  } else {
    // tours (national) ou rampes au-dessus du court (stade)
    const stadium = def.lamps === 'stadium';
    const H = stadium ? 15 : 12;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * (stadium ? 7.5 : 8), z = sz * (stadium ? 6 : 11.5);
      if (!stadium) poles.push(at(new THREE.CylinderGeometry(0.16, 0.24, H, 10), x, H / 2, z));
      for (let k = 0; k < 3; k++) lampHead(x + (k - 1) * 0.8 * (stadium ? 0 : 1), H + 0.3, z + (k - 1) * 0.8 * (stadium ? 1 : 0), new THREE.Vector3(0, 0, sz * 3), 0.7, 0.5);
      spot(x, H, z, -sx * 1.2, sz * 3, stadium ? 260 : 190, 0.6);
    }
    if (stadium) {
      // deux rampes métalliques au-dessus du court
      for (const sx of [-1, 1]) poles.push(at(new THREE.BoxGeometry(0.4, 0.4, 2 * HL + 6), sx * 7.5, H + 0.6, 0));
      for (const sz of [-1, 1]) poles.push(at(new THREE.BoxGeometry(15.4, 0.3, 0.3), 0, H + 0.6, sz * (HL + 3)));
    }
  }
  if (poles.length) root.add(mesh(poles, poleMat, { shadow: true }));
  if (heads.length) root.add(mesh(heads, housingMat));
  if (lens.length) root.add(mesh(lens, lampMat, { receive: false }));
}

// ------------------------------------------------------------------ tribunes génériques
/** Tribune en gradins le long d'un axe. away = direction qui s'éloigne du court. */
function stand(out, { x, z, along = 'x', away = 1, length, rows, rowD = 0.85, rowH = 0.42, fill = 0.75, base = 0, seatColor = 0x1565c0, concrete = 0x8d9097 }) {
  const steps = [], seats = [];
  const n = Math.floor(length / 0.55);
  for (let r = 0; r < rows; r++) {
    const top = base + (r + 1) * rowH, off = away * (r * rowD + rowD / 2);
    if (along === 'x') steps.push(at(new THREE.BoxGeometry(length, top, rowD), x, top / 2, z + off));
    else steps.push(at(new THREE.BoxGeometry(rowD, top, length), x + off, top / 2, z));
    for (let i = 0; i < n; i++) {
      const t = -length / 2 + (i + 0.5) * (length / n);
      const sp = along === 'x' ? { x: x + t, z: z + off - away * 0.08 } : { x: x + off - away * 0.08, z: z + t };
      // siège moulé : assise + dossier arrondis
      const bk = -away * 0.19;
      if (along === 'x') seats.push(at(new RoundedBoxGeometry(0.42, 0.07, 0.38, 1, 0.025), sp.x, top + 0.05, sp.z).toNonIndexed(), at(new RoundedBoxGeometry(0.42, 0.34, 0.05, 1, 0.022), sp.x, top + 0.24, sp.z - bk, 0.12 * away).toNonIndexed());
      else seats.push(at(new RoundedBoxGeometry(0.38, 0.07, 0.42, 1, 0.025), sp.x, top + 0.05, sp.z).toNonIndexed(), at(new RoundedBoxGeometry(0.05, 0.34, 0.42, 1, 0.022), sp.x - bk, top + 0.24, sp.z, 0, 0, -0.12 * away).toNonIndexed());
      if (Math.random() < fill) {
        const ry = along === 'x' ? (away > 0 ? Math.PI : 0) : (away > 0 ? -Math.PI / 2 : Math.PI / 2);
        out.crowdSeats.push({ x: sp.x, y: top + 0.02, z: sp.z, ry });
      }
    }
  }
  out.group.add(mesh(steps, new THREE.MeshStandardMaterial({ color: concrete, roughness: 0.9 }), { shadow: true }));
  out.group.add(mesh(seats, new THREE.MeshStandardMaterial({ color: seatColor, roughness: 0.6 })));
}

// ------------------------------------------------------------------ éléments de décor
function treeInstances(out, kind, spots) {
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  let trunkGeo, F, trunkMat, coreColor, leafKind = 'leaf', tint = 0xffffff;
  if (kind === 'plane' || kind === 'autumn') {        // platanes (autumn : mûrier-platane aux feuilles jaunies)
    trunkGeo = mergeGeometries([
      new THREE.CylinderGeometry(0.22, 0.34, 4.2, 12).translate(0, 2.1, 0),
      new THREE.CylinderGeometry(0.1, 0.16, 2.4, 8).rotateZ(0.6).translate(0.7, 4.4, 0),
      new THREE.CylinderGeometry(0.1, 0.15, 2.2, 8).rotateZ(-0.55).rotateY(1.3).translate(-0.3, 4.4, 0.6),
    ].map((g) => g.toNonIndexed()));
    F = foliage([[0, 5.6, 0, 2.2, 0.85], [1.5, 5.2, 0.5, 1.6], [-1.2, 5.4, -0.6, 1.7], [0.2, 6.6, -0.8, 1.5], [-0.4, 6.3, 1.2, 1.4]], { density: 22, card: 1.1 });
    { const bk = TX.photoTex('bark_brown_02', 1, 3); trunkMat = new THREE.MeshStandardMaterial({ map: bk, normalMap: bk.userData.normal, color: 0xe8e0d0, roughness: 0.9 }); }
    coreColor = 0x34521f;
    if (kind === 'autumn') { coreColor = 0x6f6a26; tint = 0xf0d870; }
  } else if (kind === 'pine') { // pins d'Alep : tronc penché, couronne en parasol
    trunkGeo = mergeGeometries([0, 1, 2, 3].map((k) => new THREE.CylinderGeometry(0.16 - k * 0.025, 0.2 - k * 0.025, 2.2, 10).rotateZ(-0.12 - k * 0.05).translate(0.18 + k * 0.32, 1.1 + k * 2.05, 0).toNonIndexed()).concat(
      [new THREE.CylinderGeometry(0.05, 0.08, 1.8, 6).rotateZ(1.0).translate(0.4, 8.4, 0.3).toNonIndexed(), new THREE.CylinderGeometry(0.05, 0.08, 1.8, 6).rotateZ(-1.0).rotateY(2).translate(1.6, 8.5, -0.2).toNonIndexed()]));
    F = foliage([[1.6, 9, 0, 1.7, 0.45], [-0.5, 8.7, 0.8, 1.4, 0.45], [0.6, 9.4, -0.9, 1.5, 0.45], [2.5, 8.5, 0.6, 1.3, 0.45], [0.3, 9.6, 0.5, 1.2, 0.4]], { density: 30, card: 1.0 });
    { const bk = TX.photoTex('bark_brown_02', 1, 3); trunkMat = new THREE.MeshStandardMaterial({ map: bk, normalMap: bk.userData.normal, color: 0xd8c8b8, roughness: 0.95 }); }
    coreColor = 0x22371a; leafKind = 'needle';
  } else {                       // cyprès
    trunkGeo = new THREE.CylinderGeometry(0.12, 0.15, 1, 8).translate(0, 0.5, 0);
    F = foliage([[0, 1.5, 0, 0.62, 1.5], [0, 2.4, 0, 0.7, 1.6], [0, 3.3, 0, 0.68, 1.6], [0, 4.2, 0, 0.6, 1.7], [0, 5.1, 0, 0.5, 1.8], [0, 5.9, 0, 0.36, 1.8], [0, 6.6, 0, 0.2, 1.8]], { density: 46, card: 0.5 });
    trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a432f, roughness: 0.95 });
    coreColor = 0x1c321a; leafKind = 'needle'; tint = 0xcfd8c8;
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const cores = new THREE.InstancedMesh(F.core, new THREE.MeshStandardMaterial({ color: coreColor, roughness: 1 }), spots.length);
  const cards = new THREE.InstancedMesh(F.cards, leafMat(leafKind, tint), spots.length);
  spots.forEach(([x, z, s = 1], i) => {
    q.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
    const k = s * (0.85 + Math.random() * 0.3);
    M.compose(v.set(x, 0, z), q, sc.set(k, k * (0.9 + Math.random() * 0.25), k));
    trunks.setMatrixAt(i, M); cores.setMatrixAt(i, M); cards.setMatrixAt(i, M);
  });
  trunks.castShadow = cores.castShadow = cards.castShadow = true;
  out.group.add(trunks, cores, cards);
}

/** Buissons touffus (garrigue, haies libres). pts : [[x, z, rayon]]. */
function bushGroup(out, pts, color) {
  const F = foliage(pts.map(([x, z, r]) => [x, r * 0.62, z, r, 0.78]), { density: 40, card: 1.25, shade: 0.4 });
  const tint = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.5);
  const core = new THREE.Mesh(F.core, new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0x3c6428), 0.5).multiplyScalar(0.8), roughness: 1 }));
  const cards = new THREE.Mesh(F.cards, leafMat('leaf', tint));
  core.castShadow = cards.castShadow = true; core.receiveShadow = true;
  out.group.add(core, cards);
}

function ground(out, renderer, color = null, size = 300) {
  const tex = TX.photoTex('sparse_grass', size / 3.2);
  const g = new THREE.Mesh(at(new THREE.PlaneGeometry(size, size), 0, 0, 0, -Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, normalMap: tex.userData.normal, color: new THREE.Color(0x7fb84a).lerp(new THREE.Color(color ?? 0x7fb84a), 0.4).multiplyScalar(1.25), roughness: 1 }));
  g.receiveShadow = true;
  out.group.add(g);
}

function flat(out, w, d, x, z, color, y = 0.002, map = null) {
  const m = new THREE.Mesh(at(new THREE.PlaneGeometry(w, d), x, y, z, -Math.PI / 2), new THREE.MeshStandardMaterial({ color, map, roughness: 0.95, normalMap: map?.userData?.normal || null }));
  m.receiveShadow = true;
  out.group.add(m);
  return m;
}

function sign(out, renderer, text, colors, w, x, y, z, rotY = 0) {
  const m = new THREE.MeshStandardMaterial({ map: TX.makeAdTexture(renderer, text, colors[0], colors[1], colors[2]), emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.5 });
  m.emissiveMap = m.map;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 8), m);
  p.position.set(x, y, z); p.rotation.y = rotY;
  out.group.add(p);
  out.emissive.push(m);
}

/** Court de tennis (terre battue ou résine) avec brise-vent vert. */
function tennisCourt(out, renderer, x, z, surface = 'clay', color = null) {
  const W = 18, L = 36;
  const tex = canvasTex(256, 256, (g, S) => {
    g.fillStyle = color != null ? `#${color.toString(16).padStart(6, '0')}` : surface === 'clay' ? '#b8582e' : '#2f6e8f'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 6000; k++) { const v = Math.random() * 40 - 20; g.fillStyle = surface === 'clay' ? `rgba(${200 + v},${100 + v},${60 + v},0.25)` : `rgba(${60 + v},${130 + v},${170 + v},0.2)`; g.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  }, { renderer });
  tex.repeat.set(4, 8);
  flat(out, W, L, x, z, 0xffffff, 0.003, tex);
  const lines = [];
  const L2 = 23.77 / 2, D = 10.97 / 2, S2 = 8.23 / 2, SV = 6.4;
  for (const sz of [-1, 1]) lines.push(at(new THREE.PlaneGeometry(2 * D, 0.05), x, 0.006, z + sz * L2, -Math.PI / 2), at(new THREE.PlaneGeometry(2 * S2, 0.05), x, 0.006, z + sz * SV, -Math.PI / 2));
  for (const sx of [-1, 1]) lines.push(at(new THREE.PlaneGeometry(0.05, 2 * L2), x + sx * D, 0.006, z, -Math.PI / 2), at(new THREE.PlaneGeometry(0.05, 2 * L2), x + sx * S2, 0.006, z, -Math.PI / 2));
  lines.push(at(new THREE.PlaneGeometry(0.05, 2 * SV), x, 0.006, z, -Math.PI / 2));
  out.group.add(mesh(lines, new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.8 })));
  out.group.add(mesh([at(new THREE.BoxGeometry(2 * D + 1.8, 0.9, 0.03), x, 0.45, z), at(new THREE.BoxGeometry(2 * D + 1.8, 0.06, 0.05), x, 0.92, z)], new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.8 }), { shadow: true }));
  // brise-vent
  const fence = [];
  for (const sz of [-1, 1]) fence.push(at(new THREE.PlaneGeometry(W, 3), x, 1.5, z + sz * L / 2, 0, sz > 0 ? Math.PI : 0));
  for (const sx of [-1, 1]) fence.push(at(new THREE.PlaneGeometry(L, 3), x + sx * W / 2, 1.5, z, 0, -sx * Math.PI / 2));
  out.group.add(mesh(fence, new THREE.MeshStandardMaterial({ color: 0x1f4a2a, roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0.82, depthWrite: false })));
}

function car(out, x, z, ry, color) {
  const body = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.6 });
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 4.2), body); b.position.y = 0.6;
  const c = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.2), dark); c.position.set(0, 1.2, -0.2);
  g.add(b, c);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.25, 12), dark);
    w.rotation.z = Math.PI / 2; w.position.set(sx * 0.85, 0.33, sz * 1.35);
    g.add(w);
  }
  g.position.set(x, 0, z); g.rotation.y = ry;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  out.group.add(g);
}

/** Petit bâtiment : murs, toit de tuiles ou plat. */
const _plaster = {};
/** Enduit de façade (grain + légères salissures en bas). */
function plasterTex(color) {
  const key = color;
  if (_plaster[key]) return _plaster[key];
  const base = new THREE.Color(color);
  const t = canvasTex(256, 256, (g, S) => {
    g.fillStyle = `#${base.getHexString()}`; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 9000; k++) { const v = (Math.random() - 0.5) * 22; g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255})`; g.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
    const gr = g.createLinearGradient(0, S * 0.75, 0, S); gr.addColorStop(0, 'rgba(60,50,40,0)'); gr.addColorStop(1, 'rgba(60,50,40,0.18)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  });
  _plaster[key] = t;
  return t;
}
/** Tuiles romaines (rangées ondulées). */
function tileTex() {
  if (_plaster.tiles) return _plaster.tiles;
  const t = canvasTex(256, 256, (g, S) => {
    g.fillStyle = '#a4553a'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 21) for (let x = (y / 21) % 2 ? 0 : 10; x < S + 20; x += 20) {
      const gr = g.createLinearGradient(x - 10, 0, x + 10, 0);
      const c = 150 + Math.random() * 40;
      gr.addColorStop(0, `rgb(${c * 0.7},${c * 0.32},${c * 0.22})`); gr.addColorStop(0.5, `rgb(${c},${c * 0.48},${c * 0.32})`); gr.addColorStop(1, `rgb(${c * 0.65},${c * 0.3},${c * 0.2})`);
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y + 12, 10, 12, 0, 0, Math.PI * 2); g.fill();
    }
  });
  t.repeat.set(3, 3);
  _plaster.tiles = t;
  return t;
}

function building(out, { x, z, w, d, h, y = 0, wall = 0xd9d4cb, roof = 0x3a3d44, tiles = false, rotY = 0, wood = false, keepWin = null }) {
  const g = new THREE.Group();
  const wallTex = wood ? woodTex(Math.max(w, d)) : TX.photoTex('white_plaster_rough_01', w / 3, h / 3);
  const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, 0.08), new THREE.MeshStandardMaterial({ color: wall, roughness: 0.92, map: wallTex, normalMap: wood ? null : wallTex.userData.normal }));
  b.position.y = h / 2;
  g.add(b);
  // soubassement
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(w + 0.08, 0.45, d + 0.08, 2, 0.03), new THREE.MeshStandardMaterial({ color: new THREE.Color(wall).multiplyScalar(0.62), roughness: 0.95 }));
  plinth.position.y = 0.22;
  g.add(plinth);
  if (tiles) {
    const tt = TX.photoTex('clay_roof_tiles_02', 4, 2);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tt, normalMap: tt.userData.normal, roughness: 0.85 });
    // toit à deux pans posé sur les murs (pignons triangulaires sous le faîtage)
    roofMat.side = THREE.DoubleSide;
    const D2 = (d + 0.8) / 2, R = d * 0.26, Ls = Math.hypot(D2, R), ang = Math.atan2(R, D2);
    for (const sz of [1, -1]) {
      const sl = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.9, Ls).rotateX(-Math.PI / 2).rotateX(sz * ang), roofMat);
      sl.position.set(0, h + 0.1 + R / 2, sz * D2 / 2);
      g.add(sl);
    }
    const tri = new THREE.Shape(); tri.moveTo(-d / 2, 0); tri.lineTo(d / 2, 0); tri.lineTo(0, R * (d / 2) / D2); tri.closePath();
    for (const sx of [1, -1]) {
      const gb = new THREE.Mesh(new THREE.ShapeGeometry(tri).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ color: wall, roughness: 0.92, side: THREE.DoubleSide }));
      gb.position.set(sx * w / 2, h + 0.1, 0);
      g.add(gb);
    }
    // faîtage
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, w + 0.95, 8).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xa4553a, roughness: 0.85 }));
    ridge.position.y = h + 0.1 + R + 0.02;
    g.add(ridge);
    // génoises sous le toit
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.18, d + 0.5), new THREE.MeshStandardMaterial({ color: 0xe9e0cf, roughness: 0.9 }));
    fascia.position.y = h + 0.02;
    g.add(fascia);
  } else {
    const r = new THREE.Mesh(new RoundedBoxGeometry(w + 0.6, 0.3, d + 0.6, 2, 0.06), new THREE.MeshStandardMaterial({ color: roof, roughness: 0.75 }));
    r.position.y = h + 0.14;
    g.add(r);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.64, 0.06, d + 0.64), new THREE.MeshStandardMaterial({ color: 0xbfc4ca, metalness: 0.6, roughness: 0.4 }));
    edge.position.y = h + 0.3;
    g.add(edge);
  }
  // fenêtres : cadre, vitre réfléchissante, appui ; sur les deux grandes faces
  const win = new THREE.MeshStandardMaterial({ color: 0x1d2a36, emissive: 0xffd9a0, emissiveIntensity: 0.4, roughness: 0.08, metalness: 0.6 });
  out.windows.push(win);
  const frameMat = new THREE.MeshStandardMaterial({ color: wood ? 0x3b2a1a : 0xf2f2ee, roughness: 0.6 });
  const frames = [], sills = [];
  const nWin = Math.floor(w / 2.2);
  for (const side of [1, -1]) for (let i = 0; i < nWin; i++) {
    if (keepWin && !keepWin(side, i)) continue;
    const wx = -w / 2 + 1.3 + i * 2.2, wy = Math.min(h * 0.55, h - 1.1), wz = side * (d / 2);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.15), win);
    glass.position.set(wx, wy, wz + side * 0.02);
    if (side < 0) glass.rotation.y = Math.PI;
    g.add(glass);
    for (const [fw, fh, fx, fy] of [[1.2, 0.07, 0, 0.61], [1.2, 0.07, 0, -0.61], [0.07, 1.25, -0.57, 0], [0.07, 1.25, 0.57, 0], [0.05, 1.15, 0, 0]]) {
      frames.push(new THREE.BoxGeometry(fw, fh, 0.08).translate(wx + fx, wy + fy, wz + side * 0.03).toNonIndexed());
    }
    sills.push(new THREE.BoxGeometry(1.35, 0.06, 0.22).translate(wx, wy - 0.68, wz + side * 0.09).toNonIndexed());
  }
  if (frames.length) g.add(new THREE.Mesh(mergeGeometries(frames), frameMat));
  if (sills.length) g.add(new THREE.Mesh(mergeGeometries(sills), new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.8 })));
  g.position.set(x, y, z); g.rotation.y = rotY;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  out.group.add(g);
  return g;
}

/** Bardage bois (planches horizontales). */
function woodTex(len = 4) {
  const t = canvasTex(128, 128, (g, S) => {
    g.fillStyle = '#a77a4c'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 16) {
      g.fillStyle = `rgb(${150 + Math.random() * 30},${105 + Math.random() * 20},${65 + Math.random() * 15})`;
      g.fillRect(0, y + 1, S, 14);
      g.fillStyle = 'rgba(60,35,15,0.6)'; g.fillRect(0, y, S, 2);
      for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(80,50,25,0.25)'; g.fillRect(Math.random() * S, y + 3 + Math.random() * 10, 20 + Math.random() * 30, 1); }
    }
  });
  t.repeat.set(len / 2, 1);
  return t;
}

/** Horizon : rideau d'arbres irrégulier puis collines, pour qu'aucun lieu ne finisse dans le vide. */
function horizon(out, { r0 = 55, r1 = 95, kinds = ['plane', 'pine', 'cypress'], n = 45, hillsPalette = [0x5f7a3c, 0x6f8a46, 0xc9c1ad], skipArc = null } = {}) {
  const per = {};
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    if (skipArc && a > skipArc[0] && a < skipArc[1]) continue;
    const r = r0 + Math.random() * (r1 - r0);
    const k = kinds[Math.floor(Math.random() * kinds.length)];
    (per[k] ||= []).push([Math.cos(a) * r, Math.sin(a) * r, 0.9 + Math.random() * 0.7]);
  }
  for (const [k, pts] of Object.entries(per)) treeInstances(out, k, pts);
  hills(out, hillsPalette);
  const rk = [];
  for (let i = 0; i < 26; i++) { const a2 = Math.random() * Math.PI * 2; if (skipArc && a2 > skipArc[0] && a2 < skipArc[1]) continue; const r = r0 - 8 + Math.random() * (r1 - r0); rk.push([Math.cos(a2) * r, Math.sin(a2) * r, 0.6 + Math.random() * 2.2]); }
  rocks(out, rk);
}

/** Collines calcaires (Provence) en arrière-plan. */
function hills(out, palette = [0x6f7d4a, 0x6f7d4a, 0xd8d2c2]) {
  const geos = [];
  const spots = [[-60, -120, 70, 38], [10, -140, 90, 52], [80, -115, 60, 34], [-120, -60, 50, 30], [130, -50, 60, 40], [-140, 40, 70, 26]];
  const noise = (x, z) => Math.sin(x * 0.9 + z * 0.4) * 0.5 + Math.sin(x * 2.3 - z * 1.7) * 0.25 + Math.sin(x * 5.1 + z * 4.3) * 0.12 + Math.sin(x * 11 - z * 9) * 0.05;
  for (const [x, z, r, h] of spots) {
    const g = mergeVertices(new THREE.IcosahedronGeometry(1, 6).deleteAttribute('normal').deleteAttribute('uv'));
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const n = 0.86 + noise(vx * 3 + x, vz * 3 + z) * 0.16;
      // relief : crêtes et ravines, pied adouci
      const yy = Math.max(0, vy);
      p.setXYZ(i, vx * r * n, Math.pow(yy, 1.15) * h * (0.9 + noise(vx * 5, vz * 5) * 0.18), vz * r * n * 0.7);
    }
    g.computeVertexNormals();
    geos.push(g.translate(x, -2, z));
  }
  const geo = mergeGeometries(geos.map((g) => g.toNonIndexed()));
  // couleurs : calcaire clair sur les pentes raides et en haut, garrigue verte ailleurs, avec des variations
  const col = [], c = new THREE.Color(), rockC = new THREE.Color(palette[2]), g0 = new THREE.Color(palette[0]), g1 = new THREE.Color(palette[1]);
  const p = geo.attributes.position, nn = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), steep = 1 - nn.getY(i);
    const patch = noise(p.getX(i) * 0.08, p.getZ(i) * 0.08);
    c.copy(g0).lerp(g1, 0.5 + patch * 0.5);
    const rock = THREE.MathUtils.clamp((steep - 0.35) * 3 + (y - 22) * 0.04 + patch * 0.3, 0, 1);
    c.lerp(rockC, rock);
    c.offsetHSL(0, 0, (noise(p.getX(i) * 0.6, p.getZ(i) * 0.6)) * 0.04 - 0.02);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  m.receiveShadow = true;
  out.group.add(m);
}

// ------------------------------------------------------------------ décors par lieu
function decorMunicipal(out, renderer) {
  ground(out, renderer, 0xb8c9a0);
  flat(out, 2 * HW + 9, 2 * HL + 6, 0, 0, 0x50545b);                 // dalle bitume autour du padel
  tennisCourt(out, renderer, 20, -3, 'clay');
  tennisCourt(out, renderer, -20, -3, 'hard');
  tennisCourt(out, renderer, 20, 36, 'clay');
  building(out, { x: 0, z: -(HL + 9), w: 12, d: 6, h: 3.2, wall: 0xe3dccb, roof: 0x4a4f57 });
  sign(out, renderer, 'TENNIS MUNICIPAL', [['#24502e', '#2f6a3c'], '#ffffff', '#f2c94c'], 6, 0, 3.9, -(HL + 5.9));
  treeInstances(out, 'plane', [[-9, -16], [-3, -17], [4, -17.5], [10, -16], [-30, 8], [-30, 20], [30, -24], [-12, 16], [12, 17], [36, 10], [-36, -10], [0, 24]]);
  const colors = [0xc62828, 0xf2f4f7, 0x24262b, 0x1565c0, 0x8a8f98, 0x6b6b3a];
  for (let i = 0; i < 6; i++) car(out, -14 + i * 2.6, 19, 0.04 * (i - 3), colors[i]);
  flat(out, 20, 8, -8, 19, 0x3a3d42, 0.003);
  fete(out, renderer, -14, -24, 0, 0, 'FÊTE DU PADEL');
  // banc + quelques spectateurs
  out.group.add(mesh([at(new THREE.BoxGeometry(0.45, 0.45, 3.5), -(HW + 2.6), 0.225, -7)], new THREE.MeshStandardMaterial({ color: 0x8a6542, roughness: 0.8 }), { shadow: true }));
  for (let i = 0; i < 4; i++) if (Math.random() < 0.8) out.crowdSeats.push({ x: -(HW + 2.6), y: 0.03, z: -8.4 + i * 0.85, ry: Math.PI / 2 });
  horizon(out, { r0: 50, r1: 90, n: 40 });
}

/**
 * Ceyreste, d'après le plan du club et les photos :
 *  - trois courts panoramiques bleus en diagonale (le court de jeu est celui du milieu) ;
 *  - au fond à gauche, un court de tennis gris foncé, longé par la route ;
 *  - à gauche, une grande terrasse en planches de bois EN CONTREBAS, avec le club-house (tuiles) ;
 *  - devant à gauche, une cabane en bois ; devant à droite, un court de tennis bordeaux ;
 *  - arbres et buissons au fond ; tout le reste est en terre ; collines boisées à l'horizon.
 *  Repère : 1 m ≈ 11 px en largeur et 9,5 px en hauteur sur le plan, origine au court du milieu.
 */
/** Rochers calcaires blancs (jardin de rochers de Ceyreste) : blocs anguleux, teinte claire. */
function limestone(out, spots, y = 0) {
  const geos = [];
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const [x, z, s = 0.5] of spots) {
    const g = new THREE.IcosahedronGeometry(1, 2).toNonIndexed();
    const pp = g.attributes.position;
    const offs = new Map();
    for (let i = 0; i < pp.count; i++) {
      const k = `${pp.getX(i).toFixed(3)},${pp.getY(i).toFixed(3)},${pp.getZ(i).toFixed(3)}`;
      if (!offs.has(k)) offs.set(k, 0.75 + rnd() * 0.5);
      const f = offs.get(k);
      pp.setXYZ(i, pp.getX(i) * f * 1.25, Math.max(-0.35, pp.getY(i) * f * 0.7), pp.getZ(i) * f);
    }
    g.computeVertexNormals();
    g.scale(s, s, s); g.rotateY(rnd() * Math.PI * 2); g.translate(x, y + s * 0.2, z);
    geos.push(g);
  }
  const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color: 0xa9a291, roughness: 0.92 }));
  m.castShadow = m.receiveShadow = true;
  out.group.add(m);
}

/**
 * Ceyreste, d'après les photos du club : façade du club-house (porte vitrée blanche,
 * store, panneau d'affichage, cyprès, poubelle verte), terrain de pétanque à droite de
 * la porte, jardin de rochers calcaires blancs et gravier, large allée en béton vers le
 * premier court bleu, bancs blancs à lattes avec les affaires des joueurs, poubelle en
 * bois, mûrier aux feuilles jaunies, tableau de score à volets sur le grillage.
 */
function ceyresteDetails(out, renderer, DEPTH) {
  const low = new THREE.Group(); low.position.y = -DEPTH; out.group.add(low);
  const L = { ...out, group: low };
  const FX = -39.95;                                   // façade du club-house (côté terrasse)
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.45 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fb4bd, roughness: 0.08, metalness: 0.4 });
  // porte vitrée double, blanche
  low.add(mesh([at(new THREE.BoxGeometry(0.12, 2.3, 1.7), FX, 1.15, 9)], white, { shadow: true }));
  low.add(mesh([at(new THREE.PlaneGeometry(0.66, 1.9), FX + 0.07, 1.15, 8.6, 0, Math.PI / 2), at(new THREE.PlaneGeometry(0.66, 1.9), FX + 0.07, 1.15, 9.4, 0, Math.PI / 2)], glass));
  low.add(mesh([at(new THREE.BoxGeometry(0.05, 0.03, 0.22), FX + 0.12, 1.1, 8.9), at(new THREE.BoxGeometry(0.05, 0.03, 0.22), FX + 0.12, 1.1, 9.1)], new THREE.MeshStandardMaterial({ color: 0xbfc4ca, metalness: 0.9, roughness: 0.3 })));
  // applique au-dessus de la porte, petites fenêtres
  low.add(mesh([at(new THREE.BoxGeometry(0.12, 0.14, 0.3), FX + 0.07, 2.65, 9)], new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff2d0, emissiveIntensity: 0.3 })));
  for (const z of [2.2, 3.1]) low.add(mesh([at(new THREE.BoxGeometry(0.08, 0.5, 0.5), FX + 0.03, 2.1, z)], white), mesh([at(new THREE.PlaneGeometry(0.4, 0.4), FX + 0.08, 2.1, z, 0, Math.PI / 2)], glass));
  // store banne blanc replié (au-dessus des baies de gauche)
  low.add(mesh([at(new THREE.BoxGeometry(0.35, 0.28, 5.2), FX + 0.2, 2.75, 13)], white, { shadow: true }));
  low.add(mesh([at(new THREE.BoxGeometry(0.06, 0.06, 5.0), FX + 0.4, 2.62, 13)], new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.7 })));
  // panneau d'affichage du club (affiches)
  const board = canvasTex(256, 320, (g) => {
    g.fillStyle = '#e9e9e6'; g.fillRect(0, 0, 256, 320);
    const cols = ['#f2c94c', '#ffffff', '#cfe3ff', '#ffd6d6', '#ffffff', '#e8f5d0'];
    for (let i = 0; i < 6; i++) { const x = 14 + (i % 2) * 120, y = 14 + Math.floor(i / 2) * 100; g.fillStyle = cols[i]; g.fillRect(x, y, 106, 88); g.fillStyle = '#333'; g.font = 'bold 13px sans-serif'; g.fillText(['TOURNOI', 'PLANNING', 'ÉCOLE', 'RÉSERVER', 'RÈGLEMENT', 'APÉRO'][i], x + 8, y + 22); g.fillStyle = '#888'; for (let k = 0; k < 4; k++) g.fillRect(x + 8, y + 34 + k * 12, 70 + (k % 2) * 18, 4); }
  });
  low.add(mesh([at(new THREE.BoxGeometry(0.06, 1.0, 0.8), FX + 0.03, 1.75, 10.9)], new THREE.MeshStandardMaterial({ color: 0xd7d7d4, metalness: 0.5, roughness: 0.4 })));
  low.add(mesh([at(new THREE.PlaneGeometry(0.72, 0.92), FX + 0.07, 1.75, 10.9, 0, Math.PI / 2)], new THREE.MeshStandardMaterial({ map: board, roughness: 0.3 })));
  // tablettes en bois le long de la façade (accoudoirs)
  low.add(mesh([at(new THREE.BoxGeometry(0.22, 0.05, 6), FX + 0.13, 1.15, 13), at(new THREE.BoxGeometry(0.22, 0.05, 3.5), FX + 0.13, 1.25, 5)], new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.8 })));
  // poubelle verte à roulettes, à droite de la porte
  const green = new THREE.MeshStandardMaterial({ color: 0x1f6b3a, roughness: 0.55 });
  low.add(mesh([at(new THREE.BoxGeometry(0.75, 1.0, 0.65), FX + 0.6, 0.5, 7.2), at(new THREE.BoxGeometry(0.8, 0.07, 0.7), FX + 0.6, 1.04, 7.2)], green, { shadow: true }));
  // cyprès contre la façade, laurier-rose et olivier en boule
  treeInstances(L, 'cypress', [[FX + 1.2, 15.0, 0.95], [FX + 1.3, 6.2, 1.05], [FX + 1.1, -5.6, 0.9]]);
  bushGroup(L, [[FX + 1.6, 16.6, 1.3], [FX + 1.3, 11.6, 0.6], [FX + 1.5, -4.2, 1.0]], 0x587a3c);
  bushGroup(L, [[FX + 2.4, 18.6, 1.7]], 0x7d9a6a);

  // --- terrain de pétanque : sable stabilisé, bordures en bois, boules et cochonnet
  const PX = -36, PZ = 1.2, PW = 4, PL = 10;
  flat(L, PW, PL, PX, PZ, 0xfff1d2, 0.02, TX.groundTex(renderer, 'sand', 2, 6));
  const bord = new THREE.MeshStandardMaterial({ color: 0x7a5434, roughness: 0.9 });
  low.add(mesh([
    at(new THREE.BoxGeometry(0.12, 0.16, PL + 0.24), PX - PW / 2 - 0.06, 0.08, PZ), at(new THREE.BoxGeometry(0.12, 0.16, PL + 0.24), PX + PW / 2 + 0.06, 0.08, PZ),
    at(new THREE.BoxGeometry(PW, 0.16, 0.12), PX, 0.08, PZ - PL / 2 - 0.06), at(new THREE.BoxGeometry(PW, 0.16, 0.12), PX, 0.08, PZ + PL / 2 + 0.06),
  ], bord, { shadow: true }));
  const boules = [];
  for (const [bx, bz] of [[0.3, -3.1], [-0.4, -2.6], [0.9, -2.2], [-0.2, -3.6], [0.6, 3.5], [-0.7, 4.2]]) boules.push(at(new THREE.SphereGeometry(0.038, 12, 8), PX + bx, 0.06, PZ + bz));
  low.add(mesh(boules, new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.95, roughness: 0.25 })));
  low.add(mesh([at(new THREE.SphereGeometry(0.015, 8, 6), PX + 0.1, 0.04, PZ - 2.9)], new THREE.MeshStandardMaterial({ color: 0xe0b020, roughness: 0.5 })));
  low.add(mesh([at(new THREE.TorusGeometry(0.25, 0.012, 6, 24), PX - 1.2, 0.03, PZ + 5.2, Math.PI / 2)], new THREE.MeshStandardMaterial({ color: 0xff3d00, roughness: 0.6 })));
  // banc des boulistes
  const bench = (g, x, z, ry) => {
    const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b);
    const slats = [];
    for (let i = 0; i < 6; i++) slats.push(at(new THREE.BoxGeometry(1.9, 0.035, 0.07), 0, 0.45, -0.2 + i * 0.08));
    for (let i = 0; i < 5; i++) slats.push(at(new THREE.BoxGeometry(1.9, 0.07, 0.035), 0, 0.58 + i * 0.09, -0.27, -0.18));
    for (const sx of [-0.85, 0.85]) slats.push(at(new THREE.BoxGeometry(0.05, 0.45, 0.05), sx, 0.22, 0.15), at(new THREE.BoxGeometry(0.05, 0.9, 0.05), sx, 0.45, -0.25, -0.18));
    b.add(mesh(slats, white, { shadow: true }));
    return b;
  };
  bench(low, PX - 2.8, PZ, Math.PI / 2);

  // --- jardin de rochers calcaires blancs et gravier, sur le talus devant la terrasse
  flat(out, 3.2, 16, -25.7, 12, 0xd2c6b0, 0.02, TX.groundTex(renderer, 'dirt', 2, 8));
  limestone(out, [[-26.6, 7.5, 0.55], [-26.2, 9.0, 0.7], [-25.8, 10.6, 0.5], [-26.7, 12.1, 0.8], [-25.9, 13.8, 0.6], [-26.4, 15.4, 0.75], [-25.2, 16.6, 0.45], [-24.8, 8.4, 0.4], [-25.0, 14.6, 0.5], [-24.2, 11.6, 0.35],
    [-26.9, 6.2, 0.45], [-25.4, 9.8, 0.3], [-26.0, 17.4, 0.5], [-24.6, 12.9, 0.28], [-25.6, 7.0, 0.32], [-27.0, 10.0, 0.4], [-26.9, 14.3, 0.35]]);
  bushGroup(out, [[-24.6, 10.0, 0.6], [-24.4, 15.8, 0.5]], 0x6f8a3c);

  // --- large allée en béton entre le club-house et le premier court bleu
  flat(out, 2.6, 30, -22.7, 8, 0xc8c3b8, 0.012, TX.groundTex(renderer, 'concrete', 2, 16));

  // --- bancs blancs avec les affaires des joueurs, poubelle en bois, mûrier jauni
  const bA = bench(out.group, -20.5, -3.3, Math.PI / 2);
  const props = new THREE.Group(); bA.add(props);
  props.add(mesh([at(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 10), 0.4, 0.6, 0, 0, 0, Math.PI / 2 - 0.2)], new THREE.MeshStandardMaterial({ color: 0xe8f2ff, roughness: 0.1, transparent: true, opacity: 0.6 })));
  props.add(mesh([at(new THREE.CylinderGeometry(0.045, 0.045, 0.26, 12), -0.1, 0.52, 0.05, 0, 0, Math.PI / 2)], new THREE.MeshStandardMaterial({ color: 0x1e6fd9, roughness: 0.4 })));
  props.add(mesh([at(new THREE.BoxGeometry(0.5, 0.18, 0.32), -0.55, 0.56, 0)], new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.9 }), { shadow: true }));
  props.add(mesh([at(new THREE.BoxGeometry(0.08, 0.015, 0.16), 0.75, 0.48, 0.05)], new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.2 })));
  const rk = makeRacketMesh(RACKETS.find((r) => r.id === 'carbon') || RACKETS[0], designById('carbon3k'));
  rk.rotation.set(-Math.PI / 2, 0, 0.4); rk.position.set(0.25, 0.49, 0.03); props.add(rk);
  bench(out.group, -20.5, -8.3, Math.PI / 2);
  const bin = new THREE.Group(); bin.position.set(-20.7, 0, -0.9); out.group.add(bin);
  const staves = [];
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; staves.push(at(new THREE.BoxGeometry(0.1, 0.85, 0.03), Math.cos(a) * 0.28, 0.43, Math.sin(a) * 0.28, 0, -a + Math.PI / 2)); }
  bin.add(mesh(staves, new THREE.MeshStandardMaterial({ color: 0x8a4f2c, roughness: 0.85 }), { shadow: true }));
  bin.add(mesh([at(new THREE.TorusGeometry(0.29, 0.015, 6, 20), 0, 0.82, 0, Math.PI / 2), at(new THREE.TorusGeometry(0.29, 0.015, 6, 20), 0, 0.1, 0, Math.PI / 2)], new THREE.MeshStandardMaterial({ color: 0x555a60, metalness: 0.7 })));
  out.group.add(mesh([at(new THREE.BoxGeometry(0.7, 1.05, 0.7), -20.8, 0.53, -10.8)], new THREE.MeshStandardMaterial({ color: 0x1e5aa8, roughness: 0.55 }), { shadow: true }));
  treeInstances(out, 'autumn', [[-22.6, -5.8, 0.75]]);

  // --- petits buissons un peu partout à l'extérieur des courts (garrigue : lentisques, romarin, cistes)
  {
    const courts = [[-13.6, -5.8], [0, 0], [14.1, 6.5], [31.5, 16, 1], [-36, -28, 1]];
    const blocked = (x, z) => courts.some(([cx, cz, r]) => (r ? Math.abs(x - cx) < 13 && Math.abs(z - cz) < 8 : Math.abs(x - cx) < 8 && Math.abs(z - cz) < 13))
      || (x < -27 && z > -17 && z < 28) || (x > -27.5 && x < -20 && z > 4 && z < 26) || (Math.abs(x + 6.8) < 2.5 && Math.abs(z + 2.8) < 16) || (Math.abs(x - 7.1) < 2.5 && Math.abs(z - 3.2) < 16);
    let seed = 5;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const dark = [], light = [], grey = [];
    for (let i = 0; i < 400 && dark.length + light.length + grey.length < 70; i++) {
      const x = -30 + rnd() * 75, z = -32 + rnd() * 62;
      if (blocked(x, z)) continue;
      const pt = [x, z, 0.35 + rnd() * 0.5];
      (i % 3 === 0 ? light : i % 3 === 1 ? dark : grey).push(pt);
    }
    if (dark.length) bushGroup(out, dark, 0x3f6b30);
    if (light.length) bushGroup(out, light, 0x7f9a45);
    if (grey.length) bushGroup(out, grey, 0x8a9a7a);
  }

  // --- tableau de score à volets accroché au grillage du court bleu le plus proche
  const sb = canvasTex(256, 192, (g) => {
    g.fillStyle = '#1b2f5a'; g.beginPath(); g.roundRect(0, 0, 256, 192, 26); g.fill();
    g.fillStyle = '#ffffff'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillText('SCORE', 128, 34);
    for (const [y, lab] of [[48, 'HOME'], [118, 'GUEST']]) {
      g.fillStyle = '#ffffff'; g.fillRect(56, y, 144, 18); g.fillStyle = '#1b2f5a'; g.font = 'bold 15px sans-serif'; g.fillText(lab, 128, y + 15);
      for (let k = 0; k < 3; k++) { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(70 + k * 58, y + 44, 21, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; g.font = 'bold 26px sans-serif'; g.fillText(String(Math.floor(Math.random() * 7)), 70 + k * 58, y + 53); }
    }
  });
  out.group.add(mesh([at(new THREE.PlaneGeometry(1.1, 0.82), -18.72, 1.55, -1.2, 0, -Math.PI / 2)], new THREE.MeshStandardMaterial({ map: sb, roughness: 0.5 })));
}

/**
 * Riviera Padel Palace : complexe de luxe. Esplanade en pierre claire, court central encadré
 * de tribunes sur ses quatre côtés (loge VIP vitrée au-dessus d'une tribune), écrans géants,
 * pavillon-lounge vitré, allées bordées de palmiers et de bassins, voiles d'ombrage blanches
 * au-dessus des quatre courts annexes, drapeaux.
 */
function decorPrestige(out, renderer) {
  ground(out, renderer, 0x6f8f5a);
  flat(out, 90, 70, 0, 0, 0xf1ece2, 0.002, TX.groundTex(renderer, 'paving', 30, 24));
  // tribunes du court central : deux grandes latérales, deux en fond de court
  for (const sx of [-1, 1]) stand(out, { x: sx * (HW + 2.4), z: 0, along: 'z', away: sx, length: 22, rows: 10, fill: 0.9, seatColor: 0x14273d, concrete: 0xe6e1d6 });
  for (const sz of [-1, 1]) stand(out, { x: 0, z: sz * (HL + 2.4), along: 'x', away: sz, length: 13, rows: 7, fill: 0.88, seatColor: sz < 0 ? 0xb8962e : 0x14273d, concrete: 0xe6e1d6 });
  // loge VIP vitrée au-dessus de la tribune de fond
  const vipZ = -(HL + 2.4 + 7 * 0.85 + 1.4), gold = new THREE.MeshStandardMaterial({ color: 0xd4a72c, metalness: 0.9, roughness: 0.25 });
  out.group.add(mesh([at(new THREE.BoxGeometry(14, 0.3, 3), 0, 3.3, vipZ), at(new THREE.BoxGeometry(14, 0.25, 3.2), 0, 6.2, vipZ)], new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.5 }), { shadow: true }));
  out.group.add(mesh([at(new THREE.BoxGeometry(14, 2.6, 0.06), 0, 4.75, vipZ + 1.45)], new THREE.MeshStandardMaterial({ color: 0x9cc7d8, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.45 })));
  out.group.add(mesh([at(new THREE.BoxGeometry(14.2, 0.08, 0.08), 0, 6.05, vipZ + 1.5), at(new THREE.BoxGeometry(14.2, 0.08, 0.08), 0, 3.5, vipZ + 1.5)], gold));
  for (let i = 0; i < 10; i++) out.crowdSeats.push({ x: -5.6 + i * 1.25, y: 3.47, z: vipZ + 0.6, ry: Math.PI });
  sign(out, renderer, 'LOGE VIP', [['#0d1b2a', '#1b263b'], '#d4a72c', '#d4a72c'], 4, 0, 6.8, vipZ + 1.5, 0);
  // écrans géants dans les angles
  const scr = new THREE.MeshStandardMaterial({ color: 0x0b1020, emissive: 0x6fd3ff, emissiveIntensity: 0.3 });
  out.emissive.push(scr);
  for (const [x, z, ry] of [[-13, -17, 0.6], [13, 17, Math.PI + 0.6]]) {
    out.group.add(mesh([at(new THREE.BoxGeometry(6.4, 3.6, 0.3), x, 8.6, z, 0, ry)], scr));
    out.group.add(mesh([at(new THREE.BoxGeometry(0.35, 7, 0.35), x, 3.5, z)], new THREE.MeshStandardMaterial({ color: 0x1b1d22, metalness: 0.5 })));
  }
  // pavillon-lounge vitré à toit plat (côté ouest), terrasse et parasols blancs
  const lx = -26, lz = -32;
  out.group.add(mesh([at(new THREE.BoxGeometry(22, 4, 9), lx, 2, lz)], new THREE.MeshStandardMaterial({ color: 0x9cc7d8, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.55 }), { shadow: true }));
  out.group.add(mesh([at(new THREE.BoxGeometry(24, 0.5, 11), lx, 4.25, lz)], new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.5 }), { shadow: true }));
  out.group.add(mesh([at(new THREE.BoxGeometry(24.1, 0.1, 11.1), lx, 4.02, lz)], gold));
  sign(out, renderer, 'CLUB HOUSE · LOUNGE', [['#0d1b2a', '#1b263b'], '#ffffff', '#d4a72c'], 7, lx, 4.9, lz + 5.6, 0);
  const umb = [], poles = [];
  for (let i = 0; i < 5; i++) { const ux = lx - 8 + i * 4, uz = lz + 8; umb.push(at(new THREE.ConeGeometry(1.4, 0.5, 12), ux, 2.4, uz)); poles.push(at(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6), ux, 1.15, uz)); for (const dz of [-0.7, 0.7]) if (Math.random() < 0.7) out.crowdSeats.push({ x: ux, y: 0.03, z: uz + dz, ry: dz > 0 ? Math.PI : 0 }); }
  out.group.add(mesh(umb, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), { shadow: true }), mesh(poles, gold));
  // voiles d'ombrage tendues au-dessus des courts annexes
  const sail = new THREE.MeshStandardMaterial({ color: 0xfbfaf6, roughness: 0.8, side: THREE.DoubleSide });
  for (const [cx, cz] of [[-26, -12.5], [-26, 12.5], [26, -12.5], [26, 12.5]]) {
    for (const k of [-1, 1]) {
      const tri = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([cx - 6.5, 7.5, cz + k * 11, cx + 6.5, 6.6, cz + k * 11, cx, 8.4, cz + k * 2], 3));
      tri.computeVertexNormals();
      out.group.add(mesh([tri], sail, { shadow: true }));
    }
    out.group.add(mesh([[-6.5, 7.5], [6.5, 6.6]].flatMap(([dx, h]) => [-1, 1].map((k) => at(new THREE.CylinderGeometry(0.08, 0.1, h, 8), cx + dx, h / 2, cz + k * 11))), new THREE.MeshStandardMaterial({ color: 0xe8e2d0, metalness: 0.4, roughness: 0.4 })));
  }
  // bassins et allée de palmiers, drapeaux
  const water = new THREE.MeshStandardMaterial({ color: 0x2f8fb8, roughness: 0.05, metalness: 0.3 });
  for (const sx of [-1, 1]) {
    out.group.add(mesh([at(new THREE.BoxGeometry(2.4, 0.4, 26), sx * 14.5 + sx * 2.2, 0.2, 0)], new THREE.MeshStandardMaterial({ color: 0xe6e1d6, roughness: 0.6 }), { shadow: true }));
    out.group.add(mesh([at(new THREE.PlaneGeometry(2.0, 25.6), sx * 16.7, 0.36, 0, -Math.PI / 2)], water));
  }
  const palm = palmTemplate();
  const pts = [];
  for (let z = -30; z <= 30; z += 7.5) for (const x of [-39.5, 39.5]) pts.push([x, z]);
  for (const x of [-14, 14]) pts.push([x, -28], [x, 28]);
  const trunks = new THREE.InstancedMesh(palm.trunk, new THREE.MeshStandardMaterial({ map: trunkTex(), roughness: 0.95 }), pts.length);
  const crowns = new THREE.InstancedMesh(palm.crown, new THREE.MeshStandardMaterial({ map: frondTex(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 }), pts.length);
  const M = new THREE.Matrix4();
  pts.forEach(([x, z], i) => { M.makeTranslation(x, 0, z); trunks.setMatrixAt(i, M); crowns.setMatrixAt(i, M); });
  out.group.add(trunks, crowns);
  const flagCols = [0x14273d, 0xd4a72c, 0xffffff];
  for (let i = 0; i < 9; i++) {
    const fx = -16 + i * 4, fz = 36;
    out.group.add(mesh([at(new THREE.CylinderGeometry(0.05, 0.06, 8, 8), fx, 4, fz)], new THREE.MeshStandardMaterial({ color: 0xd8dce2, metalness: 0.8, roughness: 0.3 })));
    out.group.add(mesh([at(new THREE.PlaneGeometry(1.6, 1.0), fx + 0.82, 7.3, fz)], new THREE.MeshStandardMaterial({ color: flagCols[i % 3], roughness: 0.7, side: THREE.DoubleSide })));
  }
  bushGroup(out, [[-20, -24, 1.2], [20, -24, 1.2], [-20, 24, 1.2], [20, 24, 1.2]], 0x3f6b30);
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.45 });
  const stone = new THREE.MeshStandardMaterial({ color: 0xe6dfd0, roughness: 0.6 });
  // piscine à débordement avec plage en teck, transats et parasols
  {
    const pz = 28;
    out.group.add(mesh([at(new THREE.BoxGeometry(22, 0.35, 11), 0, 0.175, pz)], stone, { shadow: true }));
    flat(out, 21.6, 10.6, 0, pz, 0xb08a5a, 0.36, TX.photoTex('brown_planks_05', 8, 4));
    out.group.add(mesh([at(new THREE.PlaneGeometry(16, 6), 0, 0.37, pz, -Math.PI / 2)], new THREE.MeshStandardMaterial({ color: 0x2aa6d6, roughness: 0.03, metalness: 0.25, emissive: 0x0a4a66, emissiveIntensity: 0.3 })));
    out.group.add(mesh([at(new THREE.BoxGeometry(16.3, 0.06, 0.15), 0, 0.38, pz - 3.05), at(new THREE.BoxGeometry(16.3, 0.06, 0.15), 0, 0.38, pz + 3.05), at(new THREE.BoxGeometry(0.15, 0.06, 6), -8.1, 0.38, pz), at(new THREE.BoxGeometry(0.15, 0.06, 6), 8.1, 0.38, pz)], white));
    const lounger = [], umb = [], umbP = [];
    for (let i = 0; i < 7; i++) for (const sz of [-1, 1]) {
      const lx = -7.2 + i * 2.4, lz = pz + sz * 4.4;
      lounger.push(at(new THREE.BoxGeometry(0.7, 0.12, 1.8), lx, 0.62, lz), at(new THREE.BoxGeometry(0.7, 0.55, 0.12), lx, 0.85, lz - sz * 0.85, sz * 0.55));
      if (Math.random() < 0.45) out.crowdSeats.push({ x: lx, y: 0.62, z: lz, ry: sz > 0 ? Math.PI : 0 });
      if (i % 2 === 0) { umb.push(at(new THREE.ConeGeometry(1.25, 0.45, 10), lx + 1.2, 2.6, lz)); umbP.push(at(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), lx + 1.2, 1.55, lz)); }
    }
    out.group.add(mesh(lounger, white, { shadow: true }), mesh(umb, new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.7 }), { shadow: true }), mesh(umbP, gold));
  }
  // fontaine à vasques avec une raquette dorée monumentale, côté loge VIP
  {
    const fz = -31;
    out.group.add(mesh([at(new THREE.CylinderGeometry(4, 4.2, 0.6, 32), 0, 0.3, fz), at(new THREE.CylinderGeometry(1.6, 1.8, 1.4, 24), 0, 0.7, fz), at(new THREE.CylinderGeometry(0.9, 0.6, 0.35, 20), 0, 1.9, fz)], stone, { shadow: true }));
    out.group.add(mesh([at(new THREE.CylinderGeometry(3.8, 3.8, 0.02, 32), 0, 0.58, fz)], water));
    const rk = makeRacketMesh(RACKETS.find((r) => r.id === 'gold') || RACKETS[0], designById('gold24'));
    rk.scale.setScalar(6); rk.rotation.set(0, 0, -Math.PI / 2); rk.position.set(0, 2.05 + 0.02 * 6, fz); out.group.add(rk);
  }
  // hôtel de luxe (balcons, verre) et spa en bois et verre
  {
    const hx = 26, hz = -36;
    out.group.add(mesh([at(new THREE.BoxGeometry(24, 15, 9), hx, 7.5, hz)], white, { shadow: true }));
    const glass = new THREE.MeshStandardMaterial({ color: 0x7fb2c8, roughness: 0.05, metalness: 0.7, emissive: 0x1a2c38, emissiveIntensity: 0.4 });
    out.windows.push(glass);
    const bal = [], win = [];
    for (let f = 0; f < 4; f++) for (let k = 0; k < 7; k++) {
      const x = hx - 10.3 + k * 3.43, y = 2.2 + f * 3.4;
      win.push(at(new THREE.PlaneGeometry(2.6, 2.3), x, y + 0.6, hz + 4.52));
      bal.push(at(new THREE.BoxGeometry(3, 0.12, 1.1), x, y - 0.5, hz + 5.05), at(new THREE.BoxGeometry(3, 0.9, 0.04), x, y - 0.05, hz + 5.58));
    }
    out.group.add(mesh(win, glass), mesh(bal, new THREE.MeshStandardMaterial({ color: 0xdfe6ea, roughness: 0.2, metalness: 0.5, transparent: true, opacity: 0.85 })));
    sign(out, renderer, 'RIVIERA HOTEL & SPA', [['#0d1b2a', '#1b263b'], '#d4a72c', '#d4a72c'], 9, hx, 15.8, hz + 4.6, 0);
    // spa
    out.group.add(mesh([at(new THREE.BoxGeometry(16, 4, 8), 26, 2, 34)], new THREE.MeshStandardMaterial({ color: 0x8a5f3c, roughness: 0.7 }), { shadow: true }));
    out.group.add(mesh([at(new THREE.PlaneGeometry(14, 3), 26, 2, 29.98, 0, Math.PI)], glass));
    out.group.add(mesh([at(new THREE.BoxGeometry(17, 0.35, 9), 26, 4.17, 34)], white));
    sign(out, renderer, 'SPA', [['#2b1d12', '#5a3b22'], '#f5e6b0', '#f5e6b0'], 3, 26, 4.8, 29.4, Math.PI);
  }
  // bar à champagne sous pergola, côté ouest
  {
    const bx = -26, bz = 31;
    out.group.add(mesh([at(new THREE.BoxGeometry(7, 1.1, 1.2), bx, 0.55, bz)], new THREE.MeshStandardMaterial({ color: 0x14273d, roughness: 0.4 }), { shadow: true }));
    out.group.add(mesh([at(new THREE.BoxGeometry(7.2, 0.06, 1.4), bx, 1.13, bz)], gold));
    const per = [];
    for (const x of [-5, -1.7, 1.7, 5]) for (const z of [-2.5, 2.5]) per.push(at(new THREE.BoxGeometry(0.18, 3, 0.18), bx + x, 1.5, bz + z));
    for (let k = 0; k < 9; k++) per.push(at(new THREE.BoxGeometry(0.12, 0.2, 5.4), bx - 5 + k * 1.25, 3.05, bz));
    out.group.add(mesh(per, white, { shadow: true }));
    sign(out, renderer, 'CHAMPAGNE BAR', [['#0d1b2a', '#1b263b'], '#d4a72c', '#d4a72c'], 4, bx, 2.2, bz - 0.62, Math.PI);
    for (let i = 0; i < 5; i++) out.crowdSeats.push({ x: bx - 2.4 + i * 1.2, y: 0.03, z: bz - 1.4, ry: 0 });
  }
  // haies taillées et topiaires en cône le long des allées latérales
  const hedgeM = new THREE.MeshStandardMaterial({ color: 0x2f5a2a, roughness: 0.95 });
  const hedges = [], topi = [];
  for (const sx of [-1, 1]) {
    hedges.push(at(new THREE.BoxGeometry(1.0, 1.1, 50), sx * 35, 0.55, 0));
    for (let z = -24; z <= 24; z += 6) topi.push(at(new THREE.ConeGeometry(0.75, 2.6, 12), sx * 35, 2.4, z));
  }
  out.group.add(mesh(hedges, hedgeM, { shadow: true }), mesh(topi, hedgeM, { shadow: true }));
  city(out, 0.7);
  horizon(out, { r0: 70, r1: 110, kinds: ['pine', 'plane', 'cypress'], n: 50 });
}

/**
 * Tennis de La Ciotat (d'après les photos) : 4 courts de padel en carré, sol couleur terre battue,
 * structures noires et bâches sombres ; allées en béton avec deux tonnelles bleu marine ;
 * côté est, une tribune en gradins gris monte jusqu'au club-house (terrasse sous auvent beige),
 * avec un escalier à rampe ; courts de tennis tout autour (terre battue et résine verte),
 * parking en haut, pins d'Alep, palmiers, lauriers-roses et agaves.
 */
function decorLaCiotat(out, renderer) {
  const UP = 3.2;                                       // hauteur de la plateforme du club-house
  // sol : terre sèche et herbe rase autour, béton gris-vert entre les courts
  const dirt = TX.groundTex(renderer, 'dirt', 40);
  flat(out, 300, 300, 0, 0, 0xf2e2c8, -0.03, dirt);
  flat(out, 46, 54, 0, 1, 0xa8ad9f, -0.015, TX.groundTex(renderer, 'concrete', 10, 18));
  flat(out, 3.4, 48, 0, 0, 0x8e9a8a, -0.008);
  flat(out, 30, 3.4, 0, 0, 0x8e9a8a, -0.007);

  // bancs blancs le long des allées
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 });
  const benchGeo = [];
  for (const [bx, bz] of [[-13.3, -4], [-13.3, 4], [14.2, -22], [-13.3, -22], [-13.3, 22]]) {
    benchGeo.push(at(new THREE.BoxGeometry(0.5, 0.06, 1.8), bx, 0.45, bz), at(new THREE.BoxGeometry(0.08, 0.45, 1.8), bx - 0.22, 0.7, bz));
    for (const sz of [-0.8, 0.8]) benchGeo.push(at(new THREE.BoxGeometry(0.45, 0.45, 0.06), bx, 0.22, bz + sz));
  }
  out.group.add(mesh(benchGeo, white, { shadow: true }));

  // --- tribune en gradins (est) qui monte à la plateforme du club-house, et escalier à rampe
  const TX0 = 23.4, steps = 7, run = 0.95, rise = UP / steps;   // tribune un peu éloignée du court central
  const conc = new THREE.MeshStandardMaterial({ color: 0x9ea3a8, roughness: 0.9 });
  const tread = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.85 });
  const st = [], tr = [];
  for (let i = 0; i < steps; i++) {
    const x = TX0 + i * run + run / 2, h = (i + 1) * rise;
    st.push(at(new THREE.BoxGeometry(run, h, 22), x, h / 2, -3));
    tr.push(at(new THREE.BoxGeometry(run * 0.98, 0.04, 22), x, h + 0.02, -3));
    if (i < steps - 1 && i % 1 === 0) for (let k = 0; k < 22; k++) if (Math.random() < 0.18) out.crowdSeats.push({ x: x, y: h + 0.02, z: -13.5 + k + 0.5, ry: -Math.PI / 2 });
  }
  out.group.add(mesh(st, conc, { shadow: true }), mesh(tr, tread));
  // escalier étroit avec rampe blanche, au bout de la tribune
  const stair = [], rail = [];
  for (let i = 0; i < steps * 2; i++) { const x = TX0 + i * run / 2 + run / 4, h = (i + 1) * rise / 2; stair.push(at(new THREE.BoxGeometry(run / 2, h, 2.2), x, h / 2, 9.3)); }
  out.group.add(mesh(stair, conc, { shadow: true }));
  const railLen = Math.hypot(steps * run, UP), railAng = Math.atan2(UP, steps * run);
  for (const rz of [8.2, 10.4]) {
    rail.push(at(new THREE.CylinderGeometry(0.025, 0.025, railLen, 6).rotateZ(Math.PI / 2 - railAng), TX0 + steps * run / 2, UP / 2 + 0.95, rz));
    for (let i = 0; i <= steps; i += 2) rail.push(at(new THREE.CylinderGeometry(0.02, 0.02, 0.95, 6), TX0 + i * run, i * rise + 0.47, rz));
  }
  out.group.add(mesh(rail, white));
  // plateforme haute : mur de soutènement là où il n'y a pas de gradins, sol en terre claire
  const plat0 = TX0 + steps * run;
  out.group.add(mesh([at(new THREE.BoxGeometry(80, UP, 120), plat0 + 40, UP / 2, 0)], new THREE.MeshStandardMaterial({ color: 0xcbb99a, roughness: 1 }), { shadow: true }));
  flat(out, 80, 120, plat0 + 40, 0, 0xe9dcc4, UP + 0.005, TX.groundTex(renderer, 'dirt', 20, 30));
  const wall = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.95 });
  out.group.add(mesh([at(new THREE.BoxGeometry(0.4, UP, 30), TX0 - 0.2, UP / 2, -29), at(new THREE.BoxGeometry(0.4, UP, 40), TX0 - 0.2, UP / 2, 30.5)], wall, { shadow: true }));
  // garde-corps blanc en haut des gradins
  const top = [];
  top.push(at(new THREE.BoxGeometry(0.05, 0.05, 24), plat0 + 0.3, UP + 1, -2));
  for (let z = -14; z <= 10; z += 2) top.push(at(new THREE.BoxGeometry(0.05, 1, 0.05), plat0 + 0.3, UP + 0.5, z));
  out.group.add(mesh(top, white));

  // --- club-house : murs blancs, toit de tuiles, terrasse couverte d'un auvent beige
  const ch = building(out, { x: plat0 + 13, y: UP, z: -2, w: 18, d: 9, h: 3.4, wall: 0xf4efe6, roof: 0xb5603f, tiles: true, rotY: Math.PI / 2, keepWin: (side) => side < 0 });
  ch.children[0].material.color.set(0xf1ebe0);
  const terr = new THREE.Group(); terr.position.set(plat0 + 3.6, UP, -2); out.group.add(terr);
  terr.add(mesh([at(new THREE.BoxGeometry(5.6, 0.08, 18), 0, 3.0, 0, 0, 0, -0.06)], new THREE.MeshStandardMaterial({ color: 0xe6d3b0, roughness: 0.8, side: THREE.DoubleSide }), { shadow: true }));
  terr.add(mesh([-8.6, -4.3, 0, 4.3, 8.6].map((z) => at(new THREE.CylinderGeometry(0.05, 0.05, 2.9, 8), -2.6, 1.45, z)), white));
  flat({ ...out, group: terr }, 5.6, 18, 0, 0, 0xc9b08a, 0.02, TX.photoTex('brown_planks_05', 3, 9));
  const tables = [];
  for (let i = 0; i < 5; i++) {
    const tz = -7 + i * 3.5;
    tables.push(at(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 14), 0.4, 0.74, tz), at(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 6), 0.4, 0.36, tz));
    for (const dz of [-0.6, 0.6]) if (Math.random() < 0.7) out.crowdSeats.push({ x: plat0 + 4, y: UP + 0.03, z: -2 + tz + dz, ry: dz > 0 ? Math.PI : 0 });
  }
  terr.add(mesh(tables, new THREE.MeshStandardMaterial({ color: 0x3a2d22, roughness: 0.6 }), { shadow: true }));
  sign(out, renderer, 'TENNIS CLUB · PADEL', [['#111214', '#26282c'], '#ffffff', '#ff8a50'], 6, plat0 + 8.45, UP + 2.6, -2, Math.PI / 2);
  sign(out, renderer, 'PADEL · RÉSERVATIONS AU CLUB-HOUSE', [['#111214', '#26282c'], '#ffffff', '#e0e0e0'], 6, plat0 + 0.35, UP + 1.35, -11, Math.PI / 2);

  // --- verdure autour du club-house, surtout sur sa droite (vu depuis les courts)
  {
    const hi = { ...out, group: new THREE.Group() }; hi.group.position.y = UP; out.group.add(hi.group);
    treeInstances(hi, 'pine', [[plat0 + 6, 13, 1.0], [plat0 + 12, 16, 1.15], [plat0 + 19, 12, 0.95], [plat0 + 24, 4, 1.1], [plat0 + 22, -14, 1.0], [plat0 + 8, -17, 0.9]]);
    treeInstances(hi, 'plane', [[plat0 + 15, 9, 0.8]]);
    treeInstances(hi, 'cypress', [[plat0 + 2.2, 9.5, 0.9], [plat0 + 2.2, -13, 0.9]]);
    bushGroup(hi, [[plat0 + 3, 12, 1.2], [plat0 + 5, 16, 1.4], [plat0 + 9, 11.5, 1.1], [plat0 + 13, 13, 1.3], [plat0 + 17, 17, 1.2], [plat0 + 20, 8, 1.0], [plat0 + 4, 20, 1.3], [plat0 + 10, 21, 1.1], [plat0 + 3, -12, 1.0], [plat0 + 6, -15, 1.2]], 0x3f6b30);
    bushGroup(hi, [[plat0 + 7, 14, 0.8], [plat0 + 15, 19, 0.9], [plat0 + 11, 18, 0.7], [plat0 + 2.5, 15, 0.7]], 0x7f9a45);
  }

  // --- parking surélevé au bout des courts, sur une restanque de terre plantée de buissons
  {
    const PH = 1.6, px0 = -16, px1 = 12, pz0 = 37, pz1 = 62;
    const earth = new THREE.MeshStandardMaterial({ color: 0xb59a74, roughness: 1 });
    out.group.add(mesh([at(new THREE.BoxGeometry(px1 - px0, PH, pz1 - pz0), (px0 + px1) / 2, PH / 2, (pz0 + pz1) / 2)], earth, { shadow: true }));
    // talus en pente (restanque) côté courts
    const slope = new THREE.Mesh(new THREE.PlaneGeometry(px1 - px0, Math.hypot(2.2, PH)), new THREE.MeshStandardMaterial({ map: TX.groundTex(renderer, 'dirt', 8, 1), color: 0xd8c6a6, roughness: 1 }));
    slope.rotation.x = -Math.PI / 2 + Math.atan2(PH, 2.2); slope.position.set((px0 + px1) / 2, PH / 2, pz0 - 1.1); slope.receiveShadow = true; out.group.add(slope);
    // pierres sèches au pied de la restanque
    limestone(out, Array.from({ length: 16 }, (_, i) => [px0 + 0.8 + i * 1.75, pz0 - 2.1, 0.32 + (i % 3) * 0.08]));
    bushGroup(out, Array.from({ length: 12 }, (_, i) => [px0 + 1.2 + i * 2.3, pz0 - 0.9 + (i % 2) * 0.4, 0.55 + (i % 3) * 0.15]), 0x4c7a36);
    bushGroup(out, Array.from({ length: 6 }, (_, i) => [px0 + 2.4 + i * 4.6, pz0 - 1.4, 0.45]), 0x8a9a5a);
    const park = { ...out, group: new THREE.Group() }; park.group.position.y = PH; out.group.add(park.group);
    flat(park, px1 - px0 - 1, pz1 - pz0 - 1, (px0 + px1) / 2, (pz0 + pz1) / 2, 0x5a5d61, 0.01);
    const pl = [];
    for (let i = 0; i <= 10; i++) pl.push(at(new THREE.PlaneGeometry(0.1, 4.6), px0 + 1.5 + i * 2.5, 0.02, pz0 + 3.3, -Math.PI / 2), at(new THREE.PlaneGeometry(0.1, 4.6), px0 + 1.5 + i * 2.5, 0.02, pz1 - 3.3, -Math.PI / 2));
    park.group.add(mesh(pl, new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.8 })));
    const carCols = [0x1c2a4a, 0xe8e8e8, 0x8c1c1c, 0x2b2b2b, 0x9aa0a6, 0x2e5d8a, 0xd8c8a0, 0x101010];
    for (let i = 0; i < 20; i++) if (Math.random() < 0.7) car(park, px0 + 2.75 + (i % 10) * 2.5, i < 10 ? pz0 + 3.3 : pz1 - 3.3, i < 10 ? 0 : Math.PI, carCols[i % carCols.length]);
    treeInstances(park, 'pine', [[px0 + 1, pz0 + 12, 1.0], [px1 - 1, pz0 + 10, 1.1]]);
  }

  // --- courts de tennis autour : terre battue et résine verte
  tennisCourt(out, renderer, -28, -14, 'clay');
  tennisCourt(out, renderer, -38, 27, 'hard', 0x2e7a55);
  tennisCourt(out, renderer, -4, -48, 'clay');
  tennisCourt(out, renderer, -28, -52, 'hard', 0x2e7a55);

  // --- végétation : pins d'Alep, palmiers, lauriers-roses en fleurs, agaves
  treeInstances(out, 'pine', [[-16, -30, 1.1], [-25, 2, 1.0], [16, -30, 1.2], [-40, 4, 1.1], [14, 34, 1.0], [-16, 34], [26, 26, 1.1], [30, -26], [-42, -34, 1.2], [8, -64], [-20, 62, 1.1], [40, 40]]);
  treeInstances(out, 'cypress', [[13.6, -26], [13.6, -30], [-15, -36]]);
  bushGroup(out, [[-14.6, -10, 1.1], [-14.8, -16, 0.9], [-14.6, 21.5, 1.0], [-8, 21.8, 1.2], [14.6, 21.6, 1.0], [8, 22, 0.9], [-1, -27, 1.2], [3, 27, 1.0]], 0x3f6b30);
  // fleurs de laurier-rose (petites taches roses sur certains buissons)
  const fl = [];
  for (const [bx, bz, r] of [[-14.6, -10, 1.1], [-14.6, 21.5, 1.0], [14.6, 21.6, 1.0], [-1, -27, 1.2]]) for (let k = 0; k < 40; k++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2;
    fl.push(at(new THREE.SphereGeometry(0.06, 5, 4), bx + Math.cos(a) * Math.sin(e) * r, r * 0.62 + Math.cos(e) * r * 0.78, bz + Math.sin(a) * Math.sin(e) * r));
  }
  out.group.add(mesh(fl, new THREE.MeshStandardMaterial({ color: 0xe85a8a, roughness: 0.7 })));
  // agaves panachés
  const ag = [], agY = [];
  for (const [axx, azz] of [[-15.5, -2], [-15.8, 2.5], [22.6, 21], [16, -20], [-2.5, 27.5], [2.5, -27.5]]) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, tilt = 0.5 + (k % 3) * 0.2;
      const leaf = new THREE.ConeGeometry(0.09, 1.1, 4).translate(0, 0.55, 0).rotateX(tilt).rotateY(a);
      (k % 2 ? agY : ag).push(leaf.translate(axx, 0, azz));
    }
  }
  out.group.add(mesh(ag, new THREE.MeshStandardMaterial({ color: 0x5f8a5a, roughness: 0.7 }), { shadow: true }));
  out.group.add(mesh(agY, new THREE.MeshStandardMaterial({ color: 0xa7b46a, roughness: 0.7 }), { shadow: true }));
  // palmiers près de la tribune
  const palm = palmTemplate();
  const pts = [[22.4, 4.5], [31.5, 12.5], [31.5, -16.5]];
  const trunks = new THREE.InstancedMesh(palm.trunk, new THREE.MeshStandardMaterial({ map: trunkTex(), roughness: 0.95 }), pts.length);
  const crowns = new THREE.InstancedMesh(palm.crown, new THREE.MeshStandardMaterial({ map: frondTex(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 }), pts.length);
  const M = new THREE.Matrix4();
  pts.forEach(([x, z], i) => { M.makeScale(0.7, 0.7, 0.7).setPosition(x, x > plat0 ? UP : 0, z); trunks.setMatrixAt(i, M); crowns.setMatrixAt(i, M); });
  out.group.add(trunks, crowns);
  horizon(out, { r0: 75, r1: 120, kinds: ['pine', 'pine', 'cypress'], n: 50 });
}

function decorCeyreste(out, renderer) {
  const DEPTH = 0.9;                                  // la terrasse est en contrebas de la terre
  const deck = { x0: -60, x1: -27.5, z0: -16, z1: 27.5 };

  // --- sol en terre, avec un trou pour la terrasse en contrebas
  const dirt = TX.groundTex(renderer, 'dirt', 40);

  const outer = new THREE.Shape();
  outer.moveTo(-150, -150); outer.lineTo(150, -150); outer.lineTo(150, 150); outer.lineTo(-150, 150); outer.closePath();
  const hole = new THREE.Path();
  hole.moveTo(deck.x0, deck.z0); hole.lineTo(deck.x0, deck.z1); hole.lineTo(deck.x1, deck.z1); hole.lineTo(deck.x1, deck.z0); hole.closePath();
  outer.holes.push(hole);
  const groundGeo = new THREE.ShapeGeometry(outer, 1);
  groundGeo.rotateX(Math.PI / 2);                     // plan XY -> XZ (z du plan = z du monde)
  const uv = groundGeo.attributes.uv, gp = groundGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, gp.getX(i) / 300 + 0.5, gp.getZ(i) / 300 + 0.5);
  const groundMesh = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ map: dirt, normalMap: dirt.userData.normal, color: 0xfff4e2, roughness: 1, side: THREE.DoubleSide }));
  groundMesh.receiveShadow = true;
  out.group.add(groundMesh);

  // --- terrasse en planches, en contrebas, et talus de terre
  const planks = TX.photoTex('brown_planks_05', 12, 16);
  const dw = deck.x1 - deck.x0, dd = deck.z1 - deck.z0, dcx = (deck.x0 + deck.x1) / 2, dcz = (deck.z0 + deck.z1) / 2;
  flat(out, dw, dd, dcx, dcz, 0xffffff, -DEPTH, planks);
  const bank = new THREE.MeshStandardMaterial({ color: 0xa8865e, roughness: 1 });
  out.group.add(mesh([
    at(new THREE.BoxGeometry(0.4, DEPTH, dd), deck.x1 + 0.2, -DEPTH / 2, dcz),
    at(new THREE.BoxGeometry(dw, DEPTH, 0.4), dcx, -DEPTH / 2, deck.z0 - 0.2),
    at(new THREE.BoxGeometry(dw, DEPTH, 0.4), dcx, -DEPTH / 2, deck.z1 + 0.2),
  ], bank, { shadow: true }));
  // escalier en bois pour descendre sur la terrasse
  const steps = [];
  for (let i = 0; i < 4; i++) steps.push(at(new THREE.BoxGeometry(0.4, 0.06, 2.4), deck.x1 - 0.3 - i * 0.4, -0.2 - i * 0.22, 6));
  out.group.add(mesh(steps, new THREE.MeshStandardMaterial({ color: 0x7a4f2c, roughness: 0.9 })));
  // garde-corps en bois au bord du talus
  const rail = [];
  for (let z = deck.z0; z <= deck.z1; z += 2.5) { if (Math.abs(z - 6) > 1.5) rail.push(at(new THREE.BoxGeometry(0.08, 1, 0.08), deck.x1 + 0.1, 0.5, z)); }
  rail.push(at(new THREE.BoxGeometry(0.06, 0.06, dd), deck.x1 + 0.1, 0.98, dcz));
  out.group.add(mesh(rail, new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.9 })));

  // --- club-house en contrebas : murs ocre clair, toit de tuiles
  // façade côté terrasse presque aveugle (porte, store, panneau) comme sur les photos
  const ch = building(out, { x: -46, y: -DEPTH, z: 4.5, w: 22, d: 12, h: 3.6, wall: 0xe0bf86, roof: 0xb5603f, tiles: true, rotY: Math.PI / 2, keepWin: (side, i) => side < 0 || i >= 7 });
  ch.children[0].material.color.set(0xdcb57c);
  sign(out, renderer, 'TENNIS PADEL CEYRESTE', [['#123f86', '#1f5fbf'], '#ffffff', '#f2c94c'], 7.5, -39.85, 2.4, 4.5, Math.PI / 2);
  // tables sur la terrasse
  const tops = [], legs = [];
  for (let i = 0; i < 4; i++) {
    const x = i % 2 ? -30.5 : -33, z = 18 + i * 2.6;
    tops.push(at(new THREE.ConeGeometry(1.3, 0.45, 10), x, 2.4 - DEPTH, z));
    legs.push(at(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6), x, 1.15 - DEPTH, z), at(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 12), x, 0.74 - DEPTH, z));
    for (const dz of [-0.7, 0.7]) if (Math.random() < 0.6) out.crowdSeats.push({ x, y: 0.05 - DEPTH, z: z + dz, ry: Math.PI / 2 });
  }
  out.group.add(mesh(tops, new THREE.MeshStandardMaterial({ color: 0xf3e3c3, roughness: 0.8 }), { shadow: true }));
  out.group.add(mesh(legs, new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.6, roughness: 0.4 })));

  // fête de village sur la terrasse en contrebas
  fete(out, renderer, -37, -10.5, Math.PI / 2, -DEPTH, 'FÊTE DU PADEL · CEYRESTE');

  // --- route (en haut à gauche du plan)
  flat(out, 6.5, 60, -60, -44, 0x6e7074, 0.01);
  const kerb = [];
  for (const dx of [-3.3, 3.3]) kerb.push(at(new THREE.BoxGeometry(0.2, 0.15, 60), -60 + dx, 0.075, -44));
  out.group.add(mesh(kerb, new THREE.MeshStandardMaterial({ color: 0xbfbfbf, roughness: 0.9 })));

  // --- courts de tennis : gris foncé au fond à gauche, bordeaux devant à droite (axe long selon x)
  // (le gris et le bordeaux du plan sont des courts de padel : voir VENUE_COURTS)
  // courts de tennis : sous le club-house, à l'opposé des courts de padel
  tennisCourt(out, renderer, -54, 46, 'hard', 0x2f6e8f);
  tennisCourt(out, renderer, -36, 46, 'clay');

  // allées en béton entre les courts
  flat(out, 3, 30, -6.8, -2.8, 0x8f8a80, 0.009);
  flat(out, 3, 30, 7.1, 3.2, 0x8f8a80, 0.009);

  // --- cabane en bois (devant à gauche)
  const cab = building(out, { x: -14.6, z: 17.5, w: 4.2, d: 3.4, h: 2.6, wall: 0xffffff, roof: 0x4a3324, wood: true, rotY: 0.05 });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.9), new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.8 }));
  door.position.set(-0.9, 0.95, 1.71); cab.add(door);
  for (let i = 0; i < 3; i++) out.crowdSeats.push({ x: -11.6 + i * 0.7, y: 0.03, z: 17.2, ry: Math.PI });
  out.group.add(mesh([at(new THREE.BoxGeometry(2.4, 0.45, 0.45), -10.9, 0.225, 17.2)], new THREE.MeshStandardMaterial({ color: 0x8a6542, roughness: 0.8 }), { shadow: true }));
  // poubelle bleue et muret de pierres (photo)
  out.group.add(mesh([at(new THREE.CylinderGeometry(0.35, 0.35, 1, 12), -10.3, 0.5, 14.8)], new THREE.MeshStandardMaterial({ color: 0x1f5fbf, roughness: 0.6 })));
  const stone = new THREE.MeshStandardMaterial({ color: 0xcbbd9f, roughness: 1, flatShading: true });


  ceyresteDetails(out, renderer, DEPTH);

  // --- végétation : arbres et buissons du plan, pins sur les collines
  const bushMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true });
  const bushes = (pts, color) => bushGroup(out, pts, color);
  bushes([[-48, -41, 2.6], [-43, -41, 2.2], [-38, -42, 2.4], [-30, -41, 2], [-11, -29, 2.6], [15, -27, 2.8], [-52, -38, 2]], 0x2f6b32);
  bushes([[-34, -42, 2.2], [-25, -42, 2.4], [1.7, -29, 2.4], [-20, -40, 1.8]], 0x8fb83a);
  treeInstances(out, 'pine', [[-40, -48, 1.2], [-24, -50], [-6, -40, 1.1], [10, -42], [26, -36, 1.2], [38, -10], [44, 4, 1.1], [-66, 10], [-70, -20, 1.2]]);
  hills(out, [0x3f5b2c, 0x5b7337, 0xb9b09a]);
  rocks(out, [[-46, -36, 1.6], [-40, -38, 0.9], [-28, -37, 1.2], [-12, -33, 0.8], [6, -34, 1.4], [18, -31, 0.7], [30, -28, 1.8], [40, -14, 1.1], [44, 0, 2.2], [42, 12, 0.9],
    [-64, 6, 1.5], [-66, -14, 2.0], [-55, 34, 1.0], [20, 26, 0.6], [-20, 24, 0.5], [8, 24, 0.7], [-4, -22, 0.45], [12, -21, 0.5], [-30, 14, 0.6], [26, -4, 0.55]]);
}

/** Court de tennis orienté selon x (axe long horizontal sur le plan). */
function tennisCourtX(out, renderer, x, z, color) {
  const g = new THREE.Group();
  const sub = { group: g, crowdSeats: [] };
  tennisCourt(sub, renderer, 0, 0, 'hard', color);
  g.rotation.y = Math.PI / 2;
  g.position.set(x, 0, z);
  out.group.add(g);
}

/** Court de padel voisin (géométrie simplifiée), placé en (x, z). */
function neighborCourtAt(x, z, mats) {
  const c = neighborCourtBase(0, mats);
  c.position.set(x, 0, z);
  return c;
}

function decorNational(out, renderer) {
  ground(out, renderer, 0x7d9c6a);
  const pave = TX.groundTex(renderer, 'paving', 30 / 2, 30 / 2);
  flat(out, 60, 60, 0, 0, 0x9a9590, 0.002, pave);
  stand(out, { x: 0, z: -(HL + 2.6), along: 'x', away: -1, length: 16, rows: 8, fill: 0.85, seatColor: 0x1565c0 });
  for (const sx of [-1, 1]) stand(out, { x: sx * (HW + 5.2), z: 0, along: 'z', away: sx, length: 18, rows: 6, fill: 0.8, seatColor: 0xc62828 });
  // écran géant et caméra TV
  const screen = new THREE.MeshStandardMaterial({ color: 0x0b1020, emissive: 0x4fc3f7, emissiveIntensity: 0.25 });
  out.emissive.push(screen);
  out.group.add(mesh([at(new THREE.BoxGeometry(6, 3.4, 0.3), 0, 8.4, -(HL + 10.5))], screen));
  out.group.add(mesh([at(new THREE.BoxGeometry(0.3, 6.5, 0.3), 0, 3.25, -(HL + 10.7))], new THREE.MeshStandardMaterial({ color: 0x23262c })));
  const palm = palmTemplate();
  // court annexe derrière la tribune latérale droite, avec ses propres gradins
  stand(out, { x: 28, z: -(HL + 2.2), along: 'x', away: -1, length: 13, rows: 5, fill: 0.6, seatColor: 0x1565c0 });
  stand(out, { x: 28 + HW + 3.0, z: 0, along: 'z', away: 1, length: 16, rows: 4, fill: 0.55, seatColor: 0xc62828 });
  flat(out, 14, 26, 28, 0, 0x9a9590, 0.004, TX.groundTex(renderer, 'paving', 7, 13));
  sign(out, renderer, 'COURT N° 2', [['#0b2a5b', '#1565c0'], '#ffffff', '#ffd400'], 4, 28, 4.6, -(HL + 6.6), 0);
  const pts = [[-20, -16], [19.5, -17], [-22, 10], [19.5, 15], [-14, 18], [36, 17]];
  const trunks = new THREE.InstancedMesh(palm.trunk, new THREE.MeshStandardMaterial({ map: trunkTex(), roughness: 0.95 }), pts.length);
  const crowns = new THREE.InstancedMesh(palm.crown, new THREE.MeshStandardMaterial({ map: frondTex(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 }), pts.length);
  const M = new THREE.Matrix4();
  pts.forEach(([x, z], i) => { M.makeTranslation(x, 0, z); trunks.setMatrixAt(i, M); crowns.setMatrixAt(i, M); });
  out.group.add(trunks, crowns);
  city(out, 0.5);
  horizon(out, { r0: 60, r1: 100, n: 60 });
}

function decorStadium(out, renderer) {
  ground(out, renderer, 0x3b4a35);
  const pave = TX.groundTex(renderer, 'paving', 40 / 2, 40 / 2);
  flat(out, 120, 120, 0, 0, 0x8a8580, 0.001, pave);                  // parvis extérieur
  flat(out, 2 * (HW + 6.8), 2 * (HL + 6.8), 0, 0, 0x101624, 0.002);   // fosse autour du court
  // cuvette elliptique : les gradins font le tour du court
  const rows = 14, A0 = 12.3, B0 = 17.6, rowD = 0.85, rowH = 0.55;
  const steps = [], seats = [], rails = [];
  for (let r = 0; r < rows; r++) {
    const a = A0 + r * rowD, b = B0 + r * rowD, top = 0.8 + (r + 1) * rowH;
    const n = Math.floor((2 * Math.PI * Math.sqrt((a * a + b * b) / 2)) / 0.62);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const x = a * Math.cos(t), z = b * Math.sin(t);
      const tx = -a * Math.sin(t), tz = b * Math.cos(t), tl = Math.hypot(tx, tz);
      const phi = Math.atan2(-tz / tl, tx / tl);
      steps.push(new THREE.BoxGeometry(0.64, top, rowD).rotateY(phi).translate(x, top / 2, z));
      // allées d'escaliers tous les 30 sièges
      if (i % 30 === 0) continue;
      seats.push(new THREE.BoxGeometry(0.44, 0.1, 0.42).rotateY(phi).translate(x, top + 0.05, z));
      if (Math.random() < 0.93) out.crowdSeats.push({ x, y: top + 0.03, z, ry: Math.atan2(-x, -z) });
    }
    if (r === 0) for (let i = 0; i < 96; i++) {
      const t = (i / 96) * Math.PI * 2;
      rails.push(new THREE.BoxGeometry(0.05, 1, 0.05).translate((a - 0.45) * Math.cos(t), top + 0.5, (b - 0.45) * Math.sin(t)));
    }
  }
  out.group.add(mesh(steps, new THREE.MeshStandardMaterial({ color: 0x3a3e46, roughness: 0.9 }), { shadow: true }));
  out.group.add(mesh(seats, new THREE.MeshStandardMaterial({ color: 0x1c3f7a, roughness: 0.6 })));
  out.group.add(mesh(rails, new THREE.MeshStandardMaterial({ color: 0x9aa2ad, metalness: 0.6, roughness: 0.4 })));
  // mur de face de la tribune basse : bandeau LED doré tout autour
  const led = new THREE.MeshStandardMaterial({ color: 0x0b1020, emissive: 0xd4a72c, emissiveIntensity: 0.6, side: THREE.DoubleSide });
  out.emissive.push(led);
  const band = new THREE.CylinderGeometry(1, 1, 0.8, 96, 1, true).scale(A0 - 0.45, 1, B0 - 0.45).translate(0, 0.9, 0);
  out.group.add(mesh([band], led));
  // façade extérieure, avec une bande de fenêtres éclairées, et toit en anneau
  const outerA = A0 + rows * rowD + 0.4, outerB = B0 + rows * rowD + 0.4;
  const fac = canvasTex(512, 64, (g, W, H) => {
    g.fillStyle = '#2b2f37'; g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 16) { g.fillStyle = Math.random() < 0.7 ? '#ffd9a0' : '#3b4250'; g.fillRect(x + 3, 26, 10, 12); }
    g.fillStyle = '#d4a72c'; g.fillRect(0, 56, W, 4);
  });
  fac.repeat.set(6, 1);
  const facMat = new THREE.MeshStandardMaterial({ map: fac, emissiveMap: fac, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.8, side: THREE.DoubleSide });
  out.windows.push(facMat);
  out.group.add(mesh([new THREE.CylinderGeometry(1, 1, 11, 96, 1, true).scale(outerA, 1, outerB).translate(0, 5.5, 0)], facMat, { shadow: true }));
  const roof = new THREE.RingGeometry(0.72, 1.02, 96, 1).rotateX(-Math.PI / 2).scale(outerA, 1, outerB).translate(0, 12.6, 0);
  out.group.add(mesh([roof], new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.7, side: THREE.DoubleSide })));
  // écrans géants accrochés sous le toit
  const screen = new THREE.MeshStandardMaterial({ color: 0x0b1020, emissive: 0x7df9ff, emissiveIntensity: 0.3 });
  out.emissive.push(screen);
  out.group.add(mesh([at(new THREE.BoxGeometry(7, 3.6, 0.3), 0, 10, -(B0 + 6)), at(new THREE.BoxGeometry(7, 3.6, 0.3), 0, 10, B0 + 6, 0, Math.PI)], screen));
  // chaise d'arbitre au filet et table des commentateurs
  officials(out, renderer);
  city(out, 0.7);
}

/** Le club du joueur : construit d'après ce qu'il a acheté (courts, tribunes, buvette, décos). */
function decorMyClub(out, renderer, club) {
  const has = (k) => club.decos?.includes(k);
  ground(out, renderer);
  const pave = TX.groundTex(renderer, 'paving', 24 / 2, 24 / 2);
  flat(out, 110, 90, 0, -20, 0x9c968c, 0.0015, pave);
  // club-house avec le nom du club (et la fresque)
  building(out, { x: -34, z: 10, w: 18, d: 11, h: 6.5, wall: has('mural') ? 0xf2efe6 : 0xd9d4cb, roof: 0x2b2f36, rotY: Math.PI / 2 });
  sign(out, renderer, club.name.toUpperCase(), [['#0b2a5b', '#123f86'], '#ffffff', '#ffd400'], 9, -28.4, 5.6, 10, Math.PI / 2);
  if (has('mural')) {
    const mural = canvasTex(512, 256, (g, W, H) => {
      const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#ff6f00'); gr.addColorStop(0.5, '#e91e63'); gr.addColorStop(1, '#3f51b5');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(170, 130, 70, 85, -0.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1a1a1a'; g.fillRect(205, 180, 90, 18);
      g.fillStyle = '#ffeb3b'; g.beginPath(); g.arc(380, 80, 28, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 56px sans-serif'; g.fillText('PADEL', 300, 220);
    });
    out.group.add(mesh([at(new THREE.PlaneGeometry(10, 4.4), -28.44, 2.6, 10, 0, Math.PI / 2)], new THREE.MeshStandardMaterial({ map: mural, roughness: 0.8 })));
  }
  // tribunes autour du court central : de plus en plus hautes
  if (club.stands > 0) {
    for (const sx of [-1, 1]) stand(out, { x: sx * (HW + 4.6), z: 0, along: 'z', away: sx, length: 14 + club.stands * 2.4, rows: club.stands * 2, fill: 0.55 + club.stands * 0.08, seatColor: 0xd81e2c });
    if (club.stands >= 3) stand(out, { x: 0, z: HL + 4, along: 'x', away: 1, length: 10 + club.stands * 2, rows: (club.stands - 2) * 2, fill: 0.7, seatColor: 0x1565c0 });
  }
  // buvette (et la fête du club quand elle est assez grande)
  if (club.bar > 0) fete(out, renderer, 25, 12, -Math.PI / 2, 0, club.bar >= 2 ? `FÊTE DU ${club.name.toUpperCase()}` : 'BUVETTE');
  // décos
  if (has('flags')) {
    const cols = [0xe53935, 0xffd400, 0x1e88e5, 0x43a047];
    const flags = cols.map(() => []);
    for (const sx of [-1, 1]) for (let i = 0; i < 26; i++) {
      const z = -HL + i * 0.8, sag = Math.sin((i / 25) * Math.PI) * 0.6;
      const tri = new THREE.ConeGeometry(0.16, 0.34, 3).rotateX(Math.PI).translate(sx * (HW + 0.5), 4.4 - sag, z);
      flags[i % 4].push(tri);
    }
    flags.forEach((f, i) => out.group.add(mesh(f, new THREE.MeshStandardMaterial({ color: cols[i], roughness: 0.8 }))));
  }
  if (has('flowers')) {
    const cols = [0xe91e63, 0xffeb3b, 0xff7043, 0xba68c8];
    cols.forEach((c, k) => {
      const geos = [];
      for (let i = 0; i < 40; i++) geos.push(at(new THREE.IcosahedronGeometry(0.18 + Math.random() * 0.1, 0), -22 + i * 1.1 + k * 0.27, 0.2, -14.5 + (k % 2) * 0.5));
      out.group.add(mesh(geos, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })));
    });
    out.group.add(mesh([at(new THREE.BoxGeometry(46, 0.3, 1.4), 0, 0.15, -14.3)], new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1 })));
  }
  if (has('palms')) {
    const palm = palmTemplate(), pts = [];
    for (let i = 0; i < 6; i++) pts.push([-22 + i * 8.8, -16.5]);
    const trunks = new THREE.InstancedMesh(palm.trunk, new THREE.MeshStandardMaterial({ map: trunkTex(), roughness: 0.95 }), pts.length);
    const crowns = new THREE.InstancedMesh(palm.crown, new THREE.MeshStandardMaterial({ map: frondTex(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 }), pts.length);
    const M = new THREE.Matrix4();
    pts.forEach(([x, z], i) => { M.makeTranslation(x, 0, z); trunks.setMatrixAt(i, M); crowns.setMatrixAt(i, M); });
    trunks.castShadow = crowns.castShadow = true;
    out.group.add(trunks, crowns);
  }
  if (has('fountain')) {
    const stone = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.85 });
    out.group.add(mesh([at(new THREE.CylinderGeometry(2.2, 2.4, 0.6, 32), -12, 0.3, -17), at(new THREE.CylinderGeometry(0.3, 0.4, 1.8, 16), -12, 0.9, -17), at(new THREE.CylinderGeometry(0.9, 0.5, 0.3, 24), -12, 1.8, -17)], stone, { shadow: true }));
    const water = new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85, emissive: 0x0b4a6b, emissiveIntensity: 0.3 });
    out.group.add(mesh([at(new THREE.CylinderGeometry(2.0, 2.0, 0.05, 32), -12, 0.58, -17), at(new THREE.ConeGeometry(0.6, 1.2, 16, 1, true), -12, 2.4, -17, Math.PI)], water));
  }
  if (has('statue')) {
    const bronze = new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 0.75, roughness: 0.35 });
    out.group.add(mesh([
      at(new THREE.BoxGeometry(1.6, 1.4, 1.6), 12, 0.7, -17),
      at(new THREE.CapsuleGeometry(0.3, 1.0, 4, 12), 12, 2.4, -17), at(new THREE.SphereGeometry(0.24, 16, 12), 12, 3.35, -17),
      at(new THREE.CapsuleGeometry(0.09, 0.8, 4, 8), 12.45, 3.3, -17, 0, 0, -0.5), at(new THREE.TorusGeometry(0.28, 0.05, 8, 20), 12.9, 3.95, -17, 0, Math.PI / 2, 0),
      at(new THREE.CapsuleGeometry(0.12, 0.9, 4, 8), 11.85, 1.85, -17), at(new THREE.CapsuleGeometry(0.12, 0.9, 4, 8), 12.15, 1.85, -17),
    ], bronze, { shadow: true }));
    sign(out, renderer, 'LE FONDATEUR', [['#2b1d0e', '#4e3519'], '#ffd400', '#ffd400'], 1.5, 12, 0.7, -16.19);
  }
  if (has('trophies')) {
    out.group.add(mesh([at(new THREE.BoxGeometry(3, 1, 0.8), -24, 0.5, 4)], new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.6 }), { shadow: true }));
    out.group.add(mesh([at(new THREE.BoxGeometry(3, 1.4, 0.8), -24, 1.7, 4)], new THREE.MeshStandardMaterial({ color: 0xcfe8ee, transparent: true, opacity: 0.25, roughness: 0.05 })));
    const gold = new THREE.MeshStandardMaterial({ color: 0xd4a72c, metalness: 0.9, roughness: 0.25 });
    out.emissive.push(gold);
    out.group.add(mesh([-1, 0, 1].flatMap((k) => [at(new THREE.CylinderGeometry(0.16, 0.06, 0.35, 12), -24 + k * 0.9, 1.45, 4), at(new THREE.CylinderGeometry(0.05, 0.12, 0.25, 10), -24 + k * 0.9, 1.15, 4)]), gold));
  }
  if (has('terrace')) {
    const cols = [0xe53935, 0xffffff, 0x1e88e5];
    for (let i = 0; i < 6; i++) {
      const x = -24 + (i % 3) * 3.4, z = 16 + Math.floor(i / 3) * 3.4;
      out.group.add(mesh([at(new THREE.ConeGeometry(1.3, 0.45, 10), x, 2.3, z)], new THREE.MeshStandardMaterial({ color: cols[i % 3], roughness: 0.8 }), { shadow: true }));
      out.group.add(mesh([at(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), x, 1.1, z), at(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 12), x, 0.74, z)], new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.7 })));
      for (const dz of [-0.7, 0.7]) out.crowdSeats.push({ x, y: 0.05, z: z + dz, ry: dz > 0 ? Math.PI : 0 });
    }
  }
  if (has('led')) {
    const cols = [0xff1744, 0x00e5ff, 0xd500f9];
    cols.forEach((c, i) => {
      const m = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: c, emissiveIntensity: 1.6 });
      out.emissive.push(m);
      const geos = [];
      for (const sx of [-1, 1]) geos.push(at(new THREE.BoxGeometry(0.06, 0.06, 2 * HL / 3 - 0.2), sx * (HW + 0.08), 4.05, -HL + (i + 0.5) * (2 * HL / 3)));
      out.group.add(mesh(geos, m));
    });
  }
  if (has('screen')) {
    const scr = new THREE.MeshStandardMaterial({ color: 0x0b1020, emissive: 0x7df9ff, emissiveIntensity: 0.35 });
    out.emissive.push(scr);
    out.group.add(mesh([at(new THREE.BoxGeometry(8, 4.5, 0.3), 0, 7.5, -15.5)], scr));
    out.group.add(mesh([at(new THREE.BoxGeometry(0.3, 5.3, 0.3), -3, 2.6, -15.7), at(new THREE.BoxGeometry(0.3, 5.3, 0.3), 3, 2.6, -15.7)], new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.5 })));
  }
  treeInstances(out, 'pine', [[-46, -40, 1.2], [-40, -62], [44, -40, 1.1], [46, 10], [-48, 30, 1.2], [30, 36]]);
  city(out, 0.5);
  horizon(out, { r0: 60, r1: 100, n: 60 });
}

/** Hangar régional : structure en arcs métalliques, bardage en tôle ondulée, verrières, buvette. */
function decorHangar(out, renderer) {
  const X0 = -14.5, X1 = 14.5, Z = 27, H = 6.5, K = 0.38;          // emprise ; K : aplatissement du cintre
  const W = X1 - X0, cx = (X0 + X1) / 2;
  // sol béton
  const conc = TX.groundTex(renderer, 'concrete', W / 6, Z / 3);
  flat(out, W + 40, 2 * Z + 40, cx, 0, 0x9a9a96, 0.001, conc);
  // tôle ondulée
  const tole = canvasTex(128, 512, (g, Wd, Ht) => {
    for (let x = 0; x < Wd; x++) {
      const k = Math.sin((x / Wd) * Math.PI * 4), v = 150 + k * 48 + (k > 0.92 ? 22 : 0);
      g.fillStyle = `rgb(${v - 6},${v},${v + 8})`; g.fillRect(x, 0, 1, Ht);
    }
    for (let y = 40; y < Ht; y += 128) for (let x = 8; x < Wd; x += 32) { g.fillStyle = 'rgba(40,40,45,0.6)'; g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill(); }
    const dg = g.createLinearGradient(0, Ht * 0.7, 0, Ht); dg.addColorStop(0, 'rgba(90,70,50,0)'); dg.addColorStop(1, 'rgba(90,70,50,0.35)'); g.fillStyle = dg; g.fillRect(0, 0, Wd, Ht);
    for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(110,80,50,${Math.random() * 0.12})`; g.fillRect(Math.random() * Wd, Ht * 0.55 + Math.random() * Ht * 0.45, 2, 10 + Math.random() * 50); }
  });
  const ribs = canvasTex(64, 8, (g, Wd, Ht) => { for (let x = 0; x < Wd; x++) { const v = 128 + Math.cos((x / Wd) * Math.PI * 4) * 110; g.fillStyle = `rgb(${v},128,255)`; g.fillRect(x, 0, 1, Ht); } });
  const panel = canvasTex(256, 256, (g, Wd, Ht) => {
    g.fillStyle = '#e9ecef'; g.fillRect(0, 0, Wd, Ht);
    for (let k = 0; k < 3000; k++) { const v = 220 + Math.random() * 30; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * Wd, Math.random() * Ht, 1, 1); }
    g.fillStyle = '#b9bec5'; g.fillRect(0, 0, Wd, 3); g.fillRect(0, 0, 3, Ht);
  });
  const toleMat = (rx, ry) => {
    const t = tole.clone(); t.needsUpdate = true; t.repeat.set(rx, ry);
    const n = ribs.clone(); n.needsUpdate = true; n.repeat.set(rx, 1);
    return new THREE.MeshStandardMaterial({ map: t, normalMap: n, normalScale: new THREE.Vector2(0.6, 0.6), color: 0xd2d6dc, metalness: 0.5, roughness: 0.42, side: THREE.DoubleSide });
  };
  // murs longs et pignons
  for (const sz of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(W, H), toleMat(W / 1.2, 1));
    w.position.set(cx, H / 2, sz * Z); w.rotation.y = sz > 0 ? Math.PI : 0;
    w.receiveShadow = true; out.group.add(w);
  }
  for (const sx of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(-Z, 0); shape.lineTo(Z, 0); shape.lineTo(Z, H);
    shape.absellipse(0, H, Z, Z * K, 0, Math.PI, false);
    shape.lineTo(-Z, 0);
    const g = new THREE.ShapeGeometry(shape, 24);
    const uv = g.attributes.uv, pp = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pp.getX(i) / 1.2, pp.getY(i) / 8);
    const m = new THREE.Mesh(g, toleMat(1, 1));
    m.material = m.material.clone(); m.material.side = THREE.DoubleSide;   // le pignon est doit se voir de l'intérieur
    m.rotation.y = Math.PI / 2; m.position.set(sx > 0 ? X1 : X0, 0, 0);
    out.group.add(m);
  }
  // toit cintré (demi-cylindre) avec verrières, et arcs métalliques
  const roofGeo = new THREE.CylinderGeometry(Z, Z, W, 48, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, K, 1);   // demi-cylindre du dessus (y ≥ 0)
  const roof = new THREE.Mesh(roofGeo, toleMat(W / 1.2, 6));
  roof.material.side = THREE.BackSide;                        // tôle vue de l'extérieur
  roof.position.set(cx, H, 0);
  roof.castShadow = false;
  const pan = panel.clone(); pan.needsUpdate = true; pan.repeat.set(W / 2.4, 12);
  const liner = new THREE.Mesh(roofGeo.clone().scale(1, 0.995, 0.995), new THREE.MeshStandardMaterial({ map: pan, roughness: 0.85, side: THREE.FrontSide }));
  liner.position.set(cx, H - 0.05, 0);
  out.group.add(liner);
  // pannes (poutres longitudinales) le long du cintre
  const purl = [];
  for (let k = 1; k < 10; k++) { const a = (k / 10) * Math.PI; purl.push(at(new THREE.BoxGeometry(W, 0.18, 0.12), cx, H + Math.sin(a) * Z * K - 0.15, Math.cos(a) * Z * 0.995)); }
  out.group.add(mesh(purl, new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.6, roughness: 0.45 })));
  out.group.add(roof);
  const sky = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, emissive: 0xdfefff, emissiveIntensity: 0.8, transparent: true, opacity: 0.85 });
  out.emissive.push(sky);
  const lights = [];
  for (let x = X0 + 3; x < X1 - 2; x += 6.4) lights.push(at(new THREE.BoxGeometry(2.2, 0.06, 2 * Z * 0.4), x, H + Z * K * 0.97, 0));
  out.group.add(mesh(lights, sky));
  const steel = new THREE.MeshStandardMaterial({ color: 0x2c3138, metalness: 0.7, roughness: 0.4 });
  const arcs = [];
  for (const x of [X0, -9.6, -4.9, 4.9, 9.6, X1]) {          // aucune colonne derrière les buvettes
    arcs.push(at(new THREE.TorusGeometry(Z - 0.15, 0.14, 6, 48, Math.PI).scale(1, K, 1), x, H, 0, 0, Math.PI / 2, 0));
    for (const sz of [-1, 1]) arcs.push(at(new THREE.BoxGeometry(0.3, H, 0.3), x, H / 2, sz * (Z - 0.15)));
  }
  out.group.add(mesh(arcs.map((g) => g.toNonIndexed ? g.toNonIndexed() : g), steel, { shadow: false }));
  // projecteurs suspendus au-dessus de chaque court (lumière intérieure)
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e6, emissiveIntensity: 3 });
  out.emissive.push(lamp);
  const lampGeos = [];
  out.lampBoxes = [];
  for (const cxx of [-6.2, 6.2]) for (const zz of [-18.5, -12.5, -6.5, 6.5, 12.5, 18.5]) { lampGeos.push(at(new THREE.BoxGeometry(1.2, 0.08, 0.35), cxx, H + 1.55, zz)); out.lampBoxes.push([cxx, H + 1.55, zz]); }
  out.group.add(mesh(lampGeos, lamp));
  // buvette au fond (côté pignon est) : comptoir, enseigne, frigo, tables hautes
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.85 });
  for (const side of [-1, 1]) {
    const bz = side * 24.3, F = side;   // derrière la ligne de fond, face aux courts
    out.group.add(mesh([at(new THREE.BoxGeometry(7, 1.1, 1), 0, 0.55, bz), at(new THREE.BoxGeometry(7.2, 0.06, 1.2), 0, 1.13, bz)], wood, { shadow: true }));
    out.group.add(mesh([at(new THREE.BoxGeometry(0.9, 1.9, 0.7), -4.6, 0.95, bz + F * 0.6), at(new THREE.BoxGeometry(0.9, 1.9, 0.7), -5.6, 0.95, bz + F * 0.6)], new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 0.4, roughness: 0.3 })));
    out.group.add(mesh([at(new THREE.BoxGeometry(8, 0.1, 2.6), 0, 2.9, bz + F * 0.2), at(new THREE.BoxGeometry(0.1, 2.9, 0.1), -3.9, 1.45, bz - F * 0.9), at(new THREE.BoxGeometry(0.1, 2.9, 0.1), 3.9, 1.45, bz - F * 0.9)], wood, { shadow: true }));
    sign(out, renderer, 'BUVETTE DU HANGAR', [['#3a2312', '#6b4426'], '#ffd400', '#ffd400'], 5, 0, 3.45, bz - F * 0.6, F > 0 ? Math.PI : 0);
    // guirlande lumineuse au-dessus du bar
    const bulb = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffc46b, emissiveIntensity: 2 });
    out.emissive.push(bulb);
    out.group.add(mesh(Array.from({ length: 18 }, (_, k) => at(new THREE.SphereGeometry(0.06, 8, 6), -4 + k * 0.47, 2.75 - Math.sin((k / 17) * Math.PI) * 0.3, bz - F * 0.6)), bulb));
    // clients accoudés sur des tabourets
    const stools = [];
    for (let i = 0; i < 5; i++) {
      stools.push(at(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 14), -2.4 + i * 1.2, 0.75, bz - F * 0.95), at(new THREE.CylinderGeometry(0.03, 0.05, 0.75, 6), -2.4 + i * 1.2, 0.37, bz - F * 0.95));
      if (i !== 2) out.crowdSeats.push({ x: -2.4 + i * 1.2, y: 0.42, z: bz - F * 0.95, ry: F > 0 ? 0 : Math.PI });
    }
    out.group.add(mesh(stools, new THREE.MeshStandardMaterial({ color: 0x22262c, metalness: 0.6, roughness: 0.4 })));
    // étagère à bouteilles, tireuses, verres, ardoise
    const shelf = [], bottles = [[], [], [], []], glassG = [], taps = [];
    for (let r = 0; r < 3; r++) {
      shelf.push(at(new THREE.BoxGeometry(5, 0.05, 0.35), 0.8, 1.35 + r * 0.45, bz + F * 1.45));
      for (let k = 0; k < 14; k++) bottles[(k + r) % 4].push(at(new THREE.CylinderGeometry(0.035, 0.04, 0.26 + (k % 3) * 0.04, 8), -1.5 + k * 0.33, 1.52 + r * 0.45, bz + F * 1.45));
    }
    shelf.push(at(new THREE.BoxGeometry(5.2, 1.6, 0.06), 0.8, 1.9, bz + F * 1.65));
    out.group.add(mesh(shelf, wood, { shadow: true }));
    [0x1f6b35, 0x7a3a12, 0xd8c060, 0x2a3f8a].forEach((c, k) => out.group.add(mesh(bottles[k], new THREE.MeshStandardMaterial({ color: c, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 }))));
    for (let k = 0; k < 3; k++) taps.push(at(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8), -0.6 + k * 0.4, 1.38, bz), at(new THREE.BoxGeometry(0.04, 0.16, 0.04), -0.6 + k * 0.4, 1.66, bz - F * 0.05));
    out.group.add(mesh(taps, new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.9, roughness: 0.2 })));
    for (let k = 0; k < 6; k++) glassG.push(at(new THREE.CylinderGeometry(0.04, 0.035, 0.15, 10), 1.2 + k * 0.32, 1.24, bz - F * 0.25));
    out.group.add(mesh(glassG, new THREE.MeshStandardMaterial({ color: 0xf0b030, roughness: 0.05, transparent: true, opacity: 0.8 })));
    const menu = canvasTex(256, 192, (g, W2, H2) => {
      g.fillStyle = '#1d2420'; g.fillRect(0, 0, W2, H2); g.strokeStyle = '#8a5a34'; g.lineWidth = 10; g.strokeRect(0, 0, W2, H2);
      g.fillStyle = '#f2efe6'; g.font = 'bold 26px sans-serif'; g.fillText('LA CARTE', 64, 38);
      g.font = '18px sans-serif'; [['Pression', '3 €'], ['Soda', '2,5 €'], ['Café', '1,5 €'], ['Panini', '5 €'], ['Crêpe', '3 €']].forEach(([a, b], i) => { g.fillText(a, 22, 72 + i * 24); g.fillText(b, 190, 72 + i * 24); });
    });
    out.group.add(mesh([at(new THREE.PlaneGeometry(1.4, 1.05), -3.1, 2.1, bz + F * 1.6, 0, F > 0 ? Math.PI : 0)], new THREE.MeshStandardMaterial({ map: menu, roughness: 0.9 })));
    // écran géant (clips / sport) au-dessus du bar
    out.ambient.push(new BigScreen(out.group, 0, 5.2, bz + F * 1.2, F > 0 ? Math.PI : 0));
    // le barman
    out.ambient.push(new Barman(out.group, 0, bz + F * 0.85, F > 0 ? Math.PI : 0));
    const tables = [];
    for (const [tx, tz] of [[-10, 24], [10, 24.5], [-12.5, 21], [12.5, 21.5]].map(([a, b]) => [a, b * F])) {
      tables.push(at(new THREE.CylinderGeometry(0.35, 0.35, 0.04, 14), tx, 1.05, tz), at(new THREE.CylinderGeometry(0.04, 0.04, 1.05, 6), tx, 0.52, tz));
      for (const a of [0, 2.1, 4.2]) if (Math.random() < 0.8) out.crowdSeats.push({ x: tx + Math.cos(a) * 0.6, y: 0.05, z: tz + Math.sin(a) * 0.6, ry: Math.atan2(-Math.cos(a), -Math.sin(a)) });
    }
    out.group.add(mesh(tables, new THREE.MeshStandardMaterial({ color: 0x2c3138, metalness: 0.5 })));
    // tribunette entre les courts du fond
  }
  out.ambient.push(new Strollers(out.group, 7));
  // --- entrée (pignon ouest) : porte vitrée, auvent, accueil avec hôte, présentoir à raquettes
  {
    const x = X0 + 0.05, glass = new THREE.MeshStandardMaterial({ color: 0xcfe8ee, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.35 });
    const frame = new THREE.MeshStandardMaterial({ color: 0x2c3138, metalness: 0.7, roughness: 0.35 });
    out.group.add(mesh([at(new THREE.PlaneGeometry(3, 2.6), x + 0.02, 1.3, 0, 0, Math.PI / 2)], glass));
    out.group.add(mesh([at(new THREE.BoxGeometry(0.12, 2.8, 0.12), x + 0.06, 1.4, -1.55), at(new THREE.BoxGeometry(0.12, 2.8, 0.12), x + 0.06, 1.4, 1.55), at(new THREE.BoxGeometry(0.12, 0.12, 3.2), x + 0.06, 2.8, 0), at(new THREE.BoxGeometry(0.08, 2.6, 0.06), x + 0.06, 1.3, 0)], frame));
    sign(out, renderer, 'ENTRÉE · ACCUEIL', [['#1b2f5a', '#264a8a'], '#ffffff', '#ffd400'], 3.2, x + 0.12, 3.35, 0, Math.PI / 2);
    // sas d'entrée vitré qui avance dans la salle (la porte n'est plus plaquée contre la tôle)
    {
      const D = 2.6, Wd = 3.6, Hh = 2.9;
      const vglass = new THREE.MeshStandardMaterial({ color: 0xd6eef4, roughness: 0.05, metalness: 0.25, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
      out.group.add(mesh([at(new THREE.PlaneGeometry(D, Hh), x + D / 2, Hh / 2, -Wd / 2), at(new THREE.PlaneGeometry(D, Hh), x + D / 2, Hh / 2, Wd / 2)], vglass));
      out.group.add(mesh([at(new THREE.PlaneGeometry(Wd, Hh - 0.1), x + D, (Hh - 0.1) / 2, 0, 0, Math.PI / 2)], vglass));
      const fr = [];
      for (const zz of [-Wd / 2, Wd / 2]) { fr.push(at(new THREE.BoxGeometry(0.08, Hh, 0.08), x + D, Hh / 2, zz), at(new THREE.BoxGeometry(D, 0.08, 0.08), x + D / 2, Hh, zz)); }
      fr.push(at(new THREE.BoxGeometry(0.08, 0.08, Wd), x + D, Hh, 0), at(new THREE.BoxGeometry(0.05, Hh - 0.1, 0.05), x + D, (Hh - 0.1) / 2, 0));
      out.group.add(mesh(fr, frame));
      out.group.add(mesh([at(new THREE.BoxGeometry(D + 0.2, 0.12, Wd + 0.2), x + D / 2, Hh + 0.06, 0)], new THREE.MeshStandardMaterial({ color: 0x2c3138, metalness: 0.5, roughness: 0.4 }), { shadow: true }));
      // bandeau lumineux au-dessus du sas, paillasson, plantes de part et d'autre
      const lit = canvasTex(512, 96, (g) => { g.fillStyle = '#111418'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#ffffff'; g.font = 'bold 56px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.fillText('BIENVENUE AU HANGAR', 256, 66); });
      const lm = new THREE.MeshStandardMaterial({ map: lit, emissive: 0xffffff, emissiveMap: lit, emissiveIntensity: 0.7, roughness: 0.5 });
      out.group.add(mesh([at(new THREE.PlaneGeometry(3.4, 0.5), x + D + 0.07, Hh + 0.42, 0, 0, Math.PI / 2)], lm));
      flat(out, 1.6, 2.4, x + D + 1.0, 0, 0x2a2a2e, 0.015);
      for (const zz of [-Wd / 2 - 0.6, Wd / 2 + 0.6]) {
        out.group.add(mesh([at(new THREE.CylinderGeometry(0.3, 0.24, 0.55, 14), x + D + 0.3, 0.28, zz)], new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.7 }), { shadow: true }));
        out.group.add(hedge(0.55, 1.0, 0.55, x + D + 0.3, 1.05, zz, 0x3d6b2c));
      }
    }
    const wood = new THREE.MeshStandardMaterial({ color: 0x9a6a3f, roughness: 0.8 });
    out.group.add(mesh([at(new THREE.BoxGeometry(0.8, 1.1, 2.6), x + 2.4, 0.55, 4.3), at(new THREE.BoxGeometry(1, 0.06, 2.8), x + 2.4, 1.13, 4.3)], wood, { shadow: true }));
    out.group.add(mesh([at(new THREE.BoxGeometry(0.4, 0.3, 0.05), x + 2.4, 1.32, 4.0, 0, Math.PI / 2 - 0.3)], new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x4fc3f7, emissiveIntensity: 0.4 })));
    const host = new Avatar({ ...makeAppearance('blue', 3141, { name: '' }), headwear: null }); host.racket.visible = false;
    host.root.position.set(x + 1.6, 0, 4.3); host.root.rotation.y = Math.PI / 2; out.group.add(host.root);
    out.ambient.push({ t: 0, update(dt) { this.t += dt; host.animate(dt, { speed: 0, fwd: 0, side: 0, yaw: Math.PI / 2 + Math.sin(this.t * 0.4) * 0.5, look: 0, ready: false, armed: null, swing: null }); } });
    // pro shop : mur de raquettes en vente (vrais modèles et designs de la boutique), étiquettes de prix
    {
      const wall = new THREE.Group(); wall.position.set(x + 0.06, 0, -4.1); wall.rotation.y = Math.PI / 2; out.group.add(wall);
      wall.add(mesh([at(new THREE.BoxGeometry(2.9, 1.9, 0.05), 0, 1.55, 0)], new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.7 }), { shadow: true }));
      wall.add(mesh([at(new THREE.BoxGeometry(2.95, 0.05, 0.12), 0, 0.6, 0.05), at(new THREE.BoxGeometry(2.95, 0.05, 0.12), 0, 2.5, 0.05)], new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.8, roughness: 0.3 })));
      const picks = [['tour', 'model'], ['storm', 'model'], ['viper', 'model'], ['carbon', 'flame'], ['power', 'galaxy'], ['touch', 'provence'], ['smash', 'bolt'], ['gold', 'model']];
      const prices = { classic: 0, carbon: 450, power: 450, touch: 450, smash: 600, viper: 700, tour: 1200, storm: 900, gold: 15000 };
      picks.forEach(([rid, did], i) => {
        const r = RACKETS.find((q) => q.id === rid) || RACKETS[0];
        const holder = new THREE.Group();
        holder.position.set(-1.22 + (i % 4) * 0.81, i < 4 ? 2.05 : 1.15, 0.06);
        const rk = makeRacketMesh(r, designById(did));
        rk.rotation.set(0, 0, -Math.PI / 2);
        rk.position.y = -0.08;
        rk.scale.setScalar(1.05);
        holder.add(rk);
        const d = designById(did);
        const tag = canvasTex(256, 96, (g) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#111'; g.font = 'bold 30px sans-serif'; g.fillText(r.label, 10, 38); g.fillStyle = '#666'; g.font = '22px sans-serif'; g.fillText(d.id === 'model' ? 'Design d\'origine' : d.label, 10, 66); g.fillStyle = '#c62828'; g.font = 'bold 30px sans-serif'; g.textAlign = 'right'; g.fillText(`${(prices[rid] || 0) + (d.price || 0)} €`, 246, 88); });
        const tg = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), new THREE.MeshStandardMaterial({ map: tag, roughness: 0.6 }));
        tg.position.set(0, -0.24, 0.03);
        holder.add(tg);
        wall.add(holder);
      });
      // spots du présentoir
      const spot = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff3d6, emissiveIntensity: 2 });
      wall.add(mesh([-1.1, -0.37, 0.37, 1.1].map((sx) => at(new THREE.CylinderGeometry(0.05, 0.07, 0.08, 10), sx, 2.62, 0.18)), spot));
    }
    sign(out, renderer, 'PRO SHOP · RAQUETTES', [['#0d1b2a', '#1b3a5c'], '#ffd400', '#ffd400'], 2.4, x + 0.12, 2.85, -4.1, Math.PI / 2);
  }
  // --- toilettes et vestiaires (pignon est), distributeur de boissons
  {
    const x = X1 - 0.05, doorMat = new THREE.MeshStandardMaterial({ color: 0x3d4f66, roughness: 0.6 });
    const wc = canvasTex(128, 128, (g) => { g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#1b2f5a'; g.font = 'bold 44px sans-serif'; g.fillText('WC', 26, 58); g.font = '40px sans-serif'; g.fillText('🚹🚺', 14, 112); });
    for (const [z, lab] of [[-2.2, 'VESTIAIRES'], [2.2, 'TOILETTES']]) {
      out.group.add(mesh([at(new THREE.BoxGeometry(0.08, 2.2, 1.1), x - 0.04, 1.1, z)], doorMat, { shadow: true }));
      out.group.add(mesh([at(new THREE.BoxGeometry(0.04, 0.05, 0.18), x - 0.1, 1.05, z - 0.35)], new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.9 })));
      sign(out, renderer, lab, [['#1b2f5a', '#264a8a'], '#ffffff', '#ffffff'], 1.6, x - 0.06, 2.5, z, -Math.PI / 2);
    }
    out.group.add(mesh([at(new THREE.PlaneGeometry(0.4, 0.4), x - 0.09, 1.55, 2.2, 0, -Math.PI / 2)], new THREE.MeshStandardMaterial({ map: wc, roughness: 0.6 })));
    const vend = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.4 });
    out.group.add(mesh([at(new THREE.BoxGeometry(0.8, 1.9, 1), x - 0.45, 0.95, 5.5)], vend, { shadow: true }));
    out.group.add(mesh([at(new THREE.PlaneGeometry(0.75, 1.1), x - 0.86, 1.15, 5.5, 0, -Math.PI / 2)], new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x8fd3ff, emissiveIntensity: 0.6 })));
    const lockers = [];
    for (let k = 0; k < 6; k++) lockers.push(at(new THREE.BoxGeometry(0.5, 1.8, 0.45), x - 0.3, 0.9, -5 - k * 0.48));
    out.group.add(mesh(lockers, new THREE.MeshStandardMaterial({ color: 0x7a8a99, metalness: 0.5, roughness: 0.4 }), { shadow: true }));
    // une poubelle de tri près du distributeur
    out.group.add(mesh([at(new THREE.CylinderGeometry(0.25, 0.22, 0.8, 14), x - 0.4, 0.4, 7)], new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.6 })));
  }
  const poly = new THREE.MeshStandardMaterial({ color: 0xdfeef7, emissive: 0xcfe6f5, emissiveIntensity: 0.45, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  out.emissive.push(poly);
  const bands = [];
  for (const sz of [-1, 1]) bands.push(at(new THREE.PlaneGeometry(W - 2, 1.1), cx, H - 0.9, sz * (Z - 0.05), 0, sz > 0 ? Math.PI : 0));
  out.group.add(mesh(bands, poly));
  const duct = [];
  for (const sx of [-1, 1]) duct.push(at(new THREE.CylinderGeometry(0.35, 0.35, 2 * Z - 4, 18, 1, true), sx * 3.1, H + Z * K * 0.82, 0, Math.PI / 2, 0, 0));
  out.group.add(mesh(duct, new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: 0.85, roughness: 0.35, side: THREE.DoubleSide })));
  const hang = [];
  for (const [lx, ly, lz] of out.lampBoxes) hang.push(at(new THREE.CylinderGeometry(0.008, 0.008, 1.2, 4), lx - 0.5, ly + 0.6, lz), at(new THREE.CylinderGeometry(0.008, 0.008, 1.2, 4), lx + 0.5, ly + 0.6, lz));
  out.group.add(mesh(hang, new THREE.MeshStandardMaterial({ color: 0x222222 })));
  // marquage au sol des allées (bandes jaunes de circulation)
  const lane = new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  out.group.add(mesh([at(new THREE.PlaneGeometry(0.12, 2 * 21.5), -0.75, 0.012, 0, -Math.PI / 2), at(new THREE.PlaneGeometry(0.12, 2 * 21.5), 0.75, 0.012, 0, -Math.PI / 2),
    at(new THREE.PlaneGeometry(2 * 14, 0.12), 0, 0.012, -1.6, -Math.PI / 2), at(new THREE.PlaneGeometry(2 * 14, 0.12), 0, 0.012, 1.6, -Math.PI / 2)], lane));
  // banderoles de club sur les murs latéraux
  const ban = [['HANGAR PADEL CLUB', ['#2b2f36', '#3d434c'], '#ffffff', '#ff9800'], ['ÉCOLE DE PADEL', ['#0b2a5b', '#123f86'], '#ffffff', '#ffd400'], ['TOURNOI LE SAMEDI', ['#3a0c0c', '#7a1616'], '#ffffff', '#ffffff']];
  for (const sx of [-1, 1]) [-16, 0, 16].forEach((zz, k) => sign(out, renderer, ban[(k + (sx > 0 ? 1 : 0)) % 3][0], ban[(k + (sx > 0 ? 1 : 0)) % 3].slice(1), 5, sx * (X1 - 0.12), 4.6, zz, -sx * Math.PI / 2));
  // plantes en pots aux coins et extincteurs rouges
  const pots = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { pots.push(at(new THREE.CylinderGeometry(0.35, 0.28, 0.6, 14), sx * 13.6, 0.3, sz * 23.5)); out.group.add(hedge(0.7, 0.9, 0.7, sx * 13.6, 1.05, sz * 23.5, 0x3d6b2c)); }
  out.group.add(mesh(pots, new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.8 }), { shadow: true }));
  const ext = [], extDark = [], extMetal = [], extSign = [];
  for (const sx of [-1, 1]) for (const zz of [-8, 8]) {
    const x = sx * (X1 - 0.18);
    ext.push(at(new THREE.CylinderGeometry(0.085, 0.085, 0.42, 16), x, 0.95, zz), at(new THREE.SphereGeometry(0.085, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), x, 1.16, zz));
    extMetal.push(at(new THREE.CylinderGeometry(0.03, 0.035, 0.06, 10), x, 1.27, zz), at(new THREE.BoxGeometry(0.03, 0.02, 0.12), x, 1.31, zz + 0.03), at(new THREE.BoxGeometry(0.06, 0.4, 0.02), x + sx * 0.08, 1.0, zz));
    extDark.push(at(new THREE.TorusGeometry(0.06, 0.012, 6, 14, Math.PI * 1.3), x - sx * 0.02, 1.13, zz - 0.08, 0, Math.PI / 2, 0), at(new THREE.CylinderGeometry(0.018, 0.012, 0.07, 8), x, 1.06, zz - 0.13));
    extSign.push(at(new THREE.PlaneGeometry(0.25, 0.25), x + sx * 0.08 - sx * 0.01, 1.55, zz, 0, -sx * Math.PI / 2));
  }
  out.group.add(mesh(ext, new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.3, metalness: 0.2 }), { shadow: true }));
  out.group.add(mesh(extMetal, new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.85, roughness: 0.3 })));
  out.group.add(mesh(extDark, new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 })));
  const fireSign = canvasTex(64, 64, (g, Wd) => { g.fillStyle = '#c62828'; g.fillRect(0, 0, Wd, Wd); g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; g.fillText('🧯', 12, 46); });
  out.group.add(mesh(extSign, new THREE.MeshStandardMaterial({ map: fireSign, roughness: 0.6 })));
  // quelques spectateurs sur des bancs le long des murs
  const bench = [];
  for (const sx of [-1, 1]) for (const zz of [-12.5, 12.5]) { bench.push(at(new THREE.BoxGeometry(0.5, 0.45, 3), sx * 13.4, 0.22, zz)); for (let k = 0; k < 4; k++) if (Math.random() < 0.7) out.crowdSeats.push({ x: sx * 13.4, y: 0.45, z: zz - 1.2 + k * 0.8, ry: -sx * Math.PI / 2 }); }
  out.group.add(mesh(bench, wood, { shadow: true }));

  // --- résine époxy dans les allées (sol plus soigné, légers reflets)
  const epoxy = new THREE.MeshStandardMaterial({ color: 0x5d6b66, roughness: 0.28, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  out.group.add(mesh([at(new THREE.PlaneGeometry(2.3, 2 * 22), 0, 0.006, 0, -Math.PI / 2), at(new THREE.PlaneGeometry(2 * 14.2, 4.6), 0, 0.006, 0, -Math.PI / 2)], epoxy));
  // --- numéros de piste peints au sol dans l'allée, devant chaque court (ne gênent plus les caméras)
  [[-6.2, -12.5], [6.2, -12.5], [-6.2, 12.5], [6.2, 12.5]].forEach(([px, pz], i) => {
    const tex = canvasTex(256, 128, (g) => { g.clearRect(0, 0, 256, 128); g.fillStyle = 'rgba(255,255,255,0.92)'; g.font = 'bold 84px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.fillText(`PISTE ${i + 1}`, 128, 100); }, { repeat: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = px < 0 ? -Math.PI / 2 : Math.PI / 2;
    m.position.set(px < 0 ? -12.6 : 12.6, 0.016, pz); out.group.add(m);
  });
  // --- déco murale : affiches encadrées, néon, vitrine à trophées
  {
    const posters = [['TOURNOI', '#ff9800'], ['ÉCOLE', '#1e88e5'], ['NOCTURNE', '#7c4dff'], ['AMÉRICANO', '#43a047'], ['MIXTE', '#e53935'], ['SENIORS', '#00acc1']];
    posters.forEach(([t, c], i) => {
      const tex = canvasTex(192, 256, (g) => {
        g.fillStyle = '#15171b'; g.fillRect(0, 0, 192, 256); g.fillStyle = c; g.fillRect(10, 10, 172, 236);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(96, 110, 58, 0, 7); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(96, 110, 22, 0, 7); g.fill();
        g.font = 'bold 34px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.fillText(t, 96, 214);
        g.font = '18px Arial'; g.fillText('HANGAR PADEL', 96, 238);
      });
      const sx = i < 3 ? -1 : 1, z = -20 + (i % 3) * 20 + 4.5;
      const fr = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.5), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
      fr.position.set(sx * (X1 - 0.08), 2.4, z); fr.rotation.y = -sx * Math.PI / 2; out.group.add(fr);
      out.group.add(mesh([at(new THREE.BoxGeometry(0.04, 1.6, 1.25), sx * (X1 - 0.05), 2.4, z)], new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 })));
    });
    // néon « PLAY HARD » sur le mur est
    const neon = canvasTex(512, 128, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 512, 128); g.shadowColor = '#ff2bd6'; g.shadowBlur = 24; g.strokeStyle = '#ff7bf0'; g.lineWidth = 6; g.font = 'bold 86px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.strokeText('PLAY HARD', 256, 96); });
    const nm = new THREE.MeshStandardMaterial({ map: neon, emissive: 0xffffff, emissiveMap: neon, emissiveIntensity: 1.4, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const n = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), nm); n.position.set(X1 - 0.1, 4.2, 0); n.rotation.y = -Math.PI / 2; out.group.add(n);
  }
  // --- accueil plus soigné : tapis, salon (canapés, table basse), vitrine à trophées, écran des réservations
  {
    const x = X0 + 0.05;
    // banquette contre le mur, à côté du sas
    out.group.add(mesh([at(new THREE.BoxGeometry(0.6, 0.42, 2.2), x + 0.4, 0.21, 10.2), at(new THREE.BoxGeometry(0.15, 0.7, 2.2), x + 0.12, 0.6, 10.2)], new THREE.MeshStandardMaterial({ color: 0x2f3e46, roughness: 0.85 }), { shadow: true }));
    out.crowdSeats.push({ x: x + 0.45, y: 0.42, z: 10.6, ry: Math.PI / 2 });
    // vitrine à trophées (verre + coupes dorées)
    const gold = new THREE.MeshStandardMaterial({ color: 0xd4a72c, metalness: 0.9, roughness: 0.25 });
    out.group.add(mesh([at(new THREE.BoxGeometry(0.5, 2, 1.8), x + 0.3, 1, 7.6)], new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.5 }), { shadow: true }));
    const cups = [];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) cups.push(at(new THREE.CylinderGeometry(0.07, 0.03, 0.2, 10), x + 0.45, 0.65 + r * 0.55, 7.0 + k * 0.6), at(new THREE.CylinderGeometry(0.05, 0.06, 0.05, 10), x + 0.45, 0.53 + r * 0.55, 7.0 + k * 0.6));
    out.group.add(mesh(cups, gold));
    out.group.add(mesh([at(new THREE.PlaneGeometry(1.8, 1.9), x + 0.56, 1, 7.6, 0, Math.PI / 2)], new THREE.MeshStandardMaterial({ color: 0xcfe8ee, roughness: 0.05, transparent: true, opacity: 0.25 })));
    const book = canvasTex(256, 160, (g) => { g.fillStyle = '#0b1020'; g.fillRect(0, 0, 256, 160); g.fillStyle = '#4fc3f7'; g.font = 'bold 22px Arial'; g.fillText('RÉSERVATIONS', 16, 30); g.font = '16px Arial'; ['18:00  Piste 1  ✔', '18:00  Piste 2  ✔', '19:30  Piste 3  libre', '19:30  Piste 4  ✔', '21:00  Piste 1  libre'].forEach((t, i) => { g.fillStyle = t.includes('libre') ? '#a5d6a7' : '#ffffff'; g.fillText(t, 16, 62 + i * 20); }); });
    const bm = new THREE.MeshStandardMaterial({ map: book, emissive: 0xffffff, emissiveMap: book, emissiveIntensity: 0.6 });
    out.group.add(mesh([at(new THREE.PlaneGeometry(1.4, 0.9), x + 0.07, 2.0, -6.8, 0, Math.PI / 2)], bm));
  }
  // --- fanions de couleur sous le cintre, d'un mur à l'autre, au-dessus de l'allée centrale
  const flagCols = [0xff9800, 0xffffff, 0x1e88e5, 0xffd400, 0xe53935];
  const flags = flagCols.map(() => []);
  for (const fz of [-19, -6, 6, 19]) {
    const n = 30;
    for (let k = 1; k < n; k++) {
      const t = k / n, x = X0 + 0.5 + t * (W - 1), y = 6.6 - Math.sin(Math.PI * t) * 0.9;
      const tri = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-0.16, 0, 0, 0.16, 0, 0, 0, -0.34, 0], 3));
      tri.computeVertexNormals();
      flags[k % flagCols.length].push(tri.translate(x, y, fz));
    }
  }
  flags.forEach((list, k) => out.group.add(mesh(list, new THREE.MeshStandardMaterial({ color: flagCols[k], roughness: 0.8, side: THREE.DoubleSide }))));
}

/** Chaise d'arbitre (au niveau du filet) et table des commentateurs avec caméra TV. */
function officials(out, renderer) {
  const metal = new THREE.MeshStandardMaterial({ color: 0x23262c, metalness: 0.5, roughness: 0.4 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x1c3f7a, roughness: 0.6 });
  const x0 = -(HW + 1.1);
  const chair = [];
  for (const dz of [-0.35, 0.35]) for (const dx of [-0.3, 0.3]) chair.push(at(new THREE.BoxGeometry(0.05, 1.7, 0.05), x0 + dx, 0.85, dz));
  for (let i = 0; i < 5; i++) chair.push(at(new THREE.BoxGeometry(0.05, 0.04, 0.7), x0 + 0.32, 0.3 + i * 0.32, 0));
  out.group.add(mesh(chair, metal, { shadow: true }));
  out.group.add(mesh([at(new THREE.BoxGeometry(0.7, 0.08, 0.8), x0, 1.72, 0), at(new THREE.BoxGeometry(0.08, 0.6, 0.8), x0 - 0.33, 2.0, 0)], wood, { shadow: true }));
  out.crowdSeats.push({ x: x0, y: 1.74, z: 0, ry: Math.PI / 2 });
  // table des commentateurs, de l'autre côté
  const xd = HW + 3.2;
  out.group.add(mesh([at(new THREE.BoxGeometry(0.8, 0.75, 3.2), xd, 0.375, 2.4)], wood, { shadow: true }));
  const screens = new THREE.MeshStandardMaterial({ color: 0x0b1020, emissive: 0x4fc3f7, emissiveIntensity: 0.5 });
  out.emissive.push(screens);
  out.group.add(mesh([at(new THREE.BoxGeometry(0.05, 0.32, 0.5), xd + 0.1, 0.92, 1.7, 0, 0, 0.2), at(new THREE.BoxGeometry(0.05, 0.32, 0.5), xd + 0.1, 0.92, 3.1, 0, 0, 0.2)], screens));
  for (const z of [1.7, 3.1]) out.crowdSeats.push({ x: xd + 0.75, y: 0.05, z, ry: -Math.PI / 2 });
  sign(out, renderer, 'COMMENTAIRES · TV', [['#0d0d14', '#1a1f3a'], '#ffffff', '#d4a72c'], 3.1, xd - 0.41, 0.42, 2.4, -Math.PI / 2);
  // caméra TV sur trépied
  const cam = [at(new THREE.BoxGeometry(0.35, 0.3, 0.6), xd - 0.4, 1.55, -5, 0, 0.5), at(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), xd - 0.4, 0.7, -5)];
  out.group.add(mesh(cam, metal, { shadow: true }));
  out.crowdSeats.push({ x: xd + 0.1, y: 0.05, z: -5.2, ry: -Math.PI / 2 - 0.4 });
}

/** Stade de plage : sable, mer, tribunes provisoires, palmiers et parasols. */
function decorBeach(out, renderer) {
  const sand = TX.groundTex(renderer, 'sand', 50);

  out.group.add(Object.assign(new THREE.Mesh(at(new THREE.PlaneGeometry(300, 300), 0, 0, 0, -Math.PI / 2), new THREE.MeshStandardMaterial({ map: sand, normalMap: sand.userData.normal, roughness: 1 })), { receiveShadow: true }));
  // mer derrière le fond du court
  out.ambient.push(new Sea(out.group));
  // tribunes provisoires (échafaudages) sur les côtés et derrière la caméra
  for (const sx of [-1, 1]) stand(out, { x: sx * (HW + 5.0), z: 0, along: 'z', away: sx, length: 22, rows: 9, fill: 0.85, seatColor: 0xef6c00, concrete: 0xa9b0ba });
  stand(out, { x: 0, z: HL + 4, along: 'x', away: 1, length: 14, rows: 6, fill: 0.8, seatColor: 0x1580b8, concrete: 0xa9b0ba });
  // palmiers, parasols et transats
  const palm = palmTemplate();
  const pts = [[-16, -16], [16, -16], [-20, 4], [20, 4], [-9, -24], [9, -24], [-26, -30], [27, -28]];
  const trunks = new THREE.InstancedMesh(palm.trunk, new THREE.MeshStandardMaterial({ map: trunkTex(), roughness: 0.95 }), pts.length);
  const crowns = new THREE.InstancedMesh(palm.crown, new THREE.MeshStandardMaterial({ map: frondTex(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 }), pts.length);
  const M = new THREE.Matrix4();
  pts.forEach(([x, z], i) => { M.makeTranslation(x, 0, z); trunks.setMatrixAt(i, M); crowns.setMatrixAt(i, M); });
  trunks.castShadow = crowns.castShadow = true;
  out.group.add(trunks, crowns);
  const colors = [0xe53935, 0xffd400, 0x1e88e5, 0x43a047, 0xf06292];
  for (let i = 0; i < 10; i++) {
    const x = -22 + i * 4.9, z = -(HL + 7) - Math.random() * 6;
    out.group.add(mesh([at(new THREE.ConeGeometry(1.2, 0.5, 8), x, 2.2, z)], new THREE.MeshStandardMaterial({ color: colors[i % 5], roughness: 0.8 }), { shadow: true }));
    out.group.add(mesh([at(new THREE.CylinderGeometry(0.03, 0.03, 2.1, 6), x, 1.05, z), at(new THREE.BoxGeometry(0.6, 0.12, 1.7), x + 0.9, 0.3, z, 0.25)], new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.8 })));
    if (Math.random() < 0.6) out.crowdSeats.push({ x: x + 0.9, y: 0.12, z, ry: Math.PI });
  }
  // drapeaux sur des mâts le long des tribunes
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) {
    const z = -9 + k * 6;
    out.group.add(mesh([at(new THREE.CylinderGeometry(0.04, 0.04, 9, 6), sx * (HW + 13), 4.5, z)], new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 0.5 })));
    out.group.add(mesh([at(new THREE.PlaneGeometry(1.4, 0.9), sx * (HW + 13), 8.3, z + 0.7, 0, Math.PI / 2)], new THREE.MeshStandardMaterial({ color: colors[(k + (sx > 0 ? 2 : 0)) % 5], side: THREE.DoubleSide })));
  }
  officials(out, renderer);
  rocks(out, [[-30, -34, 2.4], [-24, -37, 1.2], [26, -33, 2.8], [33, -36, 1.4], [-48, -30, 3.2], [50, -31, 2.6], [12, -38, 0.9], [-8, -38, 0.7]]);
}

// ------------------------------------------------------------------ fête de village
/** Musiciens qui se balancent, accordéon qui s'ouvre et se ferme. */
class Band {
  // orchestre de fête : estrade couverte (toile rayée), guirlande d'ampoules, enceintes, projecteurs ;
  // accordéoniste, guitariste, batteur (grosse caisse, caisse claire, cymbale) et chanteur au micro
  constructor(parent, x, y, z, rotY) {
    this.g = new THREE.Group();
    this.g.position.set(x, y, z); this.g.rotation.y = rotY;
    parent.add(this.g);
    this.members = [];
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a4f2c, roughness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.6 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.9, roughness: 0.25 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd4a72c, metalness: 0.85, roughness: 0.3 });
    // estrade en planches, jupe de tissu rouge, deux marches
    const H = 0.45;
    this.g.add(mesh([at(new THREE.BoxGeometry(5.2, H, 2.8), 0, H / 2, -0.2)], wood, { shadow: true }));
    const skirt = canvasTex(256, 32, (c, W, Hh) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#b71c1c' : '#8e1414'; c.fillRect(i * 16, 0, 16, Hh); } });
    this.g.add(mesh([at(new THREE.PlaneGeometry(5.2, H), 0, H / 2, 1.21)], new THREE.MeshStandardMaterial({ map: skirt, roughness: 0.9 })));
    this.g.add(mesh([at(new THREE.BoxGeometry(1.2, 0.15, 0.35), 0, 0.075, 1.45), at(new THREE.BoxGeometry(1.2, 0.3, 0.35), 0, 0.15, 1.3)], wood, { shadow: true }));
    // toit en toile rayée rouge et blanc sur quatre mâts, fond de scène
    const stripes = canvasTex(128, 64, (c, W, Hh) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#d32f2f'; c.fillRect(i * 16, 0, 16, Hh); } });
    const tent = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.85, side: THREE.DoubleSide });
    this.g.add(mesh([at(new THREE.PlaneGeometry(5.6, 3.0), 0, 3.25, -0.2, -Math.PI / 2 + 0.12)], tent, { shadow: true }));
    const val = canvasTex(256, 32, (c, W, Hh) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#d32f2f'; c.beginPath(); c.moveTo(i * 16, 0); c.lineTo(i * 16 + 16, 0); c.lineTo(i * 16 + 8, Hh); c.fill(); } });
    this.g.add(mesh([at(new THREE.PlaneGeometry(5.6, 0.32), 0, 2.95, 1.3)], new THREE.MeshStandardMaterial({ map: val, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide })));
    this.g.add(mesh([-2.6, 2.6].flatMap((sx) => [-1.5, 1.2].map((sz) => at(new THREE.CylinderGeometry(0.04, 0.05, 3.1, 8), sx, 1.55, sz))), metal));
    const back = canvasTex(512, 256, (c, W, Hh) => {
      const gr = c.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, '#1b2a5a'); gr.addColorStop(1, '#0d1430'); c.fillStyle = gr; c.fillRect(0, 0, W, Hh);
      c.fillStyle = '#f2c94c'; for (let i = 0; i < 60; i++) { c.globalAlpha = Math.random(); c.beginPath(); c.arc(Math.random() * W, Math.random() * Hh * 0.6, 1.5, 0, 7); c.fill(); }
      c.globalAlpha = 1; c.font = 'bold 54px "Barlow Condensed", Arial, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffffff'; c.fillText('BAL DU PADEL', W / 2, Hh * 0.62);
      c.font = '28px "Barlow Condensed", Arial, sans-serif'; c.fillStyle = '#f2c94c'; c.fillText('★  ORCHESTRE  ★', W / 2, Hh * 0.82);
    });
    this.g.add(mesh([at(new THREE.PlaneGeometry(5.2, 2.6), 0, 1.75, -1.55)], new THREE.MeshStandardMaterial({ map: back, roughness: 0.8 })));
    // guirlande d'ampoules sous l'avancée du toit
    const bulbs = [];
    for (let i = 0; i <= 18; i++) { const t = i / 18; bulbs.push(at(new THREE.SphereGeometry(0.045, 8, 6), -2.6 + 5.2 * t, 2.8 - Math.sin(Math.PI * t) * 0.25, 1.25)); }
    this.g.add(mesh(bulbs, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffc46b, emissiveIntensity: 2.2 })));
    // enceintes sur pieds de part et d'autre, projecteurs
    for (const sx of [-1, 1]) {
      this.g.add(mesh([at(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), sx * 3.1, 0.7, 0.8), at(new THREE.BoxGeometry(0.45, 0.7, 0.4), sx * 3.1, 1.75, 0.8)], dark, { shadow: true }));
      this.g.add(mesh([at(new THREE.CylinderGeometry(0.13, 0.09, 0.04, 16).rotateX(Math.PI / 2), sx * 3.1, 1.65, 1.01)], new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.3 })));
      this.g.add(mesh([at(new THREE.CylinderGeometry(0.1, 0.13, 0.22, 10), sx * 2.3, 3.0, 1.1, 0.9, 0, 0)], new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff0c8, emissiveIntensity: 1.5 })));
    }
    // musiciens : tenue assortie (chemise blanche, gilet / foulard rouge)
    const outfit = (seed, over = {}) => ({ ...makeAppearance('white', seed, { name: '', ...over }), headwear: null, accent: 0xc62828, shorts: 0x1a1a1d });
    const roles = [['accordion', -1.8, 0], ['guitar', -0.6, 0.15], ['drum', 0.9, -0.7], ['singer', 1.9, 0.3]];
    roles.forEach(([role, mx, mz], i) => {
      const av = new Avatar(outfit(4242 + i * 13));
      av.racket.visible = false;
      av.root.position.set(mx, H, mz);
      this.g.add(av.root);
      let inst = null;
      if (role === 'accordion') {
        inst = new THREE.Group();
        const box = new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: 0.35, metalness: 0.1 });
        const keys = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.4 });
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.24), box), r = l.clone();
        const kb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.06), keys); kb.position.set(0.06, 0, 0.1); r.add(kb);
        const bel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.32, 0.22), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 }));
        for (let k = 0; k < 6; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.33, 0.225), gold); f.position.x = -0.09 + k * 0.036; bel.add(f); }
        l.position.x = -0.16; r.position.x = 0.16;
        inst.add(l, r, bel);
        inst.position.set(0, 0.0, 0.2);
        av.chest.add(inst);
        inst.userData = { bel, l, r };
      } else if (role === 'guitar') {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.08, 18).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xa0612c, roughness: 0.4 }));
        const hole = new THREE.Mesh(new THREE.CircleGeometry(0.05, 14), dark); hole.position.z = 0.041;
        const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.025), new THREE.MeshStandardMaterial({ color: 0x3b2414, roughness: 0.6 })); neck.position.set(0, 0.36, 0);
        body.add(hole); g.add(body, neck);
        g.rotation.z = -1.1; g.position.set(0.02, -0.12, 0.17);
        av.chest.add(g);
      } else if (role === 'drum') {
        const kit = new THREE.Group(); kit.position.set(mx, H, mz + 0.6); this.g.add(kit);
        const shell = new THREE.MeshStandardMaterial({ color: 0x8e1414, roughness: 0.35, metalness: 0.2 });
        const head = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.5 });
        kit.add(mesh([at(new THREE.CylinderGeometry(0.3, 0.3, 0.28, 20).rotateX(Math.PI / 2), 0, 0.3, 0)], shell, { shadow: true }));
        kit.add(mesh([at(new THREE.CircleGeometry(0.28, 20), 0, 0.3, 0.145)], head));
        kit.add(mesh([at(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 18), 0.45, 0.68, -0.05)], shell));
        kit.add(mesh([at(new THREE.CylinderGeometry(0.165, 0.165, 0.01, 18), 0.45, 0.745, -0.05)], head));
        kit.add(mesh([at(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 6), 0.45, 0.31, -0.05), at(new THREE.CylinderGeometry(0.015, 0.015, 1.15, 6), -0.5, 0.58, -0.1)], metal));
        const cym = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.008, 22), gold); cym.position.set(-0.5, 1.16, -0.1); cym.rotation.x = 0.2; kit.add(cym);
        inst = { cym };
      } else if (role === 'singer') {
        this.g.add(mesh([at(new THREE.CylinderGeometry(0.012, 0.012, 1.45, 6), mx, H + 0.72, mz + 0.42), at(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 12), mx, H + 0.01, mz + 0.42)], metal));
        this.g.add(mesh([at(new THREE.SphereGeometry(0.035, 10, 8), mx, H + 1.48, mz + 0.38)], dark));
      }
      this.members.push({ av, role, inst, phase: i * 1.3 });
    });
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    const beat = this.t * 2.9;
    for (const m of this.members) {
      const k = Math.sin(beat + m.phase);
      m.av.root.rotation.z = k * 0.04;
      m.av.root.position.y = 0.45 + Math.max(0, k) * 0.025;
      // pas de geste de raquette : mains au niveau de l'instrument (pose d'attente, buste qui balance)
      const pose = m.role === 'drum'
        ? { swing: { kind: 'fore', style: 'drive', t: (this.t * 2.9 + m.phase) % 0.34 * 0.4, dur: 0.34, contactRz: 0.2, contactH: 0.95 } }
        : {};
      m.av.animate(dt, { speed: 0, fwd: 0, side: 0, yaw: m.role === 'singer' ? Math.sin(this.t * 0.6) * 0.3 : 0, look: Math.sin(this.t * 0.8 + m.phase) * 0.4, ready: false, armed: null, swing: null, ...pose });
      if (m.role === 'accordion' && m.inst) {
        const o = 1 + Math.sin(beat) * 0.45;
        m.inst.userData.bel.scale.x = o;
        m.inst.userData.l.position.x = -0.08 - 0.1 * o;
        m.inst.userData.r.position.x = 0.08 + 0.1 * o;
      }
      if (m.role === 'drum' && m.inst) m.inst.cym.rotation.z = Math.sin(this.t * 11) * 0.06;
    }
  }
}

/**
 * Fête de village : orchestre sur estrade, buvette, tables avec des verres,
 * guirlandes de fanions et banderole. (x, z) : centre ; rotY : orientation (face +z).
 */
function fete(out, renderer, x, z, rotY = 0, y = 0, title = 'FÊTE DU PADEL') {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = rotY;
  out.group.add(g);
  const sub = { ...out, group: g };
  // fanions : trois guirlandes entre des mâts
  const poleGeo = [], flags = [[], [], [], [], []];
  const colors = [0xe53935, 0xffd400, 0x1e88e5, 0x43a047, 0xf2f4f7];
  const poles = [[-7, -3], [7, -3], [-7, 5], [7, 5]];
  for (const [px, pz] of poles) poleGeo.push(at(new THREE.CylinderGeometry(0.05, 0.06, 4.2, 6), px, 2.1, pz));
  const strings = [[poles[0], poles[1]], [poles[2], poles[3]], [poles[0], poles[3]], [poles[1], poles[2]]];
  for (const [[ax, az], [bx, bz]] of strings) {
    const n = 22;
    for (let i = 1; i < n; i++) {
      const t = i / n, sag = Math.sin(Math.PI * t) * 0.7;
      const fx = ax + (bx - ax) * t, fz = az + (bz - az) * t, fy = 4.1 - sag;
      const tri = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.17, 0, 0), new THREE.Vector3(0.17, 0, 0), new THREE.Vector3(0, -0.38, 0)]);
      tri.setIndex([0, 1, 2]); tri.computeVertexNormals();
      tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
      tri.rotateY(Math.atan2(bx - ax, bz - az) + Math.PI / 2).translate(fx, fy, fz);
      flags[i % 5].push(tri);
    }
  }
  sub.group.add(mesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0x8a6542, roughness: 0.9 }), { shadow: true }));
  flags.forEach((f, i) => f.length && sub.group.add(mesh(f, new THREE.MeshStandardMaterial({ color: colors[i], side: THREE.DoubleSide, roughness: 0.8 }))));
  // banderole
  sign(sub, renderer, title, [['#b71c1c', '#e53935'], '#ffffff', '#ffd400'], 6, 0, 3.2, -3.05);
  // buvette
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.9 });
  sub.group.add(mesh([at(new THREE.BoxGeometry(3.6, 1.1, 0.8), 4.2, 0.55, -1.4), at(new THREE.BoxGeometry(0.1, 2.5, 0.1), 2.5, 1.25, -1.9), at(new THREE.BoxGeometry(0.1, 2.5, 0.1), 5.9, 1.25, -1.9)], wood, { shadow: true }));
  const stripes = canvasTex(64, 64, (c, S) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#e53935'; c.fillRect(i * 8, 0, 8, S); } });
  sub.group.add(mesh([at(new THREE.BoxGeometry(3.9, 0.08, 1.6), 4.2, 2.55, -1.6, -0.15)], new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.8 }), { shadow: true }));
  sign(sub, renderer, 'BUVETTE', [['#3a2312', '#6b4426'], '#ffd400', '#ffd400'], 2.6, 4.2, 2.1, -1.88);
  const barrels = [at(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12), 6.6, 0.4, -1.2), at(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12), 6.6, 0.4, -0.5)];
  sub.group.add(mesh(barrels, wood, { shadow: true }));
  for (let i = 0; i < 4; i++) out.crowdSeats.push(local(g, 2.8 + i * 0.9, 0.3, -0.6, Math.PI));
  // tables avec des verres, et des gens qui boivent un coup
  const tableGeo = [], drinks = [], wine = [];
  for (const [tx, tz] of [[-4.5, 2], [-1.5, 3.2], [1.6, 2.2], [4.4, 3.4]]) {
    tableGeo.push(at(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 14), tx, 0.74, tz), at(new THREE.CylinderGeometry(0.05, 0.05, 0.72, 6), tx, 0.36, tz));
    for (let k = 0; k < 3; k++) (k % 2 ? wine : drinks).push(at(new THREE.CylinderGeometry(0.035, 0.03, 0.14, 8), tx + Math.cos(k * 2) * 0.25, 0.84, tz + Math.sin(k * 2) * 0.25));
    for (const a of [0, 2.1, 4.2]) if (Math.random() < 0.8) out.crowdSeats.push(local(g, tx + Math.cos(a) * 0.85, 0.03, tz + Math.sin(a) * 0.85, Math.atan2(-Math.cos(a), -Math.sin(a))));
  }
  sub.group.add(mesh(tableGeo, new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.7 }), { shadow: true }));
  sub.group.add(mesh(drinks, new THREE.MeshStandardMaterial({ color: 0xf2b632, roughness: 0.2, transparent: true, opacity: 0.85 })));
  sub.group.add(mesh(wine, new THREE.MeshStandardMaterial({ color: 0x7a1c26, roughness: 0.2 })));
  // orchestre
  const band = new Band(g, -4.5, 0, -1.6, 0);
  out.ambient.push(band);
  (out.bands ||= []).push(band.g);
  if (title.includes('CEYRESTE')) (out.sonos ||= []).push(sono(g, -4.5, 0, -1.6));
  // public qui danse devant la scène
  out.ambient.push(new Dancers(g, -4.5, 0.9, 6));
  (out.parties ||= []).push(g);
}

/** Sono de fête : table de mixage et deux colonnes d'enceintes sorties sur la terrasse. */
function sono(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.visible = false; parent.add(g);
  const black = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.55 });
  const grille = new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.9, metalness: 0.2 });
  const cone = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.35 });
  const box = [], cones = [], stands = [];
  for (const sx of [-2.4, 2.4]) {
    stands.push(at(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 8), sx, 0.65, 0));
    for (const [w, h, d, yy] of [[0.62, 0.62, 0.55, 0.31], [0.48, 0.78, 0.4, 1.7]]) {
      box.push(at(new THREE.BoxGeometry(w, h, d), sx, yy, 0));
      const r = w * 0.33;
      cones.push(at(new THREE.CylinderGeometry(r, r * 0.6, 0.04, 20).rotateX(Math.PI / 2), sx, yy - h * 0.12, d / 2 + 0.01));
      cones.push(at(new THREE.CylinderGeometry(r * 0.35, r * 0.2, 0.04, 14).rotateX(Math.PI / 2), sx, yy + h * 0.3, d / 2 + 0.01));
    }
  }
  // table du DJ
  box.push(at(new THREE.BoxGeometry(1.6, 0.9, 0.7), 0, 0.45, 0));
  const deck = [at(new THREE.BoxGeometry(1.3, 0.06, 0.5), 0, 0.93, 0)];
  const disc = [at(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 20), -0.38, 0.97, 0), at(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 20), 0.38, 0.97, 0)];
  g.add(mesh(box, black, { shadow: true }), mesh(cones, cone), mesh(stands, grille), mesh(deck, grille), mesh(disc, new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.8, roughness: 0.3 })));
  const led = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: 0x29b6f6 }));
  led.position.set(0, 0.7, 0.36); g.add(led);
  const dj = new Avatar({ ...makeAppearance('black', 9191), name: '' });
  dj.racket.visible = false; dj.root.position.set(0, 0.03, -0.7); g.add(dj.root);
  return g;
}

/** Quelques personnes qui dansent et lèvent leur verre devant l'orchestre. */
class Dancers {
  constructor(parent, x, z, n) {
    this.list = [];
    const kits = ['red', 'blue', 'green', 'orange', 'white', 'black'];
    for (let i = 0; i < n; i++) {
      const av = new Avatar({ ...makeAppearance(kits[i % kits.length], 9100 + i * 37), name: '' });
      av.racket.visible = false;
      av.root.position.set(x + (i % 3 - 1) * 1.1 + (Math.random() - 0.5) * 0.4, 0, z + Math.floor(i / 3) * 1.2 + Math.random() * 0.3);
      av.root.rotation.y = Math.PI + (Math.random() - 0.5) * 0.6;
      parent.add(av.root);
      this.list.push({ av, ph: Math.random() * 6, drink: i % 2 === 0, yaw0: av.root.rotation.y });
    }
    this.t = 0;
  }
  update(dt) {
    if (!this.list[0]?.av.root.parent?.visible) return;
    this.t += dt;
    for (const d of this.list) {
      const k = this.t * 3.1 + d.ph;
      const pose = d.drink
        ? { armed: { kind: 'over', charge: 0.15 + 0.1 * Math.sin(k * 0.5) } }
        : { armed: { kind: Math.sin(k * 0.5) > 0 ? 'fore' : 'back', charge: 0.4 + 0.3 * Math.sin(k) } };
      d.av.animate(dt, { speed: 0, fwd: 0, side: 0, yaw: d.yaw0 + Math.sin(k * 0.4) * 0.4, look: 0, ready: true, swing: null, ...pose });
      d.av.root.position.y = Math.abs(Math.sin(k)) * 0.06;
      d.av.root.rotation.z = Math.sin(k) * 0.06;
    }
  }
}

/** Écran géant : alterne clips musicaux colorés et un match de padel (dessiné en direct). */
class BigScreen {
  constructor(parent, x, y, z, rotY) {
    this.c = document.createElement('canvas'); this.c.width = 320; this.c.height = 180;
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; parent.add(g);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.6, 0.18), new THREE.MeshStandardMaterial({ color: 0x111316, metalness: 0.4, roughness: 0.4 })));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 2.3), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    scr.position.z = 0.1; g.add(scr);
    for (const sx of [-1, 1]) { const rod = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 0.06), new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.7 })); rod.position.set(sx * 1.6, 2.4, -0.1); g.add(rod); }
    this.t = Math.random() * 30; this.acc = 0; this.g = g; this.mode = Math.random() < 0.5 ? 1 : 0;
    (parent.userData.screens ||= []).push(this);
  }
  update(dt) {
    this.t += dt; this.acc += dt;
    if (this.acc < 0.08 || !this.g.parent?.visible) return;
    this.acc = 0;
    const g = this.c.getContext('2d'), W = 320, H = 180, t = this.t, mode = this.mode;
    if (mode === 0) {
      // clip : dégradé pulsé, formes, égaliseur, titre
      const hue = (t * 25) % 360, beat = Math.abs(Math.sin(t * Math.PI * 2));
      const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, `hsl(${hue},80%,${35 + beat * 15}%)`); gr.addColorStop(1, `hsl(${(hue + 120) % 360},80%,25%)`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      for (let k = 0; k < 6; k++) { g.fillStyle = `hsla(${(hue + k * 50) % 360},90%,70%,0.35)`; g.beginPath(); g.arc(W / 2 + Math.cos(t + k) * 100, H / 2 + Math.sin(t * 1.3 + k) * 50, 12 + beat * 20, 0, 7); g.fill(); }
      for (let k = 0; k < 24; k++) { const h = 10 + Math.abs(Math.sin(t * 6 + k * 0.7)) * 50 * (0.5 + beat); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(14 + k * 12, H - 10 - h, 8, h); }
      g.fillStyle = '#fff'; g.font = 'bold 18px sans-serif'; g.fillText('♪ ÉLECTRO HITS', 12, 26);
    } else {
      // match de padel vu de haut, balle qui va et vient, score
      g.fillStyle = '#1a3c6e'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#2a62b8'; g.fillRect(60, 20, 200, 140);
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(60, 20, 200, 140); g.beginPath(); g.moveTo(160, 20); g.lineTo(160, 160); g.stroke();
      g.beginPath(); g.moveTo(100, 20); g.lineTo(100, 160); g.moveTo(220, 20); g.lineTo(220, 160); g.moveTo(100, 90); g.lineTo(220, 90); g.stroke();
      const bx = 160 + Math.sin(t * 1.7) * 90, by = 90 + Math.sin(t * 2.9) * 55;
      g.fillStyle = '#e4ff2e'; g.beginPath(); g.arc(bx, by, 4, 0, 7); g.fill();
      for (const [px, py, c] of [[80, 60 + Math.sin(t * 1.7) * 40, '#ff8a65'], [80, 120 + Math.cos(t) * 20, '#ff8a65'], [240, 60 + Math.cos(t * 1.4) * 40, '#69f0ae'], [240, 120 + Math.sin(t * 1.2) * 20, '#69f0ae']]) { g.fillStyle = c; g.beginPath(); g.arc(px, py, 7, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, W, 18); g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif';
      g.fillText(`PADEL TOUR · LIVE   ${Math.floor(t / 7) % 6} - ${Math.floor(t / 11) % 6}`, 8, 13);
    }
    this.tex.needsUpdate = true;
  }
}

/** Barman : essuie le comptoir, tire une bière, sert. */
class Barman {
  constructor(parent, x, z, rotY) {
    this.av = new Avatar({ ...makeAppearance('black', 777 + Math.round(z), { name: '' }), headwear: null });
    this.av.racket.visible = false;
    this.av.root.position.set(x, 0, z); this.av.root.rotation.y = rotY;
    parent.add(this.av.root);
    this.x0 = x; this.yaw0 = rotY; this.t = Math.random() * 10;
  }
  update(dt) {
    this.t += dt;
    const cyc = this.t % 9;
    // 0-3 s : essuie ; 3-5 : se déplace vers les tireuses ; 5-7 : tire une bière ; 7-9 : revient servir
    const tx = cyc < 3 ? this.x0 + 1.2 : cyc < 7 ? this.x0 - 0.2 : this.x0 + 0.6;
    const p = this.av.root.position, dx = tx - p.x;
    const v = Math.max(-1.2, Math.min(1.2, dx * 3));
    p.x += v * dt;
    const wipe = cyc < 3 ? { armed: { kind: 'fore', charge: 0.3 + 0.25 * Math.sin(this.t * 6) } } : cyc > 5 && cyc < 7 ? { armed: { kind: 'over', charge: 0.15 } } : {};
    this.av.animate(dt, { speed: Math.abs(v), fwd: 0, side: v, yaw: this.yaw0, look: 0, ready: false, swing: null, armed: null, ...wipe });
  }
}

/** Promeneurs : ils marchent dans les allées du hangar, s'arrêtent regarder un match, puis repartent. */
class Strollers {
  constructor(parent, n) {
    // allées : couloirs verticaux x = -12.6, 0, 12.6 et allée transversale z = 0 ; points d'arrêt dessus
    this.spots = [[-12.6, -7], [-12.6, -17], [12.6, -8], [12.6, -16], [-12.6, 8], [-12.6, 17], [12.6, 7], [12.6, 18], [0, -6], [0, 6], [0, -20], [0, 20], [-6, 0], [6, 0]];
    this.list = [];
    const kits = ['red', 'blue', 'green', 'orange', 'white', 'black'];
    for (let i = 0; i < n; i++) {
      const av = new Avatar({ ...makeAppearance(kits[i % kits.length], 5200 + i * 53), name: '', headwear: null });
      av.racket.visible = false;
      const s0 = this.spots[(i * 5) % this.spots.length];
      av.root.position.set(s0[0], 0, s0[1]);
      parent.add(av.root);
      this.list.push({ av, path: [], wait: Math.random() * 6, yaw: 0, speed: 0.9 + Math.random() * 0.5, spot: s0 });
    }
  }
  /** Chemin en L par l'allée transversale (on ne traverse jamais un court). */
  route(a, b) {
    if (a[0] === b[0] && (a[1] * b[1] >= 0 || Math.abs(a[0]) !== 6)) return [b];
    const pts = [];
    if (Math.abs(a[1]) > 0.01) pts.push([a[0], 0]);
    if (a[0] !== b[0]) pts.push([b[0], 0]);
    pts.push(b);
    return pts;
  }
  update(dt) {
    for (const w of this.list) {
      const p = w.av.root.position;
      let v = 0;
      if (w.wait > 0) {
        w.wait -= dt;
        if (w.wait <= 0) {
          const nxt = this.spots[Math.floor(Math.random() * this.spots.length)];
          w.path = this.route(w.spot, nxt); w.spot = nxt;
        }
      } else if (w.path.length) {
        const [tx, tz] = w.path[0];
        const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
        if (d < 0.05) { w.path.shift(); if (!w.path.length) w.wait = 5 + Math.random() * 10; }
        else { v = w.speed; const k = Math.min(d, v * dt); p.x += (dx / d) * k; p.z += (dz / d) * k; w.yaw = Math.atan2(dx, dz); }
      }
      // à l'arrêt : tourné vers le court le plus proche
      const rest = Math.abs(p.x) > 12 ? -Math.sign(p.x) * Math.PI / 2 : Math.abs(p.z) < 1 ? (p.z >= 0 ? 0 : Math.PI) : (p.x === 0 ? (Math.random() < 0 ? 0 : -Math.PI / 2) : 0);
      w.av.animate(dt, { speed: v, fwd: v, side: 0, yaw: v ? w.yaw : rest, look: 0, ready: false, armed: null, swing: null });
    }
  }
}

/** Mer animée : houle (sommets déplacés), rouleaux d'écume qui montent et se retirent sur le sable. */
class Sea {
  constructor(parent) {
    const geo = new THREE.PlaneGeometry(600, 160, 150, 60).rotateX(-Math.PI / 2).translate(0, 0, -118);
    this.geo = geo; this.base = Float32Array.from(geo.attributes.position.array);
    const m = new THREE.MeshStandardMaterial({ color: 0x1a6ea6, roughness: 0.12, metalness: 0.25 });
    this.mesh = new THREE.Mesh(geo, m);
    this.mesh.receiveShadow = true;
    parent.add(this.mesh);
    // eau peu profonde, plus claire, au bord
    const shallow = new THREE.Mesh(new THREE.PlaneGeometry(600, 14).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3fb6c8, roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }));
    shallow.position.set(0, 0.02, -43);
    parent.add(shallow);
    this.foam = [];
    const foamMat = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(600, 1.6, 120, 1).rotateX(-Math.PI / 2), foamMat());
      f.position.y = 0.05; parent.add(f);
      this.foam.push({ f, ph: i / 3, bp: Float32Array.from(f.geometry.attributes.position.array) });
    }
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    const t = this.t, p = this.geo.attributes.position, b = this.base;
    for (let i = 0; i < p.count; i++) {
      const x = b[i * 3], z = b[i * 3 + 2];
      const near = Math.max(0, Math.min(1, (z + 200) / 160));
      p.setY(i, 0.03 + (Math.sin(z * 0.35 - t * 1.6 + x * 0.02) * 0.18 + Math.sin(x * 0.11 - t * 0.9) * 0.08) * (0.4 + near * 0.6));
    }
    p.needsUpdate = true; this.geo.computeVertexNormals();
    // rouleaux : chaque vague arrive, s'étale sur le sable puis disparaît
    for (const w of this.foam) {
      const u = (t / 7 + w.ph) % 1;
      const z = -48 + u * 9 - (u > 0.75 ? (u - 0.75) * 10 : 0);
      w.f.position.z = z;
      w.f.material.opacity = Math.sin(Math.min(1, u / 0.85) * Math.PI) * 0.75;
      const fp = w.f.geometry.attributes.position;
      for (let i = 0; i < fp.count; i++) fp.setZ(i, w.bp[i * 3 + 2] + Math.sin(w.bp[i * 3] * 0.08 + w.ph * 9) * 1.2);
      fp.needsUpdate = true;
    }
  }
}

/** Position locale d'un groupe -> coordonnées du décor (pour le public instancié). */
function local(g, x, y, z, ry) {
  const v = new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y).add(g.position);
  return { x: v.x, y: v.y, z: v.z, ry: ry + g.rotation.y };
}

function city(out, intensity = 0.6) {
  const sk = skylineTex();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a3140, emissiveMap: sk, emissive: 0xffffff, emissiveIntensity: intensity, roughness: 1 });
  out.windows.push(mat);
  const N = 34, M = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), mat, N);
  for (let i = 0; i < N; i++) {
    const a = Math.PI * (0.62 + (i / N) * 1.76), r = 170 + Math.random() * 50;
    q.setFromEuler(new THREE.Euler(0, -a, 0));
    M.compose(v.set(Math.cos(a) * r, 0, Math.sin(a) * r), q, sc.set(10 + Math.random() * 14, 10 + Math.random() * 26, 8 + Math.random() * 10));
    inst.setMatrixAt(i, M);
  }
  out.group.add(inst);
}

// ------------------------------------------------------------------ construction d'un lieu
/**
 * @param {string} id   clé de VENUES
 * @param {object} ctx  { renderer, glassMat, wireMap, netMap }
 */
export function buildVenue(id, ctx, courtIdx = 0, club = null) {
  const def = { ...(VENUES[id] || VENUES.club), id };
  const courts = courtsOf(id, club);
  const ci = Math.max(0, Math.min(courts.length - 1, courtIdx | 0));
  const [cx, cz, crot = 0, cturf] = courts[ci];
  const out = {
    id, court: ci, def, group: new THREE.Group(), walls: null, glassMeshes: [], spots: [], adMats: [], windows: [], emissive: [], crowdSeats: [],
    lampMat: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e6, emissiveIntensity: 6, roughness: 0.3 }),
    crowd: null, ambient: [], parties: [], bands: [], sonos: [],
  };
  out.group.name = `venue-${id}`;
  buildCourtShell(ctx, cturf ? { ...def, turf: cturf } : def, out);
  // le décor est décalé (et tourné) pour que le court choisi soit au centre
  const decor = new THREE.Group();
  decor.name = 'decor';
  decor.rotation.y = -crot;
  decor.position.copy(new THREE.Vector3(cx, 0, cz).applyAxisAngle(new THREE.Vector3(0, 1, 0), -crot).negate());
  out.group.add(decor);
  const d = { ...out, group: decor };
  switch (id) {
    case 'municipal': decorMunicipal(d, ctx.renderer); break;
    case 'ceyreste': decorCeyreste(d, ctx.renderer); break;
    case 'laciotat': decorLaCiotat(d, ctx.renderer); break;
    case 'prestige': decorPrestige(d, ctx.renderer); break;
    case 'national': decorNational(d, ctx.renderer); break;
    case 'pro': decorStadium(d, ctx.renderer); break;
    case 'beach': decorBeach(d, ctx.renderer); break;
    case 'hangar': decorHangar(d, ctx.renderer); out.lampBoxes = d.lampBoxes; break;
    case 'myclub': decorMyClub(d, ctx.renderer, club || { name: 'Mon club', courts: 1, bar: 0, stands: 0, decos: [] }); break;
    default: {
      const env = buildSurroundings(decor, ctx.renderer, { lampMat: out.lampMat, wireMap: ctx.wireMap, turfMap: out.turfMap, skipApron: true, skipCourts: true, focus: [cx, cz] });
      out.windows.push(...env.windows); out.emissive.push(...env.emissive);
      out.crowd = env.crowd;
      fete(d, ctx.renderer, 16, -21, 0, 0, 'FÊTE DU CLUB');
      horizon(d, { r0: 48, r1: 95, kinds: ['plane', 'cypress', 'pine'], n: 45 });
    }
  }
  // les autres courts du lieu (dont l'ancien central), avec des joueurs dessus
  // gazon des autres courts : celui du lieu (pas celui du court choisi s'il a sa propre couleur)
  let baseTurf = out.turfMap;
  if (cturf) { baseTurf = TX.makeTurfTextures(ctx.renderer, def.turf).map; baseTurf.repeat.set(2 * HW / 1.25, 2 * HL / 1.25); }
  const nMats = {
    turf: new THREE.MeshStandardMaterial({ map: baseTurf, roughness: 0.95 }),
    line: new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.8 }),
    net: new THREE.MeshStandardMaterial({ map: ctx.netMap, transparent: true, side: THREE.DoubleSide, color: 0x666666, depthWrite: false }),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfe8ee, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false }),
    wire: new THREE.MeshStandardMaterial({ map: ctx.wireMap, color: def.wire ?? 0x9aa0a8, transparent: true, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.5, depthWrite: false }),
    frame: new THREE.MeshStandardMaterial({ color: def.frame, metalness: 0.6, roughness: 0.45 }),
    lamp: out.lampMat,
  };
  courts.forEach(([x, z, rot = 0, turf], i) => {
    if (i === ci) return;
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = rot;
    decor.add(g);
    let mats = nMats;
    if (turf) {
      const { map } = TX.makeTurfTextures(ctx.renderer, turf);
      map.repeat.set(2 * HW / 1.25, 2 * HL / 1.25);
      mats = { ...nMats, turf: new THREE.MeshStandardMaterial({ map, roughness: 0.95 }) };
    }
    g.add(neighborCourtAt(0, 0, mats));
    if (def.blades) g.add(cornerBlades(0, 0, def.blades));
    flat({ ...d, group: g }, 2 * HW + 2, 2 * HL + 2, 0, 0, def.apron, 0.003);
    out.ambient.push(new AmbientMatch(g, { x: 0, z: 0, seed: 1000 + i * 77 + id.length, doubles: ctx.quality !== 'low' }));
  });
  // spectateurs assis « au ras du sol » : on leur donne une vraie chaise (sinon les jambes traversent le sol)
  {
    const chairs = [];
    for (const st of out.crowdSeats) {
      const floor = st.y < -0.5 ? -0.9 : 0;
      if (st.y - floor > 0.25) continue;
      const g = new THREE.Group();
      g.position.set(st.x, floor, st.z); g.rotation.y = st.ry;
      chairs.push(g);
      st.y = floor + 0.44;
    }
    if (chairs.length) {
      const seatG = new THREE.BoxGeometry(0.42, 0.04, 0.4).translate(0, 0.43, 0.02);
      const backG = new THREE.BoxGeometry(0.42, 0.42, 0.03).translate(0, 0.66, -0.18);
      const legG = mergeGeometries([[-0.18, -0.16], [0.18, -0.16], [-0.18, 0.18], [0.18, 0.18]].map(([lx, lz]) => new THREE.CylinderGeometry(0.014, 0.014, 0.43, 5).translate(lx, 0.215, lz)));
      const mk = (geo, mat) => { const im = new THREE.InstancedMesh(geo, mat, chairs.length); chairs.forEach((c, i) => { c.updateMatrix(); im.setMatrixAt(i, c.matrix); }); im.castShadow = true; decor.add(im); };
      const plastic = new THREE.MeshStandardMaterial({ color: id === 'ceyreste' ? 0xf2f2ee : id === 'hangar' ? 0x2b2f36 : 0xe8e3d8, roughness: 0.55 });
      mk(seatG, plastic); mk(backG, plastic); mk(legG, new THREE.MeshStandardMaterial({ color: 0x8d939b, metalness: 0.7, roughness: 0.35 }));
    }
  }
  if (!out.crowd) out.crowd = new Crowd(decor, out.crowdSeats.length ? out.crowdSeats : [{ x: 0, y: -10, z: 0, ry: 0 }]);
  // un petit sac de padel au bord du court (remplacé par celui du joueur si besoin)
  out.benchSpot = def.outside ? { x: -(HW + 1.9), z: -1.2 } : { x: -(HW + 1.2), z: -2.8 };
  out.dispose = () => {
    out.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) if (m !== ctx.glassMat && !ctx.shared.has(m)) m.dispose();
    });
  };
  return out;
}

export { hedgeTex };
