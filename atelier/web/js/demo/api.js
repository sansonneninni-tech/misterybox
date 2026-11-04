// Versione di prova online: la stessa API del server, ma tutta nel browser.
// Immagini e database restano in IndexedDB su questo dispositivo.
// Higgsfield è sempre simulato; la ricerca negli archivi passa da una
// funzione Netlify che riusa il codice del server.
import { describeProcesses, CATEGORIES, getProcess } from '/shared/processes/index.js';
import { analyze } from '/shared/analysis.js';
import { critique, proposeFromIdea } from '/shared/provocations.js';

const WORK_MAX = 3000;          // lato lungo massimo per i calcoli nel browser
const RIGHTS_STATES = ['libero', 'con attribuzione', 'da verificare', 'riservato', 'mio'];
const CHOICES = ['', 'in esame', 'scelta', 'finita', 'scartata'];
const IMAGE_MODELS = [
  { id: 'nano_banana_flash', name: 'Nano Banana 2', refs: 8, note: 'Rapido, buono per trasformare immagini di riferimento.' },
  { id: 'gpt_image_2_5', name: 'GPT Image 2.5', refs: 8, note: 'Alta fedeltà, segue istruzioni complesse.' },
  { id: 'seedream_v5_pro', name: 'Seedream 5.0 Pro', refs: 8, note: 'Fotografico, buona gestione dei riferimenti.' },
  { id: 'flux_2', name: 'FLUX.2', refs: 4, note: 'Materico, buono per texture e superfici.' },
  { id: 'soul_cinematic', name: 'Soul Cinema', refs: 0, note: 'Fotogrammi cinematografici, solo testo.' },
  { id: 'z_image', name: 'Z Image', refs: 0, note: 'Bozze veloci ed economiche, solo testo.' },
];
const ASPECTS = ['auto', '1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9'];
const FORMATS = [
  { id: 'png', name: 'PNG', ext: 'png', note: 'Senza perdita. Nella versione per Mac c\'è anche il TIFF a 16 bit.' },
  { id: 'jpeg', name: 'JPEG qualità 100', ext: 'jpg', note: 'Per anteprime e condivisione.' },
  { id: 'original', name: 'File originale', ext: null, note: 'I byte esatti del file, senza ricompressione.' },
];

// ---------- IndexedDB minimale ----------
function openIdb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('atelier-prova', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('blobs'); r.result.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const idb = await openIdb();
const tx = (store, mode, fn) => new Promise((res, rej) => {
  const t = idb.transaction(store, mode);
  const r = fn(t.objectStore(store));
  t.oncomplete = () => res(r?.result);
  t.onerror = () => rej(t.error);
});
const putBlob = (k, b) => tx('blobs', 'readwrite', (s) => s.put(b, k));
const getBlob = (k) => tx('blobs', 'readonly', (s) => s.get(k));

let db = (await tx('kv', 'readonly', (s) => s.get('db'))) || { assets: {}, experiments: {}, credits: 100 };
let saveT = null;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => tx('kv', 'readwrite', (s) => s.put(db, 'db')), 120); };
const now = () => new Date().toISOString();
const newId = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// Indirizzi blob: creati una volta per sessione.
const urls = new Map();
async function preloadUrls() {
  const keys = [];
  for (const a of Object.values(db.assets)) if (!a.deleted) keys.push(a.blob, a.thumb);
  await Promise.all(keys.map(async (k) => { const b = await getBlob(k); if (b) urls.set(k, URL.createObjectURL(b)); }));
}
await preloadUrls();
const urlOf = (k) => urls.get(k) || '';

