import { translate as t } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { CHEST_TABLE_MAX, CHEST_TIER_NAMES, ChestReward, ChestTable, ChestTier, Loot } from '../game/board/marker';
import { DialogComponent } from '../ui/dialog.component';
import { IconComponent } from '../ui/icon.component';

/** Una ricompensa della tabella come si digita: quanti premi di ogni tipo dà (0 = nessuno). */
interface Entry {
  progress: number;
  coins: number;
  curse: number;
  treasure: number;
}

type Kind = keyof Entry;

const TIERS: ChestTier[] = ['copper', 'silver', 'gold'];
/** I premi, nell'ordine in cui compaiono nella griglia 2×2: la carta tesoro è sempre del tipo del baule in cui la si mette (rame, argento, oro). */
const KINDS: Kind[] = ['progress', 'coins', 'curse', 'treasure'];
/** Di quanto cambia ogni premio con i tasti − e +: il denaro va a multipli di 25, il resto di 1. */
const STEP: Record<Kind, number> = { progress: 1, coins: 25, curse: 1, treasure: 1 };

const emptyEntry = (): Entry => ({ progress: 0, coins: 0, curse: 0, treasure: 0 });
/** Un intero da 0 in su (il resto diventa 0); il denaro si arrotonda ai 25 sotto. */
const clean = (kind: Kind, n: number) => {
  const v = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  return Math.floor(v / STEP[kind]) * STEP[kind];
};
const isEmpty = (e: Entry) => KINDS.every((k) => e[k] === 0);

/**
 * Le ricompense dei bauli (la tabella dei ritrovamenti del gioco originale): per ogni tipo di baule fino a 3 ricompense (2 per l'oro). Aprendo un baule si gira il suo segnalino e se ne
 * pesca una a caso fra quelle non ancora uscite per quel tipo. Ogni ricompensa è un elenco di premi, ognuno con un numero: punti Conquista, carte tesoro (per ogni eroe), denaro (monete
 * a ogni eroe) e maledizioni (ognuna dà al Maligno Odio pari al numero di eroi, prima del resto del baule). Per confermare servono almeno tante ricompense per tipo quanti sono i bauli di quel tipo in mappa.
 */
