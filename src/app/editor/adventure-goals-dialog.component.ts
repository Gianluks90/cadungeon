import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { DialogComponent } from '../ui/dialog.component';

/** Gli obiettivi dell'avventura e i punti Conquista con cui comincia. */
export interface AdventureGoals {
  objective: string;
  /** Punti Conquista iniziali (un intero, zero o più); null se non sono ancora stati scritti. */
  progress: number | null;
}

/**
 * La dialog degli obiettivi dell'avventura: il testo degli obiettivi (in markdown) e i punti Conquista iniziali. Sono obbligatori entrambi: "Conferma" resta spento finché
 * l'obiettivo non ha del testo e i punti non sono un numero intero da zero in su. Esc, la X o un tocco fuori chiudono senza cambiare nulla.
 */
@Component({
  selector: 'app-adventure-goals-dialog',
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog title="Obiettivi dell'avventura" (closed)="cancel.emit()">
        <label>
          <span>Obiettivi dell'avventura</span>
          <textarea #objective name="objective" rows="6" [class.bad]="missing('objective')" (input)="touch()" placeholder="Che cosa devono fare gli eroi per vincere."></textarea>
          @if (missing('objective')) { <small class="err">Obbligatori</small> }
        </label>
        <label>
          <span>Punti Conquista iniziali</span>
          <input #progress type="number" name="progress" min="0" step="1" inputmode="numeric" placeholder="Per esempio 5" [class.bad]="missing('progress')" (input)="touch()" />
          @if (missing('progress')) { <small class="err">Un numero intero, zero o più</small> }
        </label>
        <p class="hint">Gli obiettivi si scrivono in markdown: <code>**grassetto**</code>, <code>*corsivo*</code>, elenchi con <code>-</code>, titoli con <code>#</code>.</p>
        <ng-container dialogFooter><button type="button" class="dlg-btn primary" [class.off]="!valid()" [attr.aria-disabled]="!valid()" [title]="valid() ? '' : 'Compila gli obiettivi e i punti Conquista iniziali'" (click)="confirm()">Conferma</button></ng-container>
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
    input[type='number'] { font-family: var(--font-mono); }
    input:focus, textarea:focus { border-color: var(--c-interact); outline: none; }
    .err { color: var(--c-danger); font-size: 12px; }
    .bad { border-color: var(--c-danger); }
    .hint { margin: 0; color: var(--c-text-dim); font-size: 12px; }
    .hint code { font-family: var(--font-mono); }
    .dlg-btn.off { opacity: 0.45; cursor: default; }
    ::placeholder { color: var(--c-text-dim); opacity: 0.7; }
  `,
})
export class AdventureGoalsDialogComponent {
  readonly open = input(false);
  /** I valori di adesso, da cui partono i campi quando la dialog si apre. */
  readonly value = input<AdventureGoals>({ objective: '', progress: null });
  readonly confirmed = output<AdventureGoals>();
  readonly cancel = output<void>();

  // Come l'altra dialog: i campi non sono legati a segnali, i valori si scrivono all'apertura e si leggono alla conferma.
  private readonly objective = viewChild<ElementRef<HTMLTextAreaElement>>('objective');
  private readonly progress = viewChild<ElementRef<HTMLInputElement>>('progress');
  private readonly filled = signal({ objective: false, progress: false });
  private readonly tried = signal(false);
  protected readonly valid = computed(() => Object.values(this.filled()).every(Boolean));

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const v = this.value();
      setTimeout(() => {
        const [o, p] = [this.objective(), this.progress()];
        if (!o || !p) return;
        o.nativeElement.value = v.objective;
        p.nativeElement.value = v.progress === null ? '' : String(v.progress);
        o.nativeElement.focus();
        this.tried.set(false);
        this.touch();
      });
    });
  }

  private points(): number | null {
    const raw = this.progress()?.nativeElement.value.trim() ?? '';
    const n = Number(raw);
    return raw !== '' && Number.isInteger(n) && n >= 0 ? n : null;
  }

  protected touch() {
    this.filled.set({ objective: !!this.objective()?.nativeElement.value.trim(), progress: this.points() !== null });
  }

  protected missing(field: keyof AdventureGoals): boolean {
    return this.tried() && !this.filled()[field];
  }

  protected confirm() {
    this.touch();
    if (!this.valid()) {
      this.tried.set(true);
      return;
    }
    this.confirmed.emit({ objective: this.objective()!.nativeElement.value.trim(), progress: this.points() });
  }
}
