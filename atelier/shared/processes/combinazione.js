// Processi che mettono in relazione due o più immagini.
// Tutte le immagini vengono portate alla dimensione della prima (riempimento).
import { createImage, coverResize, luma, clamp, makeNoise, sample } from '../image.js';

const align = (imgs) => imgs.map((im) => coverResize(im, imgs[0].width, imgs[0].height));

const cadavere = {
  id: 'cadavere',
  name: 'Cadavere squisito',
  category: 'combinazione',
  inputs: { min: 2, max: 6 },
  description: "Costruisce un'immagine a fasce, ognuna presa da una sorgente diversa, con giunture irregolari: un corpo fatto di pezzi che non si conoscono.",
  params: [
    { key: 'bands', label: 'Fasce', type: 'range', min: 2, max: 24, step: 1, default: 4 },
    { key: 'direction', label: 'Direzione', type: 'select', options: [['h', 'Orizzontali'], ['v', 'Verticali']], default: 'h' },
    { key: 'seam', label: 'Giuntura irregolare (%)', type: 'range', min: 0, max: 20, step: 0.5, default: 4 },
    { key: 'order', label: 'Ordine', type: 'select', options: [['seq', 'In sequenza'], ['random', 'Casuale']], default: 'random' },
  ],
  run(inputs, p, rng) {
    const imgs = align(inputs);
    const { width: w, height: h } = imgs[0];
    const out = createImage(w, h, null);
    const horiz = p.direction !== 'v', len = horiz ? h : w, cross = horiz ? w : h;
    const owner = Array.from({ length: p.bands }, (_, k) => (p.order === 'seq' ? k % imgs.length : rng.int(0, imgs.length - 1)));
    for (let k = 1; k < owner.length; k++) if (owner[k] === owner[k - 1] && imgs.length > 1) owner[k] = (owner[k] + 1) % imgs.length;
    const noise = makeNoise(rng), amp = (p.seam / 100) * len;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const t = horiz ? y : x, c = horiz ? x : y;
      const jitter = (noise.fbm((c / cross) * 6, t / len * 2, 3) - 0.5) * 2 * amp;
      const band = clamp(Math.floor(((t + jitter) / len) * p.bands), 0, p.bands - 1);
      const src = imgs[owner[band]], i = (y * w + x) * 4;
      out.data[i] = src.data[i]; out.data[i + 1] = src.data[i + 1]; out.data[i + 2] = src.data[i + 2]; out.data[i + 3] = 255;
    }
    return out;
  },
};

const mascheraluce = {
  id: 'mascheraluce',
  name: 'Maschera di luce',
  category: 'combinazione',
  inputs: { min: 2, max: 2 },
  description: "Le luci della prima immagine diventano finestre sulla seconda: una scena abita le forme dell'altra.",
  params: [
    { key: 'threshold', label: 'Soglia', type: 'range', min: 0, max: 255, step: 1, default: 128 },
    { key: 'softness', label: 'Morbidezza', type: 'range', min: 1, max: 128, step: 1, default: 24 },
    { key: 'invert', label: 'Inverti (le ombre aprono)', type: 'bool', default: false },
  ],
  run(inputs, p) {
    const [a, b] = align(inputs);
    const { width: w, height: h } = a;
    const out = createImage(w, h, null);
    for (let i = 0; i < w * h * 4; i += 4) {
      const l = luma(a.data[i], a.data[i + 1], a.data[i + 2]);
      let m = clamp((l - p.threshold) / p.softness + 0.5, 0, 1);
      if (p.invert) m = 1 - m;
      for (let c = 0; c < 3; c++) out.data[i + c] = a.data[i + c] * (1 - m) + b.data[i + c] * m;
      out.data[i + 3] = 255;
    }
    return out;
  },
};

