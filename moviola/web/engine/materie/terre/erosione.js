// Materia: erosione. La foto è un terreno: la sua luce è la quota. La pioggia
// cade, l'acqua scorre verso il basso e scava: solchi che si ramificano, letti
// di fiume, e dove l'acqua rallenta ventagli e delta di sedimento. Il colore
// della foto viaggia col sedimento e si deposita a valle in strati.
//
// Modello a tubi (acque basse su griglia, Mei–Decaudin–Hu 2007) con capacità
// di trasporto, erosione, deposito, evaporazione, più frane della terra
// troppo ripida (erosione termica). Ogni giro sono tre passi:
//   passo 0 = flussi tra le celle; passo 1 = acqua, velocità, scavo e deposito;
//   passo 2 = il sedimento viaggia con l'acqua, l'acqua evapora, le sponde franano.
// Stato (atlante 2×2, 32 bit, lato lungo 768):
//   tessera 0 = quota della terra, acqua, sedimento sospeso, luce del sedimento;
//   tessera 1 = flussi verso sinistra, destra, alto, basso;
//   tessera 2 = velocità dell'acqua (x, y), colore del sedimento (due assi);
//   tessera 3 = colore della superficie, quota iniziale.
import { P } from '../comune.js';
import { ATLANTE } from './atlante.js';

const COMUNE = ATLANTE + `
#define ER_CYC 6.0
// colore in luce + due assi di colore, e ritorno
vec3 erYCC(vec3 c) { return vec3(dot(c, vec3(0.25, 0.5, 0.25)), dot(c, vec3(0.5, 0.0, -0.5)), dot(c, vec3(-0.25, 0.5, -0.25))); }
vec3 erRGB(vec3 y) { return vec3(y.x + y.y - y.z, y.x + y.z, y.x - y.y - y.z); }
vec2 erDir() { float a = radians(direzione); return vec2(cos(a), sin(a)); }
`;

