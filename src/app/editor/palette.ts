import { translate } from '../i18n/i18n.service';
import { DEV_PLACEABLE_TILES } from '../game/constants';
import { TileDef, loadTileDef } from '../game/map/tile';

/** Un elemento che si può inserire nella mappa. Per ora solo tessere. */
export interface PaletteTile {
  kind: 'tile';
  id: string;
  name: string;
  def: TileDef;
}

/** I nomi dei tile del catalogo (public/tiles/) nella lingua di adesso. */
const TILE_NAMES = (id: string): string | undefined => ((['dead-end-2x1','corridor-2x2','corridor-2x4','corridor-2x6','corridor-t','corridor-cross','corridor-elbow','room-4x4','room-4x6','room-6x6','room-8x8'] as const).includes(id as never) ? translate(`tile.${id as 'dead-end-2x1'}`) : undefined);

/** Carica le tessere del catalogo, nell'ordine in cui le usa lo strumento di sviluppo (dal più piccolo al più grande). */
export async function loadTilePalette(): Promise<PaletteTile[]> {
  return Promise.all(DEV_PLACEABLE_TILES.map(async (id): Promise<PaletteTile> => ({ kind: 'tile', id, name: TILE_NAMES(id) ?? id, def: await loadTileDef(id) })));
}
