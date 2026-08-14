/** Schermata della squadra: stato delle creature, scambio, uso oggetti. */

import { SCREEN_H, SCREEN_W } from '../engine/const';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';
import { audio } from '../engine/audio';
import { getItem } from '../data/items';
import { getSpecies } from '../data/species';
import { TYPE_COLORS } from '../gfx/palette';
import { creatureIcon } from '../gfx/creatures';
import { drawText, drawTextRight } from '../gfx/font';
import { PAL } from '../gfx/palette';
import { drawBar, drawTag, drawWindow, hpColor, menuCursor, WIN_BLUE, WIN_STYLE } from '../gfx/ui';
import { state } from '../state/gameState';
import { statusShort } from '../systems/battle';
import { DialogueScene } from './dialogue';
import { SummaryScene } from './summary';

export type PartyMode = 'field' | 'battle' | 'item';

export class PartyScene extends Scene {
  override opaque = true;
  override blocksUpdate = true;

  private index = 0;
  private submenu: string[] | null = null;
  private subIndex = 0;
  private swapFrom: number | null = null;
  private message: string | null = null;
  private itemId: string | null;

  constructor(
    private mode: PartyMode,
    private onDone: (index: number | null) => void,
    opts: { itemId?: string } = {},
  ) {
    super();
    this.itemId = opts.itemId ?? null;
  }

  override enter(): void {
    this.index = 0;
    if (this.mode === 'item' && this.itemId) {
      this.message = `Usare ${getItem(this.itemId).name} su chi?`;
    }
  }

  private close(index: number | null): void {
    this.game.pop();
    this.onDone(index);
  }

  update(): void {
    const input = this.game.input;
    const n = state.party.length;
    if (n === 0) {
      if (input.pressed('a') || input.pressed('b')) this.close(null);
      return;
    }

    if (this.submenu) {
      if (input.repeat('up')) { this.subIndex = (this.subIndex - 1 + this.submenu.length) % this.submenu.length; audio.sfx('select'); }
      if (input.repeat('down')) { this.subIndex = (this.subIndex + 1) % this.submenu.length; audio.sfx('select'); }
      if (input.pressed('b')) { audio.sfx('cancel'); this.submenu = null; return; }
      if (input.pressed('a')) {
        audio.sfx('select');
        const choice = this.submenu[this.subIndex];
        this.submenu = null;
        this.handleSubmenu(choice);
      }
      return;
    }

    if (input.repeat('up')) { this.index = (this.index - 1 + n) % n; audio.sfx('select'); }
    if (input.repeat('down')) { this.index = (this.index + 1) % n; audio.sfx('select'); }
    if (input.repeat('left')) { this.index = 0; }
    if (input.repeat('right')) { this.index = n - 1; }

    if (input.pressed('b')) {
      audio.sfx('cancel');
      if (this.swapFrom !== null) { this.swapFrom = null; return; }
      this.close(null);
      return;
    }

    if (input.pressed('a')) {
      audio.sfx('select');
      if (this.swapFrom !== null) {
        const a = this.swapFrom;
        const b = this.index;
        [state.party[a], state.party[b]] = [state.party[b], state.party[a]];
        this.swapFrom = null;
        return;
      }
      if (this.mode === 'battle') {
        const c = state.party[this.index];
        if (c.fainted) {
          this.message = `${c.name} non può lottare!`;
          return;
        }
        this.close(this.index);
        return;
      }
      if (this.mode === 'item') {
        this.applyItem();
        return;
      }
      this.submenu = ['Riepilogo', 'Scambia', 'Annulla'];
      this.subIndex = 0;
    }
  }

  private handleSubmenu(choice: string): void {
    switch (choice) {
      case 'Riepilogo':
        this.game.push(new SummaryScene(this.index));
        break;
      case 'Scambia':
        this.swapFrom = this.index;
        break;
      default:
        break;
    }
  }

