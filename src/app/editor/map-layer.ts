import { Container } from 'pixi.js';
import { Board } from '../game/board/board';
import { Door, DoorSpan } from '../game/board/door';
import { DoorView } from '../game/doors/door-view';
import { SNAP_RADIUS_CELLS } from '../game/constants';
import { drawExitMarkers } from '../game/map/exit-markers';
import { PlacedTile } from '../game/map/map-data';
import { createMapView } from '../game/map/map-view';
import { findSnap, overlaps } from '../game/map/snap';
import { Rotation, TileDef, rotateTile, tileCells } from '../game/map/tile';
import { connectedOpenings } from '../game/map/walls';
import { theme } from '../game/theme';

interface Cell {
  x: number;
  y: number;
}

/**
 * Il livello della mappa dell'editor: disegna i tile piazzati e, finché se ne porta uno in mano, la sua anteprima che segue il puntatore. Di norma il tile si aggancia a
 * un'apertura libera compatibile (come i pezzi di un puzzle); senza aperture da agganciare (il primo tile) o con il piazzamento libero (Maiusc) sta sulla griglia, purché non si
 * sovrapponga a niente. Qui non c'è stato: chi lo usa gli dà i tile (`setTiles`) e quando `target()` restituisce un posto lo scrive nella mappa.
 */
export class EditorMapLayer {
  /** Tutto ciò che il livello disegna: i tile (e il pezzo in mano) in `holder`, e sopra le porte. */
  readonly container = new Container();
  private readonly holder = new Container();
  private readonly doorView = new DoorView();
  private board: Board | null = null;
  private doors: Door[] = [];
  /** Si sta portando una porta (che si piazza sul lato di cella più vicino al puntatore). */
  private carryDoor = false;
  private placed: PlacedTile[] = [];
  /** Il tile in mano, nella sua forma di base (non ruotato), e la rotazione di adesso. */
  private carry: TileDef | null = null;
  rotation: Rotation = 0;
  /** Avvisa quando la rotazione cambia da sola (auto-rotazione vicino a un aggancio). */
  onRotate?: (rotation: Rotation) => void;
  /** Vicino a un aggancio, se la rotazione di adesso non combacia si prova con le altre tre. */
  autoRotate = true;
  private hover: Cell | null = null;
  private free = false;

  constructor(private seed: number) {
    this.container.addChild(this.holder, this.doorView.container);
  }

  setTiles(placed: PlacedTile[]) {
    this.placed = placed;
    this.rebuildBoard();
    this.redraw();
  }

  /** Le porte della mappa. */
  setDoors(doors: Door[]) {
    this.doors = doors;
    this.rebuildBoard();
  }

  /** Il quadro dei muri e delle porte, da cui si sa dove può stare una porta (da muro a muro). */
  private rebuildBoard() {
    this.board = new Board(this.placed, this.doors);
    this.doorView.redraw(this.board);
    this.updateDoorPreview();
  }

  setCarryDoor(on: boolean) {
    this.carryDoor = on;
    this.updateDoorPreview();
  }

  /** Il lato di cella più vicino al puntatore su cui può stare una porta (con la porta, da muro a muro, che ci starebbe), o null. */
  private doorCandidate(at: Cell): { span: DoorSpan; unit: number; index: number } | null {
    if (!this.board) return null;
    const options = [
      { horizontal: true, line: Math.round(at.y), unit: Math.floor(at.x), dist: Math.abs(at.y - Math.round(at.y)) },
      { horizontal: false, line: Math.round(at.x), unit: Math.floor(at.y), dist: Math.abs(at.x - Math.round(at.x)) },
    ].sort((a, b) => a.dist - b.dist);
    for (const o of options) {
      const span = this.board.spanAt(o.horizontal, o.line, o.unit);
      if (span) return { span, unit: o.unit, index: this.board.doorIndexAt(o.horizontal, o.line, o.unit) };
    }
    return null;
  }

  /** Dove andrebbe la porta in mano adesso (un posto libero sotto il puntatore), o null. */
  doorTarget(): { x: number; y: number; horizontal: boolean } | null {
    if (!this.carryDoor || !this.hover) return null;
    const c = this.doorCandidate(this.hover);
    if (!c || c.index >= 0) return null;
    return { x: c.span.horizontal ? c.unit : c.span.line, y: c.span.horizontal ? c.span.line : c.unit, horizontal: c.span.horizontal };
  }

  private updateDoorPreview() {
    const c = this.carryDoor && this.hover && this.board ? this.doorCandidate(this.hover) : null;
    this.doorView.setPreview(c && c.index < 0 ? c.span : null, false, c && this.board ? this.board.hasJambPosts(c.span) : false);
  }

  /** Una porta ha ancora muri ai lati (da muro a muro)? Se un tile le viene tolto, no. */
  doorHasWalls(d: Door): boolean {
    return !!this.board?.spanAt(d.horizontal, d.horizontal ? d.y : d.x, d.horizontal ? d.x : d.y);
  }

