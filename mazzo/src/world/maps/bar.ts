/**
 * LIVELLO 2 — "Il turno."
 * Tre mansioni, in ordine. Niente menu: si prende una cosa e la si porta dove
 * va. Finito il turno arriva un messaggio e comincia la faccenda della busta.
 */

import { HEAT_VEIL, P } from '../../gfx/palette';
import type { MapDef } from '../map';
import type { Ctx } from '../../systems/state';
import { tasksDone } from '../../systems/state';

const ROWS = [
  '======================',
  '=====F=========SSSS===',
  '=,,,,,,,,,,,,,,,,,,,R=',
  '=XXXXXXX,,,,,,,,,,,,,=',
  '=,,,,,,,,,,,,,,,,,,,,=',
  '=,,c,,,,,,c,,,,,,,,,,=',
  '=,,O,,,,,,O,,,,,,,H,,=',
  '=,,c,,,,,,c,,,,,,,,,,=',
  '=,,,,,,,,,,,,,,,,,,,,=',
  '=,,,,,,,,,,,,,,,,,,,,=',
  '=,,c,,,,,,,,,c,,,,,,,=',
  '=,,O,,,,,,,,,O,,,,,,,=',
  '=,,c,,,,,,,,,c,,,,,,,=',
  '=,,,,,,,,,,,,,,,,,,,,=',
  '=,,,,,,,,,,,,,,,,,,,,=',
  '=====VV====DD====VV===',
];

/** Etichetta dell'oggetto in mano, mostrata nell'interfaccia. */
export const CARRY_LABELS: Record<string, string> = {
  bicchiere: 'BICCHIERE',
  piatti: 'PIATTI',
  ordine: 'ORDINE',
};

function objectiveText(ctx: Ctx): string {
  const s = ctx.state.level2;
  if (s.finished || s.messaged) return 'Recuperare la busta.';
  if (!s.task1) return s.carrying === 'bicchiere' ? 'Portare l\'acqua al tavolo 1.' : 'Prendere un bicchiere al bancone.';
  if (!s.task2) return s.carrying === 'piatti' ? 'Portare i piatti in cucina.' : 'Sparecchiare il tavolo 2.';
  if (!s.task3) return s.carrying === 'ordine' ? 'Servire il tavolo 4.' : 'Ritirare l\'ordine in cucina.';
  return 'Il turno è finito.';
}

/** Fine del turno: il locale si zittisce e arriva il messaggio. */
function endOfShift(ctx: Ctx): void {
  const s = ctx.state.level2;
  if (s.messaged) return;
  s.messaged = true;
  ctx.say([
    { wait: 1.0 },
    { do: (c) => c.audio.phone() },
    { say: 'Ci sei?', who: 'TELEFONO' },
    { wait: 0.8 },
    'Sì.',
    { say: 'Passa.', who: 'TELEFONO' },
    { wait: 0.5 },
    { caption: 'RECUPERA LA BUSTA', hold: 2.2 },
    {
      do: (c) => {
        c.setObjective('Recuperare la busta.');
      },
    },
  ]);
}

