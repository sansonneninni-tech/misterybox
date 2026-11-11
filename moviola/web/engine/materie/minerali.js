// Materie: minerali. Pietre, cristalli, geli, sabbie, ossidi, argille:
// la foto diventa il corpo di una materia inerte che però cresce e si muove.
import { P } from './comune.js';
import { MATERIA as BRINA } from './crescite/brina.js';

// Lettura di una cella dello stato senza filtro (le simulazioni a fronte
// copiano valori esatti, come l'identità di un grano).
const STX = `
vec4 STX(ivec2 c) { return texelFetch(u_st, clamp(c, ivec2(0), ivec2(u_stRes) - 1), 0); }
`;

// Velocità di crescita di un cristallo: veloce lungo i raggi del grano,
// lenta tra un raggio e l'altro, quasi nulla verso l'interno.
const CRISTALLO = `
// raggio relativo del poligono del grano nella direzione an: facce dritte
// ma irregolari (ognuna a una sua distanza e con un suo angolo)
float cpoly(float an, float h) {
  float nr = floor(raggi + 0.5);
  float sec = PI / nr;
  float pr = 3.0;
  for (int j = 0; j < 8; j++) {
    if (float(j) >= 2.0 * nr) break;
    float hj = hash12(vec2(float(j), h * 53.1));
    float ph = (float(j) + 0.5 + (hj - 0.5) * 0.35) * sec;
    float Rj = 0.7 + 0.6 * hash12(vec2(h * 17.3, float(j) + 4.0));
    float cj = cos(an - ph);
    if (cj > 0.05) pr = min(pr, Rj / cj);
  }
  return pr;
}
float cvel(vec2 sd, vec2 pos, vec2 tdir) {
  vec2 d = (pos - sd) * vec2(ASPECT, 1.0);
  float h = hash12(sd * 913.7 + S(3.0));
  float th = h * TAU;
  float r = length(d);
  float an = atan(d.y, d.x) - th;
  float nr = floor(raggi + 0.5);
  float sec = PI / nr;
  // forma di Wulff: un poligono a 2·raggi facce (con un raggio solo, un ago)
  float am = mod(an, sec) - 0.5 * sec;
  float poly = cpoly(an, h);
  // dendriti: gli spigoli del poligono corrono avanti a intervalli
  float vert = pow(abs(sin(am * nr)), 3.0 + 10.0 * (1.0 - aghi));
  float side = 0.6 + 0.4 * cos(r * 220.0 + h * 40.0);
  float v = 0.07 * crescita * (0.65 + 0.7 * hash11(h * 71.0 + 3.0));
  float rad = r > 1e-4 ? clamp(dot(d / r, tdir), 0.0, 1.0) : 1.0;
  return v * poly * (1.0 + 1.1 * aghi * vert * side) * (0.3 + 0.7 * rad * rad);
}
`;

