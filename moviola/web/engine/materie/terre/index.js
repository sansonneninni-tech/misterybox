// Terre e stoffe: materie che cedono. Sabbia che frana e vola, stoffa bagnata
// che pende e si strappa, terra scavata dall'acqua. Una per file; tutte e tre
// sono simulazioni su un atlante di quattro campi (vedi atlante.js).
import { MATERIA as granuli } from './granuli.js';
import { MATERIA as tessuto } from './tessuto.js';
import { MATERIA as erosione } from './erosione.js';

export const MATERIE = [granuli, tessuto, erosione];
