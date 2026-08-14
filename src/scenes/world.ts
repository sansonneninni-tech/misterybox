/** Scena di esplorazione: mappa, giocatore, NPC, incontri, transizioni. */

import { SCREEN_H, SCREEN_W, TILE } from '../engine/const';
import type { Renderer } from '../engine/renderer';
import { rng } from '../engine/rng';
import { Scene } from '../engine/scene';
import { getItem } from '../data/items';
import { getSpecies } from '../data/species';
import { getTrainer } from '../data/trainers';
import { charShadow, Dir, getCharacter } from '../gfx/chars';
import { drawText, drawTextCentered, textWidth } from '../gfx/font';
import { PAL } from '../gfx/palette';
import { tileImage } from '../gfx/tiles';
import { drawWindow, itemIcon, WIN_STYLE } from '../gfx/ui';
import { Creature } from '../state/creature';
import { state } from '../state/gameState';
import { DIR_VEC, Entity, OPPOSITE } from '../entities/entity';
import { Npc } from '../entities/npc';
import {
  COLL_LEDGE_DOWN, COLL_LEDGE_LEFT, COLL_LEDGE_RIGHT, COLL_SOLID, RuntimeMap, splitTile,
} from '../world/map';
import { getMap, SHOP_STOCK } from '../world/maps';
import { DialogueScene } from './dialogue';
import { BattleScene, BattleOutcome } from './battle';
import { MenuScene } from './menu';
import { ShopScene } from './shop';
import { audio } from '../engine/audio';

type Script = Generator<void, void, void>;

export class WorldScene extends Scene {
  map!: RuntimeMap;
  player!: Entity;
  npcs: Npc[] = [];
  camX = 0;
  camY = 0;
  private script: Script | null = null;
  private banner = 0;
  private bannerText = '';
  private stepsSinceEncounter = 0;
  private pendingBattle: BattleOutcome | null = null;
  private grassFx: Array<{ x: number; y: number; t: number }> = [];

  constructor(private mapId: string, private startX: number, private startY: number, private startDir: Dir = 'down') {
    super();
  }

  override enter(): void {
    this.loadMap(this.mapId, this.startX, this.startY, this.startDir);
  }

  // --- caricamento mappa --------------------------------------------------

  loadMap(id: string, x: number, y: number, dir: Dir): void {
    this.map = getMap(id);
    state.mapId = id;
    this.player = new Entity(x, y, 'hero', dir);
    this.npcs = this.map.def.npcs
      .filter((n) => !this.isNpcRemoved(n.id))
      .map((n) => new Npc(n));
    for (const npc of this.npcs) {
      if (npc.def.trainer && state.hasFlag(`trainer_${npc.def.trainer}`)) npc.defeated = true;
    }
    state.x = x;
    state.y = y;
    state.dir = dir;
    this.updateCamera(true);
    if (this.map.def.outdoor) {
      this.bannerText = this.map.def.name;
      this.banner = 150;
    }
    audio.playMusic(this.map.def.music ?? 'town');
  }

  private isNpcRemoved(id: string): boolean {
    return state.hasFlag(`npc_via_${id}`);
  }

  // --- collisioni ---------------------------------------------------------

  private blocked = (x: number, y: number, self: Entity): boolean => {
    const c = this.map.at(x, y);
    if (c === COLL_SOLID) return true;
    if (c === COLL_LEDGE_DOWN || c === COLL_LEDGE_LEFT || c === COLL_LEDGE_RIGHT) return true;
    if (self !== this.player && this.player.tx === x && this.player.ty === y) return true;
    for (const npc of this.npcs) {
      if (npc === self) continue;
      if (npc.tx === x && npc.ty === y) return true;
    }
    return false;
  };

  npcAt(x: number, y: number): Npc | undefined {
    return this.npcs.find((n) => n.tx === x && n.ty === y);
  }

  // --- ciclo --------------------------------------------------------------

