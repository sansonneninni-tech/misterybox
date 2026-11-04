// 01 Archivio: esperimenti e sorgenti (immagini e video), import per
// trascinamento, selettore o indirizzo web, provenienza e diritti.

import { S, touch, addSource, updateSource, removeSource, createExperiment, openExperiment, versionsOf, renameExperiment, deleteExperiment, thumbnail, expById } from '../state.js';
import { h, fill, dialog, toast, seg, confirmDialog, ago, isPhone } from './kit.js';
import { loadMedia, makeThumb } from '../media.js';
import { RECIPES, makePass } from '../engine/recipes.js';
import { defaultClip, normalizeClip, uid } from '../engine/clip.js';

const RIGHTS = ['mia opera', 'pubblico dominio', 'licenza libera (CC)', 'uso concesso', 'da verificare'];
let filter = 'tutte';
let selected = null; // { kind: 'src'|'exp', id }
const recipeThumbs = new Map();

export function render(root, { app }) {
  const mainEl = h('div.arch__main');
  const sideEl = h('div.arch__side');
  root.append(h('div.arch', null, mainEl, sideEl));

  const fileIn = h('input', { type: 'file', multiple: true, accept: 'image/*,video/*,.mov,.mp4,.m4v,.heic', hidden: true, onchange: (e) => { importFiles([...e.target.files]); e.target.value = ''; } });
  const urlIn = h('input.field', { type: 'url', placeholder: 'Indirizzo di un’immagine o di un video', style: { width: '300px' }, 'aria-label': 'Indirizzo da importare' });
  const urlBtn = h('button.btn', { onclick: () => importUrl() }, 'Importa');
  urlIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') importUrl(); });

  function draw() {
    const exps = S.experiments;
    const srcs = S.sources.filter((s) => filter === 'tutte' || (filter === 'immagini' ? s.kind === 'image' : s.kind === 'video'));
    fill(mainEl, 
      h('div.pane__head', null, h('h1.title', null, 'Archivio'), h('span.meta', null, `${exps.length} esperimenti · ${S.sources.length} sorgenti`),
        h('div.pane__tools', null, fileIn, h('button.btn', { onclick: () => fileIn.click() }, 'Importa file'), urlIn, urlBtn)),
      h('div.sect', null, h('div.sect__head', null, h('span.label', null, 'Esperimenti'))),
      h('div.grid-exp', null,
        h('button.exp.exp--new', { onclick: () => newExperiment() },
          h('span.code', null, '+'), h('span.exp__name', null, 'Nuovo esperimento'),
          h('span.about', null, 'Da zero, da una partenza, da immagini o da video.')),
        exps.map((e) => {
          const vs = versionsOf(e.id);
          const marked = vs.filter((v) => v.marked).length;
          const fin = vs.filter((v) => v.status === 'finita').length;
          return h('button.exp', { 'aria-current': String(selected?.kind === 'exp' && selected.id === e.id), onclick: () => { selected = { kind: 'exp', id: e.id }; draw(); }, ondblclick: () => { openExperiment(e.id); app.go('banco'); } },
            h('div.exp__img', null, e.thumb ? h('img', { src: e.thumb, alt: '' }) : null, h('span.exp__code', null, String(vs.length).padStart(2, '0'))),
            h('div.exp__foot', null, h('span.exp__name', null, e.name), fin ? h('span.status-chip', { 'data-s': 'finita' }, 'finita') : marked ? h('span.status-chip', { 'data-s': 'scelta' }, `${marked} segnate`) : h('span.meta', null, ago(e.updated || e.created))));
        })),
      h('div.sect', null, h('div.sect__head', null, h('span.label', null, 'Sorgenti'),
        seg([{ id: 'tutte', label: 'Tutte' }, { id: 'immagini', label: 'Immagini' }, { id: 'video', label: 'Video' }], filter, (v) => { filter = v; draw(); }, { label: 'Filtro sorgenti' }))),
      srcs.length ? h('div.sheet--src', null, srcs.map((s, i) => h('button.tile', { 'aria-selected': String(selected?.kind === 'src' && selected.id === s.id), onclick: () => { selected = { kind: 'src', id: s.id }; draw(); } },
        h('div.tile__img', null, s.thumb ? h('img', { src: s.thumb, alt: s.name || '' }) : null),
        s.kind === 'video' ? h('span.dur', null, (s.duration || 0).toFixed(1) + ' s') : null,
        h('div.tile__rebate', null, h('b', null, String(i + 1).padStart(3, '0')), h('span', null, s.kind === 'video' ? 'VID' : 'IMG'), h('span', null, s.rights === 'da verificare' ? 'diritti ?' : '')))))
        : h('div.sect', null, h('div.dropzone', null,
          h('span.proc__title', null, 'Trascina qui fotografie o video'),
          h('p.about', null, 'Si possono anche importare con il pulsante o da un indirizzo web. I video servono a Fessura, Datamosh, Sovrimpressione; le immagini a Metamorfosi e Sorgente. Per partire da zero non serve niente.'),
          h('button.btn', { onclick: () => fileIn.click() }, 'Scegli file'))),
    );
    drawSide();
  }

  function drawSide() {
    if (!selected) {
      fill(sideEl, h('div.panel', null, h('div.panel__head', null, h('span.label', null, 'Dettaglio')), h('div.panel__body', null,
        h('p.about', null, 'Seleziona un esperimento o una sorgente. Doppio clic su un esperimento per aprirlo nel Banco.'),
        S.store.mode === 'browser' ? h('p.warn-line', null, 'Pagina demo: l’archivio vive in questo browser. Con il server sul Mac i file stanno in moviola/dati e si esporta in ProRes.') : null)));
      return;
    }
    if (selected.kind === 'exp') return drawExp(expById(selected.id));
    const s = S.sources.find((x) => x.id === selected.id);
    if (!s) { selected = null; return drawSide(); }
    const preview = s.kind === 'video'
      ? h('video', { src: s.url, muted: true, playsInline: true, loop: true, autoplay: true, controls: true, style: { width: '100%', background: '#000' } })
      : h('img', { src: s.url, alt: s.name || '', style: { width: '100%', maxHeight: '320px', objectFit: 'contain', background: '#000' } });
    if (s.kind === 'video') { preview.muted = true; preview.setAttribute('playsinline', ''); }
    const rights = h('select.field', { onchange: (e) => { s.rights = e.target.value; updateSource(s); draw(); } }, RIGHTS.map((r) => h('option', { selected: r === s.rights }, r)));
    const origin = h('input.field', { value: s.origin || '', placeholder: 'Da dove viene', onchange: (e) => { s.origin = e.target.value; updateSource(s); } });
    const tags = h('input.field', { value: (s.tags || []).join(', '), placeholder: 'parole, separate da virgole', onchange: (e) => { s.tags = e.target.value.split(',').map((x) => x.trim()).filter(Boolean); updateSource(s); } });
    const note = h('textarea.field', { placeholder: 'Note', rows: 3, onchange: (e) => { s.note = e.target.value; updateSource(s); } }, s.note || '');
    fill(sideEl, h('div.panel', null,
      h('div.panel__head', null, h('span.label', null, s.kind === 'video' ? 'Video' : 'Immagine'), h('span', { style: { flex: 1 } }), h('button.btn.btn--quiet', { onclick: () => { selected = null; draw(); } }, 'Chiudi')),
      h('div.panel__body', null, preview,
        h('dl.dl', null,
          h('dt', null, 'Nome'), h('dd', null, s.name || '—'),
          h('dt', null, 'Misure'), h('dd', null, `${s.w}×${s.h}${s.kind === 'video' ? ` · ${(s.duration || 0).toFixed(2)} s` : ''}`),
          s.proxy ? [h('dt', null, 'Copia'), h('dd', null, 'convertito in H.264 per leggerlo nel browser (l’originale resta in archivio)')] : null,
          h('dt', null, 'Importato'), h('dd', null, new Date(s.created).toLocaleString('it-IT'))),
        h('div.stack', null, h('span.label', null, 'Provenienza'), origin),
        h('div.stack', null, h('span.label', null, 'Diritti'), rights),
        h('div.stack', null, h('span.label', null, 'Tag'), tags),
        note,
        h('div.row', null,
          h('button.btn.btn--solid', { onclick: () => newExperiment([s]) }, 'Nuovo esperimento con questa'),
          S.work ? h('button.btn', { onclick: () => { if (S.work.sources.length >= 4) return toast('La clip aperta ha già 4 sorgenti'); S.work.sources.push({ id: s.id, speed: 1, start: 0 }); touch('clip'); toast('Aggiunta alla clip aperta', { label: 'Banco', run: () => app.go('banco') }); } }, 'Aggiungi alla clip aperta') : null),
        h('button.btn.btn--quiet', { style: { alignSelf: 'flex-start' }, onclick: async () => { if (await confirmDialog({ title: 'Togliere la sorgente?', text: 'Esce dall’archivio. Le clip che la usano mostreranno il nero al suo posto.', ok: 'Togli' })) { await removeSource(s.id); selected = null; draw(); } } }, 'Togli dall’archivio'))));
  }

  function drawExp(e) {
    if (!e) { selected = null; return drawSide(); }
    const vs = versionsOf(e.id);
    const name = h('input.field', { value: e.name, onchange: (ev) => renameExperiment(e.id, ev.target.value.trim() || e.name).then(draw) });
    fill(sideEl, h('div.panel', null,
      h('div.panel__head', null, h('span.label', null, 'Esperimento'), h('span', { style: { flex: 1 } }), h('button.btn.btn--quiet', { onclick: () => { selected = null; draw(); } }, 'Chiudi')),
      h('div.panel__body', null,
        e.thumb ? h('img', { src: e.thumb, alt: '', style: { width: '100%' } }) : null,
        h('div.stack', null, h('span.label', null, 'Nome'), name),
        e.idea ? h('div.stack', null, h('span.label', null, 'Ipotesi di partenza'), h('p.critic__text', null, e.idea)) : null,
        h('dl.dl', null,
          h('dt', null, 'Versioni'), h('dd', null, String(vs.length)),
          h('dt', null, 'Segnate'), h('dd', null, String(vs.filter((v) => v.marked).length)),
          h('dt', null, 'Finite'), h('dd', null, String(vs.filter((v) => v.status === 'finita').length)),
          h('dt', null, 'Ultima'), h('dd', null, ago(e.updated || e.created))),
        h('div.row', null,
          h('button.btn.btn--solid', { onclick: () => { openExperiment(e.id); app.go('banco'); } }, 'Apri nel Banco'),
          h('button.btn', { onclick: () => { openExperiment(e.id); app.go('laboratorio'); } }, 'Laboratorio')),
        h('button.btn.btn--quiet', { style: { alignSelf: 'flex-start' }, onclick: async () => { if (await confirmDialog({ title: 'Eliminare l’esperimento?', text: `Spariscono tutte le ${vs.length} versioni. I file già esportati restano dove sono.`, ok: 'Elimina' })) { await deleteExperiment(e.id); selected = null; draw(); } } }, 'Elimina esperimento'))));
  }

  // ------------------------------------------------------------- import
  async function importFiles(files) {
    const ok = files.filter((f) => /^(image|video)\//.test(f.type) || /\.(mov|mp4|m4v|heic)$/i.test(f.name));
    if (!ok.length) return toast('Nessuna immagine o video tra i file');
    for (const f of ok) {
      app.status(`importo ${f.name}…`);
      try {
        const up = await S.store.upload(f, f.name);
        await register({ ...up, name: f.name, origin: 'file: ' + f.name, kind: f.type.startsWith('video') || /\.(mov|mp4|m4v)$/i.test(f.name) ? 'video' : 'image' });
      } catch (e) { toast(`${f.name}: ${e.message}`); }
    }
    app.status();
    draw();
  }

  async function importUrl() {
    const u = urlIn.value.trim();
    if (!u) return urlIn.focus();
    urlBtn.disabled = true; urlBtn.textContent = 'Scarico…';
    try {
      const up = await S.store.importUrl(u);
      await register({ ...up, name: decodeURIComponent(new URL(u).pathname.split('/').pop() || up.host), origin: up.origin, kind: (up.type || '').startsWith('video') ? 'video' : 'image' });
      urlIn.value = '';
      draw();
    } catch (e) { toast(e.message); }
    urlBtn.disabled = false; urlBtn.textContent = 'Importa';
  }

  async function register(up) {
    let url = up.url, media, proxy = null;
    try { media = await loadMedia(url, up.kind); }
    catch (e) {
      if (up.kind === 'video' && S.store.mode === 'server') {
        toast('Questo video non si legge nel browser: lo converto (ffmpeg)…');
        proxy = await S.store.proxy(up.file);
        url = proxy.url;
        media = await loadMedia(url, 'video');
      } else throw e;
    }
    const thumb = await makeThumb(media);
    const rec = {
      id: uid('s'), kind: up.kind, name: up.name, file: proxy ? proxy.file : up.file, original: proxy ? up.file : undefined, proxy: !!proxy,
      url, w: media.w, h: media.h, duration: media.duration, thumb, origin: up.origin || '', rights: 'da verificare', tags: [], note: '', created: Date.now(),
    };
    await addSource(rec);
    selected = { kind: 'src', id: rec.id };
    toast(`Importata: ${rec.name}`);
  }

  // ------------------------------------------------------ nuovo esperimento
  function newExperiment(preset = []) {
    let chosen = null;
    const picked = [...preset];
    const name = h('input.field', { placeholder: 'Nome (facoltativo)' });
    const idea = h('textarea.field', { rows: 3, placeholder: 'Un’ipotesi, se c’è. Es. «il tempo che si deposita come sedimento» — l’interlocutore la userà per discutere i risultati.' });
    const srcRow = h('div.srcs');
    const drawSrcs = () => fill(srcRow, 
      ...picked.map((s, i) => h('button.src', { title: 'Togli', onclick: () => { picked.splice(i, 1); drawSrcs(); } }, h('img', { src: s.thumb, alt: '' }), h('span.src__n', null, String(i + 1)))),
      picked.length < 4 && S.sources.length ? h('button.src.src--add', { onclick: () => pickSrc() }, '+') : null);
    const pickSrc = () => {
      let d2;
      d2 = dialog({ title: 'Sorgente', wide: true, body: h('div.sheet--src', { style: { '--cols': isPhone() ? 3 : 5, '--row': '110px' } }, S.sources.filter((s) => !picked.includes(s)).map((s) => h('button.tile', { onclick: () => { picked.push(s); d2.close(); drawSrcs(); } }, h('div.tile__img', null, h('img', { src: s.thumb, alt: '' })), h('div.tile__rebate', null, h('b', null, s.kind === 'video' ? 'VID' : 'IMG'))))) });
    };
    drawSrcs();
    const tiles = new Map();
    const grid = h('div.recipes', null,
      h('button.recipe', { 'aria-pressed': 'false', onclick: () => choose(null) }, h('div', { style: { aspectRatio: '16/9', display: 'grid', placeItems: 'center', background: '#000' } }, h('span.code', { style: { color: 'var(--seam-strong)' } }, '∅')),
        h('div.recipe__txt', null, h('span.recipe__name', null, 'Catena vuota'), h('span.about', null, 'Niente di pronto. Costruisci tu, processo per processo.'))),
      RECIPES.map((r) => {
        const img = h('img', { alt: '', src: recipeThumbs.get(r.id) || '' });
        const b = h('button.recipe', { 'aria-pressed': 'false', onclick: () => choose(r) }, img,
          h('div.recipe__txt', null, h('span.recipe__name', null, r.name), h('span.about', null, r.line), h('span.meta', null, r.needs === 'niente' ? 'da zero' : r.needs === 'video' ? 'meglio con un video' : 'con immagini')));
        tiles.set(r.id, { b, img });
        return b;
      }));
    const choose = (r) => { chosen = r; grid.querySelectorAll('.recipe').forEach((b, i) => b.setAttribute('aria-pressed', String(i === 0 ? !r : RECIPES[i - 1] === r))); };
    choose(null);
    let d;
    d = dialog({
      title: 'Nuovo esperimento', wide: true,
      body: h('div.stack', { style: { gap: 'var(--s-5)' } },
        h('div.row', { style: { alignItems: 'flex-start', gap: 'var(--s-5)' } },
          h('div.stack.grow', { style: { minWidth: '240px' } }, h('span.label', null, 'Nome'), name, h('span.label', null, 'Ipotesi'), idea),
          h('div.stack', { style: { width: '240px' } }, h('span.label', null, 'Sorgenti (facoltative)'), srcRow, h('p.about', null, 'Senza sorgenti si parte dal nero.'))),
        h('div.stack', null, h('span.label', null, 'Partenza'), grid)),
      foot: [h('span.spacer'), h('button.btn', { onclick: () => d.close() }, 'Annulla'), h('button.btn.btn--solid', { onclick: create }, 'Crea e apri nel Banco')],
    });
    // miniature delle partenze, calcolate una volta
    (async () => {
      for (const r of RECIPES) {
        if (recipeThumbs.has(r.id)) continue;
        const m = r.make();
        let clip = normalizeClip({ ...defaultClip(), ...m, format: { ...defaultClip().format, ...(m.format || {}) }, seed: 7 });
        if (r.needs !== 'niente') clip = withMotionSource(clip, r);
        try { recipeThumbs.set(r.id, await thumbnail(clip, 320)); } catch (e) { console.warn(e); }
        const t = tiles.get(r.id);
        if (t) t.img.src = recipeThumbs.get(r.id) || '';
        await new Promise((res) => setTimeout(res, 0));
      }
    })();

    async function create() {
      const base = defaultClip();
      let clip = base;
      if (chosen) {
        const m = chosen.make();
        clip = normalizeClip({ ...base, ...m, format: { ...base.format, ...(m.format || {}) } });
      }
      clip.sources = picked.map((s) => ({ id: s.id, speed: 1, start: 0 }));
      let note = chosen ? `Partenza: ${chosen.name}` : 'Catena vuota';
      if (chosen && chosen.needs === 'video' && !picked.some((s) => s.kind === 'video')) {
        clip = withMotionSource(clip, chosen);
        note += ' (senza video: in testa un Campo che si muove)';
      }
      if (chosen && chosen.needs === 'immagini' && picked.length < 2) note += ' (con meno di due immagini la metamorfosi lavora sul flusso)';
      d.close();
      await createExperiment(name.value.trim() || (chosen ? chosen.name : 'Senza titolo') + ' ' + new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }), clip, { note, idea: idea.value.trim() });
      app.go('banco');
    }
  }

  // trascina e lascia ovunque
  const veil = h('div.drop-veil', null, h('span.title', null, 'Lascia per importare'));
  document.body.append(veil);
  let depth = 0;
  const enter = (e) => { if (![...(e.dataTransfer?.types || [])].includes('Files')) return; e.preventDefault(); depth++; veil.dataset.on = 'true'; };
  const leave = () => { depth = Math.max(0, depth - 1); if (!depth) veil.dataset.on = 'false'; };
  const over = (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault(); };
  const drop = (e) => { e.preventDefault(); depth = 0; veil.dataset.on = 'false'; importFiles([...(e.dataTransfer?.files || [])]); };
  window.addEventListener('dragenter', enter); window.addEventListener('dragleave', leave); window.addEventListener('dragover', over); window.addEventListener('drop', drop);

  draw();
  return () => { veil.remove(); window.removeEventListener('dragenter', enter); window.removeEventListener('dragleave', leave); window.removeEventListener('dragover', over); window.removeEventListener('drop', drop); };
}

/** Una partenza pensata per il video, senza video: in testa un campo che si muove. */
function withMotionSource(clip, r) {
  const c = { ...clip, chain: [...clip.chain] };
  c.chain.unshift(makePass('campo', { scala: 1.8, torsione: 2.6, velocita: 0.35, contrasto: 1.8, cromia: 0.12 }));
  return c;
}
