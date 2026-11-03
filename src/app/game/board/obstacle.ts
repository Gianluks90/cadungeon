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
  /** Solo per le buche (Personalizza, vale per tutta la buca): `blocked` nessuno ci entra (come l'acqua: blocca il movimento, non la vista, niente caduta né salto); `deadly` chi ci cade muore. Senza, cade e perde 1 ferita. */
  pitMode?: 'blocked' | 'deadly';
  /** Solo nell'editor: l'autore l'ha personalizzato (badge genetics), anche se i valori sono quelli di base. */
  custom?: boolean;
}

export function obstacleCells(o: Obstacle): Cell[] {
  if (o.big) return [{ x: o.x, y: o.y }, { x: o.x + 1, y: o.y }, { x: o.x, y: o.y + 1 }, { x: o.x + 1, y: o.y + 1 }];
  return Array.from({ length: o.length }, (_, i) => ({ x: o.x + (o.vertical ? 0 : i), y: o.y + (o.vertical ? i : 0) }));
}

/**
 * Le buche raggruppate come le vedono le regole: buche in caselle vicine (a croce, non in diagonale) sono una sola buca, tranne quelle separate dall'editor (`alone`).
 * Serve all'editor (Personalizza vale per tutta la buca) e al disegno dei badge.
 */
export function pitGroups(obstacles: readonly Obstacle[]): Obstacle[][] {
  const pits = obstacles.filter((o) => o.type === 'pit');
  const byCell = new Map<string, Obstacle>();
  for (const o of pits) for (const c of obstacleCells(o)) byCell.set(`${c.x},${c.y}`, o);
  const seen = new Set<Obstacle>();
  const groups: Obstacle[][] = [];
  for (const start of pits) {
    if (seen.has(start)) continue;
    const group: Obstacle[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length) {
      const cur = queue.pop()!;
      group.push(cur);
      if (cur.alone) continue;
      for (const c of obstacleCells(cur)) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = byCell.get(`${c.x + dx},${c.y + dy}`);
          if (n && !n.alone && !seen.has(n)) {
            seen.add(n);
            queue.push(n);
          }
        }
      }
    }
    groups.push(group);
  }
  return groups;
}
