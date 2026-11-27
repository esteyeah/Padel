// ============================================================================
//  Carrière : le club-house où l'on se promène en guise de menu (façon
//  « backstage » des vieux jeux de catch). Chaque stand ouvre un écran de la
//  carrière : boutique, vestiaire (prochain match), tableau des tournois,
//  salle d'entraînement, vitrine, staff, classement, miroir (apparence).
//  On y croise son partenaire, le coach, le barman et des membres du club.
// ============================================================================
import * as THREE from 'three';
import { npcSpec } from './Career.js';
import { COACH, genericNpc } from './data/roster.js';
import { buildClubhouse } from '../render/ClubhouseBuilding.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];

/** Panneau au-dessus d'un stand (texte toujours face à la caméra). */
function label(text, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = color; g.beginPath(); g.roundRect(8, 8, 496, 112, 22); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 54px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  sp.scale.set(2.6, 0.66, 1);
  return sp;
}

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };

/** Petits décors de chaque stand. */
const KIOSK = {
  shop: (g) => { g.add(box(1.6, 0.95, 0.6, M(0xf2f2f2), 0, 0.48, 0)); for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 18), M([0xe53935, 0x1e88e5, 0xffc107, 0x43a047][i], { metalness: 0.3 })); r.rotation.x = Math.PI / 2; r.position.set(-0.6 + i * 0.4, 1.35, -0.25); g.add(r); } g.add(box(1.8, 0.05, 0.3, M(0x6d4c41), 0, 1.1, -0.25)); },
  locker: (g) => { for (let i = 0; i < 4; i++) g.add(box(0.42, 1.9, 0.45, M([0x455a64, 0x546e7a][i % 2], { metalness: 0.4 }), -0.66 + i * 0.44, 0.95, 0)); g.add(box(1.4, 0.45, 0.35, M(0x8d6e63), 0, 0.23, 0.6)); },
  board: (g) => { g.add(box(1.8, 1.2, 0.08, M(0x1b2a3a), 0, 1.35, 0)); g.add(box(1.6, 1.0, 0.02, M(0xf5f5f5), 0, 1.35, 0.05)); for (const x of [-0.8, 0.8]) g.add(box(0.06, 1.4, 0.06, M(0x333333), x, 0.7, 0)); },
  gym: (g) => { g.add(box(1.4, 0.45, 0.45, M(0x263238), 0, 0.3, 0)); const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 8), M(0xb0bec5, { metalness: 0.9 })); bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.0, -0.2); g.add(bar); for (const x of [-0.7, 0.7]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 18), M(0x212121)); d.rotation.z = Math.PI / 2; d.position.set(x, 1.0, -0.2); g.add(d); } for (const x of [-0.6, 0.6]) g.add(box(0.06, 1.0, 0.06, M(0x37474f), x, 0.5, -0.2)); },
  trophy: (g) => { g.add(box(1.3, 1.9, 0.5, M(0x3e2723), 0, 0.95, 0)); const gl = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.5, 0.02), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, roughness: 0.05 })); gl.position.set(0, 1.1, 0.26); g.add(gl); for (let i = 0; i < 3; i++) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.04, 0.2, 14), M(0xe0b13a, { metalness: 0.9, roughness: 0.2 })); cup.position.set(-0.35 + i * 0.35, 1.35, 0.05); g.add(cup); } },
  office: (g) => { g.add(box(1.5, 0.75, 0.75, M(0x5d4037), 0, 0.38, 0)); g.add(box(0.5, 0.32, 0.03, M(0x111111), 0, 0.95, -0.15)); g.add(box(0.5, 0.9, 0.5, M(0x263238), 0, 0.45, -0.75)); },
  ranking: (g) => { g.add(box(1.9, 1.05, 0.08, M(0x0d47a1), 0, 1.6, 0)); for (const x of [-0.85, 0.85]) g.add(box(0.07, 1.6, 0.07, M(0x263238), x, 0.8, 0)); for (let i = 0; i < 5; i++) g.add(box(1.5 - i * 0.18, 0.08, 0.02, M(0xffd400), -0.1 + i * 0.09 - 0.1, 1.95 - i * 0.16, 0.05)); },
  mirror: (g) => { g.add(box(0.9, 1.9, 0.06, M(0x3e2723), 0, 0.95, 0)); g.add(box(0.75, 1.7, 0.02, M(0xd8e4ec, { metalness: 1, roughness: 0.05 }), 0, 0.97, 0.04)); },
  bar: (g) => { g.add(box(2.2, 1.05, 0.7, M(0x6d4c41), 0, 0.53, 0)); g.add(box(2.3, 0.06, 0.8, M(0x3e2723), 0, 1.08, 0)); for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 10), M([0x2e7d32, 0x8d6e63, 0xc62828][i % 3], { roughness: 0.2 })); b.position.set(-0.8 + i * 0.4, 1.25, -0.15); g.add(b); } },
};

