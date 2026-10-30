import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, afterNextRender, inject, viewChild } from '@angular/core';

/**
 * I puntini dello sfondo della home e la scia del mouse (misure in pixel e millisecondi): `reach` è quanto lontano si fa sentire il puntatore, `glowMs` e `accentMs` il tempo con cui
 * la luce e il colore di accento svaniscono (il colore prima, così resta una scia più chiara che si spegne piano).
 */
const DOTS = { spacing: 26, radius: 1.3, restAlpha: 0.55, glowRadius: 2.6, accentBump: 0.5, reach: 42, glowMs: 110, accentMs: 70 };

/**
 * Lo sfondo a puntini della home: fermi e discreti, si illuminano al passaggio del mouse (o del dito che trascina). Il puntino più vicino al puntatore prende il colore di accento
 * (`--c-interact`), quelli intorno si schiariscono sempre meno man mano che sono lontani; poi tutto svanisce piano e dietro al puntatore resta una scia. Il colore dei puntini è
 * `--c-dot`, quello della luce `--c-text`. Con la riduzione del movimento restano solo i puntini fermi.
 */
@Component({
  selector: 'app-dot-trail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<canvas #dots aria-hidden="true"></canvas>',
  styles: `
    :host { position: absolute; inset: 0; display: block; pointer-events: none; }
    canvas { display: block; width: 100%; height: 100%; }
  `,
})
export class DotTrailComponent {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('dots');
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.run()));
  }

  private run() {
    const canvas = this.canvas().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const dotColor = css.getPropertyValue('--c-dot').trim() || '#6b635a';
    const lightColor = css.getPropertyValue('--c-text').trim() || '#ffffff';
    const accentColor = css.getPropertyValue('--c-interact').trim() || '#f0b429';
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    const s = DOTS.spacing;
    let w = 0;
    let h = 0;
    let nx = 0;
    let ny = 0;
    let cols = 0;
    /** Per ogni puntino: quanto è schiarito e quanto ha il colore di accento (0-1). La griglia è centrata: un puntino cade al centro. */
    let glow = new Float32Array(0);
    let accent = new Float32Array(0);
    const index = (i: number, j: number) => (j + ny) * cols + (i + nx);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nx = Math.ceil(w / 2 / s) + 1;
      ny = Math.ceil(h / 2 / s) + 1;
      cols = 2 * nx + 1;
      glow = new Float32Array(cols * (2 * ny + 1));
      accent = new Float32Array(glow.length);
      draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      for (let j = -ny; j <= ny; j++) {
        for (let i = -nx; i <= nx; i++) {
          const k = index(i, j);
          const lit = glow[k];
          const hot = accent[k];
          const x = cx + i * s;
          const y = cy + j * s;
          ctx.globalAlpha = DOTS.restAlpha + (1 - DOTS.restAlpha) * lit;
          ctx.fillStyle = lit > 0.02 ? lightColor : dotColor;
          ctx.beginPath();
          ctx.arc(x, y, DOTS.radius + (DOTS.glowRadius - DOTS.radius) * lit, 0, Math.PI * 2);
          ctx.fill();
          if (hot > 0.02) {
            ctx.globalAlpha = hot;
            ctx.fillStyle = accentColor;
            ctx.beginPath();
            ctx.arc(x, y, DOTS.radius + (DOTS.glowRadius + DOTS.accentBump - DOTS.radius) * Math.max(lit, hot), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    this.destroyRef.onDestroy(() => observer.disconnect());
    if (reduce) return; // niente movimento: solo i puntini fermi

    let frame = 0;
    let last = 0;
    const step = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      const g = Math.exp(-dt / DOTS.glowMs);
      const a = Math.exp(-dt / DOTS.accentMs);
      let alive = false;
      for (let k = 0; k < glow.length; k++) {
        if (glow[k] > 0.003) { glow[k] *= g; alive = true; } else glow[k] = 0;
        if (accent[k] > 0.003) { accent[k] *= a; alive = true; } else accent[k] = 0;
      }
      draw();
      frame = alive ? requestAnimationFrame(step) : 0; // finita la scia si smette di disegnare
    };

    const move = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const cx = w / 2;
      const cy = h / 2;
      const span = Math.ceil(DOTS.reach / s);
      const i0 = Math.round((px - cx) / s);
      const j0 = Math.round((py - cy) / s);
      for (let j = j0 - span; j <= j0 + span; j++) {
        for (let i = i0 - span; i <= i0 + span; i++) {
          if (i < -nx || i > nx || j < -ny || j > ny) continue;
          const d = Math.hypot(cx + i * s - px, cy + j * s - py);
          if (d >= DOTS.reach) continue;
          const t = 1 - d / DOTS.reach;
          const k = index(i, j);
          glow[k] = Math.max(glow[k], 0.8 * t * t * (3 - 2 * t)); // più lontano, meno schiarito
        }
      }
      // Il puntino più vicino al puntatore: la luce al massimo e il colore di accento.
      if (i0 >= -nx && i0 <= nx && j0 >= -ny && j0 <= ny) {
        const k = index(i0, j0);
        glow[k] = 1;
        accent[k] = 1;
      }
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(step);
      }
    };
    window.addEventListener('pointermove', move, { passive: true });
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('pointermove', move);
      cancelAnimationFrame(frame);
    });
  }
}
