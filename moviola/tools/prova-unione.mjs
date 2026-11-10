// Prova sul Mac di tutte le novità insieme, con foto vere e la scheda video vera.
//
//   node tools/prova-unione.mjs --foto <cartella con 1-4 foto> --out <cartella> [--app http://localhost:5193]
//
// 1. Apre tools/unione-sheet.html in Chrome per ogni foto: compila tutti i
//    processi e disegna clip con tutto acceso (strati, contagio, Scolpisci,
//    Macro, Respiro, Tempo geologico, Gravità e vento). Scrive risultati.json
//    e un fotogramma per materia.
// 2. Se c'è --app, fotografa il passo 2 a misura di Mac e di iPhone.
// Serve playwright-core (npm i --no-save playwright-core) e Google Chrome.
// Non scrive nulla dentro moviola/dati.
import { createServer } from 'node:http';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const fotoDir = resolve(arg('foto', ''));
const out = resolve(arg('out', join(root, '..', 'moviola-verifica')));
const app = arg('app', '');
const W = Number(arg('w', 960)), N = Number(arg('n', 72));
mkdirSync(out, { recursive: true });

const req = createRequire(join(process.cwd(), 'x.js'));
let pw; try { pw = req('playwright-core'); } catch { pw = createRequire(import.meta.url)('playwright-core'); }
const { chromium, devices } = pw;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.tif': 'image/tiff', '.webp': 'image/webp', '.heic': 'image/heic' };
const srv = createServer((q, s) => {
  const u = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  const p = u.startsWith('/_foto/') ? join(fotoDir, u.slice(7)) : join(root, u);
  try { const b = readFileSync(p); s.writeHead(200, { 'content-type': TYPES[extname(p).toLowerCase()] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const foto = readdirSync(fotoDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && statSync(join(fotoDir, f)).isFile()).slice(0, 4);
const report = { foto, prove: [] };
for (const [k, f] of foto.entries()) {
  const p = await browser.newPage();
  const logs = []; p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); }); p.on('pageerror', (e) => logs.push('PAGEERR ' + e.message));
  await p.goto(`${base}/tools/unione-sheet.html?f=/_foto/${encodeURIComponent(f)}&w=${W}&n=${N}${k ? '&m=granuli,tessuto,erosione,inchiostroacqua,vetrofuso,miele,inchiostro,marmo' : ''}`, { waitUntil: 'commit' });
  await p.waitForFunction(() => window.__out, null, { timeout: 20 * 60e3, polling: 1000 });
  const o = await p.evaluate(() => window.__out);
  for (const r of o.runs) {
    if (r.shot) { writeFileSync(join(out, `${k + 1}-${r.id}.jpg`), Buffer.from(r.shot.split(',')[1], 'base64')); delete r.shot; }
  }
  report.prove.push({ foto: f, compile: o.compile, runs: o.runs, logs });
  await p.close();
  console.log(`foto ${k + 1}: ${o.runs.length} materie, errori di compilazione: ${Object.keys(o.compile).length}, errori pagina: ${logs.length}`);
}
writeFileSync(join(out, 'risultati.json'), JSON.stringify(report, null, 1));

if (app) {
  for (const [name, opts] of [['mac', { viewport: { width: 1512, height: 945 }, deviceScaleFactor: 2 }], ['iphone', { ...devices['iPhone 14'] }]]) {
    const ctx = await browser.newContext(opts); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    await p.goto(app, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
    if (!(await p.$('.media__tile'))) { const fi = await p.$('input[type=file]'); await fi.setInputFiles(join(fotoDir, foto[0])); await p.waitForTimeout(3000); }
    const tile = await p.$('.media__tile'); if (tile && (await tile.getAttribute('aria-pressed')) !== 'true') { await tile.click(); await p.waitForTimeout(500); }
    await p.locator('button:has-text("Trasforma")').last().click();
    await p.waitForTimeout(6000);
    for (const m of ['Granuli', 'Inchiostro in acqua']) { await p.locator('button.mat', { hasText: m }).first().click(); await p.waitForTimeout(3000); }
    await p.screenshot({ path: join(out, `ui-${name}-1.png`) });
    for (const t of ['Gravità e vento', 'Respiro']) { await p.locator('.org-sec__sum', { hasText: t }).locator('.org-sw').click(); await p.waitForTimeout(2000); }
    await p.locator('.corpo button', { hasText: 'Scolpisci' }).first().click(); await p.waitForTimeout(2000);
    await p.screenshot({ path: join(out, `ui-${name}-2.png`) });
    if (name === 'iphone') {
      for (let y = 1; y <= 6; y++) { await p.mouse.wheel(0, 700); await p.evaluate(() => { const s = document.querySelector('.flow__scroll'); if (s) s.scrollBy(0, 700); }); await p.waitForTimeout(800); await p.screenshot({ path: join(out, `ui-iphone-scorri-${y}.png`) }); }
    } else {
      const side = await p.$('.flow__side'); if (side) await side.screenshot({ path: join(out, 'ui-mac-pannello.png') });
    }
    console.log(name, 'errori:', errs.length ? errs.slice(0, 5).join(' | ') : 'nessuno');
    await ctx.close();
  }
}
await browser.close(); srv.close();
console.log('fatto →', out);
