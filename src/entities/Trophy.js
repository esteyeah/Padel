// ============================================================================
//  Trophées de tournoi : la taille, la matière et le design dépendent du lieu
//  et de la réputation du tournoi.
//   amateur   petite coupe en argent
//   régional  coupe moyenne en argent, anses
//   national  grande coupe dorée sur socle en marbre
//   mondial   très grande coupe dorée
//   Riviera   trophée « raquette de padel » géante en or sur socle noir
// ============================================================================
import * as THREE from 'three';

/** Caractéristiques du trophée d'un tournoi. */
export function trophySpec(tier, venue) {
  if (venue === 'prestige') return { kind: 'racket', metal: 'gold', size: 1.25, label: 'Trophée Riviera (raquette en or)', duration: 11 };
  return {
    amateur: { kind: 'cup', metal: 'silver', size: 0.45, label: 'Petite coupe en argent', duration: 4 },
    regional: { kind: 'cup', metal: 'silver', size: 0.7, label: 'Coupe en argent', duration: 6 },
    national: { kind: 'cup', metal: 'gold', size: 0.95, label: 'Grande coupe dorée', duration: 8 },
    pro: { kind: 'cup', metal: 'gold', size: 1.15, label: 'Coupe du circuit mondial', duration: 10 },
  }[tier] || { kind: 'cup', metal: 'silver', size: 0.45, label: 'Petite coupe', duration: 4 };
}

/** Modèle 3D du trophée (origine au pied du socle, hauteur ≈ 0,5 × size m). */
export function makeTrophy(spec) {
  const g = new THREE.Group();
  const metal = new THREE.MeshPhysicalMaterial({
    color: spec.metal === 'gold' ? 0xe0b13a : 0xd9dde3, metalness: 0.85, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08,
    emissive: spec.metal === 'gold' ? 0x5a3c00 : 0x3a3d42, emissiveIntensity: 0.6,
  });
  const base = new THREE.MeshStandardMaterial({ color: spec.kind === 'racket' ? 0x111214 : spec.metal === 'gold' ? 0xf0ece4 : 0x2a2c30, roughness: spec.metal === 'gold' ? 0.25 : 0.5, metalness: 0.2 });
  const s = spec.size;
  if (spec.kind === 'racket') {
    // socle noir à deux étages, raquette de padel en or debout, balle dorée
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.07 * s, 0.22 * s).translate(0, 0.035 * s, 0), base));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.16 * s, 0.05 * s, 0.16 * s).translate(0, 0.095 * s, 0), base));
    const sh = new THREE.Shape(); const W = 0.13 * s, L = 0.2 * s;
    sh.moveTo(0, 0); sh.bezierCurveTo(W, 0, W * 1.1, L * 0.6, W * 0.7, L * 0.95); sh.quadraticCurveTo(0, L * 1.12, -W * 0.7, L * 0.95); sh.bezierCurveTo(-W * 1.1, L * 0.6, -W, 0, 0, 0);
    const head = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.025 * s, bevelEnabled: true, bevelSize: 0.004 * s, bevelThickness: 0.004 * s, bevelSegments: 2 }).translate(0, 0.27 * s, -0.0125 * s), metal);
    g.add(head);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016 * s, 0.018 * s, 0.16 * s, 12).translate(0, 0.2 * s, 0), metal);
    g.add(handle);
    const holes = new THREE.MeshStandardMaterial({ color: 0x3a2a08, roughness: 0.5 });
    for (let y = 0; y < 4; y++) for (let x = -2; x <= 2; x++) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.006 * s, 0.006 * s, 0.035 * s, 8).rotateX(Math.PI / 2), holes);
      h.position.set(x * 0.03 * s, 0.34 * s + y * 0.035 * s, 0); g.add(h);
    }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.03 * s, 16, 12), metal); ball.position.set(0.09 * s, 0.15 * s, 0.03 * s); g.add(ball);
  } else {
    // coupe : socle, pied, vasque, anses (à partir du régional), couvercle pour les grandes
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.1 * s, 0.07 * s, 24).translate(0, 0.035 * s, 0), base));
    const prof = [[0.0, 0.07], [0.05, 0.07], [0.02, 0.11], [0.018, 0.2], [0.03, 0.23], [0.1, 0.32], [0.12, 0.42], [0.115, 0.43]].map(([r, y]) => new THREE.Vector2(r * s, y * s));
    g.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 32), metal));
    if (s >= 0.6) for (const sx of [-1, 1]) {
      const ha = new THREE.Mesh(new THREE.TorusGeometry(0.045 * s, 0.008 * s, 8, 18, Math.PI * 1.2), metal);
      ha.position.set(sx * 0.125 * s, 0.36 * s, 0); ha.rotation.z = sx > 0 ? -Math.PI * 0.6 : Math.PI * 1.6 - Math.PI; g.add(ha);
    }
    if (spec.metal === 'gold') {
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.11 * s, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2.4).translate(0, 0.42 * s, 0), metal));
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.025 * s, 12, 8).translate(0, 0.5 * s, 0), metal));
    }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
