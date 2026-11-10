// Passo 2 a schede: pagine da sfogliare di lato, la riga delle schede, il
// piccolo ↺ di ogni scheda.
//
// Il principio: l'area di una scheda non scorre mai in verticale. I comandi
// arrivano come blocchi piccoli (un cursore, una riga di pulsanti, un testo)
// e `pager` li distribuisce in pagine alte esattamente quanto lo spazio che
// c'è, misurandoli davvero. Quello che non ci sta va nella pagina dopo, che
// si raggiunge di lato: col dito, con le frecce, con i trattini, con il
// trackpad o con ← → sulla tastiera del Mac.
//
// Un blocco con `data-break` comincia sempre una pagina nuova; uno con
// `data-keep` non resta da solo in fondo a una pagina (un titolo resta con
// quello che lo segue).

import { h } from './kit.js';

// trascinamenti che non devono mai sfogliare: cursori, campi, disegni
const NO_SWIPE = 'input, select, textarea, canvas, [data-noswipe]';

/**
 * blocks: Node[] (anche annidati, i vuoti si ignorano).
 * start: pagina da mostrare all'inizio. onPage(i): quando cambia pagina.
 */
export function pager(blocks, { start = 0, onPage, label = 'Pagine' } = {}) {
  const items = blocks.flat(Infinity).filter((b) => b !== null && b !== undefined && b !== false)
    .map((b) => (b instanceof Element ? b : h('div', null, b)));
  const track = h('div.pager__track');
  const view = h('div.pager__view', null, track);
  const dots = h('div.pager__dots');
  const count = h('span.pager__count');
  const prev = h('button.pager__arrow', { type: 'button', 'aria-label': 'Pagina precedente', onclick: () => go(page - 1) }, '‹');
  const next = h('button.pager__arrow', { type: 'button', 'aria-label': 'Pagina seguente', onclick: () => go(page + 1) }, '›');
  const nav = h('div.pager__nav', { hidden: true }, prev, dots, count, next);
  const el = h('div.pager', { role: 'group', 'aria-label': label }, view, nav);
  let pages = [];
  let page = Math.max(0, start);
  let laidW = 0, laidH = 0, laying = false, queued = 0;

  function newPage() {
    const inner = h('div.pager__in');
    const pg = h('div.pager__page', null, inner);
    track.append(pg);
    pages.push({ el: pg, in: inner });
    return pages[pages.length - 1];
  }

  /** Distribuisce i blocchi in pagine alte H. */
  function fit(H) {
    track.replaceChildren();
    pages = [];
    let cur = newPage();
    for (const b of items) {
      if (b.hasAttribute('data-break') && cur.in.childElementCount) cur = newPage();
      cur.in.append(b);
      if (cur.in.offsetHeight <= H + 0.5 || cur.in.childElementCount === 1) continue;
      // non ci sta: va nella pagina dopo, con il titolo che lo precede
      b.remove();
      const carry = [];
      let last = cur.in.lastElementChild;
      while (last && last.hasAttribute('data-keep') && cur.in.childElementCount > carry.length + 1) { carry.unshift(last); last = last.previousElementSibling; }
      carry.forEach((c) => c.remove());
      cur = newPage();
      cur.in.append(...carry, b);
    }
    // un blocco più alto della pagina (non dovrebbe succedere): lo si vede comunque
    for (const p of pages) p.el.dataset.over = String(p.in.offsetHeight > H + 0.5);
  }

  function layout() {
    if (laying || !el.isConnected) return;
    const W = view.clientWidth;
    laying = true;
    try {
      const keep = pages[page]?.in.firstElementChild || null;
      const focus = el.contains(document.activeElement) ? document.activeElement : null;
      nav.hidden = true;
      let H = view.clientHeight;
      if (!H || !W) return;
      fit(H);
      if (pages.length > 1) { nav.hidden = false; H = view.clientHeight; fit(H); }
      laidW = W; laidH = H;
      // si resta sulla pagina di prima: quella col comando in uso, o col primo blocco che si vedeva
      const owner = (node) => pages.findIndex((p) => node && p.in.contains(node));
      const i = owner(focus) >= 0 ? owner(focus) : owner(keep) >= 0 && keep !== items[0] ? owner(keep) : page;
      drawNav();
      show(Math.min(Math.max(0, i), pages.length - 1), false);
      observe();
    } finally { laying = false; }
  }

  // se un blocco cresce da solo (un testo più lungo, un interruttore che apre
  // qualcosa) la pagina si rifà: niente deve uscire in basso
  const ro = new ResizeObserver(() => {
    if (laying) return;
    const W = view.clientWidth;
    const H = nav.hidden ? view.clientHeight : view.clientHeight + nav.offsetHeight;
    const grew = pages.some((p) => p.in.offsetHeight > laidH + 0.5);
    if (W !== laidW || Math.abs(H - (nav.hidden ? laidH : laidH + nav.offsetHeight)) > 0.5 || grew) {
      cancelAnimationFrame(queued);
      queued = requestAnimationFrame(layout);
    }
  });
  function observe() {
    ro.disconnect();
    ro.observe(view);
    pages.forEach((p) => ro.observe(p.in));
  }

  function drawNav() {
    // con tante pagine restano le frecce e «3 di 12»: i trattini non ci starebbero
    dots.hidden = pages.length > 7;
    dots.replaceChildren(...pages.map((_, i) => h('button.pager__dot', { type: 'button', 'aria-label': `Pagina ${i + 1} di ${pages.length}`, onclick: () => go(i) }, h('i'))));
  }

  function show(i, anim = true) {
    page = i;
    track.style.transition = anim ? '' : 'none';
    track.style.transform = `translateX(${-100 * i}%)`;
    if (!anim) { void track.offsetWidth; track.style.transition = ''; }
    pages.forEach((p, k) => { p.el.inert = k !== i; p.el.setAttribute('aria-hidden', String(k !== i)); });
    [...dots.children].forEach((d, k) => d.setAttribute('aria-current', String(k === i)));
    count.textContent = `${i + 1} di ${pages.length}`;
    prev.disabled = i <= 0;
    next.disabled = i >= pages.length - 1;
  }

  function go(i) {
    if (!pages.length) return;
    const j = Math.min(Math.max(0, i), pages.length - 1);
    if (j === page) { show(j); return; }
    show(j);
    onPage && onPage(j);
  }

  // --------------------------------------------------- sfogliare col dito
  let drag = null, swallow = false;
  view.addEventListener('pointerdown', (e) => {
    if (pages.length < 2 || e.button > 0 || e.target.closest(NO_SWIPE)) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, on: false };
  });
  view.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.on) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) { if (Math.abs(dy) > 14) drag = null; return; }
      drag.on = true;
      view.setPointerCapture(e.pointerId);
      track.style.transition = 'none';
    }
    const W = view.clientWidth || 1;
    // ai bordi la pagina resiste un poco
    const edge = (page === 0 && dx > 0) || (page === pages.length - 1 && dx < 0) ? 0.3 : 1;
    track.style.transform = `translateX(${-100 * page + (dx * edge / W) * 100}%)`;
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (!d.on) return;
    swallow = true; setTimeout(() => { swallow = false; }, 0);
    track.style.transition = '';
    const dx = e.clientX - d.x, v = dx / Math.max(1, e.timeStamp - d.t);
    const W = view.clientWidth || 1;
    if (dx < -W * 0.18 || v < -0.45) go(page + 1);
    else if (dx > W * 0.18 || v > 0.45) go(page - 1);
    else show(page);
  };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.id) { drag = null; track.style.transition = ''; show(page); } });
  // dopo uno sfoglio il pulsante sotto il dito non si preme
  view.addEventListener('click', (e) => { if (swallow) { e.preventDefault(); e.stopPropagation(); } }, true);

  // trackpad del Mac: due dita di lato
  let wheelAt = 0, wheelSum = 0;
  view.addEventListener('wheel', (e) => {
    if (pages.length < 2 || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    const now = performance.now();
    if (now - wheelAt < 450) return;
    wheelSum += e.deltaX;
    if (Math.abs(wheelSum) > 40) { go(page + Math.sign(wheelSum)); wheelSum = 0; wheelAt = now; }
  }, { passive: false });

  requestAnimationFrame(layout);
  ro.observe(view);
  el.layout = layout;
  el.go = go;
  el.step = (d) => { if (pages.length > 1) go(page + d); };
  el.page = () => page;
  el.pages = () => pages.length;
  el.destroy = () => { ro.disconnect(); cancelAnimationFrame(queued); };
  return el;
}

