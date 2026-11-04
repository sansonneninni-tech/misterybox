// 04 Dal vivo: la clip come strumento. Il quadro è un pad: X e Y guidano due
// parametri scelti; i tasti accendono e spengono i processi. La performance
// si registra e diventa chiavi sulla timeline, da renderizzare poi in 4K.

import { S, touch, saveVersion } from '../state.js';
import { h, fill, toast, fmtTime, fmtNum } from './kit.js';
import { byId } from '../engine/processes.js';
import { MOTION_MODES } from '../engine/clip.js';
import { keyValue } from '../engine/motion.js';
import { mainPlayer, syncPlayer } from '../app.js';

let handlers = null;
export function keys(e) { return handlers ? handlers(e) : false; }

export function render(root, { app }) {
  if (!S.work) {
    root.append(h('div.state', null, h('div.state__box', null, h('div.state__glyph', null, '04'), h('p.prose', null, 'Apri un esperimento per suonarlo dal vivo.'), h('button.btn', { onclick: () => app.go('archivio') }, 'Archivio'))));
    return;
  }
  const clip = S.work;
  const player = mainPlayer();
  const allParams = [];
  clip.chain.forEach((p) => byId[p.proc].params.forEach((d) => { if (!d.options) allParams.push({ key: `${p.id}.${d.id}`, pass: p, d, label: `${byId[p.proc].code} · ${d.label}` }); }));
  const saved = JSON.parse(localStorage.getItem('moviola.vivo.' + S.expId) || '{}');
  let mapX = allParams.find((x) => x.key === saved.x) || allParams[0];
  let mapY = allParams.find((x) => x.key === saved.y) || allParams[1] || allParams[0];
  const remember = () => { try { localStorage.setItem('moviola.vivo.' + S.expId, JSON.stringify({ x: mapX?.key, y: mapY?.key })); } catch {} };

  const wrap = h('div.vivo');
  const pad = h('div.vivo__pad');
  const cross = h('div.vivo__cross', { hidden: true });
  const tl = h('div.vivo__tl'), tr = h('div.vivo__tr');
  const keysRow = h('div.vivo__bl');
  const sel = (cur, on) => h('select', { onchange: (e) => { on(allParams.find((x) => x.key === e.target.value)); remember(); drawHud(); } }, allParams.map((p) => h('option', { value: p.key, selected: p === cur }, p.label)));
  const recBtn = h('button.btn', { onclick: () => toggleRec() }, 'Registra un giro', h('span.btn__key', null, 'R'));
  const tools = h('div.vivo__tools', { 'data-open': 'false' },
    h('button.btn.only-phone', { onclick: () => { tools.dataset.open = tools.dataset.open === 'true' ? 'false' : 'true'; } }, 'X / Y'),
    h('div.vivo__map', null, h('span.label', null, 'X'), sel(mapX, (v) => { mapX = v; }), h('span.label', null, 'Y'), sel(mapY, (v) => { mapY = v; })),
    recBtn,
    h('button.btn.vivo__fs', { onclick: () => fullscreen() }, 'Tutto schermo', h('span.btn__key', null, 'F')));
  wrap.append(player.canvas, pad, cross, h('div.vivo__hud', null, tl, tr), keysRow, tools);
  root.append(wrap);

  player.live = {};
  let touching = false, rec = null, taps = [];

  function valueAt(m) {
    if (player.live?.[m.key] !== undefined) return player.live[m.key];
    const tr = clip.keys[m.key];
    return tr?.length ? keyValue(tr, player.t) : (m.pass.params[m.d.id] ?? m.d.def);
  }

  function drawHud() {
    const mm = MOTION_MODES.find((m) => m.id === clip.motion.mode);
    const fr = player.frame % player.total;
    fill(tl, 
      h('span', null, `${fmtTime(fr, player.fps)} · ${fr + 1}/${player.total}`),
      h('span', null, `${mm.label.toLowerCase()} ${clip.motion.mode === 'ritmico' ? clip.motion.bpm + ' bpm' : ''} · seme ${clip.seed}`),
      rec ? h('span.rec', null, h('i'), `registro ${Math.round((rec.n / player.total) * 100)}%`) : h('span.vivo__hint', null, 'spazio · M carattere · T tempo · N seme · 1–9 processi'));
    fill(tr, 
      mapX ? h('span', null, `X ${mapX.label} ${fmtNum(valueAt(mapX), mapX.d)}`) : null,
      mapY ? h('span', null, `Y ${mapY.label} ${fmtNum(valueAt(mapY), mapY.d)}`) : null);
  }
  function drawKeys() {
    fill(keysRow, ...clip.chain.slice(0, 9).map((p, i) => h('button.vivo__key', { 'data-on': String(p.on), onclick: () => togglePass(i) },
      h('span.code', null, byId[p.proc].code), h('span.meta', null, `${i + 1} · ${byId[p.proc].name}`))));
  }
  function togglePass(i) { const p = clip.chain[i]; if (!p) return; p.on = !p.on; touch('clip'); drawKeys(); if (!player.playing) player.draw(); }

  // pad
  const setFromPointer = (e) => {
    const r = player.canvas.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
    if (mapX) player.live[mapX.key] = mapX.d.min + x * (mapX.d.max - mapX.d.min);
    if (mapY) player.live[mapY.key] = mapY.d.min + y * (mapY.d.max - mapY.d.min);
    const wr = wrap.getBoundingClientRect();
    cross.hidden = false;
    cross.style.left = (e.clientX - wr.left) + 'px'; cross.style.top = (e.clientY - wr.top) + 'px';
    if (!player.playing) player.draw();
    drawHud();
  };
  pad.addEventListener('pointerdown', (e) => { touching = true; pad.setPointerCapture(e.pointerId); setFromPointer(e); });
  pad.addEventListener('pointermove', (e) => { if (touching) setFromPointer(e); });
  const release = () => {
    touching = false; cross.hidden = true;
    // il valore resta dove l'hai lasciato finché non registri o esci
    drawHud();
  };
  pad.addEventListener('pointerup', release); pad.addEventListener('pointercancel', release);

  // registrazione di un giro intero
  function toggleRec() {
    if (rec) return stopRec(false);
    rec = { start: player.frame, n: 0, data: new Map(), keys: [mapX, mapY].filter(Boolean) };
    for (const m of rec.keys) rec.data.set(m.key, []);
    fill(recBtn, 'Ferma la registrazione', h('span.btn__key', null, 'R'));
    recBtn.style.borderColor = 'var(--mark)';
    if (!player.playing) player.play();
  }
  function stopRec(complete) {
    const r = rec; rec = null;
    fill(recBtn, 'Registra un giro', h('span.btn__key', null, 'R'));
    recBtn.style.borderColor = '';
    if (!r || r.n < 4) { drawHud(); return; }
    for (const m of r.keys) {
      const pts = r.data.get(m.key).sort((a, b) => a[0] - b[0]);
      clip.keys[m.key] = simplify(pts, (m.d.max - m.d.min) * 0.01);
    }
    player.live = {};
    touch('clip');
    drawHud();
    const label = complete ? 'Giro registrato' : 'Registrazione interrotta';
    toast(`${label}: ${r.keys.map((k) => k.label).join(' e ')} ora hanno chiavi.`, { label: 'Salva come versione', run: async () => { const v = await saveVersion(`Dal vivo: ${r.keys.map((k) => k.label).join(', ')}`, 'dal vivo'); toast(`Salvata ${v.label}`); } });
  }
  const prevOnFrame = (p) => {
    if (rec) {
      const t = p.t;
      for (const m of rec.keys) rec.data.get(m.key).push([Math.round(t * p.fps) / p.fps, valueAt(m)]);
      rec.n++;
      if (rec.n >= p.total) stopRec(true);
    }
    drawHud();
  };
  app.onFrame = prevOnFrame;

  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else (wrap.requestFullscreen || wrap.webkitRequestFullscreen)?.call(wrap);
  }

  handlers = (e) => {
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); player.toggle(); return true; }
    if (/^[1-9]$/.test(k)) { togglePass(Number(k) - 1); e.preventDefault(); return true; }
    if (k === 'r') { toggleRec(); return true; }
    if (k === 'f') { fullscreen(); return true; }
    if (k === 'n') { clip.seed = Math.floor(Math.random() * 99999) + 1; touch('clip'); drawHud(); return true; }
    if (k === 'm') { const i = MOTION_MODES.findIndex((m) => m.id === clip.motion.mode); clip.motion.mode = MOTION_MODES[(i + 1) % MOTION_MODES.length].id; touch('clip'); drawHud(); return true; }
    if (k === 't') {
      const now = performance.now();
      taps = taps.filter((x) => now - x < 2500); taps.push(now);
      if (taps.length >= 3) { const d = (taps[taps.length - 1] - taps[0]) / (taps.length - 1); clip.motion.bpm = Math.round(60000 / d); clip.motion.mode = 'ritmico'; touch('clip'); }
      drawHud(); return true;
    }
    return false;
  };

  drawKeys();
  syncPlayer().then(() => { player.live = {}; player.play(); drawHud(); });
  return () => { handlers = null; if (rec) stopRec(false); player.live = null; player.pause(); if (document.fullscreenElement) document.exitFullscreen(); };
}

/** Riduce i punti registrati: tiene solo quelli che cambiano la curva. */
function simplify(pts, eps) {
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i + 1], p = pts[i];
    const f = (p[0] - a[0]) / Math.max(1e-6, b[0] - a[0]);
    const lin = a[1] + (b[1] - a[1]) * f;
    if (Math.abs(p[1] - lin) > eps || p[0] - a[0] > 1) out.push(p);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
