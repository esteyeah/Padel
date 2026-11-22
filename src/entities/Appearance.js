// ============================================================================
import { designById } from './Racket.js';
//  Apparence des joueurs : catalogue (couleurs, carrures, coiffures, barbes,
//  couvre-chefs, raquettes, sacs), tenues d'équipe des bots, et conversion
//  d'un "look" (identifiants choisis dans l'éditeur / la boutique) en
//  apparence détaillée pour l'Avatar.
// ============================================================================

// ---------------------------------------------------------------- couleurs
// metal : rendu métallisé (or, argent, bronze)
export const COLORS = [
  { id: 'blue', label: 'Bleu', hex: 0x1565c0 },
  { id: 'red', label: 'Rouge', hex: 0xc62828 },
  { id: 'green', label: 'Vert', hex: 0x0f7b5f },
  { id: 'black', label: 'Noir', hex: 0x24262b },
  { id: 'white', label: 'Blanc', hex: 0xf2f4f7 },
  { id: 'navy', label: 'Marine', hex: 0x0f1c2e },
  { id: 'yellow', label: 'Jaune', hex: 0xffd400 },
  { id: 'orange', label: 'Orange', hex: 0xef6c00 },
  { id: 'sky', label: 'Ciel', hex: 0x4fc3f7 },
  { id: 'pink', label: 'Rose', hex: 0xec407a },
  { id: 'purple', label: 'Violet', hex: 0x7b1fa2 },
  { id: 'turquoise', label: 'Turquoise', hex: 0x00bfa5 },
  { id: 'lime', label: 'Citron vert', hex: 0x9ccc23 },
  { id: 'bordeaux', label: 'Bordeaux', hex: 0x6d1028 },
  { id: 'khaki', label: 'Kaki', hex: 0x6b6b3a },
  { id: 'grey', label: 'Gris', hex: 0x8a8f98 },
  { id: 'silver', label: 'Argent', hex: 0xc9ced6, metal: true },
  { id: 'bronze', label: 'Bronze', hex: 0xb0713a, metal: true },
  { id: 'gold', label: 'Or', hex: 0xd4a72c, metal: true },
];
export const colorById = (id) => COLORS.find((c) => c.id === id) || COLORS[0];

export const SKIN_TONES = [0xfbe2cf, 0xf6d3b3, 0xeec4a2, 0xeac09a, 0xd9a47c, 0xc99069, 0xc0875e, 0xa8714b, 0x9a6440, 0x845233, 0x6e4529, 0x55341f];
export const HAIR_COLORS = [0x17100b, 0x2e1c10, 0x4a2e19, 0x7a5232, 0xb98a55, 0xd9bf86, 0xa33a1c, 0x8f8f8f, 0xe8e8e8];
export const HAIR_COLOR_LABELS = ['Noir', 'Brun foncé', 'Brun', 'Châtain', 'Blond foncé', 'Blond', 'Roux', 'Gris', 'Blanc'];

