// Archivio visivo: importazione, miniature, metadati, provenienza e diritti.
import fs from 'node:fs';
import path from 'node:path';
import { DIRS, getDb, newId, now, save } from './store.js';
import { metadata, thumbnail, writePng } from './imaging.js';

const EXT = { jpeg: 'jpg', png: 'png', webp: 'webp', tiff: 'tif', gif: 'gif', heif: 'heic', avif: 'avif', svg: 'svg', jp2: 'jp2' };
const MAX_DOWNLOAD = 150 * 1024 * 1024;
export const UA = 'ATELIER/0.1 (laboratorio locale di ricerca artistica; uso personale)';

export const RIGHTS_STATES = ['libero', 'con attribuzione', 'da verificare', 'riservato', 'mio'];
// Stati di lavoro (come nel design): '' = materiale. 'finita' arriva solo da un gesto esplicito.
export const CHOICES = ['', 'in esame', 'scelta', 'finita', 'scartata'];

function defaultRights(origin) {
  if (origin.type === 'upload') return { status: 'da verificare', license: '', licenseUrl: '', attribution: '', notes: '' };
  if (origin.type === 'algoritmo') return { status: 'mio', license: 'Opera derivata generata localmente', licenseUrl: '', attribution: '', notes: '' };
  if (origin.type === 'generata') return { status: 'da verificare', license: 'Termini del servizio generativo', licenseUrl: '', attribution: '', notes: '' };
  return { status: 'da verificare', license: '', licenseUrl: '', attribution: '', notes: '' };
}

function publicAsset(a) {
  if (!a) return null;
  return {
    ...a,
    url: `/files/${a.kind === 'variante' ? 'varianti' : 'originali'}/${a.file}`,
    thumbUrl: `/files/miniature/${a.thumb}`,
  };
}

export function listAssets({ q = '', tag = '', rights = '', kind = 'sorgente', origin = '', choice = '' } = {}) {
  const t = q.toLowerCase().trim();
  return Object.values(getDb().assets)
    .filter((a) => !a.deleted)
    .filter((a) => (kind === 'tutte' ? true : a.kind === kind))
    .filter((a) => !tag || a.tags.includes(tag))
    .filter((a) => !rights || a.rights.status === rights)
    .filter((a) => !origin || a.origin.type === origin || a.origin.archive === origin)
    .filter((a) => !choice || a.choice === choice)
    .filter((a) => !t || [a.title, a.notes, a.origin.author, a.origin.archive, ...a.tags].join(' ').toLowerCase().includes(t))
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .map(publicAsset);
}

export const getAsset = (id) => publicAsset(getDb().assets[id]);
export const rawAsset = (id) => getDb().assets[id];

export function assetPath(a) {
  return path.join(a.kind === 'variante' ? DIRS.varianti : DIRS.originali, a.file);
}

export function allTags() {
  const counts = {};
  for (const a of Object.values(getDb().assets)) if (!a.deleted) for (const t of a.tags) counts[t] = (counts[t] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
}

async function register(file, kind, { title, tags = [], origin, rights, notes = '' }) {
  const id = newId(kind === 'variante' ? 'var' : 'img');
  const meta = await metadata(file);
  if (!meta.width) throw new Error('Il file non sembra un\'immagine leggibile.');
  const thumb = `${id}.jpg`;
  await thumbnail(file, path.join(DIRS.miniature, thumb));
  const a = {
    id, kind, file: path.basename(file), thumb,
    title: title || 'Senza titolo', tags: [...new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))], notes,
    width: meta.width, height: meta.height, format: meta.format, colorSpace: meta.space, bitDepth: meta.depth, hasProfile: meta.hasProfile,
    bytes: fs.statSync(file).size,
    origin: { date: now(), ...origin },
    rights: { ...defaultRights(origin), ...(rights || {}) },
    choice: '',
    createdAt: now(),
  };
  getDb().assets[id] = a;
  save();
  return publicAsset(a);
}

