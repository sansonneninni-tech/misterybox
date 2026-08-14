/**
 * Tileset originale 16x16.
 *
 * Ogni tile e' disegnato pixel per pixel da funzioni deterministiche e poi
 * pre-renderizzato in cache all'avvio. Il risultato imita la densita' grafica
 * dei tileset 2D per console portatili: 3-4 toni per materiale, dithering
 * ordinato per le sfumature, contorni scuri sugli oggetti.
 */

import { TILE } from '../engine/const';
import { createCanvas, ctx2d } from '../engine/renderer';
import { hash2 } from '../engine/rng';
import { PAL } from './palette';
import { stamp } from './pixel';

export type TileLayer = 'ground' | 'object' | 'over';

export interface TileDef {
  /** Disegna il tile 16x16 nell'origine del contesto. */
  draw: (g: CanvasRenderingContext2D, variant: number, frame: number) => void;
  solid?: boolean;
  /** Numero di varianti grafiche scelte in base alla posizione. */
  variants?: number;
  /** Fotogrammi di animazione (acqua, fiori). */
  frames?: number;
  /** Velocita' di animazione: frame logici per fotogramma. */
  frameRate?: number;
  /** Marcatore semantico usato dalla logica di gioco. */
  tag?: 'tallgrass' | 'water' | 'ledge-down' | 'ledge-left' | 'ledge-right' | 'door' | 'ice' | 'sand';
  /** Il tile viene disegnato sopra il giocatore. */
  over?: boolean;
}

// ---------------------------------------------------------------------------
// Helper di disegno
// ---------------------------------------------------------------------------

function fill(g: CanvasRenderingContext2D, c: string, x = 0, y = 0, w = TILE, h = TILE): void {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

function px(g: CanvasRenderingContext2D, x: number, y: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(x, y, 1, 1);
}

function hline(g: CanvasRenderingContext2D, x: number, y: number, w: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(x, y, w, 1);
}

function vline(g: CanvasRenderingContext2D, x: number, y: number, h: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(x, y, 1, h);
}

/** Dithering ordinato 4x4 (Bayer): densita' 0..16. */
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function dither(
  g: CanvasRenderingContext2D,
  color: string,
  density: number,
  x0 = 0,
  y0 = 0,
  w = TILE,
  h = TILE,
): void {
  g.fillStyle = color;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (BAYER4[y & 3][x & 3] < density) g.fillRect(x, y, 1, 1);
    }
  }
}

