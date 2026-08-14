/** Schermata iniziale: nuova partita, continua, introduzione. */

import { SCREEN_H, SCREEN_W } from '../engine/const';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';
import { audio } from '../engine/audio';
import { getSpecies } from '../data/species';
import { creatureSprite } from '../gfx/creatures';
import { getCharacter } from '../gfx/chars';
import { drawText, drawTextCentered } from '../gfx/font';
import { PAL } from '../gfx/palette';
import { drawWindow, menuCursor, WIN_STYLE } from '../gfx/ui';
import { GameState, newGame, setState } from '../state/gameState';
import { DialogueScene } from './dialogue';
import { WorldScene } from './world';

const NAMES = ['ALEX', 'MIRA', 'NICO', 'SARA', 'ELIO', 'GIÒ'];

export class TitleScene extends Scene {
  override opaque = true;
  private t = 0;
  private index = 0;
  private items: string[] = [];
  private nameIndex = 0;
  private phase: 'menu' | 'name' = 'menu';

  override enter(): void {
    this.items = GameState.hasSave() ? ['CONTINUA', 'NUOVA PARTITA'] : ['NUOVA PARTITA'];
    this.index = 0;
    audio.playMusic('title');
  }

  update(): void {
    this.t++;
    const input = this.game.input;

    if (this.phase === 'name') {
      if (input.repeat('left')) { this.nameIndex = (this.nameIndex + NAMES.length - 1) % NAMES.length; audio.sfx('select'); }
      if (input.repeat('right')) { this.nameIndex = (this.nameIndex + 1) % NAMES.length; audio.sfx('select'); }
      if (input.repeat('up')) { this.nameIndex = (this.nameIndex + NAMES.length - 1) % NAMES.length; audio.sfx('select'); }
      if (input.repeat('down')) { this.nameIndex = (this.nameIndex + 1) % NAMES.length; audio.sfx('select'); }
      if (input.pressed('b')) { audio.sfx('cancel'); this.phase = 'menu'; return; }
      if (input.pressed('a')) {
        audio.sfx('select');
        this.startNew(NAMES[this.nameIndex]);
      }
      return;
    }

    const n = this.items.length;
    if (input.repeat('up')) { this.index = (this.index - 1 + n) % n; audio.sfx('select'); }
    if (input.repeat('down')) { this.index = (this.index + 1) % n; audio.sfx('select'); }
    if (input.pressed('a')) {
      audio.sfx('select');
      const item = this.items[this.index];
      if (item === 'CONTINUA') {
        const loaded = GameState.load();
        if (loaded) {
          setState(loaded);
          this.game.replaceAll(new WorldScene(loaded.mapId, loaded.x, loaded.y, loaded.dir));
        } else {
          this.game.push(new DialogueScene({ lines: ['Salvataggio non leggibile.'] }));
        }
      } else {
        this.phase = 'name';
      }
    }
  }

  private startNew(name: string): void {
    const s = newGame(name);
    s.mapId = 'camera_giocatore';
    s.x = 3;
    s.y = 4;
    s.dir = 'down';
    const world = new WorldScene(s.mapId, s.x, s.y, s.dir);
    this.game.replaceAll(world);
    this.game.push(new DialogueScene({
      lines: [
        `Benvenuto a Verdania, ${name}!`,
        'Una regione di boschi, sentieri e creature che nessuno ha ancora catalogato del tutto.',
        'Oggi comincia il tuo viaggio: scendi le scale, tua madre ti sta aspettando.',
      ],
    }));
  }

  render(r: Renderer): void {
    const g = r.ctx;
    // Cielo con gradiente a bande.
    const sky = [
      '#141f42', '#1a2a52', '#22355f', '#2a406e', '#33507e', '#3d608e',
      '#4a729e', '#5a86b0', '#6d9ac2', '#82aed2', '#99c2e0', '#b0d8ee',
    ];
    const bandH = Math.ceil(SCREEN_H / sky.length);
    for (let i = 0; i < sky.length; i++) {
      g.fillStyle = sky[i];
      g.fillRect(0, i * bandH, SCREEN_W, bandH);
    }
    // Stelle.
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      const x = (i * 37) % SCREEN_W;
      const y = (i * 23) % 60;
      const tw = (Math.sin(this.t / 20 + i) + 1) / 2;
      if (tw > 0.6) g.fillRect(x, y, 1, 1);
    }
    // Colline su tre piani.
    g.fillStyle = '#24503a';
    for (let x = 0; x < SCREEN_W; x++) {
      const h = 52 + Math.round(Math.sin(x / 41) * 8 + Math.sin(x / 13 + 1) * 3);
      g.fillRect(x, SCREEN_H - h, 1, h);
    }
    g.fillStyle = '#2f6b46';
    for (let x = 0; x < SCREEN_W; x++) {
      const h = 40 + Math.round(Math.sin(x / 34) * 7 + Math.sin(x / 11) * 3);
      g.fillRect(x, SCREEN_H - h, 1, h);
    }
    g.fillStyle = '#3f8a58';
    for (let x = 0; x < SCREEN_W; x++) {
      const h = 26 + Math.round(Math.sin(x / 21 + 2) * 5 + Math.sin(x / 7) * 2);
      g.fillRect(x, SCREEN_H - h, 1, h);
    }
    g.fillStyle = '#4fa066';
    g.fillRect(0, SCREEN_H - 12, SCREEN_W, 12);

