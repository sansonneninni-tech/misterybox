/** Scena di combattimento a turni. */

import { SCREEN_H, SCREEN_W } from '../engine/const';
import type { Renderer } from '../engine/renderer';
import { rng } from '../engine/rng';
import { Scene } from '../engine/scene';
import { audio } from '../engine/audio';
import { getItem } from '../data/items';
import { getMove } from '../data/moves';
import { getSpecies } from '../data/species';
import { getTrainer } from '../data/trainers';
import { effectivenessText } from '../data/types';
import { TYPE_COLORS } from '../gfx/palette';
import { creatureSprite } from '../gfx/creatures';
import { getCharacter } from '../gfx/chars';
import { drawText, drawTextCentered, drawTextRight, textWidth } from '../gfx/font';
import { PAL } from '../gfx/palette';
import { ballSprite, drawBar, drawMenuItem, drawTag, drawWindow, hpColor, menuCursor, WIN_BLUE, WIN_STYLE } from '../gfx/ui';
import { Creature } from '../state/creature';
import { state } from '../state/gameState';
import {
  applyStages, applyStatus, accuracyCheck, canEscape, chooseAiMove, Combatant, computeDamage,
  endTurnStatus, expGain, makeCombatant, movesFirst, preMoveStatus, statusShort, tryCatch,
} from '../systems/battle';
import { Textbox } from '../ui/textbox';
import { BagScene } from './bag';
import { PartyScene } from './party';

export interface BattleOutcome {
  result: 'win' | 'lose' | 'run' | 'caught';
}

export type BattleConfig =
  | { kind: 'wild'; wild: Creature }
  | { kind: 'trainer'; trainerId: string };

type Flow = Generator<void, void, void>;

const FOE_X = 152;
const FOE_Y = 6;
const PLY_X = 22;
const PLY_Y = 50;

export class BattleScene extends Scene {
  override opaque = true;
  override blocksUpdate = true;

  private cfg: BattleConfig;
  private onEnd: (o: BattleOutcome) => void;
  private flow: Flow | null = null;
  private box = new Textbox();

  private player!: Combatant;
  private foe!: Combatant;
  private foeTeam: Creature[] = [];
  private foeIndex = 0;
  private trainerName = '';
  private trainerTitle = '';

  // Interfaccia
  private mode: 'message' | 'action' | 'moves' | 'anim' = 'message';
  private actionIndex = 0;
  private moveIndex = 0;
  private runAttempts = 0;
  private outcome: BattleOutcome | null = null;

  // Animazione
  private hpShownPlayer = 0;
  private hpShownFoe = 0;
  private expShown = 0;
  private foeOffset = 0;
  private plyOffset = 0;
  private foeFlash = 0;
  private plyFlash = 0;
  private foeFaint = 0;
  private plyFaint = 0;
  private introT = 0;
  private ballAnim: { x: number; y: number; t: number; shakes: number; phase: string } | null = null;
  private shakeT = 0;
  private screenFlash = 0;

  constructor(cfg: BattleConfig, onEnd: (o: BattleOutcome) => void) {
    super();
    this.cfg = cfg;
    this.onEnd = onEnd;
  }

  override enter(): void {
    const lead = state.firstHealthy ?? state.party[0];
    if (!lead) {
      // Nessuna creatura: uscita immediata di sicurezza.
      this.outcome = { result: 'lose' };
      return;
    }
    this.player = makeCombatant(lead);
    if (this.cfg.kind === 'wild') {
      this.foeTeam = [this.cfg.wild];
      this.trainerName = '';
    } else {
      const t = getTrainer(this.cfg.trainerId);
      this.trainerName = t.name;
      this.trainerTitle = t.title;
      this.foeTeam = t.team.map((e) => {
        const c = new Creature(e.species, e.level, { trainer: t.name });
        if (e.moves?.length) {
          c.moves = e.moves.map((id) => {
            const m = getMove(id);
            return { id, pp: m.pp, maxPp: m.pp };
          });
        }
        return c;
      });
    }
    this.foeIndex = 0;
    this.foe = makeCombatant(this.foeTeam[0]);
    state.markSeen(this.foe.creature.species);
    this.hpShownPlayer = this.player.creature.hp;
    this.hpShownFoe = this.foe.creature.hp;
    this.expShown = this.player.creature.expProgress().ratio;
    audio.playMusic('battle');
    this.flow = this.run();
  }

  // --- ciclo --------------------------------------------------------------

