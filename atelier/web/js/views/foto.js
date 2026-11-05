// Passo 1 · Scegli: le tue foto (o gli archivi del mondo). Si aggiungono e si
// toccano quelle da trasformare. Provenienza e diritti sono sempre in vista.
import { h, clear, toast, stateBox, spinner } from '../ui.js';

let selected = new Set();
let fresh = new Set();      // appena aggiunte: bordo bianco per due secondi
let q = '';
let tag = '';

const RIGHTS = { libero: 'libero', 'con attribuzione': 'con attribuzione', 'da verificare': 'diritti da verificare', riservato: 'riservato', mio: 'tuo' };
export const rightsLabel = (s) => RIGHTS[s] || s || 'diritti da verificare';
export function originLabel(a) {
  const o = a.origin || {};
  if (o.type === 'upload') return 'tua foto';
  if (o.type === 'algoritmo') return 'da zero';
  if (o.type === 'generata') return 'generata';
  if (o.archive) return o.author ? `${o.archive} · ${o.author}` : o.archive;
  if (o.type === 'url') { try { return new URL(o.url).hostname.replace(/^www\./, ''); } catch { return 'da indirizzo'; } }
  return o.author || o.type || '';
}

// Le due schede del passo 1: le tue foto e gli archivi del mondo.
export function sourceTabs(app, cur) {
  return h('div', { class: 's-tabs', role: 'tablist' },
    [['archivio', 'Le tue foto'], ['cerca', 'Cerca negli archivi']].map(([v, l]) =>
      h('button', { class: 's-tab', role: 'tab', 'aria-selected': String(cur === v), onclick: () => cur !== v && app.go(v) }, l)));
}

