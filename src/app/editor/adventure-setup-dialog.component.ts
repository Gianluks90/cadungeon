import { translate as t } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ChangeDetectionStrategy, Component, WritableSignal, computed, effect, input, output, signal } from '@angular/core';
import { ChestTier } from '../game/board/marker';
import { EVIL_HAND_MAX, EVIL_START_HAND } from '../game/constants';
import { TREASURE_KEYS } from '../game/heroes/party-setup';
import type { AdventureSetup } from '../game/map/map-data';
import { CheckboxComponent } from '../ui/checkbox.component';
import { DialogComponent } from '../ui/dialog.component';
import { FieldComponent } from '../ui/field.component';
import { SelectComponent, SelectOption } from '../ui/select.component';

/** Ciò che la dialog modifica: le regole speciali (testo e immagine) e le varianti di preparazione. */
export interface AdventureSetupForm {
  rules: string;
  rulesImage: string;
  setup: AdventureSetup;
}

/** Una carta del Male come la offre la dialog. */
export interface SetupCard {
  id: string;
  name: string;
  copies: number;
  /** Le carte "potere" sono le uniche che possono stare in gioco fin dall'inizio. */
  power: boolean;
}

const COIN_STEP = 25;
const TIERS: readonly ChestTier[] = ['copper', 'silver', 'gold'];

/**
 * La dialog "Preparazione": le regole speciali dell'avventura e le sue varianti di partenza (monete in più, tesori in negozio, Mazzo del Male). Le varianti si leggono
 * a inizio partita e il gioco le elenca da solo sotto le regole, dopo "Inoltre". Tutto facoltativo.
 */
