/**
 * Sprite dei personaggi da esplorazione: 16x24, quattro direzioni,
 * animazione di camminata a 4 fotogrammi (fermo, passo sx, fermo, passo dx).
 *
 * Il corpo e' definito una volta per direzione tramite mappe di caratteri;
 * le gambe cambiano per fotogramma e il busto "rimbalza" di 1px per dare
 * la sensazione di passo tipica dei giochi 2D dell'epoca.
 */

import { createCanvas, ctx2d } from '../engine/renderer';
import { PAL } from './palette';
import { flipX, stamp } from './pixel';

export const CHAR_W = 16;
export const CHAR_H = 24;

export type Dir = 'down' | 'up' | 'left' | 'right';
export const DIRS: Dir[] = ['down', 'up', 'left', 'right'];

export interface CharPalette {
  hair: string;
  hairHi: string;
  skin: string;
  skinDark: string;
  shirt: string;
  shirtDark: string;
  pants: string;
  shoe: string;
  /** Cappello opzionale: sostituisce la parte alta dei capelli. */
  hat?: string;
  hatHi?: string;
  /** Visiera del cappello (tono piu' scuro). */
  hatBrim?: string;
  outline?: string;
}

// --- Corpi (righe 0..18) ---------------------------------------------------

const BODY_DOWN = [
  '................',
  '....HHHHHHHH....',
  '...HHHHHHHHHH...',
  '...HHHHhHHHHH...',
  '...DDDDDDDDDD...',
  '..hhssssssssHh..',
  '..hhseesseesHh..',
  '..hhssssssssHh..',
  '..hhsssSSssshh..',
  '...hssssssssh...',
  '.....sSSSSs.....',
  '...rrrrrrrrrr...',
  '..rrrrrrrrrrrr..',
  '..rrRrrrrrrRrr..',
  '..srrrrrrrrrrs..',
  '..ssrrrrrrrrss..',
  '...pppppppppp...',
  '...pppppppppp...',
  '...pppppppppp...',
];

const BODY_UP = [
  '................',
  '....HHHHHHHH....',
  '...HHHHHHHHHH...',
  '...HHHHhHHHHH...',
  '...HHHHHHHHHH...',
  '..hhhhhhhhhhhh..',
  '..hhhhhhhhhhhh..',
  '..hhhhhhhhhhhh..',
  '..hhhhhhhhhhhh..',
  '...hhhhhhhhhh...',
  '.....sSSSSs.....',
  '...rrrrrrrrrr...',
  '..rrrrrrrrrrrr..',
  '..rrRrrrrrrRrr..',
  '..srrrrrrrrrrs..',
  '..ssrrrrrrrrss..',
  '...pppppppppp...',
  '...pppppppppp...',
  '...pppppppppp...',
];

const BODY_SIDE = [
  '................',
  '....HHHHHHH.....',
  '...HHHHHHHHH....',
  '...HHHHHHHHHH...',
  '...DDDDDDDDDDD..',
  '..hhhssssssss...',
  '..hhhsseessss...',
  '..hhhssssssss...',
  '..hhhssssSssh...',
  '...hhsssssss....',
  '.....sSSSs......',
  '....rrrrrrrr....',
  '...rrrrrrrrrr...',
  '...rrRrrrrrrr...',
  '...srrrrrrrrs...',
  '....ssrrrrrs....',
  '....pppppppp....',
  '....pppppppp....',
  '....pppppppp....',
];

// --- Gambe (righe 19..23) --------------------------------------------------

const LEGS_FRONT_IDLE = [
  '...pppp.pppp....',
  '...pppp.pppp....',
  '...pppp.pppp....',
  '...bbbb.bbbb....',
  '...bbbb.bbbb....',
];

const LEGS_FRONT_A = [
  '..pppp..pppp....',
  '..pppp..pppp....',
  '..pppp...ppp....',
  '..bbbb...ppp....',
  '..bbbb...bbb....',
];

const LEGS_FRONT_B = [
  '...pppp..pppp...',
  '...pppp..pppp...',
  '...ppp...pppp...',
  '...ppp...bbbb...',
  '...bbb...bbbb...',
];

const LEGS_SIDE_IDLE = [
  '....pppppp......',
  '....pppppp......',
  '....pppppp......',
  '...bbbbbbb......',
  '...bbbbbbb......',
];

