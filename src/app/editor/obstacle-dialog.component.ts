import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../i18n/translate.pipe';
import { translate as t } from '../i18n/i18n.service';
import { DialogComponent } from '../ui/dialog.component';
import { FieldComponent } from '../ui/field.component';
import { SelectComponent, type SelectOption } from '../ui/select.component';

/** Come si comporta una buca: normale (si cade e si perde 1 ferita), invalicabile (nessuno ci entra) o letale (chi ci cade muore). Vale per tutta la buca. */
export interface ObstacleEdits {
  pitMode: '' | 'blocked' | 'deadly';
}

const MODE_OPTIONS: SelectOption[] = [
  { value: '', get label() { return t('obstacleDialog.normal'); } },
  { value: 'blocked', get label() { return t('obstacleDialog.blocked'); } },
  { value: 'deadly', get label() { return t('obstacleDialog.deadly'); } },
];

/** La dialog di una buca (strumento "Ostacoli e muri", modalità Personalizza): come si comporta per le regole. */
@Component({
  selector: 'app-obstacle-dialog',
  imports: [TranslatePipe, DialogComponent, FieldComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [closeOnBackdrop]="false" [title]="'obstacleDialog.title' | t" width="min(460px, 100%)" (closed)="cancel.emit()">
        <app-field [label]="'obstacleDialog.behavior' | t">
          <app-select class="block" [options]="modeOptions" [value]="mode()" [label]="'obstacleDialog.behavior' | t" (changed)="mode.set($any($event))" />
        </app-field>
        <p class="dlg-hint">{{ (mode() === 'blocked' ? 'obstacleDialog.blockedHint' : mode() === 'deadly' ? 'obstacleDialog.deadlyHint' : 'obstacleDialog.normalHint') | t }}</p>
        <p class="dlg-hint">{{ 'obstacleDialog.wholePit' | t }}</p>
        <ng-container dialogFooter><button type="button" class="dlg-btn primary" (click)="confirm()">{{ 'common.confirm' | t }}</button></ng-container>
      </app-dialog>
    }
  `,
})
export class ObstacleDialogComponent {
  readonly open = input(false);
  readonly value = input<ObstacleEdits | null>(null);
  readonly confirmed = output<ObstacleEdits>();
  readonly cancel = output<void>();

  protected readonly modeOptions = MODE_OPTIONS;
  protected readonly mode = signal<'' | 'blocked' | 'deadly'>('');

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.mode.set(this.value()?.pitMode ?? '');
    });
  }

  protected confirm() {
    this.confirmed.emit({ pitMode: this.mode() });
  }
}
