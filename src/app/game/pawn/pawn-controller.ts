import { Container, Graphics, Ticker } from 'pixi.js';
import {
  CELL_SIZE,
  PATH_ALPHA,
  PAWN_ACTIVE_COLOR,
  PAWN_FILL_COLOR,
  PAWN_PORTRAIT_COLOR,
  PAWN_RADIUS_RATIO,
  PAWN_SPEED,
  PAWN_STEP_MS,
  REACH_ALPHA,
  REACH_COLOR,
  REACH_EDGE_INSET_PX,
  REACH_PULSE_MIN,
  REACH_PULSE_PERIOD_MS,
  REACH_WALL_INSET_PX,
} from '../constants';
import { Board, Cell, cellKey } from '../board/board';
import { Reach, pathTo, reachable } from '../board/movement';

/**
 * La pedina dell'eroe: tiene i punti movimento, mostra dove può andare e la muove casella per casella.
 * Le regole (quali passi sono possibili) stanno in Board e movement.ts: qui c'è solo il gioco "a vista".
 */
export class PawnController {
  private readonly highlight = new Graphics();
  private readonly pathLine = new Graphics();
  private readonly pawn = new Graphics();

  private board: Board | null = null;
  private cell: Cell;
  private points = PAWN_SPEED;
  private reach = new Map<string, Reach>();
  private enabled = true;
  private pulseTime = 0;
  private hovered: Cell | null = null;
  private moving: { steps: Cell[]; index: number; elapsed: number } | null = null;

  constructor(
    layer: Container,
    ticker: Ticker,
    start: Cell,
    private readonly onChange: (points: number, max: number) => void,
  ) {
    this.cell = start;
    const r = CELL_SIZE * PAWN_RADIUS_RATIO;
    this.pawn.circle(0, 0, r).fill(PAWN_FILL_COLOR);
    this.pawn.circle(0, 0, r * 0.62).fill(PAWN_PORTRAIT_COLOR); // qui andrà l'immagine dell'eroe
    this.pawn.circle(0, 0, r).stroke({ width: 3, color: PAWN_ACTIVE_COLOR });
    this.placePawn(start.x, start.y);
    layer.addChild(this.highlight, this.pathLine, this.pawn);
    ticker.add((t) => this.tick(t.deltaMS));
    this.onChange(this.points, PAWN_SPEED);
  }

  /** La mappa è cambiata (o si ricomincia a giocare): ricalcola dove si può andare. */
  setBoard(board: Board) {
    this.board = board;
    this.refresh();
  }

  /** Spento mentre si piazzano i tile: la pedina resta, ma niente caselle evidenziate. */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.refresh();
  }

  /** Inizia un nuovo turno: i punti movimento tornano al massimo. */
  newTurn() {
    if (this.moving) return;
    this.points = PAWN_SPEED;
    this.onChange(this.points, PAWN_SPEED);
    this.refresh();
  }

  /** Il puntatore è sopra questa casella (o fuori dalla mappa, se null): mostra il percorso. */
  hover(cell: Cell | null) {
    this.hovered = cell;
    this.drawPath();
  }

  /** Clic su una casella: se è raggiungibile, la pedina ci va. */
  click(cell: Cell) {
    if (!this.enabled || this.moving || !this.board) return;
    const target = this.reach.get(cellKey(cell));
    if (!target || target.cost === 0) return;
    this.moving = { steps: pathTo(this.reach, cell), index: 0, elapsed: 0 };
    this.highlight.clear();
    this.pathLine.clear();
  }

  private placePawn(x: number, y: number) {
    this.pawn.position.set((x + 0.5) * CELL_SIZE, (y + 0.5) * CELL_SIZE);
  }

  /** Avanza l'animazione: un passo ogni PAWN_STEP_MS, e ogni passo costa un punto. */
  private tick(deltaMs: number) {
    // Le caselle raggiungibili pulsano lentamente (la luce "respira").
    this.pulseTime = (this.pulseTime + deltaMs) % REACH_PULSE_PERIOD_MS;
    const wave = (1 - Math.cos((this.pulseTime / REACH_PULSE_PERIOD_MS) * Math.PI * 2)) / 2; // 0 -> 1 -> 0
    this.highlight.alpha = REACH_PULSE_MIN + (1 - REACH_PULSE_MIN) * wave;

    const m = this.moving;
    if (!m) return;
    m.elapsed += deltaMs;
    const to = m.steps[m.index];
    const k = Math.min(1, m.elapsed / PAWN_STEP_MS);
    this.placePawn(this.cell.x + (to.x - this.cell.x) * k, this.cell.y + (to.y - this.cell.y) * k);
    if (k < 1) return;

    this.cell = to;
    this.points--;
    this.onChange(this.points, PAWN_SPEED);
    m.index++;
    m.elapsed = 0;
    if (m.index >= m.steps.length) {
      this.moving = null;
      this.refresh();
    }
  }

  /** Ricalcola le caselle raggiungibili e ridisegna. */
  private refresh() {
    this.reach = this.board && this.enabled ? reachable(this.board, this.cell, this.points) : new Map();
    this.highlight.clear();
    if (this.enabled) {
      for (const r of this.reach.values()) {
        if (r.cost === 0) continue;
        // Quasi fino al bordo della cella; dove c'è un muro ci si ferma prima, per non coprirlo.
        const inset = (side: 'N' | 'E' | 'S' | 'W') =>
          this.board!.isWallSide(r.cell, side) ? REACH_WALL_INSET_PX : REACH_EDGE_INSET_PX;
        const left = inset('W');
        const top = inset('N');
        this.highlight.rect(
          r.cell.x * CELL_SIZE + left, r.cell.y * CELL_SIZE + top,
          CELL_SIZE - left - inset('E'), CELL_SIZE - top - inset('S'),
        );
      }
      // Linea sottile come la griglia: sempre 1 pixel a schermo.
      this.highlight.stroke({ width: 1, color: REACH_COLOR, alpha: REACH_ALPHA, pixelLine: true });
    }
    this.drawPath();
  }

  /** La linea che mostra il percorso fino alla casella sotto il puntatore. */
  private drawPath() {
    this.pathLine.clear();
    if (!this.enabled || this.moving || !this.hovered) return;
    const target = this.reach.get(cellKey(this.hovered));
    if (!target || target.cost === 0) return;

    const centre = (c: Cell) => [(c.x + 0.5) * CELL_SIZE, (c.y + 0.5) * CELL_SIZE] as const;
    this.pathLine.moveTo(...centre(this.cell));
    for (const step of pathTo(this.reach, this.hovered)) this.pathLine.lineTo(...centre(step));
    this.pathLine.stroke({ width: 3, color: PAWN_ACTIVE_COLOR, alpha: PATH_ALPHA, cap: 'round', join: 'round' });
    this.pathLine.circle(...centre(this.hovered), 5).fill({ color: PAWN_ACTIVE_COLOR, alpha: PATH_ALPHA });
  }
}
