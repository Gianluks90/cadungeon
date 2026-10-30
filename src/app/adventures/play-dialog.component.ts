import { TrPipe } from '../i18n/tr.pipe';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { DialogComponent } from '../ui/dialog.component';
import { FieldComponent } from '../ui/field.component';
import { SelectComponent, SelectOption } from '../ui/select.component';

/** Come si gioca: da solo, in più persone sullo stesso schermo o online (non ancora disponibile). */
export type PlayMode = 'single' | 'local' | 'online';
/** Chi è il Signore supremo: lo script del gioco o una persona. */
export type OverlordKind = 'script' | 'human';

/** La scelta fatta nella dialog. */
export interface PlayChoice {
  mode: PlayMode;
  overlord: OverlordKind;
}

/**
 * La dialog che si apre scegliendo un'avventura: il modo di giocare (singolo, multiplayer locale, online, ancora spento) e chi è il Signore supremo (automatico o umano). Da solo il
 * Signore supremo è sempre automatico, quindi il secondo menu è spento e mostra quella voce. `confirm` porta la scelta a chi apre la dialog.
 */
@Component({
  selector: 'app-play-dialog',
  imports: [DialogComponent, FieldComponent, SelectComponent, TranslatePipe, TrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog [kicker]="'play.kicker' | t" [title]="title()" [closeOnBackdrop]="false" (closed)="closed.emit()">
      <div class="body">
        <app-field [label]="'play.mode' | t">
          <app-select class="block" [options]="modes()" [value]="mode()" [label]="'play.mode' | t" (changed)="setMode($any($event))" />
        </app-field>
        <p class="dlg-hint">{{ hint() }}</p>
        @if (hasSave()) { <p class="dlg-hint warn">{{ 'Hai una partita salvata di questa avventura: se ne cominci una nuova, quella salvata sarà cancellata.' | tr }}</p> }
        <app-field [label]="'play.overlord' | t">
          <app-select class="block" [options]="overlords()" [value]="overlord()" [disabled]="mode() === 'single'" [label]="'play.overlord' | t" (changed)="setOverlord($any($event))" />
        </app-field>
      </div>
      <ng-container dialogFooter>
        @if (hasSave()) { <button type="button" class="dlg-btn" (click)="resume.emit()">{{ 'home.continue' | t }}</button> }
        <button type="button" class="dlg-btn primary" (click)="confirm.emit({ mode: mode(), overlord: overlord() })">{{ 'play.go' | t }}</button>
      </ng-container>
    </app-dialog>
  `,
  styles: `
    .body { display: flex; flex-direction: column; gap: 14px; }
  `,
})
export class PlayDialogComponent {
  /** Il titolo dell'avventura scelta. */
  readonly title = input.required<string>();
  readonly closed = output<void>();
  readonly confirm = output<PlayChoice>();
  /** C'è una partita salvata di questa avventura: si può riprenderla invece di cominciarne una nuova. */
  readonly hasSave = input(false);
  readonly resume = output<void>();

  private readonly i18n = inject(I18nService);
  protected readonly modes = computed<SelectOption[]>(() => [
    { value: 'single', label: this.i18n.t('play.mode.single') },
    { value: 'local', label: this.i18n.t('play.mode.local') },
    { value: 'online', label: this.i18n.t('play.mode.online'), disabled: true },
  ]);
  protected readonly overlords = computed<SelectOption[]>(() => [
    { value: 'script', label: this.i18n.t('play.overlord.auto') },
    { value: 'human', label: this.i18n.t('play.overlord.human') },
  ]);
  protected readonly mode = signal<PlayMode>('single');
  private readonly chosenOverlord = signal<OverlordKind>('script');
  /** Da solo il Signore supremo è sempre lo script, qualunque cosa si fosse scelto prima. */
  protected readonly overlord = computed<OverlordKind>(() => (this.mode() === 'single' ? 'script' : this.chosenOverlord()));
  protected readonly hint = computed(() => this.i18n.t(`play.mode.${this.mode()}.hint`));

  protected setMode(v: PlayMode) {
    this.mode.set(v);
  }

  protected setOverlord(v: OverlordKind) {
    this.chosenOverlord.set(v);
  }
}
