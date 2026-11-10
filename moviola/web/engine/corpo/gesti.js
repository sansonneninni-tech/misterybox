// Scolpire con le dita: il gesto registrato.
//
// Un gesto è un dito (o il mouse) dall'appoggio al distacco: strumento,
// dimensione e forza scelti in quel momento, e i punti nel tempo della clip
// [t secondi, x, y, pressione, tenuta], con x e y da 0 a 1 sulla superficie
// (y in alto) e la tenuta in secondi: quanto il dito è rimasto lì dal punto
// prima (a quadro fermo il tempo della clip non scorre, il dito sì).
// Niente pixel e niente fotogrammi: lo stesso gesto si ripete identico in
// anteprima, nel render 4K, a 24 o a 30 fotogrammi al secondo.
//
// Il campo che le materie leggono avanza a passi fissi di 1/120 di secondo
// (120 è multiplo di 24 e di 30): il fotogramma n a 24 fps è il passo 5n,
// a 30 fps il passo 4n. Ogni tratto tra due punti appartiene a un passo solo.

export const PASSI = 120;

export const STRUMENTI = [
  { id: 'spingi', label: 'Spingi', hint: 'la materia segue il dito e si accumula davanti' },
  { id: 'scava', label: 'Scava', hint: 'incide un solco o una conca, con il bordo rialzato' },
  { id: 'impasta', label: 'Impasta', hint: 'rimesta in giri e grumi, dove tieni il dito' },
  { id: 'liscia', label: 'Liscia', hint: 'spiana e cancella piano quello che c’è sotto' },
  { id: 'pizzica', label: 'Pizzica', hint: 'raccoglie la materia verso il dito e la solleva' },
];
export const TOOL_INDEX = Object.fromEntries(STRUMENTI.map((s, i) => [s.id, i]));

export function defaultScolpire() {
  return { gesti: [], memoria: 0.5, rilievo: 1, luce: 315, strumento: 'spingi', dimensione: 0.06, forza: 0.7 };
}

const q4 = (v) => Math.round(v * 1e4) / 1e4;
const q3 = (v) => Math.round(v * 1e3) / 1e3;

/** Ripara i dati letti dal disco. */
export function normalizeScolpire(s) {
  const d = defaultScolpire();
  const out = Object.assign(d, s || {});
  out.gesti = (Array.isArray(out.gesti) ? out.gesti : [])
    .filter((g) => g && Array.isArray(g.pts) && g.pts.length)
    .map((g) => ({
      id: String(g.id || Math.random().toString(36).slice(2)),
      strumento: TOOL_INDEX[g.strumento] !== undefined ? g.strumento : 'spingi',
      dimensione: Math.min(0.3, Math.max(0.005, Number(g.dimensione) || 0.06)),
      forza: Math.min(1.5, Math.max(0, Number(g.forza) ?? 0.7)),
      pts: g.pts.filter((p) => Array.isArray(p) && p.length >= 3).map((p, i, all) => [q4(+p[0]), q4(+p[1]), q4(+p[2]), q3(p[3] ?? 0.5), q4(p[4] ?? (i ? Math.max(0, p[0] - all[i - 1][0]) : 0))]),
    }));
  out.memoria = Math.min(1, Math.max(0, Number(out.memoria ?? 0.5)));
  out.rilievo = Math.min(2, Math.max(0, Number(out.rilievo ?? 1)));
  return out;
}

/** Aggiunge un punto a un gesto, con la stessa precisione del salvataggio. */
export function pushPoint(g, t, x, y, p, d) {
  g.pts.push([q4(t), q4(x), q4(y), q3(p), q4(Math.max(0, d))]);
}

/** Il passo del campo a cui appartiene l'istante t. */
export const passoDi = (t) => Math.max(0, Math.ceil(t * PASSI - 1e-6));

/**
 * Tutti i tratti dei gesti, ordinati per passo. Ogni tratto:
 * { j, ax, ay, bx, by, r, k, tool, dur }. Il primo punto di un gesto è un
 * tratto fermo (la prima impronta).
 */
export function tratti(sc) {
  const out = [];
  if (!sc?.gesti?.length) return out;
  sc.gesti.forEach((g, gi) => {
    for (let i = 0; i < g.pts.length; i++) out.push({ ...trattoDi(g, i), ord: gi * 1e6 + i });
  });
  out.sort((a, b) => a.j - b.j || a.ord - b.ord);
  return out;
}

/** Il tratto che arriva al punto i del gesto g. */
export function trattoDi(g, i) {
  const P = g.pts, a = P[Math.max(0, i - 1)], b = P[i];
  return {
    j: passoDi(b[0]),
    ax: a[1], ay: a[2], bx: b[1], by: b[2],
    r: g.dimensione, k: g.forza * (0.5 + (a[3] + b[3]) * 0.5), tool: TOOL_INDEX[g.strumento] ?? 0,
    dur: i ? Math.max(0, Math.min(0.25, b[4] ?? (b[0] - a[0]))) : 0,
  };
}

/** Il momento in cui il gesto comincia e finisce. */
export const span = (g) => [g.pts[0][0], g.pts[g.pts.length - 1][0]];

/** Una firma breve: se cambia, il campo va ricalcolato. */
export function firma(sc, extra = '') {
  if (!sc) return 'nessuno' + extra;
  let n = 0, s = 0;
  for (const g of sc.gesti) { n += g.pts.length; const L = g.pts[g.pts.length - 1]; s += L[0] * 7 + L[1] * 3 + L[2] + g.dimensione + g.forza + (TOOL_INDEX[g.strumento] || 0); }
  return `${sc.gesti.length}:${n}:${s.toFixed(4)}:${sc.memoria}${extra}`;
}
