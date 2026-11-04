// ATELIER — guscio dell'applicazione, stato condiviso e navigazione.
import { h, $, clear, toast } from './ui.js';
import { serverApi } from './api.js';
import { renderSide } from './side.js';
import { openHiggsfield, openViewer } from './dialogs.js';
import archivio from './views/archivio.js';
import cerca from './views/cerca.js';
import tela from './views/tela.js';
import laboratorio from './views/laboratorio.js';
import genesi from './views/genesi.js';
import impostazioni from './views/impostazioni.js';
import esporta from './views/esporta.js';

const VIEWS = { archivio, cerca, tela, laboratorio, genesi, esporta, impostazioni };
// Percorso di lavoro: raccogli → combina → scegli → esporta (oppure parti da zero).
const NAV = [
  ['archivio', '1', 'Raccogli', 'Archivio'],
  ['genesi', '○', 'oppure', 'Da zero', true],
  ['tela', '2', 'Combina', 'Tela'],
  ['laboratorio', '3', 'Scegli', 'Laboratorio'],
  ['esporta', '4', 'Esporta', 'Lightroom'],
];
const ORDER = ['archivio', 'tela', 'laboratorio', 'esporta'];
const NAV_OF = { cerca: 'archivio' };

const saved = (() => { try { return JSON.parse(localStorage.getItem('atelier.state') || '{}'); } catch { return {}; } })();

