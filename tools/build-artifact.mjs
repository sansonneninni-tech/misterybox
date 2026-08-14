/**
 * Compone la pagina autonoma da pubblicare: prende il bundle prodotto da Vite
 * e lo incorpora nel "guscio" HTML, così la pagina non fa nessuna richiesta
 * di rete e funziona anche offline o dentro un iframe.
 *
 *   npm run build && node tools/build-artifact.mjs
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'dist', 'verdania.html');

const bundleName = readdirSync(join(DIST, 'assets')).find((f) => f.endsWith('.js'));
if (!bundleName) {
  console.error('Bundle non trovato: esegui prima "npm run build".');
  process.exit(1);
}
const bundle = readFileSync(join(DIST, 'assets', bundleName), 'utf8');
if (bundle.includes('</script')) {
  console.error('Il bundle contiene una sequenza </script: incorporarlo non e\' sicuro.');
  process.exit(1);
}

const shell = readFileSync(join(ROOT, 'tools', 'shell.html'), 'utf8');
const body = shell.replace('/*__BUNDLE__*/', () => bundle);

/*
 * shell.html contiene solo il corpo della pagina, perche' l'artifact di
 * claude.ai fornisce lui l'intestazione del documento. Pubblicata da sola,
 * la pagina deve portarsela dietro: senza <meta name="viewport"> i browser
 * dei telefoni impaginano a 980px virtuali e poi rimpiccioliscono tutto,
 * e senza <!doctype> la pagina finisce in modalita' quirks.
 */
const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="color-scheme" content="dark" />
<meta name="theme-color" content="#070c13" />
<meta name="description" content="Verdania: gioco di ruolo 2D con visuale dall'alto, creature da catturare e combattimenti a turni. Funziona senza connessione." />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%23070c13'/%3E%3Cpath d='M4 11h8v2H4zM6 4h4v7H6z' fill='%234f9c48'/%3E%3Cpath d='M7 2h2v3H7z' fill='%238ad46a'/%3E%3C/svg%3E" />
</head>
<body>
${body}
</body>
</html>
`;

mkdirSync(DIST, { recursive: true });
writeFileSync(OUT, html);
console.log(`Pagina autonoma: ${OUT} (${(html.length / 1024).toFixed(0)} kB)`);
