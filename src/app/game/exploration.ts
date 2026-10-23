import { Board, Cell, cellKey } from './board/board';
import { Door } from './board/door';
import { Marker } from './board/marker';
import { Obstacle, obstacleCells } from './board/obstacle';
import { visibleCells } from './board/sight';
import { Piece } from './pieces/piece';

/** Ciò che si è appena scoperto. */
export interface Reveal {
  cells: Cell[];
  obstacles: Obstacle[];
  doors: Door[];
  markers: Marker[];
  monsters: Piece[];
}

/**
 * Cosa il gruppo degli eroi ha visto, come se ne avessero preso nota. Vale per tutti gli eroi insieme.
 * - Le caselle viste restano "esplorate" per sempre, anche se poi ci si allontana.
 * - Rocce, buche, acqua, porte e segnalini (glifi) si rivelano quando si vede una delle loro caselle, e restano rivelati.
 * - I mostri si rivelano quando si vede la casella in cui stanno, e restano rivelati: da quel momento si
 *   vedono sempre, come le miniature sul tavolo. Gli eroi si vedono sempre.
 *
 * Questo è lo stato dell'host: il contenuto delle aree non rivelate non va mandato agli altri giocatori.
 */
export class Exploration {
  readonly cells = new Set<string>();
  readonly obstacles = new Set<Obstacle>();
  readonly doors = new Set<Door>();
  readonly markers = new Set<Marker>();
  readonly monsters = new Set<string>();

  /** Ricalcola cosa vedono tutti gli eroi dalle loro caselle e annota ciò che si scopre. */
  update(board: Board, pieces: readonly Piece[]): Reveal {
    const everyone = pieces.map((p) => cellKey(p.cell));
    const visibleNow = new Set<string>();
    for (const hero of pieces.filter((p) => p.team === 'hero')) {
      // Le altre creature bloccano la vista (anche i compagni), non quella da cui si guarda.
      const blockers = new Set(everyone);
      blockers.delete(cellKey(hero.cell));
      for (const k of visibleCells(board, hero.cell, blockers)) visibleNow.add(k);
    }

    const reveal: Reveal = { cells: [], obstacles: [], doors: [], markers: [], monsters: [] };
    for (const k of visibleNow) {
      if (this.cells.has(k)) continue;
      this.cells.add(k);
      const [x, y] = k.split(',').map(Number);
      reveal.cells.push({ x, y });
    }
    for (const o of board.obstacles) {
      if (this.obstacles.has(o) || !obstacleCells(o).some((c) => this.cells.has(cellKey(c)))) continue;
      this.obstacles.add(o);
      reveal.obstacles.push(o);
    }
    for (const d of board.doors) {
      if (this.doors.has(d.door) || !board.doorSideCells(d).some((c) => this.cells.has(cellKey(c)))) continue;
      this.doors.add(d.door);
      reveal.doors.push(d.door);
    }
    for (const m of board.markers) {
      if (this.markers.has(m) || !this.cells.has(cellKey({ x: m.x, y: m.y }))) continue;
      this.markers.add(m);
      reveal.markers.push(m);
    }
    for (const p of pieces) {
      if (p.team !== 'monster' || this.monsters.has(p.id) || !visibleNow.has(cellKey(p.cell))) continue;
      this.monsters.add(p.id);
      reveal.monsters.push(p);
    }
    return reveal;
  }
}
