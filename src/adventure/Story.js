// ============================================================================
//  Mode Aventure — histoire et choix.
//
//  Chapitre 1 « Le commencement » : Eliott nous fait découvrir le padel parce
//  que Louka s'est blessé à la cheville. Premier entraînement avec le coach
//  Rémi, Raf, Jean et Eliott ; deux exercices, un petit match, puis un super
//  tie-break (secrètement imperdable pour Raf et Jean) ; cinématique, puis le
//  coach veut nous inscrire au tournoi de Ceyreste : choix du partenaire.
//
//  Relations (-100..100) : eliott, jean, raf, coach (estime), louka.
// ============================================================================

export const PEOPLE = {
  eliott: { name: 'Eliott Hanras', short: 'Eliott', color: '#ffb74d', desc: 'L\'ami qui t\'a fait découvrir le padel. Drôle, chanteur, le plus faible des trois.' },
  jean: { name: 'Jean Deuxbé', short: 'Jean', color: '#81c784', desc: 'Un collègue sympathique et fair-play. Régulier, jamais avare d\'un lob.' },
  raf: { name: 'Rafael « Raf » Tomatis', short: 'Raf', color: '#e57373', desc: 'Le meilleur du groupe. Arrogant et mauvais perdant.' },
  coach: { name: 'Coach Rémi', short: 'Coach', color: '#64b5f6', desc: 'L\'entraîneur du groupe. Exigeant mais juste. Son estime ouvre des portes.' },
  louka: { name: 'Louka', short: 'Louka', color: '#ba68c8', desc: 'Le joueur blessé dont tu as pris la place.', hidden: true },
};

export const START_REL = { eliott: 25, jean: 10, raf: -5, coach: 0, louka: 0 };

/**
 * Étapes du chapitre 1. Types :
 *  text   : pages de récit (narrateur / personnages), puis éventuellement un choix
 *  choice : question avec options { label, sub, effects:{rel}, set:{flag}, next }
 *  drill  : exercice d'entraînement (Game, mode drill)
 *  match  : match (Game) ; rig = imperdable pour l'adversaire
 *  end    : fin de chapitre
 */
