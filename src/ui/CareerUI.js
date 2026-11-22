// ============================================================================
//  Interface du mode carrière (DOM) : création / apparence du joueur avec
//  aperçu 3D, hub, tournois, tableau, résultat, attributs, classement,
//  partenaire, entraînements, boutique, réglages des formats.
//
//  Navigation : manette / clavier (déplacement spatial entre les éléments
//  marqués data-nav, A = valider, B = retour) et souris.
//  Chaque écran est une méthode `screen_xxx()` qui renvoie du HTML ; les
//  actions sont déclarées par data-act / data-arg et traitées dans `act()`.
// ============================================================================
import { RACKET_DESIGNS } from '../entities/Racket.js';
import { KIT_STYLES } from '../entities/Appearance.js';
import { STAFF, CLUB, DECOS, clubTournament } from '../career/Business.js';
import { unread, taunt } from '../career/Story.js';
import { Career, DEFAULT_LOOK } from '../career/Career.js';
import { ATTRIBUTES, MAX_VALUE } from '../career/data/attributes.js';
import { TIERS, SEASON_WEEKS, UNRANKED, MATCH_FORMATS } from '../career/data/circuit.js';
import { STYLES } from '../career/data/roster.js';
import { SHOP_ITEMS, SHOP_CATEGORIES } from '../career/data/shop.js';
import { roundName } from '../career/Tournament.js';
import { DRILLS, DRILL_IDS, MEDALS } from '../core/Drills.js';
import { VENUES } from '../render/Venues.js';
import { Avatar } from '../entities/Avatar.js';
import {
  COLORS, SKIN_TONES, HAIR_COLORS, HAIR_COLOR_LABELS, BUILDS, HAIR_STYLES, BEARDS, HEADWEAR_ITEMS, RACKETS, BAGS,
  resolveLook, colorById, bagById,
} from '../entities/Appearance.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fr = (n) => Math.round(n).toLocaleString('fr-FR');
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
const rankLabel = (r) => (r >= UNRANKED ? 'Non classé' : `n° ${fr(r)}`);
const PLACING = ['Vainqueur', 'Finaliste', 'Demi-finaliste', 'Quart de finaliste', 'Huitième de finaliste'];
const RANDOM_NAMES = ['Alex Martin', 'Sacha Durand', 'Noa Lambert', 'Eden Girard', 'Lou Mercier', 'Camille Faure', 'Maël Roche', 'Charlie Blanc'];
const ATTR_LABEL = Object.fromEntries(ATTRIBUTES.map((a) => [a.id, a.label]));
const MEDAL_CLASS = ['none', 'bronze', 'silver', 'gold'];

// Champs de l'éditeur : [clé, libellé, options [[valeur, texte, couleur?]], catégorie boutique ?]
const colorOpts = COLORS.map((c) => [c.id, c.label, c.hex]);
const LOOK_FIELDS = [
  ['female', 'Gabarit', [[false, 'Masculin'], [true, 'Féminin']]],
  ['height', 'Taille', [[0.93, 'Petite'], [1.0, 'Moyenne'], [1.06, 'Grande'], [1.11, 'Très grande']]],
  ['buildId', 'Carrure', BUILDS.map((b) => [b.id, b.label])],
  ['skin', 'Teint', SKIN_TONES.map((c, i) => [c, `Teint ${i + 1}`, c])],
  ['hairStyle', 'Coiffure', HAIR_STYLES.map((h) => [h.id, h.label])],
  ['hair', 'Cheveux', HAIR_COLORS.map((c, i) => [c, HAIR_COLOR_LABELS[i], c])],
  ['beard', 'Barbe', BEARDS.map((b) => [b.id, b.label])],
  ['headwear', 'Accessoire', HEADWEAR_ITEMS.map((h) => [h.id, h.label]), 'headwear'],
  ['kitStyle', 'Maillot', KIT_STYLES.map((k) => [k.id, k.label]), 'kit'],
  ['number', 'Numéro', Array.from({ length: 99 }, (_, i) => [i + 1, `N° ${i + 1}`])],
  ['primary', 'Couleur dominante', colorOpts, 'color'],
  ['secondary', 'Couleur secondaire', colorOpts, 'color'],
  ['shortsColor', 'Short / jupe', colorOpts, 'color'],
  ['shoeColor', 'Chaussures', colorOpts, 'color'],
  ['skirt', 'Bas', [[false, 'Short'], [true, 'Jupe']]],
  ['racket', 'Raquette', RACKETS.map((r) => [r.id, r.label, r.frame]), 'racket'],
  ['racketDesign', 'Design de raquette', RACKET_DESIGNS.map((d) => [d.id, d.label, d.face ?? 0xffd400]), 'design'],
  ['bag', 'Sac', BAGS.map((b) => [b.id, b.label, b.main]), 'bag'],
];
const PROFILE_FIELDS = [
  ['hand', 'Main directrice', [['R', 'Droitier'], ['L', 'Gaucher']]],
  ['side', 'Côté du terrain', [['L', 'Gauche (revés)'], ['R', 'Droite (drive)']]],
];

const clubTournamentInfo = (club) => { const t = clubTournament(club); return `${t.name}, niveau ${({ amateur: "amateur", regional: "régional", national: "national", pro: "circuit mondial" })[t.tier]}, ${t.prize} € au vainqueur`; };

export class CareerUI {
  constructor({ input, game, r3d, sfx, storage, onExit }) {
    this.input = input; this.game = game; this.r3d = r3d; this.sfx = sfx; this.storage = storage; this.onExit = onExit;
    this.el = document.getElementById('career');
    this.body = this.el.querySelector('.c-body');
    this.visible = false;
    this.screen = 'home';
    this.params = null;
    this.focusKey = null;
    this.career = null;
    this.draft = null;
    this.shopCat = 'color';

    this.body.addEventListener('click', (e) => {
      const cyc = e.target.closest('[data-cyc]');
      if (cyc) { this.cycle(cyc.closest('[data-cycle]').dataset.cycle, +cyc.dataset.cyc); return; }
      const el = e.target.closest('[data-act]');
      if (el) this.act(el.dataset.act, el.dataset.arg, el);
    });
    this.body.addEventListener('mouseover', (e) => {
      const el = e.target.closest('[data-nav]');
      if (el) this.setFocus(el, false);
    });
    this.body.addEventListener('input', (e) => {
      if (e.target.id === 'c-name' && this.draft) { this.draft.name = e.target.value.slice(0, 24); this.preview(); }
    });
  }

