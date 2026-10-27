import { ChangeDetectionStrategy, Component, effect, input, output, viewChild } from '@angular/core';
import { DialogComponent } from './dialog.component';
import { MarkdownPipe } from './markdown.pipe';

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
  imports: [DialogComponent, MarkdownPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as v) {
      <app-dialog [kicker]="v.kicker" [title]="v.title" [closable]="v.dismissible" (closed)="confirm.emit()">
        <div class="md" [innerHTML]="v.text | markdown"></div>
        <ng-container dialogFooter><button type="button" class="dlg-btn primary" (click)="confirm.emit()">{{ v.action }}</button></ng-container>
      </app-dialog>
    }
  `,
  styles: `
  `,
})
export class AdventureDialogComponent {
  readonly view = input<AdventureView | null>(null);
  /** Si conferma (o si chiude, se la dialog è solo da rileggere). */
  readonly confirm = output<void>();
  private readonly dialog = viewChild(DialogComponent);

  constructor() {
    // A ogni nuovo testo si riparte dall'inizio.
    effect(() => {
      this.view();
      queueMicrotask(() => this.dialog()?.resetScroll());
    });
  }
}