  update(): void {
    const active = this.game.current === this && !this.game.inTransition;
    state.playTime++;

    // Script (scene di intermezzo) sempre attivo.
    if (this.script) {
      const res = this.script.next();
      if (res.done) this.script = null;
    }

    for (const npc of this.npcs) {
      npc.frozen = !active || this.script !== null;
      npc.think(this.blocked);
      if (npc.emote > 0) npc.emote--;
    }

    for (const fx of this.grassFx) fx.t--;
    this.grassFx = this.grassFx.filter((f) => f.t > 0);

    this.player.update();
    if (this.player.consumeArrived()) this.onArrive();

    // Esito di una lotta selvatica (quelle con allenatore le gestisce lo script).
    if (this.pendingBattle && !this.script) {
      const outcome = this.takeBattleOutcome();
      if (outcome?.result === 'lose') this.runScript(this.blackoutScript());
      else audio.playMusic(this.map.def.music ?? 'town');
    }

    if (active && !this.script) {
      this.handleInput();
      this.checkTrainers();
    }

    this.updateCamera(false);
    if (this.banner > 0) this.banner--;
  }

  private handleInput(): void {
    const input = this.game.input;

    if (input.pressed('start')) {
      audio.sfx('select');
      this.game.push(new MenuScene());
      return;
    }

    if (!this.player.moving) {
      if (input.pressed('a')) {
        this.interact();
        return;
      }
      const dir = input.dir();
      if (dir) {
        const d = dir as Dir;
        if (this.player.dir !== d && this.player.turnDelay <= 0) {
          this.player.face(d);
          this.player.turnDelay = 4;
          state.dir = d;
          return;
        }
        if (this.player.turnDelay > 0) return;
        const v = DIR_VEC[d];
        const nx = this.player.tx + v.x;
        const ny = this.player.ty + v.y;
        const coll = this.map.at(nx, ny);

        // Salto dai dislivelli.
        const canJump =
          (coll === COLL_LEDGE_DOWN && d === 'down') ||
          (coll === COLL_LEDGE_LEFT && d === 'left') ||
          (coll === COLL_LEDGE_RIGHT && d === 'right');
        if (canJump) {
          const lx = this.player.tx + v.x * 2;
          const ly = this.player.ty + v.y * 2;
          if (!this.blocked(lx, ly, this.player)) {
            audio.sfx('jump');
            this.player.tryMove(d, this.blocked, { jump: true });
            return;
          }
        }

        // Passaggi condizionati da un progresso.
        const gate = this.map.gateAt(nx, ny);
        if (gate && !state.hasFlag(gate.flag)) {
          this.runScript(this.dialogueScript(gate.text));
          return;
        }

        // Blocco narrativo: non si esce dal borgo senza compagni.
        if (!state.starter && this.map.def.id === 'borgo_verzura' && ny <= 0) {
          this.runScript(this.dialogueScript([
            'Meglio non avventurarsi da soli.',
            'Il Professor Fioravanti ha detto di passare dal laboratorio!',
          ]));
          return;
        }

        const run = input.isDown('b');
        if (this.player.tryMove(d, this.blocked, { run })) {
          state.dir = d;
        }
      }
    }
  }

  private onArrive(): void {
    state.x = this.player.tx;
    state.y = this.player.ty;
    const { tx, ty } = this.player;

    // Warp
    const warp = this.map.warpAt(tx, ty);
    if (warp) {
      if (!warp.requireFacing || warp.requireFacing === this.player.dir) {
        this.doWarp(warp.to, warp.tx, warp.ty, warp.dir ?? this.player.dir, warp.kind ?? 'edge');
        return;
      }
    }

    // Oggetti a terra
    const item = this.map.def.items.find((i) => i.x === tx && i.y === ty && !state.hasFlag(i.flag));
    if (item) {
      this.pickupItem(item.flag, item.item, item.qty ?? 1);
      return;
    }

    // Erba alta (o grotta): effetto e possibile incontro
    if (this.map.tagAt(tx, ty) === 'tallgrass') {
      this.grassFx.push({ x: tx, y: ty, t: 16 });
      audio.sfx('grass');
      this.tryEncounter();
    } else if (this.map.def.encounters?.everywhere) {
      this.tryEncounter();
    }
    if (state.repelSteps > 0) state.repelSteps--;
  }

