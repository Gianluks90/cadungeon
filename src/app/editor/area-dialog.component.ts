import { TranslatePipe } from '../i18n/translate.pipe';
import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, signal, viewChild } from '@angular/core';
import { DialogComponent } from '../ui/dialog.component';
import { FieldComponent } from '../ui/field.component';

/** I testi di un'area: una riga sotto il nome e la descrizione che si legge quando gli eroi la rivelano. */
export interface AreaTexts {
  subtitle: string;
  text: string;
}

/**
 * La dialog per scrivere sottotitolo e descrizione di un'area. La descrizione compare a schermo quando l'area viene rivelata in partita; è obbligatoria, tranne per l'area di partenza.
 * Come le altre dialog con campi: i valori si scrivono all'apertura e si leggono alla conferma.
 */
@Component({
  selector: 'app-area-dialog',
  imports: [TranslatePipe, DialogComponent, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [closeOnBackdrop]="false" [title]="name()" (closed)="cancel.emit()">
        <app-field [label]="'areaDialog.sottotitolo' | t" [note]="'common.facoltativo' | t">
          <input #subtitle type="text" name="subtitle" autocomplete="off" [placeholder]="'areaDialog.perEsempioLaSalaDelle' | t" />
        </app-field>
        <app-field [label]="'areaDialog.descrizione' | t" [note]="required() ? '' : ('common.optionalF' | t)" [error]="tried() && !ready() ? ('common.requiredF' | t) : ''">
          <textarea #text name="text" rows="7" [class.bad]="tried() && !ready()" (input)="touch()" [placeholder]="'areaDialog.ilTestoCheCompareA' | t"></textarea>
        </app-field>
        <p class="dlg-hint">{{ 'areaDialog.laDescrizioneSiScriveIn' | t }} <code>{{ 'common.grassetto' | t }}</code>, <code>{{ 'common.corsivo' | t }}</code>{{ 'common.elenchiCon' | t }} <code>-</code>{{ 'common.titoliCon' | t }} <code>#</code>.</p>
        <ng-container dialogFooter><button type="button" class="dlg-btn primary" [class.off]="!ready()" [attr.aria-disabled]="!ready()" [title]="ready() ? '' : ('areaDialog.fill' | t)" (click)="confirm()">{{ 'common.conferma' | t }}</button></ng-container>
      </app-dialog>
    }
  `,
  styles: `
    .dlg-hint code { font-family: var(--font-mono); }
  `,
})
export class AreaDialogComponent {
  readonly open = input(false);
  /** Il nome dell'area (Area 1, Area 2...), il titolo della dialog. */
  readonly name = input('Area');
  readonly value = input<AreaTexts>({ subtitle: '', text: '' });
  /** La descrizione è obbligatoria (tutte le aree tranne quella di partenza, dove si può lasciare vuota). */
  readonly required = input(true);
  readonly confirmed = output<AreaTexts>();
  readonly cancel = output<void>();

  private readonly subtitle = viewChild<ElementRef<HTMLInputElement>>('subtitle');
  private readonly text = viewChild<ElementRef<HTMLTextAreaElement>>('text');

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const v = this.value();
      setTimeout(() => {
        const [s, t] = [this.subtitle(), this.text()];
        if (!s || !t) return;
        s.nativeElement.value = v.subtitle;
        t.nativeElement.value = v.text;
        s.nativeElement.focus();
        this.tried.set(false);
        this.touch();
      });
    });
  }

  /** La descrizione ha del testo? (si aggiorna a ogni digitazione). */
  protected readonly filled = signal(false);
  /** Si è già provato a confermare a vuoto: da lì in poi il campo si segna in rosso. */
  protected readonly tried = signal(false);

  protected ready(): boolean {
    return !this.required() || this.filled();
  }

  protected touch() {
    this.filled.set(!!this.text()?.nativeElement.value.trim());
  }

  protected confirm() {
    this.touch();
    if (!this.ready()) {
      this.tried.set(true);
      return;
    }
    this.confirmed.emit({ subtitle: this.subtitle()?.nativeElement.value.trim() ?? '', text: this.text()!.nativeElement.value.trim() });
  }
}
