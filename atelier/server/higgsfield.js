// Motore Higgsfield tramite la CLI ufficiale (`higgsfield`).
//
// Regola di sicurezza: nessuna generazione a pagamento parte senza
//  1. un preventivo ottenuto con `higgsfield generate cost` (gratuito),
//  2. la conferma esplicita dell'autore su quel preventivo, nell'interfaccia,
//  3. parametri identici a quelli del preventivo, entro 10 minuti, una sola volta.
// Se il costo non è determinabile, l'esecuzione è bloccata.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DIRS } from './store.js';
import { UA } from './library.js';

const BIN = process.env.HIGGSFIELD_BIN || 'higgsfield';
const QUOTE_TTL = 10 * 60 * 1000;
const quotes = new Map();

// Modelli d'immagine proposti nell'interfaccia (l'elenco completo arriva dalla CLI se disponibile).
export const IMAGE_MODELS = [
  { id: 'nano_banana_flash', name: 'Nano Banana 2', refs: 8, note: 'Rapido, buono per trasformare immagini di riferimento.' },
  { id: 'gpt_image_2_5', name: 'GPT Image 2.5', refs: 8, note: 'Alta fedeltà, segue istruzioni complesse.' },
  { id: 'seedream_v5_pro', name: 'Seedream 5.0 Pro', refs: 8, note: 'Fotografico, buona gestione dei riferimenti.' },
  { id: 'flux_2', name: 'FLUX.2', refs: 4, note: 'Materico, buono per texture e superfici.' },
  { id: 'soul_cinematic', name: 'Soul Cinema', refs: 0, note: 'Fotogrammi cinematografici, solo testo.' },
  { id: 'z_image', name: 'Z Image', refs: 0, note: 'Bozze veloci ed economiche, solo testo.' },
];

export const ASPECTS = ['auto', '1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9'];

export function isSimulated() {
  return process.env.ATELIER_HIGGSFIELD === 'simulato';
}

