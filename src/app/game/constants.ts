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

// --- Aggancio dei tile (strumento di sviluppo) ---
/** Un tile si aggancia se il suo centro è entro questa distanza (in celle) dal puntatore. */
export const SNAP_RADIUS_CELLS = 4;
/** Tile che lo strumento di sviluppo permette di piazzare (tasto T per cambiare). */
export const DEV_PLACEABLE_TILES = [
  'dead-end-2x1',
  'corridor-2x2',
  'corridor-2x4',
  'corridor-2x6',
  'corridor-t',
  'corridor-cross',
  'corridor-elbow',
  'room-4x4',
  'room-4x6',
  'room-6x6',
];
/** Pavimento del tile agganciato (non ancora piazzato): leggermente caldo, perché "vivo". */
export const FLOOR_HIGHLIGHT_COLOR = 0x2a2318;
/** Trasparenza del tile quando non c'è nessun aggancio vicino. */
export const GHOST_ALPHA = 0.35;
/** Spostamento massimo (pixel) per considerare un clic e non un trascinamento. */
export const CLICK_SLOP_PX = 5;

// --- Triangoli delle uscite (solo mentre si piazza un tile) ---
/** Uscita libera: ambra. Uscita che si collega a un'apertura già in mappa: verde. */
export const EXIT_MARKER_COLOR = 0xe0a040;
export const EXIT_MARKER_CONNECTED_COLOR = 0x5fbf6a;
export const EXIT_MARKER_ALPHA = 0.9;
/** Base e altezza del triangolo, e distanza della punta dal bordo del tile (all'interno). */
export const EXIT_MARKER_BASE_PX = 28;
export const EXIT_MARKER_HEIGHT_PX = 20;
export const EXIT_MARKER_INSET_PX = 6;

// --- Pedina e movimento ---
/** Punti movimento a inizio turno (la "velocità" dell'eroe). Ogni passo, anche in diagonale, costa 1. */
export const PAWN_SPEED = 5;
/** Quanto dura un passo da una casella all'altra, in millisecondi. */
export const PAWN_STEP_MS = 110;
/** Raggio della pedina, in rapporto alla cella. */
export const PAWN_RADIUS_RATIO = 0.36;
export const PAWN_FILL_COLOR = 0x1d1c1a;
export const PAWN_PORTRAIT_COLOR = 0x3c3a37; // segnaposto dell'immagine dell'eroe
/** Bordo acceso dell'eroe attivo (caldo: è "vivo"). */
export const PAWN_ACTIVE_COLOR = 0xe0a040;
/** Bordo degli eroi non attivi e dei mostri. */
export const PAWN_IDLE_COLOR = 0x77736c;
export const MONSTER_COLOR = 0x9a4a46;
/** Caselle raggiungibili e percorso. */
export const REACH_COLOR = 0xe0a040;
/** Intensità massima del bordo; pulsa lentamente tra il minimo e questo valore. */
export const REACH_ALPHA = 0.55;
/** Il minimo della pulsazione, in rapporto al massimo (0 = si spegne del tutto). */
export const REACH_PULSE_MIN = 0.2;
/** Durata di un ciclo di pulsazione, in millisecondi. */
export const REACH_PULSE_PERIOD_MS = 2600;
/** Contorno dell'area di movimento: spessore in pixel del mondo. Corre sul filo delle celle; accanto a un muro rientra. */
export const REACH_LINE_WIDTH_PX = 1.5;
export const REACH_EDGE_INSET_PX = 0;
export const REACH_WALL_INSET_PX = WALL_WIDTH_PX / 2 + 2;
/** Percorso: le caselle attraversate si evidenziano in giallo tenue. */
export const PATH_CELL_COLOR = 0xf0d060;
export const PATH_CELL_ALPHA = 0.15;

// --- Porte ---
/** Marrone: le porte sono oggetti interagibili, uno dei pochi elementi colorati. */
export const DOOR_COLOR = 0x6b4a33;
/** Spessore del segmento della porta. */
export const DOOR_THICKNESS_PX = 8;
/**
 * Stile lineare della porta: contorno sottile e campitura a tratti, niente riempimenti pieni.
 * Spessore delle linee (sempre pixel dello schermo, come la griglia), opacità del contorno, del tratteggio
 * (chiusa, bloccata e anta aperta), passo del tratteggio lungo gli assi (pixel del mondo),
 * e distanza minima dalle linee dei muri, per non sovrapporsi.
 */
