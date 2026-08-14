# MAZZO

*una giornata qualsiasi*

Mini RPG narrativo da giocare nel browser, circa sette minuti. Visuale
dall'alto, pixel art piccola, estate italiana addosso.

Mazzo si sveglia con quaranta gradi in casa, fa il suo turno da cameriere e
poi esce a ritirare una busta. Cosa ci sia dentro non si sa e non si chiede.

Tre livelli:

1. **FA CALDO.** — la camera. Trovare le chiavi, uscire. (~2 min)
2. **IL TURNO** — il locale. Tre mansioni, poi un messaggio. (~3 min)
3. **LA BUSTA** — la strada, di sera. Arrivare in fondo. (~2 min)

Tutto è originale e generato dal codice: sprite, tile, interfaccia, suoni.
Nessun file grafico o audio, nessuna dipendenza a runtime, nessuna rete.

## Comandi

| | |
|---|---|
| WASD / frecce | camminare |
| E / Spazio / Invio | interagire, mandare avanti i dialoghi |
| M | audio on/off |

Su schermi touch compaiono da soli il pad direzionale e il tasto **E**.

## Avvio

```bash
cd mazzo
npm install
npm run dev        # http://127.0.0.1:5174
```

Versione ottimizzata:

```bash
npm run build      # controllo dei tipi + bundle in dist/
npm run preview
```

Pagina in file unico (tutto incorporato, funziona anche offline o da disco):

```bash
npm run build:page # dist/mazzo.html + dist/artifact.html
```

## Prove

```bash
npm test           # mappe e progressione + partita intera in Chromium
npm run test:dist  # le stesse prove sulla build di produzione
npm run shots      # screenshot delle tre mappe in screenshots/mappe
```

`tools/test-maps.mjs` controlla la forma delle mappe, la corrispondenza fra
oggetti e tessere, l'ordine delle tre mansioni e lo stato finale.
`tools/test.mjs` gioca davvero la partita dall'inizio alla fine con un browser
vero: titolo → camera → locale → strada → busta → finale → rigioca.

Durante lo sviluppo si può aprire un livello a parte con `#room`, `#bar`,
`#street` in fondo all'indirizzo.

## Online

Il gioco è pubblicato come pagina autonoma:
<https://claude.ai/code/artifact/6ceb3b01-fece-4d79-8f82-7cbdb16f6c92>

Con il ramo principale, il flusso di GitHub Pages già presente nel repository
pubblica MAZZO anche sotto `/mazzo/`.

## Com'è fatto

```
src/
  engine/    ciclo di gioco, input, renderer, audio, dissolvenze
  gfx/       palette, font bitmap, sprite dei personaggi, tileset
  entities/  Mazzo e i personaggi fermi
  systems/   stato, micro-linguaggio dei dialoghi, esecutore
  world/     tipi delle mappe e le tre mappe
  scenes/    titolo, mondo, finale
  ui/        riquadro dei dialoghi, obiettivo, scritte
```

Niente motore esterno: uno schermo virtuale 240×160 ingrandito a numeri interi
con `image-rendering: pixelated`, passo logico fisso a 60 Hz. Il bundle sta in
circa 48 kB (17 kB compressi).

Lo stato del gioco è fatto di pochi flag (`hasKeys`, `task1..3`,
`receivedEnvelope`): non c'è inventario, non ci sono statistiche, non ci sono
combattimenti. Si cammina, si guarda, si porta una cosa da una parte all'altra.
