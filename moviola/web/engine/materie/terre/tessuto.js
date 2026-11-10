// Materia: tessuto bagnato. La foto è stampata su una stoffa pesante appesa
// davanti a un muro: pende dai suoi punti d'appiglio, si piega, si tende, e
// dove la tensione supera la soglia si strappa lasciando bordi sfilacciati;
// attraverso i buchi si vede ciò che sta sotto nella catena.
//
// Simulazione (atlante 2×2, 32 bit, lato lungo 288: una griglia di nodi):
//   tessera 0 = posizione del nodo (x, y, z) e filo a destra rotto (0/1);
//   tessera 1 = velocità del nodo e filo in alto rotto (0/1);
//   tessera 2 = bagnato del nodo, sforzo sopportato.
// Ogni passo è un piccolo passo di dinamica basata sulle posizioni (Verlet +
// vincoli di stiramento, taglio e piega, risolti in parallelo): tanti passi
// piccoli al fotogramma invece di poche iterazioni grandi.
// Il disegno inverte la deformazione (da pixel a punto della stoffa), ci
// stampa la foto, la trama del filato in pixel × K1080, le pieghe in luce
// morbida e i bordi degli strappi.
import { P } from '../comune.js';
import { ATLANTE } from './atlante.js';

const COMUNE = ATLANTE + `
#define TS_STEPS 48.0
// la stoffa è un po' più grande del quadro: i suoi orli stanno fuori
#define TS_EXT 1.1
// posizione a riposo del punto materiale m (0..1), nel piano del quadro
vec3 tsRestM(vec2 m) { return vec3((m - 0.5) * vec2(ASPECT, 1.0) * TS_EXT, 0.0); }
vec3 tsRest(ivec2 c) { return tsRestM(TCUV(c)); }
float tsH0() { return TS_EXT / float(TSZ().y); }
// avvio: gli appigli raggiungono la loro posizione nel primo secondo e mezzo
float tsGo(float t) { return smoothstep(0.0, 1.6, t); }
// l'appiglio a: punto materiale dove la stoffa è inchiodata
vec2 tsAnchorM(int a, float n) {
  float fa = float(a);
  vec2 h = hash22(vec2(fa * 3.1, 7.0) + S(41.0));
  // i primi sull'orlo in alto, gli altri inchiodati nella metà alta
  float row = fa < max(2.0, n * 0.5) ? 0.985 : 0.55 + 0.38 * h.y;
  return vec2(clamp((fa + 0.5) / n + (h.x - 0.5) * 0.5 / n, 0.04, 0.96), row);
}
// dove sta l'appiglio a al tempo t
vec3 tsAnchor(int a, float n, float t) {
  vec2 mA = tsAnchorM(a, n);
  vec3 r = tsRestM(mA);
  float go = tsGo(t);
  // pieghe: gli appigli si stringono verso il centro e la stoffa avanza in fuori
  vec2 cen = vec2(0.0, 0.25);
  vec2 p = r.xy;
  p = cen + (p - cen) * vec2(1.0 - 0.62 * pieghe * go, 1.0 - 0.2 * pieghe * go);
  // tensione: tirati in alto e verso l'esterno
  p += go * tensione * vec2(sign(p.x) * 0.06 * abs(p.x) / (0.5 * ASPECT), 0.07);
  // il respiro: ogni appiglio si muove piano, a modo suo
  float m = moto * 0.11;
  float fa = float(a);
  p += m * go * vec2(gnoise(vec3(fa * 7.7, t * 0.31, S(42.0)), 0.0), 0.8 * gnoise(vec3(fa * 5.3 + 3.0, t * 0.27, S(43.0)), 0.0));
  float z = 0.02 * pieghe * go * hash11(fa + S(44.0));
  return vec3(p, z);
}
// il nodo c è tenuto da un appiglio? (una piccola toppa di 3×3 nodi)
int tsPin(ivec2 c, float t, out vec3 ap) {
  ap = vec3(0.0);
  ivec2 ts = TSZ();
  float n = floor(appigli + 0.5);
  for (int a = 0; a < 9; a++) {
    if (float(a) >= n) break;
    ivec2 cA = ivec2(floor(tsAnchorM(a, n) * vec2(ts)));
    ivec2 d = c - cA;
    if (abs(d.x) <= 1 && abs(d.y) <= 1) { ap = tsAnchor(a, n, t) + vec3(vec2(d) * tsH0(), 0.0); return a; }
  }
  return -1;
}
// soglia di rottura di un filo (in allungamento relativo)
float tsThr(ivec2 c, float dir) {
  if (strappo > 0.98) return 1e9;
  float h = hash12(vec2(c) * 1.31 + dir * 17.0 + S(45.0));
  float wk = gnoise(vec3(TCUV(c) * vec2(ASPECT, 1.0) * 2.3, S(46.0)), 0.0);
  return mix(0.12, 1.1, strappo) * (0.7 + 0.6 * h) * (1.0 + 0.45 * wk);
}
`;

