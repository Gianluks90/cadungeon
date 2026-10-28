import type { Application, Container } from 'pixi.js';
import { CLICK_SLOP_PX, MAP_FIT_FILL, ZOOM_BUTTON_FACTOR, ZOOM_MAX, ZOOM_MIN, ZOOM_START, ZOOM_TRACKPAD_PINCH_BOOST, ZOOM_WHEEL_SENSITIVITY } from '../game/constants';
import type { DotGrid } from '../game/dot-grid';

/** Un'area in pixel del mondo. */
export interface WorldBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** La durata dello scorrimento verso un'inquadratura (millisecondi). */
const FIT_MS = 450;

interface Tween {
  fromZoom: number;
  toZoom: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  elapsed: number;
}

/**
 * La camera della scena dell'editor: pan (trascinando), zoom (rotella, pinch, tasti) e "mostra tutto" con scorrimento. Muove il contenitore del mondo e lo
 * sfondo a puntini. Il mondo ha l'origine al centro dello schermo finché non si inquadra qualcosa. Gli input di mouse e tocco si collegano con `bind`.
 * `onClick` riceve un clic (senza trascinare) in coordinate dello schermo: servirà agli strumenti dell'editor.
 */
export class MapCamera {
  x = 0;
  y = 0;
  zoom = ZOOM_START;
  onClick?: (screen: { x: number; y: number }, event: PointerEvent) => void;
  /** Modalità selezione (per esempio elimina): trascinando con un dito o il mouse non si sposta la camera, ma si traccia un'area (`onSelect` a ogni movimento, `onSelectEnd` al rilascio, con `moved` falso se è stato un semplice clic); con due dita si sposta e si fa zoom come sempre. */
  selectMode = false;
  onSelect?: (from: { x: number; y: number } | null, to: { x: number; y: number } | null) => void;
  onSelectEnd?: (from: { x: number; y: number }, to: { x: number; y: number }, moved: boolean) => void;
  private selFrom: { x: number; y: number } | null = null;
  /** Con un pezzo in mano, sul tocco un dito trascina il pezzo (`onHandMove`, a ogni movimento e già al primo contatto) invece della camera; con due dita si sposta e si fa zoom come sempre. Il mouse non cambia. */
  handMode = false;
  /** Una maniglia sulla mappa (per esempio quelle del filo delle scale): se onGrab dice di sì al primo contatto, il trascinamento la muove invece della camera (onGrabMove) e al rilascio finisce (onGrabEnd), senza contare come clic. */
  onGrab?: (screen: { x: number; y: number }, event: PointerEvent) => boolean;
  onGrabMove?: (screen: { x: number; y: number }) => void;
  onGrabEnd?: () => void;
  private grabbing = false;
  onHandMove?: (screen: { x: number; y: number }) => void;
  /** Il mouse si muove sopra la scena (anche senza premere): `null` quando esce. */
  onHover?: (screen: { x: number; y: number } | null, event?: PointerEvent) => void;

  private tween?: Tween;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private down: { x: number; y: number } | null = null;
  private pinch = 0;

  constructor(
    private readonly app: Application,
    private readonly world: Container,
    private readonly dots: DotGrid,
  ) {
    this.x = app.screen.width / 2;
    this.y = app.screen.height / 2;
    this.apply();
    app.ticker.add((t) => this.tick(t.deltaMS));
  }

  /** L'inquadratura di adesso: il centro dello schermo in pixel del mondo e lo zoom. */
  view() {
    return { ...this.center(), zoom: this.zoom };
  }

