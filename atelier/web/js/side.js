// Pannello laterale: scheda dell'immagine e interlocutore critico.
import { h, clear, toast, fmtBytes, fmtDate, spinner } from './ui.js';
import { openExport, openFinish } from './dialogs.js';

const RIGHTS = ['libero', 'con attribuzione', 'da verificare', 'riservato', 'mio'];
const CHOICES = [['', 'Materiale'], ['in esame', 'In esame'], ['scelta', 'Scelta'], ['scartata', 'Scartata']];
const ORIGIN = { upload: 'File importato', url: 'Da indirizzo web', archivio: 'Archivio esterno', generata: 'Generazione AI', algoritmo: 'Processo locale' };

// Conversazioni temporanee per immagini fuori da un esperimento.
const looseChat = new Map();
let lastAnalysis = new Map();

export function renderSide(el, app) {
  const s = app.state.side;
  const tabs = h('div', { class: 'seg', role: 'tablist' },
    [['scheda', 'Scheda'], ['interlocutore', 'Interlocutore']].map(([id, name]) =>
      h('button', { class: 'seg__opt', role: 'tab', 'aria-pressed': String(s.tab === id), onclick: () => { s.tab = id; renderSide(el, app); } }, name)));
  const body = h('div', { class: 'panel__body' });
  const foot = h('div', { class: 'panel__foot', hidden: true });
  clear(el, h('div', { class: 'panel' }, h('span', { class: 'sheet-grip' }),
    h('div', { class: 'panel__head' }, tabs, h('span', { style: { flex: 1 } }), h('button', { class: 'btn btn--quiet', onclick: () => app.toggleSide(false), 'aria-label': 'Chiudi pannello', title: 'Chiudi (I)' }, '×')),
    body, foot));
  if (s.tab === 'scheda') renderScheda(body, app);
  else renderCritic(body, foot, app);
}

