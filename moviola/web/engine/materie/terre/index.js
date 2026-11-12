// Terre e stoffe: materie che cedono. Sabbia che frana e vola, stoffa che si
// gonfia nell'aria o si piega sotto una mano, terra scavata dall'acqua. Una per
// file; tutte sono simulazioni su un atlante di quattro campi (vedi atlante.js).
// «Tessuto bagnato» (tessuto.js) non compare più nella scelta: l'ha sostituito
// Tessuto (stoffa.js). Resta registrato perché i lavori salvati con lui si
// aprano ancora uguali.
import { MATERIA as granuli } from './granuli.js';
import { MATERIA as stoffa } from './stoffa.js';
import { MATERIA as tessuto } from './tessuto.js';
import { MATERIA as erosione } from './erosione.js';

export const MATERIE = [granuli, stoffa, erosione, { ...tessuto, ritirata: true }];
