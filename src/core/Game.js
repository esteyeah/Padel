// ============================================================================
//  Game : boucle à pas fixe (240 Hz), machine d'états du match, liaison
//  physique <-> arbitre <-> score <-> rendu/HUD/son.
//
//  États : 'serve' (attente du serveur) -> 'toss' (balle lâchée) -> 'rally'
//          -> 'pointOver' (pause) -> 'serve' ... -> 'matchOver'
//
//  Architecture "prête pour le réseau" : la simulation (step) ne dépend que des
//  intentions des contrôleurs ; le rendu (frame) est séparé.
// ============================================================================
import * as THREE from 'three';
import { FIXED_DT, COURT, DIFFICULTY, PROFILES, flatStats, clamp } from '../config.js';
import { Ball } from '../entities/Ball.js';
import { Player, targetFromAim } from '../entities/Player.js';
import { Avatar } from '../entities/Avatar.js';
import { ReplayRecorder, ReplayPlayer } from './Replay.js';
import { makeAppearance, resolveLook, KITS } from '../entities/Appearance.js';
import { HumanController } from '../controllers/HumanController.js';
import { BotController } from '../controllers/BotController.js';
import { Referee } from './Referee.js';
import { Score } from './Score.js';
import { CameraRig } from '../render/CameraRig.js';
import { Effects } from '../render/Effects.js';
import { simulate } from '../physics/BallPhysics.js';
import { planShot } from '../physics/ShotSolver.js';
import { createDrill } from './Drills.js';
import { NetHost, NetClient, RemoteController, PUPPET } from '../net/NetMatch.js';
import { makeTrophy } from '../entities/Trophy.js';


export class Game {
  constructor({ r3d, input, hud, sfx }) {
    this.r3d = r3d;
    this.scene = r3d.scene;
    this.input = input;
    this.hud = hud;
    this.sfx = sfx;
    this.ball = new Ball(this.scene);
    this.effects = new Effects(this.scene);
    this.cameraRig = new CameraRig(r3d.camera);
    this.referee = new Referee();
    this.players = [];
    this.state = 'idle';
    this.time = 0;
    this.acc = 0;
    this.paused = false;
    this.onExit = null;
    this.recorder = new ReplayRecorder();
    this._v = new THREE.Vector3();
    this.emit = (e) => this.handleBallEvent(e);
  }

  // =========================================================================
  //  Démarrage / arrêt
  // =========================================================================
  /**
   * Lance un match.
   * Match rapide / démo : les équipes sont composées d'après les options du menu.
   * Carrière : `opts.lineup` fournit les fiches { near:[...], far:[...] } ; chaque fiche vaut
   *   { name, human?, hand, lane, stats, appearance, bot:{diff, profile} }.
   *   `opts.onEnd(result)` est appelé à la fin du match (ou à l'abandon).
   */
  start(opts) {
    this.setShowcase(null, true);
    for (const p of this.players) p.dispose();
    this.drill?.dispose();
    this.drill = null;
    this.netLink?.dispose(); this.netLink = null;
    this.drainMul = 1;
    this.opts = { mode: 'quick', format: '2v2', lane: -1, difficulty: 'medium', profile: 'baseline', sets: 1, gamesPerSet: 6, golden: true, matchTiebreak: 0, ...opts };
    const o = this.opts;
    // terrain, ambiance et sac du joueur
    const arena = this.r3d.arena;
    if (o.venue) arena.setVenue(o.venue, o.court || 0, o.club || null);
    if (!this.attract) arena.refreshWear();
    this.cameraRig.indoor = !!arena.venue?.def.indoor;
    if (o.ambiance) arena.setAmbiance(o.ambiance);
    arena.setBag(o.bag && o.bag.id !== 'none' ? Avatar.makeBag(o.bag) : null);
    // ambiance sonore : musique de fête de village dans les petits clubs, foule dans les stades
    const big = ['national', 'pro', 'beach'].includes(arena.venue?.id);
    // l'orchestre vient à certaines parties seulement ; quand il est là, il joue tout du long
    // concerts : rares en temps normal (2 % orchestre, 8 % DJ à Ceyreste), bien plus fréquents
    // dans les gros tournois (selon la réputation du tournoi, 0..1)
    const rep = o.reputation ?? 0, cey = arena.venue?.id === 'ceyreste';
    let party = o.party, sono = o.sono;
    if (party === undefined) {
      const r = Math.random(), pBand = 0.02 + 0.3 * rep, pDJ = cey ? 0.08 + 0.4 * rep : 0;
      party = !o.attract && !big && r < pBand + pDJ;
      sono = party && cey && r >= pBand;
    }
    sono = !!sono;
    this.partyFlags = { party, sono };
    arena.setParty(party || !!o.attract, sono);
    const indoor = !!arena.venue?.def.indoor;
    if (indoor) arena.setParty(false);
    this.sfx.setAmbience(o.attract ? null : indoor ? 'electro' : big ? 'stadium' : sono ? 'sono' : party ? 'village' : null);
    this.attract = !!o.attract;
    this.career = o.mode === 'career' || !!o.drill;
    const lineup = o.lineup || this.quickLineup(o);

    const make = (spec, side) => {
      const p = new Player({
        name: spec.name, side, lane: spec.lane ?? 0, hand: spec.hand ?? 1, appearance: spec.appearance, scene: this.scene,
        isHuman: !!spec.human, stats: spec.stats, speedMul: spec.human ? 1 : (spec.bot?.diff.speedMul ?? 1),
      });
      p.controller = spec.human ? new HumanController(p, this.input)
        : spec.remote ? new RemoteController(p, spec.remote)
        : spec.puppet ? PUPPET
        : spec.idle ? { capture() {}, getIntent: () => ({ move: { x: 0, z: 0 } }) }
          : new BotController(p, this, spec.bot.profile, spec.bot.diff);
      return p;
    };
    const near = lineup.near.map((sp) => make(sp, 1));
    const far = lineup.far.map((sp) => make(sp, -1));
    this.teams = { 1: near, [-1]: far };
    this.players = [...near, ...far];
    this.doubles = near.length > 1;
    this.human = this.players.find((p) => p.isHuman) || null;

    this.score = new Score({ sets: o.sets, gamesPerSet: o.gamesPerSet, goldenPoint: o.golden, matchTiebreak: o.matchTiebreak, firstServer: o.firstServer ?? (Math.random() < 0.5 ? 1 : -1) });
    // match pris en cours (aventure : on arrive en fin de match)
    if (o.startPoints) this.score.points = [...o.startPoints];
    if (o.sudden) this.score.sudden = true;
    this._midDone = false;
    this.knownTurn = -1;
    this.teamTurns = { 1: 0, [-1]: 0 };
    this.hitId = 0;
    this.taker = null;
    this.lastShot = null;
    this.time = 0; this.acc = 0; this.paused = false;
    this.rallyHits = 0;
    this._said = {};
    this.tally = { points: [0, 0], longestRally: 0 };
    // statistiques du joueur humain (missions)
    this.stats = { winners: {}, aces: 0, doubleFaults: 0, netWinners: 0, glassWinners: 0, porTres: 0, porCuatro: 0, porTresOnly: 0, door: 0, deepLobs: 0, drops: 0, volleysIn: 0, outsideWinners: 0, returnsWon: 0, serveGames: 0, breaks: 0, firstServesIn: 0, streak: 0, bestStreak: 0, wallShots: 0, wallSuccess: 0, outsideReturns: 0, maxRallyWon: 0, pointsWon: 0, pointsLost: 0 };
    this.mission = o.mission || null;
    this.ownGlass = false;
    this.humanShot = null;
    this.hud.setMission(this.mission ? this.missionText() : '');
    this.hud.setDrill(null);
    this.hud.show(!this.attract);
    this.hud.hidePause();
    this.hud.hideEnd();
    this.hud.hint('');
    this.hud.setTeams({ 1: this.teamName(1), [-1]: this.teamName(-1) });
    this.hud.updateScore(this.score);
    this.clearActors();
    this.slowmo = 0;
    this.hud.dialog(null); this.hud.hideSpeech?.(); document.body.classList.remove('cinema');
    this.recorder.clear(); this.tvReplay = null; this.replayAt = null; this.highlights = []; this.recap = null; this._endScene = false; this._trophyDone = false; this.endCeremony?.(true);
    document.body.classList.remove('cinema'); this.hud.replayBadge?.(false);
    this.cutscene = !this.attract && o.cutscene?.length ? { lines: o.cutscene, i: -1, t: 0 } : null;
    // figurants des cinématiques (ex. le maire), retirés à la fin de la scène
    if (this.cutscene && o.actors) {
      this.actors = o.actors.map((ac) => {
        const avatar = new Avatar({ ...ac.appearance });
        avatar.racket.visible = false;
        avatar.root.position.set(ac.x, 0, ac.z);
        this.scene.add(avatar.root);
        return { id: ac.id, avatar, side: ac.side, pos: avatar.root.position, name: ac.id };
      });
    }
    // spectateurs au bord du court (aventure : on regarde le match de ses amis)
    for (const sp of this.spectators || []) this.scene.remove(sp.root);
    for (const pr of this._advProps || []) this.scene.remove(pr);
    this._advProps = [];
    this.spectators = (o.spectators || []).map((ap, i) => {
      const av = new Avatar({ ...ap }); av.racket.visible = false;
      av.root.position.set(-(COURT.halfW + 1.4), 0, -1 + i * 1.1); this.scene.add(av.root);
      return av;
    });
    o.onStarted?.(this);
    if (this.cutscene) { this.nextLine(); document.body.classList.add('cinema'); }
    // match en ligne : l'hôte simule et diffuse, l'invité affiche ce qu'il reçoit
    if (o.net) this.netLink = o.net.role === 'host' ? new NetHost(this, o.net) : new NetClient(this, o.net);
    if (o.net?.role === 'client') {
      this.server = null;
      if (!this.attract) this.hud.banner(o.title || 'MATCH EN LIGNE', `${this.teamName(1)}  vs  ${this.teamName(-1)}`, 2.6);
      return;
    }
    if (o.drill) {
      this.drill = createDrill(this, o.drill);
      this.hud.setDrill(this.drill.hud());
      this.drill.setup();
      this.hud.banner('ENTRAÎNEMENT', this.drill.def.desc, 3.2);
      return;
    }
    this.setupServe(1);
    if (!this.attract) this.hud.banner(o.title || 'MATCH', o.subtitle ? `${o.subtitle} · ${this.teamName(1)} vs ${this.teamName(-1)}` : `${this.teamName(1)}  vs  ${this.teamName(-1)}`, 2.6);
  }

