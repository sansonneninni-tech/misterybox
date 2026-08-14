/**
 * Tileset disegnato dal codice: ogni carattere delle mappe corrisponde a una
 * funzione che dipinge 16x16 pixel. I tile fissi vengono disegnati una volta
 * sola e tenuti in cache; quelli animati (il ventilatore) no.
 */

import { TILE } from '../engine/const';
import { createCanvas, ctx2d } from '../engine/renderer';
import { P } from './palette';

type Draw = (g: CanvasRenderingContext2D, v: number) => void;

export interface TileDef {
  draw: Draw;
  solid: boolean;
  /** Disegnato sopra il giocatore quando lui sta piu' in alto (chiome, insegne). */
  tall?: boolean;
  animated?: boolean;
}

const r = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};

const fill = (g: CanvasRenderingContext2D, c: string) => r(g, 0, 0, TILE, TILE, c);

/** Granella leggera: evita che le superfici piatte sembrino plastica. */
function speck(g: CanvasRenderingContext2D, color: string, seed: number, n = 5): void {
  let s = seed * 2654435761;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const x = (s >> 7) % TILE;
    const y = (s >> 15) % TILE;
    r(g, x, y, 1, 1, color);
  }
}

const TILES: Record<string, TileDef> = {};

function def(ch: string, solid: boolean, draw: Draw, extra: Partial<TileDef> = {}): void {
  TILES[ch] = { draw, solid, ...extra };
}

// --- interni: camera --------------------------------------------------

def('.', false, (g, v) => {
  fill(g, v % 2 ? P.floorWood : P.floorWood2);
  r(g, 0, 15, TILE, 1, '#6d5232');
  r(g, 5, 0, 1, TILE, '#78592f');
  r(g, 12, 0, 1, TILE, '#78592f');
  speck(g, '#96754a', v + 3, 4);
});

def('#', true, (g, v) => {
  fill(g, P.wallRoom);
  r(g, 0, 11, TILE, 5, P.wallRoomLo);
  r(g, 0, 11, TILE, 1, '#8d7a55');
  r(g, 0, 15, TILE, 1, '#6b5a3c');
  speck(g, '#e2d2ab', v + 11, 3);
});

def('W', true, (g) => {
  fill(g, P.wallRoom);
  r(g, 1, 1, 14, 12, '#6a5a3e');
  // Fuori c'e' solo luce: nessun dettaglio, e' troppo forte.
  r(g, 2, 2, 12, 10, '#fff4cf');
  r(g, 2, 8, 12, 4, '#ffe9a8');
  r(g, 7, 2, 2, 10, '#6a5a3e');
  r(g, 2, 6, 12, 1, '#6a5a3e');
  r(g, 0, 13, TILE, 3, P.wallRoomLo);
});

// Il letto occupa due caselle in larghezza: ogni pezzo ha il suo tile, cosi'
// la spalliera e i bordi cadono dove devono.
def('1', true, (g) => {
  fill(g, P.floorWood2);
  r(g, 3, 1, 13, 4, P.bedFrame);
  r(g, 3, 1, 13, 1, '#8f6b42');
  r(g, 4, 6, 12, 9, P.bedSheet);
  r(g, 4, 6, 12, 1, '#efe8d2');
  r(g, 5, 7, 10, 5, '#efe8d2');
});

def('2', true, (g) => {
  fill(g, P.floorWood2);
  r(g, 0, 1, 13, 4, P.bedFrame);
  r(g, 0, 1, 13, 1, '#8f6b42');
  r(g, 0, 6, 12, 9, P.bedSheet);
  r(g, 0, 6, 12, 1, '#efe8d2');
  r(g, 1, 7, 10, 5, '#efe8d2');
});

def('3', true, (g, v) => {
  fill(g, P.floorWood2);
  r(g, 3, 0, 13, 16, P.bedFrame);
  r(g, 4, 0, 12, 16, P.bedSheet);
  r(g, 5, 2 + (v % 3), 9, 2, '#bdb094');
  r(g, 6, 9 + (v % 2), 8, 2, '#c6b99c');
});

def('4', true, (g, v) => {
  fill(g, P.floorWood2);
  r(g, 0, 0, 13, 16, P.bedFrame);
  r(g, 0, 0, 12, 16, P.bedSheet);
  r(g, 1, 4 + (v % 3), 9, 2, '#bdb094');
  r(g, 2, 10 + (v % 2), 8, 2, '#c6b99c');
});

def('y', true, (g) => {
  // armadio: anta sinistra
  fill(g, P.floorWood2);
  r(g, 2, 2, 14, 14, P.woodLo);
  r(g, 3, 3, 13, 12, P.wood);
  r(g, 4, 4, 11, 10, '#96703f');
  r(g, 14, 8, 2, 2, '#c9b17a');
});

