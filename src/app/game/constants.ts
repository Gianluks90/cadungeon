// Tutte le costanti della scena in un posto solo, facili da cambiare.
// Colori e opacità non stanno qui: sono token per ruolo in theme.ts. Qui restano misure e regole.
import { LINE } from './theme';

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

/** Puntini dello sfondo: raggio in pixel dello schermo (resta uguale a ogni zoom). */
export const DOT_RADIUS_PX = 1.3;
/** Se una cella sullo schermo è più piccola di così, i puntini si diradano gradualmente. */
export const DOT_MIN_SPACING_PX = 24;

// --- Tile e mappa ---

/** Muro: doppia linea. Spessore totale e spessore di ciascuna delle due linee chiare. */
export const WALL_WIDTH_PX = 14;
export const WALL_LINE_PX = LINE.medium;
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
/** Spostamento massimo (pixel) per considerare un clic e non un trascinamento. */
export const CLICK_SLOP_PX = 5;

// --- Triangoli delle uscite (solo mentre si piazza un tile) ---
/** Base e altezza del triangolo, e distanza della punta dal bordo del tile (all'interno). */
export const EXIT_MARKER_BASE_PX = 28;
export const EXIT_MARKER_HEIGHT_PX = 20;
export const EXIT_MARKER_INSET_PX = 6;

// --- Pedina e movimento ---
/** Punti movimento a inizio turno (la "velocità" dell'eroe). Ogni passo, anche in diagonale, costa 1. */
export const PAWN_SPEED = 5;
/** Quanto dura un passo da una casella all'altra, in millisecondi. */
export const PAWN_STEP_MS = 110;
/** Le azioni dell'eroe (docs/REGOLE.md, sezione 2): Correre moltiplica i punti movimento e toglie gli attacchi, Combattere toglie il movimento e dà due attacchi. */
export const RUN_SPEED_MULTIPLIER = 2;
export const ADVANCE_ATTACKS = 1;
export const FIGHT_ATTACKS = 2;
/** Progresso (docs/REGOLE.md, sezione 8): valore di partenza se l'avventura non lo indica (da bilanciare) e premio per ogni glifo acceso. */
export const DEFAULT_PROGRESS = 20;
export const GLYPH_PROGRESS = 3;
/** Fatica mostrata nella barra: per ora un segnaposto fisso (la fatica è fuori scope). */
export const PLACEHOLDER_FATIGUE = 2;
/** Raggio della pedina, in rapporto alla cella. */
export const PAWN_RADIUS_RATIO = 0.36;
/** Il ritratto è ritagliato a cerchio questo tanto (pixel) dentro l'anello, così l'anello lo copre. */
export const PAWN_PORTRAIT_INSET_PX = 1;
/** Il minimo della pulsazione, in rapporto al massimo (0 = si spegne del tutto). */
export const REACH_PULSE_MIN = 0.2;
/** Durata di un ciclo di pulsazione, in millisecondi. */
export const REACH_PULSE_PERIOD_MS = 2600;
/** Contorno dell'area di movimento: spessore in pixel del mondo. Corre sul filo delle celle; accanto a un muro rientra. */
export const REACH_LINE_WIDTH_PX = LINE.thin;
export const REACH_EDGE_INSET_PX = 0;
export const REACH_WALL_INSET_PX = WALL_WIDTH_PX / 2 + 2;

// --- Glifi ---
/** Raggio dell'anello esterno del glifo, in rapporto alla cella. */
export const GLYPH_RADIUS_RATIO = 0.44;
/** Quanto dura la pulsazione di un glifo acceso (un ciclo) e il passaggio da spento ad acceso, in millisecondi. */
export const GLYPH_PULSE_PERIOD_MS = 2400;
export const GLYPH_ACTIVATE_MS = 450;
/** Il viaggio da un glifo all'altro: la pedina sfuma, riappare sull'altro glifo; durata totale, in millisecondi. */
export const GLYPH_TRAVEL_MS = 450;
/** La prima volta che si accende, un'unica onda parte dal glifo e si allarga: quanto dura e fino a che multiplo del raggio arriva. */
export const GLYPH_BURST_MS = 800;
export const GLYPH_BURST_SCALE = 3;
/** Finché un eroe è su un glifo acceso, i glifi verso cui può viaggiare emettono l'onda a intervalli: ogni quanti millisecondi. */
export const GLYPH_WAVE_PERIOD_MS = 1800;
/**
 * Il cerchio del glifo è a doppia linea: distanza fra le due linee. I quattro cerchietti sulle diagonali sono centrati
 * sulla fascia fra le due linee e un po' più larghi di essa (raggio in rapporto alla cella), pieni del colore del
 * pavimento: coprono le linee del cerchio nei punti in cui ci passano sopra.
 */
