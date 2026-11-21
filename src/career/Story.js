// ============================================================================
//  Fil narratif de la carrière : des messages (coach, partenaire, presse,
//  rivaux) débloqués par les étapes du parcours. Chaque chapitre n'arrive
//  qu'une fois ; ils s'empilent dans la messagerie du joueur.
// ============================================================================
const FROM = {
  coach: { name: 'Coach Rémi', role: 'Votre entraîneur' },
  partner: { name: 'Votre partenaire', role: 'Message' },
  raf: { name: 'Raf Tomatis', role: '« La légende du club » (selon lui)' },
  jean: { name: 'Jean Deuxbé', role: 'Le collègue' },
  press: { name: 'La Gazette du Padel', role: 'Presse' },
  fed: { name: 'Fédération', role: 'Courrier officiel' },
};

/** Chapitres. when(c, ev) -> vrai pour déclencher. ev : { type, summary, result }. */
export const CHAPTERS = [
  { id: 'intro', from: 'coach', title: 'Bienvenue au club', when: (c, ev) => ev.type === 'start',
    text: (c) => `Alors c'est toi, ${c.s.profile.name} ? On m'a dit que tu tapais fort et que tu courais partout. Ici, ça ne suffit pas. On commence par les tournois de quartier, on apprend la vitre, et on verra. Un jour, peut-être, le circuit mondial… Mais d'abord, gagne un match.` },
  { id: 'raf-intro', from: 'raf', title: 'Le patron, c\'est moi', when: (c, ev) => ev.type === 'start',
    text: () => 'Salut le nouveau. Moi c\'est Raf. Raf Tomatis. Tu as sûrement entendu parler de moi : invaincu au club depuis… enfin, depuis longtemps. Si tu me croises en tournoi, prépare-toi à ramasser des balles. Par trois. Bisous.' },
  { id: 'first-win', from: 'coach', title: 'Une première victoire', when: (c, ev) => ev.type === 'match' && ev.summary.won && c.s.stats.won === 1,
    text: () => 'Pas mal du tout. J\'ai vu des choses à corriger (ta bandeja part dans les grillages) mais tu as du caractère. Viens aux entraînements : un atelier par semaine, et tu verras la différence.' },
  { id: 'first-loss', from: 'jean', title: 'T\'inquiète', when: (c, ev) => ev.type === 'match' && !ev.summary.won && c.s.stats.played - c.s.stats.won === 1,
    text: () => 'Hé, on a tous perdu notre premier match. Moi j\'ai perdu mes dix premiers. Bon, je joue surtout des lobs. Rendez-vous au bar du club, c\'est ma tournée !' },
  { id: 'beat-raf', from: 'press', title: 'Raf Tomatis tombe de haut', when: (c, ev) => ev.type === 'match' && ev.summary.won && ev.summary.opponents?.players?.some((p) => p.id === 'rafael-tomatis'),
    text: (c) => `Coup de tonnerre au club : Raf Tomatis, qui annonçait « une victoire en vingt minutes chrono », s'est incliné face à ${c.s.profile.name}. Interrogé à la sortie, l'intéressé accuse le vent, le soleil, ses cordages et « un filet clairement trop haut ».` },
  { id: 'raf-excuse', from: 'raf', title: 'C\'était pas moi', when: (c) => c.s.story?.seen.includes('beat-raf'),
    text: () => 'Pour info : j\'ai viré mon partenaire. Il n\'a pas touché une balle, il m\'a fait perdre tout seul. Moi j\'étais au top. Je me trouve quelqu\'un de mon niveau et je reviens. Enfin, si quelqu\'un de mon niveau existe.' },
  { id: 'raf-rematch', from: 'raf', title: 'Revanche', when: (c, ev) => ev.type === 'match' && c.s.story?.seen.includes('beat-raf') && ev.summary.won && c.s.stats.won >= 4,
    text: () => 'Bon. Ok. Tu as eu de la chance l\'autre fois. J\'avais mal dormi, mon chien était malade, et ma raquette était neuve. La prochaine fois je te détruis. D\'ailleurs je m\'entraîne déjà. Enfin, je vais m\'y mettre lundi.' },
  { id: 'lost-raf', from: 'raf', title: 'Hahaha', when: (c, ev) => ev.type === 'match' && !ev.summary.won && ev.summary.opponents?.players?.some((p) => p.id === 'rafael-tomatis'),
    text: () => 'JE TE L\'AVAIS DIT. Raf Tomatis, LA LÉGENDE. J\'ai fait encadrer la feuille de match. Tu veux un autographe ?' },
  { id: 'first-title', from: 'coach', title: 'Premier trophée', when: (c, ev) => ev.type === 'match' && ev.summary.title && c.s.stats.titles === 1,
    text: (c) => `${c.s.profile.name}, ton nom est sur le tableau du club. Savoure ce soir, mais demain on retravaille le placement. Les gens commencent à parler de toi… et Raf fait semblant de ne pas l'avoir vu.` },
  { id: 'regional', from: 'fed', title: 'Accès au circuit régional', when: (c, ev) => ev.type === 'match' && ev.summary.unlocked && c.tier.id === 'regional',
    text: () => 'Félicitations : votre classement vous ouvre les tournois régionaux. Le niveau monte d\'un cran : des joueurs passés par les centres de formation, des personnalités… et des matchs qui se jouent à la vitre.' },
  { id: 'regional-coach', from: 'coach', title: 'Fini la récré', when: (c) => c.tier.id === 'regional' && c.s.story?.seen.includes('regional'),
    text: () => 'Les tournois de quartier, c\'est fini. Raf restera là-bas à raconter ses exploits, nous on avance. Au régional, ceux qui gagnent sont ceux qui ne donnent pas de points : sois patient, attends la balle à smasher.' },
  { id: 'national', from: 'press', title: 'Un nouveau nom au national', when: (c, ev) => ev.type === 'match' && ev.summary.unlocked && c.tier.id === 'national',
    text: (c) => `La Gazette a repéré ${c.s.profile.name}, qui débarque sur le circuit national. Les sponsors tournent autour, les stades se remplissent. Prochaine étape : se frotter aux anciens pros et aux stars du foot reconverties.` },
  { id: 'national-raf', from: 'raf', title: 'Je l\'ai toujours dit', when: (c) => c.s.story?.seen.includes('national'),
    text: () => 'Je l\'ai toujours dit que tu irais loin. C\'est moi qui t\'ai tout appris, en fait. Tu pourras le dire aux journalistes ? Et tu me prends des places pour ton prochain match ? Quatre. Non, six.' },
  { id: 'pro', from: 'fed', title: 'Le circuit mondial', when: (c, ev) => ev.type === 'match' && ev.summary.unlocked && c.tier.id === 'pro',
    text: () => 'Vous êtes invité sur le circuit mondial. Les meilleurs joueurs de la planète vous attendent : arènes pleines, caméras, commentateurs. Bonne chance.' },
  { id: 'pro-coach', from: 'coach', title: 'Le rêve', when: (c) => c.s.story?.seen.includes('pro'),
    text: () => 'Tu te souviens du premier jour ? Tu ne savais pas sortir une balle de la vitre. Maintenant tu vas jouer contre ceux qu\'on regardait à la télé le dimanche. Ne joue pas pour moi. Joue pour gagner.' },
  { id: 'top100', from: 'press', title: 'Entrée dans le top 100', when: (c) => c.rank <= 100,
    text: (c) => `${c.s.profile.name} fait son entrée dans le top 100 mondial. Un parcours parti d'un tournoi de quartier, qui fait rêver tous les clubs du pays.` },
  { id: 'top10', from: 'coach', title: 'Top 10', when: (c) => c.rank <= 10,
    text: () => 'Top 10. Je n\'ai plus grand-chose à t\'apprendre… à part peut-être à rester humble. Il reste neuf paires devant, et elles n\'ont aucune envie de te laisser passer.' },
  { id: 'no1', from: 'press', title: 'Numéro 1 mondial !', when: (c, ev) => ev.summary?.worldNo1,
    text: (c) => `C'est historique : ${c.s.profile.name} est numéro 1 mondial. Au club, une banderole a été accrochée au-dessus du bar. Raf Tomatis affirme l'avoir peinte lui-même.` },
  { id: 'season2', from: 'coach', title: 'Nouvelle saison', when: (c) => c.season >= 2,
    text: () => 'Nouvelle saison : les points de l\'an dernier vont expirer peu à peu. Ce qu\'on a gagné, il faut le défendre. On repart au travail.' },
];

/** Vérifie les chapitres après un évènement ; renvoie les nouveaux messages. */
export function advanceStory(career, ev) {
  const st = (career.s.story ??= { seen: [], inbox: [] });
  const fresh = [];
  for (const ch of CHAPTERS) {
    if (st.seen.includes(ch.id)) continue;
    let ok = false;
    try { ok = ch.when(career, ev); } catch { ok = false; }
    if (!ok) continue;
    st.seen.push(ch.id);
    const msg = { id: ch.id, from: FROM[ch.from], title: ch.title, text: ch.text(career), week: career.s.week, read: false };
    st.inbox.push(msg);
    fresh.push(msg);
  }
  if (st.inbox.length > 40) st.inbox.splice(0, st.inbox.length - 40);
  return fresh;
}

export const unread = (career) => (career.s.story?.inbox || []).filter((m) => !m.read);

/** Petite phrase avant un match contre une personnalité qui a des répliques. */
export function taunt(npc, seed = 0) {
  const t = npc?.taunts;
  return t?.length ? t[Math.abs(seed) % t.length] : null;
}
