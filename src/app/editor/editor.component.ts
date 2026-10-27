import { ChangeDetectionStrategy, Component, ElementRef, computed, NgZone, OnDestroy, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Application, Container, Graphics } from 'pixi.js';
import { DotGrid } from '../game/dot-grid';
import { CELL_SIZE, ICONS } from '../game/constants';
import { preloadIcons } from '../game/icons/icon-loader';
import { MapData } from '../game/map/map-data';
import { mapBounds } from '../game/map/map-view';
import { onThemeChange, readTokens, theme } from '../game/theme';
import { IconComponent } from '../ui/icon.component';
import { KeyLabelComponent } from '../ui/key-label.component';
import { LogoButtonComponent } from '../ui/logo-button.component';
import { ZoomControlsComponent } from '../ui/zoom-controls.component';
import { AdventureGoals, AdventureGoalsDialogComponent } from './adventure-goals-dialog.component';
import { AdventureInfo, AdventureInfoDialogComponent } from './adventure-info-dialog.component';
import { EditorToolsComponent } from './editor-tools.component';
import { Check, overall, validate } from './validator';
import { ValidationDialogComponent } from './validation-dialog.component';
import { LocalDraftStore } from './draft-store';
import { EditorMapLayer } from './map-layer';
import { PaletteTile, loadTilePalette } from './palette';
import { DoorKind, TileEditor } from './tile-editor';
import { MapCamera } from './map-camera';

/**
 * L'editor delle avventure (fase 9 del README): per ora una scena Pixi vuota, pronta ad accogliere la mappa. C'è lo sfondo a puntini della partita, la camera (trascinare
 * per spostarsi, rotella o pinch per lo zoom, e i tasti di navigazione a destra), il contenitore `world` dove andrà la mappa (in pixel del mondo, 64 px per cella) e il
 * bottone del logo in alto a sinistra, che ancora non apre nessun menu e riporta alla home.
 */
