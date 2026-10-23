import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PotionKind } from '../game/board/marker';
import { BACKPACK_LIMIT, EQUIP_HANDS, POTION_LIMIT } from '../game/constants';
import { AttackDiceComponent } from './attack-dice.component';
import { HeroDetails } from './hero-sheet.component';
import { IconComponent } from './icon.component';

/** I nomi dei dadi di un oggetto. */
const DIE_NAMES: Record<string, string> = { base: 'dado base', extra: 'dado extra' };

/**
 * Il pannello "Inventario" di un eroe: le monete, i dadi d'attacco, le mani libere, le pozioni e gli oggetti (equipaggiati e nello zaino) come
 * card complete: tipo, dadi, abilità e prezzo, con le azioni per spostarli o scartarli. È il contenuto della cornice `app-hero-panel`.
 */
@Component({
  selector: 'app-inventory-panel',
  imports: [AttackDiceComponent, IconComponent, NgTemplateOutlet],
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
      <article class="card">
        <span class="art"><app-icon [name]="e.icon" [size]="30" /></span>
        <div class="body">
          <div class="top">
            <h4>{{ e.name }}</h4>
            <span class="price" title="Prezzo"><app-icon name="tokens/gold_pile" [size]="14" />{{ e.def.price }}</span>
          </div>
          <span class="meta">{{ e.detail }}</span>

          @if (e.def.dice?.length) {
            <div class="cubes dice" title="Dadi che l'oggetto dà all'attacco">
              @for (d of e.def.dice; track $index) { <app-icon name="deployed_code" [size]="22" [style.color]="dieColor(d)" [title]="dieName(d)" /> }
            </div>
          }
          @if (e.def.surge?.length || e.def.offHand) {
            <h5>Abilità</h5>
            @for (s of e.def.surge ?? []; track $index) {
              <div class="line" [title]="'Spendi ' + s.cost + ' Scariche per questo effetto'">
                <span class="cubes">@for (n of cubes(s.cost); track n) { <app-icon name="bolt" [size]="16" /> }</span>
                <span class="what">: {{ s.effect }}</span>
              </div>
            }
            @if (e.def.offHand) {
              <div class="line" title="Quando l'altra mano è libera (o ha un'altra arma a una mano), dà questo bonus">
                <span class="what">Mano libera: {{ e.def.offHand }}</span>
              </div>
            }
          }

          <div class="actions">
            <button type="button" class="act" [disabled]="!e.move.enabled" [title]="e.move.enabled ? e.move.label + ' (' + e.move.cost + ' punti movimento)' : e.move.reason"
              (click)="itemAction.emit({ action: e.where === 'backpack' ? 'equip' : 'stow', itemId: e.id })">{{ e.move.label }} <span class="cost"><app-icon name="footprint" [size]="14" />{{ e.move.cost }}</span></button>
            <button type="button" class="act" [disabled]="!e.canDrop" title="Scarta: l'oggetto è perso" (click)="itemAction.emit({ action: 'drop', itemId: e.id })">Scarta</button>
          </div>
        </div>
      </article>
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
    .card { display: flex; gap: 12px; padding: 10px 12px; border-radius: 14px; border: 1px solid var(--cad-ui-panel-border, #5a554d); background: #0c0c0c; }
    .art { flex: none; width: 48px; height: 48px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: #1d1c1a; box-shadow: 0 0 0 1px var(--cad-ui-border, #3a352f); }
    .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
    h4 { margin: 0; font: 600 14px/1.2 system-ui, sans-serif; }
    .price { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-variant-numeric: tabular-nums; color: var(--cad-coin, #d9b23a); }
    .meta { color: var(--cad-ui-text-muted, #8a8178); font-size: 12px; }
    .line { display: flex; align-items: center; gap: 8px; font-size: 12px; }
    .line .cubes { display: inline-flex; align-items: center; gap: 1px; }
    .line .what { min-width: 0; }
    h5 { margin: 4px 0 0; font: 600 11px/1 system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: var(--cad-ui-text-muted, #8a8178); }
    .dice { margin: 2px 0; }
    .cost { display: inline-flex; align-items: center; gap: 3px; margin-left: 4px; color: var(--cad-stat-movement, #6cc070); font-variant-numeric: tabular-nums; font-weight: 600; }
    .actions { display: flex; gap: 6px; margin-top: 6px; }
    .act {
      padding: 4px 10px; border-radius: 999px; background: none; color: var(--cad-ui-text, #d8cfc4); cursor: pointer; white-space: nowrap;
      border: 1px solid var(--cad-ui-panel-border, #5a554d); font: 12px/1.2 system-ui, sans-serif; transition: border-color 0.15s, color 0.15s;
    }
    .act:hover:not(:disabled), .act:focus-visible { border-color: var(--cad-accent-active, #e0a040); color: var(--cad-accent-active, #e0a040); outline: none; }
    .act:disabled { opacity: 0.35; cursor: default; }
  `,
})
export class InventoryPanelComponent {
  /** L'eroe di cui si mostra l'inventario. */
  readonly hero = input<HeroDetails | null>(null);
  /** Un'azione su un oggetto: equipaggiare, mettere nello zaino o scartare. */
  readonly itemAction = output<{ action: 'equip' | 'stow' | 'drop'; itemId: string }>();

  protected readonly backpackLimit = BACKPACK_LIMIT;

  /** Le mani libere: le 2 mani meno quelle occupate da armi e scudi. */
  protected freeHands(h: HeroDetails): number {
    return Math.max(0, EQUIP_HANDS - h.inventory.hands);
  }

  /** I tre posti per le pozioni: la pozione che c'è, o null se il posto è libero. */
  protected slots(potions: PotionKind[]): (PotionKind | null)[] {
    return Array.from({ length: POTION_LIMIT }, (_, i) => potions[i] ?? null);
  }

  /** Il colore del dado di un oggetto: il dado base è rosso, quello extra verde. */
  protected dieColor(d: string): string | null {
    return d === 'base' ? 'var(--cad-die-base)' : d === 'extra' ? 'var(--cad-die-extra)' : null;
  }

  protected dieName(d: string): string {
    return DIE_NAMES[d] ?? d;
  }

  protected cubes(n: number): number[] {
    return Array.from({ length: Math.max(0, n) }, (_, i) => i);
  }
}
