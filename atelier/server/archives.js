// Ricerca negli archivi esterni senza uscire da ATELIER.
// Ogni archivio restituisce elementi con la stessa forma, così l'interfaccia
// e l'importazione non devono conoscere le differenze tra le API.
//
// Elemento: { archive, id, title, author, date, thumb, full, page,
//             license, licenseUrl, rightsStatus, attribution, width, height }
//
// Per aggiungere un archivio: aggiungi un oggetto a ARCHIVES con
// { id, name, description, search(q, page) } (e facoltativamente resolve(item)).

const UA = 'ATELIER/0.1 (laboratorio locale di ricerca artistica; uso personale)';
const PER_PAGE = 24;

// Gli archivi a volte rispondono 5xx o 429 per un attimo: riprovo fino a due volte.
// Il nuovo tentativo parte solo se resta tempo (online la funzione ha ~26 s).
async function getJson(url, opts = {}) {
  const t0 = Date.now();
  for (let i = 0; ; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...(opts.headers || {}) }, signal: AbortSignal.timeout(opts.timeout || 20_000) });
    if (res.ok) return res.json();
    if (i >= 2 || Date.now() - t0 > 9_000 || !(res.status >= 500 || res.status === 429)) throw new Error(`risposta ${res.status}`);
    await new Promise((ok) => setTimeout(ok, 600 * (i + 1)));
  }
}
const first = (v) => (Array.isArray(v) ? v[0] : v) ?? '';
const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function statusFromLicense(lic = '') {
  const l = lic.toLowerCase();
  if (/cc0|publicdomain|public domain|pdm|no known copyright|^pd/.test(l)) return 'libero';
  if (/by-nc|by-nd|nc-|nd-|noncommercial/.test(l)) return 'da verificare';
  if (/cc-by|by-sa|cc by|\/by\/|\/by-sa\/|attribution/.test(l)) return 'con attribuzione';
  return 'da verificare';
}