  /** L'indice della porta il cui lato di cella sta entro `tolerance` celle da `at`, o -1. */
  doorIndexNear(at: Cell, tolerance: number): number {
    let best = -1;
    let bestDist = tolerance;
    this.doors.forEach((d, i) => {
      const px = d.horizontal ? Math.min(Math.max(at.x, d.x), d.x + 1) : d.x;
      const py = d.horizontal ? d.y : Math.min(Math.max(at.y, d.y), d.y + 1);
      const dist = Math.hypot(at.x - px, at.y - py);
      if (dist <= bestDist) {
        best = i;
        bestDist = dist;
      }
    });
    return best;
  }

  /** Il tile che si porta in mano (nella sua forma di base) e come è ruotato, o null. */
  setCarry(def: TileDef | null, rotation: Rotation = 0) {
    this.carry = def;
    this.rotation = rotation;
    this.redraw();
  }

  setRotation(rotation: Rotation) {
    this.rotation = rotation;
    this.redraw();
  }

  /** Il tile in mano con la rotazione di adesso. */
  private carried(): TileDef | null {
    return this.carry ? rotateTile(this.carry, this.rotation) : null;
  }

  /** Il puntatore, in celle (con la parte decimale), o null se non c'è. */
  setHover(cell: Cell | null) {
    this.hover = cell;
    this.updateDoorPreview();
    this.redraw();
  }

  /** Piazzamento libero (senza aggancio alle aperture). */
  setFree(free: boolean) {
    if (free === this.free) return;
    this.free = free;
    this.redraw();
  }

  /** Dove andrebbe il tile in mano adesso, o null se non si può metterlo (nessun aggancio vicino, o si sovrappone). */
  target(): PlacedTile | null {
    const def = this.carried();
    const at = this.hover;
    if (!def || !at) return null;
    if (!this.free && this.placed.length > 0) {
      const snap = findSnap(this.placed, def, at, SNAP_RADIUS_CELLS);
      if (snap || !this.autoRotate || !this.carry) return snap;
      // Nessun aggancio con questa rotazione: se un'altra combacia vicino al puntatore, il pezzo si gira da solo.
      for (const step of [90, 180, 270]) {
        const rot = ((this.rotation + step) % 360) as Rotation;
        const other = findSnap(this.placed, rotateTile(this.carry, rot), at, SNAP_RADIUS_CELLS);
        if (other) {
          this.rotation = rot;
          this.onRotate?.(rot);
          return other;
        }
      }
      return null;
    }
    const t: PlacedTile = { def, x: Math.round(at.x - def.size.w / 2), y: Math.round(at.y - def.size.h / 2) };
    return this.placed.some((p) => overlaps(t, p)) ? null : t;
  }

  /** L'indice del tile piazzato che copre la cella (quello più in alto se ce ne sono due), o -1. */
  tileIndexAt(cell: Cell): number {
    for (let i = this.placed.length - 1; i >= 0; i--) {
      const t = this.placed[i];
      if (tileCells(t.def).has(`${cell.x - t.x},${cell.y - t.y}`)) return i;
    }
    return -1;
  }

  /** Il triangolo giallo su ogni uscita dei tile piazzati che non si collega a nessun altro tile (una mappa finita le chiude tutte con i punti morti). */
  private drawOpenExits(all: PlacedTile[], skip?: PlacedTile) {
    for (const t of all) {
      if (t === skip) continue;
      this.holder.addChild(drawExitMarkers(t, connectedOpenings(all.filter((o) => o !== t), t), true));
    }
  }

  private redraw() {
    for (const child of this.holder.removeChildren()) child.destroy({ children: true });
    const target = this.target();
    if (target) {
      // Con il tile agganciato si vede la mappa com'è, con il nuovo pezzo evidenziato e le sue uscite (verdi dove si collegano).
      this.holder.addChild(createMapView(this.seed, [...this.placed, target], target));
      this.holder.addChild(drawExitMarkers(target, connectedOpenings(this.placed, target)));
      this.drawOpenExits([...this.placed, target], target);
      return;
    }
    if (this.placed.length) {
      this.holder.addChild(createMapView(this.seed, this.placed));
      this.drawOpenExits(this.placed);
    }
    if (this.carry && this.hover) {
      // Nessun posto valido: il tile segue il puntatore, trasparente.
      const def = this.carried()!;
      const ghostTile: PlacedTile = { def, x: Math.round(this.hover.x - def.size.w / 2), y: Math.round(this.hover.y - def.size.h / 2) };
      const ghost = createMapView(this.seed, [ghostTile]);
      ghost.alpha = theme.alpha.ghost;
      this.holder.addChild(ghost);
      this.holder.addChild(drawExitMarkers(ghostTile, def.openings.map(() => false)));
    }
  }
}
