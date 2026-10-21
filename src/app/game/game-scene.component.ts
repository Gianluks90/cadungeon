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
  BACKGROUND_COLOR,
  CELL_SIZE,
  CLICK_SLOP_PX,
  DEV_PLACEABLE_TILES,
  MAP_FIT_FILL,
  ZOOM_BUTTON_FACTOR,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_START,
  ZOOM_TRACKPAD_PINCH_BOOST,
  ZOOM_WHEEL_SENSITIVITY,
} from './constants';
import { Board, Cell } from './board/board';
import { DotGrid } from './dot-grid';
import { PlacedTile, loadMap } from './map/map-data';
import { MapBounds, mapBounds } from './map/map-view';
import { TilePlacer } from './map/tile-placer';
import { loadTileDef, tileCells } from './map/tile';
import { PawnController } from './pawn/pawn-controller';

type Point = { x: number; y: number };

const HINT_PLAY = 'Clic: muovi · Spazio: nuovo turno · P: piazza tile';
const HINT_PLACE = 'R ruota · T cambia tile · clic piazza · Backspace annulla · P: torna a giocare';

@Component({
  selector: 'app-game-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #host class="host"></div>
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
      font: 12px/1 system-ui, sans-serif; color: #8a8178; opacity: 0.45;
      pointer-events: none; user-select: none;
    }
    .hud {
      position: absolute; left: 16px; bottom: 36px; margin: 0;
      font: 13px/1 system-ui, sans-serif; color: #d8cfc4; opacity: 0.8;
      pointer-events: none; user-select: none;
    }
    .zoom-buttons {
      position: absolute; right: 16px; bottom: 16px;
      display: flex; flex-direction: column; gap: 6px;
    }
    button {
      width: 32px; height: 32px; padding: 0;
      font: 18px/1 system-ui, sans-serif; color: #8a8178;
      background: rgba(12, 10, 8, 0.6);
      border: 1px solid #3a352f; border-radius: 6px;
      cursor: pointer; opacity: 0.6;
      transition: opacity 0.15s, color 0.15s;
    }
    button:hover, button:focus-visible { opacity: 1; color: #d8cfc4; }
  `,
})
export class GameSceneComponent implements OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly hostRef = viewChild.required<ElementRef<HTMLDivElement>>('host');

  private app?: Application;
  private world?: Container; // qui dentro andranno tile e pedine
  private placer?: TilePlacer; // strumento di sviluppo: piazza tile agganciandoli
  private pawn?: PawnController;
  private placed: PlacedTile[] = []; // i tile della mappa (lo strumento di piazzamento ne aggiunge)
  private placing = false; // false = si gioca, true = si piazzano tile
  protected readonly hint = signal(HINT_PLAY);
  protected readonly movement = signal('');
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
      background: BACKGROUND_COLOR,
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
    this.world = new Container();
    app.stage.addChild(this.dots.mesh, this.world);

    // All'inizio l'origine del mondo sta al centro dello schermo.
    this.camX = app.screen.width / 2;
    this.camY = app.screen.height / 2;
    this.applyCamera();

    // Mappa di prova: tile piazzati a mano (public/maps/prova.json).
    // Con ?mappa=catalogo si apre la mappa che mostra tutti i tile del catalogo.
    const mapName = new URLSearchParams(location.search).get('mappa')?.replace(/[^a-z0-9-]/g, '') || 'prova';
    try {
      const { data, placed } = await loadMap(`maps/${mapName}.json`);
      const defs = await Promise.all(DEV_PLACEABLE_TILES.map(loadTileDef));
      if (this.destroyed) return;
      const mapLayer = new Container();
      const pawnLayer = new Container();
      this.world.addChild(mapLayer, pawnLayer);
      this.placed = placed;
      this.placer = new TilePlacer(data.seed, placed, defs, mapLayer);
      this.pawn = new PawnController(pawnLayer, app.ticker, this.startCell(placed), (points, max) =>
        this.movement.set(`Movimento ${points} / ${max}`),
      );
      this.pawn.setBoard(new Board(placed));
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

    this.bindInput(app.canvas);
  }

  private lastW = 0;
  private lastH = 0;

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

  /** Dice a chi ne ha bisogno dove si trova il mouse (niente durante il trascinamento). */
  private refreshHover() {
    const cell = this.mouse && this.pointers.size === 0 ? this.toCells(this.mouse) : null;
    if (this.placing) {
      this.placer?.setHover(cell);
      this.pawn?.hover(null);
    } else {
      this.placer?.setHover(null);
      this.pawn?.hover(cell && { x: Math.floor(cell.x), y: Math.floor(cell.y) });
    }
  }

  /** P: passa da "si gioca" a "si piazzano tile" e viceversa. */
  private togglePlacing() {
    this.placing = !this.placing;
    this.hint.set(this.placing ? HINT_PLACE : HINT_PLAY);
    this.pawn?.setEnabled(!this.placing);
    // Tornando a giocare, i tile aggiunti diventano parte della mappa su cui ci si muove.
    if (!this.placing) this.pawn?.setBoard(new Board(this.placed));
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
        if (!this.placing) {
          const c = this.toCells(p);
          this.pawn?.click({ x: Math.floor(c.x), y: Math.floor(c.y) });
        } else if (e.pointerType === 'mouse') this.placer?.place();
      }
    };
    listen('pointerup', release);
    listen('pointercancel', release);

    // Tastiera: P cambia modalità; poi i tasti dipendono dalla modalità.
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'p') this.togglePlacing();
      else if (this.placing) {
        if (key === 'r') this.placer?.rotate();
        else if (key === 't') this.placer?.nextTile();
        else if (key === 'backspace') this.placer?.undo();
      } else if (key === ' ') {
        e.preventDefault();
        this.pawn?.newTurn();
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
    this.cleanup.forEach((fn) => fn());
    this.app?.destroy(true, { children: true });
  }
}
