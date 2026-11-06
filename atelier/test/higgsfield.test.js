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
