import { tr } from '../../i18n/catalog-text';
import { Board } from '../board/board';
import type { Familiar } from '../familiars/familiar';
import { PickupMarker, pickupAt, pickupBlocked, pickupName, receivePickup } from '../markers/marker-rules';
import { Piece, footprint } from '../pieces/piece';
import { groundCells } from './ground';
import { runEvents } from './events';
import type { ContextAction } from './actions';
import type { GameState } from './game-state';

/**
 * Portare un oggetto (Ying e Yang, effetto `carry`): un famiglio raccoglie l'oggetto della sua casella (qualunque segnalino da terra: pozione, denaro, chiave, chiave runica, oggetto)
 * e ne porta uno solo. Raccogliere è gratis; cederlo a un eroe vicino o lasciarlo a terra costa 1 punto movimento **del famiglio** (l'eroe potrebbe aver già finito il turno).
 */
export const FAMILIAR_CARRY_COST = 1;

/** L'oggetto a terra che il famiglio può raccogliere adesso, se non ne porta già uno. */
export function carryTarget(board: Board, fam: Familiar): PickupMarker | null {
  return fam.carried ? null : pickupAt(board, fam);
}

/** Raccoglie l'oggetto della casella: sparisce dalla mappa e il famiglio lo porta. Restituisce il suo nome, o null se non c'era niente. */
export function familiarPickUp(state: GameState, board: Board, fam: Familiar): string | null {
  const marker = carryTarget(board, fam);
  if (!marker) return null;
  const name = pickupName(state, marker);
  fam.carried = { ...marker, collected: undefined } as PickupMarker;
  marker.collected = true;
  board.removeMarker(marker);
  return name;
}

/** Gli eroi a cui il famiglio può cedere l'oggetto: nella sua casella o in una adiacente (senza un muro in mezzo). */
export function giveTargets(state: GameState, board: Board, fam: Familiar): Piece[] {
  return state.pieces.filter((p) => p.team === 'hero' && !p.city && p.wounds > 0 && footprint(p).some((c) => (c.x === fam.cell.x && c.y === fam.cell.y) || board.canStep(fam.cell, c)));
}

/** Perché l'eroe non può ricevere l'oggetto (null se può). */
export function giveBlocked(state: GameState, hero: Piece, fam: Familiar): string | null {
  const m = fam.carried;
  return m && (m.type === 'potion' || m.type === 'coins' || m.type === 'key' || m.type === 'rune' || m.type === 'item') ? pickupBlocked(state, hero, m) : null;
}

/** Cede l'oggetto a un eroe (come se lo avesse raccolto lui, compresi gli eventi "raccoglie"). Restituisce la frase, o null se non si può. */
export function familiarGive(state: GameState, hero: Piece, fam: Familiar): string | null {
  const m = fam.carried;
  if (!m || giveBlocked(state, hero, fam)) return null;
  const notice = receivePickup(state, hero, m as PickupMarker);
  if (notice === null) return null;
  fam.carried = undefined;
  if (m.type !== 'glyph' && 'id' in m && m.id) runEvents(state, { kind: 'pickedUp', markerId: m.id }, undefined, { actor: hero.id });
  return notice;
}

/** Lascia l'oggetto a terra, nella casella del famiglio (o nella più vicina libera: un solo segnalino per casella). */
export function familiarDrop(state: GameState, fam: Familiar): boolean {
  const m = fam.carried;
  if (!m) return false;
  const [spot] = groundCells(state, [fam.cell], fam.cell, 1);
  state.markers.push({ ...m, x: spot.x, y: spot.y });
  state.events.groundItems = true;
  fam.carried = undefined;
  return true;
}

export const carriedName = (state: GameState, fam: Familiar): string => (fam.carried && 'type' in fam.carried && fam.carried.type !== 'glyph' && fam.carried.type !== 'chest' && fam.carried.type !== 'stairs' && fam.carried.type !== 'encounter' ? pickupName(state, fam.carried as PickupMarker) : tr('Oggetto'));

/** Il nome dell'icona di un oggetto a terra. */
function pickupIcon(state: GameState, m: PickupMarker): string {
  return m.type === 'item' ? state.items.get(m.itemId)?.icon ?? 'inventory_2' : { potion: 'tokens/potion', coins: 'tokens/gold_pile', key: 'tokens/little_key', rune: 'tokens/rune_key' }[m.type];
}

/**
 * Il menu contestuale di un famiglio che porta oggetti (lo stesso `app-context-menu` degli eroi, con le stesse azioni): Raccogli (gratis), Cedi a un eroe vicino e Lascia a terra
 * (1 punto movimento del famiglio ciascuno). `points` sono i punti che gli restano in questo spostamento.
 */
export function familiarContextActions(state: GameState, board: Board, fam: Familiar, points: number): ContextAction[] {
  const out: ContextAction[] = [];
  const name = state.familiarDefs.get(fam.id)?.name ?? '';
  const target = carryTarget(board, fam);
  if (target) out.push({ id: 'fpick', kind: 'pickup', icon: pickupIcon(state, target), label: tr('Raccogli: {name}', { name: pickupName(state, target).toLowerCase() }), cost: 0, enabled: true });
  const m = fam.carried;
  if (m && (m.type === 'potion' || m.type === 'coins' || m.type === 'key' || m.type === 'rune' || m.type === 'item')) {
    const what = pickupName(state, m).toLowerCase();
    const icon = pickupIcon(state, m);
    const noPoints = points < FAMILIAR_CARRY_COST ? tr('{name} non ha più punti movimento', { name }) : undefined;
    for (const hero of giveTargets(state, board, fam)) {
      const reason = noPoints ?? giveBlocked(state, hero, fam) ?? undefined;
      out.push({ id: `fgive:${hero.id}`, kind: 'item', icon, label: tr('Dai a {name}: {name2}', { name: hero.name, name2: what }), cost: FAMILIAR_CARRY_COST, enabled: !reason, reason });
    }
    out.push({ id: 'fdrop', kind: 'item', icon, label: tr('Lascia a terra: {name}', { name: what }), cost: FAMILIAR_CARRY_COST, enabled: !noPoints, reason: noPoints });
  }
  return out;
}
