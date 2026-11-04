import { translate as t } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { DialogComponent } from '../ui/dialog.component';
import { MapSelectComponent } from './map-select.component';
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
  /** L'immagine (id della raccolta dei gettoni) che compare inclinata accanto alle regole speciali; '' = nessuna. */
  rulesImage: string;
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
  imports: [TranslatePipe, DialogComponent, FieldComponent, MapSelectComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [closeOnBackdrop]="false" [title]="'goalsDialog.title' | t" (closed)="cancel.emit()">
        <app-field [label]="'goalsDialog.title' | t" [error]="missing('objective') ? ('common.requiredP' | t) : ''">
          <textarea #objective name="objective" rows="6" [class.bad]="missing('objective')" (input)="touch()" [placeholder]="'goalsDialog.goalsHint' | t"></textarea>
        </app-field>
        <app-field [label]="'goalsDialog.startingProgress' | t" [error]="missing('progress') ? ('goalsDialog.integerError' | t) : ''">
          <input #progress type="number" name="progress" min="0" step="1" inputmode="numeric" [placeholder]="'goalsDialog.startingProgressExample' | t" [class.bad]="missing('progress')" (input)="touch()" />
        </app-field>
        <app-field [label]="'goalsDialog.winCondition' | t">
          <app-select class="block" [options]="conditions" [value]="condition()" [placeholder]="'goalsDialog.chooseCondition' | t" [label]="'goalsDialog.winCondition' | t" (changed)="condition.set($event)" />
        </app-field>
        @if (condition() === 'event') {
          <small class="dlg-hint">{{ 'goalsDialog.eventWinHint' | t }}</small>
        }
        @if (condition() === 'defeat') {
          <app-field [label]="'goalsDialog.enemyToDefeat' | t">
            <app-map-select kind="monster" [options]="targets()" [value]="target()" [placeholder]="'goalsDialog.chooseEnemy' | t" [label]="'goalsDialog.enemyToDefeat' | t" (changed)="target.set($event)" />
            @if (!targets().length) { <small class="dlg-hint">{{ 'goalsDialog.placeEnemyFirst' | t }}</small> }
          </app-field>
        }
        <app-field [label]="'goalsDialog.conclusion' | t">
          <textarea #conclusion name="conclusion" rows="5" [placeholder]="'goalsDialog.conclusionHint' | t"></textarea>
        </app-field>
        <app-field [label]="'goalsDialog.rewardProgress' | t">
          <input #reward type="number" name="reward" min="0" step="1" inputmode="numeric" [placeholder]="'goalsDialog.rewardExample' | t" />
        </app-field>
        <p class="dlg-hint">{{ 'goalsDialog.fillLaterHint' | t }} <code>{{ 'common.bold' | t }}</code>, <code>{{ 'common.italic' | t }}</code>{{ 'common.listsWith' | t }} <code>-</code>{{ 'common.headingsWith' | t }} <code>#</code>.</p>
        <ng-container dialogFooter><button type="button" class="dlg-btn primary" [class.off]="!valid()" [attr.aria-disabled]="!valid()" [title]="valid() ? '' : ('goalsDialog.fill' | t)" (click)="confirm()">{{ 'common.confirm' | t }}</button></ng-container>
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
  readonly value = input<AdventureGoals>({ objective: '', progress: null, condition: '', target: '', rules: '', rulesImage: '', conclusion: '', reward: null });
  /** I nemici in mappa fra cui scegliere quello da sconfiggere. */
  readonly targets = input<SelectOption[]>([]);
  protected readonly target = signal('');
  /** Le condizioni di vittoria; ognuna ha poi i suoi campi (per ora solo il nemico da sconfiggere). */
  protected readonly conditions: SelectOption[] = [{ value: 'defeat', get label() { return t('goalsDialog.condDefeat'); } }, { value: 'event', get label() { return t('goalsDialog.condEvent'); } }];
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
    this.confirmed.emit({ objective: this.objective()!.nativeElement.value.trim(), progress: this.points(), condition: this.condition() as AdventureGoals['condition'], target: this.condition() === 'defeat' ? this.target() : '', rules: this.value().rules, rulesImage: this.value().rulesImage, conclusion: this.conclusion()!.nativeElement.value.trim(), reward: this.points(this.reward()) });
  }
}
