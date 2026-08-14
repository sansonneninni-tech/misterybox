/** Verdex: elenco delle creature viste e catturate. */

import { SCREEN_H, SCREEN_W } from '../engine/const';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';
import { audio } from '../engine/audio';
import { getSpecies, SPECIES_ORDER } from '../data/species';
import { creatureSprite } from '../gfx/creatures';
import { drawText, drawTextRight, wrapText } from '../gfx/font';
import { PAL, TYPE_COLORS } from '../gfx/palette';
import { silhouette } from '../gfx/pixel';
import { drawTag, drawWindow, menuCursor, WIN_STYLE } from '../gfx/ui';
import { state } from '../state/gameState';

export class DexScene extends Scene {
  override opaque = true;
  override blocksUpdate = true;
  private index = 0;
  private scroll = 0;

  update(): void {
    const input = this.game.input;
    const n = SPECIES_ORDER.length;
    if (input.repeat('up')) { this.index = (this.index - 1 + n) % n; audio.sfx('select'); }
    if (input.repeat('down')) { this.index = (this.index + 1) % n; audio.sfx('select'); }
    if (input.repeat('left')) { this.index = Math.max(0, this.index - 5); audio.sfx('select'); }
    if (input.repeat('right')) { this.index = Math.min(n - 1, this.index + 5); audio.sfx('select'); }
    if (this.index < this.scroll) this.scroll = this.index;
    if (this.index > this.scroll + 6) this.scroll = this.index - 6;
    if (input.pressed('b')) { audio.sfx('cancel'); this.game.pop(); }
  }

  render(r: Renderer): void {
    const g = r.ctx;
    g.fillStyle = '#2c4a3a';
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    for (let y = 0; y < SCREEN_H; y += 6) {
      g.fillStyle = 'rgba(255,255,255,0.04)';
      g.fillRect(0, y, SCREEN_W, 2);
    }

    const p = state.dexProgress();
    drawWindow(g, 4, 4, 120, 16, WIN_STYLE);
    drawText(g, `Visti ${p.seen}  Presi ${p.caught}`, 10, 7, { color: PAL.uiText, shadow: PAL.uiTextShadow });

    // Elenco
    drawWindow(g, 4, 22, 120, SCREEN_H - 28, WIN_STYLE);
    for (let i = 0; i < 7; i++) {
      const idx = this.scroll + i;
      if (idx >= SPECIES_ORDER.length) break;
      const id = SPECIES_ORDER[idx];
      const sp = getSpecies(id);
      const seen = state.seen.has(id);
      const caught = state.caught.has(id);
      const y = 28 + i * 16;
      if (idx === this.index) g.drawImage(menuCursor(), 8, y + 2);
      drawText(g, String(idx + 1).padStart(2, '0'), 16, y, { color: '#5a6478', shadow: null });
      drawText(g, seen ? sp.name : '- - - - -', 36, y, {
        color: seen ? PAL.uiText : '#8a90a0', shadow: seen ? PAL.uiTextShadow : null,
      });
      if (caught) drawText(g, '★', 110, y, { color: '#e0a020', shadow: null });
    }

    // Dettaglio
    const id = SPECIES_ORDER[this.index];
    const sp = getSpecies(id);
    const seen = state.seen.has(id);
    drawWindow(g, 128, 4, SCREEN_W - 132, SCREEN_H - 8, WIN_STYLE);
    const sprite = creatureSprite(sp.id, sp.look, false);
    if (seen) {
      g.drawImage(sprite, 154, 10);
    } else {
      g.drawImage(silhouette(sprite, '#3a3f4c'), 154, 10);
    }
    if (!seen) {
      drawText(g, 'Non ancora', 140, 74, { color: '#5a6478', shadow: null });
      drawText(g, 'avvistata.', 140, 88, { color: '#5a6478', shadow: null });
      return;
    }
    drawText(g, sp.name, 136, 68, { color: PAL.uiText, shadow: PAL.uiTextShadow });
    drawTextRight(g, sp.category, SCREEN_W - 10, 68, { color: '#5a6478', shadow: null });
    let tx = 136;
    for (const t of sp.types) {
      tx += drawTag(g, t.toUpperCase().slice(0, 6), tx, 82, TYPE_COLORS[t] ?? '#888') + 3;
    }
    const lines = wrapText(sp.dex, SCREEN_W - 148);
    for (let i = 0; i < Math.min(4, lines.length); i++) {
      drawText(g, lines[i], 136, 98 + i * 12, { color: PAL.uiText, shadow: PAL.uiTextShadow });
    }
  }
}
