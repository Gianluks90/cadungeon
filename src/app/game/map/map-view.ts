import { Container, Graphics } from 'pixi.js';
import {
  CELL_SIZE,
  FLOOR_COLOR,
  FLOOR_CRACK_ALPHA,
  FLOOR_CRACK_CHANCE,
  FLOOR_CRACK_COLOR,
  GRID_LINE_ALPHA,
  GRID_LINE_COLOR,
  JAMB_POST_LENGTH_PX,
  WALL_GAP_COLOR,
  WALL_GAP_RATIO,
  WALL_LINE_COLOR,
  WALL_WIDTH_PX,
} from '../constants';
import { makeCracks } from './cracks';
import { PlacedTile } from './map-data';
import { mixSeed, mulberry32 } from './rng';
import { MapWalls, buildWalls } from './walls';

export interface MapBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Disegna la mappa a livelli: prima i pavimenti di tutti i tile, poi tutti i muri sopra. */
export function createMapView(seed: number, placed: PlacedTile[]): { view: Container; bounds: MapBounds } {
  const view = new Container();
  for (const tile of placed) view.addChild(drawFloor(tile, seed));
  view.addChild(drawWalls(buildWalls(placed)));

  const xs = placed.flatMap((t) => [t.x, t.x + t.def.size.w]);
  const ys = placed.flatMap((t) => [t.y, t.y + t.def.size.h]);
  const x = Math.min(...xs) * CELL_SIZE;
  const y = Math.min(...ys) * CELL_SIZE;
  return {
    view,
    bounds: { x, y, w: Math.max(...xs) * CELL_SIZE - x, h: Math.max(...ys) * CELL_SIZE - y },
  };
}

/** Pavimento in tinta unita (opaco, copre i puntini) con la griglia delle celle a linee sottili. */
function drawFloor(tile: PlacedTile, seed: number): Graphics {
  const { w, h } = tile.def.size;
  const g = new Graphics();
  g.position.set(tile.x * CELL_SIZE, tile.y * CELL_SIZE);
  g.rect(0, 0, w * CELL_SIZE, h * CELL_SIZE).fill(FLOOR_COLOR);

  for (let cx = 0; cx <= w; cx++) g.moveTo(cx * CELL_SIZE, 0).lineTo(cx * CELL_SIZE, h * CELL_SIZE);
  for (let cy = 0; cy <= h; cy++) g.moveTo(0, cy * CELL_SIZE).lineTo(w * CELL_SIZE, cy * CELL_SIZE);
  // pixelLine: la linea resta spessa 1 pixel a schermo a qualsiasi zoom.
  g.stroke({ width: 1, color: GRID_LINE_COLOR, alpha: GRID_LINE_ALPHA, pixelLine: true });

  // Fratture: solo su alcune lastre. Il seme della mappa le rende uguali su ogni client.
  const rng = mulberry32(mixSeed(seed, tile.x, tile.y));
  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      if (rng() >= FLOOR_CRACK_CHANCE) continue;
      const edges = { n: cy > 0, s: cy < h - 1, w: cx > 0, e: cx < w - 1 };
      for (const line of makeCracks(rng, edges)) {
        g.moveTo(cx * CELL_SIZE + line[0], cy * CELL_SIZE + line[1]);
        for (let i = 2; i < line.length; i += 2) g.lineTo(cx * CELL_SIZE + line[i], cy * CELL_SIZE + line[i + 1]);
      }
    }
  }
  // Come la griglia: linea sottile, sempre 1 pixel a schermo.
  g.stroke({ width: 1, color: FLOOR_CRACK_COLOR, alpha: FLOOR_CRACK_ALPHA, pixelLine: true });
  return g;
}

/**
 * Un pezzo di muro: `a0`-`a1` è il tratto lungo l'asse, `c` la linea centrale.
 * `ext0` e `ext1` sono quanto la fascia chiara sporge oltre gli estremi (come uno spigolo pieno);
 * la striscia scura sporge in proporzione. `closed0` e `closed1` chiudono l'estremo con la linea chiara
 * (la striscia scura si ferma prima), invece di lasciarlo aperto come un tubo.
 */
interface WallPiece {
  horizontal: boolean;
  a0: number;
  a1: number;
  c: number;
  thickness: number;
  ext0: number;
  ext1: number;
  closed0?: boolean;
  closed1?: boolean;
}

/**
 * Muri a doppia linea, disegnati da codice: una fascia chiara, poi una striscia scura al centro.
 * Ai due lati di ogni varco sporge un piccolo blocco, nello stesso stile: serve a riconoscere il varco
 * e, quando ci saranno le porte, è dove si agganciano i cardini.
 */
function drawWalls({ walls, passages }: MapWalls): Graphics {
  const T = WALL_WIDTH_PX;
  const pieces: WallPiece[] = [];

  for (const s of walls) {
    const horizontal = s.y1 === s.y2;
    const a = (horizontal ? s.x1 : s.y1) * CELL_SIZE;
    const b = (horizontal ? s.x2 : s.y2) * CELL_SIZE;
    const c = (horizontal ? s.y1 : s.x1) * CELL_SIZE;
    pieces.push({ horizontal, a0: a, a1: b, c, thickness: T, ext0: T / 2, ext1: T / 2 });
  }

  for (const p of passages) {
    const from = p.from * CELL_SIZE;
    const to = p.to * CELL_SIZE;
    const c = p.line * CELL_SIZE;
    const base = { horizontal: p.horizontal, c, thickness: T, ext0: 0, ext1: 0 };
    // La punta di ogni blocco (verso l'interno del varco) è chiusa; la base si fonde col muro.
    pieces.push({ ...base, a0: from, a1: from + JAMB_POST_LENGTH_PX, closed1: true });
    pieces.push({ ...base, a0: to - JAMB_POST_LENGTH_PX, a1: to, closed0: true });
  }

  const g = new Graphics();
  const rect = (p: WallPiece, k: number, color: number) => {
    const thickness = p.thickness * k;
    // Estremo chiuso: la striscia scura si ferma a distanza di una linea chiara dalla punta.
    const line = (p.thickness * (1 - k)) / 2;
    const a0 = p.a0 - p.ext0 * k + (p.closed0 ? line : 0);
    const a1 = p.a1 + p.ext1 * k - (p.closed1 ? line : 0);
    if (p.horizontal) g.rect(a0, p.c - thickness / 2, a1 - a0, thickness).fill(color);
    else g.rect(p.c - thickness / 2, a0, thickness, a1 - a0).fill(color);
  };
  for (const p of pieces) rect(p, 1, WALL_LINE_COLOR);
  for (const p of pieces) rect(p, WALL_GAP_RATIO, WALL_GAP_COLOR);
  return g;
}
