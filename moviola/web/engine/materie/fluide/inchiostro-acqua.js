// Materia fluida: inchiostro in acqua. La foto è inchiostro posato sul vetro di
// una vasca: si stacca, scende nell'acqua per il suo peso e si apre in volute.
//
// Fluidodinamica vera, non rumore deformato: Navier-Stokes incomprimibile su
// una griglia (advezione MacCormack, proiezione di pressione con iterazioni di
// Jacobi, confinamento di vorticità, galleggiamento negativo dell'inchiostro).
// I bordi del quadro sono aperti: l'inchiostro cade fuori dalla finestra.
//
// Lo stato ha quattro riquadri (2×2) nella stessa trama, ognuno con la
// proporzione del quadro:
//   A (in basso a sinistra)  xy = velocità (celle/s), z = pressione,
//                            w  = foto ancora attaccata (1 intatta, 0 sciolta)
//   B (in basso a destra)    rgb = inchiostro sciolto (assorbanza per canale)
//   C (in alto a sinistra)   rgb = inchiostro trasportato in avanti (MacCormack)
//   D (in alto a destra)     xy  = velocità trasportata in avanti (MacCormack),
//                            zw  = da dove viene l'inchiostro (scostamento in uv):
//                            il disegno ci ritrova il dettaglio fine della foto
// Ogni passo di simulazione è una fase: 0 previsione, 1 correzione e forze,
// 2..J+1 Jacobi sulla pressione, J+2 proiezione. Più passi nello stesso
// fotogramma = più sotto-passi (l'anteprima che salta fotogrammi recupera).
//
// Il disegno legge la foto a piena risoluzione: la parte ancora attaccata e
// l'inchiostro sciolto sono due assorbanze (Beer-Lambert, sottrattivo) sulla
// luce dell'acqua: più inchiostro, più scuro e saturo, mai trasparenza alfa.
import { P } from '../comune.js';

const JACOBI = 22;
const FASI = JACOBI + 3;

const COMUNE = `
#define IA_PH ${FASI}.0
#define IA_J ${JACOBI}
// l'acqua: la luce diffusa dietro la vasca, appena calda
const vec3 IA_W = vec3(0.935, 0.928, 0.905);
ivec2 iaG() { return ivec2(u_stRes) / 2; }
ivec2 iaOff(int t) { return ivec2(t & 1, t >> 1) * iaG(); }
// lettura esatta di una cella (fuori dal quadro: il bordo)
vec4 iaF(int t, ivec2 c) { return texelFetch(u_st, clamp(c, ivec2(0), iaG() - 1) + iaOff(t), 0); }
// lettura bilineare in coordinate di cella (centro della cella i = i + 0.5)
vec4 iaL(int t, vec2 p) {
  vec2 G = vec2(iaG());
  p = clamp(p, vec2(0.5), G - 0.5);
  return texture(u_st, (p + vec2(iaOff(t))) / u_stRes);
}
// l'acqua dove la foto si è già sciolta: la luce della vasca presa dai
// dintorni della foto (sfocati e appena più chiari), non un bianco piatto
// che lascerebbe aloni chiari attorno alle forme
vec3 iaWater(vec2 uv) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    float r = 0.07 * sqrt((fi + 0.5) / 16.0);
    float a = fi * 2.39996;
    acc += IN(clamp(uv + r * vec2(cos(a) / ASPECT, sin(a)), 0.0, 1.0));
  }
  acc /= 16.0;
  return clamp(mix(acc * 1.12 + 0.03, IA_W, 0.22), 0.02, 1.0);
}
`;

