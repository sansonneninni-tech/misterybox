// Stato dell'applicazione e operazioni sull'archivio.
// Regola: ogni salvataggio crea una versione nuova, figlia della corrente.
// Niente si sovrascrive, niente si dichiara finito senza un gesto di ninni.

import { openStore } from './store.js';
import { defaultClip, normalizeClip, clone, uid, dims } from './engine/clip.js';
import { Renderer } from './engine/renderer.js';
import { loadMedia, seekVideo, videoTime } from './media.js';

export const S = {
  store: null,
  info: null,
  sources: [],
  experiments: [],
  versions: [],
  renders: [],
  expId: null,       // esperimento aperto
  versionId: null,   // versione da cui parte il lavoro attuale
  work: null,        // clip in lavorazione (non ancora salvata)
  dirty: false,
  listeners: new Set(),
};

export function emit(what) { for (const f of S.listeners) f(what); }
export function on(f) { S.listeners.add(f); return () => S.listeners.delete(f); }

export async function boot() {
  S.store = await openStore();
  S.info = S.store.info;
  const [sources, experiments, versions, renders] = await Promise.all(['sources', 'experiments', 'versions', 'renders'].map((c) => S.store.list(c)));
  S.sources = sources.sort((a, b) => b.created - a.created);
  S.experiments = experiments.sort((a, b) => (b.updated || b.created) - (a.updated || a.created));
  S.versions = versions;
  S.renders = renders.sort((a, b) => b.created - a.created);
  if (S.store.mode === 'browser') {
    for (const s of S.sources) s.url = await S.store.mediaUrlAsync(s);
  }
  // riprende il lavoro lasciato aperto
  try {
    const saved = JSON.parse(localStorage.getItem('moviola.work') || 'null');
    if (saved && S.experiments.some((e) => e.id === saved.expId)) {
      S.expId = saved.expId; S.versionId = saved.versionId; S.work = normalizeClip(saved.work); S.dirty = !!saved.dirty;
    }
  } catch {}
  if (!S.work && S.experiments[0]) openExperiment(S.experiments[0].id, false);
}

export function remember() {
  try { localStorage.setItem('moviola.work', JSON.stringify({ expId: S.expId, versionId: S.versionId, work: S.work, dirty: S.dirty })); } catch {}
}

// ------------------------------------------------------------- sorgenti
export const sourceById = (id) => S.sources.find((s) => s.id === id);
export const clipSources = (clip) => (clip?.sources || []).map((s) => sourceById(s.id)).filter(Boolean);
export const urlOf = (src) => S.store.mediaUrl(src) || src.url;

export async function addSource(rec) {
  S.sources.unshift(rec);
  await S.store.put('sources', rec);
  emit('sources');
  return rec;
}
export async function updateSource(rec) { await S.store.put('sources', rec); emit('sources'); }
export async function removeSource(id) {
  S.sources = S.sources.filter((s) => s.id !== id);
  await S.store.del('sources', id);
  emit('sources');
}

// ---------------------------------------------------------- esperimenti
export const expById = (id) => S.experiments.find((e) => e.id === id);
export const versionById = (id) => S.versions.find((v) => v.id === id);
export const versionsOf = (expId) => S.versions.filter((v) => v.expId === expId).sort((a, b) => a.created - b.created);

export async function createExperiment(name, clip, { by = 'ninni', note = '', idea = '' } = {}) {
  const exp = { id: uid('e'), name: name || 'Senza titolo', created: Date.now(), updated: Date.now(), idea };
  S.experiments.unshift(exp);
  await S.store.put('experiments', exp);
  S.expId = exp.id; S.versionId = null;
  S.work = normalizeClip(clip || defaultClip());
  await saveVersion(note || 'Partenza', by);
  return exp;
}

export function openExperiment(expId, notify = true) {
  const vs = versionsOf(expId);
  if (!vs.length) return;
  const exp = expById(expId);
  const v = versionById(exp.head) || vs[vs.length - 1];
  S.expId = expId; S.versionId = v.id; S.work = normalizeClip(clone(v.clip)); S.dirty = false;
  remember();
  if (notify) emit('work');
}

