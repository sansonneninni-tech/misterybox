/** Borsa: categorie, uso e lancio degli oggetti. */

import { SCREEN_H, SCREEN_W } from '../engine/const';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';
import { audio } from '../engine/audio';
import { getItem, ItemCategory } from '../data/items';
import { drawText, drawTextRight, wrapText } from '../gfx/font';
import { PAL } from '../gfx/palette';
import { drawWindow, itemIcon, menuCursor, WIN_BLUE, WIN_STYLE } from '../gfx/ui';
import { state } from '../state/gameState';
import { DialogueScene } from './dialogue';
import { PartyScene } from './party';

const CATEGORIES: Array<{ id: ItemCategory; label: string }> = [
  { id: 'cura', label: 'CURE' },
  { id: 'sfera', label: 'SFERE' },
  { id: 'base', label: 'VARIE' },
  { id: 'speciale', label: 'SPECIALI' },
];

export type BagMode = 'field' | 'battle';

export class BagScene extends Scene {
  override opaque = true;
  override blocksUpdate = true;

  private cat = 0;
  private index = 0;
  private scroll = 0;
  private submenu: string[] | null = null;
  private subIndex = 0;

  constructor(private mode: BagMode, private onDone: (itemId: string | null) => void) {
    super();
  }

  private list() {
    return state.itemsByCategory(CATEGORIES[this.cat].id);
  }

  private close(item: string | null): void {
    this.game.pop();
    this.onDone(item);
  }

  update(): void {
    const input = this.game.input;
    const list = this.list();

    if (this.submenu) {
      const n = this.submenu.length;
      if (input.repeat('up')) { this.subIndex = (this.subIndex - 1 + n) % n; audio.sfx('select'); }
      if (input.repeat('down')) { this.subIndex = (this.subIndex + 1) % n; audio.sfx('select'); }
      if (input.pressed('b')) { audio.sfx('cancel'); this.submenu = null; return; }
      if (input.pressed('a')) {
        audio.sfx('select');
        const choice = this.submenu[this.subIndex];
        this.submenu = null;
        this.handleSubmenu(choice, list[this.index]?.id);
      }
      return;
    }

    if (input.repeat('left')) { this.cat = (this.cat + CATEGORIES.length - 1) % CATEGORIES.length; this.index = 0; this.scroll = 0; audio.sfx('select'); }
    if (input.repeat('right')) { this.cat = (this.cat + 1) % CATEGORIES.length; this.index = 0; this.scroll = 0; audio.sfx('select'); }
    if (list.length > 0) {
      if (input.repeat('up')) { this.index = (this.index - 1 + list.length) % list.length; audio.sfx('select'); }
      if (input.repeat('down')) { this.index = (this.index + 1) % list.length; audio.sfx('select'); }
      if (this.index < this.scroll) this.scroll = this.index;
      if (this.index > this.scroll + 4) this.scroll = this.index - 4;
    }

    if (input.pressed('b')) {
      audio.sfx('cancel');
      this.close(null);
      return;
    }

    if (input.pressed('a')) {
      const entry = list[this.index];
      if (!entry) { audio.sfx('cancel'); return; }
      audio.sfx('select');
      const def = getItem(entry.id);
      if (this.mode === 'battle') {
        if (!def.battle) {
          this.game.push(new DialogueScene({ lines: ['Non si può usare in lotta.'] }));
          return;
        }
        this.close(entry.id);
        return;
      }
      if (def.keyItem) {
        this.game.push(new DialogueScene({ lines: [def.desc] }));
        return;
      }
      this.submenu = def.field ? ['Usa', 'Getta', 'Annulla'] : ['Getta', 'Annulla'];
      this.subIndex = 0;
    }
  }

  private handleSubmenu(choice: string, itemId: string | undefined): void {
    if (!itemId) return;
    const def = getItem(itemId);
    if (choice === 'Usa') {
      if (def.repelSteps) {
        state.removeItem(itemId, 1);
        state.repelSteps = def.repelSteps;
        audio.sfx('item');
        this.game.push(new DialogueScene({
          lines: [`${def.name} usato: le creature deboli staranno lontane.`],
          onDone: () => this.close(null),
        }));
        return;
      }
      if (def.category === 'sfera') {
        this.game.push(new DialogueScene({ lines: ['Si può usare solo durante una lotta.'] }));
        return;
      }
      this.game.push(new PartyScene('item', () => { /* la scena squadra chiude da sola */ }, { itemId }));
      return;
    }
    if (choice === 'Getta') {
      state.removeItem(itemId, 1);
      audio.sfx('cancel');
      this.game.push(new DialogueScene({ lines: [`Hai gettato ${def.name}.`] }));
      const list = this.list();
      if (this.index >= list.length) this.index = Math.max(0, list.length - 1);
    }
  }

  render(r: Renderer): void {
    const g = r.ctx;
    g.fillStyle = '#8a6a3a';
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    g.fillStyle = '#9a7a46';
    for (let y = 0; y < SCREEN_H; y += 8) g.fillRect(0, y, SCREEN_W, 4);

    // Linguette delle categorie.
    for (let i = 0; i < CATEGORIES.length; i++) {
      const w = 56;
      const x = 4 + i * (w + 2);
      const active = i === this.cat;
      drawWindow(g, x, 2, w, 16, active ? WIN_STYLE : WIN_BLUE);
      drawText(g, CATEGORIES[i].label, x + 6, 5, {
        color: active ? PAL.uiText : '#5a6478', shadow: active ? PAL.uiTextShadow : null,
      });
    }

    // Lista.
    drawWindow(g, 4, 20, SCREEN_W - 8, 84, WIN_STYLE);
    const list = this.list();
    if (list.length === 0) {
      drawText(g, 'Niente qui dentro.', 16, 30, { color: '#7a8090', shadow: null });
    }
    for (let i = 0; i < Math.min(5, list.length); i++) {
      const idx = this.scroll + i;
      if (idx >= list.length) break;
      const entry = list[idx];
      const def = getItem(entry.id);
      const y = 26 + i * 15;
      if (idx === this.index) g.drawImage(menuCursor(), 8, y + 2);
      g.drawImage(itemIcon(def.icon), 15, y - 2);
      drawText(g, def.name, 34, y, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      if (!def.keyItem) {
        drawTextRight(g, `x${entry.qty}`, SCREEN_W - 14, y, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      }
    }
    if (list.length > 5) {
      drawTextRight(g, '▼', SCREEN_W - 12, 92, { color: '#5a6478', shadow: null });
    }

    // Descrizione.
    drawWindow(g, 4, SCREEN_H - 52, SCREEN_W - 8, 48, WIN_STYLE);
    const sel = list[this.index];
    if (sel) {
      const def = getItem(sel.id);
      const lines = wrapText(def.desc, SCREEN_W - 30);
      for (let i = 0; i < Math.min(3, lines.length); i++) {
        drawText(g, lines[i], 12, SCREEN_H - 46 + i * 12, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      }
    } else {
      drawText(g, `Monete: ${state.money}`, 12, SCREEN_H - 46, { color: PAL.uiText, shadow: PAL.uiTextShadow });
    }

    if (this.submenu) {
      const w = 66;
      const h = this.submenu.length * 14 + 10;
      const x = SCREEN_W - w - 8;
      const y = SCREEN_H - h - 56;
      drawWindow(g, x, y, w, h, WIN_STYLE);
      for (let i = 0; i < this.submenu.length; i++) {
        if (i === this.subIndex) g.drawImage(menuCursor(), x + 5, y + 6 + i * 14);
        drawText(g, this.submenu[i], x + 14, y + 6 + i * 14, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      }
    }
  }
}
