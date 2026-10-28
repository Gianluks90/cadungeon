import { RuneColor } from './door';

/**
 * Un segnalino sulla mappa, come è scritto nel file dell'avventura (dati dell'avventura, come porte e ostacoli).
 * Occupa una casella. Per ora ci sono glifi, scrigni e scale e oggetti a terra (pozioni, denaro, chiavi); gli altri (scalinate, incontri) si aggiungeranno qui.
 */
export type Marker = Glyph | Chest | Potion | Coins | RuneKey | Key | ItemPickup | Stairs | Encounter;

/**
 * Glifo: un segno arcano sul pavimento. Ha due stati: spento (rosso) e acceso (bianco pulsante). Un eroe lo accende
 * entrando nella sua casella, anche solo passandoci sopra. Una volta acceso resta acceso.
 * (Accenderlo vale +3 alla Conquista del gruppo, vedi GLYPH_PROGRESS.)
 */
export interface Glyph {
  type: 'glyph';
  x: number;
  y: number;
  /** Acceso. Se manca, è spento. */
  active?: boolean;
}

/**
 * Segnalino Incontro: un "?" sulla mappa che segna dove succederà qualcosa (un incontro dell'avventura). Per ora si mette e si vede soltanto: le regole dell'incontro (cosa succede
 * quando gli eroi lo raggiungono) arriveranno con gli incontri.
 */
export interface Encounter {
  type: 'encounter';
  x: number;
  y: number;
}

/** Il tipo di uno scrigno (come i tre mazzi del regolamento): si vede subito, nel colore. Il contenuto invece resta nascosto. */
export type ChestTier = 'copper' | 'silver' | 'gold';

/**
 * Scrigno: sta in una casella, che resta percorribile (non è un ostacolo). Un eroe che ci sta sopra lo apre spendendo 2 punti
 * movimento, ma non se nella casella c'è un'altra pedina. Aperto, resta sulla mappa come cassa vuota (solo scena).
 */
export interface Chest {
  type: 'chest';
  x: number;
  y: number;
  tier: ChestTier;
  /** Rotazione a scatti di 90 gradi in senso orario. Di default il lato lungo con il fermaglio è in basso e il coperchio si apre verso l'alto. */
  rotation?: 0 | 90 | 180 | 270;
  /** Aperto. Se manca, è chiuso. */
  open?: boolean;
  /** Il contenuto, deciso dall'avventura: tutto ciò che c'è dentro viene dato al gruppo all'apertura. */
  contents?: Loot[];
  /**
   * Il bottino casuale: aprendolo ogni eroe pesca una carta tesoro dal mazzo del tipo dello scrigno (rame, argento o oro). Di solito c'è;
   * chi crea l'avventura lo può togliere con `false` (resta solo `contents`).
   */
  random?: boolean;
  /** Quante carte tesoro pesca ogni eroe quando `random` è vero (se manca, una). Le righe della tabella dei ritrovamenti possono darne di più. */
  treasures?: number;
  /** La ricompensa pescata dalla tabella dei ritrovamenti dell'avventura ("Rame 2"): si decide la prima volta che lo scrigno si tocca per aprirlo. */
  ticket?: string;
}

/**
 * Una riga della tabella dei ritrovamenti (`MapData.chestTable`): tutto ciò che dà una ricompensa. Come nel gioco originale ogni tipo di scrigno ha fino a 3 ricompense (2 quelli d'oro)
 * anche se gli scrigni sono di meno; aprendo uno scrigno si gira il suo segnalino e se ne pesca una a caso fra quelle non ancora uscite per quel tipo.
 */
export interface ChestReward {
  /** Conquista, denaro, maledizioni... */
  contents: Loot[];
  /** Quante carte dal mazzo dei tesori di quel tipo pesca ogni eroe (come `Chest.random`); se manca, nessuna. */
  treasures?: number;
}

/** La tabella dei ritrovamenti: le ricompense di ogni tipo di scrigno, in ordine (la prima è "Rame 1", la seconda "Rame 2"...). */
export type ChestTable = Partial<Record<ChestTier, ChestReward[]>>;

/** Quante ricompense al massimo ha ogni tipo di scrigno nella tabella, e quanti scrigni se ne possono mettere (lo stesso numero). */
export const CHEST_TABLE_MAX: Record<ChestTier, number> = { copper: 3, silver: 3, gold: 2 };

/** I nomi dei tipi di scrigno nella tabella. */
export const CHEST_TIER_NAMES: Record<ChestTier, string> = { copper: 'Rame', silver: 'Argento', gold: 'Oro' };

