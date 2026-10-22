import { CELL_SIZE } from '../constants';
import { Cell, cellKey } from '../board/board';

export type Side = 'N' | 'E' | 'S' | 'W';
export type Point = readonly [number, number];

/** Un lato di cella sul bordo dell'area: va da `from` a `to` (in celle) con l'area alla sua destra. */
interface Edge {
  from: Point;
  to: Point;
  /** Direzione (unitaria) e verso l'interno dell'area (unitario). */
  dir: Point;
  inward: Point;
  inset: number;
}

const SIDES: { side: Side; dx: number; dy: number; from: (x: number, y: number) => Point; to: (x: number, y: number) => Point; inward: Point }[] = [
  { side: 'N', dx: 0, dy: -1, from: (x, y) => [x, y], to: (x, y) => [x + 1, y], inward: [0, 1] },
  { side: 'E', dx: 1, dy: 0, from: (x, y) => [x + 1, y], to: (x, y) => [x + 1, y + 1], inward: [-1, 0] },
  { side: 'S', dx: 0, dy: 1, from: (x, y) => [x + 1, y + 1], to: (x, y) => [x, y + 1], inward: [0, -1] },
  { side: 'W', dx: -1, dy: 0, from: (x, y) => [x, y + 1], to: (x, y) => [x, y], inward: [1, 0] },
];

const vertexKey = (p: Point) => `${p[0]},${p[1]}`;

/**
 * Il perimetro esterno di un insieme di celle, come anelli chiusi di punti in pixel del mondo.
 * Corre sul filo delle celle, ma ogni lato rientra di `insetFor(cella, lato)` pixel verso l'interno.
 * Agli angoli le due rette si incontrano nel loro punto d'incrocio; dove due lati in fila hanno rientri
 * diversi, la linea fa un piccolo scalino perpendicolare, senza interruzioni.
 */
export function reachOutline(cells: ReadonlySet<string>, insetFor: (cell: Cell, side: Side) => number): Point[][] {
  const has = (x: number, y: number) => cells.has(cellKey({ x, y }));
  const outgoing = new Map<string, Edge[]>();
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    for (const s of SIDES) {
      if (has(x + s.dx, y + s.dy)) continue;
      const from = s.from(x, y);
      const to = s.to(x, y);
      const edge: Edge = { from, to, dir: [to[0] - from[0], to[1] - from[1]], inward: s.inward, inset: insetFor({ x, y }, s.side) };
      const list = outgoing.get(vertexKey(from));
      if (list) list.push(edge);
      else outgoing.set(vertexKey(from), [edge]);
    }
  }

  const loops: Point[][] = [];
  while (outgoing.size > 0) {
    const [startKey, startList] = outgoing.entries().next().value as [string, Edge[]];
    const edges: Edge[] = [];
    let edge = startList.pop()!;
    if (startList.length === 0) outgoing.delete(startKey);
    for (;;) {
      edges.push(edge);
      const k = vertexKey(edge.to);
      const list = outgoing.get(k);
      if (!list) break; // tornati al punto di partenza: l'anello è chiuso
      edge = list.pop()!;
      if (list.length === 0) outgoing.delete(k);
    }
    loops.push(loopPoints(edges));
  }
  return loops;
}

/** I punti di un anello: per ogni vertice, dove si incontrano il lato che arriva e quello che parte. */
function loopPoints(edges: Edge[]): Point[] {
  const px = (v: number) => v * CELL_SIZE;
  const points: Point[] = [];
  for (let i = 0; i < edges.length; i++) {
    const a = edges[i];
    const b = edges[(i + 1) % edges.length];
    const [vx, vy] = a.to;
    if (a.dir[0] === b.dir[0] && a.dir[1] === b.dir[1]) {
      // Stessa direzione: se i rientri sono diversi, scalino perpendicolare sul vertice.
      points.push([px(vx) + a.inward[0] * a.inset, px(vy) + a.inward[1] * a.inset]);
      if (a.inset !== b.inset) points.push([px(vx) + b.inward[0] * b.inset, px(vy) + b.inward[1] * b.inset]);
    } else {
      // Angolo retto: la retta del primo lato e quella del secondo si incrociano qui.
      points.push([
        px(vx) + a.inward[0] * a.inset + b.inward[0] * b.inset,
        px(vy) + a.inward[1] * a.inset + b.inward[1] * b.inset,
      ]);
    }
  }
  return points;
}
