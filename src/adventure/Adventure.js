// ============================================================================
//  Mode Aventure : deux emplacements de sauvegarde, déroulé des étapes,
//  écrans (dans le menu principal), cinématiques et matchs dans le jeu.
// ============================================================================
import { STEPS, PEOPLE, START_REL, CHAPTERS, chapterOf } from './Story.js';
import { CELEBRITIES, COACH, genericNpc } from '../career/data/roster.js';
import { npcSpec, drillCutscene } from '../career/Career.js';
import { resolveLook, DEFAULT_LOOK } from '../entities/Appearance.js';
import { flatStats } from '../config.js';
import { ask } from '../ui/Ask.js';

const KEY = (slot) => `padel-arena.adventure.${slot}`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const celeb = (id) => CELEBRITIES.find((c) => c.id === id);
const NPC_ID = { eliott: 'eliott-hanras', jean: 'jean-deuxbe', raf: 'rafael-tomatis', camille: 'camille-roy', timeo: 'timeo-boulhol', mayor: 'le-maire-de-ceyreste' };
const LABEL = { eliott: 'Eliott', jean: 'Jean', raf: 'Raf', coach: 'Coach Roméo', camille: 'Camille', timeo: 'Timéo', mayor: 'Le maire', narr: 'Narrateur' };
const val = (v, c) => (typeof v === 'function' ? v(c) : v);

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
    this.slot = slot; this.s = this.read(slot); this.page = 0; this.sel = 0; this.react = null;
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
    const partner = this.s?.flags.partner || 'eliott';
    return { s: this.s, partner, friends: ['eliott', 'jean', 'raf'].filter((x) => x !== partner) };
  }
  get step() { return this.s ? STEPS[this.s.step] : null; }
  get short() { return (this.s?.name || 'Toi').split(' ')[0]; }

  apply(effects = {}, set = {}, rep = 0) {
    for (const [k, v] of Object.entries(effects || {})) this.s.rel[k] = Math.max(-100, Math.min(100, (this.s.rel[k] || 0) + v));
    Object.assign(this.s.flags, set || {});
    this.s.rep = Math.max(-100, Math.min(100, (this.s.rep || 0) + (rep || 0)));
  }

  goto(id, autoplay = true) {
    this.s.step = id; this.page = 0; this.sel = 0; this.react = null;
    let st = STEPS[id];
    while (st?.type === 'branch') { id = st.to(this.ctx); this.s.step = id; st = STEPS[id]; }
    if (st?.effects && st.type !== 'choice') this.apply(val(st.effects, this.ctx));
    if (st?.set && st.type === 'scene') this.apply({}, st.set);
    this.save();
    // les cinématiques s'enchaînent directement dans le jeu
    if (autoplay && st?.type === 'scene') { this.play(st); return; }
    this.rerender();
  }

  // ------------------------------------------------------------------ personnages
  me(lane = 0) {
    const look = this.getLook?.() || DEFAULT_LOOK;
    const print = (this.s.name.split(' ').pop() || 'JOUEUR').toUpperCase().slice(0, 12);
    return { name: this.short.toUpperCase(), human: true, hand: 1, lane, stats: { ...this.s.stats }, appearance: { ...resolveLook(look), name: print } };
  }
  spec(id, kit, lane, o = {}) {
    if (id === 'me') return this.me(lane);
    if (id === 'coach') return npcSpec({ ...COACH, ovr: 55, attrs: { drive: 55, lob: 55, smash: 55, speed: 55, stamina: 55, strength: 55 } }, 'black', lane, o.idle);
    if (id === 'random') { const n = genericNpc(Math.random, o.ovr || 30); return npcSpec(n, kit, lane); }
    return npcSpec(celeb(NPC_ID[id]), kit, lane, o.idle);
  }

  // ------------------------------------------------------------------ cinématique en jeu
  play(st) {
    const c = this.ctx;
    const cast = val(st.cast, c);
    const lines = val(st.lines, c);
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
    const conv = lines.map((L) => {
      const label = L.who === 'me' ? this.short : LABEL[L.who] || L.who;
      if (L.who === 'me') return { side: 1, label, text: L.text };
      if (L.who === other) return { name: otherSpec.name, label, text: L.text };
      if (extras.includes(L.who)) return { actor: L.who, label, text: L.text };
      return { side: 1, label, text: L.text };
    });
    this.startGame({
      mode: 'career', sceneOnly: true, format: '1v1', sets: 1, matchTiebreak: 7, venue: st.venue || 'municipal', ambiance: st.ambiance || 'day',
      lineup: { near: [{ ...meSpec, lane: 0 }], far: [{ ...otherSpec, lane: 0 }] }, cutscene: conv, actors, party: false,
      onSceneEnd: () => { this.goto(val(st.next, c), true); if (STEPS[this.s.step]?.type !== 'scene') this.show(); },
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
    const lanesN = doubles ? [1, -1] : [0], lanesF = doubles ? [1, -1] : [0];
    const mk = (id, i, kit, side) => {
      let sp = this.spec(id, kit, side > 0 ? lanesN[i] : lanesF[i], { ovr: st.randomOvr });
      if (st.weak?.includes(id)) sp = { ...sp, stats: flatStats(0.12), bot: { ...sp.bot, diff: { ...sp.bot.diff, level: 0.1, speedMul: 0.72, reaction: 0.5, planError: 0.6, margin: 1.2 } } };
      // demi-finale relevée ; raquettes sabotées par Raf : adversaires diminués
      if (side < 0 && st.hard) sp = { ...sp, bot: { ...sp.bot, diff: { ...sp.bot.diff, level: Math.min(0.95, (sp.bot.diff.level || 0.5) + 0.2), reaction: Math.max(0.1, (sp.bot.diff.reaction || 0.25) - 0.06) } } };
      if (side < 0 && this.s.flags.sabotage && st.hard) sp = { ...sp, stats: Object.fromEntries(Object.entries(sp.stats).map(([k, v]) => [k, typeof v === 'number' && k !== 'power' ? v * 0.8 : v])) };
      return sp;
    };
    const lineup = { near: near.map((id, i) => mk(id, i, 'blue', 1)), far: far.map((id, i) => mk(id, i, 'red', -1)) };
    if (st.type === 'watch') {
      lineup.near = lineup.near.map((p) => ({ ...p, human: false }));
      this.startGame({ mode: 'demo', format: '2v2', sets: 1, matchTiebreak: 10, venue: 'ceyreste', ambiance: 'day', title: st.title || 'MATCH', subtitle: 'Vous regardez depuis le bord du court · A pour passer', lineup, watchFor: 28, replays: false, party: false, onEnd: back });
      return;
    }
    this.startGame({
      mode: 'career', format: st.format, sets: 1, gamesPerSet: 6, golden: true, matchTiebreak: st.mt || 10, venue: st.venue, ambiance: st.ambiance,
      title: st.title || val(st.label, c).toUpperCase(), subtitle: st.venue === 'ceyreste' ? 'Tournoi de Ceyreste' : 'Entraînement', replays: false,
      rig: st.rig === 'lose', rigWin: st.rig === 'win', lineup, party: false, onEnd: back, onQuit: () => this.show(),
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
      if (st.set) this.apply({}, st.set);
    }
    const next = st.type === 'drill' || st.type === 'watch' ? st.next : (result.won ? st.win : st.lose);
    this.goto(next, true);
    if (STEPS[this.s.step]?.type !== 'scene') this.show();
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
    } else if (st.type === 'scene') {
      add('Voir la scène', () => this.play(st), 'primary');
    } else if (st.type === 'choice') {
      for (const op of st.options) add(esc(op.label) + (op.sub ? `<small>${esc(op.sub)}</small>` : ''), () => {
        this.apply(op.effects, op.set, op.rep);
        this.s.log.push({ step: this.s.step, choice: op.label });
        const after = val(op.after, c);
        if (after?.length) { this.react = { pages: after, next: op.next }; this.page = 0; this.sel = 0; this.save(); this.rerender(); } else this.goto(op.next);
      }, 'choice');
    } else if (st.type === 'drill' || st.type === 'match' || st.type === 'watch') {
      add(`${st.type === 'watch' ? 'Regarder' : 'Jouer'} : ${esc(val(st.label, c))}`, () => this.launch(st), 'primary');
    } else if (st.type === 'end') {
      if (st.next) add(`Continuer : ${esc(CHAPTERS[st.chapter + 1])}`, () => this.goto(st.next), 'primary');
    }
    add('Changer de sauvegarde', () => { this.slot = null; this.s = null; this.rerender(); }, 'small');
    add('Effacer cette sauvegarde et recommencer', () => { this.s = null; try { localStorage.removeItem(KEY(this.slot)); } catch { /* ignoré */ } this.newGame(); }, 'small');
    return A;
  }

  body() {
    if (!this.slot) return '<p class="adv-text">Une vraie histoire, des choix qui changent l\'aventure, et un joueur qui part de rien. Deux sauvegardes possibles.</p>';
    if (!this.s) return '<p class="adv-text">Tout commence par un coup de fil d\'Eliott…</p>';
    const c = this.ctx;
    if (this.react) { const p = this.react.pages[this.page]; return `<div class="adv-line"><b>${esc(p.who)}</b><p>${esc(p.text)}</p></div>`; }
    const st = this.step;
    if (st.type === 'text') { const pages = val(st.pages, c), p = pages[this.page]; return `<div class="adv-line"><b>${esc(p.who)}</b><p>${esc(p.text)}</p><small>${this.page + 1} / ${pages.length}</small></div>`; }
    if (st.type === 'choice') return `<div class="adv-line choice"><b>${esc(st.who)}</b><p>${esc(val(st.text, c))}</p></div>`;
    if (st.type === 'scene') return '<div class="adv-line"><b>Cinématique</b><p>La scène va se jouer sur le court.</p></div>';
    if (st.type === 'drill' || st.type === 'match' || st.type === 'watch') return `<div class="adv-line"><b>${st.type === 'watch' ? 'Au bord du court' : 'À toi de jouer'}</b><p>${esc(st.intro || val(st.label, c))}</p></div>`;
    if (st.type === 'end') return `<div class="adv-line end"><b>FIN DU ${st.chapter === 1 ? 'CHAPITRE 1' : 'CHAPITRE 2'}</b><p>${esc(val(st.text, c))}</p></div>`;
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
