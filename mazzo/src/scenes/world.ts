/**
 * Scena principale: disegna la mappa, muove Mazzo, gestisce interazioni e
 * dialoghi. Vale per tutti e tre i livelli, cambia solo la mappa.
 */

import { SCREEN_H, SCREEN_W, TILE } from '../engine/const';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';
import { drawShadow } from '../gfx/actors';
import { P } from '../gfx/palette';
import { tileCanvas, tileDef, variantAt } from '../gfx/tiles';
import { Npc } from '../entities/npc';
import { Player } from '../entities/player';
import { Dialogue } from '../systems/dialogue';
import type { Script } from '../systems/script';
import type { Ctx } from '../systems/state';
import { mapPixelHeight, mapPixelWidth, tileAt, tileInFront, type MapDef } from '../world/map';
import { CARRY_LABELS } from '../world/maps/bar';
import { drawCaption, drawCarry, drawDialogue, drawHint, drawObjective } from '../ui/hud';

export class WorldScene extends Scene {
  override readonly name: string;

  private map: MapDef;
  private player!: Player;
  private npcs: Npc[] = [];
  private dialogue!: Dialogue;
  private ctx!: Ctx;
  private objective = '';
  private t = 0;
  private hint = false;

  constructor(map: MapDef) {
    super();
    this.map = map;
    this.name = map.id;
  }

  override enter(): void {
    const map = this.map;
    this.player = new Player(map.spawn.x, map.spawn.y, map.spawn.dir);
    this.npcs = map.npcs.map((d) => new Npc(d));

    this.ctx = {
      state: this.game.state,
      audio: this.game.audio,
      game: this.game,
      setObjective: (text) => {
        this.objective = text;
      },
      goto: (level) => this.game.transitionTo(() => makeScene(level)),
      say: (script, onEnd) => this.dialogue.play(script, onEnd),
      faceMazzo: (id) => {
        const npc = this.npcs.find((n) => n.def.id === id);
        if (npc) npc.faceTowards(this.player.tileX, this.player.tileY);
      },
    };

    this.dialogue = new Dialogue(this.ctx, this.game.audio);
    this.objective = map.objective(this.ctx);
    this.game.audio.setAmbience(map.ambience);
    this.player.lastTile = { x: this.player.tileX, y: this.player.tileY };
    if (map.intro) this.dialogue.play(map.intro(this.ctx));
  }

  /** Un personaggio occupa la sua casella: non ci si passa attraverso. */
  private npcAt = (x: number, y: number): boolean =>
    this.npcs.some((n) => n.tileX === x && n.tileY === y);

  override update(dt: number): void {
    this.t += dt;
    for (const n of this.npcs) n.update(dt);

    if (this.dialogue.active) {
      this.dialogue.update(dt, this.game.input);
      return;
    }
    if (this.game.transitioning) return;

    const { x: ax, y: ay } = this.game.input.axis();
    this.player.move(dt, ax, ay, this.map, this.npcAt);

    const tx = this.player.tileX;
    const ty = this.player.tileY;
    if (tx !== this.player.lastTile.x || ty !== this.player.lastTile.y) {
      this.player.lastTile = { x: tx, y: ty };
      if (this.map.onStep) this.map.onStep(this.ctx, tx, ty);
      this.objective = this.map.objective(this.ctx);
    }

    const front = tileInFront(tx, ty, this.player.dir);
    this.hint = this.targetAt(front.x, front.y) !== null;

    if (this.game.input.pressed('act')) {
      const script = this.targetAt(front.x, front.y);
      if (script) {
        this.game.audio.select();
        this.dialogue.play(script, () => {
          this.objective = this.map.objective(this.ctx);
        });
      }
    }
  }

  /** Cosa c'e' davanti a Mazzo: prima le persone, poi le cose. */
  private targetAt(x: number, y: number): Script | null {
    const npc = this.npcs.find((n) => n.tileX === x && n.tileY === y);
    if (npc) {
      npc.faceTowards(this.player.tileX, this.player.tileY);
      return npc.def.script(this.ctx);
    }
    const obj = this.map.objects.find((o) => o.x === x && o.y === y);
    if (obj) return obj.script(this.ctx);
    return null;
  }

  // --- disegno ----------------------------------------------------------

  private camera(): { cx: number; cy: number } {
    const w = mapPixelWidth(this.map);
    const h = mapPixelHeight(this.map);
    let cx = this.player.x + 8 - SCREEN_W / 2;
    let cy = this.player.y + 12 - SCREEN_H / 2;
    cx = w <= SCREEN_W ? (w - SCREEN_W) / 2 : Math.max(0, Math.min(w - SCREEN_W, cx));
    cy = h <= SCREEN_H ? (h - SCREEN_H) / 2 : Math.max(0, Math.min(h - SCREEN_H, cy));
    return { cx: Math.round(cx), cy: Math.round(cy) };
  }

