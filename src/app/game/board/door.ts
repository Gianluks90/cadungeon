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
