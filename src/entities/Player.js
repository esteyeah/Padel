// ============================================================================
//  Joueur : déplacement inertiel, préparation / charge de frappe, détection du
//  contact, choix du type de coup, calcul de la qualité et de l'erreur.
//
//  Mécanique de frappe :
//   1. Appui sur un bouton -> le joueur "arme" le coup (préparation).
//      Maintenir = charger la puissance (le joueur ralentit).
//   2. Le contact se déclenche automatiquement quand la balle passe à portée
//      (au point idéal, ou au plus près). Le coup reste armé tant que le bouton
//      est tenu, puis PLAYER.armWindow secondes après relâchement.
//   3. Qualité = placement (distance corps-balle), hauteur, vitesse de course,
//      précipitation. Elle détermine la dispersion autour de la cible visée.
// ============================================================================
import * as THREE from 'three';
import { PLAYER, COURT, SHOTS, ENERGY, VENUE_RULES, flatStats, skillFor, doorAt, clamp, gauss } from '../config.js';
import { planShot, planWallShot } from '../physics/ShotSolver.js';
import { Avatar, SHOULDER_H, ARM_REACH } from './Avatar.js';

export const BUTTONS = ['A', 'X', 'Y', 'B', 'C'];   // C = contre-vitre (A+B ensemble)

/**
 * Cible au sol à partir du stick de visée (pour un joueur humain).
 * @param {object} from  position du joueur : près du filet, le stick latéral vise des angles
 *                       courts vers le grillage latéral (comme dans le vrai jeu).
 */
export function targetFromAim(aim, type, side, serveBox, from = null) {
  const opp = -side;
  if (type === 'serve' && serveBox) {
    const xs = serveBox.xSign;
    let x = xs * 2.5 + aim.x * side * 2.1;
    x = xs > 0 ? clamp(x, 0.35, 4.65) : clamp(x, -4.65, -0.35);
    const d = clamp(4.7 + aim.y * 1.9, 1.5, 6.6);
    return { x, z: opp * d };
  }
  const atNet = from && Math.abs(from.z) < 4.8 && (type === 'volley' || type === 'drive' || type === 'slice' || type === 'smash');
  if (atNet) {
    // au filet : angles plus francs (jusqu'aux couloirs) et plus courts quand on vise sur le côté
    const ax = Math.abs(aim.x);
    const x = clamp(aim.x * side * 4.85, -4.85, 4.85);
    let d = aim.y >= 0 ? 6.2 + aim.y * 2.9 : 6.2 + aim.y * 4.4;
    d -= ax ** 1.4 * (type === 'smash' ? 1.2 : 2.6);
    return { x, z: opp * clamp(d, 1.6, 9.2) };
  }
  const base = { drive: 7.3, volley: 6.8, slice: 7.0, lob: 8.5, bandeja: 7.8, smash: 7.4, wall: 6.8 }[type] ?? 7.2;
  let d;
  if (type === 'drop') d = clamp(2.2 + aim.y * 1.0, 1.2, 3.6);
  else d = aim.y >= 0 ? base + aim.y * (9.3 - base) : base + aim.y * (base - 1.6);
  const x = clamp(aim.x * side * 4.2, -4.5, 4.5);
  return { x, z: opp * d };
}

export class Player {
  /**
   * @param {object} o
   * @param {number} o.side   camp (+1 proche caméra, -1 loin)
   * @param {number} o.lane   rôle en double : +1 côté droit (drive), -1 côté gauche (revés), 0 en simple
   * @param {object} o.appearance  voir Appearance.js
   * @param {object} o.stats  attributs 0..1 : drive, lob, smash, speed, stamina, strength
   * @param {number} o.hand   main directrice : +1 droitier, -1 gaucher
   */
  constructor({ name, side, lane = 0, appearance, stats, scene, isHuman = false, speedMul = 1, hand = 1 }) {
    this.name = name;
    this.side = side;
    this.lane = lane;
    this.hand = hand < 0 ? -1 : 1;
    this.isHuman = isHuman;
    this.stats = { ...flatStats(0.6), ...stats };
    this.speedMul = speedMul;
    this.energy = 1;                // fatigue : 1 = frais, 0 = épuisé
    this.energyCap = 1;             // plafond : baisse avec la fatigue de fond du match
    this.pos = new THREE.Vector3(0, 0, side * 8);
    this.vel = new THREE.Vector3();
    this.aim = { x: 0, y: 0 };      // visée lissée (humain)
    this.armed = null;
    this.swing = null;
    this.prevDist = Infinity;
    this.controller = null;
    this.appearance = appearance;
    this.avatar = new Avatar({ ...appearance, name: appearance?.printName || name, hand: this.hand });
    scene.add(this.avatar.root);
    this.scene = scene;
  }

