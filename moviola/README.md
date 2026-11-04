# MOVIOLA

Laboratorio locale di video astratti sperimentali, da 1 a 30 secondi, fino a
4K a 24 o 30 fps, senza suono, per DaVinci Resolve. Gemella di ATELIER ma
indipendente: archivio, server e porta sono suoi. Tutto gira sul Mac, nessun
servizio a pagamento.

## Avvio sul Mac

Serve Node 20 o più recente e ffmpeg:

```sh
brew install node ffmpeg
cd misterybox/moviola
npm start
```

Poi apri **http://localhost:5174**. L'archivio sta in `moviola/dati/`, i video
finiti in `~/Movies/MOVIOLA/` (si cambia in `dati/config.json`, voce `outDir`).

## Dall'iPhone

iPhone e Mac sulla stessa rete Wi‑Fi. Sul Mac apri **05 Esporta** e inquadra il
QR con la fotocamera dell'iPhone: il link contiene una chiave, chi non ce l'ha
non entra. Dall'iPhone si lavora su tutto; il render 4K lo fa il Mac. Con
«Manda al Mac» il lavoro va in coda, e il Mac lo esegue quando in Esporta è
accesa «Stazione di render».

## L'interlocutore

Legge la clip (misura movimento, sfarfallio, densità, contrasto, colore, la
cucitura del loop) e propone ipotesi da provare come rami. Usa, in ordine:

1. `ANTHROPIC_API_KEY` nell'ambiente, se c'è;
2. Claude Code (`claude`) installato sul Mac, con il tuo abbonamento;
3. regole locali, sempre disponibili.

## Come si lavora

- **01 Archivio**: immagini e video importati (file, link, trascinamento), con
  provenienza e diritti. Un esperimento nasce da una delle nove partenze o da
  zero.
- **02 Banco**: la catena di processi, il carattere del movimento (fermo,
  contemplativo, ritmico, caotico), le chiavi ◆ sulla timeline, il seme.
  «Provino ×6» mostra sei variazioni in movimento: segni quelle che meritano e
  diventano rami.
- **03 Laboratorio**: l'albero delle versioni, il confronto A/B dal vivo,
  affiancate o a tendina. Solo tu dichiari finita una versione (tieni premuto),
  e puoi sempre riaprirla.
- **04 Dal vivo**: la clip come strumento. Il quadro è un pad XY, i tasti 1–9
  accendono i processi, R registra un giro che diventa chiavi.
- **05 Esporta**: ProRes 422 HQ, ProRes 4444 XQ, sequenze PNG o TIFF a 16 bit,
  H.264 per vedere al volo. Accanto a ogni file un `.json` con tutti i parametri
  per rifare esattamente la stessa clip. Colore Rec.709.

Tasti: `1`–`5` schermate, `I` interlocutore, `spazio` riproduci, `←` `→`
fotogrammi, `S` salva versione.

## Senza Mac

Aperta senza server (per esempio la pagina demo), MOVIOLA salva nel browser ed
esporta PNG 16 bit in uno zip o WebM. Utile per provare; il lavoro vero si fa
con il server.

## Controllo

```sh
npm run check
```

Controlla la sintassi di ogni file, che gli import si risolvano e le parti pure
del motore. I fogli `tools/engine-sheet.html` e `tools/recipe-sheet.html`
mostrano tutti i processi e tutte le partenze per il controllo visivo.

Il piano completo è in [PIANO.md](PIANO.md).
