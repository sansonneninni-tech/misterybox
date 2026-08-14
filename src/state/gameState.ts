/** Stato globale della partita: squadra, borsa, denaro, progressi, salvataggio. */

import { getItem } from '../data/items';
import { SPECIES_ORDER } from '../data/species';
import type { Dir } from '../gfx/chars';
import { Creature, CreatureSave } from './creature';

export interface BagEntry {
  id: string;
  qty: number;
}

export interface SaveData {
  version: number;
  playerName: string;
  mapId: string;
  x: number;
  y: number;
  dir: Dir;
  money: number;
  party: CreatureSave[];
  box: CreatureSave[];
  bag: BagEntry[];
  flags: string[];
  seen: string[];
  caught: string[];
  playTime: number;
  starter: string | null;
}

export const SAVE_KEY = 'verdania.save.v1';
export const SAVE_VERSION = 1;

export class GameState {
  playerName = 'ALEX';
  mapId = 'casa_giocatore';
  x = 4;
  y = 5;
  dir: Dir = 'down';
  money = 3000;
  party: Creature[] = [];
  box: Creature[] = [];
  bag: BagEntry[] = [];
  flags = new Set<string>();
  seen = new Set<string>();
  caught = new Set<string>();
  /** Frame logici giocati. */
  playTime = 0;
  starter: string | null = null;
  /** Passi rimanenti di repellente. */
  repelSteps = 0;

  // --- squadra ------------------------------------------------------------

  get leader(): Creature | undefined {
    return this.party.find((c) => !c.fainted) ?? this.party[0];
  }

  get firstHealthy(): Creature | undefined {
    return this.party.find((c) => !c.fainted);
  }

  get allFainted(): boolean {
    return this.party.length > 0 && this.party.every((c) => c.fainted);
  }

  addCreature(c: Creature): 'party' | 'box' {
    this.caught.add(c.species);
    this.seen.add(c.species);
    if (this.party.length < 6) {
      this.party.push(c);
      return 'party';
    }
    this.box.push(c);
    return 'box';
  }

  healParty(): void {
    for (const c of this.party) c.healFull();
  }

  // --- borsa --------------------------------------------------------------

  addItem(id: string, qty = 1): void {
    const e = this.bag.find((b) => b.id === id);
    if (e) e.qty = Math.min(99, e.qty + qty);
    else this.bag.push({ id, qty: Math.min(99, qty) });
  }

  removeItem(id: string, qty = 1): boolean {
    const i = this.bag.findIndex((b) => b.id === id);
    if (i < 0) return false;
    const e = this.bag[i];
    if (e.qty < qty) return false;
    e.qty -= qty;
    if (e.qty <= 0) this.bag.splice(i, 1);
    return true;
  }

  countItem(id: string): number {
    return this.bag.find((b) => b.id === id)?.qty ?? 0;
  }

  itemsByCategory(cat: string): BagEntry[] {
    return this.bag.filter((b) => getItem(b.id).category === cat);
  }

  // --- progressi ----------------------------------------------------------

  setFlag(f: string): void {
    this.flags.add(f);
  }

  hasFlag(f: string): boolean {
    return this.flags.has(f);
  }

  markSeen(species: string): void {
    this.seen.add(species);
  }

  dexProgress(): { seen: number; caught: number; total: number } {
    return { seen: this.seen.size, caught: this.caught.size, total: SPECIES_ORDER.length };
  }

  playTimeText(): string {
    const totalSeconds = Math.floor(this.playTime / 60);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return `${h}:${String(m).padStart(2, '0')}`;
  }

  // --- salvataggio --------------------------------------------------------

  toJSON(): SaveData {
    return {
      version: SAVE_VERSION,
      playerName: this.playerName,
      mapId: this.mapId,
      x: this.x,
      y: this.y,
      dir: this.dir,
      money: this.money,
      party: this.party.map((c) => c.toJSON()),
      box: this.box.map((c) => c.toJSON()),
      bag: this.bag.map((b) => ({ ...b })),
      flags: [...this.flags],
      seen: [...this.seen],
      caught: [...this.caught],
      playTime: this.playTime,
      starter: this.starter,
    };
  }

  static fromJSON(data: SaveData): GameState {
    const s = new GameState();
    s.playerName = data.playerName ?? 'ALEX';
    s.mapId = data.mapId;
    s.x = data.x;
    s.y = data.y;
    s.dir = data.dir ?? 'down';
    s.money = data.money ?? 0;
    s.party = (data.party ?? []).map(Creature.fromJSON);
    s.box = (data.box ?? []).map(Creature.fromJSON);
    s.bag = (data.bag ?? []).filter((b) => !!b && !!b.id);
    s.flags = new Set(data.flags ?? []);
    s.seen = new Set(data.seen ?? []);
    s.caught = new Set(data.caught ?? []);
    s.playTime = data.playTime ?? 0;
    s.starter = data.starter ?? null;
    return s;
  }

  save(): boolean {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.toJSON()));
      return true;
    } catch (e) {
      console.error('Salvataggio non riuscito', e);
      return false;
    }
  }

  static hasSave(): boolean {
    try {
      return localStorage.getItem(SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  static load(): GameState | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as SaveData;
      if (!data || typeof data !== 'object' || !data.mapId) return null;
      return GameState.fromJSON(data);
    } catch (e) {
      console.error('Caricamento non riuscito', e);
      return null;
    }
  }

  static clearSave(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignora */
    }
  }

  /** Riepilogo mostrato nella schermata di continuazione. */
  summary(): { name: string; time: string; dex: number; badges: number } {
    return {
      name: this.playerName,
      time: this.playTimeText(),
      dex: this.caught.size,
      badges: this.hasFlag('spilla_bosco') ? 1 : 0,
    };
  }
}

/** Istanza attiva (singleton pratico per le scene). */
export let state = new GameState();

export function setState(s: GameState): void {
  state = s;
}

/** Accesso dinamico allo stato corrente (l'istanza cambia a ogni nuova partita). */
export function getState(): GameState {
  return state;
}

export function newGame(name = 'ALEX'): GameState {
  const s = new GameState();
  s.playerName = name;
  s.addItem('sfera', 5);
  s.addItem('pozione', 3);
  s.addItem('mappa', 1);
  setState(s);
  return s;
}