/** Rumore deterministico "a chiazze" per terreni. */
function speckle(
  g: CanvasRenderingContext2D,
  color: string,
  amount: number,
  seed: number,
  x0 = 0,
  y0 = 0,
  w = TILE,
  h = TILE,
): void {
  g.fillStyle = color;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (hash2(x, y, seed) < amount) g.fillRect(x, y, 1, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Terreni
// ---------------------------------------------------------------------------

function drawGrass(g: CanvasRenderingContext2D, variant: number): void {
  fill(g, PAL.grassMid);
  // Trama di base: dithering chiaro + macchie scure.
  dither(g, PAL.grassLite, 5);
  speckle(g, PAL.grassDark, 0.09, 11 + variant);
  // Ciuffi d'erba.
  const tufts: Array<[number, number]> = [];
  if (variant === 1) tufts.push([3, 5], [10, 11]);
  if (variant === 2) tufts.push([7, 3], [2, 12], [12, 8]);
  if (variant === 3) tufts.push([5, 9]);
  for (const [x, y] of tufts) {
    px(g, x, y + 1, PAL.grassDark);
    px(g, x + 1, y, PAL.grassHi);
    px(g, x + 1, y + 1, PAL.grassHi);
    px(g, x + 2, y + 1, PAL.grassDark);
  }
  if (variant === 4) {
    // Piccoli fiori bianchi.
    for (const [x, y] of [[4, 4], [11, 9]] as Array<[number, number]>) {
      px(g, x, y, PAL.white);
      px(g, x + 1, y, PAL.white);
      px(g, x, y + 1, PAL.white);
      px(g, x + 1, y + 1, '#f4e08a');
    }
  }
}

function drawFlowers(g: CanvasRenderingContext2D, variant: number, frame: number): void {
  drawGrass(g, 0);
  const cols = variant === 0 ? ['#e05a6a', '#f2909a'] : variant === 1 ? ['#e8c33f', '#f7e08a'] : ['#c98ce0', '#e8c0f2'];
  const sway = frame === 1 ? 1 : 0;
  const spots: Array<[number, number]> = [
    [3, 4], [9, 3], [5, 10], [12, 9], [8, 7],
  ];
  for (let i = 0; i < spots.length; i++) {
    const [bx, by] = spots[i];
    const x = bx + (i % 2 === 0 ? sway : 0);
    px(g, x, by, cols[0]);
    px(g, x + 1, by, cols[1]);
    px(g, x, by + 1, cols[1]);
    px(g, x + 1, by + 1, cols[0]);
    px(g, x, by + 2, PAL.grassDark);
  }
}

/** Ciuffo compatto e ben leggibile: l'erba alta deve saltare all'occhio. */
const TALLGRASS_A = [
  '................',
  '................',
  '.....o....o.....',
  '....oDo..oDo....',
  '..o.oDDooDDo.o..',
  '.oDooDDDDDDooDo.',
  '.oDDDDMMMMDDDDo.',
  '.oDMMMMMMMMMMDo.',
  '.oDMMLLMMLLMMDo.',
  '.oDMMMMMMMMMMDo.',
  '.oDDMMMMMMMMDDo.',
  '..oDDDDDDDDDDo..',
  '...oooooooooo...',
  '................',
  '................',
  '................',
];

const TALLGRASS_B = [
  '................',
  '................',
  '..o....o....o...',
  '.oDo..oDo..oDo..',
  '.oDDooDDDooDDo..',
  '.oDDDDDDDDDDDDo.',
  '.oDDMMMMMMMMDDo.',
  '.oDMMMMLLMMMMDo.',
  '.oDMMLLHHLLMMDo.',
  '.oDMMMMMMMMMMDo.',
  '.oDDMMMMMMMMDDo.',
  '..oDDDDDDDDDDo..',
  '...oooooooooo...',
  '................',
  '................',
  '................',
];

function drawTallGrass(g: CanvasRenderingContext2D, variant: number, frame: number): void {
  drawGrass(g, 0);
  const legend = {
    o: '#173d20',
    D: PAL.bushDark,
    M: PAL.bushMid,
    L: PAL.bushLite,
    H: '#63b25c',
  };
  const rows = variant === 1 ? TALLGRASS_B : TALLGRASS_A;
  // L'oscillazione sposta il ciuffo di 1px alternando i fotogrammi.
  stamp(g, rows, legend, frame === 1 ? 1 : 0, frame === 1 ? -1 : 0);
  // Ombra alla base per staccare il ciuffo dal terreno.
  g.globalAlpha = 0.22;
  fill(g, '#0d2416', 3, 12, 10, 2);
  g.globalAlpha = 1;
}

function drawDirt(g: CanvasRenderingContext2D, variant: number): void {
  fill(g, PAL.dirtMid);
  dither(g, PAL.dirtLite, 6);
  speckle(g, PAL.dirtDark, 0.1, 23 + variant);
  if (variant === 1) {
    px(g, 4, 6, PAL.dirtDark);
    px(g, 5, 6, PAL.dirtDark);
    px(g, 11, 11, PAL.dirtDark);
  }
}

function drawSand(g: CanvasRenderingContext2D, variant: number): void {
  fill(g, PAL.sandMid);
  dither(g, PAL.sandLite, 7);
  speckle(g, PAL.sandDark, 0.07, 41 + variant);
}

function drawWater(g: CanvasRenderingContext2D, _variant: number, frame: number): void {
  fill(g, PAL.waterMid);
  // Bande orizzontali che scorrono per dare movimento.
  for (let y = 0; y < TILE; y++) {
    const phase = (y * 3 + frame * 4) % 16;
    if (phase < 4) hline(g, 0, y, TILE, PAL.waterDark);
    else if (phase < 6) hline(g, 0, y, TILE, PAL.waterLite);
  }
  // Riflessi brillanti.
  const sx = (frame * 3) % 16;
  for (const [x, y] of [[2, 3], [9, 6], [5, 11], [12, 13]] as Array<[number, number]>) {
    const px1 = (x + sx) % 16;
    px(g, px1, y, PAL.waterFoam);
    px(g, (px1 + 1) % 16, y, PAL.waterLite);
  }
}

function drawWaterEdge(g: CanvasRenderingContext2D, variant: number, frame: number): void {
  // variant: 0 = riva in alto, 1 = basso, 2 = sinistra, 3 = destra
  drawWater(g, 0, frame);
  const foam = frame % 2 === 0 ? PAL.waterFoam : '#eaf8ff';
  if (variant === 0) {
    hline(g, 0, 0, TILE, PAL.sandMid);
    hline(g, 0, 1, TILE, PAL.sandDark);
    hline(g, 0, 2, TILE, foam);
    for (let x = 0; x < TILE; x += 2) px(g, x + (frame % 2), 3, foam);
  } else if (variant === 1) {
    hline(g, 0, TILE - 1, TILE, PAL.sandMid);
    hline(g, 0, TILE - 2, TILE, PAL.sandDark);
    hline(g, 0, TILE - 3, TILE, foam);
  } else if (variant === 2) {
    vline(g, 0, 0, TILE, PAL.sandMid);
    vline(g, 1, 0, TILE, PAL.sandDark);
    vline(g, 2, 0, TILE, foam);
  } else {
    vline(g, TILE - 1, 0, TILE, PAL.sandMid);
    vline(g, TILE - 2, 0, TILE, PAL.sandDark);
    vline(g, TILE - 3, 0, TILE, foam);
  }
}

/**
 * Sentiero con raccordo automatico verso l'erba.
 * La variante e' una maschera di bit: 1=nord, 2=est, 4=sud, 8=ovest.
 */
function drawPathMask(g: CanvasRenderingContext2D, mask: number): void {
  drawDirt(g, mask & 1 ? 1 : 0);
  const depth = (i: number, seed: number) => (hash2(i, seed, 17) < 0.42 ? 3 : 2);
  const edge = (x: number, y: number) => {
    // Sfumatura erbosa: tono chiaro sulla punta esterna del ciuffo.
    px(g, x, y, PAL.grassLite);
  };

  if (mask & 1) {
    for (let x = 0; x < TILE; x++) {
      const d = depth(x, 1);
      for (let y = 0; y < d; y++) px(g, x, y, y === 0 ? PAL.grassMid : PAL.grassMid);
      edge(x, 0);
      px(g, x, d, PAL.grassDark);
    }
  }
  if (mask & 4) {
    for (let x = 0; x < TILE; x++) {
      const d = depth(x, 2);
      for (let y = 0; y < d; y++) px(g, x, TILE - 1 - y, PAL.grassMid);
      edge(x, TILE - 1);
      px(g, x, TILE - 1 - d, PAL.grassDark);
    }
  }
  if (mask & 8) {
    for (let y = 0; y < TILE; y++) {
      const d = depth(y, 3);
      for (let x = 0; x < d; x++) px(g, x, y, PAL.grassMid);
      px(g, d, y, PAL.grassDark);
    }
  }
  if (mask & 2) {
    for (let y = 0; y < TILE; y++) {
      const d = depth(y, 4);
      for (let x = 0; x < d; x++) px(g, TILE - 1 - x, y, PAL.grassMid);
      px(g, TILE - 1 - d, y, PAL.grassDark);
    }
  }
  // Qualche filo d'erba sul bordo per ammorbidire il taglio.
  if (mask) {
    for (let i = 0; i < 3; i++) {
      const t = hash2(i, mask, 23);
      const x = Math.floor(t * TILE);
      if (mask & 1 && hash2(x, 5, 3) < 0.5) px(g, x, 3, PAL.grassDark);
      if (mask & 4 && hash2(x, 6, 3) < 0.5) px(g, x, TILE - 4, PAL.grassDark);
    }
  }
}

/** Bordo del sentiero verso l'erba (variant = lato). */
function drawPathEdge(g: CanvasRenderingContext2D, variant: number): void {
  drawDirt(g, 0);
  const jag = (i: number) => (hash2(i, variant, 7) < 0.5 ? 1 : 2);
  if (variant === 0) {
    for (let x = 0; x < TILE; x++) {
      const d = jag(x);
      g.fillStyle = PAL.grassMid;
      g.fillRect(x, 0, 1, d);
      px(g, x, d, PAL.grassDark);
    }
  } else if (variant === 1) {
    for (let x = 0; x < TILE; x++) {
      const d = jag(x);
      g.fillStyle = PAL.grassMid;
      g.fillRect(x, TILE - d, 1, d);
      px(g, x, TILE - d - 1, PAL.grassDark);
    }
  } else if (variant === 2) {
    for (let y = 0; y < TILE; y++) {
      const d = jag(y);
      g.fillStyle = PAL.grassMid;
      g.fillRect(0, y, d, 1);
      px(g, d, y, PAL.grassDark);
    }
  } else {
    for (let y = 0; y < TILE; y++) {
      const d = jag(y);
      g.fillStyle = PAL.grassMid;
      g.fillRect(TILE - d, y, d, 1);
      px(g, TILE - d - 1, y, PAL.grassDark);
    }
  }
}

// ---------------------------------------------------------------------------
// Rocce, dislivelli, alberi
// ---------------------------------------------------------------------------

function drawCliff(g: CanvasRenderingContext2D, variant: number): void {
  // variant: 0 = fronte, 1 = cima, 2 = angolo sx, 3 = angolo dx
  fill(g, PAL.rockMid);
  dither(g, PAL.rockLite, 5);
  speckle(g, PAL.rockDark, 0.12, 61 + variant);
  // Fughe tra i blocchi.
  hline(g, 0, 5, TILE, PAL.rockDark);
  hline(g, 0, 11, TILE, PAL.rockDark);
  vline(g, 4, 0, 5, PAL.rockDark);
  vline(g, 11, 6, 5, PAL.rockDark);
  vline(g, 7, 12, 4, PAL.rockDark);
  hline(g, 0, 6, TILE, PAL.rockHi);
  hline(g, 0, 0, TILE, PAL.rockDark);
  if (variant === 1) {
    // Cima erbosa.
    for (let x = 0; x < TILE; x++) {
      const d = 4 + (hash2(x, 3, 9) < 0.5 ? 0 : 1);
      g.fillStyle = PAL.grassMid;
      g.fillRect(x, 0, 1, d);
      px(g, x, d, PAL.grassDark);
    }
    hline(g, 0, 0, TILE, PAL.grassLite);
  }
}

function drawRock(g: CanvasRenderingContext2D, variant: number): void {
  drawGrass(g, 0);
  if (variant === 1) drawDirt(g, 0);
  const rows = [
    '................',
    '................',
    '.....oooo.......',
    '....oLLLLo......',
    '...oLLHHLLo.....',
    '..oLLHHHHLLo....',
    '..oLMMHHMMLo....',
    '.oLMMMMMMMMLo...',
    '.oMMMMMMMMMMo...',
    '.oMDDMMMMDDMo...',
    '.oDDDDDDDDDDo...',
    '..oDDDDDDDDo....',
    '...oooooooo.....',
    '................',
    '................',
    '................',
  ];
  stamp(g, rows, {
    o: PAL.outline,
    D: PAL.rockDark,
    M: PAL.rockMid,
    L: PAL.rockLite,
    H: PAL.rockHi,
  }, 0, 0);
}

/**
 * Albero 2x2 costruito una sola volta su una tela 32x32 e poi tagliato in
 * quadranti: cosi' la chioma resta continua e gli alberi affiancati formano
 * una massa boschiva compatta.
 */
let treeCache: HTMLCanvasElement | null = null;

function buildTreeCanvas(): HTMLCanvasElement {
  if (treeCache) return treeCache;
  const c = createCanvas(32, 34);
  const g = ctx2d(c);

  // Tronco
  const trunkX = 13;
  for (let y = 18; y < 30; y++) {
    for (let x = trunkX; x < trunkX + 6; x++) {
      const t = (x - trunkX) / 6;
      g.fillStyle = t < 0.25 ? PAL.woodDark : t < 0.6 ? PAL.woodMid : PAL.woodDark;
      g.fillRect(x, y, 1, 1);
    }
  }
  // Radici
  g.fillStyle = PAL.woodDark;
  g.fillRect(11, 27, 3, 2);
  g.fillRect(18, 27, 3, 2);
  g.fillRect(10, 29, 12, 1);
  g.fillStyle = PAL.woodMid;
  g.fillRect(14, 20, 1, 8);

  // Chioma: unione di ellissi per una silhouette organica
  const blobs: Array<[number, number, number, number]> = [
    [16, 13, 15, 11],
    [7, 10, 8, 6],
    [25, 11, 7, 6],
    [16, 5, 9, 5],
    [11, 19, 8, 5],
    [21, 19, 8, 5],
  ];
  const inside = (x: number, y: number): boolean => {
    for (const [cx, cy, rx, ry] of blobs) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) return true;
    }
    return false;
  };

  const D = PAL.bushDark;
  const M = PAL.bushMid;
  const L = PAL.bushLite;
  const H = '#7ac86a';
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (!inside(x, y)) continue;
      // Illuminazione dall'alto a sinistra.
      const lum = 1 - (x * 0.35 + y * 0.65) / 26;
      const b = BAYER4[y & 3][x & 3] / 16;
      let col: string;
      if (lum + b * 0.18 > 0.72) col = H;
      else if (lum + b * 0.18 > 0.5) col = L;
      else if (lum + b * 0.18 > 0.26) col = M;
      else col = D;
      // Ciuffi di foglie: piccole macchie piu' scure.
      if (hash2(Math.floor(x / 2), Math.floor(y / 2), 31) < 0.16) {
        col = col === H ? L : col === L ? M : D;
      }
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }

  // Contorno scuro
  const outline = createCanvas(32, 34);
  const og = ctx2d(outline);
  const shadow = createCanvas(32, 34);
  const sg = ctx2d(shadow);
  sg.drawImage(c, 0, 0);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = '#122a18';
  sg.fillRect(0, 0, 32, 34);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as Array<[number, number]>) {
    og.drawImage(shadow, dx, dy);
  }
  og.drawImage(c, 0, 0);
  treeCache = outline;
  return outline;
}

