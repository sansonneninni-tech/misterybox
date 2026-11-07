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
