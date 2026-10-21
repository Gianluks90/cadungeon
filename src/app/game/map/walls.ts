import { PlacedTile } from './map-data';
import { Side } from './tile';

/** Un segmento di muro, in celle. Servirà anche per movimento e linea di vista. */
export interface WallSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Un varco: apertura con un'apertura speculare dall'altra parte. Misure in celle. */
export interface Passage {
  horizontal: boolean; // true = giace su una linea orizzontale (lati N/S)
  line: number;
  from: number;
  to: number;
}

export interface MapWalls {
  walls: WallSegment[];
  passages: Passage[];
}

const OPPOSITE: Record<Side, Side> = { N: 'S', S: 'N', E: 'W', W: 'E' };
const SIDES: Side[] = ['N', 'E', 'S', 'W'];

interface Span {
  side: Side;
  line: number; // coordinata fissa del lato (y per N/S, x per E/W)
  from: number; // inizio lungo il lato
  to: number;
}

const key = (side: Side, line: number, from: number, to: number) => `${side}|${line}|${from}|${to}`;

/** Le aperture di un tile in coordinate di mappa. */
function openingSpans(t: PlacedTile): Span[] {
  const { w, h } = t.def.size;
  return t.def.openings.map((o) => {
    const horizontal = o.side === 'N' || o.side === 'S';
    const start = (horizontal ? t.x : t.y) + o.offset;
    const line = o.side === 'N' ? t.y : o.side === 'S' ? t.y + h : o.side === 'W' ? t.x : t.x + w;
    return { side: o.side, line, from: start, to: start + o.width };
  });
}

function segment(side: Side, line: number, from: number, to: number): WallSegment {
  return side === 'N' || side === 'S'
    ? { x1: from, y1: line, x2: to, y2: line }
    : { x1: line, y1: from, x2: line, y2: to };
}

/**
 * Costruisce i muri della mappa: il contorno di ogni tile, con un varco dove c'è un'apertura
 * e un altro tile con l'apertura speculare (stessa posizione, stessa larghezza).
 * Un'apertura senza vicino si disegna come muro.
 */
export function buildWalls(placed: PlacedTile[]): MapWalls {
  const spans = placed.map(openingSpans);
  const openKeys = new Set(spans.flat().map((s) => key(s.side, s.line, s.from, s.to)));
  const walls: WallSegment[] = [];
  const passages = new Map<string, Passage>();

  placed.forEach((t, i) => {
    const { w, h } = t.def.size;
    for (const side of SIDES) {
      const horizontal = side === 'N' || side === 'S';
      const start = horizontal ? t.x : t.y;
      const end = start + (horizontal ? w : h);
      const line = side === 'N' ? t.y : side === 'S' ? t.y + h : side === 'W' ? t.x : t.x + w;

      const onSide = spans[i].filter((s) => s.side === side).sort((a, b) => a.from - b.from);
      let cursor = start;
      for (const s of onSide) {
        if (s.from > cursor) walls.push(segment(side, line, cursor, s.from));
        // Varco solo se dall'altra parte c'è l'apertura speculare.
        if (openKeys.has(key(OPPOSITE[side], line, s.from, s.to))) {
          passages.set(`${horizontal}|${line}|${s.from}|${s.to}`, { horizontal, line, from: s.from, to: s.to });
        } else {
          walls.push(segment(side, line, s.from, s.to));
        }
        cursor = s.to;
      }
      if (cursor < end) walls.push(segment(side, line, cursor, end));
    }
  });
  return { walls, passages: [...passages.values()] };
}
