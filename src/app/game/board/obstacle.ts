import { Cell } from './board';

/** Ostacoli naturali. Roccia e acqua bloccano il movimento; la buca fa cadere chi ci entra. */
export type ObstacleType = 'rock' | 'pit' | 'water';

/**
 * Un ostacolo, come è scritto nella mappa: dati dell'avventura. Occupa `length` celle in fila a partire
 * da (x, y), verso destra oppure, se `vertical`, verso il basso.
 */
export interface Obstacle {
  type: ObstacleType;
  x: number;
  y: number;
  length: number;
  vertical?: boolean;
  /** Solo per le rocce: un masso grande 2×2 (nasce nell'editor affiancando delle macerie a formare un quadrato); `x`, `y` è la casella in alto a sinistra e `length` vale 2. */
  big?: boolean;
  /** Solo per buca e acqua: la casella non si fonde con le vicine dello stesso tipo (separata dall'editor): nel disegno è una forma a sé e per le regole una buca a sé. */
  alone?: boolean;
}

export function obstacleCells(o: Obstacle): Cell[] {
  if (o.big) return [{ x: o.x, y: o.y }, { x: o.x + 1, y: o.y }, { x: o.x, y: o.y + 1 }, { x: o.x + 1, y: o.y + 1 }];
  return Array.from({ length: o.length }, (_, i) => ({ x: o.x + (o.vertical ? 0 : i), y: o.y + (o.vertical ? i : 0) }));
}
