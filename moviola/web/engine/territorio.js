// Territori delle materie.
//
// MAPPA: dove sta ogni materia all'inizio. Si dipinge sulla foto (mappa.js),
// si salva nella clip (clip.materie[i].mappa) e viaggia nel .json.
// CONTAGIO: come il confine si muove nel tempo. Una materia avanza sulla
// materia sotto (o quella sotto avanza su di lei) come un fronte vivo: dita,
// isole, sacche che resistono, la foto che fa resistenza con le sue luci.
//
// Il fronte è un'equazione di Allen–Cahn su uno stato in virgola mobile a
// misura fissa (STATE_LONG sul lato lungo), lo stesso in anteprima e nel 4K,
// con un numero fisso di passi per fotogramma: stesso seme e stessi
// parametri danno lo stesso confine. Lo stato non dipende dal resto della
// catena, quindi si può ricalcolare dal fotogramma 0 quando serve.
//
// Nulla qui conosce le singole materie: vale per tutte.

import { VERT, PRELUDE } from './glsl.js';
import { keyValue } from './motion.js';
import { byId } from './processes.js';

export const STATE_LONG = 512;
const STEPS = 24; // passi del fronte per fotogramma (a 24 fps; a 30 fps il passo si accorcia)

const P = (id, label, min, max, def, extra = {}) => ({ id, label, min, max, def, ...extra });

/** Parametri del contagio: tutti con chiavi sulla timeline. */
export const CONTAGIO = [
  P('spinta', 'Spinta', -1, 1, 0.6, { hint: 'a destra avanza questa materia, a sinistra avanza quella sotto; a zero il confine resta vivo ma non va da nessuna parte' }),
  P('velocita', 'Velocità del fronte', 0, 1, 0.3, { hint: 'a zero il confine si ferma del tutto' }),
  P('irregolarita', 'Irregolarità del bordo', 0, 1, 0.5, { hint: 'il fronte esita, avanza a strappi e cambia idea' }),
  P('dita', 'Dita', 0, 1, 0.4, { hint: 'le punte avanzano più del resto e si allungano' }),
  P('isole', 'Isole', 0, 1, 0.2, { hint: 'spore che nascono poco più avanti del fronte' }),
  P('sacche', 'Sacche che resistono', 0, 1, 0.3, { hint: 'zone che il fronte aggira e lascia indietro' }),
  P('resistenza', 'Resistenza della foto', -1, 1, 0.4, { hint: 'a destra resistono i chiari, a sinistra gli scuri' }),
  P('ritorno', 'Ritorno', 0, 1, 0, { hint: 'il confine vuole tornare dove l’hai dipinto' }),
];

/** Carattere del confine: vale per la mappa e per il contagio. */
export const CARATTERI = [
  { id: 0, label: 'Infiltra', hint: 'entra nelle crepe dell’altra, dalle più sottili' },
  { id: 1, label: 'Sprofonda', hint: 'scende in gocce pesanti nell’altra' },
  { id: 2, label: 'Impasta', hint: 'le due si piegano l’una nell’altra' },
];
export const CONFINE = [
  P('larghezza', 'Larghezza della fascia', 0, 1, 0.5, { hint: 'quanto è larga la zona in cui le due materie si mescolano' }),
  P('grana', 'Grana della fascia', 0, 1, 0.45, { hint: 'grandezza di crepe, gocce o lamelle' }),
  P('trascina', 'Trascinamento', 0, 1, 0.4, { hint: 'quanto le due materie si tirano dietro l’una l’altra' }),
];

export const GEN_DEFAULT = { modo: 'nessuno', soglia: 0.5, morbidezza: 0.12, inverti: 0, tinta: 0.58, ampiezza: 0.1 };
export const GEN_MODI = ['nessuno', 'luce', 'tinta', 'bordi'];

const num = (v, d, lo, hi) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };

