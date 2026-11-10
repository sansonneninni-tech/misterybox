// Materia: granuli. La foto è un letto di sabbia: ogni grano porta il colore
// del punto da cui parte. La sabbia frana quando la pendenza supera l'angolo
// di riposo, il vento la solleva dai fianchi esposti e la ridepone più avanti
// (saltazione), nella zona d'ombra dietro le creste: nascono dune e
// increspature, e l'immagine si disfa e si ridepone a strati.
//
// Stato (atlante 2×2, 32 bit, lato lungo 768):
//   tessera 0 = quota della sabbia (in altezze di quadro) e colore in superficie;
//   tessera 1 = colore dello strato di sotto e spessore dello strato di sopra;
//   tessera 2 = attività del vento (per le increspature), sabbia appena mossa.
// La quota è in unità del quadro, quindi la materia si comporta allo stesso
// modo in anteprima e nel render 4K; il disegno aggiunge i grani uno per uno
// in pixel × K1080.
import { P } from '../comune.js';
import { ATLANTE } from './atlante.js';

const COMUNE = ATLANTE + `
#define GR_STEPS 6.0
// tangente dell'angolo di riposo: la sabbia umida tiene pendenze più ripide
float grTan() { return tan(radians(clamp(riposo + coesione * 16.0, 5.0, 75.0))); }
// direzione della spinta (verso cui va la sabbia), nel quadro
vec2 grW() { float a = radians(direzione); return vec2(cos(a), sin(a)); }
// quanto la foto ha già ceduto in un punto (0 = tiene ancora, 1 = sabbia sciolta)
float grFree(vec2 uv, float L, float t) {
  float nz = gnoise(vec3(uv * vec2(ASPECT, 1.0) * 3.1, 7.3 + S(5.0)), 0.0) * 0.5
           + gnoise(vec3(uv * vec2(ASPECT, 1.0) * 9.0, 2.1 + S(6.0)), 0.0) * 0.22;
  // cedono > 0: prima i chiari; < 0: prima gli scuri
  float ord = clamp(0.5 - cedono * (L - 0.5) * 1.6 + nz * 0.55, 0.0, 1.0);
  float tr = tenuta * (0.08 + 0.92 * ord);
  return smoothstep(tr, tr + 0.35 + 0.5 * tenuta, t * (0.25 + velocita));
}
`;

