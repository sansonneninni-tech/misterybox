// Guardia per claude -p (hook PreToolUse su mcp__higgsfield__generate_image).
// Una sola chiamata per corsa, una sola immagine, modello e prompt del preventivo.
// Uscita 2 = chiamata bloccata (Claude riceve il motivo e non genera).
const fs = require('node:fs');
const stateFile = process.argv[2];
let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  const block = (why) => { process.stderr.write(`ATELIER ha bloccato la chiamata: ${why}. Non riprovare: rispondi {"error":"${why}"}.`); process.exit(2); };
  let st, ev;
  try { st = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return block('stato della guardia mancante'); }
  try { ev = JSON.parse(input); } catch { return block('richiesta illeggibile'); }
  if (st.used) return block('generate_image è già stato chiamato una volta');
  let p = ev?.tool_input?.params ?? ev?.tool_input ?? {};
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch { return block('parametri illeggibili'); } }
  const num = (v) => (v == null ? 1 : Number(v));
  for (const k of ['count', 'batch_size', 'num_images', 'images', 'n']) if (num(p[k]) !== 1) return block(`${k} deve essere 1`);
  if (st.model && p.model !== st.model) return block(`modello diverso da ${st.model}`);
  const norm = (t) => String(t || '').trim().replace(/\s+/g, ' ');
  if (st.prompt && norm(p.prompt) !== norm(st.prompt)) return block('prompt diverso da quello approvato');
  st.used = true; st.at = new Date().toISOString();
  fs.writeFileSync(stateFile, JSON.stringify(st));
  process.exit(0);
});
