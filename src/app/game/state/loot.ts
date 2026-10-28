import { Loot } from '../board/marker';
import { collectLoot } from '../markers/marker-rules';
import { Piece, footprint } from '../pieces/piece';
import { obstacleCells } from '../board/obstacle';
import { canReceiveItem, drawTreasures, receiveItem } from './actions';
import { runEvents, scheduleRevival } from './events';
import type { GameState } from './game-state';

/**
 * Quando un mostro esce dalla mappa (ucciso in qualunque modo): lascia il suo bottino (`drop`, scritto nell'avventura) e, se era l'obiettivo, la partita è vinta.
 * Chiavi, chiavi runiche, Conquista e denaro vanno al gruppo come negli scrigni; un oggetto va a chi ha dato il colpo fatale se ha posto (altrimenti, o se è morto
 * per altre cause, resta a terra: nella casella del mostro e, se sono più d'uno, nelle caselle libere intorno).
 */
export interface RemovalResult {
  /** Le righe da mostrare ("Chiave trovata...", "Spada di luce (nello zaino)"). */
  lines: string[];
  /** È comparso un oggetto a terra: la scena ridisegna gli oggetti sulla mappa. */
  groundItems: boolean;
  /** Un evento ha deciso che il mostro non muore: ha lasciato la mappa e tornerà in vita (niente bottino, niente vittoria). */
  revived?: boolean;
  /** Le pedine a cui gli eventi hanno cambiato i valori: la scena le ridisegna. */
  modified?: Piece[];
}

/**
 * Le caselle dove cadono gli oggetti di un mostro morto: prima le sue (ora libere), poi quelle intorno, sempre più lontane, finché ce ne sono abbastanza. Una casella va bene se sta
 * su un tile, senza ostacoli né altri oggetti né creature. Se la mappa non è nota si usa solo la casella del mostro.
 */
function dropCells(state: GameState, monster: Piece, count: number): { x: number; y: number }[] {
  const board = state.board;
  const own = footprint(monster);
  if (!board) return Array.from({ length: count }, () => ({ ...monster.cell }));
  const taken = new Set([...state.markers.map((m) => `${m.x},${m.y}`), ...state.obstacles.flatMap((o) => obstacleCells(o)).map((c) => `${c.x},${c.y}`), ...state.pieces.flatMap((p) => footprint(p)).map((c) => `${c.x},${c.y}`)]);
  const free = (c: { x: number; y: number }) => board.isWalkable(c) && !taken.has(`${c.x},${c.y}`);
  const out: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  const add = (c: { x: number; y: number }) => {
    const k = `${c.x},${c.y}`;
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
  while (out.length < count) out.push({ ...monster.cell }); // niente posto: gli ultimi si sovrappongono alla casella del mostro
  return out;
}

/**
 * Toglie il mostro dallo stato (se c'è ancora). Prima scattano gli eventi "sconfitto" di quella pedina: se uno la fa tornare in vita (`revive`) il mostro aspetta fuori dalla mappa e
 * non lascia niente; altrimenti dà il suo bottino e si controlla la vittoria (`settleRemoval`).
 */
export function removeMonster(state: GameState, monster: Piece, killer?: Piece): RemovalResult {
  const report = runEvents(state, { kind: 'defeated', pieceId: monster.id }, monster);
  const i = state.pieces.indexOf(monster);
  if (i >= 0) state.pieces.splice(i, 1);
  if (report.revive) {
    scheduleRevival(state, monster, report.revive);
    return { lines: [], groundItems: false, revived: true, modified: report.modified };
  }
  return { ...settleRemoval(state, monster, killer), ...(report.modified.length ? { modified: report.modified } : {}) };
}

/** Il mostro è morto davvero (e già fuori dallo stato): lascia il bottino e si controlla la vittoria. */
export function settleRemoval(state: GameState, monster: Piece, killer?: Piece): RemovalResult {
  const lines: string[] = [];
  let groundItems = false;
  const rest: Loot[] = [];
  const spots = dropCells(state, monster, (monster.drop ?? []).filter((l) => l.kind === 'item').length);
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
      const spot = spots.shift() ?? monster.cell;
      state.markers.push({ type: 'item', itemId: l.itemId, x: spot.x, y: spot.y });
      groundItems = true;
      lines.push(`${item?.name ?? 'Un oggetto'} cade a terra`);
    }
  }
  lines.push(...collectLoot(state, rest, killer));
  if (monster.chestTier) {
    // Un Mimic morto "si apre": il tesoro casuale del suo scrigno va a ogni eroe, e quel tipo di scrigno conta come aperto.
    if (!state.openedTiers.includes(monster.chestTier)) state.openedTiers.push(monster.chestTier);
    for (let i = 0; i < (monster.chestDraws ?? 1); i++) lines.push(...drawTreasures(state, monster.chestTier));
  }
  monster.drop = undefined;
  state.checkVictory();
  return { lines, groundItems };
}
