# ATELIER

Laboratorio di ricerca artistica: archivio visivo, tela per combinare, processi
sperimentali, interlocutore critico, varianti con Higgsfield (solo con il tuo
consenso al costo) ed esportazione per Lightroom.

Il percorso è in tre passi, sempre visibili in alto:
**1 Scegli → 2 Trasforma → 3 Salva**, più **oppure parti da zero** per partire
senza immagini. Il sistema non decide mai che un'opera è finita: lo decidi tu,
con la casella «Questa è finita» al passo 3. La mappa di ogni richiesta del
brief, con il punto preciso dove si trova, è in `docs/BRIEF.md`.

## Avvio sul Mac (un comando)

Serve Node.js 20 o più recente (`brew install node`, oppure da nodejs.org).

```sh
cd atelier && npm install && npm start
```

Si apre il browser su `http://localhost:4747`. Nel Terminale compare anche un
codice QR per l'iPhone. Per chiudere: `Ctrl+C`.

Al primo avvio l'archivio è vuoto: puoi trascinare le tue fotografie, incollare
un indirizzo, cercare negli archivi del mondo, oppure caricare 18 fotografie di
esempio (Met Museum, pubblico dominio) dal link nella schermata vuota.

## iPhone

1. iPhone e Mac sulla stessa rete Wi-Fi.
2. Inquadra con la Fotocamera il QR (nel Terminale o in **Impostazioni → Apri su iPhone**).
3. In Safari: **Condividi → Aggiungi alla schermata Home** per averlo come un'app.

Il QR contiene una chiave personale: senza, nessun altro sulla rete può aprire il
tuo archivio. Fuori casa si può usare Tailscale (gratuito) e lo stesso indirizzo.

## Come si lavora

- **1 Scegli.** Aggiungi foto (o trascinale in qualunque punto della finestra),
  incolla un indirizzo, o apri la scheda **Cerca negli archivi**: Openverse,
  Wikimedia Commons, Europeana, Library of Congress, Cleveland Museum of Art, NASA,
  Internet Archive, Met, Art Institute of Chicago. Le foto nuove compaiono in cima,
  già scelte. Sotto ogni foto: provenienza e diritti; la «i» apre i dettagli.
- **2 Trasforma.** Gli effetti sono miniature della tua foto già trasformata: un
  tocco li applica. Un cursore, **Intensità**, e **Un'altra versione**. Con due o più
  foto compaiono gli effetti che le combinano (e **Vedi affiancate**). Sotto
  l'anteprima l'**interlocutore** dice cosa non lo convince, con **Proponi una
  direzione** e **Discuti**. **Tieni questa** salva a piena risoluzione; sulle
  tenute ci sono **Parti da questa** (un ramo) e **Confronta** (A/B). **Mostrami 6
  versioni**, Higgsfield (sempre con il costo prima) e in **Avanzato** tutti i
  parametri, l'albero e la cronologia.
- **3 Salva.** TIFF 16 bit (consigliato), TIFF 8 bit, PNG, JPEG 100 o file
  originale, alla risoluzione nativa. Accanto, un `.atelier.json` con sorgenti,
  diritti, processi, parametri, versioni e note. In Lightroom: **File → Importa**.

## Higgsfield (generazioni a pagamento)

Una tantum, nel Terminale:

```sh
npm i -g @higgsfield/cli
higgsfield auth login
higgsfield workspace list
higgsfield workspace set <id>
```

Ogni generazione chiede prima il **preventivo** (gratuito) e parte solo dopo che
tieni premuto il pulsante di approvazione. Il server rifiuta qualunque generazione
senza un preventivo approvato da te, per gli stessi identici parametri, e un
preventivo vale una volta sola per 10 minuti.

Per provare il flusso senza spendere nulla:

```sh
ATELIER_HIGGSFIELD=simulato npm start
```

## Interlocutore

- **Locale**: misure reali sull'immagine (luce, contrasto, entropia, bordi,
  simmetria, palette) e proposte costruite su di esse. Sempre disponibile, offline.
- **Claude**: legge davvero l'immagine e discute. Usa Claude Code se è installato
  sul Mac (il tuo abbonamento), altrimenti la variabile `ANTHROPIC_API_KEY`.

## Dati e backup

Tutto è nella cartella `atelier/dati/` (o in quella indicata da `ATELIER_DATA`):
originali mai modificati, varianti PNG senza perdita, miniature, esportazioni e
un database `atelier.json` leggibile. Per un backup basta copiare la cartella.
Le immagini eliminate vanno in `dati/cestino/`.

## Versione di prova online

https://atelier-laboratorio.netlify.app: tutto gira nel browser e le immagini
restano su quel dispositivo. Higgsfield è simulato, l'interlocutore è solo
locale e l'esportazione è PNG/JPEG. La versione completa è quella sul Mac.

Per rigenerarla: `npm run build:web` crea `dist-web/` (configurazione in
`netlify.toml`, cartella base `atelier`).

## Struttura

```
atelier/
  server/   API locale (Express): archivio, esperimenti, anteprime, Higgsfield, interlocutore, esportazione
  shared/   processi e analisi, in JavaScript puro (girano sul Mac e nel browser)
  web/      interfaccia (moduli ES, nessuna compilazione)
  design/   design system e prototipo
  docs/     PIANO.md, il piano tecnico
  netlify/  funzioni della versione di prova (ricerca archivi, download immagini)
```

Variabili utili: `PORT` (4747), `ATELIER_DATA`, `ATELIER_HIGGSFIELD=simulato`,
`ATELIER_NO_OPEN=1`, `ATELIER_CLAUDE_MODEL`.
