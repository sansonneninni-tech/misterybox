# MOVIOLA — piano tecnico

Laboratorio locale per video astratti sperimentali. Applicazione gemella di
ATELIER ma **indipendente**: cartella sua, archivio suo, server suo, porta sua.
Condivide solo la grafica (copia del design system di ATELIER in `design/`).

## Le risposte di ninni, tradotte in requisiti

| # | Risposta | Cosa diventa |
|---|----------|--------------|
| 1 | astrazione: tutte | quattro famiglie di processi: materica, geometrica, glitch/digitale, luce |
| 2 | Brakhage, McLaren, Len Lye, Ikeda, Viola, Clipson | processi dedicati: Graffio (pellicola graffiata e dipinta), Moiré (interferenze), Dati (barre binarie), Fessura (tempo spostato), Sovrimpressione (strati alla Clipson) |
| 3 | da zero, da immagine, da video | ogni clip ha 0..n sorgenti; i generatori non ne hanno bisogno |
| 4 | movimento scelto da me | selettore *fermo / contemplativo / ritmico / caotico* + velocità + tempo in BPM + chiavi sulla timeline |
| 5 | pura esperienza visiva | nessun testo, titolo o racconto nel video |
| 6 | da 1 a 30 secondi | durata da 1 a 30 s, opzione loop chiuso |
| 7 | più formati | 16:9, 9:16, 1:1, 4:5, 2.39:1, 4:3 |
| 8 | 4K, 24 e 30 fps | 3840 sul lato lungo (UHD 3840×2160 per il 16:9), 24 o 30 fps; anteprima veloce a risoluzione ridotta |
| 9 | DaVinci | ProRes 422 HQ, ProRes 4444 XQ, sequenze PNG/TIFF 16 bit, più `.json` con tutti i parametri |
| 10 | niente suono | nessuna traccia audio nei file |
| 12 | motori locali gratuiti | tutto gira sul Mac (WebGL2 + ffmpeg); nessun servizio a pagamento |
| 13 | timeline: un po' | chiavi per parametro (◆) su una timeline semplice, niente montaggio multitraccia |
| 14 | tempo reale a scelta | modalità *Dal vivo*: tutto schermo, pad XY, tasti, stroboscopio; la performance si registra e diventa chiavi da renderizzare in 4K |
| 15 | app separata | archivio suo in `moviola/dati/` |
| 16 | stessa grafica | stesso design system, stessa camera oscura |
| 17 | iPhone e Mac | layout iPhone, tocco, il Mac serve l'app in rete locale con chiave |
| 18 | Claude come su ATELIER | interlocutore critico che misura il movimento e propone direzioni, anche in disaccordo |
| 19 | cronologia e rami | ogni salvataggio è una versione; le versioni formano un albero |
| 20 | MacBook Pro M2 Pro | anteprima in tempo reale a 1080p, render 4K fotogramma per fotogramma (non in tempo reale, ma esatto) |

## Architettura

```
moviola/
  server/        Node 20+, nessuna dipendenza: file statici, archivio JSON,
                 upload, import da URL, render con ffmpeg, interlocutore
  web/           interfaccia senza build (moduli ES)
    engine/      motore video: WebGL2, processi GLSL, movimento, render
    ui/          schermate
  design/        copia del design system di ATELIER + moviola.css
  dati/          archivio locale (escluso da git)
  tools/         test, controllo grafico, pagina demo autonoma
```

### Motore (nel browser, WebGL2)

- Una **clip** è: formato (proporzione, lato lungo, fps, durata, loop),
  sorgenti, una **catena di processi**, il carattere del movimento, le chiavi,
  un seme.
- Ogni processo è un passaggio GLSL a pieno schermo. Riceve l'uscita del
  passaggio precedente, la sorgente, la propria uscita al fotogramma prima
  (per la retroazione) e, se serve, una memoria degli ultimi fotogrammi (per
  fessura e sovrimpressione).
- Buffer in virgola mobile a 16 bit quando la scheda lo permette: i gradienti
  restano lisci fino al 10/12 bit del ProRes.
- Il rumore è **periodico nel tempo**: con il loop attivo l'ultimo fotogramma
  si chiude sul primo. I processi a retroazione non possono garantirlo, e
  l'interfaccia lo dice.
- **Deterministico**: stesso seme e stessi parametri danno gli stessi
  fotogrammi. Il render riparte sempre dal fotogramma 0.

### Processi (tutti locali e gratuiti)

