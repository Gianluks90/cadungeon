import { PlacedTile } from './map-data';
import { Side, tileCells } from './tile';

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
  /** Gli stipiti ci sono solo fra due aree distinte: se un lato è un punto morto non ci sono. */
  posts: boolean;
}

export interface MapWalls {
  walls: WallSegment[];
  passages: Passage[];
}

export const OPPOSITE: Record<Side, Side> = { N: 'S', S: 'N', E: 'W', W: 'E' };

export interface Span {
  side: Side;
  line: number; // coordinata fissa del lato (y per N/S, x per E/W)
  from: number; // inizio lungo il lato
  to: number;
}

const key = (side: Side, line: number, from: number, to: number) => `${side}|${line}|${from}|${to}`;

/** Le aperture di un tile in coordinate di mappa. Stanno sul bordo del rettangolo che contiene il tile. */
export function openingSpans(t: PlacedTile): Span[] {
  const { w, h } = t.def.size;
  return t.def.openings.map((o) => {
    const horizontal = o.side === 'N' || o.side === 'S';
    const start = (horizontal ? t.x : t.y) + o.offset;
    const line = o.side === 'N' ? t.y : o.side === 'S' ? t.y + h : o.side === 'W' ? t.x : t.x + w;
    return { side: o.side, line, from: start, to: start + o.width };
  });
}

/** Le aperture che non hanno ancora un'apertura speculare dall'altra parte: qui si può agganciare un tile. */
export function freeOpenings(placed: PlacedTile[]): Span[] {
  const spans = placed.flatMap(openingSpans);
  const keys = new Set(spans.map((s) => key(s.side, s.line, s.from, s.to)));
  return spans.filter((s) => !keys.has(key(OPPOSITE[s.side], s.line, s.from, s.to)));
}

/**
 * Per ogni apertura di `tile` (nell'ordine del JSON): true se si collega a un'apertura speculare
 * già presente nella mappa `placed`.
 */
export function connectedOpenings(placed: PlacedTile[], tile: PlacedTile): boolean[] {
  const keys = new Set(placed.flatMap(openingSpans).map((s) => key(s.side, s.line, s.from, s.to)));
  return openingSpans(tile).map((s) => keys.has(key(OPPOSITE[s.side], s.line, s.from, s.to)));
}

function segment(side: Side, line: number, from: number, to: number): WallSegment {
  return side === 'N' || side === 'S'
    ? { x1: from, y1: line, x2: to, y2: line }
    : { x1: line, y1: from, x2: line, y2: to };
}

/**
 * Costruisce i muri della mappa: il contorno di ogni tile (anche non rettangolare), con un varco
 * dove c'è un'apertura e un altro tile con l'apertura speculare (stessa posizione, stessa larghezza).
 * Un'apertura senza vicino si disegna come muro.
 */
export function buildWalls(placed: PlacedTile[]): MapWalls {
  const spans = placed.map(openingSpans);
  const openKeys = new Set(spans.flat().map((s) => key(s.side, s.line, s.from, s.to)));
  const walls: WallSegment[] = [];
  const passages = new Map<string, Passage>();

  placed.forEach((t, i) => {
    // Varchi di questo tile.
    const matched = spans[i].filter((s) => openKeys.has(key(OPPOSITE[s.side], s.line, s.from, s.to)));
    for (const s of matched) {
      const horizontal = s.side === 'N' || s.side === 'S';
      const k = `${horizontal}|${s.line}|${s.from}|${s.to}`;
      // Il varco è visto da entrambi i tile: ha gli stipiti solo se nessuno dei due è un punto morto.
      const posts = (passages.get(k)?.posts ?? true) && !t.def.deadEnd;
      passages.set(k, { horizontal, line: s.line, from: s.from, to: s.to, posts });
    }

    // Lati unitari del contorno: quelli delle celle che non hanno una cella vicina dentro il tile.
    const cells = tileCells(t.def);
    const has = (x: number, y: number) => cells.has(`${x},${y}`);
    const edges = new Map<string, number[]>(); // "lato|linea" -> inizi (lungo il lato) dei lati unitari
    const add = (side: Side, line: number, start: number) => {
      const k = `${side}|${line}`;
      if (!edges.has(k)) edges.set(k, []);
      edges.get(k)!.push(start);
    };
    for (const c of cells) {
      const [cx, cy] = c.split(',').map(Number);
      const gx = t.x + cx;
      const gy = t.y + cy;
      if (!has(cx, cy - 1)) add('N', gy, gx);
      if (!has(cx, cy + 1)) add('S', gy + 1, gx);
      if (!has(cx - 1, cy)) add('W', gx, gy);
      if (!has(cx + 1, cy)) add('E', gx + 1, gy);
    }

    // Un lato unitario dentro un varco non ha muro; tutti gli altri sì (anche le aperture senza vicino).
    for (const [k, starts] of edges) {
      const [side, lineText] = k.split('|');
      const line = Number(lineText);
      const inPassage = (start: number) =>
        matched.some((s) => s.side === side && s.line === line && s.from <= start && start + 1 <= s.to);
      const solid = starts.filter((st) => !inPassage(st)).sort((a, b) => a - b);

      // Unisce i lati unitari consecutivi in un unico segmento.
      let from = 0;
      let prev = 0;
      solid.forEach((st, n) => {
        if (n === 0) from = st;
        else if (st !== prev + 1) {
          walls.push(segment(side as Side, line, from, prev + 1));
          from = st;
        }
        prev = st;
        if (n === solid.length - 1) walls.push(segment(side as Side, line, from, prev + 1));
      });
    }
  });
  return { walls, passages: [...passages.values()] };
}
