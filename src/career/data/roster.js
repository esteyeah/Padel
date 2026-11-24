// ============================================================================
//  Effectif du mode carrière : styles de jeu, paires professionnelles,
//  célébrités, joueurs génériques.
//
//  IMPORTANT
//  - Les notes (OVR, attributs) et les styles sont des VALEURS DE JEU choisies
//    pour l'équilibrage. Ce ne sont pas des mesures officielles.
//  - Les deux premières paires sont celles demandées. Les autres reflètent des
//    associations récentes du circuit, de mémoire : à vérifier et à ajuster ici
//    (les paires changent souvent d'une saison à l'autre).
//  - Seuls les noms sont utilisés : les avatars sont génériques (aucune
//    ressemblance recherchée). Une diffusion publique ou commerciale du jeu
//    demanderait l'accord des personnes concernées (droit à l'image, licences).
// ============================================================================
import { ATTR_IDS } from './attributes.js';

// Chaque style règle le comportement de l'IA (BotController) et répartit les attributs.
//  profile : homeDepth (distance au filet), goût pour la volée / la vitre / les coups hauts,
//            fréquence des lobs et des amorties, penchant pour le smash et la puissance.
//  attrs   : écart de chaque attribut par rapport à la note globale.
export const STYLES = {
  allround: {
    label: 'Complet',
    profile: { homeDepth: 5.6, volleyPref: 0.3, glassPref: 0.2, overheadPref: 0.3, lobRate: 0.35, dropRate: 0.08 },
    attrs: {},
  },
  defender: {
    label: 'Défenseur',
    profile: { homeDepth: 8.2, volleyPref: -0.7, glassPref: 0.6, overheadPref: -0.2, lobRate: 0.55, dropRate: 0.04, powerBias: -0.08 },
    attrs: { drive: 3, lob: 5, smash: -7, speed: 5, stamina: 5, strength: -7 },
  },
  attacker: {
    label: 'Attaquant au filet',
    profile: { homeDepth: 3.4, volleyPref: 0.8, glassPref: -0.2, overheadPref: 0.6, lobRate: 0.22, dropRate: 0.15 },
    attrs: { drive: 1, lob: -4, smash: 5, speed: 3, stamina: -2, strength: 1 },
  },
  smasher: {
    label: 'Puncheur',
    profile: { homeDepth: 3.6, volleyPref: 0.6, glassPref: -0.3, overheadPref: 0.9, lobRate: 0.18, dropRate: 0.05, smashBias: 0.25, powerBias: 0.12 },
    attrs: { drive: -1, lob: -5, smash: 8, speed: -3, stamina: -3, strength: 8 },
  },
  magician: {
    label: 'Créatif',
    profile: { homeDepth: 4.6, volleyPref: 0.5, glassPref: 0.3, overheadPref: 0.4, lobRate: 0.32, dropRate: 0.28 },
    attrs: { drive: 6, lob: 4, smash: 1, speed: 1, stamina: -4, strength: -5 },
  },
  lobber: {
    label: 'Contreur',
    profile: { homeDepth: 7.6, volleyPref: -0.4, glassPref: 0.5, overheadPref: 0, lobRate: 0.7, dropRate: 0.06, powerBias: -0.05 },
    attrs: { drive: 1, lob: 9, smash: -5, speed: 1, stamina: 3, strength: -6 },
  },
};

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Crée une fiche joueur.
 * @param {string} name   nom complet
 * @param {number} ovr    note globale visée (0..99)
 * @param {string} style  clé de STYLES
 * @param {object} o      { hand:'R'|'L', side:'L'|'R'|null, short, tweaks:{attr:delta} }
 */
export function makeNpc(name, ovr, style = 'allround', o = {}) {
  const st = STYLES[style] || STYLES.allround;
  const attrs = {};
  for (const id of ATTR_IDS) attrs[id] = Math.max(15, Math.min(99, Math.round(ovr + (st.attrs[id] || 0) + (o.tweaks?.[id] || 0))));
  const parts = name.trim().split(' ');
  return {
    id: slug(name), name, short: (o.short || parts[parts.length - 1]).toUpperCase(),
    ovr, style, hand: o.hand || 'R', side: o.side || null, attrs,
    kind: o.kind || 'generic', note: o.note || '',
    power: o.power || 1, look: o.look || null, pairWith: o.pairWith || null, taunts: o.taunts || null, regular: !!o.regular, fickle: !!o.fickle, rising: !!o.rising,
  };
}

// ------------------------------------------------------------------ paires professionnelles
const pro = (name, ovr, style, o = {}) => makeNpc(name, ovr, style, { ...o, kind: 'pro' });

