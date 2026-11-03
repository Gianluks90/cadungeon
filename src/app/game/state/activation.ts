import { Board } from '../board/board';
import { Piece } from '../pieces/piece';
import { GameState } from './game-state';

/**
 * Lo stato di attivazione di un mostro nel turno del Maligno (docs/REGOLE.md, sezione 9), per il pallino sulla miniatura:
 * - `ready` (verde): da attivare;
 * - `blocked` (giallo): non attivabile in questo turno, in un'area già rivelata (un mostro normale stordito perde il turno);
 * - `done` (grigio): l'attivazione è finita (`Piece.done`, che torna falso a ogni nuovo round).
 * Nessun pallino (null) per chi non è un mostro in gioco, per i nemici inattivi (già "spenti": fermi, a volte desaturati) e per chi dorme in un'area non ancora rivelata.
 */
export type ActivationState = 'ready' | 'blocked' | 'done';

export function activationOf(state: GameState, board: Board | null, monster: Piece): ActivationState | null {
  if (monster.team !== 'monster' || monster.city || monster.inactive) return null;
  const area = board?.areaAt(monster.cell);
  if (!monster.awake && area && !state.exploration.areas.has(area)) return null; // dorme: la sua area non è rivelata
  if (monster.done) return 'done';
  if ((monster.stunned || monster.status.stun > 0) && !monster.enhanced) return 'blocked'; // uno potenziato stordito può ancora muoversi o attaccare
  return 'ready';
}
