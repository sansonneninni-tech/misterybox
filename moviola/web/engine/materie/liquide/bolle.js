// Materia: bolle di sapone. Non cerchi disegnati sulla foto ma una schiuma vera,
// simulata bolla per bolla, davanti alla foto.
//
// Ogni bolla è un corpo con posizione, velocità, quantità d'aria e spessore della
// pellicola. A ogni passo:
//  - sale (o scende) e si lascia portare dall'aria, che trema e fa vortici;
//  - quando tocca un'altra bolla le si incolla: le due si fermano alla distanza in
//    cui la parete comune incontra le pellicole a 120 gradi (legge di Plateau),
//    e i grappoli si muovono insieme;
//  - attraverso la parete l'aria passa dalla piccola alla grande (la piccola ha
//    più pressione): le piccole si svuotano e vengono assorbite dalle grandi;
//  - la pellicola si assottiglia (drenaggio): in alto diventa nera e lì scoppia.
//    Lo scoppio dura un soffio: la membrana si ritira dal punto in cui si è rotta
//    e le vicine, perso l'appoggio, si riassestano di scatto.
//
// Il disegno: i grappoli sono il diagramma di potenza delle sfere (le pareti
// comuni sono dritte, come in una schiuma vista di fronte). Il colore della
// pellicola è interferenza vera: per ogni punto si calcola lo spessore, l'angolo
// e la riflettanza della lamina su 16 lunghezze d'onda, poi la si converte in
// colore. La bolla quasi non piega la foto che sta dietro (è una lamina
// sottilissima): la foto torna deformata nei riflessi, quello della faccia davanti
// (specchio convesso, rimpicciolito) e quello della faccia dietro (concavo,
// capovolto). Al centro la bolla è quasi trasparente, sul bordo riflette quasi
// tutto. Nessuna luce aggiunta: tutto ciò che brilla viene dalla foto.
//
// Stato (32 bit, letto con texelFetch): 160 bolle, due texel ciascuna.
//   A (righe 0-9)  x, y (in altezze di quadro, centro 0, y in su), raggio,
//                  pellicola (µm; negativa = sta scoppiando, -0..-1 avanzamento)
//   B (righe 10-19) vx, vy, aria (raggio² a riposo), orologio (età; negativo =
//                  attesa prima di rinascere)
import { P } from '../comune.js';

const N = 160;
const STEPS = 8;

