// MOVIOLA — server locale. Nessuna dipendenza: solo Node 20+ e ffmpeg.
//   node server/index.mjs            avvia su http://localhost:5174
//   PORT=5180 node server/index.mjs  altra porta
// Il Mac serve anche l'iPhone sulla rete di casa, protetto da una chiave.

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { CODECS, probe, startEncoder, makeProxy } from './ffmpeg.mjs';
import * as critic from './critic.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.MOVIOLA_DATA || path.join(ROOT, 'dati');
const MEDIA = path.join(DATA, 'media');
const DB = path.join(DATA, 'db');
const PORT = Number(process.env.PORT || 5174);
const HOST = process.env.HOST || '0.0.0.0';
fs.mkdirSync(MEDIA, { recursive: true });
fs.mkdirSync(DB, { recursive: true });

// ----------------------------------------------------------- configurazione
const CONF_FILE = path.join(DATA, 'config.json');
function loadConf() {
  let c = {};
  try { c = JSON.parse(fs.readFileSync(CONF_FILE, 'utf8')); } catch {}
  if (!c.key) c.key = crypto.randomBytes(9).toString('base64url');
  if (!c.outDir) {
    const movies = path.join(os.homedir(), 'Movies');
    c.outDir = fs.existsSync(movies) ? path.join(movies, 'MOVIOLA') : path.join(DATA, 'render');
  }
  fs.writeFileSync(CONF_FILE, JSON.stringify(c, null, 2));
  return c;
}
const conf = loadConf();

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  return out;
}

// ------------------------------------------------------------------ archivio
const collections = new Map();
const COLL = new Set(['sources', 'experiments', 'versions', 'renders', 'queue']);
function coll(name) {
  if (!COLL.has(name)) throw Object.assign(new Error('collezione sconosciuta'), { status: 404 });
  if (!collections.has(name)) {
    let items = [];
    try { items = JSON.parse(fs.readFileSync(path.join(DB, name + '.json'), 'utf8')); } catch {}
    collections.set(name, new Map(items.map((x) => [x.id, x])));
  }
  return collections.get(name);
}
const pending = new Map();
function persist(name) {
  // scrittura atomica, raggruppata: mai un file mezzo scritto
  clearTimeout(pending.get(name));
  pending.set(name, setTimeout(() => {
    const file = path.join(DB, name + '.json');
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify([...coll(name).values()]));
    fs.renameSync(tmp, file);
  }, 120));
}
function flushAll() {
  for (const [name, t] of pending) {
    clearTimeout(t);
    const file = path.join(DB, name + '.json');
    fs.writeFileSync(file, JSON.stringify([...coll(name).values()]));
  }
}

// --------------------------------------------------------------- utilità HTTP
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif',
  '.heic': 'image/heic', '.tif': 'image/tiff', '.tiff': 'image/tiff',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
};
const EXT_FOR = Object.fromEntries(Object.entries(TYPES).filter(([e]) => !['.jpeg', '.m4v', '.tiff', '.mjs'].includes(e)).map(([e, t]) => [t.split(';')[0], e]));

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body) || typeof body === 'string';
  res.writeHead(status, { 'content-type': isBuf ? 'text/plain; charset=utf-8' : 'application/json', 'cache-control': 'no-store', ...headers });
  res.end(isBuf ? body : JSON.stringify(body));
}
async function readBody(req, limit = 2e9) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > limit) throw Object.assign(new Error('troppo grande'), { status: 413 }); chunks.push(c); }
  return Buffer.concat(chunks);
}
async function readJSON(req) { const b = await readBody(req, 50e6); return b.length ? JSON.parse(b.toString('utf8')) : {}; }

function isLocal(req) {
  const a = req.socket.remoteAddress || '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map((s) => s.trim().split('=')).filter((x) => x[0]));
}
function authorized(req, url) {
  if (isLocal(req)) return true;
  if (url.searchParams.get('k') === conf.key) return 'set';
  return cookies(req).mv_key === conf.key || req.headers['x-moviola-key'] === conf.key;
}

