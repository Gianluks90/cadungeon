import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { IconComponent } from './icon.component';

/**
 * Il logo dell'app (public/logo/, usato come maschera: prende il colore del testo) come bottone a pillola: è il primo elemento
 * delle pillole in alto e sarà il menu contestuale generale dell'app (per ora non apre ancora niente).
 */
@Component({
  selector: 'app-logo-button',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button type="button" aria-label="Menu" title="Menu" (click)="pressed.emit()"><app-icon name="logo/logoipsum-419" [size]="20" /></button>`,
  styles: `
    :host { display: inline-flex; pointer-events: auto; }
    button {
      display: inline-flex; align-items: center; justify-content: center; padding: 6px; border-radius: 999px; cursor: pointer;
      background: var(--cad-ui-panel, #000); color: var(--cad-ui-text, #d8cfc4); border: 1px solid var(--cad-ui-panel-border, #5a554d);
      transition: border-color 0.15s, color 0.15s;
    }
    button:hover, button:focus-visible { border-color: var(--cad-accent-active, #e0a040); color: var(--cad-accent-active, #e0a040); outline: none; }
  `,
})
export class LogoButtonComponent {
  /** Il bottone è stato premuto. */
  readonly pressed = output<void>();
}
