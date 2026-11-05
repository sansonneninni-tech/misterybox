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

## Come si lavora: tre passi

In alto, sempre: **1 Scegli · 2 Trasforma · 3 Salva**. Su iPhone una riga sola
(«Passo 2 di 3 · Trasforma», con ‹ per tornare) e il pulsante principale in basso.

1. **Scegli**: «Aggiungi foto o video» (rullino, file o trascinando sulla finestra),
   fino a 4. Oppure «parti da zero, senza foto».
2. **Trasforma**: l'anteprima usa subito le tue foto e lo dice («Sta usando: 2 foto»).
   Sotto, gli stili come miniature delle tue foto già trasformate, ognuno con il
   riferimento a cui si ispira. Intensità, Movimento, durata, proporzioni, fps,
   «Un'altra versione», «Mostrami 6 versioni», «Anteprima dal vivo», la riga di
   Claude con «Discuti». «Tieni questa» mette da parte la versione; tocca una tenuta
   per ripartire da lì, «Confronta» per l'A/B.
3. **Salva**: ProRes 422 HQ o 4444 XQ, sequenze PNG o TIFF 16 bit, 4K, 24 o 30 fps,
   durata e proporzioni, con la scheda `.json` accanto. «Questa è finita» la spunti
   solo tu, e puoi sempre toglierla.

**Avanzato** (in alto a destra): regolazioni fini con catena e chiavi sulla timeline,
versioni e confronto, dal vivo, interlocutore, archivio completo con provenienza e
diritti, tutte le opzioni di salvataggio.

## Dove sta ogni risposta delle 20 domande

| # | Risposta | Dove sta |
|---|----------|----------|
| 1 | Astrazione di ogni tipo | Passo 2: nove stili di famiglie diverse; Avanzato: 16 processi da combinare |
| 2 | Brakhage, McLaren, Len Lye, Ikeda, Viola, Clipson | Passo 2: ogni miniatura dice a chi si ispira |
| 3 | Da zero, da immagine o da video | Passo 1: «Aggiungi foto o video» e «parti da zero» |
| 4 | Il movimento lo sceglie lui | Passo 2: Movimento (Fermo, Lento, A tempo con bpm, Caotico) e Intensità in vista; chiavi in Avanzato |
| 5 | Pura esperienza visiva | Nessun testo nel video |
| 6 | Da 1 a 30 secondi | Passo 2 e passo 3: Durata 1, 3, 5, 8, 15, 30 s (in Avanzato qualsiasi valore) |
| 7 | Più formati | Passo 2 e 3: 16:9, 9:16, 1:1, 4:5, 2.39:1, 4:3 |
| 8 | 4K, 24 e 30 fps | Passo 3: 4K e 24/30 in vista |
| 9 | DaVinci | Passo 3: ProRes 422 HQ / 4444 XQ, PNG/TIFF 16 bit, `.json`, Rec.709 |
| 10–11 | Niente suono | Nessuna traccia audio |
| 12 | Solo motori locali gratuiti | Tutto sul Mac, nessun servizio a pagamento |
| 13 | Timeline «un po'» | Passo 2: striscia del tempo sotto l'anteprima; chiavi in Avanzato › Regolazioni fini |
| 14 | Tempo reale se lo sceglie | Passo 2: «Anteprima dal vivo» |
| 15 | App separata | Cartella, archivio e porta suoi |
| 16 | Stessa grafica di ATELIER | Stessi token, componenti e percorso a tre passi |
| 17 | iPhone e Mac | Tutto il percorso, verificato su entrambi |
| 18 | Claude critico | Passo 2: riga «Claude:» con «Discuti» |
| 19 | Cronologia e rami | Passo 2: tenute, «tocca per ripartire», «Confronta»; Avanzato › Versioni |
| 20 | MacBook Pro M2 Pro | Render 4K locale, fotogramma per fotogramma |

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
