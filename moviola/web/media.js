// Sorgenti: caricamento di immagini e video, miniature, sincronia del tempo.

const cache = new Map(); // url -> Promise<{ el, w, h, kind, duration }>

export function loadMedia(url, kind) {
  const k = kind + '|' + url;
  if (cache.has(k)) return cache.get(k);
  const p = kind === 'video' ? loadVideo(url) : loadImage(url);
  cache.set(k, p);
  p.catch(() => cache.delete(k));
  return p;
}

function loadImage(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => res({ el: img, w: img.naturalWidth, h: img.naturalHeight, kind: 'image' });
    img.onerror = () => rej(new Error('Immagine non leggibile da questo browser'));
    img.src = url;
  });
}

function loadVideo(url) {
  return new Promise((res, rej) => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.loop = true; v.preload = 'auto';
    v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    v.crossOrigin = 'anonymous';
    const fail = () => rej(new Error('Video non leggibile da questo browser'));
    v.onerror = fail;
    v.onloadeddata = () => res({ el: v, w: v.videoWidth, h: v.videoHeight, kind: 'video', duration: v.duration });
    v.src = url;
    v.load();
  });
}

/** Porta un video a un istante preciso e aspetta che il fotogramma sia pronto. */
export function seekVideo(v, t) {
  return new Promise((res) => {
    const d = v.duration || 1;
    const target = Math.max(0, Math.min(d - 0.001, t));
    if (Math.abs(v.currentTime - target) < 0.0005 && v.readyState >= 2) return res();
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(to); res(); };
    const to = setTimeout(finish, 1500);
    v.addEventListener('seeked', () => {
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(() => finish());
      else finish();
      setTimeout(finish, 120);
    }, { once: true });
    v.currentTime = target;
  });
}

export function videoTime(src, t) {
  const d = src.el?.duration || src.duration || 1;
  const x = (src.start || 0) + t * (src.speed ?? 1);
  return ((x % d) + d) % d;
}

/** Miniatura JPEG (lato lungo 360px) da un'immagine o da un video. */
export async function makeThumb(media) {
  const el = media.el;
  if (media.kind === 'video') await seekVideo(el, Math.min(1, (el.duration || 1) * 0.2));
  const w = media.w, h = media.h;
  const s = 360 / Math.max(w, h);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
  c.getContext('2d').drawImage(el, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}
