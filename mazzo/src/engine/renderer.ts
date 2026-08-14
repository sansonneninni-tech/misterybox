/** Renderer: backbuffer 240x160 con scaling intero verso il canvas visibile. */

import { SCREEN_H, SCREEN_W } from './const';

export function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d', { alpha: true });
  if (!g) throw new Error('Canvas 2D non disponibile');
  g.imageSmoothingEnabled = false;
  return g;
}

export class Renderer {
  readonly buffer: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly view: HTMLCanvasElement;
  private viewCtx: CanvasRenderingContext2D;
  scale = 1;

  constructor(view: HTMLCanvasElement) {
    this.view = view;
    this.viewCtx = ctx2d(view);
    this.buffer = createCanvas(SCREEN_W, SCREEN_H);
    this.ctx = ctx2d(this.buffer);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));
  }

  /**
   * Sceglie il piu' grande ingrandimento intero che entra nello spazio
   * disponibile. Il calcolo avviene in pixel fisici: sugli schermi ad alta
   * densita' l'immagine resta perfettamente nitida e riempie molto piu' spazio
   * di quanto permetterebbe un ingrandimento intero in pixel CSS.
   */
  resize(): void {
    const margin = window.innerWidth < 560 ? 0 : 24;
    // Spazio riservato dalla pagina ospite (intestazioni, legenda dei tasti).
    const reserved = Number(document.documentElement.dataset.uiReserved ?? 0) || 0;
    const availW = Math.max(SCREEN_W / 2, window.innerWidth - margin);
    const availH = Math.max(SCREEN_H / 2, window.innerHeight - margin - reserved);
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

    const exact = Math.min((availW * dpr) / SCREEN_W, (availH * dpr) / SCREEN_H);
    const s = Math.max(1, Math.floor(exact));
    this.scale = s;
    this.view.width = SCREEN_W * s;
    this.view.height = SCREEN_H * s;

    // Su schermo grande vince l'ingrandimento intero: pixel tutti uguali.
    // Su un telefono, pero', l'intero lascerebbe meta' schermo vuoto: li' si
    // prende un buffer piu' grande e lo si adatta alla larghezza disponibile.
    let cssW = (SCREEN_W * s) / dpr;
    if (cssW < availW * 0.8 && availW < 560) {
      const bigger = Math.max(1, Math.ceil(exact));
      this.scale = bigger;
      this.view.width = SCREEN_W * bigger;
      this.view.height = SCREEN_H * bigger;
      cssW = Math.min(availW, (availH * SCREEN_W) / SCREEN_H);
    }
    this.view.style.width = `${cssW}px`;
    this.view.style.height = `${(cssW * SCREEN_H) / SCREEN_W}px`;
    this.viewCtx = ctx2d(this.view);
  }

  clear(color = '#000000'): void {
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = color;
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
  }

  /** Copia il backbuffer sullo schermo. */
  present(): void {
    const g = this.viewCtx;
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.view.width, this.view.height);
    g.drawImage(this.buffer, 0, 0, SCREEN_W, SCREEN_H, 0, 0, this.view.width, this.view.height);
  }

  // --- primitive di comodo ---------------------------------------------

  rect(x: number, y: number, w: number, h: number, color: string): void {
    const g = this.ctx;
    g.fillStyle = color;
    g.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  outline(x: number, y: number, w: number, h: number, color: string): void {
    const g = this.ctx;
    g.fillStyle = color;
    g.fillRect(x | 0, y | 0, w | 0, 1);
    g.fillRect(x | 0, (y + h - 1) | 0, w | 0, 1);
    g.fillRect(x | 0, y | 0, 1, h | 0);
    g.fillRect((x + w - 1) | 0, y | 0, 1, h | 0);
  }

  sprite(img: CanvasImageSource, x: number, y: number): void {
    this.ctx.drawImage(img, x | 0, y | 0);
  }

  spriteFlipX(img: HTMLCanvasElement, x: number, y: number): void {
    const g = this.ctx;
    g.save();
    g.translate((x | 0) + img.width, y | 0);
    g.scale(-1, 1);
    g.drawImage(img, 0, 0);
    g.restore();
  }

  /** Velo colorato su tutto lo schermo (transizioni, notte, flash). */
  veil(color: string, alpha: number): void {
    if (alpha <= 0) return;
    const g = this.ctx;
    g.save();
    g.globalAlpha = Math.min(1, alpha);
    g.fillStyle = color;
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    g.restore();
  }
}
