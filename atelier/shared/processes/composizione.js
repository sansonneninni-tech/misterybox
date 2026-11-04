// Processi che agiscono sulla struttura dell'immagine: dove stanno le cose,
// non di che colore sono.
import { createImage, sample, clamp } from '../image.js';

const tessere = {
  id: 'tessere',
  name: 'Tessere rimescolate',
  category: 'composizione',
  inputs: { min: 1, max: 1 },
  description: "Divide l'immagine in una griglia e sposta una parte delle tessere: la scena resta riconoscibile ma la sua logica si incrina.",
  params: [
    { key: 'cols', label: 'Colonne', type: 'range', min: 2, max: 40, step: 1, default: 8 },
    { key: 'rows', label: 'Righe', type: 'range', min: 2, max: 40, step: 1, default: 6 },
    { key: 'mix', label: 'Quota rimescolata', type: 'range', min: 0, max: 1, step: 0.05, default: 0.35 },
    { key: 'flip', label: 'Tessere capovolte', type: 'range', min: 0, max: 1, step: 0.05, default: 0.1 },
  ],
  run([img], p, rng) {
    const { width: w, height: h } = img;
    const out = createImage(w, h, null);
    const cells = [];
    for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) cells.push([c, r]);
    const order = cells.map((_, i) => i);
    const moving = order.filter(() => rng() < p.mix);
    const shuffled = rng.shuffle([...moving]);
    moving.forEach((from, k) => { order[from] = shuffled[k]; });
    const cw = w / p.cols, ch = h / p.rows;
    cells.forEach(([c, r], i) => {
      const [sc, sr] = cells[order[i]];
      const fx = rng() < p.flip, fy = rng() < p.flip * 0.5;
      const x0 = Math.round(c * cw), x1 = Math.round((c + 1) * cw), y0 = Math.round(r * ch), y1 = Math.round((r + 1) * ch);
      const sx0 = Math.round(sc * cw), sy0 = Math.round(sr * ch);
      const sw = Math.round((sc + 1) * cw) - sx0, sh = Math.round((sr + 1) * ch) - sy0;
      for (let y = y0; y < y1; y++) {
        let sy = sy0 + Math.min(sh - 1, y - y0);
        if (fy) sy = sy0 + sh - 1 - Math.min(sh - 1, y - y0);
        for (let x = x0; x < x1; x++) {
          let sx = sx0 + Math.min(sw - 1, x - x0);
          if (fx) sx = sx0 + sw - 1 - Math.min(sw - 1, x - x0);
          const si = (clamp(sy, 0, h - 1) * w + clamp(sx, 0, w - 1)) * 4, di = (y * w + x) * 4;
          out.data[di] = img.data[si]; out.data[di + 1] = img.data[si + 1]; out.data[di + 2] = img.data[si + 2]; out.data[di + 3] = 255;
        }
      }
    });
    return out;
  },
};

const caleidoscopio = {
  id: 'caleidoscopio',
  name: 'Piega a caleidoscopio',
  category: 'composizione',
  inputs: { min: 1, max: 1 },
  description: "Ripiega un settore dell'immagine attorno a un centro spostato: simmetrie imperfette, un ordine che sembra rituale.",
  params: [
    { key: 'segments', label: 'Settori', type: 'range', min: 2, max: 16, step: 1, default: 6 },
    { key: 'rotation', label: 'Rotazione', type: 'range', min: 0, max: 360, step: 1, default: 0 },
    { key: 'cx', label: 'Centro X', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: 'cy', label: 'Centro Y', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: 'zoom', label: 'Zoom', type: 'range', min: 0.3, max: 3, step: 0.05, default: 1 },
  ],
  run([img], p) {
    const { width: w, height: h } = img;
    const out = createImage(w, h, null);
    const seg = (Math.PI * 2) / p.segments, rot = (p.rotation * Math.PI) / 180;
    const cx = p.cx * w, cy = p.cy * h, px = [0, 0, 0, 0];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - w / 2, dy = y - h / 2;
        const r = Math.hypot(dx, dy) / p.zoom;
        let a = Math.atan2(dy, dx) - rot;
        a = ((a % seg) + seg) % seg;
        if (a > seg / 2) a = seg - a;
        sample(img, cx + Math.cos(a + rot) * r, cy + Math.sin(a + rot) * r, px);
        const i = (y * w + x) * 4;
        out.data[i] = px[0]; out.data[i + 1] = px[1]; out.data[i + 2] = px[2]; out.data[i + 3] = 255;
      }
    }
    return out;
  },
};

