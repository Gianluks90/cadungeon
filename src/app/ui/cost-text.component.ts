import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { costSegments } from './cost-text';
import { IconComponent } from './icon.component';

/** Un testo in cui il costo `{mov:N}` è il valore con l'icona delle impronte, in verde. */
@Component({
  selector: 'app-cost-text',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (s of segments(); track $index) { @if ('mov' in s) { <span class="cost"><app-icon name="footprint" [size]="14" />{{ s.mov }}</span> } @else { {{ s.text }} } }`,
  styles: `
    :host { display: inline; }
    .cost { display: inline-flex; align-items: center; gap: 3px; vertical-align: -2px; color: var(--c-speed); font-weight: 600; font-variant-numeric: tabular-nums; }
  `,
})
export class CostTextComponent {
  readonly text = input.required<string>();
  protected readonly segments = computed(() => costSegments(this.text()));
}