  dispose() { this.scene.remove(this.avatar.root); }

  maxSpeed() {
    return (PLAYER.baseSpeed + this.stats.speed * PLAYER.speedPerStat) * this.speedMul * (0.62 + 0.38 * this.energy);
  }

  /** La fatigue dépend de l'endurance : un joueur très endurant se fatigue deux fois moins vite. */
  drainScale() { return 1.8 - 1.3 * this.stats.stamina; }
  drain(amount) {
    const d = amount * this.drainScale();
    this.energy = Math.max(0, this.energy - d);
    this.energyCap = Math.max(ENERGY.minCap, this.energyCap - d * ENERGY.longTerm);
  }
  /** Récupération : entre deux points, à un changement de jeu ('game') ou de set ('set'). */
  recover(kind = 'point') {
    if (kind === 'set') { this.energyCap = Math.min(1, this.energyCap + ENERGY.setRest); this.energy = this.energyCap; return; }
    const part = kind === 'game' ? ENERGY.gameRecovery : ENERGY.pointRecovery;
    this.energy = Math.min(this.energyCap, this.energy + Math.max(0, this.energyCap - this.energy) * part + 0.01);
  }

  forward() { return -this.side; } // direction z vers le filet
  handPosition(out) {
    return out.set(this.pos.x + this.side * this.hand * 0.38, 1.3, this.pos.z - this.side * 0.3);
  }

  resetMotion() {
    this.vel.set(0, 0, 0);
    this.armed = null;
    this.swing = null;
    this.prevDist = Infinity;
  }

  arm(button, { auto = false, power = null, target = null, persistent = false, shotType = null, time = 0 } = {}) {
    this.armed = {
      button, start: time, held: !auto, releaseTime: auto ? time : null,
      power: power ?? PLAYER.minPower, fixedPower: power != null,
      target, persistent, shotType, window: auto ? 1.2 : PLAYER.armWindow,
    };
    this.prevDist = Infinity;
  }

  disarm() { this.armed = null; }

  whiff() {
    if (!this.armed) return;
    this.swing = { kind: this.armedKind || 'fore', style: 'drive', t: 0, dur: 0.32, contactRz: 0.4, contactH: 1 };
    this.armed = null;
  }

  // -------------------------------------------------------------------------
  update(dt, intent, g) {
    const now = g.time;

    // --- boutons
    if (intent.pressed) {
      for (const b of BUTTONS) {
        if (!intent.pressed[b]) continue;
        if (g.state === 'serve') {
          if (g.server === this && (b === 'A' || b === 'X')) {
            g.startToss(this);
            this.arm(b, { persistent: true, shotType: 'serve', time: now });
          }
        } else if (g.state === 'rally' || (g.state === 'toss' && g.server !== this)) {
          if (!this.swing || this.swing.t > 0.2) this.arm(b, { time: now });
        }
      }
    }
    const a = this.armed;
    if (a) {
      if (a.held && intent.held && !intent.held[a.button]) { a.held = false; a.releaseTime = now; }
      if (a.held && !a.fixedPower) {
        a.power = Math.min(1, PLAYER.minPower + ((now - a.start) / PLAYER.chargeTime) * (1 - PLAYER.minPower));
      }
      if (!a.held && !a.persistent && now - a.releaseTime > a.window) this.whiff();
      if (g.state === 'pointOver') this.armed = null;
    }

    // --- déplacement inertiel
    let mx = intent.move?.x || 0, mz = intent.move?.z || 0;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    let maxS = this.maxSpeed();
    // petit sprint (clic du stick gauche) : plus rapide, mais l'énergie fond
    this.sprinting = !!(intent.held?.SPRINT && this.energy > 0.12 && (mx || mz) && (g.state === 'rally' || g.state === 'drill'));
    if (this.sprinting) { maxS *= 1.3; this.drain(dt * 0.05); }
    if (this.armed?.held) maxS *= PLAYER.armedSpeedMul; // on ralentit en chargeant
    if (this.swing && this.swing.t < 0.18) maxS *= 0.45;
    if (g.state === 'toss' && g.server === this) maxS = 0;
    const tvx = mx * maxS, tvz = mz * maxS;
    let ax = tvx - this.vel.x, az = tvz - this.vel.z;
    const al = Math.hypot(ax, az);
    const braking = tvx * this.vel.x + tvz * this.vel.z < (this.vel.x ** 2 + this.vel.z ** 2) * 0.6;
    const maxA = (braking ? PLAYER.decel : PLAYER.accel) * dt;
    if (al > maxA) { ax *= maxA / al; az *= maxA / al; }
    this.vel.x += ax; this.vel.z += az;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.constrain(g);

    // fatigue : la course coûte de l'énergie (au carré de l'intensité)
    const intensity = Math.min(1, Math.hypot(this.vel.x, this.vel.z) / (maxS || 1));
    if (g.state === 'rally' || g.state === 'drill') this.drain(dt * intensity * intensity * ENERGY.runDrain * (g.drainMul || 1));

    if (this.swing) {
      this.swing.t += dt;
      if (this.swing.t >= this.swing.dur) this.swing = null;
    }
  }

