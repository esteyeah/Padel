// ============================================================================
//  Aventure : contenu du temps libre et des promenades dans le club.
//  Chaque liste est parcourue sans répétition (une activité déjà faite ne
//  revient qu'une fois toutes les autres épuisées).
// ============================================================================

/** Repos : une façon différente de souffler à chaque fois. */
export const REST = [
  { label: 'Après-midi à la plage des Lecques', text: 'Les pieds dans l\'eau, une glace à la pistache, le bruit des vagues. Les jambes remercient.' },
  { label: 'Grasse matinée', text: 'Tu coupes le téléphone et tu dors onze heures. Tu te réveilles neuf.' },
  { label: 'Balade dans les calanques', text: 'Marche tranquille jusqu\'à Figuerolles. Pas de raquette, pas de score, juste la mer.' },
  { label: 'Sieste au soleil sur la place de Ceyreste', text: 'Un banc à l\'ombre du platane, les cigales, et personne pour te parler de padel.' },
  { label: 'Massage chez le kiné', text: 'Il trouve trois nœuds dans ton dos et les défait un par un. Tu as mal, puis tu revis.' },
];

/** Activités de groupe : toute la bande ensemble. */
export const GROUP = [
  { label: 'Belote au club-house', cards: true },
  { label: 'Barbecue chez Jean', who: 'Jean', rel: { jean: 4, eliott: 3, raf: 2 }, fat: -0.1, text: 'Jean surveille les merguez comme un match en finale. Raf critique la cuisson, Eliott met la musique trop fort. Une très bonne soirée.' },
  { label: 'Foot sur la plage', who: 'Raf', rel: { raf: 4, eliott: 2, jean: 2 }, fat: 0.1, text: 'Trois contre trois dans le sable. Raf tire comme s\'il était au Vélodrome, Eliott finit dans l\'eau. Vous rentrez tous épuisés et hilares.' },
  { label: 'Pétanque en équipe', who: 'Jean', rel: { jean: 5, raf: 1, eliott: 2 }, text: 'Doublette contre triplette au boulodrome. Jean tire au fer, Raf conteste chaque mesure. Ça finit en apéro, évidemment.' },
  { label: 'Match de l\'OM au bar', who: 'Eliott', rel: { eliott: 4, raf: 3, jean: 2 }, text: 'Tout le monde en maillot. Eliott chante tous les chants, Raf insulte l\'arbitre, Jean commente la tactique. L\'OM gagne, la soirée est parfaite.' },
  { label: 'Karaoké au port', who: 'Eliott', rel: { eliott: 6, jean: 2, raf: -1 }, text: 'Eliott prend le micro et ne le rend plus. Jean chante Sardou, Raf refuse de chanter… puis termine sur « Bella ciao » debout sur une chaise.' },
  { label: 'Sortie en bateau', who: 'Jean', rel: { jean: 3, raf: 3, eliott: 3, louka: 3 }, fat: -0.15, text: 'Le cousin de Jean prête son pointu. Baignade au large, sandwichs, coups de soleil. Personne ne parle de padel pendant six heures.' },
];

