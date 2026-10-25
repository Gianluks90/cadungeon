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
  CAMERA_CENTER_MS,
  CAMERA_FOCUS_ZOOM,
  CAMERA_FOLLOW_SMOOTH_MS,
  CELL_SIZE,
  CLICK_SLOP_PX,
  DEV_PLACEABLE_TILES,
  ICONS,
  OBSTACLE_VARIANTS,
  PAWN_RADIUS_RATIO,
  MAP_FIT_FILL,
  ZOOM_BUTTON_FACTOR,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_START,
  ZOOM_TRACKPAD_PINCH_BOOST,
  ZOOM_WHEEL_SENSITIVITY,
} from './constants';
import { onThemeChange, readTokens, theme } from './theme';
import { Board, Cell } from './board/board';
import { DoorSpan, RuneColor } from './board/door';
import { Obstacle, obstacleCells } from './board/obstacle';
import { ObstacleView } from './obstacles/obstacle-view';
import { DoorView } from './doors/door-view';
import { preloadIcons } from './icons/icon-loader';
import { GameState } from './state/game-state';
import { VeilView } from './veil-view';
import { MarkerView } from './markers/marker-view';
import { ChestView } from './markers/chest-view';
import { StairsView } from './markers/stairs-view';
import { stairsWalls } from './markers/stairs-walls';
import { PickupView } from './markers/pickup-view';
import { ActionChange, ContextAction, armorOf, contextActions, explore, inventoryOf, speedOf } from './state/actions';
import * as cityRules from './state/city';
import { CityEvent } from '../ui/city-panel.component';
import { PanelKind } from '../ui/hero-panel.component';
import { POTION_NAMES } from './markers/marker-rules';
import { HeroAction, Piece } from './pieces/piece';
import { PillComponent } from '../ui/pill.component';
import { LogoButtonComponent } from '../ui/logo-button.component';
import { CompassComponent } from '../ui/compass.component';
import { ZoomControlsComponent } from '../ui/zoom-controls.component';
import { ContextMenuComponent } from '../ui/context-menu.component';
import { Toast, ToastsComponent } from '../ui/toasts.component';
import { BarMember, PartyBarComponent } from '../ui/party-bar.component';
import { HeroDetails } from '../ui/hero-sheet.component';
import { Marker, PotionKind, Stairs } from './board/marker';
import { DotGrid } from './dot-grid';
import { PlacedTile, loadMap } from './map/map-data';
import { HelpPanelComponent } from '../ui/help-panel.component';
import { MapBounds, mapBounds } from './map/map-view';
import { TilePlacer } from './map/tile-placer';
import { loadTileDef, tileCells } from './map/tile';
import { PiecesController } from './pieces/pieces-controller';
import { loadPortraits } from './pieces/portraits';
import { loadHeroSheets } from './heroes/hero-sheet';
import { loadItemCatalog, loadShopStock } from './items/item';
import { loadSkillCatalog } from './skills/skill';

type Point = { x: number; y: number };

/** I nomi dei colori delle chiavi runiche, per gli avvisi. */
const RUNE_NAMES = { red: 'rossa', blue: 'blu', green: 'verde' } as const;

/** Cosa dire quando un'azione in città non va a buon fine. */
const CITY_TEXTS: Record<string, string> = {
  soon: 'Presto disponibile', late: 'Devi tornare nel dungeon', coins: 'Non hai abbastanza monete', full: 'Non hai posto', 'sold-out': 'Esaurito', stock: 'Esaurito', already: 'Hai già scelto un servizio',
  'full-health': 'Sei già in piena salute', 'not-yet': 'Potrai tornare nel dungeon al prossimo turno', occupied: 'Quel glifo non è libero', busy: 'Ora non puoi',
  'wrong-service': 'Prima scegli questo servizio', maxed: 'Hai già il massimo di dadi', locked: 'Apri prima uno scrigno di quel tipo', none: 'Non hai questo oggetto', unknown: 'Non è possibile',
};

type Mode = 'play' | 'tiles' | 'doors' | 'obstacles';

const HINTS: Record<Mode, string> = {
  play: '', // i comandi di gioco stanno nel pannello "?"
  tiles: 'R ruota · T cambia tile · clic piazza · Backspace annulla · P: torna a giocare',
  doors: 'Clic: piazza o togli una porta · D: torna a giocare',
  obstacles: 'R ruota · T cambia ostacolo · clic piazza o togli · O: torna a giocare',
};

