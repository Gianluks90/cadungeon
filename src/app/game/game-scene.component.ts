import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Application, Container } from 'pixi.js';
import {
  CELL_SIZE,
  CLICK_SLOP_PX,
  DEV_PLACEABLE_TILES,
  DOOR_HIT_TOLERANCE_CELLS,
  ICONS,
  OBSTACLE_VARIANTS,
  MAP_FIT_FILL,
  ZOOM_BUTTON_FACTOR,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_START,
  ZOOM_TRACKPAD_PINCH_BOOST,
  ZOOM_WHEEL_SENSITIVITY,
} from './constants';
import { onThemeChange, theme } from './theme';
import { Board, Cell } from './board/board';
import { Door, DoorSpan } from './board/door';
import { Obstacle, obstacleCells } from './board/obstacle';
import { ObstacleView } from './obstacles/obstacle-view';
import { DoorView } from './doors/door-view';
import { preloadIcons } from './icons/icon-loader';
import { Party } from './party';
import { Exploration } from './exploration';
import { VeilView } from './veil-view';
import { MarkerView } from './markers/marker-view';
import { ChestView } from './markers/chest-view';
import { PickupView } from './markers/pickup-view';
import { collectLoot, enterCell } from './markers/marker-rules';
import { Marker } from './board/marker';
import { DotGrid } from './dot-grid';
import { PlacedTile, loadMap } from './map/map-data';
import { MapBounds, mapBounds } from './map/map-view';
import { TilePlacer } from './map/tile-placer';
import { loadTileDef, tileCells } from './map/tile';
import { PiecesController } from './pieces/pieces-controller';
import { Piece, createPieces } from './pieces/piece';
import { loadPortraits } from './pieces/portraits';

type Point = { x: number; y: number };

/** I nomi dei colori delle chiavi runiche, per gli avvisi. */
const RUNE_NAMES = { red: 'rossa', blue: 'blu', green: 'verde' } as const;

type Mode = 'play' | 'tiles' | 'doors' | 'obstacles';

const HINTS: Record<Mode, string> = {
  play: 'Clic: muovi / scegli eroe / porta · Spazio: nuovo round · P: tile · D: porte · O: ostacoli',
  tiles: 'R ruota · T cambia tile · clic piazza · Backspace annulla · P: torna a giocare',
  doors: 'Clic: piazza o togli una porta · D: torna a giocare',
  obstacles: 'R ruota · T cambia ostacolo · clic piazza o togli · O: torna a giocare',
};

