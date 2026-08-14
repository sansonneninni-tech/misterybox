/** Interni: casa del giocatore, laboratorio, centro cura, negozio, case. */

import { COLL_SOLID, MapBuilder, MapDef } from '../map';
import { entryOf, outsideOf, ROOMS } from './links';

/**
 * Stanza rettangolare: due righe di parete in alto, muri laterali,
 * parete di fondo e porta al centro del lato inferiore.
 * Lo zerbino si trova sulla riga h-2, la soglia (che attiva l'uscita) su h-1.
 */
function room(id: string): MapBuilder {
  const spec = ROOMS[id];
  const { w, h } = spec;
  const floor = spec.floor ?? 'floorWood';
  const b = new MapBuilder(w, h, floor);

  for (let x = 0; x < w; x++) {
    b.setObject(x, 0, 'innerWall#0');
    b.setColl(x, 0, COLL_SOLID);
    b.setObject(x, 1, 'innerWallBase');
    b.setColl(x, 1, COLL_SOLID);
    b.setObject(x, h - 1, 'innerWall#4');
    b.setColl(x, h - 1, COLL_SOLID);
  }
  for (let y = 0; y < h; y++) {
    b.setObject(0, y, 'innerWall#3');
    b.setColl(0, y, COLL_SOLID);
    b.setObject(w - 1, y, 'innerWall#3');
    b.setColl(w - 1, y, COLL_SOLID);
  }
  // Quadri decorativi sulla parete di fondo.
  b.setObject(2, 0, 'innerWallArt');
  b.setObject(w - 3, 0, 'innerWallArt');
  return b;
}

/** Apre la porta in basso e collega la mappa esterna. */
function exitDoor(b: MapBuilder, id: string): void {
  const out = outsideOf(id);
  const spec = ROOMS[id];
  const x = spec.door;
  const h = spec.h;
  const mat = spec.floor === 'floorTile' ? 'matTile' : 'mat';
  b.setGround(x, h - 2, mat);
  b.setObject(x, h - 1, 'doorway');
  b.setColl(x, h - 1, 0);
  b.addWarp({ x, y: h - 1, to: out.map, tx: out.x, ty: out.y, dir: 'down', kind: 'door' });
}

function put(b: MapBuilder, x: number, y: number, tile: string): void {
  b.setObject(x, y, tile);
  b.setColl(x, y, COLL_SOLID);
}

// ---------------------------------------------------------------------------

export function casaGiocatore(): MapDef {
  const id = 'casa_giocatore';
  const { w } = ROOMS[id];
  const b = room(id);

  put(b, 1, 2, 'plant');
  put(b, 3, 2, 'tv');
  put(b, 6, 2, 'shelf');
  put(b, 7, 2, 'shelf');
  put(b, 8, 2, 'shelf');
  put(b, w - 2, 5, 'plant');
  put(b, 2, 6, 'table');
  put(b, 3, 6, 'table');
  put(b, 4, 6, 'table');
  put(b, 10, 3, 'counter');
  put(b, 11, 3, 'counter');
  b.fillGround(6, 5, 5, 4, 'carpetR');

  // Scala verso la camera.
  b.setObject(w - 2, 2, 'stairs');
  b.addWarp({
    x: w - 2, y: 2, to: 'camera_giocatore',
    tx: ROOMS.camera_giocatore.w - 2, ty: 3, dir: 'down', kind: 'stairs',
  });

  exitDoor(b, id);

  b.addNpc({
    id: 'mamma',
    x: 5, y: 5, sprite: 'villager1', dir: 'right', behavior: 'still', name: 'Mamma',
    text: [
      'Buongiorno, tesoro!',
      'Il Professor Fioravanti ti cerca: dice che ha una sorpresa per te.',
      'Il laboratorio è in fondo al borgo, verso sud-est.',
    ],
    textAfter: [
      'Come stanno le tue creature?',
      'Ricorda: al Centro Cura le rimettono in forma gratis!',
    ],
  });
  b.signs.push({ x: 3, y: 2, text: ['Alla TV danno un documentario sui sentieri di Verdania.'] });

  return b.build({ id, name: 'Casa', outdoor: false, music: 'town' });
}

export function cameraGiocatore(): MapDef {
  const id = 'camera_giocatore';
  const { w, h } = ROOMS[id];
  const b = room(id);
  b.fillGround(1, 2, 5, 4, 'carpetB');

  put(b, 1, 2, 'bed');
  put(b, 2, 2, 'bed');
  put(b, 6, 2, 'pc');
  put(b, 8, 2, 'shelf');
  put(b, 9, 2, 'shelf');
  put(b, 4, 6, 'table');
  put(b, 5, 6, 'table');
  put(b, 1, 6, 'plant');
  put(b, w - 3, 6, 'tv');

  b.setObject(w - 2, 2, 'stairs');
  b.addWarp({
    x: w - 2, y: 2, to: 'casa_giocatore',
    tx: ROOMS.casa_giocatore.w - 2, ty: 3, dir: 'down', kind: 'stairs',
  });

  // La camera non ha porta verso l'esterno: si esce dalle scale.
  b.setObject(ROOMS[id].door, h - 1, 'innerWall#4');

  b.signs.push({ x: 1, y: 2, text: ['Il tuo letto. Perfettamente rifatto, per una volta.'] });

  return b.build({ id, name: 'Camera', outdoor: false, music: 'town' });
}

