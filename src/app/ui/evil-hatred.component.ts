import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { TrPipe } from '../i18n/tr.pipe';
import { IconComponent } from './icon.component';

/**
 * Il contatore dell'Odio nella vista del Maligno: una pillola sul bordo sinistro dello schermo, a metà altezza (come i contatori della vista dei giocatori), solo icona e valore;
 * l'etichetta si apre al passaggio del mouse. Contorno, icona e testo rossi. Quando l'Odio cambia (si consuma o si gioca una carta) il numero scorre un punto alla volta fino
 * al valore nuovo, più veloce se la differenza è grande; la prima volta, con `animate` falso (a inizio turno, dopo il conteggio della dialog) o con la riduzione del movimento cambia di colpo.
 */
@Component({
  selector: 'app-evil-hatred',
  imports: [TrPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="pill" role="status" tabindex="0" [title]="'Odio: il budget per carte e mostri' | tr">
      <app-icon name="skull" [size]="18" />
      <span class="caption">{{ 'Odio' | tr }}</span>
      <span class="value">{{ shown() }}</span>
    </span>
  `,
  styles: `
    :host { position: absolute; z-index: 22; left: 12px; top: 50%; transform: translateY(-50%); }
    .pill {
      display: inline-flex; align-items: center; box-sizing: border-box; min-height: 34px; padding: 6px 10px; border-radius: var(--radius-1);
      background: var(--c-surface); color: var(--c-hatred); border: 1px solid var(--c-faction-evil); font: 13px/1 var(--font-ui); user-select: none; outline: none;
    }
    .caption { max-width: 0; margin-right: 0; overflow: hidden; white-space: nowrap; opacity: 0; transition: max-width 0.2s ease, margin 0.2s ease, opacity 0.15s; }
    .value { margin-left: 8px; font-family: var(--font-mono); font-weight: 600; font-variant-numeric: tabular-nums; }
    .pill:hover .caption, .pill:focus-visible .caption { max-width: 120px; margin-left: 8px; opacity: 1; }
    @media (prefers-reduced-motion: reduce) { .caption { transition: none; } }
    /* Telefono: appena sopra la mano di carte (che spunta di 95 px sopra il footer del Maligno, alto 76 px), a sinistra: costo delle carte e Odio restano vicini. */
    @media (max-width: 760px) { :host { top: auto; transform: none; bottom: calc(var(--footer-height, 0px) + env(safe-area-inset-bottom) + 12px + 76px + 95px + 8px); } }
  `,
})
export class EvilHatredComponent {
  /** L'Odio vero: quello che si vede (`shown`) ci arriva un punto alla volta. */
  readonly hatred = input(0);
  /** Falso quando deve cambiare di colpo. */
  readonly animate = input(true);
  protected readonly shown = signal(0);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private first = true;

  constructor() {
    effect(() => {
      const target = this.hatred();
      untracked(() => this.countTo(target));
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  private countTo(target: number) {
    clearTimeout(this.timer);
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.first || reduce || !this.animate()) {
      this.first = false;
      this.shown.set(target);
      return;
    }
    const delay = Math.max(40, Math.min(120, 700 / Math.max(1, Math.abs(target - this.shown()))));
    const step = () => {
      const cur = this.shown();
      if (cur === target) return;
      this.shown.set(cur + Math.sign(target - cur));
      if (this.shown() !== target) this.timer = setTimeout(step, delay);
    };
    step();
  }
}
