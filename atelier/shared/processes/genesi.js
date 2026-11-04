// Processi per partire da zero. Un'immagine facoltativa presta solo la palette.
import { createImage, makeNoise, paletteFrom, rampColor, clamp, coverResize, luma } from '../image.js';

const sizeParams = [
  { key: 'format', label: 'Formato', type: 'select', options: [['3:2', '3:2 orizzontale'], ['2:3', '2:3 verticale'], ['1:1', '1:1'], ['4:5', '4:5'], ['16:9', '16:9']], default: '3:2' },
  { key: 'size', label: 'Lato lungo (px)', type: 'range', min: 600, max: 6000, step: 100, default: 3000 },
];

export function genesisSize(p) {
  const [a, b] = String(p.format || '3:2').split(':').map(Number);
  const long = p.size || 3000;
  return a >= b ? [long, Math.round((long * b) / a)] : [Math.round((long * a) / b), long];
}

const rumore = {
  id: 'rumore',
  name: 'Campo di rumore deformato',
  category: 'genesi',
  inputs: { min: 0, max: 1 },
  description: "Un rumore frattale piegato su se stesso più volte: geologie, nebbie, tessuti che non appartengono a nessun luogo.",
  params: [
    ...sizeParams,
    { key: 'scale', label: 'Scala', type: 'range', min: 0.5, max: 20, step: 0.1, default: 3 },
    { key: 'warp', label: 'Torsione', type: 'range', min: 0, max: 6, step: 0.1, default: 2 },
    { key: 'octaves', label: 'Dettaglio', type: 'range', min: 1, max: 8, step: 1, default: 5 },
    { key: 'bands', label: 'Stratificazione', type: 'range', min: 0, max: 12, step: 1, default: 0 },
  ],
  run(inputs, p, rng) {
    const [w, h] = genesisSize(p);
    const out = createImage(w, h, null);
    const n = makeNoise(rng), pal = paletteFrom(inputs[0], rng, 6), px = [0, 0, 0, 0];
    const s = p.scale / Math.max(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x * s, v = y * s;
      const qx = n.fbm(u, v, p.octaves), qy = n.fbm(u + 5.2, v + 1.3, p.octaves);
      let t = n.fbm(u + p.warp * qx, v + p.warp * qy, p.octaves);
      if (p.bands > 0) t = (t * p.bands) % 1;
      rampColor(pal, clamp((t - 0.25) * 2, 0, 1), px);
      const i = (y * w + x) * 4;
      out.data[i] = px[0]; out.data[i + 1] = px[1]; out.data[i + 2] = px[2]; out.data[i + 3] = 255;
    }
    return out;
  },
};

const flusso = {
  id: 'flusso',
  name: 'Campo di flusso',
  category: 'genesi',
  inputs: { min: 0, max: 1 },
  description: "Migliaia di tracce seguono correnti invisibili. Con un'immagine sorgente le tracce ne prendono il colore e ne ricalcano le zone.",
  params: [
    ...sizeParams,
    { key: 'particles', label: 'Tracce', type: 'range', min: 200, max: 20000, step: 100, default: 4000 },
    { key: 'length', label: 'Lunghezza', type: 'range', min: 10, max: 800, step: 10, default: 160 },
    { key: 'turbulence', label: 'Turbolenza', type: 'range', min: 0.5, max: 12, step: 0.1, default: 3 },
    { key: 'ground', label: 'Fondo', type: 'select', options: [['dark', 'Scuro'], ['light', 'Chiaro'], ['source', "Dall'immagine"]], default: 'dark' },
  ],
  run(inputs, p, rng) {
    const [w, h] = genesisSize(p);
    const src = inputs[0] ? coverResize(inputs[0], w, h) : null;
    const pal = paletteFrom(inputs[0], rng, 5);
    const ground = p.ground === 'light' ? [236, 232, 224] : p.ground === 'source' && src ? null : [14, 14, 16];
    const out = ground ? createImage(w, h, [...ground, 255]) : { width: w, height: h, data: new Uint8ClampedArray(src.data) };
    const n = makeNoise(rng), s = p.turbulence / Math.max(w, h);
    const alpha = 0.18;
    for (let k = 0; k < p.particles; k++) {
      let x = rng() * w, y = rng() * h;
      const col = src ? Array.from(src.data.subarray(((y | 0) * w + (x | 0)) * 4, ((y | 0) * w + (x | 0)) * 4 + 3)) : pal[rng.int(0, pal.length - 1)];
      for (let step = 0; step < p.length; step++) {
        const a = n.fbm(x * s, y * s, 3) * Math.PI * 4;
        x += Math.cos(a); y += Math.sin(a);
        if (x < 0 || y < 0 || x >= w || y >= h) break;
        const i = ((y | 0) * w + (x | 0)) * 4;
        for (let c = 0; c < 3; c++) out.data[i + c] += (col[c] - out.data[i + c]) * alpha;
      }
    }
    return out;
  },
};

