import { DOOR_MOVE_COST, DOOR_PICK_COST } from '../constants';
import { Party } from '../party';
import { Door, RuneColor, isLocked } from './door';

/** Cosa succede se un eroe usa questa porta adesso, e quanto costa in punti movimento. */
export type DoorAction =
  | { kind: 'open'; cost: number }
  | { kind: 'close'; cost: number }
  /** Si apre una serratura con la chiave giusta (normale o runica) e la porta si apre. */
  | { kind: 'unlock'; cost: number }
  /** Si scassina la serratura di una porta a chiave e la porta si apre. */
  | { kind: 'pick'; cost: number }
  | { kind: 'denied'; needs: 'key' | 'rune' | 'event'; color?: RuneColor };

/**
 * Le regole d'uso di una porta, senza nulla di grafico:
 * - aperta: si chiude; chiusa e libera: si apre (DOOR_MOVE_COST);
 * - a chiave: con la chiave giusta si apre (DOOR_MOVE_COST), altrimenti si scassina (DOOR_PICK_COST) se `pickable`;
 * - runica: si apre solo con la chiave runica del colore giusto, non si scassina mai.
 */
export function doorAction(door: Door, party: Party): DoorAction {
  if (door.open) return { kind: 'close', cost: DOOR_MOVE_COST };
  if (!isLocked(door)) return { kind: 'open', cost: DOOR_MOVE_COST };
  const lock = door.lock!;
  if (lock.kind === 'event') return { kind: 'denied', needs: 'event' };
  if (lock.kind === 'rune') {
    return party.runeKeys.has(lock.color) ? { kind: 'unlock', cost: DOOR_MOVE_COST } : { kind: 'denied', needs: 'rune', color: lock.color };
  }
  if (party.keys.has(lock.keyId)) return { kind: 'unlock', cost: DOOR_MOVE_COST };
  if (lock.pickable !== false) return { kind: 'pick', cost: DOOR_PICK_COST };
  return { kind: 'denied', needs: 'key' };
}
