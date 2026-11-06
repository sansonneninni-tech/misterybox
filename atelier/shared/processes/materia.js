// Processi che lavorano sulla materia dei pixel: ordine, canali, grana, soglia.
import { createImage, cloneImage, luma, clamp, rgbToHsl, makeNoise } from '../image.js';

const pixelsort = {
  id: 'pixelsort',
  name: 'Ordinamento dei pixel',
  category: 'materia',
  inputs: { min: 1, max: 1 },
  description: "Ordina i pixel per luce o tinta dentro intervalli di soglia: la superficie cola, le forme si sciolgono in direzione.",
  params: [
    { key: 'direction', label: 'Direzione', type: 'select', options: [['h', 'Orizzontale'], ['v', 'Verticale']], default: 'v' },
    { key: 'key', label: 'Criterio', type: 'select', options: [['luma', 'Luce'], ['hue', 'Tinta'], ['sat', 'Saturazione']], default: 'luma' },
    { key: 'low', label: 'Soglia bassa', type: 'range', min: 0, max: 255, step: 1, default: 60 },
    { key: 'high', label: 'Soglia alta', type: 'range', min: 0, max: 255, step: 1, default: 200 },
    { key: 'reverse', label: 'Inverti ordine', type: 'bool', default: false },
  ],
  run([img], p) {
    const out = cloneImage(img);
    const { width: w, height: h, data } = out;
    const horiz = p.direction === 'h';
    const lines = horiz ? h : w, len = horiz ? w : h;
    const keyOf = (i) => {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (p.key === 'hue') return rgbToHsl(r, g, b)[0];
      if (p.key === 'sat') return rgbToHsl(r, g, b)[1];
      return luma(r, g, b);
    };
    const idx = (line, t) => (horiz ? line * w + t : t * w + line) * 4;
    const L = new Float32Array(w * h);
    for (let k = 0; k < w * h; k++) L[k] = luma(data[k * 4], data[k * 4 + 1], data[k * 4 + 2]);
    const inRange = (line, t) => { const l = L[idx(line, t) >> 2]; return l >= p.low && l <= p.high; };
    const buf = [];
    for (let line = 0; line < lines; line++) {
      let t = 0;
      while (t < len) {
        while (t < len && !inRange(line, t)) t++;
        const start = t;
        while (t < len && inRange(line, t)) t++;
        if (t - start > 1) {
          buf.length = 0;
          for (let k = start; k < t; k++) { const i = idx(line, k); buf.push([keyOf(i), data[i], data[i + 1], data[i + 2]]); }
          buf.sort((a, b) => (p.reverse ? b[0] - a[0] : a[0] - b[0]));
          for (let k = start; k < t; k++) { const i = idx(line, k), v = buf[k - start]; data[i] = v[1]; data[i + 1] = v[2]; data[i + 2] = v[3]; }
        }
      }
    }
    return out;
  },
};

const canali = {
  id: 'canali',
  name: 'Separazione dei canali',
  category: 'materia',
  inputs: { min: 1, max: 1 },
  description: "Sposta i canali rosso, verde e blu in direzioni diverse: l'immagine si sdoppia come una stampa fuori registro.",
  params: [
    { key: 'amount', label: 'Spostamento (% lato)', type: 'range', min: 0, max: 15, step: 0.1, default: 1.5 },
    { key: 'angle', label: 'Angolo (gradi)', type: 'range', min: 0, max: 360, step: 1, default: 20 },
    { key: 'spread', label: 'Divergenza', type: 'range', min: 0, max: 180, step: 1, default: 120 },
  ],
  run([img], p) {
    const { width: w, height: h } = img;
    const out = createImage(w, h, null);
    const d = (p.amount / 100) * Math.max(w, h);
    const offs = [-1, 0, 1].map((k) => {
      const a = ((p.angle + k * p.spread) * Math.PI) / 180;
      return [Math.round(Math.cos(a) * d * Math.abs(k || 0.3)), Math.round(Math.sin(a) * d * Math.abs(k || 0.3))];
    });
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const di = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const sx = clamp(x + offs[c][0], 0, w - 1), sy = clamp(y + offs[c][1], 0, h - 1);
          out.data[di + c] = img.data[(sy * w + sx) * 4 + c];
        }
        out.data[di + 3] = 255;
      }
    }
    return out;
  },
};