export const CHAPTER1 = {
  id: 1,
  title: 'Chapitre 1 · Le commencement',
  steps: {
    start: {
      type: 'text',
      pages: [
        { who: 'Narrateur', text: 'Un mardi soir comme les autres. Ton téléphone vibre : c\'est Eliott, ton ami de toujours — celui qui chante faux sous la douche et qui joue au padel trois fois par semaine.' },
        { who: 'Eliott', text: 'Allô ?! Écoute, c\'est la catastrophe. Louka s\'est tordu la cheville dimanche, il est out pour des semaines. À l\'entraînement de padel on n\'est plus que trois, et à trois… ben on ne peut pas jouer.' },
        { who: 'Eliott', text: 'Alors voilà : viens jeudi ! Tu n\'as jamais joué ? Pas grave. Le coach est cool, enfin… exigeant. Et il y a Raf. Bon. Tu verras pour Raf.' },
      ],
      next: 'c_invite',
    },
    c_invite: {
      type: 'choice',
      who: 'Eliott', text: 'Alors, tu viens ?',
      options: [
        { label: 'Carrément, j\'ai toujours voulu essayer !', effects: { eliott: 8 }, next: 'arrive' },
        { label: 'Le padel ? C\'est pas du tennis pour les flemmards ?', sub: 'Eliott va te faire changer d\'avis', effects: { eliott: -2 }, next: 'explain' },
      ],
    },
    explain: {
      type: 'text',
      pages: [
        { who: 'Eliott', text: 'Pour les flemmards ?! Tu vas courir comme jamais. Il y a des vitres, tu peux jouer la balle après le rebond sur la vitre, faire sortir la balle du terrain au smash… Jeudi, 19 h, au tennis municipal. Pas d\'excuse !' },
        { who: 'Narrateur', text: 'Tu acceptes, un peu par curiosité, beaucoup pour Eliott.' },
      ],
      next: 'arrive',
    },
    arrive: {
      type: 'text',
      pages: [
        { who: 'Narrateur', text: 'Jeudi, 19 h. Le court de padel du tennis municipal, ses vitres, son grillage vert. Trois silhouettes s\'échauffent déjà. Un homme en casquette, chronomètre autour du cou, t\'attend.' },
        { who: 'Coach Rémi', text: 'C\'est toi, le remplaçant de Louka ? Bienvenue. Moi c\'est Rémi. Ici, on bosse, on s\'amuse aussi, mais d\'abord on bosse.' },
        { who: 'Raf', text: 'Un débutant. Génial. On va passer la soirée à ramasser des balles.' },
        { who: 'Jean', text: 'Laisse-le tranquille, Raf. Salut, moi c\'est Jean ! Tu vas voir, on a tous commencé un jour.' },
        { who: 'Eliott', text: 'Tadaaa ! Je vous présente ma recrue. Il est nul, mais il est motivé !' },
      ],
      next: 'drill1',
    },
    drill1: { type: 'drill', drill: 'serve', label: 'Exercice 1 : le service', intro: 'On commence par le service. C\'est le seul coup où personne ne t\'embête. Dix balles, vise la zone verte.', next: 'after1' },
    after1: {
      type: 'choice',
      who: 'Coach Rémi', text: 'Pas mal pour une première fois. Le geste est raide, mais il y a quelque chose. Qu\'est-ce que tu en dis ?',
      options: [
        { label: 'Merci coach, j\'ai tout à apprendre.', effects: { coach: 6 }, next: 'drill2' },
        { label: 'Franchement, c\'était facile.', sub: 'Raf ricane', effects: { coach: -4, raf: 3 }, next: 'drill2' },
      ],
    },
    drill2: { type: 'drill', drill: 'lob', label: 'Exercice 2 : le lob', intro: 'Maintenant, je monte au filet et je n\'en bouge plus. Lobe-moi, bien haut, bien profond.', next: 'pre_match1' },
    pre_match1: {
      type: 'text',
      pages: [
        { who: 'Coach Rémi', text: 'Bien. Petit match pour voir ce que tu donnes en vrai : un tie-break en simple contre Jean. Premier à 7 points.' },
        { who: 'Jean', text: 'Je ne vais pas te faire de cadeau, hein ! Enfin… un peu quand même.' },
      ],
      next: 'match1',
    },
    match1: { type: 'match', id: 'm1', label: 'Tie-break contre Jean', next: 'after_m1' },
    after_m1: { type: 'result', win: 'after_m1_win', lose: 'after_m1_lose' },
    after_m1_win: {
      type: 'text', effects: { coach: 6, jean: 4 },
      pages: [
        { who: 'Jean', text: 'Bah dis donc ! Tu es sûr que tu n\'as jamais joué ? Bravo, sincèrement.' },
        { who: 'Raf', text: 'Jean a joué avec la main gauche, c\'est tout.' },
        { who: 'Coach Rémi', text: 'Intéressant… Allez, dernier match de la soirée.' },
      ],
      next: 'pre_match2',
    },
    after_m1_lose: {
      type: 'text', effects: { jean: 3 },
      pages: [
        { who: 'Jean', text: 'Bien joué quand même ! Pour un premier match, tu m\'as fait courir.' },
        { who: 'Coach Rémi', text: 'Le placement est là. Le reste viendra. Allez, dernier match de la soirée.' },
      ],
      next: 'pre_match2',
    },
    pre_match2: {
      type: 'text',
      pages: [
        { who: 'Coach Rémi', text: 'On finit par un super tie-break en double. Eliott avec le nouveau, Raf avec Jean. Premier à 10 points, deux d\'écart.' },
        { who: 'Raf', text: 'Le débutant et le troubadour. Ça va être rapide.' },
        { who: 'Eliott', text: 'Et un, et deux, et trois… padel ! On va les manger !' },
      ],
      next: 'match2',
    },
    match2: { type: 'match', id: 'm2', label: 'Super tie-break avec Eliott', next: 'after_m2' },
    after_m2: {
      type: 'choice',
      who: 'Raf', text: 'HAHA ! 10 à rien… ou presque. Le duo des champions ! Eliott, tu as recruté un ami à ton niveau, c\'est mignon.',
      options: [
        { label: '« Rira bien qui rira le dernier, Raf. »', sub: 'Tu le provoques', effects: { raf: -6, eliott: 3 }, set: { rivalRaf: true }, next: 'jean_coach' },
        { label: '« Bien joué, vous étiez meilleurs. »', sub: 'Tu restes beau joueur', effects: { raf: 4, jean: 4, coach: 4 }, next: 'jean_coach' },
        { label: 'Ignorer Raf et ramasser les balles', effects: { coach: 2 }, next: 'jean_coach' },
      ],
    },
    jean_coach: {
      type: 'text',
      pages: [
        { who: 'Jean', text: 'Ne l\'écoute pas. Pour une première soirée, tu t\'es super bien débrouillé. Franchement, bravo.' },
        { who: 'Eliott', text: 'Désolé… j\'étais pas dans un grand soir. Mon dos. Et mes jambes. Et ma raquette.' },
        { who: 'Coach Rémi', text: 'Écoutez-moi tous les quatre. Ce week-end, le club de Ceyreste organise un petit tournoi. Je veux vous inscrire, toi compris.' },
        { who: 'Coach Rémi', text: 'Il me faut deux binômes. Alors réfléchis bien : avec qui veux-tu jouer ?' },
      ],
      next: 'c_partner',
    },
    c_partner: {
      type: 'choice', partner: true,
      who: 'Coach Rémi', text: 'Ton partenaire pour le tournoi de Ceyreste ?',
      options: [
        { label: 'Eliott', sub: 'Le plus faible des trois, mais c\'est lui qui t\'a fait découvrir le padel. On s\'amuse, et c\'est un ami.', effects: { eliott: 20, raf: -5, jean: 0 }, set: { partner: 'eliott' }, next: 'end_eliott' },
        { label: 'Jean', sub: 'Pas mauvais, fair-play, sympathique. Le choix raisonnable.', effects: { jean: 15, eliott: -25, raf: -5 }, set: { partner: 'jean' }, next: 'end_jean' },
        { label: 'Raf', sub: 'Le meilleur des trois. Arrogant et mauvais perdant… mais il gagne.', effects: { raf: 15, eliott: -30, jean: -3, coach: -2 }, set: { partner: 'raf' }, next: 'end_raf' },
      ],
    },
    end_eliott: {
      type: 'text',
      pages: [
        { who: 'Eliott', text: 'C\'EST VRAI ?! Toi et moi ! Je vais composer une chanson pour notre binôme. Ça va s\'appeler « Les Invaincus ». Enfin, en espérant.' },
        { who: 'Raf', text: 'Parfait. Jean, on va leur apprendre la vie samedi.' },
        { who: 'Jean', text: 'Bonne chance à vous deux ! Et que le meilleur gagne.' },
      ],
      next: 'end',
    },
    end_jean: {
      type: 'text',
      pages: [
        { who: 'Jean', text: 'Avec plaisir ! On va bien s\'entendre, j\'en suis sûr.' },
        { who: 'Eliott', text: '… Ah. D\'accord. Pas de souci. Vraiment. C\'est MOI qui t\'ai fait venir, mais pas de souci.' },
        { who: 'Narrateur', text: 'Eliott sourit, mais son regard dit autre chose. En partant, tu l\'entends marmonner : « Samedi, je vais tout faire pour le sortir du tableau. »' },
        { who: 'Raf', text: 'Et moi je me retrouve avec le troubadour. Super.' },
      ],
      next: 'end',
    },
    end_raf: {
      type: 'text',
      pages: [
        { who: 'Raf', text: 'Enfin quelqu\'un d\'intelligent. Tu écoutes ce que je dis, tu cours là où je te dis, et on gagne. Simple.' },
        { who: 'Eliott', text: 'Raf ?! Sérieusement ?! Après tout ce que… OK. Très bien. On se verra sur le court.' },
        { who: 'Narrateur', text: 'Eliott claque la porte du vestiaire. Jean te fait un petit signe gêné. Tu viens peut-être de gagner un partenaire… et de perdre un ami.' },
      ],
      next: 'end',
    },
    end: { type: 'end' },
  },
};
