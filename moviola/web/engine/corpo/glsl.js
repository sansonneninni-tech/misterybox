// GLSL del corpo: camera macro, campo scolpito, impronta, microdettaglio e
// messa a fuoco. Tutto è spento (identità) finché Scolpire e Macro non servono.

/**
 * Entra nel PRELUDE comune a tutti i processi, prima di SRC/IN.
 * - Le materie lavorano in coordinate della superficie (il "mondo"); IN, FB e
 *   HIST leggono i buffer dello schermo passando dalla camera.
 * - SCULPT(uv) è il campo scolpito: xy spostamento (uv), z altezza (0 piano,
 *   negativo scavato, positivo rialzato), w velocità verticale dei fluidi.
 *   Le materie che vogliono rispondere a modo loro lo leggono; tutte le altre
 *   lo ricevono già: la foto arriva spostata e l'impronta viene illuminata.
 * - FX_H: una materia che conosce il suo rilievo lo scrive qui (0..1, dentro
 *   fx) e la Macro lo usa per la messa a fuoco al posto della stima.
 */
export const PRELUDE_CORPO = `
uniform vec4 u_cam;      // centro x, y nel mondo, ingrandimento, rotazione
uniform vec4 u_camP;     // parallasse x, y (uv schermo per unità di rilievo), rilievo a fuoco, accesa
uniform sampler2D u_rl;  // rilievo stimato del mondo (r), per la parallasse
uniform sampler2D u_sc;  // campo scolpito, nel mondo
uniform float u_scOn;    // 1 se ci sono gesti
float FX_H = -1.0;
vec2 CAM_S(vec2 w) {     // mondo -> schermo
  if (u_camP.w < 0.5) return w;
  vec2 a = vec2(ASPECT, 1.0);
  vec2 s = 0.5 + (rot(-u_cam.w) * ((w - u_cam.xy) * a)) * u_cam.z / a;
  return s + u_camP.xy * (texture(u_rl, w).r - u_camP.z);
}
vec2 CAM_W(vec2 s) {     // schermo -> mondo, con la parallasse risolta per approssimazioni
  if (u_camP.w < 0.5) return s;
  vec2 a = vec2(ASPECT, 1.0);
  vec2 w = u_cam.xy + (rot(u_cam.w) * ((s - 0.5) * a)) / u_cam.z / a;
  for (int i = 0; i < 3; i++) {
    vec2 s0 = s - u_camP.xy * (texture(u_rl, w).r - u_camP.z);
    w = u_cam.xy + (rot(u_cam.w) * ((s0 - 0.5) * a)) / u_cam.z / a;
  }
  return w;
}
vec4 SCULPT(vec2 uv) { return u_scOn > 0.5 ? texture(u_sc, uv) : vec4(0.0); }
vec2 SCD(vec2 uv) { return u_scOn > 0.5 ? texture(u_sc, uv).xy : vec2(0.0); }
`;

const HASH = `
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}`;

export const MAXSEG = 24;

/**
 * Un passo del campo scolpito (1/120 s). Prima il trasporto (la materia
 * segue le dita), poi il carattere (ritorno elastico, scorrimento dei
 * fluidi), poi le impronte che non dipendono da quanto spesso si campiona il
 * dito: scavare porta a una profondità, non la accumula.
 */
