// Interlocutore critico. Tre fonti, in ordine di preferenza scelta dall'autore:
//  - "claude": il comando `claude` (Claude Code) già installato sul Mac, oppure
//    l'API Anthropic se è impostata ANTHROPIC_API_KEY;
//  - "locale": analisi misurabile + regole (sempre disponibile, offline).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { analyze } from '../shared/analysis.js';
import { critique, proposeFromIdea } from '../shared/provocations.js';
import { describeProcesses } from '../shared/processes/index.js';
import { decode } from './imaging.js';
import { DIRS } from './store.js';

const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const API_MODEL = process.env.ATELIER_CLAUDE_MODEL || 'claude-opus-5-5';

const SYSTEM = `Sei l'interlocutore critico di ATELIER, il laboratorio di un fotografo surrealista e astrattista.
Lavori in italiano. Il tuo ruolo:
- osservare con precisione cosa accade nell'immagine (luce, masse, vuoti, scala, tempo, materia), senza complimenti di circostanza;
- individuare tensioni e ambiguità sfruttabili;
- proporre ipotesi artistiche concrete e accostamenti inaspettati, anche contro l'idea dell'autore;
- evitare qualunque estetica AI stereotipata o commerciale (niente "epico", "cinematico", "iperrealistico", luce dorata di maniera, simmetrie decorative);
- non dichiarare MAI che un'opera è conclusa o riuscita: la decisione spetta solo all'autore.
Se l'autore ha torto, dillo con argomenti. Sii breve e denso.`;

function processCatalog() {
  return describeProcesses().map((p) => `- ${p.id} (${p.category}, ${p.inputs.min}-${p.inputs.max} immagini): ${p.name}. Parametri: ${p.params.map((d) => `${d.key}${d.type === 'range' ? `[${d.min}..${d.max}]` : d.type === 'select' ? `{${d.options.map((o) => o[0]).join('|')}}` : '[bool]'}`).join(', ')}`).join('\n');
}

const SCHEMA = `Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo, con questa forma:
{"osservazioni":["..."],"tensioni":["..."],"dissenso":"...","ipotesi":[{"titolo":"...","descrizione":"...","passi":[{"processo":"<id>","parametri":{}}],"prompt":"<prompt in inglese per un modello generativo, non stereotipato, facoltativo>"}],"mossa":"...","domanda":"..."}
Da 3 a 5 ipotesi. Usa solo processi di questo catalogo (id esatti):`;

let claudeCli = null;
export async function claudeAvailable() {
  if (process.env.ANTHROPIC_API_KEY) return { available: true, via: 'api' };
  if (claudeCli !== null) return claudeCli;
  claudeCli = await new Promise((resolve) => {
    const c = spawn(CLAUDE_BIN, ['--version']);
    c.on('error', () => resolve({ available: false, via: 'nessuno' }));
    c.on('close', (code) => resolve(code === 0 ? { available: true, via: 'cli' } : { available: false, via: 'nessuno' }));
  });
  return claudeCli;
}

