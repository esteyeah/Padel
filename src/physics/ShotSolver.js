// ============================================================================
//  Solveur de frappe : trouve la vitesse et l'angle de départ pour que la balle
//  atterrisse sur la cible, en tenant compte de la traînée et de l'effet Magnus.
//  La trajectoire reste dans le plan vertical (pas d'effet latéral) -> simulation 2D.
// ============================================================================
import * as THREE from 'three';
import { PHYS, BALL, SHOTS, COURT, netHeightAt, lerp } from '../config.js';
import { BallState, simulate } from './BallPhysics.js';

const R = BALL.radius;
const DT = 1 / 120;

/** Vol 2D (s = distance horizontale le long de la direction, y = hauteur). */
function fly(h0, v0, theta, omega, sNet) {
  let s = 0, y = h0, t = 0;
  let vs = v0 * Math.cos(theta), vy = v0 * Math.sin(theta), w = omega;
  const decay = Math.exp(-PHYS.spinDecay * DT);
  let yNet = null, apex = h0;
  while (t < 6) {
    const sp = Math.hypot(vs, vy);
    // ω = omega·(up × d) => a_magnus = c·omega·(vy, -vs)
    const as = -PHYS.drag * sp * vs + PHYS.magnus * w * vy;
    const ay = -PHYS.gravity - PHYS.drag * sp * vy - PHYS.magnus * w * vs;
    vs += as * DT; vy += ay * DT;
    const ps = s, py = y;
    s += vs * DT; y += vy * DT; w *= decay; t += DT;
    if (yNet === null && ps < sNet && s >= sNet) yNet = py + (y - py) * ((sNet - ps) / (s - ps || 1e-9));
    if (y > apex) apex = y;
    if (y <= R && vy < 0) {
      const f = (py - R) / (py - y || 1e-9);
      return { land: ps + (s - ps) * f, yNet: yNet ?? -10, apex, t };
    }
  }
  return { land: s, yNet: yNet ?? -10, apex, t };
}

function solveAngle(h0, v0, omega, D, sNet, branch, thMin) {
  const thMax = 1.38;
  const N = 20;
  let bestLand = -Infinity, bestTh = thMin;
  for (let i = 0; i <= N; i++) {
    const th = thMin + (thMax - thMin) * (i / N);
    const r = fly(h0, v0, th, omega, sNet);
    if (r.land > bestLand) { bestLand = r.land; bestTh = th; }
  }
  if (bestLand < D) return { status: 'slow' };
  let a, b;
  if (branch === 'low') {
    if (fly(h0, v0, thMin, omega, sNet).land > D) return { status: 'fast' };
    a = thMin; b = bestTh;
  } else {
    if (fly(h0, v0, thMax, omega, sNet).land > D) return { status: 'fast' };
    a = bestTh; b = thMax;
  }
  let th = (a + b) / 2, r = null;
  for (let i = 0; i < 24; i++) {
    th = (a + b) / 2;
    r = fly(h0, v0, th, omega, sNet);
    const tooLong = r.land > D;
    if (branch === 'low') { if (tooLong) b = th; else a = th; }
    else { if (tooLong) a = th; else b = th; }
  }
  return { status: 'ok', theta: th, ...r };
}

/**
 * Planifie une frappe.
 * @param {THREE.Vector3} from  position de la balle à l'impact
 * @param {{x:number,z:number}} target  point d'impact visé au sol
 * @param {string} type  clé de SHOTS
 * @param {number} power 0..1
 * @returns {{v:THREE.Vector3, w:THREE.Vector3, speed:number, theta:number, time:number, apex:number, clear:number}}
 */
