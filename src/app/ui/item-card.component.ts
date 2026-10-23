import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ItemDef } from '../game/items/item';
import { IconComponent } from './icon.component';

/** I nomi dei dadi di un oggetto. */
const DIE_NAMES: Record<string, string> = { base: 'dado base', extra: 'dado extra' };

/**
 * La card di un oggetto, usata nell'inventario e nel negozio: icona, nome, prezzo, tipo e mani, i dadi come cubi colorati (rosso il dado base, verde
 * quello extra) e le abilità (un fulmine per Scarica, e la mano libera). La descrizione c'è nel modello ma non si mostra. Le azioni (equipaggia, compra...)
 * arrivano da fuori, nello spazio in fondo.
 */
@Component({
  selector: 'app-item-card',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card">
      <span class="art"><app-icon [name]="icon()" [size]="30" /></span>
      <div class="body">
        <div class="top">
          <h4>{{ def().name }}</h4>
          <span class="price" title="Prezzo"><app-icon name="tokens/gold_pile" [size]="14" />{{ price() ?? def().price }}</span>
        </div>
        <span class="meta">{{ detail() }}</span>

        @if (def().dice?.length) {
          <div class="cubes dice" title="Dadi che l'oggetto dà all'attacco">
            @for (d of def().dice; track $index) { <app-icon name="deployed_code" [size]="22" [style.color]="dieColor(d)" [title]="dieName(d)" /> }
          </div>
        }
        @if (def().surge?.length || def().offHand) {
          <h5>Abilità</h5>
          @for (s of def().surge ?? []; track $index) {
            <div class="line" [title]="'Spendi ' + s.cost + ' Scariche per questo effetto'">
              <span class="cubes">@for (n of cubes(s.cost); track n) { <app-icon name="bolt" [size]="16" /> }</span>
              <span class="what">: {{ s.effect }}</span>
            </div>
          }
          @if (def().offHand) {
            <div class="line" title="Quando l'altra mano è libera (o ha un'altra arma a una mano), dà questo bonus">
              <span class="what">Mano libera: {{ def().offHand }}</span>
            </div>
          }
        }
        <div class="actions"><ng-content /></div>
      </div>
    </article>
  `,
  styles: `
    :host { display: block; color: var(--cad-ui-text, #d8cfc4); font: 13px/1.35 system-ui, sans-serif; }
    .card { display: flex; gap: 12px; padding: 10px 12px; border-radius: 14px; border: 1px solid var(--cad-ui-panel-border, #5a554d); background: #0c0c0c; }
    .art { flex: none; width: 48px; height: 48px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; background: #1d1c1a; box-shadow: 0 0 0 1px var(--cad-ui-border, #3a352f); }
    .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
    h4 { margin: 0; font: 600 14px/1.2 system-ui, sans-serif; }
    .price { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-variant-numeric: tabular-nums; color: var(--cad-coin, #d9b23a); }
    .meta { color: var(--cad-ui-text-muted, #8a8178); font-size: 12px; }
    .line { display: flex; align-items: center; gap: 0; font-size: 12px; }
    .line .what { min-width: 0; }
    .cubes { display: inline-flex; align-items: center; gap: 1px; }
    h5 { margin: 4px 0 0; font: 600 11px/1 system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: var(--cad-ui-text-muted, #8a8178); }
    .dice { margin: 2px 0; gap: 2px; }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 6px; }
    .actions:empty { display: none; }
  `,
})
export class ItemCardComponent {
  readonly def = input.required<ItemDef>();
  readonly icon = input.required<string>();
  /** La riga con il tipo e le mani. */
  readonly detail = input('');
  /** Il prezzo da mostrare, se diverso da quello della carta (per esempio quando si vende). */
  readonly price = input<number | null>(null);

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
