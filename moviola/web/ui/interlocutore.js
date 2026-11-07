// Pannello dell'interlocutore: misura la clip aperta, la legge (Claude sul
// Mac se c'è, altrimenti regole locali) e propone ipotesi eseguibili.
// Ogni ipotesi si prova come ramo: niente sostituisce il tuo lavoro.

import { S, auxRenderer, auxSources, withAux, saveVersion, touch, expById, emit } from '../state.js';
import { h, fill, toast } from './kit.js';
import { analyse, contactSheet } from '../engine/analysis.js';
import { localCritique, applyOps, describeOps, procCatalog } from '../engine/critic.js';

let root = null;
let last = null;     // { versionId, metrics, sheet, answer, question }
let busy = false;
const append = (el, ...kids) => el.append(...kids.flat().filter((k) => k !== null && k !== undefined && k !== false));

export function render(el, { app }) {
  root = el;
  root.__app = app;
  draw();
}
export function refresh() { if (root) draw(); }

function draw() {
  const app = root.__app;
  const exp = expById(S.expId);
  const via = S.store.mode === 'server' ? (S.info?.critic === 'api' ? 'Claude (API)' : S.info?.critic === 'cli' ? 'Claude Code sul Mac' : 'regole locali') : 'regole locali (demo)';
  const q = h('textarea.field', { rows: 2, placeholder: 'Una domanda, un dubbio, un’intenzione (facoltativo)' }, last?.question || '');
  const ask = h('button.btn.btn--solid', { disabled: busy || !S.work, onclick: () => run(q.value.trim()) }, busy ? 'Guardo la clip…' : 'Leggi la clip');
  const body = h('div.panel__body');
  fill(root, h('div.panel', null,
    h('div.sheet-grip'),
    h('div.panel__head', null, h('span.label', null, 'Interlocutore'), h('span', { style: { flex: 1 } }), h('span.meta', null, via), h('button.btn.btn--quiet', { onclick: () => app.side.close() }, 'Chiudi')),
    body,
    h('div.panel__foot', null, h('div.stack', null, q, h('div.row', null, ask, h('span.meta', null, 'misura tutta la clip, poi risponde'))))));

  if (!S.work) { body.append(h('p.about', null, 'Apri un esperimento: l’interlocutore guarda la clip nel Banco.')); return; }
  if (!last) {
    append(body,
      h('p.critic__text', null, 'Guardo la clip dall’inizio alla fine, misuro movimento, sfarfallio, densità, contrasto, colore. Poi ti dico cosa vedo, anche quando non sono d’accordo.'),
      exp?.idea ? h('div.critic__msg.critic__msg--you', null, h('span.label', null, 'La tua ipotesi'), h('p.critic__text', null, exp.idea)) : null,
      h('p.about', null, 'Le proposte si provano come rami nuovi: la versione da cui partono resta com’è. Decidi sempre tu cosa tenere.'));
    return;
  }
  const a = last.answer;
  const M = last.metrics;
  const meter = (label, v, max = 1, fmt) => h('div', null, h('span.label', null, label), h('span.analysis__v', null, fmt ? fmt(v) : Math.round(Math.min(1, v / max) * 100)), h('div.bar-meter', null, h('i', { style: { width: Math.min(100, (v / max) * 100) + '%' } })));
  append(body,
    last.sheet ? h('img', { src: last.sheet, alt: 'Provino di otto fotogrammi', style: { width: '100%' } }) : null,
    h('div.analysis', null,
      meter('Movimento', M.movimento, 0.08),
      meter('Sfarfallio', M.sfarfallio, 0.1),
      meter('Varietà', M.varieta_nel_tempo, 0.25),
      meter('Densità', M.densita_bordi, 0.25),
      meter('Contrasto', M.contrasto, 0.35),
      meter('Colore', M.saturazione, 0.6)),
    last.question ? h('div.critic__msg.critic__msg--you', null, h('span.label', null, 'Tu'), h('p.critic__text', null, last.question)) : null,
    h('div.critic__msg', null, h('div.critic__who', null, h('span.dot'), h('span.label', null, a.via || 'interlocutore')), h('p.critic__text', null, a.lettura || '')),
    a.disaccordo ? h('div.critic__msg.critic__msg--dissent', null, h('span.label', null, 'Non sono d’accordo'), h('p.critic__text', null, a.disaccordo)) : null,
    h('span.label', null, 'Ipotesi'),
    h('div', null, (a.ipotesi || []).map((hy, i) => h('div.hypo', null,
      h('span.hypo__n', null, String(i + 1).padStart(2, '0')),
      h('div.hypo__body', null,
        h('span.hypo__title', null, hy.titolo),
        h('p.about', { style: { margin: 0 } }, hy.perche),
        h('span.hypo__ops', null, describeOps(S.work, hy.ops)),
        h('div.hypo__acts', null,
          h('button.btn', { onclick: () => tryBranch(hy) }, 'Prova come ramo'),
          h('button.btn.btn--quiet', { onclick: () => applyHere(hy) }, 'Applica qui')))))),
    last.versionId !== S.versionId ? h('p.warn-line', null, 'Questa lettura riguarda una versione precedente. Rileggi per la clip attuale.') : null,
  );
}

async function run(question) {
  if (busy) return;
  busy = true; draw();
  const app = root.__app;
  try {
    const clip = JSON.parse(JSON.stringify(S.work));
    const { metrics, shots } = await withAux(async () => analyse(auxRenderer(), await auxSources(clip), clip));
    const sheet = await contactSheet(shots);
    let answer = null;
    if (S.store.mode === 'server' && S.info?.critic) {
      try {
        const res = await fetch('/api/critic', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clip, metrics, sheet, question, procs: procCatalog(), idea: expById(S.expId)?.idea }) });
        if (res.ok) answer = await res.json();
        else console.warn('critic', await res.text());
      } catch (e) { console.warn(e); }
    }
    if (!answer || !answer.lettura) {
      answer = localCritique(clip, metrics, expById(S.expId)?.idea);
      if (S.info?.critic) answer.via = 'regole locali (Claude non ha risposto)';
    }
    last = { versionId: S.versionId, metrics, sheet, answer, question };
  } catch (e) {
    console.error(e);
    toast('Non riesco a leggere la clip: ' + e.message);
  }
  busy = false;
  draw();
  if (app.route === 'banco' && app.player) app.player.draw();
}

async function tryBranch(hy) {
  const { clip, done } = applyOps(S.work, hy.ops);
  if (!done.length) return toast('Questa ipotesi non si applica alla clip attuale');
  const v = await saveVersion(`Interlocutore: ${hy.titolo}`, 'interlocutore', clip, S.versionId);
  toast(`Ramo ${v.label}: ${done.join(', ')}`, { label: 'Apri', run: () => { import('../state.js').then((m) => { m.openVersion(v.id); root.__app.go('banco'); }); } });
  draw();
}

function applyHere(hy) {
  const { clip, done } = applyOps(S.work, hy.ops);
  if (!done.length) return toast('Questa ipotesi non si applica alla clip attuale');
  Object.assign(S.work, clip);
  touch('clip');
  const app = root.__app;
  if (app.route === 'banco') app.go('banco');
  toast('Applicata alla clip aperta (non ancora salvata): ' + done.join(', '));
}
