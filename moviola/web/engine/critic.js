// Interlocutore locale: regole scritte, sincere, non accondiscendenti.
// Si usa quando sul Mac non c'è Claude, o nella pagina demo. Le ipotesi sono
// operazioni concrete sulla catena ("ops"), le stesse che produce Claude.

import { byId, defaultParams } from './processes.js';
import { uid } from './clip.js';

const pct = (x) => Math.round(x * 100) + '%';

export function localCritique(clip, m, idea) {
  const on = clip.chain.filter((p) => p.on);
  const procs = on.map((p) => p.proc);
  const has = (id) => procs.includes(id);
  const obs = [];   // [peso, frase]
  const hyps = [];
  let dissent = '';

  const still = m.movimento < 0.004;
  const calm = m.movimento < 0.012;
  const busy = m.movimento > 0.06 || (m.densita_bordi > 0.16 && m.movimento > 0.03);
  const strobe = m.sfarfallio > 0.06;
  const flat = m.contrasto < 0.09;
  const static_ = m.varieta_nel_tempo < 0.035;
  const coloured = m.saturazione > 0.28;
  const ai = m.viola_magenta > 0.06 || (coloured && m.densita_bordi < 0.04 && m.simmetria > 0.75);
  const lastMat = clip.chain.findIndex((p) => p.on && p.proc === 'materia');
  const at = lastMat >= 0 ? lastMat : clip.chain.length;

  // ---------------------------------------------------------- lettura
  if (still) obs.push([3, 'Il quadro quasi non si muove: ogni fotogramma somiglia al precedente. Così è una fotografia che respira, non ancora un film.']);
  else if (calm && static_) obs.push([3, 'Il movimento c’è ma non porta da nessuna parte: alla fine della clip siamo esattamente dove eravamo all’inizio. È il ritmo di un salvaschermo.']);
  else if (calm) obs.push([2, 'Il movimento è lento e continuo; l’immagine cambia davvero nel tempo. Il rischio è che resti piacevole e basta.']);
  if (busy) obs.push([3, `C’è moltissimo da guardare (densità ${pct(Math.min(1, m.densita_bordi * 4))}, movimento alto): l’occhio non trova un punto dove fermarsi, e senza una pausa anche il caos diventa uniforme.`]);
  if (strobe) obs.push([2, 'La luminosità salta da un fotogramma all’altro: è uno sfarfallio vero, fisico. Usalo come scelta, non come effetto di fondo.']);
  if (flat) obs.push([2, 'Il contrasto è basso: tutto vive nei grigi medi. Manca un nero che pesi e un bianco che ferisca.']);
  if (m.bruciato_bianco > 0.25) obs.push([2, `Un quarto del quadro è bianco pieno (${pct(m.bruciato_bianco)}): lì non resta materia da lavorare in DaVinci.`]);
  if (m.chiuso_nero > 0.55) obs.push([1, `Più di metà del quadro è nero chiuso (${pct(m.chiuso_nero)}). Va bene se è il vuoto che cerchi; meno se è solo sottoesposto.`]);
  if (m.simmetria > 0.82) obs.push([2, 'L’immagine è quasi simmetrica: rassicura troppo. La simmetria è il primo segno di un’immagine che si sa già.']);
  if (ai) obs.push([3, 'Colori viola-magenta e superfici morbide: è il territorio dell’estetica da generatore AI. Va evitato o dichiarato apertamente.']);
  if (clip.format.loop && m.chiusura_loop !== null && m.chiusura_loop > 0.08) obs.push([1, `Il loop non si chiude: tra l’ultimo e il primo fotogramma c’è uno scarto del ${pct(m.chiusura_loop)}. In proiezione continua si vedrà il taglio.`]);
  if (!coloured && !flat) obs.push([1, 'Il colore è quasi assente e il lavoro regge sui valori: è un buon segno.']);
  if (!obs.length) obs.push([1, 'Contrasto, movimento e densità sono tutti in un territorio medio. Niente è sbagliato, e niente insiste abbastanza.']);
  obs.sort((a, b) => b[0] - a[0]);
  let lettura = obs.slice(0, 3).map((o) => o[1]).join(' ');
  if (idea) lettura += ` Rispetto alla tua ipotesi («${idea.slice(0, 120)}»): chiediti se quello che vedi la mette alla prova o la illustra soltanto.`;

  // --------------------------------------------------------- disaccordo
  if (ai) dissent = 'Non sono d’accordo con la direzione del colore: così somiglia a mille clip generate. Prova a togliere, non ad aggiungere.';
  else if (calm && static_) dissent = 'Così com’è la clip non ha tensione: la renderei solo dopo aver rotto il suo equilibrio.';
  else if (busy && !strobe) dissent = 'Stai accumulando processi: il risultato è rumoroso più che ambiguo. Toglierei la metà della catena.';

  // ----------------------------------------------------------- ipotesi
  if (still || (calm && static_)) {
    hyps.push({
      titolo: 'Rompere il tempo con fotogrammi singoli',
      perche: 'Brakhage insegna che un fotogramma di troppo cambia la percezione di tutti gli altri. Interruzioni rare e secche danno peso alla lentezza.',
      ops: [{ op: 'add', proc: 'graffio', at, blend: 'schermo', mix: 0.85, params: { graffi: 0.35, macchie: 0.25, pigmento: 0.2, sfarfallio: 0.3, lampi: 0.22, cadenza: 1, fondo: 0 } }],
    });
  }
  if (busy) {
    const gen = on.find((p) => byId[p.proc].gen && p !== on[0]) || on.find((p) => !['materia', 'tono'].includes(p.proc) && p !== on[0]);
    hyps.push({
      titolo: 'Togliere invece di aggiungere',
      perche: 'Spegni un processo e ferma il movimento automatico: lascia che a muoversi sia una cosa sola. Il vuoto rende leggibile il resto.',
      ops: [...(gen ? [{ op: 'toggle', pass: gen.id, on: false }] : []), { op: 'motion', mode: 'fermo' }],
    });
  }
  if (flat || (!ai && coloured)) {
    hyps.push({
      titolo: 'Ridurre a bianco e nero con un nero vero',
      perche: 'Senza colore resta la struttura: si vede subito se la clip regge. Il nero che mangia il quadro crea profondità e attesa.',
      ops: has('tono')
        ? [{ op: 'set', pass: on.find((p) => p.proc === 'tono').id, param: 'saturazione', value: 0 }, { op: 'set', pass: on.find((p) => p.proc === 'tono').id, param: 'contrasto', value: 1.9 }, { op: 'set', pass: on.find((p) => p.proc === 'tono').id, param: 'luminosita', value: -0.2 }]
        : [{ op: 'add', proc: 'tono', at, params: { saturazione: 0, contrasto: 1.9, luminosita: -0.2 } }],
    });
  }
  if (ai) {
    hyps.push({
      titolo: 'Togliere il viola, lasciare il pigmento',
      perche: 'Una bicromia terrosa sposta l’immagine dalla vetrina digitale alla materia. Il colore torna a essere una scelta.',
      ops: [{ op: 'add', proc: 'tono', at, params: { saturazione: 0.4, bicromia: 0.7, ombre: 0.62, luci: 0.06 } }],
    });
  }
  if (m.simmetria > 0.82) {
    hyps.push({
      titolo: 'Spostare il baricentro',
      perche: 'Una rifrazione forte e lenta rompe la simmetria senza aggiungere oggetti: l’immagine si inclina.',
      ops: [{ op: 'add', proc: 'rifrazione', at, params: { forza: 0.12, scala: 0.9, velocita: 0.08, aberrazione: 0.1 } }],
    });
  }
  // sempre: una direzione contraria a quella attuale
  const timeProc = procs.some((p) => byId[p].family === 'tempo');
  if (!timeProc) {
    hyps.push({
      titolo: 'Fare del tempo il materiale',
      perche: 'Finora il tempo scorre e basta. Con lo slit-scan ogni riga arriva da un istante diverso: il movimento diventa forma, come in Viola.',
      ops: [{ op: 'add', proc: 'fessura', at, params: { profondita: 30, direzione: 1, curva: 1.6 } }],
    });
  } else if (clip.motion.mode === 'contemplativo' || clip.motion.mode === 'fermo') {
    hyps.push({
      titolo: 'Contro la contemplazione: un battito',
      perche: 'La clip chiede di essere guardata con calma; prova l’opposto, un ritmo secco a 144 battiti. Se regge anche così, la forma è solida.',
      ops: [{ op: 'motion', mode: 'ritmico', bpm: 144, amount: 0.7 }],
    });
  } else {
    hyps.push({
      titolo: 'Contro il ritmo: fermare tutto',
      perche: 'Il movimento automatico copre l’immagine. Fermalo e lascia agire solo la memoria dei fotogrammi: si vedrà cosa resta.',
      ops: [{ op: 'motion', mode: 'fermo' }, { op: 'add', proc: 'sovrimpressione', at, params: { strati: 4, ritardo: 6, deriva: 0.02, esposizione: 0.7 } }],
    });
  }
  hyps.push({ titolo: 'Stessa ricetta, altro caso', perche: 'Prima di cambiare idea, cambia il seme: capirai se ciò che ti piace è nella struttura o è stato fortuna.', ops: [{ op: 'seed' }] });

  return { via: 'regole locali', lettura, disaccordo: dissent, ipotesi: hyps.slice(0, 4) };
}

