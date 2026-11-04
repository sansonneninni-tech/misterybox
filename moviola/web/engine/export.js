// Render finale, fotogramma per fotogramma, sempre dal fotogramma 0.
// Con il server: RGB 16 bit verso ffmpeg (ProRes, sequenze 16 bit).
// Nella pagina demo: sequenza PNG 16 bit in un .zip, oppure WebM.

import { dims } from './clip.js';
import { byId } from './processes.js';
import { seekVideo, videoTime } from '../media.js';

/**
 * opts: { renderer, items (sorgenti caricate sul renderer), clip, long,
 *         codec, name, meta, onProgress(i, n, etaS), signal }
 */
export async function renderToServer(opts) {
  const { renderer: r, items, clip, long, codec, name, meta, onProgress, signal } = opts;
  const { w, h } = dims(clip.format.aspect, long);
  const fps = clip.format.fps;
  const total = Math.round(clip.format.duration * fps);
  r.setSize(w, h); r.prune([]); r.reset();
  const start = await fetch('/api/render', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codec, w, h, fps, frames: total, name, meta: { ...meta, precisione: r.float ? 'virgola mobile 16 bit (half float) per canale, letto a 32 bit e scritto a 16' : '8 bit per canale (il browser non offre buffer in virgola mobile)' } }) });
  if (!start.ok) throw new Error(await start.text());
  const job = await start.json();
  const buf = new Uint16Array(w * h * 3);
  const t0 = performance.now();
  let pending = null;
  try {
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw new DOMException('annullato', 'AbortError');
      const t = i / fps;
      for (const s of items) if (s.kind === 'video') await seekVideo(s.el, videoTime(s, t));
      r.render(clip, t, i, null, { display: false });
      if (pending) await pending; // il fotogramma prima deve essere arrivato
      const data = r.readRGB16(buf).slice();
      pending = fetch(`/api/render/${job.id}/frame`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: data.buffer })
        .then(async (x) => { if (!x.ok) throw new Error(await x.text()); });
      const el = (performance.now() - t0) / 1000;
      onProgress && onProgress(i + 1, total, (el / (i + 1)) * (total - i - 1));
    }
    await pending;
    const end = await fetch(`/api/render/${job.id}/end`, { method: 'POST' });
    if (!end.ok) throw new Error(await end.text());
    return await end.json();
  } catch (e) {
    fetch(`/api/render/${job.id}/abort`, { method: 'POST' }).catch(() => {});
    throw e;
  }
}

// ---------------------------------------------------------------- PNG 16 bit
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes, c = 0xffffffff) { for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8); return c; }
const crcEnd = (c) => (c ^ 0xffffffff) >>> 0;

async function deflate(u8) {
  const cs = new CompressionStream('deflate');
  const out = new Response(new Blob([u8]).stream().pipeThrough(cs)).arrayBuffer();
  return new Uint8Array(await out);
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crcEnd(crc32(out.subarray(4, 8 + data.length))));
  return out;
}

export async function png16(rgb16, w, h) {
  const raw = new Uint8Array(h * (1 + w * 6));
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    for (let x = 0, i = y * w * 3; x < w * 3; x++, i++) { const v = rgb16[i]; raw[o++] = v >> 8; raw[o++] = v & 255; }
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 16; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', await deflate(raw)), chunk('IEND', new Uint8Array(0))];
  return new Blob(parts, { type: 'image/png' });
}

/** Zip senza compressione (i PNG sono già compressi). */
export class ZipWriter {
  constructor() { this.parts = []; this.central = []; this.offset = 0; }
  async add(name, blob) {
    const data = new Uint8Array(await blob.arrayBuffer());
    const nameB = new TextEncoder().encode(name);
    const crc = crcEnd(crc32(data));
    const head = new Uint8Array(30 + nameB.length);
    const dv = new DataView(head.buffer);
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); dv.setUint16(8, 0, true);
    dv.setUint32(14, crc, true); dv.setUint32(18, data.length, true); dv.setUint32(22, data.length, true); dv.setUint16(26, nameB.length, true);
    head.set(nameB, 30);
    const cen = new Uint8Array(46 + nameB.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, nameB.length, true);
    cv.setUint32(42, this.offset, true); cen.set(nameB, 46);
    this.parts.push(head, data); this.central.push(cen);
    this.offset += head.length + data.length;
    if (this.offset > 3.8e9) throw new Error('Il file zip supererebbe 4 GB: abbassa la risoluzione o usa il server sul Mac.');
  }
  blob() {
    const size = this.central.reduce((a, c) => a + c.length, 0);
    const end = new Uint8Array(22);
    const dv = new DataView(end.buffer);
    dv.setUint32(0, 0x06054b50, true); dv.setUint16(8, this.central.length, true); dv.setUint16(10, this.central.length, true);
    dv.setUint32(12, size, true); dv.setUint32(16, this.offset, true);
    return new Blob([...this.parts, ...this.central, end], { type: 'application/zip' });
  }
}

