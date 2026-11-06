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
import { fileURLToPath } from 'node:url';
import { claudeRun, extractJson, ClaudeError } from './critic.js';
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
// Turni: ToolSearch, generate_image, risposta; margine per un jobs_wait se serve.
export const MAX_TURNS = 12;
const guardUsed = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')).used === true; } catch { return null; } };
const GUARD = fileURLToPath(new URL('./hf-guard.cjs', import.meta.url));

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
// Claude risponde subito con l'id del job; l'attesa e il recupero del risultato li fa
// ATELIER con la CLI (gratis). Così bastano pochi turni e Claude costa meno.
// cli: { readCredits(), waitJob(id) → urls, recentJob(prompt, since) → { id, urls } | null }
export async function generateViaClaude(q, cli = {}) {
  const { readCredits = async () => null, waitJob = async () => [], recentJob = async () => null } = typeof cli === 'function' ? { readCredits: cli } : cli;
  const model = MCP_MODEL[q.req.model];
  if (!model) throw new ClaudeError('Questo modello non è disponibile via MCP durante la prova: scegline un altro.', q.req.model);
  if (q.req.refs?.length) throw new ClaudeError('Con il piano in prova, per ora ATELIER genera via Claude solo da testo: togli le foto di partenza o attiva il piano.', 'refs via MCP non ancora attive');
  const before = await readCredits().catch(() => null);
  const since = Date.now();
  // Parametri esatti per generate_image: count 1 (lo strumento accetta 2-4 per le varianti, e ognuna costa).
  const want = { params: { model, prompt: q.req.prompt, ...(q.req.aspect && q.req.aspect !== 'auto' ? { aspect_ratio: q.req.aspect } : {}), count: 1 } };
  // Guardia (hook PreToolUse): blocca una seconda chiamata, count > 1, modello o prompt diversi.
  const guard = path.join(DIRS.temp, `hf-guard-${q.id || Date.now()}.json`);
  fs.writeFileSync(guard, JSON.stringify({ model, prompt: q.req.prompt, used: false }));
  const settings = { hooks: { PreToolUse: [{ matcher: 'mcp__higgsfield__generate_image', hooks: [{ type: 'command', command: `"${process.execPath}" "${GUARD}" "${guard}"` }] }] } };
  let run;
  try {
    run = await claudeRun(
      `Carica con ToolSearch lo strumento mcp__higgsfield__generate_image e chiamalo UNA sola volta con esattamente questi argomenti: ${JSON.stringify(want)}, più context "ATELIER: generazione approvata dall'autore". Una sola immagine: non aggiungere count, batch_size o altri parametri.
Se la chiamata dà un errore o una risposta che non capisci, NON richiamare generate_image: rispondi con quello che hai.
Appena generate_image risponde, rispondi subito, senza aspettare la fine del job. Usa mcp__higgsfield__jobs_wait solo se generate_image non ti dà né un id del job né un URL.
Se il modello o i parametri vengono rifiutati, NON riprovare con altri valori: rispondi {"error":"<motivo>"}.
Altrimenti rispondi {"job_id":"<id del job>","urls":["<url https dell'immagine, se c'è già>"]}.`,
      { allowedTools: TOOLS.generate, maxTurns: MAX_TURNS, model: EXEC_MODEL, system: SYSTEM, settings });
  } catch (e) {
    // Claude si è fermato: la generazione può essere partita lo stesso. Controllo il saldo (gratis).
    if (!(e instanceof ClaudeError)) throw e;
    const called = guardUsed(guard);
    fs.rmSync(guard, { force: true });
    if (called === false) {
      const err = new ClaudeError(`${e.message} generate_image non è stato chiamato: nessun credito usato.`, e.detail);
      err.meta = e.meta;
      throw err;
    }
    const after = await readCredits().catch(() => null);
    const spent = before != null && after != null ? +(before - after).toFixed(2) : null;
    if (spent == null || spent > 0) {
      const found = await recentJob(q.req.prompt, since).catch(() => null);
      if (found?.urls?.length) return { urls: found.urls.slice(0, 4), jobId: found.id || '', spent, before, after, claudeUsd: e.meta?.costUsd ?? null, recovered: true };
      const why = spent == null ? 'Non riesco a rileggere il saldo di Higgsfield' : `Il saldo Higgsfield è sceso di ${spent} crediti`;
      const err = new ClaudeError(`${e.message} ${why}: la generazione potrebbe essere avvenuta. Guarda negli Assets di higgsfield.ai prima di riprovare.`, e.detail);
      err.maybeSpent = true; err.meta = e.meta;
      throw err;
    }
    const err = new ClaudeError(`${e.message} Il saldo Higgsfield non è cambiato: nessun credito usato.`, e.detail);
    err.meta = e.meta;
    throw err;
  }
  fs.rmSync(guard, { force: true });
  const j = extractJson(run.text) || {};
  if (j.error) throw new ClaudeError('Higgsfield non ha accettato la generazione. Nessun nuovo tentativo.', [String(j.error).slice(0, 300), run.meta.summary].join(' · '));
  const okUrl = (u) => typeof u === 'string' && (/^https:\/\//.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(u));
  let urls = (Array.isArray(j.urls) ? j.urls : []).filter(okUrl).slice(0, 4);
  const jobId = typeof j.job_id === 'string' ? j.job_id.trim() : '';
  if (!urls.length && jobId) urls = (await waitJob(jobId).catch(() => [])).filter(okUrl).slice(0, 4);
  if (!urls.length) { const found = await recentJob(q.req.prompt, since).catch(() => null); if (found?.urls?.length) urls = found.urls.filter(okUrl).slice(0, 4); }
  const after = await readCredits().catch(() => null);
  const spent = before != null && after != null ? +(before - after).toFixed(2) : null;
  if (!urls.length) {
    const err = new ClaudeError(`La generazione è partita${jobId ? ` (job ${jobId})` : ''} ma non ho ancora il risultato. Guarda negli Assets di higgsfield.ai prima di riprovare.`, [run.text.slice(0, 200), run.meta.summary].join(' · '));
    err.maybeSpent = true;
    throw err;
  }
  return { urls, jobId, spent, before, after, claudeUsd: run.meta.costUsd };
}