  update(): void {
    this.introT++;
    if (this.foeFlash > 0) this.foeFlash--;
    if (this.plyFlash > 0) this.plyFlash--;
    if (this.shakeT > 0) this.shakeT--;
    if (this.screenFlash > 0) this.screenFlash--;
    this.hpShownPlayer = approach(this.hpShownPlayer, this.player?.creature.hp ?? 0, Math.max(0.6, (this.player?.creature.maxHp ?? 40) / 60));
    this.hpShownFoe = approach(this.hpShownFoe, this.foe?.creature.hp ?? 0, Math.max(0.6, (this.foe?.creature.maxHp ?? 40) / 60));

    if (this.outcome && !this.flow) {
      return;
    }
    if (this.flow) {
      const r = this.flow.next();
      if (r.done) {
        this.flow = null;
        this.finish();
      }
    }
  }

  private finish(): void {
    const result = this.outcome ?? { result: 'win' as const };
    for (const c of state.party) {
      c.sleepTurns = c.status === 'addormentato' ? c.sleepTurns : 0;
    }
    this.game.pop();
    this.onEnd(result);
  }

  // --- helper di flusso ---------------------------------------------------

  private *msg(lines: string[], opts: { wait?: boolean } = {}): Flow {
    this.mode = 'message';
    this.box.setText(lines);
    const wait = opts.wait !== false;
    while (!this.box.update(this.game.input)) {
      if (!wait && this.box.finished) break;
      yield;
    }
    yield;
  }

  /** Messaggio che scorre da solo dopo N frame (per le sequenze rapide). */
  private *autoMsg(lines: string[], frames = 46): Flow {
    this.mode = 'message';
    this.box.setText(lines);
    let t = 0;
    while (t < frames) {
      t++;
      if (this.box.update(this.game.input)) break;
      yield;
    }
  }

  private *wait(n: number): Flow {
    for (let i = 0; i < n; i++) yield;
  }

  private *waitHp(): Flow {
    let guard = 0;
    while (guard++ < 240 && (Math.abs(this.hpShownPlayer - this.player.creature.hp) > 0.5
      || Math.abs(this.hpShownFoe - this.foe.creature.hp) > 0.5)) {
      yield;
    }
  }

  // --- flusso principale --------------------------------------------------

  private *run(): Flow {
    yield* this.wait(24);
    if (this.cfg.kind === 'wild') {
      yield* this.autoMsg([`Un ${this.foe.creature.name} selvatico è apparso!`], 60);
    } else {
      yield* this.msg([`${this.trainerTitle} ${this.trainerName} ti sfida!`]);
      yield* this.autoMsg([`${this.trainerName} manda in campo ${this.foe.creature.name}!`], 50);
    }
    yield* this.autoMsg([`Vai, ${this.player.creature.name}!`], 40);

    while (!this.outcome) {
      yield* this.turn();
    }
    yield* this.wait(10);
  }

  private *turn(): Flow {
    // --- scelta del giocatore ---
    let playerMoveId: string | null = null;
    let playerAction: 'move' | 'item' | 'switch' | 'run' | null = null;
    let usedItem: string | null = null;

    while (playerAction === null) {
      const action = yield* this.chooseAction();
      if (action === 'lotta') {
        const mv = yield* this.chooseMove();
        if (mv) {
          playerMoveId = mv;
          playerAction = 'move';
        }
      } else if (action === 'borsa') {
        const chosen = yield* this.openBag();
        if (chosen) {
          usedItem = chosen;
          playerAction = 'item';
        }
      } else if (action === 'squadra') {
        const idx = yield* this.openParty();
        if (idx !== null) {
          const target = state.party[idx];
          if (target && !target.fainted && target !== this.player.creature) {
            yield* this.switchPlayer(idx);
            playerAction = 'switch';
          }
        }
      } else if (action === 'fuggi') {
        if (this.cfg.kind === 'trainer') {
          yield* this.msg(['Non puoi fuggire da una lotta tra allenatori!']);
          continue;
        }
        this.runAttempts++;
        if (canEscape(this.player, this.foe, this.runAttempts)) {
          audio.sfx('escape');
          yield* this.msg(['Sei fuggito senza problemi!']);
          this.outcome = { result: 'run' };
          return;
        }
        yield* this.msg(['Non sei riuscito a fuggire!']);
        playerAction = 'run';
      }
    }

    // --- scelta avversaria ---
    const foeMoveId = chooseAiMove(this.foe, this.player, this.cfg.kind === 'trainer');
    const foeMove = getMove(foeMoveId);
    const playerMove = playerMoveId ? getMove(playerMoveId) : null;

    const playerGoesFirst = playerAction !== 'move'
      ? true
      : movesFirst(this.player, playerMove, this.foe, foeMove);

    // --- esecuzione ---
    if (playerAction === 'item' && usedItem) {
      yield* this.useItem(usedItem);
      if (this.outcome) return;
    }

    const order: Array<'player' | 'foe'> = playerGoesFirst ? ['player', 'foe'] : ['foe', 'player'];
    for (const who of order) {
      if (this.outcome) return;
      if (who === 'player') {
        if (playerAction !== 'move' || !playerMoveId) continue;
        if (this.player.creature.fainted) continue;
        yield* this.performMove(this.player, this.foe, playerMoveId, true);
      } else {
        if (this.foe.creature.fainted) continue;
        yield* this.performMove(this.foe, this.player, foeMoveId, false);
      }
      if (this.foe.creature.fainted) {
        yield* this.onFoeFainted();
        if (this.outcome) return;
      }
      if (this.player.creature.fainted) {
        yield* this.onPlayerFainted();
        if (this.outcome) return;
      }
    }

    // --- fine turno ---
    for (const c of [this.player, this.foe]) {
      const msgs = endTurnStatus(c);
      for (const m of msgs) {
        (c === this.player ? (this.plyFlash = 8) : (this.foeFlash = 8));
        yield* this.autoMsg([m], 40);
        yield* this.waitHp();
      }
    }
    if (this.foe.creature.fainted) {
      yield* this.onFoeFainted();
      if (this.outcome) return;
    }
    if (this.player.creature.fainted) {
      yield* this.onPlayerFainted();
    }
  }

