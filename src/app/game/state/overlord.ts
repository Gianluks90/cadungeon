import { Board, Cell, cellKey } from '../board/board';
import { ResolvedDoor, isLocked } from '../board/door';
import { DoorOpening, Reach, pathTo, reachable } from '../board/movement';
import { reachableShapes } from '../board/movement-big';
import { DOOR_MOVE_COST } from '../constants';
import { Piece, footprint } from '../pieces/piece';
import { distanceTo, monsterAttackOption, monsterRange } from './combat';
import { keywordLevel } from './status';
import { GameState } from './game-state';

/**
 * Lo script dell'Overlord (docs/REGOLE.md, sezione 9): i mostri vanno verso l'eroe più vicino e attaccano, preferendo il più ferito con un po' di caso.
 * Qui ci sono solo le decisioni, senza animazioni né finestre: usano le stesse regole degli eroi (movimento, linea di vista, attacco).
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

/** Una sagoma in cui il mostro può trovarsi (la sua casella e la sua forma), con quanto costa arrivarci e il percorso. */
interface Spot {
  cell: Cell;
  size: { w: number; h: number };
  cost: number;
  path: () => Reach[];
}

/** La distanza dal più vicino degli eroi, in caselle, dalla sagoma `spot` (la più corta fra le sue caselle). */
function nearestHeroDistance(spot: Pick<Spot, 'cell' | 'size'>, heroes: readonly Piece[]): number {
  let best = Infinity;
  for (const h of heroes) for (const c of footprint(h)) for (const m of footprint(spot)) best = Math.min(best, distance(m, c));
  return best;
}

/** Da `spot` il mostro potrebbe attaccare qualcuno? */
function canAttackFrom(state: GameState, board: Board, monster: Piece, spot: Pick<Spot, 'cell' | 'size'>, heroes: readonly Piece[]): boolean {
  const at = { ...monster, cell: spot.cell, size: spot.size };
  return heroes.some((h) => monsterAttackOption(state, board, at, h)?.enabled);
}

/** Un tiratore (distanza o magia) da `spot` colpisce bene: può attaccare un eroe che sta a una distanza entro la sua gittata di solito. */
function shootsWell(state: GameState, board: Board, monster: Piece, spot: Pick<Spot, 'cell' | 'size'>, heroes: readonly Piece[]): boolean {
  const at = { ...monster, cell: spot.cell, size: spot.size };
  const { likely } = monsterRange(state, monster);
  return heroes.some((h) => monsterAttackOption(state, board, at, h)?.enabled && distanceTo(at, h) <= likely);
}

/**
 * Il percorso del mostro in questo turno: verso una casella da cui può attaccare (la più vicina in punti movimento) oppure, se non ce n'è, verso
 * l'eroe più vicino. Vuoto se sta fermo (può già attaccare o non ha dove andare). I mostri grandi si muovono con la loro sagoma intera
 * (`board/movement-big.ts`): quelli da quattro caselle come un personaggio normale, il Segugio infernale piegandosi e ruotando.
 */
export function planMonsterMove(state: GameState, board: Board, monster: Piece): Reach[] {
  const heroes = heroesOnMap(state);
  if (!heroes.length || monster.points < 1) return [];
  const big = monster.size.w > 1 || monster.size.h > 1;
  const shooter = monster.attackType === 'ranged' || monster.attackType === 'magic';
  const here: Spot = { cell: monster.cell, size: monster.size, cost: 0, path: () => [] };
  if (!shooter && canAttackFrom(state, board, monster, here, heroes)) return [];

  // Gli eroi bloccano il passaggio, ma non a chi vola (Volo): sopra di loro si passa, senza fermarsi.
  const blocked = keywordLevel(state, monster, 'Volo') > 0 ? new Set<string>() : new Set(heroes.flatMap((h) => footprint(h).map(cellKey)));
  const doors: DoorOpening = { cost: DOOR_MOVE_COST, may: (rd) => monsterMayOpen(state, board, rd) };
  let spots: Spot[];
  if (big) {
    spots = reachableShapes(board, { cell: monster.cell, size: monster.size }, monster.points, blocked, doors).map((r) => ({ cell: r.shape.cell, size: r.shape.size, cost: r.cost, path: () => r.path }));
  } else {
    const reach = reachable(board, monster.cell, monster.points, blocked, [], new Map(), doors);
    spots = [...reach.values()].map((r) => ({ cell: r.cell, size: monster.size, cost: r.cost, path: () => pathTo(reach, r.cell) }));
  }
  const taken = new Set(state.pieces.filter((p) => !p.city && p.id !== monster.id).flatMap((p) => footprint(p).map(cellKey)));
  // Dove si può fermare: libera, non in una buca (un grande solo se non ci finisce interamente), non su un glifo acceso né su uno scrigno.
  const stops = spots.filter((r) => {
    const cells = footprint(r);
    if (r.cost === 0 || cells.some((c) => taken.has(cellKey(c)))) return false;
    if (big ? cells.every((c) => board.isPit(c)) : board.isPit(r.cell)) return false;
    return !cells.some((c) => {
      const m = board.markerAt(c);
      return (m?.type === 'glyph' && m.active) || m?.type === 'chest';
    });
  });

  let goal: Spot | undefined;
  if (shooter) {
    // Chi tira da lontano si tiene a distanza: fra le caselle da cui può colpire bene (linea di vista, entro la sua gittata di solito e non adiacente
    // per l'arco) sceglie la più lontana dagli eroi; a parità spende meno. Così non si sbatte in mischia e non annuncia tiri impossibili.
    const good = [here, ...stops].filter((r) => shootsWell(state, board, monster, r, heroes));
    const best = good.sort((a, b) => nearestHeroDistance(b, heroes) - nearestHeroDistance(a, heroes) || a.cost - b.cost)[0];
    if (best?.cost === 0) return []; // sta già nel posto migliore
    goal = best;
  } else {
    goal = stops.filter((r) => canAttackFrom(state, board, monster, r, heroes)).sort((a, b) => a.cost - b.cost)[0];
  }
  if (!goal) {
    // Nessuna casella da cui attaccare: ci si avvicina il più possibile (a parità, spendendo meno).
    const now = nearestHeroDistance(here, heroes);
    goal = stops
      .filter((r) => nearestHeroDistance(r, heroes) < now)
      .sort((a, b) => nearestHeroDistance(a, heroes) - nearestHeroDistance(b, heroes) || a.cost - b.cost)[0];
  }
  return goal ? goal.path() : [];
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
