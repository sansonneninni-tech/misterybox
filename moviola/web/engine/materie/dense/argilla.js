// Materia densa: argilla. La foto è uno strato di argilla bagnata stesa su un
// piano, vista da vicino in luce radente: dita invisibili la lavorano, poi
// l'argilla asciuga e si screpola.
//
// L'argilla umida è plastica: non torna indietro. La simulazione conserva la
// quantità di argilla e la sposta solo dove passa un dito:
//   - il dito affonda fino a una certa profondità e scorre: l'argilla del
//     solco viene spinta di lato e davanti, e si alza in due argini lungo il
//     solco e in un cumulo dove il dito si ferma;
//   - il pollice preme da fermo: una conca col bordo rialzato;
//   - ogni punto d'argilla porta con sé il pezzo di foto su cui stava, così
//     l'immagine si deforma con la materia;
//   - dove le dita lavorano l'argilla si bagna di più (lucida e scura).
// Poi asciuga: prima dove è sottile e sulle creste, più piano dove è spessa;
// asciugando schiarisce, diventa opaca e polverosa, si ritira un poco e si
// screpola in poligoni piccoli dove è sottile e grandi dove è spessa. L'argilla
// secca non si lascia più spingere.
//
// Stato (una texture a 32 bit, lato lungo 640): x = spessore dell'argilla in
// pixel di un quadro alto 1080, y = umidità (0 secca, 1 fradicia), zw = da dove
// viene (uv della foto). L'ultima riga tiene le dita (due texel per dito).
import { P } from '../comune.js';

const COMUNE = `
#define AR_STEPS 6.0
ivec2 arSz() { return ivec2(u_stRes); }
vec4 arF(ivec2 c) { return texelFetch(u_st, clamp(c, ivec2(0), arSz() - ivec2(1, 2)), 0); }
vec4 arL(vec2 lc) {
  vec2 q = lc - 0.5; ivec2 i = ivec2(floor(q)); vec2 f = q - floor(q);
  return mix(mix(arF(i), arF(i + ivec2(1, 0)), f.x), mix(arF(i + ivec2(0, 1)), arF(i + ivec2(1, 1)), f.x), f.y);
}
// spessore: B-spline cubica, valore e pendenza (per texel)
vec3 arBS(vec2 lc) {
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
    float v = arF(b + ivec2(x, y)).x;
    r += v * vec3(wx[x] * wy[y], dx[x] * wy[y], wx[x] * dy[y]);
  }
  return r;
}
float arT() { return 9.0 * spessore; }        // spessore medio dello strato, px a 1080
// Il dito k al tempo t: punta p, direzione d, raggio, quanto affonda (0..1 dello
// strato), se è un pollice che preme da fermo, e quanto è appoggiato.
float arDur() { return 2.6 / max(velocita, 0.02); }
void arFingerAt(float k, float t, out vec2 p, out vec2 d, out float r, out float dep, out float thumb, out float con, out float f) {
  float tt = t / arDur() + k * 0.53 + 0.11;
  float n = floor(tt); f = tt - n;
  vec3 h = hash33(vec3(n * 1.91 + 2.0, k * 5.3 + 7.0, 3.0) + S(41.0));
  vec3 h2 = hash33(vec3(n * 3.17 + 5.0, k * 2.9 + 1.0, 8.0) + S(42.0));
  vec2 a = vec2(ASPECT, 1.0);
  vec2 a0 = (h.xy - 0.5) * a * 0.84;
  thumb = step(1.0 - 0.35 * pollici, h2.z);
  r = (thumb > 0.5 ? 0.045 : 0.022) * (0.8 + 0.4 * h2.x) * (0.6 + 0.8 * dita);
  dep = (thumb > 0.5 ? 0.55 : 0.45) * (0.75 + 0.5 * h2.y);
  float ang = h.z * TAU;
  float L = thumb > 0.5 ? 0.0 : (0.18 + 0.28 * h2.y);
  float s = smoothstep(0.12, 0.8, f);
  float bend = (h2.x - 0.5) * 1.6;
  float an = ang + bend * (s - 0.5);
  d = vec2(cos(an), sin(an));
  float an0 = ang - bend * 0.5;
  vec2 d0 = vec2(cos(an0), sin(an0));
  p = a0 + (abs(bend) > 1e-3 ? (vec2(sin(an) - sin(an0), cos(an0) - cos(an)) / bend * L) : d0 * L * s);
  // appoggia, affonda, scorre, si stacca
  con = smoothstep(0.02, 0.12, f) * (1.0 - smoothstep(0.82, 0.9, f));
}
`;

