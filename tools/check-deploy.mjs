/**
 * Verifica il pacchetto pronto per la pubblicazione: serve la cartella dist
 * applicando le stesse intestazioni dichiarate in netlify.toml (Content
 * Security Policy compresa) e controlla che il gioco parta davvero.
 *
 *   npm run build:page && node tools/check-deploy.mjs
 */

import { chromium } from 'playwright';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import http from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');
const PORT = 5188;

let failures = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => { failures++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };

/** Legge da netlify.toml le intestazioni da applicare, senza inventarle. */
function readHeaders() {
  const toml = readFileSync(join(ROOT, 'netlify.toml'), 'utf8');
  const blocks = [];
  const re = /\[\[headers\]\]\s*\n\s*for\s*=\s*"([^"]+)"\s*\n\s*\[headers\.values\]\n([\s\S]*?)(?=\n\[\[|\n\[build|$)/g;
  let m;
  while ((m = re.exec(toml)) !== null) {
    const values = {};
    for (const line of m[2].split('\n')) {
      const kv = /^\s*([A-Za-z-]+)\s*=\s*"([\s\S]*)"\s*$/.exec(line);
      if (kv) values[kv[1]] = kv[2];
    }
    blocks.push({ pattern: m[1], values });
  }
  return blocks;
}

