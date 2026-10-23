import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PotionKind } from '../game/board/marker';
import { BACKPACK_LIMIT, EQUIP_HANDS, POTION_LIMIT } from '../game/constants';
import { AttackDiceComponent } from './attack-dice.component';
import { plainCostText } from './cost-text';
import { HeroDetails } from './hero-sheet.component';
import { IconComponent } from './icon.component';
import { ItemCardComponent } from './item-card.component';

/**
 * Il pannello "Inventario" di un eroe: le monete, i dadi d'attacco, le mani libere, le pozioni e gli oggetti (equipaggiati e nello zaino) come
 * card complete: tipo, dadi, abilità e prezzo, con le azioni per spostarli o scartarli. È il contenuto della cornice `app-hero-panel`.
 */
@Component({
  selector: 'app-inventory-panel',
  imports: [AttackDiceComponent, IconComponent, ItemCardComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hero(); as h) {
      <section>
        <div class="row"><span class="coins" title="Monete dell'eroe"><app-icon name="tokens/gold_pile" [size]="18" />{{ h.coins }}<small>Monete</small></span></div>

        <h3>Dadi d'attacco extra</h3>
        <app-attack-dice [dice]="h.dice" />

        <h3>Pozioni</h3>
        <div class="row">
          @for (slot of slots(h.potions); track $index) {
            <span class="potion" [class.empty]="!slot" [style.color]="slot ? 'var(--cad-potion-' + slot + ')' : null" [title]="slot === 'heal' ? 'Pozione curativa' : slot === 'vital' ? 'Pozione di vitalità' : 'Posto libero'">
              <app-icon name="tokens/potion" [size]="26" />
            </span>
          }
        </div>

        <h3>Equipaggiamento <small>Mani libere {{ freeHands(h) }}</small></h3>
        <div class="cards">
          @for (e of h.inventory.equipped; track e.id) { <ng-container [ngTemplateOutlet]="card" [ngTemplateOutletContext]="{ $implicit: e }" /> }
          @empty { <p class="none">Niente di equipaggiato</p> }
        </div>

        <h3>Zaino <small>{{ h.inventory.backpack.length }} su {{ backpackLimit }}</small></h3>
        <div class="cards">
          @for (e of h.inventory.backpack; track e.id) { <ng-container [ngTemplateOutlet]="card" [ngTemplateOutletContext]="{ $implicit: e }" /> }
          @empty { <p class="none">Zaino vuoto</p> }
        </div>
      </section>
    }

    <ng-template #card let-e>
      <app-item-card [def]="e.def" [icon]="e.icon" [detail]="e.detail">
        <button type="button" class="act" [class.off]="!e.move.enabled" [attr.aria-disabled]="!e.move.enabled" [title]="e.move.enabled ? e.move.label + ' (' + plain('{mov:' + e.move.cost + '}') + ')' : plain(e.move.reason ?? '')"
          (click)="e.move.enabled ? itemAction.emit({ action: e.where === 'backpack' ? 'equip' : 'stow', itemId: e.id }) : denied.emit(e.move.reason ?? 'Non è possibile')">{{ e.move.label }} <span class="cost"><app-icon name="footprint" [size]="14" />{{ e.move.cost }}</span></button>
        <button type="button" class="act" [class.off]="!e.canDrop" [attr.aria-disabled]="!e.canDrop" title="Scarta: l'oggetto è perso" (click)="e.canDrop ? itemAction.emit({ action: 'drop', itemId: e.id }) : denied.emit('Ora non puoi')">Scarta</button>
      </app-item-card>
    </ng-template>
  `,
  styles: `
    :host { display: block; color: var(--cad-ui-text, #d8cfc4); font: 13px/1.35 system-ui, sans-serif; }
    h3 { margin: 14px 0 6px; font: 600 11px/1 system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: var(--cad-ui-text-muted, #8a8178); }
    h3 small { margin-left: 6px; font-weight: 400; letter-spacing: 0; text-transform: none; font-size: 12px; }
    small { color: var(--cad-ui-text-muted, #8a8178); }
    .row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
    .coins { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--cad-coin, #d9b23a); }
    .coins small { font-weight: 400; color: var(--cad-ui-text-muted, #8a8178); }
    .potion { display: inline-flex; color: var(--cad-ui-text, #d8cfc4); }
    .potion.empty { opacity: 0.25; }
    .none { margin: 0; color: var(--cad-ui-text-muted, #8a8178); font-size: 12px; }
    .cards { display: flex; flex-direction: column; gap: 8px; }
    .line .cubes { display: inline-flex; align-items: center; gap: 1px; }
    .cost { display: inline-flex; align-items: center; gap: 3px; margin-left: 4px; color: var(--cad-stat-movement, #6cc070); font-variant-numeric: tabular-nums; font-weight: 600; }
    .act {
      padding: 4px 10px; border-radius: 999px; background: none; color: var(--cad-ui-text, #d8cfc4); cursor: pointer; white-space: nowrap;
      border: 1px solid var(--cad-ui-panel-border, #5a554d); font: 12px/1.2 system-ui, sans-serif; transition: border-color 0.15s, color 0.15s;
    }
    .act:hover:not(.off), .act:focus-visible:not(.off) { border-color: var(--cad-accent-active, #e0a040); color: var(--cad-accent-active, #e0a040); outline: none; }
    .act.off { opacity: 0.35; cursor: default; }
  `,
})
export class InventoryPanelComponent {
  /** L'eroe di cui si mostra l'inventario. */
  readonly hero = input<HeroDetails | null>(null);
  /** Un'azione su un oggetto: equipaggiare, mettere nello zaino o scartare. */
  readonly itemAction = output<{ action: 'equip' | 'stow' | 'drop'; itemId: string }>();
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