/** Applica le operazioni a una copia della clip. Ignora ciò che non esiste. */
export function applyOps(clip, ops) {
  const c = JSON.parse(JSON.stringify(clip));
  const done = [];
  for (const o of ops || []) {
    try {
      if (o.op === 'set') {
        const p = c.chain.find((x) => x.id === o.pass); const d = p && byId[p.proc].params.find((x) => x.id === o.param);
        if (!d) continue;
        const v = Math.min(d.max, Math.max(d.min, Number(o.value)));
        delete c.keys[`${p.id}.${d.id}`];
        p.params[d.id] = v; done.push(`${byId[p.proc].code} ${d.label} → ${v}`);
      } else if (o.op === 'add') {
        const proc = byId[o.proc]; if (!proc) continue;
        const params = defaultParams(o.proc);
        for (const [k, v] of Object.entries(o.params || {})) { const d = proc.params.find((x) => x.id === k); if (d) params[k] = Math.min(d.max, Math.max(d.min, Number(v))); }
        const pass = { id: uid('p'), proc: o.proc, on: true, mix: o.mix ?? 1, blend: o.blend || proc.blend || 'normale', params };
        const at = Number.isInteger(o.at) ? Math.min(c.chain.length, Math.max(0, o.at)) : c.chain.length;
        c.chain.splice(at, 0, pass); done.push(`+ ${proc.name}`);
      } else if (o.op === 'remove') {
        const i = c.chain.findIndex((x) => x.id === o.pass); if (i < 0) continue;
        done.push(`− ${byId[c.chain[i].proc].name}`); c.chain.splice(i, 1);
      } else if (o.op === 'toggle') {
        const p = c.chain.find((x) => x.id === o.pass); if (!p) continue;
        p.on = o.on ?? !p.on; done.push(`${p.on ? 'accendi' : 'spegni'} ${byId[p.proc].name}`);
      } else if (o.op === 'blend') {
        const p = c.chain.find((x) => x.id === o.pass); if (!p) continue;
        if (o.blend) p.blend = o.blend; if (o.mix !== undefined) p.mix = Math.min(1, Math.max(0, Number(o.mix)));
        done.push(`${byId[p.proc].name}: ${p.blend} ${Math.round(p.mix * 100)}%`);
      } else if (o.op === 'motion') {
        for (const k of ['mode', 'amount', 'bpm', 'speed', 'division']) if (o[k] !== undefined) c.motion[k] = o[k];
        done.push(`movimento ${c.motion.mode}`);
      } else if (o.op === 'seed') {
        c.seed = Math.floor(Math.random() * 99999) + 1; done.push(`seme ${c.seed}`);
      }
    } catch (e) { console.warn('op', o, e); }
  }
  return { clip: c, done };
}

