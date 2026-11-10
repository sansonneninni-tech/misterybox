// Passo 2 · «Tutta la catena»: Respiro, Tempo geologico, Gravità e vento.
// Tre funzioni che agiscono su tutte le materie insieme. Qui ci sono i loro
// controlli, la curva del tempo sotto la timeline e il disegno delle forze
// sul quadro (dito su iPhone, mouse sul Mac).
//
// flow.js chiama `attachOrganismo` una volta per schermata e mette
// `org.panel()` nel pannello: tutto il resto vive qui.

import { h, fill, seg, toast } from './kit.js';
import { byId } from '../engine/processes.js';
import { passKey, trackValue, clamp } from '../engine/catena.js';
import { RESPIRO_BASE, RESPIRO_CONTROLLI, breathAt, breaths, breathable, paramMode } from '../engine/respiro.js';
import { TEMPO_BASE, TEMPO_FORME, TEMPO_MASSIMI, TEMPO_MIN, speedAt, prepCurve, describe } from '../engine/tempo.js';
import { FORZE_BASE, FORZE_TIPI, forceValue, fieldAt, packLocals, gravityAt } from '../engine/forze.js';

const pct = (v) => `${Math.round(v * 100)}%`;
const dpr = () => Math.min(2, window.devicePixelRatio || 1);
const READS = /\b(FORZA|GIU|GRAVITA|SOFFIO|VERSO_VENTO|RAFFICA)\b/;

/** Riempie i campi mancanti senza perdere quelli scelti. */
export function ensureOrganismo(clip) {
  clip.respiro = { ...RESPIRO_BASE, ...(clip.respiro || {}) };
  clip.respiro.materie ||= {}; clip.respiro.chiavi ||= {};
  clip.tempo = { ...TEMPO_BASE, ...(clip.tempo || {}) };
  clip.tempo.materie ||= {}; if (!Array.isArray(clip.tempo.punti) || !clip.tempo.punti.length) clip.tempo.punti = TEMPO_BASE.punti.map((p) => p.slice());
  const F = clip.forze || {};
  clip.forze = { ...FORZE_BASE, ...F, gravita: { ...FORZE_BASE.gravita, ...(F.gravita || {}) }, vento: { ...FORZE_BASE.vento, ...(F.vento || {}) } };
  clip.forze.locali ||= []; clip.forze.materie ||= {}; clip.forze.chiavi ||= {};
  return clip;
}

/** Le tre impostazioni da portare quando il passo 2 ricostruisce la clip. */
export const ORGANISMO_KEYS = ['respiro', 'tempo', 'forze'];

/** Come una materia sente le forze, detto in parole. */
function howReads(proc) {
  if (proc.forze === 'mappa') return 'la sua colata è portata dal campo e cade secondo la gravità';
  if (proc.forze === 'trasporto') return 'è portata dal vento, dalle correnti e dai vortici';
  if (READS.test((proc.glsl || '') + (typeof proc.sim === 'string' ? proc.sim : ''))) return 'il vento disegnato guida il suo';
  return 'non le sente: è una materia che sta ferma';
}

