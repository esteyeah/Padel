// ============================================================================
//  Constantes du jeu : dimensions officielles, physique, frappes, IA
//  Repère : Y vers le haut, X = largeur (10 m), Z = longueur (20 m).
//  Filet en z = 0. Le joueur humain est côté z > 0 (side = +1), le bot côté z < 0.
// ============================================================================

export const FIXED_DT = 1 / 240; // pas de simulation physique (240 Hz)

export const COURT = {
  halfL: 10,          // 20 m de long
  halfW: 5,           // 10 m de large
  netCenterH: 0.88,   // hauteur du filet au centre
  netPostH: 0.92,     // hauteur aux poteaux
  serviceLine: 6.95,  // distance filet -> ligne de service
  lineW: 0.05,
};

/** Hauteur du filet à l'abscisse x (légère courbure). */
export function netHeightAt(x) {
  const t = Math.min(1, Math.abs(x) / COURT.halfW);
  return COURT.netCenterH + (COURT.netPostH - COURT.netCenterH) * t * t;
}

// ---------------------------------------------------------------------------
//  Portes : ouvertures dans le grillage latéral (selon le terrain).
//  Une balle qui passe par une porte sort de l'enceinte ; sur les terrains qui le
//  permettent (VENUE.outside), le jeu continue dehors.
// ---------------------------------------------------------------------------
// Les portes sont au niveau du filet : une de chaque côté du poteau (une par moitié de terrain).
// Une seule grande ouverture centrée sur le filet (plus de grillage entre les deux portes).
export const DOOR = { width: 2.85, height: 2.05, centers: [0] }; // |z| du centre des ouvertures
export const VENUE_RULES = { doors: false, outside: false };

/** Porte à la position (côté sx, z) ; y facultatif (hauteur de la balle). */
export function doorAt(sx, z, y = 0, margin = 0) {
  if (!VENUE_RULES.doors || y > DOOR.height) return null;
  for (const c of DOOR.centers) {
    for (const sz of [-1, 1]) {
      if (Math.abs(z - sz * c) < DOOR.width / 2 - margin) return { sx, z: sz * c };
    }
  }
  return null;
}

/** Murs du fond : 3 m de vitre + 1 m de grillage. */
export function backWallSurface(y) {
  if (y < 3) return 'glass';
  if (y < 4) return 'mesh';
  return 'open';
}

/**
 * Murs latéraux (en fonction de |z|) :
 *  - 8 m à 10 m du filet : vitre 3 m + grillage jusqu'à 4 m
 *  - 6 m à 8 m          : vitre 2 m + grillage jusqu'à 3 m
 *  - partie centrale    : grillage 3 m
 */
export function sideWallSurface(absZ, y, z = 0, sx = 1) {
  if (doorAt(sx, z, y)) return 'door';
  if (absZ >= 8) return y < 3 ? 'glass' : y < 4 ? 'mesh' : 'open';
  if (absZ >= 6) return y < 2 ? 'glass' : y < 3 ? 'mesh' : 'open';
  return y < 3 ? 'mesh' : 'open';
}

export const BALL = {
  radius: 0.0335,       // rayon réel (balle de padel ~6.7 cm)
  visualRadius: 0.048,  // légèrement grossie à l'écran pour la lisibilité
};

export const PHYS = {
  gravity: 9.81,
  drag: 0.0195,        // a_drag = -k |v| v   (k = ½ρ·Cd·A / m)
  magnus: 0.0011,      // a_magnus = c · (ω × v)
  spinDecay: 0.12,     // amortissement de la rotation (1/s)
  rollThreshold: 0.25, // vitesse normale sous laquelle la balle roule
  rollDecel: 0.9,      // décélération en roulement (m/s²)
};

// e : restitution, eLoss : perte de restitution par m/s d'impact (compression),
// mu : frottement tangentiel, rand : irrégularité du rebond
export const SURFACES = {
  floor: { e: 0.79, eLoss: 0.004, eMin: 0.6, mu: 0.5, rand: 0.015 },
  glass: { e: 0.75, eLoss: 0.0095, eMin: 0.42, mu: 0.22, rand: 0.0 },
  mesh: { e: 0.36, eLoss: 0.006, eMin: 0.16, mu: 0.6, rand: 0.35 },
};

export const PLAYER = {
  reach: 1.22,           // portée horizontale (bras + raquette)
  idealDist: 0.72,       // distance idéale corps/balle à l'impact
  minH: 0.08,
  maxH: 2.3,             // hauteur max coup normal
  maxHOverhead: 3.05,    // hauteur max smash (avec saut)
  baseSpeed: 4.3,        // m/s
  speedPerStat: 2.0,
  accel: 17,
  decel: 26,
  armedSpeedMul: 0.62,   // ralentissement en préparation de frappe
  armWindow: 0.32,       // fenêtre de frappe après relâchement
  chargeTime: 0.8,
  minPower: 0.3,
  netMargin: 0.35,
  wallMargin: 0.28,
};

