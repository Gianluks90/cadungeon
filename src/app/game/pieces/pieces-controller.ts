import { Container, Graphics, Sprite, Texture, Ticker } from 'pixi.js';
import {
  CELL_SIZE,
  GLYPH_TRAVEL_MS,
  HERO_DEATH_FADE_MS,
  PAWN_PORTRAIT_INSET_PX,
  PIT_FALL_WOUNDS,
  REVEAL_ANIM_MS,
  REVEAL_SCALE_FROM,
  PAWN_RADIUS_RATIO,
  PAWN_STEP_MS,
  REACH_EDGE_INSET_PX,
  REACH_LINE_WIDTH_PX,
  REACH_PULSE_MIN,
  REACH_PULSE_PERIOD_MS,
  REACH_WALL_INSET_PX,
} from '../constants';
import { LINE, theme } from '../theme';
import { Board, Cell, cellKey } from '../board/board';
import { Reach, pathTo } from '../board/movement';
import { reachOutline } from './reach-outline';
import { Piece } from './piece';
import { Marker, PotionKind } from '../board/marker';
import { GameState } from '../state/game-state';
import * as act from '../state/actions';
import { ChestResult, DoorResult, DrinkResult, GiveResult, ItemResult, StepOutcome } from '../state/actions';
import { CityResult } from '../state/city';

/**
 * Le pedine sul tabellone: mostra dove può andare l'eroe attivo e lo muove casella per casella.
 * Le regole di passaggio: un eroe attraversa gli altri eroi ma non può fermarsi sulla loro casella;
 * i mostri bloccano. Quali passi sono possibili (muri, porte) sta in Board; qui c'è il gioco "a vista".
 */
export class PiecesController {
  private readonly highlight = new Graphics();
  private readonly pathLine = new Graphics();
  /** Ogni pedina è un gruppo: fondo, ritratto (ritagliato a cerchio) e anello sopra tutto. */
  private readonly views = new Map<string, PieceView>();

  private board: Board | null = null;
  private reach = new Map<string, Reach>();
  private enabled = true;
  private pulseTime = 0;
  private hovered: Cell | null = null;
  /** Chiamata dopo ogni passo di un eroe: dice se il movimento deve fermarsi (es. è comparso un mostro). */
  onStepped: ((piece: Piece, outcome: StepOutcome) => boolean) | null = null;
  /** Chiamata quando un eroe muore per un passo (cade in una buca a 1 ferita): la scena avvisa e fa passare il turno. */
  onDied: ((piece: Piece) => void) | null = null;
  /** Eroi che stanno morendo: da 0 a 1. Sfumano e diventano rossi, poi spariscono dalla mappa. */
  private readonly dying = new Map<string, number>();
  /** Quali mostri si vedono: null = tutti (es. chi costruisce la mappa); gli eroi si vedono sempre. */
  private visibleMonsters: ReadonlySet<string> | null = null;
  /** I glifi che gli eroi conoscono (già rivelati): null = tutti (es. chi costruisce la mappa). Si può viaggiare solo verso questi. */
  private knownMarkers: ReadonlySet<Marker> | null = null;
  /** I glifi verso cui l'eroe attivo può viaggiare adesso (l'ultimo calcolo). */
  private teleportTargets = new Set<Marker>();
  /** Mostri che stanno apparendo: da 0 a 1. */
  private readonly appearing = new Map<string, number>();
  private moving: { piece: Piece; steps: Reach[]; index: number; elapsed: number } | null = null;