const dithering = {
  id: 'dithering',
  name: "Diffusione dell'errore",
  category: 'materia',
  inputs: { min: 1, max: 1 },
  description: "Riduce l'immagine a pochi livelli distribuendo l'errore: grana tipografica, memoria di stampe povere.",
  params: [
    { key: 'levels', label: 'Livelli per canale', type: 'range', min: 2, max: 8, step: 1, default: 2 },
    { key: 'mono', label: 'Bianco e nero', type: 'bool', default: true },
    { key: 'scale', label: 'Grandezza della grana', type: 'range', min: 1, max: 12, step: 1, default: 2 },
  ],
  run([img], p) {
    const { width: w, height: h } = img;
    const s = p.scale, gw = Math.ceil(w / s), gh = Math.ceil(h / s);
    const buf = new Float32Array(gw * gh * 3);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const si = (Math.min(h - 1, y * s) * w + Math.min(w - 1, x * s)) * 4, bi = (y * gw + x) * 3;
      if (p.mono) { const l = luma(img.data[si], img.data[si + 1], img.data[si + 2]); buf[bi] = buf[bi + 1] = buf[bi + 2] = l; }
      else { buf[bi] = img.data[si]; buf[bi + 1] = img.data[si + 1]; buf[bi + 2] = img.data[si + 2]; }
    }
    const step = 255 / (p.levels - 1);
    const push = (x, y, c, e) => { if (x >= 0 && x < gw && y < gh) buf[(y * gw + x) * 3 + c] += e; };
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) for (let c = 0; c < 3; c++) {
      const bi = (y * gw + x) * 3 + c, old = buf[bi], nv = Math.round(old / step) * step, e = old - nv;
      buf[bi] = nv;
      push(x + 1, y, c, (e * 7) / 16); push(x - 1, y + 1, c, (e * 3) / 16); push(x, y + 1, c, (e * 5) / 16); push(x + 1, y + 1, c, e / 16);
    }
    const out = createImage(w, h, null);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const bi = ((Math.floor(y / s)) * gw + Math.floor(x / s)) * 3, di = (y * w + x) * 4;
      out.data[di] = buf[bi]; out.data[di + 1] = buf[bi + 1]; out.data[di + 2] = buf[bi + 2]; out.data[di + 3] = 255;
    }
    return out;
  },
};

const erosione = {
  id: 'erosione',
  name: 'Erosione per soglia',
  category: 'materia',
  inputs: { min: 1, max: 1 },
  description: "Una soglia che si muove secondo un rumore: alcune zone bruciano nel bianco, altre affondano. Restano masse e silhouette.",
  params: [
    { key: 'threshold', label: 'Soglia', type: 'range', min: 0, max: 255, step: 1, default: 128 },
    { key: 'wander', label: 'Instabilità della soglia', type: 'range', min: 0, max: 128, step: 1, default: 50 },
    { key: 'grain', label: 'Scala del rumore', type: 'range', min: 1, max: 40, step: 1, default: 6 },
    { key: 'keep', label: 'Conserva il colore', type: 'range', min: 0, max: 1, step: 0.05, default: 0.25 },
  ],
  run([img], p, rng) {
    const { width: w, height: h } = img;
    const out = createImage(w, h, null);
    const noise = makeNoise(rng), sc = p.grain / Math.max(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const l = luma(img.data[i], img.data[i + 1], img.data[i + 2]);
      const t = p.threshold + (noise.fbm(x * sc, y * sc, 4) - 0.5) * 2 * p.wander;
      const v = l > t ? 255 : 0;
      for (let c = 0; c < 3; c++) out.data[i + c] = v * (1 - p.keep) + img.data[i + c] * p.keep * (v ? 1 : 0.35);
      out.data[i + 3] = 255;
    }
    return out;
  },
};

export default [pixelsort, canali, dithering, erosione];
