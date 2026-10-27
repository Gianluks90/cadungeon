import { Obstacle, obstacleCells } from '../game/board/obstacle';

interface Cell {
  x: number;
  y: number;
}

const key = (c: Cell) => `${c.x},${c.y}`;
const MAX_LINE = 3;

/** Un gruppo di macerie in linea (1×1, 1×2 o 1×3): le sue caselle estreme e se è orizzontale o verticale (un 1×1 è entrambe le cose). */
function isLine(o: Obstacle): boolean {
  return o.type === 'rock' && !o.big && o.length <= MAX_LINE;
}

/**
 * Le regole delle macerie nell'editor: ogni clic mette una macerie 1×1 e poi si guarda cosa forma con le vicine.
 * - In linea formano un gruppo lungo al massimo 3 caselle (le macerie 1×1, 1×2 e 1×3).
 * - Se, affiancandosi, quattro caselle di macerie formano un quadrato 2×2 nasce un masso grande (con sassi più piccoli attorno)... ma solo se i pezzi che lo formano stanno tutti dentro il
 *   quadrato: se una delle macerie è parte di un gruppo più lungo che esce dal quadrato (per esempio una 1×3) il masso non si crea.
 * Restituisce la nuova lista di ostacoli (le altre cose restano) o null se la casella è già occupata.
 */
export function placeRock(obstacles: readonly Obstacle[], at: Cell): Obstacle[] | null {
  const byCell = new Map<string, Obstacle>();
  for (const o of obstacles) for (const c of obstacleCells(o)) byCell.set(key(c), o);
  if (byCell.has(key(at))) return null;

  // 1. Un quadrato 2×2: ognuno dei quattro quadrati che contengono la casella, se le altre tre sono macerie in linea che stanno tutte dentro il quadrato.
  for (const sx of [at.x - 1, at.x]) {
    for (const sy of [at.y - 1, at.y]) {
      const square = [{ x: sx, y: sy }, { x: sx + 1, y: sy }, { x: sx, y: sy + 1 }, { x: sx + 1, y: sy + 1 }];
      const inSquare = new Set(square.map(key));
      const others = square.filter((c) => key(c) !== key(at));
      const parts = new Set<Obstacle>();
      let ok = true;
      for (const c of others) {
        const o = byCell.get(key(c));
        if (!o || !isLine(o) || obstacleCells(o).some((oc) => !inSquare.has(key(oc)))) {
          ok = false;
          break;
        }
        parts.add(o);
      }
      if (ok) return [...obstacles.filter((o) => !parts.has(o)), { type: 'rock', x: sx, y: sy, length: 2, big: true }];
    }
  }

  // 2. In linea: la macerie si unisce ai gruppi che le stanno accanto sulla stessa riga (o colonna), se il totale non supera 3.
  const lineAt = (c: Cell, vertical: boolean): Obstacle | null => {
    const o = byCell.get(key(c));
    if (!o || !isLine(o)) return null;
    return o.length === 1 || !!o.vertical === vertical ? o : null; // un 1×1 va bene in entrambe le direzioni; un gruppo solo se è lungo quella direzione
  };
  const merges: { vertical: boolean; before: Obstacle | null; after: Obstacle | null; length: number }[] = [];
  for (const vertical of [false, true]) {
    const before = lineAt({ x: at.x - (vertical ? 0 : 1), y: at.y - (vertical ? 1 : 0) }, vertical);
    const after = lineAt({ x: at.x + (vertical ? 0 : 1), y: at.y + (vertical ? 1 : 0) }, vertical);
    // Il gruppo "prima" deve finire proprio accanto (la sua ultima casella è quella adiacente); lo stesso per "dopo".
    const length = 1 + (before?.length ?? 0) + (after?.length ?? 0);
    if ((before || after) && length <= MAX_LINE) merges.push({ vertical, before, after, length });
  }
  if (merges.length) {
    const best = merges.reduce((a, b) => (b.length > a.length ? b : a));
    const parts = new Set([best.before, best.after].filter((o): o is Obstacle => !!o));
    const cells = [...parts].flatMap(obstacleCells).concat(at);
    const x = Math.min(...cells.map((c) => c.x));
    const y = Math.min(...cells.map((c) => c.y));
    return [...obstacles.filter((o) => !parts.has(o)), { type: 'rock', x, y, length: best.length, ...(best.vertical ? { vertical: true } : {}) }];
  }

  return [...obstacles, { type: 'rock', x: at.x, y: at.y, length: 1 }];
}
