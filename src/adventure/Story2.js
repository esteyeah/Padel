// ============================================================================
//  Mode Aventure — chapitres 7 (national), 8 (Mondial) et 9 (tournoi d'honneur).
// ============================================================================
const NAME = { eliott: 'Eliott', jean: 'Jean', raf: 'Raf', louka: 'Louka', me: 'toi' };
const pair = (ids) => ids.map((i) => NAME[i] || i).join(' et ');
const article = (title, body) => `<h4 style="font-family:Georgia,serif;letter-spacing:0">La Provence</h4><div style="text-align:center;font:800 20px Georgia,serif;margin:4px 0 8px">${title}</div><p style="font:15px/1.45 Georgia,serif;margin:0">${body}</p>`;

export const CH7 = {
  c7_start: {
    type: 'scene', venue: 'national', ambiance: 'night', cast: (c) => ['me', c.partner6, 'mayor'],
    lines: (c) => [
      { who: 'narr', text: 'Le Centre national. Des tribunes pleines, des caméras, des pros et des célébrités dans le même tableau.' },
      { who: 'mayor', text: 'Un enfant de Ceyreste au national ! J\'ai prévenu La Provence, ils envoient un journaliste.' },
      { who: c.partner6, text: c.s.rep <= -10 ? 'Le public siffle quand on entre… notre réputation nous suit.' : 'Le public nous applaudit ! Tu entends ?' },
      { who: 'me', text: 'Zlatan et Zidane au premier tour… on ne pouvait pas rêver plus fou.' },
      { who: 'mayor', text: 'Si vous battez Zlatan, je fais graver vos noms sur la fontaine du village !' },
    ],
    next: 'c7_r1',
  },
  c7_r1: { type: 'match', label: 'Tour 1 contre Zlatan et Zidane', format: '2v2', mt: 10, venue: 'national', ambiance: 'night', near: (c) => ['me', c.partner6], far: ['zlatan', 'zidane'], title: '1ER TOUR', subtitle: 'Championnat national', win: 'c7_r2', lose: 'c7_press1' },
  c7_r2: { type: 'match', label: 'Quart de finale contre Ruffier et Payet', format: '2v2', mt: 10, venue: 'national', ambiance: 'night', near: (c) => ['me', c.partner6], far: ['ruffier', 'payet'], hard: true, title: 'QUART DE FINALE', subtitle: 'Championnat national', win: 'c7_press3', lose: 'c7_press2' },
  c7_press1: { type: 'scene', venue: 'national', ambiance: 'night', spot: 'talk', cast: (c) => ['me', c.partner6, 'mayor'], lines: [{ who: 'mayor', text: 'Regardez, le journal !', sheet: article('Ceyreste découvre le national', 'Éliminé dès le premier tour face à Zlatan et Zidane, le binôme ceyrestois a donné du fil à retordre aux stars. « Une expérience incroyable », confie le joueur, arrivé au padel il y a quelques mois.') }], next: 'end_national' },
  c7_press2: { type: 'scene', venue: 'national', ambiance: 'night', spot: 'talk', cast: (c) => ['me', c.partner6, 'mayor'], lines: [{ who: 'mayor', text: 'Une demi-page dans La Provence !', sheet: article('Le petit poucet de Ceyreste tombe en quart', 'Après avoir sorti Zlatan et Zidane, la paire varoise s\'incline face à Ruffier et Payet. Le maire de Ceyreste promet « une fête au village ».') }], next: 'end_national' },
  c7_press3: { type: 'scene', venue: 'national', ambiance: 'night', spot: 'talk', cast: (c) => ['me', c.partner6, 'mayor'], set: { mondial: true }, lines: [{ who: 'mayor', text: 'UNE PLEINE PAGE !', sheet: article('De Ceyreste au Mondial !', 'Arrivé au padel par hasard, remplaçant d\'un ami blessé, le joueur ceyrestois atteint le dernier carré du championnat national et décroche son billet pour le tournoi mondial. Toute la commune est en fête.') }, { who: 'mayor', text: 'Le Mondial ! Vous allez au MONDIAL !' }], next: 'ch7_end' },
  end_national: { type: 'end', chapter: 7, final: true, ending: 'national', text: () => 'FIN : ton aventure s\'arrête au championnat national… et dans les pages de La Provence.' },
  ch7_end: { type: 'end', chapter: 7, next: 'c8_choose', text: () => 'Qualifié pour le tournoi mondial !' },
};

