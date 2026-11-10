// Il percorso semplice: 1 Scegli · 2 Trasforma · 3 Salva.
// Una sola azione piena per schermata, con verbo e numero. Tutto il resto
// (catena, chiavi, parametri, versioni, dal vivo, interlocutore) sta in
// Avanzato e resta raggiungibile. Il passo 2 è a schede e non scorre mai
// in verticale (schede.js); il tasto Reset della barra lo azzera.

import {
  S, importFiles, removeSource, sourceById, createExperiment, openExperiment, openVersion, saveVersion, updateVersion,
  versionsOf, versionById, expById, touch, thumbnail, auxRenderer, auxSources, auxLock, withAux, addRender, clipSources,
} from '../state.js';
import { h, fill, toast, seg, isPhone, ago, dialog } from './kit.js';
import { RECIPES, recipeById, buildClip, MAX_MATERIE } from '../engine/recipes.js';
import { MATERIE, MATERIA_FAMILIES } from '../engine/materie/index.js';
import { ASPECTS, dims, clone, normalizeClip, newSeed } from '../engine/clip.js';
import { byId } from '../engine/processes.js';
import { renderToServer, renderToPreview } from '../engine/export.js';
import { openProvino } from './provino.js';
import { analyse } from '../engine/analysis.js';
import { localCritique } from '../engine/critic.js';
import { mainPlayer, syncPlayer } from '../app.js';
import { qrSvg } from './qr.js';
import { territorioSection } from './territorio.js';
import { corpoUI } from './corpo.js';
import { attachOrganismo, ORGANISMO_KEYS, ensureOrganismo } from './organismo.js';
import { pager, miniReset, tabRow, keep as keepNext } from './schede.js';
import { pref } from '../prefs.js';
import { buildAny, syncRicetta, styleName } from '../engine/ricette.js';
import { ricetteGroup, openSalva, openGestione, ricettaBlock, openIntera, clipFromRicetta, warnings } from './ricette.js';
import { openDeriva } from './deriva.js';

const MAX = 4;
// Intestazione di un gruppo del pannello: nome in maiuscoletto e una riga sotto.
const grpHead = (name, line) => h('div.grp__head', null, h('span.label', null, name), line ? h('span.meta', null, line) : null);
const nameOf = (clip) => styleName(clip, recipeById);
const fmtVal = (v, d) => (d.step >= 1 ? String(Math.round(v)) : Math.abs(d.max - d.min) <= 2 ? v.toFixed(2) : v.toFixed(1));
const MOVES = [
  { id: 'fermo', label: 'Fermo', hint: 'si muove solo la materia dello stile' },
  { id: 'contemplativo', label: 'Lento', hint: 'oscillazioni lunghe e calme' },
  { id: 'ritmico', label: 'A tempo', hint: 'scatti regolari, a battiti al minuto' },
  { id: 'caotico', label: 'Caotico', hint: 'salti improvvisi' },
];
const DURATIONS = [1, 3, 5, 8, 15, 30];
const plural = (n, one, many) => (n === 1 ? one : many);
const pickedRecs = () => S.pick.map(sourceById).filter(Boolean);
const countLabel = (recs) => {
  const ph = recs.filter((r) => r.kind === 'image').length, vd = recs.length - ph;
  return [ph && `${ph} ${plural(ph, 'foto', 'foto')}`, vd && `${vd} ${plural(vd, 'video', 'video')}`].filter(Boolean).join(' e ');
};

// Quando c'è un lavoro aperto, il passo 1 parte dalle sue sorgenti.
function syncPickFromWork() {
  if (!S.pick.length && S.work?.sources?.length && !S.zero) S.pick = S.work.sources.map((s) => s.id).filter((id) => sourceById(id));
}

/** Il pulsante pieno: verbo, numero, motivo quando è spento, avanzamento dentro. */
function cta(label, onclick, { disabled = false, why = '' } = {}) {
  const fillBar = h('i.cta__bar');
  const txt = h('span.cta__txt', null, label);
  const btn = h('button.cta__btn', { disabled, onclick: () => !btn.disabled && onclick() }, fillBar, txt);
  const reason = h('p.cta__why', { hidden: !disabled || !why }, why);
  const el = h('div.cta', null, btn, reason);
  el.btn = btn;
  el.set = (l, { disabled: d = false, why: w = '' } = {}) => { txt.textContent = l; btn.disabled = d; reason.textContent = w; reason.hidden = !d || !w; };
  el.progress = (p, l) => { btn.dataset.busy = p == null ? 'false' : 'true'; fillBar.style.width = p == null ? '0' : Math.round(p * 100) + '%'; if (l) txt.textContent = l; };
  return el;
}

// ============================================================ 1 · Scegli
export const scegli = {
  render(root, { app }) {
    syncPickFromWork();
    const fresh = new Set();
    const fileIn = h('input', { type: 'file', multiple: true, accept: 'image/*,video/*', hidden: true, onchange: (e) => { add([...e.target.files]); e.target.value = ''; } });
    const action = cta('', () => go());
    const grid = h('div.media');
    const head = h('div.flow__head');
    const below = h('div.flow__below');
    root.append(h('div.flow.flow--scegli', null, fileIn, head, grid, below, action));

    function go() {
      S.zero = false;
      app.go('trasforma');
    }

    function draw() {
      const recs = pickedRecs();
      fill(head,
        h('h1.title', null, 'Scegli foto o video'),
        h('p.flow__lead', null, `Fino a ${MAX}. Nel passo 2 li vedrai trasformati e in movimento.`),
        h('div.row', null,
          S.sources.length ? h('button.btn', { onclick: () => fileIn.click() }, 'Aggiungi altre foto o video') : null,
          h('button.link.flow__zero', { onclick: () => { S.pick = []; S.zero = true; app.go('trasforma'); } }, 'oppure parti da zero, senza foto')));
      if (!S.sources.length) {
        fill(grid, h('button.media__empty', { onclick: () => fileIn.click() },
          h('span.media__plus', null, '+'),
          h('span', null, isPhone() ? 'Tocca per scegliere dal rullino' : 'Tocca per scegliere, oppure trascina qui i file')));
      } else {
        fill(grid, S.sources.map((s) => {
          const i = S.pick.indexOf(s.id);
          return h('button.media__tile', {
            'aria-pressed': String(i >= 0), 'data-fresh': String(fresh.has(s.id)),
            'aria-label': `${s.kind === 'video' ? 'Video' : 'Foto'} ${s.name}${i >= 0 ? ', scelta' : ''}`,
            onclick: () => toggle(s.id),
          },
          h('img', { src: s.thumb || '', alt: '' }),
          s.kind === 'video' ? h('span.media__kind', null, `video ${Math.round(s.duration || 0)} s`) : null,
          i >= 0 ? h('span.media__n', null, String(i + 1)) : null);
        }));
      }
      const exps = S.experiments.slice(0, 8);
      fill(below, exps.length ? [
        h('span.label', null, 'Clip già iniziate'),
        h('div.again', null, exps.map((e) => h('button.again__item', { onclick: () => { openExperiment(e.id); S.pick = (S.work?.sources || []).map((x) => x.id); S.zero = !S.pick.length; app.go('trasforma'); } },
          h('span.again__img', null, e.thumb ? h('img', { src: e.thumb, alt: '' }) : null),
          h('span.again__name', null, e.name), h('span.meta', null, ago(e.updated || e.created))))),
      ] : null);
      if (!S.sources.length) action.set('Aggiungi foto o video', {});
      else if (!recs.length) action.set('Trasforma', { disabled: true, why: 'Tocca almeno una foto o un video, oppure parti da zero.' });
      else action.set(recs.length === 1 ? `Trasforma ${recs[0].kind === 'video' ? 'questo video' : 'questa foto'}` : `Trasforma queste ${recs.length}`, {});
      action.btn.onclick = () => (!S.sources.length ? fileIn.click() : recs.length && go());
    }

    function toggle(id) {
      const i = S.pick.indexOf(id);
      if (i >= 0) S.pick.splice(i, 1);
      else if (S.pick.length >= MAX) return toast(`Al massimo ${MAX}: togline una per sceglierne un'altra.`);
      else S.pick.push(id);
      S.zero = false;
      draw();
    }

    async function add(files) {
      if (!files.length) return;
      action.progress(0.02, 'Carico…');
      const { added, errors } = await importFiles(files, (i, n) => action.progress(i / n, `Carico ${i} di ${n}…`));
      action.progress(null);
      for (const r of added) { fresh.add(r.id); if (S.pick.length < MAX && !S.pick.includes(r.id)) S.pick.push(r.id); }
      S.zero = false;
      draw();
      setTimeout(() => { added.forEach((r) => fresh.delete(r.id)); grid.querySelectorAll('[data-fresh="true"]').forEach((t) => t.dataset.fresh = 'false'); }, 2000);
      if (errors.length) toast(errors.join(' '));
      else if (added.length) {
        const n = added.length;
        const vids = added.filter((r) => r.kind === 'video').length, ph = n - vids;
        const what = [ph && `${ph} ${plural(ph, 'foto aggiunta', 'foto aggiunte')}`, vids && `${vids} ${plural(vids, 'video aggiunto', 'video aggiunti')}`].filter(Boolean).join(' e ');
        toast(`${what}${added.length > MAX ? ` · ne ho scelti ${MAX}` : ''}`, {
          label: 'Annulla',
          run: async () => { for (const r of added) { S.pick = S.pick.filter((x) => x !== r.id); await removeSource(r.id); } draw(); },
        });
      }
    }

    // trascina e lascia su tutta la finestra
    const veil = h('div.drop-veil', null, h('span.title', null, 'Rilascia per aggiungere'));
    document.body.append(veil);
    let depth = 0;
    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    const enter = (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; veil.dataset.on = 'true'; };
    const leave = () => { depth = Math.max(0, depth - 1); if (!depth) veil.dataset.on = 'false'; };
    const over = (e) => { if (hasFiles(e)) e.preventDefault(); };
    const drop = (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth = 0; veil.dataset.on = 'false'; add([...(e.dataTransfer?.files || [])]); };
    window.addEventListener('dragenter', enter); window.addEventListener('dragleave', leave); window.addEventListener('dragover', over); window.addEventListener('drop', drop);

    draw();
    return () => { veil.remove(); window.removeEventListener('dragenter', enter); window.removeEventListener('dragleave', leave); window.removeEventListener('dragover', over); window.removeEventListener('drop', drop); };
  },
};

