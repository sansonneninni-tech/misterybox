// Materie: liquidi. La foto diventa il corpo di un fluido: metallo, olio,
// inchiostro, miele, cera, ferrofluido. Niente luce aggiunta: solo spessore,
// rifrazione e trasporto della materia.
import { P } from './comune.js';
import { MATERIA as ferrofluido } from './liquide/ferrofluido.js';

// Miele e cera usano lo stato della simulazione come mappa di trasporto: per
// ogni punto, lo scostamento (xy, in uv) verso il punto della foto da cui la
// materia è arrivata, più una grandezza libera (z). Il disegno legge poi la
// foto a piena risoluzione: lo stato è morbido, l'immagine resta nitida in 4K.

// Gradiente morbido della luminanza della foto: anello di 8 campioni.
const RING = `
vec3 ringL(vec2 uv, float rpx) {
  vec2 g = vec2(0.0); float m = 0.0;
  for (int i = 0; i < 8; i++) {
    float an = float(i) * 0.785398 + 0.39;
    vec2 dr = vec2(cos(an), sin(an));
    float l = luma(IN(uv + dr * rpx * PX));
    g += dr * l; m += l;
  }
  return vec3(g * 0.25, m * 0.125);
}`;

// Specchia ai bordi: la materia che arriva da fuori quadro non diventa strisce.
const MIR = `
vec2 mir(vec2 q) { return 1.0 - abs(1.0 - mod(q, 2.0)); }`;

