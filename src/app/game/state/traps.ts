import { Board, Cell, cellKey } from '../board/board';
import { DieFace } from '../dice/faces';
import { EvilCardDef, TrapTarget } from '../evil/card';
import { Piece, footprint } from '../pieces/piece';
import { cardCost, cardOf } from './evil-deck';
import { GameState } from './game-state';

/**
 * Le trappole del Maligno (docs/REGOLE.md, sezione 9): non sono reazioni. Lo script le arma in anticipo su un bersaglio (una casella, una porta o uno
 * scrigno) pagando subito l'Odio; i giocatori non le vedono. Scattano da sole quando un eroe entra in quella casella o apre quella porta o
 * quello scrigno. Qui ci sono le regole sullo stato; i dadi li tira la scena.
 */

/** Dove è armata una trappola: la casella (o lo scrigno che ci sta) oppure la porta, per numero d'ordine nella lista delle porte dell'avventura. */
export type TrapSpot = { kind: 'cell' | 'chest'; x: number; y: number } | { kind: 'door'; index: number };

export interface ArmedTrap {
  /** L'id della carta. */
  card: string;
  at: TrapSpot;
}

/** Quante trappole armate al massimo per categoria (casella, porta, scrigno): da provare in partita. */
export const TRAP_LIMIT_PER_TARGET = 2;
/** Le trappole si armano al massimo a questa distanza dall'eroe più vicino, in caselle. */
const ARM_RANGE = 8;

/** Una faccia vuota del dado competenza (niente scintille, niente cuore né gittata). */
export function isBlank(face: DieFace): boolean {
  return !face.spark && !face.hearts && !face.range && !face.slash;
}

/** Le scintille (scintille) dei dadi tirati. */
export function sparks(faces: readonly DieFace[]): number {
  return faces.reduce((n, f) => n + f.spark, 0);
}

/** L'Odio che costa armare la carta: Signore delle trappole lo riduce di 1, Protezione dal male (Thael) lo aumenta di 1. */
export function trapCost(state: GameState, card: EvilCardDef): number {
  return Math.max(0, cardCost(state, card) - (state.evil.inPlay.includes('trap-lord') ? 1 : 0));
}

/** Le ferite in più delle trappole che feriscono (Signore delle trappole: +2). */
export function trapDamageBonus(state: GameState): number {
  return state.evil.inPlay.includes('trap-lord') ? 2 : 0;
}

const sameSpot = (a: TrapSpot, b: TrapSpot) => (a.kind === 'door' || b.kind === 'door' ? a.kind === b.kind && (a as { index: number }).index === (b as { index: number }).index : a.kind === b.kind && a.x === (b as { x: number }).x && a.y === (b as { y: number }).y);

/** La trappola armata su una casella (fossa, macerie). */
export function trapAtCell(state: GameState, cell: Cell): ArmedTrap | null {
  return state.evil.traps.find((t) => t.at.kind === 'cell' && t.at.x === cell.x && t.at.y === cell.y) ?? null;
}

/** La trappola armata su una porta (numero d'ordine nella lista `state.doors`). */
export function trapAtDoor(state: GameState, door: object): ArmedTrap | null {
  const index = state.doors.indexOf(door as never);
  return state.evil.traps.find((t) => t.at.kind === 'door' && t.at.index === index) ?? null;
}

/** La trappola armata sullo scrigno di questa casella. */
export function trapAtChest(state: GameState, cell: Cell): ArmedTrap | null {
  return state.evil.traps.find((t) => t.at.kind === 'chest' && t.at.x === cell.x && t.at.y === cell.y) ?? null;
}

/** La trappola è scattata (o va tolta): la carta va negli scarti. */
export function consumeTrap(state: GameState, trap: ArmedTrap): void {
  const o = state.evil;
  const i = o.traps.indexOf(trap);
  if (i >= 0) o.traps.splice(i, 1);
  o.discard.push(trap.card);
}

