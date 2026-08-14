/**
 * Stato del gioco: pochi flag, niente di generico. Se una cosa non serve alla
 * storia non sta qui.
 */

import type { Audio } from '../engine/audio';
import type { Game } from '../engine/game';
import type { Script } from './script';

export interface GameState {
  level1: {
    hasKeys: boolean;
    finished: boolean;
    /** Quante cose ha guardato prima di uscire: cambia una battuta. */
    examined: Set<string>;
  };
  level2: {
    /** Oggetto in mano: null, 'bicchiere', 'piatti', 'ordine'. */
    carrying: string | null;
    task1: boolean;
    task2: boolean;
    task3: boolean;
    messaged: boolean;
    finished: boolean;
  };
  level3: {
    receivedEnvelope: boolean;
    finished: boolean;
  };
}

export function newGameState(): GameState {
  return {
    level1: { hasKeys: false, finished: false, examined: new Set() },
    level2: { carrying: null, task1: false, task2: false, task3: false, messaged: false, finished: false },
    level3: { receivedEnvelope: false, finished: false },
  };
}

/** Quante mansioni del turno sono state completate. */
export function tasksDone(s: GameState): number {
  return Number(s.level2.task1) + Number(s.level2.task2) + Number(s.level2.task3);
}

/** Contesto passato agli script: tutto quello che una battuta puo' toccare. */
export interface Ctx {
  state: GameState;
  audio: Audio;
  game: Game;
  /** Obiettivo mostrato in alto a sinistra. */
  setObjective: (text: string) => void;
  /** Passa al livello successivo con dissolvenza. */
  goto: (level: 'room' | 'bar' | 'street' | 'ending') => void;
  /** Fa partire una scena parlata. */
  say: (script: Script, onEnd?: () => void) => void;
  /** Gira un personaggio verso Mazzo. */
  faceMazzo: (npcId: string) => void;
}
