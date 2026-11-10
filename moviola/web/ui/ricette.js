// Le mie ricette: catene intere di ninni, salvate con un nome e riusate come
// una materia sola. Qui l'archivio, il gruppo nella striscia Materie, il
// salvataggio, la gestione (rinomina, duplica, aggiorna, cancella, ordina,
// esporta e importa) e il pannello della ricetta aperta.

import { S, thumbnail, expById, versionById } from '../state.js';
import { h, fill, dialog, confirmDialog, toast, isPhone, ago, fmtNum } from './kit.js';
import { byId } from '../engine/processes.js';
import { clone } from '../engine/clip.js';
import {
  buildAny, asClipRicetta, ricettaFromClip, updateFromClip, checkRicetta, exportPack, importPack,
  suggestVisibili, suggestName, freezeChain, MAX_VISIBILI,
} from '../engine/ricette.js';
import { applyIntensity } from '../engine/mutazioni.js';

// ------------------------------------------------------------ archivio
let cache = null;
const subs = new Set();
const byOrder = (a, b) => (a.order ?? a.created) - (b.order ?? b.created);

export async function listRicette() {
  if (!cache) {
    try { cache = await S.store.list('ricette'); if (!Array.isArray(cache)) cache = []; }
    catch (e) { console.warn('ricette', e); cache = []; }
    cache.sort(byOrder);
  }
  return cache;
}
export const ricettaById = (id) => (cache || []).find((r) => r.id === id);
export function onRicette(f) { subs.add(f); return () => subs.delete(f); }
const notify = () => subs.forEach((f) => { try { f(); } catch (e) { console.error(e); } });

async function put(rec) {
  await listRicette();
  await S.store.put('ricette', rec);
  const i = cache.findIndex((r) => r.id === rec.id);
  if (i >= 0) cache[i] = rec; else cache.push(rec);
  cache.sort(byOrder);
  notify();
  return rec;
}
async function remove(id) {
  await S.store.del('ricette', id);
  cache = (cache || []).filter((r) => r.id !== id);
  notify();
}

const matCount = (rec) => (rec.ricetta?.chain || []).filter((p) => byId[p.proc]?.materia || (!byId[p.proc] && p.nome)).length;
const describe = (rec) => {
  const n = matCount(rec);
  return `${n ? `${n} ${n === 1 ? 'materia' : 'materie'}` : 'senza materie'} · ${rec.format?.duration || rec.ricetta?.dur || 8} s`;
};

// ------------------------------------------------------- applicare
/** La clip di una ricetta sulle sorgenti della clip aperta: le proporzioni
 *  restano quelle scelte, durata, movimento, seme e chiavi vengono dalla ricetta. */
export function clipFromRicetta(rec, work) {
  const fmt = { ...work.format, duration: rec.format?.duration || rec.ricetta?.dur || work.format.duration, fps: rec.format?.fps || work.format.fps, loop: rec.format?.loop ?? work.format.loop };
  const clip = buildAny({ style: 'ricetta', ricetta: asClipRicetta(rec), sources: work.sources, format: fmt, motion: rec.motion, seed: rec.seed, materie: [] });
  clip.sources = clone(work.sources);
  clip.intensity = rec.intensity ?? 0.8;
  return applyIntensity(clip);
}

/** Che cosa dire quando una ricetta si apre senza qualcosa. */
export function warnings(clip) {
  const r = clip?.ricetta;
  if (!r) return [];
  const out = [];
  if (r.mancanti?.length) out.push(`Manca ${r.mancanti.length === 1 ? 'la materia' : 'le materie'} ${r.mancanti.map((m) => '«' + m + '»').join(', ')}: la ricetta si apre lo stesso, senza.`);
  return out.concat(r.avvisi || []);
}

