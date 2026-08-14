/**
 * Prepara l'archivio da trascinare su Netlify Drop (app.netlify.com/drop):
 * contiene la pagina in file unico rinominata index.html e le sole
 * intestazioni, senza la parte di build che in un deploy manuale non serve.
 *
 *   npm run build:page && node tools/build-drop.mjs
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');
const STAGE = join(DIST, '_drop');
const ZIP = join(DIST, 'verdania-netlify.zip');

const page = join(DIST, 'verdania.html');
if (!existsSync(page)) {
  console.error('Manca dist/verdania.html: esegui prima "npm run build:page".');
  process.exit(1);
}

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });
copyFileSync(page, join(STAGE, 'index.html'));

// Nel deploy manuale non c'e' nessuna build: tengo solo le intestazioni.
const toml = readFileSync(join(ROOT, 'netlify.toml'), 'utf8');
const headersOnly = toml.slice(toml.indexOf('[[headers]]'));
writeFileSync(
  join(STAGE, 'netlify.toml'),
  `# Intestazioni per il deploy manuale (trascinamento su Netlify Drop).\n\n${headersOnly}`,
);

rmSync(ZIP, { force: true });
try {
  execFileSync('zip', ['-q', '-r', ZIP, '.'], { cwd: STAGE });
} catch {
  console.error(
    'Comando "zip" non disponibile: la cartella dist/_drop e\' pronta,\n' +
    'comprimila a mano oppure trascina direttamente quella cartella su Netlify Drop.',
  );
  process.exit(0);
}
rmSync(STAGE, { recursive: true, force: true });

const size = (readFileSync(ZIP).length / 1024).toFixed(0);
console.log(`Archivio da trascinare: ${ZIP} (${size} kB)`);
