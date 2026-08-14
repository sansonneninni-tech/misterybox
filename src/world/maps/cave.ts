/** Grotta Salina: zona sotterranea collegata al Percorso 2. */

import { COLL_SOLID, MapBuilder, MapDef } from '../map';

/**
 * Scava un corridoio rettangolare nella roccia.
 * La grotta parte tutta piena e viene "svuotata" corridoio per corridoio:
 * il risultato e' un dedalo leggibile senza dover disegnare ogni tile.
 */
function carve(b: MapBuilder, x0: number, y0: number, w: number, h: number): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (!b.inside(x, y)) continue;
      b.setGround(x, y, 'caveFloor');
      b.setObject(x, y, null);
      b.setColl(x, y, 0);
    }
  }
}

/** Illumina il bordo superiore delle pareti adiacenti al pavimento. */
function lightWalls(b: MapBuilder): void {
  for (let y = 1; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      const here = b.object[b.idx(x, y)];
      const below = y + 1 < b.height ? b.object[b.idx(x, y + 1)] : 'caveWall';
      if (here === 'caveWall' && below === null) {
        b.setObject(x, y, 'caveWallLit');
      }
    }
  }
}

export function grottaSalina(): MapDef {
  const W = 30;
  const H = 22;
  const b = new MapBuilder(W, H, 'caveFloor');

  // Tutto roccia, poi si scava.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      b.setObject(x, y, 'caveWall');
      b.setColl(x, y, COLL_SOLID);
    }
  }

  // Galleria principale.
  carve(b, 13, 17, 4, 4);   // ingresso in basso
  carve(b, 13, 12, 4, 6);
  carve(b, 5, 12, 12, 3);
  carve(b, 5, 5, 3, 8);
  carve(b, 5, 5, 10, 3);
  carve(b, 12, 3, 3, 5);
  carve(b, 12, 3, 12, 3);
  carve(b, 21, 3, 3, 10);
  carve(b, 17, 11, 7, 3);
  carve(b, 17, 11, 3, 7);
  carve(b, 8, 16, 10, 3);
  // Sala del laghetto sotterraneo.
  carve(b, 24, 6, 5, 8);

  // Laghetto salino.
  for (let y = 8; y <= 12; y++) {
    for (let x = 25; x <= 28; x++) {
      b.setGround(x, y, 'caveWater');
      b.setColl(x, y, COLL_SOLID);
    }
  }

  // Massi e casse.
  for (const [x, y] of [[9, 13], [15, 5], [22, 8], [10, 17], [19, 12]] as Array<[number, number]>) {
    b.setObject(x, y, 'caveRock');
    b.setColl(x, y, COLL_SOLID);
  }
  for (const [x, y] of [[6, 6], [23, 4], [16, 17]] as Array<[number, number]>) {
    b.setObject(x, y, 'crateCave');
    b.setColl(x, y, COLL_SOLID);
  }

  lightWalls(b);

  // Ingresso/uscita verso il Percorso 2.
  b.addWarp({ x: 14, y: H - 1, to: 'percorso_2', tx: 34, ty: 5, dir: 'down', kind: 'door' });
  b.addWarp({ x: 15, y: H - 1, to: 'percorso_2', tx: 34, ty: 5, dir: 'down', kind: 'door' });
  for (const x of [14, 15]) {
    b.setGround(x, H - 1, 'caveFloor');
    b.setObject(x, H - 1, null);
    b.setColl(x, H - 1, 0);
  }

  b.addItem({ x: 27, y: 6, item: 'dolcetto', qty: 1, flag: 'item_grotta_1' });
  b.addItem({ x: 6, y: 5, item: 'iperpozione', qty: 1, flag: 'item_grotta_2' });
  b.addItem({ x: 22, y: 12, item: 'sferaottima', qty: 2, flag: 'item_grotta_3' });

  b.addNpc({
    id: 'grotta_bruno', x: 13, y: 13, sprite: 'hiker', dir: 'down', behavior: 'still',
    name: 'Ugo', trainer: 'minatore_ugo', sight: 4,
  });
  b.addNpc({
    id: 'grotta_esploratore', x: 22, y: 5, sprite: 'scout', dir: 'down', behavior: 'look',
    text: [
      'Il sale di questa grotta brilla come vetro.',
      'Certe creature ci si nutrono: sono più dure del normale.',
    ],
  });

  b.signs.push({
    x: 13, y: 18,
    text: ['GROTTA SALINA', 'Non allontanarti dalle gallerie illuminate.'],
  });

  return b.build({
    id: 'grotta_salina', name: 'Grotta Salina', outdoor: true, music: 'forest',
    edgeColor: '#1a1622',
    encounters: {
      rate: 0.11,
      everywhere: true,
      grass: [
        { species: 'sassolino', min: 12, max: 16, weight: 30 },
        { species: 'ferrolo', min: 13, max: 17, weight: 26 },
        { species: 'gelidino', min: 13, max: 16, weight: 18 },
        { species: 'ombretta', min: 14, max: 17, weight: 16 },
        { species: 'rocciante', min: 16, max: 18, weight: 10 },
      ],
    },
  });
}