@Component({
  selector: 'app-game-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #host class="host"></div>
    <p class="notice">{{ notice() }}</p>
    <p class="hud">{{ movement() }}</p>
    <p class="hint">{{ hint() }}</p>
    <div class="zoom-buttons">
      <button type="button" aria-label="Zoom avanti" (click)="zoomByButton(1)">+</button>
      <button type="button" aria-label="Zoom indietro" (click)="zoomByButton(-1)">−</button>
    </div>
  `,
  styles: `
    :host { position: fixed; inset: 0; display: block; overflow: hidden; }
    .host { position: absolute; inset: 0; touch-action: none; }
    .hint {
      position: absolute; left: 16px; bottom: 16px; margin: 0;
      font: 12px/1 system-ui, sans-serif; color: var(--cad-ui-text-muted, #8a8178); opacity: 0.45;
      pointer-events: none; user-select: none;
    }
    .notice {
      position: absolute; left: 16px; bottom: 58px; margin: 0;
      font: 13px/1 system-ui, sans-serif; color: var(--cad-notice, #e0a040); opacity: 0.9;
      pointer-events: none; user-select: none;
    }
    .hud {
      position: absolute; left: 16px; bottom: 36px; margin: 0;
      font: 13px/1 system-ui, sans-serif; color: var(--cad-ui-text, #d8cfc4); opacity: 0.8;
      pointer-events: none; user-select: none;
    }
    .zoom-buttons {
      position: absolute; right: 16px; bottom: 16px;
      display: flex; flex-direction: column; gap: 6px;
    }
    button {
      width: 32px; height: 32px; padding: 0;
      font: 18px/1 system-ui, sans-serif; color: var(--cad-ui-text-muted, #8a8178);
      background: color-mix(in srgb, var(--cad-bg, #0c0a08) 60%, transparent);
      border: 1px solid var(--cad-ui-border, #3a352f); border-radius: 6px;
      cursor: pointer; opacity: 0.6;
      transition: opacity 0.15s, color 0.15s;
    }
    button:hover, button:focus-visible { opacity: 1; color: var(--cad-ui-text, #d8cfc4); }
  `,
})
export class GameSceneComponent implements OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly hostRef = viewChild.required<ElementRef<HTMLDivElement>>('host');

  private app?: Application;
  private world?: Container; // qui dentro andranno tile e pedine
  private placer?: TilePlacer; // strumento di sviluppo: piazza tile agganciandoli
  private pieces?: PiecesController;
  private placed: PlacedTile[] = []; // i tile della mappa (lo strumento di piazzamento ne aggiunge)
  private mode: Mode = 'play';
  private board?: Board;
  private doors: Door[] = [];
  private doorView?: DoorView;
  private obstacles: Obstacle[] = [];
  private markers: Marker[] = [];
  private markerView?: MarkerView;
  private chestView?: ChestView;
  private pickupView?: PickupView;
  private party = new Party();
  /** Cosa il gruppo ha visto (vale per tutti gli eroi insieme). */
  private exploration = new Exploration();
  private veil?: VeilView;
  private pieceList: Piece[] = [];
  private obstacleView?: ObstacleView;
  private obstacleVariant = 0; // quale tipo e lunghezza si sta piazzando
  private obstacleVertical = false;
  private noticeTimer?: ReturnType<typeof setTimeout>;
  protected readonly hint = signal(HINTS.play);
  protected readonly movement = signal('');
  protected readonly notice = signal('');
  private dots?: DotGrid;
  private destroyed = false;
  private cleanup: Array<() => void> = [];

  // Camera: dove cade l'origine del mondo sullo schermo (pixel CSS) e quanto è ingrandito.
  private camX = 0;
  private camY = 0;
  private zoom = ZOOM_START;

  // Dita/mouse attualmente premuti (per pan e pinch).
  private pointers = new Map<number, Point>();
  private lastPinchDistance = 0;
  private mouse: Point | null = null; // ultima posizione del mouse sul canvas
  private downPos: Point | null = null; // dove è stato premuto il tasto, per distinguere clic e trascinamento

  constructor() {
    afterNextRender(() => {
      // Pixi lavora fuori da Angular, così i suoi eventi non scatenano controlli inutili.
      this.zone.runOutsideAngular(() => this.start());
    });
  }

  private async start() {
    const host = this.hostRef().nativeElement;
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: theme.color.background,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      preference: 'webgl',
    });
    if (this.destroyed) {
      app.destroy(true);
      return;
    }
    this.app = app;
    host.appendChild(app.canvas);

    this.dots = new DotGrid();
    // Al cambio di tema si ridisegna tutto (oggi c'è un solo tema, ma la struttura resta).
    this.cleanup.push(onThemeChange(() => this.applyTheme()));
    this.world = new Container();
    app.stage.addChild(this.dots.mesh, this.world);

    // All'inizio l'origine del mondo sta al centro dello schermo.
    this.camX = app.screen.width / 2;
    this.camY = app.screen.height / 2;
    this.applyCamera();

    // Mappa di prova: tile piazzati a mano (public/maps/prova.json).
    // Con ?mappa=catalogo si apre la mappa che mostra tutti i tile del catalogo.
    const mapName = new URLSearchParams(location.search).get('mappa')?.replace(/[^a-z0-9-]/g, '') || 'prova';
    await preloadIcons([ICONS.doorKey, ICONS.doorRune, ICONS.potion, ICONS.coins, ICONS.runeKey, ICONS.keyPickup]); // le icone delle porte e della pozione; quelle che mancano usano una forma di riserva
    try {
      const { data, placed } = await loadMap(`maps/${mapName}.json`);
      const defs = await Promise.all(DEV_PLACEABLE_TILES.map(loadTileDef));
      if (this.destroyed) return;
      const mapLayer = new Container();
      const pawnLayer = new Container();
      this.doorView = new DoorView();
      this.obstacleView = new ObstacleView(data.seed);
      this.veil = new VeilView();
      this.markerView = new MarkerView(data.seed);
      this.chestView = new ChestView();
      this.pickupView = new PickupView();
      // Il velo sta sopra mappa, ostacoli e porte (così li spegne se non sono ancora esplorati) e sotto le pedine.
      this.world.addChild(mapLayer, this.markerView.container, this.chestView.container, this.pickupView.container, this.obstacleView.container, this.doorView.container, this.veil.graphics, pawnLayer);
      this.placed = placed;
      this.doors = data.doors ?? [];
      this.party = new Party(data.party);
      this.obstacles = data.obstacles ?? [];
      this.markers = data.markers ?? [];
      this.placer = new TilePlacer(data.seed, placed, defs, mapLayer);
      // La cella di un glifo è liscia: niente crepe né altri dettagli ambientali.
      this.placer.setNoCrackCells(new Set(this.markers.map((m) => `${m.x},${m.y}`)));
      // Pedine dalla mappa; senza, parte un solo eroe al centro del primo tile.
      const start = this.startCell(placed);
      const pieces = createPieces(
        data.pieces ?? [{ id: 'h1', name: 'Eroe 1', team: 'hero', x: start.x, y: start.y }],
      );
      this.pieceList = pieces;
      const portraits = await loadPortraits(pieces.map((p) => p.portrait));
      this.pieces = new PiecesController(
        pawnLayer,
        app.ticker,
        pieces,
        (a) => this.movement.set(a ? `${a.name} · Movimento ${a.points} / ${a.speed} · Ferite ${a.wounds} / ${a.maxWounds}` : ''),
        (text) => this.showNotice(text),
        portraits,
      );
      // Dopo ogni passo di un eroe si ricalcola cosa vede il gruppo; se compare un mostro, il movimento si ferma.
      this.markerView!.stateProvider = () => this.glyphState();
      this.pieces.onStepped = (piece) => {
        // Entrando in una casella un eroe può accendere un glifo o raccogliere un oggetto (anche solo passandoci sopra).
        const event = this.board ? enterCell(this.board, piece, this.party) : null;
        if (event) {
          this.showNotice(event.notice);
          if (event.kind === 'picked-up') this.pickupView?.redraw(this.board!, (m) => !this.fogOn() || this.exploration.markers.has(m));
        }
        return this.exploreAndNotify();
      };
      this.rebuildBoard();
      this.fitToBounds(mapBounds(placed));
    } catch (err) {
      console.error('Impossibile caricare la mappa di prova', err);
    }

    // Quando la finestra cambia, il punto al centro resta al centro.
    app.renderer.on('resize', (w: number, h: number) => {
      this.camX += (w - this.lastW) / 2;
      this.camY += (h - this.lastH) / 2;
      this.applyCamera();
    });
    this.lastW = app.screen.width;
    this.lastH = app.screen.height;

    app.ticker.add((t) => {
      this.doorView?.tick(t.deltaMS);
      this.veil?.tick(t.deltaMS);
      this.markerView?.tick(performance.now(), t.deltaMS);
      this.chestView?.tick(t.deltaMS);
      this.obstacleView?.tick(t.deltaMS);
    });
    this.bindInput(app.canvas);
  }

  private lastW = 0;
  private lastH = 0;

  /** Il tema è cambiato: sfondo, puntini, mappa, porte, ostacoli e pedine riprendono i colori nuovi. */
  private applyTheme() {
    if (!this.app) return;
    this.app.renderer.background.color = theme.color.background;
    this.dots?.applyTheme();
    this.placer?.refresh();
    this.pieces?.applyTheme();
    if (this.board) this.rebuildBoard();
  }

  private applyCamera() {
    const app = this.app!;
    this.world!.position.set(this.camX, this.camY);
    this.world!.scale.set(this.zoom);
    this.refreshHover();
    this.dots!.update(app.screen.width, app.screen.height, this.camX, this.camY, this.zoom, app.renderer.resolution);
    this.lastW = app.screen.width;
    this.lastH = app.screen.height;
  }

  /** La casella da cui parte la pedina: al centro del primo tile. */
  private startCell(placed: PlacedTile[]): Cell {
    const t = placed[0];
    const centre = { x: t.x + Math.floor(t.def.size.w / 2), y: t.y + Math.floor(t.def.size.h / 2) };
    if (tileCells(t.def).has(`${centre.x - t.x},${centre.y - t.y}`)) return centre;
    const [cx, cy] = [...tileCells(t.def)][0].split(',').map(Number);
    return { x: t.x + cx, y: t.y + cy };
  }

  /** Posizione di un punto dello schermo, in celle (con la parte decimale). */
  private toCells(p: Point): Point {
    const scale = this.zoom * CELL_SIZE;
    return { x: (p.x - this.camX) / scale, y: (p.y - this.camY) / scale };
  }

  /** Ricostruisce le regole della mappa (dopo che tile o porte sono cambiati) e ridisegna le porte. */
  private rebuildBoard() {
    this.board = new Board(this.placed, this.doors, this.obstacles, this.markers);
    this.pieces?.setBoard(this.board);
    this.exploration.update(this.board, this.pieceList); // quello che si vede subito, senza animazione
    this.applyVisibility();
  }

  /** Giocando si vede solo ciò che gli eroi hanno visto; negli strumenti di piazzamento si vede tutto, perché l'autore deve poter lavorare. */
  private fogOn(): boolean {
    return this.mode === 'play';
  }

  /** Ridisegna ostacoli, porte, velo e mostri secondo ciò che è rivelato. */
  private applyVisibility() {
    const board = this.board;
    if (!board) return;
    const fog = this.fogOn();
    this.obstacleView?.redraw(board, fog ? (o) => this.exploration.obstacles.has(o) : undefined);
    this.doorView?.redraw(board, fog ? (d) => this.exploration.doors.has(d) : undefined);
    this.markerView?.redraw(board, fog ? (m) => this.exploration.markers.has(m) : undefined);
    this.chestView?.redraw(board, fog ? (m) => this.exploration.markers.has(m) : undefined);
    this.pickupView?.redraw(board, fog ? (m) => this.exploration.markers.has(m) : undefined);
    this.veil?.setState(board, fog ? this.exploration.cells : null);
    this.pieces?.setVisibleMonsters(fog ? this.exploration.monsters : null);
    this.pieces?.setKnownMarkers(fog ? this.exploration.markers : null); // si viaggia solo verso glifi già scoperti
  }

  /** Per i glifi: quali sono destinazioni di un viaggio e quali hanno una pedina sopra. */
  private glyphState() {
    const occupied = new Set<Marker>();
    for (const p of this.pieceList) {
      const m = this.board?.markerAt(p.cell);
      if (m) occupied.add(m);
    }
    return { destinations: this.pieces?.travelDestinations() ?? new Set<Marker>(), occupied };
  }

  /**
   * Ricalcola cosa vede il gruppo e mostra le novità: il velo svanisce sulle caselle nuove, compaiono ostacoli, porte
   * e mostri rivelati. Restituisce true se è comparso un mostro (chi si sta muovendo deve fermarsi).
   */
  private exploreAndNotify(): boolean {
    if (!this.board || !this.fogOn()) return false;
    const r = this.exploration.update(this.board, this.pieceList);
    if (r.obstacles.length || r.doors.length || r.markers.length) {
      this.obstacleView?.redraw(this.board, (o) => this.exploration.obstacles.has(o));
      this.doorView?.redraw(this.board, (d) => this.exploration.doors.has(d));
      this.markerView?.redraw(this.board, (m) => this.exploration.markers.has(m));
      this.chestView?.redraw(this.board, (m) => this.exploration.markers.has(m));
      this.pickupView?.redraw(this.board, (m) => this.exploration.markers.has(m));
    }
    this.veil?.reveal(r.cells);
    if (r.monsters.length) {
      this.pieces?.setVisibleMonsters(this.exploration.monsters);
      this.pieces?.revealMonsters(r.monsters.map((m) => m.id));
      this.showNotice(`Compare: ${r.monsters.map((m) => m.name).join(', ')}`);
    }
    return r.monsters.length > 0;
  }

  /** Dice a chi ne ha bisogno dove si trova il mouse (niente durante il trascinamento). */
  private refreshHover() {
    const cell = this.mouse && this.pointers.size === 0 ? this.toCells(this.mouse) : null;
    this.placer?.setHover(this.mode === 'tiles' ? cell : null);
    this.pieces?.hover(this.mode === 'play' && cell ? { x: Math.floor(cell.x), y: Math.floor(cell.y) } : null);
    this.doorView?.setPreview(null);
    this.obstacleView?.setPreview(null);
    if (this.mode === 'obstacles' && cell) {
      const o = this.obstacleCandidate({ x: Math.floor(cell.x), y: Math.floor(cell.y) });
      this.obstacleView?.setPreview(o, this.canPlace(o));
    }
    if (this.mode === 'doors' && cell) {
      const c = this.doorCandidate(cell);
      if (c) this.doorView?.setPreview(c.span, c.index >= 0, this.board!.hasJambPosts(c.span));
    }
  }

  /** Il lato di cella più vicino al puntatore su cui può stare una porta, con la porta (da muro a muro) che ci starebbe. */
  private doorCandidate(cell: Point): { span: DoorSpan; unit: number; index: number } | null {
    if (!this.board) return null;
    // Le due possibilità: la linea orizzontale più vicina e la verticale più vicina; si prova prima la più vicina.
    const options = [
      { horizontal: true, line: Math.round(cell.y), unit: Math.floor(cell.x), dist: Math.abs(cell.y - Math.round(cell.y)) },
      { horizontal: false, line: Math.round(cell.x), unit: Math.floor(cell.y), dist: Math.abs(cell.x - Math.round(cell.x)) },
    ].sort((a, b) => a.dist - b.dist);
    for (const o of options) {
      const span = this.board.spanAt(o.horizontal, o.line, o.unit);
      if (span) return { span, unit: o.unit, index: this.board.doorIndexAt(o.horizontal, o.line, o.unit) };
    }
    return null;
  }

  /** L'ostacolo che si piazzerebbe con la cella `c` come prima casella: tipo, lunghezza e rotazione correnti. */
  private obstacleCandidate(c: Point): Obstacle {
    const v = OBSTACLE_VARIANTS[this.obstacleVariant];
    return { type: v.type, length: v.length, x: c.x, y: c.y, vertical: this.obstacleVertical || undefined };
  }

  /** Si può piazzare qui? Serve che stia sui tile, senza altri ostacoli e senza pedine sopra. */
  private canPlace(o: Obstacle): boolean {
    return !!this.board?.canPlaceObstacle(o) && !obstacleCells(o).some((c) => this.pieces?.isOccupied(c));
  }

  /** Clic in modalità "ostacoli": toglie l'ostacolo che c'è, oppure ne mette uno nuovo. */
  private obstaclesClick(p: Point) {
    const c = this.toCells(p);
    const cell = { x: Math.floor(c.x), y: Math.floor(c.y) };
    const existing = this.board?.obstacleAt(cell);
    if (existing) this.obstacles.splice(this.obstacles.indexOf(existing), 1);
    else {
      const o = this.obstacleCandidate(cell);
      if (!this.canPlace(o)) return;
      this.obstacles.push(o);
    }
    this.rebuildBoard();
    this.refreshHover();
  }

  /** Cambia modalità: tornando a "gioco" i tile e le porte appena piazzati diventano parte della mappa. */
  private setMode(mode: Mode) {
    this.mode = this.mode === mode ? 'play' : mode;
    this.hint.set(HINTS[this.mode]);
    this.pieces?.setEnabled(this.mode === 'play');
    if (this.mode === 'play') this.rebuildBoard();
    else this.applyVisibility(); // negli strumenti di piazzamento si vede tutto
    this.refreshHover();
  }

  /** Un messaggio breve in basso a sinistra, che sparisce da solo. */
  private showNotice(text: string) {
    this.notice.set(text);
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.notice.set(''), 2600);
  }

  /** Clic in modalità "gioco": una porta vicino al clic si apre o chiude, altrimenti si muove la pedina. */
  private playClick(p: Point) {
    const c = this.toCells(p);
    let door = this.board?.doorNear(c, DOOR_HIT_TOLERANCE_CELLS) ?? -1;
    if (door >= 0 && !this.exploration.doors.has(this.board!.doors[door].door)) door = -1; // una porta mai vista non si può usare
    if (door < 0) {
      if (this.openChestAt({ x: Math.floor(c.x), y: Math.floor(c.y) })) return;
      this.pieces?.click({ x: Math.floor(c.x), y: Math.floor(c.y) });
      return;
    }
    const r = this.pieces?.useDoor(door, this.party);
    if (!r) return;
    if (r.code === 'opened' || r.code === 'closed' || r.code === 'unlocked' || r.code === 'picked') {
      this.doorView?.redraw(this.board!, (d) => this.exploration.doors.has(d)); // parte l'animazione dell'anta
      this.exploreAndNotify(); // aprire una porta può far vedere cose nuove
      if (r.code === 'unlocked') this.showNotice('Serratura aperta con la chiave');
      else if (r.code === 'picked') this.showNotice(`Serratura scassinata (${r.cost} punti movimento)`);
    } else if (r.code === 'far') this.showNotice('Per usare una porta serve una casella adiacente');
    else if (r.code === 'cost') this.showNotice(`Servono ${r.cost} punti movimento`);
    else if (r.code === 'needs-key') this.showNotice('Porta chiusa a chiave: serve la chiave giusta');
    else if (r.code === 'needs-rune') this.showNotice(`Serve la chiave runica ${RUNE_NAMES[r.color!]}`);
  }

  /** Clic sulla casella di uno scrigno su cui sta l'eroe attivo: lo apre. Restituisce true se il clic era per lo scrigno. */
  private openChestAt(cell: Cell): boolean {
    const active = this.pieces?.active;
    if (!active || active.cell.x !== cell.x || active.cell.y !== cell.y) return false;
    if (this.board?.markerAt(cell)?.type !== 'chest') return false;
    const r = this.pieces!.useChest();
    if (r.code === 'opened') {
      const found = collectLoot(this.party, r.contents ?? []);
      this.showNotice(['Scrigno aperto', ...found].join(' · '));
    } else if (r.code === 'already') this.showNotice('Lo scrigno è già aperto');
    else if (r.code === 'cost') this.showNotice(`Servono ${r.cost} punti movimento`);
    return true;
  }

  /** Clic in modalità "porte": toglie la porta che c'è, oppure ne mette una nuova. */
  private doorsClick(p: Point) {
    const cand = this.doorCandidate(this.toCells(p));
    if (!cand) return;
    if (cand.index >= 0) {
      this.doors.splice(this.doors.indexOf(this.board!.doors[cand.index].door), 1);
    } else {
      const { span, unit } = cand;
      this.doors.push({ x: span.horizontal ? unit : span.line, y: span.horizontal ? span.line : unit, horizontal: span.horizontal, open: false });
    }
    this.rebuildBoard();
    this.refreshHover();
  }

  /** Inquadra un'area (in pixel del mondo) al centro dello schermo, senza ingrandire oltre lo zoom iniziale. */
  private fitToBounds(b: MapBounds) {
    const app = this.app!;
    const fit = Math.min((app.screen.width * MAP_FIT_FILL) / b.w, (app.screen.height * MAP_FIT_FILL) / b.h);
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(fit, ZOOM_START)));
    this.camX = app.screen.width / 2 - (b.x + b.w / 2) * this.zoom;
    this.camY = app.screen.height / 2 - (b.y + b.h / 2) * this.zoom;
    this.applyCamera();
  }

  /** Zoom mantenendo fermo il punto sotto (px, py): è quello che "senti" sotto il dito o il mouse. */
  private zoomAt(px: number, py: number, newZoom: number) {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, newZoom));
    const k = z / this.zoom;
    this.camX = px - (px - this.camX) * k;
    this.camY = py - (py - this.camY) * k;
    this.zoom = z;
    this.applyCamera();
  }

  /** Tasti + e −: zoom attorno al centro dello schermo. */
  zoomByButton(direction: 1 | -1) {
    if (!this.app) return;
    const f = direction === 1 ? ZOOM_BUTTON_FACTOR : 1 / ZOOM_BUTTON_FACTOR;
    this.zoomAt(this.app.screen.width / 2, this.app.screen.height / 2, this.zoom * f);
  }

  private bindInput(canvas: HTMLCanvasElement) {
    const local = (e: PointerEvent | WheelEvent): Point => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const listen = <K extends keyof HTMLElementEventMap>(
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      canvas.addEventListener(type, fn as EventListener, options);
      this.cleanup.push(() => canvas.removeEventListener(type, fn as EventListener));
    };

    // Rotella (e pinch del trackpad, che arriva come rotella + ctrl).
    listen('wheel', (e) => {
      e.preventDefault();
      const p = local(e);
      const boost = e.ctrlKey ? ZOOM_TRACKPAD_PINCH_BOOST : 1;
      this.zoomAt(p.x, p.y, this.zoom * Math.exp(-e.deltaY * ZOOM_WHEEL_SENSITIVITY * boost));
    }, { passive: false });

    listen('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, local(e));
      this.downPos = this.pointers.size === 1 ? local(e) : null;
      if (this.pointers.size === 2) this.lastPinchDistance = this.pinchDistance();
    });

    listen('pointermove', (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const cur = local(e);

      if (this.pointers.size === 1) {
        // Un dito (o il mouse): trascina la mappa.
        this.camX += cur.x - prev.x;
        this.camY += cur.y - prev.y;
        this.pointers.set(e.pointerId, cur);
        this.applyCamera();
      } else if (this.pointers.size === 2) {
        // Due dita: zoom in base a quanto si allontanano, pan in base a come si spostano.
        const before = this.pinchCenter();
        this.pointers.set(e.pointerId, cur);
        const after = this.pinchCenter();
        this.camX += after.x - before.x;
        this.camY += after.y - before.y;
        const dist = this.pinchDistance();
        if (this.lastPinchDistance > 0) this.zoomAt(after.x, after.y, this.zoom * (dist / this.lastPinchDistance));
        else this.applyCamera();
        this.lastPinchDistance = dist;
      }
    });

    // Il mouse che passa sopra la scena: serve a mostrare il tile da agganciare.
    listen('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.mouse = local(e);
      this.refreshHover();
    });
    listen('pointerleave', () => {
      this.mouse = null;
      this.refreshHover();
    });

    const release = (e: PointerEvent) => {
      // Un clic (senza trascinare): muove la pedina, oppure piazza il tile agganciato.
      const p = local(e);
      const isClick =
        e.type === 'pointerup' && e.button === 0 && this.pointers.size === 1 &&
        this.downPos !== null && Math.hypot(p.x - this.downPos.x, p.y - this.downPos.y) < CLICK_SLOP_PX;
      this.pointers.delete(e.pointerId);
      this.lastPinchDistance = 0;
      this.downPos = null;
      if (e.pointerType === 'mouse') this.mouse = p;
      this.refreshHover(); // il tile da agganciare torna visibile appena il tasto è rilasciato
      if (isClick) {
        if (this.mode === 'play') this.playClick(p);
        else if (this.mode === 'doors') this.doorsClick(p);
        else if (this.mode === 'obstacles') this.obstaclesClick(p);
        else if (e.pointerType === 'mouse') this.placer?.place();
      }
    };
    listen('pointerup', release);
    listen('pointercancel', release);

    // Tastiera: P cambia modalità; poi i tasti dipendono dalla modalità.
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'p') this.setMode('tiles');
      else if (key === 'd') this.setMode('doors');
      else if (key === 'o') this.setMode('obstacles');
      else if (this.mode === 'obstacles') {
        if (key === 'r') this.obstacleVertical = !this.obstacleVertical;
        else if (key === 't') this.obstacleVariant = (this.obstacleVariant + 1) % OBSTACLE_VARIANTS.length;
        this.refreshHover();
      } else if (this.mode === 'tiles') {
        if (key === 'r') this.placer?.rotate();
        else if (key === 't') this.placer?.nextTile();
        else if (key === 'backspace') this.placer?.undo();
      } else if (key === ' ') {
        e.preventDefault();
        this.pieces?.newTurn();
      }
    };
    window.addEventListener('keydown', onKey);
    this.cleanup.push(() => window.removeEventListener('keydown', onKey));
  }

  private pinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private pinchCenter(): Point {
    const [a, b] = [...this.pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  ngOnDestroy() {
    this.destroyed = true;
    clearTimeout(this.noticeTimer);
    this.cleanup.forEach((fn) => fn());
    this.app?.destroy(true, { children: true });
  }
}
