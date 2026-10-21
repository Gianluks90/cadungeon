export type Side = 'N' | 'E' | 'S' | 'W';
export type Rotation = 0 | 90 | 180 | 270;

/** Un'apertura su un lato: `offset` si misura in celle dall'angolo in alto a sinistra del tile. */
export interface Opening {
  side: Side;
  offset: number;
  width: number;
}

/** Un rettangolo di celle, relativo all'angolo in alto a sinistra del tile. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Descrizione di un tile (il contenuto del file JSON): solo forma e aperture.
 * `size` è il rettangolo che contiene tutto il tile. `rects` è facoltativo: se il tile non è un
 * rettangolo pieno (T, croce, ...) elenca i rettangoli la cui unione è la forma vera.
 * Le aperture stanno sempre sul bordo del rettangolo che contiene il tile.
 */
export interface TileDef {
  id: string;
  /** Punto morto: una micro stanza che chiude un'uscita. Non è un'area a sé, quindi il suo varco non ha stipiti. */
  deadEnd?: boolean;
  size: { w: number; h: number };
  rects?: Rect[];
  openings: Opening[];
}

/** I rettangoli che formano il tile (un solo rettangolo pieno se non sono elencati). */
export function tileRects(def: TileDef): Rect[] {
  return def.rects ?? [{ x: 0, y: 0, w: def.size.w, h: def.size.h }];
}

/** Le celle del tile, come insieme di "x,y" (relative all'angolo in alto a sinistra). */
export function tileCells(def: TileDef): Set<string> {
  const cells = new Set<string>();
  for (const r of tileRects(def)) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) cells.add(`${x},${y}`);
  }
  return cells;
}

const NEXT_SIDE: Record<Side, Side> = { N: 'E', E: 'S', S: 'W', W: 'N' };

/** Ruota il tile di 90° in senso orario. */
function rotateOnce(def: TileDef): TileDef {
  const { w, h } = def.size;
  return {
    id: def.id,
    deadEnd: def.deadEnd,
    size: { w: h, h: w },
    // Un punto (x, y) diventa (h - y, x): il rettangolo si gira di 90° in senso orario.
    rects: def.rects?.map((r) => ({ x: h - r.y - r.h, y: r.x, w: r.h, h: r.w })),
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
