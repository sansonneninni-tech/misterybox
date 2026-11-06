// ATELIER — guscio dell'applicazione, stato condiviso e navigazione.
// Tre passi: 1 Scegli · 2 Trasforma · 3 Salva. Tutto il resto è un tocco più in là.
import { h, $, clear, toast } from './ui.js';
import { serverApi } from './api.js';
import { renderSide } from './side.js';
import { openHiggsfield, openViewer } from './dialogs.js';
import foto from './views/foto.js';
import cerca from './views/cerca.js';
import trasforma from './views/trasforma.js';
import salva from './views/salva.js';
import laboratorio from './views/laboratorio.js';
import genesi from './views/genesi.js';
import impostazioni from './views/impostazioni.js';

// I nomi delle viste restano quelli di prima, così i vecchi indirizzi funzionano.
const VIEWS = { archivio: foto, cerca, genesi, tela: trasforma, laboratorio, salva, esporta: salva, impostazioni };
const STEPS = [['archivio', 'Scegli'], ['tela', 'Trasforma'], ['salva', 'Salva']];
const STEP_OF = { archivio: 0, cerca: 0, genesi: 0, tela: 1, laboratorio: 1, salva: 2, esporta: 2 };
const phone = () => matchMedia('(max-width: 760px)').matches;
const saved = (() => { try { return JSON.parse(localStorage.getItem('atelier.state') || '{}'); } catch { return {}; } })();