  /** Fiches des joueurs pour le match rapide, la démo et le fond du menu. */
  quickLineup(o) {
    const demo = o.mode === 'demo' || this.attract;
    const doubles = o.format !== '1v1';
    const diff = DIFFICULTY[o.difficulty] || DIFFICULTY.medium;
    let kits = ['blue', 'red'];
    if (this.attract) kits = ['blue', 'red', 'green', 'black', 'orange'].sort(() => Math.random() - 0.5).slice(0, 2);
    const used = new Set();
    let seed = (Math.random() * 1e9) | 0;
    const appearance = (kit, over = {}) => {
      let a;
      do { a = makeAppearance(kit, seed++, over); } while (used.has(a.name) && !over.name);
      used.add(a.name);
      return a;
    };
    const humanLane = doubles ? (o.lane === 1 ? 1 : -1) : 0;
    const spec = (side, lane, human, profileKey) => {
      const isHuman = human && !demo;
      let app = appearance(kits[side > 0 ? 0 : 1], isHuman ? { name: (o.playerName || 'JOUEUR').toUpperCase(), number: 10 } : {});
      // exhibition : le joueur garde l'apparence de sa carrière (s'il en a une)
      if (isHuman && o.playerLook) app = { ...resolveLook(o.playerLook), name: (o.playerName || 'JOUEUR').toUpperCase() };
      if (isHuman && o.playerAppearance) app = { ...o.playerAppearance, name: (o.playerName || 'JOUEUR').toUpperCase() };
      return {
        name: isHuman ? 'VOUS' : app.name, human: isHuman, lane, hand: isHuman ? (o.playerHand ?? 1) : 1, appearance: app,
        stats: isHuman ? (o.playerStats || flatStats(0.62)) : flatStats(diff.level, { speed: Math.max(0.6, diff.level) }),
        bot: { diff, profile: PROFILES[profileKey] || PROFILES.baseline },
      };
    };
    const nearProfile = this.attract ? 'varied' : (o.partner || 'attacker');
    const near = [spec(1, humanLane, true, nearProfile)];
    if (doubles) near.push(spec(1, -humanLane, false, nearProfile));
    const far = doubles ? [spec(-1, 1, false, o.profile), spec(-1, -1, false, o.profile)] : [spec(-1, 0, false, o.profile)];
    // exhibition : partenaire et adversaires choisis parmi les personnages
    if (o.pick?.mate && doubles) near[1] = { ...o.pick.mate, lane: -humanLane };
    (o.pick?.opps || []).forEach((sp, i) => { if (sp && far[i]) far[i] = { ...sp, lane: far[i].lane }; });
    return { near, far };
  }

  /**
   * Vitrine : affiche un personnage seul face à la caméra (éditeur de la carrière).
   * @param {object|null} look  apparence complète (voir Appearance.js) ou null pour quitter
   */
  setShowcase(look, silent = false) {
    if (this.showcase) {
      this.scene.remove(this.showcase.avatar.root);
      this.showcase.extra?.parent?.remove(this.showcase.extra);
      this.showcase = null;
    }
    if (!look) {
      this.ball.setVisible(true);
      if (!silent && this.state === 'showcase') this.start({ attract: true, difficulty: 'hard', ambiance: this.opts?.ambiance });
      return;
    }
    for (const p of this.players) p.dispose();
    this.players = [];
    this.human = null;
    this.state = 'showcase';
    this.attract = true;
    this.hud.show(false);
    this.ball.setVisible(false);
    this.effects.setLanding(null);
    const avatar = new Avatar(look);
    avatar.root.position.set(0.9, 0, 6.2);
    this.scene.add(avatar.root);
    this.showcase = { avatar, t: 0 };
  }

  exitToMenu() {
    this.paused = false;
    this.hud.hidePause();
    this.hud.hideEnd();
    this.start({ attract: true, difficulty: 'hard', ambiance: this.opts?.ambiance });
    this.onExit && this.onExit();
  }

  /** Fin d'un match de carrière : on rend la main à l'interface de carrière. */
  finishCareer(forfeit = false, quit = false) {
    const o = this.opts;
    if (quit) {
      // on quitte sans abandonner : rien n'est enregistré, le match pourra être rejoué
      this.paused = false; this.hud.hidePause(); this.hud.hideEnd();
      this.start({ attract: true, difficulty: 'hard', ambiance: o.ambiance });
      o.onQuit ? o.onQuit() : o.onEnd?.({ quit: true });
      return;
    }
    const side = this.human?.side ?? 1;
    const sc = this.score;
    const result = this.drill ? { ...this.drill.result(), forfeit } : {
      won: !forfeit && sc.winner === side,
      forfeit,
      score: forfeit ? 'abandon' : sc.history.map((g) => `${g[0]}-${g[1]}`).join(' '),
      points: this.tally.points, longestRally: this.tally.longestRally,
      stats: { ...this.stats, won: !forfeit && sc.winner === side, gamesLost: sc.history.reduce((s, g) => s + g[1], 0) + sc.games[1] },
    };
    if (forfeit && this.drill) result.medal = 0;
    this.paused = false;
    this.hud.hidePause();
    this.hud.hideEnd();
    this.start({ attract: true, difficulty: 'hard', ambiance: o.ambiance });
    o.onEnd?.(result);
  }

