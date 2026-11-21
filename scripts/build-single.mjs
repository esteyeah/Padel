// Construit une version autonome du jeu en un seul fichier HTML (Three.js inclus).
//   node scripts/build-single.mjs            -> dist/padel-arena.html (document complet)
//   node scripts/build-single.mjs --fragment -> dist/padel-arena.fragment.html (sans <html>/<head>/<body>)
//   node scripts/build-single.mjs --web      -> public/index.html (site en ligne : musiques en fichiers MP3 séparés)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const fragment = process.argv.includes('--fragment');
const web = process.argv.includes('--web');
// version site : les musiques ne sont pas intégrées, elles sont lues depuis public/music/
const webMusic = {
  name: 'web-music',
  setup(b) { b.onResolve({ filter: /assets\/music\.js$/ }, () => ({ path: new URL('../src/assets/music-web.js', import.meta.url).pathname })); },
};
const res = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
  write: false,
  legalComments: 'none',
  plugins: web ? [webMusic] : [],
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('styles.css', 'utf8');
const html = readFileSync('index.html', 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"')).trim();
const fonts = html.match(/<link href="https:\/\/fonts\.googleapis\.com[^>]+>/)[0];

const head = `<title>Padel Arena 3D</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts}
<style>
:root { color-scheme: dark; }
${css}
</style>`;
const content = `${body}\n<script type="module">${js}</script>`;
const out = fragment
  ? `${head}\n${content}\n`
  : `<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${content}\n</body>\n</html>\n`;
const dir = web ? 'public' : 'dist';
mkdirSync(dir, { recursive: true });
const file = web ? 'public/index.html' : `dist/padel-arena${fragment ? '.fragment' : ''}.html`;
writeFileSync(file, out);
console.log(`${file} : ${(out.length / 1024).toFixed(0)} Ko`);
