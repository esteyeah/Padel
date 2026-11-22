// ============================================================================
//  Raquettes : modèles (forme, bonus), designs du tamis (achetables à part,
//  en boutique de carrière) et rendu du tamis en texture.
//
//  Un modèle donne la couleur du cadre et un design par défaut ; le joueur
//  peut le remplacer par n'importe quel design acheté.
// ============================================================================
import * as THREE from 'three';

/**
 * Designs du tamis.
 * pattern : motif dessiné ; base : fond ; face : couleur principale ; accent : 2e couleur.
 */
export const RACKET_DESIGNS = [
  { id: 'model', label: 'Design d\'origine', price: 0 },
  { id: 'carbon3k', label: 'Carbone 3K brut', pattern: 'weave', base: 0x15171b, face: 0x3a3e46, accent: 0xb0b8c4, price: 120 },
  { id: 'flame', label: 'Flammes', pattern: 'flame', base: 0x120806, face: 0xff5722, accent: 0xffd400, price: 160 },
  { id: 'bolt', label: 'Éclair', pattern: 'bolt', base: 0x0b1530, face: 0x1e88e5, accent: 0xfff176, price: 140 },
  { id: 'hex', label: 'Nid d\'abeille', pattern: 'hex', base: 0x101418, face: 0x00e5ff, accent: 0x263238, price: 150 },
  { id: 'sunset', label: 'Coucher de soleil', pattern: 'gradient', base: 0xff7043, face: 0xab47bc, accent: 0xffd54f, price: 130 },
  { id: 'wave', label: 'Vague', pattern: 'wave', base: 0xe8f6ff, face: 0x0288d1, accent: 0x4dd0e1, price: 130 },
  { id: 'camo', label: 'Camouflage', pattern: 'camo', base: 0x3e4a2c, face: 0x6b7a45, accent: 0x1f2618, price: 120 },
  { id: 'geo', label: 'Géométrique', pattern: 'geo', base: 0xf5f5f5, face: 0xe53935, accent: 0x212121, price: 140 },
  { id: 'tropic', label: 'Tropical', pattern: 'tropic', base: 0x0f3d2e, face: 0x2ecc71, accent: 0xff4081, price: 170 },
  { id: 'provence', label: 'Provence (lavande)', pattern: 'lavender', base: 0xf3ead7, face: 0x7e57c2, accent: 0x6d8f3a, price: 190 },
  { id: 'galaxy', label: 'Galaxie', pattern: 'galaxy', base: 0x070716, face: 0x7c4dff, accent: 0x40c4ff, price: 220 },
  { id: 'gold24', label: 'Feuille d\'or', pattern: 'goldleaf', base: 0x14100a, face: 0xd4a72c, accent: 0xfff3c4, price: 900 },
];
export const designById = (id) => RACKET_DESIGNS.find((d) => d.id === id) || RACKET_DESIGNS[0];

const hex = (c) => `#${(c ?? 0).toString(16).padStart(6, '0')}`;
const texCache = new Map();

