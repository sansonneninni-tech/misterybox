/**
 * Sprite dei personaggi: 16x24, quattro direzioni, tre pose di camminata.
 * Tutto disegnato qui dal codice, niente file esterni.
 *
 * Legenda delle griglie:
 *   k contorno   s pelle   S luce sulla pelle   e occhio
 *   b barba/capelli   g abito   G abito in ombra   w camicia   h scarpe
 */

import { fromGrid, mirror } from './pixel';
import { P } from './palette';

export type Dir = 'down' | 'up' | 'left' | 'right';

/** Busto e testa: righe 0-19. Le gambe (20-23) cambiano con il passo. */
const BODY: Record<'down' | 'up' | 'side', string[]> = {
  down: [
    '.....kkkkkk.....',
    '....kssssssk....',
    '...kssSSsssk....',
    '...ksssssssk....',
    '...ksssssssk....',
    '...ksesssesk....',
    '...kbsssssbk....',
    '...kbbsssbbk....',
    '...kkbbbbbkk....',
    '.....kbbbk......',
    '...kggwwwgggk...',
    '...kgggwwgggk...',
    '...kgggwwgggk...',
    '...kgggwwgggk...',
    '...kgggwwgggk...',
    '...kgggwwgggk...',
    '...ksggwwggsk...',
    '...ksGGGGGGsk...',
    '....kGGGGGGk....',
    '....kGGGGGGk....',
  ],
  up: [
    '.....kkkkkk.....',
    '....kssssssk....',
    '...kssSSsssk....',
    '...ksssssssk....',
    '...ksssssssk....',
    '...ksssssssk....',
    '...kbsssssbk....',
    '...kbbbbbbbk....',
    '...kkbbbbbkk....',
    '.....kwwwk......',
    '...kggwwwwggk...',
    '...kggggggggk...',
    '...kggggggggk...',
    '...kggggggggk...',
    '...kggggggggk...',
    '...kggggggggk...',
    '...ksggggggsk...',
    '...ksGGGGGGsk...',
    '....kGGGGGGk....',
    '....kGGGGGGk....',
  ],
  side: [
    '.....kkkkk......',
    '....ksssssk.....',
    '....ksSsssk.....',
    '....ksssssk.....',
    '....ksssssk.....',
    '....ksesssk.....',
    '....kbbsssk.....',
    '....kbbbssk.....',
    '....kbbbbbk.....',
    '.....kbbbk......',
    '....kwgggggk....',
    '....kwgggggk....',
    '....kwgggggk....',
    '....kwgggggk....',
    '....kwgggggk....',
    '....kwgggggk....',
    '....ksggggGk....',
    '....kGGGGGGk....',
    '.....kGGGGk.....',
    '.....kGGGGk.....',
  ],
};

/** Gambe: 0 = fermo, 1 = passo aperto, 2 = passo chiuso. */
const LEGS: Record<'front' | 'side', string[][]> = {
  front: [
    ['....kGGkkGGk....', '....kGGkkGGk....', '....khhkkhhk....', '....kkkkkkkk....'],
    ['...kGGk..kGGk...', '...kGGk..kGGk...', '...khhk..khhk...', '...kkkk..kkkk...'],
    ['.....kGGGGk.....', '.....kGGGGk.....', '.....khhhhk.....', '.....kkkkkk.....'],
  ],
  side: [
    ['.....kGGGGk.....', '.....kGGGGk.....', '....khhhhhk.....', '....kkkkkk......'],
    ['....kGGkGGk.....', '...kGGk.kGGk....', '...khhk.khhk....', '...kkkk.kkkk....'],
    ['.....kGGGGk.....', '.....kGGGGk.....', '.....khhhhk.....', '.....kkkkkk.....'],
  ],
};

export interface ActorLook {
  skin?: string;
  skinHi?: string;
  hair?: string;
  suit?: string;
  suitLo?: string;
  shirt?: string;
  shoe?: string;
  /** Se falso la barba diventa pelle: volti rasati per gli altri personaggi. */
  beard?: boolean;
}

export interface ActorSprites {
  /** [direzione][frame] con frame 0 fermo, 1 e 2 in camminata. */
  frames: Record<Dir, HTMLCanvasElement[]>;
  w: number;
  h: number;
}

function paletteFor(look: ActorLook): Record<string, string> {
  const skin = look.skin ?? P.skin;
  const hair = look.hair ?? P.beard;
  return {
    k: P.ink,
    s: skin,
    S: look.skinHi ?? P.skinHi,
    e: P.ink,
    b: look.beard === false ? skin : hair,
    g: look.suit ?? P.suit,
    G: look.suitLo ?? P.suitLo,
    w: look.shirt ?? P.shirt,
    h: look.shoe ?? P.shoe,
  };
}

function assemble(body: string[], legs: string[], colors: Record<string, string>): HTMLCanvasElement {
  return fromGrid([...body, ...legs], colors);
}

export function buildActor(look: ActorLook = {}): ActorSprites {
  const colors = paletteFor(look);
  const mk = (kind: 'down' | 'up' | 'side', legKind: 'front' | 'side') =>
    LEGS[legKind].map((legs) => assemble(BODY[kind], legs, colors));

  const left = mk('side', 'side');
  return {
    frames: {
      down: mk('down', 'front'),
      up: mk('up', 'front'),
      left,
      right: left.map(mirror),
    },
    w: 16,
    h: 24,
  };
}

/** Ombra ovale sotto i personaggi: li stacca dal pavimento. */
export function drawShadow(g: CanvasRenderingContext2D, cx: number, cy: number, rx = 6): void {
  g.save();
  g.fillStyle = P.shadow;
  g.beginPath();
  g.ellipse(cx, cy, rx, rx * 0.42, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
