/**
 * Esecutore degli script: manda avanti le battute una alla volta, con effetto
 * macchina da scrivere e piccole pause. Finche' e' attivo il giocatore non
 * puo' muoversi.
 */

import type { Input } from '../engine/input';
import type { Audio } from '../engine/audio';
import { isSay, sayText, type Script, type Step } from './script';
import type { Ctx } from './state';

const CHARS_PER_SEC = 46;

export interface ActiveLine {
  text: string;
  who?: string;
  /** Caratteri gia' scritti. */
  shown: number;
  done: boolean;
}

export class Dialogue {
  private queue: Step[] = [];
  private line: ActiveLine | null = null;
  private caption: { text: string; t: number; hold: number } | null = null;
  private timer = 0;
  private ctx: Ctx;
  private audio: Audio;
  private typeAccum = 0;
  private onEnd: (() => void) | null = null;

  constructor(ctx: Ctx, audio: Audio) {
    this.ctx = ctx;
    this.audio = audio;
  }

  get active(): boolean {
    return this.line !== null || this.queue.length > 0 || this.timer > 0 || this.caption !== null;
  }

  get currentLine(): ActiveLine | null {
    return this.line;
  }

  get currentCaption(): string | null {
    return this.caption ? this.caption.text : null;
  }

  /** Trasparenza della scritta centrale: entra e esce in dissolvenza. */
  get captionAlpha(): number {
    const c = this.caption;
    if (!c) return 0;
    const fade = 0.4;
    if (c.t < fade) return c.t / fade;
    if (c.t > c.hold - fade) return Math.max(0, (c.hold - c.t) / fade);
    return 1;
  }

  play(script: Script, onEnd?: () => void): void {
    this.queue = [...script];
    this.onEnd = onEnd ?? null;
    this.line = null;
    this.timer = 0;
    this.next();
  }

  cancel(): void {
    this.queue = [];
    this.line = null;
    this.caption = null;
    this.timer = 0;
    this.onEnd = null;
  }

  private next(): void {
    if (this.queue.length === 0) {
      this.line = null;
      const end = this.onEnd;
      this.onEnd = null;
      if (end) end();
      return;
    }
    const step = this.queue.shift()!;
    if (isSay(step)) {
      const { text, who } = sayText(step);
      this.line = who ? { text, who, shown: 0, done: false } : { text, shown: 0, done: false };
      this.typeAccum = 0;
      return;
    }
    if ('wait' in step) {
      this.line = null;
      this.timer = step.wait;
      return;
    }
    if ('caption' in step) {
      this.line = null;
      this.caption = { text: step.caption, t: 0, hold: step.hold ?? 2.2 };
      return;
    }
    step.do(this.ctx);
    this.next();
  }

  update(dt: number, input: Input): void {
    if (this.caption) {
      this.caption.t += dt;
      // Si puo' saltare, ma non prima che la scritta sia leggibile.
      if (this.caption.t >= this.caption.hold || (this.caption.t > 0.6 && input.pressed('act'))) {
        this.caption = null;
        this.next();
      }
      return;
    }
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 0;
        this.next();
      }
      return;
    }
    const line = this.line;
    if (!line) return;

    if (!line.done) {
      this.typeAccum += dt * CHARS_PER_SEC;
      while (this.typeAccum >= 1 && line.shown < line.text.length) {
        line.shown++;
        this.typeAccum -= 1;
        if (line.shown % 3 === 0) this.audio.type();
      }
      if (line.shown >= line.text.length) line.done = true;
      // Il primo tocco completa la riga, il secondo la manda avanti.
      if (input.pressed('act')) {
        line.shown = line.text.length;
        line.done = true;
      }
      return;
    }
    if (input.pressed('act')) {
      this.audio.select();
      this.next();
    }
  }
}
