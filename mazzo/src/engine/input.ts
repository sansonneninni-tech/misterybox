/** Input: tastiera (WASD + frecce, E/Spazio/Invio per interagire) e comandi touch. */

export type Btn = 'up' | 'down' | 'left' | 'right' | 'act';

const KEYMAP: Record<string, Btn> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyE: 'act',
  Space: 'act',
  Enter: 'act',
};

export class Input {
  private down = new Set<Btn>();
  private prev = new Set<Btn>();
  private fresh = new Set<Btn>();
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
    this.fresh.add(b);
  }

  release(b: Btn): void {
    this.down.delete(b);
  }

  clear(): void {
    this.down.clear();
  }

  /** Da chiamare a fine step logico. */
  endFrame(): void {
    this.prev = new Set(this.down);
    this.fresh.clear();
  }

  isDown(b: Btn): boolean {
    return this.down.has(b);
  }

  /** Vero solo nel frame in cui il tasto viene premuto. */
  pressed(b: Btn): boolean {
    return this.fresh.has(b) || (this.down.has(b) && !this.prev.has(b));
  }

  /** Asse orizzontale/verticale come coppia -1/0/1. */
  axis(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.isDown('left')) x -= 1;
    if (this.isDown('right')) x += 1;
    if (this.isDown('up')) y -= 1;
    if (this.isDown('down')) y += 1;
    return { x, y };
  }
}

/** Comandi a schermo: creati solo se il dispositivo ha un touchscreen. */
export function buildTouchControls(input: Input, root: HTMLElement): boolean {
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!isTouch) return false;
  document.documentElement.classList.add('touch');

  const wrap = document.createElement('div');
  wrap.id = 'touch-controls';
  wrap.style.cssText =
    'position:fixed;inset:0;z-index:20;pointer-events:none;user-select:none;-webkit-user-select:none';

  const mk = (label: string, btn: Btn, css: string): HTMLElement => {
    const el = document.createElement('div');
    el.textContent = label;
    el.style.cssText = [
      'position:absolute',
      'pointer-events:auto',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:rgba(38,36,28,.7)',
      'color:#e8dcc0',
      'border:2px solid rgba(190,170,120,.4)',
      'border-radius:10px',
      'font:600 15px ui-monospace,monospace',
      'touch-action:none',
      css,
    ].join(';');
    const on = (e: Event) => {
      e.preventDefault();
      input.press(btn);
      el.style.background = 'rgba(120,110,70,.85)';
    };
    const off = (e: Event) => {
      e.preventDefault();
      input.release(btn);
      el.style.background = 'rgba(38,36,28,.7)';
    };
    el.addEventListener('touchstart', on, { passive: false });
    el.addEventListener('touchend', off, { passive: false });
    el.addEventListener('touchcancel', off, { passive: false });
    el.addEventListener('mousedown', on);
    el.addEventListener('mouseup', off);
    el.addEventListener('mouseleave', off);
    return el;
  };

  const S = 52;
  const p = 16;
  wrap.appendChild(mk('▲', 'up', `left:${p + S}px;bottom:${p + S * 2}px;width:${S}px;height:${S}px`));
  wrap.appendChild(mk('▼', 'down', `left:${p + S}px;bottom:${p}px;width:${S}px;height:${S}px`));
  wrap.appendChild(mk('◀', 'left', `left:${p}px;bottom:${p + S}px;width:${S}px;height:${S}px`));
  wrap.appendChild(mk('▶', 'right', `left:${p + S * 2}px;bottom:${p + S}px;width:${S}px;height:${S}px`));
  wrap.appendChild(
    mk('E', 'act', `right:${p}px;bottom:${p + S - 10}px;width:${S + 10}px;height:${S + 10}px;border-radius:50%`),
  );

  root.appendChild(wrap);
  return true;
}
