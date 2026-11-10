// Materia: brina. Cristalli di ghiaccio che crescono davvero sul vetro davanti
// alla foto, come sulle finestre d'inverno.
//
// Fisica: modello a campo di fase di Kobayashi (1993) per la solidificazione
// dendritica. Un campo φ dice dove c'è ghiaccio, un campo u la «temperatura»
// (il vapore ancora disponibile): il ghiaccio cresce dove u è freddo, e
// crescendo libera calore che scalda i dintorni. Da qui nascono da sole le
// felci: punte che avanzano, rami laterali, e rami che si fermano quando
// incontrano l'alone caldo di altri rami, lasciando strisce di vetro pulito.
// L'anisotropia a sei punte (il reticolo esagonale del ghiaccio) dà gli angoli
// di 60°; ogni cristallo ha il suo orientamento, ereditato dal seme.
// I semi nascono dove il vetro ha un difetto: lungo i contorni della foto e
// sui bordi del quadro, prima negli scuri (il vetro più freddo).
// Il disgelo alza la temperatura: le punte sottili (più curve) si sciolgono
// per prime, e l'acqua resta in goccioline.
//
// Stato (16 bit, lato lungo 640, sempre la stessa misura):
//   r = φ, ghiaccio (0 vetro, 1 cristallo)
//   g = u, temperatura (0 freddo, 1 equilibrio)
//   b = orientamento del cristallo (frazione di 60°)
//   a = acqua di fusione
import { P } from '../comune.js';

const COMUNE = `
// costanti del modello di Kobayashi (passo di griglia e di tempo adimensionali)
#define BR_H 0.05
#define BR_DT 0.0005
#define BR_TAU 0.0003
#define BR_EPS 0.010
#define BR_ALPHA 0.9
#define BR_GAMMA 10.0
// tempo della materia in cui comincia il disgelo (mai se Disgelo è zero)
float brThaw() { return disgelo > 0.001 ? u_T * (1.0 - 0.7 * disgelo) : 1e9; }
`;

