// Materia densa: argilla. La foto è un bassorilievo modellato in argilla
// bagnata, visto da vicino in luce radente, e delle dita invisibili continuano
// a lavorarlo.
//
// Stato della simulazione (morbido, lato lungo 640):
//   xy = scostamento (in uv) verso il punto della foto da cui l'argilla è stata
//        spinta: dove passa un dito il rilievo scivola di lato e poi si rilassa;
//   z  = bagnato (0 asciutto, 1 fradicio);
//   w  = libero.
// Le impronte vive (solchi delle dita, conche dei pollici) non stanno nello
// stato: il disegno le ricostruisce in forma analitica dalla stessa traiettoria
// delle mani, così il profilo resta netto a qualsiasi risoluzione.
// Il disegno legge la foto a piena risoluzione e ci costruisce sopra il campo
// d'altezza: rilievo dalla luminanza (tre anelli), impronte vive dallo stato,
// e la struttura propria dell'argilla (ditate vecchie, pollici, grumi, stecca,
// chamotte) in pixel × K1080.
import { P } from '../comune.js';

// Le mani: la stessa traiettoria nella simulazione e nel disegno.
const MANI = `
vec2 mir(vec2 q) { return 1.0 - abs(1.0 - mod(q, 2.0)); }
#define AR_D 7.0
#define AR_R 0.034
#define AR_LS 0.62
// mano k al tempo t: da dove parte, verso dove va, a che punto è (0..1 del ciclo)
void arHand(float k, float t, out vec2 a0, out vec2 dir, out float f) {
  float tt = t / AR_D + (k < 0.5 ? 0.3 : 0.8);
  float n = floor(tt); f = tt - n;
  vec2 h = hash22(vec2(n * 3.7 + 1.0, k * 7.3 + 2.0) + S(21.0));
  vec2 h2 = hash22(vec2(n * 5.1 + 4.0, k * 3.3 + 8.0) + S(22.0));
  a0 = (h - 0.5) * vec2(ASPECT, 1.0) * 0.9;
  vec2 tg = (h2 - 0.5) * vec2(ASPECT, 1.0) * 0.45;
  dir = normalize(tg - a0 + vec2(1e-3, 2e-3));
}
float arProf(float d) { float x = clamp(1.0 - d * d, 0.0, 1.0); return x * x; }
float arRim(float d) { return smoothstep(0.7, 1.1, d) * (1.0 - smoothstep(1.1, 1.75, d)); }
// pollice k: centro, angolo, punto del ciclo
void arThumb(float k, float t, out vec2 c, out float an, out float f) {
  float tt = t / 5.0 + k * 0.37 + 0.12;
  float n = floor(tt); f = tt - n;
  vec2 h = hash22(vec2(n * 2.3 + 5.0, k * 9.1 + 1.0) + S(24.0));
  c = (h - 0.5) * vec2(ASPECT, 1.0) * 0.82;
  an = hash11(n * 1.7 + k + S(25.0)) * TAU;
}
// il polpastrello j della mano k lungo la passata (hh = 0..1 del tratto fatto)
vec2 arTip(vec2 a0, vec2 dir, float k, float j, float s) {
  vec2 perp = vec2(-dir.y, dir.x);
  float hj = hash11(k * 3.0 + j + S(23.0));
  return a0 + perp * (j - 1.0) * AR_R * (2.15 + 0.3 * hj) + dir * (1.0 - abs(j - 1.0)) * 0.035
    + dir * AR_LS * s + perp * 0.014 * sin(s * 3.0 + k * 2.0);
}
`;