export async function renderToZip(opts) {
  const { renderer: r, items, clip, long, name, meta, onProgress, signal } = opts;
  const { w, h } = dims(clip.format.aspect, long);
  const fps = clip.format.fps;
  const total = Math.round(clip.format.duration * fps);
  r.setSize(w, h); r.prune([]); r.reset();
  const zip = new ZipWriter();
  const buf = new Uint16Array(w * h * 3);
  const t0 = performance.now();
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) throw new DOMException('annullato', 'AbortError');
    const t = i / fps;
    for (const s of items) if (s.kind === 'video') await seekVideo(s.el, videoTime(s, t));
    r.render(clip, t, i, null, { display: false });
    await zip.add(`${name}/${name}_${String(i).padStart(5, '0')}.png`, await png16(r.readRGB16(buf), w, h));
    const el = (performance.now() - t0) / 1000;
    onProgress && onProgress(i + 1, total, (el / (i + 1)) * (total - i - 1));
  }
  await zip.add(`${name}/${name}.json`, new Blob([JSON.stringify({ ...meta, formato: { codec: 'Sequenza PNG 16 bit', larghezza: w, altezza: h, fps, fotogrammi: total }, precisione_motore: r.float ? 'virgola mobile 16 bit' : '8 bit' }, null, 2)], { type: 'application/json' }));
  return zip.blob();
}

/** WebM in tempo reale: veloce da guardare, non per DaVinci. */
export async function renderToWebM(opts) {
  const { renderer: r, items, clip, long, onProgress, signal } = opts;
  const { w, h } = dims(clip.format.aspect, long);
  const fps = clip.format.fps;
  const total = Math.round(clip.format.duration * fps);
  r.setSize(w, h); r.prune([]); r.reset();
  const stream = r.canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((t) => window.MediaRecorder?.isTypeSupported?.(t));
  if (!type) throw new Error('Questo browser non registra video dal canvas');
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: Math.round(w * h * fps * 0.4) });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((res) => { rec.onstop = res; });
  rec.start();
  const t0 = performance.now();
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) { rec.stop(); throw new DOMException('annullato', 'AbortError'); }
    const t = i / fps;
    for (const s of items) if (s.kind === 'video') await seekVideo(s.el, videoTime(s, t));
    r.render(clip, t, i, null, { display: true });
    track.requestFrame?.();
    const due = t0 + ((i + 1) / fps) * 1000;
    await new Promise((res) => setTimeout(res, Math.max(0, due - performance.now())));
    onProgress && onProgress(i + 1, total, (total - i - 1) / fps);
  }
  rec.stop();
  await done;
  return new Blob(chunks, { type: type.split(';')[0] });
}

export function estimate(codec, w, h, fps, frames) {
  const px = w * h;
  const perFrame = {
    prores422hq: px * 0.45,    // ~ 700 Mb/s a 4K 24p (dati Apple)
    prores4444xq: px * 1.0,    // ~ 1,6 Gb/s a 4K 24p
    png16: px * 4.2,
    tiff16: px * 4.6,
    h264: px * 0.06,
    zip: px * 4.2,
    webm: px * 0.05,
  }[codec] || px;
  return perFrame * frames;
}

export function needsNote(clip) {
  const n = [];
  if (clip.format.loop && clip.chain.some((p) => p.on && byId[p.proc]?.noloop)) n.push('La catena contiene processi con memoria: l’ultimo fotogramma non torna esattamente al primo.');
  return n;
}
