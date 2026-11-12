// Prova sul Mac del Tessuto, con foto vere e la scheda video vera.
//
//   node tools/prova-stoffa.mjs --foto <cartella con 1-4 foto> --out <cartella>
//        [--app http://localhost:5189] [--solo filmati|4k|ui] [--s 8]
//
// Filmati: per ogni foto e ognuna delle quattro stoffe, mossa dall'aria, un
// filmato di --s secondi (960×540, 24 fps) messo a fianco della foto ferma
// (prima | dopo); per la prima foto anche le quattro stoffe mosse da una mano,
// e la stoffa con tutta la catena accesa (strati, contagio, Scolpisci, Macro,
// Respiro, Tempo geologico, Gravità e vento). Tempo per fotogramma ed errori.
// 4K: le quattro stoffe a 3840×2160 per 2 secondi, l'ultimo fotogramma in PNG
// e il tempo per fotogramma.
// UI (--app): passo 2 a misura di Mac e di iPhone 14, scheda Materie, Tessuto
// acceso e ognuna delle quattro stoffe scelta. «Trasforma» crea un esperimento
// nell'archivio del server a cui punta --app: usalo solo con un server acceso
// su una COPIA dei dati (MOVIOLA_DATA), mai su quello vero.
// Serve playwright-core (npm i --no-save playwright-core), Google Chrome e ffmpeg.
import { createServer } from 'node:http';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const fotoDir = resolve(arg('foto', ''));
const out = resolve(arg('out', join(here, '..', 'moviola-stoffa-verifica')));
const app = arg('app', '');
const solo = arg('solo', '');
const SEC = Number(arg('s', 8));
mkdirSync(out, { recursive: true });
const TIPI = ['velluto', 'pelle', 'seta', 'tappeto'];

const req = createRequire(join(process.cwd(), 'x.js'));
let pw; try { pw = req('playwright-core'); } catch { pw = createRequire(import.meta.url)('playwright-core'); }
const { chromium, devices } = pw;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const srv = createServer((q, s) => {
  const u = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  const p = u.startsWith('/_foto/') ? join(fotoDir, u.slice(7)) : join(here, u);
  try { const b = readFileSync(p); s.writeHead(200, { 'content-type': TYPES[extname(p).toLowerCase()] || 'application/octet-stream' }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });

async function giro(query, dir, fmt = 'jpeg') {
  const p = await browser.newPage();
  const logs = []; p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); }); p.on('pageerror', (e) => logs.push('PAGEERR ' + e.message));
  await p.goto(`${base}/tools/stoffa-sheet.html?${query}`, { waitUntil: 'commit' });
  await p.waitForFunction(() => window.__out, null, { timeout: 30 * 60e3, polling: 1000 });
  const o = await p.evaluate(() => window.__out);
  await p.close();
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  o.frames.forEach((d, i) => writeFileSync(join(dir, `f${String(i).padStart(4, '0')}.${fmt === 'png' ? 'png' : 'jpg'}`), Buffer.from(d.split(',')[1], 'base64')));
  const n = o.frames.length; delete o.frames;
  return { ...o, n, logs };
}
const mp4 = (dir, file) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '24', '-i', join(dir, 'f%04d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', file]);
// prima | dopo: la foto ferma, inquadrata come nell'app, accanto al filmato
const affianca = (foto, dopo, file) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-i', foto, '-i', dopo,
  '-filter_complex', '[0:v]scale=960:540:force_original_aspect_ratio=increase,crop=960:540,setsar=1[a];[1:v]setsar=1[b];[a][b]hstack=shortest=1',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', file]);

// la scheda è divisa in pagine senza scroll: si va alla pagina che contiene il comando
async function vaiAPagina(p, loc) {
  const dots = p.locator('.pager__dot');
  const n = await dots.count();
  for (let i = 0; i < n; i++) {
    const inert = await loc.evaluate((e) => !!e.closest('[inert]')).catch(() => true);
    if (!inert) return;
    await dots.nth(i).click().catch(() => {}); await p.waitForTimeout(500);
  }
}
const foto = readdirSync(fotoDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && statSync(join(fotoDir, f)).isFile()).slice(0, 4);
const report = { foto, prove: [] };
const tmp = join(out, '_fotogrammi');
const riga = (nome, r) => { report.prove.push({ nome, ms: r.ms, errori: [...r.errors, ...r.logs], glErr: r.glErr }); console.log(`${nome}: ${r.ms} ms/fotogramma, errori ${r.errors.length + r.logs.length}${r.glErr ? ' glErr ' + r.glErr : ''}`); };

