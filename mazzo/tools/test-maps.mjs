/**
 * Prove senza browser: forma delle mappe, coerenza fra oggetti e tile,
 * avanzamento delle mansioni e stato finale.
 *
 *   node tools/test-maps.mjs
 *
 * I moduli del gioco sono TypeScript e si importano fra loro senza estensione:
 * qui vengono compilati al volo con esbuild (quello che usa gia' Vite).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'mazzo-'));
const entry = join(dir, 'entry.ts');
const out = join(dir, 'bundle.mjs');
writeFileSync(
  entry,
  [
    `export { roomMap } from ${JSON.stringify(join(ROOT, 'src/world/maps/room.ts'))};`,
    `export { barMap } from ${JSON.stringify(join(ROOT, 'src/world/maps/bar.ts'))};`,
    `export { streetMap } from ${JSON.stringify(join(ROOT, 'src/world/maps/street.ts'))};`,
    `export { newGameState, tasksDone } from ${JSON.stringify(join(ROOT, 'src/systems/state.ts'))};`,
  ].join('\n'),
);
await build({ entryPoints: [entry], bundle: true, format: 'esm', outfile: out, platform: 'neutral', logLevel: 'error' });
const { roomMap, barMap, streetMap, newGameState, tasksDone } = await import(pathToFileURL(out).href);

const MAPS = [roomMap, barMap, streetMap];

/** Contesto finto: registra quello che gli script chiedono di fare. */
function fakeCtx(state) {
  const ctx = {
    state,
    audio: new Proxy({}, { get: () => () => {} }),
    game: {},
    objective: '',
    said: [],
    went: null,
    setObjective(t) {
      this.objective = t;
    },
    goto(level) {
      this.went = level;
    },
    say(script) {
      run(script, ctx);
    },
    faceMazzo() {},
  };
  return ctx;
}

/** Esegue uno script raccogliendo le battute ed eseguendo gli effetti. */
function run(script, ctx) {
  const lines = [];
  for (const step of script) {
    if (typeof step === 'string') lines.push(step);
    else if ('say' in step) lines.push(step.say);
    else if ('do' in step) step.do(ctx);
  }
  ctx.said.push(...lines);
  return lines;
}

const objOf = (map, id) => {
  const o = map.objects.find((x) => x.id === id);
  assert.ok(o, `oggetto mancante: ${id}`);
  return o;
};
const npcOf = (map, id) => {
  const n = map.npcs.find((x) => x.id === id);
  assert.ok(n, `personaggio mancante: ${id}`);
  return n;
};
const tileOf = (map, x, y) => map.rows[y][x];

test('le mappe sono rettangolari e non vuote', () => {
  for (const map of MAPS) {
    assert.ok(map.rows.length > 4, `${map.id}: troppo piccola`);
    const w = map.rows[0].length;
    for (const [i, row] of map.rows.entries()) {
      assert.equal(row.length, w, `${map.id}: riga ${i} lunga ${row.length} invece di ${w}`);
    }
  }
});

test('oggetti e personaggi stanno dentro la mappa', () => {
  for (const map of MAPS) {
    const w = map.rows[0].length;
    const h = map.rows.length;
    for (const o of map.objects) {
      assert.ok(o.x >= 0 && o.x < w && o.y >= 0 && o.y < h, `${map.id}/${o.id} fuori mappa`);
    }
    for (const n of map.npcs) {
      assert.ok(n.x >= 0 && n.x < w && n.y >= 0 && n.y < h, `${map.id}/${n.id} fuori mappa`);
    }
  }
});

test('gli oggetti sono appoggiati al tile giusto', () => {
  assert.equal(tileOf(roomMap, 2, 5), 'N', 'le chiavi stanno sul comodino');
  assert.equal(tileOf(roomMap, 15, 4), 'T', 'la televisione');
  assert.equal(tileOf(roomMap, 13, 1), 'F', 'il ventilatore');
  assert.equal(tileOf(roomMap, 7, 11), 'D', 'la porta di casa');

  assert.equal(tileOf(barMap, 3, 3), 'X', 'il bancone');
  assert.equal(tileOf(barMap, 3, 6), 'O', 'il tavolo 1');
  assert.equal(tileOf(barMap, 10, 6), 'O', 'il tavolo 2');
  assert.equal(tileOf(barMap, 13, 11), 'O', 'il tavolo 4');
  assert.equal(tileOf(barMap, 15, 1), 'S', 'il passavivande');
  assert.equal(tileOf(barMap, 11, 15), 'D', 'la porta del locale');

  assert.equal(tileOf(streetMap, 19, 10), 'M', 'il motorino');
  assert.equal(tileOf(streetMap, 9, 7), 'r', 'la saracinesca');
  assert.equal(tileOf(streetMap, 25, 10), 'n', 'la panchina');
  assert.equal(tileOf(streetMap, 11, 5), 'M', 'il motorino dell\'incontro');
  assert.equal(tileOf(streetMap, 12, 5), 'a', 'la persona in fondo alla strada sta sull\'asfalto');
});