export const PRO_PAIRS = [
  {
    id: 'coello-tapia', verified: true,
    players: [
      pro('Arturo Coello', 97, 'smasher', { hand: 'L', side: 'R', look: { height: 1.07, buildId: 'athletic', skin: 0xeec4a2, hair: 0x2e1c10, hairStyle: 'short', beard: 'stubble', headwear: 'none' },  tweaks: { drive: 2, speed: 2 }, note: 'Gaucher, joue à droite : smash dévastateur et coup droit au centre.' }),
      pro('Agustín Tapia', 98, 'magician', { side: 'L', look: { height: 1.0, buildId: 'athletic', skin: 0xd9a47c, hair: 0x17100b, hairStyle: 'curly', beard: 'stubble', headwear: 'none' },  tweaks: { smash: 4, strength: 4 }, note: 'Joueur de gauche créatif et spectaculaire, capable de finir de partout.' }),
    ],
  },
  {
    id: 'galan-chingotto', verified: true,
    players: [
      pro('Alejandro Galán', 96, 'allround', { side: 'L', look: { height: 1.03, buildId: 'athletic', skin: 0xeac09a, hair: 0x2e1c10, hairStyle: 'curly', beard: 'beard', headwear: 'none' },  tweaks: { smash: 3, speed: 2 }, note: 'Joueur de gauche très athlétique, puissant et complet.' }),
      pro('Federico Chingotto', 94, 'defender', { side: 'R', look: { height: 0.95, buildId: 'athletic', skin: 0xeac09a, hair: 0x17100b, hairStyle: 'short', beard: 'stubble', headwear: 'none' },  tweaks: { speed: 3, drive: 2, smash: 2 }, note: 'Joueur de droite : défense, vitesse et régularité exceptionnelles.' }),
    ],
  },
  {
    id: 'lebron-stupaczuk',
    players: [
      pro('Juan Lebrón', 93, 'attacker', { side: 'R', tweaks: { smash: 2 }, note: 'Joueur de droite explosif et offensif.' }),
      pro('Franco Stupaczuk', 93, 'allround', { side: 'L', tweaks: { strength: 2 }, note: 'Joueur de gauche solide et puissant.' }),
    ],
  },
  {
    id: 'navarro-bergamini',
    players: [
      pro('Paquito Navarro', 90, 'magician', { side: 'L', short: 'Navarro', note: 'Créatif et imprévisible.' }),
      pro('Lucas Bergamini', 87, 'defender', { side: 'R', note: 'Joueur de droite régulier.' }),
    ],
  },
  {
    id: 'dinenno-tello',
    players: [
      pro('Martín Di Nenno', 90, 'defender', { side: 'R', short: 'Di Nenno', note: 'Joueur de droite très sûr.' }),
      pro('Juan Tello', 88, 'smasher', { side: 'L', note: 'Joueur de gauche puissant.' }),
    ],
  },
  {
    id: 'yanguas-nieto',
    players: [
      pro('Mike Yanguas', 89, 'attacker', { note: 'Offensif, bon volleyeur.' }),
      pro('Coki Nieto', 88, 'defender', { note: 'Régulier et rapide.' }),
    ],
  },
  {
    id: 'cardona-augsburger',
    players: [
      pro('Pablo Cardona', 87, 'attacker', { hand: 'L', side: 'R', note: 'Gaucher offensif.' }),
      pro('Leo Augsburger', 88, 'smasher', { side: 'L', note: 'Gros frappeur.' }),
    ],
  },
  {
    id: 'sanz-gonzalez',
    players: [
      pro('Jon Sanz', 86, 'attacker', { note: 'Spectaculaire au filet.' }),
      pro('Momo González', 86, 'allround', { short: 'González', note: 'Complet.' }),
    ],
  },
];

// ------------------------------------------------------------------ célébrités
// tiers : paliers où la célébrité peut apparaître dans un tableau.
// venues : lieux où la célébrité joue (aucun = partout).
const celeb = (name, ovr, style, tiers, o = {}) => ({ ...makeNpc(name, ovr, style, { ...o, kind: 'celebrity' }), tiers, venues: o.venues || null, hidden: !!o.hidden });

// look : traits approximatifs (taille, carrure, teint, coiffure, barbe, accessoire), sans
// recherche de ressemblance fidèle. pairWith : partenaire habituel (ils s'inscrivent ensemble).
const SK = { fair: 0xf6d3b3, light: 0xeac09a, tan: 0xd9a47c, olive: 0xc99069, brown: 0xa8714b, dark: 0x6e4529, deep: 0x55341f };
const HC = { black: 0x17100b, dark: 0x2e1c10, brown: 0x4a2e19, chestnut: 0x7a5232, grey: 0x8f8f8f };

