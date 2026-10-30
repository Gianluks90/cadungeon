import { Container, Graphics, Sprite } from 'pixi.js';
import {
  CELL_SIZE,
  COIN_CIRCLE_SEGMENTS,
  COIN_PILE_RADIUS_PX,
  COIN_RADIUS_MAX_PX,
  COIN_RADIUS_MIN_PX,
  COIN_SCATTERED_SHARE,
  COIN_SCATTER_MARGIN_PX,
  COINS_PER_TOKEN,
  ENCOUNTER,
  GLYPH_CIRCLE_SEGMENTS,
  GLYPH_DOUBLE_GAP_PX,
  ICONS,
  ITEM_PICKUP_SIZE_PX,
  KEY_PICKUP_SIZE_PX,
  POTION_HEIGHT_RATIO,
  RUNE_PICKUP_SIZE_PX,
} from '../constants';
import { LINE, theme } from '../theme';
import { Board } from '../board/board';
import { Coins, Encounter, ItemPickup, Key, Marker, Potion, RuneKey, TokenLook } from '../board/marker';
import { tokenTexture } from './token-looks';
import { createFilledIcon, createIcon, createTwoToneIcon } from '../icons/icon-loader';
import { mixSeed, mulberry32 } from '../map/rng';

type PickupMarker = Potion | Coins | RuneKey | Key | ItemPickup | Encounter;

/**
 * Disegna gli oggetti a terra, visti dall'alto e a linee sottili come il resto: la pozione è la boccetta di `public/tokens/potion.svg`
 * (vetro grigio, liquido rosso se curativa e verde se del vigore), il denaro un mucchio di monete (elemento ambientale disegnato da codice), la chiave runica l'icona della runa
 * nel colore della chiave. Sono statici; quando un eroe li raccoglie spariscono (`collected`) e si ridisegna.
 */
export class PickupView {
  readonly container = new Container();
  private readonly records = new Map<PickupMarker, Container>();
  /** L'icona di un oggetto del catalogo (per quelli a terra); la imposta chi crea la vista. Senza, un'icona generica. */
  iconOf: (itemId: string) => string | undefined = () => undefined;
  /** Solo nell'editor: quali segnalini Incontro non hanno nessun evento (portano il badge rosso del fulmine). In partita non c'è. */
  unlinked: (m: Marker) => boolean = () => false;
  /** Solo nell'editor: quali segnalini hanno un aspetto personalizzato (portano il badge palette in basso a sinistra). In partita non c'è. */
  customized: (m: Marker) => boolean = () => false;

  /** `seed` è il seme della mappa: le monete sparse intorno a un mucchio sono sempre le stesse su ogni client. */
  constructor(private readonly seed: number) {}

  /** `visible` dice quali oggetti mostrare (quelli rivelati); senza, si vedono tutti. */
  redraw(board: Board, visible: (m: Marker) => boolean = () => true) {
    const shown = new Set(
      board.markers.filter((m): m is PickupMarker => (m.type === 'potion' || m.type === 'coins' || m.type === 'rune' || m.type === 'key' || m.type === 'item' || m.type === 'encounter') && !m.collected && visible(m)),
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
    if (m.type === 'encounter') return this.encounter(m);
    if (m.type === 'item') return m.look && (m.look.image || m.look.icon) ? this.token(m, m.look, theme.color.ui.text) : createFilledIcon(this.iconOf(m.itemId) ?? 'inventory_2', ITEM_PICKUP_SIZE_PX, theme.color.ui.text); // riempita dal browser: la palette ha contorni dentro i buchi
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

  /** Il segnalino Incontro: un cerchio a doppio bordo con un "?" dentro (e, nell'editor, il badge rosso del fulmine se nessun evento lo usa). */
  private encounter(m: Encounter): Container {
    const root = new Container();
    const r = CELL_SIZE * ENCOUNTER.radius;
    const g = new Graphics();
    this.circle(g, 0, 0, r);
    this.circle(g, 0, 0, r - GLYPH_DOUBLE_GAP_PX);
    g.stroke({ width: LINE.thin, color: theme.color.accentActive, join: 'round' });
    root.addChild(g, this.lookContent(m.look, r, theme.color.accentActive) ?? createIcon('question_mark', CELL_SIZE * ENCOUNTER.icon, theme.color.accentActive));
    if (this.unlinked(m)) {
      const badge = new Container();
      badge.position.set(CELL_SIZE / 2 - ENCOUNTER.badgeInset, -CELL_SIZE / 2 + ENCOUNTER.badgeInset);
      badge.addChild(new Graphics().circle(0, 0, ENCOUNTER.badgeRadius).fill(theme.color.danger).stroke({ width: 1.5, color: theme.color.token.fill }), createFilledIcon('bolt', ENCOUNTER.badgeRadius * 1.4, theme.color.token.fill));
      root.addChild(badge);
    }
    if (this.customized(m)) root.addChild(this.paletteBadge());
    return root;
  }

  /** Il badge palette (personalizzazione visiva), in basso a sinistra della casella: solo nell'editor. */
  private paletteBadge(): Container {
    const badge = new Container();
    badge.position.set(-CELL_SIZE / 2 + ENCOUNTER.badgeInset, CELL_SIZE / 2 - ENCOUNTER.badgeInset);
    badge.addChild(new Graphics().circle(0, 0, ENCOUNTER.badgeRadius).fill(theme.color.accentDev).stroke({ width: 1.5, color: theme.color.token.fill }), createFilledIcon('palette', ENCOUNTER.badgeRadius * 1.4, theme.color.token.fill));
    return badge;
  }

  /** Il contenuto tondo di un gettone con un aspetto: l'immagine ritagliata a cerchio dentro l'anello, o l'icona. Null se l'aspetto non ha né immagine né icona (o l'immagine non si è caricata e non c'è un'icona). */
  private lookContent(look: TokenLook | undefined, r: number, color: number): Container | null {
    if (look?.image) {
      const tex = tokenTexture(look.image);
      if (tex) {
        const inner = r - GLYPH_DOUBLE_GAP_PX * 1.5;
        const root = new Container();
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5);
        sprite.scale.set((2 * inner) / Math.min(tex.width, tex.height));
        const mask = new Graphics().circle(0, 0, inner).fill(0xffffff);
        sprite.mask = mask;
        root.addChild(sprite, mask);
        return root;
      }
    }
    if (look?.icon) return createFilledIcon(look.icon, CELL_SIZE * ENCOUNTER.icon * 1.3, color);
    return null;
  }

  /** Un oggetto a terra con un aspetto: un anello tondo (come l'Incontro, ma semplice) con dentro l'immagine o l'icona. */
  private token(m: ItemPickup, look: TokenLook, color: number): Container {
    const root = new Container();
    const r = CELL_SIZE * ENCOUNTER.radius;
    const g = new Graphics();
    this.circle(g, 0, 0, r);
    g.stroke({ width: LINE.thin, color, join: 'round' });
    root.addChild(g);
    const inside = this.lookContent(look, r, color);
    root.addChild(inside ?? createFilledIcon(this.iconOf(m.itemId) ?? 'inventory_2', ITEM_PICKUP_SIZE_PX, color));
    if (this.customized(m)) root.addChild(this.paletteBadge());
    return root;
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
