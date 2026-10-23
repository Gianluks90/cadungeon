import { Board, Cell, cellKey } from './board';

const EPS = 1e-9;

/**
 * Da `from` si vede `to`? Come dice il regolamento: si traccia una linea dritta dal centro della casella di chi guarda
 * al centro della casella da vedere. La vista è bloccata se la linea attraversa un muro o una porta chiusa, o passa
 * per una casella con un masso o con un'altra creatura (`blockers`, senza contare le due caselle di partenza e arrivo).
 * L'acqua e le buche non bloccano.
 *
 * La linea che sfiora soltanto l'estremità di un muro non è bloccata: quando passa esattamente per un punto del
 * reticolo (una diagonale perfetta) blocca solo se in quel punto c'è un muro che la attraversa davvero, cioè con un
 * pezzo da una parte e uno dall'altra. È anche per questo che la diagonale non si blocca girando intorno a un angolo.
 */
export function canSee(board: Board, from: Cell, to: Cell, blockers: ReadonlySet<string>): boolean {
  if (from.x === to.x && from.y === to.y) return true;
  const p0x = from.x + 0.5;
  const p0y = from.y + 0.5;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  const tDeltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const tDeltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
  // Distanza (in parti della lunghezza della linea) alla prossima linea verticale e orizzontale della griglia.
  let tMaxX = dx === 0 ? Infinity : ((stepX > 0 ? from.x + 1 : from.x) - p0x) / dx;
  let tMaxY = dy === 0 ? Infinity : ((stepY > 0 ? from.y + 1 : from.y) - p0y) / dy;
  let cx = from.x;
  let cy = from.y;

  // Si entra in una nuova casella: è l'arrivo, oppure non deve bloccare.
  const enter = (): boolean | null => {
    if (cx === to.x && cy === to.y) return true;
    const c = { x: cx, y: cy };
    if (!board.isWalkable(c) || board.blocksSight(c) || blockers.has(cellKey(c))) return false;
    return null;
  };

  for (let guard = 0; guard < 10000; guard++) {
    if (Math.abs(tMaxX - tMaxY) < EPS) {
      // Passa esattamente per un punto del reticolo: serve un muro che lo attraversi, non che lo sfiori.
      const px = stepX > 0 ? cx + 1 : cx;
      const py = stepY > 0 ? cy + 1 : cy;
      if (board.blocksSightAt(`h|${px - 1}|${py}`) && board.blocksSightAt(`h|${px}|${py}`)) return false;
      if (board.blocksSightAt(`v|${px}|${py - 1}`) && board.blocksSightAt(`v|${px}|${py}`)) return false;
      cx += stepX;
      cy += stepY;
      tMaxX += tDeltaX;
      tMaxY += tDeltaY;
    } else if (tMaxX < tMaxY) {
      // Attraversa una linea verticale della griglia, nella riga della casella in cui si trova.
      if (board.blocksSightAt(`v|${stepX > 0 ? cx + 1 : cx}|${cy}`)) return false;
      cx += stepX;
      tMaxX += tDeltaX;
    } else {
      if (board.blocksSightAt(`h|${cx}|${stepY > 0 ? cy + 1 : cy}`)) return false;
      cy += stepY;
      tMaxY += tDeltaY;
    }
    const result = enter();
    if (result !== null) return result;
  }
  return false;
}

/**
 * Tutte le caselle che si vedono da `origin`. Chi sta in una buca non vede fuori: solo la propria casella
 * (gli altri, invece, lo vedono normalmente).
 */
export function visibleCells(board: Board, origin: Cell, blockers: ReadonlySet<string>): Set<string> {
  const result = new Set<string>([cellKey(origin)]);
  if (board.isPit(origin)) return result;
  for (const c of board.walkableCells()) {
    if (canSee(board, origin, c, blockers)) result.add(cellKey(c));
  }
  return result;
}
