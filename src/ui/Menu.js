// ============================================================================
//  Menu principal, navigable à la manette (haut/bas = ligne, gauche/droite =
//  valeur, A = valider, B = retour), au clavier et à la souris.
//   accueil      choix du mode (tuiles)
//   exhibition   réglages du match puis JOUER
//   training     ateliers d'entraînement libres
//   settings     ambiance, son, graphismes, contrôles
//   controls     configurations de manette + réassignation
// ============================================================================
import { ACTIONS, PRESETS } from '../input/InputManager.js';
import { DRILLS } from '../core/Drills.js';
import { characterList } from '../career/Characters.js';
import { isUnlocked, advUnlocks } from '../career/data/shop.js';
import { ask, notice } from './Ask.js';

const COURT_OPTS = [[0, 'Court central'], [1, 'Court 2'], [2, 'Court 3'], [3, 'Court 4'], [4, 'Court 5']];
const MULTI = { ceyreste: 5, club: 3, hangar: 4, laciotat: 4, national: 2, prestige: 5 };

const EXHIBITION = [
  { key: 'venue', label: 'Terrain', options: [['club', 'Padel Arena Club']], when: () => false },
  { key: 'court', label: 'Court', options: COURT_OPTS, when: () => false },
  { key: 'format', label: 'Format', options: [['2v2', '2 contre 2'], ['1v1', '1 contre 1']] },
  { key: 'lane', label: 'Votre côté', options: [[-1, 'Gauche (revers)'], [1, 'Droite (drive)']], when: (v) => v.format === '2v2' },
  { key: 'mate', label: 'Partenaire', options: [['bot', 'Bot']], when: () => false },
  { key: 'partner', label: 'Style du bot partenaire', options: [['varied', 'Varié'], ['attacker', 'Attaquant au filet'], ['baseline', 'Fond de court']], when: (v) => v.format === '2v2' && v.mate === 'bot' },
  { key: 'opp1', label: 'Adversaire 1', options: [['bot', 'Bot']], when: () => false },
  { key: 'opp2', label: 'Adversaire 2', options: [['bot', 'Bot']], when: () => false },
  { key: 'profile', label: 'Adversaires', options: [['varied', 'Varié'], ['baseline', 'Fond de court'], ['attacker', 'Attaquants au filet']] },
];

const MATCH = [
  { key: 'ambiance', label: 'Ambiance', options: [['sunset', 'Fin de journée'], ['day', 'Journée'], ['night', 'Soirée']] },
  { key: 'difficulty', label: 'Difficulté', options: [['easy', 'Facile'], ['medium', 'Moyen'], ['strong', 'Confirmé'], ['hard', 'Expert']], index: 1 },
  { key: 'sets', label: 'Durée', options: [[1, '1 set'], [3, '2 sets gagnants'], ['stb', 'Super tie-break']] },
  { key: 'golden', label: 'Point en or', options: [[true, 'Oui'], [false, 'Avantages']] },
];

const SETTINGS = [
  { key: 'music', label: 'Musique et ambiance sonore', options: [['on', 'Oui'], ['off', 'Non']] },
  { key: 'commentary', label: 'Commentaire vocal', options: [['on', 'Oui'], ['off', 'Non']] },
  { key: 'quality', label: 'Graphismes', options: [['high', 'Élevés'], ['low', 'Performance']] },
];

