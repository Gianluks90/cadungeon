import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HeroSheet } from '../game/heroes/hero-sheet';
import { HeroStats } from '../game/heroes/hero-stats';
import { CatalogTextPipe } from '../i18n/catalog-text.pipe';
import { TranslatePipe } from '../i18n/translate.pipe';
import { HeartsComponent } from './hearts.component';
import { HeroStatsPillComponent } from './hero-stats-pill.component';
import { ValueStarComponent } from './value-star.component';

/**
 * La faccia di una carta eroe con i soliti parametri stampati: immagine a figura intera, cuori in alto a sinistra e, sopra il piede (nome e classe), la pillola di velocità e fatica a sinistra,
 * il Valore e l'armatura a destra. Riempie il contenitore che la ospita (che la ritaglia e la inclina). `armor` sostituisce l'armatura base (con gli oggetti comprati).
 */
@Component({
  selector: 'app-hero-face',
  imports: [CatalogTextPipe, HeartsComponent, HeroStatsPillComponent, TranslatePipe, ValueStarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hero(); as h) {
      <img [src]="h.portraitFull" [alt]="h.name" />
      <app-hearts class="hearts" [wounds]="shown().wounds" [max]="shown().wounds" [size]="18" />
      <div class="cap">
        <app-hero-stats-pill class="stats" [speed]="shown().speed" [fatigue]="shown().fatigue" />
        <app-value-star class="value" [value]="h.value" />
        <i class="armor" [title]="'shop.armor' | t" [attr.aria-label]="('shop.armor' | t) + ' ' + shown().armor">
          <svg viewBox="0 0 40 46" aria-hidden="true"><path d="M20 2 36 8v14c0 11-7 19-16 22C11 41 4 33 4 22V8Z" /></svg>
          <em>{{ shown().armor }}</em>
        </i>
        <b>{{ h.name }}</b><span>{{ h.class | ct }}</span>
      </div>
    }
  `,
  styles: `
    :host { position: absolute; inset: 0; display: block; }
    img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .hearts { position: absolute; top: 8px; left: 8px; display: flex; flex-direction: column; gap: 2px; }
    .cap { position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; gap: 2px; padding: 8px 12px 10px; background: var(--c-surface); border-top: 1px solid var(--c-line-strong); text-align: left; }
    .cap b { font: 600 var(--fs-md)/1.2 var(--font-display); letter-spacing: 0.04em; }
    .cap span { color: var(--c-text-dim); font-size: 11px; font-weight: 600; letter-spacing: var(--label-tracking); text-transform: uppercase; }
    .stats { position: absolute; left: 8px; bottom: calc(100% + 6px); }
    /* --face-inset: quanto la carta è infilata sotto un pannello sul lato destro (le cose a destra si spostano di tanto, per restare visibili). */
    .value { position: absolute; right: calc(48px + var(--face-inset, 0px)); bottom: calc(100% + 6px); }
    .armor { position: absolute; right: calc(8px + var(--face-inset, 0px)); bottom: calc(100% + 6px); width: 34px; height: 40px; display: inline-flex; align-items: center; justify-content: center; font-style: normal; }
    .armor svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .armor path { fill: var(--c-bg); stroke: var(--c-line-strong); stroke-width: 1; stroke-linejoin: round; }
    .armor em { position: relative; margin-top: -2px; font: 700 14px/1 var(--font-mono); font-style: normal; color: var(--c-text); }
  `,
})
export class HeroFaceComponent {
  readonly hero = input.required<HeroSheet>();
  /** I parametri con abilità e oggetti (`heroStats`); senza, quelli base della scheda. */
  readonly stats = input<HeroStats | null>(null);
  protected readonly shown = computed<HeroStats>(() => this.stats() ?? { wounds: this.hero().wounds, fatigue: this.hero().fatigue, speed: this.hero().speed, armor: this.hero().armor });
}
