// Materia: ferrofluido. Un liquido nero e lucido che sotto un magnete si alza in
// spine, simulato invece che disegnato.
//
// Due cose si muovono e si parlano:
//  - il liquido (una griglia con la sua quantità m). Scorre: la tensione e la
//    gravità lo spianano, il magnete lo tira verso di sé. Si raccoglie sotto il
//    magnete con il ritardo della sua viscosità e, quando il magnete se ne va, si
//    riallarga in una pozza.
//  - le spine (fino a 256, ognuna con posizione e altezza). È l'instabilità di
//    Rosensweig: dove il campo supera la soglia e il liquido è abbastanza
//    profondo, la superficie piatta non regge e si alza in spine. Le spine si
//    respingono fino a una distanza propria (più corta dove il campo è forte),
//    così si dispongono da sole a reticolo quasi esagonale, con i suoi difetti;
//    seguono il magnete con un filo di ritardo; dove c'è posto e campo ne nasce
//    una nuova accanto (si dividono), dove si stringono troppo due si fondono,
//    dove il campo cala si abbassano e rientrano nella pozza.
//
// I magneti: da zero a tre che si spostano da soli, il dito (Gesto › Scolpisci:
// dove tocchi c'è un magnete, e quando togli il dito il campo si spegne piano) e,
// se si vuole, un campo nascosto nei chiari o negli scuri della foto.
//
// Il disegno: la superficie è la pozza più le spine, ognuna un cono a fianchi
// concavi (profilo esponenziale) con la punta sottile; le normali sono esatte, a
// piena risoluzione anche in 4K. Il liquido è nero e specchiante (riflettanza di
// Fresnel di un olio): la foto vive nei riflessi sui fianchi delle spine e, scura,
// nella pozza. Dove lo strato è sottilissimo si vede attraverso, bruno.
//
// Stato (32 bit, letto con texelFetch), una sola trama:
//   x = liquido m, y = campo (per il disegno), in ogni cella;
//   zw delle prime righe: le spine. Spina i: cella (i % 100, i / 100) zw = posizione
//   (altezze di quadro, centro 0, y in su); cella (i % 100, 4 + i / 100) zw =
//   altezza (in passi del reticolo; 0 = non c'è) e età.
import { P } from '../comune.js';

const STEPS = 8;
const N = 256;

const COMUNE = `
#define FF_N ${N}
vec4 ffT(ivec2 c) { return texelFetch(u_st, clamp(c, ivec2(0), ivec2(u_stRes) - 1), 0); }
vec2 ffPos(int i) { return ffT(ivec2(i % 100, i / 100)).zw; }
vec2 ffHA(int i) { return ffT(ivec2(i % 100, 4 + i / 100)).zw; }
// il liquido letto in un punto qualunque (bilineare a mano: la trama è a 32 bit)
vec2 ffM(vec2 uv) {
  vec2 q = uv * u_stRes - 0.5;
  ivec2 i = ivec2(floor(q));
  vec2 f = q - floor(q);
  vec2 a = mix(ffT(i).xy, ffT(i + ivec2(1, 0)).xy, f.x);
  vec2 b = mix(ffT(i + ivec2(0, 1)).xy, ffT(i + ivec2(1, 1)).xy, f.x);
  return mix(a, b, f.y);
}
// passo del reticolo in altezze di quadro, più corto dove il campo è forte
float ffLam(float F) { return (1.0 / punte) * (1.0 - 0.22 * clamp(F - soglia, 0.0, 1.2)); }
`;

