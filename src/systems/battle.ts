/** Logica di combattimento: danni, stati, cattura, intelligenza avversaria. */

import { getMove, Move, StatName, StatusName } from '../data/moves';
import { getItem } from '../data/items';
import { effectiveness } from '../data/types';
import { rng } from '../engine/rng';
import type { Creature } from '../state/creature';

export interface Stages {
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
  acc: number;
  eva: number;
}

export function newStages(): Stages {
  return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 };
}

export function stageMult(stage: number): number {
  const s = Math.max(-6, Math.min(6, stage));
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

export interface Combatant {
  creature: Creature;
  stages: Stages;
  /** Turni rimanenti di sonno. */
  sleep: number;
  /** Contatore usato dalle mosse a piu' colpi. */
  lastDamage: number;
}

export function makeCombatant(c: Creature): Combatant {
  return { creature: c, stages: newStages(), sleep: c.sleepTurns, lastDamage: 0 };
}

export interface DamageResult {
  damage: number;
  effectiveness: number;
  critical: boolean;
  missed: boolean;
}

function effStat(c: Combatant, key: StatName): number {
  const base = key === 'atk' ? c.creature.atk
    : key === 'def' ? c.creature.defense
    : key === 'spa' ? c.creature.spa
    : key === 'spd' ? c.creature.spd
    : c.creature.spe;
  let v = base * stageMult(c.stages[key]);
  if (key === 'atk' && c.creature.status === 'scottato') v *= 0.5;
  if (key === 'spe' && c.creature.status === 'paralizzato') v *= 0.5;
  return Math.max(1, Math.floor(v));
}

export function speedOf(c: Combatant): number {
  return effStat(c, 'spe');
}

/** Calcola il danno di una mossa. */
export function computeDamage(attacker: Combatant, defender: Combatant, move: Move): DamageResult {
  const eff = effectiveness(move.type, defender.creature.types);
  if (move.category === 'stato' || move.power <= 0) {
    return { damage: 0, effectiveness: 1, critical: false, missed: false };
  }
  if (eff === 0) {
    return { damage: 0, effectiveness: 0, critical: false, missed: false };
  }

  const critChance = move.effect?.highCrit ? 0.125 : 0.0625;
  const critical = rng.chance(critChance);
  const physical = move.category === 'fisico';
  const atk = effStat(attacker, physical ? 'atk' : 'spa');
  const def = effStat(defender, physical ? 'def' : 'spd');
  const level = attacker.creature.level;

  let base = Math.floor(Math.floor((Math.floor((2 * level) / 5 + 2) * move.power * atk) / def) / 50) + 2;
  const stab = attacker.creature.types.includes(move.type) ? 1.5 : 1;
  base *= stab;
  base *= eff;
  if (critical) base *= 1.75;
  base *= 0.85 + rng.next() * 0.15;
  const damage = Math.max(1, Math.floor(base));
  return { damage, effectiveness: eff, critical, missed: false };
}

/** Verifica se la mossa va a segno. */
export function accuracyCheck(attacker: Combatant, defender: Combatant, move: Move): boolean {
  if (move.accuracy >= 100) return true;
  const acc = move.accuracy * stageMult(attacker.stages.acc) / stageMult(defender.stages.eva);
  return rng.next() * 100 < acc;
}

/** Ordine di azione: priorita', poi velocita', poi caso. */
export function movesFirst(a: Combatant, aMove: Move | null, b: Combatant, bMove: Move | null): boolean {
  const pa = aMove?.priority ?? 0;
  const pb = bMove?.priority ?? 0;
  if (pa !== pb) return pa > pb;
  const sa = speedOf(a);
  const sb = speedOf(b);
  if (sa !== sb) return sa > sb;
  return rng.chance(0.5);
}

export interface StatusCheck {
  canAct: boolean;
  messages: string[];
}

/** Controlli di inizio turno (sonno, paralisi, gelo). */
export function preMoveStatus(c: Combatant): StatusCheck {
  const cr = c.creature;
  const msgs: string[] = [];
  switch (cr.status) {
    case 'addormentato':
      if (c.sleep > 0) {
        c.sleep--;
        cr.sleepTurns = c.sleep;
        msgs.push(`${cr.name} sta dormendo…`);
        return { canAct: false, messages: msgs };
      }
      cr.status = null;
      msgs.push(`${cr.name} si è svegliato!`);
      return { canAct: true, messages: msgs };
    case 'congelato':
      if (rng.chance(0.25)) {
        cr.status = null;
        msgs.push(`${cr.name} si è scongelato!`);
        return { canAct: true, messages: msgs };
      }
      msgs.push(`${cr.name} è congelato e non può muoversi!`);
      return { canAct: false, messages: msgs };
    case 'paralizzato':
      if (rng.chance(0.25)) {
        msgs.push(`${cr.name} è paralizzato e non riesce a muoversi!`);
        return { canAct: false, messages: msgs };
      }
      return { canAct: true, messages: msgs };
    default:
      return { canAct: true, messages: msgs };
  }
}

/** Danni da stato a fine turno. */
export function endTurnStatus(c: Combatant): string[] {
  const cr = c.creature;
  const msgs: string[] = [];
  if (cr.fainted) return msgs;
  if (cr.status === 'avvelenato') {
    const dmg = Math.max(1, Math.floor(cr.maxHp / 8));
    cr.damage(dmg);
    msgs.push(`${cr.name} soffre per il veleno!`);
  } else if (cr.status === 'scottato') {
    const dmg = Math.max(1, Math.floor(cr.maxHp / 16));
    cr.damage(dmg);
    msgs.push(`${cr.name} soffre per la scottatura!`);
  }
  return msgs;
}

export function applyStatus(target: Combatant, status: StatusName): string | null {
  const cr = target.creature;
  if (cr.status) return null;
  if (status === 'scottato' && cr.types.includes('fuoco')) return null;
  if (status === 'congelato' && cr.types.includes('ghiaccio')) return null;
  if (status === 'avvelenato' && cr.types.includes('veleno')) return null;
  cr.status = status;
  if (status === 'addormentato') {
    target.sleep = rng.int(1, 3);
    cr.sleepTurns = target.sleep;
  }
  const label: Record<StatusName, string> = {
    avvelenato: 'è stato avvelenato!',
    paralizzato: 'è paralizzato!',
    scottato: 'è stato scottato!',
    addormentato: 'si è addormentato!',
    congelato: 'è congelato!',
  };
  return `${cr.name} ${label[status]}`;
}

export function applyStages(target: Combatant, changes: Partial<Record<StatName, number>>): string[] {
  const msgs: string[] = [];
  for (const [k, v] of Object.entries(changes) as Array<[StatName, number]>) {
    const before = target.stages[k];
    target.stages[k] = Math.max(-6, Math.min(6, before + v));
    if (target.stages[k] === before) {
      msgs.push(`${target.creature.name}: ${statLabel(k)} non può cambiare oltre!`);
      continue;
    }
    const amount = Math.abs(v) >= 2 ? 'molto ' : '';
    msgs.push(
      v > 0
        ? `${target.creature.name}: ${statLabel(k)} ${amount}aumenta!`
        : `${target.creature.name}: ${statLabel(k)} ${amount}diminuisce!`,
    );
  }
  return msgs;
}

export function statLabel(k: StatName | 'acc' | 'eva'): string {
  switch (k) {
    case 'atk': return 'Attacco';
    case 'def': return 'Difesa';
    case 'spa': return 'Att. Sp.';
    case 'spd': return 'Dif. Sp.';
    case 'spe': return 'Velocità';
    case 'acc': return 'Precisione';
    case 'eva': return 'Elusione';
  }
}

export const STATUS_SHORT: Record<StatusName, string> = {
  avvelenato: 'VEL',
  paralizzato: 'PAR',
  scottato: 'SCO',
  addormentato: 'SON',
  congelato: 'GEL',
};

/** Esperienza guadagnata sconfiggendo un avversario. */
export function expGain(defeated: Creature, isTrainer: boolean): number {
  const base = defeated.def.baseExp;
  return Math.max(1, Math.floor((base * defeated.level * (isTrainer ? 1.5 : 1)) / 7));
}

/** Probabilita' di fuga da un incontro selvatico. */
export function canEscape(player: Combatant, foe: Combatant, attempts: number): boolean {
  const a = speedOf(player);
  const b = speedOf(foe);
  if (a >= b) return true;
  const odds = Math.floor((a * 32) / Math.max(1, Math.floor(b / 4))) + 30 * attempts;
  return rng.int(0, 255) < odds;
}

export interface CatchResult {
  caught: boolean;
  shakes: number;
}

/** Formula di cattura a 4 scosse. */
export function tryCatch(target: Creature, ballId: string): CatchResult {
  const ball = getItem(ballId);
  const ballRate = ball.ballRate ?? 1;
  let statusBonus = 1;
  if (target.status === 'addormentato' || target.status === 'congelato') statusBonus = 2;
  else if (target.status) statusBonus = 1.5;

  const maxHp = target.maxHp;
  const a = ((3 * maxHp - 2 * target.hp) * target.def.catchRate * ballRate * statusBonus) / (3 * maxHp);
  if (a >= 255) return { caught: true, shakes: 4 };
  const b = Math.floor(65536 / Math.pow(255 / a, 0.25));
  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    if (rng.int(0, 65535) < b) shakes++;
    else break;
  }
  return { caught: shakes >= 4, shakes };
}

