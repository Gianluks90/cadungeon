import { Container, Graphics } from 'pixi.js';
import {
  CELL_SIZE,
  OBSTACLE_INSET_PX,
  PIT_EDGE_INSET_PX,
  PIT_GRADIENT_STEPS,
  PIT_RAY_LENGTH_PX,
  PIT_RAY_STEPS,
  PIT_GRADIENT_STEP_PX,
  ROCK_BIG_DEBRIS,
  ROCK_BIG_INSET_PX,
  ROCK_BIG_SCATTER_TRIES,
  ROCK_BIG_SATELLITES,
  ROCK_BIG_SATELLITE_MAX_PX,
  ROCK_BIG_SATELLITE_MIN_PX,
  ROCK_DEBRIS_PER_CELL,
  ROCK_DEBRIS_RADIUS_MAX_PX,
  ROCK_DEBRIS_RADIUS_MIN_PX,
  ROCK_PEBBLES_PER_CELL,
  ROCK_SCATTER_MARGIN_PX,
  ROCK_PEBBLE_RADIUS_MAX_PX,
  ROCK_PEBBLE_RADIUS_MIN_PX,
  WATER_EDGE_INSET_PX,
  WATER_FLOW_PERIOD_MS,
  WATER_SHIMMER_CYCLES,
  WATER_ROUND_PX,
  WATER_TEXTURE_AMPLITUDE_PX,
  WATER_TEXTURE_SPACING_PX,
  WATER_TEXTURE_STEP,
  WATER_TEXTURE_WAVELENGTH_PX,
} from '../constants';
import { LINE, theme } from '../theme';
import { Board } from '../board/board';
import { Obstacle, obstacleCells } from '../board/obstacle';
import { mixSeed, mulberry32 } from '../map/rng';
import { Cells, Corner, Side, cellKey, drawRegion } from './region';

/** Campitura di una forma (acqua o buca): la forma esterna fa da maschera, la campitura sta in una grafica a parte. */
interface ClipLayers {
  mask: Graphics;
  texture: Container;
}

/**
 * Disegna gli ostacoli naturali. Buche e acqua vicine dello stesso tipo si fondono in un'unica forma;
 * le rocce restano sempre singole, con una forma irregolare ma uguale su ogni client (dipende dal seme della mappa).
 * Statico, tranne le righe dell'acqua, che scorrono piano (una a destra e la successiva a sinistra, in loop).
 */
export class ObstacleView {
  readonly container = new Container();
  private readonly shapes = new Graphics();
  /** La campitura dell'acqua, tagliata dalla forma dell'acqua (anche a L): non esce mai dai bordi. */
  private readonly waterTexture = new Container();
  /** Le righe dell'acqua: ognuna scorre in una direzione, e la riga dopo nell'altra. */
  private waterRows: { g: Graphics; dir: 1 | -1 }[] = [];
  private flowMs = 0;
  /** Chi chiede meno movimento (impostazioni del sistema) vede l'acqua ferma. */
  private readonly reduceMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly waterMask = new Graphics();
  private readonly preview = new Graphics();
  private board: Board | null = null; // serve per sapere dove ci sono i muri

  constructor(private readonly seed: number) {
    this.waterTexture.mask = this.waterMask;
    this.container.addChild(this.shapes, this.waterMask, this.waterTexture, this.preview);
  }

  /** `visible` dice quali ostacoli mostrare (quelli rivelati); senza, si vedono tutti. */
  redraw(board: Board, visible: (o: Obstacle) => boolean = () => true) {
    this.board = board;
    this.shapes.clear();
    this.waterMask.clear();
    for (const child of this.waterTexture.removeChildren()) child.destroy();
    this.waterRows = [];
    this.drawAll(this.shapes, board.obstacles.filter(visible), { mask: this.waterMask, texture: this.waterTexture });
  }

  /** Da chiamare a ogni frame: le righe dell'acqua scorrono, a destra e a sinistra alternativamente. */
  tick(deltaMs: number) {
    if (!this.waterRows.length || this.reduceMotion) return;
    this.flowMs = (this.flowMs + deltaMs) % WATER_FLOW_PERIOD_MS;
    // Un giro completo sposta la riga di una lunghezza d'onda: l'onda è periodica, quindi il ciclo non si vede.
    const shift = (this.flowMs / WATER_FLOW_PERIOD_MS) * WATER_TEXTURE_WAVELENGTH_PX;
    // L'opacità respira fra il minimo e il massimo, e le righe pari e dispari sono in contrasto di fase.
    const wave = (1 - Math.cos((this.flowMs / WATER_FLOW_PERIOD_MS) * WATER_SHIMMER_CYCLES * Math.PI * 2)) / 2;
    const a = theme.alpha;
    for (const row of this.waterRows) {
      row.g.x = row.dir * shift;
      row.g.alpha = a.waterTexture + (a.waterTextureMax - a.waterTexture) * (row.dir === 1 ? wave : 1 - wave);
    }
  }

