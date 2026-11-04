/* ATELIER — prototipo cliccabile dell'interfaccia.
   Tutto gira nel browser: i processi locali sono reali (canvas), le
   generazioni Higgsfield sono simulate e non spendono nulla. */
(function () {
  "use strict";
  const PR = window.AtelierProcesses, CR = window.AtelierCritic;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  function tile({ attrs = "", cls = "", img, alt = "", num = "", code: c = "", cat = "", foot = "", left = "", right = "", size }) {
    return `<button class="tile${cls}" ${attrs}><span class="tile__img"><img src="${img}" alt="${esc(alt)}" loading="lazy"></span>
      <span class="tile__info"><span class="tile__num">${num}</span><span class="tile__code"${size ? ` style="font-size:${size}px"` : ""}>${esc(c)}</span><span class="tile__cat">${esc(cat)}</span>${foot ? `<span class="tile__foot">${foot}</span>` : ""}</span>
      <span class="tile__rebate">${left}<span>${right}</span></span></button>`;
  }
  const now = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  /* ---------------- Stato ---------------- */
  const S = {
    view: "archivio",
    side: true, sideTab: "dettaglio",
    items: window.ATELIER_ARCHIVE.map((x) => ({ ...x, history: [{ t: x.imported, what: "Importata", meta: x.source }] })),
    sel: "a01", marks: new Set(), f: { tag: null, prov: null, rights: null }, q: "", density: "M",
    tela: ["a01", "a08"], telaView: "sorgenti", ground: "void", proc: "innesto", params: PR.defaults("innesto"), preview: null,
    nodes: [], cur: null, labMode: "ab", cmpA: null, cmpB: null, split: 50,
    engine: { connected: true, credits: 240, spent: 0 },
    chat: [], idea: "", zeroPath: "campo", zeroOut: null,
    exportSel: new Set(), fmt: "tiff16", sidecar: true,
    sim: null, railOpen: false, // "vuoto" | "caricamento" | "errore" per mostrare gli stati
  };
  let seq = 0;
  const phone = () => window.matchMedia("(max-width: 760px)").matches;
  if (phone()) S.side = false;

  /* ---------------- Immagini ---------------- */
  const cache = {};
  function loadImg(src) {
    if (cache[src]) return cache[src];
    cache[src] = new Promise((res, rej) => { const i = new Image(); i.decoding = "async"; i.onload = () => res(i); i.onerror = rej; i.src = src; });
    return cache[src];
  }
  const item = (id) => S.items.find((x) => x.id === id);
  const node = (id) => S.nodes.find((n) => n.id === id);
  const ref = (id) => item(id) || node(id);
  const code = (id) => { const r = ref(id); return r ? r.code : "?"; };
  const thumb = (id) => { const i = item(id); if (i) return i.file; const n = node(id); return n ? n.thumb : ""; };
  const full = (id) => { const i = item(id); if (i) return i.file; const n = node(id); return n ? n.full : ""; };
  async function el(id) { const n = node(id); if (n) return n.canvas; return loadImg(item(id).file); }

  /* ---------------- Esperimenti ---------------- */
  async function runLocal(procId, sources, params, opts = {}) {
    const p = PR.local[procId];
    const els = await Promise.all(sources.slice(0, Math.max(p.inputs, sources.length ? 1 : 0)).map(el));
    const c = p.run(els, params);
    return makeNode({ proc: procId, sources, params, canvas: c, paid: false, ...opts });
  }
  function makeNode({ proc, sources, params, canvas, paid, parent, note }) {
    seq += 1;
    const t = document.createElement("canvas"), k = 220 / Math.max(canvas.width, canvas.height);
    t.width = Math.round(canvas.width * k); t.height = Math.round(canvas.height * k);
    t.getContext("2d").drawImage(canvas, 0, 0, t.width, t.height);
    const info = PR.local[proc] || PR.paid[proc];
    const n = {
      id: "e" + pad(seq), code: "E" + pad(seq), proc, procName: info.name, sources: [...sources], params: { ...params },
      parent: parent || sources[0] || null, canvas, thumb: t.toDataURL("image/jpeg", 0.8), full: canvas.toDataURL("image/jpeg", 0.92),
      w: canvas.width, h: canvas.height, status: "materiale", marked: false, discarded: false, t: now(), paid: !!paid, note: note || "",
    };
    S.nodes.push(n);
    return n;
  }
  async function seed() {
    const a = await runLocal("innesto", ["a01", "a08"], PR.defaults("innesto"));
    const b = await runLocal("piega", [a.id], { asse: 0, posizione: 0.42 });
    const c = await runLocal("fessura", [a.id], { ampiezza: 0.3, onde: 5, seme: 23 });
    await runLocal("canali", [c.id], { distanza: 22, verticale: 4 });
    const e = await runLocal("deriva", ["a05", "a14"], { forza: 0.1, angolo: 60 });
    const f = await runLocal("sabattier", [e.id], { soglia: 132, contrasto: 1.5 });
    await runLocal("rimescola", ["a18"], { celle: 7, probabilita: 0.3, seme: 12 });
    b.status = "in esame"; f.status = "scelta"; f.marked = true;
    S.cur = c.id; S.cmpA = a.id; S.cmpB = c.id;
    S.exportSel.add(f.id);
    S.chat = [{ who: "critic", text: "Ho guardato l'innesto tra le alghe e le nuvole. La versione piegata è più ordinata, ma la fessura è l'unica in cui non capisco subito cosa sto guardando. Ti suggerisco di continuare da lì, non dalla più bella." }];
    render();
  }

  /* ---------------- Rendering generale ---------------- */
  const main = $("#main"), side = $("#side");
  function render() {
    $$(".nav__item").forEach((b) => b.setAttribute("aria-current", b.dataset.go === S.view ? "page" : "false"));
    $("#shell").dataset.side = S.side ? "open" : "closed";
    const eb = $("#engineBtn");
    eb.innerHTML = S.engine.connected
      ? `<span class="dot"></span>Higgsfield <span class="credits">${S.engine.credits} cr</span>`
      : `<span class="dot dot--off"></span>Higgsfield non collegato`;
    const V = { archivio: vArchive, tela: vTela, laboratorio: vLab, zero: vZero, esporta: vExport, sistema: vSystem }[S.view];
    main.innerHTML = V();
    renderSide();
    renderStatus();
    after[S.view] && after[S.view]();
  }
  function renderStatus() {
    const fin = S.nodes.filter((n) => n.status === "finita").length;
    $("#status").innerHTML = `
      <span>~/ATELIER/progetto-01</span>
      <span>${S.items.length} sorgenti</span>
      <span>${S.nodes.length} esperimenti</span>
      <span>${fin} ${fin === 1 ? "opera dichiarata finita" : "opere dichiarate finite"} — solo da te</span>
      <span class="status__end"><span>processi locali · nessuna rete</span><span>spesa sessione ${S.engine.spent} cr (simulata)</span></span>`;
  }
  const after = {};

  /* ---------------- 01 Archivio ---------------- */
  function filtered() {
    return S.items.filter((x) =>
      (!S.f.tag || x.tags.includes(S.f.tag)) && (!S.f.prov || x.provenance === S.f.prov) && (!S.f.rights || x.rightsState === S.f.rights) &&
      (!S.q || (x.title + " " + x.author + " " + x.tags.join(" ")).toLowerCase().includes(S.q.toLowerCase())));
  }
  function facet(name, key, opts) {
    return `<div class="facet"><div class="label facet__head">${name}</div>${opts.map(([v, label, n]) =>
      `<button class="facet__opt" data-facet="${key}" data-v="${esc(v)}" aria-pressed="${S.f[key] === v}"><span>${esc(label)}</span><span>${n}</span></button>`).join("")}</div>`;
  }
  function vArchive() {
    if (S.sim === "caricamento") return archiveShell(`<div class="sheet" style="--cols:6">${Array.from({ length: 18 }, (_, i) => `<div class="tile skeleton${i % 7 === 0 ? " tile--wide" : ""}"></div>`).join("")}</div>`);
    if (S.sim === "errore") return archiveShell(stateBox("!", "L'archivio non si apre", "Il file <span class='meta'>~/ATELIER/progetto-01/archivio.sqlite</span> non è leggibile. Le immagini sono al sicuro nella cartella <span class='meta'>sorgenti/</span>: nessun file è stato toccato.", `<button class="btn" data-act="sim-off">Riprova</button><button class="btn btn--quiet" data-act="sim-off">Apri la cartella</button>`, true));
    const list = S.sim === "vuoto" ? [] : filtered();
    if (!list.length) return archiveShell(S.sim === "vuoto" || !S.items.length
      ? stateBox("0", "L'archivio è vuoto", "Trascina qui fotografie, scansioni o file digitali, oppure incolla un indirizzo. Puoi anche partire senza immagini.", `<button class="btn" data-act="pick-files">Scegli file…</button><button class="btn btn--quiet" data-go="zero">Parti da zero →</button>`)
      : stateBox("—", "Nessuna immagine con questi filtri", "Togli un filtro per vedere di più.", `<button class="btn" data-act="clear-filters">Togli i filtri</button>`));
    const cols = phone() ? { S: 4, M: 3, L: 2 }[S.density] : { S: 8, M: 6, L: 4 }[S.density], row = phone() ? { S: 100, M: 140, L: 210 }[S.density] : { S: 150, M: 210, L: 300 }[S.density];
    let tiles = list.map((x, i) => {
      const r = x.w / x.h, cls = r > 1.6 ? " tile--wide" : (i % 9 === 4 && r < 0.9 ? " tile--tall" : "");
      return tile({ cls, attrs: `data-sel="${x.id}" aria-selected="${S.sel === x.id}" data-marked="${S.marks.has(x.id)}" title="${esc(x.title)}"`, img: x.file, alt: x.title,
        num: pad(S.items.indexOf(x) + 1), code: x.code, cat: x.tags[0], foot: `<span>${esc(x.author)}</span><span>${x.w}×${x.h}</span>`,
        left: `<b>${pad(S.items.indexOf(x) + 1)}</b> ${esc(x.code)}`, right: `${esc(x.date)} · ${x.rightsState === "libero" ? "CC0" : "diritti ?"}` });
    });
    const fin = S.nodes.filter((n) => n.status === "finita").length;
    tiles.splice(Math.min(2, tiles.length), 0, `<div class="tile tile--text"><span class="label">Stato del progetto</span>
      <span class="code" style="font-size:44px">${S.items.length}</span><span class="muted" style="font-size:12px">sorgenti · ${S.nodes.length} esperimenti · ${fin} finite</span>
      <span class="muted" style="font-size:11px;margin-top:auto;line-height:1.5">Il laboratorio non decide quando un'opera è finita. Lo decidi tu, con un gesto esplicito.</span></div>`);
    return archiveShell(`<div class="sheet" style="--cols:${cols};--row:${row}px">${tiles.join("")}</div>`, list.length);
  }
  function archiveShell(content, n) {
    const tags = {}; S.items.forEach((x) => x.tags.forEach((t) => (tags[t] = (tags[t] || 0) + 1)));
    const count = (k, v) => S.items.filter((x) => x[k] === v).length;
    return `<div class="view" data-rail="${S.railOpen ? "open" : "closed"}">
      <div class="rail">
        <div class="only-phone" style="justify-content:space-between;align-items:center"><span class="label">Filtri e importazione</span><button class="btn" data-act="rail-close">Fatto</button></div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div class="label">Importa</div>
          <div class="field-row"><input class="field" id="urlIn" placeholder="Incolla un indirizzo immagine"><button class="btn btn--quiet" data-act="import-url">↵</button></div>
          <button class="btn" data-act="pick-files" style="justify-content:space-between">Trascina o scegli file <span class="btn__key">⌘O</span></button>
          <input type="file" id="fileIn" accept="image/*" multiple hidden>
        </div>
        ${facet("Provenienza", "prov", [["Archivio storico", "Archivio storico", count("provenance", "Archivio storico")], ["Fotografia originale", "Fotografia originale", count("provenance", "Fotografia originale")], ["Materiale digitale", "Materiale digitale", count("provenance", "Materiale digitale")], ["Da classificare", "Da classificare", count("provenance", "Da classificare")]])}
        ${facet("Diritti", "rights", [["libero", "Pubblico dominio / libero", count("rightsState", "libero")], ["verificare", "Da verificare", count("rightsState", "verificare")], ["personale", "Solo uso personale", count("rightsState", "personale")]])}
        <div class="facet"><div class="label facet__head">Tag</div><div class="tags">${Object.entries(tags).sort((a, b) => b[1] - a[1]).map(([t, k]) =>
          `<button class="tag" data-facet="tag" data-v="${esc(t)}" aria-pressed="${S.f.tag === t}">${esc(t)} <span class="tag__n">${k}</span></button>`).join("")}</div></div>
      </div>
      <div class="pane" id="dropzone">
        <div class="pane__head"><h1 class="title">Archivio</h1><span class="meta">${n ?? 0} di ${S.items.length}</span>
          <div class="pane__tools">
            <input class="field" id="qIn" placeholder="Cerca titolo, autore, tag" value="${esc(S.q)}" style="width:220px">
            <div class="seg" role="group" aria-label="Densità">${["S", "M", "L"].map((d) => `<button class="seg__opt" data-density="${d}" aria-pressed="${S.density === d}">${d}</button>`).join("")}</div>
            <button class="btn only-phone" data-act="rail-open">Filtri${S.f.tag || S.f.prov || S.f.rights ? " ·1" : ""}</button>
            <button class="btn only-desk" data-act="to-tela" ${S.sel ? "" : "disabled"}>Porta sulla tela →</button>
          </div></div>
        ${content}
        <div class="drop" id="dropOverlay"><div style="text-align:center"><div class="hero-num">+</div><div class="label" style="color:var(--salt)">Rilascia per importare</div><div class="meta" style="margin-top:6px">Copio i file in sorgenti/ senza modificarli</div></div></div>
      </div></div>`;
  }
  function stateBox(glyph, title, body, acts, err) {
    return `<div class="state${err ? " state--error" : ""}"><div class="state__box"><div class="state__glyph">${glyph}</div><h2 class="title" style="font-size:22px">${title}</h2><p class="prose muted" style="margin:0">${body}</p><div style="display:flex;gap:8px">${acts || ""}</div></div></div>`;
  }
  after.archivio = () => {
    const dz = $("#dropzone"), ov = $("#dropOverlay"); if (!dz) return;
    let depth = 0;
    dz.addEventListener("dragenter", (e) => { e.preventDefault(); depth++; ov.dataset.active = "true"; });
    dz.addEventListener("dragover", (e) => e.preventDefault());
    dz.addEventListener("dragleave", () => { if (--depth <= 0) { depth = 0; ov.dataset.active = "false"; } });
    dz.addEventListener("drop", (e) => { e.preventDefault(); depth = 0; ov.dataset.active = "false"; importFiles(e.dataTransfer.files); });
    const q = $("#qIn"); q && q.addEventListener("input", () => { S.q = q.value; const pos = q.selectionStart; render(); const nq = $("#qIn"); nq.focus(); nq.setSelectionRange(pos, pos); });
    $("#fileIn").addEventListener("change", (e) => importFiles(e.target.files));
  };
  function importFiles(files) {
    const imgs = Array.from(files || []).filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return toast("Nessuna immagine nei file rilasciati.");
    imgs.forEach((f) => {
      const url = URL.createObjectURL(f), id = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const it = { id, code: f.name.replace(/[^a-z]/gi, "").slice(0, 2).replace(/^./, (c) => c.toUpperCase()) || "Nf", title: f.name.replace(/\.[^.]+$/, ""), original: f.name, author: "—", date: new Date().getFullYear(), medium: f.type,
        file: url, w: 0, h: 0, provenance: "Da classificare", source: "File locale: " + f.name, url: "", rights: "Da verificare", rightsState: "verificare", tags: ["nuovo"], imported: now(), maxpx: 0, history: [{ t: now(), what: "Importata per trascinamento", meta: `${f.name} · ${(f.size / 1048576).toFixed(1)} MB · copiata in sorgenti/` }] };
      loadImg(url).then((i) => { it.w = i.naturalWidth; it.h = i.naturalHeight; it.maxpx = Math.max(it.w, it.h); render(); });
      S.items.unshift(it); S.sel = id;
    });
    S.sideTab = "dettaglio"; S.side = true; render();
    toast(`${imgs.length} ${imgs.length === 1 ? "immagine importata" : "immagini importate"}. Provenienza e diritti da completare.`);
  }
  function importUrl() {
    const v = ($("#urlIn") || {}).value || ""; if (!/^https?:\/\//.test(v)) return toast("Incolla un indirizzo che inizia con http:// o https://");
    const id = "w" + Date.now().toString(36);
    S.items.unshift({ id, code: "Ur", title: v.split("/").pop().split("?")[0] || "Immagine dal web", original: v, author: "—", date: "—", medium: "web", file: v, w: 0, h: 0, provenance: "Materiale digitale", source: v, url: v, rights: "Da verificare: indirizzo esterno", rightsState: "verificare", tags: ["web"], imported: now(), maxpx: 0, history: [{ t: now(), what: "Importata da indirizzo", meta: v }] });
    S.sel = id; S.sideTab = "dettaglio"; render(); toast("Scaricata dall'indirizzo. Controlla i diritti prima di usarla in un'opera.");
  }

  /* ---------------- 02 Tela ---------------- */
  function vTela() {
    const p = PR.local[S.proc], paid = PR.paid[S.proc];
    const n = S.tela.length;
    const layers = S.tela.map((id, i) => `<div class="layer"><img src="${full(id)}" alt=""><span class="layer__tag meta" style="color:var(--salt)">${String.fromCharCode(65 + i)} · ${esc(code(id))}</span><button class="btn btn--quiet layer__x" data-untela="${i}" title="Togli dalla tela">×</button></div>`).join("")
      + (n < 4 ? `<div class="layer"><button class="slot-empty" data-act="pick-slot">+ aggiungi dall'archivio o dal laboratorio</button></div>` : "");
    const cells = Math.min(4, n + (n < 4 ? 1 : 0));
    const stage = S.telaView === "anteprima" && S.preview
      ? `<img src="${S.preview.full}" alt="Anteprima">`
      : `<div class="layers" data-n="${cells}">${layers}</div>`;
    const params = p ? Object.entries(p.params).map(([k, d]) => `<label class="param"><span class="label">${k}</span><span class="meta"><b>${d.labels ? d.labels[S.params[k] >= 0.5 ? 1 : 0] : S.params[k]}</b></span>
      <input class="range" type="range" min="${d.min}" max="${d.max}" step="${d.step}" value="${S.params[k]}" data-param="${k}"></label>`).join("") : "";
    const needs = (p || paid).inputs, ok = n >= needs && (needs > 0 || true);
    return `<div class="view view--full"><div class="stage" data-ground="${S.ground}">
      <div class="pane__head"><h1 class="title">Tela</h1><span class="meta">${n} ${n === 1 ? "sorgente" : "sorgenti"} · ${S.tela.map(code).join(" × ") || "vuota"}</span>
        <div class="pane__tools">
          <div class="seg">${[["sorgenti", "Affianca"], ["anteprima", "Anteprima risultato"]].map(([v, l]) => `<button class="seg__opt" data-tview="${v}" aria-pressed="${S.telaView === v}" ${v === "anteprima" && !S.preview ? "disabled" : ""}>${l}</button>`).join("")}</div>
          <div class="seg" title="Fondo del visore">${[["void", "Nero"], ["neutral", "Grigio 18%"]].map(([v, l]) => `<button class="seg__opt" data-ground="${v}" aria-pressed="${S.ground === v}">${l}</button>`).join("")}</div>
        </div></div>
      <div class="stage__canvas">${stage}</div>
      <div class="controls">
        <div class="controls__main">
          <div style="display:flex;gap:10px;align-items:baseline"><span class="proc__title">${esc((p || paid).name)}</span>
            <span class="meta">${p ? "locale · gratis · " + p.kind : "Higgsfield · a pagamento"} · ${needs ? `richiede ${needs} ${needs === 1 ? "sorgente" : "sorgenti"}` : "nessuna sorgente"}</span></div>
          <p class="prose muted" style="margin:0;font-size:12px">${esc((p || paid).note)}</p>
          ${p ? `<div class="params" style="--n:${Object.keys(p.params).length}">${params}</div>` : `<div class="notice notice--mark"><span class="dot dot--mark" style="margin-top:4px"></span><span>Prima di partire ti mostro modello, parametri e crediti. Niente viene speso senza il tuo consenso esplicito.</span></div>`}
        </div>
        <div class="controls__acts">
          ${!ok ? `<span class="meta">Aggiungi ${needs - n} ${needs - n === 1 ? "sorgente" : "sorgenti"} sulla tela per usare questo processo.</span>` : ""}
          ${p ? `<button class="btn" data-act="preview" ${ok ? "" : "disabled"}>Anteprima</button><button class="btn btn--solid btn--lg" data-act="make" ${ok ? "" : "disabled"}>Crea variante nel laboratorio →</button>`
              : `<button class="btn btn--lg btn--paid" data-act="quote" ${ok ? "" : "disabled"}>Prepara la generazione <span class="btn__cost">~${paid.credits} cr / variante</span></button>`}
        </div>
      </div>
      <div class="procbar">
        <div class="procbar__group"><div class="label">Processi locali · gratis, sul tuo Mac</div>
          <div class="procbar__list">${Object.entries(PR.local).filter(([, v]) => v.inputs > 0).map(([id, v]) => `<button class="proc" data-proc="${id}" aria-pressed="${S.proc === id}"><span class="proc__name">${v.name}</span><span class="meta">${v.kind} · ${v.inputs} ${v.inputs === 1 ? "img" : "img"}</span></button>`).join("")}</div></div>
        <div class="procbar__group"><div class="label">Generativi · Higgsfield, con approvazione</div>
          <div class="procbar__list">${Object.entries(PR.paid).filter(([, v]) => v.inputs > 0).map(([id, v]) => `<button class="proc proc--paid" data-proc="${id}" aria-pressed="${S.proc === id}"><span class="proc__name">${v.name}</span><span class="meta">~${v.credits} cr · ${v.inputs} img</span></button>`).join("")}</div></div>
      </div></div></div>`;
  }
  async function doPreview() {
    const p = PR.local[S.proc]; if (!p) return;
    const els = await Promise.all(S.tela.slice(0, p.inputs).map(el));
    const c = p.run(els, S.params);
    S.preview = { full: c.toDataURL("image/jpeg", 0.9) }; S.telaView = "anteprima"; render();
  }
  async function doMake() {
    const p = PR.local[S.proc]; if (!p) return;
    const n = await runLocal(S.proc, S.tela.slice(0, p.inputs), S.params);
    S.cur = n.id; S.cmpA = n.parent; S.cmpB = n.id;
    toast(`${n.code} creata: ${n.procName} su ${n.sources.map(code).join(" × ")}.`, "Apri nel laboratorio", () => go("laboratorio"));
    S.preview = { full: n.full }; S.telaView = "anteprima"; render();
  }

  /* ---------------- 03 Laboratorio ---------------- */
  function treeHTML() {
    const roots = [...new Set(S.nodes.map((n) => n.parent).filter((p) => item(p)))];
    const branch = (pid, depth) => S.nodes.filter((n) => n.parent === pid).map((n) => `
      <li><button class="node" data-node="${n.id}" aria-current="${S.cur === n.id}" data-marked="${n.marked}" data-discarded="${n.discarded}" style="padding-left:${16 + depth * 18}px">
        <span class="node__img"><img src="${n.thumb}" alt=""></span>
        <span class="node__txt"><span class="node__name">${n.code} · ${esc(n.procName)}</span><span class="meta">${n.sources.map(code).join(" × ")} · ${n.t}${n.paid ? " · Higgsfield" : ""}</span>
        <span class="status-chip" data-s="${n.status}">${n.status}</span></span></button>
        <ul>${branch(n.id, depth + 1)}</ul></li>`).join("");
    return roots.map((r) => `<li><button class="node" data-sel-src="${r}" style="padding-left:16px"><span class="node__img"><img src="${item(r).file}" alt=""></span>
      <span class="node__txt"><span class="node__name">${esc(item(r).code)} · ${esc(item(r).title)}</span><span class="meta">sorgente · ${esc(item(r).author)}</span></span></button>
      <ul>${branch(r, 1)}</ul></li>`).join("");
  }
  function vLab() {
    if (!S.nodes.length) return `<div class="view view--full">${stateBox("∅", "Ancora nessun esperimento", "Porta una o più immagini sulla tela e applica un processo: ogni risultato diventa un ramo qui.", `<button class="btn" data-go="tela">Vai alla tela</button>`)}</div>`;
    const n = node(S.cur) || S.nodes[0];
    const A = S.cmpA || n.parent, B = S.cmpB || n.id;
    let stage;
    if (S.labMode === "ab") stage = `<div class="compare" id="cmp" style="--split:${S.split}%">
        <div class="compare__a"><img src="${full(A)}" alt=""></div><div class="compare__b"><img src="${full(B)}" alt=""></div>
        <div class="compare__handle" id="cmpH"></div>
        <span class="compare__lbl" style="left:0">A · ${esc(code(A))}</span><span class="compare__lbl" style="right:0">B · ${esc(code(B))}</span></div>`;
    else if (S.labMode === "griglia") stage = `<div class="vgrid" style="--cols:4;width:100%;align-self:start">${S.nodes.filter((x) => !x.discarded).map((x) =>
        tile({ attrs: `data-node="${x.id}" aria-selected="${x.id === n.id}" data-marked="${x.marked}"`, img: x.thumb, num: x.t, code: x.code, cat: x.procName, size: 30, left: `<b>${x.code}</b>`, right: x.status })).join("")}</div>`;
    else stage = `<img src="${n.full}" alt="">`;
    const pr = Object.entries(n.params).map(([k, v]) => `${k} <b>${v}</b>`).join(" · ");
    const pick = (slot) => `<select class="field" data-cmp="${slot}" style="width:auto;padding:4px 0">${[...new Set([n.parent, ...S.nodes.map((x) => x.id), ...S.nodes.map((x) => x.parent)])].filter(Boolean).map((id) =>
      `<option value="${id}" ${(slot === "A" ? A : B) === id ? "selected" : ""}>${slot} · ${esc(code(id))}</option>`).join("")}</select>`;
    return `<div class="view">
      <div class="rail rail--tree"><div class="panel__head"><span class="label">Albero degli esperimenti</span><span class="meta" style="margin-left:auto">${S.nodes.length}</span></div>
        <ul class="tree">${treeHTML()}</ul></div>
      <div class="pane pane--col">
        <div class="pane__head"><h1 class="title">${n.code}</h1><span class="meta">${esc(n.procName)} · ${n.sources.map(code).join(" × ")}</span><span class="status-chip" data-s="${n.status}">${n.status}</span>
          <div class="pane__tools">
            ${S.labMode === "ab" ? pick("A") + pick("B") : ""}
            <div class="seg">${[["ab", "A/B"], ["griglia", "Griglia"], ["singola", "Singola"]].map(([v, l]) => `<button class="seg__opt" data-lab="${v}" aria-pressed="${S.labMode === v}">${l}</button>`).join("")}</div>
            <div class="seg">${[["void", "Nero"], ["neutral", "18%"]].map(([v, l]) => `<button class="seg__opt" data-ground="${v}" aria-pressed="${S.ground === v}">${l}</button>`).join("")}</div>
          </div></div>
        <div class="stage" data-ground="${S.ground}" style="flex:1;min-height:0"><div class="stage__canvas" style="${S.labMode === "griglia" ? "place-items:start;padding:0;overflow:auto" : ""}">${stage}</div></div>
        <div class="actbar">
          <span class="meta actbar__info">${pr || "nessun parametro"} · ${n.w}×${n.h} px · ${n.paid ? "Higgsfield (simulato)" : "locale, 0 crediti"} · creata ${n.t}</span>
          <button class="btn" data-act="branch">Ramifica sulla tela</button>
          <button class="btn" data-act="mark">${n.marked ? "Togli il segno" : "Segna"} <span class="btn__key">M</span></button>
          <button class="btn btn--quiet" data-act="discard">${n.discarded ? "Ripristina" : "Scarta"}</button>
          <button class="btn" data-act="review">${n.status === "in esame" ? "Torna a materiale" : "Metti in esame"}</button>
          <button class="btn ${n.status === "finita" ? "" : "btn--paid"}" data-act="finish">${n.status === "finita" ? "Riapri" : "Dichiara finita…"}</button>
        </div></div></div>`;
  }
  after.laboratorio = () => {
    const c = $("#cmp"), h = $("#cmpH"); if (!c) return;
    const move = (e) => { const r = c.getBoundingClientRect(); S.split = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)); c.style.setProperty("--split", S.split + "%"); };
    c.addEventListener("pointerdown", (e) => { c.setPointerCapture(e.pointerId); move(e); c.onpointermove = move; });
    c.addEventListener("pointerup", () => (c.onpointermove = null));
  };

  /* ---------------- 04 Da zero ---------------- */
  function vZero() {
    const paid = PR.paid["hf-idea"];
    const paths = [
      ["campo", "Processo algoritmico", "Campo di flusso, sul tuo Mac. Nessun costo. Se scegli una sorgente, ne prende i toni.", "0 cr"],
      ["archivio", "Accostamento dall'archivio", "L'interlocutore sceglie due sorgenti lontane fra loro in base all'ipotesi e le porta sulla tela.", "0 cr"],
      ["hf-idea", "Generazione AI", `Higgsfield, ${paid.model}. Parte dal testo dell'ipotesi.`, `~${paid.credits} cr`],
    ];
    const out = S.zeroOut ? `<img src="${S.zeroOut.full}" alt="" style="max-height:100%;object-fit:contain">` : stateBox("·", "Nessuna immagine iniziale", "Scrivi un'ipotesi, scegli un processo. Il risultato diventa la prima sorgente di un nuovo ramo.");
    return `<div class="blank">
      <div class="blank__write">
        <div class="label">04 · Ipotesi</div>
        <textarea class="blank__idea" id="idea" placeholder="Scrivi un'idea, non un prompt. Una tensione, un'incongruenza, una domanda.">${esc(S.idea)}</textarea>
        <div style="display:flex;flex-direction:column;gap:8px"><div class="label">L'interlocutore propone</div>
          ${CR.ZERO_IDEAS.map((t, i) => `<div class="hypo"><span class="hypo__n">H${i + 1}</span><div class="hypo__body"><span class="hypo__title">${esc(t)}</span><div class="hypo__acts"><button class="btn btn--quiet" data-idea="${i}" style="padding:0">Usa come ipotesi →</button></div></div></div>`).join("")}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px"><div class="label">Come procedere</div>
          <div class="choice">${paths.map(([v, t, d, c]) => `<label class="choice__opt"><input type="radio" name="zp" value="${v}" ${S.zeroPath === v ? "checked" : ""}><span><span style="display:block;font-size:13px">${t}</span><span class="muted" style="font-size:12px">${esc(d)}</span></span><span class="meta" style="${v === "hf-idea" ? "color:var(--mark)" : ""}">${c}</span></label>`).join("")}</div>
        </div>
        <div style="display:flex;gap:8px"><button class="btn btn--solid btn--lg" data-act="zero-go">${S.zeroPath === "hf-idea" ? "Prepara la generazione…" : "Avvia"}</button>${S.zeroOut ? `<button class="btn btn--lg" data-act="zero-keep">Tieni come sorgente nel laboratorio</button>` : ""}</div>
      </div>
      <div class="stage" data-ground="${S.ground}"><div class="stage__canvas">${out}</div></div></div>`;
  }
  after.zero = () => {
    const t = $("#idea"); t && t.addEventListener("input", () => (S.idea = t.value));
    $$('input[name="zp"]').forEach((r) => r.addEventListener("change", () => { S.zeroPath = r.value; render(); }));
  };
  async function zeroGo() {
    if (S.zeroPath === "hf-idea") return openCost("hf-idea", []);
    if (S.zeroPath === "archivio") {
      const words = (S.idea || "albero cielo").toLowerCase();
      const scored = S.items.map((x) => ({ x, s: x.tags.filter((t) => words.includes(t)).length + Math.random() * 0.5 })).sort((a, b) => b.s - a.s);
      const a = scored[0].x, b = scored.slice(1).find((o) => !o.x.tags.some((t) => a.tags.includes(t)))?.x || scored[1].x;
      S.tela = [a.id, b.id]; S.proc = "innesto"; S.params = PR.defaults("innesto"); S.telaView = "sorgenti";
      toast(`Ho accostato ${a.code} e ${b.code}: hanno pochissimo in comune, ed è il motivo.`); return go("tela");
    }
    const seedN = Math.floor(Math.random() * 999) + 1, p = PR.local.campo, prm = { ...PR.defaults("campo"), seme: seedN };
    const c = p.run([], prm); S.zeroOut = { canvas: c, full: c.toDataURL("image/jpeg", 0.9), params: prm }; render();
  }
  function zeroKeep() {
    const z = S.zeroOut; if (!z) return;
    const n = makeNode({ proc: "campo", sources: [], params: z.params, canvas: z.canvas, paid: false, note: S.idea });
    n.parent = null; S.cur = n.id; S.cmpA = n.id; S.cmpB = n.id;
    // Un esperimento nato da zero diventa una sorgente: lo aggiungo all'archivio
    S.items.unshift({ id: n.id + "s", code: n.code, title: S.idea || "Campo di flusso", original: "", author: "ATELIER · processo algoritmico", date: "2026", medium: "Campo di flusso, seme " + z.params.seme, file: n.full, w: n.w, h: n.h, provenance: "Materiale digitale", source: "Generata localmente", url: "", rights: "Tua", rightsState: "libero", tags: ["da zero", "algoritmo"], imported: now(), maxpx: Math.max(n.w, n.h), history: [{ t: now(), what: "Generata da zero", meta: "Campo di flusso · seme " + z.params.seme }] });
    S.nodes = S.nodes.filter((x) => x !== n); seq -= 1; S.cur = S.nodes.length ? S.nodes[S.nodes.length - 1].id : null;
    S.sel = n.id + "s"; S.zeroOut = null; toast("Aggiunta all'archivio come sorgente.", "Apri l'archivio", () => go("archivio")); render();
  }

  /* ---------------- 05 Esporta ---------------- */
  function vExport() {
    const cand = S.nodes.filter((n) => !n.discarded).sort((a, b) => (b.marked - a.marked) || (["finita", "scelta", "in esame", "materiale"].indexOf(a.status) - ["finita", "scelta", "in esame", "materiale"].indexOf(b.status)));
    const sel = cand.filter((n) => S.exportSel.has(n.id));
    const fmts = [
      ["tiff16", "TIFF 16 bit, senza compressione", "Consigliato per Lightroom: massimo margine su luce e colore.", "~" + (sel.reduce((s, n) => s + n.w * n.h * 6, 0) / 1048576).toFixed(1) + " MB"],
      ["png16", "PNG 16 bit", "Senza perdita, più leggero del TIFF.", ""],
      ["jpeg", "JPEG qualità 100", "Solo per anteprime o invio veloce: comprime.", ""],
    ];
    const first = sel[0];
    const sidecar = first ? JSON.stringify({ opera: first.code, stato: first.status, decisa_da: first.status === "finita" ? "artista" : null, processo: first.proc, parametri: first.params, sorgenti: first.sources.map((s) => { const i = item(s); return i ? { codice: i.code, titolo: i.original, autore: i.author, diritti: i.rights, fonte: i.url } : { esperimento: code(s) }; }), motore: first.paid ? "higgsfield" : "locale", crediti: 0, dimensioni_px: [first.w, first.h], ingrandimento: false }, null, 2) : "";
    return `<div class="view view--two">
      <div class="pane"><div class="pane__head"><h1 class="title">Esporta</h1><span class="meta">${sel.length} selezionate</span></div>
        <div class="vgrid" style="--cols:3">${cand.map((n) => tile({ attrs: `data-exp="${n.id}" aria-selected="${S.exportSel.has(n.id)}" data-marked="${n.marked}"`, img: n.thumb, num: `${n.w}×${n.h}`, code: n.code, cat: n.status, size: 30, left: `<b>${S.exportSel.has(n.id) ? "■" : "□"} ${n.code}</b>`, right: n.status })).join("")}</div></div>
      <div class="pane"><div class="form-col">
        <div style="display:flex;flex-direction:column;gap:8px"><div class="label">Formato</div><div class="choice">${fmts.map(([v, t, d, s]) => `<label class="choice__opt"><input type="radio" name="fmt" value="${v}" ${S.fmt === v ? "checked" : ""}><span><span style="display:block;font-size:13px">${t}</span><span class="muted" style="font-size:12px">${d}</span></span><span class="meta">${v === S.fmt ? s : ""}</span></label>`).join("")}</div></div>
        <dl class="dl"><dt>Dimensione</dt><dd>Nativa, la massima disponibile: ${first ? `${first.w} × ${first.h} px` : "—"}. Nessun ingrandimento automatico.</dd>
          <dt>Colore</dt><dd>Profilo della sorgente incorporato. Nessuna conversione silenziosa.</dd>
          <dt>Cartella</dt><dd class="meta"><b>~/Pictures/ATELIER/Per Lightroom/</b></dd>
          <dt>Nomi</dt><dd class="meta">${first ? `<b>2026-11-04_${first.code}_${first.proc}.tif</b>` : "—"}</dd></dl>
        <label class="choice__opt" style="border:var(--hair) solid var(--seam)"><input type="checkbox" id="sidecar" ${S.sidecar ? "checked" : ""}><span><span style="display:block;font-size:13px">File .json con la cronologia accanto all'immagine</span><span class="muted" style="font-size:12px">Sorgenti, diritti, processi, parametri e semi: puoi sempre risalire a come è nata.</span></span><span></span></label>
        ${S.sidecar && first ? `<pre class="meta" style="margin:0;border:var(--hair) solid var(--seam);padding:var(--s-3);max-height:220px;overflow:auto;white-space:pre-wrap">${esc(sidecar)}</pre>` : ""}
        <div class="notice"><span>L'esportazione non dichiara finita nessuna opera. Le versioni restano nel laboratorio come le hai lasciate.</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn--solid btn--lg" data-act="export" ${sel.length ? "" : "disabled"}>Esporta ${sel.length} ${sel.length === 1 ? "file" : "file"}</button>
          <button class="btn btn--lg" data-act="download" ${sel.length ? "" : "disabled"}>Scarica PNG adesso (prototipo)</button></div>
      </div></div></div>`;
  }
  after.esporta = () => {
    $$('input[name="fmt"]').forEach((r) => r.addEventListener("change", () => { S.fmt = r.value; render(); }));
    const sc = $("#sidecar"); sc && sc.addEventListener("change", () => { S.sidecar = sc.checked; render(); });
  };

  /* ---------------- Sistema (design system dal vivo) ---------------- */
  function vSystem() {
    const sw = [["--void", "#000000", "Fondo di tutto"], ["--raise", "#111111", "Dialog e menu"], ["--salt", "#f8f8f8", "Testo, icone, bordo attivo"], ["--ash", "#7b7b7b", "Etichette e secondario"], ["--seam", "12% salt", "Ogni giuntura e bordo"], ["--mark", "#ff4d2e", "Solo decisioni e costi"], ["--neutral-18", "#767676", "Fondo del visore per giudicare il colore"]];
    return `<div class="pane" style="height:100%"><div class="pane__head"><h1 class="title">Sistema</h1><span class="meta">tokens.css · components.css</span></div>
      <div style="padding:var(--s-5) var(--s-4);display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:var(--s-6)">
        <section style="display:flex;flex-direction:column;gap:10px"><div class="label">Principio</div>
          <p class="critic__text" style="margin:0">Provino a contatto in camera oscura. L'interfaccia è nera, fatta di giunture da un pixel e testo leggero. Il colore appartiene solo alle immagini.</p>
          <p class="prose muted" style="margin:0">Un solo accento, la matita grassa rossa con cui i fotografi segnano i provini: compare solo quando qualcosa è una tua decisione o chiede il tuo consenso. Il sistema non la usa mai da solo.</p></section>
        <section style="display:flex;flex-direction:column;gap:0"><div class="label" style="margin-bottom:10px">Colore</div>${sw.map(([t, v, r]) => `<div style="display:grid;grid-template-columns:44px 1fr auto;gap:12px;align-items:center;border-top:var(--hair) solid var(--seam);padding:6px 0"><span style="height:28px;background:var(${t});outline:var(--hair) solid var(--seam)"></span><span style="font-size:12px">${r}</span><span class="meta">${t} ${v}</span></div>`).join("")}</section>
        <section style="display:flex;flex-direction:column;gap:12px"><div class="label">Tipografia</div>
          <div class="code">Ct Lu Rx</div><span class="meta">Space Grotesk 300 · 44 px · −0.04em · codici delle celle</span>
          <div class="title">Laboratorio di ricerca</div><span class="meta">Space Grotesk 300 · 29 px · titoli</span>
          <div class="critic__text">Coerente non vuol dire interessante.</div><span class="meta">DM Sans 300 · 16 px · voce dell'interlocutore</span>
          <div class="label">Etichetta di servizio</div><span class="meta">DM Sans 300 · 10 px · maiuscolo · +0.14em</span>
          <div class="meta"><b>seme 17 · 1143×1400 px · 6 cr</b></div><span class="meta">DM Mono 300 · 11 px · dati e numeri</span></section>
        <section style="display:flex;flex-direction:column;gap:12px"><div class="label">Controlli</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn">Normale</button><button class="btn btn--solid">Principale</button><button class="btn btn--quiet">Discreto</button><button class="btn" disabled>Disattivo</button></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn--paid">Prepara la generazione <span class="btn__cost">~6 cr</span></button><button class="hold" data-act="demo-hold"><span class="hold__fill"></span><span class="hold__lbl">Tieni premuto</span></button></div>
          <div class="seg"><button class="seg__opt" aria-pressed="true">A/B</button><button class="seg__opt">Griglia</button><button class="seg__opt">Singola</button></div>
          <div class="tags"><button class="tag" aria-pressed="true">cianotipia <span class="tag__n">4</span></button><button class="tag">mare <span class="tag__n">2</span></button></div>
          <div style="display:flex;gap:16px"><span class="status-chip" data-s="materiale">materiale</span><span class="status-chip" data-s="in esame">in esame</span><span class="status-chip" data-s="scelta">scelta</span><span class="status-chip" data-s="finita">finita</span></div>
          <input class="field" placeholder="Campo di testo"></section>
        <section style="display:flex;flex-direction:column;gap:12px"><div class="label">Stati da provare</div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start">
            <button class="link" data-simgo="vuoto">→ Archivio vuoto</button><button class="link" data-simgo="caricamento">→ Archivio in caricamento</button><button class="link" data-simgo="errore">→ Archivio con errore</button>
            <button class="link" data-act="engine-off">→ ${S.engine.connected ? "Simula Higgsfield non collegato" : "Ricollega Higgsfield (simulato)"}</button>
            <button class="link" data-act="cost-demo">→ Dialog di approvazione del costo</button></div>
          <div class="progress progress--indet"><i></i></div><div class="skeleton" style="height:60px"></div></section>
        <section style="display:flex;flex-direction:column;gap:10px"><div class="label">Riferimenti studiati</div>
          <p class="prose muted" style="margin:0">Fondazione: Julia Krantz (provino a contatto su nero, giunture al 12%, peso 300, colore solo nelle foto). Dettaglio preso: Superlative (un solo colore, solo come indicatore funzionale). Dettaglio preso: MONO (etichette spaziate, stato attivo come bordo da 1px). Rifiutato: gradienti, vetro smerigliato, pillole arrotondate e viola tipici delle app AI.</p></section>
      </div></div>`;
  }

  /* ---------------- Pannello laterale ---------------- */
  function renderSide() {
    const tabs = `<div class="panel__head"><div class="seg">${[["dettaglio", "Dettaglio"], ["critico", "Interlocutore"]].map(([v, l]) => `<button class="seg__opt" data-tab="${v}" aria-pressed="${S.sideTab === v}">${l}</button>`).join("")}</div><button class="btn btn--quiet" data-act="side-close" style="margin-left:auto" title="Chiudi (I)">×</button></div>`;
    side.innerHTML = `<div class="panel"><span class="sheet-grip"></span>${tabs}${S.sideTab === "dettaglio" ? sideDetail() : sideCritic()}</div>`;
  }
  function focusRef() {
    if (S.view === "laboratorio" || S.view === "esporta") return S.cur;
    if (S.view === "tela") return S.tela[0];
    return S.sel;
  }
  function sideDetail() {
    const id = focusRef(), it = item(id), n = node(id);
    if (!it && !n) return `<div class="panel__body">${stateBox("·", "Niente selezionato", "Scegli un'immagine dall'archivio.")}</div>`;
    if (n) return `<div class="panel__body"><img src="${n.full}" alt="" style="outline:var(--hair) solid var(--seam)">
      <div style="display:flex;align-items:baseline;gap:10px"><span class="code" style="font-size:34px">${n.code}</span><span class="status-chip" data-s="${n.status}">${n.status}</span></div>
      <dl class="dl"><dt>Processo</dt><dd>${esc(n.procName)}</dd><dt>Sorgenti</dt><dd>${n.sources.map((s) => esc(code(s))).join(" × ") || "nessuna"}</dd><dt>Parametri</dt><dd class="meta"><b>${Object.entries(n.params).map(([k, v]) => `${k} ${v}`).join(" · ")}</b></dd>
        <dt>Motore</dt><dd>${n.paid ? "Higgsfield (simulato nel prototipo)" : "Locale · 0 crediti"}</dd><dt>Dimensione</dt><dd class="meta"><b>${n.w} × ${n.h} px</b></dd></dl>
      <div><div class="label" style="margin-bottom:10px">Cronologia</div><ul class="history">${lineage(n.id).map((x) => `<li ${x.human ? 'data-human="true"' : ""}>${esc(x.what)}<span class="meta">${esc(x.meta)}</span></li>`).join("")}</ul></div></div>`;
    return `<div class="panel__body"><img src="${it.file}" alt="${esc(it.title)}" style="outline:var(--hair) solid var(--seam)">
      <div><div style="display:flex;align-items:baseline;gap:10px"><span class="code" style="font-size:34px">${esc(it.code)}</span><span class="meta">${pad(S.items.indexOf(it) + 1)}</span></div>
        <h2 class="title" style="font-size:20px;margin-top:6px">${esc(it.title)}</h2><div class="muted" style="font-size:12px;margin-top:4px">${esc(it.original)}</div></div>
      <dl class="dl"><dt>Autore</dt><dd>${esc(it.author)}</dd><dt>Data</dt><dd>${esc(it.date)}</dd><dt>Tecnica</dt><dd>${esc(it.medium)}</dd>
        <dt>Provenienza</dt><dd><select class="field" data-prov="${it.id}" style="padding:2px 0">${["Archivio storico", "Fotografia originale", "Materiale digitale", "Da classificare"].map((p) => `<option ${p === it.provenance ? "selected" : ""}>${p}</option>`).join("")}</select></dd>
        <dt>Fonte</dt><dd>${it.url ? `<a class="link" href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.source)} ↗</a>` : esc(it.source)}</dd>
        <dt>Risoluzione</dt><dd class="meta"><b>${it.w} × ${it.h} px</b> · massima disponibile</dd></dl>
      <div class="rights"><span class="label">Diritti</span><span class="rights__state"><span class="dot ${it.rightsState === "libero" ? "" : "dot--off"}"></span>${esc(it.rights)}</span>
        <select class="field" data-rights="${it.id}" style="padding:2px 0">${[["libero", "Pubblico dominio / libero"], ["verificare", "Da verificare"], ["personale", "Solo uso personale"]].map(([v, l]) => `<option value="${v}" ${v === it.rightsState ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div><div class="label" style="margin-bottom:8px">Tag</div><div class="tags">${it.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}<button class="tag" data-act="add-tag" data-id="${it.id}">+ tag</button></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="to-tela">Porta sulla tela</button><button class="btn" data-act="mark-src">${S.marks.has(it.id) ? "Togli il segno" : "Segna"}</button><button class="btn btn--quiet" data-tab="critico">Chiedi all'interlocutore →</button></div>
      <div><div class="label" style="margin-bottom:10px">Cronologia</div><ul class="history">${it.history.map((h) => `<li>${esc(h.what)}<span class="meta">${esc(h.t)} · ${esc(h.meta)}</span></li>`).join("")}</ul></div></div>`;
  }
  function lineage(id) {
    const out = []; let cur = node(id);
    while (cur) {
      out.unshift({ what: `${cur.code} · ${cur.procName}`, meta: `${cur.t} · ${Object.entries(cur.params).map(([k, v]) => k + " " + v).join(", ")}` });
      if (cur.marked) out.splice(1, 0, { what: "Segnata da te", meta: "matita grassa", human: true });
      const p = cur.parent; cur = node(p);
      if (!cur && item(p)) out.unshift({ what: `Sorgente ${item(p).code} · ${item(p).title}`, meta: item(p).source });
    }
    const n = node(id);
    if (n && n.status === "finita") out.push({ what: "Dichiarata finita da te", meta: n.finishedAt || "", human: true });
    return out;
  }
  const measures = {};
  function sideCritic() {
    const id = focusRef(), r = ref(id);
    const key = id || "none";
    const m = measures[key];
    if (r && !m) {
      (async () => { try { const e = await el(id); measures[key] = CR.measure(e) || "na"; } catch (e) { measures[key] = "na"; } if (S.sideTab === "critico") renderSide(); })();
    }
    const mm = m && m !== "na" ? m : null;
    const proc = node(id) ? node(id).proc : null;
    const rem = mm ? CR.remarks(mm, proc) : (m === "na" ? CR.remarks(null) : []);
    const meter = (l, v) => `<div><span class="label">${l}</span><span class="analysis__v">${v == null ? "—" : Math.round(v * 100)}</span><div class="bar-meter"><i style="width:${(v || 0) * 100}%"></i></div></div>`;
    const hyps = CR.HYPOTHESES.slice(0, 3);
    return `<div class="panel__body">
      <div class="meta">Sto guardando: <b>${r ? esc(r.code) + " · " + esc(r.title || r.procName) : "niente"}</b></div>
      <div class="analysis">${meter("Ambiguità", mm && mm.ambiguity)}${meter("Densità di bordi", mm && mm.edges)}${meter("Simmetria", mm && mm.symmetry)}${meter("Saturazione", mm && mm.saturation)}</div>
      <span class="meta" style="margin-top:-12px">Misure locali sull'immagine, non giudizi di valore.</span>
      ${rem.map((t, i) => `<div class="critic__msg"><div class="critic__who"><span class="label">Interlocutore</span>${i === 0 ? `<span class="meta">${now()}</span>` : ""}</div><div class="critic__text">${esc(t)}</div></div>`).join("")}
      <div style="display:flex;flex-direction:column;gap:0"><div class="label" style="margin-bottom:8px">Ipotesi da provare</div>
        ${hyps.map((h, i) => `<div class="hypo"><span class="hypo__n">H${i + 1}</span><div class="hypo__body"><span class="hypo__title">${esc(h.t)}</span><span class="muted" style="font-size:12px;line-height:1.55">${esc(h.d)}</span>
          <div class="hypo__acts"><button class="btn" data-hypo="${i}">Prepara sulla tela</button><button class="btn btn--quiet" data-act="reject-hypo">Non mi interessa</button></div></div></div>`).join("")}</div>
      ${S.chat.map((c) => `<div class="critic__msg ${c.who === "you" ? "critic__msg--you" : ""} ${c.dissent ? "critic__msg--dissent" : ""}"><div class="critic__who"><span class="label">${c.who === "you" ? "Tu" : "Interlocutore"}</span></div><div class="critic__text">${esc(c.text)}</div></div>`).join("")}
    </div>
    <div class="panel__foot"><form id="chatF" class="field-row"><input class="field" id="chatIn" placeholder="Proponi, contesta, chiedi…" autocomplete="off"><button class="btn btn--quiet" type="submit">↵</button></form>
      <div class="meta" style="margin-top:6px">Nel prototipo le risposte sono scritte in anticipo. Nell'app risponde Claude.</div></div>`;
  }
  let dissentI = 0;
  const toBottom = () => { const b = $(".panel__body", side); if (b) b.scrollTop = b.scrollHeight; };
  function sendChat(text) {
    S.chat.push({ who: "you", text });
    renderSide(); toBottom();
    setTimeout(() => { S.chat.push({ who: "critic", text: CR.DISSENT[dissentI++ % CR.DISSENT.length], dissent: true }); renderSide(); toBottom(); }, 700);
  }

  /* ---------------- Dialog: costo Higgsfield ---------------- */
  const layer = $("#layer");
  function closeDialog() { layer.innerHTML = ""; }
  function openCost(procId, sources) {
    const P = PR.paid[procId];
    const st = { n: 2 };
    const draw = () => {
      if (!S.engine.connected) {
        layer.innerHTML = `<div class="scrim" data-scrim><div class="dialog" role="dialog" aria-modal="true" aria-label="Motore non disponibile">
          <div class="dialog__head"><span class="dot dot--off"></span><span class="label">Higgsfield non è collegato</span><button class="btn btn--quiet" data-close style="margin-left:auto">×</button></div>
          <div class="dialog__body"><p class="critic__text" style="margin:0">Non posso preparare il preventivo: la sessione della CLI è scaduta o non è mai stata aperta.</p>
            <div class="notice"><span>Apri il Terminale ed esegui <span class="meta"><b>higgsfield auth login</b></span>, poi torna qui e premi Riprova. I processi locali continuano a funzionare.</span></div></div>
          <div class="dialog__foot"><button class="btn btn--quiet" data-close>Chiudi</button><span class="spacer"></span><button class="btn" data-retry>Riprova</button></div></div></div>`;
        $("[data-retry]", layer).onclick = () => { S.engine.connected = true; render(); draw(); };
        return;
      }
      const tot = P.credits * st.n, after = S.engine.credits - tot, enough = after >= 0;
      layer.innerHTML = `<div class="scrim" data-scrim><div class="dialog" role="dialog" aria-modal="true" aria-label="Approvazione costo">
        <div class="dialog__head"><span class="dot dot--mark"></span><span class="label" style="color:var(--salt)">Generazione a pagamento · richiede il tuo consenso</span><button class="btn btn--quiet" data-close style="margin-left:auto" title="Annulla (Esc)">×</button></div>
        <div class="dialog__body">
          <div class="cost">
            <div><span class="label">Costo stimato</span><span class="hero-num">${tot}</span><span class="meta">crediti Higgsfield · stima letta dalla CLI</span></div>
            <div class="cost__lines">
              <span class="muted">Processo</span><span>${esc(P.name)}</span>
              <span class="muted">Modello</span><span>${esc(P.model)}</span>
              <span class="muted">Sorgenti</span><span>${sources.map(code).join(" × ") || "nessuna (da ipotesi)"}</span>
              <span class="muted">Variazioni</span><span><button class="btn btn--quiet" data-n="-1" style="height:18px;padding:0 6px">−</button> ${st.n} <button class="btn btn--quiet" data-n="1" style="height:18px;padding:0 6px">+</button></span>
              <span class="muted">Per variazione</span><span>${P.credits} cr</span>
              <span class="muted cost__total">Saldo attuale</span><span class="cost__total">${S.engine.credits} cr</span>
              <span class="muted">Saldo dopo</span><span style="color:${enough ? "var(--salt)" : "var(--mark)"}">${after} cr</span>
            </div></div>
          ${sources.length ? `<div style="display:flex;gap:1px">${sources.map((s) => `<img src="${thumb(s)}" alt="" style="width:64px;height:64px;object-fit:cover;outline:var(--hair) solid var(--seam)">`).join("")}</div>` : `<div class="meta">Ipotesi: <b>${esc(S.idea || "(vuota)")}</b></div>`}
          <div class="notice"><span>Niente parte finché non tieni premuto il pulsante. Se il costo reale supera la stima di oltre il 10%, ATELIER si ferma e ti chiede di nuovo. <span class="muted">Nel prototipo la generazione è simulata: nessun credito viene speso.</span></span></div>
        </div>
        <div class="dialog__foot"><button class="btn btn--quiet" data-close>Annulla <span class="btn__key">Esc</span></button><span class="spacer"></span>
          <button class="hold" id="hold" ${enough ? "" : "disabled"}><span class="hold__fill"></span><span class="hold__lbl">${enough ? `Tieni premuto per approvare ${tot} crediti` : "Crediti insufficienti"}</span></button></div></div></div>`;
      $$("[data-n]", layer).forEach((b) => (b.onclick = () => { st.n = Math.max(1, Math.min(8, st.n + Number(b.dataset.n))); draw(); }));
      bindHold($("#hold"), () => approve(procId, sources, st.n, tot), `Ho letto: verranno spesi ${tot} crediti Higgsfield.`, `Approva ${tot} crediti`);
    };
    draw();
  }
  function bindHold(btn, done, altText, altBtn) {
    if (!btn) return;
    if (altText && !btn.disabled) {
      const alt = document.createElement("button"); alt.className = "link"; alt.type = "button"; alt.textContent = "Non puoi tenere premuto? Conferma in due passaggi";
      btn.closest(".dialog__foot").appendChild(alt);
      alt.onclick = () => {
        const box = document.createElement("div"); box.className = "hold-alt"; box.style.flex = "1 1 100%";
        box.innerHTML = `<label class="check"><input type="checkbox" id="altChk"><span>${esc(altText)}</span></label><button class="btn btn--paid" id="altGo" disabled>${esc(altBtn)}</button>`;
        btn.replaceWith(box); alt.remove();
        const chk = $("#altChk"), go2 = $("#altGo"); chk.onchange = () => (go2.disabled = !chk.checked); go2.onclick = done;
      };
    }
    let t = null;
    const ms = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hold")) * 1000 || 1200;
    const start = (e) => { if (btn.disabled || t) return; e && e.preventDefault(); btn.dataset.holding = "true"; t = setTimeout(() => { t = null; btn.dataset.holding = "false"; done(); }, ms); };
    const stop = () => { if (t) { clearTimeout(t); t = null; } btn.dataset.holding = "false"; };
    btn.addEventListener("pointerdown", start); btn.addEventListener("pointerup", stop); btn.addEventListener("pointerleave", stop);
    btn.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) start(e); });
    btn.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") stop(); });
  }
  function approve(procId, sources, n, tot) {
    const P = PR.paid[procId];
    layer.innerHTML = `<div class="scrim"><div class="dialog"><div class="dialog__head"><span class="dot dot--mark dot--live"></span><span class="label" style="color:var(--salt)">Approvato da te · ${tot} crediti</span></div>
      <div class="dialog__body"><p class="critic__text" style="margin:0">Generazione in corso: ${esc(P.name)}, ${n} variazioni.</p><div class="progress"><i id="prog" style="--p:4%"></i></div><span class="meta">Simulazione: nel prototipo non viene contattato nessun servizio.</span></div>
      <div class="dialog__foot"><button class="btn btn--quiet" data-cancel>Interrompi</button></div></div></div>`;
    let p = 4, cancelled = false;
    $("[data-cancel]", layer).onclick = () => { cancelled = true; closeDialog(); toast("Interrotta prima della fine. Nessun credito speso (simulato)."); };
    const tick = setInterval(async () => {
      if (cancelled) return clearInterval(tick);
      p = Math.min(100, p + 16); const g = $("#prog"); g && g.style.setProperty("--p", p + "%");
      if (p >= 100) {
        clearInterval(tick); closeDialog();
        S.engine.credits -= tot; S.engine.spent += tot;
        // Simulazione: approssimo il risultato con processi locali, marcati come simulati.
        const made = [];
        for (let i = 0; i < n; i++) {
          let c;
          if (sources.length) { const els = await Promise.all(sources.map(el)); c = sources.length > 1 ? PR.local.deriva.run(els, { forza: 0.06 + i * 0.03, angolo: 30 + i * 70 }) : PR.local.rimescola.run(els, { celle: 5 + i * 2, probabilita: 0.4, seme: 30 + i }); }
          else c = PR.local.campo.run([], { linee: 2200, scala: 1.5 + i, seme: 300 + i });
          const nd = makeNode({ proc: procId, sources, params: { variazione: i + 1, simulata: "sì" }, canvas: c, paid: true }); made.push(nd);
        }
        S.cur = made[0].id; S.cmpA = made[0].parent || made[0].id; S.cmpB = made[0].id;
        toast(`${n} variazioni pronte (simulate). Spesa: ${tot} crediti.`, "Apri nel laboratorio", () => go("laboratorio"));
        render();
      }
    }, 380);
  }
  function openFinish() {
    const n = node(S.cur); if (!n) return;
    layer.innerHTML = `<div class="scrim" data-scrim><div class="dialog" role="dialog" aria-modal="true" style="width:min(560px,100%)">
      <div class="dialog__head"><span class="dot dot--mark"></span><span class="label" style="color:var(--salt)">Dichiarare finita ${n.code}</span><button class="btn btn--quiet" data-close style="margin-left:auto">×</button></div>
      <div class="dialog__body"><div style="display:grid;grid-template-columns:120px 1fr;gap:var(--s-4)"><img src="${n.thumb}" alt="" style="outline:var(--hair) solid var(--seam)">
        <p class="critic__text" style="margin:0">Questa è una tua decisione: il laboratorio non la prende mai al posto tuo. L'opera resta modificabile e puoi riaprirla quando vuoi.</p></div>
        <div class="critic__msg critic__msg--dissent"><span class="label">Interlocutore</span><div class="critic__text" style="font-size:14px">Prima di decidere: ${n.status === "scelta" ? "è la versione che hai segnato, ma la sua sorella più instabile mi sembra ancora più viva." : "non l'hai ancora messa in esame né confrontata con le altre del ramo."} Se sei convinto, procedi.</div></div></div>
      <div class="dialog__foot"><button class="btn btn--quiet" data-close>Non ancora</button><span class="spacer"></span><button class="hold" id="hold"><span class="hold__fill"></span><span class="hold__lbl">Tieni premuto: è finita</span></button></div></div></div>`;
    bindHold($("#hold"), () => { n.status = "finita"; n.finishedAt = "2026-11-04 " + now(); n.marked = true; closeDialog(); toast(`${n.code} dichiarata finita da te.`); render(); }, `Confermo che ${n.code} è finita. È una mia decisione.`, "Dichiara finita");
  }
  function openPicker() {
    const all = [...S.items.map((x) => ({ id: x.id, src: x.file, code: x.code })), ...S.nodes.map((n) => ({ id: n.id, src: n.thumb, code: n.code }))];
    layer.innerHTML = `<div class="scrim" data-scrim><div class="dialog" style="width:min(940px,100%)"><div class="dialog__head"><span class="label">Aggiungi alla tela</span><button class="btn btn--quiet" data-close style="margin-left:auto">×</button></div>
      <div class="vgrid" style="--cols:6">${all.map((x) => tile({ attrs: `data-pick="${x.id}"`, img: x.src, code: x.code, size: 26, left: `<b>${esc(x.code)}</b>` })).join("")}</div></div></div>`;
  }
  function openEngine() {
    layer.innerHTML = `<div class="scrim" data-scrim><div class="dialog" style="width:min(520px,100%)"><div class="dialog__head"><span class="dot ${S.engine.connected ? "" : "dot--off"}"></span><span class="label">Motori</span><button class="btn btn--quiet" data-close style="margin-left:auto">×</button></div>
      <div class="dialog__body"><dl class="dl"><dt>Higgsfield</dt><dd>${S.engine.connected ? `Collegato tramite CLI · <span class="credits">${S.engine.credits} crediti</span>` : "Non collegato: esegui <span class='meta'><b>higgsfield auth login</b></span>"}</dd>
        <dt>Locale</dt><dd>8 processi algoritmici · sempre disponibili, gratis</dd><dt>Altri</dt><dd class="muted">Il sistema è modulare: nuovi modelli o algoritmi si aggiungono come moduli.</dd></dl></div>
      <div class="dialog__foot"><button class="btn btn--quiet" data-close>Chiudi</button><button class="link" data-go="sistema">Sistema e stati →</button><span class="spacer"></span><button class="btn" data-act="engine-off">${S.engine.connected ? "Simula disconnessione" : "Ricollega (simulato)"}</button></div></div></div>`;
  }

  /* ---------------- Toast ---------------- */
  let toastT;
  function clearToasts() { $$(".toast").forEach((t) => t.remove()); }
  function toast(msg, action, fn) {
    clearTimeout(toastT);
    const t = document.createElement("div"); t.className = "toast"; t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="link">${esc(action)}</button>` : ""}`;
    $$(".toast").forEach((x) => x.remove()); document.body.appendChild(t);
    if (action) $("button", t).onclick = () => { t.remove(); fn(); };
    toastT = setTimeout(() => t.remove(), 5200);
  }

  /* ---------------- Navigazione ed eventi ---------------- */
  function go(v) { closeDialog(); clearToasts(); S.view = v; S.sim = v === "archivio" ? S.sim : null; if (location.hash !== "#" + v) history.replaceState(null, "", "#" + v); render(); main.scrollTop = 0; }
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("button, [data-scrim], a"); if (!t) return;
    const d = t.dataset;
    if (d.scrim !== undefined && e.target === t) return closeDialog();
    if (d.close !== undefined) return closeDialog();
    if (d.go) return go(d.go);
    if (d.tab) { S.sideTab = d.tab; S.side = true; return render(); }
    if (d.sel) { S.sel = d.sel; if (phone()) { S.sideTab = "dettaglio"; S.side = true; } else if (e.detail === 2) { addToTela(d.sel); return; } return render(); }
    if (d.facet) { S.f[d.facet] = S.f[d.facet] === d.v ? null : d.v; return render(); }
    if (d.density) { S.density = d.density; return render(); }
    if (d.proc) { S.proc = d.proc; S.params = PR.local[d.proc] ? PR.defaults(d.proc) : {}; return render(); }
    if (d.tview) { S.telaView = d.tview; return render(); }
    if (d.ground) { S.ground = d.ground; return render(); }
    if (d.untela !== undefined) { S.tela.splice(+d.untela, 1); S.telaView = "sorgenti"; return render(); }
    if (d.pick) { closeDialog(); addToTela(d.pick, true); return; }
    if (d.node) { S.cur = d.node; const n = node(d.node); S.cmpA = n.parent; S.cmpB = n.id; return render(); }
    if (d.selSrc) { S.sel = d.selSrc; S.sideTab = "dettaglio"; return render(); }
    if (d.lab) { S.labMode = d.lab; return render(); }
    if (d.exp) { S.exportSel.has(d.exp) ? S.exportSel.delete(d.exp) : S.exportSel.add(d.exp); S.cur = d.exp; return render(); }
    if (d.idea !== undefined) { S.idea = CR.ZERO_IDEAS[+d.idea]; return render(); }
    if (d.hypo !== undefined) { const h = CR.HYPOTHESES[+d.hypo]; S.tela = [...h.src]; S.proc = h.proc; S.params = PR.defaults(h.proc); S.telaView = "sorgenti"; toast(`Preparata: ${h.t}. Regola i parametri e decidi tu.`); return go("tela"); }
    if (d.simgo) { S.sim = d.simgo; S.view = "archivio"; return render(); }
    const a = d.act; if (!a) return;
    const n = node(S.cur);
    switch (a) {
      case "sim-off": S.sim = null; return render();
      case "pick-files": return $("#fileIn") ? $("#fileIn").click() : (go("archivio"), setTimeout(() => $("#fileIn").click(), 50));
      case "import-url": return importUrl();
      case "clear-filters": S.f = { tag: null, prov: null, rights: null }; S.q = ""; return render();
      case "to-tela": if (phone()) S.side = false; return addToTela(S.sel);
      case "mark-src": S.marks.has(S.sel) ? S.marks.delete(S.sel) : S.marks.add(S.sel); return render();
      case "add-tag": { const v = prompt("Nuovo tag"); if (v) { item(d.id).tags.push(v.trim().toLowerCase()); render(); } return; }
      case "pick-slot": return openPicker();
      case "preview": return doPreview();
      case "make": return doMake();
      case "quote": return openCost(S.proc, S.tela.slice(0, PR.paid[S.proc].inputs));
      case "branch": S.tela = [n.id]; S.telaView = "sorgenti"; return go("tela");
      case "mark": n.marked = !n.marked; if (n.marked && n.status === "materiale") n.status = "scelta"; if (!n.marked && n.status === "scelta") n.status = "materiale"; return render();
      case "discard": n.discarded = !n.discarded; return render();
      case "review": n.status = n.status === "in esame" ? "materiale" : "in esame"; return render();
      case "finish": if (n.status === "finita") { n.status = "scelta"; toast(`${n.code} riaperta.`); return render(); } return openFinish();
      case "zero-go": return zeroGo();
      case "zero-keep": return zeroKeep();
      case "export": { const f = { tiff16: "tif", png16: "png", jpeg: "jpg" }[S.fmt]; toast(`${S.exportSel.size} file esportati in ~/Pictures/ATELIER/Per Lightroom/ (.${f}${S.sidecar ? " + .json" : ""}). Simulato nel prototipo.`); return; }
      case "download": S.nodes.filter((x) => S.exportSel.has(x.id)).forEach((x) => { const l = document.createElement("a"); l.download = `ATELIER_${x.code}_${x.proc}.png`; l.href = x.canvas.toDataURL("image/png"); l.click(); }); return;
      case "side-close": S.side = false; return render();
      case "rail-open": S.railOpen = true; return render();
      case "rail-close": S.railOpen = false; return render();
      case "engine-off": S.engine.connected = !S.engine.connected; closeDialog(); toast(S.engine.connected ? "Higgsfield ricollegato (simulato)." : "Higgsfield risulta non collegato (simulato)."); return render();
      case "cost-demo": return openCost("hf-variazione", ["a07"]);
      case "reject-hypo": S.chat.push({ who: "critic", text: "Va bene, la tolgo. Ma dimmi cosa non ti convince: se è l'accostamento in sé o il modo in cui l'ho formulato, la prossima proposta cambia." }); S.sideTab = "critico"; return render();
    }
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.prov) { const it = item(t.dataset.prov); it.provenance = t.value; it.history.push({ t: now(), what: "Provenienza indicata da te", meta: t.value }); return render(); }
    if (t.dataset.rights) { const it = item(t.dataset.rights); it.rightsState = t.value; it.rights = t.selectedOptions[0].text; it.history.push({ t: now(), what: "Diritti indicati da te", meta: it.rights }); return render(); }
    if (t.dataset.cmp) { S[t.dataset.cmp === "A" ? "cmpA" : "cmpB"] = t.value; return render(); }
  });
  document.addEventListener("input", (e) => {
    const t = e.target; if (!t.dataset.param) return;
    S.params[t.dataset.param] = Number(t.value);
    const lbl = t.closest(".param").querySelector(".meta b"), d = PR.local[S.proc].params[t.dataset.param];
    lbl.textContent = d.labels ? d.labels[Number(t.value) >= 0.5 ? 1 : 0] : t.value;
  });
  document.addEventListener("submit", (e) => { if (e.target.id === "chatF") { e.preventDefault(); const v = $("#chatIn").value.trim(); if (v) sendChat(v); } });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") return closeDialog();
    if (/input|textarea|select/i.test(document.activeElement.tagName) || layer.innerHTML) return;
    const map = { 1: "archivio", 2: "tela", 3: "laboratorio", 4: "zero", 5: "esporta" };
    if (map[e.key]) return go(map[e.key]);
    if (e.key === "i" || e.key === "I") { S.side = !S.side; return render(); }
    if ((e.key === "m" || e.key === "M") && S.view === "laboratorio") { const n = node(S.cur); if (n) { n.marked = !n.marked; render(); } }
    if (e.key === "o" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); go("archivio"); setTimeout(() => $("#fileIn") && $("#fileIn").click(), 50); }
  });
  $("#sideBtn").onclick = () => { S.side = !S.side || S.sideTab !== "critico"; S.sideTab = "critico"; render(); };
  $("#engineBtn").onclick = openEngine;
  function addToTela(id, fromPicker) {
    if (!id) return;
    if (!S.tela.includes(id)) { if (S.tela.length >= 4) S.tela.shift(); S.tela.push(id); }
    S.telaView = "sorgenti";
    if (fromPicker) return render();
    toast(`${code(id)} è sulla tela (${S.tela.length}/4).`, "Vai alla tela", () => go("tela")); render();
  }
  window.addEventListener("hashchange", () => { const v = location.hash.slice(1); if (v && v !== S.view) go(v); });

  const start = location.hash.slice(1);
  if (["archivio", "tela", "laboratorio", "zero", "esporta", "sistema"].includes(start)) S.view = start;
  render();
  seed().catch((err) => { console.error(err); toast("Non riesco a elaborare le immagini: apri il prototipo da un server locale (vedi DESIGN.md)."); });
})();
