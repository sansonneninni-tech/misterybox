// Materie: acque e vetri. La foto vista attraverso l'acqua e il vetro che si
// muovono: specchi d'acqua, canali, gocce, condensa, schiuma, vetro antico.
// Niente luce aggiunta: tutto è rifrazione, riflesso e spessore della materia.
import { P } from './comune.js';

export const MATERIE = [
  // ------------------------------------------------------------------ pioggia
  {
    id: 'pioggia', code: 'Pi', name: 'Pioggia', family: 'acque', ref: 'Paul Clipson, Bill Viola',
    sim: `
vec4 sim(vec2 uv) {
  float asp = u_stRes.x / u_stRes.y;
  if (u_init > 0.5) {
    // qualche cerchio già caduto, perché l'acqua sia viva da subito
    float h0 = 0.0;
    for (int i = 0; i < 5; i++) {
      vec3 r = hash33(vec3(float(i) * 3.1, S(4.0), 1.7));
      vec2 dd = (uv - r.xy) * vec2(asp, 1.0);
      float rr = raggio * 0.011 * (0.6 + 0.8 * r.z);
      h0 -= 0.7 * exp(-dot(dd, dd) / (rr * rr));
    }
    return vec4(h0, h0, 0.0, 1.0);
  }
  vec4 c = ST(uv);
  vec2 e = SPX;
  float lap = ST(uv + vec2(e.x, 0.0)).x + ST(uv - vec2(e.x, 0.0)).x
            + ST(uv + vec2(0.0, e.y)).x + ST(uv - vec2(0.0, e.y)).x - 4.0 * c.x;
  // velocità in altezze di quadro per passo: uguale a ogni risoluzione dello stato
  float sp = velocita * 0.0029 * u_stRes.y;
  // il fondale: la foto scura è acqua profonda, le onde vi corrono più svelte
  float l = luma(IN(uv));
  sp *= mix(1.0, 1.25 - 0.6 * l, fondale);
  float C = min(0.45, sp * sp);
  float damp = mix(0.988, 0.9985, persistenza);
  float hn = (2.0 * c.x - c.y + C * lap) * damp;
  // le gocce: poche per fotogramma, sparse col seme
  if (u_step < 0.5) {
    for (int i = 0; i < 4; i++) {
      vec3 r = hash33(vec3(u_frame * 1.37 + 0.5, float(i) * 7.3, S(5.0)));
      if (r.z < gocce / (u_fps * 4.0)) {
        vec2 q = hash22(r.xy * 91.7 + S(6.0));
        vec2 dd = (uv - q) * vec2(asp, 1.0);
        float rr = raggio * 0.011 * (0.55 + 0.9 * r.x);
        hn -= 0.7 * exp(-dot(dd, dd) / (rr * rr));
      }
    }
  }
  return vec4(clamp(hn, -4.0, 4.0), c.x, 0.0, 1.0);
}`, steps: 4, simLong: 400, noloop: true,
    about: 'La foto è il fondo di uno specchio d’acqua su cui cade la pioggia: cerchi concentrici che si allargano e si incrociano piegano l’immagine; dove la foto è scura l’acqua è più profonda e le onde corrono diverse.',
    params: [
      P('gocce', 'Gocce al secondo', 0, 30, 9, 0.4),
      P('forza', 'Rifrazione', 0, 3, 1.2, 0.4),
      P('raggio', 'Grandezza goccia', 0.3, 3, 1, 0.2),
      P('persistenza', 'Persistenza', 0, 1, 0.5, 0.2),
      P('velocita', 'Velocità onde', 0.2, 2, 1, 0.15),
      P('fondale', 'Fondale dalla foto', 0, 1, 0.6, 0.2),
      P('rilievo', 'Rilievo', 0, 1, 0.35, 0.2),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  vec2 e = SPX;
  float hx = ST(uv + vec2(e.x, 0.0)).x - ST(uv - vec2(e.x, 0.0)).x;
  float hy = ST(uv + vec2(0.0, e.y)).x - ST(uv - vec2(0.0, e.y)).x;
  // pendenza per altezza di quadro
  vec2 g = vec2(hx, hy) * u_stRes.y * 0.5;
  vec2 d = g * forza * 0.0016 / vec2(ASPECT, 1.0);
  vec3 c = IN(uv - d);
  // spessore dell'acqua: le creste si scuriscono e le valli schiariscono appena
  float sl = dot(g, vec2(-0.6, 0.8)) * 0.012;
  c *= 1.0 + clamp(sl, -0.35, 0.35) * rilievo;
  return c;
}`,
  },
  // ------------------------------------------------------------------- canale
  {
    id: 'canale', code: 'Cn', name: 'Canale', family: 'acque', ref: 'Paul Clipson, riflessi nei canali',
    about: 'Sotto una linea d’orizzonte la foto si specchia capovolta nell’acqua di un canale: onde lunghe la spezzano in bande che tremano, l’acqua la scurisce e la raffredda.',
    params: [
      P('orizzonte', 'Orizzonte', 0.15, 0.85, 0.5, 0.1),
      P('frantumazione', 'Frantumazione', 0, 1, 0.5, 0.6),
      P('onde', 'Fittezza onde', 0.3, 3, 1, 0.2),
      P('velocita', 'Velocità', 0, 2, 0.35, 0.2),
      P('acqua', 'Acqua', 0, 1, 0.5, 0.2),
      P('morbidezza', 'Morbidezza', 0, 1, 0.35, 0.3),
      P('vento', 'Vento', 0, 1, 0.3, 0.5),
      P('quadro', 'Foto sopra', 0, 1, 0, 0, { step: 1, options: ['taglia', 'comprimi'] }),
    ],
    glsl: `
// altezza dell'acqua in coordinate del piano (x lungo la riva, y verso il fondo)
float cnWave(vec2 w, float z, float Pz, float T) {
  vec2 a = vec2(w.x * 0.22, w.y);
  float n = gnoise(vec3(a * 1.3, z), Pz) + 0.5 * gnoise(vec3(a * 2.9 + 5.1, z * 1.0 + 3.0), Pz);
  // onde lunghe, quasi parallele alla riva, che vengono verso chi guarda
  float sw = sin(w.y * 3.1 + n * 2.2 + TAU * T) + 0.45 * sin(w.y * 6.7 - w.x * 0.35 + n * 1.6 + TAU * 2.0 * T);
  return sw * 0.35 + n * 0.6;
}
vec3 fx(vec2 uv) {
  float hz = orizzonte;
  // sopra l'orizzonte: la foto (intera e compressa, oppure tagliata)
  vec2 top = quadro > 0.5 ? vec2(uv.x, (uv.y - hz) / (1.0 - hz)) : uv;
  if (uv.y >= hz) return IN(top);
  float dy = hz - uv.y;                       // distanza dall'orizzonte
  float z = ztime(velocita * 0.5), Pz = period(velocita * 0.5);
  float T = ztime(velocita);
  // prospettiva del piano d'acqua: vicino all'orizzonte le onde si stringono
  float dep = 1.0 / (dy + 0.035);
  vec2 w = vec2((uv.x - 0.5) * ASPECT * dep, dep) * 0.55 * onde;
  w.x += vento * 0.6 * z;
  float e = 0.04;
  float h0 = cnWave(w, z, Pz, T);
  float gx = (cnWave(w + vec2(e, 0.0), z, Pz, T) - h0) / e;
  float gy = (cnWave(w + vec2(0.0, e), z, Pz, T) - h0) / e;
  // lo spostamento sullo schermo cresce con la vicinanza: bande che tremano
  float fr = frantumazione * frantumazione;
  float amp = dy * (0.04 + 0.5 * fr) * (0.7 + 1.2 * dy);
  vec2 d = vec2(gx * (0.08 + 0.25 * vento) / ASPECT, gy) * amp * 0.35;
  // specchio capovolto
  float ry = hz + dy + d.y;
  vec2 q = vec2(uv.x + d.x, ry);
  if (quadro > 0.5) q.y = hz + (q.y - hz) / (1.0 - hz) * (1.0 - hz);
  vec3 c = vec3(0.0);
  float sm = morbidezza * dy * 0.06;
  for (int i = 0; i < 5; i++) {
    float k = float(i) / 4.0 - 0.5;
    vec2 qq = vec2(q.x, q.y + k * sm);
    if (quadro > 0.5) qq.y = (qq.y - hz) / (1.0 - hz);
    qq.y = qq.y > 1.0 ? 2.0 - qq.y : qq.y;
    c += IN(clamp(qq, 0.0, 1.0));
  }
  c /= 5.0;
  // l'acqua: scurisce e raffredda, di più verso chi guarda (si vede il fondo)
  float deep = clamp(dy / max(hz, 0.05), 0.0, 1.0);
  vec3 cold = mix(vec3(1.0), vec3(0.78, 0.87, 0.92), acqua);
  c *= cold * (1.0 - acqua * (0.18 + 0.32 * deep));
  // le facce delle onde girate verso il basso riflettono un po' meno
  c *= 1.0 - clamp(gy * 0.05, -0.12, 0.12) * acqua * (0.3 + fr);
  // la linea d'acqua
  float px = K1080 / u_res.y;
  c *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 3.0 * px, dy));
  return c;
}`,
  },
  // ------------------------------------------------------------------- goccia
  {
    id: 'goccia', code: 'Go', name: 'Goccia', family: 'acque', ref: 'Paul Clipson, macro',
    about: 'Gocce sul vetro davanti alla foto: ognuna è una piccola lente che la mostra capovolta, scivolano a scatti, si fondono e lasciano scie; dietro, la foto respira dentro e fuori fuoco.',
    params: [
      P('gocce', 'Quantità', 0, 1, 0.55, 0.2),
      P('grandezza', 'Grandezza', 0.4, 2.5, 1, 0.2),
      P('lente', 'Lente', 0, 1, 0.6, 0.3),
      P('velocita', 'Velocità', 0, 1, 0.25, 0.2),
      P('scie', 'Scie', 0, 1, 0.6, 0.3),
      P('sfocatura', 'Sfocatura dietro', 0, 1, 0.45, 0.4),
      P('respiro', 'Respiro del fuoco', 0, 1, 0.6, 0.4),
    ],
    glsl: `
