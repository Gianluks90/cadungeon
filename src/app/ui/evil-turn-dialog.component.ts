import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { TrPipe } from '../i18n/tr.pipe';
import { DialogComponent } from './dialog.component';
import { IconComponent } from './icon.component';

/**
 * "Inizia il tuo turno": la dialog del Maligno quando comincia il suo turno. Dice quanto Odio riceve e mostra il contatore che sale
 * da `from` a `to`, un segnalino alla volta. Non si chiude se non con OK (niente X, Esc o tocco fuori). Stile degli annunci del Maligno
 * (icona rossa, etichetta piccola, titolo nel carattere dei titoli) dentro una dialog con il bordo rosso.
 */
@Component({
  selector: 'app-evil-turn-dialog',
  imports: [TrPipe, DialogComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog [title]="'Inizia il tuo turno' | tr" [kicker]="'Maligno' | tr" [closable]="false" [evil]="true" width="min(420px, 100%)">
      <div class="content">
        <app-icon name="skull" [size]="30" />
        <p class="text">{{ (gained() === 1 ? 'Ricevi 1 segnalino Odio da spendere per carte e mostri.' : 'Ricevi {n} segnalini Odio da spendere per carte e mostri.') | tr: { n: gained() } }}</p>
        <div class="counter" role="status">
          <span class="label">{{ 'Punti odio totali' | tr }}</span>
          <span class="value">{{ shown() }}</span>
        </div>
      </div>
      <button dialogFooter type="button" class="dlg-btn evil" (click)="ok.emit()">{{ 'OK' | tr }}</button>
    </app-dialog>
  `,
  styles: `
    .content { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
    app-icon { color: var(--c-faction-evil); }
    .text { margin: 0; font: 13px/1.4 var(--font-ui); color: var(--c-text-dim); }
    .counter { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 24px; }
    .label { font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-hatred); }
    .value { font: 600 32px/1.1 var(--font-mono); font-variant-numeric: tabular-nums; color: var(--c-hatred); }
  `,
})
export class EvilTurnDialogComponent implements OnInit {
  /** L'Odio prima di ricevere quello del turno e dopo. */
  readonly from = input.required<number>();
  readonly to = input.required<number>();
  readonly ok = output<void>();
  protected readonly shown = signal(0);
  private readonly destroyRef = inject(DestroyRef);

  protected gained(): number {
    return this.to() - this.from();
  }

  ngOnInit() {
    this.shown.set(this.from());
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || this.to() <= this.from()) {
      this.shown.set(this.to());
      return;
    }
    // Un segnalino alla volta, dopo un attimo perché si veda il valore di partenza.
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      this.shown.update((n) => n + 1);
      if (this.shown() < this.to()) timer = setTimeout(step, 110);
    };
    timer = setTimeout(step, 350);
    this.destroyRef.onDestroy(() => clearTimeout(timer));
  }
}