/** Ripulisce mappa, contagio e confine di uno strato (dal disco o dall'interfaccia). */
export function cleanTerritorio(m) {
  const out = {};
  const mp = m?.mappa;
  if (mp && typeof mp.png === 'string' && mp.png.startsWith('data:image/png') && mp.w > 0 && mp.h > 0) {
    const g = { ...GEN_DEFAULT, ...(mp.gen || {}) };
    out.mappa = {
      w: Math.round(mp.w), h: Math.round(mp.h), png: mp.png, rev: Math.round(Number(mp.rev) || 0),
      foto: typeof mp.foto === 'string' ? mp.foto : null, // id della foto su cui è dipinta
      segui: !!mp.segui,
      gen: {
        modo: GEN_MODI.includes(g.modo) ? g.modo : 'nessuno',
        soglia: num(g.soglia, 0.5, 0, 1), morbidezza: num(g.morbidezza, 0.12, 0, 1),
        inverti: g.inverti ? 1 : 0, tinta: num(g.tinta, 0.58, 0, 1), ampiezza: num(g.ampiezza, 0.1, 0.01, 0.5),
      },
    };
  }
  const c = m?.contagio;
  if (c && typeof c === 'object') {
    const cc = { on: !!c.on, chiavi: {} };
    for (const d of CONTAGIO) {
      cc[d.id] = num(c[d.id], d.def, d.min, d.max);
      const tr = c.chiavi?.[d.id];
      if (Array.isArray(tr) && tr.length) cc.chiavi[d.id] = tr.filter((k) => Array.isArray(k) && k.length === 2).map(([t, v]) => [num(t, 0, 0, 30), num(v, d.def, d.min, d.max)]).sort((a, b) => a[0] - b[0]);
    }
    out.contagio = cc;
  }
  const f = m?.confine;
  if (f && typeof f === 'object') {
    out.confine = { carattere: [0, 1, 2].includes(Math.round(f.carattere)) ? Math.round(f.carattere) : 0 };
    for (const d of CONFINE) out.confine[d.id] = num(f[d.id], d.def, d.min, d.max);
  }
  return out;
}

export const defaultContagio = () => ({ on: true, chiavi: {}, ...Object.fromEntries(CONTAGIO.map((d) => [d.id, d.def])) });
export const defaultConfine = () => ({ carattere: 0, ...Object.fromEntries(CONFINE.map((d) => [d.id, d.def])) });

/** Valore di un parametro del contagio al tempo t (chiavi comprese). */
export function contagioValue(c, d, t) {
  const k = keyValue(c?.chiavi?.[d.id], t);
  return Math.min(d.max, Math.max(d.min, k !== undefined ? k : (c?.[d.id] ?? d.def)));
}

/** Lo strato di materia di un passaggio della catena, se ha un territorio. */
export function territoryOf(clip, pass) {
  if (typeof pass.layer !== 'number') return null;
  const m = clip.materie?.[pass.layer];
  if (!m || m.proc !== pass.proc) return null;
  return m.mappa || m.contagio?.on ? m : null;
}

export const hasTerritorio = (m) => !!(m && (m.mappa || m.contagio?.on));

/** Larghezza della fascia in coordinate del quadro (frazione dell'altezza). */
export const fasciaUV = (x) => 0.003 + 0.11 * Math.pow(x, 1.6);
const granaFreq = (x) => 5 + 50 * Math.pow(x, 1.3);

// ------------------------------------------------------------ mappe decodificate
// Le mappe stanno nella clip come PNG (r aggiunge, g toglie, b viene dalla
// foto). Qui restano decodificate, pronte per la scheda video.
const DECODED = new Map(); // png -> { w, h, data: Uint8Array RGBA } | Promise

export async function decodeMap(png) {
  const hit = DECODED.get(png);
  if (hit) return hit instanceof Promise ? hit : hit;
  const job = (async () => {
    const blob = await (await fetch(png)).blob();
    const bm = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const cv = new OffscreenCanvasOr(bm.width, bm.height);
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(bm, 0, 0);
    const id = g.getImageData(0, 0, bm.width, bm.height);
    bm.close?.();
    const v = { w: id.width, h: id.height, data: new Uint8Array(id.data.buffer) };
    DECODED.set(png, v);
    while (DECODED.size > 32) DECODED.delete(DECODED.keys().next().value);
    return v;
  })();
  DECODED.set(png, job);
  try { return await job; } catch (e) { DECODED.delete(png); throw e; }
}

