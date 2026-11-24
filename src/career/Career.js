// ============================================================================
//  Mode carrière : état du joueur, sauvegarde, boucle de progression.
//
//  Boucle :  hub  ->  choisir un tournoi de la semaine (ou s'entraîner)
//            ->  tableau : jouer ses matchs tour après tour
//            ->  récompenses (XP, points de compétence, dotation, points de classement)
//            ->  semaine suivante ; les points de classement expirent après une saison
//            ->  le classement débloque les paliers : amateur > régional > national > mondial
//
//  Ce module ne touche ni au DOM ni au moteur 3D : il est testable dans Node.
//  `storage` est un objet de type localStorage (getItem / setItem / removeItem).
// ============================================================================
import { ATTR_IDS, START_VALUE, START_POINTS, MAX_VALUE, overall, upgradeCost, toStats, xpForLevel, REWARDS } from './data/attributes.js';
import { TIERS, TOURNAMENTS, tierById, tierIndex, ROUND_SHARE, SEASON_WEEKS, pointsAtRank, rankForPoints, rankForOvr, UNRANKED, MATCH_FORMATS, FORMAT_CHOICES, DEFAULT_FORMATS } from './data/circuit.js';
import { advanceStory } from './Story.js';
import { extras } from '../entities/Appearance.js';
import { DECOS, STAFF, CLUB, freshClub, clubIncome, clubTournament, hostRevenue } from './Business.js';
import { MISSION_CHARS, findCharacter } from './Characters.js';
import { trophySpec } from '../entities/Trophy.js';
import { MAYOR_LOOK, GROWTH, grownCelebs, CHATTER } from './data/roster.js';
import { PRO_PAIRS, CELEBRITIES, STYLES, COACH, genericNpc, makeNpc } from './data/roster.js';
import { createTournament, playerMatch, reportPlayerResult, roundName, totalRounds, winProbability } from './Tournament.js';
import { pickMission, liveMission, missionDone } from './data/missions.js';
import { SHOP_ITEMS, FREE_ITEMS, SHOP_REWARDS, TEST_UNLOCK_ALL_VENUES, itemById, isUnlocked, advUnlocks } from './data/shop.js';
import { DRILLS, DRILL_IDS } from '../core/Drills.js';
import { makeAppearance, resolveLook, rackById, bagById, DEFAULT_LOOK as LOOK0, KITS, rng } from '../entities/Appearance.js';
import { botDiffFromRating } from '../config.js';

const KEY = 'padel-arena.career';
const VERSION = 2;
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export const DEFAULT_LOOK = { ...LOOK0 };

/** Joueur non humain -> fiche de match (apparence approximative pour les personnalités). */
// Posture et gestes selon le style de jeu (pros et personnalités)
const STANCE_BY_STYLE = {
  smasher: { back: 1.3, finish: 1.3, twist: 1.25, crouch: 1.0, stride: 1.15, racketH: 0.08 },
  defender: { crouch: 1.3, back: 0.85, finish: 0.85, lean: 0.12, wide: 0.05, bounce: 1.2 },
  attacker: { crouch: 0.95, racketH: 0.1, racketOut: 0.06, back: 0.8, finish: 0.9, lean: 0.06 },
  magician: { back: 1.05, finish: 1.2, twist: 1.1, sway: 0.05, tempo: 1.08 },
  lobber: { finish: 1.25, back: 0.9, crouch: 1.05 },
  allround: {},
};

export function npcSpec(npc, kit, lane, idle = false) {
  const base = makeAppearance(kit, hashStr(npc.id), { name: npc.short, female: false, skirt: false });
  let appearance = base;
  if (npc.look) {
    const r = resolveLook({ ...npc.look, primary: 'blue' });
    appearance = { ...base, skin: r.skin, hair: r.hair, hairStyle: r.hairStyle, beard: r.beard, headwear: npc.look.headwear && npc.look.headwear !== 'none' ? r.headwear : null, height: r.height, build: r.build, belly: r.belly, muscle: r.muscle, ...extras(npc.look) };
    appearance.stance = { ...(STANCE_BY_STYLE[npc.style] || {}), ...(npc.look.stance || {}) };
    // tenue personnelle (maillot de club, t-shirt) : on la garde, même en tournoi
    if (npc.look.shirtHex != null) Object.assign(appearance, { shirt: r.shirt, accent: r.accent, shorts: r.shorts });
    if (npc.look.number) appearance.number = npc.look.number;
    if (npc.look.kitStyle) appearance.kitStyle = npc.look.kitStyle;
    if (npc.look.female) Object.assign(appearance, { female: true, curvy: npc.look.curvy || 0 });
  }
  return {
    name: npc.short, hand: npc.hand === 'L' ? -1 : 1, lane, stats: { ...toStats(npc.attrs), power: npc.power || 1 }, appearance, idle,
    bot: { diff: botDiffFromRating(npc.ovr), profile: (STYLES[npc.style] || STYLES.allround).profile },
  };
}

/** Cinématique d'avant-entraînement : le coach présente l'atelier. */
export function drillCutscene(id, myName = 'VOUS') {
  const d = DRILLS[id];
  if (!d) return null;
  const intro = {
    coach: 'On termine par un tie-break, toi contre moi. Et ne compte pas sur moi pour te faire des cadeaux.',
    serve: 'Le service, c\'est le seul coup où personne ne t\'embête. Alors aucune excuse : je veux de la précision.',
    smash: 'Je vais te lober. Toi, tu sors la balle. Par trois, par la porte, peu importe : je veux l\'entendre taper la vitre.',
    wall: 'La contre-vitre. Ça paraît fou, mais quand tu es débordé, c\'est ta vitre qui te sauve. On essaie.',
    precision: 'Échange avec moi, et vise les zones que je t\'indique. La puissance, on verra plus tard.',
    lob: 'Je monte au filet et je n\'en bouge plus. À toi de me lober, bien haut, bien profond.',
    cardio: 'Cardio ! Soixante secondes, tu touches les plots. Et oui, ça va piquer.',
    sprint: 'Des sprints courts entre les plots. Au padel, tout se joue sur les trois premiers pas.',
    chase: 'La machine va sortir des balles du terrain, par la porte ou par-dessus le grillage. Lis la trajectoire, sors du court et renvoie-la depuis dehors. Pas de dedans : de dehors !',
  }[id] || d.desc;
  return [
    { side: -1, label: 'Coach Roméo', text: intro },
    { side: 1, label: myName, text: ['C\'est parti, coach.', 'Facile.', 'Je suis prêt.', 'On y va !'][Math.floor(Math.random() * 4)] },
  ];
}

