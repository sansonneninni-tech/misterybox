/**
 * Formato delle mappe e strumenti di composizione.
 *
 * Il terreno di base e' scritto in ASCII (leggibile e modificabile a mano),
 * mentre le strutture ripetitive (case, boschi, recinzioni) sono generate da
 * funzioni che scrivono direttamente nei livelli. Tre livelli:
 *   ground -> sempre sotto
 *   object -> sotto il giocatore ma sopra il terreno
 *   over   -> sopra il giocatore (chiome degli alberi, tetti sporgenti)
 */

import { isSolid, tagOf, TILES } from '../gfx/tiles';

export type Coll = 0 | 1 | 2 | 3 | 4;
export const COLL_FREE = 0;
export const COLL_SOLID = 1;
export const COLL_LEDGE_DOWN = 2;
export const COLL_LEDGE_LEFT = 3;
export const COLL_LEDGE_RIGHT = 4;

export interface Warp {
  x: number;
  y: number;
  to: string;
  tx: number;
  ty: number;
  dir?: 'up' | 'down' | 'left' | 'right';
  /** 'door' esegue l'animazione della porta, 'edge' un semplice sfumato. */
  kind?: 'door' | 'edge' | 'stairs';
  /** Se vero, il warp scatta solo entrando dall'alto (utile per le porte). */
  requireFacing?: 'up' | 'down' | 'left' | 'right';
}

export interface SignDef {
  x: number;
  y: number;
  text: string[];
}

export interface ItemSpawn {
  x: number;
  y: number;
  item: string;
  qty?: number;
  /** Identificatore univoco per ricordare che e' stato raccolto. */
  flag: string;
}

export interface NpcDef {
  id: string;
  x: number;
  y: number;
  sprite: string;
  name?: string;
  dir?: 'up' | 'down' | 'left' | 'right';
  /** 'still' fermo, 'look' si guarda intorno, 'wander' cammina nei dintorni. */
  behavior?: 'still' | 'look' | 'wander' | 'pace-h' | 'pace-v';
  text?: string[];
  /** Dialogo alternativo dopo aver completato qualcosa. */
  textAfter?: string[];
  /** Battaglia da allenatore. */
  trainer?: string;
  /** Funzione speciale gestita dalla scena (guaritore, negoziante...). */
  role?: 'nurse' | 'clerk' | 'healer' | 'professor' | 'rival';
  /** Raggio di vista per gli allenatori. */
  sight?: number;
}

export interface EncounterEntry {
  species: string;
  min: number;
  max: number;
  weight: number;
}

export interface EncounterTable {
  grass?: EncounterEntry[];
  rate?: number;
}

export interface MapDef {
  id: string;
  name: string;
  width: number;
  height: number;
  outdoor: boolean;
  music?: string;
  ground: string[];
  object: (string | null)[];
  over: (string | null)[];
  collisionOverride: Map<number, Coll>;
  warps: Warp[];
  signs: SignDef[];
  items: ItemSpawn[];
  npcs: NpcDef[];
  encounters?: EncounterTable;
  /** Colore di sfondo fuori dai bordi. */
  edgeColor?: string;
}

// ---------------------------------------------------------------------------
// Costruttore
// ---------------------------------------------------------------------------

export class MapBuilder {
  readonly width: number;
  readonly height: number;
  ground: string[];
  object: (string | null)[];
  over: (string | null)[];
  collisionOverride = new Map<number, Coll>();
  warps: Warp[] = [];
  signs: SignDef[] = [];
  items: ItemSpawn[] = [];
  npcs: NpcDef[] = [];

  constructor(width: number, height: number, fillTile = 'grass') {
    this.width = width;
    this.height = height;
    const n = width * height;
    this.ground = new Array(n).fill(fillTile);
    this.object = new Array(n).fill(null);
    this.over = new Array(n).fill(null);
  }