function run(args, { timeout = 60_000 } = {}) {
  return new Promise((resolve) => {
    let out = '', err = '';
    let child;
    try {
      child = spawn(BIN, args, { env: { ...process.env, NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      return resolve({ code: -1, out: '', err: e.message, missing: true });
    }
    const t = setTimeout(() => { child.kill('SIGTERM'); err += '\nTempo scaduto.'; }, timeout);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => { clearTimeout(t); resolve({ code: -1, out, err: e.message, missing: e.code === 'ENOENT' }); });
    child.on('close', (code) => { clearTimeout(t); resolve({ code, out, err }); });
  });
}

function parseJson(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/[\[{][\s\S]*[\]}]/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

// Cerca ricorsivamente il primo numero sotto una chiave che indica un costo o un saldo.
function findNumber(obj, keys) {
  if (obj == null) return null;
  if (typeof obj !== 'object') return null;
  for (const [k, v] of Object.entries(obj)) {
    if (keys.some((re) => re.test(k))) {
      if (typeof v === 'number') return v;
      if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
    }
  }
  for (const v of Object.values(obj)) {
    const r = findNumber(v, keys);
    if (r != null) return r;
  }
  return null;
}

function explain(err) {
  const e = String(err || '');
  if (/not authenticated|session expired|login/i.test(e)) return 'Higgsfield non è collegato. Nel Terminale esegui: higgsfield auth login';
  if (/no workspace/i.test(e)) return 'Nessuno spazio di lavoro Higgsfield selezionato. Nel Terminale: higgsfield workspace list, poi higgsfield workspace set <id>';
  if (/insufficient|not enough credits|balance/i.test(e)) return 'Crediti Higgsfield insufficienti per questa generazione.';
  return e.split('\n').filter(Boolean).slice(-3).join(' ').slice(0, 400) || 'Errore sconosciuto della CLI Higgsfield.';
}

export async function status() {
  if (isSimulated()) return { available: true, simulated: true, message: 'Modalità simulata: nessuna chiamata reale, nessun credito consumato.' };
  const v = await run(['version'], { timeout: 15_000 });
  if (v.missing) return { available: false, installed: false, message: 'CLI Higgsfield non installata. Nel Terminale: npm i -g @higgsfield/cli' };
  const s = await run(['account', 'status', '--json'], { timeout: 20_000 });
  if (s.code !== 0) return { available: false, installed: true, message: explain(s.err || s.out) };
  const j = parseJson(s.out) || {};
  return {
    available: true, installed: true,
    credits: findNumber(j, [/credit/i, /balance/i]),
    plan: j.plan || j.subscription?.plan || j.subscription || '',
    email: j.email || '',
    message: 'Collegato.',
  };
}

function buildArgs(req) {
  const args = [req.model];
  if (req.prompt) args.push('--prompt', req.prompt);
  if (req.aspect && req.aspect !== 'auto') args.push('--aspect_ratio', req.aspect);
  for (const ref of req.refs || []) args.push('--image', ref);
  return args;
}

const hashReq = (req) => crypto.createHash('sha256').update(JSON.stringify([req.model, req.prompt, req.aspect, req.refs])).digest('hex');

// Preventivo: gratuito. Non avvia nulla.
export async function quote(req) {
  const model = IMAGE_MODELS.find((m) => m.id === req.model) || { id: req.model, name: req.model, refs: 8 };
  if (!req.prompt || !req.prompt.trim()) throw new Error('Serve un prompt (o un\'ipotesi) per la generazione.');
  if (model.refs === 0 && req.refs?.length) req = { ...req, refs: [] };
  let credits = null, raw = null;
  if (isSimulated()) {
    credits = 2 + (req.refs?.length || 0);
    raw = { simulato: true };
  } else {
    const r = await run(['generate', 'cost', ...buildArgs(req), '--json'], { timeout: 120_000 });
    if (r.missing) throw new Error('CLI Higgsfield non installata. Nel Terminale: npm i -g @higgsfield/cli');
    if (r.code !== 0) throw new Error(explain(r.err || r.out));
    raw = parseJson(r.out) ?? r.out;
    credits = typeof raw === 'number' ? raw : findNumber(raw, [/^credits?$/i, /cost/i, /price/i, /total/i, /amount/i, /credits/i]);
    if (credits == null) {
      const m = String(r.out).match(/(\d+(?:[.,]\d+)?)\s*credit/i);
      if (m) credits = Number(m[1].replace(',', '.'));
    }
  }
  if (credits == null || !Number.isFinite(credits)) {
    throw new Error('Non riesco a leggere il costo dalla CLI Higgsfield: per sicurezza la generazione resta bloccata.');
  }
  const st = isSimulated() ? { credits: 100 } : await status().catch(() => ({}));
  const id = crypto.randomUUID();
  const q = { id, req, hash: hashReq(req), credits, balance: st.credits ?? null, createdAt: Date.now(), used: false, simulated: isSimulated(), modelName: model.name };
  quotes.set(id, q);
  return { quoteId: id, credits, balance: q.balance, model: model.id, modelName: model.name, prompt: req.prompt, aspect: req.aspect, refs: (req.refs || []).length, simulated: q.simulated, expiresAt: q.createdAt + QUOTE_TTL, raw };
}

// Verifica l'approvazione: lancia un errore se qualcosa non torna.
export function consumeQuote(quoteId, approval) {
  const q = quotes.get(quoteId);
  if (!q) throw new Error('Preventivo non trovato: richiedine uno nuovo.');
  if (q.used) throw new Error('Questo preventivo è già stato usato.');
  if (Date.now() - q.createdAt > QUOTE_TTL) { quotes.delete(quoteId); throw new Error('Il preventivo è scaduto (10 minuti): richiedine uno nuovo.'); }
  if (!approval || approval.approved !== true || Number(approval.credits) !== q.credits) throw new Error('Manca la tua approvazione esplicita del costo.');
  if (hashReq(q.req) !== q.hash) throw new Error('I parametri sono cambiati dopo il preventivo.');
  q.used = true;
  return q;
}

function findUrls(obj, acc = []) {
  if (typeof obj === 'string') { if (/^https?:\/\/\S+\.(png|jpe?g|webp|tiff?|avif)(\?|$)/i.test(obj) || /^https?:\/\/\S+\/(raw|result|output)/i.test(obj)) acc.push(obj); }
  else if (Array.isArray(obj)) obj.forEach((v) => findUrls(v, acc));
  else if (obj && typeof obj === 'object') Object.values(obj).forEach((v) => findUrls(v, acc));
  return acc;
}

// Esecuzione reale: chiamata solo dopo consumeQuote().
export async function generate(q) {
  const r = await run(['generate', 'create', ...buildArgs(q.req), '--wait', '--wait-timeout', '15m', '--json'], { timeout: 16 * 60_000 });
  if (r.code !== 0) throw new Error(explain(r.err || r.out));
  const j = parseJson(r.out);
  let urls = [...new Set(findUrls(j ?? r.out))];
  if (!urls.length) urls = [...new Set((r.out.match(/https?:\/\/\S+/g) || []).filter((u) => /\.(png|jpe?g|webp)/i.test(u)))];
  if (!urls.length) throw new Error('La generazione è terminata ma non trovo il file del risultato.');
  const files = [];
  for (const u of urls.slice(0, 4)) {
    const res = await fetch(u, { headers: { 'User-Agent': UA } });
    if (!res.ok) continue;
    const f = path.join(DIRS.temp, `hf_${Date.now()}_${files.length}`);
    fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()));
    files.push({ file: f, url: u });
  }
  if (!files.length) throw new Error('Non riesco a scaricare il risultato della generazione.');
  return { files, raw: j };
}
