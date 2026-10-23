import { Board } from '../board/board';
import { Marker } from '../board/marker';
import { Piece } from '../pieces/piece';

/** Cosa è successo a un segnalino perché una pedina è entrata nella sua casella. */
export interface MarkerEvent {
  kind: 'glyph-activated';
  marker: Marker;
}

/**
 * La pedina `piece` è appena entrata nella sua casella (un passo, non per forza l'ultimo): ci sono segnalini che reagiscono?
 * - Glifo spento: lo accende un eroe, anche passandoci sopra. I mostri non lo accendono.
 * Restituisce cosa è cambiato, così chi chiama può avvisare e ridisegnare, o null se non è successo niente.
 */
export function enterCell(board: Board, piece: Piece): MarkerEvent | null {
  const marker = board.markerAt(piece.cell);
  if (marker?.type === 'glyph' && piece.team === 'hero' && !marker.active) {
    marker.active = true;
    return { kind: 'glyph-activated', marker };
  }
  return null;
}
