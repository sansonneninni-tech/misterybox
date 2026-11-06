// ATELIER — server locale.
// Avvio: npm start  →  http://localhost:4747 sul Mac, e un codice QR per l'iPhone.
import express from 'express';
import multer from 'multer';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

import { DATA_DIR, DIRS, getDb, save, saveNow } from './store.js';
import * as lib from './library.js';
import * as exp from './experiments.js';
import * as hf from './higgsfield.js';
import * as critic from './critic.js';
import { describeArchives, searchArchive, resolveFull } from './archives.js';
import { exportAsset, FORMATS } from './export.js';
import { preview } from './preview.js';
import { describeProcesses, CATEGORIES } from '../shared/processes/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4747);
const HOST = process.env.ATELIER_HOST || '0.0.0.0';

const db = getDb();
if (!db.settings.accessKey) { db.settings.accessKey = crypto.randomBytes(12).toString('base64url'); saveNow(); }
const KEY = db.settings.accessKey;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// Accesso: dal Mac sempre libero; dagli altri dispositivi (iPhone) serve la chiave,
// che si riceve inquadrando il codice QR. Così nessun altro sulla rete entra nell'archivio.
const isLocal = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
const cookieKey = (req) => (req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).find(([k]) => k === 'atelier_key')?.[1];
app.get('/accesso', (req, res) => {
  if (req.query.chiave !== KEY) return res.status(403).send(page('Chiave non valida', 'Inquadra di nuovo il codice QR mostrato sul Mac (Impostazioni → Apri su iPhone).'));
  res.setHeader('Set-Cookie', `atelier_key=${KEY}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`);
  res.redirect('/');
});
app.use((req, res, next) => {
  if (isLocal(req) || cookieKey(req) === KEY) return next();
  if (req.path === '/manifest.webmanifest' || req.path.startsWith('/icons/')) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Accesso non autorizzato: inquadra il codice QR sul Mac.' });
  res.status(401).send(page('ATELIER', 'Per aprire il laboratorio da questo dispositivo, inquadra il codice QR che trovi sul Mac in Impostazioni → Apri su iPhone.'));
});

function page(title, msg) {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font:17px/1.5 -apple-system,system-ui,sans-serif;background:#111;color:#eee;padding:12vh 24px;max-width:34em;margin:auto"><h1 style="font-weight:500">${title}</h1><p>${msg}</p>`;
}

// File statici: interfaccia, design, codice condiviso, immagini dell'archivio.
app.use('/design', express.static(path.join(ROOT, 'design')));
app.use('/shared', express.static(path.join(ROOT, 'shared')));
app.use('/files/originali', express.static(DIRS.originali, { maxAge: '1y', immutable: true }));
app.use('/files/varianti', express.static(DIRS.varianti, { maxAge: '1y', immutable: true }));
app.use('/files/miniature', express.static(DIRS.miniature, { maxAge: '1y', immutable: true }));
app.use('/files/export', express.static(DIRS.export, { setHeaders: (res) => res.setHeader('Content-Disposition', 'attachment') }));
app.use(express.static(path.join(ROOT, 'web'), { setHeaders: (res, p) => { if (p.endsWith('.html') || p.endsWith('.js')) res.setHeader('Cache-Control', 'no-cache'); } }));

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).then((r) => { if (!res.headersSent) res.json(r ?? { ok: true }); }).catch((e) => {
  console.error('✖', req.method, req.path, e.message);
  res.status(e.status || 400).json({ error: e.message, ...(e.detail ? { detail: e.detail } : {}) });
});
const notFound = (what) => Object.assign(new Error(`${what} non trovato.`), { status: 404 });

// ---- Stato e configurazione
// Lo stato di Higgsfield costa una chiamata alla CLI: con ?veloce lo riuso per qualche minuto.
let hfCache = null;
app.get('/api/status', wrap(async (req) => {
  const fresh = !('veloce' in req.query) || !hfCache || Date.now() - hfCache.at > 5 * 60_000;
  const [h, c] = await Promise.all([fresh ? hf.status() : hfCache.value, critic.claudeAvailable()]);
  if (fresh) hfCache = { at: Date.now(), value: h };
  return {
    version: '0.1.0', mode: 'locale', dataDir: DATA_DIR, platform: process.platform,
    engines: { locale: { available: true }, higgsfield: h },
    critic: { locale: true, claude: c },
    counts: { assets: Object.values(db.assets).filter((a) => !a.deleted).length, experiments: Object.values(db.experiments).filter((e) => !e.deleted).length },
  };
}));
app.get('/api/processes', wrap(() => ({ categories: CATEGORIES, processes: describeProcesses() })));
app.get('/api/higgsfield/models', wrap(() => ({ models: hf.IMAGE_MODELS, aspects: hf.ASPECTS, simulated: hf.isSimulated() })));
app.get('/api/export/formats', wrap(() => FORMATS));

