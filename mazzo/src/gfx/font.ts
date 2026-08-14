/**
 * Font bitmap originale a larghezza variabile (altezza 8, maiuscole 6px).
 * Ogni glifo e' descritto riga per riga: '#' pixel pieno, '.' trasparente.
 * Le righe 0-5 sono sopra la linea di base, 6-7 servono ai discendenti.
 */

import { createCanvas, ctx2d } from '../engine/renderer';

export const GLYPH_H = 8;

const G: Record<string, string> = {
  ' ': '..',
  // --- Maiuscole (righe 0-5) ---
  A: '.###./#...#/#...#/#####/#...#/#...#',
  B: '####./#...#/####./#...#/#...#/####.',
  C: '.###./#...#/#..../#..../#...#/.###.',
  D: '####./#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../####./#..../#..../#####',
  F: '#####/#..../####./#..../#..../#....',
  G: '.###./#..../#..../#..##/#...#/.###.',
  H: '#...#/#...#/#####/#...#/#...#/#...#',
  I: '###/.#./.#./.#./.#./###',
  J: '..###/....#/....#/....#/#...#/.###.',
  K: '#...#/#..#./###../#..#./#..#./#...#',
  L: '#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#...#/#...#/#...#',
  N: '#...#/##..#/#.#.#/#..##/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/.###.',
  P: '####./#...#/#...#/####./#..../#....',
  Q: '.###./#...#/#...#/#.#.#/#..#./.##.#',
  R: '####./#...#/#...#/####./#..#./#...#',
  S: '.####/#..../.###./....#/....#/####.',
  T: '#####/..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/.###.',
  V: '#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/##.##/#...#',
  X: '#...#/.#.#./..#../..#../.#.#./#...#',
  Y: '#...#/.#.#./..#../..#../..#../..#..',
  Z: '#####/...#./..#../.#.../#..../#####',

  // --- Minuscole (corpo righe 1-5) ---
  a: './.##./...#/.###/#..#/.###',
  b: '#.../#.../###./#..#/#..#/###.',
  c: './.##./#.../#.../#.../.##.',
  d: '...#/...#/.###/#..#/#..#/.###',
  e: './.##./#..#/####/#.../.###',
  f: '.##/.#./###/.#./.#./.#.',
  g: './.###/#..#/#..#/.###/...#/...#/###.',
  h: '#.../#.../###./#..#/#..#/#..#',
  i: '#/./#/#/#/#',
  j: '.#/../.#/.#/.#/.#/.#/##',
  k: '#.../#..#/#.#./##../#.#./#..#',
  l: '##./.#./.#./.#./.#./.##',
  m: './#####/#.#.#/#.#.#/#.#.#/#.#.#',
  n: './###./#..#/#..#/#..#/#..#',
  o: './.##./#..#/#..#/#..#/.##.',
  p: './###./#..#/#..#/###./#.../#...',
  q: './.###/#..#/#..#/.###/...#/...#',
  r: './#.#/##./#../#../#..',
  s: './.###/#.../.##./...#/###.',
  t: '.#./.#./###/.#./.#./.##',
  u: './#..#/#..#/#..#/#..#/.###',
  v: './#...#/#...#/.#.#./.#.#./..#..',
  w: './#...#/#...#/#.#.#/#.#.#/.#.#.',
  x: './#...#/.#.#./..#../.#.#./#...#',
  y: './#..#/#..#/#..#/.###/...#/...#/###.',
  z: './####/..#./.#../#.../####',

  // --- Cifre ---
  '0': '.##./#..#/#.##/##.#/#..#/.##.',
  '1': '.#./##./.#./.#./.#./###',
  '2': '.##./#..#/...#/..#./.#../####',
  '3': '###./...#/.##./...#/...#/###.',
  '4': '..#./.##./#.#./####/..#./..#.',
  '5': '####/#.../###./...#/...#/###.',
  '6': '.##./#.../###./#..#/#..#/.##.',
  '7': '####/...#/..#./..#./.#../.#..',
  '8': '.##./#..#/.##./#..#/#..#/.##.',
  '9': '.##./#..#/#..#/.###/...#/.##.',

  // --- Punteggiatura e simboli ---
  '.': './././././#',
  ',': './././././.#/#.',
  '!': '#/#/#/#/./#',
  '?': '.##./#..#/...#/..#./..../..#.',
  ':': './/#///#',
  ';': './/#///.#/#.',
  "'": '#/#',
  '"': '#.#/#.#',
  '-': '///###',
  '_': '././././././####',
  '+': '//.#./###/.#.',
  '=': '//####//####',
  '/': '...#/..#./..#./.#../.#../#...',
  '\\': '#.../.#../.#../..#./..#./...#',
  '(': '.#/#./#./#./#./.#',
  ')': '#./.#/.#/.#/.#/#.',
  '[': '##/#./#./#./#./##',
  ']': '##/.#/.#/.#/.#/##',
  '<': '..#/.#./#../.#./..#',
  '>': '#../.#./..#/.#./#..',
  '%': '#..#/#..#/...#/..#./.#../#..#',
  '*': '//#.#/.#./#.#',
  '#': '.#.#./#####/.#.#./#####/.#.#.',
  '&': '.##./#..#/.##./#.#./#..#/.###',
  '@': '.###./#...#/#.###/#.#.#/#..../.###.',
  '~': '///.##.#/#.##.',
  '$': '..#../.####/#.#../.###./..#.#/####./..#..',
  '|': '#/#/#/#/#/#',
  '^': '/..#../.#.#./#...#',
  '·': '///#',
  '¥': '#...#/.#.#./..#../.###./..#../.###.',

  // --- Lettere accentate italiane ---
  à: '..#./.##./...#/.###/#..#/.###',
  è: '.#../.##./#..#/####/#.../.###',
  é: '..#./.##./#..#/####/#.../.###',
  ì: '#./.#/.#/.#/.#/.#',
  ò: '..#../.##./#..#/#..#/#..#/.##.',
  ù: '..#./#..#/#..#/#..#/#..#/.###',
  È: '.#.../#####/#..../####./#..../#####',
  À: '..#../.###./#...#/#####/#...#/#...#',

  // --- Icone di gioco ---
  '♂': '..###/....#/..###/.##../#..#./.##..',
  '♀': '.###./#...#/.###./..#../.###./..#..',
  '★': '/..#../.###./#####/.###./#...#',
  '►': '/#..../##.../###../##.../#....',
  '▶': '/#..../##.../###../##.../#....',
  '◀': '/....#/...##/..###/...##/....#',
  '▲': '/..#../.###./#####',
  '↕': '..#../.###./#####/..#../#####/.###./..#..',
  '▼': '///#####/.###./..#..',
  '…': '/////#.#.#',
};