  private applyItem(): void {
    const id = this.itemId;
    if (!id) { this.close(null); return; }
    const item = getItem(id);
    const c = state.party[this.index];
    let text: string[] = [];

    if (item.id === 'rivitalizzante') {
      if (!c.fainted) text = [`${c.name} non ne ha bisogno.`];
      else {
        c.hp = Math.max(1, Math.floor(c.maxHp / 2));
        c.status = null;
        state.removeItem(id, 1);
        audio.sfx('heal');
        text = [`${c.name} è tornato in sé!`];
      }
    } else if (item.heal) {
      if (c.fainted) text = [`${c.name} è esausto: serve un Rivitalizzante.`];
      else if (c.hp >= c.maxHp) text = [`${c.name} ha già tutti i PS.`];
      else {
        const healed = c.heal(item.heal);
        state.removeItem(id, 1);
        audio.sfx('heal');
        text = [`${c.name} recupera ${healed} PS!`];
      }
    } else if (item.cures?.length) {
      if (c.status && item.cures.includes(c.status)) {
        c.status = null;
        state.removeItem(id, 1);
        audio.sfx('heal');
        text = [`${c.name} è tornato normale!`];
      } else text = ['Non avrebbe alcun effetto.'];
    } else if (item.levelUp) {
      if (c.level >= 100) text = [`${c.name} è già al massimo.`];
      else {
        const res = c.gainExp(Math.max(1, expToNext(c)));
        state.removeItem(id, 1);
        audio.sfx('levelup');
        text = [`${c.name} sale al livello ${c.level}!`];
        for (const mv of res.newMoves) {
          if (c.moves.length < 4) {
            c.learnMove(mv);
            text.push(`${c.name} impara una nuova mossa!`);
          }
        }
        const evo = c.pendingEvolution();
        if (evo) {
          const old = c.name;
          c.evolveTo(evo);
          state.caught.add(evo);
          state.seen.add(evo);
          text.push(`${old} si è evoluto in ${getSpecies(evo).name}!`);
        }
      }
    } else {
      text = ['Non si può usare adesso.'];
    }

    this.game.push(new DialogueScene({
      lines: text,
      onDone: () => { this.close(null); },
    }));
  }

  render(r: Renderer): void {
    const g = r.ctx;
    // Sfondo a fasce diagonali.
    g.fillStyle = '#3f5a8c';
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    g.fillStyle = '#476aa0';
    for (let i = -SCREEN_H; i < SCREEN_W; i += 16) {
      g.beginPath();
      g.moveTo(i, SCREEN_H);
      g.lineTo(i + SCREEN_H, 0);
      g.lineTo(i + SCREEN_H + 6, 0);
      g.lineTo(i + 6, SCREEN_H);
      g.closePath();
      g.fill();
    }

    const party = state.party;
    const CARD_X = 10;
    const CARD_W = 226;
    const CARD_H = 21;
    for (let i = 0; i < party.length; i++) {
      const c = party[i];
      const y = 3 + i * 22;
      const selected = i === this.index;
      drawWindow(g, CARD_X, y, CARD_W, CARD_H, selected ? WIN_STYLE : WIN_BLUE);
      if (selected) g.drawImage(menuCursor(), 2, y + 7);

      const sp = getSpecies(c.species);
      g.drawImage(creatureIcon(sp.id, sp.look), CARD_X + 3, y + 2);
      drawText(g, c.name, CARD_X + 22, y + 2, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      drawText(g, `Lv${c.level}`, CARD_X + 22, y + 11, { color: PAL.uiText, shadow: PAL.uiTextShadow });

      const st = statusShort(c);
      if (st) drawTag(g, st, CARD_X + 58, y + 10, st === 'KO' ? '#7a7a88' : '#8a4fa8');

      const ratio = c.hpRatio;
      drawText(g, 'PS', CARD_X + 100, y + 3, { color: '#c8a020', shadow: null });
      drawBar(g, CARD_X + 116, y + 6, 66, ratio, hpColor(ratio), { height: 4 });
      drawTextRight(g, `${c.hp}/${c.maxHp}`, CARD_X + CARD_W - 8, y + 10, {
        color: PAL.uiText, shadow: PAL.uiTextShadow,
      });
      if (this.swapFrom === i) drawTag(g, '↕', CARD_X + CARD_W - 22, y + 1, '#e0a020');
    }

    // Barra inferiore: tipi della creatura selezionata e istruzioni.
    drawWindow(g, 4, SCREEN_H - 22, SCREEN_W - 8, 18, WIN_STYLE);
    const sel = party[this.index];
    let tx = 10;
    if (sel) {
      for (const t of sel.types) {
        tx += drawTag(g, t.toUpperCase().slice(0, 6), tx, SCREEN_H - 18, TYPE_COLORS[t] ?? '#888') + 3;
      }
    }
    const hint = this.message
      ?? (this.swapFrom !== null ? 'Scegli con chi scambiare.'
        : this.mode === 'battle' ? 'Chi mandi in campo?'
          : this.mode === 'item' ? 'Su quale creatura?'
            : 'Z: opzioni · X: indietro');
    drawText(g, hint, tx + 4, SCREEN_H - 18, { color: PAL.uiText, shadow: PAL.uiTextShadow });

    if (this.submenu) {
      const w = 74;
      const h = this.submenu.length * 14 + 10;
      const x = SCREEN_W - w - 8;
      const y = SCREEN_H - h - 26;
      drawWindow(g, x, y, w, h, WIN_STYLE);
      for (let i = 0; i < this.submenu.length; i++) {
        if (i === this.subIndex) g.drawImage(menuCursor(), x + 5, y + 6 + i * 14);
        drawText(g, this.submenu[i], x + 14, y + 6 + i * 14, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      }
    }
  }
}

function expToNext(c: { level: number; exp: number }): number {
  const next = Math.floor((((c.level + 1) ** 3) * 4) / 5);
  return Math.max(1, next - c.exp);
}