function lanUrls() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push(`http://${i.address}:${PORT}`);
  const host = os.hostname().replace(/\.local$/, '');
  if (process.platform === 'darwin') out.unshift(`http://${host}.local:${PORT}`);
  return out;
}
app.get('/api/lan', wrap(async (req) => {
  if (!isLocal(req)) return { urls: [], note: 'Visibile solo dal Mac.' };
  const urls = lanUrls().map((u) => `${u}/accesso?chiave=${KEY}`);
  return { urls, qr: urls[0] ? await QRCode.toString(urls[0], { type: 'svg', margin: 1, color: { dark: '#111111', light: '#ffffff' } }) : null };
}));

// ---- Archivio
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024, files: 50 } });
app.get('/api/assets', wrap((req) => ({ assets: lib.listAssets(req.query), tags: lib.allTags() })));
app.get('/api/assets/:id', wrap((req) => {
  const a = lib.getAsset(req.params.id);
  if (!a) throw notFound('Immagine');
  return { asset: a, lineage: exp.findLineageForAsset(a.id)?.steps.map((n) => ({ ...n, asset: lib.getAsset(n.assetId) })) || [] };
}));
app.post('/api/assets/upload', upload.array('files'), wrap(async (req) => {
  const meta = req.body.meta ? JSON.parse(req.body.meta) : {};
  const done = [], errors = [];
  for (const f of req.files || []) {
    try {
      done.push(await lib.importBuffer(f.buffer, { filename: Buffer.from(f.originalname, 'latin1').toString('utf8'), origin: { type: 'upload', filename: f.originalname }, tags: meta.tags || [] }));
    } catch (e) { errors.push(`${f.originalname}: ${e.message}`); }
  }
  return { assets: done, errors };
}));
app.post('/api/assets/url', wrap(async (req) => ({ asset: await lib.importUrl(String(req.body.url || '').trim(), { tags: req.body.tags || [] }) })));
app.patch('/api/assets/:id', wrap((req) => { const a = lib.updateAsset(req.params.id, req.body); if (!a) throw notFound('Immagine'); return { asset: a }; }));
app.delete('/api/assets/:id', wrap((req) => ({ ok: lib.deleteAsset(req.params.id) })));

// Immagini di esempio (Met Open Access, pubblico dominio) per provare subito il laboratorio.
app.post('/api/assets/samples', wrap(async () => {
  const src = fs.readFileSync(path.join(ROOT, 'design', 'prototype', 'data.js'), 'utf8');
  const list = JSON.parse(src.slice(src.indexOf('['), src.lastIndexOf(']') + 1));
  const have = new Set(Object.values(db.assets).filter((a) => !a.deleted).map((a) => a.origin.sampleId));
  const done = [];
  for (const it of list) {
    if (have.has(it.id)) continue;
    const buf = fs.readFileSync(path.join(ROOT, 'design', 'prototype', it.file));
    done.push(await lib.importBuffer(buf, {
      filename: path.basename(it.file), title: it.title, tags: it.tags,
      origin: { type: 'archivio', archive: 'met', author: it.author, page: it.url, date: it.date, sampleId: it.id, note: 'Esempio (versione ridotta a 1400 px)' },
      rights: { status: 'libero', license: 'CC0 (Met Open Access)', licenseUrl: 'https://www.metmuseum.org/policies/image-resources', attribution: 'The Metropolitan Museum of Art' },
      notes: `${it.original} · ${it.medium}`,
    }));
  }
  return { assets: done };
}));

// ---- Archivi esterni
app.get('/api/archives', wrap(() => ({ archives: describeArchives() })));
app.get('/api/archives/search', wrap(async (req) => {
  const q = String(req.query.q || '').trim();
  if (!q) throw new Error('Scrivi cosa cercare.');
  const ids = String(req.query.archives || 'openverse,wikimedia,cleveland').split(',').filter(Boolean);
  const results = await Promise.all(ids.map((id) => searchArchive(id, q, Number(req.query.page) || 1)));
  return { q, results };
}));
app.post('/api/archives/import', wrap(async (req) => {
  const it = req.body.item || {};
  let full = await resolveFull(it);
  const info = {
    title: it.title, tags: req.body.tags || [],
    origin: { type: 'archivio', archive: it.archive, archiveId: it.id, author: it.author, page: it.page, date: it.date, via: it.via },
    rights: { status: it.rightsStatus || 'da verificare', license: it.license || '', licenseUrl: it.licenseUrl || '', attribution: it.attribution || '' },
  };
  try { return { asset: await lib.importUrl(full, info) }; }
  catch (e) {
    if (it.fallback) return { asset: await lib.importUrl(it.fallback, { ...info, notes: 'Importata la versione grande disponibile (non l\'originale).' }) };
    throw e;
  }
}));

