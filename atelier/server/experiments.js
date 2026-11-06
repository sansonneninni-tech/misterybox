// Esperimenti: grafo di varianti con ramificazioni e combinazioni.
// Ogni nodo ricorda genitori, processo, parametri e seme: tutto è ripercorribile.
import { Worker } from 'node:worker_threads';
import fs from 'node:fs';
import { getDb, newId, now, save } from './store.js';
import { rawAsset, getAsset, assetPath, saveVariant, saveVariantFile } from './library.js';
import { decode } from './imaging.js';
import { getProcess } from '../shared/processes/index.js';
import * as hf from './higgsfield.js';

export const STATES = ['in esplorazione', 'in pausa', 'materiale scelto', 'archiviato'];

const db = () => getDb();

function publicExperiment(e) {
  if (!e) return null;
  return {
    ...e,
    nodes: e.nodes.map((n) => ({ ...n, asset: getAsset(n.assetId) })),
  };
}

export function listExperiments() {
  return Object.values(db().experiments)
    .filter((e) => !e.deleted)
    .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))
    .map((e) => {
      const last = [...e.nodes].reverse().find((n) => getAsset(n.assetId));
      return { id: e.id, title: e.title, hypothesis: e.hypothesis, state: e.state, createdAt: e.createdAt, updatedAt: e.updatedAt, count: e.nodes.length, cover: last ? getAsset(last.assetId).thumbUrl : null };
    });
}

export const getExperiment = (id) => publicExperiment(db().experiments[id]);

export function createExperiment({ title = '', hypothesis = '', assetIds = [] }) {
  const e = {
    id: newId('exp'), title: title.trim() || 'Esperimento senza titolo', hypothesis: hypothesis.trim(), notes: '',
    state: 'in esplorazione', nodes: [], conversation: [], createdAt: now(), updatedAt: now(),
  };
  db().experiments[e.id] = e;
  addSources(e.id, assetIds);
  save();
  return getExperiment(e.id);
}

export function addSources(expId, assetIds = []) {
  const e = db().experiments[expId];
  if (!e) throw new Error('Esperimento non trovato.');
  for (const id of assetIds) {
    if (!rawAsset(id)) continue;
    if (e.nodes.some((n) => n.assetId === id && !n.parents.length)) continue;
    e.nodes.push({ id: newId('n'), parents: [], assetId: id, op: { engine: 'sorgente', label: 'Sorgente' }, createdAt: now(), note: '' });
  }
  e.updatedAt = now();
  save();
  return getExperiment(expId);
}

export function updateExperiment(id, patch) {
  const e = db().experiments[id];
  if (!e) return null;
  if (typeof patch.title === 'string') e.title = patch.title.slice(0, 200);
  if (typeof patch.hypothesis === 'string') e.hypothesis = patch.hypothesis.slice(0, 4000);
  if (typeof patch.notes === 'string') e.notes = patch.notes.slice(0, 20000);
  if (STATES.includes(patch.state)) e.state = patch.state;
  e.updatedAt = now();
  save();
  return getExperiment(id);
}

export function updateNode(expId, nodeId, patch) {
  const e = db().experiments[expId];
  const n = e?.nodes.find((x) => x.id === nodeId);
  if (!n) return null;
  if (typeof patch.note === 'string') n.note = patch.note.slice(0, 4000);
  if (typeof patch.hidden === 'boolean') n.hidden = patch.hidden;
  e.updatedAt = now();
  save();
  return getExperiment(expId);
}

export function deleteExperiment(id) {
  const e = db().experiments[id];
  if (!e) return false;
  e.deleted = now();
  save();
  return true;
}

// Percorso di un nodo fino alle sorgenti, in ordine cronologico.
export function lineage(e, nodeId, seen = new Set()) {
  const n = e.nodes.find((x) => x.id === nodeId);
  if (!n || seen.has(nodeId)) return [];
  seen.add(nodeId);
  const before = n.parents.flatMap((p) => lineage(e, p, seen));
  return [...before, n];
}

export function findLineageForAsset(assetId) {
  for (const e of Object.values(db().experiments)) {
    if (e.deleted) continue;
    const n = e.nodes.find((x) => x.assetId === assetId);
    if (n) return { experiment: e, steps: lineage(e, n.id) };
  }
  return null;
}

function runInWorker(id, inputs, params, seed) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./worker.js', import.meta.url), { workerData: { id, inputs, params, seed }, transferList: inputs.map((i) => i.data.buffer) });
    w.once('message', (m) => (m.ok ? resolve(m) : reject(new Error(m.error))));
    w.once('error', reject);
  });
}

function opLabel(proc, params) {
  return `${proc.name}`;
}