/** Albero grande 2x2: quadranti 0=TL 1=TR 2=BL 3=BR. */
function drawTreeQuad(g: CanvasRenderingContext2D, quad: number): void {
  const tree = buildTreeCanvas();
  if (quad >= 2) {
    drawGrass(g, 0);
    g.globalAlpha = 0.25;
    fill(g, '#0b2018', quad === 2 ? 3 : 0, 12, 13, 3);
    g.globalAlpha = 1;
  }
  const sx = (quad % 2) * 16;
  const sy = quad < 2 ? 0 : 16;
  g.drawImage(tree, sx, sy, 16, 16, 0, 0, 16, 16);
}

function drawBush(g: CanvasRenderingContext2D): void {
  drawGrass(g, 0);
  const rows = [
    '................',
    '................',
    '.....oooooo.....',
    '...ooDDDDDDoo...',
    '..oDDMMMMMMDDo..',
    '.oDMMMLLLLMMMDo.',
    '.oDMMLLHHHHLMMDo',
    'oDMMLLHHHHHHLMMo',
    'oDMMLHHHHHHHLMMo',
    'oDMMLLHHHHHHLMMo',
    '.oDMMLLHHHHLMMDo',
    '.oDMMMLLLLMMMDo.',
    '..oDDMMMMMMDDo..',
    '...ooDDDDDDoo...',
    '.....oooooo.....',
    '................',
  ];
  stamp(g, rows, {
    o: PAL.outline,
    D: PAL.bushDark,
    M: PAL.bushMid,
    L: PAL.bushLite,
    H: '#63b25c',
  }, 0, 0);
}