  private pickupItem(flag: string, itemId: string, qty: number): void {
    state.setFlag(flag);
    state.addItem(itemId, qty);
    const def = getItem(itemId);
    audio.sfx('item');
    this.runScript(this.dialogueScript([
      `${state.playerName} ha trovato ${qty > 1 ? `${qty} ` : ''}${def.name}!`,
    ]));
  }

  private tryEncounter(): void {
    const table = this.map.def.encounters;
    if (!table?.grass?.length) return;
    if (state.party.length === 0) return;
    if (state.repelSteps > 0) return;
    this.stepsSinceEncounter++;
    const rate = table.rate ?? 0.12;
    // Un minimo di passi tra un incontro e l'altro rende l'esplorazione respirabile.
    if (this.stepsSinceEncounter < 3) return;
    if (!rng.chance(rate)) return;
    this.stepsSinceEncounter = 0;

    const total = table.grass.reduce((n, e) => n + e.weight, 0);
    let roll = rng.next() * total;
    let chosen = table.grass[0];
    for (const e of table.grass) {
      roll -= e.weight;
      if (roll <= 0) {
        chosen = e;
        break;
      }
    }
    const level = rng.int(chosen.min, chosen.max);
    const wild = new Creature(chosen.species, level);
    state.markSeen(chosen.species);
    this.startBattle({ kind: 'wild', wild });
  }

  // --- battaglie ----------------------------------------------------------

  startBattle(opts: { kind: 'wild'; wild: Creature } | { kind: 'trainer'; trainer: string }): void {
    audio.stopMusic();
    this.game.startTransition('battle', () => {
      const scene = opts.kind === 'wild'
        ? new BattleScene({ kind: 'wild', wild: opts.wild }, (o) => { this.pendingBattle = o; })
        : new BattleScene({ kind: 'trainer', trainerId: opts.trainer }, (o) => { this.pendingBattle = o; });
      this.game.push(scene);
    }, { out: 46, in: 4 });
  }

  /** Consuma l'esito dell'ultima battaglia (usato dagli script). */
  takeBattleOutcome(): BattleOutcome | null {
    const o = this.pendingBattle;
    this.pendingBattle = null;
    return o;
  }

  private checkTrainers(): void {
    if (this.player.moving) return;
    for (const npc of this.npcs) {
      if (!npc.def.trainer || npc.defeated || npc.approaching) continue;
      if (state.hasFlag(`trainer_${npc.def.trainer}`)) {
        npc.defeated = true;
        continue;
      }
      if (npc.sees(this.player.tx, this.player.ty)) {
        this.runScript(this.trainerScript(npc));
        return;
      }
    }
  }

  // --- interazione --------------------------------------------------------

  /** Tile oltre i quali si puo' comunque parlare (banconi e sportelli). */
  private isCounter(x: number, y: number): boolean {
    const o = this.map.objectTile(x, y);
    if (!o) return false;
    const name = splitTile(o).name;
    return name === 'counter' || name === 'counterBall' || name === 'healMachine' || name === 'table';
  }

  private interact(): void {
    const { x, y } = this.player.facingTile();
    let npc = this.npcAt(x, y);
    // Oltre un bancone si parla con chi sta dall'altra parte.
    if (!npc && this.isCounter(x, y)) {
      const d = DIR_VEC[this.player.dir];
      npc = this.npcAt(x + d.x, y + d.y);
    }
    if (npc) {
      npc.faceTowards(this.player.tx, this.player.ty);
      this.runScript(this.npcScript(npc));
      return;
    }
    const sign = this.map.signAt(x, y);
    if (sign) {
      audio.sfx('select');
      this.runScript(this.dialogueScript(sign.text));
      return;
    }
    // Interazione con l'acqua e altri dettagli.
    const tag = this.map.tagAt(x, y);
    if (tag === 'water') {
      this.runScript(this.dialogueScript(['L’acqua è limpida e fredda.']));
    }
  }

