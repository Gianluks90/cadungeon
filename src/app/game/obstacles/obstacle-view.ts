import { Container, Graphics } from 'pixi.js';
import {
  CELL_SIZE,
  OBSTACLE_INSET_PX,
  FLOOR_COLOR,
  PIT_EDGE_INSET_PX,
  PIT_GRADIENT_STEPS,
  PIT_RAY_ALPHA,
  PIT_RAY_COLOR,
  PIT_RAY_LENGTH_PX,
  PIT_RAY_STEPS,
  PIT_GRADIENT_STEP_PX,
  PIT_LINE,
  PIT_LINE_ALPHA,
  ROCK_DEBRIS_PER_CELL,
  ROCK_DEBRIS_RADIUS_MAX_PX,
  ROCK_DEBRIS_RADIUS_MIN_PX,
  ROCK_FILL,
  ROCK_LINE,
  ROCK_PEBBLES_PER_CELL,
  ROCK_SCATTER_MARGIN_PX,
  ROCK_PEBBLE_RADIUS_MAX_PX,
  ROCK_PEBBLE_RADIUS_MIN_PX,
  WATER_EDGE_INSET_PX,
  WATER_LINE,
  WATER_LINE_ALPHA,
  WATER_ROUND_PX,
  WATER_TEXTURE_ALPHA,
  WATER_TEXTURE_AMPLITUDE_PX,
  WATER_TEXTURE_COLOR,
  WATER_TEXTURE_SPACING_PX,
  WATER_TEXTURE_WAVELENGTH_PX,
} from '../constants';
import { Board } from '../board/board';
import { Obstacle, obstacleCells } from '../board/obstacle';
import { mixSeed, mulberry32 } from '../map/rng';
import { Cells, Corner, Side, cellKey, drawRegion } from './region';

/** Campitura di una forma (acqua o buca): la forma esterna fa da maschera, la campitura sta in una grafica a parte. */
interface ClipLayers {
  mask: Graphics;
  texture: Graphics;
}

/**
 * Disegna gli ostacoli naturali. Buche e acqua vicine dello stesso tipo si fondono in un'unica forma;
 * le rocce restano sempre singole, con una forma irregolare ma uguale su ogni client (dipende dal seme della mappa).
 * Tutto è statico.
 */
export class ObstacleView {
  readonly container = new Container();
  private readonly shapes = new Graphics();
  /** La campitura dell'acqua, tagliata dalla forma dell'acqua (anche a L): non esce mai dai bordi. */
  private readonly waterTexture = new Graphics();
  private readonly waterMask = new Graphics();
  private readonly preview = new Graphics();
  private board: Board | null = null; // serve per sapere dove ci sono i muri

  constructor(private readonly seed: number) {
    this.waterTexture.mask = this.waterMask;
    this.container.addChild(this.shapes, this.waterMask, this.waterTexture, this.preview);
  }

  redraw(board: Board) {
    this.board = board;
    this.shapes.clear();
    this.waterMask.clear();
    this.waterTexture.clear();
    this.drawAll(this.shapes, board.obstacles, { mask: this.waterMask, texture: this.waterTexture });
  }

  /** Anteprima mentre si piazzano gli ostacoli: tenue; rossastra se lì non si può mettere. */
  setPreview(o: Obstacle | null, valid = true) {
    this.preview.clear();
    if (!o) return;
    this.drawAll(this.preview, [o]);
    this.preview.alpha = valid ? 0.6 : 0.3;
    this.preview.tint = valid ? 0xffffff : 0xff7070;
  }

  private drawAll(g: Graphics, obstacles: readonly Obstacle[], water?: ClipLayers) {
    const pits = new Set<string>();
    const waters = new Set<string>();
    for (const o of obstacles) {
      if (o.type === 'rock') this.rock(g, o);
      else for (const c of obstacleCells(o)) (o.type === 'pit' ? pits : waters).add(cellKey(c.x, c.y));
    }
    if (pits.size) this.pits(g, pits);
    if (waters.size) this.waters(g, waters, water);
  }

  /**
   * Roccia: un masso singolo, poligono irregolare e un po' squadrato con qualche faccia a linea sottile, e attorno
   * a lui piccoli sassi e detriti sparsi, solo per scena. Tutto dal seme della mappa (uguale su ogni client) e
   * dentro le celle dell'ostacolo: il blocco del movimento non cambia.
   */
  private rock(g: Graphics, o: Obstacle) {
    const x = o.x * CELL_SIZE;
    const y = o.y * CELL_SIZE;
    const w = (o.vertical ? 1 : o.length) * CELL_SIZE;
    const h = (o.vertical ? o.length : 1) * CELL_SIZE;
    const rng = mulberry32(mixSeed(this.seed, o.x, o.y));
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2 - OBSTACLE_INSET_PX;
    const ry = h / 2 - OBSTACLE_INSET_PX;
    const n = 8 + 3 * o.length;
    const pts: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 0.82 + 0.18 * rng();
      const sx = Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.7; // potenza < 1: più squadrata di un'ellisse
      const sy = Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.7;
      pts.push(cx + rx * sx * k, cy + ry * sy * k);
    }
    g.poly(pts).fill(ROCK_FILL).stroke({ width: 2, color: ROCK_LINE, join: 'round' });
    for (let i = 0; i < 2 + o.length; i++) {
      const a = Math.floor(rng() * n);
      const b = (a + 2 + Math.floor(rng() * (n - 3))) % n;
      g.moveTo(pts[a * 2], pts[a * 2 + 1]).lineTo(pts[b * 2], pts[b * 2 + 1]);
    }
    g.stroke({ width: 1, color: ROCK_LINE, alpha: 0.45, pixelLine: true });

