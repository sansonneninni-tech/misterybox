// Materia densa: ghiaccio. La foto è acqua che gela: una lastra di ghiaccio
// vero, trasparente e spessa, si forma sopra l'immagine e la deforma.
//
// Come gela davvero: il ghiaccio parte dai bordi e dai punti più freddi (qui
// gli scuri della foto) e avanza con un fronte frastagliato di aghi; dietro
// il fronte si ispessisce, prima in fretta e poi sempre più piano (lo
// spessore cresce come la radice del tempo, legge di Stefan). L'aria disciolta
// resta intrappolata in file di bollicine allineate con la direzione di
// crescita, e il ghiaccio che gela per ultimo, al centro, è lattiginoso.
// Raffreddandosi si crepa: fratture quasi dritte che scattano in un attimo e
// si fermano contro le crepe più vecchie (giunzioni a T). Sciogliendosi si
// assottiglia dappertutto ma sparisce prima dove è sottile, cioè ai margini:
// i bordi si arrotondano, la superficie diventa lucida e resta l'acqua.
//
// Stato (16 bit, lato lungo 512, sempre la stessa misura):
//   r = istante in cui il fronte di gelo arriva (tempo della materia)
// Tutto il resto (spessore, bolle, crepe, fusione) si ricava nel disegno dal
// tempo d'arrivo, così è nitido a qualsiasi risoluzione.
import { P } from '../comune.js';

const COMUNE = `
float ghTX(vec2 uv) { return min(texture(u_st, uv).r, u_t + 1.0); }
// tempo della materia in cui comincia a sciogliersi (mai, se Disgelo è zero)
float ghThaw() { return disgelo > 0.001 ? u_T * (1.0 - 0.75 * disgelo) : 1e9; }
// spessore della lastra (0..1) per un punto gelato da «age» secondi, con la fusione
float ghThick(float age, float lum) {
  float tg = min(age, ghThaw() - (u_t - age));          // il gelo si ferma quando comincia il disgelo
  // il bordo appena gelato è un menisco tondo, non uno scalino
  float th = sqrt(max(tg, 0.0) * (0.12 + 0.5 * gelo)) * (0.65 + 0.55 * (1.0 - lum)) * smoothstep(0.0, 0.9, tg);
  float melt = max(0.0, u_t - ghThaw()) * 0.16 * (0.4 + disgelo);
  return clamp(th, 0.0, 1.0) - melt;
}
`;

