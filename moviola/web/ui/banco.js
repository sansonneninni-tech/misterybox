// 02 Banco: dove si costruisce una clip. Anteprima, catena dei processi,
// parametri con le chiavi, timeline, formato e carattere del movimento.

import { S, touch, saveVersion, clipSources, sourceById, expById } from '../state.js';
import { h, fill, dialog, toast, seg, fmtTime, fmtNum, isPhone } from './kit.js';
import { PROCESSES, FAMILIES, BLENDS, byId, defaultParams } from '../engine/processes.js';
import { ASPECTS, MOTION_MODES, newSeed, dims, uid } from '../engine/clip.js';
import { keyValue } from '../engine/motion.js';
import { mainPlayer, syncPlayer } from '../app.js';
import { openProvino } from './provino.js';
import { pref } from '../prefs.js';

const ICON = {
  play: '<svg viewBox="0 0 14 14"><path d="M3 1.5v11l9-5.5z"/></svg>',
  pause: '<svg viewBox="0 0 14 14"><path d="M3 2h3v10H3zM8 2h3v10H8z"/></svg>',
  start: '<svg viewBox="0 0 14 14"><path d="M2 2h2v10H2zM5 7l7-5v10z"/></svg>',
  prev: '<svg viewBox="0 0 14 14"><path d="M9 2v10L3 7z"/></svg>',
  next: '<svg viewBox="0 0 14 14"><path d="M5 2v10l6-5z"/></svg>',
  key: '<svg viewBox="0 0 10 10"><path d="M5 0l5 5-5 5-5-5z" fill="currentColor"/></svg>',
  keyOff: '<svg viewBox="0 0 10 10"><path d="M5 .7L9.3 5 5 9.3.7 5z" fill="none" stroke="currentColor"/></svg>',
};
const icon = (n) => { const s = h('span'); s.innerHTML = ICON[n]; return s.firstChild; };

let sel = null; // id del passaggio selezionato
const typing = (e) => !!e.target.closest('textarea, select, [contenteditable], input:not([type=range]):not([type=checkbox]):not([type=radio])');

