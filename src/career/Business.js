// ============================================================================
//  Argent de la carrière (€) — tout est facultatif, la carrière avance sans.
//   - Staff : salariés payés chaque semaine, qui améliorent le niveau ou le confort.
//   - Mon club : on achète un club, on l'agrandit ; il rapporte chaque semaine
//     et organise son propre tournoi toutes les 4 semaines.
// ============================================================================

export const STAFF = {
  coach: { label: 'Coach particulier', salary: 150, desc: 'Les médailles d\'argent et d\'or à l\'entraînement rapportent +1 point d\'attribut.' },
  physio: { label: 'Préparateur physique', salary: 300, desc: '+5 en Endurance et +2 en Vitesse pendant les matchs.' },
  kine: { label: 'Kiné', salary: 200, desc: 'Récupération : deux entraînements possibles par semaine.' },
  agent: { label: 'Agent', salary: 500, desc: '+20 % sur les dotations des tournois et +25 % de points boutique.' },
};

export const CLUB = {
  price: 15000,
  courts: { max: 8, price: (lvl) => 4000 + lvl * 2000, income: 140 },     // par court et par semaine
  bar: { max: 3, price: (lvl) => 2500 * (lvl + 1), income: 110 },         // buvette, par niveau
  stands: { max: 5, price: (lvl) => 8000 * (lvl + 1), income: 0 },        // tribunes : niveau du tournoi du club
};
export const CLUB_TIERS = ['amateur', 'regional', 'regional', 'national', 'national', 'pro'];

/** Décorations du club (payées en euros). income : recettes supplémentaires par semaine. */
export const DECOS = [
  { id: 'flags', label: 'Fanions et banderoles', price: 800, desc: 'Guirlandes de fanions autour des courts.' },
  { id: 'flowers', label: 'Massifs de fleurs', price: 1500, desc: 'Des fleurs le long des allées.' },
  { id: 'trophies', label: 'Vitrine des trophées', price: 2500, desc: 'Vos titres exposés devant le club-house.' },
  { id: 'mural', label: 'Fresque murale', price: 3000, desc: 'Une grande fresque padel sur le club-house.' },
  { id: 'palms', label: 'Allée de palmiers', price: 4000, desc: 'Une allée de palmiers à l\'entrée.' },
  { id: 'terrace', label: 'Terrasse et parasols', price: 5000, income: 40, desc: 'Une terrasse ombragée : +40 € / semaine.' },
  { id: 'fountain', label: 'Fontaine', price: 6000, desc: 'Une fontaine au centre de l\'allée.' },
  { id: 'led', label: 'Éclairage LED', price: 8000, desc: 'Des projecteurs LED colorés sur le court central.' },
  { id: 'statue', label: 'Statue du fondateur', price: 12000, desc: 'Votre statue, raquette levée. Rien que ça.' },
  { id: 'screen', label: 'Écran géant', price: 15000, income: 80, desc: 'Un écran géant pour les tournois : +80 € / semaine.' },
];

export function freshClub(name) {
  return { name, courts: 1, bar: 0, stands: 0, earned: 0, decos: [] };
}

/** Revenus hebdomadaires du club. */
export function clubIncome(club) {
  if (!club) return 0;
  return club.courts * CLUB.courts.income + club.bar * CLUB.bar.income + DECOS.filter((d) => club.decos?.includes(d.id)).reduce((s, d) => s + (d.income || 0), 0);
}

/** Tournoi organisé par le club du joueur (toutes les 4 semaines). */
export function clubTournament(club) {
  const tier = CLUB_TIERS[club.stands];
  const base = { amateur: [30, 250], regional: [140, 2200], national: [480, 12000], pro: [900, 45000] }[tier];
  return {
    id: 'myclub', venue: 'myclub', tier, name: `Open de ${club.name}`, draw: 8,
    points: base[0], prize: base[1], fee: 0, ovrShift: 0.5, every: 4, host: true,
  };
}

/** Recettes de billetterie quand le club accueille son tournoi. */
export const hostRevenue = (club) => 300 + club.stands * 1500 + club.courts * 200;