function drawLedge(g: CanvasRenderingContext2D): void {
  drawGrass(g, 0);
  fill(g, PAL.dirtMid, 0, 8, TILE, 8);
  dither(g, PAL.dirtLite, 6, 0, 8, TILE, 8);
  hline(g, 0, 7, TILE, PAL.grassDark);
  hline(g, 0, 8, TILE, PAL.dirtDark);
  hline(g, 0, 9, TILE, PAL.dirtLite);
  hline(g, 0, TILE - 1, TILE, PAL.dirtDark);
  for (let x = 2; x < TILE; x += 5) {
    vline(g, x, 10, 5, PAL.dirtDark);
  }
}

// ---------------------------------------------------------------------------
// Edifici
// ---------------------------------------------------------------------------

function roofTile(color: string, dark: string, lite: string) {
  return (g: CanvasRenderingContext2D, variant: number): void => {
    // variant: 0 = corpo, 1 = bordo sinistro, 2 = bordo destro,
    //          3 = colmo, 4 = gronda, 5 = colmo sx, 6 = colmo dx
    fill(g, color);
    // Tegole sfalsate: 4 file da 4px, ogni tegola larga 6px.
    for (let row = 0; row < 4; row++) {
      const y = row * 4;
      const off = (row % 2) * 3;
      hline(g, 0, y, TILE, lite);
      hline(g, 0, y + 3, TILE, dark);
      for (let x = -off; x < TILE; x += 6) {
        if (x >= 0) vline(g, x, y, 4, dark);
        if (x + 1 >= 0 && x + 1 < TILE) px(g, x + 1, y + 1, lite);
      }
    }
    dither(g, dark, 2);

    if (variant === 1 || variant === 5) {
      vline(g, 0, 0, TILE, PAL.outline);
      vline(g, 1, 0, TILE, dark);
    }
    if (variant === 2 || variant === 6) {
      vline(g, TILE - 1, 0, TILE, PAL.outline);
      vline(g, TILE - 2, 0, TILE, dark);
    }
    if (variant === 3 || variant === 5 || variant === 6) {
      // Colmo del tetto.
      hline(g, 0, 0, TILE, PAL.outline);
      hline(g, 0, 1, TILE, lite);
      hline(g, 0, 2, TILE, color);
      hline(g, 0, 3, TILE, dark);
    }
    if (variant === 4) {
      // Gronda sporgente con ombra sotto.
      hline(g, 0, TILE - 4, TILE, lite);
      hline(g, 0, TILE - 3, TILE, color);
      hline(g, 0, TILE - 2, TILE, dark);
      hline(g, 0, TILE - 1, TILE, PAL.outline);
    }
  };
}

function drawWall(g: CanvasRenderingContext2D, variant: number): void {
  // variant: 0 = liscio, 1 = con finestra, 2 = bordo sx, 3 = bordo dx, 4 = base
  fill(g, PAL.wallLite);
  dither(g, PAL.wallMid, 3);
  for (let y = 3; y < TILE; y += 6) hline(g, 0, y, TILE, PAL.wallMid);
  if (variant === 1) {
    // Finestra con riflesso.
    const rows = [
      '................',
      '..oooooooooooo..',
      '..oWWWWWWWWWWo..',
      '..oWccccccccWo..',
      '..oWcCCcccccWo..',
      '..oWcCCcccccWo..',
      '..oWccccccccWo..',
      '..oWccccccccWo..',
      '..oWWWWWWWWWWo..',
      '..oWccccccccWo..',
      '..oWcccccCCcWo..',
      '..oWcccccCCcWo..',
      '..oWccccccccWo..',
      '..oWWWWWWWWWWo..',
      '..oooooooooooo..',
      '................',
    ];
    stamp(g, rows, {
      o: PAL.outline,
      W: PAL.wallDark,
      c: '#3c6fa8',
      C: '#a8d8f0',
    }, 0, 0);
  } else if (variant === 2) {
    vline(g, 0, 0, TILE, PAL.outline);
    vline(g, 1, 0, TILE, PAL.wallDark);
  } else if (variant === 3) {
    vline(g, TILE - 1, 0, TILE, PAL.outline);
    vline(g, TILE - 2, 0, TILE, PAL.wallDark);
  } else if (variant === 4) {
    fill(g, PAL.wallDark, 0, TILE - 4, TILE, 4);
    hline(g, 0, TILE - 4, TILE, PAL.wallShadow);
    hline(g, 0, TILE - 1, TILE, PAL.outline);
  }
}

