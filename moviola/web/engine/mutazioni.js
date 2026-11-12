// Deriva: mutazioni sensate di una clip, il loro incrocio, e le misure per
// dire se due mutazioni sono davvero diverse. Tutto deterministico dal seme
// della deriva: stessa madre, stesse scelte, stesso seme, stesse figlie.
//
// Le materie e i loro parametri si leggono dal registro (processes.js) così
// come sono: una materia nuova entra da sola nelle mutazioni.

import { byId, PROCESSES, defaultParams } from './processes.js';
import { MAX_MATERIE } from './recipes.js';
import { clone, dims } from './clip.js';
import { baseOf, layersOf, buildAny, styleName, suggestVisibili } from './ricette.js';
import { frameStats } from './analysis.js';
import { seekVideo, videoTime } from '../media.js';

// ------------------------------------------------------------- caso
/** Generatore pseudo-casuale con seme (mulberry32). */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  const f = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.gauss = () => { const u = Math.max(1e-9, f()), v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.id = (p = 'd') => p + Math.floor(f() * 2176782336).toString(36);
  return f;
}
export function seedOf(...xs) {
  let h = 2166136261;
  for (const x of xs) { const s = String(x); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= 0x9e37; }
  return h >>> 0;
}

// ------------------------------------------------------------ registro
/** Le materie del registro, come sono adesso (anche quelle arrivate dopo). */
export const materieDelRegistro = () => PROCESSES.filter((p) => p.materia && !p.ritirata);

const COLOR_RE = /^(tinta|cromia|satura|bicromia|ombre|luci|temperatura|colore|hue|pigment|tono|calore|ambra|ruggine|ossido)/;
/** Un parametro di colore: tinte, saturazione, bicromia; nel Tono anche luce e contrasto. */
export function isColorParam(procId, d) {
  if (COLOR_RE.test(d.id)) return true;
  return byId[procId]?.family === 'colore' && procId !== 'sorgente' && !['inverti', 'soglia'].includes(d.id);
}
/** Parametri che la deriva non tocca mai: dicono quale foto usare, non come appare. */
const FIXED = new Set(['indice', 'inverti', 'soglia']);
/** Pellicola, graffi e luce: la deriva li può solo togliere, mai aumentare (il gusto di ninni). */
const onlyDown = (procId) => ['materia', 'graffio'].includes(procId) || ['pellicola', 'luce'].includes(byId[procId]?.family);

/** Quanto pesa un parametro sull'immagine: dichiarato (peso) o dedotto dalla sua vivacità (mod). */
const weight = (d) => (d.peso != null ? d.peso : 0.6 + 0.8 * Math.min(1, Math.max(0, d.mod ?? 0.5)));

/** Un parametro mosso in proporzione alla sua scala: lineare, o in rapporto se va da 0,3 a 10. */
export function mutValue(d, v0, A, r) {
  if (d.options) return r() < A * 0.6 ? (Math.round(v0) + 1 + Math.floor(r() * (d.options.length - 1))) % d.options.length : v0;
  const span = d.max - d.min;
  if (!(span > 0)) return v0;
  const w = weight(d);
  let v;
  if (d.min > 0 && d.max / d.min >= 8) v = Math.exp(Math.log(Math.max(d.min, v0)) + r.gauss() * A * w * Math.log(d.max / d.min) * 0.8);
  else v = v0 + r.gauss() * A * w * span;
  // rimbalza sui bordi invece di incollarsi agli estremi
  if (v > d.max) v = d.max - Math.min(span, v - d.max) * 0.5;
  if (v < d.min) v = d.min + Math.min(span, d.min - v) * 0.5;
  if (d.step) {
    v = Math.round(v / d.step) * d.step;
    if (v === v0 && r() < A) v = Math.min(d.max, Math.max(d.min, v0 + (r() < 0.5 ? -d.step : d.step)));
  }
  return Math.min(d.max, Math.max(d.min, v));
}

// ------------------------------------------------------------ genoma
/** Una clip vista come genoma: base (stile o ricetta), strati di materia, movimento, seme. */
export function toGenome(clip) {
  return {
    base: baseOf(clip.chain), layers: layersOf(clip), motion: clone(clip.motion), seed: clip.seed,
    intensity: clip.intensity ?? 0.8, keys: clone(clip.keys || {}),
  };
}

/** Chiave di blocco di un'unità della catena: i passaggi della base per id, gli strati per materia. */
export const unitKey = (u) => (u.layer ? 'm:' + u.proc : 'p:' + u.id);

