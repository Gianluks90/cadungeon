import { Container, Graphics, Sprite, Text, Texture, Ticker } from 'pixi.js';
import { Board, Cell, cellKey } from '../board/board';
import { Reach, pathTo } from '../board/movement';
import { PERIMETER_WALLS_OUTSIDE, REACH_EDGE_INSET_PX, REACH_LINE_WIDTH_PX, REACH_PULSE_MIN, REACH_PULSE_PERIOD_MS, REACH_WALL_INSET_PX, WALL_WIDTH_PX } from '../constants';
import { CELL_SIZE, PAWN_RADIUS_RATIO } from '../constants';
import { createFilledIcon } from '../icons/icon-loader';
import { reachOutline } from '../pieces/reach-outline';
import type { GameState } from '../state/game-state';
import { LINE, theme } from '../theme';
import type { Familiar } from './familiar';

/** Con chi condivide la casella un famiglio: nessuno (è un segnalino tondo come un eroe) o un eroe/mostro (diventa un piccolo segnalino nell'angolo, sopra la pedina). */
export type Cohabitant = 'hero' | 'monster' | null;

interface FamiliarNode {
  root: Container;
  base: Graphics;
  ring: Graphics;
  sprite?: Sprite;
  mask?: Graphics;
  /** Senza immagine: la zampa (icona `pets`) al centro, e il raggio per cui è stata disegnata. */
  icon?: Container;
  iconRadius?: number;
  /** Il posto che ha adesso nella casella (frazioni di casella). */
  slot?: Slot;
}

/** Dove sta un famiglio nella casella, in frazioni di casella: il centro e il raggio. */
interface Slot {
  x: number;
  y: number;
  r: number;
}

/** I segnalini piccoli quando c'è un'altra pedina nella casella: il loro raggio e quanto stanno dal bordo sinistro. */
const BADGE_RADIUS = 0.15;
const BADGE_INSET = 0.2;

/**
 * Dove mettere `count` famigli in una casella (nessun limite). **Da soli**: 1 grande come un eroe; 2 a raggio ridotto, affiancati; 3 a triangolo; 4 in una griglia 2×2; da 5 in su la griglia
 * ha 3 famigli e un cerchietto "+N" al posto del quarto. **Con un'altra pedina**: una colonna di badge a sinistra (1: in alto; 2: in alto e in basso; 3 o più: dall'alto al basso, un po'
 * sovrapposti, della stessa dimensione). `more` è quanti famigli non si vedono e stanno nel "+N" (e dove).
 */
export function familiarSlots(count: number, occupied: boolean): { slots: Slot[]; more: { n: number; slot: Slot } | null } {
  const R = BADGE_RADIUS;
  if (occupied) {
    if (count === 1) return { slots: [{ x: BADGE_INSET, y: BADGE_INSET, r: R }], more: null };
    if (count === 2) return { slots: [{ x: BADGE_INSET, y: BADGE_INSET, r: R }, { x: BADGE_INSET, y: 1 - BADGE_INSET, r: R }], more: null };
    const step = Math.min(0.26, 0.66 / (count - 1)); // più stretti del diametro (0,30): si sovrappongono un po'
    return { slots: Array.from({ length: count }, (_, i) => ({ x: BADGE_INSET, y: 0.5 + (i - (count - 1) / 2) * step, r: R })), more: null };
  }
  if (count === 1) return { slots: [{ x: 0.5, y: 0.5, r: PAWN_RADIUS_RATIO }], more: null };
  if (count === 2) return { slots: [{ x: 0.29, y: 0.5, r: 0.17 }, { x: 0.71, y: 0.5, r: 0.17 }], more: null };
  if (count === 3) return { slots: [{ x: 0.3, y: 0.3, r: R }, { x: 0.7, y: 0.3, r: R }, { x: 0.5, y: 0.72, r: R }], more: null };
  const grid: Slot[] = [{ x: 0.3, y: 0.3, r: R }, { x: 0.7, y: 0.3, r: R }, { x: 0.3, y: 0.7, r: R }, { x: 0.7, y: 0.7, r: R }];
  if (count === 4) return { slots: grid, more: null };
  return { slots: grid.slice(0, 3), more: { n: count - 3, slot: grid[3] } };
}

/**
 * La grafica dei famigli (`GameState.familiars`), sopra le pedine: massimo 2 per casella. Da soli sono un segnalino tondo come un eroe; in due, metà dimensione e affiancati; in una casella occupata
 * da un'altra pedina, due piccoli badge (in alto e in basso a sinistra). Conta solo se la casella è occupata, non quanto è grande la pedina. Il contorno è azzurro (`color.familiar`).
 * Mostra anche le caselle dove si può spostare un famiglio.
 */
