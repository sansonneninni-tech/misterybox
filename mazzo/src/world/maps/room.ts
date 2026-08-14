/**
 * LIVELLO 1 — "Fa caldo."
 * Una stanza sola. Mazzo deve trovare le chiavi e uscire. Tutto il resto e'
 * facoltativo: serve solo a far capire chi e'.
 */

import { HEAT_VEIL } from '../../gfx/palette';
import type { MapDef } from '../map';
import type { Ctx } from '../../systems/state';

const ROWS = [
  '##################',
  '#####WW######F####',
  '##12.........yz.##',
  '##34.......p....##',
  '##34...........T##',
  '##N.....C.......##',
  '##.......G...P..##',
  '##....C.........##',
  '##.........C....##',
  '##..............##',
  '##..............##',
  '#######DD#########',
  '##################',
];

/** Segna un oggetto come guardato: serve solo a variare una battuta finale. */
function seen(ctx: Ctx, id: string): void {
  ctx.state.level1.examined.add(id);
}

export const roomMap: MapDef = {
  id: 'room',
  title: 'FA CALDO.',
  rows: ROWS,
  ambience: 'room',
  veil: HEAT_VEIL,
  spawn: { x: 5, y: 4, dir: 'down' },
  fans: [{ x: 13, y: 1 }],

  objective: (ctx) => (ctx.state.level1.hasKeys ? 'Andare a lavoro.' : 'Trovare le chiavi.'),

  intro: () => [
    { caption: 'FA CALDO.', hold: 2.6 },
    { wait: 0.5 },
    'Devo andare a lavoro.',
  ],

  objects: [
    {
      id: 'keys',
      x: 2,
      y: 5,
      script: (ctx) => {
        if (ctx.state.level1.hasKeys) return ['Il comodino. Adesso è vuoto.'];
        return [
          'Le chiavi.',
          { wait: 0.3 },
          {
            do: (c) => {
              c.state.level1.hasKeys = true;
              c.audio.pickup();
              c.setObjective('Andare a lavoro.');
            },
          },
          'Erano qui da ieri.',
        ];
      },
    },
    {
      id: 'bed',
      x: 3,
      y: 3,
      script: (ctx) => {
        seen(ctx, 'bed');
        return ['Il letto è ancora caldo.', 'Non è un buon segno.'];
      },
    },
    {
      id: 'tv',
      x: 15,
      y: 4,
      script: (ctx) => {
        seen(ctx, 'tv');
        return ['Potrei riaccenderla.', { wait: 0.6 }, 'Non lo faccio.'];
      },
    },
    {
      id: 'fan',
      x: 13,
      y: 1,
      script: (ctx) => {
        seen(ctx, 'fan');
        return ['Livello tre.', { wait: 0.4 }, 'Non esiste un livello quattro.'];
      },
    },
    {
      id: 'window',
      x: 5,
      y: 1,
      script: (ctx) => {
        seen(ctx, 'window');
        return ['Fuori sembra peggio.'];
      },
    },
    {
      id: 'window2',
      x: 6,
      y: 1,
      script: (ctx) => {
        seen(ctx, 'window');
        return ['Le cicale hanno cominciato alle sei.'];
      },
    },
    {
      id: 'console',
      x: 13,
      y: 6,
      script: (ctx) => {
        seen(ctx, 'console');
        return ['Partita lasciata a metà.', { wait: 0.5 }, 'Da marzo.'];
      },
    },
    {
      id: 'glass',
      x: 9,
      y: 6,
      script: (ctx) => {
        seen(ctx, 'glass');
        return ['Acqua di ieri.', 'Quasi fresca.'];
      },
    },
    {
      id: 'clothes',
      x: 8,
      y: 5,
      script: (ctx) => {
        seen(ctx, 'clothes');
        return ['Sono puliti.', { wait: 0.4 }, 'Quasi.'];
      },
    },
    {
      id: 'wardrobe',
      x: 13,
      y: 2,
      script: () => ['Dentro c\'è tutto piegato.', { wait: 0.4 }, 'Non da me.'],
    },
    {
      id: 'clothes2',
      x: 11,
      y: 8,
      script: () => ['La divisa è quella che ho addosso.'],
    },
    {
      id: 'plate',
      x: 11,
      y: 3,
      script: (ctx) => {
        seen(ctx, 'plate');
        return ['Lo lavo quando torno.'];
      },
    },
  ],

  npcs: [],

  onStep: (ctx, x, y) => {
    if (y !== 11 || (x !== 7 && x !== 8)) return;
    if (ctx.state.level1.finished) return;
    if (!ctx.state.level1.hasKeys) {
      ctx.say(['Senza chiavi non esco.', 'La porta si chiude da sola.']);
      return;
    }
    ctx.state.level1.finished = true;
    const curiosi = ctx.state.level1.examined.size;
    ctx.say(
      [
        { do: (c) => c.audio.select() },
        curiosi >= 4 ? 'Ho perso dieci minuti.' : 'Vado.',
        { wait: 0.4 },
        { do: (c) => c.goto('bar') },
      ],
    );
  },
};
