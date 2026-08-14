/** Centri abitati: Borgo Verzura e Porto Maree. */

import { COLL_SOLID, MapBuilder, MapDef } from '../map';
import { entryTarget } from './links';

/** Sparge dettagli deterministici (fiori, ciuffi) su una zona erbosa. */
function decorate(b: MapBuilder, x0: number, y0: number, w: number, h: number, density = 0.08): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (!b.inside(x, y)) continue;
      if (b.object[b.idx(x, y)]) continue;
      if (b.ground[b.idx(x, y)] !== 'grass') continue;
      const n = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      if ((n % 1000) / 1000 < density) b.setGround(x, y, 'flowers');
    }
  }
}

export function borgoVerzura(): MapDef {
  const W = 34;
  const H = 30;
  const b = new MapBuilder(W, H, 'grass');

  // Confini alberati, con varco a nord verso il Percorso 1.
  for (let x = 0; x < W; x += 2) {
    if (x >= 16 && x <= 17) continue;
    b.tree(x, 0);
    b.tree(x, 2);
    b.tree(x, H - 2);
  }
  for (let y = 0; y < H; y += 2) {
    b.tree(0, y);
    b.tree(2, y);
    b.tree(W - 2, y);
    b.tree(W - 4, y);
  }

  // Sentieri principali.
  b.fillGround(16, 0, 2, 27, 'dirt');
  b.addWarp({ x: 16, y: 0, to: 'percorso_1', tx: 12, ty: 42, dir: 'up', kind: 'edge' });
  b.addWarp({ x: 17, y: 0, to: 'percorso_1', tx: 13, ty: 42, dir: 'up', kind: 'edge' });
  b.fillGround(5, 13, 24, 2, 'dirt');
  b.fillGround(8, 12, 2, 2, 'dirt');
  b.fillGround(17, 12, 2, 2, 'dirt');
  b.fillGround(25, 15, 2, 8, 'dirt');
  b.fillGround(7, 15, 2, 4, 'dirt');
  b.fillGround(7, 18, 8, 2, 'dirt');
  b.fillGround(13, 19, 2, 2, 'dirt');

  // Case a nord.
  const casa = b.building(6, 8, 6, 5, { roof: 'roofR', doorOffset: 2 });
  b.addWarp({ x: casa.doorX, y: casa.doorY, to: 'casa_giocatore', ...entryTarget('casa_giocatore'), kind: 'door', requireFacing: 'up' });

  const casaDario = b.building(15, 8, 6, 5, { roof: 'roofB', doorOffset: 2 });
  b.addWarp({ x: casaDario.doorX, y: casaDario.doorY, to: 'casa_vicina', ...entryTarget('casa_vicina'), kind: 'door', requireFacing: 'up' });

  const casaTerza = b.building(24, 7, 6, 5, { roof: 'roofG', doorOffset: 3 });
  b.addWarp({ x: casaTerza.doorX, y: casaTerza.doorY, to: 'casa_terza', ...entryTarget('casa_terza'), kind: 'door', requireFacing: 'up' });

  // Centro Cura a ovest.
  const centro = b.building(5, 16, 7, 6, { roof: 'roofR', doorOffset: 3, windows: [1, 5] });
  b.addWarp({ x: centro.doorX, y: centro.doorY, to: 'centro_borgo', ...entryTarget('centro_borgo'), kind: 'door', requireFacing: 'up' });

  // Negozio al centro.
  const shop = b.building(14, 17, 6, 5, { roof: 'roofB', doorOffset: 2, windows: [1, 4] });
  b.addWarp({ x: shop.doorX, y: shop.doorY, to: 'negozio_borgo', ...entryTarget('negozio_borgo'), kind: 'door', requireFacing: 'up' });

  // Laboratorio a est.
  const lab = b.building(22, 17, 7, 6, { roof: 'roofG', doorOffset: 3, windows: [1, 5] });
  b.addWarp({ x: lab.doorX, y: lab.doorY, to: 'laboratorio', ...entryTarget('laboratorio'), kind: 'door', requireFacing: 'up' });

  // Laghetto e recinzioni.
  b.pond(5, 24, 6, 4);
  for (let x = 12; x <= 20; x++) b.setObject(x, 25, 'fenceH');
  for (let x = 12; x <= 20; x++) b.setColl(x, 25, COLL_SOLID);
  b.fillGround(13, 26, 7, 2, 'tallgrass');

  // Alberi ornamentali.
  b.tree(12, 4);
  b.tree(22, 4);
  b.tree(4, 20);
  b.tree(30, 12);
  b.tree(30, 20);
  b.tree(21, 25);
  b.tree(27, 25);

  // Arredo urbano.
  for (const [x, y, tile] of [
    [13, 15, 'lamp'], [21, 15, 'lamp'], [13, 12, 'lamp'], [21, 12, 'lamp'],
    [11, 26, 'well'], [22, 12, 'crate'], [23, 12, 'crate'], [6, 22, 'stump'],
  ] as Array<[number, number, string]>) {
    b.setObject(x, y, tile);
    b.setColl(x, y, COLL_SOLID);
  }

  decorate(b, 3, 3, W - 6, H - 6, 0.07);

  // Cartelli.
  b.addSign(15, 12, ['BORGO VERZURA', 'Dove ogni viaggio comincia con un saluto.']);
  b.addSign(13, 16, ['NEGOZIO', 'Sfere, pozioni e buonumore.']);
  b.addSign(4, 15, ['CENTRO CURA', 'Le tue creature, sempre in forma.']);
  b.addSign(21, 16, ['LABORATORIO FIORAVANTI', 'Studi sulle creature della regione.']);
  b.addSign(18, 5, ['↑ PERCORSO 1', 'Attenzione: erba alta oltre questo punto.']);

  // Oggetti raccoglibili.
  b.addItem({ x: 12, y: 17, item: 'pozione', qty: 1, flag: 'item_borgo_1' });
  b.addItem({ x: 4, y: 6, item: 'sfera', qty: 2, flag: 'item_borgo_2' });

  // Abitanti.
  b.addNpc({
    id: 'anziano_borgo', x: 12, y: 14, sprite: 'villager1', dir: 'down', behavior: 'look',
    name: 'Anziano',
    text: [
      'Un tempo attraversavo il Bosco Ombroso ogni settimana.',
      'Ora mi accontento di guardare il laghetto.',
    ],
  });
  b.addNpc({
    id: 'bimba_borgo', x: 20, y: 24, sprite: 'child', dir: 'left', behavior: 'wander',
    name: 'Bimba',
    text: [
      'Nell’erba alta si nascondono le creature!',
      'Io non entro mai… ho un po’ paura.',
    ],
  });
  b.addNpc({
    id: 'operaio_borgo', x: 27, y: 13, sprite: 'villager2', dir: 'up', behavior: 'pace-h',
    name: 'Abitante',
    text: [
      'Il Professore cerca qualcuno che completi il Verdex.',
      'Chissà, magari cerca proprio te.',
    ],
  });
  b.addNpc({
    id: 'ragazza_borgo', x: 13, y: 20, sprite: 'heroine', dir: 'right', behavior: 'look',
    name: 'Ragazza',
    text: [
      'Se la squadra è esausta, corri al Centro Cura.',
      'È lì dietro, con il tetto rosso!',
    ],
  });

  return b.build({
    id: 'borgo_verzura', name: 'Borgo Verzura', outdoor: true, music: 'town',
    edgeColor: '#2f5a34',
  });
}

