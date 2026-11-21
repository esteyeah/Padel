// ============================================================================
//  Boutique (carrière) : achetée avec les points boutique gagnés en match,
//  en mission et à l'entraînement. Les objets achetés servent aussi dans le
//  mode exhibition (terrains, tenue, raquette, sac).
// ============================================================================
import { COLORS, HEADWEAR_ITEMS, RACKETS, BAGS } from '../../entities/Appearance.js';

const FREE_COLORS = ['blue', 'red', 'green', 'black', 'white', 'navy', 'grey', 'yellow'];
// Matériel et tenue : payés en euros (dotations des tournois).
const COLOR_PRICE = { silver: 900, bronze: 600, gold: 4000 };
const HEADWEAR_PRICE = { none: 0, band: 0, cap: 40, capback: 50, visor: 45, bandana: 70 };
const RACKET_PRICE = { classic: 0, carbon: 450, power: 450, touch: 450, smash: 600, gold: 15000 };
const BAG_PRICE = { none: 0, blue: 90, black: 90, white: 120, pink: 120, gold: 6000 };
// Terrains (et personnages, voir Characters.js) : payés en points boutique.
const VENUE_PRICE = { municipal: 0, club: 0, ceyreste: 350, national: 800, beach: 1000, hangar: 500, pro: 1800 };

export const SHOP_CATEGORIES = [
  { id: 'color', label: 'Couleurs de tenue' },
  { id: 'headwear', label: 'Casquettes et bandeaux' },
  { id: 'racket', label: 'Raquettes' },
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
  ...BAGS.map((b) => ({ id: `bag:${b.id}`, cat: 'bag', ref: b.id, label: b.label, hex: b.main, price: BAG_PRICE[b.id] ?? 100, eur: true })),
  ...['municipal', 'club', 'ceyreste', 'hangar', 'national', 'beach', 'pro'].map((v) => ({ id: `venue:${v}`, cat: 'venue', ref: v, price: VENUE_PRICE[v] })),
];

// TEST : tous les terrains sont débloqués pour pouvoir les essayer. Mettre à false pour la
// version finale (les terrains se paient alors en points boutique).
export const TEST_UNLOCK_ALL_VENUES = true;

export const FREE_ITEMS = SHOP_ITEMS.filter((i) => i.price === 0 || (TEST_UNLOCK_ALL_VENUES && i.cat === 'venue')).map((i) => i.id);
export const itemById = (id) => SHOP_ITEMS.find((i) => i.id === id);

// Points boutique gagnés
export const SHOP_REWARDS = {
  win: { amateur: 10, regional: 20, national: 35, pro: 60 },
  titleFactor: 3,                      // un titre rapporte 3 victoires de plus
  drill: [0, 3, 8, 15],                // par médaille (aucune, bronze, argent, or)
};