async function previewJpeg(file) {
  const out = path.join(DIRS.temp, `critica_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);
  await sharp(file, { failOn: 'none', limitInputPixels: false }).rotate().resize(1400, 1400, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(out);
  return out;
}

function extractJson(text) {
  const s = String(text);
  const start = s.indexOf('{'), end = s.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try { return JSON.parse(s.slice(start, end + 1)); } catch { return null; }
}

function runCli(prompt, timeout = 240_000) {
  return new Promise((resolve, reject) => {
    const args = ['-p', prompt, '--output-format', 'json', '--allowedTools', 'Read', '--append-system-prompt', SYSTEM];
    const c = spawn(CLAUDE_BIN, args, { cwd: DIRS.temp, env: process.env });
    let out = '', err = '';
    const t = setTimeout(() => { c.kill('SIGTERM'); reject(new Error('Claude non ha risposto in tempo.')); }, timeout);
    c.stdout.on('data', (d) => (out += d));
    c.stderr.on('data', (d) => (err += d));
    c.on('error', (e) => { clearTimeout(t); reject(e); });
    c.on('close', (code) => {
      clearTimeout(t);
      if (code !== 0) return reject(new Error(err.trim().split('\n').pop() || `claude è uscito con codice ${code}`));
      let text = out;
      try { const j = JSON.parse(out); text = j.result ?? out; if (j.is_error) return reject(new Error(text)); } catch {}
      resolve(text);
    });
  });
}

async function runApi(prompt, imageFiles = []) {
  const content = [];
  for (const f of imageFiles) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: fs.readFileSync(f).toString('base64') } });
  content.push({ type: 'text', text: prompt });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: API_MODEL, max_tokens: 3000, system: SYSTEM, messages: [{ role: 'user', content }] }),
    signal: AbortSignal.timeout(240_000),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error?.message || `API Anthropic: ${res.status}`);
  return (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
}

async function askClaude(prompt, files) {
  const av = await claudeAvailable();
  if (!av.available) throw new Error('Claude non è disponibile su questo computer (installa Claude Code o imposta ANTHROPIC_API_KEY).');
  if (av.via === 'api') return runApi(prompt, files);
  const refs = files.map((f, i) => `Immagine ${i + 1}: leggi il file ${f} con lo strumento Read.`).join('\n');
  return runCli(`${refs}\n\n${prompt}`);
}

function contextText(ctx) {
  const parts = [];
  if (ctx.hypothesis) parts.push(`Ipotesi dell'autore per questo esperimento: «${ctx.hypothesis}»`);
  if (ctx.history?.length) parts.push(`Cronologia delle trasformazioni: ${ctx.history.join(' → ')}`);
  if (ctx.notes) parts.push(`Note dell'autore: ${ctx.notes}`);
  return parts.join('\n');
}

// Analisi critica di un'immagine.
export async function critiqueAsset(file, ctx = {}) {
  const img = await decode(file, 512);
  const metrics = analyze(img);
  const local = critique(metrics, { hypothesis: ctx.hypothesis, seed: ctx.seed });
  if (ctx.provider !== 'claude') return { ...local, metrics };
  const prev = await previewJpeg(file);
  try {
    const prompt = `${contextText(ctx)}\nMisure dell'analisi locale: ${JSON.stringify({ ...metrics, palette: metrics.palette.map((p) => p.hex) })}\n\nAnalizza l'immagine.\n${SCHEMA}\n${processCatalog()}`;
    const text = await askClaude(prompt, [prev]);
    const j = extractJson(text);
    if (!j) return { ...local, metrics, fonte: 'locale', avviso: 'Claude ha risposto in un formato inatteso: mostro l\'analisi locale.', testo: text };
    return { fonte: 'claude', ...j, metrics };
  } catch (e) {
    return { ...local, metrics, fonte: 'locale', avviso: `Claude non disponibile (${e.message}). Mostro l'analisi locale.` };
  } finally { fs.rmSync(prev, { force: true }); }
}

// Dialogo libero sull'esperimento.
export async function discuss({ message, file, ctx = {}, conversation = [] }) {
  const av = await claudeAvailable();
  if (ctx.provider === 'claude' && av.available) {
    const prev = file ? await previewJpeg(file) : null;
    try {
      const conv = conversation.slice(-10).map((m) => `${m.role === 'autore' ? 'AUTORE' : 'INTERLOCUTORE'}: ${m.text}`).join('\n');
      const prompt = `${contextText(ctx)}\n${conv ? `Conversazione finora:\n${conv}\n` : ''}\nAUTORE: ${message}\n\nRispondi come interlocutore critico, in prosa breve (massimo 180 parole). Se proponi un processo del laboratorio, nominalo con il suo id tra parentesi quadre, es. [pixelsort]. Catalogo:\n${processCatalog()}`;
      const text = await askClaude(prompt, prev ? [prev] : []);
      return { fonte: 'claude', testo: text.trim() };
    } catch (e) {
      return { fonte: 'locale', testo: localReply(message, ctx), avviso: `Claude non disponibile (${e.message}).` };
    } finally { if (prev) fs.rmSync(prev, { force: true }); }
  }
  return { fonte: 'locale', testo: localReply(message, ctx) };
}

function localReply(message, ctx) {
  const m = message.toLowerCase();
  if (/finit|conclus|pronta|riuscit/.test(m)) return "Non sta a me dirlo, e non lo dirò. Posso solo chiederti: cosa perderesti se continuassi a trasformarla? Se la risposta è «niente», forse non è ancora tua.";
  if (/bell|mi piace|funziona/.test(m)) return "Che ti piaccia è un dato, non un argomento. Prova a dire cosa resta ambiguo: se non resta niente, la stai rendendo decorativa. Un ramo opposto, [riflesso] o [tessere], ti direbbe se regge.";
  if (/brutt|non funziona|non mi piace|noios/.test(m)) return "Allora cerca cosa la rende prevedibile. Di solito è la centralità o la luce troppo uniforme. Prova [deriva] per spostare il baricentro, o [erosione] per far emergere le masse.";
  if (/colore|palette/.test(m)) return "Il colore lo deciderai in Lightroom: qui conviene lavorare sulla struttura. Se vuoi comunque spostarlo, [canali] lo fa senza «abbellire».";
  return `Ti rispondo con una mossa: ${critique({ brightness: 0.5, contrast: 0.4, entropy: 0.5, saturation: 0.3, warmth: 0, clipping: { shadows: 0, highlights: 0 }, edges: 0.3, centroid: { x: 0.5, y: 0.5 }, symmetry: { lr: 0.5, tb: 0.5 }, emptiness: 0.3, palette: [] }, { hypothesis: ctx.hypothesis }).mossa} Per un dialogo più ricco attiva Claude nelle impostazioni.`;
}

// Proposte per partire da zero.
export async function ideas({ idea, provider }) {
  const local = proposeFromIdea(idea);
  if (provider !== 'claude') return { fonte: 'locale', ipotesi: local };
  try {
    const prompt = `L'autore vuole partire da zero, senza immagini. Idea: «${idea}».\nProponi da 3 a 5 ipotesi: alcune con processi di genesi del laboratorio (rumore, flusso, voronoi, automa), almeno una con un prompt in inglese per un modello generativo esterno, che eviti l'estetica AI stereotipata e cerchi ambiguità, incongruenza, astrazione.\n${SCHEMA}\n${processCatalog()}`;
    const j = extractJson(await askClaude(prompt, []));
    if (!j?.ipotesi) throw new Error('formato inatteso');
    return { fonte: 'claude', ipotesi: j.ipotesi, domanda: j.domanda, dissenso: j.dissenso };
  } catch (e) {
    return { fonte: 'locale', ipotesi: local, avviso: `Claude non disponibile (${e.message}).` };
  }
}