    // Creature decorative.
    const bob = Math.round(Math.sin(this.t / 24) * 2);
    const f = getSpecies('foglietta');
    const b = getSpecies('braciolo');
    const w = getSpecies('gocciolo');
    g.drawImage(creatureSprite(f.id, f.look, false), 2, SCREEN_H - 66 + bob);
    g.drawImage(creatureSprite(w.id, w.look, false), SCREEN_W - 58, SCREEN_H - 68 - bob);
    g.drawImage(creatureSprite(b.id, b.look, false), 92, SCREEN_H - 60 + Math.round(Math.sin(this.t / 19) * 2));

    // Titolo.
    const ty = 16 + Math.round(Math.sin(this.t / 30) * 2);
    drawTitle(g, 'VERDANIA', SCREEN_W / 2, ty);
    drawTextCentered(g, 'Avventura fra i sentieri', SCREEN_W / 2, ty + 30, {
      color: '#e8f4ff', shadow: '#1a2a52',
    });

    if (this.phase === 'menu') {
      const w2 = 108;
      const h2 = this.items.length * 16 + 12;
      const x = Math.round((SCREEN_W - w2) / 2);
      const y = 88;
      drawWindow(g, x, y, w2, h2, WIN_STYLE);
      for (let i = 0; i < this.items.length; i++) {
        const iy = y + 7 + i * 16;
        if (i === this.index) g.drawImage(menuCursor(), x + 8, iy + 1);
        drawText(g, this.items[i], x + 18, iy, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      }
      if (this.t % 90 < 60) {
        drawTextCentered(g, 'Z o Invio: conferma', SCREEN_W / 2, SCREEN_H - 11, {
          color: '#ffffff', shadow: '#12281c',
        });
      }
    } else {
      const w2 = 150;
      const h2 = 74;
      const x = Math.round((SCREEN_W - w2) / 2);
      const y = 74;
      drawWindow(g, x, y, w2, h2, WIN_STYLE);
      drawText(g, 'Come ti chiami?', x + 12, y + 8, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      for (let i = 0; i < NAMES.length; i++) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const nx = x + 16 + col * 44;
        const ny = y + 26 + row * 16;
        if (i === this.nameIndex) g.drawImage(menuCursor(), nx - 8, ny + 1);
        drawText(g, NAMES[i], nx, ny, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      }
      drawText(g, 'X: indietro', x + 12, y + h2 - 14, { color: '#5a6478', shadow: null });
      const hero = getCharacter('hero').down[Math.floor(this.t / 12) % 4];
      g.drawImage(hero, x + w2 - 26, y + 30);
    }
  }
}

/** Logo del gioco disegnato con blocchi pieni e contorno. */
function drawTitle(g: CanvasRenderingContext2D, text: string, cx: number, y: number): void {
  const scale = 3;
  const glyphW = 6 * scale;
  const total = text.length * glyphW;
  const x0 = Math.round(cx - total / 2);
  for (let i = 0; i < text.length; i++) {
    drawBigChar(g, text[i], x0 + i * glyphW, y, scale);
  }
}

const BIG: Record<string, string[]> = {
  V: ['#...#', '#...#', '#...#', '.#.#.', '..#..'],
  E: ['#####', '#....', '###..', '#....', '#####'],
  R: ['####.', '#...#', '####.', '#..#.', '#...#'],
  D: ['####.', '#...#', '#...#', '#...#', '####.'],
  A: ['.###.', '#...#', '#####', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '#####'],
};

function drawBigChar(g: CanvasRenderingContext2D, ch: string, x: number, y: number, s: number): void {
  const rows = BIG[ch];
  if (!rows) return;
  for (let ry = 0; ry < rows.length; ry++) {
    for (let rx = 0; rx < rows[ry].length; rx++) {
      if (rows[ry][rx] !== '#') continue;
      // Contorno scuro.
      g.fillStyle = '#12203a';
      g.fillRect(x + rx * s - 1, y + ry * s - 1, s + 2, s + 2);
    }
  }
  for (let ry = 0; ry < rows.length; ry++) {
    for (let rx = 0; rx < rows[ry].length; rx++) {
      if (rows[ry][rx] !== '#') continue;
      const grad = ry < 2 ? '#ffe98a' : ry < 4 ? '#f0c04a' : '#d89a2a';
      g.fillStyle = grad;
      g.fillRect(x + rx * s, y + ry * s, s, s);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x + rx * s, y + ry * s, s, 1);
    }
  }
}