def('z', true, (g) => {
  // armadio: anta destra
  fill(g, P.floorWood2);
  r(g, 0, 2, 14, 14, P.woodLo);
  r(g, 0, 3, 13, 12, P.wood);
  r(g, 1, 4, 11, 10, '#96703f');
  r(g, 0, 8, 2, 2, '#c9b17a');
});

def('N', true, (g) => {
  fill(g, P.floorWood2);
  r(g, 2, 3, 12, 12, P.woodLo);
  r(g, 3, 4, 10, 10, P.wood);
  r(g, 4, 7, 8, 1, P.woodLo);
  r(g, 7, 9, 2, 2, '#c9b17a');
});

def('T', true, (g) => {
  // televisione su un mobiletto, spenta
  fill(g, P.floorWood2);
  r(g, 1, 9, 14, 7, P.woodLo);
  r(g, 1, 9, 14, 1, '#8f6b42');
  r(g, 2, 1, 12, 9, '#26262b');
  r(g, 3, 2, 10, 7, '#3f3f47');
  r(g, 4, 3, 8, 5, '#2f2f37');
  r(g, 4, 3, 8, 1, '#4e4e58');
});

def('P', false, (g) => {
  // console per terra, con il cavo che va da qualche parte
  fill(g, P.floorWood);
  r(g, 2, 5, 12, 7, '#33333b');
  r(g, 2, 5, 12, 2, '#4b4b55');
  r(g, 3, 8, 10, 1, '#1d1d25');
  r(g, 4, 10, 4, 1, '#6a6a76');
  r(g, 2, 12, 12, 1, 'rgba(20,14,8,0.3)');
  r(g, 14, 9, 2, 1, '#2a2a30');
});

def('C', false, (g, v) => {
  // vestiti per terra: mucchi bassi, ma si devono vedere
  fill(g, P.floorWood);
  const cols = ['#8b78a0', '#a8834f', '#6b7c88'];
  const c = cols[v % cols.length];
  const hi = ['#a08cb6', '#c09a5f', '#849aa6'][v % 3];
  r(g, 2, 6 + (v % 2), 12, 7, c);
  r(g, 3, 5 + (v % 2), 9, 3, hi);
  r(g, 4, 9, 7, 2, hi);
  r(g, 2, 13, 12, 1, 'rgba(30,20,10,0.22)');
});

def('G', false, (g, v) => {
  // due bicchieri per terra, uno con l'acqua di ieri
  fill(g, P.floorWood);
  r(g, 3, 4, 5, 9, P.glass);
  r(g, 4, 5, 3, 7, '#d8e6e0');
  r(g, 3, 8, 5, 5, P.water);
  r(g, 3, 13, 5, 1, 'rgba(20,14,8,0.3)');
  r(g, 9, 6, 4, 7, P.glass);
  r(g, 10, 7, 2, 5, '#d8e6e0');
  r(g, 9, 13, 4, 1, 'rgba(20,14,8,0.3)');
  if (v % 2 === 0) r(g, 9, 10, 4, 3, P.water);
});

def('p', false, (g) => {
  // piatto e contenitore d'asporto, lasciati li'
  fill(g, P.floorWood);
  r(g, 2, 5, 8, 8, '#e6dfcd');
  r(g, 3, 6, 6, 6, '#cdc4ac');
  r(g, 4, 7, 4, 4, '#bcb096');
  r(g, 10, 7, 5, 6, '#dccca0');
  r(g, 10, 7, 5, 2, '#efe0b6');
  r(g, 2, 13, 13, 1, 'rgba(20,14,8,0.28)');
});

def('D', false, (g) => {
  // porta: si attraversa, e' il varco di uscita
  fill(g, P.wallRoom);
  r(g, 1, 0, 14, 16, '#5d4429');
  r(g, 2, 1, 12, 15, P.wood);
  r(g, 3, 3, 10, 11, '#7a5734');
  r(g, 11, 8, 2, 2, '#c9b17a');
});

