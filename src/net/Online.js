// ============================================================================
//  Mode en ligne : connexion au serveur (WebSocket), salon, parties, partie
//  rapide et tournois. L'écran s'affiche dans le menu principal ; il se
//  navigue à la souris, au clavier ou à la manette (haut/bas, A, B).
// ============================================================================
import { makeAppearance } from '../entities/Appearance.js';
import { ask } from '../ui/Ask.js';
import { DIFFICULTY, PROFILES, flatStats } from '../config.js';

const FORMAT = { '1v1': '1 contre 1', '2v2': '2 contre 2' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Connexion au Hub. `send` met en file tant que la socket n'est pas ouverte. */
class Connection {
  constructor(url) {
    this.url = url;
    this.listeners = new Set();
    this.queue = [];
    this.status = 'idle';
  }
  open(hello) {
    this.hello = hello;
    this.status = 'connecting';
    const ws = this.ws = new WebSocket(this.url);
    ws.onopen = () => { this.status = 'open'; ws.send(JSON.stringify(hello)); for (const m of this.queue.splice(0)) ws.send(m); this.emit({ t: '_status' }); };
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } this.emit(m); };
    ws.onclose = () => { this.status = 'closed'; this.emit({ t: '_status' }); };
    ws.onerror = () => { this.status = 'error'; this.emit({ t: '_status' }); };
  }
  close() { try { this.ws?.close(); } catch { /* déjà fermée */ } this.status = 'idle'; }
  send(m) {
    const s = JSON.stringify(m);
    if (this.ws?.readyState === 1) this.ws.send(s); else if (this.status === 'connecting') this.queue.push(s);
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(m) { for (const fn of [...this.listeners]) fn(m); }
}

export function defaultServer() {
  const q = new URLSearchParams(location.search).get('server');
  if (q) return q.startsWith('ws') ? q : `wss://${q.replace(/^https?:\/\//, '')}/ws`;
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    // la page publiée sur claude.ai n'a pas de serveur : il faut le site du jeu
    if (/claude\.ai$|claudeusercontent/.test(location.hostname)) return null;
    return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  }
  return null;
}

export class OnlineUI {
  /**
   * @param {object} o
   * @param {Function} o.getProfile  () => { name, app, hand, stats } du joueur (personnage choisi)
   * @param {Function} o.getSettings () => réglages du menu exhibition (lieu, format, sets…)
   * @param {Function} o.startMatch  (opts) => lance le match
   * @param {Function} o.back        retour au menu
   * @param {Function} o.rerender    redessine l'écran
   */
  constructor(o) {
    Object.assign(this, o);
    this.view = 'connect';
    this.sel = 0;
    this.msg = null;
    this.lobby = { online: 0, rooms: [], tours: [] };
    this.room = null;
    this.tour = null;
    this.queued = null;
    this.code = '';
    this.inMatch = false;
    let name = '';
    try { name = localStorage.getItem('padel-arena.online-name') || ''; } catch { /* stockage indisponible */ }
    this.name = name;
    this.tourSize = 4;
    this.tourFormat = '2v2';
  }

  // ------------------------------------------------------------------ connexion
  connect() {
    const url = defaultServer();
    if (!url) { this.flash('Le mode en ligne fonctionne sur le site du jeu (pas dans l\'aperçu claude.ai).'); return; }
    const name = (this.name || this.getProfile().name || 'Joueur').slice(0, 18);
    try { localStorage.setItem('padel-arena.online-name', name); } catch { /* ignoré */ }
    const prof = this.getProfile();
    this.conn?.close();
    this.conn = new Connection(url);
    this.conn.on((m) => this.onMessage(m));
    this.conn.open({ t: 'hello', name, prof: { app: prof.app, hand: prof.hand, stats: prof.stats } });
    this.view = 'connecting';
    this.rerender();
  }

