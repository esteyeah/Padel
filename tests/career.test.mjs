// Tests (Node) de la boucle de carrière : création, tableaux, récompenses, classement, sauvegarde.
import { Career } from '../src/career/Career.js';
import { seedOrder, winProbability, createTournament, reportPlayerResult, playerMatch } from '../src/career/Tournament.js';
import { TOURNAMENTS, rankForPoints, pointsAtRank, rankForOvr } from '../src/career/data/circuit.js';
import { PRO_PAIRS, CELEBRITIES } from '../src/career/data/roster.js';
import { ATTR_IDS } from '../src/career/data/attributes.js';
import { rng } from '../src/entities/Appearance.js';

let fails = 0;
const check = (name, cond, info = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${info}`); if (!cond) fails++; };
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

// --- barème
check('Têtes de série (8)', seedOrder(8).join() === '1,8,4,5,2,7,3,6');
check('Barème rang <-> points', rankForPoints(pointsAtRank(50)) === 50 && rankForPoints(0) === 1400 && rankForPoints(99999) === 1, `rang(1500 pts)=${rankForPoints(1500)}`);
check('Rang selon la note', rankForOvr(98) <= 2 && rankForOvr(33) > 1000, `98→${rankForOvr(98)} 85→${rankForOvr(85)} 70→${rankForOvr(70)} 33→${rankForOvr(33)}`);
check('Probabilité de victoire', Math.abs(winProbability(50, 50) - 0.5) < 1e-9 && winProbability(60, 50) > 0.85);

// --- effectif demandé
const names = [...PRO_PAIRS.flatMap((p) => p.players), ...CELEBRITIES].map((n) => n.name);
const wanted = ['Arturo Coello', 'Agustín Tapia', 'Alejandro Galán', 'Federico Chingotto', 'Philippe Lacheau', 'Samir Nasri', 'Robert Pires', 'Dimitri Payet', 'Steve Mandanda', 'Gerard Piqué', 'Carles Puyol', 'Zinedine Zidane', 'Esteban Ocon', 'Teddy Riner', 'Domingo', 'Lionel Messi', 'Rafael Nadal', 'Hatem Ben Arfa'];
check('Effectif demandé présent', wanted.every((w) => names.includes(w)), wanted.filter((w) => !names.includes(w)).join());
check('Coello gaucher à droite, avec Tapia', PRO_PAIRS[0].players[0].hand === 'L' && PRO_PAIRS[0].players[0].side === 'R' && PRO_PAIRS[0].players[1].name === 'Agustín Tapia');

// --- tableau
{
  const r = rng(42);
  const tpl = TOURNAMENTS.find((t) => t.id === 'major');
  const t = createTournament(tpl, { players: [{ id: 'player', ovr: 90, name: 'X' }, { id: 'p2', ovr: 90, name: 'Y' }], ovr: 90 }, r, 4);
  const ids = t.pairs.flatMap((p) => p.players.map((q) => q.id));
  check('Major : 16 paires sans doublon', t.pairs.length === 16 && new Set(ids).size === ids.length);
  check('Major : les paires n°1 et n°2 sont là', t.pairs.some((p) => p.id === 'coello-tapia') && t.pairs.some((p) => p.id === 'galan-chingotto'));
  let n = 0;
  while (playerMatch(t)) { reportPlayerResult(t, true, '6-4 6-4', r); n++; }
  check('Major : 4 victoires = titre', n === 4 && t.done && t.placing === 0 && t.champion === t.playerIndex);
  const t2 = createTournament(TOURNAMENTS.find((x) => x.id === 'club'), { players: [{ id: 'player', ovr: 30 }, { id: 'p2', ovr: 30 }], ovr: 30 }, r, 1);
  const res = reportPlayerResult(t2, false, '2-4', r);
  check('Défaite au 1er tour : tournoi simulé jusqu\'au bout', res.finished && res.placing === 3 && t2.champion !== null && t2.champion !== t2.playerIndex);
}

// --- carrière complète simulée
function simulate(seed, skillBonus = 0, log = false) {
  const store = memory();
  const c = Career.create({ name: 'Test Joueur', hand: 'L', side: 'R' }, store);
  const r = rng(seed);
  const marks = {};
  let weeks = 0, matches = 0;
  while (weeks < 400 && c.rank > 1) {
    // dépense automatique des points : attribut le plus faible d'abord
    for (;;) { const id = [...ATTR_IDS].sort((a, b) => c.s.attrs[a] - c.s.attrs[b]).find((a) => c.canUpgrade(a)); if (!id) break; c.upgrade(id); }
    const best = c.partnerOptions()[2]; if (best.ovr > c.s.partner.ovr) c.setPartner(best);
    // choisit le tournoi le mieux doté parmi ceux dont le plateau est à sa portée
    const open = c.offers().filter((o) => !o.locked);
    const level = (o) => o.tier.ovr[0] + (o.tier.ovr[1] - o.tier.ovr[0]) * o.tpl.ovrShift;
    const offer = open.filter((o) => level(o) <= c.pairOvr + skillBonus + 2).sort((x, y) => y.tpl.points - x.tpl.points)[0]
      || open.sort((x, y) => level(x) - level(y))[0];
    if (!offer) { c.s.week++; weeks++; continue; }
    c.enter(offer.tpl.id);
    for (;;) {
      const nm = c.nextMatch(); if (!nm) break;
      const won = r() < winProbability(c.pairOvr + skillBonus, nm.opponents.ovr);
      matches++;
      const s = c.reportMatch({ won, score: won ? '6-3' : '3-6' });
      if (s.unlocked && !marks[s.unlocked]) marks[s.unlocked] = { week: c.s.week, matches, ovr: c.ovr };
      if (s.finished) break;
    }
    weeks++;
  }
  if (log) console.log('   ', JSON.stringify(marks), `| semaine ${c.s.week} matchs ${matches} OVR ${c.ovr} niveau ${c.s.level} rang ${c.rank} pts ${c.points} titres ${c.s.stats.titles} gains ${c.s.money} €`);
  return { c, store, marks, matches };
}
{
  const { c, store } = simulate(7, 6, true);
  check('Départ tout en bas puis progression', c.s.stats.titles > 0 && c.ovr > 45, `OVR ${c.ovr}, rang ${c.rank}`);
  const again = Career.load(store);
  check('Sauvegarde / rechargement', again && again.ovr === c.ovr && again.points === c.points && again.s.profile.hand === 'L');
  const table = c.rankingTable();
  check('Classement : joueur présent, rangs croissants', table.some((x) => x.me) && table.every((x, i) => i === 0 || x.rank > table[i - 1].rank));
  const mo = Career.create({ name: 'A B' }, memory());
  mo.enter('quartier');
  const o = mo.matchOptions();
  check('Options de match', o.lineup.near[0].human && o.lineup.near.length === 2 && o.lineup.far.length === 2 && o.matchTiebreak === 10 && o.lineup.far[0].bot.diff.reaction > 0.3);
}
{
  const ladder = Career.namedLadder();
  check('Classement : Tapia n° 1, Coello n° 2, pros en tête', ladder[0].name === 'Agustín Tapia' && ladder[1].name === 'Arturo Coello' && ladder.slice(0, 10).every((n) => n.kind === 'pro'),
    ladder.filter((n) => n.kind === 'celebrity').map((n) => `${n.name} ${n.rank}`).join(', '));
}
{
  // formats, missions, boutique, entraînements
  const c = Career.create({ name: 'Zoé Test' }, memory());
  check('Format amateur par défaut : super tie-break', c.formatFor('amateur') === 'stb');
  c.enter('quartier');
  const o = c.matchOptions();
  check('Match amateur en super tie-break, au tennis municipal', o.matchTiebreak === 10 && o.venue === 'municipal' && !!o.mission && typeof o.mission.metric === 'function', o.mission.text);
  const stats = { winners: { smash: 5, lob: 5, volley: 5, bandeja: 5 }, aces: 5, doubleFaults: 0, netWinners: 9, glassWinners: 9, porTres: 2, wallShots: 3, wallSuccess: 3, outsideReturns: 0, maxRallyWon: 20, pointsWon: 10, pointsLost: 2, won: true, gamesLost: 0, porCuatro: 1, porTresOnly: 1, door: 1, deepLobs: 20, drops: 9, volleysIn: 30, outsideWinners: 2, returnsWon: 20, bestStreak: 10 };
  const sum = c.reportMatch({ won: true, score: '10-4', stats });
  check('Mission réussie récompensée', sum.mission?.done && sum.shop > 0, `${sum.mission?.text} -> ${sum.mission?.reward} ${sum.mission?.amount}, boutique +${sum.shop}`);
  c.setFormat('amateur', 'set4');
  check('Réglage du format', c.formatFor('amateur') === 'set4');
  c.s.shopPts = 700; c.s.money = 5000;
  check('Achat en boutique (matériel en euros, terrains en points)', c.buy('color:gold').ok && c.owns('color:gold') && c.s.money === 1000 && c.s.shopPts === 700 && !c.buy('venue:pro').ok);
  c.s.profile.look.primary = 'gold'; c.s.profile.look.racket = 'gold';
  check('Objet non acheté ignoré', c.lookFor().primary === 'gold' && c.lookFor().racket === 'classic');
  while (c.s.tournament) c.reportMatch({ won: false, score: '2-10' });
  const before = c.s.attrs.smash;
  check('Un entraînement par semaine', c.canTrain());
  const tr = c.reportTraining({ drill: 'smash', score: 13, medal: 3 });
  check('Médaille d\'or : +2 en smash, semaine consommée', c.s.attrs.smash === before + 2 && !c.canTrain() === false && tr.shop === 15, `smash ${before} -> ${c.s.attrs.smash}`);
  check('Pas deux entraînements la même semaine', (() => { c.s.trainedWeek = c.s.week; return c.reportTraining({ drill: 'serve', score: 9, medal: 3 }) === null; })());
  const d = c.drillOptions('coach');
  check('Atelier coach : tie-break 7 en simple', d.matchTiebreak === 7 && d.lineup.far.length === 1 && d.lineup.near[0].human);
}
console.log('   --- rythme (joueur moyen +0, bon +6, excellent +12) :');
for (const bonus of [0, 6, 12]) simulate(100 + bonus, bonus, true);
process.exit(fails ? 1 : 0);
