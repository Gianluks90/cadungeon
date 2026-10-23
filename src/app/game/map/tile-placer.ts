import { Container } from 'pixi.js';
import { SNAP_RADIUS_CELLS } from '../constants';
import { theme } from '../theme';
import { PlacedTile } from './map-data';
import { drawExitMarkers } from './exit-markers';
import { createMapView } from './map-view';
import { findSnap } from './snap';
import { Rotation, TileDef, rotateTile } from './tile';
import { WallSegment, connectedOpenings } from './walls';

interface Cell {
  x: number;
  y: number;
}

/**
 * Strumento di sviluppo (non è l'editor): un tile segue il puntatore e, vicino a un'apertura
 * compatibile, si aggancia. Disegna tutta la mappa nel livello che gli viene dato.
 */
export class TilePlacer {
  private index = 0;
  private rotation: Rotation = 0;
  private hover: Cell | null = null;
  private drawnKey = '';
  /** Caselle senza crepe (quelle dei glifi). */
  private noCracks: ReadonlySet<string> = new Set();
  /** Muri in più da disegnare con gli altri (i lati chiusi delle scale già scoperte). */
  private extraWalls: readonly WallSegment[] = [];
  private readonly initialCount: number;

  constructor(
    private readonly seed: number,
    private readonly placed: PlacedTile[],
    private readonly defs: TileDef[],
    private readonly layer: Container,
  ) {
    this.initialCount = placed.length;
    this.redraw();
  }

  /** Quali caselle restano senza crepe né altri dettagli; ridisegna la mappa. */
  setNoCrackCells(cells: ReadonlySet<string>) {
    this.noCracks = cells;
    this.refresh();
  }

  /** Quali muri in più disegnare (i lati chiusi delle scale scoperte); ridisegna la mappa. */
  setExtraWalls(walls: readonly WallSegment[]) {
    this.extraWalls = walls;
    this.refresh();
  }

  /** Il tema è cambiato: ridisegna la mappa con i colori nuovi. */
  refresh() {
    this.drawnKey = '';
    this.redraw();
  }

  /** Posizione del puntatore in celle, o null se non c'è. */
  setHover(cell: Cell | null) {
    this.hover = cell;
    this.redraw();
  }

  rotate() {
    this.rotation = ((this.rotation + 90) % 360) as Rotation;
    this.redraw();
  }

  nextTile() {
    this.index = (this.index + 1) % this.defs.length;
    this.redraw();
  }

  /** Piazza il tile se è agganciato. Restituisce true se l'ha piazzato. */
  place(): boolean {
    const snap = this.currentSnap();
    if (!snap) return false;
    this.placed.push(snap);
    this.redraw();
    return true;
  }

  /** Toglie l'ultimo tile piazzato (quelli della mappa originale restano). */
  undo() {
    if (this.placed.length > this.initialCount) {
      this.placed.pop();
      this.redraw();
    }
  }

  private currentDef(): TileDef {
    return rotateTile(this.defs[this.index], this.rotation);
  }

  private currentSnap(): PlacedTile | null {
    return this.hover ? findSnap(this.placed, this.currentDef(), this.hover, SNAP_RADIUS_CELLS) : null;
  }

  private redraw() {
    const def = this.currentDef();
    const snap = this.currentSnap();
    // Senza aggancio il tile segue il puntatore, allineato alle celle.
    const free: PlacedTile | null =
      !snap && this.hover
        ? { def, x: Math.round(this.hover.x - def.size.w / 2), y: Math.round(this.hover.y - def.size.h / 2) }
        : null;

    const key = `${this.placed.length}|${this.index}|${this.rotation}|${snap ? `s${snap.x},${snap.y}` : free ? `f${free.x},${free.y}` : '-'}`;
    if (key === this.drawnKey) return;
    this.drawnKey = key;

    for (const child of this.layer.removeChildren()) child.destroy({ children: true });
    if (snap) {
      // Mostra la mappa com'è con il tile agganciato, evidenziato.
      this.layer.addChild(createMapView(this.seed, [...this.placed, snap], snap, this.noCracks, this.extraWalls));
      this.layer.addChild(drawExitMarkers(snap, connectedOpenings(this.placed, snap)));
    } else {
      this.layer.addChild(createMapView(this.seed, this.placed, undefined, this.noCracks, this.extraWalls));
      if (free) {
        const ghost = createMapView(this.seed, [free]);
        ghost.alpha = theme.alpha.ghost;
        this.layer.addChild(ghost);
        this.layer.addChild(drawExitMarkers(free, free.def.openings.map(() => false)));
      }
    }
  }
}
