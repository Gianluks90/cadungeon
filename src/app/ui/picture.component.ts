import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';
import { IconComponent } from './icon.component';

/**
 * Un'immagine che riempie il suo contenitore (ritagliata a coprire, dall'alto). Se manca (nessun file, o il file non si carica) non si vede l'icona rotta del
 * browser né un testo alternativo: al centro del contenitore compare un'icona.
 */
@Component({
  selector: 'app-picture',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (src() && !failed()) { <img [src]="src()" alt="" draggable="false" (error)="failed.set(true)" /> }
    @else { <app-icon [name]="icon()" [size]="iconSize()" /> }
  `,
  styles: `
    :host { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; overflow: hidden; color: var(--c-text-faint); }
    img { width: 100%; height: 100%; object-fit: cover; object-position: center top; display: block; pointer-events: none; }
  `,
})
export class PictureComponent {
  readonly src = input<string | null | undefined>(null);
  /** L'icona al centro se l'immagine manca. */
  readonly icon = input('frame_person');
  readonly iconSize = input(32);
  protected readonly failed = signal(false);

  constructor() {
    effect(() => {
      this.src();
      this.failed.set(false); // un'immagine nuova si riprova
    });
  }
}
