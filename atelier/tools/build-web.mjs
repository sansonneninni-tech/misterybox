// Prepara la versione di prova statica in dist-web/ (per Netlify).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist-web');
fs.rmSync(OUT, { recursive: true, force: true });
const copy = (from, to = from) => fs.cpSync(path.join(ROOT, from), path.join(OUT, to), { recursive: true });

copy('web', '.');
copy('shared');
for (const f of ['tokens.css', 'components.css', 'fonts', 'prototype/data.js', 'prototype/media']) {
  if (fs.existsSync(path.join(ROOT, 'design', f))) copy(path.join('design', f));
}
// Nella versione online l'API vive nel browser.
const idx = path.join(OUT, 'index.html');
fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8').replace('<head>', '<head>\n<script>window.ATELIER_FORCE_DEMO = true;</script>'));
console.log('Versione di prova pronta in', path.relative(process.cwd(), OUT) || OUT);
