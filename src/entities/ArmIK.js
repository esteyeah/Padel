// ============================================================================
//  Bras en cinématique inverse (IK à deux os) : on donne la position de la main
//  et l'orientation de la raquette (dans le repère de la poitrine), l'épaule et
//  le coude s'orientent naturellement (coude vers le bas / l'extérieur), sans
//  torsion du bras sur lui-même. Les gestes de frappe sont décrits comme des
//  trajectoires de main (préparation -> impact -> accompagnement).
//
//  Repère poitrine : x vers la gauche du joueur, y vers le haut, z vers l'avant.
//  Le bras droit (raquette) est du côté -x.
// ============================================================================
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const L1 = 0.29, L2 = 0.285;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qi = new THREE.Quaternion();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();

/**
 * Résout un bras. S : épaule (repère poitrine), H : main visée, pole : direction du coude.
 * right : bras droit (axe de repos -X, charnière Y) ou gauche (axe -Y, charnière X).
 * Applique les rotations aux os shoulder / elbow.
 */
export function solveArm(shoulder, elbow, S, H, pole, right) {
  const d = _a.subVectors(H, S);
  let dist = d.length();
  const dn = d.clone().normalize();
  dist = THREE.MathUtils.clamp(dist, 0.08, L1 + L2 - 0.004);
  const a = (L1 * L1 + dist * dist - L2 * L2) / (2 * dist);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const p = _b.copy(pole).addScaledVector(dn, -pole.dot(dn));
  if (p.lengthSq() < 1e-6) p.set(0, -1, 0).addScaledVector(dn, dn.y);
  p.normalize();
  const E = _c.copy(S).addScaledVector(dn, a).addScaledVector(p, h);
  const Hc = _d.copy(S).addScaledVector(dn, dist);
  const u = new THREE.Vector3().subVectors(E, S).normalize();
  const w = new THREE.Vector3().subVectors(Hc, E).normalize();
  let n = _e.crossVectors(u, w);
  if (n.lengthSq() < 1e-6) n.crossVectors(u, p);
  n.normalize();
  // repère de l'épaule : axe de repos -> u, charnière -> n
  let X, Y, Z;
  if (right) { X = u.clone().negate(); Y = n.clone(); Z = new THREE.Vector3().crossVectors(X, Y); }
  else { Y = u.clone().negate(); X = n.clone(); Z = new THREE.Vector3().crossVectors(X, Y); }
  _m.makeBasis(X, Y, Z);
  shoulder.quaternion.setFromRotationMatrix(_m);
  // coude : rotation pure autour de la charnière
  const wl = w.clone().applyQuaternion(_qi.copy(shoulder.quaternion).invert());
  elbow.quaternion.setFromUnitVectors(right ? V(-1, 0, 0) : V(0, -1, 0), wl);
  return E;
}

/** Oriente la raquette : tête vers D, tamis de normale F (repère poitrine). */
export function aimRacket(racket, shoulder, elbow, D, F) {
  const X = D.clone().normalize().negate();
  const Zv = F.clone().addScaledVector(X, -F.dot(X)).normalize();
  const Y = new THREE.Vector3().crossVectors(Zv, X);
  _m.makeBasis(X, Y, Zv);
  _q.setFromRotationMatrix(_m);
  const parent = shoulder.quaternion.clone().multiply(elbow.quaternion);
  racket.quaternion.copy(parent.invert().multiply(_q));
}

// ------------------------------------------------------------------ gestes
const bez = (a, b, c, t) => {
  const u = 1 - t;
  return new THREE.Vector3().addScaledVector(a, u * u).addScaledVector(b, 2 * u * t).addScaledVector(c, t * t);
};
const mix = (a, b, t) => a.clone().lerp(b, t);
const ease = (t) => t * t * (3 - 2 * t);

/**
 * Pose du bras de frappe et de la main libre.
 * state : { mode: 'idle'|'run'|'armed'|'swing', kind: 'fore'|'back'|'over', charge, t, dur, style, hc (hauteur d'impact / poitrine), run, ph }
 * Renvoie { H, D, F, LH (main gauche), twist, hips, lean }
 */
