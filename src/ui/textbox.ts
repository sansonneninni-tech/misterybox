/** Finestra di dialogo con effetto macchina da scrivere e menu di scelta. */

import { SCREEN_H, SCREEN_W } from '../engine/const';
import type { Input } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { drawText, textWidth, wrapText } from '../gfx/font';
import { PAL } from '../gfx/palette';
import { dialogArrow, drawMenuItem, drawWindow, WIN_STYLE } from '../gfx/ui';

export const BOX_X = 6;
export const BOX_Y = 112;
export const BOX_W = SCREEN_W - 12;
export const BOX_H = 44;
const TEXT_X = BOX_X + 10;
const LINE_GAP = 14;
const MAX_LINES = 2;
const WRAP_W = BOX_W - 22;

export interface Choice {
  label: string;
  value: string;
}

export class Textbox {
  private pages: string[][] = [];
  private page = 0;
  private chars = 0;
  private speed = 1.4;
  private waiting = false;
  finished = true;
  /** Menu di scelta mostrato all'ultima pagina. */
  choices: Choice[] | null = null;
  choiceIndex = 0;
  choiceResult: string | null = null;
  /** Nome del parlante mostrato sopra la finestra. */
  speaker: string | null = null;
  private arrowTimer = 0;

  setText(lines: string[], opts: { speaker?: string | null; choices?: Choice[] | null } = {}): void {
    this.pages = [];
    for (const line of lines) {
      const wrapped = wrapText(line, WRAP_W);
      for (let i = 0; i < wrapped.length; i += MAX_LINES) {
        this.pages.push(wrapped.slice(i, i + MAX_LINES));
      }
    }
    if (this.pages.length === 0) this.pages.push(['']);
    this.page = 0;
    this.chars = 0;
    this.waiting = false;
    this.finished = false;
    this.speaker = opts.speaker ?? null;
    this.choices = opts.choices ?? null;
    this.choiceIndex = 0;
    this.choiceResult = null;
  }

  /** Testo istantaneo (usato nei log di battaglia rapidi). */
  showInstant(lines: string[]): void {
    this.setText(lines);
    this.chars = 9999;
    this.waiting = true;
  }

  get isLastPage(): boolean {
    return this.page >= this.pages.length - 1;
  }

  get showingChoices(): boolean {
    return this.choices !== null && this.waiting && this.isLastPage;
  }

  private totalChars(): number {
    return this.pages[this.page].reduce((n, l) => n + l.length, 0);
  }

  /** Ritorna true quando il dialogo e' concluso. */
  update(input: Input): boolean {
    if (this.finished) return true;
    this.arrowTimer++;

    if (!this.waiting) {
      this.chars += this.speed * (input.isDown('a') || input.isDown('b') ? 3 : 1);
      if (this.chars >= this.totalChars()) {
        this.chars = this.totalChars();
        this.waiting = true;
      }
      if (input.pressed('a') || input.pressed('b')) {
        this.chars = this.totalChars();
        this.waiting = true;
        return false;
      }
      return false;
    }

    if (this.showingChoices) {
      const n = this.choices!.length;
      if (input.repeat('up')) this.choiceIndex = (this.choiceIndex - 1 + n) % n;
      if (input.repeat('down')) this.choiceIndex = (this.choiceIndex + 1) % n;
      if (input.pressed('a')) {
        this.choiceResult = this.choices![this.choiceIndex].value;
        this.finished = true;
        return true;
      }
      if (input.pressed('b') && n === 2) {
        // Il tasto annulla seleziona la seconda voce (di norma "No").
        this.choiceIndex = n - 1;
        this.choiceResult = this.choices![n - 1].value;
        this.finished = true;
        return true;
      }
      return false;
    }

    if (input.pressed('a')) {
      if (this.isLastPage) {
        this.finished = true;
        return true;
      }
      this.page++;
      this.chars = 0;
      this.waiting = false;
    }
    return false;
  }

  render(r: Renderer, opts: { y?: number } = {}): void {
    const g = r.ctx;
    const y = opts.y ?? BOX_Y;
    drawWindow(g, BOX_X, y, BOX_W, BOX_H, WIN_STYLE);

    if (this.speaker) {
      const w = textWidth(this.speaker) + 12;
      drawWindow(g, BOX_X + 4, y - 12, w, 15, WIN_STYLE);
      drawText(g, this.speaker, BOX_X + 10, y - 8, { color: PAL.uiText, shadow: PAL.uiTextShadow });
    }

    const lines = this.pages[this.page] ?? [''];
    let budget = Math.floor(this.chars);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const show = Math.max(0, Math.min(line.length, budget));
      drawText(g, line, TEXT_X, y + 9 + i * LINE_GAP - (y === BOX_Y ? 0 : 0), {
        color: PAL.uiText, shadow: PAL.uiTextShadow, max: show,
      });
      budget -= line.length;
    }

    if (this.showingChoices) {
      const items = this.choices!;
      const w = Math.max(...items.map((c) => textWidth(c.label))) + 24;
      const h = items.length * 14 + 10;
      const cx = SCREEN_W - w - 8;
      const cy = y - h - 4;
      drawWindow(g, cx, cy, w, h, WIN_STYLE);
      for (let i = 0; i < items.length; i++) {
        drawMenuItem(g, items[i].label, cx + 14, cy + 6 + i * 14, i === this.choiceIndex);
      }
    } else if (this.waiting && Math.floor(this.arrowTimer / 18) % 2 === 0) {
      g.drawImage(dialogArrow(), BOX_X + BOX_W - 14, y + BOX_H - 12);
    }
  }
}

/** Riquadro informativo generico centrato (usato per messaggi brevi). */
export function drawInfoBox(r: Renderer, lines: string[]): void {
  const g = r.ctx;
  const w = Math.max(...lines.map((l) => textWidth(l))) + 24;
  const h = lines.length * 12 + 16;
  const x = Math.round((SCREEN_W - w) / 2);
  const y = Math.round((SCREEN_H - h) / 2);
  drawWindow(g, x, y, w, h);
  for (let i = 0; i < lines.length; i++) {
    drawText(g, lines[i], x + 12, y + 8 + i * 12, { color: PAL.uiText, shadow: PAL.uiTextShadow });
  }
}