export const MATERIA = {
  id: 'ghiaccio', code: 'Gh', name: 'Ghiaccio', family: 'dense', ref: 'L’acqua che gela su una lastra; Viola, l’acqua e la lentezza',
  about: 'La foto è acqua che gela: il ghiaccio parte dai bordi e dagli scuri, avanza con un fronte di aghi e si ispessisce. È trasparente e spesso: deforma la foto più dove è spesso, tiene dentro file di bollicine e veli lattiginosi, si crepa con scatti improvvisi lungo linee quasi dritte. Col disgelo si assottiglia, i bordi si arrotondano, diventa lucido e lascia l’acqua.',
  steps: 2, simLong: 512, simFixed: true, noloop: true,
  params: [
    P('gelo', 'Velocità del gelo', 0, 1, 0.5, 0.2),
    P('spessore', 'Spessore', 0, 1, 0.6, 0.3),
    P('bolle', 'Bolle d’aria', 0, 1, 0.55, 0.2),
    P('latte', 'Cuore lattiginoso', 0, 1, 0.45, 0.3),
    P('crepe', 'Crepe', 0, 1, 0.5, 0),
    P('riflessi', 'Riflessi', 0, 1, 0.5, 0.3),
    P('disgelo', 'Disgelo', 0, 1, 0, 0.2),
    P('luce', 'Direzione della luce', 0, 1, 0.15, 0),
  ],
  sim: COMUNE + `
const ivec2 GH_O[16] = ivec2[16](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1),
  ivec2(1, 1), ivec2(-1, -1), ivec2(1, -1), ivec2(-1, 1),
  ivec2(2, 1), ivec2(1, 2), ivec2(-1, 2), ivec2(-2, 1), ivec2(-2, -1), ivec2(-1, -2), ivec2(1, -2), ivec2(2, -1));
vec4 sim(vec2 uv) {
  ivec2 c = ivec2(floor(uv * u_stRes));
  vec2 cf = vec2(c) + 0.5;
  float l = luma(IN(uv));
  if (u_init > 0.5) {
    // il gelo comincia dai bordi del quadro e dai punti più scuri della foto
    float b = min(min(cf.x, u_stRes.x - cf.x), min(cf.y, u_stRes.y - cf.y));
    float t0 = 1e4;
    if (b < 1.5) t0 = 0.1 + 0.6 * hash12(floor(cf / 9.0) + S(81.0));
    vec2 bc = floor(cf / 20.0);
    vec2 ctr = (bc + 0.2 + 0.6 * hash22(bc + S(82.0))) * 20.0;
    float ld = luma(IN(ctr / u_stRes));
    if (length(cf - ctr) < 1.5 && ld < 0.18 && hash12(bc + S(83.0)) < 0.5) t0 = 0.3 + 2.0 * hash12(bc + S(84.0)) + 6.0 * ld;
    return vec4(t0, 0.0, 0.0, 1.0);
  }
  vec4 me = texelFetch(u_st, c, 0);
  float tn = u_t;
  if (me.r <= tn) return me;
  // il fronte: più veloce negli scuri (più freddi), frastagliato a piccola scala
  vec2 p = uv * vec2(ASPECT, 1.0);
  float rough = gnoise(vec3(p * 22.0, 3.0 + S(85.0)), 0.0) * 0.3 + gnoise(vec3(p * 6.0, 7.0 + S(86.0)), 0.0) * 0.6;
  float v = (0.02 + 0.08 * gelo) * (0.25 + 1.5 * (1.0 - l) * (1.0 - l)) * (0.55 + 0.9 * smoothstep(-0.5, 0.6, rough));
  if (u_t > ghThaw()) v = 0.0;
  float best = me.r;
  float px = 1.0 / u_stRes.y;
  for (int k = 0; k < 16; k++) {
    float tk = texelFetch(u_st, clamp(c + GH_O[k], ivec2(0), ivec2(u_stRes) - 1), 0).r;
    if (tk > tn) continue;
    best = min(best, tk + length(vec2(GH_O[k])) * px / max(v, 1e-5));
  }
  return vec4(best, 0.0, 0.0, 1.0);
}`,
  glsl: COMUNE + `
// una crepa: una retta che parte da o in direzione d e scatta in un attimo in entrambi
// i versi; si ferma contro le crepe nate prima (giunzioni a T)
#define GH_NC 9
vec4 ghCrack(int k) {
  float fk = float(k);
  vec3 h = hash33(vec3(fk * 3.7 + 1.0, S(87.0), 5.3));
  vec2 o = vec2((0.1 + 0.8 * h.x) * ASPECT, 0.1 + 0.8 * h.y);
  float an = h.z * PI;
  return vec4(o, cos(an), sin(an));
}
float ghBirth(int k) { return 1.5 + (float(k) + hash11(float(k) * 7.1 + S(88.0))) * (u_T * 0.8 / float(GH_NC)) / (0.3 + crepe); }
vec3 fx(vec2 uv) {
  vec2 a = vec2(ASPECT, 1.0);
  vec2 p = uv * a;
  vec3 img = IN(uv);
  float lum = luma(img);
  float ta = ghTX(uv);
  float age = u_t - ta;
  float th0 = ghThick(age, lum);
  // il margine sottile si scioglie per primo; l'acqua resta dove c'era il ghiaccio
  float water = (age > 0.0 && th0 <= 0.0) ? 1.0 : 0.0;
  float th = max(th0, 0.0);
  // sciogliendosi il bordo si arrotonda: il passaggio dal ghiaccio all'acqua si allarga
  float iceM = smoothstep(0.0, 0.04 + 0.12 * smoothstep(ghThaw(), ghThaw() + 2.0, u_t), th);
  // pendenza della lastra: dallo spessore attorno (in uv)
  vec2 sp = 1.5 / u_stRes;
  float tE = max(ghThick(u_t - ghTX(uv + vec2(sp.x, 0.0)), lum), 0.0), tW = max(ghThick(u_t - ghTX(uv - vec2(sp.x, 0.0)), lum), 0.0);
  float tN = max(ghThick(u_t - ghTX(uv + vec2(0.0, sp.y)), lum), 0.0), tS = max(ghThick(u_t - ghTX(uv - vec2(0.0, sp.y)), lum), 0.0);
  vec2 gH = vec2(tE - tW, tN - tS) / (2.0 * sp.y);
  float H = th * spessore;
  vec2 gS = gH * spessore;
  // la direzione in cui il ghiaccio è cresciuto (verso dove il tempo d'arrivo aumenta)
  vec2 gT = vec2(ghTX(uv + vec2(sp.x, 0.0)) - ghTX(uv - vec2(sp.x, 0.0)), ghTX(uv + vec2(0.0, sp.y)) - ghTX(uv - vec2(0.0, sp.y)));
  vec2 gd = length(gT) > 1e-5 ? normalize(gT) : vec2(0.0, 1.0);
  // ---- la superficie: piatta come l'acqua che ha gelato, con le increspature rimaste prese
  // nel ghiaccio e qualche gobba larga; si arrotonda e si fa liscia quando fonde
  float wet = smoothstep(ghThaw(), ghThaw() + 2.0, u_t);
  float rz = 3.0 + S(91.0);
  vec2 sg = vec2(0.0);
  float e2 = 0.004;
  float s0 = fbm(p * 2.2, rz, 0.0, 2), f0 = gnoise(vec3(p * 13.0, rz), 0.0);
  vec2 sl = vec2(fbm((p + vec2(e2, 0.0)) * 2.2, rz, 0.0, 2) - s0, fbm((p + vec2(0.0, e2)) * 2.2, rz, 0.0, 2) - s0) / e2;
  vec2 sf = vec2(gnoise(vec3((p + vec2(e2, 0.0)) * 13.0, rz), 0.0) - f0, gnoise(vec3((p + vec2(0.0, e2)) * 13.0, rz), 0.0) - f0) / e2;
  float onS = smoothstep(0.0, 0.3, th);
  sg = (sl + 0.2 * sf * (1.0 - 0.8 * wet)) * onS;
  // lo scalino del margine pesa poco: il ghiaccio sottile al bordo devia appena
  // il menisco del bordo fa da lente: comprime la foto in una fascia; le gobbe la piegano piano
  gS = clamp(gS * 0.25 * (1.0 - wet), -2.5, 2.5) + sg * 0.05 * (0.3 + spessore);
  // ---- la foto vista attraverso lo spessore: deviata dove la lastra pende, ingrandita dove è spessa
  vec2 ofs = -gS * 0.03 - (uv - 0.5) * 0.02 * H;
  // ---- crepe: piani interni, ognuno sposta la foto da un lato e brilla sul filo
  float cr = 0.0, crSide = 0.0;
  if (crepe > 0.001) {
    for (int k = 0; k < GH_NC; k++) {
      float tb = ghBirth(k);
      if (u_t < tb) break;
      vec4 C = ghCrack(k);
      vec2 o = C.xy, d = C.zw;
      // estensione: fino alla crepa più vicina nata prima, in entrambi i versi
      float e1 = 3.0, e2 = 3.0;
      for (int j = 0; j < GH_NC; j++) {
        if (j >= k) break;
        vec4 D = ghCrack(j);
        float den = d.x * D.w - d.y * D.z;
        if (abs(den) < 1e-3) continue;
        vec2 w = D.xy - o;
        float s = (w.x * D.w - w.y * D.z) / den;
        if (s > 0.0) e1 = min(e1, s); else e2 = min(e2, -s);
      }
      // lo scatto: la crepa corre in pochi centesimi di secondo
      float run = smoothstep(0.0, 0.12, u_t - tb) * 3.0;
      vec2 q = p - o;
      float u = dot(q, d);
      // lieve zigzag: il ghiaccio si spacca quasi dritto
      float wv = dot(q, vec2(-d.y, d.x)) + 0.0015 * floor(u * 9.0 + hash11(float(k))) * (hash11(floor(u * 9.0) + float(k)) - 0.5);
      if (u > min(e1, run) || -u > min(e2, run)) continue;
      // il piano della crepa è inclinato: lo si vede come una banda sottile
      float wd = (1.2 + 2.5 * th) / 1080.0;
      float band = 1.0 - smoothstep(wd * 0.4, wd * 1.4, abs(wv + wd * 0.5));
      float line = 1.0 - smoothstep(0.35 / 1080.0, 1.4 / 1080.0, abs(wv));
      float on = smoothstep(0.05, 0.15, th);
      cr = max(cr, (line * 0.8 + band * 0.35) * on);
      crSide += step(0.0, wv) * on * smoothstep(0.0, 0.03, min(min(e1, run) - u, min(e2, run) + u));
    }
  }
  ofs += vec2(0.004, -0.003) * mod(crSide, 2.0) * spessore;
  vec2 uq = uv + ofs / a * iceM;
  // dentro il ghiaccio la foto è appena diffusa, più dove è spesso
  vec3 c = vec3(0.0);
  float rb = (0.6 + 2.5 * H) * K1080 * iceM;
  for (int i = 0; i < 6; i++) {
    float an = float(i) * 1.0472 + 0.3;
    c += IN(uq + vec2(cos(an), sin(an)) * rb * PX);
  }
  c /= 6.0;
  // assorbimento: il ghiaccio spesso è appena ciano e un poco più scuro
  c *= mix(vec3(1.0), vec3(0.83, 0.93, 0.98), H * iceM);
  // ---- il cuore lattiginoso: il ghiaccio che ha gelato per ultimo, a veli
  float late = smoothstep(2.0, 9.0, ta) * iceM;
  float vf = fbm(rot(atan(gd.y, gd.x)) * p * vec2(3.0, 14.0), 2.0, 0.0, 4);
  float milk = latte * (0.25 + 0.75 * late) * smoothstep(-0.15, 0.5, vf + 0.3 * late) * (0.3 + 0.7 * th) * iceM;
  c = mix(c, mix(vec3(luma(c)), c, 0.4) * 0.55 + vec3(0.42, 0.45, 0.48), milk * 0.75);
  // ---- bollicine in file, allineate con la crescita; più fitte dove il ghiaccio è lattiginoso
  if (bolle > 0.001 && iceM > 0.0) {
    mat2 R = mat2(gd.x, gd.y, -gd.y, gd.x);
    vec2 bq = R * p * 1080.0 / vec2(22.0, 46.0);
    vec2 bi = floor(bq), bf = fract(bq) - 0.5;
    vec3 bh = hash33(vec3(bi, S(89.0)));
    float dens = bolle * (0.15 + 0.85 * smoothstep(0.5, 6.0, ta)) * smoothstep(0.1, 0.4, th);
    if (bh.z < dens * 0.65) {
      vec2 bc = bf - (bh.xy - 0.5) * vec2(0.3, 0.5);
      float br = 0.14 + 0.26 * bh.x * bh.x;
      vec2 dv = bc / vec2(br, br * (1.3 + 1.5 * bh.y));
      float dd = length(dv);
      if (dd < 1.0) {
        // una lente d'aria: orlo scuro sottile, un punto di luce dalla parte della luce
        float la = luce * TAU;
        vec2 L2 = vec2(cos(la), sin(la));
        float rim = smoothstep(0.55, 0.95, dd);
        vec3 bin = IN(uq - dv * 0.004);
        vec3 bcol = mix(bin * 1.08 + 0.04, bin * 0.35, rim);
        bcol += 0.35 * smoothstep(0.25, 0.0, length(dv + L2 * 0.45));
        c = mix(c, bcol, smoothstep(1.0, 0.85, dd) * (0.6 + 0.4 * th));
      }
    }
  }
  // ---- il corpo del ghiaccio: un velo freddo riflesso dalla superficie (Fresnel), più dove è spesso
  c = mix(c, mix(vec3(luma(c)), c, 0.8) * 0.88 + vec3(0.08, 0.1, 0.12), iceM * (0.6 + 0.4 * H));
  // ---- le crepe: il filo brilla, il piano è un po' più chiaro
  c = mix(c, c * 0.75 + vec3(0.33, 0.36, 0.4), cr * 0.85);
  // ---- la superficie: riflessi netti e freddi di una finestra, che scorrono sulla pendenza
  float la = luce * TAU;
  // riflessi: fili netti e freddi sulle creste delle increspature rimaste prese nel ghiaccio,
  // che scorrono quando la luce gira; più larghi e lucidi quando la superficie si bagna
  vec3 nn = normalize(vec3(-(sl * 0.05 + sf * 0.012 * (1.0 - 0.8 * wet)) * onS * (0.4 + spessore), 1.0));
  vec3 Lr = normalize(vec3(cos(la), sin(la), 0.9));
  float win = pow(max(dot(nn, normalize(Lr + vec3(0.0, 0.0, 1.0))), 0.0), mix(900.0, 250.0, wet));
  float spec = win * (0.5 + 0.4 * wet) * riflessi * iceM;
  c += vec3(0.82, 0.9, 1.0) * spec;
  // il bordo della lastra: un filo scuro e uno chiaro (il menisco); più tondo quando si scioglie
  float rim = smoothstep(0.0, 0.03 + 0.05 * wet, th) * (1.0 - smoothstep(0.03 + 0.05 * wet, 0.1 + 0.1 * wet, th));
  c = mix(c, c * 0.8, rim * 0.35 * iceM * (1.0 - wet));
  // quando fonde, sul filo dell'acqua resta una riga di luce sottile
  c += vec3(0.8, 0.88, 0.95) * rim * wet * 0.05 * iceM;
  // gli aghi davanti al fronte: cristalli sottili e dritti che corrono avanti
  float front = smoothstep(-0.8, 0.0, age) * (1.0 - iceM);
  if (front > 0.0) {
    vec2 nq = p * 1080.0 / 16.0;
    vec2 ni = floor(nq);
    vec3 nh = hash33(vec3(ni, S(90.0)));
    vec2 nd = rot((nh.z - 0.5) * 1.2) * gd;
    vec2 nc = (fract(nq) - 0.5 - (nh.xy - 0.5) * 0.4) * 16.0;
    float nu = dot(nc, nd), nw = dot(nc, vec2(-nd.y, nd.x));
    float len = 9.0 * smoothstep(-0.8, -0.1, age);
    float needle = (1.0 - smoothstep(0.3, 0.9, abs(nw))) * step(-len, nu) * step(nu, 1.0) * step(0.4, nh.x);
    c = mix(c, c * 0.7 + vec3(0.32, 0.35, 0.38), needle * front * 0.8);
  }
  // ---- l'acqua di fusione: la foto bagnata, più scura e satura, liscia
  vec3 wetC = clamp(mix(vec3(luma(img)), img, 1.2) * 0.86, 0.0, 1.0);
  c = mix(c, wetC, water);
  c = mix(img, c, max(iceM, water));
  // il rilievo, per la messa a fuoco della Macro
  FX_H = 0.3 + 0.6 * H * iceM;
  return c;
}`,
};