export class FamiliarsView {
  readonly container = new Container();
  private readonly reachLayer = new Graphics();
  private readonly pathLayer = new Graphics();
  private reach: Map<string, Reach> | null = null;
  private pulsing = false;
  private pulseTime = 0;
  private readonly nodes = new Map<string, FamiliarNode>();
  /** I cerchietti "+N" attuali (si rifanno a ogni `sync`). */
  private readonly counters: Container[] = [];
  /** I famigli "portati" (oggetti trasportati con una scheda famiglio, come Zanna): id → eroe che li porta. */
  private readonly carriedBy = new Map<string, string>();
  private get carriedIds(): Iterable<string> {
    return this.carriedBy.keys();
  }
  /** Chi sta camminando adesso (id) e dov'è, in pixel: finché dura la camminata la posizione la decide l'animazione. */
  private readonly walking = new Map<string, { x: number; y: number }>();

  constructor(
    private readonly ticker: Ticker,
    private readonly state: GameState,
    private readonly textures: ReadonlyMap<string, Texture>,
    /** Chi occupa la casella (visibile): un eroe, un mostro che si vede, o niente. */
    private readonly cohabitant: (cell: Cell) => Cohabitant,
    /** Dove sta la pedina di un eroe in questo momento (in pixel del mondo): i famigli portati la seguono. */
    private readonly heroPos: (heroId: string) => { x: number; y: number } | null = () => null,
  ) {
    this.container.addChild(this.pathLayer, this.reachLayer);
    // Il contorno "respira" piano, come quello degli eroi.
    this.ticker.add((t) => {
      // I famigli portati (Zanna) seguono la pedina di chi li porta, anche mentre cammina.
      for (const id of this.carriedIds) {
        const n = this.nodes.get(id);
        const owner = this.carriedBy.get(id);
        const at = owner ? this.heroPos(owner) : null;
        if (n?.slot && at) n.root.position.set(at.x + (n.slot.x - 0.5) * CELL_SIZE, at.y + (n.slot.y - 0.5) * CELL_SIZE);
      }
      if (!this.pulsing) return;
      this.pulseTime = (this.pulseTime + t.deltaMS) % REACH_PULSE_PERIOD_MS;
      const wave = (1 - Math.cos((this.pulseTime / REACH_PULSE_PERIOD_MS) * Math.PI * 2)) / 2;
      this.reachLayer.alpha = REACH_PULSE_MIN + (1 - REACH_PULSE_MIN) * wave;
    });
  }

  /** Allinea la grafica allo stato: crea i segnalini nuovi, toglie quelli spariti, ridisegna posizione e forma. */
  sync() {
    // I famigli portati: un oggetto trasportato di un eroe che ha una scheda famiglio (`FamiliarDef.item`). Compaiono sempre per primi nella casella del portatore.
    this.carriedBy.clear();
    const carried: Familiar[] = [];
    for (const def of this.state.familiarDefs.values()) {
      if (!def.item) continue;
      const hero = this.state.pieces.find((p) => p.team === 'hero' && !p.city && p.wounds > 0 && p.equipped.includes(def.item!));
      if (!hero) continue;
      carried.push({ id: def.id, owner: hero.id, cell: hero.cell });
      this.carriedBy.set(def.id, hero.id);
    }
    const all = [...carried, ...this.state.familiars];
    const live = new Set(all.map((f) => f.id));
    for (const [id, n] of this.nodes) {
      if (live.has(id)) continue;
      n.root.destroy({ children: true });
      this.nodes.delete(id);
    }
    // I famigli di ogni casella, nell'ordine dello stato: la loro disposizione dipende da quanti sono e da chi altro c'è.
    const groups = new Map<string, Familiar[]>();
    for (const f of all) {
      const key = cellKey(f.cell);
      groups.set(key, [...(groups.get(key) ?? []), f]);
    }
    for (const c of this.counters) c.destroy({ children: true });
    this.counters.length = 0;
    for (const group of groups.values()) {
      const cell = group[0].cell;
      const { slots, more } = familiarSlots(group.length, !!this.cohabitant(cell));
      group.forEach((f, i) => {
        const node = this.nodes.get(f.id) ?? this.create(f);
        node.root.visible = i < slots.length;
        if (i < slots.length) this.draw(f, node, slots[i]);
      });
      if (more) this.addCounter(cell, more.slot, more.n);
    }
  }

  /** Il cerchietto "+N" dei famigli che non hanno posto nella casella. */
  private addCounter(cell: Cell, slot: Slot, n: number) {
    const root = new Container();
    const g = new Graphics().circle(0, 0, slot.r * CELL_SIZE).fill(theme.color.token.fill).stroke({ width: 2, color: theme.color.familiar });
    const label = new Text({ text: `+${n}`, style: { fontFamily: 'sans-serif', fontSize: 11, fontWeight: '700', fill: theme.color.ui.text } });
    label.anchor.set(0.5);
    root.addChild(g, label);
    root.position.set((cell.x + slot.x) * CELL_SIZE, (cell.y + slot.y) * CELL_SIZE);
    this.container.addChild(root);
    this.counters.push(root);
  }

