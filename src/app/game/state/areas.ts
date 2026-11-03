import { Board, Cell, cellKey } from '../board/board';
import { Piece, createPieces, footprint } from '../pieces/piece';
import { GameState } from './game-state';
import { newMonsterId } from './evil-deck';

/**
 * Le aree (docs/REGOLE.md, sezione 9): un'area è un gruppo di tile con lo stesso id `area` (una stanza, o i corridoi fra un gruppo di porte).
 * Quando gli eroi vedono per la prima volta almeno una sua casella l'area è rivelata: i suoi mostri, che fin lì dormivano, si svegliano
 * (il Maligno li muove anche se gli eroi non li vedono ancora) e scattano le carte Potere "quando riveli una nuova area".
 */

/** Il mostro dorme? Sì finché è in un'area non ancora rivelata. Un mostro senza area, o già sveglio, agisce sempre. */
export function isDormant(state: GameState, board: Board, monster: Piece): boolean {
  if (monster.awake) return false;
  const area = board.areaAt(monster.cell);
  if (!area || state.exploration.areas.has(area)) {
    monster.awake = true;
    return false;
  }
  return true;
}

/** I mostri che stanno (con la casella d'origine) in questa area. */
export function monstersIn(state: GameState, board: Board, area: string): Piece[] {
  return state.pieces.filter((p) => p.team === 'monster' && !p.city && board.areaAt(p.cell) === area);
}

export interface AreaResult {
  /** I mostri apparsi (Orda di Creature): la scena ne crea la grafica. */
  spawned: Piece[];
  /** I mostri diventati potenziati (Abile comandante): la scena ridisegna la pedina. */
  upgraded: Piece[];
}

/** I tipi che l'Orda di Creature può aggiungere. */
export const HORDE_TYPES = ['goblin', 'skeleton', 'poison-spider'];

/** I mostri di un'area che Abile comandante può potenziare: non unici, non già potenziati, di un tipo del catalogo. */
export function upgradeOptions(state: GameState, inArea: readonly Piece[]): Piece[] {
  return inArea.filter((m) => m.monster && !m.enhanced && !m.unique && state.monsters.has(m.monster));
}

/** Il mostro diventa potenziato, dello stesso tipo: mantiene id, casella, bottino e immagini. */
export function upgradeMonster(state: GameState, old: Piece): void {
  const heroes = state.pieces.filter((p) => p.team === 'hero').length;
  const [fresh] = createPieces([{ id: old.id, team: 'monster', monster: old.monster!, enhanced: true, x: old.cell.x, y: old.cell.y }], new Map(), state.items, state.monsters, heroes);
  Object.assign(old, { ...fresh, cell: old.cell, size: old.size, awake: true, drop: old.drop, chestTier: old.chestTier, portrait: old.portrait, portraitFull: old.portraitFull });
}

/** Un'area si rivela: i suoi mostri si svegliano e agiscono le carte Potere in gioco (con il Maligno a mano, `evilManual`, le sceglie lui: la scena chiede). */
export function revealArea(state: GameState, board: Board, area: string): AreaResult {
  const result: AreaResult = { spawned: [], upgraded: [] };
  const inArea = monstersIn(state, board, area);
  for (const m of inArea) m.awake = true;
  if (!inArea.length || state.evilManual) return result;
  const heroes = state.pieces.filter((p) => p.team === 'hero').length;
  const make = (monster: string, enhanced: boolean, id: string, cell: Cell) =>
    createPieces([{ id, team: 'monster', monster, enhanced, x: cell.x, y: cell.y }], new Map(), state.items, state.monsters, heroes)[0];

  // Abile comandante: un mostro qualunque dell'area (non unico, non già potenziato) diventa potenziato, dello stesso tipo.
  if (state.evil.inPlay.includes('able-commander')) {
    const options = upgradeOptions(state, inArea);
    if (options.length) {
      const old = options[Math.floor(state.random() * options.length)];
      upgradeMonster(state, old);
      result.upgraded.push(old);
    }
  }

  // Orda di Creature: 2 mostri in più di un tipo a scelta, accanto a un mostro dell'area.
  if (state.evil.inPlay.includes('horde')) {
    const monster = HORDE_TYPES[Math.floor(state.random() * HORDE_TYPES.length)];
    const def = state.monsters.get(monster);
    if (def) {
      for (let n = 0; n < 2; n++) {
        const cell = hordeCell(state, board, def.size, inArea);
        if (!cell) break;
        const piece = make(monster, false, newMonsterId(state, monster), cell);
        piece.awake = true;
        state.pieces.push(piece);
        result.spawned.push(piece);
      }
    }
  }
  return result;
}

/** Una casella libera dove sta un mostro di questa dimensione, adiacente a uno dei mostri dell'area (a caso). */
function hordeCell(state: GameState, board: Board, size: { w: number; h: number }, near: readonly Piece[]): Cell | null {
  const options = hordeAnchors(state, board, size, near);
  return options.length ? options[Math.floor(state.random() * options.length)] : null;
}

/** Tutte le caselle (in alto a sinistra) dove può stare un mostro di questa dimensione, libere e adiacenti a uno dei mostri dell'area: dove il Maligno può piazzare l'Orda di Creature. */
export function hordeAnchors(state: GameState, board: Board, size: { w: number; h: number }, near: readonly Piece[]): Cell[] {
  const taken = new Set(state.pieces.filter((p) => !p.city).flatMap((p) => footprint(p).map(cellKey)));
  const anchors = near.flatMap((m) => footprint(m));
  const options: Cell[] = [];
  for (const a of anchors) {
    for (let dx = -size.w; dx <= 1; dx++) {
      for (let dy = -size.h; dy <= 1; dy++) {
        const cell = { x: a.x + dx, y: a.y + dy };
        const cells = footprint({ cell, size });
        if (options.some((o) => o.x === cell.x && o.y === cell.y)) continue;
        const ok = cells.every((c) => board.isWalkable(c) && !taken.has(cellKey(c)) && !board.obstacleAt(c) && !board.markerAt(c));
        const touches = cells.some((c) => anchors.some((m) => Math.max(Math.abs(c.x - m.x), Math.abs(c.y - m.y)) <= 1));
        if (ok && touches) options.push(cell);
      }
    }
  }
  return options;
}