export const MATERIA = {
  id: 'brina', code: 'Br', name: 'Brina', family: 'minerali', ref: 'Il gelo sulle finestre d’inverno; Viola, la lentezza',
  about: 'Sul vetro davanti alla foto crescono cristalli di ghiaccio veri: nascono sui contorni della foto e sui bordi del quadro, avanzano a felci con rami a sessanta gradi, si fermano dove incontrano altri rami e lasciano strisce di vetro pulito. Scintillano quando la luce gira; col disgelo arretrano dalle punte e lasciano goccioline.',
  steps: 10, simLong: 640, simFixed: true, noloop: true,
  params: [
    P('gelo', 'Freddo del vetro', 0, 1, 0.6, 0.2),
    P('semi', 'Quanti cristalli', 0, 1, 0.45, 0),
    P('felce', 'Rami a felce', 0, 1, 0.6, 0.2),
    P('spessore', 'Spessore dei cristalli', 0, 1, 0.55, 0.2),
    P('scintilla', 'Scintillio', 0, 1, 0.5, 0.3),
    P('appannato', 'Vetro appannato', 0, 1, 0.35, 0.3),
    P('disgelo', 'Disgelo', 0, 1, 0, 0.2),
  ],
  sim: COMUNE + `
vec4 brF(ivec2 c) { return texelFetch(u_st, clamp(c, ivec2(0), ivec2(u_stRes) - 1), 0); }
// ε e ε·ε' in un punto, dal gradiente di φ e dall'orientamento del cristallo
vec2 brEps(vec2 g, float o) {
  float delta = 0.012 + 0.04 * felce;
  float th = atan(g.y, g.x) - o * 1.0471976;
  float e = BR_EPS * (1.0 + delta * cos(6.0 * th));
  float ep = -BR_EPS * 6.0 * delta * sin(6.0 * th);
  return vec2(e, e * ep);
}
// il seme del blocco: centro in celle, istante di nascita, orientamento
#define BR_B 24.0
vec4 brSeed(vec2 b, out vec2 tg, out float len) {
  tg = vec2(1.0, 0.0); len = 0.0;
  vec2 h = hash22(b + S(31.0));
  vec2 ctr = (b + 0.25 + 0.5 * h) * BR_B;
  vec2 uv = ctr / u_stRes;
  // il difetto del vetro: un contorno della foto (gradiente su qualche pixel)
  float d = 2.5 / u_stRes.y;
  float gx = luma(IN(uv + vec2(d, 0.0))) - luma(IN(uv - vec2(d, 0.0)));
  float gy = luma(IN(uv + vec2(0.0, d))) - luma(IN(uv - vec2(0.0, d)));
  float edge = smoothstep(0.03, 0.25, length(vec2(gx, gy)));
  float l = luma(IN(uv));
  float border = 1.0 - smoothstep(0.0, 0.05, min(min(uv.x, 1.0 - uv.x) * ASPECT, min(uv.y, 1.0 - uv.y)));
  float lik = max(edge * (1.1 - 0.6 * l), border * 0.9);
  // un graffio lungo il contorno (o lungo il bordo): da lì le felci partono parallele
  vec2 gg = vec2(gx, gy) + 1e-5;
  tg = normalize(vec2(-gg.y, gg.x));
  if (border > edge) { vec2 dd = min(uv, 1.0 - uv); tg = dd.x * ASPECT < dd.y ? vec2(0.0, 1.0) : vec2(1.0, 0.0); }
  len = max(edge, border) > 0.5 ? 3.0 + 9.0 * hash12(b + S(39.0)) : 0.0;
  // quanti blocchi hanno un seme
  float h2 = hash12(b + S(32.0));
  if (h2 > (0.015 + 0.4 * semi) * (0.03 + lik * lik)) return vec4(-1.0);
  // quando nasce: prima i bordi e i contorni netti, poi gli altri, distribuiti nella clip
  float h3 = hash12(b + S(33.0));
  float tb = (0.15 + 3.5 * h3 * h3) * (1.6 - lik) * (1.4 - gelo);
  return vec4(ctr, tb, hash12(b + S(34.0)));
}
vec4 sim(vec2 uv) {
  ivec2 c = ivec2(floor(uv * u_stRes));
  vec2 cf = vec2(c) + 0.5;
  // il freddo di partenza: il vetro è più freddo dietro gli scuri della foto
  float u0 = mix(0.0, 0.35, luma(IN(uv))) * (1.2 - gelo);
  if (u_init > 0.5) return vec4(0.0, u0, hash12(cf + S(35.0)), 0.0);
  vec4 s = brF(c);
  // vicini: assi, diagonali, a distanza due (per il gradiente nei vicini)
  vec4 n = brF(c + ivec2(0, 1)), so = brF(c + ivec2(0, -1)), e = brF(c + ivec2(1, 0)), w = brF(c + ivec2(-1, 0));
  float ne = brF(c + ivec2(1, 1)).r, nw = brF(c + ivec2(-1, 1)).r, se = brF(c + ivec2(1, -1)).r, sw = brF(c + ivec2(-1, -1)).r;
  float n2 = brF(c + ivec2(0, 2)).r, s2 = brF(c + ivec2(0, -2)).r, e2 = brF(c + ivec2(2, 0)).r, w2 = brF(c + ivec2(-2, 0)).r;
  float ih = 1.0 / (2.0 * BR_H);
  vec2 g0 = vec2(e.r - w.r, n.r - so.r) * ih;
  vec2 gE = vec2(e2 - s.r, ne - se) * ih, gW = vec2(s.r - w2, nw - sw) * ih;
  vec2 gN = vec2(ne - nw, n2 - s.r) * ih, gS = vec2(se - sw, s.r - s2) * ih;
  // l'orientamento: il ghiaccio nuovo eredita quello del vicino più solido
  float o = s.b;
  if (s.r < 0.5) {
    float best = s.r;
    if (n.r > best) { best = n.r; o = n.b; }
    if (so.r > best) { best = so.r; o = so.b; }
    if (e.r > best) { best = e.r; o = e.b; }
    if (w.r > best) { best = w.r; o = w.b; }
  }
  vec2 E0 = brEps(g0, o), EE = brEps(gE, o), EW = brEps(gW, o), EN = brEps(gN, o), ES = brEps(gS, o);
  // ∂y(ε ε' φx) − ∂x(ε ε' φy)
  float t1 = (EN.y * gN.x - ES.y * gS.x) * ih - (EE.y * gE.y - EW.y * gW.y) * ih;
  // ∇·(ε² ∇φ), con ε² medio sulle facce
  float e2c = E0.x * E0.x;
  float t2 = (0.5 * (e2c + EE.x * EE.x) * (e.r - s.r) - 0.5 * (e2c + EW.x * EW.x) * (s.r - w.r)
            + 0.5 * (e2c + EN.x * EN.x) * (n.r - s.r) - 0.5 * (e2c + ES.x * ES.x) * (s.r - so.r)) / (BR_H * BR_H);
  float m = BR_ALPHA / PI * atan(BR_GAMMA * (1.0 - s.g));
  float rn = hash13(vec3(cf, u_frame * 31.0 + u_step) + S(36.0)) - 0.5;
  float ph = s.r;
  float dphi = BR_DT / BR_TAU * (t1 + t2 + ph * (1.0 - ph) * (ph - 0.5 + m + 0.035 * rn * (0.4 + felce)));
  float lapu = (n.g + so.g + e.g + w.g - 4.0 * s.g) / (BR_H * BR_H);
  // il calore latente: più è alto, più i rami restano sottili e radi
  float K = 1.75 - 0.25 * spessore;
  float du = BR_DT * 0.9 * lapu + K * dphi;
  // il vetro continua a raffreddarsi (la brina avanza piano anche dopo), o si scalda nel disgelo
  float warm = smoothstep(brThaw(), brThaw() + 2.0, u_t);
  float target = mix(u0, 1.35, warm) + 0.25 * max(RESPIRO, 0.0);
  du += BR_DT * (0.05 + 0.25 * gelo + 40.0 * warm) * (target - s.g);
  float phi = clamp(ph + dphi, 0.0, 1.0);
  float wat = s.a + max(0.0, ph - phi) * 1.5;
  wat *= 1.0 - BR_DT * 0.15;
  // la nascita dei semi: un disco di qualche cella, dove il vetro è ancora freddo
  vec2 tg; float len;
  vec4 sd = brSeed(floor(cf / BR_B), tg, len);
  if (sd.x >= 0.0 && u_t >= sd.z && u_t < sd.z + 0.6 && warm < 0.01) {
    vec2 dq = cf - sd.xy;
    float d = length(dq - tg * clamp(dot(dq, tg), -len, len));
    if (d < 2.6 && s.g < 0.55) { phi = max(phi, 1.0 - smoothstep(1.6, 2.6, d)); o = sd.w; }
  }
  return vec4(phi, s.g + du, o, min(wat, 1.0));
}`,
  glsl: COMUNE + `
vec3 fx(vec2 uv) {
  vec2 a = vec2(ASPECT, 1.0);
  vec2 sp = 1.0 / u_stRes;
  vec4 s = ST(uv);
  float hC = s.r;
  float hE = ST(uv + vec2(sp.x, 0.0)).r, hW = ST(uv - vec2(sp.x, 0.0)).r;
  float hN = ST(uv + vec2(0.0, sp.y)).r, hS = ST(uv - vec2(0.0, sp.y)).r;
  vec2 g = vec2(hE - hW, hN - hS) * 0.5;
  // spessore: φ mediato su un dischetto; alto sul fusto, basso sui rami fini e sulle punte
  float hb = 0.0;
  for (int i = 0; i < 6; i++) { float an = float(i) * 1.0472; hb += ST(uv + vec2(cos(an), sin(an)) * 1.8 * sp).r; }
  hb /= 6.0;
  float ice = smoothstep(0.3, 0.6, hC);
  float th = ice * smoothstep(0.2, 0.95, hb);
  // i rami sono cordoni tondi: la normale viene dal profilo di φ
  vec3 nrm = normalize(vec3(-g * (2.5 + 5.0 * spessore), 1.0));
  // la foto dietro il vetro: deviata dal cristallo e diffusa dentro di lui
  vec2 off = nrm.xy * 0.004 * (0.3 + th);
  vec3 back = IN(uv - off);
  vec3 dif = vec3(0.0);
  float rb = (1.5 + 4.0 * th) * K1080;
  for (int i = 0; i < 6; i++) {
    float an = float(i) * 1.0472 + 0.5;
    dif += IN(uv - off * 1.5 + vec2(cos(an), sin(an)) * rb * PX);
  }
  dif /= 6.0;
  // condensa: dove il vapore è ancora libero il vetro è velato; attorno ai rami il
  // ghiaccio se l'è già preso e il vetro torna limpido
  float vap = clamp(1.0 - s.g * 1.6, 0.0, 1.0) * (1.0 - ice);
  float fog = appannato * smoothstep(0.15, 0.9, vap) * smoothstep(0.0, 1.5, u_t);
  vec3 c = mix(back, mix(dif, vec3(luma(dif)), 0.3) * 0.82 + 0.1, fog * 0.55);
  // luce radente che gira lentamente: le facce dei cristalli la prendono e la perdono
  float la = 0.6 + 0.35 * sin(u_t * 0.21) + 0.02 * u_t;
  vec3 L = normalize(vec3(cos(la), sin(la), 0.6));
  float dl = dot(nrm, L);
  // il ghiaccio: trasparente dove è sottile, lattiginoso dove è spesso
  float l = luma(dif);
  // su un fondo chiaro il ghiaccio non può schiarire: si legge per il velo grigio e per i bordi
  vec3 milk = mix(dif, vec3(l), 0.5) * 0.55 + vec3(0.36, 0.39, 0.43) * (0.75 + 0.35 * th) * (1.0 - 0.45 * smoothstep(0.45, 0.9, l));
  milk *= 0.86 + 0.28 * dl;
  float opac = ice * (0.18 + 0.55 * th) * (0.65 + 0.5 * spessore);
  c = mix(c, dif * (0.95 + 0.15 * dl), ice * 0.6);
  c = mix(c, milk, clamp(opac, 0.0, 0.92));
  // il bordo del cristallo: una linea nitida, chiara dal lato della luce
  float edge = smoothstep(0.12, 0.38, hC) * (1.0 - smoothstep(0.42, 0.7, hC));
  float lit = max(dot(normalize(-g + 1e-6), L.xy), 0.0);
  c = mix(c, c * 0.78, edge * (1.0 - lit) * 0.5);
  c += edge * (0.03 + 0.12 * lit) * (0.6 + 0.4 * spessore);
  // scintillio: piccole facce piatte, orientate col loro cristallo
  vec2 fc = floor(uv * u_res / (2.0 * K1080));
  vec2 fh = hash22(fc + S(37.0)) - 0.5;
  vec3 fn = normalize(nrm + vec3(rot(s.b * 1.0471976) * fh * 0.8, 0.0));
  vec3 Hh = normalize(L + vec3(0.0, 0.0, 1.0));
  float gl = pow(max(dot(fn, Hh), 0.0), 160.0) * smoothstep(0.5, 0.9, hC);
  c += gl * scintilla * 0.9;
  // gocce di fusione: piccole lenti che capovolgono la foto, con l'orlo scuro
  if (s.a > 0.02) {
    vec2 q = uv * a * 1080.0 / 9.0;
    vec2 id = floor(q), fq = fract(q) - 0.5;
    vec2 hh = hash22(id + S(38.0));
    float r = (0.18 + 0.3 * hh.x) * smoothstep(0.02, 0.4, s.a);
    vec2 dv = fq - (hh - 0.5) * 0.35;
    float dd = length(dv) / max(r, 1e-3);
    if (dd < 1.0) {
      float z = sqrt(1.0 - dd * dd);
      vec3 lens = IN(uv - dv * 0.02 * (1.0 - z) - vec2(0.0, 0.004));
      vec3 dc = mix(lens, lens * 0.55, smoothstep(0.6, 1.0, dd));
      dc += pow(max(dot(normalize(vec3(dv, z)), L), 0.0), 60.0) * 0.5;
      c = mix(c, dc, (1.0 - ice) * smoothstep(1.0, 0.85, dd));
    }
  }
  // il rilievo, per la messa a fuoco della Macro
  FX_H = 0.3 + 0.45 * th;
  return c;
}`,
};
