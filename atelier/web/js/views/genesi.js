// 05 · Da zero: un'idea, non un prompt. Tre strade: algoritmo, accostamento, AI.
import { h, clear, toast, spinner, stateBox, guide, labelN } from '../ui.js';
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
      ['algoritmo', 'Processo algoritmico', 'Rumore, flussi, fratture, automi: sul tuo Mac, a piena risoluzione. Nessun costo.', '0 cr'],
      ['archivio', "Accostamento dall'archivio", "Due immagini lontane fra loro, scelte dall'archivio in base all'idea, sulla tela.", '0 cr'],
      ['ai', 'Generazione AI', "Higgsfield parte dal testo dell'idea. Prima ti mostro il costo.", 'preventivo'],
    ];
    const choice = h('div', { class: 'choice' }, paths.map(([v, t, d, c]) => h('label', { class: 'choice__opt' },
      h('input', { type: 'radio', name: 'zp', value: v, checked: path === v, onchange: () => { path = v; drawGuide(); } }),
      h('span', {}, h('span', { style: { display: 'block', fontSize: '13px' } }, t), h('span', { class: 'muted', style: { fontSize: '12px' } }, d)),
      h('span', { class: 'meta', style: v === 'ai' ? { color: 'var(--mark)' } : {} }, c))));

    const guideBox = h('div');
    const goBtn = h('button', { class: 'btn btn--lg', onclick: go }, 'Avvia');
    function drawGuide() {
      const pName = paths.find((x) => x[0] === path)[1];
      goBtn.className = `btn btn--lg${out ? '' : ' btn--solid'}${path === 'ai' ? ' btn--paid' : ''}`;
      goBtn.textContent = path === 'ai' ? 'Chiedi il preventivo…' : path === 'archivio' ? 'Accosta e porta sulla tela' : out ? 'Rigenera con un altro processo' : 'Avvia';
      clear(guideBox, guide('○', 'Parti da zero', [
        ['Scrivi un\'ipotesi', 'o chiedi proposte all\'interlocutore', !!idea.trim() || !!out],
        ['Scegli come procedere', pName, !!idea.trim() || !!out],
        ['Avvia', path === 'ai' ? 'prima il preventivo, poi la tua approvazione' : 'gratis, sul tuo Mac, a piena risoluzione', !!out],
        ['Continua sulla tela', "il risultato è la prima immagine di un nuovo esperimento", false],
      ], out ? h('button', { class: 'btn btn--solid btn--lg', onclick: () => app.putNodesOnTela(out.expId, [out.id]) }, 'Continua sulla tela →') : null));
    }
    root.append(h('div', { class: 'screen' }, guideBox, h('div', { class: 'blank' },
      h('div', { class: 'blank__write' },
        labelN(1, 'Ipotesi'),
        ta,
        h('div', { class: 'row' }, h('button', { class: 'btn', onclick: propose }, "Chiedi proposte all'interlocutore"), h('span', { class: 'meta' }, app.state.provider === 'claude' ? 'con Claude' : 'locale')),
        list,
        h('div', { class: 'stack' }, labelN(2, 'Come procedere'), choice),
        h('div', { class: 'stack' }, labelN(3, 'Avvia'), h('div', { class: 'row' }, goBtn))),
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
            hy.passi?.length ? h('button', { class: 'btn', onclick: (e) => runSteps(hy, e.currentTarget) }, 'Genera in locale') : null,
            hy.prompt ? h('button', { class: 'btn btn--paid', onclick: () => ai(hy.prompt, hy.titolo) }, 'Con Higgsfield', h('span', { class: 'btn__cost' }, 'preventivo')) : null,
            h('button', { class: 'btn btn--quiet', onclick: () => { idea = `${hy.titolo}. ${hy.descrizione}`; ta.value = idea; } }, 'Usa come ipotesi'))))),
        ideas.domanda ? h('div', { class: 'critic__msg' }, h('span', { class: 'label' }, 'Domanda'), h('div', { class: 'critic__text' }, h('em', {}, ideas.domanda))) : null);
    }

    function drawOut() {
      drawGuide();
      if (!out) return clear(stage, stateBox('·', 'Nessuna immagine iniziale', "Scrivi un'ipotesi e scegli una strada. Il risultato diventa la prima immagine di un nuovo esperimento."));
      clear(stage, h('div', { class: 'zero-out' }, h('img', { src: out.asset.url, alt: '' }),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: () => app.go('laboratorio', { lab: { expId: out.expId, current: out.id } }) }, 'Apri nel laboratorio'),
          h('button', { class: 'btn btn--quiet', onclick: (e) => runSteps(out.hy, e.currentTarget, true) }, 'Un altro seme'))));
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
        if (assets.length < 2) return toast("Servono almeno due immagini in archivio: cercane qualcuna in «Cerca».");
        const words = idea.toLowerCase();
        const scored = assets.map((a) => ({ a, s: a.tags.filter((t) => words.includes(t)).length + (words && a.title.toLowerCase().split(/\W+/).some((w) => w.length > 3 && words.includes(w)) ? 1 : 0) + Math.random() * 0.6 })).sort((x, y) => y.s - x.s);
        const first = scored[0].a;
        const far = scored.slice(1).sort((x, y) => overlap(first, x.a) - overlap(first, y.a) || Math.random() - 0.5)[0].a;
        app.state.tela.expId = null; app.state.tela.slots = [];
        app.state.tela.process = 'cadavere'; app.state.tela.params = {};
        toast(`Accosto «${first.title}» e «${far.title}»: hanno pochissimo in comune, ed è il motivo.`);
        return app.toTela([first.id, far.id]);
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
