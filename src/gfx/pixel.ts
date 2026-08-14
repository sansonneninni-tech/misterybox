/**
 * Utility per disegnare pixel art da "mappe di caratteri".
 * Ogni sprite e' definito come array di stringhe: un carattere = un pixel,
 * '.' e ' ' sono trasparenti. La legenda associa i caratteri ai colori.
 */

import { createCanvas, ctx2d } from '../engine/renderer';

export type Legend = Record<string, string | null>;

export interface SpriteOpts {
  /** Colore contorno automatico attorno ai pixel opachi. */
  outline?: string | null;
  /** Scala intera. */
  scale?: number;
}

/** Costruisce un canvas da una mappa di caratteri. */
export function makeSprite(rows: readonly string[], legend: Legend, opts: SpriteOpts = {}): HTMLCanvasElement {
  const scale = opts.scale ?? 1;
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const pad = opts.outline ? 1 : 0;
  const c = createCanvas((w + pad * 2) * scale, (h + pad * 2) * scale);
  const g = ctx2d(c);

  const px = (x: number, y: number, color: string) => {
    g.fillStyle = color;
    g.fillRect((x + pad) * scale, (y + pad) * scale, scale, scale);
  };

  if (opts.outline) {
    const solid = (x: number, y: number) => {
      if (y < 0 || y >= h || x < 0) return false;
      const ch = rows[y][x];
      if (ch === undefined) return false;
      const col = legend[ch];
      return col !== undefined && col !== null && ch !== '.' && ch !== ' ';
    };
    for (let y = -1; y <= h; y++) {
      for (let x = -1; x <= w; x++) {
        if (solid(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
          px(x, y, opts.outline);
        }
      }
    }
  }

  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = legend[ch];
      if (!col) continue;
      px(x, y, col);
    }
  }
  return c;
}

/** Disegna una mappa di caratteri direttamente in un contesto. */
export function stamp(
  g: CanvasRenderingContext2D,
  rows: readonly string[],
  legend: Legend,
  ox: number,
  oy: number,
): void {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = legend[ch];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

/** Copia tinta di un canvas (mantiene l'alpha, sostituisce il colore). */
export function tint(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = createCanvas(src.width, src.height);
  const g = ctx2d(c);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Copia di un canvas ribaltata orizzontalmente. */
export function flipX(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = createCanvas(src.width, src.height);
  const g = ctx2d(c);
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

/** Ritaglia una porzione. */
export function slice(src: HTMLCanvasElement, x: number, y: number, w: number, h: number): HTMLCanvasElement {
  const c = createCanvas(w, h);
  ctx2d(c).drawImage(src, x, y, w, h, 0, 0, w, h);
  return c;
}

/** Silhouette monocromatica (usata per l'apparizione delle creature). */
export function silhouette(src: HTMLCanvasElement, color = '#000000'): HTMLCanvasElement {
  return tint(src, color);
}

/** Versione schiarita (flash bianco quando una creatura subisce danno). */
export function flash(src: HTMLCanvasElement, alpha = 0.7, color = '#ffffff'): HTMLCanvasElement {
  const c = createCanvas(src.width, src.height);
  const g = ctx2d(c);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Ingrandisce di un fattore intero senza interpolazione. */
export function upscale(src: HTMLCanvasElement, k: number): HTMLCanvasElement {
  const c = createCanvas(src.width * k, src.height * k);
  const g = ctx2d(c);
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, src.width, src.height, 0, 0, c.width, c.height);
  return c;
}
