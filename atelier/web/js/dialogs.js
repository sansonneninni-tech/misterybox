// Dialog condivisi: esportazione, opera finita, costo Higgsfield, scelta sorgenti.
import { h, clear, dialog, toast, holdButton, fmtBytes, spinner, code } from './ui.js';

// ---------- Esportazione per Lightroom ----------
export async function openExport(app, asset) {
  let formats = [];
  try { formats = await app.api.exportFormats(); } catch (e) { return toast(e.message); }
  let fmt = 'tiff16';
  const result = h('div');
  const opts = h('div', { class: 'choice' }, formats.map((f) =>
    h('label', { class: 'choice__opt' },
      h('input', { type: 'radio', name: 'fmt', value: f.id, checked: f.id === fmt, onchange: () => { fmt = f.id; } }),
      h('span', {}, h('span', { style: { display: 'block', fontSize: '13px' } }, f.name), h('span', { class: 'muted', style: { fontSize: '12px' } }, f.note)),
      h('span', { class: 'meta' }, f.id === 'tiff16' ? `~${fmtBytes(asset.width * asset.height * 6)}` : ''))));
  const go = h('button', { class: 'btn btn--solid btn--lg', onclick: async () => {
    go.disabled = true;
    clear(result, spinner('Esporto alla risoluzione piena…'));
    try {
      const r = await app.api.exportAsset(asset.id, fmt);
      clear(result, h('div', { class: 'notice' }, h('div', { class: 'stack' },
        h('div', {}, 'Esportata: ', h('span', { class: 'meta' }, h('b', {}, r.file)), ` · ${fmtBytes(r.bytes)}`),
        h('div', { class: 'row' },
          h('a', { class: 'btn btn--solid', href: r.url, download: r.file }, 'Scarica il file'),
          h('a', { class: 'btn', href: r.sheetUrl, download: r.file.replace(/\.[^.]+$/, '.atelier.json') }, 'Scheda .json'),
          app.status?.platform === 'darwin' && app.api.mode !== 'demo' ? h('button', { class: 'btn btn--quiet', onclick: () => app.api.reveal(r.path) }, 'Mostra nel Finder') : null),
        r.dir ? h('span', { class: 'meta' }, `Cartella: ${r.dir}`) : null)));
    } catch (e) { clear(result, h('div', { class: 'notice' }, e.message)); }
    go.disabled = false;
  } }, 'Esporta');
  dialog({
    title: `Esporta · ${asset.title}`,
    body: [
      h('div', { class: 'export-head' }, h('img', { src: asset.thumbUrl, alt: '' }),
        h('dl', { class: 'dl' },
          h('dt', {}, 'Dimensione'), h('dd', {}, `${asset.width} × ${asset.height} px: la massima disponibile. Nessun ingrandimento.`),
          h('dt', {}, 'Colore'), h('dd', {}, asset.hasProfile ? 'Profilo della sorgente incorporato.' : 'sRGB incorporato.'),
          h('dt', {}, 'Accanto'), h('dd', {}, 'Un file .json con provenienza, diritti, processi, parametri e semi.'))),
      h('div', { class: 'label' }, 'Formato'), opts,
      h('div', { class: 'notice' }, "L'esportazione non dichiara finita nessuna opera. In Lightroom: File → Importa, oppure trascina il file nella libreria."),
      result,
    ],
    foot: [h('span', { class: 'spacer' }), go],
  });
}

// ---------- Dichiarare finita un'opera: solo un gesto esplicito dell'artista ----------
export function openFinish(app, asset, done) {
  const d = dialog({
    title: 'Dichiarare finita',
    body: [
      h('div', { class: 'finish' }, h('img', { src: asset.thumbUrl, alt: '' }),
        h('p', { class: 'critic__text', style: { margin: 0 } }, "Questa è una tua decisione: il laboratorio non la prende mai al posto tuo. L'opera resta modificabile e puoi riaprirla quando vuoi.")),
      h('div', { class: 'critic__msg critic__msg--dissent' }, h('span', { class: 'label' }, 'Interlocutore'),
        h('div', { class: 'critic__text', style: { fontSize: '14px' } }, asset.choice === 'scelta'
          ? "È la versione che hai scelto. Prima di chiuderla, confrontala ancora con la sorella più instabile del ramo: spesso è lì che c'è la vita."
          : "Non l'hai ancora messa in esame né scelta. Se sei convinto, procedi: ma chiediti cosa perderesti continuando.")),
    ],
    foot: [
      h('button', { class: 'btn btn--quiet', onclick: () => d.close() }, 'Non ancora'), h('span', { class: 'spacer' }),
      holdButton('Tieni premuto: è finita', confirm, { altText: `Confermo che «${asset.title}» è finita. È una mia decisione.`, altLabel: 'Dichiara finita' }),
    ],
  });
  async function confirm() {
    try {
      await app.api.updateAsset(asset.id, { choice: 'finita', declaredByArtist: true, marked: true });
      d.close();
      toast('Dichiarata finita da te.');
      done?.();
    } catch (e) { toast(e.message); }
  }
}

