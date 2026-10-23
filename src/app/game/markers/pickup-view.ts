import { Container, Graphics } from 'pixi.js';
import {
  CELL_SIZE,
  COIN_PILE_SIZE_RATIO,
  COIN_RADIUS_PX,
  COIN_STACK_COUNT,
  COIN_STACK_OFFSET_PX,
  GLYPH_CIRCLE_SEGMENTS,
  ICONS,
  KEY_PICKUP_SIZE_PX,
  POTION_HEIGHT_RATIO,
  RUNE_PICKUP_SIZE_PX,
} from '../constants';
import { LINE, theme } from '../theme';
import { Board } from '../board/board';
import { Coins, Key, Marker, Potion, RuneKey } from '../board/marker';
import { createIcon, createTwoToneIcon, hasIcon } from '../icons/icon-loader';

type PickupMarker = Potion | Coins | RuneKey | Key;

/**
 * Disegna gli oggetti a terra, visti dall'alto e a linee sottili come il resto: la pozione è la boccetta di `public/tokens/potion.svg`
 * (vetro grigio, liquido lilla se curativa e arancione se di vitalità), il denaro una piccola pila di monete, la chiave runica l'icona della runa
 * nel colore della chiave. Sono statici; quando un eroe li raccoglie spariscono (`collected`) e si ridisegna.
 */
export class PickupView {
  readonly container = new Container();
  private readonly records = new Map<PickupMarker, Container>();

  /** `visible` dice quali oggetti mostrare (quelli rivelati); senza, si vedono tutti. */
  redraw(board: Board, visible: (m: Marker) => boolean = () => true) {
    const shown = new Set(
      board.markers.filter((m): m is PickupMarker => (m.type === 'potion' || m.type === 'coins' || m.type === 'rune' || m.type === 'key') && !m.collected && visible(m)),
    );
    for (const [marker, root] of this.records) {
      if (shown.has(marker)) continue;
      root.destroy({ children: true });
      this.records.delete(marker);
    }
    for (const marker of shown) {
      this.records.get(marker)?.destroy({ children: true }); // si ridisegna ogni volta (anche al cambio di tema)
      const root = new Container();
      root.position.set((marker.x + 0.5) * CELL_SIZE, (marker.y + 0.5) * CELL_SIZE);
      root.addChild(this.draw(marker));
      this.records.set(marker, root);
      this.container.addChild(root);
    }
  }

  private draw(m: PickupMarker): Container {
    if (m.type === 'key') return createIcon(ICONS.keyPickup, KEY_PICKUP_SIZE_PX, theme.color.doorKey);
    if (m.type === 'rune') return createIcon(ICONS.runeKey, RUNE_PICKUP_SIZE_PX, theme.color.rune[m.color]);
    if (m.type === 'potion') {
      // Il vetro è grigio; solo il liquido ha il colore della pozione.
      const p = theme.color.potion;
      return createTwoToneIcon(ICONS.potion, CELL_SIZE * POTION_HEIGHT_RATIO, p.glass, m.kind === 'heal' ? p.heal : p.vital);
    }
    if (hasIcon(ICONS.coins)) {
      return createIcon(ICONS.coins, CELL_SIZE * COIN_PILE_SIZE_RATIO, theme.color.coin);
    }
    const g = new Graphics(); // senza il file SVG: tre monete disegnate a mano
    this.coins(g);
    return g;
  }

  /** Un cerchio come poligono a molti lati: le linee sottili (pixelLine) non funzionano sui cerchi veri. */
  private circle(g: Graphics, cx: number, cy: number, r: number) {
    const pts: number[] = [];
    for (let i = 0; i < GLYPH_CIRCLE_SEGMENTS; i++) {
      const a = (i / GLYPH_CIRCLE_SEGMENTS) * Math.PI * 2;
      pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.poly(pts, true);
  }

  /** Una pila di monete viste dall'alto, sfalsate: ognuna con un cerchio interno. */
  private coins(g: Graphics) {
    const color = theme.color.coin;
    const line = { width: LINE.hairline, color, pixelLine: true } as const;
    const mid = (COIN_STACK_COUNT - 1) / 2;
    for (let i = 0; i < COIN_STACK_COUNT; i++) {
      const cx = (i - mid) * COIN_STACK_OFFSET_PX;
      const cy = -(i - mid) * COIN_STACK_OFFSET_PX * 0.6;
      this.circle(g, cx, cy, COIN_RADIUS_PX);
      g.fill(theme.color.floor).stroke(line); // chi sta sotto si copre
      this.circle(g, cx, cy, COIN_RADIUS_PX * 0.62);
      g.stroke({ ...line, alpha: 0.5 });
    }
  }
}
