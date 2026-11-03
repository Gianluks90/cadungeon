import type { Graphics } from 'pixi.js';
import {
  CELL_SIZE,
  STAIRS_LINK_BEND_COST_PX,
  STAIRS_LINK_CORNER_RADIUS_PX,
  STAIRS_LINK_CURVE_STEPS,
  STAIRS_LINK_DASH_PX,
  STAIRS_LINK_GAP_PX,
  STAIRS_LINK_ROOM_COST_PX,
} from '../constants';
import type { Board } from '../board/board';

/**
 * Il filo tratteggiato che unisce due segnalini collegati (i due capi di una scalinata, i due glifi gemelli): il percorso a segmenti orizzontali e verticali, scelto automaticamente o
 * dall'autore (le maniglie dell'editor), e il disegno tratteggiato con gli angoli arrotondati. Sta qui perché è uguale per i due casi.
 */

export type Vec = [number, number];

/** Un capo del filo: la casella (`x`, `y`), a che distanza dal suo centro esce il filo (`edge`), il verso fisso di uscita (`dir`, oppure null se è libero: lo sceglie il percorso) e il percorso salvato dall'autore. */
export interface LinkEnd {
  x: number;
  y: number;
  edge: number;
  dir: Vec | null;
  route?: { x: number; y: number }[];
}

/** Il filo di una coppia: `a` è il capo che tiene il percorso salvato, `pts` sono i punti del percorso a segmenti in pixel (dall'uscita di `a` all'arrivo su `b`) e `ua`, `ub` i versi in cui il filo esce dai due capi. */
export interface LinkInfo<T> {
  a: T;
  b: T;
  pts: Vec[];
  ua: Vec;
  ub: Vec;
}

export interface LinkLayout {
  pts: Vec[];
  ua: Vec;
  ub: Vec;
}

const DIRS: Vec[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

const clean = (pts: Vec[]): Vec[] => pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.5);
const sign = (p: Vec, q: Vec): Vec => [Math.sign(q[0] - p[0]), Math.sign(q[1] - p[1])];

/** Il verso in cui sta il punto `p` rispetto al centro `c`, se è su uno degli assi (altrimenti null). */
function dirFrom(c: Vec, p: Vec): Vec | null {
  const dx = p[0] - c[0];
  const dy = p[1] - c[1];
  if (Math.abs(dx) < 0.5 && Math.abs(dy) >= 0.5) return [0, Math.sign(dy)];
  if (Math.abs(dy) < 0.5 && Math.abs(dx) >= 0.5) return [Math.sign(dx), 0];
  return null;
}

/** Un percorso salvato è ancora buono? Solo segmenti orizzontali e verticali, esce dal capo `a` nel suo verso e arriva su `b` dal suo. */
function routeFits(pts: Vec[], ua: Vec, ub: Vec): boolean {
  if (pts.length < 4) return false; // p0, almeno due punti intermedi (anche in linea retta), p1
  for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i][0] - pts[i - 1][0]) > 0.5 && Math.abs(pts[i][1] - pts[i - 1][1]) > 0.5) return false;
  const out = [Math.sign(pts[1][0] - pts[0][0]), Math.sign(pts[1][1] - pts[0][1])];
  const n = pts.length;
  const into = [Math.sign(pts[n - 1][0] - pts[n - 2][0]), Math.sign(pts[n - 1][1] - pts[n - 2][1])];
  return out[0] === ua[0] && out[1] === ua[1] && into[0] === -ub[0] && into[1] === -ub[1];
}

/**
 * Il percorso del filo: esce da un capo, cammina a segmenti orizzontali e verticali con gli angoli arrotondati, e arriva all'altro, senza mai tornare indietro contro i capi. Fra le strade
 * possibili sceglie la migliore: poche curve (di più pesano le curve), strada corta, e il meno possibile sopra le caselle delle stanze (se serve passa fuori dalla mappa, attorno a tutto).
 * Le stanze non sono vietate: è un criterio, non un obbligo. Un capo senza verso fisso prova tutti e quattro i versi.
 */