// ---------- Higgsfield: parametri → preventivo gratuito → consenso → generazione ----------
export async function openHiggsfield(app, { expId, parents = [], prompt = '', sources = [] }) {
  let models;
  try { models = await app.api.hfModels(); } catch (e) { return toast(e.message); }
  const st = app.status?.engines?.higgsfield || {};
  if (!st.available) {
    const d = dialog({
      title: 'Higgsfield non è collegato',
      body: [
        h('p', { class: 'critic__text', style: { margin: 0 } }, 'Non posso chiedere il preventivo: la CLI non è installata o la sessione non è aperta.'),
        h('div', { class: 'notice' }, h('span', {}, st.message || 'Apri il Terminale ed esegui ', h('span', { class: 'meta' }, h('b', {}, 'higgsfield auth login')), '. I processi locali continuano a funzionare.')),
      ],
      foot: [h('button', { class: 'btn btn--quiet', onclick: () => d.close() }, 'Chiudi'), h('span', { class: 'spacer' }), h('button', { class: 'btn', onclick: async () => { d.close(); await app.refreshStatus(); openHiggsfield(app, { expId, parents, prompt, sources }); } }, 'Riprova')],
    });
    return;
  }
  let model = parents.length ? 'nano_banana_flash' : 'gpt_image_2_5';
  const promptEl = h('textarea', { class: 'field', rows: 4, placeholder: 'Descrivi la trasformazione in modo concreto: materia, spazio, luce, incongruenza. Evita aggettivi da catalogo.' }, prompt);
  const aspectEl = h('select', { class: 'field' }, models.aspects.map((a) => h('option', { value: a, selected: a === 'auto' }, a === 'auto' ? 'come la sorgente' : a)));
  const modelEl = h('div', { class: 'choice' }, models.models.map((m) =>
    h('label', { class: 'choice__opt' }, h('input', { type: 'radio', name: 'hfm', value: m.id, checked: m.id === model, onchange: () => { model = m.id; } }),
      h('span', {}, h('span', { style: { display: 'block', fontSize: '13px' } }, m.name), h('span', { class: 'muted', style: { fontSize: '12px' } }, m.note)),
      h('span', { class: 'meta' }, m.refs ? `fino a ${m.refs} rif.` : 'solo testo'))));
  const antiCliche = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: true }), h('span', {}, 'Aggiungi le istruzioni anti-cliché del laboratorio (niente estetica AI patinata)'));
  const out = h('div');
  const d = dialog({
    title: 'Generazione con Higgsfield · prima il preventivo',
    body: [
      sources.length ? h('div', { class: 'thumbs' }, sources.map((s) => h('img', { src: s.thumbUrl, alt: '', title: s.title }))) : h('div', { class: 'meta' }, 'Nessuna sorgente: parte dal testo.'),
      h('div', {}, h('div', { class: 'label' }, 'Prompt'), promptEl),
      antiCliche,
      h('div', { class: 'label' }, 'Modello'), modelEl,
      h('div', {}, h('div', { class: 'label' }, 'Formato'), aspectEl),
      h('div', { class: 'notice' }, h('span', { class: 'dot dot--mark', style: { marginTop: '4px' } }), h('span', {}, 'Chiedere il preventivo è gratuito. Niente viene speso senza il tuo consenso esplicito nella schermata successiva.')),
      out,
    ],
    foot: [h('button', { class: 'btn btn--quiet', onclick: () => d.close() }, 'Annulla'), h('span', { class: 'spacer' }), h('button', { class: 'btn btn--paid btn--lg', onclick: (e) => quote(e.currentTarget) }, 'Chiedi il preventivo', h('span', { class: 'btn__cost' }, 'gratis'))],
  });

  async function quote(btn) {
    let p = promptEl.value.trim();
    if (!p) return toast('Scrivi un prompt.');
    if (antiCliche.querySelector('input').checked) p += '. Avoid stock-photo polish, avoid glossy AI aesthetics, no lens flare, no epic lighting, no centered hero subject; keep it ambiguous, raw, tactile, unresolved.';
    btn.disabled = true;
    clear(out, spinner('Chiedo il costo a Higgsfield (gratis)…'));
    try {
      const q = await app.api.hfQuote(expId, { parents, model, prompt: p, aspect: aspectEl.value });
      d.close();
      openCost(app, { expId, q, sources });
    } catch (e) { clear(out, h('div', { class: 'notice' }, e.message)); btn.disabled = false; }
  }
}

