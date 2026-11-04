// 4 · Esporta: le versioni scelte, alla risoluzione piena, per Lightroom.
import { h, clear, toast, code, stateBox, spinner, guide, fmtBytes, labelN } from '../ui.js';

let sel = null;         // id selezionati (null = parti dalle scelte)
let fmt = 'tiff16';
let done = null;        // ultimo risultato
const RANK = { finita: 0, scelta: 1, 'in esame': 2, '': 3 };

export default {
  async render(root, app) {
    const box = h('div', { class: 'screen' }, spinner('Raccolgo le versioni…'));
    root.append(box);
    let assets = [], formats = [];
    try {
      [assets, formats] = await Promise.all([app.api.assets({ kind: 'tutte' }).then((r) => r.assets), app.api.exportFormats()]);
    } catch (e) { clear(box, stateBox('!', 'Non riesco a preparare l\'esportazione', e.message)); return; }
    const chosen = (a) => a.marked || a.choice === 'scelta' || a.choice === 'finita';
    const cand = assets.filter((a) => a.choice !== 'scartata')
      .sort((a, b) => (chosen(b) - chosen(a)) || (RANK[a.choice] - RANK[b.choice]) || ((b.kind === 'variante') - (a.kind === 'variante')));
    if (!sel) sel = new Set(cand.filter(chosen).map((a) => a.id));
    for (const id of [...sel]) if (!cand.some((a) => a.id === id)) sel.delete(id);
    const picked = () => cand.filter((a) => sel.has(a.id));

    if (!cand.length) {
      clear(box, guideFor(0), stateBox('∅', 'Niente da esportare, per ora', 'Le versioni che segni come scelte nel laboratorio arrivano qui, in cima.', h('button', { class: 'btn', onclick: () => app.go('laboratorio') }, 'Vai al laboratorio')));
      return;
    }

    const gBox = h('div');
    const countEl = h('span', { class: 'meta' });
    const right = h('div', { class: 'form-col' });
    const tiles = cand.map((a) => {
      const mark = h('b', {});
      const t = h('button', { class: 'tile', 'data-marked': String(!!a.marked), title: a.title, onclick: () => { sel.has(a.id) ? sel.delete(a.id) : sel.add(a.id); paint(); } },
        h('span', { class: 'tile__img' }, h('img', { src: a.thumbUrl, alt: a.title, loading: 'lazy' })),
        h('span', { class: 'tile__info' }, h('span', { class: 'tile__num' }, `${a.width}×${a.height}`), h('span', { class: 'tile__code', style: { fontSize: '30px' } }, code(a.title)), h('span', { class: 'tile__cat' }, a.choice || (a.kind === 'variante' ? 'variante' : 'sorgente'))),
        h('span', { class: 'tile__rebate' }, mark, h('span', {}, a.choice || (a.kind === 'variante' ? 'variante' : 'sorgente'))));
      t._paint = () => { const on = sel.has(a.id); t.setAttribute('aria-selected', String(on)); mark.textContent = `${on ? '■' : '□'} ${code(a.title)}`; };
      return t;
    });
    const nChosen = cand.filter(chosen).length;
    clear(box, gBox, h('div', { class: 'view view--two' },
      h('div', { class: 'pane' },
        h('div', { class: 'pane__head' }, h('h1', { class: 'title' }, 'Esporta'), countEl,
          h('div', { class: 'pane__tools' },
            h('button', { class: 'btn btn--quiet', onclick: () => { sel = new Set(cand.filter(chosen).map((a) => a.id)); paint(); } }, `Solo le scelte (${nChosen})`),
            h('button', { class: 'btn btn--quiet', onclick: () => { sel = new Set(); paint(); } }, 'Nessuna'))),
        h('div', { class: 'vgrid', style: { '--cols': 3 } }, tiles)),
      h('div', { class: 'pane' }, right)));
    paint();

    function guideFor(k) {
      return guide(4, 'Esporta per Lightroom', [
        ['Scegli le versioni', `${k} ${k === 1 ? 'selezionata' : 'selezionate'} · le tue scelte sono in cima`, k > 0],
        ['Formato', 'TIFF 16 bit consigliato, dimensione nativa', k > 0],
        ['Esporta', 'file accanto alla scheda .json con tutta la storia', !!done],
      ], null);
    }

    function paint() {
      tiles.forEach((t) => t._paint());
      const list = picked();
      countEl.textContent = `${list.length} di ${cand.length} selezionate`;
      clear(gBox, guideFor(list.length));
      const first = list[0];
      const bytes = list.reduce((s, a) => s + a.width * a.height * 6, 0);
      const go = h('button', { class: 'btn btn--solid btn--lg', disabled: !list.length, onclick: () => run(list, go) }, `Esporta ${list.length} ${list.length === 1 ? 'file' : 'file'}`);
      clear(right,
        h('div', { class: 'stack' }, labelN(2, 'Formato'),
          h('div', { class: 'choice' }, formats.map((f) => h('label', { class: 'choice__opt' },
            h('input', { type: 'radio', name: 'efmt', value: f.id, checked: f.id === fmt, onchange: () => { fmt = f.id; paint(); } }),
            h('span', {}, h('span', { style: { display: 'block', fontSize: '13px' } }, f.name), h('span', { class: 'muted', style: { fontSize: '12px' } }, f.note)),
            h('span', { class: 'meta' }, f.id === 'tiff16' && fmt === 'tiff16' && list.length ? `~${fmtBytes(bytes)}` : ''))))),
        h('dl', { class: 'dl' },
          h('dt', {}, 'Dimensione'), h('dd', {}, first ? `Nativa, la massima disponibile${list.length === 1 ? `: ${first.width} × ${first.height} px` : ''}. Nessun ingrandimento.` : '—'),
          h('dt', {}, 'Colore'), h('dd', {}, 'Profilo della sorgente incorporato, altrimenti sRGB. Nessuna conversione silenziosa.'),
          h('dt', {}, 'Cartella'), h('dd', { class: 'meta' }, h('b', {}, app.status?.dataDir ? `${app.status.dataDir}/export` : app.api.mode === 'demo' ? 'Download del browser' : 'dati/export')),
          h('dt', {}, 'Accanto'), h('dd', {}, 'Un file .json con sorgenti, diritti, processi, parametri, semi e le tue note dal quaderno.')),
        h('div', { class: 'notice' }, h('span', {}, "L'esportazione non dichiara finita nessuna opera. Le versioni restano nel laboratorio come le hai lasciate. In Lightroom: File → Importa, oppure trascina la cartella.")),
        h('div', { class: 'stack' }, labelN(3, 'Esporta'), h('div', { class: 'row' }, go)),
        done ? doneBox() : null);
    }

    function doneBox() {
      return h('div', { class: 'notice' }, h('div', { class: 'stack', style: { width: '100%' } },
        h('span', {}, `${done.ok.length} ${done.ok.length === 1 ? 'file esportato' : 'file esportati'}${done.err.length ? `, ${done.err.length} non riusciti` : ''}.`),
        done.ok.map((r) => h('div', { class: 'row' }, h('span', { class: 'meta', style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' } }, h('b', {}, r.file), ` · ${fmtBytes(r.bytes)}`),
          h('a', { class: 'link', href: r.url, download: r.file }, 'Scarica'), h('a', { class: 'link', href: r.sheetUrl, download: r.file.replace(/\.[^.]+$/, '.atelier.json') }, '.json'))),
        done.err.map((m) => h('span', { class: 'meta' }, m)),
        app.status?.platform === 'darwin' && app.api.mode !== 'demo' && done.ok[0] ? h('button', { class: 'btn', style: { alignSelf: 'flex-start' }, onclick: () => app.api.reveal(done.ok[0].path) }, 'Mostra nel Finder') : null));
    }

    async function run(list, btn) {
      btn.disabled = true;
      const ok = [], err = [];
      for (const [i, a] of list.entries()) {
        btn.textContent = `Esporto ${i + 1} di ${list.length}…`;
        try { ok.push(await app.api.exportAsset(a.id, fmt)); } catch (e) { err.push(`${a.title}: ${e.message}`); }
      }
      done = { ok, err };
      toast(`${ok.length} ${ok.length === 1 ? 'file pronto' : 'file pronti'} per Lightroom.`);
      paint();
    }
  },
};
