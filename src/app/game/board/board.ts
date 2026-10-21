import { PlacedTile } from '../map/map-data';
import { tileCells } from '../map/tile';
import { buildWalls } from '../map/walls';

/** Una casella della mappa, in celle. */
export interface Cell {
  x: number;
  y: number;
}

export const cellKey = (c: Cell) => `${c.x},${c.y}`;

/**
 * Le regole di "dove si può andare": quali caselle esistono e quali passi sono bloccati dai muri.
 * Non sa nulla di disegno: servirà anche all'host, che ha lo stato autoritativo.
 */
export class Board {
  private readonly cells = new Set<string>();
  /** Lati di cella con un muro: "h|x|y" è la linea orizzontale y fra x e x+1, "v|x|y" quella verticale x. */
  private readonly blocked = new Set<string>();

  constructor(placed: PlacedTile[]) {
    for (const t of placed) {
      for (const c of tileCells(t.def)) {
        const [cx, cy] = c.split(',').map(Number);
        this.cells.add(`${t.x + cx},${t.y + cy}`);
      }
    }
    for (const s of buildWalls(placed).walls) {
      if (s.y1 === s.y2) for (let x = s.x1; x < s.x2; x++) this.blocked.add(`h|${x}|${s.y1}`);
      else for (let y = s.y1; y < s.y2; y++) this.blocked.add(`v|${s.x1}|${y}`);
    }
  }

  isWalkable(c: Cell): boolean {
    return this.cells.has(cellKey(c));
  }

  /** Passo verso una casella vicina in orizzontale o verticale: serve che esista e che non ci sia un muro in mezzo. */
  private canStepStraight(a: Cell, b: Cell): boolean {
    if (!this.isWalkable(b)) return false;
    const wall =
      b.x > a.x ? `v|${a.x + 1}|${a.y}` : b.x < a.x ? `v|${a.x}|${a.y}` : b.y > a.y ? `h|${a.x}|${a.y + 1}` : `h|${a.x}|${a.y}`;
    return !this.blocked.has(wall);
  }

  /** C'è un muro (o niente, cioè fuori dal tile) sul lato `side` della casella `c`? */
  isWallSide(c: Cell, side: 'N' | 'E' | 'S' | 'W'): boolean {
    const next = { N: { x: c.x, y: c.y - 1 }, E: { x: c.x + 1, y: c.y }, S: { x: c.x, y: c.y + 1 }, W: { x: c.x - 1, y: c.y } }[side];
    return !this.canStepStraight(c, next);
  }

  /**
   * Si può passare da `a` alla casella vicina `b` (anche in diagonale)?
   * In diagonale non si taglia l'angolo di un muro: servono liberi entrambi i giri intorno.
   */
  canStep(a: Cell, b: Cell): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || (dx === 0 && dy === 0)) return false;
    if (dx === 0 || dy === 0) return this.canStepStraight(a, b);

    const viaX = { x: a.x + dx, y: a.y };
    const viaY = { x: a.x, y: a.y + dy };
    return (
      this.canStepStraight(a, viaX) && this.canStepStraight(viaX, b) &&
      this.canStepStraight(a, viaY) && this.canStepStraight(viaY, b)
    );
  }
}
