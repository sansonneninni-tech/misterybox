// Anteprime veloci a bassa risoluzione (640 px di default) per l'anteprima
// dal vivo della tela e per il provino a contatto. Non salva nulla.
import { Worker } from 'node:worker_threads';
import { getProcess } from '../shared/processes/index.js';
import { rawAsset, assetPath } from './library.js';
import { decode, encodeRaw } from './imaging.js';

const cache = new Map(); // assetId:size -> immagine ridotta
let worker = null;
let seq = 0;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./preview-worker.js', import.meta.url));
  worker.on('message', (m) => { const p = pending.get(m.job); if (!p) return; pending.delete(m.job); m.ok ? p.resolve(m.image) : p.reject(new Error(m.error)); });
  worker.on('error', (e) => { for (const p of pending.values()) p.reject(e); pending.clear(); worker = null; });
  worker.unref();
  return worker;
}

async function small(assetId, size) {
  const key = `${assetId}:${size}`;
  if (cache.has(key)) { const v = cache.get(key); cache.delete(key); cache.set(key, v); return v; }
  const a = rawAsset(assetId);
  if (!a) throw new Error('Immagine non trovata.');
  const img = await decode(assetPath(a), size);
  cache.set(key, img);
  while (cache.size > 32) cache.delete(cache.keys().next().value);
  return img;
}

// I parametri in pixel vanno scalati, altrimenti l'anteprima ridotta
// mostrerebbe strisce e celle molto più grandi del risultato vero.
function scaleParams(proc, params, factor) {
  const out = { ...params };
  for (const d of proc.params) {
    if (d.key === 'size') { out.size = Math.max(64, Math.round((params.size ?? d.default) * factor)); continue; }
    if (d.type !== 'range' || !/\(px\)/.test(d.label)) continue;
    const v = Number(params[d.key] ?? d.default);
    out[d.key] = v > 0 ? Math.max(1, Math.round(v * factor)) : 0;
  }
  return out;
}

export async function preview({ assetIds = [], process: pid, params = {}, seed, size = 640 }) {
  const proc = getProcess(pid);
  if (!proc) throw new Error(`Processo sconosciuto: ${pid}`);
  size = Math.max(160, Math.min(1400, Number(size) || 640));
  const ids = assetIds.slice(0, proc.inputs.max);
  if (ids.length < proc.inputs.min) throw new Error(`Servono almeno ${proc.inputs.min} immagini.`);
  const inputs = [];
  for (const id of ids) {
    const s = await small(id, size);
    inputs.push({ width: s.width, height: s.height, data: new Uint8ClampedArray(s.data) });
  }
  let full;
  if (proc.category === 'genesi' || !ids.length) full = Number(params.size) || proc.params.find((d) => d.key === 'size')?.default || 3000;
  else { const a = rawAsset(ids[0]); full = Math.max(a.width, a.height); }
  const factor = Math.min(1, size / full);
  const s = Number.isFinite(Number(seed)) && seed !== '' && seed != null ? Number(seed) : Math.floor(Math.random() * 1e9);
  const job = ++seq;
  const w = getWorker();
  const image = await new Promise((resolve, reject) => {
    pending.set(job, { resolve, reject });
    w.postMessage({ job, id: pid, inputs, params: scaleParams(proc, params, factor), seed: s }, inputs.map((i) => i.data.buffer));
  });
  const img = { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data.buffer ?? image.data) };
  const jpeg = await encodeRaw(img).removeAlpha().jpeg({ quality: 86 }).toBuffer();
  return { jpeg, seed: s };
}