/** Cinématique d'avant-match contre une personnalité bavarde (Raf Tomatis…). */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Petites scènes d'avant-match variées : président du club, parieur, journaliste, partenaire, adversaires… */
function ambientCutscene(ctx) {
  const { opponents, myName, partner, tier, round, tournament } = ctx;
  const me = (text) => ({ side: 1, label: myName, text });
  const pa = (text) => ({ name: partner.short, label: partner.name, text });
  const off = (label, text) => ({ side: 1, label, text });            // personnage hors champ : on filme le joueur
  const opp = opponents.find((o) => o.kind === 'celebrity') || opponents[0];
  const final = round === 'Finale';
  const scenes = [];
  if (ctx.venue === 'hangar') {
    // scènes propres au hangar : comptoir de la buvette, accueil, habitués croisés dans l'allée
    const hs = [
      [off('Dédé, le barman', pick([
          `Ah, ${myName} ! Je te sers quoi ? Un sirop menthe, comme d'hab ? La bière, c'est après le match.`,
          'Fais gaffe, les lampes du court sont basses. Le mois dernier, un gars a éteint la 3 avec un lob.',
          'Si tu gagnes, la tournée est pour toi. Si tu perds… elle est pour toi aussi.',
        ])),
        off('Un habitué accoudé au comptoir', pick([
          "Moi j'ai joué ici en 2019. J'avais un revers… mais un revers ! Demande à Dédé.",
          'Le court du fond glisse un peu côté buvette. Je dis ça, je dis rien.',
          "Tu montes le son, Dédé ? C'est ma chanson !",
        ])),
        me(pick(['Un sirop, merci Dédé.', 'Je repasse après le match.', 'Noté pour les lampes.']))],
      [off("L'hôtesse d'accueil", pick([
          `Bonjour ${myName} ! Vous êtes sur le court ${1 + Math.floor(Math.random() * 4)}. Vestiaires à droite, et les balles neuves sont au comptoir.`,
          "Bienvenue ! Pensez à signer la feuille de match. Et souriez, l'écran géant filme parfois le public.",
        ])),
        me(pick(['Merci beaucoup !', 'Parfait, on y va.'])),
        pa("Allez, on s'échauffe avant que le court soit pris.")],
      [off('Un joueur qui sort du court', pick([
          'Bonne chance ! Ils servent fort, en face. Visez le grillage, ils détestent ça.',
          'Attention, ça résonne ici : on entend tout ce que tu dis à ton partenaire. Les adversaires aussi.',
          "J'ai perdu 6-0 6-1 sur ce court. Mais il paraît que l'ambiance était top.",
        ])),
        me(pick(['Merci du tuyau.', "On va s'en souvenir.", 'Courage, la prochaine fois.'])),
        pa(pick(["Il a l'air traumatisé.", 'Bon, on y va ?']))],
    ];
    return hs[Math.floor(Math.random() * hs.length)];
  }
  if (tier === 'amateur' || tier === 'regional') {
    scenes.push([
      off('Président du club', pick([
        `Bienvenue au ${tournament} ! Merci d'être venus. Je rappelle que la buvette est ouverte, et que les balles perdues dans le jardin du voisin ne sont pas remboursées.`,
        'Petit mot du président : on compte sur vous pour le spectacle. Et pour ranger les raquettes de location après le match, hein.',
        'Le club est fier de vous accueillir. L\'an dernier, la finale s\'est jouée sous la pluie. Cette année, on a un parasol.',
      ])),
      me(pick(['Merci président, on va tout donner.', 'Promis, on range les raquettes.', 'Avec plaisir !'])),
    ]);
    scenes.push([
      off('Un parieur au bar', pick([
        `J'ai mis vingt euros sur vous, ${myName}. Ne me faites pas regretter mon pastis.`,
        'Psst… J\'ai parié sur l\'autre équipe. Rien de personnel. Mais si vous perdez le premier jeu, je vous offre un café.',
        'La cote est à 3 contre 1 contre vous. Moi j\'y crois. Enfin, un peu.',
      ])),
      me(pick(['On va essayer de vous faire gagner.', 'Gardez votre café, on va gagner.', 'Ne pariez jamais sur un match de padel.'])),
    ]);
    scenes.push([
      off('Jean Deuxbé, dans les tribunes', pick([
        'Allez allez ! Et n\'oublie pas : dans le doute, un lob.',
        'Je suis venu avec toute la boîte ! Enfin, avec Michel de la compta.',
      ])),
      pa('Ton collègue est encore là ?'),
      me('Il ne rate jamais un match.'),
    ]);
  } else {
    scenes.push([
      off('Journaliste TV', pick([
        `${myName}, la presse parle de vous comme de la révélation de la saison. Une pression supplémentaire ?`,
        'On dit que votre paire manque d\'expérience à ce niveau. Que répondez-vous ?',
        `${final ? 'Une finale' : 'Un match'} devant des milliers de spectateurs : comment vous sentez-vous ?`,
      ])),
      me(pick(['La pression, c\'est pour ceux qui ne s\'entraînent pas.', 'On répondra sur le court.', 'Honnêtement ? J\'ai les jambes qui tremblent.'])),
    ]);
    scenes.push([
      off('Un parieur en tribune VIP', pick([
        'Mon bookmaker vous donne perdants. J\'ai doublé la mise sur vous. Ne me ruinez pas.',
        'Si vous gagnez, je vous paie le restaurant. Si vous perdez, je change de joueur préféré.',
      ])),
      me(pick(['Réservez la table.', 'Ça marche.'])),
    ]);
  }
  scenes.push([
    pa(pick([
      'Je prends les balles au centre, toi tu restes patient. On attend la bonne pour finir.',
      'Ils montent beaucoup au filet. Lobe-les, et on récupère le filet.',
      final ? 'Une finale, ça ne se joue pas, ça se gagne.' : 'Un match à la fois. Concentré.',
    ])),
    me(pick(['Ça marche.', 'Compris.', 'Allez, on y va.'])),
  ]);
  if (opp?.kind === 'celebrity' && opp.id !== 'rafael-tomatis') {
    scenes.push([
      { name: opp.short, label: opp.name, text: pick([
        'Je ne suis pas là pour faire de la figuration. On va jouer pour gagner.',
        'Bon match ! Et pas de photo pendant les points, merci.',
        'On m\'a dit que vous jouiez bien. On va voir ça.',
      ]) },
      me(pick(['Bon match à vous aussi.', 'Pareil de notre côté.'])),
    ]);
  }
  // scènes supplémentaires : supporters, coach, enfant, arbitre, partenaire superstitieux
  scenes.push([
    off('Un jeune supporter', pick([
      `${myName} ! Tu peux me signer ma casquette ? Je fais du padel depuis trois semaines, je veux faire comme toi !`,
      'C\'est vrai que tu t\'entraînes tous les jours ? Moi ma mère veut pas que je joue après 20 h.',
    ])),
    me(pick(['Bien sûr, donne-moi ta casquette.', 'Entraîne-toi bien, et écoute ta mère !', 'Allez, dans dix ans c\'est toi qui signes.'])),
  ]);
  scenes.push([
    off('Le coach, au téléphone', pick([
      'Rappelle-toi : split-step à chaque frappe adverse. Et respire entre les points.',
      'Je regarde le match en direct. Pas de smash à 40 % de réussite, hein. Bandeja.',
      'Si tu perds le premier set, on en reparle à l\'entraînement. Longuement.',
    ])),
    me(pick(['Promis coach.', 'Bandeja, compris.', 'Je respire, je respire.'])),
  ]);
  scenes.push([
    pa(pick([
      'J\'ai mis la même paire de chaussettes qu\'au dernier tournoi. On ne change rien.',
      'Attends, je vérifie que j\'ai bien mon grip porte-bonheur… c\'est bon.',
      'Si je fais un geste bizarre entre les points, c\'est normal. C\'est mon rituel.',
    ])),
    me(pick(['Tu es complètement superstitieux.', 'Du moment que ça marche…', 'Moi c\'est la bouteille d\'eau à gauche.'])),
  ]);
  scenes.push([
    off('Le juge-arbitre', pick([
      'Rappel du règlement : point en or à 40-40, et on ne touche pas le filet. Même pour fêter un point.',
      'Échauffement de cinq minutes. Après, on joue. Pas de « encore un smash pour la route ».',
    ])),
    me(pick(['Bien reçu.', 'Pas de souci.'])),
  ]);
  if (tier === 'national' || tier === 'pro') scenes.push([
    off('Un sponsor', pick([
      `Belle saison, ${myName}. Si vous passez ce tour, on parle d\'un contrat de raquette.`,
      'Notre marque cherche une nouvelle tête d\'affiche. Montrez-nous ce que vous valez aujourd\'hui.',
    ])),
    me(pick(['Je vais faire de mon mieux.', 'On en reparle après le match.'])),
  ]);
  return pick(scenes);
}