  // --- azioni -------------------------------------------------------------

  private *chooseAction(): Generator<void, string, void> {
    this.mode = 'action';
    this.box.setText([`Cosa deve fare ${this.player.creature.name}?`]);
    this.box.showInstant([`Cosa deve fare ${this.player.creature.name}?`]);
    const input = this.game.input;
    while (true) {
      // Un frame di attesa evita che la stessa pressione apra e confermi il menu.
      yield;
      if (input.repeat('left') && this.actionIndex % 2 === 1) { this.actionIndex--; audio.sfx('select'); }
      else if (input.repeat('right') && this.actionIndex % 2 === 0) { this.actionIndex++; audio.sfx('select'); }
      else if (input.repeat('up') && this.actionIndex >= 2) { this.actionIndex -= 2; audio.sfx('select'); }
      else if (input.repeat('down') && this.actionIndex < 2) { this.actionIndex += 2; audio.sfx('select'); }
      if (input.pressed('a')) {
        audio.sfx('select');
        return ['lotta', 'borsa', 'squadra', 'fuggi'][this.actionIndex];
      }
    }
  }

  private *chooseMove(): Generator<void, string | null, void> {
    this.mode = 'moves';
    const moves = this.player.creature.moves;
    if (this.moveIndex >= moves.length) this.moveIndex = 0;
    const input = this.game.input;
    while (true) {
      yield;
      const n = moves.length;
      if (input.repeat('left') && this.moveIndex % 2 === 1) { this.moveIndex--; audio.sfx('select'); }
      else if (input.repeat('right') && this.moveIndex % 2 === 0 && this.moveIndex + 1 < n) { this.moveIndex++; audio.sfx('select'); }
      else if (input.repeat('up') && this.moveIndex >= 2) { this.moveIndex -= 2; audio.sfx('select'); }
      else if (input.repeat('down') && this.moveIndex + 2 < n) { this.moveIndex += 2; audio.sfx('select'); }
      if (input.pressed('b')) {
        audio.sfx('cancel');
        return null;
      }
      if (input.pressed('a')) {
        const slot = moves[this.moveIndex];
        if (slot.pp <= 0) {
          yield* this.msg(['Non ci sono più PP per questa mossa!']);
          this.mode = 'moves';
          continue;
        }
        audio.sfx('select');
        return slot.id;
      }
    }
  }

  private *openBag(): Generator<void, string | null, void> {
    let closed = false;
    let chosen: string | null = null;
    this.game.push(new BagScene('battle', (id) => { chosen = id; closed = true; }));
    while (!closed) yield;
    return chosen;
  }

  private *openParty(): Generator<void, number | null, void> {
    let closed = false;
    let index: number | null = null;
    this.game.push(new PartyScene('battle', (i) => { index = i; closed = true; }));
    while (!closed) yield;
    return index;
  }

  private *switchPlayer(index: number): Flow {
    const next = state.party[index];
    yield* this.autoMsg([`Torna indietro, ${this.player.creature.name}!`], 34);
    this.player = makeCombatant(next);
    this.hpShownPlayer = next.hp;
    this.expShown = next.expProgress().ratio;
    this.plyOffset = -60;
    yield* this.autoMsg([`Vai, ${next.name}!`], 40);
    this.plyOffset = 0;
  }