  override render(r: Renderer): void {
    const { cx, cy } = this.camera();
    const g = r.ctx;
    r.clear(this.map.ambience === 'street' ? P.night : '#1a150f');

    const x0 = Math.floor(cx / TILE);
    const y0 = Math.floor(cy / TILE);
    const x1 = Math.ceil((cx + SCREEN_W) / TILE);
    const y1 = Math.ceil((cy + SCREEN_H) / TILE);

    // Fondo: tutti i tile tranne quelli alti (chiome, insegne).
    const tall: Array<[number, number, string]> = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const ch = tileAt(this.map, x, y);
        const def = tileDef(ch);
        if (def.tall) {
          tall.push([x, y, ch]);
          // Sotto la chioma serve comunque un pavimento.
          g.drawImage(tileCanvas(this.map.ambience === 'street' ? 'm' : '.', variantAt(x, y)), x * TILE - cx, y * TILE - cy);
          continue;
        }
        g.drawImage(tileCanvas(ch, variantAt(x, y)), x * TILE - cx, y * TILE - cy);
        // Ombra corta a ridosso di quello che sta in piedi: basta questa a far
        // capire al volo dove si cammina e dove no.
        if (!def.solid && tileDef(tileAt(this.map, x, y - 1)).solid) {
          g.fillStyle = 'rgba(24,18,12,0.26)';
          g.fillRect(x * TILE - cx, y * TILE - cy, TILE, 3);
          g.fillStyle = 'rgba(24,18,12,0.14)';
          g.fillRect(x * TILE - cx, y * TILE - cy + 3, TILE, 2);
        }
      }
    }

    this.drawLamps(r, cx, cy);

    // Attori ordinati per profondita': chi ha i piedi piu' in basso sta davanti.
    const actors: Array<{ y: number; draw: () => void }> = [];
    actors.push({
      y: this.player.feetY,
      draw: () => {
        drawShadow(g, this.player.feetX - cx, this.player.feetY - cy - 1);
        g.drawImage(this.player.sprite, Math.round(this.player.x - cx), Math.round(this.player.y - cy + this.player.bob));
      },
    });
    for (const n of this.npcs) {
      actors.push({
        y: n.feetY,
        draw: () => {
          drawShadow(g, n.x + 8 - cx, n.feetY - cy - 1);
          g.drawImage(n.sprite, n.x - cx, n.y - cy + n.bob);
        },
      });
    }
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) a.draw();

    this.drawFans(g, cx, cy);
    for (const [x, y, ch] of tall) {
      g.drawImage(tileCanvas(ch, variantAt(x, y)), x * TILE - cx, y * TILE - cy);
    }

    if (this.map.veil) r.veil(this.map.veil, 1);

    // --- interfaccia ---
    const line = this.dialogue.currentLine;
    if (line) drawDialogue(r, line, this.t);
    else {
      drawObjective(r, this.objective);
      const carry = this.game.state.level2.carrying;
      if (carry && this.map.id === 'bar') drawCarry(r, CARRY_LABELS[carry] ?? carry.toUpperCase());
      if (this.hint && !this.dialogue.active) {
        drawHint(r, Math.round(this.player.x - cx) + 8, Math.round(this.player.y - cy) - 13, this.t);
      }
    }
    const caption = this.dialogue.currentCaption;
    if (caption) drawCaption(r, caption, this.dialogue.captionAlpha);
  }

  /** Aloni dei lampioni: luce gialla che sporca l'asfalto. */
  private drawLamps(r: Renderer, cx: number, cy: number): void {
    if (!this.map.lamps) return;
    const g = r.ctx;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const l of this.map.lamps) {
      const x = l.x * TILE + 8 - cx;
      const y = l.y * TILE + 4 - cy;
      const grad = g.createRadialGradient(x, y, 2, x, y, 46);
      grad.addColorStop(0, 'rgba(216,169,74,0.45)');
      grad.addColorStop(1, 'rgba(216,169,74,0)');
      g.fillStyle = grad;
      g.fillRect(x - 46, y - 46, 92, 92);
    }
    g.restore();
    for (const l of this.map.lamps) {
      // La lampada vera e propria, piccola e accesa.
      r.rect(l.x * TILE + 5 - cx, l.y * TILE + 1 - cy, 6, 3, P.lampGlow);
    }
  }

  /** Pale del ventilatore: girano piano, e non bastano. */
  private drawFans(g: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (!this.map.fans) return;
    for (const f of this.map.fans) {
      const x = f.x * TILE + 8 - cx;
      const y = f.y * TILE + 7 - cy;
      g.save();
      g.translate(x, y);
      g.rotate(this.t * 2.4);
      g.fillStyle = '#8e8878';
      for (let i = 0; i < 3; i++) {
        g.rotate((Math.PI * 2) / 3);
        g.fillRect(0, -1, 7, 3);
      }
      g.restore();
      g.fillStyle = '#5c584c';
      g.fillRect(x - 1, y - 1, 3, 3);
    }
  }
}

/** Costruisce la scena di un livello a partire dal suo nome. */
export function makeScene(level: 'room' | 'bar' | 'street' | 'ending'): Scene {
  // Import circolare evitato passando dal registro dei livelli.
  return sceneFactory(level);
}

let sceneFactory: (level: 'room' | 'bar' | 'street' | 'ending') => Scene = () => {
  throw new Error('Registro dei livelli non inizializzato');
};

export function registerSceneFactory(fn: (level: 'room' | 'bar' | 'street' | 'ending') => Scene): void {
  sceneFactory = fn;
}
