import { ColorMatrixFilter, Container, Graphics, Sprite, Texture } from 'pixi.js';
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
  /** Il nemico ha modifiche (unico, valori diversi, abilità, bottino o inattivo): compare il badge genetics. */
  custom?: boolean;
  /** Ha l'aspetto di pietra (personalizzazione visiva): immagine e bordo senza colore, e il badge palette in basso a sinistra. */
  stone?: boolean;
  /** Un evento riguarda questo nemico: compare il badge del fulmine in alto a destra, e il genetics si sposta accanto. */
  events?: boolean;
}

/** Il vuoto, in pixel, fra due badge affiancati. */
const BADGE_GAP_PX = 4;

/**
 * Disegna i mostri nell'editor come in partita: una pedina con l'immagine del mostro ritagliata nella forma (cerchio per 1×1 e 2×2 più grande, capsula per 1×2 e 2×3) e l'anello,
 * grigio per i normali e rosso per i potenziati. Le immagini (`<image>-token.webp`) arrivano già caricate.
 */
export class MonsterView {
  readonly container = new Container();
  private readonly preview = new Container();
  /** Il filtro dell'aspetto di pietra: toglie il colore all'immagine (lo stesso della partita). */
  private readonly stoneFilter = (() => {
    const f = new ColorMatrixFilter();
    f.desaturate();
    return f;
  })();

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
      if (m.stone) sprite.filters = [this.stoneFilter];
      root.addChild(sprite, mask);
    } else shape(base, a * 0.62, b * 0.62).fill(theme.color.token.portrait);
    root.addChild(shape(new Graphics(), a, b).stroke({ width: LINE.medium, color: m.enhanced && !m.stone ? theme.color.danger : theme.color.token.idle }));
    // I badge stanno a cavallo del bordo della pedina, a 45° (sull'arco dell'angolo arrotondato della sua forma): in alto a destra le cose importanti, in basso a sinistra la grafica.
    const r = 15; // 30 px di diametro: in fase di costruzione devono vedersi bene
    const arc = Math.min(a, b);
    const right = a - arc + arc * Math.SQRT1_2;
    const top = -b + arc - arc * Math.SQRT1_2;
    const badge = (icon: string, x: number, y: number) => {
      const c = new Container();
      c.position.set(x, y);
      c.addChild(new Graphics().circle(0, 0, r).fill(theme.color.accentDev).stroke({ width: 1.5, color: theme.color.token.fill }), createIcon(icon, r * 1.4, theme.color.token.fill));
      root.addChild(c);
    };
    // Un evento sul nemico prende il posto in alto a destra; il genetics (nemico personalizzato) si affianca con un po' di vuoto, o sta lì da solo se non c'è un evento.
    if (m.events) badge('bolt', right, top);
    if (m.custom) badge('genetics', m.events ? right - 2 * r - BADGE_GAP_PX : right, top);
    if (m.stone) badge('palette', -right, -top); // personalizzazione visiva: in basso a sinistra
    root.position.set((m.x + m.w / 2) * CELL_SIZE, (m.y + m.h / 2) * CELL_SIZE);
    return root;
  }
}
