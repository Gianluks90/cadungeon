import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { DialogComponent } from '../ui/dialog.component';
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
  imports: [DialogComponent, SelectComponent],
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
        <label>
          <span>Condizione di vittoria</span>
          <app-select class="block" [options]="conditions" [value]="condition()" placeholder="Scegli una condizione…" label="Condizione di vittoria" (changed)="condition.set($event)" />
        </label>
        @if (condition() === 'event') {
          <small class="hint">La vittoria arriva dall'effetto "Vinci l'avventura" di un evento (strumento Eventi). Il testo di conclusione e i punti qui sotto si mostrano allora.</small>
        }
        @if (condition() === 'defeat') {
          <label>
            <span>Nemico da sconfiggere</span>
            <app-select class="block" [options]="targets()" [value]="target()" placeholder="Scegli un nemico…" label="Nemico da sconfiggere" (changed)="target.set($event)" />
            @if (!targets().length) { <small class="hint">Metti prima il nemico in mappa con lo strumento Nemici.</small> }
          </label>
        }
        <label>
          <span>Testo di conclusione</span>
          <textarea #conclusion name="conclusion" rows="5" placeholder="Il testo che i giocatori leggono quando vincono."></textarea>
        </label>
        <label>
          <span>Punti Conquista per l'obiettivo completato</span>
          <input #reward type="number" name="reward" min="0" step="1" inputmode="numeric" placeholder="Per esempio 10" />
        </label>
        <p class="hint">Nemico, conclusione e punti si possono scrivere anche dopo, ma la Verifica li chiede. I testi si scrivono in markdown: <code>**grassetto**</code>, <code>*corsivo*</code>, elenchi con <code>-</code>, titoli con <code>#</code>.</p>
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
  readonly value = input<AdventureGoals>({ objective: '', progress: null, condition: '', target: '', conclusion: '', reward: null });
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
        const [o, p, c, r] = [this.objective(), this.progress(), this.conclusion(), this.reward()];
        if (!o || !p || !c || !r) return;
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
    this.confirmed.emit({ objective: this.objective()!.nativeElement.value.trim(), progress: this.points(), condition: this.condition() as AdventureGoals['condition'], target: this.condition() === 'defeat' ? this.target() : '', conclusion: this.conclusion()!.nativeElement.value.trim(), reward: this.points(this.reward()) });
  }
}
