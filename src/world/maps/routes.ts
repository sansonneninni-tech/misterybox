/** Percorsi esterni: Percorso 1, Bosco Ombroso, Percorso 2. */

import { COLL_LEDGE_DOWN, COLL_SOLID, MapBuilder, MapDef } from '../map';
import { entryTarget } from './links';

function scatter(b: MapBuilder, x0: number, y0: number, w: number, h: number, density: number, tile: string): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (!b.inside(x, y)) continue;
      if (b.object[b.idx(x, y)]) continue;
      if (b.ground[b.idx(x, y)] !== 'grass') continue;
      const n = ((x * 374761393) ^ (y * 668265263)) >>> 0;
      if ((n % 1000) / 1000 < density) b.setGround(x, y, tile);
    }
  }
}

/** Salto: fila di dislivelli attraversabili solo verso il basso. */
function ledgeRow(b: MapBuilder, x0: number, y: number, len: number): void {
  for (let x = x0; x < x0 + len; x++) {
    b.setGround(x, y, 'ledge');
    b.setColl(x, y, COLL_LEDGE_DOWN);
  }
}

export function percorso1(): MapDef {
  const W = 26;
  const H = 44;
  const b = new MapBuilder(W, H, 'grass');

  // Bordi alberati con varchi a nord e sud.
  for (let y = 0; y < H; y += 2) {
    b.tree(0, y);
    b.tree(2, y);
    b.tree(W - 2, y);
    b.tree(W - 4, y);
  }
  for (let x = 0; x < W; x += 2) {
    if (x < 12 || x > 13) {
      b.tree(x, 0);
      b.tree(x, H - 2);
    }
  }

  // Sentiero principale serpeggiante.
  b.fillGround(12, 0, 2, H, 'dirt');
  b.fillGround(6, 30, 8, 2, 'dirt');
  b.fillGround(6, 22, 2, 10, 'dirt');
  b.fillGround(6, 22, 10, 2, 'dirt');
  b.fillGround(14, 12, 6, 2, 'dirt');
  b.fillGround(18, 6, 2, 8, 'dirt');

  // Uscite.
  b.addWarp({ x: 12, y: H - 1, to: 'borgo_verzura', tx: 16, ty: 1, dir: 'down', kind: 'edge' });
  b.addWarp({ x: 13, y: H - 1, to: 'borgo_verzura', tx: 17, ty: 1, dir: 'down', kind: 'edge' });
  b.addWarp({ x: 12, y: 0, to: 'bosco_ombroso', tx: 13, ty: 27, dir: 'up', kind: 'edge' });
  b.addWarp({ x: 13, y: 0, to: 'bosco_ombroso', tx: 14, ty: 27, dir: 'up', kind: 'edge' });

  // Zone di erba alta.
  b.fillGround(4, 34, 7, 6, 'tallgrass');
  b.fillGround(15, 33, 8, 5, 'tallgrass');
  b.fillGround(4, 14, 6, 6, 'tallgrass');
  b.fillGround(15, 16, 7, 4, 'tallgrass');
  b.fillGround(8, 4, 4, 6, 'tallgrass');
  b.fillGround(20, 24, 3, 6, 'tallgrass');

  // Dislivelli.
  ledgeRow(b, 14, 30, 8);
  ledgeRow(b, 4, 26, 6);
  ledgeRow(b, 16, 15, 6);

  // Laghetto e rocce.
  b.pond(17, 39, 5, 3);
  b.setObject(9, 24, 'rock');
  b.setColl(9, 24, COLL_SOLID);
  b.setObject(20, 21, 'rock');
  b.setColl(20, 21, COLL_SOLID);
  b.setObject(5, 12, 'rock');
  b.setColl(5, 12, COLL_SOLID);
  b.setObject(15, 8, 'bush');
  b.setColl(15, 8, COLL_SOLID);
  b.setObject(7, 8, 'bush');
  b.setColl(7, 8, COLL_SOLID);

  // Boschetti interni.
  b.forest(4, 4, 4, 4);
  b.forest(20, 34, 4, 4);
  b.forest(4, 42, 6, 2);
  b.tree(10, 20);
  b.tree(22, 12);
  b.tree(16, 26);
  b.tree(8, 36);

  scatter(b, 3, 3, W - 6, H - 6, 0.07, 'flowers');

  b.addSign(11, 41, ['PERCORSO 1', 'Borgo Verzura a sud · Bosco Ombroso a nord']);
  b.addSign(14, 22, ['Attenzione ai dislivelli!', 'Si scende, ma non si risale.']);

  b.addItem({ x: 5, y: 36, item: 'sfera', qty: 3, flag: 'item_p1_1' });
  b.addItem({ x: 21, y: 18, item: 'pozione', qty: 2, flag: 'item_p1_2' });
  b.addItem({ x: 9, y: 5, item: 'antidoto', qty: 1, flag: 'item_p1_3' });
  b.addItem({ x: 19, y: 27, item: 'repellente', qty: 1, flag: 'item_p1_4' });

  b.addNpc({
    id: 'p1_marco', x: 12, y: 36, sprite: 'child', dir: 'down', behavior: 'still',
    name: 'Marco', trainer: 'ragazzo_marco', sight: 4,
  });
  b.addNpc({
    id: 'p1_lia', x: 17, y: 13, sprite: 'scout', dir: 'left', behavior: 'still',
    name: 'Lia', trainer: 'esploratrice_lia', sight: 3,
  });
  b.addNpc({
    id: 'p1_viandante', x: 7, y: 31, sprite: 'villager1', dir: 'right', behavior: 'look',
    text: [
      'Cammino sempre lungo il sentiero: nell’erba alta le creature saltano fuori di continuo.',
      'Certo, è anche l’unico modo per catturarne di nuove!',
    ],
  });
  b.addNpc({
    id: 'p1_dario', x: 13, y: 20, sprite: 'rival', dir: 'down', behavior: 'still',
    name: 'Dario', trainer: 'rivale_1', sight: 3,
  });

  return b.build({
    id: 'percorso_1', name: 'Percorso 1', outdoor: true, music: 'route',
    edgeColor: '#2f5a34',
    encounters: {
      rate: 0.14,
      grass: [
        { species: 'rodentino', min: 3, max: 6, weight: 32 },
        { species: 'piumetto', min: 3, max: 6, weight: 28 },
        { species: 'foglietta', min: 4, max: 6, weight: 10 },
        { species: 'scintillo', min: 4, max: 7, weight: 12 },
        { species: 'vespunto', min: 4, max: 7, weight: 12 },
        { species: 'sassolino', min: 5, max: 7, weight: 6 },
      ],
    },
  });
}