@Component({
  selector: 'app-editor',
  imports: [ValidationDialogComponent, EditorToolsComponent, AdventureGoalsDialogComponent, AdventureInfoDialogComponent, IconComponent, KeyLabelComponent, LogoButtonComponent, ZoomControlsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:keydown)': 'onKey($event)', '(window:keyup)': 'onKeyUp($event)' },
  template: `
    <div class="scene" #host></div>
    <div class="top"><app-logo-button (pressed)="home()" /></div>
    <!-- Il lato sinistro è delle funzioni dell'editor. -->
    <div class="tools">
      <button type="button" aria-label="Avventura" title="Titolo e introduzione" (click)="dialog.set('info')"><app-icon name="info" [size]="20" /><app-key-label side="right">Avventura</app-key-label></button>
      <button type="button" aria-label="Obiettivi" title="Obiettivi e punti Conquista iniziali" (click)="dialog.set('goals')"><app-icon name="flag" [size]="20" /><app-key-label side="right">Obiettivi</app-key-label></button>
      <button type="button" class="verify" [attr.data-state]="status()" [attr.aria-label]="'Verifica: ' + statusText()" [title]="'Verifica: ' + statusText()" (click)="dialog.set('validation')"><app-icon [name]="statusIcon()" [size]="20" /><app-key-label side="right">Verifica</app-key-label></button>
      <button type="button" [class.done]="saved()" aria-label="Salva" [title]="saveTitle()" (click)="save()"><app-icon name="save" [size]="20" /><app-key-label side="right">Salva</app-key-label></button>
      <button type="button" aria-label="Esporta" title="Esporta (file JSON dell'avventura)" (click)="exportMap()"><app-icon name="download" [size]="20" /><app-key-label side="right">Esporta</app-key-label></button>
    </div>
    <app-validation-dialog [open]="dialog() === 'validation'" [checks]="checks()" (closed)="dialog.set(null)" />
    <app-adventure-info-dialog [open]="dialog() === 'info'" [value]="info()" (confirmed)="applyInfo($event)" (cancel)="dialog.set(null)" />
    <app-adventure-goals-dialog [open]="dialog() === 'goals'" [value]="goals()" (confirmed)="applyGoals($event)" (cancel)="dialog.set(null)" />
    <!-- Gli strumenti di costruzione sul bordo inferiore. -->
    <app-editor-tools [tiles]="palette()" [counts]="counts()" [carrying]="carrying()" [deleting]="deleting()" [openExits]="openExits()" [canUndo]="canUndo()" [canRedo]="canRedo()" (undo)="tileEditor?.undo()" (redo)="tileEditor?.redo()" [doorCounts]="doorCounts()" [carryingDoor]="carryingDoor()" (pick)="tileEditor?.pick($event)" (pickDoor)="tileEditor?.pickDoor($event)" (rotate)="tileEditor?.rotate()" (toggleDelete)="tileEditor?.setDeleting(!deleting())" (closeExits)="closeExits()" />
    <!-- I comandi di navigazione sul bordo destro, come in partita ma senza il focus sull'eroe. -->
    <app-zoom-controls [showFocus]="false" (zoom)="camera?.zoomBy($event)" (fit)="fitMap()" />
  `,
  styles: `
    :host { position: fixed; inset: 0; display: block; overflow: hidden; background: var(--c-bg); }
    .scene { position: absolute; inset: 0; touch-action: none; }
    .tools { position: absolute; z-index: 10; left: 12px; top: 0; bottom: 0; margin-block: auto; height: fit-content; display: flex; flex-direction: column; gap: 8px; }
    .tools button {
      position: relative; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; width: 34px; height: 34px; padding: 0; border-radius: var(--radius-1); cursor: pointer;
      background: var(--c-surface); border: 1px solid var(--c-line-strong); color: var(--c-text); transition: color 0.15s, border-color 0.15s;
    }
    .tools button.verify { color: var(--c-ok); }
    .tools button.verify[data-state='warning'] { color: var(--c-warn); }
    .tools button.verify[data-state='error'] { color: var(--c-error); }
    .tools button.verify:hover, .tools button.verify:focus-visible { border-color: currentColor; }
    .tools button:hover, .tools button:focus-visible, .tools button.done { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
    @media (pointer: coarse) { .tools button { width: 44px; height: 44px; } }
    .top { position: absolute; z-index: 10; top: calc(12px + env(safe-area-inset-top)); left: 12px; }
  `,
})
export class EditorComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly hostRef = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private app?: Application;
  private destroyed = false;
  private readonly cleanup: (() => void)[] = [];
  private readonly store = new LocalDraftStore();
  private doneTimer = 0;

  /** La mappa che si sta costruendo, nel formato salvato di sempre (le funzioni dell'editor la riempiranno). */
  protected map: MapData = { seed: Math.floor(Math.random() * 2 ** 31), tiles: [] };
  /** Quale dialog è aperta: la presentazione (titolo e introduzione) o gli obiettivi. */
  protected readonly dialog = signal<'info' | 'goals' | 'validation' | null>(null);
  /** La verifica dell'avventura: i controlli e il loro esito complessivo (icona del tasto). */
  protected readonly checks = signal<Check[]>(validate(this.map, 0));
  protected readonly status = computed(() => overall(this.checks()));
  protected readonly statusIcon = computed(() => ({ ok: 'check_circle', warning: 'warning', error: 'error' })[this.status()]);
  protected readonly statusText = computed(() => ({ ok: 'tutto a posto', warning: 'manca qualcosa', error: 'ci sono errori' })[this.status()]);
  /** I valori di adesso, letti dalla mappa (cambiano quando si conferma una dialog o si ritrova una bozza). */
  protected readonly info = signal<AdventureInfo>({ title: '', intro: '' });
  protected readonly goals = signal<AdventureGoals>({ objective: '', progress: null });
  /** Il tasto Salva si accende un istante dopo aver salvato. */
  protected readonly saved = signal(false);
  protected readonly saveTitle = signal('Salva (nel browser)');

  /** Le tessere inseribili (si caricano all'avvio) e quante ne sono in mappa per tipo. */
  protected readonly palette = signal<PaletteTile[]>([]);
  protected readonly counts = signal<Record<string, number>>({});
  /** L'id della tessera che si porta in mano (legata al puntatore), o null. */
  protected readonly carrying = signal<string | null>(null);
  /** La modalità elimina e le uscite ancora libere (per il tasto che le chiude). */
  protected readonly deleting = signal(false);
  protected readonly openExits = signal(0);
  protected readonly doorCounts = signal<Record<DoorKind, number>>({ normal: 0, key: 0, blue: 0, red: 0, green: 0 });
  protected readonly carryingDoor = signal<DoorKind | null>(null);
  protected readonly canUndo = signal(false);
  protected readonly canRedo = signal(false);
  private layer?: EditorMapLayer;
  /** L'editing dei tile (null finché la cassetta non è caricata). */
  protected tileEditor: TileEditor | null = null;

  /** La camera della scena (null finché Pixi non è partito). */
  protected camera: MapCamera | null = null;
  /** Dove andrà la mappa: la camera lo muove e lo ingrandisce. */
  protected world?: Container;

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.start()));
  }

  private async start() {
    readTokens();
    void preloadIcons([ICONS.doorKey, ICONS.doorRune]); // le icone delle serrature sulle porte
    const host = this.hostRef().nativeElement;
    const app = new Application();
    await app.init({ resizeTo: host, background: theme.color.background, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true, preference: 'webgl' });
    if (this.destroyed) {
      app.destroy(true);
      return;
    }
    this.app = app;
    host.appendChild(app.canvas);

    const dots = new DotGrid();
    this.cleanup.push(onThemeChange(() => dots.applyTheme()));
    const world = new Container();
    this.world = world;
    app.stage.addChild(dots.mesh, world);

    const camera = new MapCamera(app, world, dots);
    this.camera = camera;
    // Dopo un refresh si ritrova la bozza salvata: la mappa e l'inquadratura di prima.
    const draft = this.store.load();
    if (draft) {
      this.map = draft.map;
      this.zone.run(() => this.readMap());
      if (draft.view) camera.setView(draft.view);
    }
    this.cleanup.push(camera.bind(app.canvas));

    // Il livello della mappa: i tile piazzati e quello che si porta in mano.
    const layer = new EditorMapLayer(this.map.seed);
    this.layer = layer;
    world.addChild(layer.container);
    camera.onHover = (p, e) => {
      layer.setFree(!!e?.shiftKey);
      layer.setHover(p ? this.toCells(p) : null);
    };
    camera.onClick = (p, e) => {
      layer.setFree(e.shiftKey);
      if (e.pointerType !== 'mouse') layer.setHover(this.toCells(p)); // sul tocco il punto toccato fa da puntatore
      this.tileEditor?.click(this.toCells(p));
    };
    // La modalità elimina: trascinando non si sposta la camera ma si traccia un'area; al rilascio sparisce ciò che l'area tocca. Un semplice clic toglie il pezzo sotto il puntatore.
    const marquee = new Graphics();
    app.stage.addChild(marquee);
    camera.onSelect = (from, to) => {
      marquee.clear();
      if (!from || !to) return;
      marquee.rect(Math.min(from.x, to.x), Math.min(from.y, to.y), Math.abs(to.x - from.x), Math.abs(to.y - from.y));
      marquee.fill({ color: theme.color.danger, alpha: 0.14 });
      marquee.stroke({ width: 1, color: theme.color.danger, alpha: 0.9 });
    };
    camera.onSelectEnd = (from, to, moved) => {
      const a = this.toCells(from);
      const b = moved ? this.toCells(to) : a;
      this.tileEditor?.deleteIn({ x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x) + (moved ? 0 : 0.001), y1: Math.max(a.y, b.y) + (moved ? 0 : 0.001) }, moved ? 0 : 0.2);
    };
    const cancel = (e: Event) => {
      if (!this.tileEditor?.carrying && !this.tileEditor?.carryingDoor && !this.tileEditor?.deleting) return;
      e.preventDefault();
      this.zone.run(() => (this.tileEditor?.deleting ? this.tileEditor.setDeleting(false) : this.tileEditor?.drop()));
    };
    app.canvas.addEventListener('contextmenu', cancel);
    this.cleanup.push(() => app.canvas.removeEventListener('contextmenu', cancel));
    void loadTilePalette().then((palette) => {
      if (this.destroyed) return;
      const editor = new TileEditor(layer, new Map(palette.map((t) => [t.id, t.def])), () => this.onTilesChanged());
      this.tileEditor = editor;
      this.zone.run(() => this.palette.set(palette));
      editor.load(this.map.tiles, this.map.doors ?? []); // dopo un refresh i tile e le porte della bozza tornano in mappa
      this.zone.run(() => this.syncSignals());
    });
    let lastW = app.screen.width;
    let lastH = app.screen.height;
    app.renderer.on('resize', (w: number, h: number) => {
      camera.resized(w - lastW, h - lastH);
      lastW = w;
      lastH = h;
    });
  }

  /** "Tutta la mappa": inquadra i tile piazzati, o l'origine se non ce ne sono. */
  protected fitMap() {
    const pieces = this.tileEditor?.pieces ?? [];
    this.camera?.fit(pieces.length ? mapBounds([...pieces]) : null);
  }

  /** I pezzi sono cambiati (piazzati, ripresi, tolti): aggiorna la mappa, i segnali e salva da sola la bozza nel browser (senza la conferma del tasto Salva). */
  private onTilesChanged() {
    const editor = this.tileEditor;
    if (!editor) return;
    const { doors: _doors, ...rest } = this.map;
    this.map = { ...rest, tiles: editor.tiles.map((t) => ({ ...t })), ...(editor.doors.length ? { doors: editor.doors.map((d) => ({ ...d })) } : {}) };
    this.zone.run(() => this.syncSignals());
    this.store.save({ version: 1, map: this.map, view: this.camera?.view(), savedAt: Date.now() });
  }

  private syncSignals() {
    const editor = this.tileEditor;
    if (!editor) return;
    this.counts.set(editor.counts());
    this.doorCounts.set(editor.doorCounts());
    this.carryingDoor.set(editor.carryingDoor);
    this.carrying.set(editor.carrying);
    this.deleting.set(editor.deleting);
    this.openExits.set(editor.openExits());
    this.checks.set(validate(this.map, editor.openExits()));
    this.canUndo.set(editor.canUndo);
    this.canRedo.set(editor.canRedo);
    if (this.camera) this.camera.selectMode = editor.deleting;
  }

  /** Chiude con un punto morto tutte le uscite libere. */
  protected closeExits() {
    this.tileEditor?.closeExits();
  }

  protected onKeyUp(e: KeyboardEvent) {
    if (e.key === 'Shift') this.layer?.setFree(false);
  }

  protected onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return; // si sta scrivendo
    const key = e.key.toLowerCase();
    if (key === 'shift') this.layer?.setFree(true);
    if ((e.metaKey || e.ctrlKey) && (key === 'z' || key === 'y')) {
      e.preventDefault();
      if (key === 'y' || e.shiftKey) this.tileEditor?.redo();
      else this.tileEditor?.undo();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const editor = this.tileEditor;
    if (key === 'z') this.fitMap();
    else if (key === 'escape') editor?.deleting ? editor.setDeleting(false) : editor?.drop();
    else if (key === 'r') editor?.rotate();
    else if (key === 'delete') editor?.discard();
    else if (key === 'backspace') editor?.undo();
  }

  /** Un punto dello schermo in celle (con la parte decimale). */
  private toCells(p: { x: number; y: number }) {
    const w = this.camera!.toWorld(p);
    return { x: w.x / CELL_SIZE, y: w.y / CELL_SIZE };
  }

  /** Rilegge dalla mappa i valori delle dialog. I punti Conquista, se la mappa non li dice, restano vuoti (nessun valore forzato). */
  private readMap() {
    const m = this.map;
    this.checks.set(validate(m, this.tileEditor?.openExits() ?? 0));
    this.info.set({ title: m.title ?? '', intro: m.intro ?? '' });
    this.goals.set({ objective: m.objective?.description ?? m.objective?.text ?? '', progress: m.progress ?? null });
  }

  /** Scrive nella mappa titolo e introduzione (la dialog li vuole entrambi). */
  protected applyInfo(i: AdventureInfo) {
    this.map = { ...this.map, title: i.title, intro: i.intro };
    this.readMap();
    this.dialog.set(null);
  }

  /** Scrive nella mappa il testo degli obiettivi e i punti Conquista iniziali. Un obiettivo già "sconfiggi la pedina" tiene la sua condizione e cambia solo il testo. */
  protected applyGoals(g: AdventureGoals) {
    const objective = this.map.objective ? { ...this.map.objective, description: g.objective } : { kind: 'text' as const, description: g.objective };
    this.map = { ...this.map, objective, ...(g.progress !== null ? { progress: g.progress } : {}) };
    this.readMap();
    this.dialog.set(null);
  }

  /** Salva la bozza (mappa e inquadratura) nel localStorage, per ritrovarla dopo un refresh. */
  protected save() {
    const ok = this.store.save({ version: 1, map: this.map, view: this.camera?.view(), savedAt: Date.now() });
    this.zone.run(() => {
      this.saved.set(ok);
      this.saveTitle.set(ok ? 'Salvato nel browser' : 'Impossibile salvare: il browser non lo permette');
      clearTimeout(this.doneTimer);
      this.doneTimer = window.setTimeout(() => {
        this.saved.set(false);
        this.saveTitle.set('Salva (nel browser)');
      }, 1500);
    });
  }

  /** Scarica la mappa come file JSON nel formato delle avventure (quello di `public/maps/`): è ciò che si passa per creare le avventure ufficiali. */
  protected exportMap() {
    const blob = new Blob([JSON.stringify(this.map, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const name = (this.map.title ?? 'avventura').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'avventura';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  protected home() {
    void this.router.navigateByUrl('/');
  }

  ngOnDestroy() {
    this.destroyed = true;
    clearTimeout(this.doneTimer);
    this.cleanup.forEach((fn) => fn());
    this.app?.destroy(true, { children: true });
  }
}