  // ------------------------------------------------------------------ ouverture / fermeture
  open() {
    this.career = Career.load(this.storage);
    this.visible = true;
    this.el.classList.remove('hidden');
    this.show(this.career ? 'hub' : 'home');
  }

  close() {
    this.visible = false;
    this.el.classList.add('hidden');
    this.game.setShowcase(null);
    this.onExit?.();
  }

  hide() { this.visible = false; this.el.classList.add('hidden'); }

  show(screen, params = null) {
    const wasEditor = this.screen === 'editor' || this.screen === 'shop';
    this.screen = screen;
    this.shopSel = null;
    this.params = params;
    this.focusKey = null;
    this.visible = true;
    this.el.classList.remove('hidden');
    this.el.classList.toggle('editor', screen === 'editor' || screen === 'shop');
    if (screen === 'shop') this.shopPreview(null);
    if (screen === 'editor') this.preview();
    else if (wasEditor) this.game.setShowcase(null);
    this.render();
  }

  render() {
    this.body.innerHTML = this[`screen_${this.screen}`]();
    const items = this.focusables();
    const keep = this.focusKey && items.find((el) => el.dataset.key === this.focusKey);
    const el = keep || items.find((x) => x.hasAttribute('data-default')) || items[0];
    if (el) this.setFocus(el, false);
  }

  // ------------------------------------------------------------------ navigation
  focusables() { return [...this.body.querySelectorAll('[data-nav]')].filter((el) => el.offsetParent !== null); }

  setFocus(el, scroll = true) {
    if (this.focusEl === el) return;
    this.focusEl?.classList.remove('focus');
    this.focusEl = el;
    el.classList.add('focus');
    this.focusKey = el.dataset.key || null;
    if (scroll) el.scrollIntoView({ block: 'nearest' });
  }

  /** Déplacement spatial : l'élément le plus proche dans la direction demandée. */
  move(dx, dy) {
    const items = this.focusables();
    if (!items.length) return;
    if (!this.focusEl || !items.includes(this.focusEl)) { this.setFocus(items[0]); return; }
    const a = this.focusEl.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bestScore = Infinity;
    for (const el of items) {
      if (el === this.focusEl) continue;
      const b = el.getBoundingClientRect();
      const bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const along = (bx - ax) * dx + (by - ay) * dy;
      if (along <= 4) continue;
      const across = Math.abs((bx - ax) * dy) + Math.abs((by - ay) * dx);
      // priorité aux éléments alignés (qui se recouvrent sur l'axe perpendiculaire)
      const overlap = dy ? Math.min(a.right, b.right) > Math.max(a.left, b.left) : Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
      const score = overlap ? along + across * 0.3 : 10000 + along + across * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) this.setFocus(best);
  }

  update() {
    if (document.activeElement?.tagName === 'INPUT') return;
    const m = this.input.menu;
    const cyc = this.focusEl?.dataset.cycle;
    if (m.up) this.move(0, -1);
    if (m.down) this.move(0, 1);
    if (m.left) { if (cyc) this.cycle(cyc, -1); else this.move(-1, 0); }
    if (m.right) { if (cyc) this.cycle(cyc, 1); else this.move(1, 0); }
    if (m.confirm && this.focusEl) {
      if (cyc) this.cycle(cyc, 1); else this.focusEl.click();
    } else if (m.back) this.back();
  }

  back() {
    switch (this.screen) {
      case 'home': case 'hub': this.close(); break;
      case 'editor': this.show(this.career ? 'hub' : 'home'); break;
      case 'result': this.act('continue'); break;
      default: this.show('hub');
    }
  }

  // ------------------------------------------------------------------ éditeur
  newDraft() {
    const c = this.career;
    this.draft = c
      ? { name: c.s.profile.name, hand: c.s.profile.hand, side: c.s.profile.side, look: { ...c.lookFor() }, existing: true }
      : { name: '', hand: 'R', side: 'L', look: { ...DEFAULT_LOOK } };
  }

  /** Objet utilisable dans l'éditeur ? (sans carrière : seulement les objets gratuits) */
  owned(cat, ref) {
    if (!cat) return true;
    const it = SHOP_ITEMS.find((i) => i.id === `${cat}:${ref}`);
    if (!it) return true;
    return this.career ? this.career.owns(it.id) : it.price === 0;
  }

  draftAppearance() {
    const d = this.draft;
    const print = (d.name.trim().split(' ').pop() || 'JOUEUR').toUpperCase().slice(0, 12);
    return { ...resolveLook(d.look), name: print, hand: d.hand === 'L' ? -1 : 1 };
  }

  preview() {
    if (!this.draft) return;
    this.game.setShowcase(this.draftAppearance());
    const bag = bagById(this.draft.look.bag);
    const sc = this.game.showcase;
    if (sc && bag.id !== 'none') {
      const b = Avatar.makeBag(bag);
      b.position.set(1.75, 0, 6.6); b.rotation.y = -0.6;
      sc.avatar.root.parent.add(b);
      sc.extra = b;
    }
  }

  cycle(field, dir) {
    const d = this.draft;
    if (!d) return;
    const def = [...LOOK_FIELDS, ...PROFILE_FIELDS].find((f) => f[0] === field);
    if (!def) return;
    const isLook = LOOK_FIELDS.includes(def);
    const obj = isLook ? d.look : d;
    // seules les options possédées (boutique) sont proposées
    const opts = def[2].filter((o) => this.owned(def[3], o[0]));
    const i = Math.max(0, opts.findIndex((o) => o[0] === obj[field]));
    obj[field] = opts[(i + dir + opts.length) % opts.length][0];
    if (field === 'hand') d.side = d.hand === 'L' ? 'R' : 'L';   // un gaucher joue naturellement à droite
    this.focusKey = `f-${field}`;
    if (isLook || field === 'hand') this.preview();
    this.render();
  }

