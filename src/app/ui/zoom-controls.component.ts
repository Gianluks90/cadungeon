import { ChangeDetectionStrategy, Component, output } from '@angular/core';

/**
 * I tasti dello zoom: due pallini separati in basso a destra sopra il footer, nello stile dei pallini solo icona (nero, bordo sottile),
 * − e +. Emette 1 per ingrandire e -1 per rimpicciolire.
 */
@Component({
  selector: 'app-zoom-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" aria-label="Zoom indietro" title="Zoom indietro" (click)="zoom.emit(-1)">−</button>
    <button type="button" aria-label="Zoom avanti" title="Zoom avanti" (click)="zoom.emit(1)">+</button>
  `,
  styles: `
    :host {
      position: absolute; z-index: 10; right: 12px; bottom: calc(var(--footer-height, 0px) + env(safe-area-inset-bottom) + 12px);
      display: flex; gap: 8px; user-select: none;
    }
    button {
      box-sizing: border-box; width: 34px; height: 34px; padding: 0; border-radius: 50%; cursor: pointer;
      background: var(--cad-ui-panel, #000); border: 1px solid var(--cad-ui-panel-border, #5a554d);
      color: var(--cad-ui-text, #d8cfc4); font: 20px/1 system-ui, sans-serif; transition: color 0.15s, border-color 0.15s;
    }
    button:hover, button:focus-visible { color: var(--cad-accent-active, #e0a040); border-color: var(--cad-accent-active, #e0a040); outline: none; }
  `,
})
export class ZoomControlsComponent {
  /** 1 = ingrandisci, -1 = rimpicciolisci. */
  readonly zoom = output<1 | -1>();
}
