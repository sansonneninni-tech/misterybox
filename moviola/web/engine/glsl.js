// Codice GLSL comune a tutti i processi.
// Ogni processo scrive solo una funzione `vec3 fx(vec2 uv)`; qui ci sono gli
// ingressi, il rumore periodico (per i loop chiusi) e la fusione finale.
// `uv` è sulla superficie: con la Macro spenta coincide con lo schermo.

import { PRELUDE_CORPO } from './corpo/glsl.js';

import { TERR_POST } from './territorio-glsl.js';

export const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }`;

export const PRELUDE = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;
uniform sampler2D u_in;      // flusso: uscita del passaggio precedente
uniform sampler2D u_fb;      // uscita di questo passaggio al fotogramma prima
uniform sampler2D u_s0, u_s1, u_s2, u_s3; // sorgenti
uniform sampler2DArray u_hist; // memoria degli ultimi fotogrammi in ingresso
uniform sampler2D u_st;      // stato della simulazione (materie che crescono)
uniform vec2 u_stRes;        // risoluzione dello stato
uniform float u_init;        // 1 al primo passo dopo un azzeramento
uniform float u_step;        // indice del passo di simulazione nel fotogramma
uniform vec4 u_sAsp;         // proporzione sorgente / proporzione uscita
uniform int u_ns;            // quante sorgenti
uniform float u_histN;       // fotogrammi disponibili in memoria
uniform float u_histHead;    // indice dello strato più recente
uniform float u_histCap;     // capienza della memoria
uniform float u_t, u_T, u_loop, u_frame, u_fps, u_seed, u_vmix;
uniform vec2 u_res;
uniform float u_p[8];
uniform float u_mix;
uniform int u_blend;
in vec2 v_uv;
out vec4 o_col;

#define PI 3.14159265359
#define TAU 6.28318530718
#define PX (1.0 / u_res)
#define ASPECT (u_res.x / u_res.y)
// Scala dei dettagli: i pixel si misurano rispetto a un quadro alto 1080,
// così anteprima e render 4K hanno la stessa grana.
#define K1080 (u_res.y / 1080.0)

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec3 hash33(vec3 p3) { p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }

float S(float n) { return u_seed * 0.0137 + n * 17.17; }

// Frequenza temporale: con il loop attivo viene arrotondata perché un numero
// intero di cicli stia nella durata, così l'ultimo fotogramma torna al primo.
float rate(float r) { return u_loop > 0.5 ? max(1.0, floor(u_T * r + 0.5)) / u_T : r; }
float period(float r) { return u_loop > 0.5 ? max(1.0, floor(u_T * r + 0.5)) : 0.0; }
float ztime(float r) { return u_t * rate(r); }
float wrapz(float z, float P) { return P > 0.5 ? mod(z, P) : z; }

// Rumore a gradiente 3D, periodico sull'asse z quando P > 0.
vec3 g3(vec3 i, float P) { i.z = wrapz(i.z, P); return normalize(hash33(i + S(1.0)) * 2.0 - 1.0 + 1e-4); }
float gnoise(vec3 p, float P) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(g3(i + vec3(0,0,0), P), f - vec3(0,0,0));
  float n100 = dot(g3(i + vec3(1,0,0), P), f - vec3(1,0,0));
  float n010 = dot(g3(i + vec3(0,1,0), P), f - vec3(0,1,0));
  float n110 = dot(g3(i + vec3(1,1,0), P), f - vec3(1,1,0));
  float n001 = dot(g3(i + vec3(0,0,1), P), f - vec3(0,0,1));
  float n101 = dot(g3(i + vec3(1,0,1), P), f - vec3(1,0,1));
  float n011 = dot(g3(i + vec3(0,1,1), P), f - vec3(0,1,1));
  float n111 = dot(g3(i + vec3(1,1,1), P), f - vec3(1,1,1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z) * 1.4;
}
// Somma di ottave: ogni ottava ha un periodo intero, il loop resta chiuso.
float fbm(vec2 p, float z, float P, int oct) {
  float a = 0.5, s = 0.0;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * gnoise(vec3(p, z), P);
    p = r * p * 2.03 + 11.7; a *= 0.5;
  }
  return s;
}

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 hue(vec3 c, float h) {
  const vec3 k = vec3(0.57735);
  float a = h * TAU; float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}
// Pigmenti, non neon: tavolozze terrose e sbiadite per evitare l'estetica AI.
vec3 pigment(float x, float tint) {
  vec3 a = vec3(0.52, 0.48, 0.44), b = vec3(0.38, 0.34, 0.30);
  vec3 c = vec3(1.0, 1.0, 1.0), d = vec3(0.0, 0.12, 0.22) + tint;
  return clamp(a + b * cos(TAU * (c * x + d)), 0.0, 1.0);
}

${PRELUDE_CORPO}
vec2 cover(vec2 uv, float r) {
  uv -= 0.5;
  if (r > 1.0) uv.x /= r; else uv.y *= r;
  return uv + 0.5;
}
vec3 SRC(int i, vec2 uv) {
  if (i >= u_ns) return texture(u_in, CAM_S(uv)).rgb;
  uv -= SCD(uv);
  if (i == 0) return texture(u_s0, cover(uv, u_sAsp.x)).rgb;
  if (i == 1) return texture(u_s1, cover(uv, u_sAsp.y)).rgb;
  if (i == 2) return texture(u_s2, cover(uv, u_sAsp.z)).rgb;
  return texture(u_s3, cover(uv, u_sAsp.w)).rgb;
}
vec3 IN(vec2 uv) { return texture(u_in, CAM_S(uv)).rgb; }
vec3 FB(vec2 uv) { return texture(u_fb, CAM_S(uv)).rgb; }
// k fotogrammi fa (0 = adesso). Si ferma al più vecchio disponibile.
vec3 HIST(float k, vec2 uv) {
  if (u_histN < 1.0) return IN(uv);
  k = clamp(floor(k), 0.0, u_histN - 1.0);
  float layer = mod(u_histHead - k + u_histCap, u_histCap);
  return texture(u_hist, vec3(CAM_S(uv), layer)).rgb;
}
// Stato della simulazione: rgba liberi, in virgola mobile.
vec4 ST(vec2 uv) { return texture(u_st, uv); }
#define SPX (1.0 / u_stRes)
vec3 HISTF(float k, vec2 uv) { // interpolato tra due fotogrammi
  float a = floor(k);
  return mix(HIST(a, uv), HIST(a + 1.0, uv), fract(k));
}
`;

