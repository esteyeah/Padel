// ============================================================================
//  Boutique (carrière) : achetée avec les points boutique gagnés en match,
//  en mission et à l'entraînement. Les objets achetés servent aussi dans le
//  mode exhibition (terrains, tenue, raquette, sac).
// ============================================================================
import { COLORS, HEADWEAR_ITEMS, RACKETS, BAGS, KIT_STYLES } from '../../entities/Appearance.js';
import { RACKET_DESIGNS } from '../../entities/Racket.js';

const FREE_COLORS = ['blue', 'red', 'green', 'black', 'white', 'navy', 'grey', 'yellow'];
// Matériel et tenue : payés en euros (dotations des tournois).
const COLOR_PRICE = { silver: 900, bronze: 600, gold: 4000 };
const HEADWEAR_PRICE = { none: 0, band: 0, cap: 40, capback: 50, visor: 45, bandana: 70 };
const RACKET_PRICE = { classic: 0, carbon: 450, power: 450, touch: 450, smash: 600, viper: 700, tour: 1200, storm: 900, gold: 15000, mondial: 99999 };
const BAG_PRICE = { none: 0, blue: 90, black: 90, white: 120, pink: 120, gold: 6000 };
// Terrains (et personnages, voir Characters.js) : payés en points boutique.
const VENUE_PRICE = { municipal: 0, club: 0, ceyreste: 350, laciotat: 450, national: 800, prestige: 2500, beach: 1000, hangar: 500, pro: 1800 };

export const SHOP_CATEGORIES = [
  { id: 'color', label: 'Couleurs de tenue' },
  { id: 'headwear', label: 'Casquettes et bandeaux' },
  { id: 'kit', label: 'Maillots' },
  { id: 'racket', label: 'Raquettes' },
  { id: 'design', label: 'Designs de raquette' },
  { id: 'bag', label: 'Sacs' },
  { id: 'venue', label: 'Terrains (exhibition)' },
];

export const SHOP_ITEMS = [
  ...COLORS.map((c) => ({ id: `color:${c.id}`, cat: 'color', ref: c.id, label: c.label, hex: c.hex, metal: !!c.metal, price: FREE_COLORS.includes(c.id) ? 0 : COLOR_PRICE[c.id] ?? 80, eur: true })),
  ...HEADWEAR_ITEMS.map((h) => ({ id: `headwear:${h.id}`, cat: 'headwear', ref: h.id, label: h.label, price: HEADWEAR_PRICE[h.id] ?? 50, eur: true })),
  ...RACKETS.map((r) => ({
    id: `racket:${r.id}`, cat: 'racket', ref: r.id, label: r.label, hex: r.frame, price: RACKET_PRICE[r.id] ?? 450, eur: true,
    desc: Object.entries(r.bonus).map(([k, v]) => `+${v} ${{ drive: 'coup droit & revers', lob: 'lob', smash: 'smash', strength: 'force' }[k]}`).join(', ') || 'Raquette de club, sans bonus',
  })),
  ...KIT_STYLES.map((k) => ({ id: `kit:${k.id}`, cat: 'kit', ref: k.id, label: k.label, price: k.price, eur: true, desc: 'Coupe de maillot, aux couleurs de votre tenue' })),
  ...RACKET_DESIGNS.map((d) => ({ id: `design:${d.id}`, cat: 'design', ref: d.id, label: d.label, hex: d.face ?? 0xffd400, price: d.price, eur: true, desc: d.id === 'model' ? 'Le design livré avec la raquette' : 'Se pose sur n\'importe quelle raquette (sans bonus)' })),
  ...BAGS.map((b) => ({ id: `bag:${b.id}`, cat: 'bag', ref: b.id, label: b.label, hex: b.main, price: BAG_PRICE[b.id] ?? 100, eur: true })),
  ...['municipal', 'club', 'ceyreste', 'laciotat', 'hangar', 'national', 'beach', 'prestige', 'pro'].map((v) => ({ id: `venue:${v}`, cat: 'venue', ref: v, price: VENUE_PRICE[v] })),
];

// Les terrains se paient en points boutique. TEST_UNLOCK_ALL_VENUES reste à false ;
// le code secret (Paramètres > Code secret) débloque tous les terrains et tous les
// personnages sur l'appareil où il est saisi.
export const TEST_UNLOCK_ALL_VENUES = false;
const UNLOCK_KEY = 'padel-arena.unlock';
export const UNLOCK_CODE = 'CEYRESTE13';
// déblocages gagnés dans l'Aventure (personnages « char:id » et terrains « venue:id »), communs à toutes les sauvegardes
const ADV_KEY = 'padel-arena.advUnlocks';
export function advUnlocks() { try { return JSON.parse(localStorage.getItem(ADV_KEY) || '[]'); } catch { return []; } }
export function unlockAdv(ids) {
  const cur = advUnlocks(), added = ids.filter((x) => !cur.includes(x));
  if (added.length) try { localStorage.setItem(ADV_KEY, JSON.stringify([...cur, ...added])); } catch { /* ignoré */ }
  return added;
}
export function isUnlocked() { try { return localStorage.getItem(UNLOCK_KEY) === '1'; } catch { return false; } }
export function tryUnlockCode(code) {
  if (String(code || '').trim().toUpperCase() !== UNLOCK_CODE) return false;
  try { localStorage.setItem(UNLOCK_KEY, '1'); } catch { return false; }
  return true;
}

export const FREE_ITEMS = SHOP_ITEMS.filter((i) => i.price === 0 || (TEST_UNLOCK_ALL_VENUES && i.cat === 'venue')).map((i) => i.id);
export const itemById = (id) => SHOP_ITEMS.find((i) => i.id === id);

// Points boutique gagnés
export const SHOP_REWARDS = {
  win: { amateur: 10, regional: 20, national: 35, pro: 60 },
  titleFactor: 3,                      // un titre rapporte 3 victoires de plus
  drill: [0, 3, 8, 15],                // par médaille (aucune, bronze, argent, or)
};