export const app = {
  api: window.ATELIER_DEMO_API || serverApi,
  status: null,
  processes: [],
  categories: [],
  state: {
    view: 'archivio',
    side: { open: false, tab: 'scheda', assetId: null },
    provider: saved.provider || 'locale',
    tela: { expId: saved.tela?.expId || null, slots: saved.tela?.slots || [], process: saved.tela?.process || null, intensity: saved.tela?.intensity ?? 0.5, layout: saved.tela?.layout || {}, adv: {}, params: {}, seed: '', recent: saved.tela?.recent || [] },
    lab: { expId: saved.lab?.expId || null, current: null, selected: [], mode: 'singola' },
    archive: { kind: 'sorgente', q: '', tag: '', rights: '', origin: '', choice: '', selected: [] },
    search: { q: '', archives: saved.search?.archives || ['openverse', 'wikimedia', 'cleveland', 'nasa'] },
    // Contesto per l'interlocutore: quale immagine e quale esperimento si sta guardando.
    focus: { assetId: null, experimentId: null },
  },

  persist() {
    const s = this.state;
    try {
      localStorage.setItem('atelier.state', JSON.stringify({ provider: s.provider, tela: { expId: s.tela.expId, slots: s.tela.slots, process: s.tela.process, intensity: s.tela.intensity, layout: s.tela.layout || {}, recent: s.tela.recent.slice(0, 24) }, lab: { expId: s.lab.expId }, search: { archives: s.search.archives } }));
    } catch { /* memoria del browser non disponibile */ }
  },

  go(view, opts = {}) {
    if (!VIEWS[view]) view = 'archivio';
    this.state.view = view;
    if (location.hash !== `#${view}`) history.pushState(null, '', `#${view}`);
    if (opts.lab) Object.assign(this.state.lab, opts.lab);
    // Su iPhone il foglio copre la schermata: cambiando sezione si chiude.
    if (this.state.side.open) { this.state.side.open = false; this.applySide(); }
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    this.render();
    $('.main').scrollTop = 0;
    this.refreshStatus(true);
  },

  isPhone: phone,

  // Un solo selettore di file per tutta l'app (su iPhone apre direttamente Foto).
  pickFiles() { $('#file-in').click(); },

  // Aggiungere foto: compaiono subito in cima, già scelte, con un toast che si può annullare.
  async importFiles(files) {
    const all = [...(files || [])];
    const list = all.filter((x) => x.type.startsWith('image/') || /\.(heic|heif|tiff?|webp|avif|jpe?g|png|gif)$/i.test(x.name));
    if (!list.length) return toast(all.length ? 'Questi file non sono immagini. Scegli JPEG, PNG, TIFF o WebP.' : 'Nessun file scelto.');
    const n = list.length;
    toast(`Aggiungo ${n} ${n === 1 ? 'foto' : 'foto'}…`);
    let r;
    try { r = await this.api.upload(list); }
    catch (e) { return toast(friendly(e.message, list)); }
    const ids = r.assets.map((a) => a.id);
    this.added(ids);
    if (this.state.view !== 'archivio') this.go('archivio'); else this.render();
    this.refreshStatus(true);
    const errs = (r.errors || []).map((m) => friendly(m, list));
    if (!ids.length) return toast(errs.join(' ') || 'Nessuna foto aggiunta.');
    toast(`${ids.length} ${ids.length === 1 ? 'foto aggiunta' : 'foto aggiunte'}${errs.length ? `. ${errs.join(' ')}` : ''}`, { label: 'Annulla', run: async () => {
      for (const id of ids) { try { await this.api.deleteAsset(id); } catch { /* già tolta */ } }
      foto.forget(ids);
      toast(ids.length === 1 ? 'Foto tolta.' : 'Foto tolte.');
      this.render();
    } });
  },

  added(ids) { foto.added(ids); },

  // Partire senza foto: idea, processi del laboratorio o Higgsfield.
  startFromZero() { this.go('genesi'); },


  setFocus(assetId, experimentId = null) {
    this.state.focus = { assetId, experimentId };
    this.state.side.assetId = assetId;
    this.renderSide();
  },

  openSide(tab, assetId, experimentId, { analyze = false } = {}) {
    const s = this.state.side;
    s.open = true;
    s.analyze = analyze;
    if (tab) s.tab = tab;
    if (assetId !== undefined) { s.assetId = assetId; this.state.focus.assetId = assetId; }
    if (experimentId !== undefined) this.state.focus.experimentId = experimentId;
    this.applySide();
    this.renderSide();
    this.onSideChange?.();
  },

  toggleSide(force) {
    this.state.side.open = force ?? !this.state.side.open;
    this.applySide();
    if (this.state.side.open) this.renderSide();
  },

  applySide() {
    $('.shell').dataset.side = this.state.side.open ? 'open' : 'closed';
  },

  renderSide() {
    if (!this.state.side.open) return;
    renderSide($('.side'), this);
  },

  // Porta delle foto al passo 2. Di base è un esperimento nuovo con quelle foto;
  // con { add: true } si aggiungono a quello in corso.
  async toTela(assetIds, { add = false, process = null } = {}) {
    const t = this.state.tela;
    let exp;
    if (!add) { t.expId = null; t.slots = []; t.adv = {}; t.layout = {}; t.process = process; t.intensity = 0.5; }
    if (!t.expId) {
      const title = `Esperimento ${new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long' })}`;
      exp = (await this.api.createExperiment({ title, hypothesis: '', assetIds })).experiment;
      t.expId = exp.id;
      this.state.lab.expId = exp.id;
    } else {
      try { exp = (await this.api.addSources(t.expId, assetIds)).experiment; }
      catch { t.expId = null; return this.toTela(assetIds, { process }); }
    }
    const nodes = assetIds.map((id) => exp.nodes.find((n) => n.assetId === id)).filter(Boolean);
    for (const n of nodes) if (!t.slots.includes(n.id)) t.slots.push(n.id);
    t.slots = t.slots.slice(-4);
    this.persist();
    this.go('tela');
  },

  async putNodesOnTela(expId, nodeIds) {
    const t = this.state.tela;
    if (t.expId !== expId) { t.expId = expId; t.slots = []; t.process = null; t.adv = {}; t.layout = {}; }
    for (const id of nodeIds) if (!t.slots.includes(id)) t.slots.push(id);
    t.slots = t.slots.slice(-4);
    this.persist();
    this.go('tela');
  },

  // Dall'interlocutore: generazione Higgsfield a partire da un prompt proposto.
  async paidFromPrompt(prompt, asset, exp) {
    let e = exp;
    if (!e) e = (await this.api.createExperiment({ title: 'Proposta dell\'interlocutore', hypothesis: prompt, assetIds: [asset.id] })).experiment;
    let node = e.nodes.find((n) => n.assetId === asset.id);
    if (!node) { e = (await this.api.addSources(e.id, [asset.id])).experiment; node = e.nodes.find((n) => n.assetId === asset.id); }
    openHiggsfield(this, { expId: e.id, parents: [node.id], prompt, sources: [asset] });
  },

  async refreshStatus(fast = false) {
    try { this.status = await this.api.status(fast); } catch (e) { this.status = { error: e.message, engines: {} }; }
  },

  renderChrome() {
    const step = STEP_OF[this.state.view] ?? -1;
    document.querySelectorAll('.steps__item').forEach((b, i) => {
      b.setAttribute('aria-current', i === step ? 'step' : 'false');
      b.dataset.done = String(i < step);
    });
    const line = $('#phone-step');
    if (line) {
      const back = step > 0 ? STEPS[step - 1][0] : (this.state.view !== 'archivio' && step === 0 ? 'archivio' : null);
      clear(line,
        back ? h('button', { class: 'pstep__back', 'aria-label': 'Indietro', onclick: () => this.go(back) }, '‹') : h('span', { class: 'pstep__back pstep__back--off' }),
        step >= 0 ? h('span', { class: 'pstep__t' }, `Passo ${step + 1} di 3 · `, h('b', {}, STEPS[step][1])) : h('span', { class: 'pstep__t' }, h('b', {}, 'Impostazioni')));
    }
  },

  render() {
    const view = this.state.view;
    const main = $('.main');
    main.dataset.view = view;
    document.body.dataset.view = view;
    clear(main);
    document.onkeydown = null;
    this.currentImage = null;
    this.onSideChange = null;
    const token = (this._renderToken = (this._renderToken || 0) + 1);
    this.renderChrome();
    // Il pannello si aggiorna dopo la vista, che decide quale immagine è a fuoco.
    Promise.resolve(VIEWS[view].render(main, this)).catch((e) => toast(e.message)).then(() => { if (token === this._renderToken) this.renderSide(); });
    main.focus?.({ preventScroll: true });
  },
};