export const MATERIA = {
  id: 'tessuto', code: 'Ts', name: 'Tessuto bagnato', family: 'terre', ref: 'Il drappo pesante delle pieghe barocche; i Sacchi di Burri',
  about: 'La foto è stampata su una stoffa pesante e bagnata, appesa davanti a un muro: pende dai suoi appigli in pieghe profonde con ombra propria, si tende, e dove cede si strappa con bordi sfilacciati che lasciano vedere ciò che sta sotto. Da vicino si vede il filato; dove è più bagnata è più scura e aderisce al muro.',
  steps: 48, simLong: 224, simF32: true, noloop: true,
  params: [
    P('peso', 'Peso', 0, 1, 0.6, 0.1),
    P('rigidita', 'Rigidità', 0, 1, 0.35, 0.1),
    P('umidita', 'Umidità', 0, 1, 0.5, 0.3),
    P('trama', 'Trama (fine → grossa, px)', 1.5, 12, 4, 0),
    P('appigli', 'Punti d’appiglio', 1, 9, 4, 0, { step: 1 }),
    P('tensione', 'Tensione', 0, 1, 0.45, 0.3),
    P('strappo', 'Soglia dello strappo', 0, 1, 0.45, 0),
    P('sfilaccia', 'Sfilacciatura', 0, 1, 0.6, 0.1),
    P('pieghe', 'Ampiezza delle pieghe', 0, 1, 0.6, 0.2),
    P('moto', 'Moto (quanto respira)', 0, 1, 0.4, 0.2),
    P('sotto', 'Sotto: buio → immagine', 0, 1, 0.25, 0),
    P('luce', 'Direzione delle ombre (°)', 0, 360, 315, 0, { step: 1 }),
  ],
  sim: COMUNE + `
vec4 sim(vec2 uv0) {
  int k = TK();
  if (k < 0 || k == 3) return vec4(0.0);
  ivec2 c = TC();
  ivec2 ts = TSZ();
  float dt = 1.0 / (24.0 * TS_STEPS);
  float t = u_t + u_step * dt;
  vec3 r0 = tsRest(c);
  vec2 uv = TCUV(c);
  // il bagnato: chiazze lente che scendono, più o meno estese
  float wt = smoothstep(0.55 - umidita * 0.9, 0.9 - umidita * 0.6,
    0.5 + 0.5 * gnoise(vec3(uv * vec2(ASPECT, 1.0) * 1.8 + vec2(0.0, t * 0.02), t * 0.05 + S(46.0)), 0.0)
    + 0.25 * gnoise(vec3(uv * vec2(ASPECT, 1.0) * 5.0, S(47.0)), 0.0));
  if (u_init > 0.5) {
    // al primo passo la stoffa è distesa sul muro, con una lieve ondulazione
    float z0 = 0.004 * pieghe * (0.5 + 0.5 * gnoise(vec3(r0.xy * 9.0, S(48.0)), 0.0));
    if (k == 0) return vec4(r0.xy, z0, 0.0);
    if (k == 1) return vec4(0.0);
    return vec4(wt * umidita, 0.0, 0.0, 0.0);
  }
  vec4 A = TF(0, c), B = TF(1, c), W = TF(2, c);
  float wet = W.x;
  float h0 = tsH0();
  // forze: peso (verso il basso e un poco verso il muro) e respiro dell'aria
  float g = 0.5 + 1.4 * peso;
  vec3 acc = vec3(0.0, -g * (1.0 + 0.5 * wet), -0.03 * g);
  // l'aria: soffi lenti che gonfiano la stoffa e la spostano di lato
  float gust = moto * (0.55 + 0.45 * sin(t * 0.6 + 1.3)) / (0.45 + peso);
  acc.z += gust * 3.0 * (0.35 + gnoise(vec3(A.xy * 1.6, t * 0.4 + S(49.0)), 0.0));
  acc.x += gust * 1.2 * gnoise(vec3(A.xy * 1.3 + 4.0, t * 0.33 + S(50.0)), 0.0);
  vec3 ap;
  int pin = tsPin(c, t, ap);
  vec3 xp = pin >= 0 ? ap : A.xyz + B.xyz * dt + acc * dt * dt;
  // vincoli: quattro fili, quattro diagonali (taglio), quattro a due passi (piega)
  vec3 sum = vec3(0.0);
  float rg = (0.08 + 0.9 * rigidita * rigidita) * (1.0 - 0.6 * wet);
  for (int j = 0; j < 12; j++) {
    ivec2 o; float s; float L0;
    if (j < 4) { o = j == 0 ? ivec2(1, 0) : j == 1 ? ivec2(-1, 0) : j == 2 ? ivec2(0, 1) : ivec2(0, -1); s = 1.0; L0 = h0; }
    else if (j < 8) { o = j == 4 ? ivec2(1, 1) : j == 5 ? ivec2(-1, -1) : j == 6 ? ivec2(1, -1) : ivec2(-1, 1); s = 0.45; L0 = h0 * 1.41421; }
    else { o = j == 8 ? ivec2(2, 0) : j == 9 ? ivec2(-2, 0) : j == 10 ? ivec2(0, 2) : ivec2(0, -2); s = rg; L0 = 2.0 * h0; }
    ivec2 nc = c + o;
    if (nc.x < 0 || nc.y < 0 || nc.x >= ts.x || nc.y >= ts.y) continue;
    // fili rotti: un vincolo vale solo se la stoffa tra i due nodi è intera
    bool ok = true;
    if (j < 4 || j >= 8) {
      int st = j >= 8 ? 2 : 1;
      ivec2 u = ivec2(sign(vec2(o)));
      for (int q = 0; q < 2; q++) {
        if (q >= st) break;
        ivec2 a0 = c + u * q;
        ivec2 lo = u.x + u.y > 0 ? a0 : a0 + u;   // il nodo che possiede il filo
        float br = u.x != 0 ? TF(0, lo).w : TF(1, lo).w;
        if (br > 0.5) ok = false;
      }
    } else {
      ivec2 lo = min(c, nc);
      ivec2 hi = max(c, nc);
      // la diagonale tiene se la cella che attraversa ha i quattro lati interi
      ivec2 bl = ivec2(lo.x, min(c.y, nc.y));
      if (TF(0, bl).w > 0.5 || TF(1, bl).w > 0.5 || TF(0, bl + ivec2(0, 1)).w > 0.5 || TF(1, bl + ivec2(1, 0)).w > 0.5) ok = false;
    }
    if (!ok) continue;
    vec3 ap2;
    int np = tsPin(nc, t, ap2);
    vec4 nA = TF(0, nc);
    vec3 xn = np >= 0 ? ap2 : nA.xyz + TF(1, nc).xyz * dt + acc * dt * dt;
    vec3 d = xp - xn;
    float l = max(length(d), 1e-7);
    float C = l - L0;
    // la stoffa cede quasi subito se compressa: per questo fa pieghe
    if (C < 0.0) C *= j < 8 ? 0.35 : 1.0;
    sum += -(np >= 0 ? 0.5 : 0.25) * s * C * d / l;
  }
  vec3 xn2 = pin >= 0 ? ap : xp + sum;
  // il muro: la stoffa non lo attraversa; bagnata ci si attacca
  if (xn2.z < 0.0) xn2.z = 0.0;
  if (pin < 0) {
    float touch = 1.0 - smoothstep(0.0, 0.004, xn2.z);
    xn2.z -= xn2.z * 0.03 * wet * umidita;
    xn2.xy = mix(xn2.xy, A.xy, touch * (0.003 + 0.08 * wet * umidita));
  }
  vec3 v = (xn2 - A.xyz) / dt;
  v *= 1.0 - dt * (0.6 + 2.2 * wet + 1.5 * peso);
  if (k == 0 || k == 1) {
    // il filo che possiede questo nodo (a destra o in alto) si rompe se troppo teso
    ivec2 o = k == 0 ? ivec2(1, 0) : ivec2(0, 1);
    float br = k == 0 ? A.w : B.w;
    ivec2 nc = c + o;
    if (br < 0.5 && nc.x < ts.x && nc.y < ts.y) {
      float l = length(A.xyz - TF(0, nc).xyz);
      if (l / h0 - 1.0 > tsThr(c, float(k))) br = 1.0;
    }
    return k == 0 ? vec4(xn2, br) : vec4(v, br);
  }
  // bagnato: va verso la sua chiazza e scende per gravità
  float wu = TF(2, c + ivec2(0, 1)).x;
  wet = mix(wet, wt * umidita, 0.004) + 0.01 * (wu - wet);
  float strain = length(A.xyz - TF(0, c + ivec2(1, 0)).xyz) / h0 - 1.0;
  return vec4(clamp(wet, 0.0, 1.0), max(W.y * 0.999, strain), 0.0, 0.0);
}`,
  glsl: COMUNE + `
// posizione della stoffa al punto materiale m (uv), interpolata tra i nodi
vec3 tsPos(vec2 m) { return TL(0, m * vec2(TSZ())).xyz; }
// tessitura a tela: altezza del filato (0..1) nel punto q (in fili)
float tsWeave(vec2 q, out float warp) {
  vec2 i = floor(q), f = fract(q);
  float th = hash12(vec2(i.x, 3.0) + S(51.0)), tv = hash12(vec2(4.0, i.y) + S(52.0));
  float aw = 1.0 - pow(2.0 * f.x - 1.0, 2.0) * (1.25 - 0.3 * th);
  float af = 1.0 - pow(2.0 * f.y - 1.0, 2.0) * (1.25 - 0.3 * tv);
  float uw = 0.5 + 0.5 * cos(PI * (q.y + i.x));
  float uf = 0.5 - 0.5 * cos(PI * (q.x + i.y));
  float hw = sqrt(max(aw, 0.0)) * (0.35 + 0.65 * uw);
  float hf = sqrt(max(af, 0.0)) * (0.35 + 0.65 * uf);
  warp = step(hf, hw);
  return max(hw, hf);
}
vec3 fx(vec2 uv) {
  ivec2 ts = TSZ();
  vec2 asp = vec2(ASPECT, 1.0);
  vec2 p = (uv - 0.5) * asp;
  vec3 img = IN(uv);
  // ---- da pixel a stoffa: punto fisso m = m + (p - pos(m))
  vec2 m = 0.5 + (uv - 0.5) / TS_EXT;
  for (int i = 0; i < 12; i++) {
    vec3 x = tsPos(m);
    m += (p - x.xy) / (asp * TS_EXT) * 0.9;
  }
  vec3 X = tsPos(m);
  float res = length((p - X.xy) * u_res.y);
  float h0 = tsH0();
  // ---- dove la stoffa non c'è: fuori dai bordi, oltre gli strappi
  vec2 lc = m * vec2(ts) - 0.5;
  ivec2 c0 = ivec2(floor(lc));
  vec2 f = lc - floor(lc);
  // un filo per pixel·K1080: per lo sfilacciato serve sapere su quale filo siamo
  vec2 mp = m * asp * TS_EXT * 1080.0;
  vec2 qth = mp / trama;
  float hole = 0.0;
  // bordi della stoffa: orlo sfilacciato
  vec2 eb = min(m, 1.0 - m) * asp * TS_EXT * 1080.0;
  float fr = sfilaccia * trama * (2.0 + 6.0 * hash12(floor(qth.yx) + S(53.0)));
  float edge = min(eb.x - fr * step(eb.x, eb.y), eb.y - fr * step(eb.y, eb.x));
  if (edge < 0.0 || res > 2.5) hole = 1.0;
  // strappi: tra due nodi il cui filo è rotto la stoffa si apre; l'apertura
  // si stringe verso il filo intero accanto (la punta dello strappo) e i fili
  // di traverso pendono nel vuoto, ognuno lungo a modo suo
  for (int a = 0; a < 2; a++) {
    // a = 0: fili orizzontali rotti (la stoffa si apre in x); a = 1: in y
    float op[2];
    for (int b = 0; b < 2; b++) {
      ivec2 own = a == 0 ? c0 + ivec2(0, b) : c0 + ivec2(b, 0);
      float br = a == 0 ? TF(0, own).w : TF(1, own).w;
      ivec2 nb = own + (a == 0 ? ivec2(1, 0) : ivec2(0, 1));
      float l = length(TF(0, own).xyz - TF(0, nb).xyz) / h0;
      op[b] = br > 0.5 ? 0.5 * (1.0 - 1.0 / max(l, 1.0)) + 0.06 : 0.0;
    }
    float wb = a == 0 ? f.y : f.x;
    float o = mix(op[0], op[1], smoothstep(0.0, 1.0, wb));
    if (o <= 0.0) continue;
    float ff = a == 0 ? f.x : f.y;
    // il centro dello strappo non è dritto: segue una linea irregolare
    float cc = 0.5 + 0.18 * (hash12(vec2(c0) * 0.73 + float(a) * 5.0 + S(55.0)) - 0.5);
    float th = a == 0 ? qth.y : qth.x;
    float hj = hash12(vec2(floor(th), float(a) * 9.0) + S(54.0));
    float fringe = sfilaccia * 0.5 * o * hj * hj;
    // qualche filo regge ancora da una parte all'altra
    bool ponte = hj > 1.0 - 0.05 * sfilaccia && o < 0.3 && fract(th) > 0.25 && fract(th) < 0.75;
    if (!ponte && abs(ff - cc) < o - fringe) hole = 1.0;
  }
  // ---- sotto la stoffa: la catena, nell'ombra della stoffa
  vec3 under = img * mix(0.04, 0.8, sotto);
  if (hole > 0.5) return under;
  // ---- normale della stoffa dalla spline dei nodi (liscia, senza griglia)
  vec2 lcs = m * vec2(ts);
  vec3 bx = TBS(0, lcs, 0), by = TBS(0, lcs, 1), bz = TBS(0, lcs, 2);
  vec3 du = vec3(bx.y, by.y, bz.y), dv = vec3(bx.z, by.z, bz.z);
  vec3 n = normalize(cross(du, dv));
  if (n.z < 0.0) n = -n;
  // compressione locale: dove la stoffa è stretta nascono piccole grinze
  float cu = length(du) / h0, cv = length(dv) / h0;
  // ---- trama del filato, vista da vicino
  float wv;
  float fw = max(fwidth(qth.x), fwidth(qth.y));
  float wa = 1.0 - smoothstep(0.22, 0.5, fw);
  float hw = tsWeave(qth, wv);
  float e2 = 0.05;
  float wvx, wvy;
  vec2 gW = vec2(tsWeave(qth + vec2(e2, 0.0), wvx) - hw, tsWeave(qth + vec2(0.0, e2), wvy) - hw) / e2;
  // fibre ritorte lungo il filo
  float along = wv > 0.5 ? qth.y : qth.x;
  float fib = sin((along * 3.2 + (wv > 0.5 ? qth.x : qth.y) * 1.3) * TAU) * 0.12;
  float wet = TL(2, lcs).x;
  float wa2 = wa * (1.0 - 0.45 * wet);
  vec3 nW = normalize(vec3(-gW * 0.22 * wa2, 1.0));
  // la trama inclina la normale della stoffa
  vec3 tU = normalize(du), tV = normalize(cross(n, tU));
  vec3 N = normalize(n + (tU * (nW.x + fib * 0.1 * wa2) + tV * nW.y) * 1.0);
  // ---- luce morbida, ombra propria delle pieghe
  float ang = radians(luce);
  vec2 L2 = -vec2(cos(ang), sin(ang));
  vec3 Ld = normalize(vec3(L2, 0.75));
  float lam = dot(N, Ld) / Ld.z;
  float sh = 0.35 + 0.65 * clamp(lam, 0.0, 1.6);
  sh = sh > 1.0 ? 1.0 + (sh - 1.0) * 0.5 : sh;
  // ombra portata dalle pieghe vicine (in coordinate di stoffa)
  float occ = 0.0;
  for (int s = 1; s <= 5; s++) {
    float d = float(s) * float(s) * 0.6;
    float zs = TL(0, lcs + L2 * d).z;
    occ = max(occ, smoothstep(0.0, 0.5, (zs - X.z) / (d * h0) - 0.6));
  }
  // fondo delle pieghe e muro vicino: meno luce
  float zr = 0.0;
  for (int i = 0; i < 6; i++) { float an = float(i) * 1.0472; zr += TL(0, lcs + vec2(cos(an), sin(an)) * 3.5).z; }
  float cav = clamp((zr / 6.0 - X.z) / h0 * 0.6, -1.0, 1.0);
  float ao = (1.0 - 0.35 * smoothstep(0.0, 1.0, cav)) * (1.0 - 0.3 * wa * (1.0 - hw) * (1.0 - 0.6 * wet));
  sh *= (1.0 - 0.45 * occ) * ao;
  // ---- colore: la foto stampata sul filato
  vec2 pu = 0.5 + (m - 0.5) * TS_EXT;
  pu = 1.0 - abs(1.0 - mod(pu, 2.0));   // oltre la foto, la foto a specchio
  vec3 alb = IN(pu);
  alb *= 1.0 + 0.08 * wa * (hw - 0.6) + 0.04 * (wv - 0.5) * wa;
  // stirata: la stampa si schiarisce dove il filato si apre
  float stre = clamp(max(cu, cv) - 1.05, 0.0, 0.6);
  alb = mix(alb, vec3(luma(alb)) * 0.9 + 0.08, stre * 0.35);
  // bagnata: più scura, più satura, un po' trasparente sul muro
  float la = luma(alb);
  vec3 wc = mix(vec3(la), alb, 1.35) * 0.58;
  alb = mix(alb, wc, smoothstep(0.05, 0.6, wet));
  // l'alone: dove il bagnato finisce si ferma un orlo più scuro
  alb *= 1.0 - 0.12 * smoothstep(0.08, 0.2, wet) * smoothstep(0.42, 0.22, wet);
  vec3 col = alb * sh;
  col = mix(col, under, 0.12 * wet * (1.0 - smoothstep(0.0, 0.01, X.z)) * sotto);
  return clamp(col, 0.0, 1.0);
}`,
};