@Component({
  selector: 'app-chest-table-dialog',
  imports: [TranslatePipe, DialogComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [closeOnBackdrop]="false" [title]="'chestsDialog.title' | t" width="min(640px, 100%)" height="min(560px, calc(100vh - 48px))" (closed)="cancel.emit()">
        <p class="dlg-hint">{{ 'chestsDialog.intro' | t }}</p>
        @for (tier of tiers; track tier) {
          <section [style.--tone]="'var(--cad-chest-' + tier + ')'">
            <h3>{{ names[tier] }} <small [class.lack]="short(tier)">{{ table()[tier].length }}/{{ max[tier] }} · {{ 'chestsDialog.chestsOnMap' | t }} {{ chestCounts()[tier] }}</small></h3>
            @for (entry of table()[tier]; track $index; let ei = $index) {
              <div class="entry">
                <div class="head"><b>{{ names[tier] }} {{ ei + 1 }}</b><button type="button" class="trash" [attr.aria-label]="'chestsDialog.removeNamed' | t: { name: names[tier], n: ei + 1 }" [title]="'chestsDialog.removeReward' | t" (click)="removeEntry(tier, ei)"><app-icon name="delete" [size]="18" /></button></div>
                <!-- Tutto ciò che un baule può dare, in una griglia 2×2: 0 = niente. -->
                <div class="grid">
                  @for (kind of kinds; track kind) {
                    <div class="cell">
                      <span class="label">{{ label(kind, tier) }}</span>
                      <div class="stepper">
                        <button type="button" class="dlg-btn step" [attr.aria-label]="'chestsDialog.decrease' | t: { name: label(kind, tier) }" [attr.aria-disabled]="entry[kind] <= 0" (click)="change(tier, ei, kind, -1)"><app-icon name="remove" [size]="18" /></button>
                        <input type="number" min="0" [attr.step]="step[kind]" [value]="entry[kind]" [attr.aria-label]="label(kind, tier)" (input)="setValue(tier, ei, kind, $any($event.target).value, false)" (change)="setValue(tier, ei, kind, $any($event.target).value)" />
                        <button type="button" class="dlg-btn step" [attr.aria-label]="'chestsDialog.increase' | t: { name: label(kind, tier) }" (click)="change(tier, ei, kind, 1)"><app-icon name="add" [size]="18" /></button>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
            @if (short(tier)) { <p class="need">{{ (chestCounts()[tier] === 1 ? 'chestsDialog.needOne' : 'chestsDialog.needMany') | t: { n: chestCounts()[tier] } }}</p> }
            @if (table()[tier].length < max[tier]) { <button type="button" class="dlg-btn add" (click)="addEntry(tier)">{{ 'chestsDialog.addNamed' | t: { name: names[tier], n: table()[tier].length + 1 } }}</button> }
          </section>
        }
        <ng-container dialogFooter><button type="button" class="dlg-btn primary" [title]="'chestsDialog.saveHint' | t" (click)="confirm()">{{ 'common.confirm' | t }}</button></ng-container>
      </app-dialog>
    }
  `,
  styles: `
    section { display: flex; flex-direction: column; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid var(--c-line-strong); }
    section:last-of-type { border-bottom: 0; }
    h3 { margin: 0; font: 600 12px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--tone); }
    h3 small { color: var(--c-text-dim); font-family: var(--font-mono); margin-left: 6px; text-transform: none; letter-spacing: 0; font-weight: 400; }
    h3 small.lack { color: var(--c-danger); }
    .entry { display: flex; flex-direction: column; gap: 8px; padding: 8px 10px 10px; border: 1px solid var(--c-line-strong); border-left: 3px solid var(--tone); border-radius: var(--radius-1); }
    .head { display: flex; justify-content: space-between; align-items: center; }
    .trash { border: 0; background: none; color: var(--c-text-dim); cursor: pointer; padding: 0 4px; display: inline-flex; align-items: center; }
    .trash:hover { color: var(--c-danger); }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; }
    .cell { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .label { font: 600 11px/1.2 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    /* − valore +: i tasti sono alti come i campi (36 px, 42 col dito). */
    .stepper { display: grid; grid-template-columns: 36px minmax(0, 1fr) 36px; gap: 6px; align-items: center; }
    .stepper input { text-align: center; }
    .step { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; padding: 0; width: 36px; height: 36px; }
    @media (pointer: coarse) { .stepper { grid-template-columns: 42px minmax(0, 1fr) 42px; } .step { width: 42px; height: 42px; } }
    .add { align-self: flex-start; border-style: dashed; }
    .need { margin: 0; color: var(--c-danger); font-size: 12px; }
  `,
})
export class ChestTableDialogComponent {
  readonly open = input(false);
  readonly value = input<ChestTable>({});
  /** Quanti bauli ci sono in mappa per tipo: servono almeno altrettante ricompense. */
  readonly chestCounts = input<Record<ChestTier, number>>({ copper: 0, silver: 0, gold: 0 });
  readonly confirmed = output<ChestTable>();
  readonly cancel = output<void>();

  protected readonly tiers = TIERS;
  protected readonly kinds = KINDS;
  protected readonly step = STEP;
  protected readonly names = CHEST_TIER_NAMES;
  protected readonly max = CHEST_TABLE_MAX;
  protected readonly table = signal<Record<ChestTier, Entry[]>>({ copper: [], silver: [], gold: [] });

  /** L'etichetta di un premio: la carta tesoro è sempre del tipo del baule in cui sta. */
  protected label(kind: Kind, tier: ChestTier): string {
    return kind === 'treasure' ? t(`chestsDialog.treasure.${tier}`) : t(`chestsDialog.${kind}`);
  }

  /** Mancano ricompense: ce ne sono meno dei bauli di quel tipo. */
  protected short(tier: ChestTier): boolean {
    return this.table()[tier].length < this.chestCounts()[tier];
  }

  constructor() {
    effect(() => {
      const v = this.value();
      if (!this.open()) return;
      const entries = (tier: ChestTier): Entry[] => (v[tier] ?? []).map((reward) => {
        const e = emptyEntry();
        for (const l of reward.contents) {
          if (l.kind === 'progress') e.progress += l.amount;
          else if (l.kind === 'coins') e.coins += clean('coins', l.amount ?? 100);
          else if (l.kind === 'curse') e.curse += l.amount ?? 1;
        }
        e.treasure = reward.treasures ?? 0;
        return e;
      });
      this.table.set({ copper: entries('copper'), silver: entries('silver'), gold: entries('gold') });
    });
  }

  private update(tier: ChestTier, fn: (entries: Entry[]) => Entry[]) {
    this.table.update((t) => ({ ...t, [tier]: fn(t[tier]) }));
  }

  protected addEntry(tier: ChestTier) {
    if (this.table()[tier].length < CHEST_TABLE_MAX[tier]) this.update(tier, (e) => [...e, emptyEntry()]);
  }

  protected removeEntry(tier: ChestTier, i: number) {
    this.update(tier, (e) => e.filter((_, k) => k !== i));
  }

  private setEntry(tier: ChestTier, ei: number, kind: Kind, n: number) {
    this.update(tier, (e) => e.map((entry, k) => (k === ei ? { ...entry, [kind]: n } : entry)));
  }

  /** I tasti − e +: un passo (25 per il denaro), mai sotto zero. */
  protected change(tier: ChestTier, ei: number, kind: Kind, direction: 1 | -1) {
    const entry = this.table()[tier][ei];
    if (entry) this.setEntry(tier, ei, kind, clean(kind, entry[kind] + direction * STEP[kind]));
  }

  /** Un valore scritto a mano: un intero da 0 in su. Mentre si scrive non si arrotonda (altrimenti "25" non si potrebbe scrivere); a campo lasciato il denaro va ai 25 sotto. */
  protected setValue(tier: ChestTier, ei: number, kind: Kind, text: string, round = true) {
    const n = Number(text);
    this.setEntry(tier, ei, kind, round ? clean(kind, n) : Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
  }

  protected confirm() {
    const out: ChestTable = {};
    for (const tier of TIERS) {
      // Si può confermare anche incompleta: una ricompensa con tutti i valori a zero non si salva (se mancano, lo dice la Verifica).
      const rewards = this.table()[tier].map((e): Entry => ({ progress: clean('progress', e.progress), coins: clean('coins', e.coins), curse: clean('curse', e.curse), treasure: clean('treasure', e.treasure) })).filter((e) => !isEmpty(e)).map((e): ChestReward => {
        const contents: Loot[] = [];
        if (e.progress > 0) contents.push({ kind: 'progress', amount: e.progress });
        if (e.coins > 0) contents.push({ kind: 'coins', amount: e.coins });
        if (e.curse > 0) contents.push({ kind: 'curse', amount: e.curse });
        return { contents, ...(e.treasure > 0 ? { treasures: e.treasure } : {}) };
      });
      if (rewards.length) out[tier] = rewards;
    }
    this.confirmed.emit(out);
  }
}
