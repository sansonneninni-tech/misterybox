/**
 * Finale: nero, le cicale che continuano, poi il nome. Nessuna spiegazione.
 * Alla fine si puo' ricominciare.
 */

import { SCREEN_H, SCREEN_W } from '../engine/const';
import { createCanvas, ctx2d, type Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';
import { drawTextCentered, textWidth } from '../gfx/font';
import { P } from '../gfx/palette';
import { TitleScene } from './title';

function bigText(text: string, color: string, scale: number): HTMLCanvasElement {
  const w = textWidth(text) + 2;
  const src = createCanvas(w, 10);
  drawTextCentered(ctx2d(src), text, w / 2, 0, { color, shadow: null });
  const out = createCanvas(w * scale, 10 * scale);
  const g = ctx2d(out);
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, w, 10, 0, 0, w * scale, 10 * scale);
  return out;
}

/** Tempi dei titoli, in secondi dall'inizio della scena. */
const T_NAME = 3.2;
const T_SUB = 5.4;
const T_END = 8.4;
const T_AGAIN = 10.4;

export class EndingScene extends Scene {
  override readonly name = 'ending';

  private t = 0;
  private leaving = false;
  private logo: HTMLCanvasElement | null = null;
  private end: HTMLCanvasElement | null = null;

  override enter(): void {
    this.logo = bigText('MAZZO', P.paper, 3);
    this.end = bigText('FINE', '#c9b998', 2);
    this.game.state.level3.finished = true;
    // L'ambiente della strada continua sul nero: le cicale non sanno che e' finita.
    this.game.audio.setAmbience('street');
  }

  override update(dt: number): void {
    this.t += dt;
    if (this.leaving) return;
    if (this.t > T_AGAIN && this.game.input.pressed('act')) {
      this.leaving = true;
      this.game.transitionTo(() => new TitleScene(), 0.8, 0.5);
    }
  }

  private alpha(from: number): number {
    return Math.max(0, Math.min(1, (this.t - from) / 1.4));
  }

  override render(r: Renderer): void {
    const g = r.ctx;
    r.clear('#05060a');

    if (this.t > T_NAME && this.logo) {
      g.save();
      g.globalAlpha = this.alpha(T_NAME);
      g.drawImage(this.logo, Math.round((SCREEN_W - this.logo.width) / 2), 46);
      g.restore();
    }
    if (this.t > T_SUB) {
      g.save();
      g.globalAlpha = this.alpha(T_SUB);
      drawTextCentered(g, 'una giornata qualsiasi', SCREEN_W / 2, 84, { color: '#8b7f6c', shadow: null });
      g.restore();
    }
    if (this.t > T_END && this.end) {
      g.save();
      g.globalAlpha = this.alpha(T_END);
      g.drawImage(this.end, Math.round((SCREEN_W - this.end.width) / 2), SCREEN_H - 52);
      g.restore();
    }
    if (this.t > T_AGAIN && this.t % 1.2 < 0.85) {
      drawTextCentered(g, 'RIGIOCA', SCREEN_W / 2, SCREEN_H - 20, { color: '#7a6e5c', shadow: null });
    }
  }
}