  // =========================================================================
  //  Entraînements : machine à balles et enchaînement des exercices
  // =========================================================================
  /** Envoie une balle depuis le camp adverse (machine ou coach). */
  feedBall({ from, target, type = 'drive', power = 0.5, vel = null }) {
    const st = this.ball.state;
    this.ball.release(new THREE.Vector3(...from));
    // vitesse imposée (balle de machine) ou frappe calculée vers une cible
    const plan = vel ? { v: new THREE.Vector3(...vel), w: new THREE.Vector3(), speed: Math.hypot(...vel) } : planShot(st.p, target, type, power);
    st.v.copy(plan.v); st.w.copy(plan.w);
    const machine = { side: -1, name: 'Machine', isMachine: true };
    this.referee.reset();
    this.referee.onHit(machine, type);
    this.state = 'rally';
    this.lastHitTime = this.time;
    this.rallyHits = 0;
    this.hitId++;
    this.taker = null;
    this.lastShot = { side: -1, type, player: machine };
    this.sfx.hit(plan.speed);
    for (const p of this.players) p.controller.onBallHit?.(machine);
    if (this.human) this.predictLanding(this.human.side);
  }

  drillPause(delay) { this.afterPoint('drill', delay); }

  drillFlash(text, color) { this.hud.banner(text, '', 0.9, color); }

  endDrill() {
    this.state = 'matchOver';
    this.endTime = this.time;
    const r = this.drill.result();
    this.hud.showDrillEnd(r);
  }

  missionText() {
    const m = this.mission;
    return m ? `Mission : ${m.text} (${Math.min(m.metric(this.statsSnapshot()), m.target)}/${m.target})` : '';
  }
  statsSnapshot() {
    const sc = this.score;
    return { ...this.stats, won: sc.winner === (this.human?.side ?? 1), gamesLost: sc.history.reduce((s, g) => s + g[1], 0) + sc.games[1] };
  }

  teamName(side) { return this.teams[side].map((p) => p.name).join(' · '); }
  partnerOf(p) { return this.teams[p.side].find((q) => q !== p) || null; }
  opponentsOf(p) { return this.teams[-p.side]; }
  /** Adversaire le plus proche de la balle (simple : l'unique adversaire). */
  opponentOf(p) {
    const b = this.ball.state.p;
    return this.opponentsOf(p).reduce((a, q) => (Math.hypot(q.pos.x - b.x, q.pos.z - b.z) < Math.hypot(a.pos.x - b.x, a.pos.z - b.z) ? q : a));
  }

  // =========================================================================
  //  Service
  // =========================================================================
  setupServe(serveNumber) {
    this.serveNumber = serveNumber;
    const s = this.score.server, r = -s;
    // rotation du serveur : à chaque tour de service d'une équipe, l'autre partenaire sert
    if (this.score.turn !== this.knownTurn) {
      this.knownTurn = this.score.turn;
      this.teamTurns[s]++;
    }
    const team = this.teams[s];
    this.server = team[(this.teamTurns[s] - 1) % team.length];
    const deuce = this.score.deuceSide();
    this.serveX = s * (deuce ? 1 : -1) * 2.3;
    const boxX = -Math.sign(this.serveX);
    // receveur : le joueur adverse placé sur la moitié du carré visé
    const recvTeam = this.teams[r];
    this.receiver = recvTeam.length === 1 ? recvTeam[0] : recvTeam.find((p) => Math.sign(p.laneX()) === boxX) || recvTeam[0];

    this.servePos = new Map();
    this.servePos.set(this.server, { x: this.serveX, z: s * 8.4 });
    this.servePos.set(this.receiver, { x: -this.serveX * 1.05, z: r * 8.6 });
    const sp = this.partnerOf(this.server), rp = this.partnerOf(this.receiver);
    if (sp) this.servePos.set(sp, { x: -this.serveX * 1.05, z: s * 3.3 });   // partenaire du serveur au filet
    if (rp) this.servePos.set(rp, { x: this.serveX * 1.05, z: r * 6.9 });    // partenaire du receveur vers la ligne de service
    for (const p of this.players) {
      p.resetMotion();
      const pos = this.servePos.get(p);
      p.pos.set(pos.x, 0, pos.z);
      if (serveNumber === 1) p.recover('point');
    }

    this.referee.prepareServe({ xSign: boxX, zSign: r, serverSide: s });
    this.ball.holdAt(this.server.handPosition(this._v));
    this.state = 'serve';
    this.lastHitTime = this.time;
    this.rallyHits = 0;
    this.hitId++;
    this.taker = null;
    this.lastShot = null;
    this.effects.setLanding(null);
    for (const p of this.players) p.controller.onBallHit?.(null);

    const h = this.human;
    if (h) {
      const nth = serveNumber === 2 ? ' · 2e balle' : '';
      if (this.server === h) {
        const L = this.input.labels();
        this.hud.hint(`Service : ${L.A} (maintenir = puissance) · visée ${L.aim}${nth}`);
      } else if (this.receiver === h) this.hud.hint(`Retour de service : laissez rebondir !${nth}`);
      else if (this.server.side === h.side) this.hud.hint(`${this.server.name} sert${nth}`);
      else this.hud.hint(`${this.receiver.name} reçoit le service${nth}`);
    }
    if (this.score.isGoldenPoint() && serveNumber === 1 && !this.attract) this.hud.banner('POINT EN OR', 'Le prochain point décide du jeu', 1.6);
  }

  receivePos(p) { return this.servePos?.get(p) || { x: p.laneX(), z: p.side * 8.4 }; }

  startToss(p) {
    if (this.state !== 'serve' || p !== this.server) return;
    const hand = p.handPosition(this._v);
    this.ball.release(hand);
    this.state = 'toss';
    this.tossTime = this.time;
    this.tossBounced = false;
    this.hud.hint('');
  }

  // =========================================================================
  //  Règles d'interaction joueur / balle
  // =========================================================================
  canHit(p) {
    const st = this.ball.state;
    if (this.state === 'toss') return p === this.server && this.tossBounced && st.v.y <= 0.05;
    if (this.state !== 'rally') return false;
    const ref = this.referee;
    if (ref.lastHitterSide === p.side) return false;
    if (!ref.crossed) return false;
    if (st.p.z * p.side < -0.05) return false;
    if (ref.isServe && ref.bounces === 0) return false; // retour de service : rebond obligatoire
    if (ref.isServe && p !== this.receiver) return false; // seul le receveur désigné retourne le service
    if (st.stopped) return false;
    if (st.escaped && !ref.outside) return false;
    return true;
  }

  onHit(player, type, info) {
    this.referee.onHit(player, type);
    if (player === this.human) {
      this.humanShot = { type, atNet: Math.abs(player.pos.z) < 4.6, afterGlass: this.ownGlass, outside: player.isOutside(), wallLanded: false };
      if (type === 'wall') this.stats.wallShots++;
      if (this.humanShot.outside) this.stats.outsideReturns++;
    }
    this.ownGlass = false;
    this.drill?.onHit(player, type, info);
    if (this.state === 'toss') this.state = 'rally';
    this.lastHitTime = this.time;
    this.rallyHits++;
    this.hitId++;
    this.taker = null;
    this.lastShot = { side: player.side, type, player };
    this._lastSpeed = this.ball.state.v.length();
    this._lastHitT = this.recorder.t;
    this.sfx.hit(info.speed);
    this.hud.shotInfo(`${player.name} · ${info.label}${info.speed ? ` · ${Math.round(info.speed * 3.6)} km/h` : ''}`, player.side);
    if (player === this.human) {
      this.input.rumble(0.25 + info.power * 0.5, 0.5, 60 + info.power * 60);
      this.effects.setLanding(null);
    }
    if (type === 'smash' && info.speed > 27) this.cameraRig.kick(0.12 + info.power * 0.12);
    for (const p of this.players) p.controller.onBallHit?.(player);
    for (const p of this.players) if (p.side !== player.side) p.avatar.splitStep?.();
    if (this.human && player !== this.human) this.predictLanding(this.human.side);
  }

  /** Rebond prévu dans le camp `side` (aide visuelle discrète). */
  predictLanding(side) {
    let found = null;
    simulate(this.ball.state, 3, 1 / 120, (s, t, evs) => {
      for (const e of evs) {
        if (e.type === 'floor') { if (e.side === side) found = e; return false; }
        if (e.type === 'net' || e.type === 'out') return false;
      }
    });
    this.effects.setLanding(found);
  }

