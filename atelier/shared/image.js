// Buffer d'immagine RGBA usato da tutti i processi.
// Codice puro: gira identico nel server (Node) e nel browser.

export function createImage(width, height, fill = [0, 0, 0, 255]) {
  const data = new Uint8ClampedArray(width * height * 4);
  if (fill) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = fill[0]; data[i + 1] = fill[1]; data[i + 2] = fill[2]; data[i + 3] = fill[3];
    }
  }
  return { width, height, data };
}

export function cloneImage(img) {
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
}

// Generatore pseudo-casuale con seme (mulberry32): stessi parametri, stesso risultato.
export function makeRng(seed) {
  let a = (Number(seed) >>> 0) || 1;
  const rng = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (min, max) => min + rng() * (max - min);
  rng.int = (min, max) => Math.floor(min + rng() * (max - min + 1));
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  return rng;
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// Campionamento bilineare, coordinate fuori dai bordi bloccate al bordo.
export function sample(img, x, y, out, o = 0) {
  const { width: w, height: h, data } = img;
  x = clamp(x, 0, w - 1); y = clamp(y, 0, h - 1);
  const x0 = x | 0, y0 = y | 0;
  const x1 = x0 + 1 < w ? x0 + 1 : x0, y1 = y0 + 1 < h ? y0 + 1 : y0;
  const fx = x - x0, fy = y - y0;
  const i00 = (y0 * w + x0) * 4, i10 = (y0 * w + x1) * 4, i01 = (y1 * w + x0) * 4, i11 = (y1 * w + x1) * 4;
  for (let c = 0; c < 4; c++) {
    const top = data[i00 + c] + (data[i10 + c] - data[i00 + c]) * fx;
    const bot = data[i01 + c] + (data[i11 + c] - data[i01 + c]) * fx;
    out[o + c] = top + (bot - top) * fy;
  }
  return out;
}

// Ridimensiona "a riempimento" (cover): utile per allineare immagini da combinare.
export function coverResize(img, width, height) {
  if (img.width === width && img.height === height) return img;
  const out = createImage(width, height, null);
  const scale = Math.max(width / img.width, height / img.height);
  const ox = (img.width - width / scale) / 2, oy = (img.height - height / scale) / 2;
  const px = [0, 0, 0, 0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      sample(img, ox + (x + 0.5) / scale - 0.5, oy + (y + 0.5) / scale - 0.5, px);
      const i = (y * width + x) * 4;
      out.data[i] = px[0]; out.data[i + 1] = px[1]; out.data[i + 2] = px[2]; out.data[i + 3] = px[3];
    }
  }
  return out;
}

// Ridimensiona mantenendo le proporzioni entro un lato massimo (per anteprime e analisi).
export function fitWithin(img, maxSide) {
  const s = Math.min(1, maxSide / Math.max(img.width, img.height));
  if (s >= 1) return img;
  return coverResize(img, Math.max(1, Math.round(img.width * s)), Math.max(1, Math.round(img.height * s)));
}

// Rumore a valori interpolato, con seme. Base dei processi di genesi.
export function makeNoise(rng) {
  const size = 256;
  const perm = new Uint16Array(size * 2);
  const vals = new Float32Array(size);
  const p = rng.shuffle([...Array(size).keys()]);
  for (let i = 0; i < size * 2; i++) perm[i] = p[i & 255];
  for (let i = 0; i < size; i++) vals[i] = rng();
  const fade = (t) => t * t * (3 - 2 * t);
  const at = (xi, yi) => vals[perm[(perm[xi & 255] + yi) & 511] & 255];
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = fade(x - xi), fy = fade(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  noise.fbm = (x, y, octaves = 5, gain = 0.5) => {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise(x * freq + o * 17.3, y * freq - o * 9.1);
      norm += amp; amp *= gain; freq *= 2;
    }
    return sum / norm;
  };
  return noise;
}

// Palette: da un'immagine (se c'è) o inventata dal seme, mai "di catalogo".
export function paletteFrom(img, rng, count = 5) {
  if (img) {
    const cols = [];
    for (let k = 0; k < count * 40; k++) {
      const i = (Math.floor(rng() * img.width * img.height)) * 4;
      cols.push([img.data[i], img.data[i + 1], img.data[i + 2]]);
    }
    cols.sort((a, b) => luma(...a) - luma(...b));
    const out = [];
    for (let k = 0; k < count; k++) out.push(cols[Math.floor((k + 0.5) * cols.length / count)]);
    return out;
  }
  const base = rng() * 360;
  const out = [];
  for (let k = 0; k < count; k++) {
    const h = (base + (rng() < 0.3 ? 180 : 0) + rng() * 40 - 20) % 360;
    const l = (k + 0.4) / count;
    const s = rng() < 0.5 ? rng() * 0.25 : 0.3 + rng() * 0.5;
    out.push(hslToRgb(h, s, l));
  }
  return out;
}

export function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, hp = h / 60, x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g] = [c, x]; else if (hp < 2) [r, g] = [x, c]; else if (hp < 3) [g, b] = [c, x];
  else if (hp < 4) [g, b] = [x, c]; else if (hp < 5) [r, b] = [x, c]; else [r, b] = [c, x];
  const m = l - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)); else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

export function rampColor(palette, t, out, o = 0) {
  t = clamp(t, 0, 1) * (palette.length - 1);
  const i = Math.min(palette.length - 2, Math.floor(t)), f = t - i;
  const a = palette[i], b = palette[i + 1];
  out[o] = a[0] + (b[0] - a[0]) * f; out[o + 1] = a[1] + (b[1] - a[1]) * f; out[o + 2] = a[2] + (b[2] - a[2]) * f; out[o + 3] = 255;
  return out;
}