// ------------------------------------------------------------ provini
const thumbs = new Map();
function provinoKey(rec, work) { return rec.id + '|' + rec.updated + '|' + work.sources.map((s) => s.id).join(',') + '|' + work.format.aspect; }
/** Provino della ricetta sulle foto aperte: la ricetta stessa, non un'icona. */
export async function provino(rec, work) {
  const k = provinoKey(rec, work);
  if (thumbs.has(k)) return thumbs.get(k);
  const c = clipFromRicetta(rec, { ...work, format: { ...work.format } });
  c.format.duration = Math.min(4, c.format.duration);
  const p = thumbnail(c, 280).catch(() => rec.thumb);
  thumbs.set(k, p);
  return p;
}

// ------------------------------------------------- striscia Materie
/**
 * Il gruppo «Le mie ricette» nella striscia Materie.
 * on: { apply(rec), save(), manage() }
 */
export function ricetteGroup(work, on) {
  const tiles = h('div.mats__tiles');
  const el = h('div.mats__fam.mats__fam--ric', null, h('span.mats__famname', null, 'Le mie ricette'), tiles);
  listRicette().then((list) => {
    const io = new IntersectionObserver((ents) => ents.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const rec = ricettaById(en.target.dataset.ric);
      if (rec) provino(rec, work).then((u) => { if (u) en.target.src = u; }).catch(() => {});
    }), { rootMargin: '0px 400px' });
    fill(tiles,
      list.map((rec) => {
        const img = h('img', { alt: '', 'data-ric': rec.id, src: rec.thumb || '' });
        io.observe(img);
        const on_ = work.style === 'ricetta' && work.ricetta?.id === rec.id;
        const miss = !checkRicetta(rec).ok;
        return h('button.style.mat.ric', { 'aria-pressed': String(on_), title: `${rec.name}: ${describe(rec)}${miss ? ' · manca qualcosa' : ''}`, onclick: () => on.apply(rec) },
          h('span.style__img', null, img, miss ? h('span.ric__miss', null, 'manca') : null),
          h('span.style__name', null, rec.name), h('span.style__ref', null, describe(rec)));
      }),
      h('button.style.mat.ric.ric--add', { onclick: () => on.save(), title: 'Salva la clip che vedi come una ricetta tua' },
        h('span.style__img', null, h('span.ric__plus', null, '+')), h('span.style__name', null, 'Salva come ricetta'), h('span.style__ref', null, 'tutta la catena, con un nome')),
      list.length ? h('button.style.mat.ric.ric--add', { onclick: () => on.manage() },
        h('span.style__img', null, h('span.ric__plus', null, '≡')), h('span.style__name', null, 'Gestisci'), h('span.style__ref', null, 'rinomina, ordina, esporta')) : null);
  });
  return el;
}

// --------------------------------------------------- salvataggio
/** Sceglie i pochi parametri che restano in vista. */
function visibiliPicker(chain, chosen) {
  const sel = new Set(chosen.map((v) => v.pass + '.' + v.param));
  const box = h('div.vis');
  const count = h('span.meta');
  const upd = () => { count.textContent = `${sel.size} di ${MAX_VISIBILI} al massimo`; };
  const chip = (p, id, label) => {
    const k = p.id + '.' + id;
    const b = h('button.tag', { type: 'button', 'aria-pressed': String(sel.has(k)), onclick: () => {
      if (sel.has(k)) sel.delete(k);
      else { if (sel.size >= MAX_VISIBILI) { toast(`Al massimo ${MAX_VISIBILI}: è una ricetta, non un banco.`); return; } sel.add(k); }
      b.setAttribute('aria-pressed', String(sel.has(k))); upd();
    } }, label);
    return b;
  };
  fill(box, chain.filter((p) => byId[p.proc] && p.on !== false && !(p.proc === 'metamorfosi')).map((p) => {
    const proc = byId[p.proc];
    return h('div.vis__pass', null,
      h('span.vis__name', null, proc.name),
      h('div.opt-row', null, proc.materia ? chip(p, 'mix', 'Quantità') : null,
        proc.params.filter((d) => !d.options && d.id !== 'indice').map((d) => chip(p, d.id, d.label))));
  }));
  upd();
  return { el: h('div.stack', null, h('div.ctl__lbl', null, h('span', null, 'Parametri in vista'), count), box), get: () => [...sel].map((k) => { const i = k.lastIndexOf('.'); return { pass: k.slice(0, i), param: k.slice(i + 1) }; }) };
}