export function armPose(st) {
  const hc = THREE.MathUtils.clamp(st.hc ?? 0, -0.75, 0.45);
  if (st.mode === 'armed') {
    const k = st.charge;
    if (st.kind === 'over') {
      return { H: V(-0.3, 0.38 + 0.05 * k, -0.14), D: V(0.1, -0.85, -0.5), F: V(-1, 0, 0.2), LH: V(0.12, 0.62, 0.38), twist: -0.55 - 0.25 * k, hips: -0.3, lean: -0.12 };
    }
    if (st.kind === 'back') {
      return { H: V(0.24, -0.02 + hc * 0.3, -0.18 - 0.14 * k), D: V(0.45, 0.55 - 0.2 * k, -0.7), F: V(0.4, 0, 0.9), LH: V(0.2, -0.04, -0.06), twist: 0.6 + 0.4 * k, hips: 0.35, lean: 0.16 };
    }
    return { H: V(-0.44, -0.04 + hc * 0.3, -0.18 - 0.16 * k), D: V(-0.35, 0.5 - 0.15 * k, -0.78), F: V(-0.3, 0, 1), LH: V(0.16, 0.06, 0.42), twist: -0.55 - 0.35 * k, hips: -0.3, lean: 0.16 };
  }
  if (st.mode === 'swing') {
    const c = 0.1;                                   // part du geste avant l'impact (l'impact a lieu au début)
    const t = Math.min(1, st.t / st.dur);
    const pre = Math.pow(Math.min(1, t / c), 1.6), post = t <= c ? 0 : 1 - Math.pow(1 - (t - c) / (1 - c), 2.2);
    if (st.kind === 'over') {
      const P0 = V(-0.3, 0.42, -0.16), P1 = V(-0.16, 0.6 + Math.max(0, hc) * 0.2, 0.22), P2 = V(0.22, -0.18, 0.32);
      const H = t <= c ? bez(P0, V(-0.36, 0.7, -0.05), P1, pre) : bez(P1, V(0.05, 0.35, 0.45), P2, post);
      const D = t <= c ? mix(V(0.1, -0.85, -0.5), V(-0.05, 0.85, 0.55), pre) : mix(V(-0.05, 0.85, 0.55), V(0.55, -0.55, 0.5), post);
      const F = t <= c ? mix(V(-1, 0, 0.2), V(0, 0.35, 1), pre) : mix(V(0, 0.35, 1), V(0.3, -0.2, 1), post);
      return { H, D, F, LH: mix(V(0.12, 0.6, 0.38), V(0.1, -0.15, 0.2), post), twist: t <= c ? -0.7 + pre * 0.9 : 0.2 + post * 0.4, hips: t <= c ? -0.3 + pre * 0.4 : 0.1 + post * 0.25, lean: -0.12 + post * 0.32 };
    }
    const yc = hc - 0.04;
    let lift = 0, finishY = 0.28;
    if (st.style === 'lob') { lift = -0.12; finishY = 0.45; }
    if (st.style === 'slice') { lift = 0.2; finishY = -0.05; }
    if (st.kind === 'back') {
      const P0 = V(0.26, yc * 0.4 + lift, -0.3), P1 = V(0.32, yc, 0.38), P2 = V(-0.32, finishY + 0.05, 0.18);
      const H = t <= c ? bez(P0, V(0.42, yc + lift * 0.5, 0.0), P1, pre) : bez(P1, V(0.1, yc * 0.5 + 0.1, 0.6), P2, post);
      const D = t <= c ? mix(V(0.45, 0.5, -0.75), V(0.9, 0.12, 0.42), pre) : mix(V(0.9, 0.12, 0.42), V(-0.45, 0.8, 0.2), post);
      const F = t <= c ? mix(V(0.5, 0, 0.85), V(0, -lift * 0.6, 1), pre) : mix(V(0, -lift * 0.6, 1), V(-0.6, 0.2, 0.7), post);
      return { H, D, F, LH: mix(V(0.2, -0.04, -0.08), V(0.32, 0.0, -0.2), pre), twist: t <= c ? 0.95 - pre * 0.95 : -post * 0.5, hips: t <= c ? 0.35 - pre * 0.35 : -post * 0.25, lean: 0.18 };
    }
    // coup droit
    const P0 = V(-0.46, yc * 0.4 + lift, -0.32), P1 = V(-0.36, yc, 0.4), P2 = V(0.28, finishY, 0.22);
    const H = t <= c ? bez(P0, V(-0.55, yc + lift * 0.5, 0.0), P1, pre) : bez(P1, V(-0.05, yc * 0.5 + 0.12, 0.62), P2, post);
    const D = t <= c ? mix(V(-0.35, 0.45, -0.8), V(-0.9, 0.12, 0.42), pre) : mix(V(-0.9, 0.12, 0.42), V(0.35, 0.85, -0.25), post);
    const F = t <= c ? mix(V(-0.3, 0, 1), V(0, -lift * 0.6, 1), pre) : mix(V(0, -lift * 0.6, 1), V(0.7, 0.2, 0.6), post);
    return { H, D, F, LH: mix(V(0.18, 0.06, 0.42), V(0.3, 0.12, 0.05), post), twist: t <= c ? -0.9 + pre * 0.9 : post * 0.75, hips: t <= c ? -0.35 + pre * 0.35 : post * 0.35, lean: 0.2 };
  }
  if (st.mode === 'run') {
    const s = Math.sin(st.ph) * st.run;
    return { H: V(-0.3, -0.18, 0.12 + s * 0.12), D: V(-0.15, 0.35, 0.9), F: V(1, 0, 0), LH: V(0.26, -0.22 - Math.abs(s) * 0.04, -0.06 - s * 0.22), twist: s * 0.08, hips: -s * 0.06, lean: 0.12 };
  }
  // attente : raquette devant, main gauche au cœur de la raquette
  return { H: V(-0.17, -0.1, 0.34), D: V(0.12, 0.62, 0.78), F: V(1, 0, -0.15), LH: V(-0.02, -0.04, 0.4), twist: 0, hips: 0, lean: 0.12 };
}
