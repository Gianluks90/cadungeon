import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { CompassComponent } from './compass.component';
import { IconComponent } from './icon.component';

/**
 * I comandi della camera (con il nord in cima): pallini separati sul lato destro, a metà altezza, in colonna, nello stile dei pallini solo icona (nero, bordo sottile):
 * tutta la mappa, centra sull'eroe attivo, poi + e −. `zoom` emette 1 per ingrandire e -1 per rimpicciolire.
 */
@Component({
  selector: 'app-zoom-controls',
  imports: [CompassComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-compass />
    <button type="button" aria-label="Mostra tutta la mappa" title="Mostra tutta la mappa" (click)="fit.emit()"><app-icon name="fit_screen" [size]="20" /></button>
    <button type="button" aria-label="Centra sull'eroe" title="Centra sull'eroe" (click)="center.emit()"><app-icon name="frame_person" [size]="20" /></button>
    <button type="button" aria-label="Zoom avanti" title="Zoom avanti" (click)="zoom.emit(1)"><app-icon name="add" [size]="20" /></button>
    <button type="button" aria-label="Zoom indietro" title="Zoom indietro" (click)="zoom.emit(-1)"><app-icon name="remove" [size]="20" /></button>
  `,
  styles: `
    :host {
      position: absolute; z-index: 10; right: 12px; top: 50%; transform: translateY(-50%);
      display: flex; flex-direction: column; gap: 8px; user-select: none;
    }
    button {
      display: inline-flex; align-items: center; justify-content: center;
      box-sizing: border-box; width: 34px; height: 34px; padding: 0; border-radius: var(--radius-1); cursor: pointer;
      background: var(--c-surface); border: 1px solid var(--c-line-strong);
      color: var(--c-text); transition: color 0.15s, border-color 0.15s;
    }
    button:hover, button:focus-visible { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
    /* Tocco: almeno 44 px */
    @media (pointer: coarse) { button { width: 44px; height: 44px; } }
  `,
})
export class ZoomControlsComponent {
  /** 1 = ingrandisci, -1 = rimpicciolisci. */
  readonly zoom = output<1 | -1>();
  /** Centra la camera sull'eroe attivo. */
  readonly center = output<void>();
  /** Inquadra tutta la mappa. */
  readonly fit = output<void>();
}
