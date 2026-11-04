/* ATELIER — processi algoritmici locali (gratuiti, nessuna rete).
   Ogni processo riceve immagini/canvas sorgente e parametri, restituisce un
   canvas nuovo. Stessi parametri + stesso seme = stesso risultato, così la
   cronologia può rigenerare qualsiasi variante.
   Esposto come window.AtelierProcesses (script classico, funziona anche senza
   server di moduli). */
(function () {
  const MAX = 1100; // lato massimo di lavoro nel prototipo

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function noise1(seed, n) {
    const r = rng(seed); const pts = Array.from({ length: n + 2 }, r);
    return (x) => { // x in [0,1]
      const f = x * n, i = Math.floor(f), t = f - i, s = t * t * (3 - 2 * t);
      return pts[i] * (1 - s) + pts[i + 1] * s;
    };
  }
  function size(src) {
    const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
    const k = Math.min(1, MAX / Math.max(w, h));
    return [Math.round(w * k), Math.round(h * k)];
  }
  function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function draw(src, w, h) { // "cover" dentro w×h
    const c = canvas(w, h), x = c.getContext("2d", { willReadFrequently: true });
    const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
    const k = Math.max(w / sw, h / sh), dw = sw * k, dh = sh * k;
    x.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return c;
  }
  const px = (c) => c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
  function out(w, h, data) { const c = canvas(w, h); c.getContext("2d").putImageData(data, 0, 0); return c; }
  const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

  const P = {};

  P.piega = { // composizione: specchio lungo un asse spostabile
    name: "Piega speculare", kind: "compositivo", inputs: 1,
    note: "Ripiega l'immagine su sé stessa: nasce una simmetria che l'originale non aveva.",
    params: { asse: { min: 0, max: 1, step: 1, value: 0, labels: ["verticale", "orizzontale"] }, posizione: { min: 0.2, max: 0.8, step: 0.01, value: 0.5 } },
    run([a], p) {
      const [w, h] = size(a), c = draw(a, w, h), x = c.getContext("2d");
      const o = canvas(w, h), y = o.getContext("2d");
      y.drawImage(c, 0, 0);
      if (p.asse < 0.5) {
        const cut = Math.round(w * p.posizione);
        y.save(); y.translate(cut * 2, 0); y.scale(-1, 1); y.drawImage(c, 0, 0, cut, h, cut, 0, cut, h); y.restore();
      } else {
        const cut = Math.round(h * p.posizione);
        y.save(); y.translate(0, cut * 2); y.scale(1, -1); y.drawImage(c, 0, 0, w, cut, 0, cut, w, cut); y.restore();
      }
      return o;
    },
  };

  P.fessura = { // slit-scan: le colonne scivolano in verticale
    name: "Fessura temporale", kind: "compositivo", inputs: 1,
    note: "Ogni colonna scorre come in una scansione a fessura: il tempo diventa deformazione.",
    params: { ampiezza: { min: 0, max: 0.6, step: 0.01, value: 0.22 }, onde: { min: 1, max: 24, step: 1, value: 6 }, seme: { min: 1, max: 999, step: 1, value: 17 } },
    run([a], p) {
      const [w, h] = size(a), s = px(draw(a, w, h)), d = new ImageData(w, h), n = noise1(p.seme, p.onde);
      for (let x = 0; x < w; x++) {
        const off = Math.round((n(x / w) - 0.5) * 2 * p.ampiezza * h);
        for (let y = 0; y < h; y++) {
          const sy = ((y + off) % h + h) % h, si = (sy * w + x) * 4, di = (y * w + x) * 4;
          d.data[di] = s.data[si]; d.data[di + 1] = s.data[si + 1]; d.data[di + 2] = s.data[si + 2]; d.data[di + 3] = 255;
        }
      }
      return out(w, h, d);
    },
  };

  P.innesto = { // combinazione: B entra in A dove A è chiara
    name: "Innesto tonale", kind: "combinazione", inputs: 2,
    note: "La seconda immagine entra nella prima attraverso le sue luci: un innesto, non una sovrapposizione.",
    params: { soglia: { min: 0, max: 255, step: 1, value: 120 }, morbidezza: { min: 1, max: 120, step: 1, value: 30 }, inverti: { min: 0, max: 1, step: 1, value: 0, labels: ["luci", "ombre"] } },
    run([a, b], p) {
      const [w, h] = size(a), A = px(draw(a, w, h)), B = px(draw(b, w, h)), d = new ImageData(w, h);
      for (let i = 0; i < A.data.length; i += 4) {
        let t = (lum(A.data, i) - p.soglia) / p.morbidezza; t = Math.max(0, Math.min(1, t * 0.5 + 0.5));
        if (p.inverti >= 0.5) t = 1 - t;
        for (let k = 0; k < 3; k++) d.data[i + k] = A.data[i + k] * (1 - t) + B.data[i + k] * t;
        d.data[i + 3] = 255;
      }
      return out(w, h, d);
    },
  };

  P.deriva = { // spostamento: la luminanza di B sposta i pixel di A
    name: "Deriva", kind: "combinazione", inputs: 2,
    note: "La seconda immagine non si vede: agisce come un campo di forze che sposta la prima.",
    params: { forza: { min: 0, max: 0.25, step: 0.005, value: 0.08 }, angolo: { min: 0, max: 360, step: 1, value: 35 } },
    run([a, b], p) {
      const [w, h] = size(a), A = px(draw(a, w, h)), B = px(draw(b, w, h)), d = new ImageData(w, h);
      const ax = Math.cos(p.angolo * Math.PI / 180), ay = Math.sin(p.angolo * Math.PI / 180), F = p.forza * Math.max(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, m = lum(B.data, i) / 255 - 0.5;
        const sx = Math.min(w - 1, Math.max(0, Math.round(x + ax * m * F))), sy = Math.min(h - 1, Math.max(0, Math.round(y + ay * m * F)));
        const si = (sy * w + sx) * 4;
        d.data[i] = A.data[si]; d.data[i + 1] = A.data[si + 1]; d.data[i + 2] = A.data[si + 2]; d.data[i + 3] = 255;
      }
      return out(w, h, d);
    },
  };

  P.sabattier = { // solarizzazione: inversione oltre soglia
    name: "Solarizzazione", kind: "tonale", inputs: 1,
    note: "Le luci si rovesciano oltre una soglia, come l'effetto Sabattier in camera oscura.",
    params: { soglia: { min: 40, max: 240, step: 1, value: 150 }, contrasto: { min: 1, max: 2.5, step: 0.05, value: 1.4 } },
    run([a], p) {
      const [w, h] = size(a), s = px(draw(a, w, h)), d = s;
      for (let i = 0; i < d.data.length; i += 4) for (let k = 0; k < 3; k++) {
        let v = d.data[i + k]; if (v > p.soglia) v = 255 - v; v = (v / p.soglia) * 255;
        d.data[i + k] = Math.max(0, Math.min(255, (v - 128) * p.contrasto + 128));
      }
      return out(w, h, d);
    },
  };

  P.canali = { // scollamento dei canali RGB
    name: "Scollamento canali", kind: "tonale", inputs: 1,
    note: "Rosso e blu si separano dalla forma: il colore smette di coincidere con l'oggetto.",
    params: { distanza: { min: 0, max: 60, step: 1, value: 18 }, verticale: { min: -40, max: 40, step: 1, value: 6 } },
    run([a], p) {
      const [w, h] = size(a), s = px(draw(a, w, h)), d = new ImageData(w, h);
      const at = (x, y) => ((Math.min(h - 1, Math.max(0, y)) * w) + Math.min(w - 1, Math.max(0, x))) * 4;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        d.data[i] = s.data[at(x - p.distanza, y - p.verticale)];
        d.data[i + 1] = s.data[i + 1];
        d.data[i + 2] = s.data[at(x + p.distanza, y + p.verticale) + 2];
        d.data[i + 3] = 255;
      }
      return out(w, h, d);
    },
  };

  P.rimescola = { // composizione: blocchi scambiati
    name: "Rimescolamento", kind: "compositivo", inputs: 1,
    note: "La griglia si rompe: alcuni frammenti cambiano posto, il resto resta testimone.",
    params: { celle: { min: 3, max: 24, step: 1, value: 8 }, probabilita: { min: 0, max: 1, step: 0.01, value: 0.35 }, seme: { min: 1, max: 999, step: 1, value: 4 } },
    run([a], p) {
      const [w, h] = size(a), c = draw(a, w, h), o = canvas(w, h), y = o.getContext("2d"), r = rng(p.seme);
      y.drawImage(c, 0, 0);
      const n = Math.round(p.celle), cw = Math.ceil(w / n), ch = Math.ceil(h / n), cells = [];
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) cells.push([i * cw, j * ch]);
      for (const [x0, y0] of cells) if (r() < p.probabilita) {
        const [x1, y1] = cells[Math.floor(r() * cells.length)];
        y.drawImage(c, x1, y1, cw, ch, x0, y0, cw, ch);
      }
      return o;
    },
  };

  P.campo = { // partenza da zero: campo di flusso
    name: "Campo di flusso", kind: "da zero", inputs: 0,
    note: "Nessuna sorgente: linee che seguono un campo di forze. Se scegli un'immagine, ne prende i toni.",
    params: { linee: { min: 200, max: 5000, step: 50, value: 1800 }, scala: { min: 0.5, max: 8, step: 0.1, value: 2.4 }, seme: { min: 1, max: 999, step: 1, value: 91 } },
    run(srcs, p) {
      const w = 1000, h = 1250, o = canvas(w, h), y = o.getContext("2d"), r = rng(p.seme);
      y.fillStyle = "#000"; y.fillRect(0, 0, w, h);
      const tone = srcs[0] ? px(draw(srcs[0], w, h)) : null;
      const nx = noise1(p.seme, 9), ny = noise1(p.seme + 7, 9);
      y.lineWidth = 0.7; y.globalAlpha = 0.42;
      for (let l = 0; l < p.linee; l++) {
        let x = r() * w, z = r() * h;
        if (tone) { const i = (Math.floor(z) * w + Math.floor(x)) * 4; y.strokeStyle = `rgb(${tone.data[i]},${tone.data[i + 1]},${tone.data[i + 2]})`; }
        else y.strokeStyle = "#f8f8f8";
        y.beginPath(); y.moveTo(x, z);
        for (let s = 0; s < 60; s++) {
          const ang = (nx(x / w) + ny(z / h)) * Math.PI * p.scala;
          x += Math.cos(ang) * 3; z += Math.sin(ang) * 3; y.lineTo(x, z);
          if (x < 0 || x > w || z < 0 || z > h) break;
        }
        y.stroke();
      }
      return o;
    },
  };

  // Processi generativi a pagamento: qui sono solo descrizioni. L'esecuzione
  // passa SEMPRE dal dialog di approvazione del costo.
  const PAID = {
    "hf-variazione": { name: "Variazione compositiva", engine: "Higgsfield", model: "modello di modifica (scelto dalla CLI)", credits: 6, inputs: 1, note: "Riorganizza masse e piani dell'immagine mantenendone la materia." },
    "hf-riferimento": { name: "Reinterpretazione da riferimento", engine: "Higgsfield", model: "modello con riferimento (scelto dalla CLI)", credits: 8, inputs: 2, note: "Usa la seconda immagine come struttura e la prima come materia." },
    "hf-idea": { name: "Generazione da ipotesi", engine: "Higgsfield", model: "modello testo→immagine (scelto dalla CLI)", credits: 5, inputs: 0, note: "Parte da un'ipotesi scritta, senza immagini iniziali." },
  };

  function defaults(id) { const o = {}; for (const [k, v] of Object.entries(P[id].params)) o[k] = v.value; return o; }

  window.AtelierProcesses = { local: P, paid: PAID, defaults, rng };
})();