  idx(x: number, y: number): number {
    return y * this.width + x;
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  setGround(x: number, y: number, tile: string): this {
    if (this.inside(x, y)) this.ground[this.idx(x, y)] = tile;
    return this;
  }

  setObject(x: number, y: number, tile: string | null): this {
    if (this.inside(x, y)) this.object[this.idx(x, y)] = tile;
    return this;
  }

  setOver(x: number, y: number, tile: string | null): this {
    if (this.inside(x, y)) this.over[this.idx(x, y)] = tile;
    return this;
  }

  setColl(x: number, y: number, c: Coll): this {
    if (this.inside(x, y)) this.collisionOverride.set(this.idx(x, y), c);
    return this;
  }

  fillGround(x0: number, y0: number, w: number, h: number, tile: string): this {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.setGround(x, y, tile);
    return this;
  }

  fillObject(x0: number, y0: number, w: number, h: number, tile: string | null): this {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.setObject(x, y, tile);
    return this;
  }

  rectOutline(x0: number, y0: number, w: number, h: number, tile: string): this {
    for (let x = x0; x < x0 + w; x++) {
      this.setObject(x, y0, tile);
      this.setObject(x, y0 + h - 1, tile);
    }
    for (let y = y0; y < y0 + h; y++) {
      this.setObject(x0, y, tile);
      this.setObject(x0 + w - 1, y, tile);
    }
    return this;
  }

  /**
   * Scrive il terreno da una mappa ASCII.
   * I caratteri non presenti nella legenda vengono ignorati.
   */
  paint(rows: string[], legend: Record<string, string | null>, ox = 0, oy = 0, layer: 'ground' | 'object' = 'ground'): this {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        const tile = legend[ch];
        if (tile === undefined) continue;
        if (layer === 'ground') {
          if (tile) this.setGround(ox + x, oy + y, tile);
        } else {
          this.setObject(ox + x, oy + y, tile);
        }
      }
    }
    return this;
  }

  /** Albero 2x2 con ancoraggio in alto a sinistra. */
  tree(x: number, y: number): this {
    this.setOver(x, y, 'treeTL');
    this.setOver(x + 1, y, 'treeTR');
    this.setObject(x, y + 1, 'treeBL');
    this.setObject(x + 1, y + 1, 'treeBR');
    this.setColl(x, y, COLL_SOLID);
    this.setColl(x + 1, y, COLL_SOLID);
    this.setColl(x, y + 1, COLL_SOLID);
    this.setColl(x + 1, y + 1, COLL_SOLID);
    return this;
  }

  /** Fila/bosco di alberi che riempie un rettangolo. */
  forest(x0: number, y0: number, w: number, h: number): this {
    for (let y = y0; y + 1 < y0 + h; y += 2) {
      for (let x = x0; x + 1 < x0 + w; x += 2) this.tree(x, y);
    }
    return this;
  }

  /** Bordo di alberi lungo i confini della mappa. */
  border(thickness = 2): this {
    for (let x = 0; x < this.width; x += 2) {
      for (let t = 0; t < thickness; t += 2) {
        this.tree(x, t);
        this.tree(x, this.height - 2 - t);
      }
    }
    for (let y = 0; y < this.height; y += 2) {
      for (let t = 0; t < thickness; t += 2) {
        this.tree(t, y);
        this.tree(this.width - 2 - t, y);
      }
    }
    return this;
  }

  /**
   * Edificio con tetto, muri, finestre e porta.
   * Restituisce la posizione della porta (tile su cui si cammina).
   */
  building(
    x: number,
    y: number,
    w: number,
    h: number,
    opts: {
      roof?: 'roofR' | 'roofB' | 'roofG';
      doorOffset?: number;
      windows?: number[];
      sign?: boolean;
    } = {},
  ): { doorX: number; doorY: number } {
    const roof = opts.roof ?? 'roofR';
    const roofH = Math.max(2, h - 2);
    const wallY = y + roofH;
    const wallH = h - roofH;

    // Tetto: prima riga = colmo, ultima = gronda.
    for (let ry = 0; ry < roofH; ry++) {
      for (let rx = 0; rx < w; rx++) {
        let variant = 0;
        if (ry === 0) variant = rx === 0 ? 5 : rx === w - 1 ? 6 : 3;
        else if (ry === roofH - 1) variant = 4;
        else if (rx === 0) variant = 1;
        else if (rx === w - 1) variant = 2;
        this.setObject(x + rx, y + ry, `${roof}#${variant}`);
        this.setColl(x + rx, y + ry, COLL_SOLID);
      }
    }

    // Muri.
    const doorX = x + (opts.doorOffset ?? Math.floor(w / 2));
    const windows = opts.windows ?? (w >= 5 ? [1, w - 2] : []);
    for (let wy = 0; wy < wallH; wy++) {
      for (let wx = 0; wx < w; wx++) {
        const gx = x + wx;
        const gy = wallY + wy;
        let tile = 'wall#0';
        if (wx === 0) tile = 'wall#2';
        else if (wx === w - 1) tile = 'wall#3';
        if (wy === 0 && windows.includes(wx)) tile = 'window';
        if (wy === wallH - 1 && gx === doorX) tile = 'doorway';
        this.setObject(gx, gy, tile);
        this.setColl(gx, gy, tile === 'doorway' ? COLL_FREE : COLL_SOLID);
      }
    }
    return { doorX, doorY: wallY + wallH - 1 };
  }

  /** Percorso di terra con bordi raccordati verso l'erba. */
  path(x0: number, y0: number, w: number, h: number): this {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        this.setGround(x, y, 'dirt');
      }
    }
    return this;
  }

  /** Specchio d'acqua rettangolare con rive. */
  pond(x0: number, y0: number, w: number, h: number): this {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        let tile = 'water';
        if (y === y0) tile = 'waterN';
        else if (y === y0 + h - 1) tile = 'waterS';
        else if (x === x0) tile = 'waterW';
        else if (x === x0 + w - 1) tile = 'waterE';
        this.setGround(x, y, tile);
        this.setColl(x, y, COLL_SOLID);
      }
    }
    return this;
  }

  addWarp(w: Warp): this {
    this.warps.push(w);
    return this;
  }

  addSign(x: number, y: number, text: string[]): this {
    this.setObject(x, y, 'sign');
    this.setColl(x, y, COLL_SOLID);
    this.signs.push({ x, y, text });
    return this;
  }

  addItem(spawn: ItemSpawn): this {
    this.items.push(spawn);
    return this;
  }

  addNpc(npc: NpcDef): this {
    this.npcs.push(npc);
    return this;
  }

  /**
   * Raccorda i sentieri di terra con l'erba circostante scegliendo
   * automaticamente la variante di bordo (maschera nord/est/sud/ovest).
   */
  private autoTilePaths(): void {
    const grassy = new Set(['grass', 'grassPlain', 'flowers', 'tallgrass']);
    const isGrass = (x: number, y: number): boolean => {
      if (!this.inside(x, y)) return false;
      const t = this.ground[this.idx(x, y)];
      return grassy.has(splitTile(t).name);
    };
    const out = this.ground.slice();
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = this.idx(x, y);
        if (splitTile(this.ground[i]).name !== 'dirt') continue;
        let mask = 0;
        if (isGrass(x, y - 1)) mask |= 1;
        if (isGrass(x + 1, y)) mask |= 2;
        if (isGrass(x, y + 1)) mask |= 4;
        if (isGrass(x - 1, y)) mask |= 8;
        if (mask) out[i] = `path#${mask}`;
      }
    }
    this.ground = out;
  }

  build(meta: {
    id: string;
    name: string;
    outdoor: boolean;
    music?: string;
    encounters?: EncounterTable;
    edgeColor?: string;
  }): MapDef {
    this.autoTilePaths();
    return {
      id: meta.id,
      name: meta.name,
      width: this.width,
      height: this.height,
      outdoor: meta.outdoor,
      music: meta.music,
      ground: this.ground,
      object: this.object,
      over: this.over,
      collisionOverride: this.collisionOverride,
      warps: this.warps,
      signs: this.signs,
      items: this.items,
      npcs: this.npcs,
      encounters: meta.encounters,
      edgeColor: meta.edgeColor,
    };
  }
}

