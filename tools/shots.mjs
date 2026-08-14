/**
 * Cattura uno screenshot di ogni mappa del gioco, utile per la revisione
 * visiva durante lo sviluppo.
 *
 *   node tools/shots.mjs [nomeMappa ...]
 */

import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'screenshots', 'mappe');

/** Punti di osservazione scelti per mostrare le zone piu' interessanti. */
const SPOTS = {
  camera_giocatore: [6, 5],
  casa_giocatore: [7, 6],
  casa_vicina: [6, 5],
  casa_terza: [6, 5],
  laboratorio: [7, 7],
  centro_borgo: [7, 6],
  negozio_borgo: [6, 6],
  borgo_verzura: [16, 14],
  percorso_1: [12, 34],
  bosco_ombroso: [13, 19],
  rifugio_bosco: [5, 5],
  percorso_2: [27, 11],
  grotta_salina: [14, 13],
  porto_maree: [14, 11],
  centro_porto: [7, 6],
  negozio_porto: [6, 6],
  casa_pescatore: [6, 5],
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  const server = await createServer({
    root: ROOT,
    server: { port: 5196, strictPort: true, host: '127.0.0.1' },
    logLevel: 'error',
  });
  await server.listen();

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5196/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__verdania, null, { timeout: 15000 });
  await page.click('#boot-start');

  const frames = (n) => page.evaluate((count) => new Promise((res) => {
    let i = 0;
    const tick = () => (++i >= count ? res() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  }), n);

  await page.evaluate(async () => {
    const st = await import('/src/state/gameState.ts');
    const cr = await import('/src/state/creature.ts');
    const s = st.newGame('OSSERV');
    s.starter = 'braciolo';
    s.setFlag('starter_scelto');
    s.setFlag('spilla_bosco');
    s.party.push(new cr.Creature('braciolo', 20));
  });

  const wanted = process.argv.slice(2);
  const list = Object.keys(SPOTS).filter((m) => wanted.length === 0 || wanted.includes(m));

  for (const map of list) {
    const [x, y] = SPOTS[map];
    await page.evaluate(async ({ map, x, y }) => {
      const world = await import('/src/scenes/world.ts');
      window.__verdania.game.replaceAll(new world.WorldScene(map, x, y, 'down'));
    }, { map, x, y });
    await frames(50);
    await page.screenshot({ path: join(OUT, `${map}.png`) });
    process.stdout.write(`  ${map}\n`);
  }

  const engineErrors = await page.evaluate(() => window.__verdania.game.errors);
  if (engineErrors.length || errors.length) {
    console.error('Errori:', [...engineErrors, ...errors].slice(0, 5));
  }
  console.log(`\nScreenshot in ${OUT}`);
  await browser.close();
  await server.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
