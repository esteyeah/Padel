// ============================================================================
//  Mode Aventure : deux emplacements de sauvegarde, déroulé des étapes,
//  écrans (dans le menu principal), cinématiques et matchs dans le jeu.
// ============================================================================
import { STEPS, PEOPLE, START_REL, CHAPTERS, chapterOf, ENDINGS, NAME } from './Story.js';
import { GUESTS } from './Story2.js';
import { DRILLS } from '../core/Drills.js';
import { VENUE_COURTS } from '../render/Venues.js';
import * as THREE from 'three';
// lieux de discussion hors du court (coordonnées du décor) : entre deux courts, bord de court / buvette
const SPOTS = {
  laciotat: { between: [0, -12], talk: [0, 3], bar: [33.9, 1.5, 3.2] },                 // bar : terrasse du club-house, en haut des gradins
  ceyreste: { between: [-21.5, -3], talk: [-23.5, 18], bar: [-31.8, 21.5, -0.88] },     // bar : terrasse du club-house en contrebas
  municipal: { between: [-8.5, 0], talk: [-8.5, 4], bus: [-9, -6], bar: [-8.5, 7] },
  beach: { talk: [-9, 14], between: [-9, 0], shore: [3, -32], bar: [-9, 14] },
  hangar: { between: [0, -12.5], talk: [-12.6, 4], bar: [-2.2, -22.9] },
  national: { between: [20, 14], talk: [20, 14], bar: [20, 14] },
  pro: { between: [0, 24], talk: [0, 24], bar: [0, 24] },
  prestige: { between: [-13, 0], talk: [-26, 26], loge: [0, -19.7, 3.45], entrance: [-7, -24], bar: [-26, 28.6] },
};
const toWorld = (venue, [x, z]) => { const c = (VENUE_COURTS[venue] || [[0, 0]])[0]; return [x - c[0], z - c[1]]; };
import { CELEBRITIES, COACH, genericNpc, makeNpc, PRO_PAIRS, ADV_NPCS } from '../career/data/roster.js';
import { unlockAdv } from '../career/data/shop.js';
import { npcSpec, drillCutscene } from '../career/Career.js';
import { resolveLook, DEFAULT_LOOK } from '../entities/Appearance.js';
import { flatStats } from '../config.js';
import { ask } from '../ui/Ask.js';

// déblocages à la fin de chaque chapitre (selon le parcours) : [id, libellé]
const UNLOCKS = {
  1: (c) => [['char:coach-romeo', 'Roméo (personnage)'], [`char:${{ eliott: 'eliott-hanras', jean: 'jean-deuxbe', raf: 'rafael-tomatis' }[c.partner]}`, `${{ eliott: 'Eliott', jean: 'Jean', raf: 'Raf' }[c.partner]} (personnage)`]],
  2: (c) => [['char:louka', 'Louka (personnage)'], ['venue:laciotat', 'Tennis de La Ciotat (terrain)'], ...(c.f.finalist ? [['char:dimitri-payet', 'Dimitri Payet (personnage)'], ['char:camille-roy', 'Camille Roy (personnage)'], ['char:timeo-boulhol', 'Timéo Boulhol (personnage)']] : [])],
  3: (c) => [['char:gege-pastis', 'Gégé (personnage)'], ['char:momo-rose', 'Momo (personnage)'], ...(c.f.rivalEliott ? [['char:philippe-hanras', 'Philippe Hanras (personnage)']] : []), ...(c.f.wonCey ? [['venue:ceyreste', 'Padel de Ceyreste (terrain)'], ['char:le-maire-de-ceyreste', 'Le maire (personnage)']] : [])],
  4: (c) => [['char:stephane-ruffier', 'Stéphane Ruffier (personnage)'], ...(c.f.contactNasri ? [['char:samir-nasri', 'Samir Nasri (personnage)']] : []), ...(c.f.contactHanouna ? [['char:cyril-hanouna', 'Cyril Hanouna (personnage)']] : []), ...(c.f.finalRiviera ? [['venue:prestige', 'Riviera Padel Palace (terrain)']] : [])],
  5: (c) => [...(c.f.regional === 'player' ? [['venue:beach', 'Padel Beach Arena (terrain)']] : []), ...(c.f.girlfriend ? [['char:lea', 'Léa (personnage)']] : [])],
  6: (c) => [['char:chico', 'Chico (personnage)'], ...(c.f.contactFlavien ? [['char:flavien', 'Flavien le barman (personnage)']] : []), ...(c.f.national ? [['char:nathan-subrero', 'Nathan Subrero (personnage)'], ['venue:hangar', 'Le Hangar (terrain)']] : [])],
  7: (c) => (c.f.mondial ? [['venue:national', 'Centre national (terrain)'], ['char:zinedine-zidane', 'Zinedine Zidane (personnage)']] : []),
  8: (c) => [['char:benjamin-tison', 'Benjamin Tison (personnage)'], ...(c.f.worldChamp ? [['venue:pro', 'Stade du Mondial (terrain)'], ['racket:mondial', 'Raquette du Mondial (équipement)'], ['money', '50 000 € pour la boutique']] : [])],
};
const KEY = (slot) => `padel-arena.adventure.${slot}`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const celeb = (id) => CELEBRITIES.find((c) => c.id === id) || PRO_PAIRS.flatMap((p) => p.players).find((c) => c.id === id);
const NPC_ID = { eliott: 'eliott-hanras', jean: 'jean-deuxbe', raf: 'rafael-tomatis', camille: 'camille-roy', timeo: 'timeo-boulhol', mayor: 'le-maire-de-ceyreste', payet: 'dimitri-payet', louka: 'louka', ruffier: 'stephane-ruffier', nasri: 'samir-nasri', mandanda: 'steve-mandanda', hanouna: 'cyril-hanouna', benarfa: 'hatem-ben-arfa', lacheau: 'philippe-lacheau', sichez: 'romain-sichez', tapia: 'agustin-tapia', coello: 'arturo-coello', nathan: 'nathan-subrero', zlatan: 'zlatan-ibrahimovic', zidane: 'zinedine-zidane' };
const EXTRA = ADV_NPCS;
const LABEL = { hostess: 'L\'hôtesse', lea: 'Léa', flavien: 'Flavien', chico: 'Chico', tison: 'Benjamin Tison', fan: 'Une supportrice', zlatan: 'Zlatan', zidane: 'Zidane', tapia: 'Tapia', coello: 'Coello', ruffier: 'Stéphane Ruffier', nasri: 'Samir Nasri', mandanda: 'Steve Mandanda', hanouna: 'Cyril Hanouna', benarfa: 'Hatem Ben Arfa', lacheau: 'Philippe Lacheau', sichez: 'Romain Sichez', journalist: 'Journaliste', veteran: 'Un vieux joueur', philippe: 'Philippe', eliott: 'Eliott', jean: 'Jean', raf: 'Raf', coach: 'Coach Roméo', camille: 'Camille', timeo: 'Timéo', mayor: 'Le maire', payet: 'Dimitri Payet', louka: 'Louka', gege: 'Gégé', momo: 'Momo', opp: 'Adversaire', ref: 'Juge-arbitre', narr: 'Narrateur' };
const val = (v, c) => (typeof v === 'function' ? v(c) : v);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
import { REST, GROUP, FRIEND_ACTS, COACH_TRAIN, ROAM_TALK } from './FreeTime.js';

export class AdventureUI {
  /** o : { startGame(opts), back(), rerender(), show(), getLook() } */
  constructor(o) {
    Object.assign(this, o);
    this.slot = null;           // emplacement choisi (1 ou 2)
    this.s = null;
    this.page = 0; this.sel = 0; this.react = null;
    // ancienne sauvegarde (une seule partie) : elle devient l'emplacement 1
    try { const old = localStorage.getItem('padel-arena.adventure'); if (old && !localStorage.getItem(KEY(1))) { localStorage.setItem(KEY(1), old); localStorage.removeItem('padel-arena.adventure'); } } catch { /* ignoré */ }
  }

