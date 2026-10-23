import { Container, Graphics } from 'pixi.js';
import {
  CELL_SIZE,
  STAIRS_LINK_DASH_PX,
  STAIRS_LINK_CORNER_RADIUS_PX,
  STAIRS_LINK_CURVE_STEPS,
  STAIRS_LINK_GAP_PX,
  STAIRS_STEPS,
  STAIRS_STEP_GAP_PX,
  STAIRS_STEP_MARGIN_PX,
  STAIRS_STEP_RADIUS_PX,
  WALL_WIDTH_PX,
} from '../constants';
import { LINE, theme } from '../theme';
import { Board } from '../board/board';
import { Marker, Stairs } from '../board/marker';

/**
 * Disegna i gradini delle scale, che sono un elemento architettonico e hanno i colori del dungeon. I tre lati chiusi sono
 * muri veri, disegnati con quelli dei tile (vedi markers/stairs-walls.ts), e restano aperti sul quarto lato, da cui si
 * entra. Qui ci sono i gradini, che riempiono tutto lo spazio dentro i muri dalla parete chiusa al lato aperto, come
 * rettangoli dagli angoli smussati. Fra i due capi, quando si conoscono entrambi, un filo sottile tratteggiato li unisce:
 * dice che sono collegati anche se le parti di mappa sono lontane. Nessuna lettera, nessun colore di coppia.
 */
export class StairsView {
  readonly container = new Container();
  private readonly links = new Graphics();
  private readonly ends = new Container();

  constructor() {
    this.container.addChild(this.links, this.ends);
  }

  /** `visible` dice quali scale mostrare (quelle rivelate); il filo compare quando sono visibili entrambi i capi. */
  redraw(board: Board, visible: (m: Marker) => boolean = () => true) {
    for (const child of this.ends.removeChildren()) child.destroy({ children: true });
    this.links.clear();
    const shown = board.markers.filter((m): m is Stairs => m.type === 'stairs' && visible(m));
    const color = theme.color.lineSecondary;

    for (const s of shown) {
      const root = new Container();
      root.position.set((s.x + 0.5) * CELL_SIZE, (s.y + 0.5) * CELL_SIZE);
      root.rotation = ((s.rotation ?? 0) * Math.PI) / 180; // disegnata con il lato aperto in basso
      root.addChild(this.steps(color));
      this.ends.addChild(root);
    }

    // Il filo che unisce i due capi (una volta per coppia), tratteggiato, da bordo a bordo della cella.
    const done = new Set<Stairs>();
    for (const s of shown) {
      const partner = board.stairsPartnerAt(s);
      if (!partner || done.has(s) || !shown.includes(partner)) continue;
      done.add(s);
      done.add(partner);
      this.dashed(s, partner);
    }
    this.links.stroke({ width: LINE.hairline, color, alpha: theme.alpha.stairsLink, pixelLine: true });
  }

  /** I gradini: rettangoli dagli angoli smussati, uno dopo l'altro dalla parete chiusa (in alto) al lato aperto (in basso). */
  private steps(color: number): Graphics {
    const g = new Graphics();
    const half = CELL_SIZE / 2;
    const wall = WALL_WIDTH_PX / 2; // la faccia interna dei muri
    const left = -half + wall + STAIRS_STEP_MARGIN_PX;
    const right = half - wall - STAIRS_STEP_MARGIN_PX;
    const top = -half + wall;
    const depth = half - top; // dalla faccia interna del muro chiuso al lato aperto
    const step = depth / STAIRS_STEPS;
    const r = STAIRS_STEP_RADIUS_PX;
    for (let i = 0; i < STAIRS_STEPS; i++) {
      const y0 = top + i * step + STAIRS_STEP_GAP_PX / 2;
      const y1 = top + (i + 1) * step - STAIRS_STEP_GAP_PX / 2;
      g.moveTo(left + r, y0)
        .lineTo(right - r, y0)
        .quadraticCurveTo(right, y0, right, y0 + r)
        .lineTo(right, y1 - r)
        .quadraticCurveTo(right, y1, right - r, y1)
        .lineTo(left + r, y1)
        .quadraticCurveTo(left, y1, left, y1 - r)
        .lineTo(left, y0 + r)
        .quadraticCurveTo(left, y0, left + r, y0)
        .closePath();
    }
    g.stroke({ width: LINE.hairline, color, pixelLine: true, join: 'round' });
    return g;
  }