export const FIELD_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_prev;
uniform vec2 u_res;
uniform float u_relax;
uniform vec4 u_char;     // tenuta, ritorno (s), fluido, dt
uniform float u_seed;
uniform int u_n;
uniform vec4 u_a[${MAXSEG}];   // ax, ay, bx, by (uv)
uniform vec4 u_b[${MAXSEG}];   // raggio (altezze del quadro), forza, strumento, durata (s)
in vec2 v_uv; out vec4 o;
${HASH}
float kern(float d) { float x = clamp(1.0 - d * d, 0.0, 1.0); return x * x; }
void seg(int i, vec2 p, vec2 A, out vec2 c, out float d, out vec2 mv) {
  vec4 a = u_a[i];
  vec2 pa = a.xy * A, pb = a.zw * A, ab = pb - pa;
  float L2 = dot(ab, ab);
  float hh = L2 > 1e-12 ? clamp(dot(p - pa, ab) / L2, 0.0, 1.0) : 1.0;
  c = pa + ab * hh;
  d = length(p - c) / u_b[i].x;
  mv = a.zw - a.xy;
}
void main() {
  vec2 A = vec2(u_res.x / u_res.y, 1.0);
  vec2 p = v_uv * A;
  vec2 px = 1.0 / u_res;
  // 1) trasporto
  vec2 del = vec2(0.0);
  for (int i = 0; i < ${MAXSEG}; i++) {
    if (i >= u_n) break;
    vec2 c, mv; float d;
    seg(i, p, A, c, d, mv);
    if (d >= 1.0) continue;
    vec4 b = u_b[i];
    float f = kern(d) * b.y;
    int tool = int(b.z + 0.5);
    float dur = b.w;
    if (tool == 0) del += mv * f * 0.92;
    else if (tool == 2) {
      vec2 r = p - c;
      del += vec2(-r.y, r.x) / A * f * min(1.0, dur * 6.0) * 1.5 + mv * f * 0.45;
    }
    else if (tool == 4) del += (c - p) / A * f * min(1.0, dur * 3.0) * 0.55;
    else if (tool == 1) {
      vec2 r = p - c; float lr = max(length(r), 1e-5);
      del += (r / lr) / A * b.x * 0.16 * f * (1.0 - d) * min(1.0, dur * 4.0 + length(mv * A) / b.x);
    }
  }
  vec4 s = texture(u_prev, v_uv - del);
  s.xy += del;
  vec4 nb = (texture(u_prev, v_uv + vec2(px.x, 0.0)) + texture(u_prev, v_uv - vec2(px.x, 0.0))
           + texture(u_prev, v_uv + vec2(0.0, px.y)) + texture(u_prev, v_uv - vec2(0.0, px.y))) * 0.25;
  // 2) il carattere della materia
  if (u_relax > 0.5) {
    float P = u_char.x, tau = max(0.05, u_char.y), F = u_char.z, dt = u_char.w;
    s.z = mix(s.z, nb.z, F * 0.3);
    s.xy = mix(s.xy, nb.xy, F * 0.12);
    float ret = (1.0 - P) * dt / tau;
    s.xy -= s.xy * ret;
    float z1 = s.z - s.z * ret;
    float om = 2.4 / tau, ze = 0.32;
    float w1 = s.w + (-om * om * (1.0 - P) * s.z - 2.0 * ze * om * s.w) * dt;
    float z2 = s.z + w1 * dt;
    s.z = mix(z1, z2, F);
    s.w = w1 * F;
  }
  // 3) le impronte
  for (int i = 0; i < ${MAXSEG}; i++) {
    if (i >= u_n) break;
    vec2 c, mv; float d;
    seg(i, p, A, c, d, mv);
    if (d >= 1.6) continue;
    vec4 b = u_b[i];
    float k = b.y, dur = b.w;
    int tool = int(b.z + 0.5);
    float f = kern(d);
    if (tool == 1) {
      float tgt = -k * f * 0.95;
      if (tgt < s.z) s.z = tgt;
      float rim = 0.3 * k * smoothstep(0.75, 1.05, d) * (1.0 - smoothstep(1.05, 1.55, d));
      if (s.z < rim && s.z > -0.04) s.z = mix(s.z, rim, 0.5);
    } else if (tool == 0) {
      float tgt = -k * f * 0.25;
      if (tgt < s.z) s.z = mix(s.z, tgt, 0.5);
      vec2 dir = mv * A; float ld = length(dir);
      if (ld > 1e-6) {
        float fr = smoothstep(0.0, 0.5, dot(p - c, dir / ld) / b.x) * (1.0 - smoothstep(0.7, 1.5, d));
        s.z = min(s.z + 1.6 * k * fr * ld / b.x, max(s.z, 1.1 * k));
      }
    } else if (tool == 2) {
      float g = vnoise(p * 9.0 / b.x + u_seed) - 0.5;
      s.z += g * k * f * min(1.0, dur * 5.0) * 0.9;
    } else if (tool == 3) {
      float r = clamp(f * k * dur * 7.0, 0.0, 1.0);
      s = mix(s, nb, r);
      s.xyz *= 1.0 - r * 0.45;
      s.w *= 1.0 - r;
    } else if (tool == 4) {
      float tgt = 0.9 * k * kern(d * 0.85);
      if (tgt > s.z) s.z += (tgt - s.z) * clamp(f * dur * 4.0, 0.0, 1.0);
    }
  }
  float dl = length(s.xy * A);
  if (dl > 0.3) s.xy *= 0.3 / dl;
  s.z = clamp(s.z, -2.0, 2.0);
  s.w = clamp(s.w, -40.0, 40.0);
  o = s;
}`;

/** Rilievo stimato del mondo: la luce della foto ammorbidita, più lo scolpito. */
export const RELIEF_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex; uniform float u_r; uniform float u_has;
uniform sampler2D u_sc; uniform float u_scOn; uniform float u_scK;
uniform vec2 u_res;
in vec2 v_uv; out vec4 o;
vec2 cover(vec2 uv, float r) { uv -= 0.5; if (r > 1.0) uv.x /= r; else uv.y *= r; return uv + 0.5; }
float L(vec2 w) { return dot(texture(u_tex, cover(w, u_r)).rgb, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
  vec4 s = u_scOn > 0.5 ? texture(u_sc, v_uv) : vec4(0.0);
  vec2 w = v_uv - s.xy;
  float h = 0.5;
  if (u_has > 0.5) {
    vec2 px = 1.6 / u_res;
    float acc = L(w) * 2.0, n = 2.0;
    for (int i = 0; i < 12; i++) {
      float a = float(i) * 0.5236, r = (i % 2 == 0) ? 1.0 : 2.1;
      acc += L(w + vec2(cos(a), sin(a)) * px * r); n += 1.0;
    }
    h = acc / n;
  }
  o = vec4(clamp(h + s.z * 0.18 * u_scK, -0.5, 1.5), 0.0, 0.0, 1.0);
}`;

