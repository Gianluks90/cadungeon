import { Container, Graphics } from 'pixi.js';
import {
  CELL_SIZE,
  STAIRS_STEPS,
  STAIRS_STEP_OVERLAP,
  STAIRS_STEP_PADDING_PX,
  STAIRS_STEP_RADIUS_PX,
  WALL_WIDTH_PX,
} from '../constants';
import { LINE, theme } from '../theme';
import { Board } from '../board/board';
import { LinkEnd, LinkInfo, dashedPath, layoutLink } from './link-line';
import { Marker, Stairs } from '../board/marker';

/** Il filo di una coppia: le due scale (`a` è quella che tiene il percorso salvato), i punti del percorso a segmenti in pixel (dall'uscita di `a` all'arrivo su `b`) e i versi dei due lati in alto. */
export type StairsLink = LinkInfo<Stairs>;

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
      root.addChild(this.steps(s, board, color));
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
      const [a, b] = order ? [s, partner] : [partner, s];
      const half = CELL_SIZE / 2;
      const end = (m: Stairs): LinkEnd => ({ x: m.x, y: m.y, edge: half, dir: this.back(m), route: m.route });
      const link: StairsLink = { a, b, ...layoutLink(end(a), end(b), board) };
      this.links_.push(link);
      dashedPath(this.links, link.pts);
    }
    this.links.stroke({ width: LINE.hairline, color, alpha: theme.alpha.stairsLink, pixelLine: true });
  }

  /**
   * I gradini: rettangoli attaccati l'uno all'altro (senza vuoti) dalla parete chiusa (in alto) al lato aperto (in basso), ognuno con gli angoli smussati dalla parte del lato aperto.
   * Dove un lato chiuso guarda il vuoto il muro sta fuori dalla casella (i gradini arrivano al bordo); dove guarda un'altra casella è centrato sulla linea, e i gradini si fermano alla sua faccia interna.
   */
  private steps(s: Stairs, board: Board, color: number): Graphics {
    const g = new Graphics();
    const half = CELL_SIZE / 2;
    // I tre lati chiusi (in alto, a sinistra e a destra nel disegno, che ha il lato aperto in basso) e il lato del mondo a cui corrispondono a ogni rotazione.
    const worlds = { 0: ['N', 'W', 'E'], 90: ['E', 'N', 'S'], 180: ['S', 'E', 'W'], 270: ['W', 'S', 'N'] }[s.rotation ?? 0] as ('N' | 'E' | 'S' | 'W')[];
    const [t, l, rt] = worlds.map((side) => (board.isVoidSide(s, side) ? 0 : WALL_WIDTH_PX / 2));
    const pad = STAIRS_STEP_PADDING_PX; // un po' di aria ai lati e all'ingresso, nessuna dal lato della parete chiusa
    const left = -half + l + pad;
    const right = half - rt - pad;
    const top = -half + t;
    const bottom = half - pad;
    const r = STAIRS_STEP_RADIUS_PX;
    // Gradini tutti uguali (stessa larghezza e altezza) come se la scala salisse: si parte da quello all'ingresso e ognuno successivo, più lontano, si sovrappone al precedente (disegnato dopo, quindi sopra),
    // coprendone la parte alta. `pitch` è la distanza fra i bordi bassi di due gradini vicini; l'ultimo arriva alla parete chiusa.
    const pitch = (bottom - top) / (STAIRS_STEPS + STAIRS_STEP_OVERLAP);
    const height = pitch * (1 + STAIRS_STEP_OVERLAP);
    for (let i = 0; i < STAIRS_STEPS; i++) {
      const y1 = bottom - i * pitch;
      const y0 = y1 - height;
      g.moveTo(left, y0).lineTo(right, y0).lineTo(right, y1 - r).quadraticCurveTo(right, y1, right - r, y1).lineTo(left + r, y1).quadraticCurveTo(left, y1, left, y1 - r).closePath().fill(theme.color.floor);
      // L'ultimo gradino, contro la parete chiusa, non ha il bordo in alto (c'è già il muro).
      g.moveTo(right, y0);
      if (i < STAIRS_STEPS - 1) g.moveTo(left, y0).lineTo(right, y0);
      g.lineTo(right, y1 - r).quadraticCurveTo(right, y1, right - r, y1).lineTo(left + r, y1).quadraticCurveTo(left, y1, left, y1 - r).lineTo(left, y0);
      g.stroke({ width: LINE.hairline, color, pixelLine: true, join: 'round' });
    }
    return g;
  }

  /** Il verso, in cella, in cui sta il lato "in alto" di una scala: quello chiuso, da cui partono i gradini (opposto al lato aperto, e ruota con la scala). */
  private back(s: Stairs): [number, number] {
    const r = (((s.rotation ?? 0) % 360) + 360) % 360;
    return r === 90 ? [1, 0] : r === 180 ? [0, 1] : r === 270 ? [-1, 0] : [0, -1];
  }
}
