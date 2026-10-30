import { Container, Graphics } from 'pixi.js';
import {
  CELL_SIZE,
  FLOOR_CRACK_CHANCE,
  JAMB_POST_LENGTH_PX,
  PERIMETER_PILLARS,
  PERIMETER_PILLAR_CHAMFER,
  PERIMETER_DIAGONAL_JOINTS,
  PERIMETER_WALLS_OUTSIDE,
  WALL_GAP_RATIO,
  WALL_LINE_PX,
  WALL_HATCH,
  WALL_WIDTH_PX,
} from '../constants';
import { LINE, theme } from '../theme';
import { makeCracks } from './cracks';
import { SceneryContext, drawScenery } from './scenery';
import { PlacedTile } from './map-data';
import { tileCells, tileRects } from './tile';
import { mixSeed, mulberry32 } from './rng';
import { MapWalls, WallSegment, buildWalls, passageShifts } from './walls';
import { drawWallHatch } from './wall-hatch';

export interface MapBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rettangolo che contiene tutti i tile, in pixel. */
export function mapBounds(placed: PlacedTile[]): MapBounds {
  const xs = placed.flatMap((t) => [t.x, t.x + t.def.size.w]);
  const ys = placed.flatMap((t) => [t.y, t.y + t.def.size.h]);
  const x = Math.min(...xs) * CELL_SIZE;
  const y = Math.min(...ys) * CELL_SIZE;
  return { x, y, w: Math.max(...xs) * CELL_SIZE - x, h: Math.max(...ys) * CELL_SIZE - y };
}

/**
 * Disegna la mappa a livelli: prima i pavimenti di tutti i tile, poi tutti i muri sopra.
 * `highlight` è un tile da far risaltare (quello che si sta per agganciare).
 */
/** `noCracks`: caselle ("x,y" della mappa) senza crepe né altri dettagli, come quelle dei glifi. */
/** `extraWalls`: muri in più, in celle (i lati chiusi delle scale), disegnati insieme agli altri così si fondono con loro. */
export function createMapView(
  seed: number,
  placed: PlacedTile[],
  highlight?: PlacedTile,
  noCracks?: ReadonlySet<string>,
  extraWalls: readonly WallSegment[] = [],
  scenery: SceneryContext = {},
): Container {
  const view = new Container();
  const parts = createMapParts(seed, placed, highlight, noCracks, extraWalls, scenery);
  for (const f of parts.floors) view.addChild(f);
  for (const s of parts.sceneries) view.addChild(s); // livello 3: sopra pavimento e fratture, sotto i muri
  view.addChild(parts.hatch, parts.walls); // la retinatura sta fuori dai tile, sotto i muri
  return view;
}

/**
 * I pezzi con cui si compone la mappa, separati: il pavimento e i dettagli scenici di ogni tile (nello stesso ordine di `placed`) e i muri, che sono un disegno unico perché si fondono
 * fra tile vicini. Serve a chi vuole animare i tile uno alla volta (l'apparizione della mappa nell'editor); `createMapView` li mette insieme.
 */
export function createMapParts(
  seed: number,
  placed: PlacedTile[],
  highlight?: PlacedTile,
  noCracks?: ReadonlySet<string>,
  extraWalls: readonly WallSegment[] = [],
  scenery: SceneryContext = {},
): { floors: Graphics[]; sceneries: Container[]; walls: Graphics; hatch: Graphics } {
  const { walls, passages } = buildWalls(placed);
  const cells = allCells(placed);
  return {
    hatch: WALL_HATCH.enabled ? drawWallHatch(cells) : new Graphics(),
    floors: placed.map((tile) => drawFloor(tile, seed, tile === highlight, noCracks)),
    sceneries: placed.map((tile) => drawScenery(tile, seed, { skip: noCracks, ...scenery })),
    walls: drawWalls({ walls, passages }, extraWalls, PERIMETER_WALLS_OUTSIDE ? cells : null),
  };
}

/** Le caselle di tutti i tile, come "x,y". */
function allCells(placed: PlacedTile[]): Set<string> {
  const out = new Set<string>();
  for (const t of placed) for (const k of tileCells(t.def)) {
    const [cx, cy] = k.split(',').map(Number);
    out.add(`${t.x + cx},${t.y + cy}`);
  }
  return out;
}

