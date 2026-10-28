import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { CELL_SIZE, PAWN_PORTRAIT_INSET_PX, PAWN_RADIUS_RATIO } from '../game/constants';
import type { MonsterDef } from '../game/monsters/monster';
import { createIcon } from '../game/icons/icon-loader';
import { fitPortrait } from '../game/pieces/portraits';
import { LINE, theme } from '../game/theme';

/** Un mostro in mappa (o in anteprima): quale, dove (casella in alto a sinistra), quanto occupa e se è potenziato. */
export interface PlacedMonster {
  def: MonsterDef;
  x: number;
  y: number;
  w: number;
  h: number;
  enhanced: boolean;
  /** Il nemico ha modifiche (unico, valori diversi, abilità o bottino): compare un segno. */
  custom?: boolean;
}

/**
 * Disegna i mostri nell'editor come in partita: una pedina con l'immagine del mostro ritagliata nella forma (cerchio per 1×1 e 2×2 più grande, capsula per 1×2 e 2×3) e l'anello,
 * grigio per i normali e rosso per i potenziati. Le immagini (`<image>-token.webp`) arrivano già caricate.
 */
export class MonsterView {
  readonly container = new Container();
  private readonly preview = new Container();

  constructor(private textures: ReadonlyMap<string, Texture>) {}

  /** L'url dell'immagine della pedina. */
  static tokenUrl(def: MonsterDef): string {
    return `${def.image}-token.webp`;
  }

  /** Ridisegna i mostri piazzati (l'anteprima sta in un livello a parte, sopra). */
  setMonsters(list: readonly PlacedMonster[]) {
    for (const child of this.container.removeChildren()) child.destroy({ children: true });
    for (const m of list) this.container.addChild(this.token(m));
    this.container.addChild(this.preview);
  }

  /** L'anteprima del mostro in mano: tenue, e rossastra se lì non si può metterlo. */
  setPreview(m: PlacedMonster | null, valid = true) {
    for (const child of this.preview.removeChildren()) child.destroy({ children: true });
    if (!m) return;
    const t = this.token(m);
    t.alpha = valid ? theme.alpha.previewValid : theme.alpha.previewInvalid;
    if (!valid) t.tint = theme.color.invalid;
    this.preview.addChild(t);
  }

  private token(m: PlacedMonster): Container {
    const margin = CELL_SIZE * (0.5 - PAWN_RADIUS_RATIO);
    const a = (m.w * CELL_SIZE) / 2 - margin;
    const b = (m.h * CELL_SIZE) / 2 - margin;
    const shape = (g: Graphics, ra: number, rb: number) => g.roundRect(-ra, -rb, 2 * ra, 2 * rb, Math.min(ra, rb));
    const root = new Container();
    const base = shape(new Graphics(), a, b).fill(theme.color.token.fill);
    root.addChild(base);
    const tex = this.textures.get(MonsterView.tokenUrl(m.def));
    if (tex) {
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      const fit = fitPortrait(tex.width, tex.height, a, b); // girata come in partita se la pedina è orizzontale
      sprite.rotation = fit.rotation;
      sprite.scale.set(fit.scale);
      const mask = shape(new Graphics(), a - PAWN_PORTRAIT_INSET_PX, b - PAWN_PORTRAIT_INSET_PX).fill(0xffffff);
      sprite.mask = mask;
      root.addChild(sprite, mask);
    } else shape(base, a * 0.62, b * 0.62).fill(theme.color.token.portrait);
    root.addChild(shape(new Graphics(), a, b).stroke({ width: LINE.medium, color: m.enhanced ? theme.color.danger : theme.color.token.idle }));
    if (m.custom) {
      // Un badge con l'icona della genetica in alto a destra: questo nemico è speciale (personalizzato).
      const r = 15; // 30 px di diametro: in fase di costruzione deve vedersi bene
      const badge = new Container();
      // Sta a cavallo del bordo della pedina, a 45° in alto a destra (sull'arco dell'angolo arrotondato della sua forma).
      const m = Math.min(a, b);
      badge.position.set(a - m + m * Math.SQRT1_2, -b + m - m * Math.SQRT1_2);
      badge.addChild(new Graphics().circle(0, 0, r).fill(theme.color.accentDev).stroke({ width: 1.5, color: theme.color.token.fill }), createIcon('genetics', r * 1.4, theme.color.token.fill));
      root.addChild(badge);
    }
    root.position.set((m.x + m.w / 2) * CELL_SIZE, (m.y + m.h / 2) * CELL_SIZE);
    return root;
  }
}
