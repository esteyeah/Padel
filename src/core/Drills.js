// ============================================================================
//  Entraînements (mode carrière) : de vrais exercices joués sur le court.
//  Chaque atelier développe un attribut ; le résultat donne une médaille
//  (bronze / argent / or) qui détermine le gain.
//
//   coach      tie-break en simple contre l'entraîneur        -> Coup droit & revers
//   serve      service de précision dans une zone             -> Coup droit & revers
//   smash      sortir la balle (por tres) sur lobs au filet   -> Smash & bandeja
//   wall       contre-vitre : renvoyer en tapant sa vitre     -> Force
//   precision  échange : toucher la zone indiquée             -> Coup droit & revers
//   lob        lober l'entraîneur monté au filet              -> Lob
//   cardio     circuit cardio (60 s, la fatigue compte)       -> Endurance
//   sprint     sprints courts entre les plots (30 s)          -> Vitesse
//   chase      rattraper la balle sortie du terrain           -> Vitesse
//
//  Intégration : Game appelle setup / update / onBallEvent / onHit / onDecision.
//  Les balles sont envoyées par une machine (Game.feedBall) depuis le camp adverse.
// ============================================================================
import * as THREE from 'three';
import { COURT, VENUE_RULES } from '../config.js';
import { planShot } from '../physics/ShotSolver.js';
import { BallState, simulate } from '../physics/BallPhysics.js';

const rnd = (a, b) => a + Math.random() * (b - a);

export const DRILLS = {
  coach: { label: 'Tie-break contre le coach', attr: 'drive', icon: '1v1', desc: 'Un tie-break en 7 points, en simple, contre votre entraîneur.', unit: 'points', medals: null },
  serve: { label: 'Service de précision', attr: 'drive', icon: 'SRV', desc: '10 services : faites rebondir la balle dans la zone verte.', unit: 'zones', total: 10, medals: [2, 4, 6] },
  smash: { label: 'Sortir la balle', attr: 'smash', icon: 'X3', desc: '10 lobs au filet. Smashez fort : vitre du fond touchée au-dessus d\'1 m = 1 pt, balle qui revient de votre côté = 2 pts, balle sortie (par 3 ou par la porte) = 3 pts.', unit: 'pts', total: 10, medals: [4, 9, 15] },
  wall: { label: 'Contre-vitre', attr: 'strength', icon: 'CV', desc: '10 balles vous passent : renvoyez-les en frappant dans votre vitre (actions A+B ensemble).', unit: 'réussis', total: 10, medals: [3, 5, 7] },
  precision: { label: 'Précision en échange', attr: 'drive', icon: 'PRE', desc: 'Échange avec le coach : faites rebondir vos frappes dans la zone indiquée (20 frappes).', unit: 'zones', total: 20, medals: [3, 6, 9] },
  lob: { label: 'Lobs', attr: 'lob', icon: 'LOB', desc: 'Le coach est au filet : lobez-le, la balle doit retomber dans les 3 derniers mètres (10 balles).', unit: 'lobs', total: 10, medals: [3, 5, 7] },
  cardio: { label: 'Circuit cardio', attr: 'stamina', icon: 'CAR', desc: '60 s : touchez un maximum de plots éloignés. La fatigue vous ralentit.', unit: 'plots', time: 60, medals: [20, 27, 33] },
  chase: { label: 'Rattraper la balle sortie', attr: 'speed', icon: 'OUT', desc: '8 smashs font sortir la balle par la porte ou par-dessus le grillage : sortez par la porte (au filet) et renvoyez-la en lob dans le camp adverse avant le second rebond.', unit: 'renvois', total: 8, medals: [1, 3, 5] },
  sprint: { label: 'Sprints', attr: 'speed', icon: 'SPR', desc: '30 s de sprints courts : touchez un maximum de plots.', unit: 'plots', time: 30, medals: [26, 34, 41] },
};
export const DRILL_IDS = Object.keys(DRILLS);
export const MEDALS = ['Aucune', 'Bronze', 'Argent', 'Or'];

