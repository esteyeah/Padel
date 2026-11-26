// ============================================================================
//  Match en ligne : synchronisation hôte -> invités.
//
//  L'hôte (le créateur de la partie) fait tourner la simulation complète. Les
//  invités ne simulent rien : ils envoient leurs commandes (déplacement, visée,
//  boutons) et reçoivent ~30 fois par seconde l'état du match (joueurs, balle,
//  score), qu'ils affichent avec un léger retard pour interpoler en douceur.
//  Les sons et effets ponctuels (frappes, rebonds, bannières) sont envoyés
//  comme événements.
// ============================================================================
import * as THREE from 'three';
import { BUTTONS } from '../entities/Player.js';
import { BotController } from '../controllers/BotController.js';
import { DIFFICULTY, PROFILES, PLAYER } from '../config.js';

const SNAP_HZ = 45;
const INPUT_HZ = 60;
const DELAY = 0.06;          // retard d'affichage des invités (interpolation entre deux états)

const r3 = (v) => Math.round(v * 1000) / 1000;
const r2 = (v) => Math.round(v * 100) / 100;

/** Contrôleur d'un joueur distant (côté hôte) : rejoue les commandes reçues. */
export class RemoteController {
  constructor(player, uid) {
    this.player = player;
    this.uid = uid;
    this.move = { x: 0, z: 0 };
    this.held = {};
    this.pending = {};
    this.aim = { x: 0, y: 0 };
  }

  receive(m) {
    if (m.m) { this.move.x = m.m[0]; this.move.z = m.m[1]; }
    this.held = {};
    for (const b of m.h || []) this.held[b] = true;
    for (const b of m.p || []) this.pending[b] = true;
    if (m.a) { this.aim.x = m.a[0]; this.aim.y = m.a[1]; }
  }

  capture(dt) {
    const k = 1 - Math.exp(-dt * 12);
    this.player.aim.x += (this.aim.x - this.player.aim.x) * k;
    this.player.aim.y += (this.aim.y - this.player.aim.y) * k;
  }

  getIntent() {
    const pressed = this.pending;
    this.pending = {};
    return { move: { ...this.move }, held: this.held, pressed };
  }
}

/** Déplacement inertiel local (même calcul que Player.update, sans les boutons). */
function predictMove(p, dt, intent, g) {
  let mx = intent.move?.x || 0, mz = intent.move?.z || 0;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  let maxS = p.maxSpeed();
  if (intent.held?.SPRINT && p.energy > 0.12 && (mx || mz)) maxS *= 1.3;
  if (p.armed?.held) maxS *= PLAYER.armedSpeedMul;
  if (p.swing && p.swing.t < 0.18) maxS *= 0.45;
  const tvx = mx * maxS, tvz = mz * maxS;
  let ax = tvx - p.vel.x, az = tvz - p.vel.z;
  const al = Math.hypot(ax, az);
  const braking = tvx * p.vel.x + tvz * p.vel.z < (p.vel.x ** 2 + p.vel.z ** 2) * 0.6;
  const maxA = (braking ? PLAYER.decel : PLAYER.accel) * dt;
  if (al > maxA) { ax *= maxA / al; az *= maxA / al; }
  p.vel.x += ax; p.vel.z += az;
  p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt;
  p.constrain(g);
}

/** Joueur affiché chez un invité (piloté par les états reçus). */
const puppetController = { capture() {}, getIntent: () => ({ move: { x: 0, z: 0 } }) };
export const PUPPET = puppetController;

// ---------------------------------------------------------------------------
export class NetHost {
  constructor(game, net) {
    this.role = 'host';
    this.g = game;
    this.net = net;
    this.t = 0;
    this.sendT = 0;
    this.patch();
    this.off = net.on((m) => this.onMessage(m));
  }

  /** Les appels au HUD et au son qui concernent tout le monde sont aussi envoyés aux invités. */
  patch() {
    const g = this.g, hud = g.hud, sfx = g.sfx;
    this.restore = [];
    const wrap = (obj, name, toMsg) => {
      const orig = obj[name];
      obj[name] = (...a) => { const r = orig.apply(obj, a); const m = toMsg(...a); if (m) this.ev(m); return r; };
      this.restore.push(() => { obj[name] = orig; });
    };
    wrap(hud, 'banner', (...a) => ({ k: 'banner', a }));
    wrap(hud, 'shotInfo', (text, side) => ({ k: 'shot', a: [text, side] }));
    wrap(hud, 'speech', (...a) => ({ k: 'speech', a }));
    wrap(hud, 'updateScore', () => ({ k: 'score', s: this.scoreState() }));
    wrap(sfx, 'hit', (s) => ({ k: 'sfx', n: 'hit', a: [s] }));
    wrap(sfx, 'crowd', (s) => ({ k: 'sfx', n: 'crowd', a: [s] }));
  }

  scoreState() {
    const s = this.g.score;
    return { points: s.points, games: s.games, setsWon: s.setsWon, history: s.history, tiebreak: s.tiebreak, server: s.server, winner: s.winner, tbTarget: s.tbTarget, turn: s.turn };
  }

