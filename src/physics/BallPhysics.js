// ============================================================================
//  Physique de la balle (pure, sans rendu) : gravité, traînée, effet Magnus,
//  rebonds sol / vitre / grillage avec transfert de rotation, filet.
//  Utilisée à la fois par la balle "live" et par le prédicteur (IA, marqueurs).
// ============================================================================
import * as THREE from 'three';
import {
  BALL, PHYS, SURFACES, COURT, netHeightAt, backWallSurface, sideWallSurface,
} from '../config.js';

const R = BALL.radius;
const _acc = new THREE.Vector3();
const _mag = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _vt = new THREE.Vector3();
const _u = new THREE.Vector3();
const _rc = new THREE.Vector3();
const _dvt = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _n = new THREE.Vector3();

export class BallState {
  constructor() {
    this.p = new THREE.Vector3(0, 1, 0); // position (m)
    this.v = new THREE.Vector3();        // vitesse (m/s)
    this.w = new THREE.Vector3();        // vitesse angulaire (rad/s)
    this.rolling = false;
    this.escaped = false;                // sortie de l'enceinte
    this.stopped = false;
    this.boost = 0;                      // bonus de restitution sur vitre (force du frappeur)
  }
  copy(o) {
    this.p.copy(o.p); this.v.copy(o.v); this.w.copy(o.w);
    this.rolling = o.rolling; this.escaped = o.escaped; this.stopped = o.stopped; this.boost = o.boost;
    return this;
  }
  clone() { return new BallState().copy(this); }
  reset(p) {
    this.p.copy(p); this.v.set(0, 0, 0); this.w.set(0, 0, 0);
    this.rolling = false; this.escaped = false; this.stopped = false; this.boost = 0;
  }
}

export const sideOf = (z) => (z >= 0 ? 1 : -1);
const inCourt = (p) => Math.abs(p.x) <= COURT.halfW && Math.abs(p.z) <= COURT.halfL;
const noRand = () => 0.5;

/**
 * Rebond sur une surface de normale n (unitaire), modèle impulsionnel :
 *  - restitution normale dépendant de la vitesse d'impact (compression),
 *  - frottement de Coulomb sur le point de contact (sphère creuse, I = 2/3 m r²)
 *    qui couple vitesse tangentielle et rotation (lift qui "accélère", coupé qui "glisse").
 */
function bounce(s, n, mat, rand) {
  const v = s.v, w = s.w;
  const vn = v.dot(n);
  if (vn >= 0) return 0;
  const impact = -vn;
  const isGlass = mat === SURFACES.glass;
  let e = Math.max(mat.eMin, mat.e - mat.eLoss * impact + (isGlass ? s.boost : 0));
  // vitre : une balle lente s'écrase et meurt (la vitre absorbe), seule une balle rapide repart bien
  if (isGlass) { const k = Math.min(1, Math.max(0, (impact - 3) / 9)); e = Math.min(e, 0.4 + 0.35 * k * k * (3 - 2 * k) + s.boost); }
  const vyIn = v.y;

  _vt.copy(v).addScaledVector(n, -vn);      // vitesse tangentielle
  _rc.copy(n).multiplyScalar(-R);            // centre -> point de contact
  _u.crossVectors(w, _rc).add(_vt);          // vitesse du point de contact
  const jn = (1 + e) * impact;               // impulsion normale (par unité de masse)
  const uLen = _u.length();
  if (uLen > 1e-6) {
    // 0.4 = 1 / (1 + m r² / I) : fraction qui annule le glissement (roulement)
    const mag = Math.min(mat.mu * jn, 0.4 * uLen);
    _dvt.copy(_u).multiplyScalar(-mag / uLen);
    v.add(_dvt);
    _tmp.crossVectors(_rc, _dvt).multiplyScalar(1.5 / (R * R));
    w.add(_tmp);
  }
  v.addScaledVector(n, jn);
  if (isGlass && Math.abs(n.y) < 0.5) {
    // le frottement sur la vitre ne doit pas faire « grimper » la balle : la vitesse verticale
    // ne peut pas dépasser celle d'arrivée, et une balle lente perd aussi en glisse
    const cap = Math.max(vyIn, 0) * 0.92 + 0.15;
    if (v.y > cap) v.y = cap;
    if (impact < 9) { const damp = 0.8 + 0.2 * (impact / 9); v.x *= n.x ? 1 : damp; v.z *= n.z ? 1 : damp; if (v.y > 0) v.y *= damp; }
  }

  if (mat.rand > 0) {
    const k = mat.rand * v.length();
    v.x += (rand() - 0.5) * k;
    v.y += (rand() - 0.5) * k * 0.6;
    v.z += (rand() - 0.5) * k;
    const minOut = 0.2 * impact * e;
    const vn2 = v.dot(n);
    if (vn2 < minOut) v.addScaledVector(n, minOut - vn2);
  }
  return impact;
}

