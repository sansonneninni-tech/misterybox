import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROCESSES, runProcess } from '../shared/processes/index.js';
import { analyze } from '../shared/analysis.js';
import { critique } from '../shared/provocations.js';

const img = (w, h, f) => { const d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) { d[i * 4] = (i * 7) % 255; d[i * 4 + 1] = (i * 13) % 255; d[i * 4 + 2] = f; d[i * 4 + 3] = 255; } return { width: w, height: h, data: d }; };

for (const p of PROCESSES) {
  test(`processo ${p.id}`, () => {
    const inputs = Array.from({ length: p.inputs.min }, (_, i) => img(96, 64, i * 80));
    const params = p.params.some((d) => d.key === 'size') ? { size: 600 } : {};
    const a = runProcess(p.id, inputs, params, 42).image;
    const b = runProcess(p.id, inputs, params, 42).image;
    assert.ok(a.width > 0 && a.height > 0);
    assert.deepEqual(a.data, b.data, 'stesso seme, stesso risultato');
  });
}

test('analisi e interlocutore locale', () => {
  const r = critique(analyze(img(120, 80, 30)), { seed: 1 });
  assert.equal(r.fonte, 'locale');
  assert.ok(r.ipotesi.length > 0 && r.domanda);
});
