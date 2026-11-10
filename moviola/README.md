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
   riferimento a cui si ispira, e sotto le Materie da sommare a strati. Intensità, Movimento, durata, proporzioni, fps,
   «Un'altra versione», «Mostrami 6 versioni», «Anteprima dal vivo», la riga di
   Claude con «Discuti». «Tieni questa» mette da parte la versione; tocca una tenuta
   per ripartire da lì, «Confronta» per l'A/B.
3. **Salva**: ProRes 422 HQ o 4444 XQ, sequenze PNG o TIFF 16 bit, 4K, 24 o 30 fps,
   durata e proporzioni, con la scheda `.json` accanto. «Questa è finita» la spunti
   solo tu, e puoi sempre toglierla.

**Avanzato** (in alto a destra): regolazioni fini con catena e chiavi sulla timeline,
versioni e confronto, dal vivo, interlocutore, archivio completo con provenienza e
diritti, tutte le opzioni di salvataggio.

## Le materie: l'immagine diventa il corpo di una sostanza

Trentotto processi nati dalla ricerca su Clipson (strati in macchina, zoom, macro, riflessi), Brakhage, Belson, Youngblood, McLaren, Viola e Turing. Nel passo 2, sotto gli stili, la striscia **Materie**: tocca una materia per aggiungerla, ritoccala per toglierla. Si sommano a strati (fino a sei, nell'ordine in cui le tocchi) sopra lo stile scelto; con **Nessuno stile** resta solo la foto con le sue materie. Ogni strato, nel pannello a destra, ha la sua Quantità e i suoi 7–12 parametri. Niente pellicola, graffi o bagliori: la foto resta riconoscibile, diventa il corpo della materia. Quelle segnate *cresce* si sviluppano da sole dall'inizio della clip (non chiudono il loop esatto).

**Materie dense** (peso, spessore, superficie in luce radente)

| Materia | Che cosa diventa la foto | Da |
|---|---|---|
| Impasto (Im) | La foto diventa una lastra di colore a olio ancora fresco: lunghe pennellate spesse seguono le forme dell’immagine, rigate dalle setole, con creste dove il pennello si ferma e piani di spatola nelle zone calme, mentre la pasta viene lentamente ritirata e trascinata. | Auerbach, Kossoff: la pittura materica |
| Argilla (Ar) · *cresce* | La foto è un bassorilievo in argilla bagnata visto da vicino in luce radente: dita invisibili lo trascinano, lo premono e lo lisciano, il rilievo scivola di lato e si rilassa, le chiazze umide migrano e asciugano. | Il bassorilievo in creta ancora umida, prima della cottura |
| Bitume (Bt) · *cresce* | Un catrame pesante esce dai bui della foto e la inghiotte piano: avanza con un labbro spesso, la pelle si raggrinza in corde, le bolle si gonfiano e lasciano crateri; dove è sottile macchia la foto di bruno, dove è spesso ne conserva la luce come un ricordo. | Burri, Catrami |
| Ghiaccio (Gh) | La foto è congelata in fondo a un blocco di ghiaccio spesso visto da vicinissimo: sciami di bolle, veli lattiginosi e piani di frattura a profondità diverse scorrono in parallasse, i piani di frattura avanzano a scatti e sulla superficie a conche cola un velo d’acqua di fusione. | Viola, l’acqua e la lentezza; Clipson, macro |
| Cenere (Nr) · *cresce* | La foto è un foglio spesso che carbonizza in silenzio: il fronte avanza a dita, la carta imbrunisce e si imbarca, diventa crosta nera a scaglie sollevate e poi cenere chiara che si sfoglia, si sbriciola e scopre il fondo. | Burri, Combustioni |

**Terre e stoffe** (materie che cedono: simulazioni vere, ripetibili a parità di seme)

| Materia | Che cosa diventa la foto | Da |
|---|---|---|
| Granuli (Gn) · *cresce* | La foto è un letto di sabbia: ogni grano porta il colore del punto da cui parte. Prima l’immagine tiene, poi cede a zone e frana fino all’angolo di riposo; il vento solleva i grani dai fianchi esposti e li ridepone dietro le creste, in dune e increspature, così l’immagine si disfa e si ricompone a strati. | Brakhage e la sabbia; le dune che il vento rifà ogni notte |
| Tessuto bagnato (Ts) · *cresce* | La foto è stampata su una stoffa pesante e bagnata, appesa davanti a un muro: pende dai suoi appigli in pieghe profonde con ombra propria, si tende, e dove cede si strappa con bordi sfilacciati che lasciano vedere ciò che sta sotto. Da vicino si vede il filato; dove è più bagnata è più scura e aderisce al muro. | Il drappo pesante delle pieghe barocche; i Sacchi di Burri |
| Erosione (Er) · *cresce* | La luce della foto diventa la quota di un terreno. Piove: l’acqua scorre verso il basso, scava solchi che si ramificano e letti di fiume, e dove rallenta lascia ventagli e delta di sedimento. Il colore dell’immagine viaggia con la terra e si ridepone a valle in strati. | Il terreno visto dall’alto, i calanchi, i delta dei fiumi |

Sono simulazioni a retroazione: lo stesso seme dà sempre la stessa clip, ma il loop non si chiude in modo esatto (l’interfaccia lo dice). Lo stato della simulazione ha la stessa misura in anteprima e nel render 4K, quindi la materia si muove allo stesso modo; il 4K aggiunge solo nitidezza a grani, filato e grana della terra.

**Materie fluide** (fluidodinamica vera e masse trasparenti)

| Materia | Che cosa diventa la foto | Da |
|---|---|---|
| Inchiostro in acqua (Ia) · *cresce* | La foto è inchiostro posato sul vetro di una vasca: si stacca, scende nell’acqua per il suo peso e si apre in pennacchi, anelli e dita sottili, portando con sé la trama dell’immagine. È una simulazione di fluido vera (pressione, vortici, galleggiamento): ogni seme dà le sue volute, sempre le stesse. Più inchiostro, più scuro e saturo (assorbimento, non trasparenza). 12 parametri. | Macro di inchiostro in acqua, Chris Parks, liquid light show |
| Vetro fuso (Vf) · *cresce* | Una massa di vetro spesso e ancora molle colata sopra la foto: scorre lentissima, la deforma come un fondo di bottiglia, si tinge dove è più spessa (chiaro, bottiglia, ambra, fumo, cobalto), riflette un ambiente buio sui fianchi ripidi e trattiene bolle d’aria che salgono piano o restano ferme. 14 parametri. | Vetro di Murano colato, fondi di bottiglia |

**Liquidi**

| Materia | Che cosa diventa la foto | Da |
|---|---|---|
| Mercurio (Hg) | La foto diventa una pozza di metallo pesante: la luce dell’immagine è l’altezza, la superficie si gonfia e trema lenta, e la foto si legge nel metallo, riflessa e piegata. | Youngblood, l’effetto oceanico |
| Olio (Ol) | Una pellicola d’olio galleggia sulla foto: lo spessore segue l’immagine e una corrente lenta lo trascina; i colori d’interferenza sono ottone, bronzo e petrolio, e sotto la foto si piega. | Belson, “è il colore a definire le forme” |
| Inchiostro (In) · *cresce* | La foto si scioglie come inchiostro nell’acqua: i bordi rilasciano il pigmento, i vortici lo tirano in filamenti, e l’immagine continua a riaffiorare. | Brakhage, la chimica che crea forme |
| Miele (Mi) · *cresce* | La foto colata come miele denso: scende lenta in lobi e pieghe, e dove la materia è spessa i colori si scuriscono d’ambra. | Bill Viola, la lentezza |
| Cera (Cr) · *cresce* | La foto come cera: le zone chiare fondono per prime e colano, poi si riaddensano; la superficie è traslucida, più morbida dove la cera è spessa. | Viola, l’emersione |
| Ferrofluido (Ff) | Un ferrofluido sotto magneti che si spostano: si raccoglie nei bui più profondi della foto come un corpo scuro che specchia l’immagine, si allunga verso i magneti e lì si alza in un campo di punte strette, piramidi scure che si piegano verso il magnete. | Brakhage, limatura di ferro sotto magneti |

**Acque e vetri**

| Materia | Che cosa diventa la foto | Da |
|---|---|---|
| Pioggia (Pi) · *cresce* | La foto è il fondo di uno specchio d’acqua su cui cade la pioggia: cerchi concentrici che si allargano e si incrociano piegano l’immagine; dove la foto è scura l’acqua è più profonda e le onde corrono diverse. | Paul Clipson, Bill Viola |
| Canale (Cn) | Sotto una linea d’orizzonte la foto si specchia capovolta nell’acqua di un canale: onde lunghe la spezzano in bande che tremano, l’acqua la scurisce e la raffredda. | Paul Clipson, riflessi nei canali |
| Goccia (Go) | Gocce sul vetro davanti alla foto: ognuna è una piccola lente che la mostra capovolta, scivolano a scatti, si fondono e lasciano scie; dietro, la foto respira dentro e fuori fuoco. | Paul Clipson, macro |
| Condensa (Co) | Un vetro appannato dal respiro: una nebbia di micro-gocce si forma e si ritira a ondate lente, e la foto riaffiora dove la condensa evapora, prima nelle sue zone chiare. | Bill Viola, il respiro |
| Bolle (Bo) | Una schiuma si raduna e si dirada sulla foto: bolle grandi e piccole negli interstizi, ognuna una lente sottile che ne ingrandisce un pezzo; respirano, scivolano, qualcuna scoppia e rinasce. | Brakhage, Youngblood |
| Vetro (Ve) | Una finestra di vetro antico colato a costolature irregolari che scorre piano: la foto si rompe in fusi ondulati, appena dispersi nei colori, e il fuoco passa sopra come un’onda. | Paul Clipson, vetro cattedrale |

**Minerali**

| Materia | Che cosa diventa la foto | Da |
|---|---|---|
| Marmo (Mr) | La foto diventa una lastra di marmo: i suoi contorni e le sue curve di luce sono le vene, che scorrono lente come magma che si raffredda. | Belson, “il colore, non la linea, definisce le forme” |
| Cristalli (Cs) · *cresce* | Da pochi semi crescono grani di cristallo ad aghi e dendriti; ogni grano è una lastra senza colore proprio che sposta la foto a modo suo, come un quarzo tagliato, e l’immagine si ricompone in un mosaico che avanza. | Brakhage, la chimica sulla pellicola che crea forme |
| Brina (Br) · *cresce* | Il gelo si forma sulla foto: rami di brina a felce crescono dai bordi scuri, sotto l’immagine si sbianca e si appanna, poi a tratti sgela e torna a ghiacciare. | Viola, la lentezza; il gelo sul vetro |
| Sabbia (Sb) | La foto è fatta di granelli che scivolano col vento, si raccolgono in increspature e dune, poi a poco a poco tornano a comporre l’immagine e di nuovo si sparpagliano. | Brakhage, “sabbie granulose e cangianti che a poco a poco prendono forma” |
| Ossido (Ox) · *cresce* | Dalle zone scure della foto avanza la corrosione: un fronte umido e frastagliato lascia ruggine, ferro e verderame che prendono il disegno dell’immagine. | Brakhage, la limatura di ferro; la chimica che lavora da sola |
| Crettatura (Ct) | La foto è uno strato d’argilla che si ritira in placche: le crepe si aprono e si richiudono come un respiro, i bordi delle zolle si incurvano con ombre morbide. | Turing, la forma che nasce dalla materia; il fango che si secca |

**Organismi**

| Materia | Che cosa diventa la foto | Da |
|---|---|---|
| Morfogenesi (Mg) · *cresce* | La foto diventa pelle: due sostanze reagiscono sotto la superficie e la luminanza decide la forma, macchie nelle ombre, labirinti nei mezzitoni, coralli nelle luci; il disegno solleva e rifrange l’immagine senza coprirla. | Alan Turing, 1952 |
| Micelio (Mc) · *cresce* | Da poche spore il micelio si allarga sulla foto preferendo le zone chiare: ife sottili seguono le vie della crescita, si ramificano e si infittiscono in feltro; l’immagine resta sotto, colonizzata, e i filamenti ne prendono il colore sbiancato. | ife fungine, colonie su agar |
| Lichene (Li) | Il lichene attecchisce solo dove la foto ha grana (roccia, corteccia, erba): tanti piccoli semi si allargano in lobi minuti e si fondono in croste; il colore resta quello della foto, appena velato di grigio-verde e d’ocra. | Rhizocarpon, Lecanora, Parmelia |
| Cellule (Cl) | La foto diventa un tessuto vivo: ogni cellula è una piccola lente che ingrandisce il suo pezzo d’immagine, le membrane sono morbide, i nuclei appena accennati; le cellule respirano, si spingono e ogni tanto si dividono. | tessuti al microscopio |
| Vene (Vn) | I contorni della foto diventano vasi che si ramificano sotto la pelle dell’immagine; un battito lento li gonfia e il fluido scorre lungo i canali, mentre la foto resta la carne in cui passano. | tavole anatomiche, reti linfatiche |
| Stormo (St) · *cresce* | La foto si scompone in migliaia di particelle che volano insieme come uno stormo: onde di densità le attraversano, i vortici le piegano, ognuna porta il colore dell’immagine; quando lo stormo si compatta la foto si ricompone. | storni sul Tevere, banchi di sardine |

**Fumi e corpi**

| Materia | Che cosa diventa la foto | Da |
|---|---|---|
| Fumo (Fu) · *cresce* | La foto si fa fumo: dalle sue luci (o dalle ombre) si staccano volute che salgono lente e si sciolgono; è il colore, non la linea, a definire le forme. | Jordan Belson |
| Nuvola (Nu) | La foto come volume di gas: le sue luci si gonfiano in una nuvola spessa, colorata dalla foto, che si rimescola lentamente su sé stessa. | Jordan Belson, immagini gassose |
| Pelle (Pe) | La foto diventa pelle che respira: una grana di piccoli rilievi e pori si tende e si rilassa, pieghe morbide corrono parallele ai bordi dell’immagine, la foto è il pigmento. | Tessuti, superfici del corpo |
| Seta (Se) | La foto stampata su un drappo di seta che ondeggia al vento: pieghe di larghezze diverse scorrono in diagonale, la stampa si piega con loro e le valli si fanno ombra. Nessuna luce aggiunta: solo ombra e deformazione. | Drappi al vento |
| Carta bagnata (Cb) · *cresce* | Carta bagnata che beve la foto: l’acqua avanza nelle fibre con un fronte frastagliato, dove arriva i colori si allargano come acquerello e sul bordo si deposita il pigmento; poi asciuga. | Acquerello, cerchio di caffè |
| Strati (Sr) · *cresce* | Cinque o sei esposizioni della stessa immagine sovrapposte in macchina, ognuna con il suo zoom che scatta avanti e indietro e il suo ritardo; il fuoco passa da uno strato all’altro come un’onda. Si aggiunge all’immagine invece di togliere. | Paul Clipson; McLaren, Pas de deux |

## Scolpire con le dita e Macro

Sotto l'anteprima, nel passo 2, due pulsanti valgono per qualunque materia, anche per quelle che arriveranno.

**Scolpisci.** Acceso, l'anteprima diventa materia da toccare (lo dice in alto a sinistra, e il tocco non ferma più il video). Cinque strumenti: **Spingi** (la materia segue il dito e si accumula davanti), **Scava** (un solco o una conca col bordo rialzato), **Impasta** (giri e grumi dove tieni il dito), **Liscia** (spiana e cancella piano), **Pizzica** (raccoglie verso il dito e solleva). Poi **Dimensione** e **Forza**. Su iPhone vanno più dita insieme; con la matita conta la pressione vera, altrimenti contano l'area del tocco e la velocità (piano e largo spinge di più).

Ogni dito è un gesto registrato nel tempo della clip: posizione, forza e strumento. A clip ferma il gesto resta in quell'istante; con la clip che scorre si registra mentre la guardi. **Registra un giro** riparte dall'inizio e fa un giro intero; **Riascolta** lo ripete identico, con cerchi tratteggiati dove passano le dita. **Annulla l'ultimo**, e nel pannello a destra l'elenco dei gesti, ognuno da cancellare.

Ogni materia risponde a modo suo: le dense e i minerali si lasciano incidere e tengono l'impronta in luce radente, i liquidi e le acque si aprono, ondeggiano e si richiudono piegando la luce che li attraversa, le carni cedono e tornano piano. Comanda la materia più in alto tra gli strati. **Memoria della materia** la piega: a sinistra non resta nulla, al centro la materia com'è, a destra resta tutto. Poi **Rilievo dell'impronta** e **Direzione della luce radente**.

Il gesto si ripete identico nel video salvato in 4K, a 24 o a 30 fps: il campo che le materie leggono avanza a passi fissi di 1/120 di secondo e ha la stessa misura in anteprima e nel render.

**Macro.** Una camera che entra nella materia. Non è uno zoom che sgrana: con la Macro accesa tutta la catena viene calcolata da vicino, ogni materia disegna la sua struttura al posto giusto e, avvicinandosi, compaiono nuovi livelli di microdettaglio ancorati alla superficie (grana, pori, fibre, microbolle o cristalli, secondo la materia o a scelta). Il rilievo della materia dà parallasse e una messa a fuoco vera: piano di fuoco dal punto più basso al più alto di quello che vedi, sfocato morbido che cresce con la distanza dal piano, senza luccichii. Parametri: Ingrandimento (fino a ×32), punto guardato («Scegli il punto da guardare» mostra tutto il quadro: tocca dove entrare), Piano di fuoco, Apertura, Inclinazione e il suo verso, Rotazione, Microdettaglio, Profondità del rilievo, Deriva, Respiro del fuoco. Ogni parametro ha ◆ per mettere una chiave nell'istante in cui sei; «Entra piano», «Esci piano» e «Il fuoco scivola» mettono le chiavi da un capo all'altro della clip.
## Le mie ricette: una catena tua, usata come una materia sola

Quando una clip ti convince, «Salva come ricetta» (nel passo 2, sotto i pulsanti,
oppure nella striscia Materie) mette da parte **tutta la catena**: ogni materia
con ogni parametro, il movimento, le chiavi della timeline e il seme, con il nome
che scegli tu. Le ricette stanno in testa alla striscia Materie, nel gruppo **Le
mie ricette**, ognuna con un provino fatto dalla ricetta stessa sulle foto che hai
aperto. Un tocco e la ricetta va sulla foto o sul video che stai usando.

- **Su un'altra foto**: restano le proporzioni della clip; durata, movimento e
  chiavi vengono dalla ricetta. Con due o più foto entra la fusione tra le foto,
  con una sola sparisce. Se cambi la durata, le chiavi si allungano con lei.
- **Pochi parametri in vista**: quando salvi scegli fino a sei regolazioni da
  tenere sotto mano (la quantità di ogni materia e il parametro più vivo sono già
  proposti). **Apri per intero** mostra tutti i parametri e, con ◆, decidi quali
  restano in vista. La catena completa e le chiavi sono in Avanzato › Regolazioni
  fini.
- **Gestisci**: rinomina, duplica, aggiorna con la clip aperta (la versione di
  prima resta, «Annulla»), elimina (chiede conferma), sposta su e giù, esporta una
  o tutte in un file `.json`, importa da file su un altro Mac.
- **Reggono il tempo**: se una materia non c'è più, la ricetta si apre lo stesso,
  dice «manca …» e la tiene da parte; i parametri nuovi partono dal loro valore di
  partenza, quelli spariti si ignorano e lo dice.

## Deriva: nove mutazioni, scegli tu

**Deriva · 9 mutazioni** (passo 2) esplora da sola attorno alla clip aperta e
mostra nove figlie vive, che si muovono davvero. Ne scegli una e diventa la nuova
madre: la generazione dopo nasce da lei. Decide sempre ninni.

- Le mutazioni muovono i parametri in proporzione alla loro scala e al loro peso;
  ogni tanto aggiungono, tolgono, scambiano o riordinano una materia (prese dal
  registro: le materie nuove entrano da sole). Pellicola, grana e luce possono
  solo diminuire.
- Prima di mostrarle, la Deriva le misura come l'interlocutore (luminosità,
  contrasto, colore, densità, movimento, sfarfallio, varietà) e scarta le nere,
  le bruciate, le immobili, quelle che sfarfallano e le quasi uguali tra loro o
  alla madre. La soglia di «uguale» si tara sulla madre: quanto cambia da sola
  con un altro seme.