function checkNet(s, emit, rand) {
  const p = s.p, pz = _prev.z;
  if (pz === 0 || (pz > 0) === (p.z > 0)) return;
  const t = pz / (pz - p.z);
  const x = _prev.x + (p.x - _prev.x) * t;
  const y = _prev.y + (p.y - _prev.y) * t;
  const from = pz > 0 ? 1 : -1;
  // à l'extérieur des murs (balle renvoyée de dehors) : pas de filet, mais le passage compte
  if (Math.abs(x) > COURT.halfW + 0.05) { emit && emit({ type: 'cross', to: -from, x, y, outside: true }); return; }
  const h = netHeightAt(x);

  if (y - R >= h) {
    emit && emit({ type: 'cross', to: -from, x, y });
    return;
  }
  const speed = s.v.length();
  if (y >= h - 0.045) {
    // Bande du filet : la balle "saute" et passe (ou pas)
    const pass = rand() > 0.35;
    s.v.x *= 0.65;
    s.v.z *= pass ? 0.35 + rand() * 0.25 : -(0.15 + rand() * 0.15);
    s.v.y = Math.abs(s.v.y) * 0.3 + 0.5 + rand() * 1.0;
    s.w.multiplyScalar(0.3);
    s.p.set(x, h + R + 0.002, (pass ? -from : from) * 0.012);
    emit && emit({ type: 'netcord', side: from, x, y, speed });
    if (pass) emit && emit({ type: 'cross', to: -from, x, y });
  } else {
    // Dans le filet : la balle meurt
    s.p.set(x, Math.max(R, y), from * (R + 0.012));
    s.v.set(s.v.x * 0.25, Math.min(s.v.y, 0) * 0.3, -s.v.z * 0.06);
    s.w.multiplyScalar(0.1);
    emit && emit({ type: 'net', side: from, x, y, speed });
  }
}

function collideWalls(s, emit, rand) {
  const p = s.p;
  if (s.escaped) {
    // balle renvoyée depuis l'extérieur : les murs redeviennent actifs quand elle rentre
    if (Math.abs(p.x) < COURT.halfW - R && Math.abs(p.z) < COURT.halfL - R) s.escaped = false;
    return;
  }
  const hw = COURT.halfW, hl = COURT.halfL;

  for (let sx = -1; sx <= 1; sx += 2) {
    if (p.x * sx + R > hw) {
      const surf = sideWallSurface(Math.abs(p.z), p.y, p.z, sx);
      if (surf === 'open' || surf === 'door') {
        if (p.x * sx > hw + R) {
          s.escaped = true;
          emit && emit({ type: 'out', via: surf === 'door' ? 'door' : 'over', wall: 'side', x: p.x, y: p.y, z: p.z, side: sideOf(p.z) });
          return;
        }
      } else {
        _n.set(-sx, 0, 0);
        p.x = sx * (hw - R);
        const impact = bounce(s, _n, SURFACES[surf], rand);
        if (impact > 0.05 && emit) {
          emit({ type: surf, wall: 'side', x: p.x, y: p.y, z: p.z, side: sideOf(p.z), speed: impact, nx: -sx, ny: 0, nz: 0 });
        }
      }
    }
  }
  for (let sz = -1; sz <= 1; sz += 2) {
    if (p.z * sz + R > hl) {
      const surf = backWallSurface(p.y);
      if (surf === 'open') {
        if (p.z * sz > hl + R) {
          s.escaped = true;
          emit && emit({ type: 'out', via: 'over', wall: 'back', x: p.x, y: p.y, z: p.z, side: sz });
          return;
        }
      } else {
        _n.set(0, 0, -sz);
        p.z = sz * (hl - R);
        const impact = bounce(s, _n, SURFACES[surf], rand);
        if (impact > 0.05 && emit) {
          emit({ type: surf, wall: 'back', x: p.x, y: p.y, z: p.z, side: sz, speed: impact, nx: 0, ny: 0, nz: -sz });
        }
      }
    }
  }
}