export const CELEBRITIES = [
  // --- niveau amateur / tournois locaux
  celeb('Philippe Lacheau', 33, 'allround', ['amateur'], { note: 'Joue pour le plaisir dans les tournois de club.', look: { skin: SK.light, hair: HC.brown, hairStyle: 'short', beard: 'stubble', buildId: 'normal' } }),
  celeb('Eliott Hanras', 30, 'allround', ['amateur'], {
    regular: true, tweaks: { stamina: 14, strength: 6, speed: 3, drive: -4, lob: -4, smash: -2 },
    note: 'Un vrai guignol, troubadour du club : drôle, pas très fort, mais musclé (il va à la salle) et increvable.',
    taunts: [
      'Eliott Hanras : « Bonjour bonjour ! Aujourd\'hui, spectacle ET padel. Surtout spectacle. »',
      'Eliott Hanras : « J\'ai fait jambes ce matin à la salle. Je cours, mais je souffre. »',
      'Eliott Hanras : « Si je perds, je vous chante une chanson. Si je gagne aussi. »',
    ],
    look: { skin: SK.light, hair: 0x6e4a2c, hairStyle: 'curtain', beard: 'none', buildId: 'athletic', height: 1.01, headwear: 'none' , stance: { crouch: 1.0, bounce: 1.6, stride: 1.1, tempo: 1.12, back: 1.2, finish: 1.3, twist: 1.2, sway: 0.08 } },
  }),
  celeb('Rafael Tomatis', 50, 'attacker', ['amateur', 'regional'], {
    short: 'TOMATIS', regular: true, hand: 'L', fickle: true,
    note: 'Rafael « Raf » Tomatis. Vantard : « invaincu au club depuis des années ». Change de partenaire après chaque défaite (« c\'était sa faute »).',
    tweaks: { smash: 6, stamina: -6, lob: -5 },
    taunts: [
      'Raf Tomatis : « Je vous laisse un jeu par set, par politesse. »',
      'Raf Tomatis : « J\'ai déjà réservé la photo avec le trophée. »',
      'Raf Tomatis : « Regarde bien mes smashs, ça te fera une leçon gratuite. »',
      'Raf Tomatis : « Vingt minutes. Chrono. Après je vais à l\'apéro. »',
      'Raf Tomatis : « Nouveau partenaire cette semaine. L\'ancien me faisait perdre. »',
      'Raf Tomatis : « Si on perd, ce sera la faute de mon partenaire. Il le sait. »',
    ],
    look: { skin: 0xe8bf9c, hair: 0x2a1a10, eye: 0x4a3322, hairStyle: 'buzz', beard: 'none', buildId: 'normal', height: 1.02, headwear: 'cap', capColor: 0xa99d86, capPatch: true, jersey: 'tee', shirtHex: 0xf6f6f3, accentHex: 0xdedede, shortsHex: 0xb9a68a, tattoo: true, watch: true , stance: { crouch: 0.9, lean: 0.02, bounce: 1.4, stride: 1.25, tempo: 1.05, back: 1.4, finish: 1.45, twist: 1.35, sway: 0.06, racketH: 0.1 } },
  }),
  // le maire de Ceyreste ne joue que chez lui, à Ceyreste (il s'inscrit à tous les tournois de la commune)
  celeb('Le Maire de Ceyreste', 44, 'lobber', ['amateur', 'regional'], { short: 'Maire', venues: ['ceyreste'], regular: true, tweaks: { speed: -8, stamina: -10, lob: 8, drive: 2 }, taunts: ['Le Maire de Ceyreste : « Ici, c\'est chez moi. Et chez moi, on lobe. »', 'Le Maire de Ceyreste : « J\'ai voté le budget du court. Je connais chaque rebond. »'], note: 'Joue uniquement à Ceyreste. Lent mais malin : il lobe tout, et le public est avec lui.', look: { skin: 0xe3b292, hair: 0x5a4030, eye: 0x6f8fa8, hairStyle: 'shaved', beard: 'goatee', buildId: 'heavy', height: 1.0, headwear: 'none', jersey: 'om', shirtHex: 0x4fd3d6, accentHex: 0x1f5fd6, shortsHex: 0x5cc8cc, sash: true, nose: 1.1, chin: 1.15, stance: { crouch: 0.6, lean: -0.04, bounce: 0.5, stride: 0.85, tempo: 0.85, back: 0.9, finish: 1.1, twist: 0.8 } } }),
  celeb('Jean Deuxbé', 41, 'allround', ['amateur', 'regional'], { hand: 'L', note: 'Le collègue : régulier, jamais avare d\'un lob.', tweaks: { lob: 4 }, look: { skin: 0xebc3a0, hair: 0x6e4e30, eye: 0x5a3b22, hairStyle: 'quiff', beard: 'pencil', buildId: 'fine', height: 1.04, headwear: 'none', jersey: 'bastia', shirtHex: 0xe8433f, accentHex: 0xf4f4f4, shortsHex: 0x1b2f8f, watch: true , stance: { crouch: 1.05, lean: 0.06, bounce: 0.8, stride: 0.95, back: 0.9, finish: 1.2, twist: 0.95 } } }),

  // --- niveau intermédiaire / avancé
  celeb('Nathan Subrero', 67, 'smasher', ['regional'], { power: 1.12, tweaks: { strength: 9, smash: 5, speed: 4, stamina: 6, lob: -5, drive: 1 }, note: 'À peine meilleur que Camille Roy. Pas très grand mais costaud, frappe fort, et ne tient pas en place : hyperactif, il sautille entre chaque point.', taunts: ['Nathan Subrero : « Allez allez allez, on joue ? On joue ! »', 'Nathan Subrero : « J\'ai bu trois cafés, je suis prêt. »'], look: { skin: SK.light, hair: 0x2a1a10, hairStyle: 'fade', beard: 'stubble', height: 0.94, buildId: 'muscular', headwear: 'none', chin: 1.1, stance: { crouch: 1.35, bounce: 1.8, tempo: 1.35, stride: 1.1, wide: 0.05, back: 1.2, finish: 1.15, twist: 1.2, sway: 0.03 } } }),
  celeb('Camille Roy', 63, 'allround', ['regional'], { pairWith: 'timeo-boulhol', side: 'L', rising: true, tweaks: { drive: 7, smash: 8, strength: 4, lob: 3, stamina: -15, speed: -3 }, note: 'Nonchalant. Tennisman à la base (classé 5/6) et ça se voit : bonne main, belle technique, peu de cardio. Grâce à sa taille, il sort facilement les balles par 3. Joue à gauche.', look: { skin: SK.fair, hair: 0xa33a1c, hairStyle: 'short', beard: 'none', height: 1.09, buildId: 'fine', headwear: 'none' , stance: { oneHand: true, crouch: 0.45, lean: -0.03, bounce: 0.4, stride: 0.85, tempo: 0.88, back: 1.05, finish: 1.15, twist: 0.9, racketH: -0.12, sway: 0.0 } } }),
  celeb('Timéo Boulhol', 61, 'defender', ['regional'], { pairWith: 'camille-roy', side: 'R', rising: true, tweaks: { stamina: 10, drive: 3, lob: 3, smash: -3, strength: -3 }, note: 'Le partenaire de Camille Roy, à droite : beaucoup de cardio, très régulier, joue la sécurité.', look: { skin: SK.light, hair: 0x6b4a2e, hairStyle: 'surfer', beard: 'none', height: 1.0, buildId: 'normal', headwear: 'none' , stance: { crouch: 1.3, lean: 0.12, bounce: 1.3, stride: 1.0, tempo: 1.1, back: 0.8, finish: 0.85, twist: 0.85, racketH: 0.06, racketOut: 0.05, wide: 0.04 } } }),
  celeb('Domingo', 50, 'lobber', ['regional'], { pairWith: 'xari', note: 'Patient, renvoie tout. Joue souvent avec Xari (Team PAX).', look: { skin: SK.light, hair: HC.dark, hairStyle: 'short', beard: 'beard', headwear: 'cap' } }),
  celeb('Xari', 49, 'attacker', ['regional'], { pairWith: 'domingo', note: 'Partenaire habituel de Domingo (Team PAX).', look: { skin: SK.light, hair: HC.brown, hairStyle: 'short', beard: 'stubble' } }),
  celeb('Didier Deschamps', 54, 'defender', ['regional'], { tweaks: { lob: 3 }, note: 'Tactique et rigoureux.', look: { skin: SK.light, hair: HC.grey, hairStyle: 'short', beard: 'none' } }),
  celeb('Esteban Ocon', 57, 'allround', ['regional'], { tweaks: { speed: 3, stamina: 4 }, note: 'Bons réflexes, bonne condition.', look: { skin: SK.light, hair: HC.brown, hairStyle: 'short', height: 1.04 } }),
  celeb('Teddy Riner', 52, 'smasher', ['regional'], { power: 1.22, tweaks: { strength: 30, smash: 6, speed: -8, lob: -6 }, note: 'Une force colossale : chaque frappe part comme un boulet. Moins mobile.', look: { skin: SK.deep, hair: HC.black, hairStyle: 'shaved', beard: 'stubble', height: 1.15, buildId: 'huge', chin: 1.3, nose: 1.1 , stance: { crouch: 0.85, wide: 0.06, bounce: 0.6, stride: 0.9, tempo: 0.9, back: 1.35, finish: 1.2, twist: 1.3 } } }),
  celeb('Patrick Vieira', 58, 'defender', ['regional'], { note: 'Grand compas, solide.', look: { skin: SK.dark, hair: HC.black, hairStyle: 'bald', height: 1.09, buildId: 'athletic' } }),
  celeb('Steve Mandanda', 60, 'defender', ['regional', 'national'], { tweaks: { speed: -2, lob: 2 }, note: 'Réflexes de gardien, solide en défense.', look: { skin: SK.dark, hair: HC.black, hairStyle: 'buzz', height: 1.06, buildId: 'athletic' } }),
  celeb('Maxime Gonalons', 60, 'allround', ['regional', 'national'], { note: 'Régulier, au classement des célébrités.', look: { skin: SK.light, hair: HC.dark, hairStyle: 'short', beard: 'beard' } }),
  celeb('Christophe Jallet', 61, 'defender', ['regional', 'national'], { note: 'Au classement des célébrités du padel.', look: { skin: SK.light, hair: HC.dark, hairStyle: 'buzz', beard: 'stubble' } }),
  celeb('Sébastien Squillaci', 62, 'defender', ['national'], { note: 'Ancien défenseur, sérieux.', look: { skin: SK.light, hair: HC.dark, hairStyle: 'buzz' } }),
  celeb('Benoît Cheyrou', 63, 'allround', ['national'], { note: 'Au classement des célébrités du padel.', look: { skin: SK.light, hair: HC.brown, hairStyle: 'short', beard: 'stubble' } }),
  celeb('Robert Pires', 63, 'allround', ['regional', 'national'], { note: 'Propre techniquement.', look: { skin: SK.olive, hair: HC.dark, hairStyle: 'long', beard: 'stubble' } }),
  celeb('Fabien Lemoine', 64, 'attacker', ['national'], { note: 'Au classement des célébrités du padel.', look: { skin: SK.light, hair: HC.dark, hairStyle: 'buzz', beard: 'beard' } }),
  celeb('Stéphane Ruffier', 72, 'defender', ['national'], { tweaks: { speed: 4, lob: 4, stamina: 4 }, note: 'Ancien gardien de Saint-Étienne reconverti dans le padel : réflexes de gardien, lit tout, défend tout.', look: { skin: SK.light, hair: HC.dark, hairStyle: 'short', beard: 'stubble', height: 1.07, buildId: 'athletic', headwear: 'none' } }),
  celeb('Dimitri Payet', 65, 'magician', ['national'], { note: 'Toucher de balle, amorties.', look: { skin: SK.brown, hair: HC.black, hairStyle: 'curly', beard: 'beard', buildId: 'stocky' } }),
  celeb('Louka', 40, 'attacker', [], { note: 'Le joueur blessé dont tu as pris la place.', look: { skin: SK.fair, hair: 0x2a1a10, eye: 0x6f8a6a, hairStyle: 'curly', beard: 'pencil', height: 1.02, buildId: 'normal', headwear: 'none', chin: 1.1, nose: 1.05, number: 91, shirtHex: 0x7b5cd6, accentHex: 0xffffff, shortsHex: 0x15161a } }),
  celeb('Samir Nasri', 66, 'magician', ['national'], { note: 'Technique et malin.', look: { skin: SK.olive, hair: HC.black, hairStyle: 'short', beard: 'beard', height: 0.97 } }),
  celeb('Clément Grenier', 66, 'magician', ['national'], { note: 'Au classement des célébrités du padel.', look: { skin: SK.light, hair: HC.dark, hairStyle: 'quiff', beard: 'stubble' } }),
  celeb('Carles Puyol', 66, 'defender', ['national'], { tweaks: { stamina: 4 }, note: 'Ne lâche aucune balle.', look: { skin: SK.light, hair: HC.brown, hairStyle: 'longcurly', beard: 'stubble', buildId: 'athletic' } }),
  celeb('Lionel Messi', 68, 'magician', ['national'], { tweaks: { speed: 3 }, note: 'Toucher et vision du jeu.', look: { skin: SK.light, hair: HC.dark, hairStyle: 'short', beard: 'full', height: 0.93 } }),
  celeb('Zinedine Zidane', 69, 'magician', ['national'], { tweaks: { lob: 2 }, note: 'Grand fan de padel, élégance et sens du jeu.', look: { skin: SK.light, hair: HC.dark, hairStyle: 'shaved', beard: 'stubble', height: 1.04 } }),
  celeb('Jérémy Menez', 70, 'magician', ['national'], { note: 'Parmi les meilleures célébrités françaises.', look: { skin: SK.tan, hair: HC.black, hairStyle: 'short', beard: 'beard' } }),
  celeb('Gerard Piqué', 70, 'smasher', ['national'], { tweaks: { speed: -2 }, note: 'Grand gabarit, dangereux au smash.', look: { skin: SK.light, hair: HC.dark, hairStyle: 'quiff', beard: 'stubble', height: 1.1, buildId: 'athletic' } }),
  celeb('Zlatan Ibrahimović', 71, 'smasher', ['national'], { tweaks: { strength: 6 }, note: 'Ambassadeur du padel, propriétaire de centres.', look: { skin: SK.tan, hair: HC.black, hairStyle: 'bun', beard: 'beard', height: 1.1, buildId: 'athletic' } }),

  // --- niveau pro / haut de tableau
  celeb('Cyril Hanouna', 81, 'attacker', ['national', 'pro'], { note: 'Très bon niveau (autour du top 500 français).', look: { skin: SK.tan, hair: HC.black, hairStyle: 'short', beard: 'stubble', buildId: 'normal' } }),
  celeb('Hatem Ben Arfa', 80, 'magician', ['national', 'pro'], { note: 'Redoutable techniquement.', look: { skin: SK.brown, hair: HC.black, hairStyle: 'buzz', beard: 'beard' } }),
  celeb('Romain Sichez', 82, 'allround', ['national', 'pro'], { note: 'Ancien joueur de tennis devenu joueur de padel.', look: { skin: SK.light, hair: HC.brown, hairStyle: 'short', beard: 'stubble', buildId: 'athletic' } }),
  celeb('Rafael Nadal', 85, 'allround', ['national', 'pro'], { hand: 'L', tweaks: { stamina: 8, strength: 5, lob: 3 }, note: 'Très fort tactiquement et physiquement.', power: 1.08, look: { skin: 0xc68a5e, hair: 0x2a1a10, eye: 0x3a2412, hairStyle: 'surfer', beard: 'stubble', headwear: 'bandana', buildId: 'muscular', height: 1.04, chin: 1.2, nose: 1.25 , stance: { crouch: 1.25, bounce: 1.3, tempo: 1.1, back: 1.2, finish: 1.4, twist: 1.3, lean: 0.08 } } }),
];

