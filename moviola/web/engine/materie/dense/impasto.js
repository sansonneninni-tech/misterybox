// Materia densa: impasto. La foto diventa colore a olio steso spesso sulla
// tela, e delle spatole invisibili continuano a lavorarlo.
//
// La pasta è una sostanza con soglia (un fluido di Bingham): sotto una certa
// spinta non si muove affatto, sopra scorre. Quindi non cola e non si
// rilassa: resta dove la spatola la lascia. La simulazione tiene per ogni
// punto lo spessore del colore e il colore stesso, e li sposta solo dove passa
// una lama, conservando la quantità di pasta:
//   - la lama rasa la pasta fino a un livello: quella sopra viene spinta
//     avanti e si accumula in un cordone davanti al filo, che viaggia con la
//     lama e resta come cresta quando la lama si alza;
//   - ai due capi della lama la pasta deborda di lato: i bordi rialzati;
//   - il filo della lama ha piccole irregolarità: righe parallele nel verso
//     del gesto;
//   - la pasta in fondo alla lama resta un poco indietro: il colore caricato
//     si stende sottile dietro la lama, a strisce, e si mescola solo in parte
//     (ogni riga porta il suo colore: striature, non sfumature).
// I gesti seguono le forme della foto (la lama scorre lungo i contorni).
// Il rilievo si disegna in luce radente, con le ombre portate delle creste.
//
// Stato (una texture a 32 bit, lato lungo 768): x = spessore della pasta in
// pixel di un quadro alto 1080, yzw = colore. L'ultima riga tiene le spatole:
// ognuna è calcolata una volta per passo in due texel, e tutti gli altri punti
// la leggono da lì invece di rifare il conto.
import { P } from '../comune.js';

const COMUNE = `
#define IM_STEPS 8.0
ivec2 imSz() { return ivec2(u_stRes); }
// l'ultima riga dello stato non è pasta: tiene le spatole (vedi imKnife)
vec4 imF(ivec2 c) { return texelFetch(u_st, clamp(c, ivec2(0), imSz() - ivec2(1, 2)), 0); }
vec4 imL(vec2 lc) {
  vec2 q = lc - 0.5; ivec2 i = ivec2(floor(q)); vec2 f = q - floor(q);
  return mix(mix(imF(i), imF(i + ivec2(1, 0)), f.x), mix(imF(i + ivec2(0, 1)), imF(i + ivec2(1, 1)), f.x), f.y);
}
// spessore della pasta: B-spline cubica, valore e pendenza (per texel)
vec3 imBS(vec2 lc) {
  vec2 q = lc - 0.5;
  vec2 i = floor(q), f = q - i;
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0, w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0, w3 = f3 / 6.0;
  vec2 d0 = (-3.0 + 6.0 * f - 3.0 * f2) / 6.0, d1 = (-12.0 * f + 9.0 * f2) / 6.0;
  vec2 d2 = (3.0 + 6.0 * f - 9.0 * f2) / 6.0, d3 = 3.0 * f2 / 6.0;
  float wx[4] = float[4](w0.x, w1.x, w2.x, w3.x), wy[4] = float[4](w0.y, w1.y, w2.y, w3.y);
  float dx[4] = float[4](d0.x, d1.x, d2.x, d3.x), dy[4] = float[4](d0.y, d1.y, d2.y, d3.y);
  ivec2 b = ivec2(i) - 1;
  vec3 r = vec3(0.0);
  for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) {
    float v = imF(b + ivec2(x, y)).x;
    r += v * vec3(wx[x] * wy[y], dx[x] * wy[y], wx[x] * dy[y]);
  }
  return r;
}
// La spatola k al tempo t (secondi): centro del filo p, direzione del gesto d,
// velocità V (altezze di quadro al secondo), mezza larghezza della lama, quanto
// preme (0 sollevata, 1 a contatto). Tutto in coordinate del quadro centrate,
// x scalato per la proporzione.
float imDur() { return 1.9 / max(velocita, 0.02); }
void imKnifeAt(float k, float t, out vec2 p, out vec2 d, out float hw, out float con, out float f) {
  float tt = t / imDur() + k * 0.618 + 0.23;
  float n = floor(tt); f = tt - n;
  vec3 h = hash33(vec3(n * 1.37 + 3.0, k * 7.1 + 1.0, 5.0) + S(31.0));
  vec3 h2 = hash33(vec3(n * 2.11 + 9.0, k * 3.7 + 4.0, 2.0) + S(32.0));
  vec2 a = vec2(ASPECT, 1.0);
  vec2 a0 = (h.xy - 0.5) * a * 0.86;
  // la lama scorre lungo i contorni della foto, dove ce ne sono
  vec2 uv0 = a0 / a + 0.5;
  float r = 0.035;
  float gx = luma(IN(uv0 + vec2(r / ASPECT, 0.0))) - luma(IN(uv0 - vec2(r / ASPECT, 0.0)));
  float gy = luma(IN(uv0 + vec2(0.0, r))) - luma(IN(uv0 - vec2(0.0, r)));
  float ang = h.z * TAU;
  if (length(vec2(gx, gy)) > 0.04) ang = atan(gx, -gy) + (h2.x - 0.5) * 0.7 + (h2.y < 0.5 ? PI : 0.0);
  float L = (0.2 + 0.3 * h2.z) * (0.7 + 0.6 * corsa);
  hw = 0.5 * larghezza * (0.75 + 0.5 * h2.y);
  // la lama arriva, preme, corre, si alza
  float s = smoothstep(0.08, 0.86, f);
  s = s * s * (3.0 - 2.0 * s);
  float bend = (h2.x - 0.5) * 1.1;
  float an = ang + bend * (s - 0.5);
  d = vec2(cos(an), sin(an));
  // la traccia è un arco: il centro avanza lungo la direzione che gira
  float an0 = ang - bend * 0.5;
  vec2 d0 = vec2(cos(an0), sin(an0));
  p = a0 - d0 * L * 0.5 + (abs(bend) > 1e-3 ? (vec2(sin(an) - sin(an0), cos(an0) - cos(an)) / bend * L) : d0 * L * s);
  con = smoothstep(0.02, 0.08, f) * (1.0 - smoothstep(0.86, 0.93, f));
}
`;

