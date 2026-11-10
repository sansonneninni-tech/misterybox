// Il carattere della materia al tatto: come risponde quando la tocchi.
//
//   tenuta   0..1  quanto dell'impronta resta per sempre (plasticità)
//   ritorno  s     in quanto tempo torna indietro la parte che non resta
//   fluido   0..1  0 = si incide e fa ombra; 1 = si apre, ondeggia, si richiude
//   micro    tipo di microdettaglio che compare con la Macro
//
// Una materia può dichiarare il suo carattere con `tatto: { ... }` nel suo
// file; altrimenti vale questa tabella, e per le materie nuove la famiglia.

export const MICRO = [
  { id: 'auto', label: 'Secondo la materia' },
  { id: 'grana', label: 'Grana' },
  { id: 'pori', label: 'Pori' },
  { id: 'fibre', label: 'Fibre' },
  { id: 'microbolle', label: 'Microbolle' },
  { id: 'cristalli', label: 'Cristalli' },
];
export const MICRO_INDEX = Object.fromEntries(MICRO.map((m, i) => [m.id, i]));

const T = (tenuta, ritorno, fluido, micro) => ({ tenuta, ritorno, fluido, micro });

const PER_MATERIA = {
  // dense: si lasciano incidere e tengono l'impronta
  impasto: T(0.86, 6, 0.08, 'grana'),
  argilla: T(0.95, 10, 0.03, 'pori'),
  bitume: T(0.62, 5, 0.45, 'pori'),
  ghiaccio: T(0.98, 30, 0, 'cristalli'),
  cenere: T(0.9, 8, 0, 'grana'),
  // liquidi: si aprono e si richiudono
  mercurio: T(0, 0.7, 1, 'microbolle'),
  olio: T(0.04, 1.2, 1, 'microbolle'),
  inchiostro: T(0.18, 2.6, 0.9, 'fibre'),
  miele: T(0.32, 5, 0.8, 'microbolle'),
  cera: T(0.8, 6, 0.3, 'pori'),
  ferrofluido: T(0, 0.8, 1, 'grana'),
  // acque e vetri
  pioggia: T(0.02, 0.9, 1, 'microbolle'),
  canale: T(0.02, 1.2, 1, 'microbolle'),
  goccia: T(0.03, 1.0, 1, 'microbolle'),
  condensa: T(0.2, 2.5, 0.8, 'microbolle'),
  bolle: T(0.02, 1.0, 1, 'microbolle'),
  vetro: T(0.97, 30, 0, 'microbolle'),
  // minerali: duri, si graffiano e non tornano
  marmo: T(0.98, 30, 0, 'cristalli'),
  cristalli: T(0.97, 30, 0, 'cristalli'),
  brina: T(0.9, 10, 0.05, 'cristalli'),
  sabbia: T(0.75, 3, 0.3, 'grana'),
  ossido: T(0.95, 20, 0, 'pori'),
  crettatura: T(0.96, 25, 0, 'grana'),
  // organismi: carne e tessuti, tornano piano
  morfogenesi: T(0.5, 4, 0.3, 'pori'),
  micelio: T(0.6, 5, 0.2, 'fibre'),
  lichene: T(0.88, 12, 0.05, 'pori'),
  cellule: T(0.4, 3, 0.4, 'pori'),
  vene: T(0.5, 4, 0.25, 'fibre'),
  stormo: T(0.1, 1.2, 0.8, 'grana'),
  // fumi e corpi
  fumo: T(0, 1.6, 1, 'fibre'),
  nuvola: T(0, 2.2, 1, 'fibre'),
  pelle: T(0.45, 3, 0.2, 'pori'),
  seta: T(0.3, 2, 0.3, 'fibre'),
  carta: T(0.9, 10, 0.05, 'fibre'),
  strati: T(0.5, 4, 0.3, 'fibre'),
};

const PER_FAMIGLIA = {
  dense: T(0.85, 8, 0.1, 'grana'),
  liquidi: T(0.05, 1.2, 1, 'microbolle'),
  acque: T(0.03, 1.0, 1, 'microbolle'),
  minerali: T(0.95, 20, 0, 'cristalli'),
  organismi: T(0.5, 4, 0.3, 'pori'),
  corpi: T(0.2, 2, 0.6, 'fibre'),
  terre: T(0.75, 6, 0.2, 'grana'),       // sabbia, stoffa, terra: cedono e tengono il segno
  fluide: T(0.06, 1.4, 1, 'microbolle'), // inchiostro e vetro molle: si richiudono
};

// la foto senza materie: una superficie morbida, a metà strada
const NESSUNA = T(0.7, 6, 0.2, 'grana');

/** Il carattere di un processo (materia o no). */
export function tattoDi(proc) {
  if (!proc) return NESSUNA;
  if (proc.tatto) return { ...NESSUNA, ...proc.tatto };
  return PER_MATERIA[proc.id] || PER_FAMIGLIA[proc.family] || NESSUNA;
}

/**
 * Il carattere che governa il campo scolpito: quello della materia più in
 * alto tra gli strati accesi (l'ultima toccata), altrimenti la foto.
 */
export function carattere(clip, byId) {
  let top = null;
  for (const p of clip.chain || []) if (p.on && byId[p.proc]?.materia) top = byId[p.proc];
  return { ...tattoDi(top), da: top ? top.name : 'la foto' };
}

/**
 * La memoria scelta da ninni piega il carattere: 0 = nulla resta, 0.5 = la
 * materia com'è, 1 = tutto resta per sempre.
 */
export function conMemoria(c, memoria = 0.5) {
  const m = Math.min(1, Math.max(0, memoria));
  const tenuta = m < 0.5 ? c.tenuta * (m * 2) : c.tenuta + (1 - c.tenuta) * (m * 2 - 1);
  const ritorno = c.ritorno * (m < 0.5 ? 0.25 + 1.5 * m : 1 + (m - 0.5) * 6);
  return { ...c, tenuta, ritorno };
}
