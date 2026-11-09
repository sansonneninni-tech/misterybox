// Materia densa: bitume. Una massa nera e viscosa esce dai bui della foto,
// avanza con un labbro spesso, fa la pelle, si raggrinza in corde, gonfia
// bolle che scoppiano. Lo stato della simulazione tiene: xy = trascinamento
// della foto (in uv), z = spessore della massa, w = macchia lasciata.
// Lo stato è morbido (480 px sul lato lungo, uguale in anteprima e in 4K):
// labbro, corde, bolle e grana si disegnano a piena risoluzione nel fx.
import { P } from '../comune.js';

const COMUNE = `
vec2 btMir(vec2 q) { return 1.0 - abs(1.0 - mod(q, 2.0)); }
`;

export const MATERIA = {
  id: 'bitume', code: 'Bt', name: 'Bitume', family: 'dense', ref: 'Burri, Catrami',
  steps: 2, simLong: 480, noloop: true,
  about: 'Un catrame pesante esce dai bui della foto e la inghiotte piano: avanza con un labbro spesso, la pelle si raggrinza in corde, le bolle si gonfiano e lasciano crateri; dove è sottile macchia la foto di bruno, dove è spesso ne conserva la luce come un ricordo.',
  params: [
    P('colata', 'Colata', 0, 1, 0.5, 0.2),
    P('spessore', 'Spessore', 0.2, 2, 1, 0.2),
    P('pelle', 'Pelle raggrinzita', 0, 1, 0.6, 0.3),
    P('bolle', 'Bolle', 0, 1, 0.5, 0.2),
    P('trasparenza', 'Trasparenza', 0, 1, 0.5, 0.3),
    P('memoria', 'Memoria della foto', 0, 1, 0.5, 0.3),
    P('velocita', 'Velocità', 0, 2, 1, 0.2),
    P('luce', 'Direzione delle ombre', 0, 360, 125, 0, { step: 1 }),
  ],
  sim: COMUNE + `
float btLum(vec2 uv) {
  vec2 b = PX * K1080 * 16.0;
  return (luma(IN(uv)) * 2.0 + luma(IN(btMir(uv + vec2(b.x, 0.0)))) + luma(IN(btMir(uv - vec2(b.x, 0.0))))
    + luma(IN(btMir(uv + vec2(0.0, b.y)))) + luma(IN(btMir(uv - vec2(0.0, b.y))))) / 6.0;
}
// dove il bitume vuole stare: i bui di questa foto, sorgenti rade, e una
// marea lenta che lo fa avanzare da una parte e ritirare dall'altra
float btTarget(vec2 uv, float t) {
  vec2 a = vec2(ASPECT, 1.0);
  vec2 p = (uv - 0.5) * a;
  float mean = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    mean += luma(IN(vec2(mod(fi, 3.0) + 0.5, floor(fi / 3.0) + 0.5) / vec2(3.0, 2.0)));
  }
  mean /= 6.0;
  float l = btLum(uv);
  float dark = (mean * 0.9 - l) / max(mean, 0.18);
  float nz = fbm(p * 1.25 + S(2.0), t * 0.1, 0.0, 3);
  float nz2 = gnoise(vec3(p * 3.1 + 4.0, t * 0.09 + 2.0), 0.0);
  float ramp = 0.3 + 0.7 * (1.0 - exp(-t / 2.2));
  // sorgenti rade
  vec2 c = p * 1.7 + S(5.0);
  vec2 id = floor(c);
  vec2 hh = hash22(id + 3.1);
  float src = exp(-dot(fract(c) - 0.25 - 0.5 * hh, fract(c) - 0.25 - 0.5 * hh) * 14.0) * step(0.55, hash12(id + 9.7));
  float tg = 0.06 + clamp(dark, -0.8, 1.0) * 0.62 + (nz * 1.9 + nz2 * 0.22) * (0.35 + 0.65 * ramp) + ramp * 0.15 + src * 0.6 * ramp + (colata - 0.5) * 1.5;
  return clamp(tg, 0.0, 1.3) * smoothstep(0.0, 0.12, colata);
}
vec4 sim(vec2 uv) {
  float t = u_t * velocita;
  if (u_init > 0.5) { float h0 = btTarget(uv, 0.0); return vec4(0.0, 0.0, h0 * 0.95, smoothstep(0.45, 0.56, h0 * 0.95)); }
  vec2 a = vec2(ASPECT, 1.0);
  vec2 p = (uv - 0.5) * a;
  float dt = 2.0 * velocita * 24.0 / max(u_fps, 1.0);
  vec4 s = ST(uv);
  vec2 e = SPX * 1.5;
  float hE = ST(uv + vec2(e.x, 0.0)).z, hW = ST(uv - vec2(e.x, 0.0)).z;
  float hN = ST(uv + vec2(0.0, e.y)).z, hS = ST(uv - vec2(0.0, e.y)).z;
  vec2 gh = vec2(hE - hW, hN - hS) / (2.0 * e * a); // per unità di quadro
  float body = smoothstep(0.2, 0.6, s.z);
  // la massa si allarga da dove è spessa, e cola piano verso il basso
  vec2 v = -gh * 1.5e-5 * body;
  v = v / max(1.0, length(v) / 2.5e-4);
  float sl = 0.5 + gnoise(vec3(p * 2.3, t * 0.05 + 6.0), 0.0);
  v += vec2(gnoise(vec3(p * 1.9 + 3.0, t * 0.05), 0.0) * 0.6, -1.0) * 6e-5 * body * sl;
  v *= dt / a;
  vec4 o = ST(uv - v);
  float h = mix(o.z, (hE + hW + hN + hS) * 0.25, 0.22);
  float tg = btTarget(uv, t);
  h += (tg - h) * (tg > h ? 0.016 : 0.0055) * dt;
  // la foto è trascinata dal flusso; fuori dalla massa torna piano al suo posto
  vec2 se = SPX;
  vec4 on = (ST(uv - v + vec2(se.x, 0.0)) + ST(uv - v - vec2(se.x, 0.0)) + ST(uv - v + vec2(0.0, se.y)) + ST(uv - v - vec2(0.0, se.y))) * 0.25;
  vec2 d = mix(o.xy, on.xy, 0.1) - v;
  d *= 1.0 - 0.006 * dt * (1.0 - smoothstep(0.25, 0.5, h));
  float dl = length(d * a);
  d *= 1.0 - 0.03 * smoothstep(0.05, 0.12, dl);
  // la macchia resta dove il bitume è passato, e sbiadisce piano
  float w = max(mix(o.w, on.w, 0.05) - 0.0007 * dt, smoothstep(0.4, 0.56, h));
  return vec4(d, clamp(h, 0.0, 1.5), clamp(w, 0.0, 1.0));
}`,
  glsl: COMUNE + `
#define BT_THR 0.5
// lettura morbida dello stato (B-spline cubica, 4 letture): niente gradini in 4K
vec4 btBs(vec2 uv) {
  vec2 t = uv * u_stRes - 0.5;
  vec2 i = floor(t), f = fract(t);
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0, w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0, w2 = 1.0 - w0 - w1 - w3;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 a0 = (i + w1 / g0 - 0.5) / u_stRes, a1 = (i + w3 / g1 + 1.5) / u_stRes;
  return g0.y * (g0.x * ST(vec2(a0.x, a0.y)) + g1.x * ST(vec2(a1.x, a0.y)))
       + g1.y * (g0.x * ST(vec2(a0.x, a1.y)) + g1.x * ST(vec2(a1.x, a1.y)));
}
// rumore di valore 2D, leggero: per la grana e i contorni a piena risoluzione
float btVn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y) - 0.5;
}
float btEdge(vec2 pp) {
  return 0.05 * btVn(pp / 44.0 + S(6.0)) + 0.008 * btVn(pp / 15.0 + 3.0);
}
// massa: labbro tondo di larghezza W (px a 1080) e spessore del corpo
float btMacro(float T, float g, float A, float W) {
  if (T <= 0.0) return 0.0;
  float dist = T / max(g, 0.0011);
  float x = clamp(dist / W, 0.0, 1.0);
  float lip = sqrt(x * (2.0 - x));
  float k = (dist - W * 0.9) / (W * 1.2);
  return A * (lip * 0.7 + 0.34 * exp(-k * k) * x + 0.5 * smoothstep(0.0, 0.55, T));
}
// bolle: gonfiano lente, scoppiano, lasciano un cratere che si richiude
float btBlister(vec2 qq, float cell, float tt, float amt, out float cav) {
  cav = 0.0;
  vec2 gq = qq / cell;
  vec2 id = floor(gq);
  vec3 h0 = hash33(vec3(id, S(3.0) + cell));
  float cyc = tt * (0.55 + 0.6 * h0.y) + h0.z * 7.0;
  float ph = fract(cyc);
  vec3 hh = hash33(vec3(id + 17.0 * floor(cyc), cell + 5.0));
  if (hh.x > amt) return 0.0;
  vec2 f = fract(gq) - 0.5 - (hh.yz - 0.5) * 0.3;
  float R = 0.17 + 0.16 * fract(hh.x * 37.0 / max(amt, 0.01));
  float r = length(f) / R;
  if (r > 1.6) return 0.0;
  float hgt = R * cell * 0.5;
  if (ph < 0.6) {
    float sw = smoothstep(0.0, 0.6, ph);
    float rr = r / (0.45 + 0.55 * sw);
    return hgt * sw * pow(max(1.0 - rr * rr, 0.0), 0.7);
  }
  float k = (ph - 0.6) / 0.4;
  float fade = 1.0 - smoothstep(0.35, 1.0, k);
  float pop = smoothstep(0.0, 0.08, k);
  float rim = exp(-(r - 1.0) * (r - 1.0) / 0.035);
  float bowl = 1.0 - smoothstep(0.0, 1.0, r);
  cav = fade * bowl * pop;
  return hgt * fade * mix(pow(max(1.0 - r * r, 0.0), 0.7), rim * 0.4 - bowl * 0.75, pop);
}
// altezza completa in px a 1080: massa + corde + bolle + grana
float btH(float Tr, float g, vec2 pp, vec2 qq, float A, float W, float tt, out float cav) {
  cav = 0.0;
  float T = Tr - btEdge(pp);
  if (T <= 0.0) return 0.0;
  float H = btMacro(T, g, A, W);
  float dist = T / max(g, 0.0011);
  float inside = smoothstep(W * 0.5, W * 1.5, dist);
  // corde (pahoehoe): cordoni corti e tondi dietro il labbro, a ventaglio,
  // con passo irregolare e capi spezzati; nel corpo, fasci ad arco a chiazze,
  // e tra un fascio e l'altro la pelle è distesa e liscia
  float back = max(dist - W, 0.0);
  float warp = btVn(qq / 110.0 + 2.0) * 2.6 + btVn(qq / 38.0 + 5.0) * 0.5;
  float lam = 17.0 * (1.0 + 0.5 * btVn(qq / 90.0 + 9.0));
  float dr = Tr / max(g, 0.0032);
  float u1 = back / lam + warp;
  float k1 = floor(u1), f1 = fract(u1);
  float cord1 = sqrt(max(1.0 - (2.0 * f1 - 1.0) * (2.0 * f1 - 1.0), 0.0));
  float on1 = smoothstep(-0.05, 0.12, btVn(qq / vec2(34.0, 34.0) + k1 * 7.31) + 0.25 - hash11(k1 + 3.0) * 0.35);
  float env = pelle * inside * exp(-back / 48.0) * smoothstep(-0.25, 0.1, btVn(qq / 95.0 + 3.3));
  // fasci ad arco: direzione che gira lenta, la fase si curva a ventaglio
  float ang = btVn(qq / 260.0 + 1.4) * 4.0 + btVn(qq / 90.0 + 8.8) * 0.9;
  vec2 dv = vec2(cos(ang), sin(ang));
  float u2 = dot(qq, dv) / (15.0 * (1.0 + 0.45 * btVn(qq / 70.0 + 2.6))) + warp * 0.6;
  float k2 = floor(u2), f2 = fract(u2);
  float cord2 = sqrt(max(1.0 - (2.0 * f2 - 1.0) * (2.0 * f2 - 1.0), 0.0));
  float on2 = smoothstep(-0.05, 0.12, btVn(qq / 26.0 + k2 * 5.17) + 0.2);
  float chz = smoothstep(0.12, 0.3, btVn(qq / 170.0 + 7.7) + 0.35 * btVn(qq / 55.0 + 1.7));
  float env2 = pelle * inside * chz * (1.0 - exp(-back / 40.0));
  float r1 = env * on1, r2 = env2 * on2;
  H += A * 0.55 * (r1 * (cord1 - 0.6) + r2 * (cord2 - 0.6));
  cav += (r1 * (1.0 - cord1) + r2 * (1.0 - cord2)) * 0.85;
  // bolle a due misure
  float c1, c2;
  float bl = btBlister(qq, 118.0, tt, bolle * 0.5, c1) + btBlister(qq + 31.0, 52.0, tt * 1.3 + 0.4, bolle * 0.22, c2);
  H += bl * inside * (0.6 + 0.4 * A / 10.0);
  cav += (c1 + c2 * 0.7) * inside;
  // strisce di trascinamento e grana della pelle
  H += inside * (A * 0.3 * btVn(qq / 85.0 + 4.0) + A * 0.1 * btVn(qq / 31.0 + 1.0) + 0.25 * btVn(qq / 6.0 + 4.0) + 0.14 * btVn(pp / 3.0 + 8.0));
  return H;
}
vec3 fx(vec2 uv) {
  vec4 st = btBs(uv);
  vec2 e = SPX;
  vec2 kpx = u_res / K1080;                 // uv -> px a 1080
  float hs = st.z;
  vec2 gh = vec2(btBs(uv + vec2(e.x, 0.0)).z - hs, btBs(uv + vec2(0.0, e.y)).z - hs) / (e * kpx);
  float g = length(gh);
  vec2 pp = uv * kpx;
  // il disegno della pelle viaggia con la materia (trascinamento esagerato: strisce)
  vec2 qq = pp + st.xy * kpx * 2.5;
  float A = 10.0 * spessore, W = 15.0 * (0.5 + 0.5 * spessore);
  float tt = u_t * velocita * 0.3;
  float T = hs - BT_THR;
  float Tn = T - btEdge(pp);
  float Hm = btMacro(Tn, g, A, W);

  // foto trascinata, macchiata di bruno dove il bitume è sottile o è passato
  vec3 ph = IN(btMir(uv + st.xy));
  // macchia che trasuda: stretta, a frange, mai un alone soffiato
  float sq = T + 0.03 * btVn(pp / 13.0 + 1.1) + 0.012 * btVn(pp / 4.0 + 7.0) + 0.05 * btVn(pp / 60.0 + 2.2);
  float halo = smoothstep(-0.012 - 0.045 * trasparenza, 0.004, sq);
  halo *= halo * halo;
  // il residuo non è un velo uniforme: aloni e strisce dove la massa si è ritirata
  float res = st.w * 0.55 * smoothstep(-0.12, 0.2, btVn(pp / 30.0 + 6.1) + 0.5 * btVn(pp / 8.0 + 1.9));
  float stain = max(res, halo);
  vec3 kab = vec3(0.72, 1.0, 1.38);
  vec3 under = ph * exp(-kab * stain * (0.5 + 1.3 * trasparenza));
  under = mix(under, vec3(luma(under)) * vec3(1.05, 0.93, 0.78), stain * 0.25);

  // ombra portata corta del labbro, lungo la direzione della luce
  float la = radians(luce);
  vec2 L2 = vec2(cos(la), sin(la));
  float sh = 0.0, amb = 0.0;
  for (int i = 1; i <= 5; i++) {
    float dpx = float(i) * 4.5 * (0.6 + 0.4 * spessore);
    vec2 su = uv + L2 * dpx / kpx;
    float hq = ST(su).z - BT_THR - btEdge(su * kpx);
    float Hq = btMacro(hq, g, A, W);
    sh = max(sh, (Hq - Hm - dpx * 0.5) / 3.5);
    amb += max(Hq - Hm, 0.0) / float(i);
  }
  sh = clamp(sh, 0.0, 1.0);
  float occ = clamp(amb / (A * 2.2), 0.0, 1.0);
  under *= 1.0 - 0.62 * sh;
  under *= 1.0 - 0.5 * smoothstep(0.0, 0.5, occ);
  if (Tn <= 0.0) return clamp(mix(IN(uv), under, smoothstep(0.0, 0.1, colata)), 0.0, 1.0);

  // superficie del bitume
  float cav, c1, c2;
  float dl = 1.0;
  float H0 = btH(T, g, pp, qq, A, W, tt, cav);
  float Hx = btH(T + gh.x * dl, g, pp + vec2(dl, 0.0), qq + vec2(dl, 0.0), A, W, tt, c1);
  float Hy = btH(T + gh.y * dl, g, pp + vec2(0.0, dl), qq + vec2(0.0, dl), A, W, tt, c2);
  vec3 n = normalize(vec3(-(Hx - H0) / dl, -(Hy - H0) / dl, 1.0));
  vec3 L = normalize(vec3(L2, 0.6));
  float lam = dot(n, L);
  // colore: bruni e blu-neri profondi, e la luce della foto come memoria
  vec2 b = PX * K1080 * 6.0;
  vec2 mq = uv + st.xy + n.xy * 0.022;
  vec3 mem = (IN(btMir(mq)) * 2.0 + IN(btMir(mq + vec2(b.x, b.y))) + IN(btMir(mq + vec2(-b.x, b.y)))
    + IN(btMir(mq + vec2(b.x, -b.y))) + IN(btMir(mq - vec2(b.x, b.y)))) / 6.0;
  float lm = luma(mem);
  float thk = smoothstep(0.02, 0.4, Tn) * 0.7 + 0.3 * (0.5 + btVn(qq / 160.0 + 5.0) * 1.4);
  vec3 tar = mix(vec3(0.036, 0.026, 0.019), vec3(0.012, 0.014, 0.020), clamp(thk, 0.0, 1.0));
  tar += memoria * (pow(lm, 1.15) * mix(vec3(0.3, 0.24, 0.17), vec3(0.2, 0.2, 0.22), thk) + mem * 0.12);
  float dif = 0.2 + 1.45 * pow(max(lam, 0.0), 1.3) + 0.08 * n.z;
  vec3 c = tar * dif;
  // riflesso largo e opaco, mai oltre il 10% del colore
  vec3 hv = normalize(L + vec3(0.0, 0.0, 1.0));
  // segue corde e labbro: le creste verso la luce sono appena più lucide
  float slope = clamp(1.0 - n.z, 0.0, 1.0);
  c *= 1.0 + 0.1 * clamp(pow(max(dot(n, hv), 0.0), 3.0) * (0.35 + 0.65 * smoothstep(0.02, 0.25, slope)) * (1.0 - clamp(cav, 0.0, 1.0)), 0.0, 1.0);
  c *= 1.0 - 0.55 * clamp(cav, 0.0, 1.0);
  c *= 1.0 - 0.4 * sh;
  c *= 1.0 - 0.35 * smoothstep(0.0, 0.6, occ);
  // dove è sottile è una velatura bruna: la foto traspare
  float opac = 1.0 - exp(-Hm / (A * (0.04 + 0.42 * trasparenza)));
  vec3 thin = under * exp(-kab * (0.6 + 1.6 * Hm / A)) * (0.55 + 0.75 * max(lam, 0.0));
  c = mix(thin, c, opac);
  return clamp(mix(IN(uv), c, smoothstep(0.0, 0.1, colata)), 0.0, 1.0);
}`,
};
