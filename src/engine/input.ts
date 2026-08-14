/** Gestione input: tastiera + gamepad virtuale a schermo per dispositivi touch. */

export type Btn = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start' | 'select';

const KEYMAP: Record<string, Btn> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyZ: 'a',
  Enter: 'a',
  Space: 'a',
  KeyX: 'b',
  Escape: 'b',
  Backspace: 'b',
  KeyC: 'start',
  ShiftLeft: 'select',
  ShiftRight: 'select',
  Tab: 'select',
};

export class Input {
  private down = new Set<Btn>();
  private prev = new Set<Btn>();
  private justPressed = new Set<Btn>();
  private repeatTimer = new Map<Btn, number>();
  private held = new Map<Btn, number>();
  /** Tasti registrati da altre parti (musica, fullscreen...). */
  private rawHandlers: Array<(code: string) => void> = [];

  attach(target: Window = window): void {
    target.addEventListener('keydown', (e) => {
      const b = KEYMAP[e.code];
      if (b) {
        e.preventDefault();
        if (!this.down.has(b)) this.press(b);
      }
      for (const h of this.rawHandlers) h(e.code);
    });
    target.addEventListener('keyup', (e) => {
      const b = KEYMAP[e.code];
      if (b) {
        e.preventDefault();
        this.release(b);
      }
    });
    target.addEventListener('blur', () => this.clear());
  }

  onRawKey(fn: (code: string) => void): void {
    this.rawHandlers.push(fn);
  }

  press(b: Btn): void {
    this.down.add(b);
    this.justPressed.add(b);
    this.repeatTimer.set(b, 0);
    this.held.set(b, 0);
  }

  release(b: Btn): void {
    this.down.delete(b);
    this.repeatTimer.delete(b);
    this.held.delete(b);
  }

  clear(): void {
    this.down.clear();
    this.repeatTimer.clear();
    this.held.clear();
  }

  /** Da chiamare all'inizio di ogni step logico. */
  beginFrame(): void {
    for (const b of this.down) {
      this.held.set(b, (this.held.get(b) ?? 0) + 1);
    }
  }

  /** Da chiamare a fine step logico. */
  endFrame(): void {
    this.prev = new Set(this.down);
    this.justPressed.clear();
  }

  isDown(b: Btn): boolean {
    return this.down.has(b);
  }

  /** Premuto in questo frame. */
  pressed(b: Btn): boolean {
    return this.justPressed.has(b) || (this.down.has(b) && !this.prev.has(b));
  }

  released(b: Btn): boolean {
    return !this.down.has(b) && this.prev.has(b);
  }

  /** Premuto ora oppure ripetuto dopo un ritardo iniziale (per i menu). */
  repeat(b: Btn, delay = 16, rate = 5): boolean {
    if (this.pressed(b)) return true;
    if (!this.down.has(b)) return false;
    const h = this.held.get(b) ?? 0;
    return h > delay && (h - delay) % rate === 0;
  }

  /** Direzione premuta con priorita' all'ultima direzione utile. */
  dir(): Btn | null {
    if (this.isDown('up')) return 'up';
    if (this.isDown('down')) return 'down';
    if (this.isDown('left')) return 'left';
    if (this.isDown('right')) return 'right';
    return null;
  }

  anyPressed(): boolean {
    return this.justPressed.size > 0;
  }
}

/** Costruisce i comandi touch sovrapposti al canvas (visibili solo su dispositivi touch). */
export function buildTouchControls(input: Input, root: HTMLElement): HTMLElement | null {
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!isTouch) return null;
  // Segnala alla pagina che deve lasciare spazio ai comandi a schermo.
  document.documentElement.classList.add('touch');

  const wrap = document.createElement('div');
  wrap.id = 'touch-controls';
  wrap.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:20', 'pointer-events:none',
    'user-select:none', '-webkit-user-select:none',
  ].join(';');

  const mkBtn = (label: string, btn: Btn, css: string): HTMLElement => {
    const el = document.createElement('div');
    el.textContent = label;
    el.style.cssText = [
      'position:absolute', 'pointer-events:auto', 'display:flex',
      'align-items:center', 'justify-content:center',
      'background:rgba(28,38,62,.72)', 'color:#cfe4ff', 'border:2px solid rgba(140,180,240,.45)',
      'border-radius:10px', 'font:600 15px ui-monospace,monospace', 'touch-action:none',
      css,
    ].join(';');
    const on = (e: Event) => { e.preventDefault(); input.press(btn); el.style.background = 'rgba(80,120,190,.85)'; };
    const off = (e: Event) => { e.preventDefault(); input.release(btn); el.style.background = 'rgba(28,38,62,.72)'; };
    el.addEventListener('touchstart', on, { passive: false });
    el.addEventListener('touchend', off, { passive: false });
    el.addEventListener('touchcancel', off, { passive: false });
    el.addEventListener('mousedown', on);
    el.addEventListener('mouseup', off);
    el.addEventListener('mouseleave', off);
    return el;
  };

  const S = 52;
  const pad = 16;
  const bx = pad, by = pad;
  wrap.appendChild(mkBtn('▲', 'up', `left:${bx + S}px;bottom:${by + S * 2}px;width:${S}px;height:${S}px`));
  wrap.appendChild(mkBtn('▼', 'down', `left:${bx + S}px;bottom:${by}px;width:${S}px;height:${S}px`));
  wrap.appendChild(mkBtn('◀', 'left', `left:${bx}px;bottom:${by + S}px;width:${S}px;height:${S}px`));
  wrap.appendChild(mkBtn('▶', 'right', `left:${bx + S * 2}px;bottom:${by + S}px;width:${S}px;height:${S}px`));
  wrap.appendChild(mkBtn('A', 'a', `right:${pad}px;bottom:${by + S - 10}px;width:${S + 6}px;height:${S + 6}px;border-radius:50%`));
  wrap.appendChild(mkBtn('B', 'b', `right:${pad + S + 16}px;bottom:${by}px;width:${S + 6}px;height:${S + 6}px;border-radius:50%`));
  wrap.appendChild(mkBtn('MENU', 'start', `right:${pad}px;top:${pad}px;width:${S + 24}px;height:32px;font-size:11px`));

  root.appendChild(wrap);
  return wrap;
}