export const MATERIA = {
  id: 'argilla', code: 'Ar', name: 'Argilla', family: 'dense', ref: 'La creta ancora umida sotto le dita; la terra che si screpola al sole',
  about: 'La foto è uno strato di argilla bagnata in luce radente. Dita invisibili la spingono: il solco resta, l’argilla si alza in argini ai lati e in un cumulo dove il dito si ferma, e l’immagine si deforma con lei. Nulla torna indietro. Poi asciuga: prima dove è sottile, schiarisce, diventa opaca e si screpola in poligoni.',
  steps: 6, simLong: 640, simF32: true, noloop: true,
  params: [
    P('materia', 'Argilla', 0, 1, 0.75, 0.2),
    P('spessore', 'Spessore dello strato', 0.3, 2, 1, 0.3),
    P('dita', 'Dita', 0, 2, 1, 0.3),
    P('pollici', 'Pollici che premono', 0, 1, 0.4, 0.2),
    P('velocita', 'Velocità delle mani', 0.05, 2, 0.6, 0.2),
    P('asciuga', 'Quanto in fretta asciuga', 0, 1, 0.45, 0.2),
    P('crepe', 'Crepe', 0, 1, 0.7, 0.2),
    P('terra', 'Terra (grigia → cotto)', 0, 1, 0.45, 0.1),
    P('luce', 'Direzione delle ombre', 0, 360, 315, 0, { step: 1 }),
  ],
  sim: COMUNE + `
// quanto e dove si muove l'argilla di una cella: x = parte mobile (sopra la
// punta del dito), yz = spostamento in celle in questo passo, w = bagnato portato dal dito
vec4 arMove(ivec2 c, float h, float m, float dt) {
  vec2 sz = vec2(arSz());
  vec2 X = ((vec2(c) + 0.5) / sz - 0.5) * vec2(ASPECT, 1.0);
  float cell = 1.0 / sz.y;
  vec2 vel = vec2(0.0); float lev = 1e9, wet = 0.0;
  for (int k = 0; k < 3; k++) {
    vec4 ka = texelFetch(u_st, ivec2(2 * k, arSz().y - 1), 0);
    vec4 kb = texelFetch(u_st, ivec2(2 * k + 1, arSz().y - 1), 0);
    float con = ka.w;
    if (con < 0.01) continue;
    vec2 p = ka.xy, d = vec2(cos(ka.z), sin(ka.z)), V = kb.xy;
    float r = kb.z, dep = abs(kb.w), thumb = kb.w < 0.0 ? 1.0 : 0.0;
    vec2 q = X - p;
    float dl = length(q);
    if (dl > r + 2.0 * cell) continue;
    float ins = (1.0 - smoothstep(r - 2.0 * cell, r + cell, dl)) * con;
    vec2 rad = q / max(dl, 1e-6);
    // il dito che scorre spinge avanti e di lato; il pollice spinge in fuori
    float sp = length(V);
    vec2 push = thumb > 0.5 ? rad * 0.35 : V + rad * max(dot(rad, vec2(-d.y, d.x)) * sign(dot(rad, vec2(-d.y, d.x))), 0.0) * sp * 0.9;
    vel += push * ins;
    // la punta è tonda: affonda di più al centro
    float prof = sqrt(max(1.0 - (dl / r) * (dl / r), 0.0));
    lev = min(lev, mix(1e9, arT() * (1.0 - dep * prof * con), step(0.02, ins)));
    wet = max(wet, ins);
  }
  // l'argilla secca non si lascia spingere
  float mob = max(h - lev, 0.0) * smoothstep(0.2, 0.5, m);
  vec2 mv = vel * dt / cell;
  float tot = abs(mv.x) + abs(mv.y);
  if (tot > 0.95) mv *= 0.95 / tot;
  return vec4(mob, mv, wet);
}
vec4 sim(vec2 uv0) {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec2 uv = (vec2(c) + 0.5) / vec2(arSz());
  float dt = 1.0 / (24.0 * AR_STEPS);
  float t = u_t + u_step * dt;
  if (c.y == arSz().y - 1) {
    // la riga delle dita: dito c.x / 2
    if (c.x >= 6) return vec4(0.0);
    float k = float(c.x / 2);
    vec2 p, d, p1, d1; float r, dep, th, con, f, r1, dep1, th1, con1, f1;
    arFingerAt(k, t, p, d, r, dep, th, con, f);
    arFingerAt(k, t + 0.02, p1, d1, r1, dep1, th1, con1, f1);
    vec2 V = f1 < f ? vec2(0.0) : (p1 - p) / 0.02;
    if (c.x % 2 == 0) return vec4(p, atan(d.y, d.x), con);
    return vec4(V, r, th > 0.5 ? -dep : dep);
  }
  vec2 a = vec2(ASPECT, 1.0);
  if (u_init > 0.5) {
    // lo strato: un poco più alto dove la foto è chiara (un bassorilievo), con
    // le irregolarità della stesura; bagnato quasi ovunque
    vec2 p = (uv - 0.5) * a;
    float L = 0.0;
    for (int i = 0; i < 5; i++) {
      float an = float(i) * 1.2566;
      L += luma(IN(uv + vec2(cos(an), sin(an)) * 1.5 / vec2(arSz())));
    }
    L /= 5.0;
    float n = fbm(p * 4.0 + S(43.0), 0.0, 0.0, 4);
    // la stesura a mano: larghe lisciature e qualche grumo
    float lis = fbm(vec2(dot(p, vec2(0.8, 0.6)) * 7.0, dot(p, vec2(-0.6, 0.8)) * 2.5) + S(48.0), 0.0, 0.0, 3);
    float h = arT() * (0.75 + 0.5 * L + 0.3 * n + 0.18 * lis);
    float m = 0.82 + 0.15 * gnoise(vec3(p * 3.0, S(44.0)), 0.0);
    return vec4(h, m, uv);
  }
  vec4 s = arF(c);
  float h = s.x;
  vec4 me = arMove(c, h, s.y, dt);
  float out0 = me.x * (abs(me.y) + abs(me.z));
  float inT = 0.0; vec3 cin = vec3(0.0);
  float hsum = 0.0, msum = 0.0;
  for (int j = 0; j < 4; j++) {
    ivec2 o = j == 0 ? ivec2(-1, 0) : j == 1 ? ivec2(1, 0) : j == 2 ? ivec2(0, -1) : ivec2(0, 1);
    ivec2 n = c + o;
    vec4 sn = arF(n);
    hsum += sn.x; msum += sn.y;
    if (n.x < 0 || n.y < 0 || n.x >= arSz().x || n.y >= arSz().y - 1) continue;
    vec4 mn = arMove(n, sn.x, sn.y, dt);
    float comp = j == 0 ? mn.y : j == 1 ? -mn.y : j == 2 ? mn.z : -mn.z;
    float q = mn.x * max(comp, 0.0);
    inT += q; cin += q * vec3(sn.zw, sn.y);
  }
  float hk = h - out0;
  float hn1 = max(hk + inT, 0.0);
  vec3 mixd = (vec3(s.zw, s.y) * max(hk, 0.0) + cin) / max(hk + inT, 1e-6);
  if (hk + inT < 1e-6) mixd = vec3(s.zw, s.y);
  float m = mixd.z;
  // il dito bagna dove passa
  m = min(1.0, m + me.w * 0.04);
  // asciuga: più dove è sottile e dove sporge, meno dove è spessa; l'umido si
  // sposta piano verso le zone più secche
  float conv = clamp((h - hsum * 0.25) / arT() * 4.0, -1.0, 1.0);
  float thinf = clamp(1.6 - h / arT(), 0.2, 2.0);
  float rate = asciuga * asciuga * 0.5 * thinf * (1.0 + 0.6 * max(conv, 0.0)) * (0.8 + 0.4 * hash12(uv * 311.0 + S(45.0)));
  float dm = min(m, rate * dt * (0.3 + m));
  m = m - dm + 0.05 * (msum * 0.25 - m);
  // asciugando si ritira (circa il 7% dello spessore)
  hn1 *= 1.0 - 0.08 * dm;
  return vec4(hn1, clamp(m, 0.0, 1.0), mixd.xy);
}`,
  glsl: COMUNE + `
float arV(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float sd = S(3.0);
  return mix(mix(hash12(i + sd), hash12(i + vec2(1.0, 0.0) + sd), f.x),
             mix(hash12(i + vec2(0.0, 1.0) + sd), hash12(i + vec2(1.0, 1.0) + sd), f.x), f.y);
}
// le terre: grigia, ocra, cotto, bruno ferroso
vec3 arBody(float x) {
  vec3 c0 = vec3(0.56, 0.55, 0.52), c1 = vec3(0.63, 0.54, 0.41), c2 = vec3(0.62, 0.40, 0.29), c3 = vec3(0.40, 0.27, 0.22);
  x = clamp(x, 0.0, 1.0) * 3.0;
  vec3 c = mix(c0, c1, smoothstep(0.0, 1.0, x));
  c = mix(c, c2, smoothstep(1.0, 2.0, x));
  return mix(c, c3, smoothstep(2.0, 3.0, x));
}
// crepe: distanza dal bordo della cella di Voronoi (in unità della cella),
// con il campo un poco piegato perché i lati non siano dritti
vec2 arCrack(vec2 p, float sd) {
  vec2 w = vec2(arV(p * 0.8 + sd), arV(p * 0.8 + sd + 13.0)) - 0.5;
  p += w * 0.7;
  vec2 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0; vec2 id = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = hash22(i + g + sd) * 0.85 + 0.075;
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = i + g; } else if (d < d2) d2 = d;
  }
  return vec2(sqrt(d2) - sqrt(d1), hash12(id + sd));
}
vec3 fx(vec2 uv) {
  vec2 sz = vec2(arSz());
  vec2 lc = uv * sz;
  float cellpx = 1080.0 / sz.y;
  vec3 hb = arBS(lc);
  vec2 g = hb.yz / cellpx;
  vec4 st = arL(lc);
  float H = hb.x, m = st.y;
  float T = arT();
  vec2 P = uv * u_res / K1080;
  float ang = radians(luce);
  vec2 L2 = -vec2(cos(ang), sin(ang));
  vec3 Ld = normalize(vec3(L2, 0.45));
  float dry = 1.0 - smoothstep(0.15, 0.55, m);
  // ---- crepe: compaiono sotto una certa umidità, prima dove è sottile; due
  // ordini di poligoni (grandi, poi piccoli dentro)
  float cs = (45.0 + 60.0 * clamp(H / T, 0.3, 2.0)) * (1.2 - 0.5 * crepe);   // misura della cella, px
  vec2 c1 = arCrack(P / cs, S(46.0));
  vec2 c2 = arCrack(P / (cs * 0.45), S(47.0));
  float open1 = crepe * smoothstep(0.42, 0.12, m);
  float open2 = crepe * smoothstep(0.25, 0.04, m) * step(0.35, c2.y);
  float w1 = open1 * (3.0 + 3.0 * c1.y) / cs;            // larghezza in px, poi in celle
  float w2 = open2 * 1.4 / (cs * 0.45);
  float k1 = 1.0 - smoothstep(w1 * 0.5, w1 * 0.5 + 0.6 / cs, c1.x);
  float k2 = 1.0 - smoothstep(w2 * 0.5, w2 * 0.5 + 0.6 / (cs * 0.45), c2.x);
  k1 *= step(1e-4, open1); k2 *= step(1e-4, open2);
  // il secondo ordine di crepe resta spento: a questa misura diventava puntinato
  float crack = k1;
  // i bordi delle zolle si sollevano un poco (l'argilla secca si incurva)
  float curl = (1.0 - smoothstep(0.0, 0.18, c1.x - w1 * 0.5)) * open1 * (1.0 - k1);
  // ---- rilievo e luce
  vec2 gr = (vec2(arV(P / 1.7), arV(P / 1.7 + 17.0)) - 0.5) * (0.1 + 0.08 * dry)
          + (vec2(arV(P / 5.0 + 3.0), arV(P / 5.0 + 23.0)) - 0.5) * 0.15;
  vec2 grad = g + gr;
  vec3 n = normalize(vec3(-grad, 1.0));
  float lam = dot(n, Ld) / Ld.z;
  float sh = 0.4 + 0.6 * clamp(lam, 0.0, 2.0);
  sh = sh > 1.0 ? 1.0 + (sh - 1.0) * 0.4 : sh;
  float shd = 0.0;
  for (int k = 1; k <= 10; k++) {
    float d = float(k) * 0.8;
    float hs = arL(lc + L2 * d).x;
    shd = max(shd, smoothstep(0.0, 6.0, (hs - H) - d * cellpx * Ld.z / length(Ld.xy)));
  }
  float ring = 0.0;
  for (int i = 0; i < 6; i++) { float a = float(i) * 1.0472; ring += arL(lc + vec2(cos(a), sin(a)) * 2.0).x; }
  float cav = clamp((ring / 6.0 - H) / T, 0.0, 1.0);
  sh *= (1.0 - 0.35 * shd) * (1.0 - 0.25 * cav);
  sh *= 1.0 + 0.12 * curl;
  // ---- colore: la foto è un ingobbio assorbito dall'impasto, e si muove con lui
  vec3 ph = IN(st.zw);
  vec3 body = arBody(terra);
  vec3 alb = mix(ph, body * (0.35 + 1.2 * luma(ph)), 0.3 + 0.4 * materia);
  float la = luma(alb);
  // bagnata: più scura e più satura; secca: chiara, opaca, polverosa
  vec3 wetC = mix(vec3(la), alb, 1.3) * 0.72;
  vec3 dryC = mix(mix(vec3(la), alb, 0.7), body * 1.2, 0.3) * 1.18 + 0.03;
  alb = mix(wetC, dryC, dry);
  // il velo bagnato: lucido largo e debole, solo dove è ancora fradicia
  vec3 Hv = normalize(Ld + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, Hv), 0.0), 9.0) * smoothstep(0.55, 0.9, m) * (1.0 - shd);
  vec3 col = alb * sh + alb * 0.08 * spec;
  // dentro la crepa: il fondo in ombra
  col = mix(col, alb * 0.18, crack);
  FX_H = clamp(H / (2.5 * T), 0.0, 1.0) * (1.0 - crack);
  return clamp(mix(IN(uv), col, smoothstep(0.0, 0.35, materia)), 0.0, 1.0);
}`,
};
