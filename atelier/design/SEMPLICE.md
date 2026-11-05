# Percorso semplice — ATELIER e MOVIOLA

Regole valide per entrambe le app. Sostituiscono il percorso a 4 passi e le 5 sezioni
di DESIGN.md dove sono in conflitto. Token e componenti restano quelli di `tokens.css`
e `components.css`.

Obiettivo: chi apre l'app per la prima volta capisce cosa fare in tre secondi, e ogni
gesto produce una risposta visibile subito.

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

## 5. Cosa si nasconde (non si cancella)

In `Dettagli` (ATELIER, sulla foto) o `Avanzato` (entrambe), chiusi di default:
provenienza e diritti, cronologia e albero delle versioni, interlocutore, stati
`materiale / in esame`, parametri, catena di processi, chiavi, scorciatoie da tastiera,
la pagina Sistema.

"Dichiara finita" esce dal flusso principale e vive solo nel passo 3, come casella
accanto a ogni versione: `Questa è finita`. L'opera è finita solo se lo dici tu.

## 6. Pagamenti: invariato

Higgsfield (o qualsiasi motore a pagamento) non compare nel percorso semplice: sta in
`Avanzato`, sempre con il dialog del costo e la conferma esplicita. Mai partire da solo.

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
