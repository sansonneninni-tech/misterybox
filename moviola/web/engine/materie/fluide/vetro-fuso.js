// Materia fluida: vetro fuso. Una massa trasparente e spessa colata sopra la
// foto, come vetro di Murano o il fondo di una bottiglia: scorre lentissima,
// deforma ciò che ha dietro, si tinge dove è spessa e trattiene bolle d'aria.
//
// Stato della simulazione (morbido, lato lungo 640, uguale in anteprima e 4K):
//   xy = scostamento (in uv) verso il punto da cui è arrivato il vetro che ora
//        sta qui: serve a trascinare striature e bolle con la massa;
//   z  = spessore del vetro (0 = foto scoperta);
//   w  = libero.
// Lo spessore segue un film viscoso sotto il peso (flusso ∝ h³/viscosità) e
// viene nutrito dalla luminanza della foto. Il disegno, a piena risoluzione,
// ricava le normali dallo spessore più l'ondulazione e le striature, e fa:
// rifrazione con dispersione leggera, assorbimento che cresce con lo spessore,
// Fresnel sui bordi ripidi (riflette un ambiente scuro, mai un bagliore),
// caustiche scure e chiare dalla curvatura, bolle-lente con l'orlo scuro.
import { P } from '../comune.js';

const COMUNE = `
vec2 vfMir(vec2 q) { return 1.0 - abs(1.0 - mod(q, 2.0)); }
`;

