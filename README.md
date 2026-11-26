# Padel Arena 3D — v0.5

Simulation de padel en 3D jouable dans le navigateur (Three.js + Gamepad API).
Aucun build ni asset externe : tout (court, joueurs, textures, sons) est généré par le code.

## v0.72 — Visages vivants et réactions
- Les personnages clignent des yeux, la bouche bouge quand ils parlent dans les cinématiques, ils plissent les yeux et serrent les dents à l'effort (charge, frappe).
- Cornée brillante sur les yeux, peau avec marbrures, pores et petites taches.
- Après chaque point : les gagnants lèvent la raquette et serrent le poing, les perdants mettent les mains sur les hanches, tête basse.

## v0.71 — Jeu en ligne fluide, smash par 3/4 lisible, rendu
- En ligne : ton joueur bouge immédiatement (prédiction locale, corrigée en douceur par l'hôte), les appuis de bouton partent sans attendre, horloge d'affichage recalée en continu (le retard pouvait monter à 0,5 s), 45 états/s au lieu de 30.
- Smash par 3/4 : jauge agrandie avec zone verte et curseur, « RELÂCHE ! » qui clignote au bon moment, « TROP TARD » en rouge.
- Rendu : netteté accrue, légère aberration d'objectif, relief et diffusion chaude de la peau, ombres sans acné.

## v0.70 — Réalisme graphique
- Étalonnage façon pellicule : courbe en S, ombres froides / lumières chaudes, grain léger animé, saturation plus naturelle.
- Visages : crâne mieux proportionné, visage moins bombé, mâchoire et menton plus dessinés, joues creusées, philtrum, arcades marquées.

## Lancer le jeu

```bash
cd padel-sim
python3 -m http.server 5173      # ou : npm start (utilise "serve")
```

Ouvrez http://localhost:5173 dans Chrome / Edge / Firefox. Un serveur local est nécessaire,
car les modules ES et l'API Gamepad ne fonctionnent pas en `file://`. `localhost` est un
contexte sécurisé, la manette fonctionne donc. Three.js est chargé depuis le CDN jsDelivr
(version figée 0.170.0).

Paramètres d'URL : `?play` (match direct) · `?career` (ouvre la carrière) · `?demo` (bots uniquement) ·
`?quality=low` · `?ambiance=day`.
Console : `__padel.game` donne accès à l'état du jeu.

Tests (physique et logique de carrière) : `npm install && npm test`.

## Modes

- **2 contre 2** (par défaut) : vous et un partenaire bot contre deux bots. Vous choisissez votre
  côté : gauche (revés) ou droite (drive). Le service tourne entre les quatre joueurs. Seul le
  receveur désigné, placé du côté du carré visé, peut retourner le service. Les bots se
  répartissent les balles : chacun sa moitié, et au milieu, le plus proche. Le partenaire vous
  laisse votre moitié et le milieu, et l'équipe monte et descend au filet ensemble.
- **1 contre 1**, et **Démo** (bots uniquement).
- Ambiance **Soirée** (projecteurs) ou **Journée** (soleil, ombres longues).

## Nouveautés v0.4

- **Terrains** (le décor et les règles changent) :

  | Terrain | Murs | Portes / jeu dehors | Utilisé pour |
  |---|---|---|---|
  | Tennis municipal | classiques | oui | petits tournois, entraînements |
  | Padel de Ceyreste | panoramiques bleus | oui | amateur et régional (d'après le plan et les photos du club) |
  | Padel Arena Club | classiques | non | amateur et régional |
  | Centre national | panoramiques | oui | national, Challengers |
  | Arena mondiale | panoramiques | oui | gros tournois du circuit mondial |

- **Portes et jeu à l'extérieur** : les portes sont au niveau du filet (une par moitié de
  terrain, de chaque côté du poteau). La balle peut sortir par la porte ou par-dessus le
  grillage latéral après un rebond. Sur les terrains qui l'autorisent, on peut sortir par la
  porte (étroite) et la renvoyer en lob avant le second rebond. Les bots Moyen et Expert
  tentent parfois de la rattraper.
- **Contre-vitre** : actions A+B ensemble (RT+LT en mode gâchettes, U au clavier) pour
  frapper dans sa propre vitre et renvoyer la balle par-dessus le filet.
- **Visée au filet** : près du filet, le stick latéral vise des angles courts jusqu'aux
  couloirs (balle qui finit dans le grillage latéral).
- **Caméras** (View/Select, C au clavier) : TV, TV large, 3e personne, 1re personne,
  latérale, aérienne. Les déplacements suivent la caméra en vue latérale.
- **Personnalisation** : 5 carrures (dont corpulente et surpoids), 12 teints, 13 coiffures
  (chauve, dégarnie, afro, locks, crête…), 6 barbes, casquette à l'envers, bandana,
  couleur dominante + secondaire + short + chaussures (19 couleurs dont or, argent et bronze),
  6 raquettes, 6 sacs.

## Nouveautés v0.5

- **Ceyreste** refait d'après le plan et les photos du club (trois courts panoramiques bleus,
  terrasse en contrebas avec le club-house, cabane en bois, courts de tennis, terre ocre).
- **Portes au niveau du filet**, et le renvoi depuis l'extérieur compte même quand la balle
  passe à côté du poteau.
- **Ambiance** : joueurs sur les courts voisins (club, Ceyreste), valse musette d'accordéon
  dans les petits clubs, rumeur de foule dans les stades (option « Musique et ambiance
  sonore »), halo lumineux (bloom) en graphismes élevés.
- **Entraînement « Rattraper la balle sortie »** (vitesse) : 8 balles sortent par-dessus le
  grillage ou par la porte ; sortez et renvoyez-les avant le second rebond.
