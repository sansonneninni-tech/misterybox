// Archivio: sul Mac parla con il server (file in moviola/dati), nella pagina
// demo resta nel browser (IndexedDB). Stessa interfaccia per entrambi.

const COLLS = ['sources', 'experiments', 'versions', 'renders', 'queue', 'ricette'];

class ServerStore {
  constructor(info) { this.mode = 'server'; this.info = info; }
  async list(c) { return (await fetch(`/api/db/${c}`)).json(); }
  async put(c, o) {
    const r = await fetch(`/api/db/${c}/${encodeURIComponent(o.id)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
    if (!r.ok) throw new Error('Salvataggio non riuscito: ' + r.status);
    return o;
  }
  async del(c, id) { await fetch(`/api/db/${c}/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
  async upload(blob, name) {
    const r = await fetch(`/api/upload?name=${encodeURIComponent(name || '')}`, { method: 'POST', headers: { 'content-type': blob.type || 'application/octet-stream' }, body: blob });
    if (!r.ok) throw new Error(await r.text());
    return r.json(); // { file, url }
  }
  async importUrl(url) {
    const r = await fetch('/api/import-url', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }
  mediaUrl(src) { return src.url; }
  async proxy(file) {
    const r = await fetch(`/api/proxy/${encodeURIComponent(file)}`, { method: 'POST' });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }
}

class LocalStore {
  constructor() { this.mode = 'browser'; this.info = null; this.urls = new Map(); }
  async open() {
    this.db = await new Promise((res, rej) => {
      const r = indexedDB.open('moviola', 2);
      r.onupgradeneeded = () => { for (const c of [...COLLS, 'blobs']) if (!r.result.objectStoreNames.contains(c)) r.result.createObjectStore(c, { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return this;
  }
  _tx(c, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(c, mode);
      const s = t.objectStore(c);
      const r = fn(s);
      t.oncomplete = () => res(r && r.result);
      t.onerror = () => rej(t.error);
    });
  }
  list(c) { return this._tx(c, 'readonly', (s) => s.getAll()); }
  async put(c, o) { await this._tx(c, 'readwrite', (s) => s.put(o)); return o; }
  del(c, id) { return this._tx(c, 'readwrite', (s) => s.delete(id)); }
  async upload(blob, name) {
    const id = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    await this._tx('blobs', 'readwrite', (s) => s.put({ id, blob, name }));
    return { file: id, url: this._url(id, blob) };
  }
  _url(id, blob) { if (!this.urls.has(id)) this.urls.set(id, URL.createObjectURL(blob)); return this.urls.get(id); }
  async importUrl(url) {
    let r;
    try { r = await fetch(url); } catch { throw new Error('Il sito non permette di scaricare il file dal browser. Sul Mac, con il server, funziona.'); }
    if (!r.ok) throw new Error(`Il sito ha risposto ${r.status}`);
    const blob = await r.blob();
    if (!/^(image|video)\//.test(blob.type)) throw new Error("Non è un'immagine o un video");
    const u = new URL(url);
    return { ...(await this.upload(blob, u.pathname.split('/').pop())), origin: u.href, host: u.host, type: blob.type };
  }
  async mediaUrlAsync(src) {
    if (this.urls.has(src.file)) return this.urls.get(src.file);
    const rec = await this._tx('blobs', 'readonly', (s) => s.get(src.file));
    return rec ? this._url(src.file, rec.blob) : src.url;
  }
  mediaUrl(src) { return this.urls.get(src.file) || src.url; }
  async proxy() { throw new Error('Serve il server sul Mac per convertire questo video'); }
}

export async function openStore() {
  try {
    const r = await fetch('/api/info', { cache: 'no-store' });
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) return new ServerStore(await r.json());
  } catch {}
  try { return await new LocalStore().open(); }
  catch { return new MemoryStore(); }
}

/** Quando il browser non concede IndexedDB (navigazione privata, pagine
 *  incorporate): si lavora lo stesso, ma tutto resta solo in memoria. */
class MemoryStore extends LocalStore {
  constructor() { super(); this.volatile = true; this.mem = new Map(); }
  _tx(c, mode, fn) {
    if (!this.mem.has(c)) this.mem.set(c, new Map());
    const m = this.mem.get(c);
    const s = { getAll: () => ({ result: [...m.values()] }), get: (id) => ({ result: m.get(id) }), put: (o) => { m.set(o.id, o); }, delete: (id) => { m.delete(id); } };
    const r = fn(s);
    return Promise.resolve(r && r.result);
  }
}