// Tenues des personnalités : le maillot de leur club (ou sélection) et leur numéro.
const KITS_OF = {
  'dimitri-payet': { jersey: 'om', shirtHex: 0xf6f6f3, accentHex: 0x2faee0, shortsHex: 0xf6f6f3, number: 10 },
  'steve-mandanda': { jersey: 'om', shirtHex: 0xf6f6f3, accentHex: 0x2faee0, shortsHex: 0xf6f6f3, number: 30 },
  'samir-nasri': { jersey: 'om', shirtHex: 0xf6f6f3, accentHex: 0x2faee0, shortsHex: 0xf6f6f3, number: 22 },
  'benoit-cheyrou': { jersey: 'om', shirtHex: 0xf6f6f3, accentHex: 0x2faee0, shortsHex: 0xf6f6f3, number: 7 },
  'sebastien-squillaci': { jersey: 'om', shirtHex: 0xf6f6f3, accentHex: 0x2faee0, shortsHex: 0xf6f6f3, number: 4 },
  'lionel-messi': { jersey: 'fcb', kitStyle: 'stripes', shirtHex: 0x004d98, accentHex: 0xa50044, shortsHex: 0x004d98, number: 10 },
  'carles-puyol': { jersey: 'fcb', kitStyle: 'stripes', shirtHex: 0x004d98, accentHex: 0xa50044, shortsHex: 0x004d98, number: 5 },
  'gerard-pique': { jersey: 'fcb', kitStyle: 'stripes', shirtHex: 0x004d98, accentHex: 0xa50044, shortsHex: 0x004d98, number: 3 },
  'zinedine-zidane': { jersey: 'fra', shirtHex: 0x1d2f6f, accentHex: 0xffffff, shortsHex: 0xffffff, number: 10 },
  'didier-deschamps': { jersey: 'fra', shirtHex: 0x1d2f6f, accentHex: 0xffffff, shortsHex: 0xffffff, number: 7 },
  'teddy-riner': { jersey: 'fra', shirtHex: 0x1d2f6f, accentHex: 0xe53935, shortsHex: 0x1d2f6f, number: 1 },
  'zlatan-ibrahimovic': { jersey: 'psg', kitStyle: 'half', shirtHex: 0x0b1f4d, accentHex: 0xd7262e, shortsHex: 0x0b1f4d, number: 10 },
  'jeremy-menez': { jersey: 'psg', kitStyle: 'half', shirtHex: 0x0b1f4d, accentHex: 0xd7262e, shortsHex: 0x0b1f4d, number: 7 },
  'christophe-jallet': { jersey: 'psg', kitStyle: 'half', shirtHex: 0x0b1f4d, accentHex: 0xd7262e, shortsHex: 0x0b1f4d, number: 26 },
  'maxime-gonalons': { jersey: 'ol', shirtHex: 0xf6f6f3, accentHex: 0x1d3f8f, shortsHex: 0xf6f6f3, number: 21 },
  'clement-grenier': { jersey: 'ol', shirtHex: 0xf6f6f3, accentHex: 0x1d3f8f, shortsHex: 0xf6f6f3, number: 7 },
  'robert-pires': { jersey: 'ars', kitStyle: 'shoulders', shirtHex: 0xdb0007, accentHex: 0xffffff, shortsHex: 0xffffff, number: 7 },
  'patrick-vieira': { jersey: 'ars', kitStyle: 'shoulders', shirtHex: 0xdb0007, accentHex: 0xffffff, shortsHex: 0xffffff, number: 4 },
  'stephane-ruffier': { jersey: 'asse', shirtHex: 0x0a7a3e, accentHex: 0xffffff, shortsHex: 0xffffff, number: 16 },
  'fabien-lemoine': { jersey: 'asse', shirtHex: 0x0a7a3e, accentHex: 0xffffff, shortsHex: 0xffffff, number: 28 },
  'hatem-ben-arfa': { jersey: 'nufc', kitStyle: 'stripes', shirtHex: 0xf6f6f3, accentHex: 0x111111, shortsHex: 0x111111, number: 10 },
  'esteban-ocon': { jersey: 'tee', shirtHex: 0x0a5bd8, accentHex: 0xff69b4, shortsHex: 0x0b1a33, number: 31 },
};
for (const c of CELEBRITIES) if (KITS_OF[c.id]) c.look = { ...(c.look || {}), kitStyle: 'tech', ...KITS_OF[c.id] };