/**
 * Lance la promenade dans le club-house (un vrai bâtiment, avec ses pièces).
 * @param ui  CareerUI (game, career, show(), act(), hide())
 */
export function startClubhouse(ui) {
  const c = ui.career, s = c.s, t = s.tournament, game = ui.game;
  const myName = (s.profile.name || 'Joueur').split(' ')[0];
  const owned = !!s.club;
  const O = { x: 0, z: 48 };                                   // le club-house, à l'écart des courts
  const W = (x, z) => ({ x: O.x + x, z: O.z + z });
  const nm = c.nextMatch?.();
  const oppName = nm ? nm.opponents.players?.map((q) => q.short).join(' / ') || nm.opponents.name || 'l\'adversaire' : null;
  const go = (screen) => (g) => g.endRoam(() => ui.show(screen));
  const SP = [
    // boutique
    [-6.2, 6.3, 'payer en caisse : ouvrir la boutique', go('shop')],
    [-8, 1.4, 'regarder les raquettes (boutique)', go('shop')],
    // vestiaires
    [7.9, 1.3, t ? 'ouvrir ton casier : préparer le prochain match' : 'ouvrir ton casier : choisir un tournoi', go(t ? 'bracket' : 'tournaments')],
    [4.9, 4.6, 'lire le tableau tactique', go(t ? 'bracket' : 'tournaments')],
    [11.1, 2.8, 'se regarder dans le miroir (apparence)', (g) => g.endRoam(() => ui.act('look'))],
    // salle des trophées
    [-10.4, 12.4, 'admirer la vitrine à trophées', go('trophies')],
    // bureau
    [0, 12.9, 's\'asseoir au bureau : staff', go('staff')],
    [1.7, 13.6, 'gérer le club', go('club')],
    [0, 15.1, 'consulter le classement mondial', go('ranking')],
    // musculation
    [8, 12.8, 'séance de musculation : entraînement', go('training')],
    [5.2, 12.5, 'courir sur le tapis : attributs', go('attributes')],
    // hall
    [-3.2, 4, 'regarder les tournois à la télé', go(t ? 'bracket' : 'tournaments')],
    [0, 5.75, 'commander au comptoir', (g) => g.roamLines([{ actor: 'barman', label: 'Dédé, le barman', text: pickFresh('bar', BAR) }], g.actors?.find((a) => a.id === 'barman'))],
  ];
  const spots = SP.map(([x, z, label, run]) => ({ ...W(x, z), r: 1.0, label, run }));
  const build = (scene) => {
    const { group } = buildClubhouse({ name: s.club?.name || (owned ? 'Mon club' : 'Club-house (aperçu)'), trophies: s.trophies || [], player: { name: myName, number: s.profile.number ?? 10 }, next: nm ? { opp: oppName, round: nm.round, tournament: nm.tournament?.name } : null, rank: c.rank, money: s.money });
    group.position.set(O.x, 0, O.z);
    // parvis devant l'entrée
    const pav = new THREE.Mesh(new THREE.PlaneGeometry(26, 8), new THREE.MeshStandardMaterial({ color: 0xbdb6aa, roughness: 0.9 }));
    pav.rotation.x = -Math.PI / 2; pav.position.set(0, 0.01, -4); group.add(pav);
    scene.add(group);
    return group;
  };
  // les gens du club : chacun dans sa pièce, occupé
  const rnd = Math.random;
  const gen = (k) => npcSpec(genericNpc(rnd, 25 + Math.floor(rnd() * 35)), ['red', 'green', 'orange', 'white', 'blue', 'black'][k % 6], 0, true);
  const P = (id, label, spec, x, z, act, extra = {}) => ({ id, label, spec, ...W(x, z), act, ...extra });
  const people = [
    P('barman', 'Dédé, le barman', gen(0), 0, 7.2, 'drink'),
    P('cashier', 'La vendeuse', gen(1), -6.2, 7.6, 'phone'),
    P('partner', s.partner.name, npcSpec(s.partner, 'blue', 0, true), 9.2, 3.4, 'chat', { faceTo: 'm_lock' }),
    P('m_lock', 'Un joueur du club', gen(2), 7.6, 3.4, 'chat', { faceTo: 'partner' }),
    P('coach', c.hasStaff('coach') ? 'Coach Roméo (ton coach)' : 'Coach Roméo', npcSpec(COACH, 'black', 0, true), 7, 10.6, 'wander', { wander: W(10.2, 13.6) }),
    P('m_gym', 'Une joueuse à l\'entraînement', gen(3), 5.2, 14.2, 'swing'),
    P('m_bar1', 'Un habitué', gen(4), -2.4, 3.0, 'chat', { faceTo: 'm_bar2' }),
    P('m_bar2', 'Une habituée', gen(5), -2.4, 1.8, 'chat', { faceTo: 'm_bar1' }),
    P('m_bar3', 'Un supporter', gen(6), 2.4, 4.8, 'drink'),
    P('m_bar4', 'Un membre du club', gen(7), 2.0, 2.0, 'phone'),
    P('m_tro', 'Un visiteur', gen(8), -8.5, 11.2, 'arms'),
    P('secretary', 'La secrétaire du club', gen(9), -1.6, 15.0, 'phone'),
  ];
  const acts = Object.fromEntries(people.map((p) => [p.id, { act: p.act, faceTo: p.faceTo || null, wander: p.wander || null }]));
  const actors = people.map((p, i) => ({ id: p.id, label: p.label, side: 1, x: p.x, z: p.z, yaw: i * 1.7, appearance: { ...p.spec.appearance, name: p.spec.name } }));
  const talk = (id) => {
    const lab = people.find((p) => p.id === id)?.label || id;
    const L = (text, extra = {}) => ({ actor: id, label: lab, text, ...extra });
    if (id === 'partner') return [L(pickFresh('partner', partnerLines(c, myName, t))), L('On change quelque chose dans l\'équipe ?', { choices: [{ label: 'Voir les partenaires' }, { label: 'Non, on continue ensemble' }], onChoose: (k, g) => { if (k === 0) g.roam.pending = (gg) => gg.endRoam(() => ui.show('partner')); return []; } })];
    if (id === 'coach') return [L(pickFresh('coach', coachLines(c, myName))), L('Tu veux travailler tes attributs ?', { choices: [{ label: 'Voir mes attributs' }, { label: 'Plus tard' }], onChoose: (k, g) => { if (k === 0) g.roam.pending = (gg) => gg.endRoam(() => ui.show('attributes')); return []; } })];
    if (id === 'barman') return [L(pickFresh('bar', BAR))];
    if (id === 'cashier') return [L(pickFresh('shopTalk', SHOP))];
    if (id === 'secretary') return [L(pickFresh('secretary', SECRETARY(c, owned)))];
    return [L(pickFresh('member', memberLines(c, myName)))];
  };
  ui.hide();
  game.start({
    mode: 'career', sceneOnly: true, format: '1v1', sets: 1, matchTiebreak: 7, venue: owned ? 'myclub' : 'club', club: owned ? s.club : null, ambiance: 'sunset',
    lineup: { near: [{ ...c.humanSpec(c.lookFor(), 0), lane: 0 }], far: [{ ...npcSpec(genericNpc(rnd, 30), 'red', 0), lane: 0 }] },
    actors, party: false,
    roam: { camDist: 2.1, bounds: [O.x - 11.7, O.x + 11.7, O.z - 6, O.z + 15.7], startYaw: Math.PI, acts, spots, build, talk },
    onStarted: (g) => { g.players[0].pos.set(O.x, 0, O.z - 2.5); g.players[0].avatar.racket.visible = false; if (!owned) g.hud.banner('CLUB-HOUSE', 'Aperçu : achète ton club pour en faire le tien', 3); },
    onSceneEnd: () => ui.show('hub'),
  });
}

