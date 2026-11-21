// ============================================================================
//  Tournoi à élimination directe : composition du plateau (paires pros,
//  célébrités, paires fictives selon le palier), têtes de série, simulation
//  des matchs sans le joueur, avancement du tableau.
//  Un tournoi est un objet simple, sérialisable tel quel dans la sauvegarde.
// ============================================================================
import { TIERS, tierById, ROUND_NAMES, MATCH_FORMATS } from './data/circuit.js';
import { PRO_PAIRS, grownCelebs, genericNpc, pairOvr } from './data/roster.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = (arr, rand) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

/** Ordre de placement des têtes de série : 1 et 2 dans des moitiés opposées. */
export function seedOrder(n) {
  if (n === 1) return [1];
  return seedOrder(n / 2).flatMap((s) => [s, n + 1 - s]);
}

/** Probabilité que la paire de note a batte la paire de note b. */
export const winProbability = (a, b) => 1 / (1 + 10 ** ((b - a) / 10));

function randomScore(rand, sets, gamesPerSet, tiebreak = 0) {
  if (tiebreak) return `${tiebreak + (rand() < 0.25 ? 2 : 0)}-${Math.floor(rand() * (tiebreak - 1))}`;
  const N = gamesPerSet;
  const one = () => {
    const r = rand();
    const loser = r < 0.15 ? N : Math.floor(rand() * (N - 1));
    return loser === N ? `${N + 1}-${N}` : `${N}-${loser}`;
  };
  if (sets < 3) return one();
  return rand() < 0.6 ? `${one()} ${one()}` : `${one()} ${one().split('-').reverse().join('-')} ${one()}`;
}

/** Compose les paires adverses d'un tournoi. */
function buildField(tpl, count, rand, reserved = []) {
  const tier = tierById(tpl.tier);
  const [lo, hi] = tier.ovr;
  const center = lo + (hi - lo) * tpl.ovrShift;
  const spread = (hi - lo) * 0.28;
  const sample = () => clamp(center + (rand() + rand() - 1) * spread, lo, hi);
  const pairs = [];
  // un même nom de famille n'apparaît qu'une fois par tableau (affichage sans ambiguïté)
  const taken = new Set(reserved);
  const fresh = (ovr) => {
    for (let i = 0; i < 40; i++) {
      const n = genericNpc(rand, ovr);
      if (!taken.has(n.short)) { taken.add(n.short); return n; }
    }
    return genericNpc(rand, ovr);
  };

  // paires professionnelles (circuit mondial)
  if (tpl.tier === 'pro') {
    let pros = [...PRO_PAIRS];
    if (tpl.ovrShift < 0.3) pros = pros.slice(3);                       // les meilleures paires ne jouent pas les Challengers
    else if (tpl.ovrShift < 0.8) pros = pros.filter(() => rand() < 0.8); // quelques forfaits sur les Opens
    for (const p of pros) {
      if (pairs.length >= count - (tpl.ovrShift < 0.8 ? 2 : 0)) break;
      pairs.push({ id: p.id, players: p.players });
    }
  }

  // célébrités du palier, associées entre elles ou à un joueur fictif de niveau proche
  const CELEBRITIES = grownCelebs();
  const pool = shuffle(CELEBRITIES.filter((c) => c.tiers.includes(tpl.tier) && c.ovr >= lo - 8 && c.ovr <= hi + 6), rand)
    .filter(() => rand() < 0.65)
    .slice(0, Math.max(1, Math.floor(count / 3)));
  // les habitués (Raf Tomatis…) s'inscrivent à tous les tournois de leur palier
  for (const c of CELEBRITIES) if (c.regular && c.tiers.includes(tpl.tier) && !pool.includes(c)) pool.unshift(c);
  // un duo habituel (ex. Domingo et Xari) s'inscrit ensemble
  for (const c of [...pool]) {
    if (!c.pairWith || !pool.includes(c)) continue;
    const mate = CELEBRITIES.find((x) => x.id === c.pairWith);
    if (!mate || pairs.length >= count) continue;
    pool.splice(pool.indexOf(c), 1);
    if (pool.includes(mate)) pool.splice(pool.indexOf(mate), 1);
    pairs.push({ id: `${c.id}+${mate.id}`, players: [c, mate] });
  }
  while (pool.length && pairs.length < count) {
    const a = pool.shift();
    const b = pool.length && rand() < 0.6 && !pool[0].pairWith ? pool.shift() : fresh(clamp(a.ovr + (rand() - 0.5) * 6, lo - 4, hi));
    pairs.push({ id: `${a.id}+${b.id}`, players: [a, b] });
  }

  // paires fictives
  while (pairs.length < count) {
    const o = sample();
    const a = fresh(o + (rand() - 0.5) * 4), b = fresh(o + (rand() - 0.5) * 4);
    pairs.push({ id: `${a.id}+${b.id}`, players: [a, b] });
  }
  return pairs.slice(0, count).map((p) => ({ ...p, ovr: pairOvr(p.players) }));
}