  onMessage(m) {
    switch (m.t) {
      case '_status':
        if (this.conn.status === 'closed' || this.conn.status === 'error') {
          if (this.inMatch) this.abortMatch?.('Connexion perdue');
          this.view = 'connect'; this.msg = 'Connexion au serveur perdue.';
        }
        break;
      case 'welcome': this.uid = m.uid; this.myName = m.name; if (this.view === 'connecting') this.view = 'lobby'; break;
      case 'lobby': this.lobby = m; break;
      case 'room': this.room = m.room; this.queued = null; if (!this.inMatch) this.view = 'room'; break;
      case 'queued': this.queued = m; this.view = 'queue'; break;
      case 'tour': this.tour = m.tour; if (!this.inMatch && this.view !== 'room') this.view = 'tour'; break;
      case 'go': this.onGo(m.room); return;
      case 'setup': if (!this.isHost) this.onSetup(m); return;
      case 'aborted':
        if (this.inMatch) this.abortMatch?.(m.msg);
        this.room = null; this.view = this.tour && this.tour.state !== 'done' ? 'tour' : 'lobby'; this.msg = m.msg;
        break;
      case 'error': this.msg = m.msg; break;
      default: return;            // messages de match : gérés par NetMatch
    }
    if (!this.inMatch) this.rerender();
  }

  flash(t) { this.msg = t; this.rerender(); }

  // ------------------------------------------------------------------ lancement d'un match
  netFor(role) {
    const c = this.conn;
    return { role, send: (m) => c.send(m), on: (fn) => c.on(fn) };
  }

  onGo(room) {
    this.room = room;
    this.isHost = room.host === this.uid;
    this.queued = null;
    if (!this.isHost) { this.view = 'waitsetup'; this.rerender(); return; }
    // l'hôte compose les équipes (bots compris) puis les envoie aux invités
    const cfg = room.cfg, diff = DIFFICULTY[cfg.difficulty] || DIFFICULTY.medium;
    let seed = (Math.random() * 1e9) | 0;
    const used = new Set(room.slots.map((s) => (s.name || s.botName || '').toUpperCase()));
    const botApp = (kit, over) => { let a; do { a = makeAppearance(kit, seed++, over); } while (used.has(a.name) && !over.name); used.add(a.name); return a; };
    const spec = (s) => {
      const kit = s.side > 0 ? 'blue' : 'red';
      if (s.uid) {
        const app = { ...(s.prof?.app || makeAppearance(kit, seed++)), name: (s.name || 'JOUEUR').toUpperCase() };
        return { uid: s.uid, name: s.name, lane: s.lane, hand: s.prof?.hand ?? 1, appearance: app, stats: s.prof?.stats || flatStats(0.62), human: s.uid === this.uid, remote: s.uid !== this.uid ? s.uid : undefined };
      }
      const app = botApp(kit, s.botName ? { name: s.botName.toUpperCase() } : {});
      return { name: s.botName || app.name, lane: s.lane, hand: 1, appearance: app, stats: flatStats(diff.level, { speed: Math.max(0.6, diff.level) }), bot: { diff, profile: PROFILES.varied } };
    };
    const order = (side) => room.slots.filter((s) => s.side === side).sort((a, b) => a.lane - b.lane).map(spec);
    const lineup = { near: order(1), far: order(-1) };
    const opts = this.matchOpts(room, lineup);
    opts.firstServer = Math.random() < 0.5 ? 1 : -1;
    opts.net = this.netFor('host');
    this.startOnline(opts);
    const party = this.partyFlags?.() || {};
    // les invités reçoivent tout ce qu'il faut pour reconstruire le même match
    const strip = (sp) => ({ uid: sp.uid, name: sp.name, lane: sp.lane, hand: sp.hand, appearance: sp.appearance, stats: sp.stats });
    this.conn.send({ t: 'setup', lineup: { near: lineup.near.map(strip), far: lineup.far.map(strip) }, firstServer: opts.firstServer, party: party.party ?? false, sono: party.sono ?? false });
  }

