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
import os from 'node:os';
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
function readState() { try { return JSON.parse(fs.readFileSync(STATE(), 'utf8')) || {}; } catch { return {}; } }
function writeState(patch) { fs.writeFileSync(STATE(), JSON.stringify({ ...readState(), ...patch, at: new Date().toISOString() })); }
export function trialMode() { return readState().trial === true; }
export function setTrialMode(on) { writeState({ trial: !!on }); }

// Strada scelta dall'autore in Avanzato: 'auto' (predefinita), 'claude' o 'cli'.
export const ROUTES = ['auto', 'claude', 'cli'];
export function routePref() { const r = readState().route; return ROUTES.includes(r) ? r : 'auto'; }
export function setRoutePref(r) { if (!ROUTES.includes(r)) throw new Error('Strada non valida.'); writeState({ route: r }); }

// L'MCP higgsfield è configurato in Claude Code? Lo leggo da ~/.claude.json
// (nessuna chiamata a Claude: gratis). Cerco server con "higgsfield" nel nome o nell'URL.
export function mcpConfigured(home = os.homedir()) {
  const files = [process.env.CLAUDE_CONFIG_DIR && path.join(process.env.CLAUDE_CONFIG_DIR, '.claude.json'), path.join(home, '.claude.json')].filter(Boolean);
  const has = (servers) => servers && typeof servers === 'object' && Object.entries(servers).some(([k, v]) => /higgsfield/i.test(k) || /higgsfield/i.test(String(v?.url || '')));
  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (has(j.mcpServers)) return true;
      if (Object.values(j.projects || {}).some((p) => has(p?.mcpServers))) return true;
    } catch {}
  }
  return false;
}

// Il saldo della CLI dice se il piano è in prova? true, false, o null se non si capisce.
export function trialFromAccount(j) {
  let found = null;
  const walk = (o, depth = 0) => {
    if (!o || typeof o !== 'object' || depth > 5 || found != null) return;
    for (const [k, v] of Object.entries(o)) {
      if (/trial/i.test(k) && typeof v === 'boolean') { found = v; return; }
      if (/^(status|plan|state|subscription|tier|plan_status|subscription_status)$/i.test(k) && typeof v === 'string' && /trial/i.test(v)) { found = true; return; }
      if (typeof v === 'object') walk(v, depth + 1);
    }
  };
  walk(j);
  return found;
}

// Quale strada usa la prossima generazione, e perché (per mostrarlo nell'interfaccia).
// Nessuna chiamata a pagamento: legge solo file locali e il saldo già letto dalla CLI.
export function resolveRoute({ accountTrial = null, mcp = mcpConfigured() } = {}) {
  const pref = routePref();
  if (pref === 'cli') return { route: 'cli', pref, reason: 'Scelta in Avanzato: CLI di Higgsfield.' };
  if (pref === 'claude') return { route: 'claude', pref, reason: 'Scelta in Avanzato: via Claude (MCP).' };
  if (accountTrial === true) return { route: 'claude', pref, reason: 'Il piano Higgsfield è in prova: si genera via Claude (MCP).' };
  // Un rifiuto fresco della CLI (ultimi 10 minuti) vale più del saldo: resta via Claude.
  const st = readState();
  const fresh = st.trial === true && Date.now() - Date.parse(st.at || 0) < 10 * 60_000;
  if (accountTrial === false && !fresh) { if (st.trial) setTrialMode(false); return { route: 'cli', pref, reason: 'Piano Higgsfield attivo: si genera con la CLI.' }; }
  if (trialMode()) return { route: 'claude', pref, reason: 'La CLI di Higgsfield ha già rifiutato per la prova: si genera via Claude (MCP).' };
  if (mcp) return { route: 'claude', pref, reason: 'L\'MCP di Higgsfield è collegato a Claude: si genera via Claude.' };
  return { route: 'cli', pref, reason: 'Si genera con la CLI di Higgsfield.' };
}

// Costo di Claude per una generazione via MCP (fatturazione API): stima prudente, in dollari.
export const CLAUDE_COST_USD = 0.5;

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
