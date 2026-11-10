# Tutta la catena: Respiro, Tempo geologico, Gravità e vento

Tre funzioni che non sono materie: agiscono su **tutte le materie insieme**.
Si trovano nel passo 2, nel pannello, sotto «Materie a strati», nel riquadro
**Tutta la catena**. Ognuna ha il suo interruttore e parte spenta: da spente
la clip è identica a prima, fotogramma per fotogramma.

Stesso seme e stessi valori danno sempre gli stessi fotogrammi, in anteprima
e nel video salvato.

## Respiro

Un solo ritmo lento e irregolare muove insieme le materie, così la clip è un
organismo e non tanti effetti separati. Ogni respiro ha un'inspirazione, una
pausa a pieno, un'espirazione più lunga che cede piano e una pausa a vuoto.
Da un respiro all'altro cambiano durata e profondità; ogni tanto un sospiro
(due inspirazioni di fila, più profonde), ogni tanto un'apnea.

- **Frequenza**: respiri al minuto (6 è un respiro lento, da corpo a riposo).
- **Irregolarità**: da quasi regolare ad agitato.
- **Forma del ciclo**: quieto (entra ed esce piano) o profondo (entra presto,
  trattiene, esce lungo).
- **Sospiri** e **Apnea**: quanto spesso capitano.
- **Profondità**: quanto il respiro muove le materie. Accetta le chiavi (◇):
  il respiro può nascere piano e crescere.
- **Onda lungo la catena**: ogni materia respira un poco dopo la precedente,
  e l'onda attraversa gli strati.
- **Per materia**: profondità e ritardo suoi, e i parametri che respirano.
  Tocca un parametro per farlo respirare al contrario (↓) o per escluderlo.

Il disegno sopra i cursori mostra il respiro di tutta la clip (una linea per
materia, con il suo ritardo). Con il loop, nella clip entra un numero intero
di respiri: l'ultimo fotogramma torna al primo.

Convive con il carattere del movimento (fermo, lento, a tempo, caotico) e con
le chiavi: si aggiunge sopra.

## Tempo geologico

Ore di trasformazione in pochi secondi. Sotto la timeline compare una curva:
in alto il tempo della materia corre (fino al moltiplicatore massimo, da ×4
a ×256), in basso quasi si ferma. La disegni col dito o col mouse; le forme
di partenza (Costante, Accelera, Rallenta, Ere, Quasi arresto) si possono
ridisegnare.

- Le materie che crescono, colano o si diffondono fanno più passi di
  simulazione (o meno) per fotogramma, contati in modo esatto dal primo
  fotogramma: l'anteprima e il video 4K fanno gli stessi passi.
- Le altre materie hanno il loro orologio interno spostato sulla curva. Con il
  loop restano chiuse.
- **Per materia: invecchia**: una materia può invecchiare più in fretta o più
  piano delle altre (da ×0,25 a ×4).

Se il Mac non ce la fa in tempo reale, l'**anteprima si alleggerisce** (fa una
parte dei passi) e lo dice, sia nel pannello sia sopra la curva. Il video
salvato fa sempre tutti i passi. **Anteprima esatta** fa tutti i passi anche in
anteprima, a costo di scorrere più lenta.

## Gravità e vento

Un campo di forze unico, che tutte le materie sentono.

- **Gravità**: forza e direzione. «Normale» è la gravità con cui le materie
  sono nate; si può alleggerire, appesantire, girare.
- **Vento**: forza, direzione, raffiche (quanto soffia a folate) e grandezza
  delle raffiche.
- **Forze sul quadro**: scegli *Corrente* e traccia un tratto col dito, oppure
  *Vortice*, *Pozzo*, *Sorgente*: tocca e allarga. Ogni forza ha la sua forza e
  il suo raggio; i vortici girano nei due versi.
- Tutti i cursori di forza accettano le **chiavi** (◇): la gravità può girare
  durante la clip, il vento alzarsi, un vortice nascere e spegnersi.
- **Mostra il campo**: linee sottili sul quadro, che non finiscono nel video.
- **Per materia**: quanto sente le forze (0 = per niente, 200% = il doppio),
  e una riga che dice come le sente.

Materie che sentono le forze oggi: Miele, Cera e Bitume (colano secondo la
gravità e sono portate dal campo), Inchiostro, Fumo, Morfogenesi e Stormo
(portati dal vento, dalle correnti e dai vortici), Carta bagnata (l'acqua
scorre anche con la gravità), Sabbia e Seta (il vento disegnato prende il posto
del loro). Le materie solide e quelle che crescono ferme non le sentono.

## Per chi aggiunge una materia

- **Respiro**: niente da fare. Respirano i parametri continui tranne quelli di
  regia (velocità, direzione, luce, tinta, scala…) e di quantità. Per scegliere:
  `vitali: ['spessore', 'colata']`. Nel GLSL `RESPIRO` vale il respiro del
  passaggio (circa −1…1, 0 se spento).
- **Tempo geologico**: niente da fare. Le simulazioni usano `u_t`, `u_frame`,
  `u_step` come sempre; il motore conta i passi.
- **Gravità e vento**: una riga nella dichiarazione,
  `forze: 'trasporto'` (lo stato o la retroazione viene portato dal campo) o
  `forze: 'mappa'` (lo stato xy è uno spostamento in uv verso la foto), più
  `peso: 0…1` se la gravità non deve trascinarla. Oppure nel GLSL `FORZA(uv)`
  (velocità in uv al secondo), `GIU(d)` (un vettore «verso il basso» girato come
  la gravità), `GRAVITA`, `RAFFICA(uv)`, `VERSO_VENTO(d)`, `SOFFIO(v)`. Con la
  funzione spenta valgono zero o lasciano tutto com'è.

Codice: `web/engine/respiro.js`, `web/engine/tempo.js`, `web/engine/forze.js`,
`web/engine/catena.js`; interfaccia in `web/ui/organismo.js` e
`design/organismo.css`.
