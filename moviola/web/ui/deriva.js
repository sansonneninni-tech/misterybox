// Deriva: l'app esplora da sola attorno a una clip e mostra nove mutazioni
// vive. Ninni ne sceglie una, che diventa la nuova madre, e si riparte: una
// selezione naturale in cui decide sempre lui. Ogni scelta è una versione
// nuova nell'albero, figlia della madre di prima.
//
// Le nove anteprime girano su un solo motore WebGL, a risoluzione ridotta;
// le mutazioni si misurano piccole sul motore ausiliario e si scartano le
// nere, le bruciate, le immobili e le quasi uguali.

import { S, saveVersion, updateVersion, versionById, openVersion, withAux, auxRenderer, auxSources, clipSources, urlOf } from '../state.js';
import { h, fill, dialog, toast, isPhone } from './kit.js';
import { Renderer } from '../engine/renderer.js';
import { byId } from '../engine/processes.js';
import { clone, dims, normalizeClip } from '../engine/clip.js';
import { recipeById } from '../engine/recipes.js';
import { styleName } from '../engine/ricette.js';
import { mutate, cross, toClip, probe, distance, rejectReason, thresholds, rng, seedOf, toGenome, unitsOf, unitKey } from '../engine/mutazioni.js';
import { loadMedia, videoTime } from '../media.js';
import { openSalva } from './ricette.js';

const N = 9;
const TRIES = 30;
const WHAT = [
  { id: 'parametri', label: 'Parametri', hint: 'i valori di ogni materia, in proporzione alla loro scala' },
  { id: 'catena', label: 'Catena', hint: 'aggiunge, toglie, scambia o riordina una materia' },
  { id: 'movimento', label: 'Movimento', hint: 'carattere, ampiezza e velocità del movimento' },
  { id: 'colore', label: 'Colore', hint: 'tinte, saturazione, bicromia' },
];
// impostazioni che restano da una deriva all'altra
const prefs = { amp: 0.35, what: { parametri: true, catena: true, movimento: true, colore: true } };

// ---------------------------------------------------------- un motore solo
let R = null;
function engine() {
  if (!R) R = new Renderer(document.createElement('canvas'), { histLong: 480, simFull: true });
  return R;
}
/** Ogni anteprima ha la sua memoria (retroazioni, simulazioni) nello stesso motore. */
function freeStates(states) {
  const r = engine();
  for (const m of states) { for (const st of m.values()) r._freePass(st); m.clear(); }
  r.passState = new Map();
}

let srcKey = '', srcItems = [];
async function loadSources(clip) {
  const recs = clipSources(clip);
  const key = recs.map((s) => s.id).join(',');
  if (key === srcKey) return srcItems;
  const items = [];
  for (let i = 0; i < recs.length && i < 4; i++) {
    try {
      const m = await loadMedia(urlOf(recs[i]), recs[i].kind);
      let el = m.el;
      if (m.kind === 'video') { el = m.el.cloneNode(); el.muted = true; el.playsInline = true; el.loop = true; el.src = m.el.currentSrc || m.el.src; await new Promise((res) => { el.onloadeddata = res; el.onerror = res; el.load(); }); }
      items.push({ ...m, el, speed: clip.sources[i]?.speed ?? 1, start: clip.sources[i]?.start || 0 });
    } catch (e) { console.warn(e); }
  }
  engine().setSources(items);
  srcKey = key; srcItems = items;
  return items;
}

// ------------------------------------------------------------- deriva
/**
 * Apre la Deriva sulla clip aperta.
 * opts: { before() prima di aprire (ferma il lettore), onOpen() quando si torna con una madre nuova }
 */
