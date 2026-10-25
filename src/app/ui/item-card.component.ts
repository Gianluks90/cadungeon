import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ItemDef } from '../game/items/item';
import { IconComponent } from './icon.component';

/** I nomi dei dadi di un oggetto. */
const DIE_NAMES: Record<string, string> = { base: 'dado base', extra: 'dado extra' };

/**
 * La card di un oggetto, usata nell'inventario e nel negozio: icona, nome, tipo e mani, i dadi in alto a destra come cubi colorati (rosso il dado base, verde
 * quello extra), le abilità a tutta larghezza (fulmini e effetto affiancati) e un piede con le azioni a sinistra e il valore a destra.
 * La descrizione c'è nel modello ma non si mostra. Le azioni (equipaggia, compra...) arrivano da fuori.
 */
@Component({
  selector: 'app-item-card',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card corners">
      <header class="head">
        <span class="art"><app-icon [name]="icon()" [size]="30" /></span>
        <div class="titles">
          <h4>{{ def().name }}</h4>
          <span class="meta">{{ detail() }}</span>
        </div>
        @if (def().dice?.length) {
          <div class="cubes dice" title="Dadi che l'oggetto dà all'attacco">
            @for (d of def().dice; track $index) { <app-icon name="deployed_code" [size]="22" [style.color]="dieColor(d)" [title]="dieName(d)" /> }
          </div>
        }
      </header>

      @if (def().surge?.length || def().offHand) {
        <section class="skills">
          <h5>Abilità</h5>
          @for (s of def().surge ?? []; track $index) {
            <div class="line" [title]="'Spendi ' + s.cost + ' Scariche per questo effetto'">
              <span class="cubes">@for (n of cubes(s.cost); track n) { <app-icon name="bolt" [size]="16" /> }</span>
              <span class="what">{{ s.effect }}</span>
            </div>
          }
          @if (def().offHand) {
            <div class="line" title="Quando l'altra mano è libera (o ha un'altra arma a una mano), dà questo bonus">
              <span class="what">Mano libera {{ def().offHand }}</span>
            </div>
          }
        </section>
      }

      <footer class="foot">
        <div class="actions"><ng-content /></div>
        <span class="price" title="Valore"><app-icon name="tokens/gold_pile" [size]="14" />{{ price() ?? def().price }}</span>
      </footer>
    </article>
  `,
  styles: `
    :host { display: block; color: var(--c-text); font: 13px/1.35 var(--font-ui); }
    .card { position: relative; display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: var(--radius-1); border: 1px solid var(--c-line-strong); background: var(--c-bg); }
    /* Gli angoli "quota" stanno dentro la card, a 4 px dal bordo, così non sembrano staccati */
    .card.corners::before { top: 4px; left: 4px; }
    .card.corners::after { bottom: 4px; right: 4px; }
    .head { display: flex; align-items: center; gap: 12px; }
    .art { flex: none; width: 48px; height: 48px; border-radius: var(--radius-1); display: inline-flex; align-items: center; justify-content: center; background: var(--c-tile); box-shadow: 0 0 0 1px var(--c-line); }
    .titles { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    h4 { margin: 0; font: 600 var(--fs-md)/1.2 var(--font-display); }
    .meta { color: var(--c-text-dim); font-size: 12px; }
    .skills { display: flex; flex-direction: column; gap: 4px; }
    .line { display: flex; align-items: center; gap: 6px; font-size: 12px; }
    .line .what { min-width: 0; }
    .cubes { display: inline-flex; align-items: center; gap: 1px; }
    h5 { margin: 0; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    .dice { flex: none; gap: 2px; }
    .foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 10px; border-top: 1px solid var(--c-line); }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .price { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; font: 12px var(--font-mono); font-variant-numeric: tabular-nums; color: var(--cad-coin); }
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
