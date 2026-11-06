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
