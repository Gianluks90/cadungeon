import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, afterNextRender, inject, viewChild } from '@angular/core';

/** I puntini dello sfondo e l'onda che li accende partendo dal centro (misure in pixel e secondi). */
const DOTS = { spacing: 32, radius: 1.3, restAlpha: 0.55, waveRadius: 2.3, waveWidth: 170, speed: 340, pause: 0.6 };

/**
 * Lo sfondo a puntini con l'onda che parte dal centro: riempie il suo contenitore (che deve essere `position` diverso da `static`; nella home è tutta la pagina).
 * È il caricamento dell'app: la home, il caricamento delle partite e la lobby lo mettono dietro il loro contenuto, che sta sopra (il logo nel cerchio pieno copre il centro).
 * Il colore dei puntini è `--c-dot`, quello dell'onda `--c-text` e quello del suo culmine `--c-interact` (giallo). Con la riduzione del movimento restano solo i puntini fermi.
 */
@Component({
  selector: 'app-dot-wave',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<canvas #dots aria-hidden="true"></canvas>',
  styles: `
    :host { position: absolute; inset: 0; display: block; pointer-events: none; }
    canvas { display: block; width: 100%; height: 100%; }
  `,
})
export class DotWaveComponent {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('dots');
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.runDots()));
  }

  /** I puntini: una griglia fitta centrata sullo schermo; un'onda parte dal centro, si allarga fino a uscire dallo schermo e ricomincia. */
  private runDots() {
    const canvas = this.canvas().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const dotColor = css.getPropertyValue('--c-dot').trim() || '#6b635a';
    const waveColor = css.getPropertyValue('--c-text').trim() || '#ffffff';
    const peakColor = css.getPropertyValue('--c-interact').trim() || '#f0b429'; // il punto più alto dell'onda
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(() => {
      resize();
      if (reduce) draw(-1000);
    });
    observer.observe(canvas);

    const draw = (front: number) => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const s = DOTS.spacing;
      // La griglia è centrata: un puntino cade proprio al centro.
      const nx = Math.ceil(cx / s) + 1;
      const ny = Math.ceil(cy / s) + 1;
      for (let j = -ny; j <= ny; j++) {
        for (let i = -nx; i <= nx; i++) {
          const x = cx + i * s;
          const y = cy + j * s;
          // Quanto l'onda sta sopra questo puntino: 1 sul fronte, 0 lontano (arriva piano, e dietro il fronte si spegne più lentamente).
          const d = Math.hypot(x - cx, y - cy) - front;
          const k = d > 0 ? Math.max(0, 1 - d / (DOTS.waveWidth * 0.35)) : Math.max(0, 1 - -d / DOTS.waveWidth);
          const lit = k * k * (3 - 2 * k);
          ctx.globalAlpha = DOTS.restAlpha + (1 - DOTS.restAlpha) * lit;
          ctx.fillStyle = lit > 0.02 ? waveColor : dotColor;
          ctx.beginPath();
          ctx.arc(x, y, DOTS.radius + (DOTS.waveRadius - DOTS.radius) * lit, 0, Math.PI * 2);
          ctx.fill();
          // Sul culmine dell'onda il puntino vira al giallo (si sovrappone al bianco con un'opacità che cresce vicino al massimo).
          const peak = Math.max(0, (lit - 0.55) / 0.45);
          if (peak > 0.02) {
            ctx.globalAlpha = peak;
            ctx.fillStyle = peakColor;
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    if (reduce) {
      draw(-1000); // niente movimento: solo i puntini a riposo
      this.destroyRef.onDestroy(() => observer.disconnect());
      return;
    }
    let frame = 0;
    let t = 0;
    let last = performance.now();
    const tick = (now: number) => {
      t += Math.min(0.05, (now - last) / 1000);
      last = now;
      // Il fronte parte dal centro e finisce quando anche la coda ha lasciato lo schermo; poi una breve pausa e si ricomincia.
      const end = Math.hypot(w, h) / 2 + DOTS.waveWidth;
      const travel = end / DOTS.speed;
      if (t > travel + DOTS.pause) t = 0;
      draw(Math.min(t, travel) * DOTS.speed);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    });
  }
}
