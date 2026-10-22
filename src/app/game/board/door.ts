/**
 * Una porta, come è salvata nella mappa: un lato di cella (`x`, `y`) su una linea della griglia.
 * `horizontal` = la porta sta su una linea orizzontale (separa la cella sopra da quella sotto).
 * La lunghezza non si salva: si calcola da muro a muro (vedi Board).
 */
export interface Door {
  x: number;
  y: number;
  horizontal: boolean;
  open: boolean;
  /**
   * Solo per il disegno: da che parte si apre l'anta, 1 = verso il lato positivo della linea (sotto o a destra),
   * -1 = verso il lato negativo. Si apre "a spinta", cioè davanti a chi la apre. Se manca, 1.
   */
  swing?: 1 | -1;
}

/** Dove sta una porta: la linea, e da dove a dove va (in celle), sempre da muro a muro. */
export interface DoorSpan {
  horizontal: boolean;
  line: number;
  from: number;
  to: number;
}

export interface ResolvedDoor extends DoorSpan {
  door: Door;
}
