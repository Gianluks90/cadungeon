import { Board, Cell, cellKey } from '../board/board';
import { Reach, pathTo, reachable } from '../board/movement';
import { Piece, footprint } from '../pieces/piece';
import { monsterAttackOption } from './combat';
import { keywordLevel } from './status';
import { GameState } from './game-state';

/**
 * Lo script dell'Overlord (docs/REGOLE.md, sezione 9): i mostri vanno verso l'eroe più vicino e attaccano, preferendo il più ferito con un po' di caso.
 * Qui ci sono solo le decisioni, senza animazioni né finestre: usano le stesse regole degli eroi (movimento, linea di vista, attacco).
 * Per ora i mostri grandi non si muovono (hanno regole di movimento particolari): attaccano solo se il bersaglio è già alla loro portata.
 */

const distance = (a: Cell, b: Cell) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Gli eroi sulla mappa. */
function heroesOnMap(state: GameState): Piece[] {
  return state.pieces.filter((p) => p.team === 'hero' && !p.city);
}

/** La distanza dal più vicino degli eroi, in caselle. */
function nearestHeroDistance(monster: Piece, cell: Cell, heroes: readonly Piece[]): number {
  let best = Infinity;
  for (const h of heroes) for (const c of footprint(h)) best = Math.min(best, distance(cell, c));
  return best;
}

/** Da `cell` il mostro potrebbe attaccare qualcuno? */
function canAttackFrom(state: GameState, board: Board, monster: Piece, cell: Cell, heroes: readonly Piece[]): boolean {
  const at = { ...monster, cell };
  return heroes.some((h) => monsterAttackOption(state, board, at, h)?.enabled);
}

/**
 * Il percorso del mostro in questo turno: verso una casella da cui può attaccare (la più vicina in punti movimento) oppure, se non ce n'è, verso
 * l'eroe più vicino. Vuoto se sta fermo (può già attaccare, non ha dove andare o è un mostro grande).
 */
export function planMonsterMove(state: GameState, board: Board, monster: Piece): Reach[] {
  const heroes = heroesOnMap(state);
  if (!heroes.length || monster.size.w > 1 || monster.size.h > 1 || monster.points < 1) return [];
  if (canAttackFrom(state, board, monster, monster.cell, heroes)) return [];

  // Gli eroi bloccano il passaggio, ma non a chi vola (Volo): sopra di loro si passa, senza fermarsi.
  const blocked = keywordLevel(state, monster, 'Volo') > 0 ? new Set<string>() : new Set(heroes.flatMap((h) => footprint(h).map(cellKey)));
  const reach = reachable(board, monster.cell, monster.points, blocked);
  const taken = new Set(state.pieces.filter((p) => !p.city && p.id !== monster.id).flatMap((p) => footprint(p).map(cellKey)));
  // Dove si può fermare: libera, non in una buca, non su un glifo acceso né su uno scrigno (i mostri non ci si fermano).
  const stops = [...reach.values()].filter((r) => {
    if (r.cost === 0 || taken.has(cellKey(r.cell)) || board.isPit(r.cell)) return false;
    const m = board.markerAt(r.cell);
    return !(m?.type === 'glyph' && m.active) && m?.type !== 'chest';
  });
  const attack = stops.filter((r) => canAttackFrom(state, board, monster, r.cell, heroes)).sort((a, b) => a.cost - b.cost);
  let goal: Reach | undefined = attack[0];
  if (!goal) {
    // Nessuna casella da cui attaccare: ci si avvicina il più possibile (a parità, spendendo meno).
    const here = nearestHeroDistance(monster, monster.cell, heroes);
    goal = stops
      .filter((r) => nearestHeroDistance(monster, r.cell, heroes) < here)
      .sort((a, b) => nearestHeroDistance(monster, a.cell, heroes) - nearestHeroDistance(monster, b.cell, heroes) || a.cost - b.cost)[0];
  }
  return goal ? pathTo(reach, goal.cell) : [];
}

/**
 * Chi attacca il mostro (dalla sua casella di adesso): fra gli eroi che può colpire, il più ferito il più delle volte, qualche volta uno a caso.
 * Null se non può attaccare nessuno.
 */
export function chooseMonsterTarget(state: GameState, board: Board, monster: Piece): Piece | null {
  const candidates = heroesOnMap(state).filter((h) => monsterAttackOption(state, board, monster, h)?.enabled);
  if (!candidates.length) return null;
  if (state.random() < 0.7) return [...candidates].sort((a, b) => a.wounds / a.maxWounds - b.wounds / b.maxWounds)[0];
  return candidates[Math.floor(state.random() * candidates.length)];
}