export async function openDeriva({ before, onOpen } = {}) {
  if (!S.work || !S.expId) return;
  before && before();
  // la madre deve stare nell'albero: se ci sono modifiche, diventano una versione
  if (S.dirty || !S.versionId) await saveVersion('Prima della deriva', 'ninni');
  const first = versionById(S.versionId);
  const st = {
    amp: prefs.amp, what: { ...prefs.what }, locks: new Set(),
    seed: seedOf(first?.id || 'm', S.work.seed, 'deriva') % 100000,
    gens: [{ madre: normalizeClip(clone(S.work)), vId: S.versionId, thumb: first?.thumb, label: first?.label || 'madre', said: [], children: null, fav: [] }],
  };
  const cur = () => st.gens[st.gens.length - 1];
  const hasSources = S.work.sources.length > 0;
  const phone = isPhone();
  let tiles = [];      // { clip, said, f, k, canvas, ctx, state, fresh, fav, el, n }
  let token = 0;
  let raf = 0, frame = -1, t0 = 0, paused = false, big = null;
  let long = phone ? 200 : 320;
  const LONGS = phone ? [200, 160, 128] : [320, 256, 200, 160];
  let skips = [];

  // ---------------------------------------------------------- interfaccia
  const genealogy = h('div.deriva__gen');
  const grid = h('div.deriva__grid', { 'data-aspect': S.work.format.aspect });
  const status = h('p.deriva__status', { 'aria-live': 'polite' });
  const crossBtn = h('button.btn', { disabled: true, onclick: () => generate({ crossing: true }) }, 'Incrocia le 2 preferite');
  const backBtn = h('button.btn', { onclick: () => back(st.gens.length - 2) }, 'Indietro di una generazione');
  const ampIn = h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: st.amp, 'aria-label': 'Ampiezza della mutazione', onchange: (e) => { st.amp = prefs.amp = Number(e.target.value); drawAmp(); generate(); }, oninput: (e) => { st.amp = Number(e.target.value); drawAmp(); } });
  const ampLbl = h('span.meta');
  const whatRow = h('div.opt-row.deriva__what');
  const locksBox = h('div.deriva__locks');
  const seedLbl = h('span.meta');
  const controls = h('div.deriva__ctl', null,
    h('label.ctl', null, h('span.ctl__lbl', null, 'Ampiezza', ampLbl), ampIn, h('span.deriva__scale', null, h('span', null, 'ritocco'), h('span', null, 'salto'))),
    h('div.ctl', null, h('span.ctl__lbl', null, 'Cosa può mutare'), whatRow),
    h('details.deriva__lockwrap', null, h('summary.fmt__sum', null, h('span', null, 'Tieni fermo'), h('span.meta', null, 'blocca materie o parametri')), locksBox),
    h('div.deriva__btns', null,
      h('button.btn', { onclick: () => { st.seed = seedOf(st.seed, 'altre') % 100000; generate(); } }, 'Altre 9'),
      backBtn, crossBtn),
    seedLbl);
  const bigLayer = h('div.deriva__big', { hidden: true });
  const body = h('div.deriva', null,
    h('div.deriva__main', null, grid, bigLayer),
    h('div.deriva__side', null, genealogy, status, phone ? h('details.deriva__more', null, h('summary.fmt__sum', null, h('span', null, 'Regola la deriva'), h('span.meta', null, 'ampiezza, cosa muta, blocchi')), controls) : controls));
  const d = dialog({
    title: 'Deriva · nove mutazioni', wide: true, body,
    foot: [h('span.meta.deriva__hint', null, phone ? 'Tocca una mutazione per ingrandirla e sceglierla.' : 'Tocca una mutazione per ingrandirla. «Scegli» la fa madre: la generazione dopo nasce da lei.'),
      h('span.spacer'), h('button.btn.btn--solid', { onclick: () => d.close() }, 'Fine')],
    onClose: close,
  });
  d.el.classList.add('dialog--deriva');

  function drawAmp() {
    const a = st.amp;
    ampLbl.textContent = a < 0.2 ? 'ritocco' : a < 0.45 ? 'variazione' : a < 0.75 ? 'scarto' : 'salto';
  }
  function drawWhat() {
    fill(whatRow, WHAT.map((w) => h('button.tag', { type: 'button', title: w.hint, 'aria-pressed': String(!!st.what[w.id]), onclick: () => {
      st.what[w.id] = !st.what[w.id];
      if (!Object.values(st.what).some(Boolean)) { st.what[w.id] = true; toast('Almeno una cosa deve poter mutare.'); }
      prefs.what = { ...st.what };
      drawWhat(); generate();
    } }, w.label)));
  }
  function drawLocks() {
    const g = toGenome(cur().madre);
    const units = unitsOf(g).filter((u) => !u.head && byId[u.proc]);
    fill(locksBox, units.length ? units.map((u) => {
      const key = unitKey(u);
      const proc = byId[u.proc];
      const lock = h('button.tag', { type: 'button', 'aria-pressed': String(st.locks.has(key)), onclick: () => { st.locks.has(key) ? st.locks.delete(key) : st.locks.add(key); drawLocks(); } }, st.locks.has(key) ? 'Ferma tutta' : 'Tutta');
      return h('details.deriva__unit', null,
        h('summary.deriva__unitsum', null, h('span', null, proc.name), h('span.meta', null, u.layer ? 'strato' : 'base'), [...st.locks].some((k) => k === key || k.startsWith(key + '.')) ? h('span.deriva__locked', null, 'fermo') : null),
        h('div.opt-row', null, lock,
          [...(proc.materia ? [{ id: 'mix', label: 'Quantità' }] : []), ...proc.params.filter((x) => x.id !== 'indice')].map((p) => {
            const k = key + '.' + p.id;
            return h('button.tag', { type: 'button', 'aria-pressed': String(st.locks.has(k) || st.locks.has(key)), disabled: st.locks.has(key), onclick: () => { st.locks.has(k) ? st.locks.delete(k) : st.locks.add(k); drawLocks(); } }, p.label);
          })));
    }) : h('p.meta', null, 'La catena è vuota: niente da tenere fermo.'));
  }
  function drawGenealogy() {
    fill(genealogy,
      h('span.label', null, 'Genealogia'),
      h('div.deriva__line', null, st.gens.map((g, i) => h('button.deriva__anc', {
        'aria-current': String(i === st.gens.length - 1), title: i ? `Generazione ${i}: ${g.said.join(', ')}` : 'La madre da cui sei partito',
        onclick: () => i < st.gens.length - 1 && back(i),
      }, h('span.deriva__ancimg', null, g.thumb ? h('img', { src: g.thumb, alt: '' }) : null), h('span.meta', null, i ? `G${i} · ${g.label}` : `madre · ${g.label}`)))),
      h('p.about.deriva__now', null, st.gens.length > 1
        ? `Generazione ${st.gens.length - 1}. Madre: ${cur().label}, ${cur().said.join(', ') || 'piccoli scarti'}.`
        : `Madre: ${cur().label}, ${styleName(cur().madre, recipeById)}. Scegli una figlia e diventa la madre della prossima generazione.`));
    backBtn.disabled = st.gens.length < 2;
    seedLbl.textContent = `seme della deriva ${st.seed} · generazione ${st.gens.length}`;
  }
  function drawCross() {
    const favs = tiles.filter((t) => t.fav);
    crossBtn.disabled = favs.length < 2;
    crossBtn.textContent = favs.length >= 2 ? `Incrocia ${favs[0].n} e ${favs[1].n}` : 'Incrocia le 2 preferite';
  }

  // ------------------------------------------------------------- tessere
  function tileEl(t) {
    const cv = h('canvas', { width: 2, height: 2 });
    t.canvas = cv; t.ctx = cv.getContext('2d');
    const favBtn = h('button.deriva__fav', { type: 'button', 'aria-pressed': String(!!t.fav), 'aria-label': 'Preferita, per incrociare', title: 'Preferita: con due preferite puoi incrociarle', onclick: (e) => { e.stopPropagation(); toggleFav(t); } }, '♥');
    t.favBtn = favBtn;
    t.el = h('div.deriva__tile', { 'data-fav': String(!!t.fav) },
      h('button.deriva__view', { type: 'button', 'aria-label': `Mutazione ${t.n}: ${t.said.join(', ')}. Ingrandisci`, onclick: () => openBig(t) }, cv),
      h('span.deriva__n', null, String(t.n)),
      h('div.deriva__cap', null,
        h('span.deriva__said', { title: t.said.join(' · ') }, t.said.join(' · ') || 'piccoli scarti'),
        favBtn,
        phone ? null : h('button.deriva__pick', { type: 'button', onclick: (e) => { e.stopPropagation(); choose(t); } }, 'Scegli')));
    return t.el;
  }
  function toggleFav(t) {
    t.fav = !t.fav;
    if (t.fav) { const favs = tiles.filter((x) => x.fav && x !== t); if (favs.length >= 2) { favs[0].fav = false; favs[0].el.dataset.fav = 'false'; favs[0].favBtn.setAttribute('aria-pressed', 'false'); } }
    t.el.dataset.fav = String(t.fav); t.favBtn.setAttribute('aria-pressed', String(t.fav));
    drawCross();
  }
  function placeholders(from = 0) {
    for (let i = from; i < N; i++) grid.append(h('div.deriva__tile.deriva__tile--empty', null, h('span.deriva__n', null, String(i + 1)), h('span.meta', null, 'cerco…')));
  }
  function addTile(t) {
    t.state = new Map(); t.fresh = true;
    t.n = tiles.length + 1;
    tiles.push(t);
    const empty = grid.querySelector('.deriva__tile--empty');
    const el = tileEl(t);
    if (empty) empty.replaceWith(el); else grid.append(el);
    sizeTile(t);
    startLive();
  }
  function sizeTile(t) {
    const { w, h: hh } = dims(cur().madre.format.aspect, long);
    t.canvas.width = w; t.canvas.height = hh;
  }

  // ------------------------------------------------------------ generare
  async function generate({ crossing = false } = {}) {
    const tok = ++token;
    const g = cur();
    const parents = crossing ? tiles.filter((t) => t.fav).slice(0, 2) : null;
    if (crossing && (!parents || parents.length < 2)) return;
    closeBig();
    stopLive();
    freeStates(tiles.map((t) => t.state));
    tiles = [];
    fill(grid); placeholders(0); drawCross();
    const label = crossing ? `incrocio di ${parents[0].n} e ${parents[1].n}` : null;
    const counts = { tried: 0, nera: 0, bruciata: 0, immobile: 0, sfarfalla: 0, uguale: 0, gemella: 0, errore: 0 };
    const say = (extra = '') => {
      const why = [counts.uguale && `${counts.uguale} quasi uguali alla madre`, counts.gemella && `${counts.gemella} gemelle`, counts.nera && `${counts.nera} nere`, counts.bruciata && `${counts.bruciata} bruciate`, counts.immobile && `${counts.immobile} immobili`, counts.sfarfalla && `${counts.sfarfalla} che sfarfallano`, counts.errore && `${counts.errore} con un errore`].filter(Boolean);
      status.textContent = `${extra || (tiles.length < N ? 'Cerco' : 'Fatto')}: ${tiles.length} di ${N}${label ? ' · ' + label : ''} · provate ${counts.tried}${why.length ? ' · scartate ' + why.join(', ') : ''}.`;
    };
    say();
    const spare = [];
    let fromMother = 0, between = 0;
    try {
      await withAux(async () => {
        if (tok !== token) return;
        const aux = auxRenderer();
        const items = await auxSources(g.madre);
        if (!g.f) g.f = await probe(aux, items, g.madre);
        // quanto cambia la madre da sola, con un altro seme: il metro della diversità
        if (g.noise == null) g.noise = distance(g.f, await probe(aux, items, { ...g.madre, seed: (g.madre.seed % 99991) + 7919 }));
        ({ fromMother, between } = thresholds(st.amp, g.noise));
        const pf = parents ? parents.map((p) => p.f) : [g.f];
        for (let k = 0; k < TRIES && tiles.length < N; k++) {
          if (tok !== token) return;
          const r = rng(seedOf(st.seed, st.gens.length, crossing ? 'x' + parents[0].n + parents[1].n : 'm', k));
          let res;
          const opts = { amp: st.amp, what: st.what, locks: st.locks, hasSources };
          if (crossing) {
            const x = cross(parents[0].clip, parents[1].clip, r);
            const mid = toClip(x.genome, g.madre, { recipeById });
            const m = mutate(mid, { ...opts, amp: st.amp * 0.4 }, r);
            res = { genome: m.genome, said: [`${parents[0].n}×${parents[1].n}`, ...m.said].slice(0, 3) };
          } else res = mutate(g.madre, opts, r);
          const clip = toClip(res.genome, g.madre, { recipeById });
          counts.tried++;
          let f;
          try { f = await probe(aux, items, clip); } catch (e) { console.warn('deriva', e); counts.errore++; continue; }
          const why = rejectReason(f, g.f);
          if (why) { counts[why === 'la materia non si compila' ? 'errore' : why]++; if (why !== 'nera' && why !== 'bruciata' && why !== 'la materia non si compila') spare.push({ clip, said: res.said, f, k }); say(); continue; }
          const dm = Math.min(...pf.map((p) => distance(f, p)));
          if (dm < fromMother) { counts.uguale++; spare.push({ clip, said: res.said, f, k, dm }); say(); continue; }
          const ds = tiles.length ? Math.min(...tiles.map((t) => distance(f, t.f))) : Infinity;
          if (ds < between) { counts.gemella++; spare.push({ clip, said: res.said, f, k, dm }); say(); continue; }
          addTile({ clip, said: res.said, f, k, cross: crossing ? parents.map((p) => p.n) : null });
          say();
          await new Promise((res2) => setTimeout(res2, 0));
        }
        // se le diverse non bastano, le più lontane tra quelle rimaste
        while (tiles.length < N && spare.length && tok === token) {
          spare.sort((a, b) => Math.min(...tiles.map((t) => distance(b.f, t.f)), 9) - Math.min(...tiles.map((t) => distance(a.f, t.f)), 9));
          const s = spare.shift();
          addTile({ ...s, said: s.said.length ? s.said : ['vicina alla madre'] });
        }
      });
    } catch (e) { console.error(e); toast('La deriva si è fermata: ' + e.message); }
    if (tok !== token) return;
    grid.querySelectorAll('.deriva__tile--empty').forEach((el) => el.remove());
    g.children = tiles.map(({ clip, said, f, k, cross: cr }) => ({ clip, said, f, k, cross: cr }));
    say(tiles.length < N ? 'Trovate meno di nove diverse: alza l’ampiezza o lascia mutare più cose' : '');
  }

  /** Torna a una generazione precedente: le sue nove figlie, senza ricalcolarle. */
  function back(i) {
    if (i < 0 || i >= st.gens.length - 1) return;
    token++;
    st.gens = st.gens.slice(0, i + 1);
    drawGenealogy(); drawLocks();
    const g = cur();
    if (!g.children) { generate(); return; }
    closeBig(); stopLive();
    freeStates(tiles.map((t) => t.state));
    tiles = [];
    fill(grid);
    for (const c of g.children) addTile({ ...c });
    drawCross();
    status.textContent = `Di nuovo alla generazione ${st.gens.length - 1 || 'di partenza'}: le stesse nove di prima.`;
  }

  async function choose(t, { andWork = false } = {}) {
    token++;
    const g = cur();
    const note = `Deriva G${st.gens.length}: ${t.said.join(', ') || 'piccoli scarti'}`;
    status.textContent = 'Metto la scelta nell’albero delle versioni…';
    const v = await saveVersion(note, 'deriva', t.clip, g.vId);
    v.deriva = { generazione: st.gens.length, seme: st.seed, figlia: t.k, ampiezza: +st.amp.toFixed(2), cosa: Object.keys(st.what).filter((k) => st.what[k]), fermi: [...st.locks], incrocio: t.cross || null, madre: g.vId };
    await updateVersion(v);
    st.gens.push({ madre: clone(t.clip), vId: v.id, thumb: v.thumb, label: v.label, said: t.said, children: null });
    drawGenealogy(); drawLocks();
    if (andWork) { d.close(); return; }
    toast(`${v.label} è la nuova madre: la trovi anche in Versioni.`);
    generate();
  }

  // ------------------------------------------------------- anteprime vive
  function startLive() {
    if (raf) return;
    t0 = performance.now(); frame = -1; skips = [];
    raf = requestAnimationFrame(tick);
  }
  function stopLive() { cancelAnimationFrame(raf); raf = 0; srcItems.forEach((s) => s.kind === 'video' && s.el.pause()); }
  function syncVideos(t) {
    for (const s of srcItems) {
      if (s.kind !== 'video') continue;
      const want = videoTime(s, t);
      if (s.el.paused) s.el.play().catch(() => {});
      if (Math.abs(s.el.currentTime - want) > 0.3) s.el.currentTime = want;
    }
  }
  let srcReady = null;
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (paused) return;
    const clip0 = cur().madre;
    if (!srcReady) { srcReady = loadSources(clip0).then(() => { srcReady = true; }); return; }
    if (srcReady !== true) return;
    const fps = clip0.format.fps, total = Math.max(1, Math.round(clip0.format.duration * fps));
    const target = Math.floor(((now - t0) / 1000) * fps);
    if (target <= frame) return;
    if (frame >= 0) { skips.push(target - frame - 1); if (skips.length > 48) skips.shift(); }
    frame = target;
    const t = (frame % total) / fps;
    syncVideos(t);
    const r = engine();
    const list = big ? [big] : tiles;
    const { w, h: hh } = dims(clip0.format.aspect, big ? (phone ? 540 : 960) : long);
    if (r.w !== w || r.h !== hh) { freeStates(tiles.map((x) => x.state)); r.setSize(w, hh); tiles.forEach((x) => { x.fresh = true; }); }
    for (const x of list) {
      r.passState = x.state;
      if (x.fresh) { r.reset(); x.fresh = false; }
      r.render(x.clip, t, frame, null, { display: true });
      const c = big ? bigCanvas : x.ctx;
      if (big) { if (bigCanvas.width !== w) { bigCanvas.width = w; bigCanvas.height = hh; } bigCtx.drawImage(r.canvas, 0, 0); }
      else if (x.ctx) { if (x.canvas.width !== w) { x.canvas.width = w; x.canvas.height = hh; } x.ctx.drawImage(r.canvas, 0, 0); }
      void c;
    }
    r.passState = new Map();
    // se il computer resta indietro, le anteprime scendono di risoluzione
    if (!big && skips.length >= 48) {
      const lost = skips.reduce((a, b) => a + b, 0) / (skips.length + skips.reduce((a, b) => a + b, 0));
      const i = LONGS.indexOf(long);
      if (lost > 0.3 && i < LONGS.length - 1) { long = LONGS[i + 1]; skips = []; tiles.forEach(sizeTile); }
    }
  }

  // -------------------------------------------------------- ingrandita
  const bigCanvas = h('canvas', { width: 2, height: 2 });
  const bigCtx = bigCanvas.getContext('2d');
  function openBig(t) {
    big = { ...t, state: new Map(), fresh: true };
    const tileRef = t;
    fill(bigLayer,
      h('div.deriva__bigview', null, bigCanvas),
      h('div.deriva__bigbar', null,
        h('div.stack', { style: { gap: '4px', flex: '1 1 220px', minWidth: 0 } },
          h('span.label', null, `Mutazione ${t.n}${t.cross ? ` · incrocio di ${t.cross.join(' e ')}` : ''}`),
          h('span.deriva__bigsaid', null, t.said.join(' · ') || 'piccoli scarti')),
        h('div.deriva__bigacts', null,
          h('button.btn.btn--solid', { onclick: () => choose(tileRef) }, 'Scegli come madre'),
          h('button.btn', { onclick: () => choose(tileRef, { andWork: true }) }, 'Lavoraci adesso'),
          h('button.btn', { 'aria-pressed': String(!!t.fav), onclick: (e) => { toggleFav(tileRef); e.currentTarget.setAttribute('aria-pressed', String(!!tileRef.fav)); } }, '♥ Preferita'),
          h('button.btn', { onclick: () => openSalva({ clip: tileRef.clip }) }, 'Salva come ricetta'),
          h('button.btn.btn--quiet', { onclick: () => closeBig() }, 'Torna alle nove'))));
    bigLayer.hidden = false;
    grid.setAttribute('aria-hidden', 'true');
    startLive();
  }
  function closeBig() {
    if (!big) return;
    for (const st2 of big.state.values()) engine()._freePass(st2);
    big.state.clear();
    big = null;
    bigLayer.hidden = true;
    grid.removeAttribute('aria-hidden');
    tiles.forEach((x) => { x.fresh = true; });
  }

  // --------------------------------------------------------------- fine
  function close() {
    token++;
    stopLive();
    if (big) closeBig();
    freeStates(tiles.map((t) => t.state));
    tiles = [];
    const g = cur();
    if (g.vId && g.vId !== S.versionId && versionById(g.vId)) {
      openVersion(g.vId);
      toast(`Lavori su ${g.label}, generazione ${st.gens.length - 1} della deriva.`);
      onOpen && onOpen();
    } else onOpen && onOpen({ unchanged: true });
  }

  const keys = (e) => {
    if (!d.el.isConnected) { document.removeEventListener('keydown', keys); return; }
    if (e.key === 'Escape' && big) { e.stopImmediatePropagation(); closeBig(); }
  };
  document.addEventListener('keydown', keys, true);

  drawAmp(); drawWhat(); drawLocks(); drawGenealogy();
  generate();
}
