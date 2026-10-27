import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CostTextComponent } from './cost-text.component';

/** Ciò che la dialog di scelta mostra: un titolo, un testo (con i costi, come `{fat:2}`) e i bottoni fra cui scegliere. */
export interface ChoiceView {
  title: string;
  text: string;
  choices: { id: string; label: string; /** Il bottone principale (bordo acceso). */ primary?: boolean }[];
}

/**
 * Una piccola dialog con una domanda e dei bottoni (per esempio la Vigilanza: "attacchi con quest'arma o rinunci?"). Non si chiude da sola: bisogna scegliere.
 */
@Component({
  selector: 'app-choice-dialog',
  imports: [CostTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as v) {
      <div class="backdrop">
        <section class="box" role="dialog" aria-modal="true" [attr.aria-label]="v.title">
          <h2>{{ v.title }}</h2>
          <p><app-cost-text [text]="v.text" /></p>
          <div class="choices">
            @for (c of v.choices; track c.id) { <button type="button" [class.primary]="c.primary" (click)="chosen.emit(c.id)">{{ c.label }}</button> }
          </div>
        </section>
      </div>
    }
  `,
  styles: `
    :host { display: contents; }
    .backdrop { position: fixed; inset: 0; z-index: 860; display: grid; place-items: center; padding: 12px; background: rgba(0, 0, 0, 0.55); animation: fade 0.2s ease-out; }
    .box { display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; width: min(420px, 100%); padding: 20px 24px; background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); color: var(--c-text); font: 14px/1.45 var(--font-ui); }
    h2 { margin: 0; font: 600 var(--fs-lg)/1.2 var(--font-display); letter-spacing: 0.03em; }
    p { margin: 0; color: var(--c-text-dim); }
    .choices { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 4px; }
    button { padding: 8px 16px; border-radius: var(--radius-1); background: none; color: var(--c-text); cursor: pointer; border: 1px solid var(--c-line-strong); font: 600 13px/1.2 var(--font-ui); transition: color 0.15s, border-color 0.15s; }
    button.primary { border-color: var(--c-interact); }
    button:hover, button:focus-visible { border-color: var(--c-interact); color: var(--c-interact); outline: none; }
    @keyframes fade { from { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .backdrop { animation: none; } }
  `,
})
export class ChoiceDialogComponent {
  readonly view = input<ChoiceView | null>(null);
  readonly chosen = output<string>();
}