  // ------------------------------------------------------------------ actions
  act(name, arg, el) {
    const c = this.career;
    this.sfx?.unlock();
    switch (name) {
      case 'exit': this.close(); break;
      case 'new': this.newDraft(); this.show('editor'); break;
      case 'look': this.newDraft(); this.show('editor'); break;
      case 'randomName':
        this.draft.name = RANDOM_NAMES[(RANDOM_NAMES.indexOf(this.draft.name) + 1) % RANDOM_NAMES.length];
        this.focusKey = 'randomName'; this.preview(); this.render(); break;
      case 'saveDraft': {
        const d = this.draft;
        const name = d.name.trim() || RANDOM_NAMES[0];
        if (d.existing) {
          Object.assign(c.s.profile, { name, hand: d.hand, side: d.side, look: { ...d.look } });
          c.s.partner.side = d.side === 'L' ? 'R' : 'L';
          c.save();
        } else {
          this.career = Career.create({ name, hand: d.hand, side: d.side, look: { ...d.look } }, this.storage);
        }
        this.draft = null;
        this.show('hub');
        break;
      }
      case 'goto': this.show(arg); break;
      case 'enter': {
        const r = c.enter(arg);
        if (r.ok) this.show('bracket'); else { this.flash = r.error; this.render(); }
        break;
      }
      case 'skip': c.nextWeek(); c.save(); this.show('hub'); break;
      case 'play': {
        const opts = c.matchOptions();
        if (!opts) { this.show('hub'); break; }
        this.hide();
        this.game.start({ ...opts, onQuit: () => this.show('bracket'), onEnd: (result) => this.show('result', { summary: this.career.reportMatch(result), result }) });
        break;
      }
      case 'drill': {
        if (!c.canTrain()) break;
        this.hide();
        this.game.start({ ...c.drillOptions(arg), onQuit: () => this.show('training'), onEnd: (result) => this.show('result', { training: this.career.reportTraining(result) }) });
        break;
      }
      case 'simulate': this.show('result', { summary: c.simulateMatch(), simulated: true }); break;
      case 'withdraw': this.show('result', { summary: c.withdraw() }); break;
      case 'continue': this.show(this.career?.s.tournament ? 'bracket' : 'hub'); break;
      case 'up': this.focusKey = el?.dataset.key; if (c.upgrade(arg)) this.render(); break;
      case 'partner': c.setPartner(c.partnerOptions()[+arg]); this.show('hub'); break;
      case 'erase': Career.erase(this.storage); this.career = null; this.show('home'); break;
      case 'shopCat': this.shopCat = arg; this.focusKey = `cat-${arg}`; this.render(); break;
      case 'hire': case 'fire': case 'buyClub': case 'upgrade': case 'deco': {
        const r = name === 'hire' ? c.hire(arg) : name === 'fire' ? c.fire(arg) : name === 'buyClub' ? c.buyClub() : name === 'deco' ? c.buyDeco(arg) : c.upgradeClub(arg);
        this.flash = r.ok ? null : r.error;
        this.focusKey = el?.dataset.key;
        this.render();
        break;
      }
      case 'buy': {
        // premier clic : on essaie l'objet sur le joueur ; second clic : achat
        const it = SHOP_ITEMS.find((i) => i.id === arg);
        if (this.shopSel !== arg) { this.shopSel = arg; this.shopPreview(it); this.focusKey = el?.dataset.key; this.render(); break; }
        this.shopSel = null;
        const r = c.buy(arg);
        this.flash = r.ok ? `Acheté : ${this.itemLabel(SHOP_ITEMS.find((i) => i.id === arg))}. Équipez-le dans « Apparence ».` : r.error;
        this.focusKey = el?.dataset.key;
        this.render();
        break;
      }
      case 'format': {
        const [tier, id] = arg.split(':');
        c.setFormat(tier, id);
        this.focusKey = el?.dataset.key;
        this.render();
        break;
      }
      default: break;
    }
  }

  // ------------------------------------------------------------------ écrans
  screen_home() {
    return `
      <div class="c-title">MODE CARRIÈRE</div>
      <p class="c-lead">Partez du tournoi de quartier, non classé, et grimpez jusqu'à la première place mondiale.
      Gagnez de l'expérience, entraînez-vous, remplissez les missions de match, équipez-vous en boutique et
      affrontez les meilleures paires du circuit.</p>
      <div class="c-steps">${TIERS.map((t, i) => `<div><b>${i + 1}</b>${t.label}</div>`).join('')}</div>
      <div class="c-actions">
        <button class="c-btn primary" data-nav data-default data-act="new">Créer mon joueur</button>
        <button class="c-btn" data-nav data-act="exit">Retour</button>
      </div>`;
  }

  screen_editor() {
    const d = this.draft;
    const row = (def, obj) => {
      const [key, label, all, cat] = def;
      const opts = all.filter((o) => this.owned(cat, o[0]));
      const cur = opts.find((o) => o[0] === obj[key]) || opts[0];
      const swatch = cur[2] != null ? `<i class="sw ${colorById(cur[0])?.metal && cat === 'color' ? 'metal' : ''}" style="background:${hex(cur[2])}"></i>` : '';
      const locked = all.length - opts.length;
      return `<div class="crow" data-nav data-cycle="${key}" data-key="f-${key}">
        <span class="lbl">${label}${locked ? `<small>${locked} en boutique</small>` : ''}</span>
        <button class="arrow" data-cyc="-1" tabindex="-1" aria-label="Précédent">‹</button>
        <span class="val">${swatch}${cur[1]}</span>
        <button class="arrow" data-cyc="1" tabindex="-1" aria-label="Suivant">›</button>
      </div>`;
    };
    const hint = d.hand === 'L'
      ? 'Gaucher : à droite, votre coup droit et votre smash couvrent le centre.'
      : 'Droitier : à gauche, votre coup droit et votre smash couvrent le centre.';
    return `
      <div class="c-title">${d.existing ? 'APPARENCE' : 'CRÉATION DU JOUEUR'}</div>
      <label class="c-name"><span>Nom</span>
        <input id="c-name" type="text" maxlength="24" placeholder="Votre nom" value="${esc(d.name)}" autocomplete="off">
        <button class="c-btn small" data-nav data-key="randomName" data-act="randomName">Aléatoire</button>
      </label>
      <div class="c-rows">
        ${PROFILE_FIELDS.map((f) => row(f, d)).join('')}
        <p class="c-hint">${hint}</p>
        ${LOOK_FIELDS.filter((f) => f[0] !== 'skirt' || d.look.female).map((f) => row(f, d.look)).join('')}
      </div>
      <div class="c-actions">
        <button class="c-btn primary" data-nav data-key="save" data-act="saveDraft">${d.existing ? 'Enregistrer' : 'Commencer la carrière'}</button>
        <button class="c-btn" data-nav data-act="goto" data-arg="${this.career ? 'hub' : 'home'}">Annuler</button>
      </div>`;
  }

