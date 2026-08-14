/**
 * Generatore di sprite per le creature.
 *
 * Ogni specie e' descritta da una "ricetta" (forma del corpo, palette,
 * appendici). Il disegno avviene per pixel con ombreggiatura a 3 toni e
 * dithering ordinato sui bordi, poi viene aggiunto un contorno scuro:
 * lo stesso linguaggio visivo degli sprite 2D per console portatili.
 */

import { createCanvas, ctx2d } from '../engine/renderer';
import { hash2 } from '../engine/rng';

export const CREATURE_SIZE = 56;

export type BodyShape = 'round' | 'tall' | 'wide' | 'serpent' | 'quad' | 'bird';
export type EarKind = 'none' | 'pointy' | 'round' | 'fin' | 'antenna' | 'horn';
export type TailKind = 'none' | 'spike' | 'flame' | 'leaf' | 'fin' | 'curl' | 'bolt';
export type BackKind = 'none' | 'spikes' | 'shell' | 'leaf' | 'wings' | 'cloud';
export type LegKind = 'none' | 'stubby' | 'quad' | 'claw';

export interface CreatureLook {
  shape: BodyShape;
  main: string;
  dark: string;
  light: string;
  accent: string;
  belly?: string;
  eye?: string;
  ears?: EarKind;
  tail?: TailKind;
  back?: BackKind;
  legs?: LegKind;
  /** Macchie decorative sul corpo. */
  spots?: boolean;
  /** Occhi grandi (creature giovani) o affilati (evolute). */
  fierce?: boolean;
}

interface Geometry {
  cx: number;
  bodyY: number;
  bodyRx: number;
  bodyRy: number;
  headY: number;
  headR: number;
  /** Il corpo e la testa sono fusi (creature tonde). */
  merged: boolean;
}

function geometry(shape: BodyShape, scale = 1): Geometry {
  const g = baseGeometry(shape);
  if (scale === 1) return g;
  const cy = CREATURE_SIZE - 6;
  const s = (v: number) => v * scale;
  return {
    cx: g.cx,
    bodyY: cy - s(cy - g.bodyY),
    bodyRx: s(g.bodyRx),
    bodyRy: s(g.bodyRy),
    headY: cy - s(cy - g.headY),
    headR: s(g.headR),
    merged: g.merged,
  };
}

function baseGeometry(shape: BodyShape): Geometry {
  const cx = CREATURE_SIZE / 2;
  switch (shape) {
    case 'round':
      return { cx, bodyY: 36, bodyRx: 15, bodyRy: 13, headY: 22, headR: 12, merged: true };
    case 'tall':
      return { cx, bodyY: 38, bodyRx: 11, bodyRy: 12, headY: 20, headR: 11, merged: false };
    case 'wide':
      return { cx, bodyY: 38, bodyRx: 19, bodyRy: 11, headY: 22, headR: 11, merged: false };
    case 'serpent':
      return { cx, bodyY: 42, bodyRx: 13, bodyRy: 8, headY: 22, headR: 10, merged: false };
    case 'quad':
      return { cx, bodyY: 34, bodyRx: 17, bodyRy: 10, headY: 22, headR: 10, merged: false };
    case 'bird':
      return { cx, bodyY: 34, bodyRx: 12, bodyRy: 13, headY: 19, headR: 9, merged: false };
  }
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/**
 * Disegna un'ellisse con ombreggiatura a 3 toni.
 * La luce arriva da alto-sinistra.
 */
function blob(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  main: string,
  dark: string,
  light: string,
): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      // Illuminazione: prodotto scalare approssimato con la direzione (-0.6,-0.8).
      const lum = -(nx * 0.6 + ny * 0.8);
      const edge = 1 - d;
      let color = main;
      if (lum > 0.45 && edge > 0.15) color = light;
      else if (lum < -0.15) color = dark;
      // Dithering nelle zone di transizione.
      const b = BAYER[y & 3][x & 3];
      if (lum > 0.25 && lum <= 0.45 && b < 6) color = light;
      if (lum < 0.05 && lum >= -0.15 && b < 5) color = dark;
      g.fillStyle = color;
      g.fillRect(x, y, 1, 1);
    }
  }
}

function ellipseFill(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
): void {
  g.fillStyle = color;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) g.fillRect(x, y, 1, 1);
    }
  }
}

function tri(
  g: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number, x2: number, y2: number,
  color: string,
): void {
  g.fillStyle = color;
  const minX = Math.floor(Math.min(x0, x1, x2));
  const maxX = Math.ceil(Math.max(x0, x1, x2));
  const minY = Math.floor(Math.min(y0, y1, y2));
  const maxY = Math.ceil(Math.max(y0, y1, y2));
  const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (area === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((x1 - x0) * (py - y0) - (px - x0) * (y1 - y0)) / area;
      const w1 = ((px - x0) * (y2 - y0) - (x2 - x0) * (py - y0)) / area;
      if (w0 >= 0 && w1 >= 0 && w0 + w1 <= 1) g.fillRect(x, y, 1, 1);
    }
  }
}