  constructor(
    layer: Container,
    ticker: Ticker,
    /** Lo stato di gioco: da qui si leggono e si modificano pedine ed eroe attivo. */
    private readonly state: GameState,
    private readonly onChange: (active: Piece | null) => void,
    private readonly onNotice: (text: string, icon?: string) => void,
    /** Le immagini dei ritratti già caricate, per percorso (vedi loadPortraits). */
    private readonly portraits: ReadonlyMap<string, Texture> = new Map(),
  ) {
    layer.addChild(this.highlight, this.pathLine);
    for (const p of this.pieces) {
      const view = this.createView(p);
      this.views.set(p.id, view);
      this.drawPiece(p);
      layer.addChild(view.root);
    }
    this.applyVisibility();
    ticker.add((t) => this.tick(t.deltaMS));
    this.onChange(this.active);
  }

  private get pieces(): Piece[] {
    return this.state.pieces;
  }

  /** L'eroe che si sta muovendo (null se non ce ne sono). */
  get active(): Piece | null {
    return this.pieces.find((p) => p.id === this.state.activeId) ?? null;
  }

  /** La mappa è cambiata (o si ricomincia a giocare): ricalcola dove si può andare. */
  setBoard(board: Board) {
    this.board = board;
    this.refresh();
  }

  /** Spento mentre si piazzano tile o porte: le pedine restano, ma niente caselle evidenziate. */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.refresh();
  }

  /** Correre o Combattere per l'eroe attivo (lo stesso comando due volte torna ad Avanzare). Dice com'è andata. */
  setAction(requested: 'run' | 'fight'): act.ActionChange {
    const active = this.active;
    if (!active || this.moving || !this.enabled) return { ok: false, reason: 'turn' };
    const result = act.setAction(this.state, active, requested);
    if (result.ok) {
      this.onChange(active);
      this.refresh();
    }
    return result;
  }

  /** L'eroe attivo ha finito il turno. Passa all'eroe successivo, oppure (se hanno agito tutti) comincia un nuovo round. */
  passTurn(): act.PassResult | null {
    const active = this.active;
    if (!active || this.moving || !this.enabled) return null;
    const result = act.passTurn(this.state, active);
    if (!result) return null;
    for (const p of this.pieces) this.drawPiece(p); // l'eroe attivo è cambiato
    this.onChange(this.active);
    this.refresh();
    return result;
  }

  /** Il puntatore è sopra questa casella (o fuori dalla mappa, se null): mostra il percorso. */
  hover(cell: Cell | null) {
    this.hovered = cell;
    this.drawPath();
  }

  /** Clic su una casella: su un altro eroe lo seleziona; su una casella raggiungibile ci muove l'eroe attivo. */
  click(cell: Cell) {
    if (!this.enabled || this.moving || !this.board) return;
    const other = this.pieceAt(cell);
    if (other) {
      if (other.team === 'hero' && other.id !== this.state.activeId) this.select(other);
      return;
    }
    const active = this.active;
    const target = this.reach.get(cellKey(cell));
    if (!active || !target || target.cost === 0) return;
    const steps = pathTo(this.reach, cell);
    if (steps.some((s) => s.kind === 'travel')) this.onNotice('Viaggio da glifo a glifo: spendi tutti i punti movimento', 'brightness_empty');
    else if (steps.some((s) => s.kind === 'stairs')) this.onNotice('Scale: {mov:1}', 'stairs');
    this.moving = { piece: active, steps, index: 0, elapsed: 0 };
    this.highlight.clear();
    this.clearPath();
  }

  /**
   * Usa la porta `index` con l'eroe attivo. Le regole stanno in actions.useDoor; qui si applicano e si dice com'è andata,
   * così chi chiama può avvisare.
   */
  useDoor(index: number): DoorResult {
    const active = this.active;
    if (!this.board || !active || this.moving || !this.enabled) return { code: 'busy', cost: 0 };
    const result = act.useDoor(this.state, this.board, active, index);
    if (result.code === 'opened' || result.code === 'closed' || result.code === 'unlocked' || result.code === 'picked') {
      this.onChange(active);
      this.refresh();
    }
    return result;
  }

  /** L'eroe attivo apre lo scrigno su cui sta (vedi actions.openChest). Chi chiama avvisa e ridisegna. */
  useChest(): ChestResult {
    const active = this.active;
    if (!this.board || !active || this.moving || !this.enabled) return { code: 'busy', cost: 0 };
    const result = act.openChest(this.state, this.board, active);
    if (result.code === 'opened') {
      this.onChange(active);
      this.refresh();
    }
    return result;
  }

  /** L'eroe attivo beve una pozione (vedi actions.drinkPotion). */
  drinkPotion(kind: PotionKind): DrinkResult {
    const active = this.active;
    if (!active || this.moving || !this.enabled) return { code: 'busy' };
    const result = act.drinkPotion(this.state, active, kind);
    if (result.code === 'drunk') {
      this.onChange(active);
      this.refresh();
    }
    return result;
  }

  /** L'eroe attivo dà una pozione a un eroe adiacente (vedi actions.givePotion). */
  givePotion(receiverId: string, kind: PotionKind): GiveResult {
    const active = this.active;
    if (!this.board || !active || this.moving || !this.enabled) return { code: 'busy' };
    const result = act.givePotion(this.state, this.board, active, receiverId, kind);
    if (result.code === 'given') {
      this.onChange(active);
      this.refresh();
    }
    return result;
  }

  /** Azioni sull'inventario dell'eroe attivo (vedi actions.equipItem, stowItem, dropItem, giveItem). */
  itemAction(action: 'equip' | 'stow' | 'drop', itemId: string): ItemResult {
    const active = this.active;
    if (!active || this.moving || !this.enabled) return { code: 'busy' };
    const result =
      action === 'equip' ? act.equipItem(this.state, active, itemId) : action === 'stow' ? act.stowItem(this.state, active, itemId) : act.dropItem(this.state, active, itemId);
    if (result.code === 'ok') {
      this.onChange(active);
      this.refresh();
    }
    return result;
  }

  giveItem(receiverId: string, itemId: string): ItemResult {
    const active = this.active;
    if (!this.board || !active || this.moving || !this.enabled) return { code: 'busy' };
    const result = act.giveItem(this.state, this.board, active, receiverId, itemId);
    if (result.code === 'ok') {
      this.onChange(active);
      this.refresh();
    }
    return result;
  }

  /** Quali mostri mostrare: i rivelati, oppure tutti se `ids` è null. */
  setVisibleMonsters(ids: ReadonlySet<string> | null) {
    this.visibleMonsters = ids;
    this.applyVisibility();
  }

  /** Quali glifi gli eroi conoscono; chi non li ha mai visti non è una destinazione. */
  setKnownMarkers(known: ReadonlySet<Marker> | null) {
    this.knownMarkers = known;
    this.refresh();
  }

  /** I glifi verso cui l'eroe attivo può viaggiare ora (vuoto se si sta muovendo). I glifi li colorano di conseguenza. */
  travelDestinations(): ReadonlySet<Marker> {
    return this.moving ? new Set() : this.teleportTargets;
  }

  /** Alcuni mostri sono appena stati rivelati: compaiono con una piccola animazione. */
  revealMonsters(ids: readonly string[]) {
    for (const id of ids) this.appearing.set(id, 0);
    this.applyVisibility();
  }

  private applyVisibility() {
    for (const p of this.pieces) {
      // Chi è in città non è sulla mappa: la sua pedina non si vede.
      this.views.get(p.id)!.root.visible = (!p.city || this.dying.has(p.id)) && (p.team === 'hero' || !this.visibleMonsters || this.visibleMonsters.has(p.id));
    }
  }

  /** C'è già un pezzo su questa casella? */
  isOccupied(cell: Cell): boolean {
    return !!this.pieceAt(cell);
  }

  private pieceAt(cell: Cell): Piece | undefined {
    return this.pieces.find((p) => !p.city && p.cell.x === cell.x && p.cell.y === cell.y);
  }

  /** Il tema è cambiato: ridisegna le pedine e l'area di movimento. */
  applyTheme() {
    for (const p of this.pieces) this.drawPiece(p);
    this.refresh();
  }

  /** Dove sta la pedina dell'eroe attivo (in pixel del mondo), o null se non ce n'è o si sta muovendo: serve al bottone contestuale. */
  activeWorldPos(): { x: number; y: number } | null {
    const a = this.active;
    if (!a || a.city || this.moving) return null;
    const root = this.views.get(a.id)!.root;
    return { x: root.position.x, y: root.position.y };
  }

  /**
   * Un'azione dell'eroe attivo che cambia dove sta (andare in città, tornare) o cosa fa in città (servizi): `run` applica le regole; se va a buon fine
   * si aggiornano la pedina (sparisce dalla mappa o riappare), le caselle raggiungibili e l'interfaccia.
   */
  cityDo(run: (state: GameState, board: Board, piece: Piece) => CityResult): CityResult {
    const active = this.active;
    if (!this.board || !active || this.moving || !this.enabled) return { code: 'busy' };
    const result = run(this.state, this.board, active);
    if (result.code === 'ok') {
      this.applyVisibility();
      this.drawPiece(active);
      this.onChange(active);
      this.refresh();
    }
    return result;
  }

  /** Dove sta la pedina che si sta muovendo (in pixel del mondo), o null se nessuna si muove: serve alla camera, che la segue. */
  movingWorldPos(): { x: number; y: number } | null {
    const m = this.moving;
    if (!m) return null;
    const root = this.views.get(m.piece.id)!.root;
    return { x: root.position.x, y: root.position.y };
  }

  /** Sceglie un eroe dall'interfaccia (il pallino nella barra). */
  selectHero(id: string) {
    const piece = this.pieces.find((p) => p.id === id);
    if (piece && piece.team === 'hero' && piece.id !== this.state.activeId && !this.moving && this.enabled) this.select(piece);
  }

  private select(piece: Piece) {
    const previous = this.active;
    if (!act.selectHero(this.state, piece.id)) {
      this.onNotice(`${piece.name} ha già agito in questo round`, 'warning');
      return;
    }
    if (previous) this.drawPiece(previous);
    this.drawPiece(piece);
    this.onChange(piece);
    this.refresh();
  }

  /** La struttura grafica di una pedina: fondo, ritratto ritagliato a cerchio (se c'è l'immagine) e anello. */
  private createView(p: Piece): PieceView {
    const r = CELL_SIZE * PAWN_RADIUS_RATIO;
    const root = new Container();
    const base = new Graphics();
    const ring = new Graphics();
    root.addChild(base);
    const texture = p.portrait ? this.portraits.get(p.portrait) : undefined;
    let portrait: Sprite | undefined;
    if (texture) {
      // L'immagine copre il cerchio (ritaglio centrale), ritagliata a cerchio appena dentro l'anello.
      portrait = new Sprite(texture);
      portrait.anchor.set(0.5);
      portrait.scale.set((2 * r) / Math.min(texture.width, texture.height));
      const mask = new Graphics().circle(0, 0, r - PAWN_PORTRAIT_INSET_PX).fill(0xffffff);
      portrait.mask = mask;
      root.addChild(portrait, mask);
    }
    root.addChild(ring);
    return { root, base, ring, portrait };
  }

  /** Disegna una pedina: anello acceso se è l'eroe attivo, spento se è un altro eroe, rosso se è un mostro. */
  private drawPiece(p: Piece) {
    const view = this.views.get(p.id)!;
    const r = CELL_SIZE * PAWN_RADIUS_RATIO;
    const c = theme.color;
    const active = p.id === this.state.activeId;
    const border = p.team === 'monster' ? c.danger : active ? c.accentActive : c.token.idle;
    view.base.clear().circle(0, 0, r).fill(c.token.fill);
    // Senza immagine, un segnaposto al posto del ritratto.
    if (!view.portrait) view.base.circle(0, 0, r * 0.62).fill(c.token.portrait);
    else view.portrait.alpha = p.team === 'hero' && !active ? theme.alpha.portraitIdle : 1; // gli eroi non attivi più tenui
    view.ring.clear().circle(0, 0, r).stroke({ width: active ? LINE.strong : LINE.medium, color: border });
    view.root.position.set((p.cell.x + 0.5) * CELL_SIZE, (p.cell.y + 0.5) * CELL_SIZE);
  }

  /** Un eroe che sta morendo a `k` (da 0 a 1): il colore passa dal normale al rosso mentre la pedina sfuma. */
  private drawDying(p: Piece, k: number) {
    const view = this.views.get(p.id)!;
    const r = CELL_SIZE * PAWN_RADIUS_RATIO;
    const c = theme.color;
    const mix = (from: number, to: number) => {
      const ch = (shift: number) => Math.round(((from >> shift) & 255) * (1 - k) + ((to >> shift) & 255) * k);
      return (ch(16) << 16) | (ch(8) << 8) | ch(0);
    };
    view.base.clear().circle(0, 0, r).fill(mix(c.token.fill, c.danger));
    view.ring.clear().circle(0, 0, r).stroke({ width: LINE.strong, color: mix(c.accentActive, c.danger) });
    if (view.portrait) view.portrait.tint = mix(0xffffff, c.danger);
    view.root.position.set((p.cell.x + 0.5) * CELL_SIZE, (p.cell.y + 0.5) * CELL_SIZE);
    view.root.alpha = 1 - k;
  }

  /** Avanza l'animazione: un passo ogni PAWN_STEP_MS, e ogni passo costa un punto. */
  private tick(deltaMs: number) {
    // Le caselle raggiungibili pulsano lentamente (la luce "respira").
    this.pulseTime = (this.pulseTime + deltaMs) % REACH_PULSE_PERIOD_MS;
    const wave = (1 - Math.cos((this.pulseTime / REACH_PULSE_PERIOD_MS) * Math.PI * 2)) / 2; // 0 -> 1 -> 0
    this.highlight.alpha = REACH_PULSE_MIN + (1 - REACH_PULSE_MIN) * wave;

    // I mostri appena rivelati compaiono: un po' più grandi e trasparenti, poi si assestano.
    for (const [id, p] of this.appearing) {
      const next = p + deltaMs / REVEAL_ANIM_MS;
      const root = this.views.get(id)!.root;
      if (next >= 1) {
        this.appearing.delete(id);
        root.alpha = 1;
        root.scale.set(1);
      } else {
        this.appearing.set(id, next);
        root.alpha = next;
        root.scale.set(REVEAL_SCALE_FROM + (1 - REVEAL_SCALE_FROM) * next);
      }
    }

    // Gli eroi morti sfumano e diventano rossi, poi spariscono (la loro pedina è già fuori dalla mappa per le regole).
    for (const [id, p] of this.dying) {
      const next = p + deltaMs / HERO_DEATH_FADE_MS;
      const piece = this.pieces.find((q) => q.id === id)!;
      const view = this.views.get(id)!;
      if (next >= 1) {
        this.dying.delete(id);
        view.root.alpha = 1;
        if (view.portrait) view.portrait.tint = 0xffffff;
        this.drawPiece(piece);
        this.applyVisibility();
      } else {
        this.dying.set(id, next);
        this.drawDying(piece, next);
      }
    }

    const m = this.moving;
    if (!m) return;
    m.elapsed += deltaMs;
    const from = m.piece.cell;
    const step = m.steps[m.index];
    const to = step.cell;
    const travel = step.kind === 'travel' || step.kind === 'stairs'; // sfuma da un capo e riappare all'altro
    const k = Math.min(1, m.elapsed / (travel ? GLYPH_TRAVEL_MS : PAWN_STEP_MS));
    const root = this.views.get(m.piece.id)!.root;
    if (travel) {
      // Viaggio da glifo a glifo: sfuma sul glifo di partenza e riappare su quello di arrivo.
      const at = k < 0.5 ? from : to;
      root.position.set((at.x + 0.5) * CELL_SIZE, (at.y + 0.5) * CELL_SIZE);
      root.alpha = Math.abs(1 - 2 * k);
    } else {
      root.position.set((from.x + (to.x - from.x) * k + 0.5) * CELL_SIZE, (from.y + (to.y - from.y) * k + 0.5) * CELL_SIZE);
    }
    if (k < 1) return;

    if (travel) root.alpha = 1;
    const outcome = act.applyStep(this.state, this.board!, m.piece, step);
    if (outcome.fell) this.onNotice(`${m.piece.name} cade in una buca: ${PIT_FALL_WOUNDS} ferita`, 'warning');
    if (outcome.died) {
      // Morto: la pedina resta un momento sulla mappa e svanisce in rosso; il turno passa.
      this.dying.set(m.piece.id, 0);
      this.applyVisibility();
      this.moving = null;
      this.onStepped?.(m.piece, outcome); // la vista del gruppo cambia
      this.onDied?.(m.piece);
      this.refresh();
      return;
    }
    this.onChange(m.piece);
    const stop = this.onStepped?.(m.piece, outcome) ?? false; // es. è comparso un mostro: ci si ferma qui
    m.index++;
    m.elapsed = 0;
    if (stop || m.index >= m.steps.length) {
      this.moving = null;
      this.refresh();
    }
  }

  /** Le caselle che l'eroe attivo attraversa, contando che i mostri bloccano. */
  private computeReach(): Map<string, Reach> {
    const active = this.active;
    if (!this.board || !this.enabled || !active) return new Map();
    const result = act.reachFor(this.state, this.board, active, this.knownMarkers);
    this.teleportTargets = result.travelTargets;
    return result.reach;
  }

  /** Ricalcola le caselle raggiungibili e ridisegna. Si evidenziano solo quelle in cui ci si può fermare. */
  private refresh() {
    this.reach = this.computeReach();
    this.highlight.clear();
    if (this.enabled && this.board) {
      // Solo il contorno esterno dell'unione delle caselle (anche con forme a L o buchi), niente riempimento.
      // Ci sono anche la partenza e gli amici (ci si passa), così la linea non si spezza.
      const area = new Set<string>();
      for (const r of this.reach.values()) area.add(cellKey(r.cell));
      const board = this.board;
      const loops = reachOutline(area, (cell, side) => (board.isWallSide(cell, side) ? REACH_WALL_INSET_PX : REACH_EDGE_INSET_PX));
      for (const loop of loops) {
        this.highlight.poly(loop.flat(), true);
      }
      this.highlight.stroke({ width: REACH_LINE_WIDTH_PX, color: theme.color.accentReach, alpha: theme.alpha.reach, join: 'miter' });
    }
    this.drawPath();
  }

  private clearPath() {
    this.pathLine.clear();
  }

  /** Il percorso fino alla casella sotto il puntatore: caselle attraversate evidenziate in giallo tenue. */
  private drawPath() {
    this.clearPath();
    const active = this.active;
    if (!this.enabled || this.moving || !this.hovered || !active || this.pieceAt(this.hovered)) return;
    const target = this.reach.get(cellKey(this.hovered));
    if (!target || target.cost === 0) return;

    for (const step of pathTo(this.reach, this.hovered)) {
      this.pathLine.rect(step.cell.x * CELL_SIZE, step.cell.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
    this.pathLine.fill({ color: theme.color.accentUiSoft, alpha: theme.alpha.pathCell });
  }
}

/** Gli elementi grafici di una pedina. */
interface PieceView {
  root: Container;
  base: Graphics;
  ring: Graphics;
  portrait?: Sprite;
}
