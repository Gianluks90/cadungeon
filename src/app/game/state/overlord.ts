import { Board, Cell, cellKey } from '../board/board';
import { ResolvedDoor, isLocked } from '../board/door';
import { DoorOpening, Reach, pathTo, reachable } from '../board/movement';
import { DOOR_MOVE_COST } from '../constants';
import { Piece, footprint } from '../pieces/piece';
import { distanceTo, monsterAttackOption, monsterRange } from './combat';
import { keywordLevel } from './status';
import { GameState } from './game-state';

/**
 * Lo script dell'Overlord (docs/REGOLE.md, sezione 9): i mostri vanno verso l'eroe più vicino e attaccano, preferendo il più ferito con un po' di caso.
 * Qui ci sono solo le decisioni, senza animazioni né finestre: usano le stesse regole degli eroi (movimento, linea di vista, attacco).
 * Per ora i mostri grandi non si muovono (hanno regole di movimento particolari): attaccano solo se il bersaglio è già alla loro portata.
 */

const distance = (a: Cell, b: Cell) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/**
 * Un mostro può aprire una porta chiusa che ha davanti, a patto che non sia chiusa a chiave (né runica) e che le due aree che collega siano state
 * rivelate (manuale, "Esplorazione"): così un eroe che chiude una porta fa spendere punti al mostro che deve riaprirla.
 */
export function monsterMayOpen(state: GameState, board: Board, rd: ResolvedDoor): boolean {
  if (rd.door.open || isLocked(rd.door)) return false;
  return board.doorSideCells(rd).every((c) => {
    const area = board.areaAt(c);
    return area ? state.exploration.areas.has(area) : state.exploration.cells.has(cellKey(c));
  });
}

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

/** Un tiratore (distanza o magia) da `cell` colpisce bene: può attaccare un eroe che sta a una distanza entro la sua gittata di solito. */
function shootsWell(state: GameState, board: Board, monster: Piece, cell: Cell, heroes: readonly Piece[]): boolean {
  const at = { ...monster, cell };
  const { likely } = monsterRange(state, monster);
  return heroes.some((h) => monsterAttackOption(state, board, at, h)?.enabled && distanceTo(at, h) <= likely);
}

/**
 * Il percorso del mostro in questo turno: verso una casella da cui può attaccare (la più vicina in punti movimento) oppure, se non ce n'è, verso
 * l'eroe più vicino. Vuoto se sta fermo (può già attaccare, non ha dove andare o è un mostro grande).
 */
export function planMonsterMove(state: GameState, board: Board, monster: Piece): Reach[] {
  const heroes = heroesOnMap(state);
  if (!heroes.length || monster.size.w > 1 || monster.size.h > 1 || monster.points < 1) return [];
  const shooter = monster.attackType === 'ranged' || monster.attackType === 'magic';
  if (!shooter && canAttackFrom(state, board, monster, monster.cell, heroes)) return [];

  // Gli eroi bloccano il passaggio, ma non a chi vola (Volo): sopra di loro si passa, senza fermarsi.
  const blocked = keywordLevel(state, monster, 'Volo') > 0 ? new Set<string>() : new Set(heroes.flatMap((h) => footprint(h).map(cellKey)));
  const doors: DoorOpening = { cost: DOOR_MOVE_COST, may: (rd) => monsterMayOpen(state, board, rd) };
  const reach = reachable(board, monster.cell, monster.points, blocked, [], new Map(), doors);
  const taken = new Set(state.pieces.filter((p) => !p.city && p.id !== monster.id).flatMap((p) => footprint(p).map(cellKey)));
  // Dove si può fermare: libera, non in una buca, non su un glifo acceso né su uno scrigno (i mostri non ci si fermano).
  const stops = [...reach.values()].filter((r) => {
    if (r.cost === 0 || taken.has(cellKey(r.cell)) || board.isPit(r.cell)) return false;
    const m = board.markerAt(r.cell);
    return !(m?.type === 'glyph' && m.active) && m?.type !== 'chest';
  });
  let goal: Reach | undefined;
  if (shooter) {
    // Chi tira da lontano si tiene a distanza: fra le caselle da cui può colpire bene (linea di vista, entro la sua gittata di solito e non adiacente
    // per l'arco) sceglie la più lontana dagli eroi; a parità spende meno. Così non si sbatte in mischia e non annuncia tiri impossibili.
    const here: Reach = { cell: monster.cell, cost: 0, prev: null, stepCost: 0, kind: 'step' };
    const spots = [here, ...stops].filter((r) => shootsWell(state, board, monster, r.cell, heroes));
    const best = spots.sort((a, b) => nearestHeroDistance(monster, b.cell, heroes) - nearestHeroDistance(monster, a.cell, heroes) || a.cost - b.cost)[0];
    if (best?.cost === 0) return []; // sta già nel posto migliore
    goal = best;
  } else {
    const attack = stops.filter((r) => canAttackFrom(state, board, monster, r.cell, heroes)).sort((a, b) => a.cost - b.cost);
    goal = attack[0];
  }
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
