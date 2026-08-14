/** Terminale di deposito: sposta le creature fra squadra e archivio. */

import { SCREEN_H, SCREEN_W } from '../engine/const';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';
import { audio } from '../engine/audio';
import { getSpecies } from '../data/species';
import { creatureIcon } from '../gfx/creatures';
import { drawText, drawTextRight } from '../gfx/font';
import { PAL, TYPE_COLORS } from '../gfx/palette';
import { drawBar, drawTag, drawWindow, hpColor, menuCursor, WIN_BLUE, WIN_STYLE } from '../gfx/ui';
import { state } from '../state/gameState';
import { statusShort } from '../systems/battle';

const ROWS = 5;

export class BoxScene extends Scene {
  override opaque = true;
  override blocksUpdate = true;

  /** 0 = archivio, 1 = squadra. */
  private column = 0;
  private boxIndex = 0;
  private partyIndex = 0;
  private boxScroll = 0;
  private message = 'Sposta le creature fra archivio e squadra.';

  private get list() {
    return this.column === 0 ? state.box : state.party;
  }

  private get index() {
    return this.column === 0 ? this.boxIndex : this.partyIndex;
  }

  private set index(v: number) {
    if (this.column === 0) this.boxIndex = v;
    else this.partyIndex = v;
  }

  update(): void {
    const input = this.game.input;

    if (input.pressed('b')) {
      audio.sfx('cancel');
      this.game.pop();
      return;
    }
    if (input.repeat('left') && this.column === 1) { this.column = 0; audio.sfx('select'); }
    if (input.repeat('right') && this.column === 0) { this.column = 1; audio.sfx('select'); }

    const n = this.list.length;
    if (n > 0) {
      if (input.repeat('up')) { this.index = (this.index - 1 + n) % n; audio.sfx('select'); }
      if (input.repeat('down')) { this.index = (this.index + 1) % n; audio.sfx('select'); }
    } else {
      this.index = 0;
    }
    this.boxIndex = Math.min(this.boxIndex, Math.max(0, state.box.length - 1));
    this.partyIndex = Math.min(this.partyIndex, Math.max(0, state.party.length - 1));
    if (this.boxIndex < this.boxScroll) this.boxScroll = this.boxIndex;
    if (this.boxIndex > this.boxScroll + ROWS - 1) this.boxScroll = this.boxIndex - ROWS + 1;

    if (input.pressed('a')) this.transfer();
  }

  private transfer(): void {
    if (this.column === 0) {
      const c = state.box[this.boxIndex];
      if (!c) { audio.sfx('cancel'); return; }
      if (state.party.length >= 6) {
        this.message = 'La squadra è al completo (6 creature).';
        audio.sfx('cancel');
        return;
      }
      state.box.splice(this.boxIndex, 1);
      state.party.push(c);
      audio.sfx('item');
      this.message = `${c.name} si unisce alla squadra!`;
    } else {
      const c = state.party[this.partyIndex];
      if (!c) { audio.sfx('cancel'); return; }
      if (state.party.length <= 1) {
        this.message = 'Devi tenere almeno una creatura con te.';
        audio.sfx('cancel');
        return;
      }
      state.party.splice(this.partyIndex, 1);
      state.box.push(c);
      audio.sfx('item');
      this.message = `${c.name} è stato depositato.`;
    }
  }

  render(r: Renderer): void {
    const g = r.ctx;
    g.fillStyle = '#26304a';
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    for (let y = 0; y < SCREEN_H; y += 4) {
      g.fillStyle = 'rgba(140,180,240,0.05)';
      g.fillRect(0, y, SCREEN_W, 1);
    }

    // Archivio
    drawWindow(g, 4, 4, 114, 108, this.column === 0 ? WIN_STYLE : WIN_BLUE);
    drawText(g, 'ARCHIVIO', 12, 8, { color: '#2b4d8a', shadow: null });
    if (state.box.length === 0) {
      drawText(g, 'Vuoto.', 14, 26, { color: '#7a8090', shadow: null });
    }
    for (let i = 0; i < ROWS; i++) {
      const idx = this.boxScroll + i;
      const c = state.box[idx];
      if (!c) break;
      const y = 22 + i * 17;
      if (this.column === 0 && idx === this.boxIndex) g.drawImage(menuCursor(), 7, y + 4);
      const sp = getSpecies(c.species);
      g.drawImage(creatureIcon(sp.id, sp.look), 14, y);
      drawText(g, c.name, 32, y + 1, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      drawText(g, `Lv${c.level}`, 32, y + 9, { color: '#5a6478', shadow: null });
      const st = statusShort(c);
      if (st) drawTag(g, st, 88, y + 4, st === 'KO' ? '#7a7a88' : '#8a4fa8');
    }
    if (state.box.length > ROWS) {
      drawTextRight(g, '▼', 112, 98, { color: '#5a6478', shadow: null });
    }

    // Squadra
    drawWindow(g, 122, 4, 114, 108, this.column === 1 ? WIN_STYLE : WIN_BLUE);
    drawText(g, 'SQUADRA', 130, 8, { color: '#2b4d8a', shadow: null });
    for (let i = 0; i < state.party.length; i++) {
      const c = state.party[i];
      const y = 22 + i * 15;
      if (this.column === 1 && i === this.partyIndex) g.drawImage(menuCursor(), 125, y + 3);
      const sp = getSpecies(c.species);
      g.drawImage(creatureIcon(sp.id, sp.look), 132, y - 1);
      drawText(g, c.name, 150, y, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      drawTextRight(g, `Lv${c.level}`, 230, y, { color: '#5a6478', shadow: null });
      drawBar(g, 150, y + 10, 60, c.hpRatio, hpColor(c.hpRatio), { height: 2, frame: false });
    }

    // Dettaglio e istruzioni
    drawWindow(g, 4, 116, SCREEN_W - 8, 40, WIN_STYLE);
    const sel = this.list[this.index];
    if (sel) {
      const sp = getSpecies(sel.species);
      drawText(g, `${sel.name}  Lv${sel.level}`, 12, 121, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      let tx = 120;
      for (const t of sp.types) {
        tx += drawTag(g, t.toUpperCase().slice(0, 6), tx, 120, TYPE_COLORS[t] ?? '#888') + 3;
      }
      drawText(g, `PS ${sel.hp}/${sel.maxHp}`, 12, 132, { color: PAL.uiText, shadow: PAL.uiTextShadow });
    }
    drawText(g, this.message, 12, 143, { color: '#5a6478', shadow: null });
  }
}