// ========================================================= 2 · Trasforma
/** Intensità: quanto lo stile pesa sulle foto (0 = quasi la foto, 1 = tutto lo stile). */
function applyIntensity(clip) {
  const k = clip.intensity ?? 0.8;
  const head = clip.sources.length >= 2 ? 1 : 0;
  clip.chain.forEach((p, i) => {
    if (p.baseMix == null) p.baseMix = p.mix;
    p.mix = i < head ? p.baseMix : p.baseMix * (0.25 + 0.75 * k);
  });
  return clip;
}

function sameSources(clip, ids) {
  const a = (clip?.sources || []).map((s) => s.id);
  return a.length === ids.length && a.every((x, i) => x === ids[i]);
}

async function ensureWork() {
  const ids = S.zero ? [] : S.pick.filter((id) => sourceById(id));
  if (S.work && expById(S.expId) && sameSources(S.work, ids) && S.work.style) return;
  const style = S.work?.style || (ids.length ? 'emulsione' : 'emulsione');
  const ric = S.work?.style === 'ricetta' ? syncRicetta(S.work) : null;
  const clip = buildAny({ style, sources: ids.map(sourceById), format: S.work?.format, motion: S.work?.motion, ricetta: ric, seed: ric ? S.work.seed : undefined });
  if (ric) clip.intensity = S.work.intensity;
  applyIntensity(clip);
  const recs = ids.map(sourceById);
  const day = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  const name = recs.length ? `${recs[0].name.replace(/\.[^.]+$/, '').slice(0, 24)}${recs.length === 2 ? ' e un’altra' : recs.length > 2 ? ` e altre ${recs.length - 1}` : ''}` : `Da zero ${day}`;
  await createExperiment(name, clip, { note: `${nameOf(clip)} · partenza` });
}

const thumbCache = new Map();
async function styleThumb(style, clip) {
  const key = style + '|' + clip.sources.map((s) => s.id).join(',') + '|' + clip.format.aspect;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const c = applyIntensity(buildClip({ style, sources: clip.sources.map((s) => sourceById(s.id)).filter(Boolean), format: { ...clip.format, duration: 4 }, seed: 7 }));
  c.intensity = 0.8;
  const url = await thumbnail(c, 280);
  thumbCache.set(key, url);
  return url;
}

// Miniatura di una materia: la stessa foto, senza stile, con solo quella materia.
async function materiaThumb(proc, clip) {
  const key = 'm:' + proc + '|' + clip.sources.map((s) => s.id).join(',') + '|' + clip.format.aspect;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const c = buildClip({ style: 'nudo', sources: clip.sources.map((s) => sourceById(s.id)).filter(Boolean), format: { ...clip.format, duration: 4 }, seed: 7, materie: [{ proc }] });
  const url = await thumbnail(c, 280);
  thumbCache.set(key, url);
  return url;
}

// ---------------------------------------------------------- le schede
// Il passo 2 non scorre mai in verticale: l'immagine resta ferma, sotto
// (o a destra sul Mac) cinque schede, una aperta alla volta, e i comandi in
// pagine da sfogliare di lato (schede.js).
const TABS = [
  { id: 'stile', label: 'Stile' }, { id: 'materie', label: 'Materie' }, { id: 'gesto', label: 'Gesto' },
  { id: 'catena', label: 'Catena' }, { id: 'altro', label: 'Altro' },
];
// quello che si ricorda tornando al passo 2: la scheda aperta e dove si era
const UI = (() => {
  let saved = {};
  try { saved = JSON.parse(pref.get('moviola.schede') || '{}') || {}; } catch {}
  const ui = { tab: 'stile', layer: -1, gesto: 'scolpisci', catena: null, strip: 'stile', page: {} };
  if (TABS.some((t) => t.id === saved.tab)) ui.tab = saved.tab;
  if (saved.gesto === 'macro') ui.gesto = 'macro';
  if (['respiro', 'tempo', 'forze'].includes(saved.catena)) ui.catena = saved.catena;
  if (Number.isInteger(saved.layer)) ui.layer = saved.layer;
  return ui;
})();
const saveUI = () => pref.set('moviola.schede', JSON.stringify({ tab: UI.tab, gesto: UI.gesto, catena: UI.catena, layer: UI.layer }));

/**
 * Il bersaglio del Reset: dove tornano le foto. 'nudo' è la foto senza stile
 * («Nessuno stile»); per tornare allo stile con cui nasce una clip nuova
 * basta scrivere 'emulsione'.
 */
export const RESET_STYLE = 'nudo';
const RESET_INTENSITY = 0.8;