const SIM = COMUNE + `
// il campo magnetico (già pesato): magneti, dito, foto
float ffCampo(vec2 uv) {
  float asp = u_stRes.x / u_stRes.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float f = 0.0;
  int nm = int(numero + 0.5);
  float t = u_t * velocita;
  for (int i = 0; i < 3; i++) {
    if (i >= nm) break;
    float fi = float(i);
    vec2 hh = hash22(vec2(fi * 3.7 + 1.0, S(21.0)));
    vec2 c = vec2(sin(TAU * (t * (0.11 + 0.05 * fi) + hh.x)) * 0.33 * asp,
                  sin(TAU * (t * (0.08 + 0.035 * fi) + hh.y) + fi) * 0.28);
    if (nm == 1) c *= 0.55;
    vec2 q = p - c;
    // un magnete sotto il vassoio: il campo sulla superficie cala in fretta
    float d = 0.2;
    f += pow(1.0 + dot(q, q) / (d * d), -1.6);
  }
  // il dito: dove Scolpisci tocca, lì c'è un magnete
  vec4 sc = SCULPT(uv);
  f += dito * clamp(abs(sc.z) * 1.6 + length(sc.xy) * 9.0, 0.0, 1.4);
  // il campo nascosto nella foto
  if (dallafoto > 0.001) {
    float l = luma(IN(uv));
    f += dallafoto * smoothstep(0.15, 0.85, campodove < 0.5 ? l : 1.0 - l);
  }
  return f * magneti * (1.0 + 0.25 * RESPIRO);
}

vec4 sim(vec2 uv) {
  ivec2 c = ivec2(gl_FragCoord.xy);
  float asp = u_stRes.x / u_stRes.y;
  vec2 A = vec2(asp, 1.0);
  float dt = 1.0 / (u_fps * ${STEPS}.0);
  float visc = mix(1.7, 0.3, viscosita);
  vec4 s = ffT(c);
  float Fc = ffCampo(uv);

  // ---------------------------------------------------------- il liquido
  float mn;
  if (u_init > 0.5) {
    // la soglia è relativa a questa foto: «gli scuri» sono i suoi scuri
    float l = luma(IN(uv)), mean = 0.0;
    for (int k = 0; k < 16; k++) mean += luma(IN((vec2(float(k % 4), float(k / 4)) + 0.5) / 4.0));
    mean /= 16.0;
    float thr = origine < 0.5 ? mean * mix(0.35, 1.25, copertura) : mix(1.0, mean * 0.7, copertura);
    float o = origine < 0.5 ? thr - l : l - thr;
    mn = smoothstep(-0.06, 0.06, o) * (0.5 + 0.6 * copertura);
    if (origine > 1.5) {
      vec2 q = (uv - 0.5) * A;
      mn = smoothstep(0.12 + 0.3 * copertura, 0.04 + 0.26 * copertura, length(q)) * 0.9;
    }
  } else {
    vec4 sE = ffT(c + ivec2(1, 0)), sW = ffT(c - ivec2(1, 0)), sN = ffT(c + ivec2(0, 1)), sS = ffT(c - ivec2(0, 1));
    vec2 e = SPX;
    float FE = ffCampo(uv + vec2(e.x, 0.0)), FW = ffCampo(uv - vec2(e.x, 0.0));
    float FN = ffCampo(uv + vec2(0.0, e.y)), FS = ffCampo(uv - vec2(0.0, e.y));
    // si spiana da sé (tensione e gravità) e va verso il campo; il vento e la
    // gravità della catena lo portano, in celle per passo
    // il bordo della pozza resta attaccato: il velo sottilissimo non scorre
    float g = 0.16, mu = 0.9 * visc;
    vec2 vf = FORZA(uv) * u_stRes * dt;
    float m = s.x;
    float fE = 0.5 * (m + sE.x) * smoothstep(0.012, 0.05, max(m, sE.x)) * (-g * (sE.x - m) + mu * (FE - Fc) + vf.x);
    float fW = 0.5 * (m + sW.x) * smoothstep(0.012, 0.05, max(m, sW.x)) * (-g * (m - sW.x) + mu * (Fc - FW) + vf.x);
    float fN = 0.5 * (m + sN.x) * smoothstep(0.012, 0.05, max(m, sN.x)) * (-g * (sN.x - m) + mu * (FN - Fc) + vf.y);
    float fS = 0.5 * (m + sS.x) * smoothstep(0.012, 0.05, max(m, sS.x)) * (-g * (m - sS.x) + mu * (Fc - FS) + vf.y);
    mn = max(m - (fE - fW + fN - fS) * 0.5, 0.0);
  }
  vec4 o = vec4(mn, Fc, 0.0, 0.0);

  // ---------------------------------------------------------- le spine
  bool isP = c.x < 100 && c.y < 3;
  bool isH = c.x < 100 && c.y >= 4 && c.y < 7;
  if (!isP && !isH) return o;
  int i = c.x + (isP ? c.y : c.y - 4) * 100;
  if (i >= FF_N) return o;
  if (u_init > 0.5) return o; // nessuna spina: nascono dalla pozza
  vec2 p = ffPos(i), ha = ffHA(i);
  float hgt = ha.x, age = ha.y;
  vec2 puv = p / A + 0.5;
  vec2 mf = ffM(puv);
  float F = mf.y, deep = smoothstep(0.04, 0.3, mf.x);
  float lam = ffLam(F);
  // l'altezza a cui la spina tende: zero sotto la soglia, poi cresce come la
  // radice dello scarto (biforcazione), limitata dal liquido che c'è
  float tgt = sqrt(max(F * deep - soglia, 0.0)) * 1.25;

  if (hgt <= 0.0) {
    // ---- un posto vuoto: forse qui nasce una spina
    vec3 r = hash33(vec3(float(i) * 1.37, u_frame * 0.71 + u_step * 0.13, S(23.0)));
    if (r.z > 0.25) return o;
    vec2 q;
    int j = int(r.x * float(FF_N));
    vec2 hj = ffHA(j);
    if (hj.x > 0.05 && r.y < 0.75) {
      // accanto a una spina viva: la pozza si divide
      float an = TAU * hash11(r.y * 91.0 + float(i));
      q = ffPos(j) + vec2(cos(an), sin(an)) * ffLam(ffM(ffPos(j) / A + 0.5).y);
    } else {
      q = (hash22(r.xy * 57.3 + 1.7) - 0.5) * A;
    }
    vec2 qm = ffM(q / A + 0.5);
    float fq = qm.y * smoothstep(0.04, 0.3, qm.x);
    if (fq < soglia + 0.03 || abs(q.x) > asp * 0.5 || abs(q.y) > 0.5) return o;
    float lq = ffLam(qm.y);
    for (int k = 0; k < FF_N; k++) {
      if (ffHA(k).x <= 0.0) continue;
      vec2 d = ffPos(k) - q;
      if (dot(d, d) < lq * lq * 0.72) return o;
    }
    if (isP) o.zw = q; else o.zw = vec2(0.012, 0.0);
    return o;
  }

  // ---- una spina viva: le vicine la spingono al suo posto nel reticolo
  vec2 push = vec2(0.0);
  float merge = 0.0;
  for (int k = 0; k < FF_N; k++) {
    if (k == i) continue;
    vec2 hk = ffHA(k);
    if (hk.x <= 0.0) continue;
    vec2 d = p - ffPos(k);
    float L = length(d);
    if (L > lam * 1.5) continue;
    vec2 n = L > 1e-6 ? d / L : normalize(hash22(vec2(float(i), float(k))) - 0.5 + 1e-3);
    // repulsione sotto il passo, leggera attrazione appena oltre: reticolo
    if (L < lam) push += n * (lam - L);
    else push -= n * (L - lam) * 0.25;
    // troppo vicine: la più bassa si fonde nell'altra
    if (L < lam * 0.42 && (hk.x > hgt || (hk.x == hgt && k < i))) merge = 1.0;
  }
  // il campo tira le spine verso il suo massimo
  vec2 e = SPX;
  float gx = ffM(puv + vec2(e.x, 0.0)).y - ffM(puv - vec2(e.x, 0.0)).y;
  float gy = ffM(puv + vec2(0.0, e.y)).y - ffM(puv - vec2(0.0, e.y)).y;
  vec2 grad = vec2(gx, gy) / (2.0 * e * A);
  vec2 v = push * 9.0 * visc + grad * 0.012 * visc + FORZA(puv) * A * 0.5;
  p += v * dt;
  // cresce o si abbassa con il ritardo viscoso
  float rate = 3.5 * visc;
  hgt += (tgt - hgt) * (1.0 - exp(-dt * rate));
  if (merge > 0.5 || (tgt <= 0.0 && hgt < 0.03) || abs(p.x) > asp * 0.5 + 0.05 || abs(p.y) > 0.55) hgt = 0.0;
  age += dt;
  if (isP) o.zw = p; else o.zw = vec2(hgt, age);
  return o;
}`;

