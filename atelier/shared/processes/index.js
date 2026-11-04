// Registro dei processi algoritmici locali.
// Per aggiungere un processo: crea un oggetto con id, name, category, inputs,
// description, params e run(inputs, params, rng) e aggiungilo a una delle liste.
import composizione from './composizione.js';
import materia from './materia.js';
import combinazione from './combinazione.js';
import genesi from './genesi.js';
import { makeRng } from '../image.js';

export const CATEGORIES = [
  { id: 'composizione', name: 'Composizione', hint: "Dove stanno le cose" },
  { id: 'materia', name: 'Materia', hint: 'Di cosa è fatta la superficie' },
  { id: 'combinazione', name: 'Combinazione', hint: 'Due o più immagini in relazione' },
  { id: 'genesi', name: 'Genesi', hint: 'Partire da zero' },
];

export const PROCESSES = [...composizione, ...materia, ...combinazione, ...genesi];

export function getProcess(id) {
  return PROCESSES.find((p) => p.id === id);
}

// Descrizione serializzabile (senza funzioni) per l'interfaccia.
export function describeProcesses() {
  return PROCESSES.map(({ run, ...rest }) => rest);
}

export function normalizeParams(proc, params = {}) {
  const out = {};
  for (const d of proc.params) {
    let v = params[d.key] ?? d.default;
    if (d.type === 'range') { v = Number(v); if (!Number.isFinite(v)) v = d.default; v = Math.min(d.max, Math.max(d.min, v)); }
    else if (d.type === 'bool') v = v === true || v === 'true' || v === 1;
    else if (d.type === 'select') { if (!d.options.some(([k]) => k === v)) v = d.default; }
    out[d.key] = v;
  }
  return out;
}

export function randomParams(proc, rng) {
  const out = {};
  for (const d of proc.params) {
    if (d.key === 'size' || d.key === 'format') { out[d.key] = d.default; continue; }
    if (d.type === 'range') {
      const v = d.min + rng() * (d.max - d.min);
      out[d.key] = Math.round(v / d.step) * d.step;
      if (d.step < 1) out[d.key] = Number(out[d.key].toFixed(3));
    } else if (d.type === 'bool') out[d.key] = rng() < 0.5;
    else out[d.key] = rng.pick(d.options)[0];
  }
  return out;
}

export function runProcess(id, inputs, params, seed) {
  const proc = getProcess(id);
  if (!proc) throw new Error(`Processo sconosciuto: ${id}`);
  const n = inputs.length;
  if (n < proc.inputs.min || n > proc.inputs.max) {
    const want = proc.inputs.min === proc.inputs.max ? proc.inputs.min : `da ${proc.inputs.min} a ${proc.inputs.max}`;
    throw new Error(`«${proc.name}» richiede ${want} immagini (ne hai scelte ${n}).`);
  }
  const p = normalizeParams(proc, params);
  return { image: proc.run(inputs, p, makeRng(seed)), params: p };
}
