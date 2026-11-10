// Interfaccia di mappa e contagio, dentro ogni strato di materia (passo 2):
// «Dove sta» apre il foglio di pittura; «Il confine» decide come si mescola
// con quella sotto; «Contagio» fa muovere il confine nel tempo, con le chiavi.

import { S, touch, sourceById } from '../state.js';
import { h, fill, toast, seg } from './kit.js';
import { byId } from '../engine/processes.js';
import { CONTAGIO, CONFINE, CARATTERI, defaultContagio, defaultConfine, contagioValue, hasTerritorio, rememberDecoded, decodeMap, GEN_DEFAULT } from '../engine/territorio.js';
import { mapDims, newMap, cloneMap, photoPixels, bakeAuto, invertMap, fillMap, beginStroke, dab, fillZone, encodeMap, mapFromRGBA, hueAt, presence } from '../engine/mappa.js';
import { mainPlayer, syncPlayer } from '../app.js';

const fmt = (v, d) => (d.min < 0 ? (v > 0 ? '+' : '') : '') + v.toFixed(2);
const KEY_EPS = 0.5 / 24;

/** Chi sta sotto lo strato i: la materia prima, oppure la foto. */
export function belowName(c, i) {
  const m = c.materie?.[i - 1];
  return m ? byId[m.proc]?.name || 'quella sotto' : (c.sources?.length ? 'la foto' : 'l’immagine sotto');
}

const isVideo = (c) => sourceById(c.sources?.[0]?.id)?.kind === 'video';

/**
 * Sezione territorio di uno strato. `layer()` ritorna lo strato vivo
 * (S.work.materie[i]); `changed()` ridisegna l'anteprima.
 */
