# Mettre Padel Arena en ligne (Cloudflare)

Le jeu (dossier `public/`) et le serveur en ligne (`server/`) sont déployés ensemble sur Cloudflare Workers, gratuitement.

1. Créez un compte sur https://dash.cloudflare.com (gratuit).
2. Installez Node.js (https://nodejs.org), puis dans un terminal, depuis le dossier `server/` :

   ```bash
   npm install
   npx wrangler login
   npx wrangler deploy
   ```

3. Wrangler affiche l'adresse du jeu, du type `https://padel-arena.<votre-nom>.workers.dev`.
   Envoyez-la à vos amis : menu **En ligne** → pseudo → **Se connecter**.

Pour tester sur votre ordinateur : `npx wrangler dev`, puis ouvrez http://localhost:8787 dans deux onglets.

Pour reconstruire le jeu après une modification : `node scripts/build-single.mjs --web` (à la racine du projet).