export class Menu {
  constructor({ input, onStart, onAmbiance, onCareer, onTraining, hasCareer, getCareer, onPreview, onVenue }) {
    this.onVenue = onVenue || (() => {});
    this.getCareer = getCareer || (() => null);
    this.onPreview = onPreview || (() => {});
    this.character = null;
    this.input = input;
    this.onStart = onStart;
    this.onAmbiance = onAmbiance;
    this.onCareer = onCareer;
    this.onTraining = onTraining;
    this.hasCareer = hasCareer || (() => false);
    this.el = document.getElementById('menu');
    this.body = this.el.querySelector('.m-body');
    this.visible = true;
    this.capturing = null;
    const choice = (r) => ({ type: 'choice', ...r, index: r.index ?? 0 });

    this.screens = {
      home: {
        title: null, tiles: true,
        rows: [
          { type: 'tile', label: 'Carrière', sub: 'Du tournoi de quartier au n° 1 mondial', cls: 'hero', run: () => { this.hide(); this.onCareer?.(); } },
          { type: 'tile', label: 'Aventure', sub: 'Une histoire, des choix, des rivaux', run: () => this.open('adventure') },
          { type: 'tile', label: 'Exhibition', sub: 'Un match rapide, vos réglages', run: () => this.open('exhibition') },
          { type: 'tile', label: 'Boutique', sub: 'Raquettes, tenues, terrains', run: () => { this.hide(); this.onCareerScreen?.('shop'); } },
          { type: 'tile', label: 'Mon joueur', sub: 'Apparence, tenue, équipement', run: () => { this.hide(); this.onCareerScreen?.('editor'); } },
          { type: 'tile', label: 'En ligne', sub: 'Matchs et tournois contre d\'autres joueurs', run: () => this.open('online') },
          { type: 'tile', label: 'Entraînement', sub: 'Ateliers libres', run: () => this.open('training') },
          { type: 'tile', label: 'Regarder', sub: 'Match entre bots', run: () => this.start({ mode: 'demo' }) },
          { type: 'tile', label: 'Paramètres', sub: 'Image, son, manette', run: () => this.open('settings') },
        ],
      },
      exhibition: {
        title: 'Exhibition', back: 'home',
        rows: [
          { type: 'action', label: 'Personnage', valueFn: () => this.charLabel(), run: () => this.open('character') },
          { type: 'action', label: 'Lieu et court', valueFn: () => this.venueLabel(), run: () => this.open('venue') },
          { type: 'action', label: 'Partenaire', valueFn: () => this.pickLabel('mate'), run: () => this.openPick('mate'), when: (v) => v.format === '2v2' },
          { type: 'action', label: 'Adversaire 1', valueFn: () => this.pickLabel('opp1'), run: () => this.openPick('opp1') },
          { type: 'action', label: 'Adversaire 2', valueFn: () => this.pickLabel('opp2'), run: () => this.openPick('opp2'), when: (v) => v.format === '2v2' },
          ...EXHIBITION.map(choice),
          { type: 'action', label: 'Paramètres de la partie', valueFn: () => this.matchLabel(), run: () => this.open('match') },
          { type: 'play', label: 'JOUER' },
        ],
      },
      match: { title: 'Paramètres de la partie', back: 'exhibition', rows: [...MATCH.map(choice), { type: 'action', label: 'Valider', value: '', run: () => this.open('exhibition') }] },
      character: { title: 'Personnage', back: 'exhibition', grid: true, rows: [] },
      online: { title: 'En ligne', back: 'home', custom: true, rows: [] },
      adventure: { title: 'Aventure', back: 'home', custom: true, rows: [] },
      venue: { title: 'Lieu', back: 'exhibition', grid: 'venue', rows: [] },
      court: { title: 'Court', back: 'venue', grid: 'court', rows: [] },
      pick: { title: 'Choisir un joueur', back: 'exhibition', grid: 'pick', rows: [] },
      training: {
        title: 'Entraînement', back: 'home', lead: 'Ateliers libres : rien n\'est enregistré. En carrière, ils font progresser votre joueur.',
        rows: Object.entries(DRILLS).map(([id, d]) => ({ type: 'action', label: d.label, value: d.icon, run: () => { this.hide(); this.onTraining?.(id); } })),
      },
      settings: { title: 'Paramètres', back: 'home', lead: 'L\'ambiance (jour / soirée) se règle dans les paramètres de la partie, en exhibition.', rows: [...SETTINGS.map(choice), { type: 'action', label: 'Manette et contrôles', value: '', run: () => this.open('controls') }, { type: 'action', label: 'Code secret', valueFn: () => (isUnlocked() ? 'Tout est débloqué' : ''), run: () => this.enterCode() }] },
      controls: {
        title: 'Contrôles', back: 'settings', note: true,
        rows: [
          { type: 'choice', key: 'preset', label: 'Configuration', options: [['face', PRESETS.face.label], ['triggers', PRESETS.triggers.label], ['custom', 'Personnalisée']], index: 0 },
          ...ACTIONS.map((a) => ({ type: 'bind', action: a.id, label: a.label })),
        ],
      },
    };
    // partenaire et adversaires : tous les personnages du jeu
    const people = [['bot', 'Bot'], ...characterList().map((c) => [c.id, `${c.npc.name} (${c.npc.ovr})`])];
    for (const r of this.screens.exhibition.rows) if (['mate', 'opp1', 'opp2'].includes(r.key)) r.options = people;
    for (const s of Object.values(this.screens)) s.sel = 0;
    this.syncPreset();
    this.open('home');
  }

