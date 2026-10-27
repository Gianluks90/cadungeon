import { TileDef, tileCells, tileRects } from '../game/map/tile';

/** Il disegno semplificato di un tile per le anteprime: il pavimento e i muri come tratti, con le aperture lasciate vuote. */
export interface TilePreview {
  /** Dimensioni in celle (le stesse dell'`viewBox` diviso `cell`). */
  w: number;
  h: number;
  /** Il pavimento: i rettangoli del tile. */
  floor: { x: number; y: number; w: number; h: number }[];
  /** I muri come un unico percorso SVG (in unità di cella). */
  walls: string;
}

/** Calcola l'anteprima di un tile: ogni lato di cella che confina con il vuoto è un muro, tranne dove c'è un'apertura. */
export function tilePreview(def: TileDef): TilePreview {
  const cells = tileCells(def);
  const has = (x: number, y: number) => cells.has(`${x},${y}`);
  const { w, h } = def.size;
  // Un lato di cella sul bordo del tile cade in un'apertura se la sua posizione sta fra `offset` e `offset + width`.
  const inOpening = (side: 'N' | 'E' | 'S' | 'W', pos: number) => def.openings.some((o) => o.side === side && pos >= o.offset && pos < o.offset + o.width);
  const segs: string[] = [];
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    if (!has(x, y - 1) && !(y === 0 && inOpening('N', x))) segs.push(`M${x} ${y}h1`);
    if (!has(x, y + 1) && !(y === h - 1 && inOpening('S', x))) segs.push(`M${x} ${y + 1}h1`);
    if (!has(x - 1, y) && !(x === 0 && inOpening('W', y))) segs.push(`M${x} ${y}v1`);
    if (!has(x + 1, y) && !(x === w - 1 && inOpening('E', y))) segs.push(`M${x + 1} ${y}v1`);
  }
  return { w, h, floor: tileRects(def), walls: segs.join('') };
}