if (!solo || solo === 'filmati') {
  for (const [k, f] of foto.entries()) {
    const F = `f=/_foto/${encodeURIComponent(f)}`;
    for (const [ti, tipo] of TIPI.entries()) {
      const nome = `${k + 1}-${tipo}-aria`;
      const d = await giro(`${F}&w=960&s=${SEC}&set=tipo:${ti};mosso:0`, join(tmp, 'd'));
      mp4(join(tmp, 'd'), join(tmp, 'd.mp4'));
      affianca(join(fotoDir, f), join(tmp, 'd.mp4'), join(out, `${nome}.mp4`));
      riga(nome, d);
      if (k === 0) {
        const nm = `${k + 1}-${tipo}-mano`;
        const m = await giro(`${F}&w=960&s=${SEC + 4}&set=tipo:${ti};mosso:1`, join(tmp, 'm'));
        mp4(join(tmp, 'm'), join(tmp, 'm.mp4'));
        affianca(join(fotoDir, f), join(tmp, 'm.mp4'), join(out, `${nm}.mp4`));
        riga(nm, m);
        const nt = `${k + 1}-${tipo}-tutta-la-catena`;
        const t = await giro(`${F}&w=960&s=5&da=4.5&ogni=12&tutto=1&set=tipo:${ti}`, join(tmp, 't'));
        execFileSync('cp', [join(tmp, 't', 'f0000.jpg'), join(out, `${nt}.jpg`)]);
        riga(nt, t);
      }
    }
  }
}
if (!solo || solo === '4k') {
  const F = `f=/_foto/${encodeURIComponent(foto[0])}`;
  for (const [ti, tipo] of TIPI.entries()) {
    const nome = `4k-${tipo}`;
    const d = await giro(`${F}&w=3840&s=2&da=1.95&set=tipo:${ti};mosso:0`, join(tmp, 'k'), 'png');
    execFileSync('cp', [join(tmp, 'k', 'f0000.png'), join(out, `${nome}.png`)]);
    riga(nome, d);
  }
}
rmSync(tmp, { recursive: true, force: true });
writeFileSync(join(out, 'risultati.json'), JSON.stringify(report, null, 1));

if (app && (!solo || solo === 'ui')) {
  for (const [name, opts] of [['mac', { viewport: { width: 1512, height: 945 }, deviceScaleFactor: 2 }], ['iphone', { ...devices['iPhone 14'] }]]) {
    const ctx = await browser.newContext(opts); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    await p.goto(app, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
    if (!(await p.$('.media__tile'))) { const fi = await p.$('input[type=file]'); await fi.setInputFiles(join(fotoDir, foto[0])); await p.waitForTimeout(3000); }
    const tile = await p.$('.media__tile'); if (tile && (await tile.getAttribute('aria-pressed')) !== 'true') { await tile.click(); await p.waitForTimeout(500); }
    await p.locator('button:has-text("Trasforma")').last().click();
    await p.waitForTimeout(5000);
    await p.locator('button', { hasText: /^Materie$/ }).first().click().catch(() => {});
    await p.waitForTimeout(800);
    // la famiglia «Terre e stoffe» può stare su un'altra pagina della scheda
    for (let k = 0; k < 4 && !(await p.locator('button.mat', { hasText: /^Tessuto$|Tessuto/ }).first().isVisible().catch(() => false)); k++) {
      await p.keyboard.press('ArrowRight'); await p.waitForTimeout(500);
    }
    await p.screenshot({ path: join(out, `ui-${name}-materie.png`) });
    const b = p.locator('button.mat', { hasText: 'Tessuto' }).first();
    if (!(await b.count())) { errs.push('manca il bottone Tessuto'); }
    else {
      if (await p.locator('button.mat', { hasText: 'Tessuto bagnato' }).count()) errs.push('Tessuto bagnato è ancora nella scelta');
      await b.click(); await p.waitForTimeout(3000);
      // su iPhone lo strato si apre toccando la sua etichetta
      const chip = p.locator('.layerchip', { hasText: 'Tessuto' }).first();
      if (await chip.count() && await chip.isVisible().catch(() => false)) { await chip.click().catch(() => {}); await p.waitForTimeout(1200); }
      for (const tipo of TIPI) {
        const t = p.locator('button.tag', { hasText: new RegExp('^' + tipo + '$') }).first();
        await vaiAPagina(p, t);
        if (await t.count()) { await t.click(); await p.waitForTimeout(5000); await p.screenshot({ path: join(out, `ui-${name}-${tipo}.png`) }); }
        else errs.push('manca la scelta ' + tipo);
      }
      const mano = p.locator('button.tag', { hasText: /^una mano$/ }).first();
      await vaiAPagina(p, mano);
      if (await mano.count()) { await mano.click(); await p.waitForTimeout(7000); await p.screenshot({ path: join(out, `ui-${name}-mano.png`) }); }
      // nessuno scroll nel pannello: la scheda deve stare tutta nello schermo
      const scroll = await p.evaluate(() => [...document.querySelectorAll('*')].filter((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 2 && e.clientHeight > 0; }).map((e) => e.className || e.tagName));
      if (scroll.length) errs.push('scorre: ' + scroll.join(', '));
    }
    console.log(name, 'errori:', errs.length ? errs.slice(0, 8).join(' | ') : 'nessuno');
    report[name] = errs;
    await ctx.close();
  }
  writeFileSync(join(out, 'risultati.json'), JSON.stringify(report, null, 1));
}
await browser.close();
srv.close();
