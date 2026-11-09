// Materie: corpi. Fumi, nuvole, pelli, stoffe, carte: l'immagine prende un corpo
// morbido che respira, si gonfia, si bagna, si sovrappone a sé stessa.
import { P } from './comune.js';

export const MATERIE = [
  // ------------------------------------------------------------------- fumo
  {
    id: 'fumo', code: 'Fu', name: 'Fumo', family: 'corpi', ref: 'Jordan Belson',
    steps: 2, simLong: 768, noloop: true,
    about: 'La foto si fa fumo: dalle sue luci (o dalle ombre) si staccano volute che salgono lente e si sciolgono; è il colore, non la linea, a definire le forme.',
    params: [
      P('fumo', 'Fumo', 0, 1, 0.75, 0.3),
      P('salita', 'Salita', 0, 2, 0.7, 0.3),
      P('volute', 'Volute', 0, 3, 1.4, 0.5),
      P('misura', 'Grandezza volute', 0.6, 6, 2.4, 0.2),
      P('dissolve', 'Dissolvenza', 0, 1, 0.35, 0.3),
      P('memoria', 'Memoria della foto', 0, 1, 0.3, 0.3),
      P('fonte', 'Nasce da', 0, 1, 0, 0, { step: 1, options: ['luci', 'ombre'] }),
    ],
    sim: `
vec2 fuVel(vec2 uv) {
  vec2 a = vec2(ASPECT, 1.0);
  vec2 p = uv * a * misura;
  float t = u_t * 0.22;
  p.y -= t * (0.4 + salita * 0.6);          // le forme salgono con il fumo
  float e = 0.04;
  float n0 = fbm(p, t, 0.0, 3);
  float nx = fbm(p + vec2(e, 0.0), t, 0.0, 3);
  float ny = fbm(p + vec2(0.0, e), t, 0.0, 3);
  vec2 curl = vec2(ny - n0, -(nx - n0)) / e;
  vec2 v = curl * volute * 0.0011 + vec2(0.0, salita * 0.0016);
  return v / a;
}
vec4 sim(vec2 uv) {
  vec3 img = IN(uv);
  float l = luma(img);
  float src = fonte < 0.5 ? l : 1.0 - l;
  float m = smoothstep(0.3, 0.85, src);
  if (u_init > 0.5) return vec4(img, m * 0.6);
  float dt = 24.0 / max(u_fps, 1.0);
  vec2 v = fuVel(uv) * dt;
  vec2 q = uv - v;
  vec2 e = SPX;
  vec4 c = ST(q);
  vec4 nb = 0.25 * (ST(q + vec2(e.x, 0.0)) + ST(q - vec2(e.x, 0.0)) + ST(q + vec2(0.0, e.y)) + ST(q - vec2(0.0, e.y)));
  c = mix(c, nb, 0.2);
  // emissione a sbuffi: la foto si stacca a chiazze che cambiano nel tempo
  vec2 pp = uv * vec2(ASPECT, 1.0) * misura * 1.3;
  float gate = smoothstep(-0.1, 0.35, fbm(pp + vec2(0.0, -u_t * 0.3), u_t * 0.4 + 9.0, 0.0, 2));
  float emit = m * gate;
  c.rgb = mix(c.rgb, img, clamp(emit * 0.06 + memoria * 0.012, 0.0, 1.0));
  c.a = c.a * (1.0 - dissolve * 0.012 * dt) + emit * 0.05 * (1.0 - c.a);
  return clamp(c, 0.0, 1.0);
}`,
    glsl: `
vec3 fx(vec2 uv) {
  vec4 s = ST(uv);
  vec3 img = IN(uv);
  vec2 e = SPX * 2.0;
  float dx = ST(uv + vec2(e.x, 0.0)).a - ST(uv - vec2(e.x, 0.0)).a;
  float dy = ST(uv + vec2(0.0, e.y)).a - ST(uv - vec2(0.0, e.y)).a;
  vec3 n = normalize(vec3(-dx * 3.0, -dy * 3.0, 1.0));
  float shade = 0.88 + 0.12 * dot(n, normalize(vec3(-0.3, 0.6, 0.75)));
  float d = smoothstep(0.02, 0.7, s.a) * fumo;
  // sotto il fumo la foto si vela appena, dentro il fumo resta il suo colore
  vec3 under = mix(img, vec3(luma(img)) * 0.9 + img * 0.1, d * 0.25) * (1.0 - d * 0.15);
  vec3 smoke = s.rgb * shade;
  return mix(under, smoke, d);
}`,
  },

  // ----------------------------------------------------------------- nuvola
  {
    id: 'nuvola', code: 'Nu', name: 'Nuvola', family: 'corpi', ref: 'Jordan Belson, immagini gassose',
    about: 'La foto come volume di gas: le sue luci si gonfiano in una nuvola spessa, colorata dalla foto, che si rimescola lentamente su sé stessa.',
    params: [
      P('densita', 'Densità', 0.2, 3, 1.5, 0.3),
      P('spessore', 'Spessore dalla foto', 0, 1, 0.75, 0.3),
      P('misura', 'Grandezza', 0.5, 6, 3.2, 0.2),
      P('sfrangia', 'Sfrangiatura', 0, 1, 0.8, 0.4),
      P('rimescola', 'Rimescolio', 0, 1, 0.35, 0.2),
      P('ombra', 'Ombra interna', 0, 1, 0.65, 0.3),
      P('fondo', 'Fondo', 0, 1, 0.9, 0.2),
      P('sole', 'Direzione delle ombre', 0, 1, 0.15, 0.1),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  vec2 a = vec2(ASPECT, 1.0);
  float z = ztime(rimescola * 0.3), Pz = period(rimescola * 0.3);
  // luminanza morbida della foto: dove è chiara la nuvola è spessa
  vec2 r = 9.0 * K1080 * PX;
  vec3 img = IN(uv);
  // colore del gas: la foto sciolta (spirale di campioni)
  vec3 cb = img;
  for (int j = 0; j < 7; j++) {
    float fj = float(j) + 1.0;
    vec2 o = vec2(cos(fj * 2.39996), sin(fj * 2.39996)) * sqrt(fj / 7.0) * 2.2;
    cb += IN(uv + o * r);
  }
  cb /= 8.0;
  float lb = luma(cb);
  float H = mix(0.6, 0.12 + 0.88 * lb, spessore);
  vec2 p = (uv - 0.5) * a * misura;
  float ang = (sole + 0.125) * TAU;
  vec3 L = normalize(vec3(cos(ang), sin(ang), 0.6));
  float T = 1.0;
  vec3 acc = vec3(0.0);
  const int N = 7;
  float dz = 1.0 / float(N);
  for (int i = 0; i < N; i++) {
    float zz = (float(i) + 0.5) * dz;
    vec3 q = vec3(p, zz * 1.3 + z);
    float n1 = gnoise(q, Pz);
    float n = 0.6 * n1 + 0.3 * gnoise(vec3(q.xy * mat2(0.8, -0.6, 0.6, 0.8) * 2.03 + 7.1, q.z * 2.0), Pz * 2.0);
    float shape = H * 0.5 - abs(zz - 0.5);
    float rho = smoothstep(-0.12, 0.45, (shape * 1.6 + n * sfrangia * 1.6 - 0.24) * densita);
    if (rho > 0.003) {
      // ombra propria: quanto gas c'è tra questo punto e la luce
      vec3 ql = q + L * 0.22;
      float zl = zz + L.z * 0.12;
      float n2 = gnoise(ql, Pz);
      float occ = smoothstep(0.0, 0.4, ((H * 0.5 - abs(zl - 0.5)) * 1.6 + n2 * 0.6 * sfrangia * 1.6 - 0.2) * densita);
      float lit = mix(1.0, 0.3 + 0.7 * exp(-occ * 2.4), ombra);
      vec3 cs = cb * (0.36 + 0.7 * lit);
      float aT = 1.0 - exp(-rho * dz * 6.5);
      acc += T * aT * cs;
      T *= 1.0 - aT;
    }
    if (T < 0.03) break;
  }
  vec3 back = mix(cb, img, 0.6) * fondo;
  return acc + T * back;
}`,
  },


  // ------------------------------------------------------------------- pelle
  {
    id: 'pelle', code: 'Pe', name: 'Pelle', family: 'corpi', ref: 'Tessuti, superfici del corpo',
    about: 'La foto diventa pelle che respira: una grana di piccoli rilievi e pori si tende e si rilassa, pieghe morbide corrono parallele ai bordi dell’immagine, la foto è il pigmento.',
    params: [
      P('pieghe', 'Pieghe', 0, 1, 0.6, 0.3),
      P('pori', 'Pori', 0, 1, 0.55, 0.2),
      P('respiro', 'Respiro', 0, 1, 0.6, 0.3),
      P('ritmo', 'Ritmo del respiro', 0.05, 0.6, 0.25, 0.1),
      P('rilievo', 'Rilievo', 0, 2, 1.0, 0.3),
      P('grana', 'Finezza', 0.5, 3, 1.0, 0.1),
      P('carne', 'Carne', 0, 1, 0.35, 0.2),
    ],
    glsl: `
// luminanza molto morbida: da qui nascono le pieghe
float peLb(vec2 uv) {
  vec2 r = 30.0 * K1080 * PX;
  float s = luma(IN(uv));
  for (int j = 0; j < 6; j++) {
    float a = (float(j) + 0.5) * 1.0472;
    s += luma(IN(uv + vec2(cos(a), sin(a)) * r));
  }
  return s / 7.0;
}
// piccole cupole separate da solchi morbidi, con qualche poro
float peCell(vec2 p, float br, float pw) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0, pr = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 h = hash22(i + g + S(4.0));
    vec2 o = g + 0.5 + 0.4 * sin(TAU * h + br * 0.4);
    float d = length(o - f);
    if (d < d1) { d2 = d1; d1 = d; pr = h.x; } else if (d < d2) d2 = d;
  }
  float dome = smoothstep(0.0, 0.42, d2 - d1);
  float pore = (1.0 - smoothstep(0.04, 0.16, d1)) * step(0.62, pr);
  return dome - pore * pw;
}
float peMicro(vec2 uv, float br, float lb) {
  vec2 p = uv * u_res / (K1080 * 34.0) * grana * mix(1.25, 0.85, lb);
  p *= 1.0 - 0.025 * br;               // il respiro tende la pelle
  float h = peCell(p, br, pori * 1.4) * (1.0 - 0.4 * br);
  return h * mix(1.25, 0.6, lb);
}
vec3 fx(vec2 uv) {
  float ph = fbm(uv * vec2(ASPECT, 1.0) * 1.2, 3.0, 0.0, 2) * 1.5;
  float b = 0.5 + 0.5 * sin(TAU * ztime(ritmo) + ph);
  float br = b * respiro;
  // gonfiore del respiro: la foto si solleva e si ritira
  vec2 gs = vec2(fbm(uv * 2.0, 1.0, 0.0, 2), fbm(uv * 2.0 + 4.0, 1.0, 0.0, 2));
  vec2 q = uv + gs * 0.014 * br;
  // pieghe: linee di livello della foto ammorbidita, parallele ai suoi bordi
  vec2 ef = vec2(5.0 * K1080) * PX;
  float l0 = peLb(q), lx = peLb(q + vec2(ef.x, 0.0)), ly = peLb(q + vec2(0.0, ef.y));
  vec2 gl = vec2(lx - l0, ly - l0) / 5.0;          // per pixel a 1080
  // profilo della piega: solco stretto tra due dossi larghi
  float N = 2.2, ph0 = br * 0.22 + 0.3;
  float f0 = pow(0.5 + 0.5 * cos(TAU * (l0 * N + ph0)), 4.0);
  float fx_ = pow(0.5 + 0.5 * cos(TAU * (lx * N + ph0)), 4.0);
  float fy_ = pow(0.5 + 0.5 * cos(TAU * (ly * N + ph0)), 4.0);
  float gmag = length(gl);
  float near = smoothstep(0.0006, 0.004, gmag);
  vec2 gf = -vec2(fx_ - f0, fy_ - f0) / 5.0 * 16.0 / (1.0 + gmag * 25.0) * pieghe * (1.0 - 0.35 * br) * min(rilievo, 1.4);
  // micro-rilievo, in pixel reali
  vec2 e = vec2(2.0 * K1080) * PX;
  float m0 = peMicro(q, br, l0), mx = peMicro(q + vec2(e.x, 0.0), br, l0), my = peMicro(q + vec2(0.0, e.y), br, l0);
  vec2 gm = vec2(mx - m0, my - m0) * rilievo * 0.7;
  vec2 grad = gm + gf * near;
  vec3 n = normalize(vec3(-grad, 1.0));
  vec3 Ld = normalize(vec3(-0.45, 0.55, 0.7));
  float dif = dot(n, Ld) - dot(vec3(0.0, 0.0, 1.0), Ld);
  vec3 img = IN(q);
  // pigmento: la foto; nei solchi il colore si fa carne, non nero
  vec3 flesh = mix(img, img * vec3(1.05, 0.88, 0.8) + vec3(0.03, 0.012, 0.0), carne);
  float cav = clamp(-dif * 2.0, 0.0, 1.0) + (1.0 - m0) * 0.25 * rilievo;
  vec3 col = flesh * (1.0 + 0.6 * dif);
  col = mix(col, col * vec3(0.82, 0.64, 0.58), clamp(cav, 0.0, 1.0) * (0.15 + 0.45 * carne));
  return col;
}`,
  },



  // -------------------------------------------------------------------- seta
  {
    id: 'seta', code: 'Se', name: 'Seta', family: 'corpi', ref: 'Drappi al vento',
    about: 'La foto stampata su un drappo di seta che ondeggia al vento: pieghe di larghezze diverse scorrono in diagonale, la stampa si piega con loro e le valli si fanno ombra. Nessuna luce aggiunta: solo ombra e deformazione.',
    params: [
      P('onde', 'Pieghe', 0, 1, 0.6, 0.4),
      P('misura', 'Larghezza pieghe', 0.5, 6, 3.4, 0.2),
      P('vento', 'Vento', 0, 2, 0.5, 0.3),
      P('direzione', 'Direzione', 0, 1, 0.3, 0.1),
      P('trascina', 'Stampa che segue', 0, 1, 0.5, 0.3),
      P('ombra', 'Ombre', 0, 1, 0.8, 0.2),
      P('lucentezza', 'Riflesso opaco', 0, 1, 0.3, 0.2),
      P('trama', 'Trama', 0, 1, 0.15, 0.1),
    ],
    glsl: `