  onSetup(m) {
    if (!this.room) return;
    const mark = (sp) => ({ ...sp, human: sp.uid === this.uid, puppet: sp.uid !== this.uid });
    const lineup = { near: m.lineup.near.map(mark), far: m.lineup.far.map(mark) };
    const opts = this.matchOpts(this.room, lineup);
    Object.assign(opts, { firstServer: m.firstServer, party: m.party, sono: m.sono, net: this.netFor('client') });
    this.startOnline(opts);
  }

  matchOpts(room, lineup) {
    const c = room.cfg;
    return {
      mode: 'online', lineup, format: c.format, venue: c.venue, court: c.court, ambiance: c.ambiance, difficulty: c.difficulty,
      sets: c.stb ? 1 : c.sets, matchTiebreak: c.stb ? 10 : 0, golden: c.golden, replays: false,
      title: room.tour ? room.tour.label.toUpperCase() : 'MATCH EN LIGNE',
      onLeave: () => this.afterMatch(),
    };
  }

  startOnline(opts) {
    this.inMatch = true;
    this.startMatch(opts);
  }

  afterMatch() {
    this.inMatch = false;
    this.conn?.send({ t: 'leave' });
    this.room = null;
    this.view = this.tour && this.tour.entrants.some((e) => e.uid === this.uid || e.name.startsWith(this.myName)) ? 'tour' : 'lobby';
    this.conn?.send({ t: 'lobby' });
    this.show?.();
  }

  // ------------------------------------------------------------------ actions
  createRoom(priv) {
    const s = this.getSettings();
    this.conn.send({ t: 'create', cfg: { ...s, priv } });
  }

  actions() {
    const A = [];
    const add = (id, label, run, cls = '') => A.push({ id, label, run, cls });
    const v = this.view;
    if (v === 'connect') {
      add('name', 'Pseudo', async () => { const n = await ask('Votre pseudo en ligne', this.name || this.getProfile().name || '', { max: 18 }); if (n != null) { this.name = n.trim().slice(0, 18); this.rerender(); } }, 'field');
      add('go', 'Se connecter', () => this.connect(), 'primary');
    } else if (v === 'lobby') {
      add('q2', 'Partie rapide · 2 contre 2', () => this.conn.send({ t: 'quick', format: '2v2', cfg: this.getSettings() }), 'primary');
      add('q1', 'Partie rapide · 1 contre 1', () => this.conn.send({ t: 'quick', format: '1v1', cfg: this.getSettings() }));
      add('cr', 'Créer une partie entre amis', () => this.createRoom(true));
      add('cp', 'Créer une partie publique', () => this.createRoom(false));
      add('jn', 'Rejoindre avec un code', async () => { const c = await ask('Code de la partie (5 lettres)', '', { max: 5 }); if (c) this.conn.send({ t: 'join', code: c.trim().toUpperCase() }); });
      for (const r of this.lobby.rooms) {
        const free = r.slots.filter((s) => !s.uid).length;
        add(`r${r.code}`, `Rejoindre ${esc(r.hostName)} · ${FORMAT[r.cfg.format]} · ${free} place${free > 1 ? 's' : ''}`, () => this.conn.send({ t: 'join', code: r.code }), 'list');
      }
      add('tc', `Créer un tournoi · ${this.tourSize} joueurs · ${FORMAT[this.tourFormat]}`, () => {
        const s = this.getSettings();
        this.conn.send({ t: 'tcreate', size: this.tourSize, format: this.tourFormat, venue: s.venue, sets: s.sets, difficulty: s.difficulty, name: `Tournoi de ${this.myName}` });
      });
      add('ts', 'Taille du tournoi : 4 ou 8 joueurs', () => { this.tourSize = this.tourSize === 4 ? 8 : 4; this.rerender(); }, 'small');
      add('tf', 'Format du tournoi : 1c1 ou 2c2', () => { this.tourFormat = this.tourFormat === '2v2' ? '1v1' : '2v2'; this.rerender(); }, 'small');
      for (const t of this.lobby.tours.filter((x) => x.state === 'open')) {
        add(`t${t.id}`, `S'inscrire · ${esc(t.name)} · ${t.entrants.length}/${t.size}`, () => this.conn.send({ t: 'tjoin', id: t.id }), 'list');
      }
      add('dc', 'Se déconnecter', () => { this.conn.close(); this.view = 'connect'; this.rerender(); }, 'small');
    } else if (v === 'room') {
      if (this.room?.host === this.uid) add('st', 'Lancer le match', () => this.conn.send({ t: 'start' }), 'primary');
      add('lv', 'Quitter la partie', () => { this.conn.send({ t: 'leave' }); this.room = null; this.view = 'lobby'; this.rerender(); });
    } else if (v === 'queue') {
      add('uq', 'Annuler la recherche', () => { this.conn.send({ t: 'unquick' }); this.queued = null; this.view = 'lobby'; this.rerender(); });
    } else if (v === 'tour') {
      const t = this.tour;
      if (t?.state === 'open' && t.creator === this.uid) add('tg', 'Lancer le tournoi (les bots complètent)', () => this.conn.send({ t: 'tstart' }), 'primary');
      add('tl', t?.state === 'done' ? 'Retour au salon' : 'Quitter le tournoi', () => { if (t?.state !== 'done') this.conn.send({ t: 'tleave' }); this.tour = null; this.view = 'lobby'; this.rerender(); });
    } else if (v === 'connecting' || v === 'waitsetup') {
      add('cc', 'Annuler', () => { this.conn?.close(); this.view = 'connect'; this.rerender(); });
    }
    return A;
  }