function drawDoor(g: CanvasRenderingContext2D, variant: number): void {
  drawWall(g, 0);
  if (variant === 0) {
    // Porta chiusa in legno con pannelli e maniglia.
    const rows = [
      '................',
      '..oooooooooooo..',
      '..oFFFFFFFFFFo..',
      '..oFDDDDDDDDFo..',
      '..oFDwwWWwwwDFo.',
      '..oFDwWWWWWwDFo.',
      '..oFDwwWWwwwDFo.',
      '..oFDDDDDDDDFo..',
      '..oFDwwwwwwwDFo.',
      '..oFDwWWWWWwDFo.',
      '..oFDwwwwYwwDFo.',
      '..oFDwwwwwwwDFo.',
      '..oFDDDDDDDDFo..',
      '..oFFFFFFFFFFo..',
      '..oooooooooooo..',
      '................',
    ];
    stamp(g, rows, {
      o: PAL.outline,
      F: PAL.wallDark,
      D: PAL.woodDark,
      w: PAL.woodMid,
      W: PAL.woodLite,
      Y: '#e8c33f',
    }, 0, 0);
    return;
  }
  // Vano d'ingresso: stipite, buio interno e gradino illuminato.
  const rows = [
    '................',
    '..oooooooooooo..',
    '..oFFFFFFFFFFo..',
    '..oFdddddddd Fo.',
    '..oFdssssssdFo..',
    '..oFdssssssdFo..',
    '..oFdssssssdFo..',
    '..oFdssssssdFo..',
    '..oFdssssssdFo..',
    '..oFdssssssdFo..',
    '..oFdssssssdFo..',
    '..oFdssssssdFo..',
    '..oFdddddddddo..',
    '..oLLLLLLLLLLo..',
    '..oooooooooooo..',
    '................',
  ];
  stamp(g, rows, {
    o: PAL.outline,
    F: PAL.woodDark,
    d: '#241d2c',
    s: '#100c16',
    L: PAL.wallMid,
  }, 0, 0);
  // Accenno di luce sul gradino.
  hline(g, 3, 13, 10, PAL.wallLite);
}

function drawSign(g: CanvasRenderingContext2D): void {
  drawGrass(g, 0);
  const rows = [
    '................',
    '................',
    '..oooooooooooo..',
    '..oWWWWWWWWWWo..',
    '..oWwwwwwwwwWo..',
    '..oWwDDDDDDwWo..',
    '..oWwDwwwwDwWo..',
    '..oWwDDDDDDwWo..',
    '..oWwwwwwwwwWo..',
    '..oWWWWWWWWWWo..',
    '..oooooooooooo..',
    '......oWWo......',
    '......oWWo......',
    '......oWWo......',
    '......oooo......',
    '................',
  ];
  stamp(g, rows, {
    o: PAL.outline,
    W: PAL.woodDark,
    w: PAL.woodMid,
    D: PAL.woodLite,
  }, 0, 0);
}

function drawFence(g: CanvasRenderingContext2D, variant: number): void {
  drawGrass(g, 0);
  const W = PAL.woodMid;
  const D = PAL.woodDark;
  const L = PAL.woodLite;
  if (variant === 0) {
    // Staccionata orizzontale.
    for (const y of [5, 9]) {
      hline(g, 0, y, TILE, D);
      hline(g, 0, y + 1, TILE, L);
      hline(g, 0, y + 2, TILE, W);
    }
    for (const x of [2, 10]) {
      vline(g, x, 2, 12, D);
      vline(g, x + 1, 2, 12, W);
      vline(g, x + 2, 2, 12, D);
    }
  } else {
    // Palo verticale singolo.
    vline(g, 6, 1, 14, D);
    vline(g, 7, 1, 14, L);
    vline(g, 8, 1, 14, W);
    vline(g, 9, 1, 14, D);
    for (const y of [4, 9]) {
      hline(g, 2, y, 12, D);
      hline(g, 2, y + 1, 12, W);
    }
  }
}

// ---------------------------------------------------------------------------
// Interni
// ---------------------------------------------------------------------------

function drawFloor(g: CanvasRenderingContext2D, variant: number): void {
  fill(g, PAL.floorMid);
  if (variant === 0) {
    // Assi di legno lunghe con venature.
    fill(g, '#c9a878');
    for (let y = 0; y < TILE; y++) {
      const band = Math.floor(y / 4);
      const tone = band % 2 === 0 ? '#c9a878' : '#bd9a68';
      hline(g, 0, y, TILE, tone);
      if (y % 4 === 0) hline(g, 0, y, TILE, '#8f6f45');
      if (y % 4 === 1) hline(g, 0, y, TILE, '#dcbd8e');
    }
    // Venature sottili.
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        if (y % 4 === 0) continue;
        if (hash2(x, y, 71) < 0.07) px(g, x, y, '#a98a5c');
      }
    }
    // Giunzione verticale tra due assi.
    vline(g, 11, 0, 4, '#8f6f45');
    vline(g, 4, 8, 4, '#8f6f45');
  } else {
    // Piastrelle chiare con fuga sottile: contrasto basso, niente scacchiera.
    fill(g, '#e6e0d2');
    for (let y = 0; y < TILE; y += 8) {
      for (let x = 0; x < TILE; x += 8) {
        if (((x / 8) + (y / 8)) % 2 === 0) fill(g, '#ded7c6', x, y, 8, 8);
      }
    }
    dither(g, '#f2eee2', 3);
    for (let y = 0; y < TILE; y += 8) hline(g, 0, y, TILE, '#c6bda8');
    for (let x = 0; x < TILE; x += 8) vline(g, x, 0, TILE, '#c6bda8');
    px(g, 0, 0, '#b3a992');
    px(g, 8, 8, '#b3a992');
  }
}

