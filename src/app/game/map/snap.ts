import { PlacedTile } from './map-data';
import { Side, TileDef, tileRects } from './tile';
import { OPPOSITE, freeOpenings } from './walls';

interface Point {
  x: number;
  y: number;
}

/** Due tile si sovrappongono se un rettangolo dell'uno e uno dell'altro hanno celle in comune. */
export function overlaps(a: PlacedTile, b: PlacedTile): boolean {
  return tileRects(a.def).some((ra) =>
    tileRects(b.def).some(
      (rb) =>
        a.x + ra.x < b.x + rb.x + rb.w &&
        a.x + ra.x + ra.w > b.x + rb.x &&
        a.y + ra.y < b.y + rb.y + rb.h &&
        a.y + ra.y + ra.h > b.y + rb.y,
    ),
  );
}

/** Dove va l'angolo in alto a sinistra del nuovo tile, perché la sua apertura combaci con `span`. */
export function positionFor(side: Side, line: number, from: number, def: TileDef, offset: number): Point {
  const { w, h } = def.size;
  switch (side) {
    case 'N': return { x: from - offset, y: line - h }; // il nuovo tile sta sopra
    case 'S': return { x: from - offset, y: line };
    case 'W': return { x: line - w, y: from - offset }; // il nuovo tile sta a sinistra
    case 'E': return { x: line, y: from - offset };
  }
}

/**
 * Cerca dove agganciare `def` (già ruotato). Un aggancio è valido se un'apertura libera della mappa
 * si guarda con un'apertura del tile, sul lato opposto e con la stessa larghezza, e il tile non si
 * sovrappone a quelli già piazzati. Tra i possibili sceglie quello con il centro più vicino a `pointer`
 * (in celle), purché entro `radius`.
 */
export function findSnap(placed: PlacedTile[], def: TileDef, pointer: Point, radius: number): PlacedTile | null {
  let best: PlacedTile | null = null;
  let bestDist = radius;

  for (const free of freeOpenings(placed)) {
    for (const opening of def.openings) {
      if (opening.side !== OPPOSITE[free.side] || opening.width !== free.to - free.from) continue;
      const pos = positionFor(free.side, free.line, free.from, def, opening.offset);
      const candidate: PlacedTile = { def, x: pos.x, y: pos.y };
      if (placed.some((t) => overlaps(candidate, t))) continue;

      const dist = Math.hypot(pos.x + def.size.w / 2 - pointer.x, pos.y + def.size.h / 2 - pointer.y);
      if (dist <= bestDist) {
        best = candidate;
        bestDist = dist;
      }
    }
  }
  return best;
}
