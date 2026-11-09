// Materia densa: cenere. La foto è un foglio spesso che carbonizza in silenzio
// (dopo la fiamma: niente fuoco, niente brace). Un fronte avanza frastagliato,
// il foglio imbrunisce e si imbarca, diventa crosta di carbone a scaglie
// sollevate, poi cenere chiara a foglie che si sbriciola e scopre il fondo.
import { P } from '../comune.js';

// Rumore a valori, economico (lo stato e il disegno lo chiamano molte volte).
const RUMORE = `
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float s = S(2.0);
  return mix(mix(hash12(i + s), hash12(i + vec2(1.0, 0.0) + s), f.x),
             mix(hash12(i + vec2(0.0, 1.0) + s), hash12(i + 1.0 + s), f.x), f.y);
}
float vf(vec2 p) { return 0.57 * vn(p) + 0.29 * vn(p * 2.13 + 13.7) + 0.14 * vn(p * 4.31 + 5.1); }
`;

const SIM = RUMORE + `
vec4 STX(ivec2 c) { return texelFetch(u_st, clamp(c, ivec2(0), ivec2(u_stRes) - 1), 0); }
vec4 sim(vec2 uv) {
  vec2 a = vec2(ASPECT, 1.0);
  ivec2 ic = ivec2(gl_FragCoord.xy);
  if (u_init > 0.5) {
    vec2 e = 2.5 / u_stRes;
    float l0 = luma(IN(uv));
    float lx1 = luma(IN(uv + vec2(e.x, 0.0))), lx0 = luma(IN(uv - vec2(e.x, 0.0)));
    float ly1 = luma(IN(uv + vec2(0.0, e.y))), ly0 = luma(IN(uv - vec2(0.0, e.y)));
    float L = (l0 * 2.0 + lx1 + lx0 + ly1 + ly0) / 6.0;
    float E = smoothstep(0.05, 0.25, length(vec2(lx1 - lx0, ly1 - ly0)));
    vec2 p = uv * a;
    // la velocità del fronte: a dita (canali nella carta), lenta sul chiaro
    // e ferma nelle chiazze "umide", così una parte della foto si salva
    float rough = vf(p * 21.0) + 0.6 * vf(p * 6.0 + 4.0) - 0.8;
    float fing = 0.05 + 2.1 * smoothstep(-0.14, 0.22, rough);
    float dk = 1.0 - L;
    float damp = vf(p * 1.6 + 3.3) + 0.45 * (dk - 0.5);
    float open = smoothstep(0.36, 0.56, damp);
    float v = fing * (0.1 + 1.5 * dk * dk) * (0.02 + 0.98 * open);
    // inneschi radi: qualche punto, più volentieri nel buio
    float cs = mix(0.52, 0.2, inneschi);
    vec2 cl = floor(p / cs);
    vec2 sp = (cl + 0.15 + 0.7 * hash22(cl + S(1.0))) * cs;
    float Ls = luma(IN(sp / a));
    float dmp = vf(sp * 1.6 + 3.3) + 0.45 * (0.5 - Ls);
    float on = step(hash12(cl + S(2.0)), 0.25 + 0.75 * smoothstep(0.38, 0.6, dmp));
    vec2 dt = (p - sp) * u_stRes.y;
    float t0 = 1e4;
    if (on > 0.5 && dot(dt, dt) < 9.5) t0 = hash12(cl + S(3.0)) * 0.9 + length(dt) * 0.06;
    // e lungo i bordi scuri della foto
    float hp = hash12(gl_FragCoord.xy + S(4.0));
    if (hp < 0.0035 * inneschi * E * smoothstep(0.6, 0.25, L) * open * step(0.35, v)) t0 = min(t0, 0.2 + 2.6 * hash12(gl_FragCoord.xy + S(5.0)));
    return vec4(t0, v, 0.0, t0);
  }
  vec4 me = STX(ic);
  float best = me.x;
  float tn = u_t;
  // alone di calore: una distanza dal bruciato che cresce piano
  float kz = 1.0 / ((0.012 + 0.085 * bruciatura) * u_stRes.y);
  float zt = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    if (i == 0 && j == 0) continue;
    vec4 n = STX(ic + ivec2(i, j));
    // un po' di anticipo: davanti al fronte il calore ha già il suo tempo d'arrivo
    zt = max(zt, n.z - kz * length(vec2(float(i), float(j))));
    if (n.x > tn + 2.0) continue;
    // il fuoco si stanca: più tardi arriva, più va piano
    float q = n.x / 5.0;
    float v = me.y * combustione * 0.075 / (1.0 + q * q);
    float c = n.x + length(vec2(float(i), float(j))) / u_stRes.y / max(v, 1e-4);
    best = min(best, c);
  }
  if (best <= tn) zt = 1.0;
  float z = max(me.z, min(zt, me.z + 0.8 / (u_fps * 5.0)));
  return vec4(best, me.y, z, min(best, tn + 2.0));
}`;

