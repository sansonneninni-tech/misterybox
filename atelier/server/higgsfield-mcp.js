// Higgsfield in prova: la CLI rifiuta le generazioni (only_mcp_usage_on_trial),
// l'MCP ufficiale le accetta. ATELIER passa allora da Claude Code, che ha
// l'MCP higgsfield collegato, con un elenco minimo di strumenti consentiti.
//
// Regole, uguali alla via CLI:
// - il preventivo resta `higgsfield generate cost` (gratuito, funziona in prova);
// - la generazione parte solo dopo consumeQuote(), cioè dopo il tieni premuto;
// - una sola chiamata a Claude per generazione (ogni chiamata costa: con la
//   fatturazione API anche mezzo dollaro), con un modello piccolo e pochi turni;
// - il costo reale in crediti si misura con il saldo della CLI prima e dopo (gratis).
import fs from 'node:fs';
import path from 'node:path';
import { claudeWithTools, extractJson, ClaudeError } from './critic.js';
import { DIRS } from './store.js';

// Nomi esatti degli strumenti (Claude Code: /mcp → higgsfield → View tools).
// In Claude Code gli strumenti MCP vanno caricati con ToolSearch, che è in sola lettura.
// Whitelist esplicita, mai il prefisso mcp__higgsfield: l'MCP ha anche strumenti
// come cancel_trial_auto_renewal, delete_*, publish_* che ATELIER non deve poter toccare.
export const TOOLS = {
  generate: ['ToolSearch', 'mcp__higgsfield__generate_image', 'mcp__higgsfield__jobs_wait'],
};
// Modello di Claude che fa solo da esecutore: basta il più piccolo, costa molto meno.
const EXEC_MODEL = process.env.ATELIER_CLAUDE_EXEC_MODEL || 'haiku';

// Id dei modelli nell'MCP (da models_explore sul Mac di ninni, 2026-11-06).
// La CLI usa in parte nomi diversi; quelli senza corrispondenza non passano via MCP.
export const MCP_MODEL = {
  nano_banana_flash: 'nano_banana_2',
  gpt_image_2_5: 'gpt_image_2_6',
  seedream_v5_pro: 'seedream_v5_pro',
  flux_2: 'flux_2',
};

const STATE = () => path.join(DIRS.temp, '..', 'higgsfield.json');
export function trialMode() {
  try { return JSON.parse(fs.readFileSync(STATE(), 'utf8')).trial === true; } catch { return false; }
}
export function setTrialMode(on) {
  fs.writeFileSync(STATE(), JSON.stringify({ trial: !!on, at: new Date().toISOString() }));
}

const SYSTEM = `Sei un esecutore per ATELIER. Fai solo ciò che è chiesto, con gli strumenti consentiti, una volta sola.
Non cambiare mai modello, prompt, formato o numero di immagini. Se qualcosa non torna, fermati senza generare.
Alla fine rispondi SOLO con un oggetto JSON, senza testo prima o dopo.`;

// Generazione: una sola chiamata a generate_image con i parametri del preventivo.
// readCredits() legge il saldo con la CLI (gratis, funziona anche in prova).
export async function generateViaClaude(q, readCredits = async () => null) {
  const model = MCP_MODEL[q.req.model];
  if (!model) throw new ClaudeError('Questo modello non è disponibile via MCP durante la prova: scegline un altro.', q.req.model);
  if (q.req.refs?.length) throw new ClaudeError('Con il piano in prova, per ora ATELIER genera via Claude solo da testo: togli le foto di partenza o attiva il piano.', 'refs via MCP non ancora attive');
  const before = await readCredits().catch(() => null);
  const want = { model, prompt: q.req.prompt, ...(q.req.aspect && q.req.aspect !== 'auto' ? { aspect_ratio: q.req.aspect } : {}), images: 1 };
  const text = await claudeWithTools(
    `Carica con ToolSearch lo strumento mcp__higgsfield__generate_image e chiamalo UNA sola volta: modello, prompt e formato esattamente questi ${JSON.stringify(want)}, una sola immagine, context "ATELIER: generazione approvata dall'autore". Poi, se serve, aspetta la fine del job con mcp__higgsfield__jobs_wait.
Se il modello o i parametri vengono rifiutati, NON riprovare con altri valori: rispondi {"error":"<motivo>"}.
Altrimenti rispondi {"urls":["<url https dell'immagine>"],"job_id":"<id>"}.`,
    { allowedTools: TOOLS.generate, maxTurns: 6, model: EXEC_MODEL, system: SYSTEM });
  const j = extractJson(text) || {};
  const after = await readCredits().catch(() => null);
  const spent = before != null && after != null ? +(before - after).toFixed(2) : null;
  if (j.error) throw new ClaudeError('Higgsfield non ha accettato la generazione. Nessun nuovo tentativo.', String(j.error).slice(0, 300));
  const urls = (Array.isArray(j.urls) ? j.urls : []).filter((u) => /^https:\/\//.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(u)).slice(0, 4);
  if (!urls.length) throw new ClaudeError('La generazione via Claude non ha restituito l\'immagine. Guarda in higgsfield.ai, negli Assets, prima di riprovare.', text.slice(0, 300));
  return { urls, jobId: j.job_id || '', spent, before, after };
}