async function renderScheda(body, app) {
  const id = app.state.side.assetId;
  if (!id) {
    clear(body, h('p', { class: 'prose muted' }, "Scegli un'immagine nell'archivio, sulla tela o nel laboratorio per vederne la scheda: provenienza, diritti, tag, cronologia."));
    return;
  }
  body.append(spinner('Carico la scheda…'));
  let data;
  try { data = await app.api.asset(id); } catch (e) { clear(body, h('div', { class: 'notice' }, e.message)); return; }
  const a = data.asset;
  const save = async (patch, msg = 'Salvato') => {
    try { const r = await app.api.updateAsset(a.id, patch); Object.assign(a, r.asset); toast(msg); app.render(); } catch (e) { toast(e.message); }
  };

  const title = h('input', { class: 'field field--title', value: a.title, 'aria-label': 'Titolo', onchange: (e) => save({ title: e.target.value }) });
  const notes = h('textarea', { class: 'field', placeholder: 'Note di lavoro, intenzioni, dubbi…', onchange: (e) => save({ notes: e.target.value }) }, a.notes || '');

  const choice = h('div', { class: 'choices' },
    h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'label' }, 'Stato · deciso da te'), h('span', { class: 'status-chip', 'data-s': a.choice || 'materiale' }, a.choice || 'materiale')),
    h('div', { class: 'seg seg--wrap' }, CHOICES.map(([v, label]) =>
      h('button', { class: 'seg__opt', 'aria-pressed': String((a.choice || '') === v), disabled: a.choice === 'finita', onclick: () => save({ choice: v }, `Stato: ${label.toLowerCase()}`) }, label))),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => save({ marked: !a.marked }, a.marked ? 'Segno tolto' : 'Segnata con la matita') }, a.marked ? 'Togli il segno' : 'Segna', h('span', { class: 'btn__key' }, 'M')),
      a.choice === 'finita'
        ? h('button', { class: 'btn', onclick: () => save({ choice: 'scelta' }, 'Riaperta') }, 'Riapri')
        : h('button', { class: 'btn btn--paid', onclick: () => openFinish(app, a, () => app.render()) }, 'Dichiara finita…')),
    h('p', { class: 'meta' }, 'Il laboratorio non decide mai quando un\'opera è finita: solo tu, con un gesto esplicito.'));

  const tagInput = h('input', { class: 'field', placeholder: 'Aggiungi tag e premi Invio', enterkeyhint: 'done', onkeydown: (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) { save({ tags: [...a.tags, ...e.target.value.split(',')] }); e.target.value = ''; }
  } });
  const tags = h('div', { class: 'tags' }, a.tags.map((t) => h('button', { class: 'tag', title: 'Togli tag', onclick: () => save({ tags: a.tags.filter((x) => x !== t) }) }, t, h('span', { class: 'tag__n' }, '×'))));

  const r = a.rights || {};
  const rightsSel = h('select', { class: 'field', onchange: (e) => save({ rights: { status: e.target.value } }) }, RIGHTS.map((x) => h('option', { value: x, selected: r.status === x }, x)));
  const rights = h('div', { class: 'rights' },
    h('div', { class: 'rights__state' }, h('span', { class: 'dot' + (r.status === 'libero' || r.status === 'mio' ? '' : ' dot--off') }), h('span', { class: 'label' }, 'Diritti')),
    rightsSel,
    h('input', { class: 'field', value: r.license || '', placeholder: 'Licenza', onchange: (e) => save({ rights: { license: e.target.value } }) }),
    h('input', { class: 'field', value: r.attribution || '', placeholder: 'Attribuzione richiesta', onchange: (e) => save({ rights: { attribution: e.target.value } }) }),
    r.licenseUrl ? h('a', { class: 'link meta', href: r.licenseUrl, target: '_blank', rel: 'noopener' }, 'Testo della licenza ↗') : null,
    r.notes ? h('p', { class: 'meta' }, r.notes) : null);

  const o = a.origin || {};
  const dl = h('dl', { class: 'dl' },
    h('dt', {}, 'Origine'), h('dd', {}, ORIGIN[o.type] || o.type || '—', o.archive ? ` · ${o.archive}` : ''),
    o.author ? [h('dt', {}, 'Autore'), h('dd', {}, o.author)] : null,
    o.date && o.type === 'archivio' ? null : null,
    o.page ? [h('dt', {}, 'Pagina'), h('dd', {}, h('a', { class: 'link', href: o.page, target: '_blank', rel: 'noopener' }, 'Scheda originale ↗'))] : null,
    o.prompt ? [h('dt', {}, 'Prompt'), h('dd', {}, o.prompt)] : null,
    h('dt', {}, 'Formato'), h('dd', { class: 'meta' }, `${a.width} × ${a.height} · ${String(a.format || '').toUpperCase()} · ${fmtBytes(a.bytes)}${a.bitDepth === 'ushort' ? ' · 16 bit' : ''}`),
    h('dt', {}, 'Importata'), h('dd', { class: 'meta' }, fmtDate(a.createdAt)));

  const history = data.lineage?.length > 1 ? h('div', {},
    h('div', { class: 'label', style: { marginBottom: '10px' } }, 'Cronologia delle trasformazioni'),
    h('ol', { class: 'history' }, data.lineage.flatMap((n) => [h('li', {}, n.op.label || n.op.engine,
      h('span', { class: 'meta' }, [n.op.seed != null ? `seme ${n.op.seed}` : '', n.op.credits != null ? `${n.op.credits} crediti` : '', fmtDate(n.createdAt)].filter(Boolean).join(' · '))),
      n.note ? h('li', { 'data-human': 'true' }, `«${n.note}»`, h('span', { class: 'meta' }, 'nota tua')) : null]))) : null;

  clear(body,
    h('div', { class: 'scheda__img', 'data-marked': String(!!a.marked) }, h('img', { src: a.thumbUrl, alt: a.title })),
    title, choice,
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => app.toTela([a.id]) }, 'Sulla tela'),
      h('button', { class: 'btn', onclick: () => openExport(app, a) }, 'Esporta'),
      h('button', { class: 'btn btn--quiet', onclick: () => { app.state.side.tab = 'interlocutore'; app.renderSide(); } }, 'Discutila'),
      h('a', { class: 'btn btn--quiet', href: a.url, target: '_blank', rel: 'noopener' }, 'Originale')),
    dl, h('div', {}, h('div', { class: 'label', style: { marginBottom: '6px' } }, 'Tag'), tags, tagInput),
    rights, h('div', {}, h('div', { class: 'label' }, 'Note'), notes), history,
    h('button', { class: 'link meta', style: { alignSelf: 'flex-start' }, onclick: async () => {
      if (!confirm('Spostare questa immagine nel cestino? Il file resta nella cartella dati/cestino.')) return;
      await app.api.deleteAsset(a.id); app.state.side.assetId = null; toast('Spostata nel cestino'); app.render();
    } }, 'Sposta nel cestino'));
}