  /** Le joueur est-il sorti de la piste (par une porte) ? */
  isOutside() { return Math.abs(this.pos.x) > COURT.halfW; }

  constrain(g) {
    const s = this.side, hw = COURT.halfW, OUT = 4.2;
    let zMin = PLAYER.netMargin, zMax = COURT.halfL - PLAYER.wallMargin;
    let xMin = -(hw - PLAYER.wallMargin), xMax = hw - PLAYER.wallMargin;
    if (g.state === 'serve' && g.server === this) {
      zMin = COURT.serviceLine + 0.4;
      if (g.serveX > 0) xMin = 0.3; else xMax = -0.3;
    } else if (VENUE_RULES.outside && g.state === 'rally') {
      // sortie possible uniquement par une porte (étroite), dans sa moitié de terrain
      for (const sx of [-1, 1]) {
        const door = doorAt(sx, this.pos.z, 0, 0.28);
        const outside = this.pos.x * sx > hw;
        if (door && this.pos.z * s > -0.05) {
          if (sx > 0) xMax = hw + OUT; else xMin = -(hw + OUT);
        } else if (outside) {
          // dehors : on longe le grillage sans pouvoir le traverser
          if (sx > 0) { xMin = hw + 0.3; xMax = hw + OUT; } else { xMax = -(hw + 0.3); xMin = -(hw + OUT); }
          zMax = COURT.halfL + 1.5;
        }
      }
    }
    const zz = this.pos.z * s;
    if (zz < zMin) { this.pos.z = zMin * s; this.vel.z = 0; }
    if (zz > zMax) { this.pos.z = zMax * s; this.vel.z = 0; }
    if (this.pos.x < xMin) { this.pos.x = xMin; this.vel.x = 0; }
    if (this.pos.x > xMax) { this.pos.x = xMax; this.vel.x = 0; }
  }

  // -------------------------------------------------------------------------
  /** Appelé à chaque pas physique : déclenche la frappe si les conditions sont réunies. */
  tryContact(ball, g) {
    const a = this.armed;
    if (!a || !g.canHit(this)) { this.prevDist = Infinity; return null; }
    const bp = ball.state.p;
    const dx = bp.x - this.pos.x, dz = bp.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const h = bp.y;
    const overheadOk = a.button === 'Y' || a.shotType === 'smash' || a.shotType === 'bandeja';
    // saut : permet d'aller chercher une balle plus haute (surtout au filet)
    const jumpGain = overheadOk ? 0.45 : Math.abs(this.pos.z) < 5 ? 0.65 : 0.5;
    const maxH = (overheadOk ? PLAYER.maxHOverhead : PLAYER.maxH) + jumpGain;
    this._baseMaxH = maxH - jumpGain;
    const reach = PLAYER.reach + skillFor(this.stats, 'volley') * 0.08;
    if (dist > reach || h < PLAYER.minH || h > maxH) { this.prevDist = Infinity; return null; }

    let go;
    if (g.state === 'toss') go = true;
    else {
      go = dist <= PLAYER.idealDist
        || dist > this.prevDist + 1e-4                  // la balle s'éloigne : maintenant ou jamais
        || (h < 0.16 && ball.state.v.y < 0);            // sur le point de rebondir
    }
    this.prevDist = dist;
    if (!go) return null;
    return this.hit(ball, g, dist, h);
  }