// speed [min,max] et spin [min,max] interpolés par la puissance (0..1).
// spin > 0 : lift (topspin), spin < 0 : coupé (backspin), en rad/s.
export const SHOTS = {
  drive:   { label: 'Coup droit', speed: [13, 25],   spin: [50, 170],   branch: 'low',  clear: 0.12 },
  volley:  { label: 'Volée',      speed: [10, 19],   spin: [-20, 20],   branch: 'low',  clear: 0.08 },
  slice:   { label: 'Coupé',      speed: [10, 18],   spin: [-120, -230], branch: 'low', clear: 0.14 },
  drop:    { label: 'Amortie',    speed: [5.5, 9],   spin: [-160, -260], branch: 'low', clear: 0.1 },
  lob:     { label: 'Lob',        speed: [11, 15],   spin: [30, 80],    branch: 'high', clear: 1.0 },
  bandeja: { label: 'Bandeja',    speed: [13, 19],   spin: [-90, -160], branch: 'low',  clear: 0.2, thMin: -1.0 },
  smash:   { label: 'Smash',      speed: [24, 36],   spin: [20, 60],    branch: 'low',  clear: 0.05, thMin: -1.0 },
  wall:    { label: 'Contre-vitre', speed: [12, 30], spin: [0, 0],     branch: 'low',  clear: 0.1 },
  serve:   { label: 'Service',    speed: [13, 22],   spin: [0, 60],     branch: 'low',  clear: 0.12 },
};

// ---------------------------------------------------------------------------
//  Attributs d'un joueur (0..1 en jeu, 0..99 dans le mode carrière) :
//   drive    Coup droit & revers : précision / puissance des frappes de fond de court
//   lob      Lob : précision et régularité des lobs
//   smash    Smash & bandeja : efficacité des coups au-dessus de la tête
//   speed    Vitesse : rapidité de déplacement
//   stamina  Endurance : résistance à la fatigue (longs échanges, matchs en 3 sets)
//   strength Force : vitesse de balle et vivacité du rebond sur les vitres
// ---------------------------------------------------------------------------
export const ATTRS = ['drive', 'lob', 'smash', 'speed', 'stamina', 'strength'];

/** Tous les attributs au même niveau (bots du match rapide). */
export const flatStats = (v, over = {}) => ({ drive: v, lob: v, smash: v, speed: v, stamina: v, strength: v, ...over });

/** Attribut sollicité par un type de coup. */
export function skillFor(stats, type) {
  switch (type) {
    case 'lob': return stats.lob;
    case 'smash': case 'bandeja': return stats.smash;
    case 'volley': return (stats.drive + stats.smash) / 2;
    default: return stats.drive; // drive, slice, drop, serve
  }
}

// Fatigue à deux composantes :
//  - énergie immédiate : chute pendant les longs échanges, se récupère en partie entre les points ;
//  - fatigue de fond (plafond d'énergie) : s'accumule sur tout le match, un peu de repos entre les sets.
export const ENERGY = {
  runDrain: 0.017,      // par seconde à pleine course
  hitDrain: 0.0038,     // par frappe (x puissance)
  pointRecovery: 0.22,  // part de l'énergie manquante récupérée entre deux points
  gameRecovery: 0.1,    // part supplémentaire à chaque changement de jeu
  longTerm: 0.03,       // part de chaque dépense qui devient de la fatigue de fond
  setRest: 0.08,        // fatigue de fond récupérée entre deux sets
  minCap: 0.25,
};

// level : niveau général des attributs ; le reste règle le comportement de l'IA
export const DIFFICULTY = {
  easy:   { label: 'Facile', level: 0.3,  reaction: 0.36, speedMul: 0.84, aggression: 0.2,  margin: 1.0,  planError: 0.35 },
  medium: { label: 'Moyen',  level: 0.56, reaction: 0.24, speedMul: 0.94, aggression: 0.45, margin: 0.75, planError: 0.16 },
  strong: { label: 'Confirmé', level: 0.84, reaction: 0.14, speedMul: 1.04, aggression: 0.7,  margin: 0.5,  planError: 0.05 },
  hard:   { label: 'Expert', level: 0.96, reaction: 0.08, speedMul: 1.12, aggression: 0.85, margin: 0.36, planError: 0.015 },
};

/** Paramètres d'IA déduits d'une note globale 0..99 (mode carrière). */
export function botDiffFromRating(ovr) {
  const t = clamp((ovr - 25) / 72, 0, 1);
  return {
    label: `Niveau ${Math.round(ovr)}`, level: ovr / 100, speedMul: 1,
    reaction: lerp(0.4, 0.12, t), aggression: lerp(0.15, 0.8, t), margin: lerp(1.05, 0.4, t), planError: lerp(0.4, 0.04, t),
  };
}

export const PROFILES = {
  baseline: { label: 'Fond de court',      homeDepth: 8.2, volleyPref: -0.7, glassPref: 0.5,  overheadPref: -0.2, lobRate: 0.5,  dropRate: 0.04 },
  varied:   { label: 'Varié',              homeDepth: 5.8, volleyPref: 0.2,  glassPref: 0.3,  overheadPref: 0.3,  lobRate: 0.4,  dropRate: 0.1, adaptive: true },
  attacker: { label: 'Attaquant au filet', homeDepth: 3.4, volleyPref: 0.8,  glassPref: -0.2, overheadPref: 0.6,  lobRate: 0.22, dropRate: 0.15 },
};

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export function gauss() {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