function drawEars(g: CanvasRenderingContext2D, look: CreatureLook, geo: Geometry, back: boolean): void {
  const { cx, headY, headR } = geo;
  const kind = look.ears ?? 'none';
  if (kind === 'none') return;
  const top = headY - headR;
  const mk = (sign: number) => {
    const ex = cx + sign * (headR * 0.62);
    switch (kind) {
      case 'pointy':
        tri(g, ex - 3, top + 4, ex + 3, top + 3, ex + sign * 2, top - 8, look.main);
        tri(g, ex - 1, top + 2, ex + 1, top + 2, ex + sign * 1.4, top - 5, look.dark);
        break;
      case 'round':
        blob(g, ex + sign * 2, top + 1, 5, 5, look.main, look.dark, look.light);
        ellipseFill(g, ex + sign * 2, top + 1, 2.4, 2.4, look.accent);
        break;
      case 'fin':
        tri(g, ex, top + 6, ex + sign * 9, top - 2, ex + sign * 3, top + 8, look.accent);
        break;
      case 'antenna':
        g.fillStyle = look.dark;
        for (let i = 0; i < 7; i++) g.fillRect(Math.round(ex + sign * i * 0.5), top + 2 - i, 1, 1);
        ellipseFill(g, ex + sign * 3.5, top - 6, 2.5, 2.5, look.accent);
        break;
      case 'horn':
        tri(g, ex - 2, top + 3, ex + 2, top + 3, ex + sign * 3, top - 7, look.accent);
        break;
    }
  };
  mk(-1);
  mk(1);
  if (back && kind === 'round') {
    // Da dietro le orecchie sono piu' scure.
    ellipseFill(g, cx - headR * 0.62 - 2, top + 1, 2.4, 2.4, look.dark);
    ellipseFill(g, cx + headR * 0.62 + 2, top + 1, 2.4, 2.4, look.dark);
  }
}

function drawTail(g: CanvasRenderingContext2D, look: CreatureLook, geo: Geometry, back: boolean): void {
  const kind = look.tail ?? 'none';
  if (kind === 'none') return;
  const sign = back ? -1 : 1;
  const bx = geo.cx + sign * (geo.bodyRx - 2);
  const by = geo.bodyY + 2;
  switch (kind) {
    case 'spike':
      tri(g, bx, by - 3, bx, by + 3, bx + sign * 12, by - 8, look.main);
      tri(g, bx + sign * 2, by - 1, bx + sign * 2, by + 2, bx + sign * 10, by - 6, look.dark);
      break;
    case 'flame': {
      for (let i = 0; i < 4; i++) {
        const t = i / 4;
        ellipseFill(g, bx + sign * (4 + i * 3), by - 4 - i * 3, 4 - t * 2, 4.5 - t * 2, i < 2 ? look.accent : '#ffe08a');
      }
      tri(g, bx + sign * 12, by - 14, bx + sign * 16, by - 22, bx + sign * 15, by - 12, '#ffd166');
      break;
    }
    case 'leaf':
      ellipseFill(g, bx + sign * 7, by - 6, 7, 4, look.accent);
      ellipseFill(g, bx + sign * 6, by - 6, 5, 2, look.light);
      break;
    case 'fin':
      tri(g, bx, by - 5, bx, by + 5, bx + sign * 13, by - 2, look.accent);
      tri(g, bx + sign * 1, by - 2, bx + sign * 1, by + 3, bx + sign * 9, by, look.light);
      break;
    case 'curl':
      g.fillStyle = look.main;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 1.6;
        const rr = 7 - i * 0.3;
        g.fillRect(Math.round(bx + sign * (3 + Math.cos(a) * rr)), Math.round(by - 3 - Math.sin(a) * rr), 3, 3);
      }
      break;
    case 'bolt':
      g.fillStyle = look.accent;
      g.fillRect(bx + (sign > 0 ? 2 : -6), by - 2, 5, 3);
      g.fillRect(bx + (sign > 0 ? 5 : -10), by - 7, 5, 3);
      g.fillRect(bx + (sign > 0 ? 8 : -13), by - 12, 6, 4);
      break;
  }
}