export const trasforma = {
  render(root, { app }) {
    syncPickFromWork();
    if (!S.zero && !S.pick.length && !S.work) { app.go('scegli'); return; }
    const player = mainPlayer();
    const shell = document.getElementById('shell');
    const work = () => S.work;
    const phone = () => isPhone();

    // ---------------------------------------------------- l'immagine
    const using = h('div.using');
    let corpo = null; // Scolpisci e Macro
    let full = false;
    const screen = h('div.screen.flow__screen', null, player.canvas);
    // un tocco: pausa e ripresa; due tocchi: i comandi spariscono
    let tapTimer = 0, lastTap = 0;
    screen.addEventListener('click', () => {
      if (corpo?.capturesTap() || screen.dataset.drawing === 'true') return;
      if (full) { setFull(false); return; }
      const now = performance.now();
      if (now - lastTap < 320) { clearTimeout(tapTimer); lastTap = 0; setFull(true); return; }
      lastTap = now;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { player.toggle(); drawUsing(); }, 280);
    });
    // alcuni browser trasformano il doppio tocco in un solo «dblclick»
    screen.addEventListener('dblclick', () => { if (corpo?.capturesTap() || screen.dataset.drawing === 'true' || full) return; clearTimeout(tapTimer); lastTap = 0; setFull(true); });
    const styles = h('div.styles', { role: 'listbox', 'aria-label': 'Stili' });
    const mats = h('div.mats');
    const strip = h('div.strip');
    const head = h('div.scrub__head');
    const tlFill = h('i.scrub__fill');
    const tl = h('div.scrub', { role: 'slider', 'aria-label': 'Tempo della clip', tabindex: 0 }, tlFill);
    const seekAt = (e) => { const r = tl.getBoundingClientRect(); const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); player.pause(); player.seek(Math.round(x * (player.total - 1))); drawUsing(); };
    tl.addEventListener('pointerdown', (e) => { tl.setPointerCapture(e.pointerId); seekAt(e); tl.onpointermove = seekAt; });
    tl.addEventListener('pointerup', () => { tl.onpointermove = null; });
    const timeline = h('div.scrub__wrap', null, h('div.scrub__line', null, tl, head));
    const claude = h('div.claude');
    const kept = h('div.kept');
    const keptLink = h('button.flow__kept', { onclick: () => app.go('salva'), hidden: true });
    const action = cta('Tieni questa', () => keep());

    // ---------------------------------------------------- le schede
    const tabs = tabRow(TABS, UI.tab, (id) => openTab(id));
    const area = h('div.sheet', { role: 'tabpanel' });
    let pg = null;

    let ready = false;
    corpo = corpoUI({ player, screen, redraw: (what) => { if (!ready) return; if (UI.tab === 'gesto') drawTab(); else drawTabs(); if (what === 'play') drawUsing(); } });
    const stage = h('div.flow__stage', null, using, screen, timeline, strip);
    const flowEl = h('div.flow.flow--trasforma', null, stage,
      h('div.flow__side', null, tabs, area, h('div.flow__foot', null, keptLink, action)));
    root.append(flowEl);

    // Respiro, Tempo geologico, Gravità e vento: controlli, curva e disegno (organismo.js)
    let orgRestart = 0;
    const org = attachOrganismo({ screen, timeline, player, work, rebuild: () => { if (!ready) return; if (UI.tab === 'catena') drawTab(); else drawTabs(); }, changed: ({ restart = false } = {}) => {
      touch('clip');
      syncPlayer().then(() => {
        if (!restart) return;
        clearTimeout(orgRestart);
        orgRestart = setTimeout(() => { player.restart(); if (!player.playing) player.play(); }, 250);
      });
      scheduleRead();
    } });

    function setFull(on) {
      full = on;
      flowEl.dataset.full = String(on);
      shell.dataset.full = String(on);
      if (on && !UI.fullHinted) { UI.fullHinted = true; toast('Tocca l’immagine per riavere i comandi.'); }
    }

    function drawUsing() {
      const c = work(); if (!c) return;
      const recs = clipSources(c);
      fill(using,
        h('span.using__what', null, recs.length ? countLabel(recs) : 'Senza foto, da zero'),
        h('button.using__change', { onclick: (e) => { e.stopPropagation(); app.go('scegli'); } }, 'Cambia'),
        player.playing ? null : h('span.using__paused', null, phone() ? 'In pausa · tocca per riprendere' : 'In pausa · tocca l’immagine per riprendere'));
    }

    function drawStyles() {
      const c = work();
      fill(styles, RECIPES.map((r) => {
        const img = h('img', { alt: '' });
        const tile = h('button.style', { role: 'option', 'aria-selected': String(c.style === r.id), onclick: () => setStyle(r.id) },
          h('span.style__img', null, img), h('span.style__name', null, r.name),
          h('span.style__ref', null, 'da ' + r.ref));
        styleThumb(r.id, c).then((u) => { img.src = u; }).catch(() => {});
        return tile;
      }));
    }

    // Materie: si aggiungono a strati sopra lo stile. Tocca per aggiungere,
    // ritocca per togliere; l'ordine è quello in cui le tocchi.
    let matIO = null;
    function drawMats() {
      const c = work();
      const sel = (c.materie || []).map((m) => m.proc);
      matIO?.disconnect();
      matIO = new IntersectionObserver((ents) => ents.forEach((en) => {
        if (!en.isIntersecting) return;
        const img = en.target; matIO.unobserve(img);
        materiaThumb(img.dataset.proc, work()).then((u) => { img.src = u; }).catch(() => {});
      }), { root: null, rootMargin: '0px 400px' });
      const row = h('div.mats__row', { role: 'group', 'aria-label': 'Materie' }, ricetteGroup(c, ricetteOn), MATERIA_FAMILIES.map((f) => {
        const list = MATERIE.filter((m) => m.family === f.id);
        if (!list.length) return null;
        return h('div.mats__fam', null, h('span.mats__famname', null, f.label), h('div.mats__tiles', null, list.map((m) => {
          const k = sel.indexOf(m.id);
          const img = h('img', { alt: '', 'data-proc': m.id });
          matIO.observe(img);
          return h('button.style.mat', { 'aria-pressed': String(k >= 0), title: m.about, onclick: () => toggleMateria(m.id) },
            h('span.style__img', null, img, k >= 0 ? h('span.mat__n', null, String(k + 1)) : null),
            h('span.style__name', null, m.name), h('span.style__ref', null, m.ref || ''));
        })));
      }));
      fill(mats,
        h('div.mats__head', null, h('span.label', null, 'Materie'),
          h('span.meta', null, sel.length ? `${sel.length} a strati, nell’ordine in cui le hai toccate · ritocca per togliere` : 'l’immagine diventa il corpo di una sostanza · tocca per aggiungerne una, si sommano a strati')),
        row);
    }

    function toggleMateria(proc) {
      const c = work();
      const list = (c.materie || []).slice();
      const k = list.findIndex((m) => m.proc === proc);
      if (k >= 0) {
        list.splice(k, 1);
        if (UI.layer === k) UI.layer = phone() ? -1 : Math.min(k, list.length - 1);
        else if (UI.layer > k) UI.layer--;
      } else {
        if (list.length >= MAX_MATERIE) { toast(`Al massimo ${MAX_MATERIE} materie a strati: togline una prima.`); return; }
        list.push({ proc });
        // sul Mac si apre subito lo strato nuovo (la striscia resta sotto l'immagine);
        // su iPhone si resta sulla striscia, per aggiungerne altre
        if (!phone()) UI.layer = list.length - 1;
      }
      rebuild({ materie: list });
      drawMats(); drawTab();
      if (k < 0) toast(`${byId[proc].name}: ${byId[proc].about}`);
    }

    function moveMateria(i, d) {
      const list = (work().materie || []).slice();
      const j = i + d; if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      if (UI.layer === i) UI.layer = j;
      rebuild({ materie: list }); drawMats(); drawTab();
    }

    // passaggio della catena che corrisponde allo strato i
    const layerPass = (i) => work().chain.find((p) => p.layer === i);

    /** I comandi di uno strato, a blocchi: riga dello strato, Quantità, parametri, poi il territorio. */
    function layerBlocks(c, i) {
      const m = c.materie[i];
      const proc = byId[m.proc];
      const cur_ = () => work().materie[i] || m;
      const set = (id, v) => {
        cur_().params[id] = v;
        const p = layerPass(i); if (p) p.params[id] = v;
        touch('clip'); syncPlayer(); scheduleRead();
      };
      const mixIn = h('input.range', { type: 'range', min: 0, max: 1, step: 0.01, value: m.mix ?? 1, 'aria-label': 'Quantità di ' + proc.name,
        oninput: (e) => { const mm = cur_(); mm.mix = Number(e.target.value); mixVal.textContent = mm.mix.toFixed(2); const p = layerPass(i); if (p) { p.baseMix = mm.mix; applyIntensity(S.work); } touch('clip'); syncPlayer(); scheduleRead(); } });
      const mixVal = h('span.prm__val', null, (m.mix ?? 1).toFixed(2));
      const rows = proc.params.map((d) => {
        const cur = m.params[d.id] ?? d.def;
        const val = h('span.prm__val', null, d.options ? '' : fmtVal(cur, d));
        const control = d.options
          ? h('div.opt-row', null, d.options.map((o, oi) => h('button.tag', { 'aria-pressed': String(Math.round(cur) === oi), onclick: (e) => { set(d.id, oi); e.currentTarget.parentNode.querySelectorAll('.tag').forEach((b, bi) => b.setAttribute('aria-pressed', String(bi === oi))); } }, o)))
          : h('input.range', { type: 'range', min: d.min, max: d.max, step: d.step || (d.max - d.min) / 400, value: cur, 'aria-label': d.label, oninput: (e) => { const v = Number(e.target.value); val.textContent = fmtVal(v, d); set(d.id, v); } });
        return h('div.prm', null, h('span.prm__lbl', null, d.label), val, control);
      });
      return [
        h('div.layerbar', null,
          h('span.layerbar__name', null, h('span.layer__n', null, String(i + 1)), proc.name),
          h('span.layerbar__tools', null,
            i > 0 ? h('button.btn.btn--quiet', { 'aria-label': 'Porta prima ' + proc.name, title: 'Più in basso negli strati (prima nella catena)', onclick: () => moveMateria(i, -1) }, '↑') : null,
            h('button.btn.btn--quiet', { 'aria-label': 'Togli ' + proc.name, onclick: () => toggleMateria(m.proc) }, 'Togli'),
            h('button.btn.btn--quiet', { title: 'Rimetti i valori di partenza di questa materia', onclick: () => { const mm = cur_(); mm.params = Object.fromEntries(proc.params.map((d) => [d.id, d.def])); mm.mix = 1; rebuild({ materie: work().materie }); drawTab(); } }, 'Rimetti i valori di partenza'))),
        h('p.about.layerbar__about', null, proc.about),
        h('div.prm', null, h('span.prm__lbl', null, 'Quantità', h('span.meta', null, ' · quanto copre quello sotto')), mixVal, mixIn),
        rows,
        territorioSection({ index: i, layer: cur_, flat: true, changed: () => { syncPlayer(); scheduleRead(); }, redrawPanel: () => drawTab() }),
      ];
    }

    function rebuild(patch = {}) {
      const c = work();
      const next = buildAny({
        style: patch.style || c.style, sources: c.sources.map((s) => sourceById(s.id)).filter(Boolean),
        format: { ...c.format, ...(patch.format || {}) }, motion: patch.motionReset ? undefined : { ...c.motion, ...(patch.motion || {}) },
        seed: patch.seed || c.seed, materie: patch.materie ?? c.materie,
        ricetta: patch.ricetta !== undefined ? patch.ricetta : c.style === 'ricetta' ? syncRicetta(c) : null,
      });
      next.intensity = patch.intensity ?? c.intensity ?? 0.8;
      // i gesti scolpiti e la Macro non dipendono dallo stile: restano
      if (c.scolpire) next.scolpire = c.scolpire;
      if (c.macro) next.macro = c.macro;
      for (const [k, v] of Object.entries(c.keys || {})) if (k.startsWith('macro.')) next.keys[k] = v;
      for (const k of ORGANISMO_KEYS) if (c[k]) next[k] = c[k];
      applyIntensity(next);
      adopt(next);
    }

    // Prende una clip già costruita (una ricetta, una scelta della Deriva) come lavoro aperto.
    function adopt(next) {
      Object.keys(S.work).forEach((k) => delete S.work[k]);
      Object.assign(S.work, next);
      touch('clip');
      syncPlayer().then(() => { player.restart(); if (!player.playing) player.play(); drawUsing(); });
      scheduleRead();
    }

    // ---------------------------------------------------- ricette di materia
    function useRicetta(rec) {
      const next = clipFromRicetta(rec, work());
      adopt(next);
      drawAll();
      const w = warnings(next);
      toast(w.length ? `«${rec.name}»: ${w.join(' ')}` : `«${rec.name}» sulle tue foto.`);
    }
    const ricetteOn = {
      apply: useRicetta,
      save: () => openSalva({ clip: work(), onSaved: (rec) => { const c = work(); const next = clipFromRicetta(rec, c); next.format = { ...c.format }; next.seed = c.seed; adopt(next); drawMats(); drawTab(); } }),
      manage: () => openGestione({ apply: useRicetta, work: () => work() }),
    };
    function tweak() { applyIntensity(S.work); touch('clip'); syncPlayer(); scheduleRead(); }
    function deriva() {
      openDeriva({
        before: () => player.pause(),
        onOpen: async () => {
          await syncPlayer(); player.restart(); player.play();
          drawAll();
        },
      });
    }

    function setStyle(id) { if (id === work().style) return; rebuild({ style: id }); drawStyles(); drawTab(); }

    // ---------------------------------------------------- Reset
    // Prima di azzerare si mette da parte il lavoro com'è, scheda aperta
    // compresa: «Annulla» lo rimette identico. Nessuna finestra di conferma.
    function snapshot() { return { work: clone(S.work), ui: { tab: UI.tab, layer: UI.layer, gesto: UI.gesto, catena: UI.catena, strip: UI.strip, page: { ...UI.page } } }; }
    function restore(snap) {
      corpo.reset(); org.stopTool();
      adopt(clone(snap.work));
      Object.assign(UI, snap.ui, { page: { ...snap.ui.page } });
      corpo.sync(); saveUI();
      drawAll();
      toast('Rimesso com’era.');
    }
    function withUndo(text, fn) {
      const snap = snapshot();
      fn();
      corpo.sync(); saveUI();
      drawAll();
      toast(text, { label: 'Annulla', run: () => restore(snap) });
    }
    const replay = () => { touch('clip'); syncPlayer().then(() => { player.restart(); if (!player.playing) player.play(); drawUsing(); }); scheduleRead(); };
    function clearGesto(c) {
      corpo.reset();
      delete c.scolpire; delete c.macro;
      for (const k of Object.keys(c.keys || {})) if (k.startsWith('macro.')) delete c.keys[k];
    }
    function clearCatena(c) {
      org.stopTool();
      for (const k of ORGANISMO_KEYS) delete c[k];
      ensureOrganismo(c);
    }
    /** Tutto da capo: le foto (o la foto) come quando le hai scelte. Restano foto, formato, tenute, ricette. */
    function resetAll() {
      withUndo('Tutto azzerato', () => {
        const c = work();
        clearGesto(c); clearCatena(c);
        const next = buildAny({ style: RESET_STYLE, sources: c.sources.map((s) => sourceById(s.id)).filter(Boolean), format: { ...c.format }, seed: c.seed });
        next.intensity = RESET_INTENSITY;
        ensureOrganismo(next);
        applyIntensity(next);
        adopt(next);
        UI.layer = -1; UI.catena = null;
      });
    }
    const resetStile = () => withUndo('Stile azzerato', () => rebuild({ style: RESET_STYLE, ricetta: null, motionReset: true, intensity: RESET_INTENSITY }));
    const resetMaterie = () => withUndo('Materie tolte', () => { rebuild({ materie: [] }); UI.layer = -1; });
    const resetGesto = () => withUndo('Gesto azzerato', () => { clearGesto(work()); replay(); });
    const resetCatena = () => withUndo('Catena azzerata', () => { clearCatena(work()); UI.catena = null; replay(); });
    app.reset = resetAll;

    // ---------------------------------------------------- le cinque schede
    function tabList() {
      const c = work();
      const g = (c?.scolpire?.gesti?.length || 0) > 0 || !!c?.macro?.on;
      const k = ORGANISMO_KEYS.some((x) => c?.[x]?.on);
      return TABS.map((t) => ({ ...t, dot: (t.id === 'materie' && (c?.materie || []).length > 0) || (t.id === 'gesto' && g) || (t.id === 'catena' && k) }));
    }
    function drawTabs() { tabs.set(UI.tab, tabList()); }
    function openTab(id) {
      if (UI.tab === 'catena' && id !== 'catena') org.stopTool();
      UI.tab = id; saveUI();
      drawTab();
      if (id === 'altro') readNow();
    }

    const sheetHead = (...kids) => h('div.sheet__head', null, kids);
    const title = (t, meta) => h('span.sheet__title', null, t, meta ? h('span.meta', null, meta) : null);

    function tabStile(c) {
      const r = recipeById(c.style) || { name: nameOf(c), line: '' };
      const bpm = h('input.field.field--num', { type: 'number', min: 30, max: 240, value: c.motion.bpm, 'aria-label': 'Battiti al minuto', onchange: (e) => rebuild({ motion: { bpm: Math.min(240, Math.max(30, Number(e.target.value) || 96)) } }) });
      const intVal = h('span.prm__val', null, (c.intensity ?? 0.8).toFixed(2));
      const slider = h('input.range', { type: 'range', min: 0, max: 1, step: 0.01, value: c.intensity ?? 0.8, 'aria-label': 'Intensità', oninput: (e) => { S.work.intensity = Number(e.target.value); intVal.textContent = S.work.intensity.toFixed(2); applyIntensity(S.work); touch('clip'); syncPlayer(); scheduleRead(); } });
      const ric = c.style === 'ricetta';
      return {
        key: 'stile',
        // su iPhone la riga del nome entra nella prima pagina: lo spazio va alle miniature e ai cursori
        head: phone() ? [styles] : [sheetHead(title(ric ? (c.ricetta?.name || 'Ricetta') : r.name, ric ? 'ricetta' : null), miniReset('lo stile', resetStile))],
        blocks: [
          phone() ? h('div.sheet__line', null, title(ric ? (c.ricetta?.name || 'Ricetta') : r.name, ric ? 'ricetta' : null), miniReset('lo stile', resetStile)) : null,
          ric ? ricettaBlock(c, { tweak, save: ricetteOn.save, full: () => openIntera(work(), { tweak, changed: () => drawTab(), fine: () => app.go('banco') }) }, { flat: true })
            : h('p.about.sheet__about', null, r.line),
          h('div.prm', null, h('span.prm__lbl', null, 'Intensità', h('span.meta', null, ' · quanto lo stile pesa sulle foto')), intVal, slider),
          h('div.ctl', null, h('span.ctl__lbl', null, 'Movimento', h('span.meta', null, MOVES.find((m) => m.id === c.motion.mode)?.hint || '')),
            seg(MOVES, c.motion.mode, (v) => { rebuild({ motion: { mode: v } }); drawTab(); }, { label: 'Movimento' })),
          c.motion.mode === 'ritmico' ? h('div.row.bpm', null, bpm, h('span.meta', null, 'battiti al minuto')) : null,
        ],
      };
    }

    function tabMaterie(c) {
      const list = c.materie || [];
      if (UI.layer >= list.length) UI.layer = list.length - 1;
      const adding = UI.layer < 0;
      const chips = h('div.layerchips', { role: 'tablist', 'aria-label': 'Strati' },
        list.map((m, i) => h('button.layerchip', { type: 'button', role: 'tab', 'aria-selected': String(i === UI.layer), onclick: () => { UI.layer = i; saveUI(); drawTab(); } },
          h('span.layer__n', null, String(i + 1)), byId[m.proc].name)));
      // «+ Aggiungi» fuori dalla riga che scorre: si vede sempre, anche con sei strati sul telefono
      const add = list.length < MAX_MATERIE ? h('button.layerchip.layerchip--add', { type: 'button', role: 'tab', 'aria-selected': String(adding), 'aria-label': 'Aggiungi una materia', onclick: () => { UI.layer = -1; saveUI(); drawTab(); } }, list.length && phone() ? '+' : '+ Aggiungi') : null;
      requestAnimationFrame(() => { const on = chips.querySelector('[aria-selected="true"]'); if (on && on.offsetLeft + on.offsetWidth > chips.clientWidth) chips.scrollLeft = on.offsetLeft + on.offsetWidth - chips.clientWidth; });
      const headRow = sheetHead(h('div.layerchips__row', null, chips, add), list.length ? miniReset('le materie', resetMaterie) : null);
      if (adding) {
        const where = phone() ? 'qui sopra' : 'sotto l’immagine';
        return {
          key: 'materie:+',
          head: [headRow, phone() ? mats : null],
          blocks: [
            h('p.about', null, list.length >= MAX_MATERIE ? `Già ${MAX_MATERIE} strati, il massimo: togline uno per aggiungerne un altro.`
              : `Tocca una materia ${where} per posarla sopra le altre, fino a ${MAX_MATERIE}. Ritoccala per toglierla.`),
            list.length ? h('p.meta', null, `Tocca «1 ${byId[list[0].proc].name}» o un altro strato per regolarlo.`) : h('p.meta', null, 'L’immagine diventa il corpo di una sostanza; le materie si sommano a strati.'),
          ],
        };
      }
      const m = list[UI.layer];
      return { key: `materie:${UI.layer}:${m.proc}`, head: [headRow], blocks: layerBlocks(c, UI.layer) };
    }

    function tabGesto() {
      const sub = UI.gesto;
      const subtab = (id, label) => h('button.subtab', { type: 'button', role: 'tab', 'aria-selected': String(sub === id), onclick: () => { UI.gesto = id; saveUI(); drawTab(); } }, label);
      return {
        key: 'gesto:' + sub,
        head: [sheetHead(h('div.subtabs', { role: 'tablist' }, subtab('scolpisci', 'Scolpisci con le dita'), subtab('macro', 'Macro')), miniReset('il gesto', resetGesto))],
        blocks: corpo.blocks(sub),
      };
    }

    function tabCatena() {
      const id = UI.catena;
      if (!id) {
        return {
          key: 'catena',
          head: [sheetHead(title('Tutta la catena', 'agisce su tutte le materie insieme'), miniReset('la catena', resetCatena))],
          blocks: org.rows((v) => { UI.catena = v; saveUI(); drawTab(); }),
        };
      }
      return {
        key: 'catena:' + id,
        head: [sheetHead(
          h('button.sheet__back', { type: 'button', 'aria-label': 'Torna alle tre voci', onclick: () => { org.stopTool(); org.closeView(id); UI.catena = null; saveUI(); drawTab(); } }, h('span', { 'aria-hidden': 'true' }, '‹ '), org.names[id]),
          org.switchOf(id), miniReset('la catena', resetCatena))],
        blocks: org.blocks(id),
      };
    }

    function tabAltro(c) {
      drawClaude();
      return {
        key: 'altro',
        head: null,
        blocks: [
          h('div.grp__head', { 'data-keep': '' }, h('span.label', null, 'Formato'), h('span.meta', null, `${c.format.duration} s · ${c.format.aspect} · ${c.format.fps} fps`)),
          h('div.ctl', null, h('span.ctl__lbl', null, 'Durata'),
            seg(DURATIONS.map((d) => ({ id: d, label: d + ' s' })), c.format.duration, (v) => { rebuild({ format: { duration: v } }); drawTab(); }, { label: 'Durata' })),
          h('div.ctl', null, h('span.ctl__lbl', null, 'Proporzioni'),
            seg(Object.keys(ASPECTS).map((a) => ({ id: a, label: a })), c.format.aspect, (v) => { rebuild({ format: { aspect: v } }); drawStyles(); drawMats(); drawTab(); }, { label: 'Proporzioni' })),
          h('div.ctl', null, h('span.ctl__lbl', null, 'Fotogrammi al secondo'),
            seg([{ id: 24, label: '24' }, { id: 30, label: '30' }], c.format.fps, (v) => { rebuild({ format: { fps: v } }); drawTab(); }, { label: 'Fotogrammi al secondo' })),
          keepNext(grpHead('Altre strade', 'varianti, mutazioni e ricette di questa clip')),
          h('div.flow__more', null,
            h('button.btn', { onclick: () => { rebuild({ seed: newSeed() }); toast('Un’altra versione dello stesso stile'); } }, 'Un’altra versione'),
            h('button.btn', { onclick: () => openProvino({ onOpen: () => { syncPlayer().then(() => player.restart()); drawAll(); } }) }, 'Mostrami 6 versioni'),
            h('button.btn', { onclick: () => deriva(), title: 'Nove mutazioni vive: ne scegli una e si riparte da lei' }, 'Deriva · 9 mutazioni'),
            h('button.btn', { onclick: () => ricetteOn.save() }, 'Salva come ricetta')),
          h('button.switch', { role: 'switch', 'aria-checked': 'false', onclick: () => app.go('vivo') },
            h('span.switch__knob'), h('span.stack', null, h('span', null, 'Anteprima dal vivo'), h('span.meta', null, 'la suoni col dito o col mouse, in tempo reale'))),
          claude,
          kept,
          h('button.link.flow__adv', { onclick: () => app.go('banco') }, 'Avanzato: chiavi sulla timeline, catena e parametri fini'),
        ],
      };
    }

    const MAKE = { stile: tabStile, materie: tabMaterie, gesto: tabGesto, catena: tabCatena, altro: tabAltro };
    function drawTab() {
      const c = work(); if (!c || !ready) return;
      drawTabs();
      if (UI.tab === 'stile' || UI.tab === 'materie') UI.strip = UI.tab;
      const { key, head: hd, blocks } = MAKE[UI.tab](c);
      pg?.destroy();
      pg = pager(blocks, { start: UI.page[key] || 0, onPage: (i) => { UI.page[key] = i; }, label: TABS.find((t) => t.id === UI.tab).label });
      // la striscia sotto l'immagine (Mac): gli stili o le materie, una sola
      if (!phone()) fill(strip, UI.strip === 'materie' ? mats : styles);
      fill(area, hd, pg);
      area.dataset.tab = UI.tab;
      flowEl.dataset.tab = UI.tab;
      flowEl.dataset.view = UI.tab === 'catena' && UI.catena ? UI.catena : '';
      area.setAttribute('aria-label', TABS.find((t) => t.id === UI.tab).label);
      strip.hidden = phone();
    }

    function drawAll() { drawUsing(); drawStyles(); drawMats(); drawTab(); drawKept(); scheduleRead(); org.redraw(); }

    // Prima lettura: misura i primi secondi della clip a 192 px e ne dice la
    // cosa più forte, con le regole locali. «Discuti» apre la lettura completa
    // (Claude sul Mac, se c'è). Si misura quando la scheda Altro è aperta.
    let reading = null, readTok = 0, readTimer = 0;
    const readKey = (c) => JSON.stringify([c.style, c.seed, c.intensity, c.motion, c.format, c.sources.map((x) => x.id), (c.materie || []).map((m) => m.proc)]);
    function scheduleRead() { clearTimeout(readTimer); readTimer = setTimeout(readNow, 800); }
    async function readNow() {
      const c = work(); if (!c || !claude.isConnected) return;
      const key = readKey(c);
      if (reading?.key === key) return;
      const tok = ++readTok;
      reading = { key, text: null };
      drawClaude();
      try {
        const clip = clone(c);
        clip.format = { ...clip.format, duration: Math.min(clip.format.duration, 4), loop: false };
        const { metrics } = await withAux(async () => (tok === readTok ? analyse(auxRenderer(), await auxSources(clip), clip, { samples: 4 }) : {}));
        if (tok !== readTok || !metrics) return;
        const a = localCritique(clip, metrics, expById(S.expId)?.idea);
        const first = (t) => (t || '').split(/(?<=[.!?])\s+/)[0];
        reading.text = first(a.lettura);
        reading.dissent = first(a.disaccordo);
        reading.m = metrics;
      } catch (e) { console.warn('lettura', e); if (tok === readTok) reading = null; }
      if (tok === readTok) drawClaude();
    }

    const pc = (x) => Math.round(Math.min(1, x) * 100) + '%';
    function drawClaude() {
      const real = S.store.mode === 'server' && S.info?.critic;
      const txt = reading?.text ? [reading.text, reading.dissent ? ' ' + reading.dissent : '']
        : 'guardo la clip e la misuro…';
      fill(claude, h('span.claude__who', null, 'Claude (regole locali):'),
        h('span.claude__txt', { 'aria-live': 'polite', 'data-state': reading?.text ? 'detto' : 'misuro', title: reading?.m ? `misure sui primi 4 s: movimento ${pc(reading.m.movimento * 10)} · contrasto ${pc(reading.m.contrasto * 3)} · densità ${pc(reading.m.densita_bordi * 4)} · sfarfallio ${pc(reading.m.sfarfallio * 10)}` : null }, txt),
        h('button.btn.btn--quiet', { onclick: () => app.side.open() }, real ? 'Discuti con Claude' : 'Discuti'));
    }

    function drawKept() {
      const vs = versionsOf(S.expId).filter((v) => v.marked);
      keptLink.hidden = !vs.length;
      fill(keptLink, h('span.flow__keptn', null, `Tenute: ${vs.length}`), h('span.meta', null, 'vai a 3 Salva ›'));
      fill(kept, vs.length ? [
        h('div.kept__head', null, h('span.kept__n', null, `Tenute: ${vs.length}`), h('button.link', { onclick: () => app.go('salva') }, 'Vai a 3 Salva')),
        h('div.kept__row', null, vs.slice(-8).map((v) => h('button.kept__img', { title: `Parti da questa: ${v.note}`, 'aria-label': `Parti da questa: ${v.label}, ${v.note}`, 'aria-current': String(v.id === S.versionId), onclick: () => partiDa(v) }, v.thumb ? h('img', { src: v.thumb, alt: v.note }) : null))),
        h('div.row', null,
          h('span.meta', null, 'Tocca una tenuta per ripartire da lì.'),
          vs.length >= 2 ? h('button.link', { onclick: () => app.go('laboratorio') }, 'Confronta') : null,
          h('button.link', { onclick: () => app.go('laboratorio') }, 'Tutte le versioni')),
      ] : h('p.meta', null, 'Quando una ti convince, tienila: la ritroverai al passo 3.'));
    }

    async function partiDa(v) {
      openVersion(v.id);
      corpo.sync();
      S.pick = S.work.sources.map((x) => x.id); S.zero = !S.pick.length;
      if (!S.work.style) S.work.style = 'emulsione';
      await syncPlayer(); player.restart(); player.play();
      drawAll();
      toast(`Riparti da ${v.label}: quello che tieni da qui nasce come suo ramo.`);
    }

    async function keep() {
      action.progress(0.4, 'Tengo…');
      const c = work();
      const v = await saveVersion(`${nameOf(c)} · ${c.format.duration} s · ${c.format.aspect}`, 'ninni');
      v.marked = true; v.status = 'scelta';
      await updateVersion(v);
      action.progress(null, 'Tieni questa');
      drawKept();
      toast(`Tenuta. Ne hai ${versionsOf(S.expId).filter((x) => x.marked).length}.`);
    }

    app.onFrame = (p) => {
      if (!p.total) return;
      corpo.frame(p);
      const fr = p.frame % p.total;
      tlFill.style.width = ((fr + 1) / p.total) * 100 + '%';
      head.textContent = phone() ? `${(fr / p.fps).toFixed(1)} s di ${p.clip?.format.duration} s` : `${(fr / p.fps).toFixed(1)} s di ${p.clip?.format.duration} s · fotogramma ${fr + 1} di ${p.total}`;
    };
    (async () => {
      fill(area, h('p.meta.sheet__wait', null, 'Preparo l’anteprima…'));
      await ensureWork();
      if (!S.work.style) { S.work.style = 'emulsione'; }
      ready = true;
      corpo.sync();
      await syncPlayer();
      player.restart(); player.play();
      // la lettura prende l'ausiliario prima delle miniature, così arriva subito
      drawUsing(); drawKept(); drawTab(); readNow(); drawStyles(); drawMats();
    })().catch((e) => { console.error(e); toast('Non riesco a preparare l’anteprima: ' + e.message); });

    // su iPhone le strisce stanno nelle schede, sul Mac sotto l'immagine
    const mq = matchMedia('(max-width: 760px)');
    const onMq = () => drawTab();
    mq.addEventListener('change', onMq);

    const keys = (e) => {
      if (document.querySelector('.scrim, .paint')) return;
      if (e.key === 'Escape' && full) { setFull(false); return; }
      if (e.target.closest('input, textarea, select')) return;
      if (e.key === ' ') { e.preventDefault(); player.toggle(); drawUsing(); }
      else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.metaKey && !e.altKey && !e.ctrlKey) { e.preventDefault(); pg?.step(e.key === 'ArrowRight' ? 1 : -1); }
    };
    document.addEventListener('keydown', keys);
    return () => {
      document.removeEventListener('keydown', keys); mq.removeEventListener('change', onMq);
      matIO?.disconnect(); pg?.destroy(); corpo.destroy(); org.destroy(); clearTimeout(orgRestart); clearTimeout(tapTimer); player.pause();
      if (app.reset === resetAll) app.reset = null;
      delete shell.dataset.full;
    };
  },
};