function drawCarpet(g: CanvasRenderingContext2D, variant: number): void {
  const base = variant === 0 ? '#b8443e' : '#3f63c4';
  const dark = variant === 0 ? '#7f2727' : '#26397e';
  const lite = variant === 0 ? '#d4685f' : '#6f92e0';
  fill(g, base);
  // Trama a rombi appena accennata.
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      if ((x + y) % 8 === 0) px(g, x, y, lite);
      if ((x - y + 32) % 8 === 0) px(g, x, y, dark);
    }
  }
  hline(g, 0, 0, TILE, dark);
  hline(g, 0, TILE - 1, TILE, dark);
  vline(g, 0, 0, TILE, dark);
  vline(g, TILE - 1, 0, TILE, dark);
}

function drawInnerWall(g: CanvasRenderingContext2D, variant: number): void {
  // variant 0 = parete alta, 1 = con quadro, 2 = zoccolo,
  //         3 = parete laterale, 4 = parete di fondo
  fill(g, '#d8c8e8');
  for (let x = 0; x < TILE; x += 4) vline(g, x, 0, TILE, '#c6b4dc');
  dither(g, '#e8dcf4', 4);

  if (variant === 3) {
    // Muro laterale visto di taglio: piu' scuro, con spigolo interno.
    fill(g, '#a894c0');
    for (let x = 0; x < TILE; x += 4) vline(g, x, 0, TILE, '#9a86b4');
    dither(g, '#bda9d2', 4);
    hline(g, 0, 0, TILE, '#8a76a4');
    hline(g, 0, TILE - 1, TILE, '#8a76a4');
    return;
  }
  if (variant === 4) {
    fill(g, '#7f6f96');
    dither(g, '#8f7fa6', 5);
    hline(g, 0, 0, TILE, PAL.outline);
    hline(g, 0, 1, TILE, PAL.woodMid);
    hline(g, 0, 2, TILE, PAL.woodDark);
    return;
  }
  if (variant === 2) {
    fill(g, PAL.woodMid, 0, TILE - 5, TILE, 5);
    hline(g, 0, TILE - 5, TILE, PAL.woodLite);
    hline(g, 0, TILE - 1, TILE, PAL.outline);
    return;
  }
  if (variant === 1) {
    const rows = [
      '................',
      '...oooooooooo...',
      '...oWWWWWWWWo...',
      '...oWggggggWo...',
      '...oWgGGGGgWo...',
      '...oWgGbbGgWo...',
      '...oWgGGGGgWo...',
      '...oWggggggWo...',
      '...oWWWWWWWWo...',
      '...oooooooooo...',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ];
    stamp(g, rows, {
      o: PAL.outline,
      W: PAL.woodDark,
      g: '#8ecf7a',
      G: '#5fae42',
      b: '#3d81d6',
    }, 0, 0);
  }
}

function furniture(rows: string[], legend: Record<string, string | null>, floorVariant = 0) {
  return (g: CanvasRenderingContext2D): void => {
    drawFloor(g, floorVariant);
    stamp(g, rows, legend, 0, 0);
  };
}

const TABLE_TOP = [
  '................',
  'oooooooooooooooo',
  'oLLLLLLLLLLLLLLo',
  'oWWWWWWWWWWWWWWo',
  'oWWWWWWWWWWWWWWo',
  'oDDDDDDDDDDDDDDo',
  'oooooooooooooooo',
  '..oWo........oWo',
  '..oWo........oWo',
  '..oWo........oWo',
  '..oWo........oWo',
  '..oooo.......ooo',
  '................',
  '................',
  '................',
  '................',
];

const BED = [
  'oooooooooooooo..',
  'oWWWWWWWWWWWWo..',
  'oWccccccccccWo..',
  'oWcCCCCCCCCcWo..',
  'oWcCCCCCCCCcWo..',
  'oWccccccccccWo..',
  'oWppppppppppWo..',
  'oWpPPPPPPPPpWo..',
  'oWpPPPPPPPPpWo..',
  'oWpPPPPPPPPpWo..',
  'oWpPPPPPPPPpWo..',
  'oWppppppppppWo..',
  'oWWWWWWWWWWWWo..',
  'oooooooooooooo..',
  '................',
  '................',
];

const BOOKSHELF = [
  'oooooooooooooooo',
  'oWWWWWWWWWWWWWWo',
  'oWrrgbbrgggbrrWo',
  'oWrrgbbrgggbrrWo',
  'oWWWWWWWWWWWWWWo',
  'oWbbrrgbbrrggbWo',
  'oWbbrrgbbrrggbWo',
  'oWWWWWWWWWWWWWWo',
  'oWggbrrbggbrrbWo',
  'oWggbrrbggbrrbWo',
  'oWWWWWWWWWWWWWWo',
  'oWrbbggrrbbggrWo',
  'oWrbbggrrbbggrWo',
  'oWWWWWWWWWWWWWWo',
  'oooooooooooooooo',
  '................',
];

const TV = [
  '................',
  '..oooooooooooo..',
  '..oDDDDDDDDDDo..',
  '..oDssssssssDo..',
  '..oDsSSSSSSsDo..',
  '..oDsSSSSSSsDo..',
  '..oDsSSSSSSsDo..',
  '..oDssssssssDo..',
  '..oDDDDDDDDDDo..',
  '..ooDDDDDDDDoo..',
  '....oooooooo....',
  '.....oDDDDo.....',
  '....ooooooooo...',
  '................',
  '................',
  '................',
];

const PLANT = [
  '................',
  '.....gG.Gg......',
  '....gGGGGGg.....',
  '...gGGgGgGGg....',
  '..gGGGgGgGGGg...',
  '...gGGGgGGGg....',
  '....ggGgGgg.....',
  '......gGg.......',
  '......oWo.......',
  '.....ooWoo......',
  '.....oWWWo......',
  '.....oWWWo......',
  '.....oWWWo......',
  '.....ooooo......',
  '................',
  '................',
];