export function openVersion(vId) {
  const v = versionById(vId);
  if (!v) return;
  S.expId = v.expId; S.versionId = v.id; S.work = normalizeClip(clone(v.clip)); S.dirty = false;
  remember();
  emit('work');
}

/** Modifica la clip in lavorazione. */
export function touch(what = 'clip') { S.dirty = true; remember(); emit(what); }

export async function saveVersion(note = '', by = 'ninni', clip = S.work, parentId = S.versionId) {
  const exp = expById(S.expId);
  const n = versionsOf(S.expId).length + 1;
  const v = {
    id: uid('v'), expId: S.expId, parentId: parentId || null, created: Date.now(),
    label: 'v' + n, note, by, status: 'materiale', marked: false,
    clip: clone(clip), thumb: null,
  };
  try { v.thumb = await thumbnail(v.clip); } catch (e) { console.warn('miniatura', e); }
  S.versions.push(v);
  await S.store.put('versions', v);
  if (clip === S.work) { S.versionId = v.id; S.dirty = false; }
  exp.head = v.id; exp.updated = Date.now();
  if (!exp.thumb || by === 'ninni') exp.thumb = v.thumb;
  await S.store.put('experiments', exp);
  remember();
  emit('versions');
  return v;
}

export async function updateVersion(v) { await S.store.put('versions', v); emit('versions'); }

export async function renameExperiment(id, name) {
  const e = expById(id); e.name = name; e.updated = Date.now();
  await S.store.put('experiments', e); emit('experiments');
}

export async function deleteExperiment(id) {
  for (const v of versionsOf(id)) await S.store.del('versions', v.id);
  S.versions = S.versions.filter((v) => v.expId !== id);
  S.experiments = S.experiments.filter((e) => e.id !== id);
  await S.store.del('experiments', id);
  if (S.expId === id) { S.expId = null; S.versionId = null; S.work = null; remember(); }
  emit('experiments');
}

export async function addRender(rec) { S.renders.unshift(rec); try { await S.store.put('renders', rec); } catch {} emit('renders'); }

// -------------------------------------------------------- renderer ausiliario
// Un solo contesto WebGL per miniature, analisi ed export: i browser ne
// concedono pochi.
let aux;
export function auxRenderer() {
  if (!aux) {
    const c = document.createElement('canvas');
    aux = new Renderer(c, { histLong: 1920 });
  }
  return aux;
}

/** Prepara le sorgenti di una clip sul renderer ausiliario. */
export async function auxSources(clip) {
  const r = auxRenderer();
  const recs = clipSources(clip);
  const items = [];
  for (let i = 0; i < recs.length && i < 4; i++) {
    try {
      const m = await loadMedia(urlOf(recs[i]), recs[i].kind);
      // un elemento video per l'ausiliario, separato da quello del lettore
      let el = m.el;
      if (m.kind === 'video') { el = m.el.cloneNode(); el.muted = true; el.playsInline = true; el.src = m.el.currentSrc || m.el.src; await new Promise((res) => { el.onloadeddata = res; el.onerror = res; el.load(); }); }
      items.push({ ...m, el, speed: clip.sources[i]?.speed ?? 1, start: clip.sources[i]?.start || 0 });
    } catch (e) { console.warn(e); }
  }
  r.setSources(items);
  return items;
}

export async function thumbnail(clip, long = 360) {
  const r = auxRenderer();
  const items = await auxSources(clip);
  const { w, h } = dims(clip.format.aspect, long);
  r.setSize(w, h); r.prune([]); r.reset();
  const fps = clip.format.fps, total = Math.round(clip.format.duration * fps);
  const f = Math.round(total * 0.4);
  const from = Math.max(0, f - 30);
  for (let i = from; i <= f; i++) {
    const t = (i % total) / fps;
    if (i === from || i === f) for (const s of items) if (s.kind === 'video') await seekVideo(s.el, videoTime(s, t));
    r.render(clip, t, i, null, { display: i === f });
  }
  return r.canvas.toDataURL('image/jpeg', 0.84);
}