/** Finale à Ceyreste : le maire (maillot de l'OM, médailles autour du cou) lance la finale. */
function finalCutscene(t, nm, myName, other) {
  if (t.venue !== 'ceyreste' || nm.round !== 'Finale') return { cutscene: other };
  const say = (text) => ({ actor: 'maire', label: 'Le maire de Ceyreste', text });
  const lines = [
    say(pick([
      `Mesdames, messieurs, bienvenue à Ceyreste pour la finale du ${t.name} ! Merci aux bénévoles, à la buvette, et au soleil qui est venu malgré tout.`,
      `Chers amis, quelle fierté d'accueillir la finale du ${t.name} ici, chez nous, entre la mer et les collines !`,
    ])),
    say(pick([
      'Les médailles, je les ai déjà autour du cou : je les garde au chaud pour les vainqueurs. Enfin… on verra si je les rends.',
      'Comme vous le voyez, je suis en tenue officielle. Le maillot de l\'OM, c\'est le dress code de la mairie le week-end.',
      'J\'ai un peu joué au padel aussi, vous savez. Bon, surtout à la buvette, mais j\'ai le coup d\'œil.',
    ])),
    { side: 1, label: myName, text: pick(['Merci monsieur le maire, on va vous offrir une belle finale.', 'Gardez une médaille pour nous !', 'On est prêts.']) },
    say(pick(['Que le meilleur gagne ! Et après le match, apéritif offert par la mairie.', 'Allez, place au jeu ! Et attention aux balles dans le parking, hein.'])),
  ];
  return { cutscene: [...lines, ...(other || []).slice(0, 2)], actors: [{ id: 'maire', side: 1, x: 0.4, z: 3.2, appearance: { ...resolveLook(MAYOR_LOOK), name: 'MAIRE' } }] };
}

// Répliques supplémentaires de Raf avant les matchs
const RAF_EXTRA = [
  'Tu sais combien de tournois j\'ai gagnés ? Moi non plus, j\'ai arrêté de compter.',
  'J\'ai changé de grip ce matin. Ça va être un carnage.',
  'Mon kiné dit que j\'ai les épaules d\'un pro. Bon, il est payé par moi.',
  'Regarde-moi bien au service : je l\'ai vu à la télé, c\'est imparable.',
  'Si tu prends un jeu, je te paie un Orangina. Promis.',
  'J\'ai regardé trois vidéos de Coello cette semaine. Je suis prêt.',
  'Le soleil est dans ton camp ? Parfait, il est de mon côté alors.',
  'Ma raquette coûte plus cher que ta voiture. Je dis ça, je dis rien.',
  'J\'ai mis mon short porte-bonheur. Il n\'a jamais été lavé, d\'ailleurs.',
  'Je joue à 60 % aujourd\'hui. Par respect pour toi.',
  'Tu vois Eliott là-bas ? Lui au moins il sait qu\'il va perdre.',
];

/** Après-match contre Raf : s'il perd, il congédie son partenaire. */
export function rafEndCutscene(opponents, myName) {
  const raf = opponents.find((p) => p.id === 'rafael-tomatis');
  if (!raf) return null;
  const mate = opponents.find((p) => p !== raf);
  const mateName = mate ? mate.short.charAt(0) + mate.short.slice(1).toLowerCase() + ', ' : '';
  return (won) => {
    if (won) {
      return [
        { name: raf.short, label: 'Raf Tomatis', text: pick(['C\'est pas possible… Le filet était trop haut, je te jure.', 'Bon. Il y a des jours sans. Aujourd\'hui c\'était un jour sans… mon partenaire.', 'Attends, attends. On refait le dernier point, j\'étais pas prêt.']) },
        { name: raf.short, label: 'Raf Tomatis', text: mateName + pick(['c\'est la dernière fois que je joue avec toi. La DERNIÈRE.', 'tu peux ranger tes affaires : c\'était notre dernier match ensemble.', 'je t\'aime bien, mais c\'est la dernière fois qu\'on joue ensemble. T\'as tout raté.']) },
        { side: 1, label: myName, text: pick(['Bien joué quand même, Raf.', 'Il a pourtant bien joué, ton partenaire…', 'À la prochaine, Raf. Avec un autre partenaire, donc.']) },
      ];
    }
    return [
      { name: raf.short, label: 'Raf Tomatis', text: pick(['HAHA ! Qui c\'est le patron ? Qui c\'est ?', 'Je te l\'avais dit. Vingt minutes. Bon, quarante. Mais je te l\'avais dit.', 'Tu veux un autographe ? Je signe aussi les raquettes.']) },
      { side: 1, label: myName, text: pick(['Profite, Raf. Ça n\'arrivera pas souvent.', 'On se retrouvera.', 'Bien joué… je suppose.']) },
    ];
  };
}

