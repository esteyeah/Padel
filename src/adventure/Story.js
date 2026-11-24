// ============================================================================
//  Mode Aventure — histoire, cinématiques et choix.
//
//  Ch. 1 « Le commencement »     Eliott, Louka blessé, premier entraînement, choix du partenaire.
//  Ch. 2 « L'Open de La Ciotat »  tableau, tours 1-2, match des amis, demi contre eux,
//                                  finale contre Camille et Timéo, remise des prix par Payet.
//  Ch. 3 « Le retour de Louka »   Louka veut sa place ; entraînement à 5 avec classement ;
//                                  le dernier (Eliott) part et devient rival ; tournoi de Ceyreste.
//
//  Types d'étape :
//   text    pages de récit dans le menu (appel téléphonique)
//   scene   cinématique en jeu ; peut finir par un choix (choice) joué dans la cinématique
//   choice  choix joué dans une courte cinématique (who parle, options avec réaction after)
//   drill / match / watch / branch / end
//  Champs dynamiques : fonctions de ctx = { s, partner, friends, f (drapeaux) }.
//  Personnages : me, eliott, jean, raf, coach, louka, camille, timeo, mayor, payet,
//  gege / momo (habitués de la buvette), narr (narrateur), ref (juge-arbitre), opp (adversaire).
// ============================================================================

export const PEOPLE = {
  eliott: { name: 'Eliott Hanras', short: 'Eliott', color: '#ffb74d', desc: 'L\'ami qui t\'a fait découvrir le padel. Drôle, chanteur, le plus faible des trois.' },
  jean: { name: 'Jean Deuxbé', short: 'Jean', color: '#81c784', desc: 'Un collègue sympathique et fair-play. Régulier, jamais avare d\'un lob.' },
  raf: { name: 'Rafael « Raf » Tomatis', short: 'Raf', color: '#e57373', desc: 'Le meilleur du groupe. Arrogant et mauvais perdant.' },
  coach: { name: 'Coach Roméo', short: 'Coach', color: '#64b5f6', desc: 'L\'entraîneur du groupe. Exigeant mais juste. Son estime ouvre des portes.' },
  louka: { name: 'Louka', short: 'Louka', color: '#ba68c8', desc: 'Le joueur blessé dont tu as pris la place.', hidden: true },
};
export const START_REL = { eliott: 25, jean: 10, raf: -5, coach: 0, louka: 0 };

export const NAME = { eliott: 'Eliott', jean: 'Jean', raf: 'Raf', louka: 'Louka', me: 'toi' };
const pair = (ids) => ids.map((i) => NAME[i]).join(' et ');

// ================================================================== chapitre 1
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
    type: 'choice', venue: 'municipal', cast: ['me', 'eliott'], who: 'eliott', text: 'Alors, tu viens jeudi ?',
    options: [
      { label: 'Carrément, j\'ai toujours voulu essayer !', effects: { eliott: 8 }, after: [{ who: 'eliott', text: 'YES ! Jeudi, 19 h, au tennis municipal. Je te prête une raquette !' }], next: 'arrive' },
      { label: 'Le padel ? C\'est pas du tennis pour les flemmards ?', effects: { eliott: -2 }, set: { mocked: true }, after: [{ who: 'eliott', text: 'Pour les flemmards ?! Tu vas courir comme jamais. Des vitres, des smashs qui sortent du terrain… Jeudi, 19 h. Pas d\'excuse !' }], next: 'arrive' },
    ],
  },
  arrive: {
    type: 'scene', venue: 'municipal', ambiance: 'sunset', cast: ['me', 'coach', 'raf', 'jean', 'eliott'],
    effects: (c) => (c.f.mocked ? { raf: -4, jean: -3, coach: -4 } : {}),
    lines: (c) => [
      { who: 'coach', text: 'C\'est toi, le remplaçant de Louka ? Bienvenue. Moi c\'est Roméo. Ici on bosse, on s\'amuse aussi, mais d\'abord on bosse.' },
      { who: 'raf', text: 'Un débutant. Génial. On va passer la soirée à ramasser des balles.' },
      { who: 'jean', text: 'Laisse-le tranquille, Raf. Salut, moi c\'est Jean ! On a tous commencé un jour.' },
      c.f.mocked
        ? { who: 'eliott', text: 'Tadaaa ! Je vous présente ma recrue. Au téléphone, il m\'a dit que le padel c\'était « du tennis pour les flemmards ». Je vous le laisse !' }
        : { who: 'eliott', text: 'Tadaaa ! Je vous présente ma recrue. Il est nul, mais il est motivé !' },
      ...(c.f.mocked ? [{ who: 'raf', text: 'Du tennis pour les flemmards ?! Toi, je vais te faire courir.' }, { who: 'coach', text: 'On en reparlera après les exercices. Le flemmard.' }] : [{ who: 'me', text: 'Merci pour la présentation, Eliott…' }]),
      { who: 'coach', text: 'Allez, au boulot. On commence par le service.' },
    ],
    next: 'drill1',
  },
  drill1: { type: 'drill', drill: 'serve', label: 'Exercice 1 : le service', intro: 'Le service, c\'est le seul coup où personne ne t\'embête. Dix balles, vise la zone verte.', next: 'after1' },
  after1: {
    type: 'choice', venue: 'municipal', ambiance: 'sunset', cast: ['me', 'coach', 'raf'], who: 'coach', text: 'Pas mal pour une première fois. Le geste est raide, mais il y a quelque chose. Qu\'est-ce que tu en dis ?',
    options: [
      { label: 'Merci coach, j\'ai tout à apprendre.', effects: { coach: 6 }, after: [{ who: 'coach', text: 'Bonne réponse. Ceux qui croient tout savoir ne progressent plus.' }], next: 'drill2' },
      { label: 'Franchement, c\'était facile.', effects: { coach: -4, raf: 3 }, after: [{ who: 'raf', text: '*ricane* Facile ! Trois services sur dix dans la zone.' }, { who: 'coach', text: 'On verra si le lob est aussi « facile ».' }], next: 'drill2' },
    ],
  },
  drill2: { type: 'drill', drill: 'lob', label: 'Exercice 2 : le lob', intro: 'Je monte au filet et je n\'en bouge plus. Lobe-moi (touche lob), bien haut, bien profond.', next: 'pre_m2' },
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
    choice: {
      who: 'raf', text: 'Alors, le débutant, ça fait quoi de perdre ?',
      options: [
        { label: '« Rira bien qui rira le dernier, Raf. »', effects: { raf: -6, eliott: 3 }, set: { rivalRaf: true }, after: [{ who: 'raf', text: 'Oh, il mord ! J\'adore. On en reparlera quand tu sauras tenir une raquette.' }], next: 'jean_coach' },
        { label: '« Bien joué, vous étiez meilleurs. »', effects: { raf: 4, jean: 4, coach: 4 }, rep: 3, after: [{ who: 'raf', text: '… Euh. Merci. Enfin, évidemment qu\'on était meilleurs.' }], next: 'jean_coach' },
        { label: 'Ignorer Raf et ramasser les balles', effects: { coach: 2 }, after: [{ who: 'coach', text: '*hoche la tête* Bien.' }], next: 'jean_coach' },
      ],
    },
  },
  jean_coach: {
    type: 'scene', venue: 'municipal', ambiance: 'night', cast: ['me', 'coach', 'jean', 'eliott', 'raf'],
    lines: [
      { who: 'jean', text: 'Ne l\'écoute pas. Pour une première soirée, tu t\'es super bien débrouillé.' },
      { who: 'coach', text: 'Écoutez-moi tous les quatre. Dans deux semaines, il y a l\'Open de La Ciotat, un petit tournoi au club de tennis. Je veux vous inscrire, toi compris.' },
      { who: 'coach', text: 'Il me faut deux binômes.' },
    ],
    choice: {
      who: 'coach', text: 'Avec qui veux-tu jouer à La Ciotat ?',
      options: [
        { label: 'Eliott', sub: 'Le plus faible des trois, mais c\'est lui qui t\'a fait découvrir le padel. On s\'amuse, et c\'est un ami.', effects: { eliott: 20, raf: -5 }, set: { partner: 'eliott' }, next: 'end_eliott' },
        { label: 'Jean', sub: 'Pas mauvais, fair-play, sympathique. Le choix raisonnable.', effects: { jean: 15, eliott: -15, raf: -5 }, set: { partner: 'jean' }, next: 'end_jean' },
        { label: 'Raf', sub: 'Le meilleur des trois. Arrogant et mauvais perdant… mais il gagne.', effects: { raf: 15, eliott: -18, jean: -3, coach: -2 }, set: { partner: 'raf' }, next: 'end_raf' },
      ],
    },
  },
  end_eliott: {
    type: 'scene', venue: 'municipal', ambiance: 'night', cast: ['me', 'eliott', 'raf', 'jean'],
    lines: [
      { who: 'eliott', text: 'C\'EST VRAI ?! Toi et moi ! Je vais composer une chanson pour notre binôme. « Les Invaincus ». Enfin, en espérant.' },
      { who: 'raf', text: 'Parfait. Jean, on va leur apprendre la vie à La Ciotat.' },
      { who: 'jean', text: 'Bonne chance à vous deux ! Que le meilleur gagne.' },
    ],
    next: 'ch1_end',
  },
  end_jean: {
    type: 'scene', venue: 'municipal', ambiance: 'night', cast: ['me', 'jean', 'eliott', 'raf'],
    lines: [
      { who: 'jean', text: 'Avec plaisir ! On va bien s\'entendre, j\'en suis sûr.' },
      { who: 'eliott', text: 'Ahh… très bien. C\'est moi qui te ramène ici, et tu ne me prends pas. D\'accord. Très bien.' },
      { who: 'eliott', text: 'Non, non, je ne suis pas vexé. Un peu. Beaucoup. Bon… Jean joue mieux que moi, je comprends.' },
      { who: 'raf', text: 'Et moi je me retrouve avec le troubadour. Super.' },
    ],
    next: 'ch1_end',
  },
  end_raf: {
    type: 'scene', venue: 'municipal', ambiance: 'night', cast: ['me', 'raf', 'eliott', 'jean'],
    lines: [
      { who: 'raf', text: 'Enfin quelqu\'un d\'intelligent. Tu cours là où je te dis, et on gagne. Simple.' },
      { who: 'eliott', text: 'Ahh très bien… C\'est moi qui t\'ai fait venir, et tu choisis RAF ? Le gars qui s\'est moqué de toi toute la soirée ?' },
      { who: 'eliott', text: 'Bon. Je ne t\'en veux pas. Enfin si, un peu. Jean, on va leur montrer !' },
      { who: 'jean', text: 'Avec plaisir, Eliott. Allez, on y croit.' },
    ],
    next: 'ch1_end',
  },
  ch1_end: { type: 'end', chapter: 1, next: 'c2_start', text: (c) => `Ton partenaire pour l'Open de La Ciotat : ${NAME[c.partner]}. L'autre binôme : ${pair(c.friends)}.` },
};