const SHOP = [
  'Les nouvelles raquettes sont arrivées ce matin. Celle en carbone, elle part comme des petits pains.',
  'Vous voulez essayer des chaussures ? Le gazon synthétique use les semelles en trois mois, je vous préviens.',
  'Les maillots du club sont à moitié prix cette semaine. Enfin, pour les membres. Vous êtes membre, non ?',
  'Un client a acheté la même raquette que vous. Il est revenu me dire qu\'elle ne jouait pas pareil. Je lui ai dit : c\'est pas la raquette.',
  'On fait aussi le cordage. Vingt-quatre heures, et c\'est comme neuf.',
];
const SECRETARY = (c, owned) => [
  owned ? 'Les cotisations rentrent bien ce mois-ci. Le club se porte à merveille.' : 'Ce club-house pourrait être le vôtre, vous savez. Il suffit de racheter le club.',
  'Le planning des courts est complet jusqu\'à jeudi. Tout le monde veut jouer où vous jouez.',
  'Un journaliste a appelé trois fois. Je lui ai dit que vous étiez à l\'entraînement. C\'était presque vrai.',
  'Il faudra signer les papiers du tournoi interne. Et goûter les gâteaux de l\'association, ils insistent.',
];

// ------------------------------------------------------------------ répliques (sans répétition rapprochée)
/** Choisit une réplique pas entendue récemment (mémorisée dans le navigateur). */
export function pickFresh(key, list) {
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem('padel-arena.seen.' + key) || '[]'); } catch { /* ignoré */ }
  const fresh = list.filter((x) => !seen.includes(typeof x === 'string' ? x : x.key));
  const out = pick(fresh.length ? fresh : list);
  const id = typeof out === 'string' ? out : out.key;
  seen = [...seen.filter((x) => x !== id), id].slice(-Math.max(1, Math.floor(list.length * 0.75)));
  try { localStorage.setItem('padel-arena.seen.' + key, JSON.stringify(seen)); } catch { /* ignoré */ }
  return out;
}