function openCost(app, { expId, q, sources }) {
  const after = q.balance != null ? q.balance - q.credits : null;
  const enough = after == null || after >= 0;
  const d = dialog({
    title: 'Generazione a pagamento · richiede il tuo consenso',
    body: [
      q.simulated ? h('div', { class: 'notice' }, 'MODALITÀ SIMULATA: nessuna chiamata reale, nessun credito speso. Il flusso di consenso è identico a quello vero.') : null,
      h('div', { class: 'cost' },
        h('div', {}, h('span', { class: 'label' }, 'Costo'), h('span', { class: 'hero-num' }, String(q.credits)), h('span', { class: 'meta' }, q.simulated ? 'crediti (simulati)' : 'crediti Higgsfield · letti dalla CLI')),
        h('div', { class: 'cost__lines' },
          h('span', { class: 'muted' }, 'Modello'), h('span', {}, q.modelName),
          h('span', { class: 'muted' }, 'Sorgenti'), h('span', {}, sources.length ? sources.map((s) => code(s.title)).join(' × ') : 'nessuna'),
          h('span', { class: 'muted' }, 'Formato'), h('span', {}, q.aspect && q.aspect !== 'auto' ? q.aspect : 'automatico'),
          h('span', { class: 'muted cost__total' }, 'Saldo attuale'), h('span', { class: 'cost__total' }, q.balance != null ? `${q.balance} cr` : 'non letto'),
          h('span', { class: 'muted' }, 'Saldo dopo'), h('span', { style: { color: enough ? 'var(--salt)' : 'var(--mark)' } }, after != null ? `${after} cr` : '—'))),
      h('div', { class: 'meta prompt-box' }, q.prompt),
      h('div', { class: 'notice' }, 'Niente parte finché non tieni premuto il pulsante. Il preventivo vale 10 minuti e solo per questi parametri.'),
    ],
    foot: [
      h('button', { class: 'btn btn--quiet', onclick: () => d.close() }, 'Annulla'), h('span', { class: 'spacer' }),
      holdButton(enough ? `Tieni premuto per approvare ${q.credits} crediti` : 'Crediti insufficienti', approve,
        { disabled: !enough, altText: `Ho letto: verranno spesi ${q.credits} crediti Higgsfield.`, altLabel: `Approva ${q.credits} crediti` }),
    ],
  });
  async function approve() {
    clear(d.el.querySelector('.dialog__body'), h('p', { class: 'critic__text', style: { margin: 0 } }, `Approvato da te · ${q.credits} crediti. Generazione in corso con ${q.modelName}…`), h('div', { class: 'progress progress--indet' }, h('i')), h('span', { class: 'meta' }, 'Può richiedere fino a qualche minuto. Puoi chiudere: il risultato arriva nel laboratorio.'));
    clear(d.el.querySelector('.dialog__foot'), h('span', { class: 'spacer' }), h('button', { class: 'btn btn--quiet', onclick: () => d.close() }, 'Chiudi'));
    try {
      const r = await app.api.hfRun(expId, q.quoteId, { approved: true, credits: q.credits });
      d.close();
      app.state.lab.expId = expId; app.state.lab.current = r.nodes[0];
      toast(`${r.nodes.length} ${r.nodes.length === 1 ? 'variante pronta' : 'varianti pronte'}${q.simulated ? ' (simulata)' : ''}.`, { label: 'Apri nel laboratorio', run: () => app.go('laboratorio') });
      app.refreshStatus();
      if (app.state.view === 'laboratorio' || app.state.view === 'tela') app.render();
    } catch (e) {
      clear(d.el.querySelector('.dialog__body'), h('div', { class: 'notice' }, e.message));
    }
  }
}

