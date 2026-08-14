/** Scena di dialogo sovrapposta al mondo. */

import { Scene } from '../engine/scene';
import type { Renderer } from '../engine/renderer';
import { Choice, Textbox } from '../ui/textbox';

export interface DialogueOptions {
  lines: string[];
  speaker?: string | null;
  choices?: Choice[] | null;
  onDone?: (choice: string | null) => void;
}

export class DialogueScene extends Scene {
  override opaque = false;
  override blocksUpdate = true;
  private box = new Textbox();
  private opts: DialogueOptions;
  private closing = false;

  constructor(opts: DialogueOptions) {
    super();
    this.opts = opts;
  }

  override enter(): void {
    this.box.setText(this.opts.lines, {
      speaker: this.opts.speaker ?? null,
      choices: this.opts.choices ?? null,
    });
  }

  update(): void {
    if (this.closing) return;
    if (this.box.update(this.game.input)) {
      this.closing = true;
      const result = this.box.choiceResult;
      this.game.pop();
      this.opts.onDone?.(result);
    }
  }

  render(r: Renderer): void {
    this.box.render(r);
  }
}
