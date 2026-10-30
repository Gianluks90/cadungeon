import { DEV_PLACEABLE_TILES } from '../game/constants';
import { TileDef, loadTileDef } from '../game/map/tile';

/** Un elemento che si può inserire nella mappa. Per ora solo tessere. */
export interface PaletteTile {
  kind: 'tile';
  id: string;
  name: string;
  def: TileDef;
}

/** I nomi in italiano dei tile del catalogo (public/tiles/). */
const TILE_NAMES: Record<string, string> = {
  'dead-end-2x1': 'Punto morto',
  'corridor-2x2': 'Corridoio corto',
  'corridor-2x4': 'Corridoio medio',
  'corridor-2x6': 'Corridoio lungo',
  'corridor-t': 'Corridoio a T',
  'corridor-cross': 'Corridoio a croce',
  'corridor-elbow': 'Gomito',
  'room-4x4': 'Stanza piccola',
  'room-4x6': 'Stanza lunga',
  'room-6x6': 'Stanza grande',
  'room-8x8': 'Stanza enorme',
};

/** Carica le tessere del catalogo, nell'ordine in cui le usa lo strumento di sviluppo (dal più piccolo al più grande). */
export async function loadTilePalette(): Promise<PaletteTile[]> {
  return Promise.all(DEV_PLACEABLE_TILES.map(async (id): Promise<PaletteTile> => ({ kind: 'tile', id, name: TILE_NAMES[id] ?? id, def: await loadTileDef(id) })));
}
