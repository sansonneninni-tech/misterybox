/** Schermata iniziale: nome, comandi, NUOVA PARTITA. */

import { SCREEN_H, SCREEN_W } from '../engine/const';
import { createCanvas, ctx2d, type Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';
import { drawTextCentered, textWidth } from '../gfx/font';
import { P } from '../gfx/palette';
import { newGameState } from '../systems/state';
import { makeScene } from './world';

/** Scritta ingrandita a numeri interi: resta pixel perfetta. */
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

export class TitleScene extends Scene {
  override readonly name = 'title';

  private t = 0;
  private starting = false;
  private logo: HTMLCanvasElement | null = null;

  override enter(): void {
    this.logo = bigText('MAZZO', P.paper, 3);
    this.game.audio.setAmbience('room');
    this.game.fadeIn(1.0);
  }

  override update(dt: number): void {
    this.t += dt;
    // Si puo' premere anche mentre l'immagine sta ancora entrando: aspettare
    // la fine della dissolvenza sembrerebbe un blocco.
    if (this.starting) return;
    if (this.t > 0.3 && this.game.input.pressed('act')) {
      this.starting = true;
      // Partita nuova: lo stato riparte pulito ogni volta.
      Object.assign(this.game.state, newGameState());
      this.game.transitionTo(() => makeScene('room'), 0.8, 0.6);
    }
  }

  override render(r: Renderer): void {
    const g = r.ctx;
    r.clear('#17130f');
    // Fondo: il sole che entra da una persiana chiusa.
    for (let i = 0; i < 9; i++) {
      const y = 12 + i * 16;
      r.rect(0, y, SCREEN_W, 7, i % 2 ? '#1d1811' : '#211a12');
    }
    r.rect(0, 0, SCREEN_W, SCREEN_H, 'rgba(255,190,90,0.05)');

    if (this.logo) g.drawImage(this.logo, Math.round((SCREEN_W - this.logo.width) / 2), 34);
    drawTextCentered(g, 'una giornata qualsiasi', SCREEN_W / 2, 72, { color: '#a2917a', shadow: null });

    if (this.t % 1.2 < 0.85) {
      drawTextCentered(g, 'NUOVA PARTITA', SCREEN_W / 2, 100, { color: P.paper, shadow: null });
    }

    drawTextCentered(g, 'WASD o frecce: muoviti', SCREEN_W / 2, 126, { color: '#7d6f5c', shadow: null });
    drawTextCentered(g, 'E o Spazio: interagisci', SCREEN_W / 2, 138, { color: '#7d6f5c', shadow: null });
    drawTextCentered(g, 'M: audio', SCREEN_W / 2, 150, { color: '#5f5445', shadow: null });
  }
}
