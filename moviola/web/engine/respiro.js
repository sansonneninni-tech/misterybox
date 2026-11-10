// RESPIRO — un solo ritmo lento e irregolare che governa insieme tutte le
// materie della catena, così la clip è un organismo e non tanti effetti.
//
// Non è una sinusoide: ogni respiro ha inspirazione, una pausa a pieno,
// un'espirazione più lunga che cede come un corpo che si rilascia, e una
// pausa a vuoto. Da un respiro all'altro cambiano durata e ampiezza; ogni
// tanto un sospiro (doppia inspirazione, più profonda), ogni tanto un'apnea.
// Tutto dal seme della clip: stessi valori, stessi fotogrammi.
//
// Ogni materia riceve il respiro sui suoi parametri «vitali» (quelli che ne
// cambiano il corpo: spessore, colata, densità, tensione…) con una sua
// profondità e un suo ritardo, così l'onda attraversa la catena.
//
// Una materia nuova lo eredita senza fare nulla: sono vitali tutti i suoi
// parametri continui tranne quelli di regia (velocità, direzione, luce,
// tinta, scala…). Per scegliere a mano: `vitali: ['spessore', 'colata']`
// nella sua dichiarazione. Nel GLSL c'è anche RESPIRO, il valore del respiro
// per quel passaggio (circa -1…1, 0 quando è spento).

import { passKey, passOrder, trackValue, hash, clamp } from './catena.js';

export const RESPIRO_BASE = {
  on: false,
  frequenza: 6,        // respiri al minuto
  irregolarita: 0.35,
  forma: 0.5,          // 0 quieto, 1 profondo
  sospiri: 0.25,
  apnea: 0.1,
  profondita: 0.6,
  onda: 0.15,          // ritardo tra una materia e la successiva, in frazioni di respiro
  materie: {},         // chiave → { profondita, ritardo, parametri: { id: 'segue'|'inverso'|'escluso' } }
  chiavi: {},          // { profondita: [[t, v], …] }
};

export const RESPIRO_CONTROLLI = [
  { id: 'frequenza', label: 'Frequenza', min: 1, max: 30, step: 0.5, meta: (v) => `${fmt(v)} respiri al minuto` },
  { id: 'irregolarita', label: 'Irregolarità', min: 0, max: 1, meta: (v) => (v < 0.15 ? 'quasi regolare' : v < 0.55 ? 'naturale' : 'agitato') },
  { id: 'forma', label: 'Forma del ciclo', min: 0, max: 1, meta: (v) => (v < 0.35 ? 'quieto: entra e esce piano' : v < 0.7 ? 'pieno: una pausa in alto' : 'profondo: entra presto, esce lungo') },
  { id: 'sospiri', label: 'Sospiri', min: 0, max: 1, meta: (v) => (v < 0.05 ? 'mai' : v < 0.5 ? 'ogni tanto' : 'spesso') },
  { id: 'apnea', label: 'Apnea', min: 0, max: 1, meta: (v) => (v < 0.05 ? 'mai' : v < 0.5 ? 'rara' : 'frequente') },
  { id: 'profondita', label: 'Profondità', min: 0, max: 1.5, keys: true, meta: (v) => `${Math.round(v * 100)}%` },
  { id: 'onda', label: 'Onda lungo la catena', min: 0, max: 0.5, meta: (v) => (v < 0.02 ? 'tutte insieme' : `+${Math.round(v * 100)}% a materia`) },
];

const fmt = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');

// Parametri di regia: per una materia nuova non respirano, a meno che lei
// non lo dichiari. Quelli di quantità (quanto copre la foto) partono esclusi:
// far apparire e sparire la foto a ogni respiro sembra una dissolvenza.
const REGIA = /^(velocita|direzione|luce|tinta|colore|cromia|scala|misura|dimensione|granello|semi|inneschi|scaglie|spore|ottave|angolo|orizzonte|sole|quadro|origine|fonte|raggi|indice|px|py|rotazione|soglia|regime|varieta|terra|ferro|frequenza|cadenza|temperatura|viscosita|lobi|finezza|fibre|grana|trama|pori|placche|costole|righe|griglia|curva|cicli|strati|ritardo|sorgente|campiona|dettaglio|guida|fondo|fondale|ombra|lucentezza|riflesso|aberrazione|sfarfallio|lampi|polvere|vignetta|ambra|rifr|ritmo|tremolio|alone)$/;
const QUANTITA = /^(materia|metallo|pellicola|cera|fumo|copertura|acqua|fotografia|carne|memoria|ritorno|rilascio)$/;

