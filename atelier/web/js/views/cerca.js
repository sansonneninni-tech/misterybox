// 02 · Cerca: archivi del mondo dentro ATELIER. Anteprima e importazione
// senza uscire dall'app, con provenienza e licenza registrate.
import { h, clear, toast, dialog, spinner, stateBox, code } from '../ui.js';
import { sourceTabs } from './foto.js';

let last = { q: '', results: [], page: 1 };
const RIGHT_LABEL = { libero: 'libero', 'con attribuzione': 'attribuzione', 'da verificare': 'da verificare' };
const SUGGEST = ['nebbia', 'radiografia', 'erbario', 'eclissi', 'manichino', 'cristalli al microscopio', 'rovine', 'specchio', 'spiritismo', 'superficie lunare', 'anatomia', 'cianotipia'];

export default {
  async render(root, app) {
    const s = app.state.search;
    let archives = [];
    try { archives = (await app.api.archives()).archives; } catch (e) { toast(e.message); }
    const input = h('input', { class: 'field field--search', type: 'search', placeholder: 'Cerca: un soggetto, una materia, un\'epoca…', value: last.q || s.q, enterkeyhint: 'search', onkeydown: (e) => { if (e.key === 'Enter') run(1); } });
    const toggles = h('div', { class: 'tags' }, archives.map((a) => h('button', { class: 'tag', title: a.description, 'aria-pressed': String(s.archives.includes(a.id)), onclick: (e) => {
      s.archives = s.archives.includes(a.id) ? s.archives.filter((x) => x !== a.id) : [...s.archives, a.id];
      e.currentTarget.setAttribute('aria-pressed', String(s.archives.includes(a.id)));
      app.persist();
    } }, a.name)));
    const results = h('div', { class: 'results' });
    const view = h('div', { class: 's-screen s-cerca' },
      h('header', { class: 's-head' }, sourceTabs(app, 'cerca'),
        h('h1', { class: 's-title' }, 'Cerca negli archivi del mondo'),
        h('p', { class: 's-hint' }, 'Musei e archivi aperti, senza uscire da qui. Tocca un risultato per vedere autore e licenza, poi aggiungilo alle tue foto.')),
      h('div', { class: 'search' },
        h('div', { class: 'field-row' }, input, h('button', { class: 'btn btn--solid', onclick: () => run(1) }, 'Cerca')),
        h('div', { class: 's-label' }, 'In quali archivi'), toggles,
        h('div', { class: 'row meta' }, 'Prova: ', SUGGEST.map((w) => h('button', { class: 'link meta', onclick: () => { input.value = w; run(1); } }, w)))),
      results);
    root.append(view);
    if (last.results.length) draw(); else clear(results, stateBox('?', 'Cosa cerchi?', 'Fotografie storiche, tavole scientifiche, opere di musei, immagini della NASA, fondi d\'archivio. Scegli gli archivi qui sopra: Openverse da solo ne raccoglie centinaia di milioni.'));

    async function run(page) {
      const q = input.value.trim();
      if (!q) return toast('Scrivi cosa cercare.');
      if (!s.archives.length) return toast('Scegli almeno un archivio.');
      s.q = q;
      clear(results, spinner(`Cerco «${q}» in ${s.archives.length} archivi…`));
      try {
        const r = await app.api.searchArchives(q, s.archives, page);
        last = { q, results: page > 1 ? mergePages(last.results, r.results) : r.results, page };
        draw();
      } catch (e) { clear(results, h('div', { class: 'notice' }, e.message)); }
    }

    function draw() {
      const blocks = last.results.map((r) => {
        if (!r.ok) return h('section', { class: 'results__arch' }, h('div', { class: 'results__head' }, h('span', { class: 'label' }, r.name), h('span', { class: 'meta' }, r.error)));
        return h('section', { class: 'results__arch' },
          h('div', { class: 'results__head' }, h('span', { class: 'label' }, r.name), h('span', { class: 'meta' }, r.items.length ? `${r.total?.toLocaleString('it-IT') ?? r.items.length} risultati` : 'nessun risultato')),
          r.items.length ? h('div', { class: 'vgrid', style: { '--cols': 6 } }, r.items.map((it) => tile(it))) : null);
      });
      clear(results, blocks, h('div', { class: 'row', style: { padding: '16px' } }, h('button', { class: 'btn', onclick: () => run(last.page + 1) }, 'Altri risultati')));
    }

    function tile(it) {
      return h('button', { class: 'tile', title: it.title, onclick: () => preview(it) },
        h('span', { class: 'tile__img' }, h('img', { src: it.thumb, alt: it.title, loading: 'lazy', referrerpolicy: 'no-referrer', onerror: (e) => { e.target.closest('.tile').hidden = true; } })),
        h('span', { class: 'tile__info' }, h('span', { class: 'tile__code', style: { fontSize: '26px' } }, code(it.title)), h('span', { class: 'tile__cat' }, it.author?.slice(0, 40) || '')),
        h('span', { class: 'tile__rebate' }, h('b', {}, code(it.title)), h('span', {}, RIGHT_LABEL[it.rightsStatus] || 'diritti ?')));
    }

    function preview(it) {
      const status = h('div');
      const doImport = async (thenTela) => {
        clear(status, spinner('Scarico alla risoluzione più alta disponibile…'));
        try {
          const r = await app.api.importFromArchive(it);
          d.close();
          app.refreshStatus();
          if (thenTela) return app.toTela([r.asset.id]);
          app.added([r.asset.id]);
          toast(`Aggiunta alle tue foto: ${r.asset.width} × ${r.asset.height} px.`, { label: 'Vai alle tue foto', run: () => app.go('archivio') });
        } catch (e) { clear(status, h('div', { class: 'notice' }, `Non riesco ad aggiungerla: ${e.message}. Prova un altro risultato.`)); }
      };
      const d = dialog({
        title: it.title,
        wide: true,
        body: [
          h('div', { class: 'preview' },
            h('div', { class: 'preview__img' }, h('img', { src: it.thumb, alt: it.title, referrerpolicy: 'no-referrer' })),
            h('div', { class: 'stack' },
              h('h2', { class: 'title', style: { fontSize: '22px' } }, it.title),
              h('dl', { class: 'dl' },
                it.author ? [h('dt', {}, 'Autore'), h('dd', {}, it.author)] : null,
                it.date ? [h('dt', {}, 'Data'), h('dd', {}, it.date)] : null,
                h('dt', {}, 'Archivio'), h('dd', {}, last.results.find((r) => r.archive === it.archive)?.name || it.archive, it.via ? ` · via ${it.via}` : ''),
                it.width ? [h('dt', {}, 'Originale'), h('dd', { class: 'meta' }, `${it.width} × ${it.height} px`)] : null,
                it.page ? [h('dt', {}, 'Pagina'), h('dd', {}, h('a', { class: 'link', href: it.page, target: '_blank', rel: 'noopener' }, 'Scheda dell\'archivio ↗'))] : null),
              h('div', { class: 'rights' },
                h('div', { class: 'rights__state' }, h('span', { class: 'dot' + (it.rightsStatus === 'libero' ? '' : ' dot--off') }), h('span', {}, it.license || 'Licenza non indicata')),
                it.attribution ? h('span', { class: 'meta' }, `Attribuzione: ${it.attribution.slice(0, 200)}`) : null,
                h('span', { class: 'meta' }, it.rightsStatus === 'libero' ? 'Riutilizzabile liberamente.' : it.rightsStatus === 'con attribuzione' ? "Riutilizzabile citando l'autore." : 'Verifica i diritti prima di usarla in un\'opera pubblicata.')),
              status)),
        ],
        foot: [h('span', { class: 'spacer' }),
          h('button', { class: 'btn', onclick: () => doImport(false) }, 'Aggiungi alle mie foto'),
          h('button', { class: 'btn btn--solid', onclick: () => doImport(true) }, 'Aggiungi e trasformala')],
      });
    }
  },
};

function mergePages(prev, next) {
  return next.map((r) => {
    const p = prev.find((x) => x.archive === r.archive);
    if (!p || !r.ok) return p || r;
    const seen = new Set(p.items.map((i) => i.id));
    return { ...r, items: [...p.items, ...r.items.filter((i) => !seen.has(i.id))] };
  });
}
