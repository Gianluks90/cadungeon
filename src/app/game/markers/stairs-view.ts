import { Container, Graphics } from 'pixi.js';
import {
  CELL_SIZE,
  STAIRS_LINK_DASH_PX,
  STAIRS_LINK_BEND_COST_PX,
  STAIRS_LINK_CORNER_RADIUS_PX,
  STAIRS_LINK_ROOM_COST_PX,
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

/** Il filo di una coppia: le due scale (`a` è quella che tiene il percorso salvato), i punti del percorso a segmenti in pixel (dall'uscita di `a` all'arrivo su `b`) e i versi dei due lati in alto. */
export interface StairsLink {
  a: Stairs;
  b: Stairs;
  pts: [number, number][];
  ua: [number, number];
  ub: [number, number];
}

/**
 * Disegna i gradini delle scale, che sono un elemento architettonico e hanno i colori del dungeon. I tre lati chiusi sono
 * muri veri, disegnati con quelli dei tile (vedi markers/stairs-walls.ts), e restano aperti sul quarto lato, da cui si
 * entra. Qui ci sono i gradini, che riempiono tutto lo spazio dentro i muri dalla parete chiusa al lato aperto, come
 * rettangoli dagli angoli smussati. Fra i due capi, se almeno uno è rivelato, un filo sottile tratteggiato li unisce (parte dal lato in alto, quello chiuso, di ognuno):
 * dice che sono collegati anche se le parti di mappa sono lontane. Nessuna lettera, nessun colore di coppia.
 */
export class StairsView {
  readonly container = new Container();
  private readonly links = new Graphics();
  private readonly ends = new Container();
  /** I fili disegnati all'ultimo ridisegno, con il percorso a segmenti (senza curve): servono all'editor per le maniglie. */
  links_: StairsLink[] = [];

  constructor() {
    this.container.addChild(this.links, this.ends);
  }

  /** `visible` dice quali scale mostrare (quelle rivelate); il filo compare quando sono visibili entrambi i capi. */
  redraw(board: Board, visible: (m: Marker) => boolean = () => true) {
    for (const child of this.ends.removeChildren()) child.destroy({ children: true });
    this.links.clear();
    this.links_ = [];
    const shown = board.markers.filter((m): m is Stairs => m.type === 'stairs' && visible(m));
    const color = theme.color.lineSecondary;

    for (const s of shown) {
      const root = new Container();
      root.position.set((s.x + 0.5) * CELL_SIZE, (s.y + 0.5) * CELL_SIZE);
      root.rotation = ((s.rotation ?? 0) * Math.PI) / 180; // disegnata con il lato aperto in basso
      root.addChild(this.steps(color));
      this.ends.addChild(root);
    }

    // Il filo che unisce i due capi (una volta per coppia), tratteggiato: parte dal lato "in alto" di ognuno (quello chiuso). Si disegna se almeno uno dei due capi è visibile.
    const done = new Set<Stairs>();
    for (const s of shown) {
      const partner = board.stairsPartnerAt(s);
      if (!partner || done.has(s) || done.has(partner)) continue;
      done.add(s);
      done.add(partner);
      // La coppia si legge sempre dallo stesso capo (il primo nella mappa), qualunque sia quello rivelato: così il percorso salvato (`route`) è lo stesso.
      const order = board.markers.indexOf(s) <= board.markers.indexOf(partner);
      const link = this.layout(order ? s : partner, order ? partner : s, board);
      this.links_.push(link);
      this.dashed(link.pts);
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
  private dashed(pts: [number, number][]) {
    const route = this.rounded(pts);
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

  /** Il verso, in cella, in cui sta il lato "in alto" di una scala: quello chiuso, da cui partono i gradini (opposto al lato aperto, e ruota con la scala). */
  private back(s: Stairs): [number, number] {
    const r = (((s.rotation ?? 0) % 360) + 360) % 360;
    return r === 90 ? [1, 0] : r === 180 ? [0, 1] : r === 270 ? [-1, 0] : [0, -1];
  }

  /**
   * Il percorso del filo: esce dal lato "in alto" (chiuso) di una scala, cammina a segmenti orizzontali e verticali con gli angoli arrotondati, e arriva al lato "in alto"
   * dell'altra, senza mai tornare indietro contro le scale. Fra le strade possibili sceglie la migliore: poche curve (di più pesano le curve), strada corta, e il meno possibile
   * sopra le caselle delle stanze (se serve passa fuori dalla mappa, attorno a tutto). Le stanze non sono vietate: è un criterio, non un obbligo.
   */
  private layout(a: Stairs, b: Stairs, board: Board): StairsLink {
    const half = CELL_SIZE / 2;
    const stub = STAIRS_LINK_CORNER_RADIUS_PX; // un tratto dritto all'uscita e all'arrivo, prima di poter curvare
    const ua = this.back(a);
    const ub = this.back(b);
    const p0: [number, number] = [(a.x + 0.5) * CELL_SIZE + ua[0] * half, (a.y + 0.5) * CELL_SIZE + ua[1] * half];
    const p1: [number, number] = [(b.x + 0.5) * CELL_SIZE + ub[0] * half, (b.y + 0.5) * CELL_SIZE + ub[1] * half];
    const a1: [number, number] = [p0[0] + ua[0] * stub, p0[1] + ua[1] * stub];
    const b1: [number, number] = [p1[0] + ub[0] * stub, p1[1] + ub[1] * stub];
    const mx = (a1[0] + b1[0]) / 2;
    const my = (a1[1] + b1[1]) / 2;
    const wide = half + stub; // quanto basta per aggirare una scala
    const near = { left: Math.min(a1[0], b1[0]) - wide, right: Math.max(a1[0], b1[0]) + wide, top: Math.min(a1[1], b1[1]) - wide, bottom: Math.max(a1[1], b1[1]) + wide };
    // Fuori da tutta la mappa: una cornice attorno ai tile, dove il filo non passa su nessuna stanza.
    const cb = board.cellBounds();
    const far = cb
      ? { left: cb.x0 * CELL_SIZE - wide, right: cb.x1 * CELL_SIZE + wide, top: cb.y0 * CELL_SIZE - wide, bottom: cb.y1 * CELL_SIZE + wide }
      : near;
    const middles: [number, number][][] = [
      [],
      [[b1[0], a1[1]]],
      [[a1[0], b1[1]]],
      [[mx, a1[1]], [mx, b1[1]]],
      [[a1[0], my], [b1[0], my]],
    ];
    for (const e of [near, far]) {
      // Aggiramenti a U (anche quando le scale si danno le spalle).
      middles.push([[e.left, a1[1]], [e.left, b1[1]]], [[e.right, a1[1]], [e.right, b1[1]]], [[a1[0], e.top], [b1[0], e.top]], [[a1[0], e.bottom], [b1[0], e.bottom]]);
    }
    const clean = (pts: [number, number][]) => pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.5);
    const sign = (p: [number, number], q: [number, number]): [number, number] => [Math.sign(q[0] - p[0]), Math.sign(q[1] - p[1])];
    /** Le caselle dei tile che il percorso attraversa (campionato ogni 16 px). */
    const rooms = (pts: [number, number][]) => {
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
    let best: [number, number][] | null = null;
    let bestCost = Infinity;
    for (const m of middles) {
      const mid = clean([a1, ...m, b1]);
      const first = mid.length > 1 ? sign(mid[0], mid[1]) : ([-ub[0], -ub[1]] as [number, number]);
      const last = mid.length > 1 ? sign(mid[mid.length - 2], mid[mid.length - 1]) : ([-ub[0], -ub[1]] as [number, number]);
      if (first[0] * ua[0] + first[1] * ua[1] < 0 || last[0] * ub[0] + last[1] * ub[1] > 0) continue; // tornerebbe indietro contro una delle due scale
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
        best = mid;
      }
    }
    // Un percorso scelto dall'autore (le maniglie dell'editor) vale più di quello automatico, se è ancora coerente con le due scale.
    const saved = a.route?.length ? clean([p0, ...a.route.map((p): [number, number] => [p.x * CELL_SIZE, p.y * CELL_SIZE]), p1]) : null;
    if (saved && this.routeFits(saved, ua, ub)) return { a, b, pts: saved, ua, ub };
    return { a, b, pts: clean([p0, ...(best ?? [a1, b1]), p1]), ua, ub };
  }

  /** Un percorso salvato è ancora buono? Solo segmenti orizzontali e verticali, esce dalla scala `a` lungo il suo lato in alto e arriva sul lato in alto di `b`. */
  private routeFits(pts: [number, number][], ua: [number, number], ub: [number, number]): boolean {
    if (pts.length < 4) return false; // p0, almeno due punti intermedi (anche in linea retta), p1
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i][0] - pts[i - 1][0]) > 0.5 && Math.abs(pts[i][1] - pts[i - 1][1]) > 0.5) return false;
    const out = [Math.sign(pts[1][0] - pts[0][0]), Math.sign(pts[1][1] - pts[0][1])];
    const n = pts.length;
    const into = [Math.sign(pts[n - 1][0] - pts[n - 2][0]), Math.sign(pts[n - 1][1] - pts[n - 2][1])];
    return out[0] === ua[0] && out[1] === ua[1] && into[0] === -ub[0] && into[1] === -ub[1];
  }
  /** Arrotonda gli angoli di un percorso a segmenti: ogni angolo diventa una curva con l'angolo come punto di controllo, larga al massimo metà dei due tratti che lo formano. */
  private rounded(pts: [number, number][]): [number, number][] {
    const out: [number, number][] = [pts[0]];
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
}