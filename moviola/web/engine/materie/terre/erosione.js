// Materia: erosione. La foto diventa un altopiano di roccia e terra visto
// dall'alto, e la pioggia lo scava come fa in natura.
//
// È un piccolo modello di evoluzione del paesaggio, quello dei geomorfologi
// (legge di potenza del flusso, «stream power»: lo scavo cresce con la
// portata e con la pendenza), nella forma che gira su scheda grafica (Schott
// e altri 2023; Cordonnier e altri 2016; per il trasporto, Davy e Lague 2009):
//   - piove su ogni punto; l'acqua scende verso i vicini più bassi, divisa
//     secondo la pendenza, e si somma: la portata di un punto è tutta l'acqua
//     che gli arriva da monte. Così nascono da sole le reti ramificate;
//   - l'acqua veloce (molta portata, molta pendenza) può portare più terra di
//     quanta ne ha: scava. Dove rallenta ne ha troppa: la deposita (ventagli,
//     piane, delta). Il sedimento porta con sé il colore di dove è nato;
//   - i versanti più ripidi di quanto la roccia regge franano: i solchi
//     diventano valli, le valli gole, e la roccia dura resta in piedi a
//     strati come mesa e torri isolate;
//   - la durezza viene dalla luce della foto e da strati orizzontali.
//
// Stato (atlante 2×2, 32 bit, lato lungo 768, ogni passo è completo):
//   tessera 0 = quota, portata, sedimento in viaggio, somma delle pendenze in uscita;
//   tessera 1 = da dove viene il sedimento in viaggio (uv), pelo dell'acqua al passo prima e adesso;
//   tessera 2 = da dove viene il deposito in superficie (uv), spessore del deposito, libero;
//   tessera 3 = quota iniziale, durezza della foto, luce della foto, libero.
import { P } from '../comune.js';
import { ATLANTE } from './atlante.js';

const COMUNE = ATLANTE + `
// la quota è in altezze del quadro; una cella dello stato è 1/TSZ().y
float erDx() { return 1.0 / float(TSZ().y); }
// direzione della pendenza generale (verso cui scende il terreno)
vec2 erDir() { float a = radians(direzione); return GIU(vec2(cos(a), sin(a))); }
// la durezza della roccia a una certa quota: la foto, più strati orizzontali
// (banchi duri che reggono e banchi teneri che cedono)
float erHard(float h0, float b) {
  float z = b * 260.0 / max(0.25, 1.0 - 0.6 * strati);
  float band = smoothstep(0.55, 0.8, fract(z)) * smoothstep(1.0, 0.92, fract(z));
  return clamp(h0 + strati * 0.55 * band, 0.0, 1.0);
}
`;

