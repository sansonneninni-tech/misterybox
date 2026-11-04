// 03 Laboratorio: l'albero delle versioni di un esperimento, il confronto
// A/B dal vivo (affiancate o a tendina), gli stati. Solo ninni dichiara finita
// una versione, e può sempre riaprirla.

import { S, versionsOf, versionById, expById, openVersion, updateVersion, clipSources, urlOf } from '../state.js';
import { h, fill, toast, seg, holdButton, ago, fmtTime } from './kit.js';
import { Player } from '../engine/player.js';
import { normalizeClip, clone, STATES } from '../engine/clip.js';
import { byId } from '../engine/processes.js';
import { mainPlayer } from '../app.js';
import { pref } from '../prefs.js';

let playerB = null;
let slotA = null, slotB = null;
let mode = 'affiancate';

export function render(root, { app }) {
  const exp = expById(S.expId);
  if (!exp) {
    root.append(h('div.state', null, h('div.state__box', null, h('div.state__glyph', null, '03'), h('p.prose', null, 'Apri un esperimento dall’Archivio per vedere le sue versioni.'), h('button.btn', { onclick: () => app.go('archivio') }, 'Archivio'))));
    return;
  }
  const vs = versionsOf(exp.id);
  if (!versionById(slotA) || versionById(slotA).expId !== exp.id) slotA = S.versionId || vs[vs.length - 1]?.id;
  if (!versionById(slotB) || versionById(slotB).expId !== exp.id || slotB === slotA) slotB = versionById(slotA)?.parentId || vs.find((v) => v.id !== slotA)?.id || null;

  const A = mainPlayer();
  if (!playerB) playerB = new Player(h('canvas', { 'aria-label': 'Versione B' }), { previewLong: A.previewLong });
  const B = playerB;

  const treeEl = h('div.lab__tree');
  const duo = h('div.duo', { 'data-mode': mode === 'tendina' ? 'split' : 'pair', 'data-ground': pref.get('moviola.ground') || 'void' });
  const cellA = h('div.duo__cell', null, A.canvas, h('span.duo__lbl', null, 'A'));
  const cellB = h('div.duo__cell', null, B.canvas, h('span.duo__lbl', null, 'B'));
  const handle = h('div.duo__handle', { role: 'slider', 'aria-label': 'Tendina tra A e B', tabindex: 0 });
  duo.append(cellA, cellB, handle);
  const tc = h('span.tc');
  const playBtn = h('button.btn', { onclick: () => toggle() }, 'Riproduci');
  const bar = h('div.transport', null, playBtn, h('button.btn.btn--quiet', { onclick: () => restart() }, 'Dall’inizio'), tc, h('span.grow'),
    seg([{ id: 'affiancate', label: 'Affiancate' }, { id: 'tendina', label: 'Tendina' }], mode, (v) => { mode = v; duo.dataset.mode = v === 'tendina' ? 'split' : 'pair'; }, { label: 'Confronto' }));
  const actsEl = h('div.actbar');
  root.append(h('div.lab', null, treeEl, h('div.lab__main', null, duo, bar, actsEl)));

  // tendina
  handle.addEventListener('pointerdown', (e) => {
    handle.setPointerCapture(e.pointerId);
    const mv = (ev) => { const r = duo.getBoundingClientRect(); duo.style.setProperty('--split', Math.min(100, Math.max(0, ((ev.clientX - r.left) / r.width) * 100)) + '%'); };
    handle.onpointermove = mv; handle.onpointerup = () => { handle.onpointermove = null; };
  });

  // --------------------------------------------------------- albero
  function drawTree() {
    const vs = versionsOf(exp.id);
    const kids = new Map();
    for (const v of vs) { const k = v.parentId && vs.some((x) => x.id === v.parentId) ? v.parentId : 'root'; if (!kids.has(k)) kids.set(k, []); kids.get(k).push(v); }
    const items = [];
    const walk = (pid, depth) => (kids.get(pid) || []).forEach((v) => { items.push([v, depth]); walk(v.id, depth + 1); });
    walk('root', 0);
    fill(treeEl, 
      h('div.panel__head', null, h('span.label', null, exp.name), h('span', { style: { flex: 1 } }), h('span.meta', null, `${vs.length} versioni`)),
      h('ul.vtree', null, items.map(([v, depth]) => h('li', null, h('button.vnode', {
        style: { '--depth': Math.min(depth, 8), '--elbow': depth ? 'block' : 'none' },
        'aria-current': String(v.id === slotA), 'data-marked': String(!!v.marked), 'data-slot': v.id === slotA ? 'A' : v.id === slotB ? 'B' : '',
        onclick: () => { if (v.id === slotA) return; slotB = slotA; slotA = v.id; load(); },
        title: 'Tocca per metterla in A (la precedente passa in B)',
      },
        h('span.vnode__img', null, v.thumb ? h('img', { src: v.thumb, alt: '' }) : null),
        h('span.vnode__txt', null,
          h('span.vnode__name', null, v.label, v.id === slotA ? h('span.vnode__slot', null, 'A') : v.id === slotB ? h('span.vnode__slot', null, 'B') : null, v.id === S.versionId ? h('span.vnode__slot', null, 'banco') : null),
          h('span.status-chip', { 'data-s': v.status }, v.status),
          h('span.meta', null, `${v.by !== 'ninni' ? v.by + ' · ' : ''}${ago(v.created)}`),
          v.note ? h('span.meta', { style: { whiteSpace: 'normal' } }, v.note.slice(0, 80)) : null))))));
  }

  // -------------------------------------------------------- azioni su A
  function drawActs() {
    const v = versionById(slotA);
    if (!v) { fill(actsEl); return; }
    const states = STATES.filter((s) => s !== 'finita').map((s) => ({ id: s, label: s }));
    const finished = v.status === 'finita';
    const chainTxt = v.clip.chain.filter((p) => p.on).map((p) => byId[p.proc]?.code).join(' → ') || 'vuota';
    fill(actsEl, 
      h('div.actbar__info', null,
        h('div.row', null, h('span.proc__title', null, `A · ${v.label}`), h('span.status-chip', { 'data-s': v.status }, v.status), slotB ? h('span.meta', null, `B · ${versionById(slotB)?.label}`) : null),
        h('span.meta', null, `${chainTxt} · ${v.clip.format.aspect} · ${v.clip.format.duration}s · ${v.clip.format.fps} fps · ${v.clip.motion.mode}`),
        v.note ? h('p.about', { style: { margin: '4px 0 0' } }, v.note) : null),
      finished ? null : seg(states, v.status, async (s) => { v.status = s; await updateVersion(v); drawTree(); drawActs(); }, { label: 'Stato' }),
      h('button.btn', { 'aria-pressed': String(!!v.marked), style: v.marked ? { borderColor: 'var(--mark)' } : null, onclick: async () => { v.marked = !v.marked; await updateVersion(v); drawTree(); drawActs(); } }, v.marked ? '■ Segnata' : 'Segna'),
      h('button.btn', { onclick: () => { openVersion(v.id); app.go('banco'); }, title: 'Apre A nel Banco: il prossimo salvataggio nasce da qui e crea un ramo' }, 'Ramifica da qui'),
      h('button.btn.btn--quiet', { onclick: () => { app.side.open(); } }, 'Chiedi all’interlocutore'),
      finished
        ? h('button.btn', { 'data-act': 'finish', onclick: async () => { v.status = 'scelta'; await updateVersion(v); toast(`${v.label} riaperta`); drawTree(); drawActs(); } }, 'Riapri')
        : h('span', { 'data-act': 'finish' }, holdButton('Tieni premuto: è finita', async () => { v.status = 'finita'; v.finishedAt = Date.now(); await updateVersion(v); toast(`${v.label} dichiarata finita da te`); drawTree(); drawActs(); })),
    );
  }

  // ------------------------------------------------------------ lettura
  let playing = false;
  async function load() {
    pause();
    const va = versionById(slotA), vb = versionById(slotB);
    A.clipLab = va ? normalizeClip(clone(va.clip)) : null;
    if (va) await A.setClip(A.clipLab, clipSources(va.clip), urlOf);
    if (vb) { B.clipLab = normalizeClip(clone(vb.clip)); await B.setClip(B.clipLab, clipSources(vb.clip), urlOf); cellB.hidden = false; }
    else cellB.hidden = true;
    drawTree(); drawActs();
    restart();
  }
  app.onFrame = (p) => {
    if (p !== A) return;
    const fr = p.frame % p.total;
    fill(tc, fmtTime(fr, p.fps), h('small', null, `${fr + 1}/${p.total}`));
    if (slotB && B.clip) {
      B.frame = A.frame;
      B.r.render(B.clip, (A.frame % B.total) / B.fps, A.frame, null);
    }
  };
  function restart() {
    B.r.reset(); A.r.reset();
    A.frame = 0; B.frame = 0;
    if (playing) { A.pause(); A.play(); } else A.seek(0);
  }
  function toggle() { playing ? pause() : play(); }
  function play() { playing = true; A.play(); B.srcs.forEach((s) => s.kind === 'video' && s.el.play().catch(() => {})); playBtn.textContent = 'Ferma'; }
  function pause() { playing = false; A.pause(); B.pause(); playBtn.textContent = 'Riproduci'; }
  const keys = (e) => { if (e.key === ' ' && !e.target.closest('input, textarea, select')) { e.preventDefault(); toggle(); } };
  document.addEventListener('keydown', keys);

  load().then(() => play());
  return () => { document.removeEventListener('keydown', keys); pause(); };
}