export const BUILDS = [
  { id: 'fine', label: 'Fine', build: 0.92, belly: 0 },
  { id: 'normal', label: 'Normale', build: 1.0, belly: 0 },
  { id: 'athletic', label: 'Athlétique', build: 1.08, belly: 0, muscle: 0.35 },
  { id: 'muscular', label: 'Très musclé', build: 1.16, belly: 0, muscle: 1 },
  { id: 'stocky', label: 'Corpulente', build: 1.1, belly: 0.5 },
  { id: 'heavy', label: 'Surpoids', build: 1.16, belly: 1 },
];
export const HAIR_STYLES = [
  { id: 'bald', label: 'Chauve' }, { id: 'buzz', label: 'Rasée' }, { id: 'receding', label: 'Dégarnie' },
  { id: 'short', label: 'Courte' }, { id: 'surfer', label: 'Surfeur ondulée' }, { id: 'curtain', label: 'Deux mèches' }, { id: 'fade', label: 'Dégradé' }, { id: 'quiff', label: 'Banane' }, { id: 'curly', label: 'Bouclée' },
  { id: 'afro', label: 'Afro' }, { id: 'mohawk', label: 'Crête' }, { id: 'dreads', label: 'Locks' },
  { id: 'long', label: 'Mi-longue' }, { id: 'longcurly', label: 'Longue bouclée' },
  { id: 'ponytail', label: 'Queue de cheval' }, { id: 'bun', label: 'Chignon' },
];
export const BEARDS = [
  { id: 'none', label: 'Aucune' }, { id: 'stubble', label: 'De 3 jours' }, { id: 'beard', label: 'Barbe' },
  { id: 'full', label: 'Barbe fournie' }, { id: 'goatee', label: 'Bouc' }, { id: 'moustache', label: 'Moustache' },
];
export const HEADWEAR_ITEMS = [
  { id: 'none', label: 'Aucun' }, { id: 'band', label: 'Bandeau' }, { id: 'cap', label: 'Casquette' },
  { id: 'capback', label: "Casquette à l'envers" }, { id: 'visor', label: 'Visière' }, { id: 'bandana', label: 'Bandana' },
];
// Raquettes : esthétique + petit bonus (en points d'attribut, 0..99)
export const RACKETS = [
  { id: 'classic', label: 'Club Classic', frame: 0xffd400, face: 0xffd400, base: null, pattern: 'arc', bonus: {} },
  { id: 'carbon', label: 'Carbon Control', frame: 0x202226, face: 0xe53935, base: 0x2a2d33, pattern: 'stripes', bonus: { drive: 2 } },
  { id: 'power', label: 'Power Diamond', frame: 0x1565c0, face: 0x4fc3f7, base: 0x0f1c2e, pattern: 'split', bonus: { strength: 2 } },
  { id: 'touch', label: 'Soft Touch', frame: 0xf2f4f7, face: 0x00bfa5, base: 0xf2f4f7, pattern: 'arc', bonus: { lob: 2 } },
  { id: 'smash', label: 'Smash Pro', frame: 0xc62828, face: 0xffd400, base: 0x1a1a1d, pattern: 'star', bonus: { smash: 2 } },
  { id: 'viper', label: 'Viper Hybrid', frame: 0x00c853, face: 0x00e676, base: 0x0b1f14, accent: 0x111111, pattern: 'hex', bonus: { drive: 1, lob: 1 } },
  { id: 'tour', label: 'Tour Carbon 18K', frame: 0x111316, face: 0xff6d00, base: 0x15171b, accent: 0x9aa0a8, pattern: 'weave', bonus: { drive: 2, smash: 1 } },
  { id: 'storm', label: 'Storm Attack', frame: 0x283593, face: 0xffeb3b, base: 0x0b1530, accent: 0x40c4ff, pattern: 'bolt', bonus: { smash: 2, strength: 1 } },
  { id: 'gold', label: 'Gold Edition', frame: 0xd4a72c, face: 0xd4a72c, base: 0x17100b, pattern: 'goldleaf', accent: 0xfff3c4, metal: true, bonus: { drive: 1, smash: 1, strength: 1 } },
];
export const BAGS = [
  { id: 'none', label: 'Aucun' },
  { id: 'blue', label: 'Thermo bleu', main: 0x1565c0, accent: 0xffd400 },
  { id: 'black', label: 'Thermo noir', main: 0x202226, accent: 0xe53935 },
  { id: 'white', label: 'Tour blanc', main: 0xf2f4f7, accent: 0x00bfa5 },
  { id: 'pink', label: 'Fluo rose', main: 0xec407a, accent: 0x202226 },
  { id: 'gold', label: 'Pro doré', main: 0xd4a72c, accent: 0x17100b, metal: true },
];
export const rackById = (id) => RACKETS.find((r) => r.id === id) || RACKETS[0];
export const bagById = (id) => BAGS.find((b) => b.id === id) || BAGS[0];

// Tenues d'équipe des bots (match rapide, adversaires de carrière)
export const KITS = {
  blue: { shirt: 0x1565c0, accent: 0xffd400, shorts: 0x0f1c2e, shoes: 0xf4f6f8, shoeAccent: 0x1565c0, racket: 0xffd400 },
  red: { shirt: 0xc62828, accent: 0xffffff, shorts: 0x1a1a1d, shoes: 0x202226, shoeAccent: 0xe53935, racket: 0xf5f5f5 },
  green: { shirt: 0x0f7b5f, accent: 0xb9f6ca, shorts: 0x0d2b24, shoes: 0xf4f6f8, shoeAccent: 0x0f7b5f, racket: 0x76ff03 },
  black: { shirt: 0x24262b, accent: 0xff6d00, shorts: 0x111214, shoes: 0xf4f6f8, shoeAccent: 0xff6d00, racket: 0xff6d00 },
  white: { shirt: 0xf2f4f7, accent: 0x1565c0, shorts: 0x1c2a44, shoes: 0xf4f6f8, shoeAccent: 0x1565c0, racket: 0x40c4ff },
  orange: { shirt: 0xef6c00, accent: 0x1a1a1d, shorts: 0x1a1a1d, shoes: 0x202226, shoeAccent: 0xef6c00, racket: 0xffab40 },
};

