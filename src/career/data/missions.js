// ============================================================================
//  Missions de match (carrière) : une par match, tirée au hasard selon le
//  palier, le format et le terrain. Réussie, elle rapporte des points de
//  boutique ou des points de compétence.
//
//  metric(stats) lit les statistiques du joueur suivies par Game :
//   winners{type}, aces, doubleFaults, netWinners, glassWinners, porTres,
//   wallShots, wallSuccess, outsideReturns, maxRallyWon, pointsWon, pointsLost,
//   won, gamesLost
// ============================================================================
const T = (a, r, n, p) => ({ amateur: a, regional: r, national: n, pro: p });

export const MISSIONS = [
  { id: 'smash', text: (n) => `gagner ${n} point${n > 1 ? 's' : ''} sur smash`, target: T(1, 1, 2, 3), metric: (s) => s.winners.smash || 0, reward: 'sp' },
  { id: 'bandeja', text: (n) => `gagner ${n} point${n > 1 ? 's' : ''} sur bandeja`, target: T(1, 1, 1, 2), metric: (s) => s.winners.bandeja || 0, reward: 'shop' },
  { id: 'lob', text: (n) => `gagner ${n} point${n > 1 ? 's' : ''} sur un lob`, target: T(1, 1, 1, 2), metric: (s) => s.winners.lob || 0, reward: 'shop' },
  { id: 'volley', text: (n) => `gagner ${n} point${n > 1 ? 's' : ''} sur volée`, target: T(1, 2, 3, 3), metric: (s) => s.winners.volley || 0, reward: 'shop' },
  { id: 'net', text: (n) => `gagner ${n} point${n > 1 ? 's' : ''} en jouant au filet`, target: T(2, 3, 4, 5), metric: (s) => s.netWinners, reward: 'sp' },
  { id: 'ace', text: (n) => `réussir ${n} ace${n > 1 ? 's' : ''}`, target: T(1, 1, 1, 2), metric: (s) => s.aces, reward: 'shop' },
  { id: 'glass', text: (n) => `gagner ${n} point${n > 1 ? 's' : ''} après une balle sortie de vitre`, target: T(1, 1, 2, 2), metric: (s) => s.glassWinners, reward: 'sp' },
  { id: 'wall', text: (n) => `réussir ${n} contre-vitre${n > 1 ? 's' : ''}`, target: T(1, 1, 1, 2), metric: (s) => s.wallSuccess, reward: 'sp' },
  { id: 'portres', text: () => 'faire sortir la balle du terrain (par 3 ou par la porte)', target: T(1, 1, 1, 1), metric: (s) => s.porTres, reward: 'sp', needs: 'power' },
  { id: 'rally', text: (n) => `gagner un échange de ${n} frappes ou plus`, target: T(6, 8, 10, 12), metric: (s) => s.maxRallyWon, reward: 'shop' },
  { id: 'nodf', text: () => 'gagner le match sans double faute', target: T(1, 1, 1, 1), metric: (s) => (s.won && s.doubleFaults === 0 ? 1 : 0), reward: 'shop' },
  { id: 'clean', text: (n) => `gagner en perdant au plus ${n} jeu${n > 1 ? 'x' : ''}`, target: T(1, 2, 2, 3), metric: (s, n) => (s.won && s.gamesLost <= n ? n : 0), reward: 'sp', needs: 'games' },
];

export const MISSION_REWARD = {
  shop: { amateur: 15, regional: 25, national: 40, pro: 60 },
  sp: { amateur: 1, regional: 1, national: 2, pro: 2 },
};

/**
 * Tire une mission adaptée.
 * @param {object} ctx { tier, matchTiebreak, strength (0..99), rand }
 * @returns {{id, text, target, reward, amount}}  (sérialisable ; la fonction metric se retrouve via l'id)
 */
export function pickMission({ tier, matchTiebreak, strength, rand = Math.random }) {
  const pool = MISSIONS.filter((m) => {
    if (m.needs === 'games' && matchTiebreak) return false;
    if (m.needs === 'power' && (strength < 55 || tier === 'amateur')) return false;
    return true;
  });
  const m = pool[Math.floor(rand() * pool.length)];
  const target = m.target[tier];
  return { id: m.id, text: m.text(target), target, reward: m.reward, amount: MISSION_REWARD[m.reward][tier] };
}

/** Mission « vivante » pour le jeu (avec la fonction de mesure). */
export function liveMission(mission) {
  if (!mission) return null;
  const def = MISSIONS.find((m) => m.id === mission.id);
  return { ...mission, metric: (s) => def.metric(s, mission.target) };
}

export function missionDone(mission, stats) {
  if (!mission || !stats) return false;
  return liveMission(mission).metric(stats) >= mission.target;
}
