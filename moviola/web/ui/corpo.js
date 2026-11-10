// Passo 2: Scolpire con le dita e Macro.
//
// Scolpisci: l'anteprima diventa materia da toccare. Ogni dito è un gesto
// registrato nel tempo della clip (posizione, forza, strumento) e si ripete
// identico nel salvataggio in 4K. Macro: una camera che entra nella materia,
// con i suoi parametri animabili con le chiavi.
//
// Gli strumenti a dito di MOVIOLA restano separati: qui si scolpisce solo con
// «Scolpisci» acceso, e l'anteprima lo dice.

import { S, touch } from '../state.js';
import { h, fill, toast, seg } from './kit.js';
import { STRUMENTI, defaultScolpire, normalizeScolpire, pushPoint, trattoDi, span } from '../engine/corpo/gesti.js';
import { MACRO_PARAMS, MACRO_BY_ID, defaultMacro, normalizeMacro, keyOf, macroValue, macroCamera, screenToWorld, worldToScreen } from '../engine/corpo/macro.js';
import { MICRO, carattere } from '../engine/corpo/tatto.js';
import { byId } from '../engine/processes.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const f1 = (v) => v.toFixed(1).replace('.', ',');
const pct = (v) => Math.round(v * 100) + '%';
const gid = () => 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// stato dell'interfaccia che sopravvive ai ridisegni del pannello
const ui = { open: { scolpisci: false, macro: false } };

