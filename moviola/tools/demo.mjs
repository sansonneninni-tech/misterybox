// Pagina demo in un solo file: tutta l'app, i caratteri e la grafica dentro
// un HTML che si apre ovunque, anche sull'iPhone, senza server. L'archivio
// resta nel browser; i file veri si fanno sul Mac con `npm start`.
//
//   node tools/demo.mjs            → dist/moviola-demo.html (pagina completa)
//   node tools/demo.mjs --artifact → dist/moviola-artifact.html (per la
//                                    pagina di prova pubblicata: niente download)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifact = process.argv.includes('--artifact');
const read = (p) => readFileSync(join(root, p), 'utf8');

// il motore e le schermate in un modulo solo (esbuild, scaricato al volo da npx)
const js = execFileSync('npx', ['--yes', 'esbuild@0.24.0', join(root, 'web/app.js'), '--bundle', '--format=esm', '--minify', '--target=safari15'], { encoding: 'utf8', maxBuffer: 64 << 20 });

const font = (f) => `url("data:font/woff2;base64,${readFileSync(join(root, 'design', f)).toString('base64')}")`;
const css = ['design/tokens.css', 'design/components.css', 'design/moviola.css', 'design/territorio.css'].map(read).join('\n')
  .replace(/url\("(fonts\/[^"]+\.woff2)"\)/g, (_, f) => font(f));
// nell'Artifact la pagina sta già dentro i margini di sicurezza dello schermo
const fit = artifact ? 'html { box-sizing: border-box; } .shell { height: 100% !important; }' : '';

const index = read('web/index.html');
const body = index.slice(index.indexOf('<body>') + 6, index.indexOf('<script type="module"'));
const icon = `data:image/svg+xml;base64,${readFileSync(join(root, 'web/icon.svg')).toString('base64')}`;
const head = `<title>MOVIOLA</title>
<meta name="description" content="Laboratorio di video astratti sperimentali: pagina di prova.">
<meta name="theme-color" content="#000000">
<link rel="icon" href="${icon}" type="image/svg+xml">
<style>${css}\n${fit}</style>`;
const script = `<script>window.MOVIOLA_DEMO = ${artifact ? "'artifact'" : "'file'"};</script>
<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`;

const html = `<!doctype html>\n<html lang="it">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n${script}\n</body>\n</html>\n`;

mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', artifact ? 'moviola-artifact.html' : 'moviola-demo.html');
writeFileSync(out, html);
console.log(`${out} · ${(html.length / 1024).toFixed(0)} KB`);
