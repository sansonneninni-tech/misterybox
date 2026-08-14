/** Costanti globali del motore. Risoluzione virtuale in stile console portatile 2001. */

export const SCREEN_W = 240;
export const SCREEN_H = 160;

/** Dimensione di un tile in pixel. */
export const TILE = 16;

/** Tile visibili a schermo (15 x 10). */
export const VIEW_TILES_X = SCREEN_W / TILE;
export const VIEW_TILES_Y = SCREEN_H / TILE;

/** Passo logico fisso: 60 aggiornamenti al secondo. */
export const STEP = 1 / 60;

/** Frame necessari al giocatore per attraversare un tile (velocita' base). */
export const WALK_FRAMES = 16;
export const RUN_FRAMES = 8;