export const CH8 = {
  c8_choose: {
    type: 'scene', venue: 'pro', ambiance: 'night', spot: 'talk', cast: (c) => ['me', c.partner3, 'mayor', ...(c.f.enemyRomeo ? [] : ['coach'])],
    lines: (c) => [
      { who: 'mayor', text: 'Pour le Mondial, la fédération te laisse choisir ton partenaire. Réfléchis bien.' },
      { who: c.partner3, text: 'Quoi que tu choisisses… je comprendrai.' },
    ],
    choice: {
      who: 'narr', text: 'Avec qui joues-tu le Mondial ?',
      options: (c) => [
        { label: `${NAME[c.partner3]}, ton partenaire de toujours`, sub: 'La fidélité avant tout.', effects: { [c.partner3]: 25 }, set: { p8: c.partner3 }, next: 'c8_r1' },
        ...(c.f.enemyRomeo ? [] : [{ label: 'Roméo, ton coach', sub: 'Son retour sur le circuit, dix ans après.', effects: { coach: 20, [c.partner3]: -10 }, set: { p8: 'coach' }, next: 'c8_r1' }]),
        ...(c.f.contactNasri ? [{ label: 'Samir Nasri', sub: 'Il t\'a donné son numéro à la Riviera.', effects: { [c.partner3]: -15 }, set: { p8: 'nasri' }, next: 'c8_r1' }] : []),
        { label: 'Benjamin Tison, pro français', sub: 'Le plus fort… mais tu ne le connais pas.', effects: { [c.partner3]: -20 }, set: { p8: 'tison' }, next: 'c8_r1' },
      ],
    },
  },
  c8_r1: { type: 'match', label: 'Mondial : 1er tour', format: '2v2', mt: 10, venue: 'pro', ambiance: 'night', near: (c) => ['me', c.f.p8], far: ['random', 'random'], randomOvr: 70, title: '1ER TOUR', subtitle: 'Tournoi mondial', win: 'c8_semi_pre', lose: 'c8_out' },
  c8_semi_pre: {
    type: 'scene', venue: 'pro', ambiance: 'night', spot: 'between', cast: (c) => ['me', c.f.p8, ...c.semi8],
    lines: (c) => [
      { who: c.semi8[0], text: 'Toi et nous, en demi-finale du Mondial. On était à l\'entraînement de Roméo il y a un an.' },
      { who: c.semi8[1], text: 'Une finale du Mondial… c\'est le rêve de toute ma vie.' },
    ],
    choice: {
      who: 'narr', text: 'Ce match, comment le joues-tu ?',
      options: [
        { label: 'Les laisser gagner pour qu\'ils vivent leur rêve', rep: 10, effects: (c) => ({ [c.semi8[0]]: 30, [c.semi8[1]]: 30 }), set: { gaveSemi: true }, after: (c) => [{ who: 'narr', text: 'Sur la balle de match, ton revers file volontairement dans le filet.' }, { who: c.semi8[0], text: '… Tu as fait exprès. Je ne l\'oublierai jamais.' }], next: 'c8_final_friends' },
        { label: 'Jouer le jeu à fond', next: 'c8_semi' },
      ],
    },
  },
  c8_semi: { type: 'match', label: 'Demi-finale du Mondial contre tes amis', format: '2v2', mt: 10, venue: 'pro', ambiance: 'night', near: (c) => ['me', c.f.p8], far: (c) => c.semi8, hard: true, title: 'DEMI-FINALE', subtitle: 'Tournoi mondial', win: 'c8_final', lose: 'c8_final_friends' },
  c8_final: { type: 'match', label: 'Finale du Mondial contre Tapia et Coello', format: '2v2', mt: 10, venue: 'pro', ambiance: 'night', near: (c) => ['me', c.f.p8], far: ['tapia', 'coello'], hard: true, title: 'FINALE', subtitle: 'Tournoi mondial', win: 'c8_champ', lose: 'c8_finalist' },
  c8_champ: { type: 'scene', venue: 'pro', ambiance: 'night', spot: 'talk', cast: (c) => ['me', c.f.p8, 'mayor'], set: { worldChamp: true, money: 50000 }, lines: [{ who: 'mayor', text: 'CHAMPION DU MONDE ! UN CEYRESTOIS CHAMPION DU MONDE !' }, { who: 'narr', text: 'Prime de champion du monde : 50 000 €. Et la fédération t\'offre la Raquette du Mondial, en édition unique.' }], next: 'ch8_end' },
  c8_finalist: { type: 'scene', venue: 'pro', ambiance: 'night', spot: 'talk', cast: (c) => ['me', c.f.p8, 'mayor'], set: { worldFinal: true }, lines: [{ who: 'mayor', text: 'Finaliste du Mondial ! Contre les meilleurs joueurs de la planète ! Quelle fierté !' }], next: 'ch8_end' },
  c8_final_friends: { type: 'scene', venue: 'pro', ambiance: 'night', spot: 'talk', cast: (c) => ['me', ...c.semi8, 'mayor'], lines: (c) => [{ who: 'narr', text: `${pair(c.semi8)} jouent la finale du Mondial contre Tapia et Coello. Ils perdent, mais tout Ceyreste a vu leurs larmes de joie.` }, { who: c.semi8[0], text: c.f.gaveSemi ? 'Cette finale, c\'est la tienne aussi.' : 'Merci d\'avoir été un si grand adversaire.' }], next: 'ch8_end' },
  c8_out: { type: 'scene', venue: 'pro', ambiance: 'night', spot: 'talk', cast: (c) => ['me', c.f.p8, 'mayor'], lines: [{ who: 'mayor', text: 'Éliminés au premier tour… mais vous avez joué un Mondial ! À Ceyreste, on vous attend en héros.' }], next: 'ch8_end' },
  ch8_end: { type: 'end', chapter: 8, next: 'c9_start', text: (c) => `${c.f.worldChamp ? 'Champion du monde !' : c.f.worldFinal ? 'Finaliste du Mondial !' : 'Le Mondial est terminé.'} Le maire prépare une fête en ton honneur…` },
};

