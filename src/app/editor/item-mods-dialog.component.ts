import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ITEM_GIVE_COST } from '../game/constants';
import type { DieColor, ItemDef, ItemMod } from '../game/items/item';
import { CheckboxComponent } from '../ui/checkbox.component';
import { DialogComponent } from '../ui/dialog.component';
import { FieldComponent } from '../ui/field.component';
import { IconComponent } from '../ui/icon.component';
import { SelectComponent, type SelectOption } from '../ui/select.component';
import { translate as t } from '../i18n/i18n.service';

/** I dadi che si possono dare a un oggetto (il nero è il dado competenza, che non è degli oggetti), nell'ordine in cui compaiono. */
type DieKey = Exclude<DieColor, 'black'>;
const DICE: DieKey[] = ['red', 'green', 'blue', 'yellow', 'white'];

/** Una riga della tabella come si digita: quanti dadi di ogni colore e le abilità a scintille (costo ed effetto). */
interface Row {
  dice: Record<DieKey, number>;
  spark: { cost: string; effect: string }[];
}

/** Un oggetto personalizzato come si digita. */
interface Draft {
  id: string;
  /** L'oggetto cresce con dei livelli: la tabella ha più righe (l'ultima è il livello finale); altrimenti c'è una riga sola, i suoi valori. */
  levelsOn: boolean;
  label: string;
  rows: Row[];
  cursed: boolean;
  giveCost: string;
  /** La maledizione di fine turno: '' (nessuna) o il denominatore della frazione delle ferite massime ('4' = un quarto). */
  curse: string;
  /** Gli id delle armi di cui l'oggetto protegge dalle scintille. */
  protect: string[];
}

const CURSE_OPTIONS: SelectOption[] = [
  { value: '', get label() { return t('itemMods.curseNone'); } },
  { value: '4', get label() { return t('itemMods.curseQuarter'); } },
  { value: '3', get label() { return t('itemMods.curseThird'); } },
  { value: '2', get label() { return t('itemMods.curseHalf'); } },
];

const rowOf = (dice: readonly DieColor[] | undefined, spark: readonly { cost: number; effect: string }[] | undefined): Row => ({
  dice: Object.fromEntries(DICE.map((d) => [d, (dice ?? []).filter((x) => x === d).length])) as Record<DieKey, number>,
  spark: (spark ?? []).map((s) => ({ cost: String(s.cost), effect: s.effect })),
});
const copyRow = (r: Row): Row => ({ dice: { ...r.dice }, spark: r.spark.map((s) => ({ ...s })) });
const diceOf = (r: Row): DieColor[] => DICE.flatMap((d) => Array<DieColor>(r.dice[d]).fill(d));
const sparkOf = (r: Row): { cost: number; effect: string }[] => r.spark.filter((s) => s.effect.trim() && Number(s.cost) >= 1).map((s) => ({ cost: Math.floor(Number(s.cost)), effect: s.effect.trim() }));
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isInt = (s: string, min: number) => /^\d+$/.test(s.trim()) && Number(s) >= min;

/**
 * "Oggetti personalizzati" (cassetta Oggetti e tesori): gli oggetti del catalogo che l'avventura cambia (`MapData.itemMods`). A sinistra l'elenco (con l'icona genetics) e la scelta di un oggetto da
 * aggiungere; a destra le sue modifiche: una tabella di **livelli** (dadi e abilità a scintille di ogni riga, l'ultima è il livello finale) con l'etichetta che compare sulla carta, oppure i soli
 * valori; **maledetto** (con il costo di cessione) e la **maledizione di fine turno**. Il catalogo non cambia: le modifiche valgono solo per questa avventura.
 */