export function territorioSection({ index, layer, changed, redrawPanel }) {
  const root = h('div.terr');
  const player = mainPlayer();
  const draw = () => {
    const m = layer(); if (!m) return;
    const c = S.work;
    const name = byId[m.proc].name;
    const below = belowName(c, index);
    const any = hasTerritorio(m);
    const conf = m.confine || defaultConfine();
    const cont = m.contagio;

    // --- Dove sta
    const thumb = h('canvas.terr__thumb', { width: 96, height: 54, 'aria-hidden': 'true' });
    if (m.mappa) mapThumb(thumb, m).catch(() => {});
    const dove = h('div.terr__block', null,
      h('div.terr__head', null, h('span.label', null, 'Dove sta'),
        h('span.meta', null, m.mappa ? 'dipinta da te sulla foto' : 'ovunque: copre tutto il quadro')),
      h('div.terr__row', null,
        m.mappa ? thumb : null,
        h('button.btn', { onclick: () => openPainter({ index, onDone: () => { changed(); redrawPanel(); } }) }, m.mappa ? 'Ridipingi' : 'Dipingi dove va'),
        m.mappa ? h('button.btn.btn--quiet', { onclick: () => { const old = m.mappa; delete m.mappa; done(); toast(`${name} torna su tutto il quadro`, { label: 'Annulla', run: () => { layer().mappa = old; done(); } }); } }, 'Togli la mappa') : null),
      m.mappa && isVideo(c) ? h('p.meta', null, m.mappa.segui ? 'Il video si muove: la mappa segue la sua luce, i tratti dipinti restano fermi nel quadro.' : 'Il video si muove, la mappa resta ferma nel quadro.') : null);

    // --- Il confine (solo se c'è un territorio)
    const confEl = any ? h('div.terr__block', null,
      h('div.terr__head', null, h('span.label', null, 'Il confine'), h('span.meta', null, `come si mescola con ${below}`)),
      seg(CARATTERI.map((x) => ({ id: x.id, label: x.label, hint: x.hint })), conf.carattere, (v) => { ensureConf(m).carattere = v; done(false); hint.textContent = CARATTERI[v].hint; }, { label: 'Carattere del confine' }),
      h('p.meta.terr__hint', null),
      CONFINE.map((d) => slider(d, conf[d.id], (v) => { ensureConf(m)[d.id] = v; done(false); })),
    ) : null;
    const hint = confEl?.querySelector('.terr__hint');
    if (hint) hint.textContent = CARATTERI[conf.carattere].hint;

    // --- Contagio
    const on = !!cont?.on;
    const sw = h('button.switch', { role: 'switch', 'aria-checked': String(on), onclick: () => {
      if (!m.contagio) m.contagio = defaultContagio(); else m.contagio.on = !m.contagio.on;
      done(); if (m.contagio.on && !m.mappa) toast(`Senza mappa ${name} parte dalle luci della foto. Dipingi dove va per decidere tu da dove parte.`);
    } }, h('span.switch__knob'), h('span.stack', null, h('span', null, 'Contagio'), h('span.meta', null, on ? `il confine con ${below} si muove nel tempo` : `${name} invade ${below} lungo il confine, o ne viene invasa`)));
    const contEl = h('div.terr__block', null, sw, on ? [
      h('p.meta', null, `Il confine parte ${m.mappa ? 'dalla tua mappa' : 'dalle luci della foto'}. Il loop non si richiude: il fronte non torna da solo al primo fotogramma.`),
      CONTAGIO.map((d) => keyedSlider(m, d)),
      keysLine(m),
    ] : null);

    fill(root, dove, confEl, contEl);
  };

  function ensureConf(m) { if (!m.confine) m.confine = defaultConfine(); return m.confine; }
  function done(redraw = true) { touch('clip'); changed(); if (redraw) draw(); }

  function slider(d, value, set) {
    const val = h('span.prm__val', null, fmt(value, d));
    return h('div.prm', { title: d.hint },
      h('span.prm__lbl', null, d.label), val,
      h('input.range', { type: 'range', min: d.min, max: d.max, step: (d.max - d.min) / 200, value, 'aria-label': d.label,
        oninput: (e) => { const v = Number(e.target.value); val.textContent = fmt(v, d); set(v); } }),
      d.hint ? h('span.prm__hint.meta', null, d.hint) : null);
  }

  // un parametro del contagio con la sua chiave (◆) nell'istante del lettore
  function keyedSlider(m, d) {
    const t = () => player.t;
    const track = () => m.contagio.chiavi?.[d.id];
    const at = () => (track() || []).findIndex((k) => Math.abs(k[0] - t()) < KEY_EPS);
    const cur = contagioValue(m.contagio, d, t());
    const val = h('span.prm__val', null, fmt(cur, d));
    const has = at() >= 0;
    const kb = h('button.key', { 'aria-pressed': String(has), title: has ? 'Togli la chiave in questo istante' : 'Metti una chiave in questo istante', 'aria-label': `Chiave di ${d.label}`,
      onclick: () => {
        const c = m.contagio; c.chiavi = c.chiavi || {};
        const i = at();
        if (i >= 0) { c.chiavi[d.id].splice(i, 1); if (!c.chiavi[d.id].length) delete c.chiavi[d.id]; }
        else c.chiavi[d.id] = [...(track() || []), [Math.round(t() * 1000) / 1000, contagioValue(c, d, t())]].sort((a, b) => a[0] - b[0]);
        done();
      } }, '◆');
    const input = h('input.range', { type: 'range', min: d.min, max: d.max, step: (d.max - d.min) / 200, value: cur, 'aria-label': d.label,
      oninput: (e) => {
        const v = Number(e.target.value); val.textContent = fmt(v, d);
        const c = m.contagio;
        if (track()?.length) {
          const i = at();
          if (i >= 0) c.chiavi[d.id][i][1] = v;
          else { c.chiavi[d.id].push([Math.round(t() * 1000) / 1000, v]); c.chiavi[d.id].sort((a, b) => a[0] - b[0]); kb.setAttribute('aria-pressed', 'true'); }
        } else c[d.id] = v;
        touch('clip'); changed();
      } });
    const n = track()?.length || 0;
    return h('div.prm.prm--key', { title: d.hint },
      h('span.prm__lbl', null, d.label, n ? h('span.meta', null, ` · ${n} ${n === 1 ? 'chiave' : 'chiavi'}`) : null), val, kb, input,
      d.id === 'spinta' ? h('span.prm__ends.meta', null, h('span', null, `← avanza ${belowName(S.work, index)}`), h('span', null, `avanza ${byId[m.proc].name} →`)) : null,
      d.id === 'resistenza' ? h('span.prm__ends.meta', null, h('span', null, '← resistono gli scuri'), h('span', null, 'resistono i chiari →')) : null);
  }

  function keysLine(m) {
    const all = Object.entries(m.contagio.chiavi || {}).filter(([, v]) => v?.length);
    if (!all.length) return h('p.meta', null, 'Ferma il video nell’istante giusto e tocca ◆ per fissare un valore: tra due chiavi il valore scorre. Per far ritirare il fronte, metti più avanti una chiave con la spinta verso sinistra.');
    const times = [...new Set(all.flatMap(([, v]) => v.map((k) => k[0])))].sort((a, b) => a - b);
    return h('div.terr__keys', null,
      h('span.meta', null, 'Chiavi a ', times.map((x, i) => h('button.link', { onclick: async () => { player.pause(); await player.seek(Math.round(x * player.fps)); draw(); } }, `${x.toFixed(1)} s${i < times.length - 1 ? ',' : ''}`))),
      h('button.link', { onclick: () => { const old = m.contagio.chiavi; m.contagio.chiavi = {}; done(); toast('Chiavi tolte', { label: 'Annulla', run: () => { layer().contagio.chiavi = old; done(); } }); } }, 'Togli tutte le chiavi'));
  }

  draw();
  root.redraw = draw;
  return root;
}

