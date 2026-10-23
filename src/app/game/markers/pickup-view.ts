import { Container, Graphics } from 'pixi.js';
import {
  CELL_SIZE,
  COIN_CIRCLE_SEGMENTS,
  COIN_PILE_RADIUS_PX,
  COIN_RADIUS_MAX_PX,
  COIN_RADIUS_MIN_PX,
  COIN_SCATTERED_SHARE,
  COIN_SCATTER_MARGIN_PX,
  COINS_PER_TOKEN,
  GLYPH_CIRCLE_SEGMENTS,
  ICONS,
  KEY_PICKUP_SIZE_PX,
  POTION_HEIGHT_RATIO,
  RUNE_PICKUP_SIZE_PX,
} from '../constants';
import { LINE, theme } from '../theme';
import { Board } from '../board/board';
import { Coins, Key, Marker, Potion, RuneKey } from '../board/marker';
import { createIcon, createTwoToneIcon } from '../icons/icon-loader';
import { mixSeed, mulberry32 } from '../map/rng';

type PickupMarker = Potion | Coins | RuneKey | Key;

/**
 * Disegna gli oggetti a terra, visti dall'alto e a linee sottili come il resto: la pozione è la boccetta di `public/tokens/potion.svg`
 * (vetro grigio, liquido lilla se curativa e arancione se di vitalità), il denaro un mucchio di monete (elemento ambientale disegnato da codice), la chiave runica l'icona della runa
 * nel colore della chiave. Sono statici; quando un eroe li raccoglie spariscono (`collected`) e si ridisegna.
 */
export class PickupView {
  readonly container = new Container();
  private readonly records = new Map<PickupMarker, Container>();

  /** `seed` è il seme della mappa: le monete sparse intorno a un mucchio sono sempre le stesse su ogni client. */
  constructor(private readonly seed: number) {}

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
    const g = new Graphics();
    this.coinPile(g, m);
    return g;
  }

  /** Un cerchio come poligono a molti lati: le linee sottili (pixelLine) non funzionano sui cerchi veri. */
  private circle(g: Graphics, cx: number, cy: number, r: number, segments = GLYPH_CIRCLE_SEGMENTS) {
    const pts: number[] = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.poly(pts, true);
  }

  /**
   * Il mucchio di monete: tante monete piccole viste dall'alto, una per ogni moneta che vale il segnalino, con il riempimento d'oro pieno e un contorno
   * sottile più scuro (chi sta sotto si copre). La maggior parte forma un mucchio dal contorno irregolare, più fitto al centro, dove le
   * monete stanno sopra le altre; le altre sono sparse intorno, sempre più rade, dentro la cella. Le monete stanno sempre lontane dal bordo
   * della cella, per non finire dentro un muro. Tutto dal seme della mappa (uguale su ogni client).
   */
  private coinPile(g: Graphics, m: Coins) {
    const rng = mulberry32(mixSeed(this.seed, m.x, m.y));
    const half = CELL_SIZE / 2;
    const R = COIN_PILE_RADIUS_PX;
    // Il contorno del mucchio: un cerchio deformato da due onde casuali, così non è mai tondo.
    const [k1, p1, k2, p2] = [0.04 + rng() * 0.12, rng() * Math.PI * 2, 0.03 + rng() * 0.08, rng() * Math.PI * 2];
    const reach = (a: number) => R * (1 + k1 * Math.cos(a - p1) + k2 * Math.cos(2 * a - p2));

    const coins: { x: number; y: number; r: number; height: number }[] = [];
    const scattered = Math.round(COINS_PER_TOKEN * COIN_SCATTERED_SHARE);
    const radius = () => COIN_RADIUS_MIN_PX + rng() * (COIN_RADIUS_MAX_PX - COIN_RADIUS_MIN_PX);
    for (let i = 0; i < COINS_PER_TOKEN - scattered; i++) {
      const a = rng() * Math.PI * 2;
      const d = reach(a) * Math.pow(rng(), 0.7); // più fitto verso il centro
      const r = radius();
      coins.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r, height: 1 - d / reach(a) + (rng() - 0.5) * 0.3 });
    }
    let placedOutside = 0;
    for (let i = 0; i < scattered; i++) {
      for (let tries = 0; tries < 12; tries++) {
        const a = rng() * Math.PI * 2;
        const d = reach(a) + 2 - Math.log(1 - rng()) * 6; // sempre più rade man mano che ci si allontana
        const r = radius();
        const x = Math.cos(a) * d;
        const y = Math.sin(a) * d;
        const room = half - COIN_SCATTER_MARGIN_PX - r;
        if (Math.abs(x) > room || Math.abs(y) > room) continue; // resta dentro la cella
        coins.push({ x, y, r, height: -0.5 + (rng() - 0.5) * 0.2 });
        placedOutside++;
        break;
      }
    }
    // Quelle che non hanno trovato posto fuori (la cella è piccola, i muri sono vicini) si uniscono al mucchio: in tutto sono sempre 100.
    for (let i = placedOutside; i < scattered; i++) {
      const a = rng() * Math.PI * 2;
      const d = reach(a) * Math.pow(rng(), 0.7);
      coins.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: radius(), height: 1 - d / reach(a) + (rng() - 0.5) * 0.3 });
    }

    // Prima le monete più in basso, poi quelle sopra.
    coins.sort((a, b) => a.height - b.height);
    for (const c of coins) {
      this.circle(g, c.x, c.y, c.r, COIN_CIRCLE_SEGMENTS);
      g.fill(theme.color.coin).stroke({ width: LINE.hairline, color: theme.color.coinEdge, pixelLine: true });
    }
  }
}