  // ------------------------------------------------------------------ rendu
  vals(screen = this.screens.exhibition) {
    const o = {};
    for (const r of screen.rows) if (r.type === 'choice') o[r.key] = r.options[r.index][0];
    return o;
  }

  visibleRows(s) {
    const v = this.vals(s);
    return s.rows.filter((r) => !r.when || r.when(v, { hasCareer: this.hasCareer() }));
  }

  /** Le décor derrière le menu suit le terrain, le court et l'ambiance choisis. */
  applyBackground() {
    const v = { ...this.vals(this.screens.exhibition), ...this.vals(this.screens.match) };
    this.onVenue(v.venue, MULTI[v.venue] ? v.court : 0, v.ambiance);
  }

  open(name) {
    if (name === 'exhibition' && this.cur === 'home') this.applyBackground();
    if (this.cur === 'character' && name !== 'character') this.onPreview(null);
    this.cur = name;
    if (name === 'character') this.buildCharacters();
    if (name === 'venue') this.buildVenues();
    if (name === 'court') this.buildCourts();
    const s = this.screens[name];
    if (name === 'controls') s.sel = 0;
    this.render();
  }

  render() {
    const s = this.screens[this.cur];
    if (s.custom) { const u = this.cur === 'adventure' ? this.adventure : this.online; if (u) u.render(this.body); return; }
    if (s.grid) return this.renderGrid(s);
    const rows = this.visibleRows(s);
    s.sel = Math.min(s.sel, rows.length - 1);
    this.body.className = `m-body m-${this.cur}`;
    let html = s.title ? `<div class="m-head"><button class="m-back" data-back>‹</button><span>${s.title}</span></div>` : '';
    if (s.lead) html += `<p class="m-lead">${s.lead}</p>`;
    html += `<div class="${s.tiles ? 'm-tiles' : 'rows'}">`;
    rows.forEach((r, i) => {
      const sel = i === s.sel ? ' sel' : '';
      if (r.type === 'tile') html += `<button class="m-tile ${r.cls || ''}${sel}" data-i="${i}"><b>${r.label}</b><small>${r.sub}</small></button>`;
      else if (r.type === 'play') html += `<button class="play${sel}" data-i="${i}">${r.label} <span class="btnhint"><kbd data-menu="A">A</kbd></span></button>`;
      else if (r.type === 'choice') {
        html += `<div class="row choice${sel}" data-i="${i}"><span class="lbl">${r.label}</span>
          <button class="arrow" data-d="-1">‹</button><span class="val">${r.options[r.index][1]}</span><button class="arrow" data-d="1">›</button></div>`;
      } else if (r.type === 'bind') {
        const kb = { A: 'K', X: 'J', Y: 'I', B: 'L' }[r.action] || '';
        const val = this.capturing === r.action ? '<span class="wait">Appuyez sur un bouton…</span>'
          : `<kbd class="pad">${this.input.buttonName(this.input.mapping[r.action])}</kbd>${kb ? `<kbd class="kb">${kb}</kbd>` : ''}`;
        html += `<div class="row bind${sel}${this.capturing === r.action ? ' capturing' : ''}" data-i="${i}"><span class="lbl">${r.label}</span><span class="val">${val}</span><span class="go">›</span></div>`;
      } else html += `<div class="row action${sel}" data-i="${i}"><span class="lbl">${r.label}</span><span class="val">${r.valueFn ? r.valueFn() : r.value || ''}</span><span class="go">›</span></div>`;
    });
    html += '</div>';
    if (s.note) html += `<p class="note">${this.noteText()}</p>`;
    html += `<div class="m-foot">${s.back ? '<span><kbd data-menu="B">B</kbd> Retour</span>' : ''}<span><kbd data-menu="A">A</kbd> Valider</span></div>`;
    this.body.innerHTML = html;
    this.body.querySelector('[data-back]')?.addEventListener('click', () => this.open(s.back));
    this.body.querySelectorAll('[data-i]').forEach((el) => {
      const i = +el.dataset.i;
      el.addEventListener('mouseenter', () => { if (!this.capturing && s.sel !== i) { s.sel = i; this.render(); } });
      el.addEventListener('click', (e) => {
        const d = e.target.closest('.arrow')?.dataset.d;
        if (d) this.change(rows[i], +d); else this.activate(rows[i]);
      });
    });
  }