export const POSTLUDE = `
vec3 blendc(vec3 a, vec3 b, int m) {
  if (m == 1) return 1.0 - (1.0 - a) * (1.0 - b);               // schermo
  if (m == 2) return a + b;                                     // somma
  if (m == 3) return a * b;                                     // moltiplica
  if (m == 4) return abs(a - b);                                // differenza
  if (m == 5) return mix(2.0 * a * b, 1.0 - 2.0 * (1.0 - a) * (1.0 - b), step(0.5, a)); // sovrapponi
  if (m == 6) return max(a, b);                                 // schiarisci
  if (m == 7) return min(a, b);                                 // scurisci
  return b;                                                     // normale
}
${TERR_POST}
void main() {
  // territorio: dove sta la materia e come si mescola sul confine (territorio-glsl.js)
  vec3 tr = u_terr > 0.5 ? trrTerritorio(v_uv) : vec3(1.0, 0.0, 0.0);
  vec4 b4 = texture(u_in, v_uv - tr.yz * 0.5);
  vec3 base = b4.rgb;
  // la materia lavora sulla superficie: con la Macro spenta CAM_W è l'identità
  vec3 fxc = fx(CAM_W(v_uv + tr.yz));
  float k = u_mix * tr.x;
  vec3 c = mix(base, blendc(base, fxc, u_blend), k);
  // alfa: il rilievo che una materia dichiara (FX_H), altrimenti passa com'è
  float a = FX_H >= 0.0 ? mix(b4.a, 0.02 + 0.98 * clamp(FX_H, 0.0, 1.0), k) : b4.a;
  o_col = vec4(max(c, 0.0), a);
}`;

// Passaggi di servizio
export const COPY_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex; uniform vec2 u_scale; uniform float u_flip;
in vec2 v_uv; out vec4 o;
void main() {
  vec2 uv = (v_uv - 0.5) / u_scale + 0.5;
  if (u_flip > 0.5) uv.y = 1.0 - uv.y;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }
  o = vec4(clamp(texture(u_tex, uv).rgb, 0.0, 1.0), 1.0);
}`;

export const BASE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex; uniform float u_r; uniform float u_has;
in vec2 v_uv; out vec4 o;
vec2 cover(vec2 uv, float r) { uv -= 0.5; if (r > 1.0) uv.x /= r; else uv.y *= r; return uv + 0.5; }
void main() { o = u_has > 0.5 ? vec4(texture(u_tex, cover(v_uv, u_r)).rgb, 0.0) : vec4(0.0); }`;
