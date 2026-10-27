import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

/** Ciò che la dialog mostra: l'etichetta (Introduzione, Obiettivo), il titolo dell'avventura, il testo (anche lungo) e il tasto. */
export interface AdventureView {
  kicker: string;
  title: string;
  text: string;
  /** Il tasto in fondo ("Ho letto" quando serve la conferma, "Chiudi" quando si rilegge). */
  action: string;
  /** Si può chiudere con Esc o un tocco fuori (solo quando si rilegge: la conferma della lettura è obbligatoria). */
  dismissible: boolean;
}

/**
 * La dialog dei testi dell'avventura: titolo, etichetta e un testo lungo che scorre. All'inizio della partita non si chiude finché non si conferma
 * la lettura (`confirm`); quando si rilegge l'obiettivo dal suo tasto si chiude anche con Esc o un tocco fuori.
 */
@Component({
  selector: 'app-adventure-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'escape()' },
  template: `
    @if (view(); as v) {
      <div class="backdrop" (pointerdown)="outside($event)">
        <section class="box" role="dialog" aria-modal="true" [attr.aria-label]="v.kicker">
          <header>
            <span class="kicker">{{ v.kicker }}</span>
            <h2>{{ v.title }}</h2>
          </header>
          <div class="text" tabindex="0" #text>
            @for (p of paragraphs(v.text); track $index) { <p>{{ p }}</p> }
          </div>
          <footer><button type="button" class="strong" (click)="confirm.emit()">{{ v.action }}</button></footer>
        </section>
      </div>
    }
  `,
  styles: `
    :host { display: contents; }
    .backdrop { position: fixed; inset: 0; z-index: 860; display: grid; place-items: center; padding: 12px; background: rgba(0, 0, 0, 0.6); animation: fade 0.25s ease-out; }
    .box {
      display: flex; flex-direction: column; gap: 14px; box-sizing: border-box; width: min(560px, 100%); max-height: min(640px, calc(100dvh - 24px)); padding: 24px 28px 20px;
      background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); color: var(--c-text); font: 14px/1.5 var(--font-ui);
    }
    header { display: flex; flex-direction: column; gap: 6px; }
    .kicker { font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    h2 { margin: 0; font: 600 var(--fs-xl)/1.2 var(--font-display); letter-spacing: 0.03em; }
    .text { min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 6px; }
    .text:focus-visible { outline: none; }
    p { margin: 0; color: var(--c-text); }
    footer { display: flex; justify-content: flex-end; }
    button { padding: 9px 22px; border-radius: var(--radius-1); background: none; color: var(--c-text); cursor: pointer; border: 1px solid var(--c-line-strong); font: 600 13px/1.2 var(--font-ui); transition: color 0.15s, border-color 0.15s; }
    button:hover, button:focus-visible { border-color: var(--c-interact); color: var(--c-interact); outline: none; }
    @keyframes fade { from { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .backdrop { animation: none; } }
  `,
})
export class AdventureDialogComponent {
  readonly view = input<AdventureView | null>(null);
  /** Si conferma (o si chiude, se la dialog è solo da rileggere). */
  readonly confirm = output<void>();
  private readonly text = viewChild<ElementRef<HTMLElement>>('text');

  constructor() {
    // A ogni nuovo testo si riparte dall'inizio.
    effect(() => {
      this.view();
      queueMicrotask(() => this.text()?.nativeElement.scrollTo({ top: 0 }));
    });
  }

  protected paragraphs(text: string): string[] {
    return text.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
  }

  protected escape() {
    if (this.view()?.dismissible) this.confirm.emit();
  }

  protected outside(e: PointerEvent) {
    if (this.view()?.dismissible && e.target === e.currentTarget) this.confirm.emit();
  }
}
