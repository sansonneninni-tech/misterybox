// Ricette di materia: una catena intera di ninni, con i suoi parametri, il
// movimento e le chiavi, salvata con un nome e riusata su altre foto come se
// fosse una materia sola. Qui solo la parte pura: costruire la clip da una
// ricetta, adattarla alle nuove sorgenti, dire che cosa manca, esportare.
//
// Una clip «in ricetta» ha style = 'ricetta' e clip.ricetta = { id, name,
// chain, keys, dur, nsrc, visibili }: chain è la base congelata (con gli id
// dei passaggi, che decidono anche il movimento), le materie toccate dopo
// restano strati a parte in clip.materie, come con gli stili.

import { byId, defaultParams } from './processes.js';
import { buildClip, cleanMaterie, MAX_MATERIE } from './recipes.js';
import { defaultClip, normalizeClip, newSeed, clone, uid } from './clip.js';

export const RICETTA_VER = 1;
export const MAX_VISIBILI = 6;
export const PACK_TIPO = 'moviola-ricette';

const isHead = (p, i) => i === 0 && p.proc === 'metamorfosi';
const hashStr = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000003; return h; };

/** Dove entrano le materie: dopo la fusione delle foto e i generatori (come negli stili). */
export function materiaAt(chain) {
  let i = 0;
  while (i < chain.length && (chain[i].proc === 'metamorfosi' || byId[chain[i].proc]?.gen)) i++;
  return i;
}

/** I passaggi di una clip senza gli strati di materia aggiunti dalla striscia. */
export function baseOf(chain) {
  return (chain || []).filter((p) => p.layer == null).map((p) => {
    const q = clone(p);
    if (q.baseMix != null) q.mix = q.baseMix;
    q.nome = byId[q.proc]?.name || q.nome || q.proc;
    return q;
  });
}

/** Gli strati di materia di una clip, letti da ciò che si vede davvero (la catena). */
export function layersOf(clip) {
  return (clip.chain || []).filter((p) => p.layer != null).sort((a, b) => a.layer - b.layer)
    .map((p) => ({ proc: p.proc, mix: p.baseMix ?? p.mix ?? 1, params: { ...p.params } }));
}

/** Tutta la catena congelata in una base (gli strati diventano passaggi suoi). */
export function freezeChain(chain) {
  return (chain || []).map((p) => {
    const q = clone(p);
    delete q.layer;
    if (q.baseMix != null) q.mix = q.baseMix;
    q.nome = byId[q.proc]?.name || q.nome || q.proc;
    return q;
  });
}

/** Rilegge la ricetta della clip aperta da ciò che c'è adesso nella catena:
 *  così le regolazioni fini fatte nel Banco non si perdono al prossimo gesto. */
export function syncRicetta(clip) {
  if (!clip?.ricetta) return null;
  const r = clone(clip.ricetta);
  r.chain = baseOf(clip.chain);
  const ids = new Set(r.chain.map((p) => p.id));
  r.keys = Object.fromEntries(Object.entries(clip.keys || {}).filter(([k]) => ids.has(k.split('.')[0])));
  r.dur = clip.format.duration;
  r.nsrc = clip.sources.length;
  // i passaggi spariti dalla catena non restano più in vista
  r.visibili = (r.visibili || []).filter((v) => ids.has(v.pass));
  // le materie che mancavano all'apertura non sono nella catena ma restano
  // nella ricetta, al loro posto: torneranno quando la materia ci sarà di nuovo
  (clip.ricetta.chain || []).forEach((p, i) => { if (!byId[p.proc]) r.chain.splice(Math.min(i, r.chain.length), 0, clone(p)); });
  return r;
}

/**
 * Prepara la base di una ricetta per n sorgenti: le materie che non esistono
 * più si saltano (e si dicono), i parametri nuovi prendono il valore di
 * partenza, la fusione delle foto si aggiunge o si toglie.
 */
