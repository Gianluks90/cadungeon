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
/** Il tasto "centra" porta l'eroe al centro e lo zoom a quello di 4 click su + dallo zoom iniziale; e quanto dura, in millisecondi. */
export const CAMERA_FOCUS_ZOOM = ZOOM_START * ZOOM_BUTTON_FACTOR ** 3;
export const CAMERA_CENTER_MS = 450;
/** Mentre un eroe si muove, la camera lo segue (solo pan, lo zoom non cambia): quanto è morbido l'inseguimento (più è alto, più è lento), in millisecondi. */
export const CAMERA_FOLLOW_SMOOTH_MS = 140;
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
/** Conquista (docs/REGOLE.md, sezione 8): valore di partenza se l'avventura non lo indica (da bilanciare) e premio per ogni glifo acceso. */
export const DEFAULT_PROGRESS = 20;
/** Il mazzo dell'Overlord (docs/REGOLE.md, sezione 9; tutti da bilanciare): carte in mano all'inizio e al massimo, carte pescate a ogni turno e Conquista persa quando il mazzo finisce. */
/** Il rospo: velocità fissa, armatura 0 e segnalini di partenza. */
export const TOAD_SPEED = 5;
export const TOAD_TOKENS = 2;
export const OVERLORD_START_HAND = 3;
export const OVERLORD_HAND_MAX = 8;
export const OVERLORD_DRAW = 2;
export const OVERLORD_DECK_END_PENALTY = 3;
export const GLYPH_PROGRESS = 3;
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
/** Un oggetto del catalogo (una reliquia) a terra: lato dell'icona, in pixel del mondo. */
export const ITEM_PICKUP_SIZE_PX = 34;
/**
 * Il Denaro a terra è un elemento ambientale disegnato da codice, come le rocce: tante monete piccole viste dall'alto, una per ogni
 * moneta che vale il segnalino (COINS_PER_TOKEN), a formare un mucchio più fitto al centro, con una parte di monete sparse intorno.
 * Tutto dal seme della mappa. Raggio medio del mucchio, raggio minimo e massimo di una moneta, quota di monete sparse fuori dal
 * mucchio, margine dal bordo della cella (i muri sporgono di 7 px dentro la cella: le monete non devono arrivarci) e lati dei cerchietti (sono poligoni, e le monete sono piccole).
 */
export const COIN_PILE_RADIUS_PX = 14;
export const COIN_RADIUS_MIN_PX = 2.2;
export const COIN_RADIUS_MAX_PX = 3;
export const COIN_SCATTERED_SHARE = 0.12;
export const COIN_SCATTER_MARGIN_PX = 11;
export const COIN_CIRCLE_SEGMENTS = 12;

// --- Pozioni ---
/** Quante pozioni porta un eroe, quante ferite ridà la curativa, e quanti punti movimento costano bere e dare una pozione (raccoglierla non costa niente). */
export const POTION_LIMIT = 3;
export const POTION_HEAL = 4;
export const POTION_DRINK_COST = 1;
export const POTION_GIVE_COST = 1;

// --- Equipaggiamento (docs/REGOLE.md, sezione 3c) ---
/** Cosa può avere equipaggiato un eroe: mani, armature, oggetti vari; quanti oggetti nello zaino; costi in punti movimento (scartare un oggetto non costa niente). */
export const EQUIP_HANDS = 2;
export const EQUIP_ARMOR_LIMIT = 1;
export const EQUIP_OTHER_LIMIT = 2;
export const BACKPACK_LIMIT = 3;
export const REEQUIP_COST = 2;
export const ITEM_GIVE_COST = 1;
/** Un tesoro che un eroe non può tenere (nessun posto) si scarta subito per monete, secondo il mazzo da cui viene. */
export const TREASURE_SELL_COINS = { copper: 250, silver: 500, gold: 750 } as const;

// --- La città (docs/REGOLE.md, sezione 3d) ---
/** Tornare nel dungeon da un glifo diverso da quello da cui si è partiti costa monete (il servizio di teletrasporto), non movimento. */
export const CITY_TELEPORT_COST = 25;
/** I prezzi dei servizi in monete: pozioni, tesori pescati dai mazzi, ripristino della salute al tempio (inventato da noi). */
export const POTION_PRICES = { heal: 50, vital: 25 } as const;
export const TREASURE_PRICES = { copper: 250, silver: 500, gold: 750 } as const;
export const TEMPLE_HEAL_COST = 100;
/** Il colpo fatale a un mostro potenziato (leader) dà all'eroe che lo mette a segno questa ricompensa in monete (docs/REGOLE.md). */
export const ENHANCED_KILL_COINS = 50;
/** Si vende a metà prezzo, arrotondato per difetto a un multiplo di questa cifra. */
export const SELL_STEP_COINS = 25;
/** Campo di addestramento: una nuova carta abilità, un dado in più a uno dei tre attacchi (fino a ATTACK_DICE_MAX). */
export const SKILL_CARD_PRICE = 1000;
export const ATTACK_DICE_PRICE = 500;
export const ATTACK_DICE_MAX = 5;

/** Quanto dura la scomparsa di un eroe che muore (sfuma e diventa rosso), in millisecondi. */
export const HERO_DEATH_FADE_MS = 2200;

