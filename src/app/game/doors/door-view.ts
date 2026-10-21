import { Container, Graphics } from 'pixi.js';
import { CELL_SIZE, DOOR_COLOR, DOOR_THICKNESS_PX, JAMB_POST_LENGTH_PX, WALL_WIDTH_PX } from '../constants';
import { Board } from '../board/board';
import { DoorSpan } from '../board/door';

/** Disegna le porte: segmenti marroni sulle linee della griglia. Chiusa piena, aperta solo il contorno. */
export class DoorView {
  readonly container = new Container();
  private readonly doors = new Graphics();
  private readonly preview = new Graphics();

  constructor() {
    this.container.addChild(this.doors, this.preview);
  }

  /**
   * La barra della porta. Si ferma sulle facce interne dei muri ai due lati; su un varco si ferma
   * invece sulla punta degli stipiti, così sta tra di loro senza sovrapporsi.
   */
  private bar(g: Graphics, d: DoorSpan, posts: boolean) {
    const inset = posts ? JAMB_POST_LENGTH_PX : WALL_WIDTH_PX / 2;
    const a = d.from * CELL_SIZE + inset;
    const length = (d.to - d.from) * CELL_SIZE - inset * 2;
    const c = d.line * CELL_SIZE - DOOR_THICKNESS_PX / 2;
    if (d.horizontal) g.rect(a, c, length, DOOR_THICKNESS_PX);
    else g.rect(c, a, DOOR_THICKNESS_PX, length);
  }

  redraw(board: Board) {
    this.doors.clear();
    for (const d of board.doors) {
      this.bar(this.doors, d, board.hasJambPosts(d));
      if (d.door.open) this.doors.stroke({ width: 1, color: DOOR_COLOR, alpha: 0.6, pixelLine: true });
      else this.doors.fill(DOOR_COLOR);
    }
  }

  /** Anteprima mentre si piazzano le porte: piena se è una porta nuova, solo contorno se c'è già (si toglierebbe). */
  setPreview(span: DoorSpan | null, exists = false, posts = false) {
    this.preview.clear();
    if (!span) return;
    this.bar(this.preview, span, posts);
    if (exists) this.preview.stroke({ width: 1, color: 0xe0a040, alpha: 0.9, pixelLine: true });
    else this.preview.fill({ color: DOOR_COLOR, alpha: 0.5 });
  }
}
