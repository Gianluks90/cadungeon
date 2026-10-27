import { Board } from '../board/board';
import { Loot, Marker } from '../board/marker';
import { RuneColor } from '../board/door';
import { COINS_PER_TOKEN, GLYPH_PROGRESS, POTION_LIMIT } from '../constants';
import { GameState } from '../state/game-state';
import { canReceiveItem, receiveItem } from '../state/actions';
import { Piece } from '../pieces/piece';

/** Cosa è successo a un segnalino perché una pedina è entrata nella sua casella, e cosa dire al giocatore. */
export interface MarkerEvent {
  kind: 'glyph-activated' | 'picked-up' | 'pickup-blocked';
  marker: Marker;
  notice: string;
}

const RUNE_NAMES: Record<RuneColor, string> = { red: 'rossa', blue: 'blu', green: 'verde' };

/** Il nome di una pozione. */
export const POTION_NAMES = { heal: 'Pozione curativa', vital: 'Pozione di vitalità' } as const;

/**
 * La pedina `piece` è appena entrata nella sua casella (un passo, non per forza l'ultimo): ci sono segnalini che reagiscono?
 * - Glifo spento: lo accende un eroe, anche passandoci sopra. I mostri non lo accendono.
 * - Oggetto a terra (pozione, denaro, chiave, chiave runica): lo raccoglie un eroe, anche passandoci sopra, senza spendere punti
 *   movimento; sparisce dalla mappa. I mostri non raccolgono. Una pozione la raccoglie solo chi ne porta meno di POTION_LIMIT:
 *   se ne ha già tre resta a terra.
 * Restituisce cosa è cambiato, così chi chiama può avvisare e ridisegnare, o null se non è successo niente.
 */
export function enterCell(board: Board, piece: Piece, state: GameState): MarkerEvent | null {
  const marker = board.markerAt(piece.cell);
  if (!marker || piece.team !== 'hero') return null;
  if (marker.type === 'glyph') {
    if (marker.active) return null;
    marker.active = true;
    state.addProgress(GLYPH_PROGRESS);
    return { kind: 'glyph-activated', marker, notice: `Glifo acceso · +${GLYPH_PROGRESS} alla Conquista` };
  }
  if (marker.type === 'chest' || marker.type === 'stairs' || marker.type === 'encounter') return null; // l'incontro non si raccoglie: per ora è solo un segno sulla mappa

  let notice: string;
  if (marker.type === 'potion') {
    const name = POTION_NAMES[marker.kind];
    if (piece.potions.length >= POTION_LIMIT) return { kind: 'pickup-blocked', marker, notice: `Porti già ${POTION_LIMIT} pozioni: ${name.toLowerCase()} resta a terra` };
    piece.potions.push(marker.kind);
    notice = `${name} raccolta (${piece.potions.length}/${POTION_LIMIT})`;
  } else if (marker.type === 'coins') {
    notice = collectLoot(state, [{ kind: 'coins' }])[0];
  } else if (marker.type === 'item') {
    const item = state.items.get(marker.itemId);
    if (!item) return null;
    if (!canReceiveItem(state, piece, marker.itemId)) return { kind: 'pickup-blocked', marker, notice: `${piece.name} non ha posto: ${item.name} resta a terra` };
    notice = `${item.name} raccolto (${receiveItem(state, piece, marker.itemId) === 'equipped' ? 'equipaggiato' : 'nello zaino'})`;
  } else if (marker.type === 'key') {
    notice = collectLoot(state, [{ kind: 'key', keyId: marker.keyId }])[0];
  } else {
    notice = collectLoot(state, [{ kind: 'rune', color: marker.color }])[0];
  }
  marker.collected = true;
  board.removeMarker(marker);
  return { kind: 'picked-up', marker, notice };
}

/** Dà al gruppo il contenuto di uno scrigno e dice cosa c'era, una frase per premio. Gli oggetti (`item`) li riceve `receiver`, chi apre lo scrigno. */
export function collectLoot(state: GameState, loot: readonly Loot[], receiver?: Piece): string[] {
  const party = state.party;
  return loot.map((l) => {
    if (l.kind === 'progress') {
      state.addProgress(l.amount);
      return `+${l.amount} alla Conquista`;
    }
    if (l.kind === 'coins') {
      const amount = l.amount ?? COINS_PER_TOKEN;
      for (const hero of state.pieces) if (hero.team === 'hero') hero.coins += amount;
      return `Denaro: +${amount} monete a ogni eroe`;
    }
    if (l.kind === 'curse') return `Maledizione ×${l.amount} (non ancora in gioco)`;
    if (l.kind === 'item') {
      const item = state.items.get(l.itemId);
      if (!item || !receiver) return 'Un oggetto sconosciuto';
      const where = receiveItem(state, receiver, l.itemId);
      return where === 'none' ? `${item.name}: ${receiver.name} non ha posto` : `${item.name} (${where === 'equipped' ? 'equipaggiato' : 'nello zaino'})`;
    }
    if (l.kind === 'key') {
      party.keys.add(l.keyId);
      return 'Chiave trovata: apre una porta chiusa a chiave';
    }
    party.runeKeys.add(l.color);
    return `Chiave runica ${RUNE_NAMES[l.color]}: le porte di quel colore si sbloccano`;
  });
}
