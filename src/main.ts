/** Punto di ingresso: avvio del motore, prima scena, gestione errori. */

import { audio } from './engine/audio';
import { Game } from './engine/game';
import { buildTouchControls } from './engine/input';
import { buildTileset } from './gfx/tiles';
import { TitleScene } from './scenes/title';
import { getState, GameState } from './state/gameState';
import type { Scene } from './engine/scene';
import type { WorldScene } from './scenes/world';
import { mapStats, validateMaps } from './world/validate';

declare global {
  interface Window {
    /** Esposto per i test automatici. */
    __verdania?: {
      game: Game;
      readonly state: GameState;
      readonly world: WorldScene | null;
      press: (btn: string, frames?: number) => void;
      errors: string[];
      validate: () => string[];
      mapStats: () => Array<{ id: string; w: number; h: number; npcs: number; warps: number; items: number }>;
    };
  }
}

function isWorld(s: Scene): s is WorldScene {
  return (s as WorldScene).player !== undefined && (s as WorldScene).map !== undefined;
}

function showFatal(message: string): void {
  const el = document.getElementById('fatal');
  if (!el) return;
  el.style.display = 'block';
  el.textContent = `Errore irreversibile:\n\n${message}`;
}

function boot(): void {
  const canvas = document.getElementById('screen') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('Canvas non trovato');

  buildTileset();

  const game = new Game(canvas);
  buildTouchControls(game.input, document.body);

  game.input.onRawKey((code) => {
    if (code === 'KeyM') {
      const on = audio.toggle();
      console.info(`[Verdania] Musica ${on ? 'attiva' : 'disattivata'}`);
    }
    if (code === 'KeyF') {
      const el = document.documentElement;
      if (!document.fullscreenElement) void el.requestFullscreen?.();
      else void document.exitFullscreen?.();
    }
  });

  game.push(new TitleScene());
  game.start();

  // Interfaccia per i test automatici.
  window.__verdania = {
    game,
    get state() { return getState(); },
    get world() { return game.find(isWorld) ?? null; },
    errors: game.errors,
    validate: validateMaps,
    mapStats,
    press: (btn: string, frames = 2) => {
      const b = btn as Parameters<typeof game.input.press>[0];
      game.input.press(b);
      window.setTimeout(() => game.input.release(b), Math.max(16, frames * 16));
    },
  };

  const bootEl = document.getElementById('boot');
  const startBtn = document.getElementById('boot-start');
  const begin = () => {
    audio.init();
    audio.resume();
    audio.playMusic('title', true);
    if (bootEl) bootEl.style.display = 'none';
    canvas.focus();
  };
  startBtn?.addEventListener('click', begin);
  window.addEventListener('keydown', (e) => {
    if (bootEl && bootEl.style.display !== 'none' && (e.code === 'Enter' || e.code === 'KeyZ' || e.code === 'Space')) {
      begin();
    }
  });
  // Sblocco audio al primo tocco/clic ovunque.
  const unlock = () => { audio.init(); audio.resume(); };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}

try {
  boot();
} catch (e) {
  const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
  showFatal(msg);
  console.error(e);
}

window.addEventListener('error', (e) => {
  console.error('[Verdania] errore runtime', e.error ?? e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[Verdania] promise non gestita', e.reason);
});
