import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { CHEST_TABLE_MAX, CHEST_TIER_NAMES, ChestReward, ChestTable, ChestTier, Loot } from '../game/board/marker';
import { DialogComponent } from '../ui/dialog.component';
import { IconComponent } from '../ui/icon.component';
import { SelectComponent, SelectOption } from '../ui/select.component';

/** Una ricompensa della tabella come si digita: cosa dà e, per la Conquista, quanta. */
interface Row {
  kind: 'progress' | 'treasure' | 'coins' | 'curse';
  amount: string;
}

const TIERS: ChestTier[] = ['copper', 'silver', 'gold'];
/** I tipi di premio, nell'ordine in cui compaiono nel menu: la carta tesoro è sempre del tipo del baule in cui la si mette (rame, argento, oro). */
const TIER_OF_CARD: Record<ChestTier, string> = { copper: 'rame', silver: 'argento', gold: 'oro' };
const kindOptions = (tier: ChestTier): SelectOption[] => [
  { value: 'progress', label: 'Punti Conquista' },
  { value: 'coins', label: 'Denaro' },
  { value: 'curse', label: 'Maledizione' },
  { value: 'treasure', label: `Carta tesoro di ${TIER_OF_CARD[tier]}` },
];

/** Il minimo e il passo di ogni premio: il denaro va a multipli di 25 (da 25), il resto da 1. */
const MIN: Record<Row['kind'], number> = { progress: 1, coins: 25, curse: 1, treasure: 1 };
const STEP: Record<Row['kind'], number> = { progress: 1, coins: 25, curse: 1, treasure: 1 };
/** Un premio nuovo parte dal suo minimo. */
const startAmount = (kind: Row['kind']) => String(MIN[kind]);
/** La quantità è valida per quel premio: un intero almeno al minimo e, per il denaro, multiplo di 25. */
const amountOk = (r: Row) => {
  const n = toInt(r.amount);
  return n >= MIN[r.kind] && n % STEP[r.kind] === 0;
};

const toInt = (s: string) => {
  const n = Number(s.trim());
  return s.trim() !== '' && Number.isInteger(n) ? n : 0;
};

/**
 * Le ricompense dei bauli (la tabella dei ritrovamenti del gioco originale): per ogni tipo di baule fino a 3 ricompense (2 per l'oro). Aprendo un baule si gira il suo segnalino e se ne
 * pesca una a caso fra quelle non ancora uscite per quel tipo. Ogni ricompensa è un elenco di premi, ognuno con un numero: punti Conquista, carte tesoro (per ogni eroe), denaro (monete
 * a ogni eroe) e maledizioni (segnalini che ricevono gli eroi: non ancora in gioco). Per confermare servono almeno tante ricompense per tipo quanti sono i bauli di quel tipo in mappa.
 */
