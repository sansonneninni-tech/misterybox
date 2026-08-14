/** Scena base: unita' logica dello stack (titolo, mondo, finale). */

import type { Game } from './game';
import type { Renderer } from './renderer';

export abstract class Scene {
  /** Nome stabile della scena: sopravvive alla minificazione. */
  abstract readonly name: string;

  protected game!: Game;

  bind(game: Game): void {
    this.game = game;
  }

  enter(): void {}
  exit(): void {}

  abstract update(dt: number): void;
  abstract render(r: Renderer): void;
}