export const MATERIA = {
  id: 'inchiostroacqua', code: 'Ia', name: 'Inchiostro in acqua', family: 'fluide',
  ref: 'Chris Parks, liquid light show',
  steps: FASI, simLong: 1024, simFixed: true, noloop: true,
  about: 'La foto è inchiostro posato sul vetro di una vasca: si stacca piano, scende nell’acqua per il suo peso e si apre in pennacchi, anelli e dita sottili. È fluidodinamica vera: ogni seme dà le sue volute, sempre le stesse. Più inchiostro, più scuro e saturo.',
  params: [
    P('rilascio', 'Quanto si scioglie', 0, 1, 0.55, 0.3),
    P('origine', 'Si scioglie da', 0, 2, 0, 0, { step: 1, options: ['scuri', 'bordi', 'chiari'] }),
    P('ritmo', 'Ritmo (continuo · a fiotti)', 0, 1, 0.35, 0.2),
    P('peso', 'Peso dell’inchiostro', 0, 1, 0.5, 0.2),
    P('caduta', 'Direzione della caduta', 0, 360, 270, 0, { step: 1 }),
    P('vortici', 'Vorticità', 0, 1, 0.5, 0.3),
    P('viscosita', 'Viscosità dell’acqua', 0, 1, 0.3, 0.2),
    P('diffusione', 'Diffusione', 0, 1, 0.15, 0.2),
    P('scala', 'Scala delle volute', 0, 1, 0.5, 0.2),
    P('persistenza', 'Persistenza', 0, 1, 0.75, 0.2),
    P('densita', 'Densità ottica', 0.3, 3, 1.4, 0.2),
    P('fondo', 'Dietro (acqua chiara · foto)', 0, 1, 0, 0.2),
  ],
  sim: COMUNE + `
// dove la foto rilascia inchiostro (0..1), alla cella c
float iaMask(vec2 uv) {
  float l = luma(IN(uv));
  if (origine < 0.5) return smoothstep(0.75, 0.1, l);
  if (origine > 1.5) return smoothstep(0.3, 0.9, l);
  // contorni larghi delle forme, non la grana fine: si sciolgono le zone
  // attorno ai contorni, non una riga che lascerebbe un alone chiaro
  vec2 e = vec2(5.0) / vec2(iaG());
  float gx = 0.0, gy = 0.0;
  for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i)) * e * 0.7;
    gx += luma(IN(uv + vec2(e.x, o.y))) - luma(IN(uv - vec2(e.x, -o.y)));
    gy += luma(IN(uv + vec2(o.x, e.y))) - luma(IN(uv - vec2(-o.x, e.y)));
  }
  return smoothstep(0.08, 0.5, length(vec2(gx, gy)) / 3.0);
}
// assorbanza della foto (quanto inchiostro c'è in quel punto)
vec3 iaAbs(vec3 c, vec3 W) { return -log(clamp(c / W, 0.004, 1.0)); }
// avvezione: il valore che arriva in p seguendo all'indietro la velocità v
// (fuori dal quadro l'acqua è pulita)
vec4 iaBack(int t, vec2 p, vec2 v, float dt, bool clean) {
  vec2 q = p - v * dt;
  vec4 r = iaL(t, q);
  if (clean) {
    vec2 G = vec2(iaG());
    vec2 o = max(max(-q, q - G), 0.0);
    r *= exp(-dot(o, o) * 0.5);
  }
  return r;
}
// MacCormack con limitatore: phi = campo vecchio, hat = previsione in avanti
vec4 iaMac(int tOld, int tHat, ivec2 c, vec2 p, vec2 v, float dt, bool clean) {
  vec4 hat = iaF(tHat, c);
  vec4 back = iaBack(tHat, p, -v, dt, clean);
  vec4 r = hat + 0.5 * (iaF(tOld, c) - back);
  // il nuovo valore resta tra i quattro vicini da cui viene (niente oscillazioni)
  vec2 q = p - v * dt - 0.5;
  ivec2 i = ivec2(floor(q));
  vec4 a = iaF(tOld, i), b = iaF(tOld, i + ivec2(1, 0)), d = iaF(tOld, i + ivec2(0, 1)), e = iaF(tOld, i + ivec2(1, 1));
  vec4 mn = min(min(a, b), min(d, e)), mx = max(max(a, b), max(d, e));
  if (clean) mn = min(mn, vec4(0.0));
  return clamp(r, mn, mx);
}
float iaCurl(ivec2 c) {
  return 0.5 * (iaF(0, c + ivec2(1, 0)).y - iaF(0, c - ivec2(1, 0)).y - iaF(0, c + ivec2(0, 1)).x + iaF(0, c - ivec2(0, 1)).x);
}
// divergenza con bordi aperti (fuori la velocità continua uguale)
float iaDiv(ivec2 c) {
  return 0.5 * (iaF(0, c + ivec2(1, 0)).x - iaF(0, c - ivec2(1, 0)).x + iaF(0, c + ivec2(0, 1)).y - iaF(0, c - ivec2(0, 1)).y);
}
// pressione con bordi aperti: fuori dal quadro vale zero
float iaP(ivec2 c) {
  ivec2 G = iaG();
  if (c.x < 0 || c.y < 0 || c.x >= G.x || c.y >= G.y) return 0.0;
  return iaF(0, c).z;
}
vec4 sim(vec2 uv0) {
  ivec2 G = iaG();
  ivec2 px = ivec2(gl_FragCoord.xy);
  int tile = (px.x >= G.x ? 1 : 0) + (px.y >= G.y ? 2 : 0);
  ivec2 c = px - iaOff(tile);
  if (c.x >= G.x || c.y >= G.y) return vec4(0.0);
  if (u_init > 0.5) return tile == 0 ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(0.0);
  vec2 p = vec2(c) + 0.5;                 // posizione in celle
  vec2 uv = p / vec2(G);                  // posizione nel quadro
  float cell = 1.0 / float(G.y);          // una cella, in altezze di quadro
  int ph = int(mod(u_step, IA_PH));
  float dt = 1.0 / max(u_fps, 1.0);
  vec4 self = iaF(tile, c);
  vec4 A = iaF(0, c);
  vec2 v = A.xy;

  // 0: previsione in avanti (inchiostro in C, velocità in D)
  if (ph == 0) {
    if (tile == 2) return iaBack(1, p, v, dt, true);
    if (tile == 3) return vec4(iaBack(0, p, v, dt, false).xy, self.zw);
    return self;
  }
  // 1: correzione MacCormack, rilascio dalla foto, forze
  if (ph == 1) {
    if (tile == 2) return self;
    // la foto si stacca: a ritmo continuo o a fiotti, a chiazze grandi quanto le volute
    vec2 a = vec2(ASPECT, 1.0);
    float sc = mix(9.0, 2.2, scala);
    float t = u_t;
    float nz = fbm(uv * a * sc + S(3.0), t * 0.08, 0.0, 3);
    // a fiotti: ogni zona ha la sua fase, che cambia con continuità (niente riquadri)
    float ph0 = gnoise(vec3(uv * a * sc * 0.6 + S(4.0), 0.5), 0.0) * 2.5;
    float burst = pow(max(sin(TAU * (t / 3.1 + ph0)), 0.0), 6.0) * 3.2;
    float pulse = mix(1.0, burst, ritmo);
    float start = smoothstep(0.05, 0.6, t);
    float rate = rilascio * rilascio * 2.2 * iaMask(uv) * pulse * start * clamp(0.6 + nz * 1.8, 0.0, 1.6);
    float R = A.w;
    float dR = R * (1.0 - exp(-rate * dt));
    if (tile == 3) {
      // l'inchiostro ricorda da dove è partito; quello appena sciolto parte da qui
      vec2 d = iaBack(3, p, v, dt, false).zw - v * dt / vec2(G);
      vec3 b0 = iaF(1, c).rgb, fresh = iaAbs(IN(uv), iaWater(uv)) * dR;
      float m0 = b0.r + b0.g + b0.b, m1 = fresh.r + fresh.g + fresh.b;
      return vec4(self.xy, d * m0 / (m0 + m1 + 1e-4));
    }
    if (tile == 1) {
      vec3 ink = iaMac(1, 2, c, p, v, dt, true).rgb;
      // diffusione lenta: solo un filo, così non impasta tutto in grigio
      vec3 lap = iaF(1, c + ivec2(1, 0)).rgb + iaF(1, c - ivec2(1, 0)).rgb + iaF(1, c + ivec2(0, 1)).rgb + iaF(1, c - ivec2(0, 1)).rgb - 4.0 * iaF(1, c).rgb;
      ink += lap * diffusione * diffusione * 0.12;
      // l'inchiostro si diluisce e sparisce piano (persistenza)
      ink *= exp(-dt * mix(0.35, 0.0, pow(persistenza, 0.5)));
      ink += iaAbs(IN(uv), iaWater(uv)) * dR;
      return vec4(max(ink, 0.0), 0.0);
    }
    // tile 0: velocità
    vec2 vel = iaMac(0, 3, c, p, v, dt, false).xy;
    vec3 B = iaF(1, c).rgb;
    float dens = (B.r + B.g + B.b) / 3.0;
    // galleggiamento negativo: l'inchiostro pesa e cade; la densità non è
    // uniforme (il pigmento si raccoglie a grumi), così nascono le dita
    float ca = radians(caduta);
    vec2 gdir = GIU(vec2(cos(ca), sin(ca))) * GRAVITA; // la caduta è rispetto alla gravità
    float lumpy = 1.0 + 0.35 * gnoise(vec3(uv * a * sc * 2.0 + S(7.0), t * 0.2), 0.0);
    vel += gdir * dens * lumpy * peso * 110.0 * dt;
    // confinamento di vorticità: ridà ai vortici l'energia persa dalla griglia
    float w = iaCurl(c);
    int s = int(mix(1.0, 3.0, scala) + 0.5);
    vec2 gw = vec2(abs(iaCurl(c + ivec2(s, 0))) - abs(iaCurl(c - ivec2(s, 0))), abs(iaCurl(c + ivec2(0, s))) - abs(iaCurl(c - ivec2(0, s))));
    vec2 N = gw / (length(gw) + 1e-5);
    vel += vortici * 1.6 * float(s) * vec2(N.y, -N.x) * w * dt;
    // viscosità: la velocità si scambia con i vicini e si smorza
    vec2 vl = iaF(0, c + ivec2(1, 0)).xy + iaF(0, c - ivec2(1, 0)).xy + iaF(0, c + ivec2(0, 1)).xy + iaF(0, c - ivec2(0, 1)).xy - 4.0 * v;
    vel += vl * mix(0.0, 0.2, viscosita);
    vel *= exp(-dt * mix(0.25, 1.6, viscosita));
    // limite di sicurezza: al più 3 celle per passo
    float sp = length(vel) * dt;
    if (sp > 3.0) vel *= 3.0 / sp;
    return vec4(vel, A.z, R - dR);
  }
  // 2..J+1: Jacobi sulla pressione (parte dalla pressione di prima)
  if (ph < 2 + IA_J) {
    if (tile != 0) return self;
    float pn = (iaP(c + ivec2(1, 0)) + iaP(c - ivec2(1, 0)) + iaP(c + ivec2(0, 1)) + iaP(c - ivec2(0, 1)) - iaDiv(c)) * 0.25;
    return vec4(A.xy, pn, A.w);
  }
  // ultima: proiezione, il campo diventa senza divergenza
  if (tile != 0) return self;
  vec2 gp = 0.5 * vec2(iaP(c + ivec2(1, 0)) - iaP(c - ivec2(1, 0)), iaP(c + ivec2(0, 1)) - iaP(c - ivec2(0, 1)));
  return vec4(A.xy - gp, A.z, A.w);
}`,
  glsl: COMUNE + `
// lettura morbida (B-spline cubica, 4 letture bilineari) di un riquadro, a uv del quadro
vec4 iaS(int t, vec2 uv) {
  vec2 G = vec2(iaG());
  vec2 q = uv * G - 0.5;
  vec2 i = floor(q), f = q - i;
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0, w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0, w2 = 1.0 - w0 - w1 - w3;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 a0 = i + w1 / g0 - 0.5, a1 = i + w3 / g1 + 1.5;
  return g0.y * (g0.x * iaL(t, vec2(a0.x, a0.y)) + g1.x * iaL(t, vec2(a1.x, a0.y)))
       + g1.y * (g0.x * iaL(t, vec2(a0.x, a1.y)) + g1.x * iaL(t, vec2(a1.x, a1.y)));
}
vec3 fx(vec2 uv) {
  vec3 c = IN(uv);
  vec3 W = iaWater(uv);
  vec3 Ap = -log(clamp(c / W, 0.004, 1.0));
  float R = clamp(iaS(0, uv).w, 0.0, 1.0);
  vec3 ink = max(iaS(1, uv).rgb, 0.0);
  // dettaglio fine: l'inchiostro porta con sé la trama della foto da cui è
  // partito (la griglia del fluido è più morbida del quadro)
  vec2 o = uv + iaS(3, uv).zw;
  vec2 b = 0.75 / vec2(iaG());
  vec3 Wo = iaWater(o);
  vec3 Af = -log(clamp(IN(o) / Wo, 0.004, 1.0));
  vec3 Ab = -log(clamp((IN(o) * 2.0 + IN(o + vec2(b.x, 0.0)) + IN(o - vec2(b.x, 0.0)) + IN(o + vec2(0.0, b.y)) + IN(o - vec2(0.0, b.y))) / 6.0 / Wo, 0.004, 1.0));
  // il dettaglio si perde man mano che l'inchiostro viaggia e si stira
  float far = length((o - uv) * u_res / K1080);
  ink *= mix(vec3(1.0), clamp((Af + 0.05) / (Ab + 0.05), 0.5, 2.0), exp(-far / 140.0));
  vec3 back = mix(W, c, fondo);
  return back * exp(-Ap * R * (1.0 - fondo) - ink * densita);
}`,
};