export const GLYPH_DOUBLE_GAP_PX = 4;
export const GLYPH_SMALL_RADIUS_RATIO = 0.065;
/**
 * La stella a quattro punte al centro del glifo (effetto elfico): quanto arrivano lontano le punte, in rapporto al raggio del
 * cerchio interno, e quanto sono incurvati i lati verso l'interno (distanza del punto di controllo dal centro, in rapporto
 * alla lunghezza della punta: più è piccolo, più la stella è sottile e concava).
 */
export const GLYPH_STAR_RATIO = 0.74;
export const GLYPH_STAR_PINCH = 0.1;
/** I cerchi del glifo sono poligoni con tanti lati (le linee sottili non funzionano sui cerchi veri). */
export const GLYPH_CIRCLE_SEGMENTS = 64;
/** Larghezza dell'alone attorno ai tratti del glifo acceso. */
export const GLYPH_GLOW_WIDTH_PX = 5;

// --- Scrigni ---
/** Punti movimento per aprire uno scrigno (l'eroe deve stare nella sua casella). */
export const CHEST_OPEN_COST = 2;
/** Dimensioni dello scrigno visto dall'alto, in rapporto alla cella (angoli vivi). */
export const CHEST_WIDTH_RATIO = 0.84;
export const CHEST_HEIGHT_RATIO = 0.62;
/**
 * Il coperchio è tondo: lo si simula con linee parallele al lato lungo, fra due linee verticali a CHEST_LID_BAND_PX dai
 * lati corti; le due fasce alle estremità restano lisce. Le linee sono sempre più fitte verso i
 * lati lunghi e più rade verso il centro. La linea i (da 1 al centro, che è la numero CHEST_LID_LINES) sta a una distanza dal
 * lato lungo pari a (i / CHEST_LID_LINES) ^ CHEST_LID_CURVE della metà dello scrigno; si parte dalla CHEST_LID_FIRST_LINE,
 * perché le prime si confonderebbero col contorno.
 */
export const CHEST_LID_LINES = 8;
export const CHEST_LID_CURVE = 2.5;
export const CHEST_LID_FIRST_LINE = 3;
export const CHEST_LID_BAND_PX = 3.5;
/** Il fermaglio sul lato lungo davanti. */
export const CHEST_LATCH_WIDTH_PX = 8;
export const CHEST_LATCH_HEIGHT_PX = 7;
/** Interno dello scrigno aperto: quanto è largo il bordo che scende verso il fondo, e in quante fasce sfuma. */
export const CHEST_INNER_INSET_PX = 7;
export const CHEST_INSIDE_STEPS = 4;
/** Quanto dura l'apertura del coperchio (si ribalta verso il lato lungo dietro e scopre l'interno), in millisecondi. */
export const CHEST_ANIM_MS = 380;

// --- Scale ---
/** Punti movimento per passare da un capo all'altro di una scalinata. */
export const STAIRS_MOVE_COST = 1;
/**
 * Il disegno: i lati chiusi sono muri veri (vedi markers/stairs-walls.ts). I gradini riempiono tutto lo spazio dentro i muri,
 * dalla parete chiusa al lato aperto: quanti, vuoto fra uno e l'altro, raggio degli angoli smussati e margine dai muri (pixel).
 * Poi il passo del tratteggio del filo che unisce i due capi.
 */
export const STAIRS_STEPS = 5;
export const STAIRS_STEP_GAP_PX = 3;
export const STAIRS_STEP_RADIUS_PX = 2.5;
export const STAIRS_STEP_MARGIN_PX = 3;
export const STAIRS_LINK_DASH_PX = 6;
export const STAIRS_LINK_GAP_PX = 6;
/** Il filo fra i capi corre in orizzontale e in verticale, e negli angoli curva: raggio massimo della curva (pixel). */
export const STAIRS_LINK_CORNER_RADIUS_PX = 56;
export const STAIRS_LINK_CURVE_STEPS = 12;

// --- Oggetti a terra ---
/** Monete che un segnalino Denaro dà a ognuno degli eroi. */
export const COINS_PER_TOKEN = 100;
/** Altezza della pozione, in rapporto alla cella; dimensione della chiave runica (icona) e raggio delle monete (pixel). */
export const POTION_HEIGHT_RATIO = 0.56;
export const RUNE_PICKUP_SIZE_PX = 34;
export const KEY_PICKUP_SIZE_PX = 32;
export const COIN_RADIUS_PX = 11;
/** La pila di monete di `public/tokens/gold_pile.svg`: altezza in rapporto alla cella. */
export const COIN_PILE_SIZE_RATIO = 0.62;
/** Il segnalino Denaro è una piccola pila di monete viste dall'alto: quante e di quanto sono sfalsate (pixel). */
export const COIN_STACK_COUNT = 3;
export const COIN_STACK_OFFSET_PX = 5;