// ---------------------------------------------------------------- look -> apparence
export const DEFAULT_LOOK = {
  female: false, height: 1.0, buildId: 'normal', skin: SKIN_TONES[3], hair: HAIR_COLORS[1], hairStyle: 'short', beard: 'none',
  headwear: 'band', skirt: false, primary: 'blue', secondary: 'yellow', shortsColor: 'navy', shoeColor: 'white',
  racket: 'classic', racketDesign: 'model', bag: 'none', number: 10,
};

/** Détails propres à un personnage (maillot de club, tatouages, montre…). */
export function extras(L) {
  const o = {};
  for (const k of ['jersey', 'tattoo', 'watch', 'medals', 'sash', 'capColor', 'capPatch', 'eye', 'chin', 'nose', 'stance']) if (L[k] != null) o[k] = L[k];
  return o;
}

/** Convertit un look (identifiants) en apparence complète pour l'Avatar. */
export function resolveLook(look) {
  const L = { ...DEFAULT_LOOK, ...look };
  const p = colorById(L.primary), s = colorById(L.secondary), sh = colorById(L.shortsColor), shoe = colorById(L.shoeColor);
  const b = BUILDS.find((x) => x.id === L.buildId) || BUILDS[1];
  const r = rackById(L.racket);
  return {
    shirt: L.shirtHex ?? p.hex, accent: L.accentHex ?? s.hex, shorts: L.shortsHex ?? sh.hex, shoes: shoe.hex, shoeAccent: s.hex,
    metal: { shirt: p.metal, accent: s.metal, shorts: sh.metal },
    racket: r.frame, racketLabel: r.label, racketMetal: !!r.metal,
    ...(() => { const d = designById(L.racketDesign); return d.id === 'model' ? { racketFace: r.face, racketBase: r.base, racketPattern: r.pattern, racketAccent: r.accent } : { racketFace: d.face, racketBase: d.base, racketPattern: d.pattern, racketAccent: d.accent }; })(),
    skin: L.skin, hair: L.hair, hairStyle: L.hairStyle, beard: L.beard, headwear: L.headwear === 'none' ? null : L.headwear,
    female: L.female, skirt: L.female && L.skirt, height: L.height, build: b.build, belly: b.belly, muscle: b.muscle || 0, number: L.number,
    ...extras(L),
  };
}

// ---------------------------------------------------------------- génération aléatoire
const NAMES_M = ['LÉO', 'MARCO', 'HUGO', 'PABLO', 'NICO', 'ADRIEN', 'SAMI', 'TOMÁS', 'ENZO', 'RAFA'];
const NAMES_F = ['INÈS', 'SOFIA', 'NORA', 'LUCIA', 'EMMA', 'ALBA', 'MAYA', 'CLARA'];

const pick = (arr, r) => arr[Math.floor(r() * arr.length) % arr.length];

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Apparence aléatoire mais cohérente pour un joueur.
 * @param {string} kitName  tenue d'équipe
 * @param {number} seed
 * @param {object} over     valeurs imposées (nom, numéro, coiffure, barbe, teint…)
 */
export function makeAppearance(kitName, seed, over = {}) {
  const r = rng(seed);
  const female = over.female ?? r() < 0.4;
  const style = female ? pick(['ponytail', 'bun', 'long', 'ponytail', 'longcurly', 'curly'], r) : pick(['short', 'buzz', 'short', 'long', 'quiff', 'curly', 'receding', 'bald', 'afro'], r);
  const b = female ? pick(BUILDS.slice(0, 3), r) : pick([...BUILDS, BUILDS[1], BUILDS[2]], r);
  return {
    ...KITS[kitName],
    female,
    height: (female ? 0.95 : 1.0) + (r() - 0.5) * 0.06,
    build: b.build,
    belly: b.belly,
    skin: pick(SKIN_TONES, r),
    hair: pick(HAIR_COLORS.slice(0, 7), r),
    hairStyle: style,
    beard: female ? 'none' : pick(['none', 'none', 'stubble', 'beard', 'goatee'], r),
    headwear: pick([null, 'band', 'cap', 'visor', null, 'capback'], r),
    skirt: female && r() < 0.5,
    number: 1 + Math.floor(r() * 39),
    name: pick(female ? NAMES_F : NAMES_M, r),
    ...over,
  };
}
