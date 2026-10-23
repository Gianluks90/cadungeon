/**
 * Un segnalino sulla mappa, come è scritto nel file dell'avventura (dati dell'avventura, come porte e ostacoli).
 * Occupa una casella. Per ora ci sono glifi e scrigni; gli altri (scalinate, incontri) si aggiungeranno qui.
 */
export type Marker = Glyph | Chest;

/**
 * Glifo: un segno arcano sul pavimento. Ha due stati: spento (rosso) e acceso (bianco pulsante). Un eroe lo accende
 * entrando nella sua casella, anche solo passandoci sopra. Una volta acceso resta acceso.
 * (Accenderlo vale +3 al Progresso del gruppo, ma il contatore del Progresso non c'è ancora.)
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
  /** Il contenuto, deciso dall'avventura: per ora solo Progresso (da +2 a +4), ma il contatore non c'è ancora. */
  progress?: number;
}
