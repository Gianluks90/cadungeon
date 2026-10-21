export type Side = 'N' | 'E' | 'S' | 'W';
export type Rotation = 0 | 90 | 180 | 270;

/** Un'apertura su un lato: `offset` si misura in celle dall'angolo in alto a sinistra del tile. */
export interface Opening {
  side: Side;
  offset: number;
  width: number;
}

/** Descrizione di un tile (il contenuto del file JSON): solo forma e aperture. */
export interface TileDef {
  id: string;
  size: { w: number; h: number };
  openings: Opening[];
}

const NEXT_SIDE: Record<Side, Side> = { N: 'E', E: 'S', S: 'W', W: 'N' };

/** Ruota il tile di 90° in senso orario. */
function rotateOnce(def: TileDef): TileDef {
  const { w, h } = def.size;
  return {
    id: def.id,
    size: { w: h, h: w },
    openings: def.openings.map((o) => ({
      side: NEXT_SIDE[o.side],
      // Est e Ovest vengono "capovolti" lungo il lato; Nord e Sud mantengono la distanza.
      offset: o.side === 'E' || o.side === 'W' ? h - o.offset - o.width : o.offset,
      width: o.width,
    })),
  };
}

export function rotateTile(def: TileDef, rotation: Rotation): TileDef {
  let result = def;
  for (let i = 0; i < rotation / 90; i++) result = rotateOnce(result);
  return result;
}

export async function loadTileDef(id: string): Promise<TileDef> {
  const res = await fetch(`tiles/${id}.json`);
  if (!res.ok) throw new Error(`Tile "${id}" non trovato`);
  return res.json();
}
