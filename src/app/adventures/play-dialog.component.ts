import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TrPipe } from '../i18n/tr.pipe';
import { TranslatePipe } from '../i18n/translate.pipe';
import { DialogComponent } from '../ui/dialog.component';

/**
 * La dialog che si apre scegliendo un'avventura per cui c'è già una partita salvata (senza salvataggio si va dritti alla scelta degli eroi): si può riprendere ("Continua")
 * o cominciare da capo ("Nuova partita", che cancella il salvataggio e porta alla scelta degli eroi).
 */
@Component({
  selector: 'app-play-dialog',
  imports: [DialogComponent, TranslatePipe, TrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog [kicker]="'play.kicker' | t" [title]="title()" [closeOnBackdrop]="false" (closed)="closed.emit()">
      <p class="dlg-hint warn">{{ 'Hai una partita salvata di questa avventura: se ne cominci una nuova, quella salvata sarà cancellata.' | tr }}</p>
      <ng-container dialogFooter>
        <button type="button" class="dlg-btn" (click)="confirm.emit()">{{ 'play.go' | t }}</button>
        <button type="button" class="dlg-btn primary" (click)="resume.emit()">{{ 'home.continue' | t }}</button>
      </ng-container>
    </app-dialog>
  `,
})
export class PlayDialogComponent {
  /** Il titolo dell'avventura scelta. */
  readonly title = input.required<string>();
  readonly closed = output<void>();
  /** "Nuova partita": si passa alla scelta degli eroi. */
  readonly confirm = output<void>();
  readonly resume = output<void>();
}
