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
import { DoorKind, MarkerSpec, TileEditor } from './tile-editor';

/** Il segnalino in mano è dello strumento "Glifi e altro"? */
const isSpecialSpec = (type: string) => type === 'glyph' || type === 'encounter' || type === 'start';
import { MonsterView } from './monster-view';
import { renderMarkerSamples } from './marker-samples';
import { MonsterDialogComponent } from './monster-dialog.component';
import { ChestTableDialogComponent } from './chest-table-dialog.component';
import type { ChestTable } from '../game/board/marker';
import { MonsterEdits } from './tile-editor';
import { loadItemCatalog } from '../game/items/item';
import { loadPortraits } from '../game/pieces/portraits';
import { loadMonsterCatalog, MonsterDef } from '../game/monsters/monster';
import type { ObstacleType } from '../game/board/obstacle';
import { AreaTool } from './area-tool';
import { AreaDialogComponent, AreaTexts } from './area-dialog.component';
import { ConfirmDialogComponent } from '../ui/confirm-dialog.component';
import { MapCamera } from './map-camera';

/**
 * L'editor delle avventure (fase 9 del README): per ora una scena Pixi vuota, pronta ad accogliere la mappa. C'è lo sfondo a puntini della partita, la camera (trascinare
 * per spostarsi, rotella o pinch per lo zoom, e i tasti di navigazione a destra), il contenitore `world` dove andrà la mappa (in pixel del mondo, 64 px per cella) e il
 * bottone del logo in alto a sinistra, che ancora non apre nessun menu e riporta alla home.
 */
