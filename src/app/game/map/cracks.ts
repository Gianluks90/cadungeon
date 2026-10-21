import { CELL_SIZE } from '../constants';

/** Una frattura: sequenza di punti x0, y0, x1, y1, ... in pixel, relativi all'angolo della cella. */
export type Polyline = number[];

/** Quali bordi della cella sono interni al tile (true) e quali sono sul contorno, dove c'è il muro. */
export interface CellEdges {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
}

/** Le fratture restano a questa distanza dal contorno del tile, per non finire sotto i muri. */
const WALL_MARGIN = 10;

/**
 * Una frattura naturale: parte da un bordo della lastra e avanza con una direzione che cambia
 * poco per volta, a tratti irregolari. A volte si biforca con un ramo più corto.
 * Si ferma quando arriva al limite della lastra.
 */
export function makeCracks(rng: () => number, edges: CellEdges): Polyline[] {
  const lox = edges.w ? 0 : WALL_MARGIN;
  const hix = edges.e ? CELL_SIZE : CELL_SIZE - WALL_MARGIN;
  const loy = edges.n ? 0 : WALL_MARGIN;
  const hiy = edges.s ? CELL_SIZE : CELL_SIZE - WALL_MARGIN;

  // Punti di partenza possibili: i bordi interni, con la direzione verso l'interno della lastra.
  const starts: { x: number; y: number; heading: number }[] = [];
  const along = (lo: number, hi: number) => lo + (0.15 + rng() * 0.7) * (hi - lo);
  if (edges.n) starts.push({ x: along(lox, hix), y: 0, heading: Math.PI / 2 });
  if (edges.s) starts.push({ x: along(lox, hix), y: CELL_SIZE, heading: -Math.PI / 2 });
  if (edges.w) starts.push({ x: 0, y: along(loy, hiy), heading: 0 });
  if (edges.e) starts.push({ x: CELL_SIZE, y: along(loy, hiy), heading: Math.PI });

  const start = starts.length
    ? starts[Math.floor(rng() * starts.length)]
    : { x: along(lox, hix), y: along(loy, hiy), heading: rng() * Math.PI * 2 }; // nasce in mezzo alla lastra
  const heading = start.heading + (rng() - 0.5) * 0.8;

  const result: Polyline[] = [];
  const walk = (x0: number, y0: number, h0: number, length: number, canBranch: boolean) => {
    const line: Polyline = [x0, y0];
    let x = x0;
    let y = y0;
    let h = h0;
    let travelled = 0;
    let branched = !canBranch;
    while (travelled < length) {
      const step = 4 + rng() * 5;
      h += (rng() + rng() - 1) * 0.6; // la direzione cambia poco per volta
      x += Math.cos(h) * step;
      y += Math.sin(h) * step;
      travelled += step;
      if (x < lox || x > hix || y < loy || y > hiy) {
        line.push(Math.min(hix, Math.max(lox, x)), Math.min(hiy, Math.max(loy, y)));
        break;
      }
      line.push(x, y);
      if (!branched && travelled > 14 && rng() < 0.16) {
        branched = true;
        const side = rng() < 0.5 ? -1 : 1;
        walk(x, y, h + side * (0.6 + rng() * 0.6), (length - travelled) * 0.6 + 8, false);
      }
    }
    if (line.length >= 4) result.push(line);
  };

  walk(start.x, start.y, heading, 34 + rng() * 60, true);
  return result;
}