| Codice | Nome | Famiglia | Idea |
|-------|------|----------|------|
| Ca | Campo | materica | rumore con dominio deformato: fluidi, fumi, marmi |
| Ri | Rifrazione | materica | la sorgente vista attraverso un liquido |
| Ma | Materia | materica | grana, alone, tremolio del quadro, sfarfallio di pellicola |
| Mo | Moiré | geometrica | interferenze di linee e anelli (McLaren, op art) |
| Ce | Celle | geometrica | celle che si dividono e scorrono |
| Da | Dati | digitale | barre binarie e griglie stroboscopiche (Ikeda) |
| Gl | Glitch | digitale | strappi, canali separati, quantizzazione, colature |
| Dm | Datamosh | digitale | blocchi che seguono il movimento e non si aggiornano |
| Gr | Graffio | pellicola | graffi, macchie dipinte, fotogrammi singoli (Brakhage, Len Lye) |
| Lu | Luce | luce | bagliori lenti, fughe di luce |
| Rf | Retroazione | tempo | la telecamera puntata sul monitor: zoom, rotazione, deriva |
| Fe | Fessura | tempo | slit-scan: ogni riga viene da un istante diverso (Viola) |
| Sv | Sovrimpressione | tempo | strati ritardati e spostati (Clipson) |
| Mf | Metamorfosi | tempo | una sorgente si trasforma nell'altra |
| To | Tono | colore | bianco e nero, bicromia, inversione, posterizzazione |

### Movimento

Ogni parametro ha un valore base, eventuali chiavi sulla timeline e una
modulazione decisa dal carattere della clip:

- **fermo**: solo chiavi
- **contemplativo**: oscillazioni lente e lunghe
- **ritmico**: scatti a tempo (BPM), con una frazione scelta
- **caotico**: rumore e salti improvvisi

### Export per DaVinci

Il browser calcola ogni fotogramma alla risoluzione piena e lo manda al server
come RGB a 16 bit; ffmpeg lo scrive in:

- ProRes 422 HQ (10 bit) — `.mov`, il formato di lavoro consigliato
- ProRes 4444 XQ (12 bit) — `.mov`, il massimo
- sequenza PNG 16 bit o TIFF 16 bit — una cartella per clip
- H.264 — solo per una prova veloce, dichiarato come tale

Accanto al file: `.json` con sorgenti, processi, parametri, chiavi, seme,
formato e la versione dell'albero. Cartella predefinita: `~/Movies/MOVIOLA`.

Senza server (pagina demo) si esporta una sequenza PNG in `.zip` oppure un
WebM in tempo reale.

### Archivio, versioni e rami

- **Sorgenti**: immagini e video importati per trascinamento, dal selettore o
  da indirizzo web, con provenienza e diritti.
- **Esperimenti**: ogni esperimento è un albero di versioni. Salvare crea una
  versione figlia; *ramifica* parte da una versione qualsiasi.
- Stati: `materiale`, `in esame`, `scelta`, `finita`. Solo tu dichiari finita
  una clip (tieni premuto 1,2 s) e puoi sempre riaprirla.

### Interlocutore

Misura la clip campionando i fotogrammi: energia del movimento, sfarfallio,
densità, simmetria, saturazione, varietà nel tempo. Con quelle misure:

- se sul Mac c'è `claude` (Claude Code) o una `ANTHROPIC_API_KEY`, chiede a
  Claude una lettura critica, con un provino dei fotogrammi;
- altrimenti usa regole locali, sincere e non accondiscendenti.

Ogni proposta è eseguibile: *prova come ramo* crea una versione nuova.

### iPhone

Il server ascolta in rete locale con una chiave d'accesso. Su iPhone: barra
in basso, pannelli come fogli, pad XY a tocco nella modalità dal vivo. Il
render 4K dal telefono si può mandare al Mac (*stazione di render*: una
finestra del Mac aperta esegue la coda).

## Prima versione: cosa c'è

1. Archivio sorgenti ed esperimenti
2. Banco: anteprima, catena di processi, parametri, timeline con chiavi
3. Laboratorio: albero delle versioni, confronto A/B dal vivo, stati
4. Dal vivo: performance registrabile
5. Esporta: ProRes / sequenze 16 bit / .json, coda di render
6. Interlocutore

## Il corpo: Scolpire con le dita e Macro (`web/engine/corpo/`)

Valgono per ogni materia, anche per quelle nuove, senza toccarne i file.

- **Campo scolpito** (`corpo/index.js`, classe `Campo`): una texture RGBA16F
  di 512 px sul lato lungo, sempre la stessa misura in anteprima e in 4K.
  xy = spostamento (uv), z = altezza (negativa scavata), w = velocità verticale
  dei fluidi. Avanza a passi fissi di 1/120 s (120 è multiplo di 24 e 30): il
  fotogramma n è il passo 5n a 24 fps e 4n a 30 fps, quindi stesso gesto =
  stesso campo a ogni risoluzione e frequenza (verificato con l'impronta
  numerica del campo a 480, 640, 1920 e 3840 px, 24 e 30 fps). Ogni secondo
  una copia del campo per tornare indietro in fretta.
