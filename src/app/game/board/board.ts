import { DOOR_MAX_LENGTH_CELLS } from '../constants';
import { PlacedTile } from '../map/map-data';
import { Door, DoorSpan, ResolvedDoor } from './door';
import { tileCells } from '../map/tile';
import { Passage, buildWalls } from '../map/walls';

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

  private readonly passages: Passage[] = [];
  private readonly doorList: ResolvedDoor[] = [];
  private readonly doorEdges = new Map<string, ResolvedDoor>();

  constructor(placed: PlacedTile[], doors: Door[] = []) {
    for (const t of placed) {
      for (const c of tileCells(t.def)) {
        const [cx, cy] = c.split(',').map(Number);
        this.cells.add(`${t.x + cx},${t.y + cy}`);
      }
    }
    const { walls, passages } = buildWalls(placed);
    this.passages = passages;
    for (const s of walls) {
      if (s.y1 === s.y2) for (let x = s.x1; x < s.x2; x++) this.blocked.add(`h|${x}|${s.y1}`);
      else for (let y = s.y1; y < s.y2; y++) this.blocked.add(`v|${s.x1}|${y}`);
    }

    // Le porte: ognuna copre il tratto di linea fra due muri che contiene il suo lato di cella.
    for (const door of doors) {
      const line = door.horizontal ? door.y : door.x;
      const span = this.spanAt(door.horizontal, line, door.horizontal ? door.x : door.y);
      if (!span) {
        console.warn('Porta fuori posto, ignorata', door);
        continue;
      }
      const resolved = { ...span, door };
      this.doorList.push(resolved);
      for (let u = span.from; u < span.to; u++) this.doorEdges.set(this.edgeKey(span.horizontal, line, u), resolved);
    }
  }

  private edgeKey(horizontal: boolean, line: number, unit: number): string {
    return horizontal ? `h|${unit}|${line}` : `v|${line}|${unit}`;
  }

  /** La porta sta su un varco, quindi ai suoi lati ci sono gli stipiti (i blocchi che sporgono)? */
  hasJambPosts(d: DoorSpan): boolean {
    return this.passages.some(
      (p) => p.posts && p.horizontal === d.horizontal && p.line === d.line && p.from === d.from && p.to === d.to,
    );
  }

  /** Le porte della mappa, con la posizione calcolata. */
  get doors(): readonly ResolvedDoor[] {
    return this.doorList;
  }

  /** Si può attraversare questo lato di cella? Serve che ci siano due caselle e nessun muro (le porte non contano). */
  private crossable(horizontal: boolean, line: number, unit: number): boolean {
    const a = horizontal ? { x: unit, y: line - 1 } : { x: line - 1, y: unit };
    const b = horizontal ? { x: unit, y: line } : { x: line, y: unit };
    return this.isWalkable(a) && this.isWalkable(b) && !this.blocked.has(this.edgeKey(horizontal, line, unit));
  }

  /**
   * Il tratto di linea, da muro a muro, in cui può stare una porta che contiene il lato di cella `unit`.
   * Null se lì non si può mettere una porta: è già un muro, è fuori dai tile, oppure il tratto da muro
   * a muro è più lungo di DOOR_MAX_LENGTH_CELLS (non una porta, ma una stanza intera).
   */
  spanAt(horizontal: boolean, line: number, unit: number): DoorSpan | null {
    if (!this.crossable(horizontal, line, unit)) return null;
    let from = unit;
    while (this.crossable(horizontal, line, from - 1)) from--;
    let to = unit + 1;
    while (this.crossable(horizontal, line, to)) to++;
    return to - from <= DOOR_MAX_LENGTH_CELLS ? { horizontal, line, from, to } : null;
  }

  /** L'indice della porta che copre quel lato di cella, o -1. */
  doorIndexAt(horizontal: boolean, line: number, unit: number): number {
    const d = this.doorEdges.get(this.edgeKey(horizontal, line, unit));
    return d ? this.doorList.indexOf(d) : -1;
  }

  /** La porta vicina al punto `p` (in celle, con decimali), entro `tolerance` celle dalla linea. -1 se nessuna. */
  doorNear(p: Cell, tolerance: number): number {
    return this.doorList.findIndex((d) => {
      const across = d.horizontal ? p.y : p.x;
      const along = d.horizontal ? p.x : p.y;
      return Math.abs(across - d.line) <= tolerance && along >= d.from && along <= d.to;
    });
  }

  /** La casella tocca la porta, anche in diagonale? Serve per aprirla o chiuderla. */
  isAdjacentToDoor(c: Cell, index: number): boolean {
    const d = this.doorList[index];
    const across = d.horizontal ? c.y : c.x;
    const along = d.horizontal ? c.x : c.y;
    return (across === d.line - 1 || across === d.line) && along >= d.from - 1 && along <= d.to;
  }

  toggleDoor(index: number) {
    const d = this.doorList[index].door;
    d.open = !d.open;
  }

  isWalkable(c: Cell): boolean {
    return this.cells.has(cellKey(c));
  }

  /** Passo verso una casella vicina in orizzontale o verticale: serve che esista e che non ci sia un muro in mezzo. */
  private canStepStraight(a: Cell, b: Cell): boolean {
    if (!this.isWalkable(b)) return false;
    const wall =
      b.x > a.x ? `v|${a.x + 1}|${a.y}` : b.x < a.x ? `v|${a.x}|${a.y}` : b.y > a.y ? `h|${a.x}|${a.y + 1}` : `h|${a.x}|${a.y}`;
    if (this.blocked.has(wall)) return false;
    const door = this.doorEdges.get(wall);
    return !door || door.door.open; // una porta chiusa blocca come un muro
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