export function matchCutscene(opponents, myName, partner, stats, ctx = {}) {
  const raf = opponents.find((p) => p.id === 'rafael-tomatis');
  const eli = opponents.find((p) => p.id === 'eliott-hanras');
  if (!raf && eli) return [
    { name: eli.short, label: 'Eliott Hanras', text: (eli.taunts || ['Bonjour !'])[Math.floor(Math.random() * (eli.taunts?.length || 1))].replace(/^Eliott Hanras : « |»$/g, '').trim() },
    { side: 1, label: myName, text: pick(['On est là pour jouer, Eliott.', 'Chante pas trop pendant les points, hein.', 'Toujours en forme, toi.']) },
    { name: eli.short, label: 'Eliott Hanras', text: pick(['Que le spectacle commence ! Tadaaa !', 'Promis, je chante seulement entre les jeux.', 'Et un, et deux, et trois… padel !']) },
  ];
  if (!raf) return (ctx.venue === 'hangar' || Math.random() < 0.6) ? ambientCutscene({ opponents, myName, partner, ...ctx }) : null;
  const mate = opponents.find((p) => p !== raf);
  const lines = [
    { name: raf.short, label: 'Raf Tomatis', text: (raf.taunts || ['Tu vas voir.'])[Math.floor(Math.random() * (raf.taunts?.length || 1))].replace(/^Raf Tomatis : « |»$/g, '').trim() },
    { side: 1, label: myName, text: ['On en reparle après le match, Raf.', 'Tu dis ça à chaque fois.', 'Joue, on verra bien.'][Math.floor(Math.random() * 3)] },
  ];
  lines.push({ name: raf.short, label: 'Raf Tomatis', text: pick(RAF_EXTRA) });
  lines.push({ name: raf.short, label: 'Raf Tomatis', text: pick([
    'Allez, on joue. Et filmez bien mes smashs.',
    'Bon, on y va ? J\'ai une réservation au resto à 21 h.',
    'Prépare-toi à courir. Beaucoup.',
    'Que le meilleur gagne. Donc moi.',
    'Service pour moi, évidemment.',
    'On commence ? Je sens que c\'est mon jour.',
  ]) });
  return lines;
}

export class Career {
  constructor(state, storage) {
    this.s = state;
    this.storage = storage;
    if (!state.story && state.profile) advanceStory(this, { type: 'start' });
    for (const k of Object.keys(GROWTH)) delete GROWTH[k];
    Object.assign(GROWTH, state.growth || {});
  }

