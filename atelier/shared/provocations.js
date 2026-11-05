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
// L'idea decide davvero: i temi riconosciuti scelgono i processi, il testo
// stesso fa da seme (stessa idea, stessa immagine), e la prima proposta
// cerca le parole dell'idea negli archivi del mondo.
const THEMES = [
  { id: 'acqua', nome: 'acqua', w: ['acqua', 'mare', 'onda', 'fium', 'piogg', 'lago', 'liquid', 'nuot', 'bagn', 'lacrim', 'ghiacc', 'neve', 'sale'],
    make: (r) => ({ titolo: 'Correnti lente', descrizione: 'Tracce lunghe che seguono un campo invisibile, come acqua che non si vede.', passi: [{ processo: 'flusso', parametri: { particles: 7000, length: 420, turbulence: 1 + r() * 1.5, ground: 'light' } }] }) },
  { id: 'aria', nome: 'aria e movimento', w: ['vento', 'aria', 'volo', 'vola', 'ali', 'uccell', 'fumo', 'nebbia', 'nuvol', 'cielo', 'tempo', 'cors', 'moviment', 'danz', 'fuga', 'viaggi'],
    make: (r) => ({ titolo: 'Turbine', descrizione: 'Molte tracce corte e agitate: il movimento senza il corpo che si muove.', passi: [{ processo: 'flusso', parametri: { particles: 12000, length: 90, turbulence: 6 + r() * 5 } }] }) },
  { id: 'frattura', nome: 'memoria e frattura', w: ['memori', 'ricord', 'rovin', 'framment', 'rott', 'crep', 'spezz', 'vetr', 'specch', 'archivi', 'ferit', 'cicatric', 'passat', 'perdit'],
    make: (r) => ({ titolo: 'Frammenti', descrizione: 'Una superficie già rotta prima di esistere: celle irregolari separate da fratture.', passi: [{ processo: 'voronoi', parametri: { cells: 40 + Math.round(r() * 140), edges: 2, displace: 8 + r() * 10 } }] }) },
  { id: 'regola', nome: 'regola e costruzione', w: ['regol', 'codic', 'ordin', 'macchin', 'sistem', 'ripet', 'grigli', 'citt', 'palazz', 'strad', 'finestr', 'tessut', 'tram', 'numer', 'calcol'],
    make: (r) => ({ titolo: 'Regola cieca', descrizione: 'Una regola elementare che produce strutture che sembrano volute.', passi: [{ processo: 'automa', parametri: { rule: [30, 45, 73, 110, 137, 150][Math.floor(r() * 6)], cell: 3, density: 0.2 + r() * 0.6 } }] }) },
  { id: 'corpo', nome: 'corpo, animale, cosa viva', w: ['corp', 'pell', 'pelo', 'pelliccia', 'gatt', 'cane', 'cani', 'animal', 'besti', 'carn', 'occhi', 'mano', 'mani', 'volt', 'viso', 'sangu', 'oss', 'cuor', 'fior', 'fogli', 'alber', 'radic', 'bosc', 'erba', 'sem', 'uov', 'insett', 'lupo', 'cavall', 'pesc', 'serpent', 'piuma'],
    make: (r) => ({ titolo: 'Pelle senza corpo', descrizione: 'Un rumore fitto e torto su se stesso: pelliccia, tessuto, epidermide di qualcosa che non c\'è.', passi: [{ processo: 'rumore', parametri: { scale: 8 + r() * 8, warp: 3.5 + r() * 2.5, octaves: 7, bands: 0 } }] }) },
  { id: 'notte', nome: 'notte, sogno, assenza', w: ['nott', 'buio', 'ombr', 'sogn', 'sonn', 'mort', 'lutt', 'vuot', 'silenz', 'assenz', 'luna', 'stell', 'paur', 'solitud', 'nero'],
    make: (r) => ({ titolo: 'Strati di buio', descrizione: 'Un rumore lento diviso in pochi strati: un paesaggio che si vede appena.', passi: [{ processo: 'rumore', parametri: { scale: 1.2 + r() * 1.5, warp: 1 + r(), octaves: 4, bands: 3 + Math.round(r() * 3) } }] }) },
  { id: 'luce', nome: 'luce e calore', w: ['luce', 'sole', 'fuoc', 'bianc', 'alba', 'calor', 'estat', 'oro', 'fiamm', 'lampo'],
    make: (r) => ({ titolo: 'Bagliore', descrizione: 'Molti strati sottili, come luce che brucia una superficie.', passi: [{ processo: 'rumore', parametri: { scale: 3 + r() * 3, warp: 2 + r() * 2, octaves: 6, bands: 9 + Math.round(r() * 3) } }] }) },
];
const STOP = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'e', 'o', 'che', 'del', 'della', 'dei', 'delle', 'nel', 'nella', 'al', 'alla', 'non', 'come', 'è', 'mi', 'si', 'ci', 'ma', 'se']);
export function ideaSeed(idea = '') { let x = 2166136261; for (const c of idea.trim().toLowerCase()) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619) >>> 0; } return x; }
export function ideaWords(idea = '') { return idea.toLowerCase().replace(/[^\p{L}\s']/gu, ' ').split(/[\s']+/).filter((w) => w.length > 2 && !STOP.has(w)); }

export function proposeFromIdea(idea = '') {
  const text = idea.trim();
  const words = ideaWords(text);
  const seed = ideaSeed(text);
  const rng = makeRng(seed);
  const out = [];
  const q = `«${text.length > 40 ? text.slice(0, 40) + '…' : text}»`;
  if (words.length) {
    const query = words.slice(0, 3).join(' ');
    out.push({ titolo: `Cerca «${query}» nei musei`, tipo: 'archivi', cerca: query,
      descrizione: 'Cerco le parole della tua idea negli archivi del mondo, prendo due immagini da archivi diversi e le accosto. Poi le trasformi.',
      perche: `La tua idea diventa una ricerca vera: le immagini trovate parlano di «${query}». Restano tra le tue foto, con autore e licenza.` });
  }
  const hits = THEMES.map((t) => ({ t, w: words.filter((w) => t.w.some((s) => w.startsWith(s))) })).filter((x) => x.w.length);
  for (const { t, w } of hits.slice(0, 3)) out.push({ ...t.make(rng), seme: seed, perche: `Da «${w.join(', ')}» leggo ${t.nome}.` });
  if (!hits.length) {
    const pick = THEMES[seed % THEMES.length];
    out.push({ ...pick.make(rng), seme: seed, perche: text ? `Nelle parole di ${q} non riconosco un tema: la scelta e i parametri vengono dal testo stesso, quindi la stessa idea dà sempre la stessa immagine. È un punto di partenza, non un'illustrazione.` : 'Senza un\'idea scelgo io un punto di partenza. Scrivi qualcosa e le proposte cambiano.' });
    const other = THEMES[(seed >> 3) % THEMES.length] === pick ? THEMES[(seed + 1) % THEMES.length] : THEMES[(seed >> 3) % THEMES.length];
    out.push({ ...other.make(rng), seme: seed + 1, perche: 'Una seconda strada, opposta alla prima, dallo stesso testo.' });
  }
  if (text) out.push({ titolo: 'Con l\'intelligenza artificiale', tipo: 'ai', prompt: `${text}. Ambiguous, raw, unresolved image; no stock-photo polish, no glossy AI look, no centered hero subject.`,
    descrizione: 'Higgsfield parte dal testo della tua idea. È a pagamento: prima vedi il costo e parte solo se lo approvi.',
    perche: 'Qui l\'idea arriva così com\'è al modello generativo.' });
  return out;
}
