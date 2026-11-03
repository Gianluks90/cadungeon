import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MapPickService, PickKind } from '../ui/map-pick.service';
import { SelectComponent, SelectOption } from '../ui/select.component';
import { PickButtonComponent } from './pick-button.component';

/**
 * Una scelta di un elemento della mappa (nemico, segnalino, glifo, scala, ostacolo, porta, area): il menu a tendina di sempre più i tasti "Seleziona in mappa" e "Mostrami dov'è"
 * (alti come i campi). Il valore scelto con un clic sulla mappa arriva da `changed`, come se fosse stato scelto dal menu: chi lo usa gestisce un solo evento.
 * `locatable` falso toglie "Mostrami dov'è" (per i menu che servono ad aggiungere a un elenco: il valore resta sempre vuoto).
 */
@Component({
  selector: 'app-map-select',
  imports: [SelectComponent, PickButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-select class="block" [options]="options()" [value]="value()" [placeholder]="placeholder()" [label]="label()" (changed)="changed.emit($event)" />
    <app-pick-button [located]="locatable() && !!value()" (pick)="pick()" (locate)="locate()" />
  `,
  styles: `
    :host { display: flex; align-items: center; gap: 6px; min-width: 0; }
    app-select { flex: 1 1 auto; min-width: 0; }
  `,
})
export class MapSelectComponent {
  private readonly mapPick = inject(MapPickService, { optional: true });
  readonly kind = input.required<PickKind>();
  readonly options = input<SelectOption[]>([]);
  readonly value = input('');
  readonly placeholder = input('');
  readonly label = input('');
  readonly locatable = input(true);
  readonly changed = output<string>();

  protected pick() {
    this.mapPick?.ask({ kind: this.kind(), apply: (v) => this.changed.emit(v) });
  }

  protected locate() {
    if (this.value()) this.mapPick?.ask({ kind: this.kind(), value: this.value() });
  }
}
