/**
 * Un segnalino sulla mappa, come è scritto nel file dell'avventura (dati dell'avventura, come porte e ostacoli).
 * Occupa una casella. Per ora c'è un solo tipo; gli altri (scrigni, scalinate, incontri) si aggiungeranno qui.
 */
export type Marker = Glyph;

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