  ev(m) { this.net.send({ t: 'ev', e: m }); }

  ballEvent(e) {
    if (e.type === 'floor' || e.type === 'glass' || e.type === 'mesh' || e.type === 'net' || e.type === 'netcord') {
      this.ev({ k: 'ball', e: { type: e.type, side: e.side, roll: e.roll, speed: r2(e.speed || 0), x: r3(e.x || 0), y: r3(e.y || 0), z: r3(e.z || 0), nx: e.nx, ny: e.ny, nz: e.nz } });
    }
  }

  onMessage(m) {
    const g = this.g;
    if (m.t === 'in') {
      const p = g.players.find((q) => q.controller instanceof RemoteController && q.controller.uid === m.from);
      p?.controller.receive(m);
    } else if (m.t === 'left') {
      // un invité est parti : un bot prend sa place
      const p = g.players.find((q) => q.controller instanceof RemoteController && q.controller.uid === m.uid);
      if (p) {
        p.controller = new BotController(p, g, PROFILES.varied || Object.values(PROFILES)[0], DIFFICULTY[g.opts.difficulty] || DIFFICULTY.medium);
        g.hud.banner(`${p.name} est parti`, 'Un bot prend sa place', 2.4);
        this.ev({ k: 'banner', a: [`${p.name} est parti`, 'Un bot prend sa place', 2.4] });
      }
    }
  }

  frame(dt) {
    this.t += dt;
    this.sendT -= dt;
    if (this.sendT > 0) return;
    this.sendT = 1 / SNAP_HZ;
    const g = this.g, b = g.ball.state;
    const ps = g.players.map((p) => [
      r3(p.pos.x), r3(p.pos.y), r3(p.pos.z), r2(p.vel.x), r2(p.vel.z), r2(p.aim.x), r2(p.aim.y),
      p.armed ? [p.armed.button, r2(p.armed.power ?? 0), p.armed.shotType || null] : 0,
      p.swing ? { id: p.swing._nid ??= Math.random(), kind: p.swing.kind, style: p.swing.style, t: r3(p.swing.t), dur: p.swing.dur, contactH: p.swing.contactH, jump: p.swing.jump || 0, cp: p.swing.contactPos ? [r3(p.swing.contactPos.x), r3(p.swing.contactPos.y), r3(p.swing.contactPos.z)] : null } : 0,
      r2(p.energy),
    ]);
    this.net.send({
      t: 'snap', T: r3(this.t), st: g.state,
      b: [r3(b.p.x), r3(b.p.y), r3(b.p.z), r2(b.v.x), r2(b.v.y), r2(b.v.z)], bv: g.ball.mesh.visible ? 1 : 0,
      ps, srv: g.players.indexOf(g.server), rf: [g.referee.serveBox, g.referee.lastHitterSide],
    });
  }

  end() {
    const s = this.g.score;
    this.net.send({ t: 'end', s: this.scoreState() });
    const score = s.history.map((h) => `${h[0]}-${h[1]}`).join(' ') || `${s.games[0]}-${s.games[1]}`;
    this.net.send({ t: 'result', winner: s.winner, score });
  }

  dispose() { this.off?.(); for (const f of this.restore) f(); }
}

// ---------------------------------------------------------------------------
export class NetClient {
  constructor(game, net) {
    this.role = 'client';
    this.g = game;
    this.net = net;
    this.snaps = [];
    this.clock = null;        // temps de l'hôte affiché
    this.inT = 0;
    this.pressed = {};
    this.off = net.on((m) => this.onMessage(m));
  }

  onMessage(m) {
    const g = this.g;
    if (m.t === 'snap') {
      this.snaps.push(m);
      if (this.snaps.length > 20) this.snaps.shift();
      // horloge d'affichage : recalée en continu (avant, le retard pouvait grimper jusqu'à 0,5 s)
      const target = m.T - DELAY;
      if (this.clock == null || Math.abs(this.clock - target) > 0.25) this.clock = target;
      else this.clock += (target - this.clock) * 0.15;
    } else if (m.t === 'ev') this.event(m.e);
    else if (m.t === 'end') {
      Object.assign(g.score, m.s);
      g.hud.updateScore(g.score);
      g.state = 'matchOver';
      g.endTime = g.time;
      g.hud.showEnd(g.score, g.human, false);
    } else if (m.t === 'chat') g.hud.speech(m.from, m.text, 1);
  }

  event(e) {
    const g = this.g;
    switch (e.k) {
      case 'banner': g.hud.banner(...e.a); break;
      case 'shot': g.hud.shotInfo(...e.a); break;
      case 'speech': g.hud.speech(...e.a); break;
      case 'score': Object.assign(g.score, e.s); g.hud.updateScore(g.score); break;
      case 'sfx': g.sfx[e.n]?.(...e.a); break;
      case 'ball': g.ballFx(e.e); break;
    }
  }

