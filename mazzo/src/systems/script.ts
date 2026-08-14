/**
 * Micro-linguaggio per le scene parlate. Bastano quattro istruzioni: dire una
 * frase, aspettare, eseguire un effetto, mostrare una scritta al centro.
 */

import type { Ctx } from './state';

export interface Say {
  say: string;
  /** Chi parla. Assente = pensiero di Mazzo. */
  who?: string;
}

export interface Wait {
  wait: number;
}

export interface Do {
  do: (ctx: Ctx) => void;
}

export interface Caption {
  /** Scritta grande al centro dello schermo (titoli, "FA CALDO."). */
  caption: string;
  hold?: number;
}

export type Step = string | Say | Wait | Do | Caption;
export type Script = Step[];

export function isSay(s: Step): s is Say | string {
  return typeof s === 'string' || 'say' in (s as Say);
}

export function sayText(s: Step): { text: string; who?: string } {
  if (typeof s === 'string') return { text: s };
  const say = s as Say;
  return say.who ? { text: say.say, who: say.who } : { text: say.say };
}