export function layoutLink(a: LinkEnd, b: LinkEnd, board: Board): LinkLayout {
  const half = CELL_SIZE / 2;
  const stub = STAIRS_LINK_CORNER_RADIUS_PX; // un tratto dritto all'uscita e all'arrivo, prima di poter curvare
  const ca: Vec = [(a.x + 0.5) * CELL_SIZE, (a.y + 0.5) * CELL_SIZE];
  const cb: Vec = [(b.x + 0.5) * CELL_SIZE, (b.y + 0.5) * CELL_SIZE];
  const exit = (c: Vec, u: Vec, edge: number): Vec => [c[0] + u[0] * edge, c[1] + u[1] * edge];

  // Un percorso scelto dall'autore (le maniglie dell'editor) vale più di quello automatico, se è ancora coerente con i due capi.
  if (a.route?.length) {
    const saved = a.route.map((p): Vec => [p.x * CELL_SIZE, p.y * CELL_SIZE]);
    const ua = a.dir ?? dirFrom(ca, saved[0]);
    const ub = b.dir ?? dirFrom(cb, saved[saved.length - 1]);
    if (ua && ub) {
      const pts = clean([exit(ca, ua, a.edge), ...saved, exit(cb, ub, b.edge)]);
      if (routeFits(pts, ua, ub)) return { pts, ua, ub };
    }
  }

  // Fuori da tutta la mappa: una cornice attorno ai tile, dove il filo non passa su nessuna stanza.
  const bounds = board.cellBounds();
  const wide = half + stub; // quanto basta per aggirare un capo
  /** Le caselle dei tile che il percorso attraversa (campionato ogni 16 px). */
  const rooms = (pts: Vec[]) => {
    const seen = new Set<string>();
    for (let i = 1; i < pts.length; i++) {
      const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const n = Math.max(1, Math.ceil(len / 16));
      for (let k = 0; k <= n; k++) {
        const x = pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * k) / n;
        const y = pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * k) / n;
        const cell = { x: Math.floor((x + 0.01) / CELL_SIZE), y: Math.floor((y + 0.01) / CELL_SIZE) };
        if (board.isWalkable(cell)) seen.add(`${cell.x},${cell.y}`);
      }
    }
    return seen.size;
  };

  let best: { pts: Vec[]; ua: Vec; ub: Vec } | null = null;
  let bestCost = Infinity;
  let fallback: { pts: Vec[]; ua: Vec; ub: Vec } | null = null;
  for (const ua of a.dir ? [a.dir] : DIRS) {
    for (const ub of b.dir ? [b.dir] : DIRS) {
      const p0 = exit(ca, ua, a.edge);
      const p1 = exit(cb, ub, b.edge);
      const a1: Vec = [p0[0] + ua[0] * stub, p0[1] + ua[1] * stub];
      const b1: Vec = [p1[0] + ub[0] * stub, p1[1] + ub[1] * stub];
      fallback ??= { pts: clean([p0, a1, b1, p1]), ua, ub };
      const mx = (a1[0] + b1[0]) / 2;
      const my = (a1[1] + b1[1]) / 2;
      const near = { left: Math.min(a1[0], b1[0]) - wide, right: Math.max(a1[0], b1[0]) + wide, top: Math.min(a1[1], b1[1]) - wide, bottom: Math.max(a1[1], b1[1]) + wide };
      const far = bounds
        ? { left: bounds.x0 * CELL_SIZE - wide, right: bounds.x1 * CELL_SIZE + wide, top: bounds.y0 * CELL_SIZE - wide, bottom: bounds.y1 * CELL_SIZE + wide }
        : near;
      const middles: Vec[][] = [[], [[b1[0], a1[1]]], [[a1[0], b1[1]]], [[mx, a1[1]], [mx, b1[1]]], [[a1[0], my], [b1[0], my]]];
      for (const e of [near, far]) {
        // Aggiramenti a U (anche quando i capi si danno le spalle).
        middles.push([[e.left, a1[1]], [e.left, b1[1]]], [[e.right, a1[1]], [e.right, b1[1]]], [[a1[0], e.top], [b1[0], e.top]], [[a1[0], e.bottom], [b1[0], e.bottom]]);
      }
      for (const m of middles) {
        const mid = clean([a1, ...m, b1]);
        const first = mid.length > 1 ? sign(mid[0], mid[1]) : ([-ub[0], -ub[1]] as Vec);
        const last = mid.length > 1 ? sign(mid[mid.length - 2], mid[mid.length - 1]) : ([-ub[0], -ub[1]] as Vec);
        if (first[0] * ua[0] + first[1] * ua[1] < 0 || last[0] * ub[0] + last[1] * ub[1] > 0) continue; // tornerebbe indietro contro uno dei due capi
        const full = clean([p0, ...mid, p1]);
        let length = 0;
        let bends = 0;
        for (let i = 1; i < full.length; i++) {
          length += Math.hypot(full[i][0] - full[i - 1][0], full[i][1] - full[i - 1][1]);
          if (i > 1) {
            const d1 = sign(full[i - 2], full[i - 1]);
            const d2 = sign(full[i - 1], full[i]);
            if (d1[0] !== d2[0] || d1[1] !== d2[1]) bends++;
          }
        }
        const cost = length + STAIRS_LINK_BEND_COST_PX * bends + STAIRS_LINK_ROOM_COST_PX * rooms(full);
        if (cost < bestCost) {
          bestCost = cost;
          best = { pts: full, ua, ub };
        }
      }
    }
  }
  return best ?? fallback!;
}