const LEGS_SIDE_A = [
  '....pppppp......',
  '...ppp.pppp.....',
  '..ppp....ppp....',
  '..bbb....ppp....',
  '..bbb....bbb....',
];

const LEGS_SIDE_B = [
  '....pppppp......',
  '....pppppppp....',
  '.....pppppppp...',
  '....bbbb..bbb...',
  '....bbbb..bbb...',
];

function legend(p: CharPalette): Record<string, string | null> {
  return {
    // 'H' corpo del cappello (o capelli), 'D' visiera/frangia, 'h' capelli laterali.
    H: p.hat ?? p.hair,
    D: p.hatBrim ?? (p.hat ? p.hatHi ?? p.hair : p.hair),
    h: p.hair,
    s: p.skin,
    S: p.skinDark,
    e: PAL.outline,
    r: p.shirt,
    R: p.shirtDark,
    p: p.pants,
    b: p.shoe,
  };
}

/** Contorno scuro automatico attorno alla silhouette. */
function outlineCanvas(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = createCanvas(src.width, src.height);
  const g = ctx2d(c);
  // Disegna 4 copie tinte come contorno, poi lo sprite sopra.
  const shadow = createCanvas(src.width, src.height);
  const sg = ctx2d(shadow);
  sg.drawImage(src, 0, 0);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = color;
  sg.fillRect(0, 0, src.width, src.height);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as Array<[number, number]>) {
    g.drawImage(shadow, dx, dy);
  }
  g.drawImage(src, 0, 0);
  return c;
}

function buildFrame(p: CharPalette, dir: Dir, frame: number): HTMLCanvasElement {
  const c = createCanvas(CHAR_W, CHAR_H);
  const g = ctx2d(c);
  const lg = legend(p);
  const side = dir === 'left' || dir === 'right';
  const body = dir === 'down' ? BODY_DOWN : dir === 'up' ? BODY_UP : BODY_SIDE;
  const bob = frame === 1 || frame === 3 ? -1 : 0;

  let legs: string[];
  if (side) {
    legs = frame === 1 ? LEGS_SIDE_A : frame === 3 ? LEGS_SIDE_B : LEGS_SIDE_IDLE;
  } else {
    legs = frame === 1 ? LEGS_FRONT_A : frame === 3 ? LEGS_FRONT_B : LEGS_FRONT_IDLE;
  }

  stamp(g, body, lg, 0, bob);
  stamp(g, legs, lg, 0, 19 + bob);
  // Riempi il pixel lasciato scoperto dal rimbalzo.
  if (bob < 0) stamp(g, [legs[legs.length - 1]], lg, 0, 23);

  const out = outlineCanvas(c, p.outline ?? PAL.outline);
  return dir === 'left' ? flipX(out) : out;
}

export type CharSprites = Record<Dir, HTMLCanvasElement[]>;

export function buildCharacter(p: CharPalette): CharSprites {
  const out = {} as CharSprites;
  for (const dir of DIRS) {
    out[dir] = [0, 1, 2, 3].map((f) => buildFrame(p, dir, f));
  }
  return out;
}

// --- Palette predefinite ---------------------------------------------------