/** L'entraîneur des séances d'entraînement (fictif). */
export const COACH = makeNpc('Coach Roméo', 55, 'allround', { short: 'ROMÉO', look: { skin: SK.light, hair: 0x15100c, hairStyle: 'bun', beard: 'moustache', buildId: 'athletic', height: 1.03, headwear: 'cap', capColor: 0x1c2733, shirtHex: 0x1c2733, accentHex: 0x1c2733, shortsHex: 0x111418 } });

// ------------------------------------------------------------------ joueurs génériques (fictifs)
const FIRST = ['Léo', 'Hugo', 'Nathan', 'Enzo', 'Lucas', 'Théo', 'Maxime', 'Julien', 'Antoine', 'Romain', 'Kévin', 'Bastien', 'Clément', 'Adrien', 'Mathis', 'Yanis', 'Sami', 'Karim', 'Diego', 'Pablo', 'Marco', 'Luca', 'Tomás', 'Iker', 'Nuno', 'Rui', 'Jonas', 'Erik', 'Oscar', 'Milan'];
const LAST = ['Moreau', 'Lefèvre', 'Garnier', 'Roussel', 'Fontaine', 'Chevalier', 'Marchand', 'Perrin', 'Renard', 'Gaillard', 'Besson', 'Colin', 'Aubert', 'Vidal', 'Carpentier', 'Benali', 'Haddad', 'Ferreira', 'Santos', 'Costa', 'Romero', 'Navas', 'Ortega', 'Serrano', 'Rossi', 'Conti', 'Lindqvist', 'Novak', 'Keller', 'Dupré'];
const STYLE_KEYS = Object.keys(STYLES);