/** Arrotonda gli angoli di un percorso a segmenti: ogni angolo diventa una curva con l'angolo come punto di controllo, larga al massimo metà dei due tratti che lo formano. */
function rounded(pts: Vec[]): Vec[] {
  const out: Vec[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(cx - px, cy - py);
    const l2 = Math.hypot(nx - cx, ny - cy);
    const d1 = [(cx - px) / l1, (cy - py) / l1];
    const d2 = [(nx - cx) / l2, (ny - cy) / l2];
    if (Math.abs(d1[0] * d2[1] - d1[1] * d2[0]) < 1e-6) {
      out.push([cx, cy]); // dritto: niente curva
      continue;
    }
    const r = Math.min(STAIRS_LINK_CORNER_RADIUS_PX, l1 / 2, l2 / 2);
    const sx = cx - d1[0] * r;
    const sy = cy - d1[1] * r;
    const ex = cx + d2[0] * r;
    const ey = cy + d2[1] * r;
    for (let k = 0; k <= STAIRS_LINK_CURVE_STEPS; k++) {
      const t = k / STAIRS_LINK_CURVE_STEPS;
      out.push([(1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * ex, (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ey]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Aggiunge a `g` il percorso tratteggiato (trattini e vuoti lungo tutto il percorso, angoli arrotondati): chi chiama poi lo disegna con `stroke`. */
export function dashedPath(g: Graphics, pts: Vec[]) {
  const route = rounded(pts);
  let carried = 0; // quanto del trattino o del vuoto corrente è già stato fatto, di qua dal segmento
  let drawing = true;
  for (let i = 1; i < route.length; i++) {
    const [x0, y0] = route[i - 1];
    const [x1, y1] = route[i];
    const length = Math.hypot(x1 - x0, y1 - y0);
    let t = 0;
    while (t < length) {
      const run = (drawing ? STAIRS_LINK_DASH_PX : STAIRS_LINK_GAP_PX) - carried;
      const step = Math.min(run, length - t);
      if (drawing) g.moveTo(x0 + ((x1 - x0) * t) / length, y0 + ((y1 - y0) * t) / length).lineTo(x0 + ((x1 - x0) * (t + step)) / length, y0 + ((y1 - y0) * (t + step)) / length);
      t += step;
      carried += step;
      if (carried >= (drawing ? STAIRS_LINK_DASH_PX : STAIRS_LINK_GAP_PX) - 1e-6) {
        drawing = !drawing;
        carried = 0;
      }
    }
  }
}
