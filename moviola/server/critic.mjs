// L'interlocutore: chiede a Claude una lettura critica della clip.
// Prima prova una ANTHROPIC_API_KEY, poi Claude Code (`claude`) installato sul
// Mac. Se nessuno dei due c'è, risponde 501 e l'interfaccia usa le regole
// locali (web/engine/critic.js).

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MODEL = process.env.MOVIOLA_MODEL || 'claude-opus-5-5';

export const SYSTEM = `Sei l'interlocutore di MOVIOLA, il laboratorio di video astratti sperimentali di ninni, fotografo surrealista e astrattista di alto livello. I suoi riferimenti: Stan Brakhage, Norman McLaren, Len Lye, Ryoji Ikeda, Bill Viola, Paul Clipson.

Il tuo ruolo:
- Guardi un provino di fotogrammi e leggi le misure del movimento. Dici cosa succede davvero sullo schermo, con precisione da critico, non da assistente.
- Non sei accondiscendente. Se la clip è decorativa, prevedibile, "screensaver", o scivola nell'estetica AI stereotipata (viola, bagliori, simmetrie facili, morbidezza ovunque), lo dici chiaramente e spieghi perché.
- Privilegi ambiguità, tensione, incongruenza, attrito, ritmo, il fotogramma singolo, la materia. Il tempo è il tuo materiale quanto l'immagine.
- Proponi ipotesi eseguibili: modifiche concrete alla catena di processi. Almeno una deve andare contro la direzione attuale.
- Non dichiari mai finita un'opera: lo decide solo ninni.
- Scrivi in italiano, frasi brevi, senza elenchi di complimenti.

Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo:
{
  "lettura": "2-4 frasi su cosa vedi e cosa funziona o no",
  "disaccordo": "una frase se pensi che la direzione attuale sia sbagliata, altrimenti stringa vuota",
  "ipotesi": [
    { "titolo": "max 8 parole", "perche": "1-2 frasi", "ops": [ ... ] }
  ]
}
Le "ops" applicabili (usa solo processi e parametri esistenti, valori dentro i limiti indicati):
{"op":"set","pass":"<id passaggio>","param":"<id parametro>","value":<numero>}
{"op":"add","proc":"<id processo>","at":<indice nella catena, opzionale>,"blend":"normale|schermo|somma|moltiplica|differenza|sovrapponi|schiarisci|scurisci","mix":<0..1>,"params":{...}}
{"op":"remove","pass":"<id passaggio>"}
{"op":"toggle","pass":"<id passaggio>","on":true|false}
{"op":"blend","pass":"<id passaggio>","blend":"...","mix":<0..1>}
{"op":"motion","mode":"fermo|contemplativo|ritmico|caotico","amount":<0..1>,"bpm":<numero>,"speed":<numero>}
{"op":"seed"}  (nuovo seme)
Da 2 a 4 ipotesi.`;

export function buildUserText({ clip, metrics, procs, question }) {
  return [
    question ? `Domanda di ninni: ${question}` : 'Leggi questa clip.',
    '',
    'Catena attuale (in ordine):',
    JSON.stringify(clip.chain.map((p) => ({ pass: p.id, proc: p.proc, on: p.on, blend: p.blend, mix: p.mix, params: p.params }))),
    `Formato: ${clip.format.aspect}, ${clip.format.duration}s, ${clip.format.fps} fps, loop ${clip.format.loop ? 'sì' : 'no'}. Movimento: ${JSON.stringify(clip.motion)}. Sorgenti: ${clip.sources.length}.`,
    '',
    'Misure (0..1 salvo dove indicato):',
    JSON.stringify(metrics),
    '',
    'Processi disponibili e parametri [min, max]:',
    procs,
  ].join('\n');
}

export function available() {
  if (process.env.ANTHROPIC_API_KEY) return 'api';
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['claude'], { encoding: 'utf8' });
  if (r.status === 0 && r.stdout.trim()) return 'cli';
  return null;
}

function parseJSON(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('risposta senza JSON');
  return JSON.parse(text.slice(a, b + 1));
}

export async function ask(body) {
  const mode = available();
  if (!mode) { const e = new Error('Nessun Claude disponibile sul Mac'); e.status = 501; throw e; }
  const text = buildUserText(body);
  const sheet = body.sheet && body.sheet.startsWith('data:image/jpeg;base64,') ? body.sheet.slice(23) : null;
  if (mode === 'api') {
    const content = [];
    if (sheet) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: sheet } });
    content.push({ type: 'text', text });
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, system: SYSTEM, messages: [{ role: 'user', content }] }),
    });
    if (!r.ok) throw new Error('Claude API: ' + r.status + ' ' + (await r.text()).slice(0, 300));
    const j = await r.json();
    const out = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    return { via: 'Claude (API)', ...parseJSON(out) };
  }
  // Claude Code sul Mac: il provino va in un file temporaneo che può leggere
  let img = '';
  if (sheet) {
    img = path.join(os.tmpdir(), `moviola-provino-${Date.now()}.jpg`);
    fs.writeFileSync(img, Buffer.from(sheet, 'base64'));
  }
  const prompt = `${SYSTEM}\n\n${img ? `Il provino dei fotogrammi è nel file ${img}: aprilo con lo strumento Read prima di rispondere.\n\n` : ''}${text}`;
  const out = await new Promise((resolve, reject) => {
    const p = spawn('claude', ['-p', '--output-format', 'text', '--allowedTools', 'Read'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let o = '', e = '';
    const timer = setTimeout(() => { p.kill(); reject(new Error('Claude non ha risposto in 150 s')); }, 150000);
    p.stdout.on('data', (d) => { o += d; });
    p.stderr.on('data', (d) => { e += d; });
    p.on('error', reject);
    p.on('close', (c) => { clearTimeout(timer); c === 0 ? resolve(o) : reject(new Error(e || 'claude uscito con ' + c)); });
    p.stdin.end(prompt);
  });
  if (img) fs.rm(img, () => {});
  return { via: 'Claude Code', ...parseJSON(out) };
}