def('F', true, (g) => {
  // gabbia del ventilatore: le pale girano e si disegnano a parte
  fill(g, P.wallRoom);
  g.strokeStyle = '#7d7768';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(8, 7.5, 6.5, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(8, 7.5, 3.5, 0, Math.PI * 2);
  g.stroke();
  r(g, 7, 13, 2, 3, '#6f6a5c');
  r(g, 5, 15, 6, 1, '#5c584c');
}, { animated: true });

// --- locale -----------------------------------------------------------

def(',', false, (g, v) => {
  fill(g, v % 2 ? P.floorTile : P.floorTile2);
  r(g, 0, 0, TILE, 1, '#ada084');
  r(g, 0, 0, 1, TILE, '#ada084');
  speck(g, '#b5a88c', v + 5, 3);
});

def('=', true, (g, v) => {
  fill(g, P.wallBar);
  r(g, 0, 0, TILE, 2, '#8a774f');
  r(g, 0, 11, TILE, 5, '#7f6e49');
  r(g, 0, 15, TILE, 1, '#5f5236');
  speck(g, '#ab9670', v + 7, 3);
});

def('V', true, (g) => {
  // vetrina sulla strada: fuori e' bianco di sole
  fill(g, P.wallBar);
  r(g, 0, 1, TILE, 12, '#7a6b4c');
  r(g, 1, 2, 14, 10, '#fdf3d2');
  r(g, 1, 8, 14, 4, '#f2e2b0');
  r(g, 0, 13, TILE, 3, '#b8ab8b');
});

def('X', true, (g) => {
  // bancone
  fill(g, P.floorTile);
  r(g, 0, 2, TILE, 14, P.woodLo);
  r(g, 0, 2, TILE, 3, '#a97c4a');
  r(g, 0, 5, TILE, 1, '#5c3f22');
  r(g, 0, 9, TILE, 1, '#7c5730');
});

def('S', true, (g) => {
  // passavivande della cucina, acciaio
  fill(g, P.floorTile);
  r(g, 0, 3, TILE, 13, P.steel);
  r(g, 0, 3, TILE, 2, '#c3c0b2');
  r(g, 0, 8, TILE, 1, '#8f8c80');
  r(g, 3, 10, 4, 1, '#8f8c80');
});

def('R', true, (g) => {
  // frigorifero
  fill(g, P.wallBar);
  r(g, 1, 0, 14, 16, '#b9b6a8');
  r(g, 2, 1, 12, 14, '#cecabb');
  r(g, 2, 7, 12, 1, '#9a9789');
  r(g, 11, 4, 1, 3, '#7d7a6e');
  r(g, 11, 9, 1, 3, '#7d7a6e');
});

def('O', true, (g) => {
  // tavolino con tovaglia
  fill(g, P.floorTile);
  r(g, 1, 2, 14, 13, P.woodLo);
  r(g, 2, 3, 12, 11, P.cloth);
  r(g, 2, 3, 12, 1, '#d4614f');
  r(g, 3, 12, 10, 2, '#a63a2e');
});

def('c', true, (g) => {
  fill(g, P.floorTile);
  r(g, 4, 4, 8, 9, P.wood);
  r(g, 4, 4, 8, 2, P.woodLo);
  r(g, 5, 13, 2, 3, P.woodLo);
  r(g, 9, 13, 2, 3, P.woodLo);
});

def('H', true, (g, v) => {
  // pianta in vaso, unica cosa viva nel locale
  fill(g, P.floorTile);
  r(g, 5, 10, 6, 6, '#9a6a44');
  r(g, 5, 10, 6, 1, '#7c5232');
  r(g, 4, 3, 8, 7, P.leafLo);
  r(g, 5, 2, 6, 6, P.leaf);
  r(g, 7 + (v % 2), 1, 2, 3, P.leaf);
});

def('K', true, (g) => {
  // muro della cucina, piu' scuro e piu' unto
  fill(g, '#b3a68a');
  r(g, 0, 10, TILE, 6, '#9d9075');
  r(g, 3, 3, 3, 5, '#8f8c80');
  r(g, 9, 2, 4, 6, '#8f8c80');
});

// --- strada -----------------------------------------------------------

def('a', false, (g, v) => {
  fill(g, v % 2 ? P.asphalt : P.asphalt2);
  speck(g, '#3d3d48', v + 2, 6);
});

def('l', false, (g) => {
  fill(g, P.asphalt);
  r(g, 4, 7, 8, 2, '#8d8a70');
});

def('m', false, (g, v) => {
  fill(g, P.sidewalk);
  r(g, 0, 0, TILE, 1, '#6d6a79');
  r(g, 0, 0, 1, TILE, '#6d6a79');
  r(g, 8, 0, 1, TILE, '#4b4854');
  r(g, 0, 8, TILE, 1, '#4b4854');
  speck(g, '#6a6776', v + 9, 3);
});

def('E', true, (g, v) => {
  fill(g, P.facade);
  r(g, 0, 0, TILE, 2, P.facadeLo);
  r(g, 0, 0, 1, TILE, P.facadeLo);
  r(g, 0, 14, TILE, 2, '#0f0d15');
  speck(g, '#2a2632', v + 4, 4);
});

def('w', true, (g, v) => {
  // finestra accesa: qualcuno e' in casa, non si sa chi
  fill(g, P.facade);
  const lit = v % 3 !== 0;
  r(g, 3, 3, 10, 9, lit ? P.windowLit : '#22212c');
  r(g, 3, 3, 10, 1, '#191822');
  r(g, 7, 3, 1, 9, '#191822');
  if (lit) r(g, 4, 8, 8, 3, '#f0cd85');
});

def('q', true, (g) => {
  // balcone con panni stesi
  fill(g, P.facade);
  r(g, 0, 6, TILE, 2, '#54505c');
  r(g, 1, 8, 14, 5, '#3a3641');
  for (let x = 2; x < 15; x += 3) r(g, x, 8, 1, 5, '#5c5866');
  r(g, 4, 2, 3, 5, '#9aa4a8');
  r(g, 9, 2, 3, 4, '#a8998a');
});

def('r', true, (g) => {
  // saracinesca abbassata
  fill(g, P.facadeLo);
  r(g, 0, 1, TILE, 14, '#4a4652');
  for (let y = 2; y < 15; y += 2) r(g, 0, y, TILE, 1, '#3b3843');
  r(g, 0, 14, TILE, 2, '#2a2833');
});

def('L', true, (g) => {
  // palo del lampione (la luce e' dipinta a parte)
  fill(g, P.sidewalk);
  r(g, 7, 0, 2, 16, '#4f4c58');
  r(g, 6, 14, 4, 2, '#3c3945');
});

def('Z', true, (g) => {
  // cassonetto
  fill(g, P.sidewalk);
  r(g, 1, 4, 14, 11, '#3f5548');
  r(g, 1, 3, 14, 2, '#546b5b');
  r(g, 2, 8, 12, 1, '#33463b');
  r(g, 2, 15, 2, 1, '#25251f');
  r(g, 12, 15, 2, 1, '#25251f');
});

def('M', true, (g) => {
  // motorino appoggiato al cavalletto
  fill(g, P.sidewalk);
  r(g, 3, 6, 10, 5, '#7a4a3c');
  r(g, 4, 4, 5, 3, '#8f5a48');
  r(g, 2, 10, 4, 4, '#232229');
  r(g, 10, 10, 4, 4, '#232229');
  r(g, 3, 11, 2, 2, '#3d3c46');
  r(g, 11, 11, 2, 2, '#3d3c46');
  r(g, 11, 5, 3, 1, '#b8b0a0');
});

def('A', true, (g, v) => {
  // tronco: la chioma viene disegnata sopra il giocatore
  fill(g, P.sidewalk);
  r(g, 6, 6, 4, 10, '#4a3a2c');
  r(g, 6, 6, 1, 10, '#5c4938');
  r(g, 4, 2, 8, 6, P.leafLo);
  r(g, 5, 0, 7, 5, '#3f4a2c');
  speck(g, '#4d5a34', v + 6, 4);
}, { tall: true });

def('n', false, (g) => {
  // panchina
  fill(g, P.sidewalk);
  r(g, 1, 5, 14, 3, '#6a5a42');
  r(g, 1, 9, 14, 3, '#5c4d38');
  r(g, 2, 12, 2, 3, '#3f3c46');
  r(g, 12, 12, 2, 3, '#3f3c46');
});

def('t', true, (g) => {
  // muretto basso
  fill(g, P.sidewalk);
  r(g, 0, 5, TILE, 10, '#5a5560');
  r(g, 0, 5, TILE, 2, '#6b6672');
  r(g, 5, 7, 1, 8, '#4a4550');
});

def('_', false, (g, v) => {
  // terra secca ai piedi degli alberi
  fill(g, '#4b4238');
  speck(g, '#574d40', v + 8, 6);
});

/** Tile pieno di nero: bordo delle mappe. */
def(' ', true, (g) => fill(g, '#0d0b12'));

const cache = new Map<string, HTMLCanvasElement>();

export function tileDef(ch: string): TileDef {
  return TILES[ch] ?? TILES[' '];
}

export function isSolid(ch: string): boolean {
  return tileDef(ch).solid;
}

/** Variante deterministica: due tile uguali non sembrano fotocopie. */
export function variantAt(x: number, y: number): number {
  return (x * 7 + y * 13 + ((x * y) % 5)) % 4;
}

/** Canvas 16x16 del tile richiesto, disegnato una volta sola. */
export function tileCanvas(ch: string, v: number): HTMLCanvasElement {
  const key = `${ch}:${v}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = createCanvas(TILE, TILE);
  const g = ctx2d(c);
  tileDef(ch).draw(g, v);
  cache.set(key, c);
  return c;
}
