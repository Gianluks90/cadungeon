import { Graphics } from 'pixi.js';
import { CELL_SIZE } from '../constants';

/** Un'area fatta di celle (chiavi "x,y"), disegnata come un'unica forma: i bordi fra celle vicine spariscono. */
export type Cells = ReadonlySet<string>;
export type Side = 'N' | 'E' | 'S' | 'W';
export type Corner = 'NW' | 'NE' | 'SE' | 'SW';

export interface RegionStyle {
  /** Distanza del bordo dal bordo della cella, sui lati senza celle vicine. */
  inset: number;
  /** Distanza diversa per un lato particolare (es. più piccola o più grande vicino a un muro). */
  insetFor?: (cx: number, cy: number, side: Side) => number;
  /** Raggio dell'angolo convesso in pixel (0 = angolo vivo). Se `rounded` è vero si arrotonda, altrimenti si smussa. */
  cornerRadius?: (cx: number, cy: number, corner: Corner) => number;
  rounded?: boolean;
  fill?: number;
  /** Opacità del riempimento (1 se manca). */
  fillAlpha?: number;
  line?: { width: number; color: number; alpha?: number; pixelLine?: boolean };
}

export const cellKey = (x: number, y: number) => `${x},${y}`;

/** Un tratto del contorno: una retta o una curva, e se fa parte del bordo dell'area (non di un confine fra celle unite). */
type Seg =
  | { kind: 'L'; x0: number; y0: number; x: number; y: number; edge: boolean }
  | { kind: 'Q'; x0: number; y0: number; cx: number; cy: number; x: number; y: number; edge: boolean };

/**
 * Disegna l'area `cells`. Ogni cella diventa una forma che si prolunga fino alle celle vicine; negli angoli
 * convessi si smussa o si arrotonda, in quelli rientranti (cella vicina da due lati ma non in diagonale) si toglie
 * un quadratino, arrotondato se `rounded`: così il contorno dell'insieme è quello giusto, come se l'area fosse
 * stata ristretta di `inset`.
 */