export function boscoOmbroso(): MapDef {
  const W = 30;
  const H = 30;
  const b = new MapBuilder(W, H, 'grass');

  // Sottobosco piu' scuro: erba alta diffusa.
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      b.setGround(x, y, 'grass');
    }
  }

  // Bordo compatto di alberi.
  for (let x = 0; x < W; x += 2) {
    if (x < 12 || x > 15) {
      b.tree(x, 0);
      b.tree(x, 2);
      b.tree(x, H - 2);
    }
  }
  for (let y = 0; y < H; y += 2) {
    b.tree(0, y);
    b.tree(2, y);
    if (y < 12 || y > 15) {
      b.tree(W - 2, y);
      b.tree(W - 4, y);
    }
  }

  // Macchie di alberi interne che formano un labirinto morbido.
  b.forest(6, 4, 4, 6);
  b.forest(18, 4, 6, 4);
  b.forest(4, 14, 6, 4);
  b.forest(12, 10, 4, 4);
  b.forest(20, 14, 6, 4);
  b.forest(8, 22, 6, 4);
  b.forest(18, 22, 4, 4);
  b.forest(24, 8, 2, 4);

  // Sentieri di terra battuta.
  b.fillGround(13, 26, 2, 4, 'dirt');
  b.fillGround(13, 18, 2, 8, 'dirt');
  b.fillGround(10, 18, 6, 2, 'dirt');
  b.fillGround(10, 12, 2, 8, 'dirt');
  b.fillGround(10, 12, 8, 2, 'dirt');
  b.fillGround(16, 4, 2, 10, 'dirt');
  b.fillGround(16, 4, 10, 2, 'dirt');
  b.fillGround(24, 5, 2, 8, 'dirt');
  b.fillGround(24, 12, 4, 2, 'dirt');

  // Erba alta abbondante.
  b.fillGround(4, 4, 2, 8, 'tallgrass');
  b.fillGround(6, 12, 4, 4, 'tallgrass');
  b.fillGround(18, 10, 6, 3, 'tallgrass');
  b.fillGround(4, 20, 5, 5, 'tallgrass');
  b.fillGround(20, 19, 6, 5, 'tallgrass');
  b.fillGround(11, 21, 2, 5, 'tallgrass');

  // Uscite: sud verso Percorso 1, est verso Percorso 2.
  b.addWarp({ x: 13, y: H - 1, to: 'percorso_1', tx: 12, ty: 1, dir: 'down', kind: 'edge' });
  b.addWarp({ x: 14, y: H - 1, to: 'percorso_1', tx: 13, ty: 1, dir: 'down', kind: 'edge' });
  b.setGround(13, H - 1, 'dirt');
  b.setGround(14, H - 1, 'dirt');
  b.addWarp({ x: W - 1, y: 12, to: 'percorso_2', tx: 1, ty: 11, dir: 'right', kind: 'edge' });
  b.addWarp({ x: W - 1, y: 13, to: 'percorso_2', tx: 1, ty: 12, dir: 'right', kind: 'edge' });
  b.setGround(W - 1, 12, 'dirt');
  b.setGround(W - 1, 13, 'dirt');
  b.setGround(W - 2, 12, 'dirt');
  b.setGround(W - 2, 13, 'dirt');
  b.setColl(W - 1, 12, 0);
  b.setColl(W - 1, 13, 0);
  b.setColl(W - 2, 12, 0);
  b.setColl(W - 2, 13, 0);
  b.setObject(W - 1, 12, null);
  b.setObject(W - 1, 13, null);
  b.setObject(W - 2, 12, null);
  b.setObject(W - 2, 13, null);

  // Rifugio del guardaboschi.
  const rif = b.building(5, 6, 6, 5, { roof: 'roofG', doorOffset: 2 });
  b.addWarp({ x: rif.doorX, y: rif.doorY, to: 'rifugio_bosco', ...entryTarget('rifugio_bosco'), kind: 'door', requireFacing: 'up' });
  b.fillGround(7, 11, 2, 2, 'dirt');
  b.fillGround(7, 12, 4, 2, 'dirt');

  // Rocce e cespugli.
  for (const [x, y] of [[12, 6], [21, 17], [8, 19], [26, 22], [17, 27]] as Array<[number, number]>) {
    b.setObject(x, y, 'rock');
    b.setColl(x, y, COLL_SOLID);
  }
  for (const [x, y] of [[15, 16], [23, 6], [6, 26], [19, 8]] as Array<[number, number]>) {
    b.setObject(x, y, 'bush');
    b.setColl(x, y, COLL_SOLID);
  }

  scatter(b, 3, 3, W - 6, H - 6, 0.05, 'flowers');

  b.addSign(12, 25, ['BOSCO OMBROSO', 'Non uscire dal sentiero dopo il tramonto.']);
  b.addSign(11, 14, ['Rifugio del guardaboschi', 'Riposo gratuito per i viaggiatori.']);

  b.addItem({ x: 5, y: 22, item: 'superpozione', qty: 1, flag: 'item_bosco_1' });
  b.addItem({ x: 25, y: 20, item: 'sferabuona', qty: 2, flag: 'item_bosco_2' });
  b.addItem({ x: 4, y: 5, item: 'curatutto', qty: 1, flag: 'item_bosco_3' });

  b.addNpc({
    id: 'bosco_bruno', x: 17, y: 19, sprite: 'hiker', dir: 'up', behavior: 'still',
    name: 'Bruno', trainer: 'escursionista_bruno', sight: 4,
  });
  b.addNpc({
    id: 'bosco_selva', x: 26, y: 12, sprite: 'heroine', dir: 'left', behavior: 'still',
    name: 'Selva', trainer: 'guardiana_selva', sight: 3, role: 'rival',
  });
  b.addNpc({
    id: 'bosco_viandante', x: 12, y: 20, sprite: 'villager2', dir: 'right', behavior: 'look',
    text: [
      'La Guardiana Selva sorveglia il passaggio a est.',
      'Nessuno arriva alla costa senza averla battuta.',
    ],
  });

  return b.build({
    id: 'bosco_ombroso', name: 'Bosco Ombroso', outdoor: true, music: 'forest',
    edgeColor: '#1c3a24',
    encounters: {
      rate: 0.16,
      grass: [
        { species: 'vespunto', min: 8, max: 12, weight: 26 },
        { species: 'foglietta', min: 8, max: 12, weight: 20 },
        { species: 'piumetto', min: 8, max: 11, weight: 16 },
        { species: 'ombretta', min: 9, max: 13, weight: 14 },
        { species: 'scintillo', min: 9, max: 12, weight: 12 },
        { species: 'rodentone', min: 11, max: 13, weight: 8 },
        { species: 'gelidino', min: 10, max: 13, weight: 4 },
      ],
    },
  });
}

