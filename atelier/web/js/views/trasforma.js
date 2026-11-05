// Passo 2 · Trasforma: l'immagine al centro, le scelte come immagini.
// Si sceglie un effetto guardandolo già applicato alla propria foto,
// si regola l'intensità, si tiene o si scarta.
import { h, clear, toast, spinner } from '../ui.js';
import { openPicker, openHiggsfield, openProvino, openViewer, openCompare } from '../dialogs.js';

// Effetti in vista, con nomi semplici. "k" è il parametro guidato da Intensità.
const ONE = [
  ['caleidoscopio', 'Piega', 'segments', 2, 12],
  ['frattura', 'Fessura', 'twist', 0, 90],
  ['deriva', 'Deriva', 'zoom', 1.2, 8],
  ['tessere', 'Tessere', 'mix', 0.05, 1],
  ['pixelsort', 'Colata', 'low', 200, 0],
  ['canali', 'Sdoppia', 'amount', 0.3, 15],
];
const MANY = [
  ['cadavere', 'Accosta', 'bands', 2, 16],
  ['spostamento', 'Deforma', 'strength', 1, 30],
  ['mascheraluce', 'Luce', 'softness', 1, 128],
  ['fusione', 'Fondi', 'opacity', 0.2, 1],
];
const ZERO = [
  ['rumore', 'Nebbia', 'warp', 0, 6],
  ['flusso', 'Correnti', 'turbulence', 0.5, 12],
  ['voronoi', 'Cellule', 'displace', 0, 30],
  ['automa', 'Trama', 'density', 0.05, 0.95],
];
const ALL = [...ONE, ...MANY, ...ZERO];
const thumbs = new Map();   // anteprime piccole degli effetti, per foto
let seed = Math.floor(Math.random() * 1e9);
let preview = null;         // { key, url }
let keptKey = null;         // la versione attuale è già stata tenuta
let advanced = false;
let sideBy = false;          // fonti affiancate al posto del risultato
let selSrc = null;           // foto selezionata da disporre (id del nodo)
const lastThumb = new Map(); // ultima miniatura per effetto: resta finché arriva la nuova
const critiques = new Map(); // parere locale per immagine
let token = 0;

