import type { Cell } from '../board/board';
import { CELL_SIZE, WALL_WIDTH_PX } from '../constants';

/** Un'area da etichettare: le sue caselle, il testo e, se l'autore l'ha spostata, la posizione scelta. */
export interface LabelArea {
  id: string;
  cells: readonly Cell[];
  text: string;
  manual?: { x: number; y: number } | null;
}

/** Dove sta un'etichetta: il centro, in caselle (anche frazionarie). */
export interface LabelPlace {
  id: string;
  text: string;
  x: number;
  y: number;
  /** Le caselle dell'area, per tirare la linea che la collega all'etichetta quando sono lontane. */
  cells?: readonly Cell[];
  /** Le caselle di tutti i tile (per sapere dove finisce il muro esterno). */
  tiles?: ReadonlySet<string>;
}

/** Le etichette si agganciano ai puntini dello sfondo, che stanno sui vertici delle caselle (coordinate intere). */
export const snapLabel = (n: number): number => Math.round(n);

/** L'altezza del testo in pixel del mondo (una casella = 64) e lo zoom sotto cui le etichette spariscono. */
export const LABEL_FONT_PX = 26;
export const LABEL_ZOOM_MIN = 0.35;
/** Quanto spazio libero lasciare fra l'etichetta e i muri (in caselle: il muro sporge fuori dal tile di mezzo spessore, circa 0,22). */
const MARGIN = 0.4;
/** Passo con cui l'etichetta si allontana dall'area quando il posto è occupato, e quanto scivola di lato lungo il bordo. */
const STEP = 1;
const SLIDE = 1;
const MAX_STEPS = 8;

/** Oltre questa distanza (in caselle) fra l'etichetta e l'area, una linea le collega. */
export const LEADER_MIN_GAP = 1.2;

/**
 * La linea che collega un'etichetta lontana alla sua area: **una sola linea**, dritta e **al centro** dell'etichetta (sopra o sotto di lei se sta sopra o sotto l'area, di lato altrimenti), che
 * arriva al muro esterno dell'area: la faccia fuori del muro dell'ultima casella dell'area lungo quella colonna (o riga). `rect` è l'etichetta in caselle (centro e misure); `tiles` serve a
 * sapere se il lato è sul vuoto (c'è il muro spesso fuori dal bordo) o su un altro tile. Null se l'etichetta è abbastanza vicina all'area.
 */
export function labelLeader(cells: readonly Cell[], rect: { x: number; y: number; w: number; h: number }, tiles?: ReadonlySet<string>): { from: { x: number; y: number }; to: { x: number; y: number } } | null {
  const x0 = rect.x - rect.w / 2, x1 = rect.x + rect.w / 2, y0 = rect.y - rect.h / 2, y1 = rect.y + rect.h / 2;
  let best: { c: Cell; dx: number; dy: number; d: number } | null = null;
  for (const c of cells) {
    const dx = Math.max(c.x - x1, x0 - (c.x + 1), 0);
    const dy = Math.max(c.y - y1, y0 - (c.y + 1), 0);
    const d = Math.hypot(dx, dy);
    if (!best || d < best.d) best = { c, dx, dy, d };
  }
  if (!best || best.d <= LEADER_MIN_GAP) return null;
  const { c, dx, dy } = best;
  // Quanto sporge il muro fuori dal bordo del tile, se il lato guarda il vuoto.
  const wall = (nx: number, ny: number) => (tiles?.has(`${nx},${ny}`) ? 0 : WALL_WIDTH_PX / CELL_SIZE);
  if (dy >= dx) {
    const above = y1 <= c.y;
    const column = cells.filter((k) => k.x === Math.floor(rect.x));
    // La colonna dell'etichetta ha caselle dell'area: l'ultima verso l'etichetta. Altrimenti si ripiega sulla casella più vicina.
    const edge = column.length ? column.reduce((a, b) => (above ? (b.y < a.y ? b : a) : b.y > a.y ? b : a)) : c;
    const x = column.length ? rect.x : Math.min(c.x + 0.85, Math.max(c.x + 0.15, rect.x));
    return above ? { from: { x, y: edge.y - wall(edge.x, edge.y - 1) }, to: { x, y: y1 + 0.05 } } : { from: { x, y: edge.y + 1 + wall(edge.x, edge.y + 1) }, to: { x, y: y0 - 0.05 } };
  }
  const left = x1 <= c.x;
  const row = cells.filter((k) => k.y === Math.floor(rect.y));
  const edge = row.length ? row.reduce((a, b) => (left ? (b.x < a.x ? b : a) : b.x > a.x ? b : a)) : c;
  const y = row.length ? rect.y : Math.min(c.y + 0.85, Math.max(c.y + 0.15, rect.y));
  return left ? { from: { x: edge.x - wall(edge.x - 1, edge.y), y }, to: { x: x1 + 0.05, y } } : { from: { x: edge.x + 1 + wall(edge.x + 1, edge.y), y }, to: { x: x0 - 0.05, y } };
}