// invités possibles : [id, peut être invité ?, accepte ?]
export const GUESTS = [
  ['eliott', () => true, (c) => (c.s.rel.eliott || 0) >= 0],
  ['jean', () => true, (c) => (c.s.rel.jean || 0) >= -10],
  ['raf', () => true, (c) => (c.s.rel.raf || 0) >= 0],
  ['louka', (c) => c.f.metLouka, (c) => (c.s.rel.louka || 0) >= 0],
  ['coach', () => true, (c) => !c.f.enemyRomeo && (c.s.rel.coach || 0) >= 0],
  ['nasri', (c) => c.f.contactNasri, () => true],
  ['ruffier', (c) => c.f.contacts, () => true],
  ['hanouna', (c) => c.f.contactHanouna || c.f.hanounaEnemy, (c) => !c.f.hanounaEnemy],
  ['flavien', (c) => c.f.contactFlavien, () => true],
];
const GNAME = { ...NAME, coach: 'Roméo', nasri: 'Samir Nasri', ruffier: 'Stéphane Ruffier', hanouna: 'Cyril Hanouna', flavien: 'Flavien le barman' };
const nextInv = (i) => (i + 1 < GUESTS.length ? `c9_inv_${i + 1}` : 'c9_replies');

export const CH9 = {
  c9_start: {
    type: 'scene', venue: 'ceyreste', ambiance: 'day', spot: 'talk', cast: ['me', 'mayor'],
    lines: [{ who: 'mayor', text: 'Pour célébrer nos héros, la mairie organise un tournoi en ton honneur, ici, à Ceyreste ! Et c\'est toi qui choisis les invités.' }],
    next: 'c9_inv_0',
  },
  ...Object.fromEntries(GUESTS.map(([, can], i) => [`c9_inv_${i}`, { type: 'branch', to: (c) => (can(c) ? `c9_ask_${i}` : nextInv(i)) }])),
  ...Object.fromEntries(GUESTS.map(([id], i) => [`c9_ask_${i}`, {
    type: 'choice', venue: 'ceyreste', spot: 'talk', cast: ['me', 'mayor'], who: 'mayor', text: `Et ${GNAME[id]}, on l'invite ?`,
    options: [
      { label: `Inviter ${GNAME[id]}`, set: (c) => ({ inv: [...(c.f.inv || []), id] }), next: nextInv(i) },
      { label: 'Ne pas l\'inviter', next: nextInv(i) },
    ],
  }])),
  c9_replies: {
    type: 'scene', venue: 'ceyreste', ambiance: 'day', spot: 'talk', cast: (c) => ['me', 'mayor', ...c.guests9.slice(0, 4)],
    lines: (c) => {
      const L = (c.f.inv || []).map((id) => ({ who: 'narr', text: GUESTS.find((g) => g[0] === id)[2](c) ? `${GNAME[id]} a accepté l'invitation !` : `${GNAME[id]} a refusé l'invitation.` }));
      return L.length ? L : [{ who: 'mayor', text: 'Personne d\'invité ? Bon… on jouera entre Ceyrestois.' }];
    },
    next: 'c9_match',
  },
  c9_match: { type: 'match', label: 'Tournoi d\'honneur : la finale', format: '2v2', mt: 10, venue: 'ceyreste', ambiance: 'sunset', near: (c) => ['me', c.h9[0]], far: (c) => [c.h9[1], c.h9[2]], randomOvr: 40, title: 'TOURNOI D\'HONNEUR', subtitle: 'Ceyreste', win: 'c9_party', lose: 'c9_party' },
  c9_party: {
    type: 'scene', venue: 'ceyreste', ambiance: 'night', spot: 'talk', cast: (c) => ['me', 'mayor', ...c.guests9.slice(0, 5)],
    lines: (c) => {
      const say = {
        eliott: 'Et dire que tout a commencé par un coup de fil… Je t\'ai écrit une chanson. Elle s\'appelle « Mon meilleur ami ».',
        jean: 'Je l\'ai toujours dit : tu avais quelque chose. Santé, champion !',
        raf: 'Bon… je l\'admets. Tu es devenu meilleur que moi. Ne le répète à personne.',
        louka: 'Tu m\'as pris ma place, puis tu l\'as méritée. Respect.',
        coach: 'Le meilleur élève que j\'aie jamais eu. Grâce à toi, j\'ai retrouvé le goût du padel.',
        nasri: 'Toujours autant de répondant ? Parfait. Santé !',
        ruffier: 'De Ceyreste au Mondial. Il y a des histoires qu\'on n\'invente pas.',
        hanouna: 'Je le dirai dans mon émission : un garçon en or !',
        flavien: 'La tireuse est branchée ! Ce soir, tout le monde boit à la santé du champion !',
      };
      const L = [{ who: 'mayor', text: 'À notre champion ! À Ceyreste !' }];
      for (const id of c.guests9) if (say[id]) L.push({ who: id, text: say[id] });
      L.push({ who: 'narr', text: 'La nuit tombe sur Ceyreste. Les rires, la musique, les verres qui trinquent. Ton aventure se termine ici… entouré de ceux qui l\'ont rendue possible.' });
      return L;
    },
    next: 'c9_end_branch',
  },
  c9_end_branch: { type: 'branch', to: (c) => (c.s.rep >= 20 ? 'end_fair' : c.s.rep <= -10 ? 'end_dark' : 'end_friend') },
  end_fair: { type: 'end', chapter: 9, final: true, ending: 'fair', text: () => 'FIN : la légende fair-play de Ceyreste. Tout le monde t\'admire, sur et en dehors du court.' },
  end_dark: { type: 'end', chapter: 9, final: true, ending: 'dark', text: () => 'FIN : le champion que personne n\'aime. Des trophées plein la vitrine, mais si peu d\'amis à la fête.' },
  end_friend: { type: 'end', chapter: 9, final: true, ending: 'friend', text: () => 'FIN : l\'ami fidèle. Pas parfait, mais entouré de ceux qui comptent.' },
};
