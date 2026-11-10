// Atlante dello stato: lo stato della simulazione è diviso in quattro tessere
// (2×2), ognuna con la stessa proporzione del quadro. Così una materia ha
// sedici numeri per punto invece di quattro (quota, acqua, colori portati,
// velocità...) senza cambiare il motore. Le tessere si leggono con texelFetch:
// valori esatti, nessuna sbavatura da una tessera all'altra, e funziona anche
// con lo stato a 32 bit (che su alcuni telefoni non si può filtrare).
//
//   tessera 0 = in basso a sinistra, 1 = in basso a destra,
//   tessera 2 = in alto a sinistra,  3 = in alto a destra.
export const ATLANTE = `
ivec2 TSZ() { return max(ivec2(u_stRes) / 2, ivec2(1)); }
ivec2 TOFF(int k) { return ivec2(k & 1, k >> 1) * TSZ(); }
// il punto c della tessera k (fuori dal bordo: il bordo)
vec4 TF(int k, ivec2 c) { return texelFetch(u_st, clamp(c, ivec2(0), TSZ() - 1) + TOFF(k), 0); }
// lettura interpolata; lc in texel della tessera (centri a i + 0.5)
vec4 TL(int k, vec2 lc) {
  vec2 q = lc - 0.5;
  ivec2 i = ivec2(floor(q));
  vec2 f = q - floor(q);
  return mix(mix(TF(k, i), TF(k, i + ivec2(1, 0)), f.x), mix(TF(k, i + ivec2(0, 1)), TF(k, i + ivec2(1, 1)), f.x), f.y);
}
vec4 TUV(int k, vec2 uv) { return TL(k, uv * vec2(TSZ())); }
// B-spline cubica del canale x di una tessera: valore e pendenza (per texel).
// Liscia: le normali non mostrano la griglia dello stato nemmeno in 4K.
vec3 TBS(int k, vec2 lc, int ch) {
  vec2 q = lc - 0.5;
  vec2 i = floor(q), f = q - i;
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
  vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0;
  vec2 d0 = (-3.0 + 6.0 * f - 3.0 * f2) / 6.0;
  vec2 d1 = (-12.0 * f + 9.0 * f2) / 6.0;
  vec2 d2 = (3.0 + 6.0 * f - 9.0 * f2) / 6.0;
  vec2 d3 = 3.0 * f2 / 6.0;
  float wx[4] = float[4](w0.x, w1.x, w2.x, w3.x), wy[4] = float[4](w0.y, w1.y, w2.y, w3.y);
  float dx[4] = float[4](d0.x, d1.x, d2.x, d3.x), dy[4] = float[4](d0.y, d1.y, d2.y, d3.y);
  ivec2 b = ivec2(i) - 1;
  vec3 r = vec3(0.0);
  for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) {
    float v = TF(k, b + ivec2(x, y))[ch];
    r += v * vec3(wx[x] * wy[y], dx[x] * wy[y], wx[x] * dy[y]);
  }
  return r;
}
// nel passo di simulazione: in quale tessera e in quale punto sta il frammento
int TK() { ivec2 c = ivec2(gl_FragCoord.xy) / TSZ(); return c.x > 1 || c.y > 1 ? -1 : c.x + 2 * c.y; }
ivec2 TC() { return ivec2(gl_FragCoord.xy) - TOFF(max(TK(), 0)); }
// uv del quadro al centro della cella c
vec2 TCUV(ivec2 c) { return (vec2(c) + 0.5) / vec2(TSZ()); }
`;