function drawBackFeature(g: CanvasRenderingContext2D, look: CreatureLook, geo: Geometry): void {
  const kind = look.back ?? 'none';
  const { cx, bodyY, bodyRx, bodyRy } = geo;
  switch (kind) {
    case 'spikes':
      for (let i = -2; i <= 2; i++) {
        const x = cx + i * 6;
        tri(g, x - 3, bodyY - bodyRy + 3, x + 3, bodyY - bodyRy + 3, x, bodyY - bodyRy - 6 + Math.abs(i) * 2, look.accent);
      }
      break;
    case 'shell':
      blob(g, cx, bodyY - 2, bodyRx - 1, bodyRy + 1, look.accent, look.dark, look.light);
      g.fillStyle = look.dark;
      for (let i = -1; i <= 1; i++) {
        g.fillRect(cx + i * 7 - 1, bodyY - bodyRy, 2, bodyRy + 4);
      }
      g.fillRect(cx - bodyRx + 2, bodyY - 2, bodyRx * 2 - 4, 2);
      break;
    case 'leaf':
      for (const s of [-1, 1]) {
        ellipseFill(g, cx + s * 9, bodyY - bodyRy - 2, 7, 4, look.accent);
        ellipseFill(g, cx + s * 9, bodyY - bodyRy - 3, 5, 2, look.light);
      }
      break;
    case 'wings':
      for (const s of [-1, 1]) {
        tri(g, cx + s * 6, bodyY - 6, cx + s * 22, bodyY - 16, cx + s * 20, bodyY + 3, look.accent);
        tri(g, cx + s * 7, bodyY - 5, cx + s * 17, bodyY - 12, cx + s * 16, bodyY + 1, look.light);
      }
      break;
    case 'cloud':
      for (const [dx, dy, r] of [[-10, -4, 6], [0, -8, 7], [10, -3, 6]] as Array<[number, number, number]>) {
        ellipseFill(g, cx + dx, bodyY - bodyRy + dy, r, r * 0.8, look.accent);
      }
      break;
  }
}

function drawLegs(g: CanvasRenderingContext2D, look: CreatureLook, geo: Geometry): void {
  const kind = look.legs ?? 'stubby';
  const { cx, bodyY, bodyRx, bodyRy } = geo;
  const footY = bodyY + bodyRy - 1;
  if (kind === 'none') {
    ellipseFill(g, cx, footY + 1, bodyRx * 0.8, 3, look.dark);
    return;
  }
  if (kind === 'quad') {
    for (const s of [-1, 1]) {
      for (const o of [0.55, 0.95]) {
        const x = cx + s * bodyRx * o;
        g.fillStyle = look.dark;
        g.fillRect(Math.round(x - 2), footY - 1, 4, 7);
        g.fillStyle = look.main;
        g.fillRect(Math.round(x - 2), footY - 1, 3, 5);
        g.fillStyle = look.accent;
        g.fillRect(Math.round(x - 3), footY + 5, 6, 2);
      }
    }
    return;
  }
  for (const s of [-1, 1]) {
    const x = cx + s * (bodyRx * 0.5);
    if (kind === 'claw') {
      g.fillStyle = look.dark;
      g.fillRect(Math.round(x - 3), footY, 6, 6);
      g.fillStyle = look.accent;
      for (let i = 0; i < 3; i++) g.fillRect(Math.round(x - 3 + i * 2), footY + 5, 2, 2);
    } else {
      blob(g, x, footY + 3, 5, 4, look.main, look.dark, look.light);
    }
  }
}

function drawFace(g: CanvasRenderingContext2D, look: CreatureLook, geo: Geometry): void {
  const { cx, headY, headR } = geo;
  const eyeColor = look.eye ?? '#1c1a26';
  const ex = headR * 0.46;
  const ey = headY - (look.fierce ? 1 : 0);
  for (const s of [-1, 1]) {
    const x = cx + s * ex;
    if (look.fierce) {
      // Occhio affilato con sopracciglio.
      g.fillStyle = eyeColor;
      g.fillRect(Math.round(x - 3), Math.round(ey - 1), 6, 4);
      g.fillStyle = '#ffffff';
      g.fillRect(Math.round(x + (s > 0 ? 0 : 1)), Math.round(ey), 2, 2);
      g.fillStyle = look.dark;
      g.fillRect(Math.round(x - 3), Math.round(ey - 3), 6, 2);
    } else {
      g.fillStyle = eyeColor;
      ellipseFill(g, x, ey, 3, 3.6, eyeColor);
      g.fillStyle = '#ffffff';
      g.fillRect(Math.round(x - 2), Math.round(ey - 2), 2, 2);
      g.fillStyle = '#c8d8ff';
      g.fillRect(Math.round(x + 1), Math.round(ey + 1), 1, 1);
    }
  }
  // Bocca.
  g.fillStyle = look.dark;
  const my = headY + headR * 0.5;
  if (look.fierce) {
    g.fillRect(Math.round(cx - 4), Math.round(my), 8, 2);
    g.fillStyle = '#ffffff';
    g.fillRect(Math.round(cx - 3), Math.round(my + 1), 2, 1);
    g.fillRect(Math.round(cx + 2), Math.round(my + 1), 2, 1);
  } else {
    g.fillRect(Math.round(cx - 1), Math.round(my), 2, 1);
    g.fillRect(Math.round(cx - 3), Math.round(my - 1), 2, 1);
    g.fillRect(Math.round(cx + 2), Math.round(my - 1), 2, 1);
  }
}

