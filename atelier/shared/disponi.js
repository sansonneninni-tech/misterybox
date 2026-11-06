// Disposizione delle immagini prima di un processo: ribalta, ruota, sposta, scala.
// Una voce per immagine, nello stesso ordine degli input:
// { fh: bool, fv: bool, r: 0|90|180|270, x: -1..1, y: -1..1, s: 0.2..4 }
// x e y sono frazioni del lato: restano uguali tra anteprima e piena risoluzione.
import { createImage } from './image.js';

const ID = { fh: false, fv: false, r: 0, x: 0, y: 0, s: 1 };

export function cleanLayout(list) {
  if (!Array.isArray(list)) return null;
  const out = list.slice(0, 8).map((d) => {
    const v = d || {};
    const num = (k, lo, hi) => { const n = Number(v[k]); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : ID[k]; };
    const r = ((Math.round(Number(v.r) / 90) * 90) % 360 + 360) % 360 || 0;
    return { fh: !!v.fh, fv: !!v.fv, r, x: +num('x', -1, 1).toFixed(4), y: +num('y', -1, 1).toFixed(4), s: +num('s', 0.2, 4).toFixed(3) };
  });
  return out.some((d) => !isIdentity(d)) ? out : null;
}

export const isIdentity = (d) => !d || (!d.fh && !d.fv && !d.r && !d.x && !d.y && (d.s ?? 1) === 1);

// Ribalta e ruota (senza perdita), poi sposta e scala nello stesso riquadro.
export function applyLayout(img, d) {
  if (isIdentity(d)) return img;
  let out = img;
  if (d.fh || d.fv || d.r) {
    const { width: w, height: h, data } = img;
    const swap = d.r === 90 || d.r === 270;
    const W = swap ? h : w, H = swap ? w : h;
    out = createImage(W, H, null);
    const o = out.data;
    for (let Y = 0; Y < H; Y++) {
      for (let X0 = 0; X0 < W; X0++) {
        // Il ribaltamento vale per ciò che si vede (dopo la rotazione).
        const X = d.fh ? W - 1 - X0 : X0, Yv = d.fv ? H - 1 - Y : Y;
        let sx, sy;
        if (d.r === 90) { sx = Yv; sy = h - 1 - X; }
        else if (d.r === 180) { sx = w - 1 - X; sy = h - 1 - Yv; }
        else if (d.r === 270) { sx = w - 1 - Yv; sy = X; }
        else { sx = X; sy = Yv; }
        const si = (sy * w + sx) * 4, di = (Y * W + X0) * 4;
        o[di] = data[si]; o[di + 1] = data[si + 1]; o[di + 2] = data[si + 2]; o[di + 3] = data[si + 3];
      }
    }
  }
  const s = d.s ?? 1, x = d.x || 0, y = d.y || 0;
  if (s === 1 && !x && !y) return out;
  const { width: W, height: H, data } = out;
  const res = createImage(W, H, [0, 0, 0, 255]);
  const o = res.data;
  const cx = W / 2 + x * W, cy = H / 2 + y * H;
  for (let Y = 0; Y < H; Y++) {
    const sy = Math.floor((Y - cy) / s + H / 2);
    if (sy < 0 || sy >= H) continue;
    for (let X = 0; X < W; X++) {
      const sx = Math.floor((X - cx) / s + W / 2);
      if (sx < 0 || sx >= W) continue;
      const si = (sy * W + sx) * 4, di = (Y * W + X) * 4;
      o[di] = data[si]; o[di + 1] = data[si + 1]; o[di + 2] = data[si + 2]; o[di + 3] = data[si + 3];
    }
  }
  return res;
}
