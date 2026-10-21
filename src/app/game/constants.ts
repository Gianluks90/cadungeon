// Tutte le costanti della scena in un posto solo, facili da cambiare.

/** Lato di una cella in pixel. Unica unità di misura di tutto il gioco. */
export const CELL_SIZE = 64;

/** Limiti di zoom (1 = dimensione normale). */
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 3;
export const ZOOM_START = 1;

/** Di quanto cambia lo zoom a ogni click dei tasti + e −. */
export const ZOOM_BUTTON_FACTOR = 1.25;
/** Sensibilità della rotella: più alto = zoom più veloce. */
export const ZOOM_WHEEL_SENSITIVITY = 0.0015;
/** La rotella con ctrl premuto (pinch del trackpad) manda valori piccoli: li amplifichiamo. */
export const ZOOM_TRACKPAD_PINCH_BOOST = 4;

/** Sfondo: nero caldo. */
export const BACKGROUND_COLOR = 0x0c0a08;
/** Puntini: grigio caldo, quasi invisibile sullo sfondo. */
export const DOT_COLOR = 0x6b635a;
export const DOT_OPACITY = 0.55;
/** Raggio del puntino in pixel dello schermo (resta uguale a ogni zoom). */
export const DOT_RADIUS_PX = 1.3;
/** Se una cella sullo schermo è più piccola di così, i puntini si diradano gradualmente. */
export const DOT_MIN_SPACING_PX = 24;

// --- Tile e mappa ---
/** Pavimento: tinta unita, come un foglio retroilluminato. */
export const FLOOR_COLOR = 0x151515;
/** Griglia delle celle: linee sottili (sempre 1 pixel a schermo) più chiare del pavimento. */
export const GRID_LINE_COLOR = 0x585858;
export const GRID_LINE_ALPHA = 0.55;

/** Muro: doppia linea. Spessore totale e spessore di ciascuna delle due linee chiare. */
export const WALL_WIDTH_PX = 14;
export const WALL_LINE_PX = 2;
export const WALL_LINE_COLOR = 0x646464;
export const WALL_GAP_COLOR = 0x101010;
/** Lo spazio scuro fra le due linee, in rapporto allo spessore totale (calcolato dai due valori sopra). */
export const WALL_GAP_RATIO = (WALL_WIDTH_PX - 2 * WALL_LINE_PX) / WALL_WIDTH_PX;

/** Varchi: ai due lati dell'apertura sporge un piccolo blocco (il montante dove va il cardine della porta).
 * Ha lo stesso spessore del muro, così le linee combaciano, ed è chiuso su tre lati. */
export const JAMB_POST_LENGTH_PX = 20;

/** Margine intorno alla mappa quando la camera la inquadra all'avvio (0.8 = occupa l'80% dello schermo). */
export const MAP_FIT_FILL = 0.8;

// --- Fratture del pavimento ---
/** Probabilità che una lastra abbia una frattura: poche, così restano un dettaglio. */
export const FLOOR_CRACK_CHANCE = 0.13;
export const FLOOR_CRACK_COLOR = 0x484848;
export const FLOOR_CRACK_ALPHA = 0.75;
