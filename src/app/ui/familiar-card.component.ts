import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FamiliarDef } from '../game/familiars/familiar';
import { CatalogTextPipe } from '../i18n/catalog-text.pipe';
import { TrPipe } from '../i18n/tr.pipe';
import { IconComponent } from './icon.component';
import { MarkdownPipe } from './markdown.pipe';
import { PictureComponent } from './picture.component';

/** La card di un famiglio nel catalogo: immagine e nome, la velocità (spazi che percorre ogni volta che si sposta) e l'abilità, se ce l'ha. */
@Component({
  selector: 'app-familiar-card',
  imports: [TrPipe, CatalogTextPipe, MarkdownPipe, IconComponent, PictureComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (familiar(); as f) {
      <article class="card">
        <header>
          <span class="pic"><app-picture [src]="f.portrait ?? f.image" icon="pets" [iconSize]="30" /></span>
          <div class="who">
            <h4>{{ f.name }}</h4>
            <span class="kind">{{ 'Famiglio' | tr }}</span>
          </div>
        </header>
        <div class="stats">
          <span class="speed" [title]="'Velocità: spazi che percorre ogni volta che si sposta' | tr"><app-icon name="footprint" [size]="16" />{{ f.speed }}</span>
        </div>
        <section>
          <h5>{{ 'Abilità' | tr }}@if (f.abilityName) { <span class="aname">: {{ f.abilityName | ct }}</span> }</h5>
          @if (f.ability) { <div class="ability md" [innerHTML]="f.ability | ct | markdown"></div> } @else { <p class="none">{{ 'Nessuna: segue il suo padrone.' | tr }}</p> }
        </section>
      </article>
    }
  `,
  styles: `
    :host { display: block; color: var(--c-text); font: 13px/1.35 var(--font-ui); }
    .card { box-sizing: border-box; height: 100%; display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: var(--radius-1); border: 1px solid var(--c-line-strong); background: var(--c-bg); }
    header { display: flex; align-items: center; gap: 12px; }
    .pic { flex: none; width: 48px; height: 48px; border-radius: var(--radius-1); overflow: hidden; background: var(--c-tile); box-shadow: 0 0 0 1px var(--c-familiar); }
    .who { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    h4 { margin: 0; font: 600 var(--fs-md)/1.2 var(--font-display); }
    .kind { color: var(--c-text-dim); font-size: 11px; font-weight: 600; letter-spacing: var(--label-tracking); text-transform: uppercase; }
    .stats .speed { display: inline-flex; align-items: center; gap: 5px; color: var(--c-speed); font-weight: 600; font-variant-numeric: tabular-nums; }
    h5 { margin: 0 0 4px; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    .aname { text-transform: none; letter-spacing: 0; font-weight: 600; color: var(--c-text); }
    .none { margin: 0; color: var(--c-text-dim); font-size: 12px; }
  `,
})
export class FamiliarCardComponent {
  readonly familiar = input<FamiliarDef | null>(null);
}
