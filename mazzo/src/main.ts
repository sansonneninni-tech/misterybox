/** Avvio: motore, scene, registro dei livelli. */

import { Audio } from './engine/audio';
import { Game } from './engine/game';
import { buildTouchControls, Input } from './engine/input';
import { Renderer } from './engine/renderer';
import type { Scene } from './engine/scene';
import { EndingScene } from './scenes/ending';
import { TitleScene } from './scenes/title';
import { makeScene, registerSceneFactory, WorldScene } from './scenes/world';
import { isSolid } from './gfx/tiles';
import { newGameState } from './systems/state';
import { barMap } from './world/maps/bar';
import { roomMap } from './world/maps/room';
import { streetMap } from './world/maps/street';

registerSceneFactory((level): Scene => {
  if (level === 'room') return new WorldScene(roomMap);
  if (level === 'bar') return new WorldScene(barMap);
  if (level === 'street') return new WorldScene(streetMap);
  return new EndingScene();
});

function boot(): void {
  const view = document.getElementById('screen') as HTMLCanvasElement | null;
  if (!view) throw new Error('Canvas non trovato');

  const renderer = new Renderer(view);
  const input = new Input();
  const audio = new Audio();
  const game = new Game(renderer, input, audio, newGameState());

  input.attach();
  buildTouchControls(input, document.body);
  input.onRawKey((code) => {
    if (code === 'KeyM') audio.toggleMute();
  });

  // Scorciatoia di sviluppo: #bar o #street per aprire un livello a parte.
  const jump = location.hash.replace('#', '');
  if (jump === 'room' || jump === 'bar' || jump === 'street') {
    game.setScene(makeScene(jump));
    game.fadeIn(0.5);
  } else {
    game.setScene(new TitleScene());
  }
  game.start();

  // I browser accendono l'audio solo dopo un gesto dell'utente.
  const unlock = () => audio.unlock();
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });

  // Utile ai test automatici: permette di osservare lo stato del gioco e di
  // sapere quali caselle sono attraversabili.
  (window as unknown as { MAZZO: unknown }).MAZZO = { game, input, audio, isSolid };
}

const start = document.getElementById('boot-start');
const bootScreen = document.getElementById('boot');
if (start && bootScreen) {
  start.addEventListener('click', () => {
    bootScreen.remove();
    boot();
  });
} else {
  boot();
}