/**
 * Crée un tournoi.
 * @param {object} tpl         entrée de TOURNAMENTS
 * @param {object} playerPair  { players:[joueur, partenaire], ovr }
 */
export function createTournament(tpl, playerPair, rand, week, formatId = null) {
  const tier = tierById(tpl.tier);
  const fmt = MATCH_FORMATS[formatId] || { sets: tier.sets, gamesPerSet: tier.gamesPerSet, matchTiebreak: 0 };
  const field = buildField(tpl, tpl.draw - 1, rand, playerPair.players.map((p) => p.short));
  const pairs = [...field, { id: 'player', players: playerPair.players, ovr: playerPair.ovr, isPlayer: true }]
    .sort((a, b) => b.ovr - a.ovr)
    .map((p, i) => ({ ...p, seed: i + 1 }));
  const bySeed = (s) => pairs.findIndex((p) => p.seed === s);
  const order = seedOrder(tpl.draw);
  const first = [];
  for (let i = 0; i < order.length; i += 2) first.push({ a: bySeed(order[i]), b: bySeed(order[i + 1]), winner: null, score: null });
  return {
    tplId: tpl.id, tier: tpl.tier, name: tpl.name, week, draw: tpl.draw, venue: tpl.venue || 'club',
    sets: fmt.sets, gamesPerSet: fmt.gamesPerSet, matchTiebreak: fmt.matchTiebreak || 0, format: formatId, golden: tier.golden,
    pairs, rounds: [first], round: 0, done: false, placing: null, champion: null,
    playerIndex: pairs.findIndex((p) => p.isPlayer),
  };
}

export const roundName = (t, r = t.round) => ROUND_NAMES[t.rounds[r]?.length] || `Tour ${r + 1}`;
export const totalRounds = (t) => Math.log2(t.draw);

/** Match du joueur dans le tour courant (ou null s'il est éliminé / tournoi fini). */
export function playerMatch(t) {
  if (t.done) return null;
  return t.rounds[t.round].find((m) => m.a === t.playerIndex || m.b === t.playerIndex) || null;
}

function simulate(t, m, rand) {
  const a = t.pairs[m.a], b = t.pairs[m.b];
  const aWins = rand() < winProbability(a.ovr, b.ovr);
  m.winner = aWins ? m.a : m.b;
  m.score = randomScore(rand, t.sets, t.gamesPerSet, t.matchTiebreak);
}

/**
 * Enregistre le résultat du match du joueur, simule les autres matchs du tour
 * et fait avancer le tableau. Si le joueur est éliminé, la fin du tournoi est simulée.
 * @returns {{finished:boolean, placing:number|null}} placing : 0 vainqueur, 1 finaliste, 2 demi…
 */
export function reportPlayerResult(t, won, score, rand) {
  const m = playerMatch(t);
  if (!m) return { finished: t.done, placing: t.placing };
  const opp = m.a === t.playerIndex ? m.b : m.a;
  m.winner = won ? t.playerIndex : opp;
  m.score = score;
  const rounds = totalRounds(t);
  let alive = won;
  for (;;) {
    const cur = t.rounds[t.round];
    for (const x of cur) if (x.winner === null) simulate(t, x, rand);
    if (cur.length === 1) {
      t.champion = cur[0].winner;
      t.done = true;
      if (alive) t.placing = 0;
      break;
    }
    const next = [];
    for (let i = 0; i < cur.length; i += 2) next.push({ a: cur[i].winner, b: cur[i + 1].winner, winner: null, score: null });
    if (!alive && t.placing === null) t.placing = rounds - t.round;   // éliminé à ce tour
    t.rounds.push(next);
    t.round++;
    if (alive) break;       // le joueur doit jouer le tour suivant
  }
  if (!alive && t.placing === null) t.placing = 1; // battu en finale
  return { finished: t.done, placing: t.placing };
}

export { TIERS };