/** Activités avec chacun : toujours différentes. */
export const FRIEND_ACTS = {
  eliott: [
    { label: 'Karaoké dans la voiture d\'Eliott', text: 'Il chante faux, très fort, vitres ouvertes sur la corniche. Il est heureux, et toi aussi.' },
    { label: 'Pizza devant l\'OM avec Eliott', text: 'Il commente chaque action comme s\'il était sur le banc. Tu ne vois pas la moitié du match, mais tu ris tout le temps.' },
    { label: 'Aider Eliott à déménager', fat: 0.12, rel: 9, text: 'Trois étages sans ascenseur et un canapé beaucoup trop grand. Il t\'invite au restaurant pour te remercier.' },
    { label: 'Jeu vidéo chez Eliott', text: 'Il te bat à un jeu de foot et fait un tour d\'honneur dans son salon. La revanche est déjà prévue.' },
    { label: 'Séance de padel « pour rire » avec Eliott', stat: 'lob', text: 'Vous jouez sans compter les points. Il tente des coups impossibles, tu en réussis un ou deux. Ça fait du bien.' },
  ],
  jean: [
    { label: 'Café en terrasse avec Jean', stat: 'lob', text: 'Il te donne des conseils sur ton lob, gentiment, sans en avoir l\'air. Il dessine des trajectoires sur une serviette.' },
    { label: 'Footing dans les collines avec Jean', stat: 'stamina', fat: 0.08, text: 'Il ne parle pas beaucoup, mais il t\'attend en haut. La vue sur la baie vaut l\'effort.' },
    { label: 'Pêche au port avec Jean', fat: -0.1, text: 'Trois heures, deux sardines. Jean dit que c\'est une excellente journée, et il a raison.' },
    { label: 'Bricolage chez Jean', text: 'Vous réparez sa vieille raquette avec du ruban et de la patience. Il la met au mur, « pour la chance ».' },
    { label: 'Vidéo d\'analyse avec Jean', stat: 'drive', text: 'Il a filmé ton dernier match. Image par image, il te montre ce qui coince sur ton revers. C\'est précieux.' },
  ],
  raf: [
    { label: 'Partie de padel en un contre un avec Raf', stat: 'drive', fat: 0.1, text: 'Il ne te fait aucun cadeau. Tu perds, mais tu prends trois jeux. Il dit « pas mal » en regardant ailleurs.' },
    { label: 'Apéro chez Raf', text: 'Il montre ses trophées un par un, avec l\'histoire de chacun. Au troisième verre, il avoue qu\'il a peur de vieillir.' },
    { label: 'Salle de muscu avec Raf', stat: 'strength', fat: 0.12, text: 'Il soulève plus lourd que toi et le fait remarquer. Mais il corrige ta posture, sans se moquer.' },
    { label: 'Courses avec Raf pour le club', text: 'Il négocie le prix des balles comme un marchand de tapis. Il gagne 20 %. Tu es impressionné malgré toi.' },
    { label: 'Regarder un match pro avec Raf', stat: 'smash', text: 'Il analyse chaque smash de Tapia. Pour une fois, il parle de quelqu\'un d\'autre que lui. Il en sait beaucoup.' },
  ],
  louka: [
    { label: 'Rééducation avec Louka', text: 'Tu tiens les plots pendant ses exercices. Son genou va mieux ; son moral aussi.' },
    { label: 'Vidéos de matchs avec Louka', stat: 'speed', text: 'Il te montre ses matchs d\'avant la blessure. Il était vraiment fort. Il te donne ses astuces de placement.' },
    { label: 'Burger au port avec Louka', text: 'Il te parle de son genou, puis de tout autre chose. Vous riez longtemps, assis sur le quai.' },
    { label: 'Vélo le long de la côte avec Louka', stat: 'stamina', fat: 0.06, text: 'Le vélo ne force pas sur son genou. Vous montez jusqu\'au sémaphore et regardez le soleil se coucher.' },
    { label: 'Échange de balles doux avec Louka', stat: 'drive', text: 'Premiers coups de raquette depuis sa blessure. Il sourit à chaque frappe propre. Tu fais attention à lui.' },
  ],
};

/** Ce que dit le coach Roméo selon l'exercice. */
export const COACH_TRAIN = {
  drive: ['Coup droit, revers, coup droit. Le pied d\'appui d\'abord, la raquette ensuite.', 'Plus bas, les genoux ! On frappe avec les jambes, pas avec les bras.'],
  lob: ['Un bon lob, c\'est haut, long, et ça retombe sur la ligne. Pas dans la vitre.', 'Encore dix. Je veux voir l\'adversaire courir.'],
  smash: ['Smash : tu te places sous la balle AVANT de frapper. Pas pendant.', 'Le poignet ! Claque-la, comme une porte.'],
  speed: ['Pas chassés, toujours. On ne croise pas les jambes sur un padel.', 'Split-step à chaque frappe adverse. Chaque fois. Je compte.'],
  stamina: ['Encore deux tours. Si tu es fatigué ici, tu le seras au troisième set.', 'Respire. Le cardio, ça se gagne en semaine, pas le jour du match.'],
  strength: ['Gainage. Une minute. Ne me regarde pas comme ça.', 'La puissance vient du sol. Les jambes, le tronc, puis le bras.'],
};

