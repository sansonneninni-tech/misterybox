/** Entita' che si muove sulla griglia con interpolazione fluida. */

import { TILE, WALK_FRAMES } from '../engine/const';
import type { Dir } from '../gfx/chars';

export type BlockedFn = (x: number, y: number, self: Entity) => boolean;

export class Entity {
  tx: number;
  ty: number;
  /** Scostamento in pixel rispetto al tile corrente durante il movimento. */
  ox = 0;
  oy = 0;
  dir: Dir = 'down';
  sprite: string;
  moving = false;
  /** Alterna la gamba a ogni passo. */
  private parity = false;
  private moveTimer = 0;
  private moveDur = WALK_FRAMES;
  private fromX = 0;
  private fromY = 0;
  /** Salto da un dislivello. */
  jumping = false;
  private jumpT = 0;
  visible = true;
  /** Ritardo prima di poter muoversi di nuovo (rotazione sul posto). */
  turnDelay = 0;

  constructor(x: number, y: number, sprite: string, dir: Dir = 'down') {
    this.tx = x;
    this.ty = y;
    this.sprite = sprite;
    this.dir = dir;
  }

  get pixelX(): number {
    return this.tx * TILE + this.ox;
  }

  get pixelY(): number {
    return this.ty * TILE + this.oy;
  }

  /** Tile davanti all'entita'. */
  facingTile(): { x: number; y: number } {
    const d = DIR_VEC[this.dir];
    return { x: this.tx + d.x, y: this.ty + d.y };
  }

  /** Fotogramma di animazione corrente (0..3). */
  animFrame(): number {
    if (this.jumping) return 1;
    if (!this.moving) return 0;
    return this.parity ? 1 : 3;
  }

  /** Altezza aggiuntiva durante un salto. */
  jumpOffset(): number {
    if (!this.jumping) return 0;
    const t = this.jumpT / this.moveDur;
    return -Math.round(Math.sin(t * Math.PI) * 10);
  }

  face(dir: Dir): void {
    this.dir = dir;
  }

  canStart(): boolean {
    return !this.moving && this.turnDelay <= 0;
  }

  /** Avvia lo spostamento di un tile. Ritorna false se bloccato. */
  tryMove(dir: Dir, blocked: BlockedFn, opts: { run?: boolean; jump?: boolean } = {}): boolean {
    if (this.moving) return false;
    this.dir = dir;
    const d = DIR_VEC[dir];
    const jump = opts.jump === true;
    const dist = jump ? 2 : 1;
    const nx = this.tx + d.x * dist;
    const ny = this.ty + d.y * dist;
    if (!jump && blocked(nx, ny, this)) return false;
    this.fromX = this.tx;
    this.fromY = this.ty;
    this.tx = nx;
    this.ty = ny;
    this.moving = true;
    this.jumping = jump;
    this.jumpT = 0;
    this.moveDur = jump ? 22 : opts.run ? 9 : WALK_FRAMES;
    this.moveTimer = this.moveDur;
    this.ox = (this.fromX - this.tx) * TILE;
    this.oy = (this.fromY - this.ty) * TILE;
    this.parity = !this.parity;
    return true;
  }

  /** Da chiamare a ogni frame logico. */
  update(): void {
    if (this.turnDelay > 0) this.turnDelay--;
    if (!this.moving) {
      this.ox = 0;
      this.oy = 0;
      return;
    }
    this.moveTimer--;
    this.jumpT++;
    const t = 1 - this.moveTimer / this.moveDur;
    this.ox = Math.round((this.fromX - this.tx) * TILE * (1 - t));
    this.oy = Math.round((this.fromY - this.ty) * TILE * (1 - t));
    if (this.moveTimer <= 0) {
      this.moving = false;
      this.jumping = false;
      this.ox = 0;
      this.oy = 0;
      this.arrived = true;
    }
  }

  /** Vero solo nel frame in cui l'entita' completa lo spostamento. */
  private arrived = false;

  consumeArrived(): boolean {
    if (!this.arrived) return false;
    this.arrived = false;
    return true;
  }
}

export const DIR_VEC: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};
