// ============================================================================
//  Mode Aventure — histoire, cinématiques et choix.
//
//  Chapitre 1 « Le commencement » : Eliott nous fait découvrir le padel (Louka
//  blessé). Premier entraînement avec le coach Roméo, Raf, Jean et Eliott ;
//  deux exercices, un tie-break, un super tie-break impossible à gagner ;
//  choix du partenaire pour le tournoi de Ceyreste.
//  Chapitre 2 « Le tournoi de Ceyreste » : tour 1 (gagné d'office), tour 2
//  (facile mais perdable), match des amis (les encourager, les déconcentrer ou
//  rien), demi-finale contre eux (difficile), finale contre Camille et Timéo
//  (perdue), remise des prix, verre au club-house.
//
//  Types d'étape :
//   text    pages de récit dans le menu (appel téléphonique, narrateur)
//   scene   vraie cinématique en jeu : personnages sur le court qui se parlent
//   choice  question ; chaque option a ses effets et une réaction après coup (after)
//   drill / match / watch   exercice, match joué, match regardé
//   branch  aiguillage selon l'état ; end  fin de chapitre
//  Les champs peuvent être des fonctions de ctx = { s, partner, friends, P(id) }.
// ============================================================================

export const PEOPLE = {
  eliott: { name: 'Eliott Hanras', short: 'Eliott', color: '#ffb74d', desc: 'L\'ami qui t\'a fait découvrir le padel. Drôle, chanteur, le plus faible des trois.' },
  jean: { name: 'Jean Deuxbé', short: 'Jean', color: '#81c784', desc: 'Un collègue sympathique et fair-play. Régulier, jamais avare d\'un lob.' },
  raf: { name: 'Rafael « Raf » Tomatis', short: 'Raf', color: '#e57373', desc: 'Le meilleur du groupe. Arrogant et mauvais perdant.' },
  coach: { name: 'Coach Roméo', short: 'Coach', color: '#64b5f6', desc: 'L\'entraîneur du groupe. Exigeant mais juste. Son estime ouvre des portes.' },
  louka: { name: 'Louka', short: 'Louka', color: '#ba68c8', desc: 'Le joueur blessé dont tu as pris la place.', hidden: true },
};
export const START_REL = { eliott: 25, jean: 10, raf: -5, coach: 0, louka: 0 };

const SHORT = { eliott: 'Eliott', jean: 'Jean', raf: 'Raf' };
const pair = (ids) => ids.map((i) => SHORT[i]).join(' et ');

