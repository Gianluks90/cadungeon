import { tr } from '../i18n/catalog-text';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { HeroAction } from '../game/pieces/piece';
import { IconComponent } from './icon.component';
import { PillComponent } from './pill.component';

/** Le azioni che si scelgono con i pallini (le stesse dei tasti R, C e S). */
export type ActionCommand = 'run' | 'fight' | 'rest' | 'prepare';

const COMMANDS: { id: ActionCommand; icon: string; label: string; key: string }[] = [
  { id: 'run', icon: 'directions_run', get label() { return tr('Correre'); }, key: 'R' },
  { id: 'fight', icon: 'swords', get label() { return tr('Combattere'); }, key: 'C' },
  { id: 'rest', icon: 'bedtime', get label() { return tr('Riposo'); }, key: 'Q' },
  { id: 'prepare', icon: 'tactic', get label() { return tr('Prepararsi (piazza un ordine)'); }, key: 'E' },
];

/**
 * I comandi dell'eroe attivo: pallini solo icona in basso a destra sopra il footer, nello stile di quelli della camera.
 * L'azione scelta ha il bordo acceso; un secondo tocco la toglie, come il tasto. Sui dispositivi con tastiera
 * (puntatore preciso) la lettera del tasto compare in un angolo del pallino.
 */
@Component({
  selector: 'app-action-controls',
  host: { '[style.--slots]': 'slots()', '[style.left]': "'max(12px, calc(50% - (320px + ' + slots() * 75 + 'px) / 2))'" },
  imports: [IconComponent, PillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="actions">
    @for (c of commands; track c.id) {
      <button type="button" [class.on]="action() === c.id" [class.off]="busy()" [attr.aria-pressed]="action() === c.id" [attr.aria-disabled]="busy()" [attr.aria-label]="c.label" [title]="c.label + ' (' + c.key + ')'" (click)="chosen.emit(c.id)">
        <app-icon [name]="c.icon" [size]="20" /><kbd>{{ c.key }}</kbd>
      </button>
    }
    </span>
    <span class="runes">
      @for (r of runes(); track r.color) {
        <app-pill icon="tokens/rune_key" [color]="'var(--cad-rune-' + r.color + ')'" [dim]="!r.owned" [attr.aria-label]="r.label" [attr.title]="r.label" />
      }
    </span>
  `,
  styles: `
    @keyframes controls-in { from { transform: translateY(200%); opacity: 0; } }
    :host { animation: controls-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); }
    @media (prefers-reduced-motion: reduce) { :host { animation: none; } }
    :host {
      /* Sopra l'elenco degli eroi, allineati a sinistra con lui; z-index sotto la barra (25), così i pannelli aperti li coprono. */
      position: absolute; z-index: 10; bottom: calc(var(--footer-height, 0px) + env(safe-area-inset-bottom) + 12px + 76px + 8px);
      display: flex; justify-content: space-between; align-items: center; gap: 8px; user-select: none; pointer-events: none;
      width: min(calc(320px + var(--slots) * 75px), calc(100vw - 24px));
    }
    .actions, .runes { display: flex; gap: 8px; }
    .actions { pointer-events: auto; }
    /* Le chiavi runiche non sono tasti: tonde. */
    .runes app-pill.icon-only { box-sizing: border-box; width: 34px; height: 34px; padding: 0; justify-content: center; border-radius: var(--radius-round); }
    button {
      position: relative; display: inline-flex; align-items: center; justify-content: center;
      box-sizing: border-box; width: 34px; height: 34px; padding: 0; border-radius: var(--radius-1); cursor: pointer;
      background: var(--c-surface); border: 1px solid var(--c-line-strong); color: var(--c-text);
      transition: color 0.15s, border-color 0.15s, opacity 0.15s;
    }
    button:hover, button:focus-visible { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
    button.on { border-color: var(--c-interact); color: var(--c-interact); }
    button.off { opacity: 0.45; }
    kbd { display: none; position: absolute; right: 2px; bottom: 1px; font: 600 9px/1 var(--font-mono); color: var(--c-text-dim); pointer-events: none; }
    @media (pointer: fine) { kbd { display: block; } }
    /* Tocco: almeno 44 px */
    @media (pointer: coarse) { button { width: 44px; height: 44px; } }
  `,
})
export class ActionControlsComponent {
  /** L'azione scelta adesso dall'eroe attivo. */
  /** Quanti eroi ha la partita: la barra è larga quanto un tab aperto più i chiusi e Passa, e i comandi si allineano al suo bordo sinistro. */
  readonly slots = input(2);
  /** Le chiavi runiche della partita: a destra, sulla stessa riga dei comandi, grigie finché non sono trovate. */
  readonly runes = input<{ color: string; owned: boolean; label: string }[]>([]);
  readonly action = input<HeroAction>('advance');
  /** Ora i comandi non si possono usare (turno dell'Overlord, finestra aperta): i pallini restano ma spenti. */
  readonly busy = input(false);
  readonly chosen = output<ActionCommand>();
  protected readonly commands = COMMANDS;
}
