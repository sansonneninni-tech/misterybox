// 05 · Da zero: un'idea, non un prompt. Tre strade: algoritmo, accostamento, AI.
import { h, clear, toast, spinner, stateBox, labelN } from '../ui.js';
import { openHiggsfield } from '../dialogs.js';

let idea = '';
let ideas = null;
let out = null;
let path = 'algoritmo';

export default {
  render(root, app) {
    const ta = h('textarea', { class: 'blank__idea', placeholder: "Scrivi un'idea, non un prompt. Una tensione, un'incongruenza, una domanda.", oninput: (e) => { const had = !!idea.trim(); idea = e.target.value; if (had !== !!idea.trim()) drawGuide(); } }, idea);
    const list = h('div', { class: 'stack' });
    const stage = h('div', { class: 'stage__canvas' });
    const paths = [
      ['algoritmo', 'Un processo del laboratorio', 'Nebbie, correnti, fratture, trame: calcolate qui, a piena risoluzione. Gratis.', 'gratis'],
      ['archivio', 'Un accostamento inatteso', "Due tue foto lontane fra loro, scelte in base all'idea, da combinare.", 'gratis'],
      ['ai', 'Intelligenza artificiale (Higgsfield)', "Parte dal testo dell'idea. A pagamento: prima ti mostro il costo e parte solo se lo approvi.", 'a pagamento'],
    ];
    const choice = h('div', { class: 'choice' }, paths.map(([v, t, d, c]) => h('label', { class: 'choice__opt' },
      h('input', { type: 'radio', name: 'zp', value: v, checked: path === v, onchange: () => { path = v; drawGuide(); } }),
      h('span', {}, h('span', { style: { display: 'block', fontSize: '13px' } }, t), h('span', { class: 'muted', style: { fontSize: '12px' } }, d)),
      h('span', { class: 'meta', style: v === 'ai' ? { color: 'var(--mark)' } : {} }, c))));

    const guideBox = h('div');
    const goBtn = h('button', { class: 'btn btn--lg', onclick: go }, 'Avvia');
    function drawGuide() {
      const pName = paths.find((x) => x[0] === path)[1];
      void pName;
      goBtn.className = `btn btn--lg${out ? '' : ' btn--solid'}${path === 'ai' ? ' btn--paid' : ''}`;
      goBtn.textContent = path === 'ai' ? 'Vedi il costo (Higgsfield)…' : path === 'archivio' ? 'Accosta due mie foto' : out ? 'Creane un\'altra' : 'Crea l\'immagine';
      clear(guideBox, h('header', { class: 's-head' },
        h('button', { class: 'link s-back', onclick: () => app.go('archivio') }, '‹ Torna alle foto'),
        h('h1', { class: 's-title' }, 'Parti da zero'),
        h('p', { class: 's-hint' }, 'Scrivi un\'idea, scegli una strada, crea la prima immagine. Poi la trasformi come una foto.'),
        out ? h('button', { class: 'btn btn--solid btn--lg', onclick: () => app.putNodesOnTela(out.expId, [out.id]) }, 'Trasforma questa →') : null));
    }
    root.append(h('div', { class: 's-screen s-zero' }, guideBox, h('div', { class: 'blank' },
      h('div', { class: 'blank__write' },
        labelN(1, 'La tua idea'),
        ta,
        h('div', { class: 'row' }, h('button', { class: 'btn', onclick: propose }, "Proponimi delle idee"), h('span', { class: 'meta' }, app.state.provider === 'claude' ? 'con Claude' : 'locale')),
        list,
        h('div', { class: 'stack' }, labelN(2, 'La strada'), choice),
        h('div', { class: 'stack' }, labelN(3, 'Crea'), h('div', { class: 'row' }, goBtn))),
      h('div', { class: 'stage', 'data-ground': 'void' }, stage))));
    drawGuide();
    app.currentImage = () => out?.asset.url;
    drawIdeas();
    drawOut();

    function drawIdeas() {
      if (!ideas) return clear(list);
      clear(list, h('div', { class: 'label' }, `L'interlocutore propone · ${ideas.fonte}`),
        ideas.avviso ? h('div', { class: 'notice' }, ideas.avviso) : null,
        ideas.dissenso ? h('div', { class: 'critic__msg critic__msg--dissent' }, h('div', { class: 'critic__text' }, ideas.dissenso)) : null,
        ideas.ipotesi.map((hy, i) => h('div', { class: 'hypo' }, h('span', { class: 'hypo__n' }, `H${i + 1}`), h('div', { class: 'hypo__body' },
          h('span', { class: 'hypo__title' }, hy.titolo), h('span', { class: 'muted', style: { fontSize: '12px', lineHeight: 1.55 } }, hy.descrizione),
          hy.prompt ? h('span', { class: 'meta' }, `Prompt: ${hy.prompt}`) : null,
          h('div', { class: 'hypo__acts' },
            hy.passi?.length ? h('button', { class: 'btn', onclick: (e) => runSteps(hy, e.currentTarget) }, 'Crea questa (gratis)') : null,
            hy.prompt ? h('button', { class: 'btn btn--paid', onclick: () => ai(hy.prompt, hy.titolo) }, 'Con Higgsfield', h('span', { class: 'btn__cost' }, 'a pagamento')) : null,
            h('button', { class: 'btn btn--quiet', onclick: () => { idea = `${hy.titolo}. ${hy.descrizione}`; ta.value = idea; } }, 'Usa come idea'))))),
        ideas.domanda ? h('div', { class: 'critic__msg' }, h('span', { class: 'label' }, 'Domanda'), h('div', { class: 'critic__text' }, h('em', {}, ideas.domanda))) : null);
    }

    function drawOut() {
      drawGuide();
      if (!out) return clear(stage, stateBox('·', 'Qui comparirà la prima immagine', "Scrivi un'idea e scegli una strada. Anche senza scrivere nulla puoi premere «Crea l'immagine»."));
      clear(stage, h('div', { class: 'zero-out' }, h('img', { src: out.asset.url, alt: '' }),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn--solid', onclick: () => app.putNodesOnTela(out.expId, [out.id]) }, 'Trasforma questa →'),
          h('button', { class: 'btn btn--quiet', onclick: (e) => runSteps(out.hy, e.currentTarget, true) }, 'Un\'altra versione'))));
    }

    async function propose() {
      clear(list, spinner(app.state.provider === 'claude' ? 'Claude sta pensando… (fino a un minuto)' : 'Cerco strade…'));
      try { ideas = await app.api.ideas(idea, app.state.provider); drawIdeas(); } catch (e) { clear(list, h('div', { class: 'notice' }, e.message)); }
    }

    async function ensureExp(title) {
      return (await app.api.createExperiment({ title: (title || idea || 'Da zero').slice(0, 80), hypothesis: idea, assetIds: [] })).experiment;
    }

    async function runSteps(hy, btn, again = false) {
      btn.disabled = true;
      clear(stage, spinner('Genero a piena risoluzione…'));
      try {
        const e = again && out ? { id: out.expId } : await ensureExp(hy.titolo);
        let parents = [];
        let last;
        for (const s of hy.passi) {
          const p = app.processes.find((x) => x.id === s.processo);
          if (!p) continue;
          const r = await app.api.run(e.id, { parents: p.inputs.min > 0 ? parents : [], process: s.processo, params: s.parametri || {} });
          last = r.node; parents = [r.node.id];
        }
        out = { ...last, expId: e.id, hy };
        app.state.lab.expId = e.id; app.state.lab.current = last.id;
        app.state.focus = { assetId: last.asset.id, experimentId: e.id };
        app.persist();
        drawOut();
      } catch (err) { toast(err.message); drawOut(); }
      btn.disabled = false;
    }

    async function ai(prompt, title) {
      const e = await ensureExp(title);
      app.state.lab.expId = e.id; app.persist();
      openHiggsfield(app, { expId: e.id, parents: [], prompt });
    }

    async function go(e) {
      if (path === 'ai') return ai(idea || '', 'Da zero');
      if (path === 'archivio') {
        const { assets } = await app.api.assets({ kind: 'sorgente' });
        if (assets.length < 2) return toast("Servono almeno due tue foto: aggiungile al passo 1, o cercale negli archivi.");
        const words = idea.toLowerCase();
        const scored = assets.map((a) => ({ a, s: a.tags.filter((t) => words.includes(t)).length + (words && a.title.toLowerCase().split(/\W+/).some((w) => w.length > 3 && words.includes(w)) ? 1 : 0) + Math.random() * 0.6 })).sort((x, y) => y.s - x.s);
        const first = scored[0].a;
        const far = scored.slice(1).sort((x, y) => overlap(first, x.a) - overlap(first, y.a) || Math.random() - 0.5)[0].a;
        toast(`Accosto «${first.title}» e «${far.title}»: hanno pochissimo in comune, ed è il motivo.`);
        return app.toTela([first.id, far.id], { process: 'cadavere' });
      }
      const picks = ['rumore', 'flusso', 'voronoi', 'automa'];
      const fromIdeas = ideas?.ipotesi?.find((x) => x.passi?.length);
      const hy = fromIdeas || { titolo: 'Da zero', passi: [{ processo: picks[Math.floor(Math.random() * picks.length)], parametri: {} }] };
      runSteps(hy, e.currentTarget);
    }
  },
};

function overlap(a, b) {
  const t = new Set(a.tags);
  return b.tags.filter((x) => t.has(x)).length + (a.origin.archive && a.origin.archive === b.origin.archive ? 1 : 0);
}
