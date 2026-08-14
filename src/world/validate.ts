/**
 * Controlli di integrita' del mondo: warp coerenti, NPC e oggetti raggiungibili,
 * tile validi. Usati dai test automatici per evitare mappe "rotte".
 */

import { COLL_SOLID, splitTile } from './map';
import { allMapIds, getMap } from './maps';

export function validateMaps(): string[] {
  const problems: string[] = [];
  const ids = allMapIds();

  for (const id of ids) {
    let map;
    try {
      map = getMap(id);
    } catch (e) {
      problems.push(`${id}: costruzione fallita (${String(e)})`);
      continue;
    }

    // Tile esistenti
    for (let i = 0; i < map.def.ground.length; i++) {
      const gname = splitTile(map.def.ground[i]).name;
      if (!map.isValidTileName(gname)) problems.push(`${id}: tile terreno sconosciuto "${gname}"`);
      const o = map.def.object[i];
      if (o && !map.isValidTileName(splitTile(o).name)) {
        problems.push(`${id}: tile oggetto sconosciuto "${o}"`);
      }
      const ov = map.def.over[i];
      if (ov && !map.isValidTileName(splitTile(ov).name)) {
        problems.push(`${id}: tile superiore sconosciuto "${ov}"`);
      }
    }

    // Warp
    for (const w of map.def.warps) {
      if (!ids.includes(w.to)) {
        problems.push(`${id}: warp verso mappa inesistente "${w.to}"`);
        continue;
      }
      const dest = getMap(w.to);
      if (w.tx < 0 || w.ty < 0 || w.tx >= dest.width || w.ty >= dest.height) {
        problems.push(`${id}: warp verso ${w.to} fuori mappa (${w.tx},${w.ty})`);
        continue;
      }
      if (dest.at(w.tx, w.ty) === COLL_SOLID) {
        problems.push(`${id}: warp verso ${w.to} atterra su un tile solido (${w.tx},${w.ty})`);
      }
      if (map.at(w.x, w.y) === COLL_SOLID) {
        problems.push(`${id}: warp di partenza su tile solido (${w.x},${w.y})`);
      }
      // Il warp di ritorno deve trovarsi entro un tile dal punto d'arrivo.
      const back = dest.def.warps.find(
        (b) => b.to === id && Math.abs(b.x - w.tx) <= 1 && Math.abs(b.y - w.ty) <= 1,
      );
      if (!back && w.kind !== 'edge') {
        problems.push(`${id}: manca il passaggio di ritorno da ${w.to} verso (${w.tx},${w.ty})`);
      }
    }

    // NPC su tile calpestabili e non sovrapposti
    const busy = new Set<string>();
    for (const npc of map.def.npcs) {
      const key = `${npc.x},${npc.y}`;
      if (busy.has(key)) problems.push(`${id}: due NPC sullo stesso tile (${key})`);
      busy.add(key);
      if (map.at(npc.x, npc.y) === COLL_SOLID) {
        problems.push(`${id}: NPC "${npc.id}" su tile solido (${key})`);
      }
    }

    // Oggetti raccoglibili raggiungibili
    for (const it of map.def.items) {
      if (map.at(it.x, it.y) === COLL_SOLID) {
        problems.push(`${id}: oggetto "${it.item}" su tile solido (${it.x},${it.y})`);
      }
    }

    // Cartelli: devono essere leggibili da almeno un lato
    for (const s of map.def.signs) {
      const around = [[0, 1], [0, -1], [1, 0], [-1, 0]] as Array<[number, number]>;
      const reachable = around.some(([dx, dy]) => map.at(s.x + dx, s.y + dy) !== COLL_SOLID);
      if (!reachable) problems.push(`${id}: cartello isolato in (${s.x},${s.y})`);
    }

    // I tile "over" devono avere un oggetto o essere alberi
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const ov = map.overTile(x, y);
        if (!ov) continue;
        const name = splitTile(ov).name;
        if (!name.startsWith('tree') && !name.startsWith('roof') && name !== 'chimney') {
          problems.push(`${id}: tile sopra il giocatore non solido "${name}" in (${x},${y})`);
        }
      }
    }
  }

  return problems;
}

/** Statistiche utili per il rapporto dei test. */
export function mapStats(): Array<{ id: string; w: number; h: number; npcs: number; warps: number; items: number }> {
  return allMapIds().map((id) => {
    const m = getMap(id);
    return {
      id,
      w: m.width,
      h: m.height,
      npcs: m.def.npcs.length,
      warps: m.def.warps.length,
      items: m.def.items.length,
    };
  });
}