  /**
   * Il filo da un capo all'altro: parte dal bordo della prima cella e corre in orizzontale (o in verticale) verso la
   * destinazione; se questa non è allineata curva generosamente, prosegue e, se serve, curva di nuovo per arrivare
   * dritto sulla seconda cella. È tratteggiato lungo tutto il percorso.
   */
  private dashed(a: Stairs, b: Stairs) {
    const route = this.route(a, b);
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
        if (drawing) this.links.moveTo(x0 + ((x1 - x0) * t) / length, y0 + ((y1 - y0) * t) / length).lineTo(x0 + ((x1 - x0) * (t + step)) / length, y0 + ((y1 - y0) * (t + step)) / length);
        t += step;
        carried += step;
        if (carried >= (drawing ? STAIRS_LINK_DASH_PX : STAIRS_LINK_GAP_PX) - 1e-6) {
          drawing = !drawing;
          carried = 0;
        }
      }
    }
  }

  /** I punti del percorso: orizzontale-verticale-orizzontale (o verticale-orizzontale-verticale), con gli angoli arrotondati. */
  private route(a: Stairs, b: Stairs): [number, number][] {
    const half = CELL_SIZE / 2;
    const ax = (a.x + 0.5) * CELL_SIZE;
    const ay = (a.y + 0.5) * CELL_SIZE;
    const bx = (b.x + 0.5) * CELL_SIZE;
    const by = (b.y + 0.5) * CELL_SIZE;
    const dx = bx - ax;
    const dy = by - ay;
    const horizontal = Math.abs(dx) >= Math.abs(dy); // si parte lungo l'asse più lungo
    // Il percorso nell'asse "principale" (u) e in quello "trasversale" (v), poi si rimette in x/y.
    const [u0, v0, u1, v1] = horizontal ? [ax, ay, bx, by] : [ay, ax, by, bx];
    const su = Math.sign(u1 - u0);
    const from = u0 + su * half; // il filo parte dal bordo della cella, non dal centro
    const to = u1 - su * half;
    const place = (u: number, v: number): [number, number] => (horizontal ? [u, v] : [v, u]);
    if (v0 === v1 || su * (to - from) <= 0) return [place(from, v0), place(to, v1)]; // allineate (o attaccate): dritto
    const mid = (from + to) / 2;
    const sv = Math.sign(v1 - v0);
    // Angoli: arrotondati con una curva generosa, ma mai più larga di metà dei tratti che li separano.
    const r = Math.min(STAIRS_LINK_CORNER_RADIUS_PX, Math.abs(mid - from), Math.abs(v1 - v0) / 2);
    const points: [number, number][] = [place(from, v0)];
    const corner = (cu: number, cv: number, inU: number, inV: number, outU: number, outV: number) => {
      // Dal punto a distanza r prima dell'angolo a quello a distanza r dopo, con una curva che ha l'angolo come punto di controllo.
      const sx = cu - inU * r;
      const sy = cv - inV * r;
      const ex = cu + outU * r;
      const ey = cv + outV * r;
      for (let k = 0; k <= STAIRS_LINK_CURVE_STEPS; k++) {
        const t = k / STAIRS_LINK_CURVE_STEPS;
        const p = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cu + t * t * ex;
        const q = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cv + t * t * ey;
        points.push(place(p, q));
      }
    };
    corner(mid, v0, su, 0, 0, sv);
    corner(mid, v1, 0, sv, su, 0);
    points.push(place(to, v1));
    return points;
  }
}
