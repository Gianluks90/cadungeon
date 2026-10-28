import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DialogComponent } from '../ui/dialog.component';
import { IconComponent } from '../ui/icon.component';
import { Check, CheckLevel } from './validator';

/** L'ordine e i titoli dei gruppi: prima ciò che va corretto, poi le attenzioni, i controlli non ancora disponibili e infine ciò che è verificato. */
const GROUPS: { level: CheckLevel; title: string; icon: string }[] = [
  { level: 'error', title: 'Da correggere', icon: 'report' },
  { level: 'warning', title: 'Attenzione', icon: 'warning' },
  { level: 'todo', title: 'Controlli non ancora disponibili', icon: 'schedule' },
  { level: 'ok', title: 'Verificato', icon: 'check_circle' },
];

/**
 * La dialog della verifica dell'avventura: l'elenco dei controlli, raggruppati per esito. Gli errori sono le cose obbligatorie senza le quali l'avventura non si può usare.
 */
@Component({
  selector: 'app-validation-dialog',
  imports: [DialogComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog title="Verifica dell'avventura" (closed)="closed.emit()">
        @for (g of groups(); track g.level) {
          @if (!$first) { <hr /> }
          <section [attr.data-level]="g.level">
            <h3><app-icon [name]="g.icon" [size]="16" />{{ g.title }} <span class="n">{{ g.checks.length }}</span></h3>
            <ul>
              @for (c of g.checks; track c.id) { <li>{{ c.text }}</li> }
            </ul>
          </section>
        }
      </app-dialog>
    }
  `,
  styles: `
    section { display: flex; flex-direction: column; gap: 6px; }
    hr { width: 100%; margin: 0; border: 0; border-top: 1px solid var(--c-line-strong); }
    h3 { display: flex; align-items: center; gap: 7px; margin: 0; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--tone); }
    .n { color: var(--c-text-dim); font-family: var(--font-mono); }
    ul { list-style: none; margin: 0; padding: 0 0 0 23px; display: flex; flex-direction: column; gap: 5px; }
    li { color: var(--c-text); }
    [data-level='error'] { --tone: var(--c-error); }
    [data-level='warning'] { --tone: var(--c-warn); }
    [data-level='ok'] { --tone: var(--c-ok); }
    [data-level='todo'] { --tone: var(--c-text-dim); }
    [data-level='todo'] li { color: var(--c-text-dim); }
  `,
})
export class ValidationDialogComponent {
  readonly open = input(false);
  readonly checks = input<Check[]>([]);
  readonly closed = output<void>();

  protected readonly groups = computed(() => GROUPS.map((g) => ({ ...g, checks: this.checks().filter((c) => c.level === g.level) })).filter((g) => g.checks.length));
}
