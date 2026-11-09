// Materia densa: impasto. La foto diventa una lastra di colore a olio steso
// spesso, fotografata da vicino in luce radente.
// Pittura guidata dal flusso: la direzione delle pennellate è la tangente del
// tensore di struttura della foto (lungo i bordi), mescolata a un flusso lento
// dove la foto è piatta. Lungo quella direzione si integra (LIC) sia la foto
// (il colore steso) sia tre rumori (setole, corpo della pasta, fine della
// pennellata): l'altezza e la sua pendenza escono esatte dallo stesso giro.
import { P } from '../comune.js';

export const MATERIA = {
  id: 'impasto', code: 'Im', name: 'Impasto', family: 'dense', ref: 'Auerbach, Kossoff: la pittura materica',
  about: 'La foto diventa una lastra di colore a olio ancora fresco: lunghe pennellate spesse seguono le forme dell’immagine, rigate dalle setole, con creste dove il pennello si ferma e piani di spatola nelle zone calme, mentre la pasta viene lentamente ritirata e trascinata.',
  params: [
    P('materia', 'Materia', 0, 1, 0.95, 0.2),
    P('spessore', 'Spessore della pasta', 0, 2, 1, 0.3),
    P('lunghezza', 'Lunghezza delle pennellate', 30, 220, 110, 0.2),
    P('setole', 'Setole', 0, 1, 0.6, 0.3),
    P('spatola', 'Spatola', 0, 1, 0.4, 0.3),
    P('trascina', 'Trascinamento', 0, 1, 0.5, 0.4),
    P('velocita', 'Velocità', 0, 1, 0.2, 0.2),
    P('luce', 'Direzione delle ombre', 0, 360, 135, 0, { step: 1 }),
  ],
  glsl: `
// rumore a valori con la sua pendenza esatta: (valore, d/dx, d/dy)
vec3 imVN(vec2 p, float s) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
  float a = hash12(i + s), b = hash12(i + vec2(1.0, 0.0) + s);
  float c = hash12(i + vec2(0.0, 1.0) + s), d = hash12(i + 1.0 + s);
  float k = a - b - c + d;
  return vec3(a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y, du * (vec2(b - a, c - a) + k * u.yx));
}

// Rumore stirato lungo il tratto (fa = frequenza di traverso, fu = lungo il
// tratto), in un riferimento locale a piastrelle sfumate: la direzione cambia
// da punto a punto senza creare vortici lontano dall'origine.
// Restituisce (valore centrato ~[-1,1], pendenza in pixel a 1080).
vec3 imLay(vec2 X, vec2 dir, float Tz, float fa, float fu, float s) {
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 tq = X / Tz - 0.5, tc = floor(tq), tf = fract(tq);
  tf = tf * tf * (3.0 - 2.0 * tf);
  float bs = 0.0, w2 = 0.0; vec2 bg = vec2(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 c = tc + vec2(float(i), float(j));
    float w = (i == 0 ? 1.0 - tf.x : tf.x) * (j == 0 ? 1.0 - tf.y : tf.y);
    vec2 hh = hash22(c + s) * 97.0;
    vec2 Xl = X - (c + 0.5) * Tz;
    vec3 n = imVN(vec2(dot(Xl, perp) * fa + hh.x, dot(Xl, dir) * fu + hh.y), s);
    bs += w * (n.x - 0.5); w2 += w * w;
    bg += w * (perp * n.y * fa + dir * n.z * fu);
  }
  float rn = inversesqrt(max(w2, 1e-3)) * 2.6;
  return vec3(bs, bg) * rn;
}

// altezza della pasta dai campi: b = corpo, m = cordoni, e = fine del tratto
float imHf(float b, float m, float e, float kn) {
  float body = smoothstep(-0.9, 0.9, b);
  body = mix(body, 0.25 + 0.6 * smoothstep(-0.12, 0.12, b), kn);
  float cord = smoothstep(-0.8, 0.9, m) * (1.0 - 0.75 * kn);
  float lip = exp(-pow((e - 0.47) / 0.16, 2.0)) * smoothstep(0.7, 0.6, e);
  return body * 0.5 + cord * 0.3 + lip * 0.42;
}

vec3 fx(vec2 uv) {
  vec2 X = uv * u_res / K1080;           // pixel di un quadro alto 1080
  float z = ztime(velocita), Pz = period(velocita);
  float ph = TAU * ztime(velocita * 0.5);
  float sb = S(21.0), sr = S(25.0);
  vec3 c0 = IN(uv);
  // tensore di struttura: due anelli di 6 campioni
  vec2 g1 = vec2(0.0), g2 = vec2(0.0);
  vec3 cring = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    float an = float(i) * 1.0472 + 0.3;
    vec2 dr = vec2(cos(an), sin(an));
    vec3 cr = IN(uv + dr * 14.0 * K1080 * PX);
    cring += cr;
    g1 += dr * luma(cr);
    g2 += dr * luma(IN(uv + dr * 36.0 * K1080 * PX));
  }
  vec2 T = vec2(g1.x * g1.x - g1.y * g1.y, 2.0 * g1.x * g1.y) + 1.6 * vec2(g2.x * g2.x - g2.y * g2.y, 2.0 * g2.x * g2.y);
  float str = length(T);
  float edge = smoothstep(0.004, 0.06, str);
  // flusso lento dove la foto è calma: la pasta trascinata
  vec2 q = X / 460.0;
  float na = TAU * (gnoise(vec3(q, z), Pz) * 0.9 + 0.35 * gnoise(vec3(q * 2.3 + 5.0, z), Pz));
  vec2 tn = vec2(cos(2.0 * na), sin(2.0 * na));
  vec2 D = T / max(str, 1e-6) * edge + tn * (0.1 + 0.45 * trascina) * (1.0 - 0.85 * edge);
  float th = 0.5 * atan(D.y, D.x + 1e-6) + PI * 0.5;
  vec2 dir = vec2(cos(th), sin(th));
  // colore: la foto integrata lungo il tratto (LIC), un po' meno sui bordi forti
  float Lp = lunghezza * mix(1.0, 0.75, smoothstep(0.05, 0.3, str));
  float ds = Lp / 16.0;
  vec3 cref = mix(c0, cring / 6.0, 0.65);
  vec3 col = vec3(0.0); float ws = 0.0;
  for (int k = -8; k <= 8; k++) {
    float fk = float(k);
    // ogni passo un poco di lato, alternato: la pennellata assorbe i dettagli fini
    float side = (mod(fk, 2.0) < 0.5 ? 1.0 : -1.0) * (3.0 + 2.5 * abs(fract(fk * 0.37) - 0.5));
    vec3 cs = IN(uv + (dir * fk * ds + vec2(-dir.y, dir.x) * side) * K1080 * PX);
    vec3 dc = cs - cref;
    float w = max(exp(-dot(dc, dc) * 4.0), 0.6) * (1.0 - abs(fk) / 10.0);
    col += cs * w; ws += w;
  }
  col /= ws;
  // la pasta scivola avanti e indietro lungo il tratto, in ritardo da zona a zona
  float lag = gnoise(vec3(X / 380.0, 3.3), 0.0);
  vec2 Xn = X + dir * trascina * 22.0 * sin(ph + 5.0 * lag);
  float W = lunghezza * 0.2;             // larghezza del pennello
  float Tz = lunghezza * 0.9;
  vec3 Lb = imLay(Xn, dir, Tz, 1.0 / (W * 2.2), 1.0 / (lunghezza * 0.9), sb);
  vec3 Lm = imLay(Xn, dir, Tz, 1.0 / (W * 0.55), 1.0 / (lunghezza * 0.55), sb + 5.0);
  vec3 Le = imLay(Xn, dir, Tz, 1.0 / (W * 0.8), 1.0 / (lunghezza * 0.3), sb + 9.0);
  vec3 Lt = imLay(Xn, dir, Tz * 0.6, 1.0 / max(3.4, 2.4 / K1080), 1.0 / 60.0, sb + 13.0);
  float e = Le.x * 0.5 + 0.5;
  float kn = spatola * (1.0 - edge) * smoothstep(-0.2, 0.3, gnoise(vec3(X / 320.0, 7.7), 0.0));
  float H0 = imHf(Lb.x, Lm.x, e, kn);
  float de = 0.005;
  vec3 dH = (vec3(imHf(Lb.x + de, Lm.x, e, kn), imHf(Lb.x, Lm.x + de, e, kn), imHf(Lb.x, Lm.x, e + de, kn)) - H0) / de;
  float br = 0.2 * setole * (1.0 - 0.6 * kn);
  vec2 grad = dH.x * Lb.yz + dH.y * Lm.yz + dH.z * 0.5 * Le.yz + br * Lt.yz;
  grad /= 1.0 + 0.5 * length(grad) * spessore;
  // ogni pennellata un poco più piatta, con un suo tono
  float sid = floor(Lm.x * 2.0 + 0.5) + 7.0 * floor(e * 3.0);
  col *= 0.95 + 0.1 * hash12(vec2(sid, 1.0) + sr);
  float l = max(luma(col), 1e-3);
  float lq = (floor(l * 7.0) + smoothstep(0.25, 0.75, fract(l * 7.0))) / 7.0;
  col *= mix(1.0, lq / l, 0.3);
  // luce radente
  float hs = 12.0 * spessore;
  vec3 N = normalize(vec3(-grad * hs, 1.0));
  float la = radians(luce);
  vec2 l2d = vec2(cos(la), sin(la));
  vec3 Lv = normalize(vec3(l2d, 0.55));
  float lam = dot(N, Lv) / Lv.z;
  float shade = mix(0.45, 1.0, smoothstep(-0.5, 1.0, lam)) + 0.2 * smoothstep(1.0, 2.4, lam);
  // ombre portate corte: i campi, lisci, si prolungano verso la luce
  float sh = 0.0;
  vec3 dl = vec3(dot(Lb.yz, l2d), dot(Lm.yz, l2d), dot(Le.yz, l2d) * 0.5);
  for (int k = 1; k <= 3; k++) {
    float d = float(k) * 3.5;
    float hk = imHf(Lb.x + dl.x * d, Lm.x + dl.y * d, e + dl.z * d, kn);
    sh = max(sh, smoothstep(0.0, 1.5, (hk - H0) * hs - d * 0.55) * (1.0 - 0.2 * float(k)));
  }
  // cavità: fondo dei solchi e valli tra i cordoni
  float ao = setole * 0.4 * smoothstep(0.15, 1.2, -Lt.x) * (1.0 - 0.6 * kn) + 0.45 * clamp(0.45 - H0, 0.0, 1.0);
  float sp1 = min(spessore * 1.5, 1.0);
  shade *= 1.0 - 0.45 * sh * sp1;
  shade *= 1.0 - 0.5 * min(ao, 1.0) * sp1;
  // velo bagnato, largo e opaco, mai oltre il 9%
  vec3 Hh = normalize(Lv + vec3(0.0, 0.0, 1.0));
  float sp = pow(max(dot(N, Hh), 0.0), 8.0);
  // la pittura scura mostra il rilievo quanto la chiara
  float dark = 1.0 - smoothstep(0.06, 0.45, luma(col));
  float sv = (shade - 1.0) * mix(1.0, 1.9, dark);
  col = col * max(1.0 + sv, 0.25) * (1.0 + 0.09 * sp * H0);
  col += dark * 0.075 * clamp(shade - 0.8, 0.0, 0.4) * (0.5 + col);
  return clamp(mix(c0, col, materia), 0.0, 1.0);
}`,
};
