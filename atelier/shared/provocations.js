// Interlocutore locale: trasforma l'analisi misurabile in osservazioni,
// tensioni, un dissenso e ipotesi di lavoro concrete (processi + parametri).
// Non giudica mai un'immagine "finita" e non si limita ad assecondare.
import { makeRng } from './image.js';

const pct = (v) => `${Math.round(v * 100)}%`;

// Mosse generali, scritte per questo laboratorio. Servono a spostare il punto di vista.
const MOVES = [
  "Togli il soggetto e lavora solo su ciò che gli stava intorno.",
  "Scegli il dettaglio che avresti scartato e rendilo l'unico protagonista.",
  "Accosta questa immagine a una che contraddice il suo tempo: un archivio dell'Ottocento, un dato satellitare.",
  "Rompi la regola che l'immagine rispetta di più, e solo quella.",
  "Lavora per sottrazione finché non resta un'ambiguità precisa.",
  "Tratta la luce come materia da spostare, non come qualcosa da correggere.",
  "Ripeti la stessa operazione tre volte: cerca il punto in cui smette di essere un effetto.",
  "Fai in modo che due scale incompatibili convivano nello stesso piano.",
  "Lascia un errore visibile e costruisci il resto intorno a lui.",
  "Cerca la versione che ti mette a disagio, non quella che ti convince.",
  "Fai entrare un'immagine scientifica o tecnica dove ti aspetti un paesaggio interiore.",
  "Riduci tutto a due masse in tensione, poi reintroduci un solo elemento leggibile.",
];

export function critique(a, context = {}) {
  const rng = makeRng(context.seed ?? Date.now());
  const obs = [], tens = [], hyp = [];

  // Osservazioni: solo ciò che si misura, detto in modo diretto.
  const tone = a.brightness < 0.3 ? 'scura, quasi sottoesposta' : a.brightness > 0.7 ? 'molto chiara, aria alta' : 'su toni medi';
  obs.push(`Immagine ${tone} (luminosità media ${pct(a.brightness)}), contrasto ${a.contrast > 0.55 ? 'forte' : a.contrast < 0.25 ? 'basso e uniforme' : 'moderato'}.`);
  if (a.clipping.shadows > 0.08) obs.push(`Il ${pct(a.clipping.shadows)} dei pixel è nero pieno: ci sono zone dove l'informazione non esiste più.`);
  if (a.clipping.highlights > 0.08) obs.push(`Il ${pct(a.clipping.highlights)} è bianco bruciato: buchi di luce che possono diventare finestre.`);
  obs.push(`Saturazione ${a.saturation < 0.15 ? 'quasi assente, la palette è ridotta a un monocromo' : a.saturation > 0.45 ? 'alta, i colori occupano la scena' : 'contenuta'}; temperatura ${a.warmth > 0.06 ? 'calda' : a.warmth < -0.06 ? 'fredda' : 'neutra'}.`);
  const cx = a.centroid.x, cy = a.centroid.y;
  const centered = Math.abs(cx - 0.5) < 0.08 && Math.abs(cy - 0.5) < 0.08;
  obs.push(centered
    ? 'Il peso visivo cade al centro: la composizione è stabile, forse troppo.'
    : `Il peso visivo è spostato ${cx < 0.42 ? 'a sinistra' : cx > 0.58 ? 'a destra' : ''}${cy < 0.42 ? ' in alto' : cy > 0.58 ? ' in basso' : ''}: c'è già uno squilibrio da sfruttare.`);
  if (a.symmetry.lr > 0.85) obs.push('Forte simmetria destra-sinistra.');
  obs.push(`Spazio quieto (zone senza dettaglio): ${pct(a.emptiness)}. Densità di bordi: ${a.edges > 0.5 ? 'alta, superficie nervosa' : a.edges < 0.18 ? 'bassa, superfici lisce' : 'media'}.`);

  // Tensioni: dove l'immagine potrebbe diventare ambigua.
  if (a.emptiness > 0.45) tens.push("Molto vuoto: il vuoto può diventare il soggetto, oppure va ferito con un frammento estraneo.");
  if (a.edges > 0.5) tens.push("Tanta informazione: la tensione nasce se la si costringe in un ordine che non le appartiene (ordinamento, griglia).");
  if (centered) tens.push("La centralità rassicura. Spostare il baricentro fuori campo creerebbe attesa.");
  if (a.saturation < 0.15) tens.push("Il quasi-monocromo regge l'atmosfera; un solo colore estraneo, piccolo, cambierebbe la lettura.");
  if (a.contrast < 0.25) tens.push("Il contrasto basso tiene tutto sullo stesso piano: si presta a sovrapposizioni dove non si capisce cosa sta davanti.");
  if (!tens.length) tens.push("L'immagine è equilibrata su quasi tutti i parametri: è proprio l'equilibrio la cosa da mettere in crisi.");

  // Ipotesi: ogni ipotesi è eseguibile con i processi locali.
  if (centered || a.symmetry.lr > 0.8) {
    hyp.push({ titolo: 'Fuori centro', descrizione: "Il soggetto viene spinto ai margini e un dettaglio periferico prende il campo.", passi: [{ processo: 'deriva', parametri: { zoom: 3 + rng() * 3, fx: rng() < 0.5 ? 0.08 : 0.92, fy: rng(), tilt: Math.round(rng() * 16 - 8) } }] });
  } else {
    hyp.push({ titolo: 'Doppio imperfetto', descrizione: "Lo squilibrio esistente viene raddoppiato da un riflesso che non coincide.", passi: [{ processo: 'riflesso', parametri: { axis: 'v', pos: Number(cx.toFixed(2)), slip: 4 + Math.round(rng() * 8) } }] });
  }
  if (a.edges > 0.35) {
    hyp.push({ titolo: 'Colatura', descrizione: "La superficie densa viene ordinata solo nei toni medi: le forme restano, la materia scivola.", passi: [{ processo: 'pixelsort', parametri: { direction: rng() < 0.6 ? 'v' : 'h', low: 50, high: 190 } }] });
  } else {
    hyp.push({ titolo: 'Geologia', descrizione: "Le superfici lisce diventano strati: una soglia instabile scava masse e silhouette.", passi: [{ processo: 'erosione', parametri: { threshold: Math.round(a.brightness * 255), wander: 60, grain: 5 } }] });
  }
  hyp.push({ titolo: 'Memoria rotta', descrizione: "Rimescolare una parte della griglia, poi separare i canali: un ricordo che non si rimette in ordine.", passi: [{ processo: 'tessere', parametri: { cols: 6 + rng.int(0, 8), rows: 4 + rng.int(0, 6), mix: 0.3 } }, { processo: 'canali', parametri: { amount: 1.2, angle: rng.int(0, 360) } }] });
  hyp.push({ titolo: 'Corpo estraneo', descrizione: "Accostala a un'immagine di un'altra epoca o disciplina (un archivio scientifico, una mappa) con un cadavere squisito a fasce irregolari.", passi: [{ processo: 'cadavere', parametri: { bands: 3 + rng.int(0, 3), seam: 6 } }], richiede: 'una seconda immagine' });

  const dissenso = context.hypothesis
    ? `Sulla tua ipotesi («${String(context.hypothesis).slice(0, 140)}»): l'immagine per ora non la sostiene del tutto. ${a.contrast < 0.3 ? "È troppo quieta per produrre tensione da sola." : centered ? "La composizione la addomestica: tutto torna al centro." : "Rischi di illustrarla invece di metterla alla prova."} Prova a fare il contrario per un ramo, solo per vedere cosa resta.`
    : `${centered ? "Questa immagine è già risolta: è un problema." : "Lo squilibrio c'è, ma sembra ancora casuale più che deciso."} Non cercherei di migliorarla: cercherei il punto in cui smette di essere riconoscibile.`;

  const domande = [
    "Che cosa deve restare riconoscibile, se qualcosa deve restarlo?",
    "Se togliessi la luce più bella, l'immagine reggerebbe?",
    "Questa immagine ti interessa per quello che mostra o per quello che nasconde?",
    "Quale parte stai proteggendo senza accorgertene?",
    "In quale punto l'ambiguità diventa confusione, per te?",
  ];

  return {
    fonte: 'locale',
    osservazioni: obs,
    tensioni: tens,
    dissenso,
    ipotesi: hyp,
    mossa: rng.pick(MOVES),
    domanda: rng.pick(domande),
  };
}