@Component({
  selector: 'app-editor',
  imports: [ChestTableDialogComponent, MonsterDialogComponent, ConfirmDialogComponent, AreaDialogComponent, ValidationDialogComponent, EditorToolsComponent, AdventureGoalsDialogComponent, AdventureInfoDialogComponent, IconComponent, KeyLabelComponent, LogoButtonComponent, ZoomControlsComponent],
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
    <app-area-dialog [open]="!!editedArea()" [name]="editedArea()?.name ?? 'Area'" [value]="{ subtitle: editedArea()?.subtitle ?? '', text: editedArea()?.text ?? '' }" (confirmed)="applyArea($event)" (cancel)="areaEditing.set(null)" />
    <app-monster-dialog [open]="monsterEditing() !== null" [def]="editedMonster()?.def ?? null" [enhanced]="editedMonster()?.enhanced ?? false" [items]="itemOptions()" [value]="monsterEdits()" (confirmed)="applyMonster($event)" (cancel)="monsterEditing.set(null)" />
    <app-chest-table-dialog [open]="dialog() === 'chests'" [value]="chestTable()" [chestCounts]="chestCounts()" (confirmed)="applyChestTable($event)" (cancel)="dialog.set(null)" />
    <app-confirm-dialog [open]="!!deletingArea()" [title]="'Cancellare ' + (deletingArea()?.name ?? '') + '?'" text="Il sottotitolo e la descrizione che hai scritto andranno persi. Le tessere restano in mappa." confirmLabel="Cancella" (confirmed)="confirmDeleteArea()" (cancel)="deletingArea.set(null)" />
    <app-validation-dialog [open]="dialog() === 'validation'" [checks]="checks()" (closed)="dialog.set(null)" />
    <app-adventure-info-dialog [open]="dialog() === 'info'" [value]="info()" (confirmed)="applyInfo($event)" (cancel)="dialog.set(null)" />
    <app-adventure-goals-dialog [open]="dialog() === 'goals'" [value]="goals()" (confirmed)="applyGoals($event)" (cancel)="dialog.set(null)" />
    <!-- Gli strumenti di costruzione sul bordo inferiore. -->
    <app-editor-tools [tiles]="palette()" [counts]="counts()" [carrying]="carrying()" [deleting]="deleting()" [openExits]="openExits()" [canUndo]="canUndo()" [canRedo]="canRedo()" (undo)="tileEditor?.undo()" (redo)="tileEditor?.redo()" [obstacleCounts]="obstacleCounts()" [carryingObstacle]="carryingObstacle()" (pickObstacle)="tileEditor?.pickObstacle($event)" [monsters]="monsterCatalog()" [monsterCounts]="monsterCounts()" [carryingMonster]="carryingMonster()" (pickMonster)="tileEditor?.pickMonster($event.id, $event.enhanced)" [markerImages]="markerImages()" [markerCounts]="markerCounts()" [carryingMarker]="carryingMarker()" (pickMarker)="tileEditor?.pickMarker($event)" (openChestTable)="dialog.set('chests')" [customizing]="customizing()" (toggleCustomize)="tileEditor?.setCustomizing(!customizing())" [separating]="separating()" (toggleSeparate)="tileEditor?.setSeparating(!separating())" [doorCounts]="doorCounts()" [carryingDoor]="carryingDoor()" (pick)="tileEditor?.pick($event)" (pickDoor)="tileEditor?.pickDoor($event)" (rotate)="tileEditor?.rotate()" (toggleDelete)="tileEditor?.setDeleting(!deleting())" (closeExits)="closeExits()" [areas]="areaList()" [creatingArea]="creatingArea()" (toggleCreateArea)="areaTool?.setCreating(!creatingArea())" (areaHighlight)="areaTool?.setHighlight($event)" (setStartArea)="tileEditor?.toggleStart($event)" (editArea)="areaEditing.set($event)" (moveArea)="tileEditor?.moveArea($event.id, $event.to)" (deleteArea)="askDeleteArea($event)" (toolChange)="onToolChange($event)" />
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
  protected readonly dialog = signal<'info' | 'goals' | 'validation' | 'chests' | null>(null);
  /** La tabella dei ritrovamenti dei bauli (le ricompense casuali), letta dalla mappa. */
  protected readonly chestTable = signal<ChestTable>({});
  /** Quanti bauli ci sono in mappa per tipo (servono altrettante ricompense). */
  protected readonly chestCounts = computed(() => {
    const c = this.markerCounts();
    return { copper: c['chest:copper'] ?? 0, silver: c['chest:silver'] ?? 0, gold: c['chest:gold'] ?? 0 };
  });
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
  protected readonly obstacleCounts = signal<Record<ObstacleType, number>>({ rock: 0, pit: 0, water: 0 });
  protected readonly carryingObstacle = signal<ObstacleType | null>(null);
  protected readonly separating = signal(false);
  protected readonly customizing = signal(false);
  protected readonly markerCounts = signal<Record<string, number>>({});
  /** Le immagini delle schede degli oggetti, disegnate con le viste della mappa (arrivano dopo l'avvio). */
  protected readonly markerImages = signal<Record<string, string>>({});
  protected readonly carryingMarker = signal<MarkerSpec | null>(null);
  /** Il nemico di cui si modificano nome, valori, abilità e bottino (la dialog), con le sue modifiche attuali, e gli oggetti che si possono dare come bottino. */
  protected readonly monsterEditing = signal<number | null>(null);
  protected readonly monsterEdits = signal<MonsterEdits | null>(null);
  protected readonly itemOptions = signal<{ id: string; name: string }[]>([]);
  protected readonly editedMonster = computed(() => {
    const i = this.monsterEditing();
    const piece = i === null ? undefined : this.tileEditor?.monsters[i];
    const def = piece?.monster ? this.monsterCatalog().find((m) => m.id === piece.monster) : undefined;
    return def && piece ? { def, enhanced: !!piece.enhanced } : null;
  });
  /** I mostri del catalogo, quanti ne sono in mappa (chiave `id` normali, `id+` potenziati) e quale si porta in mano. */
  protected readonly monsterCatalog = signal<MonsterDef[]>([]);
  protected readonly monsterCounts = signal<Record<string, number>>({});
  protected readonly carryingMonster = signal<{ id: string; enhanced: boolean } | null>(null);
  protected readonly areaList = signal<{ id: string; name: string; start: boolean; cells: number; subtitle: string; text: string }[]>([]);
  protected readonly creatingArea = signal(false);
  /** L'area di cui si modificano sottotitolo e descrizione (la dialog), e i suoi dati. */
  protected readonly areaEditing = signal<string | null>(null);
  protected readonly editedArea = computed(() => this.areaList().find((a) => a.id === this.areaEditing()) ?? null);
  /** Lo strumento delle aree (null finché la cassetta non è caricata). */
  protected areaTool: AreaTool | null = null;
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
    void preloadIcons([ICONS.doorKey, ICONS.doorRune, 'genetics', ICONS.potion, ICONS.runeKey, ICONS.keyPickup, 'tokens/gold_pile']); // le icone delle serrature sulle porte
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
    app.ticker.add((t) => layer.tick(performance.now(), t.deltaMS)); // i glifi accesi pulsano
    camera.onHover = (p, e) => {
      layer.setFree(!!e?.shiftKey);
      layer.setHover(p ? this.toCells(p) : null);
    };
    camera.onClick = (p, e) => {
      if (this.areaTool?.open) {
        this.areaTool.click(this.toCells(p)); // con lo strumento delle aree aperto il clic sceglie le tessere
        return;
      }
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
    // Il tasto destro fa quello che fa Esc: toglie ciò che si ha in mano o la modalità attiva.
    const cancel = (e: MouseEvent) => {
      // Con lo strumento Nemici aperto e niente in mano, il tasto destro su un nemico apre subito le sue modifiche (e accende la modalità personalizza).
      const editor = this.tileEditor;
      if (editor && editor.deleteScope === 'monsters' && !editor.carrying && !editor.carryingDoor && !editor.carryingObstacle && !editor.carryingMonster && !editor.carryingMarker && !editor.deleting && !editor.separating) {
        const rect = app.canvas.getBoundingClientRect();
        const cells = this.toCells({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        if (editor.monsterIndexAt(cells) >= 0) {
          e.preventDefault();
          this.zone.run(() => editor.editMonsterAt(cells));
          return;
        }
      }
      if (!this.hasActiveSelection()) return;
      e.preventDefault();
      this.zone.run(() => this.cancelSelection());
    };
    app.canvas.addEventListener('contextmenu', cancel);
    this.cleanup.push(() => app.canvas.removeEventListener('contextmenu', cancel));
    void renderMarkerSamples(app, this.map.seed).then((images) => this.zone.run(() => this.markerImages.set(images))).catch(() => console.warn('Immagini degli oggetti non generate'));
    void Promise.all([loadTilePalette(), loadMonsterCatalog()]).then(async ([palette, monsters]) => {
      // Le immagini dei mostri (le pedine) si caricano prima di disegnarli.
      const textures = await loadPortraits([...monsters.values()].map((m) => MonsterView.tokenUrl(m)));
      if (this.destroyed) return;
      layer.setMonsterTextures(textures);
      this.monsterCatalog.set([...monsters.values()]);
      const editor = new TileEditor(layer, new Map(palette.map((t) => [t.id, t.def])), monsters, () => this.onTilesChanged());
      this.tileEditor = editor;
      editor.onEditMonster = (index) =>
        this.zone.run(() => {
          this.monsterEdits.set(editor.monsterEdits(index));
          this.monsterEditing.set(index);
        });
      void loadItemCatalog().then((items) => this.zone.run(() => this.itemOptions.set([...items.values()].map((i) => ({ id: i.id, name: i.name })).sort((a, b) => a.name.localeCompare(b.name, 'it')))));
      this.areaTool = new AreaTool(layer, editor, () => this.zone.run(() => this.syncSignals()));
      this.zone.run(() => this.palette.set(palette));
      editor.load(this.map.tiles, this.map.doors ?? [], this.map.areas ?? [], this.map.obstacles ?? [], this.map.pieces ?? [], this.map.markers ?? [], this.map.start ?? []); // dopo un refresh i tile e le porte della bozza tornano in mappa
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
    const { doors: _doors, areas: _areas, obstacles: _obstacles, pieces: _pieces, markers: _markers, start: _start, ...rest } = this.map;
    const areas = editor.areas().map((a) => ({ ...a.def, name: a.name }));
    this.map = { ...rest, tiles: editor.tiles.map((t) => ({ ...t })), ...(editor.doors.length ? { doors: editor.doors.map((d) => ({ ...d })) } : {}), ...(areas.length ? { areas } : {}), ...(editor.obstacles.length ? { obstacles: editor.obstacles.map((o) => ({ ...o })) } : {}), ...(editor.monsters.length ? { pieces: editor.monsters.map((m) => ({ ...m })) } : {}), ...(editor.markers.length ? { markers: editor.markers.map((m) => ({ ...m })) } : {}), ...(editor.startCells.length ? { start: editor.startCells.map((c) => ({ ...c })) } : {}) };
    this.areaTool?.refresh();
    this.zone.run(() => this.syncSignals());
    this.persist();
  }

  private syncSignals() {
    const editor = this.tileEditor;
    if (!editor) return;
    this.counts.set(editor.counts());
    this.doorCounts.set(editor.doorCounts());
    this.areaList.set(editor.areas().map(({ id, name, start, cells, def }) => ({ id, name, start, cells, subtitle: def.subtitle ?? '', text: def.text ?? '' })));
    this.creatingArea.set(!!this.areaTool?.creating);
    this.carryingDoor.set(editor.carryingDoor);
    this.obstacleCounts.set(editor.obstacleCounts());
    this.carryingObstacle.set(editor.carryingObstacle);
    this.separating.set(editor.separating);
    this.customizing.set(editor.customizing);
    this.markerCounts.set(editor.markerCounts());
    this.carryingMarker.set(editor.carryingMarker);
    this.monsterCounts.set(editor.monsterCounts());
    this.carryingMonster.set(editor.carryingMonster);
    this.carrying.set(editor.carrying);
    this.deleting.set(editor.deleting);
    this.openExits.set(editor.openExits());
    this.checks.set(validate(this.map, editor.openExits(), editor.unassignedTiles()));
    this.canUndo.set(editor.canUndo);
    this.canRedo.set(editor.canRedo);
    if (this.camera) this.camera.selectMode = editor.deleting;
  }

  /** Lo strumento acceso nella barra è cambiato: le aree si vedono solo con il loro strumento aperto, e aprirlo lascia ciò che si aveva in mano. */
  protected onToolChange(tool: string | null) {
    const editor = this.tileEditor;
    // Ogni strumento ha il suo elimina: cambiando strumento si esce dalla modalità e si cancella solo ciò che è dello strumento aperto.
    editor?.setDeleting(false);
    editor?.setSeparating(false);
    editor?.setCustomizing(false);
    if (editor) editor.deleteScope = tool === 'doors' ? 'doors' : tool === 'obstacles' ? 'obstacles' : tool === 'monsters' ? 'monsters' : tool === 'markers' ? 'markers' : tool === 'specials' ? 'specials' : 'tiles';
    if (tool !== 'obstacles' && editor?.carryingObstacle) editor.drop();
    if (tool !== 'monsters' && editor?.carryingMonster) editor.drop();
    if (tool !== 'markers' && tool !== 'specials' && editor?.carryingMarker) editor.drop();
    else if (editor?.carryingMarker && ((tool === 'markers') === isSpecialSpec(editor.carryingMarker.type))) editor.drop(); // la cassetta cambiata non è quella del segnalino in mano // chiudendo la cassetta degli ostacoli non si resta con uno in mano
    if (tool === 'areas') {
      editor?.drop();
      editor?.setDeleting(false);
    }
    this.areaTool?.setOpen(tool === 'areas');
  }

  /** L'area di cui si chiede la conferma prima di cancellarla (solo se ha già un sottotitolo o una descrizione: altrimenti non si perde niente). */
  protected readonly deletingArea = signal<{ id: string; name: string } | null>(null);

  protected askDeleteArea(id: string) {
    const area = this.areaList().find((a) => a.id === id);
    if (!area) return;
    if (area.subtitle.trim() || area.text.trim()) this.deletingArea.set({ id, name: area.name });
    else this.tileEditor?.deleteArea(id);
  }

  protected confirmDeleteArea() {
    const d = this.deletingArea();
    if (d) this.tileEditor?.deleteArea(d.id);
    this.deletingArea.set(null);
  }

  /** Scrive sottotitolo e descrizione dell'area modificata. */
  protected applyArea(t: AreaTexts) {
    const id = this.areaEditing();
    if (id) this.tileEditor?.updateArea(id, t);
    this.areaEditing.set(null);
    this.persist();
  }

  /** C'è qualcosa da annullare con Esc o il tasto destro: un elemento in mano o una modalità accesa. */
  private hasActiveSelection(): boolean {
    const e = this.tileEditor;
    return !!e && (!!e.carrying || !!e.carryingDoor || !!e.carryingObstacle || !!e.carryingMonster || !!e.carryingMarker || e.deleting || e.separating || e.customizing || !!this.areaTool?.creating);
  }

  /** Esc e tasto destro: togli la selezione (l'elemento in mano, o la modalità di creazione, elimina o separa). */
  private cancelSelection() {
    const editor = this.tileEditor;
    if (this.areaTool?.creating) this.areaTool.setCreating(false);
    else if (editor?.separating) editor.setSeparating(false);
    else if (editor?.customizing) editor.setCustomizing(false);
    else if (editor?.deleting) editor.setDeleting(false);
    else editor?.drop();
  }

  /** Conferma le modifiche del nemico aperto nella dialog. */
  protected applyMonster(e: MonsterEdits) {
    const i = this.monsterEditing();
    if (i !== null) this.tileEditor?.updateMonster(i, e);
    this.monsterEditing.set(null);
    this.persist();
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
    else if (key === 'escape') this.cancelSelection();
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
    this.checks.set(validate(m, this.tileEditor?.openExits() ?? 0, this.tileEditor?.unassignedTiles() ?? 0));
    this.info.set({ title: m.title ?? '', intro: m.intro ?? '' });
    this.chestTable.set(m.chestTable ?? {});
    this.goals.set({ objective: m.objective?.description ?? m.objective?.text ?? '', progress: m.progress ?? null });
  }

  /** Salva da sola la bozza nel browser (senza la conferma del tasto Salva): ogni modifica all'avventura, anche da una dialog, si ricorda dopo un refresh. */
  private persist() {
    this.store.save({ version: 1, map: this.map, view: this.camera?.view(), savedAt: Date.now() });
  }

  /** Scrive nella mappa titolo e introduzione (la dialog li vuole entrambi). */
  protected applyInfo(i: AdventureInfo) {
    this.map = { ...this.map, title: i.title, intro: i.intro };
    this.readMap();
    this.persist();
    this.dialog.set(null);
  }

  /** Scrive nella mappa la tabella dei ritrovamenti (senza righe, la tabella non c'è). */
  protected applyChestTable(t: ChestTable) {
    const { chestTable: _old, ...rest } = this.map;
    this.map = Object.keys(t).length ? { ...rest, chestTable: t } : rest;
    this.readMap();
    this.persist();
    this.dialog.set(null);
  }

  /** Scrive nella mappa il testo degli obiettivi e i punti Conquista iniziali. Un obiettivo già "sconfiggi la pedina" tiene la sua condizione e cambia solo il testo. */
  protected applyGoals(g: AdventureGoals) {
    const objective = this.map.objective ? { ...this.map.objective, description: g.objective } : { kind: 'text' as const, description: g.objective };
    this.map = { ...this.map, objective, ...(g.progress !== null ? { progress: g.progress } : {}) };
    this.readMap();
    this.persist();
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
