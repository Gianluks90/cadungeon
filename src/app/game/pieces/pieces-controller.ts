import { Container, Graphics, Ticker } from 'pixi.js';
import {
  CELL_SIZE,
  DOOR_MOVE_COST,
  PIT_FALL_WOUNDS,
  PAWN_RADIUS_RATIO,
  PAWN_STEP_MS,
  REACH_EDGE_INSET_PX,
  REACH_LINE_WIDTH_PX,
  REACH_PULSE_MIN,
  REACH_PULSE_PERIOD_MS,
  REACH_WALL_INSET_PX,
} from '../constants';
import { LINE, theme } from '../theme';
import { Board, Cell, cellKey } from '../board/board';
import { Reach, pathTo, reachable } from '../board/movement';
import { reachOutline } from './reach-outline';
import { Piece } from './piece';

/**
 * Le pedine sul tabellone: mostra dove può andare l'eroe attivo e lo muove casella per casella.
 * Le regole di passaggio: un eroe attraversa gli altri eroi ma non può fermarsi sulla loro casella;
 * i mostri bloccano. Quali passi sono possibili (muri, porte) sta in Board; qui c'è il gioco "a vista".
 */
export class PiecesController {
  private readonly highlight = new Graphics();
  private readonly pathLine = new Graphics();
  private readonly views = new Map<string, Graphics>();

  private board: Board | null = null;
  private activeId: string | null;
  private reach = new Map<string, Reach>();
  private enabled = true;
  private pulseTime = 0;
  private hovered: Cell | null = null;
  private moving: { piece: Piece; steps: Reach[]; index: number; elapsed: number } | null = null;

  constructor(
    layer: Container,
    ticker: Ticker,
    private readonly pieces: Piece[],
    private readonly onChange: (active: Piece | null) => void,
    private readonly onNotice: (text: string) => void,
  ) {
    this.activeId = pieces.find((p) => p.team === 'hero')?.id ?? null;
    layer.addChild(this.highlight, this.pathLine);
    for (const p of pieces) {
      const view = new Graphics();
      this.views.set(p.id, view);
      this.drawPiece(p);
      layer.addChild(view);
    }
    ticker.add((t) => this.tick(t.deltaMS));
    this.onChange(this.active);
  }

  /** L'eroe che si sta muovendo (null se non ce ne sono). */
  get active(): Piece | null {
    return this.pieces.find((p) => p.id === this.activeId) ?? null;
  }

  /** La mappa è cambiata (o si ricomincia a giocare): ricalcola dove si può andare. */
  setBoard(board: Board) {
    this.board = board;
    this.refresh();
  }

