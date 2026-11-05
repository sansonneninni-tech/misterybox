# Percorso semplice — ATELIER e MOVIOLA

Regole valide per entrambe le app. Sostituiscono il percorso a 4 passi e le 5 sezioni
di DESIGN.md dove sono in conflitto. Token e componenti restano quelli di `tokens.css`
e `components.css`.

Obiettivo: chi apre l'app per la prima volta capisce cosa fare in tre secondi, e ogni
gesto produce una risposta visibile subito.

**La semplicità viene dalla struttura, non dal togliere funzioni.** Ogni richiesta
della comanda iniziale di ATELIER e delle 20 risposte su MOVIOLA resta presente e
raggiungibile al massimo con un tocco dal passo dove serve: vedi la mappa in fondo
(sezione 8). Una funzione si può spostare, non eliminare.

## 1. Tre passi, gli stessi nomi in tutte e due le app

| Passo | ATELIER | MOVIOLA | Azione principale |
|-------|---------|---------|-------------------|
| **1 Scegli** | le foto | foto o video | `Aggiungi foto` (vuoto) → `Trasforma queste N` |
| **2 Trasforma** | applica un processo, tieni o scarta | scegli uno stile, muovilo, guarda | `Tieni questa` / `Salva` |
| **3 Salva** | TIFF/PNG/JPEG + .json per Lightroom | ProRes per DaVinci | `Salva N versioni` |

- Mac: i tre passi stanno nella barra in alto, al centro, come testo `1 Scegli · 2 Trasforma · 3 Salva`. Passo corrente bianco pieno, gli altri grigi, cliccabili.
- iPhone: niente barra a schede in basso. In alto una riga sola, `Passo 2 di 3 · Trasforma`, con `‹` per tornare. In basso, fisso sopra l'indicatore Home, il pulsante principale a tutta larghezza (altezza 52px, `safe-area-inset-bottom`).
- Le vecchie sezioni (Archivio, Tela, Laboratorio, Da zero, Esporta, Sistema) spariscono come voci. "Da zero" diventa un link secondario sotto il pulsante del passo 1: `oppure parti da zero`.

## 2. Un solo pulsante pieno per schermata, con verbo e numero

- Testo sempre verbo + oggetto + quantità: `Trasforma queste 3`, `Tieni questa`, `Salva 2 versioni`. Mai "Avanti", "OK", "Procedi".
- Se non si può premere, resta visibile ma grigio, con sotto il motivo in chiaro: `Scegli almeno una foto`.
- Durante il lavoro il pulsante stesso mostra l'avanzamento (barra sottile dentro il bordo + `Sto trasformando… 2 di 3`). Non si apre nessun pannello sopra.

## 3. Ogni gesto risponde entro un attimo, e si vede dove

- **Caricamento**: la foto compare subito in cima alla griglia con un bordo bianco per 2 secondi, già selezionata. Toast in basso: `3 foto aggiunte · Annulla`. Il pulsante diventa `Trasforma queste 3`. Nessun foglio o dettaglio si apre da solo.
- **Rilascio di file**: su Mac tutta la finestra accetta il trascinamento (mai il browser che apre il file). Mentre trascini, velo con scritto `Rilascia per aggiungere`.
- **iPhone**: il pulsante `Aggiungi foto` apre direttamente il selettore di Foto (`accept="image/*"` e, in MOVIOLA, `image/*,video/*`, `multiple`).
- **Errore**: frase che dice cosa fare, sul punto dove è successo: `Questo file è un HEIC che il browser non legge. Esportalo come JPEG e riprova.`
- **MOVIOLA**: se ci sono foto caricate, l'anteprima le usa subito, e lo dice: in alto sull'anteprima `Sta usando: 3 foto`. Se uno stile non usa le foto (puramente generativo), è scritto sulla sua miniatura: `non usa le tue foto`. Non deve mai succedere che le foto sembrino ignorate.

## 4. Il passo Trasforma: l'immagine al centro, le scelte come immagini

