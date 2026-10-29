import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DialogComponent } from '../ui/dialog.component';
import { IconComponent } from '../ui/icon.component';

/**
 * L'elenco delle variabili dell'avventura (interruttori acceso/spento che gli eventi accendono e leggono): si aggiungono scrivendo il nome e si tolgono con la X. Una variabile
 * usata dagli eventi dice quante volte; toglierla non cancella gli eventi, ma la Verifica segnala il riferimento rotto. Le modifiche si applicano subito.
 */
@Component({
  selector: 'app-variables-dialog',
  imports: [DialogComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [closeOnBackdrop]="false" title="Variabili" width="min(480px, 100%)" (closed)="closed.emit()">
        <p class="hint">Interruttori con un nome (tutti spenti all'inizio): gli eventi li accendono e li leggono per ricordarsi cosa è successo, per esempio "Cuore di Munkar trovato".</p>
        @for (v of variables(); track v) {
          <div class="row">
            <span class="name">{{ v }}</span>
            <small>{{ usage()[v] ? 'in ' + usage()[v] + (usage()[v] === 1 ? ' evento' : ' eventi') : 'non usata' }}</small>
            <button type="button" class="rm" [attr.aria-label]="'Togli la variabile ' + v" title="Togli la variabile" (click)="removed.emit(v)"><app-icon name="delete" [size]="18" /></button>
          </div>
        } @empty {
          <p class="empty">Nessuna variabile ancora.</p>
        }
        <div class="add">
          <input type="text" autocomplete="off" maxlength="40" placeholder="Nome della nuova variabile" aria-label="Nome della nuova variabile" [value]="draft()" (input)="draft.set($any($event.target).value)" (keydown.enter)="add()" />
          <button type="button" class="dlg-btn" [class.off]="!canAdd()" [attr.aria-disabled]="!canAdd()" (click)="add()">Aggiungi</button>
        </div>
      </app-dialog>
    }
  `,
  styles: `
    .hint { margin: 0; color: var(--c-text-dim); font-size: 12px; }
    .row { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center; padding: 6px 10px; border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    small { color: var(--c-text-dim); }
    .rm { border: 0; background: none; color: var(--c-text-dim); cursor: pointer; display: inline-flex; padding: 0 2px; }
    .rm:hover { color: var(--c-danger); }
    .empty { margin: 0; color: var(--c-text-dim); text-align: center; }
    .add { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
    input { box-sizing: border-box; width: 100%; min-width: 0; padding: 8px 10px; border-radius: var(--radius-1); background: var(--c-bg); color: var(--c-text); border: 1px solid var(--c-line-strong); font: 13px/1.4 var(--font-ui); }
    input:focus { border-color: var(--c-interact); outline: none; }
    .dlg-btn.off { opacity: 0.45; cursor: default; }
  `,
})
export class VariablesDialogComponent {
  readonly open = input(false);
  readonly variables = input<string[]>([]);
  /** Quante volte compare ogni variabile negli eventi. */
  readonly usage = input<Record<string, number>>({});
  readonly added = output<string>();
  readonly removed = output<string>();
  readonly closed = output<void>();

  protected readonly draft = signal('');
  protected readonly canAdd = computed(() => {
    const n = this.draft().trim();
    return !!n && !this.variables().includes(n);
  });

  protected add() {
    if (!this.canAdd()) return;
    this.added.emit(this.draft().trim());
    this.draft.set('');
  }
}