/** Le unità che la deriva vede: passaggi della base e strati di materia. */
export function unitsOf(g) {
  const out = g.base.map((p, i) => ({ kind: 'base', i, id: p.id, proc: p.proc, ref: p, head: i === 0 && p.proc === 'metamorfosi' }));
  g.layers.forEach((m, i) => out.push({ kind: 'layer', i, id: 'layer' + i, proc: m.proc, ref: m, layer: true }));
  return out;
}

const nameOf = (proc) => byId[proc]?.name || proc;
const short = (s) => s.toLowerCase();

/**
 * Una mutazione della madre.
 * opts: { amp 0..1, what: { parametri, catena, movimento, colore }, locks: Set di chiavi
 *        ('p:<id>', 'm:<materia>', con '.<parametro>' per un parametro solo), hasSources }
 */
export function mutate(mother, opts, r) {
  const g = toGenome(mother);
  const amp = Math.min(1, Math.max(0, opts.amp ?? 0.35));
  const what = opts.what || { parametri: true, catena: true, movimento: true, colore: true };
  const locks = opts.locks || new Set();
  const A = 0.04 + 0.42 * Math.pow(amp, 1.15);       // ampiezza di un passo, in frazione della scala
  const pParam = 0.22 + 0.5 * amp;                     // quanti parametri si muovono
  const said = [];
  const big = [];                                      // [peso, frase] dei cambi di parametro più grandi
  const locked = (u, param) => locks.has(unitKey(u)) || (param && locks.has(unitKey(u) + '.' + param));

  // ---------------------------------------------------------- catena
  if (what.catena) {
    const nOps = r() < 0.12 + 0.7 * amp ? (r() < amp * 0.55 ? 2 : 1) : 0;
    for (let k = 0; k < nOps; k++) chainOp(g, r, amp, locks, said, opts);
  }

  // ------------------------------------------------------- parametri
  if (what.parametri || what.colore) {
    for (const u of unitsOf(g)) {
      if (u.head || locked(u)) continue;
      const proc = byId[u.proc];
      if (!proc) continue;
      const p = u.ref;
      for (const d of proc.params) {
        if (FIXED.has(d.id) || locked(u, d.id)) continue;
        const col = isColorParam(u.proc, d);
        if (col ? !what.colore : !what.parametri) continue;
        if (!u.layer && g.keys[`${p.id}.${d.id}`]) continue; // le chiavi della timeline restano come sono
        if (r() > pParam) continue;
        const v0 = p.params[d.id] ?? d.def;
        let v = mutValue(d, v0, A, r);
        if (onlyDown(u.proc) && v > v0) v = Math.max(d.min, v0 - (v - v0));
        p.params[d.id] = v;
        const rel = Math.abs(v - v0) / ((d.max - d.min) || 1);
        if (rel > 0.06) big.push([rel * weight(d), `${short(d.label)} ${v > v0 ? '↑' : '↓'}`, proc.name]);
      }
      // la quantità di una materia
      if (what.parametri && proc.materia && !locked(u, 'mix') && r() < pParam * 0.5) {
        const m0 = u.layer ? (p.mix ?? 1) : (p.baseMix ?? p.mix ?? 1);
        const m1 = Math.min(1, Math.max(0.3, m0 + r.gauss() * A * 0.9));
        if (u.layer) p.mix = m1; else { p.mix = m1; p.baseMix = m1; }
        if (Math.abs(m1 - m0) > 0.08) big.push([Math.abs(m1 - m0), `quantità ${m1 > m0 ? '↑' : '↓'}`, proc.name]);
      }
    }
  }

  // ------------------------------------------------------ movimento
  if (what.movimento) {
    const m = g.motion;
    if (r() < 0.06 + 0.34 * amp) {
      const modes = ['contemplativo', 'ritmico', 'caotico', 'fermo'].filter((x) => x !== m.mode);
      // il fermo si propone di rado: toglie vita invece di darne
      m.mode = r() < 0.15 ? 'fermo' : r.pick(modes.filter((x) => x !== 'fermo'));
      said.push(`movimento ${({ contemplativo: 'lento', ritmico: 'a tempo', caotico: 'caotico', fermo: 'fermo' })[m.mode]}`);
    }
    if (r() < 0.55) {
      const a0 = m.amount ?? 0.5;
      m.amount = Math.min(1, Math.max(0.05, a0 + r.gauss() * A * 0.9));
      if (Math.abs(m.amount - a0) > 0.12) big.push([Math.abs(m.amount - a0), `movimento ${m.amount > a0 ? 'più ampio' : 'più calmo'}`, '']);
    }
    if (r() < 0.45) {
      const s0 = m.speed ?? 1;
      m.speed = Math.min(3, Math.max(0.15, s0 * Math.exp(r.gauss() * A * 1.3)));
      if (Math.abs(Math.log(m.speed / s0)) > 0.18) big.push([Math.abs(Math.log(m.speed / s0)) * 0.6, m.speed > s0 ? 'più veloce' : 'più lento', '']);
    }
    if (m.mode === 'ritmico' && r() < 0.4) m.bpm = Math.round(Math.min(200, Math.max(40, (m.bpm || 96) * Math.exp(r.gauss() * A))));
  }

  // ------------------------------------------------------------ seme
  if (r() < 0.08 + 0.55 * amp) { g.seed = 1 + Math.floor(r() * 99999); if (!said.length && !big.length) said.push('seme nuovo'); }

  big.sort((a, b) => b[0] - a[0]);
  const lines = big.slice(0, 3 - Math.min(2, said.length)).map(([, t, who]) => (who ? `${who}: ${t}` : t));
  return { genome: g, said: [...said, ...lines] };
}

