/** Utilita' per disegnare pixel art da griglie di caratteri. */

import { createCanvas, ctx2d } from '../engine/renderer';

/**
 * Costruisce un canvas da una griglia di caratteri.
 * Ogni carattere e' una chiave della mappa colori; '.' (o chiave assente)
 * lascia il pixel trasparente.
 */
export function fromGrid(rows: string[], colors: Record<string, string>): HTMLCanvasElement {
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const c = createCanvas(w, h);
  const g = ctx2d(c);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const col = colors[row[x]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

/** Copia speculare orizzontale (per ricavare il profilo destro dal sinistro). */
export function mirror(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = createCanvas(src.width, src.height);
  const g = ctx2d(c);
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}