/**
 * Salva la clip come ricetta. opts: { clip, onSaved(rec, { asNew }) }.
 * Se la clip viene da una ricetta salvata, si può aggiornarla o farne una nuova.
 */
export async function openSalva({ clip, onSaved }) {
  await listRicette();
  const chain = freezeChain(clip.chain);
  const from = clip.style === 'ricetta' && clip.ricetta?.id ? ricettaById(clip.ricetta.id) : null;
  const pre = (clip.ricetta?.visibili?.length ? clip.ricetta.visibili : suggestVisibili(chain));
  const picker = visibiliPicker(chain, pre);
  const img = h('img', { alt: '' });
  thumbnail(clip, 360).then((u) => { img.src = u; }).catch(() => {});
  const defName = from ? from.name : clip.ricetta?.deriva ? suggestName(chain) : suggestName(chain);
  const name = h('input.field', { type: 'text', value: from ? from.name : defName, maxlength: 60, 'aria-label': 'Nome della ricetta', placeholder: 'Nome della ricetta' });
  const exp = expById(S.expId), ver = versionById(S.versionId);
  const save = async (asNew) => {
    const nm = name.value.trim() || defName;
    let rec;
    const visibili = picker.get();
    if (from && !asNew) rec = updateFromClip(from, clip, { visibili });
    else rec = ricettaFromClip(clip, { name: nm, visibili, origine: exp ? { esperimento: exp.name, versione: ver?.label || null } : null });
    rec.name = nm;
    try { rec.thumb = await thumbnail(clip, 280); } catch {}
    await put(rec);
    d.close();
    if (from && !asNew) toast(`«${rec.name}» aggiornata.`, { label: 'Annulla', run: () => undoUpdate(rec.id) });
    else toast(`Ricetta «${rec.name}» salvata: la trovi tra le Materie, in Le mie ricette.`);
    onSaved && onSaved(rec, { asNew });
  };
  const d = dialog({
    title: from ? `Ricetta · ${from.name}` : 'Salva come ricetta',
    body: h('div.ricsave', null,
      h('div.ricsave__img', null, img),
      h('div.stack', null,
        h('label.ctl', null, h('span.ctl__lbl', null, 'Nome', h('span.meta', null, 'lo scegli tu')), name),
        h('p.about', { style: { margin: 0 } }, 'Si salva tutta la catena che vedi, con ogni parametro, il movimento, le chiavi della timeline e il seme. Su un’altra foto la ritrovi identica: cambiano solo le proporzioni, che restano quelle della clip.'),
        picker.el,
        h('p.meta', { style: { margin: 0 } }, 'Quando la usi come materia sola vedi solo questi; «Apri per intero» mostra tutto.'))),
    foot: [h('span.spacer'), h('button.btn', { onclick: () => d.close() }, 'Annulla'),
      from ? h('button.btn', { onclick: () => save(true) }, 'Salva come nuova') : null,
      h('button.btn.btn--solid', { onclick: () => save(false) }, from ? `Aggiorna «${from.name}»` : 'Salva la ricetta')].filter(Boolean),
  });
  setTimeout(() => { name.focus(); name.select(); }, 40);
}

async function undoUpdate(id) {
  const rec = ricettaById(id);
  const prev = rec?.precedenti?.[0];
  if (!prev) return;
  await put({ ...rec, ...prev, precedenti: rec.precedenti.slice(1) });
  toast(`«${rec.name}» è tornata com’era.`);
}