  // ------------------------------------------------------------------ rendu
  render(body) {
    const A = this.actions();
    this.sel = Math.max(0, Math.min(this.sel, A.length - 1));
    let html = '<div class="m-head"><button class="m-back" data-back>‹</button><span>En ligne</span></div>';
    html += `<p class="m-lead">${this.lead()}</p>`;
    if (this.msg) html += `<p class="m-lead warn">${esc(this.msg)}</p>`;
    html += this.panel();
    html += '<div class="rows on-actions">';
    A.forEach((a, i) => {
      const val = a.id === 'name' ? esc(this.name || this.getProfile().name || 'Joueur') : '';
      html += `<div class="row action on-${a.cls || 'btn'}${i === this.sel ? ' sel' : ''}" data-i="${i}"><span class="lbl">${a.label}</span><span class="val">${val}</span><span class="go">›</span></div>`;
    });
    html += '</div><div class="m-foot"><span><kbd data-menu="B">B</kbd> Retour</span><span><kbd data-menu="A">A</kbd> Valider</span></div>';
    body.className = 'm-body m-online';
    body.innerHTML = html;
    body.querySelector('[data-back]').addEventListener('click', () => this.goBack());
    body.querySelectorAll('[data-i]').forEach((el) => {
      const i = +el.dataset.i;
      el.addEventListener('click', () => { this.sel = i; this.msg = null; A[i].run(); });
    });
  }

  lead() {
    switch (this.view) {
      case 'connect': return 'Jouez contre vos amis ou d\'autres joueurs, en 1 contre 1 ou en 2 contre 2 (les places libres sont prises par des bots). Votre personnage est celui choisi en exhibition.';
      case 'connecting': return 'Connexion au serveur…';
      case 'lobby': return `${this.lobby.online} joueur${this.lobby.online > 1 ? 's' : ''} en ligne · connecté en tant que <b>${esc(this.myName)}</b>. Le lieu et la durée suivent vos réglages d'exhibition.`;
      case 'room': return this.room?.host === this.uid ? 'Donnez le code à vos amis. Lancez quand vous voulez : les places vides seront tenues par des bots.' : 'En attente du lancement par le créateur de la partie…';
      case 'queue': return `Recherche d'adversaires en ${FORMAT[this.queued?.format] || ''}… ${this.queued?.waiting || 1} joueur(s) dans la file.${this.queued?.format === '2v2' ? ' Le match démarre à 4, ou dès 2 joueurs après 15 secondes (bots en renfort).' : ''}`;
      case 'tour': return this.tour?.state === 'open' ? 'Inscriptions ouvertes. Le tournoi démarre quand le tableau est complet, ou quand le créateur le lance.' : this.tour?.state === 'done' ? 'Tournoi terminé.' : 'Tournoi en cours : votre prochain match se lance automatiquement.';
      case 'waitsetup': return 'Le match se prépare…';
      default: return '';
    }
  }