const BAR = [
  'Un sirop menthe pour le champion ? La bière, c\'est après le match.',
  'Tu as vu ? J\'ai mis ta photo derrière le comptoir. À côté de celle du président. Elle est plus grande.',
  'Le café est offert aux joueurs du top 100. Toi, tu paies encore. Mais bientôt, hein.',
  'Il paraît que tu manges des pâtes avant chaque match. Moi je recommande la pizza. C\'est des pâtes, mais plates.',
  'Hier soir, deux gars se sont disputés pour savoir si tu étais meilleur en revers ou en coup droit. Ils sont repartis bras dessus, bras dessous.',
  'Le frigo est en panne, alors tout est tiède. Mais l\'ambiance est chaude.',
  'Ta raquette, elle a l\'air neuve. Prends soin d\'elle. La mienne, je l\'ai cassée en 2009, je la pleure encore.',
  'Ils vont refaire la terrasse. Avec des transats. Pour regarder les matchs comme à la plage.',
];

function partnerLines(c, me, t) {
  const r = c.rank;
  return [
    t ? 'Ce tournoi, on peut aller loin. Je le sens.' : 'Pas de tournoi cette semaine ? Moi je dis : on s\'inscrit partout.',
    r <= 10 ? 'Top 10, tu te rends compte ? Il y a deux ans, on jouait sur le court du fond.' : 'Un jour, on sera dans le top 10. Note-le.',
    'J\'ai changé de grip. C\'est pas pour la performance, c\'est la couleur.',
    `${me}, si tu me fais encore un lob dans le dos, je te paie le resto. Enfin… si on gagne.`,
    'J\'ai regardé nos vidéos. On monte trop tard au filet. Moi le premier.',
    'Ma mère demande si tu viens manger dimanche. Elle fait des lasagnes. Tu ne peux pas refuser.',
  ];
}

function coachLines(c, me) {
  return [
    'Tu as des points d\'attributs à dépenser ? Ne les garde pas pour décorer.',
    'Ton premier service rentre à 60 %. Le second, on n\'en parle pas.',
    'Les grands joueurs gagnent les points importants. Les autres gagnent les points faciles.',
    `${me}, la bandeja, c'est pas un smash raté. C'est un coup. Respecte-la.`,
    'Repos, hydratation, sommeil. Et pas de frites la veille d\'une finale.',
    'Tu joues bien quand tu joues simple. Le spectacle, c\'est pour les autres.',
  ];
}

function memberLines(c, me) {
  return [
    `Je peux faire une photo avec toi ? C'est pour mon fils. Enfin, pour moi aussi.`,
    'On s\'est croisés au tournoi de Marseille ! Tu m\'as battu 6-0. Je ne t\'en veux pas. Un peu.',
    'Tu sais si le court 2 est libre à 18 h ? Non ? Bon, je vais demander à Dédé.',
    'Le padel, j\'ai commencé l\'an dernier. Depuis, je ne fais plus que ça. Ma femme aussi.',
    `${me} ! On parie sur toi au bureau. Ne nous fais pas perdre nos tickets resto.`,
    'Il paraît qu\'un recruteur d\'une grosse marque est passé hier. Il cherchait quelqu\'un comme toi.',
    'J\'ai acheté la même raquette que toi. Bizarrement, je joue toujours aussi mal.',
    'Tu viens à la soirée du club samedi ? Il y aura un karaoké. Et un concours de lob.',
  ];
}