// ================================================================== chapitre 2 : Open de La Ciotat
const bracket = (c, title, rows) => `<h4>${title}</h4><div class="br">${rows}</div>`;
const CH2 = {
  c2_start: {
    type: 'scene', venue: 'laciotat', ambiance: 'day', cast: (c) => ['me', c.partner, 'coach', ...c.friends],
    lines: (c) => [
      { who: 'coach', text: 'Bienvenue au Tennis de La Ciotat. Huit équipes, matchs en super tie-break. Venez, le tableau est affiché au club-house.' },
      {
        who: c.partner, text: c.partner === 'raf' ? 'Voyons qui on va écraser.' : 'Regarde, on est là !',
        sheet: bracket(c, 'OPEN DE LA CIOTAT — TABLEAU', `<div><span class="me">${'Toi'} / ${NAME[c.partner]}</span><span>Paire La Ciotat 3</span><span>Subrero / Ferreira</span><span>Vidal / Moreau</span><span>${pair(c.friends)}</span><span>Paire Cassis</span><span>Les Marseillais</span><span>Roy / Boulhol</span></div><div><span>1/2 finale</span><span>…</span><span>1/2 finale</span><span>…</span></div><div><span>FINALE</span></div>`),
      },
      { who: c.friends[0], text: 'Si on gagne nos deux matchs, on se retrouve en demi-finale !' },
      { who: 'coach', text: 'Et de l\'autre côté du tableau, Camille Roy et Timéo Boulhol. Les favoris. Concentrez-vous sur votre premier match.' },
      c.partner === 'eliott' ? { who: 'eliott', text: 'J\'ai répété ma danse de la victoire toute la nuit. Il ne nous manque plus que la victoire.' }
        : c.partner === 'jean' ? { who: 'jean', text: 'On joue simple, on joue ensemble. Le reste suivra.' }
          : { who: 'raf', text: 'Règle numéro un : tu me laisses les smashs. Règle numéro deux : tu me laisses les smashs.' },
    ],
    next: 'r1',
  },
  r1: { type: 'match', label: 'Tour 1', format: '2v2', mt: 10, venue: 'laciotat', ambiance: 'day', near: (c) => ['me', c.partner], far: ['random', 'random'], randomOvr: 30, rig: 'win', title: '1ER TOUR', subtitle: 'Open de La Ciotat', win: 'r1_line', lose: 'r1_line' },
  r1_line: {
    type: 'choice', venue: 'laciotat', cast: ['me', 'opp'], who: 'opp', text: 'Ta frappe sur la balle de match a frôlé la ligne… Elle était bonne ?',
    options: [
      { label: '« Elle était dehors, je te la laisse. »', rep: 8, effects: { coach: 4 }, after: [{ who: 'opp', text: 'Respect. Merci, c\'est rare.' }, { who: 'narr', text: 'Le point est rejoué… et vous le gagnez quand même. Le coach t\'a vu faire.' }], next: 'r2_pre' },
      { label: '« Bonne, sans hésiter. »', rep: -8, set: { lied: true }, after: [{ who: 'opp', text: 'Mouais… Si tu le dis.' }, { who: 'narr', text: 'Vous passez au tour suivant. Au bord du court, quelqu\'un secoue la tête.' }], next: 'r2_pre' },
    ],
  },
  r2_pre: {
    type: 'scene', venue: 'laciotat', ambiance: 'day', cast: (c) => ['me', c.partner, 'coach'],
    lines: (c) => [
      { who: 'coach', text: c.f.lied ? 'J\'ai vu la balle de match. On en reparlera. Concentre-toi.' : 'Bien. Deuxième tour : une paire jeune, assez régulière. Patience.' },
      { who: c.partner, text: c.partner === 'raf' ? 'Ceux-là, on les plie en dix minutes.' : 'On garde le même plan. Ensemble !' },
    ],
    next: 'r2',
  },
  r2: { type: 'match', label: 'Tour 2', format: '2v2', mt: 10, venue: 'laciotat', ambiance: 'day', near: (c) => ['me', c.partner], far: ['random', 'random'], randomOvr: 26, title: 'QUART DE FINALE', subtitle: 'Open de La Ciotat', win: 'watch_pre', lose: 'r2_lost' },
  r2_lost: {
    type: 'choice', venue: 'laciotat', cast: (c) => ['me', c.partner, 'coach'], who: 'narr', text: 'Éliminés en quart de finale. Tes amis, eux, jouent leur match en ce moment.',
    options: [
      { label: 'Rester pour encourager les copains', effects: { eliott: 5, jean: 5, raf: 2, coach: 3 }, set: { out: 'r2', stayed: true }, after: [{ who: 'coach', text: 'Bonne attitude. Viens, on se met au bord du court.' }], next: 'watch_lost' },
      { label: 'Partir directement', effects: { eliott: -6, jean: -3, coach: -3 }, set: { out: 'r2', stayed: false }, after: [{ who: 'narr', text: 'Tu ranges tes affaires et tu pars sans un mot. Plus tard, un message : « Rendez-vous au club-house ce soir. »' }], next: 'clubhouse' },
    ],
  },
  watch_lost: { type: 'watch', label: (c) => `Regarder ${pair(c.friends)}`, venue: 'laciotat', near: (c) => c.friends, far: ['random', 'random'], randomOvr: 28, title: 'DEMI-FINALE', start: [6, 5], next: 'lost_final_text' },
  lost_final_text: {
    type: 'text',
    pages: (c) => [
      { who: 'Narrateur', text: `${pair(c.friends)} gagnent leur demi-finale ! En finale, ils tombent sur Camille Roy et Timéo Boulhol, la paire montante de la région.` },
      { who: 'Narrateur', text: 'La finale est à sens unique : Camille sort trois balles par la porte, Timéo renvoie tout. Défaite 10-4, mais quel parcours.' },
    ],
    next: 'ceremony',
  },
  watch_pre: {
    type: 'scene', venue: 'laciotat', ambiance: 'day', spot: 'between', cast: (c) => ['me', c.partner],
    lines: (c) => [{ who: c.partner, text: `Demi-finale ! Viens, ${pair(c.friends)} jouent leur quart. Ça doit en être à la fin.` }],
    choice: {
      who: 'narr', text: (c) => `Vous arrivez au bord du court en fin de match. ${pair(c.friends)} mènent 7-6. Que fais-tu ?`,
      options: [
        { label: 'Les encourager à fond', set: { cheer: 'support' }, rep: 3, effects: { eliott: 6, jean: 6, raf: 3 }, after: (c) => [{ who: c.friends[0], text: 'Merci ! Ça fait plaisir de t\'entendre !' }], next: 'watch_friends' },
        { label: 'Les déconcentrer (sifflets, remarques…)', set: { cheer: 'disturb' }, rep: -6, effects: { eliott: -8, jean: -8, raf: -6, coach: -5 }, after: (c) => [{ who: c.friends[0], text: 'Sérieusement ?! Tu fais quoi, là ?' }], next: 'watch_friends' },
        { label: 'Regarder sans rien dire', set: { cheer: 'neutral' }, after: [{ who: 'narr', text: 'Tu observes leur jeu, en silence.' }], next: 'watch_friends' },
      ],
    },
  },
  watch_friends: { type: 'watch', label: (c) => `Fin du match de ${pair(c.friends)}`, venue: 'laciotat', near: (c) => c.friends, far: ['random', 'random'], randomOvr: 26, title: 'QUART DE FINALE', start: [7, 6], next: 'raf_cheat_branch' },
  raf_cheat_branch: { type: 'branch', to: (c) => (c.partner === 'raf' ? 'raf_cheat' : 'semi_pre') },
  raf_cheat: {
    type: 'scene', venue: 'laciotat', ambiance: 'day', cast: ['me', 'raf'],
    lines: [{ who: 'raf', text: 'Psst. Leurs sacs sont dans le vestiaire. Je desserre leurs grips et je dégonfle leurs balles neuves. Personne ne verra rien.' }],
    choice: {
      who: 'raf', text: 'Tu fais le guet ?',
      options: [
        { label: 'Essayer de le raisonner', after: [{ who: 'raf', text: 'Oh, ça va, le saint ! Tout le monde fait ça. Tu veux gagner ou pas ?' }], next: 'c_raf_cheat2' },
        { label: 'Faire le guet', rep: -12, set: { sabotage: true }, effects: { raf: 8 }, after: [{ who: 'narr', text: 'Deux minutes plus tard, Raf ressort du vestiaire en sifflotant.' }], next: 'semi_pre' },
      ],
    },
  },
  c_raf_cheat2: {
    type: 'choice', venue: 'laciotat', cast: ['me', 'ref', 'raf'], who: 'narr', text: 'Raf file vers le vestiaire. Le juge-arbitre est juste là.',
    options: [
      { label: 'Le dénoncer au juge-arbitre', rep: 12, set: { denounced: true }, effects: { raf: -25, coach: 10, jean: 6, eliott: 6 }, after: [{ who: 'ref', text: 'Monsieur Tomatis, un mot s\'il vous plaît. Avertissement officiel : au prochain écart, c\'est l\'exclusion.' }, { who: 'raf', text: '*te fusille du regard* … Tu me le paieras.' }], next: 'semi_pre' },
      { label: 'Laisser faire', rep: -6, set: { sabotage: true }, effects: { raf: 3 }, after: [{ who: 'narr', text: 'Tu détournes le regard. Raf revient, l\'air de rien.' }], next: 'semi_pre' },
    ],
  },
  semi_pre: {
    type: 'scene', venue: 'laciotat', ambiance: 'day', cast: (c) => ['me', c.partner, ...c.friends],
    lines: (c) => {
      const [a, b] = c.friends, ch = c.f.cheer;
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
  semi: { type: 'match', label: 'Demi-finale contre tes amis', format: '2v2', mt: 10, venue: 'laciotat', ambiance: 'day', near: (c) => ['me', c.partner], far: (c) => c.friends, hard: true, title: 'DEMI-FINALE', subtitle: 'Open de La Ciotat', win: 'final_pre', lose: 'semi_lost' },
  semi_lost: {
    type: 'scene', venue: 'laciotat', ambiance: 'day', spot: 'between', cast: (c) => ['me', c.partner, ...c.friends],
    effects: (c) => (c.partner === 'raf' ? { raf: -8 } : {}),
    lines: (c) => [
      { who: c.friends[0], text: c.f.cheer === 'disturb' ? 'Ça, c\'est pour les sifflets !' : 'Quel match ! Vous nous avez fait peur.' },
      { who: c.partner, text: c.partner === 'raf' ? 'C\'était ta faute. Trois retours dans le filet sur les points importants.' : 'On a tout donné. On reviendra plus forts.' },
    ],
    next: 'lost_final_text',
  },
  final_pre: {
    type: 'scene', venue: 'laciotat', ambiance: 'sunset', cast: (c) => ['me', c.partner, 'camille', 'timeo'],
    lines: (c) => [
      { who: 'camille', text: 'Salut. Vous êtes les surprises du tableau ? Bravo. Profitez de la finale.' },
      { who: 'timeo', text: 'On joue pas mal, hein. Juste pour prévenir.' },
      { who: c.partner, text: c.partner === 'raf' ? 'Prévenir ? On va vous éteindre.' : c.partner === 'eliott' ? 'Une finale ! Une FINALE ! Je vais pleurer.' : 'On va prendre du plaisir, et on verra.' },
    ],
    next: 'final',
  },
  final: { type: 'match', label: 'Finale contre Camille et Timéo', format: '2v2', mt: 10, venue: 'laciotat', ambiance: 'sunset', near: (c) => ['me', c.partner], far: ['timeo', 'camille'], rig: 'lose', title: 'FINALE', subtitle: 'Open de La Ciotat', set: { finalist: true }, win: 'ceremony', lose: 'ceremony' },
  ceremony: {
    type: 'scene', venue: 'laciotat', ambiance: 'sunset', spot: 'talk', cast: (c) => ['me', c.partner, 'payet', 'camille', 'timeo'],
    lines: (c) => [
      { who: 'payet', text: 'Bonsoir La Ciotat ! C\'est un plaisir de remettre les trophées de l\'Open. Les vainqueurs : Camille Roy et Timéo Boulhol !' },
      { who: 'camille', text: 'Merci Dimitri ! Et bravo aux finalistes, c\'était sérieux.' },
      c.f.finalist ? { who: 'payet', text: 'Et nos finalistes surprises ! Je ne vous connaissais pas. Belle main, belle envie. On va vous revoir.' }
        : { who: 'payet', text: `Et bravo à ${pair(c.friends)}, finalistes !` },
    ],
    next: 'clubhouse',
  },
  clubhouse: {
    type: 'scene', venue: 'laciotat', ambiance: 'night', spot: 'talk', cast: (c) => ['me', c.partner, ...c.friends, 'coach', 'louka'],
    lines: (c) => {
      const usBetter = !!c.f.finalist, met = !c.f.out;
      const [t0, t1] = c.friends;
      const L = [{ who: 'coach', text: 'Allez, la tournée est pour moi. À votre premier tournoi !' }];
      if (usBetter) {
        L.push({ who: c.partner, text: c.partner === 'raf' ? `Alors, ${NAME[t0]} ? Ça fait quoi de perdre contre le débutant ?` : met ? 'Désolé pour la demi, les gars… mais pas trop !' : 'On a eu de la chance sur le tirage.' });
        L.push({ who: t0, text: t0 === 'raf' ? 'Coup de chance. La prochaine fois, je vous détruis.' : t0 === 'eliott' ? 'Bon, vous étiez meilleurs. Mais j\'ai écrit une chanson sur notre défaite, elle est magnifique.' : 'Bravo, vraiment. Vous méritez votre finale.' });
      } else {
        L.push({ who: t0, text: t0 === 'raf' ? 'Finalistes ! Et vous, éliminés. Je dis ça, je dis rien.' : t0 === 'eliott' ? 'FINALISTES ! Et je t\'ai battu ! Pardon. Non, pas pardon.' : 'On a eu un peu de réussite aujourd\'hui. À charge de revanche !' });
        L.push({ who: t1, text: t1 === 'raf' ? 'Le troubadour et moi, finalistes. Le monde à l\'envers.' : 'Bien joué à vous aussi.' });
      }
      if (c.f.denounced) L.push({ who: 'raf', text: '*garde ses distances et ne trinque pas avec toi*' });
      if (c.f.cheer === 'disturb') L.push({ who: c.friends.includes('jean') ? 'jean' : t0, text: 'Et la prochaine fois, garde tes sifflets pour l\'équipe adverse.' });
      L.push({ who: 'coach', text: c.s.rep >= 10 ? 'Je suis fier de l\'attitude de tout le monde aujourd\'hui.' : c.s.rep <= -10 ? 'Le padel, c\'est aussi une question de comportement. Certains ici devraient y réfléchir.' : 'Bonne journée. Lundi, on se remet au travail.' });
      L.push({ who: 'louka', label: '???', text: '*Un jeune homme, une attelle à la cheville, vous fixe en silence depuis la table du fond. Il repose son verre et s\'en va.*' });
      return L;
    },
    set: { metLouka: true },
    next: 'ch2_end',
  },
  ch2_end: { type: 'end', chapter: 2, next: 'c3_start', text: (c) => `${c.f.finalist ? 'Finalistes de l\'Open de La Ciotat !' : c.f.out === 'r2' ? 'Éliminés en quart de finale.' : 'Demi-finalistes à La Ciotat.'} Réputation : ${c.s.rep > 0 ? '+' : ''}${c.s.rep}.` },
};

// ================================================================== chapitre 3 : le retour de Louka
const CH3 = {
  c3_start: {
    type: 'scene', venue: 'municipal', ambiance: 'sunset', cast: ['me', 'louka', 'coach', 'eliott', 'jean', 'raf'],
    lines: [
      { who: 'narr', text: 'Trois semaines plus tard. Jeudi, 19 h. Un joueur t\'attend devant le court, raquette à la main. Plus d\'attelle.' },
      { who: 'louka', text: 'Alors c\'est toi, le remplaçant. Moi c\'est Louka. Ma cheville va bien, merci de demander.' },
      { who: 'louka', text: 'Cet entraînement, c\'était ma place. Je la veux. Tu comprends, hein ?' },
      { who: 'eliott', text: 'Euh… c\'est gênant, là.' },
    ],
    choice: {
      who: 'louka', text: 'Tu me rends ma place ?',
      options: [
        { label: '« C\'est normal, je te la rends. »', rep: 6, effects: { louka: 15, coach: 6, jean: 4 }, set: { gaveBack: true }, next: 'c3_coach_five' },
        { label: '« Désolé, j\'y suis, j\'y reste. »', rep: -2, effects: { louka: -25, raf: 3 }, set: { rivalLouka: true }, after: [{ who: 'louka', text: 'D\'accord. Très bien. On se reverra sur un court. Et là, je ne serai pas blessé.' }], next: 'c3_four' },
      ],
    },
  },
  c3_coach_five: {
    type: 'scene', venue: 'municipal', ambiance: 'sunset', cast: ['me', 'coach', 'louka', 'eliott', 'jean', 'raf'],
    lines: [
      { who: 'coach', text: 'Stop. Personne ne rend sa place. Ce soir, on s\'entraîne à cinq.' },
      { who: 'coach', text: 'Trois ateliers : smash, lob, service. Je compte les points. Le dernier du classement… quitte le groupe à la fin de la soirée.' },
      { who: 'raf', text: 'Enfin un peu de compétition.' },
      { who: 'eliott', text: 'Pourquoi j\'ai l\'impression que c\'est de moi qu\'on parle ?' },
    ],
    next: 'c3_d1',
  },
  c3_d1: { type: 'drill', drill: 'smash', compete: true, label: 'Atelier 1 : le smash', intro: 'Sortez la balle. Je compte les points.', next: 'c3_d2' },
  c3_d2: { type: 'drill', drill: 'lob', compete: true, label: 'Atelier 2 : le lob', intro: 'Lobez-moi au fond, vraiment au fond.', next: 'c3_d3' },
  c3_d3: { type: 'drill', drill: 'serve', compete: true, label: 'Atelier 3 : le service', intro: 'Dernier atelier. Le service.', next: 'c3_rank' },
  c3_rank: {
    type: 'scene', venue: 'municipal', ambiance: 'night', cast: ['me', 'coach', 'eliott', 'louka', 'jean', 'raf'],
    lines: (c) => {
      const R = c.s.ranking || [];
      return [
        { who: 'coach', text: 'Le classement de la soirée.', sheet: `<h4>CLASSEMENT DE L'ENTRAÎNEMENT</h4><div class="br" style="grid-template-columns:1fr"><div>${R.map((r, i) => `<span class="${r.id === 'me' ? 'me' : ''}">${i + 1}. ${r.name} — ${r.pts} pts</span>`).join('')}</div></div>` },
        { who: 'coach', text: 'Eliott… dernier. Pas de beaucoup, mais dernier. Je suis désolé.' },
        { who: 'eliott', text: 'Super. Génial. C\'est MOI qui t\'ai amené ici, et c\'est moi qui pars. La vie est belle.' },
        { who: 'eliott', text: 'Tu sais quoi ? Je vais m\'entraîner ailleurs. Et au prochain tournoi, je vous sortirai. Toi en premier.' },
      ];
    },
    effects: { eliott: -30 },
    set: { rivalEliott: true },
    next: 'c3_tourn',
  },
  c3_four: {
    type: 'scene', venue: 'municipal', ambiance: 'night', cast: ['me', 'coach', 'eliott', 'jean', 'raf'],
    lines: [
      { who: 'coach', text: 'Bon. Louka ira s\'entraîner ailleurs, j\'imagine. On continue à quatre.' },
      { who: 'jean', text: 'Il avait l\'air vraiment remonté…' },
    ],
    next: 'c3_tourn',
  },
  c3_tourn: {
    type: 'scene', venue: 'municipal', ambiance: 'night', cast: (c) => ['me', 'coach', c.partner3, ...c.mates3],
    lines: (c) => [
      { who: 'coach', text: 'Samedi, il y a un tournoi à Ceyreste, un peu plus simple que La Ciotat. Je vous ai inscrits, les deux duos. Regardez l\'affiche.', sheet: '<h4>TOURNOI DE CEYRESTE</h4><div class="br" style="grid-template-columns:1fr"><div><span>Samedi · 8 équipes · super tie-break</span><span>Têtes d\'affiche : <b>Nathan Subrero</b> et ses copains de Cassis</span><span>Inscriptions à la buvette · Apéro offert par la mairie</span></div></div>' },
      { who: 'coach', text: c.f.rivalEliott && c.f.partner === 'eliott' ? `Eliott n'est plus là. Tu joueras avec Louka. ${pair(c.mates3)} jouent ensemble.` : `Tu gardes ${NAME[c.partner3]}. En face : ${pair(c.mates3)}.` },
      { who: c.partner3, text: c.partner3 === 'louka' ? 'Bon. Visiblement on est coéquipiers. On va voir ce que tu vaux.' : 'C\'est reparti !' },
    ],
    next: 'c3_cey',
  },
  c3_cey: {
    type: 'scene', venue: 'ceyreste', ambiance: 'day', spot: 'between', props: { gege: 'beer' }, cast: (c) => ['me', c.partner3, 'gege', 'momo'],
    lines: (c) => [
      { who: 'gege', text: '*arrive en titubant, une bière à la main* Salut les champions !' },
      { who: 'gege', text: 'Hé ! C\'est vous les jeunes ? Momo et moi on joue depuis… *hic* … depuis ce matin.' },
      { who: 'momo', text: 'Excusez Gégé, il a fêté son anniversaire. Hier. Et ce matin.' },
      { who: c.partner3, text: 'Euh… on y va doucement ?' },
    ],
    next: 'c3_r1',
  },
  c3_r1: { type: 'match', label: 'Tour 1 contre Gégé et Momo', format: '2v2', mt: 10, venue: 'ceyreste', ambiance: 'day', near: (c) => ['me', c.partner3], far: ['gege', 'momo'], rig: 'win', drunk: ['gege'], title: '1ER TOUR', subtitle: 'Tournoi de Ceyreste', win: 'c3_r2_pre', lose: 'c3_r2_pre' },
  c3_r2_pre: {
    type: 'scene', venue: 'ceyreste', ambiance: 'day', spot: 'between', cast: (c) => ['me', c.partner3, c.rival3, ...(c.rival3 === 'eliott' ? ['philippe'] : [])],
    lines: (c) => [
      { who: c.rival3, text: c.rival3 === 'eliott' ? 'Tiens, tiens. Je te présente mon nouveau partenaire : mon père. On joue le tour suivant. Contre vous.' : 'Deuxième tour : toi contre moi. Enfin.' },
      ...(c.rival3 === 'eliott' ? [{ who: 'philippe', text: 'Philippe Hanras. Enchanté. Eliott m\'a beaucoup parlé de vous… Pas toujours en bien.' }] : []),
      { who: c.partner3, text: 'Ça va chauffer.' },
    ],
    next: 'c3_r2',
  },
  c3_r2: { type: 'match', label: (c) => `Tour 2 contre ${NAME[c.rival3]} et son partenaire`, format: '2v2', mt: 10, venue: 'ceyreste', ambiance: 'day', near: (c) => ['me', c.partner3], far: (c) => [c.rival3, c.rival3 === 'eliott' ? 'philippe' : 'random'], randomOvr: 30, title: 'DEMI-FINALE', subtitle: 'Tournoi de Ceyreste', win: 'c3_r2_win', lose: 'c3_r2_lose' },
  c3_r2_win: {
    type: 'scene', venue: 'ceyreste', ambiance: 'day', cast: (c) => ['me', c.rival3], effects: (c) => ({ [c.rival3]: -5 }),
    lines: (c) => [{ who: c.rival3, text: c.rival3 === 'eliott' ? 'Pfff. La prochaine fois. J\'ai un nouveau revers, je te préviens.' : 'Ça ne compte pas. Ma cheville. La prochaine fois.' }],
    next: 'c3_final_pre',
  },
  c3_r2_lose: {
    type: 'scene', venue: 'ceyreste', ambiance: 'day', cast: (c) => ['me', c.rival3, c.partner3],
    lines: (c) => [
      { who: c.rival3, text: c.rival3 === 'eliott' ? 'YES ! Je t\'avais dit que je te sortirais ! Et un, et deux, et trois… éliminés !' : 'Voilà. Ma place, je l\'ai gagnée sur le court.' },
      { who: c.partner3, text: 'On a été trop timides. Ils ont joué leur meilleur match.' },
    ],
    next: 'c3_end_lost',
  },
  c3_end_lost: {
    type: 'text',
    pages: (c) => [{ who: 'Narrateur', text: `${pair(c.mates3)} remportent le tournoi de Ceyreste en finale contre ${NAME[c.rival3]}. Le maire leur remet la coupe ; tu regardes depuis la buvette.` }],
    next: 'c3_ceremony_lose',
  },
  c3_final_pre: {
    type: 'scene', venue: 'ceyreste', ambiance: 'sunset', cast: (c) => ['me', c.partner3, ...c.mates3],
    lines: (c) => [
      { who: c.mates3[0], text: 'Finale entre collègues ! Le coach va être fier… de l\'un de nos deux binômes.' },
      { who: c.mates3[1], text: c.mates3.includes('raf') && c.mates3[1] === 'raf' ? 'Je préviens : je ne fais pas de cadeau aux débutants.' : 'Bon match à vous !' },
    ],
    next: 'c3_final',
  },
  c3_final: {
    type: 'match', label: 'Finale contre tes collègues', format: '2v2', mt: 10, venue: 'ceyreste', ambiance: 'sunset', near: (c) => ['me', c.partner3], far: (c) => c.mates3, hard: true, title: 'FINALE', subtitle: 'Tournoi de Ceyreste',
    // situation de triche / fair-play pendant le match
    mid: {
      at: 8,
      who: 'narr', text: (c) => `Une balle de ${NAME[c.mates3[0]]} tombe pile sur la ligne, de ton côté. Personne n'a bien vu… sauf toi.${c.partner3 === 'raf' ? ' Raf te fait de grands signes : « Dis faute ! »' : ''}`,
      options: [
        { label: 'Annoncer « bonne » : le point est pour eux', rep: 8, effects: (c) => ({ coach: 5, [c.mates3[0]]: 6, [c.mates3[1]]: 6 }), point: 'them', after: (c) => [{ who: c.mates3[0], text: 'Merci, c\'est classe.' }] },
        { label: 'Crier « faute ! » : le point est pour vous', rep: -10, effects: (c) => ({ coach: -6, [c.mates3[0]]: -8, [c.mates3[1]]: -8, raf: c.partner3 === 'raf' ? 5 : 0 }), point: 'us', set: { cheatedFinal: true }, after: (c) => [{ who: c.mates3[0], text: 'Faute ?! Elle était sur la ligne ! … Bon. Si tu le dis.' }] },
      ],
    },
    win: 'c3_ceremony_win', lose: 'c3_ceremony_lose',
  },
  c3_ceremony_win: {
    type: 'scene', venue: 'ceyreste', ambiance: 'sunset', spot: 'talk', cast: (c) => ['me', c.partner3, 'mayor', ...c.mates3],
    lines: (c) => [{ who: 'mayor', text: 'Mesdames et messieurs, les vainqueurs du tournoi de Ceyreste ! Un petit discours ?' }],
    choice: {
      who: 'mayor', text: 'Le micro est à toi.',
      options: [
        { label: 'Discours humble : remercier les adversaires et le coach', rep: 6, effects: (c) => ({ coach: 6, [c.mates3[0]]: 6, [c.mates3[1]]: 6 }), after: (c) => [{ who: 'me', text: `Merci au coach Roméo, et bravo à ${pair(c.mates3)} : on s'entraîne ensemble, ils nous poussent chaque semaine.` }, { who: c.mates3[0], text: 'Joli. Bien joué à vous.' }], next: 'c3_drink' },
        { label: 'Discours arrogant : rabaisser les adversaires', rep: -8, effects: (c) => ({ coach: -6, [c.mates3[0]]: -12, [c.mates3[1]]: -12, raf: c.partner3 === 'raf' ? 6 : 0 }), set: { arrogant: true }, after: (c) => [{ who: 'me', text: `Franchement ? C'était facile. ${pair(c.mates3)}, revenez quand vous saurez jouer.` }, { who: c.mates3[0], text: '… Sérieux ? Devant tout le monde ?' }], next: 'c3_drink' },
      ],
    },
    set: { wonCey: true },
  },
  c3_ceremony_lose: {
    type: 'scene', venue: 'ceyreste', ambiance: 'sunset', spot: 'talk', cast: (c) => ['me', c.partner3, 'mayor', ...c.mates3],
    lines: (c) => [{ who: 'mayor', text: `Les vainqueurs du tournoi de Ceyreste : ${pair(c.mates3)} ! Applaudissez-les bien fort !` }],
    choice: {
      who: 'narr', text: (c) => `${pair(c.mates3)} lèvent la coupe. Tout le monde applaudit.`,
      options: [
        { label: 'Applaudir tes collègues', rep: 4, effects: (c) => ({ [c.mates3[0]]: 5, [c.mates3[1]]: 5, coach: 3 }), after: (c) => [{ who: c.mates3[0], text: 'Merci ! Ça me touche.' }], next: 'c3_drink' },
        { label: 'Croiser les bras', rep: -5, effects: (c) => ({ [c.mates3[0]]: -6, [c.mates3[1]]: -6, coach: -3 }), set: { sulked: true }, after: [{ who: 'narr', text: 'Le coach t\'a vu. Il ne dit rien, mais il n\'en pense pas moins.' }], next: 'c3_drink' },
      ],
    },
  },
  c3_drink: {
    type: 'scene', venue: 'ceyreste', ambiance: 'night', spot: 'talk', cast: (c) => ['me', c.partner3, ...c.mates3, 'coach', c.rival3],
    lines: (c) => [
      { who: 'coach', text: 'À la buvette ! Ce soir, c\'est Ceyreste qui régale.' },
      c.f.wonCey ? { who: c.mates3[0], text: c.f.arrogant ? 'Tu peux garder ta coupe ET ton discours.' : 'Bravo encore. La revanche à l\'entraînement jeudi !' }
        : { who: c.mates3[0], text: c.f.sulked ? 'Pas un applaudissement… sympa.' : 'À la nôtre ! Et à la revanche !' },
      c.f.cheatedFinal ? { who: c.mates3[1], text: 'Et la balle sur la ligne… on sait tous les deux qu\'elle était bonne.' } : { who: c.mates3[1], text: 'Belle finale, vraiment.' },
      c.f.rivalEliott ? { who: 'eliott', text: '*range sa raquette dans son sac, à l\'écart, sans un regard pour toi*' } : { who: 'louka', text: '*discute à l\'écart avec un coach inconnu, et te jette un regard noir*' },
    ],
    next: 'ch3_end',
  },
  ch3_end: { type: 'end', chapter: 3, next: 'c4_bus', text: (c) => `${c.f.wonCey ? 'Vainqueur du tournoi de Ceyreste !' : 'Fin du tournoi de Ceyreste.'} Rival : ${c.f.rivalEliott ? 'Eliott' : 'Louka'}. Réputation : ${c.s.rep > 0 ? '+' : ''}${c.s.rep}. ` },
};

// ================================================================== chapitre 4 : le tournoi de la Riviera
const CH4 = {
  c4_bus: {
    type: 'scene', venue: 'municipal', ambiance: 'day', spot: 'bus', bus: true, cast: (c) => ['me', 'mayor', 'coach', ...c.group4],
    lines: (c) => [
      { who: 'mayor', text: 'Mes champions ! Grâce à mon ami Stéphane Ruffier, j\'ai obtenu cinq places au tournoi des célébrités du Riviera Padel Palace. Tout le monde en minibus !' },
      { who: 'coach', text: 'Le Riviera… Je n\'y ai pas remis les pieds depuis longtemps.' },
      { who: c.group4[0], text: c.group4.includes('raf') && c.group4[0] === 'raf' ? 'Je prends la place devant. Je suis le meilleur, je mérite la vue.' : 'Des célébrités ?! Il va y avoir des footballeurs ?' },
      { who: 'mayor', text: 'Des footballeurs, des humoristes, et même quelques joueurs pros. En route ! Et pas de chips dans le minibus.' },
    ],
    next: 'c4_arrive',
  },
  c4_arrive: {
    type: 'scene', venue: 'prestige', ambiance: 'day', spot: 'talk', cast: (c) => ['me', 'ruffier', 'mayor', 'coach', c.partner3],
    lines: (c) => [
      { who: 'mayor', text: 'Stéphane ! Toujours en forme ? Je te présente mes petits protégés.' },
      { who: 'ruffier', text: 'Bienvenue au Riviera ! Ici, c\'est spécial : tous les matchs se jouent en 3 points. Le premier à 3 gagne. Ça va très vite, il ne faut rien laisser filer.' },
      { who: 'ruffier', text: 'Il y a du beau monde aujourd\'hui. Profitez… et méfiez-vous de ceux qui parlent beaucoup.' },
      { who: 'ruffier', text: '*remarque le coach* … Roméo ? Ça fait des années.' },
      { who: 'coach', text: '*sec* Stéphane.' },
      { who: c.partner3, text: 'Ils se connaissent ? Il y a un malaise, non ?' },
    ],
    next: 'c4_r1',
  },
  c4_r1: { type: 'match', label: 'Tour 1 contre Philippe Lacheau et Romain Sichez', format: '2v2', mt: 3, sudden: true, venue: 'prestige', ambiance: 'day', near: (c) => ['me', c.partner3], far: ['lacheau', 'sichez'], title: '1ER TOUR · 3 POINTS', subtitle: 'Tournoi de la Riviera', win: 'c4_whisper', lose: 'c4_whisper', set: {} },
  c4_whisper: {
    type: 'scene', venue: 'prestige', ambiance: 'day', spot: 'between', cast: (c) => ['me', 'veteran', c.partner3],
    lines: (c) => [
      { who: 'veteran', text: 'Vous êtes les élèves de Roméo ? Ha ! Roméo Vidal… En 2015, il était le grand espoir. Finale ici même, au Riviera.' },
      { who: 'veteran', text: 'Et puis on a retrouvé les grips de ses adversaires sabotés. Suspendu deux ans. Il n\'a jamais rejoué.' },
      { who: c.partner3, text: 'Roméo ? Tricheur ? Je n\'y crois pas…' },
    ],
    set: { knowsRomeo: true },
    next: 'c4_r2_pre',
  },
  c4_r2_pre: {
    type: 'scene', venue: 'prestige', ambiance: 'day', cast: (c) => ['me', 'nasri', 'mandanda', c.partner3],
    lines: [
      { who: 'nasri', text: 'C\'est vous les petits du maire ? Je vais être gentil : je vous laisse marquer un point. Peut-être.' },
      { who: 'mandanda', text: 'Samir, sois sympa. Bon match les gars.' },
    ],
    next: 'c4_r2',
  },
  c4_r2: {
    type: 'match', label: 'Tour 2 contre Samir Nasri et Steve Mandanda', format: '2v2', mt: 3, sudden: true, venue: 'prestige', ambiance: 'day', near: (c) => ['me', c.partner3], far: ['nasri', 'mandanda'], title: 'QUART DE FINALE · 3 POINTS', subtitle: 'Tournoi de la Riviera',
    mid: {
      at: 1,
      who: 'nasri', text: 'Dehors ! Elle était dehors, celle-là. Point pour nous.',
      options: [
        { label: '« Non, elle était bonne. Rejoue le point. »', rep: 4, set: { contestNasri: true }, after: [{ who: 'nasri', text: '… Ah ouais ? T\'as du caractère, toi. Bon, on rejoue.' }] },
        { label: 'Ne rien dire', point: 'them', after: [{ who: 'nasri', text: '*sourire en coin* Merci, merci.' }] },
      ],
    },
    win: 'c4_after_r2', lose: 'c4_after_r2_lose',
  },
  c4_after_r2: {
    type: 'scene', venue: 'prestige', ambiance: 'day', spot: 'between', cast: (c) => ['me', 'nasri', 'mandanda', c.partner3],
    lines: (c) => [
      c.f.contestNasri ? { who: 'nasri', text: 'Respect. Du répondant sur le terrain ET dans la parole. Ça me plaît. Tiens, mon numéro, si un jour vous cherchez un sparring.' } : { who: 'nasri', text: 'Bien joué. Vous avez eu de la chance.' },
      { who: 'mandanda', text: 'Bravo les jeunes, vraiment.' },
    ],
    effects: (c) => (c.f.contestNasri ? { coach: 4 } : {}),
    set: (c) => ({ contactNasri: !!c.f.contestNasri }),
    next: 'c4_romeo_clash',
  },
  c4_after_r2_lose: {
    type: 'scene', venue: 'prestige', ambiance: 'day', spot: 'between', cast: (c) => ['me', 'nasri', 'mandanda', c.partner3],
    lines: (c) => [
      c.f.contestNasri ? { who: 'nasri', text: 'Vous perdez, mais respect : du répondant sur le terrain et dans la parole. Gardez mon numéro.' } : { who: 'nasri', text: 'Pas mal pour des débutants. Allez, bonne fin de tournoi.' },
      { who: c.partner3, text: 'Éliminés… mais on a joué contre Nasri et Mandanda !' },
    ],
    set: (c) => ({ contactNasri: !!c.f.contestNasri, outRiviera: 'r2' }),
    next: 'c4_romeo_clash',
  },
  c4_romeo_clash: {
    type: 'scene', venue: 'prestige', ambiance: 'sunset', spot: 'talk', cast: (c) => ['me', 'coach', 'veteran', c.partner3],
    lines: [
      { who: 'veteran', text: 'Roméo Vidal ! Revenu sur les lieux du crime ? Tes élèves savent ce que tu as fait en 2015 ?' },
      { who: 'coach', text: 'Je n\'ai rien saboté. Je l\'ai dit à l\'époque, personne ne m\'a cru. Ça n\'a pas changé.' },
      { who: 'veteran', text: 'Bien sûr. Les grips se sont desserrés tout seuls.' },
      { who: 'coach', text: '*s\'éloigne sans un mot*' },
    ],
    next: 'c4_hanouna_branch',
  },
  c4_hanouna_branch: { type: 'branch', to: (c) => (c.f.outRiviera ? 'c4_press' : 'c4_hanouna') },
  c4_hanouna: {
    type: 'scene', venue: 'prestige', ambiance: 'sunset', spot: 'between', cast: (c) => ['me', 'hanouna'],
    lines: [
      { who: 'hanouna', text: 'Eh ! Viens, viens. Tu me connais, hein ? Bon. Demi-finale : toi contre moi. J\'ai parié gros avec Ben Arfa que je vais en finale.' },
      { who: 'hanouna', text: 'Tu perds tranquille, et je te fais un virement. Mille euros. Personne ne saura. Alors ?' },
    ],
    choice: {
      who: 'hanouna', text: 'On fait affaire ?',
      options: [
        { label: 'Accepter : perdre la demi-finale contre 1 000 €', rep: -15, set: { bribed: true }, after: [{ who: 'hanouna', text: 'Voilà ! Un homme d\'affaires ! Et surtout, fais semblant de te battre, hein.' }], next: 'c4_semi' },
        { label: 'Refuser et le battre sur le court', rep: 6, after: [{ who: 'hanouna', text: 'Ah, un idéaliste. Tant pis pour toi, je vais te faire danser.' }], next: 'c4_semi' },
      ],
    },
  },
  c4_semi: { type: 'match', label: 'Demi-finale contre Cyril Hanouna et Hatem Ben Arfa', format: '2v2', mt: 3, sudden: true, venue: 'prestige', ambiance: 'sunset', near: (c) => ['me', c.partner3], far: ['hanouna', 'benarfa'], title: 'DEMI-FINALE · 3 POINTS', subtitle: 'Tournoi de la Riviera', win: 'c4_semi_win', lose: 'c4_semi_lose' },
  c4_semi_win: {
    type: 'scene', venue: 'prestige', ambiance: 'sunset', spot: 'between', cast: (c) => ['me', 'hanouna', c.partner3],
    lines: (c) => [
      c.f.bribed ? { who: 'hanouna', text: 'QUOI ?! Tu avais accepté ! Pas de virement, et tu vas en entendre parler dans mon émission !' } : { who: 'hanouna', text: 'Bon… bien joué. T\'as du cran, toi. Je t\'invite sur le plateau un de ces jours.' },
      { who: c.partner3, text: 'LA FINALE ! On est en finale du Riviera !' },
    ],
    effects: (c) => (c.f.bribed ? { coach: -2 } : { coach: 4 }),
    set: (c) => (c.f.bribed ? { hanounaEnemy: true } : { contactHanouna: true }),
    next: 'c4_final_pre',
  },
  c4_semi_lose: {
    type: 'scene', venue: 'prestige', ambiance: 'sunset', spot: 'between', cast: (c) => ['me', 'hanouna', c.partner3],
    lines: (c) => [
      c.f.bribed ? { who: 'hanouna', text: '*glisse discrètement* Parfait, l\'argent est parti. Un plaisir de faire des affaires.' } : { who: 'hanouna', text: 'Et voilà ! Finale ! Sans tricher, en plus. Enfin… presque.' },
      { who: c.partner3, text: c.f.bribed ? 'Attends… tu as fait exprès de rater ce smash ?' : 'Dommage, on y était presque.' },
    ],
    effects: (c) => (c.f.bribed ? { [c.partner3]: -10 } : {}),
    set: (c) => (c.f.bribed ? { money: 1000 } : {}),
    next: 'c4_press',
  },
  c4_final_pre: {
    type: 'scene', venue: 'prestige', ambiance: 'night', cast: (c) => ['me', 'tapia', 'coello', c.partner3],
    lines: [
      { who: 'tapia', text: 'Hola ! Finale d\'exhibition contre nous. Profitez, c\'est du spectacle.' },
      { who: 'coello', text: 'Trois points, rapides. On ne va pas vous faire mal… beaucoup.' },
    ],
    next: 'c4_final',
  },
  c4_final: { type: 'match', label: 'Finale contre Agustín Tapia et Arturo Coello', format: '2v2', mt: 3, sudden: true, venue: 'prestige', ambiance: 'night', near: (c) => ['me', c.partner3], far: ['tapia', 'coello'], rig: 'lose', title: 'FINALE · 3 POINTS', subtitle: 'Tournoi de la Riviera', set: { finalRiviera: true }, win: 'c4_press', lose: 'c4_press' },
  c4_press: {
    type: 'scene', venue: 'prestige', ambiance: 'night', spot: 'talk', cast: (c) => ['me', 'journalist', 'coach', 'mayor'],
    lines: (c) => [
      { who: 'journalist', text: `${c.f.finalRiviera ? 'Finalistes du Riviera face à Tapia et Coello !' : 'Belle première au Riviera !'} Une question : votre coach, Roméo Vidal, a été suspendu en 2015 pour sabotage. Vous le saviez ?` },
    ],
    choice: {
      who: 'journalist', text: 'Que pensez-vous de votre entraîneur ?',
      options: [
        { label: 'Prendre sa défense publiquement', rep: 6, effects: { coach: 25 }, set: { defendRomeo: true }, after: [{ who: 'me', text: 'Roméo nous a tout appris, et il nous apprend surtout à jouer propre. Je le crois quand il dit qu\'il n\'a rien fait.' }, { who: 'coach', text: '*la voix serrée* … Merci.' }], next: 'c4_end_scene' },
        { label: 'Le lyncher publiquement', rep: -8, effects: { coach: -50 }, set: { enemyRomeo: true }, after: [{ who: 'me', text: 'Franchement ? Un tricheur reste un tricheur. Je ne sais pas si je vais continuer avec lui.' }, { who: 'coach', text: '*se lève et quitte la salle sans un mot*' }, { who: 'mayor', text: 'Oh là là… ça, c\'était pas malin.' }], next: 'c4_end_scene' },
        { label: '« Pas de commentaire. »', after: [{ who: 'journalist', text: 'Très bien. Merci.' }], next: 'c4_end_scene' },
      ],
    },
  },
  c4_end_scene: {
    type: 'scene', venue: 'prestige', ambiance: 'night', spot: 'talk', cast: (c) => ['me', 'ruffier', 'mayor', c.partner3],
    lines: (c) => {
      const L = [{ who: 'ruffier', text: 'Belle journée. Tiens, ma carte. Si un jour tu veux t\'entraîner avec des gens sérieux, appelle-moi.' }];
      if (c.f.contactNasri) L.push({ who: 'narr', text: 'Dans ton téléphone : Stéphane Ruffier, Samir Nasri.' });
      if (c.f.contactHanouna) L.push({ who: 'narr', text: 'Et une invitation sur le plateau de Cyril Hanouna.' });
      if (c.f.enemyRomeo) L.push({ who: 'mayor', text: 'Roméo est rentré seul en taxi. Le minibus va être calme au retour…' });
      else if (c.f.defendRomeo) L.push({ who: 'ruffier', text: '*à voix basse* Tu as bien fait de le défendre. En 2015… je n\'ai jamais cru à cette histoire non plus.' });
      L.push({ who: 'mayor', text: 'Allez, tout le monde au minibus ! Et cette fois, j\'ai acheté des chips.' });
      return L;
    },
    set: { contacts: true },
    next: 'ch4_end',
  },
  ch4_end: { type: 'end', chapter: 4, text: (c) => `${c.f.finalRiviera ? 'Finaliste du tournoi de la Riviera !' : 'Tournoi de la Riviera terminé.'} Nouveaux contacts : Ruffier${c.f.contactNasri ? ', Nasri' : ''}${c.f.contactHanouna ? ', Hanouna' : ''}. ${c.f.enemyRomeo ? 'Roméo est désormais ton ennemi.' : c.f.defendRomeo ? 'Roméo te fait confiance.' : ''} Réputation : ${c.s.rep > 0 ? '+' : ''}${c.s.rep}.` },
};

export const CHAPTERS = { 1: 'Chapitre 1 · Le commencement', 2: 'Chapitre 2 · L\'Open de La Ciotat', 3: 'Chapitre 3 · Le retour de Louka', 4: 'Chapitre 4 · Le tournoi de la Riviera', 5: 'Chapitre 5 · Bientôt' };
export const STEPS = { ...CH1, ...CH2, ...CH3, ...CH4 };
export const chapterOf = (id) => (id in CH4 ? 4 : id in CH3 ? 3 : id in CH2 ? 2 : 1);