float seH(vec2 p, float z, float Pz) {
  // la frequenza cambia da punto a punto: pieghe larghe e strette insieme
  float w = fbm(p * 0.22 + vec2(0.0, z * 0.3), z, Pz, 3);
  float w2 = fbm(p * 0.5 + vec2(3.7, 1.1), z * 1.3 + 2.0, Pz, 2);
  float t1 = TAU * ztime(vento * 0.3), t2 = TAU * ztime(vento * 0.19), t3 = TAU * ztime(vento * 0.45);
  float ph = p.x * 2.0 + w * 4.0 + w2 * 1.2;
  float s1 = sin(ph - t1);
  float s2 = sin(p.x * 3.7 + p.y * 1.1 + w * 3.0 - t3 + 1.3);
  float s3 = sin(p.x * 0.9 - p.y * 0.8 + w * 2.0 - t2 + 4.0);
  // creste più strette delle valli, come una stoffa che ricade
  return 0.6 * (s1 - 0.3 * s1 * s1) + 0.22 * s2 * (0.6 + 0.8 * w2) + 0.35 * s3;
}
vec3 fx(vec2 uv) {
  vec2 a = vec2(ASPECT, 1.0);
  mat2 R = rot(direzione * PI);
  vec2 p = R * ((uv - 0.5) * a) * misura * 2.0;
  float z = ztime(vento * 0.12), Pz = period(vento * 0.12);
  float e = 0.02;
  float h0 = seH(p, z, Pz);
  float hx = seH(p + vec2(e, 0.0), z, Pz), hy = seH(p + vec2(0.0, e), z, Pz);
  vec2 g = vec2(hx - h0, hy - h0) / e;           // nello spazio del drappo
  vec2 gs = (transpose(R) * g) / a;              // nello spazio della foto
  float amp = onde;
  // la stampa segue la stoffa: si comprime e si stira sui fianchi delle pieghe
  vec2 q = uv - gs * amp * trascina * 0.12 / misura;
  vec3 img = IN(q);
  vec3 n = normalize(vec3(-gs * amp * 1.4 / misura, 1.0));
  vec3 Ld = normalize(vec3(-0.35, 0.55, 0.75));
  // solo ombra: il fianco che volta le spalle alla luce e il fondo delle valli
  float turn = max(Ld.z - dot(n, Ld), 0.0);
  float valley = 1.0 - smoothstep(-1.0, 0.7, h0);
  float dark = clamp(turn * 1.5 + valley * 0.35, 0.0, 0.6);
  // lucentezza della seta: lungo i fili l'ombra non si chiude del tutto
  vec3 T = vec3(transpose(R) * vec2(0.0, 1.0), 0.0);
  T = normalize(T - n * dot(T, n) + 1e-4);
  float th = dot(T, normalize(Ld + vec3(0.0, 0.0, 1.0)));
  float sheen = pow(clamp(1.0 - th * th, 0.0, 1.0), 8.0);
  dark *= 1.0 - sheen * lucentezza * 0.5;
  float k = ombra * clamp(amp * 1.6, 0.0, 1.0);
  vec3 col = img * (1.0 - dark * k);
  // nell'ombra la seta trattiene un po' di colore, non diventa grigia
  col = mix(col, col * normalize(img + 0.02) * 1.732, dark * k * 0.25);
  col = min(col, img);
  // trama: fili finissimi, quasi invisibili
  vec2 tp = (R * (uv * u_res)) / (K1080 * 2.4);
  float wv = 0.5 + 0.25 * (sin(tp.x * PI) + sin(tp.y * PI));
  col *= 1.0 - trama * 0.1 * wv;
  return col;
}`,
  },


  // ------------------------------------------------------------------- carta
  {
    id: 'carta', code: 'Cb', name: 'Carta bagnata', family: 'corpi', ref: 'Acquerello, cerchio di caffè',
    steps: 4, simLong: 768, noloop: true,
    about: 'Carta bagnata che beve la foto: l’acqua avanza nelle fibre con un fronte frastagliato, dove arriva i colori si allargano come acquerello e sul bordo si deposita il pigmento; poi asciuga.',
    params: [
      P('acqua', 'Acqua', 0, 1, 0.55, 0.2),
      P('capillare', 'Capillarità', 0.2, 2, 1, 0.2),
      P('espansione', 'Espansione del colore', 0, 1, 0.65, 0.3),
      P('bordo', 'Bordo di pigmento', 0, 1, 0.55, 0.2),
      P('fibre', 'Fibre', 0, 1, 0.6, 0.1),
      P('asciuga', 'Asciugatura', 0, 1, 0.4, 0.2),
      P('grana', 'Grana della carta', 0, 1, 0.4, 0.1),
    ],
    sim: `