export function laboratorio(): MapDef {
  const id = 'laboratorio';
  const { w } = ROOMS[id];
  const b = room(id);

  for (let x = 1; x <= 4; x++) put(b, x, 2, 'shelf');
  for (let x = 10; x <= 13; x++) put(b, x, 2, 'shelf');
  for (let x = 2; x <= 5; x++) put(b, x, 7, 'table');
  for (let x = 9; x <= 12; x++) put(b, x, 7, 'table');
  put(b, 1, 9, 'plant');
  put(b, w - 2, 9, 'plant');
  put(b, 1, 5, 'tv');
  put(b, w - 2, 5, 'tv');

  // Bancone con le tre creature iniziali.
  b.fillGround(5, 3, 5, 3, 'carpetB');
  put(b, 6, 4, 'counterBall');
  put(b, 7, 4, 'counterBall');
  put(b, 8, 4, 'counterBall');

  exitDoor(b, id);

  b.addNpc({
    id: 'professore',
    x: 7, y: 5, sprite: 'professor', dir: 'down', behavior: 'still',
    name: 'Prof. Fioravanti', role: 'professor',
  });
  b.addNpc({
    id: 'assistente',
    x: 11, y: 8, sprite: 'clerk', dir: 'left', behavior: 'look', name: 'Assistente',
    text: [
      'Il Professore studia come le creature scelgono i loro compagni umani.',
      'Pare che scelgano loro noi, non il contrario!',
    ],
  });
  b.addNpc({
    id: 'tirocinante',
    x: 3, y: 9, sprite: 'child', dir: 'right', behavior: 'look', name: 'Tirocinante',
    text: [
      'Ogni creatura ha un tipo elementale, a volte due.',
      'Attaccare con il tipo giusto fa il doppio dei danni!',
    ],
  });

  return b.build({ id, name: 'Laboratorio', outdoor: false, music: 'town' });
}

export function centroCura(id: string): MapDef {
  const { w } = ROOMS[id];
  const b = room(id);
  b.fillGround(5, 2, 5, 3, 'carpetR');

  for (let x = 5; x <= 9; x++) put(b, x, 3, 'counter');
  put(b, 9, 2, 'healMachine');
  put(b, 1, 2, 'plant');
  put(b, w - 2, 2, 'plant');
  put(b, w - 3, 6, 'pc');
  put(b, 1, 6, 'shelf');
  put(b, 2, 6, 'shelf');
  put(b, 11, 8, 'table');
  put(b, 12, 8, 'table');
  put(b, 2, 8, 'table');
  put(b, 3, 8, 'table');

  exitDoor(b, id);

  b.addNpc({
    id: `${id}_nurse`,
    x: 7, y: 2, sprite: 'nurse', dir: 'down', behavior: 'still',
    name: 'Infermiera', role: 'nurse',
  });
  b.addNpc({
    id: `${id}_visitatore`,
    x: 3, y: 7, sprite: 'villager2', dir: 'up', behavior: 'look',
    text: [
      'Qui rimettono in sesto la squadra in un attimo, e senza pagare!',
      'Ci passo prima di ogni viaggio.',
    ],
  });
  b.addNpc({
    id: `${id}_ragazzo`,
    x: 11, y: 6, sprite: 'child', dir: 'left', behavior: 'wander',
    text: [
      'Se tutta la squadra va KO ti risvegli qui.',
      'È già successo… tre volte. Oggi.',
    ],
  });
  return b.build({ id, name: 'Centro Cura', outdoor: false, music: 'center' });
}

export function negozio(id: string, stock: string[]): MapDef {
  const { w } = ROOMS[id];
  const b = room(id);

  for (let x = 2; x <= 6; x++) put(b, x, 3, 'counter');
  for (let x = 8; x <= 11; x++) put(b, x, 2, 'shelf');
  put(b, 1, 6, 'plant');
  put(b, w - 2, 6, 'plant');
  put(b, 9, 5, 'shelf');
  put(b, 10, 5, 'shelf');

  exitDoor(b, id);

  b.addNpc({
    id: `${id}_clerk`,
    x: 4, y: 2, sprite: 'clerk', dir: 'down', behavior: 'still',
    name: 'Commesso', role: 'clerk',
  });
  b.addNpc({
    id: `${id}_cliente`,
    x: 8, y: 6, sprite: 'villager1', dir: 'left', behavior: 'look',
    text: [
      'Le Sfere Buone costano di più, ma valgono ogni moneta.',
      'Io ne compro sempre una scorta.',
    ],
  });
  b.signs.push({ x: 9, y: 5, text: [`Articoli disponibili oggi: ${stock.length}.`] });

  return b.build({ id, name: 'Negozio', outdoor: false, music: 'town' });
}