/**
 * Avance l'état de la balle d'un pas dt. Les évènements (rebonds, filet,
 * franchissement, sortie) sont transmis à `emit`.
 */
export function stepBall(s, dt, emit = null, rand = Math.random) {
  if (s.stopped) return;
  const p = s.p, v = s.v, w = s.w;
  _prev.copy(p);

  if (s.rolling) {
    const sp = Math.hypot(v.x, v.z);
    const dec = PHYS.rollDecel * dt;
    if (sp <= dec) {
      v.set(0, 0, 0);
      s.stopped = true;
      emit && emit({ type: 'stopped', x: p.x, y: p.y, z: p.z, side: sideOf(p.z) });
      return;
    }
    v.x -= (v.x / sp) * dec;
    v.z -= (v.z / sp) * dec;
    v.y = 0;
    p.addScaledVector(v, dt);
    p.y = R;
    w.set(v.z / R, 0, -v.x / R); // roulement sans glissement
  } else {
    const speed = v.length();
    _acc.set(0, -PHYS.gravity, 0).addScaledVector(v, -PHYS.drag * speed);
    _mag.crossVectors(w, v).multiplyScalar(PHYS.magnus);
    _acc.add(_mag);
    v.addScaledVector(_acc, dt); // Euler semi-implicite
    p.addScaledVector(v, dt);
    w.multiplyScalar(Math.exp(-PHYS.spinDecay * dt));

    if (p.y < R) {
      p.y = R;
      if (v.y < 0) {
        const impact = -v.y;
        if (impact < PHYS.rollThreshold) {
          v.y = 0;
          s.rolling = true;
          emit && emit({ type: 'floor', x: p.x, y: p.y, z: p.z, side: sideOf(p.z), speed: impact, inCourt: inCourt(p), roll: true, nx: 0, ny: 1, nz: 0 });
        } else {
          _n.set(0, 1, 0);
          bounce(s, _n, SURFACES.floor, rand);
          emit && emit({ type: 'floor', x: p.x, y: p.y, z: p.z, side: sideOf(p.z), speed: impact, inCourt: inCourt(p), nx: 0, ny: 1, nz: 0 });
        }
      }
    }
  }

  checkNet(s, emit, rand);
  collideWalls(s, emit, rand);
  if (Math.abs(p.x) > 40 || Math.abs(p.z) > 50) s.stopped = true;
}

/**
 * Simule une copie de l'état sans aléa. `visit(state, t, events)` est appelé à
 * chaque pas ; retourner false arrête la simulation.
 */
export function simulate(state, duration, dt, visit) {
  const s = state.clone();
  const events = [];
  const emit = (e) => events.push(e);
  let t = 0;
  while (t < duration && !s.stopped) {
    events.length = 0;
    stepBall(s, dt, emit, noRand);
    t += dt;
    if (visit(s, t, events) === false) break;
  }
  return s;
}
