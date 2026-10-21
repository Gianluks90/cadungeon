import { Board, Cell, cellKey } from './board';

/** Come si arriva a una casella: quanto costa e da quale casella si arriva. */
export interface Reach {
  cell: Cell;
  cost: number;
  prev: Cell | null;
}

const DIRECTIONS: Cell[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

/** Tutte le caselle che si raggiungono da `start` spendendo al massimo `points` punti (1 per passo). */
export function reachable(board: Board, start: Cell, points: number): Map<string, Reach> {
  const result = new Map<string, Reach>([[cellKey(start), { cell: start, cost: 0, prev: null }]]);
  let frontier: Cell[] = [start];
  for (let cost = 1; cost <= points; cost++) {
    const next: Cell[] = [];
    for (const from of frontier) {
      for (const d of DIRECTIONS) {
        const to = { x: from.x + d.x, y: from.y + d.y };
        if (result.has(cellKey(to)) || !board.canStep(from, to)) continue;
        result.set(cellKey(to), { cell: to, cost, prev: from });
        next.push(to);
      }
    }
    frontier = next;
  }
  return result;
}

/** Il percorso più breve fino a `target`, passo per passo (la casella di partenza non è inclusa). */
export function pathTo(reach: Map<string, Reach>, target: Cell): Cell[] {
  const path: Cell[] = [];
  let step = reach.get(cellKey(target));
  while (step && step.prev) {
    path.unshift(step.cell);
    step = reach.get(cellKey(step.prev));
  }
  return path;
}
