// Parti da zero: un'idea scritta, e proposte che nascono da quell'idea.
// Ogni proposta dice perché nasce da ciò che hai scritto e ha un solo pulsante.
import { h, clear, toast, spinner, stateBox, noticeBox } from '../ui.js';
import { openHiggsfield } from '../dialogs.js';

let idea = '';
let ideas = null;          // { fonte, ipotesi, avviso?, per: testo dell'idea }
let out = null;            // ultima immagine creata
let askT = null;

export default {
  render(root, app) {
    const claudeOk = app.api.mode !== 'demo' && app.status?.critic?.claude?.available;
    const ta = h('textarea', { class: 'blank__idea', rows: 3, placeholder: 'Scrivi un\'idea: una parola, una tensione, una domanda. Per esempio «gatto», «la memoria di una crepa», «una stanza che respira».',
      oninput: (e) => { idea = e.target.value; clearTimeout(askT); askT = setTimeout(() => propose('locale'), 350); } }, idea);
    const list = h('div', { class: 'z-list' });
    const src = h('p', { class: 'z-src' });
    const stage = h('div', { class: 'stage__canvas' });

    root.append(h('div', { class: 's-screen s-zero' },
      h('header', { class: 's-head' },
        h('button', { class: 'link s-back', onclick: () => app.go('archivio') }, '‹ Torna alle foto'),
        h('h1', { class: 's-title' }, 'Parti da zero'),
        h('p', { class: 's-hint' }, 'Scrivi un\'idea. Mentre scrivi, qui sotto compaiono le strade che ne nascono: tocca «Crea» su quella che ti interessa. La prima immagine poi la trasformi come una foto.')),
      h('div', { class: 'blank' },
        h('div', { class: 'blank__write' },
          h('div', { class: 's-label' }, 'La tua idea'),
          ta,
          h('div', { class: 'z-who' }, src,
            claudeOk ? h('button', { class: 'btn', title: 'Usa il tuo account Claude: con la fatturazione API ogni richiesta può costare fino a circa mezzo dollaro.', onclick: () => propose('claude') }, 'Chiedi a Claude', h('span', { class: 'z-cost' }, 'usa il tuo account Claude')) : null),
          list),
        h('div', { class: 'stage', 'data-ground': 'void' }, stage))));
    app.currentImage = () => out?.asset.url;
    drawOut();
    if (!ideas || ideas.per !== idea) propose('locale'); else drawIdeas();

    async function propose(provider) {
      const per = idea;
      if (provider === 'claude') clear(list, spinner('Claude legge la tua idea… (fino a un minuto)'));
      try {
        const r = await app.api.ideas(per, provider);
        if (per !== idea) return;
        ideas = { ...r, per };
        drawIdeas();
      } catch (e) { clear(list, h('div', { class: 'notice' }, e.message)); }
    }

    function drawIdeas() {
      if (!ideas) return;
      src.textContent = ideas.fonte === 'claude'
        ? 'Proposte di Claude, che ha letto la tua idea.'
        : app.api.mode === 'demo'
          ? 'Proposte del laboratorio: legge le parole della tua idea e le collega a processi e archivi. In questa versione online Claude non c\'è; sul Mac puoi chiederle a lui.'
          : `Proposte del laboratorio: legge le parole della tua idea e le collega a processi e archivi.${claudeOk ? '' : ' Claude non è attivo su questo Mac.'}`;
      clear(list,
        ideas.avviso ? noticeBox(ideas.avviso, ideas.dettaglio) : null,
        ideas.dissenso ? h('div', { class: 'critic__msg critic__msg--dissent' }, h('div', { class: 'critic__text' }, ideas.dissenso)) : null,
        ideas.ipotesi.map((hy) => card(hy)),
        ideas.domanda ? h('p', { class: 'z-q' }, h('em', {}, ideas.domanda)) : null);
    }

    function card(hy) {
      const kind = hy.tipo || (hy.passi?.length ? 'locale' : hy.prompt ? 'ai' : null);
      if (!kind) return null;
      const btn = kind === 'archivi' ? h('button', { class: 'btn btn--solid', onclick: (e) => fromArchives(hy, e.currentTarget) }, 'Cerca e accosta', h('span', { class: 'z-cost' }, 'gratis'))
        : kind === 'ai' ? h('button', { class: 'btn btn--paid', onclick: () => ai(hy.prompt, hy.titolo) }, 'Vedi il costo', h('span', { class: 'btn__cost' }, 'a pagamento'))
          : h('button', { class: 'btn btn--solid', onclick: (e) => runSteps(hy, e.currentTarget) }, 'Crea questa', h('span', { class: 'z-cost' }, 'gratis'));
      return h('div', { class: 'z-card', 'data-kind': kind },
        h('div', { class: 'z-card__t' }, hy.titolo),
        hy.perche ? h('div', { class: 'z-card__why' }, hy.perche) : null,
        h('div', { class: 'z-card__d' }, hy.descrizione),
        h('div', { class: 'z-card__acts' }, btn));
    }

    function drawOut() {
      if (!out) return clear(stage, stateBox('·', 'Qui comparirà la prima immagine', 'Scrivi un\'idea e tocca «Crea» su una delle proposte.'));
      clear(stage, h('div', { class: 'zero-out' }, h('img', { src: out.asset.url, alt: '' }),
        h('p', { class: 'z-out__note' }, `Da «${out.idea || 'nessuna idea'}» · ${out.hy.titolo}`),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn--solid', onclick: () => app.putNodesOnTela(out.expId, [out.id]) }, 'Trasforma questa →'),
          h('button', { class: 'btn', onclick: (e) => runSteps(out.hy, e.currentTarget, true) }, 'Un\'altra versione'))));
    }

    async function ensureExp(title) {
      return (await app.api.createExperiment({ title: (idea || title || 'Da zero').slice(0, 80), hypothesis: idea, assetIds: [] })).experiment;
    }

    async function runSteps(hy, btn, again = false) {
      btn.disabled = true;
      clear(stage, spinner('Creo l\'immagine a piena risoluzione…'));
      stage.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      try {
        const e = again && out ? { id: out.expId } : await ensureExp(hy.titolo);
        let parents = [], last;
        for (const [i, s] of hy.passi.entries()) {
          const p = app.processes.find((x) => x.id === s.processo);
          if (!p) continue;
          const seed = !again && i === 0 && hy.seme != null ? hy.seme : undefined;
          const r = await app.api.run(e.id, { parents: p.inputs.min > 0 ? parents : [], process: s.processo, params: s.parametri || {}, ...(seed != null ? { seed } : {}) });
          last = r.node; parents = [r.node.id];
        }
        out = { ...last, expId: e.id, hy, idea };
        app.state.lab.expId = e.id; app.state.lab.current = last.id;
        app.state.focus = { assetId: last.asset.id, experimentId: e.id };
        app.persist();
      } catch (err) { toast(err.message); }
      drawOut();
      btn.disabled = false;
    }

    // La parola dell'idea cercata davvero negli archivi: due immagini lontane, accostate.
    async function fromArchives(hy, btn) {
      btn.disabled = true;
      const label = btn.firstChild;
      const say = (t) => { label.textContent = t; };
      try {
        const archives = app.state.search.archives?.length ? app.state.search.archives : ['openverse', 'wikimedia', 'cleveland', 'nasa'];
        say(`Cerco «${hy.cerca}»…`);
        let r = await app.api.searchArchives(hy.cerca, archives, 1);
        let groups = r.results.filter((x) => x.ok && x.items.length);
        const first = hy.cerca.split(' ')[0];
        if (!groups.length && first !== hy.cerca) { say(`Cerco «${first}»…`); r = await app.api.searchArchives(first, archives, 1); groups = r.results.filter((x) => x.ok && x.items.length); }
        if (!groups.length) throw new Error(`Negli archivi non trovo niente per «${hy.cerca}». Prova un'altra parola.`);
        const a = groups[0].items[0];
        const b = groups[1]?.items[0] || groups[0].items[Math.min(groups[0].items.length - 1, 3)];
        const picks = a === b ? [a] : [a, b];
        const ids = [];
        for (const [i, it] of picks.entries()) { say(`Aggiungo ${i + 1} di ${picks.length}…`); ids.push((await app.api.importFromArchive(it)).asset.id); }
        toast(ids.length > 1 ? `Accosto «${a.title}» e «${b.title}». Sono tra le tue foto, con autore e licenza.` : `Ho trovato «${a.title}». È tra le tue foto, con autore e licenza.`);
        app.toTela(ids, { process: ids.length > 1 ? 'cadavere' : null });
      } catch (e) { toast(e.message); btn.disabled = false; say('Cerca e accosta'); }
    }

    async function ai(prompt, title) {
      const e = await ensureExp(title);
      app.state.lab.expId = e.id; app.persist();
      openHiggsfield(app, { expId: e.id, parents: [], prompt });
    }
  },
};
