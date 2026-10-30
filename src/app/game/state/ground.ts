import { tr } from '../../i18n/catalog-text';
import { Cell, cellKey } from '../board/board';
import { obstacleCells } from '../board/obstacle';
import { Piece, footprint } from '../pieces/piece';
import type { GameState } from './game-state';

/**
 * Le caselle dove si possono lasciare `count` oggetti a terra: prima quelle di `own` (la sagoma di chi li lascia), poi quelle intorno, sempre più lontane, finché ce ne sono abbastanza. Una casella
 * va bene se sta su un tile, senza ostacoli né altri oggetti né creature (tranne `except`, chi sta lasciando l'oggetto: la sua casella conta come libera). Se la mappa non è nota si usa solo `fallback`;
 * se non c'è posto gli ultimi si sovrappongono a `fallback`.
 */
/** La casella è libera per lasciarci un oggetto: su un tile, senza ostacoli, segnalini né creature (tranne `except`). */
export function isGroundFree(state: GameState, c: Cell, except?: Piece): boolean {
  const board = state.board;
  if (!board || !board.isWalkable(c)) return false;
  const key = cellKey(c);
  if (state.markers.some((m) => !('collected' in m && m.collected) && cellKey(m) === key)) return false;
  if (state.obstacles.some((o) => obstacleCells(o).some((oc) => cellKey(oc) === key))) return false;
  return !state.pieces.some((p) => p !== except && !p.city && footprint(p).some((pc) => cellKey(pc) === key));
}

export function groundCells(state: GameState, own: readonly Cell[], fallback: Cell, count: number, except?: Piece): Cell[] {
  const board = state.board;
  if (!board) return Array.from({ length: count }, () => ({ ...fallback }));
  const taken = new Set([
    ...state.markers.filter((m) => !('collected' in m && m.collected)).map((m) => `${m.x},${m.y}`),
    ...state.obstacles.flatMap((o) => obstacleCells(o)).map((c) => `${c.x},${c.y}`),
    ...state.pieces.filter((p) => p !== except && !p.city).flatMap((p) => footprint(p)).map((c) => `${c.x},${c.y}`),
  ]);
  const free = (c: Cell) => board.isWalkable(c) && !taken.has(cellKey(c));
  const out: Cell[] = [];
  const seen = new Set<string>();
  const add = (c: Cell) => {
    const k = cellKey(c);
    if (seen.has(k)) return;
    seen.add(k);
    if (free(c) && out.length < count) out.push(c);
  };
  own.forEach(add);
  const minX = Math.min(...own.map((c) => c.x));
  const maxX = Math.max(...own.map((c) => c.x));
  const minY = Math.min(...own.map((c) => c.y));
  const maxY = Math.max(...own.map((c) => c.y));
  for (let ring = 1; ring <= 4 && out.length < count; ring++) {
    for (let y = minY - ring; y <= maxY + ring; y++) {
      for (let x = minX - ring; x <= maxX + ring; x++) {
        if (x > minX - ring && x < maxX + ring && y > minY - ring && y < maxY + ring) continue; // solo il bordo dell'anello
        add({ x, y });
      }
    }
  }
  while (out.length < count) out.push({ ...fallback });
  return out;
}

/**
 * Chi porta degli oggetti trasportati (`ItemDef.carried`: la Principessa...) li lascia a terra dove si trova: succede quando muore. Restituisce i nomi di quelli lasciati; la scena ridisegna
 * la mappa (`events.groundItems`).
 */
export function dropCarriedItems(state: GameState, piece: Piece): string[] {
  const ids = (piece.equipped ?? []).filter((id) => state.items.get(id)?.carried);
  if (!ids.length) return [];
  const spots = groundCells(state, footprint(piece), piece.cell, ids.length, piece);
  const names: string[] = [];
  ids.forEach((id, i) => {
    piece.equipped.splice(piece.equipped.indexOf(id), 1);
    state.markers.push({ type: 'item', itemId: id, x: spots[i].x, y: spots[i].y });
    names.push(state.items.get(id)?.name ?? tr('Un oggetto'));
  });
  state.events.groundItems = true;
  return names;
}
