/** Mosse: dati e effetti secondari. */

import type { ElemType } from './types';

export type MoveCategory = 'fisico' | 'speciale' | 'stato';
export type StatName = 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type StatusName = 'avvelenato' | 'paralizzato' | 'scottato' | 'addormentato' | 'congelato';

export interface MoveEffect {
  /** Probabilita' 0..1 di applicare l'effetto secondario. */
  chance?: number;
  status?: StatusName;
  /** Modifiche alle statistiche: positivo = a se stesso, negativo = al bersaglio. */
  statSelf?: Partial<Record<StatName, number>>;
  statFoe?: Partial<Record<StatName, number>>;
  /** Cura una frazione dei PS massimi. */
  heal?: number;
  /** Recupero proporzionale al danno inflitto. */
  drain?: number;
  /** Contraccolpo proporzionale al danno inflitto. */
  recoil?: number;
  /** Colpisce due volte. */
  multiHit?: [number, number];
  /** Aumento della probabilita' di brutto colpo. */
  highCrit?: boolean;
  /** Fa fuggire dalla battaglia (solo selvatici). */
  flee?: boolean;
}

export interface Move {
  id: string;
  name: string;
  type: ElemType;
  category: MoveCategory;
  power: number;
  accuracy: number;
  pp: number;
  priority?: number;
  effect?: MoveEffect;
  desc: string;
}