test('le caselle di partenza sono libere', () => {
  const walkable = new Set(['.', ',', 'a', 'm', 'l', '_', 'D']);
  for (const map of MAPS) {
    const ch = tileOf(map, map.spawn.x, map.spawn.y);
    assert.ok(walkable.has(ch), `${map.id}: si parte dentro un muro (${ch})`);
  }
});

test('livello 1: senza chiavi non si esce, con le chiavi si', () => {
  const state = newGameState();
  const ctx = fakeCtx(state);

  roomMap.onStep(ctx, 7, 11);
  assert.equal(state.level1.finished, false, 'la porta resta chiusa');
  assert.equal(ctx.went, null);

  run(objOf(roomMap, 'keys').script(ctx), ctx);
  assert.equal(state.level1.hasKeys, true, 'le chiavi si prendono');

  roomMap.onStep(ctx, 7, 11);
  assert.equal(state.level1.finished, true, 'il livello si chiude');
  assert.equal(ctx.went, 'bar', 'si va al locale');
});

test('livello 2: le tre mansioni si completano in ordine', () => {
  const state = newGameState();
  const ctx = fakeCtx(state);

  // Il tavolo 2 non si sparecchia prima di aver servito l'acqua.
  run(objOf(barMap, 'table2').script(ctx), ctx);
  assert.equal(state.level2.carrying, null, 'niente scorciatoie');

  run(objOf(barMap, 'counter').script(ctx), ctx);
  assert.equal(state.level2.carrying, 'bicchiere');
  run(objOf(barMap, 'table1').script(ctx), ctx);
  assert.equal(state.level2.task1, true);
  assert.equal(state.level2.carrying, null);

  run(objOf(barMap, 'table2').script(ctx), ctx);
  assert.equal(state.level2.carrying, 'piatti');
  run(objOf(barMap, 'kitchen').script(ctx), ctx);
  assert.equal(state.level2.task2, true);

  run(objOf(barMap, 'kitchen').script(ctx), ctx);
  assert.equal(state.level2.carrying, 'ordine');
  run(objOf(barMap, 'table4').script(ctx), ctx);
  assert.equal(state.level2.task3, true);
  assert.equal(tasksDone(state), 3, 'tre mansioni su tre');
  assert.equal(state.level2.messaged, true, 'arriva il messaggio');
  assert.ok(ctx.said.includes('Passa.'), 'il messaggio dice di passare');
});

test('livello 2: non si esce prima di aver finito il turno', () => {
  const state = newGameState();
  const ctx = fakeCtx(state);
  barMap.onStep(ctx, 11, 15);
  assert.equal(state.level2.finished, false);
  assert.equal(ctx.went, null);

  state.level2.task1 = state.level2.task2 = state.level2.task3 = true;
  state.level2.messaged = true;
  barMap.onStep(ctx, 11, 15);
  assert.equal(state.level2.finished, true);
  assert.equal(ctx.went, 'street', 'si esce in strada');
});

test('livello 3: la busta chiude il gioco', () => {
  const state = newGameState();
  const ctx = fakeCtx(state);
  const lines = run(npcOf(streetMap, 'contatto').script(ctx), ctx);
  assert.equal(state.level3.receivedEnvelope, true, 'la busta arriva');
  assert.equal(ctx.went, 'ending', 'parte il finale');
  assert.ok(lines.includes('Mazzo.'));
  assert.ok(lines.includes('Finalmente.'));
  // La busta non si apre e non si spiega.
  const testo = lines.join(' ').toLowerCase();
  assert.ok(!testo.includes('dentro c\'è'), 'il contenuto resta ignoto');
});

test('gli obiettivi cambiano insieme allo stato', () => {
  const state = newGameState();
  const ctx = fakeCtx(state);
  assert.match(roomMap.objective(ctx), /chiavi/i);
  state.level1.hasKeys = true;
  assert.match(roomMap.objective(ctx), /lavoro/i);

  assert.match(barMap.objective(ctx), /bicchiere/i);
  state.level2.task1 = state.level2.task2 = state.level2.task3 = true;
  state.level2.messaged = true;
  assert.match(barMap.objective(ctx), /busta/i);

  assert.match(streetMap.objective(ctx), /busta/i);
  state.level3.receivedEnvelope = true;
  assert.match(streetMap.objective(ctx), /casa/i);
});

test('ogni oggetto ha qualcosa da dire', () => {
  const state = newGameState();
  const ctx = fakeCtx(state);
  for (const map of MAPS) {
    for (const o of map.objects) {
      const lines = run(o.script(ctx), fakeCtx(newGameState()));
      assert.ok(lines.length > 0, `${map.id}/${o.id} non dice niente`);
    }
    for (const n of map.npcs) {
      if (n.id === 'contatto') continue; // gia' provato a parte
      const lines = run(n.script(ctx), fakeCtx(newGameState()));
      assert.ok(lines.length > 0, `${map.id}/${n.id} non dice niente`);
    }
  }
});
