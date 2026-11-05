// Provino: sei variazioni della clip aperta, in movimento, una accanto
// all'altra. Si segnano quelle che meritano; diventano rami dell'albero.
// La variazione è casuale ma dentro limiti dichiarati: seme, parametri,
// a volte il carattere del movimento. Non si sceglie mai da sola.

import { S, saveVersion, auxRenderer, auxSources, withAux, touch } from '../state.js';
import { h, fill, dialog, toast, seg, isPhone } from './kit.js';
import { byId } from '../engine/processes.js';
import { dims, clone, newSeed, MOTION_MODES } from '../engine/clip.js';
import { seekVideo, videoTime } from '../media.js';

const STRENGTH = [{ id: 0.12, label: 'Lieve' }, { id: 0.28, label: 'Media' }, { id: 0.55, label: 'Forte' }];
let strength = 0.28;

function vary(base, k, amt) {
  const c = clone(base);
  c.seed = newSeed();
  const said = [];
  if (k === 0) { said.push('solo il seme'); return { clip: c, said }; }
  const rnd = () => Math.random() * 2 - 1;
  for (const p of c.chain) {
    if (!p.on) continue;
    const proc = byId[p.proc];
    for (const d of proc.params) {
      if (d.options || c.keys[`${p.id}.${d.id}`]) continue;
      if (Math.random() > 0.55) continue;
      const v0 = p.params[d.id] ?? d.def;
      let v = v0 + rnd() * amt * (d.max - d.min);
      v = Math.min(d.max, Math.max(d.min, v));
      if (d.step) v = Math.round(v / d.step) * d.step;
      if (Math.abs(v - v0) > (d.max - d.min) * 0.08) said.push(`${proc.code} ${d.label.toLowerCase()} ${v > v0 ? '↑' : '↓'}`);
      p.params[d.id] = v;
    }
  }
  if (k === 5 || (amt > 0.4 && Math.random() < 0.4)) {
    const others = MOTION_MODES.filter((m) => m.id !== c.motion.mode);
    c.motion.mode = others[Math.floor(Math.random() * others.length)].id;
    said.unshift('movimento ' + c.motion.mode);
  }
  return { clip: c, said: said.slice(0, 4) };
}

export function openProvino({ onOpen } = {}) {
  if (!S.work) return;
  const base = clone(S.work);
  let variants = [];
  let raf = 0;
  const grid = h('div.provino');
  const status = h('span.meta');
  const saveBtn = h('button.btn.btn--solid', { disabled: true, onclick: saveMarked }, 'Salva le segnate come rami');
  const d = dialog({
    title: 'Provino · sei variazioni della clip aperta', wide: true,
    body: h('div.stack', { style: { gap: 'var(--s-4)' } },
      h('div.row', null, h('span.label', null, 'Quanto variare'), seg(STRENGTH, strength, (v) => { strength = v; generate(); }, { label: 'Quanto variare' }),
        h('button.btn', { onclick: () => generate() }, 'Altre sei'), h('span.grow'), status),
      h('p.about', { style: { margin: 0 } }, 'Tocca una variazione per segnarla. Le segnate diventano versioni nuove, figlie di quella aperta; le altre si dimenticano. Le chiavi della timeline restano come sono.'),
      grid),
    foot: [h('span.spacer'), h('button.btn', { onclick: () => d.close() }, 'Chiudi'), saveBtn],
    onClose: () => { cancelAnimationFrame(raf); variants = []; },
  });

  function generate() { return withAux(generateNow); }
  async function generateNow() {
    cancelAnimationFrame(raf);
    const r = auxRenderer();
    const items = await auxSources(base);
    const long = isPhone() ? 240 : 320;
    const { w, h: hh } = dims(base.format.aspect, long);
    const fps = base.format.fps;
    const total = Math.round(base.format.duration * fps);
    const n = Math.min(total, fps * 2); // due secondi di movimento
    // senza memoria si campiona tutta la durata; con la memoria servono fotogrammi consecutivi
    const memory = base.chain.some((p) => p.on && (byId[p.proc]?.feedback || byId[p.proc]?.history));
    const step = memory ? 1 : Math.max(1, Math.floor(total / n));
    variants = Array.from({ length: 6 }, (_, k) => ({ ...vary(base, k, strength), frames: [], marked: false }));
    fill(grid, variants.map((v, k) => {
      const cv = h('canvas', { width: w, height: hh });
      v.canvas = cv;
      const tile = h('button.provino__tile', { 'aria-pressed': 'false', onclick: () => { v.marked = !v.marked; tile.setAttribute('aria-pressed', String(v.marked)); upd(); }, ondblclick: () => { Object.assign(S.work, clone(v.clip)); touch('clip'); d.close(); onOpen && onOpen(); } },
        cv, h('span.provino__n', null, String(k + 1).padStart(2, '0')), h('span.provino__said', null, v.said.join(' · ') || 'piccoli scarti'));
      return tile;
    }));
    upd();
    r.setSize(w, hh);
    for (let k = 0; k < variants.length; k++) {
      const v = variants[k];
      if (!grid.isConnected) return;
      status.textContent = `calcolo ${k + 1}/6…`;
      r.prune([]); r.reset();
      for (let i = 0; i < n; i++) {
        const t = (i * step % total) / fps;
        for (const s of items) if (s.kind === 'video' && i % 4 === 0) await seekVideo(s.el, videoTime(s, t));
        // con retroazione si calcolano tutti i fotogrammi, se ne tengono alcuni
        r.render(v.clip, t, i * step, null, { display: true });
        v.frames.push(await createImageBitmap(r.canvas));
      }
      if (k === 0) { cancelAnimationFrame(raf); animate(fps); }
      await new Promise((res) => setTimeout(res, 0));
    }
    status.textContent = '';
  }

  function animate(fps) {
    const t0 = performance.now();
    const tick = (now) => {
      const i = Math.floor(((now - t0) / 1000) * fps);
      for (const v of variants) {
        const fr = v.frames[i % Math.max(1, v.frames.length)];
        if (fr && v.canvas) v.canvas.getContext('2d').drawImage(fr, 0, 0);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function upd() {
    const m = variants.filter((v) => v.marked).length;
    saveBtn.disabled = !m;
    saveBtn.textContent = m ? `Salva ${m === 1 ? 'la segnata' : 'le ' + m + ' segnate'} come rami` : 'Salva le segnate come rami';
  }

  async function saveMarked() {
    const parent = S.versionId;
    const marked = variants.filter((v) => v.marked);
    for (const v of marked) await saveVersion(`Provino: ${v.said.join(', ') || 'nuovo seme'}`, 'provino', v.clip, parent);
    toast(`${marked.length} ${marked.length === 1 ? 'ramo nuovo' : 'rami nuovi'} nel Laboratorio`);
    marked.forEach((v) => { v.marked = false; });
    grid.querySelectorAll('.provino__tile').forEach((t) => t.setAttribute('aria-pressed', 'false'));
    upd();
  }

  generate();
}
