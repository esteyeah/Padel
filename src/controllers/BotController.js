// ============================================================================
//  IA des bots (simple et double) :
//   - après chaque frappe adverse (et un temps de réaction), simulation de la
//     trajectoire complète (rebonds sol + vitres) et choix d'un point
//     d'interception atteignable selon le profil (fond de court / filet) ;
//   - en double, l'équipe décide QUI prend la balle (couloir, distance,
//     faisabilité) ; le partenaire couvre sa moitié. Avec un partenaire humain,
//     le bot laisse au joueur sa moitié et le milieu ;
//   - placement par couloir, montée/descente au filet en équipe ;
//   - choix du coup : lob si l'équipe adverse est au filet, smash/bandeja sur
//     balle haute, jeu "par le milieu" ou dans l'espace libre.
// ============================================================================
import { PLAYER, COURT, VENUE_RULES, DOOR, doorAt, clamp, gauss } from '../config.js';
import { simulate } from '../physics/BallPhysics.js';

const rnd = (a, b) => a + Math.random() * (b - a);

export class BotController {
  constructor(player, game, profile, diff) {
    this.player = player;
    this.game = game;
    this.profile = profile;
    this.diff = diff;
    this.plan = null;
    this.nextPlanAt = 0;
    this.serveAt = null;
    this.err = { x: 0, z: 0 };
  }

  capture() {}

  onBallHit(hitter) {
    const g = this.game;
    this.plan = null;
    if (!hitter || hitter.side !== this.player.side) {
      this.chase = Math.random() < 0.5;            // une fois sur deux, il tente de sortir la chercher
      this.nextPlanAt = g.time + this.diff.reaction * rnd(0.8, 1.25);
      this.err = { x: gauss() * this.diff.planError, z: gauss() * this.diff.planError };
    } else {
      this.nextPlanAt = Infinity;
    }
  }

  onBallEvent(e) {
    // un rebond sur vitre/grillage peut dévier la balle : on replanifie vite
    if ((e.type === 'glass' || e.type === 'mesh' || e.type === 'netcord') && this.nextPlanAt !== Infinity) {
      this.nextPlanAt = Math.min(this.nextPlanAt, this.game.time + this.diff.reaction * 0.5);
    }
  }

  getIntent() {
    const g = this.game, p = this.player;
    const intent = { move: { x: 0, z: 0 } };

    if (g.state === 'serve') {
      if (g.server === p) {
        if (this.serveAt === null) this.serveAt = g.time + rnd(0.9, 1.6);
        if (g.time >= this.serveAt) {
          this.serveAt = null;
          g.startToss(p);
          p.arm('A', { auto: true, persistent: true, power: rnd(0.35, 0.55) + this.diff.aggression * 0.3, target: this.serveTarget(), shotType: 'serve', time: g.time });
        }
      } else {
        this.moveTo(intent, g.receivePos(p));
      }
      return intent;
    }
    this.serveAt = null;
    if (g.state === 'toss') return intent;

    const incoming = g.state === 'rally' && g.referee.lastHitterSide !== p.side;
    if (incoming) {
      if (g.time >= this.nextPlanAt) {
        this.replan();
        this.nextPlanAt = g.time + 0.12;
      }
      if (this.plan) {
        this.moveTo(intent, this.waypoint(this.plan));
        const tLeft = this.plan.contactTime - g.time;
        const near = Math.hypot(this.plan.stand.x - p.pos.x, this.plan.stand.z - p.pos.z) < 0.7;
        if (!p.armed && ((tLeft < 0.32 && near) || tLeft < 0.12) && tLeft > -0.3) {
          const shot = this.chooseShot(this.plan.contact);
          p.arm(shot.button, { auto: true, power: shot.power, target: shot.target, shotType: shot.type, time: g.time });
        }
        return intent;
      }
    }
    this.moveTo(intent, this.homePos());
    return intent;
  }

  /** Passage par la porte pour sortir (ou rentrer) du court. */
  waypoint(plan) {
    const p = this.player, hw = COURT.halfW;
    const outNow = Math.abs(p.pos.x) > hw;
    const outTarget = Math.abs(plan.stand.x) > hw;
    if (outNow === outTarget || !plan.via) return plan.stand;
    const v = plan.via;
    const atDoor = Math.abs(p.pos.z - v.z) < 0.2;
    if (!atDoor) return { x: v.x * (outNow ? hw + 0.5 : hw - 0.45), z: v.z };
    return { x: v.x * (outNow ? hw - 0.6 : hw + 0.8), z: v.z };
  }

