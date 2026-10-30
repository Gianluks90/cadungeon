import { TrPipe } from '../i18n/tr.pipe';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DialogComponent } from './dialog.component';

/** Una piccola dialog di conferma: un titolo, una frase e il bottone dell'azione. Per annullare ci sono la X, Esc o un tocco fuori (niente bottone "Annulla"). Con `danger` spento è un semplice avviso. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [TrPipe, DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [title]="title() || ('Conferma' | tr)" width="min(420px, 100%)" (closed)="cancel.emit()">
        <p>{{ text() }}</p>
        <ng-container dialogFooter>
          <button type="button" class="dlg-btn" [class.danger]="danger()" (click)="confirmed.emit()">{{ confirmLabel() || ('Conferma' | tr) }}</button>
        </ng-container>
      </app-dialog>
    }
  `,
  styles: `
    p { margin: 0; color: var(--c-text-dim); }
    .danger { border-color: var(--c-danger); }
    .danger:hover, .danger:focus-visible { color: var(--c-danger); border-color: var(--c-danger); }
  `,
})
export class ConfirmDialogComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly text = input('');
  readonly confirmLabel = input('');
  /** Il bottone ha il bordo rosso (azioni che fanno perdere qualcosa); spento per un semplice avviso. */
  readonly danger = input(true);
  readonly confirmed = output<void>();
  readonly cancel = output<void>();
}
