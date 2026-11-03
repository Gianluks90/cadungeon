import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../i18n/translate.pipe';
import { CheckboxComponent } from '../ui/checkbox.component';
import { DialogComponent } from '../ui/dialog.component';
import { FieldComponent } from '../ui/field.component';

/** Come si usa una zona di innesco: il testo dell'azione nel menu del "!", i punti movimento che costa e se si può usare più volte. */
export interface ZoneEdits {
  label: string;
  cost: number;
  /** Parte disattivata: un evento la attiva. */
  off: boolean;
}

/**
 * La dialog di una zona di innesco (strumento Zone): il testo dell'azione che l'eroe trova nel menu quando è adiacente a una sua casella ("Getta la reliquia"; vuoto = "Usa"), il costo
 * in punti movimento (di base 0, non si paga se scatta solo l'"Altrimenti") e "Parte disattivata". Una zona non si consuma mai da sola: la spegne un effetto. L'azione compare solo se un evento
 * "un eroe usa una zona" farebbe qualcosa adesso (con le condizioni valide, o con un ramo "Altrimenti").
 */
@Component({
  selector: 'app-zone-dialog',
  imports: [TranslatePipe, DialogComponent, FieldComponent, CheckboxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [closeOnBackdrop]="false" [title]="name() || ('zoneDialog.title' | t)" width="min(460px, 100%)" (closed)="cancel.emit()">
        <app-field [label]="'zoneDialog.action' | t" [note]="'encounterDialog.optional' | t">
          <input type="text" autocomplete="off" maxlength="40" [placeholder]="'zoneDialog.actionExample' | t" [value]="label()" (input)="label.set($any($event.target).value)" />
        </app-field>
        <app-field [label]="'encounterDialog.cost' | t">
          <input type="number" min="0" step="1" [class.bad]="!costOk()" [value]="cost()" (input)="cost.set($any($event.target).value)" />
        </app-field>
        <app-checkbox [checked]="off()" (changed)="off.set($event)">{{ 'zoneDialog.startsOff' | t }}</app-checkbox>
        <p class="dlg-hint">{{ 'zoneDialog.hint' | t }}</p>
        <ng-container dialogFooter><button type="button" class="dlg-btn primary" [class.off]="!costOk()" [attr.aria-disabled]="!costOk()" (click)="confirm()">{{ 'common.confirm' | t }}</button></ng-container>
      </app-dialog>
    }
  `,
})
export class ZoneDialogComponent {
  readonly open = input(false);
  /** Il nome della zona (per il titolo). */
  readonly name = input('');
  readonly value = input<ZoneEdits | null>(null);
  readonly confirmed = output<ZoneEdits>();
  readonly cancel = output<void>();

  protected readonly label = signal('');
  protected readonly cost = signal('0');
  protected readonly off = signal(false);
  protected readonly costOk = computed(() => /^\d+$/.test(this.cost().trim()));

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const v = this.value();
      this.label.set(v?.label ?? '');
      this.cost.set(String(v?.cost ?? 0));
      this.off.set(!!v?.off);
    });
  }

  protected confirm() {
    if (!this.costOk()) return;
    this.confirmed.emit({ label: this.label().trim(), cost: Number(this.cost().trim()), off: this.off() });
  }
}
