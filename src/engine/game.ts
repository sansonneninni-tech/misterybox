/** Ciclo principale, stack delle scene e transizioni schermo. */

import { STEP } from './const';
import { Input } from './input';
import { Renderer } from './renderer';
import { Scene } from './scene';

type TransitionKind = 'fade' | 'battle' | 'door' | 'none';

interface Transition {
  kind: TransitionKind;
  t: number;
  half: boolean;
  outFrames: number;
  inFrames: number;
  color: string;
  mid: () => void;
  done?: () => void;
}

export class Game {
  readonly renderer: Renderer;
  readonly input = new Input();
  private scenes: Scene[] = [];
  private acc = 0;
  private last = 0;
  private running = false;
  private transition: Transition | null = null;
  /** Contatore di frame logici trascorsi: utile per animazioni globali. */
  frame = 0;
  /** Errori runtime raccolti (mostrati nei test). */
  readonly errors: string[] = [];

  constructor(view: HTMLCanvasElement) {
    this.renderer = new Renderer(view);
    this.input.attach(window);
  }

  // --- gestione scene ---------------------------------------------------

  get current(): Scene | undefined {
    return this.scenes[this.scenes.length - 1];
  }

  /** Scena in cima con un tipo atteso, oppure undefined. */
  find<T extends Scene>(pred: (s: Scene) => s is T): T | undefined {
    for (let i = this.scenes.length - 1; i >= 0; i--) {
      const s = this.scenes[i];
      if (pred(s)) return s;
    }
    return undefined;
  }

  push(scene: Scene): void {
    this.current?.pause();
    scene.bind(this);
    this.scenes.push(scene);
    scene.enter();
  }

  pop(): Scene | undefined {
    const s = this.scenes.pop();
    s?.exit();
    this.current?.resume();
    return s;
  }

  /** Sostituisce l'intero stack. */
  replaceAll(scene: Scene): void {
    while (this.scenes.length) this.pop();
    this.push(scene);
  }

  /** Sostituisce solo la scena in cima. */
  replace(scene: Scene): void {
    this.pop();
    this.push(scene);
  }

  popTo(scene: Scene): void {
    while (this.scenes.length && this.current !== scene) this.pop();
  }

  stackDepth(): number {
    return this.scenes.length;
  }

  // --- transizioni ------------------------------------------------------

  get inTransition(): boolean {
    return this.transition !== null;
  }

  startTransition(
    kind: TransitionKind,
    mid: () => void,
    opts: { out?: number; in?: number; color?: string; done?: () => void } = {},
  ): void {
    if (this.transition) {
      // Una transizione gia' in corso: esegui subito quella nuova a fine corrente.
      this.transition.mid();
      this.transition = null;
    }
    this.transition = {
      kind,
      t: 0,
      half: false,
      outFrames: opts.out ?? (kind === 'battle' ? 46 : 18),
      inFrames: opts.in ?? 18,
      color: opts.color ?? '#000000',
      mid,
      done: opts.done,
    };
  }

  private updateTransition(): void {
    const tr = this.transition;
    if (!tr) return;
    tr.t++;
    if (!tr.half && tr.t >= tr.outFrames) {
      tr.half = true;
      tr.t = 0;
      try {
        tr.mid();
      } catch (e) {
        this.reportError(e);
      }
    } else if (tr.half && tr.t >= tr.inFrames) {
      this.transition = null;
      try {
        tr.done?.();
      } catch (e) {
        this.reportError(e);
      }
    }
  }

  private renderTransition(): void {
    const tr = this.transition;
    if (!tr) return;
    const r = this.renderer;
    const p = tr.half
      ? 1 - Math.min(1, tr.t / tr.inFrames)
      : Math.min(1, tr.t / tr.outFrames);

    if (tr.kind === 'battle') {
      drawBattleWipe(r, p, tr.half);
    } else if (tr.kind === 'door') {
      // Iride che si chiude/apre.
      const g = r.ctx;
      const maxR = 150;
      const rad = (1 - p) * maxR;
      g.save();
      g.fillStyle = tr.color;
      g.beginPath();
      g.rect(0, 0, r.buffer.width, r.buffer.height);
      g.arc(r.buffer.width / 2, r.buffer.height / 2, Math.max(0, rad), 0, Math.PI * 2, true);
      g.fill('evenodd');
      g.restore();
    } else if (tr.kind !== 'none') {
      r.veil(tr.color, p);
    }
  }

  // --- ciclo ------------------------------------------------------------

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      requestAnimationFrame(tick);
      let delta = (now - this.last) / 1000;
      this.last = now;
      if (delta > 0.25) delta = 0.25; // evita salti dopo un tab in background
      this.acc += delta;
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        this.acc -= STEP;
        steps++;
        this.step();
      }
      this.draw();
    };
    requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
  }

  private step(): void {
    this.frame++;
    this.input.beginFrame();
    try {
      this.updateTransition();
      // Aggiorna le scene dall'alto verso il basso finche' una blocca.
      // La copia evita che una scena inserita durante questo frame riceva
      // lo stesso input che l'ha aperta.
      const list = this.scenes.slice();
      const startIdx = (() => {
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i].blocksUpdate) return i;
        }
        return 0;
      })();
      for (let i = startIdx; i < list.length; i++) list[i].update(STEP);
    } catch (e) {
      this.reportError(e);
    }
    this.input.endFrame();
  }

  private draw(): void {
    const r = this.renderer;
    try {
      r.clear('#000000');
      // Trova la scena opaca piu' in alto e disegna da li' in su.
      let startIdx = 0;
      for (let i = this.scenes.length - 1; i >= 0; i--) {
        if (this.scenes[i].opaque) {
          startIdx = i;
          break;
        }
      }
      for (let i = startIdx; i < this.scenes.length; i++) this.scenes[i].render(r);
      this.renderTransition();
    } catch (e) {
      this.reportError(e);
    }
    r.present();
  }

  reportError(e: unknown): void {
    const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
    this.errors.push(msg);
    console.error('[Verdania]', e);
  }
}

/** Effetto di ingresso in battaglia: barre orizzontali che coprono lo schermo. */
function drawBattleWipe(r: Renderer, p: number, closing: boolean): void {
  const g = r.ctx;
  const W = r.buffer.width;
  const H = r.buffer.height;
  const bars = 10;
  const bh = H / bars;
  g.save();
  g.fillStyle = '#000000';
  for (let i = 0; i < bars; i++) {
    const local = Math.max(0, Math.min(1, p * 1.6 - (i % 2 === 0 ? 0 : 0.25)));
    const w = W * local;
    const x = i % 2 === 0 ? 0 : W - w;
    g.fillRect(x, i * bh, w, Math.ceil(bh));
  }
  if (p >= 0.98 || (closing && p >= 0.98)) {
    g.fillRect(0, 0, W, H);
  }
  g.restore();
}
