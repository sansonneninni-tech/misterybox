// 01 · Archivio: provino a contatto, filtri, importazione.
import { h, clear, toast, code, stateBox, spinner, guide } from '../ui.js';
export const sourceTabs = (app, cur) => h('div', { class: 'seg', role: 'tablist', 'aria-label': 'Dove cercare' }, [['archivio', 'Il tuo archivio'], ['cerca', 'Archivi del mondo']].map(([v, l]) => h('button', { class: 'seg__opt', role: 'tab', 'aria-pressed': String(cur === v), onclick: () => cur !== v && app.go(v) }, l)));

const ORIGINS = [['upload', 'File importati'], ['url', 'Da indirizzo'], ['archivio', 'Archivi esterni'], ['algoritmo', 'Processi locali'], ['generata', 'Generazioni AI']];
const RIGHTS = [['libero', 'Libero / pubblico dominio'], ['con attribuzione', 'Con attribuzione'], ['da verificare', 'Da verificare'], ['riservato', 'Riservato'], ['mio', 'Mio']];
const STATES = [['in esame', 'In esame'], ['scelta', 'Scelta'], ['finita', 'Finita'], ['scartata', 'Scartata']];
const KINDS = [['sorgente', 'Sorgenti'], ['variante', 'Varianti'], ['tutte', 'Tutte']];
let density = 'M';
let railOpen = false;