export const MATERIA = {
  id: 'erosione', code: 'Er', name: 'Erosione', family: 'terre', ref: 'Il terreno visto dall’alto, i calanchi, i delta dei fiumi',
  about: 'La luce della foto diventa la quota di un terreno. Piove: l’acqua scorre verso il basso, scava solchi che si ramificano e letti di fiume, e dove rallenta lascia ventagli e delta di sedimento. Il colore dell’immagine viaggia con la terra e si ridepone a valle in strati.',
  steps: 18, simLong: 768, simF32: true, noloop: true,
  params: [
    P('pioggia', 'Pioggia', 0, 1, 0.5, 0.3),
    P('dove', 'Dove piove', 0, 4, 0, 0, { step: 1, options: ['ovunque', 'sui chiari', 'sugli scuri', 'a scrosci', 'da un bordo'] }),
    P('durezza', 'Durezza della terra', 0, 1, 0.4, 0.1),
    P('duri', 'Più duri (scuri ← → chiari)', -1, 1, 0.3, 0),
    P('trasporto', 'Capacità di trasporto', 0, 1, 0.55, 0.2),
    P('deposito', 'Deposito', 0, 1, 0.5, 0.2),
    P('evapora', 'Evaporazione', 0, 1, 0.35, 0.2),
    P('pendenza', 'Pendenza generale', 0, 1, 0.5, 0),
    P('direzione', 'Direzione della pendenza (°)', 0, 360, 270, 0, { step: 1 }),
    P('rilievo', 'Profondità del rilievo', 0, 2, 1, 0.1),
    P('umido', 'Umidità visibile', 0, 1, 0.6, 0.2),
    P('luce', 'Direzione delle ombre (°)', 0, 360, 315, 0, { step: 1 }),
  ],
  sim: COMUNE + `
float erLuma(vec2 uv) {
  vec2 o = 0.6 / vec2(TSZ());
  return 0.2 * (luma(IN(uv)) + luma(IN(uv + o)) + luma(IN(uv - o)) + luma(IN(uv + vec2(o.x, -o.y))) + luma(IN(uv + vec2(-o.x, o.y))));
}
// la luce della foto ammorbidita: le forme grandi fanno i rilievi, la grana no
float erLumaSoft(vec2 uv) {
  vec2 px = 1.0 / vec2(TSZ());
  float s = erLuma(uv), w = 1.0;
  for (int r = 1; r <= 2; r++) {
    for (int i = 0; i < 8; i++) {
      float an = float(i) * 0.7854 + float(r) * 0.39;
      float wr = r == 1 ? 0.8 : 0.5;
      s += wr * erLuma(uv + vec2(cos(an), sin(an)) * px * 2.2 * float(r)); w += wr;
    }
  }
  return s / w;
}
// quota iniziale: la luce della foto più una pendenza generale e un poco di
// terreno irregolare, perché anche le zone piatte si ramifichino
float erB0(vec2 uv, float L) {
  vec2 p = (uv - 0.5) * vec2(ASPECT, 1.0);
  float ir = fbm(p * 7.0 + S(64.0), 0.0, 0.0, 4);
  return 0.03 + 0.05 * rilievo * L - 0.06 * pendenza * dot(p, erDir()) + 0.0035 * ir;
}
// pioggia per secondo in un punto
float erRain(vec2 uv, float L, float t) {
  float r = pioggia * pioggia * 0.0045;
  int dv = int(dove + 0.5);
  vec2 p = (uv - 0.5) * vec2(ASPECT, 1.0);
  if (dv == 1) r *= 2.0 * smoothstep(0.25, 0.85, L);
  else if (dv == 2) r *= 2.0 * smoothstep(0.75, 0.15, L);
  else if (dv == 3) {
    float s = gnoise(vec3(p * 2.2 + vec2(t * 0.05, t * 0.03), t * 0.12 + S(61.0)), 0.0);
    r *= 5.0 * smoothstep(0.15, 0.55, s);
  } else if (dv == 4) {
    // l'acqua entra da un bordo, a monte della pendenza
    float e = dot(p, -erDir()) / (0.5 * length(vec2(ASPECT, 1.0) * abs(erDir())) + 1e-3);
    r *= 14.0 * smoothstep(0.82, 0.97, e) * (0.6 + 0.4 * gnoise(vec3(p * 6.0, S(62.0)), 0.0));
  }
  return r;
}
// flussi nuovi in uscita dalla cella c (ordine: sinistra, destra, alto, basso)
vec4 erFlux(ivec2 c, float dt) {
  vec4 a = TF(0, c);
  float h = a.x + a.y;
  vec4 f = TF(1, c);
  ivec2 ts = TSZ();
  // fuori dal quadro il terreno scende: l'acqua ai bordi se ne va
  float hl = c.x > 0 ? TF(0, c + ivec2(-1, 0)).x + TF(0, c + ivec2(-1, 0)).y : a.x - 0.002;
  float hr = c.x < ts.x - 1 ? TF(0, c + ivec2(1, 0)).x + TF(0, c + ivec2(1, 0)).y : a.x - 0.002;
  float ht = c.y < ts.y - 1 ? TF(0, c + ivec2(0, 1)).x + TF(0, c + ivec2(0, 1)).y : a.x - 0.002;
  float hb = c.y > 0 ? TF(0, c + ivec2(0, -1)).x + TF(0, c + ivec2(0, -1)).y : a.x - 0.002;
  const float G = 0.45;
  f = max(vec4(0.0), f * 0.98 + dt * G * vec4(h - hl, h - hr, h - ht, h - hb));
  float tot = f.x + f.y + f.z + f.w;
  float K = tot > 0.0 ? min(1.0, a.y / (tot * dt)) : 0.0;
  return f * K;
}
vec4 sim(vec2 uv0) {
  int k = TK();
  if (k < 0) return vec4(0.0);
  ivec2 c = TC();
  ivec2 ts = TSZ();
  vec2 uv = TCUV(c);
  int ph = int(mod(u_step, 3.0) + 0.5);
  float dt = 0.5;                                  // passo, in unità della griglia
  float tsec = 1.0 / (24.0 * ER_CYC);              // secondi per giro
  float t = u_t + floor(u_step / 3.0) * tsec;
  if (u_init > 0.5) {
    float L = 0.85 * erLumaSoft(uv) + 0.15 * erLuma(uv);
    vec3 col = IN(uv);
    float b = erB0(uv, L);
    if (k == 0) return vec4(b, 0.0, 0.0, 0.0);
    if (k == 1) return vec4(0.0);
    if (k == 2) return vec4(0.0);
    return vec4(col, b);
  }
  vec4 T0 = TF(0, c), T1 = TF(1, c), T2 = TF(2, c), T3 = TF(3, c);
  // ---- passo 0: i flussi
  if (ph == 0) {
    if (k == 1) return erFlux(c, dt);
    return k == 0 ? T0 : k == 2 ? T2 : T3;
  }
  // ---- passo 1: acqua, velocità, scavo e deposito
  if (ph == 1) {
    float L = erLuma(uv);
    vec4 fo = T1;
    // dai vicini entra ciò che esce verso di noi (fuori dal quadro non entra niente)
    float fl = c.x > 0 ? TF(1, c + ivec2(-1, 0)).y : 0.0;
    float fr = c.x < ts.x - 1 ? TF(1, c + ivec2(1, 0)).x : 0.0;
    float ft = c.y < ts.y - 1 ? TF(1, c + ivec2(0, 1)).w : 0.0;
    float fb = c.y > 0 ? TF(1, c + ivec2(0, -1)).z : 0.0;
    float fin = fl + fr + ft + fb;
    float d0 = T0.y;
    float d1 = max(d0 + dt * (fin - (fo.x + fo.y + fo.z + fo.w)), 0.0);
    d1 += erRain(uv, L, t) * tsec;
    float dm = max(0.5 * (d0 + d1), 1e-6);
    float wx = 0.5 * (fl - fo.x + fo.y - fr);
    float wy = 0.5 * (fb - fo.w + fo.z - ft);
    vec2 v = vec2(wx, wy) / dm;
    v *= min(1.0, 0.8 / max(length(v), 1e-6));     // mai più di una cella per passo
    // pendenza della terra
    float bx = TF(0, c + ivec2(1, 0)).x - TF(0, c + ivec2(-1, 0)).x;
    float by = TF(0, c + ivec2(0, 1)).x - TF(0, c + ivec2(0, -1)).x;
    float dxw = 2.0 / float(ts.y);
    float sl = length(vec2(bx, by)) / dxw;
    float sa = sl / sqrt(1.0 + sl * sl);
    // capacità: più acqua che corre in discesa porta più terra (portata × pendenza)
    // nelle pozze (acqua lenta) non scava: lì l'acqua deposita
    float q = length(vec2(wx, wy));
    float cap = trasporto * 8.0 * max(sa, 0.01) * min(q, 0.003) * (1.0 - smoothstep(1.5e-4, 6e-4, d1));
    float s = T0.z;
    float hard = clamp(durezza * (1.0 + duri * (L - 0.5) * 1.8), 0.0, 1.5);
    float Ks = 0.25 / (1.0 + 6.0 * hard);
    float Kd = 0.05 + 0.5 * deposito;
    float b = T0.x;
    vec3 sc = vec3(T0.w, T2.zw);                    // colore del sedimento
    vec3 surf = T3.rgb;
    if (s < cap) {
      float e = Ks * (cap - s);
      e = min(e, 0.0002);
      // la terra scavata: in superficie il suo colore; sotto, la foto più scura e cruda
      float dug = clamp((T3.w - b) / 0.01, 0.0, 1.0);
      vec3 under = mix(surf, IN(uv) * 0.78, 0.5 * dug);
      vec3 ey = erYCC(under);
      sc = (sc * s + ey * e) / max(s + e, 1e-9);
      b -= e; s += e;
    } else {
      float dpo = Kd * (s - cap);
      b += dpo; s -= dpo;
      // il deposito copre la superficie col colore che porta
      surf = mix(surf, erRGB(sc), clamp(dpo / (dpo + 0.0004), 0.0, 1.0));
    }
    if (k == 0) return vec4(b, d1, s, sc.x);
    if (k == 2) return vec4(v, sc.yz);
    if (k == 3) return vec4(clamp(surf, 0.0, 1.0), T3.w);
    return T1;
  }
  // ---- passo 2: il sedimento viaggia, l'acqua evapora, le sponde franano
  vec2 v = T2.xy;
  vec2 back = vec2(c) + 0.5 - v * dt;
  vec4 Ab = TL(0, back), Cb = TL(2, back);
  float s = Ab.z;
  vec3 sc = vec3(Ab.w, Cb.zw);
  float d = T0.y * (1.0 - (0.004 + 0.06 * evapora * evapora) * dt);
  // il sedimento si posa dove l'acqua sparisce
  float b = T0.x;
  float lost = s * clamp(1.0 - d / max(T0.y, 1e-7), 0.0, 1.0);
  b += lost; s -= lost;
  // frane: la terra più ripida dell'angolo di riposo scivola (simmetrico: si conserva)
  float dxw = 1.0 / float(ts.y);
  float tal = 0.9 * dxw;
  float th = 0.0;
  for (int j = 0; j < 4; j++) {
    ivec2 o = j == 0 ? ivec2(1, 0) : j == 1 ? ivec2(-1, 0) : j == 2 ? ivec2(0, 1) : ivec2(0, -1);
    float bn = TF(0, c + o).x;
    th += 0.08 * (max(bn - T0.x - tal, 0.0) - max(T0.x - bn - tal, 0.0));
  }
  b += th;
  if (k == 0) return vec4(b, d, s, sc.x);
  if (k == 2) return vec4(T2.xy, sc.yz);
  return k == 1 ? T1 : T3;
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
  float dxu = 1.0 / float(ts.y);
  vec3 hb = TBS(0, lc, 0);                      // quota della terra
  vec3 hw = TBS(0, lc, 1);                      // acqua
  vec2 gS = hb.yz / dxu;
  vec4 A = TL(0, lc), C = TL(2, lc), D = TL(3, lc);
  float b0 = D.w;
  float dug = b0 - hb.x;                        // quanto è stato scavato
  float dep = hb.x - b0;                        // quanto si è depositato
  float ang = radians(luce);
  vec2 L2 = -vec2(cos(ang), sin(ang));
  vec3 Ld = normalize(vec3(L2, 0.7));
  // ---- ombra propria e cavità, dalla quota
  float shd = 0.0;
  for (int s = 1; s <= 6; s++) {
    float d = float(s) * float(s) * 1.0;
    float hs = TL(0, lc + L2 * d).x;
    shd = max(shd, smoothstep(0.0, 0.3, (hs - hb.x) / (d * dxu) - 0.75));
  }
  float ring = 0.0;
  for (int i = 0; i < 6; i++) { float an = float(i) * 1.0472; ring += TL(0, lc + vec2(cos(an), sin(an)) * 4.0).x; }
  float cav = clamp((ring / 6.0 - hb.x) / dxu * 0.5, -1.0, 1.0);
  // ---- grana della terra, in pixel × K1080: più ruvida dove è dura e scavata
  vec2 P = uv * u_res / K1080;
  vec2 gr = (vec2(erV(P / 2.2), erV(P / 2.2 + 17.0)) - 0.5) * 0.35
          + (vec2(erV(P / 7.0 + 5.0), erV(P / 7.0 + 31.0)) - 0.5) * 0.4
          + (vec2(erV(P / 23.0 + 9.0), erV(P / 23.0 + 3.0)) - 0.5) * 0.35;
  float rough = 0.35 + 0.65 * smoothstep(0.0, 0.004, dug);
  // strati nelle sponde scavate: linee di quota, come nei calanchi
  float band = fract(hb.x * 900.0 + 0.3 * erV(P / 60.0));
  float bandL = smoothstep(0.0, 0.1, band) * smoothstep(1.0, 0.85, band);
  float steep = smoothstep(0.25, 1.0, length(gS)) * smoothstep(0.0005, 0.004, dug);
  // lamine sottili nel deposito
  float lam = fract(dep * 2600.0 + 0.2 * erV(P / 40.0 + 2.0));
  // ---- luce
  // sotto l'acqua il rilievo si spiana: la superficie dell'acqua è piatta
  float wd0 = max(hw.x, 0.0);
  float deep0 = 1.0 - exp(-wd0 * 900.0);
  vec2 grad = (gS * (0.2 + 0.45 * rilievo) + gr * rough * 0.3) * (1.0 - 0.85 * deep0);
  vec3 n = normalize(vec3(-grad, 1.0));
  float lm = dot(n, Ld) / Ld.z;
  float sh = 0.4 + 0.6 * clamp(lm, 0.0, 1.8);
  sh = sh > 1.0 ? 1.0 + (sh - 1.0) * 0.5 : sh;
  sh *= 1.0 - 0.5 * shd * min(rilievo + 0.3, 1.0);
  sh *= 1.0 - 0.4 * smoothstep(0.0, 1.0, cav);
  // ---- colore: la superficie (foto e sedimenti), gli strati nelle sponde
  vec3 alb = D.rgb;
  vec3 raw = IN(uv);
  vec3 stra = mix(raw * 0.62, mix(vec3(luma(raw)), raw, 0.7) * 1.05, bandL);
  alb = mix(alb, stra, steep * 0.75);
  alb *= 1.0 + 0.06 * (lam - 0.5) * smoothstep(0.0, 0.002, dep);
  // ---- acqua: bagna e scurisce, poi tinge col fango che porta; niente riflessi
  float wd = max(hw.x, 0.0);
  float wet = smoothstep(0.0, 0.0012, wd) * umido;
  vec3 col = alb * sh;
  float la = luma(col);
  col = mix(col, mix(vec3(la), col, 1.25) * 0.62, wet);
  vec3 mud = erRGB(vec3(A.w, C.zw));
  float deep = 1.0 - exp(-wd * 420.0);
  col = mix(col, mud * 0.55 * (0.7 + 0.3 * sh), deep * 0.75 * clamp(A.z * 400.0 + 0.3, 0.0, 1.0));
  col *= 1.0 - 0.25 * deep;
  return clamp(col, 0.0, 1.0);
}`,
};
