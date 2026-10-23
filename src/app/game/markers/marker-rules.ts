import { Board } from '../board/board';
import { Loot, Marker } from '../board/marker';
import { RuneColor } from '../board/door';
import { COINS_PER_TOKEN } from '../constants';
import { Party } from '../party';
import { Piece } from '../pieces/piece';

/** Cosa è successo a un segnalino perché una pedina è entrata nella sua casella, e cosa dire al giocatore. */
export interface MarkerEvent {
  kind: 'glyph-activated' | 'picked-up';
  marker: Marker;
  notice: string;
}

const RUNE_NAMES: Record<RuneColor, string> = { red: 'rossa', blue: 'blu', green: 'verde' };

/**
 * La pedina `piece` è appena entrata nella sua casella (un passo, non per forza l'ultimo): ci sono segnalini che reagiscono?
 * - Glifo spento: lo accende un eroe, anche passandoci sopra. I mostri non lo accendono.
 * - Oggetto a terra (pozione, denaro, chiave, chiave runica): lo raccoglie un eroe, anche passandoci sopra, senza spendere punti
 *   movimento; sparisce dalla mappa. I mostri non raccolgono.
 * Restituisce cosa è cambiato, così chi chiama può avvisare e ridisegnare, o null se non è successo niente.
 */
export function enterCell(board: Board, piece: Piece, party: Party): MarkerEvent | null {
  const marker = board.markerAt(piece.cell);
  if (!marker || piece.team !== 'hero') return null;
  if (marker.type === 'glyph') {
    if (marker.active) return null;
    marker.active = true;
    return { kind: 'glyph-activated', marker, notice: 'Glifo acceso' };
  }
  if (marker.type === 'chest') return null;

  let notice: string;
  if (marker.type === 'potion') {
    // Senza inventario la pozione svanisce subito, senza effetto.
    notice = `${marker.kind === 'heal' ? 'Pozione curativa' : 'Pozione di vitalità'} raccolta (per ora svanisce: manca l'inventario)`;
  } else if (marker.type === 'coins') {
    notice = collectLoot(party, [{ kind: 'coins' }])[0];
  } else if (marker.type === 'key') {
    notice = collectLoot(party, [{ kind: 'key', keyId: marker.keyId }])[0];
  } else {
    notice = collectLoot(party, [{ kind: 'rune', color: marker.color }])[0];
  }
  marker.collected = true;
  board.removeMarker(marker);
  return { kind: 'picked-up', marker, notice };
}

/** Dà al gruppo il contenuto di uno scrigno e dice cosa c'era, una frase per premio. */
export function collectLoot(party: Party, loot: readonly Loot[]): string[] {
  return loot.map((l) => {
    if (l.kind === 'progress') return `+${l.amount} al Progresso`; // il contatore del Progresso non c'è ancora
    if (l.kind === 'coins') {
      party.coins += COINS_PER_TOKEN;
      return `Denaro: +${COINS_PER_TOKEN} monete a ogni eroe (ora ${party.coins})`;
    }
    if (l.kind === 'key') {
      party.keys.add(l.keyId);
      return 'Chiave trovata: apre una porta chiusa a chiave';
    }
    party.runeKeys.add(l.color);
    return `Chiave runica ${RUNE_NAMES[l.color]}: le porte di quel colore si sbloccano`;
  });
}