  // ------------------------------------------------------------------ sauvegarde
  static load(storage) {
    try {
      const raw = storage?.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.profile) return null;
      // argent gagné dans l'Aventure avant d'avoir une carrière
      try { const pm = +localStorage.getItem('padel-arena.pendingMoney') || 0; if (pm) { s.money = (s.money || 0) + pm; localStorage.removeItem('padel-arena.pendingMoney'); storage.setItem(KEY, JSON.stringify(s)); } } catch { /* ignoré */ }
      if (s.v === 1) {
        // migration v1 -> v2 : boutique, réglages, entraînements, nouveau format d'apparence
        Object.assign(s, { v: 2, shopPts: 0, owned: [...FREE_ITEMS], settings: { formats: { ...DEFAULT_FORMATS } }, drills: {}, trainedWeek: 0 });
        const old = s.profile.look || {};
        s.profile.look = { ...DEFAULT_LOOK, female: !!old.female, height: old.height || 1, skin: old.skin ?? DEFAULT_LOOK.skin, hair: old.hair ?? DEFAULT_LOOK.hair, hairStyle: old.hairStyle || 'short', headwear: old.headwear || 'band', skirt: !!old.skirt, primary: FREE_ITEMS.includes(`color:${old.kit}`) ? old.kit : 'blue' };
      }
      if (s.v !== VERSION) return null;
      return new Career(s, storage);
    } catch { return null; }
  }

  static exists(storage) { return !!Career.load(storage); }

  static erase(storage) { try { storage?.removeItem(KEY); } catch { /* ignoré */ } }

  /**
   * Nouvelle carrière : tout en bas de l'échelle, non classé, partenaire de club.
   * @param {object} profile { name, hand:'R'|'L', side:'L'|'R', look }
   */
  static create(profile, storage) {
    const attrs = {};
    for (const id of ATTR_IDS) attrs[id] = START_VALUE;
    const seed = (Math.random() * 2 ** 31) | 0;
    const c = new Career({
      v: VERSION, seed,
      profile: { name: 'Joueur', hand: 'R', side: 'L', ...profile, look: { ...DEFAULT_LOOK, ...profile.look } },
      attrs, sp: START_POINTS, xp: 0, level: 1, money: 50, week: 1,
      results: [], tournament: null, partner: null,
      stats: { played: 0, won: 0, titles: 0, bestRank: UNRANKED, missions: 0 },
      shopPts: 0, owned: [...FREE_ITEMS],
      settings: { formats: { ...DEFAULT_FORMATS } },
      drills: {}, trainedWeek: 0,
    }, storage);
    c.s.partner = c.partnerOptions()[0];
    advanceStory(c, { type: 'start' });
    c.save();
    return c;
  }

  save() {
    try { this.storage?.setItem(KEY, JSON.stringify(this.s)); } catch { /* stockage indisponible : la partie continue sans sauvegarde */ }
  }

  rand() { return rng((this.s.seed = (this.s.seed + 0x9e3779b9) | 0)); }

  // ------------------------------------------------------------------ état dérivé
  get ovr() { return overall(this.s.attrs); }
  get season() { return Math.floor((this.s.week - 1) / SEASON_WEEKS) + 1; }
  get weekInSeason() { return ((this.s.week - 1) % SEASON_WEEKS) + 1; }
  /** Points de classement : résultats des SEASON_WEEKS dernières semaines. */
  get points() {
    return this.s.results.filter((r) => r.week > this.s.week - SEASON_WEEKS).reduce((sum, r) => sum + r.points, 0);
  }
  get rank() { return rankForPoints(this.points); }
  get xpNeeded() { return xpForLevel(this.s.level); }
  get pairOvr() { return Math.round((this.ovr + this.s.partner.ovr) / 2); }
  /** Palier le plus élevé accessible. */
  get tier() { return [...TIERS].reverse().find((t) => this.rank <= t.unlockRank); }

  // ------------------------------------------------------------------ attributs
  cost(id) { return upgradeCost(this.s.attrs[id]); }
  canUpgrade(id) { return this.s.attrs[id] < MAX_VALUE && this.s.sp >= this.cost(id); }
  upgrade(id) {
    if (!this.canUpgrade(id)) return false;
    this.s.sp -= this.cost(id);
    this.s.attrs[id]++;
    this.save();
    return true;
  }

  // ------------------------------------------------------------------ partenaire
  /** Trois partenaires possibles, de niveau proche du vôtre (stables pour une semaine donnée). */
  partnerOptions() {
    const r = rng(hashStr(`partner-${this.s.seed0 ?? (this.s.seed0 = this.s.seed)}-${Math.floor((this.s.week - 1) / 4)}`));
    const cap = this.tier.ovr[1] - 4;
    const wantSide = this.s.profile.side === 'L' ? 'R' : 'L';
    return [0, 3, 6].map((bonus, i) => {
      const p = genericNpc(r, Math.min(cap, Math.max(26, this.ovr - 1 + bonus + Math.floor(r() * 3))));
      // un partenaire gaucher joue plutôt à droite ; sinon il prend le côté libre
      return { ...p, side: wantSide, kind: 'partner', slot: i };
    });
  }
  setPartner(p) { this.s.partner = { ...p }; this.save(); }

  // ------------------------------------------------------------------ calendrier
  /** Tournois proposés cette semaine (les deux paliers accessibles les plus hauts + le suivant, verrouillé). */
  offers() {
    const rank = this.rank, top = tierIndex(this.tier.id);
    const out = [];
    for (const tpl of TOURNAMENTS) {
      const ti = tierIndex(tpl.tier);
      if (ti > top + 1 || ti < top - 1) continue;
      if (tpl.every && this.s.week % tpl.every !== 0) continue;
      if (tpl.onlyWeek && this.weekInSeason !== tpl.onlyWeek) continue;
      const tier = tierById(tpl.tier);
      let locked = null;
      if (rank > tier.unlockRank) locked = `Classement requis : top ${tier.unlockRank}`;
      else if (tpl.minRank && rank > tpl.minRank) locked = `Réservé au top ${tpl.minRank}`;
      else if (this.s.money < tpl.fee && tpl.tier !== 'amateur') locked = `Inscription : ${tpl.fee} €`;
      out.push({ tpl, tier, locked });
    }
    // le tournoi de son propre club (toutes les 4 semaines)
    if (this.s.club && this.s.week % 4 === 0) {
      const tpl = clubTournament(this.s.club);
      out.push({ tpl, tier: tierById(tpl.tier), locked: null });
    }
    return out.sort((a, b) => tierIndex(b.tier.id) - tierIndex(a.tier.id) || b.tpl.points - a.tpl.points);
  }

  /** S'inscrire à un tournoi : compose le tableau. */
  enter(tplId) {
    if (this.s.tournament) return { ok: false, error: 'Un tournoi est déjà en cours.' };
    const offer = this.offers().find((o) => o.tpl.id === tplId);
    if (!offer) return { ok: false, error: 'Tournoi indisponible cette semaine.' };
    if (offer.locked) return { ok: false, error: offer.locked };
    this.s.money = Math.max(0, this.s.money - offer.tpl.fee);
    const me = this.playerNpc();
    this.s.tournament = createTournament(offer.tpl, { players: [me, this.s.partner], ovr: this.pairOvr }, this.rand(), this.s.week, this.formatFor(offer.tpl.tier));
    this.save();
    return { ok: true };
  }

  // ------------------------------------------------------------------ entraînement
  /** Un seul atelier par semaine, et pas pendant un tournoi. */
  /** Personnages jouables en exhibition. */
  hasChar(id) { this.s.chars ??= []; return this.s.chars.includes(id) || isUnlocked() || advUnlocks().includes(`char:${id}`); }
  buyChar(id) {
    const c = findCharacter(id);
    if (!c || c.mission) return { ok: false, error: 'Ce personnage se débloque par une mission.' };
    if (this.hasChar(id)) return { ok: true };
    if (this.s.shopPts < c.price) return { ok: false, error: `Il manque ${c.price - this.s.shopPts} points boutique.` };
    this.s.shopPts -= c.price;
    this.s.chars.push(id);
    this.save();
    return { ok: true };
  }

  canTrain() {
    if (this.s.tournament) return false;
    if (this.s.trainedWeek !== this.s.week) return true;
    return this.hasStaff('kine') && (this.s.trainedTwice || 0) !== this.s.week;   // le kiné permet une 2e séance
  }

  tplById(id) { return id === 'myclub' && this.s.club ? clubTournament(this.s.club) : TOURNAMENTS.find((x) => x.id === id); }

  // ------------------------------------------------------------------ argent : staff et club (facultatifs)
  hasStaff(id) { return !!this.s.staff?.[id]; }
  get weeklyCosts() { return Object.keys(this.s.staff || {}).filter((k) => this.s.staff[k]).reduce((sum, k) => sum + STAFF[k].salary, 0); }
  get weeklyIncome() { return clubIncome(this.s.club); }
  hire(id) {
    if (!STAFF[id]) return { ok: false };
    if (this.s.money < STAFF[id].salary) return { ok: false, error: `Il faut au moins ${STAFF[id].salary} € (une semaine de salaire).` };
    (this.s.staff ??= {})[id] = true; this.save(); return { ok: true };
  }
  fire(id) { if (this.s.staff) this.s.staff[id] = false; this.save(); return { ok: true }; }
  buyClub(name) {
    if (this.s.club) return { ok: false, error: 'Vous avez déjà un club.' };
    if (this.s.money < CLUB.price) return { ok: false, error: `Il manque ${CLUB.price - this.s.money} €.` };
    this.s.money -= CLUB.price;
    this.s.club = freshClub(name || `Padel Club ${this.s.profile.name.split(' ').pop()}`);
    this.save(); return { ok: true };
  }
  buyDeco(id) {
    const club = this.s.club, d = DECOS.find((x) => x.id === id);
    if (!club || !d) return { ok: false };
    club.decos ??= [];
    if (club.decos.includes(id)) return { ok: false, error: 'Déjà installé.' };
    if (this.s.money < d.price) return { ok: false, error: `Il manque ${d.price - this.s.money} €.` };
    this.s.money -= d.price; club.decos.push(id); this.save(); return { ok: true };
  }
  upgradeClub(part) {
    const club = this.s.club, def = CLUB[part];
    if (!club || !def) return { ok: false };
    if (club[part] >= def.max) return { ok: false, error: 'Niveau maximum atteint.' };
    const price = def.price(club[part]);
    if (this.s.money < price) return { ok: false, error: `Il manque ${price - this.s.money} €.` };
    this.s.money -= price; club[part]++; this.save(); return { ok: true };
  }

  /** Passage à la semaine suivante : salaires du staff, revenus du club. */
  nextWeek() {
    const cost = this.weeklyCosts, income = this.weeklyIncome;
    this.s.money += income;
    if (this.s.club) this.s.club.earned = (this.s.club.earned || 0) + income;
    if (cost) {
      if (this.s.money >= cost) this.s.money -= cost;
      else { this.s.staff = {}; this.s.lastNotice = 'Faute d\'argent, votre staff a dû partir.'; }   // jamais bloquant
    }
    // les joueurs montants jouent aussi leurs tournois de leur côté
    this.s.growth ??= {};
    for (const c of grownCelebs()) {
      if (!c.rising) continue;
      const r = Math.random(), g = this.s.growth[c.id] || 0;
      this.s.growth[c.id] = Math.max(-3, Math.min(20, g + (r < 0.25 ? 0.6 : r < 0.6 ? 0.25 : -0.1)));
    }
    Object.assign(GROWTH, this.s.growth);
    this.s.week++;
  }

  /** Options de Game.start pour un atelier d'entraînement. */
  drillOptions(id) {
    const p = this.s.profile, look = this.lookFor();
    const coachRating = id === 'coach' ? Math.min(92, this.ovr + 4) : Math.max(50, this.ovr);
    const coach = { ...COACH, ovr: coachRating, attrs: Object.fromEntries(ATTR_IDS.map((k) => [k, coachRating])) };
    const me = this.humanSpec(look, 0);
    const idle = !['coach', 'precision'].includes(id);
    return {
      mode: 'drill', drill: id, format: '1v1', sets: 1, gamesPerSet: 6, golden: true, matchTiebreak: id === 'coach' ? 7 : 0,
      firstServer: 1, venue: 'municipal', ambiance: 'day', bag: bagById(p.look.bag), cutscene: drillCutscene(id, me.name),
      lineup: { near: [me], far: [npcSpec(coach, 'black', 0, idle)] },
    };
  }

  /** Résultat d'un atelier : XP, gain d'attribut selon la médaille, points boutique. */
  reportTraining(result) {
    const def = DRILLS[result.drill];
    if (!def || !this.canTrain()) return null;
    const medal = result.forfeit ? 0 : result.medal;
    const attr = def.attr;
    const v = this.s.attrs[attr];
    // l'entraînement fait progresser l'attribut travaillé ; moins efficace à haut niveau
    let gain = [0, 0, 1, 2][medal];
    if (v >= 60 && gain) gain -= 1;
    if (v >= 80 && medal < 3) gain = 0;
    if (this.hasStaff('coach') && medal >= 2) gain += 1;            // coach particulier
    this.s.attrs[attr] = Math.min(MAX_VALUE, v + gain);
    const shop = Math.round(SHOP_REWARDS.drill[medal] * (this.hasStaff('agent') ? 1.25 : 1));
    this.s.shopPts += shop;
    const best = this.s.drills[result.drill] || 0;
    this.s.drills[result.drill] = Math.max(best, medal);
    // avec le kiné, la première séance ne fait pas passer la semaine
    if (this.hasStaff('kine') && this.s.trainedWeek !== this.s.week) this.s.trainedWeek = this.s.week;
    else { this.s.trainedWeek = this.s.week; this.s.trainedTwice = this.s.week; this.nextWeek(); }
    const g = this.grant([5, 20, 35, 50][medal], 0);
    this.save();
    return { ...g, medal, attr, gain, shop, label: def.label, score: result.score };
  }

  // ------------------------------------------------------------------ réglages
  formatFor(tier) { return this.s.settings.formats[tier] || DEFAULT_FORMATS[tier]; }
  formatChoices(tier) { return FORMAT_CHOICES[tier].map((id) => ({ id, ...MATCH_FORMATS[id] })); }
  setFormat(tier, id) { if (FORMAT_CHOICES[tier]?.includes(id)) { this.s.settings.formats[tier] = id; this.save(); } }

  // ------------------------------------------------------------------ boutique
  owns(id) { const it = itemById(id); return this.s.owned.includes(id) || advUnlocks().includes(id) || (it && it.price === 0) || ((TEST_UNLOCK_ALL_VENUES || isUnlocked()) && id.startsWith('venue:')); }
  buy(id) {
    const it = itemById(id);
    if (!it || this.owns(id)) return { ok: false, error: 'Déjà acheté.' };
    if (it.eur) {
      if (this.s.money < it.price) return { ok: false, error: `Il manque ${it.price - this.s.money} €.` };
      this.s.money -= it.price;
    } else {
      if (this.s.shopPts < it.price) return { ok: false, error: `Il manque ${it.price - this.s.shopPts} points boutique.` };
      this.s.shopPts -= it.price;
    }
    this.s.owned.push(id);
    this.save();
    return { ok: true };
  }
  /** Look du joueur avec uniquement des objets possédés. */
  lookFor() {
    const L = { ...DEFAULT_LOOK, ...this.s.profile.look };
    const ok = (cat, ref, fallback) => (this.owns(`${cat}:${ref}`) ? ref : fallback);
    L.primary = ok('color', L.primary, 'blue'); L.secondary = ok('color', L.secondary, 'yellow');
    L.shortsColor = ok('color', L.shortsColor, 'navy'); L.shoeColor = ok('color', L.shoeColor, 'white');
    L.headwear = ok('headwear', L.headwear, 'band'); L.racket = ok('racket', L.racket, 'classic'); L.racketDesign = ok('design', L.racketDesign || 'model', 'model'); L.kitStyle = ok('kit', L.kitStyle || 'tech', 'tech'); L.bag = ok('bag', L.bag, 'none');
    return L;
  }
  ownedVenues() { return SHOP_ITEMS.filter((i) => i.cat === 'venue' && this.owns(i.id)).map((i) => i.ref); }

  /** Attributs du joueur avec le bonus de la raquette. */
  statsWithGear() {
    const a = { ...this.s.attrs };
    for (const [k, v] of Object.entries(rackById(this.lookFor().racket).bonus)) a[k] = Math.min(MAX_VALUE, a[k] + v);
    if (this.hasStaff('physio')) { a.stamina = Math.min(MAX_VALUE, a.stamina + 5); a.speed = Math.min(MAX_VALUE, a.speed + 2); }
    return a;
  }

  humanSpec(look, lane) {
    const p = this.s.profile, short = this.playerNpc().short;
    return {
      name: short, human: true, hand: p.hand === 'L' ? -1 : 1, lane, stats: toStats(this.statsWithGear()),
      appearance: { ...resolveLook(look), name: short },
    };
  }

  playerNpc() {
    const p = this.s.profile;
    return { id: 'player', name: p.name, short: p.name.trim().split(' ').pop().toUpperCase().slice(0, 12), ovr: this.ovr, style: 'allround', hand: p.hand, side: p.side, attrs: { ...this.s.attrs }, kind: 'player' };
  }

  // ------------------------------------------------------------------ match
  /** Prochain match à jouer dans le tournoi en cours. */
  nextMatch() {
    const t = this.s.tournament;
    if (!t) return null;
    const m = playerMatch(t);
    if (!m) return null;
    const opp = t.pairs[m.a === t.playerIndex ? m.b : m.a];
    return { tournament: t, round: roundName(t), isFinal: t.rounds[t.round].length === 1, opponents: opp };
  }

  /** Options de Game.start pour le prochain match. */
  matchOptions() {
    const nm = this.nextMatch();
    if (!nm) return null;
    const t = nm.tournament, p = this.s.profile;
    const look = this.lookFor();
    // tenue du partenaire : vos couleurs ; adversaires : une tenue qui contraste
    const myKit = ({ blue: 'blue', red: 'red', green: 'green', black: 'black', white: 'white', orange: 'orange' })[look.primary] || 'blue';
    const oppKit = ['red', 'green', 'black', 'orange', 'white', 'blue'].find((k) => k !== myKit) || 'red';
    const myLane = p.side === 'R' ? 1 : -1;
    const me = this.humanSpec(look, myLane);
    const spec = (npc, kit, lane) => npcSpec(npc, kit, lane);
    const partner = spec(this.s.partner, myKit, -myLane);
    partner.appearance = { ...partner.appearance, ...resolveLook({ ...look, number: 7 }), skin: partner.appearance.skin, hair: partner.appearance.hair, hairStyle: partner.appearance.hairStyle, beard: partner.appearance.beard, headwear: partner.appearance.headwear, height: partner.appearance.height, build: partner.appearance.build, belly: partner.appearance.belly, racket: partner.appearance.racket, racketFace: partner.appearance.racket, racketPattern: 'arc', racketBase: null, name: this.s.partner.short };
    // mission du match (fixée au premier lancement de ce tour)
    if (!t.mission || t.missionRound !== t.round) {
      t.mission = pickMission({ tier: t.tier, matchTiebreak: t.matchTiebreak, strength: this.s.attrs.strength, rand: this.rand() });
      t.missionRound = t.round;
      this.save();
    }
    // adversaires : côté préféré si connu, sinon un gaucher à droite, sinon ordre de la fiche
    const [a, b] = nm.opponents.players;
    let aLane = a.side === 'R' ? 1 : a.side === 'L' ? -1 : b.side === 'R' ? -1 : b.side === 'L' ? 1 : a.hand === 'L' ? 1 : b.hand === 'L' ? -1 : -1;
    return {
      mode: 'career', format: '2v2', sets: t.sets, gamesPerSet: t.gamesPerSet, golden: t.golden, matchTiebreak: t.matchTiebreak || 0,
      club: t.venue === 'myclub' ? this.s.club : null,
      venue: t.venue || 'club', court: (['prestige', 'national'].includes(t.venue) && /Finale|Demi/.test(nm.round)) ? 0 : (t.court ??= Math.floor(this.rand()() * ({ ceyreste: 5, club: 3, hangar: 4, laciotat: 4, national: 2, prestige: 5 }[t.venue] || 1))), bag: bagById(look.bag), mission: liveMission(t.mission),
      ambiance: t.venue === 'beach' ? ((t.week % 3) ? 'day' : 'sunset') : t.venue === 'pro' || t.venue === 'national' ? 'night' : ['day', 'sunset', 'night'][(t.week + tierIndex(t.tier)) % 3],
      title: nm.round.toUpperCase(), subtitle: t.name,
      trophy: nm.round === 'Finale' ? trophySpec(t.tier, t.venue) : null,
      // réputation du tournoi (0..1) : plus elle est haute, plus il y a de chances d'avoir un concert
      reputation: Math.min(1, ({ amateur: 0.15, regional: 0.4, national: 0.75, pro: 1 }[t.tier] || 0.2) + (nm.round === 'Finale' ? 0.25 : /Demi/.test(nm.round) ? 0.1 : 0)),
      replays: t.tier === 'national' || t.tier === 'pro',
      chatter: Object.fromEntries(nm.opponents.players.filter((p) => CHATTER[p.id]).map((p) => [p.short, CHATTER[p.id]])),
      endCutscene: rafEndCutscene(nm.opponents.players, me.name),
      ...finalCutscene(t, nm, me.name, matchCutscene(nm.opponents.players, me.name, this.s.partner, this.s.stats, { tier: t.tier, round: nm.round, tournament: t.name, venue: t.venue })),
      lineup: { near: [me, spec(this.s.partner, myKit, -myLane)], far: [spec(a, oppKit, aLane), spec(b, oppKit, -aLane)] },
    };
  }

  /** Ajoute XP et points de compétence, gère les passages de niveau. */
  grant(xp, sp) {
    this.s.xp += xp;
    this.s.sp += sp;
    let levelUps = 0;
    while (this.s.xp >= xpForLevel(this.s.level)) {
      this.s.xp -= xpForLevel(this.s.level);
      this.s.level++;
      this.s.sp += REWARDS.levelSp;
      levelUps++;
    }
    return { xp, sp: sp + levelUps * REWARDS.levelSp, levelUps };
  }

  /**
   * Résultat d'un match joué. Met à jour tableau, XP, points, dotation, classement.
   * @param {{won:boolean, score:string, forfeit?:boolean}} result
   */
  reportMatch(result) {
    const t = this.s.tournament;
    if (!t || !playerMatch(t)) return null;
    const tier = t.tier, r = t.round;
    const rankBefore = this.rank, tierBefore = this.tier.id;
    const tpl = this.tplById(t.tplId);
    const opponents = this.nextMatch().opponents;

    let xp = REWARDS.matchXp[tier] * (1 + r * REWARDS.roundBonus);
    let sp = 0, shop = 0;
    if (result.won) { sp += REWARDS.winSp[tier]; shop += SHOP_REWARDS.win[tier]; }
    // mission du match
    const mission = t.mission && !result.simulated && !result.forfeit ? { ...t.mission, done: missionDone(t.mission, result.stats) } : null;
    if (mission?.done) {
      if (mission.reward === 'shop') shop += mission.amount; else sp += mission.amount;
      this.s.stats.missions = (this.s.stats.missions || 0) + 1;
    }
    t.mission = null;
    if (!result.won) xp *= result.forfeit ? 0 : REWARDS.lossFactor;
    if (result.simulated) xp *= 0.5;                 // un match simulé rapporte moitié moins d'XP
    this.s.stats.played++;
    if (result.won) this.s.stats.won++;

    const { finished, placing } = reportPlayerResult(t, result.won, result.score || (result.won ? 'V' : 'D'), this.rand());
    const summary = { won: result.won, round: roundName(t, r), tournament: t.name, opponents, finished, placing };

    if (finished) {
      let share = ROUND_SHARE[Math.min(placing, ROUND_SHARE.length - 1)];
      if (placing === totalRounds(t)) share = 0;               // éliminé au premier tour : ni points ni dotation
      const points = Math.round(tpl.points * share);
      const prize = Math.round(tpl.prize * share * (this.hasStaff('agent') ? 1.2 : 1));
      if (tpl.host && this.s.club) this.s.money += hostRevenue(this.s.club);   // billetterie de son propre tournoi
      if (placing === 0) {
        xp += REWARDS.matchXp[tier] * REWARDS.titleXpFactor;
        sp += REWARDS.titleSp[tier];
        shop += SHOP_REWARDS.win[tier] * SHOP_REWARDS.titleFactor;
        this.s.stats.titles++;
      }
      this.s.money += prize;
      this.s.results.push({ week: t.week, tplId: t.tplId, name: t.name, tier, points, placing });
      if (this.s.results.length > 80) this.s.results.shift();
      Object.assign(summary, { points, prize, champion: t.pairs[t.champion], title: placing === 0 });
      if (placing === 0) (this.s.trophies ??= []).push({ name: t.name, tier: t.tier, venue: t.venue, week: t.week, season: this.season, ...trophySpec(t.tier, t.venue) });
      this.s.lastTournament = t;
      // résultats des joueurs montants dans ce tableau : victoires = progression
      this.s.growth ??= {};
      t.pairs.forEach((pair, idx) => {
        for (const pl of pair.players) {
          if (!pl.rising) continue;
          const wins = t.rounds.flat().filter((m) => m.winner === idx).length;
          this.s.growth[pl.id] = Math.min(20, (this.s.growth[pl.id] || 0) + wins * 0.5 + (t.champion === idx ? 1 : 0) - (wins ? 0 : 0.3));
        }
      });
      Object.assign(GROWTH, this.s.growth);
      this.s.tournament = null;
      this.nextWeek();
    }
    // le partenaire progresse un peu avec vous
    if (result.won && this.s.stats.won % 2 === 0 && this.s.partner.ovr < this.tier.ovr[1] - 4) {
      this.s.partner.ovr++;
      for (const id of ATTR_IDS) this.s.partner.attrs[id] = Math.min(MAX_VALUE, this.s.partner.attrs[id] + 1);
    }
    if (this.hasStaff('agent')) shop = Math.round(shop * 1.25);
    this.s.shopPts += shop;
    summary.shop = shop;
    summary.mission = mission;
    Object.assign(summary, this.grant(Math.round(xp), sp));
    const rankAfter = this.rank;
    this.s.stats.bestRank = Math.min(this.s.stats.bestRank, rankAfter);
    summary.rankBefore = rankBefore;
    summary.rankAfter = rankAfter;
    summary.unlocked = this.tier.id !== tierBefore && tierIndex(this.tier.id) > tierIndex(tierBefore) ? this.tier.label : null;
    summary.worldNo1 = finished && rankAfter === 1 && rankBefore !== 1;
    // personnages débloqués en battant les joueurs du circuit amateur
    if (result.won && !result.simulated) {
      for (const p of opponents?.players || []) {
        if (MISSION_CHARS[p.id] && !this.hasChar(p.id)) {
          this.s.chars.push(p.id);
          (summary.charsUnlocked ??= []).push(p.name);
        }
      }
    }
    summary.story = advanceStory(this, { type: 'match', summary, result });
    this.save();
    return summary;
  }

  /** Joue le prochain match en simulation (résultat tiré selon l'écart de niveau). */
  simulateMatch() {
    const nm = this.nextMatch();
    if (!nm) return null;
    const r = this.rand();
    const won = r() < winProbability(this.pairOvr, nm.opponents.ovr);
    const N = nm.tournament.gamesPerSet, lose = Math.floor(r() * (N - 1));
    return this.reportMatch({ won, simulated: true, score: won ? `${N}-${lose}` : `${lose}-${N}` });
  }

  /** Estimation des chances de victoire au prochain match (0..1). */
  winChance() {
    const nm = this.nextMatch();
    return nm ? winProbability(this.pairOvr, nm.opponents.ovr) : 0;
  }

  /** Abandonner le tournoi en cours (compte comme une défaite). */
  withdraw() { return this.reportMatch({ won: false, forfeit: true, score: 'abandon' }); }

  // ------------------------------------------------------------------ classement mondial
  /** Joueurs nommés (pros et célébrités) avec leur rang indicatif. */
  static namedLadder() {
    const named = [...PRO_PAIRS.flatMap((p) => p.players), ...CELEBRITIES].sort((a, b) => b.ovr - a.ovr);
    let last = 0;
    return named.map((n) => {
      // les professionnels occupent les premières places, dans l'ordre de leur note
      const rank = n.kind === 'pro' ? last + 1 : Math.max(last + 1, rankForOvr(n.ovr));
      last = rank;
      return { rank, id: n.id, name: n.name, kind: n.kind, ovr: n.ovr };
    });
  }

  /** Rang mondial indicatif d'un adversaire. */
  static rankOf(npc) {
    const n = Career.namedLadder().find((x) => x.id === npc.id);
    return n ? n.rank : rankForOvr(npc.ovr);
  }

  /** Lignes du classement : top 10 puis voisinage du joueur. */
  rankingTable(around = 4) {
    const myRank = this.rank, myPoints = this.points;
    const named = new Map(Career.namedLadder().map((n) => [n.rank, n]));
    const row = (rank) => {
      // les joueurs classés derrière vous reculent d'une place
      const src = rank < myRank ? rank : rank - 1;
      const n = named.get(src);
      if (n) return { rank, name: n.name, kind: n.kind, points: pointsAtRank(src) };
      const g = genericNpc(rng(hashStr(`rank-${src}`)), 50);
      return { rank, name: g.name, kind: 'generic', points: pointsAtRank(src) };
    };
    const ranks = new Set();
    for (let r = 1; r <= 10; r++) ranks.add(r);
    for (let r = Math.max(1, myRank - around); r <= myRank + around; r++) ranks.add(r);
    return [...ranks].sort((a, b) => a - b).map((r) => (r === myRank
      ? { rank: r, name: this.s.profile.name, kind: 'player', points: myPoints, me: true }
      : row(r)));
  }
}

export { makeNpc };
