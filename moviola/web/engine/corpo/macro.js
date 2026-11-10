// Macro: una camera che entra nella materia.
//
// Non è uno zoom sull'immagine finita: con la Macro accesa tutta la catena
// viene calcolata nella finestra guardata, in coordinate della superficie
// (il "mondo"), così ogni materia disegna la sua struttura al punto giusto e
// non scivola. Avvicinandosi compaiono nuovi livelli di microdettaglio,
// ancorati alla superficie; il rilievo dà parallasse e una messa a fuoco vera.
//
// I parametri si animano con le chiavi della clip: "macro.<parametro>".

import { keyValue } from '../motion.js';

const P = (id, label, min, max, def, extra = {}) => ({ id, label, min, max, def, ...extra });

export const MACRO_PARAMS = [
  P('ingrandimento', 'Ingrandimento', 1, 32, 4, { log: true, hint: 'quanto entri nella materia' }),
  P('guardaX', 'Punto guardato, orizzontale', 0, 1, 0.5),
  P('guardaY', 'Punto guardato, verticale', 0, 1, 0.5),
  P('fuoco', 'Piano di fuoco', 0, 1, 0.55, { hint: '0 sul fondo, 1 sui rilievi' }),
  P('apertura', 'Apertura', 0, 1, 0.45, { hint: '0 tutto a fuoco, 1 fuoco cortissimo' }),
  P('inclinazione', 'Inclinazione', 0, 1, 0.25, { hint: 'la camera guarda di sbieco: piano di fuoco inclinato e parallasse' }),
  P('verso', 'Verso dell’inclinazione', 0, 360, 90, { step: 1 }),
  P('rotazione', 'Rotazione', -30, 30, 0, { hint: 'gradi' }),
  P('microdettaglio', 'Microdettaglio', 0, 1.5, 0.8, { hint: 'grana, pori, fibre, bolle o cristalli che compaiono avvicinandosi' }),
  P('rilievo', 'Profondità del rilievo', 0, 1, 0.6, { hint: 'quanto il rilievo sposta e sfoca' }),
  P('deriva', 'Deriva', 0, 1, 0.25, { hint: 'la camera scivola piano di lato' }),
  P('respiro', 'Respiro del fuoco', 0, 1, 0.15, { hint: 'il fuoco va e viene, lento' }),
];
export const MACRO_BY_ID = Object.fromEntries(MACRO_PARAMS.map((p) => [p.id, p]));

export function defaultMacro() {
  return { on: false, micro: 'auto', params: Object.fromEntries(MACRO_PARAMS.map((p) => [p.id, p.def])) };
}

export function normalizeMacro(m) {
  const d = defaultMacro();
  const out = Object.assign(d, m || {});
  out.params = { ...defaultMacro().params, ...(m?.params || {}) };
  out.on = !!out.on;
  return out;
}

export const keyOf = (id) => 'macro.' + id;

/** Valore di un parametro al tempo t: chiave, se c'è, altrimenti il valore fisso. */
export function macroValue(clip, id, t) {
  const p = MACRO_BY_ID[id];
  let v = keyValue(clip.keys?.[keyOf(id)], t);
  if (v === undefined) v = clip.macro?.params?.[id] ?? p.def;
  return Math.min(p.max, Math.max(p.min, v));
}