async function serveFile(req, res, file) {
  let st;
  try { st = await fsp.stat(file); } catch { return send(res, 404, 'non trovato'); }
  if (st.isDirectory()) return serveFile(req, res, path.join(file, 'index.html'));
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.range;
  const base = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': file.startsWith(MEDIA) ? 'private, max-age=31536000, immutable' : 'no-cache' };
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m[1] ? Number(m[1]) : st.size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : st.size - 1;
    if (!m[1] && m[2]) end = st.size - 1;
    if (start >= st.size || start < 0) return send(res, 416, '', { 'content-range': `bytes */${st.size}` });
    end = Math.min(end, st.size - 1);
    res.writeHead(206, { ...base, 'content-range': `bytes ${start}-${end}/${st.size}`, 'content-length': end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...base, 'content-length': st.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

function safeJoin(base, rel) {
  const p = path.normalize(path.join(base, rel));
  if (!p.startsWith(base)) throw Object.assign(new Error('percorso non valido'), { status: 400 });
  return p;
}
const slug = (s) => String(s || 'clip').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'clip';

const shortPath = (p) => { const home = os.homedir(); return p === home || p.startsWith(home + path.sep) ? '~' + p.slice(home.length) : p; };

// -------------------------------------------------------------------- render
const jobs = new Map(); // id -> { enc, frames, written, meta, status }

async function startRender(body) {
  const ff = probe();
  if (!ff.ok) throw Object.assign(new Error('ffmpeg non trovato. Sul Mac: brew install ffmpeg'), { status: 501 });
  const { codec, w, h, fps, frames, name } = body;
  if (!CODECS[codec] || !ff.encoders.includes(codec)) throw Object.assign(new Error('Formato non disponibile con questo ffmpeg: ' + codec), { status: 400 });
  if (!(w > 0 && h > 0 && w <= 8192 && h <= 8192 && w % 2 === 0 && h % 2 === 0)) throw Object.assign(new Error('dimensioni non valide'), { status: 400 });
  fs.mkdirSync(conf.outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const base = path.join(conf.outDir, `${slug(name)}_${w}x${h}_${fps}p_${codec}_${stamp}`);
  const enc = startEncoder({ codec, w, h, fps, outBase: base });
  const id = crypto.randomUUID();
  const job = { id, enc, frames, written: 0, w, h, fps, codec, status: 'in corso', started: Date.now(), base, meta: body.meta || {} };
  enc.done.then(() => { job.status = job.status === 'annullato' ? 'annullato' : 'finito'; }, (e) => { if (job.status !== 'annullato') { job.status = 'errore'; job.error = String(e.message || e); } enc.discard(); });
  job.seen = Date.now();
  jobs.set(id, job);
  return { id, output: enc.output };
}

async function writeFrame(job, req) {
  const expected = job.w * job.h * 6;
  const buf = await readBody(req, expected + 16);
  if (buf.length !== expected) throw Object.assign(new Error(`fotogramma di ${buf.length} byte, attesi ${expected}`), { status: 400 });
  if (job.status !== 'in corso') throw Object.assign(new Error('render ' + job.status + (job.error ? ': ' + job.error : '')), { status: 409 });
  job.seen = Date.now();
  const ok = job.enc.proc.stdin.write(buf);
  if (!ok) await new Promise((r) => job.enc.proc.stdin.once('drain', r));
  job.written++;
}

function abortRender(job, why = 'annullato') {
  job.status = 'annullato'; job.why = why;
  try { job.enc.proc.kill('SIGKILL'); } catch {}
  job.enc.discard();
  jobs.delete(job.id);
}

// pagina chiusa, rete caduta: un render che non riceve fotogrammi da un minuto
// viene annullato e il file provvisorio cancellato
setInterval(() => {
  for (const job of jobs.values()) if (job.status === 'in corso' && Date.now() - job.seen > 60_000) abortRender(job, 'nessun fotogramma da un minuto');
}, 10_000).unref();
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { for (const job of jobs.values()) abortRender(job, 'server chiuso'); flushAll(); process.exit(0); });

async function endRender(job) {
  job.enc.proc.stdin.end();
  await job.enc.done;
  job.enc.commit();
  const c = CODECS[job.codec];
  const sidecar = (c.kind === 'sequence' ? path.join(job.base, path.basename(job.base)) : job.base) + '.json';
  const meta = {
    applicazione: 'MOVIOLA',
    creato: new Date().toISOString(),
    file: job.enc.output,
    formato: { codec: c.label, bit: c.bits, nota: c.note, larghezza: job.w, altezza: job.h, fps: job.fps, fotogrammi: job.written, durata_s: +(job.written / job.fps).toFixed(3) },
    colore: 'Rec.709 (primari e gamma), RGB a piena gamma convertito in livelli video per i file YUV',
    precisione_motore: job.meta.precisione || 'sconosciuta',
    ffmpeg: probe().version,
    ...job.meta,
  };
  fs.writeFileSync(sidecar, JSON.stringify(meta, null, 2));
  const rec = { id: job.id, created: Date.now(), file: job.enc.output, sidecar, codec: job.codec, w: job.w, h: job.h, fps: job.fps, frames: job.written, versionId: job.meta.versione?.id, name: job.meta.nome };
  coll('renders').set(rec.id, rec); persist('renders');
  jobs.delete(job.id);
  return rec;
}

// --------------------------------------------------------------------- rotte
async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // senza "api"
  const [a, b, c] = parts;
  const M = req.method;

  if (a === 'info' && M === 'GET') {
    const ff = probe();
    return send(res, 200, {
      app: 'MOVIOLA', ffmpeg: ff, codecs: Object.fromEntries(Object.entries(CODECS).map(([k, v]) => [k, { label: v.label, bits: v.bits, kind: v.kind, note: v.note, available: ff.encoders.includes(k) }])),
      critic: critic.available(), outDir: conf.outDir, outDirShort: shortPath(conf.outDir), platform: process.platform,
      lan: lanAddresses().map((ip) => `http://${ip}:${PORT}/?k=${conf.key}`), local: isLocal(req),
    });
  }

  if (a === 'db') {
    const C = coll(b);
    if (M === 'GET' && !c) return send(res, 200, [...C.values()]);
    if (M === 'GET' && c) return C.has(c) ? send(res, 200, C.get(c)) : send(res, 404, 'non trovato');
    if (M === 'PUT' && c) { const o = await readJSON(req); o.id = c; C.set(c, o); persist(b); return send(res, 200, o); }
    if (M === 'DELETE' && c) { C.delete(c); persist(b); return send(res, 200, { ok: true }); }
  }

  if (a === 'upload' && M === 'POST') {
    const type = (req.headers['content-type'] || '').split(';')[0];
    const ext = EXT_FOR[type] || path.extname(url.searchParams.get('name') || '').toLowerCase() || '.bin';
    if (!/^(image|video)\//.test(type) && !['.mov', '.mp4', '.heic', '.tif'].includes(ext)) return send(res, 415, 'Solo immagini e video');
    const id = crypto.randomUUID().slice(0, 12);
    const file = id + ext;
    const out = fs.createWriteStream(path.join(MEDIA, file));
    let n = 0;
    for await (const chunk of req) { n += chunk.length; if (!out.write(chunk)) await new Promise((r) => out.once('drain', r)); }
    await new Promise((r) => out.end(r));
    return send(res, 200, { file, url: '/media/' + file, bytes: n, type });
  }

  if (a === 'import-url' && M === 'POST') {
    const { url: src } = await readJSON(req);
    let u;
    try { u = new URL(src); } catch { return send(res, 400, 'Indirizzo non valido'); }
    if (!/^https?:$/.test(u.protocol)) return send(res, 400, 'Solo http e https');
    const r = await fetch(u, { redirect: 'follow', headers: { 'user-agent': 'MOVIOLA/1.0 (laboratorio locale)' } });
    if (!r.ok) return send(res, 502, `Il sito ha risposto ${r.status}`);
    const type = (r.headers.get('content-type') || '').split(';')[0];
    if (!/^(image|video)\//.test(type)) return send(res, 415, `Non è un'immagine o un video (${type || 'tipo sconosciuto'}). Serve l'indirizzo diretto del file.`);
    const buf = Buffer.from(await r.arrayBuffer());
    const ext = EXT_FOR[type] || path.extname(u.pathname) || '.bin';
    const file = crypto.randomUUID().slice(0, 12) + ext;
    fs.writeFileSync(path.join(MEDIA, file), buf);
    return send(res, 200, { file, url: '/media/' + file, bytes: buf.length, type, origin: u.href, host: u.host });
  }

  if (a === 'proxy' && M === 'POST' && b) {
    const input = safeJoin(MEDIA, b);
    if (!probe().ok) return send(res, 501, 'ffmpeg non trovato');
    const file = path.basename(b, path.extname(b)) + '-proxy.mp4';
    await makeProxy(input, path.join(MEDIA, file));
    return send(res, 200, { file, url: '/media/' + file });
  }

  if (a === 'render') {
    if (M === 'POST' && !b) return send(res, 200, await startRender(await readJSON(req)));
    const job = jobs.get(b);
    if (!job) return send(res, 404, 'render non trovato');
    if (M === 'POST' && c === 'frame') { await writeFrame(job, req); return send(res, 200, { written: job.written }); }
    if (M === 'POST' && c === 'end') return send(res, 200, await endRender(job));
    if (M === 'POST' && c === 'abort') { abortRender(job); return send(res, 200, { ok: true }); }
  }

  if (a === 'reveal' && M === 'POST') {
    const { file } = await readJSON(req);
    if (!isLocal(req)) return send(res, 403, 'Solo dal Mac');
    const known = [...coll('renders').values()].some((r) => r.file === file || r.sidecar === file);
    if (!known) return send(res, 404, 'file sconosciuto');
    if (process.platform === 'darwin') spawn('open', ['-R', file.includes('%') ? path.dirname(file) : file]);
    return send(res, 200, { ok: process.platform === 'darwin' });
  }

  if (a === 'critic' && M === 'POST') {
    try { return send(res, 200, await critic.ask(await readJSON(req))); }
    catch (e) { return send(res, e.status || 502, { error: String(e.message || e) }); }
  }

  // coda di render: l'iPhone chiede, una finestra del Mac esegue
  if (a === 'queue') {
    const Q = coll('queue');
    if (M === 'POST' && !b) { const o = await readJSON(req); o.id = crypto.randomUUID(); o.status = 'in attesa'; o.created = Date.now(); Q.set(o.id, o); persist('queue'); return send(res, 200, o); }
    if (M === 'POST' && b === 'claim') {
      const next = [...Q.values()].filter((x) => x.status === 'in attesa').sort((x, y) => x.created - y.created)[0];
      if (!next) return send(res, 200, null);
      next.status = 'in corso'; next.claimed = Date.now(); persist('queue');
      return send(res, 200, next);
    }
    if (M === 'POST' && b && c === 'status') { const o = Q.get(b); if (!o) return send(res, 404, ''); Object.assign(o, await readJSON(req)); persist('queue'); return send(res, 200, o); }
  }

  return send(res, 404, 'rotta sconosciuta');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    const auth = authorized(req, url);
    if (!auth) {
      return send(res, 401, '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="background:#000;color:#f8f8f8;font:300 15px system-ui;padding:32px;line-height:1.6">MOVIOLA è protetta da una chiave.<br>Apri l\'indirizzo completo che compare sul Mac (finisce con <code>?k=…</code>), oppure inquadra il codice nella sezione Esporta.', { 'content-type': 'text/html; charset=utf-8' });
    }
    if (auth === 'set') res.setHeader('set-cookie', `mv_key=${conf.key}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname.startsWith('/media/')) return await serveFile(req, res, safeJoin(MEDIA, decodeURIComponent(url.pathname.slice(7))));
    if (url.pathname.startsWith('/design/')) return await serveFile(req, res, safeJoin(path.join(ROOT, 'design'), decodeURIComponent(url.pathname.slice(8))));
    return await serveFile(req, res, safeJoin(path.join(ROOT, 'web'), decodeURIComponent(url.pathname)));
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: String(e.message || e) });
    else res.end();
  }
});
server.requestTimeout = 0;

server.listen(PORT, HOST, () => {
  const ff = probe();
  console.log(`\n  MOVIOLA  http://localhost:${PORT}`);
  for (const u of lanAddresses()) console.log(`  iPhone   http://${u}:${PORT}/?k=${conf.key}`);
  console.log(`  ffmpeg   ${ff.ok ? ff.encoders.join(', ') : 'NON TROVATO — brew install ffmpeg'}`);
  console.log(`  Claude   ${critic.available() || 'non trovato (interlocutore con regole locali)'}`);
  console.log(`  render → ${conf.outDir}\n`);
});