  moveTo(intent, t) {
    const p = this.player;
    const dx = t.x - p.pos.x, dz = t.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return;
    const k = Math.min(1, d / 0.6);
    intent.move.x = (dx / d) * k;
    intent.move.z = (dz / d) * k;
  }

  // ------------------------------------------------------------------ placement
  teamDepth() {
    const g = this.game, p = this.player;
    const partner = g.partnerOf(p);
    // avec un humain : on suit sa position (monter et descendre ensemble)
    if (p.tactic === 'net') return g.lastShot?.type === 'lob' && g.lastShot.side !== p.side ? 6.5 : 3.6;
    if (p.tactic === 'back') return 8.2;
    if (partner?.isHuman) return Math.abs(partner.pos.z) < 5.5 ? 3.8 : 8.0;
    let d = this.profile.homeDepth;
    // style varié : on monte quand les adversaires reculent, on recule quand ils montent
    if (this.profile.adaptive) {
      const opp = g.teams[-p.side] || [];
      const oz = opp.length ? opp.reduce((s, q) => s + Math.abs(q.pos.z), 0) / opp.length : 8;
      const want = oz > 7.2 ? 3.6 : oz < 4.8 ? 8.0 : 5.8;
      this._adaptDepth = (this._adaptDepth ?? d) + (want - (this._adaptDepth ?? d)) * 0.04;
      d = this._adaptDepth;
    }
    const last = g.lastShot;
    if (last && last.type === 'lob') d = last.side === p.side ? Math.min(d, 4.2) : Math.max(d, 7.8);
    // l'attaquant recule si l'adversaire peut le lober depuis le fond
    if (!g.doubles && d < 5 && g.referee.lastHitterSide === p.side && Math.abs(g.opponentOf(p).pos.z) < 4) d = 5.5;
    return d;
  }

  homePos() {
    const g = this.game, p = this.player;
    const bx = g.ball.state.p.x;
    const depth = this.teamDepth();
    if (!g.doubles) return { x: clamp(bx * 0.35, -3, 3), z: p.side * depth };
    return { x: clamp(p.laneX() * 0.85 + bx * 0.18, -4.2, 4.2), z: p.side * depth };
  }

  serveTarget() {
    const box = this.game.referee.serveBox;
    const m = this.diff.margin;
    // viser plutôt profond et vers la vitre latérale/du fond (le grillage après rebond = faute)
    const x = box.xSign * rnd(0.6 + m * 0.5, 3.4 - m * 0.4);
    const d = rnd(4.6, 6.6 - m * 0.5);
    return { x, z: box.zSign * d };
  }

  // ------------------------------------------------------------------ interception
  /** Points de la trajectoire prévue où l'équipe peut frapper la balle. */
  candidates() {
    const g = this.game, side = this.player.side;
    const ref = g.referee;
    let crossed = ref.crossed, bounces = ref.bounces, afterWall = false, dead = false;
    const mustBounce = ref.isServe;
    const cands = [];
    let step = 0;
    simulate(g.ball.state, 3.2, 1 / 120, (s, t, events) => {
      for (const e of events) {
        if (e.type === 'cross' && e.to === side) crossed = true;
        if (e.type === 'floor' && crossed && e.side === side) bounces++;
        if ((e.type === 'glass' || e.type === 'mesh') && crossed && bounces > 0) afterWall = true;
        if (e.type === 'stopped') dead = true;
        if (e.type === 'out' && !(VENUE_RULES.outside && e.wall === 'side' && e.side === side && bounces >= 1 && this.diff.aggression >= 0.6 && this.chase)) dead = true;
        if (e.type === 'floor' && !crossed) dead = true;
      }
      if (dead || bounces >= 2) return false;
      if (!crossed || s.p.z * side < 0.25) return;
      if (mustBounce && bounces === 0) return;
      if ((step++ & 1) === 1) return;
      const h = s.p.y;
      if (h < 0.22 || h > 2.95) return;
      cands.push({ t, x: s.p.x, y: h, z: s.p.z, bounced: bounces > 0, afterWall });
    });
    return cands;
  }

