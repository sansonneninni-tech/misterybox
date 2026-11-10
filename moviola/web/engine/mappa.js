// La mappa di una materia, dalla parte delle mani: pennello, gomma, riempi
// una zona, inverti, e gli aiuti che la ricavano dalla foto (luce, tinta,
// bordi). Tre canali: r = dove l'hai aggiunta, g = dove l'hai tolta, b = cosa
// ricava la foto. Presenza = b + r − g. Così si può cambiare l'aiuto senza
// perdere quello che hai dipinto.
//
// La mappa sta nelle coordinate della foto (non del quadro): cambiando le
// proporzioni della clip resta attaccata alla foto.

export const MAP_LONG = 640;

export function mapDims(w, h) {
  const s = MAP_LONG / Math.max(w, h);
  return { w: Math.max(2, Math.round(w * s)), h: Math.max(2, Math.round(h * s)) };
}

export function newMap(w, h) {
  const n = w * h;
  return { w, h, R: new Uint8Array(n), G: new Uint8Array(n), B: new Uint8Array(n) };
}

export const cloneMap = (m) => ({ w: m.w, h: m.h, R: m.R.slice(), G: m.G.slice(), B: m.B.slice() });

/** Presenza 0..255 nel punto i. */
export const presence = (m, i) => Math.max(0, Math.min(255, m.B[i] + m.R[i] - m.G[i]));

/** Pixel della foto alla misura della mappa (RGBA). */
export function photoPixels(el, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(el, 0, 0, w, h);
  return g.getImageData(0, 0, w, h).data;
}

const luma = (d, i) => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1e-6))); return t * t * (3 - 2 * t); };

function boxBlur(src, w, h, r) {
  if (r < 1) return src;
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  const k = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = -r; x <= r; x++) s += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = s / k;
      s += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = s / k;
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

function hue(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 1e-6) return { h: 0, s: 0, v: mx };
  let h;
  if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  h /= 6; if (h < 0) h += 1;
  return { h, s: d / (mx || 1), v: mx };
}

/** Tinta (0..1) della foto in un punto della mappa, media su un piccolo intorno. */
export function hueAt(px, w, h, x, y) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const xx = Math.min(w - 1, Math.max(0, Math.round(x) + dx)), yy = Math.min(h - 1, Math.max(0, Math.round(y) + dy));
    const i = (yy * w + xx) * 4; r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
  }
  return hue(r / n / 255, g / n / 255, b / n / 255).h;
}

/** Ricava il canale b dalla foto: luce, tinta o bordi. */
export function bakeAuto(m, px, gen) {
  const { w, h } = m, n = w * h;
  if (!px || gen.modo === 'nessuno') { m.B.fill(gen.inverti ? 255 : 0); return; }
  const so = gen.soglia, mo = Math.max(gen.morbidezza * 0.5, 0.004);
  const out = new Float32Array(n);
  if (gen.modo === 'luce') {
    const L = new Float32Array(n); for (let i = 0; i < n; i++) L[i] = luma(px, i * 4);
    const Lb = boxBlur(L, w, h, 1);
    for (let i = 0; i < n; i++) out[i] = smooth(so - mo, so + mo, Lb[i]);
  } else if (gen.modo === 'tinta') {
    const ch = [0, 1, 2].map((c) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = px[i * 4 + c] / 255; return boxBlur(a, w, h, 1); });
    for (let i = 0; i < n; i++) {
      const { h: hh, s, v } = hue(ch[0][i], ch[1][i], ch[2][i]);
      const d = Math.abs(((hh - gen.tinta + 1.5) % 1) - 0.5);
      out[i] = (1 - smooth(gen.ampiezza - mo * 0.4, gen.ampiezza + mo * 0.4, d)) * smooth(0.04, 0.16, s * v);
    }
  } else {
    const L = new Float32Array(n); for (let i = 0; i < n; i++) L[i] = luma(px, i * 4);
    const Lb = boxBlur(L, w, h, 1);
    const E = new Float32Array(n);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = Lb[i + 1 - w] + 2 * Lb[i + 1] + Lb[i + 1 + w] - Lb[i - 1 - w] - 2 * Lb[i - 1] - Lb[i - 1 + w];
      const gy = Lb[i + w - 1] + 2 * Lb[i + w] + Lb[i + w + 1] - Lb[i - w - 1] - 2 * Lb[i - w] - Lb[i - w + 1];
      E[i] = Math.hypot(gx, gy) * 0.9;
    }
    const Eb = boxBlur(E, w, h, 2);
    for (let i = 0; i < n; i++) out[i] = smooth(so - mo, so + mo, Eb[i]);
  }
  for (let i = 0; i < n; i++) m.B[i] = Math.round((gen.inverti ? 1 - out[i] : out[i]) * 255);
}

/** Inverti: la presenza diventa il suo contrario, tratti compresi. */
export function invertMap(m, gen) {
  const { R, G, B } = m;
  for (let i = 0; i < R.length; i++) { const r = R[i]; R[i] = G[i]; G[i] = r; B[i] = 255 - B[i]; }
  gen.inverti = gen.inverti ? 0 : 1;
}

