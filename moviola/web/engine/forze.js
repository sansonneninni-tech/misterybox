// GRAVITÀ E VENTO — un campo di forze unico che si disegna sul quadro e che
// tutte le materie sentono.
//
// Il campo è una texture condivisa, ricalcolata a ogni fotogramma: xy = vento
// più forze locali (correnti tracciate a mano, pozzi, sorgenti, vortici), in
// altezze di quadro al secondo; z = quanto soffia la raffica in quel punto.
// La gravità è uniforme e arriva a parte. Unità: 1 = il quadro intero in un
// secondo; i valori veri restano tra 0 e 0,3.
//
// Come la legge una materia (GLSL):
//   FORZA(uv)  → vec2, velocità del campo in uv al secondo (gravità compresa,
//                pesata dal suo `peso`, e già moltiplicata per «quanto sente»)
//   GIU(d)     → ruota un vettore pensato «verso il basso» come la gravità
//   GRAVITA    → intensità della gravità (1 senza forze)
//   RAFFICA(uv)→ 0…1, la raffica di vento in quel punto
// Oppure, senza scrivere GLSL, con una riga nella dichiarazione:
//   forze: 'trasporto'   lo stato (o la retroazione) viene portato dal campo
//   forze: 'mappa'       come sopra, e lo stato xy è uno spostamento in uv
//                        verso la foto (miele, cera, bitume): si aggiorna anche lui
//   peso: 0…1            quanto la gravità la trascina oltre al vento (1 di base)

import { trackValue, clamp, passKey } from './catena.js';

export const FORZE_BASE = {
  on: false,
  mostra: true,
  gravita: { forza: 0.5, direzione: 270 },
  vento: { forza: 0, direzione: 0, raffiche: 0.4, misura: 0.5 },
  locali: [],          // [{ id, tipo: 'corrente'|'pozzo'|'sorgente'|'vortice', x, y, r, forza, punti: [[x, y], …], verso }]
  materie: {},         // chiave → { presa }  (quanto la materia sente le forze, 0…2)
  chiavi: {},          // { 'gravita.forza': [[t, v]], 'vento.direzione': …, 'f:<id>': … }
};

export const FORZE_TIPI = [
  { id: 'corrente', label: 'Corrente', hint: 'trascina il dito: la materia segue il tratto' },
  { id: 'vortice', label: 'Vortice', hint: 'tocca e allarga: un gorgo' },
  { id: 'pozzo', label: 'Pozzo', hint: 'tocca e allarga: la materia vi scivola dentro' },
  { id: 'sorgente', label: 'Sorgente', hint: 'tocca e allarga: la materia ne esce' },
];

// Quanto vale «1» di ogni forza, in altezze di quadro al secondo.
export const SCALA = { gravita: 0.12, vento: 0.15, locale: 0.22 };
export const MAX_LOCALI = 24;
export const MAX_SEGMENTI = 96;

export const forzeOf = (clip) => (clip.forze && clip.forze.on ? clip.forze : null);

/** Valore di un controllo al tempo t, con le chiavi se ci sono. */
export function forceValue(F, name, t) {
  const [a, b] = name.split('.');
  const base = name.startsWith('f:') ? (F.locali.find((l) => 'f:' + l.id === name)?.forza ?? 0) : F[a]?.[b];
  return trackValue(F.chiavi?.[name], t, base);
}

/** Quanto la materia sente le forze, e come le legge. */
export function forceUse(clip, pass, proc) {
  const F = forzeOf(clip);
  if (!F) return null;
  const presa = clamp(F.materie?.[passKey(clip, pass)]?.presa ?? 1, 0, 2);
  return { presa, modo: proc.forze || null, peso: proc.peso ?? 1 };
}

const rad = (d) => (d * Math.PI) / 180;

/** Gravità uniforme in altezze di quadro al secondo, e la sua direzione. */
export function gravityAt(F, t) {
  const g = Math.max(0, forceValue(F, 'gravita.forza', t));
  const a = rad(forceValue(F, 'gravita.direzione', t));
  return { v: [Math.cos(a) * g * SCALA.gravita, Math.sin(a) * g * SCALA.gravita], dir: [Math.cos(a), Math.sin(a)], g };
}

/** Le forze locali in forma compatta per il GLSL (e per il disegno). */
export function packLocals(F, t, aspect) {
  const pts = [], seg = [];
  for (const l of F.locali || []) {
    const f = forceValue(F, 'f:' + l.id, t);
    if (l.tipo === 'corrente') {
      const P = l.punti || [];
      for (let i = 0; i < P.length - 1 && seg.length < MAX_SEGMENTI; i++) seg.push([P[i][0], P[i][1], P[i + 1][0], P[i + 1][1], l.r, f]);
    } else if (pts.length < MAX_LOCALI) {
      const kind = l.tipo === 'vortice' ? 2 : l.tipo === 'sorgente' ? 1 : 0;
      pts.push([l.x, l.y, l.r, f * (l.tipo === 'vortice' ? (l.verso || 1) : 1), kind]);
    }
  }
  return { pts, seg, aspect };
}

/**
 * Il campo calcolato in JS, senza raffiche: serve solo a disegnare le linee
 * sul quadro. Il campo vero, quello che sentono le materie, è nel GLSL qui sotto.
 */
