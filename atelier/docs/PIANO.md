# ATELIER — Piano tecnico (prima versione)

Laboratorio locale di ricerca visiva. Produce **materiale da esplorare**, non opere
finite: nessuna parte del sistema dichiara un'immagine "conclusa". Solo l'autore
può segnare un'immagine come *scelta* o *pronta per Lightroom*.

## Principi che guidano le scelte tecniche

1. **Le decisioni restano all'autore.** Nessuna azione automatica sull'archivio,
   nessuna generazione a pagamento senza conferma esplicita del costo.
2. **Tutto è tracciato.** Ogni immagine sa da dove viene (provenienza, licenza,
   autore) e ogni variante sa da quali immagini e con quale processo è nata.
3. **Modulare.** Motori generativi, archivi esterni e interlocutori critici sono
   moduli con la stessa interfaccia: se ne aggiungono altri senza toccare il resto.
4. **Locale e leggibile.** I dati sono file normali in una cartella
   (`atelier/dati/`): immagini originali intatte, varianti PNG senza perdita,
   un unico database JSON leggibile a mano.
5. **Ambiguità sopra la piacevolezza.** I processi e le proposte privilegiano
   incongruenza, frattura, ricomposizione e risultati imprevisti, non filtri estetici.

## Architettura

```
atelier/
├── server/              Node 20+ · Express · sharp
│   ├── index.js         avvio, API REST, file statici
│   ├── store.js         database JSON (scrittura atomica) + cartelle immagini
│   ├── library.js       importazione (file, URL, archivi), miniature, metadati
│   ├── archives/        ricerca negli archivi esterni (un modulo per archivio)
│   ├── engines/         motori: locale (algoritmi) · higgsfield (CLI) · simulato
│   ├── critic/          interlocutore: analisi locale · Claude (CLI o API)
│   └── export.js        esportazione TIFF/PNG/JPEG + scheda JSON della cronologia
├── shared/              codice puro usato sia dal server sia dal browser
│   ├── image.js         buffer RGBA, campionamento, utilità
│   ├── processes/       processi algoritmici (composizione, materia, combinazione, genesi)
│   ├── analysis.js      analisi visiva misurabile (luce, palette, vuoti, simmetria…)
│   └── provocations.js  generatore di ipotesi e proposte critiche
├── web/                 interfaccia, JS vanilla a moduli, nessuna build
│   ├── index.html
│   └── js/              viste, stato, client API (server reale o demo nel browser)
├── design/              direzione visiva: tokens.css, components.css, font
├── netlify/             funzione proxy per la ricerca archivi nella versione online
└── dati/                (creata al primo avvio, esclusa da git) il tuo archivio
```

### Perché questo stack

- **Node + sharp**: sharp legge praticamente qualunque formato (JPEG, PNG, TIFF,
  WebP, HEIC dove supportato), conserva i profili colore e scrive TIFF a 16 bit.
  Ha binari precompilati per Mac Intel e Apple Silicon: `npm install` e basta.
- **Frontend senza build**: si apre e si modifica senza strumenti; le stesse
  pagine funzionano in locale e nella preview online.
- **Processi in `shared/`**: lo stesso codice gira sul server (piena risoluzione)
  e nel browser (preview online), quindi la preview è fedele.

## Modello dei dati

```
Immagine (asset)
  id, file originale, larghezza, altezza, formato, miniatura
  titolo, note, tag[]
  provenienza: { tipo: upload | url | archivio | generata | algoritmo,
                 archivio, url, pagina, autore, data }
  diritti:     { licenza, url licenza, attribuzione,
                 stato: libero | con attribuzione | da verificare | riservato, note }
  scelta dall'autore: nessuna | da sviluppare | pronta per Lightroom | scartata

Esperimento
  id, titolo, ipotesi artistica, note, stato (deciso solo dall'autore)
  nodi[]: { id, genitori[] (0 = partenza da zero, 2+ = combinazione),
            immagine, operazione: { motore, processo, parametri, seme, prompt, costo },
            data, nota }
  conversazione[]: dialogo con l'interlocutore
```

Il grafo dei nodi è un albero con possibili fusioni: da qualsiasi nodo si apre un
nuovo ramo; selezionando più nodi si crea una combinazione con più genitori.

## Motori generativi

Interfaccia comune: `processi()` elenca cosa sa fare, `preventivo(richiesta)`
restituisce il costo, `esegui(richiesta, approvazione)` produce immagini.