const P = (who, text) => ({ who, text });

/**
 * Promenade : conversations de chaque personnage (une différente à chaque fois qu'on lui parle).
 * Chaque fonction reçoit { rel, ch, f, short, venue } et renvoie une liste de conversations.
 */
export const ROAM_TALK = {
  eliott: ({ rel, f, short }) => (rel < -10
    ? [[P('eliott', 'Ah. C\'est toi.'), P('me', 'On peut parler deux minutes ?'), P('eliott', 'Pas maintenant. Peut-être plus tard.')],
      [P('eliott', 'Tu sais, j\'ai pas oublié.'), P('me', 'Je sais. Je suis désolé.'), P('eliott', '…On verra.')]]
    : [[P('eliott', `${short} ! Tu tombes bien, je cherchais quelqu\'un pour écouter ma nouvelle chanson.`), P('me', 'Elle parle de quoi ?'), P('eliott', 'De padel. Évidemment. Ça s\'appelle « Par quatre, mon amour ».')],
      [P('eliott', 'Tu crois que je pourrais devenir bon, un jour ?'), P('me', 'Tu progresses à chaque séance.'), P('eliott', 'C\'est gentil. Faux, mais gentil.')],
      [P('eliott', 'Raf m\'a encore dit que mon revers ressemblait à un essuie-glace.'), P('me', 'Un essuie-glace efficace, alors.'), P('eliott', 'Voilà ! C\'est exactement ce que je lui ai répondu.')],
      [P('eliott', 'Merci de m\'avoir suivi dans cette histoire de padel. Sans toi, j\'aurais arrêté depuis longtemps.')]]),
  jean: ({ rel, f }) => [
    [P('jean', 'Tu as vu ? Ils ont refait les lignes du court. Ça change tout pour les balles rasantes.'), P('me', 'Je n\'avais pas remarqué.'), P('jean', 'Moi si. Je remarque tout.')],
    [P('jean', 'Un conseil : sur un lob, regarde où sont leurs pieds, pas leur raquette.')],
    [P('jean', rel > 30 ? 'Je suis content qu\'on joue ensemble. Vraiment.' : 'Tu joues bien, ces temps-ci. Continue comme ça.'), P('me', 'Merci, Jean.')],
    [P('jean', 'Ma femme dit que je passe plus de temps au club qu\'à la maison.'), P('me', 'C\'est vrai ?'), P('jean', 'Elle a raison. Mais ne lui dis pas.')],
  ],
  raf: ({ rel }) => (rel < -20
    ? [[P('raf', 'Tu veux quoi ?'), P('me', 'Juste dire bonjour.'), P('raf', 'Bonjour. Voilà. Tu peux y aller.')],
      [P('raf', 'Profite tant que tu gagnes. Ça ne durera pas.')]]
    : [[P('raf', 'Tu sais combien de tournois j\'ai gagnés ici ?'), P('me', 'Tu vas me le dire.'), P('raf', 'Onze. Et je compte bien en gagner un douzième.')],
      [P('raf', 'Ton smash… il manque de poignet. Je dis ça pour t\'aider, hein.')],
      [P('raf', 'Eliott chante encore. Quelqu\'un peut l\'arrêter ?'), P('me', 'Il est heureux.'), P('raf', 'Moi pas.')],
      [P('raf', rel > 30 ? 'Tu sais quoi ? T\'es pas si mal, comme partenaire.' : 'On se fait un match un de ces jours ? Pour voir.')]]),
  louka: () => [
    [P('louka', 'Le genou va mieux. Le kiné dit encore trois semaines.'), P('me', 'Tu reviens bientôt, alors.'), P('louka', 'J\'espère. Ça me manque trop.')],
    [P('louka', 'Ici, c\'est là que j\'ai fait mon premier par 4. Je m\'en souviens comme si c\'était hier.')],
    [P('louka', 'Merci de prendre des nouvelles. Peu de gens le font.')],
  ],
  coach: ({ ch }) => [
    [P('coach', 'Tu traînes au club ? Bien. Les champions vivent ici.'), P('me', 'Et les autres ?'), P('coach', 'Ils regardent les champions.')],
    [P('coach', 'Ton jeu de jambes s\'améliore. Ton mental, on en reparle.')],
    [P('coach', ch >= 4 ? 'Le niveau monte. Les tournois aussi. Ne te disperse pas.' : 'Un jour, tu joueras des tournois que tu n\'imagines pas encore. Prépare-toi.')],
  ],
  mayor: () => [
    [P('mayor', 'Ah, notre champion ! Ceyreste est fière de toi.'), P('me', 'Merci, monsieur le maire.'), P('mayor', 'Pense à la mairie dans tes interviews. Ça ne coûte rien.')],
    [P('mayor', 'L\'an prochain, on refait le club-house. Avec une vraie terrasse. Peut-être une plaque à ton nom, qui sait ?')],
  ],
  gege: () => [
    [P('gege', 'Tu veux une bière ? C\'est ma tournée. Enfin, c\'est la tournée de Momo, mais il le sait pas.')],
    [P('gege', 'Moi aussi, à ton âge, je jouais. Bon, c\'était à la pétanque. Mais c\'est pareil, c\'est une balle.')],
  ],
  flavien: () => [
    [P('flavien', 'Un sirop de menthe pour le champion ? Offert par la maison.'), P('me', 'Volontiers.'), P('flavien', 'La maison, c\'est moi. Et la maison t\'aime bien.')],
    [P('flavien', 'Ici on voit passer tout le monde. Les bons, les mauvais, et ceux qui se croient bons.')],
  ],
  hostess: () => [
    [P('hostess', 'Bienvenue au Riviera. Si vous avez besoin de quoi que ce soit, je suis là.')],
    [P('hostess', 'Les joueurs pros passent souvent par ici. Restez dans le coin, vous en croiserez peut-être.')],
  ],
  camille: () => [
    [P('camille', 'Tu as vu mon dernier match ? Non ? Dommage, j\'étais injouable.')],
    [P('camille', 'La pétanque, le padel, le ping-pong… je suis bon partout. C\'est un don.'), P('me', 'Ah oui ?'), P('camille', 'Demande à Timéo. Enfin, non, ne lui demande pas.')],
  ],
  timeo: () => [
    [P('timeo', 'Laisse-moi, je regarde les résultats du tournoi de Marseille.')],
    [P('timeo', 'Camille raconte encore qu\'il est le meilleur ? Il dit ça depuis le CM2.')],
  ],
  hab: ({ id }) => ({
    hab1: [[P('hab1', 'Le padel, de mon temps, ça n\'existait pas. Maintenant il y a plus de monde ici qu\'au marché !')]],
    hab2: [[P('hab2', 'Vous jouez bien, vous ! On vous a vu l\'autre jour. Continuez comme ça.')]],
    hab3: [[P('hab3', 'Santé ! Le meilleur moment du club, c\'est après le match. Tout le monde le sait.')]],
    hab4: [[P('hab4', 'Je fais mon petit tour du soir. Les cigales, le soleil… on est bien à Ceyreste.')]],
  }[id] || [[P(id, 'Bonne journée !')]]),
  lea: () => [
    [P('lea', 'Encore toi ? Tu me suis, ou c\'est la plage qui te plaît ?'), P('me', 'Un peu des deux.'), P('lea', 'Bonne réponse.')],
    [P('lea', 'Tu m\'apprendras à jouer, un jour ? Je promets de ne pas casser ta raquette.')],
  ],
};
