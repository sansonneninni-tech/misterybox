// Versione di prova: scarica un'immagine per conto del browser quando
// l'archivio non permette il download diretto (CORS). Solo immagini.
const UA = 'ATELIER/0.1 (versione di prova; ricerca artistica)';
const MAX = 25 * 1024 * 1024;

export default async (req) => {
  const u = new URL(req.url).searchParams.get('u') || '';
  let target;
  try { target = new URL(u); } catch { return new Response(JSON.stringify({ error: 'indirizzo non valido' }), { status: 400 }); }
  if (!/^https?:$/.test(target.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(target.hostname)) {
    return new Response(JSON.stringify({ error: 'indirizzo non consentito' }), { status: 400 });
  }
  const res = await fetch(target, { headers: { 'User-Agent': UA, Accept: 'image/*' }, redirect: 'follow' });
  const type = res.headers.get('content-type') || '';
  const len = Number(res.headers.get('content-length') || 0);
  if (!res.ok) return new Response(JSON.stringify({ error: `risposta ${res.status}` }), { status: 502 });
  if (!type.startsWith('image/')) return new Response(JSON.stringify({ error: 'non è un\'immagine' }), { status: 415 });
  if (len > MAX) return new Response(JSON.stringify({ error: 'immagine troppo grande per la versione di prova' }), { status: 413 });
  return new Response(res.body, { headers: { 'content-type': type, 'cache-control': 'public, max-age=86400', 'access-control-allow-origin': '*' } });
};