  private *useItem(itemId: string): Flow {
    const item = getItem(itemId);
    const target = this.player.creature;
    if (item.ballRate) {
      if (this.cfg.kind === 'trainer') {
        yield* this.msg(['Non puoi catturare la creatura di un altro allenatore!']);
        return;
      }
      yield* this.throwBall(itemId);
      return;
    }
    state.removeItem(itemId, 1);
    yield* this.autoMsg([`${state.playerName} usa ${item.name}.`], 36);
    if (item.heal) {
      const healed = target.heal(item.heal);
      audio.sfx('heal');
      yield* this.waitHp();
      yield* this.autoMsg([`${target.name} recupera ${healed} PS!`], 40);
    } else if (item.cures?.length) {
      if (target.status && item.cures.includes(target.status)) {
        target.status = null;
        audio.sfx('heal');
        yield* this.autoMsg([`${target.name} è tornato normale!`], 40);
      } else {
        yield* this.autoMsg(['Non ha avuto effetto…'], 40);
      }
    }
  }

  private *throwBall(itemId: string): Flow {
    state.removeItem(itemId, 1);
    const item = getItem(itemId);
    yield* this.autoMsg([`${state.playerName} lancia ${item.name}!`], 30);
    audio.sfx('ball');
    this.ballAnim = { x: PLY_X + 20, y: PLY_Y + 10, t: 0, shakes: 0, phase: 'fly' };
    for (let i = 0; i < 26; i++) {
      const t = i / 26;
      this.ballAnim.x = PLY_X + 20 + (FOE_X + 20 - PLY_X - 20) * t;
      this.ballAnim.y = PLY_Y + 10 - Math.sin(t * Math.PI) * 46 + (FOE_Y + 20 - PLY_Y - 10) * t;
      this.ballAnim.t = i;
      yield;
    }
    this.ballAnim.phase = 'suck';
    this.foeFaint = 1;
    yield* this.wait(18);
    const res = tryCatch(this.foe.creature, itemId);
    this.ballAnim.phase = 'shake';
    for (let s = 0; s < Math.max(1, res.shakes); s++) {
      this.ballAnim.shakes = s + 1;
      audio.sfx('select');
      yield* this.wait(26);
    }
    if (res.caught) {
      audio.sfx('catch');
      this.ballAnim.phase = 'caught';
      yield* this.wait(30);
      const c = this.foe.creature;
      yield* this.msg([`Preso! ${c.name} è stato catturato!`]);
      const dest = state.addCreature(c);
      if (dest === 'box') {
        yield* this.msg([`${c.name} è stato trasferito nel deposito.`]);
      }
      if (!state.hasFlag(`dex_${c.species}`)) {
        state.setFlag(`dex_${c.species}`);
        yield* this.msg([`I dati di ${c.name} sono stati registrati nel Verdex.`]);
      }
      this.outcome = { result: 'caught' };
      return;
    }
    this.ballAnim = null;
    this.foeFaint = 0;
    audio.sfx('escape');
    const lines = res.shakes === 0
      ? ['Oh no! La creatura è uscita subito!']
      : res.shakes === 1
        ? ['Accidenti! Per un pelo!']
        : res.shakes === 2
          ? ['Ci sei quasi riuscito!']
          : ['Ah! Mancava pochissimo!'];
    yield* this.autoMsg(lines, 44);
  }

  // --- esecuzione mosse ---------------------------------------------------

  private *performMove(attacker: Combatant, defender: Combatant, moveId: string, isPlayer: boolean): Flow {
    const move = getMove(moveId);
    const check = preMoveStatus(attacker);
    for (const m of check.messages) yield* this.autoMsg([m], 40);
    if (!check.canAct) return;

    const slot = attacker.creature.moves.find((s) => s.id === moveId);
    if (slot) slot.pp = Math.max(0, slot.pp - 1);

    const who = isPlayer ? attacker.creature.name : `${this.cfg.kind === 'trainer' ? '' : 'Il '}${attacker.creature.name}${this.cfg.kind === 'trainer' ? ' avversario' : ' selvatico'}`;
    yield* this.autoMsg([`${who} usa ${move.name}!`], 36);

    if (!accuracyCheck(attacker, defender, move)) {
      yield* this.autoMsg(['Ma ha fallito!'], 40);
      return;
    }

    // Animazione di attacco
    yield* this.attackAnim(isPlayer);

    if (move.category === 'stato') {
      yield* this.applyMoveEffects(attacker, defender, move, 0);
      return;
    }

    const hits = move.effect?.multiHit ? rng.int(move.effect.multiHit[0], move.effect.multiHit[1]) : 1;
    let total = 0;
    let lastEff = 1;
    let crit = false;
    for (let i = 0; i < hits; i++) {
      const res = computeDamage(attacker, defender, move);
      lastEff = res.effectiveness;
      if (res.effectiveness === 0) break;
      crit = crit || res.critical;
      defender.creature.damage(res.damage);
      total += res.damage;
      if (isPlayer) this.foeFlash = 12; else this.plyFlash = 12;
      this.shakeT = res.effectiveness >= 2 ? 14 : 8;
      audio.sfx(res.effectiveness >= 2 ? 'supereffective' : 'hit');
      yield* this.wait(12);
      if (defender.creature.fainted) break;
    }
    attacker.lastDamage = total;

    yield* this.waitHp();
    if (lastEff === 0) {
      yield* this.autoMsg([`Non ha alcun effetto su ${defender.creature.name}…`], 44);
      return;
    }
    if (crit) yield* this.autoMsg(['Brutto colpo!'], 34);
    if (hits > 1) yield* this.autoMsg([`Colpito ${hits} volte!`], 34);
    const effText = effectivenessText(lastEff);
    if (effText) yield* this.autoMsg([effText], 40);

    yield* this.applyMoveEffects(attacker, defender, move, total);
  }