const FX = RUMORE + `
const vec2 WD = vec2(0.94, 0.34);           // da dove tira la corrente
float g_pB, g_pA, g_age, g_hhB, g_hhA, g_ashB, g_ashA, g_dust, g_sc, g_fib, g_wr;

// celle: distanza dal bordo (bisettrice), identità, vettore verso il centro,
// e un numero per il bordo più vicino (non tutti i bordi si aprono)
float vor(vec2 x, out vec2 cid, out vec2 toC, out float eh) {
  vec2 n = floor(x), f = fract(x);
  float d1 = 8.0, d2 = 8.0;
  vec2 r1 = vec2(0.0), r2 = vec2(0.0), g1 = vec2(0.0), g2 = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 r = g + 0.1 + 0.8 * hash22(n + g + S(21.0)) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; r2 = r1; g2 = g1; d1 = d; r1 = r; g1 = g; }
    else if (d < d2) { d2 = d; r2 = r; g2 = g; }
  }
  cid = n + g1; toC = r1;
  eh = hash12(2.0 * n + g1 + g2 + S(22.0));
  return (d2 - d1) / (2.0 * max(length(r2 - r1), 1e-3));
}

// una foglia del foglio: scaglia di carbone che si incurva, poi lamella di
// cenere che si stacca e si sbriciola dai bordi. Restituisce il suo rilievo.
float leaf(vec2 p, float s, float age, float d0, float d1, float prob, float sd, float ea, float rg,
           out float pres, out float hh, out float ashk, out float gone) {
  vec2 x = p * s + sd * 7.31;
  vec2 cid, toC; float eh;
  float ed = vor(x, cid, toC, eh);
  hh = hash12(cid + S(31.0) + sd);
  float h2 = hash12(cid + S(32.0) + sd), h3 = hash12(cid + S(33.0) + sd);
  float ch = smoothstep(0.0, 0.5, age);
  ashk = smoothstep(1.4, 3.6, age + 0.4 * (1.0 - smoothstep(0.0, 0.45, ed)) + (hh - 0.5) * 2.6 + rg * 0.7);
  // crepe: capelli quasi ovunque, alcune si aprono; con la cenere si aprono di più
  float op = smoothstep(0.5, 0.62, eh * 0.7 + 0.5 * ashk + 0.1 * smoothstep(0.5, 2.5, age));
  float w = ch * mix(0.008, 0.03 + 0.04 * hh + 0.08 * ashk, op);
  // la foglia si stacca tutta insieme: conta l'età al suo centro
  vec2 cuv = (p + (toC - sd * 0.0) / s) / vec2(ASPECT, 1.0);
  float arrC = ST(cuv).w;
  float er = max(u_t - arrC - mix(d0, d1, h2), 0.0) * step(h3, prob);
  float ern = 0.0;
  if (er > 0.0) {
    vec2 dirc = -toC / max(length(toC), 1e-3);
    ern = er * 0.28 * (1.0 + 0.7 * corrente * dot(dirc, -WD)) * (0.4 + 1.2 * vn(p * 90.0 + sd)) * max(ashk, ea);
  }
  gone = smoothstep(0.02, 0.3, ern);
  float aa = s * 1.3 / u_res.y;
  float din = ed - w - ern;
  pres = smoothstep(-aa, 0.0, din);
  float rim = 1.0 - smoothstep(0.0, 0.2 + 0.4 * h3, din + 0.07 * rg);
  float lift = max(op, gone);
  float curl = ch * (0.22 + 1.0 * ashk) * (0.2 + 1.0 * h2) * pow(rim, 1.6) * lift;
  float ta = hh * 43.0;
  float flut = 1.0 + corrente * ashk * 0.6 * sin(u_t * (1.3 + 2.4 * h3) + hh * 50.0);
  float tilt = dot(-toC, vec2(cos(ta), sin(ta))) * ch * (0.05 + 0.95 * ashk) * flut * (0.3 + 0.9 * h3);
  return curl + tilt;
}

// campo d'altezza: 0 = foglio intatto, -1 = foglia di sotto, -2.2 = fondo
float hgt(vec2 uv, int q) {
  vec2 a = vec2(ASPECT, 1.0);
  vec2 p = uv * a;
  vec4 st = ST(uv);
  float rag = (vn(p * 52.0) - 0.5) + (vn(p * 15.0 + 5.0) - 0.5);
  float age = u_t - st.w + rag * 0.8;
  float sc = smoothstep(0.0, 1.0, st.z * (1.0 + 0.7 * rag));
  sc = max(sc, smoothstep(-0.3, 0.2, age));
  g_age = age; g_sc = sc; g_pB = 1.0; g_pA = 1.0; g_dust = 0.0; g_fib = 0.0; g_wr = 0.0;
  g_ashB = 0.0; g_ashA = 0.0; g_hhB = 0.5; g_hhA = 0.5;
  if (sc <= 0.0) return 0.0;
  // il foglio si imbarca e fa bolle prima di annerire
  float bk = (vn(p * 5.5 + 2.0) - 0.5) * 1.7 * sc + (vn(p * 14.0 + 8.0) - 0.5) * 0.8 * sc * sc;
  float bl = smoothstep(0.6, 0.88, vn(p * 34.0 + 9.0));
  bl = sqrt(bl) * 0.6 * smoothstep(0.3, 0.9, sc) * (0.4 + 0.6 * bruciatura);
  float hB = bk + bl;
  if (age <= -0.05) return hB;
  // il foglio non è mai regolare: le celle si deformano
  vec2 pq = p + 0.016 * vec2(vn(p * 11.0 + 3.0), vn(p * 11.0 + 17.0)) + 0.0045 * vec2(vn(p * 47.0 + 23.0), vn(p * 47.0 + 31.0));
  float pB, hhB, ashB, goneB;
  float lB = leaf(pq, scaglie, age, 1.5, 5.5, sfaldo, 0.0, 0.0, rag, pB, hhB, ashB, goneB);
  hB = bk + bl * (1.0 - ashB) + lB - 0.25 * ashB;
  float ch = smoothstep(0.0, 0.5, age);
  float mf = clamp(u_res.y / 600.0, 0.35, 1.0);
  if (q > 0) {
    // carbone fibroso e raggrinzito, lamine di cenere
    vec2 pr = rot(0.5 + 2.0 * hhB) * p;
    float fib = vn(pr * vec2(38.0, 210.0)) - 0.5 + 0.6 * (vn(pr * vec2(90.0, 300.0) + 7.0) - 0.5);
    float wr = 1.0 - abs(2.0 * vn(pq * 27.0 + 40.0) - 1.0);
    wr = wr * wr * wr;
    float lam = vn(rot(hhB * 9.0) * p * vec2(22.0, 150.0) + hhB * 30.0) - 0.5;
    hB += ch * (mf * (0.2 * fib * (1.0 - ashB) + 0.3 * lam * ashB) + 0.1 * mf * (vn(p * 240.0) - 0.5) - 0.45 * wr * (1.0 - 0.5 * ashB));
    g_fib = fib; g_wr = wr;
  }
  g_pB = pB; g_hhB = hhB; g_ashB = ashB;
  if (pB > 0.998) return hB;
  float pA, hhA, ashA, goneA;
  float lA = leaf(pq, scaglie * 0.63, age - 2.4, 2.0, 7.5, sfaldo * 0.9, 1.0, 1.0, rag, pA, hhA, ashA, goneA);
  float hA = -1.0 + 0.5 * bk + 0.85 * lA;
  float hV = -2.2 + 0.25 * vn(p * 30.0 + 1.0);
  if (q > 0) {
    float lamA = vn(rot(hhA * 9.0) * p * vec2(18.0, 130.0) + hhA * 30.0) - 0.5;
    hA += mf * (0.25 * lamA + 0.12 * (vn(p * 240.0 + 3.0) - 0.5));
    hV += mf * 0.12 * (vn(p * 200.0 + 11.0) - 0.5);
    // polvere: resta dove le foglie si sono sbriciolate e la corrente la sposta
    vec2 pw = p - WD * u_t * 0.035 * corrente;
    float drift = vf(rot(0.35) * pw * vec2(7.0, 26.0));
    float gr = vn(pw * 170.0);
    float dust = goneB * (1.0 - pB) * smoothstep(0.36, 0.62, drift * 0.75 + gr * 0.25) * (0.5 + 0.5 * gr);
    hA += dust * 0.3; hV += dust * 0.45;
    g_dust = dust;
  }
  g_pA = pA; g_hhA = hhA; g_ashA = ashA;
  return mix(mix(hV, hA, pA), hB, pB);
}

vec3 fx(vec2 uv) {
  vec2 a = vec2(ASPECT, 1.0);
  vec2 p = uv * a;
  float e = max(1.5 / 1080.0, 0.8 / u_res.y);
  float h0 = hgt(uv, 1);
  float pB = g_pB, pA = g_pA, age = g_age, hhB = g_hhB, hhA = g_hhA, ashB = g_ashB, ashA = g_ashA;
  float dust = g_dust, sc = g_sc, fib = g_fib, wr = g_wr;
  // lontano dal fronte il foglio è intatto: la foto com'è
  if (sc <= 0.0) return IN(uv);
  float hx = hgt(uv + vec2(e / ASPECT, 0.0), 1);
  float hy = hgt(uv + vec2(0.0, e), 1);
  float Z = 0.011 * rilievo;
  vec2 g = vec2(hx - h0, hy - h0) / e * Z;
  g /= 1.0 + 0.5 * length(g);
  vec3 n = normalize(vec3(-g, 1.0));
  float th = luce * TAU;
  vec2 l2 = vec2(cos(th), sin(th));
  vec3 l3 = normalize(vec3(l2, 0.7));
  float dif = dot(n, l3) / l3.z;
  // ombre portate corte sotto i bordi sollevati + occlusione nelle cavità
  float sst = max(5.0 / 1080.0, 1.0 / u_res.y);
  float kS = 0.5 / max(Z, 1e-4);
  float shd = 0.0, cav = (hx + hy) * 0.5 - h0;
  for (int i = 1; i <= 3; i++) {
    float d = float(i) * sst;
    float hs = hgt(uv + l2 * d / a, 0);
    shd = max(shd, smoothstep(0.0, 0.5, hs - h0 - d * kS) * (1.0 - 0.2 * float(i - 1)));
    cav += (hs - h0) * 0.33;
  }
  float ao = 1.0 - 0.4 * smoothstep(0.1, 1.6, cav * 0.5) * min(rilievo, 1.0);

  // la foto, spostata dal rilievo del foglio che si imbarca
  vec3 img = IN(uv + n.xy * 0.012 * rilievo * sc / a);
  float L = luma(img);
  float ch = smoothstep(0.0, 0.5, age);
  // 1. bruciatura: ingiallisce, imbrunisce, annerisce
  vec3 c = img;
  c = mix(c, c * vec3(0.92, 0.8, 0.58), smoothstep(0.0, 0.5, sc) * 0.85);
  c = mix(c, vec3(0.4, 0.26, 0.15) * (0.2 + 0.9 * L), smoothstep(0.35, 0.85, sc) * 0.9);
  c = mix(c, vec3(0.15, 0.09, 0.055) * (0.4 + 0.9 * L), smoothstep(0.75, 1.0, sc));
  // 2. carbone: nero bruno, la foto resta come fantasma di toni
  float Lg = smoothstep(0.0, 0.62, L);
  vec3 carb = mix(vec3(0.022, 0.019, 0.017), vec3(0.3, 0.26, 0.225), Lg) + (img - L) * 0.1;
  carb *= (1.0 + 0.5 * fib) * (1.0 - 0.35 * wr);
  carb = mix(carb, carb * vec3(1.25, 1.0, 0.8), 0.5 * hhB);
  // 3. cenere: grigio chiaro e opaco, l'impronta della foto appena leggibile
  vec3 ashc = mix(vec3(0.36, 0.352, 0.34), vec3(0.82, 0.805, 0.77), Lg) + (img - L) * 0.1;
  ashc *= 0.78 + 0.3 * hhB;
  ashc = mix(ashc, ashc * vec3(1.04, 0.99, 0.92), hash11(hhB * 91.0));
  float lamc = vn(rot(hhB * 9.0) * p * vec2(22.0, 150.0) + hhB * 30.0);
  ashc *= (0.88 + 0.22 * lamc) * (1.0 - 0.2 * wr);
  vec3 top = mix(c, carb, ch);
  top = mix(top, ashc, ashB * 0.94);
  // foglia di sotto: più scura, già carbone
  vec3 carbA = mix(vec3(0.04, 0.031, 0.025), vec3(0.24, 0.19, 0.15), Lg);
  vec3 ashA3 = mix(vec3(0.25, 0.243, 0.236), vec3(0.6, 0.585, 0.56), Lg) * (0.85 + 0.25 * hhA);
  vec3 low = mix(carbA, ashA3, ashA * 0.9);
  low *= 0.9 + 0.25 * vn(rot(hhA * 9.0) * p * vec2(18.0, 130.0) + hhA * 30.0);
  // il fondo: nero caldo e profondo, con la sua trama
  vec3 bot = vec3(0.04, 0.028, 0.021) * (0.5 + 0.9 * vf(p * 30.0 + 1.0)) + img * vec3(0.035, 0.028, 0.02);
  vec3 dc = vec3(0.66, 0.65, 0.62) * (0.75 + 0.35 * L);
  low = mix(low, dc, dust * 0.75);
  bot = mix(bot, dc * 0.92, dust * 0.85);
  vec3 col = mix(mix(bot, low, pA), top, pB);
  // luce radente morbida, opaca: la cenere non brilla
  float amt = clamp(sc * 1.5 + (1.0 - pB), 0.0, 1.0);
  float lit = clamp(dif, mix(0.3, 0.52, ashB * pB), 1.0 + 0.28 * (1.0 - 0.6 * ashB * pB));
  lit = mix(1.0, lit, 0.9);
  col *= mix(1.0, lit * ao * (1.0 - 0.6 * shd), amt);
  return col;
}`;

export const MATERIA = {
  id: 'cenere', code: 'Nr', name: 'Cenere', family: 'dense', ref: 'Burri, Combustioni',
  steps: 5, simLong: 480, noloop: true,
  about: 'La foto è un foglio spesso che carbonizza in silenzio: il fronte avanza a dita, la carta imbrunisce e si imbarca, diventa crosta nera a scaglie sollevate e poi cenere chiara che si sfoglia, si sbriciola e scopre il fondo.',
  params: [
    P('combustione', 'Combustione', 0.2, 2.5, 1, 0.15),
    P('inneschi', 'Inneschi', 0, 1, 0.5, 0),
    P('bruciatura', 'Bruciatura', 0, 1, 0.6, 0.2),
    P('scaglie', 'Scaglie', 8, 40, 16, 0),
    P('sfaldo', 'Sfaldamento', 0, 1, 0.7, 0.1),
    P('corrente', 'Corrente', 0, 1, 0.5, 0.3),
    P('rilievo', 'Rilievo', 0, 1.5, 1, 0.15),
    P('luce', 'Direzione delle ombre', 0, 1, 0.36, 0, { step: 0.01 }),
  ],
  sim: SIM,
  glsl: FX,
};
