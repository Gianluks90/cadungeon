import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HeroSheet } from '../game/heroes/hero-sheet';
import { AttackDiceComponent } from './attack-dice.component';
import { HeartsComponent } from './hearts.component';
import { IconComponent } from './icon.component';

/** La card di un eroe nel catalogo: ritratto, nome e classe, parametri, dadi d'attacco, abilità iniziali e abilità (per ora un testo segnaposto). */
@Component({
  selector: 'app-hero-card',
  imports: [AttackDiceComponent, HeartsComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sheet(); as h) {
      <article class="card">
        <header>
          @if (h.portrait) { <img [src]="h.portrait" [alt]="h.name" draggable="false" /> }
          <div class="who">
            <h4>{{ h.name }}</h4>
            <span class="class">{{ h.class }}</span>
          </div>
        </header>
        <!-- Come nella scheda dell'eroe: i cuori, una riga a puntini e il valore delle ferite -->
        <div class="life">
          <app-hearts [wounds]="h.wounds" [max]="h.wounds" [size]="18" />
          <span class="dots" aria-hidden="true"></span>
          <span class="health" title="Ferite">{{ h.wounds }}</span>
        </div>
        <div class="stats">
          <span class="speed" title="Velocità"><app-icon name="footprint" [size]="16" />{{ h.speed }}</span>
          <span class="fatigue" title="Fatica"><app-icon name="water_drop" [size]="16" />{{ h.fatigue }}</span>
          <span title="Armatura"><app-icon name="shield" [size]="16" />{{ h.armor }}</span>
          <span title="Valore: il Progresso che si perde se muore"><app-icon name="brightness_empty" [size]="16" />{{ h.value }}</span>
        </div>
        <section>
          <h5>Dadi d'attacco extra</h5>
          <app-attack-dice [dice]="h.dice" />
        </section>
        <section>
          <h5>Abilità iniziali</h5>
          <p>Combattimento {{ h.skills.combat }} · Sotterfugio {{ h.skills.cunning }} · Magia {{ h.skills.magic }}</p>
        </section>
        <!-- L'abilità degli eroi non è ancora definita: testo segnaposto -->
        <section><h5>Abilità</h5><p class="placeholder">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.</p></section>
      </article>
    }
  `,
  styles: `
    :host { display: block; color: var(--c-text); font: 13px/1.35 var(--font-ui); }
    .card { box-sizing: border-box; height: 100%; display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: var(--radius-1); border: 1px solid var(--c-line-strong); background: var(--c-bg); }
    header { display: flex; align-items: center; gap: 12px; }
    img { flex: none; width: 64px; height: 64px; border-radius: var(--radius-1); object-fit: cover; object-position: center top; box-shadow: 0 0 0 1px var(--c-line); }
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
