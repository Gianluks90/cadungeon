import { Piece } from '../pieces/piece';
import { canSeeTarget } from './combat';
import { effectsOf } from './effects';
import type { GameState } from './game-state';

/**
 * Colpo a tradimento (Gjöffrid): i suoi attacchi fanno più danno contro chi non vedeva all'inizio del turno. Qui si ricorda, per ogni eroe che ha un effetto `attack` con `ifUnseenAtStart`,
 * quali nemici vedeva con la sua linea di vista (solo la sua, non quella degli altri eroi) quando comincia il round: `Piece.seenAtStart`. Si chiama a inizio partita e a ogni nuovo round.
 */
export function snapshotSeen(state: GameState): void {
  const board = state.board;
  if (!board) return;
  for (const hero of state.pieces) {
    if (hero.team !== 'hero' || hero.city) continue;
    if (!effectsOf(state, hero).some((x) => x.effect.kind === 'attack' && x.effect['ifUnseenAtStart'])) continue;
    hero.seenAtStart = state.pieces.filter((p: Piece) => p.team === 'monster' && !p.city && canSeeTarget(state, board, hero, p)).map((p) => p.id);
  }
}