- **Ampiezza**: da ritocco a salto. **Cosa può mutare**: parametri, catena,
  movimento, colore. **Tieni fermo**: blocca una materia intera o singoli
  parametri. **♥** due preferite e **Incrocia**. **Indietro di una generazione**
  e la genealogia in alto per tornare a qualsiasi madre.
- Tocca una mutazione per ingrandirla: **Scegli come madre**, **Lavoraci
  adesso**, **Salva come ricetta**.
- Ogni scelta è una versione nuova, figlia della madre di prima, con la nota
  «Deriva G2: …»: in Versioni la genealogia si legge come un ramo. Tutto viene dal
  seme della deriva, scritto sotto i pulsanti: stessa madre, stesse scelte, stesse
  figlie.
- Le nove anteprime girano su un solo motore a risoluzione ridotta; se il
  computer resta indietro, scendono ancora di risoluzione da sole.

## Il passo 2 a schede e il tasto Reset

Il passo 2 **non scorre mai in verticale**, né su iPhone né sul Mac: l'immagine
resta ferma davanti agli occhi mentre si regola qualsiasi comando. Sopra
l'immagine «1 foto · Cambia»; sotto, la linea del tempo; poi cinque schede, una
aperta alla volta (si ricorda tornando al passo 2), e in fondo «Tieni questa»
con il conto delle tenute. Sul Mac le schede stanno nella colonna di destra e
sotto l'immagine c'è una sola striscia di miniature, che segue la scheda: gli
stili nella scheda Stile, le materie nella scheda Materie. Quello che non sta in
una scheda va in pagine da sfogliare di lato (col dito, con ‹ ›, con i
trattini, con due dita sul trackpad, con ← → sulla tastiera): «1 di 3». Un tocco
sull'immagine la ferma e la fa ripartire; **due tocchi** nascondono tutti i
comandi e la mostrano a tutto schermo, un altro tocco li riporta.

