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

import * as viaMcp from './higgsfield-mcp.js';

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

// Errore della CLI: una frase in italiano più la riga originale, che l'app
// mostra sempre sotto. Se la CLI risponde con JSON ({"error_type": …}) uso quello.
export class HfError extends Error {
  constructor(text, detail) { super(text); this.detail = detail || ''; }
}

export function hfError(err) {
  // La CLI scrive spesso «Error: {"error_type": …}»: tolgo il prefisso e cerco l'oggetto con error_type.
  const raw = String(err || '').split('\n').map((l) => l.replace(/^\s*(error|errore)\s*:\s*/i, '').trim()).filter(Boolean).join('\n');
  const typed = raw.match(/\{[^{}]*"error_type"[^{}]*\}/);
  const j = (typed && parseJson(typed[0])) || (raw ? parseJson(raw) : null);
  const type = j?.error_type || j?.error?.type || j?.code || '';
  const said = j ? [type, j.message || j.error?.message || (typeof j.error === 'string' ? j.error : '')].filter(Boolean).join(': ') : '';
  const detail = (said || raw.split('\n').map((l) => l.trim()).filter(Boolean).slice(-3).join(' ')).slice(0, 300);
  const e = new HfError(explain(`${type} ${raw}`), detail);
  e.trial = /only_mcp_usage_on_trial/i.test(`${type} ${raw}`);
  return e;
}

function explain(e) {
  if (/only_mcp_usage_on_trial/i.test(e)) return 'Il tuo piano Higgsfield è in prova: durante la prova la CLI di Higgsfield non genera, accetta solo il collegamento MCP. Nessun credito è stato usato. Chiedi un nuovo preventivo: passerà da Claude, che ha l\'MCP di Higgsfield collegato.';
  if (/not authenticated|session expired|unauthori[sz]ed|please log ?in|auth login/i.test(e)) return 'Higgsfield non è collegato. Nel Terminale esegui: higgsfield auth login';
  if (/no workspace/i.test(e)) return 'Nessuno spazio di lavoro Higgsfield selezionato. Nel Terminale: higgsfield workspace list, poi higgsfield workspace set <id>';
  if (/insufficient|not enough credits|balance/i.test(e)) return 'Crediti Higgsfield insufficienti per questa generazione.';
  return 'Higgsfield ha risposto con un errore.';
}

export const MCP_MODEL = viaMcp.MCP_MODEL;
let lastAccountTrial = null;
// Strada attuale senza rileggere la CLI (usa l'ultimo saldo letto).
export function currentRoute() {
  if (isSimulated()) return { route: 'cli', pref: 'auto', reason: 'Modalità simulata.' };
  return viaMcp.resolveRoute({ accountTrial: lastAccountTrial });
}
export const setRoutePref = (r) => { viaMcp.setRoutePref(r); return currentRoute(); };

