// Materia: lichene. Colonie di licheni crostosi e fogliosi che crescono sulla
// foto come su una pietra o una corteccia.
//
// Come cresce davvero: il tallo si allarga dal bordo a velocità quasi
// costante (è così che si datano le rocce col Rhizocarpon), in lobi con il
// margine rialzato; dietro il margine la crosta si spacca in areole, piccole
// tessere come fango secco, e ci spuntano le apoteci (coppette tonde). Il
// centro più vecchio a volte muore e si sbriciola, e la colonia diventa un
// anello. Due colonie che si incontrano si fermano l'una contro l'altra e sul
// confine resta una linea scura (il protallo).
//
// Simulazione: un fronte che si propaga (tempo d'arrivo, come un incendio
// lentissimo). Ogni cella ricorda quando la colonia è arrivata e quale
// colonia è: la velocità dipende dalla foto (le zone ruvide e scure sono
// ospitali, il liscio chiaro quasi no) e dai lobi propri di ogni colonia.
// Il disegno costruisce areole, apoteci, margine e protallo dall'età locale.
//
// Stato (32 bit, letto con texelFetch, lato lungo 640):
//   r = istante d'arrivo della colonia (1e4 = non ancora)
//   g = numero della colonia (il blocco del seme; −1 = nessuna)
import { P } from '../comune.js';

const COMUNE = `
#define LI_B 26.0
vec4 LX(ivec2 c) { return texelFetch(u_st, clamp(c, ivec2(0), ivec2(u_stRes) - 1), 0); }
// ospitalità della foto: ruvida e scura attira, liscia e chiara respinge
float liHost(vec2 uv) {
  vec2 d = 3.0 / u_stRes;
  float l = luma(IN(uv));
  float v = abs(luma(IN(uv + vec2(d.x, 0.0))) - l) + abs(luma(IN(uv - vec2(0.0, d.y))) - l)
          + abs(luma(IN(uv + d * vec2(-2.0, 2.0))) - l) + abs(luma(IN(uv + d * 2.0)) - l);
  float rough = smoothstep(0.02, 0.16, v);
  float h = clamp(rough * 0.85 + 0.3 * (1.0 - l) - 0.1, 0.0, 1.0);
  return clamp(mix(0.75, h * h * 1.3, ospite), 0.02, 1.0);
}
vec2 liCenter(vec2 b) { return (b + 0.2 + 0.6 * hash22(b + S(41.0))) * LI_B / u_stRes; }
// il seme del blocco b: centro (in uv), istante di nascita; x < 0 se il blocco è vuoto
vec3 liSeed(vec2 b) {
  vec2 nb = floor(u_stRes / LI_B);
  if (b.x < 0.0 || b.y < 0.0 || b.x >= nb.x || b.y >= nb.y) return vec3(-1.0);
  vec2 uv = liCenter(b);
  float ho = liHost(uv);
  if (hash12(b + S(42.0)) > (0.05 + 0.5 * colonie) * ho * ho) return vec3(-1.0);
  float h3 = hash12(b + S(43.0));
  return vec3(uv, 0.2 + 7.0 * h3 * h3 / (0.4 + colonie));
}
float liId(vec2 b) { return b.x + b.y * 4096.0; }
vec2 liBlock(float id) { return vec2(mod(id, 4096.0), floor(id / 4096.0)); }
// velocità del margine (altezze di quadro al secondo) per la colonia id nel punto uv:
// lobi propri della colonia attorno al suo centro, margine frastagliato, foto
float liVel(vec2 uv, float id, vec2 ctr, float host) {
  vec2 d = (uv - ctr) * vec2(ASPECT, 1.0);
  float an = atan(d.y, d.x + 1e-6);
  float hid = hash11(id * 0.137 + S(44.0));
  float nl = 5.0 + floor(9.0 * hid);
  float lob = 0.5 + 0.5 * sin(an * nl + 3.0 * sin(an * 2.0 + hid * 9.0) + hid * 20.0);
  float fine = gnoise(vec3(uv * vec2(ASPECT, 1.0) * 60.0, hid * 7.0), 0.0);
  float sp = 0.016 * crescita * (0.6 + 0.8 * hid);
  // l'acqua scende con la gravità (e il vento porta le spore): la colonia si allunga a valle
  vec2 fz = FORZA(uv) / vec2(ASPECT, 1.0);
  float lean = dot(fz, fz) > 1e-8 ? 0.6 * dot(normalize(d + 1e-6), normalize(fz)) * min(1.0, length(fz) * 30.0) : 0.0;
  return sp * host * (1.0 + lean) * (1.0 - 0.75 * lobi * (1.0 - lob)) * (1.0 + 0.45 * fine);
}
`;