  /** Rimette un'inquadratura salvata, senza scorrimento. */
  setView(v: { x: number; y: number; zoom: number }) {
    this.tween = undefined;
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.zoom));
    this.x = this.app.screen.width / 2 - v.x * this.zoom;
    this.y = this.app.screen.height / 2 - v.y * this.zoom;
    this.apply();
  }

  /** Il punto dello schermo in coordinate del mondo (pixel). */
  toWorld(p: { x: number; y: number }) {
    return { x: (p.x - this.x) / this.zoom, y: (p.y - this.y) / this.zoom };
  }

  /** Il centro dello schermo, in pixel del mondo. */
  private center() {
    return { x: (this.app.screen.width / 2 - this.x) / this.zoom, y: (this.app.screen.height / 2 - this.y) / this.zoom };
  }

  apply() {
    this.world.position.set(this.x, this.y);
    this.world.scale.set(this.zoom);
    this.dots.update(this.app.screen.width, this.app.screen.height, this.x, this.y, this.zoom, this.app.renderer.resolution);
  }

  /** Zoom mantenendo fermo il punto sotto (px, py). */
  zoomAt(px: number, py: number, zoom: number) {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
    const k = z / this.zoom;
    this.x = px - (px - this.x) * k;
    this.y = py - (py - this.y) * k;
    this.zoom = z;
    this.apply();
  }

  /** I tasti + (1) e − (-1): zoom attorno al centro dello schermo. */
  zoomBy(direction: 1 | -1) {
    this.tween = undefined;
    const f = direction === 1 ? ZOOM_BUTTON_FACTOR : 1 / ZOOM_BUTTON_FACTOR;
    this.zoomAt(this.app.screen.width / 2, this.app.screen.height / 2, this.zoom * f);
  }

  /** Inquadra un'area al centro con uno scorrimento unico di pan e zoom (senza ingrandire oltre lo zoom iniziale); senza area, torna all'origine. */
  fit(box: WorldBox | null) {
    const { width, height } = this.app.screen;
    const b = box ?? { x: -width / 2, y: -height / 2, w: width, h: height };
    const fit = Math.min((width * MAP_FIT_FILL) / b.w, (height * MAP_FIT_FILL) / b.h);
    this.tween = {
      fromZoom: this.zoom,
      toZoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(fit, ZOOM_START))),
      from: this.center(),
      to: { x: b.x + b.w / 2, y: b.y + b.h / 2 },
      elapsed: 0,
    };
  }

  /** Quando la finestra cambia, il punto al centro resta al centro. */
  resized(dw: number, dh: number) {
    this.x += dw / 2;
    this.y += dh / 2;
    this.apply();
  }

  private tick(deltaMs: number) {
    const tw = this.tween;
    if (!tw) return;
    tw.elapsed += deltaMs;
    const k = Math.min(1, tw.elapsed / FIT_MS);
    const e = 1 - Math.pow(1 - k, 3);
    this.zoom = tw.fromZoom * Math.pow(tw.toZoom / tw.fromZoom, e);
    const cx = tw.from.x + (tw.to.x - tw.from.x) * e;
    const cy = tw.from.y + (tw.to.y - tw.from.y) * e;
    this.x = this.app.screen.width / 2 - cx * this.zoom;
    this.y = this.app.screen.height / 2 - cy * this.zoom;
    this.apply();
    if (k >= 1) this.tween = undefined;
  }

  /** Collega rotella, mouse e tocco al canvas; restituisce la funzione che li scollega. */
  bind(canvas: HTMLCanvasElement): () => void {
    const local = (e: PointerEvent | WheelEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const pair = () => [...this.pointers.values()];
    const dist = () => { const [a, b] = pair(); return Math.hypot(a.x - b.x, a.y - b.y); };
    const mid = () => { const [a, b] = pair(); return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };

    const wheel = (e: WheelEvent) => {
      this.tween = undefined;
      e.preventDefault();
      const p = local(e);
      const boost = e.ctrlKey ? ZOOM_TRACKPAD_PINCH_BOOST : 1;
      this.zoomAt(p.x, p.y, this.zoom * Math.exp(-e.deltaY * ZOOM_WHEEL_SENSITIVITY * boost));
    };
    const pointerdown = (e: PointerEvent) => {
      this.tween = undefined;
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, local(e));
      this.down = this.pointers.size === 1 ? local(e) : null;
      if (this.pointers.size === 2) {
        if (this.grabbing) {
          this.grabbing = false; // la seconda dito lascia la maniglia e si passa a spostare e zoomare
          this.onGrabEnd?.();
        }
        this.pinch = dist();
        if (this.selFrom) {
          this.selFrom = null; // la seconda dito annulla la selezione e si passa a spostare e zoomare
          this.onSelect?.(null, null);
        }
      }
      if (this.pointers.size === 1 && this.onGrab?.(local(e), e)) {
        this.grabbing = true;
        return;
      }
      if (this.selectMode && this.pointers.size === 1) this.selFrom = local(e);
      if (this.handMode && e.pointerType !== 'mouse' && this.pointers.size === 1) this.onHandMove?.(local(e));
    };
    const pointermove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') this.onHover?.(local(e), e);
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const cur = local(e);
      if (this.grabbing && this.pointers.size === 1) {
        this.pointers.set(e.pointerId, cur);
        this.onGrabMove?.(cur);
        return;
      }
      if (this.pointers.size === 1 && this.selectMode) {
        this.pointers.set(e.pointerId, cur);
        if (this.selFrom && Math.hypot(cur.x - this.selFrom.x, cur.y - this.selFrom.y) >= CLICK_SLOP_PX) this.onSelect?.(this.selFrom, cur);
      } else if (this.pointers.size === 1 && this.handMode && e.pointerType !== 'mouse') {
        this.pointers.set(e.pointerId, cur);
        this.onHandMove?.(cur);
      } else if (this.pointers.size === 1) {
        this.x += cur.x - prev.x;
        this.y += cur.y - prev.y;
        this.pointers.set(e.pointerId, cur);
        this.apply();
      } else if (this.pointers.size === 2) {
        const before = mid();
        this.pointers.set(e.pointerId, cur);
        const after = mid();
        this.x += after.x - before.x;
        this.y += after.y - before.y;
        const d = dist();
        if (this.pinch > 0) this.zoomAt(after.x, after.y, this.zoom * (d / this.pinch));
        else this.apply();
        this.pinch = d;
      }
    };
    const release = (e: PointerEvent) => {
      const p = local(e);
      if (this.grabbing) {
        this.grabbing = false;
        this.pointers.delete(e.pointerId);
        this.down = null;
        this.onGrabEnd?.();
        return;
      }
      if (this.selFrom && this.pointers.size === 1) {
        const from = this.selFrom;
        this.selFrom = null;
        this.onSelect?.(null, null);
        if (e.type === 'pointerup') this.onSelectEnd?.(from, p, Math.hypot(p.x - from.x, p.y - from.y) >= CLICK_SLOP_PX);
      }
      const isClick = !this.selectMode && e.type === 'pointerup' && e.button === 0 && this.pointers.size === 1 && this.down !== null && Math.hypot(p.x - this.down.x, p.y - this.down.y) < CLICK_SLOP_PX;
      this.pointers.delete(e.pointerId);
      this.pinch = 0;
      this.down = null;
      if (isClick) this.onClick?.(p, e);
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('pointerdown', pointerdown);
    canvas.addEventListener('pointermove', pointermove);
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    // Sul tocco il dito che si alza "esce" dal canvas: l'anteprima deve restare dov'è (solo il mouse che esce la toglie).
    const leave = (e: PointerEvent) => { if (e.pointerType === 'mouse') this.onHover?.(null); };
    canvas.addEventListener('pointerleave', leave);
    return () => {
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('pointerdown', pointerdown);
      canvas.removeEventListener('pointermove', pointermove);
      canvas.removeEventListener('pointerup', release);
      canvas.removeEventListener('pointercancel', release);
      canvas.removeEventListener('pointerleave', leave);
    };
  }
}
