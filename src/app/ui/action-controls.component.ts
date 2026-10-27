import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { HeroAction } from '../game/pieces/piece';
import { IconComponent } from './icon.component';

/** Le azioni che si scelgono con i pallini (le stesse dei tasti R, C e S). */
export type ActionCommand = 'run' | 'fight' | 'rest' | 'prepare';

const COMMANDS: { id: ActionCommand; icon: string; label: string; key: string }[] = [
  { id: 'run', icon: 'directions_run', label: 'Correre', key: 'R' },
  { id: 'fight', icon: 'swords', label: 'Combattere', key: 'C' },
  { id: 'rest', icon: 'bedtime', label: 'Riposo', key: 'S' },
  { id: 'prepare', icon: 'tactic', label: 'Prepararsi (piazza un ordine)', key: 'E' },
];

/**
 * I comandi dell'eroe attivo: pallini solo icona in basso a destra sopra il footer, nello stile di quelli della camera.
 * L'azione scelta ha il bordo acceso; un secondo tocco la toglie, come il tasto. Sui dispositivi con tastiera
 * (puntatore preciso) la lettera del tasto compare in un angolo del pallino.
 */
@Component({
  selector: 'app-action-controls',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (c of commands; track c.id) {
      <button type="button" [class.on]="action() === c.id" [class.off]="busy()" [attr.aria-pressed]="action() === c.id" [attr.aria-disabled]="busy()" [attr.aria-label]="c.label" [title]="c.label + ' (' + c.key + ')'" (click)="chosen.emit(c.id)">
        <app-icon [name]="c.icon" [size]="20" /><kbd>{{ c.key }}</kbd>
      </button>
    }
  `,
  styles: `
    :host {
      position: absolute; z-index: 10; right: 12px; bottom: calc(var(--footer-height, 0px) + env(safe-area-inset-bottom) + 12px);
      display: flex; gap: 8px; user-select: none;
    }
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
  readonly action = input<HeroAction>('advance');
  /** Ora i comandi non si possono usare (turno dell'Overlord, finestra aperta): i pallini restano ma spenti. */
  readonly busy = input(false);
  readonly chosen = output<ActionCommand>();
  protected readonly commands = COMMANDS;
}