  private *applyMoveEffects(attacker: Combatant, defender: Combatant, move: ReturnType<typeof getMove>, damage: number): Flow {
    const fx = move.effect;
    if (!fx) return;

    if (fx.heal) {
      const amount = Math.floor(attacker.creature.maxHp * fx.heal);
      const healed = attacker.creature.heal(amount);
      audio.sfx('heal');
      yield* this.waitHp();
      yield* this.autoMsg([`${attacker.creature.name} recupera ${healed} PS!`], 40);
    }
    if (fx.drain && damage > 0) {
      const healed = attacker.creature.heal(Math.max(1, Math.floor(damage * fx.drain)));
      audio.sfx('heal');
      yield* this.waitHp();
      yield* this.autoMsg([`${attacker.creature.name} assorbe ${healed} PS!`], 40);
    }
    if (fx.recoil && damage > 0) {
      const hurt = Math.max(1, Math.floor(damage * fx.recoil));
      attacker.creature.damage(hurt);
      yield* this.waitHp();
      yield* this.autoMsg([`${attacker.creature.name} subisce il contraccolpo!`], 40);
    }
    if (fx.flee && this.cfg.kind === 'wild') {
      yield* this.autoMsg([`${defender.creature.name} è scappato!`], 44);
      this.outcome = { result: 'run' };
      return;
    }

    const chance = fx.chance ?? 1;
    if (fx.status && rng.chance(chance) && !defender.creature.fainted) {
      const m = applyStatus(defender, fx.status);
      if (m) yield* this.autoMsg([m], 44);
    }
    if (fx.statSelf && rng.chance(chance)) {
      for (const m of applyStages(attacker, fx.statSelf)) yield* this.autoMsg([m], 40);
    }
    if (fx.statFoe && rng.chance(chance) && !defender.creature.fainted) {
      for (const m of applyStages(defender, fx.statFoe)) yield* this.autoMsg([m], 40);
    }
  }

  private *attackAnim(isPlayer: boolean): Flow {
    const dir = isPlayer ? 1 : -1;
    for (let i = 0; i < 8; i++) {
      if (isPlayer) this.plyOffset = i * 2 * dir;
      else this.foeOffset = i * 2 * dir;
      yield;
    }
    for (let i = 8; i >= 0; i--) {
      if (isPlayer) this.plyOffset = i * 2 * dir;
      else this.foeOffset = i * 2 * dir;
      yield;
    }
    this.plyOffset = 0;
    this.foeOffset = 0;
    this.screenFlash = 4;
  }

  // --- esiti --------------------------------------------------------------