const distance = (a: Cell, b: Cell) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Le ferite che l'armatura non riduce. Restituisce true se l'eroe è a zero ferite. */
export function woundIgnoringArmor(piece: Piece, amount: number): boolean {
  piece.wounds = Math.max(0, piece.wounds - Math.max(0, amount));
  return piece.wounds <= 0;
}

/** Una casella libera accanto a `from` dove spostare un eroe (vicino a `prefer` se c'è): senza ostacoli, buche, segnalini né pedine. */
export function freeAdjacentCell(state: GameState, board: Board, from: Cell, prefer?: Cell): Cell | null {
  const taken = new Set(state.pieces.filter((p) => !p.city).flatMap((p) => footprint(p).map(cellKey)));
  const options: Cell[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const c = { x: from.x + dx, y: from.y + dy };
      if ((!dx && !dy) || !board.isWalkable(c) || taken.has(cellKey(c)) || board.obstacleAt(c) || board.markerAt(c) || !board.canStep(from, c)) continue;
      options.push(c);
    }
  }
  const goal = prefer ?? from;
  return options.sort((a, b) => distance(a, goal) - distance(b, goal))[0] ?? null;
}

/**
 * La casella libera più vicina a `from` che sta subito fuori dalla sagoma di `piece` (anche grande: 2×2, 1×2…), raggiungibile senza muri in mezzo: dove spostare chi si trova
 * sotto una pedina che sta per entrare. Come `freeAdjacentCell`, ma attorno a tutte le sue caselle. Null se non c'è posto.
 */
export function freeCellAround(state: GameState, board: Board, piece: Piece, from: Cell): Cell | null {
  const inside = footprint(piece);
  const taken = new Set([...state.pieces.filter((p) => !p.city && p !== piece).flatMap((p) => footprint(p).map(cellKey)), ...inside.map(cellKey)]);
  const options = new Map<string, Cell>();
  for (const f of inside) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const c = { x: f.x + dx, y: f.y + dy };
        if ((!dx && !dy) || taken.has(cellKey(c)) || options.has(cellKey(c)) || !board.isWalkable(c) || board.obstacleAt(c) || board.markerAt(c) || !board.canStep(f, c)) continue;
        options.set(cellKey(c), c);
      }
    }
  }
  return [...options.values()].sort((a, b) => distance(a, from) - distance(b, from))[0] ?? null;
}

/**
 * I bersagli dove la carta si può armare adesso. Lo script si tiene a qualche passo dagli eroi (`ARM_RANGE`); chi sceglie a mano (`anywhere`) può metterla in qualunque casella libera:
 * conta solo sperare che un eroe ci finisca dentro.
 */
function targetsFor(state: GameState, board: Board, card: EvilCardDef, anywhere = false): TrapSpot[] {
  const heroes = state.pieces.filter((p) => p.team === 'hero' && !p.city);
  if ((!heroes.length && !anywhere) || !card.target) return [];
  const nearest = (c: Cell) => (anywhere ? 2 : Math.min(...heroes.map((h) => distance(c, h.cell))));
  const taken = new Set(state.pieces.filter((p) => !p.city).flatMap((p) => footprint(p).map(cellKey)));
  const armed = state.evil.traps;
  const free = (spot: TrapSpot) => !armed.some((t) => sameSpot(t.at, spot));
  const target: TrapTarget = card.target;
  if (target === 'cell') {
    return board
      .walkableCells()
      .filter((c) => !taken.has(cellKey(c)) && !board.obstacleAt(c) && !board.markerAt(c) && nearest(c) >= 2 && nearest(c) <= ARM_RANGE)
      .filter((c) => card.id !== 'rockfall' || !touchesObstacle(board, c))
      .map((c): TrapSpot => ({ kind: 'cell', x: c.x, y: c.y }))
      .filter(free);
  }
  if (target === 'door') {
    return board.doors
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => !d.door.open && d.door.lock?.kind !== 'rune' && d.door.lock?.kind !== 'event')
      .map(({ d }): TrapSpot => ({ kind: 'door', index: state.doors.indexOf(d.door) }))
      .filter((s) => s.kind === 'door' && s.index >= 0 && free(s));
  }
  if (target === 'chest') {
    return board.markers
      .filter((m) => m.type === 'chest' && !m.open)
      .map((m): TrapSpot => ({ kind: 'chest', x: m.x, y: m.y }))
      .filter(free);
  }
  return [];
}

