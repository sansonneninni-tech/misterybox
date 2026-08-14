/**
 * LIVELLO 3 — "La busta."
 * Sera. Una strada, un incrocio, un vicolo e una piazzetta. In fondo c'e' una
 * persona normalissima con una busta.
 */

import { NIGHT_VEIL } from '../../gfx/palette';
import type { MapDef } from '../map';

const E10 = 'EEEEEEEEEE';

const ROWS = [
  'EEEEEEEEEEEEEEEEEEEEEEEEEEEEEE',
  'EEwEEqEEwEEEEEwEEEEqEEwEEEEEEE',
  'EEEEEEEEEEEEEEEEEEEEEEEEEEEEEE',
  `${E10}mmmmmmmmmm${E10}`,
  `EEEEEEEEEw${'mm'}${'aaaaaa'}${'mm'}${E10}`,
  `${E10}${'mm'}${'aaaaaa'}${'mm'}wEEEEEEEEE`,
  `${E10}${'mm'}${'aalaaa'}${'mm'}${E10}`,
  `EEEEEEEEEr${'mm'}${'aaaaaa'}${'mm'}${E10}`,
  `${E10}${'mL'}${'aaaaaa'}${'mm'}${E10}`,
  `${E10}${'mm'}${'aalaaa'}${'mm'}mmm_A_mmmE`,
  `${E10}${'mm'}${'aaaaaa'}${'mM'}mmmmmnmmmE`,
  `Emmmmmmmmm${'mm'}${'aaaaaa'}${'mm'}mmmmmttmmE`,
  `E${'a'.repeat(28)}E`,
  `Emmmmmmmmm${'mm'}${'aaaaaa'}${'mm'}mmmmmmmmmE`,
  `${E10}${'mm'}${'aaaaaa'}${'mm'}${E10}`,
  `EEEEEEEEEq${'mm'}${'aaaaaa'}${'mm'}${E10}`,
  `${E10}${'mm'}${'aalaaa'}${'mm'}${E10}`,
  `${E10}${'mZ'}${'aaaaaa'}${'Lm'}${E10}`,
  `${E10}${'mm'}${'aaaaaa'}${'mm'}wEEEEEEEEE`,
  `EEEEEEEEEr${'mM'}${'aaaaaa'}${'mm'}${E10}`,
  `${E10}${'mm'}${'aaaaaa'}${'mm'}${E10}`,
  `${E10}mmmmmmmmmm${E10}`,
];

export const streetMap: MapDef = {
  id: 'street',
  title: 'LA BUSTA',
  rows: ROWS,
  ambience: 'street',
  veil: NIGHT_VEIL,
  spawn: { x: 14, y: 20, dir: 'up' },
  lamps: [
    { x: 11, y: 8 },
    { x: 18, y: 17 },
  ],

  objective: (ctx) => (ctx.state.level3.receivedEnvelope ? 'Tornare a casa.' : 'Recuperare la busta.'),

  intro: () => [
    { caption: 'LA BUSTA', hold: 2.4 },
    { wait: 0.5 },
    'Fa ancora caldo.',
    { wait: 0.4 },
    'Ma di un altro tipo.',
  ],

  objects: [
    {
      id: 'scooter1',
      x: 19,
      y: 10,
      script: () => ['Non parte mai al primo colpo.'],
    },
    {
      id: 'scooter2',
      x: 11,
      y: 19,
      script: () => ['Questo non parte proprio.'],
    },
    {
      id: 'shutter1',
      x: 9,
      y: 7,
      script: () => ['Chiuso.'],
    },
    {
      id: 'shutter2',
      x: 9,
      y: 19,
      script: () => ['Il bar sotto casa.', { wait: 0.4 }, 'Chiude prima di tutti.'],
    },
    {
      id: 'bin',
      x: 11,
      y: 17,
      script: () => ['Domani passano.', { wait: 0.4 }, 'Forse.'],
    },
    {
      id: 'bench',
      x: 25,
      y: 10,
      script: () => ['Meglio non sedersi.'],
    },
    {
      id: 'wall',
      x: 26,
      y: 11,
      script: () => ['Da qui si sente il mare.', { wait: 0.5 }, 'Non è vero.'],
    },
    {
      id: 'tree',
      x: 24,
      y: 9,
      script: () => ['Non fa ombra a nessuno, a quest\'ora.'],
    },
    {
      id: 'lamp',
      x: 11,
      y: 8,
      script: () => ['Ronza.'],
    },
    {
      id: 'balcony',
      x: 9,
      y: 15,
      script: () => ['Una televisione, al terzo piano.', 'La stessa di tutti.'],
    },
  ],

  npcs: [
    {
      id: 'anziano',
      x: 5,
      y: 13,
      dir: 'right',
      look: { suit: '#8e8b7e', suitLo: '#6d6a5f', shirt: '#e8e4d4', hair: '#c9c4b4', skin: '#bd8a5f' },
      turns: true,
      script: () => [
        { say: 'Ancora in giro?', who: 'ANZIANO' },
        'Sto tornando.',
        { wait: 1.2 },
      ],
    },
    {
      id: 'ragazza',
      x: 22,
      y: 10,
      dir: 'down',
      look: { suit: '#6b7c6a', suitLo: '#4e5c4d', shirt: '#ded8c6', hair: '#3b2f28', beard: false },
      turns: true,
      script: () => [
        { say: 'Passa un\'aria.', who: 'RAGAZZA' },
        { wait: 0.4 },
        'Poca.',
      ],
    },
    {
      id: 'contatto',
      x: 14,
      y: 5,
      dir: 'down',
      look: { suit: '#4a4f5e', suitLo: '#363a47', shirt: '#dcd8cb', hair: '#2c2621', beard: false },
      turns: true,
      script: (ctx) => {
        if (ctx.state.level3.receivedEnvelope) {
          return [{ say: 'Vai.', who: '???' }, { wait: 0.4 }, 'Vado.'];
        }
        return [
          { say: 'Mazzo.', who: '???' },
          'Eh.',
          { say: 'Pensavo non venissi.', who: '???' },
          'Lavoravo.',
          { wait: 1.2 },
          {
            do: (c) => {
              c.state.level3.receivedEnvelope = true;
              c.audio.envelope();
              c.setObjective('Tornare a casa.');
            },
          },
          { caption: 'LA BUSTA', hold: 2.0 },
          { wait: 0.8 },
          'Finalmente.',
          { wait: 1.0 },
          'Adesso posso tornare a casa.',
          { wait: 0.6 },
          { do: (c) => c.goto('ending') },
        ];
      },
    },
  ],
};
