/** Tipi elementali e tabella delle affinita'. */

export const TYPES = [
  'normale',
  'fuoco',
  'acqua',
  'erba',
  'elettro',
  'ghiaccio',
  'roccia',
  'vento',
  'spettro',
  'metallo',
  'veleno',
  'luce',
] as const;

export type ElemType = (typeof TYPES)[number];

/** Moltiplicatori diversi da 1: EFFECT[attaccante][difensore]. */
const EFFECT: Partial<Record<ElemType, Partial<Record<ElemType, number>>>> = {
  normale: { roccia: 0.5, metallo: 0.5, spettro: 0 },
  fuoco: { erba: 2, ghiaccio: 2, metallo: 2, acqua: 0.5, roccia: 0.5, fuoco: 0.5 },
  acqua: { fuoco: 2, roccia: 2, erba: 0.5, acqua: 0.5, elettro: 0.5 },
  erba: { acqua: 2, roccia: 2, fuoco: 0.5, erba: 0.5, veleno: 0.5, vento: 0.5, ghiaccio: 0.5, metallo: 0.5 },
  elettro: { acqua: 2, vento: 2, erba: 0.5, elettro: 0.5, roccia: 0.5 },
  ghiaccio: { erba: 2, vento: 2, roccia: 2, fuoco: 0.5, acqua: 0.5, ghiaccio: 0.5, metallo: 0.5 },
  roccia: { fuoco: 2, vento: 2, ghiaccio: 2, erba: 0.5, acqua: 0.5, metallo: 0.5 },
  vento: { erba: 2, veleno: 2, elettro: 0.5, roccia: 0.5, metallo: 0.5 },
  spettro: { spettro: 2, luce: 2, normale: 0, metallo: 0.5 },
  metallo: { roccia: 2, ghiaccio: 2, luce: 2, fuoco: 0.5, acqua: 0.5, elettro: 0.5, metallo: 0.5 },
  veleno: { erba: 2, luce: 2, roccia: 0.5, metallo: 0.5, veleno: 0.5, spettro: 0.5 },
  luce: { spettro: 2, veleno: 2, metallo: 0.5, luce: 0.5 },
};

/** Moltiplicatore di efficacia di un tipo contro uno o due tipi difensivi. */
export function effectiveness(attack: ElemType, defenders: ElemType[]): number {
  let mult = 1;
  for (const d of defenders) {
    mult *= EFFECT[attack]?.[d] ?? 1;
  }
  return mult;
}

export function effectivenessText(mult: number): string | null {
  if (mult === 0) return 'Non ha alcun effetto…';
  if (mult >= 2) return 'È superefficace!';
  if (mult > 0 && mult < 1) return 'Non è molto efficace…';
  return null;
}

/** Abbreviazione a 3 lettere per le interfacce strette. */
export function typeShort(t: ElemType): string {
  return t.slice(0, 3).toUpperCase();
}