export const MATERIA = {
  id: 'argilla', code: 'Ar', name: 'Argilla', family: 'dense', ref: 'Il bassorilievo in creta ancora umida, prima della cottura',
  about: 'La foto è un bassorilievo in argilla bagnata visto da vicino in luce radente: dita invisibili lo trascinano, lo premono e lo lisciano, il rilievo scivola di lato e si rilassa, le chiazze umide migrano e asciugano.',
  steps: 1, simLong: 512, noloop: true,
  params: [
    P('materia', 'Argilla', 0, 1, 0.7, 0.2),
    P('rilievo', 'Spessore del rilievo', 0, 2, 1, 0.3),
    P('dita', 'Ditate', 0, 2, 1, 0.4),
    P('pressioni', 'Pollici', 0, 2, 1, 0.4),
    P('grumi', 'Grumi e chamotte', 0, 2, 1, 0.2),
    P('bagnato', 'Bagnato', 0, 1, 0.6, 0.3),
    P('terra', 'Terra (grigia → cotto)', 0, 1, 0.45, 0.1),
    P('luce', 'Direzione delle ombre', 0, 360, 315, 0, { step: 1 }),
  ],
  sim: MANI + `
vec4 sim(vec2 uv) {
  vec2 a = vec2(ASPECT, 1.0);
  vec2 p = (uv - 0.5) * a;
  float dt = 1.0 / 24.0;
  float t = u_t + u_step * dt;
  bool ini = u_init > 0.5;
  // chiazze d'umido che migrano
  float wt = smoothstep(-0.3, 0.3, gnoise(vec3(p * 1.7 + vec2(t * 0.035, -t * 0.02), t * 0.11), 0.0) + 0.45 * gnoise(vec3(p * 4.1 + 5.0, t * 0.16), 0.0));
  vec4 s;
  if (ini) {
    s = vec4(0.0, 0.0, wt, 0.0);
  } else {
    s = ST(uv);
    vec2 se = SPX * 1.5;
    vec4 nb = (ST(uv + vec2(se.x, 0.0)) + ST(uv - vec2(se.x, 0.0)) + ST(uv + vec2(0.0, se.y)) + ST(uv - vec2(0.0, se.y))) * 0.25;
    s.xy = mix(s.xy, nb.xy, 0.18) * (1.0 - 0.009);   // l'argilla si rilassa piano
    s.z = mix(s.z, nb.z, 0.15);
    s.z += (wt - s.z) * 0.024;
  }
  // due mani, tre dita: dove passano il rilievo scivola con loro
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    vec2 a0, dir; float f;
    arHand(fk, t, a0, dir, f);
    float pr = clamp(f / 0.6, 0.0, 1.0);
    float act = smoothstep(0.0, 0.035, f) * (1.0 - smoothstep(0.57, 0.62, f));
    for (int j = 0; j < 3; j++) {
      float fj = float(j);
      if (ini) {
        vec2 b0 = arTip(a0, dir, fk, fj, 0.0), b1 = arTip(a0, dir, fk, fj, pr);
        vec2 pa = p - b0, ba = b1 - b0;
        float hh = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
        float pf = arProf(length(p - arTip(a0, dir, fk, fj, pr * hh)) / AR_R);
        s.xy -= dir * 0.028 * pf * min(dita, 1.5) * (0.4 + 0.6 * hh) / a;
        s.z = max(s.z, min(s.z + 0.3 * pf, 0.6));
      } else {
        float pf = arProf(length(p - arTip(a0, dir, fk, fj, pr)) / AR_R) * act;
        s.xy -= dir * (AR_LS / (0.6 * AR_D)) * dt * 0.85 * pf * min(dita, 1.5) / a;
        s.z = max(s.z, min(s.z + pf * 0.1, 0.65));
      }
    }
  }
  // tre pollici: premono (l'argilla si sposta in fuori), poi vengono lisciati
  if (!ini) {
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      vec2 c; float an, f;
      arThumb(fk, t, c, an, f);
      vec2 q = rot(an) * (p - c);
      q.y *= 1.4;
      float d = length(q) / 0.062;
      float giu = smoothstep(0.0, 0.15, f);
      float su = 1.0 - step(0.36, f);
      float pin = su * step(f, 0.15);
      vec2 qn = (p - c) / max(length(p - c), 1e-5);
      s.xy -= qn * 0.02 / 18.0 * pin * d * arProf(d * 0.8) * 2.0 * min(pressioni, 1.5) / a;
      s.z = max(s.z, min(s.z + arProf(d) * su * giu * 0.06, 0.65));
      float lis = smoothstep(0.6, 0.66, f) * (1.0 - smoothstep(0.9, 0.96, f));
      s.xy *= 1.0 - 0.024 * lis * (1.0 - smoothstep(1.0, 1.9, d));
    }
  }
  float dl = length(s.xy * a);
  s.xy *= 1.0 - 0.1 * smoothstep(0.05, 0.09, dl);
  return vec4(s.xy, clamp(s.z, 0.0, 1.0), 0.0);
}`,
  glsl: MANI + `
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
// sezione di un solco: fondo tondo a U e bordo d'argilla spostata
float arTr(float d) { return -arProf(d) + 0.24 * arRim(d); }
// sezione di un grumo schiacciato, appena affondato nel letto
float arLp(float d) { return (1.0 - smoothstep(0.3, 1.0, d)) - 0.2 * arRim(d * 0.92); }
// un grumo per cella, ellittico; altezza e pendenza analitiche (x = h, yz = gradiente)
vec3 arLump(vec2 p, float cs, float rmin, float rmax, float prob, float sd) {
  vec2 i = floor(p / cs);
  float pres = hash12(i * 1.7 + S(sd + 1.0));
  if (!(pres < prob)) return vec3(0.0);
  vec2 h = hash22(i + S(sd));
  float r = mix(rmin, rmax, h.x * h.x);
  vec2 c = (i + 0.5 + (h.yx - 0.5) * (1.0 - 2.3 * rmax / cs)) * cs;
  mat2 M = rot(h.y * 6.28);
  vec2 q = M * (p - c);
  vec2 sc = vec2(1.0, 1.0 + 0.7 * h.x * h.y + 0.3 * fract(pres * 91.7));
  vec2 qs = q * sc;
  float ql = max(length(qs), 1e-4);
  float d = ql / r;
  if (d > 1.7) return vec3(0.0);
  float am = (0.55 + 0.45 * h.y) * r;
  float dh = (arLp(d + 0.03) - arLp(d - 0.03)) / 0.06;
  vec2 gd = transpose(M) * (qs * sc) / (ql * r);
  return vec3(arLp(d) * am, dh * am * gd);
}
// una passata di mano: tre solchi netti, ricostruiti dalla traiettoria
void arStroke(vec2 pa, float k, float t, float prev, float gs, inout float h, inout vec2 g, inout float tr) {
  vec2 a0, dir; float f;
  arHand(k, t - prev * AR_D, a0, dir, f);
  float pr = prev > 0.5 ? 1.0 : clamp(f / 0.6, 0.0, 1.0);
  // la passata vecchia viene lisciata via mentre la nuova avanza
  float env = prev > 0.5 ? 1.0 - smoothstep(0.0, 0.5, f) : smoothstep(0.0, 0.035, f);
  if (env < 0.003) return;
  {
    vec2 e0 = a0 + dir * 0.02, e1 = a0 + dir * (AR_LS * pr + 0.02);
    vec2 v0 = pa - e0, b0 = e1 - e0;
    float h0 = clamp(dot(v0, b0) / max(dot(b0, b0), 1e-6), 0.0, 1.0);
    if (length(v0 - b0 * h0) > 0.2) return;
  }
  vec2 perp = vec2(-dir.y, dir.x);
  for (int j = 0; j < 3; j++) {
    float fj = float(j);
    vec2 b0 = arTip(a0, dir, k, fj, 0.0), b1 = arTip(a0, dir, k, fj, pr);
    vec2 v = pa - b0, ba = b1 - b0;
    float hh = clamp(dot(v, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    vec2 q = pa - arTip(a0, dir, k, fj, pr * hh);
    float ql = max(length(q), 1e-5);
    float d = ql / AR_R;
    if (d > 1.8) continue;
    float dep = 11.0 * dita * (0.7 + 0.55 * hash11(k * 3.0 + fj + S(23.0))) * env;
    h += dep * arTr(d);
    g += dep * (arTr(d + 0.02) - arTr(d - 0.02)) / 0.04 * (q / ql) / (AR_R * 1080.0);
    // la pelle del dito e la chamotte rigano il fondo per il lungo
    float pf = arProf(d);
    float lat = dot(q, perp) * 1080.0, lng = hh * pr * AR_LS * 1080.0;
    float sv = arV(vec2(lat / (1.4 * gs) + k * 31.0 + fj * 17.0, lng / 140.0)) - 0.5;
    g += perp * sv * 0.55 * pf * env * min(dita, 1.5);
    tr = max(tr, pf * env);
  }
}
vec3 fx(vec2 uv) {
  vec2 a = vec2(ASPECT, 1.0);
  vec4 s = ST(uv);
  vec2 q = mir(uv + s.xy);
  vec2 kp = K1080 * PX;                        // un pixel a 1080, in uv
  float ang = radians(luce);
  vec2 L2 = -vec2(cos(ang), sin(ang));         // da dove viene la luce
  vec3 Ld = normalize(vec3(L2 * 0.9, 0.44));
  float tanE = 0.44 / 0.9;
  // ---- la foto come rilievo: due anelli da sei
  const float R1 = 4.0, R2 = 14.0;
  vec3 c0 = IN(q);
  float lc = luma(c0);
  float l1[6]; float l2[6];
  vec3 cs = c0;
  vec2 g1 = vec2(0.0), g2 = vec2(0.0);
  float m1 = 0.0, m2 = 0.0;
  for (int i = 0; i < 6; i++) {
    float an = float(i) * 1.0472;
    vec2 dr = vec2(cos(an), sin(an));
    vec3 t1 = IN(mir(q + dr * R1 * kp));
    cs += t1;
    l1[i] = luma(t1); g1 += dr * l1[i]; m1 += l1[i];
    vec2 dr2 = vec2(cos(an + 0.5236), sin(an + 0.5236));
    l2[i] = luma(IN(mir(q + dr2 * R2 * kp))); g2 += dr2 * l2[i]; m2 += l2[i];
  }
  float mean = (lc + m1 + m2) / 13.0;
  cs /= 7.0; m1 /= 6.0; m2 /= 6.0;
  // contrasto locale: ogni foto, anche la più nebbiosa, ha un rilievo profondo
  float dev = abs(lc - mean);
  for (int i = 0; i < 6; i++) dev += abs(l1[i] - mean) + abs(l2[i] - mean);
  dev /= 13.0;
  float gain = mix(1.0, min(0.115 / (dev + 0.028), 2.4), smoothstep(0.008, 0.03, dev));
  float A = 46.0 * rilievo * gain;             // altezza del bassorilievo, in pixel a 1080
  float ls = lc * 0.35 + m1 * 0.65;
  vec2 gb = g2 / (3.0 * R2);
  vec2 gP = A * (0.36 * g1 / (3.0 * R1) + 0.64 * gb);
  gP /= 1.0 + 0.55 * length(gP);
  // ombre portate corte e cavità, con gli stessi campioni
  float As = 46.0 * rilievo * min(gain, 1.3);
  float shP = 0.0, wS = 0.0;
  for (int i = 0; i < 6; i++) {
    float an = float(i) * 1.0472;
    float w1 = pow(max(dot(vec2(cos(an), sin(an)), L2), 0.0), 2.0);
    float w2 = pow(max(dot(vec2(cos(an + 0.5236), sin(an + 0.5236)), L2), 0.0), 2.0);
    shP += w1 * 0.6 * smoothstep(0.0, 2.5, (l1[i] - ls) * As * 0.55 - R1 * tanE * 0.6);
    shP += w2 * smoothstep(0.0, 5.0, (l2[i] - ls) * As * 0.55 - R2 * tanE * 0.6);
    wS += w1 * 0.6 + w2;
  }
  float shadow = clamp(1.15 * shP / max(wS, 1e-3), 0.0, 1.0);
  float cavP = clamp(((m2 - ls) * 2.8 + (m1 - lc) * 0.6) * min(gain, 1.3), -1.0, 1.0) * min(rilievo, 1.5);
  // ---- la struttura dell'argilla, in pixel a 1080: altezza e pendenza insieme
  vec2 p = q * u_res / K1080;
  float gs = max(2.6, 1.7 / K1080);
  float h = 0.0; vec2 g = vec2(0.0);
  {
    // ditate vecchie: solchi larghi e bassi, paralleli, appena piegati dalla forma
    float m = arV(p / 290.0 + 3.1);
    float a1 = hash11(S(31.0)) * PI, a2 = a1 + 1.15;
    vec2 d1 = vec2(cos(a1), sin(a1)), d2 = vec2(cos(a2), sin(a2));
    vec2 n1 = vec2(-d1.y, d1.x), n2 = vec2(-d2.y, d2.x);
    float wp = (arV(p / 260.0 + 9.0) - 0.5) * 0.6;
    float mA = smoothstep(0.48, 0.70, m), mB = smoothstep(0.46, 0.26, m) * 0.85;
    float pA = dita * mA * (0.3 + arV(vec2(dot(p, d1) / 150.0, dot(p, n1) / 420.0) + 5.0));
    float pB = dita * mB * (0.3 + arV(vec2(dot(p, d2) / 150.0, dot(p, n2) / 380.0) + 15.0));
    float xA = fract(dot(p, d1) / 88.0 + wp + m2 * 0.5);
    float xB = fract(dot(p, d2) / 72.0 - wp * 0.8 + m2 * 0.45);
    float uA = abs(2.0 * xA - 1.0), uB = abs(2.0 * xB - 1.0);
    float kA = 1.0 - uA * uA, kB = 1.0 - uB * uB;
    h += pA * 8.5 * (0.5 - kA * kA) + pB * 7.5 * (0.5 - kB * kB);
    g += pA * 8.5 * 8.0 * uA * kA * sign(xA - 0.5) * (d1 / 88.0 + gb * 0.5);
    g += pB * 7.5 * 8.0 * uB * kB * sign(xB - 0.5) * (d2 / 72.0 + gb * 0.45);
    // la chamotte trascinata riga il fondo dei solchi
    g += d1 * pA * kA * 0.45 * (arV(vec2(dot(p, d1) / (1.5 * gs), dot(p, n1) / 90.0)) - 0.5);
    g += d2 * pB * kB * 0.45 * (arV(vec2(dot(p, d2) / (1.5 * gs), dot(p, n2) / 80.0)) - 0.5);
  }
  {
    // pollici vecchi: conche morbide col bordo alzato
    float cz = 330.0;
    vec2 i = floor(p / cz);
    vec2 hh = hash22(i + S(33.0));
    if (hash12(i * 2.3 + S(34.0)) < 0.45) {
      float r = 52.0 + 30.0 * hh.x;
      vec2 c = (i + 0.5 + (hh - 0.5) * 0.3) * cz;
      mat2 M = rot(hh.y * 6.0);
      vec2 qs = M * (p - c);
      vec2 sc = vec2(1.0, 1.35);
      qs *= sc;
      float ql = max(length(qs), 1e-4);
      float d = ql / r;
      if (d < 1.8) {
        float am = 9.0 * pressioni;
        h += am * arTr(d);
        g += am * (arTr(d + 0.02) - arTr(d - 0.02)) / 0.04 * (transpose(M) * (qs * sc)) / (ql * r);
      }
    }
  }
  // grumi e palline: a gruppi, di misure diverse
  float mg = smoothstep(0.52, 0.82, arV(p / 230.0 + 40.0));
  vec3 lp = grumi * (1.1 * arLump(p, 150.0, 9.0, 34.0, 0.05 + 0.4 * mg, 41.0)
    + 0.9 * arLump(p + 37.0, 52.0, 3.5, 12.0, 0.02 + 0.45 * mg, 43.0));
  if (19.0 / gs > 4.0) lp += grumi * 0.9 * arLump(p + 91.0, 19.0, 1.8, 5.0, 0.5 * mg * mg, 45.0);
  h += lp.x; g += lp.yz;
  // chamotte e grana fine: una pendenza casuale alla scala del pixel
  vec2 gr = (vec2(arV(p / gs), arV(p / gs + 17.3)) - 0.5) * 0.30 + (vec2(arV(p / (gs * 2.7) + 7.0), arV(p / (gs * 2.7) + 29.0)) - 0.5) * 0.15;
  g += gr * (0.35 + 0.65 * min(grumi, 1.5));
  float cavH = clamp(-h / 9.0, -0.4, 1.0);
  // ---- le impronte vive: solchi e conche netti, dalla traiettoria delle mani
  vec2 pa = (uv - 0.5) * a;
  float hL = 0.0, tr = 0.0; vec2 gL = vec2(0.0);
  for (int k = 0; k < 2; k++) {
    arStroke(pa, float(k), u_t, 0.0, gs, hL, gL, tr);
    arStroke(pa, float(k), u_t, 1.0, gs, hL, gL, tr);
  }
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    vec2 c; float an, f;
    arThumb(fk, u_t, c, an, f);
    float env = smoothstep(0.0, 0.15, f) * (1.0 - smoothstep(0.62, 0.95, f));
    mat2 M = rot(an);
    vec2 qs = M * (pa - c);
    vec2 sc = vec2(1.0, 1.4);
    qs *= sc;
    float ql = max(length(qs), 1e-5);
    float d = ql / 0.062;
    if (d < 1.8 && env > 0.003) {
      float am = 15.0 * pressioni * env;
      vec2 gd = transpose(M) * (qs * sc) / (ql * 0.062 * 1080.0);
      hL += am * arTr(d);
      gL += am * (arTr(d + 0.02) - arTr(d - 0.02)) / 0.04 * gd;
      float pf = arProf(d);
      // le creste del polpastrello
      float cr = arV(vec2(d * 9.0 + fk * 7.0, atan(qs.y, qs.x) * 1.6) * vec2(0.062 * 1080.0 / (9.0 * 1.5 * gs), 1.0)) - 0.5;
      gL += gd / max(length(gd), 1e-6) * cr * 0.4 * pf * env;
      tr = max(tr, pf * env);
    }
  }
  // ---- luce radente
  vec2 grad = gP + g + gL;
  vec3 n = normalize(vec3(-grad, 1.0));
  float lam = dot(n, Ld);
  float sh = 1.0 + (lam - Ld.z) * 1.25;
  sh = sh > 1.0 ? 1.0 + (sh - 1.0) * 0.7 : sh;
  sh = max(sh, 0.0);
  // nel solco conta la sua forma: le ombre della foto lì sono state spianate
  float cav = clamp((cavP * 0.9 + cavH * 0.4) * (1.0 - 0.6 * tr) + clamp(-hL / 40.0, -0.15, 0.3), -0.5, 1.0);
  float ao = 1.0 - 0.62 * smoothstep(0.0, 0.9, cav) + 0.10 * smoothstep(0.0, -0.5, cav);
  float lit = (0.26 + 0.74 * sh * (1.0 - 0.5 * shadow * (1.0 - 0.7 * tr))) * ao;
  // ---- colore: la foto è un ingobbio assorbito dall'impasto
  float wet = clamp(bagnato * (s.z * 1.15 + 0.35 * smoothstep(0.1, 0.8, cav)) + (bagnato - 0.5) * 0.3, 0.0, 1.0);
  vec3 body = arBody(terra);
  float L0 = luma(cs);
  vec3 clayT = body * (0.30 + 1.25 * L0);
  float pull = 0.05 + 0.5 * materia;
  vec3 alb = mix(cs, clayT, pull);
  alb = mix(alb, body * 0.8, 0.12 * materia);
  float la = luma(alb);
  // bagnato: più saturo e più scuro (ma non dentro i solchi, già in ombra); asciutto: chiaro, polveroso
  vec3 wetC = mix(vec3(la), alb, 1.35) * mix(0.70, 0.95, tr);
  vec3 dryC = mix(mix(vec3(la), alb, 0.75), body * 1.3, 0.25) * 1.12;
  alb = mix(dryC, wetC, smoothstep(0.15, 0.85, wet));
  vec3 col = alb * lit;
  // lucido largo e opaco, solo dove è bagnata: mai oltre il 10% del colore
  vec3 Hv = normalize(Ld + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, Hv), 0.0), 7.0) * (1.0 - 0.7 * shadow) * ao;
  col += alb * 0.10 * spec * wet;
  col = max(col, 0.0);
  vec3 img = IN(uv);
  return clamp(mix(img, col, smoothstep(0.0, 0.35, materia)), 0.0, 1.0);
}`,
};
