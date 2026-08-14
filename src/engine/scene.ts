/** Scena base: unita' logica dello stack (mondo, battaglia, menu, dialoghi...). */

import type { Game } from './game';
import type { Renderer } from './renderer';

export abstract class Scene {
  /** Se false, la scena sottostante viene comunque disegnata (utile per i menu). */
  opaque = true;
  /** Se false, la scena sottostante continua ad aggiornarsi. */
  blocksUpdate = true;

  protected game!: Game;

  bind(game: Game): void {
    this.game = game;
  }

  enter(): void {}
  exit(): void {}
  /** Chiamata quando la scena torna in cima allo stack. */
  resume(): void {}
  /** Chiamata quando un'altra scena viene messa sopra. */
  pause(): void {}

  abstract update(dt: number): void;
  abstract render(r: Renderer): void;
}