    // Sassi e detriti: fuori dal masso e dentro le celle dell'ostacolo, senza sovrapporsi troppo fra loro.
    const placed: { x: number; y: number; r: number }[] = [];
    const place = (rMin: number, rMax: number) => {
      for (let tries = 0; tries < 40; tries++) {
        const r = rMin + rng() * (rMax - rMin);
        const px = x + ROCK_SCATTER_MARGIN_PX + r + rng() * Math.max(0, w - 2 * (ROCK_SCATTER_MARGIN_PX + r));
        const py = y + ROCK_SCATTER_MARGIN_PX + r + rng() * Math.max(0, h - 2 * (ROCK_SCATTER_MARGIN_PX + r));
        const outside = ((px - cx) / (rx + r)) ** 2 + ((py - cy) / (ry + r)) ** 2 >= 1;
        if (outside && placed.every((p) => Math.hypot(p.x - px, p.y - py) >= (p.r + r) * 1.1)) {
          const spot = { x: px, y: py, r };
          placed.push(spot);
          return spot;
        }
      }
      return null;
    };
    for (let i = 0; i < ROCK_PEBBLES_PER_CELL * o.length; i++) {
      const s = place(ROCK_PEBBLE_RADIUS_MIN_PX, ROCK_PEBBLE_RADIUS_MAX_PX);
      if (s) this.stone(g, s, rng, 1.2, false);
    }
    for (let i = 0; i < ROCK_DEBRIS_PER_CELL * o.length; i++) {
      const s = place(ROCK_DEBRIS_RADIUS_MIN_PX, ROCK_DEBRIS_RADIUS_MAX_PX);
      if (s) g.poly(this.outline(s, rng, 5)).fill({ color: ROCK_LINE, alpha: 0.55 });
    }
  }

  /** Un sasso: poligono irregolare e un po' squadrato, e per i massi una crepa a linea sottile. */
  private stone(g: Graphics, s: { x: number; y: number; r: number }, rng: () => number, line: number, crack: boolean) {
    const pts = this.outline(s, rng, 7);
    g.poly(pts).fill(ROCK_FILL).stroke({ width: line, color: ROCK_LINE, join: 'round' });
    if (!crack) return;
    const n = pts.length / 2;
    const a = Math.floor(rng() * n);
    const b = (a + 2 + Math.floor(rng() * (n - 3))) % n;
    g.moveTo(pts[a * 2], pts[a * 2 + 1]).lineTo(pts[b * 2], pts[b * 2 + 1]);
    g.stroke({ width: 1, color: ROCK_LINE, alpha: 0.45, pixelLine: true });
  }

  /** I vertici di un poligono irregolare di `n` lati attorno a un punto. */
  private outline(s: { x: number; y: number; r: number }, rng: () => number, n: number): number[] {
    const pts: number[] = [];
    const start = rng() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = start + (i / n) * Math.PI * 2;
      const k = 0.78 + 0.22 * rng();
      const sx = Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.7; // potenza < 1: più squadrato di un cerchio
      const sy = Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.7;
      pts.push(s.x + s.r * sx * k, s.y + s.r * sy * k);
    }
    return pts;
  }

  /**
   * Buca: un incavo nel pavimento. Un bordo sottile e tenue, e dentro un gradiente che parte dal colore del
   * pavimento e va verso il nero: a fasce concentriche, quindi segue anche le buche unite. Dagli angoli esterni
   * partono linee a 45° verso il centro che sfumano nel nero: danno l'idea di profondità.
   */
  private pits(g: Graphics, cells: Cells) {
    for (let i = 0; i < PIT_GRADIENT_STEPS; i++) {
      drawRegion(g, cells, {
        inset: PIT_EDGE_INSET_PX + i * PIT_GRADIENT_STEP_PX,
        fill: mixColors(FLOOR_COLOR, 0x000000, i / (PIT_GRADIENT_STEPS - 1)),
        line: i === 0 ? { width: 1, color: PIT_LINE, alpha: PIT_LINE_ALPHA, pixelLine: true } : undefined,
      });
    }
    // Una linea per ogni angolo convesso (nessuna cella vicina da entrambi i lati), a tratti sempre più tenui.
    const has = (x: number, y: number) => cells.has(cellKey(x, y));
    const o = PIT_EDGE_INSET_PX;
    for (const key of cells) {
      const [cx, cy] = key.split(',').map(Number);
      const corners: [boolean, number, number, number, number][] = [
        [!has(cx, cy - 1) && !has(cx - 1, cy), cx * CELL_SIZE + o, cy * CELL_SIZE + o, 1, 1],
        [!has(cx, cy - 1) && !has(cx + 1, cy), (cx + 1) * CELL_SIZE - o, cy * CELL_SIZE + o, -1, 1],
        [!has(cx, cy + 1) && !has(cx + 1, cy), (cx + 1) * CELL_SIZE - o, (cy + 1) * CELL_SIZE - o, -1, -1],
        [!has(cx, cy + 1) && !has(cx - 1, cy), cx * CELL_SIZE + o, (cy + 1) * CELL_SIZE - o, 1, -1],
      ];
      for (const [convex, x, y, dx, dy] of corners) {
        if (!convex) continue;
        for (let k = 0; k < PIT_RAY_STEPS; k++) {
          const a = (k / PIT_RAY_STEPS) * PIT_RAY_LENGTH_PX;
          const b = ((k + 1) / PIT_RAY_STEPS) * PIT_RAY_LENGTH_PX;
          g.moveTo(x + dx * a, y + dy * a).lineTo(x + dx * b, y + dy * b);
          g.stroke({ width: 1, color: PIT_RAY_COLOR, alpha: PIT_RAY_ALPHA * (1 - (k + 0.5) / PIT_RAY_STEPS), pixelLine: true });
        }
      }
    }
  }

  /**
   * Acqua: un contorno azzurro sottile e, dentro, righe ondulate molto tenue (nessun riempimento pieno).
   * Il margine dal bordo della cella è lo stesso sui lati liberi e vicino ai muri (la faccia interna del muro),
   * così il bordo non fa gradini; l'angolo tra due muri si riempie. Gli altri angoli sono arrotondati tutti con
   * lo stesso raggio. Pozze vicine si fondono in un unico specchio. Nell'anteprima (senza `water`) non c'è la campitura.
   */
  private waters(g: Graphics, cells: Cells, water?: ClipLayers) {
    const board = this.board;
    const isWall = (cx: number, cy: number, side: Side) => !!board?.isWallSide({ x: cx, y: cy }, side);
    const SIDES: Record<Corner, [Side, Side]> = { NW: ['N', 'W'], NE: ['N', 'E'], SE: ['S', 'E'], SW: ['S', 'W'] };
    const shape = {
      inset: WATER_EDGE_INSET_PX,
      rounded: true,
      cornerRadius: (cx: number, cy: number, corner: Corner) => {
        const [a, b] = SIDES[corner];
        const walls = (isWall(cx, cy, a) ? 1 : 0) + (isWall(cx, cy, b) ? 1 : 0);
        return walls === 2 ? 0 : WATER_ROUND_PX; // l'angolo tra due muri si riempie: niente buchi
      },
    };

    drawRegion(g, cells, { ...shape, line: { width: 1, color: WATER_LINE, alpha: WATER_LINE_ALPHA, pixelLine: true } });
    if (!water) return;
    drawRegion(water.mask, cells, { ...shape, fill: 0xffffff });
    this.waterLines(water.texture, cells);
  }

  /** Righe orizzontali ondulate su tutto il rettangolo che contiene lo specchio, allineate al mondo (continue fra specchi vicini). */
  private waterLines(g: Graphics, cells: Cells) {
    const { left, top, right, bottom } = bounds(cells);
    const step = 4;
    for (let y = top; y <= bottom; y += WATER_TEXTURE_SPACING_PX) {
      const row = Math.round(y / WATER_TEXTURE_SPACING_PX);
      for (let x = left; x <= right; x += step) {
        const py = y + WATER_TEXTURE_AMPLITUDE_PX * Math.sin((x / WATER_TEXTURE_WAVELENGTH_PX) * Math.PI * 2 + row * 1.7);
        if (x === left) g.moveTo(x, py);
        else g.lineTo(x, py);
      }
    }
    g.stroke({ width: 1, color: WATER_TEXTURE_COLOR, alpha: WATER_TEXTURE_ALPHA, pixelLine: true });
  }
}

/** Il rettangolo che contiene tutte le celle, in pixel del mondo. */
function bounds(cells: Cells) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const key of cells) {
    const [cx, cy] = key.split(',').map(Number);
    x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx + 1); y1 = Math.max(y1, cy + 1);
  }
  return { left: x0 * CELL_SIZE, top: y0 * CELL_SIZE, right: x1 * CELL_SIZE, bottom: y1 * CELL_SIZE };
}

/** Un colore a metà strada fra due: `t` = 0 è `a`, `t` = 1 è `b`. */
function mixColors(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