// Esegue un processo locale a partire da 0..n nodi genitori.
export async function runLocal(expId, { parents = [], process: pid, params = {}, seed }) {
  const e = db().experiments[expId];
  if (!e) throw new Error('Esperimento non trovato.');
  const proc = getProcess(pid);
  if (!proc) throw new Error(`Processo sconosciuto: ${pid}`);
  const nodes = parents.map((id) => e.nodes.find((n) => n.id === id)).filter(Boolean);
  if (nodes.length !== parents.length) throw new Error('Uno dei nodi scelti non esiste più.');
  const inputs = [];
  let reduced = false;
  for (const n of nodes) {
    const a = rawAsset(n.assetId);
    const img = await decode(assetPath(a));
    reduced ||= img.reduced;
    inputs.push({ width: img.width, height: img.height, data: img.data });
  }
  const s = Number.isFinite(Number(seed)) && seed !== '' && seed != null ? Number(seed) : Math.floor(Math.random() * 1e9);
  const t0 = Date.now();
  const r = await runInWorker(pid, inputs, params, s);
  const img = { width: r.image.width, height: r.image.height, data: new Uint8ClampedArray(r.image.data.buffer ?? r.image.data) };
  const parentAssets = nodes.map((n) => rawAsset(n.assetId));
  const asset = await saveVariant(img, {
    title: `${proc.name}${parentAssets[0] ? ` · ${parentAssets[0].title}` : ''}`.slice(0, 160),
    tags: [...new Set(parentAssets.flatMap((a) => a.tags))],
    origin: { type: 'algoritmo', process: pid, experiment: expId, from: parentAssets.map((a) => a.id) },
    rights: parentAssets.some((a) => a.rights.status !== 'libero' && a.rights.status !== 'mio')
      ? { status: 'da verificare', notes: 'Derivata da sorgenti con diritti non liberi: verifica prima di pubblicare.' }
      : { status: 'mio' },
  });
  const node = { id: newId('n'), parents, assetId: asset.id, op: { engine: 'locale', process: pid, label: opLabel(proc, r.params), params: r.params, seed: s, ms: Date.now() - t0, reduced }, createdAt: now(), note: '' };
  e.nodes.push(node);
  e.updatedAt = now();
  save();
  return { node: { ...node, asset }, experiment: getExperiment(expId) };
}

// Higgsfield: prima il preventivo (gratuito), poi l'esecuzione approvata.
export async function higgsfieldQuote(expId, { parents = [], model, prompt, aspect }) {
  const e = db().experiments[expId];
  if (!e) throw new Error('Esperimento non trovato.');
  const refs = parents.map((id) => e.nodes.find((n) => n.id === id)).filter(Boolean).map((n) => assetPath(rawAsset(n.assetId)));
  const q = await hf.quote({ model, prompt, aspect, refs, expId, parents });
  return q;
}

export async function higgsfieldRun(expId, { quoteId, approval }) {
  const e = db().experiments[expId];
  if (!e) throw new Error('Esperimento non trovato.');
  const q = hf.consumeQuote(quoteId, approval);
  const parents = q.req.parents || [];
  const made = [];
  let spentReal = null;
  if (q.simulated) {
    // Simulazione: stesso flusso, nessuna chiamata, risultato prodotto in locale.
    const r = await runLocal(expId, { parents: parents.slice(0, 1), process: parents.length ? 'deriva' : 'rumore', params: parents.length ? { zoom: 1.6 } : {}, seed: Date.now() % 1e9 });
    const n = db().experiments[expId].nodes.find((x) => x.id === r.node.id);
    n.parents = parents;
    n.op = { engine: 'higgsfield', simulated: true, model: q.req.model, modelName: q.modelName, prompt: q.req.prompt, aspect: q.req.aspect, credits: q.credits, label: `SIMULATO · ${q.modelName}` };
    const a = db().assets[n.assetId];
    a.origin = { ...a.origin, type: 'generata', engine: 'higgsfield (simulato)', model: q.req.model, prompt: q.req.prompt };
    a.title = `SIMULATO · ${q.req.prompt.slice(0, 80)}`;
    save();
    made.push(n.id);
  } else {
    const result = await hf.generate(q);
    spentReal = result.spent ?? null;
    for (const f of result.files) {
      const asset = await saveVariantFile(f.file, {
        title: q.req.prompt.slice(0, 120),
        tags: [],
        origin: { type: 'generata', engine: 'higgsfield', model: q.req.model, prompt: q.req.prompt, url: f.url, experiment: expId },
        rights: { status: 'da verificare', license: 'Termini di servizio Higgsfield', notes: 'Generata con Higgsfield: verifica i termini d\'uso commerciale del tuo piano.' },
      });
      fs.rmSync(f.file, { force: true });
      const node = { id: newId('n'), parents, assetId: asset.id, op: { engine: 'higgsfield', via: result.route, model: q.req.model, modelName: q.modelName, prompt: q.req.prompt, aspect: q.req.aspect, credits: result.spent ?? q.credits, creditsQuoted: q.credits, creditsMeasured: result.spent, label: result.route === 'claude' ? `${q.modelName} · via Claude` : q.modelName }, createdAt: now(), note: '' };
      e.nodes.push(node);
      made.push(node.id);
    }
    e.updatedAt = now();
    save();
  }
  return { nodes: made, spent: spentReal, experiment: getExperiment(expId) };
}

export function addMessage(expId, msg) {
  const e = db().experiments[expId];
  if (!e) return;
  e.conversation.push({ id: newId('m'), at: now(), ...msg });
  e.conversation = e.conversation.slice(-200);
  save();
}