const FX = COMUNE + `
// Si guarda il vassoio un po' di sbieco: una spina alta z appare spostata in su
// di z * FF_K, e le sue sezioni sono ellissi schiacciate di FF_S.
#define FF_K 0.85
#define FF_S 0.62
vec3 ffLin(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }
// il mondo riflesso: la foto stessa, come se stesse in piedi dietro il
// vassoio. La pozza piatta la specchia capovolta; i fianchi delle spine, che
// guardano di lato o in alto, ne prendono pezzi lontani, stirati e piegati.
vec3 ffEnv(vec2 uv, vec3 R) {
  vec2 q = vec2(uv.x + R.x * 0.42 / ASPECT, 1.0 - uv.y + (R.y - FF_S) * 0.7 - R.z * 0.12);
  q = 1.0 - abs(1.0 - mod(q, 2.0));
  vec3 c = ffLin(IN(q));
  // il liquido è nero: della foto riflette soprattutto le parti chiare
  return c * c * 1.5;
}
// riflettanza di un olio (n 1,5) per il coseno c
float ffFres(float c) { return 0.04 + 0.96 * pow(1.0 - clamp(c, 0.0, 1.0), 5.0); }
vec3 fx(vec2 uv) {
  vec3 img = IN(uv);
  vec2 A = vec2(ASPECT, 1.0);
  vec2 p = (uv - 0.5) * A;
  vec2 mf = ffM(uv);
  float m = mf.x;
  float px = 1.0 / u_res.y;
  float lam0 = 1.0 / punte;
  // ---- le spine: per ogni spina vicina, il punto più alto in cui il raggio
  // di vista la incontra; vince la spina più vicina a chi guarda
  float bz = -1.0, bcov = 0.0;
  vec3 bn = vec3(0.0, 0.0, 1.0);
  for (int i = 0; i < FF_N; i++) {
    vec2 ha = ffHA(i);
    if (ha.x <= 0.0) continue;
    vec2 c = ffPos(i);
    float H = ha.x * lam0 * 1.05 * altezza;
    float b = lam0 * 0.5 * clamp(ha.x * 1.6, 0.4, 1.0);
    vec2 d0 = p - c;
    if (abs(d0.x) > b || d0.y < -b * FF_S || d0.y > b * FF_S + H * FF_K) continue;
    float zHit = -1.0, best = -1.0;
    float zPrev = H;
    for (int k = 0; k <= 12; k++) {
      float z = H * (1.0 - float(k) / 12.0);
      vec2 dd = (d0 - vec2(0.0, z * FF_K)) / vec2(1.0, FF_S);
      float r = b * pow(1.0 - z / H, 1.7);
      float mg = r - length(dd);
      best = max(best, mg);
      if (mg > 0.0 && zHit < 0.0) {
        // affina fra il campione fuori e quello dentro
        float lo = z, hi = zPrev;
        for (int j = 0; j < 5; j++) {
          float zm = 0.5 * (lo + hi);
          vec2 dm = (d0 - vec2(0.0, zm * FF_K)) / vec2(1.0, FF_S);
          if (b * pow(1.0 - zm / H, 1.7) - length(dm) > 0.0) lo = zm; else hi = zm;
        }
        zHit = lo;
      }
      zPrev = z;
    }
    if (zHit < 0.0 || zHit <= bz) continue;
    // la normale del cono a fianchi concavi in quel punto
    vec2 dd = (d0 - vec2(0.0, zHit * FF_K)) / vec2(1.0, FF_S);
    vec2 dir = dd / max(length(dd), 1e-6);
    float u = max(1.0 - zHit / H, 1e-3);
    float slope = b * 1.7 / H * pow(u, 0.7);
    bn = normalize(vec3(dir, slope));
    bz = zHit;
    bcov = smoothstep(0.0, px * 1.2, best);
  }
  float cover = smoothstep(0.008, 0.016, m);
  if (cover <= 0.001 && bz < 0.0) return img;
  // chi guarda sta davanti e in alto: il raggio di vista scende nel vassoio
  vec3 v = normalize(vec3(0.0, FF_S, -sqrt(1.0 - FF_S * FF_S)));
  // ---- la pozza: tesa, con il menisco al bordo
  vec2 e = 1.0 / u_stRes;
  float mx = ffM(uv + vec2(e.x, 0.0)).x - ffM(uv - vec2(e.x, 0.0)).x;
  float my = ffM(uv + vec2(0.0, e.y)).x - ffM(uv - vec2(0.0, e.y)).x;
  vec2 gp = vec2(mx, my) / (2.0 * e * A) * 0.006;
  vec3 np = normalize(vec3(-gp, 1.0));
  vec3 Rp = reflect(v, np);
  float Fp = ffFres(-dot(v, np)) * (0.08 + 0.4 * riflesso);
  vec3 pool = ffLin(vec3(0.01, 0.0095, 0.009)) + ffEnv(uv, Rp) * min(Fp, 1.0);
  // fra le spine la luce arriva meno
  pool *= 1.0 - 0.35 * smoothstep(0.0, 0.5, mf.y - soglia);
  // dove lo strato è appena un velo si vede attraverso, bruno
  pool += ffLin(img) * exp(-m * vec3(400.0, 470.0, 560.0));
  vec3 col = mix(ffLin(img), pool, cover);
  if (bz >= 0.0) {
    vec3 Rs = reflect(v, bn);
    float Fs = ffFres(-dot(v, bn)) * (0.35 + 1.3 * riflesso);
    vec3 spk = ffLin(vec3(0.01, 0.0095, 0.009)) + ffEnv(uv, Rs) * min(Fs, 1.0);
    col = mix(col, spk, bcov);
  }
  FX_H = clamp(bz / (lam0 * 1.2) + m * 0.3, 0.0, 1.0);
  return pow(max(col, 0.0), vec3(1.0 / 2.2));
}`;

