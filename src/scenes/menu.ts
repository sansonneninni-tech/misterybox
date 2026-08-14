/** Menu principale richiamabile durante l'esplorazione. */

import { SCREEN_H, SCREEN_W } from '../engine/const';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';
import { audio } from '../engine/audio';
import { drawText, drawTextRight, textWidth } from '../gfx/font';
import { PAL } from '../gfx/palette';
import { drawWindow, menuCursor, WIN_STYLE } from '../gfx/ui';
import { state } from '../state/gameState';
import { BagScene } from './bag';
import { DexScene } from './dex';
import { DialogueScene } from './dialogue';
import { PartyScene } from './party';

export class MenuScene extends Scene {
  override opaque = false;
  override blocksUpdate = true;

  private items = ['VERDEX', 'SQUADRA', 'BORSA', 'SCHEDA', 'SALVA', 'CHIUDI'];
  private index = 0;
  private card = false;

  update(): void {
    const input = this.game.input;
    if (this.card) {
      if (input.pressed('a') || input.pressed('b')) { audio.sfx('cancel'); this.card = false; }
      return;
    }
    const n = this.items.length;
    if (input.repeat('up')) { this.index = (this.index - 1 + n) % n; audio.sfx('select'); }
    if (input.repeat('down')) { this.index = (this.index + 1) % n; audio.sfx('select'); }
    if (input.pressed('b') || input.pressed('start')) {
      audio.sfx('cancel');
      this.game.pop();
      return;
    }
    if (input.pressed('a')) {
      audio.sfx('select');
      this.select(this.items[this.index]);
    }
  }

  private select(item: string): void {
    switch (item) {
      case 'VERDEX':
        this.game.push(new DexScene());
        break;
      case 'SQUADRA':
        if (state.party.length === 0) {
          this.game.push(new DialogueScene({ lines: ['Non hai ancora nessuna creatura.'] }));
        } else {
          this.game.push(new PartyScene('field', () => { /* torna al menu */ }));
        }
        break;
      case 'BORSA':
        this.game.push(new BagScene('field', () => { /* torna al menu */ }));
        break;
      case 'SCHEDA':
        this.card = true;
        break;
      case 'SALVA': {
        this.game.push(new DialogueScene({
          lines: ['Vuoi salvare la partita?'],
          choices: [{ label: 'Sì', value: 'si' }, { label: 'No', value: 'no' }],
          onDone: (choice) => {
            if (choice !== 'si') return;
            const ok = state.save();
            audio.sfx(ok ? 'save' : 'cancel');
            this.game.push(new DialogueScene({
              lines: ok
                ? [`${state.playerName} ha salvato la partita.`]
                : ['Salvataggio non riuscito…'],
            }));
          },
        }));
        break;
      }
      default:
        this.game.pop();
        break;
    }
  }

  render(r: Renderer): void {
    const g = r.ctx;
    const w = 78;
    const h = this.items.length * 15 + 10;
    const x = SCREEN_W - w - 6;
    const y = 6;
    drawWindow(g, x, y, w, h, WIN_STYLE);
    for (let i = 0; i < this.items.length; i++) {
      const iy = y + 6 + i * 15;
      if (i === this.index) g.drawImage(menuCursor(), x + 5, iy + 1);
      drawText(g, this.items[i], x + 14, iy, { color: PAL.uiText, shadow: PAL.uiTextShadow });
    }

    if (this.card) this.drawCard(r);
  }

  private drawCard(r: Renderer): void {
    const g = r.ctx;
    const w = 176;
    const h = 96;
    const x = Math.round((SCREEN_W - w) / 2);
    const y = Math.round((SCREEN_H - h) / 2);
    drawWindow(g, x, y, w, h, WIN_STYLE);
    drawText(g, 'SCHEDA ALLENATORE', x + 10, y + 8, { color: '#2b4d8a', shadow: null });
    const rows: Array<[string, string]> = [
      ['Nome', state.playerName],
      ['Monete', String(state.money)],
      ['Tempo', state.playTimeText()],
      ['Verdex', `${state.caught.size}/${state.dexProgress().total}`],
      ['Squadra', `${state.party.length}/6`],
      ['Spille', state.hasFlag('spilla_bosco') ? '1' : '0'],
    ];
    for (let i = 0; i < rows.length; i++) {
      const ry = y + 26 + i * 12;
      drawText(g, rows[i][0], x + 12, ry, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      drawTextRight(g, rows[i][1], x + w - 12, ry, { color: PAL.uiText, shadow: PAL.uiTextShadow });
    }
    const hint = 'Premi Z per chiudere';
    drawText(g, hint, x + Math.round((w - textWidth(hint)) / 2), y + h - 14, {
      color: '#5a6478', shadow: null,
    });
  }
}