/** Pavimento in tinta unita (opaco, copre i puntini) con la griglia delle celle a linee sottili. */
function drawFloor(tile: PlacedTile, seed: number, highlighted: boolean, noCracks?: ReadonlySet<string>): Graphics {
  const { w, h } = tile.def.size;
  const rects = tileRects(tile.def);
  const cells = tileCells(tile.def);
  const g = new Graphics();
  g.position.set(tile.x * CELL_SIZE, tile.y * CELL_SIZE);
  for (const r of rects) g.rect(r.x * CELL_SIZE, r.y * CELL_SIZE, r.w * CELL_SIZE, r.h * CELL_SIZE);
  g.fill(highlighted ? theme.color.floorHighlight : theme.color.floor);

  for (const r of rects) {
    const x0 = r.x * CELL_SIZE;
    const y0 = r.y * CELL_SIZE;
    for (let cx = 0; cx <= r.w; cx++) g.moveTo(x0 + cx * CELL_SIZE, y0).lineTo(x0 + cx * CELL_SIZE, y0 + r.h * CELL_SIZE);
    for (let cy = 0; cy <= r.h; cy++) g.moveTo(x0, y0 + cy * CELL_SIZE).lineTo(x0 + r.w * CELL_SIZE, y0 + cy * CELL_SIZE);
  }
  // pixelLine: la linea resta spessa 1 pixel a schermo a qualsiasi zoom.
  g.stroke({ width: LINE.hairline, color: theme.color.lineSecondary, alpha: theme.alpha.grid, pixelLine: true });

  // Fratture: solo su alcune lastre. Il seme della mappa le rende uguali su ogni client.
  const rng = mulberry32(mixSeed(seed, tile.x, tile.y));
  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      if (!cells.has(`${cx},${cy}`) || rng() >= FLOOR_CRACK_CHANCE) continue;
      // Un bordo è "interno" se oltre c'è un'altra cella dello stesso tile; altrimenti c'è il muro.
      const edges = {
        n: cells.has(`${cx},${cy - 1}`),
        s: cells.has(`${cx},${cy + 1}`),
        w: cells.has(`${cx - 1},${cy}`),
        e: cells.has(`${cx + 1},${cy}`),
      };
      const lines = makeCracks(rng, edges); // si generano comunque: così le crepe delle altre caselle non cambiano
      if (noCracks?.has(`${tile.x + cx},${tile.y + cy}`)) continue;
      for (const line of lines) {
        g.moveTo(cx * CELL_SIZE + line[0], cy * CELL_SIZE + line[1]);
        for (let i = 2; i < line.length; i += 2) g.lineTo(cx * CELL_SIZE + line[i], cy * CELL_SIZE + line[i + 1]);
      }
    }
  }
  g.stroke({ width: LINE.hairline, color: theme.color.lineDetail, alpha: theme.alpha.crack, pixelLine: true });
  return g;
}

/**
 * Un pezzo di muro: `a0`-`a1` è il tratto lungo l'asse, `c` la linea centrale.
 * `ext0` e `ext1` sono quanto la fascia chiara sporge oltre gli estremi (come uno spigolo pieno);
 * la striscia scura sporge in proporzione. `closed0` e `closed1` chiudono l'estremo con la linea chiara
 * (la striscia scura si ferma prima), invece di lasciarlo aperto come un tubo.
 */
export interface WallPiece {
  horizontal: boolean;
  a0: number;
  a1: number;
  c: number;
  thickness: number;
  ext0: number;
  ext1: number;
  closed0?: boolean;
  closed1?: boolean;
  /** Una colonna: un rettangolo (da `a0` a `a1` in larghezza, `thickness` in altezza, centrato su `c`) con la fascia chiara attorno e la striscia scura dentro. */
  box?: boolean;
  /** Un poligono con la fascia chiara (`outer`) e la striscia scura dentro (`inner`), come punti x, y in pixel. */
  shape?: { outer: number[]; inner: number[] };
  /** Di una colonna: di quanto è tagliato a 45° ognuno dei quattro angoli (alto a sinistra, alto a destra, basso a destra, basso a sinistra; 0 = angolo retto). */
  cuts?: [number, number, number, number];
}

