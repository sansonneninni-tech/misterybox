// Materia densa: ghiaccio. La foto è congelata in fondo a un blocco spesso,
// visto da vicinissimo: strati a profondità diverse (bolle, veli lattiginosi,
// piani di frattura) che scorrono in parallasse, e sopra una superficie vera
// (campo d'altezza: conche di fusione, crepe, un velo d'acqua che cola).
// Tutto procedurale e periodico: il loop si chiude.
import { P } from '../comune.js';

export const MATERIA = {
  id: 'ghiaccio', code: 'Gh', name: 'Ghiaccio', family: 'dense', ref: 'Viola, l’acqua e la lentezza; Clipson, macro',
  about: 'La foto è congelata in fondo a un blocco di ghiaccio spesso visto da vicinissimo: sciami di bolle, veli lattiginosi e piani di frattura a profondità diverse scorrono in parallasse, i piani di frattura avanzano a scatti e sulla superficie a conche cola un velo d’acqua di fusione.',
  params: [
    P('materia', 'Ghiaccio', 0, 1, 0.85, 0.2),
    P('spessore', 'Spessore del blocco', 0, 1, 0.6, 0.3),
    P('bolle', 'Bolle d’aria', 0, 1, 0.55, 0.2),
    P('fratture', 'Fratture', 0, 1, 0.6, 0.3),
    P('latte', 'Lattiginoso', 0, 1, 0.42, 0.4),
    P('fusione', 'Acqua di fusione', 0, 1, 0.5, 0.3),
    P('deriva', 'Deriva degli strati', 0, 1, 0.5, 0.3),
    P('luce', 'Direzione delle ombre', 0, 1, 0.12, 0),
  ],
  glsl: `
// Piano di frattura interno: una lunga linea curva; da un lato la foto è spostata, appena
// ruotata e ingrandita (la discontinuità sta solo sulla linea), quel lato è di poco più
// pallido e porta le onde concoidi che si spengono allontanandosi. Nessuna riga disegnata.
// Restituisce il pallore; aggiunge a ofs lo spostamento della foto.
float ghFrac(vec2 q, float fi, float T, inout vec2 ofs) {
  vec3 h = hash33(vec3(fi * 7.31 + 1.3, S(51.0), 2.17));
  vec3 h2 = hash33(vec3(fi * 3.17 + 5.1, 9.71, S(52.0)));
  q += 0.02 * sin(q.yx * vec2(5.0, 6.0) + fi * 2.1) + 0.004 * sin(q.yx * vec2(29.0, 23.0) + fi);
  float R = 0.42 + 0.45 * h.z;
  vec2 o = vec2((0.25 + 0.5 * h.x) * ASPECT, 0.25 + 0.5 * h.y);
  float th = h2.x * TAU;
  vec2 c = o - R * vec2(cos(th), sin(th));
  vec2 d = q - c;
  float r = length(d);
  vec2 nrm = d / max(r, 1e-4);
  float da = mod(atan(d.y, d.x) - th + PI, TAU) - PI;
  // la frattura parte dal punto d'innesco e avanza a scatti nei due versi, poi il gelo la richiude
  float ph = fract(T + h2.z);
  float g0 = smoothstep(0.0, 0.65, ph) * 4.0;
  float gr = (floor(g0) + smoothstep(0.75, 1.0, fract(g0))) / 4.0;
  float len = min(0.75 + 0.5 * h2.y, R * 2.4) * (0.4 + 0.6 * gr);
  float life = smoothstep(0.0, 0.03, ph) * (1.0 - smoothstep(0.92, 1.0, ph));
  float u = abs(da * R + (h2.y - 0.5) * 0.3 * len);
  if (u > len) return 0.0;
  float un = u / len;
  float mu = (1.0 - smoothstep(0.45, 1.0, un)) * life;
  float side = h.y > 0.5 ? 1.0 : -1.0;
  float t = -(r - R) * side / ((0.16 + 0.14 * h.x) * (0.35 + 0.65 * sqrt(1.0 - un)));
  if (t <= 0.0) return 0.0;
  float fall = (1.0 - smoothstep(0.0, 1.0, t));
  fall *= fall;
  // onde concoidi: concentriche attorno all'innesco, morbide
  float rib = sin(t * 26.0 + un * 7.0 + 2.0 * sin(u * 9.0 + fi)) * exp(-t * 3.5);
  float wt = fall * mu;
  vec2 tg = vec2(-nrm.y, nrm.x);
  vec2 rel = q - o;
  float am = 0.8 + 1.2 * fratture;
  ofs += wt * am * (nrm * side * 0.03 + tg * (h.z > 0.5 ? 0.03 : -0.03) + vec2(-rel.y, rel.x) * 0.06 * (h2.x - 0.5) - rel * 0.06)
       + nrm * rib * mu * 0.004 * am;
  return wt * (0.75 + 0.25 * rib) + 0.25 * rib * mu * fall;
}
// Uno sciame di bolle attorno a un centro (q è già relativo al centro, R = raggio dello sciame):
// ogni bolla è una piccola lente con un orlo scuro sottile dal lato in ombra, nessun corpo chiaro.
// Fuori dallo sciame non c'è niente. Restituisce (orlo, dentro).
vec2 ghSwarm(vec2 q, float cs, float R, float T, float sd, vec2 Lr, float prob, inout vec2 ofs) {
  vec2 id = floor(q / cs);
  vec3 n = hash33(vec3(id, S(sd)));
  vec2 hn = hash22(id + S(sd + 1.0));
  // strisciano piano
  vec2 c = (id + 0.5 + (n.xy - 0.5) * 0.28 + 0.03 * vec2(sin(TAU * (T + hn.x)), cos(TAU * (T + hn.y)))) * cs;
  float dc = length(c) / R;
  if (dc > 1.15 || n.z > prob * exp(-dc * dc * 2.2)) return vec2(0.0);
  // tonde e ovali, qualcuna allungata
  float el = hn.x > 0.72 ? 1.5 + 1.2 * hn.y : 1.0 + 0.35 * hn.y;
  float ry = cs * (0.12 + 0.22 * hn.y * (1.2 - dc));
  float r = ry / el;
  vec2 dd = (q - c) / vec2(r, ry);
  float g = 1.0 - dot(dd, dd);
  if (g <= 0.0) return vec2(0.0);
  ofs += -(q - c) * smoothstep(0.0, 0.5, g) * 0.6;
  float side = 0.5 - 0.5 * dot(dd, Lr) / max(length(dd), 1e-3);
  float rim = smoothstep(0.0, 0.14, g) * (1.0 - smoothstep(0.16, 0.55, g)) * (0.4 + 0.6 * side);
  return vec2(rim, smoothstep(0.0, 0.15, g));
}
// Superficie: ondulazioni di fusione, conche a scodella, velo d'acqua con i fronti che scendono.
// chn = quanto il punto è in un canale d'acqua (calcolato una volta sola). cup: 1 in fondo alla conca.
float ghSurf(vec2 p, float z, float Pz, float T, float chn, out float cup, out float wat) {
  float n1 = gnoise(vec3(p * 1.7, z), Pz);
  float n2 = sin(p.x * 7.1 + 3.0 * n1 + 1.7) * sin(p.y * 6.3 - 2.0 * n1 + TAU * T);
  vec2 wq = p * 5.0 + vec2(n1, n2 * 0.5) * 0.9;
  // 3x3 celle: con meno, ai bordi delle celle restano gradini dritti nel rilievo
  vec2 wi = floor(wq) - 1.0;
  float d1 = 0.0;
  for (int k = 0; k < 9; k++) {
    vec2 id = wi + vec2(float(k - (k / 3) * 3), float(k / 3));
    vec2 cc = id + 0.5 + (hash22(id + S(55.0)) - 0.5) * 0.6 + 0.1 * sin(TAU * T + id.yx * 2.3);
    vec2 dv = wq - cc;
    d1 += exp(-14.0 * dot(dv, dv));
  }
  d1 = -log(d1 + 1e-5) / 14.0;
  cup = 1.0 - clamp(d1 * 1.6, 0.0, 1.0);
  float wv = 0.5 + 0.5 * sin(p.y * 26.0 + TAU * 3.0 * T + 5.0 * n1 + 2.0 * n2 + 2.0 * sin(p.x * 7.0));
  wv *= wv;
  wat = chn * fusione * (0.4 + 0.6 * wv);
  return n1 * 0.05 + n2 * 0.007 - cup * 0.034 * (1.0 - 0.7 * chn * fusione) + wat * 0.02;
}
vec3 fx(vec2 uv) {
  vec2 a = vec2(ASPECT, 1.0);
  vec2 p = uv * a;
  float m = materia;
  float T = ztime(0.12), z = T, Pz = period(0.12);
  float sp = spessore * m;
  float w1 = TAU * T;
  // ---- superficie: tre prese della stessa altezza per pendenza e cavità
  // rivoli d'acqua: uno o due fili che serpeggiano giù tra le conche, larghezza irregolare, bordi morbidi
  float mw = gnoise(vec3(p * vec2(1.3, 0.8) + 4.0, z * 0.5 + 9.0), Pz);
  float mx = p.x + 0.16 * mw + 0.035 * sin(p.y * 9.0 + 3.0 * mw) + 0.015 * sin(p.y * 23.0 + p.x * 5.0);
  // (fuori dai nodi del reticolo del rumore, che lì vale zero e darebbe rivoli dritti)
  float rv = gnoise(vec3(mx * 0.8 + 0.37, p.y * 0.7 + 0.21, 13.37), 0.0) + 0.4 * gnoise(vec3(p * vec2(2.1, 1.3) + 5.53, 7.71), 0.0);
  float wid = (0.025 + 0.06 * fusione) * (0.45 + 0.9 * (0.5 + 0.5 * sin(p.y * 4.3 + mw * 3.0)));
  float chn = (1.0 - smoothstep(wid * 0.2, wid * 1.3, abs(rv))) * smoothstep(-0.3, 0.2, gnoise(vec3(p * 0.9 + 3.3, 21.7), 0.0) + 0.1);
  float e = 2.0 / 1080.0;
  float cup, wat, t1, t2;
  float h0 = ghSurf(p, z, Pz, T, chn, cup, wat);
  vec2 g = vec2(ghSurf(p + vec2(e, 0.0), z, Pz, T, chn, t1, t2) - h0, ghSurf(p + vec2(0.0, e), z, Pz, T, chn, t1, t2) - h0) / e;
  float la = luce * TAU;
  vec2 L = vec2(cos(la), sin(la));
  // ---- parallasse: la deriva lenta del blocco e la rifrazione della superficie
  vec2 cam = deriva * 0.05 * sp * vec2(sin(w1) + 0.4 * sin(2.0 * w1 + 1.3), 0.6 * cos(w1) + 0.3 * sin(2.0 * w1 + 0.4));
  vec2 sh = cam - g * 0.09 * sp;
  // ---- sciami di bolle: da 2 a 4, il seme decide dove; attorno a loro il ghiaccio è torbido
  vec2 bo = vec2(0.0);
  vec2 bS = vec2(0.0), bD = vec2(0.0);       // sciami vicini alla superficie, sciami profondi
  float coreA = 0.0, coreB = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec3 hc = hash33(vec3(fi * 5.3 + 0.7, S(61.0), 4.1));
    float on = smoothstep(fi * 0.22 - 0.2, fi * 0.22 - 0.05, bolle);
    bool deep = (i == 1 || i == 3);
    float dp = deep ? 0.62 : 0.18;
    vec2 ctr = vec2((0.14 + 0.72 * fract(hc.x + fi * 0.37)) * ASPECT, 0.16 + 0.68 * hc.y);
    float Rc = 0.13 + 0.08 * hc.z;
    // il velo torbido attorno allo sciame sta a un'altra profondità: scorre contro di lui
    vec2 dv = p + sh * (deep ? 0.85 : 0.3) - ctr;
    float bump = exp(-dot(dv, dv) / (Rc * Rc * 3.2)) * on;
    if (deep) coreB += bump; else coreA += bump;
    vec2 q = p + sh * dp - ctr;
    if (on <= 0.0 || dot(q, q) > Rc * Rc * 1.7) continue;
    float ang = hc.z * 5.0;
    mat2 Rm = rot(ang);
    vec2 lo = vec2(0.0);
    vec2 ql = Rm * q;
    float k = deep ? 0.75 : 1.0;
    vec2 b = ghSwarm(ql, 0.046 * k, Rc, T, 62.0 + fi, Rm * L, 0.85, lo);
    b = max(b, ghSwarm(ql + 0.37, 0.016 * k, Rc * 1.2, T, 66.0 + fi, Rm * L, 0.5, lo) * 0.8);
    bo += rot(-ang) * lo * on;
    if (deep) bD = max(bD, b * on * 0.75); else bS = max(bS, b * on);
  }
  // ---- due veli torbidi a profondità diverse, locali; altrove il ghiaccio è limpido
  vec2 qA = p + sh * 0.3, qB = p + sh * 0.85;
  float vA = fbm(rot(0.5) * qA * vec2(1.3, 2.0) + 2.0, z, Pz, 2);
  float vB = fbm(rot(-0.35) * qB * vec2(2.2, 1.3) + 9.0, z + 4.0, Pz, 2);
  float breath = sin(w1 + 2.0 * vB);
  float lt = latte * m;
  float thr = mix(0.85, 0.05, lt) - 0.06 * breath;
  // ---- piani di frattura (pochi, grandi) a tre profondità
  vec2 ofs = vec2(0.0), o1 = vec2(0.0), o2 = vec2(0.0);
  float k0 = smoothstep(0.0, 0.15, fratture), k1 = smoothstep(0.25, 0.4, fratture), k2 = smoothstep(0.7, 0.85, fratture);
  float f0 = ghFrac(p + sh * 0.4, 0.0, T, ofs) * k0;
  float f1 = ghFrac(p + sh * 0.7, 1.0, T, o1) * k1;
  float f2 = ghFrac(p + sh * 0.55, 2.0, T, o2) * k2;
  ofs = (ofs * k0 + o1 * k1 + o2 * k2) * m;
  ofs += bo * m;
  // ---- la foto in fondo: rifratta dallo spessore, nitida nel limpido, sfocata nel torbido
  float zoom = 1.0 - 0.1 * sp * deriva;
  vec2 uq = 0.5 + (uv - 0.5) * zoom + (sh + ofs) / a;
  float l0 = luma(IN(uq));
  float on = smoothstep(0.0, 0.2, lt);
  float aA = smoothstep(thr, thr + 0.4, vA * 0.75 + coreA * 0.85 + (l0 - 0.5) * 0.1) * on;
  float aB = smoothstep(thr, thr + 0.4, vB * 0.75 + coreB * 0.85 + (l0 - 0.5) * 0.14) * on;
  float band = sin(dot(qB, vec2(0.35, 0.94)) * 38.0 + 6.0 * vB + 2.0 * sin(qB.x * 5.0));
  aB *= 0.88 + 0.12 * band;
  float fs = max(f0, max(f1, f2));
  float Rb = sp * (1.2 + 15.0 * max(aA, aB) + 5.0 * fs) * K1080;
  vec3 c = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float fi = float(i) + 0.5;
    float an = fi * 2.39996;
    c += IN(uq + vec2(cos(an), sin(an)) * sqrt(fi / 8.0) * Rb * PX);
  }
  c /= 8.0;
  // lo spessore: il ghiaccio limpido assorbe e raffredda appena, senza togliere i colori
  c = mix(c, vec3(luma(c)), 0.12 * sp) * mix(vec3(1.0), vec3(0.8, 0.89, 0.95), sp);
  vec3 milkC = vec3(0.36, 0.395, 0.425);
  // ---- composizione dal fondo alla superficie
  float bk = bolle > 0.0 ? m : 0.0;
  // oltre il piano di frattura: appena più pallido e più freddo
  c = mix(c, c * vec3(0.74, 0.8, 0.86) + milkC * 0.42, 0.42 * fs * m);
  float dB = step(0.93, hash12(floor(qB * 1080.0 / 4.0) + S(71.0)));
  float dA = step(0.95, hash12(floor(qA * 1080.0 / 5.0) + S(72.0)));
  c = mix(c, mix(vec3(luma(c)), c, 0.55) * 0.5 + milkC, aB * 0.7);
  c = mix(c, c * 0.6 + milkC * 0.75, 0.15 * dB * aB);
  c *= 1.0 - (0.5 * bD.x + 0.1 * bD.y) * bk;
  c = mix(c, mix(vec3(luma(c)), c, 0.6) * 0.52 + milkC, aA * 0.62);
  c += 0.02 * dA * aA;
  c *= 1.0 - (0.62 * bS.x + 0.12 * bS.y) * bk;
  // ---- la superficie: pelle asciutta di brina fine, velo d'acqua liscio e limpido
  float dry = (1.0 - smoothstep(0.0, 0.2, wat)) * m;
  float df = clamp(dot(g, L) * 1.6, -1.0, 1.0);
  // grana della pelle: fossette minuscole prese di taglio dalla luce
  vec2 gc = p * 1080.0 / 3.0;
  float emb = hash12(floor(gc) + S(73.0)) - hash12(floor(gc + L * 0.9) + S(73.0));
  // la pelle opaca prende la luce radente da sé: il rilievo si legge anche sul buio
  float skin = (0.2 + 0.1 * emb) * dry * (0.4 + 0.6 * spessore);
  c = mix(c, milkC * (0.8 + 0.55 * df - 0.5 * cup * cup), skin);
  c *= 1.0 + 0.09 * emb * dry;
  c *= 1.0 - 0.06 * (1.0 - dry) * m;
  float shade = df > 0.0 ? 0.09 * df : 0.55 * df;
  // cavità: il fondo delle conche e il lato in ombra sotto le creste
  shade -= 0.34 * cup * cup * (1.0 - 0.5 * wat);
  shade -= 0.14 * smoothstep(0.1, 0.5, -df) * (1.0 - cup);
  c *= 1.0 + shade * m * (0.4 + 0.6 * spessore);
  return mix(IN(uv), c, smoothstep(0.0, 0.15, m));
}`,
};