export const app = {
  api: window.ATELIER_DEMO_API || serverApi,
  status: null,
  processes: [],
  categories: [],
  state: {
    view: 'archivio',
    side: { open: !matchMedia('(max-width: 760px)').matches, tab: 'scheda', assetId: null },
    provider: saved.provider || 'locale',
    tela: { expId: saved.tela?.expId || null, slots: saved.tela?.slots || [], process: saved.tela?.process || 'tessere', params: {}, seed: '', recent: saved.tela?.recent || [] },
    lab: { expId: saved.lab?.expId || null, current: null, selected: [], mode: 'singola' },
    archive: { kind: 'sorgente', q: '', tag: '', rights: '', origin: '', choice: '', selected: [] },
    search: { q: '', archives: saved.search?.archives || ['openverse', 'wikimedia', 'cleveland', 'nasa'] },
    // Contesto per l'interlocutore: quale immagine e quale esperimento si sta guardando.
    focus: { assetId: null, experimentId: null },
  },

  persist() {
    const s = this.state;
    try {
      localStorage.setItem('atelier.state', JSON.stringify({ provider: s.provider, tela: { expId: s.tela.expId, slots: s.tela.slots, process: s.tela.process, recent: s.tela.recent.slice(0, 24) }, lab: { expId: s.lab.expId }, search: { archives: s.search.archives } }));
    } catch { /* memoria del browser non disponibile */ }
  },

  go(view, opts = {}) {
    if (!VIEWS[view]) view = 'archivio';
    this.state.view = view;
    if (location.hash !== `#${view}`) history.pushState(null, '', `#${view}`);
    if (opts.lab) Object.assign(this.state.lab, opts.lab);
    // Su iPhone il foglio copre la schermata: cambiando sezione si chiude.
    if (matchMedia('(max-width: 760px)').matches && this.state.side.open) { this.state.side.open = false; this.applySide(); }
    this.render();
    this.refreshStatus(true);
  },

  setFocus(assetId, experimentId = null) {
    this.state.focus = { assetId, experimentId };
    this.state.side.assetId = assetId;
    this.renderSide();
  },

  openSide(tab, assetId, experimentId) {
    const s = this.state.side;
    s.open = true;
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

  // Porta delle immagini dell'archivio sulla tela, dentro l'esperimento attivo.
  async toTela(assetIds) {
    const t = this.state.tela;
    let exp;
    if (!t.expId) {
      const title = `Esperimento ${new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long' })}`;
      exp = (await this.api.createExperiment({ title, hypothesis: '', assetIds })).experiment;
      t.expId = exp.id;
      this.state.lab.expId = exp.id;
    } else {
      try { exp = (await this.api.addSources(t.expId, assetIds)).experiment; }
      catch { t.expId = null; return this.toTela(assetIds); }
    }
    const nodes = assetIds.map((id) => exp.nodes.find((n) => n.assetId === id)).filter(Boolean);
    for (const n of nodes) if (!t.slots.includes(n.id)) t.slots.push(n.id);
    t.slots = t.slots.slice(-4);
    this.persist();
    this.go('tela');
  },

  async putNodesOnTela(expId, nodeIds) {
    const t = this.state.tela;
    if (t.expId !== expId) { t.expId = expId; t.slots = []; }
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
    this.renderChrome();
  },

  renderChrome() {
    const st = this.status || {};
    const hf = st.engines?.higgsfield || {};
    const eng = $('#engine');
    if (eng) {
      clear(eng,
        h('span', { class: 'dot' + (hf.available ? '' : ' dot--off') }),
        h('span', { class: 'engine__name' }, 'Higgsfield'),
        hf.simulated ? h('span', { class: 'meta' }, 'simulato') : hf.available && hf.credits != null ? h('span', { class: 'credits' }, `${hf.credits} cr`) : h('span', { class: 'meta' }, hf.available ? '' : 'non collegato'));
      eng.title = hf.message || '';
    }
    const s = $('#status-left');
    if (s) clear(s,
      h('span', {}, this.api.mode === 'demo' ? 'VERSIONE DI PROVA · dati solo in questo browser' : `ARCHIVIO ${st.counts?.assets ?? '—'} immagini · ${st.counts?.experiments ?? '—'} esperimenti`),
      h('span', { class: 'only-desk' }, `INTERLOCUTORE ${this.state.provider === 'claude' ? (st.critic?.claude?.available ? 'Claude' : 'Claude non disponibile → locale') : 'locale'}`));
  },

  render() {
    const view = this.state.view;
    const navView = NAV_OF[view] || view, ci = ORDER.indexOf(navView);
    document.querySelectorAll('.nav__item').forEach((b) => {
      b.setAttribute('aria-current', b.dataset.view === navView ? 'page' : 'false');
      const bi = ORDER.indexOf(b.dataset.view);
      b.dataset.done = String(ci > 0 && bi > -1 && bi < ci);
    });
    const main = $('.main');
    main.dataset.view = view;
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

function shell() {
  const navBtn = ([id, num, verb, name, alt]) => h('button', { class: 'nav__item' + (alt ? ' nav__item--alt' : ''), 'data-view': id, onclick: () => app.go(id) },
    h('span', { class: 'nav__num' }, num), h('span', { class: 'nav__txt' }, h('span', { class: 'nav__verb' }, verb), h('span', { class: 'nav__name' }, name)));
  return h('div', { class: 'shell', 'data-side': app.state.side.open ? 'open' : 'closed' },
    h('header', { class: 'bar' },
      h('button', { class: 'logo', onclick: () => app.go('archivio'), 'aria-label': 'ATELIER, torna all\'archivio' }, 'Atelier'),
      h('nav', { class: 'nav nav--steps', 'aria-label': 'Percorso di lavoro' }, NAV.map(navBtn)),
      h('div', { class: 'bar__end' },
        h('button', { class: 'engine', id: 'engine', onclick: () => app.go('impostazioni') }),
        h('button', { class: 'link only-desk', onclick: () => app.go('impostazioni') }, 'Impostazioni'),
        h('button', { class: 'link', id: 'side-toggle', onclick: () => (app.state.side.open && app.state.side.tab === 'interlocutore' ? app.toggleSide(false) : app.openSide('interlocutore')) }, 'Interlocutore'))),
    h('main', { class: 'main', tabindex: '-1' }),
    h('button', { class: 'side-scrim', 'aria-label': 'Chiudi il pannello', onclick: () => app.toggleSide(false) }),
    h('aside', { class: 'side', 'aria-label': 'Pannello laterale' }),
    h('footer', { class: 'status' }, h('div', { id: 'status-left', class: 'status__left' }), h('div', { class: 'status__end' }, h('span', {}, 'Nessuna immagine è finita finché non lo decidi tu.'))));
}

async function boot() {
  document.body.append(shell());
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