/** La base con la camera e lo spostamento: la foto vista dalla Macro e spinta dalle dita. */
export const BASE_CORPO = `
uniform sampler2D u_tex; uniform float u_r; uniform float u_has;
void main() {
  vec2 W = CAM_W(v_uv);
  W -= SCD(W);
  o_col = u_has > 0.5 ? vec4(texture(u_tex, cover(W, u_r)).rgb, 0.0) : vec4(0.0);
}`;

const BICUBIC = `
vec4 bic(sampler2D t, vec2 uv) {
  vec2 res = vec2(textureSize(t, 0));
  vec2 st = uv * res - 0.5, i = floor(st), f = st - i;
  vec2 w0 = (1.0 - f) * (1.0 - f) * (1.0 - f) / 6.0;
  vec2 w1 = (3.0 * f * f * f - 6.0 * f * f + 4.0) / 6.0;
  vec2 w2 = (-3.0 * f * f * f + 3.0 * f * f + 3.0 * f + 1.0) / 6.0;
  vec2 w3 = f * f * f / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 h0 = (i - 1.0 + w1 / g0 + 0.5) / res, h1 = (i + 1.0 + w3 / g1 + 0.5) / res;
  return g0.y * (g0.x * texture(t, h0) + g1.x * texture(t, vec2(h1.x, h0.y)))
       + g1.y * (g0.x * texture(t, vec2(h0.x, h1.y)) + g1.x * texture(t, h1));
}`;

/**
 * L'impronta: il campo scolpito diventa forma. Le materie solide fanno ombra
 * in luce radente e scuriscono nel fondo; le fluide piegano la luce che le
 * attraversa. Opaco, senza lucidi: dove il campo è piano non cambia nulla.
 */
export const IMPRONTA = BICUBIC + `
uniform vec4 u_imp;   // rilievo, luce (radianti), fluido, -
void main() {
  vec4 src = texture(u_in, v_uv);
  vec2 W = CAM_W(v_uv);
  vec2 fr = vec2(textureSize(u_sc, 0));
  vec2 ox = vec2(1.0 / fr.x, 0.0), oy = vec2(0.0, 1.0 / fr.y);
  vec4 s = bic(u_sc, W);
  float zl = bic(u_sc, W - ox).z, zr = bic(u_sc, W + ox).z;
  float zd = bic(u_sc, W - oy).z, zu = bic(u_sc, W + oy).z;
  vec2 g = vec2((zr - zl) / (2.0 * ox.x * ASPECT), (zu - zd) / (2.0 * oy.y));
  float ril = u_imp.x, F = u_imp.z;
  vec2 L2 = -vec2(cos(u_imp.y), sin(u_imp.y));
  vec3 Ld = normalize(vec3(L2 * 0.9, 0.44));
  vec3 n = normalize(vec3(-g * 0.035 * ril, 1.0));
  float lam = dot(n, Ld) - Ld.z;
  // solido: luce radente e fondo in ombra
  float sh = 1.0 + lam * 1.2;
  // l'ombra si addolcisce: un solco resta materia in ombra, mai un tratto nero
  sh = sh > 1.0 ? 1.0 + (sh - 1.0) * 0.6 : 1.0 - 0.55 * (1.0 - exp(-(1.0 - sh) * 1.6));
  float ao = 1.0 - 0.18 * smoothstep(0.0, 1.1, -s.z * ril) + 0.05 * smoothstep(0.0, 0.8, s.z * ril);
  vec3 cS = src.rgb * sh * ao;
  // fluido: la superficie piega quello che c'è sotto
  float zm = u_camP.w > 0.5 ? u_cam.z : 1.0;
  vec3 cF = texture(u_in, v_uv - g * 0.0022 * ril * zm).rgb;
  cF *= (1.0 - 0.1 * clamp(-s.z * ril, 0.0, 1.0)) * (1.0 + lam * 0.35);
  o_col = vec4(max(mix(cS, cF, F), 0.0), src.a);
}`;

