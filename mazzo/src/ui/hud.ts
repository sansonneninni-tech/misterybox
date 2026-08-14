/**
 * Interfaccia: riquadro dei dialoghi, obiettivo corrente, oggetto in mano,
 * scritte al centro. Tutto disegnato dentro lo schermo virtuale, niente HTML.
 */

import { SCREEN_H, SCREEN_W } from '../engine/const';
import type { Renderer } from '../engine/renderer';
import { drawText, drawTextCentered, textWidth, wrapText } from '../gfx/font';
import { P } from '../gfx/palette';
import type { ActiveLine } from '../systems/dialogue';

const BOX_X = 6;
const BOX_W = SCREEN_W - 12;
const BOX_H = 46;
const BOX_Y = SCREEN_H - BOX_H - 6;

function panel(r: Renderer, x: number, y: number, w: number, h: number): void {
  r.rect(x + 1, y + 1, w, h, 'rgba(20,16,12,0.35)');
  r.rect(x, y, w, h, P.boxFill);
  r.outline(x, y, w, h, P.boxEdge);
  r.rect(x + 1, y + h - 2, w - 2, 1, P.boxShade);
}

/** Riquadro dei dialoghi con l'effetto macchina da scrivere. */
export function drawDialogue(r: Renderer, line: ActiveLine, blink: number): void {
  panel(r, BOX_X, BOX_Y, BOX_W, BOX_H);
  const g = r.ctx;

  let textY = BOX_Y + 8;
  if (line.who) {
    const w = textWidth(line.who) + 8;
    r.rect(BOX_X + 6, BOX_Y - 7, w, 10, P.boxFill);
    r.outline(BOX_X + 6, BOX_Y - 7, w, 10, P.boxEdge);
    drawText(g, line.who, BOX_X + 10, BOX_Y - 6, { color: P.boxEdge, shadow: null });
  }

  const lines = wrapText(line.text, BOX_W - 20);
  // Quante lettere restano da mostrare, riga per riga.
  let budget = line.shown;
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    const text = lines[i];
    const max = Math.max(0, Math.min(text.length, budget));
    drawText(g, text, BOX_X + 10, textY + i * 12, { color: P.inkSoft, shadow: null, max });
    budget -= text.length + 1;
  }

  if (line.done && blink % 1 < 0.6) {
    drawText(g, '▼', BOX_X + BOX_W - 14, BOX_Y + BOX_H - 12, { color: P.boxEdge, shadow: null });
  }
}

/** Obiettivo corrente, in alto a sinistra. */
export function drawObjective(r: Renderer, text: string): void {
  if (!text) return;
  const w = textWidth(text) + 10;
  r.rect(4, 4, w, 12, P.hudFill);
  drawText(r.ctx, text, 9, 6, { color: P.hudInk, shadow: null });
}

/** Oggetto in mano, in alto a destra. */
export function drawCarry(r: Renderer, label: string): void {
  const w = textWidth(label) + 18;
  const x = SCREEN_W - w - 4;
  r.rect(x, 4, w, 12, P.hudFill);
  r.rect(x + 5, 8, 5, 5, P.paper);
  r.outline(x + 5, 8, 5, 5, '#2c2620');
  drawText(r.ctx, label, x + 13, 6, { color: P.hudInk, shadow: null });
}

/** Scritta al centro dello schermo: titoli di livello e momenti fermi. */
export function drawCaption(r: Renderer, text: string, alpha: number): void {
  if (alpha <= 0) return;
  const g = r.ctx;
  g.save();
  g.globalAlpha = Math.min(1, alpha);
  r.rect(0, SCREEN_H / 2 - 14, SCREEN_W, 28, 'rgba(16,12,10,0.72)');
  drawTextCentered(g, text, SCREEN_W / 2, SCREEN_H / 2 - 4, { color: P.paper, shadow: null });
  g.restore();
}

/** Piccolo suggerimento sopra la testa quando c'e' qualcosa da esaminare. */
export function drawHint(r: Renderer, x: number, y: number, t: number): void {
  const off = Math.sin(t * 4) > 0 ? 0 : 1;
  r.rect(x - 4, y - off, 9, 9, P.hudFill);
  drawText(r.ctx, 'E', x - 1, y + 1 - off, { color: P.hudInk, shadow: null });
}

export const HUD_LAYOUT = { BOX_X, BOX_Y, BOX_W, BOX_H };