  /** Spento mentre si piazzano tile o porte: le pedine restano, ma niente caselle evidenziate. */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.refresh();
  }

  /** Inizia un nuovo round: i punti movimento di tutti gli eroi tornano al massimo. */
  newTurn() {
    if (this.moving) return;
    for (const p of this.pieces) p.points = p.speed;
    this.onChange(this.active);
    this.refresh();
  }

  /** Il puntatore è sopra questa casella (o fuori dalla mappa, se null): mostra il percorso. */
  hover(cell: Cell | null) {
    this.hovered = cell;
    this.drawPath();
  }

  /** Clic su una casella: su un altro eroe lo seleziona; su una casella raggiungibile ci muove l'eroe attivo. */
  click(cell: Cell) {
    if (!this.enabled || this.moving || !this.board) return;
    const other = this.pieceAt(cell);
    if (other) {
      if (other.team === 'hero' && other.id !== this.activeId) this.select(other);
      return;
    }
    const active = this.active;
    const target = this.reach.get(cellKey(cell));
    if (!active || !target || target.cost === 0) return;
    this.moving = { piece: active, steps: pathTo(this.reach, cell), index: 0, elapsed: 0 };
    this.highlight.clear();
    this.clearPath();
  }

  /**
   * Apre o chiude la porta `index`: serve che l'eroe attivo sia in una casella adiacente e abbia
   * DOOR_MOVE_COST punti movimento. Restituisce com'è andata, così chi chiama può avvisare.
   */
  toggleDoor(index: number): 'ok' | 'far' | 'cost' | 'busy' {
    const active = this.active;
    if (!this.board || !active || this.moving || !this.enabled) return 'busy';
    if (!this.board.isAdjacentToDoor(active.cell, index)) return 'far';
    if (active.points < DOOR_MOVE_COST) return 'cost';
    this.board.toggleDoor(index, active.cell);
    active.points -= DOOR_MOVE_COST;
    this.onChange(active);
    this.refresh();
    return 'ok';
  }

  /** C'è già un pezzo su questa casella? */
  isOccupied(cell: Cell): boolean {
    return !!this.pieceAt(cell);
  }

  private pieceAt(cell: Cell): Piece | undefined {
    return this.pieces.find((p) => p.cell.x === cell.x && p.cell.y === cell.y);
  }

  /** Il tema è cambiato: ridisegna le pedine e l'area di movimento. */
  applyTheme() {
    for (const p of this.pieces) this.drawPiece(p);
    this.refresh();
  }

  private select(piece: Piece) {
    const previous = this.active;
    this.activeId = piece.id;
    if (previous) this.drawPiece(previous);
    this.drawPiece(piece);
    this.onChange(piece);
    this.refresh();
  }

  /** Disegna una pedina: cerchio con bordo acceso se è l'eroe attivo, spento se è un altro eroe, rosso se è un mostro. */
  private drawPiece(p: Piece) {
    const view = this.views.get(p.id)!;
    const r = CELL_SIZE * PAWN_RADIUS_RATIO;
    const c = theme.color;
    const border = p.team === 'monster' ? c.danger : p.id === this.activeId ? c.accentActive : c.token.idle;
    view.clear();
    view.circle(0, 0, r).fill(c.token.fill);
    view.circle(0, 0, r * 0.62).fill(c.token.portrait); // qui andrà l'immagine
    view.circle(0, 0, r).stroke({ width: p.id === this.activeId ? LINE.strong : LINE.medium, color: border });
    view.position.set((p.cell.x + 0.5) * CELL_SIZE, (p.cell.y + 0.5) * CELL_SIZE);
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
    const from = m.piece.cell;
    const step = m.steps[m.index];
    const to = step.cell;
    const k = Math.min(1, m.elapsed / PAWN_STEP_MS);
    this.views.get(m.piece.id)!.position.set(
      (from.x + (to.x - from.x) * k + 0.5) * CELL_SIZE,
      (from.y + (to.y - from.y) * k + 0.5) * CELL_SIZE,
    );
    if (k < 1) return;

    m.piece.cell = to;
    m.piece.points -= step.stepCost; // un passo costa 1, un salto o un'uscita da una buca di più
    if (step.kind !== 'climb' && this.board?.isPit(to)) this.fallInto(m.piece);
    this.onChange(m.piece);
    m.index++;
    m.elapsed = 0;
    if (m.index >= m.steps.length) {
      this.moving = null;
      this.refresh();
    }
  }

  /** La pedina cade in una buca: subisce ferite che l'armatura non riduce. Il movimento finisce lì. */
  private fallInto(piece: Piece) {
    piece.wounds = Math.max(0, piece.wounds - PIT_FALL_WOUNDS);
    this.onNotice(`${piece.name} cade in una buca: ${PIT_FALL_WOUNDS} ferita`);
  }

  /** Le caselle che l'eroe attivo attraversa, contando che i mostri bloccano. */
  private computeReach(): Map<string, Reach> {
    const active = this.active;
    if (!this.board || !this.enabled || !active) return new Map();
    const enemies = new Set(this.pieces.filter((p) => p.team !== active.team).map((p) => cellKey(p.cell)));
    return reachable(this.board, active.cell, active.points, enemies);
  }

  /** Ricalcola le caselle raggiungibili e ridisegna. Si evidenziano solo quelle in cui ci si può fermare. */
  private refresh() {
    this.reach = this.computeReach();
    this.highlight.clear();
    if (this.enabled && this.board) {
      // Solo il contorno esterno dell'unione delle caselle (anche con forme a L o buchi), niente riempimento.
      // Ci sono anche la partenza e gli amici (ci si passa), così la linea non si spezza.
      const area = new Set<string>();
      for (const r of this.reach.values()) area.add(cellKey(r.cell));
      const board = this.board;
      const loops = reachOutline(area, (cell, side) => (board.isWallSide(cell, side) ? REACH_WALL_INSET_PX : REACH_EDGE_INSET_PX));
      for (const loop of loops) {
        this.highlight.poly(loop.flat(), true);
      }
      this.highlight.stroke({ width: REACH_LINE_WIDTH_PX, color: theme.color.accentReach, alpha: theme.alpha.reach, join: 'miter' });
    }
    this.drawPath();
  }

  private clearPath() {
    this.pathLine.clear();
  }

  /** Il percorso fino alla casella sotto il puntatore: caselle attraversate evidenziate in giallo tenue. */
  private drawPath() {
    this.clearPath();
    const active = this.active;
    if (!this.enabled || this.moving || !this.hovered || !active || this.pieceAt(this.hovered)) return;
    const target = this.reach.get(cellKey(this.hovered));
    if (!target || target.cost === 0) return;

    for (const step of pathTo(this.reach, this.hovered)) {
      this.pathLine.rect(step.cell.x * CELL_SIZE, step.cell.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
    this.pathLine.fill({ color: theme.color.accentUiSoft, alpha: theme.alpha.pathCell });
  }
}
