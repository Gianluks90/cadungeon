import { TranslatePipe } from '../i18n/translate.pipe';
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { DialogComponent } from '../ui/dialog.component';
import { FieldComponent } from '../ui/field.component';

/** I testi di presentazione dell'avventura: titolo e introduzione. */
export interface AdventureInfo {
  title: string;
  intro: string;
}

/**
 * La dialog con la presentazione dell'avventura: titolo e introduzione (in markdown), entrambi obbligatori. "Conferma" li scrive nella mappa in costruzione; Esc, la X o un tocco fuori chiudono senza cambiare nulla.
 * Quando si apre, i campi partono dai valori di adesso.
 */
@Component({
  selector: 'app-adventure-info-dialog',
  imports: [TranslatePipe, DialogComponent, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [closeOnBackdrop]="false" [title]="'common.avventura' | t" (closed)="cancel.emit()">
        <app-field [label]="'infoDialog.titolo' | t" [error]="missing('title') ? ('common.required' | t) : ''">
          <input #title type="text" name="title" autocomplete="off" [class.bad]="missing('title')" (input)="touch()" />
        </app-field>
        <app-field [label]="'infoDialog.introduzione' | t" [error]="missing('intro') ? ('common.requiredF' | t) : ''">
          <textarea #intro name="intro" rows="7" [class.bad]="missing('intro')" (input)="touch()" [placeholder]="'infoDialog.ilTestoCheIGiocatori' | t"></textarea>
        </app-field>
        <p class="dlg-hint">{{ 'infoDialog.lIntroduzioneSiScriveIn' | t }} <code>{{ 'common.grassetto' | t }}</code>, <code>{{ 'common.corsivo' | t }}</code>{{ 'common.elenchiCon' | t }} <code>-</code>{{ 'common.titoliCon' | t }} <code>#</code>.</p>
        <ng-container dialogFooter><button type="button" class="dlg-btn primary" [class.off]="!valid()" [attr.aria-disabled]="!valid()" [title]="valid() ? '' : ('infoDialog.fill' | t)" (click)="confirm()">{{ 'common.conferma' | t }}</button></ng-container>
      </app-dialog>
    }
  `,
  styles: `
    .dlg-hint code { font-family: var(--font-mono); }
  `,
})
export class AdventureInfoDialogComponent {
  readonly open = input(false);
  /** I valori di adesso, da cui partono i campi quando la dialog si apre. */
  readonly value = input<AdventureInfo>({ title: '', intro: '' });
  readonly confirmed = output<AdventureInfo>();
  readonly cancel = output<void>();

  // I campi non sono legati a un segnale: i valori si scrivono una volta all'apertura e si leggono alla conferma, così durante la digitazione e i clic il browser non viene toccato.
  private readonly title = viewChild<ElementRef<HTMLInputElement>>('title');
  private readonly intro = viewChild<ElementRef<HTMLTextAreaElement>>('intro');
  /** Quali campi hanno del testo (si aggiorna a ogni digitazione: qui si legge soltanto). */
  private readonly filled = signal({ title: false, intro: false });
  /** Si è già provato a confermare: da lì in poi i campi vuoti si segnano in rosso. */
  private readonly tried = signal(false);
  protected readonly valid = computed(() => Object.values(this.filled()).every(Boolean));

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const v = this.value();
      setTimeout(() => {
        const [t, i] = [this.title(), this.intro()];
        if (!t || !i) return;
        t.nativeElement.value = v.title;
        i.nativeElement.value = v.intro;
        t.nativeElement.focus();
        this.tried.set(false);
        this.touch();
      });
    });
  }

  protected touch() {
    const has = (e?: ElementRef<HTMLInputElement | HTMLTextAreaElement>) => !!e?.nativeElement.value.trim();
    this.filled.set({ title: has(this.title()), intro: has(this.intro()) });
  }

  protected missing(field: keyof AdventureInfo): boolean {
    return this.tried() && !this.filled()[field];
  }

  /** Conferma solo con titolo e introduzione compilati; altrimenti segna in rosso quello che manca. */
  protected confirm() {
    this.touch();
    if (!this.valid()) {
      this.tried.set(true);
      return;
    }
    this.confirmed.emit({ title: this.title()!.nativeElement.value.trim(), intro: this.intro()!.nativeElement.value.trim() });
  }
}