export const barMap: MapDef = {
  id: 'bar',
  title: 'IL TURNO',
  rows: ROWS,
  ambience: 'bar',
  veil: HEAT_VEIL,
  spawn: { x: 11, y: 14, dir: 'up' },
  fans: [{ x: 5, y: 1 }],

  objective: objectiveText,

  intro: () => [
    { caption: 'IL TURNO', hold: 2.4 },
    { wait: 0.4 },
    'Il ventilatore è lo stesso di casa.',
    'Solo più grande.',
  ],

  objects: [
    // --- bancone: si prende il bicchiere ---
    {
      id: 'counter',
      x: 3,
      y: 3,
      script: (ctx) => {
        const s = ctx.state.level2;
        if (!s.task1 && s.carrying === null) {
          return [
            {
              do: (c) => {
                c.state.level2.carrying = 'bicchiere';
                c.audio.pickup();
                c.setObjective(objectiveText(c));
              },
            },
            'Acqua. Non troppo fredda.',
          ];
        }
        if (s.carrying) return ['Prima porto questo.'];
        return ['Il bancone. Sempre appiccicoso.'];
      },
    },
    {
      id: 'counter2',
      x: 6,
      y: 3,
      script: () => ['Due caffè e un bicchiere sporco.', 'Il conto della mattina.'],
    },
    {
      id: 'fridge',
      x: 20,
      y: 2,
      script: () => ['Il frigo fa più rumore di noi.'],
    },
    {
      id: 'plant',
      x: 18,
      y: 6,
      script: () => ['È viva.', { wait: 0.4 }, 'Non si sa come.'],
    },
    {
      id: 'fan',
      x: 5,
      y: 1,
      script: () => ['Sta spostando aria calda da quaranta minuti.'],
    },

    // --- tavolo 1: consegna del bicchiere ---
    {
      id: 'table1',
      x: 3,
      y: 6,
      script: (ctx) => {
        const s = ctx.state.level2;
        if (!s.task1 && s.carrying === 'bicchiere') {
          return [
            {
              do: (c) => {
                c.state.level2.carrying = null;
                c.state.level2.task1 = true;
                c.audio.taskDone();
                c.setObjective(objectiveText(c));
              },
            },
            { say: 'Grazie.', who: 'CLIENTE' },
            'Di niente.',
          ];
        }
        if (!s.task1) return ['Aspettano l\'acqua.'];
        return ['Tavolo 1. A posto.'];
      },
    },

    // --- tavolo 2: si sparecchia ---
    {
      id: 'table2',
      x: 10,
      y: 6,
      script: (ctx) => {
        const s = ctx.state.level2;
        if (!s.task1) return ['Prima l\'acqua al tavolo 1.'];
        if (!s.task2 && s.carrying === null) {
          return [
            {
              do: (c) => {
                c.state.level2.carrying = 'piatti';
                c.audio.pickup();
                c.setObjective(objectiveText(c));
              },
            },
            'Hanno lasciato metà di tutto.',
          ];
        }
        if (!s.task2) return ['I piatti vanno in cucina.'];
        return ['Pulito. Per ora.'];
      },
    },

    // --- cucina: si scaricano i piatti, si ritira l'ordine ---
    {
      id: 'kitchen',
      x: 15,
      y: 1,
      script: (ctx) => {
        const s = ctx.state.level2;
        if (s.carrying === 'piatti') {
          return [
            {
              do: (c) => {
                c.state.level2.carrying = null;
                c.state.level2.task2 = true;
                c.audio.taskDone();
                c.setObjective(objectiveText(c));
              },
            },
            { say: 'Lì.', who: 'CUCINA' },
            { wait: 0.4 },
            'Lì.',
          ];
        }
        if (s.task2 && !s.task3 && s.carrying === null) {
          return [
            { say: 'Tavolo quattro.', who: 'CUCINA' },
            {
              do: (c) => {
                c.state.level2.carrying = 'ordine';
                c.audio.pickup();
                c.setObjective(objectiveText(c));
              },
            },
            'Scotta.',
          ];
        }
        if (s.carrying) return ['Ho già le mani piene.'];
        return ['Dalla cucina esce solo vapore.'];
      },
    },
    {
      id: 'kitchen2',
      x: 16,
      y: 1,
      script: () => ['Dentro c\'è dieci gradi in più.', 'Non ci entro.'],
    },

    // --- tavolo 4: consegna dell'ordine ---
    {
      id: 'table4',
      x: 13,
      y: 11,
      script: (ctx) => {
        const s = ctx.state.level2;
        if (s.carrying === 'ordine') {
          return [
            {
              do: (c) => {
                c.state.level2.carrying = null;
                c.state.level2.task3 = true;
                c.audio.taskDone();
                c.setObjective('Il turno è finito.');
              },
            },
            { say: 'Finalmente.', who: 'CLIENTE' },
            { wait: 0.6 },
            { do: (c) => endOfShift(c) },
          ];
        }
        if (!s.task3) return ['Il tavolo 4 aspetta.'];
        return ['Hanno finito in quattro minuti.'];
      },
    },
    {
      id: 'table3',
      x: 3,
      y: 11,
      script: () => ['Nessuno si siede al sole.'],
    },
    {
      id: 'window',
      x: 5,
      y: 15,
      script: () => ['La strada è ferma.'],
    },
    {
      id: 'window2',
      x: 18,
      y: 15,
      script: () => ['Passa un cane. Poi più niente.'],
    },
  ],

  npcs: [
    {
      id: 'cliente1',
      x: 2,
      y: 6,
      dir: 'right',
      look: { suit: '#7b8496', suitLo: '#5c6373', shirt: '#e8e2d2', hair: '#4a4038', beard: false },
      turns: true,
      script: (ctx) => {
        if (!ctx.state.level2.task1) {
          return [
            { say: 'Un\'altra acqua.', who: 'CLIENTE' },
            'Fredda?',
            { say: 'Non esageriamo.', who: 'CLIENTE' },
          ];
        }
        return [{ say: 'Va bene così.', who: 'CLIENTE' }];
      },
    },
    {
      id: 'cliente2',
      x: 11,
      y: 6,
      dir: 'left',
      look: { suit: '#8c7a5a', suitLo: '#6b5c42', shirt: '#dcd6c2', hair: '#6b6258', beard: false, skin: '#b8804f' },
      turns: true,
      script: () => [
        { say: 'Che ore sono?', who: 'CLIENTE' },
        'Quasi finite.',
      ],
    },
    {
      id: 'collega',
      x: 4,
      y: 2,
      dir: 'down',
      look: { suit: '#3f4a55', suitLo: '#2e3742', shirt: P.shirt, hair: '#2a2520' },
      turns: true,
      script: (ctx) => {
        const n = tasksDone(ctx.state);
        if (n === 0) return [{ say: 'Comincia dai tavoli.', who: 'COLLEGA' }, 'Sì.'];
        if (n < 3) return [{ say: 'Poi vai pure.', who: 'COLLEGA' }, 'Poi vado.'];
        return [{ say: 'Chiudo io.', who: 'COLLEGA' }, { wait: 0.4 }, 'Grazie.'];
      },
    },
    {
      id: 'cliente3',
      x: 14,
      y: 11,
      dir: 'left',
      look: { suit: '#6d5b74', suitLo: '#51445a', shirt: '#e2dcc8', hair: '#3a3028', beard: false },
      turns: true,
      script: (ctx) => {
        if (!ctx.state.level2.task3) return [{ say: 'Era per me, l\'ordine?', who: 'CLIENTE' }, 'Arriva.'];
        return [{ say: 'Buon lavoro.', who: 'CLIENTE' }, { wait: 0.3 }, 'Uguale.'];
      },
    },
  ],

  onStep: (ctx, x, y) => {
    if (y !== 15 || (x !== 11 && x !== 12)) return;
    const s = ctx.state.level2;
    if (s.finished) return;
    if (!s.messaged) {
      ctx.say([tasksDone(ctx.state) === 0 ? 'Devo ancora cominciare.' : 'Non ho finito il turno.']);
      return;
    }
    s.finished = true;
    ctx.say([
      { do: (c) => c.audio.select() },
      'Fuori è già sera.',
      { wait: 0.4 },
      { do: (c) => c.goto('street') },
    ]);
  },
};