/** Médaille (0..3) selon le score et les paliers [bronze, argent, or]. */
export function medalFor(def, score) {
  if (!def.medals) return 0;
  return def.medals.filter((m) => score >= m).length;
}

// ------------------------------------------------------------------ base
class Drill {
  constructor(game, id) {
    this.g = game;
    this.id = id;
    this.def = DRILLS[id];
    this.score = 0;
    this.count = 0;
    this.done = false;
    this.objs = [];
    this.timer = 0;
  }
  get human() { return this.g.human; }
  add(o) { this.g.scene.add(o); this.objs.push(o); return o; }
  dispose() { for (const o of this.objs) { this.g.scene.remove(o); o.traverse?.((m) => { m.geometry?.dispose(); m.material?.dispose?.(); }); } this.objs = []; }
  setup() {}
  update() {}
  onBallEvent() {}
  onHit() {}
  /** true : le drill gère la fin de l'échange (pas de score de match). */
  onDecision() { return true; }
  next() {}
  finish() { this.done = true; }
  hud() {
    const d = this.def;
    if (d.time) return `${d.label} · ${this.score} ${d.unit} · ${Math.max(0, Math.ceil(d.time - this.timer))} s`;
    return `${d.label} · ${this.score} ${d.unit} · ${Math.min(this.count + 1, d.total)}/${d.total}`;
  }
  result() { return { drill: this.id, score: this.score, medal: medalFor(this.def, this.score), label: this.def.label }; }

  /** Zone cible au sol (rectangle lumineux). */
  zone(w, d, color = 0x69f0ae) {
    const m = this.add(new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.38, depthWrite: false })));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.renderOrder = 4;
    m.userData = { w, d };
    return m;
  }
  inZone(z, x, zz) { return Math.abs(x - z.position.x) <= z.userData.w / 2 && Math.abs(zz - z.position.z) <= z.userData.d / 2; }
  /** Fin de l'échange : on enchaîne après un court délai. */
  later(delay = 1.2) { this.g.drillPause(delay); }
}

// ------------------------------------------------------------------ tie-break contre le coach
class CoachDrill extends Drill {
  setup() { this.g.setupServe(1); }
  onDecision() { return false; }      // score normal
  hud() { return `${this.def.label} · ${this.g.score.label(1)} - ${this.g.score.label(-1)}`; }
  result() {
    const sc = this.g.score;
    const mine = sc.history.length ? sc.history[0][0] : sc.points[0];
    const won = sc.winner === 1;
    const medal = won ? 3 : mine >= 5 ? 2 : mine >= 3 ? 1 : 0;
    return { drill: this.id, score: mine, medal, label: this.def.label, won };
  }
}

// ------------------------------------------------------------------ service
class ServeDrill extends Drill {
  setup() { this.target = this.zone(1.5, 1.5); this.next(); }
  next() {
    if (this.count >= this.def.total) { this.finish(); return; }
    const sc = this.g.score;
    sc.server = 1;
    sc.points = [this.count % 2, 0];              // alterne côté droit / côté gauche
    this.g.setupServe(1);
    const box = this.g.referee.serveBox;
    this.target.position.set(box.xSign * rnd(1.0, 4.0), 0.012, box.zSign * rnd(1.4, 6.0));
    this.bounced = false;
  }
  onBallEvent(e) {
    if (e.type === 'floor' && this.g.referee.isServe && this.g.referee.crossed && !this.bounced) {
      this.bounced = true;
      if (this.inZone(this.target, e.x, e.z)) { this.score++; this.g.drillFlash('DANS LA ZONE !', '#69f0ae'); }
    }
  }
  onDecision() { this.count++; this.later(1.1); return true; }
}

