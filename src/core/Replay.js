// ============================================================================
//  Replay façon télé : on enregistre en continu les dernières secondes (balle,
//  position et pose complète de chaque joueur), puis on rejoue les beaux points
//  au ralenti avec des caméras de retransmission (bord de court, plongée, face).
// ============================================================================
import * as THREE from 'three';

const KEEP = 6;          // secondes gardées en mémoire

function bonesOf(av) {
  if (av._replayBones) return av._replayBones;
  const b = [av.root, av.body, av.pelvis, av.spine, av.chest, av.head, av.lShoulder, av.lElbow, av.rShoulder, av.rElbow, av.racket];
  for (const L of av.legs) b.push(L.hip, L.knee, L.ankle);
  av._replayBones = b;
  return b;
}

export class ReplayRecorder {
  constructor() { this.buf = []; this.t = 0; }

  clear() { this.buf = []; }

  capture(game, dt) {
    this.t += dt;
    const players = game.players.map((p) => {
      const bones = bonesOf(p.avatar);
      return {
        q: bones.map((o) => o.quaternion.toArray()),
        p: [p.avatar.root.position.toArray(), p.avatar.body.position.toArray(), p.avatar.pelvis.position.toArray()],
      };
    });
    const bp = game.ball.state.p;
    this.buf.push({ t: this.t, ball: [bp.x, bp.y, bp.z], vis: game.ball.mesh.visible, players });
    while (this.buf.length && this.buf[0].t < this.t - KEEP) this.buf.shift();
  }

  /** Extrait la séquence à rejouer : de `before` s avant le point à `after` s après. */
  clip(pointT, before = 3.4, after = 0.7) {
    return this.buf.filter((f) => f.t >= pointT - before && f.t <= pointT + after);
  }
}

export class ReplayPlayer {
  constructor(game, frames, hitT = null) {
    this.hitT = hitT ?? frames[Math.floor(frames.length * 0.7)].t;
    this.g = game;
    this.frames = frames;
    this.t = frames[0].t;
    this.end = frames[frames.length - 1].t;
    this.speed = 0.45;
    this.cam = null;
    this.shot = 0;
    this.done = frames.length < 10;
    // qui a fait le dernier coup : la caméra le cadre
    const last = game.lastShot?.player;
    this.focusSide = last?.side ?? 1;
    this.focus = game.players.indexOf(last);
  }

  apply(f) {
    const g = this.g;
    g.ball.state.p.set(...f.ball);
    g.ball.mesh.visible = f.vis;
    g.players.forEach((p, i) => {
      const s = f.players[i];
      if (!s) return;
      bonesOf(p.avatar).forEach((o, k) => o.quaternion.fromArray(s.q[k]));
      p.avatar.root.position.fromArray(s.p[0]);
      p.avatar.body.position.fromArray(s.p[1]);
      p.avatar.pelvis.position.fromArray(s.p[2]);
    });
  }

  frameAt(t) {
    const fr = this.frames;
    let i = 0;
    while (i < fr.length - 1 && fr[i + 1].t < t) i++;
    return fr[i];
  }

  /** Avance la relecture ; renvoie false quand elle est finie. */
  update(dt) {
    if (this.done) return false;
    const t0 = this.frames[0].t, span = this.end - t0;
    const k0 = (this.t - t0) / span;
    // ralenti variable : rapide au début, très lent autour du coup décisif (vers 75 %)
    const slow = Math.exp(-(((this.t - this.hitT) / 0.45) ** 2));
    this.t += dt * (0.7 - 0.5 * slow);
    if (this.t >= this.end) { this.done = true; return false; }
    const f = this.frameAt(this.t);
    this.apply(f);
    const k = (this.t - t0) / span;
    // trois plans : large TV, bord de court qui suit la balle, gros plan sur l'auteur du coup
    // plans : large TV, bord de court, gros plan sur la frappe décisive, puis on suit la balle jusqu'à sa retombée
    const dh = this.t - this.hitT;
    const shot = dh > 0.3 ? 3 : dh > -0.55 ? 2 : k < 0.3 ? 0 : 1;
    const cam = this.g.cameraRig.camera;
    const b = new THREE.Vector3(...f.ball);
    const fp = this.focus >= 0 && f.players[this.focus] ? new THREE.Vector3(...f.players[this.focus].p[0]) : new THREE.Vector3(0, 0, this.focusSide * 6);
    let pos, look;
    if (shot === 0) {
      pos = new THREE.Vector3(b.x * 0.2, 9, -this.focusSide * 19);
      look = new THREE.Vector3(b.x * 0.3, 0.6, b.z * 0.5 + this.focusSide * 2);
    } else if (shot === 1) {
      pos = new THREE.Vector3(7.6, 2.0, b.z * 0.55 + this.focusSide * 2.5);
      look = new THREE.Vector3(b.x * 0.6, Math.min(b.y, 2.4) * 0.6 + 0.5, b.z * 0.8);
    } else if (shot === 3) {
      // derrière l'auteur du coup, en hauteur : la balle et son point de chute restent dans le cadre
      pos = new THREE.Vector3(fp.x * 0.4, 4.2, fp.z + this.focusSide * 4.5);
      look = new THREE.Vector3(b.x * 0.8, Math.min(b.y, 3) * 0.4, b.z);
    } else {
      pos = new THREE.Vector3(fp.x * 0.6 - 2.0 * this.focusSide, 1.3, fp.z - this.focusSide * 3.2);
      look = fp.clone().add(new THREE.Vector3(0, 1.15, 0)).lerp(b, 0.3);
    }
    if (!this.cam || shot !== this.shot) {
      this.cam = { pos: pos.clone(), look: look.clone() };
      if (this.shot !== shot && this.cam) this.g.hud.replayFlash?.();
      this.shot = shot;
    }
    const kk = 1 - Math.exp(-dt * 4);
    this.cam.pos.lerp(pos, kk); this.cam.look.lerp(look, kk * 1.5);
    cam.position.copy(this.cam.pos);
    cam.lookAt(this.cam.look);
    this.g.cameraRig.pos.copy(cam.position);
    return true;
  }
}
