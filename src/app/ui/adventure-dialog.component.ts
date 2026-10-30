import { ChangeDetectionStrategy, Component, effect, input, output, viewChild } from '@angular/core';
import { DialogComponent } from './dialog.component';
import { MarkdownPipe } from './markdown.pipe';
import { PictureComponent } from './picture.component';

/** Ciò che la dialog mostra: l'etichetta (Introduzione, Obiettivo), il titolo dell'avventura, il testo (anche lungo) e il tasto. */
export interface AdventureView {
  kicker: string;
  title: string;
  text: string;
  /** Il tasto in fondo ("Ho letto" quando serve la conferma, "Chiudi" quando si rilegge). */
  action: string;
  /** Si può chiudere con Esc o un tocco fuori (solo quando si rilegge: la conferma della lettura è obbligatoria). */
  dismissible: boolean;
  /** Una carta a figura intera, inclinata e infilata sotto il bordo del pannello (per esempio la Principessa accanto alle regole speciali). */
  portrait?: { src: string; name: string };
}

/**
 * La dialog dei testi dell'avventura: titolo, etichetta e un testo lungo che scorre. All'inizio della partita non si chiude finché non si conferma
 * la lettura (`confirm`); quando si rilegge l'obiettivo dal suo tasto si chiude anche con Esc o un tocco fuori.
 */
@Component({
  selector: 'app-adventure-dialog',
  imports: [DialogComponent, MarkdownPipe, PictureComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as v) {
      <app-dialog [kicker]="v.kicker" [title]="v.title" [closable]="v.dismissible" (closed)="confirm.emit()">
        @if (v.portrait; as p) {
          <!-- Una carta inclinata infilata sotto il bordo destro del pannello, come quelle delle altre dialog. -->
          <figure dialogSide class="card">
            <app-picture [src]="p.src" icon="frame_person" [iconSize]="56" />
            <figcaption><b>{{ p.name }}</b></figcaption>
          </figure>
        }
        <div class="md" [innerHTML]="v.text | markdown"></div>
        <ng-container dialogFooter><button type="button" class="dlg-btn primary" (click)="confirm.emit()">{{ v.action }}</button></ng-container>
      </app-dialog>
    }
  `,
  styles: `
    .card { position: absolute; z-index: 0; top: 8px; bottom: 8px; left: calc(100% - 30px); width: 200px; margin: 0; overflow: hidden; transform: rotate(4deg); transform-origin: 30% 100%; border-radius: var(--radius-1); border: 1px solid var(--c-line-strong); background: var(--c-tile); box-shadow: 0 8px 22px rgba(0, 0, 0, 0.55); }
    .card app-picture { position: absolute; inset: 0; }
    .card figcaption { position: absolute; left: 0; right: 0; bottom: 0; background: var(--c-surface); border-top: 1px solid var(--c-line-strong); padding: 8px 12px 10px 38px; }
    .card figcaption b { font: 600 var(--fs-md)/1.2 var(--font-display); letter-spacing: 0.04em; }
    @media (max-width: 900px) { .card { display: none; } }
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
