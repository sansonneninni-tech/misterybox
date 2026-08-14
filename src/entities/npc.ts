/** Personaggi non giocanti: comportamento, dialoghi, allenatori. */

import type { Dir } from '../gfx/chars';
import type { NpcDef } from '../world/map';
import { BlockedFn, DIR_VEC, Entity } from './entity';

const DIRS: Dir[] = ['down', 'up', 'left', 'right'];

export class Npc extends Entity {
  readonly def: NpcDef;
  private timer = 0;
  private homeX: number;
  private homeY: number;
  private paceDir = 1;
  /** Bloccato durante i dialoghi. */
  frozen = false;
  /** Allenatore gia' sconfitto. */
  defeated = false;
  /** Sta raggiungendo il giocatore dopo averlo avvistato. */
  approaching = false;
  emote = 0;

  constructor(def: NpcDef) {
    super(def.x, def.y, def.sprite, def.dir ?? 'down');
    this.def = def;
    this.homeX = def.x;
    this.homeY = def.y;
    this.timer = 30 + ((def.x * 7 + def.y * 13) % 90);
  }

  get id(): string {
    return this.def.id;
  }

  think(blocked: BlockedFn): void {
    this.update();
    if (this.frozen || this.moving) return;
    const behavior = this.def.behavior ?? 'still';
    if (behavior === 'still') return;
    this.timer--;
    if (this.timer > 0) return;
    this.timer = 60 + ((this.tx * 31 + this.ty * 17 + Math.floor(performance.now() / 97)) % 120);

    if (behavior === 'look') {
      this.dir = DIRS[(this.tx + this.ty + Math.floor(performance.now() / 800)) % 4];
      return;
    }
    if (behavior === 'wander') {
      const d = DIRS[Math.floor(Math.random() * 4)];
      const v = DIR_VEC[d];
      const nx = this.tx + v.x;
      const ny = this.ty + v.y;
      if (Math.abs(nx - this.homeX) <= 2 && Math.abs(ny - this.homeY) <= 2) {
        this.tryMove(d, blocked);
      } else {
        this.dir = d;
      }
      return;
    }
    if (behavior === 'pace-h' || behavior === 'pace-v') {
      const d: Dir = behavior === 'pace-h'
        ? (this.paceDir > 0 ? 'right' : 'left')
        : (this.paceDir > 0 ? 'down' : 'up');
      const v = DIR_VEC[d];
      const nx = this.tx + v.x;
      const ny = this.ty + v.y;
      const far = Math.abs(nx - this.homeX) > 2 || Math.abs(ny - this.homeY) > 2;
      if (far || !this.tryMove(d, blocked)) {
        this.paceDir *= -1;
      }
      this.timer = 20;
    }
  }

  /** Vero se il giocatore e' nel cono di vista dell'allenatore. */
  sees(px: number, py: number): boolean {
    if (!this.def.trainer || this.defeated) return false;
    const range = this.def.sight ?? 4;
    const v = DIR_VEC[this.dir];
    for (let i = 1; i <= range; i++) {
      if (this.tx + v.x * i === px && this.ty + v.y * i === py) return true;
    }
    return false;
  }

  /** Distanza in tile lungo la direzione di sguardo. */
  distanceTo(px: number, py: number): number {
    return Math.abs(this.tx - px) + Math.abs(this.ty - py);
  }

  faceTowards(px: number, py: number): void {
    const dx = px - this.tx;
    const dy = py - this.ty;
    if (Math.abs(dx) > Math.abs(dy)) this.dir = dx > 0 ? 'right' : 'left';
    else this.dir = dy > 0 ? 'down' : 'up';
  }
}
