// 04 · Laboratorio: albero delle varianti, confronto, ramificazioni, decisioni.
import { h, clear, toast, code, stateBox, spinner, fmtDate, guide } from '../ui.js';
import { openExport, openFinish, openViewer } from '../dialogs.js';

let ground = 'void';
let split = 50;
let cmp = { a: null, b: null };

export default {
  async render(root, app) {
    const L = app.state.lab;
    if (!L.expId) return renderList(root, app);
    let exp;
    try { exp = (await app.api.experiment(L.expId)).experiment; }
    catch { L.expId = null; app.persist(); return renderList(root, app); }

    const nodes = exp.nodes.filter((n) => n.asset);
    if (!nodes.length) {
      root.append(h('div', { class: 'view view--full' }, stateBox('∅', exp.title, 'Questo esperimento non ha ancora immagini. Portane qualcuna sulla tela, o parti da zero.',
        h('button', { class: 'btn', onclick: () => { app.state.tela.expId = exp.id; app.state.tela.slots = []; app.persist(); app.go('tela'); } }, 'Vai alla tela'),
        h('button', { class: 'btn btn--quiet', onclick: () => { L.expId = null; app.render(); } }, 'Tutti gli esperimenti'))));
      return;
    }
    let cur = nodes.find((n) => n.id === L.current) || [...nodes].reverse().find((n) => n.parents.length) || nodes[nodes.length - 1];
    L.current = cur.id;
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    if (!byId[cmp.a] || cmp.lockedFor !== cur.id) { cmp = { a: cur.parents[0] && byId[cur.parents[0]] ? cur.parents[0] : nodes[0].id, b: cur.id, lockedFor: cur.id }; }
    app.state.focus = { assetId: cur.asset.id, experimentId: exp.id };
    if (app.state.side.tab === 'scheda') app.state.side.assetId = cur.asset.id;

    // ---- Albero
    const kids = (id) => nodes.filter((n) => n.parents[0] === id);
    const label = (n) => `${n.op.label || 'Sorgente'}`;
    const nodeBtn = (n, depth) => h('button', { class: 'node', 'aria-current': String(n.id === cur.id), 'data-marked': String(!!n.asset.marked), 'data-discarded': String(n.asset.choice === 'scartata'),
      style: { paddingLeft: `${16 + depth * 18}px` }, onclick: () => { L.current = n.id; app.render(); } },
      h('span', { class: 'node__img' }, h('img', { src: n.asset.thumbUrl, alt: '' })),
      h('span', { class: 'node__txt' }, h('span', { class: 'node__name' }, `${nodeCode(nodes, n)} · ${label(n)}`),
        h('span', { class: 'meta' }, n.parents.length > 1 ? `${n.parents.map((p) => nodeCode(nodes, byId[p])).join(' × ')}` : n.op.engine === 'sorgente' ? (n.asset.origin.archive || 'sorgente') : n.op.engine === 'higgsfield' ? `Higgsfield${n.op.simulated ? ' (sim.)' : ''}` : `seme ${n.op.seed ?? ''}`),
        h('span', { class: 'status-chip', 'data-s': n.asset.choice || 'materiale' }, n.asset.choice || 'materiale')));
    const branch = (n, depth, seen) => {
      if (seen.has(n.id)) return null;
      seen.add(n.id);
      return h('li', {}, nodeBtn(n, depth), h('ul', {}, kids(n.id).map((k) => branch(k, depth + 1, seen))));
    };
    const seen = new Set();
    const roots = nodes.filter((n) => !n.parents.length || !byId[n.parents[0]]);
    const tree = h('ul', { class: 'tree' }, roots.map((r) => branch(r, 0, seen)));

    const titleIn = h('input', { class: 'field field--title', value: exp.title, 'aria-label': 'Titolo esperimento', onchange: (e) => app.api.updateExperiment(exp.id, { title: e.target.value }).then(() => toast('Titolo salvato')) });
    const hypoIn = h('textarea', { class: 'field', rows: 3, placeholder: "L'ipotesi artistica di questo esperimento: una tensione, una domanda…", onchange: (e) => app.api.updateExperiment(exp.id, { hypothesis: e.target.value }).then(() => toast('Ipotesi salvata')) }, exp.hypothesis || '');
    const rail = h('div', { class: 'rail rail--tree' },
      h('div', { class: 'panel__head' }, h('button', { class: 'link', onclick: () => { L.expId = null; app.render(); } }, '← Esperimenti'), h('span', { class: 'meta', style: { marginLeft: 'auto' } }, `${nodes.length} nodi`)),
      h('div', { class: 'exp-meta only-desk' }, titleIn, hypoIn),
      tree);

    // ---- Visore
    const A = byId[cmp.a] || nodes[0], B = byId[cmp.b] || cur;
    let stage;
    if (L.mode === 'ab') {
      stage = h('div', { class: 'compare', style: { '--split': `${split}%` } },
        h('div', { class: 'compare__a' }, h('img', { src: A.asset.url, alt: '' })),
        h('div', { class: 'compare__b' }, h('img', { src: B.asset.url, alt: '' })),
        h('div', { class: 'compare__handle' }),
        h('span', { class: 'compare__lbl', style: { left: '8px' } }, `A · ${nodeCode(nodes, A)}`),
        h('span', { class: 'compare__lbl', style: { right: '8px' } }, `B · ${nodeCode(nodes, B)}`));
      const move = (e) => { const r = stage.getBoundingClientRect(); split = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)); stage.style.setProperty('--split', `${split}%`); };
      stage.addEventListener('pointerdown', (e) => { stage.setPointerCapture(e.pointerId); move(e); stage.onpointermove = move; });
      stage.addEventListener('pointerup', () => { stage.onpointermove = null; });
      stage.style.touchAction = 'none';
    } else if (L.mode === 'griglia') {
      const fam = nodes.filter((n) => n.asset.choice !== 'scartata');
      stage = h('div', { class: 'vgrid', style: { '--cols': 4, width: '100%', alignSelf: 'start' } }, fam.map((n) =>
        h('button', { class: 'tile', 'aria-selected': String(n.id === cur.id), 'data-marked': String(!!n.asset.marked), onclick: () => { L.current = n.id; L.mode = 'singola'; app.render(); } },
          h('span', { class: 'tile__img' }, h('img', { src: n.asset.thumbUrl, alt: '' })),
          h('span', { class: 'tile__info' }, h('span', { class: 'tile__code', style: { fontSize: '30px' } }, nodeCode(nodes, n)), h('span', { class: 'tile__cat' }, label(n))),
          h('span', { class: 'tile__rebate' }, h('b', {}, nodeCode(nodes, n)), h('span', {}, n.asset.choice || 'materiale')))));
    } else {
      stage = h('img', { src: cur.asset.url, alt: cur.asset.title });
    }
    const pick = (slot) => h('select', { class: 'field field--inline', 'aria-label': `Immagine ${slot.toUpperCase()}`, onchange: (e) => { cmp[slot] = e.target.value; app.render(); } },
      nodes.map((n) => h('option', { value: n.id, selected: (slot === 'a' ? A : B).id === n.id }, `${slot.toUpperCase()} · ${nodeCode(nodes, n)} ${label(n)}`)));

    const params = cur.op.params ? Object.entries(cur.op.params).map(([k, v]) => (k === 'disponi' && Array.isArray(v) ? `disposizione ${v.map(dispText).join(' / ')}` : `${k} ${v}`)).join(' · ') : '';
    const info = [cur.op.engine === 'sorgente' ? 'sorgente' : cur.op.label, params, `${cur.asset.width}×${cur.asset.height} px`,
      cur.op.engine === 'higgsfield' ? `Higgsfield ${cur.op.modelName || ''} · ${cur.op.credits ?? '?'} cr${cur.op.simulated ? ' (simulati)' : ''}` : cur.op.engine === 'locale' ? 'locale · 0 crediti' : '',
      fmtDate(cur.createdAt)].filter(Boolean).join(' · ');
    const save = async (patch, msg) => { try { await app.api.updateAsset(cur.asset.id, patch); toast(msg); app.render(); } catch (e) { toast(e.message); } };
    const a = cur.asset;
    const isChosen = (x) => x.marked || x.choice === 'scelta' || x.choice === 'finita';
    const toggleChosen = () => isChosen(a) && a.choice !== 'finita'
      ? save({ marked: false, choice: a.choice === 'scelta' ? '' : a.choice }, 'Segno tolto')
      : save({ marked: true, choice: a.choice === 'finita' ? 'finita' : 'scelta' }, `${nodeCode(nodes, cur)} segnata come scelta`);
    const cc = nodeCode(nodes, cur);
    let noteT;
    const noteIn = h('textarea', { class: 'field', rows: cur.note ? 2 : 1, onfocus: (e) => { e.target.rows = 3; }, onblur: (e) => { e.target.rows = e.target.value ? 2 : 1; }, placeholder: 'Perché questa variante? Cosa ti disturba, cosa ti interessa. Resta nella cronologia e nel file esportato.',
      oninput: (e) => { clearTimeout(noteT); const v = e.target.value; noteT = setTimeout(() => app.api.updateNode(exp.id, cur.id, { note: v }).then(() => { cur.note = v; }).catch((err) => toast(err.message)), 600); } }, cur.note || '');
    const actbar = h('div', { class: 'actbar' },
      h('span', { class: 'meta actbar__info' }, info),
      h('label', { class: 'notebook' }, h('span', { class: 'label' }, `Quaderno · ${nodeCode(nodes, cur)}`), noteIn),
      h('span', { class: 'actbar__group' }, h('span', { class: 'label' }, `Decidi su ${cc}`),
        h('button', { class: 'btn', onclick: toggleChosen }, isChosen(a) && a.choice !== 'finita' ? 'Togli il segno' : 'Segna come scelta', h('span', { class: 'btn__key only-desk' }, 'M')),
        h('button', { class: 'btn', onclick: () => save({ choice: a.choice === 'in esame' ? '' : 'in esame' }, a.choice === 'in esame' ? 'Torna materiale' : 'In esame') }, a.choice === 'in esame' ? 'Torna a materiale' : 'Metti in esame'),
        h('button', { class: 'btn btn--quiet', onclick: () => save({ choice: a.choice === 'scartata' ? '' : 'scartata', marked: false }, a.choice === 'scartata' ? 'Ripristinata' : 'Scartata') }, a.choice === 'scartata' ? 'Ripristina' : 'Scarta')),
      h('span', { class: 'actbar__group' }, h('span', { class: 'label' }, 'Continua'),
        h('button', { class: 'btn', onclick: () => app.putNodesOnTela(exp.id, [cur.id]) }, 'Ramifica sulla tela'),
        h('button', { class: 'btn btn--quiet', onclick: () => app.openSide('interlocutore', a.id, exp.id) }, 'Discutila'),
        h('button', { class: 'btn btn--quiet', onclick: () => openExport(app, a) }, 'Esporta solo questa'),
        a.choice === 'finita'
          ? h('button', { class: 'btn', 'data-act': 'finish', onclick: () => save({ choice: 'scelta' }, 'Riaperta') }, 'Riapri')
          : h('button', { class: 'btn btn--paid', 'data-act': 'finish', onclick: () => openFinish(app, a, () => app.render()) }, 'Dichiara finita…')));

    const chosen = nodes.filter((x) => x.op.engine !== 'sorgente' && isChosen(x.asset)).length;
    const variants = nodes.filter((x) => x.op.engine !== 'sorgente').length;
    const g = guide(3, 'Scegli', [
      ['Scegli un ramo', `stai guardando ${cc} · ${label(cur)}`, true],
      ['Confronta', L.mode === 'ab' ? 'trascina la linea tra A e B, o passa alla griglia' : 'A/B per due versioni, Griglia per tutte', L.mode === 'ab' || L.mode === 'griglia' || chosen > 0],
      ['Decidi', 'segna le scelte, scarta il resto, ramifica ciò che promette', chosen > 0],
      ['Esporta le scelte', `${chosen} ${chosen === 1 ? 'segnata' : 'segnate'} su ${variants} · sarai tu a dire quando un'opera è finita`, false],
    ], chosen
      ? h('button', { class: 'btn btn--solid btn--lg', onclick: () => app.go('esporta') }, `Esporta le scelte (${chosen}) →`)
      : cur.op.engine !== 'sorgente' ? h('button', { class: 'btn btn--solid btn--lg', onclick: toggleChosen }, `Segna ${cc} come scelta`) : null);

    const pane = h('div', { class: 'pane pane--col' },
      h('div', { class: 'pane__head' }, h('h1', { class: 'title' }, nodeCode(nodes, cur)), h('span', { class: 'meta' }, `${label(cur)} · ${exp.title}`), h('span', { class: 'status-chip', 'data-s': a.choice || 'materiale' }, a.choice || 'materiale'),
        h('div', { class: 'pane__tools' },
          L.mode === 'ab' ? [pick('a'), pick('b')] : null,
          h('div', { class: 'seg' }, [['ab', 'A/B'], ['griglia', 'Griglia'], ['singola', 'Singola']].map(([v, l]) => h('button', { class: 'seg__opt', 'aria-pressed': String(L.mode === v), onclick: () => { L.mode = v; app.render(); } }, l))),
          h('button', { class: 'btn btn--quiet', title: 'Schermo intero (F)', onclick: () => openViewer(cur.asset.url, { ground }) }, 'Schermo intero', h('span', { class: 'btn__key only-desk' }, 'F')),
          h('div', { class: 'seg only-desk' }, [['void', 'Nero'], ['neutral', '18%']].map(([v, l]) => h('button', { class: 'seg__opt', 'aria-pressed': String(ground === v), onclick: () => { ground = v; app.render(); } }, l))))),
      g,
      h('div', { class: 'stage', 'data-ground': ground, style: { flex: 1, minHeight: 0 } },
        h('div', { class: 'stage__canvas', style: L.mode === 'griglia' ? { placeItems: 'start', padding: 0, overflow: 'auto' } : {} }, stage)),
      actbar);

    root.append(h('div', { class: 'view' }, rail, pane));
    app.currentImage = () => (L.mode === 'ab' ? B.asset.url : cur.asset.url);
    document.onkeydown = (e) => {
      if (e.target.matches('input, textarea, select') || app.state.view !== 'laboratorio') return;
      if (e.key === 'm' || e.key === 'M') toggleChosen();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const i = nodes.findIndex((n) => n.id === cur.id) + (e.key === 'ArrowDown' ? 1 : -1);
        if (nodes[i]) { L.current = nodes[i].id; app.render(); }
      }
    };
    if (L.mode === 'singola' && !app._labHint) { app._labHint = true; }
  },
};

