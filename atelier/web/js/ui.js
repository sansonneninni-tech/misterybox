// Piccole utilità per costruire l'interfaccia senza framework.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function clear(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

export function toast(msg, action) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = h('div', { class: 'toast', role: 'status' }, h('span', {}, msg),
    action ? h('button', { class: 'link', onclick: () => { action.run(); t.remove(); } }, action.label) : null);
  document.body.append(t);
  // Sempre staccato di 12px sopra il pulsante principale, mai attaccato.
  const cta = [...document.querySelectorAll('.s-cta')].find((c) => c.offsetParent);
  if (cta) { const top = cta.getBoundingClientRect().top; if (top < innerHeight) t.style.bottom = `${Math.round(innerHeight - top + 12)}px`; }
  setTimeout(() => t.remove(), action ? 7000 : 3500);
}

// Dialog modale. Restituisce { close, el }.
export function dialog({ title, body, foot, wide = false, onClose }) {
  const close = () => { scrim.remove(); document.removeEventListener('keydown', esc); onClose?.(); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  const box = h('div', { class: 'dialog' + (wide ? ' dialog--wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'dialog__head' }, h('span', { class: 'label' }, title), h('span', { style: { flex: 1 } }), h('button', { class: 'btn btn--quiet', onclick: close, 'aria-label': 'Chiudi' }, 'Chiudi')),
    h('div', { class: 'dialog__body' }, body),
    foot ? h('div', { class: 'dialog__foot' }, foot) : null);
  const scrim = h('div', { class: 'scrim', onclick: (e) => { if (e.target === scrim) close(); } }, box);
  document.addEventListener('keydown', esc);
  document.body.append(scrim);
  box.querySelector('input, textarea, button.btn--solid')?.focus?.();
  return { close, el: box };
}

// Pulsante "tieni premuto" per i consensi importanti (costi, opera finita),
// con un'alternativa in due passaggi per chi non può tenere premuto.
export function holdButton(label, onDone, { altText, altLabel, disabled = false } = {}) {
  let timer = null;
  const ms = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hold')) || 1.2) * 1000;
  const btn = h('button', { class: 'hold', type: 'button', disabled }, h('span', { class: 'hold__fill' }), h('span', { class: 'hold__lbl' }, label));
  const start = (e) => {
    if (btn.disabled || timer) return;
    e.preventDefault();
    btn.dataset.holding = 'true';
    timer = setTimeout(() => { timer = null; btn.dataset.holding = 'false'; onDone(); }, ms);
  };
  const stop = () => { clearTimeout(timer); timer = null; btn.dataset.holding = 'false'; };
  btn.addEventListener('pointerdown', start);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, stop));
  btn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start(e); });
  btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') stop(); });
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  if (!altText || disabled) return btn;
  const wrap = h('span', { class: 'hold-wrap' });
  const alt = h('button', { class: 'link', type: 'button', onclick: () => {
    const go = h('button', { class: 'btn btn--paid', disabled: true, onclick: onDone }, altLabel || 'Conferma');
    const chk = h('input', { type: 'checkbox', onchange: (e) => { go.disabled = !e.target.checked; } });
    wrap.replaceChildren(h('div', { class: 'hold-alt' }, h('label', { class: 'check' }, chk, h('span', {}, altText)), go));
  } }, 'Non puoi tenere premuto? Conferma in due passaggi');
  wrap.append(alt, btn);
  return wrap;
}

export function fmtBytes(n) {
  if (!n) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i ? 1 : 0)} ${u[i]}`;
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

// Codice di due lettere per le celle: il "gesto firma" del provino.
export function code(text = '') {
  const w = String(text).replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '—';
  const s = w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2);
  return s[0].toUpperCase() + (s[1] || '').toLowerCase();
}

export function spinner(label = 'Lavoro in corso…') {
  return h('div', { class: 'busy' }, h('div', { class: 'progress progress--indet' }, h('i')), h('span', { class: 'meta' }, label));
}

export function stateBox(glyph, title, text, ...actions) {
  return h('div', { class: 'state' }, h('div', { class: 'state__box' },
    h('div', { class: 'state__glyph', 'aria-hidden': 'true' }, glyph),
    h('h2', { class: 'title' }, title),
    text ? h('p', { class: 'prose muted' }, text) : null,
    actions.length ? h('div', { class: 'row' }, actions) : null));
}

export const isTouch = () => matchMedia('(pointer: coarse)').matches;
export const isPhone = () => matchMedia('(max-width: 760px)').matches;

// Guida dei passaggi (design: .guide). steps: [[titolo, descrizione, fatto], …].
// Il primo passo non fatto è quello corrente; `next` è l'unica azione principale della schermata.
export function guide(n, title, steps, next) {
  let cur = steps.findIndex((s) => !s[2]);
  if (cur < 0) cur = steps.length;
  return h('div', { class: 'guide' },
    h('div', { class: 'guide__head' }, h('span', { class: 'guide__step-n' }, typeof n === 'number' ? `Passo ${n}` : n), h('span', { class: 'guide__title' }, title)),
    h('ol', { class: 'guide__steps' }, steps.map(([t, d], i) => {
      const st = i < cur ? 'done' : i === cur ? 'current' : 'todo';
      return h('li', { class: 'guide__step', 'data-state': st }, h('span', { class: 'guide__n' }, st === 'done' ? '✓' : String(i + 1)),
        h('span', { class: 'guide__body' }, h('span', { class: 'guide__t' }, t), h('span', { class: 'guide__d' }, d)));
    })),
    next ? h('div', { class: 'guide__next' }, next) : null);
}

export const labelN = (n, text) => h('div', { class: 'label' }, h('span', { class: 'label__n' }, String(n)), text);

// Avviso con, sotto, la riga originale dell'errore (piccola, in mono).
export function noticeBox(text, detail) {
  return h('div', { class: 'notice notice--raw' }, h('span', {}, text), detail ? h('code', { class: 'notice__raw' }, detail) : null);
}
