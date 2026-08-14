/**
 * Verifica il pacchetto pronto per la pubblicazione: serve la cartella dist
 * applicando le stesse intestazioni dichiarate in dist/_headers (quelle che
 * Netlify leggera' davvero, Content Security Policy compresa) e poi ci gioca
 * una partita intera.
 *
 *   npm run build:page && node tools/check-deploy.mjs
 */

import { spawn } from 'node:child_process';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');
const PORT = 5193;
const BASE = `http://127.0.0.1:${PORT}`;

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('Manca dist/: esegui prima "npm run build:page".');
  process.exit(1);
}

/** Legge dist/_headers nel formato di Netlify: percorso, poi righe rientrate. */
function readHeaders() {
  const file = join(DIST, '_headers');
  if (!existsSync(file)) return [];
  const blocks = [];
  let current = null;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      current = { pattern: raw.trim(), values: {} };
      blocks.push(current);
      continue;
    }
    const kv = /^\s+([A-Za-z-]+):\s*(.*)$/.exec(raw);
    if (kv && current) current.values[kv[1]] = kv[2];
  }
  return blocks;
}

function matches(pattern, path) {
  if (pattern === '/*') return true;
  if (pattern.endsWith('/*')) return path.startsWith(pattern.slice(0, -1));
  return pattern === path;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.zip': 'application/zip',
};

const headerBlocks = readHeaders();
if (headerBlocks.length === 0) {
  console.error('Manca dist/_headers: senza intestazioni la prova non dimostra niente.');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, BASE);
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = join(DIST, normalize(path).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('non trovato');
    return;
  }
  const headers = { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' };
  for (const block of headerBlocks) {
    if (matches(block.pattern, path)) Object.assign(headers, block.values);
  }
  res.writeHead(200, headers);
  createReadStream(file).pipe(res);
});

await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

let failures = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => {
  failures++;
  console.log(`  \x1b[31m✗\x1b[0m ${m}`);
};

console.log('\nINTESTAZIONI');
const res = await fetch(`${BASE}/index.html`);
const csp = res.headers.get('content-security-policy') ?? '';
csp.includes("default-src 'none'") ? ok('la Content Security Policy è attiva') : bad('CSP mancante');
csp.includes("connect-src 'none'") ? ok('nessuna connessione in uscita permessa') : bad('connect-src non bloccato');
res.headers.get('x-content-type-options') === 'nosniff' ? ok('nosniff') : bad('nosniff mancante');
const assets = await fetch(`${BASE}/assets/${readFileSync(join(DIST, 'index.html'), 'utf8').match(/assets\/([^"']+\.js)/)[1]}`);
(assets.headers.get('cache-control') ?? '').includes('immutable')
  ? ok('gli asset sono in cache per sempre')
  : bad('cache degli asset non impostata');

console.log('\nPARTITA SUL PACCHETTO PUBBLICATO');
const code = await new Promise((resolve) => {
  const child = spawn(process.execPath, [join(ROOT, 'tools', 'test.mjs'), `--url=${BASE}`], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  child.on('close', resolve);
});
if (code !== 0) failures++;

server.close();
console.log(`\n${failures === 0 ? '\x1b[32mPACCHETTO PRONTO\x1b[0m' : `\x1b[31m${failures} problemi\x1b[0m`}\n`);
process.exit(failures === 0 ? 0 : 1);