/** Un'operazione sulla catena: aggiunge, scambia, toglie o riordina una materia. */
function chainOp(g, r, amp, locks, said, opts) {
  const units = unitsOf(g);
  const mats = units.filter((u) => byId[u.proc]?.materia);
  const present = new Set(mats.map((u) => u.proc));
  const pool = materieDelRegistro().filter((m) => !present.has(m.id));
  const free = (u) => !locks.has(unitKey(u)) && !u.head;
  const removable = units.filter((u) => free(u) && !(u.kind === 'base' && byId[u.proc]?.gen && !opts.hasSources && g.base.filter((p) => byId[p.proc]?.gen).length < 2));
  const swappable = mats.filter(free);
  const options = [];
  if (pool.length && mats.length < MAX_MATERIE) options.push(['add', mats.length ? 0.38 : 0.9]);
  if (swappable.length && pool.length) options.push(['swap', 0.34]);
  if (removable.length && units.filter((u) => !u.head).length > 1) options.push(['remove', 0.16 + 0.1 * amp]);
  if (g.layers.length >= 2) options.push(['order', 0.1]);
  if (!options.length) return;
  let x = r() * options.reduce((a, o) => a + o[1], 0), op = options[0][0];
  for (const [o, w] of options) { if ((x -= w) <= 0) { op = o; break; } }

  const fresh = (proc) => {
    const p = defaultParams(proc);
    // una materia nuova entra già un po' spostata dai suoi valori di partenza
    for (const d of byId[proc].params) if (!d.options && !FIXED.has(d.id) && r() < 0.5) p[d.id] = mutValue(d, p[d.id], 0.12, r);
    return p;
  };
  // con qualche preferenza per la stessa famiglia, quando si scambia
  const choose = (family) => {
    const same = family ? pool.filter((m) => m.family === family) : [];
    return (same.length && r() < 0.45 ? r.pick(same) : r.pick(pool)).id;
  };

  if (op === 'add') {
    const proc = choose(null);
    g.layers.push({ proc, mix: Math.min(1, 0.55 + r() * 0.45), params: fresh(proc) });
    said.push('+ ' + nameOf(proc));
  } else if (op === 'swap') {
    const u = r.pick(swappable);
    const proc = choose(byId[u.proc].family);
    if (u.layer) g.layers[u.i] = { proc, mix: u.ref.mix ?? 1, params: fresh(proc) };
    else g.base[u.i] = { ...u.ref, id: r.id('d'), proc, params: fresh(proc), nome: nameOf(proc) };
    said.push(`${nameOf(u.proc)} → ${nameOf(proc)}`);
  } else if (op === 'remove') {
    // si toglie più volentieri ciò che non è materia (grana, luce): è il gusto di ninni
    const nonMat = removable.filter((u) => !byId[u.proc]?.materia);
    const u = nonMat.length && r() < 0.6 ? r.pick(nonMat) : r.pick(removable);
    if (u.layer) g.layers.splice(u.i, 1); else g.base.splice(u.i, 1);
    said.push('− ' + nameOf(u.proc));
  } else if (op === 'order') {
    const i = Math.floor(r() * (g.layers.length - 1));
    [g.layers[i], g.layers[i + 1]] = [g.layers[i + 1], g.layers[i]];
    said.push(`${nameOf(g.layers[i].proc)} sotto ${nameOf(g.layers[i + 1].proc)}`);
  }
}

