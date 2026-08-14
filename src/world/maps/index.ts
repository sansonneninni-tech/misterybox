/** Registro delle mappe: costruzione pigra e cache. */

import { MapDef, RuntimeMap } from '../map';
import {
  cameraGiocatore, casaGiocatore, casaPescatore, casaTerza, casaVicina,
  centroCura, laboratorio, negozio, rifugioBosco,
} from './interiors';
import { grottaSalina } from './cave';
import { boscoOmbroso, percorso1, percorso2 } from './routes';
import { borgoVerzura, portoMaree } from './towns';

/** Articoli in vendita per ogni negozio. */
export const SHOP_STOCK: Record<string, string[]> = {
  negozio_borgo: ['sfera', 'pozione', 'antidoto', 'sveglia', 'repellente'],
  negozio_porto: ['sfera', 'sferabuona', 'superpozione', 'curatutto', 'antiscottatura', 'rivitalizzante'],
};

const FACTORIES: Record<string, () => MapDef> = {
  casa_giocatore: casaGiocatore,
  camera_giocatore: cameraGiocatore,
  casa_vicina: casaVicina,
  casa_terza: casaTerza,
  laboratorio,
  centro_borgo: () => centroCura('centro_borgo'),
  negozio_borgo: () => negozio('negozio_borgo', SHOP_STOCK.negozio_borgo),
  borgo_verzura: borgoVerzura,
  percorso_1: percorso1,
  bosco_ombroso: boscoOmbroso,
  rifugio_bosco: rifugioBosco,
  percorso_2: percorso2,
  grotta_salina: grottaSalina,
  porto_maree: portoMaree,
  centro_porto: () => centroCura('centro_porto'),
  negozio_porto: () => negozio('negozio_porto', SHOP_STOCK.negozio_porto),
  casa_pescatore: casaPescatore,
};

const cache = new Map<string, RuntimeMap>();

export function getMap(id: string): RuntimeMap {
  const hit = cache.get(id);
  if (hit) return hit;
  const factory = FACTORIES[id];
  if (!factory) throw new Error(`Mappa sconosciuta: ${id}`);
  const rm = new RuntimeMap(factory());
  cache.set(id, rm);
  return rm;
}

export function allMapIds(): string[] {
  return Object.keys(FACTORIES);
}
