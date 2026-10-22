import { Container, Graphics } from 'pixi.js';
import {
  CELL_SIZE,
  DOOR_COLOR,
  DOOR_HATCH_ALPHA,
  DOOR_HATCH_SPACING_PX,
  DOOR_LINE_ALPHA,
  DOOR_LINE_WIDTH_PX,
  DOOR_ARC_ALPHA,
  DOOR_ARC_DASH_PX,
  DOOR_ARC_GAP_PX,
  DOOR_THICKNESS_PX,
  DOOR_WALL_CLEARANCE_PX,
  JAMB_POST_LENGTH_PX,
  WALL_WIDTH_PX,
} from '../constants';
import { Board } from '../board/board';
import { DoorSpan } from '../board/door';

/** Com'è disegnata una porta: chiusa (tratteggio), aperta (anta e arco) o bloccata (tratteggio incrociato). */
export type DoorLook = 'closed' | 'open' | 'locked';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Disegna le porte nello stile lineare della scena, marroni e spente. Chiusa: rettangolo sottile con un tratteggio
 * diagonale. Aperta: solo la linea dell'anta e il suo arco di rotazione. Bloccata (non ancora usata dal gioco):
 * come la chiusa, ma con il tratteggio incrociato.
 */
export class DoorView {
  readonly container = new Container();
  private readonly doors = new Graphics();
  private readonly preview = new Graphics();

  constructor() {
    this.container.addChild(this.doors, this.preview);
  }

  /**
   * Il tratto della porta lungo la sua linea: da dove parte e quanto è lungo. Si ferma a DOOR_WALL_CLEARANCE_PX
   * dalle facce interne dei muri ai due lati; su un varco, dalla punta degli stipiti: così non tocca le loro linee.
   */
  private span(d: DoorSpan, posts: boolean) {
    const inset = (posts ? JAMB_POST_LENGTH_PX : WALL_WIDTH_PX / 2) + DOOR_WALL_CLEARANCE_PX;
    return { start: d.from * CELL_SIZE + inset, length: (d.to - d.from) * CELL_SIZE - inset * 2 };
  }

  /** Il rettangolo della porta chiusa. */
  private rect(d: DoorSpan, posts: boolean): Rect {
    const { start, length } = this.span(d, posts);
    const c = d.line * CELL_SIZE - DOOR_THICKNESS_PX / 2;
    return d.horizontal
      ? { x: start, y: c, w: length, h: DOOR_THICKNESS_PX }
      : { x: c, y: start, w: DOOR_THICKNESS_PX, h: length };
  }

  /** Porta chiusa o bloccata: contorno sottile e tratteggio diagonale (incrociato se bloccata). */
  private drawClosed(g: Graphics, d: DoorSpan, posts: boolean, cross: boolean) {
    this.hatchedRect(g, this.rect(d, posts), cross);
  }

  /** Un rettangolo con contorno sottile e tratteggio diagonale (incrociato se `cross`). */
  private hatchedRect(g: Graphics, r: Rect, cross: boolean) {
    g.rect(r.x, r.y, r.w, r.h);
    g.stroke({ width: DOOR_LINE_WIDTH_PX, color: DOOR_COLOR, alpha: DOOR_LINE_ALPHA, pixelLine: true });

    const step = DOOR_HATCH_SPACING_PX;
    // Linee x + y = s: dal basso a sinistra in alto a destra, ridotte al rettangolo. Allineate al mondo.
    for (let s = Math.ceil((r.x + r.y) / step) * step; s <= r.x + r.w + r.y + r.h; s += step) {
      const x0 = Math.max(r.x, s - (r.y + r.h));
      const x1 = Math.min(r.x + r.w, s - r.y);
      if (x0 < x1) g.moveTo(x0, s - x0).lineTo(x1, s - x1);
    }
    if (cross) {
      // Linee x - y = s: dall'alto a sinistra in basso a destra.
      for (let s = Math.ceil((r.x - (r.y + r.h)) / step) * step; s <= r.x + r.w - r.y; s += step) {
        const x0 = Math.max(r.x, s + r.y);
        const x1 = Math.min(r.x + r.w, s + r.y + r.h);
        if (x0 < x1) g.moveTo(x0, x0 - s).lineTo(x1, x1 - s);
      }
    }
    g.stroke({ width: DOOR_LINE_WIDTH_PX, color: DOOR_COLOR, alpha: DOOR_HATCH_ALPHA, pixelLine: true });
  }