  panel() {
    if (this.view === 'room' && this.room) {
      const r = this.room;
      const side = (sd) => r.slots.filter((s) => s.side === sd).map((s) => `<div class="on-slot${s.uid === this.uid ? ' me' : ''}">${s.uid ? esc(s.name) : `<i>${esc(s.botName || 'Bot')}</i>`}</div>`).join('');
      return `<div class="on-room"><div class="on-code"><small>CODE</small>${r.code}</div>
        <div class="on-teams"><div class="on-team near">${side(1)}</div><b>VS</b><div class="on-team far">${side(-1)}</div></div>
        <small class="on-cfg">${FORMAT[r.cfg.format]} · ${esc(r.cfg.venue)} · ${r.cfg.stb ? 'super tie-break' : r.cfg.sets === 3 ? '2 sets gagnants' : '1 set'}</small></div>`;
    }
    if (this.view === 'tour' && this.tour) {
      const t = this.tour;
      const nm = (i) => (i == null ? '…' : esc(t.entrants[i]?.name || '?'));
      let html = `<div class="on-tour"><div class="on-tname">${esc(t.name)} <small>${FORMAT[t.format]} · ${t.size} joueurs</small></div>`;
      if (t.state === 'open') html += `<div class="on-entrants">${t.entrants.map((e) => `<span${e.uid === this.uid ? ' class="me"' : ''}>${esc(e.name)}</span>`).join('')}${'<span class="empty">libre</span>'.repeat(t.size - t.entrants.length)}</div>`;
      else {
        html += '<div class="on-bracket">';
        t.rounds.forEach((r, ri) => {
          const left = t.size / Math.pow(2, ri);
          html += `<div class="on-round"><small>${left === 2 ? 'Finale' : left === 4 ? 'Demies' : 'Quarts'}</small>`;
          for (const mt of r) html += `<div class="on-match${mt.live ? ' live' : ''}"><span class="${mt.winner === mt.a ? 'w' : ''}">${nm(mt.a)}</span><span class="${mt.winner === mt.b ? 'w' : ''}">${nm(mt.b)}</span>${mt.score ? `<em>${esc(mt.score)}</em>` : mt.live ? '<em>en cours</em>' : ''}</div>`;
          html += '</div>';
        });
        html += '</div>';
        if (t.champion != null) html += `<div class="on-champ">🏆 ${nm(t.champion)}</div>`;
      }
      return html + '</div>';
    }
    return '';
  }

  goBack() {
    if (this.view === 'room') { this.conn.send({ t: 'leave' }); this.room = null; this.view = 'lobby'; this.rerender(); return; }
    if (this.view === 'queue') { this.conn.send({ t: 'unquick' }); this.view = 'lobby'; this.rerender(); return; }
    if (this.view === 'tour') { this.view = 'lobby'; this.rerender(); return; }
    this.back();
  }

  update(m) {
    const A = this.actions();
    if (m.up) { this.sel = (this.sel + A.length - 1) % A.length; this.rerender(); }
    if (m.down) { this.sel = (this.sel + 1) % A.length; this.rerender(); }
    if (m.confirm && A[this.sel]) { this.msg = null; A[this.sel].run(); }
    else if (m.back) this.goBack();
  }
}