async function mapThumb(cv, m) {
  const d = await decodeMap(m.mappa.png);
  const g = cv.getContext('2d');
  const id = g.createImageData(d.w, d.h);
  for (let i = 0, k = 0; i < d.w * d.h; i++, k += 4) { const v = Math.max(0, Math.min(255, d.data[k + 2] + d.data[k] - d.data[k + 1])); id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = 255; }
  const tmp = document.createElement('canvas'); tmp.width = d.w; tmp.height = d.h; tmp.getContext('2d').putImageData(id, 0, 0);
  cv.width = 96; cv.height = Math.round(96 * d.h / d.w);
  g.drawImage(tmp, 0, 0, cv.width, cv.height);
}

// =================================================================== il foglio di pittura
const BRUSH = { tool: 'pennello', size: 0.35, soft: 0.6, forza: 1, simile: 0.35 };
const sizePx = (s, long) => (0.006 + 0.16 * Math.pow(s, 1.7)) * long;

/**
 * Foglio a tutto schermo: la foto com'è nel quadro, scurita dove la materia
 * non c'è (come il mascherino sotto l'ingranditore). Un dito dipinge, due
 * dita spostano e ingrandiscono. «Guarda la materia» mostra il risultato vero.
 */
export async function openPainter({ index, onDone }) {
  const player = mainPlayer();
  player.pause();
  const c = S.work;
  let li = index;
  const layerOf = () => c.materie[li];

  // la foto, così come entra nel quadro
  const src = player.srcs?.[0]?.el || null;
  const srcW = src ? (src.naturalWidth || src.videoWidth || src.width) : 0;
  const srcH = src ? (src.naturalHeight || src.videoHeight || src.height) : 0;
  const outAsp = player.r.w / player.r.h;
  const hasPhoto = !!(src && srcW && srcH);
  const dimsOf = () => (hasPhoto ? mapDims(srcW, srcH) : mapDims(player.r.w, player.r.h));
  const { w: MW, h: MH } = dimsOf();
  // ritaglio della foto che si vede nel quadro (come cover() nel motore)
  let crop = { x: 0, y: 0, w: MW, h: MH };
  if (hasPhoto) {
    const r = (srcW / srcH) / outAsp;
    if (r > 1) { const cw = MW / r; crop = { x: (MW - cw) / 2, y: 0, w: cw, h: MH }; }
    else { const ch = MH * r; crop = { x: 0, y: (MH - ch) / 2, w: MW, h: ch }; }
  }
  const px = hasPhoto ? photoPixels(src, MW, MH) : null;

  // stato della mappa dello strato aperto
  let map, gen, segui, undo = [], redo = [], dirty = false;
  async function load() {
    const m = layerOf();
    gen = { ...GEN_DEFAULT, ...(m.mappa?.gen || {}) };
    segui = !!m.mappa?.segui;
    if (m.mappa) {
      const d = await decodeMap(m.mappa.png);
      map = d.w === MW && d.h === MH ? mapFromRGBA(d) : resample(mapFromRGBA(d), MW, MH);
    } else map = newMap(MW, MH);
    undo = []; redo = []; dirty = false;
  }
  await load();

  // --- elementi
  const view = h('canvas.paint__view');
  const veil = document.createElement('canvas'); veil.width = MW; veil.height = MH;
  const vg = veil.getContext('2d');
  const veilData = vg.createImageData(MW, MH);
  const cursor = h('div.paint__cursor', { hidden: true });
  const frame = h('div.paint__frame', null, view, cursor);
  const stage = h('div.paint__stage', null, frame);
  const tools = h('div.paint__tools');
  const chips = h('div.paint__chips');
  const title = h('span.paint__title');
  const doneBtn = h('button.btn.btn--solid', { onclick: () => close() }, 'Fatto');
  const sheet = h('div.paint', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Dove va la materia' },
    h('div.paint__bar', null, title, chips, h('span.paint__sp'), doneBtn),
    h('div.paint__body', null, stage, tools));
  document.getElementById('layer').append(sheet);
  document.body.classList.add('paint-open');

  // il risultato vero: il canvas del lettore entra nel foglio
  let showResult = false;
  const pc = player.canvas, pcParent = pc.parentNode, pcNext = pc.nextSibling;

  // --- disegno
  let raf = 0;
  const redrawSoon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paintView(); }); };
  function paintView() {
    const W = view.width, H = view.height;
    const g = view.getContext('2d');
    if (showResult) return;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    if (hasPhoto) g.drawImage(src, crop.x / MW * srcW, crop.y / MH * srcH, crop.w / MW * srcW, crop.h / MH * srcH, 0, 0, W, H);
    else { g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, W, H); }
    const d = veilData.data;
    // fuori dalla materia la foto si scurisce; il confine è un filo chiaro
    const pr = new Uint8Array(MW * MH);
    for (let i = 0; i < MW * MH; i++) pr[i] = presence(map, i);
    for (let y = 0, i = 0, k = 0; y < MH; y++) for (let x = 0; x < MW; x++, i++, k += 4) {
      const inside = pr[i] >= 128;
      const edge = (x < MW - 1 && (pr[i + 1] >= 128) !== inside) || (y < MH - 1 && (pr[i + MW] >= 128) !== inside);
      if (edge) { d[k] = d[k + 1] = d[k + 2] = 248; d[k + 3] = 150; }
      else { d[k] = d[k + 1] = d[k + 2] = 0; d[k + 3] = Math.round((255 - pr[i]) * 0.8); }
    }
    vg.putImageData(veilData, 0, 0);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(veil, crop.x, crop.y, crop.w, crop.h, 0, 0, W, H);
  }

  // misura del foglio: il quadro intero nello spazio disponibile
  const zoom = { s: 1, x: 0, y: 0 };
  function layout() {
    const r = stage.getBoundingClientRect();
    const asp = crop.w / crop.h;
    let w = r.width, hh = w / asp;
    if (hh > r.height) { hh = r.height; w = hh * asp; }
    frame.style.width = w + 'px'; frame.style.height = hh + 'px';
    const dpr = Math.min(2, devicePixelRatio || 1);
    view.width = Math.round(Math.min(1800, w * dpr)); view.height = Math.round(view.width / asp);
    applyZoom();
    paintView();
  }
  function applyZoom() { frame.style.transform = `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})`; }

  // da schermo a coordinate della mappa
  function toMap(e) {
    const r = view.getBoundingClientRect();
    return { x: crop.x + (e.clientX - r.left) / r.width * crop.w, y: crop.y + (e.clientY - r.top) / r.height * crop.h, k: crop.w / r.width };
  }

  // --- tratti
  const pointers = new Map();
  let stroke = null, last = null, pinch = null;
  function snapshot() { undo.push(cloneMap(map)); if (undo.length > 24) undo.shift(); redo = []; }
  function startStroke(e) {
    const p = toMap(e);
    if (BRUSH.tool === 'contagocce') { if (px) { gen.tinta = hueAt(px, MW, MH, p.x, p.y); gen.modo = 'tinta'; snapshot(); bakeAuto(map, px, gen); changedMap(); BRUSH.tool = BRUSH.prev || 'pennello'; drawTools(); toast('Tinta presa: la materia va dove la foto ha quel colore'); } return; }
    if (BRUSH.tool === 'riempi') { snapshot(); fillZone(map, px, p.x, p.y, BRUSH.simile, BRUSH.soft, BRUSH.forza, false); changedMap(); return; }
    snapshot();
    stroke = beginStroke(map);
    last = p;
    stamp(p, p);
  }
  function stamp(a, b) {
    const R = sizePx(BRUSH.size, Math.max(MW, MH));
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(dist / Math.max(0.6, R * 0.2)));
    for (let i = 1; i <= n || i === 1; i++) {
      const f = n ? i / n : 1;
      dab(map, stroke, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, R, BRUSH.soft, BRUSH.forza, BRUSH.tool === 'gomma');
      if (i >= n) break;
    }
    redrawSoon();
  }
  function endStroke() { if (stroke) { stroke = null; changedMap(); } }
  function cancelStroke() { if (stroke) { const u = undo.pop(); if (u) map = u; stroke = null; redrawSoon(); } }

  view.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    view.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      cancelStroke();
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, z: { ...zoom } };
      return;
    }
    if (pointers.size === 1 && (e.button === 0 || e.pointerType !== 'mouse')) startStroke(e);
  });
  view.addEventListener('pointermove', (e) => {
    moveCursor(e);
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      zoom.s = Math.min(6, Math.max(1, pinch.z.s * d / pinch.d));
      zoom.x = pinch.z.x + (cx - pinch.cx); zoom.y = pinch.z.y + (cy - pinch.cy);
      if (zoom.s === 1) { zoom.x = 0; zoom.y = 0; }
      applyZoom(); return;
    }
    if (stroke) { const p = toMap(e); stamp(last, p); last = p; }
  });
  const up = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; if (!pointers.size) endStroke(); };
  view.addEventListener('pointerup', up); view.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); cancelStroke(); pinch = null; });
  view.addEventListener('pointerleave', () => { cursor.hidden = true; });
  // rotella e pinza del trackpad: ingrandisce dove sta il puntatore
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      const k = Math.exp(-e.deltaY * 0.01), s = Math.min(6, Math.max(1, zoom.s * k));
      const mx = e.clientX - r.left - r.width / 2, my = e.clientY - r.top - r.height / 2;
      zoom.x = mx - (mx - zoom.x) * (s / zoom.s); zoom.y = my - (my - zoom.y) * (s / zoom.s); zoom.s = s;
    } else if (zoom.s > 1) { zoom.x -= e.deltaX; zoom.y -= e.deltaY; }
    if (zoom.s === 1) { zoom.x = 0; zoom.y = 0; }
    applyZoom();
  }, { passive: false });
  function moveCursor(e) {
    if (e.pointerType !== 'mouse' || BRUSH.tool === 'riempi' || BRUSH.tool === 'contagocce') { cursor.hidden = true; return; }
    const r = frame.getBoundingClientRect(), vr = view.getBoundingClientRect();
    const R = sizePx(BRUSH.size, Math.max(MW, MH)) / crop.w * vr.width;
    cursor.hidden = false;
    cursor.style.width = cursor.style.height = 2 * R / zoom.s + 'px';
    cursor.style.left = (e.clientX - r.left) / zoom.s + 'px'; cursor.style.top = (e.clientY - r.top) / zoom.s + 'px';
  }

  // --- salvataggio nella clip (con un attimo di respiro tra un tratto e l'altro)
  let commitT = 0;
  function changedMap() { dirty = true; redrawSoon(); clearTimeout(commitT); commitT = setTimeout(commit, showResult ? 60 : 400); }
  function commit() {
    clearTimeout(commitT);
    if (!dirty) return;
    dirty = false;
    const { png, rgba } = encodeMap(map);
    rememberDecoded(png, MW, MH, rgba);
    const m = layerOf();
    m.mappa = { w: MW, h: MH, png, rev: (m.mappa?.rev || 0) + 1, foto: c.sources?.[0]?.id || null, segui, gen: { ...gen } };
    touch('clip');
    syncPlayer().then(() => player.draw());
  }

  function toggleResult(v) {
    showResult = v;
    if (v) { commit(); pc.classList.add('paint__result'); frame.append(pc); view.style.opacity = '0'; syncPlayer().then(() => player.draw()); }
    else { pc.classList.remove('paint__result'); pcParent.insertBefore(pc, pcNext); view.style.opacity = ''; paintView(); }
    drawTools();
  }

  // --- strumenti
  const act = (label, fn, extra = {}) => h('button.btn', { onclick: fn, ...extra }, label);
  function drawTools() {
    const m = layerOf();
    title.textContent = `Dove va ${byId[m.proc].name}`;
    fill(chips, c.materie.length > 1 ? c.materie.map((x, i) => h('button.tag', { 'aria-pressed': String(i === li), onclick: async () => { if (i === li) return; commit(); li = i; await load(); drawTools(); paintView(); } }, `${i + 1} ${byId[x.proc].name}`)) : null);
    const R = (d, v, set) => {
      const val = h('span.prm__val', null, Math.round(v * 100) + '%');
      return h('div.prm', null, h('span.prm__lbl', null, d), val, h('span'),
        h('input.range', { type: 'range', min: 0, max: 1, step: 0.01, value: v, 'aria-label': d, oninput: (e) => { const x = Number(e.target.value); val.textContent = Math.round(x * 100) + '%'; set(x); } }));
    };
    let genSnap = false;
    const genSlider = (lbl, key) => R(lbl, gen[key], (v) => { if (!genSnap) { snapshot(); genSnap = true; } gen[key] = v; bakeAuto(map, px, gen); changedMap(); });
    const video = isVideo(c);
    fill(tools,
      h('div.paint__grp', null,
        seg([{ id: 'pennello', label: 'Pennello' }, { id: 'gomma', label: 'Gomma' }, { id: 'riempi', label: 'Riempi zona', hint: 'tocca una zona: si riempie fin dove la foto resta simile' }], BRUSH.tool === 'contagocce' ? BRUSH.prev : BRUSH.tool, (v) => { BRUSH.tool = v; drawTools(); }, { label: 'Strumento' }),
        BRUSH.tool === 'riempi' ? h('p.meta', null, 'Tocca una zona della foto: si riempie fin dove resta simile.') : null),
      h('div.paint__grp.paint__acts', null,
        act('Annulla', () => { const u = undo.pop(); if (u) { redo.push(cloneMap(map)); map = u; changedMap(); } }, { disabled: !undo.length }),
        act('Rifai', () => { const r = redo.pop(); if (r) { undo.push(cloneMap(map)); map = r; changedMap(); } }, { disabled: !redo.length }),
        act('Tutto', () => { snapshot(); fillMap(map, true); changedMap(); }, { title: 'La materia copre tutto' }),
        act('Niente', () => { snapshot(); fillMap(map, false); changedMap(); }, { title: 'Togli la materia ovunque' }),
        act('Inverti', () => { snapshot(); invertMap(map, gen); changedMap(); drawTools(); }, { title: 'Dove c’era, non c’è più, e viceversa' })),
      h('div.paint__grp', null,
        BRUSH.tool === 'riempi' ? R('Somiglianza', BRUSH.simile, (v) => { BRUSH.simile = v; }) : R('Dimensione', BRUSH.size, (v) => { BRUSH.size = v; }),
        R('Morbidezza', BRUSH.soft, (v) => { BRUSH.soft = v; }),
        R('Forza', BRUSH.forza, (v) => { BRUSH.forza = v; })),
      hasPhoto ? h('div.paint__grp', null,
        h('span.label', null, 'Parti dalla foto'),
        seg([{ id: 'nessuno', label: 'Niente' }, { id: 'luce', label: 'Luce' }, { id: 'tinta', label: 'Tinta' }, { id: 'bordi', label: 'Bordi' }], gen.modo, (v) => {
          snapshot(); gen.modo = v; bakeAuto(map, px, gen); changedMap();
          if (v === 'tinta') { BRUSH.prev = BRUSH.tool === 'contagocce' ? BRUSH.prev : BRUSH.tool; BRUSH.tool = 'contagocce'; toast('Tocca la foto sul colore da prendere'); }
          drawTools();
        }, { label: 'Parti dalla foto' }),
        h('p.meta', null, { nessuno: 'Solo quello che dipingi tu.', luce: 'La materia va nelle luci (con Inverti, nelle ombre).', tinta: BRUSH.tool === 'contagocce' ? 'Tocca la foto sul colore da prendere.' : 'La materia va dove la foto ha il colore preso.', bordi: 'La materia va lungo i contorni della foto.' }[gen.modo]),
        gen.modo !== 'nessuno' ? [
          gen.modo === 'tinta' ? [genSlider('Ampiezza della tinta', 'ampiezza'), h('button.link', { onclick: () => { BRUSH.prev = BRUSH.tool; BRUSH.tool = 'contagocce'; drawTools(); } }, 'Prendi un altro colore')] : genSlider('Soglia', 'soglia'),
          genSlider('Passaggio', 'morbidezza'),
          h('p.meta', null, 'Poi ritocca con pennello e gomma: i tratti restano anche se cambi l’aiuto.'),
        ] : null,
        video && gen.modo !== 'nessuno' ? h('button.switch', { role: 'switch', 'aria-checked': String(segui), onclick: () => { segui = !segui; dirty = true; commit(); drawTools(); } },
          h('span.switch__knob'), h('span.stack', null, h('span', null, 'Segui la luce del video'), h('span.meta', null, 'la parte ricavata dalla foto si ricalcola a ogni fotogramma'))) : null) : null,
      video ? h('p.meta', null, 'Il video si muove: la mappa resta ferma nel quadro.') : null,
      h('div.paint__grp', null,
        h('button.switch', { role: 'switch', 'aria-checked': String(showResult), onclick: () => toggleResult(!showResult) },
          h('span.switch__knob'), h('span.stack', null, h('span', null, 'Guarda la materia'), h('span.meta', null, 'il fotogramma vero, con la mappa che stai dipingendo'))),
        h('p.meta', null, 'Un dito dipinge, due dita spostano e ingrandiscono. Sul Mac: pinza del trackpad o ⌘ e rotella.')),
    );
  }

  function close() {
    if (showResult) toggleResult(false);
    commit();
    clearTimeout(commitT); cancelAnimationFrame(raf);
    window.removeEventListener('resize', layout);
    document.removeEventListener('keydown', keys);
    document.body.classList.remove('paint-open');
    sheet.remove();
    onDone && onDone();
  }
  const keys = (e) => {
    if (e.key === 'Escape') close();
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); const u = e.shiftKey ? redo.pop() : undo.pop(); if (u) { (e.shiftKey ? undo : redo).push(cloneMap(map)); map = u; changedMap(); drawTools(); } }
    else if (e.key === '[' || e.key === ']') { BRUSH.size = Math.min(1, Math.max(0, BRUSH.size + (e.key === ']' ? 0.05 : -0.05))); drawTools(); }
  };
  document.addEventListener('keydown', keys);
  window.addEventListener('resize', layout);
  drawTools();
  requestAnimationFrame(layout);
}

function resample(m, w, h) {
  const o = newMap(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = Math.min(m.h - 1, Math.floor(y * m.h / h)) * m.w + Math.min(m.w - 1, Math.floor(x * m.w / w));
    const j = y * w + x; o.R[j] = m.R[i]; o.G[j] = m.G[i]; o.B[j] = m.B[i];
  }
  return o;
}