export function fieldAt(F, t, x, y, aspect, packed = packLocals(F, t, aspect)) {
  const wf = Math.max(0, forceValue(F, 'vento.forza', t)) * SCALA.vento;
  const wa = rad(forceValue(F, 'vento.direzione', t));
  let vx = Math.cos(wa) * wf, vy = Math.sin(wa) * wf;
  for (const [cx, cy, r, f, kind] of packed.pts) {
    const dx = (x - cx) * aspect, dy = y - cy, d = Math.hypot(dx, dy);
    if (d >= r || d < 1e-6) continue;
    const fall = (1 - smoothstepJ(0, r, d)) * smoothstepJ(0, r * 0.18, d) * f * SCALA.locale;
    const ux = dx / d, uy = dy / d;
    if (kind === 2) { vx += (-uy - 0.15 * ux) * fall; vy += (ux - 0.15 * uy) * fall; }
    else { const s = kind === 1 ? 1 : -1; vx += ux * fall * s; vy += uy * fall * s; }
  }
  let sx = 0, sy = 0, sw = 0;
  for (const [x0, y0, x1, y1, r, f] of packed.seg) {
    const ax = (x1 - x0) * aspect, ay = y1 - y0, L = Math.hypot(ax, ay);
    if (L < 1e-6) continue;
    const px = (x - x0) * aspect, py = y - y0;
    const h = clamp((px * ax + py * ay) / (L * L), 0, 1);
    const d = Math.hypot(px - ax * h, py - ay * h);
    const w = Math.exp(-((d / Math.max(r, 1e-3)) ** 2) * 2);
    sx += (ax / L) * f * w * w; sy += (ay / L) * f * w * w; sw += w;
  }
  const n = Math.max(sw, 1);
  vx += (sx / n) * SCALA.locale; vy += (sy / n) * SCALA.locale;
  return [vx, vy];
}
function smoothstepJ(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

// ------------------------------------------------------------- GLSL
// Il calcolo del campo: un passaggio piccolo (256 px sul lato lungo) prima
// della catena. Usa il PRELUDE per il rumore periodico: con il loop le
// raffiche si richiudono sul primo fotogramma.
export const FORZE_FRAG = `
uniform vec2 u_w;           // vento medio
uniform float u_raff, u_rmis;
uniform vec4 u_pt[${MAX_LOCALI}];   // x, y, raggio, forza
uniform float u_ptk[${MAX_LOCALI}]; // 0 pozzo, 1 sorgente, 2 vortice
uniform int u_npt;
uniform vec4 u_sg[${MAX_SEGMENTI}];  // x0, y0, x1, y1
uniform vec2 u_sgf[${MAX_SEGMENTI}]; // raggio, forza
uniform int u_nsg;
void main() {
  vec2 uv = v_uv;
  vec2 a = vec2(ASPECT, 1.0);
  vec2 v = vec2(0.0);
  float raff = 0.0;
  float wl = length(u_w);
  if (wl > 1e-5) {
    // raffiche: fronti allungati nel verso del vento, che passano e tornano
    vec2 wd = u_w / wl;
    vec2 p = uv * a;
    vec2 q = vec2(dot(p, wd), dot(p, vec2(-wd.y, wd.x))) * mix(0.8, 3.5, u_rmis);
    q.x *= 0.45;
    float z = ztime(0.35 + wl * 2.0), Pz = period(0.35 + wl * 2.0);
    float g = fbm(q, z, Pz, 3);
    raff = smoothstep(-0.15, 0.55, g) * u_raff;
    float turn = gnoise(vec3(q * 0.7 + 3.1, z * 0.6), Pz * 0.6) * u_raff * 0.55;
    v += (rot(turn) * u_w) * (1.0 - 0.5 * u_raff + raff * 1.9);
  }
  for (int i = 0; i < ${MAX_LOCALI}; i++) {
    if (i >= u_npt) break;
    vec4 P = u_pt[i];
    vec2 d = (uv - P.xy) * a;
    float r = length(d);
    if (r >= P.z || r < 1e-6) continue;
    float fall = (1.0 - smoothstep(0.0, P.z, r)) * smoothstep(0.0, P.z * 0.18, r) * P.w * ${SCALA.locale.toFixed(3)};
    vec2 u = d / r;
    if (u_ptk[i] > 1.5) v += (vec2(-u.y, u.x) - 0.15 * u) * fall;
    else v += u * fall * (u_ptk[i] > 0.5 ? 1.0 : -1.0);
  }
  vec2 sv = vec2(0.0); float sw = 0.0;
  for (int i = 0; i < ${MAX_SEGMENTI}; i++) {
    if (i >= u_nsg) break;
    vec4 S4 = u_sg[i];
    vec2 ab = (S4.zw - S4.xy) * a;
    float L = length(ab);
    if (L < 1e-6) continue;
    vec2 pa = (uv - S4.xy) * a;
    float hh = clamp(dot(pa, ab) / (L * L), 0.0, 1.0);
    float d = length(pa - ab * hh);
    float w = exp(-pow(d / max(u_sgf[i].x, 1e-3), 2.0) * 2.0);
    sv += ab / L * u_sgf[i].y * w * w; sw += w;
  }
  v += sv / max(sw, 1.0) * ${SCALA.locale.toFixed(3)};
  // altezze di quadro → uv; codificato attorno a 0,5 per stare anche in 8 bit
  vec2 vuv = v / a;
  o_col = vec4(clamp(vuv + 0.5, 0.0, 1.0), raff, 1.0);
}`;

/** Lato lungo del campo: le forze sono morbide, non serve di più. */
export const FIELD_LONG = 256;
