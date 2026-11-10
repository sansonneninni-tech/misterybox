// Il confine di una materia, disegnato alla piena risoluzione del quadro.
// Ogni materia con un territorio riceve un campo morbido (u_tF, a bassa
// risoluzione, uguale in anteprima e nel 4K): 1 dove sta, 0 dove non c'è.
// Qui quel campo diventa un confine fisico, non una dissolvenza: nella fascia
// di passaggio le due materie si compenetrano secondo un disegno (crepe,
// gocce che sprofondano, lamelle impastate) e vengono trascinate l'una
// nell'altra. Il disegno è calcolato in coordinate del quadro, non in pixel:
// il 4K aggiunge solo nitidezza.
//
// Questo codice entra nel POSTLUDE comune: vale per ogni materia, anche per
// quelle che arriveranno, senza toccarle.

export const TERR_POST = `
uniform float u_terr;      // 1 se questo passaggio ha un territorio
uniform sampler2D u_tF;    // campo del territorio (r)
uniform vec4 u_tq;         // larghezza della fascia (uv), carattere, frequenza del disegno, trascinamento
float trrF(vec2 uv) { return texture(u_tF, uv).r; }
// media su due anelli: dentro la fascia scende da 1 a 0 in modo quasi lineare
float trrRing(vec2 uv, float R) {
  float s = trrF(uv) * 2.0;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 0.5236 + 0.26;
    s += trrF(uv + vec2(cos(a) / ASPECT, sin(a)) * R);
  }
  for (int i = 0; i < 6; i++) {
    float a = float(i) * 1.0472;
    s += trrF(uv + vec2(cos(a) / ASPECT, sin(a)) * R * 0.5);
  }
  return s / 20.0;
}
// x = presenza della materia (0..1), yz = trascinamento nella fascia
vec3 trrTerritorio(vec2 uv) {
  float L = max(u_tq.x, 0.0015);
  int car = int(u_tq.y + 0.5);
  float z = ztime(0.05), Pz = period(0.05);
  vec2 q = (uv - 0.5) * vec2(ASPECT, 1.0) * u_tq.z;
  // il confine non è mai una linea: lo piega un rumore lento, largo quanto la fascia
  vec2 wv = vec2(gnoise(vec3(q * 0.21, z), Pz), gnoise(vec3(q * 0.21 + 7.3, z), Pz));
  vec2 su = uv + vec2(wv.x / ASPECT, wv.y) * L * 0.7;
  if (car == 1) su.y += L * 0.55; // la più densa pende verso il basso
  float P = trrRing(su, L);
  float band = clamp(4.0 * P * (1.0 - P), 0.0, 1.0);
  float n;
  if (car == 0) {
    // infiltra: la materia entra prima nelle crepe sottili, poi nelle più larghe
    float r1 = 1.0 - abs(gnoise(vec3(q, z * 0.6), Pz));
    float r2 = 1.0 - abs(gnoise(vec3(q * 2.3 + 3.1, z * 0.6), Pz));
    float r = r1 * 0.62 + r2 * 0.38;
    n = pow(clamp(r, 0.0, 1.0), 5.0);
  } else if (car == 1) {
    // sprofonda: gocce pesanti, allungate verso il basso, che si staccano
    vec2 qq = vec2(q.x, q.y * 0.5 + z * 0.0);
    float g = gnoise(vec3(qq, z), Pz) * 0.62 + gnoise(vec3(qq * 2.2 + 5.0, z), Pz) * 0.26
            + gnoise(vec3(q * 6.0 + 9.0, z), Pz) * 0.12; // grana fine: il bordo della goccia non è mai un ritaglio
    n = smoothstep(-0.55, 0.55, g);
  } else {
    // impasta: le due materie piegate l'una nell'altra in lamelle
    vec2 w2 = vec2(gnoise(vec3(q * 0.45 + 1.7, z), Pz), gnoise(vec3(q * 0.45 + 9.2, z), Pz));
    float f = gnoise(vec3(q * 0.3 + w2 * 1.8, z * 0.5), Pz);
    n = 0.5 + 0.5 * sin(f * 6.5 + P * 2.0 + gnoise(vec3(q * 5.0 + 4.0, z), Pz) * 0.9); // lamelle con il bordo sfrangiato
  }
  n = clamp(n, 0.002, 0.998);
  // dentro la materia (P = 1) nessun buco, fuori (P = 0) nessuna briciola
  float s = n - ((1.0 - P) * 1.1 - 0.05);
  float e = clamp(fwidth(s) * 0.75, 1e-4, 0.03);
  float w = smoothstep(-e, e, s);
  // trascinamento: nella fascia le due materie si tirano dietro l'una l'altra
  vec2 dv = vec2(gnoise(vec3(q * 0.55 + 2.0, z), Pz), gnoise(vec3(q * 0.55 + 11.0, z), Pz));
  if (car == 1) dv = vec2(dv.x * 0.35, -abs(dv.y) - 0.5);
  vec2 d = vec2(dv.x / ASPECT, dv.y) * L * 1.2 * u_tq.w * band;
  return vec3(w, d);
}
`;