// Messaggi d'errore che dicono cosa fare.
function friendly(msg, files) {
  const heic = files.find((f) => /\.hei[cf]$/i.test(f.name) || /hei[cf]/i.test(f.type));
  if (heic && /hei[cf]|formato|format|support|decod|unsupported|input/i.test(msg)) return `«${heic.name}» è un HEIC che non riesco a leggere. Esportalo come JPEG (su iPhone: Foto → Condividi → Opzioni → Più compatibile) e riprova.`;
  return msg;
}

function shell() {
  const fileIn = h('input', { id: 'file-in', type: 'file', accept: 'image/*,.heic,.heif,.tif,.tiff', multiple: true, hidden: true, onchange: (e) => { const f = [...e.target.files]; e.target.value = ''; app.importFiles(f); } });
  return h('div', { class: 'shell', 'data-side': 'closed' },
    h('header', { class: 'bar' },
      h('button', { class: 'logo', onclick: () => app.go('archivio'), 'aria-label': 'ATELIER, torna alle tue foto' }, 'Atelier'),
      app.api.mode === 'demo' ? h('span', { class: 'bar__demo only-desk' }, 'versione di prova') : null,
      h('nav', { class: 'steps only-desk', 'aria-label': 'Passi' }, STEPS.flatMap(([id, name], i) => [
        i ? h('span', { class: 'steps__sep', 'aria-hidden': 'true' }, '·') : null,
        h('button', { class: 'steps__item', onclick: () => app.go(id) }, h('span', { class: 'steps__n' }, String(i + 1)), name)])),
      h('div', { class: 'pstep only-phone', id: 'phone-step' }),
      h('div', { class: 'bar__end' },
        h('button', { class: 'link bar__set', onclick: () => app.go('impostazioni'), 'aria-label': 'Impostazioni' }, h('span', { class: 'only-desk' }, 'Impostazioni'), h('span', { class: 'only-phone', 'aria-hidden': 'true' }, '⚙')))),
    h('main', { class: 'main', tabindex: '-1' }),
    h('button', { class: 'side-scrim', 'aria-label': 'Chiudi il pannello', onclick: () => app.toggleSide(false) }),
    h('aside', { class: 'side', 'aria-label': 'Dettagli e interlocutore' }),
    h('div', { class: 'dropveil', 'aria-hidden': 'true' }, h('span', {}, 'Rilascia per aggiungere')),
    fileIn);
}

// Su Mac tutta la finestra accetta le foto trascinate: il browser non le apre mai.
function dropAnywhere() {
  let depth = 0;
  const veil = () => $('.dropveil');
  const isFiles = (e) => [...(e.dataTransfer?.types || [])].some((t) => t === 'Files' || t === 'text/uri-list');
  window.addEventListener('dragenter', (e) => { if (!isFiles(e)) return; e.preventDefault(); depth++; veil().dataset.on = 'true'; });
  window.addEventListener('dragover', (e) => { if (!isFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; veil().dataset.on = 'false'; } });
  window.addEventListener('drop', async (e) => {
    e.preventDefault(); depth = 0; veil().dataset.on = 'false';
    if (e.dataTransfer.files.length) return app.importFiles(e.dataTransfer.files);
    const u = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || '').split('\n')[0].trim();
    if (!/^https?:\/\//.test(u)) return;
    toast('Scarico l\'immagine…');
    try { const r = await app.api.importUrl(u); app.added([r.asset.id]); app.go('archivio'); toast('Foto aggiunta. Controlla i diritti prima di usarla in un\'opera.'); }
    catch (err) { toast(`Non riesco ad aggiungerla: ${err.message}`); }
  });
}

async function boot() {
  document.body.append(shell());
  dropAnywhere();
  if (app.api.mode === 'demo') document.documentElement.dataset.demo = 'true';
  const v = location.hash.slice(1);
  if (VIEWS[v]) app.state.view = v;
  window.addEventListener('popstate', () => { const x = location.hash.slice(1); if (VIEWS[x]) { app.state.view = x; app.render(); } });
  try {
    const p = await app.api.processes();
    app.processes = p.processes; app.categories = p.categories;
  } catch (e) {
    toast(`Il server non risponde: ${e.message}`);
  }
  // F = schermo intero sull'immagine che si sta guardando, ovunque.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'f' && e.key !== 'F') return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.matches?.('input, textarea, select, [contenteditable]') || document.querySelector('.scrim, .viewer')) return;
    const src = app.currentImage?.();
    if (src) { e.preventDefault(); openViewer(src); }
  });
  app.render();
  app.refreshStatus();
  setInterval(() => { if (document.visibilityState === 'visible') app.refreshStatus(); }, 60_000);
}

window.app = app;
boot();