  resolveType(g, h) {
    const a = this.armed;
    const bounced = g.referee.bounces > 0;
    const nearNet = Math.abs(this.pos.z) < 5;
    const groundOrVolley = !bounced && nearNet ? 'volley' : 'drive';
    if (a.shotType && this.isOutside()) return 'lob';
    if (a.shotType) {
      if ((a.shotType === 'smash' || a.shotType === 'bandeja') && h < 1.4) return groundOrVolley;
      if (a.shotType === 'drive' && !bounced && nearNet) return 'volley';
      return a.shotType;
    }
    if (this.isOutside()) return 'lob';            // depuis l'extérieur : renvoi en lob par-dessus le grillage
    switch (a.button) {
      case 'C': return 'wall';
      case 'X': return this.aim.y < -0.55 ? 'drop' : 'slice';
      case 'B': return 'lob';
      case 'Y':
        if (h >= 1.45) return a.power >= 0.7 ? 'smash' : 'bandeja';
        a.power = Math.max(a.power, 0.85); // frappe à plat appuyée
        return groundOrVolley;
      default: return groundOrVolley;
    }
  }

  hit(ball, g, dist, h) {
    const a = this.armed;
    const type = g.state === 'toss' ? 'serve' : this.resolveType(g, h);
    const power = a.power;
    const st = ball.state;

    // ---- qualité du coup
    let q = 1 - Math.min(1, Math.abs(dist - PLAYER.idealDist) / 0.6) * 0.55;
    const over = type === 'smash' || type === 'bandeja';
    if (!over && type !== 'serve') {
      if (h < 0.3) q -= (0.3 - h) * 1.3;
      if (h > 1.6) q -= (h - 1.6) * 0.45;
    }
    if (over && h < 2.0) q -= (2.0 - h) * 0.35;
    const runSpeed = Math.hypot(this.vel.x, this.vel.z);
    q -= Math.min(0.2, (runSpeed / this.maxSpeed()) * 0.2);
    q -= clamp((st.v.length() - 16) / 40, 0, 0.25);          // balle rapide = plus dur
    if (g.time - a.start < 0.05 && type !== 'serve') q -= 0.15; // frappe précipitée
    // main directrice : le revers est un peu moins sûr, et un coup au-dessus de la tête
    // pris côté revers est nettement plus difficile (d'où l'intérêt du gaucher à droite)
    const local = (st.p.x - this.pos.x) * this.side * this.hand;
    const backhand = local < -0.15;
    if (backhand && type !== 'serve') q -= over ? 0.18 : 0.05;
    const skill = skillFor(this.stats, type);
    if (type === 'volley') q += (skill - 0.5) * 0.25;
    if (type === 'serve') q = Math.max(q, 0.75);
    q = clamp(q, 0.05, 1);

    // ---- cible + dispersion
    let target = a.target
      ? { ...a.target }
      : targetFromAim(this.aim, type, this.side, g.referee.serveBox, this.pos);
    if (this.isOutside()) target = { x: clamp(target.x, -3, 3), z: -this.side * clamp(Math.abs(target.z), 5.5, 8.5) };
    if (type === 'wall') q -= 0.12;                        // contre-vitre : geste difficile
    const prec = skill;
    const consistency = Math.min(1, skill * 0.9 + (this.isHuman ? 0.3 : 0));
    const tired = 1 - this.energy;
    const sigma = (0.22 + (1 - q) * 1.3) * (0.5 + power * 0.8) * (1.3 - prec * 0.85) * (1 + tired * 1.2);
    const thetaErr = gauss() * 0.025 * (1 - q * 0.7) * (0.5 + power);
    // faute franche : probabilité liée à la qualité du coup et à la prise de risque
    const pMiss = type === 'serve' ? 0.02 + power * 0.04 * (1 - prec)
      : 0.01 + (1 - consistency) * 0.12 + (1 - q) * 0.22 + (1 - prec) * 0.06 * power + tired * 0.12;
    const miss = Math.random() < pMiss;
    let fault = null;
    if (miss) {
      // faute directe : filet, trop long (vitre/grillage direct) ou trop large
      const r = Math.random();
      const opp = -this.side;
      if (r < 0.45) fault = 'net';
      else if (r < 0.8) target.z = opp * (10.3 + Math.random() * 1.2);
      else target.x = (Math.random() < 0.5 ? -1 : 1) * (5.25 + Math.random() * 0.8);
    } else {
      target.x += gauss() * sigma;
      target.z += gauss() * sigma * 1.3;
      if (target.z * -this.side < 0.4) target.z = -this.side * 0.4;
    }

    // puissance : surtout la force, un peu la technique du coup ; la fatigue la réduit
    const powerStat = 0.55 * this.stats.strength + 0.45 * skill;
    const speedMul = (0.85 + powerStat * 0.3) * (0.78 + 0.22 * this.energy) * (this.stats.power || 1);
    let plan;
    if (type === 'wall') {
      if (fault) target.x += (Math.random() < 0.5 ? -1 : 1) * 4;  // contre-vitre raté : part sur le côté
      plan = planWallShot(st.p, target, power, this.side, speedMul);
    } else plan = planShot(st.p, target, type, power, speedMul, thetaErr, fault);
    st.v.copy(plan.v);
    st.w.copy(plan.w);
    st.rolling = false;
    // force : une balle "lourde" ressort plus vivement de la vitre
    st.boost = type === 'lob' || type === 'drop' ? 0 : (this.stats.strength - 0.5) * 0.14;
    this.drain(ENERGY.hitDrain * (0.5 + power));

    // ---- animation
    const kind = over || (type === 'volley' && h > 1.75) ? 'over' : backhand ? 'back' : 'fore';
    const style = type === 'lob' || type === 'wall' ? 'lob' : (type === 'slice' || type === 'drop' || type === 'bandeja') ? 'slice' : 'drive';
    const contactRz = Math.asin(clamp((SHOULDER_H * (this.appearance?.height || 1) - 0.06 - h) / ARM_REACH, -1, 1));
    // saut seulement si la balle est au-dessus de ce que le joueur atteint debout
    const jump = h > (this._baseMaxH ?? 9) + 0.02 ? Math.min(0.55, h - this._baseMaxH + 0.12) : 0;
    this.swing = { kind, style, t: 0, dur: 0.34, contactRz, contactH: h, contactPos: st.p.clone(), jump };
    this.armed = null;
    this.prevDist = Infinity;

    const info = { type, label: SHOTS[type].label, power, quality: q, speed: plan.speed, target, miss, solved: plan.ok, clear: plan.clear };
    g.onHit(this, type, info);
    return info;
  }

