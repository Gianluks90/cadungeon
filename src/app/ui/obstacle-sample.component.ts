import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** I tipi di ostacolo che il disegno sa mostrare. */
export type ObstacleSampleKind = 'rock' | 'pit' | 'water';

let uid = 0;

/** Il disegno semplificato di un ostacolo, nei colori della scena (macerie, buca con i raggi a 45°, acqua con le onde): per le schede dell'editor. */
@Component({
  selector: 'app-obstacle-sample',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 48 48" aria-hidden="true">
      @switch (kind()) {
        @case ('rock') { <polygon points="10,28 14,14 27,9 38,17 37,32 26,38 14,36" class="stone" /><path d="M8 40h2M40 10h2M41 38h2" class="debris" /> }
        @case ('pit') {
          <defs><radialGradient [attr.id]="gid" cx="50%" cy="50%" r="70%"><stop offset="0" style="stop-color: #000" /><stop offset="1" style="stop-color: var(--cad-floor)" /></radialGradient></defs>
          <rect x="8" y="8" width="32" height="32" [attr.fill]="'url(#' + gid + ')'" class="pit" /><path d="M8 8l8 8M40 8l-8 8M8 40l8-8M40 40l-8-8" class="ray" />
        }
        @case ('water') { <rect x="6" y="6" width="36" height="36" rx="6" class="water" /><path d="M8 16q4-4 8 0t8 0t8 0t8 0M8 24q4-4 8 0t8 0t8 0t8 0M8 32q4-4 8 0t8 0t8 0t8 0" class="waves" /> }
      }
    </svg>
  `,
  styles: `
    :host { display: inline-block; width: 64px; height: 64px; }
    svg { display: block; width: 100%; height: 100%; }
    .stone { fill: var(--cad-stone-fill); stroke: var(--cad-stone-line); stroke-width: 1.5; stroke-linejoin: round; }
    .debris { stroke: var(--cad-stone-line); stroke-width: 2; stroke-linecap: round; opacity: 0.55; }
    .pit { stroke: var(--cad-pit-line); stroke-width: 1; stroke-opacity: 0.5; }
    .ray { stroke: var(--cad-pit-ray); stroke-width: 1; opacity: 0.5; fill: none; }
    .water { fill: color-mix(in srgb, var(--cad-water) 7%, transparent); stroke: var(--cad-water); stroke-width: 1.2; }
    .waves { fill: none; stroke: var(--cad-water); stroke-width: 1; opacity: 0.4; }
  `,
})
export class ObstacleSampleComponent {
  readonly kind = input<ObstacleSampleKind>('rock');
  protected readonly gid = `obstacle-sample-${uid++}`;
}