const deriva = {
  id: 'deriva',
  name: "Deriva d'inquadratura",
  category: 'composizione',
  inputs: { min: 1, max: 1 },
  description: "Sceglie un ritaglio estremo e lo riporta a piena dimensione: un dettaglio marginale diventa il soggetto.",
  params: [
    { key: 'zoom', label: 'Ingrandimento', type: 'range', min: 1.2, max: 12, step: 0.1, default: 4 },
    { key: 'fx', label: 'Fuoco X (-1 = casuale)', type: 'range', min: -1, max: 1, step: 0.01, default: -1 },
    { key: 'fy', label: 'Fuoco Y (-1 = casuale)', type: 'range', min: -1, max: 1, step: 0.01, default: -1 },
    { key: 'tilt', label: 'Inclinazione (gradi)', type: 'range', min: -45, max: 45, step: 1, default: 0 },
  ],
  run([img], p, rng) {
    const { width: w, height: h } = img;
    const out = createImage(w, h, null);
    const fx = p.fx < 0 ? rng() : p.fx, fy = p.fy < 0 ? rng() : p.fy;
    const cw = w / p.zoom, ch = h / p.zoom;
    const cx = cw / 2 + fx * (w - cw), cy = ch / 2 + fy * (h - ch);
    const t = (p.tilt * Math.PI) / 180, cos = Math.cos(t), sin = Math.sin(t), px = [0, 0, 0, 0];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = (x - w / 2) / p.zoom, v = (y - h / 2) / p.zoom;
        sample(img, cx + u * cos - v * sin, cy + u * sin + v * cos, px);
        const i = (y * w + x) * 4;
        out.data[i] = px[0]; out.data[i + 1] = px[1]; out.data[i + 2] = px[2]; out.data[i + 3] = 255;
      }
    }
    return out;
  },
};

const frattura = {
  id: 'frattura',
  name: 'Frattura radiale',
  category: 'composizione',
  inputs: { min: 1, max: 1 },
  description: "Taglia l'immagine in spicchi attorno a un punto e ruota ciascuno di un angolo diverso, come un vetro incrinato.",
  params: [
    { key: 'slices', label: 'Spicchi', type: 'range', min: 3, max: 48, step: 1, default: 12 },
    { key: 'twist', label: 'Rotazione massima (gradi)', type: 'range', min: 0, max: 90, step: 1, default: 14 },
    { key: 'cx', label: 'Centro X', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: 'cy', label: 'Centro Y', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
  ],
  run([img], p, rng) {
    const { width: w, height: h } = img;
    const out = createImage(w, h, null);
    const cx = p.cx * w, cy = p.cy * h;
    const cuts = Array.from({ length: p.slices }, () => rng() * Math.PI * 2).sort((a, b) => a - b);
    const twists = cuts.map(() => ((rng() * 2 - 1) * p.twist * Math.PI) / 180);
    const px = [0, 0, 0, 0];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx, dy = y - cy;
        let a = Math.atan2(dy, dx); if (a < 0) a += Math.PI * 2;
        let k = cuts.findIndex((c) => c > a); k = k <= 0 ? cuts.length - 1 : k - 1;
        const t = twists[k], cos = Math.cos(t), sin = Math.sin(t);
        sample(img, cx + dx * cos - dy * sin, cy + dx * sin + dy * cos, px);
        const i = (y * w + x) * 4;
        out.data[i] = px[0]; out.data[i + 1] = px[1]; out.data[i + 2] = px[2]; out.data[i + 3] = 255;
      }
    }
    return out;
  },
};

