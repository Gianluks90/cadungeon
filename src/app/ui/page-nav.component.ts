import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { IconComponent } from './icon.component';

/**
 * I due tasti in alto a sinistra delle pagine di preparazione (scelta degli eroi, sala d'attesa): il logo della home, che prima chiede conferma
 * ("Sei sicuro di voler annullare…": solo se si conferma esce `leave`) e la freccia (`back`, torna al passo prima). `ask()` apre la stessa conferma da fuori (per un tasto "indietro" che ha come passo precedente la home).
 */
@Component({
  selector: 'app-page-nav',
  imports: [ConfirmDialogComponent, IconComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nav">
      <button type="button" class="square" [attr.aria-label]="'adventures.backHome' | t" [title]="'adventures.backHome' | t" (click)="ask()"><app-icon name="logo/logoipsum-419" [size]="22" /></button>
      <button type="button" class="square" [attr.aria-label]="'nav.back' | t" [title]="'nav.back' | t" (click)="back.emit()"><app-icon name="arrow_back" [size]="20" /></button>
    </div>
    <app-confirm-dialog [open]="asking()" [title]="confirmTitle()" [text]="confirmText()" [confirmLabel]="confirmLabel()" (confirmed)="asking.set(false); leave.emit()" (cancel)="asking.set(false)" />
  `,
  styles: `
    :host { display: contents; }
    .nav { position: fixed; z-index: 3; top: calc(12px + env(safe-area-inset-top)); left: 12px; display: flex; gap: 8px; }
    .square { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; width: 34px; height: 34px; padding: 0; cursor: pointer; border-radius: var(--radius-1); background: var(--c-surface); color: var(--c-text); border: 1px solid var(--c-line-strong); transition: color 0.15s, border-color 0.15s; }
    @media (pointer: coarse) { .square { width: 44px; height: 44px; } }
    .square:hover, .square:focus-visible { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
  `,
})
export class PageNavComponent {
  readonly confirmTitle = input.required<string>();
  readonly confirmText = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly back = output<void>();
  /** Confermato: si esce dalla preparazione. */
  readonly leave = output<void>();
  protected readonly asking = signal(false);

  ask() {
    this.asking.set(true);
  }
}
