// Archivio su disco: un database JSON leggibile e le cartelle delle immagini.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.resolve(process.env.ATELIER_DATA || path.join(ROOT, 'dati'));
export const DIRS = {
  originali: path.join(DATA_DIR, 'originali'),
  varianti: path.join(DATA_DIR, 'varianti'),
  miniature: path.join(DATA_DIR, 'miniature'),
  export: path.join(DATA_DIR, 'export'),
  cestino: path.join(DATA_DIR, 'cestino'),
  temp: path.join(DATA_DIR, '.temp'),
};
const DB_FILE = path.join(DATA_DIR, 'atelier.json');

for (const d of [DATA_DIR, ...Object.values(DIRS)]) fs.mkdirSync(d, { recursive: true });

const empty = () => ({ version: 1, assets: {}, experiments: {}, settings: {} });

let db = empty();
if (fs.existsSync(DB_FILE)) {
  try { db = { ...empty(), ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; }
  catch (e) {
    // Un database illeggibile non viene mai sovrascritto: si conserva una copia.
    const bak = DB_FILE + '.illeggibile-' + Date.now();
    fs.copyFileSync(DB_FILE, bak);
    console.error(`Il database non era leggibile: copiato in ${bak}, ne inizio uno nuovo.`);
  }
}

let timer = null;
function flush() {
  timer = null;
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
export function save() {
  if (!timer) timer = setTimeout(flush, 150);
}
export function saveNow() {
  if (timer) clearTimeout(timer);
  flush();
}
process.on('exit', () => { if (timer) flush(); });

export const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
export const now = () => new Date().toISOString();
export const getDb = () => db;
