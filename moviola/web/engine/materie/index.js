// Le materie: l'immagine diventa il corpo di una sostanza che si muove da sé.
// Ogni file è una famiglia; ogni materia è un processo come gli altri, quindi
// si combina a strati con tutto il resto della catena.
import { MATERIE as liquidi } from './liquidi.js';
import { MATERIE as acque } from './acque.js';
import { MATERIE as minerali } from './minerali.js';
import { MATERIE as organismi } from './organismi.js';
import { MATERIE as corpi } from './corpi.js';

export const MATERIA_FAMILIES = [
  { id: 'liquidi', label: 'Liquidi' },
  { id: 'acque', label: 'Acque e vetri' },
  { id: 'minerali', label: 'Minerali' },
  { id: 'organismi', label: 'Organismi' },
  { id: 'corpi', label: 'Fumi e corpi' },
];

export const MATERIE = [...liquidi, ...acque, ...minerali, ...organismi, ...corpi].map((m) => ({ ...m, materia: true }));
