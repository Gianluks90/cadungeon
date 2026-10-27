import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DialogComponent } from './dialog.component';

/** Una piccola dialog di conferma: un titolo, una frase e due bottoni (annulla, e l'azione). La X, Esc o un tocco fuori valgono "annulla". */
@Component({
  selector: 'app-confirm-dialog',
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [title]="title()" width="min(420px, 100%)" (closed)="cancel.emit()">
        <p>{{ text() }}</p>
        <ng-container dialogFooter>
          <button type="button" class="dlg-btn" (click)="cancel.emit()">Annulla</button>
          <button type="button" class="dlg-btn danger" (click)="confirmed.emit()">{{ confirmLabel() }}</button>
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
  readonly title = input('Conferma');
  readonly text = input('');
  readonly confirmLabel = input('Conferma');
  readonly confirmed = output<void>();
  readonly cancel = output<void>();
}