/** Il parametro può respirare? (le scelte e i valori interi no) */
export const breathable = (d) => !d.options && !(d.step >= 1);

/** Come respira un parametro se nessuno ha scelto: 'segue' o 'escluso'. */
export function defaultMode(proc, d) {
  if (!breathable(d)) return null;
  if (Array.isArray(proc.vitali)) return proc.vitali.includes(d.id) ? 'segue' : 'escluso';
  if (REGIA.test(d.id) || QUANTITA.test(d.id)) return 'escluso';
  return 'segue';
}

export function paramMode(proc, d, M) {
  if (!breathable(d)) return null;
  return M?.parametri?.[d.id] || defaultMode(proc, d);
}

export const respiroOf = (clip) => (clip.respiro && clip.respiro.on ? clip.respiro : null);

// ------------------------------------------------------------- i respiri
const lerp = (a, b, x) => a + (b - a) * x;
const ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(u, 0, 1));
const cache = new Map();

/** I respiri della clip, uno dopo l'altro: [{ t0, dur, hold, amp, kind, holdAt, skew }]. */
export function breaths(R, clip) {
  const T = clip.format.duration, loop = !!clip.format.loop, seed = clip.seed || 1;
  const key = [R.frequenza, R.irregolarita, R.forma, R.sospiri, R.apnea, T, loop, seed].join('|');
  const hit = cache.get(key);
  if (hit) return hit;
  const P = 60 / clamp(R.frequenza || 6, 0.5, 60);
  const irr = clamp(R.irregolarita ?? 0.35, 0, 1);
  const gen = (i) => {
    const s = seed * 0.731;
    let dur = P * (1 + irr * 0.6 * (hash(i, s + 1.3) * 2 - 1));
    const amp = 1 + irr * 0.28 * (hash(i, s + 2.7) * 2 - 1);
    let kind = 'normale', hold = 0, holdAt = 'pieno';
    if (hash(i, s + 4.1) < (R.sospiri ?? 0) * 0.3) { kind = 'sospiro'; dur *= 1.55; }
    else if (hash(i, s + 5.9) < (R.apnea ?? 0) * 0.35) {
      kind = 'apnea';
      const h = hash(i, s + 7.3);
      hold = P * (0.5 + h * 0.9);
      holdAt = h < 0.6 ? 'pieno' : 'vuoto';
    }
    const skew = irr * 0.1 * (hash(i, s + 9.1) * 2 - 1);
    return { dur, hold, amp, kind, holdAt, skew };
  };
  const list = [];
  if (loop) {
    // un numero intero di respiri riempie la clip: l'ultimo fotogramma torna al primo
    const N = Math.max(1, Math.round(T / P));
    for (let i = 0; i < N; i++) list.push(gen(i));
    const sum = list.reduce((a, c) => a + c.dur + c.hold, 0);
    const k = T / sum;
    let t0 = 0;
    for (const c of list) { c.dur *= k; c.hold *= k; c.t0 = t0; t0 += c.dur + c.hold; }
  } else {
    // senza loop: respiri anche prima dell'inizio, per i ritardi lungo la catena
    let t0 = 0;
    for (let i = 0; t0 < T + P * 2; i++) { const c = gen(i); c.t0 = t0; t0 += c.dur + c.hold; list.push(c); }
    const before = [];
    t0 = 0;
    for (let i = -1; t0 > -(T + P * 6); i--) { const c = gen(i); t0 -= c.dur + c.hold; c.t0 = t0; before.unshift(c); }
    list.unshift(...before);
  }
  const out = { list, P, T, loop };
  if (cache.size > 64) cache.clear();
  cache.set(key, out);
  return out;
}