interface GlyphInfo {
  x: number;
  w: number;
}

let atlas: HTMLCanvasElement | null = null;
const glyphInfo = new Map<string, GlyphInfo>();
const tintCache = new Map<string, HTMLCanvasElement>();

function parseGlyph(spec: string): string[] {
  const rows = spec.split('/');
  const out: string[] = [];
  for (let i = 0; i < GLYPH_H; i++) out.push(rows[i] ?? '');
  return out;
}

function buildAtlas(): void {
  const entries = Object.entries(G);
  let total = 0;
  const parsed: Array<[string, string[], number]> = [];
  for (const [ch, spec] of entries) {
    const rows = parseGlyph(spec);
    const w = Math.max(1, rows.reduce((m, r) => Math.max(m, r.length), 0));
    parsed.push([ch, rows, w]);
    total += w + 1;
  }
  const c = createCanvas(total, GLYPH_H);
  const g = ctx2d(c);
  g.fillStyle = '#ffffff';
  let x = 0;
  for (const [ch, rows, w] of parsed) {
    for (let y = 0; y < GLYPH_H; y++) {
      const row = rows[y];
      for (let i = 0; i < row.length; i++) {
        if (row[i] === '#') g.fillRect(x + i, y, 1, 1);
      }
    }
    glyphInfo.set(ch, { x, w });
    x += w + 1;
  }
  atlas = c;
}

function getAtlas(): HTMLCanvasElement {
  if (!atlas) buildAtlas();
  return atlas!;
}

function tinted(color: string): HTMLCanvasElement {
  const hit = tintCache.get(color);
  if (hit) return hit;
  const a = getAtlas();
  const c = createCanvas(a.width, a.height);
  const g = ctx2d(c);
  g.drawImage(a, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  tintCache.set(color, c);
  return c;
}

/** Spazio orizzontale occupato da un carattere (glifo + 1px). */
export function charWidth(ch: string): number {
  if (!atlas) buildAtlas();
  const gi = glyphInfo.get(ch) ?? glyphInfo.get('?')!;
  return gi.w + 1;
}

export function textWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch);
  return w > 0 ? w - 1 : 0;
}

export interface TextOpts {
  color?: string;
  shadow?: string | null;
  /** Numero di caratteri da mostrare (per l'effetto macchina da scrivere). */
  max?: number;
}

/** Disegna una riga di testo. Ritorna la larghezza disegnata. */
export function drawText(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: TextOpts = {},
): number {
  const color = opts.color ?? '#2a2c38';
  const shadow = opts.shadow === undefined ? '#b6bcca' : opts.shadow;
  const limit = opts.max ?? Infinity;
  if (!atlas) buildAtlas();
  const src = tinted(color);
  const srcShadow = shadow ? tinted(shadow) : null;

  let cx = 0;
  let n = 0;
  for (const ch of text) {
    if (n >= limit) break;
    const gi = glyphInfo.get(ch) ?? glyphInfo.get('?')!;
    if (srcShadow) g.drawImage(srcShadow, gi.x, 0, gi.w, GLYPH_H, (x + cx + 1) | 0, (y + 1) | 0, gi.w, GLYPH_H);
    g.drawImage(src, gi.x, 0, gi.w, GLYPH_H, (x + cx) | 0, y | 0, gi.w, GLYPH_H);
    cx += gi.w + 1;
    n++;
  }
  return cx > 0 ? cx - 1 : 0;
}

/** Testo centrato in una larghezza data. */
export function drawTextCentered(
  g: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  opts: TextOpts = {},
): void {
  drawText(g, text, Math.round(cx - textWidth(text) / 2), y, opts);
}

/** Testo allineato a destra. */
export function drawTextRight(
  g: CanvasRenderingContext2D,
  text: string,
  right: number,
  y: number,
  opts: TextOpts = {},
): void {
  drawText(g, text, Math.round(right - textWidth(text)), y, opts);
}

/** Manda a capo un testo entro una larghezza massima in pixel. */
export function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (textWidth(test) <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}
