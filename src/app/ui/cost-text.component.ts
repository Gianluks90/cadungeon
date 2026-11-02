import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { costSegments } from './cost-text';
import { IconComponent } from './icon.component';

/** Un testo in cui i costi sono valore e icona: `{mov:N}` con le impronte in verde, `{energy:N}` con la goccia in arancione. */
@Component({
  selector: 'app-cost-text',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (s of segments(); track $index) { @if ('mov' in s) { <span class="cost"><app-icon name="footprint" [size]="14" />{{ s.mov }}</span> } @else if ('energy' in s) { <span class="cost energy"><app-icon name="water_drop" [size]="14" />{{ s.energy }}</span> } @else { {{ s.text }} } }`,
  styles: `
    :host { display: inline; }
    .cost { display: inline-flex; align-items: center; gap: var(--cost-gap, 3px); vertical-align: -2px; color: var(--c-move); font-weight: 600; font-variant-numeric: tabular-nums; }
    .cost.energy { color: var(--c-energy); }
  `,
})
export class CostTextComponent {
  readonly text = input.required<string>();
  protected readonly segments = computed(() => costSegments(this.text()));
}
