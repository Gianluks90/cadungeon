import { fitPortrait } from './portraits';
import { ColorMatrixFilter, Container, Graphics, Sprite, Text, Texture, Ticker } from 'pixi.js';
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
import { interactionsOn } from '../state/events';
import { MarkerEvent, pickUp } from '../markers/marker-rules';
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
  /** Il tiro in corso: i tratti disegnati (uno, o due se passa per una scala), la loro lunghezza totale, i colori e il bersaglio. */
  private shot: { g: Graphics; proj: Graphics; segs: { a: { x: number; y: number }; b: { x: number; y: number }; len: number }[]; total: number; color: number; target: Piece } | null = null;
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
  /** Dopo ogni passo di un mostro: se ritorna vero il suo movimento si ferma lì (Vigilanza: un eroe può attaccarlo). Riceve com'era prima del passo. */
  onMonsterStep: ((piece: Piece, before: { cell: Cell; size: { w: number; h: number } }) => boolean) | null = null;
  /** Chiamata quando un eroe muore per un passo (cade in una buca a 1 ferita): la scena avvisa e fa passare il turno. */
  onDied: ((piece: Piece) => void) | null = null;
  /** Eroi che stanno morendo: da 0 a 1. Sfumano e diventano rossi, poi spariscono dalla mappa. */
  private readonly dying = new Map<string, number>();
  /** I pezzi che stanno morendo e non sono più nello stato (i mostri uccisi): servono a finire la dissolvenza. */
  private readonly dyingPieces = new Map<string, Piece>();
  /** Fra quelle che svaniscono, quelle tolte da un evento (sfumano senza diventare rosse, perché non sono state sconfitte). */
  private readonly withdrawn = new Set<string>();
  /** Il filtro dell'aspetto di pietra: toglie il colore all'immagine. */
  private readonly stoneFilter = (() => {
    const f = new ColorMatrixFilter();
    f.desaturate();
    return f;
  })();
  /** Quali mostri si vedono: null = tutti (es. chi costruisce la mappa); gli eroi si vedono sempre. */
  private visibleMonsters: ReadonlySet<string> | null = null;
  /** I glifi che gli eroi conoscono (già rivelati): null = tutti (es. chi costruisce la mappa). Si può viaggiare solo verso questi. */
  private knownMarkers: ReadonlySet<Marker> | null = null;
  /** I glifi verso cui l'eroe attivo può viaggiare adesso (l'ultimo calcolo). */
  private teleportTargets = new Set<Marker>();
  /** Mostri che stanno apparendo: da 0 a 1. */
  private readonly appearing = new Map<string, number>();
  private moving: { piece: Piece; steps: Reach[]; index: number; elapsed: number; done?: () => void; arcs?: ({ from: number; to: number } | null)[] } | null = null;

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
  setAction(requested: 'run' | 'fight' | 'rest' | 'prepare'): act.ActionChange {
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
    // Acrobata attraversa ostacoli e buche, ma deve fermarsi in uno spazio libero (nemici e amici li ferma già il controllo qui sopra).
    if (act.stopForbidden(this.state, this.board, active, cell)) {
      this.onNotice('Acrobata: devi fermarti in uno spazio libero', 'warning');
      return;
    }
    const steps = pathTo(this.reach, cell);
    if (steps.some((s) => s.kind === 'travel')) this.onNotice('Viaggio da glifo a glifo: spendi tutti i punti movimento', 'brightness_empty');
    else if (steps.some((s) => s.kind === 'stairs')) this.onNotice('Scale: {mov:1}', 'stairs');
    this.moving = { piece: active, steps, index: 0, elapsed: 0, arcs: this.planArcs(active, steps) };
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

  /** L'eroe attivo raccoglie l'oggetto della sua casella (vedi marker-rules.pickUp): senza costo, e l'oggetto sparisce dalla mappa. */
  pickUp(): MarkerEvent | null {
    const active = this.active;
    if (!this.board || !active || this.moving || !this.enabled) return null;
    const event = pickUp(this.board, active, this.state);
    if (event?.kind === 'picked-up') {
      this.onChange(active);
      this.refresh();
    }
    return event;
  }

  /** L'eroe attivo usa il segnalino Incontro della sua casella (vedi actions.useEncounter): paga il costo e il segnalino sparisce. */
  useEncounter(): act.EncounterResult | null {
    const active = this.active;
    if (!this.board || !active || this.moving || !this.enabled) return null;
    const result = act.useEncounter(this.state, this.board, active);
    if (result.code === 'used') {
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

  /** L'eroe attivo interagisce con una pedina (evento `interact`, vedi actions.interact): il badge "?" della pedina sparisce e le pedine cambiate dall'evento si ridisegnano. */
  interact(targetId: string): act.InteractResult {
    const active = this.active;
    if (!this.board || !active || this.moving || !this.enabled) return { code: 'busy' };
    const result = act.interact(this.state, this.board, active, targetId);
    if (result.code === 'ok') {
      const target = this.state.pieces.find((p) => p.id === targetId);
      for (const p of [...(target ? [target] : []), ...(result.modified ?? [])]) if (this.views.has(p.id)) this.drawPiece(p);
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
      this.moving = { piece, steps, index: 0, elapsed: 0, done: resolve, arcs: this.planArcs(piece, steps) };
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

  /**
   * I passi in cui la pedina "vola": un salto sopra una buca, oppure l'attraversamento di ostacoli o nemici (Acrobata, Volo): dal punto dove parte fino a
   * dove atterra (il primo passo in cui può fermarsi) la scala sale a `FX.jumpScale` a metà strada e torna a 1. Per ogni passo, che parte (da 0 a 1) del
   * volo copre; null se è un passo normale.
   */
  private planArcs(piece: Piece, steps: Reach[]): ({ from: number; to: number } | null)[] {
    const arcs: ({ from: number; to: number } | null)[] = steps.map(() => null);
    const board = this.board;
    if (!board) return arcs;
    // Una casella di solo passaggio: non ci si può fermare (ostacolo o buca per chi attraversa) o c'è un nemico.
    const over = (s: Reach) => {
      if (s.kind === 'travel' || s.kind === 'stairs') return false;
      if (act.stopForbidden(this.state, board, piece, s.cell)) return true;
      const other = this.pieceAt(s.cell);
      return !!other && other.id !== piece.id && other.team !== piece.team;
    };
    let i = 0;
    while (i < steps.length) {
      if (steps[i].kind === 'jump') {
        arcs[i] = { from: 0, to: 1 };
        i++;
      } else if (!over(steps[i])) {
        i++;
      } else {
        let j = i;
        while (j < steps.length - 1 && over(steps[j])) j++; // j: il primo passo in cui atterra
        const n = j - i + 1;
        for (let k = i; k <= j; k++) arcs[k] = { from: (k - i) / n, to: (k - i + 1) / n };
        i = j + 1;
      }
    }
    return arcs;
  }

  /** Un mostro evocato arriva come se cadesse dall'alto: parte più grande (`FX.enterScale`) e un po' trasparente, e si posa sulla sua casella a grandezza normale, accelerando. */
  enter(piece: Piece): Promise<void> {
    const view = this.views.get(piece.id);
    if (!view) return Promise.resolve();
    return this.animate(FX.enterMs, (k) => {
      view.root.alpha = Math.min(1, k * 2.5);
      view.root.scale.set(FX.enterScale - (FX.enterScale - 1) * k * k);
    }).then(() => {
      view.root.alpha = 1;
      view.root.scale.set(1);
    });
  }

  /**
   * Una pedina scaraventata (Contraccolpo) salta dalla casella `from` a quella dove si trova adesso: durante lo spostamento la scala sale da 1 a
   * `FX.jumpScale` e torna a 1, e all'atterraggio dal suo bordo partono linee grigie a raggiera.
   */
  async jump(piece: Piece, from: Cell): Promise<void> {
    const view = this.views.get(piece.id);
    if (!view) return;
    const a = this.centerOf({ ...piece, cell: from });
    const b = this.centerOf(piece);
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    await this.animate(FX.jumpMs, (k) => {
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // parte piano, corre a metà, frena
      const s = 1 + (FX.jumpScale - 1) * Math.sin(Math.PI * k);
      view.root.scale.set(s);
      this.setOffset(piece, (dx * (1 - e)) / s, (dy * (1 - e)) / s); // la scala ingrandisce anche lo scarto: lo si compensa
    });
    view.root.scale.set(1);
    this.setOffset(piece, 0, 0);
    this.landingBurst(piece);
  }

  /** L'atterraggio: linee grigie corte che partono dal bordo della pedina in tutte le direzioni, si allungano e svaniscono. */
  private landingBurst(piece: Piece) {
    const c = this.centerOf(piece);
    const { b } = this.halfExtent(piece);
    const g = new Graphics();
    g.position.set(c.x, c.y);
    this.fx.addChild(g);
    const n = FX.burstLines;
    void this.animate(FX.burstMs, (k) => {
      g.clear();
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + 0.2;
        const r0 = b + 3 + k * 14;
        const r1 = r0 + (5 + (i % 3) * 3) * (1 - k * 0.5);
        g.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0).lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
      }
      g.stroke({ width: 1.5, color: theme.color.fx.dust, alpha: (1 - k) * 0.9, cap: 'round' });
    }).then(() => g.destroy());
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
  async beginShot(attacker: Piece, target: Piece, kind: 'ranged' | 'magic', via?: { from: Cell; to: Cell }): Promise<void> {
    this.clearShot();
    const a = this.centerOf(attacker);
    const t = this.centerOf(target);
    const mid = (c: Cell) => ({ x: (c.x + 0.5) * CELL_SIZE, y: (c.y + 0.5) * CELL_SIZE });
    // Attraverso una scala la linea è fatta di due tratti (dall'attaccante alla sua scala, e dall'altra scala al bersaglio): in mezzo il dardo salta.
    const pairs = via ? [[a, mid(via.from)], [mid(via.to), t]] : [[a, t]];
    const segs = pairs.map(([p, q]) => ({ a: p, b: q, len: Math.hypot(q.x - p.x, q.y - p.y) })).filter((sg) => sg.len > 1);
    const total = segs.reduce((n, sg) => n + sg.len, 0);
    const color = kind === 'magic' ? theme.color.fx.magic : theme.color.fx.ranged;
    const g = new Graphics();
    const proj = new Graphics();
    this.fx.addChild(g, proj);
    this.shot = { g, proj, segs, total, color, target };
    if (!total) {
      await this.pulse(attacker); // i due sono sulle scale (nessun tratto da disegnare): un guizzo dell'attaccante
      return;
    }
    await this.animate(FX.lineMs, (k) => this.drawAim(1 - Math.pow(1 - k, 2)));
    await this.animate(FX.shotMs, (k) => this.drawBolt(FX.shotStop * (1 - Math.pow(1 - k, 2))));
  }

  /** Un guizzo dell'attaccante (si ingrandisce e torna): l'attacco fra due pedine sulle scale, o senza linea da disegnare. */
  pulse(piece: Piece): Promise<void> {
    const view = this.views.get(piece.id);
    if (!view) return Promise.resolve();
    return this.animate(FX.lungeMs * 2, (k) => { view.root.scale.set(1 + 0.25 * Math.sin(Math.PI * k)); }).then(() => { view.root.scale.set(1); });
  }

  /** Attacco in mischia attraverso una scala (le due pedine sono lontane): l'attaccante guizza, poi l'urto sul bersaglio (`onImpact`) che trema. */
  async strikeThrough(attacker: Piece, target: Piece, hit: boolean, onImpact?: () => void): Promise<void> {
    await this.pulse(attacker);
    onImpact?.();
    if (hit) await this.shake(target);
  }

  /** Il punto a distanza `u` (in pixel) lungo i tratti del tiro, e quale tratto. */
  private posAt(u: number): { x: number; y: number; i: number } {
    const s = this.shot!;
    let rest = Math.max(0, u);
    for (let i = 0; i < s.segs.length; i++) {
      const sg = s.segs[i];
      if (rest <= sg.len || i === s.segs.length - 1) {
        const f = Math.min(1, rest / sg.len);
        return { x: sg.a.x + (sg.b.x - sg.a.x) * f, y: sg.a.y + (sg.b.y - sg.a.y) * f, i };
      }
      rest -= sg.len;
    }
    return { x: 0, y: 0, i: 0 };
  }

  /** La linea di mira tratteggiata, disegnata fino alla frazione `f` (0-1) del percorso. */
  private drawAim(f: number) {
    const s = this.shot;
    if (!s) return;
    s.g.clear();
    let left = s.total * f; // quanta linea si disegna in tutto, tratto dopo tratto
    for (const sg of s.segs) {
      const end = Math.min(sg.len, left);
      const ux = (sg.b.x - sg.a.x) / sg.len;
      const uy = (sg.b.y - sg.a.y) / sg.len;
      for (let d = 0; d < end; d += FX.dashPx + FX.gapPx) {
        const e = Math.min(end, d + FX.dashPx);
        s.g.moveTo(sg.a.x + ux * d, sg.a.y + uy * d).lineTo(sg.a.x + ux * e, sg.a.y + uy * e);
      }
      left -= sg.len;
      if (left <= 0) break;
    }
    s.g.stroke({ width: 2, color: theme.color.linePrimary, alpha: FX.lineAlpha });
  }

  /** Il dardo: la punta piena alla frazione `f` del percorso e dietro una scia che diventa sempre più trasparente fino a sparire. */
  private drawBolt(f: number) {
    const s = this.shot;
    if (!s) return;
    if (!s.total) return;
    const head = s.total * f;
    const tail = Math.min(FX.trailPx, head);
    s.proj.clear();
    const parts = FX.trailParts;
    for (let i = 0; i < parts; i++) {
      // dalla punta (i = 0, opaca) verso la coda (trasparente); la scia non attraversa il salto fra due scale
      const p0 = this.posAt(head - (tail * i) / parts);
      const p1 = this.posAt(head - (tail * (i + 1)) / parts);
      if (p0.i !== p1.i) continue;
      const alpha = 1 - i / parts;
      s.proj.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y).stroke({ width: 3, color: s.color, alpha, cap: 'butt' });
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

  /** Le pedine che un evento toglie dalla mappa svaniscono come quelle sconfitte, ma senza il rosso. */
  withdraw(list: readonly Piece[]) {
    for (const m of list) {
      this.withdrawn.add(m.id);
      this.dyingPieces.set(m.id, m);
      this.dying.set(m.id, 0);
    }
    this.refresh();
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
    const border = p.team === 'monster' ? (p.enhanced && !p.stone ? c.danger : c.token.idle) : active ? c.accentActive : c.token.idle; // rosso solo per i mostri potenziati
    this.shape(view.base.clear(), a, b).fill(c.token.fill);
    // Senza immagine, un segnaposto al posto del ritratto.
    if (!view.portrait) this.shape(view.base, a * 0.62, b * 0.62).fill(c.token.portrait);
    else {
      view.portrait.alpha = p.team === 'hero' && !active ? theme.alpha.portraitIdle : 1; // gli eroi non attivi più tenui
      view.portrait.filters = p.stone ? [this.stoneFilter] : []; // aspetto di pietra: immagine senza colore
      const tex = view.portrait.texture;
      // Un'immagine allungata (la salamandra è in verticale) ruota di 90° quando la pedina è girata dall'altra parte, e copre tutta la forma.
      const fit = fitPortrait(tex.width, tex.height, a, b);
      view.portrait.rotation = fit.rotation;
      view.portrait.scale.set(fit.scale);
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
    if (interactionsOn(this.state, p.id).length) {
      // Si può interagire con questa pedina (evento "interagisce"): un cerchietto con il "?" in alto a sinistra.
      const r = 9;
      const x = -a + r;
      const y = -b + r;
      const dot = new Graphics().circle(x, y, r).fill(theme.color.accentActive).stroke({ width: 1, color: theme.color.token.fill });
      const mark = new Text({ text: '?', style: { fontFamily: 'sans-serif', fontSize: 12, fontWeight: '700', fill: 0x111111 } });
      mark.anchor.set(0.5);
      mark.position.set(x, y);
      view.badges.addChild(dot, mark);
    }
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
    const lost = !this.withdrawn.has(p.id); // chi è tolto da un evento sfuma senza diventare rosso
    const to = c.danger;
    this.shape(view.base.clear(), a, b).fill(lost ? mix(c.token.fill, to) : c.token.fill);
    this.shape(view.ring.clear(), a, b).stroke({ width: LINE.strong, color: p.stone ? c.token.idle : lost ? mix(c.accentActive, to) : c.token.idle });
    if (view.portrait && lost) view.portrait.tint = mix(0xffffff, to);
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
    const from = m.piece.cell;
    const step = m.steps[m.index];
    const to = step.cell;
    const travel = step.kind === 'travel' || step.kind === 'stairs'; // sfuma da un capo e riappare all'altro
    // Un salto copre più caselle in un passo: dura di più, così la velocità resta quella normale.
    const span = step.kind === 'jump' ? Math.max(1, Math.abs(to.x - from.x), Math.abs(to.y - from.y)) : 1;
    const dur = (travel ? GLYPH_TRAVEL_MS : PAWN_STEP_MS) * span;
    // Mentre supera un ostacolo la pedina si ingrandisce (arco) e a metà strada rallenta un attimo, poi riprende grandezza e velocità normali.
    const arc = m.arcs?.[m.index] ?? null;
    const g0 = arc ? arc.from + (arc.to - arc.from) * Math.min(1, m.elapsed / dur) : 0;
    m.elapsed += arc ? deltaMs / (1 + FX.jumpSlow * Math.sin(Math.PI * g0)) : deltaMs;
    const k = Math.min(1, m.elapsed / dur);
    const root = this.views.get(m.piece.id)!.root;
    if (arc) root.scale.set(1 + (FX.jumpScale - 1) * Math.sin(Math.PI * (arc.from + (arc.to - arc.from) * k)));
    if (travel) {
      // Viaggio da glifo a glifo: sfuma sul glifo di partenza e riappare su quello di arrivo.
      const at = k < 0.5 ? from : to;
      root.position.set((at.x + 0.5) * CELL_SIZE, (at.y + 0.5) * CELL_SIZE);
      root.alpha = Math.abs(1 - 2 * k);
    } else {
      // Dal centro della sagoma di adesso al centro di quella dopo il passo (un mostro grande ha più caselle e può cambiare forma).
      const size = step.size ?? m.piece.size;
      const c0 = this.centerOf(m.piece);
      const c1 = { x: (to.x + size.w / 2) * CELL_SIZE, y: (to.y + size.h / 2) * CELL_SIZE };
      root.position.set(c0.x + (c1.x - c0.x) * k, c0.y + (c1.y - c0.y) * k);
    }
    if (k < 1) return;

    if (travel) root.alpha = 1;
    const landed = !!arc && arc.to >= 1;
    if (landed) root.scale.set(1); // atterrato: scala normale
    const before = { cell: m.piece.cell, size: m.piece.size };
    const outcome = act.applyStep(this.state, this.board!, m.piece, step);
    if (step.size) this.drawPiece(m.piece); // la sagoma è cambiata: ridisegna la forma
    if (landed) this.landingBurst(m.piece); // la raggiera parte dalla casella di atterraggio (la pedina ormai è lì), non da quella di partenza
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
    const heroStop = (this.onStepped?.(m.piece, outcome) ?? false) && m.piece.team === 'hero'; // es. è comparso un mostro: ci si ferma qui (ai mostri non succede)
    const stop = heroStop || (m.piece.team === 'monster' && (this.onMonsterStep?.(m.piece, before) ?? false)); // un mostro si ferma se un eroe può usare la Vigilanza
    m.index++;
    m.elapsed = 0;
    if (stop || m.index >= m.steps.length) {
      root.scale.set(1);
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
      for (const r of this.reach.values()) if (!this.active || !act.stopForbidden(this.state, this.board, this.active, r.cell)) area.add(cellKey(r.cell));
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