float cbFib(vec2 uv) {
  vec2 p = uv * vec2(ASPECT, 1.0);
  p = vec2(p.x * 7.0, p.y * 70.0);
  return 0.5 + 0.7 * fbm(p + S(7.0), 2.0, 0.0, 2);
}
vec4 sim(vec2 uv) {
  vec3 img = IN(uv);
  vec2 a = vec2(ASPECT, 1.0);
  if (u_init > 0.5) {
    // alcune gocce posate sulla foto, più grandi nelle zone scure
    float w = 0.0;
    float nd = 2.0 + floor(acqua * 4.0 + 0.5);
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      if (fi >= nd) break;
      vec2 c = 0.12 + 0.76 * hash22(vec2(fi, S(8.0)));
      float rr = 0.03 + 0.05 * hash11(fi + S(9.0)) * (0.5 + acqua);
      vec2 d = (uv - c) * a;
      float wob = 1.0 + 0.35 * fbm(d * 9.0 + fi * 3.0, 1.0, 0.0, 2);
      w = max(w, 1.0 - smoothstep(rr * 0.85, rr, length(d) / wob));
    }
    return vec4(img, w);
  }
  vec2 e = SPX;
  vec4 c = ST(uv);
  float fib = clamp(cbFib(uv), 0.0, 1.0);
  float g = hash13(vec3(uv * u_stRes, u_frame * 4.0 + u_step + S(9.0)));
  float g2 = hash13(vec3(uv * u_stRes + 17.0, u_frame * 4.0 + u_step));
  vec4 cl = ST(uv - vec2(e.x, 0.0)), cr = ST(uv + vec2(e.x, 0.0));
  vec4 cd = ST(uv - vec2(0.0, e.y)), cu = ST(uv + vec2(0.0, e.y));
  // capillarità: lungo le fibre (orizzontali) l'acqua corre di più, e si ferma
  // dove le fibre sono rade; il fronte esce frastagliato
  float rs = max(u_stRes.x, u_stRes.y) / 768.0;      // stato più piccolo: passi più lunghi
  // conducibilità a chiazze: il fronte si ferma prima dove la carta beve meno
  vec2 pa2 = uv * vec2(ASPECT, 1.0);
  float cn = fbm(pa2 * 7.0 + S(10.0), 4.0, 0.0, 2) + 0.4 * gnoise(vec3(pa2 * 26.0, 5.0), 0.0);
  float cond = (0.15 + 0.85 * smoothstep(-0.35, 0.35, cn)) * mix(1.0, 0.4 + 0.8 * fib, fibre);
  // ogni fibra beve a modo suo: il bordo si sfrangia lungo le fibre
  float hp = hash12(floor(uv * u_stRes * vec2(0.5, 2.0)) + S(11.0));
  float k = pow(mix(0.992, 0.998, acqua) * mix(0.955, 1.0, cond) * mix(1.0, 0.975 + 0.03 * fib, fibre) * (1.0 - 0.006 * hp), 1.0 / rs);
  float spd = 0.52 * capillare * (0.75 + 0.5 * (1.0 - luma(img))) * cond * rs;
  float pa = spd * mix(1.0, 0.5 + 1.0 * fib, fibre);
  float pb = spd * mix(1.0, 0.25 + 0.5 * fib, fibre);
  float k2 = k * k * 0.99;
  float pd = 0.5 * (pa + pb);
  float g3 = hash13(vec3(uv * u_stRes + 41.0, u_frame * 4.0 + u_step));
  float dg = max(max(ST(uv + e).a, ST(uv - e).a), max(ST(uv + vec2(e.x, -e.y)).a, ST(uv + vec2(-e.x, e.y)).a));
  float spread = max(max(max(cl.a, cr.a) * k * step(g, pa), max(cd.a, cu.a) * k * step(g2, pb)), dg * k2 * step(g3, pd));
  spread *= step(0.03, spread);   // sotto questa soglia l'acqua non avanza più
  float w = max(c.a, spread);
  // evapora, prima ai bordi
  float dry = asciuga * 0.0018 * smoothstep(2.0, 4.0, u_t) / rs;
  w = max(w - dry, 0.0);
  float wet = step(0.001, w);
  // il colore si allarga nella carta bagnata e scorre verso il bordo
  vec2 gw = vec2(cr.a - cl.a, cu.a - cd.a);
  vec2 dir = gw / (length(gw) + 1e-4);
  // e dentro l'acqua i colori girano piano e si mescolano
  float fa = cn * 7.0 + u_t * 0.4;
  vec2 flow = (dir * 0.35 + vec2(cos(fa), sin(fa)) * 0.6) * e * rs;
  vec3 adv = ST(uv + flow).rgb;
  vec2 e2 = e * 2.5;
  vec3 avg = 0.125 * (cl.rgb + cr.rgb + cd.rgb + cu.rgb)
           + 0.125 * (ST(uv + vec2(e2.x, 0.0)).rgb + ST(uv - vec2(e2.x, 0.0)).rgb + ST(uv + vec2(0.0, e2.y)).rgb + ST(uv - vec2(0.0, e2.y)).rgb);
  float wn = min(min(cl.a, cr.a), min(cd.a, cu.a));
  float inner = step(0.001, wn);
  float soak = smoothstep(0.03, 0.25, w);          // più acqua, più il colore corre
  vec3 col = mix(c.rgb, mix(avg, adv, 0.45), espansione * 0.5 * rs * rs * wet * inner * (0.35 + 0.65 * soak));
  // cerchio di caffè: dove l'acqua si ferma il pigmento della foto si concentra,
  // sottile, interrotto, più o meno carico lungo il bordo
  float front = wet * (1.0 - inner);
  float brk = smoothstep(-0.3, 0.25, gnoise(vec3(pa2 * 15.0, 7.0), 0.0) + 0.2 * cn) * (0.45 + 0.55 * hp);
  float lc = luma(col);
  vec3 dep = clamp(lc + (col - lc) * 1.6, 0.0, 1.0) * 0.68;
  col = mix(col, dep, bordo * 0.035 * front * brk);
  return vec4(col, w);
}`,
    glsl: `