export const MATERIA = {
  id: 'impasto', code: 'Im', name: 'Impasto', family: 'dense', ref: 'Auerbach, Kossoff, de Staël: il colore a spatola',
  about: 'La foto diventa colore a olio steso spesso sulla tela. Spatole invisibili lo lavorano lungo le forme dell’immagine: rasano la pasta, la spingono in cordoni davanti alla lama e la fanno debordare ai lati; i colori si trascinano a strisce e si mescolano solo in parte. La pasta non cola: resta dove la lama la lascia, con le creste che prendono la luce radente.',
  steps: 8, simLong: 768, simF32: true, noloop: true,
  params: [
    P('materia', 'Materia', 0, 1, 1, 0.2),
    P('spessore', 'Spessore della pasta', 0.2, 2, 1, 0.3),
    P('spatole', 'Spatole al lavoro', 1, 4, 3, 0, { step: 1 }),
    P('larghezza', 'Larghezza della lama', 0.04, 0.4, 0.16, 0.2),
    P('corsa', 'Lunghezza del gesto', 0, 1, 0.5, 0.2),
    P('pressione', 'Quanto rasa la lama', 0, 1, 0.4, 0.3),
    P('trascina', 'Colore trascinato', 0, 1, 0.35, 0.3),
    P('velocita', 'Velocità', 0.05, 2, 0.6, 0.2),
    P('luce', 'Direzione delle ombre', 0, 360, 135, 0, { step: 1 }),
  ],
  sim: COMUNE + `
// La prima stesura: la foto è già dipinta a spatola. Ogni cella di una griglia
// sfalsata porta un colpo di lama orientato lungo i contorni della foto; i
// colpi si sovrappongono e vince l'ultimo dato. Ognuno ha un piano rasato,
// righe sottili nel verso del gesto, un cordone dove la lama si è fermata e
// bordi appena rialzati; il colore è quello della foto trascinato lungo il colpo.
vec4 imPrima(vec2 uv) {
  vec2 a = vec2(ASPECT, 1.0);
  vec2 X = (uv - 0.5) * a;
  float G = 0.06 + 0.3 * larghezza;
  vec2 gc = floor(X / G);
  float best = -1.0; vec4 res = vec4(0.0);
  float T = spessore * 7.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 ci = gc + vec2(float(i), float(j));
    vec3 h = hash33(vec3(ci, 11.0) + S(37.0));
    vec2 cen = (ci + 0.5 + (h.xy - 0.5) * 0.9) * G;
    vec2 cu = cen / a + 0.5;
    float r = 0.6 * G;
    float gx = luma(IN(cu + vec2(r / ASPECT, 0.0))) - luma(IN(cu - vec2(r / ASPECT, 0.0)));
    float gy = luma(IN(cu + vec2(0.0, r))) - luma(IN(cu - vec2(0.0, r)));
    float ang = h.z * TAU;
    if (length(vec2(gx, gy)) > 0.03) ang = atan(gx, -gy) + (h.x - 0.5) * 0.5;
    vec2 d = vec2(cos(ang), sin(ang)), pe = vec2(-d.y, d.x);
    vec2 q = X - cen;
    float u = dot(q, d), v = dot(q, pe);
    float L = G * (1.5 + 0.9 * h.y), W = G * (0.75 + 0.35 * h.x);
    // la lama si scarica lungo il colpo: il colpo si stringe verso la fine
    float un0 = u / (0.5 * L);
    W *= 1.0 - 0.3 * (un0 * 0.5 + 0.5);
    float vn0 = v / (0.5 * W);
    // contorno arrotondato e un poco sfrangiato
    float fr = 0.06 * (hash12(vec2(floor(u / 0.004), ci.x * 7.0 + ci.y) + S(39.0)) - 0.5);
    if (pow(abs(un0), 4.0) + pow(abs(vn0), 6.0) > 1.0 + fr) continue;
    float ord = hash12(ci * 1.3 + S(38.0));
    if (ord < best) continue;
    best = ord;
    // colore: la foto lungo il colpo, mescolata solo per righe
    vec3 cs = vec3(0.0);
    for (int k = 0; k < 5; k++) {
      float uk = -0.5 * L + (float(k) + 0.5) / 5.0 * L * 0.8;
      cs += IN((cen + d * mix(uk, u, 0.35) + pe * v) / a + 0.5);
    }
    cs = mix(cs / 5.0, IN(uv), 0.45);
    float un = u / (0.5 * L), vn = v / (0.5 * W);
    float nick = mix(hash12(vec2(floor((v + 1.0) / 0.011), ord * 91.0)), hash12(vec2(floor((v + 1.0) / 0.011) + 1.0, ord * 91.0)), smoothstep(0.3, 0.7, fract((v + 1.0) / 0.011)));
    vn = vn0;
    float plate = T * (0.75 + 0.2 * h.y + 0.14 * nick) + T * 0.15 * un;
    cs *= 0.94 + 0.12 * nick;
    float lip = (h.z < 0.6 ? T * (0.5 + 0.9 * h.x) : 0.0) * exp(-pow((un - 0.8) / 0.14, 2.0));
    float side = T * 0.22 * smoothstep(0.55, 0.95, abs(vn));
    res = vec4(plate + lip + side, cs);
  }
  if (best < 0.0) res = vec4(T * 0.7, IN(uv));
  return res;
}
// quanto e dove si muove la pasta di una cella: x = parte mobile (sopra il
// livello della lama), yz = spostamento in celle in questo passo
vec3 imMove(ivec2 c, float h, float t, float dt) {
  vec2 sz = vec2(imSz());
  vec2 X = ((vec2(c) + 0.5) / sz - 0.5) * vec2(ASPECT, 1.0);
  float cell = 1.0 / sz.y;
  vec2 vel = vec2(0.0); float lev = 1e9;
  int nk = int(spatole + 0.5);
  for (int k = 0; k < 4; k++) {
    if (k >= nk) break;
    vec4 ka = texelFetch(u_st, ivec2(2 * k, imSz().y - 1), 0);
    vec4 kb = texelFetch(u_st, ivec2(2 * k + 1, imSz().y - 1), 0);
    float con = ka.w;
    if (con < 0.01) continue;
    vec2 p = ka.xy, d = vec2(cos(ka.z), sin(ka.z)), V = kb.xy;
    float hw = kb.z;
    vec2 q = X - p;
    float u = dot(q, d), v = dot(q, vec2(-d.y, d.x));
    float dz = 0.012 + 0.006 * larghezza;
    if (u < -dz - 2.0 * cell || u > 1.5 * cell || abs(v) > hw + 2.0 * cell) continue;
    float ins = smoothstep(-dz - 2.0 * cell, -dz, u) * (1.0 - smoothstep(-0.5 * cell, 1.5 * cell, u))
              * (1.0 - smoothstep(hw - 4.0 * cell, hw + 1.5 * cell, abs(v)));
    ins *= con;
    // la pasta in fondo alla lama resta indietro: si stende sottile dietro
    float lag = mix(1.0 - 0.75 * trascina, 1.0, smoothstep(-dz, -0.3 * dz, u));
    // ai capi della lama deborda di lato
    float side = smoothstep(0.45 * hw, hw, abs(v)) * 0.45 * sign(v);
    vel += (V * lag + vec2(-d.y, d.x) * side * length(V)) * ins;
    // il livello a cui rasa, con le piccole tacche del filo (righe nel verso del gesto)
    float nick = hash12(vec2(floor(v / (0.0035 + 0.002 * hash11(floor(v / 0.02) + S(34.0)))), float(k)) + S(35.0));
    float l0 = spessore * 7.0 * mix(0.85, 0.3, pressione) * (0.8 + 0.5 * nick * nick);
    lev = min(lev, mix(1e9, l0, step(0.02, ins)));
  }
  float mob = max(h - lev, 0.0);
  vec2 m = vel * dt / cell;                     // celle per passo
  float tot = abs(m.x) + abs(m.y);
  if (tot > 0.95) m *= 0.95 / tot;
  return vec3(mob, m);
}
vec4 sim(vec2 uv0) {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec2 uv = (vec2(c) + 0.5) / vec2(imSz());
  float dt = 1.0 / (24.0 * IM_STEPS);
  float t = u_t + u_step * dt;
  if (c.y == imSz().y - 1) {
    // la riga delle spatole: spatola c.x / 2, al tempo del passo
    if (c.x >= 8) return vec4(0.0);
    float k = float(c.x / 2);
    vec2 p, d, p1, d1; float hw, con, f, hw1, con1, f1;
    imKnifeAt(k, t, p, d, hw, con, f);
    imKnifeAt(k, t + 0.02, p1, d1, hw1, con1, f1);
    vec2 V = f1 < f ? vec2(0.0) : (p1 - p) / 0.02;   // un gesto nuovo: niente salto
    if (c.x % 2 == 0) return vec4(p, atan(d.y, d.x), con);
    return vec4(V, hw, 0.0);
  }
  if (u_init > 0.5) {
    return imPrima(uv);
  }
  vec4 s = imF(c);
  float h = s.x;
  // quello che se ne va da qui (verso dove punta la lama)
  vec3 me = imMove(c, h, t, dt);
  float out0 = me.x * (abs(me.y) + abs(me.z));
  // quello che arriva dai quattro vicini che spingono verso di noi
  float inT = 0.0; vec3 cin = vec3(0.0);
  for (int j = 0; j < 4; j++) {
    ivec2 o = j == 0 ? ivec2(-1, 0) : j == 1 ? ivec2(1, 0) : j == 2 ? ivec2(0, -1) : ivec2(0, 1);
    ivec2 n = c + o;
    if (n.x < 0 || n.y < 0 || n.x >= imSz().x || n.y >= imSz().y - 1) continue;
    vec4 sn = imF(n);
    vec3 mn = imMove(n, sn.x, t, dt);
    // il vicino a sinistra manda se spinge a destra, e così via
    float comp = j == 0 ? mn.y : j == 1 ? -mn.y : j == 2 ? mn.z : -mn.z;
    float q = mn.x * max(comp, 0.0);
    inT += q; cin += q * sn.yzw;
  }
  // la pasta oltre una certa pendenza cede appena (soglia alta: tiene la forma)
  float slump = 0.0;
  float tanY = 2.2;
  for (int j = 0; j < 4; j++) {
    ivec2 o = j == 0 ? ivec2(-1, 0) : j == 1 ? ivec2(1, 0) : j == 2 ? ivec2(0, -1) : ivec2(0, 1);
    float hn = imF(c + o).x;
    float cellpx = 1080.0 / float(imSz().y);
    float th = tanY * cellpx;
    slump += 0.05 * (max(hn - h - th, 0.0) - max(h - hn - th, 0.0));
  }
  float hk = h - out0;
  float hn1 = max(hk + inT + slump, 0.0);
  vec3 col = (s.yzw * max(hk, 0.0) + cin) / max(hk + inT, 1e-6);
  if (hk + inT < 1e-6) col = s.yzw;
  return vec4(hn1, col);
}`,
  glsl: COMUNE + `
float imV(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float sd = S(36.0);
  return mix(mix(hash12(i + sd), hash12(i + vec2(1.0, 0.0) + sd), f.x),
             mix(hash12(i + vec2(0.0, 1.0) + sd), hash12(i + vec2(1.0, 1.0) + sd), f.x), f.y);
}
vec3 fx(vec2 uv) {
  vec2 sz = vec2(imSz());
  vec2 lc = uv * sz;
  float cellpx = 1080.0 / sz.y;                 // un texel dello stato, in pixel a 1080
  vec3 hb = imBS(lc);
  vec2 g = hb.yz / cellpx;                      // pendenza vera della pasta
  vec4 st = imL(lc);
  vec3 col = st.yzw;
  float H = hb.x;
  float T = spessore * 7.0;
  vec2 P = uv * u_res / K1080;                  // pixel di un quadro alto 1080
  float ang = radians(luce);
  vec2 L2 = -vec2(cos(ang), sin(ang));          // da dove viene la luce
  vec3 Ld = normalize(vec3(L2, 0.42));
  // la pasta strappata sulle creste e sui fianchi ripidi: grana fine
  float rough = 0.25 + 0.75 * smoothstep(0.4, 2.0, length(g));
  vec2 gt = (vec2(imV(P / 1.6), imV(P / 1.6 + 13.0)) - 0.5) * 0.5 + (vec2(imV(P / 4.0 + 7.0), imV(P / 4.0 + 29.0)) - 0.5) * 0.5;
  // dove la lama ha rasato fino in fondo affiora la trama della tela
  float thin = 1.0 - smoothstep(0.2, 1.0, H);
  vec2 wv = vec2(sin(P.x * 1.9), sin(P.y * 1.9));
  vec2 gw = vec2(cos(P.x * 1.9) * (0.6 + 0.4 * wv.y), cos(P.y * 1.9) * (0.6 + 0.4 * wv.x)) * 0.35;
  vec2 grad = g + gt * rough * 0.6 + gw * thin;
  vec3 n = normalize(vec3(-grad, 1.0));
  float lam = dot(n, Ld) / Ld.z;
  float sh = 0.42 + 0.58 * clamp(lam, 0.0, 2.2);
  sh = sh > 1.0 ? 1.0 + (sh - 1.0) * 0.3 : sh;
  // ombre portate: la pasta più alta verso la luce
  float shd = 0.0;
  for (int k = 1; k <= 10; k++) {
    float d = float(k) * 0.8;                   // in texel
    float hs = imL(lc + L2 * d).x;
    shd = max(shd, smoothstep(0.0, 5.0, (hs - H) - d * cellpx * Ld.z / length(Ld.xy)));
  }
  // cavità: i solchi prendono meno luce
  float ring = 0.0;
  for (int i = 0; i < 6; i++) { float a = float(i) * 1.0472; ring += imL(lc + vec2(cos(a), sin(a)) * 2.0).x; }
  float cav = clamp((ring / 6.0 - H) / max(T, 0.5), 0.0, 1.0);
  sh *= 1.0 - 0.3 * shd;
  sh *= 1.0 - 0.18 * cav;
  // la tela grezza dove la pasta non c'è quasi più
  vec3 tela = vec3(0.78, 0.74, 0.66) * (0.92 + 0.08 * wv.x * wv.y);
  col = mix(col, mix(col, tela, 0.6), smoothstep(0.6, 0.0, H));
  // l'olio è appena lucido: un velo largo sulle creste, mai un riflesso
  vec3 Hv = normalize(Ld + vec3(0.0, 0.0, 1.0));
  float sp = pow(max(dot(n, Hv), 0.0), 10.0) * (1.0 - shd);
  vec3 c = col * sh + col * 0.035 * sp;
  // FX_H: lo spessore, per la Macro
  FX_H = clamp(H / (4.0 * max(T, 0.5)), 0.0, 1.0);
  return clamp(mix(IN(uv), c, materia), 0.0, 1.0);
}`,
};
