import { Board, Cell, cellKey } from '../board/board';
import { Reach, reachable } from '../board/movement';
import { reachableShapes } from '../board/movement-big';
import { Piece, footprint } from '../pieces/piece';
import { canSeeTarget } from './combat';
import type { GameState } from './game-state';

/**
 * Telecinesi (docs/cards/skill-magic.md): spendi 1 fatica durante il tuo turno per muovere di 1 spazio un modello (amico o nemico, ma non te) che sta nella
 * tua linea di vista, seguendo le normali regole del movimento. Qui ci sono le regole: chi si può spostare e dove; la scelta e l'animazione stanno nella scena.
 */

/** I passi di un solo spazio che `model` può fare (come se si muovesse con 1 punto movimento): le sagome grandi con la loro forma. Non spendono i suoi punti. */
export function telekinesisMoves(state: GameState, board: Board, model: Piece): Reach[] {
  const others = new Set(state.pieces.filter((p) => !p.city && p.id !== model.id).flatMap((p) => footprint(p).map(cellKey)));
  let steps: Reach[];
  if (model.size.w > 1 || model.size.h > 1) {
    steps = reachableShapes(board, { cell: model.cell, size: model.size }, 1, others).filter((r) => r.cost === 1).map((r) => r.path[0]);
  } else {
    steps = [...reachable(board, model.cell, 1, others).values()].filter((r) => r.cost === 1);
  }
  // Un mostro non si ferma su un glifo acceso né su uno scrigno (come quando si muove da solo).
  return steps
    .filter((s) => model.team !== 'monster' || !footprint({ cell: s.cell, size: s.size ?? model.size }).some((c) => {
      const m = board.markerAt(c);
      return (m?.type === 'glyph' && m.active) || m?.type === 'chest';
    }))
    .map((s) => ({ ...s, cost: 0, stepCost: 0 })); // il passo non costa niente al modello spostato
}

/** I modelli che `hero` può spostare: li vede (e, con la nebbia, `known`) e hanno almeno un posto dove andare. */
export function telekinesisTargets(state: GameState, board: Board, hero: Piece, known: (p: Piece) => boolean): Piece[] {
  return state.pieces.filter((p) => p.id !== hero.id && !p.city && known(p) && canSeeTarget(state, board, hero, p) && telekinesisMoves(state, board, p).length > 0);
}

/** Le caselle da evidenziare per i passi di `moves` (la casella in alto a sinistra della nuova sagoma). */
export function moveCells(moves: readonly Reach[]): Cell[] {
  const seen = new Set<string>();
  return moves.filter((m) => !seen.has(cellKey(m.cell)) && seen.add(cellKey(m.cell))).map((m) => m.cell);
}