@Component({
  selector: 'app-game-scene',
  imports: [HelpPanelComponent, PillComponent, LogoButtonComponent, CompassComponent, ZoomControlsComponent, PartyBarComponent, ContextMenuComponent, ToastsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--footer-height]': "hint() ? '30px' : '0px'" },
  template: `
    <div #host class="host"></div>
    <app-compass />
    <app-help-panel />
    <app-toasts [toasts]="toasts()" />
    <app-context-menu [anchor]="contextAnchor()" [actions]="contextActions()" (chosen)="runContext($event)" (denied)="showNotice($event, 'warning')" />
    <div class="top">
      <app-logo-button />
      <app-pill primary icon="brightness_empty" label="Progresso" [value]="progress()" [class.alert]="defeated()" />
      <app-pill primary icon="autorenew" label="Round" [value]="round()" />
      <app-pill icon="tokens/gold_pile" label="Denaro" color="var(--cad-coin)" [attr.title]="'Monete di ' + coinsOwner()" [value]="coins()" />
      <app-pill icon="tokens/little_key" label="Chiavi" [value]="keys()" />
      @for (r of runes(); track r.color) {
        <app-pill icon="tokens/rune_key" [color]="'var(--cad-rune-' + r.color + ')'" [dim]="!r.owned" [attr.aria-label]="r.label" [attr.title]="r.label" />
      }
      @if (defeated()) { <app-pill icon="skull" label="Sconfitta" class="alert" /> }
    </div>
    <app-party-bar [members]="members()" [panel]="panel()" (selected)="selectFromBar($event)" (info)="togglePanel($event, 'info')" (inventory)="togglePanel($event, 'inventory')" (city)="togglePanel($event, 'city')" (cityAction)="onCityAction($event)" (denied)="showReason($event)" (sheetClosed)="panel.set(null)" (panelSwitch)="switchPanel($event)" (itemAction)="onItemAction($event)" />
    <!-- Footer temporaneo: tiene i comandi a schermo fuori dalla barra degli eroi. -->
    @if (hint()) { <footer class="footer keyboard-hints"><p class="hint">{{ hint() }}</p></footer> }
    <app-zoom-controls (zoom)="zoomByButton($event)" (center)="centerOnActive()" (fit)="showWholeMap()" />
  `,
  styles: `
    :host { position: fixed; inset: 0; display: block; overflow: hidden; }
    .host { position: absolute; inset: 0; touch-action: none; }
    .footer {
      position: absolute; z-index: 5; left: 0; right: 0; bottom: 0; box-sizing: border-box; overflow: hidden;
      height: calc(var(--footer-height) + env(safe-area-inset-bottom)); padding: 0 16px env(safe-area-inset-bottom);
      display: flex; align-items: center; justify-content: center; text-align: center;
      background: var(--c-surface); border-top: 1px solid var(--c-line-strong);
      pointer-events: none; user-select: none;
    }
    .hint { margin: 0; font: 12px/1.35 var(--font-ui); color: var(--c-text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .top { z-index: 10; position: absolute; top: calc(12px + env(safe-area-inset-top)); left: 12px; display: flex; flex-wrap: wrap; gap: 8px; pointer-events: none; }
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
  /** Lo stato della partita: porte, ostacoli, segnalini, pedine, gruppo, ciò che si è visto. */
  private state = GameState.empty();
  private get doors() { return this.state.doors; }
  private get obstacles() { return this.state.obstacles; }
  private get markers() { return this.state.markers; }
  private get party() { return this.state.party; }
  private get exploration() { return this.state.exploration; }
  private get pieceList() { return this.state.pieces; }
  private doorView?: DoorView;
  private markerView?: MarkerView;
  private chestView?: ChestView;
  private stairsView?: StairsView;
  private pickupView?: PickupView;
  private veil?: VeilView;
  private obstacleView?: ObstacleView;
  private obstacleVariant = 0; // quale tipo e lunghezza si sta piazzando
  private obstacleVertical = false;
  private toastId = 0;
  private readonly toastTimers = new Set<ReturnType<typeof setTimeout>>();
  protected readonly hint = signal(HINTS.play);
  protected readonly progress = signal(0);
  protected readonly round = signal(1);
  protected readonly defeated = signal(false);
  protected readonly keys = signal(0);
  /** Il denaro: ogni eroe ne ha questa quantità. */
  protected readonly coins = signal(0);
  protected readonly coinsOwner = signal('');
  /** Le chiavi runiche presenti nella partita (al massimo 3): colorate quando il gruppo le ha, altrimenti spente. */
  protected readonly runes = signal<{ color: RuneColor; owned: boolean; label: string }[]>([]);
  protected readonly members = signal<BarMember[]>([]);
  /** Il pannello aperto (informazioni o inventario) dal tab di un eroe, se ce n'è uno. */
  protected readonly panel = signal<{ id: string; kind: PanelKind } | null>(null);
  /** Un eroe in città sta scegliendo il glifo su cui tornare: i glifi possibili emettono l'onda e un clic su uno lo fa tornare. */
  private readonly returnMode = signal(false);
  private noGlyphFor = '';
  protected readonly toasts = signal<Toast[]>([]);
  protected readonly contextActions = signal<ContextAction[]>([]);
  /** Il punto sullo schermo appena sopra la pedina attiva, dove sta il bottone contestuale. */
  protected readonly contextAnchor = signal<{ x: number; y: number } | null>(null);
  private dots?: DotGrid;
  private destroyed = false;
  private cleanup: Array<() => void> = [];

  // Camera: dove cade l'origine del mondo sullo schermo (pixel CSS) e quanto è ingrandito.
  private camX = 0;
  private camY = 0;
  private zoom = ZOOM_START;
  private mapBox?: MapBounds;

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
    readTokens(); // i fogli di stile sono già caricati: rilegge i token per essere sicuri
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
    await preloadIcons([ICONS.doorKey, ICONS.doorRune, ICONS.potion, ICONS.runeKey, ICONS.keyPickup]); // le icone delle porte e della pozione; quelle che mancano usano una forma di riserva
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
      this.stairsView = new StairsView();
      this.pickupView = new PickupView(data.seed);
      this.pickupView.iconOf = (id) => this.state?.items.get(id)?.icon;
      // Il velo sta sopra mappa, ostacoli e porte (così li spegne se non sono ancora esplorati) e sotto le pedine.
      this.world.addChild(mapLayer, this.markerView.container, this.stairsView.container, this.chestView.container, this.pickupView.container, this.obstacleView.container, this.doorView.container, this.veil.graphics, pawnLayer);
      this.placed = placed;
      // Pedine dalla mappa; senza, parte un solo eroe al centro del primo tile.
      const start = this.startCell(placed);
      const sheets = await loadHeroSheets((data.pieces ?? []).map((p) => p.hero));
      const [items, shopStock, skills] = await Promise.all([loadItemCatalog(), loadShopStock('city'), loadSkillCatalog()]);
      this.state = GameState.fromMap(data, [{ id: 'h1', name: 'Eroe 1', team: 'hero', x: start.x, y: start.y }], sheets, items, shopStock, skills);
      this.placer = new TilePlacer(data.seed, placed, defs, mapLayer);
      // La cella di un glifo è liscia: niente crepe né altri dettagli ambientali.
      this.placer.setNoCrackCells(new Set(this.markers.map((m) => `${m.x},${m.y}`)));
      const portraits = await loadPortraits(this.state.pieces.map((p) => p.portrait));
      this.pieces = new PiecesController(
        pawnLayer,
        app.ticker,
        this.state,
        (a) => this.showHud(a),
        (text, icon) => this.showNotice(text, icon),
        portraits,
      );
      // Dopo ogni passo di un eroe si ricalcola cosa vede il gruppo; se compare un mostro, il movimento si ferma.
      this.markerView!.stateProvider = () => this.glyphState();
      this.pieces.onStepped = (_piece, outcome) => {
        // Entrando in una casella un eroe può aver acceso un glifo o raccolto un oggetto (anche solo passandoci sopra).
        const event = outcome.marker;
        if (event) {
          this.showNotice(event.notice, this.markerIcon(event.marker));
          if (event.kind === 'picked-up') this.pickupView?.redraw(this.board!, (m) => !this.fogOn() || this.exploration.markers.has(m));
        }
        return this.exploreAndNotify();
      };
      this.rebuildBoard();
      this.mapBox = mapBounds(placed);
      this.fitToBounds(this.mapBox);
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
      this.tickCameraTween(t.deltaMS);
      this.followMovingPawn(t.deltaMS);
      this.updateContextAnchor();
    });
    this.bindInput(app.canvas);
  }

  private lastW = 0;
  /** L'utente ha trascinato o zoomato durante un movimento: la camera non segue più la pedina fino alla fine del movimento. */
  private followSuppressed = false;
  /** Lo scorrimento in corso della camera verso l'eroe, con pan e zoom (si interrompe se l'utente trascina o zooma). */
  private camTween?: { fromZoom: number; toZoom: number; from: Point; to: Point; elapsed: number };
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
    explore(this.state, this.board); // quello che si vede subito, senza animazione
    this.applyVisibility();
    this.refreshContext();
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
    this.stairsView?.redraw(board, fog ? (m) => this.exploration.markers.has(m) : undefined);
    this.syncStairsWalls(board);
    this.pickupView?.redraw(board, fog ? (m) => this.exploration.markers.has(m) : undefined);
    this.veil?.setState(board, fog ? this.exploration.cells : null);
    this.pieces?.setVisibleMonsters(fog ? this.exploration.monsters : null);
    this.pieces?.setKnownMarkers(fog ? this.exploration.markers : null); // si viaggia solo verso glifi già scoperti
  }

  /** Quali scale hanno i muri già disegnati: si ridisegna la mappa solo quando ne compare una nuova. */
  private stairsDrawn = '';

  /** I muri delle scale si disegnano insieme a quelli dei tile, ma solo per le scale scoperte (non svelano dove sono). */
  private syncStairsWalls(board: Board) {
    const fog = this.fogOn();
    const shown = board.markers.filter((m): m is Stairs => m.type === 'stairs' && (!fog || this.exploration.markers.has(m)));
    const key = shown.map((s) => `${s.x},${s.y},${s.rotation ?? 0}`).join('|');
    if (key === this.stairsDrawn) return;
    this.stairsDrawn = key;
    this.placer?.setExtraWalls(stairsWalls(shown));
  }

  /** Per i glifi: quali sono destinazioni di un viaggio e quali hanno una pedina sopra. */
  private glyphState() {
    const occupied = new Set<Marker>();
    for (const p of this.pieceList) {
      const m = p.city ? undefined : this.board?.markerAt(p.cell);
      if (m) occupied.add(m);
    }
    // Chi è in città e sta scegliendo dove tornare: i glifi possibili emettono l'onda.
    const active = this.pieces?.active;
    const returning = this.returnMode() && active?.city ? new Set<Marker>(this.returnOptions().map((c) => c.marker)) : null;
    return { destinations: returning ?? this.pieces?.travelDestinations() ?? new Set<Marker>(), occupied };
  }

  /**
   * Ricalcola cosa vede il gruppo e mostra le novità: il velo svanisce sulle caselle nuove, compaiono ostacoli, porte
   * e mostri rivelati. Restituisce true se è comparso un mostro (chi si sta muovendo deve fermarsi).
   */
  private exploreAndNotify(): boolean {
    if (!this.board || !this.fogOn()) return false;
    const r = explore(this.state, this.board);
    if (r.obstacles.length || r.doors.length || r.markers.length) {
      this.obstacleView?.redraw(this.board, (o) => this.exploration.obstacles.has(o));
      this.doorView?.redraw(this.board, (d) => this.exploration.doors.has(d));
      this.markerView?.redraw(this.board, (m) => this.exploration.markers.has(m));
      this.chestView?.redraw(this.board, (m) => this.exploration.markers.has(m));
      this.stairsView?.redraw(this.board, (m) => this.exploration.markers.has(m));
      this.syncStairsWalls(this.board);
      this.pickupView?.redraw(this.board, (m) => this.exploration.markers.has(m));
    }
    this.veil?.reveal(r.cells);
    if (r.monsters.length) {
      this.pieces?.setVisibleMonsters(this.exploration.monsters);
      this.pieces?.revealMonsters(r.monsters.map((m) => m.id));
      this.showNotice(`Compare: ${r.monsters.map((m) => m.name).join(', ')}`, 'skull');
    }
    this.refreshContext(); // una porta appena vista può diventare un'azione
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
    this.refreshContext();
    this.refreshHover();
  }

  /** Aggiorna l'interfaccia (pillole in alto e barra degli eroi) da ciò che c'è nello stato. */
  private showHud(_active: Piece | null) {
    const s = this.state;
    this.progress.set(s.progress);
    this.round.set(s.round);
    this.defeated.set(s.status === 'defeat');
    this.keys.set(s.party.keys.size);
    const hero = s.pieces.find((p) => p.id === s.activeId && p.team === 'hero');
    this.coins.set(hero?.coins ?? 0); // il denaro è personale: la pillola mostra quello dell'eroe attivo
    this.coinsOwner.set(hero?.name ?? '');
    this.runes.set(s.runesInPlay().map((color) => ({ color, owned: s.party.runeKeys.has(color), label: `Chiave runica ${RUNE_NAMES[color]}${s.party.runeKeys.has(color) ? '' : ' (non ancora trovata)'}` })));
    const heroes: BarMember[] = s.pieces
      .filter((p) => p.team === 'hero')
      .map((p) => ({
        id: p.id,
        name: p.name,
        kind: 'hero',
        portrait: p.portrait,
        active: p.id === s.activeId && s.phase === 'heroes',
        done: p.done,
        wounds: p.wounds,
        maxWounds: p.maxWounds,
        points: p.points,
        fatigue: p.fatigue,
        armor: armorOf(s, p),
        potions: p.potions.length,
        inCity: !!p.city,
        cityPanel: !!p.city && !cityRules.cityView(s, p)?.mustReturn,
        action: p.action,
        details: {
          name: p.name, heroClass: p.heroClass, portrait: p.portrait, portraitFull: p.portraitFull, wounds: p.wounds, maxWounds: p.maxWounds, fatigue: p.fatigue,
          armor: armorOf(s, p), speed: speedOf(s, p), value: p.value, potions: [...p.potions], coins: p.coins, inventory: inventoryOf(s, p), inCity: !!p.city, cityPanel: !!p.city && !cityRules.cityView(s, p)?.mustReturn, city: cityRules.cityView(s, p), dice: p.dice, skills: p.skills, skillCards: p.skillCards.flatMap((id) => { const c = s.skills.get(id); return c ? [c] : []; }), ability: p.ability,
        } satisfies HeroDetails,
      }));
    // Il segnaposto dell'Overlord: ha il suo turno dopo gli eroi (per ora passa subito).
    const overlord: BarMember = {
      id: 'overlord', name: 'Overlord', kind: 'overlord', portrait: 'characters/overlord.webp', active: s.phase === 'overlord', done: false,
      wounds: 0, maxWounds: 0, points: 0, fatigue: 0, armor: 0, potions: 0, inCity: false, cityPanel: false, action: 'advance',
    };
    this.members.set([...heroes, overlord]);
    if (this.panel() && this.panel()!.id !== s.activeId) this.panel.set(null); // il pannello è dell'eroe che agisce
    const shown = this.panel();
    if (shown?.kind === 'city' && !(s.pieces.find((p) => p.id === shown.id)?.city && !cityRules.cityView(s, s.pieces.find((p) => p.id === shown.id)!)?.mustReturn)) this.panel.set(null); // la città c'è solo per chi ci si trova e non deve ancora tornare
    if (this.returnMode() && !this.pieces?.active?.city) this.endReturn();
    this.maybeStartReturn();
    this.refreshContext();
  }

  /** Dai titoli in cima ai pannelli: passa all'altro pannello, per lo stesso eroe. */
  protected switchPanel(kind: PanelKind) {
    this.panel.update((cur) => (cur ? { id: cur.id, kind } : cur));
  }

  /** I tasti "i" e della cassa del tab: aprono la scheda con le informazioni o l'inventario dell'eroe, o li chiudono se sono già aperti. */
  protected togglePanel(id: string, kind: PanelKind) {
    this.panel.update((cur) => (cur?.id === id && cur.kind === kind ? null : { id, kind }));
  }

  /** Un clic sul pallino di un eroe nella barra. */
  protected selectFromBar(id: string) {
    this.pieces?.selectHero(id);
  }

  /** Correre o Combattere per l'eroe attivo (tasti R e C). */
  private command(requested: 'run' | 'fight') {
    const r = this.pieces?.setAction(requested);
    if (r && !r.ok) this.showNotice(this.deniedText(r, requested), 'warning');
  }

  private deniedText(r: Extract<ActionChange, { ok: false }>, requested: 'run' | 'fight'): string {
    if (r.reason === 'turn') return 'Ora non puoi cambiare azione';
    if (r.reason === 'attacked') return 'Hai già attaccato: non puoi correre';
    return requested === 'fight' ? 'Hai già speso punti movimento: non puoi combattere' : 'Hai già speso troppi punti movimento per cambiare azione';
  }

  /** L'eroe attivo passa (tasto Invio). */
  private pass() {
    if (this.returnMode() && this.returnOptions().length) {
      this.showNotice('Devi tornare nel dungeon: scegli un glifo', 'warning');
      return;
    }
    const r = this.pieces?.passTurn();
    if (!r) return;
    const next = this.state.pieces.find((p) => p.id === r.nextActive);
    this.showNotice(r.roundStarted ? `Round ${this.state.round}: tocca agli eroi` : `Tocca a ${next?.name ?? '—'}`, 'autorenew');
  }

  /** Un bottone spento è stato toccato: il motivo per cui non si può, come notifica. */
  protected showReason(text: string) {
    this.showNotice(text, 'warning');
  }

  /** Una notifica in alto a destra, con un'icona e un breve testo: sparisce da sola. */
  private showNotice(text: string, icon = 'info') {
    const toast: Toast = { id: ++this.toastId, icon, text };
    this.toasts.update((list) => [...list, toast].slice(-4));
    const later = (ms: number, fn: () => void) => {
      const timer = setTimeout(() => {
        this.toastTimers.delete(timer);
        fn();
      }, ms);
      this.toastTimers.add(timer);
    };
    later(3200, () => {
      this.toasts.update((list) => list.map((x) => (x.id === toast.id ? { ...x, leaving: true } : x)));
      later(260, () => this.toasts.update((list) => list.filter((x) => x.id !== toast.id)));
    });
  }

  /** L'icona della notifica per un segnalino toccato. */
  private markerIcon(m: Marker): string {
    if (m.type === 'item') return this.state.items.get(m.itemId)?.icon ?? 'inventory_2';
    return { glyph: 'brightness_empty', potion: 'tokens/potion', coins: 'tokens/gold_pile', key: 'tokens/little_key', rune: 'tokens/rune_key', chest: 'inventory_2', stairs: 'stairs' }[m.type];
  }

  /** Clic in modalità "gioco": si muove la pedina (porte e scrigni si usano dal bottone contestuale). */
  private playClick(p: Point) {
    const c = this.toCells(p);
    const cell = { x: Math.floor(c.x), y: Math.floor(c.y) };
    if (this.returnMode()) {
      this.returnClick(cell);
      return;
    }
    this.pieces?.click(cell);
  }

  /** L'eroe attivo usa la porta `index` (dal bottone contestuale). */
  private useDoorAt(index: number) {
    const r = this.pieces?.useDoor(index);
    if (!r) return;
    if (r.code === 'opened' || r.code === 'closed' || r.code === 'unlocked' || r.code === 'picked') {
      this.doorView?.redraw(this.board!, (d) => this.exploration.doors.has(d)); // parte l'animazione dell'anta
      this.exploreAndNotify(); // aprire una porta può far vedere cose nuove
      if (r.code === 'unlocked') this.showNotice('Serratura aperta con la chiave', 'lock_open');
      else if (r.code === 'picked') this.showNotice(`Serratura scassinata ({mov:${r.cost}})`, 'lock_open');
    } else if (r.code === 'cost') this.showNotice(`Servono {mov:${r.cost}}`, 'warning');
    else if (r.code === 'needs-key') this.showNotice('Porta chiusa a chiave: serve la chiave giusta', 'lock');
    else if (r.code === 'needs-rune') this.showNotice(`Serve la chiave runica ${RUNE_NAMES[r.color!]}`, 'lock');
  }

  /** L'eroe attivo apre lo scrigno su cui sta (dal bottone contestuale). */
  private openChestHere() {
    const r = this.pieces?.useChest();
    if (!r) return;
    if (r.code === 'opened') this.showNotice(['Scrigno aperto', ...(r.found ?? [])].join(' · '), 'inventory_2');
    else if (r.code === 'already') this.showNotice('Lo scrigno è già aperto', 'inventory_2');
    else if (r.code === 'cost') this.showNotice(`Servono {mov:${r.cost}}`, 'warning');
    else if (r.code === 'full') this.showNotice('Non hai posto per ciò che contiene lo scrigno', 'warning');
  }

  /** L'eroe attivo beve una pozione (dal bottone contestuale). */
  private drinkPotion(kind: PotionKind) {
    const r = this.pieces?.drinkPotion(kind);
    if (!r) return;
    const name = POTION_NAMES[kind];
    if (r.code === 'drunk') this.showNotice(`${name} bevuta: +${r.healed} ferite`, 'tokens/potion');
    else if (r.code === 'full-health') this.showNotice('Sei già in piena salute', 'warning');
    else if (r.code === 'vital') this.showNotice('La fatica non è ancora in gioco', 'warning');
    else if (r.code === 'cost') this.showNotice('Serve {mov:1}', 'warning');
  }

  /** L'eroe attivo viaggia in città dal glifo su cui si trova (dal bottone contestuale): spende tutto il movimento e si apre il pannello Città. */
  private travelToCity() {
    const active = this.pieces?.active;
    const r = this.pieces?.cityDo((s, b, p) => cityRules.travelToCity(s, b, p));
    if (!r || !active) return;
    if (r.code === 'ok') {
      this.showNotice(`${active.name} è in città`, 'castle');
      this.exploreAndNotify(); // la pedina non c'è più: la vista del gruppo cambia
      this.panel.set({ id: active.id, kind: 'city' });
    } else this.showNotice(r.code === 'cost' ? 'Serve almeno {mov:1}' : 'Serve un glifo acceso', 'warning');
  }

  /** Un'azione in città, dal pannello Città: servizi, acquisti, vendite, concludere la visita o tornare nel dungeon. */
  protected onCityAction(e: CityEvent) {
    if (e.kind === 'conclude') {
      this.pass();
      return;
    }
    const r = this.pieces?.cityDo((s, _b, p) => {
      switch (e.kind) {
        case 'service': return cityRules.chooseService(s, p, e.service);
        case 'potion': return cityRules.buyPotion(s, p, e.id);
        case 'treasure': return cityRules.buyTreasure(s, p, e.id);
        case 'item': return cityRules.buyItem(s, p, e.id);
        case 'sell': return cityRules.sellItem(s, p, e.id);
        case 'skill': return cityRules.buySkill(s, p, e.id);
        case 'train': return cityRules.trainDice(s, p, e.id);
        case 'heal': return cityRules.templeHeal(s, p);
      }
    });
    if (!r) return;
    if (r.code === 'ok') {
      if (r.notice) this.showNotice(r.notice, 'castle');
    } else this.showNotice(CITY_TEXTS[r.code] ?? 'Non è possibile', r.code === 'soon' ? 'info' : 'warning');
  }

  /** I glifi su cui l'eroe attivo (in città) può tornare adesso: quelli che può pagare. */
  private returnOptions(): cityRules.ReturnChoice[] {
    const active = this.pieces?.active;
    if (!active?.city || !this.board) return [];
    return cityRules.returnChoices(this.state, this.board, active).filter((c) => c.coins <= active.coins);
  }

  /**
   * Quando tocca a un eroe che è in città dal turno scorso, la scelta del glifo su cui tornare parte da sola (il pannello Città non c'è più): i glifi
   * possibili brillano e si clicca quello scelto. Non si annulla: deve tornare. Se nessun glifo è libero, lo dice e può solo passare.
   */
  private maybeStartReturn() {
    const active = this.pieces?.active;
    if (!active?.city || !this.board || this.returnMode() || !cityRules.canReturn(this.state, active)) return;
    const choices = this.returnOptions();
    if (!choices.length) {
      const key = `${active.id}:${this.state.round}`;
      if (this.noGlyphFor !== key) {
        this.noGlyphFor = key;
        this.showNotice('Nessun glifo acceso è libero: puoi solo passare il turno', 'warning');
      }
      return;
    }
    this.returnMode.set(true);
    this.panel.set(null);
    this.hint.set('Scegli il glifo su cui tornare: clic su uno di quelli che brillano');
    this.showNotice(`${active.name} torna nel dungeon: il glifo di partenza è gratis, gli altri costano ${cityRules.CITY_TELEPORT_COST_TEXT} monete`, 'castle');
    this.focusCell(choices.find((c) => c.coins === 0)?.cell ?? choices[0].cell);
  }

  private endReturn() {
    this.returnMode.set(false);
    this.hint.set(HINTS[this.mode]);
  }

  /** Sposta la camera (solo il pan, con uno scorrimento) su una casella. */
  private focusCell(cell: Cell) {
    const app = this.app;
    if (!app) return;
    this.camTween = {
      fromZoom: this.zoom, toZoom: this.zoom,
      from: { x: (app.screen.width / 2 - this.camX) / this.zoom, y: (app.screen.height / 2 - this.camY) / this.zoom },
      to: { x: (cell.x + 0.5) * CELL_SIZE, y: (cell.y + 0.5) * CELL_SIZE },
      elapsed: 0,
    };
  }

  /** Clic su una casella mentre si sceglie il glifo di ritorno. */
  private returnClick(cell: Cell) {
    const active = this.pieces?.active;
    if (!active || !this.board) return;
    const choice = this.returnOptions().find((c) => c.cell.x === cell.x && c.cell.y === cell.y);
    if (!choice) {
      this.showNotice('Scegli uno dei glifi accesi che brillano', 'warning');
      return;
    }
    const r = this.pieces?.cityDo((s, b, p) => cityRules.returnFromCity(s, b, p, choice.cell));
    if (r?.code === 'ok') {
      this.endReturn();
      this.exploreAndNotify();
      this.showNotice(r.notice ?? `${active.name} è tornato nel dungeon`, 'brightness_empty');
    } else if (r) this.showNotice(CITY_TEXTS[r.code] ?? 'Non è possibile', 'warning');
  }

  /** Le azioni sull'inventario dalla scheda completa: equipaggiare, mettere nello zaino, scartare. */
  protected onItemAction(e: { action: 'equip' | 'stow' | 'drop'; itemId: string }) {
    const r = this.pieces?.itemAction(e.action, e.itemId);
    if (!r) return;
    const name = this.state.items.get(e.itemId)?.name ?? 'Oggetto';
    const icon = this.state.items.get(e.itemId)?.icon ?? 'inventory_2';
    if (r.code === 'ok') this.showNotice({ equip: `${name} equipaggiato`, stow: `${name} nello zaino`, drop: `${name} scartato: è perso` }[e.action], icon);
    else if (r.code === 'cost') this.showNotice('Servono {mov:2} per ri-equipaggiarsi', 'warning');
    else if (r.code === 'full') this.showNotice("Non c'è posto nello zaino", 'warning');
    else if (r.code === 'conflict') this.showNotice('Incompatibile con un oggetto equipaggiato', 'warning');
  }

  /** L'eroe attivo dà un oggetto a un eroe adiacente (dal bottone contestuale). */
  private giveItem(receiverId: string, itemId: string) {
    const r = this.pieces?.giveItem(receiverId, itemId);
    if (!r) return;
    const to = this.state.pieces.find((p) => p.id === receiverId)?.name ?? '';
    const item = this.state.items.get(itemId);
    if (r.code === 'ok') this.showNotice(`${item?.name ?? 'Oggetto'} dato a ${to}`, item?.icon ?? 'inventory_2');
    else if (r.code === 'full') this.showNotice(`${to} non ha posto`, 'warning');
    else if (r.code === 'cost') this.showNotice('Serve {mov:1}', 'warning');
    else if (r.code === 'far') this.showNotice(`${to} non è abbastanza vicino`, 'warning');
  }

  /** L'eroe attivo dà una pozione a un eroe adiacente (dal bottone contestuale). */
  private givePotion(receiverId: string, kind: PotionKind) {
    const r = this.pieces?.givePotion(receiverId, kind);
    if (!r) return;
    const to = this.state.pieces.find((p) => p.id === receiverId)?.name ?? '';
    if (r.code === 'given') this.showNotice(`${POTION_NAMES[kind]} data a ${to}`, 'tokens/potion');
    else if (r.code === 'full') this.showNotice(`${to} porta già troppe pozioni`, 'warning');
    else if (r.code === 'cost') this.showNotice('Serve {mov:1}', 'warning');
    else if (r.code === 'far') this.showNotice(`${to} non è abbastanza vicino`, 'warning');
  }

  /** Un'azione scelta dal bottone contestuale sopra la pedina. */
  protected runContext(id: string) {
    const active = this.pieces?.active;
    if (id === 'chest') this.openChestHere();
    else if (id === 'stairs') {
      const partner = active ? this.board?.stairsPartnerAt(active.cell) : undefined;
      if (partner) this.pieces?.click({ x: partner.x, y: partner.y });
    } else if (id === 'city') this.travelToCity();
    else if (id.startsWith('door:')) this.useDoorAt(Number(id.slice(5)));
    else if (id.startsWith('giveitem:')) {
      const [, target, itemId] = id.split(':');
      this.giveItem(target, itemId);
    }
    else if (id.startsWith('drink:')) this.drinkPotion(id.slice(6) as PotionKind);
    else if (id.startsWith('give:')) {
      const [, target, kind] = id.split(':');
      this.givePotion(target, kind as PotionKind);
    }
  }

  /** Ricalcola le azioni del bottone contestuale per l'eroe attivo (solo giocando). */
  private refreshContext() {
    const active = this.pieces?.active;
    const next = !this.board || !active || this.mode !== 'play' ? [] : contextActions(this.state, this.board, active, this.fogOn() ? this.exploration.doors : null);
    // Si aggiorna solo se è cambiato qualcosa: il menu aperto si richiude a ogni cambio.
    if (JSON.stringify(next) !== JSON.stringify(this.contextActions())) this.contextActions.set(next);
  }

  /** Tiene il bottone contestuale sopra la pedina attiva (anche mentre si muove, o quando la camera cambia). */
  private updateContextAnchor() {
    const pos = this.mode === 'play' ? this.pieces?.activeWorldPos() : null;
    const next = pos
      ? { x: Math.round(this.camX + pos.x * this.zoom), y: Math.round(this.camY + pos.y * this.zoom - CELL_SIZE * PAWN_RADIUS_RATIO * this.zoom) }
      : null;
    const cur = this.contextAnchor();
    if (next?.x !== cur?.x || next?.y !== cur?.y) this.contextAnchor.set(next);
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

  /** Il tasto "mostra tutta la mappa": scorrimento unico di pan e zoom fino all'inquadratura iniziale. */
  protected showWholeMap() {
    const app = this.app;
    const b = this.mapBox;
    if (!app || !b) return;
    const fit = Math.min((app.screen.width * MAP_FIT_FILL) / b.w, (app.screen.height * MAP_FIT_FILL) / b.h);
    this.camTween = {
      fromZoom: this.zoom,
      toZoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(fit, ZOOM_START))),
      from: { x: (app.screen.width / 2 - this.camX) / this.zoom, y: (app.screen.height / 2 - this.camY) / this.zoom },
      to: { x: b.x + b.w / 2, y: b.y + b.h / 2 },
      elapsed: 0,
    };
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

  /**
   * Il tasto "centra": porta l'eroe attivo al centro dello schermo e lo zoom a quello di 4 click su + dallo zoom iniziale (`CAMERA_FOCUS_ZOOM`),
   * con uno scorrimento unico di pan e zoom. Mentre scorre, il punto al centro dello schermo si sposta dal vecchio all'eroe e lo zoom cambia in
   * modo geometrico, come uno zoom vero.
   */
  protected centerOnActive() {
    const app = this.app;
    const hero = this.pieces?.active;
    if (!app || !hero) return;
    this.camTween = {
      fromZoom: this.zoom,
      toZoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, CAMERA_FOCUS_ZOOM)),
      from: { x: (app.screen.width / 2 - this.camX) / this.zoom, y: (app.screen.height / 2 - this.camY) / this.zoom },
      to: { x: (hero.cell.x + 0.5) * CELL_SIZE, y: (hero.cell.y + 0.5) * CELL_SIZE },
      elapsed: 0,
    };
  }

  /**
   * Mentre un eroe si muove la camera lo segue, solo con il pan (lo zoom resta quello che è), con un inseguimento morbido. Se durante
   * il movimento l'utente trascina o zooma, smette di seguirlo fino alla fine di quel movimento.
   */
  private followMovingPawn(deltaMs: number) {
    const pos = this.pieces?.movingWorldPos();
    const app = this.app;
    if (!pos || !app) {
      this.followSuppressed = false;
      return;
    }
    if (this.followSuppressed || this.camTween) return;
    const k = 1 - Math.exp(-deltaMs / CAMERA_FOLLOW_SMOOTH_MS);
    this.camX += (app.screen.width / 2 - pos.x * this.zoom - this.camX) * k;
    this.camY += (app.screen.height / 2 - pos.y * this.zoom - this.camY) * k;
    this.applyCamera();
  }

  /** Avanza lo scorrimento della camera (se c'è), con una frenata dolce alla fine. */
  private tickCameraTween(deltaMs: number) {
    const tw = this.camTween;
    const app = this.app;
    if (!tw || !app) return;
    tw.elapsed += deltaMs;
    const k = Math.min(1, tw.elapsed / CAMERA_CENTER_MS);
    const e = 1 - Math.pow(1 - k, 3);
    this.zoom = tw.fromZoom * Math.pow(tw.toZoom / tw.fromZoom, e);
    const cx = tw.from.x + (tw.to.x - tw.from.x) * e;
    const cy = tw.from.y + (tw.to.y - tw.from.y) * e;
    this.camX = app.screen.width / 2 - cx * this.zoom;
    this.camY = app.screen.height / 2 - cy * this.zoom;
    this.applyCamera();
    if (k >= 1) this.camTween = undefined;
  }

  /** Tasti + e −: zoom attorno al centro dello schermo. */
  protected zoomByButton(direction: 1 | -1) {
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
      this.camTween = undefined;
      this.followSuppressed = true;
      e.preventDefault();
      const p = local(e);
      const boost = e.ctrlKey ? ZOOM_TRACKPAD_PINCH_BOOST : 1;
      this.zoomAt(p.x, p.y, this.zoom * Math.exp(-e.deltaY * ZOOM_WHEEL_SENSITIVITY * boost));
    }, { passive: false });

    listen('pointerdown', (e) => {
      this.camTween = undefined;
      if (this.pieces?.movingWorldPos()) this.followSuppressed = true;
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
    // Sul tocco non c'è il passaggio del mouse: un tocco su un elemento che ha un suggerimento (le icone delle statistiche, le pozioni, i cubi dei dadi...) lo
    // mostra come notifica. I bottoni no: hanno già il loro nome e (se spenti) il motivo, che si mostra da sé.
    const onTap = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      const el = (e.target as Element | null)?.closest<HTMLElement>('[title]');
      if (!el?.title || el.matches('button, a, [role=tab]') || el.closest('button')) return;
      this.showNotice(el.title, 'info');
    };
    document.addEventListener('pointerup', onTap);
    this.cleanup.push(() => document.removeEventListener('pointerup', onTap));

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
      } else if (!e.repeat) {
        // Giocando: i comandi dell'eroe attivo.
        if (key === 'r') this.command('run');
        else if (key === 'c') this.command('fight');
        else if (key === 'enter') this.pass();
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
    this.toastTimers.forEach(clearTimeout);
    this.cleanup.forEach((fn) => fn());
    this.app?.destroy(true, { children: true });
  }
}