/** Livello del respiro dentro un ciclo: 0 a vuoto, ~1 a pieno (un sospiro arriva a 1,45). */
function level(c, x, forma) {
  const inh = clamp(lerp(0.40, 0.27, forma) + c.skew, 0.18, 0.5);
  const top = lerp(0.04, 0.14, forma);
  const bot = lerp(0.07, 0.12, forma);
  const exh = 1 - inh - top - bot;
  const A = c.amp * (c.kind === 'sospiro' ? 1.45 : 1);
  const hTop = c.holdAt === 'pieno' ? c.hold : 0;
  const s1 = inh * c.dur, s2 = s1 + top * c.dur + hTop, s3 = s2 + exh * c.dur;
  if (x < s1) {
    const u = x / s1;
    if (c.kind === 'sospiro') return A * (u < 0.6 ? 0.68 * ease(u / 0.6) : 0.68 + 0.32 * ease((u - 0.6) / 0.4));
    return A * ease(Math.pow(u, 0.85));
  }
  if (x < s2) {
    // pausa a pieno: il corpo trattiene, e cede appena
    const u = (x - s1) / Math.max(1e-6, s2 - s1);
    return A * (1 - 0.04 * ease(u));
  }
  if (x < s3) {
    // espirazione: il corpo si rilascia, prima in fretta poi sempre più piano
    let u = (x - s2) / Math.max(1e-6, s3 - s2);
    u = (u < 0.2 ? (u * u) / 0.4 : u - 0.1) / 0.9;
    const k = lerp(2.2, 3.6, forma) * (c.kind === 'sospiro' ? 1.2 : 1);
    return A * 0.96 * (Math.exp(-k * u) - Math.exp(-k)) / (1 - Math.exp(-k));
  }
  return 0; // pausa a vuoto (più lunga nelle apnee a vuoto)
}

/** Respiro al tempo t, centrato: circa -0,7 a vuoto, 1 a pieno, 1,7 in un sospiro. */
export function breathAt(R, clip, t) {
  const B = breaths(R, clip);
  if (B.loop) t = ((t % B.T) + B.T) % B.T;
  const L = B.list;
  let lo = 0, hi = L.length - 1;
  if (t < L[0].t0) return -0.7;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (L[mid].t0 <= t) lo = mid; else hi = mid - 1; }
  const c = L[lo];
  return (level(c, t - c.t0, clamp(R.forma ?? 0.5, 0, 1)) - 0.42) / 0.58;
}

/** Il respiro di un passaggio: { m, depth, M } oppure null se spento. */
export function breathFor(clip, pass, t) {
  const R = respiroOf(clip);
  if (!R) return null;
  const M = R.materie?.[passKey(clip, pass)] || {};
  const depth = trackValue(R.chiavi?.profondita, t, R.profondita ?? 0.6) * (M.profondita ?? 1);
  if (depth <= 0) return null;
  const P = 60 / clamp(R.frequenza || 6, 0.5, 60);
  const delay = ((R.onda ?? 0) * passOrder(clip, pass) + (M.ritardo || 0)) * P;
  return { m: breathAt(R, clip, t - delay), depth, M };
}

/**
 * Quanto il respiro sposta un parametro. Un quinto dell'escursione a
 * profondità piena; i parametri che si chiamano già «respiro» un po' di più.
 */
export function breathOffset(br, proc, d) {
  const mode = paramMode(proc, d, br.M);
  if (!mode || mode === 'escluso') return 0;
  const w = d.id === 'respiro' ? 1.6 : 1;
  return br.m * br.depth * 0.2 * w * (d.max - d.min) * (mode === 'inverso' ? -1 : 1);
}

/** Valore per il GLSL (RESPIRO): il respiro del passaggio per la sua profondità. */
export function breathUniform(clip, pass, t) {
  const br = breathFor(clip, pass, t);
  return br ? br.m * br.depth : 0;
}