const openverse = {
  id: 'openverse',
  name: 'Openverse',
  description: 'Oltre 800 milioni di immagini con licenza libera: Flickr, musei, biblioteche, Wikimedia.',
  async search(q, page = 1) {
    const d = await getJson(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page=${page}&page_size=20`);
    return {
      more: page < (d.page_count || 0),
      total: d.result_count,
      items: (d.results || []).map((r) => ({
        archive: 'openverse', id: r.id, title: r.title || 'Senza titolo', author: r.creator || '', date: '',
        thumb: r.thumbnail || r.url, full: r.url, page: r.foreign_landing_url,
        license: `${(r.license || '').toUpperCase()} ${r.license_version || ''}`.trim(), licenseUrl: r.license_url || '',
        rightsStatus: ['cc0', 'pdm'].includes(r.license) ? 'libero' : ['by', 'by-sa'].includes(r.license) ? 'con attribuzione' : 'da verificare',
        attribution: r.attribution || '', width: r.width, height: r.height, via: r.source,
      })),
    };
  },
};

const wikimedia = {
  id: 'wikimedia',
  name: 'Wikimedia Commons',
  description: 'Archivio libero di oltre 100 milioni di file: fotografie storiche, scienza, arte.',
  async search(q, page = 1) {
    const offset = (page - 1) * PER_PAGE;
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(q + ' filetype:bitmap')}&gsrnamespace=6&gsrlimit=${PER_PAGE}&gsroffset=${offset}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=640&list=search&srsearch=${encodeURIComponent(q + ' filetype:bitmap')}&srnamespace=6&srlimit=1&srinfo=totalhits&srprop=&origin=*`;
    const d = await getJson(url);
    const pages = Object.values(d.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
    return {
      total: d.query?.searchinfo?.totalhits,
      more: Boolean(d.continue),
      items: pages.filter((p) => p.imageinfo?.[0]).map((p) => {
        const ii = p.imageinfo[0], m = ii.extmetadata || {};
        const lic = m.LicenseShortName?.value || '';
        return {
          archive: 'wikimedia', id: String(p.pageid), title: strip(m.ObjectName?.value) || p.title.replace(/^File:/, '').replace(/\.[^.]+$/, ''),
          author: strip(m.Artist?.value), date: strip(m.DateTimeOriginal?.value || m.DateTime?.value).slice(0, 40),
          thumb: ii.thumburl || ii.url, full: ii.url, page: ii.descriptionurl,
          license: lic, licenseUrl: m.LicenseUrl?.value || '', rightsStatus: statusFromLicense(lic),
          attribution: strip(m.Attribution?.value || m.Credit?.value), width: ii.width, height: ii.height,
        };
      }),
    };
  },
};

const europeana = {
  id: 'europeana',
  name: 'Europeana',
  description: 'Patrimonio culturale di musei, archivi e biblioteche europee. Solo materiali riutilizzabili.',
  async search(q, page = 1) {
    const key = process.env.EUROPEANA_KEY || 'api2demo';
    const start = (page - 1) * PER_PAGE + 1;
    const d = await getJson(`https://api.europeana.eu/record/v2/search.json?wskey=${key}&query=${encodeURIComponent(q)}&rows=${PER_PAGE}&start=${start}&media=true&qf=TYPE:IMAGE&reusability=open`);
    return {
      total: d.totalResults,
      items: (d.items || []).filter((r) => r.edmIsShownBy || r.edmPreview).map((r) => {
        const lic = first(r.rights);
        return {
          archive: 'europeana', id: r.id, title: first(r.title) || 'Senza titolo', author: first(r.dcCreator), date: first(r.year),
          thumb: first(r.edmPreview) || first(r.edmIsShownBy), full: first(r.edmIsShownBy) || first(r.edmPreview), page: (r.guid || '').split('?')[0],
          license: lic.replace(/^https?:\/\//, ''), licenseUrl: lic, rightsStatus: statusFromLicense(lic), attribution: [first(r.dcCreator), first(r.dataProvider)].filter(Boolean).join(' · '),
          via: first(r.dataProvider),
        };
      }),
    };
  },
};

const loc = {
  id: 'loc',
  name: 'Library of Congress',
  description: 'Fotografie, stampe e disegni della Biblioteca del Congresso, molti senza restrizioni note.',
  async search(q, page = 1) {
    const d = await getJson(`https://www.loc.gov/photos/?q=${encodeURIComponent(q)}&fo=json&c=${PER_PAGE}&sp=${page}&at=results,pagination`, { timeout: 30_000 });
    return {
      total: d.pagination?.of,
      items: (d.results || []).filter((r) => r.image_url?.length).map((r) => {
        const imgs = r.image_url.map((u) => u.split('#')[0]);
        const free = r.access_restricted === false && r.unrestricted !== false;
        return {
          archive: 'loc', id: r.id, title: strip(r.title) || 'Senza titolo', author: first(r.contributor), date: r.date || '',
          thumb: imgs[Math.min(1, imgs.length - 1)], full: imgs[imgs.length - 1], page: r.url,
          license: free ? 'Nessuna restrizione nota (LoC)' : 'Diritti da verificare (LoC)', licenseUrl: 'https://www.loc.gov/legal/understanding-copyright/',
          rightsStatus: 'da verificare', attribution: 'Library of Congress',
        };
      }),
    };
  },
};

const cleveland = {
  id: 'cleveland',
  name: 'Cleveland Museum of Art',
  description: 'Open Access CC0: dipinti, fotografie, stampe, oggetti. Alta risoluzione.',
  async search(q, page = 1) {
    const d = await getJson(`https://openaccess-api.clevelandart.org/api/artworks/?q=${encodeURIComponent(q)}&has_image=1&cc0=1&limit=${PER_PAGE}&skip=${(page - 1) * PER_PAGE}`);
    return {
      total: d.info?.total,
      items: (d.data || []).filter((r) => r.images?.web).map((r) => ({
        archive: 'cleveland', id: String(r.id), title: r.title, author: first(r.creators)?.description || '', date: r.creation_date || '',
        thumb: r.images.web.url, full: (r.images.full || r.images.print || r.images.web).url, page: r.url,
        license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', rightsStatus: 'libero',
        attribution: 'Cleveland Museum of Art', width: Number((r.images.full || r.images.print || r.images.web).width), height: Number((r.images.full || r.images.print || r.images.web).height),
      })),
    };
  },
};

const nasa = {
  id: 'nasa',
  name: 'NASA Image Library',
  description: "Immagini scientifiche e spaziali della NASA: nebulose, superfici planetarie, laboratori, missioni.",
  async search(q, page = 1) {
    const d = await getJson(`https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=image&page=${page}&page_size=${PER_PAGE}`);
    return {
      total: d.collection?.metadata?.total_hits,
      items: (d.collection?.items || []).map((it) => {
        const m = it.data?.[0] || {};
        const thumb = it.links?.find((l) => l.rel === 'preview')?.href || it.links?.[0]?.href;
        return {
          archive: 'nasa', id: m.nasa_id, title: m.title || m.nasa_id, author: m.photographer || m.secondary_creator || m.center || 'NASA', date: (m.date_created || '').slice(0, 10),
          thumb, full: `https://images-assets.nasa.gov/image/${m.nasa_id}/${m.nasa_id}~orig.jpg`, fallback: thumb?.replace('~thumb', '~large'),
          page: `https://images.nasa.gov/details/${encodeURIComponent(m.nasa_id)}`,
          license: 'Media NASA (generalmente non protetti)', licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
          rightsStatus: 'con attribuzione', attribution: 'NASA' + (m.photographer ? ` / ${m.photographer}` : ''),
        };
      }),
    };
  },
};

const iarchive = {
  id: 'iarchive',
  name: 'Internet Archive',
  description: "Immagini caricate su archive.org: fondi fotografici, scansioni, collezioni d'epoca.",
  async search(q, page = 1) {
    const d = await getJson(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(`(${q}) AND mediatype:image`)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=date&fl[]=licenseurl&rows=${PER_PAGE}&page=${page}&output=json`);
    return {
      total: d.response?.numFound,
      items: (d.response?.docs || []).map((r) => ({
        archive: 'iarchive', id: r.identifier, title: first(r.title) || r.identifier, author: first(r.creator), date: String(first(r.date) || '').slice(0, 10),
        thumb: `https://archive.org/services/img/${r.identifier}`, full: null, page: `https://archive.org/details/${r.identifier}`,
        license: r.licenseurl ? r.licenseurl.replace(/^https?:\/\//, '') : 'Diritti da verificare', licenseUrl: r.licenseurl || '',
        rightsStatus: statusFromLicense(r.licenseurl || ''), attribution: first(r.creator) || 'Internet Archive',
      })),
    };
  },
  // Il file a piena risoluzione si trova solo dai metadati dell'elemento.
  async resolve(item) {
    const d = await getJson(`https://archive.org/metadata/${encodeURIComponent(item.id)}`);
    const files = (d.files || []).filter((f) => /\.(jpe?g|png|tiff?|jp2)$/i.test(f.name) && !/thumb/i.test(f.name));
    files.sort((a, b) => Number(b.size || 0) - Number(a.size || 0));
    const pick = files.find((f) => /\.(jpe?g|png|tiff?)$/i.test(f.name)) || files[0];
    if (!pick) throw new Error('nessun file immagine nell\'elemento');
    return `https://archive.org/download/${encodeURIComponent(item.id)}/${encodeURIComponent(pick.name)}`;
  },
};

const met = {
  id: 'met',
  name: 'Metropolitan Museum',
  description: 'Open Access del Met: opere di pubblico dominio in alta risoluzione.',
  async search(q, page = 1) {
    // v1/search è stato ritirato dal Met il 2026-10-01: v1.1 pagina con offset e limit.
    const s = await getJson(`https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&q=${encodeURIComponent(q)}&offset=${(page - 1) * 12}&limit=12`);
    const ids = (s.objectIDs || []).slice(0, 12);
    const objs = await Promise.all(ids.map((id) => getJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`).catch(() => null)));
    return {
      total: s.total,
      more: page * 12 < (s.total || 0),
      items: objs.filter((o) => o && o.primaryImageSmall && o.isPublicDomain).map((o) => ({
        archive: 'met', id: String(o.objectID), title: o.title, author: o.artistDisplayName, date: o.objectDate,
        thumb: o.primaryImageSmall, full: o.primaryImage || o.primaryImageSmall, page: o.objectURL,
        license: 'CC0 (Open Access)', licenseUrl: 'https://www.metmuseum.org/policies/image-resources', rightsStatus: 'libero', attribution: 'The Metropolitan Museum of Art',
      })),
    };
  },
};

const aic = {
  id: 'aic',
  name: 'Art Institute of Chicago',
  description: "Collezione dell'Art Institute: opere di pubblico dominio via IIIF.",
  async search(q, page = 1) {
    const d = await getJson(`https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(q)}&page=${page}&limit=80&fields=id,title,artist_display,date_display,image_id,is_public_domain`, { headers: { 'AIC-User-Agent': UA } });
    const base = d.config?.iiif_url || 'https://www.artic.edu/iiif/2';
    return {
      total: d.pagination?.total,
      more: page * 80 < (d.pagination?.total || 0),
      items: (d.data || []).filter((r) => r.image_id && r.is_public_domain).map((r) => ({
        archive: 'aic', id: String(r.id), title: r.title, author: strip(r.artist_display), date: r.date_display,
        thumb: `${base}/${r.image_id}/full/400,/0/default.jpg`, full: `${base}/${r.image_id}/full/3000,/0/default.jpg`, fallback: `${base}/${r.image_id}/full/1686,/0/default.jpg`,
        page: `https://www.artic.edu/artworks/${r.id}`,
        license: 'CC0 (pubblico dominio)', licenseUrl: 'https://www.artic.edu/open-access/open-access-images', rightsStatus: 'libero', attribution: 'Art Institute of Chicago',
      })),
    };
  },
};

export const ARCHIVES = [openverse, wikimedia, europeana, loc, cleveland, nasa, iarchive, met, aic];

export const describeArchives = () => ARCHIVES.map(({ id, name, description }) => ({ id, name, description }));

export async function searchArchive(id, q, page = 1) {
  const a = ARCHIVES.find((x) => x.id === id);
  if (!a) throw new Error(`Archivio sconosciuto: ${id}`);
  try {
    const r = await a.search(q, page);
    return { archive: id, name: a.name, ok: true, total: r.total ?? r.items.length, more: r.more ?? r.items.length > 0, items: r.items };
  } catch (e) {
    return { archive: id, name: a.name, ok: false, error: `${a.name} non risponde (${e.message}).`, items: [] };
  }
}

export async function resolveFull(item) {
  const a = ARCHIVES.find((x) => x.id === item.archive);
  if (a?.resolve && !item.full) return a.resolve(item);
  return item.full;
}
