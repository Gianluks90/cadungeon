import { Container, Graphics } from 'pixi.js';
import {
  CELL_SIZE,
  DOOR_ANIM_MS,
  DOOR_ARC_DASH_PX,
  DOOR_ARC_GAP_PX,
  DOOR_BADGE_RADIUS_PX,
  DOOR_HATCH_SPACING_PX,
  DOOR_ICON_FADE_MS,
  DOOR_ICON_SIZE_PX,
  DOOR_LINE_WIDTH_PX,
  DOOR_THICKNESS_PX,
  DOOR_WALL_CLEARANCE_PX,
  ICONS,
  JAMB_POST_LENGTH_PX,
  WALL_WIDTH_PX,
} from '../constants';
import { theme } from '../theme';
import { Board } from '../board/board';
import { Door, DoorSpan, ResolvedDoor, isLocked } from '../board/door';
import { createIcon } from '../icons/icon-loader';

type Pt = [number, number];

/** Dove sono arrivate le animazioni di una porta: apertura (0 chiusa, 1 aperta) e icona (1 visibile, 0 sparita). */
interface DoorAnim {
  open: number;
  openTarget: 0 | 1;
  icon: number;
  iconTarget: 0 | 1;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Disegna le porte nello stile lineare della scena, marroni e spente. Chiusa: rettangolo sottile con un tratteggio
 * diagonale (incrociato se è bloccata da una serratura, con un'icona sopra). Aperta: l'anta tratteggiata, perpendicolare
 * alla linea, e l'arco tratteggiato che ha percorso. Quando una porta si apre o si chiude l'anta ruota attorno al
 * cardine, con l'arco che si disegna mentre gira.
 */
export class DoorView {
  readonly container = new Container();
  private readonly doors = new Graphics();
  private readonly badges = new Container();
  private readonly preview = new Graphics();

  private board: Board | null = null;
  /** Quali porte mostrare (quelle rivelate); senza restrizioni se non si dice niente. */
  private visible: (d: Door) => boolean = () => true;
  private readonly anim = new WeakMap<Door, DoorAnim>();
  private readonly badgeOf = new Map<Door, { view: Container }>();

  constructor() {
    this.container.addChild(this.doors, this.badges, this.preview);
  }

  /**
   * Il tratto della porta lungo la sua linea: da dove parte e quanto è lungo. Si ferma a DOOR_WALL_CLEARANCE_PX
   * dalle facce interne dei muri ai due lati; su un varco, dalla punta degli stipiti: così non tocca le loro linee.
   */
  private span(d: DoorSpan, posts: boolean) {
    const inset = (posts ? JAMB_POST_LENGTH_PX : WALL_WIDTH_PX / 2) + DOOR_WALL_CLEARANCE_PX;
    return { start: d.from * CELL_SIZE + inset, length: (d.to - d.from) * CELL_SIZE - inset * 2 };
  }

  /** Il rettangolo della porta chiusa, come quattro punti. */
  private closedPoly(d: DoorSpan, posts: boolean): Pt[] {
    const { start, length } = this.span(d, posts);
    const c = d.line * CELL_SIZE - DOOR_THICKNESS_PX / 2;
    const t = DOOR_THICKNESS_PX;
    return d.horizontal
      ? [[start, c], [start + length, c], [start + length, c + t], [start, c + t]]
      : [[c, start], [c + t, start], [c + t, start + length], [c, start + length]];
  }

  /** Un poligono convesso con contorno sottile e tratteggio diagonale (incrociato se `cross`). */
  private hatched(g: Graphics, poly: Pt[], cross: boolean) {
    g.poly(poly.flat());
    g.stroke({ width: DOOR_LINE_WIDTH_PX, color: theme.color.accentDoor, alpha: theme.alpha.doorLine, pixelLine: true });

    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const step = DOOR_HATCH_SPACING_PX;
    // Il tratteggio è allineato al mondo (linee x + y = s e, se incrociato, x - y = s), così non "scivola" quando l'anta ruota.
    for (let s = Math.ceil((minX + minY) / step) * step; s <= maxX + maxY; s += step) {
      this.clipLine(g, poly, [minX - 1, s - (minX - 1)], [maxX + 1, s - (maxX + 1)]);
    }
    if (cross) {
      for (let s = Math.ceil((minX - maxY) / step) * step; s <= maxX - minY; s += step) {
        this.clipLine(g, poly, [minX - 1, minX - 1 - s], [maxX + 1, maxX + 1 - s]);
      }
    }
    g.stroke({ width: DOOR_LINE_WIDTH_PX, color: theme.color.accentDoor, alpha: theme.alpha.doorHatch, pixelLine: true });
  }

  /** Disegna la parte del segmento p0-p1 che sta dentro il poligono convesso (taglio di Cyrus-Beck). */
  private clipLine(g: Graphics, poly: Pt[], p0: Pt, p1: Pt) {
    let area = 0;
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length];
      area += a[0] * b[1] - b[0] * a[1];
    });
    const orient = area >= 0 ? 1 : -1;
    let t0 = 0;
    let t1 = 1;
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      // Normale verso l'interno del lato a-b.
      const nx = -(b[1] - a[1]) * orient;
      const ny = (b[0] - a[0]) * orient;
      const num = nx * (p0[0] - a[0]) + ny * (p0[1] - a[1]);
      const den = nx * dx + ny * dy;
      if (Math.abs(den) < 1e-9) {
        if (num < 0) return;
      } else {
        const t = -num / den;
        if (den > 0) t0 = Math.max(t0, t);
        else t1 = Math.min(t1, t);
      }
    }
    if (t1 - t0 < 1e-3) return;
    g.moveTo(p0[0] + dx * t0, p0[1] + dy * t0).lineTo(p0[0] + dx * t1, p0[1] + dy * t1);
  }

  /**
   * Un tratto di arco tratteggiato attorno al cardine, dal punto dove arrivava la porta chiusa fino a `fraction`
   * (0..1) del quarto di cerchio fino alla punta dell'anta aperta. Il tratteggio parte sempre dallo stesso punto,
   * quindi mentre l'arco cresce i trattini non si spostano.
   */
  private drawArc(g: Graphics, pivot: Pt, length: number, from: number, to: number, fraction: number) {
    const total = length * (Math.PI / 2);
    const limit = total * fraction;
    for (let s = 0; s < limit; s += DOOR_ARC_DASH_PX + DOOR_ARC_GAP_PX) {
      const end = Math.min(s + DOOR_ARC_DASH_PX, limit);
      const steps = Math.max(1, Math.ceil((end - s) / 2));
      for (let k = 0; k <= steps; k++) {
        const a = from + (to - from) * ((s + ((end - s) * k) / steps) / total);
        const x = pivot[0] + length * Math.cos(a);
        const y = pivot[1] + length * Math.sin(a);
        if (k === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
    }
    g.stroke({ width: DOOR_LINE_WIDTH_PX, color: theme.color.accentDoor, alpha: theme.alpha.doorArc, pixelLine: true });
  }

  /**
   * L'anta quando è aperta di `k` (0 = chiusa, 1 = aperta del tutto): ruota attorno al cardine, a un'estremità del
   * varco, verso il lato `swing` (1 = sotto o a destra, -1 = sopra o a sinistra). A k = 1 è esattamente l'anta aperta
   * a riposo (perpendicolare alla linea, accanto al cardine); a k = 0 è la porta chiusa.
   */
  private drawLeaf(g: Graphics, d: DoorSpan, posts: boolean, swing: 1 | -1, k: number) {
    const { start, length } = this.span(d, posts);
    const line = d.line * CELL_SIZE;
    const t = DOOR_THICKNESS_PX;
    const pivot: Pt = d.horizontal ? [start, line] : [line, start];
    // Direzione dell'anta e suo "spessore" quando è chiusa; poi si ruotano insieme.
    const along: Pt = d.horizontal ? [1, 0] : [0, 1];
    const across: Pt = d.horizontal ? [0, 1] : [1, 0];
    const angle = (d.horizontal ? swing : -swing) * (Math.PI / 2) * k;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rot = (v: Pt): Pt => [v[0] * cos - v[1] * sin, v[0] * sin + v[1] * cos];
    const a = rot(along);
    const n = rot(across);
    // Lo spessore parte centrato sulla linea e finisce accanto al cardine, dal lato verso cui si apre.
    const v0 = -t / 2 + ((swing === 1 ? -t : 0) + t / 2) * k;
    const pt = (u: number, v: number): Pt => [pivot[0] + u * a[0] + v * n[0], pivot[1] + u * a[1] + v * n[1]];
    this.hatched(g, [pt(0, v0), pt(length, v0), pt(length, v0 + t), pt(0, v0 + t)], false);

    if (k > 0) {
      const from = d.horizontal ? 0 : Math.PI / 2;
      const to = d.horizontal ? (swing * Math.PI) / 2 : swing === 1 ? 0 : Math.PI;
      this.drawArc(g, pivot, length, from, to, k);
    }
  }

  /** Lo stato di animazione di una porta; la prima volta parte già dove deve stare, senza muoversi. */
  private animOf(door: Door): DoorAnim {
    let a = this.anim.get(door);
    if (!a) {
      a = { open: door.open ? 1 : 0, openTarget: door.open ? 1 : 0, icon: isLocked(door) ? 1 : 0, iconTarget: isLocked(door) ? 1 : 0 };
      this.anim.set(door, a);
    }
    return a;
  }

  /** Ridisegna tutte le porte come sono ora; se una è cambiata (aperta, chiusa, sbloccata) parte l'animazione. */
  redraw(board: Board, visible: (d: Door) => boolean = () => true) {
    this.board = board;
    this.visible = visible;
    for (const d of board.doors) {
      const a = this.animOf(d.door);
      a.openTarget = d.door.open ? 1 : 0;
      a.iconTarget = isLocked(d.door) ? 1 : 0;
    }
    this.buildBadges(board);
    this.draw();
  }

  /** Da chiamare a ogni frame (con i millisecondi trascorsi): fa avanzare le animazioni delle porte. */
  tick(deltaMs: number) {
    if (!this.board) return;
    let moved = false;
    for (const d of this.board.doors) {
      const a = this.animOf(d.door);
      const step = (v: number, target: number, ms: number) => (v === target ? v : v < target ? Math.min(target, v + deltaMs / ms) : Math.max(target, v - deltaMs / ms));
      const open = step(a.open, a.openTarget, DOOR_ANIM_MS);
      const icon = step(a.icon, a.iconTarget, DOOR_ICON_FADE_MS);
      if (open !== a.open || icon !== a.icon) moved = true;
      a.open = open;
      a.icon = icon;
    }
    if (moved) this.draw();
  }

  private draw() {
    const board = this.board;
    if (!board) return;
    this.doors.clear();
    for (const d of board.doors) {
      if (!this.visible(d.door)) continue;
      const posts = board.hasJambPosts(d);
      const a = this.animOf(d.door);
      const k = easeInOut(a.open);
      if (k <= 0) this.hatched(this.doors, this.closedPoly(d, posts), isLocked(d.door));
      else this.drawLeaf(this.doors, d, posts, d.door.swing ?? 1, k);

      const badge = this.badgeOf.get(d.door);
      if (badge) {
        badge.view.alpha = a.icon;
        badge.view.visible = a.icon > 0.01;
      }
    }
  }

  /** I distintivi (disco con l'icona della chiave o della runa) delle porte che hanno una serratura. */
  private buildBadges(board: Board) {
    for (const child of this.badges.removeChildren()) child.destroy({ children: true });
    this.badgeOf.clear();
    for (const d of board.doors) {
      const lock = d.door.lock;
      if (!lock || !this.visible(d.door)) continue;
      const { start, length } = this.span(d, board.hasJambPosts(d));
      const along = start + length / 2;
      const color = lock.kind === 'rune' ? theme.color.rune[lock.color] : theme.color.doorKey;
      const view = new Container();
      view.position.set(d.horizontal ? along : d.line * CELL_SIZE, d.horizontal ? d.line * CELL_SIZE : along);
      // Un disco col colore del pavimento, perché l'icona si legga sopra il tratteggio, con un anello nel colore dell'icona.
      view.addChild(
        new Graphics()
          .circle(0, 0, DOOR_BADGE_RADIUS_PX)
          .fill(theme.color.floor)
          .stroke({ width: DOOR_LINE_WIDTH_PX, color, alpha: theme.alpha.doorLine, pixelLine: true }),
      );
      const icon = createIcon(lock.kind === 'rune' ? ICONS.doorRune : ICONS.doorKey, DOOR_ICON_SIZE_PX, color);
      icon.alpha = theme.alpha.doorIcon;
      view.addChild(icon);
      this.badges.addChild(view);
      this.badgeOf.set(d.door, { view });
    }
  }

  /** Anteprima mentre si piazzano le porte: una porta chiusa tenue se è nuova, solo il contorno acceso se c'è già (si toglierebbe). */
  setPreview(span: DoorSpan | null, exists = false, posts = false) {
    this.preview.clear();
    if (!span) return;
    if (exists) {
      this.preview.poly(this.closedPoly(span, posts).flat()).stroke({ width: DOOR_LINE_WIDTH_PX, color: theme.color.accentSelect, alpha: theme.alpha.doorPreview, pixelLine: true });
    } else {
      this.hatched(this.preview, this.closedPoly(span, posts), false);
    }
  }
}