  header() {
    const c = this.career, s = c.s;
    const xpPct = Math.round((s.xp / c.xpNeeded) * 100);
    return `
      <div class="c-head">
        <div class="who">
          <div class="nm">${esc(s.profile.name)}</div>
          <div class="sub">${s.profile.hand === 'L' ? 'Gaucher' : 'Droitier'} · côté ${s.profile.side === 'L' ? 'gauche' : 'droit'} · ${c.tier.label}</div>
        </div>
        <div class="ovr"><b>${c.ovr}</b><span>NOTE</span></div>
      </div>
      <div class="c-xp"><span>Niveau ${s.level}</span><div class="bar"><div class="fill" style="width:${xpPct}%"></div></div><span>${s.xp} / ${c.xpNeeded} XP</span></div>
      <div class="c-stats">
        <div><b>${rankLabel(c.rank)}</b><span>Classement mondial</span></div>
        <div><b>${fr(c.points)}</b><span>Points</span></div>
        <div><b>${fr(s.money)} €</b><span>Gains</span></div>
        <div><b>${fr(s.shopPts)}</b><span>Points boutique</span></div>
        <div><b>S${c.season} · ${c.weekInSeason}/${SEASON_WEEKS}</b><span>Saison · semaine</span></div>
      </div>`;
  }

  screen_hub() {
    const c = this.career, s = c.s, t = s.tournament;
    const next = TIERS.find((x) => x.unlockRank < c.rank);
    const goal = c.rank === 1 ? 'Vous êtes n° 1 mondial. Défendez votre place !'
      : next ? `Objectif : entrer dans le top ${next.unlockRank} pour accéder au palier « ${next.label} ».`
        : 'Objectif : la première place mondiale.';
    return `
      ${this.header()}
      <p class="c-goal">${goal}</p>
      ${s.lastNotice ? `<p class="c-flash">${esc(s.lastNotice)}</p>` : ''}${(() => { s.lastNotice = null; return ''; })()}
      ${this.storyCard()}
      <div class="c-grid">
        ${t
    ? `<button class="c-btn primary wide" data-nav data-default data-act="goto" data-arg="bracket">Continuer : ${esc(t.name)}<small>${roundName(t)} · ${esc(VENUES[t.venue]?.label || '')}</small></button>`
    : `<button class="c-btn primary wide" data-nav data-default data-act="goto" data-arg="tournaments">Tournois de la semaine<small>Semaine ${c.weekInSeason} · saison ${c.season}</small></button>`}
        ${t ? '' : `<button class="c-btn" data-nav data-act="goto" data-arg="training">Entraînement<small>${c.canTrain() ? 'Un atelier par semaine' : 'Déjà fait cette semaine'}</small></button>`}
        <button class="c-btn" data-nav data-act="goto" data-arg="attributes">Attributs<small>${s.sp > 0 ? `<em>${s.sp} point${s.sp > 1 ? 's' : ''} à dépenser</em>` : 'Aucun point disponible'}</small></button>
        <button class="c-btn" data-nav data-act="goto" data-arg="shop">Boutique<small>${fr(s.shopPts)} points boutique</small></button>
        <button class="c-btn" data-nav data-act="look">Apparence<small>Tenue, physique, raquette, sac</small></button>
        <button class="c-btn" data-nav data-act="goto" data-arg="ranking">Classement mondial<small>${rankLabel(c.rank)}</small></button>
        <button class="c-btn" data-nav data-act="goto" data-arg="staff">Staff<small>${c.weeklyCosts ? `${fr(c.weeklyCosts)} € / semaine` : 'Facultatif'}</small></button>
        <button class="c-btn" data-nav data-act="goto" data-arg="club">Mon club<small>${s.club ? `${esc(s.club.name)} · +${fr(c.weeklyIncome)} € / sem.` : 'Facultatif'}</small></button>
        <button class="c-btn" data-nav data-act="goto" data-arg="partner">Partenaire<small>${esc(s.partner.name)} · note ${s.partner.ovr}</small></button>
        <button class="c-btn" data-nav data-act="goto" data-arg="settings">Formats des matchs<small>Tie-break, super tie-break, sets</small></button>
        <button class="c-btn" data-nav data-act="exit">Retour au menu<small>La carrière est sauvegardée</small></button>
      </div>
      <div class="c-foot">${s.stats.won} victoire${s.stats.won > 1 ? 's' : ''} sur ${s.stats.played} match${s.stats.played > 1 ? 's' : ''} · ${s.stats.titles} titre${s.stats.titles > 1 ? 's' : ''}
        · ${s.stats.missions || 0} mission${(s.stats.missions || 0) > 1 ? 's' : ''} réussie${(s.stats.missions || 0) > 1 ? 's' : ''}
        · meilleur classement : ${rankLabel(s.stats.bestRank)}
        <button class="c-link" data-nav data-act="goto" data-arg="erase">Effacer la carrière</button></div>`;
  }

  storyCard() {
    const msgs = unread(this.career);
    if (!msgs.length) return '';
    const m = msgs[0];
    return `<button class="c-story" data-nav data-default data-act="goto" data-arg="story"><span class="c-story-tag">${msgs.length > 1 ? `${msgs.length} nouveaux messages` : 'Nouveau message'}</span><b>${esc(m.from.name)} · ${esc(m.title)}</b><small>${esc(m.text.slice(0, 90))}…</small></button>`;
  }

