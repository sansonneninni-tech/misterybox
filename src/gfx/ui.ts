/** Elementi di interfaccia: cornici, barre, cursori, icone. */

import { createCanvas, ctx2d } from '../engine/renderer';
import { drawText, textWidth } from './font';
import { PAL } from './palette';
import { stamp } from './pixel';

export interface WindowStyle {
  bg: string;
  border: string;
  borderLite: string;
  shadow: string;
}

export const WIN_STYLE: WindowStyle = {
  bg: '#f8f8f8',
  border: '#384a6e',
  borderLite: '#8fa8d8',
  shadow: '#b8c0d0',
};

export const WIN_BLUE: WindowStyle = {
  bg: '#e4ecfa',
  border: '#2b3d63',
  borderLite: '#7c9ad4',
  shadow: '#aab6cc',
};

/** Cornice in stile console portatile: doppio bordo e angoli smussati. */
export function drawWindow(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  style: WindowStyle = WIN_STYLE,
): void {
  x |= 0; y |= 0; w |= 0; h |= 0;
  // Ombra esterna.
  g.fillStyle = style.shadow;
  g.fillRect(x + 2, y + h, w - 2, 1);
  g.fillRect(x + w, y + 2, 1, h - 2);
  // Sfondo.
  g.fillStyle = style.bg;
  g.fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillRect(x + 2, y, w - 4, 1);
  g.fillRect(x + 2, y + h - 1, w - 4, 1);
  g.fillRect(x, y + 2, 1, h - 4);
  g.fillRect(x + w - 1, y + 2, 1, h - 4);
  // Bordo esterno.
  g.fillStyle = style.border;
  g.fillRect(x + 2, y, w - 4, 1);
  g.fillRect(x + 2, y + h - 1, w - 4, 1);
  g.fillRect(x, y + 2, 1, h - 4);
  g.fillRect(x + w - 1, y + 2, 1, h - 4);
  g.fillRect(x + 1, y + 1, 1, 1);
  g.fillRect(x + w - 2, y + 1, 1, 1);
  g.fillRect(x + 1, y + h - 2, 1, 1);
  g.fillRect(x + w - 2, y + h - 2, 1, 1);
  // Bordo interno chiaro.
  g.fillStyle = style.borderLite;
  g.fillRect(x + 2, y + 1, w - 4, 1);
  g.fillRect(x + 2, y + h - 2, w - 4, 1);
  g.fillRect(x + 1, y + 2, 1, h - 4);
  g.fillRect(x + w - 2, y + 2, 1, h - 4);
}

/** Barra dei PS/PE con contorno. */
export function drawBar(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  ratio: number,
  color: string,
  opts: { height?: number; bg?: string; frame?: boolean } = {},
): void {
  const h = opts.height ?? 3;
  const bg = opts.bg ?? '#484858';
  ratio = Math.max(0, Math.min(1, ratio));
  if (opts.frame !== false) {
    g.fillStyle = '#20242e';
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
  }
  g.fillStyle = bg;
  g.fillRect(x, y, w, h);
  const fw = Math.max(ratio > 0 ? 1 : 0, Math.round(w * ratio));
  g.fillStyle = color;
  g.fillRect(x, y, fw, h);
  // Lucidatura.
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(x, y, fw, 1);
}

export function hpColor(ratio: number): string {
  if (ratio > 0.5) return PAL.hpGreen;
  if (ratio > 0.2) return PAL.hpYellow;
  return PAL.hpRed;
}

let cursorSprite: HTMLCanvasElement | null = null;
export function menuCursor(): HTMLCanvasElement {
  if (cursorSprite) return cursorSprite;
  const c = createCanvas(6, 8);
  const g = ctx2d(c);
  stamp(g, [
    'o.....',
    'oo....',
    'oOo...',
    'oOOo..',
    'oOOo..',
    'oOo...',
    'oo....',
    'o.....',
  ], { o: '#2b3d63', O: '#e05a4a' }, 0, 0);
  cursorSprite = c;
  return c;
}

let downArrow: HTMLCanvasElement | null = null;
export function dialogArrow(): HTMLCanvasElement {
  if (downArrow) return downArrow;
  const c = createCanvas(7, 5);
  const g = ctx2d(c);
  stamp(g, [
    'ooooooo',
    'oOOOOOo',
    '.oOOOo.',
    '..oOo..',
    '...o...',
  ], { o: '#2b3d63', O: '#7c9ad4' }, 0, 0);
  downArrow = c;
  return c;
}

/** Voce di menu con cursore opzionale. */
export function drawMenuItem(
  g: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  selected: boolean,
  opts: { color?: string; disabled?: boolean } = {},
): void {
  if (selected) g.drawImage(menuCursor(), x - 7, y);
  const color = opts.disabled ? '#9aa0b0' : opts.color ?? PAL.uiText;
  drawText(g, label, x, y, { color, shadow: PAL.uiTextShadow });
}