/** Il ↺ di una scheda: dice cosa azzera. */
export function miniReset(what, run) {
  return h('button.mini-reset', { type: 'button', title: `Azzera ${what}: puoi annullare subito dopo`, onclick: run }, h('span', { 'aria-hidden': 'true' }, '↺'), ` solo ${what}`);
}

/** Una riga di schede: una sola aperta alla volta. */
export function tabRow(tabs, current, pick) {
  const el = h('div.tabs', { role: 'tablist', 'aria-label': 'Comandi' });
  const draw = (cur) => {
    el.replaceChildren(...tabs.map((t) => h('button.tabs__tab', {
      type: 'button', role: 'tab', 'aria-selected': String(t.id === cur), 'data-tab': t.id,
      onclick: () => { if (t.id !== cur) pick(t.id); },
    }, t.label, t.dot ? h('i.tabs__dot', { 'aria-label': 'in uso' }) : null)));
  };
  draw(current);
  el.set = (cur, list) => { if (list) tabs = list; draw(cur); };
  return el;
}

/** Un piccolo marcatore: il blocco comincia una pagina nuova, o non resta da solo. */
export const brk = (el) => { if (el) el.setAttribute('data-break', ''); return el; };
export const keep = (el) => { if (el) el.setAttribute('data-keep', ''); return el; };
