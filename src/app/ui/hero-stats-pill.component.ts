import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../i18n/translate.pipe';
import { IconComponent } from './icon.component';

/** Una pillola con la velocità (impronte, verde) e la fatica (goccia, arancione) di un eroe, come nei tab della partita. Chi la usa la posiziona (di solito sopra il piede di una carta). */
@Component({
  selector: 'app-hero-stats-pill',
  imports: [IconComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="v speed" [title]="'stats.speed' | t"><app-icon name="footprint" [size]="16" />{{ speed() }}</span>
    <span class="v fatigue" [title]="'stats.fatigue' | t"><app-icon name="water_drop" [size]="16" />{{ fatigue() }}</span>
  `,
  styles: `
    :host { display: inline-flex; align-items: center; justify-content: center; gap: 12px; box-sizing: border-box; height: 40px; padding: 0 12px; border-radius: var(--radius-1); background: var(--c-bg); border: 1px solid var(--c-line-strong); font: 700 14px/1 var(--font-mono); letter-spacing: 0; text-transform: none; }
    .v { display: inline-flex; align-items: center; gap: 4px; }
    .speed { color: var(--c-speed); }
    .fatigue { color: var(--c-stamina); }
  `,
})
export class HeroStatsPillComponent {
  readonly speed = input.required<number>();
  readonly fatigue = input.required<number>();
}