/**
 * Il disegno dei muri con i perimetrali fuori dal bordo (`PERIMETER_WALLS_OUTSIDE`). Ogni lato di cella dei muri dei tile si guarda dai due lati: se tutte e due le caselle sono di un tile è un
 * muro condiviso (resta centrato sulla linea, come i cardini delle porte); se una sola lo è, il lato guarda il vuoto e il muro si sposta di mezzo spessore verso fuori, con la faccia interna
 * sul bordo. I lati perimetrali consecutivi si uniscono in un tratto; agli estremi il muro si allunga (angolo convesso) o si accorcia (angolo concavo) di mezzo spessore, così i tratti
 * che si incontrano si saldano senza buchi né sporgenze.
 */
export function outsideWalls(walls: readonly WallSegment[], cells: ReadonlySet<string>, centered: (s: WallSegment, ext0?: number, ext1?: number) => void, pieces: WallPiece[]) {
  const T = WALL_WIDTH_PX;
  const has = (x: number, y: number) => cells.has(`${x},${y}`);
  const shared = new Set<string>();
  const sharedVertices = new Set<string>();
  const outerVertices = new Map<string, { h: Set<number>; v: Set<number>; hn: number; vn: number }>(); // per vertice: da che parte (-1 o +1) guardano il vuoto i muri perimetrali orizzontali e verticali che ci arrivano
  const outer = new Map<string, { horizontal: boolean; line: number; dir: number; units: Set<number> }>();
  for (const s of walls) {
    const horizontal = s.y1 === s.y2;
    const line = horizontal ? s.y1 : s.x1;
    const start = horizontal ? s.x1 : s.y1;
    const end = horizontal ? s.x2 : s.y2;
    for (let u = start; u < end; u++) {
      const before = horizontal ? has(u, line - 1) : has(line - 1, u); // sopra / a sinistra del lato
      const after = horizontal ? has(u, line) : has(line, u); // sotto / a destra
      const ends = horizontal ? [`${u},${line}`, `${u + 1},${line}`] : [`${line},${u}`, `${line},${u + 1}`]; // i due vertici del lato
      if (before && after) {
        shared.add(`${horizontal ? 'h' : 'v'}|${line}|${u}`);
        ends.forEach((v) => sharedVertices.add(v));
      } else if (before || after) {
        const dir = before ? 1 : -1; // verso il vuoto: giù/destra se la casella piena è prima, su/sinistra altrimenti
        for (const v of ends) {
          if (!outerVertices.has(v)) outerVertices.set(v, { h: new Set(), v: new Set(), hn: 0, vn: 0 });
          const o = outerVertices.get(v)!;
          o[horizontal ? 'h' : 'v'].add(dir);
          o[horizontal ? 'hn' : 'vn']++;
        }
        const k = `${horizontal ? 'h' : 'v'}|${line}|${dir}`;
        if (!outer.has(k)) outer.set(k, { horizontal, line, dir, units: new Set() });
        outer.get(k)!.units.add(u);
      }
    }
  }

  const half = T / 2;
  // I lati condivisi, uniti in tratti, centrati sulla linea come prima.
  const sharedRuns = new Map<string, number[]>();
  for (const k of shared) {
    const [o, line, u] = k.split('|');
    const key = `${o}|${line}`;
    if (!sharedRuns.has(key)) sharedRuns.set(key, []);
    sharedRuns.get(key)!.push(Number(u));
  }
  for (const [key, list] of sharedRuns) {
    const [o, lineText] = key.split('|');
    const line = Number(lineText);
    const sorted = [...list].sort((a, b) => a - b);
    let from = sorted[0];
    sorted.forEach((u, i) => {
      if (i === sorted.length - 1 || sorted[i + 1] !== u + 1) {
        // Un estremo che finisce contro il vuoto da tutti e due i lati incontra i muri perimetrali di fuori: si allunga di uno spessore intero per arrivare alla loro faccia esterna.
        const horizontal = o === 'h';
        const voidBeyond = (n: number) => (horizontal ? !has(n, line - 1) && !has(n, line) : !has(line - 1, n) && !has(line, n));
        centered(horizontal ? { x1: from, y1: line, x2: u + 1, y2: line } : { x1: line, y1: from, x2: line, y2: u + 1 }, voidBeyond(from - 1) ? T : half, voidBeyond(u + 1) ? T : half);
        from = sorted[i + 1];
      }
    });
  }

  // Quanto si sposta l'estremo di un tratto perimetrale in un vertice: +1 se il contorno gira verso fuori (una sola casella piena intorno: angolo convesso), -1 se gira verso dentro
  // (tre caselle piene: angolo concavo), 0 se il tratto prosegue dritto.
  const adjust = (vx: number, vy: number) => {
    const n = [has(vx - 1, vy - 1), has(vx, vy - 1), has(vx - 1, vy), has(vx, vy)].filter(Boolean).length;
    return n === 1 ? 1 : n === 3 ? -1 : n === 2 && has(vx - 1, vy - 1) === has(vx, vy) ? 1 : 0; // due caselle in diagonale: due angoli convessi
  };
  // Un vertice dove le uniche due caselle di tile intorno sono in diagonale: 'tl' (alto a sinistra e basso a destra) o 'tr' (alto a destra e basso a sinistra).
  const diagonalOf = (vx: number, vy: number): 'tl' | 'tr' | null => {
    const tl = has(vx - 1, vy - 1);
    const tr = has(vx, vy - 1);
    const bl = has(vx - 1, vy);
    const br = has(vx, vy);
    return tl && br && !tr && !bl ? 'tl' : tr && bl && !tl && !br ? 'tr' : null;
  };
  const joints = new Set<string>();
  for (const { horizontal, line, dir, units } of outer.values()) {
    const sorted = [...units].sort((a, b) => a - b);
    let from = sorted[0];
    sorted.forEach((u, i) => {
      if (i < sorted.length - 1 && sorted[i + 1] === u + 1) return;
      const to = u + 1;
      const v = (n: number) => (horizontal ? adjust(n, line) : adjust(line, n));
      // Dove due tile si toccano solo d'angolo il tratto finisce dentro il giunto obliquo, che disegna il resto (`diagonalJoint`): si ferma mezzo spessore prima del vertice e senza sporgere.
      const joint = (n: number) => PERIMETER_DIAGONAL_JOINTS && diagonalOf(horizontal ? n : line, horizontal ? line : n) !== null;
      const j0 = joint(from);
      const j1 = joint(to);
      const a0 = j0 ? from * CELL_SIZE + half : from * CELL_SIZE - v(from) * half;
      const a1 = j1 ? to * CELL_SIZE - half : to * CELL_SIZE + v(to) * half;
      pieces.push({ horizontal, a0, a1, c: line * CELL_SIZE + dir * half, thickness: T, ext0: j0 ? 0 : half, ext1: j1 ? 0 : half });
      if (j0) joints.add(horizontal ? `${from},${line}` : `${line},${from}`);
      if (j1) joints.add(horizontal ? `${to},${line}` : `${line},${to}`);
      from = sorted[i + 1];
    });
  }

  // Giunto obliquo: dove due tile si toccano solo d'angolo i loro angoli convessi si sovrappongono e lasciano un quadratino. Qui i due angoli di pavimento sono tagliati a 45° e i muri dei due
  // vuoti si uniscono con una fascia diagonale larga quanto un muro: un solo pezzo, con la fascia chiara attorno e la striscia scura dentro che continua nei muri che lo toccano.
  for (const v of joints) {
    const [vx, vy] = v.split(',').map(Number);
    const mirror = diagonalOf(vx, vy) === 'tr' ? -1 : 1;
    const W = T;
    const c = T / Math.SQRT2;
    const L = WALL_LINE_PX;
    const k = Math.SQRT2 - 1;
    const outerPts: [number, number][] = [[0, -W], [W, -W], [W, 0], [c, 0], [0, c], [0, W], [-W, W], [-W, 0], [-c, 0], [0, -c]];
    const innerPts: [number, number][] = [
      [L, -W + L], [W - L, -W + L], [W - L, -L], [c - L * k, -L], [-L, c - L * k], [-L, W - L], [-W + L, W - L], [-W + L, L], [-c + L * k, L], [L, -c + L * k],
    ];
    const place = (pts: [number, number][]) => pts.flatMap(([x, y]) => [vx * CELL_SIZE + mirror * x, vy * CELL_SIZE + y]);
    pieces.push({ horizontal: true, a0: 0, a1: 0, c: 0, thickness: 0, ext0: 0, ext1: 0, shape: { outer: place(outerPts), inner: place(innerPts) } });
  }

  // Dove un muro condiviso (centrato) incontra uno perimetrale (spostato fuori) i due non combaciano e resta un buco o un gradino di mezzo spessore: una colonna li copre. È una sola, grande
  // quanto basta per comprendere tutte le pareti che arrivano (il quadrato centrato sul vertice, più mezzo spessore verso fuori per ogni muro perimetrale), disegnata come un muro (fascia
  // chiara e striscia scura dentro) così si fonde con quelli che la toccano. Dove un perimetrale passa dritto da un lato all'altro (un tramezzo che lo incontra) non serve: i muri si saldano già.
  if (PERIMETER_PILLARS) {
    for (const v of sharedVertices) {
      const out = outerVertices.get(v);
      if (!out) continue;
      const straight = (out.hn === 2 && !out.v.size) || (out.vn === 2 && !out.h.size);
      if (straight) continue;
      const [vx, vy] = v.split(',').map(Number);
      const lo = (dirs: Set<number>) => -half - (dirs.has(-1) ? half : 0);
      const hi = (dirs: Set<number>) => half + (dirs.has(1) ? half : 0);
      const x0 = vx * CELL_SIZE + lo(out.v);
      const x1 = vx * CELL_SIZE + hi(out.v);
      const y0 = vy * CELL_SIZE + lo(out.h);
      const y1 = vy * CELL_SIZE + hi(out.h);
      // I quadrati che la formano (relativi al vertice): quello del muro condiviso e, per i perimetrali, quello d'angolo (o, se ne arriva uno solo, il suo).
      const squares: [number, number][] = [[0, 0]];
      if (out.h.size && out.v.size) for (const dy of out.h) for (const dx of out.v) squares.push([dx * half, dy * half]);
      else {
        for (const dy of out.h) squares.push([0, dy * half]);
        for (const dx of out.v) squares.push([dx * half, 0]);
      }
      // Gli angoli del rettangolo che non stanno dentro nessun quadrato sono pavimento che sporge: con `PERIMETER_PILLAR_CHAMFER` si tagliano a 45°, il collegamento obliquo fra le due pareti.
      const exposed = (px: number, py: number) => PERIMETER_PILLAR_CHAMFER && !squares.some(([sx, sy]) => Math.abs(sx - px) < half && Math.abs(sy - py) < half);
      const cx0 = x0 - vx * CELL_SIZE;
      const cy0 = y0 - vy * CELL_SIZE;
      const cx1 = x1 - vx * CELL_SIZE;
      const cy1 = y1 - vy * CELL_SIZE;
      const q = half / 2;
      const cuts: [number, number, number, number] = [
        exposed(cx0 + q, cy0 + q) ? half : 0, // alto a sinistra
        exposed(cx1 - q, cy0 + q) ? half : 0, // alto a destra
        exposed(cx1 - q, cy1 - q) ? half : 0, // basso a destra
        exposed(cx0 + q, cy1 - q) ? half : 0, // basso a sinistra
      ];
      pieces.push({ horizontal: true, a0: x0, a1: x1, c: (y0 + y1) / 2, thickness: y1 - y0, ext0: 0, ext1: 0, box: true, cuts });
    }
  }
}