export const CHAR_PALETTES: Record<string, CharPalette> = {
  hero: {
    hair: '#3a2a20', hairHi: '#5a3f2c',
    skin: PAL.skin, skinDark: PAL.skinDark,
    shirt: '#d94a3d', shirtDark: '#9c2b26',
    pants: '#2f3a52', shoe: '#1e2230',
    hat: '#e8544a', hatHi: '#ffffff', hatBrim: '#a02a26',
  },
  heroine: {
    hair: '#8a4a26', hairHi: '#b8703a',
    skin: PAL.skin, skinDark: PAL.skinDark,
    shirt: '#3f8ad9', shirtDark: '#265f9c',
    pants: '#4a3a62', shoe: '#241f2b',
  },
  professor: {
    hair: '#c8c8d0', hairHi: '#eaeaf2',
    skin: PAL.skin, skinDark: PAL.skinDark,
    shirt: '#f0f0f4', shirtDark: '#c4c4d0',
    pants: '#3a4258', shoe: '#22242e',
  },
  nurse: {
    hair: '#e8a0b8', hairHi: '#ffd0e0',
    skin: PAL.skin, skinDark: PAL.skinDark,
    shirt: '#f8f8f8', shirtDark: '#d8d8e4',
    pants: '#e8e8f0', shoe: '#c04a5a',
    hat: '#ffffff', hatHi: '#f0f0f8', hatBrim: '#e05a6a',
  },
  clerk: {
    hair: '#2a2a34', hairHi: '#4a4a58',
    skin: PAL.skin, skinDark: PAL.skinDark,
    shirt: '#3fb06a', shirtDark: '#237a46',
    pants: '#2e3440', shoe: '#1a1c24',
    hat: '#2f7a4f', hatHi: '#48a86a', hatBrim: '#1c4f34',
  },
  villager1: {
    hair: '#5a3f2c', hairHi: '#7d5a3c',
    skin: PAL.skin, skinDark: PAL.skinDark,
    shirt: '#e8c33f', shirtDark: '#b08f1e',
    pants: '#5a4634', shoe: '#33291e',
  },
  villager2: {
    hair: '#22222c', hairHi: '#3e3e4c',
    skin: '#d8a476', skinDark: '#a87c50',
    shirt: '#9a5fd0', shirtDark: '#6a3a98',
    pants: '#3a3a4a', shoe: '#20202a',
  },
  child: {
    hair: '#c8a03a', hairHi: '#e8c860',
    skin: PAL.skin, skinDark: PAL.skinDark,
    shirt: '#f08a3f', shirtDark: '#b85f1e',
    pants: '#3f6ad9', shoe: '#2a2f3c',
  },
  fisher: {
    hair: '#4a4a54', hairHi: '#6c6c78',
    skin: '#d8a476', skinDark: '#a87c50',
    shirt: '#3fa8b0', shirtDark: '#237a82',
    pants: '#8a6236', shoe: '#33291e',
    hat: '#e8e0c8', hatHi: '#fff8e0', hatBrim: '#3a5a7a',
  },
  professorAssistant: {
    hair: '#6a4a8a', hairHi: '#8f6ab0',
    skin: '#d8a476', skinDark: '#a87c50',
    shirt: '#e8e8f0', shirtDark: '#c0c0d0',
    pants: '#3a4258', shoe: '#22242e',
  },
  rival: {
    hair: '#e07a2a', hairHi: '#ffa860',
    skin: PAL.skin, skinDark: PAL.skinDark,
    shirt: '#2e3d6a', shirtDark: '#1a2444',
    pants: '#22242e', shoe: '#c04a3a',
  },
  hiker: {
    hair: '#6a4a2a', hairHi: '#8f6a3c',
    skin: '#d8a476', skinDark: '#a87c50',
    shirt: '#c06a2a', shirtDark: '#8a4718',
    pants: '#3a5a3a', shoe: '#33291e',
    hat: '#8a5a2a', hatHi: '#c08a4a', hatBrim: '#5a3a18',
  },
  scout: {
    hair: '#2a3a5a', hairHi: '#465c86',
    skin: PAL.skin, skinDark: PAL.skinDark,
    shirt: '#5a9a4a', shirtDark: '#357030',
    pants: '#4a4436', shoe: '#2a2820',
    hat: '#c8a83f', hatHi: '#e8cc60', hatBrim: '#8a6f18',
  },
};

const cache = new Map<string, CharSprites>();

export function getCharacter(name: string): CharSprites {
  const hit = cache.get(name);
  if (hit) return hit;
  const pal = CHAR_PALETTES[name] ?? CHAR_PALETTES.villager1;
  const built = buildCharacter(pal);
  cache.set(name, built);
  return built;
}

/** Ombra ellittica sotto i personaggi. */
let shadowSprite: HTMLCanvasElement | null = null;
export function charShadow(): HTMLCanvasElement {
  if (shadowSprite) return shadowSprite;
  const c = createCanvas(12, 4);
  const g = ctx2d(c);
  g.globalAlpha = 0.25;
  g.fillStyle = '#000000';
  g.fillRect(2, 0, 8, 4);
  g.fillRect(1, 1, 10, 2);
  g.fillRect(0, 2, 12, 1);
  shadowSprite = c;
  return c;
}