  screen_story() {
    const all = this.career.s.story?.inbox || [];
    const m = unread(this.career)[0] || all[all.length - 1];
    if (!m) return this.screen_hub();
    m.read = true;
    this.career.save?.();
    const more = unread(this.career).length;
    return `
      <div class="c-letter">
        <div class="c-letter-from"><b>${esc(m.from.name)}</b><span>${esc(m.from.role)} · semaine ${m.week}</span></div>
        <div class="c-title">${esc(m.title).toUpperCase()}</div>
        <p class="c-letter-text">${esc(m.text)}</p>
      </div>
      <div class="c-actions">
        ${more ? `<button class="c-btn primary" data-nav data-default data-act="goto" data-arg="story">Message suivant<small>${more} non lu${more > 1 ? 's' : ''}</small></button>` : ''}
        <button class="c-btn ${more ? '' : 'primary'}" data-nav ${more ? '' : 'data-default'} data-act="goto" data-arg="hub">Carrière</button>
      </div>`;
  }

  screen_staff() {
    const c = this.career;
    const flash = this.flash ? `<p class="c-flash">${esc(this.flash)}</p>` : '';
    this.flash = null;
    const cards = Object.entries(STAFF).map(([id, st]) => {
      const on = c.hasStaff(id);
      return `<button class="c-card shop ${on ? 'owned' : ''}" data-nav data-key="st-${id}" data-act="${on ? 'fire' : 'hire'}" data-arg="${id}">
        <span class="row1"><b>${st.label}</b></span><span class="meta">${esc(st.desc)}</span>
        <span class="price">${on ? `Engagé · ${fr(st.salary)} €/sem. · A pour le libérer` : `${fr(st.salary)} € par semaine`}</span></button>`;
    }).join('');
    return `
      <div class="c-title">STAFF</div>
      <p class="c-lead small">Facultatif : le staff est payé chaque semaine. S'il n'y a plus assez d'argent, il s'en va, sans autre conséquence.
      Budget : <b class="sp">${fr(c.s.money)} €</b> · dépenses ${fr(c.weeklyCosts)} € / semaine${c.weeklyIncome ? ` · revenus du club ${fr(c.weeklyIncome)} € / semaine` : ''}.</p>
      ${flash}
      <div class="c-cards">${cards}</div>
      <div class="c-actions"><button class="c-btn" data-nav data-act="goto" data-arg="hub">Retour</button></div>`;
  }

  screen_club() {
    const c = this.career, club = c.s.club;
    const flash = this.flash ? `<p class="c-flash">${esc(this.flash)}</p>` : '';
    this.flash = null;
    if (!club) {
      return `
        <div class="c-title">MON CLUB</div>
        <p class="c-lead">Facultatif : achetez votre propre club de padel. Il rapporte de l'argent chaque semaine (location des courts, buvette)
        et organise son tournoi toutes les 4 semaines. Plus il a de tribunes, plus le tournoi est relevé (et la billetterie importante).</p>
        ${flash}
        <div class="c-actions">
          <button class="c-btn primary" data-nav data-default data-key="club-buy" data-act="buyClub">Acheter un club<small>${fr(CLUB.price)} € · vous avez ${fr(c.s.money)} €</small></button>
          <button class="c-btn" data-nav data-act="goto" data-arg="hub">Retour</button>
        </div>`;
    }
    const part = (id, label, what) => {
      const lvl = club[id], max = CLUB[id].max;
      return `<button class="c-card shop ${lvl >= max ? 'owned' : ''}" data-nav data-key="up-${id}" ${lvl >= max ? '' : `data-act="upgrade" data-arg="${id}"`}>
        <span class="row1"><b>${label} · niveau ${lvl}/${max}</b></span><span class="meta">${what}</span>
        <span class="price">${lvl >= max ? 'Maximum' : `Améliorer : ${fr(CLUB[id].price(lvl))} €`}</span></button>`;
    };
    const tpl = clubTournamentInfo(club);
    return `
      <div class="c-title">${esc(club.name).toUpperCase()}</div>
      <p class="c-lead small">Revenus : <b class="sp">+${fr(c.weeklyIncome)} € / semaine</b> · déjà rapporté : ${fr(club.earned || 0)} € · budget ${fr(c.s.money)} €.<br>
      Tournoi du club toutes les 4 semaines (semaine ${c.s.week % 4 === 0 ? 'en cours !' : `${c.s.week + 4 - (c.s.week % 4)}`}) : ${esc(tpl)}.</p>
      ${flash}
      <div class="c-cards">
        ${part('courts', 'Courts', `${club.courts} court(s) en location : +${CLUB.courts.income} € / semaine chacun.`)}
        ${part('bar', 'Buvette', `+${CLUB.bar.income} € / semaine par niveau, et la fête du club plus animée.`)}
        ${part('stands', 'Tribunes', 'Plus de gradins autour du court central : le tournoi du club monte de niveau (jusqu\'au circuit mondial) et la billetterie grossit.')}
      </div>
      <div class="c-title small">DÉCORATION</div>
      <div class="c-cards">${DECOS.map((d) => { const own = club.decos?.includes(d.id); return `<button class="c-card shop ${own ? 'owned' : c.s.money >= d.price ? '' : 'locked'}" data-nav data-key="deco-${d.id}" ${own ? '' : `data-act="deco" data-arg="${d.id}"`}><span class="row1"><b>${esc(d.label)}</b></span><span class="meta">${esc(d.desc)}</span><span class="price">${own ? 'Installé' : `${fr(d.price)} €`}</span></button>`; }).join('')}</div>
      <p class="c-lead small">Le décor de votre club (courts, tribunes, décos) apparaît quand vous y jouez : tournoi du club, ou exhibition sur « Mon club ».</p>
      <div class="c-actions"><button class="c-btn" data-nav data-act="goto" data-arg="hub">Retour</button></div>`;
  }

  screen_erase() {
    return `
      <div class="c-title">EFFACER LA CARRIÈRE ?</div>
      <p class="c-lead">Votre joueur, sa progression, ses achats et son classement seront supprimés définitivement.</p>
      <div class="c-actions">
        <button class="c-btn" data-nav data-default data-act="goto" data-arg="hub">Annuler</button>
        <button class="c-btn danger" data-nav data-act="erase">Effacer</button>
      </div>`;
  }