| Motore | Costo | Note |
|---|---|---|
| **Locale** | gratis | processi algoritmici a piena risoluzione, con seme riproducibile |
| **Higgsfield** | crediti | via `higgsfield` CLI. Prima `generate cost` (gratuito), poi la conferma esplicita nell'interfaccia, poi `generate create --wait` |
| **Higgsfield simulato** | gratis | stesso flusso e stessa finestra di conferma, risultato prodotto in locale, etichettato *SIMULATO* |

**Regola di sicurezza sui costi**: il server rifiuta qualunque esecuzione
Higgsfield senza un preventivo valido emesso negli ultimi 10 minuti per
*esattamente* gli stessi parametri e senza la conferma scritta dall'autore
nella finestra del costo. Se il costo non è determinabile, l'esecuzione è bloccata.

### Processi algoritmici della prima versione

- **Composizione**: scomposizione e rimescolamento a tessere, piega a
  caleidoscopio, deriva di inquadratura (ritagli estremi), frattura radiale,
  slit-scan ondulato.
- **Materia**: ordinamento dei pixel, separazione dei canali, diffusione
  dell'errore (dithering), erosione per soglia.
- **Combinazione** (2+ immagini): cadavere squisito a bande, maschera di luce
  (un'immagine ritaglia l'altra), spostamento (A deforma B), intreccio a strisce,
  differenza.
- **Genesi** (da zero): campi di rumore frattale, campi di flusso, fratture di
  Voronoi, automi cellulari. Tutti con seme.

## Interlocutore critico

- **Analisi locale** (sempre disponibile, offline): luce, contrasto, palette
  dominante, saturazione, densità dei bordi, simmetria, baricentro visivo, vuoti.
  Da qui nascono osservazioni misurabili e proposte di processi.
- **Claude** (se disponibile): usa il `claude` CLI già installato sul Mac
  (abbonamento Claude Code, nessuna chiave) oppure `ANTHROPIC_API_KEY`. Riceve
  l'immagine, l'ipotesi dell'esperimento e la cronologia; risponde con
  osservazioni, tensioni, ipotesi alternative, proposte di processi e prompt,
  e una domanda critica. Istruzioni di sistema: non essere accondiscendente,
  evitare l'estetica AI stereotipata, non dichiarare mai un'opera conclusa.

## Archivi esterni (ricerca senza uscire dall'app)

Ricerca unificata, anteprima e importazione con provenienza e licenza
registrate automaticamente: Openverse (aggrega Flickr, musei, biblioteche),
Wikimedia Commons, Europeana, Library of Congress, Cleveland Museum of Art,
NASA, Internet Archive, Metropolitan Museum, Art Institute of Chicago.
Ogni archivio è un modulo `archives/<nome>.js` con `cerca(query, pagina)`.

## Esportazione per Lightroom

- Variante: **TIFF 16 bit** (compressione senza perdita, profilo sRGB incorporato)
  o PNG/JPEG qualità 100, alla risoluzione piena del processo.
- Originale: copia dei byte originali, nessuna ricompressione.
- Accanto, una scheda `.json` con provenienza, diritti e cronologia completa.
- Nota onesta: un TIFF a 16 bit di un'immagine nata a 8 bit non aggiunge
  informazione, ma dà più margine alle curve in Lightroom senza posterizzare.

## Interfaccia

Guscio a tre colonne: navigazione · area di lavoro · interlocutore.
Schermate: **Archivio**, **Cerca negli archivi**, **Tela** (affiancare e
combinare), **Laboratorio** (albero delle varianti, confronto A/B e griglia),
**Genesi** (partire da zero), **Esportazione**, **Impostazioni** (motori e stato).
La direzione visiva arriva da `design/` (thread dedicato al design).

## Versione online di prova

La stessa interfaccia, pubblicata su Netlify, con un "server" simulato nel
browser (IndexedDB): archivio, processi algoritmici, albero e confronto
funzionano davvero; Higgsfield è solo simulato; la ricerca negli archivi passa
da una funzione Netlify. I dati restano nel browser di chi la prova.

## Dopo la prima versione

Modelli locali (Stable Diffusion/ComfyUI via API locale), segmentazione per
collage guidati, più archivi (Rijksmuseum, Smithsonian con chiave), sincronia
con un catalogo Lightroom, ricerca per somiglianza visiva nell'archivio.