// --- Esplorazione ---
/** Quanto dura la comparsa di ciò che si scopre (il velo che svanisce, un mostro che appare), in millisecondi. */
export const REVEAL_ANIM_MS = 350;
/** Un mostro appena rivelato compare un po' più grande e si assesta alla misura vera. */
export const REVEAL_SCALE_FROM = 1.2;

// --- Porte ---
/** Spessore del segmento della porta. */
export const DOOR_THICKNESS_PX = 8;
/**
 * Stile lineare della porta: contorno sottile e campitura a tratti, niente riempimenti pieni.
 * Spessore delle linee (sempre pixel dello schermo, come la griglia), passo del tratteggio lungo gli assi
 * (pixel del mondo) e distanza minima dalle linee dei muri, per non sovrapporsi. Colori e opacità: theme.ts.
 */
export const DOOR_LINE_WIDTH_PX = LINE.hairline;
export const DOOR_HATCH_SPACING_PX = 4;
/** Porta aperta: l'arco che l'anta ha percorso è tratteggiato (trattino e vuoto in pixel). */
export const DOOR_ARC_DASH_PX = 4;
export const DOOR_ARC_GAP_PX = 4;
export const DOOR_WALL_CLEARANCE_PX = 2;
/** Punti movimento per aprire o chiudere una porta. */
export const DOOR_MOVE_COST = 2;
/** Punti movimento per scassinare la serratura di una porta a chiave (poi la porta si apre). Per ora riesce sempre. */
export const DOOR_PICK_COST = 4;
/** Quanto dura l'animazione di apertura e chiusura dell'anta, in millisecondi. */
export const DOOR_ANIM_MS = 380;
/** Il distintivo sulla porta bloccata: dimensione dell'icona e raggio del disco che le sta dietro. */
export const DOOR_ICON_SIZE_PX = 20;
export const DOOR_BADGE_RADIUS_PX = 14;
/** Quanto dura la sparizione dell'icona quando la serratura si apre, in millisecondi. */
export const DOOR_ICON_FADE_MS = 300;
/** Icone usate (nomi dei file in public/icons/, Google Material Symbols): una per ogni significato. */
export const ICONS = { doorKey: 'tokens/padlock', keyPickup: 'tokens/little_key', doorRune: 'diamond', potion: 'tokens/potion', coins: 'tokens/gold_pile', runeKey: 'tokens/rune_key' } as const;
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
/** Roccia: attorno al masso, per ogni cella occupata, quanti sassi e detriti (solo scena) e i loro raggi (pixel). */
export const ROCK_PEBBLES_PER_CELL = 2;
export const ROCK_DEBRIS_PER_CELL = 5;
export const ROCK_PEBBLE_RADIUS_MIN_PX = 3;
export const ROCK_PEBBLE_RADIUS_MAX_PX = 5;
export const ROCK_DEBRIS_RADIUS_MIN_PX = 1;
export const ROCK_DEBRIS_RADIUS_MAX_PX = 2;
/** Distanza minima dei sassi dal bordo delle celle dell'ostacolo. */
export const ROCK_SCATTER_MARGIN_PX = 2;
/** Buca: distanza del bordo dal bordo della cella, quante fasce ha il gradiente e quanto è larga ciascuna. */
export const PIT_EDGE_INSET_PX = 7;
export const PIT_GRADIENT_STEPS = 9;
export const PIT_GRADIENT_STEP_PX = 3;
/** Buca: linee a 45° dagli angoli verso il centro, per la profondità. Lunghezza lungo gli assi (pixel) e a quanti tratti sfumano. */
export const PIT_RAY_LENGTH_PX = 18;
export const PIT_RAY_STEPS = 8;
/** Acqua: distanza dal bordo della cella (uguale vicino ai muri e ai lati liberi), e raggio (uguale per tutti) degli angoli arrotondati. */
export const WATER_EDGE_INSET_PX = WALL_WIDTH_PX / 2; // come la faccia interna dei muri: così il bordo non fa gradini
export const WATER_ROUND_PX = 20;
/** Campitura dell'acqua: distanza fra le righe, altezza e lunghezza dell'onda (pixel). */
export const WATER_TEXTURE_SPACING_PX = 8;
export const WATER_TEXTURE_AMPLITUDE_PX = 1.5;
export const WATER_TEXTURE_WAVELENGTH_PX = 18;
/** Di quanto (in lunghezze d'onda) è sfasata ogni riga rispetto alla precedente: a scalino, per una texture uniforme. */
export const WATER_TEXTURE_STEP = 0.25;
/** Le righe scorrono, alternate a destra e a sinistra: tempo che una riga impiega a spostarsi di una lunghezza d'onda, in millisecondi. */
export const WATER_FLOW_PERIOD_MS = 6000;
/** Quante volte, in un periodo di scorrimento, l'opacità delle righe va su e giù (le righe pari e dispari in contrasto di fase). */
export const WATER_SHIMMER_CYCLES = 2;