export function planShot(from, target, type, power, speedMul = 1, thetaError = 0, fault = null) {
  const cfg = SHOTS[type] || SHOTS.drive;
  const dx = target.x - from.x, dz = target.z - from.z;
  const D = Math.max(0.5, Math.hypot(dx, dz));
  const ux = dx / D, uz = dz / D;
  let sNet = Math.abs(uz) > 1e-3 ? -from.z / uz : 0.1;
  if (!(sNet > 0.05)) sNet = 0.05;
  const netH = netHeightAt(from.x + ux * sNet);
  const omega = lerp(cfg.spin[0], cfg.spin[1], power);
  const thMin = cfg.thMin ?? -0.6;

  let speed = lerp(cfg.speed[0], cfg.speed[1], power) * speedMul;
  let lo = 0, hi = Infinity, best = null, bestSpeed = speed, ok = false;
  for (let i = 0; i < 18 && !ok; i++) {
    const r = solveAngle(from.y, speed, omega, D, sNet, cfg.branch, thMin);
    if (r.status === 'slow') { lo = speed; speed = isFinite(hi) ? (lo + hi) / 2 : speed * 1.15; continue; }
    if (r.status === 'fast') { hi = speed; speed = lo > 0 ? (lo + hi) / 2 : speed * 0.85; continue; }
    const clear = r.yNet - R - netH;
    if (cfg.branch === 'low' && clear < cfg.clear) {
      if (!best || clear > best.clear) { best = { ...r, clear }; bestSpeed = speed; }
      hi = speed; speed = lo > 0 ? (lo + hi) / 2 : speed * 0.88;
      continue;
    }
    best = { ...r, clear }; bestSpeed = speed; ok = true;
  }
  if (!best) { best = { theta: 0.5, t: 1.2, apex: 3, clear: 1 }; bestSpeed = 12; }

  let theta = best.theta + thetaError;
  if (fault === 'net') {
    // faute volontairement simulée : on abaisse l'angle jusqu'à toucher le filet
    for (let i = 0; i < 80; i++) {
      const r = fly(from.y, bestSpeed, theta, omega, sNet);
      if (r.yNet - R - netH < -0.04 - Math.random() * 0.2) break;
      theta -= 0.01;
    }
  }
  const c = Math.cos(theta), sn = Math.sin(theta);
  return {
    v: new THREE.Vector3(ux * c * bestSpeed, sn * bestSpeed, uz * c * bestSpeed),
    w: new THREE.Vector3(uz * omega, 0, -ux * omega), // axe = up × direction
    speed: bestSpeed,
    theta,
    time: best.t,
    apex: best.apex,
    clear: best.clear,
    ok,
  };
}

// ============================================================================
//  Contre-vitre (contrapared) : le joueur frappe vers SA vitre ; après le
//  rebond, la balle doit passer le filet et tomber dans le camp adverse.
//  La restitution de la vitre dépend de la vitesse : on cherche donc la
//  trajectoire par simulation complète (rebonds compris), sur une grille
//  vitesse x élévation, en visant l'image de la cible par rapport à la vitre.
// ============================================================================
const _wallState = new BallState();

function wallTrial(from, dirX, dirZ, speed, elev, side) {
  _wallState.reset(from);
  const c = Math.cos(elev);
  _wallState.v.set(dirX * c * speed, Math.sin(elev) * speed, dirZ * c * speed);
  let hitOwnWall = false, crossed = false, land = null, fail = false;
  simulate(_wallState, 3.5, 1 / 120, (st, t, evs) => {
    for (const e of evs) {
      if ((e.type === 'glass' || e.type === 'mesh') && !crossed) { if (e.side === side) hitOwnWall = true; else { fail = true; return false; } }
      else if (e.type === 'floor') { if (crossed && e.side === -side) land = e; else fail = true; return false; }
      else if (e.type === 'cross' && e.to === -side) { if (!hitOwnWall) { fail = true; return false; } crossed = true; }
      else if (e.type === 'net' || e.type === 'out') { fail = true; return false; }
    }
  });
  return fail || !land ? null : land;
}

/**
 * @param {THREE.Vector3} from  contact
 * @param {{x,z}} target        cible dans le camp adverse
 * @param {number} side         camp du frappeur
 * @returns {{v:THREE.Vector3, w:THREE.Vector3, speed:number, ok:boolean}}
 */
export function planWallShot(from, target, power, side, speedMul = 1) {
  const wallZ = side * COURT.halfL;
  let tx = target.x, tz = 2 * wallZ - target.z;           // image de la cible derrière la vitre
  let best = null;
  for (let pass = 0; pass < 2; pass++) {
    const dx = tx - from.x, dz = tz - from.z, d = Math.hypot(dx, dz) || 1;
    const ux = dx / d, uz = dz / d;
    for (let sp = 12; sp <= 30; sp += 2) {
      for (let el = 0.05; el <= 1.15; el += 0.07) {
        const land = wallTrial(from, ux, uz, sp * speedMul, el, side);
        if (!land) continue;
        const err = Math.hypot(land.x - target.x, land.z - target.z) + Math.abs(sp / 30 - (0.4 + power * 0.5)) * 1.5;
        if (!best || err < best.err) best = { err, ux, uz, sp: sp * speedMul, el, land };
      }
    }
    if (!best) break;
    // seconde passe : on corrige la direction latérale selon l'erreur d'atterrissage
    tx += (target.x - best.land.x) * 0.8;
  }
  if (!best) {
    // impossible depuis cette position : renvoi haut vers la vitre, à l'aveugle
    return { v: new THREE.Vector3(0, 9, side * 14), w: new THREE.Vector3(), speed: 16, ok: false };
  }
  const c = Math.cos(best.el);
  return {
    v: new THREE.Vector3(best.ux * c * best.sp, Math.sin(best.el) * best.sp, best.uz * c * best.sp),
    w: new THREE.Vector3(), speed: best.sp, ok: true, land: best.land,
  };
}
