/**
 * Prova completa del gioco in Chromium: dalla schermata iniziale al finale,
 * passando per tutte e tre le mappe e tutte e tre le mansioni del turno.
 *
 *   node tools/test.mjs           partita intera + screenshot
 *   node tools/test.mjs --dist    prova la build di produzione invece dei sorgenti
 *   node tools/test.mjs --keep    lascia il server acceso a fine prova
 */

import { createServer, preview } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SHOTS = join(ROOT, 'screenshots');
const KEEP = process.argv.includes('--keep');
const DIST = process.argv.includes('--dist');
const PORT = 5188;

let failures = 0;
const log = (...a) => console.log(...a);
const ok = (m) => log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => {
  failures++;
  log(`  \x1b[31m✗\x1b[0m ${m}`);
};
const check = (cond, m) => (cond ? ok(m) : bad(m));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- accesso allo stato del gioco dalla pagina -------------------------

const peek = (page) =>
  page.evaluate(() => {
    const g = window.MAZZO.game;
    const scene = g.current;
    const map = scene && scene.map;
    const player = scene && scene.player;
    const dlg = scene && scene.dialogue;
    const s = g.state;
    return {
      scene: scene ? scene.name : null,
      tile: player ? { x: player.tileX, y: player.tileY } : null,
      pos: player ? { x: player.x, y: player.y } : null,
      dialogue: dlg ? dlg.active : false,
      line: dlg && dlg.currentLine ? dlg.currentLine.text : null,
      transitioning: g.transitioning,
      state: {
        hasKeys: s.level1.hasKeys,
        l1done: s.level1.finished,
        carrying: s.level2.carrying,
        t1: s.level2.task1,
        t2: s.level2.task2,
        t3: s.level2.task3,
        messaged: s.level2.messaged,
        l2done: s.level2.finished,
        envelope: s.level3.receivedEnvelope,
        l3done: s.level3.finished,
      },
    };
  });

async function tap(page, key, hold = 60) {
  await page.keyboard.down(key);
  await sleep(hold);
  await page.keyboard.up(key);
  await sleep(40);
}

/** Manda avanti tutte le battute finche' il dialogo non e' chiuso. */
async function clearDialogue(page, max = 60) {
  for (let i = 0; i < max; i++) {
    const s = await peek(page);
    if (!s.dialogue) return true;
    await tap(page, 'Space', 40);
    await sleep(120);
  }
  return false;
}

/** Griglia della mappa corrente, con le caselle occupate dai personaggi. */
const grid = (page) =>
  page.evaluate(() => {
    const scene = window.MAZZO.game.current;
    const map = scene.map;
    const blocked = map.rows.map((row) => [...row].map((ch) => window.MAZZO.isSolid(ch)));
    for (const n of map.npcs) blocked[n.y][n.x] = true;
    return blocked;
  });

