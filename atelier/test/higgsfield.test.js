import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.ATELIER_HIGGSFIELD = 'simulato';
process.env.ATELIER_DATA = (await import('node:os')).tmpdir() + '/atelier-test-' + Date.now();
const hf = await import('../server/higgsfield.js');

test('nessuna generazione senza approvazione esplicita del costo', async () => {
  const q = await hf.quote({ model: 'nano_banana_flash', prompt: 'nebbia di sale', aspect: 'auto', refs: [] });
  assert.throws(() => hf.consumeQuote(q.quoteId, null), /approvazione/);
  assert.throws(() => hf.consumeQuote(q.quoteId, { approved: true, credits: q.credits + 1 }), /approvazione/);
  assert.ok(hf.consumeQuote(q.quoteId, { approved: true, credits: q.credits }));
  assert.throws(() => hf.consumeQuote(q.quoteId, { approved: true, credits: q.credits }), /già stato usato/);
});

test('errori della CLI Higgsfield: error_type in italiano, riga originale sotto', () => {
  const trial = hf.hfError('Error: {"error_type":"only_mcp_usage_on_trial_is_available"}');
  assert.match(trial.message, /in prova/);
  assert.match(trial.message, /Nessun credito/);
  assert.equal(trial.detail, 'only_mcp_usage_on_trial_is_available');
  assert.match(hf.hfError('Error: not authenticated, run higgsfield auth login').message, /auth login/);
  assert.match(hf.hfError('{"error_type":"insufficient_credits","message":"Not enough credits"}').detail, /insufficient_credits: Not enough credits/);
  const other = hf.hfError('Error: {"error_type":"something_new"}');
  assert.equal(other.message, 'Higgsfield ha risposto con un errore.');
  assert.equal(other.detail, 'something_new');
  // «login» da solo, dentro un altro errore, non vuol dire sessione chiusa.
  assert.doesNotMatch(hf.hfError('model not available for this workspace (see login page docs)').message, /auth login/);
});

test('via Claude (prova): whitelist esatta, niente strumenti pericolosi', async () => {
  const m = await import('../server/higgsfield-mcp.js');
  assert.deepEqual(m.TOOLS.generate, ['ToolSearch', 'mcp__higgsfield__generate_image', 'mcp__higgsfield__jobs_wait']);
  for (const t of m.TOOLS.generate) {
    assert.ok(!t.endsWith('__') && !t.includes('*'), 'mai un prefisso intero');
    assert.doesNotMatch(t, /cancel|delete|publish|deploy|sandbox|tiktok|batch/);
  }
  // Ogni modello della CLI o ha un id MCP o viene rifiutato prima di chiamare Claude.
  await assert.rejects(m.generateViaClaude({ req: { model: 'soul_cinematic', prompt: 'x' } }), /non è disponibile via MCP/);
  await assert.rejects(m.generateViaClaude({ req: { model: 'gpt_image_2_5', prompt: 'x', refs: ['/a.jpg'] } }), /solo da testo/);
});

test('errore della CLI con righe in più: resta in italiano, riga tecnica a parte', () => {
  const e = hf.hfError('⠋ Generating [1/1]\nError: {"error_type":"only_mcp_usage_on_trial_is_available"}\n    at run (cli.js:12) {code: 1}');
  assert.ok(e.trial);
  assert.match(e.message, /in prova/);
  assert.doesNotMatch(e.message, /error_type|Error:/);
  assert.equal(e.detail, 'only_mcp_usage_on_trial_is_available');
});

test('strada: in prova si va via Claude già dal primo preventivo', async () => {
  const os = await import('node:os'), fs = await import('node:fs'), path = await import('node:path');
  const mcp = await import('../server/higgsfield-mcp.js');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  assert.equal(mcp.mcpConfigured(home), false);
  fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ mcpServers: { higgsfield: { type: 'http', url: 'https://mcp.higgsfield.ai/mcp' } } }));
  assert.equal(mcp.mcpConfigured(home), true);
  assert.equal(mcp.trialFromAccount({ plan: 'Plus', subscription: { status: 'trialing' } }), true);
  assert.equal(mcp.trialFromAccount({ plan: 'Plus', is_trial: false }), false);
  assert.equal(mcp.trialFromAccount({ credits: 100 }), null);
  mcp.setRoutePref('auto');
  assert.equal(mcp.resolveRoute({ accountTrial: null, mcp: true }).route, 'claude');
  assert.equal(mcp.resolveRoute({ accountTrial: true, mcp: false }).route, 'claude');
  assert.equal(mcp.resolveRoute({ accountTrial: null, mcp: false }).route, 'cli');
  assert.equal(mcp.resolveRoute({ accountTrial: false, mcp: true }).route, 'cli');
  mcp.setRoutePref('cli');
  assert.equal(mcp.resolveRoute({ accountTrial: true, mcp: true }).route, 'cli');
  mcp.setRoutePref('claude');
  assert.equal(mcp.resolveRoute({ accountTrial: false, mcp: false }).route, 'claude');
  mcp.setRoutePref('auto');
  assert.throws(() => mcp.setRoutePref('qualsiasi'), /non valida/);
});

