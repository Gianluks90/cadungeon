import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CostTextComponent } from './cost-text.component';
import { DialogComponent } from './dialog.component';
import { MarkdownPipe } from './markdown.pipe';

/** Ciò che la dialog di scelta mostra: un titolo, un testo (con i costi, come `{fat:2}`) e i bottoni fra cui scegliere (anche le loro etichette possono avere i costi: prima il costo, poi il testo). */
export interface ChoiceView {
  title: string;
  text: string;
  /** Il testo è markdown (titoli, elenchi, grassetto...) invece di una frase con i costi. */
  markdown?: boolean;
  choices: { id: string; label: string; /** Il bottone principale (bordo acceso). */ primary?: boolean }[];
}

/**
 * Una piccola dialog con una domanda e dei bottoni (per esempio la Vigilanza: "attacchi con quest'arma o rinunci?"). Non si chiude da sola: bisogna scegliere.
 */
@Component({
  selector: 'app-choice-dialog',
  imports: [CostTextComponent, DialogComponent, MarkdownPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as v) {
      <app-dialog [title]="v.title" width="min(420px, 100%)" [closable]="false">
        @if (v.markdown) { <div class="md" [innerHTML]="v.text | markdown"></div> } @else { <p><app-cost-text [text]="v.text" /></p> }
        <ng-container dialogFooter>
          @for (c of v.choices; track c.id) { <button type="button" class="dlg-btn" [class.primary]="c.primary" (click)="chosen.emit(c.id)"><app-cost-text [text]="c.label" /></button> }
        </ng-container>
      </app-dialog>
    }
  `,
  styles: `
    p { margin: 0; color: var(--c-text-dim); }
  `,
})
export class ChoiceDialogComponent {
  readonly view = input<ChoiceView | null>(null);
  readonly chosen = output<string>();
}
