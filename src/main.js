// ============================================================================
//  Point d'entrée : crée le rendu, les entrées, le son, le HUD, le menu et le
//  jeu, puis lance la boucle requestAnimationFrame.
//  Paramètres d'URL utiles : ?demo (bot vs bot direct) · ?quality=low · ?play
// ============================================================================
import { Renderer3D } from './render/Renderer3D.js';
import { InputManager } from './input/InputManager.js';
import { HUD } from './ui/HUD.js';
import { Menu } from './ui/Menu.js';
import { CareerUI } from './ui/CareerUI.js';
import { Career } from './career/Career.js';
import { TEST_UNLOCK_ALL_VENUES, SHOP_ITEMS, isUnlocked, tryUnlockCode, advUnlocks } from './career/data/shop.js';
import { VENUES } from './render/Venues.js';
import { bagById } from './entities/Appearance.js';
import { Sfx } from './audio/Sfx.js';
import { Game } from './core/Game.js';
import { COACH } from './career/data/roster.js';
import { npcSpec, drillCutscene } from './career/Career.js';
import { findCharacter } from './career/Characters.js';
import { toStats } from './career/data/attributes.js';
import { resolveLook, DEFAULT_LOOK } from './entities/Appearance.js';
import { flatStats } from './config.js';

import { loadRocks } from './render/Rocks.js';
import { OnlineUI } from './net/Online.js';
import { askPad } from './ui/Ask.js';
import { AdventureUI } from './adventure/Adventure.js';

const params = new URLSearchParams(location.search);
await loadRocks();
const canvas = document.getElementById('game');

let r3d;
try {
  r3d = new Renderer3D(canvas, { quality: params.get('quality') || 'high' });
} catch (err) {
  document.getElementById('fatal').classList.remove('hidden');
  throw err;
}
const input = new InputManager();
const sfx = new Sfx();
const hud = new HUD(input);
const game = new Game({ r3d, input, hud, sfx });
const menu = new Menu({
  input,
  onStart: (opts) => {
    sfx.musicEnabled = opts.music !== 'off';
    if (opts.venue === 'myclub') opts.club = Career.load(storage)?.s.club || null;
    sfx.unlock();
    r3d.setQuality(opts.quality);
    // exhibition : apparence, main et sac du joueur de carrière s'il existe
    const c = Career.load(storage);
    if (c && opts.mode === 'quick' && opts.character === 'career') {
      const look = c.lookFor();
      Object.assign(opts, { playerLook: look, playerName: c.playerNpc().short, playerHand: c.s.profile.hand === 'L' ? -1 : 1, playerStats: toStats(c.statsWithGear()), bag: bagById(look.bag) });
    } else if (opts.mode === 'quick' && opts.character && opts.character !== 'standard') {
      const ch = findCharacter(opts.character);
      if (ch) {
        const sp = npcSpec(ch.npc, 'blue', 0);
        Object.assign(opts, { playerAppearance: sp.appearance, playerName: ch.npc.short, playerHand: sp.hand, playerStats: sp.stats });
      }
    }
    // partenaire / adversaires choisis en exhibition
    if (opts.mode === 'quick') {
      const pk = (id, kit, lane) => { const ch = id && id !== 'bot' && findCharacter(id); return ch ? npcSpec(ch.npc, kit, lane) : null; };
      opts.pick = { mate: pk(opts.mate, 'blue', 1), opps: [pk(opts.opp1, 'red', 1), pk(opts.opp2, 'red', -1)] };
    }
    game.start(opts);
  },
  onAmbiance: (a) => r3d.arena.setAmbiance(a),
  onVenue: (v, court, amb) => { if (game.attract || game.state === 'showcase') { game.cameraRig.indoor = !!VENUES[v]?.indoor; r3d.arena.setVenue(v, court, v === 'myclub' ? Career.load(storage)?.s.club : null); r3d.arena.setAmbiance(amb); } },
  onCareer: () => career.open(),
  onCareerScreen: (sc) => career.openAt(sc),
  hasCareer: () => !!Career.load(storage),
  getCareer: () => Career.load(storage),
  onPreview: (id) => {
    if (!id) { game.setShowcase(null); return; }
    const c = Career.load(storage);
    let app;
    if (id === 'career' && c) app = { ...resolveLook(c.lookFor()), name: c.playerNpc().short };
    else if (id === 'standard') app = { ...resolveLook(DEFAULT_LOOK), name: 'JOUEUR' };
    else { const ch = findCharacter(id); if (ch) { const sp = npcSpec(ch.npc, 'blue', 0); app = { ...sp.appearance, hand: sp.hand }; } }
    if (app) game.setShowcase(app);
  },
  onTraining: (id) => {
    sfx.unlock();
    const c = Career.load(storage);
    const opts = c ? c.drillOptions(id) : {
      mode: 'drill', drill: id, format: '1v1', sets: 1, gamesPerSet: 6, golden: true, matchTiebreak: id === 'coach' ? 7 : 0,
      firstServer: 1, venue: 'municipal', ambiance: 'day', cutscene: drillCutscene(id, 'VOUS'),
      lineup: {
        near: [{ name: 'VOUS', human: true, hand: 1, lane: 0, stats: flatStats(0.6), appearance: { ...resolveLook(DEFAULT_LOOK), name: 'JOUEUR' } }],
        far: [npcSpec({ ...COACH, ovr: 60, attrs: { drive: 60, lob: 60, smash: 60, speed: 60, stamina: 60, strength: 60 } }, 'black', 0, !['coach', 'precision'].includes(id))],
      },
    };
    game.start({ ...opts, onEnd: () => menu.show() });
  },
});
// ------------------------------------------------------------------ en ligne
/** Apparence, main et attributs du personnage choisi en exhibition (envoyés aux autres joueurs). */
function onlineProfile() {
  const c = Career.load(storage);
  const ch = menu.currentChar();
  if (ch === 'career' && c) {
    const look = c.lookFor();
    return { name: c.playerNpc().short, app: { ...resolveLook(look) }, hand: c.s.profile.hand === 'L' ? -1 : 1, stats: toStats(c.statsWithGear()) };
  }
  const fc = ch !== 'standard' && findCharacter(ch);
  if (fc) { const sp = npcSpec(fc.npc, 'blue', 0); return { name: fc.npc.short, app: sp.appearance, hand: sp.hand, stats: sp.stats }; }
  return { name: '', app: { ...resolveLook(DEFAULT_LOOK) }, hand: 1, stats: flatStats(0.62) };
}
const online = new OnlineUI({
  getProfile: onlineProfile,
  getSettings: () => { const v = menu.values(); return { venue: v.venue === 'myclub' ? 'club' : v.venue, court: v.court, format: v.format, sets: v.sets, stb: !!v.matchTiebreak, golden: v.golden, difficulty: v.difficulty, ambiance: v.ambiance }; },
  startMatch: (opts) => { menu.hide(); sfx.musicEnabled = menu.values().music !== 'off'; sfx.unlock(); r3d.setQuality(menu.values().quality); game.start(opts); },
  back: () => menu.open('home'),
  rerender: () => { if (menu.visible && menu.cur === 'online') menu.render(); },
  show: () => { menu.show(); menu.open('online'); },
  partyFlags: () => game.partyFlags,
  abortMatch: (msg) => { hud.banner('MATCH INTERROMPU', msg || '', 2.5); setTimeout(() => { if (game.opts?.net) game.leaveOnline(); }, 2500); },
});
menu.online = online;
menu.adventure = new AdventureUI({
  startGame: (opts) => { menu.hide(); sfx.musicEnabled = menu.values().music !== 'off'; sfx.unlock(); r3d.setQuality(menu.values().quality); game.start(opts); },
  back: () => menu.open('home'),
  rerender: () => { if (menu.visible && menu.cur === 'adventure') menu.render(); },
  show: () => { menu.show(); menu.open('adventure'); },
  getLook: () => { const c = Career.load(storage); return c ? c.lookFor() : null; },
  // argent gagné dans l'Aventure (Hanouna) : crédité sur la carrière pour la boutique
  onMoney: (v) => { const c = Career.load(storage); if (c) { c.s.money += v; c.save(); } else { try { localStorage.setItem('padel-arena.pendingMoney', String((+localStorage.getItem('padel-arena.pendingMoney') || 0) + v)); } catch { /* ignoré */ } } },
});
menu.onCode = (code) => { const ok = tryUnlockCode(code); if (ok) refreshVenues(); return ok; };