function h1(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
const sm = (x) => x * x * (3 - 2 * x);
// rumore liscio, periodico con P celle se P > 0
function vn(x, seed, P) {
  const i = Math.floor(x), f = x - i;
  const a = P ? ((i % P) + P) % P : i, b = P ? (((i + 1) % P) + P) % P : i + 1;
  return h1(a + seed) * (1 - sm(f)) + h1(b + seed) * sm(f);
}

/**
 * Lo stato della camera al tempo t, già pronto per lo shader.
 * Spenta: identità (nessun calcolo in più nei passaggi).
 */
export function macroCamera(clip, t, aspect) {
  const m = clip.macro;
  if (!m?.on) return null;
  const v = (id) => macroValue(clip, id, t);
  const z = v('ingrandimento');
  const T = clip.format.duration, loop = clip.format.loop;
  const seed = (clip.seed || 1) * 0.173;
  // deriva: un percorso lento, chiuso sul loop se il loop è acceso
  const cells = loop ? Math.max(1, Math.round(T * 0.22)) : 0;
  const x = loop ? (t / T) * cells : t * 0.22;
  const dr = v('deriva');
  const dsx = (vn(x, seed + 1, cells) - 0.5) * 2, dsy = (vn(x, seed + 7, cells) - 0.5) * 2;
  const drift = [dsx * dr * 0.16, dsy * dr * 0.12];          // in altezze di schermo
  const roll = (v('rotazione') + (vn(x * 0.7, seed + 13, cells) - 0.5) * dr * 3) * Math.PI / 180;
  // centro nel mondo: la deriva si misura sullo schermo, quindi si divide per l'ingrandimento
  let cx = v('guardaX') + drift[0] / (z * aspect), cy = v('guardaY') + drift[1] / z;
  const mx = Math.min(0.5, (0.5 / z) * (Math.abs(Math.cos(roll)) + Math.abs(Math.sin(roll)) / aspect));
  const my = Math.min(0.5, (0.5 / z) * (Math.abs(Math.cos(roll)) + Math.abs(Math.sin(roll)) * aspect));
  cx = Math.min(1 - mx, Math.max(mx, cx)); cy = Math.min(1 - my, Math.max(my, cy));
  // respiro del fuoco, un ciclo lento che chiude il loop
  const br = loop ? Math.max(1, Math.round(T / 6.5)) / T : 1 / 6.5;
  const focus = v('fuoco') + v('respiro') * 0.14 * Math.sin(2 * Math.PI * (t * br + h1(seed + 3)));
  const incl = v('inclinazione');
  const ang = v('verso') * Math.PI / 180;
  const dir = [Math.cos(ang), Math.sin(ang)];
  const ril = v('rilievo');
  // parallasse: i punti alti si spostano più di quelli bassi, nel verso
  // dell'inclinazione e mentre la camera deriva
  const par = [
    (dir[0] * (0.006 + 0.045 * incl) - drift[0] * 0.35) * ril,
    (dir[1] * (0.006 + 0.045 * incl) - drift[1] * 0.35) * ril,
  ];
  // sfocato: cresce con l'ingrandimento, come in un vero obiettivo macro
  const coc = v('apertura') * 26 * (0.55 + 0.45 * Math.min(1, Math.log2(z) / 4));
  return {
    cam: [cx, cy, z, roll],
    camP: [par[0] / aspect, par[1], focus, 1],
    focus, coc, incl: incl * 0.9, dir, ril,
    micro: v('microdettaglio'), z,
  };
}

/** Da un punto dello schermo (0..1, y in alto) al punto della superficie. */
export function screenToWorld(camState, sx, sy, aspect) {
  if (!camState) return [sx, sy];
  const [cx, cy, z, a] = camState.cam;
  const dx = (sx - 0.5) * aspect, dy = sy - 0.5;
  const c = Math.cos(a), s = Math.sin(a);
  // rot(a) in GLSL è mat2(c, -s, s, c) per colonne: (x, y) -> (c x + s y, -s x + c y)
  const rx = c * dx + s * dy, ry = -s * dx + c * dy;
  return [cx + rx / z / aspect, cy + ry / z];
}

export function worldToScreen(camState, wx, wy, aspect) {
  if (!camState) return [wx, wy];
  const [cx, cy, z, a] = camState.cam;
  const dx = (wx - cx) * aspect * z, dy = (wy - cy) * z;
  const c = Math.cos(-a), s = Math.sin(-a);
  return [0.5 + (c * dx + s * dy) / aspect, 0.5 + (-s * dx + c * dy)];
}
