// I processi di MOVIOLA. Tutti locali, tutti gratuiti, tutti in GLSL.
// Ogni processo: codice di due lettere, nome, famiglia, parametri (max 8),
// e il corpo GLSL di `vec3 fx(vec2 uv)`. I nomi dei parametri diventano
// costanti nel GLSL (es. `scala`), lette da u_p[].
//
// flags:
//   gen       genera immagini da sé (non ha bisogno di una sorgente)
//   feedback  legge la propria uscita al fotogramma prima (FB)
//   history   legge gli ultimi fotogrammi in ingresso (HIST)
//   noloop    non può garantire un loop chiuso

export const FAMILIES = [
  { id: 'materica', label: 'Materica' },
  { id: 'geometrica', label: 'Geometrica' },
  { id: 'digitale', label: 'Glitch e dati' },
  { id: 'pellicola', label: 'Pellicola' },
  { id: 'luce', label: 'Luce' },
  { id: 'tempo', label: 'Tempo' },
  { id: 'colore', label: 'Colore e sorgenti' },
];

export const BLENDS = [
  { id: 'normale', label: 'Normale' },
  { id: 'schermo', label: 'Schermo' },
  { id: 'somma', label: 'Somma' },
  { id: 'moltiplica', label: 'Moltiplica' },
  { id: 'differenza', label: 'Differenza' },
  { id: 'sovrapponi', label: 'Sovrapponi' },
  { id: 'schiarisci', label: 'Schiarisci' },
  { id: 'scurisci', label: 'Scurisci' },
];

const P = (id, label, min, max, def, mod = 0.5, extra = {}) => ({ id, label, min, max, def, mod, ...extra });

