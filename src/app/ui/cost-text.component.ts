import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { costSegments } from './cost-text';
import { IconComponent } from './icon.component';

/** Un testo in cui i costi sono valore e icona: `{mov:N}` con le impronte in verde, `{fat:N}` con la goccia in arancione. */
@Component({
  selector: 'app-cost-text',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (s of segments(); track $index) { @if ('mov' in s) { <span class="cost"><app-icon name="footprint" [size]="14" />{{ s.mov }}</span> } @else if ('fat' in s) { <span class="cost fat"><app-icon name="water_drop" [size]="14" />{{ s.fat }}</span> } @else { {{ s.text }} } }`,
  styles: `
    :host { display: inline; }
    .cost { display: inline-flex; align-items: center; gap: var(--cost-gap, 3px); vertical-align: -2px; color: var(--c-speed); font-weight: 600; font-variant-numeric: tabular-nums; }
    .cost.fat { color: var(--c-stamina); }
  `,
})
export class CostTextComponent {
  readonly text = input.required<string>();
  protected readonly segments = computed(() => costSegments(this.text()));
}