export async function importBuffer(buffer, { filename = '', ...info }) {
  const tmp = path.join(DIRS.temp, `in_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(tmp, buffer);
  try {
    const meta = await metadata(tmp);
    const ext = EXT[meta.format] || path.extname(filename).slice(1) || 'bin';
    const base = `${Date.now().toString(36)}_${(filename || info.title || 'immagine').replace(/\.[^.]+$/, '').replace(/[^\w\-]+/g, '-').slice(0, 50)}.${ext}`;
    const dest = path.join(DIRS.originali, base);
    fs.renameSync(tmp, dest);
    return await register(dest, 'sorgente', { title: info.title || filename.replace(/\.[^.]+$/, ''), ...info });
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
}

export async function fetchImage(url) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error('Sono accettati solo indirizzi http e https.');
  const res = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'image/*,*/*;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`Il server ha risposto ${res.status} per ${u.hostname}.`);
  const type = res.headers.get('content-type') || '';
  if (type.includes('text/html')) throw new Error("L'indirizzo porta a una pagina web, non a un'immagine. Usa il link diretto al file (tasto destro sull'immagine → Copia indirizzo immagine).");
  const len = Number(res.headers.get('content-length') || 0);
  if (len > MAX_DOWNLOAD) throw new Error('Il file supera i 150 MB.');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_DOWNLOAD) throw new Error('Il file supera i 150 MB.');
  return { buffer: buf, filename: decodeURIComponent(u.pathname.split('/').pop() || 'immagine'), finalUrl: res.url };
}

export async function importUrl(url, info = {}) {
  const { buffer, filename, finalUrl } = await fetchImage(url);
  return importBuffer(buffer, {
    filename,
    ...info,
    origin: { type: 'url', url: finalUrl, ...(info.origin || {}) },
  });
}

export async function saveVariant(img, info) {
  const id = newId('v');
  const file = path.join(DIRS.varianti, `${id}.png`);
  await writePng(img, file);
  return register(file, 'variante', info);
}

export async function saveVariantFile(srcFile, info) {
  const meta = await metadata(srcFile);
  const ext = EXT[meta.format] || 'bin';
  const file = path.join(DIRS.varianti, `${newId('v')}.${ext}`);
  fs.copyFileSync(srcFile, file);
  return register(file, 'variante', info);
}

export function updateAsset(id, patch) {
  const a = getDb().assets[id];
  if (!a) return null;
  if (typeof patch.title === 'string') a.title = patch.title.slice(0, 300);
  if (typeof patch.notes === 'string') a.notes = patch.notes.slice(0, 20000);
  if (Array.isArray(patch.tags)) a.tags = [...new Set(patch.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))];
  if (patch.rights && typeof patch.rights === 'object') {
    const r = { ...a.rights };
    for (const k of ['license', 'licenseUrl', 'attribution', 'notes']) if (typeof patch.rights[k] === 'string') r[k] = patch.rights[k];
    if (RIGHTS_STATES.includes(patch.rights.status)) r.status = patch.rights.status;
    a.rights = r;
  }
  if (patch.origin && typeof patch.origin === 'object') {
    for (const k of ['author', 'url', 'page', 'archive']) if (typeof patch.origin[k] === 'string') a.origin[k] = patch.origin[k];
  }
  // La scelta è sempre e solo dell'autore: arriva da un gesto esplicito nell'interfaccia.
  if (typeof patch.choice === 'string' && CHOICES.includes(patch.choice)) {
    if (patch.choice === 'finita' && patch.declaredByArtist !== true) throw new Error('Solo tu puoi dichiarare finita un\'opera, con il gesto di conferma.');
    a.choice = patch.choice; a.choiceAt = now();
    if (patch.choice === 'finita') a.finishedAt = now();
  }
  if (typeof patch.marked === 'boolean') a.marked = patch.marked;
  save();
  return publicAsset(a);
}

export function deleteAsset(id) {
  const a = getDb().assets[id];
  if (!a) return false;
  const src = assetPath(a);
  if (fs.existsSync(src)) fs.renameSync(src, path.join(DIRS.cestino, a.file));
  a.deleted = now();
  save();
  return true;
}
