import { DOOR_MAX_LENGTH_CELLS } from '../constants';
import { PlacedTile } from '../map/map-data';
import { Door, DoorSpan, ResolvedDoor } from './door';
import { Marker, Stairs } from './marker';
import { Obstacle, obstacleCells } from './obstacle';
import { tileCells } from '../map/tile';
import { Passage, buildWalls } from '../map/walls';
import { stairsWalls } from '../markers/stairs-walls';
import type { WallSegment } from '../map/walls';
import { Wall, edgeCells, wallEdges, wallSegment, wallTouchesSpan } from './wall';

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
  /** L'area di ogni cella (solo i tile che ne hanno una). */
  private readonly areaByCell = new Map<string, string>();
  /** Lati di cella con un muro: "h|x|y" è la linea orizzontale y fra x e x+1, "v|x|y" quella verticale x. */
  private readonly blocked = new Set<string>();
  /** I lati dei muri dell'avventura: bloccano movimento e vista, ma non entrano in `blocked` perché non dividono le stanze (aree e regioni li ignorano). */
  private readonly authorEdges = new Set<string>();
  private readonly wallList: Wall[] = [];

  private readonly passages: Passage[] = [];
  private readonly markerList: Marker[] = [];
  private readonly markerByCell = new Map<string, Marker>();
  /** Per ogni scala, il capo opposto della sua scalinata (solo per le coppie complete). */
  private readonly stairsPartners = new Map<string, Stairs>();
  private readonly obstacleList: Obstacle[] = [];
  private readonly obstacleByCell = new Map<string, Obstacle>();
  private readonly doorList: ResolvedDoor[] = [];
  private readonly doorEdges = new Map<string, ResolvedDoor>();

  constructor(placed: PlacedTile[], doors: Door[] = [], obstacles: Obstacle[] = [], markers: Marker[] = [], authorWalls: readonly Wall[] = []) {
    for (const t of placed) {
      for (const c of tileCells(t.def)) {
        const [cx, cy] = c.split(',').map(Number);
        this.cells.add(`${t.x + cx},${t.y + cy}`);
        const area = t.areaCells?.get(`${t.x + cx},${t.y + cy}`) ?? t.area;
        if (area) this.areaByCell.set(`${t.x + cx},${t.y + cy}`, area);
      }
    }
    const { walls, passages } = buildWalls(placed);
    this.passages = passages;
    for (const s of walls) {
      if (s.y1 === s.y2) for (let x = s.x1; x < s.x2; x++) this.blocked.add(`h|${x}|${s.y1}`);
      else for (let y = s.y1; y < s.y2; y++) this.blocked.add(`v|${s.x1}|${y}`);
    }

    // Gli ostacoli: devono stare tutti su caselle dei tile e non sovrapporsi.
    for (const o of obstacles) {
      if (!this.canPlaceObstacle(o)) {
        console.warn('Ostacolo fuori posto, ignorato', o);
        continue;
      }
      this.obstacleList.push(o);
      for (const c of obstacleCells(o)) this.obstacleByCell.set(cellKey(c), o);
    }

    // I segnalini: su una casella dei tile, senza ostacoli e uno solo per casella.
    for (const m of markers) {
      if ('collected' in m && m.collected) continue; // già raccolto in una partita precedente
      const c = { x: m.x, y: m.y };
      if (!this.isWalkable(c) || this.obstacleByCell.has(cellKey(c)) || this.markerByCell.has(cellKey(c))) {
        console.warn('Segnalino fuori posto, ignorato', m);
        continue;
      }
      this.markerList.push(m);
      this.markerByCell.set(cellKey(c), m);
    }

    // Le scale: due con la stessa etichetta formano una scalinata; una sola, o più di due, non collega niente.
    const byLink = new Map<string, Stairs[]>();
    for (const m of this.markerList) if (m.type === 'stairs') byLink.set(m.link, [...(byLink.get(m.link) ?? []), m]);
    for (const [link, ends] of byLink) {
      if (ends.length !== 2) {
        console.warn(`Scale "${link}": servono esattamente due capi, ce ne sono ${ends.length}`);
        continue;
      }
      this.stairsPartners.set(cellKey(ends[0]), ends[1]);
      this.stairsPartners.set(cellKey(ends[1]), ends[0]);
    }

    // I tre lati chiusi di ogni scala sono muri: bloccano movimento e vista come gli altri.
    for (const s of stairsWalls(this.markerList.filter((m): m is Stairs => m.type === 'stairs'))) {
      if (s.y1 === s.y2) this.blocked.add(`h|${s.x1}|${s.y1}`);
      else this.blocked.add(`v|${s.x1}|${s.y1}`);
    }

    // I muri dell'avventura: ogni lato deve stare fra due caselle di tile e non su un muro che c'è già; un muro che non ci sta si scarta intero.
    for (const w of authorWalls) {
      const edges = wallEdges(w);
      const ok = edges.length > 0 && edges.every((e) => !this.blocked.has(e) && !this.authorEdges.has(e) && edgeCells(e).every((c) => this.isWalkable(c)));
      if (!ok) {
        console.warn('Muro fuori posto, ignorato', w);
        continue;
      }
      this.wallList.push({ ...w });
      for (const e of edges) this.authorEdges.add(e);
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

  /** I segnalini della mappa. */
  get markers(): readonly Marker[] {
    return this.markerList;
  }

  /** L'altro capo della scalinata che parte da questa casella, se c'è una scala qui e la coppia è completa. */
  stairsPartnerAt(c: Cell): Stairs | undefined {
    return this.stairsPartners.get(cellKey(c));
  }

  /** Dove porta ogni scala: da casella (chiave) all'altro capo. Serve al calcolo del movimento. */
  stairsLinks(): ReadonlyMap<string, Cell> {
    return this.stairsPartners;
  }

  /** Un oggetto è stato raccolto: non c'è più sulla mappa. */
  removeMarker(m: Marker) {
    const i = this.markerList.indexOf(m);
    if (i >= 0) this.markerList.splice(i, 1);
    this.markerByCell.delete(cellKey({ x: m.x, y: m.y }));
  }

  /** L'area a cui appartiene la casella (undefined se il tile non ne ha una). */
  areaAt(c: Cell): string | undefined {
    return this.areaByCell.get(cellKey(c));
  }

  markerAt(c: Cell): Marker | undefined {
    return this.markerByCell.get(cellKey(c));
  }

  /** Tutte le caselle dei tile. */
  walkableCells(): Cell[] {
    return [...this.cells].map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    });
  }

  /**
   * Il lato di cella blocca la vista? "h|x|y" è la linea orizzontale y fra x e x+1, "v|x|y" la verticale x fra y e y+1.
   * Bloccano i muri e le porte chiuse; una porta aperta no.
   */
  blocksSightAt(edge: string): boolean {
    if (this.blocked.has(edge) || this.authorEdges.has(edge)) return true;
    const door = this.doorEdges.get(edge);
    return !!door && !door.door.open;
  }

  /** Le caselle da una parte e dall'altra del tratto di linea di una porta. Servono per sapere se la porta è stata vista. */
  doorSideCells(d: ResolvedDoor): Cell[] {
    const out: Cell[] = [];
    for (let u = d.from; u < d.to; u++) {
      out.push(d.horizontal ? { x: u, y: d.line - 1 } : { x: d.line - 1, y: u });
      out.push(d.horizontal ? { x: u, y: d.line } : { x: d.line, y: u });
    }
    return out;
  }

  /** Gli ostacoli della mappa. */
  get obstacles(): readonly Obstacle[] {
    return this.obstacleList;
  }

  obstacleAt(c: Cell): Obstacle | undefined {
    return this.obstacleByCell.get(cellKey(c));
  }

  /** Roccia e acqua bloccano il movimento: non ci si entra. (Non bloccano le diagonali accanto a loro.) */
  blocksMovement(c: Cell): boolean {
    const t = this.obstacleAt(c)?.type;
    return t === 'rock' || t === 'water';
  }

  /** Il masso blocca anche la vista (l'acqua e la buca no). */
  blocksSight(c: Cell): boolean {
    return this.obstacleAt(c)?.type === 'rock';
  }

  isPit(c: Cell): boolean {
    return this.obstacleAt(c)?.type === 'pit';
  }

  /**
   * Tutte le caselle della buca che contiene `c` (vuoto se `c` non è in una buca). Buche in caselle vicine
   * formano un'unica buca, anche se sono state piazzate come ostacoli separati.
   */
  pitCells(c: Cell): Cell[] {
    if (!this.isPit(c)) return [];
    const found = new Map<string, Cell>([[cellKey(c), c]]);
    const queue = [c];
    while (queue.length) {
      const cur = queue.pop()!;
      for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
        const n = { x: cur.x + d.x, y: cur.y + d.y };
        // Le buche vicine sono una sola buca per le regole, tranne quelle separate dall'editor (`alone`).
        if (this.isPit(n) && !found.has(cellKey(n)) && !this.obstacleByCell.get(cellKey(n))?.alone && !this.obstacleByCell.get(cellKey(cur))?.alone) {
          found.set(cellKey(n), n);
          queue.push(n);
        }
      }
    }
    return [...found.values()];
  }

  /** L'ostacolo sta su caselle dei tile e non si sovrappone a un altro ostacolo? */
  canPlaceObstacle(o: Obstacle): boolean {
    return obstacleCells(o).every((c) => this.isWalkable(c) && !this.obstacleByCell.has(cellKey(c)));
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

  /** I muri dell'avventura che stanno al loro posto (quelli scartati non ci sono). */
  get walls(): readonly Wall[] {
    return this.wallList;
  }

  /** Il segmento di ogni muro dell'avventura, per disegnarli con quelli dei tile. */
  wallSegments(): WallSegment[] {
    return this.wallList.map(wallSegment);
  }

  /** Le porte della mappa, con la posizione calcolata. */
  get doors(): readonly ResolvedDoor[] {
    return this.doorList;
  }

  /** Le caselle collegate a `c` senza passare né per un muro né per una porta (aperta o chiusa): una stanza, o un tratto di corridoio fino alla porta. Vuoto se `c` non è su un tile. */
  regionAt(c: Cell): Cell[] {
    if (!this.isWalkable(c)) return [];
    const found = new Map<string, Cell>([[cellKey(c), c]]);
    const queue = [c];
    while (queue.length) {
      const cur = queue.pop()!;
      for (const n of [{ x: cur.x + 1, y: cur.y }, { x: cur.x - 1, y: cur.y }, { x: cur.x, y: cur.y + 1 }, { x: cur.x, y: cur.y - 1 }]) {
        if (found.has(cellKey(n)) || !this.passable(cur, n) || this.doorBetween(cur, n)) continue;
        found.set(cellKey(n), n);
        queue.push(n);
      }
    }
    return [...found.values()];
  }

  /** Fra due caselle vicine non c'è un muro (una porta in mezzo non conta)? */
  passable(a: Cell, b: Cell): boolean {
    if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) return false;
    const horizontal = a.x === b.x;
    return this.crossable(horizontal, horizontal ? Math.max(a.y, b.y) : Math.max(a.x, b.x), horizontal ? a.x : a.y);
  }

  /** Fra due caselle vicine c'è una porta? */
  doorBetween(a: Cell, b: Cell): boolean {
    const horizontal = a.x === b.x;
    return this.doorIndexAt(horizontal, horizontal ? Math.max(a.y, b.y) : Math.max(a.x, b.x), horizontal ? a.x : a.y) >= 0;
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
    const open = (u: number) => this.crossable(horizontal, line, u) && !this.authorEdges.has(this.edgeKey(horizontal, line, u)); // un muro dell'autore chiude il tratto
    if (!open(unit)) return null;
    let from = unit;
    while (open(from - 1)) from--;
    let to = unit + 1;
    while (open(to)) to++;
    if (to - from > DOOR_MAX_LENGTH_CELLS) return null;
    const span = { horizontal, line, from, to };
    return this.wallList.some((w) => wallTouchesSpan(w, span)) ? null : span; // una porta non va dove un muro dell'autore la attraversa o la tocca
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

  /** Apre o chiude la porta. Aprendola da `from`, l'anta si apre davanti a chi la apre (solo disegno). */
  toggleDoor(index: number, from?: Cell) {
    const span = this.doorList[index];
    const d = span.door;
    if (!d.open && from) d.swing = (span.horizontal ? from.y : from.x) < span.line ? 1 : -1;
    d.open = !d.open;
  }

  isWalkable(c: Cell): boolean {
    return this.cells.has(cellKey(c));
  }

  /** Il rettangolo che contiene tutte le caselle dei tile, in celle (`x1` e `y1` sono oltre l'ultima), o null se non ce ne sono. */
  cellBounds(): { x0: number; y0: number; x1: number; y1: number } | null {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const k of this.cells) {
      const [x, y] = k.split(',').map(Number);
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x + 1);
      y1 = Math.max(y1, y + 1);
    }
    return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
  }

  /** Passo verso una casella vicina in orizzontale o verticale: serve che esista e che non ci sia un muro in mezzo. */
  private canStepStraight(a: Cell, b: Cell, ignoreDoors = false): boolean {
    if (!this.isWalkable(b)) return false;
    const wall = this.edgeBetween(a, b);
    if (this.blocked.has(wall) || this.authorEdges.has(wall)) return false;
    const door = this.doorEdges.get(wall);
    return ignoreDoors || !door || door.door.open; // una porta chiusa blocca come un muro
  }

  /** Il lato di cella (chiave dei muri) fra due caselle vicine in orizzontale o in verticale. */
  private edgeBetween(a: Cell, b: Cell): string {
    return b.x > a.x ? `v|${a.x + 1}|${a.y}` : b.x < a.x ? `v|${a.x}|${a.y}` : b.y > a.y ? `h|${a.x}|${a.y + 1}` : `h|${a.x}|${a.y}`;
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
  canStep(a: Cell, b: Cell, ignoreDoors = false): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || (dx === 0 && dy === 0)) return false;
    if (dx === 0 || dy === 0) return this.canStepStraight(a, b, ignoreDoors);

    const viaX = { x: a.x + dx, y: a.y };
    const viaY = { x: a.x, y: a.y + dy };
    return (
      this.canStepStraight(a, viaX, ignoreDoors) && this.canStepStraight(viaX, b, ignoreDoors) &&
      this.canStepStraight(a, viaY, ignoreDoors) && this.canStepStraight(viaY, b, ignoreDoors)
    );
  }

  /** Le porte chiuse che un passo da `a` a `b` attraversa (da aprire prima di passare). Vuoto se non ce ne sono. */
  doorsCrossed(a: Cell, b: Cell): ResolvedDoor[] {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const edges = dx === 0 || dy === 0
      ? [this.edgeBetween(a, b)]
      : [this.edgeBetween(a, { x: a.x + dx, y: a.y }), this.edgeBetween({ x: a.x + dx, y: a.y }, b), this.edgeBetween(a, { x: a.x, y: a.y + dy }), this.edgeBetween({ x: a.x, y: a.y + dy }, b)];
    const found = new Set<ResolvedDoor>();
    for (const e of edges) {
      const d = this.doorEdges.get(e);
      if (d && !d.door.open) found.add(d);
    }
    return [...found];
  }
}