/** Texture du tamis (512 px) : fond, motif, logo, trous percés avec reflet. */
export function racketTexture(color, pattern = 'arc', faceColor = null, base = null, accent = null, label = '') {
  const key = [color, pattern, faceColor, base, accent, label].join('|');
  if (texCache.has(key)) return texCache.get(key);
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  // fond (carbone sombre par défaut)
  const grd = g.createLinearGradient(0, 0, S, S);
  grd.addColorStop(0, base != null ? hex(base) : '#2a2d33');
  grd.addColorStop(1, base != null ? hex(new THREE.Color(base).multiplyScalar(0.55).getHex()) : '#0e0f12');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  // fine trame de carbone sur tous les designs
  g.globalAlpha = 0.07; g.fillStyle = '#ffffff';
  for (let y = 0; y < S; y += 8) for (let x = (y / 8) % 2 ? 0 : 4; x < S; x += 8) g.fillRect(x, y, 4, 4);
  g.globalAlpha = 1;
  const main = hex(faceColor ?? color), acc = hex(accent ?? color);
  g.strokeStyle = main; g.fillStyle = main; g.lineCap = 'round'; g.lineJoin = 'round';
  const R = (a, b) => a + Math.random() * (b - a);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  switch (pattern) {
    case 'stripes': g.lineWidth = 36; for (let i = -2; i < 4; i++) { g.beginPath(); g.moveTo(i * 160, S); g.lineTo(i * 160 + 360, 0); g.stroke(); } break;
    case 'star': { g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 72 : 168, a = (i / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(256 + Math.cos(a) * r, 256 + Math.sin(a) * r); } g.closePath(); g.fill(); break; }
    case 'split': g.fillRect(0, 0, S / 2, S); g.fillStyle = acc; g.fillRect(S / 2 - 6, 0, 12, S); break;
    case 'weave':
      for (let y = 0; y < S; y += 32) for (let x = 0; x < S; x += 32) {
        const h = ((x + y) / 32) % 2;
        const gr = h ? g.createLinearGradient(x, y, x + 32, y) : g.createLinearGradient(x, y, x, y + 32);
        gr.addColorStop(0, main); gr.addColorStop(0.5, acc); gr.addColorStop(1, main);
        g.fillStyle = gr; g.globalAlpha = 0.55; g.fillRect(x + 1, y + 1, 30, 30);
      }
      g.globalAlpha = 1; break;
    case 'flame':
      for (let k = 0; k < 3; k++) {
        g.fillStyle = k === 2 ? acc : main; g.globalAlpha = k === 0 ? 0.6 : 1;
        g.beginPath(); g.moveTo(0, S);
        for (let x = 0; x <= S; x += 32) g.quadraticCurveTo(x + 16, S - (230 - k * 60) - (x % 64 ? 60 : 140) * (1 - k * 0.25), x + 32, S - (120 - k * 30));
        g.lineTo(S, S); g.closePath(); g.fill();
      }
      g.globalAlpha = 1; break;
    case 'bolt':
      g.fillStyle = acc; g.beginPath(); g.moveTo(300, 20); g.lineTo(170, 270); g.lineTo(250, 270); g.lineTo(190, 500); g.lineTo(360, 210); g.lineTo(275, 210); g.lineTo(340, 20); g.closePath(); g.fill();
      g.strokeStyle = main; g.lineWidth = 10; g.stroke(); break;
    case 'hex': {
      g.lineWidth = 6; const r = 34;
      for (let row = -1; row < 10; row++) for (let col = -1; col < 10; col++) {
        const cx = col * r * 1.75 + (row % 2) * r * 0.87, cy = row * r * 1.5;
        g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath();
        if (rnd() < 0.18) { g.fillStyle = main; g.globalAlpha = 0.5; g.fill(); g.globalAlpha = 1; }
        g.strokeStyle = main; g.stroke();
      }
      break;
    }
    case 'gradient': {
      const gg = g.createLinearGradient(0, 0, 0, S); gg.addColorStop(0, acc); gg.addColorStop(0.5, hex(base)); gg.addColorStop(1, main);
      g.fillStyle = gg; g.fillRect(0, 0, S, S);
      g.fillStyle = acc; g.beginPath(); g.arc(256, 300, 90, Math.PI, 0); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 310; y < S; y += 26) g.fillRect(0, y, S, 8); break;
    }
    case 'wave':
      for (let k = 0; k < 5; k++) {
        g.strokeStyle = k % 2 ? acc : main; g.lineWidth = 30 - k * 3;
        g.beginPath(); for (let x = -20; x <= S + 20; x += 8) g.lineTo(x, 140 + k * 70 + Math.sin(x / 50 + k) * 30); g.stroke();
      }
      break;
    case 'camo':
      for (let i = 0; i < 46; i++) {
        g.fillStyle = i % 3 === 0 ? acc : i % 3 === 1 ? main : hex(new THREE.Color(main).multiplyScalar(1.3).getHex());
        g.beginPath(); const cx = rnd() * S, cy = rnd() * S;
        for (let a = 0; a < Math.PI * 2; a += 0.6) { const rr = 30 + rnd() * 40; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7); }
        g.closePath(); g.fill();
      }
      break;
    case 'geo':
      for (let i = 0; i < 14; i++) {
        g.fillStyle = i % 2 ? main : acc; g.globalAlpha = 0.9;
        g.beginPath(); g.moveTo(rnd() * S, rnd() * S); g.lineTo(rnd() * S, rnd() * S); g.lineTo(rnd() * S, rnd() * S); g.closePath(); g.fill();
      }
      g.globalAlpha = 1; break;
    case 'tropic':
      for (let i = 0; i < 9; i++) {
        const cx = rnd() * S, cy = rnd() * S, a0 = rnd() * Math.PI * 2;
        g.save(); g.translate(cx, cy); g.rotate(a0);
        g.fillStyle = i % 3 === 0 ? acc : main;
        g.beginPath(); g.ellipse(0, 0, 110, 40, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = hex(base); g.lineWidth = 5; g.beginPath(); g.moveTo(-100, 0); g.lineTo(100, 0); g.stroke();
        for (let k = -80; k < 90; k += 22) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 18, 30); g.moveTo(k, 0); g.lineTo(k + 18, -30); g.stroke(); }
        g.restore();
      }
      break;
    case 'lavender':
      g.fillStyle = acc; g.fillRect(0, 360, S, S);
      for (let row = 0; row < 5; row++) for (let x = -10; x < S; x += 34) {
        const by = 380 + row * 30, h = 140 - row * 18;
        g.strokeStyle = acc; g.lineWidth = 4; g.beginPath(); g.moveTo(x + row * 12, by); g.lineTo(x + row * 12, by - h); g.stroke();
        g.fillStyle = main; for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(x + row * 12, by - h + k * 9, 7, 5, 0, 0, Math.PI * 2); g.fill(); }
      }
      g.fillStyle = '#ffd54f'; g.beginPath(); g.arc(380, 120, 52, 0, Math.PI * 2); g.fill(); break;
    case 'galaxy': {
      for (let i = 0; i < 5; i++) {
        const rg = g.createRadialGradient(rnd() * S, rnd() * S, 0, 256, 256, 260);
        rg.addColorStop(0, i % 2 ? main : acc); rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalAlpha = 0.45; g.fillStyle = rg; g.fillRect(0, 0, S, S);
      }
      g.globalAlpha = 1; g.fillStyle = '#ffffff';
      for (let i = 0; i < 160; i++) { g.globalAlpha = rnd(); g.fillRect(rnd() * S, rnd() * S, 2, 2); }
      g.globalAlpha = 1; break;
    }
    case 'goldleaf':
      for (let i = 0; i < 70; i++) {
        g.fillStyle = i % 4 ? main : acc; g.globalAlpha = 0.6 + rnd() * 0.4;
        g.beginPath(); const cx = rnd() * S, cy = rnd() * S;
        for (let a = 0; a < Math.PI * 2; a += 1.1) { const rr = 14 + rnd() * 30; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        g.closePath(); g.fill();
      }
      g.globalAlpha = 1; break;
    default: g.lineWidth = 36; g.beginPath(); g.moveTo(40, 400); g.quadraticCurveTo(256, 160, 472, 400); g.stroke();
  }
  // logo du modèle
  g.save();
  g.translate(256, 92);
  g.font = 'bold 44px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
  g.textAlign = 'center';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.strokeText('PADEL ARENA', 0, 0);
  g.fillStyle = '#ffffff'; g.fillText('PADEL ARENA', 0, 0);
  if (label) { g.font = 'bold 26px "Barlow Condensed", "Arial Narrow", Arial, sans-serif'; g.fillStyle = hex(color); g.strokeText(label.toUpperCase(), 0, 30); g.fillText(label.toUpperCase(), 0, 30); }
  g.restore();
  // trous percés : ombre intérieure + reflet sur le bord
  for (let y = 150; y < 470; y += 34) {
    for (let x = 70; x < 450; x += 34) {
      const px = x + ((y / 34) % 2) * 17;
      if (Math.hypot((px - 256) / 1.0, (y - 300) / 0.95) > 165) continue;
      const rg = g.createRadialGradient(px - 2, y - 2, 1, px, y, 9);
      rg.addColorStop(0, '#000000'); rg.addColorStop(0.75, '#050505'); rg.addColorStop(1, 'rgba(255,255,255,0.35)');
      g.fillStyle = rg; g.beginPath(); g.arc(px, y, 8.5, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

// ------------------------------------------------------------------ modèle 3D seul (présentoir)
const outline = (k) => {
  const sh = new THREE.Shape(), cx = -0.33, W = 0.132 * k, Ltop = 0.165 * k, Lbot = 0.13 * k;
  sh.moveTo(cx - Ltop, 0);
  sh.bezierCurveTo(cx - Ltop, W * 1.05, cx + Lbot * 0.2, W * 1.02, cx + Lbot, W * 0.42);
  sh.quadraticCurveTo(cx + Lbot * 1.08, 0, cx + Lbot, -W * 0.42);
  sh.bezierCurveTo(cx + Lbot * 0.2, -W * 1.02, cx - Ltop, -W * 1.05, cx - Ltop, 0);
  return sh;
};
let shared = null;
function sharedGeo() {
  if (shared) return shared;
  const face = new THREE.ExtrudeGeometry(outline(0.93), { depth: 0.03, bevelEnabled: false, curveSegments: 28 }).translate(0, 0, -0.015);
  { const uv = face.attributes.uv, pp = face.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (pp.getX(i) + 0.48) / 0.3, (pp.getY(i) + 0.14) / 0.28); }
  const ring = outline(1.0); ring.holes.push(outline(0.93));
  const frame = new THREE.ExtrudeGeometry(ring, { depth: 0.032, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2, curveSegments: 28 }).translate(0, 0, -0.016);
  const arm = new THREE.CapsuleGeometry(0.012, 0.085, 4, 8);
  const grip = new THREE.CylinderGeometry(0.018, 0.017, 0.15, 12).rotateZ(Math.PI / 2).translate(-0.065, 0, 0);
  const cap = new THREE.CylinderGeometry(0.021, 0.019, 0.016, 14).rotateZ(Math.PI / 2).translate(0.012, 0, 0);
  shared = { face, frame, arm, grip, cap };
  return shared;
}

/** Raquette autonome (sans joueur) pour un présentoir : modèle r + design d. */
export function makeRacketMesh(r, d = null) {
  const G = sharedGeo();
  const dd = d && d.id !== 'model' ? d : null;
  const frameMat = new THREE.MeshPhysicalMaterial({ color: r.frame, roughness: 0.32, metalness: r.id === 'gold' ? 0.8 : 0.15, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const faceMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.25,
    map: racketTexture(r.frame, dd ? dd.pattern : r.pattern, dd ? dd.face : r.face, dd ? dd.base : r.base, dd ? dd.accent : r.accent, r.label),
  });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(G.face, faceMat), new THREE.Mesh(G.frame, frameMat));
  for (const sy of [1, -1]) {
    const a = new THREE.Mesh(G.arm, frameMat);
    a.position.set(-0.155, sy * 0.032, 0); a.rotation.z = Math.PI / 2 + sy * 0.45; a.scale.set(1, 1, 1.35);
    g.add(a);
  }
  g.add(new THREE.Mesh(G.grip, new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.9 })));
  g.add(new THREE.Mesh(G.cap, new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.4 })));
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
