import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CompassComponent } from './compass.component';
import { IconComponent } from './icon.component';
import { KeyLabelComponent } from './key-label.component';

/**
 * I comandi della camera (con il nord in cima): pallini separati sul lato destro, a metà altezza, in colonna, nello stile dei pallini solo icona (nero, bordo sottile):
 * tutta la mappa, centra sull'eroe attivo, e in fondo + e − (sempre gli ultimi). `zoom` emette 1 per ingrandire e -1 per rimpicciolire.
 */
@Component({
  selector: 'app-zoom-controls',
  imports: [CompassComponent, IconComponent, KeyLabelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-compass />
    <button type="button" aria-label="Mostra tutta la mappa" title="Mostra tutta la mappa (Z)" (click)="fit.emit()"><app-icon name="fit_screen" [size]="20" /><kbd>Z</kbd><app-key-label>Mostra tutta la mappa</app-key-label></button>
    @if (showFocus()) {
    <button type="button" aria-label="Centra sull'eroe" title="Centra sull'eroe (F)" (click)="center.emit()"><app-icon name="frame_person" [size]="20" /><kbd>F</kbd><app-key-label>Centra sull'eroe</app-key-label></button>
    }
    <button type="button" aria-label="Zoom avanti" title="Zoom avanti" (click)="zoom.emit(1)"><app-icon name="add" [size]="20" /></button>
    <button type="button" aria-label="Zoom indietro" title="Zoom indietro" (click)="zoom.emit(-1)"><app-icon name="remove" [size]="20" /></button>
  `,
  styles: `
    :host {
      position: absolute; z-index: 10; right: 12px; top: 0; bottom: 0; margin-block: auto; height: fit-content;
      display: flex; flex-direction: column; gap: 8px; user-select: none;
    }
    /* La bussola non è un tasto: tonda, e staccata dagli altri con il doppio dello spazio. */
    app-compass { margin-bottom: 8px; }
    kbd { display: none; position: absolute; right: 2px; bottom: 1px; font: 600 9px/1 var(--font-mono); color: var(--c-text-dim); pointer-events: none; }
    @media (pointer: fine) { kbd { display: block; } }
    button {
      position: relative; display: inline-flex; align-items: center; justify-content: center;
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
  /** Il tasto che centra sull'eroe attivo: solo in partita (nell'editor non ci sono eroi). */
  readonly showFocus = input(true);
  /** Centra la camera sull'eroe attivo. */
  readonly center = output<void>();
  /** Inquadra tutta la mappa. */
  readonly fit = output<void>();
}
