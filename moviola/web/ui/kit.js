// Piccoli attrezzi per l'interfaccia: elementi, dialog, avvisi, il pulsante
// "tieni premuto" del consenso.

export function h(tag, props, ...kids) {
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className += (el.className ? ' ' : '') + v;
      else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sv === undefined || sv === null) continue; if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && typeof v !== 'string' && k !== 'list') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const k of kids.flat(Infinity)) {
    if (k === null || k === undefined || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

export function fill(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false).map((k) => (k instanceof Node ? k : document.createTextNode(String(k)))));
  return el;
}

export const $ = (s, r = document) => r.querySelector(s);

let toastTimer;
export function toast(text, action) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = h('div.toast', { role: 'status' }, h('span', null, text), action && h('button.link', { onclick: () => { action.run(); t.remove(); } }, action.label));
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), action ? 7000 : 3600);
}

/** Dialog modale. body: Node; foot: Node[]; ritorna { close, el }. */
export function dialog({ title, body, foot = [], wide = false, onClose }) {
  const layer = document.getElementById('layer');
  const close = () => { scrim.remove(); document.removeEventListener('keydown', esc); onClose && onClose(); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  const box = h('div.dialog', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title, style: wide ? { width: 'min(980px, 100%)' } : null },
    h('div.dialog__head', null, h('span.label', null, title), h('span', { style: { flex: 1 } }), h('button.btn.btn--quiet', { onclick: close, 'aria-label': 'Chiudi' }, 'Chiudi')),
    h('div.dialog__body', null, body),
    foot.length ? h('div.dialog__foot', null, foot) : null,
  );
  const scrim = h('div.scrim', { onclick: (e) => { if (e.target === scrim) close(); } }, box);
  layer.append(scrim);
  document.addEventListener('keydown', esc);
  setTimeout(() => box.querySelector('input, textarea, button:not(.btn--quiet)')?.focus({ preventScroll: true }), 30);
  return { close, el: box };
}

export function confirmDialog({ title, text, ok = 'Conferma', danger }) {
  return new Promise((res) => {
    let d;
    const done = (v) => { d.close(); res(v); };
    d = dialog({
      title, body: h('p.prose', null, text), onClose: () => res(false),
      foot: [h('span.spacer'), h('button.btn', { onclick: () => done(false) }, 'Annulla'), h('button.btn' + (danger ? '' : '.btn--solid'), { onclick: () => done(true) }, ok)],
    });
  });
}

/**
 * Il consenso: tenere premuto 1,2 s. In alternativa (accessibilità) casella
 * più pulsante. Chiama onDone una sola volta.
 */
export function holdButton(label, onDone) {
  const fill = h('span.hold__fill');
  const btn = h('button.hold', { type: 'button' }, fill, h('span.hold__lbl', null, label));
  let timer;
  const start = (e) => {
    e.preventDefault();
    btn.dataset.holding = 'true';
    timer = setTimeout(() => { btn.dataset.holding = 'false'; onDone(); }, 1200);
  };
  const stop = () => { btn.dataset.holding = 'false'; clearTimeout(timer); };
  btn.addEventListener('pointerdown', start);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, stop));
  btn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start(e); });
  btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') stop(); });
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  return btn;
}

export function seg(options, value, onChange, { label } = {}) {
  const el = h('div.seg', { role: 'group', 'aria-label': label });
  const draw = (v) => {
    el.replaceChildren(...options.map((o) => h('button.seg__opt', { type: 'button', 'aria-pressed': String(o.id === v), title: o.hint, onclick: () => { draw(o.id); onChange(o.id); } }, o.label)));
  };
  draw(value);
  el.set = draw;
  return el;
}

export function fmtTime(frame, fps) {
  const s = Math.floor(frame / fps), f = frame % fps;
  return `${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

export function fmtNum(v, p) {
  const span = Math.abs(p.max - p.min);
  if (p.options) return p.options[Math.round(v)] ?? v;
  if (p.step >= 1) return String(Math.round(v));
  const d = span <= 0.2 ? 3 : span <= 2 ? 2 : span <= 20 ? 1 : 0;
  return v.toFixed(d);
}

export function fmtBytes(n) {
  if (n > 1e9) return (n / 1e9).toFixed(1) + ' GB';
  if (n > 1e6) return (n / 1e6).toFixed(0) + ' MB';
  return Math.round(n / 1e3) + ' kB';
}

export function ago(ts) {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'adesso';
  if (d < 3600) return Math.floor(d / 60) + ' min fa';
  if (d < 86400) return Math.floor(d / 3600) + ' h fa';
  return new Date(ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

export const isPhone = () => matchMedia('(max-width: 760px)').matches;
