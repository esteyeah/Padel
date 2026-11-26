// ============================================================================
//  Pétanque (aventure, terrain de Ceyreste) : un vrai mini-jeu.
//   - 3 boules chacun, cochonnet lancé au début de chaque mène ;
//   - on vise (stick / flèches), on charge la force en maintenant A, on relâche :
//       A = pointer (balle en cloche qui roule), B = tirer (rasant, fait sauter les boules) ;
//   - celle qui n'a pas le point rejoue ; points à la fin de la mène ; partie en 5 points.
//  Physique simple au sol : roulement freiné par le sable, chocs entre boules.
// ============================================================================
import * as THREE from 'three';

const R_BOULE = 0.045, R_COCH = 0.018;
const rnd = (a, b) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 0.8;

export class Petanque {
  /**
   * @param g       Game
   * @param area    { x, z, w, l } terrain (monde), long côté selon z
   * @param me      Player (le joueur)
   * @param opp     acteur adversaire { avatar, pos, label }
   * @param skill   0..1 adresse de l'adversaire ; style : 'pointeur' | 'tireur'
   */
  constructor(g, area, me, opp, { skill = 0.6, style = 'pointeur', target = 5, onEnd } = {}) {
    Object.assign(this, { g, area, me, opp, skill, style, target, onEnd });
    this.group = new THREE.Group(); this.group.position.y = area.y || 0; g.scene.add(this.group);
    this.matMe = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.95, roughness: 0.22 });
    this.matOpp = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, metalness: 0.85, roughness: 0.35 });
    this.matCoch = new THREE.MeshStandardMaterial({ color: 0xf0c020, roughness: 0.5 });
    this.score = [0, 0];          // [moi, adversaire]
    this.circle = { x: area.x, z: area.z + area.l / 2 - 1.0 };
    this.dir = -1;               // on lance vers -z
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.012, 6, 24), new THREE.MeshStandardMaterial({ color: 0xff3d00, roughness: 0.6 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(this.circle.x, 0.03, this.circle.z); this.group.add(ring);
    this.first = 0;               // qui commence la mène (0 = moi)
    this.newMene();
  }

  // ------------------------------------------------------------------ mène
  newMene() {
    for (const b of this.balls || []) this.group.remove(b.mesh);
    this.balls = [];
    this.left = [3, 3];
    this.aim = 0; this.power = 0; this.charging = null;
    // le cochonnet est lancé entre 5 et 8 m
    const d = rnd(5, 7.5);
    this.coch = this.addBall(-1, this.circle.x + rnd(-0.8, 0.8), this.circle.z + this.dir * d, R_COCH, this.matCoch);
    this.turn = this.first;
    this.phase = 'aim';           // aim | flight | roll | count | over
    this.wait = 0.6;
    this.msg(`Mène · ${this.score[0]} - ${this.score[1]}`);
  }

  addBall(owner, x, z, r = R_BOULE, mat = null) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mat || (owner === 0 ? this.matMe : this.matOpp));
    mesh.castShadow = true; mesh.position.set(x, r, z); this.group.add(mesh);
    const b = { owner, r, mesh, p: new THREE.Vector2(x, z), v: new THREE.Vector2(), y: r, dead: false };
    if (owner >= 0) this.balls.push(b);
    return b;
  }

  msg(t) { this.g.hud.shotInfo?.(t, 1); }

  dist(b) { return Math.hypot(b.p.x - this.coch.p.x, b.p.y - this.coch.p.y); }
  /** Qui a le point : 0, 1, ou -1 si personne n'a encore joué. */
  holder() {
    const live = this.balls.filter((b) => !b.dead);
    if (!live.length) return -1;
    return live.reduce((a, b) => (this.dist(b) < this.dist(a) ? b : a)).owner;
  }

  // ------------------------------------------------------------------ lancer
  throwBall(owner, aimX, power, tir) {
    const dist = 1.5 + power * 8.5;
    const land = tir ? dist * 0.82 : dist * 0.72;          // pointer : la boule roule ensuite ~28 %
    const tx = this.circle.x + Math.sin(aimX) * land, tz = this.circle.z + this.dir * Math.cos(aimX) * land;
    const b = this.addBall(owner, this.circle.x, this.circle.z);
    b.mesh.position.y = 0.6;
    this.flying = { b, from: new THREE.Vector3(this.circle.x, 0.7, this.circle.z), to: new THREE.Vector3(tx, b.r, tz), t: 0, dur: tir ? 0.55 : 0.95, h: tir ? 0.5 : 2.4, roll: (tir ? dist * 0.18 : dist * 0.28), dir: new THREE.Vector2(Math.sin(aimX), this.dir * Math.cos(aimX)), tir };
    this.left[owner]--;
    this.phase = 'flight';
    // geste de lancer (par en dessous)
    const av = owner === 0 ? this.me.avatar : this.opp.avatar;
    this.throwAnim = { av, t: 0 };
    this.g.sfx?.hit?.(4, { type: 'lob' });
  }

  aiThrow() {
    const h = this.holder();
    const best = this.balls.filter((b) => !b.dead && b.owner === 0).sort((a, b) => this.dist(a) - this.dist(b))[0];
    // le tireur tire sur la boule adverse bien placée, sinon on pointe
    const tir = best && h === 0 && this.dist(best) < 0.5 && Math.random() < (this.style === 'tireur' ? 0.7 : 0.25);
    const tgt = tir ? best.p : this.coch.p;
    const dx = tgt.x - this.circle.x, dz = (tgt.y - this.circle.z) * this.dir;
    const d = Math.hypot(dx, dz);
    const aim = Math.atan2(dx, dz) + gauss() * 0.05 * (1.3 - this.skill);
    // force nécessaire pour atteindre la cible (inverse de throwBall), avec l'erreur du joueur
    const need = d;                                   // vol + roulement = distance visée
    const power = Math.max(0, Math.min(1, (need - 1.5) / 8.5 + gauss() * 0.06 * (1.3 - this.skill)));
    this.throwBall(1, aim, power, tir);
  }

  // ------------------------------------------------------------------ boucle
  update(dt, inp) {
    const g = this.g;
    if (this.wait > 0) { this.wait -= dt; this.camera(dt); return; }
    if (this.phase === 'aim') {
      if (this.left[0] + this.left[1] === 0) { this.countMene(); return; }
      // qui joue : celui qui n'a pas le point (s'il lui reste des boules)
      const h = this.holder();
      let who = h < 0 ? this.turn : 1 - h;
      if (this.left[who] === 0) who = 1 - who;
      this.who = who;
      this.pose(who);
      if (who === 1) { this.oppT = (this.oppT || 0) + dt; if (this.oppT > 1.3) { this.oppT = 0; this.aiThrow(); } this.camera(dt); return; }
      // visée
      this.aim = Math.max(-0.5, Math.min(0.5, this.aim + ((inp.move.x || 0) + (inp.aim.x || 0)) * dt * 0.6));
      const btn = inp.held.A ? 'A' : inp.held.B ? 'B' : null;
      if (btn && !this.charging) { this.charging = btn; this.power = 0; this.chargeT = 0; }
      if (this.charging) {
        this.chargeT += dt;
        this.power = Math.min(1, this.chargeT / 1.6);
        g.hud.setPower(this.power, this.charging === 'A' ? 'POINTER' : 'TIRER');
        if (!inp.held[this.charging]) { const tir = this.charging === 'B'; this.charging = null; g.hud.setPower(null); this.throwBall(0, this.aim, this.power, tir); }
      }
      g.hud.hint(`Pétanque ${this.score[0]} - ${this.score[1]} · boules : toi ${this.left[0]}, ${this.opp.label} ${this.left[1]} · visée ← → · maintenir A pointer / B tirer`);
      this.showAim(true);
    } else this.showAim(false);
    if (this.phase === 'flight') {
      const F = this.flying; F.t += dt;
      const u = Math.min(1, F.t / F.dur);
      const p = F.from.clone().lerp(F.to, u); p.y += 4 * F.h * u * (1 - u) * (1 - u * 0.3);
      F.b.mesh.position.copy(p);
      if (u >= 1) {
        F.b.p.set(F.to.x, F.to.z);
        const sp = Math.sqrt(2 * 2.4 * F.roll);              // vitesse pour rouler « roll » mètres
        F.b.v.copy(F.dir).multiplyScalar(sp);
        this.phase = 'roll';
        this.g.sfx?.floor?.(3);
      }
    }
    if (this.phase === 'roll') {
      let moving = false;
      const all = [...this.balls, this.coch];
      for (let k = 0; k < 4; k++) this.physics(dt / 4, all);
      for (const b of all) { if (b.v.lengthSq() > 1e-4) moving = true; b.mesh.position.set(b.p.x, b.r, b.p.y); b.mesh.rotation.x += b.v.y * dt / b.r; b.mesh.rotation.z -= b.v.x * dt / b.r; }
      if (!moving) {
        this.phase = 'aim'; this.wait = 0.5;
        if (this.coch.dead) { this.msg('Cochonnet sorti : mène annulée'); this.wait = 1.6; this.newMene(); return; }
        const h = this.holder();
        if (h >= 0) this.msg(h === 0 ? 'Tu as le point' : `${this.opp.label} a le point`);
      }
    }
    if (this.throwAnim) {
      const T = this.throwAnim; T.t += dt;
      if (T.t > 0.5) this.throwAnim = null;
    }
    this.camera(dt);
  }

  physics(dt, all) {
    const A = this.area;
    for (const b of all) {
      if (b.dead) continue;
      const s = b.v.length();
      if (s > 0) { const ns = Math.max(0, s - (b === this.coch ? 3.2 : 2.4) * dt); b.v.multiplyScalar(ns / s); }
      b.p.addScaledVector(b.v, dt);
      // bordures en bois : la boule s'arrête contre ; au-delà, elle est « morte »
      if (Math.abs(b.p.x - A.x) > A.w / 2 - b.r) { b.p.x = A.x + Math.sign(b.p.x - A.x) * (A.w / 2 - b.r); b.v.x *= -0.25; }
      if (Math.abs(b.p.y - A.z) > A.l / 2 - b.r) { b.dead = b.owner >= 0 || b === this.coch; b.v.set(0, 0); if (b.dead) b.mesh.visible = b === this.coch; }
    }
    // chocs entre boules (masses égales, le cochonnet est léger)
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      if (a.dead || b.dead) continue;
      const d = b.p.clone().sub(a.p), L = d.length(), min = a.r + b.r;
      if (L >= min || L < 1e-6) continue;
      const n = d.divideScalar(L);
      const ma = a === this.coch ? 0.2 : 1, mb = b === this.coch ? 0.2 : 1;
      const rel = a.v.clone().sub(b.v).dot(n);
      if (rel > 0) {
        const imp = (1.8 * rel) / (1 / ma + 1 / mb);
        a.v.addScaledVector(n, -imp / ma * 0.9); b.v.addScaledVector(n, imp / mb * 0.9);
        if (rel > 1) this.g.sfx?.hit?.(rel * 4, { type: 'drive' });
      }
      const push = (min - L) / 2;
      a.p.addScaledVector(n, -push); b.p.addScaledVector(n, push);
    }
  }

  countMene() {
    const live = this.balls.filter((b) => !b.dead).sort((a, b) => this.dist(a) - this.dist(b));
    if (!live.length) { this.newMene(); return; }
    const w = live[0].owner;
    const firstOther = live.find((b) => b.owner !== w);
    const pts = live.filter((b) => b.owner === w && (!firstOther || this.dist(b) < this.dist(firstOther))).length;
    this.score[w] += pts;
    this.msg(`${w === 0 ? 'Tu marques' : `${this.opp.label} marque`} ${pts} point${pts > 1 ? 's' : ''} · ${this.score[0]} - ${this.score[1]}`);
    this.first = w;
    if (this.score[w] >= this.target) {
      this.phase = 'over';
      this.wait = 2.2;
      setTimeout(() => this.finish(), 2200);
      return;
    }
    this.wait = 2.2;
    setTimeout(() => { if (this.phase !== 'over') this.newMene(); }, 2100);
    this.phase = 'count';
  }

  finish() {
    this.g.hud.hint(''); this.g.hud.setPower(null);
    const won = this.score[0] > this.score[1];
    this.dispose();
    this.onEnd?.(won, [...this.score]);
  }

  /** Positions : le lanceur dans le cercle, l'autre attend à côté. */
  pose(who) {
    const c = this.circle;
    const P = who === 0 ? this.me : this.opp, O = who === 0 ? this.opp : this.me;
    P.pos.x += (c.x - P.pos.x) * 0.2; P.pos.z += (c.z + 0.1 - P.pos.z) * 0.2;
    O.pos.x += (c.x + 1.4 - O.pos.x) * 0.1; O.pos.z += (c.z + 0.9 - O.pos.z) * 0.1;
  }

  showAim(on) {
    if (!this.aimLine) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
      this.aimLine = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.2, gapSize: 0.15, transparent: true, opacity: 0.7 }));
      this.group.add(this.aimLine);
    }
    this.aimLine.visible = on;
    if (!on) return;
    const len = 1.5 + (this.charging ? this.power : 0.5) * 8.5 * 0.85;
    const a = this.aim;
    const pts = [new THREE.Vector3(this.circle.x, 0.03, this.circle.z), new THREE.Vector3(this.circle.x + Math.sin(a) * len, 0.03, this.circle.z + this.dir * Math.cos(a) * len)];
    this.aimLine.geometry.setFromPoints(pts); this.aimLine.computeLineDistances();
  }

  camera(dt) {
    const cam = this.g.cameraRig.camera, c = this.circle;
    let look = new THREE.Vector3(this.coch.p.x, 0, this.coch.p.y);
    if (this.phase === 'flight' && this.flying) look = this.flying.b.mesh.position.clone();
    if (this.phase === 'roll') { const m = this.balls.find((b) => b.v.lengthSq() > 0.01); if (m) look = m.mesh.position.clone(); }
    const want = new THREE.Vector3(c.x + 0.9, 2.3, c.z + 2.6);
    this.camPos = this.camPos || want.clone();
    this.camPos.lerp(want, 1 - Math.exp(-dt * 4));
    this.camLook = this.camLook || look.clone();
    this.camLook.lerp(look, 1 - Math.exp(-dt * 3));
    const Y = this.area.y || 0;
    cam.position.copy(this.camPos); cam.position.y += Y; cam.lookAt(this.camLook.x, 0.2 + Y, this.camLook.z);
  }

  /** Animation des deux joueurs (appelée par la promenade). */
  animate(dt) {
    const T = this.throwAnim;
    for (const P of [this.me, this.opp]) {
      const sw = T && T.av === P.avatar ? { kind: 'fore', style: 'lob', t: T.t * 0.68, dur: 0.34, contactH: 0.55, contactPos: null, jump: 0 } : null;
      P.avatar.root.position.set(P.pos.x, this.area.y || 0, P.pos.z);
      const yaw = P === (this.who === 0 ? this.me : this.opp) ? Math.PI - (P === this.me ? this.aim : 0) : Math.atan2(this.coch.p.x - P.pos.x, this.coch.p.y - P.pos.z);
      P.avatar.animate(dt, { speed: 0, fwd: 0, side: 0, yaw, look: 0, ready: false, armed: null, swing: sw, casual: !sw, pose: !sw && P !== (this.who === 0 ? this.me : this.opp) ? 'hips' : null });
    }
  }

  dispose() { this.g.scene.remove(this.group); }
}