export function render(root, { app }) {
  if (!S.work) {
    root.append(h('div.state', null, h('div.state__box', null,
      h('div.state__glyph', null, '00'),
      h('p.prose', null, 'Nessun esperimento aperto. Parti da zero, da un’immagine o da un video: si comincia dall’archivio.'),
      h('button.btn.btn--lg', { onclick: () => app.go('archivio') }, 'Apri l’archivio'))));
    return;
  }
  const clip = S.work;
  if (!clip.chain.some((p) => p.id === sel)) sel = clip.chain[clip.chain.length - 1]?.id || null;
  const player = mainPlayer();

  const el = {
    head: h('div.banco__head'),
    chain: h('div.banco__chain'),
    stage: h('div.banco__stage'),
    time: h('div.banco__time'),
    params: h('div.banco__params'),
  };
  root.append(h('div.banco', null, el.head, el.chain, el.stage, el.time, el.params));

  // ------------------------------------------------------------- modifiche
  let redrawT = 0;
  const changed = (parts = []) => {
    touch('clip');
    if (parts.includes('chain')) drawChain();
    if (parts.includes('params')) drawParams();
    if (parts.includes('time')) drawTimeline();
    if (parts.includes('head')) drawHead();
    if (parts.includes('sources')) { drawChain(); syncPlayer().then(() => player.seek(player.frame)); return; }
    if (parts.includes('format')) { syncPlayer().then(() => player.seek(Math.min(player.frame, player.total - 1))); drawTimeline(); return; }
    if (!player.playing) {
      cancelAnimationFrame(redrawT);
      redrawT = requestAnimationFrame(() => (player.needsHistory() && parts.includes('structure') ? player.seek(player.frame) : player.draw()));
    }
    saveBtn.dataset.dirty = 'true';
  };

  // --------------------------------------------------------------- testa
  const saveBtn = h('button.btn', { onclick: () => askSave(), title: 'Salva una versione nuova (S)' }, 'Salva versione', h('span.btn__key', null, 'S'));
  function drawHead() {
    const f = clip.format, m = clip.motion;
    const aspectSel = h('select.field', { 'aria-label': 'Proporzione', onchange: (e) => { f.aspect = e.target.value; changed(['format']); } },
      Object.keys(ASPECTS).map((a) => h('option', { value: a, selected: a === f.aspect }, a)));
    const dur = h('input.num-in', { type: 'number', min: 1, max: 30, step: 0.5, value: f.duration, 'aria-label': 'Durata in secondi', onchange: (e) => { f.duration = Math.min(30, Math.max(1, Number(e.target.value) || 1)); e.target.value = f.duration; changed(['format']); } });
    const fps = seg([{ id: 24, label: '24' }, { id: 30, label: '30' }], f.fps, (v) => { f.fps = v; changed(['format']); }, { label: 'Fotogrammi al secondo' });
    const loop = h('button.tag', { 'aria-pressed': String(!!f.loop), title: 'Il rumore si chiude: l’ultimo fotogramma torna al primo', onclick: (e) => { f.loop = !f.loop; e.currentTarget.setAttribute('aria-pressed', String(f.loop)); changed(['params']); } }, 'Loop chiuso');
    const mode = seg(MOTION_MODES, m.mode, (v) => { m.mode = v; drawHead(); changed([]); }, { label: 'Carattere del movimento' });
    const amount = h('input.range', { type: 'range', min: 0, max: 1, step: 0.01, value: m.amount, style: { width: '90px' }, 'aria-label': 'Intensità del movimento', oninput: (e) => { m.amount = Number(e.target.value); changed([]); } });
    const bpm = h('input.num-in', { type: 'number', min: 20, max: 300, step: 1, value: m.bpm, 'aria-label': 'Tempo in BPM', onchange: (e) => { m.bpm = Math.min(300, Math.max(20, Number(e.target.value) || 96)); changed([]); } });
    const div = h('select.field', { 'aria-label': 'Suddivisione', onchange: (e) => { m.division = Number(e.target.value); changed([]); } },
      [[0.25, '1/4'], [0.5, '1/2'], [1, '1'], [2, '×2'], [4, '×4']].map(([v, l]) => h('option', { value: v, selected: v === m.division }, l)));
    const speed = h('input.range', { type: 'range', min: 0.1, max: 3, step: 0.05, value: m.speed, style: { width: '80px' }, 'aria-label': 'Velocità del movimento', oninput: (e) => { m.speed = Number(e.target.value); changed([]); } });
    const { w, h: hh } = dims(f.aspect, 3840);
    fill(el.head, 
      h('div.row', null, h('span.label', null, 'Formato'), aspectSel, dur, h('span.meta', null, 's'), fps, h('span.meta', null, 'fps'), loop, h('span.meta.only-desk', null, `${w}×${hh}`)),
      h('div.row', null, h('span.label', null, 'Movimento'), mode,
        m.mode !== 'fermo' ? [h('span.meta', null, 'intensità'), amount] : null,
        m.mode === 'ritmico' ? [bpm, h('span.meta', null, 'bpm'), div] : null,
        m.mode !== 'fermo' && m.mode !== 'ritmico' ? [h('span.meta', null, 'velocità'), speed] : null),
      h('div.row', { style: { marginLeft: 'auto' } },
        h('button.btn', { title: 'Sei variazioni in movimento, da segnare', onclick: () => { player.pause(); openProvino({ onOpen: () => app.go('banco') }); } }, 'Provino ×6'),
        h('button.btn.btn--quiet', { title: 'Nuovo seme: stessa ricetta, altri caso e forme', onclick: () => { clip.seed = newSeed(); changed(['head', 'structure']); } }, 'Seme ', h('span.mono', null, String(clip.seed))),
        saveBtn),
    );
    saveBtn.dataset.dirty = String(S.dirty);
    saveBtn.className = 'btn' + (S.dirty ? ' btn--solid' : '');
  }

  function askSave() {
    const note = h('textarea.field', { placeholder: 'Cosa hai cambiato, o perché (facoltativo)', rows: 3 });
    const d = dialog({
      title: 'Salva una versione nuova',
      body: h('div.stack', null, h('p.about', null, 'La versione nuova nasce dalla corrente: niente viene sovrascritto, puoi sempre tornare indietro o ramificare dal Laboratorio.'), note),
      foot: [h('span.spacer'), h('button.btn', { onclick: () => d.close() }, 'Annulla'), h('button.btn.btn--solid', { onclick: async () => { d.close(); const v = await saveVersion(note.value.trim()); toast(`Salvata ${v.label}`); drawHead(); } }, 'Salva')],
    });
    note.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) d.el.querySelector('.btn--solid').click(); });
  }

  // ------------------------------------------------------------- catena
  function drawChain() {
    const list = h('ul.chain', { 'aria-label': 'Catena dei processi, dall’alto in basso' });
    clip.chain.forEach((p, i) => {
      const proc = byId[p.proc];
      const item = h('li.pass', {
        'aria-current': String(p.id === sel), 'data-on': String(p.on), tabindex: 0,
        onclick: (e) => { if (e.target.closest('button')) return; sel = p.id; drawChain(); drawParams(); },
        onkeydown: (e) => { if (e.key === 'Enter') { sel = p.id; drawChain(); drawParams(); } },
      },
        h('span.pass__code', null, proc.code),
        h('span.pass__txt', null, h('span.pass__name', null, proc.name), h('span.meta', null, `${String(i + 1).padStart(2, '0')} · ${BLENDS.find((b) => b.id === p.blend)?.label.toLowerCase()}${p.mix < 1 ? ' ' + Math.round(p.mix * 100) + '%' : ''}`)),
        h('span.pass__acts', null,
          h('button.btn.btn--quiet', { title: 'Sposta su', 'aria-label': 'Sposta su', disabled: i === 0, onclick: () => { move(i, -1); } }, '↑'),
          h('button.btn.btn--quiet', { title: 'Sposta giù', 'aria-label': 'Sposta giù', disabled: i === clip.chain.length - 1, onclick: () => { move(i, 1); } }, '↓'),
          h('button.btn.btn--quiet', { title: p.on ? 'Spegni' : 'Accendi', 'aria-label': p.on ? 'Spegni' : 'Accendi', onclick: () => { p.on = !p.on; changed(['chain', 'structure']); } }, p.on ? '●' : '○')),
      );
      list.append(item);
    });
    const srcs = clipSources(clip);
    fill(el.chain, 
      h('div.sect', null, h('div.sect__head', null, h('span.label', null, 'Catena'), h('button.btn', { onclick: pickProcess }, '+ Processo'))),
      h('div.flow-arrow', null, clip.sources.length ? `↓ dalla sorgente 1` : '↓ dal nero'),
      h('div.scroll', null, list, clip.chain.length ? h('div.flow-arrow', null, '↓ uscita') : h('div.sect', null, h('p.about', null, 'La catena è vuota: il quadro è nero o mostra solo la prima sorgente. Aggiungi un processo.'))),
      h('div.sect', null,
        h('div.sect__head', null, h('span.label', null, 'Sorgenti'), h('span.meta', null, `${clip.sources.length}/4`)),
        h('div.srcs', null,
          clip.sources.map((cs, i) => {
            const rec = sourceById(cs.id);
            return h('button.src', { title: rec?.name || 'sorgente mancante', onclick: () => editSource(i) },
              rec?.thumb ? h('img', { src: rec.thumb, alt: '' }) : null, h('span.src__n', null, String(i + 1)), rec?.kind === 'video' ? h('span.src__k', null, `×${cs.speed}`) : null);
          }),
          clip.sources.length < 4 ? h('button.src.src--add', { title: 'Aggiungi una sorgente dall’archivio', 'aria-label': 'Aggiungi sorgente', onclick: addSource }, '+') : null),
        srcs.length < clip.sources.length ? h('p.warn-line', null, 'Una sorgente non è più nell’archivio.') : null,
      ),
    );
  }

  function move(i, d) {
    const j = i + d;
    [clip.chain[i], clip.chain[j]] = [clip.chain[j], clip.chain[i]];
    changed(['chain', 'structure']);
  }

  function pickProcess() {
    let d;
    const body = h('div', null, FAMILIES.map((fam) => {
      const ps = PROCESSES.filter((p) => p.family === fam.id);
      return [h('div.fam.label', null, fam.label), h('div.picker', null, ps.map((p) => h('button.pick', {
        onclick: () => {
          const pass = { id: uid('p'), proc: p.id, on: true, mix: 1, blend: p.blend || 'normale', params: defaultParams(p.id) };
          const at = clip.chain.findIndex((x) => x.id === sel);
          clip.chain.splice(at < 0 ? clip.chain.length : at + 1, 0, pass);
          sel = pass.id;
          d.close();
          changed(['chain', 'params', 'structure']);
        },
      }, h('span.code', null, p.code), h('span.pick__name', null, p.name), h('span.pick__about', null, p.about),
        h('span.meta', null, [p.gen ? 'genera' : 'trasforma', p.feedback ? 'retroazione' : null, p.history ? 'memoria' : null].filter(Boolean).join(' · ')))))];
    }));
    d = dialog({ title: 'Aggiungi un processo dopo quello selezionato', body, wide: true });
  }

  function addSource() {
    let d;
    if (!S.sources.length) { toast('L’archivio delle sorgenti è vuoto: importa immagini o video dall’Archivio.', { label: 'Vai', run: () => app.go('archivio') }); return; }
    const grid = h('div.sheet--src', { style: { '--cols': isPhone() ? 3 : 5, '--row': '120px' } }, S.sources.map((s) => h('button.tile', {
      onclick: () => { clip.sources.push({ id: s.id, speed: 1, start: 0 }); d.close(); changed(['sources']); },
    }, h('div.tile__img', null, h('img', { src: s.thumb, alt: '' })), h('div.tile__rebate', null, h('b', null, s.kind === 'video' ? 'VID' : 'IMG'), h('span', null, s.name?.slice(0, 18))))));
    d = dialog({ title: 'Scegli una sorgente', body: grid, wide: true });
  }

  function editSource(i) {
    const cs = clip.sources[i];
    const rec = sourceById(cs.id);
    let d;
    const speed = h('input.num-in', { type: 'number', step: 0.05, min: -4, max: 4, value: cs.speed });
    const start = h('input.num-in', { type: 'number', step: 0.1, min: 0, value: cs.start });
    d = dialog({
      title: `Sorgente ${i + 1}`,
      body: h('div.stack', null,
        rec?.thumb ? h('img', { src: rec.thumb, alt: '', style: { maxHeight: '220px', objectFit: 'contain', alignSelf: 'flex-start' } }) : null,
        h('p.meta', null, rec ? `${rec.name} · ${rec.w}×${rec.h}${rec.kind === 'video' ? ` · ${rec.duration?.toFixed(1)} s` : ''}` : 'sorgente non trovata'),
        rec?.kind === 'video' ? h('div.row', null, h('span.label', null, 'Velocità'), speed, h('span.label', null, 'Inizio (s)'), start) : h('p.about', null, 'Un’immagine ferma: il movimento lo danno i processi.'),
        h('p.about', null, 'La sorgente 1 entra nella catena come primo fotogramma del flusso. Le altre si usano con i processi Sorgente e Metamorfosi.')),
      foot: [
        h('button.btn.btn--quiet', { onclick: () => { clip.sources.splice(i, 1); d.close(); changed(['sources']); } }, 'Togli dalla clip'),
        i > 0 ? h('button.btn.btn--quiet', { onclick: () => { const [x] = clip.sources.splice(i, 1); clip.sources.unshift(x); d.close(); changed(['sources']); } }, 'Metti come prima') : null,
        h('span.spacer'),
        h('button.btn.btn--solid', { onclick: () => { cs.speed = Number(speed.value) || 1; cs.start = Math.max(0, Number(start.value) || 0); d.close(); changed(['sources']); } }, 'Applica'),
      ],
    });
  }

  // ----------------------------------------------------------- parametri
  const keyAt = (track, t) => track?.findIndex((k) => Math.abs(k[0] - t) < 0.5 / clip.format.fps) ?? -1;

  function drawParams() {
    const p = clip.chain.find((x) => x.id === sel);
    if (!p) { fill(el.params, h('div.sect', null, h('span.label', null, 'Parametri'), h('p.about', null, 'Seleziona un processo nella catena.'))); return; }
    const proc = byId[p.proc];
    const t = player.t;
    const warns = [];
    if (proc.noloop && clip.format.loop) warns.push('Questo processo ricorda i fotogrammi passati: il loop non si chiude in modo esatto.');
    if (proc.id === 'metamorfosi' && clip.sources.length < 2) warns.push('Con meno di due sorgenti la metamorfosi avviene tra la sorgente e il flusso.');
    if (proc.id === 'sorgente' && !clip.sources.length) warns.push('La clip non ha sorgenti: aggiungine una a sinistra.');
    if ((proc.id === 'fessura' || proc.id === 'datamosh') && !clip.sources.some((s) => sourceById(s.id)?.kind === 'video') && !clip.chain.slice(0, clip.chain.indexOf(p)).some((x) => byId[x.proc].gen))
      warns.push('Lavora sul movimento: dà il meglio con un video o dopo un processo che si muove.');
    const showMod = clip.motion.mode !== 'fermo';
    const rows = proc.params.map((d) => {
      const key = `${p.id}.${d.id}`;
      const track = clip.keys[key];
      const cur = track?.length ? keyValue(track, t) : (p.params[d.id] ?? d.def);
      const ki = keyAt(track, t);
      const val = h('span.prm__val', null, fmtNum(cur, d));
      const setVal = (v) => {
        if (track?.length) {
          const k = keyAt(clip.keys[key], player.t);
          if (k >= 0) clip.keys[key][k][1] = v;
          else { clip.keys[key].push([player.t, v]); clip.keys[key].sort((a, b) => a[0] - b[0]); }
          drawTimeline();
        } else p.params[d.id] = v;
        val.textContent = fmtNum(v, d);
        changed([]);
      };
      let control;
      if (d.options) {
        control = h('div.opt-row', null, d.options.map((o, oi) => h('button.tag', { 'aria-pressed': String(Math.round(cur) === oi), onclick: () => { setVal(oi); drawParams(); } }, o)));
      } else {
        control = h('input.range', { type: 'range', min: d.min, max: d.max, step: d.step || (d.max - d.min) / 400, value: cur, 'aria-label': d.label, oninput: (e) => setVal(Number(e.target.value)) });
      }
      const kbtn = h('button.key', {
        'data-state': ki >= 0 ? 'here' : track?.length ? 'has' : 'none',
        title: ki >= 0 ? 'Togli la chiave in questo istante' : 'Metti una chiave in questo istante',
        'aria-label': 'Chiave per ' + d.label,
        onclick: () => {
          const tr = clip.keys[key];
          const now = player.t;
          const k = keyAt(tr, now);
          if (k >= 0) { tr.splice(k, 1); if (!tr.length) delete clip.keys[key]; }
          else {
            const v = tr?.length ? keyValue(tr, now) : (p.params[d.id] ?? d.def);
            clip.keys[key] = [...(tr || []), [now, v]].sort((a, b) => a[0] - b[0]);
          }
          changed(['params', 'time']);
        },
      }, icon(ki >= 0 || track?.length ? 'key' : 'keyOff'));
      const modW = p.mod?.[d.id] ?? d.mod;
      return h('div.prm', null,
        h('span.prm__lbl', null, d.label), val, kbtn, control,
        showMod && !d.options ? h('div.prm__mod', { title: 'Quanto questo parametro segue il carattere del movimento' },
          h('span.meta', null, 'movimento'),
          h('input.range', { type: 'range', min: 0, max: 1, step: 0.05, value: modW, 'aria-label': 'Movimento di ' + d.label, oninput: (e) => { p.mod = p.mod || {}; p.mod[d.id] = Number(e.target.value); changed([]); } })) : null);
    });
    const blend = h('select.field', { 'aria-label': 'Fusione', onchange: (e) => { p.blend = e.target.value; changed(['chain']); } }, BLENDS.map((b) => h('option', { value: b.id, selected: b.id === p.blend }, b.label)));
    const mix = h('input.range', { type: 'range', min: 0, max: 1, step: 0.01, value: p.mix, 'aria-label': 'Quantità', oninput: (e) => { p.mix = Number(e.target.value); mixv.textContent = Math.round(p.mix * 100) + '%'; changed([]); }, onchange: () => drawChain() });
    const mixv = h('span.prm__val', null, Math.round(p.mix * 100) + '%');
    fill(el.params, 
      h('div.sect', null,
        h('div.row', { style: { alignItems: 'baseline' } }, h('span.code', { style: { fontSize: '40px' } }, proc.code), h('span.proc__title.grow', null, proc.name)),
        h('p.about', null, proc.about),
        warns.map((w) => h('p.warn-line', null, w))),
      h('div.scroll', null,
        h('div.sect', null,
          h('div.prm', null, h('span.prm__lbl', null, 'Fusione con il flusso'), h('span'), h('span'), h('div', { style: { gridColumn: '1 / 3' } }, blend)),
          h('div.prm', null, h('span.prm__lbl', null, 'Quantità'), mixv, h('span'), mix)),
        h('div.sect', null, h('div.sect__head', null, h('span.label', null, 'Parametri'), h('span.meta', null, '◆ = chiave nel tempo')), rows),
        h('div.sect', null, h('div.row', null,
          h('button.btn.btn--quiet', { onclick: () => { const c = JSON.parse(JSON.stringify(p)); c.id = uid('p'); for (const k of Object.keys(clip.keys)) if (k.startsWith(p.id + '.')) clip.keys[c.id + k.slice(p.id.length)] = JSON.parse(JSON.stringify(clip.keys[k])); clip.chain.splice(clip.chain.indexOf(p) + 1, 0, c); sel = c.id; changed(['chain', 'params', 'time', 'structure']); } }, 'Duplica'),
          h('button.btn.btn--quiet', { onclick: () => { p.params = defaultParams(p.proc); for (const k of Object.keys(clip.keys)) if (k.startsWith(p.id + '.')) delete clip.keys[k]; changed(['params', 'time']); } }, 'Valori iniziali'),
          h('button.btn.btn--quiet', { onclick: () => { const i = clip.chain.indexOf(p); clip.chain.splice(i, 1); for (const k of Object.keys(clip.keys)) if (k.startsWith(p.id + '.')) delete clip.keys[k]; sel = clip.chain[Math.max(0, i - 1)]?.id; changed(['chain', 'params', 'time', 'structure']); } }, 'Rimuovi'))),
      ),
    );
  }

  // ------------------------------------------------------------- stage
  const screen = h('div.screen', { 'data-ground': pref.get('moviola.ground') || 'void' });
  const badge = h('div.screen__badge');
  const note = h('div.screen__note');
  screen.append(player.canvas, badge, note);
  const tc = h('span.tc');
  const playBtn = h('button.icon-btn', { title: 'Riproduci / ferma (spazio)', 'aria-label': 'Riproduci', onclick: () => { player.toggle(); drawTransport(); } });
  const previewSel = h('select.field.only-desk', { 'aria-label': 'Risoluzione dell’anteprima', onchange: (e) => { player.setPreview(Number(e.target.value)); pref.set('moviola.preview', e.target.value); updateBadge(); } },
    [640, 960, 1280, 1920].map((v) => h('option', { value: v, selected: v === player.previewLong }, `anteprima ${v}`)));
  const ground = h('button.tag.only-desk', { title: 'Fondo nero o grigio neutro 18%', onclick: () => { screen.dataset.ground = screen.dataset.ground === 'neutral' ? 'void' : 'neutral'; pref.set('moviola.ground', screen.dataset.ground); } }, 'Fondo');
  const transport = h('div.transport', null,
    h('button.icon-btn', { title: 'Dall’inizio', 'aria-label': 'Dall’inizio', onclick: () => { player.restart(); } }, icon('start')),
    h('button.icon-btn', { title: 'Fotogramma prima (←)', 'aria-label': 'Fotogramma prima', onclick: () => step(-1) }, icon('prev')),
    playBtn,
    h('button.icon-btn', { title: 'Fotogramma dopo (→)', 'aria-label': 'Fotogramma dopo', onclick: () => step(1) }, icon('next')),
    tc, h('span.grow'), previewSel, ground);
  el.stage.append(screen, transport);

  function step(d) { if (player.playing) player.pause(); player.seek(Math.max(0, (player.frame % player.total) + d)); drawTransport(); }
  function drawTransport() {
    fill(playBtn, icon(player.playing ? 'pause' : 'play'));
    playBtn.setAttribute('aria-pressed', String(player.playing));
    playBtn.setAttribute('aria-label', player.playing ? 'Ferma' : 'Riproduci');
  }
  function updateBadge() {
    const f = clip.format;
    badge.innerHTML = '';
    badge.append(h('b', null, `${player.r.w}×${player.r.h}`), ` anteprima · render ${dims(f.aspect, f.long || 3840).w}×${dims(f.aspect, f.long || 3840).h} · ${f.fps} fps · ${player.float ? '16 bit' : '8 bit'}`);
    const errs = [...player.r.errors.entries()];
    note.textContent = errs.length ? 'Processo con errore: ' + errs.map((e) => e[0]).join(', ') : '';
  }

  let fpsT = performance.now(), fpsN = 0, fpsShown = '';
  app.onFrame = (p) => {
    const fr = p.frame % p.total;
    fill(tc, fmtTime(fr, p.fps), h('small', null, `${fr + 1}/${p.total}`));
    head.style.left = (fr / Math.max(1, p.total - 1)) * 100 + '%';
    if (p.playing) {
      fpsN++;
      const now = performance.now();
      if (now - fpsT > 1000) { fpsShown = `${Math.round(fpsN * 1000 / (now - fpsT))} fps reali`; fpsN = 0; fpsT = now; app.status(fpsShown); }
    }
    if (!p.playing && fr !== lastKeyFrame) { lastKeyFrame = fr; refreshKeys(); }
  };
  let lastKeyFrame = -1;
  let keyRefresh = 0;
  function refreshKeys() { cancelAnimationFrame(keyRefresh); keyRefresh = requestAnimationFrame(() => drawParams()); }

  // ------------------------------------------------------------- timeline
  const head = h('div.tl__head');
  function drawTimeline() {
    const T = clip.format.duration;
    const ruler = h('div.tl__lane');
    for (let s = 0; s <= T; s += T > 15 ? 2 : 1) ruler.append(h('span.tl__tick', { style: { left: (s / T) * 100 + '%' } }, s + 's'));
    head.remove();
    ruler.append(head);
    const scrub = (e) => {
      const r = ruler.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      if (player.playing) player.pause();
      player.seek(Math.round(x * (player.total - 1)));
      drawTransport();
    };
    ruler.addEventListener('pointerdown', (e) => { ruler.setPointerCapture(e.pointerId); scrub(e); ruler.onpointermove = scrub; });
    ruler.addEventListener('pointerup', () => { ruler.onpointermove = null; });
    const tracks = Object.entries(clip.keys).filter(([k, v]) => v?.length && clip.chain.some((p) => k.startsWith(p.id + '.')));
    fill(el.time, h('div.tl', null,
      h('div.tl__ruler', null, h('div.tl__name', null, 'Tempo'), ruler),
      tracks.length ? h('div.tl__tracks', null, tracks.map(([k, track]) => {
        const [pid, prm] = k.split('.');
        const pass = clip.chain.find((p) => p.id === pid);
        const proc = byId[pass.proc];
        const d = proc.params.find((x) => x.id === prm);
        if (!d) return null;
        const lane = h('div.tl__lane');
        // curva del valore
        const pts = [];
        for (let i = 0; i <= 60; i++) { const tt = (i / 60) * T; const v = keyValue(track, tt); pts.push(`${(i / 60) * 100},${100 - ((v - d.min) / (d.max - d.min)) * 100}`); }
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'tl__curve'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none');
        svg.innerHTML = `<path d="M${pts.join(' L')}"/>`;
        lane.append(svg);
        track.forEach((kf, ki) => {
          const kb = h('button.tl__key', { style: { left: (kf[0] / T) * 100 + '%' }, title: `${kf[0].toFixed(2)} s · ${fmtNum(kf[1], d)} — trascina per spostare, doppio clic per togliere`, 'aria-label': `Chiave a ${kf[0].toFixed(2)} secondi` });
          kb.addEventListener('dblclick', () => { track.splice(ki, 1); if (!track.length) delete clip.keys[k]; changed(['time', 'params']); });
          kb.addEventListener('pointerdown', (e) => {
            e.stopPropagation(); kb.setPointerCapture(e.pointerId);
            const r = lane.getBoundingClientRect();
            const moveK = (ev) => {
              const x = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
              const fr = Math.round(x * (player.total - 1));
              kf[0] = fr / clip.format.fps;
              kb.style.left = (kf[0] / T) * 100 + '%';
              if (!player.playing) player.seek(fr);
            };
            kb.onpointermove = moveK;
            kb.onpointerup = () => { kb.onpointermove = null; track.sort((a, b) => a[0] - b[0]); changed(['time', 'params']); };
          });
          lane.append(kb);
        });
        lane.addEventListener('pointerdown', (e) => { if (e.target === lane || e.target.tagName === 'svg') scrub(e); });
        return h('div.tl__track', null, h('div.tl__name', { title: `${proc.name} · ${d.label}` }, h('b', null, proc.code), d.label), lane);
      })) : h('div.tl__empty', null, 'Nessuna chiave. Con ◆ accanto a un parametro fissi il suo valore in un istante; tra due chiavi il valore scorre.'),
    ));
    app.onFrame && app.onFrame(player);
  }

  // ------------------------------------------------------------- tastiera
  const keys = (e) => {
    if (typing(e)) return;
    if (e.metaKey || e.ctrlKey) return;
    if (e.key === ' ') { e.preventDefault(); player.toggle(); drawTransport(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(e.shiftKey ? -clip.format.fps : -1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(e.shiftKey ? clip.format.fps : 1); }
    else if (e.key.toLowerCase() === 's') { e.preventDefault(); askSave(); }
  };
  document.addEventListener('keydown', keys);

  drawHead(); drawChain(); drawParams(); drawTimeline(); drawTransport();
  syncPlayer().then(() => { updateBadge(); player.seek(player.frame % player.total); });

  return () => { document.removeEventListener('keydown', keys); cancelAnimationFrame(redrawT); player.pause(); };
}
