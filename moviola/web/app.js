// MOVIOLA — guscio dell'applicazione: navigazione, pannello, barra di stato.

import { S, boot, on, clipSources, urlOf } from './state.js';
import { h, toast, isPhone, fill } from './ui/kit.js';
import { Player } from './engine/player.js';
import * as archivio from './ui/archivio.js';
import * as banco from './ui/banco.js';
import * as laboratorio from './ui/laboratorio.js';
import * as vivo from './ui/vivo.js';
import * as esporta from './ui/esporta.js';
import * as interlocutore from './ui/interlocutore.js';
import { pref } from './prefs.js';

const SCREENS = { archivio, banco, laboratorio, vivo, esporta };
const shell = document.getElementById('shell');
const main = document.getElementById('main');
const side = document.getElementById('side');
const status = document.getElementById('status');

export const app = {
  route: null,
  cleanup: null,
  player: null,
  go,
  side: { open: openSide, close: closeSide, toggle: () => (shell.dataset.side === 'open' ? closeSide() : openSide()) },
  status: setStatus,
};
window.__moviola = app;

/** Il lettore principale: un solo contesto WebGL, spostato tra le schermate. */
export function mainPlayer() {
  if (!app.player) {
    const canvas = h('canvas', { 'aria-label': 'Anteprima della clip' });
    app.player = new Player(canvas, { previewLong: isPhone() ? 640 : 960, onFrame: (p) => app.onFrame && app.onFrame(p) });
  }
  return app.player;
}

export async function syncPlayer() {
  const p = mainPlayer();
  if (!S.work) return p;
  await p.setClip(S.work, clipSources(S.work), urlOf);
  return p;
}

function go(route, opts = {}) {
  if (!SCREENS[route]) route = 'archivio';
  app.onFrame = null;
  if (app.cleanup) { try { app.cleanup(); } catch (e) { console.error(e); } app.cleanup = null; }
  if (app.player) app.player.pause();
  app.route = route;
  document.querySelectorAll('.nav__item').forEach((b) => b.setAttribute('aria-current', b.dataset.go === route ? 'page' : 'false'));
  fill(main);
  main.scrollTop = 0;
  const c = SCREENS[route].render(main, { app, opts });
  app.cleanup = typeof c === 'function' ? c : null;
  if (location.hash !== '#' + route) history.replaceState(null, '', '#' + route);
  setStatus();
}

function openSide() {
  shell.dataset.side = 'open';
  interlocutore.render(side, { app });
}
function closeSide() { shell.dataset.side = 'closed'; }

export function setStatus(extra) {
  const parts = [];
  if (S.store) parts.push(S.store.mode === 'server' ? 'archivio sul Mac' : S.store.volatile ? 'prova: niente resta salvato' : 'archivio nel browser (demo)');
  const p = app.player;
  if (p) parts.push(p.float ? 'motore 16 bit virgola mobile' : 'motore 8 bit');
  const exp = S.experiments.find((e) => e.id === S.expId);
  if (exp) parts.push(`${exp.name} · ${S.versions.find((v) => v.id === S.versionId)?.label || ''}${S.dirty ? ' + modifiche' : ''}`);
  fill(status, ...parts.map((t) => h('span', null, t)), h('span.status__end', null, extra ? h('span', null, extra) : null, h('span', null, 'nessun servizio a pagamento')));
}

function engineBadge() {
  const el = document.getElementById('engine');
  const ff = S.info?.ffmpeg;
  const ok = S.store.mode === 'server' && ff?.ok;
  fill(el, h('span.dot' + (ok ? '' : '.dot--off')), h('span', null, ok ? 'Locale · ffmpeg' : S.store.mode === 'server' ? 'ffmpeg assente' : 'Demo nel browser'));
  el.title = ok ? `Motori locali e gratuiti. ${ff.version || ''}` : S.store.mode === 'server' ? 'Installa ffmpeg sul Mac: brew install ffmpeg' : 'Pagina demo: archivio nel browser, export PNG e WebM';
}

async function start() {
  try {
    await boot();
  } catch (e) {
    fill(main, h('div.state.state--error', null, h('div.state__box', null, h('div.state__glyph', null, '×'), h('p.prose', null, 'Non riesco ad aprire l’archivio: ' + e.message))));
    return;
  }
  // WebGL2 è indispensabile
  const test = document.createElement('canvas').getContext('webgl2');
  if (!test) {
    fill(main, h('div.state.state--error', null, h('div.state__box', null, h('div.state__glyph', null, 'GL'), h('p.prose', null, 'Questo browser non ha WebGL2. Usa Safari o Chrome aggiornati.'))));
    return;
  }
  engineBadge();
  document.getElementById('nav').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
  document.getElementById('sideBtn').addEventListener('click', () => app.side.toggle());
  document.querySelector('.side-scrim').addEventListener('click', closeSide);
  on((what) => { setStatus(); if (shell.dataset.side === 'open' && (what === 'work' || what === 'versions')) interlocutore.refresh?.(); });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('textarea, select, [contenteditable], input:not([type=range]):not([type=checkbox]):not([type=radio])')) return;
    if (document.querySelector('.scrim')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (app.route === 'vivo' && vivo.keys?.(e)) return;
    if ('12345'.includes(k) && k.length === 1) { go(Object.keys(SCREENS)[Number(k) - 1]); e.preventDefault(); }
    else if (k === 'i') app.side.toggle();
  });
  window.addEventListener('hashchange', () => { const r = location.hash.slice(1); if (r !== app.route) go(r); });
  // il pannello dell'interlocutore resta aperto se lo era
  const initial = location.hash.slice(1) || (S.work ? 'banco' : 'archivio');
  go(initial);
  if (S.store.mode === 'browser') {
    const seen = pref.get('moviola.demo-note');
    if (S.store.volatile) toast('Pagina di prova: qui il lavoro non resta salvato quando chiudi. Sul Mac, con il server, si salva tutto e si esporta in ProRes.');
    else if (!seen) { toast('Pagina demo: l’archivio resta in questo browser. Sul Mac, con il server, esporti ProRes.'); pref.set('moviola.demo-note', '1'); }
  }
}

start();