  // ------------------------------------------------------------------ sauvegardes
  read(slot) { try { return JSON.parse(localStorage.getItem(KEY(slot)) || 'null'); } catch { return null; } }
  save() { if (this.slot) try { localStorage.setItem(KEY(this.slot), JSON.stringify(this.s)); } catch { /* ignoré */ } }
  open(slot) {
    this.slot = slot; this.s = this.read(slot); this.page = 0; this.sel = 0; this.react = null; this.view = null; this.note = null;
    if (this.s) { this.s.rep ??= 0; this.s.step = this.s.step === 'end' ? 'ch1_end' : this.s.step; if (!STEPS[this.s.step]) this.s.step = 'start'; }
    this.rerender();
  }
  async newGame() {
    const name = await ask('Ton prénom et ton nom', '', { max: 22, placeholder: 'Ex. : Alex Martin' });
    if (!name || !name.trim()) return;
    this.s = { v: 2, name: name.trim(), step: 'start', rel: { ...START_REL }, rep: 0, flags: {}, stats: flatStats(0.3), last: null, log: [] };
    this.page = 0; this.sel = 0; this.react = null;
    this.save(); this.rerender();
  }

  // ------------------------------------------------------------------ état
  get ctx() {
    const f = this.s?.flags || {};
    const partner = f.partner || 'eliott';
    const friends = ['eliott', 'jean', 'raf'].filter((x) => x !== partner);
    // chapitre 3 : si Eliott a quitté le groupe, Louka le remplace (et devient ton partenaire si besoin)
    const group = f.rivalEliott ? ['jean', 'raf', 'louka'] : ['eliott', 'jean', 'raf'];
    const partner3 = group.includes(partner) ? partner : 'louka';
    const mates3 = group.filter((x) => x !== partner3);
    const inv = (f.inv || []).filter((id) => { const g = GUESTS.find((x) => x[0] === id); return g && g[2]({ s: this.s, f }); });
    const pool = [...inv, 'random', 'random', 'random'];
    const p8 = f.p8 || partner3;
    return { s: this.s, f, guests9: inv, h9: pool.slice(0, 3), semi8: (p8 === partner3 ? mates3 : [partner3, mates3[0]]), partner, friends, partner3, mates3, rival3: f.rivalEliott ? 'eliott' : 'louka', group4: [partner3, ...mates3], partner6: f.withNasri ? 'nasri' : partner3, semiOpp: f.withNasri ? [f.rivalEliott ? 'eliott' : 'louka', f.rivalEliott ? 'philippe' : 'random'] : ['nasri', 'mandanda'] };
  }
  get step() { return this.s ? STEPS[this.s.step] : null; }
  get short() { return (this.s?.name || 'Toi').split(' ')[0]; }

  apply(effects = {}, set = {}, rep = 0) {
    if (set?.money) { this.onMoney?.(set.money); set = { ...set, money: undefined, moneyGot: (this.s.flags.moneyGot || 0) + set.money }; }
    for (const [k, v] of Object.entries(effects || {})) this.s.rel[k] = Math.max(-100, Math.min(100, (this.s.rel[k] || 0) + v));
    Object.assign(this.s.flags, set || {});
    this.s.rep = Math.max(-100, Math.min(100, (this.s.rep || 0) + (rep || 0)));
  }

  goto(id, autoplay = true) {
    this.s.step = id; this.page = 0; this.sel = 0; this.react = null; this.view = null; this.note = null;
    let st = STEPS[id];
    while (st?.type === 'branch') { id = st.to(this.ctx); this.s.step = id; st = STEPS[id]; }
    if (st?.effects && st.type !== 'choice') this.apply(val(st.effects, this.ctx));
    if (st?.rep && st.type === 'scene') this.apply({}, {}, st.rep);
    if (st?.type === 'end' && UNLOCKS[st.chapter] && !(this.s.unlockedCh || []).includes(st.chapter)) {
      const list = UNLOCKS[st.chapter](this.ctx).filter((x) => x[0] && !x[0].endsWith('undefined'));
      unlockAdv(list.map((x) => x[0]));
      this.s.unlockedCh = [...(this.s.unlockedCh || []), st.chapter];
      this.s.lastUnlocks = list.map((x) => x[1]);
    }
    if (st?.type === 'end' && st.ending) { try { const g = JSON.parse(localStorage.getItem('padel-arena.endings') || '[]'); if (!g.includes(st.ending)) { g.push(st.ending); localStorage.setItem('padel-arena.endings', JSON.stringify(g)); } } catch { /* ignoré */ } }
    if (st?.set && st.type === 'scene') this.apply({}, val(st.set, this.ctx));
    if (st?.venue) this.s.venue = st.venue;
    this.save();
    // les cinématiques s'enchaînent directement dans le jeu
    if (autoplay && (st?.type === 'scene' || (st?.type === 'choice' && !st.phone))) { this.play(st); return; }
    this.rerender();
  }

  // ------------------------------------------------------------------ personnages
  me(lane = 0) {
    if (lane && this.s?.lane) lane = this.s.lane;
    const look = this.getLook?.() || DEFAULT_LOOK;
    const print = (this.s.name.split(' ').pop() || 'JOUEUR').toUpperCase().slice(0, 12);
    // fatigue accumulée (matchs, entraînements) : on joue un peu en dessous de son niveau
    const tired = 1 - 0.14 * (this.s.fatigue || 0);
    const stats = Object.fromEntries(Object.entries(this.s.stats).map(([k, v]) => [k, v * tired]));
    return { name: this.short.toUpperCase(), human: true, hand: 1, lane, stats, appearance: { ...resolveLook(look), name: print } };
  }
  spec(id, kit, lane, o = {}) {
    if (id === 'me') return this.me(lane);
    if (id === 'coach') return npcSpec({ ...COACH, ovr: 55, attrs: { drive: 55, lob: 55, smash: 55, speed: 55, stamina: 55, strength: 55 } }, 'black', lane, o.idle);
    if (id === 'random') { const n = genericNpc(Math.random, o.ovr || 30); return npcSpec(n, kit, lane); }
    if (EXTRA[id]) return npcSpec(EXTRA[id], kit, lane, o.idle);
    if (id === 'narr') return npcSpec(EXTRA.opp, kit, lane, true);
    if (id === 'lea') return npcSpec(EXTRA.beachgirl, kit, lane, o.idle);
    if (id === 'hostess') return npcSpec(EXTRA.hostess, kit, lane, o.idle);
    return npcSpec(celeb(NPC_ID[id]), kit, lane, o.idle);
  }

  // ------------------------------------------------------------------ cinématique en jeu
  play(st) {
    const c = this.ctx;
    const cast = (val(st.cast, c) || ['me', st.who]).filter((x, i, a) => x && x !== 'narr' && a.indexOf(x) === i);
    if (cast.length < 2) cast.push('coach');
    const lines = [...(val(st.lines, c) || [])];
    const ch = st.type === 'choice' ? st : st.choice;
    let chosenNext = null;
    const specs = {};
    const meSpec = this.spec('me', 'blue', 0);
    const other = cast.find((x) => x !== 'me');
    const otherSpec = this.spec(other, 'red', 0, { idle: true });
    specs.me = meSpec; specs[other] = otherSpec;
    // les autres personnages se tiennent en arc de cercle sur le court
    const extras = cast.filter((x) => x !== 'me' && x !== other);
    const actors = extras.map((id, i) => {
      const sp = this.spec(id, i % 2 ? 'red' : 'blue', 0);
      const a = (i - (extras.length - 1) / 2) * 1.3;
      return { id, side: i % 2 ? -1 : 1, x: a * 1.6, z: (i % 2 ? -1 : 1) * 1.6, appearance: { ...sp.appearance, name: sp.name } };
    });
    const conv1 = (L) => {
      const label = L.who === 'me' ? this.short : LABEL[L.who] || L.who;
      const ref = (w) => (!w ? null : w === 'me' ? 'me' : w === other ? 'p1' : w);
      const base = { label: L.label || label, text: L.text, sheet: L.sheet, walk: L.walk, touch: L.touch, wave: ref(L.wave), give: ref(L.give) };
      if (L.who === 'me') return { side: 1, ...base };
      if (L.who === other) return { name: otherSpec.name, ...base };
      if (extras.includes(L.who)) return { actor: L.who, ...base };
      return { side: 1, ...base };
    };
    const conv = lines.map(conv1);
    if (ch) {
      // le choix se fait dans la cinématique : une touche par réponse, puis la réaction des personnages
      const q = conv1({ who: val(ch.who, c), text: val(ch.text, c) });
      const opts = val(ch.options, c);
      q.choices = opts.map((op) => ({ label: op.label, sub: op.sub }));
      q.onChoose = (k) => {
        const op = opts[k];
        this.apply(val(op.effects, this.ctx), val(op.set, this.ctx), op.rep);
        this.s.log.push({ step: this.s.step, choice: op.label });
        chosenNext = op.next;
        this.save();
        return (val(op.after, this.ctx) || []).map(conv1);
      };
      conv.push(q);
    }
    this.startGame({
      mode: 'career', sceneOnly: true, format: '1v1', sets: 1, matchTiebreak: 7, venue: st.venue || 'municipal', ambiance: st.ambiance || 'day',
      lineup: { near: [{ ...meSpec, lane: 0 }], far: [{ ...otherSpec, lane: 0 }] }, cutscene: conv, actors, party: false,
      onStarted: (g) => this.stage(g, st),
      onSceneEnd: () => { this.goto(chosenNext || val(st.next, c), true); const t = STEPS[this.s.step]?.type; if (t !== 'scene' && t !== 'choice') this.show(); },
    });
  }

