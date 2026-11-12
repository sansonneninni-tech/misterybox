// Materia: Tessuto. La foto è stampata su una stoffa vera, che si muove come
// si muove una stoffa: appesa a un'asta e gonfiata dall'aria, oppure posata
// su un tavolo e presa, sollevata, trascinata e lasciata da una mano.
// Quattro stoffe, che differiscono per come si muovono e per come prendono
// la luce: velluto, pelle, seta, tappeto.
//
// Simulazione (atlante 2×2, 32 bit): una griglia di nodi con massa.
//   tessera 0 = posizione del nodo (x, y, z), in altezze di quadro;
//   tessera 1 = velocità del nodo;
//   tessera 2 = solo il punto (0,0): dove la mano ha preso la stoffa
//               (posizione all'istante della presa, indice della presa).
// Ogni passo è un piccolo passo di dinamica basata sulle posizioni (Verlet e
// vincoli risolti in parallelo): stiramento sui quattro fili, taglio sulle
// diagonali, piega a due e a quattro nodi. La rigidità a piega, il peso
// rispetto all'aria, lo smorzamento e l'attrito cambiano con la stoffa.
// L'aria spinge lungo la normale della stoffa con la velocità relativa (la
// forza di pressione vera di una vela), così la stoffa si gonfia, sbatte e
// fa correre onde; la gravità la fa ricadere.
//
// Il disegno inverte la deformazione (da pixel a punto della stoffa, con una
// piccola prospettiva: ciò che si gonfia verso di noi si ingrandisce), ci
// stampa la foto e la illumina con una luce radente: ombra propria, ombra
// portata dalle pieghe, e la superficie di ogni stoffa.
import { P } from '../comune.js';
import { ATLANTE } from './atlante.js';