function drawSpots(g: CanvasRenderingContext2D, look: CreatureLook, geo: Geometry): void {
  if (!look.spots) return;
  const { cx, bodyY, bodyRx, bodyRy } = geo;
  for (let i = 0; i < 6; i++) {
    const a = hash2(i, 1, 5) * Math.PI * 2;
    const rr = 0.35 + hash2(i, 2, 5) * 0.45;
    const x = cx + Math.cos(a) * bodyRx * rr;
    const y = bodyY + Math.sin(a) * bodyRy * rr;
    ellipseFill(g, x, y, 2.5, 2, look.accent);
  }
}

function outlineIt(src: HTMLCanvasElement, color = '#1a1622'): HTMLCanvasElement {
  const c = createCanvas(src.width, src.height);
  const g = ctx2d(c);
  const sh = createCanvas(src.width, src.height);
  const sg = ctx2d(sh);
  sg.drawImage(src, 0, 0);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = color;
  sg.fillRect(0, 0, src.width, src.height);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as Array<[number, number]>) {
    g.drawImage(sh, dx, dy);
  }
  g.drawImage(src, 0, 0);
  return c;
}

/** Sprite frontale (avversario) o posteriore (creatura del giocatore). */
export function buildCreatureSprite(look: CreatureLook, back: boolean): HTMLCanvasElement {
  const c = createCanvas(CREATURE_SIZE, CREATURE_SIZE);
  const g = ctx2d(c);
  // La creatura del giocatore e' piu' vicina: leggermente piu' grande.
  const geo = geometry(look.shape, back ? 1.16 : 1);

  drawBackFeature(g, look, geo);
  if (!back) drawTail(g, look, geo, false);
  else drawTail(g, look, geo, true);

  drawLegs(g, look, geo);

  // Corpo.
  blob(g, geo.cx, geo.bodyY, geo.bodyRx, geo.bodyRy, look.main, look.dark, look.light);
  if (look.belly && !back) {
    ellipseFill(g, geo.cx, geo.bodyY + 2, geo.bodyRx * 0.6, geo.bodyRy * 0.62, look.belly);
  }
  drawSpots(g, look, geo);

  // Coda davanti al corpo per alcune forme (serpente).
  if (look.shape === 'serpent' && !back) {
    blob(g, geo.cx, geo.bodyY + 4, geo.bodyRx * 0.7, 5, look.main, look.dark, look.light);
  }

  // Testa.
  drawEars(g, look, geo, back);
  blob(g, geo.cx, geo.headY, geo.headR, geo.headR * 0.95, look.main, look.dark, look.light);
  if (geo.merged) {
    blob(g, geo.cx, (geo.headY + geo.bodyY) / 2, geo.headR * 0.85, 6, look.main, look.dark, look.light);
  }

  if (!back) {
    drawFace(g, look, geo);
  } else {
    // Da dietro: nuca in ombra morbida e riflesso sulla sommita' del capo.
    for (let y = geo.headY; y < geo.headY + geo.headR * 0.9; y++) {
      for (let x = geo.cx - geo.headR; x < geo.cx + geo.headR; x++) {
        const nx = (x + 0.5 - geo.cx) / (geo.headR * 0.8);
        const ny = (y + 0.5 - (geo.headY + 3)) / (geo.headR * 0.55);
        if (nx * nx + ny * ny > 1) continue;
        if (BAYER[y & 3][x & 3] > 7) continue;
        g.fillStyle = look.dark;
        g.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
    ellipseFill(g, geo.cx - geo.headR * 0.3, geo.headY - geo.headR * 0.45, geo.headR * 0.35, 2, look.light);
  }

  return outlineIt(c);
}

const spriteCache = new Map<string, HTMLCanvasElement>();

export function creatureSprite(id: string, look: CreatureLook, back: boolean): HTMLCanvasElement {
  const key = `${id}:${back ? 'b' : 'f'}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const s = buildCreatureSprite(look, back);
  spriteCache.set(key, s);
  return s;
}

/** Icona 16x16 per menu e squadra. */
export function creatureIcon(id: string, look: CreatureLook): HTMLCanvasElement {
  const key = `${id}:icon`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const full = creatureSprite(id, look, false);
  const c = createCanvas(16, 16);
  const g = ctx2d(c);
  g.imageSmoothingEnabled = false;
  // Ritaglia il riquadro utile e riduce a 16x16.
  g.drawImage(full, 6, 6, 44, 44, 0, 0, 16, 16);
  spriteCache.set(key, c);
  return c;
}
