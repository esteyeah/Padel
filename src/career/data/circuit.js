// ============================================================================
//  Structure du circuit : paliers, tournois, points de classement, dotations,
//  et barème du classement mondial.
// ============================================================================

// Paliers, du club au circuit mondial. unlockRank : classement requis pour s'inscrire.
// ovr : fourchette de niveau des paires adverses. Format : sets gagnants / jeux par set.
export const TIERS = [
  { id: 'amateur', label: 'Amateur local', unlockRank: Infinity, ovr: [22, 40], sets: 1, gamesPerSet: 4, golden: true },
  { id: 'regional', label: 'Régional', unlockRank: 700, ovr: [40, 60], sets: 1, gamesPerSet: 6, golden: true },
  { id: 'national', label: 'National', unlockRank: 300, ovr: [58, 82], sets: 1, gamesPerSet: 6, golden: true },
  { id: 'pro', label: 'Circuit mondial', unlockRank: 100, ovr: [80, 99], sets: 3, gamesPerSet: 6, golden: true },
];
export const tierById = (id) => TIERS.find((t) => t.id === id);

// Formats de match réglables dans la carrière (les petits tournois se jouent souvent en tie-break).
export const MATCH_FORMATS = {
  stb: { label: 'Super tie-break (10 points)', short: 'Super tie-break', matchTiebreak: 10, sets: 1, gamesPerSet: 6 },
  tb: { label: 'Tie-break (7 points)', short: 'Tie-break', matchTiebreak: 7, sets: 1, gamesPerSet: 6 },
  set4: { label: '1 set court (4 jeux)', short: 'Set court', matchTiebreak: 0, sets: 1, gamesPerSet: 4 },
  set6: { label: '1 set (6 jeux)', short: '1 set', matchTiebreak: 0, sets: 1, gamesPerSet: 6 },
  bo3: { label: '2 sets gagnants', short: '2 sets gagnants', matchTiebreak: 0, sets: 3, gamesPerSet: 6 },
};
export const FORMAT_CHOICES = { amateur: ['stb', 'tb', 'set4', 'set6'], regional: ['set4', 'stb', 'tb', 'set6'], national: ['set6', 'set4', 'stb'], pro: ['bo3', 'set6'] };
export const DEFAULT_FORMATS = { amateur: 'stb', regional: 'set4', national: 'set6', pro: 'bo3' };
export const tierIndex = (id) => TIERS.findIndex((t) => t.id === id);

