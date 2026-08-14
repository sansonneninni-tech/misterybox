/** Oggetti: cure, sfere di cattura, oggetti speciali. */

export type ItemCategory = 'cura' | 'sfera' | 'base' | 'speciale';

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  price: number;
  /** Icona in gfx/ui.ts */
  icon: string;
  desc: string;
  /** PS ripristinati. */
  heal?: number;
  /** Cura completa dei PS. */
  fullHeal?: boolean;
  /** Stati curati. */
  cures?: string[];
  /** Moltiplicatore di cattura. */
  ballRate?: number;
  /** Aumenta di un livello. */
  levelUp?: boolean;
  /** Blocca gli incontri per N passi. */
  repelSteps?: number;
  /** Utilizzabile in battaglia. */
  battle?: boolean;
  /** Utilizzabile fuori dalla battaglia. */
  field?: boolean;
  /** Non puo' essere venduto o buttato. */
  keyItem?: boolean;
}

export const ITEMS: Record<string, ItemDef> = {
  sfera: {
    id: 'sfera', name: 'Sfera', category: 'sfera', price: 200, icon: 'ball',
    desc: 'Dispositivo per catturare le creature selvatiche.',
    ballRate: 1, battle: true,
  },
  sferabuona: {
    id: 'sferabuona', name: 'Sfera Buona', category: 'sfera', price: 600, icon: 'ball',
    desc: 'Sfera migliorata: cattura più facilmente.',
    ballRate: 1.5, battle: true,
  },
  sferaottima: {
    id: 'sferaottima', name: 'Sfera Ottima', category: 'sfera', price: 1200, icon: 'ball',
    desc: 'Sfera di alta qualità con ottimo tasso di cattura.',
    ballRate: 2, battle: true,
  },
  pozione: {
    id: 'pozione', name: 'Pozione', category: 'cura', price: 300, icon: 'potion',
    desc: 'Ripristina 20 PS a una creatura.',
    heal: 20, battle: true, field: true,
  },
  superpozione: {
    id: 'superpozione', name: 'Superpozione', category: 'cura', price: 700, icon: 'potion',
    desc: 'Ripristina 50 PS a una creatura.',
    heal: 50, battle: true, field: true,
  },
  iperpozione: {
    id: 'iperpozione', name: 'Iperpozione', category: 'cura', price: 1500, icon: 'potion',
    desc: 'Ripristina 120 PS a una creatura.',
    heal: 120, battle: true, field: true,
  },
  antidoto: {
    id: 'antidoto', name: 'Antidoto', category: 'cura', price: 200, icon: 'antidote',
    desc: 'Cura l’avvelenamento.',
    cures: ['avvelenato'], battle: true, field: true,
  },
  antiscottatura: {
    id: 'antiscottatura', name: 'Antiustione', category: 'cura', price: 250, icon: 'antidote',
    desc: 'Cura le scottature.',
    cures: ['scottato'], battle: true, field: true,
  },
  sveglia: {
    id: 'sveglia', name: 'Sveglia', category: 'cura', price: 200, icon: 'antidote',
    desc: 'Risveglia una creatura addormentata.',
    cures: ['addormentato'], battle: true, field: true,
  },
  curatutto: {
    id: 'curatutto', name: 'Curatutto', category: 'cura', price: 500, icon: 'antidote',
    desc: 'Cura qualunque alterazione di stato.',
    cures: ['avvelenato', 'paralizzato', 'scottato', 'addormentato', 'congelato'],
    battle: true, field: true,
  },
  rivitalizzante: {
    id: 'rivitalizzante', name: 'Rivitalizzante', category: 'cura', price: 1000, icon: 'potion',
    desc: 'Rianima una creatura esausta con metà dei PS.',
    battle: true, field: true,
  },
  dolcetto: {
    id: 'dolcetto', name: 'Dolcetto Raro', category: 'speciale', price: 2400, icon: 'candy',
    desc: 'Aumenta di un livello la creatura che lo mangia.',
    levelUp: true, field: true,
  },
  repellente: {
    id: 'repellente', name: 'Repellente', category: 'base', price: 350, icon: 'repel',
    desc: 'Tiene lontane le creature deboli per 150 passi.',
    repelSteps: 150, field: true,
  },
  mappa: {
    id: 'mappa', name: 'Mappa di Verdania', category: 'speciale', price: 0, icon: 'key',
    desc: 'Una mappa disegnata a mano della regione.',
    keyItem: true, field: true,
  },
  distintivo: {
    id: 'distintivo', name: 'Spilla del Bosco', category: 'speciale', price: 0, icon: 'key',
    desc: 'Prova di aver superato la prova della Guardiana del Bosco.',
    keyItem: true,
  },
};

export function getItem(id: string): ItemDef {
  const it = ITEMS[id];
  if (!it) throw new Error(`Oggetto sconosciuto: ${id}`);
  return it;
}