// ------------------------------------------------------------------ chapitre 1
const CH1 = {
  start: {
    type: 'text',
    pages: [
      { who: 'Narrateur', text: 'Un mardi soir comme les autres. Ton téléphone vibre : c\'est Eliott, ton ami de toujours — celui qui chante faux sous la douche et qui joue au padel trois fois par semaine.' },
      { who: 'Eliott', text: 'Allô ?! C\'est la catastrophe. Louka s\'est tordu la cheville dimanche, il est out pour des semaines. À l\'entraînement on n\'est plus que trois, et à trois… on ne peut pas jouer.' },
      { who: 'Eliott', text: 'Alors viens jeudi ! Tu n\'as jamais joué ? Pas grave. Le coach est cool, enfin… exigeant. Et il y a Raf. Bon. Tu verras pour Raf.' },
    ],
    next: 'c_invite',
  },
  c_invite: {
    type: 'choice', who: 'Eliott', text: 'Alors, tu viens ?',
    options: [
      { label: 'Carrément, j\'ai toujours voulu essayer !', effects: { eliott: 8 }, after: [{ who: 'Eliott', text: 'YES ! Jeudi, 19 h, au tennis municipal. Je te prête une raquette !' }], next: 'arrive' },
      { label: 'Le padel ? C\'est pas du tennis pour les flemmards ?', effects: { eliott: -2 }, after: [{ who: 'Eliott', text: 'Pour les flemmards ?! Tu vas courir comme jamais. Il y a des vitres, tu joues la balle après la vitre, tu fais sortir la balle du terrain au smash… Jeudi, 19 h. Pas d\'excuse !' }], next: 'arrive' },
    ],
  },
  arrive: {
    type: 'scene', venue: 'municipal', ambiance: 'sunset', cast: ['me', 'coach', 'raf', 'jean', 'eliott'],
    lines: [
      { who: 'coach', text: 'C\'est toi, le remplaçant de Louka ? Bienvenue. Moi c\'est Roméo. Ici on bosse, on s\'amuse aussi, mais d\'abord on bosse.' },
      { who: 'raf', text: 'Un débutant. Génial. On va passer la soirée à ramasser des balles.' },
      { who: 'jean', text: 'Laisse-le tranquille, Raf. Salut, moi c\'est Jean ! On a tous commencé un jour.' },
      { who: 'eliott', text: 'Tadaaa ! Je vous présente ma recrue. Il est nul, mais il est motivé !' },
      { who: 'me', text: 'Merci pour la présentation, Eliott…' },
      { who: 'coach', text: 'Allez, au boulot. On commence par le service.' },
    ],
    next: 'drill1',
  },
  drill1: { type: 'drill', drill: 'serve', label: 'Exercice 1 : le service', intro: 'Le service, c\'est le seul coup où personne ne t\'embête. Dix balles, vise la zone verte.', next: 'after1' },
  after1: {
    type: 'choice', who: 'Coach Roméo', text: 'Pas mal pour une première fois. Le geste est raide, mais il y a quelque chose. Qu\'est-ce que tu en dis ?',
    options: [
      { label: 'Merci coach, j\'ai tout à apprendre.', effects: { coach: 6 }, after: [{ who: 'Coach Roméo', text: 'Bonne réponse. Ceux qui croient tout savoir ne progressent plus.' }], next: 'drill2' },
      { label: 'Franchement, c\'était facile.', effects: { coach: -4, raf: 3 }, after: [{ who: 'Raf', text: '*ricane* Facile ! Il a mis trois services sur dix dans la zone.' }, { who: 'Coach Roméo', text: 'On verra si le lob est aussi « facile ».' }], next: 'drill2' },
    ],
  },
  drill2: { type: 'drill', drill: 'lob', label: 'Exercice 2 : le lob', intro: 'Je monte au filet et je n\'en bouge plus. Lobe-moi, bien haut, bien profond.', next: 'pre_m1' },
  pre_m1: {
    type: 'scene', venue: 'municipal', ambiance: 'sunset', cast: ['me', 'jean', 'coach'],
    lines: [
      { who: 'coach', text: 'Petit match pour voir ce que tu donnes en vrai : tie-break en simple contre Jean. Premier à 7 points.' },
      { who: 'jean', text: 'Je ne vais pas te faire de cadeau, hein ! Enfin… un peu quand même.' },
    ],
    next: 'm1',
  },
  m1: { type: 'match', label: 'Tie-break contre Jean', format: '1v1', mt: 7, venue: 'municipal', ambiance: 'sunset', near: ['me'], far: ['jean'], win: 'm1_win', lose: 'm1_lose' },
  m1_win: {
    type: 'scene', venue: 'municipal', ambiance: 'sunset', cast: ['me', 'jean', 'raf', 'coach'], effects: { coach: 6, jean: 4 },
    lines: [
      { who: 'jean', text: 'Bah dis donc ! Tu es sûr que tu n\'as jamais joué ? Bravo, sincèrement.' },
      { who: 'raf', text: 'Jean a joué avec la main gauche, c\'est tout.' },
      { who: 'coach', text: 'Intéressant… Allez, dernier match de la soirée.' },
    ],
    next: 'pre_m2',
  },
  m1_lose: {
    type: 'scene', venue: 'municipal', ambiance: 'sunset', cast: ['me', 'jean', 'coach'], effects: { jean: 3 },
    lines: [
      { who: 'jean', text: 'Bien joué quand même ! Pour un premier match, tu m\'as fait courir.' },
      { who: 'coach', text: 'Le placement est là. Le reste viendra. Allez, dernier match de la soirée.' },
    ],
    next: 'pre_m2',
  },
  pre_m2: {
    type: 'scene', venue: 'municipal', ambiance: 'night', cast: ['me', 'raf', 'eliott', 'jean', 'coach'],
    lines: [
      { who: 'coach', text: 'On finit par un super tie-break en double. Eliott avec le nouveau, Raf avec Jean. Premier à 10 points.' },
      { who: 'raf', text: 'Le débutant et le troubadour. Ça va être rapide.' },
      { who: 'eliott', text: 'Et un, et deux, et trois… padel ! On va les manger !' },
    ],
    next: 'm2',
  },
  m2: { type: 'match', label: 'Super tie-break avec Eliott', format: '2v2', mt: 10, venue: 'municipal', ambiance: 'night', near: ['me', 'eliott'], far: ['raf', 'jean'], rig: 'lose', weak: ['eliott'], win: 'after_m2', lose: 'after_m2' },
  after_m2: {
    type: 'scene', venue: 'municipal', ambiance: 'night', cast: ['me', 'raf', 'eliott', 'jean'],
    lines: [
      { who: 'raf', text: 'HAHA ! Le duo des champions ! Eliott, tu as recruté un ami à ton niveau, c\'est mignon.' },
      { who: 'eliott', text: 'J\'ai… j\'ai pas d\'excuse. Enfin si : mon dos.' },
    ],
    next: 'c_raf',
  },
  c_raf: {
    type: 'choice', who: 'Raf', text: 'Alors, le débutant, ça fait quoi de perdre ?',
    options: [
      { label: '« Rira bien qui rira le dernier, Raf. »', effects: { raf: -6, eliott: 3 }, set: { rivalRaf: true }, after: [{ who: 'Raf', text: 'Oh, il mord ! J\'adore. On en reparlera quand tu sauras tenir une raquette.' }], next: 'jean_coach' },
      { label: '« Bien joué, vous étiez meilleurs. »', effects: { raf: 4, jean: 4, coach: 4 }, rep: 3, after: [{ who: 'Raf', text: '… Euh. Merci. Enfin, évidemment qu\'on était meilleurs.' }], next: 'jean_coach' },
      { label: 'Ignorer Raf et ramasser les balles', effects: { coach: 2 }, after: [{ who: 'Coach Roméo', text: '*hoche la tête* Bien.' }], next: 'jean_coach' },
    ],
  },
  jean_coach: {
    type: 'scene', venue: 'municipal', ambiance: 'night', cast: ['me', 'coach', 'jean', 'eliott', 'raf'],
    lines: [
      { who: 'jean', text: 'Ne l\'écoute pas. Pour une première soirée, tu t\'es super bien débrouillé.' },
      { who: 'coach', text: 'Écoutez-moi tous les quatre. Ce week-end, le club de Ceyreste organise un petit tournoi. Je veux vous inscrire, toi compris.' },
      { who: 'coach', text: 'Il me faut deux binômes. Alors réfléchis bien : avec qui veux-tu jouer ?' },
    ],
    next: 'c_partner',
  },
  c_partner: {
    type: 'choice', who: 'Coach Roméo', text: 'Ton partenaire pour le tournoi de Ceyreste ?',
    options: [
      { label: 'Eliott', sub: 'Le plus faible des trois, mais c\'est lui qui t\'a fait découvrir le padel. On s\'amuse, et c\'est un ami.', effects: { eliott: 20, raf: -5 }, set: { partner: 'eliott' }, next: 'end_eliott' },
      { label: 'Jean', sub: 'Pas mauvais, fair-play, sympathique. Le choix raisonnable.', effects: { jean: 15, eliott: -15, raf: -5 }, set: { partner: 'jean' }, next: 'end_jean' },
      { label: 'Raf', sub: 'Le meilleur des trois. Arrogant et mauvais perdant… mais il gagne.', effects: { raf: 15, eliott: -18, jean: -3, coach: -2 }, set: { partner: 'raf' }, next: 'end_raf' },
    ],
  },
  end_eliott: {
    type: 'scene', venue: 'municipal', ambiance: 'night', cast: ['me', 'eliott', 'raf', 'jean'],
    lines: [
      { who: 'eliott', text: 'C\'EST VRAI ?! Toi et moi ! Je vais composer une chanson pour notre binôme. « Les Invaincus ». Enfin, en espérant.' },
      { who: 'raf', text: 'Parfait. Jean, on va leur apprendre la vie samedi.' },
      { who: 'jean', text: 'Bonne chance à vous deux ! Que le meilleur gagne.' },
    ],
    next: 'ch1_end',
  },
  end_jean: {
    type: 'scene', venue: 'municipal', ambiance: 'night', cast: ['me', 'jean', 'eliott', 'raf'],
    lines: [
      { who: 'jean', text: 'Avec plaisir ! On va bien s\'entendre, j\'en suis sûr.' },
      { who: 'eliott', text: 'Ah… d\'accord. Non mais c\'est normal, Jean joue mieux que moi. Je… je suis un peu déçu, c\'est tout.' },
      { who: 'eliott', text: 'Mais samedi, je vais tout donner. Pour te montrer que j\'aurais été un bon partenaire !' },
      { who: 'raf', text: 'Et moi je me retrouve avec le troubadour. Super.' },
    ],
    next: 'ch1_end',
  },
  end_raf: {
    type: 'scene', venue: 'municipal', ambiance: 'night', cast: ['me', 'raf', 'eliott', 'jean'],
    lines: [
      { who: 'raf', text: 'Enfin quelqu\'un d\'intelligent. Tu cours là où je te dis, et on gagne. Simple.' },
      { who: 'eliott', text: 'Raf ?! … Bon. Je comprends, il est plus fort. Mais ça me fait un peu mal, je ne vais pas te mentir.' },
      { who: 'eliott', text: 'Jean, on va leur montrer, à ces deux-là !' },
      { who: 'jean', text: 'Avec plaisir, Eliott. Allez, on y croit.' },
    ],
    next: 'ch1_end',
  },
  ch1_end: { type: 'end', chapter: 1, next: 'c2_start', text: (c) => `Ton partenaire pour le tournoi de Ceyreste : ${SHORT[c.partner]}. Face à toi, l'autre binôme : ${pair(c.friends)}.` },
};