// Pesi delle 16 lunghezze d'onda per passare dalla riflettanza al colore:
// curve CIE 1931 (approssimazione di Wyman, Sloan e Shirley), poi sRGB lineare,
// normalizzati perché uno spettro piatto dia il bianco.
const LAMBDA = Array.from({ length: 16 }, (_, k) => 0.4 + (0.3 * (k + 0.5)) / 16);
const weights = (() => {
  const g = (x, m, s1, s2) => Math.exp(-0.5 * ((x - m) / (x < m ? s1 : s2)) ** 2);
  const rgb = LAMBDA.map((l) => {
    const x = l * 1000;
    const X = 1.056 * g(x, 599.8, 37.9, 31.0) + 0.362 * g(x, 442.0, 16.0, 26.7) - 0.065 * g(x, 501.1, 20.4, 26.2);
    const Y = 0.821 * g(x, 568.8, 46.9, 40.5) + 0.286 * g(x, 530.9, 16.3, 31.1);
    const Z = 1.217 * g(x, 437.0, 11.8, 36.0) + 0.681 * g(x, 459.0, 26.0, 13.8);
    return [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
  });
  const sum = [0, 1, 2].map((c) => rgb.reduce((s, v) => s + v[c], 0));
  return rgb.map((v) => v.map((x, c) => x / sum[c]));
})();
const f = (x) => x.toFixed(6);
const W_GLSL = `const vec3 BO_W[16] = vec3[16](${weights.map((v) => `vec3(${v.map(f).join(', ')})`).join(', ')});
const float BO_L[16] = float[16](${LAMBDA.map(f).join(', ')});`;

const COMUNE = `
#define BO_N ${N}
#define BO_STEPS ${STEPS}.0
vec4 boA(int i) { return texelFetch(u_st, ivec2(i % 16, i / 16), 0); }
vec4 boB(int i) { return texelFetch(u_st, ivec2(i % 16, 10 + i / 16), 0); }
// raggio medio in altezze di quadro
float boRm() { return 0.042 * misura; }
`;

const SIM = COMUNE + `
// quanto vive la pellicola di questa bolla (s): ognuna ha il suo tempo
float boTau(int i) { return mix(0.9, 9.0, vita) * (0.55 + 0.9 * hash11(float(i) * 7.13 + S(3.0))); }

// l'aria: vortici lenti (rotore di un rumore) più un tremito fine
vec2 boAria(vec2 p, float t) {
  float e = 0.02;
  vec3 q = vec3(p * 2.2, t * 0.18);
  float a = gnoise(q + vec3(0.0, e, 0.0), 0.0), b = gnoise(q - vec3(0.0, e, 0.0), 0.0);
  float c = gnoise(q + vec3(e, 0.0, 0.0), 0.0), d = gnoise(q - vec3(e, 0.0, 0.0), 0.0);
  vec2 curl = vec2(a - b, -(c - d)) / (2.0 * e);
  vec2 trem = vec2(gnoise(vec3(p * 9.0, t * 2.3 + 4.0), 0.0), gnoise(vec3(p * 9.0 + 7.7, t * 2.3), 0.0));
  return aria * (curl * 0.035 + trem * 0.022);
}

// una bolla nuova; init = la prima schiuma, già sparsa sul quadro
void boNasce(int i, bool init, out vec4 A, out vec4 B) {
  float asp = u_stRes.x / u_stRes.y;
  vec3 h = hash33(vec3(float(i) * 1.731, u_frame * 0.917 + u_step * 0.131, S(7.0)));
  vec3 h2 = hash33(h * 37.1 + 3.3);
  // misura: distribuzione lognormale attorno al raggio medio
  float gs = sqrt(-2.0 * log(max(h.x, 1e-4))) * cos(TAU * h.y);
  float r = clamp(boRm() * exp(varieta * 0.55 * gs), 0.006, 0.32);
  int modo = int(nascita + 0.5);
  vec2 p = (h2.xy - 0.5) * vec2(asp, 1.0);
  if (modo == 0) {
    if (init) {
      // la prima schiuma: qualche grappolo, non una pioggia uniforme
      vec2 cg = (hash22(vec2(floor(h.z * 4.0), S(8.0))) - 0.5) * vec2(asp * 0.8, 0.8);
      float g2 = sqrt(-2.0 * log(max(h2.x, 1e-4)));
      p = cg + g2 * vec2(cos(TAU * h2.y), sin(TAU * h2.y)) * boRm() * 2.2;
    } else if (h2.x < 0.7) {
      // la schiuma cresce dalla schiuma: nasce accanto a una bolla viva
      int j = int(hash11(h.z * 51.7 + u_frame) * float(BO_N));
      vec4 Aj = boA(j);
      if (Aj.z > 0.0 && Aj.w >= 0.0) {
        float an = TAU * h2.y;
        p = Aj.xy + vec2(cos(an), sin(an)) * (Aj.z + r) * 0.85;
      }
    }
  }
  if (modo == 1 && !init) p = vec2((h2.x - 0.5) * asp, -0.5 - r * 1.05);
  if (modo >= 2) {
    // dai chiari o dagli scuri: fra sei posti a caso, il più chiaro o il più scuro
    float best = -1.0;
    for (int k = 0; k < 6; k++) {
      vec2 c = hash22(h.xy * 91.3 + float(k) * 13.7) - 0.5;
      float l = luma(IN(c + 0.5));
      float s = modo == 2 ? l : 1.0 - l;
      if (s > best) { best = s; p = c * vec2(asp, 1.0); }
    }
  }
  float film = mix(0.45, 1.1, h2.z);
  // nel quadro nasce piccola e si gonfia; dal basso entra già fatta
  float r0 = (init || modo == 1) ? r : r * 0.25;
  A = vec4(p, r0, film);
  B = vec4(0.0, 0.0, r * r, 0.0);
}

vec4 sim(vec2 uv) {
  ivec2 cc = ivec2(gl_FragCoord.xy);
  if (cc.x >= 16 || cc.y >= 20) return vec4(0.0);
  int i = (cc.y % 10) * 16 + cc.x;
  bool isB = cc.y >= 10;
  float asp = u_stRes.x / u_stRes.y;
  float dt = 1.0 / (u_fps * BO_STEPS);
  int nAct = int(8.0 + quantita * float(BO_N - 8));
  vec4 A, B;
  if (u_init > 0.5) {
    if (i < nAct) boNasce(i, true, A, B);
    else { A = vec4(0.0); B = vec4(0.0, 0.0, 0.0, -hash11(float(i) + S(2.0)) * 3.0); }
    return isB ? B : A;
  }
  A = boA(i); B = boB(i);

  // ---- morta: aspetta e rinasce
  if (A.z <= 0.0) {
    B.w += dt;
    if (B.w >= 0.0) {
      if (i < nAct) boNasce(i, false, A, B);
      else B.w = -0.5;
    }
    return isB ? B : A;
  }
  // ---- sta scoppiando: la membrana si ritira in un attimo
  if (A.w < 0.0) {
    A.w -= dt / 0.06;
    if (A.w <= -1.0) {
      A = vec4(0.0);
      // la schiuma si rifà: dopo una pausa ne nasce un'altra
      B = vec4(0.0, 0.0, 0.0, -mix(0.1, 1.6, hash12(vec2(float(i), u_frame + S(9.0)))) * (1.2 - quantita));
    }
    return isB ? B : A;
  }

  vec2 P0 = A.xy, V = B.xy;
  float r = A.z, G = B.z;
  vec2 corr = vec2(0.0), vsum = vec2(0.0);
  float nc = 0.0, dG = 0.0;
  for (int j = 0; j < BO_N; j++) {
    if (j == i) continue;
    vec4 Aj = boA(j);
    if (Aj.z <= 0.0 || Aj.w < 0.0) continue;
    float rj = Aj.z, s = r + rj;
    vec2 d = P0 - Aj.xy;
    float L = length(d);
    if (L > s * 1.5) continue;
    vec2 n = L > 1e-6 ? d / L : normalize(hash22(vec2(float(i), float(j))) - 0.5 + 1e-3);
    float share = rj * rj / (r * r + rj * rj); // la grande si sposta meno
    if (L < s) {
      // incollate: la distanza a cui la parete fa 120 gradi con le due pellicole
      float deq = sqrt(r * r + rj * rj - r * rj);
      float k = L < deq ? 1.0 : 0.25 + 0.75 * coesione;
      corr += n * (deq - L) * k * share;
      // la parete comune: lunghezza della corda fra i due cerchi
      float a = (L * L + r * r - rj * rj) / (2.0 * max(L, 1e-5));
      float wall = 2.0 * sqrt(max(r * r - a * a, 0.0));
      dG += wall * (1.0 / rj - 1.0 / r);
      vsum += boB(j).xy; nc += 1.0;
    } else {
      // vicine ma staccate: si cercano appena (le schiume stanno insieme)
      corr -= n * (L - s) * 0.3 * coesione * share * (1.0 - smoothstep(s, s * 1.5, L));
    }
  }
  // l'aria, la salita, la gravità e il vento della catena
  vec2 uvp = P0 / vec2(asp, 1.0) + 0.5;
  vec2 vt = boAria(P0, u_t) + vec2(0.0, salita * 0.11 * (0.7 + 0.3 * sqrt(r / boRm())));
  vt += FORZA(uvp) * vec2(asp, 1.0);
  V += (vt - V) * (1.0 - exp(-dt / 0.35));
  // i grappoli si muovono insieme
  if (nc > 0.0) V += (vsum / nc - V) * (1.0 - exp(-dt / (0.12 + 0.3 * (1.0 - coesione))));
  vec2 P1 = P0 + V * dt + corr * (1.0 - exp(-dt * 26.0));

  // l'aria passa dalla piccola alla grande; la bolla si gonfia o si svuota
  G = max(G + dG * assorbimento * 0.0011 * dt, 0.0);
  float rt = sqrt(G) * (1.0 + 0.06 * RESPIRO);
  r += (rt - r) * (1.0 - exp(-dt / 0.18));
  float film = A.w * exp(-dt / boTau(i));
  B.w += dt;
  // assorbita del tutto: se ne va senza scoppiare
  if (r < 0.0035) { A = vec4(0.0); B = vec4(0.0, 0.0, 0.0, -mix(0.3, 2.0, hash11(float(i) + u_frame))); return isB ? B : A; }
  // uscita dal quadro: altrove continua, qui ne nasce un'altra
  if (abs(P1.x) > asp * 0.5 + r * 1.2 || P1.y > 0.5 + r * 1.2 || P1.y < -0.5 - r * 2.5) {
    A = vec4(0.0); B = vec4(0.0, 0.0, 0.0, -mix(0.05, 1.2, hash11(float(i) * 3.1 + u_frame)));
    return isB ? B : A;
  }
  A = vec4(P1, r, film);
  B = vec4(V, G, B.w);
  // in alto la pellicola diventa nera: sotto i 15 nanometri si rompe
  // (raramente prima, se l'aria la scuote)
  float scossa = hash12(vec2(float(i) * 1.37 + u_step, u_frame + S(11.0)));
  if (film * 0.1 < 0.012 || scossa < dt * 0.012 * (0.3 + aria)) A.w = -0.001;
  return isB ? B : A;
}`;

const FX = COMUNE + W_GLSL + `
vec3 boLin(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }
vec3 boGam(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
// riflettanza di una lamina d'acqua saponata (n 1,33) in aria, spessore t (µm),
// coseno dell'angolo c: le due polarizzazioni, con le riflessioni multiple
vec3 boFilm(float t, float c) {
  const float nf = 1.33;
  float s2 = (1.0 - c * c) / (nf * nf);
  float ct = sqrt(max(1.0 - s2, 0.0));
  float rs = (c - nf * ct) / (c + nf * ct);
  float rp = (nf * c - ct) / (nf * c + ct);
  float Rs = rs * rs, Rp = rp * rp;
  vec3 acc = vec3(0.0);
  for (int k = 0; k < 16; k++) {
    float cd = cos(12.566371 * nf * t * ct / BO_L[k]);
    float a = 2.0 * Rs * (1.0 - cd) / (1.0 + Rs * Rs - 2.0 * Rs * cd);
    float b = 2.0 * Rp * (1.0 - cd) / (1.0 + Rp * Rp - 2.0 * Rp * cd);
    acc += BO_W[k] * 0.5 * (a + b);
  }
  return clamp(acc, 0.0, 1.0);
}
// il mondo riflesso: R è la direzione del raggio riflesso (z verso chi guarda)
vec3 boEnv(vec2 uv, vec2 cuv, vec2 Rxy, float Rz, float r1, vec2 a) {
  vec2 avanti = uv + Rxy / a * 0.18 / (max(-Rz, 0.0) + 0.35);
  vec2 dietro = vec2(1.0) - cuv - Rxy / a * 0.32 / (max(Rz, 0.0) + 0.45);
  vec3 cA = boLin(IN(clamp(avanti, 0.001, 0.999)));
  // il mondo alle spalle è fuori fuoco e in ombra: sfocato e più scuro
  vec3 cD = vec3(0.0);
  for (int k = 0; k < 5; k++) {
    float an = float(k) * 1.2566 + 0.4;
    cD += boLin(IN(clamp(dietro + (k == 0 ? vec2(0.0) : vec2(cos(an), sin(an)) * 0.035 / a), 0.001, 0.999)));
  }
  cD *= 0.2 * 0.55;
  return mix(cD, cA, smoothstep(0.25, -0.25, Rz));
}
vec3 fx(vec2 uv) {
  vec2 a = vec2(ASPECT, 1.0);
  vec2 p = (uv - 0.5) * a;
  float px = 1.0 / u_res.y;
  float pw1 = 1e9, pw2 = 1e9, pw3 = 1e9;
  int i1 = -1, i2 = -1, i3 = -1;
  for (int i = 0; i < BO_N; i++) {
    vec4 A = boA(i);
    if (A.z <= 0.0) continue;
    vec2 d = p - A.xy;
    float rr = A.z + 2.0 * px;
    if (dot(d, d) > rr * rr) continue;
    float pw = dot(d, d) - A.z * A.z;
    if (pw < pw1) { pw3 = pw2; i3 = i2; pw2 = pw1; i2 = i1; pw1 = pw; i1 = i; }
    else if (pw < pw2) { pw3 = pw2; i3 = i2; pw2 = pw; i2 = i; }
    else if (pw < pw3) { pw3 = pw; i3 = i; }
  }
  vec3 img = IN(uv);
  if (i1 < 0) return img;
  vec4 A = boA(i1);
  vec2 c1 = A.xy;
  float r1 = A.z;
  vec2 q = (p - c1) / r1;
  float rho = length(q);
  // il bordo trema appena con l'aria
  float an = atan(q.y, q.x);
  float wob = 1.0 + aria * 0.012 * sin(2.0 * an + u_t * 7.0 + float(i1)) + aria * 0.008 * sin(3.0 * an - u_t * 9.3 + float(i1) * 2.1);
  rho /= wob;
  float cover = 1.0 - smoothstep(1.0 - 1.2 * px / r1, 1.0 + 0.6 * px / r1, rho);
  if (cover <= 0.0) return img;
  vec2 qq = q / max(rho * wob, 1e-4) * min(rho, 0.9995);
  float nz = sqrt(max(1.0 - dot(qq, qq), 0.0));
  vec3 n = vec3(qq, nz);
  vec2 cuv = c1 / a + 0.5;

  // lo spessore della pellicola: più sottile in alto, colato in basso, con i
  // vortici che la rimescolano (la pellicola scorre sulla sfera)
  float h = abs(A.w);
  float tt = u_t * 0.35;
  vec3 sp = n * 2.3 + vec3(float(i1) * 3.7, 0.0, 0.0);
  vec2 sw = vec2(gnoise(sp + vec3(0.0, tt, 0.0), 0.0), gnoise(sp + vec3(5.2, -tt, 1.3), 0.0));
  float yy = n.y + 0.22 * sw.x;
  float prof = mix(0.1, 1.15, pow(clamp(0.5 - 0.5 * yy, 0.0, 1.0), 1.25));
  float t = h * prof * exp(0.3 * sw.y);
  float tb = h * mix(0.1, 1.15, pow(clamp(0.5 - 0.5 * (n.y - 0.22 * sw.y), 0.0, 1.0), 1.25));

  // lo scoppio: la pellicola manca dove la rottura è già passata
  float fFront = 1.0, fBack = 1.0, rimF = 0.0;
  if (A.w < 0.0) {
    float u = -A.w;
    vec3 n0 = normalize(vec3(0.35 * (hash11(float(i1) + S(5.0)) - 0.5), 0.92, 0.3));
    float af = acos(clamp(dot(n, n0), -1.0, 1.0));
    float ab = acos(clamp(dot(vec3(qq, -nz), n0), -1.0, 1.0));
    float front = u * 3.4;
    fFront = smoothstep(front, front + 0.05, af);
    fBack = smoothstep(front, front + 0.05, ab);
    rimF = (1.0 - smoothstep(0.0, 0.18, abs(af - front - 0.1))) * fFront;
  }

  // dietro la bolla: la foto, appena piegata dalla lamina
  vec2 lens = qq * (1.0 - nz) * r1 * lente * 0.25 / a;
  vec3 bg = boLin(IN(uv - lens));
  // riflesso della faccia davanti (specchio convesso): verso il bordo il raggio
  // riflesso va avanti e mostra la foto di lato; al centro torna indietro e
  // mostra il mondo alle spalle di chi guarda (la foto capovolta)
  vec3 envF = boEnv(uv, cuv, 2.0 * nz * qq, 2.0 * nz * nz - 1.0, r1, a);
  // riflesso della faccia dietro (specchio concavo): capovolto e più grande
  vec3 envB = boLin(IN(clamp(cuv - qq * r1 * 1.6 / a, 0.001, 0.999)));
  float k = riflesso * 2.0;
  vec3 Rf = boFilm(t, nz), Rb = boFilm(tb, nz);
  float gF = dot(Rf, vec3(0.2126, 0.7152, 0.0722)), gB = dot(Rb, vec3(0.2126, 0.7152, 0.0722));
  Rf = clamp(mix(vec3(gF), Rf, colori) * k, 0.0, 1.0) * fFront;
  Rb = clamp(mix(vec3(gB), Rb, colori) * k, 0.0, 1.0) * fBack;
  vec3 col = bg * (1.0 - Rf) * (1.0 - Rb) + envB * Rb * (1.0 - Rf) + envF * Rf;

  // le pareti comuni dentro il grappolo: lamine viste di taglio
  if (i2 >= 0 && fFront > 0.5) {
    vec4 A2 = boA(i2);
    if (A2.w >= 0.0 && pw2 < 0.0) {
      float L = max(length(A2.xy - c1), 1e-5);
      float dw = (pw2 - pw1) / (2.0 * L);
      // i bordi di Plateau: dove si incontrano tre bolle la parete si ingrossa
      float jn = 0.0;
      if (i3 >= 0 && pw3 < 0.0) {
        float L3 = max(length(boA(i3).xy - c1), 1e-5);
        float dw3 = (pw3 - pw1) / (2.0 * L3);
        jn = exp(-dw3 / (0.012 * min(r1, A2.z)));
      }
      float wpx = px * (0.9 + 0.5 * k) + jn * min(r1, A2.z) * 0.035;
      float line = 1.0 - smoothstep(wpx * 0.5, wpx * 0.5 + px, dw);
      vec2 nw = normalize(A2.xy - c1);
      vec3 wc = boLin(IN(uv + nw / a * (wpx + px * 3.0)));
      vec3 wall = (wc * 0.62 + envF * 0.2) * (1.0 - 0.35 * jn);
      col = mix(col, wall, line * (0.5 + 0.3 * jn));
    }
  }
  // il contorno: la stessa lamina vista di taglio
  float sil = smoothstep(1.0 - 2.6 * px / r1, 1.0 - 0.6 * px / r1, rho) * fFront;
  col = mix(col, bg * 0.5 + envF * 0.2, sil * 0.75);
  // l'orlo della membrana che si ritira: un filo d'acqua più spesso, poi nebbia
  col = mix(col, bg * 0.7 + envF * 0.25, rimF * 0.8);
  return mix(img, boGam(col), cover);
}`;

export const MATERIA = {
  id: 'bolle', code: 'Bo', name: 'Bolle', family: 'acque', ref: 'Brakhage, Youngblood; la schiuma di Plateau',
  steps: STEPS, simLong: 64, simFixed: true, simF32: true, noloop: true,
  about: 'Davanti alla foto una schiuma vera di bolle di sapone: salgono e tremano con l’aria, si incollano in grappoli con pareti dritte che si incontrano a tre, le piccole vengono assorbite dalle grandi. La pellicola si colora per interferenza, scorre, in alto diventa nera e lì scoppia; le vicine si riassestano di scatto. La foto vive dietro e nei riflessi, piccola e capovolta.',
  params: [
    P('quantita', 'Quantità di schiuma', 0, 1, 0.75, 0.2),
    P('misura', 'Misura bolle', 0.3, 2.5, 1, 0.2),
    P('varieta', 'Varietà delle misure', 0, 1, 0.6, 0.2),
    P('salita', 'Salita (scendono · salgono)', -1, 1, 0.3, 0.2),
    P('aria', 'Aria che le muove', 0, 1, 0.4, 0.3),
    P('coesione', 'Si incollano', 0, 1, 0.75, 0.2),
    P('vita', 'Vita della pellicola', 0, 1, 0.45, 0.2),
    P('assorbimento', 'Le grandi assorbono le piccole', 0, 1, 0.45, 0.2),
    P('nascita', 'Nascono', 0, 3, 0, 0, { step: 1, options: ['ovunque', 'dal basso', 'dai chiari', 'dagli scuri'] }),
    P('colori', 'Colori della pellicola', 0, 1, 1, 0.2),
    P('riflesso', 'Riflessi della foto', 0, 1, 0.7, 0.3),
    P('lente', 'Lente', 0, 1, 0.12, 0.3),
  ],
  sim: SIM,
  glsl: FX,
};