  noteText() {
    if (this._flash) return `<span class="warn">${this._flash}</span>`;
    return this.input.padType === 'keyboard'
      ? 'Aucune manette détectée : branchez-la puis appuyez sur un bouton. Le clavier utilise K, J, I, L.'
      : this.input.preset === 'triggers'
        ? 'Gâchettes : le pouce droit reste sur le stick de visée pendant la frappe.'
        : 'Sélectionnez une action puis appuyez sur le bouton souhaité (Échap pour annuler).';
  }

  syncPreset() {
    const r = this.screens.controls.rows[0];
    r.index = r.options.findIndex((o) => o[0] === this.input.preset);
    if (r.index < 0) r.index = 2;
  }

  change(r, d) {
    if (r.type !== 'choice') return;
    if (r.key === 'preset') {
      this.input.setPreset(this.input.preset === 'triggers' ? 'face' : 'triggers');
      this.syncPreset();
    } else {
      r.index = (r.index + d + r.options.length) % r.options.length;
      if (r.key === 'ambiance') this.onAmbiance?.(r.options[r.index][0]);
      if (r.key === 'venue') { const c = this.screens.exhibition.rows.find((x) => x.key === 'court'); c.options = COURT_OPTS.slice(0, MULTI[r.options[r.index][0]] || 1); c.index = 0; }
      if (r.key === 'venue' || r.key === 'court') this.applyBackground();
    }
    this.render();
  }

  activate(r) {
    if (!r) return;
    if (r.type === 'choice') this.change(r, 1);
    else if (r.type === 'tile' || r.type === 'action') r.run();
    else if (r.type === 'play') this.start();
    else if (r.type === 'bind') {
      if (this.input.padType === 'keyboard') {
        this._flash = 'Branchez une manette et appuyez sur un bouton pour la réassigner.';
        clearTimeout(this._flashT);
        this._flashT = setTimeout(() => { this._flash = null; if (this.cur === 'controls') this.render(); }, 2500);
        this.render();
        return;
      }
      this.capturing = r.action;
      this.render();
      this.input.startCapture((idx) => {
        this.capturing = null;
        if (idx != null) this.input.assign(r.action, idx);
        this.syncPreset();
        this.render();
      });
    }
  }

  // ------------------------------------------------------------------ personnages
  currentChar() {
    const c = this.getCareer();
    if (this.character && this.character !== 'career') return this.character;
    return c ? 'career' : 'standard';
  }

  charLabel() {
    const id = this.currentChar();
    if (id === 'career') return 'Mon joueur (carrière)';
    if (id === 'standard') return 'Joueur standard';
    return characterList().find((x) => x.id === id)?.npc.name || 'Joueur standard';
  }

  matchLabel() {
    const v = this.vals(this.screens.match);
    const d = MATCH.find((r) => r.key === 'difficulty').options.find((o) => o[0] === v.difficulty)[1];
    const st = MATCH.find((r) => r.key === 'sets').options.find((o) => o[0] === v.sets)[1];
    return `${d} · ${st}${v.golden ? ' · point en or' : ''}`;
  }

  buildCharacters() {
    const c = this.getCareer();
    const s = this.screens.character;
    const items = [{ id: 'standard', name: 'Joueur standard', cat: 'Libre', ovr: 62, free: true }];
    if (c) items.push({ id: 'career', name: c.s.profile.name, cat: 'Ma carrière', ovr: c.ovr, free: true });
    for (const ch of characterList()) {
      const owned = c ? c.hasChar(ch.id) : (isUnlocked() || advUnlocks().includes(`char:${ch.id}`));
      items.push({ id: ch.id, name: ch.npc.name, cat: ch.cat, ovr: ch.npc.ovr, hand: ch.npc.hand, free: owned, mission: ch.mission, price: ch.price });
    }
    s.items = items;
    s.sel = Math.max(0, items.findIndex((x) => x.id === this.currentChar()));
    s.msg = null;
    s.confirmBuy = null;
  }

