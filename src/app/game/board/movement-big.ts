import { Board, Cell, cellKey } from './board';
import { ResolvedDoor } from './door';
import { DoorOpening, Reach } from './movement';

/** La sagoma di un mostro grande: la casella in alto a sinistra e quante ne occupa (un rettangolo). */
export interface Shape {
  cell: Cell;
  size: { w: number; h: number };
}

/** Una sagoma raggiungibile: quanto costa e il percorso (passo per passo) per arrivarci dalla partenza. */
export interface ShapeReach {
  shape: Shape;
  cost: number;
  path: Reach[];
}

const ORTHOGONAL: Cell[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
const DIAGONAL: Cell[] = [{ x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }];

const add = (c: Cell, d: Cell): Cell => ({ x: c.x + d.x, y: c.y + d.y });
const cellsOf = (s: Shape): Cell[] => {
  const out: Cell[] = [];
  for (let dy = 0; dy < s.size.h; dy++) for (let dx = 0; dx < s.size.w; dx++) out.push({ x: s.cell.x + dx, y: s.cell.y + dy });
  return out;
};
const keyOf = (s: Shape) => `${s.cell.x},${s.cell.y},${s.size.w}x${s.size.h}`;

/** Il rettangolo che contiene queste caselle (due caselle vicine formano sempre un 1×2 o un 2×1). */
function boundingShape(cells: Cell[]): Shape {
  const x = Math.min(...cells.map((c) => c.x));
  const y = Math.min(...cells.map((c) => c.y));
  return { cell: { x, y }, size: { w: Math.max(...cells.map((c) => c.x)) - x + 1, h: Math.max(...cells.map((c) => c.y)) - y + 1 } };
}

/** Un passo possibile: dove arriva la sagoma e quali passaggi fra caselle fa (da una casella a quella dove va). */
interface Move {
  to: Shape;
  crossings: [Cell, Cell][];
}

/**
 * I passi che una sagoma può fare (docs/REGOLE.md, "Mostri grandi"):
 * - Un mostro di due caselle (il Segugio infernale) muove metà del corpo in una casella adiacente non diagonale (qualunque delle due metà, in una delle
 *   tre direzioni libere) e l'altra metà finisce dove la prima era: così si piega e ruota; oppure fa il movimento laterale, cioè entrambe le metà di una
 *   casella nella stessa direzione obliqua.
 * - Il Drago (sei caselle) si sposta intero lungo il suo asse, ruota di 90° se va di lato, o si sposta intero in obliquo (vedi sotto).
 * - Gli altri (quattro caselle) si spostano interi di una casella in una delle otto direzioni, come un personaggio normale.
 */
function movesOf(s: Shape): Move[] {
  const cells = cellsOf(s);
  const moves: Move[] = [];
  if (cells.length === 2) {
    for (const [lead, other] of [[cells[0], cells[1]], [cells[1], cells[0]]] as const) {
      for (const d of ORTHOGONAL) {
        const n = add(lead, d);
        if (n.x === other.x && n.y === other.y) continue;
        moves.push({ to: boundingShape([n, lead]), crossings: [[lead, n]] });
      }
    }
    for (const d of DIAGONAL) moves.push({ to: boundingShape(cells.map((c) => add(c, d))), crossings: cells.map((c) => [c, add(c, d)] as [Cell, Cell]) });
    return moves;
  }
  const own = new Set(cells.map(cellKey));
  const translate = (d: Cell) => {
    const crossings = cells.filter((c) => !own.has(cellKey(add(c, d)))).map((c) => [c, add(c, d)] as [Cell, Cell]);
    moves.push({ to: { cell: add(s.cell, d), size: s.size }, crossings });
  };
  if (cells.length === 6) {
    // Il Drago (sei caselle, 2×3 o 3×2). Come il Segugio: lungo il suo asse si sposta intero di una casella (la metà dietro segue quella davanti); di lato
    // si gira di 90°, tenendo fermo un blocco 2×2 (a un'estremità: il Signore supremo sceglie quale) e aggiungendo la fila dalla parte dove va, come nel
    // manuale ("Il Drago si sposta in alto... avrebbe potuto terminare anche nello spazio in alto a sinistra"). In obliquo si sposta intero (movimento laterale).
    const horizontal = s.size.w > s.size.h;
    const { x, y } = s.cell;
    for (const d of ORTHOGONAL) {
      if ((d.x !== 0) === horizontal) {
        translate(d); // lungo l'asse lungo
        continue;
      }
      if (horizontal) {
        // 3×2 che va in su o in giù: diventa 2×3 su una delle due estremità.
        for (const bx of [x, x + 1]) {
          const crossings: [Cell, Cell][] = [0, 1].map((i) => (d.y < 0 ? [{ x: bx + i, y }, { x: bx + i, y: y - 1 }] : [{ x: bx + i, y: y + 1 }, { x: bx + i, y: y + 2 }]) as [Cell, Cell]);
          moves.push({ to: { cell: { x: bx, y: d.y < 0 ? y - 1 : y }, size: { w: 2, h: 3 } }, crossings });
        }
      } else {
        // 2×3 che va a destra o a sinistra: diventa 3×2 su una delle due estremità.
        for (const by of [y, y + 1]) {
          const crossings: [Cell, Cell][] = [0, 1].map((i) => (d.x > 0 ? [{ x: x + 1, y: by + i }, { x: x + 2, y: by + i }] : [{ x, y: by + i }, { x: x - 1, y: by + i }]) as [Cell, Cell]);
          moves.push({ to: { cell: { x: d.x > 0 ? x : x - 1, y: by }, size: { w: 3, h: 2 } }, crossings });
        }
      }
    }
    for (const d of DIAGONAL) translate(d);
    return moves;
  }
  // I mostri da quattro caselle si spostano interi di una casella in una delle otto direzioni.
  for (const d of [...ORTHOGONAL, ...DIAGONAL]) translate(d);
  return moves;
}

/**
 * Tutte le sagome in cui un mostro grande può arrivare da `start` con al massimo `points` punti (un passo costa 1, più il costo delle porte che apre).
 * Ogni casella della sagoma deve esistere e non avere roccia o acqua, né una scala (i grandi non usano le scale); le buche non contano a meno che la
 * sagoma ci finisca interamente (lo decide chi chiama). `blocked` sono le caselle dei nemici, che non si attraversano. Include la partenza (costo 0).
 */
export function reachableShapes(board: Board, start: Shape, points: number, blocked: ReadonlySet<string> = new Set(), doorOpening?: DoorOpening): ShapeReach[] {
  const free = (c: Cell) => board.isWalkable(c) && !board.blocksMovement(c) && board.markerAt(c)?.type !== 'stairs' && !blocked.has(cellKey(c));
  const best = new Map<string, { shape: Shape; cost: number; prev: string | null; step: Reach | null }>();
  best.set(keyOf(start), { shape: start, cost: 0, prev: null, step: null });
  const buckets: Shape[][] = Array.from({ length: points + 1 }, () => []);
  buckets[0].push(start);

  for (let cost = 0; cost <= points; cost++) {
    for (const shape of buckets[cost]) {
      const here = best.get(keyOf(shape))!;
      if (here.cost !== cost) continue; // trovato un modo più economico
      for (const move of movesOf(shape)) {
        if (!cellsOf(move.to).every(free)) continue;
        // Ogni passaggio da una casella all'altra deve essere libero da muri; una porta chiusa si apre se si può, pagando.
        const doors: ResolvedDoor[] = [];
        let ok = true;
        for (const [a, b] of move.crossings) {
          if (board.canStep(a, b)) continue;
          if (doorOpening && board.canStep(a, b, true)) {
            const found = board.doorsCrossed(a, b);
            if (found.length && found.every((rd) => doorOpening.may(rd))) {
              for (const rd of found) if (!doors.includes(rd)) doors.push(rd);
              continue;
            }
          }
          ok = false;
          break;
        }
        if (!ok) continue;
        const stepCost = 1 + doors.length * (doorOpening?.cost ?? 0);
        const total = cost + stepCost;
        if (total > points) continue;
        const key = keyOf(move.to);
        const current = best.get(key);
        if (current && current.cost <= total) continue;
        const step: Reach = { cell: move.to.cell, size: move.to.size, cost: total, prev: shape.cell, stepCost, kind: 'step', ...(doors.length ? { opens: doors } : {}) };
        best.set(key, { shape: move.to, cost: total, prev: keyOf(shape), step });
        buckets[total].push(move.to);
      }
    }
  }

  const pathTo = (key: string): Reach[] => {
    const path: Reach[] = [];
    for (let e = best.get(key); e && e.step; e = e.prev ? best.get(e.prev) : undefined) path.unshift(e.step);
    return path;
  };
  return [...best.entries()].map(([key, e]) => ({ shape: e.shape, cost: e.cost, path: pathTo(key) }));
}