export const MATERIA = {
  id: 'vetrofuso', code: 'Vf', name: 'Vetro fuso', family: 'fluide',
  ref: 'vetro di Murano colato, fondi di bottiglia',
  steps: 2, simLong: 640, noloop: true,
  about: 'Una massa di vetro spesso, ancora molle, colata sopra la foto: scorre lentissima, la deforma come un fondo di bottiglia, si tinge dove è più spessa e trattiene bolle d’aria che salgono piano o restano ferme. Pesante, non luminosa.',
  params: [
    P('spessore', 'Spessore', 0, 1, 0.6, 0.2),
    P('temperatura', 'Temperatura (quanto è molle)', 0, 1, 0.45, 0.3),
    P('viscosita', 'Viscosità', 0, 1, 0.6, 0.2),
    P('indice', 'Indice di rifrazione', 1.2, 2, 1.55, 0.2),
    P('dispersione', 'Dispersione dei colori', 0, 1, 0.3, 0.2),
    P('tinta', 'Tinta del vetro', 0, 4, 1, 0, { step: 1, options: ['chiaro', 'bottiglia', 'ambra', 'fumo', 'cobalto'] }),
    P('colore', 'Quanto si tinge', 0, 1, 0.4, 0.2),
    P('bolle', 'Bolle d’aria', 0, 1, 0.45, 0.2),
    P('grandezza', 'Grandezza delle bolle', 0, 1, 0.4, 0.2),
    P('salita', 'Salita delle bolle', 0, 1, 0.2, 0.2),
    P('ondulazione', 'Ondulazione della superficie', 0, 1, 0.4, 0.3),
    P('striature', 'Striature', 0, 1, 0.35, 0.3),
    P('guida', 'Forma dalla foto', 0, 1, 0.6, 0.2),
    P('colata', 'Direzione della colata', 0, 360, 270, 0, { step: 1 }),
  ],
  sim: COMUNE + `
// dove il vetro vuole stare: grosse gocce e lingue a contorno netto, più
// spesse sulle luci della foto (così i buchi cadono sui bui e non sembrano
// luci accese); fuori dalle gocce la foto resta scoperta
float vfTarget(vec2 uv, float t) {
  vec2 a = vec2(ASPECT, 1.0);
  vec2 p = (uv - 0.5) * a;
  vec2 b = vec2(6.0) / u_stRes;
  float l = (luma(IN(uv)) * 2.0 + luma(IN(vfMir(uv + vec2(b.x, 0.0)))) + luma(IN(vfMir(uv - vec2(b.x, 0.0))))
    + luma(IN(vfMir(uv + vec2(0.0, b.y)))) + luma(IN(vfMir(uv - vec2(0.0, b.y))))) / 6.0;
  vec2 w = vec2(fbm(p * 1.1 + S(8.0), t * 0.02, 0.0, 2), fbm(p * 1.1 + S(9.0), t * 0.02, 0.0, 2));
  float lobes = fbm(p * 1.3 + w * 0.8 + S(2.0), t * 0.03, 0.0, 3);
  float f = 0.42 + lobes * 1.25 + guida * (l - 0.45) * 0.9;
  return clamp(f, 0.0, 1.0) * mix(0.55, 1.0, spessore);
}
vec4 sim(vec2 uv) {
  if (u_init > 0.5) return vec4(0.0, 0.0, vfTarget(uv, 0.0), 0.0);
  vec2 a = vec2(ASPECT, 1.0);
  float dt = 24.0 / max(u_fps, 1.0);
  vec4 s = ST(uv);
  vec2 e = SPX;
  vec4 sE = ST(uv + vec2(e.x, 0.0)), sW = ST(uv - vec2(e.x, 0.0)), sN = ST(uv + vec2(0.0, e.y)), sS = ST(uv - vec2(0.0, e.y));
  vec2 gh = vec2(sE.z - sW.z, sN.z - sS.z) * 0.5 / e;         // per uv
  // film viscoso: il peso lo fa scendere (∝ h²), lo spessore si allarga
  // (∝ h³ · gradiente). Molle = caldo e poco viscoso.
  float mob = mix(0.15, 1.6, temperatura) * mix(1.8, 0.25, viscosita);
  float ca = radians(colata);
  vec2 g = vec2(cos(ca), sin(ca));
  float h = max(s.z, 0.0);
  vec2 v = (g * h * h * 2.4e-4 - gh * h * h * h * 6e-7) * mob;
  v = v / max(1.0, length(v) / 1.2e-3);
  v *= dt / a;
  // trasporto (semi-lagrangiano)
  vec4 o = ST(uv - v);
  float hn = o.z;
  // tensione superficiale: lo spessore si leviga, più se poco viscoso
  hn = mix(hn, (sE.z + sW.z + sN.z + sS.z) * 0.25, mix(0.08, 0.25, 1.0 - viscosita));
  // la foto continua a nutrire la massa, piano
  float tg = vfTarget(uv, u_t);
  hn += (tg - hn) * 0.006 * dt * (0.5 + temperatura);
  // scostamento: il vetro che sta qui viene da più indietro
  vec2 d = o.xy - v;
  return vec4(d, max(hn, 0.0), 0.0);
}`,
  glsl: COMUNE + `
#define VF_THR 0.3
vec4 vfBs(vec2 uv) {
  vec2 t = uv * u_stRes - 0.5;
  vec2 i = floor(t), f = fract(t);
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0, w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0, w2 = 1.0 - w0 - w1 - w3;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 a0 = (i + w1 / g0 - 0.5) / u_stRes, a1 = (i + w3 / g1 + 1.5) / u_stRes;
  return g0.y * (g0.x * ST(vec2(a0.x, a0.y)) + g1.x * ST(vec2(a1.x, a0.y)))
       + g1.y * (g0.x * ST(vec2(a0.x, a1.y)) + g1.x * ST(vec2(a1.x, a1.y)));
}
// altezza della superficie in px a 1080 (m = coordinate della materia, in px a
// 1080, che viaggiano con il vetro): menisco tondo sul bordo, cupole larghe
// dentro, la pelle che ondula piano, e le corde (striature) stirate dal flusso
float vfH(vec2 uv, vec2 m, float tt) {
  float T = vfBs(uv).z - VF_THR + 0.025 * gnoise(vec3(m / 90.0 + S(14.0), 0.5), 0.0);
  if (T <= 0.0) return 0.0;
  float A = 70.0 + 150.0 * spessore;
  float H = A * (1.0 - exp(-T / 0.06)) + A * 1.4 * T;
  float body = smoothstep(0.0, 0.1, T);
  float ond = ondulazione * (gnoise(vec3(m / 260.0 + S(3.0), tt * 0.25), 0.0) * 22.0 + gnoise(vec3(m / 150.0 + S(4.0), tt * 0.4), 0.0) * 2.0);
  // corde: lunghe, morbide, curve; un indice appena diverso dentro la massa
  vec2 mc = m + 60.0 * vec2(gnoise(vec3(m / 400.0 + S(5.0), 1.0), 0.0), gnoise(vec3(m / 400.0 + S(6.0), 2.0), 0.0));
  // le corde corrono lungo la colata
  float ca = radians(colata);
  vec2 al = vec2(cos(ca), sin(ca));
  vec2 mr = vec2(dot(mc, vec2(-al.y, al.x)), dot(mc, al));
  float cord = gnoise(vec3(mr.x / 75.0, mr.y / 520.0, S(7.0)), 0.0);
  float str = striature * cord * 7.0;
  return H + body * (ond + str);
}
// bolle d'aria nel vetro: rade, a nidi, quasi tutte piccole. Restituisce
// (orlo, dentro); in off lo spostamento dell'immagine vista attraverso
vec2 vfBolle(vec2 m, float cs, float sd, float amt, vec2 rise, out vec2 off) {
  off = vec2(0.0);
  vec2 q = m + rise;
  vec2 id = floor(q / cs);
  vec3 h = hash33(vec3(id, S(sd)));
  float nest = smoothstep(-0.15, 0.35, gnoise(vec3(id * cs / 500.0 + S(sd + 2.0), 3.0), 0.0));
  if (h.z > amt * nest) return vec2(0.0);
  vec2 hh = hash22(id + S(sd + 1.0));
  vec2 c = (id + 0.3 + 0.4 * h.xy) * cs;
  float r = cs * (0.05 + 0.3 * pow(hh.x, 3.0)) * mix(0.45, 1.5, grandezza);
  float el = 1.0 + 0.35 * hh.y;
  vec2 dd = (q - c) / vec2(r * el, r);
  float rr = dot(dd, dd);
  if (rr > 1.0) return vec2(0.0);
  float rad = sqrt(rr);
  // una bolla d'aria è una lente divergente: dentro l'immagine rimpicciolisce
  // e si capovolge; verso il bordo la riflessione totale la scurisce
  off = -(q - c) * (1.6 + 0.6 * hh.y);
  float rim = pow(smoothstep(0.3, 1.0, rad), 3.0);
  return vec2(rim, 1.0 - smoothstep(0.92, 1.0, rad));
}
vec3 vfTint() {
  if (tinta < 0.5) return vec3(0.10, 0.04, 0.08);
  if (tinta < 1.5) return vec3(0.85, 0.28, 0.70);
  if (tinta < 2.5) return vec3(0.16, 0.50, 1.25);
  if (tinta < 3.5) return vec3(0.62, 0.60, 0.55);
  return vec3(1.30, 0.90, 0.14);
}
vec3 fx(vec2 uv) {
  vec2 kpx = u_res / K1080;
  vec4 st = vfBs(uv);
  float tt = u_t * mix(0.15, 1.0, temperatura);
  vec2 m = (uv + st.xy) * kpx;
  float dl = 1.5;
  vec2 du = vec2(dl) / kpx;
  float H0 = vfH(uv, m, tt);
  float Hx = vfH(uv + vec2(du.x, 0.0), m + vec2(dl, 0.0), tt);
  float Hy = vfH(uv + vec2(0.0, du.y), m + vec2(0.0, dl), tt);
  float Hx2 = vfH(uv - vec2(du.x, 0.0), m - vec2(dl, 0.0), tt);
  float Hy2 = vfH(uv - vec2(0.0, du.y), m - vec2(0.0, dl), tt);
  if (max(max(H0, Hx), max(max(Hy, Hx2), Hy2)) <= 0.0) return IN(uv);
  vec2 gH = vec2(Hx - Hx2, Hy - Hy2) / (2.0 * dl);       // pendenza (px/px)
  vec3 n = normalize(vec3(-gH, 1.0));
  float glass = smoothstep(0.0, 2.0, H0);
  // curvatura larga: dove la massa fa lente raccoglie la luce, dove è concava la disperde
  float dc = 14.0;
  vec2 duc = vec2(dc) / kpx;
  float Hl = vfH(uv - vec2(duc.x, 0.0), m - vec2(dc, 0.0), tt) + vfH(uv + vec2(duc.x, 0.0), m + vec2(dc, 0.0), tt)
    + vfH(uv - vec2(0.0, duc.y), m - vec2(0.0, dc), tt) + vfH(uv + vec2(0.0, duc.y), m + vec2(0.0, dc), tt);
  float lap = (Hl - 4.0 * H0) / (dc * dc);

  // rifrazione di una lastra spessa: lo spostamento cresce con la pendenza e
  // con lo spessore; ogni colore piega un poco diverso (dispersione)
  float k = (1.0 - 1.0 / indice);
  vec2 dpx = gH * k * (18.0 + H0 * 0.45);
  dpx /= max(1.0, length(dpx) / 160.0);
  vec2 bo1, bo2;
  vec2 up = -vec2(cos(radians(colata)), sin(radians(colata)));
  float rise = salita * u_t * 22.0;
  vec2 B1 = vfBolle(m, 170.0, 11.0, bolle * 0.5, up * rise, bo1);
  vec2 B2 = vfBolle(m + 61.0, 64.0, 12.0, bolle * 0.38, up * rise * 0.6, bo2);
  vec2 bo = (bo1 * B1.y + bo2 * B2.y);
  vec2 q = uv + (-dpx + bo) / kpx;
  vec2 dd = dpx * dispersione * 0.07 / kpx;
  vec3 c;
  c.r = IN(vfMir(q + dd)).r;
  c.g = IN(vfMir(q)).g;
  c.b = IN(vfMir(q - dd)).b;
  float cau = clamp(1.0 - lap * 1.6, 0.78, 1.12);
  // la caustica non accende i chiari: schiarisce solo dove c'è margine
  cau = mix(1.0, cau, cau > 1.0 ? 1.0 - smoothstep(0.55, 0.9, luma(IN(vfMir(q)))) : 1.0);
  c *= mix(1.0, cau, glass);
  // il vetro spesso si tinge (Beer-Lambert); nelle bolle d'aria c'è meno vetro
  float air = max(B1.y, B2.y);
  float thick = H0 / 220.0 * (1.0 - 0.4 * air);
  c *= exp(-vfTint() * thick * (0.08 + 1.1 * colore));
  // Fresnel: sui fianchi ripidi il vetro riflette l'ambiente, che è buio
  float cosv = clamp(n.z, 0.0, 1.0);
  float r0 = pow((indice - 1.0) / (indice + 1.0), 2.0);
  float F = r0 + (1.0 - r0) * pow(1.0 - cosv, 5.0);
  vec3 env = vec3(0.035, 0.035, 0.04) + 0.12 * IN(vfMir(vec2(uv.x, 1.0 - uv.y) + n.xy * 0.25));
  c = mix(c, env, clamp(F * 1.3, 0.0, 0.8));
  c *= 1.0 - 0.45 * max(B1.x, B2.x);
  return mix(IN(uv), max(c, 0.0), glass);
}`,
};
