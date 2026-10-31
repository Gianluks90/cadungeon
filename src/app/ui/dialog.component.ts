import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { TranslatePipe } from '../i18n/translate.pipe';
import { IconComponent } from './icon.component';

/**
 * Il contenitore di tutte le dialog (stile comune): sfondo scuro, una finestra con l'intestazione sempre in alto (titolo, e la X per chiudere), una linea, il contenuto
 * che scorre se è lungo, una linea e il piede con i bottoni di azione (meno alto dell'intestazione; sparisce se non ci sono azioni). Il contenuto va dentro il tag;
 * i bottoni si proiettano con l'attributo `dialogFooter` e prendono lo stile globale `.dlg-btn` (`styles.css`).
 * `closable` mostra la X e permette di chiudere con Esc o un tocco fuori (emettono `closed`): le dialog che chiedono una risposta obbligatoria lo tengono spento.
 * `closeOnBackdrop` falso toglie solo la chiusura con il tocco fuori.
 */
@Component({
  selector: 'app-dialog',
  imports: [IconComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'escape()' },
  template: `
    <div class="backdrop" (pointerdown)="backdrop($event)">
      <div class="frame" [style.width]="width()" [style.height]="height()">
      <!-- Facoltativo: una carta inclinata infilata sotto il bordo del pannello (dialogSide), come nella finestra dell'attacco. Sta nella cornice, sotto il pannello. -->
      <ng-content select="[dialogSide]" />
      <section class="box" role="dialog" aria-modal="true" [attr.aria-label]="title()">
        <header>
          <div class="heading">
            @if (kicker()) { <span class="kicker">{{ kicker() }}</span> }
            <h2>{{ title() }}</h2>
          </div>
          @if (closable()) {
            <button type="button" class="close" [attr.aria-label]="'common.close' | t" [title]="'common.close' | t" (click)="closed.emit()"><app-icon name="close" [size]="20" /></button>
          }
        </header>
        <!-- Facoltativo: una seconda intestazione fissa sotto la prima (dialogSub), che non scorre con il contenuto. -->
        <div class="sub"><ng-content select="[dialogSub]" /></div>
        <div class="body" [class.flush]="flush()" #body><ng-content /></div>
        <!-- Il piede: a sinistra (dialogFooterStart, facoltativo) e a destra i bottoni di azione (dialogFooter). -->
        <footer><div class="fstart"><ng-content select="[dialogFooterStart]" /></div><ng-content select="[dialogFooter]" /></footer>
      </section>
      </div>
    </div>
  `,
  styles: `
    :host { display: contents; }
    .backdrop { position: fixed; inset: 0; z-index: 860; display: grid; place-items: center; padding: 12px; background: rgba(0, 0, 0, 0.6); animation: fade 0.2s ease-out; }
    .frame { position: relative; display: flex; max-width: 100%; max-height: min(680px, calc(100dvh - 24px)); }
    .box {
      position: relative; z-index: 1; width: 100%; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; max-height: inherit;
      background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); color: var(--c-text); font: 14px/1.5 var(--font-ui);
    }
    header { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 14px 14px 20px; border-bottom: 1px solid var(--c-line-strong); }
    .heading { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
    .kicker { font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    h2 { margin: 0; font: 600 var(--fs-lg)/1.2 var(--font-display); letter-spacing: 0.03em; }
    .close { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: var(--radius-1); background: none; color: var(--c-text-dim); cursor: pointer; transition: color 0.15s; }
    .close:hover, .close:focus-visible { color: var(--c-interact); outline: none; }
    .body { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 16px 20px; }
    .body.flush { padding: 0; gap: 0; overflow: hidden; }
    footer { flex: none; display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; padding: 8px 14px; border-top: 1px solid var(--c-line-strong); }
    footer:not(:has(> :not(.fstart:empty))) { display: none; }
    .fstart { display: flex; align-items: center; gap: 10px; margin-right: auto; min-width: 0; }
    .fstart:empty { display: none; }
    .sub { flex: none; border-bottom: 1px solid var(--c-line-strong); padding: 10px 20px; background: var(--c-bg); }
    .sub:empty { display: none; }
    @keyframes fade { from { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .backdrop { animation: none; } }
  `,
})
export class DialogComponent {
  readonly title = input.required<string>();
  /** Una riga piccola sopra il titolo (per esempio "Introduzione"). */
  readonly kicker = input('');
  /** Larghezza della finestra (un valore CSS). */
  readonly width = input('min(560px, 100%)');
  /** Altezza fissa della finestra (un valore CSS); senza, si adatta al contenuto. */
  readonly height = input<string | null>(null);
  /** Contenuto libero: niente margine interno né scorrimento, lo gestisce chi lo scrive (per esempio il catalogo a due colonne). */
  readonly flush = input(false);
  /** Mostra la X e chiude con Esc o un tocco fuori. */
  readonly closable = input(true);
  /** Un tocco fuori dalla finestra la chiude (se `closable`). Le dialog dell'editor lo spengono: un tocco sbagliato non deve far perdere ciò che si è scritto; restano la X ed Esc. */
  readonly closeOnBackdrop = input(true);
  readonly closed = output<void>();
  private readonly body = viewChild.required<ElementRef<HTMLElement>>('body');

  /** Riporta il contenuto all'inizio (quando cambia il testo mostrato). */
  resetScroll() {
    this.body().nativeElement.scrollTo({ top: 0 });
  }

  protected escape() {
    if (this.closable()) this.closed.emit();
  }

  protected backdrop(e: PointerEvent) {
    if (this.closable() && this.closeOnBackdrop() && e.target === e.currentTarget) this.closed.emit();
  }
}