let storage = null;
try { storage = window.localStorage; storage.getItem('padel-arena.career'); } catch { storage = null; }
const career = new CareerUI({ input, game, r3d, sfx, storage, onExit: () => { refreshVenues(); menu.show(); } });
function refreshVenues() {
  const c = Career.load(storage);
  const owned = (c ? c.ownedVenues() : (TEST_UNLOCK_ALL_VENUES || isUnlocked()) ? Object.keys(VENUES) : ['club', 'municipal', ...advUnlocks().filter((x) => x.startsWith('venue:')).map((x) => x.slice(6))]).filter((v) => v !== 'myclub');
  if (c?.s.club) owned.push('myclub');
  const nm = (v) => (v === 'myclub' ? c.s.club.name : VENUES[v].label);
  const price = (v) => SHOP_ITEMS.find((i) => i.id === `venue:${v}`)?.price;
  const all = Object.keys(VENUES).filter((v) => v !== 'myclub' || owned.includes(v))
    .map((v) => ({ id: v, name: nm(v), owned: owned.includes(v), price: price(v), cat: v === 'myclub' ? 'Mon club' : VENUES[v].indoor ? 'Salles' : ['national', 'pro'].includes(v) ? 'Stades' : 'Clubs et plein air' }))
    .sort((a, b) => ['Clubs et plein air', 'Salles', 'Stades', 'Mon club'].indexOf(a.cat) - ['Clubs et plein air', 'Salles', 'Stades', 'Mon club'].indexOf(b.cat));
  menu.setVenues(Object.keys(VENUES).filter((v) => owned.includes(v)).map((v) => [v, nm(v)]), all);
}
refreshVenues();
game.onExit = () => menu.show();

// fond animé du menu : match de démonstration (2 contre 2)
r3d.arena.setAmbiance(params.get('ambiance') || 'sunset');
game.start({ attract: true, difficulty: 'hard' });

// le son ne peut démarrer qu'après une interaction utilisateur
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => sfx.unlock(), { once: false, passive: true });
addEventListener('pointerdown', () => { try { window.focus(); } catch { /* ignoré */ } }, { passive: true });

if (params.get('ambiance') === 'day') r3d.arena.setAmbiance('day');
if (params.has('demo')) menu.start({ mode: 'demo' });
else if (params.has('play')) menu.start();
else if (params.has('career')) { menu.hide(); career.open(); }

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // une erreur dans une image ne doit jamais arrêter la boucle (sinon plus rien ne répond)
  try { frame(dt); } catch (err) { console.error(err); }
}
function frame(dt) {
  input.poll();
  if (askPad(input)) { hud.updatePad(); r3d.render(dt); return; }
  if (career.visible) career.update();
  else if (menu.visible) {
    menu.update();
    if (input.menu.confirm) sfx.unlock();
  }
  game.frame(dt);
  hud.updatePad();
  r3d.render(dt);
}
requestAnimationFrame(loop);

window.__padel = { game, menu, r3d, input, career }; // accès debug depuis la console