export function drawRegion(g: Graphics, cells: Cells, style: RegionStyle) {
  const o = style.inset;
  const has = (x: number, y: number) => cells.has(cellKey(x, y));
  const shapes: { start: [number, number]; segs: Seg[] }[] = [];

  for (const key of cells) {
    const [cx, cy] = key.split(',').map(Number);
    const hasN = has(cx, cy - 1);
    const hasE = has(cx + 1, cy);
    const hasS = has(cx, cy + 1);
    const hasW = has(cx - 1, cy);
    const ins = (side: Side) => (style.insetFor ? style.insetFor(cx, cy, side) : o);
    const L = cx * CELL_SIZE + (hasW ? 0 : ins('W'));
    const R = (cx + 1) * CELL_SIZE - (hasE ? 0 : ins('E'));
    const T = cy * CELL_SIZE + (hasN ? 0 : ins('N'));
    const B = (cy + 1) * CELL_SIZE - (hasS ? 0 : ins('S'));
    const maxR = Math.min(R - L, B - T) / 2;
    const rad = (corner: Corner) => Math.min(style.cornerRadius?.(cx, cy, corner) ?? 0, maxR);

    // Per ogni angolo: punto in cui arriva il lato precedente (A), punto da cui parte il successivo (B),
    // e il punto "vivo" (V) o, negli angoli rientranti, il punto interno (M).
    interface Node { A: [number, number]; B: [number, number]; ctrl?: [number, number]; mid?: [number, number] }
    const nodes: Record<Corner, Node> = {
      NW: { A: [L, T], B: [L, T] }, NE: { A: [R, T], B: [R, T] }, SE: { A: [R, B], B: [R, B] }, SW: { A: [L, B], B: [L, B] },
    };
    const setConvex = (c: Corner, V: [number, number], A: [number, number], B: [number, number]) => {
      nodes[c] = { A, B, ctrl: style.rounded ? V : undefined };
    };
    const setNotch = (c: Corner, A: [number, number], M: [number, number], B: [number, number]) => {
      nodes[c] = { A, B, ctrl: style.rounded ? M : undefined, mid: M };
    };

    const rNW = rad('NW');
    if (!hasN && !hasW && rNW > 0) setConvex('NW', [L, T], [L, T + rNW], [L + rNW, T]);
    else if (hasN && hasW && !has(cx - 1, cy - 1)) setNotch('NW', [L, T + o], [L + o, T + o], [L + o, T]);
    const rNE = rad('NE');
    if (!hasN && !hasE && rNE > 0) setConvex('NE', [R, T], [R - rNE, T], [R, T + rNE]);
    else if (hasN && hasE && !has(cx + 1, cy - 1)) setNotch('NE', [R - o, T], [R - o, T + o], [R, T + o]);
    const rSE = rad('SE');
    if (!hasS && !hasE && rSE > 0) setConvex('SE', [R, B], [R, B - rSE], [R - rSE, B]);
    else if (hasS && hasE && !has(cx + 1, cy + 1)) setNotch('SE', [R, B - o], [R - o, B - o], [R - o, B]);
    const rSW = rad('SW');
    if (!hasS && !hasW && rSW > 0) setConvex('SW', [L, B], [L + rSW, B], [L, B - rSW]);
    else if (hasS && hasW && !has(cx - 1, cy + 1)) setNotch('SW', [L + o, B], [L + o, B - o], [L, B - o]);

    // Il contorno in senso orario: lato, angolo, lato, angolo...
    const order: { corner: Corner; sideAfterIsEdge: boolean }[] = [
      { corner: 'NW', sideAfterIsEdge: !hasN },
      { corner: 'NE', sideAfterIsEdge: !hasE },
      { corner: 'SE', sideAfterIsEdge: !hasS },
      { corner: 'SW', sideAfterIsEdge: !hasW },
    ];
    const segs: Seg[] = [];
    let at = nodes.NW.B;
    for (let i = 0; i < 4; i++) {
      const next = nodes[order[(i + 1) % 4].corner];
      segs.push({ kind: 'L', x0: at[0], y0: at[1], x: next.A[0], y: next.A[1], edge: order[i].sideAfterIsEdge });
      at = next.A;
      if (next.A[0] !== next.B[0] || next.A[1] !== next.B[1]) {
        if (next.ctrl) segs.push({ kind: 'Q', x0: at[0], y0: at[1], cx: next.ctrl[0], cy: next.ctrl[1], x: next.B[0], y: next.B[1], edge: true });
        else if (next.mid) {
          segs.push({ kind: 'L', x0: at[0], y0: at[1], x: next.mid[0], y: next.mid[1], edge: true });
          segs.push({ kind: 'L', x0: next.mid[0], y0: next.mid[1], x: next.B[0], y: next.B[1], edge: true });
        } else segs.push({ kind: 'L', x0: at[0], y0: at[1], x: next.B[0], y: next.B[1], edge: true });
        at = next.B;
      }
    }
    shapes.push({ start: nodes.NW.B, segs });
  }

  if (style.fill !== undefined) {
    for (const s of shapes) {
      g.moveTo(...s.start);
      for (const seg of s.segs) {
        if (seg.kind === 'L') g.lineTo(seg.x, seg.y);
        else g.quadraticCurveTo(seg.cx, seg.cy, seg.x, seg.y);
      }
      g.closePath();
    }
    g.fill(style.fillAlpha === undefined ? style.fill : { color: style.fill, alpha: style.fillAlpha });
  }
  if (style.line) {
    for (const s of shapes) {
      for (const seg of s.segs) {
        if (!seg.edge) continue;
        g.moveTo(seg.x0, seg.y0);
        if (seg.kind === 'L') g.lineTo(seg.x, seg.y);
        else g.quadraticCurveTo(seg.cx, seg.cy, seg.x, seg.y);
      }
    }
    g.stroke({ width: style.line.width, color: style.line.color, alpha: style.line.alpha ?? 1, pixelLine: style.line.pixelLine, cap: 'round', join: 'round' });
  }
}
