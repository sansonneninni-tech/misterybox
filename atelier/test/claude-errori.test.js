import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cliError } from '../server/critic.js';

test('errori di Claude: solo l\'accesso vero diventa «non collegato»', () => {
  const t = (m, s = '', via) => cliError(m, s, 1, via);
  assert.match(t('Not logged in · Please run /login').text, /non è collegato/);
  assert.match(t('Credit balance is too low').text, /credito API/);
  const exp = t('Failed to authenticate: OAuth session expired and could not be refreshed');
  assert.match(exp.text, /è scaduto.*\/login/);
  assert.equal(exp.detail, 'Failed to authenticate: OAuth session expired and could not be refreshed');
  assert.match(t('Failed to authenticate').text, /non è collegato/);
  assert.match(t('Invalid API key · Please run /login').text, /non accetta l'accesso/);
  assert.match(t('invalid x-api-key (401 authentication_error)', '', 'api').text, /ANTHROPIC_API_KEY/);
  assert.match(t('API Error: 529 Overloaded').text, /occupato/);
  // Parole che prima facevano scattare «non collegato» per sbaglio.
  for (const m of ['Your subscription does not include this feature', 'Author field missing', 'Credential helper took too long', 'Error: tool Read requires login-free mode']) {
    const r = t(m);
    assert.doesNotMatch(r.text, /non è collegato/, m);
    assert.equal(r.detail, m, 'la riga originale resta visibile');
  }
  // Gli avvisi non sono l'errore.
  assert.equal(t('', 'Warning: no stdin data received in 3s\nError: boom').detail, 'Error: boom');
  assert.match(cliError('', '', 2).text, /codice 2/);
});

test('ogni claude -p: permessi di base e strumenti vietati', async () => {
  const { claudeArgs } = await import('../server/critic.js');
  const { TOOLS } = await import('../server/higgsfield-mcp.js');
  for (const allowedTools of [['Read'], TOOLS.generate]) {
    const a = claudeArgs('x', { allowedTools, maxTurns: 6 });
    const val = (f) => a[a.indexOf(f) + 1];
    assert.equal(val('--permission-mode'), 'default', 'mai la modalità automatica');
    const denied = val('--disallowedTools').split(',');
    for (const t of ['Bash', 'Write', 'Edit', 'mcp__higgsfield__cancel_trial_auto_renewal', 'mcp__higgsfield__sandbox_exec']) assert.ok(denied.includes(t), t);
    assert.ok(!val('--allowedTools').split(',').some((t) => denied.includes(t)), 'niente in entrambe le liste');
  }
});