  screen_tournaments() {
    const c = this.career;
    const flash = this.flash ? `<p class="c-flash">${esc(this.flash)}</p>` : '';
    this.flash = null;
    const cards = c.offers().map(({ tpl, tier, locked }, i) => {
      const fmt = MATCH_FORMATS[c.formatFor(tier.id)];
      return `
      <button class="c-card ${locked ? 'locked' : ''}" data-nav ${i === 0 ? 'data-default' : ''} data-key="t-${tpl.id}" data-act="enter" data-arg="${tpl.id}">
        <span class="badge ${tier.id}">${tier.label}</span>
        <b>${tpl.name}</b>
        <span class="meta">${esc(VENUES[tpl.venue]?.label || '')} · ${tpl.draw} paires · ${fmt.short} · niveau ${Math.round(tier.ovr[0] + (tier.ovr[1] - tier.ovr[0]) * tpl.ovrShift)}</span>
        <span class="gain">${fr(tpl.points)} pts · ${fr(tpl.prize)} € au vainqueur${tpl.fee ? ` · inscription ${tpl.fee} €` : ''}</span>
        ${locked ? `<span class="lock">${locked}</span>` : ''}
      </button>`;
    }).join('');
    return `
      <div class="c-title">TOURNOIS DE LA SEMAINE</div>
      <p class="c-lead small">Votre paire : note ${c.pairOvr} · classement ${rankLabel(c.rank)} · ${fr(c.s.money)} €</p>
      ${flash}
      <div class="c-cards">${cards}</div>
      <div class="c-actions">
        <button class="c-btn" data-nav data-act="goto" data-arg="hub">Retour</button>
        <button class="c-btn" data-nav data-act="skip">Passer la semaine</button>
      </div>`;
  }

  pairLabel(p) { return p.players.map((x) => esc(x.short || x.name)).join(' / '); }

  screen_bracket() {
    const c = this.career, t = c.s.tournament;
    if (!t) return this.screen_hub();
    const nm = c.nextMatch();
    const cols = t.rounds.map((round, r) => `
      <div class="b-col"><h4>${roundName(t, r)}</h4>
        ${round.map((m) => {
    const line = (idx) => {
      const p = t.pairs[idx];
      const cls = `${p.isPlayer ? 'me' : ''} ${m.winner === idx ? 'win' : m.winner !== null ? 'out' : ''}`;
      return `<div class="b-pair ${cls}"><i>${p.seed}</i>${this.pairLabel(p)}</div>`;
    };
    return `<div class="b-match">${line(m.a)}${line(m.b)}${m.score ? `<span class="sc">${esc(m.score)}</span>` : ''}</div>`;
  }).join('')}
      </div>`).join('');
    const who = (n) => `
      <div class="opp"><b>${esc(n.name)}</b>
        <span>Note ${n.ovr} · ${(STYLES[n.style] || STYLES.allround).label} · ${n.hand === 'L' ? 'gaucher' : 'droitier'} · ${rankLabel(Career.rankOf(n))}</span>
        ${n.note ? `<em>${esc(n.note)}</em>` : ''}</div>`;
    const chance = c.winChance();
    const mood = chance > 0.65 ? 'Favorable' : chance > 0.4 ? 'Équilibré' : chance > 0.2 ? 'Difficile' : 'Très difficile';
    const fmt = MATCH_FORMATS[t.format] || { short: t.sets === 3 ? '2 sets gagnants' : '1 set' };
    return `
      <div class="c-title">${esc(t.name).toUpperCase()}</div>
      <p class="c-lead small">${esc(VENUES[t.venue]?.label || '')} · ${fmt.short}</p>
      <div class="b-wrap">${cols}</div>
      <div class="c-next">
        <h4>${nm.round} · adversaires (paire notée ${nm.opponents.ovr}, la vôtre ${c.pairOvr}) · ${mood}</h4>
        <div class="opps">${nm.opponents.players.map(who).join('')}</div>
        ${nm.opponents.players.map((n) => taunt(n, c.s.week + t.round)).filter(Boolean).map((q) => `<p class="c-taunt">${esc(q)}</p>`).join('')}
        <p class="c-mission">Une mission vous sera proposée au début du match (récompense : points boutique ou de compétence).</p>
      </div>
      <div class="c-actions">
        <button class="c-btn primary" data-nav data-default data-act="play">Jouer le match</button>
        <button class="c-btn" data-nav data-act="simulate">Simuler<small>XP ÷ 2, sans mission</small></button>
        <button class="c-btn" data-nav data-act="goto" data-arg="hub">Carrière</button>
        <button class="c-btn danger" data-nav data-act="withdraw">Abandonner</button>
      </div>`;
  }