  async enterCode() {
    const code = await ask('Code secret', '', { placeholder: 'Entrez le code' });
    if (code == null) return;
    const ok = this.onCode?.(code);
    notice(ok ? 'Code accepté : tous les terrains et tous les personnages sont débloqués.' : 'Code incorrect.');
    this.render();
  }

  // ------------------------------------------------------------------ lieux (grille comme les personnages)
  pickLabel(key) {
    const r = this.screens.exhibition.rows.find((x) => x.key === key);
    return r.options[r.index][1];
  }

  openPick(key) {
    this.pickKey = key;
    const s = this.screens.pick, r = this.screens.exhibition.rows.find((x) => x.key === key);
    s.title = { mate: 'Ton partenaire', opp1: 'Adversaire 1', opp2: 'Adversaire 2' }[key];
    s.items = [{ id: 'bot', name: 'Bot', cat: 'Joueur généré', sub: 'Niveau selon la difficulté', free: true },
      ...characterList().map((c) => ({ id: c.id, name: c.npc.name, cat: c.cat, sub: `Note ${c.npc.ovr}${c.npc.hand === 'L' ? ' · gaucher' : ''}`, free: true }))];
    s.sel = Math.max(0, s.items.findIndex((x) => x.id === r.options[r.index][0]));
    s.msg = null;
    this.cur = 'pick';
    this.render();
  }

  venueLabel() {
    const v = this.vals(this.screens.exhibition);
    const r = this.screens.exhibition.rows.find((x) => x.key === 'venue');
    const name = r.options[r.index][1];
    return MULTI[v.venue] ? `${name} · ${COURT_OPTS[v.court][1]}` : name;
  }

  buildVenues() {
    const s = this.screens.venue, r = this.screens.exhibition.rows.find((x) => x.key === 'venue');
    const all = this._allVenues || r.options.map((o) => ({ id: o[0], name: o[1], owned: true }));
    s.items = all.map((v) => ({ ...v, free: v.owned, cat: v.cat || 'Lieux', sub: MULTI[v.id] ? `${MULTI[v.id]} courts` : '1 court' }));
    s.sel = Math.max(0, s.items.findIndex((x) => x.id === r.options[r.index][0]));
    s.msg = null;
  }

  buildCourts() {
    const s = this.screens.court, v = this.vals(this.screens.exhibition);
    s.items = COURT_OPTS.slice(0, MULTI[v.venue] || 1).map((o) => ({ id: o[0], name: o[1], free: true, cat: this.venueLabel().split(' · ')[0], sub: o[0] === 0 ? 'Court principal' : 'Court annexe' }));
    s.sel = v.court || 0;
    s.msg = null;
  }

  setPlace(venue, court) {
    const ex = this.screens.exhibition.rows, r = ex.find((x) => x.key === 'venue'), c = ex.find((x) => x.key === 'court');
    if (venue != null) { r.index = Math.max(0, r.options.findIndex((o) => o[0] === venue)); c.options = COURT_OPTS.slice(0, MULTI[venue] || 1); c.index = 0; }
    if (court != null) c.index = Math.min(court, c.options.length - 1);
    this.applyBackground();
  }

  renderPlaceGrid(s) {
    let html = `<div class="m-head"><button class="m-back" data-back>‹</button><span>${s.title}</span></div>
      <p class="m-lead">${s.grid === 'pick' ? 'Survolez un joueur pour le voir. A : choisir.' : s.grid === 'venue' ? 'Le décor derrière le menu change quand vous survolez un lieu.' : 'Choisissez le court sur lequel jouer.'}</p>`;
    if (s.msg) html += `<p class="m-lead warn">${s.msg}</p>`;
    html += '<div class="m-chars">';
    let cat = null;
    const curV = this.vals(this.screens.exhibition);
    s.items.forEach((it, i) => {
      if (it.cat !== cat) { cat = it.cat; html += `<div class="m-cat">${cat}</div>`; }
      const cur = s.grid === 'pick' ? it.id === curV[this.pickKey] : s.grid === 'venue' ? it.id === curV.venue : it.id === curV.court;
      const lock = it.free ? '' : `<i class="lock">${it.price ? it.price + ' pts' : 'Boutique'}</i>`;
      html += `<button class="m-char${i === s.sel ? ' sel' : ''}${it.free ? '' : ' locked'}${cur ? ' cur' : ''}" data-i="${i}"><b>${it.name}</b><span>${it.sub}</span>${lock}</button>`;
    });
    html += '</div>';
    const it = s.items[s.sel];
    const info = it.free ? (s.grid === 'venue' && MULTI[it.id] ? 'A : choisir puis le court' : 'A : choisir') : 'Se débloque dans la boutique de carrière';
    html += `<div class="m-foot"><span><kbd data-menu="B">B</kbd> Retour</span><span>${info}</span></div>`;
    this.body.className = 'm-body m-character';
    this.body.innerHTML = html;
    this.body.querySelector('[data-back]').addEventListener('click', () => this.leavePlace(s));
    this.body.querySelectorAll('[data-i]').forEach((el) => {
      const i = +el.dataset.i;
      el.addEventListener('click', () => { if (s.sel !== i) { s.sel = i; this.focusPlace(s); } else this.pickPlace(s); });
    });
    this.body.querySelector('.m-char.sel')?.scrollIntoView({ block: 'nearest' });
  }