  /** Son et effets visuels d'un rebond (aussi rejoués chez les invités en ligne). */
  ballFx(e) {
    switch (e.type) {
      case 'floor':
        if (!e.roll) { this.sfx.floor(e.speed); this.ball.onImpact(e); this.effects.puff(e, Math.min(1, e.speed / 18), { beach: 0xe4d2a8, ceyreste: 0xc9a27a }[this.r3d?.arena?.venue?.id] ?? 0xcdbb98); }
        break;
      case 'glass': this.sfx.glass(e.speed); this.ball.onImpact(e); this.effects.impact(e, Math.min(1, e.speed / 20)); break;
      case 'mesh': this.sfx.mesh(e.speed); this.ball.onImpact(e); break;
      case 'net': case 'netcord': this.sfx.net(); break;
    }
  }

  /** Quitte un match en ligne (fin de match ou abandon). */
  leaveOnline() {
    const cb = this.opts.onLeave;
    this.netLink?.dispose(); this.netLink = null;
    this.hud.hideEnd(); this.hud.hidePause();
    this.start({ attract: true, difficulty: 'hard', ambiance: this.opts?.ambiance });
    cb?.();
  }

  handleBallEvent(e) {
    if (this.netLink?.role === 'host') this.netLink.ballEvent(e);
    switch (e.type) {
      case 'floor':
        if (!e.roll) { this.sfx.floor(e.speed); this.ball.onImpact(e); this.effects.puff(e, Math.min(1, e.speed / 18), { beach: 0xe4d2a8, ceyreste: 0xc9a27a }[this.r3d?.arena?.venue?.id] ?? 0xcdbb98); }
        if (this.human && e.side === this.human.side) this.effects.setLanding(null);
        break;
      case 'glass':
        this.sfx.glass(e.speed); this.ball.onImpact(e);
        this.effects.impact(e, Math.min(1, e.speed / 20));
        break;
      case 'mesh':
        this.sfx.mesh(e.speed); this.ball.onImpact(e);
        break;
      case 'net': case 'netcord':
        this.sfx.net();
        break;
    }
    for (const p of this.players) p.controller.onBallEvent?.(e);
    this.drill?.onBallEvent(e);

    if (this.state === 'toss') { if (e.type === 'floor') this.tossBounced = true; return; }
    if (this.state !== 'rally') return;
    // suivi pour les missions
    const ref = this.referee, h = this.human;
    if (h && (e.type === 'glass' || e.type === 'mesh') && e.side === h.side && ref.lastHitterSide !== h.side && ref.bounces >= 1) this.ownGlass = true;
    if (h && this.humanShot?.type === 'wall' && !this.humanShot.wallLanded && e.type === 'floor' && ref.lastHitterSide === h.side && ref.crossed && e.side === -h.side) {
      this.humanShot.wallLanded = true;
      this.stats.wallSuccess++;
      this.refreshMission();
    }
    // première chute d'un coup du joueur dans le camp adverse : lob profond (entre la ligne de service
    // et la vitre du fond), amortie courte (près du filet)
    if (h && e.type === 'floor' && this.humanShot && !this.humanShot.landed && ref.lastHitterSide === h.side && e.side === -h.side) {
      this.humanShot.landed = true;
      const z = Math.abs(e.z ?? 0);
      if (this.humanShot.type === 'lob' && z >= 6.95 && z <= 10) { this.stats.deepLobs++; this.refreshMission(); }
      if (this.humanShot.type === 'drop' && z <= 3) { this.stats.drops++; this.refreshMission(); }
      if (this.humanShot.type === 'volley') { this.stats.volleysIn++; this.refreshMission(); }
    }
    const d = this.referee.handle(e);
    if (d) this.resolve(d);
  }

  refreshMission() { if (this.mission) this.hud.setMission(this.missionText()); }

  /** Statistiques du point (missions). */
  trackPoint(d) {
    const h = this.human;
    if (!h || d.kind !== 'point') return;
    const mine = d.winner === h.side;
    const st = this.stats;
    if (mine) st.pointsWon++; else st.pointsLost++;
    if (mine) st.maxRallyWon = Math.max(st.maxRallyWon, this.rallyHits);
    st.streak = mine ? st.streak + 1 : 0;
    st.bestStreak = Math.max(st.bestStreak, st.streak);
    if (mine && this.server && this.server.side !== h.side) st.returnsWon++;
    if (/Double faute/.test(d.reason) && this.server === h) st.doubleFaults++;
    if (mine && this.lastShot?.player === h) {
      const hs = this.humanShot || {};
      const t = this.lastShot.type;
      st.winners[t] = (st.winners[t] || 0) + 1;
      if (t === 'serve' && this.rallyHits === 1) st.aces++;
      if (hs.atNet) st.netWinners++;
      if (hs.afterGlass) st.glassWinners++;
      if (/por tres|por cuatro|porte/i.test(d.reason)) st.porTres++;
      if (/por cuatro/i.test(d.reason)) st.porCuatro++;
      if (/por tres/i.test(d.reason)) st.porTresOnly++;
      if (/porte/i.test(d.reason)) st.door++;
      if (hs.outside) st.outsideWinners++;
    }
    this.refreshMission();
  }

  resolve(d) {
    if (this.drill && this.drill.onDecision(d)) return;
    const receiver = -this.server.side;
    if (d.kind === 'fault') {
      if (this.serveNumber === 1) {
        this.showBanner('FAUTE', d.reason, '#ffb74d');
        this.afterPoint('second', 1.4);
        return;
      }
      d = { kind: 'point', winner: receiver, reason: `Double faute (${d.reason.toLowerCase()})` };
    }
    this.trackPoint(d);
    if (d.kind === 'let') {
      this.showBanner('LET', d.reason || 'Le service est à rejouer', '#90caf9');
      this.afterPoint('replay', 1.4);
      return;
    }
    // match « truqué » (aventure) : le joueur ne peut pas atteindre la balle de match
    if (this.opts.rig && this.human && d.winner === this.human.side) {
      const sc = this.score, mine = sc.points[this.human.side > 0 ? 0 : 1];
      if (sc.tiebreak && mine >= sc.tbTarget - 2) d.winner = -this.human.side;
    }
    // camp favorisé (match regardé) : l'autre camp ne peut pas atteindre la balle de match
    if (this.opts.favor && d.winner === -this.opts.favor) {
      const sc = this.score, other = sc.points[this.opts.favor > 0 ? 1 : 0];
      if (sc.tiebreak && other >= sc.tbTarget - 2) d.winner = this.opts.favor;
    }
    // victoire assurée : l'adversaire ne peut pas atteindre la balle de match
    if (this.opts.rigWin && this.human && d.winner === -this.human.side) {
      const sc = this.score, theirs = sc.points[this.human.side > 0 ? 1 : 0];
      if (sc.tiebreak && theirs >= sc.tbTarget - 3) d.winner = this.human.side;
    }
    const res = this.score.pointTo(d.winner);
    this.hud.updateScore(this.score);
    this.tally.points[d.winner > 0 ? 0 : 1]++;
    this.tally.longestRally = Math.max(this.tally.longestRally, this.rallyHits);
    if (res.game) for (const p of this.players) p.recover(res.set ? 'set' : 'game');
    const mine = this.human && d.winner === this.human.side;
    const who = this.doubles ? `${this.teamName(d.winner)}` : this.teams[d.winner][0].name;
    const color = !this.human ? '#ffffff' : mine ? '#69f0ae' : '#ff8a80';
    let big = this.human ? (mine ? 'POINT !' : 'POINT ADVERSE') : 'POINT';
    if (res.match) big = this.human ? (mine ? 'VICTOIRE !' : 'DÉFAITE') : 'VICTOIRE';
    else if (res.set) big = this.human ? (mine ? 'SET GAGNÉ' : 'SET PERDU') : 'SET';
    else if (res.game) big = this.human ? (mine ? 'JEU GAGNÉ' : 'JEU PERDU') : 'JEU';
    if (!this.human || res.game) d = { ...d, reason: `${who} · ${d.reason}` };
    this.showBanner(big, d.reason, color);
    this.chatterOnPoint(d);
    // événement en plein match (aventure) : une cinématique avec un choix, puis on reprend
    const me = this.opts.midEvent;
    if (me && !this._midDone && !res.match && this.tally.points[0] + this.tally.points[1] >= me.at) {
      this._midDone = true;
      setTimeout(() => {
        if (this.state === 'matchOver' || !this.opts.midEvent) return;
        this.cutscene = { lines: me.lines(), i: -1, t: 0, onEnd: () => { this.ball.setVisible(true); this.hud.updateScore(this.score); this.cameraRig.snap = true; } };
        document.body.classList.add('cinema');
        this.nextLine();
      }, 900);
    }
    if (this.r3d.arena.venue?.id === 'pro' && !this.attract) this.umpireCall(res, d);
    // ralenti sur les points spectaculaires (sortie par 3/par 4/par la porte, smash, long échange)
    const spectacular = /por tres|por cuatro|porte/i.test(d.reason)
      || (this.lastShot?.type === 'smash' && (this._lastSpeed || 0) > 26 && this.rallyHits >= 3)
      || this.rallyHits >= 16;
    if (!this.attract && spectacular && this.opts.replays !== false) {
      this.slowmo = 1.5;
      this.replayAt = this.recorder.t;
      this._hlPending = true;
      this._lastReason = d.reason;
      this.cameraRig.kick(0.08);
    }
    const excite = Math.min(1, this.rallyHits / 14 + (res.game ? 0.35 : 0) + (res.set ? 0.3 : 0));
    if (this.rallyHits >= 6 || res.game) this.sfx.crowd(excite);
    this.r3d.arena.cheer(Math.max(excite, 0.25));
    if (this.human) this.input.rumble(mine ? 0.2 : 0.6, mine ? 0.6 : 0.2, 160);
    this.afterPoint(res.match ? 'match' : 'next', res.match ? 2.6 : 2.0);
  }

