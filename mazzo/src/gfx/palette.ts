/**
 * Palette unica del gioco: calda, polverosa, desaturata. Il caldo si deve
 * vedere anche a occhi chiusi sul contrasto.
 */

export const P = {
  // Fondamentali
  ink: '#241d19',
  inkSoft: '#3a2f27',
  paper: '#e6dcc4',

  // Mazzo
  skin: '#c68a5b',
  skinHi: '#dda476',
  skinLo: '#9c6640',
  beard: '#2f2620',
  suit: '#59632f',
  suitLo: '#3f4722',
  shirt: '#e3dccb',
  shoe: '#6b4527',

  // Interni (livello 1)
  floorWood: '#8a6a3f',
  floorWood2: '#7e6039',
  wallRoom: '#d5c39a',
  wallRoomLo: '#b09872',
  bedSheet: '#cfc4a6',
  bedFrame: '#7a5a38',

  // Locale (livello 2)
  floorTile: '#cfc3a6',
  floorTile2: '#c4b797',
  wallBar: '#9c8760',
  wood: '#8a6238',
  woodLo: '#6d4c2b',
  steel: '#a8a596',
  cloth: '#c4483a',

  // Strada (livello 3)
  night: '#0e0e16',
  asphalt: '#3a3a46',
  asphalt2: '#34343f',
  sidewalk: '#5d5a68',
  facade: '#1e1b26',
  facadeLo: '#15131c',
  lampGlow: '#d8a94a',
  windowLit: '#e0b45c',

  // Natura e varie
  leaf: '#4d5a34',
  leafLo: '#3a4527',
  glass: '#b7cbc4',
  water: '#8fb0ae',
  shadow: 'rgba(30,24,18,0.28)',

  // Interfaccia
  boxFill: '#f0e7cf',
  boxEdge: '#4a3b2a',
  boxShade: '#c3b393',
  hudFill: 'rgba(30,26,20,0.72)',
  hudInk: '#efe3c4',
} as const;

/** Velo caldo del giorno: il sole di luglio che entra dalla finestra. */
export const HEAT_VEIL = 'rgba(255, 196, 96, 0.10)';
/** Velo della sera. */
export const NIGHT_VEIL = 'rgba(26, 28, 66, 0.16)';