// ---------- Scegliere immagini da aggiungere (archivio + varianti) ----------
export async function openPicker(app, { title = 'Aggiungi alla tela', kind = 'tutte', max = 4, onPick }) {
  const grid = h('div', { class: 'vgrid', style: { '--cols': 5 } }, spinner());
  const picked = new Set();
  const go = h('button', { class: 'btn btn--solid', disabled: true, onclick: () => { d.close(); onPick([...picked]); } }, 'Aggiungi');
  const d = dialog({ title, body: [grid], foot: [h('span', { class: 'meta' }, `Fino a ${max}`), h('span', { class: 'spacer' }), go], wide: true });
  try {
    const { assets } = await app.api.assets({ kind });
    if (!assets.length) return clear(grid, h('p', { class: 'prose muted' }, "L'archivio è vuoto: importa qualcosa prima."));
    clear(grid, assets.map((a) => {
      const t = h('button', { class: 'tile', 'aria-selected': 'false', onclick: () => {
        if (picked.has(a.id)) picked.delete(a.id); else if (picked.size < max) picked.add(a.id);
        t.setAttribute('aria-selected', String(picked.has(a.id)));
        go.disabled = !picked.size; go.textContent = picked.size ? `Aggiungi ${picked.size}` : 'Aggiungi';
      } }, h('span', { class: 'tile__img' }, h('img', { src: a.thumbUrl, alt: a.title, loading: 'lazy' })),
      h('span', { class: 'tile__info' }, h('span', { class: 'tile__code', style: { fontSize: '26px' } }, code(a.title))),
      h('span', { class: 'tile__rebate' }, h('b', {}, code(a.title)), h('span', {}, a.kind === 'variante' ? 'variante' : (a.origin.archive || a.origin.type))));
      return t;
    }));
  } catch (e) { clear(grid, h('div', { class: 'notice' }, e.message)); }
}

// ---------- Provino: sei variazioni dello stesso gesto ----------
// Il seme cambia sempre, gli altri parametri si spostano poco (±22% della
// corsa). Si segnano le poche da tenere: solo quelle diventano nodi.
export function openProvino(app, { proc, params, assetIds, keep }) {
  const rnd = Math.random;
  const sheet = [];
  for (let i = 0; i < 6; i++) {
    const prm = { ...params };
    if (i > 0) for (const d of proc.params) {
      if (d.type !== 'range' || d.key === 'size') continue;
      const span = (d.max - d.min) * 0.22;
      const v = Math.min(d.max, Math.max(d.min, Number(prm[d.key] ?? d.default) + (rnd() * 2 - 1) * span));
      prm[d.key] = Number((Math.round(v / d.step) * d.step).toFixed(3));
    }
    sheet.push({ params: prm, seed: Math.floor(rnd() * 1e9), url: null, on: false });
  }
  const changed = (x) => proc.params.filter((d) => d.type === 'range' && d.key !== 'size' && x.params[d.key] !== params[d.key]).map((d) => `${d.label.replace(/\s*\(.*\)/, '').toLowerCase()} ${x.params[d.key]}`).join(' · ');
  const keepBtn = h('button', { class: 'btn btn--solid btn--lg', disabled: true, onclick: async () => {
    const list = sheet.filter((x) => x.on);
    keepBtn.disabled = true; keepBtn.textContent = `Calcolo ${list.length} a piena risoluzione…`;
    try { await keep(list); d.close(); } catch (e) { toast(e.message); keepBtn.disabled = false; sync(); }
  } }, 'Segna almeno una variazione');
  const tiles = sheet.map((x, i) => {
    const img = h('img', { alt: '' });
    const state = h('span', {}, '');
    const t = h('button', { class: 'tile tile--frame', 'data-marked': 'false', 'aria-pressed': 'false', onclick: () => { x.on = !x.on; t.dataset.marked = String(x.on); t.setAttribute('aria-pressed', String(x.on)); state.textContent = x.on ? 'tenuta' : ''; sync(); } },
      h('span', { class: 'tile__img' }, img, h('span', { class: 'tile__wait meta' }, '…')),
      h('span', { class: 'tile__rebate' }, h('b', {}, String(i + 1).padStart(2, '0')), ` ${i === 0 ? 'parametri attuali' : changed(x) || 'solo il seme'} · seme ${x.seed}`, state));
    img.addEventListener('dblclick', (e) => { e.stopPropagation(); if (img.src) openViewer(img.src); });
    x.img = img; x.tile = t;
    return t;
  });
  function sync() {
    const k = sheet.filter((x) => x.on).length;
    keepBtn.disabled = !k;
    keepBtn.textContent = k ? `Tieni ${k === 1 ? 'la segnata' : `le ${k} segnate`} nel laboratorio →` : 'Segna almeno una variazione';
  }
  const d = dialog({
    title: `Provino · ${proc.name}`,
    wide: true,
    body: [
      h('p', { class: 'prose muted', style: { margin: '0 0 12px' } }, 'Sei versioni dello stesso gesto. Tocca quelle da tenere: solo le segnate entrano nel laboratorio, già come tue scelte. Doppio clic per vederla a schermo intero.'),
      h('div', { class: 'vgrid contact', style: { '--cols': 3 } }, tiles),
    ],
    foot: [h('button', { class: 'btn btn--quiet', onclick: () => d.close() }, 'Chiudi senza tenere nulla'), h('span', { class: 'spacer' }), keepBtn],
  });
  (async () => {
    for (const x of sheet) {
      if (!d.el.isConnected) return;
      try {
        x.url = await app.api.preview({ assetIds, process: proc.id, params: x.params, seed: x.seed, size: 720 });
        x.img.src = x.url;
        x.tile.querySelector('.tile__wait')?.remove();
      } catch (e) { x.tile.querySelector('.tile__wait').textContent = e.message; }
    }
  })();
}

