// Analisi visiva misurabile. Lavora su una versione ridotta dell'immagine.
import { fitWithin, luma, rgbToHsl, makeRng } from './image.js';

export function analyze(source) {
  const img = fitWithin(source, 256);
  const { width: w, height: h, data } = img;
  const n = w * h;
  const L = new Float32Array(n);
  let sumL = 0, sumS = 0, warm = 0, lows = 0, highs = 0;
  const hist = new Uint32Array(32);
  for (let k = 0; k < n; k++) {
    const r = data[k * 4], g = data[k * 4 + 1], b = data[k * 4 + 2];
    const l = luma(r, g, b);
    L[k] = l; sumL += l; hist[Math.min(31, (l / 8) | 0)]++;
    sumS += rgbToHsl(r, g, b)[1];
    warm += (r - b) / 255;
    if (l < 12) lows++; if (l > 243) highs++;
  }
  const mean = sumL / n;
  let varL = 0;
  for (let k = 0; k < n; k++) varL += (L[k] - mean) ** 2;
  const contrast = Math.sqrt(varL / n) / 128;

  // Entropia dell'istogramma (0 = piatta, 1 = massima varietà tonale).
  let entropy = 0;
  for (const c of hist) if (c) { const p = c / n; entropy -= p * Math.log2(p); }
  entropy /= 5;

  // Densità dei bordi (Sobel) e baricentro del peso visivo.
  let edgeSum = 0, wx = 0, wy = 0, wsum = 0;
  const E = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const k = y * w + x;
    const gx = -L[k - w - 1] - 2 * L[k - 1] - L[k + w - 1] + L[k - w + 1] + 2 * L[k + 1] + L[k + w + 1];
    const gy = -L[k - w - 1] - 2 * L[k - w] - L[k - w + 1] + L[k + w - 1] + 2 * L[k + w] + L[k + w + 1];
    const e = Math.hypot(gx, gy) / 1020;
    E[k] = e; edgeSum += e;
    const weight = e + Math.abs(L[k] - mean) / 255;
    wx += x * weight; wy += y * weight; wsum += weight;
  }
  const edges = Math.min(1, (edgeSum / n) * 6);
  const centroid = { x: wsum ? wx / wsum / w : 0.5, y: wsum ? wy / wsum / h : 0.5 };

  // Simmetria (1 = specchiata perfettamente).
  let dLR = 0, dTB = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    dLR += Math.abs(L[y * w + x] - L[y * w + (w - 1 - x)]);
    dTB += Math.abs(L[y * w + x] - L[(h - 1 - y) * w + x]);
  }
  const symmetry = { lr: 1 - dLR / n / 128, tb: 1 - dTB / n / 128 };

  // Spazio vuoto: quota di blocchi quasi uniformi.
  const bs = 8;
  let blocks = 0, quiet = 0;
  for (let by = 0; by + bs <= h; by += bs) for (let bx = 0; bx + bs <= w; bx += bs) {
    let e = 0;
    for (let y = by; y < by + bs; y++) for (let x = bx; x < bx + bs; x++) e += E[y * w + x];
    blocks++; if (e / (bs * bs) < 0.02) quiet++;
  }
  const emptiness = blocks ? quiet / blocks : 0;

  return {
    width: source.width, height: source.height,
    ratio: source.width / source.height,
    brightness: mean / 255, contrast, entropy,
    saturation: sumS / n, warmth: warm / n,
    clipping: { shadows: lows / n, highlights: highs / n },
    edges, centroid, symmetry, emptiness,
    palette: palette(img, 5),
  };
}

// Palette per k-means semplice su un campione di pixel.
function palette(img, k) {
  const rng = makeRng(7), { data, width: w, height: h } = img;
  const pts = [];
  for (let s = 0; s < 1500; s++) { const i = (Math.floor(rng() * w * h)) * 4; pts.push([data[i], data[i + 1], data[i + 2]]); }
  let cents = Array.from({ length: k }, (_, j) => pts[Math.floor((j + 0.5) * pts.length / k)].slice());
  const assign = new Uint8Array(pts.length);
  for (let it = 0; it < 8; it++) {
    pts.forEach((p, i) => {
      let best = 0, bd = Infinity;
      cents.forEach((c, j) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; best = j; } });
      assign[i] = best;
    });
    const acc = cents.map(() => [0, 0, 0, 0]);
    pts.forEach((p, i) => { const a = acc[assign[i]]; a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; a[3]++; });
    cents = acc.map((a, j) => (a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : cents[j]));
  }
  const counts = cents.map((_, j) => 0);
  assign.forEach((a) => counts[a]++);
  return cents
    .map((c, j) => ({ hex: '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''), share: counts[j] / pts.length }))
    .sort((a, b) => b.share - a.share);
}
