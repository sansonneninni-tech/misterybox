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

// Disporre: ribalta, ruota, sposta, scala. Griglia 3×2 con valori 0..5 nel rosso.
import { applyLayout, cleanLayout } from '../shared/disponi.js';
const grid = () => { const d = new Uint8ClampedArray(6 * 4); for (let i = 0; i < 6; i++) { d[i * 4] = i; d[i * 4 + 3] = 255; } return { width: 3, height: 2, data: d }; };
const reds = (im) => Array.from({ length: im.width * im.height }, (_, i) => im.data[i * 4]);

test('disponi: ribalta e ruota senza perdita', () => {
  // 0 1 2 / 3 4 5
  assert.deepEqual(reds(applyLayout(grid(), { fh: true })), [2, 1, 0, 5, 4, 3]);
  assert.deepEqual(reds(applyLayout(grid(), { fv: true })), [3, 4, 5, 0, 1, 2]);
  const r90 = applyLayout(grid(), { r: 90 });
  assert.equal(r90.width, 2); assert.equal(r90.height, 3);
  assert.deepEqual(reds(r90), [3, 0, 4, 1, 5, 2]);
  assert.deepEqual(reds(applyLayout(grid(), { r: 180 })), [5, 4, 3, 2, 1, 0]);
  assert.deepEqual(reds(applyLayout(grid(), { r: 270 })), [2, 5, 1, 4, 0, 3]);
  assert.deepEqual(reds(applyLayout(grid(), { r: 90, fh: true })), [0, 3, 1, 4, 2, 5]);
  assert.equal(applyLayout(grid(), { fh: false, fv: false, r: 0, x: 0, y: 0, s: 1 }).data.length, 24);
});

test('disponi: pulizia dei valori', () => {
  assert.equal(cleanLayout([{}, { s: 1 }]), null);
  assert.equal(cleanLayout('x'), null);
  const c = cleanLayout([{ r: 450, x: 9, s: 99, fh: 1 }]);
  assert.deepEqual(c, [{ fh: true, fv: false, r: 90, x: 1, y: 0, s: 4 }]);
});

test('disponi: entra nei parametri e cambia il risultato', () => {
  const a = img(96, 64, 0), b = img(96, 64, 200);
  const base = runProcess('cadavere', [a, b], {}, 7);
  const d = [{ fh: true }, { r: 90, x: 0.2, s: 1.5 }];
  const r = runProcess('cadavere', [a, b], { disponi: d }, 7);
  assert.ok(Array.isArray(r.params.disponi), 'la disposizione resta tra i parametri della versione');
  assert.equal(r.params.disponi[1].r, 90);
  assert.notDeepEqual(r.image.data, base.image.data);
  assert.deepEqual(runProcess('cadavere', [a, b], { disponi: d }, 7).image.data, r.image.data);
  assert.equal(runProcess('cadavere', [a, b], { disponi: [{}, {}] }, 7).params.disponi, undefined);
  // Gli input originali non vengono toccati.
  assert.equal(a.data[2], 0);
});