export const MATERIE = [
  // ------------------------------------------------------------------ marmo
  {
    id: 'marmo', code: 'Mr', name: 'Marmo', family: 'minerali', ref: 'Belson, “il colore, non la linea, definisce le forme”',
    about: 'La foto diventa una lastra di marmo: i suoi contorni e le sue curve di luce sono le vene, che scorrono lente come magma che si raffredda.',
    params: [
      P('materia', 'Materia', 0, 1, 0.9, 0.2),
      P('vene', 'Vene', 1, 10, 3, 0.3),
      P('finezza', 'Spessore vene', 1, 30, 7, 0.3),
      P('torsione', 'Torsione', 0, 3, 1.2, 0.5),
      P('velocita', 'Velocità', 0, 1, 0.16, 0.2),
      P('scala', 'Scala', 0.5, 6, 1.8, 0.2),
      P('pietra', 'Pietra', 0, 1, 0.6, 0.2),
      P('tinta', 'Tinta vene', 0, 1, 0.55, 0.2),
    ],
    glsl: `
vec3 blurIN(vec2 uv, float r) {
  vec2 o = r * PX;
  return (IN(uv) * 2.0 + IN(uv + o) + IN(uv - o) + IN(uv + vec2(o.x, -o.y)) + IN(uv + vec2(-o.x, o.y))) / 6.0;
}
vec3 fx(vec2 uv) {
  vec2 a = vec2(ASPECT, 1.0);
  vec2 p = (uv - 0.5) * a * scala;
  float z = ztime(velocita), Pz = period(velocita);
  vec2 q = vec2(fbm(p, z, Pz, 3), fbm(p + vec2(5.2, 1.3), z, Pz, 3));
  vec2 r = vec2(fbm(p + 2.2 * q + vec2(1.7, 9.2), z, Pz, 3), fbm(p + 2.2 * q + vec2(8.3, 2.8), z, Pz, 3));
  // la foto è trascinata dallo stesso flusso della pietra: i suoi toni diventano venatura
  vec2 o = 5.0 * K1080 * PX;
  vec2 g = vec2(luma(IN(uv + vec2(o.x, 0.0))) - luma(IN(uv - vec2(o.x, 0.0))),
                luma(IN(uv + vec2(0.0, o.y))) - luma(IN(uv - vec2(0.0, o.y))));
  vec2 w = uv + (r * 0.05 + q * 0.02 + vec2(-g.y, g.x) * 0.5 * q.x) * torsione / a;
  vec3 col = mix(blurIN(w, 2.5 * K1080), IN(w), 0.45);
  float L = luma(col);
  float f = fbm(p * 2.3 + 3.0 * r, z, Pz, 3);
  // nuvolatura: la turbolenza diventa colore della pietra
  vec3 desat = mix(vec3(L), col, 0.5);
  vec3 stone = mix(col, 0.12 + 0.8 * desat * vec3(1.02, 0.99, 0.95), pietra);
  stone *= 0.88 + 0.22 * smoothstep(-0.6, 0.6, f * 0.7 + r.x * 0.6);
  stone *= mix(vec3(1.0), mix(vec3(1.04, 0.99, 0.92), vec3(0.95, 0.99, 1.03), smoothstep(-0.4, 0.4, r.y)), pietra);
  // poche vene maestre, morbide e traslucide, piegate dalla luce della foto
  float fv = fbm(p * 0.9 + 0.9 * q, z, Pz, 3);
  float lin = dot(p, vec2(0.55, 0.83)) / scala;
  float ph = (lin * 1.4 + fv * 0.9 + L * 0.5) * vene * 0.3;
  float dd = abs(fract(ph + 0.5) - 0.5);
  float dpx = dd / max(fwidth(ph), 1e-4);
  float thick = smoothstep(-0.45, 0.5, fbm(p * 2.6 + r, z, Pz, 2) + 0.15);
  float wv = finezza * K1080 * (0.2 + 1.6 * thick) + 0.5;
  float vein = exp(-dpx * dpx / (wv * wv)) * smoothstep(0.0, 0.25, thick);
  float cloud = exp(-dpx / (wv * 7.0 + 4.0 * K1080)) * thick;
  // i bordi della foto, trascinati, diventano venuzze appena accennate
  vec2 o2 = 3.0 * K1080 * PX;
  float ex = luma(IN(w + vec2(o2.x, 0.0)) - IN(w - vec2(o2.x, 0.0)));
  float ey = luma(IN(w + vec2(0.0, o2.y)) - IN(w - vec2(0.0, o2.y)));
  float e = smoothstep(0.1, 0.45, length(vec2(ex, ey)));
  // calcite più chiara del fondo o vena più scura, a tratti
  float sg = smoothstep(-0.15, 0.15, fbm(p * 0.7 + 7.0, z, Pz, 2));
  vec3 dark = mix(stone * 0.55, pigment(0.58 + L * 0.25, tinta) * 0.6, 0.35);
  vec3 light = mix(stone, vec3(0.9, 0.89, 0.85), 0.5);
  vec3 vcol = mix(dark, light, sg);
  vec3 c = mix(stone, vcol, cloud * 0.3);
  c = mix(c, vcol, vein * 0.7);
  c = mix(c, mix(stone * 0.8, light, sg), e * 0.25);
  return mix(IN(uv), c, materia);
}`,
  },
  // -------------------------------------------------------------- cristalli
  {
    id: 'cristalli', code: 'Cs', name: 'Cristalli', family: 'minerali', ref: 'Brakhage, la chimica sulla pellicola che crea forme',
    sim: '', steps: 4, simLong: 480, noloop: true,
    about: 'Da pochi semi crescono grani di cristallo ad aghi e dendriti; ogni grano è una lastra senza colore proprio che sposta la foto a modo suo, come un quarzo tagliato, e l’immagine si ricompone in un mosaico che avanza.',
    params: [
      P('crescita', 'Crescita', 0.2, 2.5, 1, 0.2),
      P('semi', 'Semina', 0, 1, 0.3, 0),
      P('aghi', 'Dendriti', 0, 1, 0.2, 0.2),
      P('rifr', 'Rifrazione', 0, 1, 0.8, 0.4),
      P('guida', 'Guida della foto', 0, 1, 0.6, 0.2),
      P('giunti', 'Giunti', 0, 1, 0.55, 0.2),
      P('raggi', 'Raggi', 1, 4, 3, 0, { step: 1 }),
    ],
    glsl: STX + CRISTALLO + `
vec3 fx(vec2 uv) {
  vec2 a = vec2(ASPECT, 1.0);
  float tn = u_t;
  vec2 fp = uv * u_stRes - 0.5;
  ivec2 i0 = ivec2(floor(fp));
  float b1 = 1e4, b2 = 1e4, v1 = 0.05;
  vec2 s1 = vec2(-1.0), s2 = vec2(-1.0);
  for (int k = 0; k < 4; k++) {
    ivec2 c = i0 + ivec2(k - (k / 2) * 2, k / 2);
    vec4 n = STX(c);
    if (n.y < -0.5) continue;
    vec2 cc = (vec2(c) + 0.5) / u_stRes;
    vec2 dv = (uv - n.yz) * a;
    float dp = length(dv), dc = length((cc - n.yz) * a);
    float v = max(cvel(n.yz, uv, dp > 1e-5 ? dv / dp : vec2(1.0, 0.0)), 1e-4);
    float cand = n.x + (dp - dc) / v;
    if (all(equal(n.yz, s1))) { if (cand < b1) { b1 = cand; v1 = v; } }
    else if (cand < b1) { b2 = b1; s2 = s1; b1 = cand; s1 = n.yz; v1 = v; }
    else if (cand < b2) { b2 = cand; s2 = n.yz; }
  }
  float px = 1.0 / u_res.y; // un pixel in unità di altezza
  float grown = s1.x < -0.5 ? 0.0 : clamp((tn - b1) * v1 / (1.5 * px) + 0.5, 0.0, 1.0);
  vec3 img = IN(uv);
  // soluzione madre: la foto appena velata
  vec3 liq = img;
  if (grown <= 0.0) return liq;
  float h = hash12(s1 * 913.7 + S(3.0));
  float th = h * TAU;
  vec2 d = (uv - s1) * a;
  float rr = length(d);
  float nr = floor(raggi + 0.5);
  float an = atan(d.y, d.x) - th;
  float sec = PI / nr;
  // il grano è una lastra: una sola inclinazione, la foto rifratta dentro
  vec2 nrm = vec2(cos(th + 1.3), sin(th + 1.3)) * (0.5 + 0.5 * hash11(h * 13.0)) + (hash22(s1 * 51.3 + S(4.0)) - 0.5) * 0.6;
  // raggio "poligonale": a parità di valore si è sulla stessa linea di crescita
  float rho = rr / cpoly(an, h);
  vec2 off = (nrm * 0.045 + (hash22(s1 * 17.1 + S(5.0)) - 0.5) * 0.06 + nrm * rho * 0.12) * rifr;
  vec2 su = uv + off / a;
  su = 1.0 - abs(1.0 - abs(su)); // specchio ai bordi del quadro
  vec3 c = IN(su);
  // linee di accrescimento, finissime, parallele alle facce
  float sp = 6.0 / 1080.0;
  float lr = abs(fract(rho / sp + 0.5) - 0.5) * sp;
  float gl = 1.0 - smoothstep(0.4, 1.3, lr / max(fwidth(rho), 1e-6));
  c = mix(c, c * 0.86, gl * 0.5 * giunti * smoothstep(0.003, 0.02, rho));
  // giunti tra grani: dove l'impronta del pixel cade su due grani diversi
  vec2 fw = fract(fp);
  float w1 = 0.0;
  for (int k = 0; k < 4; k++) {
    ivec2 cc2 = i0 + ivec2(k - (k / 2) * 2, k / 2);
    vec4 n = STX(cc2);
    float wk = (k - (k / 2) * 2 == 0 ? 1.0 - fw.x : fw.x) * (k / 2 == 0 ? 1.0 - fw.y : fw.y);
    if (all(equal(n.yz, s1)) && n.x <= tn + 0.05) w1 += wk;
  }
  float jb = 1.0 - abs(2.0 * w1 - 1.0);
  float j = smoothstep(0.35, 0.9, jb) * step(0.5, float(s2.x > -0.5));
  c = mix(c, c * 0.68, j * giunti);
  return mix(liq, c, grown);
}`,
  },
  // ------------------------------------------------------------------ brina
  // (un file suo: crescite/brina.js)
  BRINA,
  // ------------------------------------------------------------------ sabbia
  {
    id: 'sabbia', code: 'Sb', name: 'Sabbia', family: 'minerali', ref: 'Brakhage, “sabbie granulose e cangianti che a poco a poco prendono forma”',
    about: 'La foto è fatta di granelli che scivolano col vento, si raccolgono in increspature e dune, poi a poco a poco tornano a comporre l’immagine e di nuovo si sparpagliano.',
    params: [
      P('granello', 'Granello (px)', 2, 24, 12, 0),
      P('vento', 'Vento', 0, 1, 0.6, 0.4),
      P('forma', 'Prendere forma', 0, 1, 0.5, 0.3),
      P('dune', 'Dune', 0, 1, 0.65, 0.3),
      P('velocita', 'Velocità', 0.02, 0.5, 0.14, 0.2),
      P('cangiante', 'Cangiante', 0, 1, 0.5, 0.3),
      P('direzione', 'Direzione', 0, 1, 0.1, 0.1),
      P('rilievo', 'Rilievo', 0, 1, 0.6, 0.2),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  vec2 a = vec2(ASPECT, 1.0);
  vec2 p = uv * a;
  float z = ztime(velocita), Pz = period(velocita);
  float ang = direzione * TAU;
  vec2 wd = VERSO_VENTO(vec2(cos(ang), sin(ang))); // il vento disegnato porta la sabbia
  // il ciclo: sparpagliata (0) ↔ formata (1), con un fronte che attraversa il quadro
  float cyc = sin(TAU * u_t * rate(velocita * 0.5) + fbm(p * 0.9, z, Pz, 2) * 2.5 + dot(p, wd) * 1.5);
  float fo = smoothstep(-0.6, 0.6, cyc + (forma - 0.5) * 1.6);
  float sc = (1.0 - fo) * SOFFIO(vento);
  // le increspature: creste che camminano col vento
  vec2 pw = p + vec2(fbm(p * 1.7 + 4.0, z, Pz, 3), fbm(p * 1.7 + 8.0, z, Pz, 3)) * 0.12;
  float rp = dot(pw, wd) * 62.0 + dot(pw, vec2(-wd.y, wd.x)) * 6.0 * sin(dot(pw, vec2(-wd.y, wd.x)) * 5.0) - z * TAU;
  float amp = smoothstep(-0.5, 0.2, fbm(p * 1.2 + 20.0, z, Pz, 2));
  // profilo di duna: dolce sopravvento, ripido sottovento
  float saw = fract(rp / TAU);
  float crest = (smoothstep(0.0, 0.75, saw) - smoothstep(0.75, 1.0, saw)) * 2.0 - 1.0;
  float slope = mix(0.5, -1.5, smoothstep(0.7, 0.8, saw) - smoothstep(0.93, 1.0, saw));
  // il letto di granelli scivola e si raccoglie verso le creste
  vec2 q = p - wd * (sc * 0.05 + dune * sc * 0.012 * crest * amp);
  float g = granello / 1080.0;
  vec2 x = q / g;
  vec2 n = floor(x), f = fract(x);
  float md = 9.0, md2 = 9.0;
  vec2 mid = vec2(0.0), mr = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i), float(j));
    vec2 id = n + o;
    vec2 hh = hash22(id + S(8.0));
    // i granelli rotolano un poco quando sono sparsi
    vec2 jit = 0.1 + 0.8 * hh + 0.15 * sc * vec2(sin(u_t * 1.7 + hh.x * TAU), cos(u_t * 1.3 + hh.y * TAU));
    vec2 rr = o + jit - f;
    float d = dot(rr, rr);
    if (d < md) { md2 = md; md = d; mid = id; mr = rr; } else if (d < md2) md2 = d;
  }
  vec2 hh = hash22(mid + S(9.0));
  vec2 cen = (mid + 0.5) * g;
  // da dove viene il granello: lontano quando è sparso, a casa quando ha preso forma
  vec2 flow = vec2(fbm(cen * 1.4 + 3.0, z, Pz, 3), fbm(cen * 1.4 + 9.0, z, Pz, 3));
  vec2 home = cen + (flow * 0.22 + wd * 0.1) * sc + (hh - 0.5) * g * (1.0 + 10.0 * sc * cangiante);
  vec3 col = IN(home / a);
  // tono proprio del granello
  float hv = hash12(mid + S(10.0));
  col *= 0.88 + 0.24 * hv;
  col = mix(col, col * mix(vec3(1.06, 0.97, 0.86), vec3(0.9, 0.96, 1.05), hv), cangiante * 0.6);
  col = mix(col, vec3(luma(col)), 0.12 * cangiante * hh.y);
  // granello tondo, in rilievo; fra i granelli l'ombra della sabbia sotto
  float rad = sqrt(md);
  float R = 0.5 + 0.14 * hh.x;
  float aa = fwidth(rad) * 1.2 + 0.02;
  float inside = 1.0 - smoothstep(R - aa, R + aa, rad);
  vec2 nr2 = -mr / R;
  float bump = sqrt(max(0.0, 1.0 - min(rad / R, 1.0) * min(rad / R, 1.0)));
  float sh = mix(1.0, 0.8 + 0.25 * bump + 0.22 * dot(nr2, vec2(-0.6, 0.7)), rilievo);
  sh = mix(mix(1.0, 0.42, rilievo), sh, inside);
  // le dune: il lato sottovento è in ombra
  sh *= 1.0 + dune * (0.3 + 0.7 * sc) * amp * 0.45 * slope * rilievo;
  return col * sh;
}`,
  },
  // ------------------------------------------------------------------ ossido
  {
    id: 'ossido', code: 'Ox', name: 'Ossido', family: 'minerali', ref: 'Brakhage, la limatura di ferro; la chimica che lavora da sola',
    sim: '', steps: 4, simLong: 480, noloop: true,
    about: 'Dalle zone scure della foto avanza la corrosione: un fronte umido e frastagliato lascia ruggine, ferro e verderame che prendono il disegno dell’immagine.',
    params: [
      P('avanzata', 'Avanzata', 0.2, 2.5, 0.55, 0.2),
      P('ruggine', 'Ruggine', 0, 1, 0.75, 0.2),
      P('soglia', 'Zone scure', 0.05, 0.8, 0.52, 0),
      P('rugosita', 'Frastagliatura', 0, 1, 0.8, 0.2),
      P('patina', 'Verderame', 0, 1, 0.55, 0.2),
      P('ferro', 'Ferro', 0, 1, 0.45, 0.2),
      P('rilievo', 'Rilievo', 0, 1, 0.55, 0.2),
    ],
    glsl: `
