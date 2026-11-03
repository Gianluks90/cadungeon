import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CostKind, costSegments } from './cost-text';
import { IconComponent } from './icon.component';

/** Le icone dei valori: impronte (movimento), goccia (energia) e teschio (Odio). */
const ICONS: Record<CostKind, string> = { mov: 'footprint', energy: 'water_drop', hatred: 'skull' };

/** Un testo in cui i valori sono numero e icona: `{mov:N}` con le impronte gialle, `{energy:N}` con la goccia verde, `{hatred:N}` con il teschio rosso; senza numero solo l'icona. */
@Component({
  selector: 'app-cost-text',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (s of segments(); track $index) { @if ('kind' in s) { <span class="cost" [class.energy]="s.kind === 'energy'" [class.hatred]="s.kind === 'hatred'">@if (s.n === null) { <app-icon [name]="iconOf(s.kind)" [size]="14" /> } @else { @if (!numberFirst()) { <app-icon [name]="iconOf(s.kind)" [size]="14" /> }{{ s.n }}@if (numberFirst()) { <app-icon [name]="iconOf(s.kind)" [size]="14" /> } }</span> } @else { {{ s.text }} } }`,
  styles: `
    :host { display: inline; }
    .cost { display: inline-flex; align-items: center; gap: var(--cost-gap, 3px); vertical-align: -2px; color: var(--c-move); font-weight: 600; font-variant-numeric: tabular-nums; }
    .cost.energy { color: var(--c-energy); }
    .cost.hatred { color: var(--c-hatred); }
  `,
})
export class CostTextComponent {
  readonly text = input.required<string>();
  /** Nelle frasi descrittive (carte, abilità) il valore viene prima dell'icona ("spendere 3 💧"); nei bottoni e nelle notizie l'icona sta prima del valore. */
  readonly numberFirst = input(false);
  protected readonly segments = computed(() => costSegments(this.text()));
  protected iconOf(kind: CostKind): string {
    return ICONS[kind];
  }
}