import { Container, Graphics } from 'pixi.js';
import {
  CELL_SIZE,
  OBSTACLE_INSET_PX,
  FLOOR_COLOR,
  PIT_EDGE_INSET_PX,
  PIT_GRADIENT_STEPS,
  PIT_GRADIENT_STEP_PX,
  PIT_LINE,
  PIT_LINE_ALPHA,
  ROCK_FILL,
  ROCK_LINE,
  WATER_DEEP,
  WATER_EDGE_INSET_PX,
  WATER_LINE,
  WATER_MID,
  WATER_ROUND_MAX_PX,
  WATER_ROUND_MIN_PX,
  WATER_SHORE,
  WATER_SPARKLE,
} from '../constants';
import { Board } from '../board/board';
import { Obstacle, obstacleCells } from '../board/obstacle';
import { mixSeed, mulberry32 } from '../map/rng';
import { Cells, Corner, Side, cellKey, drawRegion } from './region';

/**
 * Disegna gli ostacoli naturali. Buche e acqua vicine dello stesso tipo si fondono in un'unica forma;
 * le rocce restano sempre singole, con una forma irregolare ma uguale su ogni client (dipende dal seme della mappa).
 */
export class ObstacleView {
  readonly container = new Container();
  private readonly shapes = new Graphics();
  private readonly preview = new Graphics();
  private board: Board | null = null; // serve per sapere dove ci sono i muri

  constructor(private readonly seed: number) {
    this.container.addChild(this.shapes, this.preview);
  }

  redraw(board: Board) {
    this.board = board;
    this.shapes.clear();
    this.drawAll(this.shapes, board.obstacles);
  }

  /** Anteprima mentre si piazzano gli ostacoli: tenue; rossastra se lì non si può mettere. */
  setPreview(o: Obstacle | null, valid = true) {
    this.preview.clear();
    if (!o) return;
    this.drawAll(this.preview, [o]);
    this.preview.alpha = valid ? 0.6 : 0.3;
    this.preview.tint = valid ? 0xffffff : 0xff7070;
  }

  private drawAll(g: Graphics, obstacles: readonly Obstacle[]) {
    const pits = new Set<string>();
    const waters = new Set<string>();
    for (const o of obstacles) {
      if (o.type === 'rock') this.rock(g, o);
      else for (const c of obstacleCells(o)) (o.type === 'pit' ? pits : waters).add(cellKey(c.x, c.y));
    }
    if (pits.size) this.pits(g, pits);
    if (waters.size) this.waters(g, waters);
  }

  /** Roccia: poligono irregolare e un po' squadrato, con qualche faccia a linea sottile. Sempre singola. */
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
  }

  /**
   * Buca: un incavo nel pavimento. Un bordo sottile e tenue, e dentro un gradiente che parte dal colore del
   * pavimento e va verso il nero: a fasce concentriche, quindi segue anche le buche unite.
   */
  private pits(g: Graphics, cells: Cells) {
    for (let i = 0; i < PIT_GRADIENT_STEPS; i++) {
      drawRegion(g, cells, {
        inset: PIT_EDGE_INSET_PX + i * PIT_GRADIENT_STEP_PX,
        fill: mixColors(FLOOR_COLOR, 0x000000, i / (PIT_GRADIENT_STEPS - 1)),
        line: i === 0 ? { width: 1, color: PIT_LINE, alpha: PIT_LINE_ALPHA, pixelLine: true } : undefined,
      });
    }
  }

  /**
   * Acqua: tre fasce concentriche dalla riva (più chiara) al fondo (più scuro). Il margine dal bordo della cella
   * è lo stesso sui lati liberi e vicino ai muri (la faccia interna del muro), così il bordo non fa gradini;
   * l'angolo tra due muri si riempie. Gli altri angoli sono arrotondati con un raggio casuale per ogni angolo
   * (sempre lo stesso, perché dipende dal seme della mappa), così le pozze non sembrano blocchi squadrati.
   * Pozze vicine si fondono in un unico specchio d'acqua.
   */
  private waters(g: Graphics, cells: Cells) {
    const board = this.board;
    const isWall = (cx: number, cy: number, side: Side) => !!board?.isWallSide({ x: cx, y: cy }, side);
    const CORNERS: Corner[] = ['NW', 'NE', 'SE', 'SW'];
    const SIDES: Record<Corner, [Side, Side]> = { NW: ['N', 'W'], NE: ['N', 'E'], SE: ['S', 'E'], SW: ['S', 'W'] };

    const bands = [
      { extra: 0, color: WATER_SHORE, line: true },
      { extra: 6, color: WATER_MID, line: false },
      { extra: 14, color: WATER_DEEP, line: false },
    ];
    for (const band of bands) {
      drawRegion(g, cells, {
        inset: WATER_EDGE_INSET_PX + band.extra,
        rounded: true,
        cornerRadius: (cx, cy, corner) => {
          const [a, b] = SIDES[corner];
          const walls = (isWall(cx, cy, a) ? 1 : 0) + (isWall(cx, cy, b) ? 1 : 0);
          if (walls === 2) return 0; // l'angolo tra due muri si riempie: niente buchi
          const rng = mulberry32(mixSeed(this.seed ^ 0x5bd1, cx * 4 + CORNERS.indexOf(corner), cy));
          const base = WATER_ROUND_MIN_PX + rng() * (WATER_ROUND_MAX_PX - WATER_ROUND_MIN_PX);
          return Math.max(2, (walls === 1 ? base * 0.45 : base) - band.extra);
        },
        fill: band.color,
        line: band.line ? { width: 1, color: WATER_LINE, alpha: 0.5, pixelLine: true } : undefined,
      });
    }

    // Riflessi: due trattini chiari in ogni cella, sempre negli stessi punti perché dipendono dal seme.
    for (const key of cells) {
      const [cx, cy] = key.split(',').map(Number);
      const rng = mulberry32(mixSeed(this.seed, cx, cy));
      for (let i = 0; i < 2; i++) {
        const x = cx * CELL_SIZE + 18 + rng() * 26;
        const y = cy * CELL_SIZE + 18 + rng() * 26;
        g.moveTo(x, y).lineTo(x + 4 + rng() * 3, y);
      }
    }
    g.stroke({ width: 1, color: WATER_SPARKLE, alpha: 0.7, pixelLine: true });
  }
}

/** Un colore a metà strada fra due: `t` = 0 è `a`, `t` = 1 è `b`. */
function mixColors(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
