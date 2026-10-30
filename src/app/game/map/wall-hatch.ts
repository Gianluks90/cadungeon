import { Graphics, GraphicsContext } from 'pixi.js';
import { CELL_SIZE, WALL_HATCH, WALL_WIDTH_PX } from '../constants';
import { LINE, theme } from '../theme';

/** I disegni già calcolati: la retinatura dipende solo dalle caselle dei tile, dalla distanza fra le linee (cioè dallo zoom) e dai colori, quindi si riusa finché non cambiano (l'anteprima di un tile in mano la richiede a ogni movimento). */
const cache = new Map<string, GraphicsContext>();

/** I disegni vivi, con le loro caselle: quando lo zoom cambia livello di dettaglio si rimette in ognuno il disegno con le linee giuste. */
const live = new Set<Graphics>();
const sources = new WeakMap<Graphics, ReadonlySet<string>>();

/** Lo zoom di adesso, dato dalla camera (`setHatchZoom`), e quante linee gli corrispondono. */
let currentSpacing = spacingAt(1);

/** La distanza fra le linee a questo zoom, o 0 se da qui non se ne vedono. */
function spacingAt(zoom: number): number {
  let spacing = 0;
  for (const l of WALL_HATCH.lod) if (zoom >= l.minZoom) spacing = l.spacing;
  return spacing;
}

/**
 * La camera dice a che zoom è. Da lontano le linee si infittirebbero in un alone simile a nebbia, quindi la retinatura ha più livelli di dettaglio (`WALL_HATCH.lod`): nessuna linea da
 * molto lontano e sempre più linee man mano che ci si avvicina. Cambia solo quando si passa da un livello all'altro. Sceglie lo zoom la camera, non il disegno: così un disegno nuovo (l'editor
 * li rifà a ogni movimento del mouse) parte già con le linee giuste, senza lampeggiare.
 */
export function setHatchZoom(zoom: number) {
  const next = spacingAt(zoom);
  if (next === currentSpacing) return;
  currentSpacing = next;
  for (const g of live) {
    if (g.destroyed) live.delete(g);
    else apply(g);
  }
}

function apply(g: Graphics) {
  const cells = sources.get(g);
  g.visible = currentSpacing > 0 && !!cells;
  if (g.visible && cells) g.context = contextFor(cells, currentSpacing);
}

function contextFor(cells: ReadonlySet<string>, spacing: number): GraphicsContext {
  const key = `${theme.color.linePrimary}|${theme.alpha.wallHatch}|${spacing}|${[...cells].sort().join(';')}`;
  let ctx = cache.get(key);
  if (!ctx) {
    ctx = build(cells, spacing);
    if (cache.size >= 9) cache.delete(cache.keys().next().value!);
    cache.set(key, ctx);
  }
  return ctx;
}

/**
 * La retinatura di contorno dei muri, come nei disegni architettonici: fuori dai muri perimetrali, linee sottilissime oblique (45°, allineate al mondo, così proseguono uguali attorno agli
 * angoli) che dalla faccia esterna del muro arrivano fino alla prima fila di puntini della griglia (a una cella dal bordo del tile) e lì finiscono, sfumando piano. Il risultato è un
 * contorno soffuso che si scioglie nello sfondo a puntini. Sta sotto i muri e si disegna solo nel vuoto accanto alle caselle dei tile (`cells`, chiavi "x,y"); quante linee ha dipende dallo zoom.
 */
export function drawWallHatch(cells: ReadonlySet<string>): Graphics {
  const g = new Graphics(contextFor(cells, currentSpacing || WALL_HATCH.lod[WALL_HATCH.lod.length - 1].spacing));
  sources.set(g, cells);
  live.add(g);
  apply(g);
  return g;
}

/** I tratti della retinatura, per livello di opacità (0 il più tenue): x0, y0, x1, y1 in pixel del mondo. */
export function hatchBatches(cells: ReadonlySet<string>, spacing: number = WALL_HATCH.lod[WALL_HATCH.lod.length - 1].spacing): number[][] {
  const has = (x: number, y: number) => cells.has(`${x},${y}`);
  const { step, levels } = WALL_HATCH;
  const C = CELL_SIZE;
  const wall = WALL_WIDTH_PX;
  const reach = C; // fino alla prima fila di puntini, a una cella dal bordo del tile
  // Per ogni livello di opacità, i tratti da disegnare (x0, y0, x1, y1).
  const batches: number[][] = Array.from({ length: levels }, () => []);

  // Le caselle vuote accanto (anche in diagonale) a una casella di tile: gli unici posti dove c'è retinatura.
  const voids = new Set<string>();
  for (const k of cells) {
    const [cx, cy] = k.split(',').map(Number);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!has(cx + dx, cy + dy)) voids.add(`${cx + dx},${cy + dy}`);
  }

  for (const k of voids) {
    const [vx, vy] = k.split(',').map(Number);
    // Le caselle di tile intorno: oltre queste, la distanza dal tile è già maggiore di una cella.
    const near: [number, number][] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (has(vx + dx, vy + dy)) near.push([(vx + dx) * C, (vy + dy) * C]);
    const L = vx * C;
    const R = L + C;
    const T = vy * C;
    const B = T + C;
    // Distanza (a quadretti, come l'ingrandimento del tile) dal tile più vicino.
    const dist = (px: number, py: number) => {
      let best = Infinity;
      for (const [rx, ry] of near) best = Math.min(best, Math.max(rx - px, 0, px - (rx + C), ry - py, 0, py - (ry + C)));
      return best;
    };
    // Linee x + y = s, con s multiplo di `spacing` (allineate al mondo).
    for (let s = Math.ceil((L + T) / spacing) * spacing; s <= R + B; s += spacing) {
      const xa = Math.max(L, s - B);
      const xb = Math.min(R, s - T);
      if (xa >= xb) continue;
      let runLevel = -1;
      let runStart = xa;
      const close = (xEnd: number) => {
        if (runLevel >= 0 && xEnd > runStart) batches[runLevel].push(runStart, s - runStart, xEnd, s - xEnd);
      };
      for (let x = xa; x < xb; x += step) {
        const x1 = Math.min(xb, x + step);
        const mx = (x + x1) / 2;
        const d = dist(mx, s - mx);
        const t = (d - wall) / (reach - wall); // 0 sulla faccia esterna del muro, 1 sulla prima fila di puntini
        const level = t < 0 || t >= 1 ? -1 : Math.min(levels - 1, Math.floor((1 - t) * levels)); // più vicino al muro = più forte
        if (level !== runLevel) {
          close(x);
          runLevel = level;
          runStart = x;
        }
      }
      close(xb);
    }
  }

  return batches;
}

function build(cells: ReadonlySet<string>, spacing: number): GraphicsContext {
  const g = new Graphics();
  const { levels } = WALL_HATCH;
  const batches = hatchBatches(cells, spacing);
  for (let level = 0; level < levels; level++) {
    const seg = batches[level];
    if (!seg.length) continue;
    for (let i = 0; i < seg.length; i += 4) g.moveTo(seg[i], seg[i + 1]).lineTo(seg[i + 2], seg[i + 3]);
    // Il livello 0 è il più lontano dal muro (il più tenue), l'ultimo il più vicino.
    g.stroke({ width: LINE.hairline, color: theme.color.linePrimary, alpha: theme.alpha.wallHatch * ((level + 1) / levels), pixelLine: true });
  }
  return g.context;
}