// Tournois. draw : nombre de paires. points : points de classement du vainqueur.
// prize : dotation du vainqueur (€). fee : frais d'inscription. every : fréquence en semaines.
// minRank : classement requis en plus du palier. ovrShift : niveau du plateau dans la fourchette (0..1).
export const TOURNAMENTS = [
  // --- amateur : tournois de quartier et de club, petites dotations
  { id: 'quartier', venue: 'municipal', tier: 'amateur', name: 'Tournoi de quartier', draw: 4, points: 12, prize: 60, fee: 10, ovrShift: 0.15 },
  { id: 'club', venue: 'club', tier: 'amateur', name: 'Open du club', draw: 8, points: 25, prize: 150, fee: 15, ovrShift: 0.45 },
  { id: 'interclubs', venue: 'ceyreste', tier: 'amateur', name: 'Trophée interclubs', draw: 8, points: 40, prize: 300, fee: 20, ovrShift: 0.8, every: 2 },
  // --- régional
  { id: 'departemental', venue: 'municipal', tier: 'regional', name: 'Open départemental', draw: 8, points: 90, prize: 800, fee: 40, ovrShift: 0.25 },
  { id: 'grandprix', venue: 'ceyreste', tier: 'regional', name: 'Grand Prix régional', draw: 8, points: 150, prize: 1500, fee: 60, ovrShift: 0.6 },
  { id: 'hangaropen', venue: 'hangar', tier: 'regional', name: 'Open du Hangar', draw: 8, points: 120, prize: 1200, fee: 50, ovrShift: 0.45 },
  { id: 'laciotatopen', venue: 'laciotat', tier: 'regional', name: 'Open de La Ciotat', draw: 8, points: 140, prize: 1400, fee: 55, ovrShift: 0.55 },
  { id: 'mastersreg', venue: 'club', tier: 'regional', name: 'Masters régional', draw: 8, points: 220, prize: 3000, fee: 80, ovrShift: 0.9, every: 3 },
  // --- national
  { id: 'opennat', venue: 'national', tier: 'national', name: 'Open national', draw: 8, points: 400, prize: 8000, fee: 150, ovrShift: 0.3 },
  { id: 'superseries', venue: 'beach', tier: 'national', name: 'Super Série nationale', draw: 8, points: 550, prize: 14000, fee: 200, ovrShift: 0.6 },
  { id: 'championnat', venue: 'pro', tier: 'national', name: 'Championnat national', draw: 16, points: 700, prize: 25000, fee: 250, ovrShift: 0.85, every: 4 },
  // --- circuit mondial
  { id: 'challenger', venue: 'national', tier: 'pro', name: 'Challenger mondial', draw: 8, points: 600, prize: 40000, fee: 500, ovrShift: 0.1 },
  { id: 'open', venue: 'pro', tier: 'pro', name: 'Open mondial', draw: 16, points: 1200, prize: 100000, fee: 800, ovrShift: 0.5 },
  { id: 'major', venue: 'pro', tier: 'pro', name: 'Major', draw: 16, points: 2400, prize: 250000, fee: 1000, ovrShift: 0.85, every: 4 },
  { id: 'finals', venue: 'pro', tier: 'pro', name: 'Masters de fin de saison', draw: 8, points: 2000, prize: 300000, fee: 0, ovrShift: 1, minRank: 16, onlyWeek: 20 },
];

/** Part des points / de la dotation selon le tour atteint (0 = vainqueur, 1 = finaliste…). */
export const ROUND_SHARE = [1, 0.6, 0.35, 0.18, 0.09];
export const ROUND_NAMES = { 1: 'Finale', 2: 'Demi-finale', 4: 'Quart de finale', 8: 'Huitième de finale' };

export const SEASON_WEEKS = 20;     // une saison = 20 semaines ; les points expirent après 20 semaines

// Barème du classement mondial : [rang, points]. Interpolé entre les repères.
export const LADDER = [
  [1, 12000], [2, 10800], [3, 9000], [5, 7200], [10, 5000], [20, 3200], [50, 1500], [100, 700],
  [200, 330], [300, 200], [500, 90], [700, 45], [1000, 12], [1400, 0],
];
export const UNRANKED = 1400;

// Rang approximatif d'un joueur selon sa note globale : [ovr, rang].
const OVR_RANK = [
  [99, 1], [96, 3], [93, 6], [90, 10], [87, 20], [84, 45], [80, 90], [75, 140], [70, 180], [65, 280],
  [60, 420], [55, 540], [50, 640], [45, 760], [40, 900], [33, 1150], [25, 1400],
];

function interp(table, x, descending = false) {
  // table triée par x croissant (ou décroissant si descending)
  const t = descending ? [...table].reverse() : table;
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    if (x <= t[i][0]) {
      const [x0, y0] = t[i - 1], [x1, y1] = t[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return t[t.length - 1][1];
}

/** Points d'un joueur classé au rang donné. */
export const pointsAtRank = (rank) => Math.round(interp(LADDER, rank));

/** Rang obtenu avec ce total de points (1 = meilleur). */
export function rankForPoints(points) {
  if (points <= 0) return UNRANKED;
  if (points >= LADDER[0][1]) return 1;
  for (let i = 1; i < LADDER.length; i++) {
    const [r0, p0] = LADDER[i - 1], [r1, p1] = LADDER[i];
    if (points >= p1) return Math.max(1, Math.ceil(r0 + ((r1 - r0) * (p0 - points)) / (p0 - p1)));
  }
  return UNRANKED;
}

/** Rang mondial indicatif d'un joueur non humain d'après sa note. */
export const rankForOvr = (ovr) => Math.max(1, Math.round(interp(OVR_RANK, ovr, true)));