export function portoMaree(): MapDef {
  const W = 32;
  const H = 26;
  const b = new MapBuilder(W, H, 'grass');

  // Mare a est.
  for (let y = 0; y < H; y++) {
    for (let x = 24; x < W; x++) {
      let tile = 'water';
      if (x === 24) tile = 'waterW';
      b.setGround(x, y, tile);
      b.setColl(x, y, COLL_SOLID);
    }
  }
  b.fillGround(22, 0, 2, H, 'sand');

  // Confini.
  for (let x = 0; x < 22; x += 2) {
    b.tree(x, 0);
    b.tree(x, H - 2);
  }
  for (let y = 0; y < H; y += 2) {
    b.tree(0, y);
    if (y < 8 || y > 12) b.tree(2, y);
  }

  // Ingresso da ovest (Percorso 2).
  b.fillGround(2, 10, 6, 2, 'dirt');
  b.addWarp({ x: 1, y: 10, to: 'percorso_2', tx: 46, ty: 11, dir: 'left', kind: 'edge' });
  b.addWarp({ x: 1, y: 11, to: 'percorso_2', tx: 46, ty: 12, dir: 'left', kind: 'edge' });
  b.setColl(1, 10, 0);
  b.setColl(1, 11, 0);
  b.setObject(1, 10, null);
  b.setObject(1, 11, null);
  b.setGround(1, 10, 'dirt');
  b.setGround(1, 11, 'dirt');

  // Strade.
  b.fillGround(8, 4, 2, 18, 'dirt');
  b.fillGround(8, 10, 14, 2, 'dirt');
  b.fillGround(14, 12, 2, 8, 'dirt');

  // Molo di legno sull'acqua.
  for (let x = 22; x <= 28; x++) {
    for (let y = 14; y <= 15; y++) {
      b.setGround(x, y, 'stairs');
      b.setColl(x, y, 0);
      b.setObject(x, y, null);
    }
  }

  // Edifici.
  const centro = b.building(4, 5, 7, 6, { roof: 'roofR', doorOffset: 3, windows: [1, 5] });
  b.addWarp({ x: centro.doorX, y: centro.doorY, to: 'centro_porto', ...entryTarget('centro_porto'), kind: 'door', requireFacing: 'up' });

  const shop = b.building(16, 4, 6, 5, { roof: 'roofB', doorOffset: 2, windows: [1, 4] });
  b.addWarp({ x: shop.doorX, y: shop.doorY, to: 'negozio_porto', ...entryTarget('negozio_porto'), kind: 'door', requireFacing: 'up' });

  const casa = b.building(10, 14, 6, 5, { roof: 'roofG', doorOffset: 1 });
  b.addWarp({ x: casa.doorX, y: casa.doorY, to: 'casa_pescatore', ...entryTarget('casa_pescatore'), kind: 'door', requireFacing: 'up' });

  // Erba alta e dettagli.
  b.fillGround(3, 19, 6, 4, 'tallgrass');
  b.fillGround(17, 17, 4, 5, 'tallgrass');
  for (let x = 17; x <= 21; x++) b.setObject(x, 15, 'fenceH');
  for (let x = 17; x <= 21; x++) b.setColl(x, 15, COLL_SOLID);
  b.tree(12, 21);
  b.tree(4, 12);
  b.tree(19, 12);
  for (const [x, y, tile] of [
    [10, 9, 'lamp'], [16, 12, 'lamp'], [20, 13, 'crate'], [21, 13, 'crate'],
    [20, 14, 'crate'], [13, 20, 'stump'],
  ] as Array<[number, number, string]>) {
    b.setObject(x, y, tile);
    b.setColl(x, y, COLL_SOLID);
  }
  decorate(b, 2, 2, 20, H - 4, 0.06);

  b.addSign(11, 12, ['PORTO MAREE', 'Il vento porta sempre qualcuno.']);
  b.addSign(21, 13, ['MOLO', 'Vietato tuffarsi. (Ci hanno provato tutti.)']);
  b.addItem({ x: 20, y: 20, item: 'iperpozione', qty: 1, flag: 'item_porto_1' });
  b.addItem({ x: 5, y: 22, item: 'sferaottima', qty: 1, flag: 'item_porto_2' });

  b.addNpc({
    id: 'marinaio', x: 26, y: 14, sprite: 'fisher', dir: 'left', behavior: 'still',
    name: 'Marinaio Gino', trainer: 'marinaio_gino', sight: 3,
  });
  b.addNpc({
    id: 'bimbo_porto', x: 13, y: 11, sprite: 'child', dir: 'down', behavior: 'wander',
    text: ['Da grande farò il capitano!', 'Ho già imparato tre nodi diversi.'],
  });
  b.addNpc({
    id: 'donna_porto', x: 18, y: 10, sprite: 'villager2', dir: 'down', behavior: 'look',
    text: [
      'Il Percorso 2 è pieno di creature d’acqua.',
      'Portati qualcosa di tipo erba o elettro, fidati.',
    ],
  });
  b.addNpc({
    id: 'rivale_porto', x: 15, y: 19, sprite: 'rival', dir: 'up', behavior: 'still',
    name: 'Dario', trainer: 'rivale_2', sight: 4,
  });
  b.addNpc({
    id: 'capitana_porto', x: 25, y: 15, sprite: 'heroine', dir: 'left', behavior: 'still',
    name: 'Capitana Vera', role: 'capitana',
  });

  return b.build({
    id: 'porto_maree', name: 'Porto Maree', outdoor: true, music: 'town',
    edgeColor: '#1c4f8f',
    encounters: {
      rate: 0.1,
      grass: [
        { species: 'piumetto', min: 12, max: 15, weight: 30 },
        { species: 'squametto', min: 12, max: 16, weight: 30 },
        { species: 'rodentino', min: 11, max: 14, weight: 20 },
        { species: 'gelidino', min: 13, max: 16, weight: 12 },
        { species: 'ferrolo', min: 13, max: 15, weight: 8 },
      ],
    },
  });
}