export function describeOps(clip, ops) {
  return (ops || []).map((o) => {
    const p = o.pass && clip.chain.find((x) => x.id === o.pass);
    const pn = p ? byId[p.proc]?.name : '';
    if (o.op === 'set') return `${pn}: ${byId[p?.proc]?.params.find((d) => d.id === o.param)?.label || o.param} = ${o.value}`;
    if (o.op === 'add') return `aggiungi ${byId[o.proc]?.name || o.proc}`;
    if (o.op === 'remove') return `togli ${pn}`;
    if (o.op === 'toggle') return `${o.on === false ? 'spegni' : 'accendi'} ${pn}`;
    if (o.op === 'blend') return `${pn}: fusione ${o.blend || ''} ${o.mix !== undefined ? Math.round(o.mix * 100) + '%' : ''}`;
    if (o.op === 'motion') return `movimento ${o.mode || ''}${o.bpm ? ' ' + o.bpm + ' bpm' : ''}`;
    if (o.op === 'seed') return 'nuovo seme';
    return o.op;
  }).join(' · ');
}

export function procCatalog() {
  return Object.values(byId).map((p) => `${p.id} (${p.name}): ${p.params.map((d) => `${d.id}[${d.min},${d.max}]${d.options ? '{' + d.options.join('|') + '}' : ''}`).join(' ')}`).join('\n');
}