async function renderCritic(body, foot, app) {
  const { assetId, experimentId } = app.state.focus;
  const provider = app.state.provider;
  const claudeOk = app.status?.critic?.claude?.available;
  const head = h('div', { class: 'critic__bar' },
    h('div', { class: 'seg' }, [['locale', 'Locale'], ['claude', 'Claude']].map(([id, name]) =>
      h('button', { class: 'seg__opt', 'aria-pressed': String(provider === id), onclick: () => { app.state.provider = id; app.persist(); app.renderSide(); app.renderChrome(); } }, name))),
    h('span', { class: 'meta' }, provider === 'claude' ? (claudeOk ? `via ${app.status.critic.claude.via === 'api' ? 'API' : 'Claude Code'}` : 'non disponibile qui') : 'offline, misurabile'));

  const ctx = h('div', { class: 'critic__ctx' });
  const thread = h('div', { class: 'critic__thread' });
  clear(body, head, ctx, thread);

  let asset = null;
  if (assetId) { try { asset = (await app.api.asset(assetId)).asset; } catch { /* rimossa */ } }
  let exp = null;
  if (experimentId) { try { exp = (await app.api.experiment(experimentId)).experiment; } catch { /* rimosso */ } }

  if (asset) {
    clear(ctx, h('img', { src: asset.thumbUrl, alt: '' }), h('div', {}, h('div', { class: 'label' }, exp ? exp.title : 'Immagine'), h('div', { class: 'node__name' }, asset.title),
      exp?.hypothesis ? h('div', { class: 'meta' }, `Ipotesi: ${exp.hypothesis}`) : null),
      h('button', { class: 'btn btn--solid', onclick: () => analyze() }, 'Analizza'));
  } else {
    clear(ctx, h('p', { class: 'prose muted' }, "Scegli un'immagine (in archivio, sulla tela o nel laboratorio) e chiedimi di analizzarla. Puoi anche scrivermi qui sotto: un'idea, un dubbio, un disaccordo."));
  }

  const msgs = exp ? exp.conversation : (looseChat.get(assetId || '_') || []);
  const drawThread = () => {
    clear(thread);
    const prev = lastAnalysis.get(assetId);
    const list = [...msgs];
    if (prev && !list.some((m) => m.kind === 'analisi' && m.assetId === assetId)) list.push({ role: 'interlocutore', kind: 'analisi', assetId, data: prev });
    if (!list.length) return;
    for (const m of list.slice(-30)) thread.append(m.kind === 'analisi' ? analysisBlock(m.data, app, asset, exp) : msgBlock(m));
    thread.lastElementChild?.scrollIntoView({ block: 'end' });
  };
  drawThread();

  async function analyze() {
    const busy = spinner(provider === 'claude' ? 'Claude sta guardando l\'immagine… (fino a un minuto)' : 'Misuro luce, masse, vuoti…');
    thread.append(busy);
    busy.scrollIntoView({ block: 'end' });
    try {
      const r = await app.api.analyze(asset.id, exp?.id, provider);
      lastAnalysis.set(asset.id, r);
      if (exp) exp.conversation.push({ role: 'interlocutore', kind: 'analisi', assetId: asset.id, data: r });
      else { msgs.push({ role: 'interlocutore', kind: 'analisi', assetId: asset.id, data: r }); looseChat.set(assetId || '_', msgs); }
      drawThread();
    } catch (e) { busy.replaceWith(h('div', { class: 'notice' }, e.message)); }
  }

  const input = h('textarea', { class: 'field', rows: 2, placeholder: 'Scrivi all\'interlocutore… (anche per contraddirlo)', enterkeyhint: 'send', onkeydown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } } });
  async function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    msgs.push({ role: 'autore', text });
    if (!exp) looseChat.set(assetId || '_', msgs);
    drawThread();
    const busy = spinner('…');
    thread.append(busy);
    try {
      const r = await app.api.discuss(text, { experimentId: exp?.id, assetId: asset?.id, provider });
      if (exp) { exp.conversation = exp.conversation.filter((m) => !(m.role === 'autore' && m.text === text && !m.id)); exp.conversation.push({ role: 'interlocutore', text: r.testo, fonte: r.fonte }); }
      else msgs.push({ role: 'interlocutore', text: r.testo, fonte: r.fonte });
      if (r.avviso) toast(r.avviso);
      drawThread();
    } catch (e) { busy.replaceWith(h('div', { class: 'notice' }, e.message)); }
  }
  foot.hidden = false;
  clear(foot, h('div', { class: 'field-row' }, input, h('button', { class: 'btn', onclick: send }, 'Invia')));
}

