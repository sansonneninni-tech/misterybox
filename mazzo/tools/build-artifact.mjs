/**
 * Compone la pagina autonoma: prende il bundle prodotto da Vite e lo
 * incorpora nel "guscio", cosi' la pagina non fa nessuna richiesta di rete e
 * funziona anche offline, da disco o dentro un iframe.
 *
 * Produce due file:
 *   dist/mazzo.html     pagina completa, apribile da sola
 *   dist/artifact.html  solo il corpo, per chi fornisce lui l'intestazione
 *
 *   npm run build && node tools/build-artifact.mjs
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');

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
writeFileSync(join(DIST, 'artifact.html'), body);

const page = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="color-scheme" content="dark" />
<meta name="theme-color" content="#17130f" />
<meta name="description" content="MAZZO: mini RPG narrativo. Un pomeriggio d'estate, un turno da fare, una busta da ritirare. Funziona senza connessione." />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%2317130f'/%3E%3Crect x='4' y='3' width='8' height='5' fill='%23c68a5b'/%3E%3Crect x='4' y='7' width='8' height='2' fill='%232f2620'/%3E%3Crect x='3' y='9' width='10' height='5' fill='%2359632f'/%3E%3C/svg%3E" />
</head>
<body>
${body}
</body>
</html>
`;
writeFileSync(join(DIST, 'mazzo.html'), page);

const kb = (n) => `${Math.round(n / 1024)} kB`;
console.log(`dist/artifact.html  ${kb(body.length)}`);
console.log(`dist/mazzo.html     ${kb(page.length)}`);