/**
 * Un premio: la Conquista (da +2 a +4 negli scrigni), una chiave runica o il denaro (100 monete
 * per ognuno degli eroi, come il segnalino Denaro). Pozioni e oggetti arriveranno con l'inventario.
 */
export type Loot =
  | { kind: 'progress'; amount: number }
  | { kind: 'rune'; color: RuneColor }
  | { kind: 'key'; keyId: string }
  /** Denaro: `amount` monete a ognuno degli eroi (se manca, 100 come il segnalino Denaro). */
  | { kind: 'coins'; amount?: number }
  /** Segnalini Maledizione: ognuno dà al Signore supremo Minaccia pari al numero di eroi, prima di ogni altro premio del baule. */
  | { kind: 'curse'; amount: number }
  /** Un oggetto del catalogo (una reliquia, per esempio): lo riceve chi apre lo scrigno. */
  | { kind: 'item'; itemId: string };

/**
 * Oggetti a terra: un eroe che entra nella loro casella li raccoglie da solo, anche solo passandoci sopra, senza spendere
 * punti movimento (solo gli eroi: i mostri non raccolgono). Raccolti spariscono (`collected`).
 */
interface Pickup {
  x: number;
  y: number;
  /** Già raccolto: non c'è più sulla mappa. */
  collected?: boolean;
}

/** I due tipi di pozione. */
export type PotionKind = 'heal' | 'vital';

/**
 * Pozione: la curativa ridà 4 ferite (un cuore), quella di vitalità i punti fatica (fuori scope: per ora si porta e si dà, ma non si beve).
 * Un eroe che entra nella casella la raccoglie (senza spendere punti) se porta meno di 3 pozioni; altrimenti resta a terra.
 */
export interface Potion extends Pickup {
  type: 'potion';
  kind: PotionKind;
}

/** Denaro: un segnalino vale 100 monete per ognuno degli eroi (anche morti o in città), non per chi lo raccoglie. */
export interface Coins extends Pickup {
  type: 'coins';
}

/**
 * Chiave runica: non è un oggetto (non sta nello zaino). Trovata, sblocca per tutti gli eroi le porte di quel colore.
 * Può stare a terra come segnalino, oppure in uno scrigno (`Loot`).
 */
export interface RuneKey extends Pickup {
  type: 'rune';
  color: RuneColor;
}


/**
 * Chiave normale: apre la porta a chiave con lo stesso `keyId` (campo `lock` della porta). Raccolta entra nel gruppo
 * (`party.keys`). Come la chiave runica non è un oggetto da zaino, ma una chiave comune (a differenza della runica,
 * la porta si può anche scassinare). Può stare a terra o in uno scrigno (`Loot`).
 */
export interface Key extends Pickup {
  type: 'key';
  keyId: string;
}

/**
 * Un oggetto del catalogo a terra (una reliquia, di solito): un eroe che entra nella casella lo raccoglie, equipaggiato se ci sta, altrimenti
 * nello zaino. Se non ha posto resta a terra. Le reliquie non stanno in nessun mazzo: le mette l'avventura qui o negli scrigni (`Loot`).
 */
export interface ItemPickup extends Pickup {
  type: 'item';
  itemId: string;
}

/**
 * Scale: due segnalini con la stessa etichetta (`link`) sono i due capi di una scalinata. Un eroe (non un mostro) fermo su un
 * capo passa all'altro per 1 punto movimento. Le parti di mappa collegate possono stare ovunque e restare separate: non ci
 * sono piani, tutto è visibile insieme. Chi è su un capo rivela l'altro capo e le 8 caselle intorno, chi è adiacente a un
 * capo vede l'altro capo (come se fossero vicini). I lati chiusi (tre su quattro) sono muri. Un filo tratteggiato unisce i capi.
 */
export interface Stairs {
  type: 'stairs';
  x: number;
  y: number;
  /** L'etichetta della coppia (A, B, C...), che non si vede: le due scale con la stessa etichetta sono collegate. */
  link: string;
  /** Rotazione a scatti di 90 gradi in senso orario. Di default il lato aperto (da cui si entra) è in basso; gli altri tre sono chiusi dal doppio bordo. */
  rotation?: 0 | 90 | 180 | 270;
  /**
   * Il percorso del filo tratteggiato che unisce la coppia, scelto dall'autore con le maniglie dell'editor: i punti (in celle, anche con la parte decimale) fra l'uscita di questa scala e
   * l'arrivo sull'altra, tutti a segmenti orizzontali o verticali. Sta sul primo capo della coppia; senza, il percorso è automatico. Si scarta se una delle due scale si sposta o si ruota.
   */
  route?: { x: number; y: number }[];
}