const voronoi = {
  id: 'voronoi',
  name: 'Fratture di Voronoi',
  category: 'genesi',
  inputs: { min: 0, max: 1 },
  description: "Lo spazio si divide in celle attorno a semi sparsi. Con un'immagine, ogni cella ne trattiene un frammento spostato.",
  params: [
    ...sizeParams,
    { key: 'cells', label: 'Celle', type: 'range', min: 3, max: 600, step: 1, default: 60 },
    { key: 'edges', label: 'Spessore fratture (px)', type: 'range', min: 0, max: 20, step: 1, default: 2 },
    { key: 'displace', label: 'Spostamento frammenti (%)', type: 'range', min: 0, max: 30, step: 0.5, default: 6 },
  ],
  run(inputs, p, rng) {
    const [w, h] = genesisSize(p);
    const src = inputs[0] ? coverResize(inputs[0], w, h) : null;
    const pal = paletteFrom(inputs[0], rng, 6);
    const pts = Array.from({ length: p.cells }, () => ({
      x: rng() * w, y: rng() * h, col: pal[rng.int(0, pal.length - 1)],
      dx: (rng() * 2 - 1) * (p.displace / 100) * w, dy: (rng() * 2 - 1) * (p.displace / 100) * h,
    }));
    // Griglia di accelerazione: per ogni pixel si cercano i semi vicini.
    const gs = Math.max(8, Math.sqrt((w * h) / p.cells)), gw = Math.ceil(w / gs), gh = Math.ceil(h / gs);
    const grid = Array.from({ length: gw * gh }, () => []);
    pts.forEach((pt, k) => grid[Math.min(gh - 1, (pt.y / gs) | 0) * gw + Math.min(gw - 1, (pt.x / gs) | 0)].push(k));
    const out = createImage(w, h, null);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let b1 = Infinity, b2 = Infinity, best = 0;
      const gx = (x / gs) | 0, gy = (y / gs) | 0;
      for (let r = 1; r <= 3 && (b1 === Infinity || r <= 2); r++) {
        for (let yy = Math.max(0, gy - r); yy <= Math.min(gh - 1, gy + r); yy++) for (let xx = Math.max(0, gx - r); xx <= Math.min(gw - 1, gx + r); xx++) {
          for (const k of grid[yy * gw + xx]) {
            const d = (pts[k].x - x) ** 2 + (pts[k].y - y) ** 2;
            if (d < b1) { b2 = b1; b1 = d; best = k; } else if (d < b2 && k !== best) b2 = d;
          }
        }
        if (b2 !== Infinity) break;
      }
      const i = (y * w + x) * 4, pt = pts[best];
      if (Math.sqrt(b2) - Math.sqrt(b1) < p.edges) { out.data[i] = out.data[i + 1] = out.data[i + 2] = 8; }
      else if (src) {
        const sx = clamp(Math.round(x + pt.dx), 0, w - 1), sy = clamp(Math.round(y + pt.dy), 0, h - 1), si = (sy * w + sx) * 4;
        out.data[i] = src.data[si]; out.data[i + 1] = src.data[si + 1]; out.data[i + 2] = src.data[si + 2];
      } else {
        const shade = 0.75 + 0.25 * (1 - Math.sqrt(b1) / gs);
        out.data[i] = pt.col[0] * shade; out.data[i + 1] = pt.col[1] * shade; out.data[i + 2] = pt.col[2] * shade;
      }
      out.data[i + 3] = 255;
    }
    return out;
  },
};

const automa = {
  id: 'automa',
  name: 'Automa cellulare',
  category: 'genesi',
  inputs: { min: 0, max: 1 },
  description: "Una regola elementare applicata riga dopo riga: ordine e caos nascono dallo stesso numero. Con un'immagine, la prima riga viene dalle sue luci.",
  params: [
    ...sizeParams,
    { key: 'rule', label: 'Regola (0-255)', type: 'range', min: 0, max: 255, step: 1, default: 110 },
    { key: 'cell', label: 'Dimensione cella (px)', type: 'range', min: 1, max: 40, step: 1, default: 4 },
    { key: 'density', label: 'Densità iniziale', type: 'range', min: 0.01, max: 0.99, step: 0.01, default: 0.5 },
  ],
  run(inputs, p, rng) {
    const [w, h] = genesisSize(p);
    const cw = Math.ceil(w / p.cell), chh = Math.ceil(h / p.cell);
    const pal = paletteFrom(inputs[0], rng, 4);
    let row = new Uint8Array(cw);
    const src = inputs[0] ? coverResize(inputs[0], cw, 1) : null;
    for (let x = 0; x < cw; x++) row[x] = src ? (luma(src.data[x * 4], src.data[x * 4 + 1], src.data[x * 4 + 2]) > 255 * (1 - p.density) ? 1 : 0) : rng() < p.density ? 1 : 0;
    const out = createImage(w, h, null);
    const on = pal[pal.length - 1], off = pal[0];
    for (let r = 0; r < chh; r++) {
      for (let y = r * p.cell; y < Math.min(h, (r + 1) * p.cell); y++) for (let x = 0; x < w; x++) {
        const v = row[(x / p.cell) | 0], c = v ? on : off, i = (y * w + x) * 4;
        out.data[i] = c[0]; out.data[i + 1] = c[1]; out.data[i + 2] = c[2]; out.data[i + 3] = 255;
      }
      const next = new Uint8Array(cw);
      for (let x = 0; x < cw; x++) {
        const k = (row[(x - 1 + cw) % cw] << 2) | (row[x] << 1) | row[(x + 1) % cw];
        next[x] = (p.rule >> k) & 1;
      }
      row = next;
    }
    return out;
  },
};

export default [rumore, flusso, voronoi, automa];