const slitscan = {
  id: 'slitscan',
  name: 'Slit-scan ondulato',
  category: 'composizione',
  inputs: { min: 1, max: 1 },
  description: "Sposta ogni riga (o colonna) lungo un'onda irregolare: il tempo di uno scatto sembra essersi allungato.",
  params: [
    { key: 'direction', label: 'Direzione', type: 'select', options: [['h', 'Righe'], ['v', 'Colonne']], default: 'h' },
    { key: 'amplitude', label: 'Ampiezza (% lato)', type: 'range', min: 0, max: 50, step: 0.5, default: 8 },
    { key: 'waves', label: 'Onde', type: 'range', min: 0.2, max: 30, step: 0.1, default: 3 },
    { key: 'chaos', label: 'Irregolarità', type: 'range', min: 0, max: 1, step: 0.05, default: 0.3 },
  ],
  run([img], p, rng) {
    const { width: w, height: h } = img;
    const out = createImage(w, h, null);
    const horiz = p.direction !== 'v';
    const n = horiz ? h : w, len = horiz ? w : h;
    const amp = (p.amplitude / 100) * len, phase = rng() * Math.PI * 2;
    const offsets = new Float32Array(n);
    let drift = 0;
    for (let i = 0; i < n; i++) {
      drift += (rng() * 2 - 1) * p.chaos * 0.02 * len;
      drift *= 0.98;
      offsets[i] = Math.sin((i / n) * p.waves * Math.PI * 2 + phase) * amp + drift;
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sx = x, sy = y;
        if (horiz) sx = (((x + offsets[y]) % w) + w) % w; else sy = (((y + offsets[x]) % h) + h) % h;
        const si = ((sy | 0) * w + (sx | 0)) * 4, di = (y * w + x) * 4;
        out.data[di] = img.data[si]; out.data[di + 1] = img.data[si + 1]; out.data[di + 2] = img.data[si + 2]; out.data[di + 3] = 255;
      }
    }
    return out;
  },
};

const riflesso = {
  id: 'riflesso',
  name: 'Riflesso asimmetrico',
  category: 'composizione',
  inputs: { min: 1, max: 1 },
  description: "Specchia una parte dell'immagine lungo un asse fuori centro: nasce un doppio che non torna del tutto.",
  params: [
    { key: 'axis', label: 'Asse', type: 'select', options: [['v', 'Verticale'], ['h', 'Orizzontale']], default: 'v' },
    { key: 'pos', label: 'Posizione asse', type: 'range', min: 0.1, max: 0.9, step: 0.01, default: 0.42 },
    { key: 'side', label: 'Lato copiato', type: 'select', options: [['a', 'Primo'], ['b', 'Secondo']], default: 'a' },
    { key: 'slip', label: 'Scivolamento (%)', type: 'range', min: 0, max: 30, step: 0.5, default: 3 },
  ],
  run([img], p) {
    const { width: w, height: h } = img;
    const out = createImage(w, h, null);
    const vert = p.axis !== 'h';
    const ax = (vert ? w : h) * p.pos, slip = (p.slip / 100) * (vert ? h : w);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sx = x, sy = y;
        const t = vert ? x : y;
        const mirrored = p.side === 'a' ? t > ax : t < ax;
        if (mirrored) {
          if (vert) { sx = 2 * ax - x; sy = y + slip; } else { sy = 2 * ax - y; sx = x + slip; }
        }
        sx = clamp(Math.round(sx), 0, w - 1); sy = clamp(Math.round(sy), 0, h - 1);
        const si = (sy * w + sx) * 4, di = (y * w + x) * 4;
        out.data[di] = img.data[si]; out.data[di + 1] = img.data[si + 1]; out.data[di + 2] = img.data[si + 2]; out.data[di + 3] = 255;
      }
    }
    return out;
  },
};

export default [tessere, caleidoscopio, deriva, frattura, slitscan, riflesso];