test('via Claude: se si ferma (max turni) controllo il saldo e non dico «scrivi claude»', async () => {
  const os = await import('node:os'), fs = await import('node:fs'), path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-'));
  const bin = path.join(dir, 'claude');
  fs.writeFileSync(bin, '#!/bin/sh\necho \'{"type":"result","subtype":"error_max_turns","is_error":true,"num_turns":7,"total_cost_usd":0.083}\'\nexit 1\n');
  fs.chmodSync(bin, 0o755);
  process.env.CLAUDE_BIN = bin;
  const crit = await import('../server/critic.js?bin=' + Date.now());
  const m = await import('../server/higgsfield-mcp.js');
  // claudeRun legge CLAUDE_BIN all'avvio del modulo: provo la funzione direttamente
  await assert.rejects(crit.claudeRun('x'), (e) => /passaggi consentiti/.test(e.message) && /error_max_turns/.test(e.detail) && /turni 7/.test(e.detail) && /0\.08 \$/.test(e.detail) && !/scrivi claude/.test(e.message));
  assert.doesNotMatch(crit.cliError('', '', 1).text, /scrivi claude/);
  // pickRecentJob: solo lo stesso prompt, solo dopo l'avvio
  const hf2 = await import('../server/higgsfield.js');
  const since = Date.parse('2026-11-06T12:00:00Z');
  const list = { jobs: [
    { id: 'old', prompt: 'nebbia di sale', created_at: '2026-11-06T10:00:00Z', result: { url: 'https://x/old.png' } },
    { id: 'other', prompt: 'altro', created_at: '2026-11-06T12:01:00Z', result: { url: 'https://x/other.png' } },
    { id: 'mine', prompt: 'nebbia  di sale', created_at: '2026-11-06T12:00:30Z', result: { url: 'https://x/mine.png' } },
  ] };
  assert.deepEqual(hf2.pickRecentJob(list, 'nebbia di sale', since), { id: 'mine', urls: ['https://x/mine.png'] });
  assert.equal(hf2.pickRecentJob(list, 'mai vista', since), null);
  assert.ok(m.MAX_TURNS >= 10);
});

test('guardia di generate_image: una sola chiamata, una sola immagine, stessi modello e prompt', async () => {
  const os = await import('node:os'), fs = await import('node:fs'), path = await import('node:path'), { spawnSync } = await import('node:child_process');
  const g = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'g-')), 'g.json');
  const guard = new URL('../server/hf-guard.cjs', import.meta.url).pathname;
  const call = (params) => spawnSync(process.execPath, [guard, g], { input: JSON.stringify({ tool_input: { params } }) }).status;
  const fresh = () => fs.writeFileSync(g, JSON.stringify({ model: 'gpt_image_2_6', prompt: 'nebbia di sale', used: false }));
  fresh(); assert.equal(call({ model: 'gpt_image_2_6', prompt: 'nebbia di sale', count: 3 }), 2);
  fresh(); assert.equal(call({ model: 'flux_2', prompt: 'nebbia di sale' }), 2);
  fresh(); assert.equal(call({ model: 'gpt_image_2_6', prompt: 'altro' }), 2);
  fresh(); assert.equal(call({ model: 'gpt_image_2_6', prompt: 'nebbia di sale', count: 1 }), 0);
  assert.equal(call({ model: 'gpt_image_2_6', prompt: 'nebbia di sale', count: 1 }), 2);
  const { claudeArgs } = await import('../server/critic.js');
  const a = claudeArgs('x', { settings: { hooks: {} } });
  assert.equal(a[a.indexOf('--settings') + 1], '{"hooks":{}}');
});