  // --- script -------------------------------------------------------------

  runScript(s: Script): void {
    this.script = s;
  }

  private *dialogueScript(lines: string[], speaker?: string | null): Script {
    yield* this.waitDialogue(lines, speaker);
  }

  private *waitDialogue(lines: string[], speaker?: string | null, choices?: { label: string; value: string }[] | null): Generator<void, string | null, void> {
    let done = false;
    let choice: string | null = null;
    this.game.push(new DialogueScene({
      lines,
      speaker: speaker ?? null,
      choices: choices ?? null,
      onDone: (c) => { done = true; choice = c; },
    }));
    while (!done) yield;
    return choice;
  }

  private *waitFrames(n: number): Script {
    for (let i = 0; i < n; i++) yield;
  }

  private *npcScript(npc: Npc): Script {
    audio.sfx('select');
    if (npc.def.trainer && !npc.defeated && !state.hasFlag(`trainer_${npc.def.trainer}`)) {
      yield* this.trainerBattleScript(npc);
      return;
    }
    switch (npc.def.role) {
      case 'nurse':
        yield* this.nurseScript(npc);
        return;
      case 'healer':
        yield* this.healerScript(npc);
        return;
      case 'clerk':
        yield* this.clerkScript(npc);
        return;
      case 'professor':
        yield* this.professorScript(npc);
        return;
      default:
        break;
    }
    const done = npc.def.textAfter && state.hasFlag('starter_scelto');
    const lines = (done ? npc.def.textAfter : npc.def.text) ?? ['…'];
    yield* this.waitDialogue(lines, npc.def.name ?? null);
  }

  private *nurseScript(npc: Npc): Script {
    const choice = yield* this.waitDialogue(
      ['Benvenuto al Centro Cura!', 'Vuoi che rimetta in forma la tua squadra?'],
      npc.def.name ?? 'Infermiera',
      [{ label: 'Sì', value: 'si' }, { label: 'No', value: 'no' }],
    );
    if (choice !== 'si') {
      yield* this.waitDialogue(['Va bene. Torna quando vuoi!'], npc.def.name ?? 'Infermiera');
      return;
    }
    yield* this.waitDialogue(['Un attimo solo…'], npc.def.name ?? 'Infermiera');
    audio.sfx('heal');
    yield* this.waitFrames(80);
    state.healParty();
    state.setFlag(`riposo_${this.map.def.id}`);
    yield* this.waitDialogue([
      'Ecco fatto: la tua squadra è in perfetta forma!',
      'A presto!',
    ], npc.def.name ?? 'Infermiera');
  }

  private *healerScript(npc: Npc): Script {
    const choice = yield* this.waitDialogue(
      npc.def.text ?? ['Vuoi riposare qui?'],
      npc.def.name ?? null,
      [{ label: 'Riposa', value: 'si' }, { label: 'No', value: 'no' }],
    );
    if (choice !== 'si') return;
    audio.sfx('heal');
    yield* this.waitFrames(60);
    state.healParty();
    yield* this.waitDialogue(['Le tue creature si sono riposate!'], npc.def.name ?? null);
  }

  private *clerkScript(npc: Npc): Script {
    const stock = SHOP_STOCK[this.map.def.id] ?? SHOP_STOCK.negozio_borgo;
    const choice = yield* this.waitDialogue(
      ['Benvenuto! Cosa posso fare per te?'],
      npc.def.name ?? 'Commesso',
      [{ label: 'Compra', value: 'compra' }, { label: 'Vendi', value: 'vendi' }, { label: 'Esci', value: 'esci' }],
    );
    if (choice === 'esci' || choice === null) {
      yield* this.waitDialogue(['Torna a trovarci!'], npc.def.name ?? 'Commesso');
      return;
    }
    let closed = false;
    this.game.push(new ShopScene(stock, choice === 'vendi' ? 'sell' : 'buy', () => { closed = true; }));
    while (!closed) yield;
  }

