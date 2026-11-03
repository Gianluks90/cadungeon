import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TrPipe } from '../i18n/tr.pipe';
import { IconComponent } from './icon.component';

/**
 * Gli strumenti del Maligno, in una fila appena sopra il suo footer, a sinistra (come i comandi degli eroi sopra la loro barra: stessa altezza dei
 * tasti, 34 px, 44 col dito). Qui i tasti hanno anche l'etichetta. Per ora uno: "Mostri automatici", acceso/spento al volo. Su un telefono (`inline`) sta
 * nell'intestazione in alto, nella stessa riga di logo e Salva.
 */
@Component({
  selector: 'app-evil-actions',
  host: { '[class.inline]': 'inline()' },
  imports: [TrPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="tool" [class.on]="autoMonsters()" [attr.aria-pressed]="autoMonsters()" [title]="'Se acceso, i mostri agiscono da soli a ogni inizio del tuo turno.' | tr" (click)="toggleAuto.emit()">
      <app-icon name="autorenew" [size]="20" />
      <span class="label">{{ 'Mostri automatici' | tr }}</span>
      <span class="state">{{ (autoMonsters() ? 'ON' : 'OFF') | tr }}</span>
      <kbd>A</kbd>
    </button>
  `,
  styles: `
    @keyframes tools-in { from { transform: translateY(200%); opacity: 0; } }
    :host { animation: tools-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); }
    @media (prefers-reduced-motion: reduce) { :host { animation: none; } }
    :host {
      /* Appena sopra il footer del Maligno (76 px, 12 px dai bordi), a sinistra. */
      position: absolute; z-index: 10; left: 12px; bottom: calc(var(--footer-height, 0px) + env(safe-area-inset-bottom) + 12px + 76px + 8px);
      display: flex; gap: 8px; user-select: none;
    }
    .tool {
      position: relative; display: inline-flex; align-items: center; gap: 8px; box-sizing: border-box; height: 34px; padding: 0 16px 0 10px; border-radius: var(--radius-1); cursor: pointer;
      background: var(--c-surface); border: 1px solid var(--c-line-strong); color: var(--c-text-dim); font: 600 12px/1 var(--font-ui);
      transition: color 0.15s, border-color 0.15s;
    }
    .tool:hover, .tool:focus-visible { color: var(--c-faction-evil); border-color: var(--c-faction-evil); outline: none; }
    .tool.on { color: var(--c-text); border-color: var(--c-faction-evil); }
    /* Larghezza fissa: il tasto non cambia misura passando da ON a OFF. */
    .state { box-sizing: content-box; min-width: 28px; text-align: center; padding-left: 8px; border-left: 1px solid var(--c-line-strong); font: 600 11px/1 var(--font-mono); letter-spacing: var(--label-tracking); color: var(--c-text-dim); }
    .tool.on .state { color: var(--c-faction-evil); border-left-color: var(--c-faction-evil); }
    /* La lettera del tasto, piccola in un angolo, solo dove c'è una tastiera (come sui comandi degli eroi). */
    kbd { display: none; position: absolute; right: 3px; bottom: 2px; font: 600 9px/1 var(--font-mono); color: var(--c-text-dim); pointer-events: none; }
    @media (pointer: fine) { kbd { display: block; } }
    /* Tocco: almeno 44 px */
    @media (pointer: coarse) { .tool { height: 44px; } }
    /* Telefono: lo strumento sta nell'intestazione in alto (insieme a logo e Salva), nel suo flusso invece che fisso in basso. */
    :host(.inline) { position: static; animation: none; pointer-events: auto; flex: 1 1 0; min-width: 0; }
    /* Il tasto si allarga a riempire lo spazio che resta nella riga (la scritta e ON/OFF restano al centro). */
    :host(.inline) .tool { width: 100%; justify-content: center; }
  `,
})
export class EvilActionsComponent {
  /** I mostri agiscono da soli a inizio turno. */
  readonly autoMonsters = input(false);
  /** Dentro l'intestazione in alto (telefono) invece che sopra il footer. */
  readonly inline = input(false);
  readonly toggleAuto = output<void>();
}