- **Gesti** (`corpo/gesti.js`): `clip.scolpire = { gesti: [{ strumento,
  dimensione, forza, pts: [[t, x, y, pressione, tenuta]] }], memoria, rilievo,
  luce }`. Coordinate della superficie, tempo della clip, nessun pixel.
- **Carattere** (`corpo/tatto.js`): tenuta, ritorno, fluido e microdettaglio
  per ogni materia; una materia nuova può dichiarare `tatto: { tenuta,
  ritorno, fluido, micro }`, altrimenti vale la sua famiglia.
- **Come le materie lo leggono**: la foto arriva già spostata (base e `SRC`),
  e dopo la catena l'impronta viene resa in luce radente (solidi) o come
  rifrazione (fluidi). Una materia che vuole rispondere a modo suo legge
  `SCULPT(uv)` nel suo GLSL.
- **Macro** (`corpo/macro.js`): con la Macro accesa `fx(uv)` riceve coordinate
  della superficie e `u_res` è la risoluzione del mondo ingrandito, quindi
  `K1080` e `PX` restano ancorati alla superficie; `IN`, `FB` e `HIST`
  leggono i buffer dello schermo passando dalla camera (`CAM_S`), con la
  parallasse data da un rilievo stimato (`u_rl`). Dopo la catena:
  microdettaglio procedurale per ottave (entrano quando sono abbastanza grandi
  sullo schermo) e messa a fuoco a raccolta pesata per area, senza lumi.
  Una materia che conosce il suo rilievo lo scrive in `FX_H` (0..1) dentro
  `fx`: la messa a fuoco usa quello invece della stima.
- **Spento non cambia nulla**: con Scolpire e Macro spenti i fotogrammi sono
  identici bit per bit a prima (verificato su cinque combinazioni di materie).
## Ricette di materia e Deriva

File propri, tocchi minimi al resto:

- `web/engine/ricette.js` (puro): una clip «in ricetta» ha `style: 'ricetta'` e
  `clip.ricetta = { id, name, chain, keys, dur, nsrc, visibili }`. `buildAny`
  sostituisce `buildClip` in Trasforma: per gli stili delega, per le ricette
  ricostruisce la catena congelata (gli id dei passaggi restano, perché decidono
  anche il movimento), adatta le sorgenti (fusione delle foto aggiunta o tolta),
  allunga le chiavi con la durata, salta le materie che mancano e lo dice, e
  mette sopra gli strati toccati dopo. `syncRicetta` rilegge la catena prima di
  ogni gesto: le regolazioni fatte nel Banco restano. Esporta e importa in un
  pacchetto `.json` (`tipo: moviola-ricette`).
- `web/engine/mutazioni.js` (puro, tranne le misure): genoma = base + strati +
  movimento + seme; `mutate` (passi proporzionali alla scala, in rapporto per i
  parametri da 0,3 a 10, peso dal `mod` o da un `peso` dichiarato; catena:
  aggiungi, scambia, togli, riordina; movimento; colore; blocchi; pellicola e
  luce solo in giù), `cross`, `probe` (stesse misure dell'interlocutore più una
  firma delle scale e del colore), `distance`, `rejectReason`, `thresholds`
  tarate sul rumore della madre (distanza da sé stessa con un altro seme).
  Tutto dal seme: `rng(seedOf(seme della deriva, generazione, tentativo))`.
- `web/ui/ricette.js`: archivio (collezione `ricette`), gruppo nella striscia
  Materie, salva, per intero, gestione.
- `web/ui/deriva.js`: un solo `Renderer` per le nove anteprime (`simFull`: le
  simulazioni alla loro misura piena anche nei provini piccoli), con la memoria
  di ogni anteprima in una `passState` sua; prove sul motore ausiliario;
  risoluzione che scende da sola se si perdono fotogrammi.
- Tocchi al resto: `flow.js` (buildAny, pannello ricetta, pulsanti, gruppo
  ricette), `renderer.js` (opzione `simFull`), `analysis.js` (esporta
  `frameStats`), `store.js` e `server/index.mjs` (collezione `ricette`),
  `index.html` e `tools/demo.mjs` (il foglio `design/ricette-deriva.css`),
  `tools/check.mjs` (chiama `tools/check-ricette-deriva.mjs`).
