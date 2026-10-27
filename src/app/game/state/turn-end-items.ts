import { Piece, footprint } from '../pieces/piece';
import type { GameState } from './game-state';
import { immuneTo, inflictStatus } from './status';

/**
 * Oggetti che si usano al termine del turno dell'eroe (per ora il Flauto del riposo: "scarta questa carta al termine del tuo turno per piazzare 1 segnalino
 * stordito su ogni mostro entro 6 spazi dal tuo eroe"). Si propongono quando l'eroe passa il turno; chi li ha, nello zaino o equipaggiati, può usarli.
 */
export interface TurnEndItem {
  id: string;
  name: string;
  /** Entro quanti spazi dal suo eroe (le caselle in diagonale contano 1). */
  range: number;
  /** Quanti segnalini stordito piazza su ogni mostro. */
  amount: number;
}

interface TurnEndEffect {
  kind?: string;
  op?: string;
  range?: number;
  amount?: number;
}

/** Gli oggetti di fine turno che `piece` ha (equipaggiati o nello zaino). */
export function turnEndItems(state: GameState, piece: Piece): TurnEndItem[] {
  const out: TurnEndItem[] = [];
  for (const id of [...piece.equipped, ...piece.backpack]) {
    const def = state.items.get(id);
    const e = (def?.effects as TurnEndEffect[] | undefined)?.find((x) => x.kind === 'turnEnd' && x.op === 'stunNearby');
    if (def && e) out.push({ id, name: def.name, range: e.range ?? 6, amount: e.amount ?? 1 });
  }
  return out;
}

/** Usa l'oggetto: lo scarta e stordisce i mostri entro il raggio (quelli immuni o con un nome no). Restituisce chi è stordito e chi è immune. */
export function useTurnEndItem(state: GameState, piece: Piece, id: string): { stunned: Piece[]; immune: Piece[] } | null {
  const item = turnEndItems(state, piece).find((i) => i.id === id);
  if (!item) return null;
  for (const list of [piece.equipped, piece.backpack]) {
    const i = list.indexOf(id);
    if (i >= 0) {
      list.splice(i, 1);
      break;
    }
  }
  const stunned: Piece[] = [];
  const immune: Piece[] = [];
  for (const m of state.pieces) {
    if (m.team !== 'monster' || m.city) continue;
    const near = footprint(m).some((c) => footprint(piece).some((h) => Math.max(Math.abs(c.x - h.x), Math.abs(c.y - h.y)) <= item.range));
    if (!near) continue;
    if (immuneTo(state, m, 'stun')) immune.push(m);
    else if (inflictStatus(state, m, 'stun', item.amount)) stunned.push(m);
  }
  return { stunned, immune };
}