// ------------------------------------------------------------------ chapitre 2
const CH2 = {
  c2_start: {
    type: 'scene', venue: 'ceyreste', ambiance: 'day', cast: (c) => ['me', c.partner, 'coach', ...c.friends],
    lines: (c) => [
      { who: 'coach', text: 'Samedi matin, Ceyreste. Huit équipes, des matchs en super tie-break. Profitez, apprenez, et pas de bêtises.' },
      c.partner === 'eliott' ? { who: 'eliott', text: 'J\'ai répété ma danse de la victoire toute la nuit. Il ne nous manque plus que la victoire.' }
        : c.partner === 'jean' ? { who: 'jean', text: 'On joue simple, on joue ensemble. Le reste suivra.' }
          : { who: 'raf', text: 'Règle numéro un : tu me laisses les smashs. Règle numéro deux : tu me laisses les smashs.' },
      { who: c.friends[0], text: c.friends.includes('eliott') ? 'On se retrouve en demi-finale ! Enfin… si on y arrive.' : 'Bonne chance. Pas trop quand même.' },
    ],
    next: 'r1',
  },
  r1: { type: 'match', label: 'Tour 1 contre une paire du coin', format: '2v2', mt: 10, venue: 'ceyreste', ambiance: 'day', near: (c) => ['me', c.partner], far: ['random', 'random'], randomOvr: 30, rig: 'win', title: '1ER TOUR', win: 'r1_line', lose: 'r1_line' },
  // situation de fair-play n° 1 : la balle litigieuse
  r1_line: {
    type: 'choice', who: 'Narrateur', text: 'Sur la balle de match, ta frappe frôle la ligne. Personne n\'a bien vu. Ton adversaire te regarde : « Elle était bonne ? »',
    options: [
      { label: '« Elle était dehors, je te la laisse. »', rep: 8, effects: { coach: 4 }, after: [{ who: 'Adversaire', text: 'Respect. Merci, c\'est rare.' }, { who: 'Narrateur', text: 'Le point est rejoué… et vous le gagnez quand même. Le coach t\'a vu faire.' }], next: 'r2_pre' },
      { label: '« Bonne, sans hésiter. »', rep: -8, set: { lied: true }, after: [{ who: 'Adversaire', text: 'Mouais… Si tu le dis.' }, { who: 'Narrateur', text: 'Vous passez au tour suivant. Dans les tribunes, quelqu\'un secoue la tête.' }], next: 'r2_pre' },
    ],
  },
  r2_pre: {
    type: 'scene', venue: 'ceyreste', ambiance: 'day', cast: (c) => ['me', c.partner, 'coach'],
    lines: (c) => [
      { who: 'coach', text: c.s.flags.lied ? 'J\'ai vu la balle de match. On en reparlera. Concentre-toi.' : 'Bien. Deuxième tour : une paire jeune, assez régulière. Patience.' },
      { who: c.partner, text: c.partner === 'raf' ? 'Ceux-là, on les plie en dix minutes.' : 'On garde le même plan. Ensemble !' },
    ],
    next: 'r2',
  },
  r2: { type: 'match', label: 'Tour 2', format: '2v2', mt: 10, venue: 'ceyreste', ambiance: 'day', near: (c) => ['me', c.partner], far: ['random', 'random'], randomOvr: 26, title: '2E TOUR', win: 'watch_pre', lose: 'r2_lost' },
  r2_lost: {
    type: 'choice', who: 'Narrateur', text: 'Éliminés au deuxième tour. Tes amis, eux, jouent leur match dans un quart d\'heure.',
    options: [
      { label: 'Rester pour encourager les copains', effects: { eliott: 5, jean: 5, raf: 2, coach: 3 }, set: { out: 'r2', stayed: true }, after: [{ who: 'Coach Roméo', text: 'Bonne attitude. Viens, on se met au bord du court.' }], next: 'watch_lost' },
      { label: 'Partir directement', effects: { eliott: -6, jean: -3, coach: -3 }, set: { out: 'r2', stayed: false }, after: [{ who: 'Narrateur', text: 'Tu ranges tes affaires et tu pars sans un mot. Ton téléphone vibrera plus tard : rendez-vous au club-house ce soir.' }], next: 'clubhouse' },
    ],
  },
  watch_lost: { type: 'watch', label: (c) => `Regarder ${pair(c.friends)}`, near: (c) => c.friends, far: ['random', 'random'], randomOvr: 28, title: 'DEMI-FINALE', next: 'lost_final_text' },
  lost_final_text: {
    type: 'text',
    pages: (c) => [
      { who: 'Narrateur', text: `${pair(c.friends)} gagnent leur demi-finale ! En finale, ils tombent sur Camille Roy et Timéo Boulhol, la paire montante de la région.` },
      { who: 'Narrateur', text: 'La finale est à sens unique : Camille sort trois balles par la porte, Timéo renvoie tout. Défaite 10-4, mais quel parcours.' },
    ],
    next: 'ceremony',
  },
  watch_pre: {
    type: 'text',
    pages: (c) => [{ who: 'Narrateur', text: `Qualifiés pour la demi-finale ! Votre prochain adversaire sortira du match de ${pair(c.friends)} contre une paire de La Ciotat. Tu t'installes au bord du court.` }],
    next: 'c_cheer',
  },
  c_cheer: {
    type: 'choice', who: 'Narrateur', text: (c) => `${pair(c.friends)} entrent sur le court. Que fais-tu pendant leur match ?`,
    options: [
      { label: 'Les encourager à fond', set: { cheer: 'support' }, rep: 3, effects: { eliott: 6, jean: 6, raf: 3 }, after: (c) => [{ who: SHORT[c.friends[0]], text: 'Merci ! Ça fait plaisir de t\'entendre.' }], next: 'watch_friends' },
      { label: 'Les déconcentrer (sifflets, remarques…)', set: { cheer: 'disturb' }, rep: -6, effects: { eliott: -8, jean: -8, raf: -6, coach: -5 }, after: (c) => [{ who: SHORT[c.friends[0]], text: 'Sérieusement ?! Tu fais quoi, là ?' }], next: 'watch_friends' },
      { label: 'Regarder sans rien dire', set: { cheer: 'neutral' }, after: [{ who: 'Narrateur', text: 'Tu observes leur jeu, tu prends des notes dans ta tête.' }], next: 'watch_friends' },
    ],
  },
  watch_friends: { type: 'watch', label: (c) => `Regarder ${pair(c.friends)}`, near: (c) => c.friends, far: ['random', 'random'], randomOvr: 26, title: 'QUART DE FINALE', next: 'raf_cheat_branch' },
  // situation de fair-play n° 2 (seulement avec Raf) : Raf veut saboter les raquettes adverses
  raf_cheat_branch: { type: 'branch', to: (c) => (c.partner === 'raf' ? 'raf_cheat' : 'semi_pre') },
  raf_cheat: {
    type: 'scene', venue: 'ceyreste', ambiance: 'day', cast: ['me', 'raf'],
    lines: [
      { who: 'raf', text: 'Psst. Leurs sacs sont dans le vestiaire. Je desserre leurs grips et je dégonfle leurs balles neuves. Personne ne verra rien.' },
    ],
    next: 'c_raf_cheat',
  },
  c_raf_cheat: {
    type: 'choice', who: 'Raf', text: 'Tu fais le guet ?',
    options: [
      { label: 'Essayer de le raisonner', after: [{ who: 'Raf', text: 'Oh, ça va, le saint ! Tout le monde fait ça. Tu veux gagner ou pas ?' }], next: 'c_raf_cheat2' },
      { label: 'Faire le guet', rep: -12, set: { sabotage: true }, effects: { raf: 8 }, after: [{ who: 'Narrateur', text: 'Deux minutes plus tard, Raf ressort du vestiaire en sifflotant.' }], next: 'semi_pre' },
    ],
  },
  c_raf_cheat2: {
    type: 'choice', who: 'Narrateur', text: 'Raf file vers le vestiaire. Tu peux encore prévenir le juge-arbitre.',
    options: [
      { label: 'Le dénoncer au juge-arbitre', rep: 12, set: { denounced: true }, effects: { raf: -25, coach: 10, jean: 6, eliott: 6 }, after: [{ who: 'Juge-arbitre', text: 'Monsieur Tomatis, un mot s\'il vous plaît. Avertissement officiel : au prochain écart, c\'est l\'exclusion.' }, { who: 'Raf', text: '*te fusille du regard* … Tu me le paieras.' }], next: 'semi_pre' },
      { label: 'Laisser faire', rep: -6, set: { sabotage: true }, effects: { raf: 3 }, after: [{ who: 'Narrateur', text: 'Tu détournes le regard. Raf revient, l\'air de rien.' }], next: 'semi_pre' },
    ],
  },
  semi_pre: {
    type: 'scene', venue: 'ceyreste', ambiance: 'day', cast: (c) => ['me', c.partner, ...c.friends],
    lines: (c) => {
      const [a, b] = c.friends, ch = c.s.flags.cheer;
      if (ch === 'disturb') return [
        { who: a, text: 'Tiens, le supporter de l\'année. Merci pour les sifflets, c\'était classe.' },
        { who: b, text: 'On va te rendre la monnaie de ta pièce, sur le court.' },
        { who: c.partner, text: c.partner === 'raf' ? 'Ils parlent beaucoup pour des perdants.' : 'Bon… on a peut-être mérité ça.' },
      ];
      if (ch === 'support') return [
        { who: a, text: 'Merci pour les encouragements tout à l\'heure. Que le meilleur gagne, vraiment.' },
        { who: b, text: 'Bon match ! Et pas de cadeau, hein.' },
        { who: 'me', text: 'Pas de cadeau. Bon match à vous !' },
      ];
      return [
        { who: a, text: 'Demi-finale entre potes. Qui l\'aurait cru ?' },
        { who: b, text: c.friends.includes('raf') ? 'Moi. Et je sais aussi qui va gagner.' : 'Allez, bon match à tous.' },
      ];
    },
    next: 'semi',
  },
  semi: { type: 'match', label: 'Demi-finale contre tes amis', format: '2v2', mt: 10, venue: 'ceyreste', ambiance: 'day', near: (c) => ['me', c.partner], far: (c) => c.friends, hard: true, title: 'DEMI-FINALE', win: 'final_pre', lose: 'semi_lost' },
  semi_lost: {
    type: 'scene', venue: 'ceyreste', ambiance: 'day', cast: (c) => ['me', c.partner, ...c.friends],
    effects: (c) => (c.partner === 'raf' ? { raf: -8 } : {}),
    lines: (c) => [
      { who: c.friends[0], text: c.s.flags.cheer === 'disturb' ? 'Ça, c\'est pour les sifflets !' : 'Quel match ! Vous nous avez fait peur.' },
      { who: c.partner, text: c.partner === 'raf' ? 'C\'était ta faute. Trois retours dans le filet sur les points importants.' : 'On a tout donné. On reviendra plus forts.' },
    ],
    next: 'lost_final_text',
  },
  final_pre: {
    type: 'scene', venue: 'ceyreste', ambiance: 'sunset', cast: (c) => ['me', c.partner, 'camille', 'timeo'],
    lines: (c) => [
      { who: 'camille', text: 'Salut. Vous êtes les surprises du tableau ? Bravo. Profitez de la finale.' },
      { who: 'timeo', text: 'On joue pas mal, hein. Juste pour prévenir.' },
      { who: c.partner, text: c.partner === 'raf' ? 'Prévenir ? On va vous éteindre.' : c.partner === 'eliott' ? 'Une finale ! Une FINALE ! Je vais pleurer.' : 'On va prendre du plaisir, et on verra.' },
    ],
    next: 'final',
  },
  final: { type: 'match', label: 'Finale contre Camille et Timéo', format: '2v2', mt: 10, venue: 'ceyreste', ambiance: 'sunset', near: (c) => ['me', c.partner], far: ['camille', 'timeo'], rig: 'lose', title: 'FINALE', set: { finalist: true }, win: 'ceremony', lose: 'ceremony' },
  ceremony: {
    type: 'scene', venue: 'ceyreste', ambiance: 'sunset', cast: (c) => ['me', c.partner, 'mayor', 'camille', 'timeo'],
    lines: (c) => [
      { who: 'mayor', text: 'Mesdames, messieurs, les vainqueurs du tournoi de Ceyreste : Camille Roy et Timéo Boulhol !' },
      { who: 'camille', text: 'Merci à tous. Et bravo aux finalistes, c\'était sérieux.' },
      c.s.flags.finalist ? { who: 'mayor', text: `Et une belle médaille pour nos finalistes surprises ! Je ne vous connaissais pas, vous. On va vous revoir, j'en suis sûr.` }
        : { who: 'mayor', text: `Et bravo à ${pair(c.friends)}, finalistes !` },
    ],
    next: 'clubhouse',
  },
  clubhouse: {
    type: 'scene', venue: 'ceyreste', ambiance: 'night', cast: (c) => ['me', c.partner, ...c.friends, 'coach'],
    lines: (c) => {
      const better = c.s.flags.finalist ? 'us' : 'them', met = !c.s.flags.out;
      const L = [{ who: 'coach', text: 'Allez, la tournée est pour moi. À votre premier tournoi ensemble !' }];
      const them0 = c.friends[0], them1 = c.friends[1];
      if (better === 'us') {
        L.push({ who: c.partner, text: c.partner === 'raf' ? `Alors, ${SHORT[them0]} ? Ça fait quoi de perdre contre le débutant ?` : met ? 'Désolé pour la demi, les gars… mais pas trop !' : 'On a eu de la chance sur le tirage.' });
        L.push({ who: them0, text: them0 === 'raf' ? 'Coup de chance. La prochaine fois, je vous détruis.' : them0 === 'eliott' ? 'Bon, je l\'avoue : vous étiez meilleurs. Mais j\'ai écrit une chanson sur notre défaite, elle est magnifique.' : 'Bravo, vraiment. Vous méritez votre finale.' });
      } else {
        L.push({ who: them0, text: them0 === 'raf' ? 'Finalistes ! Et vous, éliminés par nous. Je dis ça, je dis rien.' : them0 === 'eliott' ? 'FINALISTES ! Et je t\'ai battu ! Pardon. Non, pas pardon.' : 'On a eu un peu de réussite aujourd\'hui. À charge de revanche !' });
        L.push({ who: them1, text: them1 === 'raf' ? 'Le troubadour et moi, finalistes. Le monde à l\'envers.' : 'Bien joué à vous aussi.' });
      }
      if (c.s.flags.denounced) L.push({ who: 'raf', text: '*garde ses distances et ne trinque pas avec toi*' });
      if (c.s.flags.cheer === 'disturb') L.push({ who: c.friends.includes('jean') ? 'jean' : c.friends[0], text: 'Et la prochaine fois, garde tes sifflets pour l\'équipe adverse.' });
      L.push({ who: 'coach', text: c.s.rep >= 10 ? 'Je suis fier de l\'attitude de tout le monde aujourd\'hui. Continuez comme ça.' : c.s.rep <= -10 ? 'Le padel, c\'est aussi une question de comportement. Certains ici devraient y réfléchir.' : 'Bonne journée. Lundi, on se remet au travail.' });
      L.push({ who: 'narr', text: 'Au fond de la salle, un jeune homme avec une attelle à la cheville vous observe en silence. Louka.' });
      return L;
    },
    set: { metLouka: true },
    next: 'ch2_end',
  },
  ch2_end: { type: 'end', chapter: 2, text: (c) => `${c.s.flags.finalist ? 'Finalistes du tournoi de Ceyreste !' : c.s.flags.out === 'r2' ? 'Éliminés au 2e tour à Ceyreste.' : 'Demi-finalistes à Ceyreste.'} Réputation : ${c.s.rep > 0 ? '+' : ''}${c.s.rep}. La suite arrive : Louka est de retour…` },
};

export const CHAPTERS = { 1: 'Chapitre 1 · Le commencement', 2: 'Chapitre 2 · Le tournoi de Ceyreste' };
export const STEPS = { ...CH1, ...CH2 };
export const chapterOf = (id) => (id in CH2 ? 2 : 1);
