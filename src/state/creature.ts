/** Istanza di una creatura: statistiche calcolate, mosse, stato, esperienza. */

import { getMove } from '../data/moves';
import type { StatusName } from '../data/moves';
import { expForLevel, getSpecies, Stats } from '../data/species';
import type { ElemType } from '../data/types';
import { rng } from '../engine/rng';

export interface MoveSlot {
  id: string;
  pp: number;
  maxPp: number;
}

export interface CreatureSave {
  species: string;
  nickname?: string;
  level: number;
  exp: number;
  hp: number;
  status: StatusName | null;
  sleepTurns: number;
  moves: MoveSlot[];
  ivs: Stats;
  originalTrainer?: string;
}

export class Creature {
  species: string;
  nickname?: string;
  level: number;
  exp: number;
  hp: number;
  status: StatusName | null = null;
  sleepTurns = 0;
  moves: MoveSlot[] = [];
  ivs: Stats;
  originalTrainer?: string;

  constructor(speciesId: string, level: number, opts: { ivs?: Stats; trainer?: string } = {}) {
    this.species = speciesId;
    this.level = level;
    this.exp = expForLevel(level);
    this.ivs = opts.ivs ?? {
      hp: rng.int(0, 31), atk: rng.int(0, 31), def: rng.int(0, 31),
      spa: rng.int(0, 31), spd: rng.int(0, 31), spe: rng.int(0, 31),
    };
    this.originalTrainer = opts.trainer;
    this.moves = this.defaultMoves();
    this.hp = this.maxHp;
  }

  get def() {
    return getSpecies(this.species);
  }

  get name(): string {
    return this.nickname ?? this.def.name;
  }

  get types(): ElemType[] {
    return this.def.types;
  }

  /** Le 4 mosse piu' recenti apprese fino al livello attuale. */
  private defaultMoves(): MoveSlot[] {
    const learn = this.def.learnset.filter((l) => l.level <= this.level);
    const ids: string[] = [];
    for (const l of learn) {
      if (!ids.includes(l.move)) ids.push(l.move);
    }
    const last = ids.slice(-4);
    if (last.length === 0) last.push('colpo');
    return last.map((id) => {
      const m = getMove(id);
      return { id, pp: m.pp, maxPp: m.pp };
    });
  }

  private stat(key: keyof Stats): number {
    const base = this.def.base[key];
    const iv = this.ivs[key];
    if (key === 'hp') {
      return Math.floor(((2 * base + iv) * this.level) / 100) + this.level + 10;
    }
    return Math.floor(((2 * base + iv) * this.level) / 100) + 5;
  }

  get maxHp(): number { return this.stat('hp'); }
  get atk(): number { return this.stat('atk'); }
  get defense(): number { return this.stat('def'); }
  get spa(): number { return this.stat('spa'); }
  get spd(): number { return this.stat('spd'); }
  get spe(): number { return this.stat('spe'); }

  get fainted(): boolean {
    return this.hp <= 0;
  }

  get hpRatio(): number {
    return Math.max(0, Math.min(1, this.hp / this.maxHp));
  }

  healFull(): void {
    this.hp = this.maxHp;
    this.status = null;
    this.sleepTurns = 0;
    for (const m of this.moves) m.pp = m.maxPp;
  }

  heal(amount: number): number {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
  }

  damage(amount: number): number {
    const before = this.hp;
    this.hp = Math.max(0, this.hp - amount);
    return before - this.hp;
  }

  /** Esperienza necessaria al prossimo livello e progresso 0..1. */
  expProgress(): { need: number; have: number; ratio: number } {
    if (this.level >= 100) return { need: 0, have: 0, ratio: 1 };
    const cur = expForLevel(this.level);
    const next = expForLevel(this.level + 1);
    const have = this.exp - cur;
    const need = next - cur;
    return { need, have, ratio: Math.max(0, Math.min(1, have / need)) };
  }

  /**
   * Aggiunge esperienza. Ritorna i livelli guadagnati e le mosse imparabili.
   */
  gainExp(amount: number): { levels: number; newMoves: string[] } {
    if (this.level >= 100) return { levels: 0, newMoves: [] };
    this.exp += amount;
    let levels = 0;
    const newMoves: string[] = [];
    while (this.level < 100 && this.exp >= expForLevel(this.level + 1)) {
      const oldMax = this.maxHp;
      this.level++;
      levels++;
      this.hp += this.maxHp - oldMax;
      for (const l of this.def.learnset) {
        if (l.level === this.level && !this.moves.some((m) => m.id === l.move)) newMoves.push(l.move);
      }
    }
    return { levels, newMoves };
  }

  learnMove(id: string, replaceIndex?: number): boolean {
    if (this.moves.some((m) => m.id === id)) return false;
    const m = getMove(id);
    const slot: MoveSlot = { id, pp: m.pp, maxPp: m.pp };
    if (this.moves.length < 4) {
      this.moves.push(slot);
      return true;
    }
    if (replaceIndex !== undefined && replaceIndex >= 0 && replaceIndex < 4) {
      this.moves[replaceIndex] = slot;
      return true;
    }
    return false;
  }

  /** Evoluzione disponibile al livello attuale. */
  pendingEvolution(): string | null {
    const ev = this.def.evolvesTo;
    if (ev && this.level >= ev.level) return ev.id;
    return null;
  }

  evolveTo(id: string): void {
    const oldMax = this.maxHp;
    this.species = id;
    this.hp = Math.min(this.maxHp, this.hp + (this.maxHp - oldMax));
    if (this.nickname === undefined) this.nickname = undefined;
  }

  toJSON(): CreatureSave {
    return {
      species: this.species,
      nickname: this.nickname,
      level: this.level,
      exp: this.exp,
      hp: this.hp,
      status: this.status,
      sleepTurns: this.sleepTurns,
      moves: this.moves.map((m) => ({ ...m })),
      ivs: { ...this.ivs },
      originalTrainer: this.originalTrainer,
    };
  }

  static fromJSON(data: CreatureSave): Creature {
    const c = new Creature(data.species, data.level, { ivs: data.ivs, trainer: data.originalTrainer });
    c.nickname = data.nickname;
    c.exp = data.exp;
    c.hp = data.hp;
    c.status = data.status;
    c.sleepTurns = data.sleepTurns ?? 0;
    if (Array.isArray(data.moves) && data.moves.length) {
      c.moves = data.moves.filter((m) => !!m && !!m.id).map((m) => ({ ...m }));
    }
    return c;
  }
}
