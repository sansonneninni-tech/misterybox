// 03 · Tela: affiancare, combinare, trasformare. Ogni risultato è un nodo dell'esperimento.
import { h, clear, toast, code, stateBox, spinner, guide, labelN } from '../ui.js';
import { openPicker, openHiggsfield, openProvino, openViewer } from '../dialogs.js';

let ground = 'void';
let show = 'sorgenti';
let lastResult = null;
let livePrev = null;      // { key, url } ultima anteprima a 640 px
let liveSeed = Math.floor(Math.random() * 1e9);

export default {
  async render(root, app) {
    const t = app.state.tela;
    let exp = null;
    if (t.expId) {
      try { exp = (await app.api.experiment(t.expId)).experiment; } catch { t.expId = null; t.slots = []; app.persist(); }
    }
    const nodes = exp ? t.slots.map((id) => exp.nodes.find((n) => n.id === id)).filter((n) => n && n.asset) : [];
    if (nodes.length !== t.slots.length) { t.slots = nodes.map((n) => n.id); app.persist(); }
    const proc = app.processes.find((p) => p.id === t.process) || app.processes[0];
    if (!proc) { root.append(stateBox('!', 'Processi non disponibili', 'Il server non ha risposto.')); return; }
    const n = nodes.length;
    const okInputs = n >= proc.inputs.min;
    const usable = Math.min(n, proc.inputs.max);

    if (nodes[0]) app.state.focus = { assetId: nodes[0].asset.id, experimentId: exp.id };
    const focusAsset = (lastResult && lastResult.expId === exp?.id ? lastResult.asset : nodes[0]?.asset);
    if (focusAsset && app.state.side.tab === 'scheda') app.state.side.assetId = focusAsset.id;

    // ---- Visore
    const layers = nodes.map((nd, i) => h('div', { class: 'layer' + (i >= usable ? ' layer--idle' : '') },
      h('img', { src: nd.asset.thumbUrl.replace('/miniature/', '/miniature/'), 'data-full': nd.asset.url, alt: nd.asset.title }),
      h('span', { class: 'layer__tag meta', style: { color: 'var(--salt)' } }, `${String.fromCharCode(65 + i)} · ${code(nd.asset.title)}${i >= usable ? ' · non usata' : ''}`),
      h('span', { class: 'layer__x' },
        i > 0 ? h('button', { class: 'btn btn--quiet', title: 'Porta prima', onclick: () => { t.slots.splice(i - 1, 0, t.slots.splice(i, 1)[0]); app.persist(); app.render(); } }, '←') : null,
        h('button', { class: 'btn btn--quiet', title: 'Togli dalla tela', onclick: () => { t.slots.splice(i, 1); app.persist(); app.render(); } }, '×'))));
    if (n < 4) layers.push(h('div', { class: 'layer' }, h('button', { class: 'slot-empty', onclick: addFromArchive }, n ? '+ aggiungi un\'immagine' : '+ scegli dall\'archivio')));
    const cells = Math.min(4, layers.length);
    const result = lastResult && lastResult.expId === exp?.id ? lastResult : null;
    if (!result && show === 'risultato') show = 'sorgenti';
    const canPreview = okInputs && (n > 0 || proc.inputs.min === 0);
    if (show === 'anteprima' && !canPreview) show = 'sorgenti';
    const effSeed = () => (t.seed !== '' && t.seed != null ? Number(t.seed) : liveSeed);
    const prevImg = h('img', { alt: 'Anteprima', src: livePrev?.url || '' });
    const prevTag = h('span', { class: 'stage__tag meta' }, 'anteprima a 640 px · il risultato sarà a piena risoluzione');
    const sourcesView = () => !n && proc.inputs.min > 0
      ? stateBox('∅', 'La tela è vuota', 'Porta qui una o più immagini dall\'archivio, oppure scegli un processo di Genesi per partire senza immagini.', h('button', { class: 'btn', onclick: addFromArchive }, 'Scegli dall\'archivio'), h('button', { class: 'btn btn--quiet', onclick: () => app.go('cerca') }, 'Cerca negli archivi'))
      : h('div', { class: 'layers', 'data-n': String(cells) }, layers);
    const canvas = h('div', { class: 'stage__canvas' },
      show === 'risultato' && result ? h('img', { src: result.asset.url, alt: 'Risultato' })
        : show === 'anteprima' ? [prevImg, prevTag]
          : sourcesView());
    app.currentImage = () => (show === 'risultato' && result ? result.asset.url : show === 'anteprima' ? prevImg.src : nodes[0]?.asset.url);

    // Anteprima dal vivo: ricalcolo a 640 px mentre il cursore si muove,
    // senza ridisegnare la schermata.
    let liveT = null, liveBusy = false, liveAgain = false;
    function live(delay = 90) {
      if (!canPreview) return;
      clearTimeout(liveT);
      liveT = setTimeout(async () => {
        if (liveBusy) { liveAgain = true; return; }
        liveBusy = true;
        try {
          const url = await app.api.preview({ assetIds: nodes.slice(0, usable).map((x) => x.asset.id), process: proc.id, params, seed: effSeed(), size: 640 });
          if (livePrev?.url) URL.revokeObjectURL?.(livePrev.url);
          livePrev = { url };
          prevImg.src = url;
          if (show !== 'anteprima') { show = 'anteprima'; clear(canvas, prevImg, prevTag); seg.querySelectorAll('.seg__opt').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.v === 'anteprima')); b.disabled = b.dataset.v === 'risultato' && !result; }); }
        } catch (e) { toast(e.message); }
        finally { liveBusy = false; if (liveAgain) { liveAgain = false; live(0); } }
      }, delay);
    }

    // ---- Parametri del processo scelto
    const params = { ...defaults(proc), ...t.params };
    const paramEls = proc.params.map((d) => {
      const val = h('b', {}, fmt(d, params[d.key]));
      let input;
      if (d.type === 'range') input = h('input', { class: 'range', type: 'range', min: d.min, max: d.max, step: d.step, value: params[d.key], oninput: (e) => { params[d.key] = Number(e.target.value); t.params = params; val.textContent = fmt(d, params[d.key]); live(); } });
      else if (d.type === 'select') input = h('select', { class: 'field', onchange: (e) => { params[d.key] = e.target.value; t.params = params; val.textContent = fmt(d, params[d.key]); live(0); } }, d.options.map(([k, l]) => h('option', { value: k, selected: params[d.key] === k }, l)));
      else input = h('input', { type: 'checkbox', checked: !!params[d.key], onchange: (e) => { params[d.key] = e.target.checked; t.params = params; val.textContent = fmt(d, params[d.key]); live(0); } });
      return h('label', { class: 'param' + (d.type === 'bool' ? ' param--bool' : '') }, h('span', { class: 'label' }, d.label), h('span', { class: 'meta' }, val), input);
    });

    const seedIn = h('input', { class: 'field field--seed', inputmode: 'numeric', placeholder: 'casuale', value: t.seed, oninput: (e) => { t.seed = e.target.value.replace(/\D/g, ''); live(250); }, 'aria-label': 'Seme' });
    const runBtn = h('button', { class: 'btn btn--solid btn--lg', disabled: !okInputs, onclick: (e) => run(e.currentTarget) }, 'Crea variante →');
    const needMsg = !okInputs ? h('span', { class: 'meta' }, `Aggiungi ${proc.inputs.min - n} ${proc.inputs.min - n === 1 ? 'immagine' : 'immagini'} sulla tela per «${proc.name}».`) : null;

    const madeHere = Boolean(result);
    const controls = h('div', { class: 'controls' },
      h('div', { class: 'controls__main' },
        labelN(3, 'Regola'),
        h('div', { style: { display: 'flex', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap' } }, h('span', { class: 'proc__title' }, proc.name),
          h('span', { class: 'meta' }, `locale · gratis · ${catName(app, proc.category)} · ${inputsText(proc)}`)),
        h('p', { class: 'prose muted', style: { margin: 0, fontSize: '12px' } }, proc.description),
        h('div', { class: 'params', style: { '--n': Math.min(4, proc.params.length) } }, paramEls),
        h('div', { class: 'field-row' }, h('span', { class: 'label', style: { whiteSpace: 'nowrap' } }, 'Seme'), seedIn,
          h('button', { class: 'btn btn--quiet', title: 'Parametri casuali', onclick: () => { t.params = randomize(proc); t.seed = ''; liveSeed = Math.floor(Math.random() * 1e9); show = 'anteprima'; app.render(); } }, 'Dado'))),
      h('div', { class: 'controls__acts' },
        labelN(4, 'Crea'),
        needMsg,
        runBtn,
        h('button', { class: 'btn', disabled: !canPreview, title: 'Sei variazioni dello stesso gesto: segni le poche da tenere', onclick: () => openProvino(app, { proc, params: { ...params }, assetIds: nodes.slice(0, usable).map((x) => x.asset.id), keep: keepFromProvino }) }, 'Provino · 6 variazioni', h('span', { class: 'btn__key only-desk' }, 'P')),
        h('span', { class: 'meta' }, 'La variante entra nel laboratorio, come nuovo ramo. La sorgente non viene toccata.'),
        h('div', { class: 'label', style: { marginTop: '8px' } }, 'oppure generativo · con preventivo'),
        h('button', { class: 'btn btn--paid', onclick: () => {
          if (!exp) return toast('Porta prima un\'immagine sulla tela, o usa «Da zero» per generare da un\'idea.');
          openHiggsfield(app, { expId: exp.id, parents: nodes.slice(0, 4).map((x) => x.id), sources: nodes.map((x) => x.asset), prompt: exp.hypothesis || '' });
        } }, 'Variante generativa · Higgsfield', h('span', { class: 'btn__cost' }, 'preventivo')),
        exp ? h('button', { class: 'btn btn--quiet only-phone', onclick: () => { t.expId = null; t.slots = []; lastResult = null; app.persist(); app.render(); } }, 'Nuovo esperimento') : null));

    // ---- Processi, raggruppati
    const procbar = h('div', { class: 'procbar' }, app.categories.map((c, ci) => h('div', { class: 'procbar__group' },
      h('div', { class: 'label' }, ci === 0 ? h('span', { class: 'label__n' }, '2') : null, `${c.name} · ${c.hint.toLowerCase()}`),
      h('div', { class: 'procbar__list' }, app.processes.filter((p) => p.category === c.id).map((p) =>
        h('button', { class: 'proc', 'aria-pressed': String(p.id === proc.id), onclick: () => { t.process = p.id; t.params = {}; show = 'anteprima'; app.persist(); app.render(); } },
          h('span', { class: 'proc__name' }, p.name), h('span', { class: 'meta' }, inputsText(p))))))));

    // ---- Risultati recenti di questo esperimento
    const recent = exp ? exp.nodes.filter((x) => x.parents.length || x.op.engine !== 'sorgente').slice(-12).reverse() : [];
    const strip = recent.length ? h('div', { class: 'strip' }, h('span', { class: 'label' }, 'Ultime varianti'),
      h('div', { class: 'strip__list' }, recent.map((x) => h('button', { class: 'strip__item', title: `${x.op.label} · tocca per usarla come sorgente`, onclick: () => { if (!t.slots.includes(x.id)) t.slots = [...t.slots, x.id].slice(-4); app.persist(); app.render(); } },
        h('img', { src: x.asset?.thumbUrl, alt: '' }), h('span', { class: 'meta' }, x.op.label))),
        h('button', { class: 'btn btn--quiet', onclick: () => app.go('laboratorio', { lab: { expId: exp.id } }) }, 'Albero →'))) : null;

    const seg = h('div', { class: 'seg' }, [['sorgenti', 'Affianca'], ['anteprima', 'Anteprima'], ['risultato', 'Risultato']].map(([v, l]) => h('button', { class: 'seg__opt', 'data-v': v, 'aria-pressed': String(show === v), disabled: (v === 'risultato' && !result) || (v === 'anteprima' && !canPreview), onclick: () => { show = v; app.render(); } }, l)));
    const head = h('div', { class: 'pane__head' }, h('h1', { class: 'title' }, 'Tela'),
      h('span', { class: 'meta' }, exp ? `${exp.title} · ${n} ${n === 1 ? 'sorgente' : 'sorgenti'}` : 'nessun esperimento'),
      h('div', { class: 'pane__tools' },
        seg,
        h('button', { class: 'btn btn--quiet only-desk', title: 'Schermo intero (F)', onclick: () => openViewer(app.currentImage?.(), { ground }) }, 'Schermo intero', h('span', { class: 'btn__key' }, 'F')),
        h('div', { class: 'seg only-desk', title: 'Fondo del visore' }, [['void', 'Nero'], ['neutral', 'Grigio 18%']].map(([v, l]) => h('button', { class: 'seg__opt', 'aria-pressed': String(ground === v), onclick: () => { ground = v; app.render(); } }, l))),
        exp ? h('button', { class: 'btn btn--quiet only-desk', onclick: () => { t.expId = null; t.slots = []; lastResult = null; app.persist(); app.render(); } }, 'Nuovo esperimento') : null));

    const g = guide(2, 'Combina', [
      ['Metti le sorgenti', `${n}/4 sulla tela · ${proc.name} ne usa ${inputsText(proc)}`, n > 0 && okInputs],
      ['Scegli un processo', `${proc.name} · locale, gratis`, n > 0 && okInputs],
      ['Regola e guarda', 'muovi i parametri o tira il dado; ogni seme è riproducibile', madeHere],
      ['Crea la variante', 'finisce nel laboratorio, nell\'albero', madeHere],
    ], madeHere
      ? h('button', { class: 'btn btn--solid btn--lg', onclick: () => app.go('laboratorio', { lab: { expId: result.expId, current: result.id } }) }, 'Confronta nel laboratorio →')
      : h('button', { class: 'btn btn--solid btn--lg', disabled: !okInputs, onclick: (e) => run(e.currentTarget) }, 'Crea variante →'));
    // Nella colonna degli strumenti l'azione resta, ma non compete con la guida.
    runBtn.classList.remove('btn--solid');

    root.append(h('div', { class: 'view view--full' }, h('div', { class: 'stage tela', 'data-ground': ground }, head, g,
      h('div', { class: 'tela__body' }, h('div', { class: 'tela__view' }, canvas, strip), h('div', { class: 'tela__tools' }, procbar, controls)))));
    if (show === 'anteprima') live(0);
    document.onkeydown = (e) => {
      if (e.target.matches?.('input, textarea, select') || app.state.view !== 'tela' || e.metaKey || e.ctrlKey) return;
      if ((e.key === 'p' || e.key === 'P') && canPreview) openProvino(app, { proc, params: { ...params }, assetIds: nodes.slice(0, usable).map((x) => x.asset.id), keep: keepFromProvino });
    };

    async function ensureExp() {
      if (exp) return exp;
      // Genesi senza immagini: crea l'esperimento al volo.
      const e = (await app.api.createExperiment({ title: `${proc.name} · ${new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long' })}`, assetIds: [] })).experiment;
      t.expId = e.id; app.state.lab.expId = e.id; app.persist();
      return e;
    }

    // Dal provino: solo le variazioni segnate diventano nodi, a piena risoluzione e già scelte.
    async function keepFromProvino(list) {
      const e = await ensureExp();
      const made = [];
      for (const x of list) {
        const r = await app.api.run(e.id, { parents: nodes.slice(0, usable).map((y) => y.id), process: proc.id, params: x.params, seed: x.seed });
        await app.api.updateAsset(r.node.asset.id, { marked: true, choice: 'scelta' });
        made.push(r.node);
      }
      const last = made[made.length - 1];
      lastResult = { expId: e.id, ...last };
      show = 'risultato';
      app.state.lab.expId = e.id; app.state.lab.current = last.id;
      app.persist();
      toast(`${made.length} ${made.length === 1 ? 'variante tenuta' : 'varianti tenute'} e segnate da te.`, { label: 'Apri nel laboratorio', run: () => app.go('laboratorio', { lab: { expId: e.id, current: last.id } }) });
      app.render();
    }

    async function addFromArchive() {
      openPicker(app, { max: 4 - n, onPick: (ids) => app.toTela(ids) });
    }

    async function run(btn) {
      const e = await ensureExp();
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = 'Lavoro a piena risoluzione…';
      canvas.append(h('div', { class: 'stage__busy' }, spinner('Lavoro a piena risoluzione…')));
      try {
        const r = await app.api.run(e.id, { parents: nodes.slice(0, usable).map((x) => x.id), process: proc.id, params, seed: effSeed() });
        lastResult = { expId: e.id, ...r.node };
        show = 'risultato';
        app.state.lab.expId = e.id; app.state.lab.current = r.node.id;
        app.state.focus = { assetId: r.node.asset.id, experimentId: e.id };
        app.persist();
        toast(`Variante creata: ${proc.name} · seme ${r.node.op.seed}${r.node.op.reduced ? ' · sorgente ridotta a 40 MP' : ''}`, { label: 'Apri nel laboratorio', run: () => app.go('laboratorio', { lab: { expId: e.id, current: r.node.id } }) });
        app.render();
      } catch (err) {
        toast(err.message);
        btn.disabled = false; btn.textContent = old;
        canvas.querySelector('.stage__busy')?.remove();
      }
    }
  },
};

function defaults(p) { return Object.fromEntries(p.params.map((d) => [d.key, d.default])); }
function randomize(p) {
  const o = {};
  for (const d of p.params) {
    if (d.key === 'size' || d.key === 'format') { o[d.key] = d.default; continue; }
    if (d.type === 'range') { const v = d.min + Math.random() * (d.max - d.min); o[d.key] = Number((Math.round(v / d.step) * d.step).toFixed(3)); }
    else if (d.type === 'select') o[d.key] = d.options[Math.floor(Math.random() * d.options.length)][0];
    else o[d.key] = Math.random() < 0.5;
  }
  return o;
}
function fmt(d, v) {
  if (d.type === 'bool') return v ? 'sì' : 'no';
  if (d.type === 'select') return d.options.find(([k]) => k === v)?.[1] ?? v;
  return String(v);
}
function inputsText(p) {
  const { min, max } = p.inputs;
  if (max === 0 || (min === 0 && max === 1)) return min === 0 && max === 1 ? 'da zero o 1 img' : 'da zero';
  if (min === max) return `${min} img`;
  return `${min}–${max} img`;
}
function catName(app, id) { return app.categories.find((c) => c.id === id)?.name.toLowerCase() || id; }
