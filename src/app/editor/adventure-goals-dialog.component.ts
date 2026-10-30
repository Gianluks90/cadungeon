import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { DialogComponent } from '../ui/dialog.component';
import { FieldComponent } from '../ui/field.component';
import { SelectComponent, SelectOption } from '../ui/select.component';

/** Gli obiettivi dell'avventura e i punti Conquista con cui comincia. */
export interface AdventureGoals {
  objective: string;
  /** Punti Conquista iniziali (un intero, zero o più); null se non sono ancora stati scritti. */
  progress: number | null;
  /** La condizione di vittoria: un nemico sconfitto (`defeat`), la decide un evento (`event`) o non ancora scelta (''). */
  condition: '' | 'defeat' | 'event';
  /** L'id del nemico da sconfiggere per vincere ('' se non è ancora scelto; vale solo con `defeat`). */
  target: string;
  /** Le regole speciali (markdown, facoltative): un messaggio che gli eroi leggono dopo l'obiettivo. */
  rules: string;
  /** Il testo (markdown) che compare quando l'obiettivo è raggiunto. */
  conclusion: string;
  /** I punti Conquista che dà il completare l'obiettivo (un intero, zero o più); null se non sono ancora scritti. */
  reward: number | null;
}

/**
 * La dialog degli obiettivi dell'avventura: il testo degli obiettivi (in markdown) e i punti Conquista iniziali. Sono obbligatori entrambi: "Conferma" resta spento finché
 * l'obiettivo non ha del testo e i punti non sono un numero intero da zero in su. Esc, la X o un tocco fuori chiudono senza cambiare nulla.
 */