  private *professorScript(npc: Npc): Script {
    const name = npc.def.name ?? 'Prof. Fioravanti';
    if (!state.starter) {
      yield* this.waitDialogue([
        `Ah, ${state.playerName}! Ti aspettavo.`,
        'Sto studiando le creature di Verdania, ma da solo non ce la faccio.',
        'Ho qui tre compagni di viaggio: scegline uno, sarà tuo.',
      ], name);
      yield* this.starterChoiceScript(name);
      return;
    }
    if (!state.hasFlag('verdex_spiegato')) {
      state.setFlag('verdex_spiegato');
      yield* this.waitDialogue([
        'Il Verdex registra ogni creatura che incontri.',
        'Attraversa l’erba alta a nord del borgo e comincia la tua ricerca!',
      ], name);
      return;
    }
    const p = state.dexProgress();
    yield* this.waitDialogue([
      `Finora hai visto ${p.seen} creature e ne hai catturate ${p.caught}.`,
      p.caught >= 8 ? 'Straordinario! Sei un vero ricercatore.' : 'Continua così: la regione è grande.',
    ], name);
  }

  private *starterChoiceScript(name: string): Script {
    const options = ['foglietta', 'braciolo', 'gocciolo'];
    while (!state.starter) {
      const choice = yield* this.waitDialogue(
        ['Quale ti ispira di più?'],
        name,
        [
          { label: 'Foglietta (Erba)', value: 'foglietta' },
          { label: 'Braciolo (Fuoco)', value: 'braciolo' },
          { label: 'Gocciolo (Acqua)', value: 'gocciolo' },
        ],
      );
      if (!choice || !options.includes(choice)) continue;
      const sp = getSpecies(choice);
      const confirm = yield* this.waitDialogue(
        [`${sp.name}, di tipo ${sp.types.join('/')}.`, `Vuoi davvero ${sp.name}?`],
        name,
        [{ label: 'Sì', value: 'si' }, { label: 'No', value: 'no' }],
      );
      if (confirm !== 'si') continue;

      const c = new Creature(choice, 5, { trainer: state.playerName });
      state.addCreature(c);
      state.starter = choice;
      state.setFlag('starter_scelto');
      audio.sfx('levelup');
      yield* this.waitDialogue([
        `${state.playerName} ha ricevuto ${sp.name}!`,
        'Trattalo bene: sarà il tuo primo compagno di viaggio.',
        'Ho messo qualche Sfera nella tua borsa. Buon viaggio!',
      ], name);
      state.addItem('sfera', 5);
    }
  }

  private *trainerScript(npc: Npc): Script {
    npc.approaching = true;
    npc.emote = 46;
    audio.sfx('alert');
    yield* this.waitFrames(46);
    // L'allenatore raggiunge il giocatore.
    let guard = 0;
    while (npc.distanceTo(this.player.tx, this.player.ty) > 1 && guard < 16) {
      guard++;
      npc.faceTowards(this.player.tx, this.player.ty);
      if (!npc.tryMove(npc.dir, this.blocked)) break;
      while (npc.moving) {
        npc.update();
        yield;
      }
    }
    npc.faceTowards(this.player.tx, this.player.ty);
    this.player.face(OPPOSITE[npc.dir]);
    yield* this.trainerBattleScript(npc);
    npc.approaching = false;
  }

