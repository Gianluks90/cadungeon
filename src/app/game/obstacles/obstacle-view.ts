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
  WATER_DRIP_COLOR,
  WATER_DRIP_DURATION_MS,
  WATER_DRIP_MAX_PERIOD_MS,
  WATER_DRIP_MIN_PERIOD_MS,
  WATER_DRIP_RADIUS_PX,
  WATER_EDGE_INSET_PX,
  WATER_LINE,
  WATER_GRADIENT_STEP_PX,
  WATER_GRADIENT_STEPS,
  WATER_ROUND_MAX_PX,
  WATER_ROUND_MIN_PX,
  WATER_SHORE,
} from '../constants';
import { Board } from '../board/board';
import { Obstacle, obstacleCells } from '../board/obstacle';
import { mixSeed, mulberry32 } from '../map/rng';
import { Cells, Corner, Side, cellKey, drawRegion } from './region';
import { WaterFilter } from './water-filter';

/**
 * Disegna gli ostacoli naturali. Buche e acqua vicine dello stesso tipo si fondono in un'unica forma;
 * le rocce restano sempre singole, con una forma irregolare ma uguale su ogni client (dipende dal seme della mappa).
 */
export class ObstacleView {
  readonly container = new Container();
  private readonly shapes = new Graphics();
  /** L'acqua sta a parte, perché ha un filtro che la anima. */
  private readonly water = new Graphics();
  private readonly waterFilter = new WaterFilter();
  /** Le gocce stanno sopra l'acqua, fuori dal filtro, così gli anelli restano nitidi. */
  private readonly dripLayer = new Graphics();
  private drips: DripSource[] = [];
  private readonly preview = new Graphics();
  /** Chi chiede meno movimento (impostazioni del sistema) vede l'acqua ferma. */
  private readonly reduceMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private board: Board | null = null; // serve per sapere dove ci sono i muri

  constructor(private readonly seed: number) {
    this.water.filters = [this.waterFilter];
    this.container.addChild(this.shapes, this.water, this.dripLayer, this.preview);
  }

  redraw(board: Board) {
    this.board = board;
    this.shapes.clear();
    this.water.clear();
    this.drawAll(this.shapes, board.obstacles, this.water);
    this.water.visible = board.obstacles.some((o) => o.type === 'water'); // senza acqua, niente filtro

    // Le gocce: ogni cella d'acqua ne lascia cadere una ogni tanto, con un ritmo suo (dal seme).
    this.drips = [];
    for (const o of board.obstacles) {
      if (o.type !== 'water') continue;
      for (const c of obstacleCells(o)) {
        const rng = mulberry32(mixSeed(this.seed ^ 0x77ab, c.x, c.y));
        this.drips.push({
          cx: c.x,
          cy: c.y,
          period: WATER_DRIP_MIN_PERIOD_MS + rng() * (WATER_DRIP_MAX_PERIOD_MS - WATER_DRIP_MIN_PERIOD_MS),
          offset: rng(),
        });
      }
    }
    this.dripLayer.clear();
  }

  /** Da chiamare a ogni frame: fa scorrere la luce sull'acqua. */
  tick(nowMs: number) {
    if (this.reduceMotion) return;
    this.waterFilter.time = nowMs;
    this.drawDrips(nowMs);
  }

