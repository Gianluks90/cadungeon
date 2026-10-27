import { PIT_CLIMB_COST, PIT_JUMP_COST_PER_SPACE, STAIRS_MOVE_COST } from '../constants';
import { Board, Cell, cellKey } from './board';
import { ResolvedDoor } from './door';

/** Come ci si sposta: un passo normale, un salto sopra una buca, l'uscita da una buca, il viaggio da un glifo all'altro o una scalinata. */
export type StepKind = 'step' | 'jump' | 'climb' | 'travel' | 'stairs';

/** Come si arriva a una casella: quanto costa in totale, da dove si arriva e quanto costa l'ultimo tratto. */
export interface Reach {
  cell: Cell;
  cost: number;
  prev: Cell | null;
  stepCost: number;
  kind: StepKind;
  /** Solo per i mostri grandi: la nuova sagoma dopo il passo (il Segugio infernale ruota quando si piega). */
  size?: { w: number; h: number };
  /** Le porte chiuse che questo passo apre prima di passare (solo per i mostri: vedi `DoorOpening`). */
  opens?: ResolvedDoor[];
}

/** Chi può aprire le porte chiuse lungo la strada: quanto costa ciascuna e quali può aprire. */
export interface DoorOpening {
  cost: number;
  may: (door: ResolvedDoor) => boolean;
}

const DIRECTIONS: Cell[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

const add = (c: Cell, d: Cell): Cell => ({ x: c.x + d.x, y: c.y + d.y });

/**
 * Tutte le caselle raggiungibili da `start` con al massimo `points` punti.
 * - Un passo (anche in diagonale) costa 1. Roccia, acqua e le caselle in `blocked` (i nemici) non si attraversano;
 *   le caselle degli amici sì: toccherà a chi chiama escludere quelle in cui non ci si può fermare.
 * - Entrare in una buca è possibile ma ci si ferma lì (si cade): da una buca non si prosegue camminando.
 * - Una buca si salta per 3 punti per ogni spazio saltato, atterrando dall'altra parte.
 * - Da dentro una buca si esce per 2 punti, su una casella libera accanto alla buca.
 * - `teleports` sono caselle in cui si arriva di colpo, spendendo tutti i punti rimasti (il viaggio da glifo a glifo):
 *   valgono solo se a piedi non si arriva già lì.
 * - `doorOpening`, se c'è, permette di aprire lungo la strada le porte chiuse che `may` ammette, pagando il loro costo (i mostri).
 * - `stairs` collega una casella con una scala all'altro capo della scalinata (1 punto): si può arrivarci a piedi e
 *   proseguire da lì. Chi chiama lo dà solo agli eroi.
 * - `passThrough` (Acrobata): si attraversano nemici, roccia, acqua e buche come se fossero pavimento, senza conseguenze. Tocca a chi chiama escludere
 *   le caselle in cui non ci si può fermare (nemici, ostacoli, buche).
 */
export function reachable(
  board: Board,
  start: Cell,
  points: number,
  blocked: ReadonlySet<string> = new Set(),
  teleports: readonly Cell[] = [],
  stairs: ReadonlyMap<string, Cell> = new Map(),
  doorOpening?: DoorOpening,
  passThrough = false,
): Map<string, Reach> {
  const best = new Map<string, Reach>([[cellKey(start), { cell: start, cost: 0, prev: null, stepCost: 0, kind: 'step' }]]);
  const buckets: Cell[][] = Array.from({ length: points + 1 }, () => []);
  buckets[0].push(start);

  const open = (c: Cell) => board.isWalkable(c) && (passThrough || (!board.blocksMovement(c) && !blocked.has(cellKey(c))));
  const relax = (from: Cell, to: Cell, stepCost: number, kind: StepKind, opens?: ResolvedDoor[]) => {
    const total = best.get(cellKey(from))!.cost + stepCost;
    if (total > points) return;
    const current = best.get(cellKey(to));
    if (current && current.cost <= total) return;
    best.set(cellKey(to), { cell: to, cost: total, prev: from, stepCost, kind, ...(opens ? { opens } : {}) });
    buckets[total].push(to);
  };

  for (let cost = 0; cost <= points; cost++) {
    for (const cell of buckets[cost]) {
      if (best.get(cellKey(cell))!.cost !== cost) continue; // trovato un modo più economico: questo è superato

      if (board.isPit(cell) && (!passThrough || cellKey(cell) === cellKey(start))) {
        // Si cade, e si può solo uscire: lo si fa solo se la pedina era già lì all'inizio.
        if (cellKey(cell) !== cellKey(start)) continue;
        const group = board.pitCells(cell);
        const inGroup = new Set(group.map(cellKey));
        for (const pc of group) {
          for (const d of DIRECTIONS) {
            const t = add(pc, d);
            if (!inGroup.has(cellKey(t)) && board.canStep(pc, t) && open(t) && !board.isPit(t)) relax(cell, t, PIT_CLIMB_COST, 'climb');
          }
        }
        continue;
      }

      const across = stairs.get(cellKey(cell));
      if (across && open(across)) relax(cell, across, STAIRS_MOVE_COST, 'stairs');

      for (const d of DIRECTIONS) {
        const to = add(cell, d);
        if (board.canStep(cell, to) && open(to)) relax(cell, to, 1, 'step');
        else if (doorOpening && open(to) && board.canStep(cell, to, true)) {
          // Una porta chiusa sulla strada: si apre (se si può) pagando il suo costo, poi si passa.
          const doors = board.doorsCrossed(cell, to);
          if (doors.length && doors.every((rd) => doorOpening.may(rd))) relax(cell, to, 1 + doors.length * doorOpening.cost, 'step', doors);
        }

        // Salto: una o più buche in fila, poi una casella libera dall'altra parte (chi attraversa le buche senza conseguenze non ha bisogno di saltare).
        if (passThrough) continue;
        let last = cell;
        let next = to;
        let spaces = 0;
        while (board.isPit(next) && board.canStep(last, next)) {
          spaces++;
          last = next;
          next = add(next, d);
        }
        if (spaces > 0 && board.canStep(last, next) && open(next) && !board.isPit(next)) {
          relax(cell, next, PIT_JUMP_COST_PER_SPACE * spaces, 'jump');
        }
      }
    }
  }
  if (points >= 1) {
    for (const t of teleports) {
      if (!best.has(cellKey(t))) best.set(cellKey(t), { cell: t, cost: points, prev: start, stepCost: points, kind: 'travel' });
    }
  }
  return best;
}

/** Il percorso più economico fino a `target`, tratto per tratto (la casella di partenza non è inclusa). */
export function pathTo(reach: Map<string, Reach>, target: Cell): Reach[] {
  const path: Reach[] = [];
  let step = reach.get(cellKey(target));
  while (step && step.prev) {
    path.unshift(step);
    step = reach.get(cellKey(step.prev));
  }
  return path;
}
