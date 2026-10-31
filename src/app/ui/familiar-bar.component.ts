import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TrPipe } from '../i18n/tr.pipe';
import { IconComponent } from './icon.component';

/**
 * La barra dello spostamento di un famiglio: sta dove stanno i comandi dell'eroe (stessa larghezza dell'elenco degli eroi, stesso spazio dalla barra), con il bordo del colore dei famigli,
 * la frase a sinistra e il tasto Passa (stessa icona di quello degli eroi) a destra.
 */
@Component({
  selector: 'app-familiar-bar',
  imports: [TrPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--slots]': 'slots()', '[style.left]': "'max(12px, calc(50% - (320px + ' + slots() * 75 + 'px) / 2))'" },
  template: `
    <p role="status">{{ text() }}</p>
    <button type="button" class="pass" [attr.aria-label]="'Passa' | tr" [title]="'Passa' | tr" (click)="pass.emit()"><app-icon name="skip_next" [size]="22" /><span>{{ 'Passa' | tr }}</span></button>
  `,
  styles: `
    @keyframes bar-in { from { transform: translateY(200%); opacity: 0; } }
    :host {
      position: absolute; z-index: 11; bottom: calc(var(--footer-height, 0px) + env(safe-area-inset-bottom) + 12px + 76px + 8px);
      width: min(calc(320px + var(--slots) * 75px), calc(100vw - 24px)); box-sizing: border-box; min-height: 44px;
      display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 5px 5px 5px 14px;
      background: var(--c-surface); border: 1px solid var(--c-familiar); border-radius: var(--radius-1); color: var(--c-text); font: 13px/1.3 var(--font-ui);
      animation: bar-in 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    @media (prefers-reduced-motion: reduce) { :host { animation: none; } }
    p { margin: 0; min-width: 0; }
    .pass {
      flex: none; display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; cursor: pointer; border-radius: var(--radius-1);
      background: var(--c-surface); border: 1px solid var(--c-line-strong); color: var(--c-text);
      font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; transition: color 0.15s, border-color 0.15s;
    }
    .pass:hover, .pass:focus-visible { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
  `,
})
export class FamiliarBarComponent {
  readonly slots = input(2);
  readonly text = input.required<string>();
  readonly pass = output<void>();
}
