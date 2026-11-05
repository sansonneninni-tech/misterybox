// 02 · Cerca: archivi del mondo dentro ATELIER. Anteprima e importazione
// senza uscire dall'app, con provenienza e licenza registrate.
import { h, clear, toast, dialog, spinner, stateBox, code } from '../ui.js';
import { sourceTabs } from './foto.js';

let last = { q: '', results: [] };
const RIGHT_LABEL = { libero: 'libero', 'con attribuzione': 'attribuzione', 'da verificare': 'da verificare' };
const SUGGEST = ['nebbia', 'radiografia', 'erbario', 'eclissi', 'manichino', 'cristalli al microscopio', 'rovine', 'specchio', 'spiritismo', 'superficie lunare', 'anatomia', 'cianotipia'];

export default {
  async render(root, app) {
    const s = app.state.search;
    let archives = [];
    try { archives = (await app.api.archives()).archives; } catch (e) { toast(e.message); }
    const input = h('input', { class: 'field field--search', type: 'search', placeholder: 'Cerca: un soggetto, una materia, un\'epoca…', value: last.q || s.q, enterkeyhint: 'search', onkeydown: (e) => { if (e.key === 'Enter') run(); } });
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
        h('div', { class: 'field-row' }, input, h('button', { class: 'btn btn--solid', onclick: () => run() }, 'Cerca')),
        h('div', { class: 's-label' }, 'In quali archivi'), toggles,
        h('div', { class: 'row meta' }, 'Prova: ', SUGGEST.map((w) => h('button', { class: 'link meta', onclick: () => { input.value = w; run(); } }, w)))),
      results);
    root.append(view);
    if (last.results.length) draw(); else clear(results, stateBox('?', 'Cosa cerchi?', 'Fotografie storiche, tavole scientifiche, opere di musei, immagini della NASA, fondi d\'archivio. Scegli gli archivi qui sopra: Openverse da solo ne raccoglie centinaia di milioni.'));

    // Una ricerca chiede la prima pagina a ogni archivio; poi ogni riga si
    // allunga da sola, una pagina alla volta, mentre la scorri.
    async function run() {
      const q = input.value.trim();
      if (!q) return toast('Scrivi cosa cercare.');
      if (!s.archives.length) return toast('Scegli almeno un archivio.');
      s.q = q;
      clear(results, spinner(`Cerco «${q}» in ${s.archives.length} archivi…`));
      try {
        const r = await app.api.searchArchives(q, s.archives, 1);
        last = { q, results: r.results.map((x) => ({ ...x, page: 1, done: !x.ok || !x.more })) };
        draw();
      } catch (e) { clear(results, h('div', { class: 'notice' }, e.message)); }
    }

    function draw() {
      clear(results, last.results.map((r) => block(r)));
    }

    function block(r) {
      if (!r.ok) return h('section', { class: 'results__arch' }, h('div', { class: 'results__head' }, h('span', { class: 'label' }, r.name), h('span', { class: 'meta' }, r.error)));
      if (!r.items.length) return h('section', { class: 'results__arch' }, h('div', { class: 'results__head' }, h('span', { class: 'label' }, r.name), h('span', { class: 'meta' }, 'nessun risultato')));
      const count = h('span', { class: 'meta' });
      const row = h('div', { class: 's-row', 'aria-label': `Risultati di ${r.name}` });
      r.loading = false;
      const end = h('div', { class: 's-row__end' });
      const step = (dir) => row.scrollBy({ left: dir * row.clientWidth * 0.85, behavior: 'smooth' });
      const head = h('div', { class: 'results__head s-row__head' },
        h('span', { class: 'label' }, r.name), count,
        h('span', { class: 's-row__nav' },
          h('button', { class: 'btn btn--quiet', 'aria-label': `Indietro in ${r.name}`, onclick: () => step(-1) }, '‹'),
          h('button', { class: 'btn btn--quiet', 'aria-label': `Avanti in ${r.name}`, onclick: () => step(1) }, '›')));
      row.append(...r.items.map((it) => tile(it)), end);
      const say = () => {
        const tot = r.total ?? r.items.length;
        count.textContent = `${tot.toLocaleString('it-IT')} risultati · ne vedi ${r.items.length.toLocaleString('it-IT')}`;
        if (r.loading) clear(end, spinner('Carico i prossimi…'));
        else if (r.error2) clear(end, h('p', { class: 'meta' }, r.error2), h('button', { class: 'btn', onclick: () => { r.error2 = null; r.retry = 0; more(); } }, 'Riprova'));
        else if (r.done) clear(end, h('p', { class: 'meta' }, r.items.length < tot
          ? `Fine. ${r.name} conta ${tot.toLocaleString('it-IT')} risultati ma ne mostra ${r.items.length.toLocaleString('it-IT')}: gli altri non hanno un'immagine libera o l'archivio non li lascia sfogliare oltre. Prova una parola più precisa.`
          : 'Fine dei risultati.'));
        else clear(end, h('button', { class: 'btn', onclick: more }, 'Carica altri'));
      };
      async function more() {
        if (r.loading || r.done || r.error2) return;
        r.loading = true; say();
        try {
          const x = (await app.api.searchArchives(last.q, [r.archive], r.page + 1)).results[0];
          if (!x?.ok) throw new Error(x?.error || 'l\'archivio non risponde');
          const seen = new Set(r.items.map((i) => i.id));
          const fresh = x.items.filter((i) => !seen.has(i.id));
          r.page += 1;
          r.items.push(...fresh);
          if (x.total != null) r.total = x.total;
          end.before(...fresh.map((it) => tile(it)));
          // Alcuni archivi ripetono una pagina: si prosegue, e ci si ferma solo
          // quando non ne hanno altre o cinque pagine di fila non portano niente di nuovo.
          r.empty = fresh.length ? 0 : (r.empty || 0) + 1;
          if (!x.more || r.empty >= 5) r.done = true;
          r.retry = 0;
        } catch (e) {
          // Un archivio lento o che chiede di rallentare: riprovo da solo tre volte,
          // aspettando sempre di più, poi chiedo.
          if ((r.retry || 0) < 3) { r.retry = (r.retry || 0) + 1; r.loading = false; return setTimeout(more, [2000, 5000, 10000][r.retry - 1]); }
          r.error2 = `Non riesco a caricarne altri: ${e.message.replace(/\.$/, '')}.`;
        }
        r.loading = false; say();
        // Se la pagina era già vista, o sei ancora vicino alla fine, continua da sola.
        requestAnimationFrame(() => { if (!r.done && (r.empty > 0 || near())) more(); });
      }
      say();
      // Caricamento a scaglioni: la pagina successiva parte quando mancano un paio
      // di schermate alla fine, perché alcuni archivi (Openverse) impiegano più di
      // 10 secondi a rispondere.
      const near = () => row.scrollWidth - row.scrollLeft - row.clientWidth < Math.max(2400, row.clientWidth * 2);
      row.addEventListener('scroll', () => { if (near()) more(); }, { passive: true });
      requestAnimationFrame(() => { if (near()) more(); });
      return h('section', { class: 'results__arch' }, head, row);
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
