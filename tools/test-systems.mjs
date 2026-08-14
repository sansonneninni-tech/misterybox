/**
 * Secondo blocco di test: sistemi di gioco avanzati.
 * Allenatori, cattura, negozio, centro cura, dislivelli, oggetti, KO totale.
 *
 *   node tools/test-systems.mjs
 */

import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SHOTS = join(ROOT, 'screenshots');

const KEY = {
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
  a: 'KeyZ', b: 'KeyX', start: 'KeyC',
};

let failures = 0;
const log = (...a) => console.log(...a);
const ok = (msg) => log(`  \x1b[32m✓\x1b[0m ${msg}`);
const bad = (msg) => { failures++; log(`  \x1b[31m✗\x1b[0m ${msg}`); };

async function main() {
  mkdirSync(SHOTS, { recursive: true });

  const server = await createServer({
    root: ROOT,
    server: { port: 5198, strictPort: true, host: '127.0.0.1' },
    logLevel: 'error',
  });
  await server.listen();

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  await page.goto('http://127.0.0.1:5198/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__verdania, null, { timeout: 15000 });
  await page.click('#boot-start');

  const frames = async (n) => page.evaluate((count) => new Promise((res) => {
    let i = 0;
    const tick = () => (++i >= count ? res() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  }), n);

  const tap = async (btn, hold = 3, after = 10) => {
    await page.keyboard.down(KEY[btn]);
    await frames(hold);
    await page.keyboard.up(KEY[btn]);
    await frames(after);
  };
  const step = async (btn, times = 1) => {
    for (let i = 0; i < times; i++) {
      await page.keyboard.down(KEY[btn]);
      await frames(30);
      await page.keyboard.up(KEY[btn]);
      await frames(6);
    }
  };
  const scene = () => page.evaluate(() => window.__verdania.game.current?.constructor.name ?? 'none');

  /**
   * Un turno di lotta "come lo giocherebbe una persona": nel menu mosse
   * sceglie una mossa che infligge danno, altrove avanza i messaggi.
   */
  const battleTurn = async () => {
    const m = await page.evaluate(() => window.__verdania.game.current?.mode ?? null);
    if (m === 'moves') {
      const target = await page.evaluate(async () => {
        const mv = await import('/src/data/moves.ts');
        const cur = window.__verdania.game.current;
        const moves = cur.player.creature.moves;
        const i = moves.findIndex((sl) => mv.getMove(sl.id).power > 0 && sl.pp > 0);
        return { target: i < 0 ? 0 : i, current: cur.moveIndex };
      });
      let steps = 0;
      while (steps++ < 6) {
        const cur = await page.evaluate(() => window.__verdania.game.current.moveIndex);
        if (cur === target.target) break;
        await tap(cur % 2 === 0 && cur + 1 === target.target ? 'right' : 'down', 3, 8);
      }
      await tap('a', 3, 14);
      return;
    }
    await tap('a', 3, m === 'action' ? 12 : 8);
  };
  const shot = (n) => page.screenshot({ path: join(SHOTS, `${n}.png`) });
  const mode = () => page.evaluate(() => window.__verdania.game.current?.mode ?? null);

  /** Avvia una partita di prova con squadra e borsa preconfigurate. */
  const setup = async (opts) => {
    await page.evaluate((o) => {
      const V = window.__verdania;
      V.game.replaceAll(new (Object.getPrototypeOf(V.game.current).constructor)());
    }, opts).catch(() => {});
  };

  // Nuova partita rapida via API interne del gioco.
  const startGame = async (mapId, x, y) => {
    await page.evaluate(async ({ mapId, x, y }) => {
      const mod = await import('/src/state/gameState.ts');
      const world = await import('/src/scenes/world.ts');
      const creature = await import('/src/state/creature.ts');
      const s = mod.newGame('TEST');
      s.starter = 'braciolo';
      s.setFlag('starter_scelto');
      s.party.push(new creature.Creature('braciolo', 25));
      s.party.push(new creature.Creature('gocciolo', 22));
      s.addItem('sfera', 20);
      s.addItem('sferaottima', 10);
      s.addItem('pozione', 10);
      s.money = 9000;
      s.mapId = mapId; s.x = x; s.y = y;
      window.__verdania.game.replaceAll(new world.WorldScene(mapId, x, y, 'down'));
    }, { mapId, x, y });
    await frames(30);
  };

  log('\n== Verdania: test dei sistemi ==\n');

  // --- 1. Allenatore che avvista il giocatore -----------------------------
  log('1) Allenatore e linea di vista');
  await startGame('percorso_1', 12, 41);
  await page.evaluate(() => {
    const w = window.__verdania.world;
    w.player.tx = 12; w.player.ty = 41; w.player.dir = 'up';
  });
  await frames(10);
  // Marco e' in (12,36) e guarda a sud: risaliamo il sentiero nel suo raggio.
  await step('up', 3);
  await frames(150);
  let sc = await scene();
  if (sc === 'DialogueScene' || sc === 'BattleScene') ok(`l'allenatore ha avvistato il giocatore (${sc})`);
  else bad(`nessun avvistamento (scena: ${sc})`);
  await shot('30-allenatore-avvista');

  // Porta a termine la lotta contro l'allenatore (fino a che il flag non compare).
  let guard = 0;
  let beaten = false;
  while (!beaten && guard++ < 300) {
    await battleTurn();
    beaten = await page.evaluate(() => window.__verdania.state.hasFlag('trainer_ragazzo_marco'));
  }
  if (beaten) ok('allenatore sconfitto e ricompensa incassata'); else bad('lotta contro allenatore non conclusa');
  const money = await page.evaluate(() => window.__verdania.state.money);
  log(`   monete dopo la lotta: ${money}`);
  await shot('31-dopo-allenatore');

  // --- 2. Cattura ---------------------------------------------------------
  log('2) Cattura di una creatura selvatica');
  await startGame('percorso_1', 6, 36);
  let battle = false;
  for (let i = 0; i < 40 && !battle; i++) {
    await step(i % 2 === 0 ? 'down' : 'up');
    battle = (await scene()) === 'BattleScene';
  }
  if (!battle) bad('nessun incontro per il test di cattura');
  else {
    await frames(120);
    // Situazione realistica: avversario ridotto quasi a zero PS.
    await page.evaluate(() => { window.__verdania.game.current.foe.creature.hp = 1; });
    let caught = 0;
    for (let attempt = 0; attempt < 8 && (await scene()) === 'BattleScene'; attempt++) {
      for (let i = 0; i < 20 && (await mode()) !== 'action'; i++) await tap('a', 3, 10);
      if ((await mode()) !== 'action') break;
      await tap('right', 3, 12);   // BORSA
      await tap('a', 3, 20);
      await frames(20);
      await tap('right', 3, 12);   // categoria SFERE
      await frames(10);
      await tap('down', 3, 12);    // Sfera Ottima
      if (attempt === 0) await shot('32-borsa-in-lotta');
      await tap('a', 3, 20);
      await frames(180);
      if (attempt === 0) await shot('33-lancio-sfera');
      for (let i = 0; i < 12; i++) {
        if ((await scene()) !== 'BattleScene') break;
        if ((await mode()) === 'action') break;
        await tap('a', 3, 10);
      }
      caught = await page.evaluate(() => window.__verdania.state.caught.size);
      if (caught > 0) break;
    }
    let g2 = 0;
    while ((await scene()) === 'BattleScene' && g2++ < 120) await battleTurn();
    caught = await page.evaluate(() => window.__verdania.state.caught.size);
    if (caught >= 1) ok(`Verdex aggiornato: ${caught} specie catturate`);
    else bad('nessuna cattura registrata');
    await shot('34-dopo-cattura');
  }

  // --- 3. Negozio ---------------------------------------------------------
  log('3) Negozio');
  await startGame('negozio_borgo', 6, 5);
  await page.evaluate(() => {
    const w = window.__verdania.world;
    w.player.tx = 4; w.player.ty = 4; w.player.dir = 'up';
  });
  await frames(10);
  await tap('a', 3, 30);
  for (let i = 0; i < 4 && (await scene()) === 'DialogueScene'; i++) await tap('a', 3, 16);
  await frames(20);
  sc = await scene();
  if (sc === 'ShopScene') ok('negozio aperto'); else bad(`negozio non aperto (${sc})`);
  await shot('35-negozio');
  const moneyBefore = await page.evaluate(() => window.__verdania.state.money);
  await tap('a', 3, 16);      // seleziona il primo articolo
  await tap('up', 3, 12);     // quantita' 2
  await tap('a', 3, 24);      // conferma
  await frames(30);
  for (let i = 0; i < 3 && (await scene()) === 'DialogueScene'; i++) await tap('a', 3, 14);
  const moneyAfter = await page.evaluate(() => window.__verdania.state.money);
  if (moneyAfter < moneyBefore) ok(`acquisto riuscito (${moneyBefore} -> ${moneyAfter})`);
  else bad('il denaro non e\' cambiato dopo l\'acquisto');
  await shot('36-dopo-acquisto');

  // --- 4. Centro cura -----------------------------------------------------
  log('4) Centro Cura');
  await startGame('centro_borgo', 7, 5);
  await page.evaluate(() => {
    const s = window.__verdania.state;
    for (const c of s.party) { c.hp = 1; c.status = 'avvelenato'; }
    const w = window.__verdania.world;
    w.player.tx = 7; w.player.ty = 4; w.player.dir = 'up';
    w.player.ox = 0; w.player.oy = 0;
  });
  await frames(10);
  await tap('a', 3, 30);
  for (let i = 0; i < 3 && (await scene()) === 'DialogueScene'; i++) {
    await tap('a', 3, 16);
  }
  await frames(20);
  await shot('37-centro-cura');
  // Conferma "Si'" e attende la cura.
  await tap('a', 3, 20);
  for (let i = 0; i < 10; i++) await tap('a', 3, 20);
  await frames(140);
  for (let i = 0; i < 6; i++) await tap('a', 3, 16);
  const healed = await page.evaluate(() => {
    const s = window.__verdania.state;
    return s.party.every((c) => c.hp === c.maxHp && c.status === null);
  });
  if (healed) ok('squadra completamente curata'); else bad('la cura non ha ripristinato la squadra');
  await shot('38-dopo-cura');

  // --- 5. Dislivelli ------------------------------------------------------
  log('5) Salto dai dislivelli');
  await startGame('percorso_1', 16, 29);
  await page.evaluate(() => {
    const w = window.__verdania.world;
    w.player.tx = 16; w.player.ty = 29; w.player.dir = 'down';
  });
  await frames(10);
  const yBefore = await page.evaluate(() => window.__verdania.world.player.ty);
  await tap('down', 8, 4);
  await frames(40);
  const yAfter = await page.evaluate(() => window.__verdania.world.player.ty);
  if (yAfter >= yBefore + 2) ok(`salto del dislivello eseguito (${yBefore} -> ${yAfter})`);
  else bad(`salto non eseguito (${yBefore} -> ${yAfter})`);
  await shot('40-dislivello');
  // Dal basso il dislivello non si risale.
  await page.evaluate(() => {
    const w = window.__verdania.world;
    w.player.tx = 16; w.player.ty = 31; w.player.dir = 'up'; w.player.ox = 0; w.player.oy = 0;
  });
  await frames(10);
  await step('up', 2);
  await frames(20);
  const yBack = await page.evaluate(() => window.__verdania.world.player.ty);
  if (yBack === 31) ok('il dislivello non e\' risalibile');
  else bad(`il dislivello e\' stato risalito (y=${yBack})`);

  // --- 6. Oggetti a terra -------------------------------------------------
  log('6) Raccolta oggetti');
  await startGame('percorso_1', 5, 37);
  await page.evaluate(() => {
    const w = window.__verdania.world;
    w.player.tx = 5; w.player.ty = 37; w.player.dir = 'up';
  });
  await frames(10);
  const sfereBefore = await page.evaluate(() => window.__verdania.state.countItem('sfera'));
  await step('up');
  await frames(40);
  for (let i = 0; i < 3 && (await scene()) === 'DialogueScene'; i++) await tap('a', 3, 14);
  const sfereAfter = await page.evaluate(() => window.__verdania.state.countItem('sfera'));
  if (sfereAfter > sfereBefore) ok(`oggetto raccolto (${sfereBefore} -> ${sfereAfter} sfere)`);
  else bad('oggetto non raccolto');

  // --- 7. KO totale e risveglio ------------------------------------------
  log('7) Sconfitta e risveglio');
  await startGame('percorso_1', 6, 36);
  await page.evaluate(() => {
    const s = window.__verdania.state;
    s.setFlag('riposo_centro_borgo');
    s.party.length = 0;
    return import('/src/state/creature.ts').then((m) => {
      const c = new m.Creature('gocciolo', 2);
      c.hp = 1;
      s.party.push(c);
    });
  });
  await frames(20);
  battle = false;
  for (let i = 0; i < 50 && !battle; i++) {
    await step(i % 2 === 0 ? 'down' : 'up');
    battle = (await scene()) === 'BattleScene';
  }
  if (!battle) {
    bad('nessun incontro per il test di sconfitta');
  } else {
    let g3 = 0;
    while ((await scene()) === 'BattleScene' && g3++ < 260) await battleTurn();
    for (let i = 0; i < 14; i++) await tap('a', 3, 14);
    await frames(120);
    const st = await page.evaluate(() => ({
      map: window.__verdania.state.mapId,
      hp: window.__verdania.state.party.map((c) => c.hp),
    }));
    if (st.map === 'centro_borgo' || st.hp.every((h) => h > 0)) {
      ok(`gestione della sconfitta corretta (mappa: ${st.map})`);
    } else {
      bad(`stato dopo la sconfitta inatteso: ${JSON.stringify(st)}`);
    }
    await shot('39-dopo-sconfitta');
  }

  // --- 8. Evoluzione ------------------------------------------------------
  log('8) Evoluzione al salire di livello');
  await startGame('percorso_1', 6, 36);
  await page.evaluate(async () => {
    const s = window.__verdania.state;
    const m = await import('/src/state/creature.ts');
    s.party.length = 0;
    // Un Rodentino a un soffio dal livello 20: si evolve in Rodentone.
    const c = new m.Creature('rodentino', 19);
    c.exp = Math.floor((20 ** 3 * 4) / 5) - 1;
    s.party.push(c);
  });
  await frames(20);
  battle = false;
  for (let i = 0; i < 50 && !battle; i++) {
    await step(i % 2 === 0 ? 'down' : 'up');
    battle = (await scene()) === 'BattleScene';
  }
  if (!battle) {
    bad('nessun incontro per il test di evoluzione');
  } else {
    let g4 = 0;
    while ((await scene()) === 'BattleScene' && g4++ < 400) {
      await battleTurn();
      if (g4 === 30) await shot('41-evoluzione');
    }
    for (let i = 0; i < 16; i++) await tap('a', 3, 12);
    const after = await page.evaluate(() => ({
      sp: window.__verdania.state.party[0]?.species ?? null,
      lvl: window.__verdania.state.party[0]?.level ?? 0,
      hp: window.__verdania.state.party[0]?.hp ?? 0,
    }));
    if (after.sp === 'rodentone') ok(`evoluzione avvenuta: rodentino -> ${after.sp} (Lv${after.lvl})`);
    else bad(`nessuna evoluzione: specie ${after.sp}, livello ${after.lvl}, PS ${after.hp}`);
  }

  // --- 9. Deposito creature ------------------------------------------------
  log('9) Terminale di deposito');
  await startGame('centro_borgo', 7, 5);
  await page.evaluate(async () => {
    const s = window.__verdania.state;
    const m = await import('/src/state/creature.ts');
    s.box.push(new m.Creature('piumetto', 9));
    const w = window.__verdania.world;
    w.player.tx = 12; w.player.ty = 7; w.player.dir = 'up';
    w.player.ox = 0; w.player.oy = 0;
  });
  await frames(10);
  await tap('a', 3, 24);
  for (let i = 0; i < 3 && (await scene()) === 'DialogueScene'; i++) await tap('a', 3, 16);
  await frames(20);
  sc = await scene();
  if (sc === 'BoxScene') ok('terminale di deposito aperto'); else bad(`terminale non aperto (${sc})`);
  await shot('42-deposito');
  const partyBefore = await page.evaluate(() => window.__verdania.state.party.length);
  await tap('a', 3, 20);   // preleva dall'archivio
  await frames(20);
  const partyAfter = await page.evaluate(() => window.__verdania.state.party.length);
  if (partyAfter === partyBefore + 1) ok(`creatura prelevata (${partyBefore} -> ${partyAfter})`);
  else bad(`prelievo non riuscito (${partyBefore} -> ${partyAfter})`);
  await tap('right', 3, 12);
  await tap('a', 3, 20);   // rideposita
  await frames(20);
  const partyEnd = await page.evaluate(() => window.__verdania.state.party.length);
  if (partyEnd === partyBefore) ok(`creatura depositata (${partyAfter} -> ${partyEnd})`);
  else bad(`deposito non riuscito (${partyAfter} -> ${partyEnd})`);
  await tap('b', 3, 16);

  // --- 10. Finale dell'avventura ------------------------------------------
  log('10) Epilogo');
  await startGame('porto_maree', 24, 15);
  await page.evaluate(() => {
    const s = window.__verdania.state;
    s.setFlag('spilla_bosco');
    s.setFlag('trainer_rivale_2');
    s.setFlag('trainer_marinaio_gino');
    const w = window.__verdania.world;
    w.player.tx = 24; w.player.ty = 15; w.player.dir = 'right';
    w.player.ox = 0; w.player.oy = 0;
  });
  await frames(20);
  await tap('a', 3, 24);
  for (let i = 0; i < 24 && (await scene()) !== 'WorldScene'; i++) {
    if (i === 6) await shot('43-finale');
    await tap('a', 3, 16);
  }
  const ended = await page.evaluate(() => window.__verdania.state.hasFlag('finale'));
  if (ended) ok('epilogo raggiunto e registrato'); else bad('epilogo non raggiunto');
  const stillPlayable = await scene();
  if (stillPlayable === 'WorldScene') ok('il gioco resta esplorabile dopo il finale');
  else bad(`scena dopo il finale: ${stillPlayable}`);

  // --- 11. Diagnostica -----------------------------------------------------
  log('11) Diagnostica');
  const engineErrors = await page.evaluate(() => window.__verdania.game.errors);
  if (engineErrors.length === 0) ok('nessun errore nel motore');
  else bad(`errori motore:\n${engineErrors.slice(0, 3).join('\n---\n')}`);
  const realErrors = consoleErrors.filter((e) => !/favicon/.test(e));
  if (realErrors.length === 0) ok('console pulita');
  else bad(`errori console:\n${realErrors.slice(0, 5).join('\n')}`);

  log(failures === 0 ? '\n\x1b[32mTUTTI I CONTROLLI SUPERATI\x1b[0m\n' : `\n\x1b[31m${failures} CONTROLLI FALLITI\x1b[0m\n`);
  await browser.close();
  await server.close();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nTest interrotto:', e);
  process.exit(1);
});
