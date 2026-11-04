// Impostazioni: motori, interlocutore, iPhone, cartella dati.
import { h, clear, toast, spinner } from '../ui.js';

export default {
  async render(root, app) {
    const box = h('div', { class: 'form-col settings' }, spinner());
    root.append(h('div', { class: 'view view--full' }, h('div', { class: 'pane' }, h('div', { class: 'pane__head' }, h('h1', { class: 'title' }, 'Impostazioni'), h('span', { class: 'meta' }, 'Motori, interlocutore, iPhone')), box)));
    await app.refreshStatus();
    const st = app.status || {};
    const hf = st.engines?.higgsfield || {};
    const cl = st.critic?.claude || {};
    let lan = null;
    if (app.api.mode !== 'demo') { try { lan = await app.api.lan(); } catch { /* solo dal Mac */ } }

    clear(box,
      section('Higgsfield · generazioni a pagamento',
        h('div', { class: 'rights__state' }, h('span', { class: 'dot' + (hf.available ? '' : ' dot--off') }), h('span', {}, hf.simulated ? 'Modalità simulata' : hf.available ? 'Collegato' : 'Non collegato'), hf.credits != null ? h('span', { class: 'credits' }, `${hf.credits} crediti`) : null),
        h('p', { class: 'prose muted' }, hf.message || ''),
        !hf.available ? h('div', { class: 'notice' }, h('div', { class: 'stack' },
          h('span', {}, 'Per collegarlo, nel Terminale del Mac:'),
          h('code', { class: 'meta' }, h('b', {}, 'npm i -g @higgsfield/cli')), h('code', { class: 'meta' }, h('b', {}, 'higgsfield auth login')),
          h('code', { class: 'meta' }, h('b', {}, 'higgsfield workspace list')), h('code', { class: 'meta' }, h('b', {}, 'higgsfield workspace set <id>')),
          h('span', {}, 'Poi torna qui e premi Verifica.'))) : null,
        h('p', { class: 'prose' }, 'Ogni generazione chiede prima il preventivo (gratuito) e parte solo dopo che tieni premuto il pulsante di approvazione. Il server rifiuta qualunque generazione senza un preventivo approvato da te, per gli stessi identici parametri.'),
        h('button', { class: 'btn', onclick: () => app.render() }, 'Verifica')),
      section('Interlocutore',
        h('div', { class: 'seg' }, [['locale', 'Locale'], ['claude', 'Claude']].map(([id, name]) =>
          h('button', { class: 'seg__opt', 'aria-pressed': String(app.state.provider === id), onclick: () => { app.state.provider = id; app.persist(); app.render(); } }, name))),
        h('p', { class: 'prose muted' }, 'Locale: misure reali sull\'immagine e proposte costruite su di esse, sempre disponibile, offline. Claude: legge davvero l\'immagine, discute, propone accostamenti; usa Claude Code già installato sul Mac (il tuo abbonamento) oppure la variabile ANTHROPIC_API_KEY.'),
        h('div', { class: 'rights__state' }, h('span', { class: 'dot' + (cl.available ? '' : ' dot--off') }), h('span', {}, cl.available ? `Claude disponibile (${cl.via === 'api' ? 'API' : 'Claude Code'})` : 'Claude non trovato su questo computer'))),
      app.api.mode === 'demo' ? section('Versione di prova',
        h('p', { class: 'prose' }, "Questa è la versione online: tutto gira nel tuo browser e le immagini restano solo qui. Higgsfield è simulato e la ricerca negli archivi passa da un piccolo servizio di Netlify. La versione completa, con il tuo archivio, l'esportazione TIFF a 16 bit e Higgsfield vero, si avvia sul Mac."),
        h('button', { class: 'btn btn--quiet', onclick: async () => { if (confirm('Cancellare tutti i dati della versione di prova in questo browser?')) { await app.api.reset?.(); location.reload(); } } }, 'Azzera i dati della prova')) : null,
      lan ? section('Apri su iPhone',
        lan.urls?.length ? h('div', { class: 'qr-row' },
          h('div', { class: 'qr', html: lan.qr || '' }),
          h('div', { class: 'stack' },
            h('p', { class: 'prose' }, "Con iPhone e Mac sulla stessa rete Wi-Fi, inquadra il codice con la Fotocamera. Si apre ATELIER in Safari: tocca Condividi → Aggiungi alla schermata Home per averlo come un'app."),
            h('p', { class: 'meta' }, 'Il codice contiene una chiave personale: senza, nessun altro sulla rete può aprire il tuo archivio.'),
            lan.urls.map((u) => h('code', { class: 'meta', style: { wordBreak: 'break-all' } }, u.replace(/chiave=.*/, 'chiave=…'))))) : h('p', { class: 'prose muted' }, lan.note || 'Nessuna rete trovata.')) : null,
      section('Dati',
        h('dl', { class: 'dl' },
          h('dt', {}, 'Cartella'), h('dd', { class: 'meta' }, st.dataDir || (app.api.mode === 'demo' ? 'memoria del browser' : '—')),
          h('dt', {}, 'Archivio'), h('dd', {}, `${st.counts?.assets ?? '—'} immagini, ${st.counts?.experiments ?? '—'} esperimenti`),
          h('dt', {}, 'Versione'), h('dd', { class: 'meta' }, st.version || '—')),
        st.platform === 'darwin' ? h('button', { class: 'btn', onclick: () => app.api.reveal(st.dataDir + '/export') }, 'Apri la cartella delle esportazioni') : null,
        h('p', { class: 'prose muted' }, 'Gli originali non vengono mai modificati. Le varianti sono PNG senza perdita. Tutto è in un database JSON leggibile, insieme alle cartelle delle immagini: per fare un backup basta copiare la cartella.')));
  },
};

function section(title, ...children) {
  return h('section', { class: 'settings__sec' }, h('div', { class: 'label' }, title), ...children);
}