// ------------------------------------------------------------------ machine à balles (base)
class FeedDrill extends Drill {
  setup() { this.next(); }
  feedSpec() { return null; }
  next() {
    if (this.count >= this.def.total) { this.finish(); return; }
    this.place();
    this.scored = false;
    const f = this.feedSpec();
    this.g.feedBall(f);
  }
  place() {}
  onDecision() { this.count++; this.later(1.0); return true; }
}

// ------------------------------------------------------------------ sortir la balle (smash)
class SmashDrill extends FeedDrill {
  place() { const h = this.human; h.resetMotion(); h.pos.set(rnd(-1.5, 1.5), 0, 3.2); this.glassPts = 0; }
  feedSpec() { return { from: [rnd(-2, 2), 1.0, -8.5], target: { x: rnd(-1.8, 1.8), z: rnd(3.8, 5.2) }, type: 'lob', power: rnd(0.2, 0.4) }; }
  onBallEvent(e) {
    const ref = this.g.referee;
    if (ref.lastHitterSide !== 1 || this.scored) return;
    if (ref.bounces < 1) return;
    // la meilleure issue compte : sortie (3) > retour dans votre camp (2) > vitre haute (1)
    let pts = 0, msg = '';
    if (e.type === 'out') { pts = 3; msg = e.via === 'door' ? 'PAR LA PORTE !' : 'POR TRES !'; }
    else if (e.type === 'cross' && e.to === 1) { pts = 2; msg = 'LA BALLE REVIENT !'; }
    else if (e.type === 'glass' && e.side === -1 && e.y > 1.0 && !this.glassPts) { this.glassPts = 1; this.score += 1; this.g.drillFlash('VITRE HAUTE !', '#7df9ff'); return; }
    if (!pts) return;
    this.score += pts - (this.glassPts || 0);
    this.scored = true;
    this.g.drillFlash(msg, '#ffd400');
  }
}

// ------------------------------------------------------------------ contre-vitre
class WallDrill extends FeedDrill {
  place() { const h = this.human; h.resetMotion(); h.pos.set(rnd(-1.2, 1.2), 0, 8.1); }
  feedSpec() { return { from: [rnd(-2, 2), 1.0, -7.5], target: { x: rnd(-2.5, 2.5), z: rnd(7.4, 8.6) }, type: 'drive', power: rnd(0.55, 0.8) }; }
  onHit(p, type) { if (p === this.human) this.lastType = type; }
  onBallEvent(e) {
    const ref = this.g.referee;
    if (!this.scored && e.type === 'floor' && ref.lastHitterSide === 1 && ref.crossed && e.side === -1 && this.lastType === 'wall') {
      this.scored = true; this.score++; this.g.drillFlash('CONTRE-VITRE RÉUSSI !', '#69f0ae');
    }
  }
  next() { this.lastType = null; super.next(); }
}

// ------------------------------------------------------------------ lobs
class LobDrill extends FeedDrill {
  place() {
    const h = this.human; h.resetMotion(); h.pos.set(rnd(-1, 1), 0, 7.6);
    const c = this.g.teams[-1][0]; c.resetMotion(); c.pos.set(rnd(-1.5, 1.5), 0, -2.6);
    this.zoneMesh.position.set(0, 0.012, -8.5);
  }
  setup() { this.zoneMesh = this.zone(2 * COURT.halfW - 0.4, 3); super.setup(); }
  feedSpec() { return { from: [rnd(-2, 2), 1.0, -3], target: { x: rnd(-2, 2), z: rnd(5.5, 7.2) }, type: 'drive', power: 0.3 }; }
  onBallEvent(e) {
    const ref = this.g.referee;
    if (!this.scored && e.type === 'floor' && ref.lastHitterSide === 1 && ref.crossed && e.side === -1) {
      this.scored = true;
      if (Math.abs(e.z) >= 7) { this.score++; this.g.drillFlash('LOB PARFAIT !', '#69f0ae'); }
    }
  }
}