/** Incrocio di due clip: dove hanno lo stesso processo i parametri si mescolano,
 *  il resto arriva dall'una o dall'altra. */
export function cross(a, b, r) {
  const ga = toGenome(a), gb = toGenome(b);
  const mixParams = (pa, pb, proc) => {
    const out = {};
    for (const d of byId[proc]?.params || []) {
      const va = pa[d.id] ?? d.def, vb = pb[d.id] ?? d.def;
      const t = r();
      out[d.id] = d.options || d.step ? (t < 0.5 ? va : vb) : (t < 0.3 ? va : t < 0.6 ? vb : va + (vb - va) * r());
    }
    return out;
  };
  // base: si seguono le due catene in ordine, abbinando i processi uguali
  const used = new Set();
  const base = [];
  for (const pa of ga.base) {
    const j = gb.base.findIndex((pb, k) => !used.has(k) && pb.proc === pa.proc);
    if (j >= 0) { used.add(j); base.push({ ...pa, params: mixParams(pa.params, gb.base[j].params, pa.proc), mix: r() < 0.5 ? pa.mix : gb.base[j].mix }); }
    else if (r() < 0.6 || (base.length === 0 && pa.proc === 'metamorfosi')) base.push(clone(pa));
  }
  gb.base.forEach((pb, k) => { if (!used.has(k) && r() < 0.5 && !(pb.proc === 'metamorfosi')) base.splice(Math.min(base.length, k), 0, { ...clone(pb), id: pb.id + 'x' }); });
  // strati: unione, con le materie in comune mescolate
  const layers = [];
  const lb = gb.layers.slice();
  for (const m of ga.layers) {
    const j = lb.findIndex((x) => x.proc === m.proc);
    if (j >= 0) { const o = lb.splice(j, 1)[0]; layers.push({ proc: m.proc, mix: (m.mix + o.mix) / 2, params: mixParams(m.params, o.params, m.proc) }); }
    else if (r() < 0.55) layers.push(clone(m));
  }
  for (const m of lb) if (r() < 0.55) layers.push(clone(m));
  if (!layers.length && !base.some((p) => byId[p.proc]?.materia)) {
    const any = [...ga.layers, ...gb.layers];
    if (any.length) layers.push(clone(r.pick(any)));
  }
  const motion = {};
  for (const k of new Set([...Object.keys(ga.motion), ...Object.keys(gb.motion)])) motion[k] = r() < 0.5 ? ga.motion[k] : gb.motion[k];
  const ids = new Set(base.map((p) => p.id));
  const keys = Object.fromEntries(Object.entries({ ...gb.keys, ...ga.keys }).filter(([k]) => ids.has(k.split('.')[0])));
  return {
    genome: { base, layers: layers.slice(0, MAX_MATERIE), motion, seed: r() < 0.5 ? ga.seed : gb.seed, intensity: (ga.intensity + gb.intensity) / 2, keys },
    said: ['incrocio'],
  };
}

/** Intensità dello stile sulle foto (la stessa regola di Trasforma). */
export function applyIntensity(clip) {
  const k = clip.intensity ?? 0.8;
  const head = clip.sources.length >= 2 ? 1 : 0;
  clip.chain.forEach((p, i) => {
    if (p.baseMix == null) p.baseMix = p.mix;
    p.mix = i < head ? p.baseMix : p.baseMix * (0.25 + 0.75 * k);
  });
  return clip;
}

/** Dal genoma alla clip: sempre «in ricetta», così la base mutata non si perde. */
export function toClip(g, mother, { recipeById } = {}) {
  const from = mother.ricetta;
  const name = from?.deriva ? from.name : `${styleName(mother, recipeById) || 'Clip'}, in deriva`;
  const ric = {
    id: null, name, deriva: true, from: from?.id || from?.from || null,
    chain: g.base, keys: g.keys, dur: mother.format.duration, nsrc: mother.sources.length,
    visibili: (from?.visibili?.length ? from.visibili : suggestVisibili(g.base)).filter((v) => g.base.some((p) => p.id === v.pass)),
  };
  const clip = buildAny({ style: 'ricetta', ricetta: ric, sources: mother.sources, format: mother.format, motion: g.motion, seed: g.seed, materie: g.layers });
  clip.sources = clone(mother.sources);
  clip.intensity = g.intensity;
  return applyIntensity(clip);
}