  focusPlace(s) {
    const it = s.items[s.sel];
    if (s.grid === 'pick') { this.onPreview(it.id === 'bot' ? null : it.id); this.render(); return; }
    if (s.grid === 'venue') this.onVenue(it.id, 0, this.vals(this.screens.match).ambiance);
    else this.onVenue(this.vals(this.screens.exhibition).venue, it.id, this.vals(this.screens.match).ambiance);
    this.render();
  }

  leavePlace(s) { if (s.grid === 'pick') this.onPreview(null); this.applyBackground(); this.open(s.back); }

  pickPlace(s) {
    const it = s.items[s.sel];
    if (s.grid === 'pick') {
      const r = this.screens.exhibition.rows.find((x) => x.key === this.pickKey);
      r.index = Math.max(0, r.options.findIndex((o) => o[0] === it.id));
      this.onPreview(null); this.applyBackground(); this.open('exhibition'); return;
    }
    if (!it.free) { s.msg = `${it.name} se débloque dans la boutique de carrière${it.price ? ` (${it.price} points)` : ''}.`; this.render(); return; }
    if (s.grid === 'venue') { this.setPlace(it.id); this.open(MULTI[it.id] ? 'court' : 'exhibition'); }
    else { this.setPlace(null, it.id); this.open('exhibition'); }
  }

  renderGrid(s) {
    if (s.grid !== true) return this.renderPlaceGrid(s);
    const c = this.getCareer();
    const pts = c ? `${c.s.shopPts} points boutique` : 'Créez une carrière pour gagner des points boutique';
    let html = `<div class="m-head"><button class="m-back" data-back>‹</button><span>${s.title}</span></div>
      <p class="m-lead">${pts} · les joueurs gardent leurs attributs de carrière.</p>`;
    if (s.msg) html += `<p class="m-lead warn">${s.msg}</p>`;
    html += '<div class="m-chars">';
    let cat = null;
    s.items.forEach((it, i) => {
      if (it.cat !== cat) { cat = it.cat; html += `<div class="m-cat">${cat}</div>`; }
      const lock = it.free ? '' : it.mission ? `<i class="lock">Mission</i>` : `<i class="lock">${it.price} pts</i>`;
      html += `<button class="m-char${i === s.sel ? ' sel' : ''}${it.free ? '' : ' locked'}${it.id === this.currentChar() ? ' cur' : ''}" data-i="${i}">
        <b>${it.name}</b><span>Note ${it.ovr}${it.hand === 'L' ? ' · gaucher' : ''}</span>${lock}</button>`;
    });
    html += '</div>';
    const it = s.items[s.sel];
    const info = it.free ? 'A : choisir ce joueur' : it.mission ? `Mission : ${it.mission}` : s.confirmBuy === it.id ? `A : confirmer l'achat (${it.price} points)` : `A : acheter (${it.price} points)`;
    html += `<div class="m-foot"><span><kbd data-menu="B">B</kbd> Retour</span><span>${info}</span></div>`;
    this.body.className = 'm-body m-character';
    this.body.innerHTML = html;
    this.body.querySelector('[data-back]').addEventListener('click', () => this.open('exhibition'));
    this.body.querySelectorAll('[data-i]').forEach((el) => {
      const i = +el.dataset.i;
      el.addEventListener('click', () => { if (s.sel !== i) { s.sel = i; s.confirmBuy = null; this.focusChar(); } else this.pickChar(); });
    });
    this.body.querySelector('.m-char.sel')?.scrollIntoView({ block: 'nearest' });
  }

