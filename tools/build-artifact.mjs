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
const html = shell.replace('/*__BUNDLE__*/', () => bundle);

mkdirSync(DIST, { recursive: true });
writeFileSync(OUT, html);
console.log(`Pagina autonoma: ${OUT} (${(html.length / 1024).toFixed(0)} kB)`);