/** Joueur fictif reproductible à partir d'un générateur aléatoire. */
export function genericNpc(rand, ovr) {
  const first = FIRST[Math.floor(rand() * FIRST.length)];
  const last = LAST[Math.floor(rand() * LAST.length)];
  const style = STYLE_KEYS[Math.floor(rand() * STYLE_KEYS.length)];
  return makeNpc(`${first} ${last}`, Math.round(ovr), style, { hand: rand() < 0.14 ? 'L' : 'R' });
}

/** Note moyenne d'une paire. */
export const pairOvr = (players) => Math.round(players.reduce((s, p) => s + p.ovr, 0) / players.length);

// Le maire de Ceyreste : il remet les trophées avant les finales jouées au club (cinématiques).
export const MAYOR_LOOK = {
  skin: 0xe3b292, hair: 0x5a4030, eye: 0x6f8fa8, hairStyle: 'shaved', beard: 'goatee', buildId: 'heavy', height: 1.0, headwear: 'none',
  jersey: 'om', shirtHex: 0x4fd3d6, accentHex: 0x1f5fd6, shortsHex: 0x5cc8cc, sash: true, nose: 1.1, chin: 1.15,
};

// Progression des joueurs « montants » (Camille Roy, Timéo Boulhol) : points de note gagnés
// selon leurs résultats dans la carrière. Rempli par Career (sauvegardé avec elle).
export const GROWTH = {};
export const NATIONAL_AT = 65;