/** La misura stimata di un'etichetta in caselle (il carattere dei titoli è largo circa 0,6 volte la sua altezza). */
export function labelSize(text: string): { w: number; h: number } {
  const em = LABEL_FONT_PX / 64;
  return { w: text.length * em * 0.62 + 0.3, h: em * 1.25 };
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const around = (cx: number, cy: number, w: number, h: number): Rect => ({ x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 });
const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Il rettangolo (allargato del margine, meno un filo perché le posizioni di prova stanno proprio a margine) tocca una casella con un tile? */
function hitsTiles(r: Rect, tiles: ReadonlySet<string>): boolean {
  const m = MARGIN - 0.05;
  for (let y = Math.floor(r.y0 - m); y <= Math.floor(r.y1 + m); y++) {
    for (let x = Math.floor(r.x0 - m); x <= Math.floor(r.x1 + m); x++) if (tiles.has(`${x},${y}`)) return true;
  }
  return false;
}

const mean = (n: number[]) => n.reduce((a, b) => a + b, 0) / n.length;

/** Le posizioni di prova si agganciano ai puntini (e se due coincidono se ne tiene una). */
function snapped(list: { cx: number; cy: number }[]): { cx: number; cy: number }[] {
  const seen = new Set<string>();
  return list.map((t) => ({ cx: snapLabel(t.cx), cy: snapLabel(t.cy) })).filter((t) => (seen.has(`${t.cx},${t.cy}`) ? false : (seen.add(`${t.cx},${t.cy}`), true)));
}

/**
 * Dove mettere le etichette delle aree: ognuna **fuori dai tile** (sullo sfondo, come nelle mappe stampate), di preferenza **sopra** l'area e centrata su di essa; se lì c'è qualcosa
 * (un tile, un'altra etichetta) scivola di lato lungo il bordo e poi prova sotto, a sinistra e a destra, allontanandosi a poco a poco. Le etichette già scelte dall'autore (`manual`) restano
 * dove sono e fanno posto alle altre. Il risultato dipende solo dai dati, quindi è lo stesso per tutti i giocatori.
 */
export function placeAreaLabels(areas: readonly LabelArea[], tiles: ReadonlySet<string>): LabelPlace[] {
  const taken: Rect[] = [];
  const out = new Map<string, LabelPlace>();
  for (const a of areas) {
    if (!a.manual) continue;
    const { w, h } = labelSize(a.text);
    out.set(a.id, { id: a.id, text: a.text, x: a.manual.x, y: a.manual.y, cells: a.cells, tiles });
    taken.push(around(a.manual.x, a.manual.y, w, h));
  }
  for (const a of areas) {
    if (out.has(a.id) || !a.cells.length) continue;
    const { w, h } = labelSize(a.text);
    const xs = a.cells.map((c) => c.x);
    const ys = a.cells.map((c) => c.y);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const topX = mean(a.cells.filter((c) => c.y === minY).map((c) => c.x + 0.5));
    const bottomX = mean(a.cells.filter((c) => c.y === maxY).map((c) => c.x + 0.5));
    const leftY = mean(a.cells.filter((c) => c.x === minX).map((c) => c.y + 0.5));
    const rightY = mean(a.cells.filter((c) => c.x === maxX).map((c) => c.y + 0.5));
    // Quanto può scivolare lungo il bordo: la larghezza (o l'altezza) dell'area.
    const slides = (span: number) => {
      const n = Math.ceil(span / SLIDE / 2) + 1;
      return [0, ...Array.from({ length: n }, (_, i) => [(i + 1) * SLIDE, -(i + 1) * SLIDE]).flat()];
    };
    const wide = slides(maxX - minX + 1);
    const tall = slides(maxY - minY + 1);
    const tries = (k: number): { cx: number; cy: number }[] => snapped([
      ...wide.map((d) => ({ cx: topX + d, cy: minY - MARGIN - h / 2 - k * STEP })),
      ...wide.map((d) => ({ cx: bottomX + d, cy: maxY + 1 + MARGIN + h / 2 + k * STEP })),
      ...tall.map((d) => ({ cx: minX - MARGIN - w / 2 - k * STEP, cy: leftY + d })),
      ...tall.map((d) => ({ cx: maxX + 1 + MARGIN + w / 2 + k * STEP, cy: rightY + d })),
    ]);
    let chosen: { cx: number; cy: number } | null = null;
    for (let k = 0; k <= MAX_STEPS && !chosen; k++) {
      chosen = tries(k).find((t) => {
        const r = around(t.cx, t.cy, w, h);
        return !hitsTiles(r, tiles) && !taken.some((o) => overlap(o, around(t.cx, t.cy, w + 0.2, h + 0.1)));
      }) ?? null;
    }
    // Nessun posto libero: sopra l'area, e pazienza.
    const at = chosen ?? { cx: snapLabel(topX), cy: snapLabel(minY - MARGIN - h / 2) };
    out.set(a.id, { id: a.id, text: a.text, x: at.cx, y: at.cy, cells: a.cells, tiles });
    taken.push(around(at.cx, at.cy, w, h));
  }
  return areas.flatMap((a) => out.get(a.id) ?? []);
}
