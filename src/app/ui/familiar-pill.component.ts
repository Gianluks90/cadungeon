import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FamiliarDef } from '../game/familiars/familiar';
import { TranslatePipe } from '../i18n/translate.pipe';
import { PictureComponent } from './picture.component';

/**
 * La pillola "Famiglio" delle card degli eroi che ne hanno uno: bordo del colore dei famigli (`--c-familiar`), la parola tutta a sinistra e, sopra la pillola, tutto a destra, il segnalino
 * tondo del famiglio (con il suo contorno azzurro). Chi la usa la posiziona.
 */
@Component({
  selector: 'app-familiar-pill',
  imports: [TranslatePipe, PictureComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="label">{{ (familiars().length > 1 ? 'familiar.many' : 'familiar.one') | t }}</span>
    <span class="tokens">
      @for (f of familiars(); track f.id) {
        <span class="token" [title]="f.name"><app-picture [src]="f.image" icon="pets" [iconSize]="16" /></span>
      }
    </span>
  `,
  styles: `
    :host { position: relative; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; height: 30px; padding: 0 0 0 12px; border-radius: var(--radius-1); background: var(--c-bg); border: 1px solid var(--c-familiar); color: var(--c-text); font: 600 12px/1 var(--font-ui); letter-spacing: 0; text-transform: none; }
    .tokens { display: inline-flex; flex-direction: row-reverse; margin-right: 6px; }
    /* Il segnalino sporge un po' sopra e sotto la pillola. */
    .token { width: 40px; height: 40px; margin-left: -14px; border-radius: var(--radius-round); overflow: hidden; box-sizing: border-box; border: 2px solid var(--c-familiar); background: var(--c-surface); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.6); display: block; }
    .token:first-child { margin-left: 0; }
  `,
})
export class FamiliarPillComponent {
  readonly familiars = input.required<readonly FamiliarDef[]>();
}