export function fillMap(m, on) {
  m.R.fill(on ? 255 : 0); m.G.fill(on ? 0 : 255);
}

/**
 * Un tratto: la maschera del tratto (S, 0..1) cresce dab dopo dab, e i canali
 * si ricalcolano da com'erano all'inizio del tratto. Così la forza è
 * un'opacità vera: ripassare nello stesso tratto non accumula.
 */
export function beginStroke(m) {
  return { R0: m.R.slice(), G0: m.G.slice(), S: new Float32Array(m.w * m.h), box: null };
}

export function dab(m, st, x, y, radius, softness, strength, erase) {
  const { w, h } = m;
  const r = Math.max(0.75, radius);
  const x0 = Math.max(0, Math.floor(x - r - 1)), x1 = Math.min(w - 1, Math.ceil(x + r + 1));
  const y0 = Math.max(0, Math.floor(y - r - 1)), y1 = Math.min(h - 1, Math.ceil(y + r + 1));
  if (x0 > x1 || y0 > y1) return null;
  const inner = r * (1 - Math.min(0.98, softness));
  for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
    const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y);
    let f;
    if (d <= inner) f = 1; else if (d >= r) f = Math.max(0, 1 - (d - r)); // un pixel di bordo morbido
    else { const t = (d - inner) / (r - inner); f = 1 - t * t * (3 - 2 * t); }
    const i = yy * w + xx;
    if (f > st.S[i]) st.S[i] = f;
  }
  applyStroke(m, st, x0, y0, x1, y1, strength, erase);
  return [x0, y0, x1, y1];
}

function applyStroke(m, st, x0, y0, x1, y1, strength, erase) {
  const { w } = m;
  for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
    const i = yy * w + xx;
    const a = st.S[i] * strength;
    if (!a) continue;
    if (!erase) { m.R[i] = Math.round(st.R0[i] + (255 - st.R0[i]) * a); m.G[i] = Math.round(st.G0[i] * (1 - a)); }
    else { m.G[i] = Math.round(st.G0[i] + (255 - st.G0[i]) * a); m.R[i] = Math.round(st.R0[i] * (1 - a)); }
  }
  st.box = st.box ? [Math.min(st.box[0], x0), Math.min(st.box[1], y0), Math.max(st.box[2], x1), Math.max(st.box[3], y1)] : [x0, y0, x1, y1];
}

/**
 * Riempi la zona toccata: si allarga finché la foto resta simile al colore di
 * partenza (somiglianza 0..1), con un bordo morbido quanto il pennello.
 */
export function fillZone(m, px, x, y, similarity, softness, strength, erase) {
  const { w, h } = m, n = w * h;
  const sx = Math.round(x), sy = Math.round(y);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
  const st = beginStroke(m);
  const reg = new Float32Array(n);
  if (!px) { reg.fill(1); }
  else {
    const i0 = (sy * w + sx) * 4;
    const c0 = [px[i0], px[i0 + 1], px[i0 + 2]];
    const tol = 8 + similarity * similarity * 160;
    const seen = new Uint8Array(n);
    const stack = [sy * w + sx]; seen[sy * w + sx] = 1;
    const near = (i) => { const k = i * 4; const dr = px[k] - c0[0], dg = px[k + 1] - c0[1], db = px[k + 2] - c0[2]; return Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db) <= tol; };
    while (stack.length) {
      const i = stack.pop();
      reg[i] = 1;
      const xx = i % w, yy = (i - xx) / w;
      if (xx > 0 && !seen[i - 1]) { seen[i - 1] = 1; if (near(i - 1)) stack.push(i - 1); }
      if (xx < w - 1 && !seen[i + 1]) { seen[i + 1] = 1; if (near(i + 1)) stack.push(i + 1); }
      if (yy > 0 && !seen[i - w]) { seen[i - w] = 1; if (near(i - w)) stack.push(i - w); }
      if (yy < h - 1 && !seen[i + w]) { seen[i + w] = 1; if (near(i + w)) stack.push(i + w); }
    }
  }
  const soft = boxBlur(reg, w, h, Math.round(1 + softness * 8));
  for (let i = 0; i < n; i++) st.S[i] = soft[i];
  applyStroke(m, st, 0, 0, w - 1, h - 1, strength, erase);
  return st;
}

/** Codifica in PNG (rgb, opaco: i valori restano esatti). */
export function encodeMap(m) {
  const { w, h } = m;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, k = 0; i < w * h; i++, k += 4) { d[k] = m.R[i]; d[k + 1] = m.G[i]; d[k + 2] = m.B[i]; d[k + 3] = 255; }
  g.putImageData(new ImageData(d, w, h), 0, 0);
  return { png: c.toDataURL('image/png'), rgba: new Uint8Array(d.buffer) };
}

export function mapFromRGBA({ w, h, data }) {
  const m = newMap(w, h);
  for (let i = 0, k = 0; i < w * h; i++, k += 4) { m.R[i] = data[k]; m.G[i] = data[k + 1]; m.B[i] = data[k + 2]; }
  return m;
}
