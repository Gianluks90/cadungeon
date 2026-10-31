import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { DialogComponent } from '../ui/dialog.component';
import { FieldComponent } from '../ui/field.component';
import { IconComponent } from '../ui/icon.component';
import { claimCode } from './lobby-net';
import { Lobby, LOBBY_CODE_MAX, LOBBY_MAX_HEROES, LOBBY_MIN_HEROES, cleanLobbyCode, generateLobbyCode, isValidLobbyCode } from './lobby-store';

type Tab = 'create' | 'join';

/**
 * La dialog del Multiplayer, con due etichette: "Crea partita" (chi fa il Signore supremo sceglie quanti eroi giocano, da 1 a 4, e il codice da condividere, scritto a mano o
 * generato) e "Unisciti" (chi gioca un eroe scrive il codice: per ora spento, arriva con la rete). `created` porta la partita a chi apre la dialog.
 */
@Component({
  selector: 'app-multiplayer-dialog',
  imports: [DialogComponent, FieldComponent, IconComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog [title]="'mp.title' | t" [closeOnBackdrop]="false" (closed)="closed.emit()">
      <div class="tabs" role="tablist">
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'create'" [class.on]="tab() === 'create'" (click)="tab.set('create')">{{ 'mp.create' | t }}</button>
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'join'" [class.on]="tab() === 'join'" (click)="tab.set('join')">{{ 'mp.join' | t }}</button>
      </div>
      @if (tab() === 'create') {
        <div class="pane">
          <app-field [label]="'mp.heroes' | t">
            <div class="count" role="radiogroup" [attr.aria-label]="'mp.heroes' | t">
              @for (n of counts; track n) {
                <button type="button" role="radio" [attr.aria-checked]="heroes() === n" [class.on]="heroes() === n" (click)="heroes.set(n)">{{ n }}</button>
              }
            </div>
          </app-field>
          <p class="dlg-hint">{{ summary() }}</p>
          <app-field [label]="'mp.code' | t" [error]="codeError()">
            <div class="code-row">
              <input type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" [attr.maxlength]="codeMax" [value]="code()" [placeholder]="'mp.codePlaceholder' | t" (input)="setCode($any($event.target).value)" />
              <button type="button" class="gen" [attr.aria-label]="'mp.generate' | t" [title]="'mp.generate' | t" (click)="code.set(generate())"><app-icon name="autorenew" [size]="20" /></button>
            </div>
          </app-field>
          <p class="dlg-hint">{{ 'mp.codeHint' | t }}</p>
        </div>
      } @else {
        <div class="pane">
          <app-field [label]="'mp.code' | t">
            <input type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" [attr.maxlength]="codeMax" [value]="joinCode()" [placeholder]="'mp.codePlaceholder' | t" (input)="joinCode.set(clean($any($event.target).value))" (keydown.enter)="join()" />
          </app-field>
          <p class="dlg-hint">{{ 'mp.joinHint' | t }}</p>
        </div>
      }
      <ng-container dialogFooter>
        @if (tab() === 'create') {
          <button type="button" class="dlg-btn primary" [attr.aria-disabled]="valid() ? null : 'true'" (click)="submit()">{{ (checking() ? 'mp.checking' : 'mp.createGame') | t }}</button>
        } @else {
          <button type="button" class="dlg-btn primary" [attr.aria-disabled]="joinValid() ? null : 'true'" (click)="join()">{{ 'mp.joinGame' | t }}</button>
        }
      </ng-container>
    </app-dialog>
  `,
  styles: `
    .tabs { display: flex; gap: 0; border-bottom: 1px solid var(--c-line-strong); margin: -4px 0 4px; }
    .tabs button { flex: 1; padding: 10px 12px; border: 0; border-bottom: 2px solid transparent; background: none; color: var(--c-text-dim); cursor: pointer; font: 600 13px/1.2 var(--font-ui); transition: color 0.15s, border-color 0.15s; }
    .tabs button:hover, .tabs button:focus-visible { color: var(--c-text); outline: none; }
    .tabs button.on { color: var(--c-interact); border-bottom-color: var(--c-interact); }
    .pane { display: flex; flex-direction: column; gap: 14px; min-width: min(380px, 100%); }
    .count { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .count button { padding: 10px 0; border-radius: var(--radius-1); border: 1px solid var(--c-line-strong); background: var(--c-bg); color: var(--c-text); cursor: pointer; font: 600 15px/1 var(--font-ui); transition: color 0.15s, border-color 0.15s; }
    .count button:hover, .count button:focus-visible { border-color: var(--c-interact); outline: none; }
    .count button.on { color: var(--c-interact); border-color: var(--c-interact); }
    .code-row { display: flex; gap: 8px; }
    .code-row input { flex: 1; min-width: 0; text-transform: uppercase; letter-spacing: 0.18em; font-variant-numeric: tabular-nums; }
    .gen { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 40px; border-radius: var(--radius-1); border: 1px solid var(--c-line-strong); background: var(--c-bg); color: var(--c-text); cursor: pointer; transition: color 0.15s, border-color 0.15s; }
    .gen:hover, .gen:focus-visible { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
  `,
})
export class MultiplayerDialogComponent {
  readonly closed = output<void>();
  readonly created = output<Lobby>();
  /** Chi gioca un eroe ha scritto il codice: la home lo porta alla sala d'attesa. */
  readonly joined = output<string>();

  private readonly i18n = inject(I18nService);
  protected readonly counts = Array.from({ length: LOBBY_MAX_HEROES - LOBBY_MIN_HEROES + 1 }, (_, i) => LOBBY_MIN_HEROES + i);
  protected readonly codeMax = LOBBY_CODE_MAX;
  protected readonly tab = signal<Tab>('create');
  protected readonly heroes = signal(LOBBY_MIN_HEROES + 1);
  protected readonly code = signal('');
  protected generate() {
    this.netError.set('');
    return generateLobbyCode();
  }
  /** Il codice è già in uso su questo dispositivo: lo dice la home, che tiene l'elenco (`taken`). */
  readonly taken = input<readonly string[]>([]);

  protected readonly summary = computed(() => this.i18n.t(this.heroes() === 1 ? 'mp.summaryOne' : 'mp.summaryMany', { n: this.heroes(), total: this.heroes() + 1 }));
  /** Il controllo sulla rete è in corso, oppure ha dato un errore (codice già usato da qualcun altro, nessuna connessione). */
  protected readonly checking = signal(false);
  private readonly netError = signal<'taken' | 'offline' | ''>('');
  protected readonly codeError = computed(() => {
    if (this.taken().includes(this.code()) || this.netError() === 'taken') return this.i18n.t('mp.codeTaken');
    return this.netError() === 'offline' ? this.i18n.t('mp.offline') : '';
  });
  protected readonly valid = computed(() => isValidLobbyCode(this.code()) && !this.taken().includes(this.code()) && !this.checking());
  protected readonly joinCode = signal('');
  protected readonly joinValid = computed(() => isValidLobbyCode(this.joinCode()));
  protected readonly clean = cleanLobbyCode;

  protected setCode(raw: string) {
    this.code.set(cleanLobbyCode(raw));
    this.netError.set('');
  }

  protected join() {
    if (this.joinValid()) this.joined.emit(this.joinCode());
  }

  /** Prima di creare la partita si controlla sulla rete che nessun altro stia usando lo stesso codice: così è unico davvero, non solo su questo dispositivo. */
  protected async submit() {
    if (!this.valid()) return;
    const code = this.code();
    this.checking.set(true);
    const result = await claimCode(code);
    this.checking.set(false);
    if (result !== 'ok') return this.netError.set(result);
    this.created.emit({ code, heroes: this.heroes(), createdAt: Date.now() });
  }
}
