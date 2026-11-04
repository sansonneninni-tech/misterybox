// Controllo rapido: sintassi di tutti i file, import che si risolvono,
// e qualche verifica sulle parti pure del motore (formati, movimento, QR).
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== 'node_modules' && f !== 'dati') walk(p); } else if (/\.(m?js)$/.test(f)) files.push(p); });
walk(join(root, 'web')); walk(join(root, 'server')); walk(join(root, 'tools'));

let bad = 0;
const fail = (m) => { bad++; console.error('✗ ' + m); };
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { fail(`${f.slice(root.length + 1)}\n${e.stderr}`); continue; }
  // import relativi: il file deve esistere e i nomi importati devono essere esportati
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*'(\.[^']+)'/g)) {
    const target = resolve(dirname(f), m[2]);
    let tsrc;
    try { tsrc = readFileSync(target, 'utf8'); } catch { fail(`${f.slice(root.length + 1)}: manca ${m[2]}`); continue; }
    for (const name of m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
      const re = new RegExp(`export\\s+(async\\s+)?(function\\*?|const|let|class|var)\\s+${name}\\b|export\\s*\\{[^}]*\\b${name}\\b`);
      if (!re.test(tsrc)) fail(`${f.slice(root.length + 1)}: '${name}' non è esportato da ${m[2]}`);
    }
  }
}

const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { dims, defaultClip, normalizeClip, ASPECTS } = await imp('web/engine/clip.js');
for (const a of Object.keys(ASPECTS)) {
  const { w, h } = dims(a, 3840);
  if (w % 2 || h % 2 || Math.max(w, h) !== 3840) fail(`dims ${a} → ${w}×${h}`);
}
const c = normalizeClip(defaultClip());
if (!c.format || !c.motion || !Array.isArray(c.chain)) fail('defaultClip incompleta');
const { keyValue } = await imp('web/engine/motion.js');
if (Math.abs(keyValue([[0, 0], [1, 10]], 0.5) - 5) > 1e-6) fail('keyValue non interpola');
const { qrMatrix } = await imp('web/ui/qr.js');
const q = qrMatrix('http://192.168.1.20:5174/?k=abcdef0123456789');
if (!q || q.length < 21) fail('qrMatrix');

console.log(bad ? `\n${bad} problemi` : `✓ ${files.length} file controllati, motore e QR a posto`);
process.exit(bad ? 1 : 0);
