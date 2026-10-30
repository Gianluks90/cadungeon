import { translate } from '../i18n/i18n.service';
import { MapData } from '../game/map/map-data';

export type ParsedAdventure = { ok: true; map: MapData } | { ok: false; reason: string };

/**
 * Legge il testo di un file di avventura (l'export dell'editor) per metterlo al posto della mappa a schermo. Controlla solo che sia un'avventura che l'editor sa disegnare:
 * l'avventura può essere incompleta (la Verifica dice cosa manca) ma i tipi di tessera devono essere quelli del catalogo (`knownTiles`).
 */
export function parseAdventure(text: string, knownTiles: ReadonlySet<string>): ParsedAdventure {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: translate('import.invalidJson') };
  }
  const map = data as Partial<MapData> | null;
  if (!map || typeof map !== 'object' || typeof map.seed !== 'number' || !Array.isArray(map.tiles) || map.tiles.some((t) => typeof t?.tile !== 'string' || typeof t.x !== 'number' || typeof t.y !== 'number' || typeof t.rot !== 'number')) {
    return { ok: false, reason: translate('import.notAdventure') };
  }
  const unknown = [...new Set(map.tiles.map((t) => t.tile).filter((id) => !knownTiles.has(id)))];
  if (unknown.length) return { ok: false, reason: translate('import.unknownTiles', { list: unknown.join(', ') }) };
  return { ok: true, map: map as MapData };
}

/** Gli elementi di un'avventura che il motore (o l'account) non riconosce: nemici di un tipo che il catalogo non ha, oggetti a terra che non conosce. */
export interface MissingReport {
  monsters: { id: string; type: string; x: number; y: number }[];
  items: { itemId: string; x: number; y: number }[];
}

export const missingTotal = (r: MissingReport | null) => (r ? r.monsters.length + r.items.length : 0);

/** Cosa non si riconosce. Con `itemIds` nullo (catalogo degli oggetti non ancora caricato) gli oggetti si considerano noti. */
export function findMissing(map: MapData, monsterIds: ReadonlySet<string>, itemIds: ReadonlySet<string> | null): MissingReport {
  return {
    monsters: (map.pieces ?? []).flatMap((p) => (p.team === 'monster' && p.monster && !monsterIds.has(p.monster) ? [{ id: p.id, type: p.monster, x: p.x, y: p.y }] : [])),
    items: (map.markers ?? []).flatMap((m) => (m.type === 'item' && itemIds && !itemIds.has(m.itemId) ? [{ itemId: m.itemId, x: m.x, y: m.y }] : [])),
  };
}

/**
 * Applica la scelta dell'utente: `remove` toglie gli elementi non riconosciuti; `keep` li conserva come segnaposto, ridotti a quello che serve per sostituirli (tipo, posizione e,
 * se c'era, la dimensione: il resto, come bonus, nome e bottino, va perso). L'id della pedina resta, così obiettivo ed eventi che la citano restano validi.
 */
export function resolveMissing(map: MapData, report: MissingReport, mode: 'remove' | 'keep'): MapData {
  const lostPieces = new Set(report.monsters.map((m) => m.id));
  const lostItems = new Set(report.items.map((i) => `${i.itemId}@${i.x},${i.y}`));
  const pieces = (map.pieces ?? []).flatMap((p) => (!lostPieces.has(p.id) ? [p] : mode === 'keep' ? [{ id: p.id, team: p.team, monster: p.monster, x: p.x, y: p.y, ...(p.size ? { size: p.size } : {}) }] : []));
  const markers = (map.markers ?? []).flatMap((m) => (m.type !== 'item' || !lostItems.has(`${m.itemId}@${m.x},${m.y}`) ? [m] : mode === 'keep' ? [{ type: 'item' as const, itemId: m.itemId, x: m.x, y: m.y }] : []));
  return { ...map, ...(map.pieces ? { pieces } : {}), ...(map.markers ? { markers } : {}) };
}
