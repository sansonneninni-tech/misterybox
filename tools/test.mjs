/**
 * Test automatico end-to-end: avvia il gioco in Chromium, simula l'input di
 * un giocatore, cattura screenshot e verifica che non ci siano errori.
 *
 *   node tools/test.mjs               esegue lo scenario completo
 *   node tools/test.mjs --keep        lascia il server acceso a fine test
 *   node tools/test.mjs --shots-only  solo screenshot delle schermate chiave
 */

import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SHOTS = join(ROOT, 'screenshots');

const args = process.argv.slice(2);
const KEEP = args.includes('--keep');

const KEY = {
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
  a: 'KeyZ', b: 'KeyX', start: 'KeyC',
};

let failures = 0;
const log = (...a) => console.log(...a);
const ok = (msg) => log(`  \x1b[32m✓\x1b[0m ${msg}`);
const bad = (msg) => { failures++; log(`  \x1b[31m✗\x1b[0m ${msg}`); };

async function main() {
  rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });

  const server = await createServer({
    root: ROOT,
    server: { port: 5199, strictPort: true, host: '127.0.0.1' },
    logLevel: 'error',
  });
  await server.listen();
  const url = 'http://127.0.0.1:5199/';

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });

  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__verdania, null, { timeout: 15000 });

  const shot = async (name) => {
    await page.screenshot({ path: join(SHOTS, `${name}.png`) });
  };

  const frames = async (n) => {
    await page.evaluate((count) => new Promise((res) => {
      let i = 0;
      const tick = () => (++i >= count ? res() : requestAnimationFrame(tick));
      requestAnimationFrame(tick);
    }), n);
  };

  const tap = async (btn, hold = 3, after = 8) => {
    await page.keyboard.down(KEY[btn]);
    await frames(hold);
    await page.keyboard.up(KEY[btn]);
    await frames(after);
  };

  const hold = async (btn, n) => {
    await page.keyboard.down(KEY[btn]);
    await frames(n);
    await page.keyboard.up(KEY[btn]);
    await frames(4);
  };

  /** Un passo completo: tiene premuto abbastanza da girarsi e camminare. */
  const step = async (btn, times = 1) => {
    for (let i = 0; i < times; i++) {
      await page.keyboard.down(KEY[btn]);
      await frames(30);
      await page.keyboard.up(KEY[btn]);
      await frames(6);
    }
  };

  const scene = () => page.evaluate(() => {
    const g = window.__verdania.game;
    const cur = g.current;
    return cur ? cur.constructor.name : 'none';
  });

  const snapshot = () => page.evaluate(() => {
    const s = window.__verdania.state;
    const g = window.__verdania.game;
    const cur = g.current;
    return {
      scene: cur ? cur.constructor.name : 'none',
      depth: g.stackDepth(),
      map: s.mapId,
      x: s.x, y: s.y,
      party: s.party.map((c) => ({ name: c.name, lv: c.level, hp: c.hp, max: c.maxHp })),
      money: s.money,
      bag: s.bag.map((b) => `${b.id}x${b.qty}`),
      starter: s.starter,
      seen: s.seen.size,
      caught: s.caught.size,
      errors: g.errors.length,
    };
  });

  // Salta lo schermo di avvio.
  await page.click('#boot-start');
  await frames(20);

  log('\n== Verdania: test end-to-end ==\n');

  // --- 0. Integrita' del mondo --------------------------------------------
  log('0) Validazione mappe');
  const problems = await page.evaluate(() => window.__verdania.validate());
  if (problems.length === 0) ok('tutte le mappe sono coerenti');
  else bad(`${problems.length} problemi nelle mappe:\n    ${problems.slice(0, 12).join('\n    ')}`);
  const stats = await page.evaluate(() => window.__verdania.mapStats());
  const totalTiles = stats.reduce((n, m) => n + m.w * m.h, 0);
  log(`   ${stats.length} mappe, ${totalTiles} tile totali, ` +
      `${stats.reduce((n, m) => n + m.npcs, 0)} NPC, ` +
      `${stats.reduce((n, m) => n + m.items, 0)} oggetti a terra`);

  // --- 1. Titolo -----------------------------------------------------------
  log('1) Schermata iniziale');
  await shot('01-titolo');
  if ((await scene()) === 'TitleScene') ok('TitleScene attiva'); else bad(`scena inattesa: ${await scene()}`);

  // Nuova partita (se c'e' un salvataggio, seleziona la seconda voce).
  const hasSave = await page.evaluate(() => localStorage.getItem('verdania.save.v1') !== null);
  if (hasSave) await tap('down');
  await tap('a', 3, 20);
  await shot('02-nome');
  await tap('a', 3, 40); // conferma nome
  await frames(30);
  let s = await snapshot();
  if (s.map === 'camera_giocatore') ok('partita avviata in camera'); else bad(`mappa iniziale: ${s.map}`);
  await shot('03-intro-dialogo');

  // Chiudi il dialogo introduttivo.
  for (let i = 0; i < 6; i++) await tap('a', 3, 14);
  await frames(20);
  await shot('04-camera');
  s = await snapshot();
  if (s.scene === 'WorldScene') ok('mondo interattivo'); else bad(`scena: ${s.scene}`);

  // --- 2. Movimento e scale ------------------------------------------------
  log('2) Movimento e cambio area');
  const before = await snapshot();
  await hold('down', 30);
  const after = await snapshot();
  if (after.y !== before.y || after.x !== before.x) ok(`il giocatore si muove (${before.x},${before.y} -> ${after.x},${after.y})`);
  else bad('il giocatore non si muove');

  // Vai alle scale (in alto a destra della camera) e scendi.
  await gotoTile(page, frames, 11, 3);
  await step('up');
  await frames(70);
  s = await snapshot();
  if (s.map === 'casa_giocatore') ok('scala verso il piano inferiore'); else bad(`mappa dopo le scale: ${s.map}`);
  await shot('05-casa');

  // Parla con la mamma.
  await gotoTile(page, frames, 5, 6);
  await tap('up', 6, 10);
  await tap('a', 3, 30);
  await shot('06-dialogo-mamma');
  const inDialog = await scene();
  if (inDialog === 'DialogueScene') ok('dialogo con NPC'); else bad(`nessun dialogo: ${inDialog}`);
  for (let i = 0; i < 5; i++) await tap('a', 3, 14);

  // Esci di casa.
  await gotoTile(page, frames, 7, 8);
  await step('down', 2);
  await frames(70);
  s = await snapshot();
  if (s.map === 'borgo_verzura') ok('uscita nel borgo'); else bad(`mappa: ${s.map}`);
  await shot('07-borgo');

  // --- 3. Laboratorio e starter -------------------------------------------
  log('3) Laboratorio e prima creatura');
  await page.evaluate(() => {
    const w = window.__verdania.world;
    w.player.tx = 25; w.player.ty = 23; w.player.dir = 'up';
  });
  await frames(6);
  await step('up');
  await frames(70);
  s = await snapshot();
  if (s.map === 'laboratorio') ok('ingresso nel laboratorio'); else bad(`mappa: ${s.map}`);
  await shot('08-laboratorio');

  await gotoTile(page, frames, 7, 6);
  await tap('up', 6, 10);
  await tap('a', 3, 30);
  for (let i = 0; i < 4; i++) await tap('a', 3, 16);
  await shot('09-scelta-starter');
  await tap('a', 3, 20);   // sceglie la prima voce (Foglietta)
  await frames(20);
  await tap('a', 3, 20);   // conferma "Sì"
  for (let i = 0; i < 6; i++) await tap('a', 3, 16);
  await frames(20);
  s = await snapshot();
  if (s.party.length === 1) ok(`ricevuta creatura: ${s.party[0].name} Lv${s.party[0].lv}`);
  else bad(`squadra vuota (${JSON.stringify(s.party)})`);
  await shot('10-dopo-starter');

  // --- 4. Menu, squadra, borsa --------------------------------------------
  log('4) Menu di gioco');
  for (let i = 0; i < 12 && (await scene()) !== 'WorldScene'; i++) await tap('a', 3, 14);
  await tap('start', 3, 16);
  await shot('11-menu');
  if ((await scene()) === 'MenuScene') ok('menu aperto'); else bad('menu non aperto');
  await tap('a', 3, 20);            // VERDEX
  await shot('12-verdex');
  if ((await scene()) === 'DexScene') ok('Verdex aperto'); else bad('Verdex non aperto');
  await tap('b', 3, 16);
  await tap('down', 3, 10);
  await tap('a', 3, 20);            // SQUADRA
  await shot('13-squadra');
  if ((await scene()) === 'PartyScene') ok('squadra aperta'); else bad('squadra non aperta');
  await tap('a', 3, 12);
  await tap('a', 3, 20);            // Riepilogo
  await shot('14-riepilogo');
  if ((await scene()) === 'SummaryScene') ok('riepilogo aperto'); else bad('riepilogo non aperto');
  await tap('right', 3, 12);
  await shot('15-riepilogo-mosse');
  await tap('b', 3, 12);
  await tap('b', 3, 12);
  await tap('down', 3, 10);
  await tap('a', 3, 20);            // BORSA
  await shot('16-borsa');
  if ((await scene()) === 'BagScene') ok('borsa aperta'); else bad('borsa non aperta');
  await tap('b', 3, 12);
  await tap('b', 3, 16);

  // --- 5. Uscita dal laboratorio e percorso 1 ------------------------------
  log('5) Esplorazione e incontro selvatico');
  await gotoTile(page, frames, 7, 9);
  await step('down', 2);
  await frames(70);
  s = await snapshot();
  if (s.map === 'borgo_verzura') ok('ritorno al borgo'); else bad(`mappa: ${s.map}`);

  // Teletrasporto vicino all'uscita nord per accorciare il test.
  await page.evaluate(() => {
    const w = window.__verdania.world;
    w.player.tx = 16; w.player.ty = 2; w.player.dir = 'up';
  });
  await frames(6);
  await step('up', 2);
  await frames(70);
  s = await snapshot();
  if (s.map === 'percorso_1') ok('ingresso nel Percorso 1'); else bad(`mappa: ${s.map}`);
  await shot('17-percorso1');

  // Forza un incontro camminando nell'erba alta.
  await page.evaluate(() => {
    const w = window.__verdania.world;
    w.player.tx = 6; w.player.ty = 36; w.player.dir = 'down';
  });
  await frames(10);
  let battleFound = false;
  for (let i = 0; i < 40 && !battleFound; i++) {
    await step(i % 2 === 0 ? 'down' : 'up');
    if ((await scene()) === 'BattleScene') battleFound = true;
  }
  if (battleFound) ok('incontro casuale nell\'erba alta'); else bad('nessun incontro dopo 40 passi');
  await frames(120);
  await shot('18-battaglia');

  if (battleFound) {
    // --- 6. Combattimento --------------------------------------------------
    log('6) Combattimento');
    // Avanza i messaggi introduttivi finche' compare il menu azioni.
    for (let i = 0; i < 20; i++) {
      const mode = await page.evaluate(() => window.__verdania.game.current.mode ?? null);
      if (mode === 'action') break;
      await tap('a', 3, 12);
    }
    let mode = await page.evaluate(() => window.__verdania.game.current.mode ?? null);
    if (mode === 'action') ok('menu azioni disponibile'); else bad(`modalita' battaglia: ${mode}`);
    await shot('19-menu-azioni');

    await tap('a', 3, 20);  // LOTTA
    await shot('20-menu-mosse');
    mode = await page.evaluate(() => window.__verdania.game.current.mode ?? null);
    if (mode === 'moves') ok('menu mosse disponibile'); else bad(`modalita': ${mode}`);
    await tap('a', 3, 30);  // usa la prima mossa
    await frames(90);
    await shot('21-attacco');

    // Continua la battaglia fino alla fine (max 90 interazioni).
    let guard = 0;
    while ((await scene()) === 'BattleScene' && guard++ < 120) {
      const m = await page.evaluate(() => window.__verdania.game.current.mode ?? null);
      if (m === 'action') { await tap('a', 3, 14); }
      else if (m === 'moves') { await tap('a', 3, 20); }
      else await tap('a', 3, 10);
      await frames(6);
    }
    if ((await scene()) !== 'BattleScene') ok(`battaglia conclusa in ${guard} passi`);
    else bad('battaglia non terminata');
    await frames(60);
    await shot('22-dopo-battaglia');
  }

  // --- 7. Salvataggio e ricarica ------------------------------------------
  log('7) Salvataggio e caricamento');
  s = await snapshot();
  const beforeSave = { map: s.map, party: s.party.length, money: s.money };
  await page.evaluate(() => window.__verdania.state.save());
  const saved = await page.evaluate(() => localStorage.getItem('verdania.save.v1') !== null);
  if (saved) ok('partita salvata'); else bad('salvataggio assente');

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__verdania, null, { timeout: 15000 });
  await page.click('#boot-start');
  await frames(20);
  await tap('a', 3, 30);   // CONTINUA
  await frames(40);
  s = await snapshot();
  if (s.map === beforeSave.map && s.party.length === beforeSave.party) {
    ok(`partita ricaricata (${s.map}, ${s.party.length} creature)`);
  } else {
    bad(`ricarica errata: ${JSON.stringify({ got: { map: s.map, party: s.party.length }, want: beforeSave })}`);
  }
  await shot('23-ricaricato');

  // --- 8. Errori -----------------------------------------------------------
  log('8) Diagnostica');
  const engineErrors = await page.evaluate(() => window.__verdania.game.errors);
  if (engineErrors.length === 0) ok('nessun errore nel motore');
  else bad(`errori motore:\n${engineErrors.slice(0, 3).join('\n---\n')}`);

  const realConsoleErrors = consoleErrors.filter((e) => !/favicon|Verdania\] Musica/.test(e));
  if (realConsoleErrors.length === 0) ok('console pulita');
  else bad(`errori console (${realConsoleErrors.length}):\n${realConsoleErrors.slice(0, 5).join('\n')}`);

  log(`\nScreenshot in: ${SHOTS}`);
  log(failures === 0 ? '\n\x1b[32mTUTTI I CONTROLLI SUPERATI\x1b[0m\n' : `\n\x1b[31m${failures} CONTROLLI FALLITI\x1b[0m\n`);

  if (!KEEP) {
    await browser.close();
    await server.close();
  }
  process.exit(failures === 0 ? 0 : 1);
}

/** Porta il giocatore su un tile usando l'input (con fallback diretto). */
async function gotoTile(page, frames, tx, ty) {
  await page.evaluate(({ tx, ty }) => {
    const w = window.__verdania.world;
    if (w && w.player) { w.player.tx = tx; w.player.ty = ty; w.player.ox = 0; w.player.oy = 0; }
  }, { tx, ty });
  await frames(4);
}

main().catch(async (e) => {
  console.error('\nTest interrotto:', e);
  process.exit(1);
});