export function attachOrganismo({ screen, timeline, player, work, changed }) {
  let destroyed = false;
  const clip = () => work();
  const materie = () => (clip()?.chain || []).filter((p) => byId[p.proc]?.materia);

  // ------------------------------------------------- disegno sul quadro
  const ov = h('canvas.org-ov', { 'aria-hidden': 'true' });
  screen.append(ov);
  let tool = null;        // tipo di forza che si sta disegnando, o null
  let drag = null;
  let selected = null;    // id della forza locale toccata nell'elenco

  function imageRect() {
    const W = ov.clientWidth, H = ov.clientHeight;
    const a = player.r.w / Math.max(1, player.r.h);
    let w = W, hh = W / a;
    if (hh > H) { hh = H; w = H * a; }
    return { x: (W - w) / 2, y: (H - hh) / 2, w, h: hh };
  }
  const toUV = (e) => {
    const b = ov.getBoundingClientRect(), R = imageRect();
    return [clamp((e.clientX - b.left - R.x) / R.w, 0, 1), clamp(1 - (e.clientY - b.top - R.y) / R.h, 0, 1)];
  };

  function drawOverlay() {
    const c = clip();
    const F = c?.forze;
    const show = F && F.on && (F.mostra || tool);
    ov.dataset.on = String(!!show);
    ov.dataset.tool = tool ? 'true' : 'false';
    const W = Math.round(ov.clientWidth * dpr()), H = Math.round(ov.clientHeight * dpr());
    if (ov.width !== W || ov.height !== H) { ov.width = W; ov.height = H; }
    const g = ov.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    if (!show || !W) return;
    g.scale(dpr(), dpr());
    const R = imageRect();
    const t = player.t;
    const asp = R.w / R.h;
    const P = (u, v) => [R.x + u * R.w, R.y + (1 - v) * R.h];
    const pk = packLocals(F, t, asp);
    // il campo: trattini sottili come limatura di ferro
    const step = Math.max(22, Math.min(36, R.w / 26));
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(248, 248, 248, 0.32)';
    g.beginPath();
    for (let y = R.y + step / 2; y < R.y + R.h; y += step) {
      for (let x = R.x + step / 2; x < R.x + R.w; x += step) {
        const u = (x - R.x) / R.w, v = 1 - (y - R.y) / R.h;
        const [vx, vy] = fieldAt(F, t, u, v, asp, pk);
        const m = Math.hypot(vx, vy);
        if (m < 0.004) { g.moveTo(x - 0.5, y); g.lineTo(x + 0.5, y); continue; }
        const L = Math.min(step * 0.8, 5 + m * step * 4);
        const dx = (vx / m) * L / 2, dy = -(vy / m) * L / 2;
        g.moveTo(x - dx, y - dy); g.lineTo(x + dx, y + dy);
      }
    }
    g.stroke();
    // le forze locali
    for (const l of F.locali) {
      const on = l.id === selected;
      g.strokeStyle = on ? 'rgba(248, 248, 248, 0.95)' : 'rgba(248, 248, 248, 0.6)';
      g.fillStyle = g.strokeStyle;
      if (l.tipo === 'corrente') {
        const pts = l.punti.map(([u, v]) => P(u, v));
        g.setLineDash([]); g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.stroke();
        // frecce piccole lungo il tratto
        for (let i = 1; i < pts.length; i += 2) {
          const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
          const a = Math.atan2(y1 - y0, x1 - x0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
          g.beginPath(); g.moveTo(mx - 5 * Math.cos(a - 0.5), my - 5 * Math.sin(a - 0.5)); g.lineTo(mx, my); g.lineTo(mx - 5 * Math.cos(a + 0.5), my - 5 * Math.sin(a + 0.5)); g.stroke();
        }
      } else {
        const [x, y] = P(l.x, l.y), r = l.r * R.h;
        g.setLineDash([2, 4]); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
        g.beginPath();
        if (l.tipo === 'vortice') {
          const s = l.verso || 1;
          g.arc(x, y, 9, 0, Math.PI * 1.5, s < 0); g.stroke();
          const a = s > 0 ? Math.PI * 1.5 : -Math.PI * 1.5, ex = x + 9 * Math.cos(a), ey = y + 9 * Math.sin(a);
          g.beginPath(); g.moveTo(ex - 4, ey - 3 * s); g.lineTo(ex, ey); g.lineTo(ex - 4, ey + 3 * s); g.stroke();
        } else {
          const out = l.tipo === 'sorgente';
          for (let k = 0; k < 4; k++) {
            const a = (k * Math.PI) / 2 + Math.PI / 4, c1 = Math.cos(a), s1 = Math.sin(a);
            const a0 = out ? 4 : 13, a1 = out ? 13 : 4;
            g.moveTo(x + c1 * a0, y + s1 * a0); g.lineTo(x + c1 * a1, y + s1 * a1);
          }
          g.stroke();
          g.beginPath(); g.arc(x, y, 1.5, 0, Math.PI * 2); g.fill();
        }
      }
    }
    if (drag?.preview) drag.preview(g, P, R);
    // gravità e vento: due indicatori discreti in basso a sinistra
    const gv = gravityAt(F, t);
    const wf = forceValue(F, 'vento.forza', t), wa = (forceValue(F, 'vento.direzione', t) * Math.PI) / 180;
    g.font = '10px "DM Mono", monospace';
    g.fillStyle = 'rgba(248, 248, 248, 0.6)'; g.strokeStyle = 'rgba(248, 248, 248, 0.6)';
    const arrow = (x, y, a, len, label) => {
      g.fillText(label, x - 4, y + 24);
      if (len < 0.5) { g.beginPath(); g.arc(x, y, 1.5, 0, Math.PI * 2); g.fill(); return; }
      const ex = x + Math.cos(a) * len, ey = y - Math.sin(a) * len;
      g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
      const b = Math.atan2(ey - y, ex - x);
      g.beginPath(); g.moveTo(ex - 5 * Math.cos(b - 0.5), ey - 5 * Math.sin(b - 0.5)); g.lineTo(ex, ey); g.lineTo(ex - 5 * Math.cos(b + 0.5), ey - 5 * Math.sin(b + 0.5)); g.stroke();
    };
    const bx = R.x + 22, by = R.y + R.h - 34;
    arrow(bx, by, Math.atan2(gv.dir[1], gv.dir[0]), gv.g * 18, 'g');
    arrow(bx + 46, by, wa, wf * 18, 'vento');
  }

  // Tocchi e trascinamenti: la forza scelta nasce dove tocchi.
  ov.addEventListener('pointerdown', (e) => {
    if (!tool) return;
    e.preventDefault(); e.stopPropagation();
    ov.setPointerCapture(e.pointerId);
    const [u, v] = toUV(e);
    if (tool === 'corrente') {
      drag = { pts: [[u, v]], preview: (g, P) => { g.strokeStyle = 'rgba(248, 248, 248, 0.95)'; g.beginPath(); drag.pts.forEach(([a, b], i) => { const [x, y] = P(a, b); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); } };
    } else {
      drag = { c: [u, v], r: 0, preview: (g, P, R) => { const [x, y] = P(drag.c[0], drag.c[1]); g.strokeStyle = 'rgba(248, 248, 248, 0.95)'; g.beginPath(); g.arc(x, y, Math.max(drag.r, 0.2) * R.h, 0, Math.PI * 2); g.stroke(); } };
    }
    drawOverlay();
  });
  ov.addEventListener('pointermove', (e) => {
    if (!drag) return;
    e.preventDefault();
    const [u, v] = toUV(e);
    const asp = imageRect().w / imageRect().h;
    if (drag.pts) {
      const [pu, pv] = drag.pts[drag.pts.length - 1];
      if (Math.hypot((u - pu) * asp, v - pv) > 0.025) drag.pts.push([u, v]);
    } else drag.r = Math.hypot((u - drag.c[0]) * asp, v - drag.c[1]);
    drawOverlay();
  });
  const endDrag = (e) => {
    if (!drag) return;
    e.stopPropagation();
    const F = clip().forze;
    const id = 'f' + Date.now().toString(36).slice(-5) + Math.floor(Math.random() * 1e3).toString(36);
    if (drag.pts) {
      let pts = drag.pts;
      if (pts.length >= 2) {
        // al massimo 24 punti per corrente: il campo resta leggero
        while (pts.length > 24) pts = pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1);
        F.locali.push({ id, tipo: 'corrente', r: 0.08, forza: 0.8, punti: pts.map(([a, b]) => [round(a), round(b)]) });
      } else toast('Trascina il dito per tracciare la corrente.');
    } else {
      F.locali.push({ id, tipo: tool, x: round(drag.c[0]), y: round(drag.c[1]), r: round(clamp(drag.r > 0.03 ? drag.r : 0.2, 0.05, 0.9)), forza: 0.8, verso: 1 });
    }
    if (F.locali.length > 24) { F.locali.shift(); toast('Al massimo 24 forze locali: ho tolto la più vecchia.'); }
    selected = F.locali[F.locali.length - 1]?.id;
    drag = null;
    changed();
    drawOverlay(); redrawPanel();
  };
  ov.addEventListener('pointerup', endDrag);
  ov.addEventListener('pointercancel', () => { drag = null; drawOverlay(); });
  ov.addEventListener('click', (e) => { if (tool) e.stopPropagation(); });

  // ------------------------------------------- curva del tempo (timeline)
  const strip = h('canvas.org-tempo__cv', { 'aria-label': 'Curva della velocità del tempo della materia: disegnala col dito' });
  const stripNote = h('span.meta.org-tempo__note');
  const stripWrap = h('div.org-tempo', { hidden: true },
    h('div.org-tempo__head', null, h('span.meta', null, 'Velocità del tempo della materia · disegnala col dito'), stripNote), strip);
  timeline.append(stripWrap);
  let samples = null;     // la curva mentre la si disegna: 49 valori
  const NS = 48;
  const yOf = (s, M, H) => { const a = Math.log2(TEMPO_MIN), b = Math.log2(M); return H - 6 - ((Math.log2(s) - a) / (b - a)) * (H - 12); };
  const sOf = (y, M, H) => { const a = Math.log2(TEMPO_MIN), b = Math.log2(M); return 2 ** (a + clamp((H - 6 - y) / (H - 12), 0, 1) * (b - a)); };

  function drawStrip() {
    const T = clip()?.tempo;
    if (!(T && T.on)) scales.length = 0;
    stripWrap.hidden = !(T && T.on);
    if (stripWrap.hidden) return;
    const W = Math.round(strip.clientWidth * dpr()), H = Math.round(strip.clientHeight * dpr());
    if (!W) return;
    if (strip.width !== W || strip.height !== H) { strip.width = W; strip.height = H; }
    const g = strip.getContext('2d');
    g.setTransform(dpr(), 0, 0, dpr(), 0, 0);
    const w = W / dpr(), hh = H / dpr();
    g.clearRect(0, 0, w, hh);
    const M = T.massimo || 16;
    // riferimenti: ×1 e il massimo
    g.strokeStyle = 'rgba(248, 248, 248, 0.12)'; g.lineWidth = 1;
    g.setLineDash([2, 3]);
    for (const s of [1, M]) { const y = Math.round(yOf(s, M, hh)) + 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.setLineDash([]);
    g.font = '9px "DM Mono", monospace'; g.fillStyle = '#7b7b7b';
    g.fillText(`×${M}`, 3, yOf(M, M, hh) + 10); g.fillText('quasi fermo', 3, hh - 3);
    g.textAlign = 'right'; g.fillText('×1', w - 3, yOf(1, M, hh) - 3); g.textAlign = 'left';
    // la curva
    const pre = prepCurve(T);
    g.strokeStyle = '#f8f8f8'; g.lineWidth = 1.5; g.beginPath();
    for (let x = 0; x <= w; x += 1) {
      const u = x / w;
      const s = samples ? sampleAt(samples, u) : speedAt(T, u, pre);
      const y = yOf(s, M, hh);
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
    // dove siamo
    const fr = player.frame % player.total;
    const px = Math.round((fr / Math.max(1, player.total - 1)) * w) + 0.5;
    g.strokeStyle = 'rgba(248, 248, 248, 0.45)'; g.beginPath(); g.moveTo(px, 0); g.lineTo(px, hh); g.stroke();
  }
  const sampleAt = (S, u) => { const x = clamp(u, 0, 1) * NS, i = Math.min(NS - 1, Math.floor(x)); const a = Math.log2(S[i]), b = Math.log2(S[i + 1]); return 2 ** (a + (b - a) * (x - i)); };

  let lastX = null;
  strip.addEventListener('pointerdown', (e) => {
    const T = clip().tempo;
    strip.setPointerCapture(e.pointerId);
    const pre = prepCurve(T);
    samples = Array.from({ length: NS + 1 }, (_, i) => speedAt(T, i / NS, pre));
    lastX = null;
    paint(e);
  });
  strip.addEventListener('pointermove', (e) => { if (samples) paint(e); });
  const endPaint = () => {
    if (!samples) return;
    const T = clip().tempo;
    T.punti = samples.map((s, i) => [round(i / NS), round(s)]);
    samples = null;
    changed({ restart: true });
    drawStrip(); redrawPanel();
  };
  strip.addEventListener('pointerup', endPaint);
  strip.addEventListener('pointercancel', endPaint);
  function paint(e) {
    const b = strip.getBoundingClientRect();
    const M = clip().tempo.massimo || 16;
    const u = clamp((e.clientX - b.left) / b.width, 0, 1);
    const s = clamp(sOf(e.clientY - b.top, M, b.height), TEMPO_MIN, M);
    const i1 = Math.round(u * NS);
    const i0 = lastX === null ? i1 : lastX.i;
    const s0 = lastX === null ? s : lastX.s;
    const [a, z] = i0 <= i1 ? [i0, i1] : [i1, i0];
    for (let i = a; i <= z; i++) {
      const f = z === a ? 1 : (i - i0) / (i1 - i0);
      samples[i] = 2 ** (Math.log2(s0) + (Math.log2(s) - Math.log2(s0)) * clamp(f, 0, 1));
    }
    lastX = { i: i1, s };
    drawStrip();
  }

  // ----------------------------------------------------------- pannello
  const host = h('section.org', { 'aria-label': 'Tutta la catena' });
  const open = { respiro: false, tempo: false, forze: false };
  let breathCv = null;
  const live = [];        // controlli con chiavi da aggiornare mentre scorre il tempo

  function sw(on, label, meta, onToggle) {
    return h('button.org-sw', { type: 'button', role: 'switch', 'aria-checked': String(!!on), 'aria-label': label, onclick: (e) => { e.preventDefault(); e.stopPropagation(); onToggle(!on); } },
      h('span.switch__knob'), h('span.org-sw__txt', null, on ? 'acceso' : 'spento'));
  }

  /** Cursore con valore, e (se serve) il rombo per la chiave al punto della timeline. */
  function slider({ label, min, max, step, value, meta, onInput, keys }) {
    const val = h('span.prm__val', null, meta ? meta(value) : fmt(value));
    const input = h('input.range', { type: 'range', min, max, step: step || (max - min) / 200, value, 'aria-label': label,
      oninput: (e) => { const v = Number(e.target.value); val.textContent = meta ? meta(v) : fmt(v); onInput(v); } });
    let keyBtn = null;
    if (keys) {
      const { track, set } = keys;
      const draw = () => {
        const tr = track();
        const here = tr?.findIndex(([kt]) => Math.abs(kt - player.t) < 0.5 / player.fps) ?? -1;
        keyBtn.dataset.on = String(here >= 0);
        keyBtn.textContent = tr?.length ? `◆ ${tr.length}` : '◇';
        keyBtn.title = here >= 0 ? 'Togli la chiave in questo punto' : 'Metti una chiave in questo punto della timeline';
      };
      keyBtn = h('button.org-key', { type: 'button', 'aria-label': 'Chiave per ' + label, onclick: () => {
        const tr = (track() || []).slice();
        const here = tr.findIndex(([kt]) => Math.abs(kt - player.t) < 0.5 / player.fps);
        if (here >= 0) tr.splice(here, 1); else tr.push([round(player.t, 3), Number(input.value)]);
        tr.sort((a, b) => a[0] - b[0]);
        set(tr.length ? tr : null);
        changed(); draw();
        toast(here >= 0 ? 'Chiave tolta' : `Chiave a ${player.t.toFixed(1)} s: ${label.toLowerCase()} ${meta ? meta(Number(input.value)) : fmt(Number(input.value))}`);
      } });
      // con le chiavi, muovere il cursore aggiorna (o crea) la chiave del punto
      const orig = onInput;
      onInput = (v) => {
        const tr = track();
        if (tr?.length) {
          const here = tr.findIndex(([kt]) => Math.abs(kt - player.t) < 0.5 / player.fps);
          if (here >= 0) tr[here][1] = v; else { tr.push([round(player.t, 3), v]); tr.sort((a, b) => a[0] - b[0]); }
          changed(); draw();
        } else orig(v);
      };
      draw();
      live.push(() => {
        const tr = track();
        if (tr?.length && document.activeElement !== input) { const v = trackValue(tr, player.t, Number(input.value)); input.value = v; val.textContent = meta ? meta(v) : fmt(v); }
        draw();
      });
    }
    return h('div.prm.org-prm', null, h('span.prm__lbl', null, label), val, keyBtn || h('span'), input);
  }

  function section(id, title, on, toggle, body, meta) {
    return h('details.org-sec', { open: open[id], 'data-on': String(!!on), ontoggle: (e) => { open[id] = e.target.open; if (e.target.open) requestAnimationFrame(() => { drawBreath(); drawOverlay(); }); } },
      h('summary.org-sec__sum', null, h('span.org-sec__name', null, title), h('span.meta', null, meta), sw(on, title, meta, toggle)),
      h('div.org-sec__body', null, body));
  }

  // ---- Respiro
  function respiroBody(c) {
    const R = c.respiro;
    const B = breaths(R, c);
    const n = B.list.filter((x) => x.t0 >= -1e-6 && x.t0 < c.format.duration).length;
    breathCv = h('canvas.org-breath', { 'aria-label': 'Il respiro nella clip' });
    const ms = materie();
    return [
      h('p.about', null, 'Un solo respiro lento e irregolare muove insieme tutte le materie: inspira, trattiene, espira più a lungo. L’onda passa da una materia all’altra.'),
      breathCv,
      h('span.meta', null, `${n} ${n === 1 ? 'respiro' : 'respiri'} in ${c.format.duration} s${c.format.loop ? ', chiusi nel loop' : ''}`),
      RESPIRO_CONTROLLI.map((d) => slider({ label: d.label, min: d.min, max: d.max, step: d.step, value: R[d.id], meta: d.meta,
        onInput: (v) => { R[d.id] = v; changed(); drawBreath(); },
        keys: d.keys ? { track: () => R.chiavi[d.id], set: (tr) => { if (tr) R.chiavi[d.id] = tr; else delete R.chiavi[d.id]; } } : null })),
      ms.length ? h('div.org-per', null, h('span.label', null, 'Per materia'),
        ms.map((p) => {
          const proc = byId[p.proc], k = passKey(c, p);
          const M = () => (R.materie[k] ||= {});
          const cur = R.materie[k] || {};
          const chips = proc.params.filter(breathable).map((d) => {
            const mode = paramMode(proc, d, cur);
            return h('button.tag.org-chip', { type: 'button', 'data-mode': mode, title: 'Tocca: segue il respiro → al contrario → escluso',
              onclick: (e) => {
                const order = ['segue', 'inverso', 'escluso'];
                const next = order[(order.indexOf(e.currentTarget.dataset.mode) + 1) % 3];
                (M().parametri ||= {})[d.id] = next;
                e.currentTarget.dataset.mode = next;
                e.currentTarget.lastChild.textContent = next === 'segue' ? '' : next === 'inverso' ? ' ↓' : '';
                changed();
              } }, d.label, h('span.org-chip__s', null, mode === 'inverso' ? ' ↓' : ''));
          });
          return h('div.org-mat', null,
            h('span.org-mat__name', null, proc.name),
            slider({ label: 'Profondità', min: 0, max: 2, value: cur.profondita ?? 1, meta: pct, onInput: (v) => { M().profondita = v; changed(); } }),
            slider({ label: 'Ritardo', min: 0, max: 1, value: cur.ritardo ?? 0, meta: (v) => (v < 0.01 ? 'con l’onda' : `+${Math.round(v * 100)}% di respiro`), onInput: (v) => { M().ritardo = v; changed(); drawBreath(); } }),
            h('div.org-chips', { role: 'group', 'aria-label': 'Parametri che respirano' }, chips),
            h('span.meta', null, 'parametri: chiari respirano, ↓ al contrario, spenti esclusi'));
        })) : h('p.meta', null, 'Aggiungi una materia: il respiro muove le materie.'),
    ];
  }

  function drawBreath() {
    const c = clip();
    if (!breathCv || !breathCv.isConnected || !c?.respiro) return;
    const W = Math.round(breathCv.clientWidth * dpr()), H = Math.round(breathCv.clientHeight * dpr());
    if (!W) return;
    if (breathCv.width !== W || breathCv.height !== H) { breathCv.width = W; breathCv.height = H; }
    const g = breathCv.getContext('2d');
    g.setTransform(dpr(), 0, 0, dpr(), 0, 0);
    const w = W / dpr(), hh = H / dpr();
    g.clearRect(0, 0, w, hh);
    const R = { ...c.respiro, on: true };
    const T = c.format.duration;
    const P = 60 / clamp(R.frequenza || 6, 0.5, 60);
    const ms = materie();
    const lines = ms.length ? ms.slice(0, 4) : [null];
    lines.forEach((p, j) => {
      const k = p ? passKey(c, p) : null;
      const d = ((R.onda || 0) * j + (k ? R.materie[k]?.ritardo || 0 : 0)) * P;
      g.strokeStyle = `rgba(248, 248, 248, ${[0.95, 0.55, 0.35, 0.22][j]})`; g.lineWidth = 1;
      g.beginPath();
      for (let x = 0; x <= w; x++) {
        const v = breathAt(R, c, (x / w) * T - d);
        const y = hh - 4 - ((v + 0.8) / 2.7) * (hh - 8);
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    });
    const fr = player.frame % player.total;
    const px = Math.round((fr / Math.max(1, player.total - 1)) * w) + 0.5;
    g.strokeStyle = 'rgba(248, 248, 248, 0.45)'; g.beginPath(); g.moveTo(px, 0); g.lineTo(px, hh); g.stroke();
  }

  // ---- Tempo geologico
  const quality = h('p.meta.org-quality');
  function tempoBody(c) {
    const T = c.tempo;
    const d = describe(c);
    const ms = materie();
    return [
      h('p.about', null, 'Ore di trasformazione in pochi secondi. Disegna la curva sotto la timeline: in alto il tempo della materia corre, in basso quasi si ferma.'),
      h('div.ctl', null, h('span.ctl__lbl', null, 'Forma della curva', h('span.meta', null, 'poi ridisegnala col dito')),
        seg(TEMPO_FORME.map((f) => ({ id: f.id, label: f.label })), null, (id) => { T.punti = TEMPO_FORME.find((f) => f.id === id).punti(T.massimo || 16).map(([u, s]) => [u, round(s)]); changed({ restart: true }); drawStrip(); redrawPanel(); }, { label: 'Forma della curva' })),
      h('div.ctl', null, h('span.ctl__lbl', null, 'Moltiplicatore massimo', h('span.meta', null, 'il punto più alto della curva')),
        seg(TEMPO_MASSIMI.map((m) => ({ id: m, label: '×' + m })), T.massimo, (m) => { T.massimo = m; T.punti = T.punti.map(([u, s]) => [u, Math.min(s, m)]); changed({ restart: true }); drawStrip(); redrawPanel(); }, { label: 'Moltiplicatore massimo' })),
      h('p.org-readout', null, `In ${c.format.duration} s di clip passano ${durata(d.secondi)} di materia, ${d.rapporto >= 1 ? '×' + fmt(d.rapporto) : '×' + d.rapporto.toFixed(2).replace('.', ',')} in media.`),
      quality,
      h('button.org-sw.org-exact', { type: 'button', role: 'switch', 'aria-checked': String(!!player.exact), onclick: () => { player.setExact(!player.exact); redrawPanel(); } },
        h('span.switch__knob'), h('span.stack', null, h('span', null, 'Anteprima esatta'), h('span.meta', null, 'tutti i passi, anche se scorre più lenta'))),
      ms.length ? h('div.org-per', null, h('span.label', null, 'Per materia: invecchia'),
        ms.map((p) => {
          const k = passKey(c, p);
          const f = T.materie[k]?.fattore ?? 1;
          return h('div.org-mat', null, h('span.org-mat__name', null, byId[p.proc].name),
            slider({ label: 'Invecchia', min: -2, max: 2, step: 0.05, value: Math.log2(f), meta: (v) => { const x = 2 ** v; return Math.abs(x - 1) < 0.03 ? 'come le altre' : x > 1 ? `×${fmt(x)} più in fretta` : `×${fmt(1 / x)} più piano`; },
              onInput: (v) => { (T.materie[k] ||= {}).fattore = round(2 ** v); changed({ restart: true, soft: true }); } }));
        })) : h('p.meta', null, 'Aggiungi una materia: il tempo geologico agisce sulle materie.'),
    ];
  }
  // la qualità dell'anteprima: il caso peggiore dell'ultimo paio di secondi
  const scales = [];
  function drawQuality() {
    if (!quality.isConnected) return;
    const s = scales.length ? { scale: Math.min(...scales) } : null;
    if (!clip()?.tempo?.on) { quality.textContent = ''; return; }
    if (player.exact) quality.textContent = 'Anteprima esatta: ogni passo della materia, come nel video salvato.';
    else if (!s || s.scale >= 0.995) quality.textContent = 'Anteprima piena: la materia fa tutti i suoi passi, come nel video salvato.';
    else quality.textContent = `Anteprima alleggerita: la materia fa il ${Math.round(s.scale * 100)}% dei passi. Il video salvato li fa tutti.`;
    stripNote.textContent = s && s.scale < 0.995 && !player.exact ? `anteprima al ${Math.round(s.scale * 100)}%` : '';
  }

  // ---- Gravità e vento
  function forzeBody(c) {
    const F = c.forze;
    const key = (name) => ({ track: () => F.chiavi[name], set: (tr) => { if (tr) F.chiavi[name] = tr; else delete F.chiavi[name]; } });
    const deg = (v) => `${Math.round(v)}° ${dirName(v)}`;
    const ms = materie();
    return [
      h('p.about', null, 'Un campo di forze unico che tutte le materie sentono: la gravità, il vento con le sue raffiche, e le forze che disegni sul quadro.'),
      h('span.label', null, 'Gravità'),
      slider({ label: 'Forza', min: 0, max: 1.5, value: F.gravita.forza, meta: (v) => (v < 0.02 ? 'senza peso' : Math.abs(v - 0.5) < 0.03 ? 'normale' : v < 0.5 ? 'leggera' : 'pesante'), onInput: (v) => { F.gravita.forza = v; changed(); drawOverlay(); }, keys: key('gravita.forza') }),
      slider({ label: 'Direzione', min: 0, max: 360, step: 1, value: F.gravita.direzione, meta: deg, onInput: (v) => { F.gravita.direzione = v; changed(); drawOverlay(); }, keys: key('gravita.direzione') }),
      h('span.label', null, 'Vento'),
      slider({ label: 'Forza', min: 0, max: 1.5, value: F.vento.forza, meta: (v) => (v < 0.02 ? 'calma' : v < 0.35 ? 'brezza' : v < 0.8 ? 'vento' : 'burrasca'), onInput: (v) => { F.vento.forza = v; changed(); drawOverlay(); }, keys: key('vento.forza') }),
      slider({ label: 'Direzione', min: 0, max: 360, step: 1, value: F.vento.direzione, meta: deg, onInput: (v) => { F.vento.direzione = v; changed(); drawOverlay(); }, keys: key('vento.direzione') }),
      slider({ label: 'Raffiche', min: 0, max: 1, value: F.vento.raffiche, meta: pct, onInput: (v) => { F.vento.raffiche = v; changed(); }, keys: key('vento.raffiche') }),
      slider({ label: 'Grandezza delle raffiche', min: 0, max: 1, value: F.vento.misura, meta: (v) => (v < 0.33 ? 'larghe' : v < 0.66 ? 'medie' : 'fitte'), onInput: (v) => { F.vento.misura = v; changed(); } }),
      h('span.label', null, 'Forze sul quadro'),
      h('div.org-tools', { role: 'group', 'aria-label': 'Disegna una forza' }, FORZE_TIPI.map((t) =>
        h('button.seg__opt', { type: 'button', 'aria-pressed': String(tool === t.id), title: t.hint, onclick: () => { setTool(tool === t.id ? null : t.id); } }, t.label))),
      h('p.meta', null, tool ? `${FORZE_TIPI.find((x) => x.id === tool).hint} sul quadro. Ritocca «${FORZE_TIPI.find((x) => x.id === tool).label}» per smettere.` : 'Scegli una forza, poi disegnala sul quadro con il dito o con il mouse.'),
      F.locali.length ? h('div.org-locals', null, F.locali.map((l, i) => h('div.org-local', { 'data-sel': String(selected === l.id) },
        h('button.org-local__name', { type: 'button', onclick: () => { selected = selected === l.id ? null : l.id; drawOverlay(); redrawPanel(); } }, `${i + 1} · ${FORZE_TIPI.find((t) => t.id === l.tipo)?.label}`),
        l.tipo === 'vortice' ? h('button.btn.btn--quiet', { type: 'button', onclick: () => { l.verso = -(l.verso || 1); changed(); drawOverlay(); redrawPanel(); } }, (l.verso || 1) > 0 ? '↺ antiorario' : '↻ orario') : null,
        h('button.btn.btn--quiet', { type: 'button', 'aria-label': 'Togli questa forza', onclick: () => { F.locali.splice(i, 1); delete F.chiavi['f:' + l.id]; changed(); drawOverlay(); redrawPanel(); } }, 'Togli'),
        slider({ label: 'Forza', min: 0, max: 2, value: l.forza, meta: pct, onInput: (v) => { l.forza = v; changed(); drawOverlay(); }, keys: key('f:' + l.id) }),
        slider({ label: l.tipo === 'corrente' ? 'Larghezza' : 'Raggio', min: 0.03, max: 0.9, value: l.r, meta: pct, onInput: (v) => { l.r = v; changed(); drawOverlay(); } })))) : null,
      h('button.org-sw', { type: 'button', role: 'switch', 'aria-checked': String(!!F.mostra), onclick: () => { F.mostra = !F.mostra; changed(); drawOverlay(); redrawPanel(); } },
        h('span.switch__knob'), h('span.stack', null, h('span', null, 'Mostra il campo sul quadro'), h('span.meta', null, 'linee sottili, non finiscono nel video'))),
      ms.length ? h('div.org-per', null, h('span.label', null, 'Per materia: quanto sente le forze'),
        ms.map((p) => {
          const proc = byId[p.proc], k = passKey(c, p);
          const v0 = F.materie[k]?.presa ?? 1;
          return h('div.org-mat', null, h('span.org-mat__name', null, proc.name), h('span.meta', null, howReads(proc)),
            slider({ label: 'Sente le forze', min: 0, max: 2, value: v0, meta: pct, onInput: (v) => { (F.materie[k] ||= {}).presa = v; changed(); } }));
        })) : null,
    ];
  }

  function setTool(t) {
    tool = t;
    screen.dataset.drawing = String(!!t);
    if (t && player.playing) player.pause();
    drawOverlay(); redrawPanel();
  }

  function redrawPanel() {
    if (destroyed) return;
    const c = clip();
    if (!c) return;
    ensureOrganismo(c);
    live.length = 0;
    const toggle = (id, extra) => (on) => { c[id].on = on; if (on) open[id] = true; if (id === 'forze' && !on) setTool(null); changed({ restart: id !== 'respiro' }); drawOverlay(); drawStrip(); redrawPanel(); extra && extra(on); };
    fill(host,
      h('div.org__head', null, h('span.label', null, 'Tutta la catena'), h('span.meta', null, 'agiscono su tutte le materie insieme')),
      section('respiro', 'Respiro', c.respiro.on, toggle('respiro'), c.respiro.on ? respiroBody(c) : h('p.about', null, 'Un solo ritmo lento e irregolare per tutte le materie: la clip diventa un organismo che respira.'), c.respiro.on ? `${fmt(c.respiro.frequenza)} al minuto` : ''),
      section('tempo', 'Tempo geologico', c.tempo.on, toggle('tempo'), c.tempo.on ? tempoBody(c) : h('p.about', null, 'Ore di trasformazione compresse in pochi secondi, con una curva di velocità che disegni sulla timeline.'), c.tempo.on ? `fino a ×${c.tempo.massimo}` : ''),
      section('forze', 'Gravità e vento', c.forze.on, toggle('forze'), c.forze.on ? forzeBody(c) : h('p.about', null, 'Gravità, vento con raffiche, correnti e vortici disegnati sul quadro: tutte le materie li sentono.'), c.forze.on ? `${c.forze.locali.length ? c.forze.locali.length + ' forze sul quadro' : 'gravità e vento'}` : ''));
    requestAnimationFrame(() => { drawBreath(); drawQuality(); });
  }

  // aggiornamenti mentre la clip scorre: playhead, chiavi, qualità dell'anteprima
  let raf = 0, lastF = -1, lastQ = 0;
  const tick = (now) => {
    if (destroyed) return;
    raf = requestAnimationFrame(tick);
    if (player.frame !== lastF) {
      lastF = player.frame;
      const st = player.r.stats;
      if (st && st.want > 0) { scales.push(st.scale); if (scales.length > 48) scales.shift(); }
      const c = clip();
      if (c?.forze?.on && (Object.keys(c.forze.chiavi || {}).length || drag)) drawOverlay();
      if (c?.tempo?.on && !samples) drawStrip();
      if (c?.respiro?.on && open.respiro) drawBreath();
      if (now - lastQ > 250) { lastQ = now; live.forEach((f) => f()); drawQuality(); }
    }
  };
  raf = requestAnimationFrame(tick);
  const ro = new ResizeObserver(() => { drawOverlay(); drawStrip(); drawBreath(); });
  ro.observe(screen); ro.observe(strip);

  return {
    panel() { redrawPanel(); requestAnimationFrame(() => { drawOverlay(); drawStrip(); }); return host; },
    redraw() { redrawPanel(); drawOverlay(); drawStrip(); },
    destroy() { destroyed = true; cancelAnimationFrame(raf); ro.disconnect(); ov.remove(); stripWrap.remove(); delete screen.dataset.drawing; },
  };
}

// ----------------------------------------------------------- piccoli aiuti
function round(v, d = 4) { const k = 10 ** d; return Math.round(v * k) / k; }
function fmt(v) { const a = Math.abs(v); return (a >= 100 ? Math.round(v) : a >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100).toString().replace('.', ','); }
function dirName(d) {
  const n = ['destra', 'su a destra', 'su', 'su a sinistra', 'sinistra', 'giù a sinistra', 'giù', 'giù a destra'];
  return n[Math.round((((d % 360) + 360) % 360) / 45) % 8];
}
function durata(s) {
  if (s < 90) return `${Math.round(s)} s`;
  if (s < 5400) return `${Math.round(s / 60)} min`;
  return `${fmt(s / 3600)} ore`;
}