// ---------- Visione a schermo intero ----------
// Adattata allo schermo; un tocco passa al 100% dei pixel reali e si trascina.
export function openViewer(src, { ground = 'void' } = {}) {
  if (!src) return toast('Nessuna immagine da guardare.');
  const info = h('span', { class: 'meta' }, 'adattata allo schermo · tocca per 1:1');
  const img = h('img', { src, alt: '', draggable: 'false' });
  const box = h('div', { class: 'viewer__img' }, img);
  const segBtns = [['void', 'Nero'], ['neutral', '18%']].map(([v, l]) => h('button', { class: 'seg__opt', 'aria-pressed': String(ground === v), onclick: () => { el.dataset.ground = v; segBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === (v === 'void' ? 0 : 1)))); } }, l));
  const close = () => { el.remove(); document.removeEventListener('keydown', key, true); };
  const key = (e) => { if (e.key === 'Escape' || e.key === 'f' || e.key === 'F') { e.preventDefault(); e.stopPropagation(); close(); } };
  const el = h('div', { class: 'viewer', 'data-ground': ground, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Visione a schermo intero' },
    h('div', { class: 'viewer__bar' }, info, h('span', { class: 'spacer' }), h('div', { class: 'seg' }, segBtns),
      h('button', { class: 'btn', onclick: close }, 'Chiudi', h('span', { class: 'btn__key only-desk' }, 'Esc'))),
    box);
  let one = false, drag = null, moved = false;
  const set = (v, ex, ey) => {
    one = v; box.dataset.one = String(v);
    info.textContent = v ? `100% · ${img.naturalWidth}×${img.naturalHeight} px · trascina per spostarti` : 'adattata allo schermo · tocca per 1:1';
    if (v && ex != null) {
      const r = box.getBoundingClientRect();
      box.scrollLeft = ((ex - r.left) / r.width) * img.naturalWidth - r.width / 2;
      box.scrollTop = ((ey - r.top) / r.height) * img.naturalHeight - r.height / 2;
    }
  };
  box.addEventListener('pointerdown', (e) => { moved = false; drag = { x: e.clientX, y: e.clientY, l: box.scrollLeft, t: box.scrollTop }; box.setPointerCapture(e.pointerId); });
  box.addEventListener('pointermove', (e) => { if (!drag || !one) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; box.scrollLeft = drag.l - dx; box.scrollTop = drag.t - dy; });
  box.addEventListener('pointerup', (e) => { const wasDrag = moved; drag = null; if (!wasDrag) set(!one, e.clientX, e.clientY); });
  document.addEventListener('keydown', key, true);
  document.body.append(el);
}