// ------------------------------------------------------------------ précision en échange
class PrecisionDrill extends Drill {
  setup() {
    this.target = this.zone(2.2, 2.2);
    this.moveZone();
    // le coach renvoie gentiment vers vous
    const coach = this.g.teams[-1][0];
    coach.controller.chooseShot = () => ({ button: 'A', type: 'drive', power: 0.42, target: { x: this.human.pos.x * 0.5 + rnd(-1.2, 1.2), z: rnd(5.8, 7.6) } });
    this.feed();
  }
  moveZone() { this.target.position.set(rnd(-3.2, 3.2), 0.012, -rnd(4.2, 8.6)); }
  feed() { this.g.feedBall({ from: [rnd(-2, 2), 1.0, -8], target: { x: rnd(-2, 2), z: rnd(6, 7.5) }, type: 'drive', power: 0.45 }); }
  onHit(p) {
    if (p !== this.human) return;
    this.count++;
    this.pending = true;
  }
  onBallEvent(e) {
    const ref = this.g.referee;
    if (this.pending && e.type === 'floor' && ref.lastHitterSide === 1 && ref.crossed && e.side === -1) {
      this.pending = false;
      if (this.inZone(this.target, e.x, e.z)) { this.score++; this.g.drillFlash('DANS LA ZONE !', '#69f0ae'); this.moveZone(); }
    }
  }
  update() { if (this.count >= this.def.total && this.g.state === 'rally' && !this.pending) this.finish(); }
  onDecision() { if (this.count >= this.def.total) this.finish(); else this.later(0.9); return true; }
  next() { this.pending = false; this.feed(); }
}

// ------------------------------------------------------------------ plots (cardio / sprints)
class ConeDrill extends Drill {
  setup() {
    const g = this.g;
    g.state = 'drill';
    g.ball.setVisible(false);
    g.ball.holdAt(new THREE.Vector3(0, -5, 0));
    g.drainMul = this.id === 'cardio' ? 3.2 : 1.4;
    this.cone = this.add(new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 14), new THREE.MeshStandardMaterial({ color: 0xff6d00, emissive: 0xff6d00, emissiveIntensity: 0.4 })));
    this.cone.castShadow = true;
    const h = this.human; h.resetMotion(); h.pos.set(0, 0, 6);
    this.placeCone();
    g.hud.hint('Touchez les plots orange le plus vite possible');
  }
  placeCone() {
    const h = this.human;
    const [mn, mx] = this.id === 'cardio' ? [4.5, 8] : [2, 3.6];
    for (let i = 0; i < 30; i++) {
      const x = rnd(-4.4, 4.4), z = rnd(0.8, 9.4);
      const d = Math.hypot(x - h.pos.x, z - h.pos.z);
      if (d >= mn && d <= mx) { this.cone.position.set(x, 0.22, z); return; }
    }
    this.cone.position.set(-h.pos.x * 0.8, 0.22, h.pos.z > 5 ? 2 : 8);
  }
  update(dt) {
    if (this.done) return;
    this.timer += dt;
    const h = this.human;
    if (Math.hypot(h.pos.x - this.cone.position.x, h.pos.z - this.cone.position.z) < 0.55) {
      this.score++;
      this.g.sfx.hit(8);
      this.placeCone();
    }
    this.cone.rotation.y += dt * 3;
    if (this.timer >= this.def.time) this.finish();
  }
  dispose() { super.dispose(); this.g.drainMul = 1; this.g.ball.setVisible(true); }
}