  private *trainerBattleScript(npc: Npc): Script {
    const t = getTrainer(npc.def.trainer!);
    yield* this.waitDialogue(t.intro, `${t.title} ${t.name}`);
    this.startBattle({ kind: 'trainer', trainer: t.id });
    // Attende la fine della battaglia.
    let outcome: BattleOutcome | null = null;
    while (!outcome) {
      outcome = this.takeBattleOutcome();
      yield;
    }
    if (outcome.result === 'win') {
      npc.defeated = true;
      state.setFlag(`trainer_${t.id}`);
      const money = t.payout * (t.team[t.team.length - 1]?.level ?? 5);
      state.money += money;
      yield* this.waitDialogue([...t.defeat, `Hai ricevuto ${money} monete!`], `${t.title} ${t.name}`);
      yield* this.waitDialogue(t.after, `${t.title} ${t.name}`);
      if (t.id === 'guardiana_selva' && !state.hasFlag('spilla_bosco')) {
        state.setFlag('spilla_bosco');
        state.addItem('distintivo', 1);
        yield* this.waitDialogue([
          `${state.playerName} ha ricevuto la Spilla del Bosco!`,
          'Il sentiero verso est è ora libero.',
        ]);
      }
    } else if (outcome.result === 'lose') {
      yield* this.blackoutScript();
    }
  }

  private *blackoutScript(): Script {
    yield* this.waitDialogue([
      `${state.playerName} non ha più creature in grado di lottare…`,
      'Sei tornato al Centro Cura più vicino.',
    ]);
    state.healParty();
    const dest = this.respawnPoint();
    let done = false;
    this.game.startTransition('fade', () => {
      this.loadMap(dest.map, dest.x, dest.y, 'down');
    }, { done: () => { done = true; } });
    while (!done) yield;
  }

  private respawnPoint(): { map: string; x: number; y: number } {
    if (state.hasFlag('riposo_centro_porto')) return { map: 'centro_porto', x: 6, y: 6 };
    if (state.hasFlag('riposo_centro_borgo')) return { map: 'centro_borgo', x: 6, y: 6 };
    return { map: 'casa_giocatore', x: 5, y: 6 };
  }

  // --- warp ---------------------------------------------------------------

  doWarp(to: string, tx: number, ty: number, dir: Dir, kind: 'door' | 'edge' | 'stairs'): void {
    audio.sfx(kind === 'door' ? 'door' : 'step');
    this.game.startTransition(kind === 'door' ? 'door' : 'fade', () => {
      this.loadMap(to, tx, ty, dir);
      // Un passo di ingresso rende naturale l'arrivo dalle porte.
      if (kind === 'door' && dir === 'down') {
        this.player.tryMove('down', this.blocked);
      }
    }, { out: kind === 'door' ? 22 : 16, in: 18 });
  }

  // --- camera -------------------------------------------------------------

  private updateCamera(instant: boolean): void {
    const mapW = this.map.width * TILE;
    const mapH = this.map.height * TILE;
    let targetX = this.player.pixelX + TILE / 2 - SCREEN_W / 2;
    let targetY = this.player.pixelY + TILE / 2 - SCREEN_H / 2 + 4;
    if (mapW <= SCREEN_W) targetX = (mapW - SCREEN_W) / 2;
    else targetX = Math.max(0, Math.min(mapW - SCREEN_W, targetX));
    if (mapH <= SCREEN_H) targetY = (mapH - SCREEN_H) / 2;
    else targetY = Math.max(0, Math.min(mapH - SCREEN_H, targetY));
    if (instant) {
      this.camX = targetX;
      this.camY = targetY;
    } else {
      this.camX = targetX;
      this.camY = targetY;
    }
  }

  // --- disegno ------------------------------------------------------------