export const PROCESSES = [
  // ------------------------------------------------------------------ materica
  {
    id: 'campo', code: 'Ca', name: 'Campo', family: 'materica', gen: true,
    about: 'Rumore con il dominio deformato su sé stesso: fumi, marmi, fluidi lenti.',
    params: [
      P('scala', 'Scala', 0.3, 10, 2.2, 0.3),
      P('torsione', 'Torsione', 0, 6, 2.4, 0.6),
      P('velocita', 'Velocità', 0, 2, 0.18, 0.2),
      P('contrasto', 'Contrasto', 0.2, 5, 1.6, 0.4),
      P('cromia', 'Cromia', 0, 1, 0.15, 0.3),
      P('tinta', 'Tinta', 0, 1, 0.08, 0.2),
      P('ottave', 'Ottave', 1, 6, 5, 0, { step: 1 }),
      P('soglia', 'Soglia', 0, 1, 0, 0.3),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(ASPECT, 1.0) * scala;
  int oc = int(ottave);
  float z = ztime(velocita), Pz = period(velocita);
  vec2 q = vec2(fbm(p, z, Pz, oc), fbm(p + vec2(5.2, 1.3), z, Pz, oc));
  vec2 r = vec2(fbm(p + torsione * q + vec2(1.7, 9.2), z, Pz, oc), fbm(p + torsione * q + vec2(8.3, 2.8), z, Pz, oc));
  float f = fbm(p + torsione * r, z, Pz, oc);
  float v = clamp(0.5 + f * contrasto, 0.0, 1.0);
  if (soglia > 0.001) v = mix(v, smoothstep(0.5 - 0.02, 0.5 + 0.02, v), soglia);
  vec3 col = mix(vec3(v), pigment(v * 0.8 + length(q) * 0.3, tinta) * (0.25 + v), cromia);
  return col;
}`,
  },
  {
    id: 'rifrazione', code: 'Ri', name: 'Rifrazione', family: 'materica',
    about: 'Il flusso visto attraverso un vetro liquido che si muove.',
    params: [
      P('forza', 'Forza', 0, 0.3, 0.04, 0.6),
      P('scala', 'Scala', 0.3, 12, 3, 0.3),
      P('velocita', 'Velocità', 0, 2, 0.2, 0.2),
      P('aberrazione', 'Aberrazione', 0, 1, 0.25, 0.5),
      P('viscosita', 'Viscosità', 1, 6, 3, 0, { step: 1 }),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(ASPECT, 1.0) * scala;
  float z = ztime(velocita), Pz = period(velocita);
  int oc = int(viscosita);
  float e = 0.05;
  float n0 = fbm(p, z, Pz, oc);
  vec2 g = vec2(fbm(p + vec2(e, 0.0), z, Pz, oc) - n0, fbm(p + vec2(0.0, e), z, Pz, oc) - n0) / e;
  vec2 d = g * forza * 0.12;
  float ab = aberrazione * 0.35;
  return vec3(IN(uv + d * (1.0 + ab)).r, IN(uv + d).g, IN(uv + d * (1.0 - ab)).b);
}`,
  },
  {
    id: 'materia', code: 'Ma', name: 'Materia', family: 'materica',
    about: 'Grana, alone, tremolio del quadro e sfarfallio: il corpo della pellicola.',
    params: [
      P('grana', 'Grana', 0, 1, 0.35, 0.2),
      P('dimensione', 'Dim. grana', 1, 4, 1.6, 0),
      P('alone', 'Alone', 0, 1, 0.25, 0.3),
      P('tremolio', 'Tremolio', 0, 1, 0.25, 0.3),
      P('sfarfallio', 'Sfarfallio', 0, 1, 0.2, 0.5),
      P('vignetta', 'Vignetta', 0, 1, 0.35, 0.1),
      P('polvere', 'Polvere', 0, 1, 0.15, 0.3),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  float fr = u_frame;
  vec2 w = (hash22(vec2(fr, S(2.0))) - 0.5) * tremolio * 0.004;
  w.y += (hash11(floor(fr * 0.5) + S(3.0)) - 0.5) * tremolio * 0.003;
  vec2 q = uv + w;
  vec3 c = IN(q);
  // alone: le luci forti si allargano e scaldano, come nell'emulsione
  if (alone > 0.001) {
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785 + 0.3;
      vec2 o = vec2(cos(a), sin(a)) * PX * 9.0 * K1080;
      vec3 s = IN(q + o); s = max(s - 0.6, 0.0);
      acc += s;
      acc += max(IN(q + o * 2.2) - 0.6, 0.0) * 0.6;
    }
    c += acc / 12.8 * vec3(1.0, 0.45, 0.25) * alone * 2.5;
  }
  float fl = 1.0 + (hash11(fr + S(4.0)) - 0.5) * sfarfallio * 0.35;
  c *= fl;
  vec2 gp = floor(uv * u_res / (dimensione * K1080));
  float g = hash13(vec3(gp, fr + S(5.0))) + hash13(vec3(gp + 7.0, fr + S(6.0))) - 1.0;
  float l = luma(c);
  c += g * grana * 0.22 * (0.35 + 0.65 * (1.0 - abs(l - 0.45) * 1.6));
  vec2 dp = floor(uv * u_res / (3.0 * K1080));
  float d = step(1.0 - polvere * 0.0016, hash13(vec3(dp, floor(fr) + S(7.0))));
  c = mix(c, vec3(hash12(dp + fr) > 0.5 ? 0.0 : 0.95), d);
  vec2 v = uv - 0.5; v.x *= ASPECT;
  c *= 1.0 - vignetta * smoothstep(0.35, 1.05, length(v));
  return c;
}`,
  },
  // ---------------------------------------------------------------- geometrica
  {
    id: 'moire', code: 'Mo', name: 'Moiré', family: 'geometrica', gen: true,
    about: 'Due trame quasi uguali che si sovrappongono: interferenze, battimenti, op art.',
    params: [
      P('frequenza', 'Frequenza', 10, 400, 90, 0.2),
      P('scarto', 'Scarto', 0, 0.2, 0.03, 0.6),
      P('rotazione', 'Rotazione', 0, 1, 0.12, 0.5),
      P('anelli', 'Anelli', 0, 1, 0.0, 0.3),
      P('spessore', 'Spessore', 0.05, 0.95, 0.5, 0.3),
      P('deriva', 'Deriva centro', 0, 1, 0.2, 0.4),
      P('velocita', 'Velocità', 0, 2, 0.1, 0.2),
    ],
    glsl: `
float grating(vec2 p, float f, float th) {
  float x = p.x * f;
  float w = fwidth(x) + 1e-4;
  float d = abs(fract(x) - 0.5);
  return smoothstep(th * 0.5 + w, th * 0.5 - w, d);
}
float rings(vec2 p, float f, float th) {
  float x = length(p) * f;
  float w = fwidth(x) + 1e-4;
  float d = abs(fract(x) - 0.5);
  return smoothstep(th * 0.5 + w, th * 0.5 - w, d);
}
vec3 fx(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(ASPECT, 1.0);
  float ph = TAU * u_t * rate(velocita);
  vec2 c1 = vec2(cos(ph), sin(ph * 2.0)) * deriva * 0.25;
  vec2 c2 = vec2(sin(ph * 1.0 + 1.3), cos(ph)) * deriva * 0.25;
  float a = rotazione * 0.25 * sin(ph);
  float l1 = grating(rot(a) * p, frequenza, spessore);
  float l2 = grating(rot(-a + scarto) * p, frequenza * (1.0 + scarto), spessore);
  float r1 = rings(p - c1, frequenza, spessore);
  float r2 = rings(p - c2, frequenza * (1.0 + scarto), spessore);
  float v = mix(l1 * l2, r1 * r2, anelli);
  return vec3(v);
}`,
  },
  {
    id: 'celle', code: 'Ce', name: 'Celle', family: 'geometrica', gen: true,
    about: 'Celle di Voronoi che migrano; possono campionare il flusso come un mosaico vivo.',
    params: [
      P('scala', 'Scala', 2, 60, 9, 0.3),
      P('velocita', 'Velocità', 0, 2, 0.25, 0.3),
      P('bordo', 'Bordo', 0, 1, 0.4, 0.4),
      P('riempimento', 'Riempimento', 0, 1, 0.5, 0.4),
      P('campiona', 'Campiona flusso', 0, 1, 0, 0.2),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(ASPECT, 1.0) * scala;
  vec2 ip = floor(p), fp = fract(p);
  float d1 = 9.0, d2 = 9.0; vec2 best = vec2(0.0), bestc = vec2(0.0);
  float ph = TAU * u_t * rate(velocita);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 h = hash22(ip + g + S(8.0));
    vec2 o = 0.5 + 0.42 * sin(ph + TAU * h);
    vec2 r = g + o - fp;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; best = ip + g; bestc = (ip + g + o); }
    else if (d < d2) d2 = d;
  }
  float edge = sqrt(d2) - sqrt(d1);
  float e = smoothstep(0.0, 0.06 + (1.0 - bordo) * 0.25, edge);
  float fillv = hash12(best + S(9.0));
  vec3 cell = vec3(mix(1.0, fillv, riempimento));
  vec2 cuv = bestc / scala / vec2(ASPECT, 1.0) + 0.5;
  cell = mix(cell, IN(cuv), campiona);
  return cell * mix(1.0, e, bordo);
}`,
  },
  // ------------------------------------------------------------------ digitale
  {
    id: 'dati', code: 'Da', name: 'Dati', family: 'digitale', gen: true,
    about: 'Righe di codice binario che scorrono a velocità diverse; stroboscopio. Bianco e nero puro.',
    params: [
      P('righe', 'Righe', 4, 240, 48, 0.3),
      P('densita', 'Densità', 0, 1, 0.5, 0.5),
      P('velocita', 'Velocità', 0, 6, 1.2, 0.5),
      P('strobo', 'Stroboscopio', 0, 1, 0.08, 0.6),
      P('sorgente', 'Dalla sorgente', 0, 1, 0, 0.2),
      P('griglia', 'Griglia', 0, 1, 0.2, 0.3),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  float rowsN = floor(righe);
  float row = floor(uv.y * rowsN);
  float rh = hash11(row + S(10.0));
  float cols = floor(mix(16.0, 900.0, pow(rh, 2.0)) * (0.5 + griglia));
  float sp = (rh - 0.5) * velocita * 2.0;
  float x = uv.x + (u_loop > 0.5 ? u_t / u_T * floor(sp * u_T + 0.5) : u_t * sp);
  float cell = floor(x * cols);
  float kind = hash11(row * 1.37 + S(28.0) + floor(u_t * rate(velocita * 0.25)) * 3.1);
  float rowD = kind < 0.28 ? 0.0 : kind < 0.36 ? 1.0 : densita;   // righe vuote, piene, codice
  float bit = step(1.0 - rowD, hash12(vec2(mod(cell, cols * 4.0), row + S(11.0))));
  float src = luma(IN(uv));
  bit = mix(bit, step(hash12(vec2(cell, row)) * 0.8 + 0.1, src), sorgente);
  float gap = step(0.08, fract(uv.y * rowsN)) * mix(1.0, step(0.15, fract(x * cols)), griglia);
  float v = bit * gap;
  float sf = step(1.0 - strobo * 0.5, hash11(u_frame + S(12.0)));
  v = mix(v, 1.0 - v, sf);
  return vec3(v);
}`,
  },
  {
    id: 'glitch', code: 'Gl', name: 'Glitch', family: 'digitale', feedback: true, noloop: true,
    about: 'Strappi di righe, canali separati, quantizzazione e colature dei chiari.',
    params: [
      P('strappo', 'Strappo', 0, 1, 0.35, 0.6),
      P('canali', 'Canali', 0, 1, 0.3, 0.5),
      P('quantizza', 'Quantizza', 0, 1, 0, 0.4),
      P('colatura', 'Colatura', 0, 1, 0.2, 0.5),
      P('frequenza', 'Frequenza', 0, 1, 0.35, 0.5),
      P('blocchi', 'Blocchi', 0, 1, 0.3, 0.5),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  float fr = u_frame;
  float burst = step(1.0 - frequenza, hash11(floor(fr / 2.0) + S(13.0)));
  float band = floor(uv.y * mix(6.0, 80.0, hash11(fr + S(14.0))));
  float off = (hash11(band + fr * 1.7 + S(15.0)) - 0.5) * strappo * 0.25 * burst;
  off *= step(0.55, hash11(band * 3.1 + floor(fr / 3.0)));
  vec2 q = uv + vec2(off, 0.0);
  vec2 bq = floor(uv * vec2(ASPECT, 1.0) * 14.0);
  if (hash12(bq + floor(fr / 4.0) + S(16.0)) < blocchi * 0.12 * burst) q = fract(q + (hash22(bq + fr) - 0.5) * 0.3);
  float ca = canali * 0.02 * (0.3 + burst);
  vec3 c = vec3(IN(q + vec2(ca, 0.0)).r, IN(q).g, IN(q - vec2(ca, 0.0)).b);
  if (quantizza > 0.001) { float lv = mix(64.0, 3.0, quantizza); c = floor(c * lv + 0.5) / lv; }
  // colatura: i chiari del fotogramma prima scendono e restano
  vec3 prev = FB(uv + vec2(0.0, PX.y * 3.0 * K1080 * (0.5 + hash11(floor(uv.x * u_res.x / (2.0 * K1080)) + S(17.0)))));
  float lp = luma(prev);
  c = mix(c, max(c, prev * 0.985), colatura * smoothstep(0.45, 0.8, lp));
  return c;
}`,
  },
  {
    id: 'datamosh', code: 'Dm', name: 'Datamosh', family: 'digitale', feedback: true, history: 1, noloop: true,
    about: 'Come un video compresso senza fotogrammi chiave: i blocchi seguono il movimento e trascinano l’immagine vecchia.',
    params: [
      P('blocco', 'Blocco', 4, 64, 16, 0.2, { step: 1 }),
      P('forza', 'Forza', 0, 30, 8, 0.5),
      P('rinnovo', 'Rinnovo', 0, 1, 0.04, 0.6),
      P('persistenza', 'Persistenza', 0.5, 1, 0.96, 0.2),
      P('deriva', 'Deriva', 0, 1, 0.15, 0.5),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  vec2 bs = vec2(blocco * K1080) * PX;
  vec2 bc = (floor(uv / bs) + 0.5) * bs;
  // flusso normale stimato al centro del blocco: -It * grad(I) / |grad(I)|^2
  float e = bs.x * 0.5;
  float I = luma(IN(bc)), Ip = luma(HIST(1.0, bc));
  float Ix = luma(IN(bc + vec2(e, 0.0))) - luma(IN(bc - vec2(e, 0.0)));
  float Iy = luma(IN(bc + vec2(0.0, e))) - luma(IN(bc - vec2(0.0, e)));
  vec2 gI = vec2(Ix, Iy) / (2.0 * e);
  float It = I - Ip;
  vec2 v = -It * gI / (dot(gI, gI) + 40.0);
  v = clamp(v * forza * 0.02, -bs * 3.0, bs * 3.0);
  float n = hash12(floor(uv / bs) + S(18.0));
  v += (vec2(hash11(n * 91.0 + floor(u_frame / 6.0)), hash11(n * 37.0 + floor(u_frame / 6.0))) - 0.5) * deriva * bs * 0.4;
  vec3 moshed = FB(uv - v);
  float refresh = step(1.0 - rinnovo, hash13(vec3(floor(uv / bs), floor(u_frame) + S(19.0))));
  if (u_frame < 1.5) refresh = 1.0;
  vec3 c = mix(moshed, IN(uv), max(refresh, 1.0 - persistenza));
  return c;
}`,
  },
  // ------------------------------------------------------------------ pellicola
  {
    id: 'graffio', code: 'Gr', name: 'Graffio', family: 'pellicola', gen: true,
    about: 'Pellicola graffiata e dipinta a mano, un fotogramma alla volta (Brakhage, Len Lye).',
    params: [
      P('graffi', 'Graffi', 0, 1, 0.5, 0.5),
      P('macchie', 'Macchie dipinte', 0, 1, 0.45, 0.5),
      P('pigmento', 'Pigmento', 0, 1, 0.5, 0.3),
      P('sfarfallio', 'Sfarfallio', 0, 1, 0.4, 0.5),
      P('lampi', 'Fotogrammi singoli', 0, 1, 0.12, 0.6),
      P('cadenza', 'Cadenza', 1, 6, 2, 0, { step: 1 }),
      P('fondo', 'Fondo nero', 0, 1, 0.3, 0.2),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  float fr = floor(u_frame / max(1.0, floor(cadenza)));
  vec3 c = IN(uv) * (1.0 - fondo);
  // macchie: pigmento steso a pennellate verticali su tutto il fotogramma,
  // diverso a ogni gruppo di fotogrammi, con crepe e zone scoperte
  vec2 p = (uv - 0.5) * vec2(ASPECT, 1.0);
  for (int i = 0; i < 4; i++) {
    vec3 h = hash33(vec3(fr, float(i), S(20.0)));
    if (h.z > macchie * 1.1) continue;
    vec2 q = rot((h.x - 0.5) * 0.6) * p;
    q *= vec2(1.2 + h.y * 2.0, 0.35 + h.x * 0.5);
    float f = fbm(q * 2.2 + h.xy * 40.0, fr * 0.11 + float(i), 0.0, 5);
    float th = mix(0.25, -0.25, macchie) + (h.y - 0.5) * 0.3;
    float cov = smoothstep(th, th + 0.03, f);
    float streak = 0.75 + 0.25 * fbm(vec2(p.x * 90.0, p.y * 3.0) + h.zx * 30.0, fr, 0.0, 3);
    float crack = smoothstep(0.02, 0.0, abs(fbm(p * 14.0 + h.yz * 13.0, fr * 0.3, 0.0, 3)));
    vec3 col = mix(vec3(0.55 + 0.4 * h.x), pigment(h.x * 0.9 + float(i) * 0.21, h.y * 0.5), pigmento);
    col *= streak * (1.0 - crack * 0.7);
    c = mix(c, col, cov * (0.75 + 0.25 * h.z));
  }
  // graffi: righe verticali sottili, alcune durano, altre un fotogramma
  for (int i = 0; i < 9; i++) {
    float life = float(i) < 3.0 ? floor(u_frame / 12.0) : u_frame;
    vec3 h = hash33(vec3(float(i), life, S(22.0)));
    if (h.z > graffi) continue;
    float x = h.x + sin(uv.y * (3.0 + h.y * 9.0) + u_frame * 0.1) * 0.002;
    float wdt = (0.4 + h.y * 1.6) * K1080 * PX.x;
    float line = smoothstep(wdt, 0.0, abs(uv.x - x));
    float brk = step(0.25, fbm(vec2(uv.y * 6.0, h.x * 50.0), u_frame * 0.2, 0.0, 2) + 0.5);
    c = mix(c, vec3(h.y > 0.5 ? 0.95 : 0.02), line * brk);
  }
  float fl = 1.0 + (hash11(u_frame + S(23.0)) - 0.5) * sfarfallio * 0.8;
  c *= fl;
  float flash = hash11(u_frame * 1.3 + S(24.0));
  if (flash > 1.0 - lampi * 0.25) c = vec3(hash11(u_frame + 3.0) > 0.4 ? 0.96 : 0.0);
  return c;
}`,
  },
  // ---------------------------------------------------------------------- luce
  {
    id: 'luce', code: 'Lu', name: 'Luce', family: 'luce', gen: true, blend: 'schermo',
    about: 'Bagliori lenti che attraversano il quadro e fughe di luce dai bordi.',
    params: [
      P('quantita', 'Quantità', 1, 8, 4, 0, { step: 1 }),
      P('morbidezza', 'Morbidezza', 0.05, 1, 0.45, 0.3),
      P('intensita', 'Intensità', 0, 2, 0.8, 0.5),
      P('temperatura', 'Temperatura', 0, 1, 0.6, 0.2),
      P('fuga', 'Fuga dai bordi', 0, 1, 0.35, 0.5),
      P('velocita', 'Velocità', 0, 2, 0.12, 0.3),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(ASPECT, 1.0);
  vec3 warm = vec3(1.0, 0.62, 0.32), cool = vec3(0.55, 0.72, 1.0);
  vec3 tint = mix(cool, warm, temperatura);
  float acc = 0.0;
  float ph = TAU * u_t * rate(velocita);
  for (int i = 0; i < 8; i++) {
    if (float(i) >= quantita) break;
    vec3 h = hash33(vec3(float(i), S(25.0), 1.0));
    vec2 ctr = vec2(sin(ph * (1.0 + floor(h.x * 2.0)) + h.y * TAU) * ASPECT * 0.45, cos(ph + h.z * TAU) * 0.4);
    float r = morbidezza * (0.25 + h.z * 0.6);
    acc += exp(-dot(p - ctr, p - ctr) / (r * r)) * (0.5 + h.x);
  }
  float edge = pow(clamp(1.0 - uv.x + 0.25 * sin(ph + uv.y * 3.0), 0.0, 1.0), 4.0) + pow(clamp(uv.y - 0.2 + 0.2 * cos(ph * 2.0), 0.0, 1.0), 6.0);
  acc += edge * fuga * (0.6 + 0.4 * sin(ph * 3.0 + 1.0));
  return tint * acc * intensita * 0.5;
}`,
  },
  // --------------------------------------------------------------------- tempo
  {
    id: 'retroazione', code: 'Rf', name: 'Retroazione', family: 'tempo', feedback: true, noloop: true,
    about: 'La telecamera puntata sul suo monitor: ogni fotogramma rientra zoomato, ruotato, sbiadito.',
    params: [
      P('zoom', 'Zoom', -0.06, 0.06, 0.012, 0.5),
      P('rotazione', 'Rotazione', -0.06, 0.06, 0.004, 0.5),
      P('decadimento', 'Persistenza', 0.5, 0.995, 0.93, 0.2),
      P('deriva', 'Deriva', 0, 0.02, 0.003, 0.5),
      P('tinta', 'Deriva colore', 0, 0.1, 0.0, 0.4),
      P('ingresso', 'Ingresso', 0, 1, 0.5, 0.5),
      P('soglia', 'Chiave', 0, 1, 0.0, 0.3),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(ASPECT, 1.0);
  p = rot(rotazione) * p / (1.0 + zoom);
  float z = u_t * 0.3;
  p += vec2(gnoise(vec3(p * 3.0, z), 0.0), gnoise(vec3(p * 3.0 + 7.0, z), 0.0)) * deriva;
  vec2 q = p / vec2(ASPECT, 1.0) + 0.5;
  vec3 prev = FB(q);
  if (tinta > 0.0001) prev = hue(prev, tinta);
  prev *= decadimento;
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) prev = vec3(0.0);
  vec3 cur = IN(uv);
  float key = smoothstep(soglia - 0.05, soglia + 0.05, luma(cur));
  vec3 add = cur * ingresso * (soglia > 0.001 ? key : 1.0);
  return max(prev, add) + add * 0.15;
}`,
  },
  {
    id: 'fessura', code: 'Fe', name: 'Fessura', family: 'tempo', history: 32,
    about: 'Slit-scan: ogni riga dell’immagine arriva da un istante diverso. Il tempo diventa spazio.',
    params: [
      P('profondita', 'Profondità', 1, 31, 20, 0.4),
      P('direzione', 'Direzione', 0, 3, 0, 0, { step: 1, options: ['orizzontale', 'verticale', 'radiale', 'rumore'] }),
      P('curva', 'Curva', 0.2, 3, 1, 0.3),
      P('inverti', 'Inverti', 0, 1, 0, 0, { step: 1, options: ['no', 'sì'] }),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  float d = int(direzione) == 0 ? uv.y : int(direzione) == 1 ? uv.x :
            int(direzione) == 2 ? clamp(length((uv - 0.5) * vec2(ASPECT, 1.0)) * 1.4, 0.0, 1.0) :
            clamp(0.5 + fbm(uv * 3.0, u_t * 0.2, 0.0, 3), 0.0, 1.0);
  if (inverti > 0.5) d = 1.0 - d;
  float k = pow(d, curva) * profondita;
  return HISTF(k, uv);
}`,
  },
  {
    id: 'sovrimpressione', code: 'Sv', name: 'Sovrimpressione', family: 'tempo', history: 32,
    about: 'Strati del passato recente sovrapposti, spostati e respirati (Clipson).',
    params: [
      P('strati', 'Strati', 1, 5, 3, 0, { step: 1 }),
      P('ritardo', 'Ritardo', 1, 8, 4, 0.3, { step: 1 }),
      P('deriva', 'Deriva', 0, 0.12, 0.02, 0.5),
      P('scala', 'Scala', 0.9, 1.15, 1.03, 0.4),
      P('esposizione', 'Esposizione', 0.3, 1.6, 0.85, 0.3),
      P('sfarfallio', 'Sfarfallio', 0, 1, 0.3, 0.5),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  vec3 acc = IN(uv);
  float wsum = 1.0;
  for (int i = 1; i <= 5; i++) {
    if (float(i) > strati) break;
    float fi = float(i);
    vec2 h = hash22(vec2(fi, S(26.0))) - 0.5;
    vec2 q = (uv - 0.5) / pow(scala, fi) + 0.5 + h * deriva * fi + vec2(sin(u_t * 0.7 + fi), cos(u_t * 0.5 + fi * 2.0)) * deriva * 0.3;
    float w = (1.0 - fi / (strati + 1.0)) * (1.0 + (hash11(u_frame * fi + S(27.0)) - 0.5) * sfarfallio);
    vec3 l = HIST(fi * ritardo, q);
    acc = 1.0 - (1.0 - acc) * (1.0 - l * w * 0.8);
    wsum += w;
  }
  return acc * esposizione;
}`,
  },
  {
    id: 'metamorfosi', code: 'Mf', name: 'Metamorfosi', family: 'tempo',
    about: 'Una sorgente si scioglie nell’altra attraverso le proprie luci. Servono almeno due sorgenti; con una sola si fonde con il flusso.',
    params: [
      P('cicli', 'Cicli', 1, 8, 2, 0, { step: 1 }),
      P('deformazione', 'Deformazione', 0, 0.4, 0.12, 0.4),
      P('tenuta', 'Tenuta', 0, 0.9, 0.35, 0.2),
      P('granulo', 'Granulo', 0.5, 12, 3, 0.3),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  int n = max(u_ns, 1);
  int count = u_ns >= 2 ? u_ns : 2;
  float pos = u_t / u_T * cicli * float(count);
  int ia = int(mod(floor(pos), float(count)));
  int ib = int(mod(floor(pos) + 1.0, float(count)));
  float f = fract(pos);
  f = smoothstep(tenuta * 0.5, 1.0 - tenuta * 0.5, f);
  float bend = sin(f * PI);
  vec2 p = uv * granulo * vec2(ASPECT, 1.0);
  vec2 nv = vec2(gnoise(vec3(p, pos * 0.5), 0.0), gnoise(vec3(p + 9.0, pos * 0.5), 0.0));
  vec2 da = nv * deformazione * bend;
  vec3 A = u_ns >= 2 ? SRC(ia, uv + da * f) : (ia == 0 ? IN(uv + da * f) : SRC(0, uv + da * f));
  vec3 B = u_ns >= 2 ? SRC(ib, uv - da * (1.0 - f)) : (ib == 0 ? IN(uv - da * (1.0 - f)) : SRC(0, uv - da * (1.0 - f)));
  float la = luma(A), lb = luma(B);
  float thr = smoothstep(f - 0.25, f + 0.25, mix(la, lb, 0.5) * 0.5 + 0.5 * (gnoise(vec3(p * 0.5, 3.0), 0.0) + 0.5));
  return mix(B, A, thr);
}`,
  },
  // -------------------------------------------------------------------- colore
  {
    id: 'tono', code: 'To', name: 'Tono', family: 'colore',
    about: 'Bianco e nero, bicromia, inversione, soglia: il colore ridotto al necessario.',
    params: [
      P('saturazione', 'Saturazione', 0, 2, 1, 0.2),
      P('contrasto', 'Contrasto', 0.2, 3, 1, 0.3),
      P('luminosita', 'Luminosità', -0.5, 0.5, 0, 0.3),
      P('bicromia', 'Bicromia', 0, 1, 0, 0.2),
      P('ombre', 'Tinta ombre', 0, 1, 0.6, 0.2),
      P('luci', 'Tinta luci', 0, 1, 0.08, 0.2),
      P('inverti', 'Inverti', 0, 1, 0, 0.3),
      P('soglia', 'Soglia', 0, 1, 0, 0.3),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  vec3 c = IN(uv);
  float l = luma(c);
  c = mix(vec3(l), c, saturazione);
  c = (c - 0.5) * contrasto + 0.5 + luminosita;
  float l2 = clamp(luma(c), 0.0, 1.0);
  vec3 duo = mix(pigment(ombre, 0.0) * 0.25, pigment(luci, 0.0) * 1.1 + 0.15, l2);
  c = mix(c, duo, bicromia);
  c = mix(c, 1.0 - c, inverti);
  c = mix(c, vec3(step(0.5, l2)), soglia);
  return c;
}`,
  },
  {
    id: 'sorgente', code: 'So', name: 'Sorgente', family: 'colore',
    about: 'Porta nel flusso una delle sorgenti della clip, con posizione, scala e rotazione.',
    params: [
      P('indice', 'Sorgente n.', 1, 4, 1, 0, { step: 1 }),
      P('scala', 'Scala', 0.2, 4, 1, 0.3),
      P('px', 'Posizione x', -1, 1, 0, 0.3),
      P('py', 'Posizione y', -1, 1, 0, 0.3),
      P('rotazione', 'Rotazione', -3.1416, 3.1416, 0, 0.2),
      P('ripeti', 'Ripeti', 0, 1, 0, 0, { step: 1, options: ['no', 'sì'] }),
    ],
    blend: 'normale',
    glsl: `
vec3 fx(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(ASPECT, 1.0);
  p = rot(rotazione) * (p - vec2(px, py) * 0.5) / scala;
  vec2 q = p / vec2(ASPECT, 1.0) + 0.5;
  if (ripeti > 0.5) q = fract(q);
  else if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return vec3(0.0);
  return SRC(int(indice) - 1, q);
}`,
  },
];

export const byId = Object.fromEntries(PROCESSES.map((p) => [p.id, p]));

export function defaultParams(procId) {
  const p = byId[procId];
  return Object.fromEntries(p.params.map((x) => [x.id, x.def]));
}

/** GLSL completo di un processo, con i parametri come costanti leggibili. */
export function fragmentFor(proc, prelude, postlude) {
  const defs = proc.params.map((p, i) => `#define ${p.id} u_p[${i}]`).join('\n');
  const undefs = proc.params.map((p) => `#undef ${p.id}`).join('\n');
  return `${prelude}\n${defs}\n${proc.glsl}\n${undefs}\n${postlude}`;
}