@Component({
  selector: 'app-adventure-goals-dialog',
  imports: [DialogComponent, FieldComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [closeOnBackdrop]="false" title="Obiettivi dell'avventura" (closed)="cancel.emit()">
        <app-field label="Obiettivi dell'avventura" [error]="missing('objective') ? 'Obbligatori' : ''">
          <textarea #objective name="objective" rows="6" [class.bad]="missing('objective')" (input)="touch()" placeholder="Che cosa devono fare gli eroi per vincere."></textarea>
        </app-field>
        <app-field label="Regole speciali" note="(facoltative)">
          <textarea #rules name="rules" rows="4" placeholder="Regole che valgono solo in questa avventura: gli eroi le leggono dopo l'obiettivo, a inizio partita."></textarea>
        </app-field>
        <app-field label="Punti Conquista iniziali" [error]="missing('progress') ? 'Un numero intero, zero o più' : ''">
          <input #progress type="number" name="progress" min="0" step="1" inputmode="numeric" placeholder="Per esempio 5" [class.bad]="missing('progress')" (input)="touch()" />
        </app-field>
        <app-field label="Condizione di vittoria">
          <app-select class="block" [options]="conditions" [value]="condition()" placeholder="Scegli una condizione…" label="Condizione di vittoria" (changed)="condition.set($event)" />
        </app-field>
        @if (condition() === 'event') {
          <small class="dlg-hint">La vittoria arriva dall'effetto "Vinci l'avventura" di un evento (strumento Eventi). Il testo di conclusione e i punti qui sotto si mostrano allora.</small>
        }
        @if (condition() === 'defeat') {
          <app-field label="Nemico da sconfiggere">
            <app-select class="block" [options]="targets()" [value]="target()" placeholder="Scegli un nemico…" label="Nemico da sconfiggere" (changed)="target.set($event)" />
            @if (!targets().length) { <small class="dlg-hint">Metti prima il nemico in mappa con lo strumento Nemici.</small> }
          </app-field>
        }
        <app-field label="Testo di conclusione">
          <textarea #conclusion name="conclusion" rows="5" placeholder="Il testo che i giocatori leggono quando vincono."></textarea>
        </app-field>
        <app-field label="Punti Conquista per l'obiettivo completato">
          <input #reward type="number" name="reward" min="0" step="1" inputmode="numeric" placeholder="Per esempio 10" />
        </app-field>
        <p class="dlg-hint">Nemico, conclusione e punti si possono scrivere anche dopo, ma la Verifica li chiede. I testi si scrivono in markdown: <code>**grassetto**</code>, <code>*corsivo*</code>, elenchi con <code>-</code>, titoli con <code>#</code>.</p>
        <ng-container dialogFooter><button type="button" class="dlg-btn primary" [class.off]="!valid()" [attr.aria-disabled]="!valid()" [title]="valid() ? '' : 'Compila gli obiettivi e i punti Conquista iniziali'" (click)="confirm()">Conferma</button></ng-container>
      </app-dialog>
    }
  `,
  styles: `
    .dlg-hint code { font-family: var(--font-mono); }
  `,
})
export class AdventureGoalsDialogComponent {
  readonly open = input(false);
  /** I valori di adesso, da cui partono i campi quando la dialog si apre. */
  readonly value = input<AdventureGoals>({ objective: '', progress: null, condition: '', target: '', rules: '', conclusion: '', reward: null });
  /** I nemici in mappa fra cui scegliere quello da sconfiggere. */
  readonly targets = input<SelectOption[]>([]);
  protected readonly target = signal('');
  /** Le condizioni di vittoria; ognuna ha poi i suoi campi (per ora solo il nemico da sconfiggere). */
  protected readonly conditions: SelectOption[] = [{ value: 'defeat', label: 'Nemico sconfitto' }, { value: 'event', label: 'Un evento' }];
  protected readonly condition = signal('');
  readonly confirmed = output<AdventureGoals>();
  readonly cancel = output<void>();

  // Come l'altra dialog: i campi non sono legati a segnali, i valori si scrivono all'apertura e si leggono alla conferma.
  private readonly objective = viewChild<ElementRef<HTMLTextAreaElement>>('objective');
  private readonly progress = viewChild<ElementRef<HTMLInputElement>>('progress');
  private readonly rules = viewChild<ElementRef<HTMLTextAreaElement>>('rules');
  private readonly conclusion = viewChild<ElementRef<HTMLTextAreaElement>>('conclusion');
  private readonly reward = viewChild<ElementRef<HTMLInputElement>>('reward');
  private readonly filled = signal({ objective: false, progress: false });
  private readonly tried = signal(false);
  protected readonly valid = computed(() => Object.values(this.filled()).every(Boolean));

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const v = this.value();
      setTimeout(() => {
        const [o, p, c, r, ru] = [this.objective(), this.progress(), this.conclusion(), this.reward(), this.rules()];
        if (!o || !p || !c || !r || !ru) return;
        ru.nativeElement.value = v.rules;
        r.nativeElement.value = v.reward === null ? '' : String(v.reward);
        o.nativeElement.value = v.objective;
        c.nativeElement.value = v.conclusion;
        this.target.set(v.target);
        this.condition.set(v.condition);
        p.nativeElement.value = v.progress === null ? '' : String(v.progress);
        o.nativeElement.focus();
        this.tried.set(false);
        this.touch();
      });
    });
  }

  private points(field = this.progress()): number | null {
    const raw = field?.nativeElement.value.trim() ?? '';
    const n = Number(raw);
    return raw !== '' && Number.isInteger(n) && n >= 0 ? n : null;
  }

  protected touch() {
    this.filled.set({ objective: !!this.objective()?.nativeElement.value.trim(), progress: this.points() !== null });
  }

  protected missing(field: 'objective' | 'progress'): boolean {
    return this.tried() && !this.filled()[field];
  }

  protected confirm() {
    this.touch();
    if (!this.valid()) {
      this.tried.set(true);
      return;
    }
    this.confirmed.emit({ objective: this.objective()!.nativeElement.value.trim(), progress: this.points(), condition: this.condition() as AdventureGoals['condition'], target: this.condition() === 'defeat' ? this.target() : '', rules: this.rules()!.nativeElement.value.trim(), conclusion: this.conclusion()!.nativeElement.value.trim(), reward: this.points(this.reward()) });
  }
}