const COMUNE = ATLANTE + `
#define SF_STEPS 40.0
#define SF_DC 4.0
#define SF_TG 4.2
// la stoffa scelta: 0 velluto, 1 pelle, 2 seta, 3 tappeto
int sfTipo() { return int(clamp(floor(tipo + 0.5), 0.0, 3.0)); }
bool sfAria() { return mosso < 0.5; }
// quanto l'asta raccoglie la stoffa (1 = distesa): più pieghe, più stoffa
float sfRaccolta() { return sfAria() ? 1.0 - 0.42 * clamp(pieghe, 0.0, 1.0) : 1.0; }
// misura della stoffa (in altezze di quadro): un po' più grande del quadro
vec2 sfSize() {
  if (sfAria()) return vec2((ASPECT + 0.7) / sfRaccolta(), 1.25);
  return vec2(ASPECT + 0.4, 1.3);
}
// passo della griglia a riposo, in x e in y
vec2 sfH() { return sfSize() / vec2(TSZ()); }
// pieghe a cannone dell'asta: ogni stoffa ha la sua larghezza di piega (in nodi)
float sfPasso() {
  int ty = sfTipo();
  return ty == 0 ? 15.0 : ty == 1 ? 19.0 : ty == 2 ? 11.0 : 30.0;
}
// ampiezza delle pieghe sull'asta: la sinusoide che ha la lunghezza della stoffa
float sfAmp() {
  float g = sfRaccolta();
  float lam = 2.0 * sfPasso() * sfH().x * g;
  return min(lam / PI * sqrt(max(1.0 / g - 1.0, 0.0)) * 0.92, 0.09);
}
// posizione a riposo del punto materiale m (0..1)
vec3 sfRestM(vec2 m) {
  vec2 sz = sfSize();
  if (sfAria()) {
    float g = sfRaccolta();
    float i = m.x * float(TSZ().x);
    // pieghe non tutte uguali: il passo e la profondità variano lungo l'asta
    float ph = PI * i / sfPasso() + 1.1 * gnoise(vec3(i * 0.045, 0.5, S(60.0)), 0.0);
    float am = 0.75 + 0.35 * gnoise(vec3(i * 0.07, 2.5, S(59.0)), 0.0);
    float z = sfAmp() * am * sin(ph) * (0.55 + 0.45 * m.y);
    return vec3((m.x - 0.5) * sz.x * g, 0.56 - (1.0 - m.y) * sz.y, z);
  }
  return vec3((m - 0.5) * sz, 0.0);
}
// la presa della mano numero gi: dove (punto materiale) e verso dove trascina
vec2 sfGrip(float gi) { return 0.22 + 0.56 * hash22(vec2(gi * 1.37 + 2.0, 5.1) + S(61.0)); }
// la mano: quanto tiene il punto m (0..1) e dove lo porta. H = stato della presa
float sfHand(vec2 m, float t, vec4 H, out vec3 target) {
  target = vec3(0.0);
  float tg = t - 0.4;
  if (sfAria() || tg < 0.0) return 0.0;
  float gi = floor(tg / SF_TG), ph = fract(tg / SF_TG);
  if (abs(gi - H.w) > 0.5) return 0.0; // la presa non è ancora registrata
  vec2 gp = sfGrip(gi);
  vec2 dm = (m - gp) * sfSize();
  float r = length(dm);
  float R = 0.07 + 0.1 * clamp(pieghe, 0.0, 1.0);
  float wr = 1.0 - smoothstep(0.0, R, r);
  wr = wr * wr * (3.0 - 2.0 * wr);
  if (wr <= 0.0) return 0.0;
  float mv = clamp(movimento, 0.0, 1.0);
  float env = smoothstep(0.0, 0.14, ph) * (1.0 - smoothstep(0.8, 0.92, ph));
  float lift = (0.04 + 0.2 * mv) * smoothstep(0.08, 0.42, ph) * (1.0 - smoothstep(0.6, 0.86, ph));
  vec2 rnd = hash22(vec2(gi * 2.11 + 1.0, 9.3) + S(62.0)) - 0.5;
  // trascina un po' a caso, ma riporta il punto preso verso casa sua
  vec2 D = (rnd * (0.03 + 0.12 * mv) + (sfRestM(gp).xy - H.xy) * 0.85) * smoothstep(0.18, 0.72, ph);
  // la mano trema appena
  D += 0.004 * mv * vec2(sin(t * 7.1 + gi), cos(t * 6.3 + gi * 2.0)) * env;
  // le dita raccolgono la stoffa attorno alla presa
  float pinch = 1.0 - (0.08 + 0.2 * clamp(pieghe, 0.0, 1.0)) * smoothstep(0.03, 0.3, ph) * (1.0 - smoothstep(0.82, 0.95, ph));
  target = vec3(H.xy + D + dm * pinch, max(H.z, 0.0) + lift - r * 0.35 * smoothstep(0.08, 0.42, ph));
  return env * wr;
}
`;