- Anteprima grande al centro (iPhone: tutta la larghezza, sopra).
- Sotto, una striscia di 4–6 miniature: ognuna è **la tua foto già trasformata** da quel processo/stile, con un nome in italiano semplice (`Piega`, `Fessura`, `Deriva`…). Tocco = applicato all'anteprima. Niente elenchi di testo.
- Un solo cursore visibile: `Intensità`. Accanto: `Un'altra versione` (cambia il seme). Tutti gli altri parametri, la catena di processi, i fotogrammi chiave stanno in `Avanzato`, chiuso.
- Due pulsanti per decidere: `Tieni questa` (pieno) e `Scarta` (vuoto). Le tenute si accumulano in una striscia piccola con il contatore `Tenute: 2`. Il rosso `--mark` resta per ciò che tieni.
- "Provino: 6 variazioni" resta, ma come pulsante secondario `Mostrami 6 versioni`, che apre il foglio e torna qui.

## 5. Cosa sta un tocco più in là (mai eliminato)

In `Dettagli` (sulla foto o sulla versione) o `Avanzato` (nel passo), chiusi di
default ma sempre con un'etichetta visibile: modifica di provenienza e diritti,
cronologia completa e albero delle versioni, stati `materiale / in esame`, tutti i
parametri, catena di processi, fotogrammi chiave, scorciatoie, pagina Sistema.

Restano invece **in vista**, perché sono il cuore della comanda: il commento critico
di Claude (sezione 4b), la riga di provenienza/diritti su ogni foto, l'accesso agli
archivi nel passo 1, la partenza da zero, `Parti da questa` e `Confronta` sulle tenute,
e la voce Higgsfield con il suo costo.

"Dichiara finita" esce dal flusso principale e vive solo nel passo 3, come casella
accanto a ogni versione: `Questa è finita`. L'opera è finita solo se lo dici tu.

## 4b. Il collaboratore critico resta in vista

Sotto l'anteprima del passo Trasforma, una riga fissa `Claude:` con un commento breve
e non accondiscendente sull'immagine corrente (misure + ipotesi), e due link:
`Proponi una direzione` e `Discuti`. `Discuti` apre la conversazione completa.
In MOVIOLA lo stesso, sul movimento e sul ritmo.

## 6. Pagamenti: visibili, mai automatici

ATELIER: Higgsfield è una miniatura tra i processi del passo Trasforma, segnata
`a pagamento · 6 crediti`, senza anteprima automatica. Il tocco apre sempre il dialog
del costo (totale, modello, saldo prima/dopo) e parte solo con la conferma esplicita.
MOVIOLA: solo motori locali gratuiti, come chiesto; nessuna voce a pagamento.

## 7. Parole

Italiano semplice, frasi intere, nessun termine tecnico in prima vista:
`seme` → `versione`, `nodo` → `versione`, `sidecar .json` → `scheda con le informazioni`,
`render` → `salva il video`, `ramifica` → `parti da questa`.

## Verifica (per entrambe)

Prova come un primo utente, su iPhone 14 (390×844) e Mac (1440×900):
1. Apri: capisci in 3 secondi cosa fare? Un solo pulsante pieno?
2. Carica 3 foto: le vedi subito, selezionate, con il toast e il pulsante aggiornato?
3. Trasforma: l'anteprima cambia al primo tocco? (MOVIOLA: le tue foto sono nell'anteprima?)
4. Tieni 2, salva: il file esce con il nome e la risoluzione dichiarati?
5. Nessuno scorrimento orizzontale, nessun bersaglio sotto i 44px, nessun pannello che si apre da solo.

## 8. Mappa dei requisiti: dove sta ogni cosa

### ATELIER (comanda iniziale)

