import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AttackDice } from '../game/heroes/hero-sheet';
import { IconComponent } from './icon.component';

/** I dadi d'attacco extra di un eroe: per ogni tipo (mischia, distanza, magia) il nome e un cubo per ogni dado; a zero, un trattino. */
@Component({
  selector: 'app-attack-dice',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (d of rows(); track d.label) {
      <span class="die" [class.none]="!d.count" [title]="d.label + ': ' + d.count + (d.count === 1 ? ' dado' : ' dadi')">
        <small>{{ d.label }}</small>
        <span class="cubes">
          @for (n of cubes(d.count); track n) { <app-icon name="deployed_code" [size]="20" /> }
          @if (!d.count) { <span class="zero">–</span> }
        </span>
      </span>
    }
  `,
  styles: `
    :host { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; color: var(--cad-ui-text, #d8cfc4); font: 13px/1.35 system-ui, sans-serif; }
    .die { display: inline-flex; flex-direction: column; gap: 3px; min-width: 76px; font-weight: 600; }
    small { font-weight: 400; color: var(--cad-ui-text-muted, #8a8178); }
    .cubes { display: inline-flex; align-items: center; gap: 2px; min-height: 20px; }
    .zero { color: var(--cad-ui-text-muted, #8a8178); }
    .die.none { opacity: 0.4; }
  `,
})
export class AttackDiceComponent {
  readonly dice = input.required<AttackDice>();

  protected rows(): { label: string; count: number }[] {
    const d = this.dice();
    return [
      { label: 'Mischia', count: d.melee },
      { label: 'Distanza', count: d.ranged },
      { label: 'Magia', count: d.magic },
    ];
  }

  protected cubes(n: number): number[] {
    return Array.from({ length: Math.max(0, n) }, (_, i) => i);
  }
}
