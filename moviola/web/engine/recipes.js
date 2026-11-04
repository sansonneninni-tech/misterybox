// Partenze: catene già pensate, da cui cominciare quando non c'è niente.
// Non sono stili da applicare: sono ipotesi di lavoro da smontare.

import { defaultParams } from './processes.js';

let n = 0;
const pass = (proc, params = {}, extra = {}) => ({ id: 'p' + (++n).toString(36) + Math.random().toString(36).slice(2, 5), proc, on: true, mix: 1, blend: 'normale', ...extra, params: { ...defaultParams(proc), ...params } });

export const RECIPES = [
  {
    id: 'emulsione', name: 'Emulsione', needs: 'niente',
    line: 'Fumo lento dentro la grana. Quasi niente succede, e succede piano.',
    make: () => ({
      motion: { mode: 'contemplativo', amount: 0.55, bpm: 60, division: 1, speed: 0.6 },
      chain: [
        pass('campo', { scala: 0.9, torsione: 2.2, velocita: 0.06, contrasto: 1.1, cromia: 0.06, tinta: 0.05, ottave: 4 }),
        pass('tono', { contrasto: 1.35, luminosita: -0.12, saturazione: 0.5 }),
        pass('materia', { grana: 0.5, dimensione: 1.8, alone: 0.35, tremolio: 0.3, sfarfallio: 0.25, vignetta: 0.45, polvere: 0.2 }),
      ],
    }),
  },
  {
    id: 'pellicola-dipinta', name: 'Pellicola dipinta', needs: 'niente',
    line: 'Macchie e graffi diversi a ogni fotogramma: l’occhio non riesce a fermarne uno.',
    make: () => ({
      format: { fps: 24 },
      motion: { mode: 'ritmico', amount: 0.5, bpm: 132, division: 1, speed: 1 },
      chain: [
        pass('graffio', { graffi: 0.65, macchie: 0.7, pigmento: 0.75, sfarfallio: 0.55, lampi: 0.18, cadenza: 1, fondo: 1 }),
        pass('materia', { grana: 0.55, dimensione: 2.2, alone: 0.2, tremolio: 0.6, sfarfallio: 0.4, vignetta: 0.3, polvere: 0.6 }),
      ],
    }),
  },
  {
    id: 'interferenza', name: 'Interferenza', needs: 'niente',
    line: 'Due trame quasi identiche: il disegno vero è quello che nessuna delle due contiene.',
    make: () => ({
      motion: { mode: 'contemplativo', amount: 0.6, bpm: 72, division: 1, speed: 0.8 },
      chain: [
        pass('moire', { frequenza: 46, scarto: 0.022, rotazione: 0.35, anelli: 0.55, spessore: 0.42, deriva: 0.45, velocita: 0.06 }),
        pass('rifrazione', { forza: 0.015, scala: 1.4, velocita: 0.07, aberrazione: 0 }),
        pass('materia', { grana: 0.25, alone: 0.15, tremolio: 0.1, sfarfallio: 0.08, vignetta: 0.25, polvere: 0 }),
      ],
    }),
  },
  {
    id: 'campo-di-dati', name: 'Campo di dati', needs: 'niente',
    line: 'Bianco e nero puri, a tempo. Il ritmo è il soggetto.',
    make: () => ({
      format: { fps: 30 },
      motion: { mode: 'ritmico', amount: 0.75, bpm: 120, division: 2, speed: 1 },
      chain: [
        pass('dati', { righe: 64, densita: 0.42, velocita: 2.2, strobo: 0.12, griglia: 0.25 }),
        pass('glitch', { strappo: 0.25, canali: 0, quantizza: 0, colatura: 0, frequenza: 0.2, blocchi: 0.15 }),
      ],
    }),
  },
  {
    id: 'tempo-fessurato', name: 'Tempo fessurato', needs: 'video',
    line: 'Ogni riga arriva da un istante diverso: il movimento si piega in forma.',
    make: () => ({
      motion: { mode: 'contemplativo', amount: 0.35, bpm: 60, division: 1, speed: 0.5 },
      chain: [
        pass('fessura', { profondita: 28, direzione: 0, curva: 1.4 }),
        pass('tono', { saturazione: 0.75, contrasto: 1.15 }),
        pass('materia', { grana: 0.3, alone: 0.3, tremolio: 0.15, sfarfallio: 0.1, vignetta: 0.3, polvere: 0.05 }),
      ],
    }),
  },
  {
    id: 'sovrimpressioni', name: 'Sovrimpressioni', needs: 'niente',
    line: 'Luce che passa sopra luce, in ritardo su sé stessa. Un diario più che un’immagine.',
    make: () => ({
      motion: { mode: 'contemplativo', amount: 0.6, bpm: 60, division: 1, speed: 0.7 },
      chain: [
        pass('campo', { scala: 2.4, torsione: 1.8, velocita: 0.22, contrasto: 2.0, cromia: 0.3, tinta: 0.02, soglia: 0.2 }),
        pass('tono', { luminosita: -0.32, contrasto: 1.4, saturazione: 0.8 }),
        pass('luce', { quantita: 4, morbidezza: 0.35, intensita: 0.55, temperatura: 0.7, fuga: 0.45, velocita: 0.1 }, { blend: 'schermo' }),
        pass('sovrimpressione', { strati: 3, ritardo: 5, deriva: 0.035, scala: 1.04, esposizione: 0.62, sfarfallio: 0.45 }),
        pass('materia', { grana: 0.45, alone: 0.45, tremolio: 0.35, sfarfallio: 0.35, vignetta: 0.4, polvere: 0.15 }),
      ],
    }),
  },
  {
    id: 'monitor', name: 'Monitor', needs: 'niente',
    line: 'La telecamera guarda il suo schermo. Le celle cadono dentro un pozzo che si richiude.',
    make: () => ({
      format: { loop: false },
      motion: { mode: 'caotico', amount: 0.25, bpm: 90, division: 1, speed: 0.5 },
      chain: [
        pass('celle', { scala: 5, velocita: 0.2, bordo: 0.85, riempimento: 0.9 }),
        pass('retroazione', { zoom: 0.018, rotazione: 0.011, decadimento: 0.955, deriva: 0.004, tinta: 0.004, ingresso: 0.35, soglia: 0.55 }),
        pass('tono', { saturazione: 0.5, contrasto: 1.3, luminosita: -0.04 }),
        pass('materia', { grana: 0.3, alone: 0.3, tremolio: 0.1, sfarfallio: 0.15, vignetta: 0.35, polvere: 0 }),
      ],
    }),
  },
  {
    id: 'compressione', name: 'Compressione', needs: 'video',
    line: 'Il video perde i fotogrammi chiave: il movimento di adesso trascina la materia di prima.',
    make: () => ({
      format: { loop: false },
      motion: { mode: 'ritmico', amount: 0.4, bpm: 100, division: 0.5, speed: 1 },
      chain: [
        pass('datamosh', { blocco: 16, forza: 12, rinnovo: 0.02, persistenza: 0.985, deriva: 0.04 }),
        pass('glitch', { strappo: 0.15, canali: 0.2, quantizza: 0.15, colatura: 0.25, frequenza: 0.2, blocchi: 0.2 }),
      ],
    }),
  },
  {
    id: 'metamorfosi', name: 'Metamorfosi', needs: 'immagini',
    line: 'Le immagini si sciolgono l’una nell’altra attraverso le proprie luci.',
    make: () => ({
      motion: { mode: 'contemplativo', amount: 0.4, bpm: 60, division: 1, speed: 0.6 },
      chain: [
        pass('metamorfosi', { cicli: 1, deformazione: 0.14, tenuta: 0.3, granulo: 2.5 }),
        pass('rifrazione', { forza: 0.03, scala: 2.2, velocita: 0.12, aberrazione: 0.2 }),
        pass('materia', { grana: 0.35, alone: 0.3, tremolio: 0.2, sfarfallio: 0.15, vignetta: 0.35, polvere: 0.1 }),
      ],
    }),
  },
];

export function makePass(proc, params) { return pass(proc, params); }
