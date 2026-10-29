import { Board } from '../board/board';
import { Loot, Marker } from '../board/marker';
import { RuneColor } from '../board/door';
import { COINS_PER_TOKEN, GLYPH_PROGRESS, POTION_LIMIT } from '../constants';
import { GameState } from '../state/game-state';
import { canReceiveItem, receiveItem } from '../state/actions';
import { Piece } from '../pieces/piece';
import { runEvents } from '../state/events';

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
 * Gli oggetti a terra non reagiscono: si raccolgono con l'azione `pickUp`.
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
  return null; // gli oggetti a terra non si raccolgono passando: è un'azione (`pickUp`)
}

/** Un segnalino che si può raccogliere da terra. */
export type PickupMarker = Extract<Marker, { type: 'potion' | 'coins' | 'key' | 'rune' | 'item' }>;

/** L'oggetto a terra nella casella di `piece`, se ce n'è uno. */
export function pickupAt(board: Board, piece: Piece): PickupMarker | null {
  const m = board.markerAt(piece.cell);
  return m && (m.type === 'potion' || m.type === 'coins' || m.type === 'key' || m.type === 'rune' || m.type === 'item') && !m.collected ? m : null;
}

/** Il nome con cui l'oggetto compare nel menu ("Pozione curativa", "Denaro"…). */
export function pickupName(state: GameState, m: PickupMarker): string {
  if (m.type === 'potion') return POTION_NAMES[m.kind];
  if (m.type === 'coins') return 'Denaro';
  if (m.type === 'key') return 'Chiave';
  if (m.type === 'rune') return `Chiave runica ${RUNE_NAMES[m.color]}`;
  return state.items.get(m.itemId)?.name ?? 'Oggetto';
}

/** Perché `piece` non può raccogliere l'oggetto (null se può). */
export function pickupBlocked(state: GameState, piece: Piece, m: PickupMarker): string | null {
  if (m.type === 'potion' && piece.potions.length >= POTION_LIMIT) return `Porti già ${POTION_LIMIT} pozioni`;
  if (m.type === 'item' && !canReceiveItem(state, piece, m.itemId)) return `${piece.name} non ha posto`;
  return null;
}

/**
 * Un eroe raccoglie l'oggetto della sua casella (azione del menu, senza costo). L'oggetto sparisce dalla mappa.
 * Restituisce cosa è successo (`picked-up` o `pickup-blocked`), o null se non c'è niente da raccogliere.
 */
export function pickUp(board: Board, piece: Piece, state: GameState): MarkerEvent | null {
  const marker = pickupAt(board, piece);
  if (!marker || piece.team !== 'hero') return null;
  const blocked = pickupBlocked(state, piece, marker);
  if (blocked) return { kind: 'pickup-blocked', marker, notice: `${blocked}: ${pickupName(state, marker).toLowerCase()} resta a terra` };
  let notice: string;
  if (marker.type === 'potion') {
    piece.potions.push(marker.kind);
    notice = `${POTION_NAMES[marker.kind]} raccolta (${piece.potions.length}/${POTION_LIMIT})`;
  } else if (marker.type === 'coins') {
    notice = collectLoot(state, [{ kind: 'coins' }])[0];
  } else if (marker.type === 'item') {
    const item = state.items.get(marker.itemId);
    if (!item) return null;
    notice = `${item.name} raccolto (${receiveItem(state, piece, marker.itemId) === 'equipped' ? 'equipaggiato' : 'nello zaino'})`;
  } else if (marker.type === 'key') {
    notice = collectLoot(state, [{ kind: 'key', keyId: marker.keyId }])[0];
  } else {
    notice = collectLoot(state, [{ kind: 'rune', color: marker.color }])[0];
  }
  marker.collected = true;
  board.removeMarker(marker);
  if (marker.id) runEvents(state, { kind: 'pickedUp', markerId: marker.id }, undefined, { actor: piece.id }); // gli eventi "raccoglie", dopo che l'oggetto è andato all'eroe
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
    if (l.kind === 'curse') {
      // Ogni Maledizione dà al Signore supremo tanta Minaccia quanti sono gli eroi (docs/REGOLE.md, sezione 3c).
      const threat = l.amount * state.pieces.filter((p) => p.team === 'hero').length;
      state.overlord.threat += threat;
      return `Maledizione ×${l.amount}: il Signore supremo guadagna ${threat} Minaccia`;
    }
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