/** Etichetta con sfondo pieno (tipi elementali, categorie). */
export function drawTag(
  g: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  color: string,
): number {
  const w = textWidth(label) + 6;
  g.fillStyle = '#20242e';
  g.fillRect(x, y, w, 10);
  g.fillStyle = color;
  g.fillRect(x + 1, y + 1, w - 2, 8);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(x + 1, y + 1, w - 2, 1);
  drawText(g, label, x + 3, y + 1, { color: '#ffffff', shadow: 'rgba(0,0,0,0.55)' });
  return w;
}

/** Icone degli oggetti (16x16). */
const ITEM_ICONS: Record<string, string[]> = {
  ball: [
    '................',
    '.....oooooo.....',
    '...ooRRRRRRoo...',
    '..oRRRRRRRRRRo..',
    '..oRRRRRRRRRRo..',
    '.oRRRRRRRRRRRRo.',
    '.oRRRRRRRRRRRRo.',
    '.ooooooWWoooooo.',
    '.oWWWWoWWoWWWWo.',
    '.oWWWWWooWWWWWo.',
    '..oWWWWWWWWWWo..',
    '..oWWWWWWWWWWo..',
    '...ooWWWWWWoo...',
    '.....oooooo.....',
    '................',
    '................',
  ],
  potion: [
    '................',
    '......oooo......',
    '......oWWo......',
    '......oWWo......',
    '.....oooooo.....',
    '....ooCCCCoo....',
    '....oCCCCCCo....',
    '....oCggggCo....',
    '....oCggggCo....',
    '....oCggggCo....',
    '....oCggggCo....',
    '....oCggggCo....',
    '....ooCCCCoo....',
    '.....oooooo.....',
    '................',
    '................',
  ],
  antidote: [
    '................',
    '......oooo......',
    '......oWWo......',
    '.....oooooo.....',
    '....ooCCCCoo....',
    '....oCCCCCCo....',
    '....oCppppCo....',
    '....oCppppCo....',
    '....oCppppCo....',
    '....oCppppCo....',
    '....ooCCCCoo....',
    '.....oooooo.....',
    '................',
    '................',
    '................',
    '................',
  ],
  candy: [
    '................',
    '................',
    '...oo......oo...',
    '..oYYo....oYYo..',
    '..oYYYooooYYYo..',
    '...oYRRRRRRYo...',
    '....oRRRRRRo....',
    '....oRWWWWRo....',
    '....oRRRRRRo....',
    '...oYRRRRRRYo...',
    '..oYYYooooYYYo..',
    '..oYYo....oYYo..',
    '...oo......oo...',
    '................',
    '................',
    '................',
  ],
  key: [
    '................',
    '................',
    '....oooo........',
    '...oYYYYo.......',
    '..oYYooYYo......',
    '..oYo..oYo......',
    '..oYYooYYo......',
    '...oYYYYYo......',
    '....oYYYYYo.....',
    '.....ooYYYYo....',
    '.......oYYYYo...',
    '........oYoYYo..',
    '.........oYoYo..',
    '..........ooo...',
    '................',
    '................',
  ],
  repel: [
    '................',
    '.......oo.......',
    '......oWWo......',
    '......oWWo......',
    '.....oooooo.....',
    '....oCCCCCCo....',
    '....oCbbbbCo....',
    '....oCbWWbCo....',
    '....oCbbbbCo....',
    '....oCbbbbCo....',
    '....oCCCCCCo....',
    '.....oooooo.....',
    '................',
    '................',
    '................',
    '................',
  ],
};

const ITEM_LEGEND: Record<string, string | null> = {
  o: PAL.outline,
  R: '#dc4a3c',
  W: '#f4f4f8',
  C: '#c8d8e8',
  g: '#f0a83f',
  p: '#a052a8',
  Y: '#e8c33f',
  b: '#4a7fd0',
};

const iconCache = new Map<string, HTMLCanvasElement>();

export function itemIcon(kind: string): HTMLCanvasElement {
  const hit = iconCache.get(kind);
  if (hit) return hit;
  const rows = ITEM_ICONS[kind] ?? ITEM_ICONS.potion;
  const c = createCanvas(16, 16);
  stamp(ctx2d(c), rows, ITEM_LEGEND, 0, 0);
  iconCache.set(kind, c);
  return c;
}

/** Sfera da lancio animata (cattura). */
export function ballSprite(frame: number): HTMLCanvasElement {
  const key = `ballfx${frame}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const c = createCanvas(10, 10);
  const g = ctx2d(c);
  const rows = frame === 0
    ? [
        '..oooo..',
        '.oRRRRo.',
        'oRRRRRRo',
        'oooooooo',
        'oWWooWWo',
        'oWWWWWWo',
        '.oWWWWo.',
        '..oooo..',
      ]
    : [
        '..oooo..',
        '.oRRRRo.',
        'oRRYYRRo',
        'ooYYYYoo',
        'oWYYYYWo',
        'oWWWWWWo',
        '.oWWWWo.',
        '..oooo..',
      ];
  stamp(g, rows, ITEM_LEGEND, 1, 1);
  iconCache.set(key, c);
  return c;
}