const SIM = COMUNE + `
// le quattro stoffe: velluto, pelle, seta, tappeto
// sensibilità all'aria (superficie / massa), smorzamento, piega a 2 e 4 nodi,
// quanto cede se compressa, taglio, attrito sul tavolo
float sfK(int ty, int q) {
  if (q == 0) return ty == 0 ? 2.0 : ty == 1 ? 1.2 : ty == 2 ? 5.0 : 0.5;
  if (q == 1) return ty == 0 ? 0.9 : ty == 1 ? 1.3 : ty == 2 ? 0.3 : 1.6;
  if (q == 2) return ty == 0 ? 0.10 : ty == 1 ? 0.55 : ty == 2 ? 0.02 : 0.7;
  if (q == 3) return ty == 0 ? 0.025 : ty == 1 ? 0.28 : ty == 2 ? 0.0 : 0.45;
  if (q == 4) return ty == 0 ? 0.3 : ty == 1 ? 0.55 : ty == 2 ? 0.2 : 0.6;
  if (q == 5) return ty == 0 ? 0.45 : ty == 1 ? 0.6 : ty == 2 ? 0.35 : 0.75;
  return ty == 0 ? 0.45 : ty == 1 ? 0.2 : ty == 2 ? 0.06 : 0.6;
}
vec3 sfInit(ivec2 c) {
  vec2 m = TCUV(c);
  vec3 r = sfRestM(m);
  if (!sfAria()) r.z = 0.003 * (0.6 + 0.4 * gnoise(vec3(r.xy * 6.0, S(63.0)), 0.0));
  return r;
}
vec4 sim(vec2 uv0) {
  int k = TK();
  if (k < 0 || k == 3) return vec4(0.0);
  ivec2 c = TC();
  ivec2 ts = TSZ();
  float dt = 1.0 / (24.0 * SF_STEPS);
  float t = u_t + u_step * dt;
  if (k == 2) {
    // la presa della mano: si registra dove sta il punto preso quando la mano arriva
    if (c != ivec2(0)) return vec4(0.0);
    float gi = floor((t - 0.4) / SF_TG);
    if (u_init > 0.5) return vec4(sfRestM(sfGrip(max(gi, 0.0))), gi);
    vec4 H = TF(2, ivec2(0));
    if (abs(gi - H.w) > 0.5) {
      vec3 p0 = TL(0, sfGrip(gi) * vec2(ts)).xyz;
      return vec4(p0, gi);
    }
    return H;
  }
  if (u_init > 0.5) return k == 0 ? vec4(sfInit(c), 0.0) : vec4(0.0);
  int ty = sfTipo();
  vec4 A = TF(0, c), B = TF(1, c);
  vec2 h = sfH();
  vec2 m = TCUV(c);
  bool aria = sfAria();
  // forze: gravità e aria
  float G = 4.5 * GRAVITA;
  vec3 acc = aria ? vec3(GIU(vec2(0.0, -1.0)) * G, 0.0) : vec3(0.0, 0.0, -G);
  if (aria) {
    // la normale della stoffa in questo nodo
    vec3 ex = TF(0, c + ivec2(1, 0)).xyz - TF(0, c - ivec2(1, 0)).xyz;
    vec3 ey = TF(0, c + ivec2(0, 1)).xyz - TF(0, c - ivec2(0, 1)).xyz;
    vec3 n = cross(ex, ey);
    float ln = length(n);
    n = ln > 1e-9 ? n / ln : vec3(0.0, 0.0, 1.0);
    // l'aria: soffia da dietro verso di noi e di lato, a raffiche che corrono
    vec2 lat = VERSO_VENTO(vec2(1.0, 0.0));
    float mv = SOFFIO(clamp(movimento, 0.0, 2.0));
    vec2 q = A.xy;
    float g1 = gnoise(vec3(q * 1.2 - lat * t * 0.9, t * 0.33 + S(64.0)), 0.0);
    float g2 = gnoise(vec3(q * 2.9 - lat * t * 1.7, t * 0.9 + S(65.0)), 0.0);
    float puff = 0.5 + 0.5 * sin(t * 0.45 + 1.3 + 0.8 * sin(t * 0.19));
    float w = mv * 1.5 * max(0.25 + 0.55 * puff + 0.7 * g1 + 0.3 * g2, 0.0);
    // le stoffe pesanti hanno bisogno di più aria per muoversi (a parità di
    // «forza del movimento» si muovono tutte, ma ognuna col suo peso)
    w *= ty == 0 ? 2.6 : ty == 1 ? 3.2 : ty == 2 ? 0.8 : 6.0;
    vec3 W = w * normalize(vec3(lat * 0.22, 1.0));
    float vn = dot(W - B.xyz, n);
    acc += clamp(sfK(ty, 0) * vn, -60.0, 60.0) * n;
  }
  vec3 tgt;
  float pin = 0.0;
  if (aria) {
    // la riga in alto è cucita all'asta
    if (c.y == ts.y - 1) { pin = 1.0; tgt = sfRestM(m); }
  } else {
    pin = sfHand(m, t, TF(2, ivec2(0)), tgt);
  }
  vec3 xp = A.xyz + B.xyz * dt + acc * dt * dt;
  // vincoli
  vec3 sum = vec3(0.0);
  float yl = sfK(ty, 4), sh = sfK(ty, 5), b2 = sfK(ty, 2), b4 = sfK(ty, 3);
  // sul tavolo la stoffa sollevata fa pieghe morbide, non fili: piega minima
  if (!aria) { b2 = max(b2, 0.32); b4 = max(b4, 0.16); yl = max(yl, 0.45); }
  // vincoli risolti tutti insieme (Jacobi): la somma dei pesi non deve superare
  // quella che il passo regge, se no la stoffa rigida vibra e si rompe
  float kj = 0.25 * min(1.0, 7.0 / (4.0 + 4.0 * (sh + b2 + b4)));
  for (int j = 0; j < 16; j++) {
    ivec2 o; float s; float L0;
    bool bend = false;
    if (j < 4) { o = j == 0 ? ivec2(1, 0) : j == 1 ? ivec2(-1, 0) : j == 2 ? ivec2(0, 1) : ivec2(0, -1); s = 1.0; L0 = j < 2 ? h.x : h.y; }
    else if (j < 8) { o = j == 4 ? ivec2(1, 1) : j == 5 ? ivec2(-1, -1) : j == 6 ? ivec2(1, -1) : ivec2(-1, 1); s = sh; L0 = length(h); }
    else if (j < 12) { o = j == 8 ? ivec2(2, 0) : j == 9 ? ivec2(-2, 0) : j == 10 ? ivec2(0, 2) : ivec2(0, -2); s = b2; L0 = 2.0 * (j < 10 ? h.x : h.y); bend = true; }
    else { o = j == 12 ? ivec2(4, 0) : j == 13 ? ivec2(-4, 0) : j == 14 ? ivec2(0, 4) : ivec2(0, -4); s = b4; L0 = 4.0 * (j < 14 ? h.x : h.y); bend = true; }
    if (s <= 0.0) continue;
    ivec2 nc = c + o;
    if (nc.x < 0 || nc.y < 0 || nc.x >= ts.x || nc.y >= ts.y) continue;
    vec3 xn = TF(0, nc).xyz + TF(1, nc).xyz * dt + acc * dt * dt;
    vec3 d = xp - xn;
    float l = max(length(d), 1e-7);
    float C = l - L0;
    // la stoffa cede se compressa (per questo fa pieghe); la piega resiste
    if (C < 0.0) C *= bend ? 1.0 : yl;
    else if (bend) C *= 0.5;
    sum += -kj * s * C * d / l;
  }
  vec3 xn2 = xp + sum * (1.0 - pin);
  if (pin > 0.0) xn2 = mix(xn2, tgt, pin);
  if (!aria) {
    // il tavolo: la stoffa non lo attraversa e, dove lo tocca, fa attrito
    if (xn2.z < 0.0) xn2.z = 0.0;
    float touch = 1.0 - smoothstep(0.0, 0.0025, xn2.z);
    xn2.xy = mix(xn2.xy, A.xy, touch * sfK(ty, 6) * (1.0 - pin));
  }
  vec3 v = (xn2 - A.xyz) / dt;
  v *= 1.0 - dt * sfK(ty, 1);
  float sp = length(v);
  if (sp > 8.0) v *= 8.0 / sp;
  // salvagente: un nodo impazzito torna al suo posto
  if (any(isnan(xn2)) || any(isinf(xn2)) || any(isnan(v))) { xn2 = sfRestM(m); v = vec3(0.0); }
  return k == 0 ? vec4(xn2, 0.0) : vec4(v, 0.0);
}`;