  // ------------------------------------------------------------------ matchs, exercices, matchs regardés
  launch(st) {
    const c = this.ctx;
    const back = (result) => this.afterGame(st, result);
    if (st.type === 'drill') {
      const coach = this.spec('coach', 'black', 0, { idle: true });
      const cut = drillCutscene(st.drill, this.short.toUpperCase());
      if (cut?.[0]) { cut[0].text = st.intro || cut[0].text; cut[0].label = 'Coach Roméo'; }
      this.startGame({
        mode: 'drill', drill: st.drill, format: '1v1', sets: 1, gamesPerSet: 6, golden: true, matchTiebreak: 0, firstServer: 1,
        venue: 'municipal', ambiance: 'sunset', cutscene: cut, lineup: { near: [this.me(0)], far: [coach] }, onEnd: back, onQuit: () => this.show(),
      });
      return;
    }
    const near = val(st.near, c), far = val(st.far, c);
    const doubles = st.format !== '1v1';
    const myLane = this.s.lane || 1;
    const lanesN = doubles ? [myLane, -myLane] : [0], lanesF = doubles ? [1, -1] : [0];
    const mk = (id, i, kit, side) => {
      let sp = this.spec(id, kit, side > 0 ? lanesN[i] : lanesF[i], { ovr: st.randomOvr });
      if (st.weak?.includes(id)) sp = { ...sp, stats: flatStats(0.12), bot: { ...sp.bot, diff: { ...sp.bot.diff, level: 0.1, speedMul: 0.72, reaction: 0.5, planError: 0.6, margin: 1.2 } } };
      // demi-finale relevée ; raquettes sabotées par Raf : adversaires diminués
      if (side < 0 && st.hard) sp = { ...sp, bot: { ...sp.bot, diff: { ...sp.bot.diff, level: Math.min(0.95, (sp.bot.diff.level || 0.5) + 0.2), reaction: Math.max(0.1, (sp.bot.diff.reaction || 0.25) - 0.06) } } };
      if (side > 0 && id === 'me' && this.s.flags.weakened && st.hard) sp = { ...sp, stats: Object.fromEntries(Object.entries(sp.stats).map(([k, v]) => [k, k === 'power' ? v : v * 0.75])) };
      if (st.drunk?.includes(id)) sp = { ...sp, appearance: { ...sp.appearance, stance: { ...(sp.appearance.stance || {}), sway: 0.22, lean: 0.14, bounce: 0.15, tempo: 0.7, stride: 0.7 } }, stats: Object.fromEntries(Object.entries(sp.stats).map(([k, v]) => [k, k === 'power' ? v : 0.05])), bot: { ...sp.bot, diff: { ...sp.bot.diff, level: 0.04, speedMul: 0.6, planError: 1.2, reaction: 0.8, margin: 1.4 } } };
      if (side < 0 && this.s.flags.sabotage && st.hard) sp = { ...sp, stats: Object.fromEntries(Object.entries(sp.stats).map(([k, v]) => [k, typeof v === 'number' && k !== 'power' ? v * 0.8 : v])) };
      return sp;
    };
    const lineup = { near: near.map((id, i) => mk(id, i, 'blue', 1)), far: far.map((id, i) => mk(id, i, 'red', -1)) };
    if (st.type === 'watch') {
      lineup.near = lineup.near.map((p) => ({ ...p, human: false }));
      this.startGame({ mode: 'demo', format: '2v2', sets: 1, matchTiebreak: 10, venue: st.venue || 'ceyreste', ambiance: 'day', title: st.title || 'MATCH', subtitle: 'Vous regardez depuis le bord du court · A pour passer', lineup, watchFor: 40, startPoints: st.start, favor: 1, replays: false, party: false, onEnd: back,
        spectators: [this.me(0).appearance, ...(c.partner && !near.includes(c.partner) ? [this.spec(c.partner, 'blue', 0).appearance] : [])] });
      return;
    }
    this.startGame({
      mode: 'career', format: st.format, sets: 1, gamesPerSet: 6, golden: true, matchTiebreak: st.mt || 10, venue: st.venue, ambiance: st.ambiance,
      title: st.title || val(st.label, c).toUpperCase(), subtitle: st.subtitle || 'Entraînement', replays: false,
      sudden: !!st.sudden, rig: st.rig === 'lose', rigWin: st.rig === 'win', lineup, party: false, onEnd: back, onQuit: () => this.show(),
      drunk: (st.drunk || []).map((id) => this.spec(id, 'red', 0).name),
      midEvent: st.mid ? { at: st.mid.at, lines: () => this.midLines(st.mid) } : null,
    });
  }

  afterGame(st, result) {
    if (!result || result.quit) { this.show(); return; }
    if (st.type !== 'watch') {
      this.s.last = { won: !!result.won };
      const gain = st.type === 'drill' ? 0.025 + 0.01 * (result.medal || 0) : 0.018;
      const attr = st.type === 'drill' ? ({ serve: 'drive', lob: 'lob' }[st.drill] || 'drive') : ['speed', 'drive', 'smash', 'lob'][Math.floor(Math.random() * 4)];
      this.s.stats[attr] = Math.min(0.95, (this.s.stats[attr] || 0.3) + gain);
      this.s.stats.stamina = Math.min(0.95, (this.s.stats.stamina || 0.3) + 0.008);
      if (st.set) this.apply({}, val(st.set, this.ctx));
    }
    if (st.type === 'match') this.s.fatigue = Math.min(1, (this.s.fatigue || 0) + 0.22);
    if (st.compete) this.compete(st, result);
    const next = st.type === 'drill' || st.type === 'watch' ? st.next : (result.won ? st.win : st.lose);
    this.goto(next, true);
    const t = STEPS[this.s.step]?.type;
    if (t !== 'scene' && t !== 'choice') this.show();
  }

