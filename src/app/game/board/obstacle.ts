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
}

export function obstacleCells(o: Obstacle): Cell[] {
  return Array.from({ length: o.length }, (_, i) => ({ x: o.x + (o.vertical ? 0 : i), y: o.y + (o.vertical ? i : 0) }));
}
