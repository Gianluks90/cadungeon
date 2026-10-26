import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * L'indicatore del nord: un pallino fisso sullo schermo, in cima alla colonna dei comandi della camera (sta dentro `app-zoom-controls`), nello stile dei pallini solo icona (come le
 * chiavi runiche): nero, bordo sottile. Dentro, una freccia con la punta in su e sotto una N in un font con le grazie, tutte e due piene
 * di cremisi. La mappa non ruota, quindi il nord è sempre in alto: serve a orientarsi e, essendo dell'interfaccia e non della mappa,
 * resta al suo posto qualunque sia lo zoom.
 */
@Component({
  selector: 'app-compass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 34 34" aria-hidden="true">
      <polygon points="17,5 13,12.5 21,12.5" />
      <text x="17" y="28" text-anchor="middle">N</text>
    </svg>
  `,
  host: { role: 'img', 'aria-label': 'Il nord è in alto', title: 'Il nord è in alto' },
  styles: `
    :host {
      display: block; flex: none; box-sizing: border-box; width: 34px; height: 34px; border-radius: var(--radius-1);
      background: var(--c-surface); border: 1px solid var(--c-line-strong);
      pointer-events: none; user-select: none;
    }
    svg { display: block; width: 100%; height: 100%; fill: var(--cad-compass); }
    @media (pointer: coarse) { :host { width: 44px; height: 44px; } }
    text { font: 700 16px Georgia, 'Times New Roman', Times, serif; }
  `,
})
export class CompassComponent {}
