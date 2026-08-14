/** Tipi condivisi delle mappe e piccole utilita' di collisione. */

import { TILE } from '../engine/const';
import { isSolid } from '../gfx/tiles';
import type { Dir } from '../gfx/actors';
import type { Script } from '../systems/script';

import type { Ctx } from '../systems/state';

export interface ObjDef {
  id: string;
  /** Tile su cui si trova l'oggetto (si interagisce dalla casella accanto). */
  x: number;
  y: number;
  /** Battute mostrate quando Mazzo lo esamina. */
  script: (ctx: Ctx) => Script;
}

export interface NpcDef {
  id: string;
  x: number;
  y: number;
  dir: Dir;
  look: {
    skin?: string;
    hair?: string;
    suit?: string;
    suitLo?: string;
    shirt?: string;
    shoe?: string;
    beard?: boolean;
  };
  script: (ctx: Ctx) => Script;
  /** Se vero il personaggio si gira verso Mazzo quando gli parla. */
  turns?: boolean;
}

export interface MapDef {
  id: string;
  /** Titolo del livello, mostrato in apertura. */
  title: string;
  rows: string[];
  ambience: 'room' | 'bar' | 'street';
  /** Velo di colore steso su tutta la scena (caldo del giorno, sera). */
  veil?: string;
  spawn: { x: number; y: number; dir: Dir };
  objects: ObjDef[];
  npcs: NpcDef[];
  /** Ventilatori: posizione in tile, disegnati con le pale che girano. */
  fans?: Array<{ x: number; y: number }>;
  /** Aloni dei lampioni. */
  lamps?: Array<{ x: number; y: number }>;
  /** Chiamata quando Mazzo entra in una nuova casella: gestisce le uscite. */
  onStep?: (ctx: Ctx, x: number, y: number) => void;
  /** Obiettivo corrente da mostrare nell'interfaccia. */
  objective: (ctx: Ctx) => string;
  /** Scena di apertura del livello. */
  intro?: (ctx: Ctx) => Script;
}

export function tileAt(map: MapDef, x: number, y: number): string {
  if (y < 0 || y >= map.rows.length) return ' ';
  const row = map.rows[y];
  if (x < 0 || x >= row.length) return ' ';
  return row[x];
}

export function solidAt(map: MapDef, x: number, y: number): boolean {
  return isSolid(tileAt(map, x, y));
}

export function mapWidth(map: MapDef): number {
  return map.rows.reduce((m, r) => Math.max(m, r.length), 0);
}

export function mapHeight(map: MapDef): number {
  return map.rows.length;
}

export function mapPixelWidth(map: MapDef): number {
  return mapWidth(map) * TILE;
}

export function mapPixelHeight(map: MapDef): number {
  return mapHeight(map) * TILE;
}

/** Casella davanti a una posizione, data la direzione dello sguardo. */
export function tileInFront(x: number, y: number, dir: Dir): { x: number; y: number } {
  if (dir === 'up') return { x, y: y - 1 };
  if (dir === 'down') return { x, y: y + 1 };
  if (dir === 'left') return { x: x - 1, y };
  return { x: x + 1, y };
}
