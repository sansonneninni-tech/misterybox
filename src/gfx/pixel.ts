/**
 * Utility per disegnare pixel art da "mappe di caratteri".
 * Ogni sprite e' definito come array di stringhe: un carattere = un pixel,
 * '.' e ' ' sono trasparenti. La legenda associa i caratteri ai colori.
 */

import { createCanvas, ctx2d } from '../engine/renderer';

export type Legend = Record<string, string | null>;

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

/** Silhouette monocromatica (usata per l'apparizione delle creature). */
export function silhouette(src: HTMLCanvasElement, color = '#000000'): HTMLCanvasElement {
  return tint(src, color);
}
