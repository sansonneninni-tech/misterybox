// Controlli puri su Ricette di materia e Deriva: niente browser, solo logica.
//   node tools/check-ricette-deriva.mjs
// Restituisce il numero di problemi (0 = tutto a posto); check.mjs lo chiama.
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(join(root, p)).href);

export async function run() {
  let bad = 0;
  const fail = (m) => { bad++; console.error('✗ ' + m); };
  const { buildClip, MAX_MATERIE } = await imp('web/engine/recipes.js');
  const { byId, PROCESSES } = await imp('web/engine/processes.js');
  const R = await imp('web/engine/ricette.js');
  const M = await imp('web/engine/mutazioni.js');
  const src = [{ id: 's1' }], two = [{ id: 's1' }, { id: 's2' }];
  const valid = (clip, what) => {
    for (const p of clip.chain) {
      const proc = byId[p.proc];
      if (!proc) { fail(`${what}: processo sconosciuto ${p.proc}`); continue; }
      for (const d of proc.params) {
        const v = p.params[d.id];
        if (!Number.isFinite(v) || v < d.min - 1e-9 || v > d.max + 1e-9) fail(`${what}: ${p.proc}.${d.id} = ${v} fuori da [${d.min}, ${d.max}]`);
      }
      if (!(p.mix >= 0 && p.mix <= 1)) fail(`${what}: quantità ${p.mix}`);
    }
    if (new Set(clip.chain.map((p) => p.id)).size !== clip.chain.length) fail(`${what}: id dei passaggi ripetuti`);
  };

  // ------------------------------------------------------------ ricette
  const base = buildClip({ style: 'emulsione', sources: src, seed: 11, materie: [{ proc: 'inchiostro' }, { proc: 'argilla', mix: 0.7 }] });
  base.intensity = 0.8;
  base.keys = { [base.chain[1].id + '.forza']: [[0, 0.02], [8, 0.2]] };
  const rec = R.ricettaFromClip(base, { name: 'Prova' });
  if (rec.ricetta.chain.some((p) => p.layer != null)) fail('ricetta: gli strati devono diventare passaggi della ricetta');
  if (!rec.ricetta.visibili.length) fail('ricetta: nessun parametro in vista proposto');
  if (rec.ricetta.visibili.length > R.MAX_VISIBILI) fail('ricetta: troppi parametri in vista');
  const clip = R.buildAny({ style: 'ricetta', ricetta: R.asClipRicetta(rec), sources: src, format: { ...base.format, duration: 16, aspect: '9:16' }, motion: rec.motion, seed: rec.seed });
  valid(clip, 'ricetta applicata');
  if (clip.chain.map((p) => p.id).join() !== rec.ricetta.chain.map((p) => p.id).join()) fail('ricetta: gli id dei passaggi devono restare (decidono il movimento)');
  const k = Object.values(clip.keys)[0];
  if (!k || Math.abs(k[1][0] - 16) > 1e-6) fail('ricetta: le chiavi non seguono la durata nuova');
  if (clip.format.aspect !== '9:16') fail('ricetta: le proporzioni devono restare quelle della clip');
  // due foto: si aggiunge la fusione; tornando a una, si toglie
  const c2 = R.buildAny({ style: 'ricetta', ricetta: R.asClipRicetta(rec), sources: two, seed: 3 });
  if (c2.chain[0].proc !== 'metamorfosi') fail('ricetta su due foto: manca la fusione delle foto');
  const rec2 = R.ricettaFromClip(c2, { name: 'Due' });
  const c1 = R.buildAny({ style: 'ricetta', ricetta: R.asClipRicetta(rec2), sources: src, seed: 3 });
  if (c1.chain[0].proc === 'metamorfosi') fail('ricetta da due foto a una: la fusione deve sparire');
  // una materia che non c'è più, un parametro sparito e uno nuovo
  const old = JSON.parse(JSON.stringify(rec));
  old.ricetta.chain.push({ id: 'zz', proc: 'materia-del-futuro', nome: 'Vetro soffiato', on: true, mix: 1, blend: 'normale', params: {} });
  const inch = old.ricetta.chain.find((p) => p.proc === 'inchiostro');
  inch.params.parametroVecchio = 3; delete inch.params[Object.keys(inch.params)[0]];
  const chk = R.checkRicetta(old);
  if (chk.ok || !chk.missing.includes('Vetro soffiato')) fail('ricetta: non dice quale materia manca');
  const c3 = R.buildAny({ style: 'ricetta', ricetta: R.asClipRicetta(old), sources: src, seed: 5 });
  valid(c3, 'ricetta con materia mancante');
  if (!c3.ricetta.mancanti.length || !c3.ricetta.avvisi.length) fail('ricetta: avvisi su parametri e materie mancanti assenti');
  // la materia mancante resta nella ricetta anche dopo un gesto
  const back = R.syncRicetta(c3);
  if (!back.chain.some((p) => p.proc === 'materia-del-futuro')) fail('ricetta: una materia mancante non deve sparire dalla ricetta');
  // strati sopra la ricetta, al massimo sei materie in tutto
  const c4 = R.buildAny({ style: 'ricetta', ricetta: R.asClipRicetta(rec), sources: src, seed: 5, materie: PROCESSES.filter((p) => p.materia).slice(0, 8).map((p) => ({ proc: p.id })) });
  if (c4.chain.filter((p) => byId[p.proc]?.materia).length > MAX_MATERIE) fail('ricetta: più di sei materie');
  // file: esporta e reimporta
  const pack = R.exportPack([rec]);
  const imp1 = R.importPack(JSON.parse(JSON.stringify(pack)), [rec]);
  if (imp1.ricette.length !== 1 || imp1.ricette[0].id === rec.id || !/importata/.test(imp1.ricette[0].name)) fail('import: una ricetta già presente deve arrivare come copia');
  let threw = false; try { R.importPack({ foo: 1 }, []); } catch { threw = true; }
  if (!threw) fail('import: un file sbagliato deve dirlo');
  const upd = R.updateFromClip(rec, c2);
  if (!upd.precedenti?.length) fail('aggiorna: la versione di prima deve restare');

  // ------------------------------------------------------------ deriva
  const mother = M.applyIntensity(base);
  const opts = { amp: 0.5, what: { parametri: true, catena: true, movimento: true, colore: true }, locks: new Set(), hasSources: true };
  const a = M.mutate(mother, opts, M.rng(42)), b = M.mutate(mother, opts, M.rng(42));
  if (JSON.stringify(a) !== JSON.stringify(b)) fail('deriva: stesso seme, mutazioni diverse');
  let changed = 0;
  for (let i = 0; i < 40; i++) {
    for (const amp of [0, 0.35, 1]) {
      const r = M.mutate(mother, { ...opts, amp }, M.rng(1000 + i));
      const c = M.toClip(r.genome, mother);
      valid(c, `mutazione ${i} ampiezza ${amp}`);
      if (JSON.stringify(c.chain.map((p) => p.params)) !== JSON.stringify(mother.chain.map((p) => p.params))) changed++;
      // pellicola e luce solo in giù
      const gr0 = mother.chain.find((p) => p.proc === 'materia'), gr1 = c.chain.find((p) => p.id === gr0.id);
      if (gr1) for (const id in gr0.params) if (gr1.params[id] > gr0.params[id] + 1e-9) fail(`deriva: ${id} della grana è salito`);
    }
  }
  if (changed < 60) fail(`deriva: troppe mutazioni identiche alla madre (${120 - changed} su 120)`);
  // blocchi: una materia ferma non cambia
  const lockKey = 'p:' + mother.chain.find((p) => p.proc === 'rifrazione').id;
  for (let i = 0; i < 20; i++) {
    const r = M.mutate(mother, { ...opts, amp: 1, locks: new Set([lockKey, 'm:inchiostro']) }, M.rng(7 + i));
    const rf = r.genome.base.find((p) => 'p:' + p.id === lockKey);
    const rf0 = mother.chain.find((p) => 'p:' + p.id === lockKey);
    if (!rf || JSON.stringify(rf.params) !== JSON.stringify(rf0.params)) { fail('deriva: un passaggio bloccato è cambiato o sparito'); break; }
    const ink = r.genome.layers.find((m) => m.proc === 'inchiostro');
    const ink0 = M.toGenome(mother).layers.find((m) => m.proc === 'inchiostro');
    if (!ink || JSON.stringify(ink.params) !== JSON.stringify(ink0.params)) { fail('deriva: una materia bloccata è cambiata o sparita'); break; }
  }
  // solo il colore
  for (let i = 0; i < 10; i++) {
    const r = M.mutate(mother, { ...opts, amp: 1, what: { colore: true } }, M.rng(300 + i));
    const g0 = M.toGenome(mother);
    if (JSON.stringify(r.genome.motion) !== JSON.stringify(g0.motion)) { fail('deriva: con solo «colore» il movimento è cambiato'); break; }
    if (r.genome.base.length !== g0.base.length || r.genome.layers.length !== g0.layers.length) { fail('deriva: con solo «colore» la catena è cambiata'); break; }
  }
  // incrocio
  const other = M.applyIntensity(buildClip({ style: 'sovrimpressioni', sources: src, seed: 9, materie: [{ proc: 'mercurio' }] }));
  for (let i = 0; i < 10; i++) valid(M.toClip(M.cross(mother, other, M.rng(i)).genome, mother), 'incrocio ' + i);
  // una materia nuova nel registro entra da sola
  const names = new Set(M.materieDelRegistro().map((m) => m.id));
  for (const p of PROCESSES.filter((x) => x.materia)) if (!names.has(p.id)) fail('deriva: materia del registro ignorata ' + p.id);
  return bad;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bad = await run();
  console.log(bad ? `\n${bad} problemi` : '✓ ricette e deriva a posto');
  process.exit(bad ? 1 : 0);
}
