// TEMPO GEOLOGICO — comprimere ore di trasformazione in pochi secondi.
//
// Una curva disegnata sulla timeline dice quanto corre il tempo della
// materia rispetto a quello della clip: tratti lentissimi, accelerazioni,
// quasi arresti. Vale per tutte le materie insieme; ognuna può invecchiare
// più in fretta o più piano delle altre.
//
// - Materie con stato (crescono, colano, si diffondono) e materie a
//   retroazione: più passi di simulazione per fotogramma, o meno, contati in
//   modo esatto a partire dal fotogramma 0. Anteprima e render 4K fanno gli
//   stessi passi; solo l'anteprima, se il Mac non ce la fa, ne salta alcuni e
//   lo dice.
// - Materie senza stato: il loro orologio interno (u_t) è il tempo della
//   materia. Con il loop il tempo totale della materia sostituisce la durata,
//   così il loop resta chiuso.
// Una materia nuova lo eredita senza fare nulla.

import { passKey, clamp } from './catena.js';

export const TEMPO_MIN = 0.03;     // «quasi arresto»
export const TEMPO_BASE = {
  on: false,
  massimo: 16,                     // moltiplicatore massimo della curva
  punti: [[0, 1], [1, 1]],         // [[frazione della clip, velocità], …]
  materie: {},                     // chiave → { fattore }  (invecchia ×0,25…×4)
};

export const TEMPO_MASSIMI = [4, 16, 64, 256];

/** Forme di partenza per la curva: si ridisegnano col dito. */
export const TEMPO_FORME = [
  { id: 'costante', label: 'Costante', punti: (M) => [[0, Math.min(M, 8)], [1, Math.min(M, 8)]] },
  { id: 'accelera', label: 'Accelera', punti: (M) => [[0, 0.25], [0.55, Math.sqrt(M)], [1, M]] },
  { id: 'rallenta', label: 'Rallenta', punti: (M) => [[0, M], [0.45, Math.sqrt(M)], [1, 0.08]] },
  { id: 'ere', label: 'Ere', punti: (M) => [[0, 0.4], [0.18, M], [0.38, M * 0.7], [0.52, 0.05], [0.68, 0.05], [0.84, M * 0.5], [1, 0.4]] },
  { id: 'arresto', label: 'Quasi arresto', punti: (M) => [[0, M * 0.5], [0.4, M * 0.5], [0.5, TEMPO_MIN], [0.72, TEMPO_MIN], [0.82, M * 0.5], [1, M * 0.5]] },
];

export const tempoOf = (clip) => (clip.tempo && clip.tempo.on ? clip.tempo : null);

/** Fattore di invecchiamento di un passaggio (1 = come le altre). */
export function ageFactor(clip, pass) {
  const T = tempoOf(clip);
  return T ? clamp(T.materie?.[passKey(clip, pass)]?.fattore ?? 1, 0.25, 4) : 1;
}

// --------------------------------------------------------------- la curva
const L2 = Math.log2;

/** Punti ordinati e ripuliti, in log2 della velocità. */
function prep(T) {
  const M = clamp(T.massimo || 16, 1, 1024);
  let pts = (T.punti || []).filter((p) => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1]))
    .map(([u, v]) => [clamp(u, 0, 1), L2(clamp(v, TEMPO_MIN, M))]).sort((a, b) => a[0] - b[0]);
  if (!pts.length) pts = [[0, 0], [1, 0]];
  if (pts[0][0] > 0) pts.unshift([0, pts[0][1]]);
  if (pts[pts.length - 1][0] < 1) pts.push([1, pts[pts.length - 1][1]]);
  // tangenti monotone (Fritsch–Carlson): nessuna oscillazione oltre i punti
  const n = pts.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / Math.max(1e-9, pts[i + 1][0] - pts[i][0]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  m[0] = n > 1 ? d[0] : 0; m[n - 1] = n > 1 ? d[n - 2] : 0;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return { pts, m, M };
}

/** Velocità del tempo della materia nel punto u (0…1) della clip. */
export function speedAt(T, u, pre = prep(T)) {
  const { pts, m, M } = pre;
  u = clamp(u, 0, 1);
  let i = 0;
  while (i < pts.length - 2 && u > pts[i + 1][0]) i++;
  const [u0, y0] = pts[i], [u1, y1] = pts[Math.min(i + 1, pts.length - 1)];
  const hgt = u1 - u0;
  if (hgt <= 0) return clamp(2 ** y0, TEMPO_MIN, M);
  const s = (u - u0) / hgt, s2 = s * s, s3 = s2 * s;
  const y = (2 * s3 - 3 * s2 + 1) * y0 + (s3 - 2 * s2 + s) * hgt * m[i] + (-2 * s3 + 3 * s2) * y1 + (s3 - s2) * hgt * m[Math.min(i + 1, m.length - 1)];
  return clamp(2 ** y, TEMPO_MIN, M);
}

export { prep as prepCurve };

// ------------------------------------------------ tempo della materia
const cache = new Map();
const SUB = 16; // sottopassi per fotogramma nell'integrale

/** τ ai confini dei fotogrammi: secondi di materia trascorsi al fotogramma f. */
export function tauTable(clip) {
  const T = tempoOf(clip);
  const fps = clip.format.fps, dur = clip.format.duration;
  const total = Math.max(1, Math.round(dur * fps));
  const key = JSON.stringify([T.punti, T.massimo, fps, dur]);
  const hit = cache.get(key);
  if (hit) return hit;
  const pre = prep(T);
  const tab = new Float64Array(total + 1);
  const h = 1 / (fps * SUB);
  let acc = 0;
  for (let f = 0; f < total; f++) {
    for (let k = 0; k < SUB; k++) acc += speedAt(T, ((f * SUB + k + 0.5) * h) / dur, pre) * h;
    tab[f + 1] = acc;
  }
  if (cache.size > 32) cache.clear();
  cache.set(key, tab);
  return tab;
}

/** Secondi di materia al tempo t della clip (t fra 0 e la durata). */
export function materialTime(clip, t) {
  const tab = tauTable(clip);
  const x = clamp(t * clip.format.fps, 0, tab.length - 1);
  const i = Math.min(tab.length - 2, Math.floor(x));
  return tab[i] + (tab[i + 1] - tab[i]) * (x - i);
}

/** Durata della clip in secondi di materia. */
export function materialDuration(clip) { const tab = tauTable(clip); return tab[tab.length - 1]; }

/** Passi fatti dall'inizio fino al confine del fotogramma f, a `perFrame` passi per fotogramma di materia. */
export function stepsBefore(clip, f, perFrame, k = 1) {
  const tab = tauTable(clip);
  return Math.floor(perFrame * k * clip.format.fps * tab[clamp(f, 0, tab.length - 1)] + 1e-6);
}

/** Lettura umana della curva: quante ore, giorni… di materia stanno nella clip. */
export function describe(clip) {
  const s = materialDuration(clip);
  const r = s / clip.format.duration;
  return { secondi: s, rapporto: r };
}
