import { Loot } from '../board/marker';
import { collectLoot } from '../markers/marker-rules';
import { Piece } from '../pieces/piece';
import { canReceiveItem, drawTreasures, receiveItem } from './actions';
import type { GameState } from './game-state';

/**
 * Quando un mostro esce dalla mappa (ucciso in qualunque modo): lascia il suo bottino (`drop`, scritto nell'avventura) e, se era l'obiettivo, la partita è vinta.
 * Chiavi, chiavi runiche, Progresso e denaro vanno al gruppo come negli scrigni; un oggetto va a chi ha dato il colpo fatale se ha posto (altrimenti, o se è morto
 * per altre cause, resta a terra dove è caduto il mostro).
 */
export interface RemovalResult {
  /** Le righe da mostrare ("Chiave trovata...", "Spada di luce (nello zaino)"). */
  lines: string[];
  /** È comparso un oggetto a terra: la scena ridisegna gli oggetti sulla mappa. */
  groundItems: boolean;
}

/** Toglie il mostro dallo stato (se c'è ancora), dà il suo bottino e controlla la vittoria. */
export function removeMonster(state: GameState, monster: Piece, killer?: Piece): RemovalResult {
  const i = state.pieces.indexOf(monster);
  if (i >= 0) state.pieces.splice(i, 1);
  const lines: string[] = [];
  let groundItems = false;
  const rest: Loot[] = [];
  for (const l of monster.drop ?? []) {
    if (l.kind !== 'item') {
      rest.push(l);
      continue;
    }
    const item = state.items.get(l.itemId);
    if (killer && killer.team === 'hero' && canReceiveItem(state, killer, l.itemId)) {
      const where = receiveItem(state, killer, l.itemId);
      lines.push(`${item?.name ?? 'Un oggetto'} (${where === 'equipped' ? 'equipaggiato' : 'nello zaino'})`);
    } else {
      state.markers.push({ type: 'item', itemId: l.itemId, x: monster.cell.x, y: monster.cell.y });
      groundItems = true;
      lines.push(`${item?.name ?? 'Un oggetto'} cade a terra`);
    }
  }
  lines.push(...collectLoot(state, rest, killer));
  if (monster.chestTier) {
    // Un Mimic morto "si apre": il tesoro casuale del suo scrigno va a ogni eroe, e quel tipo di scrigno conta come aperto.
    if (!state.openedTiers.includes(monster.chestTier)) state.openedTiers.push(monster.chestTier);
    lines.push(...drawTreasures(state, monster.chestTier));
  }
  monster.drop = undefined;
  state.checkVictory();
  return { lines, groundItems };
}