vec3 fx(vec2 uv) {
  vec4 s = ST(uv);
  vec3 img = IN(uv);
  float wet = smoothstep(0.0, 0.1, s.a);
  // dettaglio fine della foto dove la carta non è cambiata
  vec2 r = 0.5 / u_stRes;
  vec3 low = 0.25 * (IN(uv + r) + IN(uv - r) + IN(uv + vec2(r.x, -r.y)) + IN(uv + vec2(-r.x, r.y)));
  float same = 1.0 - smoothstep(0.01, 0.05, length(s.rgb - low));
  vec3 col = s.rgb + (img - low) * same;
  // carta bagnata: più scura, un po' più satura, le fibre si vedono
  col = mix(col, col * col * 1.1 + col * 0.04, wet * 0.3);
  vec2 p = uv * u_res / (K1080 * 3.0);
  float f = fbm(vec2(p.x * 0.12, p.y * 1.0), 3.0, 0.0, 2);
  float gr = hash12(floor(uv * u_res / max(K1080, 0.5))) - 0.5;
  col *= 1.0 - grana * (0.07 * f + 0.025 * gr) * (1.0 + wet * 1.5);
  return col;
}`,
  },


  // ------------------------------------------------------------------ strati
  {
    id: 'strati', code: 'Sr', name: 'Strati', family: 'corpi', ref: 'Paul Clipson; McLaren, Pas de deux',
    history: 32, noloop: true,
    about: 'Cinque o sei esposizioni della stessa immagine sovrapposte in macchina, ognuna con il suo zoom che scatta avanti e indietro e il suo ritardo; il fuoco passa da uno strato all’altro come un’onda. Si aggiunge all’immagine invece di togliere.',
    params: [
      P('strati', 'Strati', 2, 6, 6, 0, { step: 1 }),
      P('zoom', 'Zoom', 0, 0.4, 0.2, 0.4),
      P('scatto', 'Scatto dello zoom', 0.15, 1.5, 0.5, 0.2),
      P('ritardo', 'Sfalsamento', 0, 6, 3, 0, { step: 1 }),
      P('fuoco', 'Onda di fuoco', 0, 1, 0.6, 0.3),
      P('onda', 'Ritmo dell’onda', 0.05, 1, 0.3, 0.2),
      P('accumulo', 'Accumulo', 0, 1, 0.5, 0.3),
      P('deriva', 'Deriva', 0, 1, 0.3, 0.4),
    ],
    glsl: `