export const MATERIA = {
  id: 'ferrofluido', code: 'Ff', name: 'Ferrofluido', family: 'liquidi', ref: 'Brakhage; l’instabilità di Rosensweig',
  steps: STEPS, simLong: 200, simFixed: true, simF32: true, noloop: true,
  about: 'Un liquido nero e lucido versato sulla foto: sotto i magneti si raccoglie con il ritardo della sua viscosità e si alza in spine a reticolo, più alte e fitte dove il campo è forte, che si fondono, si dividono e si riabbassano in una pozza liscia quando il magnete se ne va. Col dito (Gesto › Scolpisci) porti tu un magnete. La foto vive nei riflessi.',
  params: [
    P('copertura', 'Quanto liquido', 0, 1, 0.45, 0.2),
    P('origine', 'Versato su', 0, 2, 0, 0, { step: 1, options: ['scuri', 'chiari', 'una pozza'] }),
    P('magneti', 'Forza dei magneti', 0, 2, 1, 0.4),
    P('numero', 'Magneti che si muovono', 0, 3, 2, 0, { step: 1 }),
    P('velocita', 'Velocità dei magneti', 0, 1, 0.35, 0.2),
    P('dito', 'Il dito è un magnete', 0, 1.5, 1, 0.2),
    P('dallafoto', 'Campo nascosto nella foto', 0, 1.5, 0, 0.3),
    P('campodove', 'Il campo sta nei', 0, 1, 0, 0, { step: 1, options: ['chiari', 'scuri'] }),
    P('punte', 'Spine nel quadro', 6, 30, 13, 0.1),
    P('altezza', 'Altezza delle spine', 0, 2, 1, 0.3),
    P('soglia', 'Soglia delle spine', 0.1, 1, 0.3, 0.2),
    P('viscosita', 'Viscosità (ritardo)', 0, 1, 0.45, 0.2),
    P('riflesso', 'Riflesso della foto', 0, 1, 0.6, 0.3),
  ],
  sim: SIM,
  glsl: FX,
};