export const MATERIA = {
  id: 'erosione', code: 'Er', name: 'Erosione', family: 'terre', ref: 'I calanchi, i canyon visti dall’alto, i delta; Edward Burtynsky',
  about: 'La foto diventa un altopiano visto dall’alto: la sua luce è la quota, e il chiaro e lo scuro sono roccia dura e terra tenera. Piove: l’acqua scende, si unisce in rivoli e poi in canali ramificati, scava dove corre veloce e lascia ventagli di sedimento dove rallenta. Col tempo i solchi diventano gole, e la roccia dura resta in piedi a strati, come mesa e torri isolate.',
  steps: 16, simLong: 768, simF32: true, noloop: true,
  params: [
    P('pioggia', 'Pioggia', 0, 1, 0.6, 0.2),
    P('dove', 'Dove piove', 0, 4, 0, 0, { step: 1, options: ['ovunque', 'sui chiari', 'sugli scuri', 'a scrosci', 'da un bordo'] }),
    P('velocita', 'Velocità del tempo', 0.05, 2, 0.7, 0.2),
    P('durezza', 'Durezza della roccia', 0, 1, 0.45, 0.1),
    P('duri', 'Più duri (scuri ← → chiari)', -1, 1, 0.5, 0),
    P('strati', 'Strati di roccia', 0, 1, 0.55, 0.1),
    P('deposito', 'Sedimento lasciato a valle', 0, 1, 0.55, 0.2),
    P('pendenza', 'Pendenza generale', 0, 1, 0.45, 0),
    P('direzione', 'Direzione della pendenza (°)', 0, 360, 270, 0, { step: 1 }),
    P('rilievo', 'Profondità del rilievo', 0, 2, 1, 0.1),
    P('acqua', 'Acqua visibile', 0, 1, 0.6, 0.2),
    P('luce', 'Direzione delle ombre (°)', 0, 360, 315, 0, { step: 1 }),
  ],
  sim: COMUNE + `
float erLuma(vec2 uv) {
  vec2 o = 0.5 / vec2(TSZ());
  return 0.25 * (luma(IN(uv + o)) + luma(IN(uv - o)) + luma(IN(uv + vec2(o.x, -o.y))) + luma(IN(uv + vec2(-o.x, o.y))));
}
// la luce della foto ammorbidita: le forme grandi fanno l'altopiano, la grana no
float erLumaSoft(vec2 uv) {
  vec2 px = 1.0 / vec2(TSZ());
  float s = erLuma(uv), w = 1.0;
  for (int r = 1; r <= 3; r++) {
    for (int i = 0; i < 8; i++) {
      float an = float(i) * 0.7854 + float(r) * 0.39;
      float wr = 1.0 / float(r);
      s += wr * erLuma(uv + vec2(cos(an), sin(an)) * px * 5.0 * float(r)); w += wr;
    }
  }
  return s / w;
}
// quota iniziale: la luce, la pendenza generale e una terra irregolare a
// tutte le scale (senza, l'acqua scorrerebbe in lastre e non in rivoli)
float erB0(vec2 uv, float L) {
  vec2 p = (uv - 0.5) * vec2(ASPECT, 1.0);
  float ir = fbm(p * 5.0 + S(64.0), 0.0, 0.0, 5);
  return 0.08 + 0.055 * rilievo * L - 0.07 * pendenza * dot(p, erDir()) + 0.006 * ir;
}
// quanta pioggia per passo cade in un punto
float erRain(vec2 uv, float L, float t) {
  float r = 0.15 + 0.85 * pioggia;
  int dv = int(dove + 0.5);
  vec2 p = (uv - 0.5) * vec2(ASPECT, 1.0);
  if (dv == 1) r *= 2.0 * smoothstep(0.25, 0.85, L);
  else if (dv == 2) r *= 2.0 * smoothstep(0.75, 0.15, L);
  else if (dv == 3) {
    float s = gnoise(vec3(p * 2.0 + vec2(t * 0.04, t * 0.025), t * 0.1 + S(61.0)), 0.0);
    r *= 3.5 * smoothstep(0.05, 0.5, s);
  } else if (dv == 4) {
    float e = dot(p, -erDir()) / (0.5 * length(vec2(ASPECT, 1.0) * abs(erDir())) + 1e-3);
    r *= 0.15 + 6.0 * smoothstep(0.75, 0.97, e);
  }
  return r;
}
// i vicini: 8 direzioni, distanza in celle
ivec2 erO(int j) { return ivec2(j < 3 ? j - 1 : j == 3 ? -1 : j == 4 ? 1 : j - 6, j < 3 ? -1 : j < 5 ? 0 : 1); }
float erD(int j) { return (j == 0 || j == 2 || j == 5 || j == 7) ? 1.41421 : 1.0; }
// fuori dal quadro il terreno continua con la pendenza di partenza, un poco
// più in basso: l'acqua ai bordi se ne va, ma il bordo non si scava all'infinito
float erOut(ivec2 c, ivec2 o) {
  ivec2 ts = TSZ();
  float b0 = TF(3, c).x;
  return b0 + (b0 - TF(3, clamp(c - o, ivec2(0), ts - 1)).x) - 0.0004;
}
bool erIn(ivec2 n) { ivec2 ts = TSZ(); return n.x >= 0 && n.y >= 0 && n.x < ts.x && n.y < ts.y; }
// peso con cui l'acqua va da una cella a un vicino più basso: la pendenza
// alla quarta, così i rivoli si stringono in canali senza diventare fili rigidi
float erW(float s) { float q = max(s, 0.0); q *= q; return q * q; }
float erTan(float h) { return mix(0.55, 2.2, h * h) * (0.6 + 0.4 * rilievo); }
vec4 sim(vec2 uv0) {
  int k = TK();
  if (k < 0) return vec4(0.0);
  ivec2 c = TC();
  ivec2 ts = TSZ();
  vec2 uv = TCUV(c);
  float dx = erDx();
  // la portata si misura in celle di una griglia alta 135: uguale a ogni risoluzione
  float ar = pow(135.0 * dx, 2.0);
  if (u_init > 0.5) {
    float L = erLumaSoft(uv);
    float b = erB0(uv, L);
    float h0 = clamp(durezza * (1.0 + duri * (L - 0.5) * 2.0), 0.0, 1.0);
    // la superficie dell'acqua parte alta e scende fino ai bordi dei laghi
    if (k == 0) return vec4(b, ar, 0.0, 0.0);
    if (k == 1) return vec4(uv, b + 0.05, b + 0.05);
    if (k == 2) return vec4(uv, 0.0, 0.0);
    return vec4(b, h0, L, 0.0);
  }
  vec4 T0 = TF(0, c), T1 = TF(1, c), T2 = TF(2, c), T3 = TF(3, c);
  if (k == 3) return vec4(T3.xyz, T3.w + 1.0);   // w: quanti passi sono passati
  float b = T0.x;
  // ---- i vicini: roccia e pelo dell'acqua
  float bR[8], bF[8], bP[8];
  float Fmin = 1e9;
  for (int j = 0; j < 8; j++) {
    ivec2 o = erO(j), n = c + o;
    bool ins = erIn(n);
    vec4 N1 = ins ? TF(1, n) : vec4(0.0);
    bR[j] = ins ? TF(0, n).x : erOut(c, o);
    bF[j] = ins ? N1.w : bR[j];
    bP[j] = ins ? N1.z : bR[j];
    Fmin = min(Fmin, bF[j] + 1e-5 * erD(j) * dx);
  }
  // laghi: il pelo dell'acqua riempie le conche fino al punto da cui traboccano
  // (Planchon e Darboux 2001, un passo alla volta)
  float F = max(b, min(T1.w + 1e-7, Fmin));
  bool lake = F > b + 1e-6;
  // ---- l'acqua e il sedimento che arrivano da monte, divisi come la pendenza
  float Ain = 0.0, Qin = 0.0, Wout = 0.0, smax = 0.0, nbMin = 1e9, nbSum = 0.0, tal = 0.0;
  vec2 src = vec2(0.0);
  float hd = erHard(T3.y, b);
  float tanR = erTan(hd);
  for (int j = 0; j < 8; j++) {
    ivec2 o = erO(j), n = c + o;
    float dd = erD(j) * dx;
    float s = (F - bF[j]) / dd;
    smax = max(smax, s);
    // l'acqua si divide con le quote del passo prima: chi la manda e chi la
    // riceve fanno lo stesso conto, e non se ne crea né se ne perde
    Wout += erW((T1.w - bF[j]) / dd);
    nbMin = min(nbMin, bR[j]); nbSum += bR[j];
    if (bP[j] > T1.z && erIn(n)) {
      vec4 N0 = TF(0, n);
      float wv = erW((bP[j] - T1.z) / dd);
      float f = wv / max(max(N0.w, wv), 1e-30);
      Ain += f * N0.y;
      float q = f * N0.z;
      Qin += q;
      src += q * TF(1, n).xy;
    }
    // frane: la parete troppo ripida per la sua roccia scivola (si conserva)
    float tn = erTan(erHard(TF(3, clamp(n, ivec2(0), ts - 1)).y, bR[j]));
    float tj = 0.5 * (tanR + tn) * dd;
    tal += 0.22 * (max(bR[j] - b - tj, 0.0) - max(b - bR[j] - tj, 0.0)) / erD(j);
  }
  float rate = velocita;
  float L = T3.z;
  float A = min(erRain(uv, L, u_t) * ar + Ain, 1e6);
  // ---- scavo (portata × pendenza) e deposito (dove l'acqua è carica e lenta)
  float e = 0.0, d = 0.0;
  if (!lake) {
    // scava solo l'acqua raccolta: i versanti tra un rivolo e l'altro restano
    // la foto intatta, come le creste tra i calanchi
    e = rate * 7e-5 * sqrt(A) * min(max(smax, 0.0), 1.2) * mix(1.0, 0.04, hd) * smoothstep(3.0, 25.0, A);
    e = min(e, max(0.0, (b - nbMin) * 0.25));      // mai sotto il vicino più basso
    d = rate * 0.2 * (0.3 + deposito) * Qin / ar / max(A, 1e-6);
  } else d = 0.5 * Qin / ar;                       // nel lago la terra si posa: delta
  d = min(d, Qin / ar);
  d = min(d, max(F - b, 0.0) + max((nbSum / 8.0 - b) * 0.6, 0.0) + 2e-6);
  // un poco di colata dei versanti, più sulla terra tenera
  float creep = 0.012 * rate * (1.0 - hd) * (nbSum / 8.0 - b);
  float bn1 = b - e + d + tal * min(rate, 1.0) + creep;
  float Q = max(Qin + (e - d) * ar, 0.0);
  vec2 sQ = Qin > 1e-14 ? src / Qin : uv;
  // il sedimento nuovo nasce qui: il suo colore è quello del punto
  vec2 sOut = Q > 1e-14 ? (sQ * max(Qin - d * ar, 0.0) + uv * e * ar) / Q : uv;
  if (k == 0) return vec4(bn1, A, Q, max(Wout, 1e-30));
  if (k == 1) return vec4(sOut, T1.w, max(F, bn1));
  // ---- il deposito in superficie: ricorda da dove viene il suo colore
  float dep = max(bn1 - T3.x, 0.0);
  vec2 dsrc = T2.xy;
  if (d > 0.0) dsrc = mix(dsrc, sQ, clamp(d / (T2.z + d + 1e-7), 0.0, 1.0));
  if (dep < 1e-5) dsrc = uv;
  return vec4(dsrc, dep, 0.0);
}`,
  glsl: COMUNE + `
float erV(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float sd = S(63.0);
  return mix(mix(hash12(i + sd), hash12(i + vec2(1.0, 0.0) + sd), f.x),
             mix(hash12(i + vec2(0.0, 1.0) + sd), hash12(i + vec2(1.0, 1.0) + sd), f.x), f.y);
}
vec3 fx(vec2 uv) {
  ivec2 ts = TSZ();
  vec2 lc = uv * vec2(ts);
  float dxu = erDx();
  vec3 hb = TBS(0, lc, 0);                      // quota (liscia) e pendenza
  vec2 gS = hb.yz / dxu;                        // pendenza vera
  vec4 A0 = TL(0, lc), A1 = TL(1, lc), A2 = TL(2, lc), A3 = TL(3, lc);
  float b0 = A3.x;
  float dug = max(b0 - hb.x, 0.0);              // quanto è stato scavato
  float dep = max(A2.z, 0.0);                   // quanto si è depositato
  float hd = erHard(A3.y, hb.x);
  float ang = radians(luce);
  vec2 L2 = -vec2(cos(ang), sin(ang));
  vec3 Ld = normalize(vec3(L2, 0.7));
  float ex = 0.35 + 0.5 * rilievo;              // quanto si legge il rilievo
  // ---- ombre portate: la terra più alta verso la luce
  float shd = 0.0;
  for (int s = 1; s <= 8; s++) {
    float d = float(s) * float(s) * 0.7;
    float hs = TL(0, lc + L2 * d).x;
    shd = max(shd, smoothstep(0.0, 0.25, (hs - hb.x) / (d * dxu) * ex - Ld.z / length(Ld.xy) * 0.8));
  }
  // conche e fondi delle gole prendono meno cielo
  float ring = 0.0, ring2 = 0.0;
  for (int i = 0; i < 8; i++) {
    float an = float(i) * 0.7854;
    ring += TL(0, lc + vec2(cos(an), sin(an)) * 2.5).x;
    ring2 += TL(0, lc + vec2(cos(an + 0.39), sin(an + 0.39)) * 7.0).x;
  }
  float cav = clamp(((ring / 8.0 - hb.x) * 0.6 + (ring2 / 8.0 - hb.x) * 0.4) / dxu * 0.9 * ex, -1.0, 1.0);
  // ---- la grana della roccia, in pixel di un quadro alto 1080
  vec2 P = uv * u_res / K1080;
  float slope = length(gS);
  float steep = smoothstep(0.35, 1.6, slope);
  vec2 gr = (vec2(erV(P / 2.0), erV(P / 2.0 + 17.0)) - 0.5) * 0.25
          + (vec2(erV(P / 6.0 + 5.0), erV(P / 6.0 + 31.0)) - 0.5) * 0.35
          + (vec2(erV(P / 19.0 + 9.0), erV(P / 19.0 + 3.0)) - 0.5) * 0.3;
  float rough = (0.25 + 0.75 * steep) * (1.0 - smoothstep(0.0, 0.0015, dep) * 0.8);
  // ---- l'acqua: dove la portata è grande scorre un filo che si allarga a fiume
  float Aw = max(A0.y, 0.0);
  float ch = smoothstep(40.0, 260.0, Aw) * acqua;
  float river = smoothstep(400.0, 3000.0, Aw) * acqua;
  // i laghi: dove il pelo dell'acqua sta sopra la terra (appaiono dopo il primo
  // mezzo secondo, quando le conche si sono riempite)
  float Fw = TBS(1, lc, 3).x;
  float lk = smoothstep(0.0006, 0.003, Fw - hb.x) * smoothstep(260.0, 420.0, A3.w) * acqua;
  river = max(river, lk);
  // il pelo dell'acqua è piano: sotto l'acqua il rilievo si spiana
  vec2 grad = (gS * ex + gr * rough * 0.35) * (1.0 - 0.75 * river);
  vec3 n = normalize(vec3(-grad, 1.0));
  float lm = dot(n, Ld) / Ld.z;
  float sh = 0.32 + 0.68 * clamp(lm, 0.0, 2.0);
  sh = sh > 1.0 ? 1.0 + (sh - 1.0) * 0.45 : sh;
  sh *= 1.0 - 0.4 * shd;
  sh *= 1.0 - 0.3 * smoothstep(0.0, 1.0, cav);
  // ---- colore
  vec3 top = IN(uv);                              // la superficie intatta: la foto
  // gli strati nelle pareti scavate: bande alla stessa quota, come nei canyon
  float z = hb.x * 260.0 / max(0.25, 1.0 - 0.6 * strati);
  float bz = fract(z + 0.15 * (erV(P / 90.0) - 0.5));
  float bandHard = smoothstep(0.55, 0.8, bz) * smoothstep(1.0, 0.92, bz);
  float fineB = erV(vec2(z * 7.0, 0.5));
  vec3 deep = mix(top, vec3(luma(top)), 0.35);
  vec3 rock = deep * (0.7 + 0.18 * bandHard + 0.08 * (fineB - 0.5)) * mix(vec3(1.0), vec3(1.06, 0.98, 0.9), 0.5 * strati);
  // la roccia nuda si vede nelle pareti delle gole, non sui pianori
  float cut = smoothstep(0.001, 0.006, dug) * smoothstep(0.25, 1.2, slope);
  vec3 alb = mix(top, rock, cut);
  // il deposito: terra fine del colore di dove è nata, un poco più chiara e spenta
  vec3 sed = IN(A2.xy);
  sed = mix(sed, vec3(luma(sed)), 0.25) * 1.04;
  float lam = erV(vec2(dep * 6000.0, P.x / 400.0)) - 0.5;
  sed *= 1.0 + 0.05 * lam;
  alb = mix(alb, sed, smoothstep(0.0, 0.0012, dep));
  vec3 col = alb * sh;
  // terra bagnata lungo i rivoli
  float wet = smoothstep(10.0, 90.0, Aw) * acqua;
  col = mix(col, mix(vec3(luma(col)), col, 1.2) * 0.72, wet * 0.6);
  // l'acqua: torbida, del colore della terra che porta, che scorre lungo la pendenza
  vec2 fd = -hb.yz / max(length(hb.yz), 1e-9);
  vec2 pw = vec2(dot(P, vec2(-fd.y, fd.x)), dot(P, fd));
  float flow = erV(vec2(pw.x / 3.0, pw.y / 22.0 - u_t * 40.0)) * 0.6 + erV(vec2(pw.x / 7.0 + 9.0, pw.y / 45.0 - u_t * 26.0)) * 0.4;
  vec3 mud = IN(A1.xy);
  mud = mix(vec3(luma(mud)), mud, 0.6) * 0.55;
  vec3 wc = mud * (0.75 + 0.35 * flow) * (0.85 + 0.15 * sh);
  col = mix(col, wc, ch * 0.85 * (1.0 - lk));
  // il lago: acqua ferma e torbida, più scura dove è profonda; si vede ancora
  // un poco il fondo vicino alle rive
  float ldep = smoothstep(0.0008, 0.012, Fw - hb.x);
  vec3 lcol = mix(alb * 0.75, mud * 1.1, 0.55 + 0.35 * ldep) * (0.95 - 0.3 * ldep);
  col = mix(col, lcol, lk);
  FX_H = clamp((hb.x - 0.02) * 6.0, 0.0, 1.0);
  return clamp(col, 0.0, 1.0);
}`,
};
