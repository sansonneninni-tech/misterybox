// Struttura di una clip, formati e valori predefiniti.
// Una clip è tutto ciò che serve per rifare gli stessi fotogrammi: niente
// stato nascosto, niente casualità fuori dal seme.

export const ASPECTS = {
  '16:9': [16, 9],
  '9:16': [9, 16],
  '1:1': [1, 1],
  '4:5': [4, 5],
  '2.39:1': [2.39, 1],
  '4:3': [4, 3],
};

export const FPS = [24, 30];
export const LONG_SIDES = [1280, 1920, 2560, 3840];

/** Dimensioni in pixel per proporzione e lato lungo (sempre pari, come vuole il ProRes). */
export function dims(aspect, long) {
  const [a, b] = ASPECTS[aspect] || ASPECTS['16:9'];
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);
  if (a >= b) return { w: even(long), h: even(long * b / a) };
  return { w: even(long * a / b), h: even(long) };
}

export const MOTION_MODES = [
  { id: 'fermo', label: 'Fermo', hint: 'solo le chiavi che metti tu' },
  { id: 'contemplativo', label: 'Contemplativo', hint: 'oscillazioni lente e lunghe' },
  { id: 'ritmico', label: 'Ritmico', hint: 'scatti a tempo' },
  { id: 'caotico', label: 'Caotico', hint: 'rumore e salti improvvisi' },
];

export const STATES = ['materiale', 'in esame', 'scelta', 'finita'];

let uidN = 0;
export function uid(prefix = 'x') {
  uidN = (uidN + 1) % 1e6;
  return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36) + uidN.toString(36);
}

export function newSeed() { return Math.floor(Math.random() * 99999) + 1; }

export function defaultClip() {
  return {
    format: { aspect: '16:9', long: 3840, fps: 24, duration: 8, loop: true },
    sources: [],          // [{ id, speed, start }]
    chain: [],            // [{ id, proc, on, mix, blend, params: {} }]
    motion: { mode: 'contemplativo', amount: 0.5, bpm: 96, division: 1, speed: 1 },
    keys: {},             // { "<passId>.<param>": [[t, v], ...] }
    seed: newSeed(),
  };
}

export function clone(o) { return JSON.parse(JSON.stringify(o)); }

/** Ripara una clip letta dal disco: campi mancanti, valori fuori scala. */
export function normalizeClip(c) {
  const d = defaultClip();
  const out = Object.assign(d, c || {});
  out.format = Object.assign(defaultClip().format, out.format || {});
  out.format.duration = Math.min(30, Math.max(1, Number(out.format.duration) || 8));
  if (!FPS.includes(out.format.fps)) out.format.fps = 24;
  if (!ASPECTS[out.format.aspect]) out.format.aspect = '16:9';
  out.motion = Object.assign(defaultClip().motion, out.motion || {});
  out.sources = (out.sources || []).map((s) => (typeof s === 'string' ? { id: s, speed: 1, start: 0 } : Object.assign({ speed: 1, start: 0 }, s)));
  out.chain = (out.chain || []).map((p) => Object.assign({ on: true, mix: 1, blend: 'normale', params: {} }, p));
  out.keys = out.keys || {};
  return out;
}
