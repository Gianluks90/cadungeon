import { Container, Graphics, Sprite, Texture, Ticker } from 'pixi.js';
import {
  CELL_SIZE,
  CHEST_OPEN_COST,
  PIT_FALL_WOUNDS,
  GLYPH_TRAVEL_MS,
  PAWN_PORTRAIT_INSET_PX,
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
import { Reach, pathTo, reachable } from '../board/movement';
import { reachOutline } from './reach-outline';
import { Piece } from './piece';
import { Loot, Marker } from '../board/marker';
import { Party } from '../party';
import { doorAction } from '../board/door-rules';
import { RuneColor } from '../board/door';

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
  private activeId: string | null;
  private reach = new Map<string, Reach>();
  private enabled = true;
  private pulseTime = 0;
  private hovered: Cell | null = null;
  /** Chiamata dopo ogni passo di un eroe: dice se il movimento deve fermarsi (es. è comparso un mostro). */
  onStepped: ((piece: Piece) => boolean) | null = null;
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
    private readonly pieces: Piece[],
    private readonly onChange: (active: Piece | null) => void,
    private readonly onNotice: (text: string) => void,
    /** Le immagini dei ritratti già caricate, per percorso (vedi loadPortraits). */
    private readonly portraits: ReadonlyMap<string, Texture> = new Map(),
  ) {
    this.activeId = pieces.find((p) => p.team === 'hero')?.id ?? null;
    layer.addChild(this.highlight, this.pathLine);
    for (const p of pieces) {
      const view = this.createView(p);
      this.views.set(p.id, view);
      this.drawPiece(p);
      layer.addChild(view.root);
    }
    this.applyVisibility();
    ticker.add((t) => this.tick(t.deltaMS));
    this.onChange(this.active);
  }

  /** L'eroe che si sta muovendo (null se non ce ne sono). */
  get active(): Piece | null {
    return this.pieces.find((p) => p.id === this.activeId) ?? null;
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

  /** Inizia un nuovo round: i punti movimento di tutti gli eroi tornano al massimo. */
  newTurn() {
    if (this.moving) return;
    for (const p of this.pieces) p.points = p.speed;
    this.onChange(this.active);
    this.refresh();
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
      if (other.team === 'hero' && other.id !== this.activeId) this.select(other);
      return;
    }
    const active = this.active;
    const target = this.reach.get(cellKey(cell));
    if (!active || !target || target.cost === 0) return;
    const steps = pathTo(this.reach, cell);
    if (steps.some((s) => s.kind === 'travel')) this.onNotice('Viaggio da glifo a glifo: spendi tutti i punti movimento');
    else if (steps.some((s) => s.kind === 'stairs')) this.onNotice('Scale: 1 punto movimento');
    this.moving = { piece: active, steps, index: 0, elapsed: 0 };
    this.highlight.clear();
    this.clearPath();
  }

  /**
   * Usa la porta `index` con l'eroe attivo: serve una casella adiacente e abbastanza punti movimento, e per una
   * porta bloccata la chiave giusta (o scassinarla, se si può). Le regole stanno in doorAction; qui si applicano
   * e si dice com'è andata, così chi chiama può avvisare.
   */
  useDoor(index: number, party: Party): DoorResult {
    const active = this.active;
    if (!this.board || !active || this.moving || !this.enabled) return { code: 'busy', cost: 0 };
    if (!this.board.isAdjacentToDoor(active.cell, index)) return { code: 'far', cost: 0 };
    const door = this.board.doors[index].door;
    const action = doorAction(door, party);
    if (action.kind === 'denied') return { code: action.needs === 'rune' ? 'needs-rune' : 'needs-key', cost: 0, color: action.color };
    if (active.points < action.cost) return { code: 'cost', cost: action.cost };

    if (action.kind === 'unlock' || action.kind === 'pick') door.unlocked = true;
    this.board.toggleDoor(index, active.cell);
    active.points -= action.cost;
    this.onChange(active);
    this.refresh();
    const code = action.kind === 'open' ? 'opened' : action.kind === 'close' ? 'closed' : action.kind === 'unlock' ? 'unlocked' : 'picked';
    return { code, cost: action.cost };
  }

  /**
   * L'eroe attivo apre lo scrigno su cui sta (non uno vicino): costa 2 punti movimento. Un altro personaggio nella stessa
   * casella non c'è mai, perché due pedine non possono fermarsi sulla stessa casella. Chi chiama avvisa e ridisegna.
   */
  useChest(): ChestResult {
    const active = this.active;
    if (!this.board || !active || this.moving || !this.enabled) return { code: 'busy', cost: 0 };
    const chest = this.board.markerAt(active.cell);
    if (chest?.type !== 'chest') return { code: 'none', cost: 0 };
    if (chest.open) return { code: 'already', cost: 0 };
    if (active.points < CHEST_OPEN_COST) return { code: 'cost', cost: CHEST_OPEN_COST };
    chest.open = true;
    active.points -= CHEST_OPEN_COST;
    this.onChange(active);
    this.refresh();
    return { code: 'opened', cost: CHEST_OPEN_COST, contents: chest.contents ?? [] };
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
      this.views.get(p.id)!.root.visible = p.team === 'hero' || !this.visibleMonsters || this.visibleMonsters.has(p.id);
    }
  }

  /** C'è già un pezzo su questa casella? */
  isOccupied(cell: Cell): boolean {
    return !!this.pieceAt(cell);
  }

  private pieceAt(cell: Cell): Piece | undefined {
    return this.pieces.find((p) => p.cell.x === cell.x && p.cell.y === cell.y);
  }

  /** Il tema è cambiato: ridisegna le pedine e l'area di movimento. */
  applyTheme() {
    for (const p of this.pieces) this.drawPiece(p);
    this.refresh();
  }

  private select(piece: Piece) {
    const previous = this.active;
    this.activeId = piece.id;
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
    const active = p.id === this.activeId;
    const border = p.team === 'monster' ? c.danger : active ? c.accentActive : c.token.idle;
    view.base.clear().circle(0, 0, r).fill(c.token.fill);
    // Senza immagine, un segnaposto al posto del ritratto.
    if (!view.portrait) view.base.circle(0, 0, r * 0.62).fill(c.token.portrait);
    else view.portrait.alpha = p.team === 'hero' && !active ? theme.alpha.portraitIdle : 1; // gli eroi non attivi più tenui
    view.ring.clear().circle(0, 0, r).stroke({ width: active ? LINE.strong : LINE.medium, color: border });
    view.root.position.set((p.cell.x + 0.5) * CELL_SIZE, (p.cell.y + 0.5) * CELL_SIZE);
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
    m.piece.cell = to;
    m.piece.points -= step.stepCost; // un passo costa 1, un salto o un'uscita da una buca di più
    if (step.kind !== 'climb' && this.board?.isPit(to)) this.fallInto(m.piece);
    this.onChange(m.piece);
    const stop = this.onStepped?.(m.piece) ?? false; // es. è comparso un mostro: ci si ferma qui
    m.index++;
    m.elapsed = 0;
    if (stop || m.index >= m.steps.length) {
      this.moving = null;
      this.refresh();
    }
  }

  /** La pedina cade in una buca: subisce ferite che l'armatura non riduce. Il movimento finisce lì. */
  private fallInto(piece: Piece) {
    piece.wounds = Math.max(0, piece.wounds - PIT_FALL_WOUNDS);
    this.onNotice(`${piece.name} cade in una buca: ${PIT_FALL_WOUNDS} ferita`);
  }

  /** Le caselle che l'eroe attivo attraversa, contando che i mostri bloccano. */
  private computeReach(): Map<string, Reach> {
    const active = this.active;
    if (!this.board || !this.enabled || !active) return new Map();
    const enemies = new Set(this.pieces.filter((p) => p.team !== active.team).map((p) => cellKey(p.cell)));
    // Su un glifo acceso si può viaggiare verso gli altri glifi accesi e liberi, spendendo tutti i punti rimasti.
    const here = this.board.markerAt(active.cell);
    const onActiveGlyph = here?.type === 'glyph' && here.active && active.team === 'hero';
    // Destinazioni: altri glifi accesi, già scoperti dagli eroi e senza nessuna pedina sopra (amica o nemica).
    const targets = onActiveGlyph && active.points >= 1
      ? this.board.markers.filter(
          (m) =>
            m.type === 'glyph' && m.active && !(m.x === active.cell.x && m.y === active.cell.y) &&
            (!this.knownMarkers || this.knownMarkers.has(m)) && !this.pieceAt({ x: m.x, y: m.y }),
        )
      : [];
    this.teleportTargets = new Set(targets);
    // Solo gli eroi usano le scale (un punto movimento, poi si prosegue).
    const stairs = active.team === 'hero' ? this.board.stairsLinks() : undefined;
    return reachable(this.board, active.cell, active.points, enemies, targets.map((m) => ({ x: m.x, y: m.y })), stairs);
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

/** Com'è andato l'uso di una porta. `cost` sono i punti movimento spesi (o che servirebbero, per `cost`). */
export interface DoorResult {
  code: 'opened' | 'closed' | 'unlocked' | 'picked' | 'far' | 'cost' | 'busy' | 'needs-key' | 'needs-rune';
  cost: number;
  /** Il colore della chiave runica che serve, se `code` è 'needs-rune'. */
  color?: RuneColor;
}

/** Com'è andata l'apertura di uno scrigno. `contents` è ciò che c'era dentro: chi chiama lo dà al gruppo. */
export interface ChestResult {
  code: 'opened' | 'already' | 'cost' | 'busy' | 'none';
  cost: number;
  contents?: Loot[];
}

/** Gli elementi grafici di una pedina. */
interface PieceView {
  root: Container;
  base: Graphics;
  ring: Graphics;
  portrait?: Sprite;
}