// ---------- Immagini ----------
async function bitmap(blob) {
  try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
  catch {
    const u = URL.createObjectURL(blob);
    try { const img = new Image(); img.src = u; await img.decode(); return img; } finally { setTimeout(() => URL.revokeObjectURL(u), 1000); }
  }
}
function canvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
const toBlob = (c, type, q) => (c.convertToBlob ? c.convertToBlob({ type, quality: q }) : new Promise((r) => c.toBlob(r, type, q)));
async function decode(blob, maxSide = WORK_MAX) {
  const bm = await bitmap(blob);
  const W = bm.width, H = bm.height;
  const s = Math.min(1, maxSide / Math.max(W, H));
  const w = Math.round(W * s), h = Math.round(H * s);
  const c = canvas(w, h);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bm, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h);
  return { width: w, height: h, data: d.data, reduced: s < 1, fullW: W, fullH: H };
}
async function encode(img, type = 'image/png', q) {
  const c = canvas(img.width, img.height);
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data.buffer ?? img.data), img.width, img.height), 0, 0);
  return toBlob(c, type, q);
}
async function thumbOf(blob) {
  const bm = await bitmap(blob);
  const s = Math.min(1, 640 / Math.max(bm.width, bm.height));
  const c = canvas(Math.round(bm.width * s), Math.round(bm.height * s));
  const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bm, 0, 0, c.width, c.height);
  return { thumb: await toBlob(c, 'image/jpeg', 0.82), width: bm.width, height: bm.height };
}

// ---------- Thread per i processi ----------
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let job = 0;
const pending = new Map();
worker.onmessage = ({ data }) => { const p = pending.get(data.job); if (!p) return; pending.delete(data.job); data.ok ? p.res(data) : p.rej(new Error(data.error)); };
const runInWorker = (id, inputs, params, seed) => new Promise((res, rej) => {
  const j = ++job; pending.set(j, { res, rej });
  worker.postMessage({ job: j, id, inputs, params, seed }, inputs.map((i) => i.data.buffer));
});

// ---------- Archivio ----------
function defaultRights(origin) {
  if (origin.type === 'algoritmo') return { status: 'mio', license: 'Opera derivata generata localmente', licenseUrl: '', attribution: '', notes: '' };
  if (origin.type === 'generata') return { status: 'da verificare', license: 'Termini del servizio generativo', licenseUrl: '', attribution: '', notes: '' };
  return { status: 'da verificare', license: '', licenseUrl: '', attribution: '', notes: '' };
}
const pub = (a) => (a ? { ...a, url: urlOf(a.blob), thumbUrl: urlOf(a.thumb) } : null);
const getAsset = (id) => pub(db.assets[id]);

