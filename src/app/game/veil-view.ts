import { Graphics } from 'pixi.js';
import { CELL_SIZE, REVEAL_ANIM_MS } from './constants';
import { theme } from './theme';
import { Board, Cell, cellKey } from './board/board';

/**
 * Il velo sulle caselle non ancora esplorate: un rettangolo del colore dello sfondo, leggermente opaco, che le lascia
 * "vuote e un po' spente". Quando una casella viene scoperta il velo svanisce piano. Gli elementi (rocce, porte,
 * mostri) non si disegnano finché non sono rivelati: il velo non nasconde niente, spegne soltanto.
 */
export class VeilView {
  readonly graphics = new Graphics();
  private board: Board | null = null;
  private explored: ReadonlySet<string> | null = null;
  private readonly fading = new Map<string, number>();

  /** `explored` null = niente velo (per chi costruisce la mappa e deve vedere tutto). */
  setState(board: Board, explored: ReadonlySet<string> | null) {
    this.board = board;
    this.explored = explored;
    this.fading.clear();
    this.draw();
  }

  /** Alle caselle appena scoperte il velo toglie opacità piano piano. */
  reveal(cells: readonly Cell[]) {
    if (!this.explored) return;
    for (const c of cells) this.fading.set(cellKey(c), 0);
    this.draw();
  }

  tick(deltaMs: number) {
    if (!this.fading.size) return;
    for (const [k, p] of this.fading) {
      const next = p + deltaMs / REVEAL_ANIM_MS;
      if (next >= 1) this.fading.delete(k);
      else this.fading.set(k, next);
    }
    this.draw();
  }

  private draw() {
    const g = this.graphics;
    g.clear();
    if (!this.board || !this.explored) return;
    const color = theme.color.background;
    const alpha = theme.alpha.unexplored;
    const fadingCells: [number, number, number][] = [];
    for (const c of this.board.walkableCells()) {
      const k = cellKey(c);
      const p = this.fading.get(k);
      if (p !== undefined) fadingCells.push([c.x, c.y, p]);
      else if (!this.explored.has(k)) g.rect(c.x * CELL_SIZE, c.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
    g.fill({ color, alpha });
    for (const [x, y, p] of fadingCells) {
      g.rect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE).fill({ color, alpha: alpha * (1 - p) });
    }
  }
}
