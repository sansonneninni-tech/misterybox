/** Generatore pseudo-casuale deterministico (mulberry32), utile per test riproducibili. */

export class Rng {
  private s: number;

  constructor(seed = 0x9e3779b9) {
    this.s = seed >>> 0;
  }

  /** Float in [0,1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Intero in [min, max] inclusi. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Vero con probabilita' p (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Elemento casuale di un array non vuoto. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  /** Mescola in place e restituisce l'array. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

/** Istanza globale usata dal gioco (rimpiazzabile nei test tramite `setGlobalSeed`). */
export let rng = new Rng((Math.random() * 0xffffffff) >>> 0);

export function setGlobalSeed(seed: number): void {
  rng = new Rng(seed);
}

/** Hash deterministico 2D: usato per variare la grafica dei tile senza salvare dati. */
export function hash2(x: number, y: number, salt = 0): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