const COUNTER = [
  'oooooooooooooooo',
  'oLLLLLLLLLLLLLLo',
  'oWWWWWWWWWWWWWWo',
  'oWWWWWWWWWWWWWWo',
  'oDDDDDDDDDDDDDDo',
  'oDDDDDDDDDDDDDDo',
  'oWWWWWWWWWWWWWWo',
  'oWDDWDDWDDWDDWWo',
  'oWWWWWWWWWWWWWWo',
  'oWDDWDDWDDWDDWWo',
  'oWWWWWWWWWWWWWWo',
  'oWDDWDDWDDWDDWWo',
  'oWWWWWWWWWWWWWWo',
  'oDDDDDDDDDDDDDDo',
  'oooooooooooooooo',
  '................',
];

const COUNTER_BALL = [
  'oooooooooooooooo',
  'oLLLLLLLLLLLLLLo',
  'oWW...oooo...WWo',
  'oWW..oRRRRo..WWo',
  'oWW.oRRRRRRo.WWo',
  'oWW.oooooooo.WWo',
  'oWW.oWWooWWo.WWo',
  'oWW.oWWWWWWo.WWo',
  'oWW..oWWWWo..WWo',
  'oWW...oooo...WWo',
  'oWWWWWWWWWWWWWWo',
  'oDDDDDDDDDDDDDDo',
  'oWDDWDDWDDWDDWWo',
  'oDDDDDDDDDDDDDDo',
  'oooooooooooooooo',
  '................',
];

const HEAL_MACHINE = [
  '................',
  '..oooooooooooo..',
  '..oWWWWWWWWWWo..',
  '..oWssssssssWo..',
  '..oWsSSSSSSsWo..',
  '..oWsSrrggSsWo..',
  '..oWsSSSSSSsWo..',
  '..oWssssssssWo..',
  '..oWWWWWWWWWWo..',
  '..oWRRWRRWRRWo..',
  '..oWrrWrrWrrWo..',
  '..oWWWWWWWWWWo..',
  '..oDDDDDDDDDDo..',
  '..oooooooooooo..',
  '................',
  '................',
];

const PC_DESK = [
  '................',
  '...oooooooooo...',
  '...oDDDDDDDDo...',
  '...oDssssssDo...',
  '...oDsSSSSsDo...',
  '...oDsSbbSsDo...',
  '...oDssssssDo...',
  '...oDDDDDDDDo...',
  '..ooooDDDDoooo..',
  '..oWWWWWWWWWWo..',
  '..oWWWWWWWWWWo..',
  '..oDDDDDDDDDDo..',
  '..oWo......oWo..',
  '..oWo......oWo..',
  '..ooo......ooo..',
  '................',
];

const STAIRS = [
  'oooooooooooooooo',
  'oLLLLLLLLLLLLLLo',
  'oWWWWWWWWWWWWWWo',
  'oooooooooooooooo',
  'oLLLLLLLLLLLLLLo',
  'oWWWWWWWWWWWWWWo',
  'oooooooooooooooo',
  'oLLLLLLLLLLLLLLo',
  'oWWWWWWWWWWWWWWo',
  'oooooooooooooooo',
  'oLLLLLLLLLLLLLLo',
  'oWWWWWWWWWWWWWWo',
  'oooooooooooooooo',
  'oLLLLLLLLLLLLLLo',
  'oWWWWWWWWWWWWWWo',
  'oooooooooooooooo',
];

const MAT = [
  '................',
  '.oooooooooooooo.',
  '.oRRRRRRRRRRRRo.',
  '.oRrrrrrrrrrRRo.',
  '.oRrLLLLLLLrRRo.',
  '.oRrLrrrrrLrRRo.',
  '.oRrLrrrrrLrRRo.',
  '.oRrLLLLLLLrRRo.',
  '.oRrrrrrrrrrRRo.',
  '.oRRRRRRRRRRRRo.',
  '.oooooooooooooo.',
  '................',
  '................',
  '................',
  '................',
  '................',
];

// ---------------------------------------------------------------------------
// Registro dei tile
// ---------------------------------------------------------------------------

const WOOD_LEGEND = {
  o: PAL.outline,
  D: PAL.woodDark,
  W: PAL.woodMid,
  L: PAL.woodLite,
  r: '#c0453f',
  g: '#5fae42',
  b: '#3d81d6',
  s: '#26303f',
  S: '#4a6d8a',
  c: '#e8e2d0',
  C: '#ffffff',
  p: '#c0453f',
  P: '#e07a70',
  G: '#3f8a3a',
  R: '#a8332f',
};

