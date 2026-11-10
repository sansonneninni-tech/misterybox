// Prova sul Mac di Bolle e Ferrofluido, con foto vere e la scheda video vera.
//
//   node tools/prova-liquide.mjs --foto <cartella con 1-4 foto> --out <cartella>
//        [--prima <cartella moviola di un'altra versione>] [--app http://localhost:5185]
//
// Per ogni foto e ogni materia: un filmato di 6 secondi (960×540, 24 fps) e il
// tempo per fotogramma; poi la stessa materia con tutta la catena accesa e,
// per il Ferrofluido, con un dito che fa da magnete. Con --prima fa gli stessi
// filmati con l'altra versione e li mette a fianco (prima | dopo).
// Con --app fotografa il passo 2 a misura di Mac e di iPhone con la materia accesa.
// Serve playwright-core (npm i --no-save playwright-core), Google Chrome e ffmpeg.
// Non scrive nulla dentro moviola/dati.
import { createServer } from 'node:http';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const fotoDir = resolve(arg('foto', ''));
const out = resolve(arg('out', join(here, '..', 'moviola-liquide')));
const prima = arg('prima', '');
const app = arg('app', '');
const MAT = (arg('m', 'bolle,ferrofluido')).split(',');
mkdirSync(out, { recursive: true });

const req = createRequire(join(process.cwd(), 'x.js'));
let pw; try { pw = req('playwright-core'); } catch { pw = createRequire(import.meta.url)('playwright-core'); }
const { chromium, devices } = pw;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
function serve(root) {
  const srv = createServer((q, s) => {
    const u = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    // la pagina di prova è sempre questa; il motore è quello della versione scelta
    const p = u.startsWith('/_foto/') ? join(fotoDir, u.slice(7)) : u === '/tools/liquide-sheet.html' ? join(here, u) : join(root, u);
    try { const b = readFileSync(p); s.writeHead(200, { 'content-type': TYPES[extname(p).toLowerCase()] || 'application/octet-stream' }); s.end(b); }
    catch { s.writeHead(404); s.end(); }
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r({ srv, base: `http://127.0.0.1:${srv.address().port}` })));
}
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
async function giro(base, query, dir) {
  const p = await browser.newPage();
  const logs = []; p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); }); p.on('pageerror', (e) => logs.push('PAGEERR ' + e.message));
  await p.goto(`${base}/tools/liquide-sheet.html?${query}`, { waitUntil: 'commit' });
  await p.waitForFunction(() => window.__out, null, { timeout: 20 * 60e3, polling: 1000 });
  const o = await p.evaluate(() => window.__out);
  await p.close();
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  o.frames.forEach((d, i) => writeFileSync(join(dir, `f${String(i).padStart(4, '0')}.jpg`), Buffer.from(d.split(',')[1], 'base64')));
  const n = o.frames.length; delete o.frames;
  return { ...o, n, logs };
}
const mp4 = (dir, file) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '24', '-i', join(dir, 'f%04d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', file]);

const dopo = await serve(here);
const vecchia = prima ? await serve(resolve(prima)) : null;
const foto = readdirSync(fotoDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && statSync(join(fotoDir, f)).isFile()).slice(0, 4);
const report = { foto, prove: [] };
const tmp = join(out, '_fotogrammi');
for (const [k, f] of foto.entries()) {
  const F = `f=/_foto/${encodeURIComponent(f)}`;
  for (const id of MAT) {
    const nome = `${k + 1}-${id}`;
    const d = await giro(dopo.base, `${F}&p=${id}&w=960&s=6`, join(tmp, 'dopo'));
    mp4(join(tmp, 'dopo'), join(out, `${nome}-dopo.mp4`));
    const riga = { foto: f, id, dopo: d };
    if (vecchia) {
      const v = await giro(vecchia.base, `${F}&p=${id}&w=960&s=6`, join(tmp, 'prima'));
      mp4(join(tmp, 'prima'), join(out, `${nome}-prima.mp4`));
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(out, `${nome}-prima.mp4`), '-i', join(out, `${nome}-dopo.mp4`), '-filter_complex', 'hstack', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', join(out, `${nome}-prima-dopo.mp4`)]);
      riga.prima = v;
    }
    // tutta la catena accesa, e il dito che fa da magnete
    const t = await giro(dopo.base, `${F}&p=${id}&w=960&s=4&da=3.5&ogni=12&tutto=1`, join(tmp, 'tutto'));
    execFileSync('cp', [join(tmp, 'tutto', 'f0000.jpg'), join(out, `${nome}-tutta-la-catena.jpg`)]);
    riga.tutto = t;
    if (id === 'ferrofluido') {
      const g = await giro(dopo.base, `${F}&p=${id}&w=960&s=5&dito=1`, join(tmp, 'dito'));
      mp4(join(tmp, 'dito'), join(out, `${nome}-dito.mp4`));
      riga.dito = g;
    }
    report.prove.push(riga);
    console.log(`${nome}: ${d.ms} ms/fotogramma, errori ${d.errors.length + d.logs.length}; con tutta la catena ${t.ms} ms, errori ${t.errors.length + t.logs.length}`);
  }
}
rmSync(tmp, { recursive: true, force: true });
writeFileSync(join(out, 'risultati.json'), JSON.stringify(report, null, 1));

if (app) {
  for (const [name, opts] of [['mac', { viewport: { width: 1512, height: 945 }, deviceScaleFactor: 2 }], ['iphone', { ...devices['iPhone 14'] }]]) {
    const ctx = await browser.newContext(opts); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    await p.goto(app, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
    if (!(await p.$('.media__tile'))) { const fi = await p.$('input[type=file]'); await fi.setInputFiles(join(fotoDir, foto[0])); await p.waitForTimeout(3000); }
    const tile = await p.$('.media__tile'); if (tile && (await tile.getAttribute('aria-pressed')) !== 'true') { await tile.click(); await p.waitForTimeout(500); }
    await p.locator('button:has-text("Trasforma")').last().click();
    await p.waitForTimeout(5000);
    for (const m of ['Bolle', 'Ferrofluido']) {
      const b = p.locator('button.mat', { hasText: m }).first();
      if (await b.count()) { await b.scrollIntoViewIfNeeded().catch(() => {}); await b.click().catch(() => {}); await p.waitForTimeout(4000); await p.screenshot({ path: join(out, `ui-${name}-${m.toLowerCase()}.png`) }); await b.click().catch(() => {}); await p.waitForTimeout(800); }
      else errs.push('manca il bottone ' + m);
    }
    console.log(name, 'errori:', errs.length ? errs.slice(0, 5).join(' | ') : 'nessuno');
    await ctx.close();
  }
}
await browser.close();
dopo.srv.close(); vecchia?.srv.close();
