// 05 Esporta: render alla risoluzione piena, dal fotogramma 0, per DaVinci.
// Ogni render è legato a una versione dell'albero e scrive un .json accanto.

import { S, saveVersion, versionsOf, versionById, expById, auxRenderer, auxSources, addRender } from '../state.js';
import { h, fill, toast, seg, fmtBytes, isPhone, ago, confirmDialog, dialog } from './kit.js';
import { dims, LONG_SIDES, normalizeClip, clone } from '../engine/clip.js';
import { byId } from '../engine/processes.js';
import { renderToServer, renderToZip, renderToWebM, renderToPreview, estimate, needsNote } from '../engine/export.js';
import { qrSvg } from './qr.js';

let codec = null;
let long = 3840;
let running = null;     // { abort, label }
let station = false;
let stationTimer = 0;

export function render(root, { app }) {
  const server = S.store.mode === 'server';
  // pagina di prova pubblicata: il browser non lascia scaricare file
  const demo = !server && window.MOVIOLA_DEMO === 'artifact';
  const info = S.info || {};
  // la prova nel browser si guarda, non si consegna: basta il 1280
  if (demo && long > 1920 && !render.demoLong) { long = 1280; render.demoLong = true; }
  const codecs = server
    ? Object.entries(info.codecs || {}).map(([id, c]) => ({ id, ...c }))
    : [
      { id: 'zip', label: 'Sequenza PNG 16 bit (.zip)', bits: 16, available: true, note: 'senza perdita, calcolata nel browser; lenta ma esatta' },
      { id: 'webm', label: 'WebM (prova)', bits: 8, available: !!window.MediaRecorder, note: 'in tempo reale, compresso: solo per guardare' },
    ];
  if (demo) codecs.splice(0, codecs.length, { id: 'prova', label: 'Prova del render', bits: 8, available: true, note: 'ogni fotogramma calcolato alla risoluzione scelta e rivisto qui a tempo esatto' });
  if (!codec || !codecs.some((c) => c.id === codec && c.available)) codec = codecs.find((c) => c.available)?.id;

  const left = h('div.form-col');
  const right = h('div.form-col');
  root.append(h('div.exp-grid', null, h('div', null, h('div.pane__head', null, h('h1.title', null, 'Esporta'), h('span.meta', null, server ? `verso ${info.outDir}` : 'pagina demo nel browser')), left), h('div', null, right)));

  const exp = expById(S.expId);
  let vId = S.versionId;

  function drawLeft() {
    if (!exp || !S.work) {
      fill(left, h('p.about', null, 'Apri un esperimento per esportarlo.'), h('button.btn', { onclick: () => app.go('archivio') }, 'Archivio'));
      return;
    }
    const vs = versionsOf(exp.id).slice().reverse();
    const v = versionById(vId);
    const useWork = vId === S.versionId && S.dirty;
    const clip = useWork ? S.work : v?.clip;
    const fps = clip.format.fps;
    const frames = Math.round(clip.format.duration * fps);
    const { w, h: hh } = dims(clip.format.aspect, long);
    const est = estimate(codec, w, hh, fps, frames);
    const c = codecs.find((x) => x.id === codec);
    const notes = needsNote(clip);
    if (demo) notes.push('Questa è la pagina di prova: qui il browser non permette di salvare file. Sul Mac, con npm start, la stessa clip esce in ProRes 422 HQ o PNG 16 bit direttamente nella cartella Filmati.');
    else if (!server) notes.push('Nella pagina demo il render avviene in questo browser. Sul Mac, con il server, si esporta in ProRes direttamente nella cartella Filmati.');
    if (isPhone() && server) notes.push('Dal telefono il render 4K è lento e consuma batteria: meglio mandarlo al Mac (serve una finestra di MOVIOLA aperta sul Mac come stazione).');
    if (w * hh > 3840 * 2160 * 0.6 && isPhone()) notes.push('Sull’iPhone la memoria può non bastare per il 4K: prova 1920.');

    const verSel = h('select.field', { onchange: (e) => { vId = e.target.value; drawLeft(); } },
      vs.map((x) => h('option', { value: x.id, selected: x.id === vId }, `${x.label} · ${x.status}${x.marked ? ' · segnata' : ''}${x.id === S.versionId ? ' · aperta nel banco' : ''}${x.note ? ' · ' + x.note.slice(0, 40) : ''}`)));
    const progress = h('div.bigbar', null, h('i'));
    const progTxt = h('span.meta');
    const go = h('button.btn.btn--lg.btn--solid', { disabled: !!running || !c?.available, onclick: () => start(clip, useWork, v, progress, progTxt) }, running ? 'Render in corso…' : 'Renderizza');
    fill(left, 
      h('div.stack', null, h('span.label', null, 'Versione'), verSel,
        useWork ? h('p.warn-line', null, 'La clip aperta ha modifiche non salvate: prima del render diventano una versione nuova, così il file resta legato alla sua ricetta.') : null),
      h('div.stack', null, h('span.label', null, 'Formato del file'),
        h('div.choice', null, codecs.map((x) => h('label.choice__opt', { style: x.available ? null : { opacity: 0.45 } },
          h('input', { type: 'radio', name: 'codec', checked: x.id === codec, disabled: !x.available, onchange: () => { codec = x.id; drawLeft(); } }),
          h('span.stack', { style: { gap: '2px' } }, h('span', null, x.label), h('span.meta', null, x.available ? x.note : 'non disponibile con questo ffmpeg')),
          h('span.meta', null, x.bits + ' bit'))))),
      h('div.stack', null, h('span.label', null, 'Risoluzione (lato lungo)'),
        seg(LONG_SIDES.map((l) => ({ id: l, label: String(l) })), long, (val) => { long = val; drawLeft(); }, { label: 'Risoluzione' })),
      h('div.facts', null,
        h('div', null, h('span.label', null, 'Quadro'), h('span.facts__v', null, `${w}×${hh}`), h('span.meta', null, clip.format.aspect)),
        h('div', null, h('span.label', null, 'Fotogrammi'), h('span.facts__v', null, String(frames)), h('span.meta', null, `${clip.format.duration} s a ${fps} fps`)),
        h('div', null, h('span.label', null, 'Peso stimato'), h('span.facts__v', null, '~' + fmtBytes(est)), h('span.meta', null, c?.label || ''))),
      notes.map((n) => h('p.warn-line', null, n)),
      h('div.stack', null, progress, progTxt),
      h('div.row', null, go,
        running ? h('button.btn', { onclick: () => running.abort() }, 'Annulla') : null,
        isPhone() && server ? h('button.btn', { disabled: !!running, onclick: () => queue(clip, useWork, v) }, 'Manda al Mac') : null),
      h('details', null, h('summary.label', { style: { cursor: 'pointer' } }, 'Cosa c’è nel .json accanto al file'),
        h('pre.json', null, JSON.stringify(metaFor(clip, v), null, 2))),
    );
  }

  function metaFor(clip, v) {
    return {
      nome: exp?.name, versione: v ? { id: v.id, etichetta: v.label, stato: v.status, nota: v.note } : null,
      esperimento: exp?.id, ipotesi: exp?.idea || undefined,
      seme: clip.seed, movimento: clip.motion, loop: clip.format.loop,
      catena: clip.chain.map((p) => ({ processo: byId[p.proc]?.name, codice: byId[p.proc]?.code, acceso: p.on, fusione: p.blend, quantita: p.mix, parametri: p.params })),
      chiavi: clip.keys,
      sorgenti: clip.sources.map((s) => { const r = S.sources.find((x) => x.id === s.id); return r ? { nome: r.name, tipo: r.kind, provenienza: r.origin, diritti: r.rights, velocita: s.speed, inizio: s.start } : { id: s.id, mancante: true }; }),
      ricetta: clip,
    };
  }

  async function start(clip0, useWork, v, progress, progTxt) {
    let ver = v;
    if (useWork) ver = await saveVersion('Prima del render', 'ninni');
    const clip = normalizeClip(clone(ver.clip));
    await runRender({ clip, ver, progress, progTxt });
  }

  async function runRender({ clip, ver, progress, progTxt, fromQueue }) {
    const ctrl = new AbortController();
    running = { abort: () => ctrl.abort() };
    drawLeft();
    const name = `${exp?.name || 'moviola'}_${ver.label}`;
    const r = auxRenderer();
    const items = await auxSources(clip);
    const onProgress = (i, n, eta) => {
      progress.style.setProperty('--p', (i / n) * 100 + '%');
      progTxt.textContent = `${i}/${n} fotogrammi · mancano ${eta > 90 ? Math.round(eta / 60) + ' min' : Math.round(eta) + ' s'}`;
      app.status(`render ${Math.round((i / n) * 100)}%`);
    };
    const t0 = performance.now();
    try {
      const opts = { renderer: r, items, clip, long, codec, name, meta: metaFor(clip, ver), onProgress, signal: ctrl.signal };
      if (server) {
        const rec = await renderToServer(opts);
        rec.thumb = ver.thumb;
        await addRender(rec);
        toast(`Pronto in ${Math.round((performance.now() - t0) / 1000)} s: ${rec.file.split('/').pop()}`, info.platform === 'darwin' && !isPhone() ? { label: 'Mostra nel Finder', run: () => reveal(rec.file) } : null);
      } else {
        if (demo) { showPreview(await renderToPreview(opts), name); return; }
        const blob = codec === 'zip' ? await renderToZip(opts) : await renderToWebM(opts);
        const a = h('a', { href: URL.createObjectURL(blob), download: `${name}.${codec === 'zip' ? 'zip' : blob.type.includes('mp4') ? 'mp4' : 'webm'}` });
        document.body.append(a); a.click(); a.remove();
        await addRender({ id: 'r' + Date.now(), created: Date.now(), file: a.download, codec, w: r.w, h: r.h, fps: clip.format.fps, frames: Math.round(clip.format.duration * clip.format.fps), versionId: ver.id, name, thumb: ver.thumb });
        toast('Scaricato: ' + a.download);
      }
      if (fromQueue) return true;
    } catch (e) {
      if (e.name === 'AbortError') toast('Render annullato');
      else { console.error(e); toast('Render non riuscito: ' + e.message); }
      if (fromQueue) throw e;
    } finally {
      running = null;
      app.status();
      if (app.route === 'esporta') { drawLeft(); drawRight(); }
    }
  }

  function showPreview({ frames, fps, w, h: hh }, name) {
    const cv = h('canvas', { width: w, height: hh, style: { width: '100%', height: 'auto', display: 'block', background: '#000', cursor: 'pointer' } });
    const g = cv.getContext('2d');
    const info = h('span.meta');
    let raf = 0, paused = false, shown = -1, busy = false, t0 = performance.now(), at = 0;
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (!paused) at = (now - t0) / 1000;
      const i = Math.floor(at * fps) % frames.length;
      if (i === shown || busy) return;
      busy = true;
      createImageBitmap(frames[i]).then((bm) => { g.drawImage(bm, 0, 0); bm.close?.(); shown = i; info.textContent = `${i + 1}/${frames.length} · ${fps} fps · ${w}×${hh} · tocca per fermare`; }).catch(() => {}).finally(() => { busy = false; });
    };
    cv.addEventListener('click', () => { paused = !paused; if (!paused) t0 = performance.now() - at * 1000; });
    raf = requestAnimationFrame(tick);
    dialog({ title: `${name} · prova del render`, wide: true, body: h('div.stack', null, cv, info), onClose: () => { cancelAnimationFrame(raf); frames.length = 0; } });
  }

  async function queue(clip0, useWork, v) {
    let ver = v;
    if (useWork) ver = await saveVersion('Prima del render', 'ninni');
    const r = await fetch('/api/queue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ versionId: ver.id, expId: exp.id, long, codec, label: `${exp.name} ${ver.label}` }) });
    if (r.ok) toast('Mandato al Mac: parte appena una finestra di MOVIOLA sul Mac fa da stazione di render.');
    else toast('Non riesco a mandarlo al Mac');
  }

  async function reveal(file) {
    const r = await fetch('/api/reveal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ file }) });
    if (!r.ok) toast('Apri a mano: ' + file);
  }

  // stazione di render: questa finestra esegue i render chiesti dall'iPhone
  async function poll() {
    if (!station || running) return;
    try {
      const job = await (await fetch('/api/queue/claim', { method: 'POST' })).json();
      if (job) {
        const ver = versionById(job.versionId) || (await S.store.list('versions')).find((x) => x.id === job.versionId);
        if (!ver) throw new Error('versione non trovata');
        if (!S.versions.includes(ver)) S.versions.push(ver);
        const pc = codec, pl = long;
        codec = job.codec; long = job.long;
        const progress = h('div.bigbar', null, h('i')), progTxt = h('span.meta');
        toast(`Render dall’iPhone: ${job.label}`);
        try { await runRender({ clip: normalizeClip(clone(ver.clip)), ver, progress, progTxt, fromQueue: true }); await fetch(`/api/queue/${job.id}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'finito' }) }); }
        catch (e) { await fetch(`/api/queue/${job.id}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'errore', error: e.message }) }); }
        codec = pc; long = pl;
      }
    } catch (e) { console.warn(e); }
  }

  function drawRight() {
    const lan = info.lan || [];
    fill(right, 
      server && !isPhone() ? h('div.stack', null,
        h('span.label', null, 'Sull’iPhone'),
        lan.length ? h('div.row', { style: { alignItems: 'flex-start', gap: 'var(--s-5)' } },
          h('div.qr', { html: qrSvg(lan[0]), title: lan[0] }),
          h('div.stack', { style: { maxWidth: '300px' } },
            h('p.about', null, 'Inquadra il codice con la fotocamera dell’iPhone, sulla stessa rete Wi-Fi del Mac. La chiave nell’indirizzo protegge l’accesso. Poi in Safari: Condividi → Aggiungi alla schermata Home.'),
            h('span.meta', { style: { wordBreak: 'break-all' } }, lan[0]))) : h('p.about', null, 'Il Mac non è collegato a una rete locale.'),
      ) : null,
      server && !isPhone() ? h('div.stack', null,
        h('span.label', null, 'Stazione di render'),
        h('label.check', null, h('input', { type: 'checkbox', checked: station, onchange: (e) => { station = e.target.checked; clearInterval(stationTimer); if (station) { stationTimer = setInterval(poll, 4000); poll(); } } }),
          h('span', null, 'Questa finestra esegue i render mandati dall’iPhone. Lasciala aperta.'))) : null,
      h('div.stack', null, h('span.label', null, `Render fatti · ${S.renders.length}`)),
      S.renders.length ? h('div', { style: { margin: '0 calc(-1 * var(--s-4))', borderTop: 'var(--hair) solid var(--seam)' } }, S.renders.slice(0, 40).map((r) => h('div.render-row', null,
        r.thumb ? h('img', { src: r.thumb, alt: '' }) : h('span'),
        h('div.stack', { style: { gap: '2px', minWidth: 0 } }, h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, r.name || r.file?.split('/').pop()),
          h('span.meta', null, `${info.codecs?.[r.codec]?.label || r.codec} · ${r.w}×${r.h} · ${r.fps} fps · ${r.frames} fot. · ${ago(r.created)}`),
          h('span.meta', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: r.file }, r.file)),
        server && info.platform === 'darwin' && !isPhone() ? h('button.btn.btn--quiet', { onclick: () => reveal(r.file) }, 'Finder') : h('span')))) : h('p.about', null, 'Ancora nessun render.'),
    );
  }

  drawLeft(); drawRight();
  return () => {};
}
