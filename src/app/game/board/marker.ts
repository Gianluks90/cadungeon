import { RuneColor } from './door';

/**
 * Un segnalino sulla mappa, come è scritto nel file dell'avventura (dati dell'avventura, come porte e ostacoli).
 * Occupa una casella. Per ora ci sono glifi, scrigni e scale e oggetti a terra (pozioni, denaro, chiavi); gli altri (scalinate, incontri) si aggiungeranno qui.
 */
export type Marker = Glyph | Chest | Potion | Coins | RuneKey | Key | ItemPickup | Stairs;

/**
 * Glifo: un segno arcano sul pavimento. Ha due stati: spento (rosso) e acceso (bianco pulsante). Un eroe lo accende
 * entrando nella sua casella, anche solo passandoci sopra. Una volta acceso resta acceso.
 * (Accenderlo vale +3 al Progresso del gruppo, vedi GLYPH_PROGRESS.)
 */
export interface Glyph {
  type: 'glyph';
  x: number;
  y: number;
  /** Acceso. Se manca, è spento. */
  active?: boolean;
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
}

/**
 * Un premio: il Progresso (da +2 a +4 negli scrigni), una chiave runica o il denaro (100 monete
 * per ognuno degli eroi, come il segnalino Denaro). Pozioni e oggetti arriveranno con l'inventario.
 */
export type Loot =
  | { kind: 'progress'; amount: number }
  | { kind: 'rune'; color: RuneColor }
  | { kind: 'key'; keyId: string }
  | { kind: 'coins' }
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
 * Pozione: la curativa ridà 3 ferite, quella di vitalità i punti fatica (fuori scope: per ora si porta e si dà, ma non si beve).
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
}