  private create(f: Familiar): FamiliarNode {
    const root = new Container();
    const base = new Graphics();
    const ring = new Graphics();
    root.addChild(base);
    const def = this.state.familiarDefs.get(f.id);
    const texture = def?.image ? this.textures.get(def.image) : undefined;
    let sprite: Sprite | undefined;
    let mask: Graphics | undefined;
    if (texture) {
      sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      mask = new Graphics();
      sprite.mask = mask;
      root.addChild(sprite, mask);
    }
    root.addChild(ring);
    this.container.addChild(root);
    const node = { root, base, ring, sprite, mask };
    this.nodes.set(f.id, node);
    return node;
  }

  /** Disegna un famiglio nel suo posto (raggio e centro in frazioni di casella). */
  private draw(f: Familiar, n: FamiliarNode, slot: Slot) {
    const radius = slot.r * CELL_SIZE;
    const c = theme.color;
    n.base.clear().circle(0, 0, radius).fill(c.token.fill);
    if (n.sprite && n.mask) {
      const side = Math.min(n.sprite.texture.width, n.sprite.texture.height);
      n.sprite.scale.set((2 * radius) / side);
      n.mask.clear().circle(0, 0, radius - 1).fill(0xffffff);
    } else if (n.iconRadius !== radius) {
      // Senza immagine del segnalino compare la zampa; si rifà solo se cambia la dimensione.
      n.icon?.destroy({ children: true });
      n.icon = createFilledIcon('pets', radius * 1.15, c.ui.text);
      n.root.addChildAt(n.icon, 1);
      n.iconRadius = radius;
    }
    n.ring.clear().circle(0, 0, radius).stroke({ width: LINE.thin, color: c.familiar, join: 'round' }); // un solo spessore, più sottile di quello degli eroi
    n.slot = slot;
    if (this.walking.has(f.id)) return;
    n.root.position.set((f.cell.x + slot.x) * CELL_SIZE, (f.cell.y + slot.y) * CELL_SIZE);
  }

  /**
   * Evidenzia dove si può spostare un famiglio, come per gli eroi: solo il contorno dell'area (azzurro, che pulsa piano), con la casella di partenza dentro così la linea non si spezza.
   * Passando il mouse su una casella (`hover`) si colorano le caselle del percorso.
   */
  showReach(reach: Map<string, Reach>, start: Cell, board: Board) {
    this.reach = reach;
    const area = new Set<string>([cellKey(start), ...reach.keys()]);
    const loops = reachOutline(area, (cell, side) => (board.isWallSide(cell, side) ? (PERIMETER_WALLS_OUTSIDE && board.isVoidSide(cell, side) ? REACH_WALL_INSET_PX - WALL_WIDTH_PX / 2 : REACH_WALL_INSET_PX) : REACH_EDGE_INSET_PX));
    const g = this.reachLayer.clear();
    for (const loop of loops) g.poly(loop.flat(), true);
    g.stroke({ width: REACH_LINE_WIDTH_PX, color: theme.color.familiar, alpha: theme.alpha.reach, join: 'miter' });
    this.pulsing = true;
  }

  clearReach() {
    this.reach = null;
    this.pulsing = false;
    this.reachLayer.clear();
    this.pathLayer.clear();
  }

  /** Dov'è, in pixel del mondo, il famiglio che sta camminando (null se nessuno): la camera lo segue come con un eroe. */
  movingWorldPos(): { x: number; y: number } | null {
    const first = this.walking.values().next();
    return first.done ? null : first.value;
  }

  /** Il puntatore è su questa casella (o fuori dalla mappa): se è raggiungibile ne mostra il percorso. */
  hover(cell: Cell | null) {
    this.pathLayer.clear();
    const reach = this.reach;
    if (!reach || !cell || !reach.has(cellKey(cell))) return;
    for (const step of pathTo(reach, cell)) this.pathLayer.rect(step.cell.x * CELL_SIZE, step.cell.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    this.pathLayer.fill({ color: theme.color.familiar, alpha: theme.alpha.pathCell });
  }

  /** Fa camminare un famiglio lungo il percorso (una casella ogni 110 ms), poi lo ridisegna nella casella di arrivo (già nello stato). */
  walk(f: Familiar, from: Cell, path: readonly Cell[]): Promise<void> {
    const node = this.nodes.get(f.id);
    if (!node || !path.length) {
      this.sync();
      return Promise.resolve();
    }
    const points = [from, ...path].map((c) => ({ x: (c.x + 0.5) * CELL_SIZE, y: (c.y + 0.5) * CELL_SIZE }));
    const STEP_MS = 110;
    return new Promise((resolve) => {
      let t = 0;
      const tick = (tk: Ticker) => {
        t += tk.deltaMS;
        const k = Math.min(points.length - 1, t / STEP_MS);
        const i = Math.min(points.length - 2, Math.floor(k));
        const a = points[i];
        const b = points[i + 1];
        const u = k - i;
        this.walking.set(f.id, { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
        node.root.position.set(this.walking.get(f.id)!.x, this.walking.get(f.id)!.y);
        if (k >= points.length - 1) {
          this.ticker.remove(tick);
          this.walking.delete(f.id);
          this.sync();
          resolve();
        }
      };
      this.ticker.add(tick);
    });
  }
}