export const DOOR_LINE_WIDTH_PX = 1;
export const DOOR_LINE_ALPHA = 0.8;
export const DOOR_HATCH_ALPHA = 0.4;
export const DOOR_HATCH_SPACING_PX = 4;
/** Porta aperta: l'anta è una vera porta (rettangolo tratteggiato); l'arco che ha percorso è tratteggiato e più tenue (trattino e vuoto in pixel). */
export const DOOR_ARC_ALPHA = 0.35;
export const DOOR_ARC_DASH_PX = 4;
export const DOOR_ARC_GAP_PX = 4;
export const DOOR_WALL_CLEARANCE_PX = 2;
/** Punti movimento per aprire o chiudere una porta. */
export const DOOR_MOVE_COST = 2;
/** Quanto vicino alla linea della porta (in celle) deve cadere il clic. */
export const DOOR_HIT_TOLERANCE_CELLS = 0.14;
/** Lunghezza massima di una porta, in celle: la larghezza di un passaggio. Non si piazzano porte lunghe quanto una stanza. */
export const DOOR_MAX_LENGTH_CELLS = 2;

// --- Ostacoli naturali ---
/** Cosa si può piazzare con lo strumento di sviluppo (tasto T per cambiare): tre tipi, tre lunghezze. */
export const OBSTACLE_VARIANTS: readonly { type: 'rock' | 'pit' | 'water'; length: number }[] = [
  { type: 'rock', length: 1 }, { type: 'rock', length: 2 }, { type: 'rock', length: 3 },
  { type: 'pit', length: 1 }, { type: 'pit', length: 2 }, { type: 'pit', length: 3 },
  { type: 'water', length: 1 }, { type: 'water', length: 2 }, { type: 'water', length: 3 },
];
/** Buca: ferite subite cadendo (l'armatura non le riduce), costo per uscirne e costo per ogni spazio saltato. */
export const PIT_FALL_WOUNDS = 1;
export const PIT_CLIMB_COST = 2;
export const PIT_JUMP_COST_PER_SPACE = 3;
/** Ferite di partenza, se la mappa non le indica. Quelle degli eroi sono multipli di 4 (cuori divisi in quarti). */
export const DEFAULT_HERO_WOUNDS = 12;
export const DEFAULT_MONSTER_WOUNDS = 8;
/** Distanza dell'ostacolo dal bordo della cella. */
export const OBSTACLE_INSET_PX = 8;
/** Roccia: grigi. Buca: nero con linee di profondità. Acqua: blu-petrolio scurissimo con onde dalle gocce. */
export const ROCK_FILL = 0x262626;
export const ROCK_LINE = 0x7a7a7a;
/** Roccia: attorno al masso, per ogni cella occupata, quanti sassi e detriti (solo scena) e i loro raggi (pixel). */
export const ROCK_PEBBLES_PER_CELL = 2;
export const ROCK_DEBRIS_PER_CELL = 5;
export const ROCK_PEBBLE_RADIUS_MIN_PX = 3;
export const ROCK_PEBBLE_RADIUS_MAX_PX = 5;
export const ROCK_DEBRIS_RADIUS_MIN_PX = 1;
export const ROCK_DEBRIS_RADIUS_MAX_PX = 2;
/** Distanza minima dei sassi dal bordo delle celle dell'ostacolo. */
export const ROCK_SCATTER_MARGIN_PX = 2;
/** Buca: bordo sottile e tenue; dentro, un gradiente a fasce dal colore del pavimento al nero. */
export const PIT_LINE = 0x6a6a6a;
export const PIT_LINE_ALPHA = 0.5;
/** Distanza del bordo dal bordo della cella, quante fasce ha il gradiente e quanto è larga ciascuna. */
export const PIT_EDGE_INSET_PX = 7;
export const PIT_GRADIENT_STEPS = 9;
export const PIT_GRADIENT_STEP_PX = 3;
/** Buca: linee a 45° dagli angoli verso il centro, per la profondità. Lunghezza lungo gli assi (pixel), a quanti tratti sfumano, colore e opacità iniziale. */
export const PIT_RAY_LENGTH_PX = 18;
export const PIT_RAY_STEPS = 8;
export const PIT_RAY_COLOR = 0x8a8a8a;
export const PIT_RAY_ALPHA = 0.5;
/** Acqua: un contorno azzurro sottile e una campitura a righe ondulate molto tenue. Tutto statico, come su un tavolo luminoso. */
export const WATER_LINE = 0x4a8fb0;
export const WATER_LINE_ALPHA = 0.85;
/** Acqua: distanza dal bordo della cella (uguale vicino ai muri e ai lati liberi), e raggio (uguale per tutti) degli angoli arrotondati. */
export const WATER_EDGE_INSET_PX = WALL_WIDTH_PX / 2; // come la faccia interna dei muri: così il bordo non fa gradini
export const WATER_ROUND_PX = 20;
/** Campitura: colore, opacità, distanza fra le righe, altezza e lunghezza dell'onda (pixel). */
export const WATER_TEXTURE_COLOR = 0x4a8fb0;
export const WATER_TEXTURE_ALPHA = 0.1;
export const WATER_TEXTURE_SPACING_PX = 8;
export const WATER_TEXTURE_AMPLITUDE_PX = 1.5;
export const WATER_TEXTURE_WAVELENGTH_PX = 18;