// ------------------------------------------------------------------ rattraper la balle sortie
class ChaseDrill extends FeedDrill {
  place() {
    this.sx = Math.random() < 0.5 ? -1 : 1;
    const h = this.human; h.resetMotion(); h.pos.set(this.sx * 3.6, 0, 1.8);
    this.fromOutside = false;
  }
  /**
   * La machine envoie une balle qui rebondit près du grillage latéral, remonte au-dessus
   * (sortie « par 3 ») ou passe par la porte, et retombe dehors à portée : il reste au moins
   * 1,1 s entre la sortie et le second rebond.
   */
  feedSpec() {
    const st = new BallState(), sx = this.sx;
    // alterne les sorties par la porte et « par 3 » (par-dessus le grillage / la vitre latérale)
    this.n = (this.n || 0) + 1;
    // trois sorties : par 3 direct, par la porte, et par 3 après un rebond sur la vitre de notre camp
    const mode = ['over', 'door', 'glass'][this.n % 3];
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < (mode === 'door' ? 2500 : mode === 'glass' ? 14000 : 6000); i++) {
      const from = mode === 'glass' ? [sx * rnd(-2, 4.5), rnd(2, 7), -rnd(0.5, 6)] : [sx * rnd(1, 4), rnd(3, 6), -rnd(0.6, 3)];
      const vel = mode === 'glass' ? [sx * rnd(-3, 9), rnd(-28, -4), rnd(6, 26)] : mode === 'over' ? [sx * rnd(3, 9), rnd(-22, -9), rnd(5, 13)] : [sx * rnd(2, 6), rnd(-8, -2), rnd(2.5, 7)];
      st.reset({ x: from[0], y: from[1], z: from[2] });
      st.v.set(...vel);
      let bounced = false, crossed = false, exit = null, land = null, glassHits = 0;
      simulate(st, 5, 1 / 120, (s, t, evs) => {
        for (const e of evs) {
          if (e.type === 'cross') crossed = true;
          else if (e.type === 'net' || e.type === 'netcord') return false;
          else if (e.type === 'floor' && !bounced) { if (e.side !== 1 || !crossed) return false; bounced = true; }
          else if (e.type === 'glass' && !exit && mode === 'glass' && bounced && glassHits === 0) glassHits++;
          else if ((e.type === 'glass' || e.type === 'mesh') && !exit) return false;
          else if (e.type === 'out') { if (bounced && e.wall === 'side' && e.side === 1) exit = { ...e, t }; else return false; }
          else if (e.type === 'floor' && exit) { land = { ...e, t }; return false; }
        }
      });
      if (!exit || !land || exit.via !== (mode === 'glass' ? 'over' : mode) || (mode === 'glass') !== (glassHits > 0)) continue;
      // la balle met du temps à retomber dehors : on a le temps d'anticiper et de sortir
      const time = land.t - exit.t, dist = Math.abs(land.x) - COURT.halfW;
      if (time < (mode === 'glass' ? 1.0 : 1.5) || dist < 0.6 || dist > 3.8 || land.z < 0.4 || land.z > 9.5) continue;
      const score = Math.min(time, 2.6) - Math.abs(land.z - 3) * 0.05;
      if (score > bestScore) { bestScore = score; best = { from, vel }; if (score > 2.4) break; }
    }
    return best || { from: [sx * 3, 4, -1], vel: [sx * 4.5, -6, 5.5] };
  }
  onHit(p) {
    if (p !== this.human) return;
    if (p.isOutside()) this.fromOutside = true;
    else this.g.drillFlash('FRAPPEZ DEHORS !', '#ff8a65');   // il faut sortir pour la jouer
  }
  onBallEvent(e) {
    const ref = this.g.referee;
    if (!this.scored && this.fromOutside && e.type === 'floor' && ref.lastHitterSide === 1 && ref.crossed && e.side === -1) {
      this.scored = true; this.score++; this.g.drillFlash('RATTRAPÉE !', '#69f0ae');
    }
  }
  setup() {
    if (!VENUE_RULES.outside) this.g.hud.hint('Ce terrain n\'autorise pas le jeu à l\'extérieur.');
    super.setup();
  }
}

const CLASSES = { chase: ChaseDrill, coach: CoachDrill, serve: ServeDrill, smash: SmashDrill, wall: WallDrill, precision: PrecisionDrill, lob: LobDrill, cardio: ConeDrill, sprint: ConeDrill };

export function createDrill(game, id) {
  const C = CLASSES[id];
  if (!C) throw new Error(`Entraînement inconnu : ${id}`);
  return new C(game, id);
}
