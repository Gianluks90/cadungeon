import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../i18n/translate.pipe';
import { IconComponent } from '../ui/icon.component';

/**
 * I due tasti accanto a una scelta di un elemento della mappa (nemico, segnalino, glifo, scala, ostacolo): "Seleziona in mappa" (la dialog si nasconde e un clic sull'elemento lo sceglie)
 * e, se c'è già una scelta, "Mostrami dov'è" (la dialog si nasconde, la camera va sull'elemento e lo evidenzia).
 */
@Component({
  selector: 'app-pick-button',
  imports: [TranslatePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="dlg-btn pick" [title]="'pick.select' | t" [attr.aria-label]="'pick.select' | t" (click)="pick.emit()"><app-icon name="target" [size]="18" /></button>
    @if (located()) {
      <button type="button" class="dlg-btn pick" [title]="'pick.locate' | t" [attr.aria-label]="'pick.locate' | t" (click)="locate.emit()"><app-icon name="visibility" [size]="18" /></button>
    }
  `,
  styles: `
    :host { display: inline-flex; gap: 6px; flex: none; }
    /* Alti come i campi delle dialog (36 px, 42 col dito). */
    .pick { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; padding: 0; width: 36px; height: 36px; }
    @media (pointer: coarse) { .pick { width: 42px; height: 42px; } }
  `,
})
export class PickButtonComponent {
  /** C'è già un elemento scelto: compare anche "Mostrami dov'è". */
  readonly located = input(false);
  readonly pick = output<void>();
  readonly locate = output<void>();
}
