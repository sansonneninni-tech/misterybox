// Le materie: l'immagine diventa il corpo di una sostanza che si muove da sé.
// Ogni file è una famiglia; ogni materia è un processo come gli altri, quindi
// si combina a strati con tutto il resto della catena.
import { MATERIE as liquidi } from './liquidi.js';
import { MATERIE as acque } from './acque.js';
import { MATERIE as minerali } from './minerali.js';
import { MATERIE as organismi } from './organismi.js';
import { MATERIE as corpi } from './corpi.js';
import { MATERIA as impasto } from './dense/impasto.js';
import { MATERIA as argilla } from './dense/argilla.js';
import { MATERIA as bitume } from './dense/bitume.js';
import { MATERIA as ghiaccio } from './dense/ghiaccio.js';
import { MATERIA as cenere } from './dense/cenere.js';

// Le materie dense: peso, spessore, superficie. Una per file.
// cenere resta fuori finché non è all'altezza
const dense = [impasto, argilla, bitume, ghiaccio].filter(Boolean);
void cenere;

export const MATERIA_FAMILIES = [
  { id: 'dense', label: 'Materie dense' },
  { id: 'liquidi', label: 'Liquidi' },
  { id: 'acque', label: 'Acque e vetri' },
  { id: 'minerali', label: 'Minerali' },
  { id: 'organismi', label: 'Organismi' },
  { id: 'corpi', label: 'Fumi e corpi' },
];

export const MATERIE = [...dense, ...liquidi, ...acque, ...minerali, ...organismi, ...corpi].map((m) => ({ ...m, materia: true }));
