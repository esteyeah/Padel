// ============================================================================
//  Mode Aventure : sauvegarde, déroulé des étapes, écrans (dans le menu
//  principal) et lancement des exercices / matchs dans le jeu.
// ============================================================================
import { CHAPTER1, PEOPLE, START_REL } from './Story.js';
import { CELEBRITIES, COACH } from '../career/data/roster.js';
import { npcSpec, drillCutscene } from '../career/Career.js';
import { resolveLook, DEFAULT_LOOK } from '../entities/Appearance.js';
import { flatStats } from '../config.js';
import { ask } from '../ui/Ask.js';

const KEY = 'padel-arena.adventure';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const npc = (id) => CELEBRITIES.find((c) => c.id === id);

export class AdventureUI {
  /** o : { startGame(opts), back(), rerender(), show(), getLook() } */
  constructor(o) {
    Object.assign(this, o);
    this.s = this.load();
    this.page = 0;
    this.sel = 0;
  }

  // ------------------------------------------------------------------ sauvegarde
  load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch { /* ignoré */ } }

  async newGame() {
    const name = await ask('Ton prénom et ton nom', '', { max: 22, placeholder: 'Ex. : Alex Martin' });
    if (!name || !name.trim()) return;
    this.s = { v: 1, name: name.trim(), chapter: 1, step: 'start', rel: { ...START_REL }, flags: {}, stats: flatStats(0.3), last: null, log: [] };
    this.page = 0; this.sel = 0;
    this.save();
    this.rerender();
  }

  get step() { return this.s ? CHAPTER1.steps[this.s.step] : null; }
  get short() { return (this.s?.name || 'Toi').split(' ')[0]; }

  apply(effects = {}, set = {}) {
    for (const [k, v] of Object.entries(effects)) this.s.rel[k] = Math.max(-100, Math.min(100, (this.s.rel[k] || 0) + v));
    Object.assign(this.s.flags, set);
  }

  goto(id) {
    this.s.step = id; this.page = 0; this.sel = 0;
    const st = CHAPTER1.steps[id];
    if (st?.type === 'result') return this.goto(this.s.last?.won ? st.win : st.lose);
    if (st?.type === 'text' && st.effects) this.apply(st.effects);
    this.save();
    this.rerender();
  }

  // ------------------------------------------------------------------ joueurs et matchs
  me(lane = 0) {
    const look = this.getLook?.() || DEFAULT_LOOK;
    const print = (this.s.name.split(' ').pop() || 'JOUEUR').toUpperCase().slice(0, 12);
    return { name: this.short.toUpperCase(), human: true, hand: 1, lane, stats: { ...this.s.stats }, appearance: { ...resolveLook(look), name: print } };
  }

  launch(st) {
    const back = (result) => { this.afterGame(st, result); };
    if (st.type === 'drill') {
      const coach = npcSpec({ ...COACH, ovr: 55, attrs: { drive: 55, lob: 55, smash: 55, speed: 55, stamina: 55, strength: 55 } }, 'black', 0, true);
      const cut = drillCutscene(st.drill, this.short.toUpperCase());
      if (cut?.[0]) cut[0].text = st.intro || cut[0].text;
      this.startGame({
        mode: 'drill', drill: st.drill, format: '1v1', sets: 1, gamesPerSet: 6, golden: true, matchTiebreak: 0, firstServer: 1,
        venue: 'municipal', ambiance: 'sunset', cutscene: cut, lineup: { near: [this.me(0)], far: [coach] },
        onEnd: back, onQuit: () => this.show(),
      });
      return;
    }
    const jean = npcSpec(npc('jean-deuxbe'), 'red', 0), raf = npcSpec(npc('rafael-tomatis'), 'red', 1), eli = npcSpec(npc('eliott-hanras'), 'blue', -1);
    if (st.id === 'm1') {
      this.startGame({
        mode: 'career', format: '1v1', sets: 1, gamesPerSet: 6, golden: true, matchTiebreak: 7, venue: 'municipal', ambiance: 'sunset',
        title: 'TIE-BREAK', subtitle: 'Entraînement', replays: false, lineup: { near: [this.me(0)], far: [{ ...jean, lane: 0 }] },
        onEnd: back, onQuit: () => this.show(),
      });
    } else if (st.id === 'm2') {
      // Eliott est dans un très mauvais soir, et le match est truqué : impossible de gagner
      const weak = { ...eli, stats: flatStats(0.12), bot: { ...eli.bot, diff: { ...eli.bot.diff, level: 0.1, speedMul: 0.72, reaction: 0.5, planError: 0.6, margin: 1.2 } } };
      this.startGame({
        mode: 'career', format: '2v2', sets: 1, gamesPerSet: 6, golden: true, matchTiebreak: 10, venue: 'municipal', ambiance: 'night',
        title: 'SUPER TIE-BREAK', subtitle: 'Fin d\'entraînement', replays: false, rig: true,
        endCutscene: () => [
          { name: raf.name, label: 'Raf', text: 'HAHA ! Trop facile ! Le débutant et le troubadour, quelle équipe !' },
          { name: eli.name, label: 'Eliott', text: 'J\'ai… j\'ai pas d\'excuse. Enfin si : mon dos.' },
          { name: jean.name, label: 'Jean', text: 'Franchement, pour une première fois, tu t\'es bien battu. Bravo.' },
        ],
        lineup: { near: [this.me(1), weak], far: [{ ...raf, lane: 1 }, { ...jean, lane: -1 }] },
        onEnd: back, onQuit: () => this.show(),
      });
    }
  }

  afterGame(st, result) {
    if (!result || result.quit) { this.show(); return; }
    this.s.last = { won: !!result.won, medal: result.medal ?? null };
    // progression : chaque exercice / match fait un peu progresser le joueur
    const gain = st.type === 'drill' ? 0.025 + 0.01 * (result.medal || 0) : 0.02;
    const attr = st.type === 'drill' ? ({ serve: 'drive', lob: 'lob' }[st.drill] || 'drive') : 'speed';
    this.s.stats[attr] = Math.min(0.95, (this.s.stats[attr] || 0.3) + gain);
    this.s.stats.stamina = Math.min(0.95, (this.s.stats.stamina || 0.3) + 0.008);
    this.goto(st.next);
    this.show();
  }

  // ------------------------------------------------------------------ rendu
  gauges() {
    if (!this.s) return '';
    return `<div class="adv-rel">${Object.entries(PEOPLE).filter(([k, p]) => !p.hidden || this.s.flags.met?.[k]).map(([k, p]) => {
      const v = this.s.rel[k] || 0, pct = (v + 100) / 2;
      return `<div class="adv-g" title="${esc(p.desc)}"><span>${k === 'coach' ? 'Estime du coach' : esc(p.short)}</span><i><b style="width:${pct}%;background:${p.color}"></b><em style="left:50%"></em></i><small>${v > 0 ? '+' : ''}${v}</small></div>`;
    }).join('')}</div>`;
  }

  actions() {
    const A = [], add = (label, run, cls = '') => A.push({ label, run, cls });
    if (!this.s) {
      add('Nouvelle aventure', () => this.newGame(), 'primary');
      return A;
    }
    const st = this.step;
    if (!st) { add('Recommencer l\'aventure', () => { this.s = null; this.save(); this.newGame(); }, 'primary'); return A; }
    if (st.type === 'text') {
      if (this.page < st.pages.length - 1) add('Suivant', () => { this.page++; this.rerender(); }, 'primary');
      else add('Continuer', () => this.goto(st.next), 'primary');
    } else if (st.type === 'choice') {
      for (const op of st.options) add(op.label + (op.sub ? `<small>${esc(op.sub)}</small>` : ''), () => { this.apply(op.effects, op.set); this.s.log.push({ step: this.s.step, choice: op.label }); this.goto(op.next); }, 'choice');
    } else if (st.type === 'drill' || st.type === 'match') {
      add(`Jouer : ${esc(st.label)}`, () => this.launch(st), 'primary');
    } else if (st.type === 'end') {
      add('Revoir le chapitre depuis le début', () => { const name = this.s.name; this.s = { v: 1, name, chapter: 1, step: 'start', rel: { ...START_REL }, flags: {}, stats: flatStats(0.3), last: null, log: [] }; this.save(); this.rerender(); });
    }
    if (this.s) add('Nouvelle aventure (efface la partie)', async () => { this.newGame(); }, 'small');
    return A;
  }

  body() {
    if (!this.s) return '<p class="adv-text">Une vraie histoire, des choix qui changent l\'aventure, et un joueur qui part de rien. Tout commence par un coup de fil d\'Eliott…</p>';
    const st = this.step;
    if (!st) return '';
    if (st.type === 'text') {
      const p = st.pages[this.page];
      return `<div class="adv-line"><b>${esc(p.who)}</b><p>${esc(p.text)}</p><small>${this.page + 1} / ${st.pages.length}</small></div>`;
    }
    if (st.type === 'choice') return `<div class="adv-line choice"><b>${esc(st.who)}</b><p>${esc(st.text)}</p></div>`;
    if (st.type === 'drill' || st.type === 'match') return `<div class="adv-line"><b>Coach Rémi</b><p>${esc(st.intro || st.label)}</p></div>`;
    if (st.type === 'end') {
      const pn = PEOPLE[this.s.flags.partner]?.short || '?';
      return `<div class="adv-line end"><b>FIN DU CHAPITRE 1</b><p>Ton partenaire pour le tournoi de Ceyreste : <b>${esc(pn)}</b>. Le chapitre 2, « Le tournoi de Ceyreste », arrive bientôt : tes choix et tes relations seront conservés.</p></div>`;
    }
    return '';
  }

  render(el) {
    const A = this.actions();
    this.sel = Math.max(0, Math.min(this.sel, A.length - 1));
    let html = `<div class="m-head"><button class="m-back" data-back>‹</button><span>${this.s ? esc(CHAPTER1.title) : 'Aventure'}</span></div>`;
    if (this.s) html += `<p class="m-lead">${esc(this.s.name)} · ${this.gauges()}</p>`;
    html += this.body();
    html += '<div class="rows adv-actions">';
    A.forEach((a, i) => { html += `<div class="row action adv-${a.cls || 'btn'}${i === this.sel ? ' sel' : ''}" data-i="${i}"><span class="lbl">${a.label}</span><span class="val"></span><span class="go">›</span></div>`; });
    html += '</div><div class="m-foot"><span><kbd data-menu="B">B</kbd> Retour</span><span><kbd data-menu="A">A</kbd> Valider</span></div>';
    el.className = 'm-body m-adventure';
    el.innerHTML = html;
    el.querySelector('[data-back]').addEventListener('click', () => this.back());
    el.querySelectorAll('[data-i]').forEach((d) => { const i = +d.dataset.i; d.addEventListener('click', () => { this.sel = i; A[i].run(); }); d.addEventListener('mouseenter', () => { if (this.sel !== i) { this.sel = i; this.rerender(); } }); });
  }

  update(m) {
    const A = this.actions();
    if (m.up) { this.sel = (this.sel + A.length - 1) % A.length; this.rerender(); }
    if (m.down) { this.sel = (this.sel + 1) % A.length; this.rerender(); }
    if (m.confirm && A[this.sel]) A[this.sel].run();
    else if (m.back) this.back();
  }
}