  render(r: Renderer): void {
    const g = r.ctx;
    const cx = Math.round(this.camX);
    const cy = Math.round(this.camY);
    const frame = this.game.frame;

    r.clear(this.map.def.edgeColor ?? '#101018');

    const x0 = Math.max(0, Math.floor(cx / TILE));
    const y0 = Math.max(0, Math.floor(cy / TILE));
    const x1 = Math.min(this.map.width - 1, Math.floor((cx + SCREEN_W) / TILE));
    const y1 = Math.min(this.map.height - 1, Math.floor((cy + SCREEN_H) / TILE));

    // Livello terreno + oggetti
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const sx = x * TILE - cx;
        const sy = y * TILE - cy;
        const gt = this.map.groundTile(x, y);
        if (gt) {
          const { name, variant } = splitTile(gt);
          g.drawImage(tileImage(name, x, y, frame, variant), sx, sy);
        }
        const ot = this.map.objectTile(x, y);
        if (ot) {
          const { name, variant } = splitTile(ot);
          g.drawImage(tileImage(name, x, y, frame, variant), sx, sy);
        }
      }
    }

    // Entita' ordinate per profondita'
    const drawables: Array<{ e: Entity; y: number }> = [
      { e: this.player, y: this.player.pixelY },
      ...this.npcs.map((n) => ({ e: n as Entity, y: n.pixelY })),
    ];
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) this.drawEntity(r, d.e, cx, cy);

    // Ciuffi d'erba sopra i piedi
    for (const d of drawables) {
      const tag = this.map.tagAt(d.e.tx, d.e.ty);
      if (tag === 'tallgrass' && !d.e.moving) {
        const sx = d.e.tx * TILE - cx;
        const sy = d.e.ty * TILE - cy;
        const img = tileImage('tallgrass', d.e.tx, d.e.ty, frame, null);
        g.drawImage(img, 0, 6, TILE, 10, sx, sy + 6, TILE, 10);
      }
    }

    // Livello sopra il giocatore
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const ot = this.map.overTile(x, y);
        if (!ot) continue;
        const { name, variant } = splitTile(ot);
        g.drawImage(tileImage(name, x, y, frame, variant), x * TILE - cx, y * TILE - cy);
      }
    }

    // Effetti erba calpestata
    for (const fx of this.grassFx) {
      const sx = fx.x * TILE - cx;
      const sy = fx.y * TILE - cy;
      const p = 1 - fx.t / 16;
      g.globalAlpha = 1 - p;
      g.fillStyle = '#8ad46a';
      const spread = Math.round(p * 6);
      g.fillRect(sx + 2 - spread, sy + 10, 3, 2);
      g.fillRect(sx + 11 + spread, sy + 10, 3, 2);
      g.globalAlpha = 1;
    }

    // Emote degli allenatori
    for (const npc of this.npcs) {
      if (npc.emote <= 0) continue;
      const sx = npc.pixelX - cx + 4;
      const sy = npc.pixelY - cy - 14;
      drawWindow(g, sx - 3, sy - 2, 12, 16, WIN_STYLE);
      drawText(g, '!', sx + 2, sy + 2, { color: '#d8342c', shadow: null });
    }

    if (this.banner > 0) this.drawBanner(r);
  }

  private drawEntity(r: Renderer, e: Entity, cx: number, cy: number): void {
    if (!e.visible) return;
    const sprites = getCharacter(e.sprite);
    const frames = sprites[e.dir];
    const img = frames[e.animFrame()];
    const sx = e.pixelX - cx;
    const sy = e.pixelY - cy - 8 + e.jumpOffset();
    // Ombra sempre presente: aiuta a "posare" il personaggio sul terreno.
    r.ctx.drawImage(charShadow(), sx + 2, e.pixelY - cy + 12);
    r.ctx.drawImage(img, sx, sy);
  }

  private drawBanner(r: Renderer): void {
    const g = r.ctx;
    const alpha = Math.min(1, this.banner / 30);
    const w = textWidth(this.bannerText) + 28;
    g.save();
    g.globalAlpha = alpha;
    drawWindow(g, 6, 6, w, 20, WIN_STYLE);
    drawTextCentered(g, this.bannerText, 6 + w / 2, 12, { color: PAL.uiText, shadow: PAL.uiTextShadow });
    g.restore();
  }
}

/** Disegna un'icona oggetto: usata anche dal menu del mondo. */
export function drawItemIcon(g: CanvasRenderingContext2D, kind: string, x: number, y: number): void {
  g.drawImage(itemIcon(kind), x, y);
}

/** Crea la scena del mondo dalla posizione salvata nello stato. */
export function createWorld(): WorldScene {
  return new WorldScene(state.mapId, state.x, state.y, state.dir);
}