function OffscreenCanvasOr(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

/** Da chiamare prima di disegnare una clip: decodifica le sue mappe. */
export async function prepareTerritori(clip) {
  const jobs = (clip?.materie || []).filter((m) => m?.mappa?.png).map((m) => decodeMap(m.mappa.png).catch((e) => console.warn('mappa', e)));
  await Promise.all(jobs);
}

/** Per l'interfaccia: la mappa appena dipinta è già decodificata. */
export function rememberDecoded(png, w, h, data) { DECODED.set(png, { w, h, data }); }

// ----------------------------------------------------------------- GLSL
const HEAD = `${PRELUDE}
uniform sampler2D u_F;      // stato: r = presenza, g = dove vorrebbe stare
uniform sampler2D u_G;      // stato di un altro territorio, o il campo del fotogramma
uniform sampler2D u_map;    // mappa dipinta: r aggiunge, g toglie, b dalla foto
uniform float u_hasMap, u_live, u_mapCover;
uniform float u_g[6];       // modo, soglia, morbidezza, inverti, tinta, ampiezza
uniform float u_c[8];       // contagio
uniform float u_dt, u_R;
vec2 photoUV(vec2 uv) { return cover(uv, u_sAsp.x); }
vec3 photoAt(vec2 uv) { return texture(u_s0, photoUV(uv)).rgb; }
vec3 photoSoft(vec2 uv) {
  vec3 c = photoAt(uv) * 0.4;
  for (int i = 0; i < 6; i++) { float a = float(i) * 1.0472 + 0.3; c += photoAt(uv + vec2(cos(a), sin(a)) * PX * 1.2) * 0.1; }
  return c;
}
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}
// la mappa ricavata dalla foto, dal vivo (per i video che la seguono, o senza mappa)
float autoM(vec2 uv) {
  int modo = int(u_g[0] + 0.5);
  float so = u_g[1], mo = max(u_g[2] * 0.5, 0.004);
  float m = 0.0;
  if (u_ns < 1 || modo == 0) m = 0.0;
  else if (modo == 1) m = smoothstep(so - mo, so + mo, luma(photoSoft(uv)));
  else if (modo == 2) {
    vec3 hsv = rgb2hsv(photoSoft(uv));
    float d = abs(fract(hsv.x - u_g[4] + 0.5) - 0.5);
    m = (1.0 - smoothstep(u_g[5] - mo * 0.4, u_g[5] + mo * 0.4, d)) * smoothstep(0.04, 0.16, hsv.y * hsv.z);
  } else {
    float e = 0.0;
    for (int i = 0; i < 8; i++) { float a = float(i) * 0.785 + 0.2; vec2 o = vec2(cos(a), sin(a)) * PX * 2.5; e += abs(luma(photoAt(uv + o)) - luma(photoAt(uv - o))); }
    e = e / 8.0 * 4.0;
    m = smoothstep(so - mo, so + mo, e);
  }
  if (u_g[3] > 0.5) m = 1.0 - m;
  return m;
}
float targetM(vec2 uv) {
  if (u_hasMap < 0.5) return autoM(uv);
  vec2 c = u_mapCover > 0.5 ? photoUV(uv) : uv;
  vec4 mp = texture(u_map, vec2(c.x, 1.0 - c.y));
  float b = u_live > 0.5 ? autoM(uv) : mp.b;
  return clamp(b + mp.r - mp.g, 0.0, 1.0);
}
float ringF(sampler2D t, vec2 uv, float R) {
  float s = 0.0;
  for (int i = 0; i < 8; i++) { float a = float(i) * 0.785 + 0.39; s += texture(t, uv + vec2(cos(a), sin(a)) * PX * R).r; }
  return s / 8.0;
}
`;

// stato iniziale (o mappa dal vivo): presenza = dove vorrebbe stare = mappa
const TARGET = `${HEAD}
void main() { float m = targetM(v_uv); o_col = vec4(m, m, 0.0, 1.0); }`;

// solo il bersaglio cambia (video che segue la luce): il fronte resta suo
const RETARGET = `${HEAD}
void main() { vec4 s = texture(u_F, v_uv); o_col = vec4(s.r, targetM(v_uv), 0.0, 1.0); }`;

// campo del fotogramma: luce della foto, sacche (ferme), irregolarità e isole (vive)
const FIELD = `${HEAD}
void main() {
  vec2 q = (v_uv - 0.5) * vec2(ASPECT, 1.0);
  float z = u_t * 0.09;
  float lum = u_ns > 0 ? luma(photoSoft(v_uv)) : 0.5;
  float sac = fbm(q * 4.2 + 17.0, 0.0, 0.0, 3);
  float irr = fbm(q * 2.6, z, 0.0, 4);
  float iso = gnoise(vec3(q * 7.5 + 31.0, z * 1.7), 0.0);
  o_col = vec4(lum, sac, irr, iso);
}`;

// un passo del fronte
const SIM = `${HEAD}
void main() {
  vec2 uv = v_uv;
  vec4 s = texture(u_F, uv);
  float F = s.r, F0 = s.g;
  vec2 px = PX;
  float n = texture(u_F, uv + vec2(0.0, px.y)).r, so = texture(u_F, uv - vec2(0.0, px.y)).r;
  float e = texture(u_F, uv + vec2(px.x, 0.0)).r, w = texture(u_F, uv - vec2(px.x, 0.0)).r;
  float ne = texture(u_F, uv + px).r, sw = texture(u_F, uv - px).r;
  float nw = texture(u_F, uv + vec2(-px.x, px.y)).r, se = texture(u_F, uv + vec2(px.x, -px.y)).r;
  float lap = (4.0 * (n + so + e + w) + (ne + nw + se + sw) - 20.0 * F) / 6.0;
  float ring = ringF(u_F, uv, 9.0);   // quanta di questa materia c'è attorno
  float far = ringF(u_F, uv, 22.0);   // ... e un po' più in là
  vec4 fl = texture(u_G, uv);
  float sp = u_c[0];
  float sg = sp / (abs(sp) + 0.15);
  float drive = sp * 1.15
    + u_c[2] * fl.z * 2.6
    // dita: solo vicino al fronte, le punte (poca materia attorno) corrono, le baie si fermano
    + u_c[3] * (0.5 - ring) * 3.2 * smoothstep(0.02, 0.2, ring) * (1.0 - smoothstep(0.8, 0.98, ring))
    - u_c[5] * smoothstep(0.06, 0.28, fl.y) * 2.6 * sg
    - u_c[6] * (fl.x - 0.5) * 2.6 * sg
    - u_c[7] * (F - F0) * 2.2;
  float a = clamp(0.5 - 0.5 * drive, -0.7, 1.7);
  float dF = lap + F * (1.0 - F) * (F - a);
  // isole: spore poco più avanti del fronte, dalla parte di chi avanza
  float spot = smoothstep(0.38, 0.56, fl.w);
  if (sg >= 0.0) dF += u_c[4] * spot * smoothstep(0.0, 0.07, far) * (1.0 - smoothstep(0.3, 0.7, ring)) * (1.0 - F) * 0.9 * sg;
  else dF += u_c[4] * spot * smoothstep(0.0, 0.07, 1.0 - far) * smoothstep(0.3, 0.7, ring) * F * 0.9 * sg;
  o_col = vec4(clamp(F + u_dt * dF, 0.0, 1.0), F0, 0.0, 1.0);
}`;

// la materia sotto riprende ciò che quella sopra ha perso, e sta sotto la
// sua fascia dove le due si toccano: così si mescolano davvero tra loro
const COMBINE = `${HEAD}
void main() {
  float A = texture(u_F, v_uv).r;
  vec4 B = texture(u_G, v_uv);
  float lost = clamp(B.g - B.r, 0.0, 1.0);
  float contact = smoothstep(0.02, 0.2, ringF(u_G, v_uv, u_R)) * smoothstep(0.02, 0.12, ringF(u_F, v_uv, u_R * 2.0));
  float m = max(A, max(smoothstep(0.15, 0.6, lost), contact));
  o_col = vec4(m, m, 0.0, 1.0);
}`;

// ------------------------------------------------------------ sulla scheda video
function stateDims(w, h) {
  const s = STATE_LONG / Math.max(w, h);
  return [Math.max(2, Math.round(w * s)), Math.max(2, Math.round(h * s))];
}

function T(r) {
  if (!r._terr) r._terr = { st: new Map(), maps: new Map(), progs: null, bind: new Map(), broken: false };
  return r._terr;
}

function progs(r) {
  const t = T(r);
  if (t.progs || t.broken) return t.progs;
  try {
    t.progs = { target: r._program(VERT, TARGET), retarget: r._program(VERT, RETARGET), field: r._program(VERT, FIELD), sim: r._program(VERT, SIM), combine: r._program(VERT, COMBINE) };
  } catch (e) {
    t.broken = true;
    r.errors.set('territorio', String(e.message || e));
    console.error('Territorio', e);
  }
  return t.progs;
}

function mapTex(r, png) {
  const t = T(r);
  if (t.maps.has(png)) return t.maps.get(png);
  const d = DECODED.get(png);
  if (!d || d instanceof Promise) { if (!d) decodeMap(png).catch(() => {}); return null; }
  const gl = r.gl;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, d.w, d.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, d.data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  t.maps.set(png, tex);
  while (t.maps.size > 12) { const [k, v] = t.maps.entries().next().value; gl.deleteTexture(v); t.maps.delete(k); }
  return tex;
}

function newState(r, sw, sh) {
  const mk = () => r._target(r._tex(sw, sh, r.simFloat));
  return { w: sw, h: sh, t: [mk(), mk()], field: mk(), eff: [mk(), mk()], f: -1, key: '' };
}

function freeState(r, st) {
  st.t.forEach((x) => r._freeTarget(x));
  st.eff.forEach((x) => r._freeTarget(x));
  r._freeTarget(st.field);
}

export function pruneTerritori(r, chain) {
  const t = r._terr; if (!t) return;
  const ids = new Set(chain.map((p) => p.id));
  for (const [id, st] of t.st) if (!ids.has(id)) { freeState(r, st); t.st.delete(id); }
}

/** Libera tutto (renderer distrutto). */
export function destroyTerritori(r) {
  const t = r._terr; if (!t) return;
  for (const st of t.st.values()) freeState(r, st);
  for (const tex of t.maps.values()) r.gl.deleteTexture(tex);
  r._terr = null;
}

function keyFor(clip, m, ready) {
  const mp = m.mappa;
  return JSON.stringify([m.contagio?.on ? m.contagio : null, mp ? [mp.rev, mp.png.length, mp.gen, mp.segui] : null, ready,
    clip.seed, clip.format.fps, clip.format.duration, clip.format.aspect, (clip.sources || []).map((s) => [s.id, s.start, s.speed])]);
}

/**
 * Da chiamare a ogni fotogramma, dopo il caricamento delle sorgenti e prima
 * della catena: porta ogni territorio al fotogramma richiesto e prepara cosa
 * legare a ciascun passaggio.
 */
export function updateTerritori(r, clip, frame) {
  const t = T(r);
  t.bind.clear();
  const chain = clip.chain.filter((p) => p.on && byId[p.proc]);
  const act = chain.map((p) => ({ pass: p, m: territoryOf(clip, p) })).filter((x) => x.m);
  if (!act.length) return;
  const pr = progs(r);
  if (!pr) return;
  const gl = r.gl;
  const [sw, sh] = stateDims(r.w, r.h);
  const fps = clip.format.fps;
  const total = Math.max(1, Math.round(clip.format.duration * fps));
  const lf = ((frame % total) + total) % total;
  const s0 = r.sources[0];
  const outAsp = r.w / r.h;
  const srcAsp = s0 ? (s0.w / s0.h) / outAsp : 1;
  const ns = r.sources.filter((s) => s.uploaded).length;

  const draw = (prog, target, setup) => {
    gl.useProgram(prog.p);
    const L = prog.loc;
    r._bind(2, s0?.uploaded ? s0.tex : r._empty); if (L.u_s0) gl.uniform1i(L.u_s0, 2);
    // gli altri campionatori non servono, ma devono puntare a unità di tipo giusto
    for (const [n, u] of [['u_in', 3], ['u_fb', 3], ['u_s1', 3], ['u_s2', 3], ['u_s3', 3], ['u_st', 3]]) if (L[n]) gl.uniform1i(L[n], u);
    r._bind(3, r._empty);
    r._bind(6, r._emptyArr, 'TEXTURE_2D_ARRAY'); if (L.u_hist) gl.uniform1i(L.u_hist, 6);
    gl.uniform4f(L.u_sAsp, srcAsp, 1, 1, 1);
    gl.uniform1i(L.u_ns, ns);
    gl.uniform2f(L.u_res, sw, sh);
    gl.uniform1f(L.u_seed, clip.seed || 1);
    gl.uniform1f(L.u_T, clip.format.duration);
    gl.uniform1f(L.u_loop, 0);
    setup(L);
    r._draw(prog, target, sw, sh);
  };

  for (const { pass, m } of act) {
    let st = t.st.get(pass.id);
    if (st && (st.w !== sw || st.h !== sh)) { freeState(r, st); st = null; }
    if (!st) { st = newState(r, sw, sh); t.st.set(pass.id, st); }
    const mp = m.mappa;
    const mtex = mp ? mapTex(r, mp.png) : null;
    const ready = !mp || !!mtex;
    const key = keyFor(clip, m, ready);
    if (key !== st.key || lf < st.f) { st.key = key; st.f = -1; }
    const live = !!(mp?.segui && s0?.kind === 'video' && mp.gen.modo !== 'nessuno');
    const gen = mp ? mp.gen : { ...GEN_DEFAULT, modo: 'luce' };
    const genArr = [GEN_MODI.indexOf(gen.modo), gen.soglia, gen.morbidezza, gen.inverti, gen.tinta, gen.ampiezza];
    const setMap = (L) => {
      r._bind(10, mtex || r._empty); if (L.u_map) gl.uniform1i(L.u_map, 10);
      gl.uniform1f(L.u_hasMap, mp && mtex ? 1 : 0);
      gl.uniform1f(L.u_live, live ? 1 : 0);
      gl.uniform1f(L.u_mapCover, ns > 0 ? 1 : 0);
      gl.uniform1fv(L.u_g, new Float32Array(genArr));
    };
    const cont = m.contagio?.on ? m.contagio : null;
    // a 30 fps lo stesso fronte, in secondi, che a 24
    const dtBase = 0.2 * (24 / fps);
    while (st.f < lf) {
      const k = st.f + 1;
      const tk = k / fps;
      if (k === 0) {
        draw(pr.target, st.t[0], (L) => { setMap(L); gl.uniform1f(L.u_t, tk); });
        st.cur = 0;
      } else if (cont) {
        if (live) { const src = st.t[st.cur]; draw(pr.retarget, st.t[1 - st.cur], (L) => { setMap(L); r._bind(9, src.tex); gl.uniform1i(L.u_F, 9); gl.uniform1f(L.u_t, tk); }); st.cur = 1 - st.cur; }
        draw(pr.field, st.field, (L) => { gl.uniform1f(L.u_t, tk); });
        const vals = CONTAGIO.map((d) => contagioValue(cont, d, tk));
        const dt = dtBase * vals[1];
        if (dt > 0) {
          const cArr = new Float32Array(vals);
          for (let i = 0; i < STEPS; i++) {
            const src = st.t[st.cur];
            draw(pr.sim, st.t[1 - st.cur], (L) => {
              r._bind(9, src.tex); gl.uniform1i(L.u_F, 9);
              r._bind(11, st.field.tex); gl.uniform1i(L.u_G, 11);
              gl.uniform1fv(L.u_c, cArr); gl.uniform1f(L.u_dt, dt); gl.uniform1f(L.u_t, tk);
            });
            st.cur = 1 - st.cur;
          }
        }
      } else if (live) {
        draw(pr.target, st.t[st.cur], (L) => { setMap(L); gl.uniform1f(L.u_t, tk); });
      }
      st.f = k;
    }
    const conf = { ...defaultConfine(), ...(m.confine || {}) };
    t.bind.set(pass.id, { tex: st.t[st.cur].tex, q: [fasciaUV(conf.larghezza), conf.carattere, granaFreq(conf.grana), conf.trascina], st });
  }

  // la materia sotto prende ciò che quella sopra lascia, e le sta sotto nella fascia
  for (let i = chain.length - 1; i >= 0; i--) {
    const B = t.bind.get(chain[i].id);
    if (!B || !territoryOf(clip, chain[i])?.contagio?.on) continue;
    let j = i - 1;
    while (j >= 0 && !byId[chain[j].proc]?.materia) j--;
    if (j < 0) continue;
    const A = t.bind.get(chain[j].id);
    if (!A) continue; // la materia sotto copre già tutto il quadro
    const out = A.st.eff[A.tex === A.st.eff[0].tex ? 1 : 0];
    const aTex = A.tex;
    draw(pr.combine, out, (L) => {
      r._bind(9, aTex); gl.uniform1i(L.u_F, 9);
      r._bind(11, B.tex); gl.uniform1i(L.u_G, 11);
      gl.uniform1f(L.u_R, Math.max(2, B.q[0] * sh * 1.6));
      gl.uniform1f(L.u_t, frame / fps);
    });
    A.tex = out.tex;
  }
}

/** Lega il territorio (o la sua assenza) al passaggio che sta per essere disegnato. */
export function bindTerritorio(r, L, pass) {
  const gl = r.gl;
  const b = r._terr?.bind.get(pass.id);
  if (L.u_terr) gl.uniform1f(L.u_terr, b ? 1 : 0);
  r._bind(8, b ? b.tex : r._empty);
  if (L.u_tF) gl.uniform1i(L.u_tF, 8);
  if (b && L.u_tq) gl.uniform4f(L.u_tq, b.q[0], b.q[1], b.q[2], b.q[3]);
}
