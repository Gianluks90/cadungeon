import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../i18n/translate.pipe';
import { translate as t } from '../i18n/i18n.service';
import { DialogComponent } from '../ui/dialog.component';
import { FieldComponent } from '../ui/field.component';
import { CheckboxComponent } from '../ui/checkbox.component';
import { SelectComponent, type SelectOption } from '../ui/select.component';

/** Come parte una scalinata: già crollata o no, e cosa c'è al posto delle sue scale quando è crollata. Vale per tutte e due le scale della coppia. */
export interface StairsEdits {
  collapsed: boolean;
  leaves: 'rock' | 'pit' | 'none';
}

const LEAVES_OPTIONS: SelectOption[] = [
  { value: 'rock', get label() { return t('obstacle.rock'); } },
  { value: 'pit', get label() { return t('obstacle.pit'); } },
  { value: 'none', get label() { return t('stairsDialog.none'); } },
];

/**
 * La dialog di una scalinata (strumento "Porte e passaggi", modalità Personalizza): "Parte crollata" (la scalinata non c'è all'inizio, un evento può farla comparire) e l'ostacolo
 * 1×1 che prende il posto di ogni scala quando è crollata (macerie o buca).
 */
@Component({
  selector: 'app-stairs-dialog',
  imports: [TranslatePipe, DialogComponent, FieldComponent, CheckboxComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [closeOnBackdrop]="false" [title]="'stairsDialog.title' | t" width="min(460px, 100%)" (closed)="cancel.emit()">
        <app-checkbox [checked]="collapsed()" (changed)="collapsed.set($event)">{{ 'stairsDialog.collapsed' | t }}</app-checkbox>
        <app-field [label]="'stairsDialog.leaves' | t">
          <app-select class="block" [options]="leavesOptions" [value]="leaves()" [label]="'stairsDialog.leaves' | t" (changed)="leaves.set($any($event))" />
        </app-field>
        <p class="dlg-hint">{{ 'stairsDialog.hint' | t }}</p>
        <ng-container dialogFooter><button type="button" class="dlg-btn primary" (click)="confirm()">{{ 'common.confirm' | t }}</button></ng-container>
      </app-dialog>
    }
  `,
})
export class StairsDialogComponent {
  readonly open = input(false);
  readonly value = input<StairsEdits | null>(null);
  readonly confirmed = output<StairsEdits>();
  readonly cancel = output<void>();

  protected readonly leavesOptions = LEAVES_OPTIONS;
  protected readonly collapsed = signal(false);
  protected readonly leaves = signal<'rock' | 'pit' | 'none'>('rock');

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const v = this.value();
      this.collapsed.set(v?.collapsed ?? false);
      this.leaves.set(v?.leaves ?? 'rock');
    });
  }

  protected confirm() {
    this.confirmed.emit({ collapsed: this.collapsed(), leaves: this.leaves() });
  }
}
