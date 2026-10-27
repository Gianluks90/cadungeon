import { Container, Graphics } from 'pixi.js';
import { CELL_SIZE } from '../constants';
import { Board } from '../board/board';
import { Marker } from '../board/marker';
import { theme } from '../theme';

/** Un "?" a tratti larghi centrato sull'origine: il gancio in alto e il gambo, e sotto il punto (la pietra). Misure in pixel. */
const HOOK: [number, number][] = [[-9, -13], [-9, -26], [9, -26], [9, -13], [9, -3], [0, -3], [0, 5]];
const GEM = { y: 17, r: 5 };

/**
 * Disegna i segnalini Incontro: un punto interrogativo scuro, con un bordo chiaro che lo stacca dal pavimento, due fasce (una più scura e una arancione) e una pietra gialla come punto.
 * Statico. I colori sono quelli del tema (`theme.color.encounter`).
 */
export class EncounterView {
  readonly container = new Container();

  /** `visible` dice quali mostrare (quelli rivelati); senza, si vedono tutti. */
  redraw(board: Board, visible: (m: Marker) => boolean = () => true) {
    for (const child of this.container.removeChildren()) child.destroy({ children: true });
    for (const m of board.markers) if (m.type === 'encounter' && visible(m)) this.container.addChild(this.token((m.x + 0.5) * CELL_SIZE, (m.y + 0.5) * CELL_SIZE));
  }

  private token(cx: number, cy: number): Graphics {
    const c = theme.color.encounter;
    const g = new Graphics();
    g.position.set(cx, cy);
    const stroke = (width: number, color: number) => {
      g.moveTo(HOOK[0][0], HOOK[0][1]);
      // Il gancio è una curva liscia: i punti guidano un percorso arrotondato.
      g.bezierCurveTo(HOOK[1][0], HOOK[1][1] - 6, HOOK[2][0], HOOK[2][1] - 6, HOOK[3][0], HOOK[3][1]);
      g.bezierCurveTo(HOOK[4][0], HOOK[4][1] + 6, 0, -9, HOOK[6][0], -3);
      g.lineTo(HOOK[6][0], HOOK[6][1]);
      g.stroke({ width, color, cap: 'round', join: 'round' });
    };
    stroke(17, c.edge);
    stroke(14, c.shape);
    stroke(10, c.band);
    stroke(6, c.face);
    // La pietra del punto: un rombo con il bordo chiaro, la sagoma scura e il giallo al centro.
    const diamond = (r: number, color: number) => g.poly([0, GEM.y - r, r, GEM.y, 0, GEM.y + r, -r, GEM.y]).fill(color);
    diamond(GEM.r + 4, c.edge);
    diamond(GEM.r + 3, c.shape);
    diamond(GEM.r, c.gem);
    return g;
  }
}
