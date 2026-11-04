// Versione di prova: ricerca negli archivi del mondo, con lo stesso codice del server.
import { describeArchives, searchArchive, resolveFull } from '../../server/archives.js';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': status === 200 ? 'public, max-age=300' : 'no-store' } });

export default async (req) => {
  try {
    if (req.method === 'POST') {
      const { item } = await req.json();
      return json({ full: await resolveFull(item || {}) });
    }
    const u = new URL(req.url);
    if (u.searchParams.has('elenco')) return json({ archives: describeArchives() });
    const q = (u.searchParams.get('q') || '').trim().slice(0, 200);
    if (!q) return json({ error: 'Scrivi cosa cercare.' }, 400);
    const ids = (u.searchParams.get('archives') || 'openverse,wikimedia,cleveland').split(',').filter(Boolean).slice(0, 9);
    const page = Math.max(1, Math.min(50, Number(u.searchParams.get('page')) || 1));
    const results = await Promise.all(ids.map((id) => searchArchive(id, q, page).catch((e) => ({ archive: id, ok: false, error: e.message, items: [] }))));
    return json({ q, results });
  } catch (e) {
    return json({ error: e.message }, 400);
  }
};
