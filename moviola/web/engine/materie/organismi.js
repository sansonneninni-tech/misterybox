// Materie: organismi. Crescite, colonie, tessuti viventi.
import { P } from './comune.js';
import { MATERIA as LICHENE } from './crescite/lichene.js';

export const MATERIE = [
  // ───────────────────────────────────────────────────────────── Morfogenesi
  {
    id: 'morfogenesi', code: 'Mg', name: 'Morfogenesi', family: 'organismi', ref: 'Alan Turing, 1952',
    steps: 14, simLong: 512, noloop: true, forze: 'trasporto', peso: 0,
    about: 'La foto diventa pelle: due sostanze reagiscono sotto la superficie e la luminanza decide la forma, macchie nelle ombre, labirinti nei mezzitoni, coralli nelle luci; il disegno solleva e rifrange l’immagine senza coprirla.',
    params: [
      P('materia', 'Materia', 0, 1, 0.6, 0.2),
      P('scala', 'Scala', 0.6, 2.5, 0.9, 0.15),
      P('regime', 'Macchie → coralli', 0, 1, 0.45, 0.2),
      P('varieta', 'Guida della foto', 0, 1, 0.8, 0.2),
      P('rilievo', 'Rilievo', 0, 2, 1.0, 0.3),
      P('rifrazione', 'Rifrazione', 0, 1, 0.5, 0.4),
      P('colore', 'Pigmento', 0, 1, 0.5, 0.3),
      P('velocita', 'Velocità', 0.2, 1, 0.9, 0.2),
    ],
    sim: `
// percorso nello spazio (F, k) di Gray–Scott: macchie che si dividono, labirinti, coralli
vec2 mgFK(float s) {
  vec2 a = vec2(0.0367, 0.0649), b = vec2(0.0300, 0.0575), c = vec2(0.0545, 0.0620);
  return s < 0.5 ? mix(a, b, s * 2.0) : mix(b, c, s * 2.0 - 2.0 * 0.5);
}
vec4 sim(vec2 uv) {
  vec2 cell = floor(uv * u_stRes);
  float l = luma(IN(uv));
  if (u_init > 0.5) {
    // semi: lungo i contorni della foto e qualche granello sparso nelle zone piatte
    vec2 o = SPX * 2.0;
    float gx = luma(IN(uv + vec2(o.x, 0.0))) - luma(IN(uv - vec2(o.x, 0.0)));
    float gy = luma(IN(uv + vec2(0.0, o.y))) - luma(IN(uv - vec2(0.0, o.y)));
    float edge = smoothstep(0.08, 0.2, length(vec2(gx, gy)));
    vec2 blk = floor(cell / 4.0);
    float s1 = step(hash12(blk + S(1.0)), 0.35 * edge);
    float s2 = step(hash12(blk + S(2.0)), 0.1);
    float sd = max(s1, s2);
    return vec4(1.0 - 0.5 * sd, 0.25 * sd, 0.0, 1.0);
  }
  float kr = max(u_stRes.x, u_stRes.y) / 480.0;
  vec2 e = SPX * scala * kr;
  vec4 c = ST(uv);
  vec4 lap = -c
    + 0.2 * (ST(uv + vec2(e.x, 0.0)) + ST(uv - vec2(e.x, 0.0)) + ST(uv + vec2(0.0, e.y)) + ST(uv - vec2(0.0, e.y)))
    + 0.05 * (ST(uv + e) + ST(uv - e) + ST(uv + vec2(e.x, -e.y)) + ST(uv + vec2(-e.x, e.y)));
  // la luminanza sceglie il regime; una deriva lentissima tiene il disegno vivo
  float drift = 0.06 * sin(u_t * 0.35 + uv.x * 3.0 + S(3.0)) + 0.04 * sin(u_t * 0.23 - uv.y * 4.0);
  float s = clamp(regime + (l - 0.5) * 1.5 * varieta + drift, 0.0, 1.0);
  vec2 fk = mgFK(s);
  float a = c.x, b = c.y;
  float r = a * b * b;
  float dt = velocita;
  a += (1.0 * lap.x - r + fk.x * (1.0 - a)) * dt;
  b += (0.5 * lap.y + r - (fk.y + fk.x) * b) * dt;
  return vec4(clamp(a, 0.0, 1.0), clamp(b, 0.0, 1.0), 0.0, 1.0);
}`,
    glsl: `
float mgH(vec2 uv) { return smoothstep(0.05, 0.3, ST(uv).y); }
vec3 fx(vec2 uv) {
  vec2 e = SPX * 1.5;
  float h = mgH(uv);
  vec2 g = vec2(mgH(uv + vec2(e.x, 0.0)) - mgH(uv - vec2(e.x, 0.0)), mgH(uv + vec2(0.0, e.y)) - mgH(uv - vec2(0.0, e.y))) * 0.5;
  // il disegno lascia zone di foto pulita che vanno e vengono lentamente
  vec2 pm = (uv - 0.5) * vec2(ASPECT, 1.0) * 2.2;
  float vis = smoothstep(-0.12, 0.22, fbm(pm, u_t * 0.06, 0.0, 3) + (materia - 0.5) * 0.7);
  // nessun oggetto disegnato: la foto è vista attraverso una pelle goffrata dal disegno di Turing.
  // il pendio piega la foto (rilievo), lo spessore la sposta (rifrazione)
  vec2 sh = -g * rilievo * 0.05 + vec2(0.7, -0.5) * (h - 0.5) * rifrazione * 0.012;
  vec2 q = uv + sh * vis * vec2(1.0 / ASPECT, 1.0);
  vec3 img = IN(q);
  // dentro il disegno il colore della foto si addensa appena (moltiplica, al massimo ~15%)
  // sulla nebbia liscia quasi niente: il velo si vede solo dove la foto ha dettaglio
  vec2 o4 = PX * 4.0 * K1080;
  float det = abs(luma(IN(uv + vec2(o4.x, 0.0))) - luma(IN(uv - vec2(o4.x, 0.0)))) + abs(luma(IN(uv + vec2(0.0, o4.y))) - luma(IN(uv - vec2(0.0, o4.y))));
  float dark = h * vis * 0.15 * colore * smoothstep(0.02, 0.12, det);
  return mix(IN(uv), img * (1.0 - dark), clamp(materia * 1.5, 0.0, 1.0));
}`,
  },

  // ───────────────────────────────────────────────────────────── Micelio
  {
    id: 'micelio', code: 'Mc', name: 'Micelio', family: 'organismi', ref: 'ife fungine, colonie su agar',
    steps: 8, simLong: 640, noloop: true,
    about: 'Da poche spore il micelio si allarga sulla foto preferendo le zone chiare: ife sottili seguono le vie della crescita, si ramificano e si infittiscono in feltro; l’immagine resta sotto, colonizzata, e i filamenti ne prendono il colore sbiancato.',
    params: [
      P('crescita', 'Crescita', 0.1, 1, 0.45, 0.2),
      P('rami', 'Ramificazione', 0, 1, 0.55, 0.3),
      P('spore', 'Spore', 0.05, 1, 0.35, 0),
      P('tropismo', 'Attrazione per la luce', 0, 1, 0.7, 0.3),
      P('spessore', 'Spessore', 0.5, 3, 1.2, 0.2),
      P('colonia', 'Feltro', 0, 1, 0.5, 0.3),
      P('sbianca', 'Sbiancamento', 0, 1, 0.7, 0.2),
      P('rilievo', 'Rilievo', 0, 1, 0.5, 0.2),
    ],
    // stato: r = istante di arrivo + 1, gb = punto della spora da cui viene, a = colonizzato
    sim: `
const vec2 MC_O[8] = vec2[8](vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0),
                             vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0));
vec4 sim(vec2 uv) {
  vec2 cell = floor(uv * u_stRes);
  if (u_init > 0.5) {
    // una spora candidata per riquadro; germina più volentieri nella luce
    vec2 nb = vec2(7.0, 4.0);
    vec2 bc = floor(uv * nb);
    vec2 cand = (bc + 0.15 + 0.7 * hash22(bc + S(3.0))) / nb;
    float lc = luma(IN(cand));
    if (floor(cand * u_stRes) == cell && hash12(bc + S(4.0)) < spore * (0.25 + 1.2 * lc)) return vec4(1.0, uv, 1.0);
    return vec4(0.0);
  }
  vec4 c = ST(uv);
  if (c.a > 0.5) return c;
  vec2 org = vec2(0.0); float cnt = 0.0;
  for (int j = 0; j < 8; j++) {
    vec4 nb = ST(uv + MC_O[j] * SPX);
    if (nb.a > 0.5) { cnt += 1.0; org = nb.gb; }
  }
  if (cnt < 0.5) return c;
  float l = luma(IN(uv));
  float kres = max(u_stRes.x, u_stRes.y) / 640.0;
  // il fronte avanza più in fretta verso la luce, a strappi
  float sp = crescita * 0.7 * kres * mix(1.0, 0.08 + 1.5 * l * l, tropismo) * (0.15 + 0.1 * cnt);
  float nz = fbm(uv * 9.0, u_t * 0.3, 0.0, 2);
  sp *= 0.6 + 0.8 * smoothstep(-0.3, 0.3, nz);
  if (hash13(vec3(cell, u_frame * 16.0 + u_step) + S(5.0)) > sp) return c;
  return vec4(u_t + 1.0, org, 1.0);
}`,
    glsl: `
// ife: linee radiali dalla spora, che serpeggiano e si moltiplicano allontanandosi
float mcLine(vec2 v, float N, float wpx, float zz) {
  float rr = length(v);
  vec2 dv = v / max(rr, 1e-3);
  float lr = log(rr + 8.0);
  vec2 q = dv * N + vec2(gnoise(vec3(dv * 2.0, lr * 1.5 + zz), 0.0), gnoise(vec3(dv * 2.0 + 5.0, lr * 1.5 + zz), 0.0)) * 1.3;
  float f = gnoise(vec3(q, lr * 1.2 + zz), 0.0);
  float fw = max(fwidth(f), 1e-5);
  float hw = 0.5 * wpx * K1080;
  // larghezza costante in pixel; sotto il pixel la linea si schiarisce invece di sfarfallare
  return (1.0 - smoothstep(hw, hw + 1.0, abs(f) / fw)) * min(1.0, hw + 0.35);
}
vec3 fx(vec2 uv) {
  vec3 img = IN(uv);
  float l = luma(img);
  vec4 s = ST(uv);
  float cov = smoothstep(0.1, 0.9, s.a);
  float age = s.a > 0.01 ? u_t + 1.0 - s.r / s.a : 0.0;
  vec2 org = s.a > 0.01 ? s.gb / s.a : uv;
  vec2 v = (uv - org) * vec2(ASPECT, 1.0) * 1080.0;
  float wp = 3.0 * spessore;
  float l1 = mcLine(v, 9.0, wp, 1.0);
  float l2 = mcLine(v, 23.0, wp * 0.75, 7.0) * smoothstep(0.1, 1.2, age) * rami;
  float l3 = mcLine(v, 55.0, wp * 0.55, 13.0) * smoothstep(0.6, 2.5, age) * rami;
  float hy = max(l1, max(l2 * 0.85, l3 * 0.7)) * cov;
  // ombra morbida: le ife stanno sopra la foto
  vec2 so = vec2(2.0, -2.0) * (0.5 + 2.0 * rilievo);
  float sh = mcLine(v + so, 9.0, wp, 1.0) * cov * (1.0 - hy);
  float felt = smoothstep(0.5, 4.0, age) * cov * colonia;
  vec3 fcol = mix(img, vec3(l) * 0.85 + 0.14 + img * 0.08, 0.6);
  vec3 base = mix(img, fcol, felt);
  base *= 1.0 - 0.3 * rilievo * sh;
  vec3 hcol = mix(img, mix(vec3(l), img, 0.35) * 0.5 + vec3(0.44, 0.43, 0.40), sbianca);
  return mix(base, hcol, hy);
}`,
  },

  // ───────────────────────────────────────────────────────────── Lichene
  // (un file suo: crescite/lichene.js)
  LICHENE,

  // ───────────────────────────────────────────────────────────── Cellule
  {
    id: 'cellule', code: 'Cl', name: 'Cellule', family: 'organismi', ref: 'tessuti al microscopio',
    about: 'La foto diventa un tessuto vivo: ogni cellula è una piccola lente che ingrandisce il suo pezzo d’immagine, le membrane sono morbide, i nuclei appena accennati; le cellule respirano, si spingono e ogni tanto si dividono.',
    params: [
      P('dimensione', 'Dimensione', 24, 200, 95, 0.15),
      P('lente', 'Lente', 0, 1, 0.6, 0.4),
      P('membrana', 'Membrana', 0, 1, 0.45, 0.3),
      P('respiro', 'Respiro', 0, 1, 0.5, 0.3),
      P('divisione', 'Divisione', 0, 1, 0.5, 0.2),
      P('nuclei', 'Nuclei', 0, 1, 0.35, 0.3),
      P('velocita', 'Velocità', 0, 2, 1.0, 0.2),
      P('rilievo', 'Rilievo', 0, 2, 0.25, 0.3),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  vec2 asp = vec2(ASPECT, 1.0);
  float N = 1080.0 / dimensione;
  vec2 p = (uv - 0.5) * asp * N;
  vec2 ip = floor(p);
  float d1 = 1e9, d2o = 1e9, dsis = 1e9, ssum = 0.0;
  const float KS = 0.07;
  vec2 c1 = vec2(0.0), nuc1 = vec2(0.0);
  float id1 = -1.0, sm1 = 0.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 id = ip + vec2(float(i), float(j));
    vec3 h = hash33(vec3(id, S(21.0)));
    vec3 h2 = hash33(vec3(id, S(22.0)));
    float r1 = rate(velocita * (0.15 + 0.2 * h.z)), r2 = rate(velocita * (0.12 + 0.2 * h2.x));
    vec2 c = id + 0.5 + 0.55 * (h.xy - 0.5)
      + 0.24 * vec2(sin(TAU * (r1 * u_t + h.x)), cos(TAU * (r2 * u_t + h.y)));
    // divisione: due figlie si separano lungo un asse e poi tornano a fondersi
    float ph = fract(rate(velocita * 0.09 * (0.7 + 0.6 * h2.y)) * u_t + h2.z);
    float prog = (smoothstep(0.05, 0.55, ph) - smoothstep(0.88, 1.0, ph)) * step(h2.x, divisione);
    float ax = h.z * TAU + 0.3 * sin(TAU * (r1 * u_t));
    vec2 sep = vec2(cos(ax), sin(ax)) * prog * 0.24;
    float w = respiro * 0.16 * sin(TAU * (rate(velocita * (0.2 + 0.25 * h2.y)) * u_t + h.y));
    float sm = smoothstep(0.25, 0.7, prog);
    for (int k = 0; k < 2; k++) {
      vec2 ck = k == 0 ? c + sep : c - sep;
      float d = length(p - ck) - w;
      float key = id.x * 7.0 + id.y * 131.0;
      ssum += exp(-d / KS);
      if (d < d1) {
        if (key == id1) dsis = d1; else d2o = d1;
        d1 = d; c1 = ck; id1 = key; sm1 = sm;
        nuc1 = ck + 0.12 * vec2(sin(TAU * (r2 * u_t) + h.x * 6.0), cos(TAU * (r1 * u_t) + h.y * 6.0));
      } else if (key == id1) { dsis = min(dsis, d); }
      else d2o = min(d2o, d);
    }
  }
  // distanza dalla membrana, in pixel da 1080
  // minimo morbido verso tutte le altre cellule: angoli arrotondati
  float rest = ssum - exp(-d1 / KS) - exp(-dsis / KS) * (1.0 - sm1);
  float d2s = -KS * log(max(rest, 1e-30));
  float ed = max((min(d2s, d2o) - d1) * 0.5 * dimensione, 0.0);
  float mw = 1.0 + 4.0 * membrana;
  float mem = 1.0 - smoothstep(0.0, mw, ed);
  // ogni cellula è una lente: ingrandisce attorno al suo centro
  float dome = sqrt(smoothstep(0.0, dimensione * 0.45, ed));
  vec2 cuv = c1 / N / asp + 0.5;
  vec2 q = cuv + (uv - cuv) * (1.0 - lente * 0.6 * dome);
  float nd = length(p - nuc1) * dimensione;
  float nuc = (1.0 - smoothstep(dimensione * 0.09, dimensione * 0.15, nd)) * nuclei;
  q = mix(q, cuv + (q - cuv) * 0.8, nuc);
  vec3 img = IN(q);
  // rilievo morbido della cupola
  float hgt = smoothstep(0.0, dimensione * 0.3, ed);
  vec2 sl = vec2(dFdx(hgt), dFdy(hgt)) * K1080 * 14.0;
  vec3 n = normalize(vec3(-sl * rilievo, 1.0));
  vec3 L = normalize(vec3(-0.45, 0.55, 0.7));
  float shade = mix(1.0, clamp(dot(n, L) / L.z, 0.4, 1.4), 0.5);
  vec3 c = img * shade;
  c = mix(c, c * vec3(0.86, 0.82, 0.8) * 0.85, nuc * 0.8);
  // membrana: doppia linea traslucida, il colore resta della foto
  // la membrana piega la foto come il bordo di una goccia, appena più scura
  vec3 mcol = IN(uv + (q - uv) * 1.6) * 0.72;
  float inner = smoothstep(mw, mw * 2.0, ed) * (1.0 - smoothstep(mw * 2.0, mw * 4.0, ed));
  return mix(c, mcol, mem * (0.3 + 0.6 * membrana));
}`,
  },

  // ───────────────────────────────────────────────────────────── Vene
  {
    id: 'vene', code: 'Vn', name: 'Vene', family: 'organismi', ref: 'tavole anatomiche, reti linfatiche',
    about: 'I contorni della foto diventano vasi che si ramificano sotto la pelle dell’immagine; un battito lento li gonfia e il fluido scorre lungo i canali, mentre la foto resta la carne in cui passano.',
    params: [
      P('materia', 'Materia', 0, 1, 0.85, 0.2),
      P('densita', 'Densità della rete', 0.6, 5, 1.7, 0.15),
      P('bordi', 'Guida dei contorni', 0, 1, 0.25, 0.2),
      P('spessore', 'Spessore', 2, 20, 9, 0.3),
      P('capillari', 'Capillari', 0, 1, 0.45, 0.3),
      P('battito', 'Battito', 0, 2, 0.6, 0.2),
      P('flusso', 'Flusso', 0, 2, 0.5, 0.3),
      P('tinta', 'Tinta', 0, 1, 0.0, 0.1),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  vec2 asp = vec2(ASPECT, 1.0);
  vec2 p = (uv - 0.5) * asp * densita;
  float z = ztime(0.08), Pz = period(0.08);
  vec2 w = vec2(fbm(p * 0.55, z, Pz, 2), fbm(p * 0.55 + 7.3, z + 3.0, Pz, 2));
  vec2 qn = p + w * 0.9;
  vec3 img = IN(uv);
  float lc = luma(img);
  // contorni larghi della foto (differenza di sfocature), non la grana fine
  vec2 r1 = vec2(7.0 * K1080) * PX, r2 = vec2(22.0 * K1080) * PX;
  vec3 blur = (IN(uv + vec2(r1.x, 0.0)) + IN(uv - vec2(r1.x, 0.0)) + IN(uv + vec2(0.0, r1.y)) + IN(uv - vec2(0.0, r1.y))) * 0.25;
  vec3 wide = (IN(uv + r2) + IN(uv - r2) + IN(uv + vec2(r2.x, -r2.y)) + IN(uv - vec2(r2.x, -r2.y))) * 0.25;
  float e = (luma(blur) * 0.6 + lc * 0.4 - luma(wide)) * 4.0;
  float zn = ztime(0.04), Pn = period(0.04);
  float n1 = fbm(qn, zn, Pn, 4);
  float f = n1 + e * bordi;
  vec2 gf = vec2(dFdx(f), dFdy(f)) * K1080;
  float gl = length(gf) + 1e-5;
  float dist = abs(f) / gl;
  vec2 gd = gf / gl;
  // battito: un’onda attraversa la rete
  float wave = 0.5 + 0.5 * sin(TAU * (ztime(battito * 0.5) - 1.2 * fbm(p * 0.25 + 2.0, 0.0, 0.0, 2)));
  float pulse = pow(wave, 3.0);
  float W = spessore * (1.0 + 0.35 * pulse * step(0.001, battito));
  // capillari: nascono vicino ai vasi
  float f2 = fbm(qn * 2.6 + 11.0, z, Pz, 3);
  vec2 g2 = vec2(dFdx(f2), dFdy(f2)) * K1080;
  float gl2 = length(g2) + 1e-5;
  float dist2 = abs(f2) / gl2;
  float W2 = W * 0.38;
  float gate = smoothstep(W * 9.0, W * 1.5, dist) * capillari;
  float t1 = clamp(1.0 - dist / W, 0.0, 1.0);
  float t2 = clamp(1.0 - dist2 / W2, 0.0, 1.0) * gate;
  float prof = sqrt(1.0 - (1.0 - t1) * (1.0 - t1)) * step(0.0001, t1);
  float prof2 = sqrt(1.0 - (1.0 - t2) * (1.0 - t2)) * step(0.0001, t2);
  float tube = max(prof, prof2 * 0.8);
  vec2 nrm = (prof >= prof2 * 0.8 ? sign(f) * gd * (1.0 - t1) : sign(f2) * g2 / gl2 * (1.0 - t2));
  // la carne si scosta al passaggio dell’onda; dentro il vaso la foto è vista attraverso un tubo
  vec2 push = sign(f) * gd * PX * K1080 * 2.5 * pulse * smoothstep(W * 4.0, W, dist) * materia;
  vec2 q = uv - push - nrm * tube * W * PX * K1080 * 0.8;
  vec3 flesh = IN(q);
  flesh = mix(flesh, blur, 0.25 * materia);
  // flusso lungo il vaso
  vec2 tg = vec2(-gd.y, gd.x) * sign(f);
  float along = dot((uv - 0.5) * asp * u_res.y / K1080, tg) / (W * 3.0);
  float stream = 0.5 + 0.5 * sin(along * 1.3 - TAU * ztime(flusso * 0.6) + n1 * 4.0);
  vec3 tint = pigment(0.02 + 0.12 * lc, tinta);
  tint = mix(vec3(luma(tint)), tint, 0.55);
  vec3 vcol = flesh * mix(vec3(1.0), tint * 1.3, 0.5) * (0.42 + 0.2 * tube + 0.14 * stream * step(0.001, flusso) - 0.1 * pulse);
  vec3 L = normalize(vec3(-0.45, 0.55, 0.7));
  float shade = 1.0 + 0.22 * dot(nrm, L.xy) * tube;
  // sotto pelle: il vaso sfuma nella carne, più scuro al centro
  float vm = tube * tube * (3.0 - 2.0 * tube);
  // un’ombra larga attorno al vaso: è sotto la pelle, non disegnato sopra
  float halo = (1.0 - smoothstep(W, W * 3.5, dist)) * 0.18;
  flesh *= 1.0 - halo * materia;
  vec3 c = mix(flesh, vcol * shade, vm * materia);
  return c;
}`,
  },

  // ───────────────────────────────────────────────────────────── Stormo
  {
    id: 'stormo', code: 'St', name: 'Stormo', family: 'organismi', ref: 'storni sul Tevere, banchi di sardine',
    feedback: true, noloop: true, forze: 'trasporto', peso: 0,
    about: 'La foto si scompone in migliaia di particelle che volano insieme come uno stormo: onde di densità le attraversano, i vortici le piegano, ognuna porta il colore dell’immagine; quando lo stormo si compatta la foto si ricompone.',
    params: [
      P('dispersione', 'Dispersione', 0, 1, 0.6, 0.3),
      P('grana', 'Grana dello stormo', 5, 30, 13, 0),
      P('onde', 'Onde di densità', 0, 1, 0.6, 0.3),
      P('vortici', 'Vortici', 0, 1, 0.5, 0.3),
      P('velocita', 'Velocità', 0, 2, 0.6, 0.2),
      P('ricompone', 'Ricomposizione', 0, 1, 0.5, 0.2),
      P('origine', 'Colore d’origine', 0, 1, 0.3, 0.2),
      P('scia', 'Scia', 0, 1, 0.45, 0.2),
    ],
    glsl: `
vec2 stD(vec2 h, float z, float Pz, float tw) {
  vec2 hp = h * 0.03;
  float e = 0.06;
  float n0 = gnoise(vec3(hp, z), Pz);
  float nx = gnoise(vec3(hp + vec2(e, 0.0), z), Pz);
  float ny = gnoise(vec3(hp + vec2(0.0, e), z), Pz);
  vec2 curl = vec2(ny - n0, -(nx - n0)) / e;
  vec2 a1 = vec2(0.91, 0.41), a2 = vec2(-0.33, 0.94);
  float w1 = sin(dot(h, a1) * 0.15 - TAU * tw + n0 * 2.5);
  float w2 = sin(dot(h, a2) * 0.1 - TAU * tw + 1.3 + n0 * 1.5);
  return vortici * 5.0 * curl + onde * 7.0 * (a1 * w1 + 0.6 * a2 * w2);
}
vec3 blurS(vec2 uv) {
  vec2 o = PX * 9.0 * K1080;
  return (IN(uv + o) + IN(uv - o) + IN(uv + vec2(o.x, -o.y)) + IN(uv - vec2(o.x, -o.y))) * 0.25;
}
vec3 fx(vec2 uv) {
  vec2 asp = vec2(ASPECT, 1.0);
  float G = 1080.0 / grana;
  vec2 x = (uv - 0.5) * asp * G;
  float z = ztime(velocita * 0.12), Pz = period(velocita * 0.12);
  float tw = ztime(velocita * 0.35);
  // ampiezza: lo stormo si apre e si richiude, a zone
  float ze = ztime(velocita * 0.06), Pe = period(velocita * 0.06);
  float env = smoothstep(-0.35, 0.45, gnoise(vec3(x * 0.012 + 4.0, ze), Pe));
  float br = 0.5 + 0.5 * cos(TAU * ztime(velocita * 0.1));
  float A = dispersione * mix(1.0, smoothstep(0.1, 0.9, br), ricompone) * (0.25 + 0.75 * env) * 3.5;
  vec2 h = x - A * stD(x, z, Pz, tw);
  h = x - A * stD(h, z, Pz, tw);
  vec2 D0 = A * stD(h, z, Pz, tw);
  vec2 Dx = A * stD(h + vec2(1.0, 0.0), z, Pz, tw) - D0;
  vec2 Dy = A * stD(h + vec2(0.0, 1.0), z, Pz, tw) - D0;
  mat2 J = mat2(vec2(1.0, 0.0) + Dx, vec2(0.0, 1.0) + Dy);
  vec2 dir = normalize(D0 + vec2(1e-3, 0.0));
  float a = clamp(A / 3.5, 0.0, 1.0);
  float rr = mix(0.78, 0.22, smoothstep(0.05, 0.6, a));
  vec2 ih = floor(h);
  float best = 1e9; vec2 bv = vec2(0.0), bc = vec2(0.0);
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 id = ih + vec2(float(i), float(j));
    vec2 hh = hash22(id + S(31.0));
    vec2 c = id + 0.5 + (hh - 0.5) * 0.6
      + 0.12 * a * vec2(sin(TAU * (rate(velocita * (0.4 + hh.x)) * u_t + hh.y)), cos(TAU * (rate(velocita * (0.4 + hh.y)) * u_t + hh.x)));
    vec2 v = J * (c - h);
    vec2 vr = vec2(dot(v, dir), dot(v, vec2(-dir.y, dir.x)) * (1.0 + 0.9 * a));
    float d = length(vr);
    if (d < best) { best = d; bv = v; bc = c; }
  }
  float px1 = G / u_res.y;
  float al = 1.0 - smoothstep(rr - px1, rr + px1, best);
  vec2 puv = uv + bv / G / asp;
  vec2 huv = bc / G / asp + 0.5;
  vec3 pc = mix(IN(clamp(puv, 0.0, 1.0)), IN(clamp(huv, 0.0, 1.0)), origine);
  vec3 img = IN(uv);
  vec3 bg = mix(blurS(uv), vec3(luma(img)), 0.4) * 0.38;
  vec3 prev = FB(uv);
  vec3 base = u_frame < 0.5 ? bg : mix(bg, prev, scia * 0.92);
  return mix(base, pc, al);
}`,
  },
];