// Proposte per partire da zero, a partire da un'idea scritta.
export function proposeFromIdea(idea = '', seed = Date.now()) {
  const rng = makeRng(seed);
  const t = idea.toLowerCase();
  const out = [];
  const has = (...w) => w.some((x) => t.includes(x));
  if (has('acqua', 'mare', 'flu', 'nebbia', 'vento', 'tempo', 'movimento')) out.push({ titolo: 'Correnti', descrizione: 'Tracce che seguono un campo invisibile: il movimento senza il corpo che si muove.', passi: [{ processo: 'flusso', parametri: { particles: 6000, length: 240, turbulence: 2 + rng() * 3 } }] });
  if (has('memoria', 'archivio', 'rovina', 'frammento', 'rotto', 'crepa')) out.push({ titolo: 'Frammenti', descrizione: 'Celle irregolari separate da fratture: una superficie già rotta prima di esistere.', passi: [{ processo: 'voronoi', parametri: { cells: 40 + rng.int(0, 120), edges: 2 } }] });
  if (has('regola', 'codice', 'ordine', 'macchina', 'sistema', 'ripetizione')) out.push({ titolo: 'Regola cieca', descrizione: 'Una regola elementare produce strutture che sembrano intenzionali.', passi: [{ processo: 'automa', parametri: { rule: rng.pick([30, 45, 73, 110, 137, 150]), cell: 3 } }] });
  out.push({ titolo: 'Paesaggio senza luogo', descrizione: 'Un rumore piegato su se stesso: geologie o tessuti che non appartengono a nessun posto.', passi: [{ processo: 'rumore', parametri: { scale: 2 + rng() * 4, warp: 1.5 + rng() * 2.5 } }] });
  if (out.length < 3) out.push({ titolo: 'Fratture', descrizione: 'Lo spazio diviso in celle, ognuna una piccola stanza chiusa.', passi: [{ processo: 'voronoi', parametri: { cells: 30 + rng.int(0, 60) } }] });
  if (out.length < 4) out.push({ titolo: 'Ordine involontario', descrizione: 'Righe che nascono da una regola: un tessuto, un codice, una pioggia.', passi: [{ processo: 'automa', parametri: { rule: rng.pick([30, 90, 110, 126]), cell: 4 } }] });
  return out;
}