function msgBlock(m) {
  const you = m.role === 'autore';
  return h('div', { class: 'critic__msg' + (you ? ' critic__msg--you' : '') },
    h('div', { class: 'critic__who' }, h('span', { class: 'label' }, you ? 'Tu' : `Interlocutore${m.fonte === 'claude' ? ' · Claude' : ''}`)),
    h('div', { class: 'critic__text' }, m.text));
}

function pct(v) { return `${Math.round((v || 0) * 100)}`; }

function analysisBlock(r, app, asset, exp) {
  const m = r.metrics || {};
  const cell = (label, v, meter) => h('div', {}, h('span', { class: 'label' }, label), h('span', { class: 'analysis__v' }, v), meter != null ? h('div', { class: 'bar-meter' }, h('i', { style: { width: `${Math.round(meter * 100)}%` } })) : null);
  return h('div', { class: 'critic__analysis' },
    r.avviso ? h('div', { class: 'notice' }, r.avviso) : null,
    h('div', { class: 'critic__who' }, h('span', { class: 'label' }, `Analisi · ${r.fonte === 'claude' ? 'Claude' : 'locale'}`)),
    m.palette ? h('div', { class: 'palette' }, m.palette.map((p) => h('span', { style: { background: p.hex, flex: p.share }, title: `${p.hex} · ${pct(p.share)}%` }))) : null,
    m.brightness != null ? h('div', { class: 'analysis' },
      cell('Luce', pct(m.brightness), m.brightness), cell('Contrasto', pct(Math.min(1, m.contrast)), Math.min(1, m.contrast)),
      cell('Vuoto', pct(m.emptiness), m.emptiness), cell('Bordi', pct(m.edges), m.edges),
      cell('Simmetria', pct(m.symmetry?.lr), m.symmetry?.lr), cell('Baricentro', `${pct(m.centroid?.x)}·${pct(m.centroid?.y)}`)) : null,
    list('Osservazioni', r.osservazioni),
    list('Tensioni', r.tensioni),
    r.dissenso ? h('div', { class: 'critic__msg critic__msg--dissent' }, h('span', { class: 'label' }, 'Dissenso'), h('div', { class: 'critic__text' }, r.dissenso)) : null,
    r.ipotesi?.length ? h('div', {}, h('div', { class: 'label', style: { marginBottom: '8px' } }, 'Ipotesi da provare'),
      r.ipotesi.map((hy, i) => hypoBlock(hy, i, app, asset, exp))) : null,
    r.mossa ? h('div', { class: 'critic__msg' }, h('span', { class: 'label' }, 'Mossa'), h('div', { class: 'critic__text' }, r.mossa)) : null,
    r.domanda ? h('div', { class: 'critic__msg' }, h('span', { class: 'label' }, 'Domanda'), h('div', { class: 'critic__text' }, h('em', {}, r.domanda))) : null);
}

