// Misure di una clip, calcolate rendendola piccola dal fotogramma 0.
// Servono all'interlocutore per parlare di ciò che succede davvero sullo
// schermo, non di ciò che dicono i parametri.

import { dims } from './clip.js';
import { seekVideo, videoTime } from '../media.js';

function frameStats(px, w, h) {
  const n = w * h;
  let sl = 0, sl2 = 0, ss = 0, edge = 0, sym = 0, purple = 0, bright = 0, dark = 0;
  const L = new Float32Array(n);
  const hues = new Float32Array(12);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const r = px[j] / 255, g = px[j + 1] / 255, b = px[j + 2] / 255;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    L[i] = l; sl += l; sl2 += l * l;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const s = mx > 0 ? (mx - mn) / mx : 0;
    ss += s;
    if (l > 0.92) bright++;
    if (l < 0.04) dark++;
    if (s > 0.15 && mx > 0.08) {
      let hh;
      if (mx === r) hh = ((g - b) / (mx - mn)) % 6; else if (mx === g) hh = (b - r) / (mx - mn) + 2; else hh = (r - g) / (mx - mn) + 4;
      hh = ((hh * 60) + 360) % 360;
      hues[Math.floor(hh / 30) % 12] += s;
      if (hh > 250 && hh < 330 && s > 0.35) purple++;
    }
  }
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    edge += Math.abs(L[i + 1] - L[i - 1]) + Math.abs(L[i + w] - L[i - w]);
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w / 2; x++) sym += Math.abs(L[y * w + x] - L[y * w + (w - 1 - x)]);
  const mean = sl / n;
  return {
    L, mean, contrast: Math.sqrt(Math.max(0, sl2 / n - mean * mean)), sat: ss / n,
    edges: edge / ((w - 2) * (h - 2)), symmetry: 1 - Math.min(1, (sym / (n / 2)) * 4),
    purple: purple / n, clipHi: bright / n, clipLo: dark / n, hues,
  };
}

const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };

/** Rende la clip a 192 px e ne misura spazio e tempo. */
export async function analyse(renderer, items, clip, { samples = 8 } = {}) {
  const { w, h } = dims(clip.format.aspect, 192);
  const r = renderer;
  r.setSize(w, h); r.prune([]); r.reset();
  const fps = clip.format.fps, total = Math.round(clip.format.duration * fps);
  const pick = new Set(Array.from({ length: samples }, (_, i) => Math.min(total - 1, Math.round(((i + 0.5) / samples) * total))));
  const means = [];
  const shots = [];
  let prevL = null, motion = 0, motionN = 0, first = null, last = null;
  const stats = [];
  for (let f = 0; f < total; f++) {
    const t = f / fps;
    if (f % 4 === 0) for (const s of items) if (s.kind === 'video') await seekVideo(s.el, videoTime(s, t));
    r.render(clip, t, f, null, { display: pick.has(f) });
    const px = r.readRGBA8();
    const st = frameStats(px, w, h);
    means.push(st.mean);
    if (prevL) { motion += diff(st.L, prevL); motionN++; }
    prevL = st.L;
    if (f === 0) first = st.L;
    if (f === total - 1) last = st.L;
    if (pick.has(f)) { stats.push(st); shots.push(r.canvas.toDataURL('image/jpeg', 0.8)); }
    if (f % 30 === 29) await new Promise((res) => setTimeout(res, 0));
  }
  let flick = 0;
  for (let i = 1; i < means.length; i++) flick += Math.abs(means[i] - means[i - 1]);
  flick /= Math.max(1, means.length - 1);
  // varietà: quanto cambiano le immagini campionate tra loro
  let variety = 0, vn = 0;
  for (let i = 0; i < stats.length; i++) for (let j = i + 1; j < stats.length; j++) { variety += diff(stats[i].L, stats[j].L); vn++; }
  variety /= Math.max(1, vn);
  const avg = (k) => stats.reduce((a, s) => a + s[k], 0) / stats.length;
  const hues = new Float32Array(12); stats.forEach((s) => s.hues.forEach((v, i) => { hues[i] += v; }));
  const hueTot = hues.reduce((a, b) => a + b, 0) || 1;
  const domHue = hues.indexOf(Math.max(...hues)) * 30 + 15;
  const metrics = {
    luminosita: +avg('mean').toFixed(3),
    contrasto: +avg('contrast').toFixed(3),
    saturazione: +avg('sat').toFixed(3),
    densita_bordi: +avg('edges').toFixed(3),
    simmetria: +avg('symmetry').toFixed(3),
    movimento: +(motion / Math.max(1, motionN)).toFixed(4),
    sfarfallio: +flick.toFixed(4),
    varieta_nel_tempo: +variety.toFixed(3),
    chiusura_loop: first && last ? +diff(first, last).toFixed(3) : null,
    bruciato_bianco: +avg('clipHi').toFixed(3),
    chiuso_nero: +avg('clipLo').toFixed(3),
    viola_magenta: +avg('purple').toFixed(3),
    tinta_dominante_gradi: hueTot > 1 ? domHue : null,
    fotogrammi: total,
  };
  return { metrics, shots };
}

/** Provino 4×2 in JPEG, da mandare a Claude. */
export async function contactSheet(shots) {
  const imgs = await Promise.all(shots.map((s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = s; })));
  const w = imgs[0].naturalWidth, h = imgs[0].naturalHeight;
  const c = document.createElement('canvas');
  c.width = w * 4 + 3; c.height = h * 2 + 1;
  const g = c.getContext('2d');
  g.fillStyle = '#333'; g.fillRect(0, 0, c.width, c.height);
  imgs.forEach((im, i) => g.drawImage(im, (i % 4) * (w + 1), Math.floor(i / 4) * (h + 1)));
  return c.toDataURL('image/jpeg', 0.85);
}