async function register(blob, kind, { title, tags = [], origin, rights, notes = '' }) {
  const id = newId(kind === 'variante' ? 'var' : 'img');
  let t;
  try { t = await thumbOf(blob); } catch { throw new Error('Il file non sembra un\'immagine leggibile da questo browser.'); }
  const bk = `${id}:file`, tk = `${id}:thumb`;
  await putBlob(bk, blob); await putBlob(tk, t.thumb);
  urls.set(bk, URL.createObjectURL(blob)); urls.set(tk, URL.createObjectURL(t.thumb));
  const a = {
    id, kind, blob: bk, thumb: tk, file: `${id}.${(blob.type.split('/')[1] || 'bin').replace('jpeg', 'jpg')}`,
    title: title || 'Senza titolo', tags: [...new Set(tags.map((x) => String(x).trim().toLowerCase()).filter(Boolean))], notes,
    width: t.width, height: t.height, format: blob.type.split('/')[1] || '', bytes: blob.size, hasProfile: false,
    origin: { date: now(), ...origin }, rights: { ...defaultRights(origin), ...(rights || {}) }, choice: '', createdAt: now(),
  };
  db.assets[id] = a; save();
  return pub(a);
}
function listAssets({ q = '', tag = '', rights = '', kind = 'sorgente', origin = '', choice = '' } = {}) {
  const t = q.toLowerCase().trim();
  return Object.values(db.assets).filter((a) => !a.deleted)
    .filter((a) => (kind === 'tutte' ? true : a.kind === kind))
    .filter((a) => !tag || a.tags.includes(tag)).filter((a) => !rights || a.rights.status === rights)
    .filter((a) => !origin || a.origin.type === origin || a.origin.archive === origin).filter((a) => !choice || a.choice === choice)
    .filter((a) => !t || [a.title, a.notes, a.origin.author, a.origin.archive, ...a.tags].join(' ').toLowerCase().includes(t))
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)).map(pub);
}
function allTags() {
  const c = {};
  for (const a of Object.values(db.assets)) if (!a.deleted) for (const t of a.tags) c[t] = (c[t] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
}
async function fetchImage(url) {
  let res;
  try { res = await fetch(url, { mode: 'cors' }); if (!res.ok) throw new Error(); }
  catch { res = await fetch(`/.netlify/functions/immagine?u=${encodeURIComponent(url)}`); }
  if (!res.ok) { let m = `risposta ${res.status}`; try { m = (await res.json()).error || m; } catch { /* */ } throw new Error(`Non riesco a scaricare l'immagine (${m}).`); }
  const b = await res.blob();
  if (!/^image\//.test(b.type) && b.size < 2000) throw new Error('L\'indirizzo non porta a un\'immagine.');
  return b;
}

// ---------- Esperimenti ----------
const pubExp = (e) => (e ? { ...e, nodes: e.nodes.map((n) => ({ ...n, asset: getAsset(n.assetId) })) } : null);
function lineage(e, nodeId, seen = new Set()) {
  const n = e.nodes.find((x) => x.id === nodeId);
  if (!n || seen.has(nodeId)) return [];
  seen.add(nodeId);
  return [...n.parents.flatMap((p) => lineage(e, p, seen)), n];
}
function findLineage(assetId) {
  for (const e of Object.values(db.experiments)) {
    if (e.deleted) continue;
    const n = e.nodes.find((x) => x.assetId === assetId);
    if (n) return { experiment: e, steps: lineage(e, n.id) };
  }
  return null;
}
function addSources(expId, ids) {
  const e = db.experiments[expId];
  if (!e) throw new Error('Esperimento non trovato.');
  for (const id of ids) {
    if (!db.assets[id] || e.nodes.some((n) => n.assetId === id && !n.parents.length)) continue;
    e.nodes.push({ id: newId('n'), parents: [], assetId: id, op: { engine: 'sorgente', label: 'Sorgente' }, createdAt: now(), note: '' });
  }
  e.updatedAt = now(); save();
  return pubExp(e);
}
const work = new Map(); // decodifiche a piena (o ridotta) risoluzione in cache
async function decoded(assetId, max) {
  const k = `${assetId}:${max}`;
  if (!work.has(k)) {
    const a = db.assets[assetId];
    work.set(k, decode(await getBlob(a.blob), max));
    while (work.size > 12) work.delete(work.keys().next().value);
  }
  const d = await work.get(k);
  return { ...d, data: new Uint8ClampedArray(d.data) };
}
async function runLocal(expId, { parents = [], process: pid, params = {}, seed }) {
  const e = db.experiments[expId];
  if (!e) throw new Error('Esperimento non trovato.');
  const proc = getProcess(pid);
  if (!proc) throw new Error(`Processo sconosciuto: ${pid}`);
  const nodes = parents.map((id) => e.nodes.find((n) => n.id === id)).filter(Boolean);
  const inputs = []; let reduced = false;
  for (const n of nodes) { const d = await decoded(n.assetId, WORK_MAX); reduced ||= d.reduced; inputs.push({ width: d.width, height: d.height, data: d.data }); }
  const p2 = { ...params };
  if (proc.category === 'genesi' && (p2.size ?? 3000) > WORK_MAX) { p2.size = WORK_MAX; reduced = true; }
  const s = Number.isFinite(Number(seed)) && seed !== '' && seed != null ? Number(seed) : Math.floor(Math.random() * 1e9);
  const t0 = Date.now();
  const r = await runInWorker(pid, inputs, p2, s);
  const blob = await encode(r.image, 'image/png');
  const pa = nodes.map((n) => db.assets[n.assetId]);
  const asset = await register(blob, 'variante', {
    title: `${proc.name}${pa.length ? ` · ${pa.map((a) => a.title).join(' × ').slice(0, 120)}` : ''}`,
    tags: [...new Set(pa.flatMap((a) => a.tags))].slice(0, 12),
    origin: { type: 'algoritmo', engine: 'locale', process: pid, experiment: expId },
    rights: pa.some((a) => !['libero', 'mio'].includes(a.rights.status)) ? { status: 'da verificare', notes: 'Derivata da sorgenti con diritti non liberi: verifica prima di pubblicare.' } : { status: 'mio' },
  });
  const node = { id: newId('n'), parents, assetId: asset.id, op: { engine: 'locale', process: pid, label: proc.name, params: r.params, seed: s, ms: Date.now() - t0, reduced }, createdAt: now(), note: '' };
  e.nodes.push(node); e.updatedAt = now(); save();
  return { node: { ...node, asset }, experiment: pubExp(e) };
}

const quotes = new Map();
const smallCache = new Map();

function localReply(message, ctx) {
  const m = message.toLowerCase();
  if (/finit|conclus|pronta|riuscit/.test(m)) return 'Non sta a me dirlo, e non lo dirò. Posso solo chiederti: cosa perderesti se continuassi a trasformarla? Se la risposta è «niente», forse non è ancora tua.';
  if (/bell|mi piace|funziona/.test(m)) return 'Che ti piaccia è un dato, non un argomento. Prova a dire cosa resta ambiguo: se non resta niente, la stai rendendo decorativa. Un ramo opposto, [riflesso] o [tessere], ti direbbe se regge.';
  if (/brutt|non funziona|non mi piace|noios/.test(m)) return 'Allora cerca cosa la rende prevedibile. Di solito è la centralità o la luce troppo uniforme. Prova [deriva] per spostare il baricentro, o [erosione] per far emergere le masse.';
  if (/colore|palette/.test(m)) return 'Il colore lo deciderai in Lightroom: qui conviene lavorare sulla struttura. Se vuoi comunque spostarlo, [canali] lo fa senza «abbellire».';
  return `Ti rispondo con una mossa: ${critique({ brightness: 0.5, contrast: 0.4, entropy: 0.5, saturation: 0.3, warmth: 0, clipping: { shadows: 0, highlights: 0 }, edges: 0.3, centroid: { x: 0.5, y: 0.5 }, symmetry: { lr: 0.5, tb: 0.5 }, emptiness: 0.3, palette: [] }, { hypothesis: ctx.hypothesis }).mossa} Nella versione per Mac puoi discuterne con Claude.`;
}
const slug = (s) => String(s || 'immagine').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'immagine';

export async function demoApi() {
  return {
    mode: 'demo',
    reset: async () => { await tx('blobs', 'readwrite', (s) => s.clear()); await tx('kv', 'readwrite', (s) => s.clear()); },
    status: async () => ({
      version: '0.1.0 · prova', mode: 'demo', platform: 'web',
      engines: { locale: { available: true }, higgsfield: { available: true, simulated: true, credits: db.credits, message: 'Nella versione di prova Higgsfield è sempre simulato: nessuna chiamata, nessun credito vero.' } },
      critic: { locale: true, claude: { available: false, via: 'nessuno' } },
      counts: { assets: Object.values(db.assets).filter((a) => !a.deleted).length, experiments: Object.values(db.experiments).filter((e) => !e.deleted).length },
    }),
    processes: async () => ({ categories: CATEGORIES, processes: describeProcesses() }),
    lan: async () => null,

    assets: async (f = {}) => ({ assets: listAssets(f), tags: allTags() }),
    asset: async (id) => {
      const a = getAsset(id);
      if (!a) throw new Error('Immagine non trovata.');
      return { asset: a, lineage: findLineage(id)?.steps.map((n) => ({ ...n, asset: getAsset(n.assetId) })) || [] };
    },
    upload: async (files) => {
      const assets = [], errors = [];
      for (const f of files) {
        try { assets.push(await register(f, 'sorgente', { title: f.name.replace(/\.[^.]+$/, ''), origin: { type: 'upload', filename: f.name } })); }
        catch (e) { errors.push(`${f.name}: ${e.message}`); }
      }
      return { assets, errors };
    },
    samples: async () => {
      const src = await (await fetch('/design/prototype/data.js')).text();
      const list = JSON.parse(src.slice(src.indexOf('['), src.lastIndexOf(']') + 1));
      const have = new Set(Object.values(db.assets).filter((a) => !a.deleted).map((a) => a.origin.sampleId));
      const assets = [];
      for (const it of list) {
        if (have.has(it.id)) continue;
        const b = await (await fetch(`/design/prototype/${it.file}`)).blob();
        assets.push(await register(b, 'sorgente', {
          title: it.title, tags: it.tags, notes: `${it.original} · ${it.medium}`,
          origin: { type: 'archivio', archive: 'met', author: it.author, page: it.url, date: it.date, sampleId: it.id, note: 'Esempio (versione ridotta a 1400 px)' },
          rights: { status: 'libero', license: 'CC0 (Met Open Access)', licenseUrl: 'https://www.metmuseum.org/policies/image-resources', attribution: 'The Metropolitan Museum of Art' },
        }));
      }
      return { assets };
    },
    importUrl: async (url) => ({ asset: await register(await fetchImage(url), 'sorgente', { title: decodeURIComponent(url.split('/').pop().split('?')[0]).replace(/\.[^.]+$/, '') || 'Immagine dal web', origin: { type: 'url', url } }) }),
    updateAsset: async (id, patch) => {
      const a = db.assets[id];
      if (!a) throw new Error('Immagine non trovata.');
      if (typeof patch.title === 'string') a.title = patch.title.slice(0, 300);
      if (typeof patch.notes === 'string') a.notes = patch.notes;
      if (Array.isArray(patch.tags)) a.tags = [...new Set(patch.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))];
      if (patch.rights) { const r = { ...a.rights }; for (const k of ['license', 'licenseUrl', 'attribution', 'notes']) if (typeof patch.rights[k] === 'string') r[k] = patch.rights[k]; if (RIGHTS_STATES.includes(patch.rights.status)) r.status = patch.rights.status; a.rights = r; }
      if (patch.origin) for (const k of ['author', 'url', 'page', 'archive']) if (typeof patch.origin[k] === 'string') a.origin[k] = patch.origin[k];
      if (typeof patch.choice === 'string' && CHOICES.includes(patch.choice)) {
        if (patch.choice === 'finita' && patch.declaredByArtist !== true) throw new Error('Solo tu puoi dichiarare finita un\'opera, con il gesto di conferma.');
        a.choice = patch.choice; a.choiceAt = now();
      }
      if (typeof patch.marked === 'boolean') a.marked = patch.marked;
      save();
      return { asset: pub(a) };
    },
    deleteAsset: async (id) => { if (db.assets[id]) { db.assets[id].deleted = now(); save(); } return { ok: true }; },

    archives: async () => {
      const r = await fetch('/.netlify/functions/archivi?elenco=1');
      if (!r.ok) throw new Error('La ricerca negli archivi non risponde.');
      return r.json();
    },
    searchArchives: async (q, archives, page = 1) => {
      const r = await fetch(`/.netlify/functions/archivi?${new URLSearchParams({ q, archives: archives.join(','), page })}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'La ricerca negli archivi non risponde.');
      return j;
    },
    importFromArchive: async (it) => {
      const r = await fetch('/.netlify/functions/archivi', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ item: it }) });
      const full = r.ok ? (await r.json()).full : it.full;
      const info = {
        title: it.title, origin: { type: 'archivio', archive: it.archive, archiveId: it.id, author: it.author, page: it.page, date: it.date, via: it.via },
        rights: { status: it.rightsStatus || 'da verificare', license: it.license || '', licenseUrl: it.licenseUrl || '', attribution: it.attribution || '' },
      };
      let blob;
      try { blob = await fetchImage(full || it.fallback || it.thumb); }
      catch (e) { if (!it.fallback) throw e; blob = await fetchImage(it.fallback); info.notes = 'Importata la versione grande disponibile (non l\'originale).'; }
      return { asset: await register(blob, 'sorgente', info) };
    },

    experiments: async () => ({
      experiments: Object.values(db.experiments).filter((e) => !e.deleted).sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1)).map((e) => {
        const last = [...e.nodes].reverse().find((n) => db.assets[n.assetId]);
        return { id: e.id, title: e.title, hypothesis: e.hypothesis, state: e.state, createdAt: e.createdAt, updatedAt: e.updatedAt, count: e.nodes.length, cover: last ? urlOf(db.assets[last.assetId].thumb) : null };
      }),
    }),
    experiment: async (id) => { const e = db.experiments[id]; if (!e || e.deleted) throw new Error('Esperimento non trovato.'); return { experiment: pubExp(e) }; },
    createExperiment: async ({ title = '', hypothesis = '', assetIds = [] }) => {
      const e = { id: newId('exp'), title: title.trim() || 'Esperimento senza titolo', hypothesis: hypothesis.trim(), notes: '', state: 'in esplorazione', nodes: [], conversation: [], createdAt: now(), updatedAt: now() };
      db.experiments[e.id] = e;
      addSources(e.id, assetIds);
      return { experiment: pubExp(e) };
    },
    updateExperiment: async (id, patch) => {
      const e = db.experiments[id];
      for (const k of ['title', 'hypothesis', 'notes', 'state']) if (typeof patch[k] === 'string') e[k] = patch[k];
      e.updatedAt = now(); save();
      return { experiment: pubExp(e) };
    },
    deleteExperiment: async (id) => { if (db.experiments[id]) { db.experiments[id].deleted = now(); save(); } return { ok: true }; },
    addSources: async (id, assetIds) => ({ experiment: addSources(id, assetIds) }),
    updateNode: async (id, nodeId, patch) => {
      const e = db.experiments[id]; const n = e?.nodes.find((x) => x.id === nodeId);
      if (!n) throw new Error('Nodo non trovato.');
      if (typeof patch.note === 'string') n.note = patch.note.slice(0, 4000);
      e.updatedAt = now(); save();
      return { experiment: pubExp(e) };
    },
    run: (id, req) => runLocal(id, req),
    preview: async ({ assetIds = [], process: pid, params = {}, seed, size = 640 }) => {
      const proc = getProcess(pid);
      const inputs = [];
      for (const id of assetIds.slice(0, proc.inputs.max)) {
        const k = `${id}:${size}`;
        if (!smallCache.has(k)) { smallCache.set(k, decoded(id, size)); while (smallCache.size > 24) smallCache.delete(smallCache.keys().next().value); }
        const d = await smallCache.get(k);
        inputs.push({ width: d.width, height: d.height, data: new Uint8ClampedArray(d.data) });
      }
      const full = proc.category === 'genesi' || !assetIds.length ? Number(params.size) || 3000 : Math.max(db.assets[assetIds[0]].width, db.assets[assetIds[0]].height);
      const f = Math.min(1, size / full);
      const p2 = { ...params };
      for (const d of proc.params) {
        if (d.key === 'size') { p2.size = Math.max(64, Math.round((params.size ?? d.default) * f)); continue; }
        if (d.type === 'range' && /\(px\)/.test(d.label)) { const v = Number(params[d.key] ?? d.default); p2[d.key] = v > 0 ? Math.max(1, Math.round(v * f)) : 0; }
      }
      const r = await runInWorker(pid, inputs, p2, seed ?? Math.floor(Math.random() * 1e9));
      return URL.createObjectURL(await encode(r.image, 'image/jpeg', 0.86));
    },

    hfModels: async () => ({ models: IMAGE_MODELS, aspects: ASPECTS, simulated: true }),
    hfQuote: async (expId, { parents = [], model, prompt, aspect }) => {
      if (!prompt || !prompt.trim()) throw new Error('Serve un prompt (o un\'ipotesi) per la generazione.');
      const m = IMAGE_MODELS.find((x) => x.id === model) || IMAGE_MODELS[0];
      const refs = m.refs ? parents.length : 0;
      const id = newId('q');
      const credits = 2 + refs;
      quotes.set(id, { id, expId, parents, model: m.id, modelName: m.name, prompt, aspect, credits, at: Date.now(), used: false });
      return { quoteId: id, credits, balance: db.credits, model: m.id, modelName: m.name, prompt, aspect, refs, simulated: true, expiresAt: Date.now() + 600_000 };
    },
    hfRun: async (expId, quoteId, approval) => {
      const q = quotes.get(quoteId);
      if (!q) throw new Error('Preventivo non trovato: richiedine uno nuovo.');
      if (q.used) throw new Error('Questo preventivo è già stato usato.');
      if (Date.now() - q.at > 600_000) throw new Error('Il preventivo è scaduto (10 minuti): richiedine uno nuovo.');
      if (!approval || approval.approved !== true || Number(approval.credits) !== q.credits) throw new Error('Manca la tua approvazione esplicita del costo.');
      q.used = true;
      const r = await runLocal(expId, { parents: q.parents.slice(0, 1), process: q.parents.length ? 'deriva' : 'rumore', params: q.parents.length ? { zoom: 1.6 } : { size: 2000 }, seed: Date.now() % 1e9 });
      const e = db.experiments[expId];
      const n = e.nodes.find((x) => x.id === r.node.id);
      n.parents = q.parents;
      n.op = { engine: 'higgsfield', simulated: true, model: q.model, modelName: q.modelName, prompt: q.prompt, aspect: q.aspect, credits: q.credits, label: `SIMULATO · ${q.modelName}` };
      const a = db.assets[n.assetId];
      a.origin = { ...a.origin, type: 'generata', engine: 'higgsfield (simulato)', model: q.model, prompt: q.prompt };
      a.title = `SIMULATO · ${q.prompt.slice(0, 80)}`;
      db.credits = Math.max(0, db.credits - q.credits);
      save();
      return { nodes: [n.id], experiment: pubExp(e) };
    },

    analyze: async (assetId, experimentId) => {
      const a = db.assets[assetId];
      const e = experimentId ? db.experiments[experimentId] : null;
      const metrics = analyze(await decode(await getBlob(a.blob), 512));
      const r = { ...critique(metrics, { hypothesis: e?.hypothesis }), metrics };
      if (e) { e.conversation.push({ id: newId('m'), at: now(), role: 'interlocutore', kind: 'analisi', assetId, data: r }); save(); }
      return r;
    },
    discuss: async (message, ctx = {}) => {
      const e = ctx.experimentId ? db.experiments[ctx.experimentId] : null;
      if (!String(message || '').trim()) throw new Error('Scrivi qualcosa.');
      const r = { fonte: 'locale', testo: localReply(message, { hypothesis: e?.hypothesis }) };
      if (e) { e.conversation.push({ id: newId('m'), at: now(), role: 'autore', text: message }, { id: newId('m'), at: now(), role: 'interlocutore', text: r.testo, fonte: 'locale' }); save(); }
      return r;
    },
    ideas: async (idea) => ({ fonte: 'locale', ipotesi: proposeFromIdea(idea) }),

    exportFormats: async () => FORMATS,
    exportAsset: async (assetId, format = 'png') => {
      const a = db.assets[assetId];
      const fmt = FORMATS.find((f) => f.id === format) || FORMATS[0];
      const src = await getBlob(a.blob);
      let out = src, ext = a.file.split('.').pop();
      if (fmt.id !== 'original') {
        const bm = await bitmap(src);
        const c = canvas(bm.width, bm.height); const g = c.getContext('2d');
        if (fmt.id === 'jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
        g.drawImage(bm, 0, 0);
        out = await toBlob(c, fmt.id === 'jpeg' ? 'image/jpeg' : 'image/png', 1);
        ext = fmt.ext;
      }
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const base = `${stamp}_${slug(a.title)}_${a.id.slice(-6)}`;
      const lin = findLineage(assetId);
      const sheet = {
        titolo: a.title, file: `${base}.${ext}`, formato: fmt.name, esportato: now(), dimensioni: `${a.width} × ${a.height}`,
        provenienza: a.origin, diritti: a.rights, tag: a.tags, note: a.notes, scelta: a.choice,
        esperimento: lin ? { titolo: lin.experiment.title, ipotesi: lin.experiment.hypothesis } : null,
        cronologia: lin ? lin.steps.map((n) => ({ passo: n.op.label, motore: n.op.engine, processo: n.op.process, parametri: n.op.params, seme: n.op.seed, modello: n.op.model, prompt: n.op.prompt, crediti: n.op.credits, immagine: db.assets[n.assetId]?.title, data: n.createdAt, nota: n.note })) : [],
      };
      return {
        file: `${base}.${ext}`, bytes: out.size, url: URL.createObjectURL(out),
        sheetUrl: URL.createObjectURL(new Blob([JSON.stringify(sheet, null, 2)], { type: 'application/json' })), dir: null,
      };
    },
    reveal: async () => ({ ok: false }),
  };
}