// ------------------------------------------------------------- misure
const GX = 4, GY = 3;
function grid(L, w, h) {
  const g = new Float32Array(GX * GY), n = new Float32Array(GX * GY);
  for (let y = 0; y < h; y++) {
    const gy = Math.min(GY - 1, Math.floor((y / h) * GY));
    for (let x = 0; x < w; x++) { const k = gy * GX + Math.min(GX - 1, Math.floor((x / w) * GX)); g[k] += L[y * w + x]; n[k]++; }
  }
  for (let i = 0; i < g.length; i++) g[i] /= n[i] || 1;
  return g;
}
/** Quanta struttura c'è a ogni scala (fine, media, larga): la grana della materia, senza la posizione. */
function scaleSig(L, w, h) {
  const out = [];
  let cur = L, cw = w, ch = h;
  for (let lev = 0; lev < 4; lev++) {
    let e = 0;
    for (let y = 1; y < ch; y++) for (let x = 1; x < cw; x++) { const i = y * cw + x; e += Math.abs(cur[i] - cur[i - 1]) + Math.abs(cur[i] - cur[i - cw]); }
    out.push(e / Math.max(1, (cw - 1) * (ch - 1)));
    const nw = cw >> 1, nh = ch >> 1;
    if (nw < 4 || nh < 4) break;
    const nx = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) { const i = 2 * y * cw + 2 * x; nx[y * nw + x] = (cur[i] + cur[i + 1] + cur[i + cw] + cur[i + cw + 1]) / 4; }
    cur = nx; cw = nw; ch = nh;
  }
  return out;
}
const mad = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };

const usesMemory = (clip) => clip.chain.some((p) => p.on && (byId[p.proc]?.feedback || byId[p.proc]?.history || byId[p.proc]?.sim));

/**
 * Misura una clip, piccola: rende pochi fotogrammi e ne legge le stesse
 * misure dell'interlocutore (luminosità, contrasto, colore, densità,
 * simmetria, movimento, sfarfallio, varietà nel tempo) più una mappa
 * grossolana della composizione, per confrontare le mutazioni tra loro.
 */
export async function probe(renderer, items, clip, { long = 112 } = {}) {
  const r = renderer;
  const { w, h } = dims(clip.format.aspect, long);
  r.setSize(w, h); r.prune([]); r.reset();
  const fps = clip.format.fps, total = Math.max(2, Math.round(clip.format.duration * fps));
  const memory = usesMemory(clip);
  const videos = items.filter((s) => s.kind === 'video');
  const shots = [];
  const read = () => frameStats(r.readRGBA8(), w, h);
  if (memory) {
    const N = Math.min(total, Math.round(fps * 1.6));
    const picks = new Set([Math.round(N * 0.25), Math.round(N * 0.5), Math.round(N * 0.75), N - 1]);
    let prev = null;
    for (let f = 0; f < N; f++) {
      if (videos.length && f % 4 === 0) for (const s of videos) await seekVideo(s.el, videoTime(s, f / fps));
      r.render(clip, f / fps, f, null, { display: false });
      if (picks.has(f + 1)) prev = read();
      if (picks.has(f)) shots.push({ a: prev || read(), b: read() });
    }
  } else {
    for (const x of [0.12, 0.37, 0.62, 0.87]) {
      const f = Math.min(total - 2, Math.round(x * total));
      for (const s of videos) await seekVideo(s.el, videoTime(s, f / fps));
      r.render(clip, f / fps, f, null, { display: false });
      const a = read();
      for (const s of videos) await seekVideo(s.el, videoTime(s, (f + 1) / fps));
      r.render(clip, (f + 1) / fps, f + 1, null, { display: false });
      shots.push({ a, b: read() });
    }
  }
  const errors = clip.chain.filter((p) => p.on && r.errors?.get(p.proc)).map((p) => byId[p.proc]?.name || p.proc);
  const st = shots.map((s) => s.b);
  const avg = (k) => st.reduce((a, s) => a + s[k], 0) / st.length;
  let variety = 0, vn = 0;
  for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) { variety += mad(st[i].L, st[j].L); vn++; }
  const hist = new Float32Array(8);
  for (const s of st) for (let i = 0; i < s.L.length; i += 3) hist[Math.min(7, Math.floor(s.L[i] * 8))]++;
  const ht = hist.reduce((a, b) => a + b, 0) || 1;
  const hues = new Float32Array(12);
  for (const s of st) s.hues.forEach((v, i) => { hues[i] += v; });
  const hs = hues.reduce((a, b) => a + b, 0) || 1;
  return {
    error: errors.length ? errors : null,
    grids: st.map((s) => grid(s.L, w, h)),
    scales: st.map((s) => scaleSig(s.L, w, h)).reduce((acc, v) => acc.map((x, i) => x + (v[i] || 0) / st.length), [0, 0, 0, 0]),
    hist: hist.map((v) => v / ht), hues: hues.map((v) => v / hs),
    m: {
      luminosita: avg('mean'), contrasto: avg('contrast'), saturazione: avg('sat'), densita_bordi: avg('edges'),
      simmetria: avg('symmetry'), bruciato_bianco: avg('clipHi'), chiuso_nero: avg('clipLo'),
      movimento: shots.reduce((a, s) => a + mad(s.a.L, s.b.L), 0) / shots.length,
      sfarfallio: shots.reduce((a, s) => a + Math.abs(s.a.mean - s.b.mean), 0) / shots.length,
      varieta_nel_tempo: variety / Math.max(1, vn),
    },
  };
}