  checkLamps() {
    const v = this.r3d.arena.venue, p = this.ball.state.p;
    v.group.updateMatrixWorld(true);
    const decor = v.group.children.find((c) => c.position.lengthSq() > 0 || c.rotation.y !== 0) || v.group;
    const q = new THREE.Vector3();
    for (const [x, y, z] of v.lampBoxes) {
      q.set(x, y, z);
      // coordonnées du décor -> monde (le décor est décalé selon le court joué)
      const dg = v.group.getObjectByName?.('decor') || decor;
      dg.localToWorld(q);
      if (Math.abs(p.x - q.x) < 0.65 && Math.abs(p.y - q.y) < 0.18 && Math.abs(p.z - q.z) < 0.25) {
        this.ball.state.v.y = -Math.abs(this.ball.state.v.y) * 0.4;
        this.ball.state.v.x *= 0.5; this.ball.state.v.z *= 0.5;
        this.sfx.mesh?.(12);
        this.cameraRig.kick(0.06);
        this.resolve({ kind: 'let', reason: 'Lampe touchée : point à remettre' });
        return;
      }
    }
  }

  /** Arbitre de l'arena mondiale : annonce du score (voix + bulle). */
  umpireCall(res, d) {
    const sc = this.score, sv = this.server.side;
    const W = { 0: 'zéro', 15: 'quinze', 30: 'trente', 40: 'quarante' };
    let txt;
    if (res.match) txt = `Jeu, set et match, ${this.teamName(d.winner)} !`;
    else if (res.set) txt = `Jeu et set, ${this.teamName(d.winner)}.`;
    else if (res.game) txt = `Jeu, ${this.teamName(d.winner)}. ${sc.gamesOf(1)} jeux à ${sc.gamesOf(-1)}.`;
    else if (sc.tiebreak) txt = `${sc.label(sv)} - ${sc.label(-sv)}`;
    else {
      const a = sc.label(sv), b = sc.label(-sv);
      if (a === '40' && b === '40') txt = sc.isGoldenPoint() ? 'Point en or.' : 'Égalité.';
      else if (a === 'AV' || b === 'AV') txt = `Avantage, ${this.teamName(a === 'AV' ? sv : -sv)}.`;
      else txt = a === b ? `${W[a] ?? a} partout.` : `${W[a] ?? a} - ${W[b] ?? b}.`;
    }
    txt = txt.charAt(0).toUpperCase() + txt.slice(1);
    setTimeout(() => {
      this.hud.speech('Arbitre', txt, -1);
      try {
        if (window.speechSynthesis && this.sfx.musicEnabled !== false) {
          const u = new SpeechSynthesisUtterance(txt);
          u.lang = 'fr-FR'; u.rate = 0.95; u.pitch = 0.9; u.volume = 0.85;
          speechSynthesis.cancel(); speechSynthesis.speak(u);
        }
      } catch { /* voix indisponible */ }
    }, 900);
  }

  /** Bulles de répliques (personnages bavards) après certains points, sans bloquer le jeu. */
  chatterOnPoint(d) {
    const ch = this.opts.chatter;
    if (!ch || this.attract) return;
    const shooter = this.lastShot?.player;
    const great = /por tres|por cuatro|porte/i.test(d.reason) || (this.lastShot?.type === 'smash' && (this._lastSpeed || 0) > 22);
    for (const p of this.players) {
      const lines = ch[p.name];
      if (!lines) continue;
      let pool = null;
      // faute directe de ce joueur : réplique « miss » (Timéo crie et devient rouge), sans limite stricte
      if (lines.miss && d.winner !== p.side && shooter === p && Math.random() < 0.8) {
        p.avatar.flush?.(2.6);
        this.hud.speech(p.name, lines.miss[Math.floor(Math.random() * lines.miss.length)], p.side);
        return;
      }
      const aceAgainst = d.winner !== p.side && this.lastShot?.type === 'serve' && this.rallyHits <= 1 && !/faute/i.test(d.reason);
      if (aceAgainst && lines.ace) pool = lines.ace;
      else if (d.winner === p.side && shooter === p && great) pool = lines.great;
      else if (d.winner === p.side && Math.random() < 0.12) pool = lines.won;
      else if (d.winner !== p.side && Math.random() < 0.15) pool = lines.lost;
      if (!pool?.length) continue;
      // au plus 4 répliques par joueur et par match, jamais deux fois la même, et pas deux points de suite
      const said = (this._said ??= {})[p.name] ??= { n: 0, used: new Set(), last: -9 };
      if (said.n >= 4 || this.tally.points[0] + this.tally.points[1] - said.last < 3) continue;
      const fresh = pool.filter((t) => !said.used.has(t));
      if (!fresh.length) continue;
      const line = fresh[Math.floor(Math.random() * fresh.length)];
      said.used.add(line); said.n++; said.last = this.tally.points[0] + this.tally.points[1];
      this.hud.speech(p.name, line, p.side);
      return;
    }
  }

  showBanner(big, small, color) { if (!this.attract) this.hud.banner(big, small, 1.8, color); }

  afterPoint(next, delay) {
    this.state = 'pointOver';
    this.pending = next;
    this.timer = delay;
    for (const p of this.players) p.disarm();
    this.effects.setLanding(null);
  }

  nextAfterPoint() {
    if (this.pending === 'drill') { if (this.drill.done) this.endDrill(); else this.drill.next(); return; }
    if (this.pending === 'match' && this.drill) { this.endDrill(); return; }
    if (this.pending === 'second') this.setupServe(2);
    else if (this.pending === 'replay') this.setupServe(this.serveNumber);
    else if (this.pending === 'match') {
      if (this.attract) { this.start({ ...this.opts }); return; }
      // résumé des temps forts (au moins 2), puis la scène d'après-match éventuelle
      const hl = this.opts.replays !== false ? (this.highlights || []) : [];
      if (hl.length >= 2) {
        this.state = 'recap';
        this.recap = { queue: [...hl], i: 0, n: hl.length };
        this.nextRecap();
      } else this.finishMatchScreen();
    } else this.setupServe(1);
  }

