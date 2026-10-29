import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent } from './icon.component';

/** I tipi di porta che il disegno sa mostrare. */
export type DoorSampleKind = 'normal' | 'key' | 'event' | 'red' | 'green' | 'blue';

let uid = 0;

/**
 * Il disegno di una porta chiusa come la fa la scena: due tratti di muro ai lati e, nel varco, un rettangolo sottile con il tratteggio diagonale nel colore delle porte
 * (incrociato se ha una serratura), con sopra il lucchetto (chiave) o il rombo nel colore della runa. È una versione in SVG dello stesso disegno, per le schede dell'editor.
 */
@Component({
  selector: 'app-door-sample',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <pattern [attr.id]="pid" width="3.5" height="3.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path [attr.d]="locked() ? 'M0 0V3.5M0 0H3.5' : 'M0 0V3.5'" class="hatch" /></pattern>
      </defs>
      <rect x="0" y="18" width="12" height="12" class="gap" /><rect x="36" y="18" width="12" height="12" class="gap" />
      <path d="M0 18H12M0 30H12M36 18H48M36 30H48" class="wall" />
      <rect x="14" y="21" width="20" height="6" [attr.fill]="'url(#' + pid + ')'" class="leaf" />
    </svg>
    @if (badge(); as b) {
      <span class="badge" [style.--tone]="b.tone"><app-icon [name]="b.icon" [size]="11" /></span>
    }
  `,
  styles: `
    :host { position: relative; display: inline-block; width: 64px; height: 64px; }
    svg { display: block; width: 100%; height: 100%; }
    .gap { fill: var(--cad-wall-gap); }
    .wall { fill: none; stroke: var(--cad-wall); stroke-width: 2; }
    .leaf { stroke: var(--cad-door); stroke-width: 1; stroke-opacity: 0.8; }
    .hatch { stroke: var(--cad-door); stroke-width: 1; opacity: 0.4; }
    .badge { position: absolute; left: 50%; top: 50%; width: 20px; height: 20px; margin: -10px 0 0 -10px; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-round); background: var(--cad-floor); border: 1px solid var(--tone); color: var(--tone); }
  `,
})
export class DoorSampleComponent {
  readonly kind = input<DoorSampleKind>('normal');
  protected readonly pid = `door-sample-${uid++}`;
  protected readonly locked = computed(() => this.kind() !== 'normal');
  protected readonly badge = computed(() => {
    const k = this.kind();
    if (k === 'normal') return null;
    if (k === 'key') return { icon: 'tokens/padlock', tone: 'var(--c-loot)' };
    if (k === 'event') return { icon: 'bolt', tone: 'var(--c-interact)' };
    return { icon: 'diamond', tone: `var(--cad-rune-${k})` };
  });
}