  /** Meilleur point d'interception pour un joueur donné. */
  evaluate(p, cands, err = { x: 0, z: 0 }) {
    const side = p.side;
    const maxS = p.maxSpeed() * 0.92;
    const pr = this.profile;
    let best = null, bestScore = -Infinity, fallback = null, bestSlack = -Infinity;
    for (const c of cands) {
      const fh = side * p.hand;                      // côté du coup droit
      let sx = c.x - fh * PLAYER.idealDist * 0.95;   // se placer pour jouer en coup droit
      if (Math.abs(sx) > COURT.halfW - 0.35) sx = c.x + fh * PLAYER.idealDist * 0.95;
      let sz = clamp((c.z + side * 0.15) * side + err.z, PLAYER.netMargin, COURT.halfL - 0.3) * side;
      let dist, via = null;
      if (Math.abs(c.x) > COURT.halfW - 0.1) {
        // balle à l'extérieur : il faut passer par une porte de ce côté et de sa moitié
        const wx = Math.sign(c.x);
        const dz = DOOR.centers.map((dc) => side * Math.max(dc, 0.8)).find(() => true);
        if (!VENUE_RULES.outside || !doorAt(wx, dz)) continue;
        sx = clamp(c.x - wx * 0.7, wx > 0 ? COURT.halfW + 0.4 : -(COURT.halfW + 4), wx > 0 ? COURT.halfW + 4 : -(COURT.halfW + 0.4));
        sz = clamp(c.z * side, 0.5, COURT.halfL + 1) * side;
        via = { x: wx, z: dz };
        dist = Math.hypot(wx * (COURT.halfW - 0.4) - p.pos.x, dz - p.pos.z) + 0.9 + Math.hypot(sx - wx * (COURT.halfW + 0.5), sz - dz);
      } else {
        sx = clamp(sx + err.x, -4.7, 4.7);
        dist = Math.hypot(sx - p.pos.x, sz - p.pos.z);
      }
      const slack = c.t - (dist / maxS + 0.1);
      const overhead = c.y > 1.6;
      let score = overhead ? pr.overheadPref - (c.y > 2.5 ? 0.4 : 0) : -Math.abs(c.y - 0.95) * 1.2;
      if (!c.bounced) score += pr.volleyPref * (Math.abs(c.z) < 5 ? 1 : -1);
      if (c.afterWall) score += pr.glassPref;
      score -= c.t * 0.15;
      if (via) score -= 1.5;            // dernier recours
      if (slack < 0) {
        if (slack > bestSlack) { bestSlack = slack; fallback = { c, sx, sz, slack, dist, via }; }
        continue;
      }
      score += Math.min(slack, 0.4) * 1.5;
      if (score > bestScore) { bestScore = score; best = { c, sx, sz, slack, dist, via }; }
    }
    return best || fallback;
  }

  /** En double : qui de l'équipe prend cette balle ? (décision partagée par frappe) */
  decideTaker(cands, mine) {
    const g = this.game, p = this.player;
    const partner = g.partnerOf(p);
    if (!partner) return p;
    if (g.taker && g.taker.hitId === g.hitId && g.taker.side === p.side) return g.taker.player;
    let taker;
    if (partner.isHuman) {
      // le bot laisse au joueur sa moitié et le milieu, sauf s'il est bien plus près
      const c = mine.c;
      const myHalf = Math.sign(p.laneX());
      taker = c.x * myHalf > 0.45 ? p : partner;
      const dH = Math.hypot(partner.pos.x - c.x, partner.pos.z - c.z);
      const dMe = Math.hypot(p.pos.x - c.x, p.pos.z - c.z);
      if (taker === partner && dH > dMe + 2.5) taker = p;
    } else {
      const theirs = this.evaluate(partner, cands) || { slack: -Infinity, dist: Infinity };
      const okMe = mine.slack >= 0, okThem = theirs && theirs.slack >= 0;
      if (okMe !== okThem) taker = okMe ? p : partner;
      else if (!okMe) taker = mine.slack >= (theirs?.slack ?? -Infinity) ? p : partner;
      else {
        // les deux peuvent : chacun sa moitié ; au milieu, le plus proche
        const cx = mine.c.x;
        if (Math.abs(cx) < 0.7) taker = mine.dist <= theirs.dist ? p : partner;
        else taker = Math.sign(cx) === Math.sign(p.laneX()) ? p : partner;
      }
    }
    g.taker = { hitId: g.hitId, side: p.side, player: taker };
    return taker;
  }