const DRAW = COMUNE + `
vec3 sfPos(vec2 m) { return TL(0, m * vec2(TSZ())).xyz; }
vec2 sfProj(vec3 X) { return X.xy * SF_DC / (SF_DC - X.z); }
// celle (Voronoi): distanza al primo e al secondo seme, e il seme più vicino
vec3 sfCell(vec2 q, float sd, out vec2 id) {
  vec2 i = floor(q), f = fract(q);
  float d1 = 9.0, d2 = 9.0;
  id = i;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(x, y);
    vec2 o = hash22(i + g + sd);
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; id = i + g; } else if (d < d2) d2 = d;
  }
  return vec3(d1, d2, 0.0);
}
// grana della pelle: rilievi a ciottolo, pori, e rughe dove la pelle è compressa
float sfPelleH(vec2 q, vec2 cmp) {
  vec2 id;
  vec3 v = sfCell(q / 5.5, S(71.0), id);
  float pebble = smoothstep(0.0, 0.45, v.y - v.x);
  float h = 0.55 * pebble + 0.12 * gnoise(vec3(q * 0.09, S(72.0)), 0.0);
  vec2 pid;
  vec3 pv = sfCell(q / 2.3, S(73.0), pid);
  float pore = step(0.82, hash12(pid + S(74.0))) * (1.0 - smoothstep(0.08, 0.2, pv.x));
  h -= 0.45 * pore;
  // rughe: corrono di traverso alla compressione
  float wx = max(cmp.x, 0.0), wy = max(cmp.y, 0.0);
  float rx = 1.0 - abs(sin(q.x * 0.42 + 2.5 * gnoise(vec3(q * vec2(0.05, 0.02), S(75.0)), 0.0)));
  float ry = 1.0 - abs(sin(q.y * 0.42 + 2.5 * gnoise(vec3(q * vec2(0.02, 0.05), S(76.0)), 0.0)));
  float wl = gnoise(vec3(q * 0.035, S(77.0)), 0.0) * 0.5 + 0.5;
  h -= 0.9 * (wx * pow(rx, 6.0) + wy * pow(ry, 6.0)) * (0.4 + 0.8 * wl);
  return h;
}
// luce ricevuta: ambiente + luce radente (in ombra solo l'ambiente); 1 di fronte
float sfLit(float NL, float lz, float ka, float sh) { return 0.8 * (ka + (1.0 - ka) / lz * max(NL, 0.0) * sh); }
vec3 fx(vec2 uv) {
  ivec2 ts = TSZ();
  vec2 asp = vec2(ASPECT, 1.0);
  vec2 p = (uv - 0.5) * asp;
  vec3 img = IN(uv);
  int ty = sfTipo();
  vec2 sz = sfSize(), h = sfH();
  bool aria = sfAria();
  float g = sfRaccolta();
  vec2 span = aria ? vec2(sz.x * g, sz.y) : sz;
  vec2 orig = aria ? vec2(-0.5 * span.x, 0.56 - span.y) : -0.5 * span;
  // ---- da pixel a stoffa: punto fisso m = m + (p - proiezione(pos(m)))
  // dove le pieghe si sovrappongono (una piega che copre l'altra) il punto
  // fisso ha più soluzioni: si parte da tre punti e vince lo strato davanti
  vec2 m0 = (p - orig) / span;
  vec2 m = m0;
  float bestZ = -1e9, bestE = 1e9;
  for (int k = 0; k < 3; k++) {
    vec2 mk = m0 + vec2(float(k - 1) * 0.6 * sfPasso() / float(ts.x), 0.0);
    for (int i = 0; i < 14; i++) {
      vec2 e = p - sfProj(sfPos(mk));
      mk += e / span * (i < 8 ? 0.85 : 0.6);
    }
    vec3 Xk = sfPos(mk);
    float ek = length(p - sfProj(Xk)) * u_res.y;
    bool ok = ek < 1.0;
    // una soluzione che torna vale più di una che non torna; tra due che tornano, quella davanti
    if ((ok && (bestE >= 1.0 || Xk.z > bestZ)) || (!ok && bestE >= 1.0 && ek < bestE)) { m = mk; bestZ = Xk.z; bestE = ek; }
  }
  vec3 X = sfPos(m);
  // nessuno strato torna: siamo nel fondo stretto di una piega che si richiude
  float crevice = smoothstep(2.5, 6.0, bestE);
  // ---- fuori dalla stoffa: il buio dello studio
  vec3 dark = img * 0.035;
  if (m.x < 0.0 || m.y < 0.0 || m.x > 1.0 || m.y > 1.0) return dark;
  // ---- normale dalla spline dei nodi (liscia, senza griglia)
  vec2 lcs = m * vec2(ts);
  vec3 bx = TBS(0, lcs, 0), by = TBS(0, lcs, 1), bz = TBS(0, lcs, 2);
  vec3 du = vec3(bx.y, by.y, bz.y), dv = vec3(bx.z, by.z, bz.z);
  vec3 n = normalize(cross(du, dv) + vec3(0.0, 0.0, 1e-9));
  if (n.z < 0.0) n = -n;
  // stiramento e compressione locale
  float cu = length(du) / h.x, cv = length(dv) / h.y;
  // ---- la luce: radente, dalla direzione scelta
  float az = radians(luce);
  vec3 Ld = normalize(vec3(cos(az) * 0.8, sin(az) * 0.8, 0.6));
  vec3 V = normalize(vec3(-X.xy, SF_DC - X.z));
  // ombra portata dalle pieghe vicine, cercata verso la luce sulla stoffa
  vec2 dl = normalize(Ld.xy / h + 1e-6);
  float tanE = Ld.z / length(Ld.xy);
  float occ = 0.0;
  for (int s = 1; s <= 7; s++) {
    float d = float(s * s) * 0.7;
    vec3 Y = TL(0, lcs + dl * d).xyz;
    float rise = (Y.z - X.z) - length(Y.xy - X.xy) * tanE;
    occ = max(occ, smoothstep(0.0, 0.012, rise));
  }
  // fondo delle pieghe: meno luce dall'ambiente
  float zr = 0.0;
  for (int i = 0; i < 6; i++) { float an = float(i) * 1.0472; zr += TL(0, lcs + vec2(cos(an), sin(an)) * 4.0).z; }
  float cav = clamp((zr / 6.0 - X.z) / (4.0 * min(h.x, h.y)) * 1.2, -1.0, 1.0);
  float ao = 1.0 - 0.45 * smoothstep(0.0, 1.0, cav);
  // ---- la foto stampata sulla stoffa
  vec2 pu = (orig + m * span) / asp + 0.5;
  pu = 1.0 - abs(1.0 - mod(pu, 2.0)); // oltre la foto, la foto a specchio
  vec3 alb = IN(pu);
  // coordinate di stoffa in pixel di un quadro alto 1080 (stessa grana in 4K)
  vec2 mp = m * sz * 1080.0;
  float fw = max(fwidth(mp.x), fwidth(mp.y)); // pixel di stoffa per pixel di quadro
  vec3 T = normalize(dv - n * dot(dv, n) + 1e-7);   // il filo dell'ordito
  vec3 B = normalize(cross(n, T));                   // la trama
  float NL0 = dot(n, Ld);
  float shadow = 1.0 - 0.85 * occ;
  vec3 col;
  // luce: una parte viene dall'ambiente (lo studio), il resto dalla luce radente.
  // La stoffa distesa e di fronte riceve 1: la foto resta com'è.
  if (ty == 0) {
    // ---------------- VELLUTO: pelo fitto. Di fronte assorbe, ai bordi delle
    // pieghe (dove lo si guarda di sbieco) il pelo si mostra di fianco e si accende.
    float crush = fbm(mp * 0.006, S(80.0), 0.0, 3);
    float fib = hash12(floor(mp * 1.3) + S(81.0)) - 0.5;
    float fa = 1.0 - smoothstep(0.6, 1.4, fw);
    vec3 N = n;
    float NV = clamp(dot(N, V), 0.0, 1.0), NL = dot(N, Ld);
    float diff = sfLit(NL, Ld.z, 0.42, shadow);
    vec3 base = pow(max(alb, 0.0), vec3(1.18)) * (1.0 + 0.12 * crush);
    // di fronte il pelo assorbe; di sbieco si mostra di fianco e si accende
    float rim = pow(1.0 - NV, 1.8);
    float sheen = rim * clamp(0.3 + 0.7 * (NL * 0.5 + 0.5), 0.0, 1.0) * (0.75 + 0.7 * crush) * (1.0 + 0.25 * fib * fa);
    vec3 sc = mix(alb, vec3(luma(alb)), 0.2) * 1.15 + 0.06;
    float front = mix(1.0, 0.74, smoothstep(0.55, 1.0, NV));
    col = base * diff * front * ao + sc * sheen * 0.85 * (0.4 + 0.6 * shadow);
    col *= 1.0 + 0.04 * fib * fa;
  } else if (ty == 1) {
    // ---------------- PELLE: grana a ciottolo e pori, rughe dove si comprime,
    // un riflesso semilucido largo che si spezza sulla grana.
    vec2 cmp = clamp((vec2(0.93) - vec2(cu, cv)) / 0.2, 0.0, 1.0);
    float fa = 1.0 - smoothstep(1.2, 2.6, fw);
    float e = 0.6;
    float h0 = sfPelleH(mp, cmp);
    vec2 gH = vec2(sfPelleH(mp + vec2(e, 0.0), cmp) - h0, sfPelleH(mp + vec2(0.0, e), cmp) - h0) / e;
    vec3 N = normalize(n - (B * gH.x + T * gH.y) * 0.4 * fa);
    float NL = dot(N, Ld);
    float diff = sfLit(NL, Ld.z, 0.36, shadow);
    vec3 H = normalize(Ld + V);
    float NH = max(dot(N, H), 0.0);
    float gloss = 0.7 + 0.3 * smoothstep(-0.2, 0.5, h0);
    float spec = (pow(NH, 30.0) * 0.5 + pow(NH, 7.0) * 0.08) * gloss;
    float fres = 0.6 + 0.4 * pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 base = alb * (0.93 + 0.07 * fa * h0);
    float cavg = fa * smoothstep(0.0, -0.4, h0);
    col = base * diff * ao * (1.0 - 0.35 * cavg) + vec3(spec * fres) * shadow * (0.8 + 0.2 * luma(alb));
  } else if (ty == 2) {
    // ---------------- SETA: leggera e lucida. Il riflesso è anisotropo: corre
    // lungo il filo dell'ordito e scorre sulle pieghe mentre la stoffa si muove.
    float fa = 1.0 - smoothstep(0.7, 1.6, fw);
    float slub = gnoise(vec3(mp.x * 0.28, mp.y * 0.006, S(90.0)), 0.0);
    float weave = sin(mp.x * 2.4) * sin(mp.y * 2.4);
    vec3 N = normalize(n + B * 0.03 * slub * fa);
    float NL = dot(N, Ld);
    // la seta è sottile: un po' di luce passa, le pieghe non chiudono mai nel nero
    float diff = sfLit(NL, Ld.z, 0.55, mix(1.0, shadow, 0.6));
    vec3 H = normalize(Ld + V);
    float TH = dot(T, H), BH = dot(B, H);
    float sT = sqrt(max(1.0 - TH * TH, 0.0)), sB = sqrt(max(1.0 - BH * BH, 0.0));
    float vis = smoothstep(-0.1, 0.25, NL);
    float s1 = pow(sT, 90.0) * 0.32;               // il riflesso bianco, stretto
    float s2 = pow(sT, 22.0) * 0.16;               // l'alone colorato, largo
    float s3 = pow(sB, 160.0) * 0.12;              // la trama, appena
    vec3 base = mix(vec3(luma(alb)), alb, 1.08) * (1.0 + 0.035 * slub * fa + 0.02 * weave * fa);
    vec3 tint = mix(alb, vec3(1.0), 0.35);
    col = base * diff * sqrt(ao) * 0.86 + (vec3(s1 + s3) + tint * s2) * vis * mix(1.0, shadow, 0.7);
  } else {
    // ---------------- TAPPETO: pelo spesso a ciuffi, ombre tra un ciuffo e
    // l'altro, quasi opaco. Ogni ciuffo è di un colore: la foto è annodata.
    // ciuffi irregolari (celle di Voronoi su coordinate appena torte): nessuna fila
    float pitch = 5.0;
    vec2 q = mp / pitch + 0.4 * vec2(gnoise(vec3(mp * 0.045, S(93.0)), 0.0), gnoise(vec3(mp * 0.045 + 7.0, S(94.0)), 0.0));
    vec2 id;
    vec3 vc = sfCell(q, S(95.0), id);
    float fa = 1.0 - smoothstep(1.4, 3.0, fw);
    // sulle creste la stoffa si apre e il pelo si separa; nelle valli si stringe
    float open = clamp(-cav, 0.0, 1.0) * 0.5 + clamp(max(cu, cv) - 1.0, 0.0, 0.3);
    float border = vc.y - vc.x;
    float ht = smoothstep(0.0 + 0.25 * open, 0.75, border) * (0.8 + 0.3 * hash12(id + S(96.0)));
    // il colore del ciuffo: la foto nel suo seme
    vec2 cs = id + hash22(id + S(95.0));
    vec2 cm = cs * pitch / (sz * 1080.0);
    vec2 cpu = (orig + cm * span) / asp + 0.5;
    cpu = 1.0 - abs(1.0 - mod(cpu, 2.0));
    vec3 tuft = IN(cpu) * (0.92 + 0.16 * hash12(id + S(97.0)));
    // fibre: fili sottili e un po' arruffati, punte che prendono luce
    vec2 f = q - cs;
    // ogni ciuffo apre i suoi fili a raggiera dal seme
    float lf = length(f);
    float rad = gnoise(vec3(f / max(lf, 1e-4) * 3.5 + id * 1.7, S(99.0)), 0.0);
    float fn = mix(gnoise(vec3(mp * 1.6, S(98.0)), 0.0), rad, smoothstep(0.05, 0.4, lf)) * 0.8 + gnoise(vec3(mp * 3.3, S(100.0)), 0.0) * 0.3;
    vec3 N = normalize(n + (B * f.x + T * f.y) * 0.8 * ht * fa + (B * fn - T * fn * 0.5) * 0.25 * fa);
    float NL = dot(N, Ld);
    float diff = sfLit(NL, Ld.z, 0.34, shadow);
    float pile = mix(1.0, (0.72 + 0.28 * ht) * (0.88 + 0.24 * fn), fa);
    vec3 base = mix(alb * 0.92, tuft, 0.5 * fa + 0.2);
    float NV = clamp(dot(N, V), 0.0, 1.0);
    float tip = pow(1.0 - NV, 3.0) * 0.08 + 0.04 * fa * smoothstep(0.3, 0.9, fn) * ht;
    col = base * diff * pile * ao + base * tip;
  }
  // ---- orlo: un bordo cucito, più spesso e un po' più scuro
  vec2 eb = min(m, 1.0 - m) * sz * 1080.0;
  float edge = min(eb.x, eb.y);
  col *= 1.0 - 0.22 * (1.0 - smoothstep(2.0, 9.0, edge)) + 0.08 * smoothstep(7.0, 9.0, edge) * (1.0 - smoothstep(9.0, 12.0, edge));
  col = mix(dark, col, smoothstep(0.0, 1.2, edge * K1080));
  col *= 1.0 - 0.45 * crevice;
  FX_H = clamp(0.35 + X.z * 4.0, 0.0, 1.0);
  // spalla morbida: le luci si avvicinano al bianco senza bruciare
  vec3 hi = max(col - 0.78, 0.0);
  col = min(col, 0.78) + 0.22 * (1.0 - exp(-hi / 0.22));
  return clamp(col, 0.0, 1.0);
}`;

export const MATERIA = {
  id: 'stoffa', code: 'Sf', name: 'Tessuto', family: 'terre', ref: 'I drappi di Fortuny; il velluto nei ritratti fiamminghi; i tappeti battuti al sole',
  about: 'La foto è stampata su una stoffa vera: appesa a un’asta si gonfia e sbatte nell’aria, posata su un tavolo la prende una mano, la solleva, la trascina e la lascia. Velluto, pelle, seta e tappeto si muovono e prendono la luce ognuno a modo suo.',
  steps: 40, simLong: 448, simF32: true, noloop: true,
  vitali: ['movimento', 'pieghe'],
  params: [
    P('tipo', 'Tessuto', 0, 3, 2, 0, { step: 1, options: ['velluto', 'pelle', 'seta', 'tappeto'] }),
    P('mosso', 'Mosso da', 0, 1, 0, 0, { step: 1, options: ['aria', 'una mano'] }),
    P('movimento', 'Forza del movimento', 0, 1, 0.5, 0.3),
    P('pieghe', 'Pieghe', 0, 1, 0.55, 0.2),
    P('luce', 'Direzione della luce (°)', 0, 360, 135, 0, { step: 1 }),
  ],
  sim: SIM,
  glsl: DRAW,
};