// ------------------------------------------------- pannello in Trasforma
/** Valore e definizione di un parametro in vista. */
function knobDef(clip, v) {
  const p = clip.chain.find((x) => x.id === v.pass);
  if (!p || !byId[p.proc]) return null;
  const proc = byId[p.proc];
  if (v.param === 'mix') return { p, d: { id: 'mix', label: 'Quantità', min: 0, max: 1 }, get: () => p.baseMix ?? p.mix ?? 1, set: (x) => { p.baseMix = x; }, proc };
  const d = proc.params.find((q) => q.id === v.param);
  if (!d || d.options) return null;
  return { p, d, get: () => p.params[d.id] ?? d.def, set: (x) => { p.params[d.id] = x; }, proc };
}

function slider(k, onTweak, { short = false } = {}) {
  const { d } = k;
  const val = h('span.prm__val', null, fmtNum(k.get(), d));
  const input = h('input.range', { type: 'range', min: d.min, max: d.max, step: d.step || (d.max - d.min) / 400, value: k.get(), 'aria-label': `${k.proc.name}, ${d.label}`,
    oninput: (e) => { const v = Number(e.target.value); k.set(v); val.textContent = fmtNum(v, d); onTweak(); } });
  return h('div.prm', null, h('span.prm__lbl', null, short ? d.label : k.proc.name + ' · ' + d.label.toLowerCase()), val, input);
}

/**
 * Il blocco della ricetta aperta, al posto dello stile.
 * on: { tweak() dopo un parametro, save() salva o aggiorna, full() apri per intero }
 */
export function ricettaBlock(clip, on, { flat = false } = {}) {
  const r = clip.ricetta || {};
  const saved = r.id && ricettaById(r.id);
  const knobs = (r.visibili || []).map((v) => knobDef(clip, v)).filter(Boolean);
  const warn = warnings(clip);
  const parts = [
    h('div.flow__style.ric-block__head', null,
      h('span.label', null, 'Ricetta'),
      h('span.flow__stylename', null, r.name || 'Ricetta'),
      h('p.about', null, saved ? `Tua, salvata ${ago(saved.updated || saved.created)}. È la catena intera, usata come una materia sola.`
        : r.deriva ? 'Nata dalla Deriva e non ancora salvata. Se ti convince, salvala come ricetta.'
          : r.id ? 'Questa ricetta non è più nell’archivio: puoi salvarla di nuovo.' : 'Non ancora salvata.')),
    warn.length ? h('div.ric-warn', null, warn.map((w) => h('p', null, w))) : null,
    h('div.row.ric-block__acts', null,
      h('button.btn', { onclick: () => on.full() }, 'Apri per intero'),
      h('button.btn', { onclick: () => on.save() }, saved ? 'Aggiorna o salva come nuova' : 'Salva come ricetta')),
  ];
  const knobEls = knobs.length ? knobs.map((k) => slider(k, on.tweak)) : [h('p.meta', null, 'Nessun parametro in vista: sceglili in «Apri per intero».')];
  // nelle pagine del passo 2 ogni manopola è un blocco a sé
  if (flat) return [parts[0], parts[1], knobEls, parts[2]].filter(Boolean);
  return h('div.ric-block', null, parts[0], parts[1], knobs.length ? h('div.ric-knobs', null, knobEls) : knobEls, parts[2]);
}

/**
 * La ricetta per intero: ogni passaggio con tutti i parametri, e la scelta
 * di quali restano in vista. on: { tweak(), changed(), fine() }
 */