export default {
  async render(root, app) {
    const my = ++token;
    const t = app.state.tela;
    const box = h('div', { class: 's-screen s-work' }, spinner());
    root.append(box);
    let exp = null;
    if (t.expId) { try { exp = (await app.api.experiment(t.expId)).experiment; } catch { t.expId = null; t.slots = []; } }
    const nodes = exp ? t.slots.map((id) => exp.nodes.find((n) => n.id === id)).filter((n) => n?.asset) : [];
    const n = nodes.length;
    const set = n === 0 ? ZERO : n === 1 ? ONE : [...MANY, ...ONE.slice(0, 2)];
    // Un effetto che chiede più foto di quelle in uso torna al primo adatto.
    const cur = app.processes.find((p) => p.id === t.process);
    if (!cur || cur.inputs.min > n) t.process = set[0][0];
    const proc = app.processes.find((p) => p.id === t.process);
    const usable = Math.min(n, proc.inputs.max);
    const ok = n >= proc.inputs.min;
    const ids = nodes.slice(0, usable).map((x) => x.asset.id);
    if (t.intensity == null) t.intensity = 0.5;
    // Disposizione: una voce per foto in uso, nell'ordine della riga.
    t.layout = t.layout || {};
    if (selSrc && !nodes.some((x) => x.id === selSrc)) selSrc = null;
    const lay = (id) => (t.layout[id] ||= { fh: false, fv: false, r: 0, x: 0, y: 0, s: 1 });
    const layoutFor = (count) => {
      // Con una foto sola valgono solo ribalta e ruota.
      const l = nodes.slice(0, count).map((x) => t.layout[x.id] || {}).map((d) => (n > 1 ? d : { fh: d.fh, fv: d.fv, r: d.r }));
      return l.some((d) => d.fh || d.fv || d.r || d.x || d.y || (d.s ?? 1) !== 1) ? l.map((d) => ({ ...d })) : null;
    };
    const params = () => { const p = paramsFor(proc, t.intensity, t.adv?.[proc.id]); const d = layoutFor(usable); if (d) p.disponi = d; return p; };
    const key = () => JSON.stringify([ids, proc.id, params(), seed]);
    const kept = exp ? exp.nodes.filter((x) => x.asset && x.op.engine !== 'sorgente' && x.asset.marked && x.asset.choice !== 'scartata') : [];
    if (nodes[0]) app.state.focus = { assetId: nodes[0].asset.id, experimentId: exp.id };

    // ---- Anteprima grande
    const big = h('img', { alt: 'Anteprima', draggable: 'false' });
    const note = h('div', { class: 's-canvas__note' });
    const side = n > 1 ? h('div', { class: 's-side', style: { '--n': n } }, nodes.map((x) => h('img', { src: x.asset.url, alt: x.asset.title, draggable: 'false' }))) : null;
    const canvas = h('div', { class: 's-canvas', 'data-side': String(n > 1 && sideBy), 'data-arrange': String(Boolean(selSrc) && n > 1 && !sideBy) }, big, side, note);
    const hold = (on) => { if (nodes[0] && preview && !(n > 1 && sideBy)) { big.src = on ? nodes[0].asset.url : preview.url; note.textContent = on ? 'Originale' : ''; } };
    // Con una foto selezionata (e più foto in uso): trascina per spostarla,
    // pizzica o rotella per la scala. Altrimenti tenere premuto mostra l'originale.
    const moving = () => selSrc && n > 1 && !sideBy;
    const ptrs = new Map();
    let g0 = null;
    canvas.addEventListener('pointerdown', (e) => {
      if (!moving()) return hold(true);
      canvas.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const d = lay(selSrc), r = big.getBoundingClientRect();
      const pts = [...ptrs.values()];
      g0 = { d: { ...d }, w: r.width || 1, h: r.height || 1, c: centroid(pts), dist: spread(pts) };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!moving() || !ptrs.has(e.pointerId) || !g0) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pts = [...ptrs.values()], c = centroid(pts), d = lay(selSrc);
      d.x = clampN(g0.d.x + (c.x - g0.c.x) / g0.w, -1, 1);
      d.y = clampN(g0.d.y + (c.y - g0.c.y) / g0.h, -1, 1);
      if (pts.length > 1 && g0.dist > 0) d.s = clampN(g0.d.s * (spread(pts) / g0.dist), 0.2, 4);
      scaleIn && (scaleIn.value = d.s);
      live(40);
    });
    const end = (e) => {
      if (!moving()) return hold(false);
      ptrs.delete(e.pointerId);
      const pts = [...ptrs.values()];
      g0 = pts.length ? { d: { ...lay(selSrc) }, w: g0?.w || 1, h: g0?.h || 1, c: centroid(pts), dist: spread(pts) } : null;
      if (!pts.length) app.persist();
    };
    ['pointerup', 'pointercancel'].forEach((ev) => canvas.addEventListener(ev, end));
    canvas.addEventListener('pointerleave', () => { if (!moving()) hold(false); });
    canvas.addEventListener('wheel', (e) => {
      if (!moving()) return;
      e.preventDefault();
      const d = lay(selSrc);
      d.s = clampN(d.s * Math.exp(-e.deltaY * 0.0015), 0.2, 4);
      scaleIn && (scaleIn.value = d.s);
      live(40);
    }, { passive: false });
    canvas.addEventListener('dblclick', () => openViewer(big.src));
    app.currentImage = () => big.src;

    const srcs = h('div', { class: 's-srcs' + (n > 1 ? ' s-srcs--multi' : '') },
      h('span', { class: 's-srcs__lbl' }, n ? `Sta usando ${n === 1 ? 'la tua foto' : `le tue ${n} foto`}` : 'Nessuna foto: si parte da zero'),
      nodes.map((x, i) => srcThumb(x, i)),
      n < 4 ? h('button', { class: 'btn btn--quiet', onclick: () => openPicker(app, { title: 'Aggiungi una foto', kind: 'tutte', max: 4 - n, onPick: (a) => app.toTela(a, { add: true }) }) }, n ? '+ un\'altra foto' : '+ usa una foto') : null,
      n > 1 ? h('button', { class: 'btn btn--quiet', 'aria-pressed': String(sideBy), onclick: (e) => { sideBy = !sideBy; canvas.dataset.side = String(sideBy); canvas.dataset.arrange = String(Boolean(selSrc) && !sideBy); e.currentTarget.setAttribute('aria-pressed', String(sideBy)); e.currentTarget.textContent = sideBy ? 'Vedi il risultato' : 'Vedi affiancate'; } }, sideBy ? 'Vedi il risultato' : 'Vedi affiancate') : null);

    // ---- Disporre le foto: ribalta, ruota, ordine, posizione, scala
    const scaleIn = selSrc && n > 1 ? h('input', { class: 'range', type: 'range', min: 0.2, max: 4, step: 0.01, value: lay(selSrc).s, 'aria-label': 'Scala',
      oninput: (e) => { lay(selSrc).s = Number(e.target.value); live(40); }, onchange: () => app.persist() }) : null;
    const relayout = () => { keptKey = null; app.persist(); app.render(); };
    const selIdx = nodes.findIndex((x) => x.id === selSrc);
    const disponi = selSrc ? h('div', { class: 's-disp', role: 'toolbar', 'aria-label': 'Disponi la foto' },
      h('div', { class: 's-disp__head' }, h('span', { class: 's-label' }, n > 1 ? `Disponi la foto ${selIdx + 1}` : 'Disponi la foto'),
        h('button', { class: 'link', onclick: () => { selSrc = null; app.render(); } }, 'Fatto')),
      h('div', { class: 's-disp__acts' },
        h('button', { class: 'btn', onclick: () => { const d = lay(selSrc); d.fh = !d.fh; relayout(); } }, '↔ Ribalta'),
        h('button', { class: 'btn', onclick: () => { const d = lay(selSrc); d.fv = !d.fv; relayout(); } }, '↕ Ribalta'),
        // Con un solo ribaltamento attivo il verso si inverte, così a vista gira sempre in senso orario.
        h('button', { class: 'btn', onclick: () => { const d = lay(selSrc); d.r = (d.r + (d.fh !== d.fv ? 270 : 90)) % 360; relayout(); } }, '↻ Ruota 90°'),
        n > 1 ? h('button', { class: 'btn', onclick: () => { moveSrc(selSrc, n === 2 ? (selIdx === 0 ? 1 : 0) : n - 1); } }, n === 2 ? '⇄ Scambia' : '⤒ Porta sopra') : null,
        h('button', { class: 'btn btn--quiet', onclick: () => { delete t.layout[selSrc]; relayout(); } }, 'Reimposta')),
      n > 1 ? h('label', { class: 's-disp__scale' }, h('span', { class: 's-label' }, 'Scala'), scaleIn) : null,
      h('p', { class: 's-disp__hint' }, n > 1 ? (app.isPhone() ? 'Trascina sull\'anteprima per spostarla, pizzica per ingrandirla. Trascina le miniature per cambiare l\'ordine.' : 'Trascina sull\'anteprima per spostarla, rotella per la scala, ← → per cambiare l\'ordine (o trascina le miniature).') : 'Ribalta e ruota valgono anche per la versione che tieni.')) : null;
    if (selSrc) document.onkeydown = (e) => {
      if (e.target.matches?.('input, textarea, select') || n < 2) return;
      if (e.key === 'ArrowLeft' && selIdx > 0) { e.preventDefault(); moveSrc(selSrc, selIdx - 1); }
      if (e.key === 'ArrowRight' && selIdx < n - 1) { e.preventDefault(); moveSrc(selSrc, selIdx + 1); }
    };

    // ---- Effetti come immagini
    const fx = h('div', { class: 's-fx' }, set.map(([pid, name]) => {
      const p = app.processes.find((x) => x.id === pid);
      const can = n >= p.inputs.min;
      const img = h('img', { alt: '' });
      const b = h('button', { class: 's-fx__item', 'aria-pressed': String(pid === proc.id), disabled: !can, onclick: () => { t.process = pid; keptKey = null; app.persist(); app.render(); } },
        h('span', { class: 's-fx__img' }, img), h('span', { class: 's-fx__name' }, name),
        !can ? h('span', { class: 's-fx__why' }, `serve ${p.inputs.min} foto`) : p.inputs.min === 0 && n ? h('span', { class: 's-fx__why' }, 'prende i colori dalla foto') : null);
      b._fill = { pid, img, can };
      return b;
    }), h('button', { class: 's-fx__item s-fx__item--paid', onclick: higgsfield, 'aria-label': 'Higgsfield, generazione a pagamento: prima ti mostro il costo' },
      h('span', { class: 's-fx__img s-fx__img--paid' }, h('span', {}, 'AI')), h('span', { class: 's-fx__name' }, 'Higgsfield'),
      h('span', { class: 's-fx__why s-fx__why--paid' }, 'a pagamento · costo prima')));

    // ---- Intensità e versione
    const intIn = h('input', { class: 'range', type: 'range', min: 0, max: 1, step: 0.01, value: t.intensity, 'aria-label': 'Intensità',
      oninput: (e) => { t.intensity = Number(e.target.value); if (t.adv) delete t.adv[proc.id]; live(); } });
    const again = h('button', { class: 'btn', onclick: () => { seed = Math.floor(Math.random() * 1e9); live(0); } }, 'Un\'altra versione');
    const six = h('button', { class: 'btn', disabled: !ok, onclick: () => openProvino(app, { proc, params: params(), assetIds: ids, keep: keepMany }) }, 'Mostrami 6 versioni');

    // ---- Decidere
    const keepBtn = h('button', { class: 'btn btn--solid s-cta__btn', disabled: !ok }, 'Tieni questa');
    keepBtn.onclick = keep;
    const why = h('span', { class: 's-cta__why' }, ok ? '' : `«${nameOf(proc.id)}» ha bisogno di ${proc.inputs.min} foto.`);
    const scarta = h('button', { class: 'btn s-cta__alt', disabled: !ok }, 'Scarta');
    const cta = h('div', { class: 's-cta s-cta--two' }, scarta, keepBtn, why);
    // Appena tenuta, il pulsante pieno porta a Salva; il secondario dà un'altra versione.
    function ctaState(isKept) {
      keepBtn.disabled = !ok;
      keepBtn.onclick = isKept ? () => app.go('salva') : keep;
      keepBtn.textContent = isKept ? `Salva ${kept.length === 1 ? '1 versione' : `${kept.length} versioni`} →` : 'Tieni questa';
      scarta.textContent = isKept ? 'Un\'altra' : 'Scarta';
      scarta.onclick = isKept ? () => { seed = Math.floor(Math.random() * 1e9); live(0); } : () => { seed = Math.floor(Math.random() * 1e9); live(0); toast('Scartata. Eccone un\'altra.'); };
      why.textContent = isKept ? 'Tenuta. Puoi tenerne altre, o andare a salvarle.' : (ok ? '' : why.dataset.need || '');
    }
    why.dataset.need = why.textContent;

    // ---- Il critico, sempre in vista: misure e un dissenso, mai complimenti.
    const critTarget = kept.length ? kept[kept.length - 1].asset : nodes[0]?.asset;
    const critTxt = h('span', { class: 's-critic__txt' }, critTarget ? 'Guardo l\'immagine…' : 'Quando tieni una versione ti dico cosa ne penso, senza complimenti.');
    const critic = h('div', { class: 's-critic' },
      h('span', { class: 's-critic__who' }, 'Interlocutore'),
      h('span', { class: 's-critic__on' }, critTarget ? (kept.length ? 'sull\'ultima che hai tenuto' : 'sulla tua foto') : ''),
      critTxt,
      h('span', { class: 's-critic__acts' },
        h('button', { class: 'link', disabled: !critTarget, onclick: () => app.openSide('interlocutore', critTarget.id, exp?.id, { analyze: true }) }, 'Proponi una direzione'),
        h('button', { class: 'link', onclick: () => app.openSide('interlocutore', critTarget?.id ?? null, exp?.id ?? null) }, 'Discuti')));

    const versions = [...nodes.map((x, i) => ({ label: n > 1 ? `Foto ${i + 1}` : 'La tua foto', url: x.asset.url })), ...kept.map((x, i) => ({ label: `Tenuta ${i + 1}`, url: x.asset.url, node: x }))];
    const keptStrip = h('div', { class: 's-kept' },
      h('div', { class: 's-kept__head' },
        h('span', { class: 's-kept__lbl' }, `Tenute: ${kept.length}`),
        kept.length ? h('button', { class: 'btn', onclick: () => app.go('salva') }, `Vai a salvarle (${kept.length}) →`) : h('span', { class: 'muted s-kept__hint' }, 'Quelle che tieni finiscono qui.')),
      kept.length ? h('div', { class: 's-kept__list' }, kept.map((x, i) => ({ x, i })).slice(-12).reverse().map(({ x, i }) => h('div', { class: 's-kept__item' },
        h('button', { class: 's-kept__img', 'aria-label': `Guarda la tenuta ${i + 1} a schermo intero`, onclick: () => openViewer(x.asset.url) }, h('img', { src: x.asset.thumbUrl, alt: '' }), h('span', { class: 's-kept__n' }, String(i + 1))),
        h('button', { class: 's-kept__act', onclick: () => fromThis(x) }, 'Parti da questa'),
        h('button', { class: 's-kept__act', onclick: () => openCompare(versions, versions.length - kept.length + i, Math.max(0, versions.length - kept.length + i - 1)) }, 'Confronta')))) : null);

    // ---- Avanzato, chiuso
    const adv = h('details', { class: 's-adv', open: advanced, ontoggle: (e) => { advanced = e.target.open; } },
      h('summary', {}, 'Avanzato'),
      h('div', { class: 's-adv__body' },
        h('div', { class: 's-label' }, 'Tutti gli effetti'),
        h('div', { class: 's-chips' }, app.processes.map((p) => h('button', { class: 'tag', 'aria-pressed': String(p.id === proc.id), disabled: n < p.inputs.min, onclick: () => { t.process = p.id; app.persist(); app.render(); } }, nameOf(p.id) || p.name))),
        h('div', { class: 's-label' }, `Parametri di «${proc.name}»`),
        h('div', { class: 'params' }, proc.params.filter((d) => d.key !== 'format').map((d) => paramEl(d))),
        h('div', { class: 's-label' }, 'Dettagli'),
        h('div', { class: 'row' },
          exp ? h('button', { class: 'btn', onclick: () => app.go('laboratorio', { lab: { expId: exp.id } }) }, 'Albero e cronologia delle versioni') : null,
          nodes[0] ? h('button', { class: 'btn', onclick: () => app.openSide('scheda', nodes[0].asset.id, exp?.id) }, 'Provenienza e diritti') : null)));

    let liveT = null, busy = false, againQ = false;
    if (my !== token) return;
    clear(box,
      h('div', { class: 's-work__view' }, srcs, disponi, canvas, critic),
      h('div', { class: 's-work__tools' },
        h('div', { class: 's-label' }, n ? 'Scegli un effetto' : 'Scegli da dove partire'),
        fx,
        h('div', { class: 's-int' }, h('span', { class: 's-label' }, 'Intensità'), intIn, h('div', { class: 's-int__acts' }, again, six)),
        keptStrip, adv),
      cta);

    live(0);
    fillThumbs();
    if (critTarget) critique(critTarget);

    function srcThumb(x, i) {
      const el = h('span', { class: 's-src' + (i >= usable ? ' s-src--idle' : ''), 'data-sel': String(selSrc === x.id) },
        h('button', { class: 's-src__pick', 'aria-label': `Foto ${i + 1}: tocca per disporla (ribalta, ruota, sposta)`, 'aria-pressed': String(selSrc === x.id) },
          h('img', { src: x.asset.thumbUrl, alt: '', draggable: 'false', style: { transform: thumbCss(t.layout[x.id]) } }),
          n > 1 ? h('span', { class: 's-src__n' }, String(i + 1)) : null),
        h('button', { class: 's-src__x', 'aria-label': 'Togli questa foto', onclick: () => { t.slots = t.slots.filter((s) => s !== x.id); delete t.layout[x.id]; if (selSrc === x.id) selSrc = null; t.process = null; app.persist(); app.render(); } }, '×'));
      // Tocco = seleziona; trascinamento orizzontale = cambia l'ordine.
      const pick = el.firstChild;
      let start = null;
      pick.addEventListener('pointerdown', (e) => { start = { x: e.clientX, id: e.pointerId }; pick.setPointerCapture(e.pointerId); });
      pick.addEventListener('pointermove', (e) => { if (start && n > 1) { const dx = e.clientX - start.x; if (Math.abs(dx) > 8) { el.dataset.drag = 'true'; el.style.transform = `translateX(${dx}px)`; } } });
      pick.addEventListener('pointerup', (e) => {
        if (!start) return;
        const dx = e.clientX - start.x; start = null;
        el.style.transform = ''; el.dataset.drag = 'false';
        if (Math.abs(dx) > 24 && n > 1) {
          const others = [...srcs.querySelectorAll('.s-src')].filter((s) => s !== el);
          const to = others.filter((s) => { const r = s.getBoundingClientRect(); return r.left + r.width / 2 < e.clientX; }).length;
          return moveSrc(x.id, to);
        }
        selSrc = selSrc === x.id ? null : x.id;
        app.render();
      });
      pick.addEventListener('pointercancel', () => { start = null; el.style.transform = ''; });
      return el;
    }
    function moveSrc(id, to) {
      const list = t.slots.filter((s) => nodes.some((x) => x.id === s));
      const from = list.indexOf(id);
      if (from < 0 || to === from) return;
      list.splice(from, 1); list.splice(Math.max(0, Math.min(list.length, to)), 0, id);
      t.slots = [...list, ...t.slots.filter((s) => !list.includes(s))];
      keptKey = null; app.persist(); app.render();
    }

    async function critique(a) {
      try {
        if (!critiques.has(a.id)) critiques.set(a.id, await app.api.analyze(a.id, undefined, 'locale'));
        if (my !== token) return;
        const r = critiques.get(a.id);
        critTxt.textContent = r.dissenso || r.tensioni?.[0] || r.osservazioni?.[0] || '';
      } catch { critTxt.textContent = 'Non riesco a guardarla adesso. Puoi comunque discuterne.'; }
    }
    async function higgsfield() {
      const e = await ensureExp();
      openHiggsfield(app, { expId: e.id, parents: nodes.slice(0, 4).map((x) => x.id), sources: nodes.map((x) => x.asset), prompt: e.hypothesis || '' });
    }
    // Parti da questa: la versione tenuta diventa la foto di partenza (un nuovo ramo).
    function fromThis(x) {
      t.slots = [x.id]; t.process = null; t.adv = {}; t.layout = {}; selSrc = null; keptKey = null; sideBy = false;
      app.persist();
      toast('Si riparte da questa versione. La cronologia la ricorda come un ramo.');
      app.render();
    }

    // Anteprima dal vivo a 900 px, senza ridisegnare la schermata.
    function live(delay = 80) {
      if (!ok) { note.textContent = why.textContent; return; }
      ctaState(keptKey === key());
      clearTimeout(liveT);
      liveT = setTimeout(async () => {
        if (busy) { againQ = true; return; }
        busy = true;
        canvas.dataset.busy = 'true';
        try {
          const k = key();
          const url = preview?.key === k ? preview.url : await app.api.preview({ assetIds: ids, process: proc.id, params: params(), seed, size: 900 });
          if (my !== token) return;
          preview = { key: k, url };
          big.src = url;
          ctaState(keptKey === k);
          note.textContent = nodes[0] ? '' : '';
        } catch (e) { note.textContent = e.message; }
        finally { busy = false; canvas.dataset.busy = 'false'; if (againQ) { againQ = false; live(0); } }
      }, delay);
    }

    // Ogni miniatura usa le foto che il suo effetto sa usare, non quelle
    // dell'effetto scelto: così cambiando effetto restano tutte valide.
    function idsFor(pid) { const p = app.processes.find((x) => x.id === pid); return nodes.slice(0, Math.min(n, p.inputs.max)).map((x) => x.asset.id); }
    function thumbParams(pid) { const p = app.processes.find((x) => x.id === pid); const prm = paramsFor(p, 0.55); const d = layoutFor(Math.min(n, p.inputs.max)); if (d) prm.disponi = d.map(({ fh, fv, r }) => ({ fh, fv, r })); return prm; }
    // Le miniature già pronte compaiono subito; le altre una alla volta.
    // Una richiesta in corso non si ripete: la si riprende al ridisegno.
    async function fillThumbs() {
      const todo = [];
      for (const b of fx.children) {
        if (!b._fill?.can) continue;
        const pid = b._fill.pid;
        const k = JSON.stringify([idsFor(pid), pid, thumbParams(pid).disponi || null]);
        const c = thumbs.get(k);
        if (typeof c === 'string') b._fill.img.src = c;
        else { const prev = lastThumb.get(JSON.stringify([idsFor(pid), pid])); if (prev) b._fill.img.src = prev; todo.push([b._fill, k]); }
      }
      for (const [{ pid, img }, k] of todo) {
        if (!thumbs.has(k)) {
          const pr = app.api.preview({ assetIds: idsFor(pid), process: pid, params: thumbParams(pid), seed: 7, size: 260 })
            .then((u) => { thumbs.set(k, u); lastThumb.set(JSON.stringify([idsFor(pid), pid]), u); return u; }, (e) => { thumbs.delete(k); throw e; });
          thumbs.set(k, pr);
        }
        try { img.src = await thumbs.get(k); } catch { /* resta vuota */ }
        if (my !== token) return;
      }
    }

    function paramEl(d) {
      const cur = params();
      const val = h('b', {}, fmt(d, cur[d.key]));
      const setV = (v) => { t.adv = t.adv || {}; t.adv[proc.id] = { ...(t.adv[proc.id] || {}), [d.key]: v }; val.textContent = fmt(d, v); live(); };
      let input;
      if (d.type === 'range') input = h('input', { class: 'range', type: 'range', min: d.min, max: d.max, step: d.step, value: cur[d.key], oninput: (e) => setV(Number(e.target.value)) });
      else if (d.type === 'select') input = h('select', { class: 'field', onchange: (e) => setV(e.target.value) }, d.options.map(([k, l]) => h('option', { value: k, selected: cur[d.key] === k }, l)));
      else input = h('input', { type: 'checkbox', checked: !!cur[d.key], onchange: (e) => setV(e.target.checked) });
      return h('label', { class: 'param' + (d.type === 'bool' ? ' param--bool' : '') }, h('span', { class: 'label' }, d.label), h('span', { class: 'meta' }, val), input);
    }

    async function ensureExp() {
      if (exp) return exp;
      exp = (await app.api.createExperiment({ title: `Da zero · ${new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long' })}`, assetIds: [] })).experiment;
      t.expId = exp.id; app.persist();
      return exp;
    }

    // Tieni: calcola a piena risoluzione e segna come tua scelta.
    async function keep() {
      const k = key();
      keepBtn.disabled = true; scarta.disabled = true;
      keepBtn.classList.add('is-busy');
      keepBtn.textContent = 'Salvo a piena risoluzione…';
      try {
        const e = await ensureExp();
        const r = await app.api.run(e.id, { parents: nodes.slice(0, usable).map((x) => x.id), process: proc.id, params: params(), seed });
        await app.api.updateAsset(r.node.asset.id, { marked: true, choice: 'scelta' });
        keptKey = k;
        app.state.lab.expId = e.id; app.state.lab.current = r.node.id; app.persist();
        toast(`Tenuta. ${r.node.asset.width} × ${r.node.asset.height} px.`, { label: 'Vai a salvare', run: () => app.go('salva') });
        app.render();
      } catch (err) {
        toast(err.message);
        keepBtn.disabled = false; scarta.disabled = false; keepBtn.classList.remove('is-busy'); keepBtn.textContent = 'Tieni questa';
      }
    }
    async function keepMany(list) {
      const e = await ensureExp();
      for (const x of list) {
        const r = await app.api.run(e.id, { parents: nodes.slice(0, usable).map((y) => y.id), process: proc.id, params: x.params, seed: x.seed });
        await app.api.updateAsset(r.node.asset.id, { marked: true, choice: 'scelta' });
      }
      toast(`${list.length} ${list.length === 1 ? 'versione tenuta' : 'versioni tenute'}.`, { label: 'Vai a salvare', run: () => app.go('salva') });
      app.render();
    }
  },
};

