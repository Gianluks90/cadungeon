import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Un campo di una dialog: l'etichetta in piccolo sopra, il campo (input, textarea o menu) proiettato sotto e, se serve, l'errore in rosso.
 * L'aspetto dei campi è uno solo, in `styles.css` ("Campi delle dialog"): qui sta solo l'etichetta.
 */
@Component({
  selector: 'app-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label>
      <span class="cap">{{ label() }}@if (note()) { <small>{{ note() }}</small> }</span>
      <ng-content />
      @if (error()) { <small class="err">{{ error() }}</small> }
    </label>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    label { display: flex; flex-direction: column; gap: 6px; }
    .cap { font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    .cap small { margin-left: 4px; text-transform: none; letter-spacing: 0; font-weight: 400; }
    .err { color: var(--c-danger); font-size: 12px; }
  `,
})
export class FieldComponent {
  readonly label = input.required<string>();
  /** Una nota accanto all'etichetta, per esempio "(facoltativo)". */
  readonly note = input('');
  /** Se non è vuoto compare sotto il campo, in rosso. */
  readonly error = input('');
}
