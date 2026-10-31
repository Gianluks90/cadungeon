import { TrPipe } from '../i18n/tr.pipe';
import { CatalogTextPipe } from '../i18n/catalog-text.pipe';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HeroSheet } from '../game/heroes/hero-sheet';
import { AttackDiceComponent } from './attack-dice.component';
import { MarkdownPipe } from './markdown.pipe';
import { HeartsComponent } from './hearts.component';
import { IconComponent } from './icon.component';
import { PictureComponent } from './picture.component';

/** La card di un eroe nel catalogo: ritratto, nome e classe, parametri, dadi d'attacco, abilità iniziali e abilità (per ora un testo segnaposto). */
@Component({
  selector: 'app-hero-card',
  imports: [TrPipe, CatalogTextPipe, MarkdownPipe, AttackDiceComponent, HeartsComponent, IconComponent, PictureComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sheet(); as h) {
      <article class="card">
        <header>
          <span class="pic"><app-picture [src]="h.portrait" [iconSize]="30" /></span>
          <div class="who">
            <h4>{{ h.name }}</h4>
            <span class="class">{{ h.class | ct }}</span>
          </div>
        </header>
        <!-- Come nella scheda dell'eroe: i cuori, una riga a puntini e il valore delle ferite -->
        <div class="life">
          <app-hearts [wounds]="h.wounds" [max]="h.wounds" [size]="18" />
          <span class="dots" aria-hidden="true"></span>
          <span class="health" [title]="'Ferite' | tr">{{ h.wounds }}</span>
        </div>
        <div class="stats">
          <span class="speed" [title]="'Velocità' | tr"><app-icon name="footprint" [size]="16" />{{ h.speed }}</span>
          <span class="fatigue" [title]="'Fatica' | tr"><app-icon name="water_drop" [size]="16" />{{ h.fatigue }}</span>
          <span [title]="'Armatura' | tr"><app-icon name="shield" [size]="16" />{{ h.armor }}</span>
          <span [title]="'Valore: la Conquista che si perde se muore' | tr"><app-icon name="brightness_empty" [size]="16" />{{ h.value }}</span>
        </div>
        <section>
          <h5>{{ 'Dadi d\\'attacco extra' | tr }}</h5>
          <app-attack-dice [dice]="h.dice" />
        </section>
        <section>
          <h5>{{ 'Abilità iniziali' | tr }}</h5>
          <p>{{ 'Combattimento' | tr }} {{ h.skills.combat }} · {{ 'Sotterfugio' | tr }} {{ h.skills.cunning }} · {{ 'Magia' | tr }} {{ h.skills.magic }}</p>
        </section>
        <!-- L'abilità primaria della scheda; se non è ancora definita, un testo segnaposto -->
        <section>
          <h5>{{ 'Abilità primaria' | tr }}@if (h.abilityName) { <span class="aname">: {{ h.abilityName | ct }}</span> }</h5>
          @if (h.ability) { <div class="ability md" [innerHTML]="h.ability | ct | markdown"></div> } @else { <p class="placeholder">{{ 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.' | tr }}</p> }
        </section>
      </article>
    }
  `,
  styles: `
    .aname { text-transform: none; letter-spacing: 0; font-weight: 600; color: var(--c-text); }
    :host { display: block; color: var(--c-text); font: 13px/1.35 var(--font-ui); }
    .card { box-sizing: border-box; height: 100%; display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: var(--radius-1); border: 1px solid var(--c-line-strong); background: var(--c-bg); }
    header { display: flex; align-items: center; gap: 12px; }
    .pic { flex: none; width: 64px; height: 64px; border-radius: var(--radius-1); overflow: hidden; background: var(--c-tile); box-shadow: 0 0 0 1px var(--c-line); }
    .who { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    h4 { margin: 0; font: 600 var(--fs-md)/1.2 var(--font-display); letter-spacing: 0.04em; }
    .class { color: var(--c-text-dim); font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; }
    .life { display: flex; align-items: center; gap: 10px; }
    .dots { flex: 1; min-width: 12px; border-bottom: 2px dotted color-mix(in srgb, var(--c-text) 12%, transparent); transform: translateY(3px); }
    .health { font: 600 16px/1 var(--font-ui); font-variant-numeric: tabular-nums; }
    .stats { display: flex; gap: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .stats span { display: inline-flex; align-items: center; gap: 5px; }
    .speed { color: var(--c-speed); }
    .fatigue { color: var(--c-stamina); }
    h5 { margin: 0 0 4px; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    p { margin: 0; }
    .placeholder { color: var(--c-text-dim); }
  `,
})
export class HeroCardComponent {
  readonly sheet = input<HeroSheet | null>(null);
}