float pits(vec2 p) { return fbm(p * 26.0, 0.0, 0.0, 2); }
vec3 fx(vec2 uv) {
  vec2 a = vec2(ASPECT, 1.0);
  vec2 p = uv * a;
  float tn = u_t;
  float arr = ST(uv).x;
  float fine = fbm(p * 70.0, 3.1, 0.0, 3);
  float age = tn - arr + fine * 0.6 * rugosita;
  float cor = smoothstep(0.0, 0.12, age);
  float wet = smoothstep(-0.05, 0.08, age) * (1.0 - smoothstep(0.15, 0.9, age));
  float mature = smoothstep(0.3, 1.8, age);
  vec3 img = IN(uv);
  float l = luma(img);
  float var = fbm(p * 5.0, 7.0, 0.0, 3);
  // ruggine: dall'arancio vivo della scaglia fresca alla terra d'ombra
  vec3 hiR = mix(vec3(0.66, 0.37, 0.16), vec3(0.62, 0.49, 0.24), smoothstep(-0.2, 0.4, var));   // ruggine → ocra
  hiR = mix(hiR, vec3(0.36, 0.26, 0.19), smoothstep(0.1, 0.5, -var) * 0.7);                    // bruno
  vec3 rust = mix(vec3(0.1, 0.045, 0.025), hiR, smoothstep(0.02, 0.9, l));
  rust = mix(rust, rust * vec3(0.62, 0.5, 0.42), smoothstep(0.1, 0.5, fbm(p * 11.0, 9.0, 0.0, 3)) * 0.7);
  vec3 iron = vec3(0.13, 0.105, 0.085) * (0.5 + 1.3 * l);
  vec3 verd = mix(vec3(0.11, 0.19, 0.16), vec3(0.47, 0.6, 0.52), smoothstep(0.05, 0.9, l));
  float m1 = fbm(p * 2.2, 11.0, 0.0, 4);
  float im = smoothstep(0.0, 0.35, m1 + 0.2 * var) * ferro;
  float pm = smoothstep(-0.05, 0.3, -m1 + 0.3 * fine) * patina * (0.35 + 0.65 * mature);
  vec3 ox = mix(rust, iron, im);
  ox = mix(ox, verd, pm);
  // la foto resta: il suo disegno e un po' del suo colore dentro l'ossido
  ox = mix(ox, ox * img / max(l, 0.04), 0.3);
  ox = mix(ox, img, 0.15);
  // saturazione vicina a quella della foto
  float sat0 = length(img - vec3(l));
  ox = mix(vec3(luma(ox)), ox, clamp(0.55 + sat0 * 2.5, 0.55, 0.9));
  // la crosta: macchie, alveoli, polvere d'ossido
  float pt0 = pits(p);
  ox *= 0.78 + 0.3 * smoothstep(-0.5, 0.5, pt0) + 0.12 * fine;
  ox = mix(ox, ox * vec3(0.55, 0.42, 0.36), smoothstep(0.25, 0.55, pt0) * 0.6);
  vec3 c = mix(img, ox, cor * ruggine * (1.0 - 0.6 * smoothstep(0.6, 0.95, l)));
  c = mix(c, img * vec3(0.52, 0.46, 0.4), wet * 0.55 * ruggine);
  // rilievo morbido: la crosta si gonfia e si butterà
  float e = 2.0 * K1080 / u_res.y;
  float h0 = pits(p) + cor;
  float hx = pits(p + vec2(e, 0.0)) + smoothstep(0.0, 0.12, tn - ST(uv + vec2(e / ASPECT, 0.0)).x + fine * 0.35 * rugosita);
  float hy = pits(p + vec2(0.0, e)) + smoothstep(0.0, 0.12, tn - ST(uv + vec2(0.0, e)).x + fine * 0.35 * rugosita);
  vec2 gr = vec2(hx - h0, hy - h0) * cor * (0.6 + 0.4 * mature);
  float sh = 1.0 + dot(gr, vec2(-0.6, 0.8)) * 2.0 * rilievo;
  return c * clamp(sh, 0.6, 1.25);
}`,
  },
  // --------------------------------------------------------------- crettatura
  {
    id: 'crettatura', code: 'Ct', name: 'Crettatura', family: 'minerali', ref: 'Turing, la forma che nasce dalla materia; il fango che si secca',
    about: 'La foto è uno strato d’argilla che si ritira in placche: le crepe si aprono e si richiudono come un respiro, i bordi delle zolle si incurvano con ombre morbide.',
    params: [
      P('placche', 'Placche', 2, 16, 4.5, 0.1),
      P('crepe', 'Crepe', 0, 1, 0.45, 0.3),
      P('respiro', 'Respiro', 0, 1, 0.6, 0.3),
      P('velocita', 'Velocità', 0.02, 0.6, 0.18, 0.2),
      P('curvatura', 'Curvatura', 0, 1, 0.6, 0.3),
      P('secco', 'Essiccato', 0, 1, 0.35, 0.2),
      P('guida', 'Guida della foto', 0, 1, 0.5, 0.2),
      P('dettaglio', 'Crepe sottili', 0, 1, 0.5, 0.2),
    ],
    glsl: `