@Component({
  selector: 'app-chest-table-dialog',
  imports: [DialogComponent, IconComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog title="Ricompense dei bauli" width="min(640px, 100%)" height="min(560px, calc(100vh - 48px))" (closed)="cancel.emit()">
        <p class="hint">Quando un eroe apre un baule ottiene casualmente una delle ricompense indicate di seguito corrispondente alla qualità del baule aperto. Devi inserire almeno una ricompensa per baule più tutte quelle aggiuntive che desideri.</p>
        @for (tier of tiers; track tier) {
          <section [style.--tone]="'var(--cad-chest-' + tier + ')'">
            <h3>{{ names[tier] }} <small [class.lack]="short(tier)">{{ table()[tier].length }}/{{ max[tier] }} · bauli in mappa: {{ chestCounts()[tier] }}</small></h3>
            @for (entry of table()[tier]; track $index; let ei = $index) {
              <div class="entry">
                <div class="head"><b>{{ names[tier] }} {{ ei + 1 }}</b><button type="button" class="trash" [attr.aria-label]="'Elimina la ricompensa ' + names[tier] + ' ' + (ei + 1)" title="Elimina questa ricompensa" (click)="removeEntry(tier, ei)"><app-icon name="delete" [size]="18" /></button></div>
                @for (row of entry; track $index; let ri = $index) {
                  <div class="row">
                    <app-select class="block" [options]="kindsFor(tier)" [value]="row.kind" label="Tipo di premio" (changed)="setKind(tier, ei, ri, $event)" />
                    <input type="number" [attr.min]="min[row.kind]" [attr.step]="step[row.kind]" [attr.value]="row.amount" [class.bad]="!amountValid(row)" aria-label="Quantità" (input)="setAmount(tier, ei, ri, $any($event.target).value)" />
                    <button type="button" class="rm" aria-label="Togli il premio" title="Togli il premio" (click)="removeRow(tier, ei, ri)">×</button>
                  </div>
                }
                <button type="button" class="dlg-btn small" (click)="addRow(tier, ei)">Aggiungi un premio</button>
              </div>
            }
            @if (short(tier)) { <p class="need">Servono almeno {{ chestCounts()[tier] }} {{ chestCounts()[tier] === 1 ? 'ricompensa' : 'ricompense' }} (un baule ciascuna).</p> }
            @if (table()[tier].length < max[tier]) { <button type="button" class="dlg-btn add" (click)="addEntry(tier)">Aggiungi {{ names[tier] }} {{ table()[tier].length + 1 }}</button> }
          </section>
        }
        <ng-container dialogFooter><button type="button" class="dlg-btn primary" [class.off]="!valid()" [attr.aria-disabled]="!valid()" [title]="valid() ? '' : 'Ogni baule ha bisogno di una ricompensa, e ogni premio di una quantità valida (il denaro a multipli di 25)'" (click)="confirm()">Conferma</button></ng-container>
      </app-dialog>
    }
  `,
  styles: `
    section { display: flex; flex-direction: column; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid var(--c-line-strong); }
    section:last-of-type { border-bottom: 0; }
    h3 { margin: 0; font: 600 12px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--tone); }
    h3 small { color: var(--c-text-dim); font-family: var(--font-mono); margin-left: 6px; text-transform: none; letter-spacing: 0; font-weight: 400; }
    h3 small.lack { color: var(--c-danger); }
    .entry { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border: 1px solid var(--c-line-strong); border-left: 3px solid var(--tone); border-radius: var(--radius-1); }
    .head { display: flex; justify-content: space-between; align-items: center; }
    .row { display: grid; grid-template-columns: 1fr 110px auto; gap: 8px; align-items: center; }
    input { box-sizing: border-box; padding: 7px 9px; border-radius: var(--radius-1); background: var(--c-bg); color: var(--c-text); border: 1px solid var(--c-line-strong); font: 13px/1.3 var(--font-mono); min-width: 0; width: 100%; }
    input:focus { border-color: var(--c-interact); outline: none; }
    input.bad { border-color: var(--c-danger); }
    .rm, .trash { border: 0; background: none; color: var(--c-text-dim); cursor: pointer; padding: 0 4px; display: inline-flex; align-items: center; }
    .rm { font-size: 16px; line-height: 1; }
    .rm:hover, .trash:hover { color: var(--c-danger); }
    .small { align-self: flex-start; padding: 4px 10px; font-size: 12px; }
    .add { align-self: flex-start; border-style: dashed; }
    .hint { margin: 0; color: var(--c-text-dim); font-size: 12px; }
    .need { margin: 0; color: var(--c-danger); font-size: 12px; }
    .dlg-btn.off { opacity: 0.45; cursor: default; }
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
  protected readonly min = MIN;
  protected readonly step = STEP;
  protected kindsFor(tier: ChestTier): SelectOption[] {
    return kindOptions(tier);
  }

  protected amountValid(r: Row): boolean {
    return amountOk(r);
  }

  protected readonly names = CHEST_TIER_NAMES;
  protected readonly max = CHEST_TABLE_MAX;
  protected readonly table = signal<Record<ChestTier, Row[][]>>({ copper: [], silver: [], gold: [] });
  protected readonly valid = computed(() => TIERS.every((t) => !this.short(t) && this.table()[t].every((entry) => entry.length > 0 && entry.every(amountOk))));

  /** Mancano ricompense: ce ne sono meno dei bauli di quel tipo. */
  protected short(tier: ChestTier): boolean {
    return this.table()[tier].length < this.chestCounts()[tier];
  }

  constructor() {
    effect(() => {
      const v = this.value();
      if (!this.open()) return;
      const rows = (tier: ChestTier): Row[][] => (v[tier] ?? []).map((reward) => [
        ...reward.contents.flatMap((l): Row[] => (l.kind === 'progress' ? [{ kind: 'progress', amount: String(l.amount) }] : l.kind === 'coins' ? [{ kind: 'coins', amount: String(l.amount ?? 100) }] : l.kind === 'curse' ? [{ kind: 'curse', amount: String(l.amount) }] : [])),
        ...(reward.treasures ? [{ kind: 'treasure' as const, amount: String(reward.treasures) }] : []),
      ]);
      this.table.set({ copper: rows('copper'), silver: rows('silver'), gold: rows('gold') });
    });
  }

  private update(tier: ChestTier, fn: (entries: Row[][]) => Row[][]) {
    this.table.update((t) => ({ ...t, [tier]: fn(t[tier]) }));
  }

  protected addEntry(tier: ChestTier) {
    if (this.table()[tier].length < CHEST_TABLE_MAX[tier]) this.update(tier, (e) => [...e, [{ kind: 'progress', amount: startAmount('progress') } as Row]]);
  }

  protected removeEntry(tier: ChestTier, i: number) {
    this.update(tier, (e) => e.filter((_, k) => k !== i));
  }

  protected addRow(tier: ChestTier, ei: number) {
    this.update(tier, (e) => e.map((entry, k) => (k === ei ? [...entry, { kind: 'progress', amount: startAmount('progress') } as Row] : entry)));
  }

  protected removeRow(tier: ChestTier, ei: number, ri: number) {
    this.update(tier, (e) => e.map((entry, k) => (k === ei ? entry.filter((_, r) => r !== ri) : entry)));
  }

  protected setKind(tier: ChestTier, ei: number, ri: number, kind: string) {
    this.update(tier, (e) => e.map((entry, k) => (k === ei ? entry.map((r, i) => (i === ri ? { kind: kind as Row['kind'], amount: startAmount(kind as Row['kind']) } : r)) : entry)));
  }

  protected setAmount(tier: ChestTier, ei: number, ri: number, amount: string) {
    this.update(tier, (e) => e.map((entry, k) => (k === ei ? entry.map((r, i) => (i === ri ? { ...r, amount } : r)) : entry)));
  }

  protected confirm() {
    if (!this.valid()) return;
    const out: ChestTable = {};
    for (const tier of TIERS) {
      const rewards = this.table()[tier].map((entry): ChestReward => {
        // I premi a zero non contano; le carte tesoro di più righe si sommano.
        const n = (kind: Row['kind']) => entry.filter((r) => r.kind === kind).reduce((sum, r) => sum + toInt(r.amount), 0);
        const contents: Loot[] = [];
        if (n('progress') > 0) contents.push({ kind: 'progress', amount: n('progress') });
        if (n('coins') > 0) contents.push({ kind: 'coins', amount: n('coins') });
        if (n('curse') > 0) contents.push({ kind: 'curse', amount: n('curse') });
        return { contents, ...(n('treasure') > 0 ? { treasures: n('treasure') } : {}) };
      });
      if (rewards.length) out[tier] = rewards;
    }
    this.confirmed.emit(out);
  }
}