@Component({
  selector: 'app-adventure-setup-dialog',
  imports: [TranslatePipe, CheckboxComponent, DialogComponent, FieldComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [closeOnBackdrop]="false" [title]="'setupDialog.title' | t" width="min(640px, 100%)" (closed)="cancel.emit()">
        <p class="dlg-hint">{{ 'setupDialog.intro' | t }}</p>
        <app-field [label]="'goalsDialog.specialRules' | t" [note]="'goalsDialog.optionalPlural' | t">
          <textarea name="rules" rows="4" [value]="rules()" (input)="rules.set($any($event.target).value)" [placeholder]="'goalsDialog.specialRulesHint' | t"></textarea>
        </app-field>
        @if (portraits().length > 1) {
          <app-field [label]="'goalsDialog.rulesImage' | t" [note]="'goalsDialog.optional' | t">
            <app-select class="block" [options]="portraits()" [value]="rulesImage()" [label]="'goalsDialog.rulesImage' | t" (changed)="rulesImage.set($event)" />
          </app-field>
        }

        <app-field [label]="'setupDialog.extraCoins' | t" [note]="'setupDialog.extraCoinsHint' | t">
          <input type="number" name="extraCoins" step="25" inputmode="numeric" [value]="extraCoins()" (input)="extraCoins.set($any($event.target).value)" />
        </app-field>

        <div class="field">
          <span class="cap">{{ 'setupDialog.treasures' | t }}</span>
          <div class="checks">
            @for (k of tiers; track k) { <app-checkbox [checked]="treasures().includes(k)" (changed)="toggleTier(k, $event)">{{ tierName(k) }}</app-checkbox> }
          </div>
          <small class="dlg-hint">{{ 'setupDialog.treasuresHint' | t }}</small>
        </div>

        <div class="field">
          <span class="cap">{{ 'setupDialog.deckRemove' | t }}</span>
          <div class="dlg-chips">
            @for (id of deckRemove(); track $index; let i = $index) { <span class="dlg-chip">{{ nameOf(id) }}<button type="button" [attr.aria-label]="'common.removeNamed' | t: { name: nameOf(id) }" (click)="removeAt(deckRemove, i)">×</button></span> }
            @empty { <span class="dlg-hint">{{ 'setupDialog.noCards' | t }}</span> }
          </div>
          @if (removeOptions().length) { <app-select class="block" [options]="removeOptions()" value="" [placeholder]="'setupDialog.addCard' | t" [label]="'setupDialog.deckRemove' | t" (changed)="add(deckRemove, $event)" /> }
          <small class="dlg-hint">{{ 'setupDialog.deckRemoveHint' | t }}</small>
        </div>

        <div class="field">
          <span class="cap">{{ 'setupDialog.inPlay' | t }}</span>
          <div class="dlg-chips">
            @for (id of inPlay(); track $index; let i = $index) { <span class="dlg-chip">{{ nameOf(id) }}<button type="button" [attr.aria-label]="'common.removeNamed' | t: { name: nameOf(id) }" (click)="removeAt(inPlay, i)">×</button></span> }
            @empty { <span class="dlg-hint">{{ 'setupDialog.noCards' | t }}</span> }
          </div>
          @if (inPlayOptions().length) { <app-select class="block" [options]="inPlayOptions()" value="" [placeholder]="'setupDialog.addCard' | t" [label]="'setupDialog.inPlay' | t" (changed)="add(inPlay, $event)" /> }
          <small class="dlg-hint">{{ 'setupDialog.inPlayHint' | t }}</small>
        </div>

        <app-field [label]="'setupDialog.startHand' | t" [note]="'setupDialog.startHandHint' | t: { max: handMax, default: handDefault }">
          <input type="number" name="startHand" min="0" [max]="handMax" step="1" inputmode="numeric" [value]="startHand()" [placeholder]="'' + handDefault" (input)="startHand.set($any($event.target).value)" />
        </app-field>

        <ng-container dialogFooter><button type="button" class="dlg-btn primary" (click)="confirm()">{{ 'common.confirm' | t }}</button></ng-container>
      </app-dialog>
    }
  `,
  styles: `
    .field { display: flex; flex-direction: column; gap: 6px; }
    .cap { font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    .checks { display: flex; flex-wrap: wrap; gap: 6px 18px; }
  `,
})
export class AdventureSetupDialogComponent {
  readonly open = input(false);
  readonly value = input<AdventureSetupForm>({ rules: '', rulesImage: '', setup: {} });
  /** Le immagini della raccolta dei gettoni che hanno una carta a figura intera (la prima voce, vuota, è "nessuna"). */
  readonly portraits = input<SelectOption[]>([]);
  /** Le carte del Mazzo del Male (solo quelle pronte). */
  readonly cards = input<SetupCard[]>([]);
  readonly confirmed = output<AdventureSetupForm>();
  readonly cancel = output<void>();

  protected readonly tiers = TIERS;
  protected readonly handMax = EVIL_HAND_MAX;
  protected readonly handDefault = EVIL_START_HAND;
  protected readonly rules = signal('');
  protected readonly rulesImage = signal('');
  /** I campi numerici si tengono come testo: vuoto vuol dire "non cambiare". */
  protected readonly extraCoins = signal('');
  protected readonly startHand = signal('');
  protected readonly treasures = signal<ChestTier[]>([]);
  protected readonly deckRemove = signal<string[]>([]);
  protected readonly inPlay = signal<string[]>([]);

  /** Le copie ancora libere di ogni carta: quelle del mazzo meno le tolte e le messe in gioco. */
  private readonly freeCopies = computed(() => {
    const left = new Map(this.cards().map((c) => [c.id, c.copies] as const));
    for (const id of [...this.deckRemove(), ...this.inPlay()]) left.set(id, (left.get(id) ?? 0) - 1);
    return left;
  });
  protected readonly removeOptions = computed<SelectOption[]>(() => this.cards().filter((c) => (this.freeCopies().get(c.id) ?? 0) > 0).map((c) => ({ value: c.id, label: c.copies > 1 ? `${c.name} ×${c.copies}` : c.name })));
  protected readonly inPlayOptions = computed<SelectOption[]>(() => this.cards().filter((c) => c.power && !this.inPlay().includes(c.id) && (this.freeCopies().get(c.id) ?? 0) > 0).map((c) => ({ value: c.id, label: c.name })));

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const v = this.value();
      this.rules.set(v.rules);
      this.rulesImage.set(v.rulesImage);
      this.extraCoins.set(v.setup.extraCoins !== undefined ? String(v.setup.extraCoins) : '');
      this.startHand.set(v.setup.evilStartHand !== undefined ? String(v.setup.evilStartHand) : '');
      this.treasures.set([...(v.setup.pregameTreasures ?? [])]);
      this.deckRemove.set([...(v.setup.evilDeckRemove ?? [])]);
      this.inPlay.set([...(v.setup.evilStartInPlay ?? [])]);
    });
  }

  protected tierName = (k: ChestTier) => t(TREASURE_KEYS[k]);
  protected nameOf = (id: string) => this.cards().find((c) => c.id === id)?.name ?? id;

  protected toggleTier(k: ChestTier, on: boolean) {
    this.treasures.update((l) => (on ? TIERS.filter((x) => x === k || l.includes(x)) : l.filter((x) => x !== k)));
  }

  protected add(list: WritableSignal<string[]>, id: string) {
    if (id) list.update((l) => [...l, id]);
  }

  protected removeAt(list: WritableSignal<string[]>, i: number) {
    list.update((l) => l.filter((_, k) => k !== i));
  }

  protected confirm() {
    const setup: AdventureSetup = {};
    const coins = Number(this.extraCoins());
    // Le monete vanno a passi di 25: si arrotonda al multiplo più vicino.
    if (this.extraCoins().trim() !== '' && Number.isFinite(coins) && Math.round(coins / COIN_STEP) !== 0) setup.extraCoins = Math.round(coins / COIN_STEP) * COIN_STEP;
    if (this.treasures().length) setup.pregameTreasures = [...this.treasures()];
    if (this.deckRemove().length) setup.evilDeckRemove = [...this.deckRemove()];
    if (this.inPlay().length) setup.evilStartInPlay = [...this.inPlay()];
    const hand = Number(this.startHand());
    if (this.startHand().trim() !== '' && Number.isFinite(hand)) setup.evilStartHand = Math.max(0, Math.min(EVIL_HAND_MAX, Math.floor(hand)));
    this.confirmed.emit({ rules: this.rules().trim(), rulesImage: this.rules().trim() ? this.rulesImage() : '', setup });
  }
}
