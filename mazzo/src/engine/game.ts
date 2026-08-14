/**
 * Ciclo di gioco: passo logico fisso, una scena attiva alla volta e una
 * transizione a dissolvenza usata per passare da un livello all'altro.
 */

import { STEP } from './const';
import type { Input } from './input';
import type { Renderer } from './renderer';
import type { Scene } from './scene';
import type { Audio } from './audio';
import type { GameState } from '../systems/state';

type SceneFactory = () => Scene;

interface Fade {
  /** 'out' porta al nero, 'in' torna all'immagine. */
  mode: 'out' | 'in';
  t: number;
  dur: number;
  hold: number;
  next: SceneFactory | null;
}

export class Game {
  readonly input: Input;
  readonly renderer: Renderer;
  readonly audio: Audio;
  readonly state: GameState;

  private scene: Scene | null = null;
  private fade: Fade | null = null;
  private acc = 0;
  private last = 0;
  private running = false;

  constructor(renderer: Renderer, input: Input, audio: Audio, state: GameState) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;
    this.state = state;
  }

  /** Sostituisce subito la scena attiva. */
  setScene(scene: Scene): void {
    if (this.scene) this.scene.exit();
    scene.bind(this);
    this.scene = scene;
    scene.enter();
  }

  get current(): Scene | null {
    return this.scene;
  }

  /** Vero mentre una dissolvenza e' in corso: le scene bloccano l'input. */
  get transitioning(): boolean {
    return this.fade !== null;
  }

  /** Dissolvenza al nero, cambio scena, dissolvenza dal nero. */
  transitionTo(factory: SceneFactory, dur = 0.6, hold = 0.35): void {
    // Un cambio scena gia' avviato non si interrompe. Una semplice apertura
    // dal nero invece si: se il giocatore preme subito, deve partire lo stesso.
    if (this.fade && (this.fade.mode === 'out' || this.fade.next)) return;
    const from = this.fadeAlpha;
    this.fade = { mode: 'out', t: from * dur, dur, hold, next: factory };
  }

  /** Solo apertura dal nero (avvio del gioco). */
  fadeIn(dur = 0.8): void {
    this.fade = { mode: 'in', t: 0, dur, hold: 0, next: null };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      let dt = (now - this.last) / 1000;
      this.last = now;
      // Dopo un cambio di scheda dt puo' valere secondi: meglio troncare.
      if (dt > 0.25) dt = 0.25;
      this.acc += dt;
      let guard = 0;
      while (this.acc >= STEP && guard < 8) {
        this.step(STEP);
        this.acc -= STEP;
        guard++;
      }
      if (guard >= 8) this.acc = 0;
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
  }

  /** Un singolo passo logico. Pubblico per i test automatici. */
  step(dt: number): void {
    this.updateFade(dt);
    if (this.scene) this.scene.update(dt);
    this.input.endFrame();
  }

  private updateFade(dt: number): void {
    const f = this.fade;
    if (!f) return;
    f.t += dt;
    if (f.mode === 'out' && f.t >= f.dur) {
      // Nero pieno: si cambia scena e si resta fermi per il tempo di "hold".
      if (f.next) {
        const scene = f.next();
        f.next = null;
        this.setScene(scene);
      }
      if (f.t >= f.dur + f.hold) {
        this.fade = { mode: 'in', t: 0, dur: f.dur, hold: 0, next: null };
      }
    } else if (f.mode === 'in' && f.t >= f.dur) {
      this.fade = null;
    }
  }

  /** Opacita' del velo nero, 0..1. */
  get fadeAlpha(): number {
    const f = this.fade;
    if (!f) return 0;
    if (f.mode === 'out') return Math.min(1, f.t / f.dur);
    return Math.max(0, 1 - f.t / f.dur);
  }

  draw(): void {
    const r = this.renderer;
    r.clear('#000000');
    if (this.scene) this.scene.render(r);
    r.veil('#000000', this.fadeAlpha);
    r.present();
  }
}
