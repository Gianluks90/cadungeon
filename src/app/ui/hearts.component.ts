import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HeartComponent } from './heart.component';

/** Le ferite di una creatura come una fila di cuori: ogni cuore vale 4 punti. */
@Component({
  selector: 'app-hearts',
  imports: [HeartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (p of hearts(); track $index) { <app-heart [points]="p" [size]="size()" /> } @for (p of poisonHearts(); track $index) { <app-heart [points]="p" [size]="size()" [poison]="true" [title]="'Veleno'" /> }`,
  styles: `:host { display: inline-flex; flex-wrap: wrap; gap: 2px; }`,
})
export class HeartsComponent {
  readonly wounds = input.required<number>();
  readonly max = input.required<number>();
  readonly size = input(16);
  /** I segnalini veleno: ogni quarto di cuore verde accanto ai cuori delle ferite è un segnalino. */
  readonly poison = input(0);
  protected readonly poisonHearts = computed(() => Array.from({ length: Math.ceil(this.poison() / 4) }, (_, i) => Math.min(4, this.poison() - 4 * i)));
  /** I punti di ogni cuore, dal primo: 4 se pieno, meno se ferito, 0 se vuoto. */
  protected readonly hearts = computed(() =>
    Array.from({ length: Math.ceil(this.max() / 4) }, (_, i) => Math.max(0, Math.min(4, this.wounds() - 4 * i))),
  );
}
