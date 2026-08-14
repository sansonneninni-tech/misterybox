/** Personaggi fermi: respirano appena e si girano verso Mazzo quando parla. */

import { TILE } from '../engine/const';
import { buildActor, type ActorSprites, type Dir } from '../gfx/actors';
import type { NpcDef } from '../world/map';

export class Npc {
  readonly def: NpcDef;
  dir: Dir;
  private sprites: ActorSprites;
  private t = 0;

  constructor(def: NpcDef) {
    this.def = def;
    this.dir = def.dir;
    this.sprites = buildActor(def.look);
    // Sfasatura iniziale: non respirano tutti allo stesso tempo.
    this.t = (def.x * 7 + def.y * 3) % 10;
  }

  get tileX(): number {
    return this.def.x;
  }

  get tileY(): number {
    return this.def.y;
  }

  get x(): number {
    return this.def.x * TILE;
  }

  get y(): number {
    return this.def.y * TILE - 8;
  }

  get feetY(): number {
    return this.y + 23;
  }

  update(dt: number): void {
    this.t += dt;
  }

  /** Si gira verso una casella (quando Mazzo gli parla). */
  faceTowards(x: number, y: number): void {
    if (!this.def.turns) return;
    const dx = x - this.def.x;
    const dy = y - this.def.y;
    if (Math.abs(dx) >= Math.abs(dy)) this.dir = dx < 0 ? 'left' : 'right';
    else this.dir = dy < 0 ? 'up' : 'down';
  }

  get sprite(): HTMLCanvasElement {
    return this.sprites.frames[this.dir][0];
  }

  /** Respiro: un pixel su e giu', molto lento. */
  get bob(): number {
    return Math.sin(this.t * 1.1) > 0.85 ? -1 : 0;
  }
}
