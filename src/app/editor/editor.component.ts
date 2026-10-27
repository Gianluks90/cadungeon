import { ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Application, Container } from 'pixi.js';
import { DotGrid } from '../game/dot-grid';
import type { MapData } from '../game/map/map-data';
import { onThemeChange, readTokens, theme } from '../game/theme';
import { IconComponent } from '../ui/icon.component';
import { KeyLabelComponent } from '../ui/key-label.component';
import { LogoButtonComponent } from '../ui/logo-button.component';
import { ZoomControlsComponent } from '../ui/zoom-controls.component';
import { AdventureGoals, AdventureGoalsDialogComponent } from './adventure-goals-dialog.component';
import { AdventureInfo, AdventureInfoDialogComponent } from './adventure-info-dialog.component';
import { LocalDraftStore } from './draft-store';
import { MapCamera } from './map-camera';

/**
 * L'editor delle avventure (fase 9 del README): per ora una scena Pixi vuota, pronta ad accogliere la mappa. C'è lo sfondo a puntini della partita, la camera (trascinare
 * per spostarsi, rotella o pinch per lo zoom, e i tasti di navigazione a destra), il contenitore `world` dove andrà la mappa (in pixel del mondo, 64 px per cella) e il
 * bottone del logo in alto a sinistra, che ancora non apre nessun menu e riporta alla home.
 */
@Component({
  selector: 'app-editor',
  imports: [AdventureGoalsDialogComponent, AdventureInfoDialogComponent, IconComponent, KeyLabelComponent, LogoButtonComponent, ZoomControlsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:keydown)': 'onKey($event)' },
  template: `
    <div class="scene" #host></div>
    <div class="top"><app-logo-button (pressed)="home()" /></div>
    <!-- Il lato sinistro è delle funzioni dell'editor. -->
    <div class="tools">
      <button type="button" aria-label="Avventura" title="Titolo e introduzione" (click)="dialog.set('info')"><app-icon name="info" [size]="20" /><app-key-label side="right">Avventura</app-key-label></button>
      <button type="button" aria-label="Obiettivi" title="Obiettivi e punti Conquista iniziali" (click)="dialog.set('goals')"><app-icon name="flag" [size]="20" /><app-key-label side="right">Obiettivi</app-key-label></button>
      <button type="button" [class.done]="saved()" aria-label="Salva" [title]="saveTitle()" (click)="save()"><app-icon name="save" [size]="20" /><app-key-label side="right">Salva</app-key-label></button>
      <button type="button" aria-label="Esporta" title="Esporta (file JSON dell'avventura)" (click)="exportMap()"><app-icon name="download" [size]="20" /><app-key-label side="right">Esporta</app-key-label></button>
    </div>
    <app-adventure-info-dialog [open]="dialog() === 'info'" [value]="info()" (confirmed)="applyInfo($event)" (cancel)="dialog.set(null)" />
    <app-adventure-goals-dialog [open]="dialog() === 'goals'" [value]="goals()" (confirmed)="applyGoals($event)" (cancel)="dialog.set(null)" />
    <!-- I comandi di navigazione sul bordo destro, come in partita ma senza il focus sull'eroe. -->
    <app-zoom-controls [showFocus]="false" (zoom)="camera?.zoomBy($event)" (fit)="camera?.fit(null)" />
  `,
  styles: `
    :host { position: fixed; inset: 0; display: block; overflow: hidden; background: var(--c-bg); }
    .scene { position: absolute; inset: 0; touch-action: none; }
    .tools { position: absolute; z-index: 10; left: 12px; top: 0; bottom: 0; margin-block: auto; height: fit-content; display: flex; flex-direction: column; gap: 8px; }
    .tools button {
      position: relative; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; width: 34px; height: 34px; padding: 0; border-radius: var(--radius-1); cursor: pointer;
      background: var(--c-surface); border: 1px solid var(--c-line-strong); color: var(--c-text); transition: color 0.15s, border-color 0.15s;
    }
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
  protected readonly dialog = signal<'info' | 'goals' | null>(null);
  /** I valori di adesso, letti dalla mappa (cambiano quando si conferma una dialog o si ritrova una bozza). */
  protected readonly info = signal<AdventureInfo>({ title: '', intro: '' });
  protected readonly goals = signal<AdventureGoals>({ objective: '', progress: null });
  /** Il tasto Salva si accende un istante dopo aver salvato. */
  protected readonly saved = signal(false);
  protected readonly saveTitle = signal('Salva (nel browser)');

  /** La camera della scena (null finché Pixi non è partito). */
  protected camera: MapCamera | null = null;
  /** Dove andrà la mappa: la camera lo muove e lo ingrandisce. */
  protected world?: Container;

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.start()));
  }

  private async start() {
    readTokens();
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
    let lastW = app.screen.width;
    let lastH = app.screen.height;
    app.renderer.on('resize', (w: number, h: number) => {
      camera.resized(w - lastW, h - lastH);
      lastW = w;
      lastH = h;
    });
  }

  protected onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return; // si sta scrivendo
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (e.key.toLowerCase() === 'z') this.camera?.fit(null);
  }

  /** Rilegge dalla mappa i valori delle dialog. I punti Conquista, se la mappa non li dice, restano vuoti (nessun valore forzato). */
  private readMap() {
    const m = this.map;
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
