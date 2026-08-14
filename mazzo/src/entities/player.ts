/**
 * Mazzo. Si muove liberamente sui pixel, non a caselle: il passo resta
 * morbido ma l'urto contro i muri e' preciso.
 */

import { TILE, WALK_SPEED } from '../engine/const';
import { buildActor, type ActorSprites, type Dir } from '../gfx/actors';
import { solidAt, type MapDef } from '../world/map';

/** Riquadro dei piedi: solo la parte bassa dello sprite urta contro le cose. */
const FOOT = { ox: 4, oy: 17, w: 8, h: 6 };

export class Player {
  x: number;
  y: number;
  dir: Dir = 'down';
  moving = false;
  private anim = 0;
  private sprites: ActorSprites;
  /** Casella occupata al passo precedente: serve a scattare le uscite. */
  lastTile = { x: -1, y: -1 };

  constructor(tileX: number, tileY: number, dir: Dir) {
    this.x = tileX * TILE;
    this.y = tileY * TILE - 8;
    this.dir = dir;
    this.sprites = buildActor({});
  }

  get tileX(): number {
    return Math.floor((this.x + FOOT.ox + FOOT.w / 2) / TILE);
  }

  get tileY(): number {
    return Math.floor((this.y + FOOT.oy + FOOT.h / 2) / TILE);
  }

  /** Centro dei piedi, in pixel: usato per l'ombra e per l'ordine di disegno. */
  get feetX(): number {
    return this.x + FOOT.ox + FOOT.w / 2;
  }

  get feetY(): number {
    return this.y + FOOT.oy + FOOT.h;
  }

  private blocked(map: MapDef, nx: number, ny: number, extra: (x: number, y: number) => boolean): boolean {
    const left = nx + FOOT.ox;
    const top = ny + FOOT.oy;
    const right = left + FOOT.w - 1;
    const bottom = top + FOOT.h - 1;
    for (let ty = Math.floor(top / TILE); ty <= Math.floor(bottom / TILE); ty++) {
      for (let tx = Math.floor(left / TILE); tx <= Math.floor(right / TILE); tx++) {
        if (solidAt(map, tx, ty) || extra(tx, ty)) return true;
      }
    }
    return false;
  }

  /**
   * Muove di un passo. `extra` segnala le caselle occupate da altri
   * personaggi. Gli assi vengono provati separatamente, cosi' strisciare
   * lungo un muro non blocca del tutto.
   */
  move(dt: number, ax: number, ay: number, map: MapDef, extra: (x: number, y: number) => boolean): void {
    this.moving = ax !== 0 || ay !== 0;
    if (!this.moving) {
      this.anim = 0;
      return;
    }
    // In diagonale la velocita' non deve aumentare.
    const len = Math.hypot(ax, ay) || 1;
    const step = (WALK_SPEED * dt) / len;

    if (ay !== 0) this.dir = ay < 0 ? 'up' : 'down';
    if (ax !== 0) this.dir = ax < 0 ? 'left' : 'right';

    const nx = this.x + ax * step;
    let movedX = false;
    if (ax !== 0 && !this.blocked(map, nx, this.y, extra)) {
      this.x = nx;
      movedX = true;
    }
    const ny = this.y + ay * step;
    let movedY = false;
    if (ay !== 0 && !this.blocked(map, this.x, ny, extra)) {
      this.y = ny;
      movedY = true;
    }

    // Correzione d'angolo: se si urta lo spigolo di un varco, il personaggio
    // scivola da solo verso il centro della casella invece di incastrarsi.
    if (ax !== 0 && !movedX) this.slide(map, extra, step, 'y');
    if (ay !== 0 && !movedY) this.slide(map, extra, step, 'x');

    this.anim += dt * 6.5;
  }

  /** Avvicina di un soffio l'asse indicato al centro della casella. */
  private slide(map: MapDef, extra: (x: number, y: number) => boolean, step: number, axis: 'x' | 'y'): void {
    if (axis === 'y') {
      const target = Math.round((this.y + FOOT.oy) / TILE) * TILE + (TILE - FOOT.h) / 2 - FOOT.oy;
      const diff = target - this.y;
      if (Math.abs(diff) < 0.5 || Math.abs(diff) > TILE / 2) return;
      const ny = this.y + Math.sign(diff) * Math.min(step, Math.abs(diff));
      if (!this.blocked(map, this.x, ny, extra)) this.y = ny;
    } else {
      const target = Math.round((this.x + FOOT.ox) / TILE) * TILE + (TILE - FOOT.w) / 2 - FOOT.ox;
      const diff = target - this.x;
      if (Math.abs(diff) < 0.5 || Math.abs(diff) > TILE / 2) return;
      const nx = this.x + Math.sign(diff) * Math.min(step, Math.abs(diff));
      if (!this.blocked(map, nx, this.y, extra)) this.x = nx;
    }
  }

  /** Fotogramma corrente: fermo, passo aperto, passo chiuso. */
  get sprite(): HTMLCanvasElement {
    const frames = this.sprites.frames[this.dir];
    if (!this.moving) return frames[0];
    const cycle = Math.floor(this.anim) % 4;
    return cycle === 1 ? frames[1] : cycle === 3 ? frames[2] : frames[0];
  }

  /** Saltello di un pixel a meta' passo: il camminare si legge meglio. */
  get bob(): number {
    if (!this.moving) return 0;
    const cycle = Math.floor(this.anim) % 4;
    return cycle === 3 ? -1 : 0;
  }
}