  replan() {
    const g = this.game, p = this.player;
    const cands = this.candidates();
    if (!cands.length) { this.plan = null; return; }
    const ch = this.evaluate(p, cands, this.err);
    if (!ch) { this.plan = null; return; }      // balle inaccessible (dehors sans porte)
    if (g.doubles && this.decideTaker(cands, ch) !== p) { this.plan = null; return; }
    this.plan = { stand: { x: ch.sx, z: ch.sz }, contactTime: g.time + ch.c.t, contact: ch.c, via: ch.via };
  }

  // ------------------------------------------------------------------ choix du coup
  chooseShot(c) {
    const g = this.game, p = this.player, D = this.diff, pr = this.profile;
    const opps = g.opponentsOf(p);
    const oppSide = -p.side;
    const myDepth = Math.abs(p.pos.z);
    const oppDepth = opps.reduce((s, o) => s + Math.abs(o.pos.z), 0) / opps.length;
    const m = D.margin;
    const r = Math.random();
    let type = 'drive', button = 'A';
    let power = clamp(0.4 + D.aggression * 0.4 + (pr.powerBias || 0) + rnd(-0.1, 0.15), 0.3, 1);
    let depth = rnd(6.6, 8.6 - m * 0.6);

    if (c.y > 1.75 && myDepth < 7.5) {
      button = 'Y';
      if (myDepth < 4.8 + (pr.smashBias || 0) * 3 && r < 0.45 + D.aggression * 0.45 + (pr.smashBias || 0)) { type = 'smash'; power = rnd(0.8, 1); depth = rnd(6.5, 8.2); }
      else { type = 'bandeja'; power = rnd(0.35, 0.6); depth = rnd(7.2, 8.8 - m * 0.4); }
    } else if (oppDepth < 4.5 && r < pr.lobRate) {
      button = 'B'; type = 'lob'; power = rnd(0.35, 0.65); depth = rnd(7.8, 9.1 - m * 0.4);
    } else if (oppDepth > 7 && r < pr.dropRate + D.aggression * 0.08) {
      button = 'X'; type = 'drop'; power = rnd(0.3, 0.6); depth = rnd(1.6, 2.8);
    } else if (oppDepth < 4.6 && myDepth > 6.5 && r < 0.3 + D.aggression * 0.1) {
      // chiquita : balle douce et basse dans les pieds des volleyeurs
      button = 'X'; type = 'slice'; power = rnd(0.28, 0.42); depth = rnd(2.6, 3.6);
    } else if (r < 0.32) {
      button = 'X'; type = 'slice'; power = rnd(0.35, 0.75); depth = rnd(6.4, 8.2 - m * 0.4);
    }

    // latéral : là où il y a le plus d'espace (en double, souvent "par le milieu")
    const lim = 4.6 - m * 0.6;
    let x = 0, bestGap = -Infinity;
    for (const cx of [-lim, -lim / 2, 0, lim / 2, lim]) {
      const gap = Math.min(...opps.map((o) => Math.abs(o.pos.x - cx))) + Math.random() * 0.9;
      if (gap > bestGap) { bestGap = gap; x = cx; }
    }
    x += rnd(-0.5, 0.5);
    if (Math.random() < 0.15) { const o = opps[Math.floor(Math.random() * opps.length)]; x = o.pos.x + rnd(-0.6, 0.6); } // jouer sur un adversaire
    // adversaire malin : en double, il cible souvent le joueur le plus faible (ou le plus fatigué)
    if (opps.length > 1 && Math.random() < 0.15 + D.aggression * 0.25) {
      const rate = (o) => { const st = o.stats || {}; const v = Object.values(st).filter((n) => typeof n === 'number'); return (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0.5) * (0.6 + 0.4 * (o.energy ?? 1)); };
      const weak = opps.reduce((a, b) => (rate(b) < rate(a) ? b : a));
      if (rate(weak) < rate(opps.find((o) => o !== weak)) - 0.03) x = weak.pos.x + rnd(-0.7, 0.7);
    }
    x = clamp(x, -lim, lim);
    return { button, type, power, target: { x, z: oppSide * depth } };
  }
}