  /** Une image chez l'invité : envoi des commandes, application de l'état reçu. */
  frame(dt) {
    const g = this.g, h = g.human;
    g.time += dt;
    // commandes
    if (h) {
      const c = h.controller;
      c.capture(dt, g);
      for (const b of BUTTONS) if (g.input.pressed[b]) this.pressed[b] = true;
      const it = c.getIntent();
      for (const b in it.pressed || {}) if (it.pressed[b]) this.pressed[b] = true;
      this.move = it.move;
      // prédiction locale : notre joueur bouge tout de suite, sans attendre l'aller-retour réseau
      if (this.pred) predictMove(h, dt, it, g);
      this.inT -= dt;
      const urgent = Object.keys(this.pressed).length > 0;   // un appui de bouton part immédiatement
      if (this.inT <= 0 || urgent) {
        this.inT = 1 / INPUT_HZ;
        const held = Object.keys(it.held || {}).filter((k) => it.held[k]);
        this.net.send({ t: 'in', m: [r3(it.move.x), r3(it.move.z)], h: held, p: Object.keys(this.pressed), a: [r2(g.input.aim.x), r2(g.input.aim.y)] });
        this.pressed = {};
      }
    }
    // état interpolé
    if (!this.snaps.length) return;
    this.clock += dt;
    const S = this.snaps;
    const last = S[S.length - 1];
    if (this.clock > last.T) this.clock = Math.min(this.clock, last.T + 0.1);
    let a = S[0], b = S[0];
    for (let i = 0; i < S.length; i++) { if (S[i].T <= this.clock) a = S[i]; if (S[i].T >= this.clock) { b = S[i]; break; } b = S[i]; }
    while (S.length > 2 && S[1].T < this.clock - 0.2) S.shift();
    const span = b.T - a.T;
    const k = span > 1e-4 ? Math.min(1, Math.max(0, (this.clock - a.T) / span)) : 1;
    this.apply(a, b, k, dt);
  }

  apply(a, b, k, dt) {
    const g = this.g;
    const L = (x, y) => x + (y - x) * k;
    g.state = b.st;
    // balle : interpolée ; au-delà du dernier état connu, prolongée avec sa vitesse
    const bs = g.ball.state;
    if (a === b && this.clock > b.T) {
      const e = this.clock - b.T;
      bs.p.set(b.b[0] + b.b[3] * e, b.b[1] + b.b[4] * e - 4.9 * e * e, b.b[2] + b.b[5] * e);
    } else bs.p.set(L(a.b[0], b.b[0]), L(a.b[1], b.b[1]), L(a.b[2], b.b[2]));
    bs.v.set(b.b[3], b.b[4], b.b[5]);
    g.ball.mesh.visible = !!b.bv;
    g.server = g.players[b.srv] || null;
    if (b.rf) { g.referee.serveBox = b.rf[0]; g.referee.lastHitterSide = b.rf[1]; }
    g.players.forEach((p, i) => {
      const A = a.ps[i], B = b.ps[i];
      if (!A || !B) return;
      if (p === g.human) {
        // réconciliation douce : l'état de l'hôte (en retard) corrige la prédiction sans à-coups
        const last = this.snaps[this.snaps.length - 1].ps[i];
        const lag = Math.min(0.25, (this.net.rtt || 0.08) * 0.5);
        const tx = last[0] + last[3] * lag, tz = last[2] + last[4] * lag;
        const ex = tx - p.pos.x, ez = tz - p.pos.z, err = Math.hypot(ex, ez);
        if (!this.pred || err > 1.5 || b.st !== 'rally') { p.pos.set(L(A[0], B[0]), L(A[1], B[1]), L(A[2], B[2])); p.vel.set(L(A[3], B[3]), 0, L(A[4], B[4])); this.pred = b.st === 'rally'; }
        else { const kk = 1 - Math.exp(-dt * 3); p.pos.x += ex * kk; p.pos.z += ez * kk; p.pos.y = B[1]; }
      } else {
        p.pos.set(L(A[0], B[0]), L(A[1], B[1]), L(A[2], B[2]));
        p.vel.set(L(A[3], B[3]), 0, L(A[4], B[4]));
      }
      if (p !== g.human) { p.aim.x = B[5]; p.aim.y = B[6]; }
      p.armed = B[7] ? { button: B[7][0], power: B[7][1], shotType: B[7][2], held: true } : null;
      const sw = B[8];
      if (!sw) p.swing = null;
      else if (!p.swing || p.swing._nid !== sw.id) {
        p.swing = { _nid: sw.id, kind: sw.kind, style: sw.style, t: sw.t, dur: sw.dur, contactH: sw.contactH, jump: sw.jump, contactPos: sw.cp ? new THREE.Vector3(...sw.cp) : null };
      } else p.swing.t = Math.min(p.swing.dur, Math.max(p.swing.t + dt, sw.t - 0.05));
      p.energy = B[9];
    });
  }

  dispose() { this.off?.(); }
}
