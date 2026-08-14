/** Scheda dettagliata di una creatura: statistiche, mosse, descrizione. */

import { SCREEN_H, SCREEN_W } from '../engine/const';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';
import { audio } from '../engine/audio';
import { getMove } from '../data/moves';
import { getSpecies } from '../data/species';
import { creatureSprite } from '../gfx/creatures';
import { drawText, drawTextRight, wrapText } from '../gfx/font';
import { PAL, TYPE_COLORS } from '../gfx/palette';
import { drawBar, drawTag, drawWindow, hpColor, WIN_BLUE, WIN_STYLE } from '../gfx/ui';
import { state } from '../state/gameState';
import { statusShort } from '../systems/battle';

export class SummaryScene extends Scene {
  override opaque = true;
  override blocksUpdate = true;
  private page = 0;

  constructor(private index: number) {
    super();
  }

  update(): void {
    const input = this.game.input;
    if (input.pressed('b')) {
      audio.sfx('cancel');
      this.game.pop();
      return;
    }
    if (input.repeat('right')) { this.page = (this.page + 1) % 3; audio.sfx('select'); }
    if (input.repeat('left')) { this.page = (this.page + 2) % 3; audio.sfx('select'); }
    if (input.repeat('down')) {
      this.index = (this.index + 1) % Math.max(1, state.party.length);
      audio.sfx('select');
    }
    if (input.repeat('up')) {
      this.index = (this.index - 1 + Math.max(1, state.party.length)) % Math.max(1, state.party.length);
      audio.sfx('select');
    }
  }

  render(r: Renderer): void {
    const g = r.ctx;
    const c = state.party[this.index];
    g.fillStyle = '#2f3f66';
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    for (let y = 0; y < SCREEN_H; y += 4) {
      g.fillStyle = 'rgba(255,255,255,0.03)';
      g.fillRect(0, y, SCREEN_W, 1);
    }
    if (!c) {
      drawText(g, 'Nessuna creatura', 12, 12, { color: '#ffffff', shadow: null });
      return;
    }
    const sp = getSpecies(c.species);

    // Colonna sinistra: sprite e dati principali.
    drawWindow(g, 4, 4, 84, 96, WIN_BLUE);
    g.drawImage(creatureSprite(sp.id, sp.look, false), 18, 12);
    drawText(g, c.name, 10, 70, { color: PAL.uiText, shadow: PAL.uiTextShadow });
    drawText(g, `Lv${c.level}`, 10, 82, { color: PAL.uiText, shadow: PAL.uiTextShadow });
    const st = statusShort(c);
    if (st) drawTag(g, st, 48, 80, st === 'KO' ? '#7a7a88' : '#8a4fa8');

    let tx = 6;
    for (const t of sp.types) {
      tx += drawTag(g, t.toUpperCase().slice(0, 6), tx, 102, TYPE_COLORS[t] ?? '#888') + 3;
    }

    drawWindow(g, 92, 4, SCREEN_W - 96, SCREEN_H - 30, WIN_STYLE);
    const px = 100;
    if (this.page === 0) {
      drawText(g, 'STATISTICHE', px, 10, { color: '#2b4d8a', shadow: null });
      const rows: Array<[string, number]> = [
        ['PS', c.maxHp], ['Attacco', c.atk], ['Difesa', c.defense],
        ['Att. Sp.', c.spa], ['Dif. Sp.', c.spd], ['Velocità', c.spe],
      ];
      for (let i = 0; i < rows.length; i++) {
        const y = 26 + i * 13;
        drawText(g, rows[i][0], px, y, { color: PAL.uiText, shadow: PAL.uiTextShadow });
        drawTextRight(g, String(rows[i][1]), SCREEN_W - 12, y, { color: PAL.uiText, shadow: PAL.uiTextShadow });
        drawBar(g, px + 58, y + 4, 44, Math.min(1, rows[i][1] / 160), '#4a8ad8', { height: 2, frame: false });
      }
      const prog = c.expProgress();
      drawText(g, 'Esperienza', px, 108, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      drawBar(g, px, 120, SCREEN_W - px - 12, prog.ratio, PAL.xpBlue, { height: 3 });
      drawText(g, `PS ${c.hp}/${c.maxHp}`, px, 92, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      drawBar(g, px + 60, 96, 44, c.hpRatio, hpColor(c.hpRatio), { height: 3 });
    } else if (this.page === 1) {
      drawText(g, 'MOSSE', px, 10, { color: '#2b4d8a', shadow: null });
      for (let i = 0; i < c.moves.length; i++) {
        const slot = c.moves[i];
        const m = getMove(slot.id);
        const y = 26 + i * 26;
        drawText(g, m.name, px, y, { color: PAL.uiText, shadow: PAL.uiTextShadow });
        drawTextRight(g, `PP ${slot.pp}/${slot.maxPp}`, SCREEN_W - 12, y, {
          color: PAL.uiText, shadow: PAL.uiTextShadow,
        });
        drawTag(g, m.type.toUpperCase().slice(0, 6), px, y + 12, TYPE_COLORS[m.type] ?? '#888');
        drawTextRight(g, m.power > 0 ? `Pot ${m.power}` : 'Stato', SCREEN_W - 12, y + 13, {
          color: '#5a6070', shadow: null,
        });
      }
    } else {
      drawText(g, 'VERDEX', px, 10, { color: '#2b4d8a', shadow: null });
      drawText(g, `${sp.category}`, px, 26, { color: '#5a6070', shadow: null });
      drawText(g, `Altezza ${sp.height.toFixed(1)} m`, px, 40, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      drawText(g, `Peso ${sp.weight.toFixed(1)} kg`, px, 53, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      const lines = wrapText(sp.dex, SCREEN_W - px - 14);
      for (let i = 0; i < lines.length && i < 5; i++) {
        drawText(g, lines[i], px, 70 + i * 12, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      }
    }

    drawWindow(g, 4, SCREEN_H - 22, SCREEN_W - 8, 18, WIN_STYLE);
    drawText(g, '◀ ▶ pagina · ▲ ▼ creatura · X indietro', 12, SCREEN_H - 18, {
      color: PAL.uiText, shadow: PAL.uiTextShadow,
    });
  }
}