function nameOf(pid) { return ALL.find((x) => x[0] === pid)?.[1]; }

// Intensità 0..1 → valore del parametro principale; il resto ai valori di partenza.
export function paramsFor(proc, i, over) {
  const out = Object.fromEntries(proc.params.map((d) => [d.key, d.default]));
  const c = ALL.find((x) => x[0] === proc.id);
  if (c) {
    const d = proc.params.find((x) => x.key === c[2]);
    const v = c[3] + (c[4] - c[3]) * i;
    out[c[2]] = Number((Math.round(v / d.step) * d.step).toFixed(3));
  }
  if (out.size) out.size = 3000;
  return { ...out, ...(over || {}) };
}
function fmt(d, v) {
  if (d.type === 'bool') return v ? 'sì' : 'no';
  if (d.type === 'select') return d.options.find(([k]) => k === v)?.[1] ?? v;
  return String(v);
}

function centroid(pts) { const n = pts.length || 1; return { x: pts.reduce((a, p) => a + p.x, 0) / n, y: pts.reduce((a, p) => a + p.y, 0) / n }; }
function spread(pts) { if (pts.length < 2) return 0; const [a, b] = pts; return Math.hypot(a.x - b.x, a.y - b.y); }
function clampN(v, lo, hi) { return Math.min(hi, Math.max(lo, Number(v.toFixed(4)))); }
function thumbCss(d) { if (!d) return ''; return `scale(${d.fh ? -1 : 1}, ${d.fv ? -1 : 1}) rotate(${d.r || 0}deg)`; }
