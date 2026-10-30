import { TranslatePipe } from '../i18n/translate.pipe';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import type { TokenLook } from '../game/board/marker';
import { lookChoice, lookFrom } from '../game/markers/token-looks';
import { DialogComponent } from '../ui/dialog.component';
import { FieldComponent } from '../ui/field.component';
import { SelectComponent, SelectOption } from '../ui/select.component';
import { LookFieldsComponent } from './look-fields.component';

/** Un oggetto del catalogo messo a terra nella mappa: quale e con che aspetto. */
export interface ItemMarkerEdits {
  itemId: string;
  look?: TokenLook;
}

/**
 * La dialog di un oggetto a terra (strumento Oggetti, scheda "Oggetto del catalogo"): sceglie quale oggetto del catalogo è (la Principessa, una reliquia...) e che aspetto ha il suo gettone
 * (un'immagine della raccolta o l'icona di un oggetto, e un titolo che sostituisce il nome nel menu e nelle notifiche). Si apre prima di prenderlo in mano e con Personalizza su uno già messo.
 */
@Component({
  selector: 'app-item-marker-dialog',
  imports: [TranslatePipe, DialogComponent, FieldComponent, SelectComponent, LookFieldsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [closeOnBackdrop]="false" [title]="'itemDialog.oggettoATerra' | t" width="min(480px, 100%)" (closed)="cancel.emit()">
        <app-field [label]="'common.oggetto' | t">
          <app-select class="block" [options]="itemOptions()" [value]="itemId()" [placeholder]="'common.scegliUnOggetto' | t" [label]="'common.oggetto' | t" (changed)="itemId.set($event)" />
        </app-field>
        <section>
          <h3>{{ 'common.aspetto' | t }}</h3>
          <app-look-fields [looks]="looks()" [imageUrls]="imageUrls()" [choice]="choice()" [title]="title()" [fallbackIcon]="fallbackIcon()" (choiceChange)="choice.set($event)" (titleChange)="title.set($event)" />
          <p class="dlg-hint">{{ 'itemDialog.senzaAspettoIlGettoneE' | t }}</p>
        </section>
        <p class="dlg-hint">{{ 'itemDialog.unEroeCheSiFerma' | t }}</p>
        <ng-container dialogFooter><button type="button" class="dlg-btn primary" [class.off]="!itemId()" [attr.aria-disabled]="!itemId()" [title]="'itemDialog.scegliPrimaLOggetto' | t" (click)="confirm()">{{ 'common.conferma' | t }}</button></ng-container>
      </app-dialog>
    }
  `,
  styles: `
    section { display: flex; flex-direction: column; gap: 8px; }
  `,
})
export class ItemMarkerDialogComponent {
  readonly open = input(false);
  readonly value = input<ItemMarkerEdits | null>(null);
  /** Gli oggetti del catalogo, con la loro icona (quella del gettone senza aspetto). */
  readonly items = input<{ id: string; name: string; icon?: string }[]>([]);
  readonly looks = input<SelectOption[]>([]);
  readonly imageUrls = input<Record<string, string>>({});
  readonly confirmed = output<ItemMarkerEdits>();
  readonly cancel = output<void>();

  protected readonly itemId = signal('');
  protected readonly choice = signal('');
  protected readonly title = signal('');
  protected readonly itemOptions = computed<SelectOption[]>(() => this.items().map((i) => ({ value: i.id, label: i.name })));
  protected readonly fallbackIcon = computed(() => this.items().find((i) => i.id === this.itemId())?.icon ?? 'inventory_2');

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const v = this.value();
      this.itemId.set(v?.itemId ?? '');
      this.choice.set(lookChoice(v?.look));
      this.title.set(v?.look?.title ?? '');
    });
  }

  protected confirm() {
    if (!this.itemId()) return;
    const look = lookFrom(this.choice(), this.title());
    this.confirmed.emit({ itemId: this.itemId(), ...(look ? { look } : {}) });
  }
}
