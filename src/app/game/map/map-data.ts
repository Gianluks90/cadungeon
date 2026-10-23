import { Door } from '../board/door';
import { Marker } from '../board/marker';
import { Obstacle } from '../board/obstacle';
import { PartyData } from '../party';
import { PieceData } from '../pieces/piece';
import { Rotation, TileDef, loadTileDef, rotateTile } from './tile';

/** Una riga della mappa salvata: quale tile, dove (in celle) e con quale rotazione. */
export interface MapTileRef {
  tile: string;
  x: number;
  y: number;
  rot: Rotation;
}

/** Il formato salvato della mappa: solo un elenco di tile e il seme per i dettagli. */
export interface MapData {
  seed: number;
  tiles: MapTileRef[];
  /** Porte: per ora stanno nel file della mappa, ma sono dati dell'avventura, non dei tile. */
  doors?: Door[];
  /** Ostacoli naturali (rocce, buche, acqua): dati dell'avventura. */
  obstacles?: Obstacle[];
  /** Segnalini sulla mappa (glifi, ...): dati dell'avventura. */
  markers?: Marker[];
  /** Pedine all'inizio: dati dell'avventura. Se mancano, parte un solo eroe. */
  pieces?: PieceData[];
  /** Progresso di partenza degli eroi (se manca, DEFAULT_PROGRESS). */
  progress?: number;
  /** Chiavi e chiavi runiche che il gruppo ha all'inizio (per le prove). */
  party?: PartyData;
}

/** Un tile già ruotato e collocato: x, y è l'angolo in alto a sinistra, in celle. */
export interface PlacedTile {
  def: TileDef;
  x: number;
  y: number;
}

export async function loadMap(url: string): Promise<{ data: MapData; placed: PlacedTile[] }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mappa "${url}" non trovata`);
  const data: MapData = await res.json();

  const ids = [...new Set(data.tiles.map((t) => t.tile))];
  const defs = new Map(await Promise.all(ids.map(async (id) => [id, await loadTileDef(id)] as const)));

  const placed = data.tiles.map((t) => ({
    def: rotateTile(defs.get(t.tile)!, t.rot),
    x: t.x,
    y: t.y,
  }));
  return { data, placed };
}