// Una fila di gocce che scivolano: campo (metaball), spostamento di lente, scia.
void goLayer(vec2 p, float T, float cols, float sz, float dens, float sk, inout float fld, inout vec2 ofs, inout float tr) {
  float cw = 1.0 / cols, ch = cw * 2.6;
  vec2 id0 = floor(vec2(p.x / cw, p.y / ch));
  for (int j = 0; j < 2; j++) {
    vec2 id = id0 + vec2(0.0, float(j));
    vec3 n = hash33(vec3(id, S(11.0) + cols));
    if (n.x > dens) continue;
    float m = 1.0 + floor(hash12(id + S(12.0)) * 2.0);
    float ph = fract(T * m + n.y);
    // scivola a scatti: si ferma, riparte
    float yy = ph + 0.05 * sin(ph * TAU * 3.0 + n.z * 6.0);
    float top = (id.y + 1.0) * ch;
    float cy = top - yy * 2.0 * ch;
    float wob = 0.05 * cw * sin(cy * 23.0 / ch + n.z * 9.0);
    float cx = (id.x + 0.5) * cw + (n.z - 0.5) * 0.4 * cw + wob;
    float life = smoothstep(0.0, 0.12, ph) * (1.0 - smoothstep(0.78, 1.0, ph));
    float r = sz * cw * 0.26 * (0.7 + 0.6 * n.y) * (0.35 + 0.65 * life);
    vec2 dd = (p - vec2(cx, cy)) / vec2(r, r * (p.y < cy ? 0.9 : 1.15));
    float g = max(0.0, 1.0 - dot(dd, dd));
    fld += g * g;
    ofs += -(p - vec2(cx, cy)) * g;
    // la scia: dietro la goccia il vetro resta pulito e punteggiato di goccioline
    float ab = p.y - cy;
    if (ab > 0.0 && ab < top - cy + r && sk > 0.0) {
      float tx = (id.x + 0.5) * cw + (n.z - 0.5) * 0.4 * cw + 0.05 * cw * sin(p.y * 23.0 / ch + n.z * 9.0);
      float fade = 1.0 - smoothstep(0.0, 1.6 * ch, ab);
      tr = max(tr, smoothstep(r * 0.9, r * 0.35, abs(p.x - tx)) * fade * sk * life);
      float sp = r * 0.75;
      float k = floor(ab / sp);
      vec2 hk = hash22(vec2(k, n.z * 50.0) + id);
      if (hk.x < 0.7 && k > 0.5) {
        vec2 sc = vec2(tx + (hk.y - 0.5) * r * 0.3, cy + (k + 0.5) * sp);
        float sr = r * (0.18 + 0.18 * hk.y) * fade * sk;
        vec2 sd = (p - sc) / max(sr, 1e-5);
        float sg = max(0.0, 1.0 - dot(sd, sd));
        fld += sg * sg;
        ofs += -(p - sc) * sg;
      }
    }
  }
}
vec3 fx(vec2 uv) {
  vec2 p = uv * vec2(ASPECT, 1.0);
  float T = ztime(velocita);
  float fld = 0.0, tr = 0.0;
  vec2 ofs = vec2(0.0);
  float dens = gocce;
  goLayer(p, T, 3.6 / grandezza, 1.0, dens * 0.75, scie, fld, ofs, tr);
  goLayer(p + vec2(0.37, 0.11), T, 6.5 / grandezza, 0.8, dens * 0.9, scie, fld, ofs, tr);
  // goccioline ferme che si formano e svaniscono, assenti dove passa una scia
  {
    float cs = 0.05 * grandezza;
    vec2 id = floor(p / cs);
    vec3 n = hash33(vec3(id, S(13.0)));
    if (n.x < dens * 0.55) {
      float ph = fract(T + n.y);
      float life = sin(ph * PI);
      vec2 c = (id + 0.5 + (n.yz - 0.5) * 0.5) * cs;
      float r = cs * (0.12 + 0.2 * n.z) * life * (1.0 - tr);
      vec2 dd = (p - c) / max(r, 1e-5);
      float g = max(0.0, 1.0 - dot(dd, dd));
      fld += g * g; ofs += -(p - c) * g;
    }
  }
  // il vetro: dietro la foto respira dentro e fuori fuoco, a onda
  float wave = 0.5 + 0.5 * sin(TAU * (uv.x * 0.5 + uv.y * 0.3 - ztime(velocita * 0.6)));
  float R = sfocatura * 7.0 * K1080 * (1.0 - respiro * 0.85 * wave) * (1.0 - 0.75 * tr);
  vec3 bg = IN(uv) * 0.2;
  float wsum = 0.2;
  for (int i = 0; i < 12; i++) {
    float fi = float(i) + 0.5;
    float a = fi * 2.39996;
    vec2 o = vec2(cos(a), sin(a)) * sqrt(fi / 12.0) * R * PX;
    bg += IN(uv + o); wsum += 1.0;
  }
  bg /= wsum;
  // la goccia: lente che capovolge
  float m = smoothstep(0.2, 0.27, fld);
  float K = 1.4 + 1.6 * lente;
  vec2 q = uv + ofs * K / vec2(ASPECT, 1.0);
  vec3 dc = IN(clamp(q, 0.0, 1.0));
  dc = mix(dc, vec3(luma(dc)), 0.05) * 0.96;
  // bordo morbido più scuro solo sul lato in basso (luce dall'alto)
  float low = clamp(ofs.y / (length(ofs) + 1e-5), 0.0, 1.0);
  float rim = smoothstep(0.22, 0.3, fld) * (1.0 - smoothstep(0.3, 0.9, fld)) * low;
  vec3 c = mix(bg, dc, m);
  c *= 1.0 - 0.32 * rim;
  return c;
}`,
  },
  // ----------------------------------------------------------------- condensa
  {
    id: 'condensa', code: 'Co', name: 'Condensa', family: 'acque', ref: 'Bill Viola, il respiro',
    about: 'Un vetro appannato dal respiro: una nebbia di micro-gocce si forma e si ritira a ondate lente, e la foto riaffiora dove la condensa evapora, prima nelle sue zone chiare.',
    params: [
      P('densita', 'Densità', 0, 1, 0.45, 0.3),
      P('respiro', 'Respiro', 0, 1, 0.6, 0.5),
      P('velocita', 'Velocità', 0, 1, 0.2, 0.2),
      P('guida', 'Guida della foto', 0, 1, 0.6, 0.3),
      P('gocce', 'Grandezza gocce', 0.4, 2.5, 1, 0.2),
      P('latte', 'Lattiginoso', 0, 1, 0.5, 0.2),
      P('sfocatura', 'Sfocatura', 0, 1, 0.6, 0.3),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(ASPECT, 1.0);
  float z = ztime(velocita), Pz = period(velocita);
  float f = fbm(p * 1.5, z, Pz, 2);
  // il respiro: la condensa avanza e si ritira a ondate
  float br = sin(TAU * ztime(velocita * 0.75) + 0.8 * f + 0.6 * sin(p.x * 1.7 + p.y * 1.1));
  float v = f * 1.3 + (densita - 0.5) * 1.3 + br * respiro * 0.38;
  // il velo: la foto sfocata e lattiginosa dietro la condensa (raggio stimato prima della guida)
  float R = sfocatura * 46.0 * K1080 * smoothstep(-0.6, 0.15, v);
  vec3 bl = IN(uv) * 0.5;
  float ws = 0.5;
  float lp = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i) + 0.5;
    float a = fi * 2.39996;
    vec2 o = vec2(cos(a), sin(a)) * sqrt(fi / 8.0) * max(R, 12.0 * K1080) * PX;
    vec3 sm = IN(uv + o);
    bl += sm; ws += 1.0; lp += luma(sm);
  }
  bl /= ws;
  lp /= 8.0;
  // la foto guida: le sue zone chiare si asciugano per prime
  float fog = smoothstep(-0.2, 0.15, v - guida * (lp - 0.5) * 1.1);
  bl = mix(IN(uv), bl, smoothstep(0.0, 0.4, fog));
  vec3 milk = mix(bl, vec3(luma(bl)), 0.4 * latte) * (1.0 - 0.3 * latte) + vec3(0.3, 0.31, 0.32) * latte;
  // le micro-gocce: ognuna una lente minuscola che mostra la foto capovolta
  float cs = gocce * 20.0 / 1080.0;            // in altezze di quadro
  vec2 g = uv * vec2(ASPECT, 1.0) / cs;
  float dm = 0.0; vec2 dv = vec2(0.0); float dr = 1.0;
  for (int j = 0; j < 4; j++) {
    vec2 id = floor(g - 0.5) + vec2(float(j - (j / 2) * 2), float(j / 2));
    vec3 n = hash33(vec3(id, S(31.0)));
    // ai bordi della condensa le gocce si fanno più grosse
    float edge = 1.0 - abs(fog * 2.0 - 1.0);
    float r = (0.12 + 0.36 * n.z * n.z) * (0.5 + 0.7 * edge);
    vec2 c = id + 0.5 + (hash22(id * 1.7 + S(32.0)) - 0.5) * 0.7;
    vec2 d = (g - c) / r;
    float q = dot(d, d);
    if (q < 1.0 && n.y > 0.35 && 1.0 - q > dm) { dm = 1.0 - q; dv = d; dr = r; }
  }
  float drop = smoothstep(0.0, 0.3, dm) * smoothstep(0.05, 0.3, fog);
  vec3 lens = IN(uv - dv * dr * cs * 1.4 / vec2(ASPECT, 1.0));
  lens = mix(lens, milk, 0.25);
  float rim = (1.0 - smoothstep(0.0, 0.3, dm)) * step(0.0001, dm) * smoothstep(0.05, 0.3, fog) * (1.0 - 0.6 * fog);
  vec3 fogc = mix(milk, lens, drop * 0.85);
  fogc *= 1.0 - 0.07 * rim;
  vec3 c = mix(IN(uv), fogc, fog);
  return c;
}`,
  },
  // -------------------------------------------------------------------- bolle
  {
    id: 'bolle', code: 'Bo', name: 'Bolle', family: 'acque', ref: 'Brakhage, Youngblood',
    about: 'Una schiuma si raduna e si dirada sulla foto: bolle grandi e piccole negli interstizi, ognuna una lente sottile che ne ingrandisce un pezzo; respirano, scivolano, qualcuna scoppia e rinasce.',
    params: [
      P('misura', 'Misura bolle', 0.3, 2.5, 1, 0.2),
      P('lente', 'Lente', 0, 1, 0.75, 0.4),
      P('pareti', 'Pareti', 0, 1, 0.6, 0.2),
      P('respiro', 'Respiro', 0, 1, 0.5, 0.5),
      P('velocita', 'Velocità', 0, 1, 0.2, 0.2),
      P('scoppi', 'Scoppi', 0, 1, 0.3, 0.3),
      P('guida', 'Guida della foto', 0, 1, 0.6, 0.2),
    ],
    glsl: `
// Uno strato di bolle: cerchi che, dove la schiuma è fitta, si premono in poligoni.
// Restituisce (distanza dal bordo, distanza dal centro) e centro e raggio della bolla.
vec4 boLayer(vec2 p, float cs, float T, float D, float sd, out vec2 cc) {
  vec2 q = p / cs;
  vec2 ip = floor(q);
  float d1 = 9.0, d2 = 9.0, r1 = 0.0;
  cc = vec2(0.0);
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 id = ip + vec2(float(i), float(j));
    vec4 h = vec4(hash22(id + S(sd)), hash22(id + S(sd + 1.0) + 7.3));
    float m1 = 1.0 + floor(h.z * 2.0);
    vec2 c = id + 0.5 + 0.3 * vec2(sin(TAU * (T * m1 + h.x)), cos(TAU * (T + h.y)));
    // la bolla c'è dove la schiuma è abbastanza fitta; cresce con la densità
    float r = (0.42 + 0.3 * h.y) * smoothstep(h.x * 0.6, h.x * 0.6 + 0.35, D);
    r *= 1.0 + respiro * 0.16 * sin(TAU * (T * m1 + h.w));
    // lo scoppio: sparisce di colpo e rinasce piano
    if (h.w < scoppi * 0.5) r *= smoothstep(0.0, 0.6, fract(T * 0.5 * m1 + h.z * 3.7));
    if (r < 0.04) continue;
    float d = length(q - c) - r;
    if (d < d1) { d2 = d1; d1 = d; cc = c * cs; r1 = r * cs; }
    else if (d < d2) d2 = d;
  }
  // distanza dalla parete: dal cerchio libero o dalla parete premuta con la vicina
  float e = min(-d1, (d2 - d1) * 0.5) * cs;
  return vec4(e, length(p - cc), r1, d1);
}
vec3 fx(vec2 uv) {
  vec2 a = vec2(ASPECT, 1.0);
  vec2 p = (uv - 0.5) * a;
  float T = ztime(velocita);
  float z = ztime(velocita * 0.6), Pz = period(velocita * 0.6);
  // dove si raduna la schiuma: un campo lento, e la foto chiara la attira
  float lc = luma(IN(uv + vec2(0.02, 0.01))) * 0.5 + luma(IN(uv - vec2(0.015, 0.02))) * 0.5;
  float D = fbm(p * 1.3 + 3.0, z, Pz, 2) * 1.6 + 0.58 + guida * (lc - 0.5) * 0.8;
  float cs = misura * 0.13;
  vec3 base = IN(uv);
  vec3 c = base;
  float pw = (0.4 + 1.4 * pareti) / 1080.0;
  float done = 0.0;
  for (int L = 0; L < 2; L++) {
    float fl = float(L);
    float lcs = cs * (1.0 - 0.6 * fl);
    vec2 cc;
    vec4 b = boLayer(p, lcs, T * (1.0 + 0.3 * fl), D - fl * 0.12, 21.0 + fl * 5.0, cc);
    if (b.x > 0.0 && done < 0.5) {
      float qn = clamp(b.y / max(b.y + b.x, 1e-4), 0.0, 1.0);
      // la lente: ogni bolla ingrandisce il suo pezzo di foto
      vec2 cu = cc / a + 0.5;
      float zz = mix(1.0, mix(0.45, 1.3, qn * qn), lente);
      vec3 bc = IN(clamp(cu + (uv - cu) * zz, 0.0, 1.0));
      bc *= 1.0 - 0.18 * pow(qn, 3.0) * (0.3 + lente);
      // la parete: un velo sottile che piega la foto, appena più scuro, non una linea nera
      float wall = 1.0 - smoothstep(pw * 0.4, pw * 1.5, b.x);
      vec2 nrm = (uv - cu) * a / max(b.y, 1e-4);
      vec3 wc = IN(uv + nrm / a * pw * 3.0) * 0.7;
      bc = mix(bc, wc, wall * (0.45 + 0.4 * pareti));
      c = bc;
      done = 1.0;
    }
  }
  return c;
}`,
  },
  // -------------------------------------------------------------------- vetro
  {
    id: 'vetro', code: 'Ve', name: 'Vetro', family: 'acque', ref: 'Paul Clipson, vetro cattedrale',
    about: 'Una finestra di vetro antico colato a costolature irregolari che scorre piano: la foto si rompe in fusi ondulati, appena dispersi nei colori, e il fuoco passa sopra come un’onda.',
    params: [
      P('costole', 'Costolature', 2, 30, 6, 0.15),
      P('forza', 'Rifrazione', 0, 1, 0.6, 0.4),
      P('ondulazione', 'Ondulazione', 0, 1, 0.6, 0.4),
      P('velocita', 'Velocità', 0, 1, 0.15, 0.2),
      P('dispersione', 'Dispersione', 0, 1, 0.3, 0.3),
      P('fuoco', 'Onda di fuoco', 0, 1, 0.5, 0.4),
      P('semi', 'Bollicine', 0, 1, 0.35, 0.2),
      P('angolo', 'Inclinazione', -1, 1, 0, 0.1),
    ],
    glsl: `
// le costole: fusi irregolari, piegati da un flusso lento (rumore calcolato una volta)
vec3 fx(vec2 uv) {
  vec2 p = rot(angolo * 0.6) * ((uv - 0.5) * vec2(ASPECT, 1.0));
  float z = ztime(velocita), Pz = period(velocita);
  vec2 wq = vec2(p.x * 0.6, p.y * 0.65);
  float e = 0.03;
  float w0 = gnoise(vec3(wq, z), Pz);
  vec2 wg = vec2(gnoise(vec3(wq + vec2(e, 0.0), z), Pz) - w0, gnoise(vec3(wq + vec2(0.0, e), z), Pz) - w0) / e * vec2(0.6, 0.65);
  float A = ondulazione * (1.2 + costole * 0.22) * 0.5;
  float s0 = p.x * costole + sin(p.x * costole * 0.37 + 1.3) * 0.45 + w0 * A;
  vec2 gs = vec2(costole + cos(p.x * costole * 0.37 + 1.3) * 0.45 * costole * 0.37, 0.0) + wg * A;
  vec2 dir = gs / max(length(gs), 1e-4);
  float k = floor(s0), f = fract(s0);
  float rs = 0.6 + 0.8 * hash11(k + S(41.0));
  // ogni costola è una lente cilindrica: la foto vi scorre capovolta e stirata
  float wid = 1.0 / max(length(gs), 1e-3);
  float prof = (f - 0.5) * 2.0;
  float lensv = sin(f * TAU) * 0.5 + 0.12 * sin(f * 2.0 * TAU);
  float l = luma(IN(uv));
  float fz = forza * rs * (0.8 + 0.4 * (1.0 - l));
  vec2 off = vec2(dir.x, dir.y * 0.35) * lensv * min(wid, 0.3) * fz * 0.4;
  // grinze del vetro colato
  float zz = z * 1.3;
  float gr = gnoise(vec3(p * vec2(5.0, 2.0), zz), Pz * 1.3);
  off += vec2(gr, 0.4 * sin(gr * 5.0 + p.y * 3.0)) * 0.006 * forza;
  // bollicine d'aria imprigionate, stirate lungo le costole
  vec2 bp = vec2(dot(p, vec2(dir.y, -dir.x)) * 0.75, dot(p, dir)) * 30.0;
  vec2 bi = floor(bp);
  vec3 bh = hash33(vec3(bi, S(42.0)));
  float bub = 0.0;
  if (bh.x < semi * 0.12) {
    vec2 bd = (bp - bi - 0.5 - (bh.yz - 0.5) * 0.5) / (0.12 + 0.2 * bh.z);
    float bq = dot(bd, bd);
    if (bq < 1.0) { bub = 1.0 - bq; off += -(bd) * 0.004 * bub; }
  }
  off.x /= ASPECT;
  off = rot(-angolo * 0.6) * off;
  // il fuoco passa sopra come un'onda
  float fw = 0.5 + 0.5 * sin(TAU * (dot(p, vec2(0.55, 0.3)) * 0.8 - ztime(velocita * 0.8)) + 0.6 * w0 + 0.4 * sin(p.y * 2.3 + p.x * 1.1));
  float R = fuoco * 9.0 * K1080 * fw * fw;
  float da = dispersione * 0.06;
  // centro con la dispersione, poi quattro campioni sfocati
  vec3 c = vec3(IN(uv + off * (1.0 + da)).r, IN(uv + off).g, IN(uv + off * (1.0 - da)).b) * 2.0;
  for (int i = 0; i < 4; i++) {
    float a = float(i) * 1.5708 + 0.3;
    c += IN(uv + off + vec2(cos(a), sin(a)) * R * PX);
  }
  c /= 6.0;
  // spessore: le valli fra le costole sono più scure, le bollicine hanno un orlo
  c *= 1.0 - 0.1 * (0.5 - 0.5 * cos(f * TAU)) * (0.3 + forza) * (0.5 + 0.5 * pow(abs(prof), 4.0));
  c *= 1.0 - 0.3 * smoothstep(0.0, 0.25, bub) * (1.0 - smoothstep(0.25, 0.6, bub));
  return c;
}`,
  },
];
