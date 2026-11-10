// Movimento dei parametri nel tempo: chiavi della timeline + carattere della
// clip (fermo, contemplativo, ritmico, caotico). Tutto deterministico dal seme.

import { byId } from './processes.js';
import { breathFor, breathOffset } from './respiro.js';

function h1(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
const smooth = (x) => x * x * (3 - 2 * x);

/** Frequenza adattata al loop: un numero intero di cicli nella durata. */
function fitRate(r, clip) {
  if (!clip.format.loop) return r;
  const T = clip.format.duration;
  return Math.max(1, Math.round(T * r)) / T;
}

/** Rumore 1D liscio, periodico se serve. */
function vnoise(x, seed, period) {
  const i = Math.floor(x), f = x - i;
  const a = period ? ((i % period) + period) % period : i;
  const b = period ? (((i + 1) % period) + period) % period : i + 1;
  return h1(a + seed * 0.37) * (1 - smooth(f)) + h1(b + seed * 0.37) * smooth(f);
}

export function keyValue(track, t) {
  if (!track || !track.length) return undefined;
  if (t <= track[0][0]) return track[0][1];
  const last = track[track.length - 1];
  if (t >= last[0]) return last[1];
  for (let i = 0; i < track.length - 1; i++) {
    const [t0, v0] = track[i], [t1, v1] = track[i + 1];
    if (t >= t0 && t <= t1) {
      const f = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
      return v0 + (v1 - v0) * smooth(f);
    }
  }
  return last[1];
}

/**
 * Modulazione tra -1 e 1 per un parametro, secondo il carattere della clip.
 * `salt` distingue i parametri tra loro.
 */
export function modulation(clip, t, salt) {
  const m = clip.motion || {};
  const speed = m.speed ?? 1;
  const seed = (clip.seed || 1) + salt * 13.1;
  const T = clip.format.duration;
  const tt = t * speed;
  switch (m.mode) {
    case 'contemplativo': {
      const r1 = fitRate((0.06 + h1(seed) * 0.08) * speed, clip);
      const r2 = fitRate((0.11 + h1(seed + 1) * 0.12) * speed, clip);
      return 0.65 * Math.sin(2 * Math.PI * (t * r1 + h1(seed + 2))) + 0.35 * Math.sin(2 * Math.PI * (t * r2 + h1(seed + 3)));
    }
    case 'ritmico': {
      const bps = (m.bpm || 96) / 60 * (m.division || 1);
      const r = fitRate(bps, clip);
      const step = Math.floor(t * r);
      const n = clip.format.loop ? Math.max(1, Math.round(T * r)) : 0;
      const s = n ? ((step % n) + n) % n : step;
      const ph = t * r - step;
      const env = Math.exp(-ph * 4.0);             // attacco secco, coda breve
      return (h1(s + seed) * 2 - 1) * (0.35 + 0.65 * env);
    }
    case 'caotico': {
      const r = 3.2 * speed;
      const P = clip.format.loop ? Math.max(1, Math.round(T * r)) : 0;
      const x = (clip.format.loop ? t * P / T : tt * 3.2);
      let v = vnoise(x, seed, P) * 2 - 1;
      // salti: ogni tanto il parametro scatta altrove per un attimo
      const j = Math.floor(t * 7 * speed);
      if (h1(j + seed * 3) > 0.86) v = h1(j + seed) * 2 - 1;
      return v;
    }
    default:
      return 0;
  }
}

/** Valori di tutti i parametri di un passaggio al tempo t. */
export function passValues(clip, pass, t, live) {
  const proc = byId[pass.proc];
  const amount = clip.motion?.mode === 'fermo' ? 0 : (clip.motion?.amount ?? 0.5);
  // Respiro: sopra chiavi e carattere del movimento, un ritmo solo per tutte le materie
  const br = proc.materia ? breathFor(clip, pass, t) : null;
  return proc.params.map((p, i) => {
    const key = `${pass.id}.${p.id}`;
    let v = live && live[key] !== undefined ? live[key] : keyValue(clip.keys?.[key], t);
    if (v === undefined) v = pass.params?.[p.id] ?? p.def;
    const w = pass.mod?.[p.id] ?? p.mod;
    if (amount > 0 && w > 0 && !p.options) {
      v += modulation(clip, t, i + hashStr(pass.id)) * amount * w * (p.max - p.min) * 0.35;
    }
    if (br) v += breathOffset(br, proc, p);
    v = Math.min(p.max, Math.max(p.min, v));
    if (p.step) v = Math.round(v / p.step) * p.step;
    return v;
  });
}

function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997; return h; }