/** I bersagli dove il Maligno a mano può armare questa carta Trappola (casella, porta o scrigno). Vuoto per Seduzione oscura (`hero`), che non si arma. */
export function trapSpots(state: GameState, board: Board, card: EvilCardDef): TrapSpot[] {
  return card.kind === 'trap' ? targetsFor(state, board, card, true) : [];
}

/** Ci sono già troppe trappole armate di questa categoria (casella, porta o scrigno)? */
export function trapLimitReached(state: GameState, card: EvilCardDef): boolean {
  return state.evil.traps.filter((t) => cardOf(state, t.card)?.target === card.target).length >= TRAP_LIMIT_PER_TARGET;
}

/** Il Maligno arma la carta in mano sul bersaglio scelto: paga l'Odio (`trapCost`) e la carta resta in gioco, coperta, finché un eroe non la fa scattare. Null se non si può. */
export function armTrapAt(state: GameState, card: EvilCardDef, at: TrapSpot): ArmedTrap | null {
  const o = state.evil;
  const index = o.hand.indexOf(card.id);
  if (index < 0 || trapCost(state, card) > o.hatred || o.traps.some((t) => sameSpot(t.at, at))) return null;
  o.hatred -= trapCost(state, card);
  o.hand.splice(index, 1);
  const trap: ArmedTrap = { card: card.id, at };
  o.traps.push(trap);
  return trap;
}

function touchesObstacle(board: Board, c: Cell): boolean {
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (board.obstacleAt({ x: c.x + dx, y: c.y + dy })) return true;
  return false;
}

/**
 * Lo script arma una trappola: la carta della mano più cara che può pagare, se per la sua categoria non ci sono già troppe trappole armate e c'è un
 * bersaglio valido. Il bersaglio è uno a caso fra le porte e gli scrigni chiusi, o fra le caselle libere a qualche passo dagli eroi. Null se non arma niente.
 * Con `chest` arma solo una trappola da scrigno su quello scrigno, subito (l'Odio delle Maledizioni): il tetto per categoria non vale, perché scatta all'istante.
 */
export function armTrap(state: GameState, board: Board, chest?: Cell): ArmedTrap | null {
  const o = state.evil;
  const candidates = o.hand
    .map((id) => cardOf(state, id))
    .filter((c): c is EvilCardDef => !!c && c.kind === 'trap' && !!c.target && c.ready === true && trapCost(state, c) <= o.hatred)
    .filter((c) => (chest ? c.target === 'chest' : o.traps.filter((t) => cardOf(state, t.card)?.target === c.target).length < TRAP_LIMIT_PER_TARGET))
    .sort((a, b) => trapCost(state, b) - trapCost(state, a));
  for (const card of candidates) {
    const here: TrapSpot[] = chest && !o.traps.some((t) => sameSpot(t.at, { kind: 'chest', x: chest.x, y: chest.y })) ? [{ kind: 'chest', x: chest.x, y: chest.y }] : [];
    const spots = chest ? here : targetsFor(state, board, card);
    if (!spots.length) continue;
    const at = spots[Math.floor(state.random() * spots.length)];
    o.hatred -= trapCost(state, card);
    o.hand.splice(o.hand.indexOf(card.id), 1);
    const trap: ArmedTrap = { card: card.id, at };
    o.traps.push(trap);
    return trap;
  }
  return null;
}