@Component({
  selector: 'app-item-mods-dialog',
  imports: [TranslatePipe, DialogComponent, FieldComponent, CheckboxComponent, IconComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [closeOnBackdrop]="false" [title]="'itemMods.title' | t" width="min(1000px, 100%)" height="min(680px, calc(100vh - 48px))" [flush]="true" (closed)="cancel.emit()">
        <div class="cols">
          <div class="col list">
            <p class="dlg-hint">{{ 'itemMods.intro' | t }}</p>
            <app-select class="block" [options]="addable()" value="" [placeholder]="'itemMods.add' | t" [label]="'itemMods.add' | t" (changed)="add($event)" />
            @for (d of drafts(); track d.id) {
              <button type="button" class="item" [class.on]="d.id === selectedId()" (click)="selectedId.set(d.id)">
                <app-icon name="genetics" [size]="16" /><span class="n">{{ nameOf(d.id) }}</span>
                <span class="rm" role="button" tabindex="0" [attr.aria-label]="'common.removeNamed' | t: { name: nameOf(d.id) }" [title]="'common.delete' | t" (click)="$event.stopPropagation(); remove(d.id)" (keydown.enter)="$event.stopPropagation(); remove(d.id)"><app-icon name="delete" [size]="16" /></span>
              </button>
            } @empty { <small class="dlg-hint">{{ 'itemMods.empty' | t }}</small> }
          </div>
          <div class="col edit">
            @if (current(); as d) {
              <h3>{{ nameOf(d.id) }}</h3>
              <app-checkbox [checked]="d.levelsOn" (changed)="setLevels($event)">{{ 'itemMods.levels' | t }}</app-checkbox>
              @if (d.levelsOn) {
                <app-field [label]="'itemMods.levelLabel' | t" [note]="'encounterDialog.optional' | t">
                  <input type="text" autocomplete="off" maxlength="40" [placeholder]="'itemMods.levelLabelExample' | t" [value]="d.label" (input)="patch({ label: $any($event.target).value })" />
                </app-field>
              }
              @for (row of d.rows; track $index; let ri = $index) {
                <section class="row">
                  <h4>{{ d.levelsOn ? (('itemMods.level' | t: { n: ri }) + (ri === d.rows.length - 1 ? ' · ' + ('itemMods.finalLevel' | t) : '')) : ('itemMods.values' | t) }}</h4>
                  <div class="dice">
                    @for (die of dice; track die) {
                      <span class="die">
                        <app-icon name="deployed_code" [size]="22" [style.color]="'var(--cad-die-' + die + ')'" [title]="dieName(die)" />
                        <button type="button" class="dlg-btn step" [attr.aria-label]="'itemMods.fewer' | t: { name: dieName(die) }" [attr.aria-disabled]="row.dice[die] <= 0" (click)="die1(ri, die, -1)"><app-icon name="remove" [size]="16" /></button>
                        <b>{{ row.dice[die] }}</b>
                        <button type="button" class="dlg-btn step" [attr.aria-label]="'itemMods.more' | t: { name: dieName(die) }" (click)="die1(ri, die, 1)"><app-icon name="add" [size]="16" /></button>
                      </span>
                    }
                  </div>
                  @for (s of row.spark; track $index; let si = $index) {
                    <div class="spark">
                      <input type="number" min="1" step="1" class="cost" [class.bad]="!ok(s.cost, 1)" [attr.aria-label]="'itemMods.sparkCost' | t" [value]="s.cost" (input)="setSpark(ri, si, { cost: $any($event.target).value })" />
                      <input type="text" list="item-mod-effects" autocomplete="off" [class.bad]="!s.effect.trim()" [placeholder]="'itemMods.sparkEffect' | t" [value]="s.effect" (input)="setSpark(ri, si, { effect: $any($event.target).value })" />
                      <button type="button" class="dlg-rm" [attr.aria-label]="'itemMods.removeSpark' | t" [title]="'itemMods.removeSpark' | t" (click)="removeSpark(ri, si)">×</button>
                    </div>
                  }
                  <button type="button" class="dlg-btn small" (click)="addSpark(ri)">{{ 'itemMods.addSpark' | t }}</button>
                </section>
              }
              <datalist id="item-mod-effects">@for (e of effects(); track e) { <option [value]="e"></option> }</datalist>
              @if (d.levelsOn) {
                <div class="lv">
                  <button type="button" class="dlg-btn small" (click)="addLevel()">{{ 'itemMods.addLevel' | t }}</button>
                  <button type="button" class="dlg-btn small" [attr.aria-disabled]="d.rows.length <= 2" (click)="removeLevel()">{{ 'itemMods.removeLevel' | t }}</button>
                </div>
              }
              <hr />
              <app-checkbox [checked]="d.cursed" (changed)="patch({ cursed: $event })">{{ 'itemMods.cursed' | t }}</app-checkbox>
              @if (d.cursed) {
                <app-field [label]="'itemMods.giveCost' | t">
                  <input type="number" min="0" step="1" [class.bad]="!ok(d.giveCost, 0)" [value]="d.giveCost" (input)="patch({ giveCost: $any($event.target).value })" />
                </app-field>
                <small class="dlg-hint">{{ 'itemMods.cursedHint' | t }}</small>
              }
              <app-field [label]="'itemMods.curse' | t">
                <app-select class="block" [options]="curseOptions" [value]="d.curse" [label]="'itemMods.curse' | t" (changed)="patch({ curse: $event })" />
              </app-field>
              @if (d.curse) { <small class="dlg-hint">{{ 'itemMods.curseHint' | t }}</small> }
              <app-field [label]="'itemMods.protect' | t">
                <app-select class="block" [options]="protectOptions()" value="" [placeholder]="'itemMods.protectAdd' | t" [label]="'itemMods.protect' | t" (changed)="addProtect($event)" />
              </app-field>
              @if (d.protect.length) {
                <div class="dlg-chips">
                  @for (id of d.protect; track id) { <span class="dlg-chip">{{ nameOf(id) }}<button type="button" [attr.aria-label]="'common.removeNamed' | t: { name: nameOf(id) }" (click)="removeProtect(id)">×</button></span> }
                </div>
                <small class="dlg-hint">{{ 'itemMods.protectHint' | t }}</small>
              }
            } @else {
              <p class="dlg-hint">{{ 'itemMods.pick' | t }}</p>
            }
          </div>
        </div>
        <ng-container dialogFooter>
          @if (!valid()) { <span class="why">{{ 'itemMods.invalid' | t }}</span> }
          <button type="button" class="dlg-btn primary" [class.off]="!valid()" [attr.aria-disabled]="!valid()" (click)="confirm()">{{ 'common.confirm' | t }}</button>
        </ng-container>
      </app-dialog>
    }
  `,
  styles: `
    .cols { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: 260px minmax(0, 1fr); }
    .col { min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; }
    .col + .col { border-left: 1px solid var(--c-line-strong); }
    .item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; background: none; border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); color: var(--c-text); font: 600 13px/1.2 var(--font-ui); text-align: left; cursor: pointer; }
    .item app-icon { color: var(--c-interact); flex: none; }
    .item .n { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .item .rm { display: inline-flex; color: var(--c-text-dim); }
    .item .rm:hover { color: var(--c-danger); }
    .item.on, .item:hover { border-color: var(--c-interact); }
    h3 { margin: 0; font: 600 var(--fs-lg)/1.2 var(--font-display); }
    h4 { margin: 0 0 6px; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    .row { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); }
    .dice { display: flex; flex-wrap: wrap; gap: 6px 14px; }
    .die { display: inline-flex; align-items: center; gap: 4px; }
    .die b { min-width: 14px; text-align: center; font-family: var(--font-mono); }
    .step { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; padding: 0; width: 26px; height: 26px; }
    .spark { display: grid; grid-template-columns: 70px minmax(0, 1fr) auto; gap: 8px; align-items: center; }
    .lv { display: flex; gap: 8px; }
    .small { align-self: flex-start; padding: 4px 10px; font-size: 12px; }
    hr { width: 100%; border: 0; border-top: 1px solid var(--c-line-strong); margin: 4px 0; }
    .why { margin-right: auto; color: var(--c-danger); font-size: 12px; }
    @media (max-width: 760px) { .cols { grid-template-columns: minmax(0, 1fr); } .col + .col { border-left: 0; border-top: 1px solid var(--c-line-strong); } }
  `,
})
export class ItemModsDialogComponent {
  readonly open = input(false);
  readonly value = input<ItemMod[]>([]);
  /** Il catalogo degli oggetti, per sceglierne uno e partire dai suoi valori. */
  readonly catalog = input<ItemDef[]>([]);
  readonly confirmed = output<ItemMod[]>();
  readonly cancel = output<void>();

  protected readonly dice = DICE;
  protected readonly curseOptions = CURSE_OPTIONS;
  protected readonly drafts = signal<Draft[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly current = computed(() => this.drafts().find((d) => d.id === this.selectedId()) ?? null);
  protected readonly addable = computed<SelectOption[]>(() => this.catalog().filter((d) => !this.drafts().some((x) => x.id === d.id)).map((d) => ({ value: d.id, label: d.name })).sort((a, b) => a.label.localeCompare(b.label, 'it')));
  /** Le frasi delle abilità a scintille del catalogo: si propongono quando si scrive. */
  protected readonly effects = computed(() => [...new Set(this.catalog().flatMap((d) => (d.spark ?? []).map((s) => s.effect)))].sort((a, b) => a.localeCompare(b, 'it')));
  /** Le armi (oggetti con scintille) da cui si può proteggere, meno quelle già scelte. */
  protected readonly protectOptions = computed<SelectOption[]>(() => {
    const chosen = this.current()?.protect ?? [];
    return this.catalog().filter((d) => d.spark?.length && !chosen.includes(d.id)).map((d) => ({ value: d.id, label: d.name })).sort((a, b) => a.label.localeCompare(b.label, 'it'));
  });
  protected readonly valid = computed(() => this.drafts().every((d) => d.rows.every((r) => r.spark.every((s) => isInt(s.cost, 1) && !!s.effect.trim())) && (!d.cursed || isInt(d.giveCost, 0))));

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const drafts = this.value().map((m) => this.draftOf(m));
      this.drafts.set(drafts);
      this.selectedId.set(drafts[0]?.id ?? null);
    });
  }

  protected nameOf(id: string): string {
    return this.catalog().find((d) => d.id === id)?.name ?? id;
  }

  protected dieName(d: DieKey): string {
    return { red: t('itemMods.die.red'), green: t('itemMods.die.green'), blue: t('itemMods.die.blue'), yellow: t('itemMods.die.yellow'), white: t('itemMods.die.white') }[d];
  }

  protected ok(s: string, min: number): boolean {
    return isInt(s, min);
  }

  /** Il modulo di un oggetto già personalizzato (ciò che manca resta com'è sulla carta). */
  private draftOf(m: ItemMod): Draft {
    const base = this.catalog().find((d) => d.id === m.id);
    const baseRow = rowOf(base?.dice, base?.spark);
    const rows = m.levels?.length ? m.levels.map((l) => rowOf(l.dice ?? base?.dice, 'spark' in l ? (l.spark ?? []) : base?.spark)) : [m.dice || m.spark ? rowOf(m.dice ?? base?.dice, m.spark ?? base?.spark) : baseRow];
    return { id: m.id, levelsOn: !!m.levels?.length, label: m.levelLabel ?? '', rows, cursed: !!m.cursed, giveCost: String(m.giveCost ?? ITEM_GIVE_COST), curse: m.curse ? String(m.curse.fraction) : '', protect: [...(m.protectFrom ?? [])] };
  }

  protected add(id: string) {
    const base = this.catalog().find((d) => d.id === id);
    if (!base) return;
    this.drafts.update((l) => [...l, { id, levelsOn: false, label: '', rows: [rowOf(base.dice, base.spark)], cursed: false, giveCost: String(ITEM_GIVE_COST), curse: '', protect: [] }]);
    this.selectedId.set(id);
  }

  protected remove(id: string) {
    this.drafts.update((l) => l.filter((d) => d.id !== id));
    if (this.selectedId() === id) this.selectedId.set(this.drafts()[0]?.id ?? null);
  }

  private update(fn: (d: Draft) => Draft) {
    const id = this.selectedId();
    this.drafts.update((l) => l.map((d) => (d.id === id ? fn(d) : d)));
  }

  protected addProtect(id: string) {
    if (id) this.update((d) => (d.protect.includes(id) ? d : { ...d, protect: [...d.protect, id] }));
  }

  protected removeProtect(id: string) {
    this.update((d) => ({ ...d, protect: d.protect.filter((x) => x !== id) }));
  }

  protected patch(p: Partial<Draft>) {
    this.update((d) => ({ ...d, ...p }));
  }

  /** Accende o spegne i livelli: accesi partono due righe (iniziale e finale) uguali ai valori di adesso; spenti resta l'ultima riga, quella finale. */
  protected setLevels(on: boolean) {
    this.update((d) => (on ? { ...d, levelsOn: true, rows: [copyRow(d.rows[0]), copyRow(d.rows[0])] } : { ...d, levelsOn: false, rows: [copyRow(d.rows[d.rows.length - 1])] }));
  }

  private updateRow(ri: number, fn: (r: Row) => Row) {
    this.update((d) => ({ ...d, rows: d.rows.map((r, i) => (i === ri ? fn(r) : r)) }));
  }

  protected die1(ri: number, die: DieKey, delta: number) {
    this.updateRow(ri, (r) => ({ ...r, dice: { ...r.dice, [die]: Math.max(0, r.dice[die] + delta) } }));
  }

  protected addSpark(ri: number) {
    this.updateRow(ri, (r) => ({ ...r, spark: [...r.spark, { cost: '1', effect: '' }] }));
  }

  protected removeSpark(ri: number, si: number) {
    this.updateRow(ri, (r) => ({ ...r, spark: r.spark.filter((_, i) => i !== si) }));
  }

  protected setSpark(ri: number, si: number, p: Partial<{ cost: string; effect: string }>) {
    this.updateRow(ri, (r) => ({ ...r, spark: r.spark.map((s, i) => (i === si ? { ...s, ...p } : s)) }));
  }

  /** Un livello in più in fondo (copia dell'ultimo, che resta il finale). */
  protected addLevel() {
    this.update((d) => ({ ...d, rows: [...d.rows, copyRow(d.rows[d.rows.length - 1])] }));
  }

  protected removeLevel() {
    this.update((d) => (d.rows.length > 2 ? { ...d, rows: d.rows.slice(0, -1) } : d));
  }

  /** Una personalizzazione come si salva: solo ciò che cambia rispetto alla carta. Senza modifiche l'oggetto non resta in elenco. */
  private modOf(d: Draft): ItemMod | null {
    const base = this.catalog().find((x) => x.id === d.id);
    const mod: ItemMod = { id: d.id };
    if (d.levelsOn && d.rows.length >= 2) {
      mod.levels = d.rows.map((r) => ({ dice: diceOf(r), spark: sparkOf(r) }));
      if (d.label.trim()) mod.levelLabel = d.label.trim();
    } else {
      const r = d.rows[d.rows.length - 1];
      if (!sameJson(diceOf(r), base?.dice ?? [])) mod.dice = diceOf(r);
      if (!sameJson(sparkOf(r), base?.spark ?? [])) mod.spark = sparkOf(r);
    }
    if (d.cursed) {
      mod.cursed = true;
      if (isInt(d.giveCost, 0) && Number(d.giveCost) !== ITEM_GIVE_COST) mod.giveCost = Number(d.giveCost);
    }
    if (d.curse) mod.curse = { fraction: Number(d.curse) };
    if (d.protect.length) mod.protectFrom = [...d.protect];
    return Object.keys(mod).length > 1 ? mod : null;
  }

  protected confirm() {
    if (!this.valid()) return;
    this.confirmed.emit(this.drafts().flatMap((d) => this.modOf(d) ?? []));
  }
}