/**
 * Microdettaglio e profondità. Avvicinandosi compaiono nuovi livelli di
 * struttura, generati e ancorati alla superficie (coordinate del mondo in
 * pixel di un quadro alto 1080): ogni ottava entra quando è abbastanza grande
 * sullo schermo. Scrive nel canale alfa il raggio dello sfocato.
 */
export const MICRO = BICUBIC + `
uniform vec4 u_mic;    // quantità, tipo (1 grana, 2 pori, 3 fibre, 4 microbolle, 5 cristalli), ingrandimento, luce (radianti)
uniform vec4 u_dof;    // piano di fuoco, raggio massimo (px a 1080), inclinazione, rilievo
uniform vec2 u_dofDir;
${HASH.replace('float hash12', 'float hsh').replace(/hash12\(/g, 'hsh(')}
vec2 h22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
// Voronoi: x = distanza dal seme, y = distanza dal bordo, zw = cella
vec4 vor(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0; vec2 c1 = vec2(0.0), r1 = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = h22(i + g + S(51.0));
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; c1 = i + g; r1 = r; } else if (d < d2) d2 = d;
  }
  return vec4(sqrt(d1), sqrt(d2) - sqrt(d1), c1);
}
// altezza (x) e tinta (y) di un'ottava di microdettaglio
vec2 micro(int tp, vec2 q, float sd, int oct) {
  if (tp == 1) {
    float n = vnoise(q + sd) * 0.65 + vnoise(q * 2.3 + sd + 7.0) * 0.35;
    return vec2(n - 0.5, 1.0 + (n - 0.5) * 0.12);
  }
  if (tp == 2) {
    // pori: solo nelle ottave fini; quelle larghe sono la pelle intorno
    float n = vnoise(q * 1.7 + sd) - 0.5;
    if (oct < 2) return vec2(n * 0.5, 1.0 + n * 0.06);
    vec4 v = vor(q * 0.6);
    float pres = step(hsh(v.zw + sd), 0.3);
    float r = 0.1 + 0.16 * hsh(v.zw + sd + 3.0);
    float pit = pres * smoothstep(r, r * 0.3, v.x);
    return vec2(-pit * 0.7 + n * 0.2, 1.0 - pit * 0.2);
  }
  if (tp == 3) {
    float a = (vnoise(q * 0.045 + sd) - 0.5) * 3.2 + sd;
    vec2 r = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
    float n = vnoise(vec2(r.x * 0.16, r.y * 1.7) + sd) * 0.7 + vnoise(vec2(r.x * 0.3, r.y * 3.6) + sd + 5.0) * 0.3;
    return vec2((n - 0.5) * 1.2, 1.0 + (n - 0.5) * 0.18);
  }
  if (tp == 4) {
    vec4 v = vor(q * 0.5);
    float pres = step(hsh(v.zw + sd), 0.5);
    float r = 0.16 + 0.24 * hsh(v.zw + sd + 9.0);
    float x = v.x / r;
    float dome = pres * (x < 1.0 ? sqrt(1.0 - x * x) : 0.0);
    float rim = pres * smoothstep(0.78, 0.95, x) * (1.0 - smoothstep(0.95, 1.08, x));
    return vec2(dome * 0.7, 1.0 + dome * 0.05 - rim * 0.32);
  }
  vec4 v = vor(q * 0.35);
  float tilt = hsh(v.zw + sd) - 0.5;
  float edge = 1.0 - smoothstep(0.0, 0.06, v.y);
  float n = (vnoise(q * 0.35 + sd) - 0.5);
  return vec2(tilt * 1.4 + n * 0.3 - edge * 0.5, 1.0 + tilt * 0.16 - edge * 0.25);
}
void main() {
  vec4 src = texture(u_in, v_uv);
  vec2 W = CAM_W(v_uv);
  vec3 col = src.rgb;
  float z = max(u_mic.z, 1.0);
  int tp = int(u_mic.y + 0.5);
  float amt = u_mic.x * smoothstep(1.15, 2.6, z);
  if (amt > 0.001 && tp > 0) {
    vec2 P = W * vec2(1080.0 * ASPECT, 1080.0);  // pixel della superficie a 1080
    float spx = 1080.0 / (u_res.y * z);          // un pixel dello schermo, in pixel della superficie
    vec2 g = vec2(0.0); float tint = 1.0, wsum = 0.0;
    float sc = 7.0;
    for (int i = 0; i < 7; i++) {
      float onS = sc / spx;                       // grandezza dell'ottava sullo schermo, in pixel
      float w = smoothstep(2.0, 5.5, onS) * (1.0 - smoothstep(60.0, 160.0, onS)) * pow(0.78, float(i));
      if (w > 0.002) {
        float sd = float(i) * 13.7 + S(60.0);
        vec2 q = P / sc;
        float e = 0.35;
        vec2 m0 = micro(tp, q, sd, i);
        float hx = micro(tp, q + vec2(e, 0.0), sd, i).x, hy = micro(tp, q + vec2(0.0, e), sd, i).x;
        g += vec2(hx - m0.x, hy - m0.x) / e * w;
        tint *= mix(1.0, m0.y, w);
        wsum += w;
      }
      sc *= 0.5;
    }
    vec2 L2 = -vec2(cos(u_mic.w), sin(u_mic.w));
    vec3 Ld = normalize(vec3(L2 * 0.9, 0.5));
    vec3 n = normalize(vec3(-g * 0.55 * amt, 1.0));
    float sh = 1.0 + (dot(n, Ld) - Ld.z) * 1.1;
    sh = sh > 1.0 ? 1.0 + (sh - 1.0) * 0.55 : max(sh, 0.0);
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float k = 0.55 + 0.45 * smoothstep(0.03, 0.35, l);
    col *= mix(1.0, sh * mix(1.0, tint, min(amt, 1.0)), k);
  }
  // profondità: il rilievo esposto dalla materia, se c'è, altrimenti la stima,
  // misurata dentro la finestra guardata: il piano di fuoco va dal punto più
  // basso (0) al più alto (1) di quello che si vede, a ogni ingrandimento
  float H = bic(u_rl, W).r;
  if (src.a > 0.01) H = mix(H, (src.a - 0.02) / 0.98, 0.85);
  float lo = 9.0, hi = -9.0;
  for (int y = 0; y < 3; y++) for (int x = 0; x < 3; x++) {
    float hh = texture(u_rl, CAM_W(vec2(0.15 + 0.35 * float(x), 0.15 + 0.35 * float(y)))).r;
    lo = min(lo, hh); hi = max(hi, hh);
  }
  float mid = (lo + hi) * 0.5, rng = max(hi - lo, 0.12);
  float d = (H - mid) / rng + 0.5;
  float plane = u_dof.x + u_dof.z * dot(v_uv - 0.5, u_dofDir);
  float coc = u_dof.y * smoothstep(0.0, 0.55, abs(d - plane) * (0.4 + 0.6 * u_dof.w));
  o_col = vec4(max(col, 0.0), coc / 64.0);
}`;