- **Test** : tous les terrains sont débloqués (`TEST_UNLOCK_ALL_VENUES` dans
  `src/career/data/shop.js`, à remettre à `false` pour qu'ils se paient en boutique).

## Mode carrière

**Boucle de progression** : hub → tournoi de la semaine (ou entraînement) → matchs du tableau →
récompenses → semaine suivante. Une saison dure 20 semaines et les points de classement d'un
tournoi comptent pendant 20 semaines. Le classement débloque les paliers.

| Palier | Accès | Niveau des paires | Format | Points du vainqueur |
|---|---|---|---|---|
| Amateur local (quartier, club) | dès le départ | 22 – 40 | 1 set court (4 jeux) | 12 à 40 |
| Régional | top 700 | 40 – 60 | 1 set | 90 à 220 |
| National | top 300 | 58 – 82 | 1 set | 400 à 700 |
| Circuit mondial | top 100 | 80 – 99 | 2 sets gagnants | 600 à 2 400 |

- **Création du joueur** : nom, gabarit, taille, carrure, teint, coiffure, accessoire, tenue,
  **main directrice** et côté du terrain, avec un aperçu 3D. Un gaucher tient sa raquette à
  gauche ; son coup droit et son revers sont inversés. Un coup au-dessus de la tête pris côté
  revers est nettement moins sûr : d'où l'intérêt de placer le coup droit au centre (gaucher à
  droite, droitier à gauche).
- **Attributs** (0 à 99, départ à 30 avec 8 points à répartir) :

  | Attribut | Effet en jeu |
  |---|---|
  | Coup droit & revers | précision, régularité et puissance des frappes de fond, volées, service |
  | Lob | précision et régularité des lobs |
  | Smash & bandeja | précision et puissance des coups hauts, portée et qualité des volées |
  | Vitesse | vitesse de déplacement |
  | Endurance | la fatigue (jauge « Énergie ») arrive plus tard ; fatigué, on court moins vite et on rate plus |
  | Force | vitesse de balle, et balle plus « lourde » qui ressort plus vivement des vitres |

- **Récompenses** : XP et points de compétence à chaque victoire, bonus de titre, 2 points par
  niveau. Un point coûte 1 jusqu'à 60, 2 jusqu'à 80, puis 3. Une élimination au premier tour ne
  rapporte ni points de classement ni dotation.
- **Partenaire** : un joueur de club au départ ; il progresse avec vos victoires et de meilleurs
  partenaires se proposent toutes les 4 semaines.
- **Adversaires** : paires fictives, personnalités réparties par palier (dont des duos
  habituels comme Domingo et Xari, Camille Roy et Timéo Boulhol, Cyril Hanouna et Lucas
  Ferrand, et Jean Deuxbé) et paires professionnelles.
  Chaque joueur a une note, des attributs, une main et un style (Complet, Défenseur, Attaquant au
  filet, Puncheur, Créatif, Contreur) qui règle son placement et ses choix de coups.
- **Formats réglables** (écran « Formats des matchs ») : super tie-break (10 points),
  tie-break (7 points), set court (4 jeux), set de 6 jeux, 2 sets gagnants. Par défaut :
  super tie-break en amateur, set court en régional.
- **Missions** : une par match (smash ou lob gagnant, ace, points au filet, contre-vitre,
  balle sortie, échange long, sans double faute…) ; réussie, elle rapporte des points
  boutique ou des points de compétence.
- **Boutique** : couleurs de tenue, casquettes, raquettes (petit bonus d'attribut), sacs
  (posés au bord du court) et terrains pour le mode Exhibition, achetés avec les points
  boutique gagnés en match, en mission et à l'entraînement.
- **Entraînement** (un atelier par semaine, à la place d'un tournoi) : tie-break contre le
  coach, service de précision, sortir la balle au smash, contre-vitre, précision en échange,
  lobs, rattraper la balle sortie, circuit cardio, sprints. Médaille d'argent : +1 à l'attribut travaillé ; or : +2.
- **Simuler** un match est possible (résultat tiré selon l'écart de niveau, XP divisée par
  deux, pas de mission).
- La carrière est sauvegardée dans le navigateur (`localStorage`).

Les données sont dans `src/career/data/` : `roster.js` (joueurs, notes, styles, traits
physiques), `circuit.js` (paliers, tournois, terrains, formats, barème du classement),
`attributes.js` (attributs, coûts, récompenses), `missions.js`, `shop.js`. Les ateliers
d'entraînement sont dans `src/core/Drills.js`, les terrains dans `src/render/Venues.js`.

> Les notes et les styles des personnes réelles sont des valeurs de jeu, pas des mesures
> officielles, et certaines paires professionnelles sont à vérifier (elles changent souvent).
> Les avatars ne reprennent que quelques traits approximatifs (taille, teint, coiffure, barbe). Une diffusion publique ou commerciale
> du jeu demanderait l'accord des personnes concernées (droit à l'image, licences).

## Contrôles

Menu **Contrôles** : deux configurations prêtes à l'emploi, plus une réassignation bouton par
bouton. Sélectionnez une action, appuyez sur A, puis sur le bouton voulu ; si ce bouton servait
déjà, les deux actions sont échangées. La configuration est mémorisée dans le navigateur.

| Action | Boutons (Xbox / PS) | Gâchettes (Xbox / PS) | Clavier |
|---|---|---|---|
| Déplacement | Stick gauche / croix | Stick gauche | ZQSD (WASD) |
| Visée | Stick droit | Stick droit | Flèches |
| Coup droit / revers / volée | A / ✕ | RT / R2 | K ou Espace |
| Coupé (stick bas = amortie) | X / □ | LB / L1 | J |
| Smash / bandeja (balle haute) | Y / △ | RB / R1 | I |
| Lob | B / ○ | LT / L2 | L |
| Pause | Menu / Options | Menu / Options | Échap |

En mode Gâchettes, le pouce droit reste sur le stick de visée pendant la frappe. Les gâchettes
analogiques se déclenchent à partir de 35 % d'enfoncement. Les menus se valident toujours
avec A / ✕.

**Frapper** : appuyez quand la balle arrive. Le joueur se met en préparation et le contact se
fait automatiquement au meilleur moment, à portée de raquette. **Maintenir** le bouton charge la
puissance (le joueur ralentit). Un coup trop chargé ou mal placé (balle trop près ou trop loin du
corps, frappe en pleine course, balle rapide) augmente la dispersion et le risque de faute.
Smash avec une charge élevée, bandeja avec une charge faible.
Un anneau jaune indique où la balle adverse va rebondir.

## Architecture

```
padel-sim/
├── index.html              Canvas + HUD + menus (DOM), importmap Three.js
├── styles.css              Style « retransmission TV »
├── src/
│   ├── main.js             Point d'entrée, boucle requestAnimationFrame
│   ├── config.js           Dimensions FIP, constantes physiques, coups, difficultés, profils IA
│   ├── core/
│   │   ├── Game.js         Boucle à pas fixe 240 Hz, états (service → échange → point), liaisons
│   │   ├── Referee.js      Règles : rebonds, vitres, grillage, filet, service, let
│   │   └── Score.js        15/30/40, avantage ou point en or, jeux, sets, jeu décisif
│   ├── physics/
│   │   ├── BallPhysics.js  Intégration (gravité, traînée, Magnus), rebonds avec rotation, filet
│   │   └── ShotSolver.js   Calcule vitesse et angle pour atteindre une cible (traînée + effet)
│   ├── entities/
│   │   ├── Ball.js         État + rendu (écrasement à l'impact, traînée, ombre)
│   │   ├── Player.js       Déplacement inertiel, préparation/charge, contact, qualité, erreurs
│   │   ├── Avatar.js       Joueur articulé (genoux, coudes, tête) : course, pas chassés, coups, saut
│   │   └── Appearance.js   Tenues d'équipe, morphologie, coiffures, accessoires, nom et numéro
│   ├── controllers/
│   │   ├── HumanController.js  Entrées → intention (même interface qu'un futur contrôleur réseau)
│   │   └── BotController.js    IA : prédiction de trajectoire, interception, choix du coup
│   ├── input/InputManager.js   Gamepad API (Xbox/PS, gâchettes analogiques, vibrations), configurations
│   │                           de contrôles, réassignation, clavier
│   ├── render/
│   │   ├── Renderer3D.js   WebGL, ombres douces, ACES, qualité
│   │   ├── Arena.js        Court 20×10, vitres (verre à transmission), grillage, filet, ambiances
│   │   ├── Surroundings.js Club : courts voisins, tribunes + public animé, club-house, palmiers
│   │   ├── Textures.js     Textures procédurales (gazon sablé, maille, pubs…)
│   │   ├── CameraRig.js    Caméra TV dynamique + orbite du menu
│   │   └── Effects.js      Réticule, rebond prévu, ondes d'impact sur la vitre
│   ├── career/
│   │   ├── Career.js       État, sauvegarde, boucle de progression, récompenses, classement
│   │   ├── Tournament.js   Plateau, têtes de série, tableau, simulation des autres matchs
│   │   └── data/           attributes.js · roster.js (pros, célébrités, styles) · circuit.js
│   ├── audio/Sfx.js        Sons synthétisés (Web Audio)
│   └── ui/                 HUD.js (score TV, jauges), Menu.js (principal + Contrôles),
│                           CareerUI.js (éditeur, hub, tournois, tableau, attributs, classement)
└── tests/                  physics.test.mjs (rebond, solveur, vitre, filet)
                            career.test.mjs (barème, tableaux, carrières simulées, sauvegarde)
```

### Principes clés

- **Simulation séparée du rendu** : `Game.step(dt)` ne dépend que des intentions des contrôleurs
  (`{move, held, pressed}`), avec un pas fixe et déterministe hors aléa. C'est la base du
  multijoueur : un hôte autoritaire simule, les clients envoient leurs intentions.
- **Physique de balle** : semi-implicite à 240 Hz. Le rebond est impulsionnel avec frottement de
  Coulomb sur le point de contact (sphère creuse) : le lift accélère après le rebond, le coupé
  glisse et reste bas. La restitution baisse avec la vitesse d'impact, ce qui modélise la
  compression sur la vitre. Le grillage est mou et irrégulier. La bande du filet fait sauter la
  balle (let). Le rebond au sol est calé sur la norme FIP : lâchée de 2,54 m, la balle remonte
  à 1,38 m.
- **Solveur de frappe** : pour une cible et un type de coup, il cherche l'angle par dichotomie
  sur une trajectoire simulée (traînée + Magnus), puis ajuste la vitesse si la balle ne passe
  pas le filet. Précision inférieure à 12 cm.
- **IA** : à chaque frappe adverse (après un temps de réaction), elle simule la trajectoire
  complète, rebonds sur les vitres compris. Elle choisit ensuite un point d'interception
  atteignable selon son profil : le joueur de fond de court préfère jouer après la vitre,
  l'attaquant préfère la volée et le smash.
- **Fautes réalistes** : la probabilité de faute directe (filet, vitre ou grillage direct)
  dépend de la régularité, de la précision, de la puissance et de la qualité du coup.

## Feuille de route

1. **Gameplay** : sortie de piste par la porte, frappe contre sa propre vitre (contre-pared),
   víbora, chiquita, effets latéraux, ordres au partenaire.
2. **Carrière** : boutique d'équipement et entraîneurs (usage des gains), calendrier avec
   blessures et forme, rivalités, classement des paires adverses qui évolue selon les résultats.
3. **Multijoueur en ligne** : serveur Node.js + WebSocket (ou Colyseus), salons privés par code.
   L'hôte est autoritaire (`Game.step`) et les clients envoient leurs intentions à 60 Hz. Le
   client prédit sa balle localement et la réconcilie avec l'hôte. Le `RemoteController`
   implémente la même interface que `HumanController`. La caméra est miroir pour le joueur du
   camp `side = -1` (déjà prévu dans `targetFromAim` et `HumanController`).
4. **Graphismes** : modèles glTF riggés en option, post-traitement (SSAO, bloom des
   projecteurs), replays.
5. **Outillage** : migration vers Vite + TypeScript quand le serveur multijoueur arrivera.

## Nouveautés 0.6
- Arena mondiale : cuvette de gradins ronde, façade éclairée, toit en anneau, écrans géants, chaise d'arbitre, table des commentateurs et caméra TV.
- Nouveau stade : Padel Beach Arena (plage, mer, tribunes provisoires, parasols). Il accueille la Super Série nationale.
- Tous les courts sont jouables : 5 à Ceyreste et 3 au club. On choisit le court en exhibition ; en carrière, il est tiré au sort. On joue aussi sur les courts voisins.
- Fêtes de village dans les petits clubs : orchestre animé, buvette, tables avec des verres, fanions et banderoles.
- Nouvelle difficulté « Confirmé » ; Expert est nettement plus fort.
- Roster : Camille Roy passe à 58, Timéo Boulhol à 57 et Teddy Riner à 52.

## Nouveautés 0.7
- Menu épuré : on choisit d'abord un mode (Carrière, Exhibition, Entraînement, Regarder, Paramètres), puis ses réglages sur un écran à part.
- Exhibition : terrain, court, format, joueur (carrière ou standard), côté, style du partenaire, style des adversaires, difficulté, durée (dont le super tie-break), point en or.
- Entraînement libre : tous les ateliers, sans carrière.
- Style de jeu « Varié » pour les bots : ils montent quand les adversaires reculent, et reculent quand ils montent.
- L'endurance compte davantage : la fatigue réduit nettement la vitesse, la puissance et la précision.
- Raf Tomatis, vantard et pas très bon, s'inscrit à tous les tournois amateurs avec son cousin Kévin.
- Histoire de la carrière : messages du coach, des rivaux, de la presse et de la fédération selon les étapes du parcours, plus des répliques avant les matchs.

## Nouveautés 0.8
- Atelier « balles sorties » : les balles mettent plus de temps à retomber ; une sur deux sort par 3 (par-dessus le grillage) ; seules comptent les balles frappées depuis l'extérieur.
- Sprint : clic du stick gauche (L3/LS) ou Maj. Il consomme de l'énergie.
- Start depuis le menu ouvre les paramètres. En carrière, la pause permet aussi de quitter sans abandonner (X) : le match pourra être rejoué.
- Exhibition : sélection du personnage (joueurs pros, personnalités, circuit amateur) avec leurs attributs de carrière. Pros et personnalités s'achètent avec les points boutique ; Jean, Raf, Timéo et Camille se débloquent en les battant en carrière.
- Exhibition : sous-menu « Paramètres de la partie » (difficulté, durée, point en or).
- Cinématiques : le coach présente chaque atelier ; dialogue avant les matchs contre Raf Tomatis.
- Rafael « Raf » Tomatis (gaucher) change de partenaire et accuse toujours le précédent. Jean Deuxbé est gaucher.
- Personnages : visages plus détaillés (yeux, paupières, nez, bouche), peau et cheveux plus réalistes, poignet éponge.
- 0.8.1 : une seule grande ouverture au niveau du filet (plus de grillage entre les deux portes) ; le décor du menu suit le terrain, le court et l'ambiance choisis ; Kévin Tomatis et Lucas Ferrand retirés ; nouveaux prix des personnages ; dialogues d'avant-match variés (président du club, parieur, journaliste, partenaire, adversaires).

## Nouveautés 0.9
- Atelier « balles sorties » : nouvelles balles par 3 après un rebond sur la vitre de notre camp. Les sorties alternent entre par 3 direct, la porte, et vitre puis par 3.
- Ceyreste fidèle au schéma : les courts gris (en haut à gauche) et bordeaux (en bas à droite) sont des courts de padel jouables. Les courts de tennis sont sous le club-house.
- Musique de fête : cinq morceaux (valses, java, polka), transposés et à tempo variable, joués de temps en temps avec des pauses.
- Économie : le matériel et la tenue (raquettes, sacs, casquettes, couleurs) se paient en euros. Les terrains et les personnages restent en points boutique.
- Staff (facultatif, salaire hebdomadaire) : coach particulier, préparateur physique, kiné, agent. Sans argent, le staff part, sans autre conséquence.
- Mon club (facultatif) : achat, courts, buvette et tribunes. Il rapporte chaque semaine et organise son tournoi toutes les 4 semaines, avec la billetterie en plus.

## Nouveautés 0.10
- Têtes refaites pour tous les personnages : crâne ovoïde, mâchoire, menton, yeux avec iris, pupille et reflet, paupières, arcades, nez, lèvres, oreilles. Peau moins brillante.
- Nouvelles coiffures (dégradé, crâne rasé) et barbes (bouc, moustache fine).
- Détails de tenue : maillots de club (Bastia, OM), t-shirt, tatouages, montre, médailles, casquette à écusson.
- Jean Deuxbé : maillot de Bastia, dégradé brun, moustache fine, silhouette fine, montre.
- Raf Tomatis : t-shirt blanc, casquette beige à écusson, bras tatoués.
- Le maire de Ceyreste (crâne rasé, bouc, maillot de l'OM, médailles) ouvre les finales jouées à Ceyreste.
- Cinématiques : les personnages font maintenant face à la caméra quand ils parlent.

## Nouveautés 0.11
- Visages : une seule surface modelée (mâchoire, menton, pommettes, orbites, arcades, nez, lèvres), avec couleurs peintes (lèvres, joues, barbe de quelques jours, crâne rasé). Cheveux, barbes et sourcils épousent le crâne. Yeux plus grands, cou plus naturel.
- Le maire de Ceyreste porte l'écharpe tricolore (plus de médailles).
- Ceyreste : sur le court 4 (bordeaux), les autres courts restent bleus.
- Camille Roy (63, joue à gauche) : nonchalant, ancien tennisman classé 5/6, bonne main et bonne technique, peu de cardio, sort facilement les balles par 3. Timéo Boulhol (61, joue à droite) : plus de cardio, régulier, joue la sécurité. Leur note progresse selon leurs résultats, et ils montent au niveau national à partir de 65.
- Mon club : jusqu'à 8 courts, 5 niveaux de tribunes (le tournoi du club peut atteindre le circuit mondial), 10 décorations achetables en euros. Le club a son propre décor 3D, jouable en exhibition.

## Nouveautés 0.12 : refonte graphique (1re vague)
- Rendu : ciels photographiques HDRI (Poly Haven, CC0) pour le fond et l'éclairage (reflets réalistes), nouvelle ambiance « Fin de journée » dorée, occlusion ambiante (GTAO), étalonnage couleur et vignettage, ombres plus fines.
- Personnages : corps continu « skinné » qui plie aux articulations (muscles, épaules, genoux), maillot à manches, short ample, chaussettes, mains avec doigts (refermées sur le manche), chaussures modelées. Moustache de Jean.
- Public : silhouettes assises modelées, pantalons, cheveux variés.
- Végétation : arbres, pins, cyprès, buissons et haies en feuillage réel (cartes de feuilles et d'aiguilles). Collines lisses avec roche sur les pentes.
- Bâtiments : enduit texturé, soubassement, tuiles romaines, génoises, fenêtres encadrées avec appuis, arêtes arrondies.
- Crédits des ressources : voir src/assets/CREDITS.md.

## Nouveautés 0.13 : refonte graphique (2e vague)
- Animation : bras en cinématique inverse (plus de torsion), gestes complets pour le coup droit, le revers et le smash (préparation, impact, accompagnement), rotation des hanches et du buste, main libre qui accompagne.
- Caméras : la 1re personne suit la balle en permanence ; nouvelle « caméra balle » en 3e personne. Dans les deux, les déplacements sont relatifs à la caméra.
- Effets : traînée sur les balles rapides, grains projetés au rebond, ralenti sur les points spectaculaires.
- Matières : sols procéduraux avec relief (terre de Ceyreste, dalles, sable de plage).
- Personnages : mèches de cheveux, grain de peau, épaules, col et cou retravaillés, tête un peu plus grande.

## Nouveautés 0.14
- Visages : maillage plus fin et détails peints (sourcils effilés et arqués, ombres des orbites, narines, lèvres avec arc de Cupidon, cernes). Ligne des cheveux à hauteur réaliste avec dégradé, barbes et coupes aux bords adoucis, paupières inférieures.
- Casquettes, bandeaux, visières et bandanas taillés dans la forme du crâne : ils ne traversent plus la tête. Visière incurvée et écusson repositionnés.
- Démarche : vrai cycle de marche et de course (foulée, levée du genou, poussée du pied, bascule du bassin, contre-rotation du buste, bras qui balancent), pas chassés, posture d'attente moins accroupie.
- Traînée de balle en l'air supprimée (grains au rebond conservés).
- Vêtements : grain de maille sur les maillots et shorts, encolure remontée. Tatouages enfin visibles sur les bras.

## Nouveautés 0.15
- Filet : correction de la tache sombre (artefact de l'occlusion ambiante sur les feuillages découpés) et maille plus nette, visible de loin.
- Occlusion ambiante : les objets découpés (feuilles, grillages, filet, verre) sont exclus de la passe, plus d'ombres fantômes.
- Courts : profilés aluminium aux arêtes arrondies.
- Public : silhouettes allégées (4 à 5 fois moins de triangles), même rendu.
- Mouvements : pas d'allègement (split-step) quand l'adversaire frappe.

## Nouveautés 0.16
- Replay façon télé sur les beaux points (sortie par 3, par 4 ou par la porte, smash gagnant, échange de 12 frappes ou plus) : les ~4 dernières secondes rejouées au ralenti, plan de bord de court puis plan serré sur l'auteur du coup, badge REPLAY et bandes cinéma. A ou Start pour passer.
- Traînée de balle en l'air entièrement supprimée (il en restait une seconde).
- Timéo Boulhol : coupe surfeur mi-longue ondulée qui tombe sur les oreilles. Plus de bandeau pour Timéo et Camille. Nouvelles coupes « Surfeur ondulée » et « Dégradé » dans l'éditeur.
- Peau moins brillante et plus chaude ; coupe courte sans effet visière.

## Nouveautés 0.17
- Frappe réelle : à l'impact, le tamis est placé sur la balle (cinématique inverse) ; le joueur choisit coup droit ou revers selon le côté réel de la balle et se fend vers elle si elle est loin.
- Saut : on peut aller chercher une balle plus haute (jusqu'à +65 cm au filet, +45 cm en smash), avec un saut visible.
- Orientation : les joueurs restent tournés vers le filet (60° maximum vers la balle) ; ils ne regardent plus la vitre derrière eux.
- Replay : trois plans (large TV, bord de court, gros plan), ralenti variable plus lent sur le coup décisif, flash entre les plans, bandeau avec le joueur, le coup, la vitesse et la raison du point.
- Visages : mâchoire plus carrée, nez plus marqué, orbites et arcades plus creusées, yeux plus petits et paupières sur le haut de l'iris.

## Nouveautés 0.18
- Replays plus rares : sorties par 3, par 4 ou par la porte ; smash gagnant à plus de 94 km/h après un échange ; échange de 16 frappes ou plus.
- Carrière : replays seulement en national et sur le circuit mondial. Résumé de fin de match avec les temps forts (jusqu'à 5, dès 2).
- Raf : 8 nouvelles répliques d'avant-match. Son partenaire ne parle plus. Scène d'après-match : s'il perd, il annonce à son partenaire que c'est leur dernier match ensemble ; s'il gagne, il fanfaronne.

## Nouveautés 0.19
- Replay : le gros plan est centré sur la frappe décisive, puis un dernier plan, derrière le joueur, suit la balle jusqu'à sa retombée. Le ralenti est le plus marqué au moment de cette frappe.
- Gestes plus fluides : transitions lissées (plus de saut d'une pose à l'autre), rotation des hanches et du buste adoucie.
- Split-step : vrai petit saut à pieds joints (~13 cm), genoux repliés en l'air, réception jambes fléchies et pieds écartés. Posture d'attente plus fléchie.

## Nouveautés 0.20
- Répliques en cours de match : bulle de Raf après ses beaux points (par 3, par 4, porte, smash fort), après certains points gagnés et, en cas de point perdu, ses excuses. Trois nouvelles répliques d'avant-match.
- Nouveau personnage amateur : Eliott Hanras, troubadour du club. Cheveux châtains à deux mèches, musclé, gros cardio, pas très fort. Il a ses répliques avant et pendant les matchs et se débloque en exhibition en le battant.
- Nouvelle coupe « Deux mèches » dans l'éditeur.

## Nouveautés 0.21
- Replay : votre joueur est toujours visible, même en caméra 1re personne.
- Personnalités : plus de bandeau par défaut (seulement celles qui en portent vraiment, comme Nadal).
- Nouveau gabarit « Très musclé ». Teddy Riner : carrure massive, force maximale et frappes environ 22 % plus rapides.
- Nadal retravaillé : cheveux mi-longs, bandeau large noué derrière, carrure musclée, mâchoire et nez marqués, frappe plus lourde. Zidane : crâne rasé.
- Eliott : cheveux d'un seul tenant, raie au milieu et deux mèches qui retombent sur le front.

## Nouveautés 0.22
- Personnages : plus de peau visible au sommet des épaules (le maillot couvre la jonction avec la manche) ; maillots à panneaux latéraux et liserés dans la couleur secondaire. Teddy Riner : crâne rasé.
- Padel Arena Club : club-house détaillé (pilastres, dalle d'étage, soubassement, auvent vitré sur poteaux, jardinières plantées, toit débordant arrondi).
- Tribunes : sièges moulés avec dossier aux arêtes arrondies.

## Nouveautés 0.23
- Textures photo Poly Haven (CC0) pour les décors : gazon, terre battue de Ceyreste, dalles, sable de plage, enduit des façades, tuiles, planches de la terrasse, écorce des arbres. Chacune a sa carte de relief.
- Sites d'assets libres autorisés dans l'environnement (Poly Haven, ambientCG, Quaternius…).

## Nouveautés 0.24
- Corps des joueurs : mannequin Quaternius (Universal Animation Library 2, CC0) à la place du corps procédural. Vraie anatomie, mains avec doigts (main droite refermée sur le manche), morphologie masculine (poitrine aplatie, membres et buste étoffés, encore plus pour les gabarits musclés).
- Tenue découpée au pixel près dans le shader : T-shirt à manches avec encolure et liserés, short avec ceinture, chaussettes, chaussures et semelle, poignet éponge.
- Têtes, cheveux, casquettes, montres et écharpes montés sur les os du mannequin ; le bras de frappe du mannequin est résolu vers la poignée de la raquette.

## Nouveautés 0.25
- Joueurs : mannequin masculin Quaternius (Universal Animation Library 1) ; carrure d'homme (épaules larges, torse en V, hanches étroites). Le mannequin féminin reste pour les joueuses.
- Animations capturées (UAL 1) mélangées à nos gestes : attente entre les points, marche, jogging et sprint (jambes, bassin, buste), lues à l'envers quand le joueur recule et accélérées selon sa vitesse. Bras et raquette restent pilotés par nos frappes. Pas chassés, split-step, sauts et frappes inchangés.
- Modèle allégé : 260 Ko pour le mannequin et ses 7 animations, au lieu de 7,6 Mo.

## Nouveautés 0.26
- Retour au corps des personnages de la version 0.23 : le mannequin Quaternius est retiré (essai abandonné).

## Nouveautés 0.27
- Réalisme : usure du gazon aux zones de jeu (fond de court, service, filet), vitres avec traces et poussière qui jouent sur les reflets, caméra TV aux légers micro-mouvements d opérateur.

## Nouveautés 0.28
- Usure du gazon et traces sur les vitres : seulement à la plage, au municipal et au Padel Arena Club ; plus discrètes ; à des endroits différents à chaque partie.
- Correction : le gazon usé ne disparaît plus selon l angle ou la caméra.

## Nouveautés 0.29
- Saut seulement quand la balle est au-dessus de ce que le joueur atteint debout.
- Coiffures : plus de cheveux qui traversent les casquettes et bandanas.
- Fête de village : l'orchestre vient à certaines parties seulement, mais joue alors toute la partie ; scène visible en fond, avec des gens qui dansent et boivent devant.
- Raquettes refaites (tamis en goutte d'eau, cadre biseauté, cœur ouvert, grip enroulé, dragonne).
- Arena mondiale : un arbitre annonce le score (bulle et voix de synthèse du navigateur).
- Contours : rideau d'arbres et collines à l'horizon (club, municipal, stade national, mon club).
- Raf : répliques après un ace qu'il encaisse (« Normal, j'étais pas prêt. »), dernière phrase d'avant-match variée. Correction d'une bulle de dialogue qui pouvait rester affichée.

## Nouveautés 0.30
- Styles personnels : chaque joueur a sa posture (flexion, buste, raquette en attente), sa démarche (foulée, rebond, appuis, balancement, rythme) et ses gestes (préparation, accompagnement, rotation des épaules), stables d un match à l autre.
- Frappes plus naturelles : préparation qui accélère vers l impact, accompagnement amorti.

## Nouveautés 0.31
- Styles calqués sur les personnalités : Camille décontracté (droit, raquette à une main, bras libre relâché), Timéo fléchi et appliqué, Raf aux gestes exagérés, Eliott théâtral, Jean régulier, Riner puissant, Nadal intense. Pros et personnalités : posture et gestes selon leur style de jeu (smasher, défenseur, attaquant, magicien, lobeur).

## Nouveautés 0.32
- Décors : rochers scannés (Poly Haven, CC0), avec maillage allégé et textures photo, dans la garrigue de Ceyreste, en bord de mer à la plage et au pied des arbres à l horizon.
- Horizon allégé (moins d arbres, même effet) pour garder le jeu fluide.

## Nouveautés 0.33
- Plage : mer animée (houle) et vagues qui montent et se retirent sur le sable, eau claire en bord de plage.
- Ceyreste : plus de panneaux publicitaires.
- Nouveau lieu régional « Le Hangar Padel » : 4 courts couverts sous un hangar en tôle ondulée à arcs métalliques, verrières, projecteurs, buvette au fond avec tables hautes. Tournoi « Open du Hangar » (régional), jouable en exhibition (choix du court), 500 points boutique.

## Nouveautés 0.34
- Plage : les vagues avancent vers le rivage et viennent mourir sur le sable.
- Hangar : plus compact, buvette déplacée au fond, face aux caméras (comptoir, auvent, guirlande lumineuse, tables hautes), petites tribunes entre les courts du fond ; caméras gardées sous le toit.

## Nouveautés 0.35
- Hangar : courts disposés en carré (2 en haut, 2 en bas), buvette au fond de chaque rangée, bancs de spectateurs le long des murs.

## Nouveautés 0.36
- Hangar : buvette réaliste (étagère à bouteilles, tireuses, verres de bière, ardoise des prix, tabourets) tenue par un barman animé (il essuie, tire une bière, sert) ; promeneurs qui passent de match en match ; marquage au sol des allées, banderoles du club, plantes, extincteurs.

## Nouveautés 0.37
- Hangar : musique électro-pop diffusée par des enceintes (son filtré, léger écho) à la place de l orchestre de village.
- Hangar : promeneurs strictement dans les allées (couloirs latéraux, allée centrale, allée transversale), plus de passage sur les courts ; panneaux publicitaires retirés des allées.

## Nouveautés 0.38
- Hangar : ligne jaune corrigée (plus de scintillement), tôle plus détaillée (nervures en relief, rivets, salissures en bas), dessous du toit en panneaux isolants avec pannes métalliques, extincteurs détaillés (poignée, tuyau, support, pictogramme).
- Écran géant au-dessus de chaque buvette : alterne clips musicaux animés et un match de padel en direct avec score.

## Nouveautés 0.39
- Hangar : l écran garde son programme toute la partie (padel ou clips, tiré à chaque match).
- Hangar : un lob très haut peut toucher une lampe (rare) : la balle retombe et le point est à remettre.
- Hangar : bande de fenêtres translucides en haut des murs, gaines de ventilation sous le toit, suspentes des lampes ; caméra gardée plus bas pour ne pas être gênée par les lampes.

## Nouveautés 0.40
- Hangar : lampes un peu plus basses (touchées un peu plus souvent, toujours rare).
- Hangar : entrée vitrée avec enseigne « ENTRÉE · ACCUEIL », comptoir d accueil avec hôte et écran, présentoir de location de raquettes ; vestiaires et toilettes (portes, pictogramme WC), casiers, distributeur de boissons, poubelle de tri.
- Musique électro du hangar : voix chantée (syllabes de synthèse sur une mélodie).

## Nouveautés 0.41
- Hangar : plus rien ne traverse les buvettes (colonnes métalliques décalées, lignes jaunes raccourcies, buvettes avancées, frigos rangés à côté du comptoir).

### 0.43
- Ceyreste : la fête se fait parfois avec une sono (DJ et colonnes d'enceintes) qui passe les musiques NCS.
- Musiques réencodées en meilleure qualité (32 kHz, 48 kb/s) ; filtres « enceinte » plus ouverts.
- Exhibition : choix du lieu puis du court dans une grille, comme pour les personnages, avec aperçu du décor.

### 0.44
- Le maire de Ceyreste devient un joueur : il ne joue qu'aux tournois de Ceyreste (carrière) ; le battre le débloque comme personnage.
- Les terrains s'achètent en points boutique ; code secret (Paramètres > Code secret) pour tout débloquer.
- Raquettes : 3 nouveaux modèles, 12 designs de tamis achetables à part, texture haute définition (logo, trous, vernis).
- Hangar : vrai Pro Shop avec les raquettes de la boutique et leurs prix.

### 0.45
- Ceyreste plus fidèle aux photos du club : façade du club-house (porte vitrée blanche, store, panneau d'affichage, applique, poubelle verte, cyprès, laurier, olivier), terrain de pétanque à droite de la porte, jardin de rochers calcaires et gravier, large allée en béton, bancs blancs à lattes avec les affaires des joueurs, poubelle en bois et conteneur bleu, mûrier aux feuilles jaunies, tableau de score à volets sur le grillage, sol plus clair.

### 0.46
- Saisie du code secret et du pseudo en ligne dans le jeu (les fenêtres du navigateur étaient bloquées dans l'aperçu).
- La boucle du jeu ne s'arrête plus sur une erreur ; message « cliquez dans le jeu » quand la page perd le focus (manette inactive).
- Touche H / clic du stick droit : masquer les aides en bas à gauche.
- Vitres : une balle lente s'écrase et ne remonte plus le long de la vitre.
- Chaises pour les spectateurs qui étaient assis par terre.
- 10 coupes de maillot (dont 8 achetables) et choix du numéro.
- 10 nouvelles missions : lobs profonds, par 3, par 4, amorties courtes, volées, retours gagnants, séries de points…
- Hangar : allées en résine, panneaux PISTE 1 à 4, fanions, fresques.
- Déploiement automatique (GitHub Actions → Cloudflare).

### 0.47
- Ceyreste : vrai toit à deux pans sur le club-house, le court 2 devient le court central, bancs/arbre/poubelles déplacés près du club-house, allées sans scintillement, petits buissons de garrigue autour des courts.
- Personnages : 6 nouvelles barbes (aussi en carrière), coupe de Nadal corrigée (cheveux au-dessus du bandana), écharpe du maire ajustée.
- Boutique : un premier clic fait essayer l'objet sur le joueur (ou montre le terrain), un second l'achète.
- Raf : 15 nouvelles répliques, au plus 4 par match, jamais deux fois la même.
- Nouveau smash « par 3 / par 4 » (X+Y ou touche O) : relâcher quand la jauge indique MAINTENANT ; visée sur le côté = par 3, au centre = par 4.
- 5 nouvelles scènes en carrière (jeune supporter, coach, partenaire superstitieux, juge-arbitre, sponsor).
- Hangar : fresques retirées (elles passaient derrière l'écran et les fenêtres).

### 0.48
- Ceyreste : murets en trop retirés entre le terrain gris et le court central ; bancs, mûrier et poubelles devant la porte du court central, au niveau du filet (comme sur la photo) ; tableau de score lisible du bon côté.
- Nouveau lieu « Tennis de La Ciotat » (d'après les photos) : 4 courts de padel couleur terre battue, structures noires, tonnelles bleu marine, tribune en gradins et escalier jusqu'au club-house (terrasse sous auvent), courts de tennis autour, parking avec voitures, pins, palmiers, lauriers-roses et agaves. Tournoi régional « Open de La Ciotat », lieu achetable (450 points) en exhibition.

### 0.49
- Tennis de La Ciotat : le court de tennis vert du bout passe de l'autre côté ; à sa place, le parking surélevé sur une restanque de terre (pierres sèches, buissons) ; beaucoup plus de verdure autour du club-house, surtout sur sa droite.
- Concerts : 2 % de chances d'un orchestre et 8 % d'un DJ (Ceyreste) en temps normal ; bien plus dans les gros tournois (selon le niveau du tournoi, et encore plus en demi-finale et en finale).

### 0.50
- Orchestre refait : estrade avec jupe rouge et marches, toit en toile rayée, fond de scène « BAL DU PADEL », guirlande d'ampoules, enceintes et projecteurs ; quatre musiciens en tenue assortie (accordéon, guitare, batterie complète, chanteur au micro).
- Tennis de La Ciotat : court central et court 2 échangés, tribune éloignée du court central.
- Hangar : le toit ne couvrait qu'une moitié de la salle (on voyait le ciel au-dessus de la buvette) ; pignon est visible de l'intérieur ; vrai sas d'entrée vitré avec bandeau lumineux, paillasson et plantes.
- Nouveau lieu « Riviera Padel Palace » : complexe de luxe, court central entouré de tribunes, loge VIP vitrée, écrans géants, lounge vitré, quatre courts annexes sous des voiles d'ombrage, bassins, palmiers, drapeaux. Tournois « Riviera Masters » (national) et « Grand Prix de la Riviera » (mondial) ; demi-finales et finales sur le court central.
- Centre national : court n° 2 derrière la tribune latérale, avec ses propres gradins.

### 0.51
- Hangar : numéros de piste peints au sol (plus de panneaux suspendus devant les caméras), affiches encadrées et néon sur les murs, vitrine à trophées, écran des réservations et banquette à l'accueil.
- Riviera Padel Palace : piscine à débordement avec plage en teck, transats et parasols ; fontaine avec raquette dorée monumentale ; hôtel de luxe à balcons ; spa ; bar à champagne sous pergola ; haies taillées et topiaires.
- Tennis de La Ciotat : courts 3 et 4 tournés d'un quart de tour, côte à côte ; tribune et palmiers reculés.
- Timéo crie et devient tout rouge quand il rate.

### 0.52
- Nouveau joueur : Nathan Subrero (64, à peine meilleur que Camille), petit, costaud, frappe fort, hyperactif ; à battre en tournoi pour le débloquer.
- Raf Tomatis remonte à 50 (au-dessus d'Eliott) et joue aussi en régional.
- La Ciotat : le court de tennis qui chevauchait le court 3 est reculé.
- Trophées : cérémonie de remise après une finale gagnée (coupe en argent courte et sobre en amateur, coupe dorée et confettis en national/mondial, raquette en or géante à la Riviera) ; vitrine à trophées dans la carrière.
- Aperçu du hangar dans les menus : la caméra reste à l'intérieur.

### 0.53
- Nouveau mode Aventure (chapitre 1 « Le commencement ») : coup de fil d'Eliott, premier entraînement avec le coach Rémi, Raf, Jean et Eliott (deux exercices, tie-break contre Jean, super tie-break truqué avec Eliott), cinématique, puis choix du partenaire pour le tournoi de Ceyreste. Jauges de relation (Eliott, Jean, Raf) et estime du coach ; le joueur part de rien et progresse.
- Tennis de La Ciotat : plus de bâches publicitaires autour des courts ni de tonnelles ; un panneau près du club-house.

### 0.54
- Cheveux en mèches (« hair cards ») : des centaines de petites mèches texturées plantées sur le crâne, orientées selon la coupe (raie, frange, gravité, ondulations, boucles) ; fini les coupes lisses.
- Barbes et moustaches en poils drus (plus de coques noires), ombre de barbe peinte sous les poils.
- Yeux : blanc moins éclatant. Personnages de décor allégés (moins de mèches).

### 0.55
- Aventure : deux emplacements de sauvegarde ; vraies cinématiques sur le court (personnages qui se parlent) ; les conséquences d'un choix ne sont plus annoncées, elles arrivent après coup (sauf la description des trois partenaires) ; Eliott vexé mais pas rancunier ; le coach devient Roméo (cheveux noirs attachés, casquette unie).
- Chapitre 2 « Le tournoi de Ceyreste » : 1er tour gagné d'office, 2e tour abordable mais perdable (rester encourager les copains ou partir), match des amis (encourager, déconcentrer ou rien), demi-finale difficile contre eux avec dialogues selon ton attitude, finale contre Camille et Timéo, remise des prix par le maire, verre au club-house où l'équipe qui a été la plus loin chambre l'autre. Jauge de réputation et situations de fair-play : balle litigieuse, et avec Raf, sabotage des raquettes adverses (le raisonner, le dénoncer ou laisser faire).
- Spectateurs assis : chaises / sols corrigés à La Ciotat (terrasse) et au Riviera (loge VIP).

### 0.56
- Aventure : choix joués dans la cinématique (une touche par réponse) ; Eliott vexé (« c'est moi qui te ramène ici… ») et peut répéter devant tout le monde que tu t'es moqué du padel ; premier tournoi déplacé à l'Open de La Ciotat (tableau découvert sur une feuille, remise des prix par Dimitri Payet) ; match des amis pris en fin de match.
- Chapitre 3 « Le retour de Louka » : rendre ou non sa place ; entraînement à cinq avec classement (Eliott dernier de peu, il part et devient rival) ; tournoi de Ceyreste (habitués de la buvette, dont Gégé qui titube ; tour 2 contre le rival ; finale contre les collègues avec une balle litigieuse en plein match) ; cérémonie avec le maire (discours humble ou arrogant, applaudir ou non) ; verre à la buvette.
- Coach Roméo : chignon et moustache. Louka d'après la photo (cheveux bouclés foncés, fine moustache, n° 91).
- Cheveux bouclés serrés (Tapia, Payet n'est plus chauve), Riner plus colossal. Atelier lob : seuls les vrais lobs comptent.

### 0.57
- Aventure : plus de tie-break contre Jean au chapitre 1 ; discussions hors du court (entre deux courts, bord de court, buvette) ; on se voit au bord du court quand on regarde le match des amis ; Louka montré au club-house au lieu d'être raconté ; Camille à gauche, Timéo à droite ; Gégé arrive bière à la main, tombe une ou deux fois et rate presque tout ; si Eliott devient rival, il joue avec son père Philippe Hanras.
- Roméo et Louka jouables ; Nathan Subrero à 67 ; Jean et Raf d'après les photos (Jean : banane châtain et fine moustache ; Raf : coupe rasée).
- Exhibition : choix du partenaire et des adversaires parmi tous les personnages.
- Cérémonie : le trophée est tenu dans les deux mains (il flottait au-dessus de la tête) ; la petite coupe amateur est un peu plus grande pour rester visible.

### 0.58
- Personnalités en tenue de leur club ou sélection, avec écusson et numéro : Payet, Nasri, Mandanda, Cheyrou, Squillaci (OM) ; Messi, Puyol, Piqué (Barça, rayures blaugrana) ; Zidane, Deschamps, Riner (France) ; Zlatan, Ménez, Jallet (PSG) ; Gonalons, Grenier (OL) ; Pires, Vieira (Arsenal) ; Lemoine (Saint-Étienne) ; Ben Arfa (Newcastle) ; Ocon (couleurs de son écurie).
- Barbes moins « masque » : poils moins denses, teinte plus naturelle, ombre plus légère.
- Nouveau : Stéphane Ruffier (72, national), maillot de Saint-Étienne n° 16.

### 0.60
- Aventure, chapitre 4 « Le tournoi de la Riviera » : départ en minibus avec le maire, le coach et les quatre joueurs ; accueil par Stéphane Ruffier (matchs en 3 points secs) ; la controverse de Roméo (suspendu en 2015) révélée au fil du tournoi ; Nasri ment sur une balle (contester ou non : il respecte ceux qui répondent) ; Cyril Hanouna propose 1 000 € pour perdre la demi-finale ; finale d'exhibition contre Tapia et Coello ; conférence de presse : défendre Roméo, le lyncher (il devient un ennemi) ou ne rien dire ; nouveaux contacts.
- Nathan Subrero sur l'affiche de Ceyreste et le tableau de La Ciotat.

### 0.61
- Aventure, chapitre 5 « Une seule place » : une place au régional pour le duo qui ira le plus loin au Padel Beach Arena. Si tu as lynché Roméo, il la donne quand même à l'autre duo : saboter tes collègues ou renoncer (le maire t'offre une invitation). Si tes collègues font mieux : aller les soutenir, ou non (fin « plus personne ne veut jouer avec toi » si tes relations sont mauvaises, sinon fin calme du padel du dimanche).
- Chapitre 6 « Le championnat régional » (Hangar) : tableau avec ton rival, Camille et Timéo, Nasri et Mandanda (ou Roméo si c'est ton ennemi), finale contre Nathan Subrero. En spectateur : Mandanda se blesse et Nasri te propose de le remplacer (ou te fait choisir entre toi et ton partenaire). Finale atteinte = qualification au national. Sinon : arrêter (apéro au club) ou retenter un régional (nouvel échec = blessure et fin de carrière).

### 0.62
- Aventure complète jusqu'au chapitre 9 : Hanouna te fait une mauvaise réputation à la télé si tu l'as trahi ; selfie avec une supportrice à la plage ; Flavien le barman du Hangar offre sa tournée et son numéro ; finale du régional contre Nathan Subrero et Roméo (si tu l'as trahi) ou Chico ; chapitre 7 national (Zlatan et Zidane, Ruffier et Payet, article de La Provence selon ton parcours) ; chapitre 8 Mondial (choix du partenaire : partenaire de toujours, Roméo, Nasri ou Benjamin Tison ; demi-finale contre tes amis : les laisser gagner ou jouer le jeu ; finale contre Tapia et Coello) ; chapitre 9 tournoi d'honneur (invitations acceptées ou refusées selon tes relations, match, soirée finale).
- Galerie des fins (8 fins) dans le menu Aventure.

### 0.63
- Personnages de l'Aventure jouables en exhibition (Flavien, Chico, Benjamin Tison, Philippe Hanras, Gégé, Momo, Léa), débloqués en finissant leur chapitre (ou avec le code secret).
- Fin de chaque chapitre : déblocages selon le parcours (terrains et personnages : La Ciotat, Payet/Camille/Timéo si finale, Ceyreste et le maire si victoire, Riviera si finale, Nasri/Hanouna selon les contacts, Hangar, Centre national, stade du Mondial si champion…), affichés à l'écran de fin.
- Plage : Léa, en maillot de bain, vient te draguer : refuser, ou tenter ta chance (elle devient ta copine… ou c'est la copine de Timéo et tu arrives affaibli en demi-finale).
- Supportrices plus féminines (silhouette fine, poitrine et hanches marquées).
- Les 1 000 € de Hanouna sont crédités dans la boutique de la carrière.
- Exhibition : partenaire et adversaires choisis dans une grille (nom, catégorie, note), avec aperçu du joueur.

### 0.64
- Accueil : nouvelles tuiles « Boutique » et « Mon joueur » (apparence, tenue, équipement), qui ouvrent directement la boutique et l'éditeur de la carrière.
- Aventure : champion du monde = 50 000 € pour la boutique et la Raquette du Mondial (édition unique, gros bonus).
- Flavien 51, Chico 47.

### 0.65
- Aventure : le maire dans le minibus explique son invitation (son ami Ruffier) ; Ruffier vous reçoit dans la loge VIP et explique en détail le format en 3 points ; cinématiques plus longues avec plus de dialogues ; les discussions se font toujours hors du court, les personnages côte à côte ; choix du côté de jeu (droite / gauche) dans le menu de l'Aventure.
- Stéphane Ruffier chauve et barbu.
- Statistiques à l'écran dans tous les modes : vitesse des gros smashs, services et frappes (km/h), longueur des longs échanges, séries de points d'affilée.

### 0.66
- Aventure : le minibus est garé bien visible derrière le groupe ; au chapitre 5, si tes collègues font mieux que toi, une équipe se désiste et tu es repêché pour le régional (plus de fin d'aventure à cet endroit).

### 0.67
- Cinématiques de l'Aventure : les personnages sont enfin placés hors du court (ils étaient replacés sur le terrain par erreur) ; le maire parle devant le minibus ; l'hôtesse vous accueille et vous conduit en marchant jusqu'à la loge VIP ; Léa vous aborde au bord de l'eau, pose la main sur votre bras, plus de dialogues.

### 0.68
- Aventure : vérification de tous les lieux de scène ; les verres se prennent à la buvette (terrasse du club-house à La Ciotat et à Ceyreste, bar à champagne du Riviera, comptoir du Hangar devant Flavien), jamais sur un court ; lieux hors court corrigés au Centre national et au stade du Mondial.

### 0.69
- Aventure : la réponse au coup de fil d'Eliott se fait au téléphone (menu), plus sur un court ; dans les cinématiques, tout le monde se tient en cercle face aux autres (plus personne ne se marche dessus), la caméra se place face à celui qui parle ; ton joueur salue de la main en se présentant ; Eliott te tend ta première raquette ; le maire parle devant le minibus.