  // =========================================================================
  //  Simulation (pas fixe)
  // =========================================================================
  step(dt) {
    this.time += dt;
    for (const p of this.players) { if (p._fall > 0) { p.controller.getIntent(dt); p.vel.set(0, 0, 0); continue; } p.update(dt, p.controller.getIntent(dt), this); }
    if (this.doubles) this.separateTeammates();

    if (this.ball.held) { if (this.server && this.state !== 'drill') this.ball.holdAt(this.server.handPosition(this._v)); }
    else this.ball.step(dt, this.emit);

    if (this.state === 'toss' || this.state === 'rally') {
      for (const p of this.players) if (p.tryContact(this.ball, this)) break;
    }
    // hangar : une balle très haute peut toucher une lampe -> point à remettre
    if (this.state === 'rally' && this.r3d.arena.venue?.lampBoxes && this.ball.state.p.y > 7) this.checkLamps();
    if (this.drill && this.state !== 'matchOver' && this.state !== 'pointOver') {
      this.drill.update(dt);
      if (this.drill.done) { this.endDrill(); return; }
    }
    if (this.state === 'pointOver') {
      this.timer -= dt;
      if (this.timer <= 0) this.nextAfterPoint();
    } else if (this.state === 'rally' && this.time - this.lastHitTime > 7) {
      this.resolve(this.referee.timeout());
    } else if (this.state === 'toss' && this.time - this.tossTime > 3) {
      this.setupServe(this.serveNumber);
    }
  }

  /** Les deux partenaires ne se chevauchent pas. */
  separateTeammates() {
    for (const side of [1, -1]) {
      const [a, b] = this.teams[side];
      if (!b) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      const d = Math.hypot(dx, dz);
      const min = 0.75;
      if (d < min && d > 1e-4) {
        const push = (min - d) / 2;
        a.pos.x -= (dx / d) * push; a.pos.z -= (dz / d) * push;
        b.pos.x += (dx / d) * push; b.pos.z += (dz / d) * push;
        a.constrain(this); b.constrain(this);
      }
    }
  }

  // =========================================================================
  //  Image (rendu, HUD, entrées)
  // =========================================================================
  frame(dt) {
    const inp = this.input;
    if (this.state === 'matchOver') {
      this.time += dt;
      if (this.time - this.endTime < 1.2) { /* évite de relancer par un appui de frappe */ }
      else if (this.opts.net) { if (inp.menu.confirm || inp.menu.back) { this.leaveOnline(); return; } }
      else if (this.career) { if (inp.menu.confirm) { this.finishCareer(); return; } }
      else if (inp.menu.confirm) this.start({ ...this.opts });
      else if (inp.menu.back) this.exitToMenu();
    } else if (!this.attract && inp.pressed.VIEW) {
      this.hud.shotInfo(`Caméra : ${this.cameraRig.cycle()}`, 1);
    } else if (!this.attract && inp.pressed.START) {
      this.paused = !this.paused;
      if (this.paused) this.hud.showPause(this.career); else this.hud.hidePause();
    } else if (this.paused) {
      if (this.opts.net && inp.menu.back) { this.paused = false; this.hud.hidePause(); this.leaveOnline(); return; }
      if (inp.menu.confirm) { this.paused = false; this.hud.hidePause(); }
      else if (this.career && inp.pressed.X) { this.finishCareer(false, true); return; }
      else if (inp.menu.back) { if (this.career) this.finishCareer(true); else this.exitToMenu(); return; }
    }

    if (this.state === 'showcase') { this.renderShowcase(dt); return; }
    if (this.netLink?.role === 'client') { if (this.state !== 'matchOver') this.netLink.frame(dt); this.render(dt); return; }
    if (this.ceremony && !this.paused) { this.updateCeremony(dt); return; }
    // match regardé depuis les tribunes (aventure) : durée limitée, A pour passer
    if (this.opts.watchFor && !this.attract && !this.cutscene && (this.time > this.opts.watchFor || (this.time > 2 && inp.menu.confirm))) {
      const cb = this.opts.onEnd; this.start({ attract: true, difficulty: 'hard', ambiance: this.opts.ambiance }); cb?.({ watched: true }); return;
    }
    if (this.cutscene && !this.paused) { this.updateCutscene(dt); return; }
    if (this.tvReplay && !this.paused) { this.updateTvReplay(dt); return; }
    // replay télé d'un beau point, une fois l'action retombée
    if (this.replayAt != null && this.state === 'pointOver' && !this.paused && this.recorder.t - this.replayAt > 0.9) this.startTvReplay();
    // en ligne, la pause ne fige pas le match (les autres joueurs continuent)
    if ((!this.paused || this.netLink) && this.state !== 'matchOver') {
      for (const p of this.players) p.controller.capture(dt, this);
      // ralenti : le temps de jeu ralentit (durée comptée en temps réel)
      let sdt = dt;
      if (this.slowmo > 0) { this.slowmo -= dt; sdt = dt * 0.28; }
      this.acc += sdt;
      let n = 0;
      while (this.acc >= FIXED_DT && n < 16) { this.step(FIXED_DT); this.acc -= FIXED_DT; n++; }
      if (n === 16) this.acc = 0;
      this.netLink?.frame(dt);
    }
    this.render(dt);
  }

  // =========================================================================
  //  Cinématiques : champ / contrechamp sur les personnages qui parlent
  // =========================================================================
  nextLine() {
    const cs = this.cutscene;
    cs.i++; cs.t = 0;
    if (cs.i >= cs.lines.length) { this.endCutscene(); return; }
    const L = cs.lines[cs.i];
    if (L.goto) { cs.i = cs.lines.findIndex((x) => x.id === L.goto) - 1; this.nextLine(); return; }
    const who = (L.actor && this.actors?.find((x) => x.id === L.actor)) || this.players.find((p) => L.name && p.name === L.name) || (L.side === 1 ? this.teams[1][0] : this.teams[-1][0]);
    cs.who = who;
    if (L.choices) {
      cs.choosing = L;
      this.hud.onChoice = (k) => this.chooseLine(k);
      this.hud.dialog(L.label || who?.name || '', L.text, L.choices);
      return;
    }
    cs.choosing = null;
    this.hud.sheet?.(L.sheet || null);
    this.hud.dialog(L.label || who?.name || '', L.text, cs.i + 1 < cs.lines.length);
  }

  /** Choix d'une réponse pendant une cinématique : la suite (réaction) est insérée juste après. */
  chooseLine(k) {
    const cs = this.cutscene, L = cs?.choosing;
    if (!L || !L.choices[k]) return;
    cs.choosing = null;
    const extra = L.onChoose?.(k, this) || [];
    cs.lines.splice(cs.i + 1, 0, ...extra);
    this.nextLine();
  }

  clearActors() {
    for (const ac of this.actors || []) this.scene.remove(ac.avatar.root);
    this.actors = null;
  }

  endCutscene() {
    this.clearActors();
    this.hud.sheet?.(null);
    const done = this.cutscene?.onEnd;
    this.cutscene = null;
    // cinématique seule (aventure) : on rend la main sans jouer
    if (!done && this.opts.sceneOnly) {
      const cb = this.opts.onSceneEnd;
      this.hud.dialog(null); document.body.classList.remove('cinema');
      this.start({ attract: true, difficulty: 'hard', ambiance: this.opts.ambiance });
      cb?.();
      return;
    }
    if (done) { this.hud.dialog(null); document.body.classList.remove('cinema'); done(); return; }
    this.hud.dialog(null);
    document.body.classList.remove('cinema');
    if (this.drill) this.hud.banner('ENTRAÎNEMENT', this.drill.def.desc, 3.2);
    this.ball.setVisible(true);
    this.cameraRig.snap = true;
  }