// --- Esplorazione ---
/** Quanto dura la comparsa di ciò che si scopre (il velo che svanisce, un mostro che appare), in millisecondi. */
export const REVEAL_ANIM_MS = 350;
/** Velo sulle caselle non esplorate: distanza fra le linee del tratteggio diagonale, in pixel del mondo. */
export const FOG_HATCH_STEP_PX = 10;
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
export const ICONS = { doorKey: 'tokens/padlock', keyPickup: 'tokens/little_key', doorRune: 'diamond', potion: 'tokens/potion', runeKey: 'tokens/rune_key' } as const;
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

// --- Ritmo delle azioni dell'Overlord e degli attacchi (tutti i tempi in millisecondi: si regolano qui) ---
export const FX = {
  /** Il messaggio al centro dello schermo (carta giocata, trappola scattata...): quanto resta prima di sparire. */
  announceMs: 3000,
  /** Dopo quanto dall'apparire del messaggio parte l'azione (la camera, i mostri...): il tempo di leggere l'effetto. */
  announceLeadMs: 2000,
  /** Lo scorrimento della camera verso la zona interessata (solo pan, lo zoom resta dei giocatori). */
  cameraPanMs: 900,
  /** Dopo il messaggio e prima che i mostri evocati entrino. */
  summonDelayMs: 200,
  /** I mostri evocati escono dall'ombra: dissolvenza e traslazione dal centro del tile in cui compaiono. */
  enterMs: 600,
  /** Un mostro che entra parte a questa scala e arriva a 1, come se cadesse dall'alto. */
  enterScale: 1.5,
  /** Una pedina scaraventata (Contraccolpo) salta: la durata, la scala al culmine (1 → 1,5 → 1) e, all'atterraggio, la raggiera di linee grigie (quante e quanto dura). */
  jumpMs: 520,
  jumpScale: 1.5,
  burstLines: 12,
  burstMs: 420,
  /** Pausa dopo l'ingresso, prima che i mostri si attivino. */
  afterSummonMs: 1200,
  /** Attacco in mischia: lo scatto a metà strada, lo scontro, il ritorno. */
  lungeMs: 260,
  strikeMs: 160,
  returnMs: 320,
  /** Attacco a distanza o magico: la linea compare, il proiettile corre a metà strada, poi arriva (o la linea svanisce). */
  lineMs: 450,
  shotMs: 420,
  shotFinishMs: 260,
  lineFadeMs: 450,
  /** Il numero o la scritta sopra la pedina (-3, Mancato): quanto sale e svanisce, e di quanti pixel. */
  floatMs: 3000,
  floatRisePx: 40,
  /** La linea tratteggiata dell'attacco a distanza: trattino e vuoto, in pixel del mondo, e opacità. */
  dashPx: 9,
  gapPx: 7,
  lineAlpha: 0.22,
  /** Il dardo (il colpo): fin dove arriva prima del dialogo (frazione del percorso), lunghezza della scia in pixel e quanti pezzi la compongono. */
  shotStop: 0.75,
  trailPx: 120,
  trailParts: 16,
};

/** Le caselle di partenza degli eroi: un cerchio a trattini (raggio in celle, numero di trattini, spessore) che lampeggia piano (un ciclo in `pulseMs`, l'opacità oscilla fra `alphaMin` e `alphaMax`). */
export const START_MARK = { radius: 0.36, dashes: 14, dashFill: 0.55, line: 1.5, pulseMs: 2600, alphaMin: 0.3, alphaMax: 1 };

/**
 * Le torce, appese ai muri (docs/style-guide.md): una staffa sporge dal muro verso la stanza e regge una coppa con il fuoco (quattro strati di lingue
 * che cambiano forma di continuo, qualche scintilla che sale) e un alone caldo (raggio in celle) illumina il pavimento intorno, solo nelle caselle già
 * esplorate. Il fuoco e l'alone ondeggiano piano (`flickerMs` è la durata di un ondeggiamento).
 */
export const TORCH = { bracketPx: 9, bracketWidthPx: 2, cupPx: 5.5, glowRadiusCells: 2.6, flickerMs: 240, embers: 4, emberRiseMs: 1500 };

/**
 * I dettagli scenici. Ragnatele: la probabilità per ogni angolo fra due muri, e la lunghezza massima in pixel. Sassi: la probabilità per ogni casella accanto a una roccia,
 * quanti sassi al massimo e quanti detriti piccoli al massimo. Il sale mescola il seme della mappa, così ogni tipo di dettaglio ha le sue caselle.
 */
export const SCENERY = { webChance: 0.3, webMax: 34, salt: 0x5ce9e, pebbleChance: 0.55, pebbleMax: 3, debrisMax: 4, pebbleSalt: 0x9eb81e, pebbleMinPx: 1.4, pebbleMaxPx: 2.8, debrisMinPx: 0.5, debrisMaxPx: 1, pebbleAlpha: 0.5, boneChance: 0, /* ossa spente per ora: il codice resta, si riaccendono alzando questo valore (0,035 era la prova) */ boneSalt: 0xb04e5, boneMinPx: 15, boneMaxPx: 24, boneBrokenChance: 0.4, boneFragmentAlone: 0.65, skullChance: 0.015 };

/** La distanza massima a cui un mostro con un attacco a distanza o magico cerca di stare dal bersaglio (si ferma prima se la sua gittata di solito è minore). */
export const SHOOTER_DISTANCE_CAP = 5;