function nodeCode(nodes, n) {
  if (!n) return '?';
  const i = nodes.indexOf(n);
  return n.op.engine === 'sorgente' ? code(n.asset.title) : `E${String(i + 1).padStart(2, '0')}`;
}

async function renderList(root, app) {
  const L = app.state.lab;
  const box = h('div', { class: 'pane' }, spinner());
  root.append(h('div', { class: 'view view--full' }, box));
  let list;
  try { list = (await app.api.experiments()).experiments; } catch (e) { clear(box, h('div', { class: 'notice' }, e.message)); return; }
  const title = h('input', { class: 'field', placeholder: 'Titolo' });
  const hyp = h('textarea', { class: 'field', rows: 2, placeholder: "Ipotesi: una tensione, un'incongruenza, una domanda" });
  const form = h('div', { class: 'newexp' }, h('div', { class: 'label' }, 'Nuovo esperimento'), title, hyp,
    h('button', { class: 'btn btn--solid', onclick: async () => {
      const e = (await app.api.createExperiment({ title: title.value, hypothesis: hyp.value })).experiment;
      app.state.tela.expId = e.id; app.state.tela.slots = []; L.expId = e.id; app.persist();
      toast('Esperimento creato: porta delle immagini sulla tela.'); app.go('tela');
    } }, 'Crea e vai alla tela'));
  clear(box,
    h('div', { class: 'pane__head' }, h('h1', { class: 'title' }, 'Laboratorio'), h('span', { class: 'meta' }, `${list.length} esperimenti`)),
    list.length
      ? h('div', { class: 'vgrid', style: { '--cols': 4 } }, list.map((e) => h('button', { class: 'tile', onclick: () => { L.expId = e.id; L.current = null; app.persist(); app.render(); } },
          h('span', { class: 'tile__img' }, e.cover ? h('img', { src: e.cover, alt: '' }) : null),
          h('span', { class: 'tile__info', style: { opacity: 1 } }, h('span', { class: 'tile__num' }, fmtDate(e.updatedAt)), h('span', { class: 'tile__code', style: { fontSize: '26px' } }, e.title), h('span', { class: 'tile__cat' }, e.hypothesis?.slice(0, 80) || '')),
          h('span', { class: 'tile__rebate' }, h('b', {}, `${e.count} nodi`), h('span', {}, e.state)))))
      : stateBox('∅', 'Ancora nessun esperimento', 'Porta una o più immagini sulla tela e applica un processo: ogni risultato diventa un ramo qui.', h('button', { class: 'btn', onclick: () => app.go('tela') }, 'Vai alla tela')),
    form);
}

// La disposizione di ogni foto, a parole: «foto 2 ribaltata ↔, ruotata 90°».
function dispText(d, i) {
  const w = [d.fh && 'ribaltata ↔', d.fv && 'ribaltata ↕', d.r && `ruotata ${d.r}°`, (d.x || d.y) && 'spostata', d.s && d.s !== 1 && `scala ${d.s}`].filter(Boolean);
  return `foto ${i + 1} ${w.length ? w.join(', ') : 'com\'è'}`;
}
