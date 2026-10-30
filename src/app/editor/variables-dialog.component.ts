import { TranslatePipe } from '../i18n/translate.pipe';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DialogComponent } from '../ui/dialog.component';
import { IconComponent } from '../ui/icon.component';

/**
 * L'elenco delle variabili dell'avventura (interruttori acceso/spento che gli eventi accendono e leggono): si aggiungono scrivendo il nome e si tolgono con la X. Una variabile
 * usata dagli eventi dice quante volte; toglierla non cancella gli eventi, ma la Verifica segnala il riferimento rotto. Le modifiche si applicano subito.
 */
@Component({
  selector: 'app-variables-dialog',
  imports: [TranslatePipe, DialogComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [closeOnBackdrop]="false" [title]="'variablesDialog.variabili' | t" width="min(480px, 100%)" (closed)="closed.emit()">
        <p class="dlg-hint">{{ 'variablesDialog.interruttoriConUnNomeTutti' | t }}</p>
        @for (v of variables(); track v) {
          <div class="row">
            <span class="name">{{ v }}</span>
            <small>{{ usage()[v] ? ((usage()[v] === 1 ? 'variablesDialog.usedOne' : 'variablesDialog.usedMany') | t: { n: usage()[v] }) : ('variablesDialog.unused' | t) }}</small>
            <button type="button" class="dlg-rm" [attr.aria-label]="'variablesDialog.removeNamed' | t: { name: v }" [title]="'variablesDialog.togliLaVariabile' | t" (click)="removed.emit(v)"><app-icon name="delete" [size]="18" /></button>
          </div>
        } @empty {
          <p class="empty">{{ 'variablesDialog.nessunaVariabileAncora' | t }}</p>
        }
        <div class="dlg-add">
          <input type="text" autocomplete="off" maxlength="40" [placeholder]="'variablesDialog.nomeDellaNuovaVariabile' | t" [attr.aria-label]="'variablesDialog.nomeDellaNuovaVariabile' | t" [value]="draft()" (input)="draft.set($any($event.target).value)" (keydown.enter)="add()" />
          <button type="button" class="dlg-btn" [class.off]="!canAdd()" [attr.aria-disabled]="!canAdd()" (click)="add()">{{ 'common.aggiungi' | t }}</button>
        </div>
      </app-dialog>
    }
  `,
  styles: `
    .row { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center; padding: 6px 10px; border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    small { color: var(--c-text-dim); }
    .empty { margin: 0; color: var(--c-text-dim); text-align: center; }
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