const spostamento = {
  id: 'spostamento',
  name: 'Spostamento (A deforma B)',
  category: 'combinazione',
  inputs: { min: 2, max: 2 },
  description: "La luce della prima immagine piega lo spazio della seconda: le linee di B seguono la topografia di A.",
  params: [
    { key: 'strength', label: 'Forza (% lato)', type: 'range', min: 0, max: 30, step: 0.5, default: 6 },
    { key: 'angle', label: 'Direzione (gradi)', type: 'range', min: 0, max: 360, step: 1, default: 45 },
    { key: 'swap', label: 'Scambia i ruoli', type: 'bool', default: false },
  ],
  run(inputs, p) {
    let [a, b] = align(inputs);
    if (p.swap) [a, b] = [b, a];
    const { width: w, height: h } = a;
    const out = createImage(w, h, null);
    const s = (p.strength / 100) * Math.max(w, h), ang = (p.angle * Math.PI) / 180;
    const dx = Math.cos(ang), dy = Math.sin(ang), px = [0, 0, 0, 0];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const d = (luma(a.data[i], a.data[i + 1], a.data[i + 2]) / 255 - 0.5) * 2 * s;
      sample(b, x + dx * d, y + dy * d, px);
      out.data[i] = px[0]; out.data[i + 1] = px[1]; out.data[i + 2] = px[2]; out.data[i + 3] = 255;
    }
    return out;
  },
};

const intreccio = {
  id: 'intreccio',
  name: 'Intreccio a strisce',
  category: 'combinazione',
  inputs: { min: 2, max: 4 },
  description: "Alterna strisce sottili delle sorgenti, come una tessitura: da lontano le immagini si fondono, da vicino si contendono lo spazio.",
  params: [
    { key: 'width', label: 'Larghezza striscia (px)', type: 'range', min: 1, max: 200, step: 1, default: 12 },
    { key: 'angle', label: 'Inclinazione (gradi)', type: 'range', min: 0, max: 180, step: 1, default: 90 },
    { key: 'shift', label: 'Sfasamento sorgenti (px)', type: 'range', min: 0, max: 200, step: 1, default: 0 },
  ],
  run(inputs, p) {
    const imgs = align(inputs);
    const { width: w, height: h } = imgs[0];
    const out = createImage(w, h, null);
    const a = (p.angle * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const t = x * ca + y * sa;
      const k = ((Math.floor(t / p.width) % imgs.length) + imgs.length) % imgs.length;
      const sx = clamp(x + k * p.shift, 0, w - 1), si = (y * w + sx) * 4, di = (y * w + x) * 4;
      const src = imgs[k];
      out.data[di] = src.data[si]; out.data[di + 1] = src.data[si + 1]; out.data[di + 2] = src.data[si + 2]; out.data[di + 3] = 255;
    }
    return out;
  },
};

const fusione = {
  id: 'fusione',
  name: 'Fusione',
  category: 'combinazione',
  inputs: { min: 2, max: 4 },
  description: "Sovrappone le sorgenti con un metodo di fusione. La differenza è la più ambigua: resta solo ciò in cui le immagini non coincidono.",
  params: [
    { key: 'mode', label: 'Metodo', type: 'select', options: [['difference', 'Differenza'], ['multiply', 'Moltiplica'], ['screen', 'Scherma'], ['exclusion', 'Esclusione'], ['lighten', 'Schiarisci'], ['darken', 'Scurisci']], default: 'difference' },
    { key: 'opacity', label: 'Opacità', type: 'range', min: 0, max: 1, step: 0.05, default: 1 },
  ],
  run(inputs, p) {
    const imgs = align(inputs);
    const { width: w, height: h } = imgs[0];
    const out = createImage(w, h, null);
    out.data.set(imgs[0].data);
    const f = {
      difference: (a, b) => Math.abs(a - b), multiply: (a, b) => (a * b) / 255, screen: (a, b) => 255 - ((255 - a) * (255 - b)) / 255,
      exclusion: (a, b) => a + b - (2 * a * b) / 255, lighten: Math.max, darken: Math.min,
    }[p.mode] || ((a, b) => Math.abs(a - b));
    for (let k = 1; k < imgs.length; k++) {
      const d = imgs[k].data;
      for (let i = 0; i < w * h * 4; i += 4) for (let c = 0; c < 3; c++) {
        const a = out.data[i + c];
        out.data[i + c] = a + (f(a, d[i + c]) - a) * p.opacity;
      }
    }
    return out;
  },
};

export default [cadavere, mascheraluce, spostamento, intreccio, fusione];
