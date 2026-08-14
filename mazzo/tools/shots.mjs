/**
 * Screenshot delle tre mappe per la revisione visiva.
 *
 *   node tools/shots.mjs
 */

import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'screenshots', 'mappe');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });
const server = await createServer({ root: ROOT, server: { port: 5191, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

for (const [level, spots] of [
  ['room', [[5, 4], [12, 6], [3, 9]]],
  ['bar', [[11, 12], [5, 5], [15, 4]]],
  ['street', [[14, 19], [14, 12], [22, 11], [14, 6]]],
]) {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  await page.goto(`http://127.0.0.1:5191/#${level}`);
  await page.waitForFunction(() => window.MAZZO !== undefined);
  await sleep(400);
  // Salta l'introduzione e mette il personaggio dove serve.
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Space');
    await sleep(90);
  }
  for (const [x, y] of spots) {
    await page.evaluate(([tx, ty]) => {
      const p = window.MAZZO.game.current.player;
      p.x = tx * 16;
      p.y = ty * 16 - 12;
    }, [x, y]);
    await sleep(300);
    await page.screenshot({ path: join(OUT, `${level}-${x}-${y}.png`) });
  }
  await page.close();
}

await browser.close();
await server.close();
console.log('screenshot in screenshots/mappe');