export const MATERIA = {
  id: 'granuli', code: 'Gn', name: 'Granuli', family: 'terre', ref: 'Brakhage e la sabbia; le dune che il vento rifà ogni notte',
  about: 'La foto è un letto di sabbia: ogni grano porta il colore del punto da cui parte. Prima l’immagine tiene, poi cede a zone e frana fino all’angolo di riposo; il vento solleva i grani dai fianchi esposti e li ridepone dietro le creste, in dune e increspature, così l’immagine si disfa e si ricompone a strati.',
  steps: 6, simLong: 768, simF32: true, noloop: true,
  params: [
    P('grani', 'Taglia dei grani (px)', 1.5, 16, 7, 0),
    P('varieta', 'Varietà dei grani', 0, 1, 0.55, 0.1),
    P('riposo', 'Angolo di riposo (°)', 15, 45, 32, 0.1),
    P('coesione', 'Coesione (asciutta → umida)', 0, 1, 0.15, 0.2),
    P('spinta', 'Forza della spinta', 0, 1, 0.45, 0.3),
    P('direzione', 'Direzione della spinta (°)', 0, 360, 200, 0.05, { step: 1 }),
    P('tenuta', 'Quanto regge la foto (s)', 0, 20, 3, 0),
    P('cedono', 'Cedono prima (scuri ← → chiari)', -1, 1, 0.4, 0),
    P('velocita', 'Velocità', 0.05, 1.5, 0.6, 0.2),
    P('rilievo', 'Profondità del rilievo', 0, 2, 1, 0.2),
    P('luce', 'Direzione delle ombre (°)', 0, 360, 300, 0, { step: 1 }),
  ],
  sim: COMUNE + `
float grLuma(vec2 uv) {
  vec2 o = 0.25 / vec2(TSZ());
  return 0.25 * (luma(IN(uv + o)) + luma(IN(uv - o)) + luma(IN(uv + vec2(o.x, -o.y))) + luma(IN(uv + vec2(-o.x, o.y))));
}
// quota dei vicini (canale x della tessera 0)
float grH(ivec2 c) { return TF(0, c).x; }
// vento: quota sollevata in un punto lc (texel) a ogni passo
float grE(vec2 lc, float t, out vec3 col) {
  float dx = 1.0 / float(TSZ().y);
  vec2 w = grW();
  vec4 a = TL(0, lc);
  col = a.yzw;
  float h0 = a.x;
  float sl = (TL(0, lc + w).x - TL(0, lc - w).x) / (2.0 * dx);
  // zona d'ombra: dietro una cresta il vento non tocca la sabbia
  float sh = 0.0;
  for (int s = 1; s <= 4; s++) {
    float d = float(s * s) * 1.6;
    sh = max(sh, smoothstep(0.0, 0.25, (TL(0, lc - w * d).x - h0) / (d * dx) - 0.27));
  }
  // quanto è sciolta la sabbia lì (calcolato da ogni cella al passo prima)
  float fr = TL(2, lc).z;
  float e = spinta * spinta * 1.2e-4 * clamp(velocita, 0.0, 1.5);
  return e * clamp(1.0 + 2.2 * sl, 0.15, 2.4) * (1.0 - sh) * fr * (1.0 - 0.9 * coesione);
}
vec4 sim(vec2 uv0) {
  int k = TK();
  if (k < 0 || k == 3) return vec4(0.0);
  ivec2 c = TC();
  vec2 uv = TCUV(c);
  float t = u_t + u_step / (24.0 * GR_STEPS);
  float L = grLuma(uv);
  if (u_init > 0.5) {
    vec3 col = IN(uv);
    float h = 0.03 + 0.045 * rilievo * L;
    if (k == 0) return vec4(h, col);
    if (k == 1) return vec4(col, 0.02);
    return vec4(0.0);
  }
  float dx = 1.0 / float(TSZ().y);
  float tn = grTan();
  vec4 a = TF(0, c), b = TF(1, c), z = TF(2, c);
  float h = a.x;
  float fr = grFree(uv, L, t);
  float kt = 0.1 * clamp(velocita * 1.4, 0.15, 1.0);
  // frane: verso ogni vicino più basso oltre l'angolo di riposo, e dai vicini più alti
  float outv = 0.0, inv = 0.0;
  vec3 cin = vec3(0.0);
  for (int j = 0; j < 8; j++) {
    ivec2 o = ivec2(j < 3 ? j - 1 : j == 3 ? -1 : j == 4 ? 1 : j - 6, j < 3 ? -1 : j < 5 ? 0 : 1);
    float dist = (o.x != 0 && o.y != 0 ? 1.41421 : 1.0) * dx;
    vec4 n = TF(0, c + o);
    outv += kt * fr * max(h - n.x - tn * dist, 0.0);
    float fn = TF(2, c + o).z;
    float q = kt * fn * max(n.x - h - tn * dist, 0.0);
    inv += q; cin += q * n.yzw;
  }
  // vento: se ne va la sabbia di qui, arriva quella di sopravvento
  vec3 c0, c1, c2;
  vec2 lc = vec2(c) + 0.5;
  vec2 w = grW();
  float hop = 2.5 + 5.0 * spinta;
  float e0 = grE(lc, t, c0);
  float e1 = grE(lc - w * hop, t, c1);
  float e2 = grE(lc - w * hop * 2.1, t, c2);
  // dove c'è ombra di vento i grani si fermano tutti; altrove alcuni rimbalzano oltre
  outv += e0;
  inv += 0.62 * e1 + 0.38 * e2;
  cin += 0.62 * e1 * c1 + 0.38 * e2 * c2;
  // strati: si consuma prima lo strato di sopra, poi quello di sotto
  vec3 ct = a.yzw, cd = b.xyz;
  float D = b.w - outv;
  if (D < 0.0) { ct = cd; D = 0.0; }
  float hn = h - outv + inv;
  float Dn = D + inv;
  ct = (ct * D + cin) / max(Dn, 1e-7);
  // lo strato di sopra, oltre un certo spessore, diventa il fondo
  const float DMAX = 0.012;
  if (Dn > DMAX) { cd = mix(cd, ct, clamp((Dn - DMAX) / Dn, 0.0, 1.0)); Dn = DMAX; }
  if (k == 0) return vec4(hn, clamp(ct, 0.0, 1.0));
  if (k == 1) return vec4(clamp(cd, 0.0, 1.0), Dn);
  // attività del vento e sabbia appena mossa (memoria breve)
  float act = mix(z.x, e0 / max(spinta * spinta * 1.2e-4 * clamp(velocita, 0.05, 1.5), 1e-9), 0.02);
  float mv = mix(z.y, clamp(abs(inv - outv) / dx * 40.0, 0.0, 1.0), 0.05);
  return vec4(act, mv, fr, 0.0);
}`,
  glsl: COMUNE + `
vec2 grH2(vec2 i, float s) { return hash22(i + S(s)); }
vec3 fx(vec2 uv) {
  ivec2 ts = TSZ();
  vec2 lc = uv * vec2(ts);
  float dxu = 1.0 / float(ts.y);
  vec3 hb = TBS(0, lc, 0);
  vec2 gS = hb.yz / dxu;                       // pendenza vera della sabbia
  float hpx = hb.x * 1080.0;                   // quota in pixel di un quadro alto 1080
  vec4 z = TL(2, lc);
  vec2 w = grW();
  float ang = radians(luce);
  vec2 L2 = -vec2(cos(ang), sin(ang));         // da dove viene la luce
  vec3 Ld = normalize(vec3(L2, 0.62));
  // ---- ombra propria: la sabbia più alta verso la luce copre questa
  float shd = 0.0;
  for (int s = 1; s <= 6; s++) {
    float d = float(s) * float(s) * 0.9;
    float hs = TL(0, lc + L2 * d).x;
    shd = max(shd, smoothstep(0.0, 0.35, (hs - hb.x) / (d * dxu) - 0.55));
  }
  // cavità: le conche tra le dune prendono meno luce
  float ring = 0.0;
  for (int i = 0; i < 6; i++) { float an = float(i) * 1.0472; ring += TL(0, lc + vec2(cos(an), sin(an)) * 5.0).x; }
  float cav = clamp((ring / 6.0 - hb.x) / dxu * 0.35, -1.0, 1.0);
  // ---- increspature: perpendicolari alla spinta, dove il vento lavora e il fondo è piano
  vec2 P = uv * u_res / K1080;
  float lam = grani * 13.0;
  float pian = 1.0 - smoothstep(0.6, 1.5, length(gS));
  float wk = clamp(z.x, 0.0, 1.6) * spinta;
  vec2 pw = vec2(dot(P, w), dot(P, vec2(-w.y, w.x)));
  float warp = gnoise(vec3(pw / vec2(lam * 4.0, lam * 7.0), 3.3 + S(7.0)), 0.0) * 0.9
             + gnoise(vec3(pw / (lam * 1.6), 9.1 + S(8.0)), 0.0) * 0.25;
  float ph = pw.x / lam + warp - u_t * spinta * velocita * 0.35;
  float fp = fract(ph);
  // profilo asimmetrico: lungo e dolce sopravvento, corto e ripido sottovento
  float st = 0.72;
  float dprof = fp < st ? 1.0 / st : -1.0 / (1.0 - st);
  float sm = smoothstep(0.0, 0.08, fp) * smoothstep(1.0, 0.92, fp) * smoothstep(0.0, 0.06, abs(fp - st));
  float ra = grani * 1.5 * smoothstep(0.02, 0.35, wk) * pian * (1.0 - 0.7 * coesione);
  vec2 gR = w * dprof / lam * ra * mix(0.45, 1.0, sm);
  // ---- i grani, uno per uno: il più alto vince
  float gpx = grani;
  float cs = gpx * 0.82;
  vec2 cell = floor(P / cs);
  float best = -1.0; vec2 bq = vec2(0.0); float br = 1.0; vec2 bc = vec2(0.0); vec3 bh = vec3(0.5);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 ci = cell + vec2(float(i), float(j));
    vec2 h0 = grH2(ci, 11.0);
    // quando la sabbia sale o scende di un grano, in superficie c'è un grano nuovo
    float layer = floor(hpx / (gpx * 0.7) + h0.x);
    vec3 hh = hash33(vec3(ci, layer) + S(12.0));
    vec2 cc = (ci + 0.5 + (hh.xy - 0.5) * 0.75) * cs;
    float r = 0.5 * gpx * clamp(1.0 + varieta * (hh.z - 0.5) * 1.3, 0.35, 1.8);
    vec2 q = P - cc;
    float d2 = dot(q, q) / (r * r);
    if (d2 < 1.0) {
      float zz = r * (sqrt(1.0 - d2) + 0.35 * hh.x);
      if (zz > best) { best = zz; bq = q; br = r; bc = cc; bh = hh; }
    }
  }
  float inside = step(0.0, best);
  vec2 gG = vec2(0.0);
  float gapAo = 1.0;
  if (best > 0.0) {
    float zc = max(best - 0.35 * bh.x * br, 0.15 * br);
    gG = bq / zc;
    gG /= 1.0 + 0.6 * length(gG);
    gG *= 0.6;
    // bordo del grano: un filo di ombra di contatto
    float e = length(bq) / br;
    gapAo = 1.0 - 0.22 * smoothstep(0.7, 1.0, e);
  } else gapAo = 0.7;
  // grani più piccoli di un paio di pixel: se ne vede la media, non il rumore
  float gvis = smoothstep(1.0, 2.8, gpx * K1080);
  gG *= gvis;
  gapAo = mix(0.86, gapAo, gvis);
  // umida: i grani si impastano, meno vuoti e rilievo più morbido
  gG *= 1.0 - 0.55 * coesione;
  gapAo = mix(gapAo, 0.8, coesione * 0.6);
  // ---- il colore del grano: quello portato fin qui, preso al suo centro
  vec2 guv = best > 0.0 ? bc * K1080 / u_res : uv;
  vec4 a = TUV(0, guv), b = TUV(1, guv);
  // dove lo strato di sopra è sottile affiorano i grani di sotto
  float under = 1.0 - smoothstep(0.0, 0.004, b.w);
  vec3 alb = (bh.y < under * 0.85) ? b.xyz : a.yzw;
  float v1 = hash12(bh.xy * 71.3 + S(13.0));
  alb *= 1.0 + varieta * (bh.z - 0.5) * 0.55 * gvis;
  // qualche grano scuro (ferro, mica) e qualche quarzo chiaro
  if (v1 < 0.05 * varieta * gvis) alb = mix(alb, vec3(luma(alb)) * vec3(0.45, 0.43, 0.42), 0.6);
  else if (v1 > 1.0 - 0.06 * varieta * gvis) alb = mix(alb, vec3(luma(alb)) * 1.3 + 0.02, 0.45);
  // ---- luce: rilievo delle dune + increspature + grano
  float rel = 0.6 + 0.8 * rilievo;
  vec2 grad = gS * rel + gR + gG;
  vec3 n = normalize(vec3(-grad, 1.0));
  float lamb = dot(n, Ld) / Ld.z;
  float sh = 0.42 + 0.58 * clamp(lamb, 0.0, 1.9);
  sh = sh > 1.0 ? 1.0 + (sh - 1.0) * 0.55 : sh;
  sh *= 1.0 - 0.5 * shd * min(rilievo + 0.3, 1.0);
  sh *= 1.0 - 0.35 * smoothstep(0.0, 1.0, cav);
  sh *= gapAo;
  // bagnata: più scura e più satura, senza lucido
  float la = luma(alb);
  vec3 wet = mix(vec3(la), alb, 1.3) * 0.68;
  alb = mix(alb, wet, coesione);
  return clamp(alb * sh, 0.0, 1.0);
}`,
};