  updateCutscene(dt) {
    const cs = this.cutscene, inp = this.input;
    cs.t += dt;
    if (cs.choosing) {
      if (cs.t > 0.4) {
        const k = inp.pressed.A ? 0 : inp.pressed.X ? 1 : inp.pressed.Y ? 2 : inp.pressed.B ? 3 : ['Digit1', 'Digit2', 'Digit3', 'Digit4'].findIndex((d) => inp.keys?.has(d));
        if (k >= 0 && k < cs.choosing.choices.length) { this.chooseLine(k); if (!this.cutscene) return; }
      }
    } else {
      if (inp.pressed.START) {
        // « Passer » saute jusqu'au prochain choix s'il y en a un
        const k = cs.lines.findIndex((x, j) => j > cs.i && x.choices);
        if (k >= 0) { cs.i = k - 1; this.nextLine(); } else this.endCutscene();
        return;
      }
      if (cs.t > 0.35 && inp.menu.confirm) { this.nextLine(); if (!this.cutscene) return; }
    }
    this.ball.setVisible(false);
    // les personnages se tournent les uns vers les autres
    const p = cs.who;
    for (const q of this.players) {
      q.avatar.animate(dt, { speed: 0, fwd: 0, side: 0, yaw: (q.side > 0 ? Math.PI : 0) + (q === p ? Math.sin(cs.t * 1.3) * 0.15 : 0), look: 0, ready: false, armed: null, swing: null });
    }
    for (const ac of this.actors || []) ac.avatar.animate(dt, { speed: 0, fwd: 0, side: 0, yaw: (ac.side > 0 ? Math.PI : 0) + (ac === p ? Math.sin(cs.t * 1.1) * 0.2 : 0), look: 0, ready: false, armed: null, swing: null });
    this.render(dt);
    if (p) {
      // caméra par-dessus l'épaule de l'autre, cadrée sur celui qui parle
      const s = p.side, cam = this.cameraRig.camera;
      const tx = p.pos.x + 0.9 * s, tz = p.pos.z - s * 2.8;
      const k = cs.cp ? 1 - Math.exp(-dt * 3) : 1;
      cs.cp ??= cam.position.clone();
      cs.cp.x += (tx - cs.cp.x) * k; cs.cp.y += (1.75 - cs.cp.y) * k; cs.cp.z += (tz - cs.cp.z) * k;
      cam.position.copy(cs.cp);
      cam.lookAt(p.pos.x, 1.45, p.pos.z);
      this.cameraRig.pos.copy(cam.position);
    }
  }

  // =========================================================================
  //  Replay façon télé
  // =========================================================================
  startTvReplay(frames = null, info = null) {
    if (!frames) {
      frames = this.recorder.clip(this.replayAt);
      // on garde le temps fort pour le résumé de fin de match (5 au maximum, les plus récents)
      if (this._hlPending && frames.length >= 10) {
        (this.highlights ??= []).push({ frames, lastShot: this.lastShot, speed: this._lastSpeed, reason: this._lastReason, hitT: this._lastHitT });
        if (this.highlights.length > 5) this.highlights.shift();
      }
      this._hlPending = false;
    }
    this.replayAt = null;
    if (frames.length < 10) return;
    this._replaySave = { ball: this.ball.state.p.clone(), vis: this.ball.mesh.visible, last: this.recorder.buf[this.recorder.buf.length - 1] };
    this.tvReplay = new ReplayPlayer(this, frames, info ? info.hitT : this._lastHitT);
    for (const p of this.players) p.avatar.root.visible = true;   // en caméra 1re personne, son avatar était masqué
    if (info?.lastShot) { this.tvReplay.focus = this.players.indexOf(info.lastShot.player); this.tvReplay.focusSide = info.lastShot.side; }
    document.body.classList.add('cinema');
    const ls = info?.lastShot || this.lastShot, lab = { smash: 'Smash', bandeja: 'Bandeja', drive: 'Coup droit', volley: 'Volée', lob: 'Lob', slice: 'Coupé', drop: 'Amortie', wall: 'Contre-vitre', serve: 'Service' };
    const why = (info ? info.reason : this._lastReason) || '';
    const spd = info ? info.speed : this._lastSpeed;
    const label = ls?.player?.name ? `${ls.player.name} · ${lab[ls.type] || ''}${spd ? ` · ${Math.round(spd * 3.6)} km/h` : ''}<small>${this.recap ? `RÉSUMÉ DU MATCH · ${this.recap.i}/${this.recap.n} · ` : ''}${why}</small>` : '';
    this.hud.replayBadge(true, label);
  }

  endTvReplay() {
    const sv = this._replaySave;
    // remise à zéro des os : restaurer des quaternions décale les angles d'Euler
    // (un demi-tour en Y devient (π, 0, π)) et retournait les joueurs dos au filet
    for (const p of this.players) {
      const av = p.avatar;
      for (const o of [av.root, av.body, av.pelvis, av.spine, av.chest, av.head, av.lShoulder, av.lElbow, av.rShoulder, av.rElbow, av.racket, ...av.legs.flatMap((L) => [L.hip, L.knee, L.ankle])]) o.rotation.set(0, 0, 0);
      av.root.rotation.y = av.yaw;
    }
    if (sv) { this.ball.state.p.copy(sv.ball); this.ball.mesh.visible = sv.vis; }
    this.tvReplay = null;
    // retour au direct : plus de ralenti, on enchaîne tout de suite sur le point suivant
    this.slowmo = 0;
    this.hud.dialog(null); this.hud.hideSpeech?.(); document.body.classList.remove('cinema');
    this.recorder.clear();
    if (this.state === 'pointOver') this.timer = Math.min(this.timer, 0.3);
    for (const p of this.players) { p.avatar.body.position.set(0, 0, 0); p.updateVisual(0, this); }
    document.body.classList.remove('cinema');
    this.hud.replayBadge(false);
    this.cameraRig.snap = true;
    if (this.recap) this.nextRecap();
  }

  /** Résumé de fin de match : les temps forts à la suite, puis la scène d'après-match. */
  nextRecap() {
    const r = this.recap;
    if (r.queue.length) { r.i++; const h = r.queue.shift(); this.startTvReplay(h.frames, h); return; }
    this.recap = null;
    this.finishMatchScreen();
  }

  finishMatchScreen() {
    const won = this.human && this.score.winner === this.human.side;
    // remise du trophée (finale gagnée) : cérémonie plus ou moins longue selon le tournoi
    if (won && this.opts.trophy && !this._trophyDone) { this.startCeremony(this.opts.trophy); return; }
    const lines = this.opts.endCutscene?.(won);
    if (lines?.length && !this._endScene) {
      this._endScene = true;
      this.cutscene = { lines, i: -1, t: 0, onEnd: () => this.finishMatchScreen() };
      document.body.classList.add('cinema');
      this.nextLine();
      return;
    }
    this._endScene = false;
    this.state = 'matchOver';
    if (this.netLink?.role === 'host') this.netLink.end();
    this.endTime = this.time;
    this.hud.showEnd(this.score, this.human, this.career);
  }