// ---------------------------------------------------------------------------
// Mappa a runtime
// ---------------------------------------------------------------------------

/** Estrae nome tile e variante forzata da voci del tipo "roofR#3". */
export function splitTile(entry: string): { name: string; variant: number | null } {
  const i = entry.indexOf('#');
  if (i < 0) return { name: entry, variant: null };
  return { name: entry.slice(0, i), variant: Number(entry.slice(i + 1)) };
}

export class RuntimeMap {
  readonly def: MapDef;
  readonly width: number;
  readonly height: number;
  readonly collision: Uint8Array;

  constructor(def: MapDef) {
    this.def = def;
    this.width = def.width;
    this.height = def.height;
    this.collision = new Uint8Array(def.width * def.height);
    this.computeCollision();
  }

  private computeCollision(): void {
    const { width, height, ground, object, collisionOverride } = this.def;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const o = object[i];
        const g = ground[i];
        let c: Coll = COLL_FREE;
        const on = o ? splitTile(o).name : null;
        const gn = splitTile(g).name;
        if (on && isSolid(on)) c = COLL_SOLID;
        else if (!on && isSolid(gn)) c = COLL_SOLID;
        const tag = on ? tagOf(on) : tagOf(gn);
        if (tag === 'ledge-down') c = COLL_LEDGE_DOWN;
        if (tag === 'ledge-left') c = COLL_LEDGE_LEFT;
        if (tag === 'ledge-right') c = COLL_LEDGE_RIGHT;
        const ov = collisionOverride.get(i);
        this.collision[i] = ov !== undefined ? ov : c;
      }
    }
  }

  at(x: number, y: number): Coll {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return COLL_SOLID;
    return this.collision[y * this.width + x] as Coll;
  }

  groundTile(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    return this.def.ground[y * this.width + x] ?? null;
  }

  objectTile(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    return this.def.object[y * this.width + x] ?? null;
  }

  overTile(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    return this.def.over[y * this.width + x] ?? null;
  }

  /** Etichetta semantica del tile calpestato. */
  tagAt(x: number, y: number): string | undefined {
    const o = this.objectTile(x, y);
    const g = this.groundTile(x, y);
    const on = o ? splitTile(o).name : null;
    const gn = g ? splitTile(g).name : null;
    return (on ? tagOf(on) : undefined) ?? (gn ? tagOf(gn) : undefined);
  }

  warpAt(x: number, y: number): Warp | undefined {
    return this.def.warps.find((w) => w.x === x && w.y === y);
  }

  signAt(x: number, y: number): SignDef | undefined {
    return this.def.signs.find((s) => s.x === x && s.y === y);
  }

  isValidTileName(entry: string): boolean {
    return TILES[splitTile(entry).name] !== undefined;
  }
}
