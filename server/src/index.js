// ============================================================================
//  Serveur en ligne de Padel Arena (Cloudflare Worker + Durable Object).
//
//  Le Worker sert les fichiers du jeu et ouvre les WebSocket sur /ws. Toutes
//  les connexions arrivent dans un seul Durable Object « Hub » qui gère :
//   - le salon (joueurs connectés, parties publiques, tournois ouverts) ;
//   - les parties : un code à 5 lettres, 2 ou 4 places (les places vides sont
//     tenues par des bots) ; le créateur de la partie « héberge » le match :
//     son navigateur fait tourner la simulation, les autres lui envoient leurs
//     commandes et reçoivent l'état du match (le Hub ne fait que relayer) ;
//   - la partie rapide (file d'attente) ;
//   - les tournois à élimination directe (4 ou 8 joueurs, complétés par des bots).
// ============================================================================

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket attendu', { status: 426 });
      const id = env.HUB.idFromName('main');
      return env.HUB.get(id).fetch(req);
    }
    return env.ASSETS.fetch(req);
  },
};

const BOT_NAMES = ['Bot Paco', 'Bot Lucía', 'Bot Marco', 'Bot Inès', 'Bot Hugo', 'Bot Nora', 'Bot Diego', 'Bot Jade'];
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const QUICK_WAIT = 15000;            // partie rapide en 2 contre 2 : on attend 4 joueurs au plus 15 s
const clean = (s, n = 18) => String(s ?? '').replace(/[<>&"]/g, '').trim().slice(0, n);

function slotsFor(format) {
  // ordre de remplissage : créateur, adversaire, partenaire du créateur, partenaire de l'adversaire
  return format === '1v1'
    ? [{ side: 1, lane: 0 }, { side: -1, lane: 0 }]
    : [{ side: 1, lane: -1 }, { side: -1, lane: 1 }, { side: 1, lane: 1 }, { side: -1, lane: -1 }];
}

export class Hub {
  constructor(state, env) {
    this.state = state;
    this.users = new Map();      // uid -> { ws, uid, name, prof, room, tour }
    this.rooms = new Map();      // code -> room
    this.tours = new Map();      // id -> tournoi
    this.queue = { '1v1': [], '2v2': [] };
    this.seq = 1;
  }

  async fetch(req) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const uid = `u${this.seq++}${Math.random().toString(36).slice(2, 6)}`;
    const user = { ws: server, uid, name: 'Joueur', prof: null, room: null, tour: null };
    this.users.set(uid, user);
    server.addEventListener('message', (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      try { this.onMessage(user, m, ev.data); } catch (err) { this.send(user, { t: 'error', msg: String(err?.message || err) }); }
    });
    const bye = () => this.onClose(user);
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ------------------------------------------------------------------ envoi
  send(u, m) {
    if (!u?.ws) return;
    try { u.ws.send(typeof m === 'string' ? m : JSON.stringify(m)); } catch { /* socket fermée */ }
  }
  sendRoom(room, m, except = null) {
    const s = typeof m === 'string' ? m : JSON.stringify(m);
    for (const uid of room.members) if (uid !== except) this.send(this.users.get(uid), s);
  }
  lobbyInfo() {
    return {
      t: 'lobby',
      online: this.users.size,
      rooms: [...this.rooms.values()].filter((r) => !r.cfg.priv && r.state === 'wait' && !r.tour).map((r) => this.roomInfo(r)),
      tours: [...this.tours.values()].filter((t) => t.state !== 'done' || Date.now() - t.doneAt < 120000).map((t) => this.tourInfo(t)),
    };
  }
  broadcastLobby() {
    const s = JSON.stringify(this.lobbyInfo());
    for (const u of this.users.values()) if (!u.room || this.rooms.get(u.room)?.state !== 'play') this.send(u, s);
  }

  // ------------------------------------------------------------------ messages
  onMessage(u, m, raw) {
    switch (m.t) {
      case 'hello':
        u.name = clean(m.name) || 'Joueur';
        u.prof = m.prof && JSON.stringify(m.prof).length < 8000 ? m.prof : null;
        this.send(u, { t: 'welcome', uid: u.uid, name: u.name });
        this.send(u, this.lobbyInfo());
        break;
      case 'lobby': this.send(u, this.lobbyInfo()); break;
      case 'create': this.createRoom(u, m.cfg || {}); break;
      case 'join': this.joinRoom(u, clean(m.code, 6).toUpperCase()); break;
      case 'leave': this.leaveRoom(u); this.unqueue(u); this.broadcastLobby(); break;
      case 'start': this.startRoom(u); break;
      case 'quick': this.enqueue(u, m.format === '1v1' ? '1v1' : '2v2', m.cfg || {}); break;
      case 'unquick': this.unqueue(u); break;
      case 'result': this.onResult(u, m); break;
      case 'tcreate': this.createTour(u, m); break;
      case 'tjoin': this.joinTour(u, m.id); break;
      case 'tleave': this.leaveTour(u); break;
      case 'tstart': this.startTour(u); break;
      // relais pendant le match : l'hôte diffuse, les autres envoient à l'hôte
      case 'in': case 'snap': case 'ev': case 'setup': case 'end': case 'chat': {
        const room = this.rooms.get(u.room);
        if (!room || room.state !== 'play') return;
        if (u.uid === room.host) this.sendRoom(room, raw, u.uid);
        else if (m.t === 'in' || m.t === 'chat') {
          const fwd = m.t === 'chat' ? JSON.stringify({ t: 'chat', from: u.name, text: clean(m.text, 120) }) : JSON.stringify({ ...m, from: u.uid });
          if (m.t === 'chat') this.sendRoom(room, fwd, u.uid); else this.send(this.users.get(room.host), fwd);
        }
        break;
      }
    }
  }

  onClose(u) {
    if (!this.users.has(u.uid)) return;
    this.users.delete(u.uid);
    u.ws = null;
    this.unqueue(u);
    this.leaveRoom(u, true);
    this.leaveTour(u, true);
    this.broadcastLobby();
  }

  // ------------------------------------------------------------------ parties
  newCode() {
    let c;
    do { c = Array.from({ length: 5 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join(''); } while (this.rooms.has(c));
    return c;
  }

  sanitizeCfg(cfg) {
    return {
      format: cfg.format === '1v1' ? '1v1' : '2v2',
      venue: clean(cfg.venue, 20) || 'club',
      court: Math.max(0, Math.min(4, cfg.court | 0)),
      sets: [1, 3].includes(cfg.sets) ? cfg.sets : 1,
      stb: !!cfg.stb,
      golden: cfg.golden !== false,
      difficulty: ['easy', 'medium', 'strong', 'hard'].includes(cfg.difficulty) ? cfg.difficulty : 'medium',
      ambiance: ['sunset', 'day', 'night'].includes(cfg.ambiance) ? cfg.ambiance : 'sunset',
      priv: !!cfg.priv,
    };
  }

  createRoom(u, cfg, extra = {}) {
    this.leaveRoom(u);
    this.unqueue(u);
    const code = this.newCode();
    const c = this.sanitizeCfg(cfg);
    const room = { code, host: u.uid, cfg: c, members: [u.uid], slots: slotsFor(c.format).map((s) => ({ ...s, uid: null })), state: 'wait', ...extra };
    room.slots[0].uid = u.uid;
    this.rooms.set(code, room);
    u.room = code;
    this.pushRoom(room);
    this.broadcastLobby();
    return room;
  }

  joinRoom(u, code) {
    const room = this.rooms.get(code);
    if (!room) return this.send(u, { t: 'error', msg: 'Partie introuvable. Vérifiez le code.' });
    if (room.members.includes(u.uid)) return this.pushRoom(room);
    if (room.state !== 'wait') return this.send(u, { t: 'error', msg: 'Le match a déjà commencé.' });
    if (room.tour) return this.send(u, { t: 'error', msg: 'Cette partie fait partie d\'un tournoi.' });
    const free = room.slots.find((s) => !s.uid);
    if (!free) return this.send(u, { t: 'error', msg: 'La partie est complète.' });
    this.leaveRoom(u);
    this.unqueue(u);
    free.uid = u.uid;
    room.members.push(u.uid);
    u.room = code;
    this.pushRoom(room);
    this.broadcastLobby();
  }

  leaveRoom(u, disconnected = false) {
    const room = this.rooms.get(u.room);
    u.room = null;
    if (!room) return;
    room.members = room.members.filter((x) => x !== u.uid);
    for (const s of room.slots) if (s.uid === u.uid) s.uid = null;
    // tournoi : celui qui part perd son match
    if (room.tour && room.state === 'play') {
      const side = room.tour.sides[u.uid];
      if (side) this.finishTourMatch(room, -side);
    }
    if (room.host === u.uid || !room.members.length) {
      if (room.members.length) this.sendRoom(room, { t: 'aborted', msg: room.state === 'play' ? 'L\'hôte a quitté le match.' : 'Le créateur a fermé la partie.' });
      for (const uid of room.members) { const m = this.users.get(uid); if (m) m.room = null; }
      this.rooms.delete(room.code);
    } else {
      if (room.state === 'play') this.sendRoom(room, { t: 'left', uid: u.uid, name: u.name, disconnected });
      else this.pushRoom(room);
    }
  }

  roomInfo(room) {
    const host = this.users.get(room.host);
    return {
      code: room.code, host: room.host, hostName: host?.name || '?', cfg: room.cfg, state: room.state,
      tour: room.tour ? { id: room.tour.id, label: room.tour.label } : null,
      slots: room.slots.map((s) => ({ side: s.side, lane: s.lane, uid: s.uid, name: s.uid ? this.users.get(s.uid)?.name : null, prof: s.uid ? this.users.get(s.uid)?.prof : null, botName: s.botName || null })),
    };
  }

  pushRoom(room) { this.sendRoom(room, { t: 'room', room: this.roomInfo(room) }); }

  startRoom(u) {
    const room = this.rooms.get(u.room);
    if (!room || room.host !== u.uid || room.state !== 'wait') return;
    this.launch(room);
  }

  launch(room) {
    room.state = 'play';
    room.startedAt = Date.now();
    this.sendRoom(room, { t: 'go', room: this.roomInfo(room) });
    this.broadcastLobby();
  }

  // ------------------------------------------------------------------ partie rapide
  unqueue(u) {
    for (const k of Object.keys(this.queue)) this.queue[k] = this.queue[k].filter((x) => x.uid !== u.uid);
  }

  enqueue(u, format, cfg) {
    this.leaveRoom(u);
    this.unqueue(u);
    const q = this.queue[format];
    q.push({ uid: u.uid, at: Date.now(), cfg });
    this.send(u, { t: 'queued', format, waiting: q.length });
    this.flushQueue(format);
    if (format === '2v2') setTimeout(() => this.flushQueue(format, true), QUICK_WAIT + 100);
  }

  flushQueue(format, timeout = false) {
    const q = this.queue[format];
    const need = format === '1v1' ? 2 : 4;
    const ready = q.length >= need || (timeout && q.length >= 2 && Date.now() - q[0].at >= QUICK_WAIT);
    for (const e of q) this.send(this.users.get(e.uid), { t: 'queued', format, waiting: q.length });
    if (!ready) return;
    const group = q.splice(0, Math.min(need, q.length));
    const first = this.users.get(group[0].uid);
    if (!first) return;
    const room = this.createRoom(first, { ...group[0].cfg, format, priv: true });
    for (const e of group.slice(1)) { const m = this.users.get(e.uid); if (m) this.joinRoom(m, room.code); }
    this.launch(room);
  }

  // ------------------------------------------------------------------ tournois
  tourInfo(t) {
    return {
      id: t.id, name: t.name, size: t.size, format: t.format, venue: t.venue, state: t.state, creator: t.creator,
      entrants: t.entrants.map((e) => ({ uid: e.uid, name: e.name })),
      rounds: t.rounds.map((r) => r.map((mt) => ({ a: mt.a, b: mt.b, winner: mt.winner, score: mt.score || null, live: !!mt.room }))),
      champion: t.champion ?? null,
    };
  }

  pushTour(t) {
    const s = JSON.stringify({ t: 'tour', tour: this.tourInfo(t) });
    for (const e of t.entrants) if (e.uid) this.send(this.users.get(e.uid), s);
    this.broadcastLobby();
  }

  createTour(u, m) {
    this.leaveTour(u);
    const id = `T${this.seq++}`;
    const t = {
      id, name: clean(m.name, 30) || `Tournoi de ${u.name}`, size: m.size === 8 ? 8 : 4, format: m.format === '1v1' ? '1v1' : '2v2',
      venue: clean(m.venue, 20) || 'club', sets: m.sets === 3 ? 3 : 1, difficulty: m.difficulty || 'medium',
      creator: u.uid, entrants: [{ uid: u.uid, name: u.name }], state: 'open', rounds: [], champion: null,
    };
    this.tours.set(id, t);
    u.tour = id;
    this.pushTour(t);
  }

  joinTour(u, id) {
    const t = this.tours.get(id);
    if (!t) return this.send(u, { t: 'error', msg: 'Tournoi introuvable.' });
    if (t.entrants.some((e) => e.uid === u.uid)) return this.pushTour(t);
    if (t.state !== 'open') return this.send(u, { t: 'error', msg: 'Les inscriptions sont closes.' });
    if (t.entrants.length >= t.size) return this.send(u, { t: 'error', msg: 'Le tableau est complet.' });
    this.leaveTour(u);
    t.entrants.push({ uid: u.uid, name: u.name });
    u.tour = id;
    this.pushTour(t);
    if (t.entrants.length === t.size) this.startTour(this.users.get(t.creator) || u, true);
  }

  leaveTour(u, disconnected = false) {
    const t = this.tours.get(u.tour);
    u.tour = null;
    if (!t) return;
    if (t.state === 'open') {
      t.entrants = t.entrants.filter((e) => e.uid !== u.uid);
      if (!t.entrants.length) { this.tours.delete(t.id); this.broadcastLobby(); return; }
      if (t.creator === u.uid) t.creator = t.entrants[0].uid;
    } else {
      // en cours : le joueur est remplacé par un bot (ses matchs à venir sont joués par l'IA)
      const e = t.entrants.find((x) => x.uid === u.uid);
      if (e) { e.uid = null; e.name = `${e.name} (bot)`; }
      this.runTour(t);
    }
    this.pushTour(t);
  }

  startTour(u, auto = false) {
    const t = this.tours.get(u?.tour);
    if (!t || t.state !== 'open' || (!auto && t.creator !== u.uid)) return;
    let b = 0;
    while (t.entrants.length < t.size) t.entrants.push({ uid: null, name: BOT_NAMES[b++ % BOT_NAMES.length] });
    // tirage au sort
    t.entrants.sort(() => Math.random() - 0.5);
    t.state = 'run';
    const first = [];
    for (let i = 0; i < t.size; i += 2) first.push({ a: i, b: i + 1, winner: null, room: null });
    t.rounds = [first];
    this.runTour(t);
  }

  /** Lance les matchs prêts du tour en cours ; bot contre bot : résultat tiré au sort. */
  runTour(t) {
    if (t.state !== 'run') return;
    const round = t.rounds[t.rounds.length - 1];
    for (const mt of round) {
      if (mt.winner != null || mt.room) continue;
      const A = t.entrants[mt.a], B = t.entrants[mt.b];
      const ua = A.uid && this.users.get(A.uid), ub = B.uid && this.users.get(B.uid);
      if (!ua && !ub) {
        const sa = Math.random() < 0.5;
        mt.winner = sa ? mt.a : mt.b;
        mt.score = sa ? '6-' + Math.floor(Math.random() * 5) : Math.floor(Math.random() * 5) + '-6';
        continue;
      }
      // un vrai joueur au moins : partie privée hébergée par le premier humain
      const hostU = ua || ub;
      if (hostU.room) this.leaveRoom(hostU);
      const label = `${t.name} · ${this.roundName(t, t.rounds.length - 1)}`;
      const room = this.createRoom(hostU, { format: t.format, venue: t.venue, sets: t.sets, difficulty: t.difficulty, priv: true }, { tour: { id: t.id, match: mt, label, sides: {} } });
      // camp proche = entrant a, camp lointain = entrant b ; les bots gardent leur nom
      room.slots.forEach((s) => { s.uid = null; });
      const near = room.slots.find((s) => s.side === 1), far = room.slots.find((s) => s.side === -1);
      near.uid = ua ? ua.uid : null; near.botName = ua ? null : A.name;
      far.uid = ub ? ub.uid : null; far.botName = ub ? null : B.name;
      room.members = [ua?.uid, ub?.uid].filter(Boolean);
      room.host = hostU.uid;
      if (ua) { room.tour.sides[ua.uid] = 1; ua.room = room.code; }
      if (ub) { room.tour.sides[ub.uid] = -1; if (ub.room && ub.room !== room.code) this.leaveRoom(ub); ub.room = room.code; }
      mt.room = room.code;
      this.launch(room);
    }
    if (round.every((mt) => mt.winner != null)) {
      if (round.length === 1) {
        t.state = 'done'; t.doneAt = Date.now();
        t.champion = round[0].winner;
        this.pushTour(t);
        return;
      }
      const next = [];
      for (let i = 0; i < round.length; i += 2) next.push({ a: round[i].winner, b: round[i + 1].winner, winner: null, room: null });
      t.rounds.push(next);
      this.pushTour(t);
      // petite pause entre deux tours pour voir le tableau
      setTimeout(() => this.runTour(t), 6000);
      return;
    }
    this.pushTour(t);
  }

  roundName(t, i) {
    const left = t.size / Math.pow(2, i);
    return left === 2 ? 'Finale' : left === 4 ? 'Demi-finale' : 'Quart de finale';
  }

  /** Résultat envoyé par l'hôte à la fin d'un match. */
  onResult(u, m) {
    const room = this.rooms.get(u.room);
    if (!room || room.host !== u.uid) return;
    if (room.tour) this.finishTourMatch(room, m.winner === -1 ? -1 : 1, clean(m.score, 40));
    else { room.state = 'done'; this.rooms.delete(room.code); for (const uid of room.members) { const x = this.users.get(uid); if (x) x.room = null; } this.broadcastLobby(); }
  }

  finishTourMatch(room, winnerSide, score = '') {
    const t = this.tours.get(room.tour.id);
    const mt = room.tour.match;
    this.rooms.delete(room.code);
    for (const uid of room.members) { const x = this.users.get(uid); if (x && x.room === room.code) x.room = null; }
    if (!t || mt.winner != null) return;
    mt.winner = winnerSide === 1 ? mt.a : mt.b;
    mt.score = score;
    mt.room = null;
    this.runTour(t);
  }
}
