import type { WallSegment } from '../map/walls';

/**
 * Un muro dell'avventura (dato dell'autore, non dei tile): un segmento sulla griglia che parte dal vertice in alto a sinistra della casella (`x`, `y`) e corre per `length` lati di cella,
 * verso destra oppure, se `vertical`, verso il basso. Blocca movimento e vista come i muri dei tile, si disegna insieme a loro (si fonde con quelli vicini) ma non crea aree: è un
 * elemento cosmetico che blocca. Sta solo fra due caselle di tile, mai sul bordo di un tile (le uscite senza tile vicino sono già chiuse).
 */
export interface Wall {
  x: number;
  y: number;
  length: number;
  vertical?: boolean;
}

/** Le lunghezze dei muri che l'editor offre (le schede della cassetta): uno e quattro lati di cella, quanto una stanza piccola. */
export const WALL_LENGTHS = [1, 4] as const;

/** Le chiavi dei lati di cella del muro: `h|x|y` è la linea orizzontale y fra x e x+1, `v|x|y` la verticale x fra y e y+1 (le stesse del `Board`). */
export function wallEdges(w: Wall): string[] {
  return Array.from({ length: w.length }, (_, i) => (w.vertical ? `v|${w.x}|${w.y + i}` : `h|${w.x + i}|${w.y}`));
}

/** Le due caselle che il lato `edge` separa. */
export function edgeCells(edge: string): [{ x: number; y: number }, { x: number; y: number }] {
  const [kind, a, b] = edge.split('|');
  const x = Number(a);
  const y = Number(b);
  return kind === 'h' ? [{ x, y: y - 1 }, { x, y }] : [{ x: x - 1, y }, { x, y }];
}

/** Il muro come segmento sulla griglia, nel formato con cui si disegnano gli altri muri. */
export function wallSegment(w: Wall): WallSegment {
  return w.vertical ? { x1: w.x, y1: w.y, x2: w.x, y2: w.y + w.length } : { x1: w.x, y1: w.y, x2: w.x + w.length, y2: w.y };
}

/**
 * Il muro tocca il tratto di una porta (`line` è la linea su cui sta, da `from` a `to`)? Vale anche solo un punto in comune: lo attraversa, ci si aggancia con un'estremità o gli sta
 * lungo la stessa linea. Un muro non deve mai farlo, e una porta non va dove un muro la toccherebbe.
 */
export function wallTouchesSpan(w: Wall, s: { horizontal: boolean; line: number; from: number; to: number }): boolean {
  const g = wallSegment(w);
  if (s.horizontal) {
    // porta: linea orizzontale y = line, x da `from` a `to`
    if (!w.vertical) return g.y1 === s.line && g.x1 <= s.to && g.x2 >= s.from;
    return g.x1 >= s.from && g.x1 <= s.to && g.y1 <= s.line && g.y2 >= s.line;
  }
  // porta: linea verticale x = line, y da `from` a `to`
  if (w.vertical) return g.x1 === s.line && g.y1 <= s.to && g.y2 >= s.from;
  return g.y1 >= s.from && g.y1 <= s.to && g.x1 <= s.line && g.x2 >= s.line;
}