export function openIntera(clip, on) {
  const r = clip.ricetta;
  if (!r) return;
  const body = h('div.intera');
  const isVis = (pid, prm) => (r.visibili || []).some((v) => v.pass === pid && v.param === prm);
  const togglePin = (pid, prm, btn) => {
    r.visibili = r.visibili || [];
    const i = r.visibili.findIndex((v) => v.pass === pid && v.param === prm);
    if (i >= 0) r.visibili.splice(i, 1);
    else { if (r.visibili.length >= MAX_VISIBILI) { toast(`Al massimo ${MAX_VISIBILI} parametri in vista.`); return; } r.visibili.push({ pass: pid, param: prm }); }
    btn.setAttribute('aria-pressed', String(i < 0));
    on.changed();
  };
  const passes = clip.chain.filter((p) => p.layer == null && byId[p.proc]);
  fill(body,
    h('p.about', { style: { margin: 0 } }, 'Ogni regolazione vale subito sull’anteprima. ◆ tiene il parametro in vista quando la ricetta è usata come materia sola (al massimo sei).'),
    passes.map((p, pi) => {
      const proc = byId[p.proc];
      const ks = [...(proc.materia || p.proc !== 'metamorfosi' ? [{ id: 'mix' }] : []), ...proc.params.filter((d) => !d.options)].map((d) => knobDef(clip, { pass: p.id, param: d.id })).filter(Boolean);
      return h('details.intera__pass', { open: pi < 2 },
        h('summary.layer__sum', null, h('span.layer__n', null, String(pi + 1)), h('span.layer__name', null, proc.name), h('span.meta', null, `${ks.length} regolazioni`)),
        h('div.intera__prms', null, ks.map((k) => {
          const pin = h('button.pin', { type: 'button', 'aria-pressed': String(isVis(p.id, k.d.id)), 'aria-label': 'Tieni in vista ' + k.d.label, title: 'In vista quando la ricetta è una materia sola', onclick: () => togglePin(p.id, k.d.id, pin) }, '◆');
          return h('div.intera__row', null, pin, slider(k, on.tweak, { short: true }));
        })));
    }),
    clip.ricetta.mancanti?.length ? h('div.ric-warn', null, warnings(clip).map((w) => h('p', null, w))) : null);
  const d = dialog({
    title: `Per intero · ${r.name}`, wide: true, body,
    foot: [h('button.link', { onclick: () => { d.close(); on.fine(); } }, 'Catena e chiavi nel Banco'), h('span.spacer'), h('button.btn.btn--solid', { onclick: () => d.close() }, 'Fatto')],
    onClose: () => on.changed(),
  });
}

