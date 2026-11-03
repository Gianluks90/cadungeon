import { TranslatePipe } from '../i18n/translate.pipe';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import type { TokenLook } from '../game/board/marker';
import { lookChoice, lookFrom } from '../game/markers/token-looks';
import { CheckboxComponent } from '../ui/checkbox.component';
import { DialogComponent } from '../ui/dialog.component';
import { FieldComponent } from '../ui/field.component';
import type { SelectOption } from '../ui/select.component';
import { LookFieldsComponent } from './look-fields.component';

/** Come si usa un segnalino Incontro: il testo dell'azione nel menu del "!" e quanti punti movimento costa. */
export interface EncounterEdits {
  label: string;
  cost: number;
  /** Non si attraversa (come una roccia). */
  blocksMove: boolean;
  /** Blocca la linea di vista. */
  blocksSight: boolean;
  /** Si usa anche dalle caselle adiacenti. */
  adjacent: boolean;
  /** Dopo l'uso resta in mappa e si può usare ancora. */
  reusable: boolean;
  /** L'aspetto del gettone (immagine o icona e titolo); senza, il cerchio con il "?". */
  look?: TokenLook;
}

/**
 * La dialog di un segnalino Incontro (strumento "Glifi e altro", modalità Personalizza): il testo dell'azione che l'eroe trova nel menu quando si ferma sulla casella ("Suona la campana")
 * e il suo costo in punti movimento. Se il testo è vuoto l'azione si chiama "Usa"; il costo di base è 0.
 */
@Component({
  selector: 'app-encounter-dialog',
  imports: [TranslatePipe, CheckboxComponent, DialogComponent, FieldComponent, LookFieldsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [closeOnBackdrop]="false" [title]="'encounterDialog.title' | t" width="min(460px, 100%)" (closed)="cancel.emit()">
        <app-field [label]="'encounterDialog.action' | t" [note]="'encounterDialog.optional' | t">
          <input type="text" autocomplete="off" maxlength="40" [placeholder]="'encounterDialog.actionExample' | t" [value]="label()" (input)="label.set($any($event.target).value)" />
        </app-field>
        <app-field [label]="'encounterDialog.cost' | t">
          <input type="number" min="0" step="1" [class.bad]="!costOk()" [value]="cost()" (input)="cost.set($any($event.target).value)" />
        </app-field>
        <section>
          <app-checkbox [checked]="blocksMove()" (changed)="blocksMove.set($event)">{{ 'encounterDialog.blocksMove' | t }}</app-checkbox>
          <app-checkbox [checked]="blocksSight()" (changed)="blocksSight.set($event)">{{ 'encounterDialog.blocksSight' | t }}</app-checkbox>
          <app-checkbox [checked]="adjacent()" (changed)="adjacent.set($event)">{{ 'encounterDialog.adjacent' | t }}</app-checkbox>
          <app-checkbox [checked]="reusable()" (changed)="reusable.set($event)">{{ 'encounterDialog.reusable' | t }}</app-checkbox>
          <p class="dlg-hint">{{ 'encounterDialog.flagsHint' | t }}</p>
        </section>
        <section>
          <h3>{{ 'common.look' | t }}</h3>
          <app-look-fields [looks]="looks()" [imageUrls]="imageUrls()" [choice]="choice()" [title]="title()" (choiceChange)="choice.set($event)" (titleChange)="title.set($event)" />
          <p class="dlg-hint">{{ 'encounterDialog.lookHint' | t }}</p>
        </section>
        <p class="dlg-hint">{{ 'encounterDialog.useHint' | t }}</p>
        <ng-container dialogFooter><button type="button" class="dlg-btn primary" [class.off]="!costOk()" [attr.aria-disabled]="!costOk()" (click)="confirm()">{{ 'common.confirm' | t }}</button></ng-container>
      </app-dialog>
    }
  `,
  styles: `
    section { display: flex; flex-direction: column; gap: 8px; }
  `,
})
export class EncounterDialogComponent {
  readonly open = input(false);
  readonly value = input<EncounterEdits | null>(null);
  /** Le scelte dell'aspetto (la prima, vuota, è il "?"): `image:<id>` o `icon:<nome>`; e gli indirizzi delle immagini, per l'anteprima. */
  readonly looks = input<SelectOption[]>([]);
  readonly imageUrls = input<Record<string, string>>({});
  readonly confirmed = output<EncounterEdits>();
  readonly cancel = output<void>();

  protected readonly label = signal('');
  protected readonly cost = signal('0');
  protected readonly blocksMove = signal(false);
  protected readonly blocksSight = signal(false);
  protected readonly adjacent = signal(false);
  protected readonly reusable = signal(false);
  protected readonly choice = signal('');
  protected readonly title = signal('');
  protected readonly costOk = computed(() => /^\d+$/.test(this.cost().trim()));

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const v = this.value();
      this.label.set(v?.label ?? '');
      this.cost.set(String(v?.cost ?? 0));
      this.blocksMove.set(!!v?.blocksMove);
      this.blocksSight.set(!!v?.blocksSight);
      this.adjacent.set(!!v?.adjacent);
      this.reusable.set(!!v?.reusable);
      this.choice.set(lookChoice(v?.look));
      this.title.set(v?.look?.title ?? '');
    });
  }

  protected confirm() {
    if (!this.costOk()) return;
    const look = lookFrom(this.choice(), this.title());
    this.confirmed.emit({ label: this.label().trim(), cost: Number(this.cost().trim()), blocksMove: this.blocksMove(), blocksSight: this.blocksSight(), adjacent: this.adjacent(), reusable: this.reusable(), ...(look ? { look } : {}) });
  }
}
