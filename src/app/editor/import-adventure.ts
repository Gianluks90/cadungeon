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
    return { ok: false, reason: 'Il file non è un JSON valido.' };
  }
  const map = data as Partial<MapData> | null;
  if (!map || typeof map !== 'object' || typeof map.seed !== 'number' || !Array.isArray(map.tiles) || map.tiles.some((t) => typeof t?.tile !== 'string' || typeof t.x !== 'number' || typeof t.y !== 'number' || typeof t.rot !== 'number')) {
    return { ok: false, reason: "Il file non è un'avventura di CADungeon (mancano il seme o l'elenco delle tessere)." };
  }
  const unknown = [...new Set(map.tiles.map((t) => t.tile).filter((id) => !knownTiles.has(id)))];
  if (unknown.length) return { ok: false, reason: `Il file usa tessere che l'editor non conosce: ${unknown.join(', ')}.` };
  return { ok: true, map: map as MapData };
}