/** Personnalités avec leur progression : note et attributs ajustés, accès au national. */
export function grownCelebs() {
  return CELEBRITIES.map((c) => {
    const g = Math.round(GROWTH[c.id] || 0);
    if (!g) return c;
    const ovr = Math.min(85, c.ovr + g);
    const attrs = Object.fromEntries(Object.entries(c.attrs).map(([k, v]) => [k, Math.max(15, Math.min(99, v + g))]));
    const tiers = c.rising && ovr >= NATIONAL_AT ? [...new Set([...c.tiers, 'national'])] : c.tiers;
    return { ...c, ovr, attrs, tiers };
  });
}

// Répliques en cours de match (bulle, sans interrompre le jeu)
export const CHATTER = {
  'rafael-tomatis': {
    great: [
      'POR TRES ! Quelqu\'un filme ? Dites-moi que quelqu\'un filme !',
      'Ça, c\'est du Raf. Encadrez-le.',
      'Coello, si tu regardes : appelle-moi.',
      'Trop fort. Je suis trop fort. C\'est un problème.',
      'Tu l\'as vue passer ? Non ? Normal.',
      'Signature move. Déposé à l\'INPI.',
      'Celle-là, je la mets dans mon CV.',
      'Vous avez vu ça ? Moi oui. Trois fois, au ralenti, dans ma tête.',
      'Hors de la piste ! Comme ma carrière : hors normes.',
      'On applaudit, on applaudit, je ne suis pas pressé.',
      'J\'ai un contrat chez une marque de raquettes. Enfin, bientôt.',
      'Même mon partenaire est impressionné. Hein, partenaire ?',
    ],
    won: ['Facile.', 'Je m\'échauffe encore, hein.', 'Tu sens la pression ?', 'Encore un pour la collection.', 'Note ça quelque part, c\'est éducatif.', 'Tranquille. Je joue à 40 %.', 'Tu veux que je te montre au ralenti ?', 'Ça, c\'est l\'expérience.', 'Le patron est dans la place.'],
    ace: ['Normal, j\'étais pas prêt.', 'Attends, j\'étais pas prêt là !', 'Celle-là ne compte pas, je regardais ailleurs.', 'Tu sers avant que je sois en place, c\'est facile.'],
    lost: ['Le vent ! Il y a du vent, là !', 'Partenaire, tu étais où ?!', 'Elle était dehors. Je l\'ai vue dehors.', 'Mon cordage a lâché. Enfin, presque.', 'Le soleil ! J\'avais le soleil dans les yeux.', 'Coup de chance. Pur coup de chance.', 'Je te l\'ai laissé, par politesse.', 'Ce terrain est penché, j\'en suis sûr.', 'C\'est mes chaussures. Elles glissent.', 'Tu m\'as déconcentré avec ton t-shirt.'],
  },
  'timeo-boulhol': {
    // Timéo crie (et devient tout rouge) quand il rate
    miss: ['AAAAAAH !', 'NOOOON ! Mais c\'est pas possible !', 'RAAAH ! Je l\'avais !', 'MAIS QU\'EST-CE QUE JE FAIS ?!', 'Pfff… AAARGH !', 'Elle était FACILE celle-là !'],
    won: ['Ouais !', 'Allez !', 'Vamos !'],
  },
  'eliott-hanras': {
    great: ['Mesdames et messieurs, l\'artiste vous salue ! *révérence*', 'Ce coup-là, je l\'ai appris dans un rêve.', 'Applaudissez, c\'est gratuit !'],
    won: ['Tralala, un point pour le troubadour !', 'Encore un et je vous chante une chanson.', 'La-la-la, je suis là !'],
    lost: ['Aïe ! Bon, je vous laisse celui-là, je suis généreux.', 'Ce n\'était pas une faute, c\'était de l\'art moderne.', 'Pas grave, je vais faire des pompes.'],
  },
};
