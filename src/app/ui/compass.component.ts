import { tr } from '../i18n/catalog-text';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, afterNextRender, inject } from '@angular/core';

/** L'ago è un pendolino smorzato (come l'ago di una bussola in mano): ogni tanto riceve una piccola spinta a caso. Misure in gradi e secondi. */
const SWAY = { stiffness: 11, damping: 1.1, kickEvery: [0.7, 2.6], kickSpeed: 14, maxAngle: 5 };

/**
 * L'indicatore del nord: un pallino fisso sullo schermo, in cima alla colonna dei comandi della camera (sta dentro `app-zoom-controls`), nello stile dei pallini solo icona (come le
 * chiavi runiche): nero, bordo sottile, tondo. Dentro, una banderuola cremisi con la punta in su (due metà, una appena più chiara), che oscilla di pochi gradi sul suo perno. La mappa non ruota, quindi il nord è sempre in alto: serve a orientarsi e, essendo dell'interfaccia e non della mappa,
 * resta al suo posto qualunque sia lo zoom.
 */
@Component({
  selector: 'app-compass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 34 34" aria-hidden="true">
      <g class="needle">
        <polygon class="left" points="17,6 10.5,27.5 17,22.5" />
        <polygon class="right" points="17,6 23.5,27.5 17,22.5" />
      </g>
    </svg>
  `,
  host: { role: 'img', '[attr.aria-label]': 'label()', '[attr.title]': 'label()' },
  styles: `
    :host {
      display: block; flex: none; box-sizing: border-box; width: 34px; height: 34px; border-radius: var(--radius-round);
      background: var(--c-surface); border: 1px solid var(--c-line-strong);
      pointer-events: none; user-select: none;
    }
    svg { display: block; width: 100%; height: 100%; fill: var(--cad-compass); }
    @media (pointer: coarse) { :host { width: 44px; height: 44px; } }
    /* La banderuola punta sempre in su ma oscilla appena sul suo perno, come un ago tenuto in mano: pochi gradi, con tempi irregolari. */
    .needle { transform-origin: 17px 17px; transform-box: view-box; }
    .right { opacity: 0.72; }
  `,
})
export class CompassComponent {
  protected readonly label = () => tr('Il nord è in alto');
  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    const zone = inject(NgZone);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const needle = host.nativeElement.querySelector<SVGGElement>('.needle');
      if (!needle || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
      let angle = 0;
      let speed = 0;
      let untilKick = 0.5;
      let last = performance.now();
      let frame = 0;
      const rand = (a: number, b: number) => a + Math.random() * (b - a);
      const tick = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        untilKick -= dt;
        if (untilKick <= 0) {
          speed += (Math.random() < 0.5 ? -1 : 1) * rand(0.3, 1) * SWAY.kickSpeed; // una spinta, a caso per verso e forza
          untilKick = rand(SWAY.kickEvery[0], SWAY.kickEvery[1]);
        }
        speed += (-SWAY.stiffness * angle - SWAY.damping * speed) * dt;
        angle = Math.max(-SWAY.maxAngle, Math.min(SWAY.maxAngle, angle + speed * dt));
        needle.style.transform = `rotate(${angle.toFixed(2)}deg)`;
        frame = requestAnimationFrame(tick);
      };
      zone.runOutsideAngular(() => (frame = requestAnimationFrame(tick)));
      destroyRef.onDestroy(() => cancelAnimationFrame(frame));
    });
  }
}
