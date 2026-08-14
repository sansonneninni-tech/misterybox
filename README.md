# Verdania

Gioco di ruolo 2D originale, giocabile direttamente nel browser, ispirato
all'esperienza dei JRPG portatili dei primi anni 2000: visuale dall'alto,
mondo a tessere, creature da catturare e combattimenti a turni.

Tutta la grafica, i testi, le creature e le musiche sono originali e generati
dal codice: non viene usato alcun asset esterno.

## Avvio

```bash
npm install
npm run dev      # apre http://127.0.0.1:5173
```

Per la versione ottimizzata:

```bash
npm run build    # controllo dei tipi + bundle in dist/
npm run preview
```

## Pubblicazione

```bash
npm run build:page   # dist/index.html + dist/verdania.html (file unico)
```

`dist/verdania.html` è l'intero gioco in un solo file: nessuna richiesta di
rete, funziona aperto da disco, allegato o incorporato in un'altra pagina.

```bash
npm run check:deploy   # serve dist/ con le intestazioni di netlify.toml e prova il gioco
npm run build:drop     # dist/verdania-netlify.zip, pronto da trascinare
```

### Netlify

`netlify.toml` contiene già comando di build, cartella da pubblicare, versione
di Node, cache e intestazioni di sicurezza. Tre modi per pubblicare:

