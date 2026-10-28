import { Container, Graphics } from 'pixi.js';
import { CELL_SIZE, PAWN_RADIUS_RATIO } from '../game/constants';
import { createFilledIcon } from '../game/icons/icon-loader';
import { LINE, theme } from '../game/theme';

/** Un elemento che il motore non riconosce: che categoria era (cioè quale strumento lo toglie), dove sta e quanto occupa. */
export interface MissingItem {
  kind: 'monster' | 'object';
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Le icone delle categorie: le stesse dei tasti degli strumenti (Nemici e Oggetti). */
export const MISSING_ICONS = ['skull', 'inventory_2', 'warning'] as const;
const CATEGORY_ICON = { monster: 'skull', object: 'inventory_2' } as const;

/**
 * Disegna gli elementi non riconosciuti (un nemico o un oggetto di un contenuto che qui non c'è): un token arancione con l'icona della sua categoria, la stessa dello strumento
 * che lo toglie, e un badge di avviso. Si sostituiscono mettendoci sopra un elemento della stessa categoria.
 */
export class MissingView {
  readonly container = new Container();

  setItems(list: readonly MissingItem[]) {
    for (const child of this.container.removeChildren()) child.destroy({ children: true });
    for (const m of list) this.container.addChild(this.token(m));
  }

  private token(m: MissingItem): Container {
    const margin = CELL_SIZE * (0.5 - PAWN_RADIUS_RATIO);
    const a = (m.w * CELL_SIZE) / 2 - margin;
    const b = (m.h * CELL_SIZE) / 2 - margin;
    const shape = (g: Graphics, ra: number, rb: number) => g.roundRect(-ra, -rb, 2 * ra, 2 * rb, Math.min(ra, rb));
    const root = new Container();
    root.addChild(shape(new Graphics(), a, b).fill(theme.color.token.fill));
    root.addChild(shape(new Graphics(), a, b).stroke({ width: LINE.medium, color: theme.color.missing }));
    root.addChild(createFilledIcon(CATEGORY_ICON[m.kind], Math.min(a, b) * 1.1, theme.color.missing));
    // Il badge di avviso a cavallo del bordo, in alto a destra come quello dei nemici personalizzati.
    const r = 15;
    const k = Math.min(a, b);
    const badge = new Container();
    badge.position.set(a - k + k * Math.SQRT1_2, -b + k - k * Math.SQRT1_2);
    badge.addChild(new Graphics().circle(0, 0, r).fill(theme.color.missing).stroke({ width: 1.5, color: theme.color.token.fill }), createFilledIcon('warning', r * 1.4, theme.color.token.fill));
    root.addChild(badge);
    root.position.set((m.x + m.w / 2) * CELL_SIZE, (m.y + m.h / 2) * CELL_SIZE);
    return root;
  }
}
