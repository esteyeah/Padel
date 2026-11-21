// Tests rapides (Node) de la physique et du solveur de frappe.
import * as THREE from 'three';
import { BallState, stepBall, simulate } from '../src/physics/BallPhysics.js';
import { planShot } from '../src/physics/ShotSolver.js';
import { FIXED_DT } from '../src/config.js';

let fails = 0;
const check = (name, cond, info = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${info}`); if (!cond) fails++; };

// 1. Rebond d'une balle lâchée de 2.54 m (norme : remonte entre 1.35 et 1.45 m)
{
  const s = new BallState(); s.reset(new THREE.Vector3(0, 2.54, 3));
  let bounced = false, apex = 0;
  for (let i = 0; i < 240 * 3; i++) {
    stepBall(s, FIXED_DT, (e) => { if (e.type === 'floor') bounced = true; }, () => 0.5);
    if (bounced && s.v.y > -1e-3) apex = Math.max(apex, s.p.y);
    if (bounced && s.v.y < 0 && apex > 0) break;
  }
  check('Rebond sol réglementaire', apex > 1.3 && apex < 1.5, `apex=${apex.toFixed(2)} m`);
}

// 2. Le solveur atteint la cible pour chaque type de coup
const cases = [
  ['drive', new THREE.Vector3(1, 0.9, 8), { x: -2, z: -7 }, 0.6],
  ['drive', new THREE.Vector3(0, 0.35, 9.5), { x: 2, z: -8 }, 1.0],
  ['slice', new THREE.Vector3(-2, 1.0, 7), { x: 3, z: -6.5 }, 0.5],
  ['drop', new THREE.Vector3(0, 1.0, 4), { x: -1, z: -2 }, 0.5],
  ['lob', new THREE.Vector3(0, 0.8, -3), { x: 1, z: 8.5 }, 0.5],
  ['smash', new THREE.Vector3(0.5, 2.8, 3), { x: -2, z: -7.5 }, 1.0],
  ['bandeja', new THREE.Vector3(0.5, 2.4, 6), { x: 2, z: -8 }, 0.4],
  ['volley', new THREE.Vector3(0.5, 1.1, 2.5), { x: 3, z: -6 }, 0.6],
  ['serve', new THREE.Vector3(2.6, 0.66, 8.6), { x: -2.5, z: -4.7 }, 0.6],
];
for (const [type, from, target, power] of cases) {
  const t0 = performance.now();
  const plan = planShot(from, target, type, power);
  const ms = performance.now() - t0;
  const s = new BallState(); s.reset(from); s.v.copy(plan.v); s.w.copy(plan.w);
  let land = null, net = false, crossed = false;
  simulate(s, 6, FIXED_DT, (st, t, evs) => {
    for (const e of evs) {
      if (e.type === 'net') net = true;
      if (e.type === 'cross') crossed = true;
      if (e.type === 'floor' && !land) { land = e; return false; }
    }
  });
  const err = land ? Math.hypot(land.x - target.x, land.z - target.z) : 99;
  check(`Solveur ${type.padEnd(7)}`, !net && crossed && err < 0.35,
    `v=${(plan.speed * 3.6).toFixed(0)} km/h θ=${(plan.theta * 57.3).toFixed(1)}° err=${err.toFixed(2)} m apex=${plan.apex.toFixed(1)} (${ms.toFixed(1)} ms)`);
}

// 3. Vitre : la balle de fond revient en jeu
{
  const s = new BallState(); s.reset(new THREE.Vector3(0, 1.2, 0.5));
  const plan = planShot(s.p, { x: 0, z: -8.5 }, 'drive', 0.8);
  s.v.copy(plan.v); s.w.copy(plan.w);
  const evs = [];
  simulate(s, 3, FIXED_DT, (st, t, e) => { for (const x of e) evs.push(x.type); });
  const seq = evs.filter((t) => t !== 'cross').slice(0, 3).join(' > ');
  check('Séquence sol > vitre', seq.startsWith('floor > glass'), seq);
}
// 4. Balle dans le filet
{
  const s = new BallState(); s.reset(new THREE.Vector3(0, 0.4, 3)); s.v.set(0, 0.5, -15);
  let net = false; simulate(s, 2, FIXED_DT, (st, t, e) => { if (e.some((x) => x.type === 'net')) net = true; });
  check('Filet arrête la balle', net);
}
process.exit(fails ? 1 : 0);