export const MATERIA = {
  id: 'lichene', code: 'Li', name: 'Lichene', family: 'organismi', ref: 'Rhizocarpon geographicum, Xanthoria, Lecanora: le rocce dei monti e i muri vecchi',
  about: 'Colonie di lichene attecchiscono dove la foto è ruvida e scura e si allargano lentissime dal bordo, a lobi con il margine rialzato: dietro il margine la crosta si spacca in tessere minute e ci spuntano le coppette; il centro più vecchio si screpola e si sbriciola. Due colonie che si toccano si fermano e lasciano una linea scura. Grigio verde, giallo zolfo, arancio ruggine, mescolati ai colori della foto.',
  steps: 3, simLong: 640, simFixed: true, simF32: true, noloop: true,
  params: [
    P('crescita', 'Velocità di crescita', 0.2, 3, 1, 0.2),
    P('colonie', 'Quante colonie', 0, 1, 0.45, 0),
    P('ospite', 'Segue la foto', 0, 1, 0.7, 0.2),
    P('lobi', 'Lobi', 0, 1, 0.6, 0.2),
    P('areole', 'Tessere della crosta', 0, 1, 0.6, 0.2),
    P('coppette', 'Coppette', 0, 1, 0.5, 0.2),
    P('vecchiaia', 'Centro che muore', 0, 1, 0.3, 0.2),
    P('fotografia', 'Colore della foto', 0, 1, 0.6, 0.2),
    P('specie', 'Specie', 0, 1, 0.5, 0),
  ],
  sim: COMUNE + `
const ivec2 LI_O[16] = ivec2[16](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1),
  ivec2(1, 1), ivec2(-1, -1), ivec2(1, -1), ivec2(-1, 1),
  ivec2(2, 1), ivec2(1, 2), ivec2(-1, 2), ivec2(-2, 1), ivec2(-2, -1), ivec2(-1, -2), ivec2(1, -2), ivec2(2, -1));
vec4 sim(vec2 uv) {
  ivec2 c = ivec2(floor(uv * u_stRes));
  vec2 cf = vec2(c) + 0.5;
  if (u_init > 0.5) return vec4(1e4, -1.0, 0.0, 1.0);
  vec4 me = LX(c);
  float tn = u_t;
  // nascita: il seme del proprio blocco, se è il suo momento
  vec2 b = floor(cf / LI_B);
  if (me.r > 1e3 && length(cf - liCenter(b) * u_stRes) < 1.6) {
    vec3 sd = liSeed(b);
    if (sd.x >= 0.0 && tn >= sd.z) return vec4(sd.z, liId(b), 0.0, 1.0);
  }
  // una cella già presa resta della sua colonia: le colonie non si scavalcano
  if (me.r <= tn) return me;
  float best = me.r, bid = me.g;
  float px = 1.0 / u_stRes.y;
  float host = liHost(uv);
  float lastId = -2.0, v = 1e-5;
  for (int k = 0; k < 16; k++) {
    vec4 n = LX(c + LI_O[k]);
    if (n.r > tn || n.g < 0.0) continue;
    // i vicini sono quasi sempre della stessa colonia: la velocità si calcola una volta
    if (n.g != lastId) { lastId = n.g; v = liVel(uv, n.g, liCenter(liBlock(n.g)), host); }
    float cand = n.r + length(vec2(LI_O[k])) * px / max(v, 1e-5);
    if (cand < best) { best = cand; bid = n.g; }
  }
  return vec4(best, bid, 0.0, 1.0);
}`,
  glsl: COMUNE + `
// tempo d'arrivo interpolato (bilineare a mano: lo stato è a 32 bit)
float liT(vec2 uv) {
  vec2 q = uv * u_stRes - 0.5;
  ivec2 i = ivec2(floor(q));
  vec2 f = fract(q);
  float tn = u_t + 1.0;
  float a = min(LX(i).r, tn), b = min(LX(i + ivec2(1, 0)).r, tn), c = min(LX(i + ivec2(0, 1)).r, tn), d = min(LX(i + ivec2(1, 1)).r, tn);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
// areole: tessere di Voronoi in pixel, con la distanza dal bordo (per le crepe)
vec3 liCells(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0; vec2 id = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y));
    vec2 r = o + 0.15 + 0.7 * hash22(i + o + S(45.0)) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = i + o; } else if (d < d2) d2 = d;
  }
  return vec3(sqrt(d2) - sqrt(d1), hash12(id + S(46.0)), hash12(id + S(47.0)));
}
// le tre famiglie di colore, dal vero: verde zolfo (Rhizocarpon), arancio ruggine (Xanthoria),
// grigio verde (Lecanora, Parmelia); il protallo è nero-bruno
vec3 liTint(float h) {
  float k = fract(h + specie * 0.61);
  if (k < 0.38) return vec3(0.70, 0.74, 0.30);
  if (k < 0.62) return vec3(0.80, 0.42, 0.12);
  if (k < 0.85) return vec3(0.60, 0.66, 0.58);
  return vec3(0.78, 0.76, 0.66);
}
vec3 fx(vec2 uv) {
  vec3 img = IN(uv);
  float l = luma(img);
  ivec2 ic = ivec2(floor(uv * u_stRes));
  vec4 s = LX(ic);
  float ta = liT(uv);
  float age = u_t - ta;
  if (s.g < 0.0 && age < -0.5) return img;
  // la colonia in questo punto (vicino più prossimo) e i vicini, per il confine
  float id = s.g;
  float other = 0.0;
  for (int k = 0; k < 4; k++) {
    ivec2 o = ivec2(k == 0 ? 1 : k == 1 ? -1 : 0, k == 2 ? 1 : k == 3 ? -1 : 0);
    vec4 n = LX(ic + o);
    if (n.g >= 0.0 && id >= 0.0 && n.g != id && n.r <= u_t) other = 1.0;
    if (id < 0.0 && n.g >= 0.0) id = n.g;
  }
  float hid = hash11(id * 0.137 + S(44.0));
  // il margine: una fascia giovane e rialzata, poi la crosta matura
  float px = 1.0 / u_res.y;
  float edge = smoothstep(-0.12, 0.05, age);                  // dentro la colonia
  float young = 1.0 - smoothstep(0.4, 1.6 + 0.4 * hash12(floor(uv * u_res / K1080 / 20.0) + id), age); // fascia del margine
  // la crosta: areole in pixel × K1080, più grandi verso il centro
  vec2 gp = uv * u_res / K1080;
  // due misure fisse di tessere (piccole al margine, grandi al centro), mai stirate
  float cs = 5.5 * (0.75 + 0.5 * hid);
  vec3 ceA = liCells(gp / cs), ceB = liCells(gp / (cs * 1.9) + 31.0);
  // le tessere grandi del centro si formano a una a una (il confine segue le tessere, niente quadrati)
  vec3 ce = ceB.y < smoothstep(2.0, 7.0, age) ? ceB : ceA;
  // al margine il tallo non è ancora spaccato: lobi allungati che puntano fuori dal centro
  vec2 ctr = liCenter(liBlock(max(id, 0.0)));
  vec2 dc = (uv - ctr) * vec2(ASPECT, 1.0) * 1080.0;
  float rp = length(dc);
  vec3 lob = liCells(vec2(atan(dc.y, dc.x + 1e-4) * rp / (7.0 + 5.0 * hid), rp / 26.0) + hid * 50.0);
  float lz = young * lobi * smoothstep(8.0, 30.0, rp);
  ce = mix(ce, lob, step(0.5, lz));
  vec3 ce2 = liCells(gp / (cs * 0.42) + 13.0);
  float crackW = areole * (0.05 + 0.13 * smoothstep(0.8, 6.0, age));
  float crack = 1.0 - smoothstep(crackW * 0.6, crackW * 0.6 + 0.08, ce.x);
  float crack2 = (1.0 - smoothstep(0.03, 0.09, ce2.x)) * smoothstep(1.5, 5.0, age) * areole * 0.25;
  // il centro vecchio muore a tessere: prima si scuriscono, poi si staccano e resta la pietra
  // il centro vecchio muore a tessere e poi un tallo nuovo lo ricolonizza: la morte
  // torna a ondate e la colonia si fa ad anelli che si allargano
  float dx = (age - mix(16.0, 4.0, vecchiaia)) / 9.0 + (ce.y - 0.5) * 0.12;
  float die = (vecchiaia > 0.001 && dx > 0.0) ? smoothstep(0.0, 0.2, fract(dx)) * (1.0 - smoothstep(0.5, 0.8, fract(dx))) : 0.0;
  // coppette (apoteci): dischi con orlo, solo dove la crosta è matura
  vec2 ap = gp / (cs * 1.6);
  vec2 ai = floor(ap), af = fract(ap) - 0.5;
  vec2 ah = hash22(ai + S(48.0));
  float ar = (0.13 + 0.15 * ah.y) * smoothstep(1.0, 5.0, age);
  float ad = length(af - (ah - 0.5) * 0.5) / max(ar, 1e-3);
  float apo = ah.x < coppette * 0.8 ? 1.0 - smoothstep(0.85, 1.0, ad) : 0.0;
  // il rilievo: tessere a cupola, margine rialzato, coppette col bordo e il disco infossato
  float dome = smoothstep(0.0, 0.45, ce.x) * (0.6 + 0.4 * ce.z);
  float h = edge * (0.35 + 0.65 * dome) * (1.0 - crack * 0.8) * (1.0 - 0.6 * die);
  h += edge * young * 0.9 * smoothstep(-0.05, 0.25, age) * lobi;
  h += apo * (smoothstep(0.55, 0.85, ad) * 0.6 - (1.0 - smoothstep(0.0, 0.7, ad)) * 0.25);
  h -= crack2 * 0.25;
  float hk = 2.4 * K1080;
  vec3 nrm = normalize(vec3(-dFdx(h) * hk, -dFdy(h) * hk, 1.0));
  vec3 L = normalize(vec3(-0.55, 0.65, 0.6));
  float dif = clamp(0.55 + 0.6 * dot(nrm, L), 0.25, 1.25);
  // colore: la specie della colonia, con la sua variazione per tessera, mescolato alla foto
  vec3 tint = liTint(hid);
  tint *= 0.82 + 0.3 * ce.y;
  // il margine giovane è più pallido, il tallo vecchio più carico
  tint = mix(tint, mix(tint, vec3(0.8, 0.8, 0.74), 0.35), young);
  tint = mix(vec3(luma(tint)), tint, 0.8);
  vec3 lc = mix(tint, tint * (0.35 + 1.3 * mix(vec3(l), img, 0.5)), fotografia);
  // le coppette: dischi bruni o aranciati, più scuri del tallo
  vec3 apC = fract(hid + specie * 0.61) < 0.62 && fract(hid + specie * 0.61) > 0.38 ? vec3(0.62, 0.25, 0.06) : vec3(0.16, 0.13, 0.10);
  lc = mix(lc, apC * (0.7 + 0.6 * l), apo * (1.0 - smoothstep(0.5, 0.75, ad)));
  // crepe fra le tessere: il nero del protallo che sta sotto (Rhizocarpon) o la pietra in ombra
  vec3 under = mix(img * 0.35, vec3(0.06, 0.055, 0.05), 0.6);
  lc = mix(lc, under, crack * 0.9 + crack2 * 0.5);
  lc *= dif;
  // morto: grigio, screpolato, poi via
  vec3 deadC = mix(vec3(l) * 0.6 + 0.18, img, 0.3) * dif;
  lc = mix(lc, deadC, smoothstep(0.0, 0.5, die));
  float cover = edge * (1.0 - 0.75 * smoothstep(0.55, 1.0, die) * (1.0 - crack * 0.5));
  vec3 c = mix(img, lc, cover);
  // l'ombra che il margine rialzato getta sulla pietra, appena fuori
  float sh = (1.0 - edge) * smoothstep(-0.6, -0.08, age) * lobi;
  c *= 1.0 - 0.35 * sh;
  // il protallo: una linea scura appena oltre il margine, e sul confine fra due colonie
  float pro = smoothstep(-0.35, -0.1, age) * (1.0 - smoothstep(-0.05, 0.08, age));
  c = mix(c, vec3(0.05, 0.045, 0.04), 0.75 * max(pro * 0.7, other * edge * (1.0 - 0.6 * die)));
  // il rilievo, per la messa a fuoco della Macro
  FX_H = 0.3 + 0.45 * clamp(h, 0.0, 1.0) * cover;
  return c;
}`,
};
