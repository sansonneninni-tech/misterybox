/**
 * Dimensioni e punti di ingresso degli interni.
 * Tenerli in un unico posto evita porte disallineate fra esterno e interno.
 */

export interface RoomSpec {
  w: number;
  h: number;
  /** Colonna della porta. */
  door: number;
  floor?: 'floorWood' | 'floorTile';
}

export const ROOMS: Record<string, RoomSpec> = {
  casa_giocatore: { w: 15, h: 11, door: 7, floor: 'floorWood' },
  camera_giocatore: { w: 13, h: 10, door: 6, floor: 'floorWood' },
  casa_vicina: { w: 13, h: 9, door: 6, floor: 'floorWood' },
  casa_terza: { w: 13, h: 9, door: 6, floor: 'floorWood' },
  casa_pescatore: { w: 13, h: 9, door: 6, floor: 'floorWood' },
  laboratorio: { w: 15, h: 12, door: 7, floor: 'floorTile' },
  centro_borgo: { w: 15, h: 11, door: 7, floor: 'floorTile' },
  centro_porto: { w: 15, h: 11, door: 7, floor: 'floorTile' },
  negozio_borgo: { w: 13, h: 10, door: 6, floor: 'floorTile' },
  negozio_porto: { w: 13, h: 10, door: 6, floor: 'floorTile' },
  rifugio_bosco: { w: 11, h: 9, door: 5, floor: 'floorWood' },
};

/** Tile su cui compare il giocatore entrando (lo zerbino davanti alla porta). */
export function entryOf(id: string): { x: number; y: number } {
  const r = ROOMS[id];
  if (!r) throw new Error(`Stanza sconosciuta: ${id}`);
  return { x: r.door, y: r.h - 2 };
}

/** Come entryOf, ma nel formato atteso da un warp. */
export function entryTarget(id: string): { tx: number; ty: number } {
  const e = entryOf(id);
  return { tx: e.x, ty: e.y };
}

/**
 * Punto in cui si esce all'aperto: il tile immediatamente sotto la porta
 * dell'edificio corrispondente. Deve combaciare con la posizione degli
 * edifici nelle mappe esterne (verificato dal test di validita').
 */
export const OUTSIDE: Record<string, { map: string; x: number; y: number }> = {
  casa_giocatore: { map: 'borgo_verzura', x: 8, y: 13 },
  casa_vicina: { map: 'borgo_verzura', x: 17, y: 13 },
  casa_terza: { map: 'borgo_verzura', x: 27, y: 12 },
  centro_borgo: { map: 'borgo_verzura', x: 8, y: 22 },
  negozio_borgo: { map: 'borgo_verzura', x: 16, y: 22 },
  laboratorio: { map: 'borgo_verzura', x: 25, y: 23 },
  centro_porto: { map: 'porto_maree', x: 7, y: 11 },
  negozio_porto: { map: 'porto_maree', x: 18, y: 9 },
  casa_pescatore: { map: 'porto_maree', x: 11, y: 19 },
  rifugio_bosco: { map: 'bosco_ombroso', x: 7, y: 11 },
};

export function outsideOf(id: string): { map: string; x: number; y: number } {
  const o = OUTSIDE[id];
  if (!o) throw new Error(`Uscita sconosciuta: ${id}`);
  return o;
}
