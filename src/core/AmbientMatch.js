// ============================================================================
//  Match d'ambiance sur un court voisin (promenade de l'aventure) :
//  quatre joueurs qui échangent pour de vrai à l'œil — la balle vole en
//  cloche d'un camp à l'autre, le joueur le plus proche se déplace et frappe.
//  Pas de physique complète : juste ce qu'il faut pour que ce soit crédible.
// ============================================================================
import * as THREE from 'three';
import { Avatar } from '../entities/Avatar.js';

const rnd = (a, b) => a + Math.random() * (b - a);

export class AmbientMatch {
  /**
   * @param scene   scène three
   * @param court   { x, z, rot } centre du court (monde), rot = court tourné d'un quart de tour
   * @param looks   4 apparences (deux par camp)
   */
  constructor(scene, court, looks, meta = {}) {
    this.scene = scene; this.court = court; this.meta = meta;
    this.players = looks.slice(0, 4).map((ap, i) => {
      const av = new Avatar({ ...ap });
      const side = i < 2 ? 1 : -1, lane = i % 2 ? -1 : 1;
      const home = { x: lane * 2.4, z: side * 8 };
      av.root.position.copy(this.toWorld(home.x, home.z));
      scene.add(av.root);
      return { av, side, lane, pos: { ...home }, home, target: { ...home }, swing: null, vel: { x: 0, z: 0 } };
    });
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xd8f020, roughness: 0.5, emissive: 0x303800 });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.033, 10, 8), ballMat);
    this.ball.castShadow = true;
    scene.add(this.ball);
    this.flight = null;
    this.pause = rnd(0.5, 1.5);
    this.hitter = this.players[0];
  }

  /** Coordonnées du court -> monde. */
  toWorld(x, z, y = 0) {
    const c = this.court;
    return c.rot ? new THREE.Vector3(c.x + z, y, c.z - x) : new THREE.Vector3(c.x + x, y, c.z + z);
  }
  yawOf(side) { return (this.court.rot ? Math.PI / 2 : 0) + (side > 0 ? Math.PI : 0); }

  /** Nouvelle frappe vers l'autre camp. */
  shoot(from) {
    const to = -from.side;
    const lob = Math.random() < 0.25;
    const end = { x: rnd(-4, 4), z: to * rnd(lob ? 7 : 4.5, 8.5) };
    const start = { x: from.pos.x + 0.4 * from.lane, z: from.pos.z };
    this.flight = { start, end, t: 0, dur: lob ? rnd(1.6, 2.0) : rnd(0.9, 1.25), h: lob ? rnd(4.5, 6) : rnd(1.6, 2.6), y0: lob ? 0.9 : rnd(0.7, 1.3) };
    // le receveur : le joueur de l'autre camp le plus proche de la cible
    const opp = this.players.filter((p) => p.side === to);
    this.receiver = opp.reduce((a, b) => (Math.hypot(b.home.x - end.x, b.home.z - end.z) < Math.hypot(a.home.x - end.x, a.home.z - end.z) ? b : a));
    this.receiver.target = { x: end.x + 0.45 * this.receiver.lane * (this.receiver.side > 0 ? 1 : -1), z: end.z + to * 0.9 };
    for (const p of opp) if (p !== this.receiver) p.target = { x: p.lane * 2.2 * 0.7 + end.x * 0.25, z: p.home.z };
    for (const p of this.players) if (p.side !== to) p.target = { x: p.home.x * 0.8 + start.x * 0.2, z: p.side * (Math.random() < 0.3 ? 3.5 : 7.5) };
    // une erreur de temps en temps : le point s'arrête
    this.flight.miss = Math.random() < 0.12;
  }

  update(dt) {
    if (this.pause > 0) {
      this.pause -= dt;
      this.ball.visible = this.pause < 0.6;
      if (this.pause <= 0) { this.hitter = this.players[Math.floor(Math.random() * 4)]; this.swingOf(this.hitter, 'over'); this.shoot(this.hitter); }
    }
    const F = this.flight;
    if (F) {
      F.t += dt;
      const u = Math.min(1.25, F.t / F.dur);
      const x = F.start.x + (F.end.x - F.start.x) * u, z = F.start.z + (F.end.z - F.start.z) * u;
      // cloche puis rebond au sol, et la balle remonte vers le receveur
      const y = u <= 1 ? F.y0 * (1 - u) + 4 * F.h * u * (1 - u) * 0.5 + 0.04 : 0.04 + Math.sin((u - 1) / 0.25 * Math.PI) * 0.9;
      this.ball.position.copy(this.toWorld(x, z, y));
      if (u >= 1.2) {
        this.flight = null;
        if (F.miss) { this.pause = rnd(2.5, 4); for (const p of this.players) p.target = { ...p.home }; }
        else { this.swingOf(this.receiver, Math.random() < 0.15 ? 'over' : null); this.shoot(this.receiver); }
      }
    }
    for (const p of this.players) {
      const dx = p.target.x - p.pos.x, dz = p.target.z - p.pos.z, d = Math.hypot(dx, dz);
      const sp = Math.min(4.2, d * 3);
      const vx = d > 0.05 ? (dx / d) * sp : 0, vz = d > 0.05 ? (dz / d) * sp : 0;
      p.vel.x += (vx - p.vel.x) * Math.min(1, dt * 8); p.vel.z += (vz - p.vel.z) * Math.min(1, dt * 8);
      p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt;
      p.pos.z = p.side * Math.max(1.2, Math.min(9.6, Math.abs(p.pos.z)));
      p.av.root.position.copy(this.toWorld(p.pos.x, p.pos.z));
      if (p.swing) { p.swing.t += dt; if (p.swing.t >= p.swing.dur) p.swing = null; }
      const yaw = this.yawOf(p.side);
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const w = this.toWorld(p.vel.x, p.vel.z).sub(this.toWorld(0, 0));
      const speed = Math.hypot(p.vel.x, p.vel.z);
      p.av.animate(dt, { speed, fwd: w.x * s + w.z * c, side: w.x * c - w.z * s, yaw, look: 0, ready: true, armed: null, swing: p.swing });
    }
  }

  swingOf(p, kind) {
    const bp = this.ball.position.clone();
    p.swing = { kind: kind || (Math.random() < 0.5 ? 'fore' : 'back'), style: 'drive', t: 0, dur: 0.34, contactH: kind === 'over' ? 2.1 : 1.0, contactPos: bp.y > 0.2 ? bp : null, jump: 0 };
  }

  /** Le point (monde) est-il sur ce court ? marge > 0 : autour du court. */
  contains(x, z, margin = 0) {
    const c = this.court, dx = x - c.x, dz = z - c.z;
    const hx = (c.rot ? 10 : 5) + margin, hz = (c.rot ? 5 : 10) + margin;
    return Math.abs(dx) < hx && Math.abs(dz) < hz;
  }

  dispose() {
    for (const p of this.players) this.scene.remove(p.av.root);
    this.scene.remove(this.ball);
  }
}