  /** Anteprima mentre si piazzano gli ostacoli: tenue; rossastra se lì non si può mettere. */
  setPreview(o: Obstacle | readonly Obstacle[] | null, valid = true) {
    this.preview.clear();
    if (!o) return;
    this.drawAll(this.preview, Array.isArray(o) ? o : [o as Obstacle]);
    this.preview.alpha = valid ? theme.alpha.previewValid : theme.alpha.previewInvalid;
    this.preview.tint = valid ? 0xffffff : theme.color.invalid; // 0xffffff = nessun tinta
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
    const big = !!o.big;
    const w = (big ? 2 : o.vertical ? 1 : o.length) * CELL_SIZE;
    const h = (big ? 2 : o.vertical ? o.length : 1) * CELL_SIZE;
    const rng = mulberry32(mixSeed(this.seed, o.x, o.y));
    const cx = x + w / 2;
    const cy = y + h / 2;
    // Il masso grande lascia più margine: attorno a lui stanno sassi più piccoli.
    const inset = big ? ROCK_BIG_INSET_PX : OBSTACLE_INSET_PX;
    const rx = w / 2 - inset;
    const ry = h / 2 - inset;
    const n = big ? 16 : 8 + 3 * o.length;
    const pts: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 0.82 + 0.18 * rng();
      const sx = Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.7; // potenza < 1: più squadrata di un'ellisse
      const sy = Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.7;
      pts.push(cx + rx * sx * k, cy + ry * sy * k);
    }
    g.poly(pts).fill(theme.color.stone.fill).stroke({ width: LINE.hairline, color: theme.color.stone.line, join: 'round', pixelLine: true });
    for (let i = 0; i < (big ? 6 : 2 + o.length); i++) {
      const a = Math.floor(rng() * n);
      const b = (a + 2 + Math.floor(rng() * (n - 3))) % n;
      g.moveTo(pts[a * 2], pts[a * 2 + 1]).lineTo(pts[b * 2], pts[b * 2 + 1]);
    }
    g.stroke({ width: LINE.hairline, color: theme.color.stone.line, alpha: theme.alpha.stoneDetail, pixelLine: true });

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
    // Il masso grande si circonda di macerie che scalano: pochi sassi medi appoggiati al suo bordo e, dietro ognuno, una scia di sassi sempre più piccoli che si allontana.
    if (big) this.satellites(g, pts, { x, y, w, h, cx, cy }, rng, placed);
    const pebbles = big ? 0 : ROCK_PEBBLES_PER_CELL * o.length;
    const debris = big ? ROCK_BIG_DEBRIS : ROCK_DEBRIS_PER_CELL * o.length;
    for (let i = 0; i < pebbles; i++) {
      const s = place(ROCK_PEBBLE_RADIUS_MIN_PX, ROCK_PEBBLE_RADIUS_MAX_PX);
      if (s) this.stone(g, s, rng, false);
    }
    for (let i = 0; i < debris; i++) {
      const s = place(ROCK_DEBRIS_RADIUS_MIN_PX, ROCK_DEBRIS_RADIUS_MAX_PX);
      if (s) g.poly(this.outline(s, rng, 5)).fill({ color: theme.color.stone.line, alpha: theme.alpha.stoneDebris });
    }
  }

  /**
   * Le macerie intorno al masso grande, viste dall'alto: stanno accanto al masso, mai sopra, e riempiono quasi tutto il quadrato 2×2 così si capisce che le quattro caselle sono occupate.
   * Prima alcuni sassi medi appoggiati al bordo (distanziati di un soffio), di forme e grandezze diverse; poi una pioggia di sassi che si rimpiccioliscono man mano che si allontanano dal masso,
   * piazzati a caso dove c'è posto; infine i detriti più fini. `placed` ricorda cosa c'è già, così i sassi sparsi che vengono dopo non ci si sovrappongono.
   */
  private satellites(g: Graphics, boulder: number[], box: { x: number; y: number; w: number; h: number; cx: number; cy: number }, rng: () => number, placed: { x: number; y: number; r: number }[]) {
    // Distanza di un punto dal masso: negativa se è dentro, altrimenti quanto manca al bordo.
    const gap = (px: number, py: number) => {
      let inside = false;
      let best = Infinity;
      for (let i = 0, j = boulder.length - 2; i < boulder.length; i += 2) {
        const [xi, yi, xj, yj] = [boulder[i], boulder[i + 1], boulder[j], boulder[j + 1]];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        const [ex, ey] = [xi - xj, yi - yj];
        const t = Math.max(0, Math.min(1, ((px - xj) * ex + (py - yj) * ey) / (ex * ex + ey * ey || 1)));
        best = Math.min(best, Math.hypot(px - (xj + ex * t), py - (yj + ey * t)));
        j = i;
      }
      return inside ? -best : best;
    };
    const fits = (px: number, py: number, r: number) =>
      px - r >= box.x + ROCK_SCATTER_MARGIN_PX && px + r <= box.x + box.w - ROCK_SCATTER_MARGIN_PX && py - r >= box.y + ROCK_SCATTER_MARGIN_PX && py + r <= box.y + box.h - ROCK_SCATTER_MARGIN_PX;
    const free = (px: number, py: number, r: number, spacing = 1.08) => fits(px, py, r) && gap(px, py) >= r + 1.2 && placed.every((p) => Math.hypot(p.x - px, p.y - py) >= (p.r + r) * spacing);
    /** Un sasso di forma diversa dagli altri: poligono di 5-8 lati, più o meno schiacciato e girato, con una tinta appena diversa. */
    const shard = (px: number, py: number, r: number, crack: boolean) => {
      const n = 5 + Math.floor(rng() * 4);
      const squash = 0.55 + rng() * 0.45;
      const turn = rng() * Math.PI;
      const start = rng() * Math.PI * 2;
      const pts: number[] = [];
      for (let i = 0; i < n; i++) {
        const a = start + (i / n) * Math.PI * 2;
        const k = 0.72 + rng() * 0.28;
        const ux = Math.cos(a) * k * r;
        const uy = Math.sin(a) * k * r * squash;
        pts.push(px + ux * Math.cos(turn) - uy * Math.sin(turn), py + ux * Math.sin(turn) + uy * Math.cos(turn));
      }
      g.poly(pts).fill({ color: theme.color.stone.fill, alpha: 0.8 + rng() * 0.2 }).stroke({ width: LINE.hairline, color: theme.color.stone.line, alpha: 0.7 + rng() * 0.3, join: 'round', pixelLine: true });
      if (crack && n >= 6) {
        const a = Math.floor(rng() * n);
        const b = (a + 2 + Math.floor(rng() * (n - 3))) % n;
        g.moveTo(pts[a * 2], pts[a * 2 + 1]).lineTo(pts[b * 2], pts[b * 2 + 1]).stroke({ width: LINE.hairline, color: theme.color.stone.line, alpha: theme.alpha.stoneDetail, pixelLine: true });
      }
    };
    const put = (px: number, py: number, r: number, crack = false) => {
      placed.push({ x: px, y: py, r });
      if (r >= 2.4) shard(px, py, r, crack);
      else g.poly(this.outline({ x: px, y: py, r }, rng, 5)).fill({ color: theme.color.stone.line, alpha: theme.alpha.stoneDebris });
    };

    // 1. Sassi medi attorno al bordo, a distanza di un soffio, di grandezze diverse.
    const first = rng() * Math.PI * 2;
    for (let i = 0; i < ROCK_BIG_SATELLITES; i++) {
      const a = first + (i / ROCK_BIG_SATELLITES) * Math.PI * 2 + (rng() - 0.5) * 0.8;
      const [dx, dy] = [Math.cos(a), Math.sin(a)];
      const r = ROCK_BIG_SATELLITE_MIN_PX + rng() * (ROCK_BIG_SATELLITE_MAX_PX - ROCK_BIG_SATELLITE_MIN_PX);
      let t = 0;
      while (t < box.w && gap(box.cx + dx * t, box.cy + dy * t) < 0) t += 1;
      for (let extra = 0; extra < 14; extra += 1) {
        const [px, py] = [box.cx + dx * (t + r + 1.4 + extra), box.cy + dy * (t + r + 1.4 + extra)];
        if (free(px, py, r)) {
          put(px, py, r, true);
          break;
        }
      }
    }
    // 2. Sassi sparsi che si rimpiccioliscono man mano che si allontanano dal masso: quelli vicini sono più grandi, quelli lontani sono schegge.
    for (let tries = 0; tries < ROCK_BIG_SCATTER_TRIES; tries++) {
      const px = box.x + ROCK_SCATTER_MARGIN_PX + rng() * (box.w - 2 * ROCK_SCATTER_MARGIN_PX);
      const py = box.y + ROCK_SCATTER_MARGIN_PX + rng() * (box.h - 2 * ROCK_SCATTER_MARGIN_PX);
      const d = gap(px, py);
      if (d < 3) continue;
      const r = Math.max(1.5, Math.min(7.5, 8.5 - d * 0.2)) * (0.7 + rng() * 0.6);
      if (free(px, py, r, 1.02)) put(px, py, r, r > 5);
    }
  }

  /** Un sasso: poligono irregolare e un po' squadrato, e per i massi una crepa a linea sottile. */
  private stone(g: Graphics, s: { x: number; y: number; r: number }, rng: () => number, crack: boolean) {
    const pts = this.outline(s, rng, 7);
    g.poly(pts).fill(theme.color.stone.fill).stroke({ width: LINE.hairline, color: theme.color.stone.line, join: 'round', pixelLine: true });
    if (!crack) return;
    const n = pts.length / 2;
    const a = Math.floor(rng() * n);
    const b = (a + 2 + Math.floor(rng() * (n - 3))) % n;
    g.moveTo(pts[a * 2], pts[a * 2 + 1]).lineTo(pts[b * 2], pts[b * 2 + 1]);
    g.stroke({ width: LINE.hairline, color: theme.color.stone.line, alpha: theme.alpha.stoneDetail, pixelLine: true });
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
        fill: mixColors(theme.color.floor, theme.color.pit.depth, i / (PIT_GRADIENT_STEPS - 1)),
        line: i === 0 ? { width: LINE.hairline, color: theme.color.pit.line, alpha: theme.alpha.pitLine, pixelLine: true } : undefined,
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
          g.stroke({ width: LINE.hairline, color: theme.color.pit.ray, alpha: theme.alpha.pitRay * (1 - (k + 0.5) / PIT_RAY_STEPS), pixelLine: true });
        }
      }
    }
  }

  /**
   * Acqua: un contorno azzurro sottile, un fondo dello stesso colore con un'opacità bassissima e, dentro, righe ondulate molto tenue.
   * Il margine dal bordo della cella è lo stesso sui lati liberi e vicino ai muri (la faccia interna del muro),
   * così il bordo non fa gradini. Un angolo che tocca almeno un muro resta vivo, così il bordo arriva dritto fino al
   * muro; gli angoli lontani dai muri sono arrotondati tutti con lo stesso raggio. Pozze vicine si fondono in un unico specchio. Nell'anteprima (senza `water`) non c'è la campitura.
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
        return walls >= 1 ? 0 : WATER_ROUND_PX; // un angolo che tocca un muro resta vivo: il bordo corre fino al muro
      },
    };

    drawRegion(g, cells, { ...shape, fill: theme.color.water.line, fillAlpha: theme.alpha.waterFill, line: { width: LINE.hairline, color: theme.color.water.line, alpha: theme.alpha.waterLine, pixelLine: true } });
    if (!water) return;
    drawRegion(water.mask, cells, { ...shape, fill: 0xffffff });
    this.waterLines(water.texture, cells);
  }

  /**
   * Righe orizzontali ondulate su tutto il rettangolo che contiene lo specchio, allineate al mondo (continue fra specchi vicini).
   * Ogni riga è sfasata di WATER_TEXTURE_STEP lunghezze d'onda rispetto alla precedente, a scalino, così la texture è uniforme.
   * Le righe sono disegnate una lunghezza d'onda oltre i bordi, perché scorrendo non lascino vuoti (la maschera le taglia).
   */
  private waterLines(layer: Container, cells: Cells) {
    const { left, top, right, bottom } = bounds(cells);
    const wl = WATER_TEXTURE_WAVELENGTH_PX;
    const step = wl / 6; // la lunghezza d'onda è un multiplo del passo: spostata di una onda, la riga coincide con se stessa
    const x0 = Math.floor(left / wl) * wl - wl;
    const x1 = Math.ceil(right / wl) * wl + wl;
    for (let y = Math.ceil(top / WATER_TEXTURE_SPACING_PX) * WATER_TEXTURE_SPACING_PX; y <= bottom; y += WATER_TEXTURE_SPACING_PX) {
      const row = Math.round(y / WATER_TEXTURE_SPACING_PX);
      const g = new Graphics();
      for (let x = x0; x <= x1; x += step) {
        const py = y + WATER_TEXTURE_AMPLITUDE_PX * Math.sin(((x / wl) - row * WATER_TEXTURE_STEP) * Math.PI * 2);
        if (x === x0) g.moveTo(x, py);
        else g.lineTo(x, py);
      }
      g.stroke({ width: LINE.hairline, color: theme.color.water.texture, pixelLine: true });
      g.alpha = theme.alpha.waterTexture; // da qui in poi lo regola tick()
      layer.addChild(g);
      this.waterRows.push({ g, dir: row % 2 === 0 ? 1 : -1 });
    }
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
export function mixColors(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