export const MOVES: Record<string, Move> = {
  colpo: {
    id: 'colpo', name: 'Colpo', type: 'normale', category: 'fisico',
    power: 40, accuracy: 100, pp: 35, desc: 'Un attacco diretto senza fronzoli.',
  },
  graffio: {
    id: 'graffio', name: 'Graffio', type: 'normale', category: 'fisico',
    power: 40, accuracy: 100, pp: 35, desc: 'Graffia il bersaglio con gli artigli.',
  },
  zannata: {
    id: 'zannata', name: 'Zannata', type: 'normale', category: 'fisico',
    power: 65, accuracy: 95, pp: 20, effect: { chance: 0.2, statFoe: { def: -1 } },
    desc: 'Un morso deciso che puo' + ' ridurre la Difesa.',
  },
  carica: {
    id: 'carica', name: 'Carica', type: 'normale', category: 'fisico',
    power: 80, accuracy: 90, pp: 15, effect: { recoil: 0.25 },
    desc: 'Una carica potente che causa contraccolpo.',
  },
  turbine: {
    id: 'turbine', name: 'Turbine', type: 'vento', category: 'speciale',
    power: 55, accuracy: 100, pp: 25, desc: 'Un vortice d’aria tagliente.',
  },
  raffica: {
    id: 'raffica', name: 'Raffica', type: 'vento', category: 'speciale',
    power: 80, accuracy: 95, pp: 15, effect: { chance: 0.2, statFoe: { spe: -1 } },
    desc: 'Vento impetuoso che puo’ rallentare.',
  },
  fiammata: {
    id: 'fiammata', name: 'Fiammata', type: 'fuoco', category: 'speciale',
    power: 60, accuracy: 100, pp: 20, effect: { chance: 0.15, status: 'scottato' },
    desc: 'Sputa una vampata che puo’ scottare.',
  },
  vampata: {
    id: 'vampata', name: 'Vampata', type: 'fuoco', category: 'speciale',
    power: 95, accuracy: 90, pp: 10, effect: { chance: 0.2, status: 'scottato' },
    desc: 'Un’esplosione di calore devastante.',
  },
  brace: {
    id: 'brace', name: 'Brace', type: 'fuoco', category: 'fisico',
    power: 45, accuracy: 100, pp: 25, desc: 'Colpisce con le zampe incandescenti.',
  },
  bolla: {
    id: 'bolla', name: 'Bolla', type: 'acqua', category: 'speciale',
    power: 45, accuracy: 100, pp: 30, effect: { chance: 0.15, statFoe: { spe: -1 } },
    desc: 'Lancia bolle che possono rallentare.',
  },
  idrogetto: {
    id: 'idrogetto', name: 'Idrogetto', type: 'acqua', category: 'speciale',
    power: 70, accuracy: 100, pp: 20, desc: 'Un getto d’acqua ad alta pressione.',
  },
  maremoto: {
    id: 'maremoto', name: 'Maremoto', type: 'acqua', category: 'speciale',
    power: 100, accuracy: 85, pp: 8, desc: 'Un’onda enorme travolge il bersaglio.',
  },
  foglialama: {
    id: 'foglialama', name: 'Foglialama', type: 'erba', category: 'fisico',
    power: 55, accuracy: 95, pp: 25, effect: { highCrit: true },
    desc: 'Foglie affilate con alta probabilità di brutto colpo.',
  },
  radicivore: {
    id: 'radicivore', name: 'Radicivore', type: 'erba', category: 'speciale',
    power: 60, accuracy: 100, pp: 15, effect: { drain: 0.5 },
    desc: 'Assorbe energia e recupera PS.',
  },
  frustaverde: {
    id: 'frustaverde', name: 'Frustaverde', type: 'erba', category: 'fisico',
    power: 90, accuracy: 90, pp: 10, desc: 'Una liana colpisce con forza.',
  },
  scintilla: {
    id: 'scintilla', name: 'Scintilla', type: 'elettro', category: 'speciale',
    power: 45, accuracy: 100, pp: 30, effect: { chance: 0.2, status: 'paralizzato' },
    desc: 'Una scarica che può paralizzare.',
  },
  fulmine: {
    id: 'fulmine', name: 'Fulmine', type: 'elettro', category: 'speciale',
    power: 90, accuracy: 90, pp: 10, effect: { chance: 0.25, status: 'paralizzato' },
    desc: 'Una potente saetta.',
  },
  gelosoffio: {
    id: 'gelosoffio', name: 'Gelosoffio', type: 'ghiaccio', category: 'speciale',
    power: 55, accuracy: 100, pp: 20, effect: { chance: 0.15, status: 'congelato' },
    desc: 'Un soffio gelido che può congelare.',
  },
  bufera: {
    id: 'bufera', name: 'Bufera', type: 'ghiaccio', category: 'speciale',
    power: 95, accuracy: 80, pp: 8, effect: { chance: 0.2, status: 'congelato' },
    desc: 'Una tempesta di ghiaccio.',
  },
  sassata: {
    id: 'sassata', name: 'Sassata', type: 'roccia', category: 'fisico',
    power: 55, accuracy: 95, pp: 25, desc: 'Scaglia pietre affilate.',
  },
  frana: {
    id: 'frana', name: 'Frana', type: 'roccia', category: 'fisico',
    power: 85, accuracy: 85, pp: 10, desc: 'Massi enormi si abbattono sul nemico.',
  },
  ombracolpo: {
    id: 'ombracolpo', name: 'Ombracolpo', type: 'spettro', category: 'speciale',
    power: 60, accuracy: 100, pp: 20, effect: { chance: 0.2, statFoe: { spd: -1 } },
    desc: 'Un artiglio d’ombra attraversa le difese.',
  },
  spettrofiamma: {
    id: 'spettrofiamma', name: 'Spettrofiamma', type: 'spettro', category: 'speciale',
    power: 90, accuracy: 90, pp: 8, desc: 'Fuochi fatui avvolgono il bersaglio.',
  },
  acidospruzzo: {
    id: 'acidospruzzo', name: 'Acidospruzzo', type: 'veleno', category: 'speciale',
    power: 50, accuracy: 100, pp: 25, effect: { chance: 0.3, status: 'avvelenato' },
    desc: 'Spruzza acido che può avvelenare.',
  },
  pungiglione: {
    id: 'pungiglione', name: 'Pungiglione', type: 'veleno', category: 'fisico',
    power: 65, accuracy: 100, pp: 20, effect: { chance: 0.2, status: 'avvelenato' },
    desc: 'Un colpo di aculeo intinto nel veleno.',
  },
  lamametallo: {
    id: 'lamametallo', name: 'Lamametallo', type: 'metallo', category: 'fisico',
    power: 70, accuracy: 95, pp: 20, effect: { highCrit: true },
    desc: 'Una lama d’acciaio affilatissima.',
  },
  corazza: {
    id: 'corazza', name: 'Corazza', type: 'metallo', category: 'stato',
    power: 0, accuracy: 100, pp: 20, effect: { statSelf: { def: 2 } },
    desc: 'Irrigidisce il corpo e aumenta molto la Difesa.',
  },
  bagliore: {
    id: 'bagliore', name: 'Bagliore', type: 'luce', category: 'speciale',
    power: 65, accuracy: 100, pp: 20, effect: { chance: 0.2, statFoe: { spa: -1 } },
    desc: 'Un lampo accecante.',
  },
  aurora: {
    id: 'aurora', name: 'Aurora', type: 'luce', category: 'speciale',
    power: 100, accuracy: 90, pp: 6, desc: 'Un’esplosione di luce pura.',
  },

  // --- mosse di stato ---
  ringhio: {
    id: 'ringhio', name: 'Ringhio', type: 'normale', category: 'stato',
    power: 0, accuracy: 100, pp: 30, effect: { statFoe: { atk: -1 } },
    desc: 'Un verso minaccioso che riduce l’Attacco.',
  },
  sguardo: {
    id: 'sguardo', name: 'Sguardofermo', type: 'normale', category: 'stato',
    power: 0, accuracy: 100, pp: 30, effect: { statFoe: { def: -1 } },
    desc: 'Uno sguardo che intimidisce e abbassa la Difesa.',
  },
  agilita: {
    id: 'agilita', name: 'Agilità', type: 'vento', category: 'stato',
    power: 0, accuracy: 100, pp: 25, effect: { statSelf: { spe: 2 } },
    desc: 'Alleggerisce il corpo: Velocità molto aumentata.',
  },
  concentrazione: {
    id: 'concentrazione', name: 'Concentrazione', type: 'normale', category: 'stato',
    power: 0, accuracy: 100, pp: 20, effect: { statSelf: { atk: 1, spa: 1 } },
    desc: 'Aumenta Attacco e Attacco Speciale.',
  },
  riposino: {
    id: 'riposino', name: 'Riposino', type: 'normale', category: 'stato',
    power: 0, accuracy: 100, pp: 10, effect: { heal: 0.5 },
    desc: 'Recupera metà dei PS massimi.',
  },
  spore: {
    id: 'spore', name: 'Sporesonno', type: 'erba', category: 'stato',
    power: 0, accuracy: 75, pp: 10, effect: { status: 'addormentato', chance: 1 },
    desc: 'Spore che fanno addormentare.',
  },
  paralisi: {
    id: 'paralisi', name: 'Ondaparalisi', type: 'elettro', category: 'stato',
    power: 0, accuracy: 90, pp: 20, effect: { status: 'paralizzato', chance: 1 },
    desc: 'Una scarica debole che paralizza.',
  },
  velenopolvere: {
    id: 'velenopolvere', name: 'Velenpolvere', type: 'veleno', category: 'stato',
    power: 0, accuracy: 85, pp: 20, effect: { status: 'avvelenato', chance: 1 },
    desc: 'Una polvere tossica che avvelena.',
  },
  fischio: {
    id: 'fischio', name: 'Fischio', type: 'normale', category: 'stato',
    power: 0, accuracy: 100, pp: 20, effect: { flee: true },
    desc: 'Un fischio acuto: i selvatici scappano.',
  },
  doppiozampa: {
    id: 'doppiozampa', name: 'Doppiozampa', type: 'normale', category: 'fisico',
    power: 30, accuracy: 100, pp: 20, effect: { multiHit: [2, 2] },
    desc: 'Colpisce due volte di seguito.',
  },
  attaccorapido: {
    id: 'attaccorapido', name: 'Attaccorapido', type: 'normale', category: 'fisico',
    power: 40, accuracy: 100, pp: 30, priority: 1,
    desc: 'Colpisce sempre per primo.',
  },
};

export function getMove(id: string): Move {
  const m = MOVES[id];
  if (!m) throw new Error(`Mossa sconosciuta: ${id}`);
  return m;
}
