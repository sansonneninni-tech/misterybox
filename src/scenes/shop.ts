/** Negozio: acquisto e vendita di oggetti. */

import { SCREEN_H, SCREEN_W } from '../engine/const';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';
import { audio } from '../engine/audio';
import { getItem } from '../data/items';
import { drawText, drawTextRight, wrapText } from '../gfx/font';
import { PAL } from '../gfx/palette';
import { drawWindow, itemIcon, menuCursor, WIN_STYLE } from '../gfx/ui';
import { state } from '../state/gameState';
import { DialogueScene } from './dialogue';

export class ShopScene extends Scene {
  override opaque = true;
  override blocksUpdate = true;

  private index = 0;
  private scroll = 0;
  private qty = 1;
  private choosingQty = false;

  constructor(
    private stock: string[],
    private mode: 'buy' | 'sell',
    private onDone: () => void,
  ) {
    super();
  }

  private entries(): Array<{ id: string; price: number; qty?: number }> {
    if (this.mode === 'buy') {
      return this.stock.map((id) => ({ id, price: getItem(id).price }));
    }
    return state.bag
      .filter((b) => !getItem(b.id).keyItem)
      .map((b) => ({ id: b.id, price: Math.floor(getItem(b.id).price / 2), qty: b.qty }));
  }

  private close(): void {
    this.game.pop();
    this.onDone();
  }

  update(): void {
    const input = this.game.input;
    const list = this.entries();

    if (this.choosingQty) {
      const entry = list[this.index];
      if (!entry) { this.choosingQty = false; return; }
      const max = this.mode === 'buy'
        ? Math.max(1, Math.min(99, Math.floor(state.money / Math.max(1, entry.price))))
        : entry.qty ?? 1;
      if (input.repeat('up')) { this.qty = Math.min(max, this.qty + 1); audio.sfx('select'); }
      if (input.repeat('down')) { this.qty = Math.max(1, this.qty - 1); audio.sfx('select'); }
      if (input.repeat('right')) { this.qty = Math.min(max, this.qty + 10); audio.sfx('select'); }
      if (input.repeat('left')) { this.qty = Math.max(1, this.qty - 10); audio.sfx('select'); }
      if (input.pressed('b')) { audio.sfx('cancel'); this.choosingQty = false; return; }
      if (input.pressed('a')) {
        this.confirm(entry.id, entry.price, this.qty);
        this.choosingQty = false;
      }
      return;
    }

    if (list.length > 0) {
      if (input.repeat('up')) { this.index = (this.index - 1 + list.length) % list.length; audio.sfx('select'); }
      if (input.repeat('down')) { this.index = (this.index + 1) % list.length; audio.sfx('select'); }
      if (this.index < this.scroll) this.scroll = this.index;
      if (this.index > this.scroll + 4) this.scroll = this.index - 4;
    }

    if (input.pressed('b')) { audio.sfx('cancel'); this.close(); return; }
    if (input.pressed('a')) {
      const entry = list[this.index];
      if (!entry) { this.close(); return; }
      if (this.mode === 'buy' && state.money < entry.price) {
        audio.sfx('cancel');
        this.game.push(new DialogueScene({ lines: ['Non hai abbastanza monete.'] }));
        return;
      }
      audio.sfx('select');
      this.qty = 1;
      this.choosingQty = true;
    }
  }

  private confirm(id: string, price: number, qty: number): void {
    const def = getItem(id);
    if (this.mode === 'buy') {
      const total = price * qty;
      if (state.money < total) {
        audio.sfx('cancel');
        this.game.push(new DialogueScene({ lines: ['Non hai abbastanza monete.'] }));
        return;
      }
      state.money -= total;
      state.addItem(id, qty);
      audio.sfx('buy');
      this.game.push(new DialogueScene({
        lines: [`${def.name} x${qty} per ${total} monete.`, 'Grazie mille!'],
      }));
    } else {
      const owned = state.countItem(id);
      const real = Math.min(owned, qty);
      if (real <= 0) return;
      state.removeItem(id, real);
      const total = price * real;
      state.money = Math.min(999999, state.money + total);
      audio.sfx('buy');
      this.game.push(new DialogueScene({
        lines: [`Venduti ${real} ${def.name} per ${total} monete.`],
      }));
      const list = this.entries();
      if (this.index >= list.length) this.index = Math.max(0, list.length - 1);
    }
  }

  render(r: Renderer): void {
    const g = r.ctx;
    g.fillStyle = '#3a5a7a';
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    g.fillStyle = '#456a8c';
    for (let y = 0; y < SCREEN_H; y += 10) g.fillRect(0, y, SCREEN_W, 5);

    drawWindow(g, 4, 4, SCREEN_W - 8, 18, WIN_STYLE);
    drawText(g, this.mode === 'buy' ? 'ACQUISTA' : 'VENDI', 12, 8, { color: PAL.uiText, shadow: PAL.uiTextShadow });
    drawTextRight(g, `Monete ${state.money}`, SCREEN_W - 12, 8, { color: PAL.uiText, shadow: PAL.uiTextShadow });

    const list = this.entries();
    drawWindow(g, 4, 26, SCREEN_W - 8, 82, WIN_STYLE);
    if (list.length === 0) {
      drawText(g, 'Niente da vendere.', 16, 36, { color: '#7a8090', shadow: null });
    }
    for (let i = 0; i < Math.min(5, list.length); i++) {
      const idx = this.scroll + i;
      if (idx >= list.length) break;
      const e = list[idx];
      const def = getItem(e.id);
      const y = 32 + i * 15;
      if (idx === this.index) g.drawImage(menuCursor(), 8, y + 2);
      g.drawImage(itemIcon(def.icon), 15, y - 2);
      drawText(g, def.name, 34, y, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      drawTextRight(g, `${e.price}`, SCREEN_W - 14, y, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      if (e.qty !== undefined) {
        drawTextRight(g, `x${e.qty}`, SCREEN_W - 52, y, { color: '#5a6478', shadow: null });
      }
    }

    drawWindow(g, 4, SCREEN_H - 48, SCREEN_W - 8, 44, WIN_STYLE);
    const sel = list[this.index];
    if (sel) {
      const def = getItem(sel.id);
      const lines = wrapText(def.desc, SCREEN_W - 30);
      for (let i = 0; i < Math.min(2, lines.length); i++) {
        drawText(g, lines[i], 12, SCREEN_H - 42 + i * 12, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      }
    }

    if (this.choosingQty && sel) {
      const w = 108;
      const h = 34;
      const x = SCREEN_W - w - 8;
      const y = SCREEN_H - h - 52;
      drawWindow(g, x, y, w, h, WIN_STYLE);
      drawText(g, `Quantità  ${this.qty}`, x + 10, y + 5, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      drawText(g, `Totale ${sel.price * this.qty}`, x + 10, y + 18, { color: PAL.uiText, shadow: PAL.uiTextShadow });
    }
  }
}