vec3 fx(vec2 uv) {
  float n = strati;
  float fpos = (0.5 + 0.5 * sin(TAU * u_t * onda)) * (n - 1.0);
  vec3 sum = vec3(0.0), scr = vec3(1.0);
  float ws = 0.0;
  vec2 a = vec2(ASPECT, 1.0);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    if (fi >= n) break;
    // zoom a scatti: ogni strato ha il suo periodo e i suoi livelli
    float per = 1.4 + 1.6 * hash11(fi + S(30.0));
    float tl = u_t + per * hash11(fi + S(31.0));
    float k = floor(tl / per);
    float x = clamp((tl - k * per) / scatto, 0.0, 1.0);
    x = x * x * (3.0 - 2.0 * x);
    float z0 = hash12(vec2(k, fi + S(32.0))), z1 = hash12(vec2(k + 1.0, fi + S(32.0)));
    float zm = 1.0 + zoom * mix(z0, z1, x) * 2.0;
    vec2 ctr = 0.5 + (hash22(vec2(fi, S(33.0))) - 0.5) * 0.25 * zoom * 2.0;
    vec2 dr = vec2(gnoise(vec3(fi * 3.1, u_t * 0.15, 1.0), 0.0), gnoise(vec3(fi * 3.1, u_t * 0.15, 7.0), 0.0)) * 0.03 * deriva;
    vec2 q = (uv - ctr) / zm + ctr + dr;
    q = clamp(q, 0.0, 1.0);
    float dly = fi * ritardo;
    // fuoco: lo strato vicino all'onda è nitido, gli altri si sfocano
    float df = min(abs(fi - fpos), 2.0);
    float rad = fuoco * df * 3.0 * K1080;
    vec2 rr = rad * PX;
    float an = fi * 1.1;
    vec2 o1 = rot(an) * vec2(rr.x, 0.0), o2 = rot(an) * vec2(0.0, rr.y);
    vec3 c;
    if (rad < 0.3) c = HIST(dly, q);
    else c = (HIST(dly, q) * 2.0 + HIST(dly, q + o1) + HIST(dly, q - o1) + HIST(dly, q + o2) + HIST(dly, q - o2)) / 6.0;
    float w = mix(1.0, 0.3, smoothstep(0.0, 1.2, abs(fi - fpos)));
    sum += c * w; ws += w;
    scr *= 1.0 - c * w * 0.45;
  }
  vec3 avg = sum / ws;
  // la media spegne il contrasto: lo restituisco attorno al tono medio
  float lm = luma(avg);
  avg = max(lm + (avg - lm) * 1.12 + (lm - 0.45) * 0.12, 0.0);
  vec3 add = 1.0 - scr;
  vec3 col = mix(avg, max(avg, add), accumulo * 0.6);
  // esposizione controllata: le luci non bruciano
  float la = luma(avg), lc = luma(col);
  col *= mix(1.0, (la + 0.15) / (lc + 0.15), 0.5);
  col = col / (1.0 + max(col - 0.82, 0.0) * 1.5);
  return col;
}`,
  },
];
