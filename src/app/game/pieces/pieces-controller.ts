import { Container, Graphics, Sprite, Text, Texture, Ticker } from 'pixi.js';
import {
  CELL_SIZE,
  FX,
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
import { Piece, occupies } from './piece';
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
  /** Le caselle dove si può spostare un bersaglio con il Contraccolpo. */
  private readonly knock = new Graphics();
  private readonly pathLine = new Graphics();
  /** Gli effetti sopra le pedine: linee e proiettili degli attacchi, numeri che salgono. */
  private readonly fx = new Container();
  /** Le animazioni in corso (scatti, ingressi, numeri): `k` va da 0 a 1. */
  private anims: { t: number; dur: number; fn: (k: number) => void; done: () => void }[] = [];
  /** Chi ha fatto lo scatto verso il bersaglio e di quanto (in attesa del dialogo e dello scontro). */
  private readonly lunged = new Map<string, { x: number; y: number }>();
  /** L'attacco a distanza in corso: la linea e il proiettile. */
  private shot: { g: Graphics; proj: Graphics; a: { x: number; y: number }; t: { x: number; y: number }; color: number; target: Piece } | null = null;
  /** Ogni pedina è un gruppo: fondo, ritratto (ritagliato a cerchio) e anello sopra tutto. */
  private readonly views = new Map<string, PieceView>();

  private board: Board | null = null;
  private reach = new Map<string, Reach>();
  private enabled = true;
  private pulseTime = 0;
  private hovered: Cell | null = null;
  /** Chiamata dopo ogni passo di un eroe: dice se il movimento deve fermarsi (es. è comparso un mostro). */
  onStepped: ((piece: Piece, outcome: StepOutcome) => boolean) | null = null;
  /** Chiamata quando si tocca un mostro sulla mappa: la scena apre la sua scheda, ma solo nella vista Overlord. */
  onMonsterClick: ((piece: Piece) => void) | null = null;
  /** Chiamata quando un eroe muore per un passo (cade in una buca a 1 ferita): la scena avvisa e fa passare il turno. */
  onDied: ((piece: Piece) => void) | null = null;
  /** Eroi che stanno morendo: da 0 a 1. Sfumano e diventano rossi, poi spariscono dalla mappa. */
  private readonly dying = new Map<string, number>();
  /** I pezzi che stanno morendo e non sono più nello stato (i mostri uccisi): servono a finire la dissolvenza. */
  private readonly dyingPieces = new Map<string, Piece>();
  /** Quali mostri si vedono: null = tutti (es. chi costruisce la mappa); gli eroi si vedono sempre. */
  private visibleMonsters: ReadonlySet<string> | null = null;
  /** I glifi che gli eroi conoscono (già rivelati): null = tutti (es. chi costruisce la mappa). Si può viaggiare solo verso questi. */
  private knownMarkers: ReadonlySet<Marker> | null = null;
  /** I glifi verso cui l'eroe attivo può viaggiare adesso (l'ultimo calcolo). */
  private teleportTargets = new Set<Marker>();
  /** Mostri che stanno apparendo: da 0 a 1. */
  private readonly appearing = new Map<string, number>();
  private moving: { piece: Piece; steps: Reach[]; index: number; elapsed: number; done?: () => void } | null = null;

  constructor(
    private readonly layer: Container,
    ticker: Ticker,
    /** Lo stato di gioco: da qui si leggono e si modificano pedine ed eroe attivo. */
    private readonly state: GameState,
    private readonly onChange: (active: Piece | null) => void,
    private readonly onNotice: (text: string, icon?: string) => void,
    /** Le immagini dei ritratti già caricate, per percorso (vedi loadPortraits). */
    private readonly portraits: ReadonlyMap<string, Texture> = new Map<string, Texture>(),
  ) {
    layer.addChild(this.highlight, this.pathLine, this.knock);
    for (const p of this.pieces) {
      const view = this.createView(p);
      this.views.set(p.id, view);
      this.drawPiece(p);
      layer.addChild(view.root);
    }
    layer.addChild(this.fx);
    this.applyVisibility();
    ticker.add((t) => this.tick(t.deltaMS));
    this.onChange(this.active);
  }

  /** Una pedina nuova in partita (un mostro evocato): ne crea la grafica. Compare solo se i mostri nascosti sono rivelati. */
  addPiece(piece: Piece, textures: ReadonlyMap<string, Texture> = new Map()) {
    for (const [url, tex] of textures) (this.portraits as Map<string, Texture>).set(url, tex);
    // Crea la grafica di tutte le pedine dello stato che ancora non ce l'hanno (più mostri evocati insieme sono già nello stato).
    for (const p of this.pieces) {
      if (this.views.has(p.id)) continue;
      const view = this.createView(p);
      this.views.set(p.id, view);
      this.layer.addChild(view.root);
      this.drawPiece(p);
    }
    this.layer.addChild(this.fx); // gli effetti restano sopra le pedine
    this.applyVisibility();
    this.refresh();
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
  setAction(requested: 'run' | 'fight' | 'rest'): act.ActionChange {
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
      else if (other.team === 'monster') this.onMonsterClick?.(other);
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
      const view = this.views.get(p.id);
      if (view) view.root.visible = (!p.city || this.dying.has(p.id)) && (p.team === 'hero' || !this.visibleMonsters || this.visibleMonsters.has(p.id));
    }
  }

  /** C'è già un pezzo su questa casella? */
  isOccupied(cell: Cell): boolean {
    return !!this.pieceAt(cell);
  }

  private pieceAt(cell: Cell): Piece | undefined {
    return this.pieces.find((p) => !p.city && occupies(p, cell));
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

  /** È cominciato un nuovo round (dopo il turno dell'Overlord): ridisegna le pedine e aggiorna interfaccia e caselle raggiungibili. */
  roundStarted() {
    for (const p of this.pieces) this.drawPiece(p);
    this.onChange(this.active);
    this.refresh();
  }

  /** Muove un pezzo (un mostro, nel turno dell'Overlord) lungo un percorso già calcolato, con la stessa animazione degli eroi. Finisce quando arriva. */
  walk(piece: Piece, steps: Reach[]): Promise<void> {
    return new Promise((resolve) => {
      if (!steps.length || this.moving) return resolve();
      this.moving = { piece, steps, index: 0, elapsed: 0, done: resolve };
      this.highlight.clear();
      this.clearPath();
    });
  }

  // --- Effetti: ingressi, scatti degli attacchi, linee, numeri (i tempi sono in `FX`, constants.ts) ---

  private animate(dur: number, fn: (k: number) => void): Promise<void> {
    return new Promise((resolve) => {
      fn(0);
      this.anims.push({ t: 0, dur: Math.max(1, dur), fn, done: resolve });
    });
  }

  /** Sposta il disegno di una pedina di (x, y) pixel rispetto alla sua casella, senza toccare la sua posizione vera. */
  private setOffset(p: Piece, x: number, y: number) {
    this.views.get(p.id)?.root.pivot.set(-x, -y);
  }

  /** Un mostro evocato esce dall'ombra: dissolvenza da zero e traslazione dal punto `from` (in pixel del mondo) alla sua casella. */
  enter(piece: Piece, from: { x: number; y: number }): Promise<void> {
    const view = this.views.get(piece.id);
    if (!view) return Promise.resolve();
    const c = this.centerOf(piece);
    const dx = from.x - c.x;
    const dy = from.y - c.y;
    return this.animate(FX.enterMs, (k) => {
      const e = 1 - Math.pow(1 - k, 3);
      view.root.alpha = e;
      this.setOffset(piece, dx * (1 - e), dy * (1 - e));
    }).then(() => {
      view.root.alpha = 1;
      this.setOffset(piece, 0, 0);
    });
  }

  /** Attacco in mischia, prima parte: la pedina scatta verso il bersaglio e si ferma a metà strada (poi compare il dialogo). */
  lunge(attacker: Piece, target: Piece): Promise<void> {
    const a = this.centerOf(attacker);
    const t = this.centerOf(target);
    const off = { x: (t.x - a.x) / 2, y: (t.y - a.y) / 2 };
    this.lunged.set(attacker.id, off);
    return this.animate(FX.lungeMs, (k) => {
      const e = 1 - Math.pow(1 - k, 3);
      this.setOffset(attacker, off.x * e, off.y * e);
    });
  }

  /** Attacco in mischia, seconda parte: lo scontro con il bersaglio (`onImpact` parte nel momento dell'urto) e il ritorno alla casella. */
  async strike(attacker: Piece, target: Piece, hit: boolean, onImpact?: () => void): Promise<void> {
    const a = this.centerOf(attacker);
    const t = this.centerOf(target);
    const from = this.lunged.get(attacker.id) ?? { x: 0, y: 0 };
    const goal = { x: (t.x - a.x) * 0.78, y: (t.y - a.y) * 0.78 };
    await this.animate(FX.strikeMs, (k) => this.setOffset(attacker, from.x + (goal.x - from.x) * k * k, from.y + (goal.y - from.y) * k * k));
    onImpact?.();
    if (hit) void this.shake(target);
    await this.animate(FX.returnMs, (k) => {
      const e = 1 - Math.pow(1 - k, 3);
      this.setOffset(attacker, goal.x * (1 - e), goal.y * (1 - e));
    });
    this.lunged.delete(attacker.id);
    this.setOffset(attacker, 0, 0);
  }

  /** Il bersaglio colpito trema un istante. */
  private shake(target: Piece): Promise<void> {
    return this.animate(260, (k) => this.setOffset(target, Math.sin(k * Math.PI * 6) * 5 * (1 - k), 0)).then(() => this.setOffset(target, 0, 0));
  }

  /**
   * Attacco a distanza o magico, prima parte: la linea di mira (grigia, tratteggiata e quasi trasparente, uguale per distanza e magia) si allunga verso
   * il bersaglio; poi parte il dardo (azzurro o viola) dall'attaccante e si ferma ai 3/4 del percorso (poi compare il dialogo).
   */
  async beginShot(attacker: Piece, target: Piece, kind: 'ranged' | 'magic'): Promise<void> {
    this.clearShot();
    const a = this.centerOf(attacker);
    const t = this.centerOf(target);
    const color = kind === 'magic' ? theme.color.fx.magic : theme.color.fx.ranged;
    const g = new Graphics();
    const proj = new Graphics();
    this.fx.addChild(g, proj);
    this.shot = { g, proj, a, t, color, target };
    await this.animate(FX.lineMs, (k) => this.drawAim(1 - Math.pow(1 - k, 2)));
    await this.animate(FX.shotMs, (k) => this.drawBolt(FX.shotStop * (1 - Math.pow(1 - k, 2))));
  }

  /** La linea di mira tratteggiata, disegnata fino alla frazione `f` (0-1) del percorso. */
  private drawAim(f: number) {
    const s = this.shot;
    if (!s) return;
    const len = Math.hypot(s.t.x - s.a.x, s.t.y - s.a.y) || 1;
    const ux = (s.t.x - s.a.x) / len;
    const uy = (s.t.y - s.a.y) / len;
    const end = len * f;
    s.g.clear();
    for (let d = 0; d < end; d += FX.dashPx + FX.gapPx) {
      const e = Math.min(end, d + FX.dashPx);
      s.g.moveTo(s.a.x + ux * d, s.a.y + uy * d).lineTo(s.a.x + ux * e, s.a.y + uy * e);
    }
    s.g.stroke({ width: 2, color: theme.color.linePrimary, alpha: FX.lineAlpha });
  }

  /** Il dardo: la punta piena alla frazione `f` del percorso e dietro una scia che diventa sempre più trasparente fino a sparire. */
  private drawBolt(f: number) {
    const s = this.shot;
    if (!s) return;
    const len = Math.hypot(s.t.x - s.a.x, s.t.y - s.a.y) || 1;
    const ux = (s.t.x - s.a.x) / len;
    const uy = (s.t.y - s.a.y) / len;
    const head = len * f;
    const tail = Math.min(FX.trailPx, head);
    s.proj.clear();
    const parts = FX.trailParts;
    for (let i = 0; i < parts; i++) {
      // dalla punta (i = 0, opaca) verso la coda (trasparente)
      const from = head - (tail * i) / parts;
      const to = head - (tail * (i + 1)) / parts;
      const alpha = 1 - i / parts;
      s.proj.moveTo(s.a.x + ux * from, s.a.y + uy * from).lineTo(s.a.x + ux * to, s.a.y + uy * to).stroke({ width: 3, color: s.color, alpha, cap: 'butt' });
    }
  }

  /** Attacco a distanza, seconda parte: se ha colpito il dardo arriva al bersaglio (`onImpact` all'arrivo); se no continua mentre tutto svanisce. */
  async finishShot(hit: boolean, onImpact?: () => void): Promise<void> {
    const s = this.shot;
    if (!s) {
      onImpact?.();
      return;
    }
    if (hit) {
      await this.animate(FX.shotFinishMs, (k) => this.drawBolt(FX.shotStop + (1 - FX.shotStop) * k * k));
      onImpact?.();
      void this.shake(s.target);
      await this.animate(FX.lineFadeMs, (k) => {
        s.g.alpha = 1 - k;
        s.proj.alpha = 1 - k;
      });
    } else {
      onImpact?.();
      await this.animate(FX.lineFadeMs, (k) => {
        this.drawBolt(FX.shotStop + 0.1 * k);
        s.g.alpha = 1 - k;
        s.proj.alpha = 1 - k;
      });
    }
    this.clearShot();
  }

  private clearShot() {
    if (!this.shot) return;
    this.shot.g.destroy();
    this.shot.proj.destroy();
    this.shot = null;
  }

  /** L'attacco è stato annullato prima dell'urto: la pedina torna al suo posto e la linea sparisce. */
  cancelAttackFx(attacker: Piece) {
    this.clearShot();
    const off = this.lunged.get(attacker.id);
    if (!off) return;
    this.lunged.delete(attacker.id);
    void this.animate(FX.returnMs, (k) => this.setOffset(attacker, off.x * (1 - k), off.y * (1 - k))).then(() => this.setOffset(attacker, 0, 0));
  }

  /** Un numero o una scritta sopra la pedina (-3 rosso, Mancato): sale e svanisce. */
  floatText(piece: Piece, text: string, kind: 'damage' | 'miss') {
    const c = this.centerOf(piece);
    const { b } = this.halfExtent(piece);
    // Lo stile dell'interfaccia: i numeri in monospazio come le pillole, le scritte in maiuscolo piccolo e spaziato come le etichette.
    const damage = kind === 'damage';
    const label = new Text({
      text: damage ? text : text.toUpperCase(),
      style: {
        fontFamily: damage ? 'JetBrains Mono, ui-monospace, monospace' : 'Inter, system-ui, sans-serif',
        fontSize: damage ? 18 : 11,
        fontWeight: '600',
        letterSpacing: damage ? 0 : 1.5,
        fill: damage ? theme.color.fx.damage : theme.color.fx.miss,
        stroke: { color: 0x000000, width: 3 },
      },
    });
    label.anchor.set(0.5);
    const y0 = c.y - b - 8;
    label.position.set(c.x, y0);
    this.fx.addChild(label);
    void this.animate(FX.floatMs, (k) => {
      label.position.y = y0 - FX.floatRisePx * (1 - Math.pow(1 - k, 2));
      label.alpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    }).then(() => label.destroy());
  }

  /** Un mostro compare nella vista (per esempio perché attacca): subito visibile. */
  showMonster(piece: Piece) {
    this.revealMonsters([piece.id]);
  }

  /** Evidenzia le caselle dove si può spostare un bersaglio (Contraccolpo), o le toglie con null. */
  showCells(cells: readonly Cell[] | null) {
    this.knock.clear();
    for (const c of cells ?? []) this.knock.rect(c.x * CELL_SIZE + 2, c.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    if (cells?.length) this.knock.fill({ color: theme.color.accentActive, alpha: 0.28 }).stroke({ width: LINE.medium, color: theme.color.accentActive, alpha: 0.9 });
  }

  /** Ridisegna una pedina (per esempio dopo uno spostamento) e le caselle raggiungibili. */
  redraw(p: Piece) {
    if (this.views.has(p.id)) this.drawPiece(p);
    this.refresh();
  }

  /** I mostri uccisi da Giustizia divina svaniscono come quelli sconfitti. */
  monstersSlain(list: readonly Piece[]) {
    for (const m of list) {
      this.dyingPieces.set(m.id, m);
      this.dying.set(m.id, 0);
    }
  }

  /** Dopo un attacco: se il nemico è stato sconfitto la sua pedina svanisce (diventa rossa e sfuma), poi si aggiornano interfaccia e caselle raggiungibili. */
  afterCombat(attacker: Piece, target: Piece, killed: boolean) {
    if (killed && target.team === 'monster') {
      this.dyingPieces.set(target.id, target);
      this.dying.set(target.id, 0);
    } else if (killed) {
      // Un eroe caduto: la pedina svanisce in rosso (è già in città per le regole), come quando muore per una caduta.
      this.dying.set(target.id, 0);
      this.applyVisibility();
    }
    for (const p of [attacker, target]) if (this.views.has(p.id) && !this.dyingPieces.has(p.id)) this.drawPiece(p); // i segnalini di stato appena piazzati
    this.onChange(attacker);
    this.refresh();
  }

  /** Dopo un'azione che cambia le scorte dell'eroe attivo (per esempio la fatica spesa per un punto movimento): aggiorna interfaccia e caselle raggiungibili. */
  refreshActive() {
    const active = this.active;
    if (active) this.onChange(active);
    this.refresh();
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
    if (!root.visible) return null; // la camera non segue un mostro che i giocatori non vedono
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
    const root = new Container();
    const base = new Graphics();
    const ring = new Graphics();
    root.addChild(base);
    const texture = p.portrait ? this.portraits.get(p.portrait) : undefined;
    let portrait: Sprite | undefined;
    let mask: Graphics | undefined;
    if (texture) {
      // L'immagine copre tutta la forma (ritaglio centrale); forma e ritaglio si disegnano in `drawPiece`, perché dipendono dalla dimensione.
      portrait = new Sprite(texture);
      portrait.anchor.set(0.5);
      mask = new Graphics();
      portrait.mask = mask;
      root.addChild(portrait, mask);
    }
    root.addChild(ring);
    const badges = new Container();
    root.addChild(badges);
    return { root, base, ring, portrait, mask, badges };
  }

  /** Metà larghezza e metà altezza della forma della pedina: un cerchio per 1×1, un cerchio più grande per 2×2, una capsula per 1×2 e 2×3. */
  private halfExtent(p: Piece): { a: number; b: number } {
    const margin = CELL_SIZE * (0.5 - PAWN_RADIUS_RATIO); // lo stesso margine dal bordo della casella per tutte le dimensioni
    return { a: (p.size.w * CELL_SIZE) / 2 - margin, b: (p.size.h * CELL_SIZE) / 2 - margin };
  }

  /** La forma della pedina, centrata sull'origine: i raggi degli angoli sono pari al lato più corto (cerchio o capsula). */
  private shape(g: Graphics, a: number, b: number): Graphics {
    return g.roundRect(-a, -b, 2 * a, 2 * b, Math.min(a, b));
  }

  /** Il centro della pedina in pixel del mondo (per i mostri grandi sta nel mezzo delle loro caselle). */
  private centerOf(p: Piece, cell: Cell = p.cell): { x: number; y: number } {
    return { x: (cell.x + p.size.w / 2) * CELL_SIZE, y: (cell.y + p.size.h / 2) * CELL_SIZE };
  }

  /** Disegna una pedina: anello acceso se è l'eroe attivo, spento se è un altro eroe, rosso se è un mostro. */
  private drawPiece(p: Piece) {
    const view = this.views.get(p.id);
    if (!view) return; // una pedina appena evocata, la cui grafica non è ancora pronta
    const { a, b } = this.halfExtent(p);
    const c = theme.color;
    const active = p.id === this.state.activeId;
    const border = p.team === 'monster' ? (p.enhanced ? c.danger : c.token.idle) : active ? c.accentActive : c.token.idle; // rosso solo per i mostri potenziati
    this.shape(view.base.clear(), a, b).fill(c.token.fill);
    // Senza immagine, un segnaposto al posto del ritratto.
    if (!view.portrait) this.shape(view.base, a * 0.62, b * 0.62).fill(c.token.portrait);
    else {
      view.portrait.alpha = p.team === 'hero' && !active ? theme.alpha.portraitIdle : 1; // gli eroi non attivi più tenui
      const tex = view.portrait.texture;
      view.portrait.scale.set(Math.max((2 * a) / tex.width, (2 * b) / tex.height)); // l'immagine copre la forma
      this.shape(view.mask!.clear(), a - PAWN_PORTRAIT_INSET_PX, b - PAWN_PORTRAIT_INSET_PX).fill(0xffffff);
    }
    this.shape(view.ring.clear(), a, b).stroke({ width: active ? LINE.strong : LINE.medium, color: border });
    this.drawBadges(p, view, a, b);
    const at = this.centerOf(p);
    view.root.position.set(at.x, at.y);
  }

  /** I segnalini di stato: un cerchietto colorato per stato, con la lettera (F fiamma, R rete, S stordimento, V veleno) e il numero se è più di uno, in alto a destra della pedina. */
  private drawBadges(p: Piece, view: PieceView, a: number, b: number) {
    view.badges.removeChildren().forEach((c) => c.destroy());
    const kinds: { key: keyof Piece['status']; letter: string; color: number }[] = [
      { key: 'burn', letter: 'F', color: theme.color.status.burn },
      { key: 'web', letter: 'R', color: theme.color.status.web },
      { key: 'stun', letter: 'S', color: theme.color.status.stun },
      { key: 'poison', letter: 'V', color: theme.color.status.poison },
    ];
    let i = 0;
    if (p.toad) {
      // Rospo: un cerchietto verde con la T e i segnalini che restano.
      const r = 9;
      const x = a - r;
      const y = -b + r;
      const dot = new Graphics().circle(x, y, r).fill(theme.color.status.poison).stroke({ width: 1, color: theme.color.token.fill });
      const label = new Text({ text: `T${p.toad.tokens}`, style: { fontFamily: 'sans-serif', fontSize: 10, fontWeight: '700', fill: 0x111111 } });
      label.anchor.set(0.5);
      label.position.set(x, y);
      view.badges.addChild(dot, label);
      i++;
    }
    for (const k of kinds) {
      const n = p.status[k.key];
      if (n < 1) continue;
      const r = 9;
      const x = a - r - i * (2 * r + 2);
      const y = -b + r;
      const dot = new Graphics().circle(x, y, r).fill(k.color).stroke({ width: 1, color: theme.color.token.fill });
      const label = new Text({ text: n > 1 ? `${k.letter}${n}` : k.letter, style: { fontFamily: 'sans-serif', fontSize: 10, fontWeight: '700', fill: 0x111111 } });
      label.anchor.set(0.5);
      label.position.set(x, y);
      view.badges.addChild(dot, label);
      i++;
    }
  }

  /** Un eroe che sta morendo a `k` (da 0 a 1): il colore passa dal normale al rosso mentre la pedina sfuma. */
  private drawDying(p: Piece, k: number) {
    const view = this.views.get(p.id)!;
    const { a, b } = this.halfExtent(p);
    const c = theme.color;
    const mix = (from: number, to: number) => {
      const ch = (shift: number) => Math.round(((from >> shift) & 255) * (1 - k) + ((to >> shift) & 255) * k);
      return (ch(16) << 16) | (ch(8) << 8) | ch(0);
    };
    this.shape(view.base.clear(), a, b).fill(mix(c.token.fill, c.danger));
    this.shape(view.ring.clear(), a, b).stroke({ width: LINE.strong, color: mix(c.accentActive, c.danger) });
    if (view.portrait) view.portrait.tint = mix(0xffffff, c.danger);
    const at = this.centerOf(p);
    view.root.position.set(at.x, at.y);
    view.root.alpha = 1 - k;
  }

  /** Avanza l'animazione: un passo ogni PAWN_STEP_MS, e ogni passo costa un punto. */
  private tick(deltaMs: number) {
    // Le caselle raggiungibili pulsano lentamente (la luce "respira").
    this.pulseTime = (this.pulseTime + deltaMs) % REACH_PULSE_PERIOD_MS;
    const wave = (1 - Math.cos((this.pulseTime / REACH_PULSE_PERIOD_MS) * Math.PI * 2)) / 2; // 0 -> 1 -> 0
    this.highlight.alpha = REACH_PULSE_MIN + (1 - REACH_PULSE_MIN) * wave;

    // Le animazioni degli effetti (scatti, ingressi, numeri che salgono).
    for (const a of [...this.anims]) {
      a.t += deltaMs;
      const k = Math.min(1, a.t / a.dur);
      a.fn(k);
      if (k >= 1) {
        this.anims.splice(this.anims.indexOf(a), 1);
        a.done();
      }
    }

    // I mostri appena rivelati compaiono: un po' più grandi e trasparenti, poi si assestano.
    for (const [id, p] of this.appearing) {
      const next = p + deltaMs / REVEAL_ANIM_MS;
      const root = this.views.get(id)?.root;
      if (!root) {
        this.appearing.delete(id); // la pedina non c'è più
        continue;
      }
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
      const piece = this.dyingPieces.get(id) ?? this.pieces.find((q) => q.id === id)!;
      const view = this.views.get(id)!;
      if (next >= 1) {
        this.dying.delete(id);
        if (this.dyingPieces.delete(id)) {
          // un mostro ucciso: la sua pedina sparisce per sempre
          view.root.destroy({ children: true });
          this.views.delete(id);
          continue;
        }
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
    for (const h of outcome.auraHits) this.onNotice(`${m.piece.name} subisce 1 ferita per l'Aura di ${h.name}`, 'warning');
    if (outcome.died && m.piece.team === 'monster') {
      // Un mostro morto per strada (Aura): svanisce come quando lo si sconfigge.
      this.dyingPieces.set(m.piece.id, m.piece);
      this.dying.set(m.piece.id, 0);
      this.moving = null;
      this.onStepped?.(m.piece, outcome);
      m.done?.();
      this.refresh();
      return;
    }
    this.monstersSlain(outcome.slain);
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
    const stop = (this.onStepped?.(m.piece, outcome) ?? false) && m.piece.team === 'hero'; // es. è comparso un mostro: ci si ferma qui (ai mostri non succede)
    m.index++;
    m.elapsed = 0;
    if (stop || m.index >= m.steps.length) {
      this.moving = null;
      m.done?.();
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
  /** Il ritaglio dell'immagine (la stessa forma della pedina, appena più piccola). */
  mask?: Graphics;
  /** I segnalini di stato sopra la pedina, in alto a destra. */
  badges: Container;
}