// distanza dal bordo della cella, centro della cella, direzione verso il bordo
float vore(vec2 x, out vec2 cid, out vec2 cen, out vec2 en) {
  vec2 n = floor(x), f = fract(x);
  vec2 mg = vec2(0.0), mr = vec2(0.0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = 0.12 + 0.76 * hash22(n + g + S(11.0));
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0; en = vec2(1.0, 0.0);
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(float(i), float(j));
    vec2 o = 0.12 + 0.76 * hash22(n + g + S(11.0));
    vec2 r = g + o - f;
    vec2 dr = r - mr;
    if (dot(dr, dr) > 1e-5) {
      vec2 nd = normalize(dr);
      float d = dot(0.5 * (mr + r), nd);
      if (d < md) { md = d; en = nd; }
    }
  }
  cid = n + mg;
  cen = x + mr;
  return md;
}
vec3 fx(vec2 uv) {
  vec2 a = vec2(ASPECT, 1.0);
  vec2 p = uv * a;
  float z = ztime(velocita);
  // la foto piega le crepe lungo i suoi contorni
  vec2 o = 6.0 * K1080 * PX;
  float lb = (luma(IN(uv + o)) + luma(IN(uv - o)) + luma(IN(uv + vec2(o.x, -o.y))) + luma(IN(uv - vec2(o.x, -o.y)))) * 0.25;
  vec2 x = p * placche + vec2(gnoise(vec3(p * 2.0, 1.0), 0.0), gnoise(vec3(p * 2.0, 5.0), 0.0)) * 0.6 + vec2(lb, -lb) * guida * 1.6;
  vec2 cid, cen, en;
  float ed = vore(x, cid, cen, en);
  float ph = hash12(cid + S(12.0));
  float br = respiro * (0.5 + 0.5 * sin(TAU * (z + ph * 0.3)));
  // ogni zolla si ritira a modo suo: quasi tutte poco, alcune molto
  float sk = hash12(cid + S(15.0));
  sk = 0.15 + 0.85 * sk * sk * sk;
  float aa = fwidth(ed) * 1.2;
  float w = crepe * (0.004 + 0.07 * br * sk) + 0.002;
  // crepe secondarie: alcune dividono la zolla in due più piccole, altre sono solo un capello
  vec2 cid2, cen2, en2;
  float ed2 = vore(x * 2.2 + 7.3, cid2, cen2, en2) / 2.2;
  float h2 = hash12(cid2 + S(13.0));
  float w2 = (h2 > 0.82 ? w * 0.7 : crepe * 0.0025 * dettaglio * step(0.5, h2));
  float aa2 = fwidth(ed2) * 1.2;
  float cr = 1.0 - smoothstep(w, w + aa, ed);
  float cr2 = (1.0 - smoothstep(w2, w2 + aa2, ed2)) * step(0.0005, w2);
  // la zolla si ritira verso il suo centro
  float shrink = 0.09 * br * sk * crepe;
  vec2 duv = (x - cen) * shrink / placche / a;
  vec3 col = IN(uv + duv);
  float l = luma(col);
  vec3 dry = mix(vec3(l), col, 0.6) * vec3(1.04, 0.98, 0.88);
  vec3 clay = mix(col, 0.08 + 0.86 * dry, secco);
  clay *= 0.96 + 0.06 * gnoise(vec3(p * 140.0, 2.0), 0.0);
  // solo alcune zolle incurvano i bordi
  float cv = curvatura * step(0.55, hash12(cid + S(14.0))) * (0.5 + sk);
  float cw = 0.05 + 0.2 * cv;
  float up = 1.0 - smoothstep(w, w + cw, ed);
  float slope = up * (1.0 - up) * 4.0 * cv;
  vec2 ld = normalize(vec2(-0.6, 0.8));
  float sh = 1.0 + slope * dot(en, ld) * 0.2;
  float shad = (1.0 - smoothstep(w, w + cw * 0.5, ed)) * smoothstep(-0.2, 0.6, dot(en, ld)) * cv;
  clay *= sh * (1.0 - 0.18 * shad);
  // il fondo della crepa: la foto stessa, in profondità
  vec3 deep = IN(uv) * 0.58 * vec3(0.92, 0.86, 0.8);
  vec3 c = mix(clay, deep, cr);
  c = mix(c, c * 0.72, cr2 * (1.0 - cr));
  return c;
}`,
  },
];

// ---- simulazioni (a fronte: ogni cella tiene l'istante in cui la materia la raggiunge)

MATERIE[1].sim = STX + CRISTALLO + `
vec4 sim(vec2 uv) {
  vec2 a = vec2(ASPECT, 1.0);
  ivec2 ic = ivec2(gl_FragCoord.xy);
  if (u_init > 0.5) {
    float cs = mix(0.26, 0.085, semi);
    vec2 g = uv * a / cs;
    vec2 cl = floor(g);
    vec2 hh = hash22(cl + S(1.0));
    vec2 sp = (cl + 0.15 + 0.7 * hh) * cs / a;
    float L = luma(IN(sp));
    float on = step(hash12(cl + S(2.0)), 0.45 + 0.4 * (1.0 - L));
    vec2 dt = (uv - sp) * u_stRes;
    if (on > 0.5 && dot(dt, dt) < 0.6) {
      float delay = hash12(cl + S(3.0)) * 2.2 * (0.3 + 0.7 * L);
      return vec4(delay, sp, 1.0);
    }
    return vec4(1e4, -1.0, -1.0, 1.0);
  }
  float tn = u_t;
  vec4 me = STX(ic);
  float best = me.x; vec2 bs = me.yz;
  // la foto rallenta i cristalli sui suoi contorni e li accelera nel buio
  vec2 e = 1.5 / u_stRes;
  float L = luma(IN(uv));
  float gx = luma(IN(uv + vec2(e.x, 0.0))) - luma(IN(uv - vec2(e.x, 0.0)));
  float gy = luma(IN(uv + vec2(0.0, e.y))) - luma(IN(uv - vec2(0.0, e.y)));
  float E = smoothstep(0.04, 0.22, length(vec2(gx, gy)));
  float G = mix(1.0, (0.45 + 1.1 * (1.0 - L)) * (1.0 - 0.8 * E), guida);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    if (i == 0 && j == 0) continue;
    ivec2 o = ivec2(i, j);
    vec4 n = STX(ic + o);
    if (n.y < -0.5 || n.x > tn) continue;
    vec2 td = normalize(-vec2(o));
    float dd = length(vec2(o)) / u_stRes.y;
    float c = n.x + dd / max(cvel(n.yz, uv, td) * G, 1e-4);
    if (c < best) { best = c; bs = n.yz; }
  }
  return vec4(best, bs, 1.0);
}`;

MATERIE[4].sim = STX + `
vec4 sim(vec2 uv) {
  vec2 a = vec2(ASPECT, 1.0);
  ivec2 ic = ivec2(gl_FragCoord.xy);
  vec2 e = 2.0 / u_stRes;
  float L = (luma(IN(uv)) * 2.0 + luma(IN(uv + e)) + luma(IN(uv - e))) * 0.25;
  if (u_init > 0.5) {
    vec2 e3 = 6.0 / u_stRes;
    float Lb = (L * 2.0 + luma(IN(uv + e3)) + luma(IN(uv - e3)) + luma(IN(uv + vec2(e3.x, -e3.y))) + luma(IN(uv - vec2(e3.x, -e3.y)))) / 6.0;
    float dark = smoothstep(soglia, soglia - 0.12, max(L, Lb));
    float pt = hash12(floor(uv * a * 30.0) + S(2.0));
    float hp = hash12(gl_FragCoord.xy + S(3.0));
    // le zone più scure sono già intaccate; le altre aspettano il loro turno
    float on = hp < 0.05 * dark ? 1.0 : 0.0;
    return vec4(on > 0.5 ? pt * 2.0 * (0.3 + L) : 1e4, 0.0, 0.0, 1.0);
  }
  float tn = u_t;
  vec4 me = STX(ic);
  float best = me.x;
  vec2 p = uv * a;
  float rough = fbm(p * 24.0, 1.0, 0.0, 4) + 0.5 * fbm(p * 6.0, 4.0, 0.0, 2);
  float ch = mix(1.0, 0.03 + 2.2 * smoothstep(-0.15, 0.45, rough), rugosita);
  float dk = 1.0 - L;
  float v = avanzata * 0.05 * ch * (0.1 + 1.7 * dk * dk);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    if (i == 0 && j == 0) continue;
    vec4 n = STX(ic + ivec2(i, j));
    if (n.x > tn) continue;
    float c = n.x + length(vec2(float(i), float(j))) / u_stRes.y / max(v, 1e-4);
    best = min(best, c);
  }
  return vec4(best, 0.0, 0.0, 1.0);
}`;
