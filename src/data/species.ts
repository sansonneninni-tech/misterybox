/** Creature originali di Verdania: aspetto, statistiche base, evoluzioni. */

import type { CreatureLook } from '../gfx/creatures';
import type { ElemType } from './types';

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface LearnEntry {
  level: number;
  move: string;
}

export interface Species {
  id: string;
  name: string;
  types: ElemType[];
  base: Stats;
  /** Difficolta' di cattura: piu' alto = piu' facile (3..255). */
  catchRate: number;
  baseExp: number;
  /** Altezza in metri e peso in kg, solo per il Verdex. */
  height: number;
  weight: number;
  category: string;
  dex: string;
  learnset: LearnEntry[];
  evolvesTo?: { id: string; level: number };
  look: CreatureLook;
}

const S = (hp: number, atk: number, def: number, spa: number, spd: number, spe: number): Stats =>
  ({ hp, atk, def, spa, spd, spe });

export const SPECIES: Record<string, Species> = {
  // --- Linea Erba ---------------------------------------------------------
  foglietta: {
    id: 'foglietta', name: 'Foglietta', types: ['erba'],
    base: S(45, 49, 49, 65, 65, 45), catchRate: 45, baseExp: 64,
    height: 0.4, weight: 6.2, category: 'Seme',
    dex: 'Tiene sempre una foglia sul capo: la usa per captare la direzione del vento e trovare il sole.',
    learnset: [
      { level: 1, move: 'colpo' }, { level: 1, move: 'ringhio' },
      { level: 6, move: 'foglialama' }, { level: 11, move: 'spore' },
      { level: 16, move: 'radicivore' }, { level: 22, move: 'concentrazione' },
      { level: 28, move: 'frustaverde' }, { level: 34, move: 'riposino' },
    ],
    evolvesTo: { id: 'fronzaro', level: 16 },
    look: {
      shape: 'round', main: '#5fae42', dark: '#37702c', light: '#8ed35f',
      accent: '#e8d060', belly: '#cfe89a', ears: 'none', tail: 'leaf', back: 'leaf',
      legs: 'stubby', spots: false,
    },
  },
  fronzaro: {
    id: 'fronzaro', name: 'Fronzaro', types: ['erba'],
    base: S(60, 62, 63, 80, 80, 60), catchRate: 45, baseExp: 141,
    height: 0.9, weight: 22.5, category: 'Fronda',
    dex: 'Le fronde sulla schiena si aprono quando è sereno e si chiudono prima di un temporale.',
    learnset: [
      { level: 1, move: 'colpo' }, { level: 1, move: 'foglialama' },
      { level: 18, move: 'radicivore' }, { level: 24, move: 'concentrazione' },
      { level: 30, move: 'frustaverde' }, { level: 38, move: 'riposino' },
    ],
    evolvesTo: { id: 'silvarco', level: 32 },
    look: {
      shape: 'quad', main: '#4f9c3a', dark: '#2c5f24', light: '#7fc855',
      accent: '#e0c84a', belly: '#c8e08a', ears: 'pointy', tail: 'leaf', back: 'leaf',
      legs: 'quad',
    },
  },
  silvarco: {
    id: 'silvarco', name: 'Silvarco', types: ['erba', 'roccia'],
    base: S(80, 82, 93, 100, 100, 80), catchRate: 45, baseExp: 236,
    height: 1.7, weight: 88.0, category: 'Bosco',
    dex: 'Sulla groppa cresce un piccolo bosco. Si dice che gli alberi che ospita non muoiano mai.',
    learnset: [
      { level: 1, move: 'frustaverde' }, { level: 1, move: 'foglialama' },
      { level: 34, move: 'sassata' }, { level: 40, move: 'frana' },
      { level: 46, move: 'riposino' },
    ],
    look: {
      shape: 'quad', main: '#3f8a34', dark: '#22521c', light: '#6cb84a',
      accent: '#8a6236', belly: '#b8d878', ears: 'horn', tail: 'leaf', back: 'leaf',
      legs: 'quad', fierce: true,
    },
  },

  // --- Linea Fuoco --------------------------------------------------------
  braciolo: {
    id: 'braciolo', name: 'Braciolo', types: ['fuoco'],
    base: S(39, 52, 43, 60, 50, 65), catchRate: 45, baseExp: 62,
    height: 0.5, weight: 8.1, category: 'Tizzone',
    dex: 'La fiamma sulla coda si affievolisce quando è triste e divampa quando è entusiasta.',
    learnset: [
      { level: 1, move: 'graffio' }, { level: 1, move: 'ringhio' },
      { level: 7, move: 'brace' }, { level: 12, move: 'fiammata' },
      { level: 18, move: 'attaccorapido' }, { level: 24, move: 'concentrazione' },
      { level: 30, move: 'vampata' }, { level: 36, move: 'carica' },
    ],
    evolvesTo: { id: 'fiammuro', level: 16 },
    look: {
      shape: 'tall', main: '#e06a30', dark: '#a03c15', light: '#f8a054',
      accent: '#ffcf4a', belly: '#f8d89a', ears: 'pointy', tail: 'flame', back: 'none',
      legs: 'stubby',
    },
  },
  fiammuro: {
    id: 'fiammuro', name: 'Fiammuro', types: ['fuoco'],
    base: S(58, 64, 58, 80, 65, 80), catchRate: 45, baseExp: 142,
    height: 1.1, weight: 19.0, category: 'Tizzone',
    dex: 'Il collare di fiamme si allarga quando affronta un avversario più grande di lui.',
    learnset: [
      { level: 1, move: 'graffio' }, { level: 1, move: 'fiammata' },
      { level: 20, move: 'attaccorapido' }, { level: 26, move: 'concentrazione' },
      { level: 32, move: 'vampata' }, { level: 40, move: 'carica' },
    ],
    evolvesTo: { id: 'pirodonte', level: 34 },
    look: {
      shape: 'tall', main: '#d8541f', dark: '#8f2c0c', light: '#f88a3a',
      accent: '#ffb832', belly: '#f8cf80', ears: 'horn', tail: 'flame', back: 'spikes',
      legs: 'claw',
    },
  },
  pirodonte: {
    id: 'pirodonte', name: 'Pirodonte', types: ['fuoco', 'roccia'],
    base: S(78, 94, 76, 105, 82, 96), catchRate: 45, baseExp: 240,
    height: 1.8, weight: 92.5, category: 'Vulcano',
    dex: 'Le placche sulla schiena si arroventano fino a diventare bianche. Vive nei crateri spenti.',
    learnset: [
      { level: 1, move: 'vampata' }, { level: 1, move: 'brace' },
      { level: 36, move: 'frana' }, { level: 44, move: 'carica' },
      { level: 50, move: 'concentrazione' },
    ],
    look: {
      shape: 'quad', main: '#c0431a', dark: '#7a1f06', light: '#f07038',
      accent: '#ffa020', belly: '#e8b070', ears: 'horn', tail: 'flame', back: 'spikes',
      legs: 'claw', fierce: true,
    },
  },

  // --- Linea Acqua --------------------------------------------------------
  gocciolo: {
    id: 'gocciolo', name: 'Gocciolo', types: ['acqua'],
    base: S(44, 48, 65, 50, 64, 43), catchRate: 45, baseExp: 63,
    height: 0.5, weight: 9.0, category: 'Rugiada',
    dex: 'Il guscio umido è sempre coperto di rugiada. Ne beve un sorso quando ha sete.',
    learnset: [
      { level: 1, move: 'colpo' }, { level: 1, move: 'sguardo' },
      { level: 7, move: 'bolla' }, { level: 13, move: 'corazza' },
      { level: 19, move: 'idrogetto' }, { level: 25, move: 'gelosoffio' },
      { level: 31, move: 'riposino' }, { level: 37, move: 'maremoto' },
    ],
    evolvesTo: { id: 'ondino', level: 16 },
    look: {
      shape: 'round', main: '#4a9ad8', dark: '#215f9c', light: '#7fc8f0',
      accent: '#c8ecff', belly: '#e0f4ff', ears: 'none', tail: 'fin', back: 'shell',
      legs: 'stubby',
    },
  },
  ondino: {
    id: 'ondino', name: 'Ondino', types: ['acqua'],
    base: S(59, 63, 80, 65, 80, 58), catchRate: 45, baseExp: 142,
    height: 1.0, weight: 22.5, category: 'Onda',
    dex: 'Sfrutta le correnti per spostarsi senza fatica. Le pinne fungono da timone.',
    learnset: [
      { level: 1, move: 'bolla' }, { level: 1, move: 'corazza' },
      { level: 21, move: 'idrogetto' }, { level: 27, move: 'gelosoffio' },
      { level: 33, move: 'riposino' }, { level: 39, move: 'maremoto' },
    ],
    evolvesTo: { id: 'marendra', level: 34 },
    look: {
      shape: 'wide', main: '#3a86c8', dark: '#164a86', light: '#6fbcf0',
      accent: '#a8e8ff', belly: '#d8f0ff', ears: 'fin', tail: 'fin', back: 'shell',
      legs: 'stubby',
    },
  },
  marendra: {
    id: 'marendra', name: 'Marendra', types: ['acqua', 'ghiaccio'],
    base: S(79, 83, 100, 85, 105, 78), catchRate: 45, baseExp: 239,
    height: 1.6, weight: 85.5, category: 'Marea',
    dex: 'Il suo respiro gela la superficie del mare. Gli antichi navigatori la ritenevano un buon presagio.',
    learnset: [
      { level: 1, move: 'idrogetto' }, { level: 1, move: 'corazza' },
      { level: 36, move: 'bufera' }, { level: 42, move: 'maremoto' },
      { level: 48, move: 'riposino' },
    ],
    look: {
      shape: 'wide', main: '#2f6fb8', dark: '#0f3a70', light: '#5aa8e8',
      accent: '#c8f0ff', belly: '#e8f8ff', ears: 'fin', tail: 'fin', back: 'shell',
      legs: 'quad', fierce: true,
    },
  },

  // --- Comuni -------------------------------------------------------------
  rodentino: {
    id: 'rodentino', name: 'Rodentino', types: ['normale'],
    base: S(40, 45, 35, 25, 30, 62), catchRate: 200, baseExp: 51,
    height: 0.3, weight: 3.5, category: 'Roditore',
    dex: 'Sgranocchia di tutto per limare gli incisivi, che non smettono mai di crescere.',
    learnset: [
      { level: 1, move: 'colpo' }, { level: 4, move: 'ringhio' },
      { level: 8, move: 'zannata' }, { level: 12, move: 'attaccorapido' },
      { level: 17, move: 'doppiozampa' }, { level: 23, move: 'carica' },
    ],
    evolvesTo: { id: 'rodentone', level: 20 },
    look: {
      shape: 'quad', main: '#b08a58', dark: '#7a5a34', light: '#d8b482',
      accent: '#f0e0c0', belly: '#f0dcb8', ears: 'round', tail: 'curl', back: 'none',
      legs: 'quad',
    },
  },
  rodentone: {
    id: 'rodentone', name: 'Rodentone', types: ['normale'],
    base: S(60, 81, 60, 50, 55, 97), catchRate: 90, baseExp: 145,
    height: 0.8, weight: 24.0, category: 'Roditore',
    dex: 'Corre più veloce di una bicicletta. Difende il territorio con morsi fulminei.',
    learnset: [
      { level: 1, move: 'zannata' }, { level: 1, move: 'attaccorapido' },
      { level: 22, move: 'doppiozampa' }, { level: 28, move: 'carica' },
      { level: 34, move: 'concentrazione' },
    ],
    look: {
      shape: 'quad', main: '#8a6a3a', dark: '#54401f', light: '#bb9a62',
      accent: '#e8d8b0', belly: '#e0cc9a', ears: 'pointy', tail: 'curl', back: 'none',
      legs: 'quad', fierce: true,
    },
  },
  piumetto: {
    id: 'piumetto', name: 'Piumetto', types: ['normale', 'vento'],
    base: S(40, 45, 40, 35, 35, 56), catchRate: 200, baseExp: 50,
    height: 0.3, weight: 1.8, category: 'Passero',
    dex: 'Batte le ali così in fretta da sollevare piccoli mulinelli di polvere.',
    learnset: [
      { level: 1, move: 'colpo' }, { level: 5, move: 'turbine' },
      { level: 9, move: 'ringhio' }, { level: 14, move: 'attaccorapido' },
      { level: 19, move: 'agilita' }, { level: 25, move: 'raffica' },
    ],
    evolvesTo: { id: 'ventalco', level: 18 },
    look: {
      shape: 'bird', main: '#a8b8d0', dark: '#6f7f9c', light: '#d8e4f4',
      accent: '#e8c33f', belly: '#f4f4f8', ears: 'none', tail: 'fin', back: 'wings',
      legs: 'claw',
    },
  },
  ventalco: {
    id: 'ventalco', name: 'Ventalco', types: ['normale', 'vento'],
    base: S(63, 70, 55, 55, 55, 91), catchRate: 90, baseExp: 148,
    height: 1.1, weight: 19.5, category: 'Falco',
    dex: 'Plana per ore sfruttando le correnti calde. La vista gli permette di contare le foglie da lassù.',
    learnset: [
      { level: 1, move: 'turbine' }, { level: 1, move: 'attaccorapido' },
      { level: 22, move: 'agilita' }, { level: 28, move: 'raffica' },
      { level: 36, move: 'carica' },
    ],
    look: {
      shape: 'bird', main: '#7a8aa8', dark: '#465272', light: '#b8c8e0',
      accent: '#e09a2a', belly: '#e8e8f0', ears: 'pointy', tail: 'fin', back: 'wings',
      legs: 'claw', fierce: true,
    },
  },
  vespunto: {
    id: 'vespunto', name: 'Vespunto', types: ['veleno', 'vento'],
    base: S(45, 60, 40, 45, 40, 75), catchRate: 150, baseExp: 72,
    height: 0.4, weight: 3.0, category: 'Aculeo',
    dex: 'Pattuglia i sentieri fioriti. Il pungiglione rilascia una tossina che formicola per ore.',
    learnset: [
      { level: 1, move: 'pungiglione' }, { level: 1, move: 'turbine' },
      { level: 10, move: 'velenopolvere' }, { level: 15, move: 'agilita' },
      { level: 21, move: 'acidospruzzo' }, { level: 27, move: 'raffica' },
    ],
    look: {
      shape: 'bird', main: '#e8c33f', dark: '#a88a18', light: '#f8e07a',
      accent: '#2a2a34', belly: '#f8f0c0', ears: 'antenna', tail: 'spike', back: 'wings',
      legs: 'none',
    },
  },
  sassolino: {
    id: 'sassolino', name: 'Sassolino', types: ['roccia'],
    base: S(50, 70, 90, 25, 35, 25), catchRate: 180, baseExp: 60,
    height: 0.4, weight: 20.0, category: 'Ciottolo',
    dex: 'Dorme sui sentieri di montagna. Chi lo scambia per un sasso riceve una spinta indignata.',
    learnset: [
      { level: 1, move: 'colpo' }, { level: 1, move: 'sguardo' },
      { level: 8, move: 'sassata' }, { level: 14, move: 'corazza' },
      { level: 20, move: 'carica' }, { level: 26, move: 'frana' },
    ],
    evolvesTo: { id: 'rocciante', level: 25 },
    look: {
      shape: 'round', main: '#8a8a9a', dark: '#55555f', light: '#b8b8c8',
      accent: '#6a5a3a', belly: '#a8a8b8', ears: 'none', tail: 'none', back: 'spikes',
      legs: 'stubby', spots: true,
    },
  },
  rocciante: {
    id: 'rocciante', name: 'Rocciante', types: ['roccia', 'metallo'],
    base: S(70, 95, 125, 40, 55, 35), catchRate: 75, baseExp: 152,
    height: 1.2, weight: 105.0, category: 'Macigno',
    dex: 'Il corpo contiene vene di metallo grezzo. Con un pugno apre una crepa nella parete.',
    learnset: [
      { level: 1, move: 'sassata' }, { level: 1, move: 'corazza' },
      { level: 28, move: 'lamametallo' }, { level: 34, move: 'frana' },
      { level: 42, move: 'carica' },
    ],
    look: {
      shape: 'wide', main: '#6f6f80', dark: '#3f3f4c', light: '#a0a0b4',
      accent: '#9aa2b0', belly: '#8a8a9a', ears: 'horn', tail: 'none', back: 'spikes',
      legs: 'quad', fierce: true, spots: true,
    },
  },
  scintillo: {
    id: 'scintillo', name: 'Scintillo', types: ['elettro'],
    base: S(45, 45, 40, 70, 55, 82), catchRate: 150, baseExp: 74,
    height: 0.4, weight: 5.5, category: 'Scintilla',
    dex: 'Accumula elettricità statica correndo nell’erba alta. Toccarlo fa rizzare i capelli.',
    learnset: [
      { level: 1, move: 'scintilla' }, { level: 1, move: 'ringhio' },
      { level: 9, move: 'paralisi' }, { level: 15, move: 'attaccorapido' },
      { level: 21, move: 'agilita' }, { level: 29, move: 'fulmine' },
    ],
    evolvesTo: { id: 'fulmirco', level: 26 },
    look: {
      shape: 'quad', main: '#f0d040', dark: '#b09018', light: '#fff08a',
      accent: '#3a3a4a', belly: '#fff8c8', ears: 'pointy', tail: 'bolt', back: 'none',
      legs: 'quad',
    },
  },
  fulmirco: {
    id: 'fulmirco', name: 'Fulmirco', types: ['elettro', 'luce'],
    base: S(65, 65, 60, 105, 80, 105), catchRate: 60, baseExp: 168,
    height: 1.0, weight: 24.5, category: 'Saetta',
    dex: 'Quando corre lascia una scia luminosa che resta visibile per qualche istante.',
    learnset: [
      { level: 1, move: 'scintilla' }, { level: 1, move: 'agilita' },
      { level: 30, move: 'fulmine' }, { level: 36, move: 'bagliore' },
      { level: 44, move: 'aurora' },
    ],
    look: {
      shape: 'quad', main: '#f8e060', dark: '#c09a10', light: '#fffab0',
      accent: '#f88a2a', belly: '#fff8d8', ears: 'horn', tail: 'bolt', back: 'spikes',
      legs: 'quad', fierce: true,
    },
  },
  ombretta: {
    id: 'ombretta', name: 'Ombretta', types: ['spettro'],
    base: S(45, 35, 30, 85, 70, 80), catchRate: 120, baseExp: 82,
    height: 0.6, weight: 0.4, category: 'Ombra',
    dex: 'Vive negli angoli bui delle case. Non fa dispetti cattivi: le piace solo spostare gli oggetti.',
    learnset: [
      { level: 1, move: 'ombracolpo' }, { level: 1, move: 'sguardo' },
      { level: 12, move: 'spore' }, { level: 18, move: 'agilita' },
      { level: 24, move: 'acidospruzzo' }, { level: 32, move: 'spettrofiamma' },
    ],
    look: {
      shape: 'round', main: '#6a4f9a', dark: '#3a2860', light: '#9a7fd0',
      accent: '#d8c0f8', belly: '#8a6fc0', ears: 'antenna', tail: 'curl', back: 'cloud',
      legs: 'none', eye: '#f8e060',
    },
  },
  gelidino: {
    id: 'gelidino', name: 'Gelidino', types: ['ghiaccio'],
    base: S(50, 50, 60, 75, 70, 55), catchRate: 120, baseExp: 85,
    height: 0.5, weight: 12.0, category: 'Brina',
    dex: 'Soffia brina sui vetri delle finestre per disegnarci sopra forme sempre diverse.',
    learnset: [
      { level: 1, move: 'gelosoffio' }, { level: 1, move: 'sguardo' },
      { level: 13, move: 'corazza' }, { level: 20, move: 'bolla' },
      { level: 27, move: 'riposino' }, { level: 34, move: 'bufera' },
    ],
    look: {
      shape: 'round', main: '#a8dcf0', dark: '#5f9ac0', light: '#e0f8ff',
      accent: '#ffffff', belly: '#e8fbff', ears: 'horn', tail: 'none', back: 'spikes',
      legs: 'stubby',
    },
  },
  squametto: {
    id: 'squametto', name: 'Squametto', types: ['acqua'],
    base: S(40, 55, 45, 40, 40, 70), catchRate: 190, baseExp: 55,
    height: 0.4, weight: 4.5, category: 'Pesciolino',
    dex: 'Risale la corrente saltando fra i sassi. Le squame cambiano colore con la temperatura.',
    learnset: [
      { level: 1, move: 'colpo' }, { level: 6, move: 'bolla' },
      { level: 12, move: 'attaccorapido' }, { level: 18, move: 'idrogetto' },
      { level: 26, move: 'maremoto' },
    ],
    evolvesTo: { id: 'tridentis', level: 24 },
    look: {
      shape: 'serpent', main: '#4ac0c0', dark: '#1f8090', light: '#8ae8e8',
      accent: '#f0a83f', belly: '#d8f8f8', ears: 'fin', tail: 'fin', back: 'none',
      legs: 'none',
    },
  },
  tridentis: {
    id: 'tridentis', name: 'Tridentis', types: ['acqua', 'metallo'],
    base: S(65, 92, 70, 60, 65, 92), catchRate: 70, baseExp: 158,
    height: 1.4, weight: 42.0, category: 'Lancia',
    dex: 'Il rostro d’acciaio perfora le rocce sommerse. Nuota in verticale come una lancia.',
    learnset: [
      { level: 1, move: 'idrogetto' }, { level: 1, move: 'attaccorapido' },
      { level: 28, move: 'lamametallo' }, { level: 34, move: 'maremoto' },
      { level: 40, move: 'corazza' },
    ],
    look: {
      shape: 'serpent', main: '#3a8ab0', dark: '#164f70', light: '#7ac0e0',
      accent: '#c8d0dc', belly: '#c8eaf8', ears: 'horn', tail: 'fin', back: 'spikes',
      legs: 'none', fierce: true,
    },
  },
  ferrolo: {
    id: 'ferrolo', name: 'Ferrolo', types: ['metallo'],
    base: S(55, 70, 100, 45, 60, 40), catchRate: 100, baseExp: 96,
    height: 0.6, weight: 55.0, category: 'Bullone',
    dex: 'Si nutre di minerali. Le officine lo ospitano volentieri: tiene lontana la ruggine.',
    learnset: [
      { level: 1, move: 'colpo' }, { level: 1, move: 'corazza' },
      { level: 14, move: 'lamametallo' }, { level: 20, move: 'sassata' },
      { level: 28, move: 'frana' }, { level: 35, move: 'carica' },
    ],
    look: {
      shape: 'round', main: '#9aa2b0', dark: '#5f6672', light: '#c8d0dc',
      accent: '#e8c33f', belly: '#b0b8c4', ears: 'horn', tail: 'none', back: 'shell',
      legs: 'stubby', spots: true,
    },
  },
  luxaria: {
    id: 'luxaria', name: 'Luxaria', types: ['luce', 'vento'],
    base: S(90, 85, 85, 125, 110, 100), catchRate: 8, baseExp: 290,
    height: 2.1, weight: 48.0, category: 'Aurora',
    dex: 'Compare solo dove la nebbia si dirada all’alba. Chi la incontra, dicono, non la dimentica più.',
    learnset: [
      { level: 1, move: 'bagliore' }, { level: 1, move: 'raffica' },
      { level: 1, move: 'agilita' }, { level: 45, move: 'aurora' },
      { level: 50, move: 'riposino' },
    ],
    look: {
      shape: 'bird', main: '#f4e8b0', dark: '#c0a860', light: '#fffcf0',
      accent: '#8ad8f8', belly: '#ffffff', ears: 'antenna', tail: 'flame', back: 'wings',
      legs: 'claw', fierce: true, eye: '#3a6fc0',
    },
  },
};

export function getSpecies(id: string): Species {
  const s = SPECIES[id];
  if (!s) throw new Error(`Specie sconosciuta: ${id}`);
  return s;
}

export const SPECIES_ORDER = Object.keys(SPECIES);

/** Esperienza totale necessaria per raggiungere un livello (curva media). */
export function expForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor((level * level * level * 4) / 5);
}
