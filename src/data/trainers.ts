/** Allenatori avversari: squadre, dialoghi e premi. */

export interface TrainerTeamEntry {
  species: string;
  level: number;
  moves?: string[];
}

export interface Trainer {
  id: string;
  name: string;
  title: string;
  sprite: string;
  team: TrainerTeamEntry[];
  /** Denaro = base * livello del capo squadra. */
  payout: number;
  intro: string[];
  defeat: string[];
  after: string[];
}

export const TRAINERS: Record<string, Trainer> = {
  ragazzo_marco: {
    id: 'ragazzo_marco', name: 'Marco', title: 'Ragazzo', sprite: 'child',
    team: [
      { species: 'rodentino', level: 5 },
      { species: 'piumetto', level: 6 },
    ],
    payout: 24,
    intro: ['Ehi! Ho appena catturato la mia prima creatura!', 'Vediamo chi di noi due è più forte!'],
    defeat: ['Ahia… mi serve ancora tanto allenamento.'],
    after: ['Se attraversi l’erba alta, tieni sempre una Pozione in borsa.'],
  },
  esploratrice_lia: {
    id: 'esploratrice_lia', name: 'Lia', title: 'Esploratrice', sprite: 'scout',
    team: [
      { species: 'foglietta', level: 7 },
      { species: 'squametto', level: 7 },
    ],
    payout: 32,
    intro: ['Sto mappando ogni sentiero della regione.', 'Una sfida veloce, che ne dici?'],
    defeat: ['Bel ritmo! Segnerò il tuo nome sulla mia mappa.'],
    after: ['A nord il sentiero si stringe: il Bosco Ombroso è vicino.'],
  },
  pescatore_nino: {
    id: 'pescatore_nino', name: 'Nino', title: 'Pescatore', sprite: 'fisher',
    team: [
      { species: 'squametto', level: 9 },
      { species: 'gocciolo', level: 10 },
    ],
    payout: 36,
    intro: ['Sto aspettando che abbocchi qualcosa da tre ore…', 'Almeno una lotta mi terrà sveglio!'],
    defeat: ['Oggi non è giornata, né con la canna né con le lotte.'],
    after: ['L’acqua della baia è pescosissima, prima o poi qualcosa prendo.'],
  },
  escursionista_bruno: {
    id: 'escursionista_bruno', name: 'Bruno', title: 'Escursionista', sprite: 'hiker',
    team: [
      { species: 'sassolino', level: 11 },
      { species: 'ferrolo', level: 12 },
    ],
    payout: 40,
    intro: ['Queste rocce le conosco una per una!', 'La mia squadra è dura come loro.'],
    defeat: ['Hai spaccato la mia difesa… complimenti davvero.'],
    after: ['Se cerchi minerali, prova a cercare vicino ai massi.'],
  },
  guardiana_selva: {
    id: 'guardiana_selva', name: 'Selva', title: 'Guardiana del Bosco', sprite: 'heroine',
    team: [
      { species: 'foglietta', level: 13 },
      { species: 'vespunto', level: 14 },
      { species: 'fronzaro', level: 16 },
    ],
    payout: 90,
    intro: [
      'Il Bosco Ombroso non lascia passare chiunque.',
      'Io sono Selva, la sua guardiana.',
      'Dimostrami che le tue creature si fidano di te!',
    ],
    defeat: ['…Ho sentito i miei alberi applaudire. Il passaggio è tuo.'],
    after: ['Prendi il sentiero a est: ti porterà fino alla costa.'],
  },
  rivale_1: {
    id: 'rivale_1', name: 'Dario', title: 'Rivale', sprite: 'rival',
    team: [{ species: 'rodentino', level: 6 }],
    payout: 45,
    intro: ['Ti aspettavo! Vediamo se hai imparato qualcosa.'],
    defeat: ['Uff! La prossima volta non ti va così bene.'],
    after: ['Mi alleno al Percorso 1. Raggiungimi quando sei pronto.'],
  },
  rivale_2: {
    id: 'rivale_2', name: 'Dario', title: 'Rivale', sprite: 'rival',
    team: [
      { species: 'piumetto', level: 12 },
      { species: 'rodentone', level: 14 },
    ],
    payout: 70,
    intro: ['Di nuovo tu! Stavolta la mia squadra è pronta.'],
    defeat: ['Non ci credo… ancora una sconfitta!'],
    after: ['Vado a cercare creature più rare sulla costa.'],
  },
  marinaio_gino: {
    id: 'marinaio_gino', name: 'Gino', title: 'Marinaio', sprite: 'fisher',
    team: [
      { species: 'ondino', level: 15 },
      { species: 'squametto', level: 14 },
    ],
    payout: 52,
    intro: ['Il molo è il mio ring! Sali a bordo, sfidante.'],
    defeat: ['Mare mosso oggi… e pure la lotta.'],
    after: ['Con il vento giusto si arriva ovunque.'],
  },
};

export function getTrainer(id: string): Trainer {
  const t = TRAINERS[id];
  if (!t) throw new Error(`Allenatore sconosciuto: ${id}`);
  return t;
}