function list(label, items) {
  if (!items?.length) return null;
  return h('div', { class: 'critic__list' }, h('span', { class: 'label' }, label), h('ul', {}, items.map((t) => h('li', {}, t))));
}

export function hypoBlock(hy, i, app, asset, exp) {
  const steps = (hy.passi || []).filter((p) => app.processes.some((x) => x.id === p.processo));
  const names = steps.map((p) => app.processes.find((x) => x.id === p.processo)?.name).join(' → ');
  return h('div', { class: 'hypo' },
    h('div', { class: 'hypo__n' }, String(i + 1).padStart(2, '0')),
    h('div', { class: 'hypo__body' },
      h('div', { class: 'hypo__title' }, hy.titolo),
      h('div', { class: 'prose' }, hy.descrizione),
      names ? h('div', { class: 'meta' }, names) : null,
      hy.prompt ? h('div', { class: 'meta' }, `Prompt: ${hy.prompt}`) : null,
      h('div', { class: 'hypo__acts' },
        steps.length && asset ? h('button', { class: 'btn', onclick: (e) => tryHypothesis(app, hy, steps, asset, exp, e.currentTarget) }, hy.richiede ? 'Apri sulla tela' : 'Prova') : null,
        hy.prompt && asset ? h('button', { class: 'btn btn--paid', onclick: () => app.paidFromPrompt?.(hy.prompt, asset, exp) }, 'Con Higgsfield', h('span', { class: 'btn__cost' }, 'preventivo')) : null)));
}

async function tryHypothesis(app, hy, steps, asset, exp, btn) {
  // Le ipotesi che richiedono una seconda immagine vanno completate sulla tela.
  if (hy.richiede || steps.some((s) => (app.processes.find((x) => x.id === s.processo)?.inputs.min || 1) > 1)) {
    await app.toTela([asset.id]);
    app.state.tela.process = steps[0].processo;
    app.state.tela.params = steps[0].parametri || {};
    app.render();
    toast(`Aggiungi un'altra immagine alla tela per «${hy.titolo}»`);
    return;
  }
  btn.disabled = true; btn.textContent = 'Lavoro…';
  try {
    let e = exp;
    if (!e) {
      e = (await app.api.createExperiment({ title: hy.titolo, hypothesis: hy.descrizione, assetIds: [asset.id] })).experiment;
    }
    let parent = e.nodes.find((n) => n.assetId === asset.id);
    if (!parent) { e = (await app.api.addSources(e.id, [asset.id])).experiment; parent = e.nodes.find((n) => n.assetId === asset.id); }
    let last = parent.id, lastAsset = asset.id;
    for (const s of steps) {
      const r = await app.api.run(e.id, { parents: [last], process: s.processo, params: s.parametri || {} });
      last = r.node.id; lastAsset = r.node.asset.id;
    }
    app.state.lab.expId = e.id; app.state.lab.current = last;
    toast(`«${hy.titolo}» è pronta`, { label: 'Apri nel laboratorio', run: () => app.go('laboratorio', { lab: { expId: e.id, current: last } }) });
    app.state.tela.recent.unshift({ expId: e.id, nodeId: last, assetId: lastAsset });
    app.persist();
  } catch (err) { toast(err.message); }
  finally { btn.disabled = false; btn.textContent = 'Prova'; }
}
