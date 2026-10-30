import { tr } from '../i18n/catalog-text';
import { TrPipe } from '../i18n/tr.pipe';
import { CatalogTextPipe } from '../i18n/catalog-text.pipe';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DiceService } from '../game/dice/dice.service';
import { ItemDef } from '../game/items/item';
import { IconComponent } from './icon.component';

/** I nomi dei dadi di un oggetto. */
const DIE_NAMES: Record<string, string> = { get red() { return tr('dado rosso'); }, get green() { return tr('dado verde'); }, get blue() { return tr('dado blu'); }, get yellow() { return tr('dado giallo'); }, get white() { return tr('dado bianco'); } };

/**
 * La card di un oggetto, usata nell'inventario e nel negozio: icona, nome, tipo e mani, i dadi in alto a destra come cubi colorati (uno per colore), le abilità a tutta larghezza (fulmini e effetto affiancati) e un piede con le azioni a sinistra e il valore a destra.
 * La descrizione c'è nel modello ma non si mostra. Le azioni (equipaggia, compra...) arrivano da fuori.
 */
@Component({
  selector: 'app-item-card',
  imports: [TrPipe, CatalogTextPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card" [class.plain]="plain()">
      <header class="head">
        <span class="art"><app-icon [name]="icon()" [size]="30" /></span>
        <div class="titles">
          <h4>{{ def().name }}</h4>
          <span class="meta">{{ detail() }}</span>
        </div>
        @if (def().dice?.length) {
          <button type="button" class="cubes dice" [title]="'Tira i dadi dell\\'oggetto (prova temporanea)' | tr" (click)="rollDice()">
            @for (d of def().dice; track $index) { <app-icon name="deployed_code" [size]="22" [style.color]="dieColor(d)" [title]="dieName(d)" /> }
          </button>
        }
      </header>

      @if (def().surge?.length || def().offHand || def().rules?.length) {
        <section class="skills">
          <h5>{{ 'Abilità' | tr }}</h5>
          @for (s of def().surge ?? []; track $index) {
            <div class="line" [title]="'Spendi {n} Scariche per questo effetto' | tr: { n: s.cost }">
              <span class="cubes">@for (n of cubes(s.cost); track n) { <app-icon name="bolt" [size]="16" /> }</span>
              <span class="what">{{ s.effect | ct }}</span>
            </div>
          }
          @for (r of def().rules ?? []; track $index) {
            <div class="line"><span class="what">{{ r | ct }}</span></div>
          }
          @if (def().offHand) {
            <div class="line" [title]="'Con due armi da mischia a una mano, quella con cui non attacchi aggiunge questo bonus all\\'attacco dell\\'altra (si applicherà con il combattimento)' | tr">
              <span class="what">{{ 'Bonus di supporto {bonus}' | tr: { bonus: (def().offHand! | ct) } }}</span>
            </div>
          }
        </section>
      }

      <footer class="foot">
        <div class="actions"><ng-content /></div>
        @if ((price() ?? def().price) > 0) { <span class="price" [title]="'Valore' | tr"><app-icon name="tokens/gold_pile" [size]="14" />{{ price() ?? def().price }}</span> }
      </footer>
    </article>
  `,
  styles: `
    :host { display: block; color: var(--c-text); font: 13px/1.35 var(--font-ui); }
    .card { position: relative; box-sizing: border-box; height: 100%; display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: var(--radius-1); border: 1px solid var(--c-line-strong); background: var(--c-bg); }
    /* Senza i tasti (come nel catalogo) il piede non ha il divisorio */
    .plain .foot { border-top: 0; padding-top: 0; }
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
    .dice { flex: none; gap: 2px; padding: 0; border: 0; background: none; cursor: pointer; }
    .foot { margin-top: auto; /* sempre sul fondo della card, anche quando la riga la allunga */ display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 10px; border-top: 1px solid var(--c-line); }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .price { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; font: 12px var(--font-mono); font-variant-numeric: tabular-nums; color: var(--cad-coin); }
  `,
})
export class ItemCardComponent {
  private readonly dice = inject(DiceService);
  readonly def = input.required<ItemDef>();
  readonly icon = input.required<string>();
  /** La riga con il tipo e le mani. */
  readonly detail = input('');
  /** Il prezzo da mostrare, se diverso da quello della carta (per esempio quando si vende). */
  readonly price = input<number | null>(null);
  /** Senza il divisorio sopra il piede (il catalogo non ha azioni). */
  readonly plain = input(false);

  /** Prova temporanea: toccare i dadi della card li tira. */
  protected rollDice() {
    void this.dice.rollItem(this.def().name, this.def().dice ?? []);
  }

  protected dieColor(d: string): string | null {
    return d in DIE_NAMES ? `var(--cad-die-${d})` : null;
  }

  protected dieName(d: string): string {
    return DIE_NAMES[d] ?? d;
  }

  protected cubes(n: number): number[] {
    return Array.from({ length: Math.max(0, n) }, (_, i) => i);
  }
}
