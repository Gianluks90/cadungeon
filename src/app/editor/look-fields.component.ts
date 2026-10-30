import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../ui/icon.component';
import { SelectComponent, SelectOption } from '../ui/select.component';

/**
 * I campi dell'aspetto di un gettone (segnalino Incontro, oggetto a terra): una select con le immagini della raccolta e le icone degli oggetti (la prima voce, vuota, è l'aspetto
 * predefinito), il titolo facoltativo e, accanto, l'anteprima del gettone com'è in mappa (cerchio a doppio bordo con dentro l'immagine o l'icona). I valori sono `image:<id>` o `icon:<nome>`.
 */
@Component({
  selector: 'app-look-fields',
  imports: [IconComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="look">
      <div class="preview" aria-hidden="true">
        @if (image(); as src) { <img [src]="src" alt="" /> } @else if (icon(); as name) { <app-icon [name]="name" [size]="30" /> } @else { <app-icon [name]="fallbackIcon()" [size]="26" /> }
      </div>
      <div class="fields">
        <app-select class="block" [options]="looks()" [value]="choice()" label="Aspetto" (changed)="choiceChange.emit($event)" />
        <input type="text" autocomplete="off" maxlength="40" placeholder="Titolo (facoltativo): per esempio Principessa Daufina" [value]="title()" (input)="titleChange.emit($any($event.target).value)" />
      </div>
    </div>
  `,
  styles: `
    .look { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; align-items: center; }
    .fields { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .preview { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; overflow: hidden; color: var(--c-interact); border: 1.5px solid currentColor; box-shadow: inset 0 0 0 3px var(--c-surface), inset 0 0 0 4.5px currentColor; background: var(--c-bg); }
    .preview img { width: 100%; height: 100%; object-fit: cover; }
  `,
})
export class LookFieldsComponent {
  readonly looks = input<SelectOption[]>([]);
  readonly imageUrls = input<Record<string, string>>({});
  readonly choice = input('');
  readonly title = input('');
  /** L'icona che si vede nell'anteprima quando non c'è un aspetto (il "?" dell'Incontro, o quella dell'oggetto). */
  readonly fallbackIcon = input('question_mark');
  readonly choiceChange = output<string>();
  readonly titleChange = output<string>();

  protected readonly image = computed(() => (this.choice().startsWith('image:') ? (this.imageUrls()[this.choice().slice(6)] ?? null) : null));
  protected readonly icon = computed(() => (this.choice().startsWith('icon:') ? this.choice().slice(5) : null));
}