  private *onFoeFainted(): Flow {
    audio.sfx('faint');
    for (let i = 0; i < 24; i++) {
      this.foeFaint = i / 24;
      yield;
    }
    this.foeFaint = 1;
    const label = this.cfg.kind === 'wild'
      ? `Il ${this.foe.creature.name} selvatico è esausto!`
      : `${this.foe.creature.name} di ${this.trainerName} è esausto!`;
    yield* this.msg([label]);

    // Esperienza a tutta la squadra che ha partecipato (semplificato: il capo).
    const gain = expGain(this.foe.creature, this.cfg.kind === 'trainer');
    const mon = this.player.creature;
    if (!mon.fainted) {
      const before = mon.expProgress().ratio;
      this.expShown = before;
      const res = mon.gainExp(gain);
      yield* this.autoMsg([`${mon.name} guadagna ${gain} punti esperienza!`], 46);
      yield* this.animateExp();
      for (let i = 0; i < res.levels; i++) {
        audio.sfx('levelup');
        this.screenFlash = 10;
        yield* this.msg([`${mon.name} sale al livello ${mon.level - res.levels + i + 1}!`]);
      }
      for (const mv of res.newMoves) {
        const move = getMove(mv);
        if (mon.moves.length < 4) {
          mon.learnMove(mv);
          yield* this.msg([`${mon.name} impara ${move.name}!`]);
        } else {
          yield* this.msg([
            `${mon.name} vuole imparare ${move.name}.`,
            `Ma conosce già 4 mosse: ${move.name} non è stata imparata.`,
          ]);
        }
      }
      const evo = mon.pendingEvolution();
      if (evo && res.levels > 0) {
        const oldName = mon.name;
        yield* this.msg([`Che succede? ${oldName} sta cambiando!`]);
        this.screenFlash = 30;
        yield* this.wait(30);
        mon.evolveTo(evo);
        state.caught.add(evo);
        state.seen.add(evo);
        audio.sfx('levelup');
        yield* this.msg([`${oldName} si è evoluto in ${getSpecies(evo).name}!`]);
      }
    }

    // Prossimo avversario o vittoria.
    if (this.foeIndex + 1 < this.foeTeam.length) {
      this.foeIndex++;
      yield* this.msg([`${this.trainerName} manda in campo ${this.foeTeam[this.foeIndex].name}!`]);
      this.foe = makeCombatant(this.foeTeam[this.foeIndex]);
      state.markSeen(this.foe.creature.species);
      this.hpShownFoe = this.foe.creature.hp;
      this.foeFaint = 0;
      this.foeOffset = 0;
      return;
    }
    audio.playMusic('victory');
    if (this.cfg.kind === 'trainer') {
      yield* this.msg([`${this.trainerTitle} ${this.trainerName} è stato sconfitto!`]);
    }
    this.outcome = { result: 'win' };
  }

  private *animateExp(): Flow {
    const target = this.player.creature.expProgress().ratio;
    let guard = 0;
    while (guard++ < 120) {
      if (this.expShown > target + 0.001 && guard < 60) this.expShown = 1;
      this.expShown = approach(this.expShown, target, 0.02);
      if (Math.abs(this.expShown - target) < 0.01) break;
      yield;
    }
    this.expShown = target;
  }

  private *onPlayerFainted(): Flow {
    audio.sfx('faint');
    for (let i = 0; i < 24; i++) {
      this.plyFaint = i / 24;
      yield;
    }
    this.plyFaint = 1;
    yield* this.msg([`${this.player.creature.name} è esausto!`]);
    if (state.party.some((c) => !c.fainted)) {
      let index: number | null = null;
      while (index === null) {
        const chosen = yield* this.openParty();
        if (chosen !== null && state.party[chosen] && !state.party[chosen].fainted) index = chosen;
      }
      this.player = makeCombatant(state.party[index]);
      this.hpShownPlayer = this.player.creature.hp;
      this.expShown = this.player.creature.expProgress().ratio;
      this.plyFaint = 0;
      yield* this.autoMsg([`Vai, ${this.player.creature.name}!`], 40);
      return;
    }
    yield* this.msg([`${state.playerName} non ha più creature in grado di lottare!`]);
    this.outcome = { result: 'lose' };
  }

  // --- disegno ------------------------------------------------------------

  render(r: Renderer): void {
    const g = r.ctx;
    const shake = this.shakeT > 0 ? (this.shakeT % 2 === 0 ? 1 : -1) * 2 : 0;

    this.drawBackground(r);

    g.save();
    g.translate(shake, 0);

    // Creatura avversaria
    if (this.foe) {
      const sp = getSpecies(this.foe.creature.species);
      const img = creatureSprite(sp.id, sp.look, false);
      const introSlide = Math.max(0, 1 - this.introT / 30);
      const fx = FOE_X + this.foeOffset + introSlide * 90;
      const fy = FOE_Y + this.foeFaint * 30;
      g.save();
      g.globalAlpha = 1 - this.foeFaint * 0.9;
      if (this.foeFlash > 0 && this.foeFlash % 4 < 2) g.globalAlpha *= 0.35;
      if (this.ballAnim && (this.ballAnim.phase === 'suck' || this.ballAnim.phase === 'shake' || this.ballAnim.phase === 'caught')) {
        g.globalAlpha = 0;
      }
      g.drawImage(img, Math.round(fx), Math.round(fy));
      g.restore();
    }

    // Creatura del giocatore
    if (this.player) {
      const sp = getSpecies(this.player.creature.species);
      const img = creatureSprite(sp.id, sp.look, true);
      const introSlide = Math.max(0, 1 - this.introT / 30);
      const px = PLY_X + this.plyOffset - introSlide * 90;
      const py = PLY_Y + this.plyFaint * 30;
      g.save();
      g.globalAlpha = 1 - this.plyFaint * 0.9;
      if (this.plyFlash > 0 && this.plyFlash % 4 < 2) g.globalAlpha *= 0.35;
      g.drawImage(img, Math.round(px), Math.round(py));
      g.restore();
      // Allenatore che lancia all'inizio dello scontro.
      if (this.introT < 26) {
        const hero = getCharacter('hero').up[this.introT % 24 < 12 ? 0 : 1];
        g.save();
        g.imageSmoothingEnabled = false;
        const hx = 6 - Math.max(0, 26 - this.introT) * 2;
        g.drawImage(hero, 0, 0, 16, 24, hx, 74, 32, 48);
        g.restore();
      }
    }

    // Sfera di cattura
    if (this.ballAnim) this.drawBall(r);

    g.restore();

    // Interfaccia
    if (this.foe) this.drawFoeBox(r);
    if (this.player) this.drawPlayerBox(r);

    if (this.mode === 'action') this.drawActionMenu(r);
    else if (this.mode === 'moves') this.drawMoveMenu(r);
    else this.box.render(r);

    if (this.screenFlash > 0) {
      r.veil('#ffffff', Math.min(0.6, this.screenFlash / 20));
    }
  }