/** Percorso piu' corto fra due caselle (ricerca in ampiezza). */
function bfs(blocked, from, to) {
  const h = blocked.length;
  const w = blocked[0].length;
  const key = (x, y) => y * w + x;
  const prev = new Map();
  const queue = [from];
  const seen = new Set([key(from.x, from.y)]);
  while (queue.length) {
    const cur = queue.shift();
    if (cur.x === to.x && cur.y === to.y) {
      const path = [];
      let k = key(cur.x, cur.y);
      let node = cur;
      while (prev.has(k)) {
        path.unshift(node);
        node = prev.get(k);
        k = key(node.x, node.y);
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (blocked[ny][nx]) continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      prev.set(k, cur);
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

/**
 * Cammina fino a una casella seguendo il percorso piu' corto. Ogni passo punta
 * al centro esatto della casella: cosi' il personaggio resta allineato e non
 * si impunta contro gli spigoli.
 */
async function walkTo(page, tx, ty, timeoutMs = 60000) {
  const t0 = Date.now();
  const centerX = (x) => x * 16;
  const centerY = (y) => y * 16 - 12;

  while (Date.now() - t0 < timeoutMs) {
    let s = await peek(page);
    if (s.dialogue) {
      await clearDialogue(page);
      continue;
    }
    if (s.transitioning) {
      await sleep(150);
      continue;
    }
    if (!s.tile) return false;
    if (s.tile.x === tx && s.tile.y === ty) return true;

    const path = bfs(await grid(page), s.tile, { x: tx, y: ty });
    if (!path || path.length === 0) {
      console.log(`    [walkTo] nessun percorso da ${s.tile.x},${s.tile.y} a ${tx},${ty}`);
      return false;
    }

    const goal = path[0];
    const gx = centerX(goal.x);
    const gy = centerY(goal.y);
    const held = new Set();
    const holdOnly = async (keys) => {
      for (const k of [...held]) {
        if (!keys.has(k)) {
          await page.keyboard.up(k);
          held.delete(k);
        }
      }
      for (const k of keys) {
        if (!held.has(k)) {
          await page.keyboard.down(k);
          held.add(k);
        }
      }
    };

    const stepStart = Date.now();
    let arrived = false;
    while (Date.now() - stepStart < 4000) {
      const dx = gx - s.pos.x;
      const dy = gy - s.pos.y;
      if (Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5) {
        arrived = true;
        break;
      }
      const keys = new Set();
      if (Math.abs(dx) >= 1.5) keys.add(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
      if (Math.abs(dy) >= 1.5) keys.add(dy > 0 ? 'ArrowDown' : 'ArrowUp');
      await holdOnly(keys);
      await sleep(50);
      s = await peek(page);
      if (s.dialogue || s.transitioning || !s.pos) break;
    }
    await holdOnly(new Set());
    if (!arrived && !s.dialogue && !s.transitioning) {
      // Passo non riuscito: si riprova dal nuovo punto, il percorso si rifa'.
      await sleep(80);
    }
  }
  console.log(`    [walkTo] tempo scaduto verso ${tx},${ty}`);
  return false;
}

/** Si mette davanti a una casella e preme E. */
async function interactAt(page, tx, ty, fromX, fromY, key) {
  const arrived = await walkTo(page, fromX, fromY);
  if (!arrived) {
    bad(`non sono riuscito ad arrivare a ${fromX},${fromY}`);
    return false;
  }
  await tap(page, key, 90); // si gira verso l'oggetto
  await sleep(120);
  await tap(page, 'KeyE', 60);
  await sleep(200);
  const s = await peek(page);
  if (!s.dialogue) {
    bad(`nessun dialogo interagendo con ${tx},${ty}`);
    return false;
  }
  return true;
}

/** Preme un tasto finche' la condizione non si avvera (il titolo aspetta un attimo). */
async function pressUntil(page, key, predicate, timeoutMs = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await page.evaluate(predicate)) return true;
    await tap(page, key, 60);
    await sleep(200);
  }
  return false;
}

async function shot(page, name) {
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

async function main() {
  rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });

  // Con --dist si prova esattamente quello che finisce online.
  const server = DIST
    ? await preview({ root: ROOT, preview: { port: PORT, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' })
    : await createServer({ root: ROOT, server: { port: PORT, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' });
  if (!DIST) await server.listen();

  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.MAZZO !== undefined, null, { timeout: 10000 });
  await sleep(600);

  log('\nSCHERMATA INIZIALE');
  let s = await peek(page);
  check(s.scene === 'title', 'si parte dal titolo');
  await shot(page, '01-titolo');

  check(await pressUntil(page, 'Space', () => Boolean(window.MAZZO.game.current && window.MAZZO.game.current.name === 'room')), 'NUOVA PARTITA porta alla camera');

  log('\nLIVELLO 1 — LA CAMERA');
  await clearDialogue(page);
  s = await peek(page);
  check(s.scene === 'room', 'siamo nella camera');
  await shot(page, '02-camera');

  // La porta non si apre senza chiavi.
  await walkTo(page, 7, 11);
  await sleep(300);
  s = await peek(page);
  check(!s.state.l1done, 'senza chiavi non si esce');
  await clearDialogue(page);

  // Comodino: chiavi.
  await interactAt(page, 2, 5, 2, 6, 'ArrowUp');
  await clearDialogue(page);
  s = await peek(page);
  check(s.state.hasKeys, 'le chiavi sono state prese');

  // Qualche interazione facoltativa.
  await interactAt(page, 15, 4, 14, 4, 'ArrowRight');
  await clearDialogue(page);
  ok('la televisione risponde');
  await shot(page, '03-dialogo');

  // Uscita.
  await walkTo(page, 7, 11);
  await sleep(300);
  await clearDialogue(page);
  await page.waitForFunction(
    () => window.MAZZO.game.current && window.MAZZO.game.current.name === 'bar',
    null,
    { timeout: 15000 },
  );
  ok('si passa al livello 2');

  log('\nLIVELLO 2 — IL TURNO');
  await clearDialogue(page);
  await shot(page, '04-locale');

  // Mansione 1: bicchiere dal bancone al tavolo 1.
  await interactAt(page, 3, 3, 3, 4, 'ArrowUp');
  await clearDialogue(page);
  s = await peek(page);
  check(s.state.carrying === 'bicchiere', 'bicchiere in mano');
  await interactAt(page, 3, 6, 4, 6, 'ArrowLeft');
  await clearDialogue(page);
  s = await peek(page);
  check(s.state.t1, 'mansione 1 completata');

  // Mansione 2: sparecchiare il tavolo 2 e portare i piatti in cucina.
  await interactAt(page, 10, 6, 9, 6, 'ArrowRight');
  await clearDialogue(page);
  s = await peek(page);
  check(s.state.carrying === 'piatti', 'piatti in mano');
  await interactAt(page, 15, 1, 15, 2, 'ArrowUp');
  await clearDialogue(page);
  s = await peek(page);
  check(s.state.t2, 'mansione 2 completata');

  // Mansione 3: ritiro dell'ordine e consegna al tavolo 4.
  await interactAt(page, 15, 1, 15, 2, 'ArrowUp');
  await clearDialogue(page);
  s = await peek(page);
  check(s.state.carrying === 'ordine', 'ordine in mano');
  await interactAt(page, 13, 11, 12, 11, 'ArrowRight');
  await clearDialogue(page);
  s = await peek(page);
  check(s.state.t3, 'mansione 3 completata');
  check(s.state.messaged, 'e arrivato il messaggio');
  await shot(page, '05-busta');

  // Un NPC, tanto per sentire che parla.
  await interactAt(page, 4, 2, 5, 2, 'ArrowLeft');
  await clearDialogue(page);
  ok('il collega risponde');

  // Uscita dal locale.
  await walkTo(page, 11, 15);
  await sleep(300);
  await clearDialogue(page);
  await page.waitForFunction(
    () => window.MAZZO.game.current && window.MAZZO.game.current.name === 'street',
    null,
    { timeout: 15000 },
  );
  ok('si passa al livello 3');

  log('\nLIVELLO 3 — LA BUSTA');
  await clearDialogue(page);
  await shot(page, '06-strada');

  // Una deviazione: la piazzetta.
  const piazza = await walkTo(page, 24, 11, 40000);
  check(piazza, 'la piazzetta è raggiungibile');
  await clearDialogue(page);
  await shot(page, '07-piazzetta');

  // E il vicolo.
  const vicolo = await walkTo(page, 4, 12, 40000);
  check(vicolo, 'il vicolo è raggiungibile');
  await clearDialogue(page);

  // L'incontro.
  const arrivato = await interactAt(page, 14, 5, 14, 6, 'ArrowUp');
  check(arrivato, 'si arriva alla persona in fondo alla strada');
  await clearDialogue(page, 90);
  await page.waitForFunction(() => window.MAZZO.game.state.level3.receivedEnvelope, null, { timeout: 20000 });
  ok('la busta è stata consegnata');

  log('\nFINALE');
  await page.waitForFunction(
    () => window.MAZZO.game.current && window.MAZZO.game.current.name === 'ending',
    null,
    { timeout: 20000 },
  );
  ok('parte la scena finale');
  await sleep(9000);
  await shot(page, '08-finale');
  await sleep(3500);
  check(
    await pressUntil(page, 'Space', () => Boolean(window.MAZZO.game.current && window.MAZZO.game.current.name === 'title')),
    'RIGIOCA riporta al titolo',
  );

  // Seconda partita: lo stato deve ripartire pulito.
  check(await pressUntil(page, 'Space', () => Boolean(window.MAZZO.game.current && window.MAZZO.game.current.name === 'room')), 'la seconda partita si avvia');
  s = await peek(page);
  check(!s.state.hasKeys && !s.state.t1 && !s.state.envelope, 'la nuova partita riparte da zero');

  if (DIST) {
    log('\nPAGINA IN FILE UNICO');
    const single = await browser.newPage({ viewport: { width: 960, height: 640 } });
    const singleErrors = [];
    single.on('pageerror', (e) => singleErrors.push(String(e)));
    single.on('requestfailed', (r) => singleErrors.push(`richiesta fallita: ${r.url()}`));
    let external = 0;
    single.on('request', (r) => {
      if (!r.url().startsWith(`http://127.0.0.1:${PORT}/mazzo.html`) && !r.url().startsWith('data:')) external++;
    });
    await single.goto(`http://127.0.0.1:${PORT}/mazzo.html`, { waitUntil: 'load' });
    await single.waitForFunction(() => window.MAZZO !== undefined, null, { timeout: 10000 });
    await sleep(800);
    check(await single.evaluate(() => window.MAZZO.game.current.name === 'title'), 'mazzo.html si apre da solo');
    check(external === 0, `nessuna richiesta esterna${external ? ` (${external})` : ''}`);
    check(singleErrors.length === 0, `nessun errore nella pagina singola${singleErrors.length ? `: ${singleErrors[0]}` : ''}`);
    await single.screenshot({ path: join(SHOTS, '09-file-unico.png') });
    await single.close();
  }

  log('\nCONSOLE');
  check(errors.length === 0, `nessun errore in console${errors.length ? `: ${errors[0]}` : ''}`);

  if (!KEEP) {
    await browser.close();
    await server.close();
  }
  log(`\n${failures === 0 ? '\x1b[32mTUTTO OK\x1b[0m' : `\x1b[31m${failures} problemi\x1b[0m`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