| Scheda | Cosa c'è |
|---|---|
| Stile | Le miniature degli stili (su iPhone nella scheda, sul Mac sotto l'immagine), nome e descrizione dello stile o la ricetta con le sue manopole, Intensità, Movimento con i battiti al minuto, ↺ solo lo stile |
| Materie | La riga degli strati («1 Granuli», «2 Inchiostro», «+ Aggiungi», fino a 6) e ↺ solo le materie. Uno strato aperto: ↑ sposta prima, Togli, Rimetti i valori di partenza, Quantità, i parametri, poi Dove sta (mappa), Il confine e Contagio, ognuno dalla sua pagina. «+ Aggiungi»: la striscia delle materie per famiglia, con Le mie ricette, Salva come ricetta e Gestisci |
| Gesto | Scolpisci con le dita (acceso o spento, strumento, dimensione, forza, Registra un giro, Riascolta, Annulla l'ultimo, memoria, rilievo, luce, i gesti registrati) e Macro (accesa o spenta, punto da guardare, Entra piano, Esci piano, Il fuoco scivola, microdettaglio, parametri con ◆), ↺ solo il gesto |
| Catena | Respiro, Tempo geologico, Gravità e vento: tre righe con il loro interruttore; toccandone una, i suoi comandi prendono il posto dell'elenco, con ‹ per tornare. Le curve e le forze disegnate restano sull'immagine e sotto la linea del tempo. ↺ solo la catena |
| Altro | Formato (durata, proporzioni, fotogrammi al secondo), Altre strade (Un'altra versione, Mostrami 6 versioni, Deriva · 9 mutazioni, Salva come ricetta), Anteprima dal vivo, Claude con «Discuti», le tenute (Confronta, Tutte le versioni), il link Avanzato |

**Reset** sta nella barra in alto a destra, sempre visibile nel passo 2. Riporta
la foto o le foto (tutte insieme) com'erano quando sono state scelte: senza
stile («Nessuno stile»), senza materie, senza gesti di Scolpisci, Macro spenta,
Respiro, Tempo geologico e Gravità e vento spenti, Intensità e Movimento ai
valori di partenza. Non tocca le foto scelte, il formato, le versioni tenute, le
ricette, l'archivio. Nessuna finestra di conferma: per 7 secondi c'è «Annulla»,
che rimette tutto com'era, scheda aperta compresa. Ogni scheda ha il suo ↺ che
azzera solo il suo capitolo, con lo stesso Annulla. Il bersaglio del Reset è in
un punto solo: `RESET_STYLE` in `web/ui/flow.js`.

Le pagine laterali sono in `web/ui/schede.js`: i comandi arrivano come blocchi
piccoli e vengono distribuiti misurando lo spazio vero. Prova automatica (cloud):
quattro misure di schermo, ogni scheda, casi pesanti (6 strati, la materia più
ricca, contagio, Scolpisci con gesti, Macro, ognuna delle tre voci di Catena, 8
tenute).

## Dove sta ogni risposta delle 20 domande

| # | Risposta | Dove sta |
|---|----------|----------|
| 1 | Astrazione di ogni tipo | Passo 2: nove stili di famiglie diverse, «Nessuno stile» e le 38 materie a strati; Avanzato: 16 processi e le 38 materie da combinare |
| 2 | Brakhage, McLaren, Len Lye, Ikeda, Viola, Clipson | Passo 2: ogni miniatura dice a chi si ispira |
| 3 | Da zero, da immagine o da video | Passo 1: «Aggiungi foto o video» e «parti da zero» |
| 4 | Il movimento lo sceglie lui | Passo 2, scheda Stile: Movimento (Fermo, Lento, A tempo con bpm, Caotico) e Intensità; chiavi in Avanzato |
| 5 | Pura esperienza visiva | Nessun testo nel video |
| 6 | Da 1 a 30 secondi | Passo 2 (scheda Altro) e passo 3: Durata 1, 3, 5, 8, 15, 30 s (in Avanzato qualsiasi valore) |
| 7 | Più formati | Passo 2 (scheda Altro) e 3: 16:9, 9:16, 1:1, 4:5, 2.39:1, 4:3 |
| 8 | 4K, 24 e 30 fps | Passo 3: 4K e 24/30 in vista |
| 9 | DaVinci | Passo 3: ProRes 422 HQ / 4444 XQ, PNG/TIFF 16 bit, `.json`, Rec.709 |
| 10–11 | Niente suono | Nessuna traccia audio |
| 12 | Solo motori locali gratuiti | Tutto sul Mac, nessun servizio a pagamento |
| 13 | Timeline «un po'» | Passo 2: striscia del tempo sotto l'anteprima; chiavi in Avanzato › Regolazioni fini |
| 14 | Tempo reale se lo sceglie | Passo 2, scheda Altro: «Anteprima dal vivo» |
| 15 | App separata | Cartella, archivio e porta suoi |
| 16 | Stessa grafica di ATELIER | Stessi token, componenti e percorso a tre passi |
| 17 | iPhone e Mac | Tutto il percorso, verificato su entrambi |
| 18 | Claude critico | Passo 2, scheda Altro: riga «Claude:» con «Discuti» |
| 19 | Cronologia e rami | Passo 2: «Tenute: N» accanto a «Tieni questa», nella scheda Altro le tenute, «tocca per ripartire», «Confronta»; Deriva (ogni scelta è un ramo); Avanzato › Versioni |
| 20 | MacBook Pro M2 Pro | Render 4K locale, fotogramma per fotogramma |

## Tutta la catena: Respiro, Tempo geologico, Gravità e vento

Nel passo 2, sotto le materie a strati, tre funzioni che muovono tutte le
materie insieme: un **respiro** unico che le attraversa come un'onda, il
**tempo geologico** (una curva disegnata sotto la timeline comprime ore di
trasformazione in pochi secondi) e **gravità e vento** (un campo di forze, con
correnti, vortici, pozzi e sorgenti disegnati sul quadro col dito). Da spente
la clip resta identica. Come funzionano e come una materia nuova le sente:
[TUTTA-LA-CATENA.md](TUTTA-LA-CATENA.md).

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