  private drawBackground(r: Renderer): void {
    const g = r.ctx;
    // Cielo sfumato a bande.
    const bands = ['#7fc8e8', '#8fd2ec', '#a3dcf0', '#b8e6f4'];
    for (let i = 0; i < bands.length; i++) {
      g.fillStyle = bands[i];
      g.fillRect(0, i * 14, SCREEN_W, 14);
    }
    g.fillStyle = '#c8eef8';
    g.fillRect(0, 56, SCREEN_W, 20);
    // Colline sullo sfondo.
    g.fillStyle = '#6aab5a';
    for (let x = 0; x < SCREEN_W; x++) {
      const h = 10 + Math.round(Math.sin(x / 28) * 5 + Math.sin(x / 9) * 2);
      g.fillRect(x, 76 - h, 1, h + 4);
    }
    // Terreno.
    g.fillStyle = '#7cbf62';
    g.fillRect(0, 80, SCREEN_W, SCREEN_H - 80);
    g.fillStyle = '#68ad50';
    for (let y = 80; y < SCREEN_H; y += 4) g.fillRect(0, y, SCREEN_W, 1);

    // Piattaforme.
    this.platform(g, FOE_X + 28, FOE_Y + 56, 40, 10, '#8fd06a', '#5f9a45');
    this.platform(g, PLY_X + 28, PLY_Y + 58, 52, 12, '#8fd06a', '#5f9a45');
  }

