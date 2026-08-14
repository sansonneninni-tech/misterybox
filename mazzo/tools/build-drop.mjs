/**
 * Prepara l'archivio da trascinare su Netlify Drop (app.netlify.com/drop).
 * Dentro c'e' la cartella pubblicata cosi' com'e', comprese le intestazioni:
 * il sito che ne esce e' identico a quello costruito dal repository.
 *
 *   npm run build:page && node tools/build-drop.mjs
 */

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');
const STAGE = join(DIST, '_drop');
const ZIP = join(DIST, 'mazzo-netlify.zip');

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('Manca dist/: esegui prima "npm run build:page".');
  process.exit(1);
}

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });
for (const entry of ['index.html', 'mazzo.html', 'assets', '_headers']) {
  const from = join(DIST, entry);
  if (existsSync(from)) cpSync(from, join(STAGE, entry), { recursive: true });
}

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

console.log(`Archivio da trascinare: ${ZIP} (${Math.round(statSync(ZIP).size / 1024)} kB)`);
readFileSync(ZIP); // se il file non fosse leggibile, meglio fallire qui