export function adaptChain(ric, n) {
  const notes = [];
  const missing = [];
  const out = [];
  for (const p0 of ric.chain || []) {
    const proc = byId[p0.proc];
    if (!proc) { missing.push(p0.nome || p0.proc); continue; }
    const p = clone(p0);
    const known = new Set(proc.params.map((d) => d.id));
    const gone = Object.keys(p.params || {}).filter((k) => !known.has(k));
    if (gone.length) notes.push(`${proc.name}: ${gone.length === 1 ? 'un parametro non esiste più' : gone.length + ' parametri non esistono più'} (${gone.join(', ')}), ignorat${gone.length === 1 ? 'o' : 'i'}.`);
    const fresh = proc.params.filter((d) => !(d.id in (p.params || {})));
    if (fresh.length && Object.keys(p.params || {}).length) notes.push(`${proc.name} ha ${fresh.length === 1 ? 'un parametro nuovo' : fresh.length + ' parametri nuovi'} (${fresh.map((d) => d.label.toLowerCase()).join(', ')}): parte dal valore di partenza.`);
    p.params = { ...defaultParams(p.proc), ...Object.fromEntries(Object.entries(p.params || {}).filter(([k]) => known.has(k))) };
    for (const d of proc.params) {
      let v = Number(p.params[d.id]);
      if (!Number.isFinite(v)) v = d.def;
      p.params[d.id] = Math.min(d.max, Math.max(d.min, v));
    }
    p.on = p.on !== false; p.mix = Math.min(1, Math.max(0, p.mix ?? 1)); p.blend = p.blend || 'normale';
    delete p.layer;
    p.nome = proc.name;
    out.push(p);
  }
  // le foto: con due o più si passa dall'una all'altra, con una sola no
  const headIdx = out.findIndex(isHead);
  if (n >= 2) {
    if (headIdx < 0) out.unshift({ id: 'hd' + hashStr(ric.id || ric.name || 'r').toString(36), proc: 'metamorfosi', on: true, mix: 1, blend: 'normale', nome: byId.metamorfosi?.name, params: { ...defaultParams('metamorfosi'), cicli: Math.min(4, n), deformazione: 0.12, tenuta: 0.4, granulo: 2.5 } });
    else out[0].params.cicli = Math.min(4, Math.max(out[0].params.cicli || 1, n));
  } else if (headIdx === 0 && (ric.nsrc || 0) >= 2) out.shift();
  for (const p of out) if (p.proc === 'sorgente' && n) p.params.indice = Math.min(n, Math.max(1, Math.round(p.params.indice || 1)));
  if ((ric.nsrc || 0) === 0 && n > 0 && out.length && byId[out[0].proc]?.gen) notes.push('È nata senza foto: la foto entra solo dove la catena la usa.');
  return { chain: out, missing, notes };
}

/** Le chiavi della timeline seguono la durata: se la clip si allunga, si allungano. */
export function scaleKeys(keys, from, to, ids) {
  const k = to / Math.max(0.001, from || to);
  const out = {};
  for (const [name, track] of Object.entries(keys || {})) {
    if (ids && !ids.has(name.split('.')[0])) continue;
    out[name] = track.map(([t, v]) => [Math.min(to, t * k), v]);
  }
  return out;
}

/**
 * Come buildClip degli stili, ma sa costruire anche una clip «in ricetta».
 * opts: { style, sources (record), format, motion, seed, materie, ricetta }
 */
export function buildAny(opts = {}) {
  if (opts.style !== 'ricetta' || !opts.ricetta) {
    const c = buildClip({ ...opts, style: opts.style === 'ricetta' ? undefined : opts.style });
    delete c.ricetta;
    return c;
  }
  const ric = clone(opts.ricetta);
  const sources = opts.sources || [];
  const n = Math.min(4, sources.length);
  const base = defaultClip();
  const clip = normalizeClip({
    ...base,
    format: { ...base.format, ...(opts.format || {}) },
    motion: { ...base.motion, ...(opts.motion || {}) },
    seed: opts.seed || newSeed(),
  });
  clip.sources = sources.slice(0, 4).map((s) => ({ id: s.id, speed: 1, start: 0 }));
  const { chain, missing, notes } = adaptChain(ric, n);
  clip.chain = chain;
  const ids = new Set(chain.map((p) => p.id));
  clip.keys = scaleKeys(ric.keys, ric.dur || clip.format.duration, clip.format.duration, ids);
  clip.style = 'ricetta';
  ric.mancanti = missing;
  ric.avvisi = notes;
  ric.visibili = (ric.visibili || []).filter((v) => ids.has(v.pass));
  clip.ricetta = ric;
  // gli strati toccati dopo, sopra la ricetta (al massimo sei in tutto)
  const room = Math.max(0, MAX_MATERIE - chain.filter((p) => byId[p.proc]?.materia).length);
  clip.materie = cleanMaterie(opts.materie).slice(0, room);
  if (clip.materie.length) {
    const layers = clip.materie.map((m, i) => ({
      id: 'l' + i + hashStr(m.proc + ':' + i + ':' + clip.seed).toString(36), proc: m.proc, on: true, mix: m.mix, blend: 'normale', layer: i,
      params: { ...defaultParams(m.proc), ...m.params },
    }));
    clip.chain.splice(materiaAt(clip.chain), 0, ...layers);
  }
  return clip;
}

/** Nome leggibile dello «stile» di una clip, anche quando è una ricetta. */
export function styleName(clip, recipeById) {
  if (clip?.style === 'ricetta') return clip.ricetta?.name || 'Ricetta';
  return recipeById?.(clip?.style)?.name || '';
}

/** I pochi parametri che restano in vista, se ninni non li sceglie: la quantità
 *  di ogni materia (fino a tre) e il parametro più vivo della prima. */
export function suggestVisibili(chain) {
  const out = [];
  const mats = chain.filter((p) => p.on !== false && byId[p.proc]?.materia);
  for (const p of mats.slice(0, 3)) out.push({ pass: p.id, param: 'mix' });
  const first = mats[0] || chain.find((p, i) => p.on !== false && byId[p.proc] && !isHead(p, i) && byId[p.proc].params.length);
  if (first) {
    const best = byId[first.proc].params.filter((d) => !d.options && !(d.step >= 1)).sort((a, b) => (b.mod ?? 0) - (a.mod ?? 0)).slice(0, mats.length ? 1 : 3);
    for (const d of best) out.push({ pass: first.id, param: d.id });
  }
  return out.slice(0, MAX_VISIBILI);
}