// ============================================================ 3 · Salva
let quality = 'prores422hq';
let long = 3840;

function metaFor(clip, v, exp) {
  return {
    nome: exp?.name, versione: v ? { id: v.id, etichetta: v.label, stato: v.status, nota: v.note } : null,
    stile: nameOf(clip), seme: clip.seed, movimento: clip.motion, loop: clip.format.loop,
    catena: clip.chain.map((p) => ({ processo: byId[p.proc]?.name, acceso: p.on, fusione: p.blend, quantita: p.mix, parametri: p.params })),
    chiavi: clip.keys,
    scolpito: clip.scolpire?.gesti?.length ? { gesti: clip.scolpire.gesti.length, memoria: clip.scolpire.memoria, campo: '512 px, passi di 1/120 s' } : undefined,
    macro: clip.macro?.on ? { ...clip.macro.params, microdettaglio_tipo: clip.macro.micro } : undefined,
    sorgenti: clip.sources.map((s) => { const r = sourceById(s.id); return r ? { nome: r.name, tipo: r.kind, provenienza: r.origin, diritti: r.rights } : { id: s.id, mancante: true }; }),
    ricetta: clip,
  };
}

export const salva = {
  render(root, { app }) {
    const server = S.store.mode === 'server';
    const demo = !server;
    const info = S.info || {};
    const exp = expById(S.expId);
    if (!exp || !S.work) { app.go(S.sources.length ? 'trasforma' : 'scegli'); return; }
    if (demo && long > 1920) long = 1280;
    const list = h('div.savelist');
    const opts = h('div.saveopts');
    const done = h('div.savedone');
    const action = cta('', () => run());
    root.append(h('div.flow.flow--salva', null,
      h('div.flow__head', null, h('h1.title', null, 'Salva il video'),
        h('p.flow__lead', null, demo
          ? 'Questa è la pagina di prova: il browser qui non può salvare file. Ogni fotogramma viene calcolato davvero e lo riguardi qui. Sul Mac, con MOVIOLA avviata, lo stesso pulsante salva il ProRes per DaVinci.'
          : `Esce in ProRes per DaVinci, nella cartella ${info.outDirShort || info.outDir || '~/Movies/MOVIOLA'}, con accanto una scheda con tutte le informazioni per rifarlo identico.`)),
      list, opts, done, action));

    let chosen = null;
    let ov = null; // durata, proporzioni e fps scelti qui valgono per tutti i video salvati
    const vs = () => versionsOf(exp.id).filter((v) => v.marked);
    function current() {
      const kept = vs();
      if (!chosen) chosen = new Set(kept.map((v) => v.id));
      return kept;
    }

    function draw() {
      const kept = current();
      const rows = kept.length ? kept : [];
      fill(list,
        rows.length ? null : h('p.about', null, 'Non hai ancora tenuto nessuna versione: salvo quella che stai guardando.'),
        rows.map((v) => {
          const c = v.clip;
          return h('div.saverow', null,
            h('label.saverow__pick', null,
              h('input', { type: 'checkbox', checked: chosen.has(v.id), onchange: (e) => { e.target.checked ? chosen.add(v.id) : chosen.delete(v.id); drawAction(); } }),
              h('span.saverow__img', null, v.thumb ? h('img', { src: v.thumb, alt: '' }) : null),
              h('span.stack', null, h('span', null, nameOf(c) || v.note || v.label), h('span.meta', null, `${c.format.duration} s · ${c.format.aspect} · ${c.format.fps} fps · ${v.label}`))),
            h('label.saverow__done', { title: 'Lo decidi solo tu. Puoi sempre toglierla.' },
              h('input', { type: 'checkbox', checked: v.status === 'finita', onchange: async (e) => { v.status = e.target.checked ? 'finita' : 'scelta'; if (e.target.checked) v.finishedAt = Date.now(); await updateVersion(v); toast(e.target.checked ? 'Segnata come finita da te' : 'Riaperta'); } }),
              h('span', null, 'Questa è finita')));
        }));
      const codecs = server ? Object.entries(info.codecs || {}).filter(([id, c]) => c.available && id !== 'h264') : [];
      const ref = targets()[0]?.clip || S.work;
      if (!ov) ov = { duration: ref.format.duration, aspect: ref.format.aspect, fps: ref.format.fps };
      const { w, h: hh } = dims(ov.aspect, long);
      fill(opts,
        server ? h('div.ctl', null, h('span.ctl__lbl', null, 'File per DaVinci'),
          seg(codecs.map(([id, c]) => ({ id, label: c.label, hint: c.note })), quality, (v) => { quality = v; draw(); }, { label: 'Formato del file' }),
          h('span.meta', null, `${info.codecs?.[quality]?.note || ''}. Accanto, una scheda .json con tutto per rifarlo identico.`)) : null,
        h('div.ctl', null, h('span.ctl__lbl', null, 'Risoluzione', h('span.meta', null, `${w}×${hh}`)),
          seg((demo ? [1280, 1920] : [3840, 2560, 1920]).map((l) => ({ id: l, label: l === 3840 ? '4K' : String(l) })), long, (v) => { long = v; draw(); }, { label: 'Risoluzione' })),
        h('div.ctl', null, h('span.ctl__lbl', null, 'Fotogrammi al secondo'),
          seg([{ id: 24, label: '24' }, { id: 30, label: '30' }], ov.fps, (v) => { ov.fps = v; draw(); }, { label: 'Fotogrammi al secondo' })),
        h('div.ctl', null, h('span.ctl__lbl', null, 'Durata'),
          seg(DURATIONS.map((d) => ({ id: d, label: d + ' s' })), ov.duration, (v) => { ov.duration = v; draw(); }, { label: 'Durata' })),
        h('div.ctl', null, h('span.ctl__lbl', null, 'Proporzioni'),
          seg(Object.keys(ASPECTS).map((a) => ({ id: a, label: a })), ov.aspect, (v) => { ov.aspect = v; draw(); }, { label: 'Proporzioni' })),
        h('div.row', null,
          server && !isPhone() && info.lan?.length ? h('button.link', { onclick: () => showQR(info.lan[0]) }, 'Apri MOVIOLA sull’iPhone') : null,
          h('button.link', { onclick: () => app.go('esporta') }, 'Altre opzioni (H.264, stazione di render)')));
      drawAction();
    }

    function targets() {
      const kept = current();
      if (!kept.length) return [{ v: null, clip: S.work }];
      return kept.filter((v) => chosen.has(v.id)).map((v) => ({ v, clip: v.clip }));
    }

    function drawAction() {
      const t = targets();
      const secs = ov ? ov.duration * t.length : t.reduce((a, x) => a + x.clip.format.duration, 0);
      if (!t.length) return action.set('Salva', { disabled: true, why: 'Spunta almeno una versione da salvare.' });
      if (demo) return action.set(t.length === 1 ? `Guarda la prova, ${secs} s` : `Guarda le ${t.length} prove`, {});
      action.set(t.length === 1 ? `Salva il video, ${secs} s` : `Salva ${t.length} video, ${secs} s in tutto`, {});
    }

    async function run() {
      const t = targets();
      if (!t.length) return;
      action.btn.disabled = true;
      const results = [];
      try {
        for (let k = 0; k < t.length; k++) {
          let { v, clip } = t[k];
          if (!v) { v = await saveVersion(`${nameOf(clip)} · prima del salvataggio`, 'ninni'); v.marked = true; await updateVersion(v); clip = v.clip; }
          clip = normalizeClip(clone(clip));
          if (ov && (clip.format.duration !== ov.duration || clip.format.aspect !== ov.aspect || clip.format.fps !== ov.fps)) {
            // il file resta legato alla sua ricetta: le modifiche diventano una versione figlia
            clip.format = { ...clip.format, ...ov };
            v = await saveVersion(`${nameOf(clip)} · ${ov.duration} s · ${ov.aspect} · ${ov.fps} fps`, 'ninni', clip, v.id);
            v.marked = true; await updateVersion(v);
          }
          const release = await auxLock();
          try {
          const r = auxRenderer();
          const items = await auxSources(clip);
          const name = `${exp.name}_${v.label}`;
          const onProgress = (i, n, eta) => action.progress(((k + i / n) / t.length), `${demo ? 'Calcolo' : 'Salvo'} ${t.length > 1 ? `${k + 1} di ${t.length} · ` : ''}${Math.round((i / n) * 100)}% · mancano ${eta > 90 ? Math.round(eta / 60) + ' min' : Math.round(eta) + ' s'}`);
          const o = { renderer: r, items, clip, long, codec: quality, name, meta: metaFor(clip, v, exp), onProgress };
          if (demo) { const p = await renderToPreview(o); results.push({ preview: p, name }); }
          else { const rec = await renderToServer(o); rec.thumb = v.thumb; await addRender(rec); results.push(rec); }
          } finally { release(); }
        }
      } catch (e) {
        console.error(e);
        toast('Non sono riuscito a salvare: ' + e.message);
      }
      action.progress(null);
      draw();
      if (demo) { const p = results[results.length - 1]; if (p) showPreview(p.preview, p.name); return; }
      fill(done, results.length ? [
        h('span.label', null, `Salvati: ${results.length}`),
        results.map((rec) => h('div.savedone__row', null, h('span', null, rec.file.split('/').pop()), h('span.meta', null, `${rec.w}×${rec.h} · ${rec.fps} fps`),
          info.platform === 'darwin' && !isPhone() ? h('button.link', { onclick: () => fetch('/api/reveal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ file: rec.file }) }) }, 'Mostra nel Finder') : null)),
      ] : null);
      if (results.length) toast(`Salvato: ${results.length} ${plural(results.length, 'video', 'video')} in ${info.outDirShort || info.outDir || '~/Movies/MOVIOLA'}`);
    }

    draw();
  },
};

function showQR(url) {
  dialog({ title: 'Apri sull’iPhone', body: h('div.stack', null, h('div.qr', { html: qrSvg(url) }), h('p.about', null, 'iPhone e Mac sulla stessa rete Wi‑Fi. Inquadra con la fotocamera: il link contiene la chiave per entrare.'), h('code.meta', null, url)) });
}

export function showPreview({ frames, fps, w, h: hh }, name) {
  const cv = h('canvas', { width: w, height: hh, style: { width: '100%', height: 'auto', display: 'block', background: '#000', cursor: 'pointer' } });
  const g = cv.getContext('2d');
  const info = h('span.meta');
  let raf = 0, paused = false, shown = -1, busy = false, t0 = performance.now(), at = 0;
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    if (!paused) at = (now - t0) / 1000;
    const i = Math.floor(at * fps) % frames.length;
    if (i === shown || busy) return;
    busy = true;
    createImageBitmap(frames[i]).then((bm) => { g.drawImage(bm, 0, 0); bm.close?.(); shown = i; info.textContent = `${i + 1}/${frames.length} · ${fps} fps · ${w}×${hh} · tocca per fermare`; }).catch(() => {}).finally(() => { busy = false; });
  };
  cv.addEventListener('click', () => { paused = !paused; if (!paused) t0 = performance.now() - at * 1000; });
  raf = requestAnimationFrame(tick);
  dialog({ title: `${name} · prova`, wide: true, body: h('div.stack', null, cv, info), onClose: () => { cancelAnimationFrame(raf); frames.length = 0; } });
}