/**
 * Muri a doppia linea, disegnati da codice: una fascia chiara, poi una striscia scura al centro.
 * Ai due lati di ogni varco sporge un piccolo blocco, nello stesso stile: serve a riconoscere il varco
 * e, quando ci saranno le porte, è dove si agganciano i cardini.
 */
export function wallPieces({ walls, passages }: MapWalls, extraWalls: readonly WallSegment[], cells: ReadonlySet<string> | null): WallPiece[] {
  const T = WALL_WIDTH_PX;
  const pieces: WallPiece[] = [];

  const centered = (s: WallSegment, ext0 = T / 2, ext1 = T / 2) => {
    const horizontal = s.y1 === s.y2;
    const a = (horizontal ? s.x1 : s.y1) * CELL_SIZE;
    const b = (horizontal ? s.x2 : s.y2) * CELL_SIZE;
    const c = (horizontal ? s.y1 : s.x1) * CELL_SIZE;
    pieces.push({ horizontal, a0: a, a1: b, c, thickness: T, ext0, ext1 });
  };

  if (!cells) {
    for (const s of [...walls, ...extraWalls.filter((x) => !x.doorPosts)]) centered(s);
  } else {
    outsideWalls(walls, cells, centered, pieces);
    for (const s of extraWalls) if (!s.doorPosts) centered(s); // i muri delle scale e quelli d'autore restano centrati sulla linea
  }

  // Gli stipiti: ai due lati di ogni varco con gli stipiti e di ogni porta che non sta su un varco (i tratti `doorPosts` di `extraWalls`).
  const posts = [
    ...passages.filter((p) => p.posts),
    ...extraWalls.filter((s) => s.doorPosts).map((s) => ({ horizontal: s.y1 === s.y2, line: s.y1 === s.y2 ? s.y1 : s.x1, from: s.y1 === s.y2 ? s.x1 : s.y1, to: s.y1 === s.y2 ? s.x2 : s.y2 })),
  ];
  for (const p of posts) {
    const from = p.from * CELL_SIZE;
    const to = p.to * CELL_SIZE;
    const c = p.line * CELL_SIZE;
    const base = { horizontal: p.horizontal, thickness: T, ext0: 0, ext1: 0 };
    // Con i muri perimetrali fuori dal bordo, uno stipite attaccato a uno di loro si sposta con lui (altrimenti resterebbe un gradino).
    const shift = cells ? passageShifts((x, y) => cells.has(`${x},${y}`), p, T / 2) : { start: 0, end: 0, mid: 0, baseStart: 0, baseEnd: 0 };
    // La punta di ogni blocco (verso l'interno del varco) è chiusa; la base si fonde col muro.
    pieces.push({ ...base, c: c + shift.start, a0: from + shift.baseStart, a1: from + JAMB_POST_LENGTH_PX, closed1: true }); // la base entra nel muro perimetrale (baseStart è negativo)
    pieces.push({ ...base, c: c + shift.end, a0: to - JAMB_POST_LENGTH_PX, a1: to + shift.baseEnd, closed0: true });
  }

  return pieces;
}