export default {
  async render(root, app) {
    const box = h('div', { class: 's-screen' }, spinner('Apro le tue foto…'));
    root.append(box);
    let assets;
    try { assets = (await app.api.assets({ kind: 'sorgente' })).assets; }
    catch (e) { clear(box, stateBox('!', 'Le foto non si aprono', `${e.message}. I file sono al sicuro: niente è stato toccato.`, h('button', { class: 'btn', onclick: () => app.render() }, 'Riprova'))); return; }
    for (const id of [...selected]) if (!assets.some((a) => a.id === id)) selected.delete(id);
    // Le foto appena aggiunte vanno in cima.
    assets.sort((a, b) => (fresh.has(b.id) - fresh.has(a.id)));

    const pick = () => app.pickFiles();
    const cta = h('div', { class: 's-cta' });
    const grid = h('div', { class: 's-grid' });

    const urlIn = h('input', { class: 'field s-url__in', type: 'url', inputmode: 'url', placeholder: 'Incolla un indirizzo di un\'immagine (https://…)', enterkeyhint: 'go', onkeydown: (e) => { if (e.key === 'Enter') fromUrl(); } });
    const urlBtn = h('button', { class: 'btn', onclick: fromUrl }, 'Aggiungi');
    const urlMsg = h('span', { class: 's-url__msg', role: 'status' });
    const urlRow = h('div', { class: 's-url' }, h('div', { class: 's-url__row' }, urlIn, urlBtn), urlMsg);

    const head = h('header', { class: 's-head' },
      sourceTabs(app, 'archivio'),
      h('h1', { class: 's-title' }, assets.length ? 'Scegli le foto da trasformare' : 'Aggiungi le tue foto'),
      h('p', { class: 's-hint' }, assets.length
        ? 'Tocca una o più foto. Con due o più puoi affiancarle e combinarle.'
        : 'Gli originali non vengono mai modificati. Provenienza e diritti restano scritti accanto a ogni foto.'),
      assets.length ? h('div', { class: 's-head__acts' },
        h('button', { class: 'btn btn--lg', onclick: pick }, '+ Aggiungi foto'),
        h('button', { class: 'btn btn--lg btn--quiet', onclick: () => app.startFromZero() }, 'Parti da zero')) : null);

    if (!assets.length) {
      clear(box, head,
        h('div', { class: 's-empty' },
          h('button', { class: 's-drop', onclick: pick },
            h('span', { class: 's-drop__plus' }, '+'),
            h('span', { class: 's-drop__t' }, app.isPhone() ? 'Tocca qui per scegliere dalle tue Foto' : 'Trascina qui le foto, o clicca per sceglierle'),
            h('span', { class: 's-drop__d' }, 'JPEG, PNG, TIFF, WebP · anche più foto insieme')),
          urlRow,
          h('div', { class: 's-empty__alt' },
            h('button', { class: 'link', onclick: () => app.go('cerca') }, 'Cerca negli archivi del mondo'),
            h('span', { class: 'muted' }, '·'),
            h('button', { class: 'link', onclick: samples }, 'Prova con 18 foto di esempio'),
            h('span', { class: 'muted' }, '·'),
            h('button', { class: 'link', onclick: () => app.startFromZero() }, 'oppure parti da zero'))),
        cta);
      clear(cta, h('button', { class: 'btn btn--solid s-cta__btn', onclick: pick }, 'Aggiungi foto'),
        h('span', { class: 's-cta__why' }, 'Dal Mac puoi anche trascinarle in qualunque punto della finestra.'));
      return;
    }

    for (const a of assets) {
      const t = h('button', { class: 's-ph', 'aria-pressed': String(selected.has(a.id)), 'data-fresh': String(fresh.has(a.id)), 'aria-label': a.title },
        h('img', { src: a.thumbUrl, alt: '', loading: 'lazy' }),
        h('span', { class: 's-ph__check', 'aria-hidden': 'true' }, '✓'));
      t.onclick = () => { selected.has(a.id) ? selected.delete(a.id) : selected.add(a.id); t.setAttribute('aria-pressed', String(selected.has(a.id))); drawCta(); };
      const info = h('button', { class: 's-ph__info', 'aria-label': `Dettagli di ${a.title}: provenienza, diritti, note`, title: 'Dettagli: provenienza, diritti, note', onclick: () => app.openSide('scheda', a.id, null) }, 'i');
      const r = a.rights?.status;
      const meta = h('div', { class: 's-ph__meta' },
        h('span', { class: 's-ph__t' }, a.title),
        h('span', { class: 's-ph__o', 'data-rights': r || '' }, `${originLabel(a)} · ${rightsLabel(r)}`));
      grid.append(h('div', { class: 's-ph-wrap', 'data-tags': `|${a.tags.join('|')}|`.toLowerCase(), 'data-text': [a.title, a.origin.author, a.origin.archive, a.notes, ...a.tags].join(' ').toLowerCase() }, t, info, meta));
    }
    if (fresh.size) setTimeout(() => { fresh.clear(); grid.querySelectorAll('[data-fresh="true"]').forEach((x) => { x.dataset.fresh = 'false'; }); }, 2000);

    // Filtri: testo (con molte foto) e tag più usati.
    const counts = new Map();
    for (const a of assets) for (const t of a.tags) counts.set(t, (counts.get(t) || 0) + 1);
    const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);
    if (tag && !counts.has(tag)) tag = '';
    const tags = top.length ? h('div', { class: 's-chips s-tagbar', 'aria-label': 'Filtra per tag' },
      h('button', { class: 'tag', 'aria-pressed': String(!tag), onclick: () => setTag('') }, 'Tutte'),
      top.map((t) => h('button', { class: 'tag', 'aria-pressed': String(tag === t), onclick: () => setTag(t) }, t))) : null;
    const search = assets.length > 12 ? h('input', { class: 'field s-search', type: 'search', placeholder: 'Cerca tra le tue foto (titolo, autore, archivio, note)', value: q, oninput: (e) => { q = e.target.value; filter(); } }) : null;
    const more = h('details', { class: 's-more' }, h('summary', {}, 'Aggiungi da un indirizzo'), urlRow);
    clear(box, head, search, tags, grid,
      h('div', { class: 's-foot' }, more, h('button', { class: 'link', onclick: samples }, 'Aggiungi le 18 foto di esempio')),
      cta);
    drawCta();
    filter();

    function setTag(t) { tag = t; tags.querySelectorAll('.tag').forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === (t || 'Tutte')))); filter(); }
    function filter() {
      const t = q.toLowerCase().trim();
      for (const w of grid.children) w.hidden = (Boolean(t) && !w.dataset.text.includes(t)) || (Boolean(tag) && !w.dataset.tags.includes(`|${tag.toLowerCase()}|`));
    }
    function drawCta() {
      const n = selected.size;
      clear(cta,
        h('button', { class: 'btn btn--solid s-cta__btn', disabled: !n, onclick: (e) => { const ids = [...selected].slice(0, 4); e.currentTarget.classList.add('is-busy'); e.currentTarget.textContent = 'Preparo…'; selected.clear(); app.toTela(ids); } },
          n ? (n === 1 ? 'Trasforma questa foto' : `Trasforma queste ${Math.min(n, 4)}`) : 'Trasforma le foto scelte'),
        h('span', { class: 's-cta__why' }, n ? (n > 4 ? 'Ne uso al massimo 4 alla volta: le prime 4 che hai toccato.' : n > 1 ? 'Le vedrai affiancate, e potrai combinarle.' : '') : 'Tocca almeno una foto qui sopra.'),
        n ? h('button', { class: 'btn btn--quiet s-cta__alt', onclick: () => { selected.clear(); app.render(); } }, 'Annulla la scelta') : null);
    }
    async function samples(e) {
      e.target.textContent = 'Carico le foto di esempio…';
      try { const r = await app.api.samples(); fresh = new Set(r.assets.map((a) => a.id)); toast(`${r.assets.length} foto di esempio aggiunte (Met Museum, pubblico dominio).`); app.render(); }
      catch (err) { toast(err.message); e.target.textContent = 'Riprova a caricare le foto di esempio'; }
    }
    async function fromUrl() {
      const v = urlIn.value.trim();
      if (!/^https?:\/\//.test(v)) { urlMsg.textContent = 'Incolla un indirizzo che inizia con https:// (o http://).'; urlIn.focus(); return; }
      urlBtn.disabled = true; urlBtn.textContent = 'Scarico…'; urlMsg.textContent = '';
      try {
        const r = await app.api.importUrl(v);
        app.added([r.asset.id]);
        toast('Foto aggiunta. Controlla i diritti prima di usarla in un\'opera.', { label: 'Dettagli', run: () => app.openSide('scheda', r.asset.id, null) });
        app.render();
      } catch (err) { urlMsg.textContent = `Non riesco ad aggiungerla: ${err.message}`; urlBtn.disabled = false; urlBtn.textContent = 'Aggiungi'; }
    }
  },
  // Dopo un caricamento le foto nuove risultano già scelte e in evidenza.
  added(ids) { fresh = new Set(ids); for (const id of ids) selected.add(id); },
  forget(ids) { for (const id of ids) { selected.delete(id); fresh.delete(id); } },
  selectedCount: () => selected.size,
};
