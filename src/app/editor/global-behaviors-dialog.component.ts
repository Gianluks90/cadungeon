import { translate as t } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { BEHAVIOR_OPTIONS, GlobalBehavior, behaviorFrom, behaviorItem, behaviorKind, type BehaviorKind } from '../game/pieces/pawn-behavior';
import { DialogComponent } from '../ui/dialog.component';
import { FieldComponent } from '../ui/field.component';
import { SelectComponent, SelectOption } from '../ui/select.component';

/** Una riga come si modifica: quale comportamento e per quali tipi di mostro (id del catalogo; vuoto = tutti). */
interface Row {
  kind: BehaviorKind;
  /** Solo per `carry`: l'oggetto che vuole ('' = qualsiasi oggetto trasportabile). */
  itemId: string;
  monsters: string[];
}

/** I comportamenti che hanno senso per tutta l'avventura (gli altri, come "termina il turno accanto a…", dipendono da un ostacolo e si scrivono sul singolo nemico). */
const GLOBAL_KINDS: SelectOption[] = BEHAVIOR_OPTIONS.filter((o) => o.value === 'carry').map((o) => ({ value: o.value, label: o.label }));

/**
 * Il pannello dei comportamenti globali dei mostri (pulsante "Comportamenti" a sinistra): ogni riga è un comportamento che vale per i mostri dei tipi scelti o, se non se ne sceglie
 * nessuno, per tutti. Un singolo nemico può ignorarli (Personalizza → "Ignora i comportamenti globali"). Per ora c'è "Raccoglie gli oggetti trasportabili".
 */
@Component({
  selector: 'app-global-behaviors-dialog',
  imports: [TranslatePipe, DialogComponent, FieldComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [closeOnBackdrop]="false" [title]="'behaviorsDialog.comportamentiGlobaliDeiMostri' | t" width="min(560px, 100%)" height="min(520px, calc(100vh - 48px))" (closed)="cancel.emit()">
        <p class="dlg-hint">{{ 'behaviorsDialog.regoleCheValgonoPerI' | t }}</p>
        @for (r of rows(); track $index; let i = $index) {
          <section>
            <div class="row">
              <app-select class="block" [options]="kinds" [value]="r.kind" [label]="'common.comportamento' | t" (changed)="patch(i, { kind: $any($event) })" />
              <button type="button" class="dlg-rm" [attr.aria-label]="'behaviorsDialog.togliIlComportamento' | t" [title]="'behaviorsDialog.togliIlComportamento' | t" (click)="remove(i)">×</button>
            </div>
            @if (r.kind === 'carry') {
              <app-field [label]="'common.oggetto' | t" [note]="'common.facoltativo' | t">
                <app-select class="block" [options]="itemOptions()" [value]="r.itemId" [label]="'common.oggetto' | t" (changed)="patch(i, { itemId: $event })" />
              </app-field>
            }
            <!-- Non dentro un app-field: è una <label>, e passandoci sopra con il mouse si illuminerebbe il primo bottone al suo interno (la X del primo tipo). -->
            <div class="field">
              <span class="cap">{{ 'behaviorsDialog.valePer' | t }}</span>
              <div class="dlg-chips">
                @for (id of r.monsters; track id) { <span class="dlg-chip">{{ nameOf(id) }}<button type="button" [attr.aria-label]="'common.removeNamed' | t: { name: nameOf(id) }" (click)="removeType(i, id)">×</button></span> }
                @empty { <span class="dlg-hint">{{ 'behaviorsDialog.tuttiIMostri' | t }}</span> }
              </div>
              @if (freeTypes(r).length) { <app-select class="block" [options]="freeTypes(r)" value="" [placeholder]="'behaviorsDialog.aggiungiUnTipoDiMostro' | t" [label]="'behaviorsDialog.tipoDiMostro' | t" (changed)="addType(i, $event)" /> }
            </div>
            @if (r.kind === 'carry') {
              <small class="dlg-hint">{{ (itemName(r) ? 'behaviorsDialog.carryHintItem' : 'behaviorsDialog.carryHint') | t: { item: itemName(r) } }}</small>
            }
          </section>
        } @empty {
          <p class="dlg-hint">{{ 'behaviorsDialog.nessunComportamentoGlobale' | t }}</p>
        }
        <button type="button" class="dlg-btn small" (click)="add()">{{ 'behaviorsDialog.aggiungiUnComportamento' | t }}</button>
        <ng-container dialogFooter><button type="button" class="dlg-btn primary" (click)="confirm()">{{ 'common.conferma' | t }}</button></ng-container>
      </app-dialog>
    }
  `,
  styles: `
    section { display: flex; flex-direction: column; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid var(--c-line-strong); }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .cap { font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; }
  `,
})
export class GlobalBehaviorsDialogComponent {
  readonly open = input(false);
  readonly value = input<GlobalBehavior[]>([]);
  /** I tipi di mostro del catalogo. */
  readonly monsterTypes = input<{ id: string; name: string }[]>([]);
  /** Gli oggetti del catalogo (`carried`: quelli trasportabili, gli unici che ha senso scegliere). */
  readonly items = input<{ id: string; name: string; carried?: boolean }[]>([]);
  readonly confirmed = output<GlobalBehavior[]>();
  readonly cancel = output<void>();

  protected readonly kinds = GLOBAL_KINDS;
  protected readonly rows = signal<Row[]>([]);
  /** Le voci della select dell'oggetto: la prima, vuota, vuol dire qualsiasi. */
  protected readonly itemOptions = computed<SelectOption[]>(() => [{ value: '', label: t('behaviorsDialog.anyCarriable') }, ...this.items().filter((i) => i.carried).map((i) => ({ value: i.id, label: i.name }))]);
  protected itemName(r: Row): string {
    return r.itemId ? (this.items().find((i) => i.id === r.itemId)?.name ?? '') : '';
  }

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.rows.set(this.value().map((g) => ({ kind: behaviorKind(g.behavior) as BehaviorKind, itemId: behaviorItem(g.behavior), monsters: [...(g.monsters ?? [])] })));
    });
  }

  protected nameOf(id: string): string {
    return this.monsterTypes().find((m) => m.id === id)?.name ?? id;
  }

  /** I tipi non ancora scelti in questa riga. */
  protected freeTypes(r: Row): SelectOption[] {
    return this.monsterTypes().filter((m) => !r.monsters.includes(m.id)).map((m) => ({ value: m.id, label: m.name }));
  }

  protected add() {
    this.rows.update((l) => [...l, { kind: 'carry', itemId: '', monsters: [] }]);
  }

  protected remove(i: number) {
    this.rows.update((l) => l.filter((_, k) => k !== i));
  }

  protected patch(i: number, p: Partial<Row>) {
    this.rows.update((l) => l.map((r, k) => (k === i ? { ...r, ...p } : r)));
  }

  protected addType(i: number, id: string) {
    if (id) this.rows.update((l) => l.map((r, k) => (k === i && !r.monsters.includes(id) ? { ...r, monsters: [...r.monsters, id] } : r)));
  }

  protected removeType(i: number, id: string) {
    this.rows.update((l) => l.map((r, k) => (k === i ? { ...r, monsters: r.monsters.filter((m) => m !== id) } : r)));
  }

  protected confirm() {
    this.confirmed.emit(this.rows().flatMap((r): GlobalBehavior[] => {
      const behavior = behaviorFrom(r.kind, '', r.itemId);
      return behavior ? [{ behavior, ...(r.monsters.length ? { monsters: [...r.monsters] } : {}) }] : [];
    }));
  }
}