export const TILES: Record<string, TileDef> = {
  // --- terreni ---
  grass: { draw: (g, v) => drawGrass(g, v), variants: 5 },
  grassPlain: { draw: (g) => drawGrass(g, 0) },
  flowers: { draw: (g, v, f) => drawFlowers(g, v, f), variants: 3, frames: 2, frameRate: 34 },
  tallgrass: { draw: (g, v, f) => drawTallGrass(g, v, f), variants: 2, frames: 2, frameRate: 26, tag: 'tallgrass' },
  dirt: { draw: (g, v) => drawDirt(g, v), variants: 2 },
  sand: { draw: (g, v) => drawSand(g, v), variants: 2, tag: 'sand' },
  path: { draw: (g, v) => drawPathMask(g, v), variants: 16 },
  pathN: { draw: (g) => drawPathEdge(g, 0) },
  pathS: { draw: (g) => drawPathEdge(g, 1) },
  pathW: { draw: (g) => drawPathEdge(g, 2) },
  pathE: { draw: (g) => drawPathEdge(g, 3) },
  water: { draw: (g, v, f) => drawWater(g, v, f), frames: 4, frameRate: 12, solid: true, tag: 'water' },
  waterN: { draw: (g, _v, f) => drawWaterEdge(g, 0, f), frames: 4, frameRate: 12, solid: true, tag: 'water' },
  waterS: { draw: (g, _v, f) => drawWaterEdge(g, 1, f), frames: 4, frameRate: 12, solid: true, tag: 'water' },
  waterW: { draw: (g, _v, f) => drawWaterEdge(g, 2, f), frames: 4, frameRate: 12, solid: true, tag: 'water' },
  waterE: { draw: (g, _v, f) => drawWaterEdge(g, 3, f), frames: 4, frameRate: 12, solid: true, tag: 'water' },

  // --- ostacoli ---
  cliff: { draw: (g) => drawCliff(g, 0), solid: true },
  cliffTop: { draw: (g) => drawCliff(g, 1), solid: true },
  rock: { draw: (g, v) => drawRock(g, v), variants: 2, solid: true },
  bush: { draw: (g) => drawBush(g), solid: true },
  ledge: { draw: (g) => drawLedge(g), tag: 'ledge-down' },
  sign: { draw: (g) => drawSign(g), solid: true },
  fenceH: { draw: (g) => drawFence(g, 0), solid: true },
  fenceV: { draw: (g) => drawFence(g, 1), solid: true },

  // --- alberi (2x2) ---
  treeTL: { draw: (g) => drawTreeQuad(g, 0), solid: true, over: true },
  treeTR: { draw: (g) => drawTreeQuad(g, 1), solid: true, over: true },
  treeBL: { draw: (g) => drawTreeQuad(g, 2), solid: true },
  treeBR: { draw: (g) => drawTreeQuad(g, 3), solid: true },

  // --- edifici ---
  roofR: { draw: roofTile(PAL.roofRed, PAL.roofRedDark, PAL.roofRedLite), variants: 7, solid: true },
  roofB: { draw: roofTile(PAL.roofBlue, PAL.roofBlueDark, PAL.roofBlueLite), variants: 7, solid: true },
  roofG: { draw: roofTile(PAL.roofGreen, PAL.roofGreenDark, '#48a86a'), variants: 7, solid: true },
  wall: { draw: (g, v) => drawWall(g, v), variants: 5, solid: true },
  window: { draw: (g) => drawWall(g, 1), solid: true },
  wallL: { draw: (g) => drawWall(g, 2), solid: true },
  wallR: { draw: (g) => drawWall(g, 3), solid: true },
  wallBase: { draw: (g) => drawWall(g, 4), solid: true },
  door: { draw: (g) => drawDoor(g, 0), tag: 'door' },
  doorway: { draw: (g) => drawDoor(g, 1), tag: 'door' },

  // --- interni ---
  floorWood: { draw: (g) => drawFloor(g, 0) },
  floorTile: { draw: (g) => drawFloor(g, 1) },
  carpetR: { draw: (g) => drawCarpet(g, 0) },
  carpetB: { draw: (g) => drawCarpet(g, 1) },
  innerWall: { draw: (g, v) => drawInnerWall(g, v), variants: 3, solid: true },
  innerWallArt: { draw: (g) => drawInnerWall(g, 1), solid: true },
  innerWallBase: { draw: (g) => drawInnerWall(g, 2), solid: true },
  table: { draw: furniture(TABLE_TOP, WOOD_LEGEND), solid: true },
  bed: { draw: furniture(BED, WOOD_LEGEND), solid: true },
  shelf: { draw: furniture(BOOKSHELF, WOOD_LEGEND), solid: true },
  tv: { draw: furniture(TV, WOOD_LEGEND), solid: true },
  plant: { draw: furniture(PLANT, WOOD_LEGEND), solid: true },
  counter: { draw: furniture(COUNTER, WOOD_LEGEND, 1), solid: true },
  counterBall: { draw: furniture(COUNTER_BALL, WOOD_LEGEND, 1), solid: true },
  healMachine: { draw: furniture(HEAL_MACHINE, WOOD_LEGEND, 1), solid: true },
  pc: { draw: furniture(PC_DESK, WOOD_LEGEND, 1), solid: true },
  stairs: { draw: furniture(STAIRS, WOOD_LEGEND, 1) },
  mat: { draw: furniture(MAT, WOOD_LEGEND, 0) },
  matTile: { draw: furniture(MAT, WOOD_LEGEND, 1) },
  voidBlack: { draw: (g) => fill(g, '#0a0a12'), solid: true },
};

export type TileName = keyof typeof TILES;

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const cache = new Map<string, HTMLCanvasElement[][]>();

function build(name: string): HTMLCanvasElement[][] {
  const def = TILES[name];
  if (!def) throw new Error(`Tile sconosciuto: ${name}`);
  const variants = def.variants ?? 1;
  const frames = def.frames ?? 1;
  const out: HTMLCanvasElement[][] = [];
  for (let v = 0; v < variants; v++) {
    const row: HTMLCanvasElement[] = [];
    for (let f = 0; f < frames; f++) {
      const c = createCanvas(TILE, TILE);
      const g = ctx2d(c);
      def.draw(g, v, f);
      row.push(c);
    }
    out.push(row);
  }
  return out;
}

/** Pre-renderizza tutti i tile (chiamato una volta all'avvio). */
export function buildTileset(): void {
  for (const name of Object.keys(TILES)) {
    if (!cache.has(name)) cache.set(name, build(name));
  }
}

/** Immagine del tile per una data posizione e fotogramma globale. */
export function tileImage(
  name: string,
  wx: number,
  wy: number,
  globalFrame: number,
  variantOverride: number | null = null,
): HTMLCanvasElement {
  let entry = cache.get(name);
  if (!entry) {
    entry = build(name);
    cache.set(name, entry);
  }
  const def = TILES[name];
  const variants = entry.length;
  const v = variantOverride !== null
    ? Math.max(0, Math.min(variants - 1, variantOverride))
    : variants > 1 ? Math.floor(hash2(wx, wy, 3) * variants) % variants : 0;
  const frames = entry[v].length;
  if (frames <= 1) return entry[v][0];
  const rate = def.frameRate ?? 12;
  const f = Math.floor(globalFrame / rate) % frames;
  return entry[v][f];
}

export function isSolid(name: string | undefined): boolean {
  if (!name) return false;
  return TILES[name]?.solid === true;
}

export function tagOf(name: string | undefined): TileDef['tag'] | undefined {
  if (!name) return undefined;
  return TILES[name]?.tag;
}

export function isOver(name: string | undefined): boolean {
  if (!name) return false;
  return TILES[name]?.over === true;
}