function matches(pattern, path) {
  if (pattern.endsWith('/*')) return path.startsWith(pattern.slice(0, -1));
  if (pattern === '/*') return true;
  return pattern === path;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

async function main() {
  if (!existsSync(DIST)) {
    console.error('Manca dist/: esegui prima "npm run build:page".');
    process.exit(1);
  }
  const headerBlocks = readHeaders();

  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = urlPath === '/' ? '/index.html' : urlPath;
    const file = join(DIST, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404);
      res.end('non trovato');
      return;
    }
    const headers = { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' };
    for (const b of headerBlocks) {
      if (matches(b.pattern, rel)) Object.assign(headers, b.values);
    }
    res.writeHead(200, headers);
    createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, r));

  console.log('\n== Verifica del pacchetto da pubblicare ==\n');

  // --- contenuto della cartella ---
  const files = await readdir(DIST, { recursive: true });
  const list = files.filter((f) => !statSync(join(DIST, f)).isDirectory());
  const total = list.reduce((n, f) => n + statSync(join(DIST, f)).size, 0);
  console.log(`  ${list.length} file, ${(total / 1024).toFixed(0)} kB totali`);
  for (const required of ['index.html', 'verdania.html']) {
    if (list.includes(required)) ok(`${required} presente`);
    else bad(`${required} mancante`);
  }

  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  // Ogni pagina va provata anche su un telefono vero: e' li' che un documento
  // senza <meta name="viewport"> si rimpicciolisce fino a diventare inusabile.
  const targets = [
    { path: '/', device: 'desktop', width: 1000, height: 720, dpr: 1, mobile: false },
    { path: '/', device: 'telefono', width: 390, height: 780, dpr: 3, mobile: true },
    { path: '/verdania.html', device: 'desktop', width: 1000, height: 720, dpr: 1, mobile: false },
    { path: '/verdania.html', device: 'telefono', width: 390, height: 780, dpr: 3, mobile: true },
  ];

  for (const t of targets) {
    const page_path = t.path;
    const page = await browser.newPage({
      viewport: { width: t.width, height: t.height },
      deviceScaleFactor: t.dpr,
      hasTouch: t.mobile,
      isMobile: t.mobile,
    });
    const problems = [];
    page.on('pageerror', (e) => problems.push(`errore: ${e.message}`));
    page.on('console', (m) => {
      const t = m.text();
      // Le violazioni della CSP compaiono in console: vanno intercettate.
      if (m.type() === 'error' && !/favicon/.test(t)) problems.push(`console: ${t}`);
    });
    const external = [];
    page.on('request', (r) => {
      if (!r.url().startsWith(`http://127.0.0.1:${PORT}`)) external.push(r.url());
    });

    await page.goto(`http://127.0.0.1:${PORT}${page_path}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__verdania, null, { timeout: 15000 });
    await page.click('#boot-start');
    const frames = (n) => page.evaluate((c) => new Promise((r) => {
      let i = 0;
      const t = () => (++i >= c ? r() : requestAnimationFrame(t));
      requestAnimationFrame(t);
    }), n);
    await frames(60);
    await page.keyboard.press('KeyZ');   // NUOVA PARTITA
    await frames(30);
    await page.keyboard.press('KeyZ');   // conferma il nome
    await frames(60);
    // Chiude il dialogo introduttivo: finche' e' aperto il giocatore non si muove.
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('KeyZ');
      await frames(14);
    }
    await frames(20);

    // I nomi delle classi spariscono con la minificazione: verifichiamo lo
    // stato del gioco, non come si chiamano gli oggetti.
    const before = await page.evaluate(() => {
      const w = window.__verdania.world;
      return w ? { x: w.player.tx, y: w.player.ty } : null;
    });
    await page.keyboard.down('ArrowDown');
    await frames(50);
    await page.keyboard.up('ArrowDown');
    await frames(20);

    const st = await page.evaluate(() => {
      const w = window.__verdania.world;
      return {
        map: window.__verdania.state.mapId,
        mondo: !!w,
        x: w ? w.player.tx : null,
        y: w ? w.player.ty : null,
        errors: window.__verdania.game.errors.length,
        save: (() => { try { localStorage.setItem('_p', '1'); localStorage.removeItem('_p'); return true; } catch { return false; } })(),
      };
    });

    const label = `${page_path === '/' ? 'index.html' : 'verdania.html'} (${t.device})`;
    const mosso = before && (st.x !== before.x || st.y !== before.y);
    if (st.mondo && st.errors === 0 && mosso) {
      ok(`${label}: il gioco parte e risponde ai comandi (${st.map}, ${before.x},${before.y} -> ${st.x},${st.y})`);
    } else {
      bad(`${label}: mondo ${st.mondo}, movimento ${mosso}, errori ${st.errors}`);
    }
    const doc = await page.evaluate(() => {
      const c = document.getElementById('screen').getBoundingClientRect();
      return {
        modo: document.compatMode,           // "CSS1Compat" = modalita' standard
        viewport: !!document.querySelector('meta[name="viewport"]'),
        charset: !!document.characterSet,
        vw: window.innerWidth,
        larghezzaSchermo: Math.round(c.width),
      };
    });
    if (doc.modo === 'CSS1Compat') ok(`${label}: documento in modalita' standard`);
    else bad(`${label}: modalita' quirks (manca il doctype)`);
    if (doc.viewport) ok(`${label}: meta viewport presente`);
    else bad(`${label}: manca <meta name="viewport"> — su telefono la pagina si rimpicciolisce`);
    // Il viewport deve coincidere con la larghezza del dispositivo: se il
    // browser ripiega su ~980px, la pagina viene mostrata in miniatura.
    if (Math.abs(doc.vw - t.width) <= 2) ok(`${label}: viewport ${doc.vw}px = larghezza del dispositivo`);
    else bad(`${label}: viewport ${doc.vw}px invece di ${t.width}px — pagina rimpicciolita`);
    const quota = doc.larghezzaSchermo / t.width;
    if (quota >= 0.55) ok(`${label}: schermo di gioco ${doc.larghezzaSchermo}px (${Math.round(quota * 100)}% della larghezza)`);
    else bad(`${label}: schermo di gioco solo ${doc.larghezzaSchermo}px (${Math.round(quota * 100)}% della larghezza)`);

    if (problems.length === 0) ok(`${label}: nessuna violazione della CSP ne' errore in console`);
    else bad(`${label}: ${problems.length} problemi\n      ${problems.slice(0, 4).join('\n      ')}`);
    if (external.length === 0) ok(`${label}: nessuna richiesta verso l'esterno`);
    else bad(`${label}: richieste esterne -> ${external.slice(0, 3).join(', ')}`);
    if (st.save) ok(`${label}: salvataggio disponibile`);
    else bad(`${label}: localStorage non disponibile`);

    await page.screenshot({
      path: join(ROOT, 'screenshots', `deploy-${page_path === '/' ? 'index' : 'verdania'}-${t.device}.png`),
    });
    await page.close();
  }

  // --- intestazioni effettivamente inviate ---
  const probe = async (path) => {
    const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
    return res.headers;
  };
  const assetName = list.find((f) => f.startsWith('assets/') && f.endsWith('.js'));
  if (assetName) {
    const h = await probe(`/${assetName}`);
    if ((h.get('cache-control') ?? '').includes('immutable')) ok('assets/: cache lunga applicata');
    else bad(`assets/: cache-control = ${h.get('cache-control')}`);
  }
  const hIndex = await probe('/index.html');
  if ((hIndex.get('cache-control') ?? '').includes('must-revalidate')) ok('index.html: riconvalida sempre');
  else bad(`index.html: cache-control = ${hIndex.get('cache-control')}`);
  if (hIndex.get('content-security-policy')) ok('CSP applicata a tutte le pagine');
  else bad('CSP assente');

  await browser.close();
  server.close();
  console.log(failures === 0
    ? '\n\x1b[32mPACCHETTO PRONTO PER LA PUBBLICAZIONE\x1b[0m\n'
    : `\n\x1b[31m${failures} PROBLEMI\x1b[0m\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