  /** Place les personnages hors du court (entre deux courts, à la buvette…) et ajoute les accessoires. */
  stage(g, st) {
    // personne ne joue : tout le monde discute hors du court (bord de court par défaut)
    const sp = SPOTS[st.venue || 'municipal']?.[st.spot || 'talk'];
    const props = st.props || {};
    const all = [...g.players.map((p) => ({ av: p.avatar, p, id: p === g.players[0] ? 'me' : null })), ...(g.actors || []).map((a) => ({ av: a.avatar, a, id: a.id }))];
    if (g.players[1]) { const o = val(st.cast, this.ctx).find((x) => x !== 'me'); all[1].id = o; }
    if (sp) {
      const [cx, cz] = toWorld(st.venue, sp);
      // tout le monde en cercle, face au centre : on se voit, personne ne se marche dessus
      const Y = sp[2] || 0;
      const people = [...g.players, ...(g.actors || [])];
      const N = people.length, R = N <= 2 ? 0.75 : 0.95 + 0.22 * N;
      people.forEach((q, i) => {
        // toi en face, ton interlocuteur principal de l'autre côté (devant le minibus…), les autres sur les côtés
        const k = i - 2, na = N - 2;
        const a = i === 0 ? 0 : i === 1 ? Math.PI : (k % 2 ? -1 : 1) * (Math.PI * ((Math.floor(k / 2) + 1) / (Math.ceil(na / 2) + 1)));
        q.pos.set(cx + Math.sin(a) * R, 0, cz + Math.cos(a) * R);
        q.avatar.root.position.y = Y;
      });
      g.opts.sceneY = Y;
      g.opts.sceneCenter = [cx, cz]; g.opts.sceneR = R;
    }
    if (st.noRacket) g.players[0].avatar.racket.visible = false;   // on n'a pas encore de raquette
    if (st.bus && sp) {
      // minibus blanc du club garé à côté du groupe
      const [cx, cz] = toWorld(st.venue, sp);
      const bus = new THREE.Group(); bus.position.set(cx, 0, cz - (g.opts.sceneR || 1) - 2.3); bus.rotation.y = Math.PI / 2; bus.userData.adv = true;   // garé juste derrière le groupe, de profil
      const body = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.2 }), glass = new THREE.MeshStandardMaterial({ color: 0x1a2533, roughness: 0.1, metalness: 0.5 }), dark = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.7 });
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.2, 5.4), body); b1.position.y = 1.4; bus.add(b1);
      for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.7), glass); w.position.set(sx * 1.01, 1.9, -0.2); w.rotation.y = sx * Math.PI / 2; bus.add(w); }
      const wf = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.8), glass); wf.position.set(0, 1.85, 2.71); bus.add(wf);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.18, 5.42), new THREE.MeshStandardMaterial({ color: 0x1f5fbf })); stripe.position.y = 1.15; bus.add(stripe);
      for (const [x, z] of [[-1, 1.8], [1, 1.8], [-1, -1.8], [1, -1.8]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 14).rotateZ(Math.PI / 2), dark); w.position.set(x, 0.36, z); bus.add(w); }
      bus.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.scene.add(bus);
      g._advProps = [...(g._advProps || []), bus];
    }
    for (const it of all) if (props[it.id] === 'beer') {
      const beer = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.17, 12), new THREE.MeshStandardMaterial({ color: 0xd99a1c, roughness: 0.15, transparent: true, opacity: 0.85 }));
      beer.position.set(0, -0.3, 0.02); it.av.lElbow?.add(beer);
      it.av.racket.visible = false;
    }
  }

  /** Situation de fair-play en plein match : choix dans une courte cinématique, effet sur le score. */
  midLines(mid) {
    const c = this.ctx;
    const lbl = (w) => (w === 'me' ? this.short : LABEL[w] || w);
    return [{
      side: 1, label: lbl(mid.who), text: val(mid.text, c),
      choices: mid.options.map((o) => ({ label: o.label })),
      onChoose: (k, game) => {
        const op = mid.options[k];
        this.apply(val(op.effects, this.ctx), op.set, op.rep);
        const h = game.human;
        if (h && op.point && game.score.tiebreak && Math.max(...game.score.points) < game.score.tbTarget - 1) { game.score.pointTo(op.point === 'us' ? h.side : -h.side); game.hud.updateScore(game.score); }
        this.save();
        return (val(op.after, this.ctx) || []).map((L) => ({ side: 1, label: lbl(L.who), text: L.text }));
      },
    }];
  }

  /** Entraînement à cinq : ton score et ceux des autres ; Eliott finit dernier, de peu. */
  compete(st, result) {
    const mine = result.score ?? result.points ?? (result.medal || 0) * 3;
    const sc = (this.s.compete ??= { me: 0, jean: 0, raf: 0, louka: 0, eliott: 0 });
    const tot = DRILLS[st.drill]?.total || 10;
    sc.me += mine;
    sc.raf += Math.max(mine + 1, Math.round(tot * 0.6));
    sc.jean += Math.max(1, Math.round(tot * 0.45 + Math.random() * 2));
    sc.louka += Math.max(1, Math.round(tot * 0.5 + Math.random() * 2));
    const others = ['me', 'jean', 'raf', 'louka'].map((k) => sc[k]);
    sc.eliott = Math.max(0, Math.min(...others) - 1 - Math.round(Math.random()));
    const names = { me: this.short, jean: 'Jean', raf: 'Raf', louka: 'Louka', eliott: 'Eliott' };
    this.s.ranking = Object.entries(sc).map(([id, pts]) => ({ id, name: names[id], pts })).sort((a, b) => b.pts - a.pts);
  }

  // ------------------------------------------------------------------ temps libre (avant un match)
  /** Temps libre : une seule fois par chapitre (3 activités), pour ne pas devenir répétitif. */
  freeLeft() {
    const ch = chapterOf(this.s.step);
    if (!this.s.free || this.s.free.ch !== ch) this.s.free = { ch, left: 3 };
    return this.s.free.left;
  }
  spend(note) { this.s.free.left--; this.note = note; this.save(); this.rerender(); }
  /** Prochaine activité pas encore faite d'une liste (on évite les répétitions). */
  nextOf(key, list) {
    const done = (this.s.done ??= {})[key] || [];
    const i = list.findIndex((_, k) => !done.includes(k));
    return i < 0 ? { i: Math.floor(Math.random() * list.length), item: list[Math.floor(Math.random() * list.length)], again: true } : { i, item: list[i] };
  }
  markDone(key, i) { const d = (this.s.done ??= {}); d[key] = [...new Set([...(d[key] || []), i])]; }

  freeActions(add) {
    const f = this.s.flags, left = this.freeLeft();
    if (this.view === 'train') {
      const LBL = { drive: 'Coup droit et revers', lob: 'Lobs', smash: 'Smashs', speed: 'Déplacements', stamina: 'Endurance', strength: 'Musculation' };
      for (const [k, l] of Object.entries(LBL)) add(`${l}<small>niveau ${Math.round((this.s.stats[k] || 0.3) * 100)}</small>`, () => {
        this.s.stats[k] = Math.min(0.95, (this.s.stats[k] || 0.3) + 0.015);
        this.s.fatigue = Math.min(1, (this.s.fatigue || 0) + 0.18);
        this.view = 'free';
        const coach = f.knowsRomeo || chapterOf(this.s.step) >= 2;
        this.spend({ who: coach ? 'Coach Roméo' : this.short, text: coach ? pick(COACH_TRAIN[k]) : 'Une heure seul sur le court, à répéter le même geste. Ça finit par rentrer.' });
      }, 'choice');
      add('Retour', () => { this.view = 'free'; this.rerender(); }, 'small');
      return;
    }
    if (this.view === 'cards') {
      // belote au club-house avec la bande
      const res = (who, text) => { this.view = 'free'; this.spend({ who, text }); };
      add('Jouer sérieusement', () => { if (Math.random() < 0.5) { this.apply({ raf: -3, jean: 2 }); res('Raf', '« Belote… rebelote… et dix de der. » Tu gagnes. Raf jette ses cartes : « Elles étaient mal battues. »'); } else { this.apply({ raf: 3, eliott: 1 }); res('Raf', 'Raf gagne et fait le tour de la table en levant les bras. Il est d\'excellente humeur pour une fois.'); } }, 'choice');
      add('Tenter un gros bluff', () => { if (Math.random() < 0.45) { this.apply({ eliott: 3, jean: 2 }); res('Eliott', 'Personne n\'ose suivre. Tu retournes tes cartes : rien du tout. Eliott pleure de rire.'); } else { this.apply({ raf: 2 }, {}, -1); res('Jean', 'Jean te regarde par-dessus ses lunettes : « Tu n\'as rien, toi. » Grillé. Toute la table se moque de toi.'); } }, 'choice');
      add('Faire équipe avec Eliott et le laisser briller', () => { this.apply({ eliott: 6, raf: -2 }); res('Eliott', 'Il annonce un capot et le réussit, grâce à toi. Il en parlera pendant trois semaines.'); }, 'choice');
      return;
    }
    if (left <= 0) { add('Plus de temps libre pour ce chapitre', () => { this.view = null; this.note = null; this.rerender(); }, 'primary'); return; }
    add(`S'entraîner<small>+ niveau, + fatigue</small>`, () => { this.view = 'train'; this.rerender(); }, 'choice');
    const rest = this.nextOf('rest', REST);
    add(`${rest.item.label}<small>récupération · fatigue ${Math.round((this.s.fatigue || 0) * 100)} %</small>`, () => {
      this.s.fatigue = Math.max(0, (this.s.fatigue || 0) - 0.5); this.markDone('rest', rest.i);
      this.spend({ who: this.short, text: rest.item.text });
    }, 'choice');
    // activité de groupe (une différente à chaque fois)
    const grp = this.nextOf('group', GROUP);
    add(`${grp.item.label}<small>avec toute la bande</small>`, () => {
      this.markDone('group', grp.i);
      if (grp.item.cards) { this.view = 'cards'; this.note = { who: 'Club-house', text: 'Jean sort le jeu de cartes, Raf compte les points, Eliott a déjà commandé les boissons. Une belote, à quatre. Comment tu joues ?' }; this.rerender(); return; }
      this.apply(grp.item.rel || {});
      this.s.fatigue = Math.min(1, Math.max(0, (this.s.fatigue || 0) + (grp.item.fat || 0)));
      this.spend({ who: grp.item.who, text: grp.item.text });
    }, 'choice');
    // une activité propre à chacun, qui change à chaque fois
    const friends = ['eliott', 'jean', 'raf', ...(f.metLouka ? ['louka'] : [])];
    for (const id of friends) {
      const a = this.nextOf(id, FRIEND_ACTS[id]);
      add(`${a.item.label}<small>${NAME[id]} · relation ${(this.s.rel[id] || 0) > 0 ? '+' : ''}${this.s.rel[id] || 0}</small>`, () => {
        if (id === 'eliott' && f.rivalEliott && (this.s.rel.eliott || 0) < 0) { this.apply({ eliott: 2 }); this.spend({ who: 'Eliott', text: 'Il voit ton message… et ne répond pas. Il faudra du temps.' }); return; }
        if (id === 'raf' && (this.s.rel.raf || 0) < -20) { this.apply({ raf: 3 }); this.spend({ who: 'Raf', text: '« Avec toi ? » Il accepte quand même, du bout des lèvres, et regarde son téléphone tout du long.' }); return; }
        this.markDone(id, a.i);
        this.apply({ [id]: a.item.rel ?? 6 });
        if (a.item.stat) this.s.stats[a.item.stat] = Math.min(0.95, (this.s.stats[a.item.stat] || 0.3) + 0.01);
        this.s.fatigue = Math.min(1, Math.max(0, (this.s.fatigue || 0) + (a.item.fat ?? 0.04)));
        this.spend({ who: NAME[id], text: a.item.text });
      }, 'choice');
    }
    const ch = chapterOf(this.s.step);
    if (ch >= 3 && f.sponsorCh !== ch) {
      const rep = this.s.rep || 0;
      const sp = rep >= 10 ? { name: 'le magasin de sport de La Ciotat', money: 300, rep: 2, text: 'Un maillot floqué à leur nom et 300 € pour le tournoi. Ils aiment ton fair-play.' }
        : rep < 0 ? { name: 'un site de paris en ligne un peu louche', money: 800, rep: -6, text: '800 € tout de suite. Le logo est criard, et les gens du club te regardent de travers.' }
        : { name: 'la boulangerie de Ceyreste', money: 150, rep: 1, text: '150 € et des croissants à volonté le dimanche. Le maire trouve ça très bien.' };
      add(`Rencontrer un sponsor<small>${esc(sp.name)}</small>`, () => {
        this.apply({}, { money: sp.money, sponsorCh: ch, sponsor: sp.name }, sp.rep);
        this.spend({ who: 'Sponsor', text: sp.text });
      }, 'choice');
    }
    add('Retour', () => { this.view = null; this.note = null; this.rerender(); }, 'small');
  }

  // ------------------------------------------------------------------ promenade libre dans le club
  roamVenue() {
    const v = this.s.venue || 'ceyreste';
    return SPOTS[v] && v !== 'national' && v !== 'pro' ? v : 'ceyreste';
  }
  roam() {
    const f = this.s.flags, venue = this.roamVenue(), ch = chapterOf(this.s.step);
    const S = SPOTS[venue];
    const c0 = (VENUE_COURTS[venue] || [[0, 0]])[0];
    const courts = (VENUE_COURTS[venue] || [[0, 0]]).map((q) => ({ x: q[0] - c0[0], z: q[1] - c0[1], rot: Math.abs(Math.sin(q[2] || 0)) > 0.5 }));
    // matchs en cours sur les courts voisins, selon le lieu
    const R = () => 'random';
    const MATCHES = {
      prestige: [[['zidane', 'zlatan'], ['payet', 'nasri'], 'Zidane et Zlatan contre Payet et Nasri'], [['tapia', 'coello'], ['benarfa', 'lacheau'], 'Tapia et Coello en démonstration'], [['mandanda', 'hanouna'], ['sichez', 'random'], 'Mandanda et Hanouna']],
      ceyreste: [[['nathan', R()], [R(), R()], 'Nathan Subrero et des habitués'], [[R(), R()], [R(), R()], 'Des habitués du club']],
      laciotat: [[['nathan', R()], ['camille', 'timeo'], 'Nathan contre Camille et Timéo'], [[R(), R()], [R(), R()], 'Des joueurs du club']],
    }[venue] || [[[R(), R()], [R(), R()], 'Des joueurs du club']];
    const used = MATCHES.slice(0, Math.max(0, courts.length - 1));
    const playing = new Set(used.flatMap((m) => [...m[0], ...m[1]]));
    const ambient = used.map((m, i) => ({ court: courts[i + 1], label: m[2], ids: [m[0], m[1]], looks: [...m[0], ...m[1]].map((id, k) => this.spec(id, k < 2 ? 'blue' : 'red', 0, { ovr: 40 }).appearance) }));
    const freeCourts = courts.filter((_, i) => !(i >= 1 && i <= used.length));
    // qui se promène, et ce qu'il fait
    const ids = [];
    if ((!f.rivalEliott || (this.s.rel.eliott || 0) > -30)) ids.push('eliott');
    for (const id of ['jean', 'raf']) if (!playing.has(id)) ids.push(id);
    if (f.metLouka) ids.push('louka');
    if (f.knowsRomeo || ch >= 2) ids.push('coach');
    const local = { ceyreste: 'mayor', laciotat: 'gege', hangar: 'flavien', prestige: 'hostess', beach: 'lea' }[venue];
    if (local) ids.push(local);
    // Ceyreste : la bande de Camille et Timéo, et des habitués du village
    if (venue === 'ceyreste') ids.push('camille', 'timeo', 'hab1', 'hab2', 'hab3', 'hab4');
    const pts = ['talk', 'between', 'bar', 'bus', 'entrance'].map((k) => S[k]).filter((q) => q && !(q[2] > 0.2 || q[2] < -0.2)).map((q) => toWorld(venue, q));
    const start = pts[0];
    const ACT = { hab1: 'chat', hab2: 'chat', hab3: 'drink', hab4: 'wander', camille: 'swing', timeo: 'phone', eliott: 'chat', louka: 'chat', jean: 'swing', raf: 'swing', coach: 'wander', mayor: 'phone', gege: 'drink', flavien: 'drink', hostess: 'wander', lea: 'phone' };
    const acts = {};
    const actors = ids.map((id, i) => {
      const base = pts[(i + 1) % pts.length] || start;
      let x = base[0] + Math.sin(i * 2.4) * (2 + (i % 3)), z = base[1] + Math.cos(i * 2.4) * (2 + (i % 3));
      // Eliott et Louka discutent ensemble
      if (id === 'louka' && ids.includes('eliott')) { const e = ids.indexOf('eliott'); const b = pts[(e + 1) % pts.length] || start; x = b[0] + Math.sin(e * 2.4) * (2 + (e % 3)) + 1.1; z = b[1] + Math.cos(e * 2.4) * (2 + (e % 3)); }
      if (id === 'hab2') { const k = ids.indexOf('hab1'); const b = pts[(k + 1) % pts.length] || start; x = b[0] + Math.sin(k * 2.4) * (2 + (k % 3)) - 1.1; z = b[1] + Math.cos(k * 2.4) * (2 + (k % 3)); }
      acts[id] = { act: ACT[id] || 'idle', faceTo: id === 'hab1' ? 'hab2' : id === 'hab2' ? 'hab1' : id === 'eliott' && ids.includes('louka') ? 'louka' : id === 'louka' ? 'eliott' : null, wander: ACT[id] === 'wander' ? { x: x + 5, z: z - 3 } : null };
      const sp = this.spec(id.startsWith('hab') ? 'random' : id, i % 2 ? 'red' : 'blue', 0, { idle: true, ovr: 30 });
      return { id, label: id.startsWith('hab') ? (sp.appearance?.female ? 'Une habituée' : 'Un habitué') : LABEL[id] || NAME[id] || id, side: 1, x, z, yaw: i * 1.3, appearance: { ...sp.appearance, name: sp.name } };
    });
    const xs = [...pts.map((q) => q[0]), ...courts.map((q) => q.x)], zs = [...pts.map((q) => q[1]), ...courts.map((q) => q.z)];
    const bounds = [Math.min(...xs) - 9, Math.max(...xs) + 9, Math.min(...zs) - 9, Math.max(...zs) + 9];
    // terrain de pétanque (Ceyreste)
    const petanque = venue === 'ceyreste' ? { x: -36 - c0[0], z: 1.2 - c0[1], y: -0.9, w: 4, l: 10 } : null;
    const me = this.me(0);
    const line = (who, text, extra = {}) => (who === 'me' ? { side: 1, label: this.short, text, ...extra } : { actor: who, label: LABEL[who] || NAME[who] || who, text, ...extra });
    const conv = (L) => line(L.who, L.text);
    const ov = (t) => ({ ...t });
    this.startGame({
      mode: 'career', sceneOnly: true, format: '1v1', sets: 1, matchTiebreak: 7, venue, ambiance: ['ceyreste', 'laciotat', 'beach'].includes(venue) ? 'sunset' : 'day',
      lineup: { near: [{ ...me, lane: 0 }], far: [{ ...this.spec('random', 'red', 0), lane: 0 }] }, actors, party: false,
      roam: {
        bounds, startYaw: 0, acts, ambient, freeCourts, petanque,
        talk: (id, again) => {
          const rel = this.s.rel[id] || 0;
          const tk = id.startsWith('hab') ? 'hab' : id;
          const pool = ROAM_TALK[tk] ? ROAM_TALK[tk]({ rel, ch, f, short: this.short, venue, id }) : [[{ who: id, text: 'Belle journée, hein ?' }]];
          const k = ((this.s.done ??= {})['talk_' + id] || 0);
          this.s.done['talk_' + id] = k + 1;
          const lines = pool[k % pool.length].map(conv);
          if (!again && !(this.s.talkCh ??= {})[id + ch] && PEOPLE[id]) { this.apply({ [id]: 2 }); this.s.talkCh[id + ch] = 1; }
          // propositions : pierre-feuille-ciseaux avec Eliott, quelques échanges sur un court avec d'autres
          if (id === 'eliott' && rel > -10 && k % 2 === 0) lines.push(line('eliott', 'Hé, pierre-feuille-ciseaux en trois manches ? Le perdant paie les boissons !', { choices: [{ label: 'Allez, je te prends !' }, { label: 'Pas maintenant' }], onChoose: (c) => (c === 0 ? [this.rps(0, 0, 0)] : [line('eliott', 'Trouillard ! Je plaisante. Enfin… un peu.')]) }));
          if (['jean', 'raf', 'coach', 'louka'].includes(id) && !(id === 'raf' && rel < -20) && (k % 2 === 1 || id === 'coach')) {
            const who = { jean: 'Jean', raf: 'Raf', coach: 'Le coach', louka: 'Louka' }[id];
            lines.push(line(id, id === 'raf' ? 'Tiens, un court est libre. Tu veux que je te donne une petite leçon ?' : id === 'coach' ? 'Le court est libre. Montre-moi ce que tu as appris : quelques échanges, un tie-break.' : id === 'louka' ? 'Mon genou tient. On tape quelques balles ? Doucement, hein.' : 'Un court s\'est libéré. On fait quelques échanges ?', {
              choices: [{ label: 'Avec plaisir' }, { label: 'Une autre fois' }],
              onChoose: (c, g) => { if (c === 0) { g.roam.pending = (gg) => gg.endRoam(() => this.rally(id)); return [line(id, 'Allez, on y va.')]; } return [line(id, `${who === 'Raf' ? 'Tu as peur, c\'est ça.' : 'Pas de souci, une autre fois.'}`)]; },
            }));
          }
          this.save();
          return lines;
        },
        petanqueLines: () => {
          const PET = {
            mayor: { skill: 0.97, style: 'pointeur', plomb: 0.45, hi: 'Ah, la pétanque ! Le vrai sport de Ceyreste.', win: 'Bravo ! Je dirai à tout le village que tu m\'as battu.', lose: 'Ne le prends pas mal, j\'ai quarante ans de boulodrome.', effW: {}, effL: {} },
            coach: { skill: 0.97, style: 'tireur', hi: 'La pétanque, c\'est comme le padel : de la concentration. Et je tire au fer.', win: 'Tu m\'as battu. Je ne le dirai à personne, et toi non plus.', lose: 'Carreau. Encore carreau. Tu as vu ? C\'est ça, la précision.', effW: { coach: 4 }, effL: { coach: 2 } },
            louka: { skill: 0.8, style: 'tireur', hi: 'Avec mon genou je ne cours plus, mais tirer, ça je sais faire.', win: 'Bien joué ! Mais attends que mon genou soit guéri…', lose: 'Ça fait du bien de gagner quelque chose en ce moment. Merci.', effW: { louka: 3 }, effL: { louka: 5 } },
            camille: { skill: 0.5, style: 'pointeur', hi: 'Je te préviens, à la pétanque je suis imbattable. Vraiment imbattable.', win: 'Le terrain penche. C\'est évident, il penche. Je l\'ai toujours dit.', lose: 'Tu vois ? Imbattable. Je te l\'avais dit.', effW: {}, effL: {} },
            timeo: { skill: 0.6, style: 'tireur', pose: 'knee', hi: 'Ouais, vas-y. Je tire debout, la main sur le genou. Ne pose pas de questions.', win: 'Pff. Le soleil m\'a ébloui. Deux fois.', lose: 'Main sur le genou, ça marche à tous les coups. Enfin, presque.', effW: {}, effL: {} },
            raf: { skill: 0.7, style: 'tireur', hi: 'Tu vas voir, je tire comme un pro.', win: 'Le terrain est pourri. Les boules sont pourries. Revanche.', lose: 'Le roi de la pétanque, c\'est moi. Note-le quelque part.', effW: { raf: -3 }, effL: { raf: 5 } },
            jean: { skill: 0.55, style: 'pointeur', hi: 'Avec plaisir. Je ne suis pas un champion, mais je mesure tout au mètre.', win: 'Bien joué. Ton dernier point, c\'était du grand art.', lose: 'Oh ! J\'ai gagné ? Ça ne m\'arrive pas souvent.', effW: { jean: 4 }, effL: { jean: 3 } },
            eliott: { skill: 0.35, style: 'pointeur', hi: 'Super ! Je sais pas jouer, mais je suis motivé !', win: 'Je savais que tu étais bon, mais là…', lose: 'J\'AI GAGNÉ ?! J\'ai gagné ! Je vais le dire à tout le monde !', effW: { eliott: 2 }, effL: { eliott: 5 } },
          };
          this._pet = PET;
          const opps = Object.keys(PET).filter((x) => ids.includes(x));
          if (!opps.length) return [line('me', 'Personne pour jouer… Il faudra revenir avec quelqu\'un.')];
          const page = (k) => {
            const sl = opps.slice(k * 3, k * 3 + 3), more = opps.length > k * 3 + 3;
            return line('me', k ? 'Et parmi les autres ?' : 'Une partie de pétanque ? Contre qui ?', {
              choices: [...sl.map((x) => ({ label: LABEL[x] || NAME[x] })), { label: more ? 'Autres joueurs…' : 'Finalement non' }],
              onChoose: (c, g) => {
                const id = sl[c];
                if (!id) return more ? [page(k + 1)] : [];
                g.roam.pending = (gg) => gg.startPetanque(id, PET[id]);
                return [line(id, PET[id].hi)];
              },
            });
          };
          return [page(0)];
        },
        onPetanque: (id, won, score) => {
          const P = this._pet?.[id] || {};
          this.apply((won ? P.effW : P.effL) || {}, {}, id === 'mayor' && won ? 1 : 0);
          this.s.log.push({ step: this.s.step, choice: `Pétanque contre ${LABEL[id] || id} : ${won ? 'gagné' : 'perdu'} ${score[0]}-${score[1]}` });
          this.save();
          return [line(id, `${(won ? P.win : P.lose) || 'Belle partie.'} (${score[0]} - ${score[1]})`)];
        },
        trainLines: () => [line('me', 'Un court libre. Qu\'est-ce que je travaille ?', {
          choices: [{ label: 'Services' }, { label: 'Lobs' }, { label: 'Smash par 3' }, { label: 'Rien, je continue' }],
          onChoose: (c, g) => { const d = ['serve', 'lob', 'smash'][c]; if (d) g.roam.pending = (gg) => gg.endRoam(() => this.trainDrill(d)); return []; },
        })],
        onWatch: (info) => this.watchAmbient(info, venue),
      },
      onStarted: (g) => { g.players[0].pos.set(start[0], 0, start[1] + 1.5); g.players[0].avatar.racket.visible = false; },
      onSceneEnd: () => this.show(),
    });
  }

  /** Pierre-feuille-ciseaux en trois manches gagnantes… deux, contre Eliott. */
  rps(round, mine, his) {
    const N = ['Pierre', 'Feuille', 'Ciseaux'];
    const L = (who, text, extra = {}) => (who === 'me' ? { side: 1, label: this.short, text, ...extra } : { actor: who, label: 'Eliott', text, ...extra });
    return L('eliott', round === 0 ? 'Un, deux, trois… pierre, feuille, ciseaux !' : `${mine} - ${his}. Manche suivante : pierre, feuille, ciseaux !`, {
      choices: N.map((n) => ({ label: n })),
      onChoose: (k) => {
        const e = Math.floor(Math.random() * 3);
        const res = k === e ? 0 : (k - e + 3) % 3 === 1 ? 1 : -1;
        const m2 = mine + (res > 0 ? 1 : 0), h2 = his + (res < 0 ? 1 : 0);
        const out = [L('me', `${N[k]} !`), L('eliott', `${N[e]} ! ${res === 0 ? 'Égalité, on rejoue !' : res > 0 ? pick(['Nooon !', 'Tu triches, c\'est sûr.', 'Je l\'ai pas vu venir…']) : pick(['HA ! Je lis en toi comme dans un livre !', 'Trop facile !', 'Le maître, c\'est moi.'])}`)];
        if (m2 >= 2 || h2 >= 2) {
          const won = m2 > h2;
          this.apply({ eliott: won ? 2 : 4 });
          this.s.log.push({ step: this.s.step, choice: `Pierre-feuille-ciseaux contre Eliott : ${won ? 'gagné' : 'perdu'} ${m2}-${h2}` });
          this.save();
          out.push(L('eliott', won ? 'Bon… je paie les boissons. Mais je veux ma revanche la semaine prochaine.' : 'C\'est ta tournée ! Un sirop de menthe, s\'il te plaît. Grand.'));
        } else out.push(this.rps(round + 1, m2, h2));
        return out;
      },
    });
  }

  /** Quelques échanges (tie-break) contre un ami sur un court libre. */
  rally(id) {
    const venue = this.roamVenue();
    const opp = this.spec(id, 'red', 0, { ovr: 40 });
    this.startGame({
      mode: 'career', format: '1v1', sets: 1, gamesPerSet: 6, golden: true, matchTiebreak: 7, venue, ambiance: 'day',
      title: 'QUELQUES ÉCHANGES', subtitle: `Contre ${LABEL[id] || NAME[id] || id}`, replays: false, sudden: false, party: false,
      lineup: { near: [this.me(0)], far: [opp] },
      onEnd: (r) => {
        if (r && !r.quit) {
          const eff = r.won ? { jean: { jean: 3 }, raf: { raf: -2 }, coach: { coach: 5 }, louka: { louka: 4 } }[id] : { jean: { jean: 2 }, raf: { raf: 4 }, coach: { coach: 1 }, louka: { louka: 3 } }[id];
          this.apply(eff || {});
          this.s.stats.drive = Math.min(0.95, (this.s.stats.drive || 0.3) + 0.006);
          this.s.log.push({ step: this.s.step, choice: `Échanges contre ${LABEL[id] || id} : ${r.won ? 'gagné' : 'perdu'}` });
          this.save();
        }
        this.show();
      },
      onQuit: () => this.show(),
    });
  }

  /** Entraînement en solo sur un court libre, choisi pendant la promenade. */
  trainDrill(d) {
    const coach = this.spec('coach', 'black', 0, { idle: true });
    const cut = drillCutscene(d, this.short.toUpperCase());
    this.startGame({
      mode: 'drill', drill: d, format: '1v1', sets: 1, gamesPerSet: 6, golden: true, matchTiebreak: 0, firstServer: 1,
      venue: this.roamVenue(), ambiance: 'day', cutscene: cut, lineup: { near: [this.me(0)], far: [coach] },
      onEnd: (r) => {
        if (r && !r.quit) { const attr = DRILLS[d]?.attr || 'drive'; this.s.stats[attr] = Math.min(0.95, (this.s.stats[attr] || 0.3) + 0.008 + 0.004 * (r.medal || 0)); this.s.fatigue = Math.min(1, (this.s.fatigue || 0) + 0.08); this.save(); }
        this.show();
      },
      onQuit: () => this.show(),
    });
  }

  /** On regarde pour de vrai un des matchs aperçus pendant la promenade. */
  watchAmbient(info, venue) {
    const kit = (k) => (k < 2 ? 'blue' : 'red');
    const lineup = { near: info.ids[0].map((id, k) => ({ ...this.spec(id, kit(k), k ? -1 : 1, { ovr: 40 }), human: false })), far: info.ids[1].map((id, k) => ({ ...this.spec(id, kit(k + 2), k ? -1 : 1, { ovr: 40 }), human: false })) };
    this.startGame({ mode: 'demo', format: '2v2', sets: 1, matchTiebreak: 10, venue, ambiance: 'day', title: 'MATCH', subtitle: `${info.label} · A pour partir`, lineup, watchFor: 60, replays: false, party: false,
      spectators: [this.me(0).appearance], onEnd: () => this.show() });
  }

  journal() {
    const lines = Object.entries(PEOPLE).filter(([, p]) => !p.hidden || this.s.flags.metLouka).map(([k, p]) => {
      const v = this.s.rel[k] || 0;
      const mood = v >= 50 ? 'te fait totalement confiance' : v >= 20 ? 't\'apprécie' : v >= -10 ? 'reste neutre' : v >= -40 ? 'se méfie de toi' : 'ne te supporte plus';
      return `<b style="color:${p.color}">${esc(p.name)}</b> ${mood} (${v > 0 ? '+' : ''}${v})`;
    });
    const rep = this.s.rep || 0;
    lines.push(`<b>Réputation</b> : ${rep >= 30 ? 'modèle de fair-play' : rep >= 5 ? 'plutôt bonne' : rep > -10 ? 'neutre' : rep > -40 ? 'on parle de toi dans ton dos' : 'tricheur notoire'} (${rep})`);
    if (this.s.flags.sponsor) lines.push(`<b>Sponsor</b> : ${esc(this.s.flags.sponsor)}`);
    lines.push(`<b>Fatigue</b> : ${Math.round((this.s.fatigue || 0) * 100)} %`);
    const log = (this.s.log || []).slice(-6).map((x) => `· ${esc(x.choice)}`);
    return `<div class="adv-line"><b>Journal</b><p>${lines.join('<br>')}</p>${log.length ? `<p><b>Tes derniers choix</b><br>${log.join('<br>')}</p>` : ''}</div>`;
  }

  // ------------------------------------------------------------------ rendu
  gauges() {
    const people = Object.entries(PEOPLE).filter(([k, p]) => !p.hidden || this.s.flags.metLouka);
    const row = (label, v, color, title = '') => `<div class="adv-g" title="${esc(title)}"><span>${label}</span><i><b style="width:${(v + 100) / 2}%;background:${color}"></b><em style="left:50%"></em></i><small>${v > 0 ? '+' : ''}${v}</small></div>`;
    return `<div class="adv-rel">${people.map(([k, p]) => row(k === 'coach' ? 'Estime du coach' : esc(p.short), this.s.rel[k] || 0, p.color, p.desc)).join('')}${row('Réputation', this.s.rep || 0, '#f2c94c', 'Fair-play ou tricheur : les gens réagissent selon ta réputation.')}</div>`;
  }

  actions() {
    const A = [], add = (label, run, cls = '') => A.push({ label, run, cls });
    if (!this.slot) {
      for (const k of [1, 2]) {
        const sv = this.read(k);
        add(sv ? `Sauvegarde ${k} · ${esc(sv.name)}<small>${esc(CHAPTERS[chapterOf(sv.step)] || '')}</small>` : `Sauvegarde ${k} · vide<small>Nouvelle aventure</small>`, () => this.open(k), 'choice');
      }
      return A;
    }
    if (!this.s) { add('Commencer une nouvelle aventure', () => this.newGame(), 'primary'); return A; }
    const c = this.ctx, st = this.step;
    if (this.view === 'journal') { add('Retour', () => { this.view = null; this.rerender(); }, 'primary'); return A; }
    if (this.view === 'free' || this.view === 'train' || this.view === 'cards') { this.freeActions(add); return A; }
    if (this.react) {
      const r = this.react;
      if (this.page < r.pages.length - 1) add('Suivant', () => { this.page++; this.rerender(); }, 'primary');
      else add('Continuer', () => { const n = r.next; this.react = null; this.goto(n); }, 'primary');
      return A;
    }
    if (st.type === 'text') {
      const pages = val(st.pages, c);
      if (this.page < pages.length - 1) add('Suivant', () => { this.page++; this.rerender(); }, 'primary');
      else add('Continuer', () => this.goto(val(st.next, c)), 'primary');
    } else if (st.type === 'choice' && st.phone) {
      // choix au téléphone (pas encore sur place) : réponse dans le menu
      for (const op of val(st.options, c)) add(esc(op.label), () => {
        this.apply(val(op.effects, this.ctx), val(op.set, this.ctx), op.rep);
        this.s.log.push({ step: this.s.step, choice: op.label });
        const after = (val(op.after, c) || []).map((L) => ({ who: L.who === 'me' ? this.short : LABEL[L.who] || L.who, text: L.text }));
        if (after.length) { this.react = { pages: after, next: op.next }; this.page = 0; this.sel = 0; this.save(); this.rerender(); } else this.goto(op.next);
      }, 'choice');
    } else if (st.type === 'scene' || st.type === 'choice') {
      add('Reprendre la scène', () => this.play(st), 'primary');
    } else if (st.type === 'drill' || st.type === 'match' || st.type === 'watch') {
      add(`${st.type === 'watch' ? 'Regarder' : 'Jouer'} : ${esc(val(st.label, c))}`, () => this.launch(st), 'primary');
      if (st.type === 'match' && this.freeLeft() > 0) add(`Temps libre<small>${this.freeLeft()} activité${this.freeLeft() > 1 ? 's' : ''} pour ce chapitre · fatigue ${Math.round((this.s.fatigue || 0) * 100)} %</small>`, () => { this.view = 'free'; this.note = null; this.rerender(); }, 'choice');
      add(`Se promener au club<small>marcher, parler à tout le monde</small>`, () => this.roam(), 'choice');
    } else if (st.type === 'end') {
      if (st.next) add(`Continuer : ${esc(CHAPTERS[st.chapter + 1] || 'la suite')}`, () => this.goto(st.next), 'primary');
    }
    add('Journal des relations', () => { this.view = 'journal'; this.rerender(); }, 'small');
    add(`Côté de jeu : ${(this.s.lane || 1) > 0 ? 'droite (drive)' : 'gauche (revers)'}`, () => { this.s.lane = -(this.s.lane || 1); this.save(); this.rerender(); }, 'small');
    add('Changer de sauvegarde', () => { this.slot = null; this.s = null; this.rerender(); }, 'small');
    add('Effacer cette sauvegarde et recommencer', () => { this.s = null; try { localStorage.removeItem(KEY(this.slot)); } catch { /* ignoré */ } this.newGame(); }, 'small');
    return A;
  }

  body() {
    if (!this.slot) { let got = []; try { got = JSON.parse(localStorage.getItem('padel-arena.endings') || '[]'); } catch { /* ignoré */ } return `<p class="adv-text">Une vraie histoire, des choix qui changent l'aventure. Deux sauvegardes possibles.</p><div class="adv-line"><b>Galerie des fins · ${got.length} / ${Object.keys(ENDINGS).length}</b><p>${Object.entries(ENDINGS).map(([k, t]) => (got.includes(k) ? `✔ ${esc(t)}` : '🔒 ???')).join('<br>')}</p></div>`; }
    if (false) return '<p class="adv-text">Une vraie histoire, des choix qui changent l\'aventure, et un joueur qui part de rien. Deux sauvegardes possibles.</p>';
    if (!this.s) return '<p class="adv-text">Tout commence par un coup de fil d\'Eliott…</p>';
    const c = this.ctx;
    if (this.view === 'journal') return this.journal();
    if (this.view === 'free' || this.view === 'train' || this.view === 'cards') {
      const n = this.note;
      return n ? `<div class="adv-line"><b>${esc(n.who)}</b><p>${esc(n.text)}</p>${this.view === 'cards' ? '' : `<small>Temps libre restant : ${this.s.free.left}</small>`}</div>`
        : `<div class="adv-line"><b>Temps libre</b><p>${this.view === 'train' ? 'Qu\'est-ce que tu travailles ?' : `Pendant ce chapitre, tu as du temps pour ${this.s.free.left} activité${this.s.free.left > 1 ? 's' : ''}. S'entraîner fatigue, se reposer récupère, les amis comptent aussi.`}</p></div>`;
    }
    if (this.react) { const p = this.react.pages[this.page]; return `<div class="adv-line"><b>${esc(p.who)}</b><p>${esc(p.text)}</p></div>`; }
    const st = this.step;
    if (st.type === 'text') { const pages = val(st.pages, c), p = pages[this.page]; return `<div class="adv-line"><b>${esc(p.who)}</b><p>${esc(p.text)}</p><small>${this.page + 1} / ${pages.length}</small></div>`; }
    if (st.type === 'choice') return `<div class="adv-line choice"><b>${st.phone ? '📞 ' : ''}${esc(LABEL[val(st.who, c)] || val(st.who, c))}</b><p>${esc(val(st.text, c))}</p></div>`;
    if (st.type === 'scene') return '<div class="adv-line"><b>Cinématique</b><p>La scène va se jouer sur le court.</p></div>';
    if (st.type === 'drill' || st.type === 'match' || st.type === 'watch') return `<div class="adv-line"><b>${st.type === 'watch' ? 'Au bord du court' : 'À toi de jouer'}</b><p>${esc(st.intro || val(st.label, c))}</p></div>`;
    if (st.type === 'end') return `<div class="adv-line end"><b>${st.final ? 'FIN DE L\'AVENTURE' : `FIN DU CHAPITRE ${st.chapter}`}</b><p>${esc(val(st.text, c))}</p>${this.s.lastUnlocks?.length ? `<p><b>Débloqué en exhibition :</b><br>${this.s.lastUnlocks.map((t) => `🔓 ${esc(t)}`).join('<br>')}</p>` : ''}</div>`;
    return '';
  }

  render(el) {
    const A = this.actions();
    this.sel = Math.max(0, Math.min(this.sel, A.length - 1));
    const title = this.s ? CHAPTERS[chapterOf(this.s.step)] : 'Aventure';
    let html = `<div class="m-head"><button class="m-back" data-back>‹</button><span>${esc(title)}</span></div>`;
    if (this.s) html += `<p class="m-lead">${esc(this.s.name)} · sauvegarde ${this.slot}${this.gauges()}</p>`;
    html += this.body();
    html += '<div class="rows adv-actions">';
    A.forEach((a, i) => { html += `<div class="row action adv-${a.cls || 'btn'}${i === this.sel ? ' sel' : ''}" data-i="${i}"><span class="lbl">${a.label}</span><span class="val"></span><span class="go">›</span></div>`; });
    html += '</div><div class="m-foot"><span><kbd data-menu="B">B</kbd> Retour</span><span><kbd data-menu="A">A</kbd> Valider</span></div>';
    el.className = 'm-body m-adventure';
    el.innerHTML = html;
    el.querySelector('[data-back]').addEventListener('click', () => this.goBack());
    el.querySelectorAll('[data-i]').forEach((d) => { const i = +d.dataset.i; d.addEventListener('click', () => { this.sel = i; A[i].run(); }); d.addEventListener('mouseenter', () => { if (this.sel !== i) { this.sel = i; this.rerender(); } }); });
  }

  goBack() { if (this.slot) { this.slot = null; this.s = null; this.rerender(); } else this.back(); }

  update(m) {
    const A = this.actions();
    if (m.up) { this.sel = (this.sel + A.length - 1) % A.length; this.rerender(); }
    if (m.down) { this.sel = (this.sel + 1) % A.length; this.rerender(); }
    if (m.confirm && A[this.sel]) A[this.sel].run();
    else if (m.back) this.goBack();
  }
}