/** Il nome che una ricetta propone da sé: le materie che contiene. */
export function suggestName(chain) {
  const names = [...new Set(chain.filter((p) => byId[p.proc]?.materia).map((p) => byId[p.proc].name))];
  if (!names.length) return 'Ricetta';
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(', ') + ' e ' + names[names.length - 1];
}

/** Una ricetta nuova dalla clip: tutta la catena, congelata, con il movimento e le chiavi. */
export function ricettaFromClip(clip, { name, visibili, origine, thumb } = {}) {
  const chain = freezeChain(clip.chain);
  const ids = new Set(chain.map((p) => p.id));
  return {
    id: uid('r'), ver: RICETTA_VER, name: (name || suggestName(chain)).trim().slice(0, 60),
    created: Date.now(), updated: Date.now(), order: Date.now(), thumb: thumb || null,
    ricetta: {
      chain, keys: Object.fromEntries(Object.entries(clip.keys || {}).filter(([k]) => ids.has(k.split('.')[0]))),
      dur: clip.format.duration, nsrc: clip.sources.length,
      visibili: (visibili || suggestVisibili(chain)).filter((v) => ids.has(v.pass)).slice(0, MAX_VISIBILI),
    },
    motion: clone(clip.motion), seed: clip.seed, intensity: clip.intensity ?? 0.8,
    format: { duration: clip.format.duration, fps: clip.format.fps, loop: clip.format.loop },
    origine: origine || null,
  };
}

/** Riporta dentro la ricetta lo stato della clip (per «Aggiorna»). La versione
 *  di prima resta in `precedenti`, per poter tornare indietro. */
export function updateFromClip(rec, clip, { visibili } = {}) {
  const prev = { ricetta: rec.ricetta, motion: rec.motion, seed: rec.seed, intensity: rec.intensity, format: rec.format, thumb: rec.thumb, updated: rec.updated };
  const fresh = ricettaFromClip(clip, { name: rec.name, visibili: visibili || rec.ricetta?.visibili });
  return { ...rec, ricetta: fresh.ricetta, motion: fresh.motion, seed: fresh.seed, intensity: fresh.intensity, format: fresh.format, updated: Date.now(), precedenti: [prev, ...(rec.precedenti || [])].slice(0, 5) };
}

/** La clip.ricetta di una ricetta salvata (ciò che serve a buildAny). */
export function asClipRicetta(rec) {
  return { id: rec.id, name: rec.name, ...clone(rec.ricetta) };
}

/** Che cosa manca a una ricetta per aprirsi identica, detto in parole. */
export function checkRicetta(rec) {
  const { missing, notes } = adaptChain(rec.ricetta || {}, rec.ricetta?.nsrc || 1);
  return { missing, notes, ok: !missing.length };
}

// ------------------------------------------------------------ file
/** Un pacchetto di ricette da salvare o passare a un altro computer. */
export function exportPack(list) {
  return {
    tipo: PACK_TIPO, versione: RICETTA_VER, esportato: new Date().toISOString(),
    nota: 'Ricette di materia di MOVIOLA. Si importano da Trasforma › Materie › Le mie ricette › Gestisci.',
    ricette: list.map((r) => clone(r)),
  };
}

/** Legge un file di ricette (pacchetto, una ricetta sola o un elenco). Le
 *  ricette con un id già presente arrivano come copie. */
export function importPack(data, existing = []) {
  let list;
  if (data && data.tipo === PACK_TIPO && Array.isArray(data.ricette)) list = data.ricette;
  else if (Array.isArray(data)) list = data;
  else if (data && data.ricetta && data.name) list = [data];
  else throw new Error('Questo file non contiene ricette di MOVIOLA.');
  const ids = new Set(existing.map((r) => r.id));
  const names = new Set(existing.map((r) => r.name));
  const out = [], skipped = [];
  for (const r0 of list) {
    if (!r0 || typeof r0.name !== 'string' || !r0.ricetta || !Array.isArray(r0.ricetta.chain)) { skipped.push(r0?.name || '?'); continue; }
    const r = clone(r0);
    if (!r.id || ids.has(r.id)) r.id = uid('r');
    if (names.has(r.name)) r.name = r.name + ' (importata)';
    r.ver = r.ver || RICETTA_VER;
    r.order = Date.now() + out.length;
    r.updated = r.updated || Date.now();
    r.created = r.created || Date.now();
    r.motion = r.motion || defaultClip().motion;
    r.format = r.format || { duration: r.ricetta.dur || 8, fps: 24, loop: true };
    r.importata = Date.now();
    ids.add(r.id); names.add(r.name);
    out.push(r);
  }
  return { ricette: out, skipped };
}