function drawWalls(map: MapWalls, extraWalls: readonly WallSegment[], cells: ReadonlySet<string> | null): Graphics {
  const T = WALL_WIDTH_PX;
  const pieces = wallPieces(map, extraWalls, cells);

  const g = new Graphics();
  const rect = (p: WallPiece, k: number, color: number) => {
    if (p.shape) {
      g.poly(k === 1 ? p.shape.outer : p.shape.inner).fill(color);
      return;
    }
    if (p.box) {
      const inset = k === 1 ? 0 : WALL_LINE_PX;
      const x0 = p.a0 + inset;
      const x1 = p.a1 - inset;
      const y0 = p.c - p.thickness / 2 + inset;
      const y1 = p.c + p.thickness / 2 - inset;
      // Il taglio a 45° resta parallelo a quello esterno, a distanza `inset` dentro: la gamba si accorcia di inset × (2 − √2).
      const [tl, tr, br, bl] = (p.cuts ?? [0, 0, 0, 0]).map((c) => (c ? Math.max(0, c - inset * (2 - Math.SQRT2)) : 0));
      g.poly([x0 + tl, y0, x1 - tr, y0, x1, y0 + tr, x1, y1 - br, x1 - br, y1, x0 + bl, y1, x0, y1 - bl, x0, y0 + tl]).fill(color);
      return;
    }
    const thickness = p.thickness * k;
    // Estremo chiuso: la striscia scura si ferma a distanza di una linea chiara dalla punta.
    const line = (p.thickness * (1 - k)) / 2;
    const a0 = p.a0 - p.ext0 * k + (p.closed0 ? line : 0);
    const a1 = p.a1 + p.ext1 * k - (p.closed1 ? line : 0);
    if (p.horizontal) g.rect(a0, p.c - thickness / 2, a1 - a0, thickness).fill(color);
    else g.rect(p.c - thickness / 2, a0, thickness, a1 - a0).fill(color);
  };
  for (const p of pieces) rect(p, 1, theme.color.linePrimary);
  for (const p of pieces) rect(p, WALL_GAP_RATIO, theme.color.wallGap);
  return g;
}