/**
 * Messa a fuoco: sfocato raccolto da ogni campione il cui disco ci raggiunge,
 * pesato per l'area (niente lumi che si gonfiano), con un bordo morbido che
 * ondeggia appena: un diaframma organico, non un poligono.
 */
export const FUOCO = `
uniform float u_cocMax;   // px a 1080
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  vec4 c0 = texture(u_in, v_uv);
  float k = u_res.y / 1080.0;
  float R = u_cocMax * k;
  float coc0 = c0.a * 64.0 * k;
  if (R < 0.6) { o_col = vec4(c0.rgb, 1.0); return; }
  float jr = ign(gl_FragCoord.xy) * TAU;
  float w0 = 1.0 / max(coc0 * coc0, 1.0);
  vec3 acc = c0.rgb * w0; float ws = w0;
  const int N = 80;
  for (int i = 0; i < N; i++) {
    float fi = float(i) + 0.5;
    float rr = sqrt(fi / float(N));
    float th = fi * 2.39996323 + jr;
    float shape = 1.0 + 0.06 * sin(3.0 * th + S(70.0)) + 0.035 * sin(5.0 * th + S(71.0));
    float dist = rr * R * shape;
    vec2 o = vec2(cos(th), sin(th)) * dist;
    vec4 cs = texture(u_in, v_uv + o / u_res);
    float cocS = cs.a * 64.0 * k;
    float w = (1.0 - smoothstep(cocS * 0.6, cocS * 1.05 + 1.0, dist)) / max(cocS * cocS, 1.0);
    acc += cs.rgb * w; ws += w;
  }
  o_col = vec4(acc / ws, 1.0);
}`;
