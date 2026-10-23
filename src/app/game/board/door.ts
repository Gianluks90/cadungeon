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
   * Serratura: se c'è, la porta resta chiusa finché non si usa la chiave giusta (o, per le chiavi normali, si scassina).
   * Una porta senza `lock` si apre e si chiude liberamente.
   */
  lock?: DoorLock;
  /** La serratura è già stata aperta (con la chiave o scassinandola): da ora la porta è libera. Salvato con la porta. */
  unlocked?: boolean;
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

/** I tre colori delle chiavi runiche. */
export type RuneColor = 'red' | 'blue' | 'green';

/**
 * Cosa serve per aprire una porta bloccata.
 * - `key`: la chiave `keyId`; in alternativa si scassina, a meno che `pickable` sia false (di solito sì).
 * - `rune`: la chiave runica di quel colore. Non si scassina. Solo gli eroi possono aprirla.
 */
export type DoorLock = { kind: 'key'; keyId: string; pickable?: boolean } | { kind: 'rune'; color: RuneColor };

/** La porta ha ancora una serratura da aprire? */
export const isLocked = (d: Door): boolean => !!d.lock && !d.unlocked;