  /**
   * Disegna le gocce. In ogni ciclo di una cella cade una goccia in un punto che dipende dal numero del ciclo
   * (sempre lo stesso su ogni client): un anello che si allarga e sfuma, seguito da uno più piccolo.
   * Con "riduci movimento" non ci sono gocce.
   */
  private drawDrips(nowMs: number) {
    const g = this.dripLayer;
    g.clear();
    if (this.reduceMotion) return;
    for (const d of this.drips) {
      const cycle = nowMs / d.period + d.offset;
      const n = Math.floor(cycle);
      const t = (cycle - n) * d.period; // millisecondi dall'inizio del ciclo
      if (t > WATER_DRIP_DURATION_MS) continue;
      const rng = mulberry32(mixSeed(this.seed ^ 0x4d2f, d.cx * 97 + n, d.cy));
      const x = d.cx * CELL_SIZE + 26 + rng() * 12; // vicino al centro della cella: l'anello resta dentro l'acqua
      const y = d.cy * CELL_SIZE + 26 + rng() * 12;
      const p = t / WATER_DRIP_DURATION_MS;
      for (const [delay, scale, alpha] of [[0, 1, 0.5], [0.22, 0.6, 0.3]]) {
        const q = (p - delay) / (1 - delay);
        if (q <= 0) continue;
        const ease = 1 - (1 - q) ** 2; // parte svelto e rallenta, come un'onda che si spegne
        g.circle(x, y, 2 + (WATER_DRIP_RADIUS_PX - 2) * scale * ease).stroke({
          width: 1.5,
          color: WATER_DRIP_COLOR,
          alpha: alpha * (1 - q) ** 1.5,
        });
      }
    }
  }

  /** Da chiamare quando la camera cambia: il filtro deve sapere quanto è ingrandito il mondo (zoom * densità). */
  setScale(scale: number) {
    this.waterFilter.scale = scale;
  }

  /** Anteprima mentre si piazzano gli ostacoli: tenue; rossastra se lì non si può mettere. */
  setPreview(o: Obstacle | null, valid = true) {
    this.preview.clear();
    if (!o) return;
    this.drawAll(this.preview, [o]);
    this.preview.alpha = valid ? 0.6 : 0.3;
    this.preview.tint = valid ? 0xffffff : 0xff7070;
  }

  private drawAll(g: Graphics, obstacles: readonly Obstacle[], waterTarget: Graphics = g) {
    const pits = new Set<string>();
    const waters = new Set<string>();
    for (const o of obstacles) {
      if (o.type === 'rock') this.rock(g, o);
      else for (const c of obstacleCells(o)) (o.type === 'pit' ? pits : waters).add(cellKey(c.x, c.y));
    }
    if (pits.size) this.pits(g, pits);
    if (waters.size) this.waters(waterTarget, waters);
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

    // Gradiente: tante fasce sottili che vanno dalla riva (più chiara, con un bordo tenue) al fondo (più scuro).
    for (let i = 0; i < WATER_GRADIENT_STEPS; i++) {
      const extra = i * WATER_GRADIENT_STEP_PX;
      drawRegion(g, cells, {
        inset: WATER_EDGE_INSET_PX + extra,
        rounded: true,
        cornerRadius: (cx, cy, corner) => {
          const [a, b] = SIDES[corner];
          const walls = (isWall(cx, cy, a) ? 1 : 0) + (isWall(cx, cy, b) ? 1 : 0);
          if (walls === 2) return 0; // l'angolo tra due muri si riempie: niente buchi
          const rng = mulberry32(mixSeed(this.seed ^ 0x5bd1, cx * 4 + CORNERS.indexOf(corner), cy));
          const base = WATER_ROUND_MIN_PX + rng() * (WATER_ROUND_MAX_PX - WATER_ROUND_MIN_PX);
          return Math.max(2, (walls === 1 ? base * 0.45 : base) - extra);
        },
        fill: mixColors(WATER_SHORE, WATER_DEEP, i / (WATER_GRADIENT_STEPS - 1)),
        line: i === 0 ? { width: 1, color: WATER_LINE, alpha: 0.5, pixelLine: true } : undefined,
      });
    }
  }
}

/** Una cella d'acqua da cui cadono gocce: ogni quanto, e a che punto del ciclo parte. */
interface DripSource {
  cx: number;
  cy: number;
  period: number;
  offset: number;
}

/** Un colore a metà strada fra due: `t` = 0 è `a`, `t` = 1 è `b`. */
function mixColors(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