export function corpoUI({ player, screen, redraw }) {
  const clip = () => S.work;
  // finché il lavoro non è pronto si usano valori di partenza
  const spare = { sc: defaultScolpire(), mc: defaultMacro() };
  const sc = () => {
    const c = clip();
    if (!c) return spare.sc;
    if (!c.scolpire) c.scolpire = defaultScolpire();
    return c.scolpire;
  };
  const mc = () => {
    const c = clip();
    if (!c) return spare.mc;
    if (!c.macro) c.macro = defaultMacro();
    return c.macro;
  };
  /** Quando il lavoro è pronto (o cambia): ripara i dati letti dal disco e ridisegna. */
  function sync() {
    const c = clip(); if (!c) return;
    if (c.scolpire) c.scolpire = normalizeScolpire(c.scolpire);
    if (c.macro) c.macro = normalizeMacro(c.macro);
    toolSeg.set(sc().strumento);
    rDim.value = sc().dimensione; rForza.value = sc().forza;
    bMacro.setAttribute('aria-pressed', String(!!c.macro?.on));
    drawStatus();
  }

  let sculpting = false;
  let picking = false;     // «scegli il punto guardato»
  let rec = null;          // registrazione di un giro
  const active = new Map(); // dita appoggiate
  const corpo = () => player.r.corpo;

  // ------------------------------------------------------------ sopra l'anteprima
  const label = h('span.corpo__label');
  const recDot = h('span.corpo__rec', { hidden: true }, h('i'), h('span', null, 'registro'));
  const rings = h('div.corpo__rings');
  const cross = h('div.corpo__cross', { hidden: true });
  const overlay = h('div.corpo__over', { 'aria-hidden': 'true' }, rings, cross, h('div.corpo__tag', null, label, recDot));
  screen.append(overlay);

  // ------------------------------------------------------------ barra sotto l'anteprima
  const bSculpt = h('button.corpo__mode', { type: 'button', 'aria-pressed': 'false', onclick: () => setSculpt(!sculpting) }, 'Scolpisci');
  const bMacro = h('button.corpo__mode', { type: 'button', 'aria-pressed': 'false', onclick: () => setMacro(!mc().on) }, 'Macro');
  const status = h('span.corpo__status.meta');
  const toolSeg = seg(STRUMENTI.map((s) => ({ id: s.id, label: s.label, hint: s.hint })), sc().strumento, (v) => { sc().strumento = v; touch('clip'); drawStatus(); }, { label: 'Strumento' });
  const range = (id, min, max, step, aria) => h('input.range', {
    type: 'range', min, max, step, value: sc()[id], 'aria-label': aria,
    oninput: (e) => { sc()[id] = Number(e.target.value); touch('clip'); drawStatus(); },
  });
  const rDim = range('dimensione', 0.01, 0.2, 0.001, 'Dimensione del dito');
  const rForza = range('forza', 0.05, 1.5, 0.01, 'Forza');
  const bRec = h('button.btn', { type: 'button', onclick: () => (rec ? stopRec(false) : startRec()) }, 'Registra un giro');
  const bPlay = h('button.btn', { type: 'button', onclick: () => riascolta() }, 'Riascolta');
  const bUndo = h('button.btn.btn--quiet', { type: 'button', onclick: () => undo() }, 'Annulla l’ultimo');
  const tools = h('div.corpo__tools', { hidden: true },
    toolSeg,
    h('div.corpo__sliders', null,
      h('label.corpo__sl', null, h('span', null, 'Dimensione'), rDim),
      h('label.corpo__sl', null, h('span', null, 'Forza'), rForza)),
    h('div.corpo__acts', null, bRec, bPlay, bUndo));
  const bar = h('div.corpo', null, h('div.corpo__row', null, bSculpt, bMacro, status), tools);

  function drawStatus() {
    const c = clip(); if (!c) return;
    const n = c.scolpire?.gesti?.length || 0;
    const ch = carattere(c, byId);
    const parts = [];
    if (sculpting) parts.push(`${STRUMENTI.find((s) => s.id === sc().strumento)?.hint}`);
    else if (n) parts.push(`${n} ${n === 1 ? 'gesto' : 'gesti'} · risponde come ${ch.da.toLowerCase()}`);
    else parts.push('tocca Scolpisci e lavora la materia con le dita');
    if (c.macro?.on) parts.push(`Macro ×${f1(macroValue(c, 'ingrandimento', player.t))}`);
    status.textContent = parts.join(' · ');
    label.textContent = picking ? 'Tocca il punto da guardare' : sculpting ? `Scolpisci · ${STRUMENTI.find((s) => s.id === sc().strumento)?.label}` : '';
    overlay.dataset.on = String(sculpting || picking);
    bUndo.disabled = !n;
    bPlay.disabled = !n;
  }

  function setSculpt(on) {
    if (on && picking) stopPick();
    sculpting = on;
    bSculpt.setAttribute('aria-pressed', String(on));
    tools.hidden = !on;
    screen.dataset.sculpt = String(on);
    // mentre scolpisci, l'anteprima prende il posto delle strisce di stili e materie
    if (bar.parentElement) bar.parentElement.dataset.sculpt = String(on);
    if (on && !player.r.float) toast('Questo browser non calcola in virgola mobile: qui Scolpisci non lascia impronte. Sul Mac con Safari o Chrome funziona.');
    if (on) { sc(); if (!ui.hinted) { ui.hinted = true; toast(player.playing ? 'Tocca l’anteprima: ogni gesto si registra nel tempo della clip e torna identico nel video salvato.' : 'A clip ferma il gesto resta in questo istante. Con la clip che scorre, si registra nel tempo.'); } }
    else { active.clear(); fill(rings); if (rec) stopRec(false); }
    drawStatus();
  }

  function setMacro(on) {
    const m = mc();
    m.on = on;
    bMacro.setAttribute('aria-pressed', String(on));
    if (on) ui.open.macro = true;
    touch('clip');
    if (!player.playing) player.draw();
    drawStatus();
    redraw();
  }

  // ------------------------------------------------------------- dove tocca il dito
  function frameRect() {
    const cv = player.canvas;
    const r = cv.getBoundingClientRect();
    const a = cv.width / cv.height, b = r.width / r.height;
    let w = r.width, hh = r.height, x = r.left, y = r.top;
    if (b > a) { w = hh * a; x += (r.width - w) / 2; } else { hh = w / a; y += (r.height - hh) / 2; }
    return { x, y, w, h: hh };
  }
  const aspect = () => player.canvas.width / player.canvas.height;
  const camNow = (t) => (corpo().mostraTutto ? null : macroCamera(clip(), t, aspect()));
  function toWorld(e, t) {
    const R = frameRect();
    const sx = (e.clientX - R.x) / R.w, sy = 1 - (e.clientY - R.y) / R.h;
    const [x, y] = screenToWorld(camNow(t), sx, sy, aspect());
    return { x: clamp(x, 0, 1), y: clamp(y, 0, 1), inside: sx >= 0 && sx <= 1 && sy >= 0 && sy <= 1 };
  }

  /** Il tempo della clip adesso, al di sotto del fotogramma quando scorre. */
  function clipTime() {
    const T = clip().format.duration;
    if (!player.playing) return player.t;
    const t = (performance.now() - player._wall) / 1000;
    return ((t % T) + T) % T;
  }

  // La pressione: vera con la matita o dove il dispositivo la dà; altrimenti
  // dall'area del tocco e dalla velocità (piano e largo spinge di più).
  function pressure(e, st) {
    const real = e.pointerType === 'pen' || (e.pointerType === 'touch' && e.pressure > 0 && Math.abs(e.pressure - 0.5) > 1e-3 && e.pressure < 1);
    if (real) return clamp(e.pressure, 0.05, 1);
    const R = frameRect();
    const area = Math.sqrt(Math.max(1, (e.width || 1) * (e.height || 1))) / R.h;
    const aN = clamp((area - 0.02) / 0.06, 0, 1);
    let vN = 0;
    if (st) {
      const dt = Math.max(1, e.timeStamp - st.ts);
      vN = clamp(Math.hypot(e.clientX - st.cx, e.clientY - st.cy) / R.h / dt * 1000 / 2.5, 0, 1);
    }
    return clamp(0.55 + 0.3 * aN - 0.3 * vN, 0.12, 1);
  }

  function addPoint(st, e, now = performance.now()) {
    const c = clip();
    const t = clipTime();
    // la clip è tornata all'inizio con il dito appoggiato: un gesto nuovo
    if (player.playing && st.g.pts.length && t < st.g.pts[st.g.pts.length - 1][0] - 0.25) startGesture(st, t);
    const w = toWorld(e, t);
    const p = st.p = pressure(e, st);
    const d = st.g.pts.length ? (now - st.wall) / 1000 : 0;
    pushPoint(st.g, t, w.x, w.y, p, d);
    st.wall = now; st.ts = e.timeStamp; st.cx = e.clientX; st.cy = e.clientY;
    if (player.playing) corpo().hint('append', t);
    else {
      corpo().hint('stamped', t);
      corpo().campo?.stampNow(c, [trattoDi(st.g, st.g.pts.length - 1)]);
      drawSoon();
    }
    ring(st, e);
  }

  // a quadro fermo si ridisegna una volta per quadro dello schermo, non a ogni punto
  let drawRaf = 0;
  function drawSoon() {
    if (drawRaf) return;
    drawRaf = requestAnimationFrame(() => { drawRaf = 0; if (!player.playing) player.draw(); });
  }

  function startGesture(st, t) {
    const s = sc();
    st.g = { id: gid(), strumento: s.strumento, dimensione: s.dimensione, forza: s.forza, pts: [] };
    s.gesti.push(st.g);
    st.t0 = t;
  }

  function ring(st, e) {
    if (!st.el) { st.el = h('i.corpo__ring'); rings.append(st.el); }
    const R = frameRect(), sr = screen.getBoundingClientRect();
    const z = camNow(clipTime())?.z || 1;
    const d = st.g.dimensione * 2 * R.h * z;
    Object.assign(st.el.style, { left: (e.clientX - sr.left) + 'px', top: (e.clientY - sr.top) + 'px', width: d + 'px', height: d + 'px', opacity: String(0.45 + 0.55 * (st.p || 0.5)) });
  }

  function down(e) {
    if (picking) { e.preventDefault(); pickAt(e); return; }
    if (!sculpting) return;
    e.preventDefault();
    screen.setPointerCapture?.(e.pointerId);
    const st = { wall: performance.now(), ts: e.timeStamp, cx: e.clientX, cy: e.clientY, last: e };
    startGesture(st, clipTime());
    active.set(e.pointerId, st);
    addPoint(st, e);
    loop();
  }
  function move(e) {
    const st = active.get(e.pointerId);
    if (!st) { if (sculpting && e.pointerType === 'mouse') hover(e); return; }
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) {
      if (Math.hypot(ev.clientX - st.cx, ev.clientY - st.cy) < 1.5) continue;
      addPoint(st, ev);
      st.last = ev;
    }
  }
  function up(e) {
    const st = active.get(e.pointerId);
    if (!st) return;
    addPoint(st, e);
    active.delete(e.pointerId);
    st.el?.remove();
    touch('clip');
    drawStatus();
    redraw();
  }
  // il dito fermo continua a lavorare: un punto a ogni quadro dello schermo
  let raf = 0;
  function loop() {
    if (raf) return;
    const tick = (now) => {
      raf = 0;
      if (!active.size) return;
      for (const st of active.values()) if (now - st.wall > 1000 / 60) addPoint(st, st.last, now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  let hoverEl = null;
  function hover(e) {
    if (!hoverEl) { hoverEl = h('i.corpo__ring.corpo__ring--hover'); rings.append(hoverEl); }
    const R = frameRect(), sr = screen.getBoundingClientRect();
    const z = camNow(clipTime())?.z || 1;
    const d = sc().dimensione * 2 * R.h * z;
    Object.assign(hoverEl.style, { left: (e.clientX - sr.left) + 'px', top: (e.clientY - sr.top) + 'px', width: d + 'px', height: d + 'px' });
  }
  screen.addEventListener('pointerdown', down);
  screen.addEventListener('pointermove', move);
  screen.addEventListener('pointerup', up);
  screen.addEventListener('pointercancel', up);
  screen.addEventListener('pointerleave', () => { hoverEl?.remove(); hoverEl = null; });

  // ------------------------------------------------------------- registra, riascolta, cancella
  function startRec() {
    if (!sculpting) setSculpt(true);
    rec = { n0: sc().gesti.length };
    fill(bRec, 'Ferma');
    bRec.dataset.rec = 'true';
    recDot.hidden = false;
    player.restart(); player.play();
    redraw('play');
  }
  function stopRec(complete) {
    const r = rec; rec = null;
    fill(bRec, 'Registra un giro');
    bRec.dataset.rec = 'false';
    recDot.hidden = true;
    if (!r) return;
    const n = sc().gesti.length - r.n0;
    if (complete) { player.pause(); player.seek(0); }
    touch('clip');
    drawStatus(); redraw();
    toast(n ? `${complete ? 'Giro registrato' : 'Registrazione fermata'}: ${n} ${n === 1 ? 'gesto nuovo' : 'gesti nuovi'}. «Riascolta» li ripete identici.` : 'Nessun gesto in questo giro.');
  }
  function riascolta() {
    if (rec) stopRec(false);
    player.restart(); player.play();
    redraw('play');
  }
  function removeGesture(i) {
    const s = sc();
    const g = s.gesti[i]; if (!g) return;
    s.gesti.splice(i, 1);
    corpo().hint('edit', span(g)[0]);
    touch('clip');
    if (!player.playing) player.seek(player.frame);
    drawStatus(); redraw();
    return g;
  }
  function undo() {
    const s = sc(); if (!s.gesti.length) return;
    const g = removeGesture(s.gesti.length - 1);
    toast('Tolto l’ultimo gesto.', { label: 'Rimetti', run: () => { s.gesti.push(g); corpo().hint('edit', span(g)[0]); touch('clip'); if (!player.playing) player.seek(player.frame); drawStatus(); redraw(); } });
  }

  // ------------------------------------------------------------- il punto guardato
  function startPick() {
    if (sculpting) setSculpt(false);
    picking = true;
    corpo().mostraTutto = true;
    screen.dataset.pick = 'true';
    if (!player.playing) player.draw();
    showCross();
    drawStatus(); redraw();
  }
  function stopPick() {
    picking = false;
    corpo().mostraTutto = false;
    screen.dataset.pick = 'false';
    cross.hidden = true;
    if (!player.playing) player.draw();
    drawStatus();
  }
  function showCross() {
    const R = frameRect(), sr = screen.getBoundingClientRect();
    const t = player.t;
    const x = macroValue(clip(), 'guardaX', t), y = macroValue(clip(), 'guardaY', t);
    cross.hidden = false;
    Object.assign(cross.style, { left: (R.x - sr.left + x * R.w) + 'px', top: (R.y - sr.top + (1 - y) * R.h) + 'px' });
  }
  function pickAt(e) {
    const R = frameRect();
    const x = clamp((e.clientX - R.x) / R.w, 0, 1), y = clamp(1 - (e.clientY - R.y) / R.h, 0, 1);
    setParam('guardaX', x); setParam('guardaY', y);
    stopPick();
    if (!mc().on) setMacro(true);
    redraw();
  }

  // ------------------------------------------------------------- chiavi della Macro
  const keysOf = (id) => clip().keys?.[keyOf(id)] || [];
  const near = (a, b) => Math.abs(a - b) < 0.5 / clip().format.fps;
  function setParam(id, v) {
    const c = clip(), m = mc(), t = player.t;
    const tr = keysOf(id);
    if (tr.length) {
      const k = tr.findIndex((x) => near(x[0], t));
      if (k >= 0) tr[k][1] = v; else { tr.push([t, v]); tr.sort((a, b) => a[0] - b[0]); }
    } else m.params[id] = v;
    c.keys[keyOf(id)] = tr.length ? tr : undefined;
    if (!tr.length) delete c.keys[keyOf(id)];
    touch('clip');
    if (!player.playing) player.draw();
  }
  function toggleKey(id) {
    const c = clip(), t = player.t;
    const tr = keysOf(id).slice();
    const k = tr.findIndex((x) => near(x[0], t));
    if (k >= 0) tr.splice(k, 1); else { tr.push([t, macroValue(c, id, t)]); tr.sort((a, b) => a[0] - b[0]); }
    if (tr.length) c.keys[keyOf(id)] = tr; else { if (keysOf(id).length) mc().params[id] = macroValue(c, id, t); delete c.keys[keyOf(id)]; }
    touch('clip'); redraw();
  }
  function clearKeys(id) {
    const c = clip();
    mc().params[id] = macroValue(c, id, player.t);
    delete c.keys[keyOf(id)];
    touch('clip'); if (!player.playing) player.draw(); redraw();
  }
  function preset(kind) {
    const c = clip(), T = c.format.duration, m = mc();
    const z = Math.max(4, m.params.ingrandimento);
    if (kind === 'entra') c.keys[keyOf('ingrandimento')] = [[0, 1.3], [T, Math.min(32, z * 1.6)]];
    if (kind === 'esci') c.keys[keyOf('ingrandimento')] = [[0, Math.min(32, z * 1.6)], [T, 1.3]];
    if (kind === 'fuoco') c.keys[keyOf('fuoco')] = [[0, 0.2], [T, 0.85]];
    if (kind === 'togli') for (const p of MACRO_PARAMS) if (c.keys[keyOf(p.id)]) { m.params[p.id] = macroValue(c, p.id, player.t); delete c.keys[keyOf(p.id)]; }
    if (!m.on) m.on = true;
    bMacro.setAttribute('aria-pressed', 'true');
    touch('clip');
    player.restart(); player.play();
    redraw('play');
    toast(kind === 'togli' ? 'Tolte le chiavi della Macro: restano i valori di questo istante.' : 'Chiavi messe dall’inizio alla fine della clip: le vedi con ◆ accanto ai parametri.');
  }

  // ------------------------------------------------------------- pannello
  const sliders = new Map(); // parametri della Macro con chiavi: si aggiornano mentre scorre
  function macroRow(p) {
    const c = clip();
    const v = macroValue(c, p.id, player.t);
    const tr = keysOf(p.id);
    const onKey = tr.some((x) => near(x[0], player.t));
    const toS = (x) => (p.log ? Math.log(x) / Math.log(p.max) : x);
    const fromS = (s) => (p.log ? Math.pow(p.max, s) : s);
    const fmt = (x) => (p.log ? '×' + f1(x) : p.step >= 1 ? Math.round(x) + (p.id === 'verso' ? '°' : '') : p.id === 'rotazione' ? f1(x) + '°' : x.toFixed(2).replace('.', ','));
    const val = h('span.prm__val', null, fmt(v));
    const input = h('input.range', {
      type: 'range', min: p.log ? 0 : p.min, max: p.log ? 1 : p.max, step: p.log ? 0.001 : p.step || (p.max - p.min) / 400, value: toS(v), 'aria-label': p.label,
      oninput: (e) => { const x = fromS(Number(e.target.value)); val.textContent = fmt(x); setParam(p.id, x); drawStatus(); },
    });
    const key = h('button.corpo__key', { type: 'button', 'aria-pressed': String(onKey), title: onKey ? 'Togli la chiave in questo istante' : 'Metti una chiave in questo istante', 'aria-label': `Chiave di ${p.label}`, onclick: () => toggleKey(p.id) }, '◆');
    if (tr.length) sliders.set(p.id, { input, val, toS, fmt, key });
    return h('div.prm.corpo__prm', null,
      h('span.prm__lbl', null, p.label, tr.length ? h('button.link.corpo__keys', { type: 'button', onclick: () => clearKeys(p.id) }, `${tr.length} ${tr.length === 1 ? 'chiave' : 'chiavi'} · togli`) : null),
      val, key, input,
      p.hint ? h('span.meta.corpo__hint', null, p.hint) : null);
  }

  function panel() {
    const c = clip(); if (!c) return null;
    sliders.clear();
    const s = sc(), m = mc();
    const ch = carattere(c, byId);
    const n = s.gesti.length;
    // la memoria cambia tutta la storia del campo: si ricalcola quando il cursore si ferma
    let timer = 0;
    const memRow = (id, label, min, max, step, hint, fmt, field = false) => {
      const val = h('span.prm__val', null, fmt(s[id]));
      const apply = (v) => { s[id] = v; if (field) corpo().hint('edit', 0); touch('clip'); if (!player.playing) player.seek(player.frame); };
      return h('div.prm', null, h('span.prm__lbl', null, label), val,
        h('input.range', { type: 'range', min, max, step, value: s[id], 'aria-label': label, oninput: (e) => {
          const v = Number(e.target.value); val.textContent = fmt(v);
          clearTimeout(timer);
          if (field) timer = setTimeout(() => apply(v), 160); else apply(v);
        } }),
        hint ? h('span.meta.corpo__hint', null, hint) : null);
    };
    const gesti = s.gesti.map((g, i) => {
      const [a, b] = span(g);
      return h('div.corpo__g', null,
        h('span.corpo__gn', null, String(i + 1)),
        h('span.corpo__gw', null, STRUMENTI.find((x) => x.id === g.strumento)?.label || g.strumento),
        h('span.meta', null, a === b ? `a ${f1(a)} s` : `da ${f1(a)} a ${f1(b)} s`, ` · dito ${pct(g.dimensione)} · forza ${g.forza.toFixed(2).replace('.', ',')}`),
        h('button.btn.btn--quiet', { type: 'button', 'aria-label': `Cancella il gesto ${i + 1}`, onclick: () => removeGesture(i) }, 'Cancella'));
    });
    const sculptSec = h('details.layer.corpo__sec', { open: ui.open.scolpisci, ontoggle: (e) => { ui.open.scolpisci = e.target.open; } },
      h('summary.layer__sum', null, h('span.layer__name', null, 'Scolpisci con le dita'), h('span.meta', null, n ? `${n} ${n === 1 ? 'gesto' : 'gesti'}` : 'nessun gesto')),
      h('p.about', null, `Tocchi la materia e la spingi, la scavi, la impasti, la lisci, la pizzichi. Adesso risponde come ${ch.da.toLowerCase()}: ${ch.fluido > 0.6 ? 'si apre e si richiude' : ch.tenuta > 0.8 ? 'tiene l’impronta' : 'cede e torna piano'}.`),
      h('div.layer__prms', null,
        memRow('memoria', 'Memoria della materia', 0, 1, 0.01, '0 nulla resta · metà la materia com’è · 1 tutto resta', (v) => (v < 0.47 ? 'dimentica' : v > 0.53 ? 'ricorda' : 'com’è'), true),
        memRow('rilievo', 'Rilievo dell’impronta', 0, 2, 0.01, null, (v) => v.toFixed(2).replace('.', ',')),
        memRow('luce', 'Direzione della luce radente', 0, 360, 1, null, (v) => Math.round(v) + '°')),
      n ? h('div.corpo__list', null, h('span.label', null, 'Gesti registrati'), gesti,
        h('button.link', { type: 'button', onclick: () => { const all = s.gesti.splice(0); corpo().hint('edit', 0); touch('clip'); if (!player.playing) player.seek(player.frame); drawStatus(); redraw(); toast(`Cancellati ${all.length} gesti.`, { label: 'Rimetti', run: () => { s.gesti.push(...all); corpo().hint('edit', 0); touch('clip'); if (!player.playing) player.seek(player.frame); drawStatus(); redraw(); } }); } }, 'Cancella tutti i gesti'))
        : h('p.meta', null, 'Accendi «Scolpisci» sotto l’anteprima e tocca la materia.'));
    const macroSec = h('details.layer.corpo__sec', { open: ui.open.macro, ontoggle: (e) => { ui.open.macro = e.target.open; } },
      h('summary.layer__sum', null, h('span.layer__name', null, 'Macro'), h('span.meta', null, m.on ? `accesa · ×${f1(macroValue(c, 'ingrandimento', player.t))}` : 'spenta')),
      h('p.about', null, 'Una camera che entra nella materia: avvicinandoti compaiono grana, pori, fibre, bolle o cristalli, ancorati alla superficie; il rilievo dà parallasse e fuoco vero.'),
      h('button.switch', { type: 'button', role: 'switch', 'aria-checked': String(m.on), onclick: () => setMacro(!m.on) },
        h('span.switch__knob'), h('span.stack', null, h('span', null, m.on ? 'Macro accesa' : 'Accendi la Macro'), h('span.meta', null, 'tutta la catena vista da vicino'))),
      h('div.corpo__pres', null,
        h('button.btn', { type: 'button', onclick: () => (picking ? stopPick() : startPick()) }, picking ? 'Annulla' : 'Scegli il punto da guardare'),
        h('button.btn', { type: 'button', onclick: () => preset('entra') }, 'Entra piano'),
        h('button.btn', { type: 'button', onclick: () => preset('esci') }, 'Esci piano'),
        h('button.btn', { type: 'button', onclick: () => preset('fuoco') }, 'Il fuoco scivola')),
      h('div.ctl', null, h('span.ctl__lbl', null, 'Microdettaglio', h('span.meta', null, (m.micro || 'auto') === 'auto' ? `secondo la materia: ${MICRO.find((x) => x.id === ch.micro)?.label.toLowerCase()}` : '')),
        seg(MICRO.map((x) => ({ id: x.id, label: x.id === 'auto' ? 'Auto' : x.label })), m.micro || 'auto', (v) => { m.micro = v; touch('clip'); if (!player.playing) player.draw(); redraw(); }, { label: 'Microdettaglio' })),
      h('div.layer__prms', null, MACRO_PARAMS.filter((p) => p.id !== 'guardaX' && p.id !== 'guardaY').map(macroRow)),
      h('p.meta.corpo__hint', null, '◆ mette una chiave in questo istante: con due o più chiavi il parametro si muove lungo la clip. Spostando il cursore su un parametro con chiavi, cambi la chiave di questo istante.'),
      keysOf('ingrandimento').length || Object.keys(c.keys).some((k) => k.startsWith('macro.')) ? h('button.link', { type: 'button', onclick: () => preset('togli') }, 'Togli tutte le chiavi della Macro') : null);
    return h('div.corpo__panel', null, sculptSec, macroSec);
  }

  // ------------------------------------------------------------- a ogni fotogramma
  let fr = 0;
  function frame(p) {
    if (rec && p.frame >= p.total - 1) stopRec(true);
    if ((fr++ % 4) === 0) {
      const t = p.t;
      for (const [id, s] of sliders) {
        const v = macroValue(clip(), id, t);
        s.input.value = s.toS(v); s.val.textContent = s.fmt(v);
        s.key.setAttribute('aria-pressed', String(keysOf(id).some((x) => near(x[0], t))));
      }
      if (clip()?.macro?.on || sculpting) drawStatus();
    }
    ghosts(p);
  }
  // durante il riascolto, cerchi leggeri dove passano le dita registrate
  const ghostEls = [];
  function ghosts(p) {
    if (!sculpting || active.size) { ghostEls.forEach((e) => { e.hidden = true; }); return; }
    const t = p.t;
    const c = clip();
    const R = frameRect(), sr = screen.getBoundingClientRect();
    const cam = camNow(t);
    let k = 0;
    for (const g of c.scolpire?.gesti || []) {
      const [a, b] = span(g);
      if (t < a || t > b + 0.05) continue;
      let q = g.pts[0];
      for (const pt of g.pts) { if (pt[0] > t) break; q = pt; }
      const [sx, sy] = worldToScreen(cam, q[1], q[2], aspect());
      let el = ghostEls[k];
      if (!el) { el = h('i.corpo__ring.corpo__ring--ghost'); rings.append(el); ghostEls.push(el); }
      el.hidden = false;
      const d = g.dimensione * 2 * R.h * (cam?.z || 1);
      Object.assign(el.style, { left: (R.x - sr.left + sx * R.w) + 'px', top: (R.y - sr.top + (1 - sy) * R.h) + 'px', width: d + 'px', height: d + 'px' });
      k++;
    }
    for (; k < ghostEls.length; k++) ghostEls[k].hidden = true;
  }

  drawStatus();
  return {
    bar, panel, frame, sync,
    /** Un tocco sull'anteprima appartiene a Scolpisci o alla scelta del punto, non al play. */
    capturesTap: () => sculpting || picking,
    destroy() {
      cancelAnimationFrame(raf);
      screen.removeEventListener('pointerdown', down);
      screen.removeEventListener('pointermove', move);
      screen.removeEventListener('pointerup', up);
      screen.removeEventListener('pointercancel', up);
      corpo().mostraTutto = false;
      overlay.remove();
    },
  };
}
