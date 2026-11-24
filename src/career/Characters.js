// ============================================================================
//  Sélection de personnage (exhibition) : joueurs pros, personnalités et
//  joueurs du circuit amateur. Chaque personnage garde la fiche (attributs,
//  main, apparence) qu'il a dans la carrière.
//   - pros et personnalités : achetables avec les points boutique de la carrière ;
//   - Jean Deuxbé, Raf Tomatis, Timéo Boulhol, Camille Roy : débloqués par une
//     mission de carrière (les battre en tournoi).
// ============================================================================
import { PRO_PAIRS, CELEBRITIES } from './data/roster.js';

/** Personnages débloqués par une mission : id -> texte de la mission. */
export const MISSION_CHARS = {
  'jean-deuxbe': 'Battre Jean Deuxbé en tournoi (carrière)',
  'rafael-tomatis': 'Battre Rafael « Raf » Tomatis en tournoi (carrière)',
  'timeo-boulhol': 'Battre Timéo Boulhol en tournoi (carrière)',
  'camille-roy': 'Battre Camille Roy en tournoi (carrière)',
  'eliott-hanras': 'Battre Eliott Hanras en tournoi (carrière)',
  'nathan-subrero': 'Battre Nathan Subrero en tournoi (carrière)',
  'le-maire-de-ceyreste': 'Battre le maire en tournoi à Ceyreste (carrière)',
};

// Prix : les personnalités les mieux notées coûtent plus cher que les pros les moins bien notés
// (popularité oblige) ; les pros montent ensuite avec leur note.
const priceFor = (npc) => Math.round((npc.kind === 'pro' ? 1500 + (npc.ovr - 86) * 150 : npc.ovr * npc.ovr * 0.25) / 50) * 50;

/** Liste complète, triée par catégorie puis par note. */
export function characterList() {
  const pros = PRO_PAIRS.flatMap((p) => p.players);
  const seen = new Set();
  const out = [];
  const add = (npc, cat) => {
    if (seen.has(npc.id)) return;
    seen.add(npc.id);
    out.push({ id: npc.id, npc, cat, mission: MISSION_CHARS[npc.id] || null, price: MISSION_CHARS[npc.id] ? 0 : priceFor(npc) });
  };
  for (const id of Object.keys(MISSION_CHARS)) { const n = CELEBRITIES.find((c) => c.id === id); if (n) add(n, 'Circuit amateur'); }
  [...CELEBRITIES].sort((a, b) => b.ovr - a.ovr).forEach((n) => add(n, 'Personnalités'));
  [...pros].sort((a, b) => b.ovr - a.ovr).forEach((n) => add(n, 'Joueurs pros'));
  return out;
}

export const findCharacter = (id) => characterList().find((c) => c.id === id) || null;
