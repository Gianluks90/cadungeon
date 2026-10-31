import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../i18n/translate.pipe';

/** I 32 vertici della stella a 16 punte (la stessa del Valore nei pannelli dell'eroe). */
const BURST = Array.from({ length: 32 }, (_, i) => {
  const a = (i * Math.PI) / 16 - Math.PI / 2;
  const r = i % 2 === 0 ? 24 : 19;
  return `${(25 + r * Math.cos(a)).toFixed(2)},${(25 + r * Math.sin(a)).toFixed(2)}`;
}).join(' ');

/** Il Valore di un eroe (la Conquista che il gruppo perde se muore): una stella a 16 punte, nera, con il bordo sottile e il numero al centro. Chi la usa la posiziona. */
@Component({
  selector: 'app-value-star',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="in" [title]="'detail.valueHint' | t" [attr.aria-label]="('detail.value' | t) + ' ' + value()"><svg viewBox="0 0 50 50" aria-hidden="true"><polygon [attr.points]="burst" /></svg><b>{{ value() }}</b></span>`,
  styles: `
    :host { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; }
    .in { position: absolute; inset: 0; display: inline-flex; align-items: center; justify-content: center; }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    polygon { fill: var(--c-bg); stroke: var(--c-line-strong); stroke-width: 1; stroke-linejoin: round; }
    b { position: relative; font: 700 14px/1 var(--font-mono); letter-spacing: 0; text-transform: none; color: var(--c-text); }
  `,
})
export class ValueStarComponent {
  readonly value = input.required<number>();
  protected readonly burst = BURST;
}
