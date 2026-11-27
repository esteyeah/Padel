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
 * Lance la promenade dans le club-house.
 * @param ui  CareerUI (game, career, show(), act(), hide())
 */
export function startClubhouse(ui) {
  const c = ui.career, s = c.s, t = s.tournament, game = ui.game;
  const myName = (s.profile.name || 'Joueur').split(' ')[0];
  // les stands, en arc derrière le court principal
  const go = (screen) => (g) => g.endRoam(() => ui.show(screen));
  const STANDS = [
    { id: 'shop', kiosk: 'shop', title: 'BOUTIQUE', color: '#c62828', label: 'ouvrir la boutique', run: go('shop') },
    { id: 'locker', kiosk: 'locker', title: 'VESTIAIRE', color: '#37474f', label: t ? 'préparer le prochain match' : 'choisir un tournoi', run: go(t ? 'bracket' : 'tournaments') },
    { id: 'board', kiosk: 'board', title: 'TOURNOIS', color: '#1565c0', label: 'voir le tableau des tournois', run: go(t ? 'bracket' : 'tournaments') },
    { id: 'gym', kiosk: 'gym', title: 'ENTRAÎNEMENT', color: '#2e7d32', label: 'aller à l\'entraînement', run: go('training') },
    { id: 'trophy', kiosk: 'trophy', title: 'VITRINE', color: '#b8860b', label: 'regarder la vitrine à trophées', run: go('trophies') },
    { id: 'office', kiosk: 'office', title: 'STAFF & CLUB', color: '#4e342e', label: 'passer au bureau (staff, club)', run: go('staff') },
    { id: 'ranking', kiosk: 'ranking', title: 'CLASSEMENT', color: '#0d47a1', label: 'consulter le classement mondial', run: go('ranking') },
    { id: 'mirror', kiosk: 'mirror', title: 'MIROIR', color: '#6a1b9a', label: 'changer d\'apparence', run: (g) => g.endRoam(() => ui.act('look')) },
    { id: 'bar', kiosk: 'bar', title: 'BUVETTE', color: '#ef6c00', label: 'prendre un verre au comptoir', run: (g) => g.roamLines([{ actor: 'barman', label: 'Dédé, le barman', text: pick(BAR) }]) },
  ];
  const Z0 = 14.5, N = STANDS.length;
  // arc ouvert vers le court : chaque stand regarde le centre du hall
  const CX = 0, CZ = Z0 + 3;
  STANDS.forEach((st, i) => { const a = (i / (N - 1) - 0.5) * 2.4; st.x = CX + Math.sin(a) * 10; st.z = CZ + Math.cos(a) * 6; st.yaw = Math.atan2(CX - st.x, CZ - st.z); });
  const spots = STANDS.map((st) => ({ x: st.x + Math.sin(st.yaw) * 1.3, z: st.z + Math.cos(st.yaw) * 1.3, r: 1.3, label: st.label, run: st.run }));
  const build = (scene) => {
    const root = new THREE.Group();
    // sol du hall : grand tapis de béton clair
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), M(0xbdb6aa, { roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.01, Z0 + 4); floor.receiveShadow = true; root.add(floor);
    for (const st of STANDS) {
      const g = new THREE.Group(); g.position.set(st.x, 0, st.z); g.rotation.y = st.yaw;
      KIOSK[st.kiosk](g);
      const lb = label(st.title, st.color); lb.position.set(0, 2.7, 0); g.add(lb);
      root.add(g);
    }
    scene.add(root);
    return root;
  };
  // personnages : partenaire, coach, barman, membres du club (différents à chaque visite)
  const rnd = Math.random;
  const members = Array.from({ length: 5 }, (_, i) => ({ id: `m${i}`, npc: genericNpc(rnd, 30 + Math.floor(rnd() * 30)) }));
  const people = [
    { id: 'partner', label: s.partner.name, spec: npcSpec(s.partner, 'blue', 0, true), x: -2.5, z: CZ + 1.8, act: 'swing' },
    { id: 'coach', label: c.hasStaff('coach') ? 'Coach Roméo (ton coach)' : 'Coach Roméo', spec: npcSpec(COACH, 'black', 0, true), x: 3, z: CZ + 2.2, act: 'wander' },
    { id: 'barman', label: 'Dédé, le barman', spec: npcSpec(genericNpc(rnd, 30), 'white', 0, true), x: STANDS[8].x - Math.sin(STANDS[8].yaw) * 0.9, z: STANDS[8].z - Math.cos(STANDS[8].yaw) * 0.9, act: 'drink' },
    ...members.map((m, i) => ({ id: m.id, label: pick(['Un membre du club', 'Une habituée', 'Un joueur du club', 'Un supporter']), spec: npcSpec(m.npc, ['red', 'green', 'orange', 'white', 'blue'][i], 0, true), x: -6 + i * 3 + rnd(), z: CZ + 1.5 + rnd() * 2, act: ['chat', 'chat', 'phone', 'wander', 'drink'][i] })),
  ];
  const acts = Object.fromEntries(people.map((p) => [p.id, { act: p.act, faceTo: p.id === 'm0' ? 'm1' : p.id === 'm1' ? 'm0' : null, wander: p.act === 'wander' ? { x: p.x + 4, z: p.z + 2 } : null }]));
  const actors = people.map((p, i) => ({ id: p.id, label: p.label, side: 1, x: p.x, z: p.z, yaw: i, appearance: { ...p.spec.appearance, name: p.spec.name } }));
  const talk = (id) => {
    const L = (text, extra = {}) => ({ actor: id, label: people.find((p) => p.id === id)?.label || id, text, ...extra });
    if (id === 'partner') return [L(pickFresh('partner', partnerLines(c, myName, t))), L('On change quelque chose dans l\'équipe ?', { choices: [{ label: 'Voir les partenaires' }, { label: 'Non, on continue ensemble' }], onChoose: (k, g) => { if (k === 0) g.roam.pending = (gg) => gg.endRoam(() => ui.show('partner')); return []; } })];
    if (id === 'coach') return [L(pickFresh('coach', coachLines(c, myName))), L('Tu veux travailler tes attributs ?', { choices: [{ label: 'Voir mes attributs' }, { label: 'Plus tard' }], onChoose: (k, g) => { if (k === 0) g.roam.pending = (gg) => gg.endRoam(() => ui.show('attributes')); return []; } })];
    if (id === 'barman') return [L(pickFresh('bar', BAR))];
    return [L(pickFresh('member', memberLines(c, myName)))];
  };
  ui.hide();
  game.start({
    mode: 'career', sceneOnly: true, format: '1v1', sets: 1, matchTiebreak: 7, venue: 'club', ambiance: 'sunset',
    lineup: { near: [{ ...c.humanSpec(c.lookFor(), 0), lane: 0 }], far: [{ ...npcSpec(genericNpc(rnd, 30), 'red', 0), lane: 0 }] },
    actors, party: false,
    roam: { camDist: 2.5, bounds: [-14, 14, 18.4, CZ + 7.5], startYaw: Math.PI, acts, spots, build, talk },
    onStarted: (g) => { g.players[0].pos.set(0, 0, 18.8); g.players[0].avatar.racket.visible = false; },
    onSceneEnd: () => ui.show('hub'),
  });
}

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
