// ============================================================================
//  Ambiance : des joueurs disputent des échanges sur les courts voisins.
//  Purement visuel (aucune physique) : la balle suit des arcs avec un rebond,
//  les joueurs se déplacent vers la balle et frappent avec l'animation de
//  l'Avatar. De temps en temps le point s'arrête, puis un nouveau service.
// ============================================================================
import * as THREE from 'three';
import { Avatar } from '../entities/Avatar.js';
import { makeAppearance, rng } from '../entities/Appearance.js';

const KITS = ['blue', 'red', 'green', 'black', 'white', 'orange'];

export class AmbientMatch {
  /**
   * @param {THREE.Object3D} parent
   * @param {object} o { x, z : centre du court ; seed ; doubles ; shadows }
   */
  constructor(parent, { x, z, seed = 1, doubles = true, shadows = false }) {
    this.r = rng(seed);
    const r = this.r;
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    parent.add(this.group);
    const kitA = KITS[Math.floor(r() * KITS.length)];
    let kitB = KITS[Math.floor(r() * KITS.length)];
    if (kitB === kitA) kitB = KITS[(KITS.indexOf(kitA) + 2) % KITS.length];
    this.players = [];
    const lanes = doubles ? [-1, 1] : [0];
    for (const side of [1, -1]) {
      for (const lane of lanes) {
        const app = makeAppearance(side > 0 ? kitA : kitB, Math.floor(r() * 1e9));
        const av = new Avatar(app);
        if (!shadows) av.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
        const home = { x: lane * side * 2.4, z: side * (doubles && r() < 0.5 ? 4 : 8) };
        av.root.position.set(home.x, 0, home.z);
        this.group.add(av.root);
        this.players.push({ av, side, home, pos: new THREE.Vector3(home.x, 0, home.z), target: new THREE.Vector3(home.x, 0, home.z), swing: null, speed: 0 });
      }
    }
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe4ff2e, emissive: 0x4a5c00, emissiveIntensity: 0.4 }));
    this.group.add(this.ball);
    this.hitter = this.players[0];
    this.pause = 1 + r() * 2;
    this.shots = 0;
    this.flight = null;
  }

  /** Lance la balle du frappeur vers un joueur du camp adverse. */
  shoot() {
    const r = this.r;
    const opp = this.players.filter((p) => p.side !== this.hitter.side);
    const recv = opp[Math.floor(r() * opp.length)];
    const from = new THREE.Vector3(this.hitter.pos.x + 0.5 * this.hitter.side, 1.0, this.hitter.pos.z);
    // le receveur ira à la balle : point de contact près de sa position de base
    const contact = new THREE.Vector3(recv.home.x + (r() - 0.5) * 3, 0.9 + r() * 0.4, recv.home.z + (r() - 0.5) * 2);
    contact.x = Math.max(-4.5, Math.min(4.5, contact.x));
    const bounce = new THREE.Vector3().lerpVectors(from, contact, 0.68); bounce.y = 0.05;
    const lob = r() < 0.18;
    this.flight = { from, bounce, to: contact, t: 0, d1: lob ? 1.7 : 0.8 + r() * 0.35, d2: 0.35 + r() * 0.15, h1: lob ? 5 : 1.4 + r() * 0.8, recv };
    recv.target.set(contact.x - 0.6 * recv.side, 0, contact.z + 0.2 * recv.side);
    this.hitter.swing = { kind: 'fore', style: lob ? 'lob' : 'drive', t: 0, dur: 0.34, contactRz: 0.45, contactH: 1 };
    this.shots++;
  }

  update(dt) {
    const f = this.flight;
    if (this.pause > 0) {
      this.pause -= dt;
      this.ball.visible = false;
      if (this.pause <= 0) {
        // service : un joueur au fond, au hasard
        this.hitter = this.players[Math.floor(this.r() * this.players.length)];
        this.ball.visible = true;
        this.shoot();
      }
    } else if (f) {
      f.t += dt;
      const p = this.ball.position;
      if (f.t < f.d1) {
        const k = f.t / f.d1;
        p.lerpVectors(f.from, f.bounce, k);
        p.y = THREE.MathUtils.lerp(f.from.y, f.bounce.y, k) + 4 * f.h1 * k * (1 - k);
      } else if (f.t < f.d1 + f.d2) {
        const k = (f.t - f.d1) / f.d2;
        p.lerpVectors(f.bounce, f.to, k);
        p.y = THREE.MathUtils.lerp(f.bounce.y, f.to.y, k) + 4 * 0.5 * k * (1 - k);
      } else {
        // arrivée : frappe, ou fin du point (faute) de temps en temps
        this.hitter = f.recv;
        if (this.r() < 0.1 + this.shots * 0.012) {
          this.flight = null;
          this.pause = 2 + this.r() * 2.5;
          this.shots = 0;
          for (const pl of this.players) pl.target.set(pl.home.x, 0, pl.home.z);
        } else this.shoot();
      }
    }
    // déplacements et animations
    for (const pl of this.players) {
      const dx = pl.target.x - pl.pos.x, dz = pl.target.z - pl.pos.z, d = Math.hypot(dx, dz);
      const v = Math.min(d / 0.25, 4.2);
      if (d > 0.02) { pl.pos.x += (dx / d) * v * dt; pl.pos.z += (dz / d) * v * dt; }
      pl.speed += (v * (d > 0.05 ? 1 : 0) - pl.speed) * Math.min(1, dt * 8);
      pl.av.root.position.set(pl.pos.x, 0, pl.pos.z);
      if (pl.swing) { pl.swing.t += dt; if (pl.swing.t > pl.swing.dur) pl.swing = null; }
      const yaw = pl.side > 0 ? Math.PI : 0;
      pl.av.animate(dt, { speed: pl.speed, fwd: 0, side: pl.speed, yaw, look: 0, ready: !!this.flight, armed: null, swing: pl.swing });
    }
  }
}