export function percorso2(): MapDef {
  const W = 48;
  const H = 24;
  const b = new MapBuilder(W, H, 'grass');

  for (let x = 0; x < W; x += 2) {
    b.tree(x, 0);
    b.tree(x, 2);
    b.tree(x, H - 2);
    b.tree(x, H - 4);
  }
  for (let y = 0; y < H; y += 2) {
    if (y < 10 || y > 13) {
      b.tree(0, y);
      b.tree(W - 2, y);
    }
  }

  // Sentiero costiero.
  b.fillGround(0, 10, W, 2, 'dirt');
  b.fillGround(20, 12, 2, 6, 'dirt');
  b.fillGround(20, 16, 10, 2, 'dirt');
  b.fillGround(34, 5, 2, 6, 'dirt');

  // Uscite.
  b.addWarp({ x: 0, y: 10, to: 'bosco_ombroso', tx: 28, ty: 12, dir: 'left', kind: 'edge' });
  b.addWarp({ x: 0, y: 11, to: 'bosco_ombroso', tx: 28, ty: 13, dir: 'left', kind: 'edge' });
  b.addWarp({ x: W - 1, y: 10, to: 'porto_maree', tx: 3, ty: 10, dir: 'right', kind: 'edge' });
  b.addWarp({ x: W - 1, y: 11, to: 'porto_maree', tx: 3, ty: 11, dir: 'right', kind: 'edge' });
  for (const [x, y] of [[0, 10], [0, 11], [W - 1, 10], [W - 1, 11]] as Array<[number, number]>) {
    b.setColl(x, y, 0);
    b.setObject(x, y, null);
    b.setGround(x, y, 'dirt');
  }

  // Fiume con ponte.
  for (let y = 4; y < H - 4; y++) {
    for (let x = 26; x <= 29; x++) {
      let tile = 'water';
      if (x === 26) tile = 'waterW';
      else if (x === 29) tile = 'waterE';
      b.setGround(x, y, tile);
      b.setColl(x, y, COLL_SOLID);
    }
  }
  for (let x = 26; x <= 29; x++) {
    for (const y of [10, 11]) {
      b.setGround(x, y, 'stairs');
      b.setColl(x, y, 0);
    }
  }

  // Zone di erba alta.
  b.fillGround(5, 5, 8, 4, 'tallgrass');
  b.fillGround(8, 13, 9, 6, 'tallgrass');
  b.fillGround(31, 12, 8, 7, 'tallgrass');
  b.fillGround(37, 4, 8, 5, 'tallgrass');
  b.fillGround(18, 5, 6, 4, 'tallgrass');

  // Sabbia verso il mare.
  b.fillGround(44, 12, 3, 8, 'sand');

  // Ostacoli.
  for (const [x, y] of [[15, 9], [24, 19], [33, 9], [41, 18], [11, 20]] as Array<[number, number]>) {
    b.setObject(x, y, 'rock');
    b.setColl(x, y, COLL_SOLID);
  }
  b.forest(14, 18, 4, 4);
  b.forest(41, 6, 4, 4);
  b.forest(3, 18, 4, 4);
  ledgeRow(b, 32, 11, 6);

  scatter(b, 2, 3, W - 4, H - 6, 0.07, 'flowers');

  b.addSign(19, 9, ['PERCORSO 2', 'Bosco Ombroso a ovest · Porto Maree a est']);
  b.addSign(30, 15, ['Il ponte è l’unico attraversamento del fiume.']);

  b.addItem({ x: 8, y: 19, item: 'superpozione', qty: 1, flag: 'item_p2_1' });
  b.addItem({ x: 38, y: 6, item: 'sferabuona', qty: 3, flag: 'item_p2_2' });
  b.addItem({ x: 45, y: 18, item: 'dolcetto', qty: 1, flag: 'item_p2_3' });

  b.addNpc({
    id: 'p2_nino', x: 24, y: 12, sprite: 'fisher', dir: 'right', behavior: 'still',
    name: 'Nino', trainer: 'pescatore_nino', sight: 4,
  });
  b.addNpc({
    id: 'p2_lia2', x: 36, y: 12, sprite: 'scout', dir: 'down', behavior: 'pace-h',
    text: [
      'Ho segnato tutte le creature che vivono lungo il fiume.',
      'Ne mancano ancora tante: la lista è lunghissima!',
    ],
  });

  return b.build({
    id: 'percorso_2', name: 'Percorso 2', outdoor: true, music: 'route',
    edgeColor: '#2f5a34',
    encounters: {
      rate: 0.15,
      grass: [
        { species: 'squametto', min: 10, max: 14, weight: 24 },
        { species: 'piumetto', min: 10, max: 14, weight: 20 },
        { species: 'scintillo', min: 11, max: 15, weight: 16 },
        { species: 'vespunto', min: 11, max: 14, weight: 14 },
        { species: 'gelidino', min: 12, max: 15, weight: 10 },
        { species: 'ferrolo', min: 12, max: 15, weight: 10 },
        { species: 'ombretta', min: 12, max: 16, weight: 5 },
        { species: 'luxaria', min: 18, max: 20, weight: 1 },
      ],
    },
  });
}