  // =========================================================================
  //  Cérémonie de remise du trophée
  // =========================================================================
  startCeremony(spec) {
    const h = this.human;
    const mesh = makeTrophy({ ...spec, size: Math.max(spec.size, 0.62) });
    this.scene.add(mesh);
    // confettis pour les tournois importants
    let confetti = null;
    if (spec.size >= 0.6) {
      const n = Math.round(120 + spec.size * 180);
      confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.035), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: false }), n);
      const cols = spec.metal === 'gold' ? [0xffd54f, 0xffffff, 0xd4a72c, 0x64b5f6] : [0xffffff, 0xcfd8dc, 0x90caf9, 0xffab91];
      confetti.userData.p = [];
      for (let i = 0; i < n; i++) {
        confetti.setColorAt(i, new THREE.Color(cols[i % cols.length]));
        confetti.userData.p.push({ x: h.pos.x + (Math.random() - 0.5) * 9, y: 4 + Math.random() * 6, z: h.pos.z + (Math.random() - 0.5) * 9, r: Math.random() * 6, v: 0.6 + Math.random() * 0.8 });
      }
      this.scene.add(confetti);
    }
    this.ceremony = { t: 0, spec, mesh, confetti, cheer: 0 };
    for (const p of this.players) if (p.side === h.side) p.avatar.racket.visible = false;
    this.ball.setVisible(false);
    document.body.classList.add('cinema');
    this.hud.banner(spec.metal === 'gold' ? 'CHAMPIONS !' : 'VAINQUEURS !', `${this.opts.subtitle || ''} · ${spec.label}`, Math.min(6, spec.duration), spec.metal === 'gold' ? '#ffd54f' : '#e0e0e0');
    this.sfx.crowd(1);
  }

  endCeremony(silent = false) {
    const c = this.ceremony;
    if (!c) return;
    this.scene.remove(c.mesh);
    if (c.confetti) this.scene.remove(c.confetti);
    this.ceremony = null;
    for (const p of this.players) p.avatar.racket.visible = true;
    document.body.classList.remove('cinema');
    if (silent) return;
    this._trophyDone = true;
    this.finishMatchScreen();
  }

  updateCeremony(dt) {
    const c = this.ceremony, h = this.human;
    c.t += dt;
    if ((c.t > 1 && (this.input.menu.confirm || this.input.pressed.START)) || c.t > c.spec.duration) { this.endCeremony(); return; }
    // le gagnant lève le trophée au-dessus de sa tête, le partenaire applaudit
    const lift = Math.min(1, c.t / 1.2);
    const yaw = h.side > 0 ? Math.PI : 0;
    for (const p of this.players) {
      const mine = p.side === h.side;
      p.avatar.animate(dt, { speed: 0, fwd: 0, side: 0, yaw: p.side > 0 ? Math.PI : 0, look: 0, ready: false, armed: mine ? { kind: 'over', charge: 0.3 + 0.2 * Math.sin(c.t * 6) } : null, swing: null });
      p.avatar.root.position.set(p.pos.x, mine ? Math.max(0, Math.sin(c.t * 5 + (p === h ? 0 : 1)) * 0.12) : 0, p.pos.z);
    }
    const s = c.spec.size;
    // le trophée est tenu dans les deux mains (milieu des deux poignets)
    const av = h.avatar; av.root.updateMatrixWorld(true);
    const rh = av.rElbow.localToWorld(new THREE.Vector3(-0.28, 0, 0)), lh = av.lElbow.localToWorld(new THREE.Vector3(0, -0.28, 0));
    const mid = rh.add(lh).multiplyScalar(0.5);
    c.mesh.position.set(mid.x, mid.y - 0.12 * s, mid.z);
    c.mesh.rotation.y = yaw + Math.sin(c.t * 1.5) * 0.3;
    if (c.confetti) {
      const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
      c.confetti.userData.p.forEach((p, i) => {
        p.y -= p.v * dt; p.r += dt * 4; if (p.y < 0.02) p.y = 0.02;
        e.set(p.r, p.r * 0.7, 0); q.setFromEuler(e);
        M.compose(v.set(p.x + Math.sin(p.r) * 0.2, p.y, p.z), q, one);
        c.confetti.setMatrixAt(i, M);
      });
      c.confetti.instanceMatrix.needsUpdate = true;
    }
    c.cheer -= dt;
    if (c.cheer <= 0) { this.sfx.crowd(0.9); c.cheer = 2.2; }
    // caméra qui tourne lentement autour des vainqueurs
    const cam = this.cameraRig.camera, a = c.t * 0.35 + (h.side > 0 ? Math.PI : 0) - 0.6;
    const R = 3.2 + s * 0.8;
    cam.position.set(h.pos.x + Math.sin(a) * R, 1.6 + s * 0.3, h.pos.z + Math.cos(a) * R);
    cam.lookAt(h.pos.x, 1.5 + lift * 0.6, h.pos.z);
    this.cameraRig.pos.copy(cam.position);
    this.ball.updateVisual(dt);
    this.effects.update(dt);
    this.hud.update(dt);
  }

  updateTvReplay(dt) {
    const inp = this.input;
    if (inp.menu.confirm || inp.pressed.START || !this.tvReplay.update(dt)) { this.endTvReplay(); return; }
    this.ball.updateVisual(dt);
    this.effects.update(dt);
    this.hud.update(dt);
  }

  renderShowcase(dt) {
    const sc = this.showcase;
    if (sc) {
      sc.t += dt;
      sc.avatar.animate(dt, { speed: 0, fwd: 0, side: 0, yaw: 0.35 + Math.sin(sc.t * 0.5) * 0.9, look: 0, ready: false, armed: null, swing: null });
    }
    this.effects.setReticle(0, 0, false);
    this.effects.setPlayerRing(null);
    this.effects.update(dt);
    this.cameraRig.update(dt, { showcase: true, ball: this.ball.state.p });
    this.hud.update(dt);
  }

  render(dt) {
    for (const p of this.players) p.updateVisual(dt, this);
    for (const sp of this.spectators || []) sp.animate(dt, { speed: 0, fwd: 0, side: 0, yaw: Math.PI / 2, look: Math.atan2(this.ball.state.p.x, this.ball.state.p.z) * 0.3, ready: false, armed: null, swing: null });
    // joueur éméché : tombe une ou deux fois pendant le match
    for (const p of this.players) {
      if (!this.opts.drunk?.includes(p.name)) continue;
      if (!p._fall && (p._falls || 0) < 2 && this.state === 'rally' && Math.random() < dt * 0.06) { p._fall = 2.2; p._falls = (p._falls || 0) + 1; this.hud.shotInfo(`${p.name} EST TOMBÉ !`, p.side); }
      if (p._fall > 0) {
        p._fall -= dt;
        const k = Math.min(1, (2.2 - p._fall) * 4, p._fall * 2);
        p.avatar.root.rotation.x = -1.35 * k * p.side; p.avatar.root.position.y = -0.1 * k;
        p.vel.set(0, 0, 0);
        if (p._fall <= 0) { p._fall = 0; p.avatar.root.rotation.x = 0; p.avatar.root.position.y = 0; }
      }
    }
    this.ball.updateVisual(dt);
    const h = this.human;

    // réticule de visée
    if (h) {
      const serving = (this.state === 'serve' || this.state === 'toss') && this.server === h;
      const incoming = this.state === 'rally' && this.referee.lastHitterSide !== h.side;
      const type = serving ? 'serve' : h.armed ? this.previewType(h) : 'drive';
      const t = targetFromAim(h.aim, type, h.side, this.referee.serveBox, h.pos);
      this.effects.setReticle(t.x, t.z, (serving || incoming) && !h.isOutside());
      this.effects.setPlayerRing(h.pos);
      this.hud.setPower(h.armed ? h.armed.power : null, h.armed ? this.previewLabel(h) : '');
      this.hud.setEnergy(h.energy);
    } else {
      this.effects.setReticle(0, 0, false);
      this.effects.setPlayerRing(null);
    }
    this.effects.update(dt);

    if (this.drill) this.hud.setDrill(this.drill.hud());
    const focus = h ? h.pos : this.players[0]?.pos;
    // 1re personne : on masque son propre avatar
    if (h) h.avatar.root.visible = !(this.cameraRig.mode === 'first' && !this.attract && !this.tvReplay);
    this.cameraRig.update(dt, { focus, ball: this.ball.state.p, attract: this.attract, side: h?.side ?? 1, heading: h ? h.avatar.yaw : 0 });
    if (!this.attract && !this.cutscene && !this.tvReplay && this.state !== 'showcase') this.recorder.capture(this, dt);
    this.hud.update(dt);
  }

  previewType(h) {
    const b = h.armed.button;
    if (h.armed.shotType === 'serve') return 'serve';
    if (b === 'C') return 'wall';
    if (b === 'D') return 'smash';
    if (b === 'B') return 'lob';
    if (b === 'X') return h.aim.y < -0.55 ? 'drop' : 'slice';
    if (b === 'Y') return 'smash';
    return 'drive';
  }

  previewLabel(h) {
    const b = h.armed.button;
    if (h.armed.shotType === 'serve') return 'SERVICE';
    if (h.isOutside()) return 'RENVOI EN LOB';
    if (b === 'C') return 'CONTRE-VITRE';
    if (b === 'D') { const p = h.armed.power; return p < 0.82 ? 'PAR 3 / PAR 4 · attendez…' : p <= 0.95 ? 'PAR 3 / PAR 4 · MAINTENANT !' : 'PAR 3 / PAR 4 · trop tard'; }
    if (b === 'B') return 'LOB';
    if (b === 'X') return h.aim.y < -0.55 ? 'AMORTIE' : 'COUPÉ';
    if (b === 'Y') return h.armed.power >= 0.7 ? 'SMASH' : 'BANDEJA';
    return 'FRAPPE';
  }
}

export { clamp, COURT };
