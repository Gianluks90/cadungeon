import { tr } from '../i18n/catalog-text';
import { TrPipe } from '../i18n/tr.pipe';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PotionKind } from '../game/board/marker';
import { BACKPACK_LIMIT, EQUIP_HANDS, POTION_LIMIT } from '../game/constants';
import { plainCostText } from './cost-text';
import { CostTextComponent } from './cost-text.component';
import { HeroDetails } from './hero-sheet.component';
import { IconComponent } from './icon.component';
import { ItemCardComponent } from './item-card.component';

/**
 * Il pannello "Inventario" di un eroe: le monete, le mani libere, le pozioni e gli oggetti (equipaggiati e nello zaino) come
 * card complete: tipo, dadi, abilità e prezzo, con le azioni per spostarli o scartarli. È il contenuto della cornice `app-hero-panel`.
 */
@Component({
  selector: 'app-inventory-panel',
  imports: [TrPipe, CostTextComponent, IconComponent, ItemCardComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hero(); as h) {
      <section>
        <div class="row"><span class="coins" [title]="'Monete dell\\'eroe' | tr"><app-icon name="tokens/gold_pile" [size]="18" />{{ h.coins }}<small>{{ 'Monete' | tr }}</small></span></div>

        <h3>{{ 'Pozioni' | tr }}</h3>
        <div class="row">
          @for (slot of slots(h.potions); track $index) {
            <span class="potion" [class.empty]="!slot" [style.color]="slot ? 'var(--cad-potion-' + slot + ')' : null" [title]="(slot === 'heal' ? 'Pozione curativa' : slot === 'vital' ? 'Pozione del vigore' : 'Posto libero') | tr">
              <app-icon name="tokens/potion" [size]="26" />
            </span>
          }
        </div>

        <h3>{{ 'Equipaggiamento' | tr }} <small>{{ 'Mani libere {n}' | tr: { n: freeHands(h) } }}</small></h3>
        <div class="cards">
          @for (e of h.inventory.equipped; track e.id) { <ng-container [ngTemplateOutlet]="card" [ngTemplateOutletContext]="{ $implicit: e }" /> }
          @empty { <p class="none">{{ 'Niente di equipaggiato' | tr }}</p> }
        </div>

        <h3>{{ 'Zaino' | tr }} <small>{{ h.inventory.backpack.length }} su {{ backpackLimit }}</small></h3>
        <div class="cards">
          @for (e of h.inventory.backpack; track e.id) { <ng-container [ngTemplateOutlet]="card" [ngTemplateOutletContext]="{ $implicit: e }" /> }
          @empty { <p class="none">{{ 'Zaino vuoto' | tr }}</p> }
        </div>
      </section>
    }

    <ng-template #card let-e>
      <app-item-card [def]="e.def" [icon]="e.icon" [detail]="e.detail">
        @if (e.use; as u) {
          <!-- Un oggetto che si usa: il costo (fatica, punti movimento) viene prima del testo, e se consuma l'oggetto lo dice dopo. -->
          <button type="button" class="act" [class.fat]="u.cost.includes('{fat:')" [class.mov]="!u.cost.includes('{fat:') && u.cost.includes('{mov:')" [class.off]="!u.enabled" [attr.aria-disabled]="!u.enabled" [title]="u.enabled ? ('Usa {name}' | tr: { name: e.name }) : plain(u.reason ?? '')"
            (click)="u.enabled ? itemAction.emit({ action: 'use', itemId: e.id }) : denied.emit(u.reason ?? notPossible())">@if (u.cost) { <app-cost-text [text]="u.cost" /> }{{ 'Usa' | tr }}@if (u.extra) { · {{ u.extra }} }</button>
        }
        <button type="button" class="act" [class.mov]="e.move.cost > 0" [class.off]="!e.move.enabled" [attr.aria-disabled]="!e.move.enabled" [title]="e.move.enabled ? e.move.label + ' (' + plain('{mov:' + e.move.cost + '}') + ')' : plain(e.move.reason ?? '')"
          (click)="e.move.enabled ? itemAction.emit({ action: e.where === 'backpack' ? 'equip' : 'stow', itemId: e.id }) : denied.emit(e.move.reason ?? notPossible())">@if (e.move.cost > 0) { <span class="cost"><app-icon name="footprint" [size]="14" />{{ e.move.cost }}</span> }{{ e.move.label }}</button>
        <button type="button" class="act" [class.off]="!e.canDrop" [attr.aria-disabled]="!e.canDrop" [title]="(e.carried ? 'Posa: resta a terra nella tua casella, chiunque la raggiunga la può prendere' : 'Scarta: l’oggetto è perso') | tr" (click)="e.canDrop ? itemAction.emit({ action: 'drop', itemId: e.id }) : denied.emit('Ora non puoi')">{{ e.carried ? 'Posa' : 'Scarta' }}</button>
      </app-item-card>
    </ng-template>
  `,
  styles: `
    :host { counter-reset: sec; display: block; color: var(--c-text); font: 13px/1.35 var(--font-ui); }
    h3::before { counter-increment: sec; content: counter(sec, decimal-leading-zero) ' — '; color: var(--c-text-faint); }
    h3 { margin: 14px 0 6px; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    h3 small { margin-left: 6px; font-weight: 400; letter-spacing: 0; text-transform: none; font-size: 12px; }
    small { color: var(--c-text-dim); }
    .row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
    .coins { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-family: var(--font-mono); font-variant-numeric: tabular-nums; color: var(--cad-coin); }
    .coins small { font-weight: 400; color: var(--c-text-dim); }
    .potion { display: inline-flex; padding: 3px; border: 1px solid currentColor; border-radius: var(--radius-1); color: var(--c-text); }
    .potion.empty { border-style: dashed; border-color: var(--c-line-strong); color: var(--c-text-faint); }
    .potion.empty app-icon { opacity: 0.4; }
    .none { margin: 0; color: var(--c-text-dim); font-size: 12px; }
    .cards { display: flex; flex-direction: column; gap: 8px; }
    .line .cubes { display: inline-flex; align-items: center; gap: 1px; }
    .cost { display: inline-flex; align-items: center; gap: 6px; color: var(--c-speed); font-variant-numeric: tabular-nums; font-weight: 600; }
    .act {
      display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 6px 14px; border-radius: var(--radius-1); background: none; color: var(--c-text); cursor: pointer; white-space: nowrap;
      border: 1px solid var(--c-line-strong); font: 13px/1.2 var(--font-ui); transition: border-color 0.15s, color 0.15s;
    }
    .act { --tone: var(--c-interact); transition: border-color 0.15s, background-color 0.15s; }
    .act.mov { --tone: var(--c-speed); }
    .act.fat { --tone: var(--c-stamina); }
    .act:hover:not(.off), .act:focus-visible:not(.off) { border-color: var(--tone); background: color-mix(in srgb, var(--tone) 8%, transparent); outline: none; }
    .act.off { opacity: 0.35; cursor: default; }
  `,
})
export class InventoryPanelComponent {
  /** Il motivo di riserva quando un'azione spenta non ne dà uno. */
  protected readonly notPossible = () => tr('Non è possibile');
  /** L'eroe di cui si mostra l'inventario. */
  readonly hero = input<HeroDetails | null>(null);
  /** Un'azione su un oggetto: equipaggiare, mettere nello zaino o scartare. */
  readonly itemAction = output<{ action: 'equip' | 'stow' | 'drop' | 'use'; itemId: string }>();
  /** Un bottone spento è stato toccato: il motivo per cui non si può (da mostrare come notifica). */
  readonly denied = output<string>();

  protected readonly backpackLimit = BACKPACK_LIMIT;
  /** Un testo con i costi a parole, per i suggerimenti col mouse. */
  protected plain = plainCostText;

  /** Le mani libere: le 2 mani meno quelle occupate da armi e scudi. */
  protected freeHands(h: HeroDetails): number {
    return Math.max(0, EQUIP_HANDS - h.inventory.hands);
  }

  /** I tre posti per le pozioni: la pozione che c'è, o null se il posto è libero. */
  protected slots(potions: PotionKind[]): (PotionKind | null)[] {
    return Array.from({ length: POTION_LIMIT }, (_, i) => potions[i] ?? null);
  }
}