export const MATERIE = [
  // ---------------------------------------------------------------- mercurio
  {
    id: 'mercurio', code: 'Hg', name: 'Mercurio', family: 'liquidi', ref: 'Youngblood, l’effetto oceanico',
    about: 'La foto diventa una pozza di metallo pesante: la luce dell’immagine è l’altezza, la superficie si gonfia e trema lenta, e la foto si legge nel metallo, riflessa e piegata.',
    params: [
      P('metallo', 'Metallo', 0, 1, 0.85, 0.2),
      P('rilievo', 'Rilievo dalla foto', 0, 2, 1, 0.4),
      P('onde', 'Onde', 0, 2, 0.8, 0.6),
      P('tremito', 'Tremito', 0, 1, 0.35, 0.6),
      P('densita', 'Densità', 0.4, 3, 1, 0.2),
      P('riflesso', 'Riflesso', 0, 1, 0.5, 0.4),
      P('colore', 'Colore della foto', 0, 1, 0.4, 0.2),
      P('velocita', 'Velocità', 0, 1, 0.18, 0.2),
    ],
    glsl: RING + `
float hgW(vec2 p, vec2 w, float z, float Pz) {
  return gnoise(vec3(p * 1.5 + w, z), Pz) * 0.65 + gnoise(vec3(p * 3.2 - w * 0.6 + 9.1, z * 2.0), Pz * 2.0) * 0.22;
}
float hgT(vec2 p, vec2 w, float tz) {
  float a1 = dot(p, vec2(0.8, 0.6)) * 21.0 + w.x * 4.0 - TAU * tz;
  float a2 = dot(p, vec2(-0.45, 0.89)) * 16.0 + w.y * 4.0 - TAU * tz;
  return (sin(a1) + sin(a2)) * 0.5;
}
vec3 fx(vec2 uv) {
  float z = ztime(velocita), Pz = period(velocita);
  float tz = ztime(velocita * 5.0);
  vec2 p = (uv - 0.5) * vec2(ASPECT, 1.0) * densita;
  // la foto come altezza: due anelli, la pozza è morbida e pesante
  float R = 12.0 * K1080 / densita;
  vec3 r1 = ringL(uv, R), r2 = ringL(uv, R * 2.4);
  vec2 gp = (r1.xy + r2.xy * 0.7) * rilievo * 1.6;
  float lp = (r1.z + r2.z) * 0.5;
  // gonfiore viscoso e tremito
  vec2 w = vec2(gnoise(vec3(p * 0.9, z), Pz), gnoise(vec3(p * 0.9 + 4.7, z), Pz)) * 0.9;
  float e = 0.03;
  float w0 = hgW(p, w, z, Pz);
  vec2 gw = vec2(hgW(p + vec2(e, 0.0), w, z, Pz) - w0, hgW(p + vec2(0.0, e), w, z, Pz) - w0) / e;
  float env = smoothstep(-0.15, 0.55, gnoise(vec3(p * 1.3 + 2.3, z), Pz));
  float t0 = hgT(p, w, tz);
  vec2 gt = vec2(hgT(p + vec2(0.01, 0.0), w, tz) - t0, hgT(p + vec2(0.0, 0.01), w, tz) - t0) / 0.01;
  vec2 g = gp + gw * onde * 0.3 + gt * tremito * env * 0.02;
  vec3 n = normalize(vec3(-g, 1.0));
  // la foto riflessa: velata e piegata dalle pendenze
  vec2 off = n.xy * (0.06 + 0.4 * riflesso);
  vec3 rf = IN(uv + off) * 0.5 + IN(uv + off * 1.6) * 0.3 + IN(uv + off * 0.6) * 0.2;
  float lr = luma(rf);
  vec3 tone = mix(vec3(lr), rf, colore) * vec3(1.0, 0.96, 0.9);
  // corpo del metallo: il tono della foto, poi la forma
  vec3 met = tone * 0.62 + vec3(lp) * vec3(0.27, 0.255, 0.235);
  float lam = dot(n, normalize(vec3(-0.4, 0.55, 0.73)));
  float slope = clamp(1.0 - n.z, 0.0, 1.0);
  met = 0.05 + met * 0.8;
  met *= mix(0.55, 1.12, clamp(lam * 0.5 + 0.5, 0.0, 1.0));
  met *= 1.0 - 0.5 * smoothstep(0.05, 0.45, slope);
  vec3 base = IN(uv + n.xy * 0.01);
  return clamp(mix(base, met, metallo), 0.0, 1.0);
}`,
  },
  // -------------------------------------------------------------------- olio
  {
    id: 'olio', code: 'Ol', name: 'Olio', family: 'liquidi', ref: 'Belson, “è il colore a definire le forme”',
    about: 'Una pellicola d’olio galleggia sulla foto: lo spessore segue l’immagine e una corrente lenta lo trascina; i colori d’interferenza sono ottone, bronzo e petrolio, e sotto la foto si piega.',
    params: [
      P('pellicola', 'Pellicola', 0, 1, 0.65, 0.3),
      P('spessore', 'Spessore', 0.2, 3, 1, 0.4),
      P('guida', 'Guida dalla foto', 0, 1, 0.45, 0.3),
      P('corrente', 'Corrente', 0, 3, 1.4, 0.5),
      P('scala', 'Scala', 0.3, 5, 2, 0.2),
      P('cromia', 'Cromia', 0, 1, 0.45, 0.3),
      P('piega', 'Rifrazione', 0, 1, 0.4, 0.5),
      P('velocita', 'Velocità', 0, 1, 0.1, 0.2),
    ],
    glsl: RING + `
// colori d'interferenza smorzati: un giro di ottone, bronzo, petrolio, salvia
vec3 olPal(float x) {
  x = fract(x) * 5.0;
  vec3 c0 = vec3(0.70, 0.58, 0.34), c1 = vec3(0.42, 0.27, 0.17), c2 = vec3(0.20, 0.24, 0.30);
  vec3 c3 = vec3(0.16, 0.36, 0.38), c4 = vec3(0.50, 0.54, 0.36);
  vec3 c = mix(c0, c1, smoothstep(0.0, 1.0, x));
  c = mix(c, c2, smoothstep(1.0, 2.0, x));
  c = mix(c, c3, smoothstep(2.0, 3.0, x));
  c = mix(c, c4, smoothstep(3.0, 4.0, x));
  return mix(c, c0, smoothstep(4.0, 5.0, x));
}
float olN(vec2 p, vec2 q, float z, float Pz) {
  return gnoise(vec3(p * 1.3 + corrente * q, z), Pz) * 0.7 + gnoise(vec3(p * 2.9 + corrente * q * 1.4 + 3.3, z * 2.0), Pz * 2.0) * 0.3;
}
vec3 fx(vec2 uv) {
  float z = ztime(velocita), Pz = period(velocita);
  vec2 p = (uv - 0.5) * vec2(ASPECT, 1.0) * scala;
  vec2 q = vec2(fbm(p, z, Pz, 2), fbm(p + vec2(5.2, 1.3), z, Pz, 2));
  float e = 0.03;
  float n0 = olN(p, q, z, Pz);
  vec2 gn = vec2(olN(p + vec2(e, 0.0), q, z, Pz) - n0, olN(p + vec2(0.0, e), q, z, Pz) - n0) / e;
  vec3 rl = ringL(uv, 20.0 * K1080);
  float d = spessore * (0.5 + 0.6 * n0 + guida * (rl.z - 0.45) * 1.5);
  vec2 g = (gn * 0.6 * scala + rl.xy * guida * 1.5) * spessore;
  // macchie: l'olio galleggia solo in alcune zone, la foto resta padrona
  float chiazza = fbm(p * 0.45 + q * 0.6 + 2.7, z, Pz, 3);
  vec3 base = IN(uv - g * piega * 0.004 * smoothstep(-0.2, 0.3, chiazza));
  float ph = d * 3.6 + length(q) * 0.25;
  vec3 film = olPal(ph);
  float lb = luma(base);
  float lf = luma(film);
  film = mix(vec3(lf) * vec3(1.02, 0.98, 0.9), film, cromia * (1.0 - 0.65 * smoothstep(0.35, 0.9, lb)));
  float cov = smoothstep(0.32 - 0.5 * pellicola, 0.5 - 0.5 * pellicola, chiazza);
  float a = pellicola * cov * smoothstep(-0.05, 0.3, d) * (0.5 + 0.5 * (1.0 - lb));
  // il film tinge la foto per rapporto, e sui neri si vede di più
  vec3 c = mix(base, base * film * 1.85, a * 0.85);
  c = mix(c, c + film * 0.35, a * (1.0 - lb) * 0.7);
  return clamp(c, 0.0, 1.0);
}`,
  },
  // --------------------------------------------------------------- inchiostro
  {
    id: 'inchiostro', code: 'In', name: 'Inchiostro', family: 'liquidi', ref: 'Brakhage, la chimica che crea forme',
    feedback: true, noloop: true, forze: 'trasporto', peso: 0,
    about: 'La foto si scioglie come inchiostro nell’acqua: i bordi rilasciano il pigmento, i vortici lo tirano in filamenti, e l’immagine continua a riaffiorare.',
    params: [
      P('vortici', 'Vortici', 0, 2, 1, 0.5),
      P('rilascio', 'Ritorno della foto', 0.005, 0.2, 0.03, 0.3),
      P('bordi', 'Corrente dai bordi', 0, 2, 0.8, 0.4),
      P('scala', 'Scala dei vortici', 0.5, 6, 2.4, 0.2),
      P('densita', 'Densità del pigmento', 0, 1, 0.45, 0.3),
      P('caduta', 'Caduta', -1, 1, 0.2, 0.3),
      P('diffusione', 'Diffusione', 0, 1, 0.25, 0.2),
      P('velocita', 'Velocità', 0, 2, 0.5, 0.2),
    ],
    glsl: RING + `
vec3 inkP(vec3 c) {
  // pigmento: un po' più denso e saturo della foto, mai nero
  float l = luma(c);
  vec3 s = mix(vec3(l), c, 1.0 + densita * 0.6);
  return clamp(mix(c, s * (0.6 + 0.4 * l) + 0.015, densita * 0.85), 0.0, 1.0);
}
vec3 fx(vec2 uv) {
  vec3 cur = IN(uv);
  if (u_frame < 0.5) return inkP(cur);
  vec2 a = vec2(ASPECT, 1.0);
  vec2 p = (uv - 0.5) * a * scala;
  float z = u_t * velocita * 0.2;
  float ee = 0.04;
  vec2 wp = p + 0.4 * vec2(gnoise(vec3(p * 0.5, z * 0.5 + 3.0), 0.0), gnoise(vec3(p * 0.5 + 7.0, z * 0.5), 0.0));
  float n0 = fbm(wp, z, 0.0, 3);
  float nx = fbm(wp + vec2(ee, 0.0), z, 0.0, 3);
  float ny = fbm(wp + vec2(0.0, ee), z, 0.0, 3);
  vec2 curl = vec2(ny - n0, -(nx - n0)) / ee;
  vec3 rl = ringL(uv, 9.0 * K1080);
  float edge = clamp(length(rl.xy) * 5.0, 0.0, 1.0);
  vec2 along = vec2(-rl.y, rl.x) * 5.0;
  vec2 vel = curl * vortici * 0.45 + along * bordi + GIU(vec2(0.0, -1.0)) * caduta * 0.5 * GRAVITA;
  vel *= 0.004 * (24.0 / max(u_fps, 1.0)) * (0.5 + velocita * 0.5);
  vel /= a;
  vec2 src = uv - vel;
  vec3 adv = FB(src);
  if (diffusione > 0.001) {
    vec2 b = PX * K1080 * 1.2;
    vec3 bl = (FB(src + vec2(b.x, 0.0)) + FB(src - vec2(b.x, 0.0)) + FB(src + vec2(0.0, b.y)) + FB(src - vec2(0.0, b.y))) * 0.25;
    adv = mix(adv, bl, diffusione * 0.35);
  }
  // il pigmento si rilascia soprattutto dai bordi, e piano ovunque
  float inj = rilascio * (0.4 + 1.4 * edge);
  return mix(adv, inkP(cur), clamp(inj, 0.0, 1.0));
}`,
  },
  // -------------------------------------------------------------------- miele
  {
    id: 'miele', code: 'Mi', name: 'Miele', family: 'liquidi', ref: 'Bill Viola, la lentezza',
    sim: true, steps: 2, simLong: 640, noloop: true, forze: 'mappa', peso: 0,
    about: 'La foto colata come miele denso: scende lenta in lobi e pieghe, e dove la materia è spessa i colori si scuriscono d’ambra.',
    params: [
      P('colata', 'Colata', 0, 2, 1, 0.4),
      P('ambra', 'Ambra', 0, 1, 0.5, 0.2),
      P('lobi', 'Lobi', 0.5, 6, 2.4, 0.2),
      P('pieghe', 'Pieghe', 0, 1, 0.5, 0.4),
      P('spessore', 'Spessore', 0, 2, 1, 0.3),
      P('ritorno', 'Ritorno della foto', 0, 1, 0.35, 0.3),
      P('guida', 'Guida dalla foto', 0, 1, 0.5, 0.3),
      P('direzione', 'Direzione', 0, 360, 270, 0, { step: 1 }),
    ],
    sim: MIR + `
vec4 sim(vec2 uv) {
  if (u_init > 0.5) return vec4(0.0);
  vec2 a = vec2(ASPECT, 1.0);
  float ang = radians(direzione);
  vec2 dir = GIU(vec2(cos(ang), sin(ang)));   // la direzione è rispetto alla gravità
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 p = (uv - 0.5) * a;
  float acr = dot(p, perp), alo = dot(p, dir);
  vec4 s = ST(uv);
  float lb = fbm(vec2(acr * lobi, alo * 0.6 + 3.0), u_t * 0.035, 0.0, 3);
  float lobe = smoothstep(-0.3, 0.45, lb);
  float l = luma(IN(mir(uv + s.xy)));
  float th = length(s.xy * a);
  float sp = colata * 0.0005 * (0.12 + lobe) * (1.0 + guida * (l - 0.5) * 1.4) * (1.0 + th * 15.0);
  sp *= 24.0 / max(u_fps, 1.0) * GRAVITA;
  // pieghe: il miele serpeggia di lato, lento e irregolare
  float fold = gnoise(vec3(acr * lobi * 2.5, alo * 5.0, u_t * 0.12 + 1.0), 0.0);
  vec2 v = dir * sp + perp * sp * pieghe * fold * 1.6;
  v /= a;
  vec4 o = ST(uv - v);
  vec2 d = o.xy - v;
  d *= 1.0 - ritorno * 0.005;
  return vec4(d, 0.0, 1.0);
}`,
    glsl: MIR + `
float miT(vec2 uv) {
  return length(ST(uv).xy * vec2(ASPECT, 1.0)) * 9.0 * spessore;
}
vec3 fx(vec2 uv) {
  vec2 d = ST(uv).xy;
  vec2 e = SPX * 1.5;
  float t0 = miT(uv);
  float tx = miT(uv + vec2(e.x, 0.0)) - miT(uv - vec2(e.x, 0.0));
  float ty = miT(uv + vec2(0.0, e.y)) - miT(uv - vec2(0.0, e.y));
  vec3 n = normalize(vec3(-tx * 2.2, -ty * 2.2, 1.0));
  float th = 1.0 - exp(-t0 * 0.9);
  // il corpo del miele piega la foto che porta
  vec3 col = IN(mir(uv + d + n.xy * 0.02 * spessore));
  // assorbimento: il blu muore per primo, poi il verde: ambra, non arancio
  vec3 k = vec3(0.12, 0.42, 1.05) * ambra;
  vec3 c = col * exp(-k * (th * 1.6 + 0.15));
  float lc = luma(c);
  c = mix(c, vec3(lc) * vec3(1.12, 0.92, 0.6), ambra * 0.25 * th);
  float lam = dot(n, normalize(vec3(-0.3, 0.6, 0.74)));
  c *= 0.9 + 0.22 * lam;
  c *= 1.0 - 0.3 * smoothstep(0.05, 0.5, 1.0 - n.z);
  return clamp(c, 0.0, 1.0);
}`,
  },
  // --------------------------------------------------------------------- cera
  {
    id: 'cera', code: 'Cr', name: 'Cera', family: 'liquidi', ref: 'Viola, l’emersione',
    sim: true, steps: 2, simLong: 640, noloop: true, forze: 'mappa', peso: 0,
    about: 'La foto come cera: le zone chiare fondono per prime e colano, poi si riaddensano; la superficie è traslucida, più morbida dove la cera è spessa.',
    params: [
      P('calore', 'Calore', 0, 1, 0.6, 0.4),
      P('colata', 'Colata', 0, 2, 1, 0.3),
      P('traslucenza', 'Traslucenza', 0, 1, 0.65, 0.3),
      P('cera', 'Corpo della cera', 0, 1, 0.75, 0.2),
      P('fronti', 'Fronti di calore', 0.3, 4, 1.4, 0.2),
      P('memoria', 'Memoria della forma', 0, 1, 0.5, 0.2),
      P('rilievo', 'Rilievo', 0, 2, 1, 0.3),
      P('tinta', 'Tinta della cera', 0, 1, 0.12, 0.2),
    ],
    sim: MIR + `
vec4 sim(vec2 uv) {
  if (u_init > 0.5) return vec4(0.0);
  vec2 a = vec2(ASPECT, 1.0);
  vec2 p = (uv - 0.5) * a;
  vec4 s = ST(uv);
  // la cera sente il calore in modo morbido: luce della foto sfumata
  vec2 bo = PX * K1080 * 10.0;
  vec2 su = uv + s.xy;
  float l = (luma(IN(mir(su))) * 2.0 + luma(IN(mir(su + vec2(bo.x, 0.0)))) + luma(IN(mir(su - vec2(bo.x, 0.0))))
    + luma(IN(mir(su + vec2(0.0, bo.y)))) + luma(IN(mir(su - vec2(0.0, bo.y))))) / 6.0;
  vec2 se = SPX * 2.5;
  vec4 nb = (ST(uv + vec2(se.x, 0.0)) + ST(uv - vec2(se.x, 0.0)) + ST(uv + vec2(0.0, se.y)) + ST(uv - vec2(0.0, se.y))) * 0.25;
  // fronti di calore lenti che salgono e passano
  float w = fbm(p * fronti + vec2(0.0, -u_t * 0.06), u_t * 0.05, 0.0, 3);
  float heat = l * 0.8 + w * 0.7 + (calore - 0.5) * 1.0;
  float target = smoothstep(0.3, 0.8, heat);
  float m = mix(s.z, nb.z, 0.5);
  m += (target - m) * (target > m ? 0.07 : 0.015);
  float lob = smoothstep(-0.35, 0.55, fbm(vec2(p.x * 1.7, p.y * 2.2 + 7.0) + 0.6 * vec2(gnoise(vec3(p * 3.1, 2.0), 0.0), 0.0), u_t * 0.03, 0.0, 3));
  float th = length(s.xy * a);
  float sp = colata * 0.0011 * m * m * (0.25 + lob) * (1.0 + th * 3.0) * (24.0 / max(u_fps, 1.0));
  vec2 v = GIU(vec2(gnoise(vec3(p * 2.2, u_t * 0.05), 0.0) * 0.6, -1.0)) * sp * GRAVITA / a;
  vec4 o = ST(uv - v);
  // la mappa si ammorbidisce: niente spigoli nei fronti di colata
  vec4 on = (ST(uv - v + vec2(se.x, 0.0)) + ST(uv - v - vec2(se.x, 0.0)) + ST(uv - v + vec2(0.0, se.y)) + ST(uv - v - vec2(0.0, se.y))) * 0.25;
  o = mix(o, on, 0.12 + 0.2 * m);
  vec2 d = o.xy - v;
  float mm = mix(m, o.z, 0.6);
  // la cera fredda si riaddensa e lentamente torna verso la forma della foto
  d *= 1.0 - (1.0 - memoria) * 0.008 * (1.0 - mm) - 0.0003;
  // la cera non viene da troppo lontano: oltre un certo tratto si ferma, morbida
  float dl = length(d * a);
  d *= 1.0 - 0.025 * smoothstep(0.09, 0.2, dl);
  return vec4(d, clamp(mm, 0.0, 1.0), 1.0);
}`,
    glsl: MIR + RING + `
float crH(vec4 s) { return length(s.xy * vec2(ASPECT, 1.0)) * 12.0 + s.z * 0.5; }
vec3 fx(vec2 uv) {
  vec4 s = ST(uv);
  vec2 d = s.xy;
  float m = s.z;
  vec2 e = SPX * 2.0;
  float h = crH(s);
  float hx = crH(ST(uv + vec2(e.x, 0.0))) - crH(ST(uv - vec2(e.x, 0.0)));
  float hy = crH(ST(uv + vec2(0.0, e.y))) - crH(ST(uv - vec2(0.0, e.y)));
  vec3 rl = ringL(mir(uv + d), 10.0 * K1080);
  vec3 n = normalize(vec3(-(hx * 0.6 + rl.x * 1.2) * rilievo, -(hy * 0.6 + rl.y * 1.2) * rilievo, 1.0));
  vec2 q = mir(uv + d + n.xy * 0.008 * rilievo);
  vec3 c0 = IN(q);
  // sottosuperficie: la luce si sparge dentro la cera, di più dove è spessa
  float thick = clamp(m * 0.8 + h * 0.5, 0.0, 1.0);
  float r = (3.0 + 24.0 * traslucenza * (0.25 + 0.75 * thick)) * K1080;
  vec3 acc = c0;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float an = fi * 2.39996 + 0.5;
    vec2 off = vec2(cos(an), sin(an)) * sqrt((fi + 0.5) / 12.0) * r * PX;
    acc += IN(mir(q + off));
  }
  vec3 sss = acc / 13.0;
  vec3 c = mix(c0, sss, clamp(traslucenza * (0.35 + 0.65 * thick), 0.0, 1.0));
  // corpo di cera: lattiginoso, meno saturo, caldo; i neri si aprono
  float lc = luma(c);
  vec3 wax = pigment(0.06 + lc * 0.25, tinta);
  vec3 body = mix(vec3(lc), c, 0.6) * 0.78 + wax * 0.26;
  body = mix(body, sqrt(max(body, 0.0)) * 0.9, 0.2);
  c = mix(c, body, cera * (0.55 + 0.45 * thick));
  float lam = dot(n, normalize(vec3(-0.3, 0.55, 0.78)));
  c *= 0.9 + 0.18 * lam;
  c *= 1.0 - 0.12 * smoothstep(0.05, 0.6, 1.0 - n.z);
  c = mix(c, c * 0.85 + vec3(0.1, 0.09, 0.075), cera * m * 0.6);
  return clamp(c, 0.0, 1.0);
}`,
  },
  // ferrofluido: liquido e spine simulati, nel suo file
  ferrofluido,
];