export function casaVicina(): MapDef {
  const id = 'casa_vicina';
  const { w } = ROOMS[id];
  const b = room(id);
  put(b, 1, 2, 'bed');
  put(b, 2, 2, 'bed');
  put(b, 5, 2, 'shelf');
  put(b, 9, 2, 'tv');
  put(b, 5, 5, 'table');
  put(b, 6, 5, 'table');
  put(b, w - 2, 5, 'plant');
  b.fillGround(4, 4, 5, 3, 'carpetB');

  exitDoor(b, id);

  b.addNpc({
    id: 'vicina',
    x: 8, y: 5, sprite: 'villager2', dir: 'left', behavior: 'still', name: 'Signora Rina',
    text: [
      'Mio figlio Dario è uscito di corsa stamattina.',
      'Vuole diventare il miglior allenatore del borgo… come tutti, del resto!',
    ],
  });
  b.addItem({ x: 10, y: 6, item: 'pozione', qty: 1, flag: 'item_casa_vicina' });

  return b.build({ id, name: 'Casa di Dario', outdoor: false, music: 'town' });
}

export function casaTerza(): MapDef {
  const id = 'casa_terza';
  const { w } = ROOMS[id];
  const b = room(id);
  put(b, 2, 2, 'shelf');
  put(b, 3, 2, 'shelf');
  put(b, 9, 2, 'plant');
  put(b, 6, 4, 'table');
  put(b, 7, 4, 'table');
  put(b, w - 2, 6, 'tv');
  b.fillGround(5, 3, 5, 3, 'carpetR');

  exitDoor(b, id);

  b.addNpc({
    id: 'studioso', x: 8, y: 5, sprite: 'clerk', dir: 'left', behavior: 'still', name: 'Studioso',
    text: [
      'Sto catalogando i tipi elementali.',
      'Il fuoco brucia l’erba, l’acqua spegne il fuoco, l’erba beve l’acqua.',
      'Semplice, no? Poi arrivano i tipi doppi e impazzisci.',
    ],
  });
  b.addNpc({
    id: 'gatto_casa', x: 3, y: 6, sprite: 'child', dir: 'down', behavior: 'wander',
    text: ['Il nonno dice che una volta il bosco arrivava fino a qui.'],
  });

  return b.build({ id, name: 'Casa', outdoor: false, music: 'town' });
}

export function casaPescatore(): MapDef {
  const id = 'casa_pescatore';
  const { w } = ROOMS[id];
  const b = room(id);
  put(b, 2, 2, 'shelf');
  put(b, 8, 2, 'bed');
  put(b, 9, 2, 'bed');
  put(b, 4, 5, 'table');
  put(b, 5, 5, 'table');
  put(b, 1, 5, 'plant');
  put(b, w - 2, 2, 'plant');

  exitDoor(b, id);

  b.addNpc({
    id: 'vecchio_porto',
    x: 7, y: 5, sprite: 'fisher', dir: 'left', behavior: 'still', name: 'Nonno Elio',
    text: [
      'Quarant’anni in mare e non ho mai visto Luxaria.',
      'Dicono che compaia dove la nebbia si apre all’alba…',
      'Se la incontrerai, trattala con rispetto.',
    ],
  });
  b.addItem({ x: 10, y: 6, item: 'sferabuona', qty: 2, flag: 'item_casa_pescatore' });

  return b.build({ id, name: 'Casa sul molo', outdoor: false, music: 'town' });
}

export function rifugioBosco(): MapDef {
  const id = 'rifugio_bosco';
  const { w } = ROOMS[id];
  const b = room(id);
  put(b, 1, 2, 'shelf');
  put(b, 7, 2, 'bed');
  put(b, 8, 2, 'bed');
  put(b, 3, 5, 'table');
  put(b, 4, 5, 'table');
  put(b, w - 2, 6, 'plant');

  exitDoor(b, id);

  b.addNpc({
    id: 'guardaboschi',
    x: 5, y: 3, sprite: 'hiker', dir: 'down', behavior: 'still', name: 'Guardaboschi',
    role: 'healer',
    text: [
      'Benvenuto al rifugio! Riposati pure.',
      'Le tue creature saranno rimesse a nuovo.',
    ],
  });
  b.addItem({ x: 2, y: 6, item: 'superpozione', qty: 1, flag: 'item_rifugio' });

  return b.build({ id, name: 'Rifugio del Bosco', outdoor: false, music: 'center' });
}

export { entryOf };
