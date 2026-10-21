import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { Application, Container } from 'pixi.js';
import {
  BACKGROUND_COLOR,
  ZOOM_BUTTON_FACTOR,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_START,
  ZOOM_TRACKPAD_PINCH_BOOST,
  ZOOM_WHEEL_SENSITIVITY,
} from './constants';
import { DotGrid } from './dot-grid';

type Point = { x: number; y: number };

@Component({
  selector: 'app-game-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #host class="host"></div>
    <div class="zoom-buttons">
      <button type="button" aria-label="Zoom avanti" (click)="zoomByButton(1)">+</button>
      <button type="button" aria-label="Zoom indietro" (click)="zoomByButton(-1)">−</button>
    </div>
  `,
  styles: `
    :host { position: fixed; inset: 0; display: block; overflow: hidden; }
    .host { position: absolute; inset: 0; touch-action: none; }
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
    this.dots!.update(app.screen.width, app.screen.height, this.camX, this.camY, this.zoom, app.renderer.resolution);
    this.lastW = app.screen.width;
    this.lastH = app.screen.height;
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

    const release = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      this.lastPinchDistance = 0;
    };
    listen('pointerup', release);
    listen('pointercancel', release);
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
