/* ATELIER — interlocutore critico (versione prototipo).
   Le misure sono calcolate davvero sull'immagine. I commenti sono scritti in
   anticipo e scelti in base alle misure: nell'app vera li scrive Claude,
   con lo stesso tono — critico, non accondiscendente. */
(function () {
  function measure(el) {
    const N = 72, c = document.createElement("canvas"); c.width = N; c.height = N;
    const x = c.getContext("2d", { willReadFrequently: true });
    try { x.drawImage(el, 0, 0, N, N); } catch (e) { return null; }
    let d; try { d = x.getImageData(0, 0, N, N).data; } catch (e) { return null; }
    const L = new Float32Array(N * N); let sum = 0, sat = 0;
    for (let i = 0; i < N * N; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; L[i] = l; sum += l;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b); sat += mx ? (mx - mn) / mx : 0;
    }
    const mean = sum / (N * N); let v = 0, edge = 0, sym = 0, symV = 0;
    for (let y = 0; y < N; y++) for (let x2 = 0; x2 < N; x2++) {
      const i = y * N + x2, l = L[i]; v += (l - mean) ** 2;
      if (x2 < N - 1 && y < N - 1) edge += Math.abs(l - L[i + 1]) + Math.abs(l - L[i + N]);
      sym += Math.abs(l - L[y * N + (N - 1 - x2)]);
      symV += Math.abs(l - L[(N - 1 - y) * N + x2]);
    }
    const contrast = Math.min(1, Math.sqrt(v / (N * N)) * 3.2);
    const edges = Math.min(1, edge / (N * N) * 7);
    const symmetry = Math.max(0, 1 - Math.min(sym, symV) / (N * N) * 4.2);
    const saturation = Math.min(1, sat / (N * N) * 1.6);
    // Ambiguità: alta quando i bordi sono a metà (né vuoto né rumore) e la simmetria non chiude il discorso.
    const ambiguity = Math.max(0, Math.min(1, (1 - Math.abs(edges - 0.5) * 2) * 0.6 + (1 - symmetry) * 0.4));
    return { mean, contrast, edges, symmetry, saturation, ambiguity };
  }

  const PROC_REMARKS = {
    piega: "La piega crea un asse che l'occhio cerca subito: è il punto più forte e il più pericoloso, perché la simmetria tende a rassicurare.",
    fessura: "La fessura funziona quando l'oggetto resta riconoscibile per metà. Qui chiediti se la deformazione racconta un tempo o è solo un effetto.",
    innesto: "L'innesto è interessante dove le due materie si confondono. Dove il taglio si vede, torna a essere un collage riconoscibile.",
    deriva: "La deriva lascia la seconda immagine invisibile ma attiva: è una relazione nascosta, e questo è raro. Non spiegarla nel titolo.",
    sabattier: "La solarizzazione porta con sé un secolo di citazioni. Per non essere un omaggio deve rompere qualcos'altro, non solo i toni.",
    canali: "Lo scollamento dei canali è vicino al glitch, un'estetica già consumata. Vale la pena solo se la separazione del colore cambia il senso dell'oggetto.",
    rimescola: "Il rimescolamento è forte quando pochi frammenti si spostano: l'ordine residuo fa da testimone. Con troppi spostamenti resta solo decorazione.",
    campo: "Un campo di flusso senza sorgente è un punto di partenza neutro: è materiale, non ancora un'immagine. Prova a usarlo come maschera su una fotografia.",
  };

  function remarks(m, proc) {
    const out = [];
    if (!m) return ["Non riesco a misurare questa immagine (probabilmente viene da un indirizzo esterno). Posso comunque discuterne se mi dici cosa vedi."];
    if (proc && PROC_REMARKS[proc]) out.push(PROC_REMARKS[proc]);
    if (m.symmetry > 0.78) out.push("La simmetria è quasi completa. Rischia di diventare decorativa: romperla in un punto solo potrebbe essere più forte della piega intera.");
    if (m.edges > 0.72) out.push("C'è informazione ovunque; l'occhio non trova dove fermarsi. Se è l'instabilità che cerchi, tienila. Se no, è rumore.");
    else if (m.edges < 0.22) out.push("Superfici quasi vuote. Il vuoto qui è il soggetto: una seconda immagine molto densa potrebbe creare la tensione che manca.");
    if (m.saturation < 0.12) out.push("È quasi monocroma: in Lightroom il colore sarà una tua scelta, non un'eredità della sorgente.");
    else if (m.saturation > 0.45) out.push("Il colore è forte e viene dalla sorgente. Chiediti se è tuo o se lo stai solo ereditando.");
    if (m.contrast < 0.3) out.push("Il contrasto è basso: l'immagine respira, ma è anche facile da dimenticare.");
    if (out.length < 2) out.push("Non vedo ancora un'incongruenza vera: tutto è coerente con la sorgente. Coerente non vuol dire interessante.");
    return out.slice(0, 3);
  }

  // Ipotesi: accostamenti proposti dall'interlocutore. Ogni ipotesi è
  // eseguibile: indica sorgenti e processo da preparare sulla tela.
  const HYPOTHESES = [
    { t: "Il cielo come organismo", d: "Innestare le alghe di Atkins nelle nuvole di Le Gray: il blu della cianotipia dentro un cielo senza colore. Botanica e meteorologia diventano la stessa materia.", src: ["a08", "a01"], proc: "innesto" },
    { t: "Un occhio che guarda la Luna", d: "Far derivare la superficie lunare secondo l'occhio della libellula. La Luna non viene vista: viene deformata da chi guarda.", src: ["a05", "a14"], proc: "deriva" },
    { t: "Il fulmine dentro gli strumenti", d: "La quercia ferita piegata su sé stessa, poi solarizzata: la ferita diventa un asse. Rischio: simmetria troppo rassicurante.", src: ["a07"], proc: "piega" },
    { t: "Il movimento senza corpo", d: "Rimescolare la griglia di Muybridge finché il corpo sparisce e resta solo il ritmo. Fermarsi prima che diventi un pattern.", src: ["a18"], proc: "rimescola" },
    { t: "L'onda come tempo", d: "Fessura temporale sulla grande onda di Sète: l'orizzonte, l'unica linea stabile dell'immagine, smette di esserlo.", src: ["a09"], proc: "fessura" },
  ];

  const DISSENT = [
    "Non sono d'accordo. Stai cercando di rendere l'immagine più leggibile, ma la leggibilità qui toglie la cosa più interessante: il dubbio su cosa stiamo guardando.",
    "Capisco la direzione, ma mi sembra una scelta sicura. Prima di farla, prova l'opposto per un minuto: se l'opposto ti irrita, forse è lì che c'è qualcosa.",
    "Questa idea l'abbiamo già vista molte volte nelle immagini generate: superfici lucide, drammaticità facile. Proporrei di togliere invece di aggiungere.",
    "Posso farlo, ma ti dico cosa temo: diventa un'immagine finita troppo presto. Lasciamola grezza e decidi tu in Lightroom.",
  ];

  const ZERO_IDEAS = [
    "Una mappa di un luogo che esiste solo quando nessuno lo guarda.",
    "Il ritratto di una stanza fatto con l'ombra degli oggetti che non contiene più.",
    "Un erbario di piante che crescono dentro le fotografie scientifiche dell'Ottocento.",
  ];

  window.AtelierCritic = { measure, remarks, HYPOTHESES, DISSENT, ZERO_IDEAS };
})();