  /**
   * Porta aperta: l'anta è una vera porta, un rettangolo tratteggiato lungo quanto il varco e perpendicolare alla
   * linea; più tenue, l'arco (quarto di cerchio) che ha percorso. Il cardine è a un'estremità. `swing` dice
   * da che parte si apre (davanti a chi l'ha aperta): 1 = lato positivo (sotto o a destra), -1 = lato negativo.
   */
  private drawOpen(g: Graphics, d: DoorSpan, posts: boolean, swing: 1 | -1) {
    const { start, length } = this.span(d, posts);
    const line = d.line * CELL_SIZE;
    const t = DOOR_THICKNESS_PX;
    // L'anta: sul lato scelto, con il bordo del cardine a filo dell'inizio del varco.
    const across = swing === 1 ? line : line - length;
    const leaf: Rect = d.horizontal ? { x: start, y: across, w: t, h: length } : { x: across, y: start, w: length, h: t };
    this.hatchedRect(g, leaf, false);

    // L'arco: dal punto dove arrivava la porta chiusa fino alla punta dell'anta, con il centro sul cardine.
    const pivot = d.horizontal ? [start, line] : [line, start];
    const from = d.horizontal ? 0 : Math.PI / 2;
    const to = d.horizontal ? (swing * Math.PI) / 2 : swing === 1 ? 0 : Math.PI;
    // Tratteggiato: PixiJS non ha il tratteggio, quindi si disegna a trattini lungo l'arco.
    const total = length * (Math.PI / 2);
    for (let s = 0; s < total; s += DOOR_ARC_DASH_PX + DOOR_ARC_GAP_PX) {
      const end = Math.min(s + DOOR_ARC_DASH_PX, total);
      const steps = Math.max(1, Math.ceil((end - s) / 2));
      for (let k = 0; k <= steps; k++) {
        const a = from + (to - from) * ((s + ((end - s) * k) / steps) / total);
        const x = pivot[0] + length * Math.cos(a);
        const y = pivot[1] + length * Math.sin(a);
        if (k === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
    }
    g.stroke({ width: DOOR_LINE_WIDTH_PX, color: DOOR_COLOR, alpha: DOOR_ARC_ALPHA, pixelLine: true });
  }

  /** `look` dice come disegnare la porta `index` (chiusa o aperta se non lo dice, bloccata solo se chi chiama lo indica). */
  redraw(board: Board, look?: (index: number) => DoorLook | undefined) {
    this.doors.clear();
    board.doors.forEach((d, i) => {
      const posts = board.hasJambPosts(d);
      const kind = look?.(i) ?? (d.door.open ? 'open' : 'closed');
      if (kind === 'open') this.drawOpen(this.doors, d, posts, d.door.swing ?? 1);
      else this.drawClosed(this.doors, d, posts, kind === 'locked');
    });
  }

  /** Anteprima mentre si piazzano le porte: una porta chiusa tenue se è nuova, solo il contorno acceso se c'è già (si toglierebbe). */
  setPreview(span: DoorSpan | null, exists = false, posts = false) {
    this.preview.clear();
    if (!span) return;
    if (exists) {
      const r = this.rect(span, posts);
      this.preview.rect(r.x, r.y, r.w, r.h).stroke({ width: DOOR_LINE_WIDTH_PX, color: 0xe0a040, alpha: 0.9, pixelLine: true });
    } else {
      this.drawClosed(this.preview, span, posts, false);
    }
  }
}
