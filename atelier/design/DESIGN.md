# ATELIER — design

Interfaccia di un laboratorio di ricerca artistica: archivio, tela, laboratorio
delle varianti, partenza da zero, esportazione verso Lightroom. Funziona su Mac
e su iPhone (Safari, anche aggiunta alla schermata Home).

## File

| File | Cosa contiene |
|------|---------------|
| `tokens.css` | Colori, tipografia, spazi, movimento, `@font-face` dei font locali |
| `components.css` | Tutte le classi dei componenti, con le regole per il tocco e per l'iPhone nelle stesse classi |
| `fonts/` | Space Grotesk, DM Sans, DM Mono (licenza SIL OFL, da Fontsource) — nessuna rete |
| `prototype/` | Prototipo cliccabile: `index.html`, `app.js` (schermate), `processes.js` (processi locali veri, su canvas), `critic.js` (misure e interlocutore), `data.js` + `media/` (18 foto in pubblico dominio, Met Open Access CC0) |

Per provarlo: `cd atelier && python3 -m http.server 8765` e apri
`http://localhost:8765/design/prototype/`. Serve un server: aperto da disco il
browser blocca la lettura dei pixel e i processi non partono.

Tasti: `1`–`5` sezioni, `I` pannello interlocutore, `M` segna, `Esc` chiude, `⌘O` importa.

## Direzione: provino a contatto in camera oscura

Ricerca fatta su Refero (stili) partendo dai siti indicati. Riferimenti usati:

- **Fondazione — Julia Krantz** (juliakrantz.com): nero assoluto, giunture da
  1px al 12%, angoli vivi, testo a peso 300, il colore vive solo nelle foto,
  codici di due lettere in display ultraleggero sulle celle.
- **Preso da Superlative** (playsuperlative.com): un unico colore usato solo come
  indicatore funzionale, mai come decorazione o pulsante principale.
- **Preso da MONO** (mono.frm.fm): etichette maiuscole spaziate, stato attivo
  espresso con un bordo da 1px invece che con un riempimento.
- **Rifiutato**: gradienti, vetro smerigliato, pillole arrotondate, viola e
  bagliori tipici delle app di generazione AI.

## Regole

1. **Il colore è delle immagini.** L'interfaccia è nera, bianca e grigia.
2. **La matita grassa (`--mark`, rosso) segna solo te**: una selezione, un'opera
   dichiarata finita, un costo da approvare. Il sistema non la usa mai per sé.
3. **Nessuna opera è finita finché non lo dici.** Gli stati sono `materiale`,
   `in esame`, `scelta`, `finita`; solo l'ultimo richiede un gesto esplicito
   (tieni premuto, oppure conferma in due passaggi) e si può sempre riaprire.
4. **Niente si paga senza consenso.** I processi Higgsfield aprono sempre il
   dialog del costo: totale grande, modello, sorgenti, saldo prima e dopo. Parte
   solo tenendo premuto 1,2 s, o con casella + pulsante come alternativa.
5. **Grigio 18% per giudicare il colore.** Tela e laboratorio possono passare
   dal nero al grigio neutro, come in Lightroom.
6. **Onestà sulla qualità.** L'export dichiara la risoluzione reale, non
   ingrandisce in silenzio e scrive accanto un `.json` con sorgenti, diritti,
   processi, parametri e semi.
7. **L'interlocutore non asseconda.** Misura l'immagine (ambiguità, densità di
   bordi, simmetria, saturazione), propone ipotesi eseguibili e dice quando
   non è d'accordo. Nel prototipo i testi sono scritti in anticipo.

## Schermate

| Sezione | Contenuto |
|---------|-----------|
| 01 Archivio | Griglia a provino con margine "pellicola" (numero, codice, data, diritti), filtri per provenienza/diritti/tag, ricerca, import per trascinamento o indirizzo, pannello dettaglio con provenienza e diritti modificabili e cronologia |
| 02 Tela | Fino a 4 sorgenti affiancate, anteprima del risultato, processi locali con parametri, processi Higgsfield con preventivo |
| 03 Laboratorio | Albero degli esperimenti, confronto A/B trascinabile, griglia, singola; segna, scarta, metti in esame, ramifica, dichiara finita |
| 04 Da zero | Ipotesi scritta, proposte dell'interlocutore, tre strade: algoritmo locale, accostamento dall'archivio, generazione AI |
| 05 Esporta | Scelta delle versioni, TIFF 16 bit / PNG 16 bit / JPEG 100, cartella per Lightroom, anteprima del `.json` |
| Sistema | Il design system dal vivo e i link per vedere gli stati: vuoto, caricamento, errore, Higgsfield non collegato |

## iPhone

Sotto i 760px: navigazione in basso a cinque voci sopra l'indicatore Home,
pannello laterale come foglio che sale dal basso (con velo che chiude al tocco),
filtri dell'archivio in un foglio, griglia a 3 colonne, albero degli esperimenti
in una striscia orizzontale, processi scorrevoli, dialog a tutto schermo dal
basso, campi a 16px (Safari non ingrandisce), `safe-area-inset` per notch e
indicatore Home, bersagli di almeno 44px con puntatore a tocco, nessuno stato
raggiungibile solo con il passaggio del mouse.