export async function status() {
  if (isSimulated()) return { available: true, simulated: true, message: 'Modalità simulata: nessuna chiamata reale, nessun credito consumato.' };
  const v = await run(['version'], { timeout: 15_000 });
  if (v.missing) return { available: false, installed: false, message: 'CLI Higgsfield non installata. Nel Terminale: npm i -g @higgsfield/cli' };
  const s = await run(['account', 'status', '--json'], { timeout: 20_000 });
  if (s.code !== 0) { const e = hfError(s.err || s.out); return { available: false, installed: true, message: e.message, detail: e.detail }; }
  const j = parseJson(s.out) || {};
  lastAccountTrial = viaMcp.trialFromAccount(j);
  const r = viaMcp.resolveRoute({ accountTrial: lastAccountTrial });
  return {
    available: true, installed: true, route: r.route, routePref: r.pref, routeReason: r.reason, trial: lastAccountTrial,
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
  // In prova la generazione passa da Claude (MCP): lo decido qui, prima di ogni spesa,
  // così la CLI non deve fallire una volta per scoprirlo. Nessuna chiamata a Claude: il preventivo resta gratuito.
  const st = isSimulated() ? { credits: 100 } : await status().catch(() => ({}));
  const route = isSimulated() ? 'cli' : (st.route || currentRoute().route);
  if (route === 'claude') {
    if (req.refs?.length && req.textOnly) req = { ...req, refs: [] };
    if (req.refs?.length) throw new HfError('Con il piano Higgsfield in prova, per ora ATELIER genera via Claude solo da testo: scegli «solo dal testo», oppure attiva il piano.', 'only_mcp_usage_on_trial_is_available');
    if (!viaMcp.MCP_MODEL[req.model]) throw new HfError(`«${model.name}» non è disponibile via MCP durante la prova: scegli Nano Banana 2, GPT Image, Seedream 5.0 Pro o FLUX.2.`, req.model);
  }
  let credits = null, raw = null;
  if (isSimulated()) {
    credits = 2 + (req.refs?.length || 0);
    raw = { simulato: true };
  } else {
    const r = await run(['generate', 'cost', ...buildArgs(req), '--json'], { timeout: 120_000 });
    if (r.missing) throw new Error('CLI Higgsfield non installata. Nel Terminale: npm i -g @higgsfield/cli');
    if (r.code !== 0) throw hfError(r.err || r.out);
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
  const id = crypto.randomUUID();
  const q = { id, req, hash: hashReq(req), credits, balance: st.credits ?? null, createdAt: Date.now(), used: false, simulated: isSimulated(), modelName: model.name, route };
  quotes.set(id, q);
  return { quoteId: id, credits, balance: q.balance, model: model.id, modelName: model.name, prompt: req.prompt, aspect: req.aspect, refs: (req.refs || []).length, simulated: q.simulated, route, routeReason: st.routeReason || '', claudeUsd: route === 'claude' ? viaMcp.CLAUDE_COST_USD : 0, textOnly: !!(req.textOnly && route === 'claude'), expiresAt: q.createdAt + QUOTE_TTL, raw };
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

// Attesa e recupero di un job con la CLI: comandi di sola lettura, gratuiti.
async function waitJob(id) {
  if (!/^[\w-]{4,80}$/.test(id)) return [];
  const r = await run(['generate', 'wait', id, '--quiet', '--timeout', '12m', '--json'], { timeout: 13 * 60_000 });
  const g = r.code === 0 ? r : await run(['generate', 'get', id, '--json'], { timeout: 30_000 });
  if (g.code !== 0) { console.log(`[higgsfield] attesa job ${id} non riuscita: ${(g.err || g.out).slice(0, 300)}`); return []; }
  return [...new Set(findUrls(parseJson(g.out) ?? g.out))];
}

// L'ultimo job d'immagine con questo prompt, creato dopo `since`. Solo lettura, gratis.
// Prendo un job solo se il prompt coincide: mai il risultato di un'altra generazione.
export function pickRecentJob(list, prompt, since) {
  const items = [];
  const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (typeof (o.prompt ?? o.params?.prompt ?? o.input?.prompt) === 'string') items.push(o); else Object.values(o).forEach(walk); } };
  walk(list);
  const norm = (t) => String(t || '').trim().replace(/\s+/g, ' ');
  const time = (o) => Date.parse(o.created_at || o.createdAt || o.created || '') || null;
  const hits = items.filter((o) => norm(o.prompt ?? o.params?.prompt ?? o.input?.prompt) === norm(prompt) && (time(o) == null || time(o) >= since - 120_000));
  hits.sort((a, b) => (time(b) || 0) - (time(a) || 0));
  const o = hits[0];
  return o ? { id: String(o.id || o.job_id || ''), urls: [...new Set(findUrls(o))] } : null;
}
// Le ultime generazioni d'immagine su Higgsfield, per importarle senza rigenerare. Gratis.
export async function recentImages(size = 24) {
  if (isSimulated()) return { ok: true, items: [] };
  const r = await run(['generate', 'list', '--image', '--size', String(size), '--json'], { timeout: 30_000 });
  if (r.code !== 0) { const e = hfError(r.err || r.out); return { ok: false, message: 'Non riesco a leggere l\'elenco da Higgsfield: incolla l\'indirizzo dell\'immagine o scegli il file scaricato.', detail: e.detail }; }
  const items = [];
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== 'object') return;
    const urls = [...new Set(findUrls(o))];
    if ((o.id || o.job_id) && urls.length) items.push({ id: String(o.id || o.job_id), prompt: String(o.prompt ?? o.params?.prompt ?? o.input?.prompt ?? ''), createdAt: o.created_at || o.createdAt || '', urls: urls.slice(0, 4) });
    else Object.values(o).forEach(walk);
  };
  walk(parseJson(r.out));
  return { ok: true, items: items.slice(0, size) };
}

async function recentJob(prompt, since) {
  const r = await run(['generate', 'list', '--image', '--size', '10', '--json'], { timeout: 30_000 });
  if (r.code !== 0) return null;
  const found = pickRecentJob(parseJson(r.out), prompt, since);
  if (found && !found.urls.length && found.id) found.urls = await waitJob(found.id);
  return found;
}

// Esecuzione reale: chiamata solo dopo consumeQuote().
export async function generate(q) {
  let urls, j = null, spent = null, claudeUsd = null, recovered = false;
  if (q.route === 'claude') {
    const r = await viaMcp.generateViaClaude(q, {
      readCredits: async () => (await status()).credits ?? null,
      waitJob, recentJob,
    });
    urls = r.urls; spent = r.spent; j = r; claudeUsd = r.claudeUsd ?? null; recovered = !!r.recovered;
  } else {
    const r = await run(['generate', 'create', ...buildArgs(q.req), '--wait', '--wait-timeout', '15m', '--json'], { timeout: 16 * 60_000 });
    if (r.code !== 0) {
      const e = hfError(r.err || r.out);
      // La CLI ha rifiutato prima di generare: dal prossimo preventivo si passa da Claude.
      if (e.trial) { viaMcp.setTrialMode(true); if (viaMcp.routePref() === 'cli') viaMcp.setRoutePref('auto'); }
      throw e;
    }
    j = parseJson(r.out);
    urls = [...new Set(findUrls(j ?? r.out))];
    if (!urls.length) urls = [...new Set((r.out.match(/https?:\/\/\S+/g) || []).filter((u) => /\.(png|jpe?g|webp)/i.test(u)))];
  }
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
  return { files, raw: j, spent, claudeUsd, recovered, route: q.route || 'cli' };
}
