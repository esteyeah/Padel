// ============================================================================
//  Attributs RPG du mode carrière (échelle 0..99) et règles de progression.
//  Les valeurs sont converties en 0..1 pour le moteur (Player.stats).
// ============================================================================
export const ATTRIBUTES = [
  { id: 'drive', label: 'Coup droit & revers', weight: 0.26, desc: 'Précision, régularité et puissance des frappes de fond de court, des volées et du service.' },
  { id: 'lob', label: 'Lob', weight: 0.14, desc: 'Lobs plus précis et plus sûrs pour repousser les adversaires du filet.' },
  { id: 'smash', label: 'Smash & bandeja', weight: 0.2, desc: 'Efficacité et puissance des coups au-dessus de la tête, qualité des volées.' },
  { id: 'speed', label: 'Vitesse', weight: 0.16, desc: 'Rapidité des déplacements : plus de balles atteintes, meilleur placement.' },
  { id: 'stamina', label: 'Endurance', weight: 0.1, desc: 'La fatigue arrive plus tard dans les longs échanges et les matchs en 3 sets.' },
  { id: 'strength', label: 'Force', weight: 0.14, desc: 'Balle plus rapide et plus lourde : elle ressort plus vivement des vitres.' },
];
export const ATTR_IDS = ATTRIBUTES.map((a) => a.id);

export const START_VALUE = 30;      // tous les attributs au départ
export const START_POINTS = 8;      // points à répartir à la création
export const MAX_VALUE = 99;

/** Note globale (0..99) : moyenne pondérée des attributs. */
export function overall(attrs) {
  return Math.round(ATTRIBUTES.reduce((s, a) => s + (attrs[a.id] ?? START_VALUE) * a.weight, 0));
}

/** Coût en points de compétence pour +1 (plus cher à haut niveau). */
export function upgradeCost(value) {
  if (value >= MAX_VALUE) return Infinity;
  if (value < 60) return 1;
  if (value < 80) return 2;
  return 3;
}

/** Attributs 0..99 -> stats moteur 0..1. */
export function toStats(attrs) {
  const o = {};
  for (const id of ATTR_IDS) o[id] = Math.max(0, Math.min(1, (attrs[id] ?? START_VALUE) / 100));
  return o;
}

// ------------------------------------------------------------------ XP / niveaux
/** XP nécessaire pour passer du niveau n au niveau n+1. */
export const xpForLevel = (n) => 100 + (n - 1) * 60;

export const REWARDS = {
  // XP par match gagné, selon le palier (multiplié par le tour atteint) ; 30 % en cas de défaite
  matchXp: { amateur: 40, regional: 80, national: 150, pro: 280 },
  lossFactor: 0.3,
  roundBonus: 0.25,           // +25 % d'XP par tour supplémentaire
  titleXpFactor: 2,           // bonus de titre = 2 x l'XP d'un match du palier
  // points de compétence
  winSp: { amateur: 2, regional: 3, national: 4, pro: 5 },
  titleSp: { amateur: 4, regional: 6, national: 8, pro: 10 },
  levelSp: 2,
  trainingXp: 35,             // une semaine d'entraînement
};
