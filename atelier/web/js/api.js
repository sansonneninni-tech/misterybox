// Client dell'API. Nella versione online (demo) lo stesso oggetto è
// sostituito da un'implementazione che lavora interamente nel browser.

async function call(method, url, body, isForm = false) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    if (isForm) opts.body = body;
    else { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  }
  const res = await fetch(url, opts);
  let data = null;
  try { data = await res.json(); } catch { /* risposta vuota */ }
  if (!res.ok) throw Object.assign(new Error(data?.error || `Errore ${res.status}`), { detail: data?.detail || '' });
  return data;
}

const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null)).toString();

export const serverApi = {
  mode: 'locale',
  status: (fast) => call('GET', fast ? '/api/status?veloce' : '/api/status'),
  processes: () => call('GET', '/api/processes'),
  lan: () => call('GET', '/api/lan'),

  assets: (filters = {}) => call('GET', `/api/assets?${qs(filters)}`),
  asset: (id) => call('GET', `/api/assets/${id}`),
  upload: (files, meta = {}) => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f, f.name);
    fd.append('meta', JSON.stringify(meta));
    return call('POST', '/api/assets/upload', fd, true);
  },
  samples: () => call('POST', '/api/assets/samples'),
  importUrl: (url) => call('POST', '/api/assets/url', { url }),
  updateAsset: (id, patch) => call('PATCH', `/api/assets/${id}`, patch),
  deleteAsset: (id) => call('DELETE', `/api/assets/${id}`),

  archives: () => call('GET', '/api/archives'),
  searchArchives: (q, archives, page = 1) => call('GET', `/api/archives/search?${qs({ q, archives: archives.join(','), page })}`),
  importFromArchive: (item) => call('POST', '/api/archives/import', { item }),

  experiments: () => call('GET', '/api/experiments'),
  experiment: (id) => call('GET', `/api/experiments/${id}`),
  createExperiment: (data) => call('POST', '/api/experiments', data),
  updateExperiment: (id, patch) => call('PATCH', `/api/experiments/${id}`, patch),
  deleteExperiment: (id) => call('DELETE', `/api/experiments/${id}`),
  addSources: (id, assetIds) => call('POST', `/api/experiments/${id}/sources`, { assetIds }),
  updateNode: (id, node, patch) => call('PATCH', `/api/experiments/${id}/nodes/${node}`, patch),
  run: (id, req) => call('POST', `/api/experiments/${id}/run`, req),

  // Anteprima veloce: restituisce un indirizzo da mettere in <img>.
  preview: async (req) => {
    const res = await fetch('/api/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req) });
    if (!res.ok) { let m = `Errore ${res.status}`; try { m = (await res.json()).error || m; } catch { /* */ } throw new Error(m); }
    return URL.createObjectURL(await res.blob());
  },

  hfModels: () => call('GET', '/api/higgsfield/models'),
  hfRoute: (route) => call('POST', '/api/higgsfield/route', { route }),
  hfQuote: (id, req) => call('POST', `/api/experiments/${id}/higgsfield/quote`, req),
  hfRun: (id, quoteId, approval) => call('POST', `/api/experiments/${id}/higgsfield/run`, { quoteId, approval }),

  analyze: (assetId, experimentId, provider) => call('POST', '/api/critic/analyze', { assetId, experimentId, provider }),
  discuss: (message, ctx) => call('POST', '/api/critic/discuss', { message, ...ctx }),
  ideas: (idea, provider) => call('POST', '/api/critic/ideas', { idea, provider }),

  exportFormats: () => call('GET', '/api/export/formats'),
  exportAsset: (assetId, format) => call('POST', '/api/export', { assetId, format }),
  reveal: (path) => call('POST', '/api/reveal', { path }),
};
