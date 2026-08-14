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

## Comandi

| Tasto | Azione |
| --- | --- |
| Frecce / WASD | movimento |
| Z o Invio | conferma, parla, attacca |
| X | annulla, indietro; tenuto premuto durante il movimento = corsa |
| C | menu di gioco |
| M | musica on/off |
| F | schermo intero |

Su dispositivi touch compare automaticamente un gamepad a schermo.

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
  al centro, evoluzione.

Entrambe le suite girano in Chromium tramite Playwright, catturano screenshot
in `screenshots/` e falliscono se compare un errore in console o nel motore.

## Licenza dei contenuti

Nomi, creature, testi, mappe, musiche e grafica sono inventati per questo
progetto. Nessun contenuto proviene da opere esistenti.