  focusChar() {
    const s = this.screens.character;
    this.onPreview(s.items[s.sel].id);
    this.render();
  }

  pickChar() {
    const s = this.screens.character, it = s.items[s.sel], c = this.getCareer();
    if (it.free) { this.character = it.id; this.open('exhibition'); return; }
    if (it.mission) { s.msg = `Personnage verrouillé. ${it.mission}.`; this.render(); return; }
    if (!c) { s.msg = 'Les points boutique se gagnent en carrière.'; this.render(); return; }
    if (s.confirmBuy !== it.id) { s.confirmBuy = it.id; s.msg = null; this.render(); return; }
    const r = c.buyChar(it.id);
    s.confirmBuy = null;
    if (!r.ok) { s.msg = r.error; this.render(); return; }
    it.free = true;
    s.msg = `${it.name} est maintenant jouable !`;
    this.render();
  }

  updateGrid(s, m) {
    const n = s.items.length, cols = window.innerWidth < 600 ? 2 : 3;
    let d = 0;
    if (m.left) d = -1; if (m.right) d = 1; if (m.up) d = -cols; if (m.down) d = cols;
    const place = s.grid !== true;
    if (d) { s.sel = Math.max(0, Math.min(n - 1, s.sel + d)); s.confirmBuy = null; if (place) this.focusPlace(s); else this.focusChar(); }
    if (m.confirm) { if (place) this.pickPlace(s); else this.pickChar(); }
    else if (m.back) { if (place) this.leavePlace(s); else this.open('exhibition'); }
  }

  /** Terrains disponibles en exhibition (achetés en carrière). */
  setVenues(list, all) {
    this._allVenues = all || null;
    const r = this.screens.exhibition.rows.find((x) => x.key === 'venue');
    const cur = r.options[r.index]?.[0];
    r.options = list;
    r.index = Math.max(0, list.findIndex((o) => o[0] === cur));
    const c = this.screens.exhibition.rows.find((x) => x.key === 'court');
    c.options = COURT_OPTS.slice(0, MULTI[r.options[r.index][0]] || 1); c.index = Math.min(c.index, c.options.length - 1);
    if (this.visible) this.render();
  }

  /** Réglages communs (paramètres) + réglages d'exhibition. */
  values() {
    const o = { mode: 'quick', ...this.vals(this.screens.settings), ...this.vals(this.screens.exhibition), ...this.vals(this.screens.match), character: this.currentChar() };
    if (!MULTI[o.venue]) o.court = 0;
    if (o.sets === 'stb') { o.sets = 1; o.matchTiebreak = 10; }
    return o;
  }

  start(extra = {}) {
    this.hide();
    this.onStart({ ...this.values(), ...extra });
  }

  show() { this.visible = true; this.el.classList.remove('hidden'); this.open('home'); }
  hide() { this.visible = false; this.el.classList.add('hidden'); }

  update() {
    if (this.capturing) return;
    if (this._ver !== this.input.version) { this._ver = this.input.version; this.syncPreset(); if (this.cur === 'controls') this.render(); }
    const m = this.input.menu;
    // Start depuis le menu : paramètres
    if (this.input.pressed.START && this.cur !== 'settings' && this.cur !== 'controls') { this.open('settings'); return; }
    const s = this.screens[this.cur];
    if (s.custom) { (this.cur === 'adventure' ? this.adventure : this.online)?.update(m); return; }
    if (s.grid) return this.updateGrid(s, m);
    const rows = this.visibleRows(s);
    const n = rows.length;
    // l'accueil est une grille de tuiles (2 colonnes, la carrière en pleine largeur)
    if (s.tiles) {
      if (m.left || m.up) { s.sel = (s.sel + n - 1) % n; this.render(); }
      if (m.right || m.down) { s.sel = (s.sel + 1) % n; this.render(); }
    } else {
      if (m.up) { s.sel = (s.sel + n - 1) % n; this.render(); }
      if (m.down) { s.sel = (s.sel + 1) % n; this.render(); }
      const r = rows[s.sel];
      if (r?.type === 'choice') {
        if (m.left) this.change(r, -1);
        if (m.right) this.change(r, 1);
      }
    }
    if (m.confirm) this.activate(rows[s.sel]);
    else if (m.back && s.back) this.open(s.back);
  }
}