| Richiesta | Dove sta nel percorso semplice |
|-----------|--------------------------------|
| Import con trascinamento e URL | Passo 1: `Aggiungi foto` (selettore / trascina ovunque) + campo `Incolla un indirizzo` sotto |
| Molti archivi dentro l'app, senza uscire | Passo 1, seconda scheda in vista: `Le tue foto · Cerca negli archivi` |
| Archivio con miniature, tag, provenienza, diritti | Passo 1: griglia; sotto ogni miniatura riga `provenienza · diritti`; filtro tag in alto; modifica in `Dettagli` |
| Affiancare e combinare immagini | Passo 1 seleziona più foto → passo 2 le mostra affiancate; processi di combinazione (`Innesto`, `Rimescola`…) tra le miniature |
| Analisi visiva e proposte sperimentali | Passo 2: riga `Claude:` con misure e ipotesi, `Proponi una direzione` (4b) |
| Collaboratore critico, non accondiscendente | Passo 2: `Discuti`; il dissenso è dichiarato nella riga `Claude:` |
| Varianti Higgsfield con approvazione del costo | Passo 2: miniatura `a pagamento`, dialog del costo obbligatorio (6) |
| Partire da zero (idea, AI, algoritmo) | Passo 1: `oppure parti da zero` → ipotesi scritta + tre strade, poi passo 2 |
| Varianti compositive, non solo estetiche | Passo 2: i processi in miniatura sono compositivi (piega, fessura, innesto, deriva…); `Mostrami 6 versioni` |
| Confronto tra varianti | Passo 2: `Confronta` sulle tenute (A/B trascinabile) |
| Ramificare gli esperimenti | Passo 2: `Parti da questa` su ogni tenuta; albero in `Dettagli › Versioni` |
| Salvare sorgenti, esperimenti, cronologia | Automatico; `Dettagli › Cronologia`; scritto nel `.json` |
| Export alla massima qualità per Lightroom | Passo 3: TIFF 16 bit / PNG 16 bit / JPEG, risoluzione reale dichiarata, `.json` accanto |
| L'opera è finita solo se lo dici tu | Passo 3: `Questa è finita`, gesto esplicito, sempre riapribile |
| iPhone e Mac | Tutto il percorso, con la verifica in fondo |
| Mai generazioni a pagamento senza consenso | Sezione 6 |

### MOVIOLA (le 20 risposte)

| # | Risposta | Dove sta |
|---|----------|----------|
| 1 | Astrazione di ogni tipo | Passo 2: stili di famiglie diverse in miniatura; tutti gli altri in `Tutti gli stili` |
| 2 | Brakhage, McLaren, Len Lye, Ikeda, Viola, Clipson | Passo 2: ogni miniatura indica a chi si ispira; `Claude:` cita i riferimenti |
| 3 | Da zero, da immagine o da video | Passo 1: `Aggiungi foto o video` + `oppure parti da zero` |
| 4 | Il movimento lo sceglie lui | Passo 2: controllo `Movimento` in vista accanto a `Intensità` (direzione/velocità), chiavi in `Avanzato` |
| 5 | Pura esperienza visiva | Nessun testo/narrazione nel video |
| 6 | Durata 1–30 s | Passo 3 (e anteprima): `Durata` da 1 a 30 s in vista |
| 7 | Più formati selezionabili | Passo 3: scelta formato (16:9, 9:16, 1:1, 4:5, 2.39:1…) in vista |
| 8 | 4K, 24 e 30 fps | Passo 3: `4K` e `24 / 30 fps` in vista |
| 9 | Finisce su DaVinci | Passo 3: ProRes 422 HQ / 4444 XQ, sequenza PNG/TIFF 16 bit, `.json` |
| 10–11 | Niente suono | Nessuna traccia audio, né importata né generata |
| 12 | Solo motori locali gratuiti | Nessuna voce a pagamento |
| 13 | Timeline "un po'" | Passo 2: striscia del tempo semplice sotto l'anteprima; chiavi in `Avanzato` |
| 14 | Tempo reale se lo sceglie | Passo 2: interruttore `Anteprima dal vivo` in vista |
| 15 | App separata | MOVIOLA resta un'app a sé |
| 16 | Stessa grafica di ATELIER | Stessi token, componenti e percorso |
| 17 | iPhone e Mac | Verifica in fondo |
| 18 | Claude critico come in ATELIER | Passo 2: riga `Claude:` + `Discuti` (4b) |
| 19 | Cronologia e rami | `Parti da questa`, `Confronta`, `Dettagli › Cronologia` |
| 20 | MacBook Pro M2 Pro | Render 4K locale tarato su M2 Pro |

La domanda 11 ("tracce tue o audio generato?") è superata dalla risposta 10: niente suono.

Verifica aggiuntiva: per ogni riga di queste due tabelle, aprire l'app e raggiungere la
funzione in al massimo un tocco dal passo indicato. Se una riga non si raggiunge, è un
errore da correggere.
