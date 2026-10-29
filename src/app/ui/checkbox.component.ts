import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * La casella da spuntare di tutta l'app: il quadratino a sinistra, poi un po' di spazio e il testo (proiettato). Sempre lo stesso disegno, con gli stessi colori degli altri campi.
 */
@Component({
  selector: 'app-checkbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label>
      <input type="checkbox" [checked]="checked()" (change)="changed.emit($any($event.target).checked)" />
      <span><ng-content /></span>
    </label>
  `,
  styles: `
    :host { display: block; }
    label { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font: 13px/1.3 var(--font-ui); color: var(--c-text); }
    input { appearance: none; flex: none; width: 16px; height: 16px; margin: 0; position: relative; cursor: pointer; border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); background: var(--c-bg); }
    input:checked { border-color: var(--c-interact); background: var(--c-interact); }
    input:checked::after { content: ''; position: absolute; left: 4px; top: 1px; width: 4px; height: 8px; border: solid var(--c-bg); border-width: 0 2px 2px 0; transform: rotate(45deg); }
    input:focus-visible { outline: 1px solid var(--c-interact); outline-offset: 2px; }
  `,
})
export class CheckboxComponent {
  readonly checked = input(false);
  readonly changed = output<boolean>();
}
