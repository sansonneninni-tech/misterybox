// Passo 3 · Salva: le versioni tenute, alla risoluzione piena, per Lightroom.
// Qui, e solo qui, l'artista può dichiarare finita un'opera.
import { h, clear, toast, spinner, stateBox, fmtBytes } from '../ui.js';

let sel = new Set();         // id da salvare
const seen = new Set();      // le tenute nuove entrano già spuntate
let fmt = 'tiff16';
let done = null;             // ultimo risultato
let showAll = false;         // anche le versioni non tenute

const kept = (a) => a.kind === 'variante' && a.choice !== 'scartata' && (a.marked || a.choice === 'scelta' || a.choice === 'finita');

export default {
  async render(root, app) {
    const box = h('div', { class: 's-screen' }, spinner('Raccolgo le versioni che hai tenuto…'));
    root.append(box);
    let assets = [], formats = [];
    try { [assets, formats] = await Promise.all([app.api.assets({ kind: 'tutte' }).then((r) => r.assets), app.api.exportFormats()]); }
    catch (e) { clear(box, stateBox('!', 'Non riesco a preparare il salvataggio', `${e.message}. Niente è stato perso.`, h('button', { class: 'btn', onclick: () => app.render() }, 'Riprova'))); return; }
    const mine = assets.filter(kept);
    const others = assets.filter((a) => !kept(a) && a.choice !== 'scartata');
    const list = showAll ? [...mine, ...others] : mine;
    for (const a of mine) if (!seen.has(a.id)) { seen.add(a.id); sel.add(a.id); }
    for (const id of [...sel]) if (!list.some((a) => a.id === id)) sel.delete(id);
    if (!formats.some((f) => f.id === fmt)) fmt = formats[0]?.id;

    const head = h('header', { class: 's-head' },
      h('h1', { class: 's-title' }, mine.length ? 'Salva le versioni che hai tenuto' : 'Non hai ancora tenuto nessuna versione'),
      h('p', { class: 's-hint' }, mine.length
        ? 'Escono alla risoluzione piena, con accanto una scheda con tutte le informazioni: provenienza, diritti, processi, versioni, le tue note.'
        : 'Al passo 2 premi «Tieni questa» sulle versioni che ti interessano: arrivano qui.'));

    const cta = h('div', { class: 's-cta' });
    if (!list.length) {
      clear(box, head, h('div', { class: 's-empty' },
        h('button', { class: 'btn btn--lg', onclick: () => app.go('tela') }, '← Torna a Trasforma'),
        others.length ? h('button', { class: 'link', onclick: () => { showAll = true; app.render(); } }, `Mostra anche le altre ${others.length} immagini`) : null), cta);
      clear(cta, h('button', { class: 'btn btn--solid s-cta__btn', disabled: true }, 'Salva le versioni'), h('span', { class: 's-cta__why' }, 'Tieni almeno una versione al passo 2.'));
      return;
    }

    const grid = h('div', { class: 's-grid s-grid--save' }, list.map((a) => card(a)));
    const fmts = h('div', { class: 's-formats', role: 'radiogroup', 'aria-label': 'Formato' }, formats.map((f) => h('label', { class: 's-format' },
      h('input', { type: 'radio', name: 'sfmt', value: f.id, checked: f.id === fmt, onchange: () => { fmt = f.id; drawCta(); } }),
      h('span', { class: 's-format__t' }, f.name, f.id === 'tiff16' ? h('em', {}, ' · consigliato per Lightroom') : null),
      h('span', { class: 's-format__d' }, f.note))));
    const where = app.status?.dataDir ? `${app.status.dataDir}/export` : app.api.mode === 'demo' ? 'nei Download del browser' : 'nella cartella dati/export';
    const result = h('div', { class: 's-result' });

    clear(box, head, grid,
      others.length ? h('button', { class: 'link s-more-link', onclick: () => { showAll = !showAll; app.render(); } }, showAll ? 'Mostra solo quelle tenute' : `Mostra anche le altre ${others.length} immagini (foto e versioni non tenute)`) : null,
      h('section', { class: 's-panel' },
        h('div', { class: 's-label' }, 'Formato'), fmts,
        h('p', { class: 's-hint' }, `Risoluzione piena, nessun ingrandimento. Profilo colore della foto di partenza, altrimenti sRGB. I file finiscono ${where}. In Lightroom: File → Importa.`)),
      result, cta);
    drawCta();
    if (done) drawResult();

    function card(a) {
      const on = () => sel.has(a.id);
      const check = h('input', { type: 'checkbox', checked: on(), 'aria-label': `Salva ${a.title}`, onchange: () => { on() ? sel.delete(a.id) : sel.add(a.id); wrap.dataset.on = String(on()); drawCta(); } });
      const fin = h('input', { type: 'checkbox', checked: a.choice === 'finita', onchange: (e) => finish(a, e.target) });
      const wrap = h('div', { class: 's-save', 'data-on': String(on()), 'data-finita': String(a.choice === 'finita') },
        h('label', { class: 's-save__pick' }, check, h('span', { class: 's-save__img' }, h('img', { src: a.thumbUrl, alt: a.title, loading: 'lazy' }))),
        h('div', { class: 's-save__meta' },
          h('span', { class: 's-save__t' }, a.title),
          h('span', { class: 's-save__d' }, `${a.width} × ${a.height} px`)),
        h('label', { class: 's-save__fin' }, fin, h('span', {}, 'Questa è finita')),
        kept(a) ? h('button', { class: 'link s-save__x', onclick: async () => { try { await app.api.updateAsset(a.id, { marked: false, choice: a.choice === 'finita' ? 'finita' : '' }); sel.delete(a.id); toast('Tolta dalle tenute. Resta nel laboratorio.'); app.render(); } catch (e) { toast(e.message); } } }, 'Togli dalle tenute') : null);
      return wrap;
    }

    // "Questa è finita" è un gesto tuo, esplicito e sempre riapribile.
    async function finish(a, box) {
      const yes = box.checked;
      box.disabled = true;
      try {
        await app.api.updateAsset(a.id, yes ? { choice: 'finita', declaredByArtist: true, marked: true } : { choice: 'scelta' });
        a.choice = yes ? 'finita' : 'scelta';
        box.closest('.s-save').dataset.finita = String(yes);
        toast(yes ? `«${a.title}» è finita: l'hai deciso tu.` : `«${a.title}» è di nuovo aperta.`);
      } catch (e) { box.checked = !yes; toast(e.message); }
      box.disabled = false;
    }

    function drawCta(progress) {
      const n = list.filter((a) => sel.has(a.id)).length;
      const f = formats.find((x) => x.id === fmt);
      const bytes = list.filter((a) => sel.has(a.id)).reduce((s, a) => s + a.width * a.height * (fmt === 'tiff16' ? 6 : 3), 0);
      const btn = h('button', { class: 'btn btn--solid s-cta__btn' + (progress ? ' is-busy' : ''), disabled: !n || !!progress, onclick: run },
        progress || (n ? `Salva ${n} ${n === 1 ? 'versione' : 'versioni'}` : 'Salva le versioni'));
      clear(cta, btn, h('span', { class: 's-cta__why' }, n ? `${f?.name || ''}${fmt === 'tiff16' ? ` · circa ${fmtBytes(bytes)}` : ''}` : 'Spunta almeno una versione qui sopra.'),
        h('button', { class: 'btn btn--quiet s-cta__alt', onclick: () => app.go('tela') }, '← Trasforma'));
    }

    async function run() {
      const todo = list.filter((a) => sel.has(a.id));
      const ok = [], err = [];
      for (const [i, a] of todo.entries()) {
        drawCta(`Salvo ${i + 1} di ${todo.length}…`);
        try { ok.push({ ...(await app.api.exportAsset(a.id, fmt)), title: a.title }); } catch (e) { err.push(`${a.title}: ${e.message}`); }
      }
      done = { ok, err };
      drawCta();
      drawResult();
      toast(err.length ? `${ok.length} salvate, ${err.length} non riuscite.` : `${ok.length} ${ok.length === 1 ? 'versione salvata' : 'versioni salvate'}. Pronte per Lightroom.`);
    }

    function drawResult() {
      clear(result, h('div', { class: 's-panel s-panel--done' },
        h('div', { class: 's-label' }, `${done.ok.length} ${done.ok.length === 1 ? 'file salvato' : 'file salvati'}${done.err.length ? ` · ${done.err.length} non riusciti` : ''}`),
        done.ok.map((r) => h('div', { class: 's-file' },
          h('span', { class: 's-file__n' }, h('b', {}, r.file), ` · ${fmtBytes(r.bytes)}`),
          h('a', { class: 'btn', href: r.url, download: r.file }, 'Scarica'),
          h('a', { class: 'btn btn--quiet', href: r.sheetUrl, download: r.file.replace(/\.[^.]+$/, '.atelier.json') }, 'Scheda'))),
        done.err.map((m) => h('p', { class: 's-err' }, m)),
        app.status?.platform === 'darwin' && app.api.mode !== 'demo' && done.ok[0] ? h('button', { class: 'btn', onclick: () => app.api.reveal(done.ok[0].path) }, 'Mostra nel Finder') : null));
    }
  },
};
