import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TrPipe } from '../i18n/tr.pipe';
import { DialogComponent } from './dialog.component';
import { MarkdownPipe } from './markdown.pipe';

/** Ciò che la dialog dice di un'area. Il testo è quello scritto dall'autore dell'avventura (resta in italiano). */
export interface AreaInfoView {
  name: string;
  subtitle?: string;
  text?: string;
  /** Gli eroi l'hanno già vista. */
  discovered: boolean;
}

/**
 * La descrizione di un'area, per il Maligno (la `i` accanto all'etichetta dell'area). Dialog con il bordo rosso; a sinistra del piede un indicatore
 * dice se gli eroi hanno già scoperto l'area.
 */
@Component({
  selector: 'app-evil-area-dialog',
  imports: [TrPipe, DialogComponent, MarkdownPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog [title]="area().name" [kicker]="area().subtitle ?? ''" [evil]="true" (closed)="closed.emit()">
      @if (area().text) {
        <div class="md" [innerHTML]="area().text! | markdown"></div>
      } @else {
        <p class="none">{{ 'Nessuna descrizione.' | tr }}</p>
      }
      <span dialogFooterStart class="state" [class.on]="area().discovered"><span class="dot"></span>{{ (area().discovered ? 'Scoperta' : 'Non scoperta') | tr }}</span>
    </app-dialog>
  `,
  styles: `
    .none { margin: 0; color: var(--c-text-dim); }
    .state { display: inline-flex; align-items: center; gap: 8px; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    .dot { width: 8px; height: 8px; border-radius: var(--radius-round); border: 1px solid currentColor; }
    .state.on { color: var(--c-faction-evil); }
    .state.on .dot { background: currentColor; }
  `,
})
export class EvilAreaDialogComponent {
  readonly area = input.required<AreaInfoView>();
  readonly closed = output<void>();
}