  private platform(
    g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number,
    top: string, side: string,
  ): void {
    for (let y = -ry; y <= ry; y++) {
      const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)));
      g.fillStyle = y > ry * 0.1 ? side : top;
      g.fillRect(cx - w, cy + y, w * 2, 1);
    }
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(cx - rx + 6, cy - ry + 1, rx, 1);
  }

  private drawFoeBox(r: Renderer): void {
    const g = r.ctx;
    const c = this.foe.creature;
    const x = 6;
    const y = 8;
    const w = 116;
    drawWindow(g, x, y, w, 32, WIN_BLUE);
    drawText(g, c.name, x + 8, y + 4, { color: PAL.uiText, shadow: PAL.uiTextShadow });
    drawTextRight(g, `Lv${c.level}`, x + w - 8, y + 4, { color: PAL.uiText, shadow: PAL.uiTextShadow });
    drawText(g, 'PS', x + 8, y + 17, { color: '#c8a020', shadow: null });
    drawBar(g, x + 22, y + 20, 78, this.hpShownFoe / c.maxHp, hpColor(this.hpShownFoe / c.maxHp), { height: 4 });
    const st = statusShort(c);
    if (st) drawTag(g, st, x + 8, y + 22, '#8a4fa8');
  }

  private drawPlayerBox(r: Renderer): void {
    const g = r.ctx;
    const c = this.player.creature;
    const x = SCREEN_W - 122;
    const y = 66;
    const w = 116;
    drawWindow(g, x, y, w, 42, WIN_BLUE);
    drawText(g, c.name, x + 8, y + 4, { color: PAL.uiText, shadow: PAL.uiTextShadow });
    drawTextRight(g, `Lv${c.level}`, x + w - 8, y + 4, { color: PAL.uiText, shadow: PAL.uiTextShadow });
    drawText(g, 'PS', x + 8, y + 17, { color: '#c8a020', shadow: null });
    drawBar(g, x + 22, y + 20, 78, this.hpShownPlayer / c.maxHp, hpColor(this.hpShownPlayer / c.maxHp), { height: 4 });
    drawTextRight(g, `${Math.ceil(this.hpShownPlayer)}/${c.maxHp}`, x + w - 8, y + 28, {
      color: PAL.uiText, shadow: PAL.uiTextShadow,
    });
    drawBar(g, x + 8, y + 38, w - 16, this.expShown, PAL.xpBlue, { height: 2, frame: false, bg: '#8a94a8' });
    const st = statusShort(c);
    if (st) drawTag(g, st, x + 8, y + 26, '#8a4fa8');
  }

  private drawActionMenu(r: Renderer): void {
    const g = r.ctx;
    drawWindow(g, 6, 112, 118, 44, WIN_STYLE);
    drawText(g, 'Cosa deve fare', 16, 122, { color: PAL.uiText, shadow: PAL.uiTextShadow });
    drawText(g, `${this.player.creature.name}?`, 16, 136, { color: PAL.uiText, shadow: PAL.uiTextShadow });

    drawWindow(g, 128, 112, 106, 44, WIN_STYLE);
    const labels = ['LOTTA', 'BORSA', 'SQUADRA', 'FUGGI'];
    for (let i = 0; i < 4; i++) {
      const cx = 128 + 14 + (i % 2) * 48;
      const cy = 112 + 8 + Math.floor(i / 2) * 16;
      drawMenuItem(g, labels[i], cx, cy, i === this.actionIndex);
    }
  }

  private drawMoveMenu(r: Renderer): void {
    const g = r.ctx;
    const moves = this.player.creature.moves;
    drawWindow(g, 6, 112, 156, 44, WIN_STYLE);
    for (let i = 0; i < moves.length; i++) {
      const move = getMove(moves[i].id);
      const cx = 6 + 16 + (i % 2) * 72;
      const cy = 112 + 8 + Math.floor(i / 2) * 16;
      const disabled = moves[i].pp <= 0;
      drawMenuItem(g, move.name, cx, cy, i === this.moveIndex, { disabled });
    }
    // Dettagli della mossa selezionata.
    drawWindow(g, 164, 112, 70, 44, WIN_STYLE);
    const sel = moves[this.moveIndex];
    if (sel) {
      const move = getMove(sel.id);
      drawText(g, `PP ${sel.pp}/${sel.maxPp}`, 172, 118, { color: PAL.uiText, shadow: PAL.uiTextShadow });
      drawTag(g, move.type.toUpperCase().slice(0, 6), 172, 132, TYPE_COLORS[move.type] ?? '#888');
    }
  }

  private drawBall(r: Renderer): void {
    const g = r.ctx;
    const b = this.ballAnim!;
    let x = b.x;
    let y = b.y;
    let frame = 0;
    if (b.phase === 'shake') {
      const t = (this.game.frame % 26) / 26;
      x = FOE_X + 20 + Math.sin(t * Math.PI * 2) * 5;
      y = FOE_Y + 40;
      frame = 1;
    } else if (b.phase === 'suck') {
      x = FOE_X + 20;
      y = FOE_Y + 40;
      frame = 1;
    } else if (b.phase === 'caught') {
      x = FOE_X + 20;
      y = FOE_Y + 40;
      frame = 0;
      g.save();
      g.globalAlpha = 0.6;
      g.fillStyle = '#ffe08a';
      g.fillRect(Math.round(x) - 6, Math.round(y) - 6, 22, 22);
      g.restore();
    }
    g.drawImage(ballSprite(frame), Math.round(x), Math.round(y));
  }
}

function approach(current: number, target: number, speed: number): number {
  if (current < target) return Math.min(target, current + speed);
  if (current > target) return Math.max(target, current - speed);
  return target;
}

/** Riquadro riassuntivo usato anche altrove. */
export function drawCreatureRow(
  g: CanvasRenderingContext2D,
  c: Creature,
  x: number,
  y: number,
  selected: boolean,
): void {
  if (selected) g.drawImage(menuCursor(), x - 8, y + 4);
  drawText(g, c.name, x, y, { color: PAL.uiText, shadow: PAL.uiTextShadow });
  drawText(g, `Lv${c.level}`, x + 78, y, { color: PAL.uiText, shadow: PAL.uiTextShadow });
  drawBar(g, x, y + 12, 60, c.hpRatio, hpColor(c.hpRatio), { height: 3 });
  drawTextCentered(g, `${c.hp}/${c.maxHp}`, x + 92, y + 10, { color: PAL.uiText, shadow: PAL.uiTextShadow });
}

export function measureName(c: Creature): number {
  return textWidth(c.name);
}