// ------------------------------------------------------- gestione
function download(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
const fileName = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'ricetta';
const today = () => new Date().toISOString().slice(0, 10);

/** Gestione delle ricette. on: { apply(rec), work() → clip aperta o null } */
export async function openGestione(on) {
  await listRicette();
  const list = h('div.riclist');
  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: (e) => { importFile(e.target.files[0]); e.target.value = ''; } });
  const d = dialog({
    title: 'Le mie ricette', wide: true,
    body: h('div.stack', null,
      h('div.row', null,
        h('button.btn', { onclick: () => fileIn.click() }, 'Importa da file'),
        h('button.btn', { onclick: () => { if (!cache.length) return; download(exportPack(cache), `moviola-ricette-${today()}.json`); toast(`${cache.length} ${cache.length === 1 ? 'ricetta esportata' : 'ricette esportate'} in un file .json`); } }, 'Esporta tutte'),
        h('span.grow'), h('span.meta', null, 'il file .json si apre su un altro Mac con «Importa»'), fileIn),
      list),
    onClose: () => off(),
  });
  const off = onRicette(draw);

  function draw() {
    if (!cache.length) { fill(list, h('p.about', null, 'Nessuna ricetta ancora. In Trasforma, sotto le Materie, «Salva come ricetta» mette da parte la catena che vedi.')); return; }
    fill(list, cache.map((rec, i) => {
      const chk = checkRicetta(rec);
      const nm = h('input.field.riclist__name', { type: 'text', value: rec.name, maxlength: 60, 'aria-label': 'Nome della ricetta',
        onchange: async (e) => { const v = e.target.value.trim(); if (!v || v === rec.name) { e.target.value = rec.name; return; } await put({ ...rec, name: v, updated: Date.now() }); toast('Rinominata'); } });
      const w = on.work?.();
      return h('div.riclist__row', null,
        h('span.riclist__img', null, rec.thumb ? h('img', { src: rec.thumb, alt: '' }) : null),
        h('div.riclist__txt', null, nm,
          h('span.meta', null, `${describe(rec)} · ${ago(rec.updated || rec.created)}${rec.importata ? ' · importata' : ''}`),
          chk.ok ? null : h('span.meta.ric-warn__line', null, `Manca: ${chk.missing.join(', ')}. Si apre lo stesso, senza.`)),
        h('div.riclist__acts', null,
          h('button.btn.btn--quiet', { 'aria-label': 'Più su', disabled: i === 0, onclick: () => swap(i, i - 1) }, '↑'),
          h('button.btn.btn--quiet', { 'aria-label': 'Più giù', disabled: i === cache.length - 1, onclick: () => swap(i, i + 1) }, '↓'),
          h('button.btn', { onclick: () => { d.close(); on.apply(rec); } }, 'Usa'),
          h('button.btn.btn--quiet', { onclick: () => duplicate(rec) }, 'Duplica'),
          w ? h('button.btn.btn--quiet', { title: 'Mette nella ricetta la clip che stai guardando', onclick: () => aggiorna(rec, w) }, 'Aggiorna') : null,
          h('button.btn.btn--quiet', { onclick: () => download(exportPack([rec]), `ricetta-${fileName(rec.name)}.json`) }, 'Esporta'),
          h('button.btn.btn--quiet', { onclick: () => elimina(rec) }, 'Elimina')));
    }));
  }

  async function swap(i, j) {
    const a = cache[i], b = cache[j];
    if (!a || !b) return;
    const oa = a.order ?? a.created, ob = b.order ?? b.created;
    await put({ ...a, order: ob === oa ? ob + (j > i ? 1 : -1) : ob });
    await put({ ...b, order: oa });
  }
  async function duplicate(rec) {
    const i = cache.indexOf(rec);
    const next = cache[i + 1];
    const order = next ? ((rec.order ?? rec.created) + (next.order ?? next.created)) / 2 : (rec.order ?? rec.created) + 1;
    await put({ ...clone(rec), id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: rec.name + ' (copia)', created: Date.now(), updated: Date.now(), order, precedenti: [] });
    toast('Duplicata: la copia è subito sotto.');
  }
  async function aggiorna(rec, clip) {
    const ok = await confirmDialog({ title: `Aggiorna «${rec.name}»`, text: 'La ricetta prende la catena, i parametri, il movimento e le chiavi della clip che stai guardando. La versione di prima resta conservata: puoi tornarci con «Annulla».', ok: 'Aggiorna' });
    if (!ok) return;
    const next = updateFromClip(rec, clip);
    try { next.thumb = await thumbnail(clip, 280); } catch {}
    await put(next);
    toast(`«${rec.name}» aggiornata.`, { label: 'Annulla', run: () => undoUpdate(rec.id) });
  }
  async function elimina(rec) {
    const ok = await confirmDialog({ title: 'Elimina la ricetta', text: `«${rec.name}» sparisce dalle Materie. Le clip già fatte con lei restano come sono. Se vuoi conservarla, esportala prima.`, ok: 'Elimina', danger: true });
    if (!ok) return;
    await remove(rec.id);
    toast(`«${rec.name}» eliminata.`, { label: 'Annulla', run: () => put(rec) });
  }
  async function importFile(f) {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const { ricette, skipped } = importPack(data, cache);
      for (const r of ricette) await put(r);
      const missing = ricette.filter((r) => !checkRicetta(r).ok).map((r) => r.name);
      toast(`${ricette.length ? `Importate: ${ricette.length}.` : 'Nessuna ricetta importata.'}${skipped.length ? ` Non leggibili: ${skipped.length}.` : ''}${missing.length ? ` A ${missing.join(', ')} manca qualche materia di questo computer: si aprono lo stesso.` : ''}`);
    } catch (e) { toast('Non riesco a leggere il file: ' + (e.message || e)); }
  }
  draw();
}
