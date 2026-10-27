import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, signal, viewChild } from '@angular/core';
import { DialogComponent } from '../ui/dialog.component';

/** I testi di un'area: una riga sotto il nome e la descrizione che si legge quando gli eroi la rivelano. */
export interface AreaTexts {
  subtitle: string;
  text: string;
}

/**
 * La dialog per scrivere sottotitolo e descrizione di un'area (le aree diverse da quella di partenza). La descrizione compare a schermo quando l'area viene rivelata in partita.
 * Come le altre dialog con campi: i valori si scrivono all'apertura e si leggono alla conferma.
 */
@Component({
  selector: 'app-area-dialog',
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [title]="name()" (closed)="cancel.emit()">
        <label>
          <span>Sottotitolo <small>(facoltativo)</small></span>
          <input #subtitle type="text" name="subtitle" autocomplete="off" placeholder="Per esempio: La sala delle colonne" />
        </label>
        <label>
          <span>Descrizione</span>
          <textarea #text name="text" rows="7" [class.bad]="tried() && !filled()" (input)="touch()" placeholder="Il testo che compare a schermo quando gli eroi rivelano quest'area."></textarea>
          @if (tried() && !filled()) { <small class="err">Obbligatoria</small> }
        </label>
        <p class="hint">La descrizione si scrive in markdown: <code>**grassetto**</code>, <code>*corsivo*</code>, elenchi con <code>-</code>, titoli con <code>#</code>.</p>
        <ng-container dialogFooter><button type="button" class="dlg-btn primary" [class.off]="!filled()" [attr.aria-disabled]="!filled()" [title]="filled() ? '' : 'Scrivi la descrizione'" (click)="confirm()">Conferma</button></ng-container>
      </app-dialog>
    }
  `,
  styles: `
    label { display: flex; flex-direction: column; gap: 6px; }
    label span { font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    input, textarea {
      box-sizing: border-box; width: 100%; padding: 9px 11px; border-radius: var(--radius-1); background: var(--c-bg); color: var(--c-text);
      border: 1px solid var(--c-line-strong); font: 14px/1.45 var(--font-ui); resize: vertical;
    }
    input:focus, textarea:focus { border-color: var(--c-interact); outline: none; }
    label span small { text-transform: none; letter-spacing: 0; font-weight: 400; }
    .err { color: var(--c-danger); font-size: 12px; }
    .bad { border-color: var(--c-danger); }
    .hint { margin: 0; color: var(--c-text-dim); font-size: 12px; }
    .hint code { font-family: var(--font-mono); }
    .dlg-btn.off { opacity: 0.45; cursor: default; }
    ::placeholder { color: var(--c-text-dim); opacity: 0.7; }
  `,
})
export class AreaDialogComponent {
  readonly open = input(false);
  /** Il nome dell'area (Area 1, Area 2...), il titolo della dialog. */
  readonly name = input('Area');
  readonly value = input<AreaTexts>({ subtitle: '', text: '' });
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

  protected touch() {
    this.filled.set(!!this.text()?.nativeElement.value.trim());
  }

  protected confirm() {
    this.touch();
    if (!this.filled()) {
      this.tried.set(true);
      return;
    }
    this.confirmed.emit({ subtitle: this.subtitle()?.nativeElement.value.trim() ?? '', text: this.text()!.nativeElement.value.trim() });
  }
}
