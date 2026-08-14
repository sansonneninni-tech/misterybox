/**
 * Palette originale del gioco, costruita per evocare la densita' cromatica
 * dei JRPG portatili 2D: colori saturi ma leggermente desaturati, ombre
 * calde sulla terra e fredde sull'acqua, 3-4 toni per materiale.
 */

export const PAL = {
  // Erba e vegetazione
  grassDark: '#3a7a3a',
  grassMid: '#4f9c48',
  grassLite: '#68b85a',
  grassHi: '#8ad46a',
  bushDark: '#1f5230',
  bushMid: '#2f7040',
  bushLite: '#47934f',

  // Terra, sentieri, sabbia
  dirtDark: '#8a6236',
  dirtMid: '#b58a52',
  dirtLite: '#d6b078',
  sandDark: '#c9a460',
  sandMid: '#e6cd92',
  sandLite: '#f6e7bb',

  // Roccia e montagne
  rockDark: '#4a4a58',
  rockMid: '#6f6f80',
  rockLite: '#9a9aac',
  rockHi: '#c2c2d0',

  // Acqua
  waterDark: '#1c4f8f',
  waterMid: '#2f79c4',
  waterLite: '#59a7e6',
  waterFoam: '#c9edff',

  // Legno e tetti
  woodDark: '#5e3b23',
  woodMid: '#8b5a30',
  woodLite: '#b8823f',
  roofRed: '#a8332f',
  roofRedDark: '#722021',
  roofRedLite: '#d1554a',
  roofBlue: '#2f5aa8',
  roofBlueDark: '#1d3a72',
  roofBlueLite: '#4b83d1',
  roofGreen: '#2f7a4f',
  roofGreenDark: '#1c4f34',

  // Muri
  wallLite: '#e8dcc0',
  wallMid: '#c8b795',
  wallDark: '#9a8768',
  wallShadow: '#6f5f48',

  // Interni
  floorLite: '#d9c8a8',
  floorMid: '#bfa985',
  floorDark: '#93805f',

  // Interfaccia
  uiFrame: '#20304f',
  uiFrameLite: '#3f5b8c',
  uiBg: '#f8f8f8',
  uiBgAlt: '#dfe6f2',
  uiShadow: '#a8b2c4',
  uiText: '#2a2c38',
  uiTextShadow: '#b6bcca',

  black: '#000000',
  white: '#ffffff',

  // Personaggi
  skin: '#f2c49a',
  skinDark: '#c98f63',
  hairDark: '#3a2a20',
  hairMid: '#5a3f2c',
  shirtRed: '#cf4444',
  shirtRedDark: '#8f2626',
  shirtBlue: '#3f63c4',
  shirtBlueDark: '#26397e',
  pantsDark: '#2f3a52',
  pantsMid: '#46557a',
  shoe: '#33333f',
  outline: '#241f2b',

  hpGreen: '#48c85a',
  hpYellow: '#e8c246',
  hpRed: '#dc4a3c',
  xpBlue: '#4aa8e8',
} as const;

export type PalKey = keyof typeof PAL;

/** Colori per tipo elementale (usati in UI e barre). */
export const TYPE_COLORS: Record<string, string> = {
  normale: '#a8a090',
  fuoco: '#e0672f',
  acqua: '#3d81d6',
  erba: '#5fae42',
  elettro: '#e2be32',
  ghiaccio: '#79cfd4',
  roccia: '#b39547',
  vento: '#8aa8d8',
  spettro: '#7159a0',
  metallo: '#9aa2b0',
  veleno: '#a052a8',
  luce: '#f0d98a',
};