  screen_result() {
    const c = this.career, p = this.params || {};
    if (p.training) {
      const tr = p.training;
      return `
        <div class="c-title medal-${MEDAL_CLASS[tr.medal]}">${tr.medal ? `MÉDAILLE ${MEDALS[tr.medal].toUpperCase()}` : 'ENTRAÎNEMENT TERMINÉ'}</div>
        <p class="c-lead">${esc(tr.label)} · score ${tr.score}</p>
        <ul class="c-rewards">
          ${tr.gain ? `<li class="up"><b>+${tr.gain} ${ATTR_LABEL[tr.attr]}</b></li>` : `<li>Pas de progression de l'attribut (${ATTR_LABEL[tr.attr]}) : visez l'argent ou l'or.</li>`}
          <li><b>+${tr.xp} XP</b>${tr.shop ? ` · <b>+${tr.shop} points boutique</b>` : ''}</li>
          ${tr.levelUps ? `<li class="up"><b>Niveau ${c.s.level} !</b> +${tr.sp} points de compétence</li>` : ''}
        </ul>
        <div class="c-actions"><button class="c-btn primary" data-nav data-default data-act="continue">Continuer</button></div>`;
    }
    if (p.training === null) return this.screen_hub();
    const s = p.summary;
    if (!s) return this.screen_hub();
    const rankMove = s.rankAfter !== s.rankBefore ? `<li><b>Classement : ${rankLabel(s.rankBefore)} → ${rankLabel(s.rankAfter)}</b></li>` : '';
    const mission = s.mission ? `<li class="${s.mission.done ? 'up' : 'miss'}">Mission : ${esc(s.mission.text)} · ${s.mission.done
      ? `<b>réussie (+${s.mission.amount} ${s.mission.reward === 'shop' ? 'points boutique' : `point${s.mission.amount > 1 ? 's' : ''} de compétence`})</b>`
      : 'non réussie'}</li>` : '';
    const end = s.finished ? `
        <li class="${s.title ? 'up' : ''}"><b>${PLACING[Math.min(s.placing, PLACING.length - 1)]}</b> · ${esc(s.tournament)}</li>
        <li><b>+${fr(s.points)} points</b> de classement · <b>+${fr(s.prize)} €</b></li>
        ${rankMove}
        ${s.title ? '' : `<li>Titre : ${this.pairLabel(s.champion)}</li>`}
        ${s.unlocked ? `<li class="up"><b>Nouveau palier débloqué : ${s.unlocked}</b></li>` : ''}
        ${s.charsUnlocked ? `<li class="up"><b>Personnage jouable débloqué : ${esc(s.charsUnlocked.join(', '))}</b> (exhibition)</li>` : ''}
        ${s.worldNo1 ? '<li class="up"><b>VOUS ÊTES N° 1 MONDIAL !</b></li>' : ''}` : '';
    return `
      <div class="c-title ${s.won ? 'good' : 'bad'}">${s.won ? (s.title ? 'TITRE !' : 'VICTOIRE') : 'DÉFAITE'}</div>
      <p class="c-lead">${esc(s.round)} · ${esc(s.tournament)} · contre ${this.pairLabel(s.opponents)}${p.result?.score || p.simulated ? ` · ${esc(p.result?.score || '')}${p.simulated ? ' (simulé)' : ''}` : ''}</p>
      <ul class="c-rewards">
        <li><b>+${s.xp} XP</b>${s.sp ? ` · <b>+${s.sp} point${s.sp > 1 ? 's' : ''} de compétence</b>` : ''}${s.shop ? ` · <b>+${s.shop} points boutique</b>` : ''}</li>
        ${mission}
        ${s.levelUps ? `<li class="up"><b>Niveau ${c.s.level} !</b></li>` : ''}
        ${end}
      </ul>
      <div class="c-actions">
        <button class="c-btn primary" data-nav data-default data-act="continue">${s.finished ? 'Retour à la carrière' : 'Tour suivant'}</button>
        ${c.s.sp > 0 ? `<button class="c-btn" data-nav data-act="goto" data-arg="attributes">Dépenser ${c.s.sp} point${c.s.sp > 1 ? 's' : ''}</button>` : ''}
      </div>`;
  }

  screen_attributes() {
    const c = this.career, s = c.s;
    const rows = ATTRIBUTES.map((a, i) => {
      const v = s.attrs[a.id], cost = c.cost(a.id), can = c.canUpgrade(a.id);
      return `<div class="a-row">
        <div class="a-txt"><b>${a.label}</b><small>${a.desc}</small></div>
        <div class="a-bar"><div class="fill" style="width:${(v / MAX_VALUE) * 100}%"></div></div>
        <div class="a-val">${v}</div>
        <button class="c-btn small ${can ? '' : 'off'}" data-nav ${i === 0 ? 'data-default' : ''} data-key="up-${a.id}" data-act="up" data-arg="${a.id}" aria-label="Améliorer ${a.label}">+1<small>${v >= MAX_VALUE ? 'max' : `${cost} pt${cost > 1 ? 's' : ''}`}</small></button>
      </div>`;
    }).join('');
    return `
      <div class="c-title">ATTRIBUTS</div>
      <p class="c-lead small"><b class="sp">${s.sp}</b> point${s.sp > 1 ? 's' : ''} de compétence · note globale <b>${c.ovr}</b> · le coût augmente à partir de 60 puis de 80.
      L'entraînement (argent ou or) fait aussi progresser l'attribut travaillé.</p>
      <div class="a-list">${rows}</div>
      <div class="c-actions"><button class="c-btn" data-nav data-key="back" data-act="goto" data-arg="hub">Retour</button></div>`;
  }

  screen_training() {
    const c = this.career;
    const can = c.canTrain();
    const cards = DRILL_IDS.map((id, i) => {
      const d = DRILLS[id], best = c.s.drills[id] || 0;
      const medals = d.medals ? `Bronze ${d.medals[0]} · Argent ${d.medals[1]} · Or ${d.medals[2]} ${d.unit}` : 'Or : gagner · Argent : 5 points · Bronze : 3 points';
      return `
      <button class="c-card ${can ? '' : 'locked'}" data-nav ${i === 0 ? 'data-default' : ''} data-key="d-${id}" data-act="drill" data-arg="${id}">
        <span class="badge drill">${ATTR_LABEL[d.attr]}</span>
        <b>${d.label}</b>
        <span class="meta">${d.desc}</span>
        <span class="gain">${medals}</span>
        <span class="best medal-${MEDAL_CLASS[best]}">Record : ${MEDALS[best]}</span>
      </button>`;
    }).join('');
    return `
      <div class="c-title">ENTRAÎNEMENT</div>
      <p class="c-lead small">${can ? 'Un atelier par semaine (il remplace le tournoi de la semaine).' : 'Vous vous êtes déjà entraîné cette semaine : jouez un tournoi ou passez la semaine.'}
      Argent : +1 à l'attribut travaillé, or : +2 (moins au-delà de 60). Les plots et la machine à balles se jouent sur le court municipal.</p>
      <div class="c-cards">${cards}</div>
      <div class="c-actions"><button class="c-btn" data-nav data-act="goto" data-arg="hub">Retour</button></div>`;
  }

  itemLabel(it) {
    if (!it) return '';
    if (it.cat === 'venue') return VENUES[it.ref].label;
    if (it.cat === 'color') return `Couleur ${it.label.toLowerCase()}`;
    return it.label;
  }

  /** Aperçu de la boutique : le joueur porte l'objet sélectionné (ou le terrain s'affiche derrière). */
  shopPreview(it) {
    const c = this.career;
    if (!c) return;
    if (it?.cat === 'venue') { this.game.setShowcase(null, true); this.r3d.arena.setVenue(it.ref, 0); this.r3d.arena.setAmbiance('day'); return; }
    const look = { ...c.lookFor() };
    const field = { color: 'primary', headwear: 'headwear', racket: 'racket', design: 'racketDesign', kit: 'kitStyle', bag: 'bag' }[it?.cat];
    if (field) look[field] = it.ref;
    const app = { ...resolveLook(look), name: c.playerNpc().short, hand: c.s.profile.hand === 'L' ? -1 : 1 };
    this.game.setShowcase(app);
    if (it?.cat === 'racket' || it?.cat === 'design') { const sc = this.game.showcase; if (sc) sc.t = 0; }
  }

  screen_shop() {
    const c = this.career;
    const flash = this.flash ? `<p class="c-flash">${esc(this.flash)}</p>` : '';
    this.flash = null;
    const tabs = SHOP_CATEGORIES.map((k) => `<button class="c-tab ${k.id === this.shopCat ? 'on' : ''}" data-nav data-key="cat-${k.id}" data-act="shopCat" data-arg="${k.id}">${k.label}</button>`).join('');
    const items = SHOP_ITEMS.filter((i) => i.cat === this.shopCat).map((it) => {
      const own = c.owns(it.id), afford = (it.eur ? c.s.money : c.s.shopPts) >= it.price;
      const sw = it.hex != null ? `<i class="sw big ${it.metal ? 'metal' : ''}" style="background:${hex(it.hex)}"></i>` : '';
      const desc = it.cat === 'venue' ? VENUES[it.ref].desc : it.desc || '';
      const sel = this.shopSel === it.id;
      return `<button class="c-card shop ${own ? 'owned' : afford ? '' : 'locked'}${sel ? ' sel' : ''}" data-nav data-key="i-${it.id}" ${own ? '' : `data-act="buy" data-arg="${it.id}"`}>
        <span class="row1">${sw}<b>${esc(this.itemLabel(it))}</b></span>
        ${desc ? `<span class="meta">${esc(desc)}</span>` : ''}
        <span class="price">${own ? 'Acquis' : sel ? `Confirmer l'achat · ${it.eur ? `${fr(it.price)} €` : `${fr(it.price)} points`}` : it.price === 0 ? 'Gratuit' : it.eur ? `${fr(it.price)} €` : `${fr(it.price)} points`}</span>
      </button>`;
    }).join('');
    return `
      <div class="c-title">BOUTIQUE</div>
      <p class="c-lead small"><b class="sp">${fr(c.s.money)} €</b> pour le matériel et la tenue · <b class="sp">${fr(c.s.shopPts)}</b> points boutique pour les terrains et les personnages (exhibition).</p>
      ${flash}
      <div class="c-tabs">${tabs}</div>
      <div class="c-cards">${items}</div>
      <div class="c-actions"><button class="c-btn" data-nav data-act="goto" data-arg="hub">Retour</button></div>`;
  }

  screen_settings() {
    const c = this.career;
    const rows = TIERS.map((t) => `
      <div class="f-row"><b>${t.label}</b><div class="f-opts">
        ${c.formatChoices(t.id).map((f) => `<button class="c-tab ${c.formatFor(t.id) === f.id ? 'on' : ''}" data-nav data-key="fmt-${t.id}-${f.id}" data-act="format" data-arg="${t.id}:${f.id}">${f.label}</button>`).join('')}
      </div></div>`).join('');
    return `
      <div class="c-title">FORMATS DES MATCHS</div>
      <p class="c-lead small">Comme dans les vrais tournois, les petits niveaux se jouent souvent en tie-break ou en super tie-break.
      Le format s'applique aux prochains tournois (celui en cours garde le sien).</p>
      <div class="f-list">${rows}</div>
      <div class="c-actions"><button class="c-btn" data-nav data-default data-act="goto" data-arg="hub">Retour</button></div>`;
  }

  screen_ranking() {
    const rows = this.career.rankingTable(3);
    let prev = 0;
    const html = rows.map((r) => {
      const gap = r.rank > prev + 1 && prev ? '<div class="r-gap">···</div>' : '';
      prev = r.rank;
      return `${gap}<div class="r-row ${r.me ? 'me' : ''} ${r.kind}"><span class="rk">${r.rank >= UNRANKED ? '—' : fr(r.rank)}</span><span class="nm">${esc(r.name)}${r.kind === 'celebrity' ? '<i>invité</i>' : ''}</span><span class="pt">${fr(r.points)}</span></div>`;
    }).join('');
    return `
      <div class="c-title">CLASSEMENT MONDIAL</div>
      <p class="c-lead small">Les points d'un tournoi comptent pendant ${SEASON_WEEKS} semaines.</p>
      <div class="r-table"><div class="r-row head"><span class="rk">Rang</span><span class="nm">Joueur</span><span class="pt">Points</span></div>${html}</div>
      <div class="c-actions"><button class="c-btn" data-nav data-default data-act="goto" data-arg="hub">Retour</button></div>`;
  }

  screen_partner() {
    const c = this.career, cur = c.s.partner;
    const card = (p, i) => `
      <button class="c-card" data-nav ${i === 0 ? 'data-default' : ''} data-act="partner" data-arg="${i}">
        <b>${esc(p.name)}</b>
        <span class="meta">Note ${p.ovr} · ${(STYLES[p.style] || STYLES.allround).label} · ${p.hand === 'L' ? 'gaucher' : 'droitier'}</span>
        <span class="gain">Joue à ${p.side === 'L' ? 'gauche' : 'droite'} · paire notée ${Math.round((c.ovr + p.ovr) / 2)}</span>
      </button>`;
    return `
      <div class="c-title">PARTENAIRE</div>
      <p class="c-lead small">Actuel : <b>${esc(cur.name)}</b> · note ${cur.ovr} · ${(STYLES[cur.style] || STYLES.allround).label}. Il progresse avec vos victoires.
      De nouveaux joueurs se proposent toutes les 4 semaines, selon votre niveau.</p>
      <div class="c-cards">${c.partnerOptions().map(card).join('')}</div>
      <div class="c-actions"><button class="c-btn" data-nav data-act="goto" data-arg="hub">Garder ${esc(cur.name)}</button></div>`;
  }
}