export default {
  async render(root, app) {
    const f = app.state.archive;
    const view = h('div', { class: 'view', 'data-rail': railOpen ? 'open' : 'closed' });
    const rail = h('div', { class: 'rail' });
    const pane = h('div', { class: 'pane', id: 'dropzone' });
    view.append(rail, pane);
    root.append(view);
    pane.append(spinner('Apro l\'archivio…'));

    let data;
    try { data = await app.api.assets(f); }
    catch (e) {
      clear(pane, stateBox('!', "L'archivio non si apre", `${e.message}. Le immagini restano al sicuro nella cartella dei dati: nessun file è stato toccato.`, h('button', { class: 'btn', onclick: () => app.render() }, 'Riprova')));
      pane.firstChild.classList.add('state--error');
      return;
    }
    const { assets, tags } = data;
    const any = Boolean(f.q || f.tag || f.rights || f.origin || f.choice);

    // ---- Colonna sinistra: importazione e filtri
    const fileIn = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: (e) => importFiles(e.target.files) });
    const urlIn = h('input', { class: 'field', placeholder: 'Incolla un indirizzo immagine', inputmode: 'url', enterkeyhint: 'go', onkeydown: (e) => { if (e.key === 'Enter') importUrl(); } });
    const facet = (name, key, opts) => h('div', { class: 'facet' }, h('div', { class: 'label facet__head' }, name),
      opts.map(([v, label]) => h('button', { class: 'facet__opt', 'aria-pressed': String(f[key] === v), onclick: () => { f[key] = f[key] === v ? '' : v; app.render(); } }, h('span', {}, label), h('span', {}, ''))));
    clear(rail,
      h('div', { class: 'only-phone', style: { justifyContent: 'space-between', alignItems: 'center' } }, h('span', { class: 'label' }, 'Filtri e importazione'), h('button', { class: 'btn', onclick: () => { railOpen = false; app.render(); } }, 'Fatto')),
      h('div', { class: 'stack' },
        h('div', { class: 'label' }, 'Importa'),
        h('div', { class: 'field-row' }, urlIn, h('button', { class: 'btn btn--quiet', onclick: importUrl, 'aria-label': 'Importa indirizzo' }, '↵')),
        h('button', { class: 'btn', style: { justifyContent: 'space-between' }, onclick: () => fileIn.click() }, h('span', { class: 'only-desk' }, 'Trascina o scegli file'), h('span', { class: 'only-phone' }, 'Scegli dal Rullino o File'), h('span', { class: 'btn__key only-desk' }, '⌘O')),
        h('button', { class: 'btn btn--quiet', style: { justifyContent: 'space-between' }, onclick: () => app.go('cerca') }, 'Cerca negli archivi del mondo', h('span', {}, '→')),
        fileIn),
      h('div', { class: 'facet' }, h('div', { class: 'label facet__head' }, 'Mostra'),
        h('div', { class: 'seg' }, KINDS.map(([v, l]) => h('button', { class: 'seg__opt', 'aria-pressed': String(f.kind === v), onclick: () => { f.kind = v; app.render(); } }, l)))),
      facet('Provenienza', 'origin', ORIGINS),
      facet('Diritti', 'rights', RIGHTS),
      facet('Stato', 'choice', STATES),
      tags.length ? h('div', { class: 'facet' }, h('div', { class: 'label facet__head' }, 'Tag'),
        h('div', { class: 'tags' }, tags.slice(0, 60).map((t) => h('button', { class: 'tag', 'aria-pressed': String(f.tag === t.tag), onclick: () => { f.tag = f.tag === t.tag ? '' : t.tag; app.render(); } }, t.tag, h('span', { class: 'tag__n' }, t.count))))) : null,
      any ? h('button', { class: 'link', style: { alignSelf: 'flex-start' }, onclick: () => { Object.assign(f, { q: '', tag: '', rights: '', origin: '', choice: '' }); app.render(); } }, 'Togli tutti i filtri') : null);

    // ---- Area principale
    const sel = new Set(f.selected.filter((id) => assets.some((a) => a.id === id)));
    const q = h('input', { class: 'field', placeholder: 'Cerca titolo, autore, tag', value: f.q, style: { width: '220px' }, type: 'search', oninput: debounce((e) => { f.q = e.target.value; refreshGrid(); }, 250) });
    const toTela = h('button', { class: 'btn', disabled: !sel.size, onclick: () => app.toTela([...sel]) }, sel.size > 1 ? `Porta ${sel.size} sulla tela →` : 'Porta sulla tela →');
    const head = h('div', { class: 'pane__head' },
      h('h1', { class: 'title' }, 'Archivio'), h('span', { class: 'meta' }, `${assets.length} ${f.kind === 'variante' ? 'varianti' : 'immagini'}`),
      h('div', { class: 'pane__tools' }, sourceTabs(app, 'archivio'), q,
        h('div', { class: 'seg only-desk', role: 'group', 'aria-label': 'Densità' }, ['S', 'M', 'L'].map((d) => h('button', { class: 'seg__opt', 'aria-pressed': String(density === d), onclick: () => { density = d; app.render(); } }, d))),
        h('button', { class: 'btn only-phone', onclick: () => { railOpen = true; app.render(); } }, `Filtri${any ? ' ·' : ''}`),
        h('button', { class: 'btn only-phone', onclick: () => fileIn.click() }, 'Importa'),
        toTela));
    const gridWrap = h('div');
    const guideBox = h('div');
    const drawGuide = () => {
      const focus = assets.find((a) => a.id === app.state.side.assetId);
      const tl = app.state.tela;
      const ids = sel.size ? [...sel] : focus ? [focus.id] : [];
      const next = ids.length
        ? h('button', { class: 'btn btn--solid btn--lg', onclick: () => app.toTela(ids) }, ids.length > 1 ? `Porta ${ids.length} sulla tela →` : `Porta ${code(focus?.title || assets.find((a) => a.id === ids[0])?.title || '')} sulla tela →`)
        : tl.slots?.length ? h('button', { class: 'btn btn--solid btn--lg', onclick: () => app.go('tela') }, `Vai alla tela (${tl.slots.length}/4) →`) : null;
      clear(guideBox, guide(1, 'Raccogli le immagini', [
        ['Importa o trova', 'trascina file, incolla un indirizzo, o cerca negli archivi del mondo', assets.length > 0 || any],
        ['Scegli e controlla', focus ? `${code(focus.title)} · diritti: ${focus.rights.status}` : "tocca un'immagine per vederne provenienza e diritti", ids.length > 0],
        ['Portala sulla tela', 'da una a quattro immagini da combinare', false],
      ], next));
    };
    drawGuide();
    app.onSideChange = drawGuide;
    app.currentImage = () => assets.find((a) => a.id === app.state.side.assetId)?.url;
    clear(pane, head, guideBox, gridWrap,
      h('div', { class: 'drop', id: 'drop' }, h('div', { style: { textAlign: 'center' } }, h('div', { class: 'hero-num' }, '+'), h('div', { class: 'label', style: { color: 'var(--salt)' } }, 'Rilascia per importare'), h('div', { class: 'meta', style: { marginTop: '6px' } }, 'Copio i file nell\'archivio senza modificarli'))));
    drawGrid(assets);

    async function refreshGrid() {
      try { const r = await app.api.assets(f); drawGrid(r.assets); } catch (e) { toast(e.message); }
    }

    function drawGrid(list) {
      if (!list.length) {
        clear(gridWrap, any
          ? stateBox('—', 'Nessuna immagine con questi filtri', 'Togli un filtro per vedere di più.', h('button', { class: 'btn', onclick: () => { Object.assign(f, { q: '', tag: '', rights: '', origin: '', choice: '' }); app.render(); } }, 'Togli i filtri'))
          : stateBox('0', f.kind === 'variante' ? 'Ancora nessuna variante' : "L'archivio è vuoto", f.kind === 'variante' ? 'Le varianti nascono sulla tela e nel laboratorio.' : 'Trascina qui fotografie, scansioni o file digitali, incolla un indirizzo, cerca negli archivi. Oppure parti senza immagini.',
            h('button', { class: 'btn', onclick: () => fileIn.click() }, 'Scegli file…'), h('button', { class: 'btn', onclick: () => app.go('cerca') }, 'Cerca negli archivi'), h('button', { class: 'btn btn--quiet', onclick: () => app.go('genesi') }, 'Parti da zero →')));
        if (!any && f.kind !== 'variante') gridWrap.querySelector('.state__box')?.append(h('button', { class: 'link', onclick: async (e) => { e.target.textContent = 'Importo…'; try { const r = await app.api.samples(); toast(`${r.assets.length} immagini di esempio importate`); app.refreshStatus(); app.render(); } catch (err) { toast(err.message); } } }, 'Oppure carica 18 fotografie di esempio (Met Museum, pubblico dominio)'));
        return;
      }
      const phone = matchMedia('(max-width: 760px)').matches;
      const cols = phone ? 3 : { S: 8, M: 6, L: 4 }[density];
      const row = phone ? 150 : { S: 150, M: 210, L: 300 }[density];
      const tiles = list.map((a, i) => {
        const r = a.width / a.height;
        const cls = r > 1.6 ? ' tile--wide' : (i % 9 === 4 && r < 0.9 ? ' tile--tall' : '');
        const t = h('button', { class: 'tile' + cls, 'aria-selected': String(sel.has(a.id) || app.state.side.assetId === a.id), 'data-marked': String(!!a.marked), title: a.title,
          onclick: (e) => {
            if (e.shiftKey || e.metaKey || e.ctrlKey || sel.size) toggle(a.id, t);
            else { app.openSide('scheda', a.id, null); document.querySelectorAll('.sheet .tile').forEach((x) => x.setAttribute('aria-selected', String(sel.has(x.dataset.id)))); t.setAttribute('aria-selected', 'true'); }
          },
          'data-id': a.id },
          h('span', { class: 'tile__img' }, h('img', { src: a.thumbUrl, alt: a.title, loading: 'lazy' })),
          h('span', { class: 'tile__info' },
            h('span', { class: 'tile__num' }, String(i + 1).padStart(2, '0')),
            h('span', { class: 'tile__code' }, code(a.title)),
            h('span', { class: 'tile__cat' }, a.tags[0] || a.origin.archive || a.origin.type),
            h('span', { class: 'tile__foot' }, h('span', {}, a.origin.author || ''), h('span', {}, `${a.width}×${a.height}`))),
          h('span', { class: 'tile__rebate' }, h('b', {}, String(i + 1).padStart(2, '0')), ` ${code(a.title)}`, h('span', {}, `${a.choice || (a.kind === 'variante' ? 'variante' : '')}${a.choice || a.kind === 'variante' ? ' · ' : ''}${rightsShort(a.rights.status)}`)));
        // Pressione lunga su iPhone = selezione multipla.
        let lp;
        t.addEventListener('touchstart', () => { lp = setTimeout(() => { lp = 'done'; toggle(a.id, t); navigator.vibrate?.(10); }, 450); }, { passive: true });
        t.addEventListener('touchend', (e) => { if (lp === 'done') e.preventDefault(); clearTimeout(lp); lp = null; });
        t.addEventListener('touchmove', () => { clearTimeout(lp); lp = null; }, { passive: true });
        return t;
      });
      const info = h('div', { class: 'tile tile--text' }, h('span', { class: 'label' }, 'Selezione multipla'),
        h('span', { class: 'muted', style: { fontSize: '12px', lineHeight: 1.5 } }, matchMedia('(pointer: coarse)').matches ? 'Tieni premuta una cella per selezionarne più di una, poi portale sulla tela.' : 'Maiusc + clic per selezionare più immagini e portarle insieme sulla tela.'),
        h('span', { class: 'muted', style: { fontSize: '11px', marginTop: 'auto', lineHeight: 1.5 } }, "Il laboratorio non decide quando un'opera è finita. Lo decidi tu."));
      tiles.splice(Math.min(2, tiles.length), 0, info);
      clear(gridWrap, h('div', { class: 'sheet', style: { '--cols': cols, '--row': `${row}px` } }, tiles));
    }

    function toggle(id, t) {
      if (sel.has(id)) sel.delete(id); else sel.add(id);
      f.selected = [...sel];
      t.setAttribute('aria-selected', String(sel.has(id)));
      toTela.disabled = !sel.size;
      drawGuide();
      toTela.textContent = sel.size > 1 ? `Porta ${sel.size} sulla tela →` : 'Porta sulla tela →';
    }

    async function importFiles(files) {
      const list = [...(files || [])].filter((x) => x.type.startsWith('image/') || /\.(heic|heif|tiff?|dng|webp|avif)$/i.test(x.name));
      if (!list.length) return toast('Nessuna immagine nei file scelti.');
      toast(`Importo ${list.length} ${list.length === 1 ? 'immagine' : 'immagini'}…`);
      try {
        const r = await app.api.upload(list);
        if (r.errors?.length) toast(`Non importate: ${r.errors.join('; ')}`);
        else toast(`${r.assets.length} ${r.assets.length === 1 ? 'immagine importata' : 'immagini importate'}. Provenienza e diritti da completare.`);
        if (r.assets[0]) app.state.side.assetId = r.assets[0].id;
        f.kind = 'sorgente';
        app.refreshStatus();
        app.render();
        if (r.assets[0]) app.openSide('scheda', r.assets[0].id);
      } catch (e) { toast(e.message); }
    }

    async function importUrl() {
      const v = urlIn.value.trim();
      if (!/^https?:\/\//.test(v)) return toast('Incolla un indirizzo che inizia con http:// o https://');
      toast('Scarico l\'immagine…');
      try {
        const r = await app.api.importUrl(v);
        toast("Importata. Controlla i diritti prima di usarla in un'opera.");
        app.render(); app.openSide('scheda', r.asset.id);
      } catch (e) { toast(e.message); }
    }

    // Trascina e rilascia (Mac).
    const drop = pane.querySelector('#drop');
    let depth = 0;
    pane.addEventListener('dragenter', (e) => { if (![...e.dataTransfer.types].includes('Files')) return; e.preventDefault(); depth++; drop.dataset.active = 'true'; });
    pane.addEventListener('dragover', (e) => e.preventDefault());
    pane.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; drop.dataset.active = 'false'; } });
    pane.addEventListener('drop', (e) => {
      e.preventDefault(); depth = 0; drop.dataset.active = 'false';
      if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files);
      else { const u = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain'); if (/^https?:/.test(u)) { urlIn.value = u; importUrl(); } }
    });
    document.onkeydown = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'o' && app.state.view === 'archivio') { e.preventDefault(); fileIn.click(); } };
  },
};

function rightsShort(s) {
  return { libero: 'libero', 'con attribuzione': 'CC BY', 'da verificare': 'diritti ?', riservato: 'riservato', mio: 'mio' }[s] || s;
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