// ---- Esperimenti
app.get('/api/experiments', wrap(() => ({ experiments: exp.listExperiments(), states: exp.STATES })));
app.post('/api/experiments', wrap((req) => ({ experiment: exp.createExperiment(req.body) })));
app.get('/api/experiments/:id', wrap((req) => { const e = exp.getExperiment(req.params.id); if (!e) throw notFound('Esperimento'); return { experiment: e }; }));
app.patch('/api/experiments/:id', wrap((req) => ({ experiment: exp.updateExperiment(req.params.id, req.body) })));
app.delete('/api/experiments/:id', wrap((req) => ({ ok: exp.deleteExperiment(req.params.id) })));
app.post('/api/experiments/:id/sources', wrap((req) => ({ experiment: exp.addSources(req.params.id, req.body.assetIds || []) })));
app.patch('/api/experiments/:id/nodes/:node', wrap((req) => ({ experiment: exp.updateNode(req.params.id, req.params.node, req.body) })));
app.post('/api/preview', async (req, res) => {
  try {
    const r = await preview(req.body || {});
    res.set({ 'content-type': 'image/jpeg', 'cache-control': 'no-store', 'x-seed': String(r.seed) }).send(r.jpeg);
  } catch (e) { res.status(400).json({ error: e.message, ...(e.detail ? { detail: e.detail } : {}) }); }
});
app.post('/api/experiments/:id/run', wrap((req) => exp.runLocal(req.params.id, req.body)));
app.post('/api/experiments/:id/higgsfield/quote', wrap((req) => exp.higgsfieldQuote(req.params.id, req.body)));
app.post('/api/experiments/:id/higgsfield/run', wrap((req) => exp.higgsfieldRun(req.params.id, req.body)));

// ---- Interlocutore
app.post('/api/critic/analyze', wrap(async (req) => {
  const a = lib.rawAsset(req.body.assetId);
  if (!a) throw notFound('Immagine');
  const e = req.body.experimentId ? getDb().experiments[req.body.experimentId] : null;
  const node = e?.nodes.find((n) => n.assetId === a.id);
  const history = e && node ? exp.lineage(e, node.id).map((n) => n.op.label) : [];
  const r = await critic.critiqueAsset(lib.assetPath(a), { provider: req.body.provider, hypothesis: e?.hypothesis, notes: a.notes, history, seed: req.body.seed });
  if (e) exp.addMessage(e.id, { role: 'interlocutore', kind: 'analisi', assetId: a.id, data: r });
  return r;
}));
app.post('/api/critic/discuss', wrap(async (req) => {
  const e = req.body.experimentId ? getDb().experiments[req.body.experimentId] : null;
  const a = req.body.assetId ? lib.rawAsset(req.body.assetId) : null;
  const message = String(req.body.message || '').trim();
  if (!message) throw new Error('Scrivi qualcosa.');
  if (e) exp.addMessage(e.id, { role: 'autore', text: message, assetId: a?.id });
  const r = await critic.discuss({ message, file: a ? lib.assetPath(a) : null, ctx: { provider: req.body.provider, hypothesis: e?.hypothesis }, conversation: (e?.conversation || []).filter((m) => m.text) });
  if (e) exp.addMessage(e.id, { role: 'interlocutore', text: r.testo, fonte: r.fonte });
  return r;
}));
app.post('/api/critic/ideas', wrap((req) => critic.ideas({ idea: String(req.body.idea || ''), provider: req.body.provider })));

// ---- Esportazione
app.post('/api/export', wrap((req) => exportAsset(req.body.assetId, req.body.format)));
app.post('/api/reveal', wrap((req) => {
  if (!isLocal(req) || process.platform !== 'darwin') return { ok: false };
  const p = path.resolve(String(req.body.path || DIRS.export));
  if (!p.startsWith(DATA_DIR)) throw new Error('Percorso non consentito.');
  execFile('open', ['-R', p]);
  return { ok: true };
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Indirizzo API sconosciuto.' }));
app.get(/^\/(?!api|files|design|shared).*/, (req, res) => res.sendFile(path.join(ROOT, 'web', 'index.html')));

app.listen(PORT, HOST, async () => {
  const urls = lanUrls();
  console.log('\n  ATELIER è aperto.\n');
  console.log(`  Sul Mac:     http://localhost:${PORT}`);
  if (urls[0]) {
    console.log(`  Su iPhone:   inquadra il codice qui sotto (stessa rete Wi-Fi)\n`);
    console.log(await QRCode.toString(`${urls[0]}/accesso?chiave=${KEY}`, { type: 'terminal', small: true }));
  }
  console.log(`  Archivio:    ${DATA_DIR}`);
  console.log(`  Higgsfield:  ${hf.isSimulated() ? 'SIMULATO (nessun credito)' : 'reale, sempre con conferma del costo'}`);
  console.log('\n  Per chiudere: Ctrl+C\n');
  if (process.platform === 'darwin' && !process.env.ATELIER_NO_OPEN) execFile('open', [`http://localhost:${PORT}`]);
});

process.on('SIGINT', () => { saveNow(); process.exit(0); });