/** Le parti della distanza tra due mutazioni misurate (per tararla e per dirla). */
export function distanceParts(a, b) {
  let comp = 0;
  const n = Math.min(a.grids.length, b.grids.length);
  for (let k = 0; k < n; k++) comp += mad(a.grids[k], b.grids[k]);
  comp /= Math.max(1, n);
  let hist = 0; for (let i = 0; i < 8; i++) hist += Math.abs(a.hist[i] - b.hist[i]);
  let hue = 0; for (let i = 0; i < 12; i++) hue += Math.abs(a.hues[i] - b.hues[i]);
  let scale = 0; for (let i = 0; i < a.scales.length; i++) scale += Math.abs(Math.log((a.scales[i] + 0.004) / (b.scales[i] + 0.004))) / a.scales.length;
  return {
    comp, hist, hue: hue * Math.min(1, (a.m.saturazione + b.m.saturazione) * 2.5),
    scale,
    mv: Math.abs(Math.log((a.m.movimento + 0.004) / (b.m.movimento + 0.004))),
    tex: Math.abs(a.m.densita_bordi - b.m.densita_bordi) / (0.04 + (a.m.densita_bordi + b.m.densita_bordi) / 2),
    sat: Math.abs(a.m.saturazione - b.m.saturazione),
    con: Math.abs(a.m.contrasto - b.m.contrasto),
    vt: Math.abs(Math.log((a.m.varieta_nel_tempo + 0.01) / (b.m.varieta_nel_tempo + 0.01))),
  };
}
export const WEIGHTS = { comp: 1.0, hist: 0.5, hue: 0.25, scale: 1.2, mv: 0.12, tex: 0.25, sat: 0.8, con: 1.0, vt: 0.08 };
/** Distanza tra due mutazioni: toni, colore, grana della materia, movimento;
 *  la posizione esatta delle forme pesa poco, perché cambia con il seme. */
export function distance(a, b) {
  const p = distanceParts(a, b);
  let d = 0;
  for (const k in WEIGHTS) d += WEIGHTS[k] * p[k];
  return d;
}

/** Perché una mutazione non si mostra (o null se va bene). */
export function rejectReason(f, mother) {
  const m = f.m, mm = mother?.m;
  if (f.error) return 'la materia non si compila';
  if (m.luminosita < 0.04 || m.chiuso_nero > 0.86) return 'nera';
  if (m.luminosita > 0.93 || m.bruciato_bianco > 0.55) return 'bruciata';
  const stillMother = mm && mm.movimento < 0.0015 && mm.varieta_nel_tempo < 0.012;
  if (!stillMother && m.movimento < 0.0012 && m.varieta_nel_tempo < 0.012) return 'immobile';
  if (m.sfarfallio > Math.max(0.07, (mm?.sfarfallio || 0) * 1.8)) return 'sfarfalla';
  return null;
}

/** Soglie di diversità secondo l'ampiezza (da ritocco a salto), misurate sul
 *  «rumore» della madre: quanto cambia da sola con un seme diverso. */
export function thresholds(amp, noise = 0.3) {
  const n = Math.max(0.12, Math.min(1.2, noise));
  return { fromMother: Math.max(0.03, n * (0.15 + 0.6 * amp)), between: Math.max(0.04, n * (0.25 + 0.6 * amp)) };
}