  // -------------------------------------------------------------------------
  /** Abscisse de base du joueur en double (moitié droite ou gauche de son camp). */
  laneX() { return this.side * this.lane * 2.4; }

  updateVisual(dt, g) {
    const bp = g.ball.state.p;
    const s = this.side;
    // orientation : vers le filet, tournée vers la balle quand elle est dans notre camp
    let fx = 0, fz = -s;
    const live = g.state === 'rally' || g.state === 'toss';
    if (bp.z * s > 0 && (live || this.armed)) {
      const dx = bp.x - this.pos.x, dz = bp.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      fx = fx * 0.55 + (dx / d) * 0.45;
      fz = fz * 0.55 + (dz / d) * 0.45;
    }
    let armedKind = null;
    if (this.armed) {
      const local = (bp.x - this.pos.x) * s * this.hand;
      armedKind = (this.armed.button === 'Y' && bp.y > 1.4) || this.armed.shotType === 'smash' ? 'over' : local > -0.15 ? 'fore' : 'back';
      if (this.armed.shotType === 'serve') armedKind = 'fore';
    }
    this.armedKind = armedKind;
    // on reste tourné vers le filet : au plus 60° de rotation vers la balle (la tête fait le reste)
    const netYaw = Math.atan2(0, -s);
    let rel = Math.atan2(fx, fz) - netYaw;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    const yaw = netYaw + Math.max(-1.05, Math.min(1.05, rel));
    // vitesse dans le repère du joueur (avant / latéral) pour la démarche
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const fwd = this.vel.x * sn + this.vel.z * c;
    const side = this.vel.x * c - this.vel.z * sn;
    // direction de la balle par rapport au regard (pour la tête)
    const look = Math.atan2(bp.x - this.pos.x, bp.z - this.pos.z) - yaw;
    this.avatar.root.position.x = this.pos.x;
    this.avatar.root.position.z = this.pos.z;
    this.avatar.animate(dt, {
      speed: Math.hypot(this.vel.x, this.vel.z),
      fwd, side: side * this.hand, yaw,
      look: Math.atan2(Math.sin(look), Math.cos(look)) * this.hand,
      ready: live,
      armed: this.armed ? { kind: armedKind, charge: this.armed.power } : null,
      swing: this.swing,
    });
  }
}