/** Sceglie la mossa dell'avversario. */
export function chooseAiMove(self: Combatant, foe: Combatant, smart: boolean): string {
  const usable = self.creature.moves.filter((m) => m.pp > 0);
  if (usable.length === 0) return 'colpo';
  if (!smart) return rng.pick(usable).id;

  // Punteggio: efficacia di tipo, danno stimato, utilita' delle mosse di stato.
  let best = usable[0].id;
  let bestScore = -Infinity;
  for (const slot of usable) {
    const move = getMove(slot.id);
    let score: number;
    if (move.category === 'stato') {
      score = foe.creature.status || self.stages.atk >= 2 ? 8 : 26 + rng.int(0, 10);
      if (move.effect?.heal && self.creature.hpRatio > 0.6) score = 4;
      if (move.effect?.heal && self.creature.hpRatio < 0.4) score = 55;
    } else {
      const eff = effectiveness(move.type, foe.creature.types);
      const stab = self.creature.types.includes(move.type) ? 1.5 : 1;
      score = move.power * eff * stab * (move.accuracy / 100);
      if (eff === 0) score = -10;
    }
    score += rng.int(0, 8);
    if (score > bestScore) {
      bestScore = score;
      best = slot.id;
    }
  }
  return best;
}

/** Nome leggibile dello stato per l'interfaccia. */
export function statusShort(c: Creature): string | null {
  if (c.fainted) return 'KO';
  return c.status ? STATUS_SHORT[c.status] : null;
}