1. **Collegando il repository** — su [app.netlify.com](https://app.netlify.com)
   *Add new site → Import an existing project → GitHub → misterybox*.
   Non serve configurare nulla: legge `netlify.toml`. Ogni push aggiorna il sito.
2. **Trascinando l'archivio** — `npm run build:drop`, poi trascina
   `dist/verdania-netlify.zip` su [app.netlify.com/drop](https://app.netlify.com/drop).
   Online in pochi secondi, senza collegare il repository.
3. **Da riga di comando** — `npx netlify-cli deploy --prod --dir=dist`
   (la prima volta chiede l'accesso al tuo account).

`npm run check:deploy` verifica il pacchetto prima della pubblicazione: avvia
il gioco applicando le stesse intestazioni di `netlify.toml`, Content Security
Policy compresa, e fallisce se compare un errore o una richiesta di rete.

### GitHub Pages

Il workflow `.github/workflows/deploy.yml` pubblica `dist/` a ogni push sul
ramo principale. Va attivato una volta sola dalle impostazioni del
repository: **Settings → Pages → Source: GitHub Actions**.

La pagina ospite può riservare spazio al proprio contenuto impostando
`document.documentElement.dataset.uiReserved` (in pixel) prima dell'avvio: il
motore ne tiene conto scegliendo l'ingrandimento dello schermo.

## Comandi

| Tasto | Azione |
| --- | --- |
| Frecce / WASD | movimento |
| Z o Invio | conferma, parla, attacca |
| X | annulla, indietro; tenuto premuto durante il movimento = corsa |
| C | menu di gioco |
| M | musica on/off |
| F | schermo intero |

Su dispositivi touch compare automaticamente un gamepad a schermo: in
verticale sotto lo schermo, in orizzontale ai lati.

Lo schermo viene ingrandito di un fattore intero calcolato sui pixel fisici,
quindi resta nitido anche sui display ad alta densità.

## Come si gioca

Si comincia nella propria camera a Borgo Verzura. Dopo aver parlato con la
madre si raggiunge il laboratorio del Professor Fioravanti, che affida al
giocatore la prima creatura fra Foglietta (erba), Braciolo (fuoco) e
Gocciolo (acqua).

Da lì il mondo si apre: sei zone esterne collegate fra loro, dieci interni
visitabili, allenatori che sfidano a vista, erba alta con incontri casuali,
un bosco sorvegliato da una guardiana e una grotta salina.

Progressione tipica:

1. Borgo Verzura → laboratorio → prima creatura
2. Percorso 1 → primi allenatori e prime catture
3. Bosco Ombroso → rifugio, Guardiana Selva, Spilla del Bosco
4. Percorso 2 → Grotta Salina (facoltativa) → Porto Maree
5. Porto Maree → ultimo scontro con il rivale → epilogo sul molo

Dopo l'epilogo la regione resta esplorabile: completare il Verdex è la sfida
successiva.

## Sistemi implementati

**Esplorazione** — movimento su griglia con interpolazione fluida, collisioni,
camera che segue il protagonista, dislivelli con salto a senso unico, porte e
transizioni fra aree, oggetti raccoglibili, cartelli, NPC con comportamenti
diversi (fermi, che si guardano intorno, che passeggiano), allenatori con cono
di vista, passaggi condizionati dai progressi.

**Combattimento** — turni con priorità e velocità, danno con STAB, efficacia
di tipo, brutti colpi e variabilità, alterazioni di stato (veleno, paralisi,
scottatura, sonno, gelo), modificatori di statistiche, mosse a più colpi,
assorbimento e contraccolpo, esperienza e livelli, apprendimento di nuove
mosse (con scelta di quale dimenticare), evoluzioni animate, cattura a quattro
scosse, fuga, intelligenza avversaria che valuta l'efficacia dei tipi.

**Interfaccia** — menu di gioco, squadra con scambio di posizione, scheda
dettagliata di ogni creatura (statistiche, mosse, Verdex), borsa a categorie,
negozi con acquisto e vendita, Centro Cura, scheda allenatore, salvataggio e
caricamento su `localStorage`.

## Struttura del progetto

```
src/
  engine/     ciclo di gioco, renderer, input, audio, scene, RNG
  gfx/        palette, font bitmap, tileset, sprite personaggi e creature, UI
  data/       tipi, mosse, specie, oggetti, allenatori
  world/      formato mappe, validazione, mappe del gioco
  entities/   entità su griglia, NPC
  systems/    logica di combattimento
  state/      istanza creatura, stato della partita, salvataggio
  scenes/     titolo, mondo, battaglia, menu, squadra, borsa, negozio, Verdex
  ui/         finestra di dialogo
tools/        test end-to-end e cattura screenshot
```

### Grafica

Non ci sono file immagine: ogni tessera, sprite e glifo è disegnato pixel per
pixel all'avvio su canvas fuori schermo e poi messo in cache.

- risoluzione virtuale 240×160 con scaling intero (nessuna sfocatura)
- tessere 16×16 con dithering ordinato, varianti scelte da un hash della
  posizione e raccordi automatici fra sentieri ed erba
- personaggi 16×24 con quattro direzioni e animazione di camminata
- creature generate da una "ricetta" (forma, palette, orecchie, coda, dorso,
  zampe) in versione fronte, retro e icona

### Audio

Musiche e effetti sono sintetizzati con WebAudio: onde quadre e triangolari,
sequencer con lookahead, sei tracce (titolo, borgo, percorso, bosco,
battaglia, vittoria) e una quindicina di effetti.

## Test

```bash
npm test           # entrambe le suite
node tools/shots.mjs   # uno screenshot per mappa in screenshots/mappe/
```

- `tools/test.mjs` — validazione delle mappe (warp coerenti, NPC e oggetti su
  tessere calpestabili, cartelli raggiungibili) e partita completa: nuova
  partita, dialoghi, cambio area, scelta della creatura iniziale, menu,
  incontro casuale, combattimento, salvataggio e ricaricamento.
- `tools/test-systems.mjs` — allenatore che avvista il giocatore, cattura,
  negozio, Centro Cura, dislivelli, oggetti a terra, sconfitta con risveglio
  al centro, evoluzione, terminale di deposito, epilogo.

Aggiungendo `?seed=123` all'indirizzo il generatore casuale diventa
deterministico: utile per riprodurre una sequenza di incontri.

Entrambe le suite girano in Chromium tramite Playwright, catturano screenshot
in `screenshots/` e falliscono se compare un errore in console o nel motore.

## Licenza dei contenuti

Nomi, creature, testi, mappe, musiche e grafica sono inventati per questo
progetto. Nessun contenuto proviene da opere esistenti.
