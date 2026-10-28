import { Board, Cell, cellKey } from '../board/board';
import { Reach } from '../board/movement';
import { Piece, footprint } from '../pieces/piece';
import { StepOutcome, applyStep } from './actions';
import type { GameState } from './game-state';

/**
 * Contraccolpo (docs/cards/stati.md): dopo aver inflitto almeno 1 danno lordo, chi attacca può spostare il bersaglio fino a **3 spazi**, in una casella libera.
 * Il percorso non è bloccato da creature né ostacoli (ma non attraversa muri né porte chiuse); i primi due spazi non contano come passaggi: l'Aura e la buca
 * valgono solo dove si arriva. I mostri grandi sono più pesanti (manuale): per ogni casella oltre la prima che occupano si sposta di uno spazio in meno
 * (la Salamandra di fuoco di 2 spazi, l'Ogre da quattro caselle per niente, il Drago nemmeno). Una sagoma grande si sposta intera, sempre sulle stesse caselle.
 */
export const KNOCKBACK_STEPS = 3;

/** Di quanti spazi si può spostare `target`: 3 meno una per ogni casella oltre la prima (mai meno di 0). */
export function knockbackSteps(target: Pick<Piece, 'size'>): number {
  return Math.max(0, KNOCKBACK_STEPS - (target.size.w * target.size.h - 1));
}

/** Le caselle dove si può spostare `target` (la sua casella in alto a sinistra, se è grande): fino a `knockbackSteps` passi di distanza (anche in diagonale) senza muri, in caselle libere. */
export function knockbackCells(state: GameState, board: Board, target: Piece): Cell[] {
  const steps = knockbackSteps(target);
  if (steps < 1) return [];
  const dirs = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => ({ dx, dy }))).filter((d) => d.dx || d.dy);
  const at = (c: Cell) => footprint({ cell: c, size: target.size });
  // Un passo della sagoma intera: ogni sua casella che esce dalla sagoma di prima deve poter fare quel passo (senza muri).
  const canMove = (c: Cell, d: { dx: number; dy: number }) => {
    const own = new Set(at(c).map(cellKey));
    return at(c).every((f) => {
      const to = { x: f.x + d.dx, y: f.y + d.dy };
      return own.has(cellKey(to)) || board.canStep(f, to);
    });
  };
  const seen = new Map<string, number>([[cellKey(target.cell), 0]]);
  let frontier: Cell[] = [target.cell];
  for (let step = 1; step <= steps; step++) {
    const next: Cell[] = [];
    for (const c of frontier) {
      for (const d of dirs) {
        const n = { x: c.x + d.dx, y: c.y + d.dy };
        if (seen.has(cellKey(n)) || !canMove(c, d)) continue;
        seen.set(cellKey(n), step);
        next.push(n);
      }
    }
    frontier = next;
  }
  const taken = new Set(state.pieces.filter((p) => !p.city && p.id !== target.id).flatMap((p) => footprint(p).map(cellKey)));
  return [...seen.keys()]
    .filter((k) => k !== cellKey(target.cell))
    .map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    })
    .filter((c) => at(c).every((f) => !taken.has(cellKey(f)) && board.isWalkable(f) && !board.blocksMovement(f)));
}

/** Lo script sceglie la casella più lontana da chi attacca (a parità, a caso: la prima). Null se non c'è dove spostarsi. */
export function pushAway(state: GameState, board: Board, attacker: Piece, target: Piece): Cell | null {
  const cells = knockbackCells(state, board, target);
  if (!cells.length) return null;
  const far = (c: Cell) => Math.max(Math.abs(c.x - attacker.cell.x), Math.abs(c.y - attacker.cell.y));
  return [...cells].sort((a, b) => far(b) - far(a))[0];
}

/** Sposta `target` nella casella scelta: cade se è una buca, subisce l'Aura se è accanto a chi ce l'ha (vale come un passo che non costa niente). */
export function applyKnockback(state: GameState, board: Board, target: Piece, dest: Cell): StepOutcome {
  const step: Reach = { cell: dest, cost: 0, prev: null, stepCost: 0, kind: 'step' };
  return applyStep(state, board, target, step);
}
