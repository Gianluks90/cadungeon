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
  /** L'area a cui appartiene il tile (un id scelto dall'autore): i tile con lo stesso id formano un'area, per esempio una stanza o i corridoi fra un gruppo di porte. Senza, il tile non fa parte di nessuna area. */
  area?: string;
}

/** Il formato salvato della mappa: solo un elenco di tile e il seme per i dettagli. */
export interface MapData {
  seed: number;
  tiles: MapTileRef[];
  /** Le aree con un nome e un testo da leggere quando gli eroi le rivelano (facoltativo: un'area esiste anche solo con l'`area` scritta sui tile). */
  areas?: { id: string; name?: string; text?: string }[];
  /** Porte: per ora stanno nel file della mappa, ma sono dati dell'avventura, non dei tile. */
  doors?: Door[];
  /** Ostacoli naturali (rocce, buche, acqua): dati dell'avventura. */
  obstacles?: Obstacle[];
  /** Segnalini sulla mappa (glifi, ...): dati dell'avventura. */
  markers?: Marker[];
  /** Pedine all'inizio: dati dell'avventura. Se mancano, parte un solo eroe. */
  pieces?: PieceData[];
  /** Conquista di partenza degli eroi (se manca, DEFAULT_PROGRESS). */
  progress?: number;
  /** Chiavi e chiavi runiche che il gruppo ha all'inizio (per le prove). */
  party?: PartyData;
  /** L'obiettivo dell'avventura: sconfiggere una pedina (`pieceId`, di solito il boss). Quando non c'è più, gli eroi vincono; `text` è come lo si dice ai giocatori. */
  objective?: { kind: 'defeat'; pieceId: string; text?: string; description?: string };
  /** Il titolo dell'avventura e la sua introduzione (testo lungo): si leggono in una dialog prima di mettere in campo gli eroi. Senza `intro` e senza `start` la partita parte subito. */
  title?: string;
  intro?: string;
  /** Le torce appese ai muri: `x`, `y` è l'incrocio della griglia a cui sono agganciate (l'angolo in alto a sinistra della casella x, y) e `facing` la direzione in cui sporgono dal muro, verso la stanza. */
  torches?: { x: number; y: number; facing: 'N' | 'E' | 'S' | 'W' }[];
  /** Le caselle dell'area di partenza fra cui gli eroi scelgono dove cominciare. Senza, valgono le caselle libere intorno al glifo iniziale acceso. */
  start?: { x: number; y: number }[];
}

/** Un tile già ruotato e collocato: x, y è l'angolo in alto a sinistra, in celle. */
export interface PlacedTile {
  def: TileDef;
  x: number;
  y: number;
  /** Vedi `MapTileRef.area`. */
  area?: string;
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
    area: t.area,
  }));
  return { data, placed };
}
